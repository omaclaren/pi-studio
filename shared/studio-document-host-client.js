import { isStudioPristineBuffer } from "./studio-document-hosting.js";
import { createStudioDocumentCopyIntent } from "./studio-document-escrow.js";
import { createStudioDocumentLaunchController, openStudioRetainedDocument } from "./studio-document-launch-client.js";

// Adoption permits discarding the empty replacement, never late local work or
// an unresolved/corrupt handoff backup. A full Studio host is never retired.
export function studioDocumentRetiredViewCanClose(facts) {
	try {
		const { snapshot, backup } = facts, entry = snapshot?.buffers?.[0];
		return Boolean(facts.retired && facts.adoptionConfirmed && facts.editorText === ""
			&& !facts.metadataPending && !facts.operationPending && snapshot?.mode === "editor-only"
			&& snapshot.buffers.length === 1 && snapshot.selectedBufferId === entry.id && entry.role === "document"
			&& facts.boundBufferId === entry.id && ["source", "label", "path", "draftId"].every(key => facts.editorSourceState[key] === entry.sourceState[key])
			&& facts.editorResourceDir === entry.resourceDir && facts.editorBaselineText === entry.baselineText && facts.editorDiskRevision === entry.diskRevision
			&& entry.diskRevision === null && isStudioPristineBuffer(entry) && backup?.record === null && backup.error === null);
	} catch { return false; }
}

export function createStudioDocumentHostController(options) {
	let active = null, closed = false, polling = false, latest = null, preparing = false;
	let copyFlight = null, openFlight = null, automaticOpen = null, copyLive = false, copyReceipt = null, forgettingCopy = false;
	const destinationFlights = new Map(), destinationObservations = new Map();
	const copies = createStudioDocumentCopyIntent(options.copyStorage, "piStudio.bufferWorkspace.v2:" + options.workspaceId + ":copy");
	const launch = options.launch ? createStudioDocumentLaunchController({ ...options.launch,
		workspaceId: options.workspaceId, storage: options.copyStorage, generation: options.generation,
		prepare: () => options.prepare("launch"), authority: () => options.client()?.hostingAuthority(),
		busy: () => closed || preparing || active || copyFlight || options.busy(), status: options.status, changed: options.changed,
		selectOwner: options.selectOwner,
	}) : null;
	const receiving = new Set();
	let adoptionPending = null;
	const adoptionFlights = new Set();
	const client = () => options.client();
	const nonce = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, "0")).join("");
	const request = body => options.request({ ...body, generation: options.generation() });
	const notify = (message, kind = "warning") => { if (!closed) { options.status(message, kind); options.changed(); } };
	function rememberMoved(result, sourceBufferId = result.bufferId) {
		if (result.status !== "committed") return false;
		const saved = copies.remember({ operationId: result.moveId, sourceBufferId, workspaceId: result.targetWorkspaceId, bufferId: result.bufferId, kind: "move", created: false });
		if (!saved.ok) notify("Document moved, but destination tracking could not be verified. Keep the source backup and recheck.");
		return saved.ok;
	}
	function destinations() {
		return copies.peek().destinations.map(d => ({ ...d, live: destinationObservations.get(d.bufferId)?.generation === options.generation() && destinationObservations.get(d.bufferId)?.live === true }));
	}
	function openDestination(destination, focus = true) {
		if (closed || !destination || !copies.peek().destinations.some(d => d.operationId === destination.operationId && d.bufferId === destination.bufferId)) return Promise.resolve(false);
		const key = destination.bufferId + ":" + focus;
		if (destinationFlights.has(key)) return destinationFlights.get(key);
		// Silent and explicit flights share per-buffer observation order. Each
		// owner RPC (including the final focus check) starts a fresh ticket.
		let observation;
		const beginObservation = () => { observation = { generation: options.generation(), live: false }; destinationObservations.set(destination.bufferId, observation); };
		beginObservation();
		const work = openStudioRetainedDocument({ workspaceId: options.workspaceId, generation: options.generation, current: () => !closed,
			request: body => { beginObservation(); return request(body); }, confirm: options.confirmResume, open: options.open, selectOwner: options.selectOwner, status: options.status, changed: options.changed,
			observed: (bufferId, result) => { if (destinationObservations.get(bufferId) !== observation) return; copyLive = result.live === true; observation.live = copyLive; },
		}, destination.bufferId, focus).finally(() => { destinationFlights.delete(key); if (!closed) options.changed(); });
		destinationFlights.set(key, work); return work;
	}
	function finish(proof, result) {
		if (closed || !proof || active !== proof || !client()) return false;
		options.capture(); // Include Prompt typing still waiting on the ordinary debounce.
		// Synchronous: bind new DOM before any await or readiness callback can
		// treat the old source textarea as the fresh replacement slot.
		const applied = client().finishHosting(proof, result, () => options.domCurrent(proof));
		if (!applied.ok) { notify(applied.message); return false; }
		active = null;
		if (result.status === "committed" && proof.direction === "outgoing") options.depart(proof.bufferId);
		if (result.status === "committed" && proof.direction === "outgoing" && !options.full) options.retire();
		else if (applied.selectedChanged) options.bind();
		latest = result.status === "committed" ? result : latest;
		if (result.status === "committed" && proof.direction === "outgoing") rememberMoved(result, proof.bufferId);
		options.changed();
		if (result.status === "cancelled") notify("Move cancelled. The original Document was kept.", "success");
		else notify(proof.direction === "incoming" ? "Document returned to Studio. Prompt was kept." : "Document moved; use its destination editor.", "success");
		if (result.status === "committed" && proof.direction === "incoming") void adopted(result);
		if (result.status === "committed" && proof.direction === "outgoing" && options.full && automaticOpen !== result.moveId) {
			automaticOpen = result.moveId;
			void openMoved().catch(() => notify("The Document moved, but opening its owner could not be checked. Use Find moved Document."));
		}
		return true;
	}
	async function adopted(result) {
		if (closed || adoptionFlights.has(result.moveId)) return;
		adoptionFlights.add(result.moveId);
		adoptionPending = { moveId: result.moveId, bufferId: result.bufferId }; options.changed();
		try {
			if (!client()?.hasVerifiedLocalCheckpoint()) { notify("Document arrived, but browser recovery is unverified. Keep the source backup and this tab open."); return; }
			const response = await request({ operation: "adopted", moveId: result.moveId, bufferId: result.bufferId });
			if (closed) return;
			if (!response.ok) notify(response.message);
			else if (adoptionPending?.moveId === result.moveId) { adoptionPending = null; options.changed(); }
		} catch { notify("Adoption could not be acknowledged. Keep the source backup and recheck."); }
		finally { adoptionFlights.delete(result.moveId); }
	}
	async function recheck(moveId) {
		if (closed) return;
		const result = await request({ operation: "status", moveId, incoming: true });
		if (!result.ok || closed) return result;
		if (latest?.moveId === moveId && result.status === "committed") latest = result;
		if (active?.moveId === moveId && ["committed", "cancelled"].includes(result.status)) finish(active, result);
		else if (result.status === "offered" && result.targetWorkspaceId === options.workspaceId && options.full && !active && !receiving.has(moveId)) {
			receiving.add(moveId); try { await incoming(result); } finally { receiving.delete(moveId); }
		}
		if (adoptionPending?.moveId === moveId && result.status === "committed" && result.targetWorkspaceId === options.workspaceId
			&& client()?.snapshot()?.buffers.some(buffer => buffer.id === result.bufferId)) await adopted(result);
		const backup = client()?.handoffBackup()?.record;
		if (!active && backup?.moveId === moveId && (result.adopted || result.status === "cancelled")) {
			if (result.adopted) {
				if (!rememberMoved(result)) return result;
				const destination = copies.peek().destinations.find(d => d.operationId === moveId);
				if (!await openDestination(destination, false)) return result;
			}
			if (closed) return result;
			const resolved = client().resolveHandoff(result); options.changed();
			if (resolved.ok && result.adopted) options.closeRetired();
		}
		return result;
	}
	async function incoming(result) {
		// A concrete decline, not a GET/timeout, releases the source. Consent is
		// acquired before freezing the destination, including non-text metadata.
		if (preparing || copyFlight || launch?.busy() || options.busy()) { await request({ operation: "decline", moveId: result.moveId }); return; }
		const state = client()?.snapshot(), doc = state?.buffers.find(b => b.role === "document");
		if (!doc) { await request({ operation: "decline", moveId: result.moveId }); return; }
		const discardTarget = !isStudioPristineBuffer(doc);
		if (discardTarget && !await options.confirm("Replace Studio's Document?", "The browser Document will replace the current Document, including its unsaved text and metadata association. Prompt will be kept.")) {
			await request({ operation: "decline", moveId: result.moveId }); return;
		}
		try {
			await options.prepare("incoming");
			if (closed) return;
			if (JSON.stringify(client().snapshot().buffers.find(b => b.role === "document")) !== JSON.stringify(doc)) throw new Error("The destination Document changed. It was not replaced.");
			const frozen = client().freezeHosting({ moveId: result.moveId, direction: "incoming", bufferId: doc.id });
			if (!frozen.ok) throw new Error(frozen.message);
			active = frozen.proof; options.changed();
			const accepted = await request({ operation: "accept", moveId: result.moveId, expectedRevision: active.expectedRevision, targetBufferId: doc.id, discardTarget });
			if (accepted.ok) finish(active, accepted);
			else {
				const declined = await request({ operation: "decline", moveId: result.moveId });
				if (declined.ok) finish(active, declined); else notify("Move outcome is uncertain. Both editors remain protected; use Recheck move.");
			}
		} catch (error) {
			if (!active) await request({ operation: "decline", moveId: result.moveId }).catch(() => {});
			notify(error.message || "Move outcome is uncertain. Recheck before resuming.");
		}
	}
	async function move() {
		if (closed || active || preparing || copyFlight || launch?.busy() || options.busy()) return;
		preparing = true;
		let proof;
		try {
			let targetWorkspaceId;
			if (!options.full) {
				const hosts = await request({ operation: "hosts" });
				if (!hosts.ok || !hosts.workspaces?.length) throw new Error("Open the full Studio view first, then move this Document back.");
				targetWorkspaceId = hosts.workspaces[0];
			}
			await options.prepare("outgoing");
			if (closed) return;
			const state = client().snapshot(), doc = state.buffers.find(b => b.id === state.selectedBufferId);
			const frozen = client().freezeHosting({ moveId: nonce(), direction: "outgoing", bufferId: doc.id });
			if (!frozen.ok) throw new Error(frozen.message);
			proof = active = frozen.proof; options.changed();
			const result = await request({ operation: options.full ? "move-out" : "begin", moveId: proof.moveId,
				expectedRevision: proof.expectedRevision, bufferId: proof.bufferId, targetMode: options.full ? "editor-only" : "full", targetWorkspaceId });
			if (closed || active !== proof) { if (openFlight) await openFlight; return; }
			if (result.ok && result.status === "committed") { finish(proof, result); if (openFlight) await openFlight; }
			else if (!result.ok) {
				const cancelled = await request({ operation: "cancel", moveId: proof.moveId, expectedRevision: proof.expectedRevision });
				if (cancelled.ok) finish(proof, cancelled);
				notify(result.message);
			} else notify("Waiting for Studio to accept the Document. Recheck or Cancel if needed.");
		} catch (error) { notify(proof ? "Move outcome is uncertain; recheck its status before another move." : error.message); }
		finally { preparing = false; }
	}
	function openMoved() {
		if (closed) return Promise.resolve();
		if (openFlight) return openFlight;
		const moveId = client()?.handoffBackup()?.record?.moveId || latest?.moveId || copies.peek().destinations.filter(d => d.kind === "move").at(-1)?.operationId;
		if (!moveId) return Promise.resolve();
		openFlight = (async () => {
			const result = await request({ operation: "status", moveId, focus: false });
			if (closed) return;
			if (!result.ok || !rememberMoved(result)) { notify(result.message || "The moved Document could not be checked. Keep or download its backup."); return; }
			await openDestination(copies.peek().destinations.find(d => d.operationId === moveId));
		})().finally(() => { openFlight = null; });
		return openFlight;
	}
	function copy(open = true) {
		if (closed || forgettingCopy) return Promise.resolve();
		if (copyFlight) return copyFlight;
		copyFlight = (async () => {
			try {
				const saved = copies.peek(); if (saved.error) throw new Error(saved.error.message);
				let intent = saved.record?.request;
				if (!intent) {
					if (!open || active || preparing || launch?.busy() || options.busy()) return;
					preparing = true;
					try { await options.prepare("copy"); } finally { preparing = false; }
					if (closed) return;
					const authority = client().hostingAuthority(); if (!authority.ok) throw new Error(authority.message);
					intent = { operationId: nonce(), bufferId: authority.bufferId, documentEpoch: authority.documentEpoch, expectedRevision: authority.expectedRevision };
				}
				const retained = copies.capture(intent); if (!retained.ok) throw new Error(retained.message);
				options.changed();
				const result = await request({ ...intent, operation: "copy", focus: open });
				if (closed) return;
				if (!result.ok) throw new Error(result.message || "Copy outcome is unknown. Its original identity was retained.");
				const completed = copies.complete(result);
				if (completed.destination) copyReceipt = Object.freeze({ ...completed.destination });
				if (!completed.ok) throw new Error(completed.message);
				options.changed();
				await openDestination(copies.peek().destinations.find(d => d.operationId === intent.operationId), open);
			} catch (error) { copyLive = false; if (open) notify(error.message || "Copy outcome is uncertain; recheck this same copy, not a new one."); }
		})().finally(() => { copyFlight = null; if (!closed) options.changed(); });
		return copyFlight;
	}
	const timer = setInterval(() => {
		if (closed || polling || !options.generation() || !client()) return;
		const moveId = active?.moveId || client().handoffBackup()?.record?.moveId || adoptionPending?.moveId;
		const pendingCopy = !copyLive && copies.peek().record;
		if (!moveId && !pendingCopy) return;
		polling = true; void (async () => { if (moveId) await recheck(moveId); if (pendingCopy) await copy(false); })().catch(() => {}).finally(() => { polling = false; });
	}, 1500);
	return Object.freeze({
		move, openMoved,
		launch: (target, presentation) => launch?.start(target, presentation), launchState: () => launch?.state(), recheckLaunch: () => launch?.recheck(), forgetLaunch: () => launch?.forget(),
		copy: () => copy(true),
		copyState: () => ({ ...copies.peek(), destinations: destinations(), live: copies.peek().record ? false : copyLive, busy: Boolean(copyFlight), receipt: copyReceipt ? { ...copyReceipt } : null }),
		openDestination: destination => destination.kind === "blank" || destination.kind === "file" ? launch?.openDestination(destination) : openDestination(destination),
		moveState: () => ({ adoptionPending: adoptionPending ? { ...adoptionPending } : null, pending: active ? { moveId: active.moveId, bufferId: active.bufferId, direction: active.direction } : null,
			receipt: latest ? { moveId: latest.moveId, bufferId: latest.bufferId, status: latest.status, adopted: latest.adopted === true } : null }),
		needsUnloadConfirmation: () => Boolean(copyFlight || forgettingCopy || destinationFlights.size || launch?.needsUnloadConfirmation() || copies.peek().error || copies.peek().record || destinations().some(d => !d.live || !options.generation())),
		async forgetCopy() {
			if (closed || copyFlight || preparing) return;
			const original = copies.peek().record; if (!original) return;
			forgettingCopy = true; let agreed;
			try { agreed = await options.confirmCopy("Forget this copy attempt?", "An existing copy will NOT be deleted. If its outcome is uncertain, forgetting this identity may leave a retained copy you cannot find here. Recheck first unless you deliberately want another independent copy."); }
			finally { forgettingCopy = false; }
			if (!agreed || closed || copyFlight || copies.peek().record !== original) return;
			const result = copies.clear(true); if (!result.ok) notify(result.message);
			else { copyLive = false; copyReceipt = null; notify("Copy tracking cleared. Existing documents were not deleted.", "success"); }
		},
		async cancel() {
			if (closed || !active) return; const proof = active;
			const result = await request({ operation: proof.direction === "incoming" ? "decline" : "cancel", moveId: proof.moveId, expectedRevision: proof.expectedRevision });
			if (result.ok) finish(proof, result); else notify(result.message);
		},
		recheck: () => { const id = active?.moveId || client()?.handoffBackup()?.record?.moveId || adoptionPending?.moveId || latest?.moveId; return id ? recheck(id) : Promise.resolve(); },
		onChanged: moveId => recheck(moveId).catch(() => {}),
		async ready(remote) {
			if (closed) return;
			await launch?.ready();
			if (copies.peek().record) await copy(false);
			await Promise.all(copies.peek().destinations.map(d => openDestination(d, false)));
			for (const receipt of remote?.lineage || []) if (receipt.move?.status === "committed" && receipt.move.targetWorkspaceId === options.workspaceId
				&& client()?.snapshot().buffers.some(b => b.id === receipt.move.bufferId)) await adopted(receipt.move);
			for (const move of remote?.pendingMoves || []) if (move.targetWorkspaceId === options.workspaceId) await recheck(move.moveId);
		},
		operationPending: () => Boolean(active || preparing || copyFlight || openFlight || destinationFlights.size || launch?.state().busy),
		active: () => active,
		dispose() { closed = true; clearInterval(timer); launch?.dispose(); },
	});
}

// Same-workspace replacement is not a move or a new-tab launch. The buffer
// client owns its frozen slot and verified before-state; this controller owns
// transport flights, cancellation and the synchronous DOM-binding boundary.
export function createStudioDocumentOpenController(options) {
	let closed = false, flight = null, flightKey = null, cancelFlight = null;
	const nonce = options.makeOperationId ?? (() => Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, "0")).join(""));
	const client = () => options.client();
	const pending = () => client()?.openBackup();
	const notify = (message, severity = "warning") => { if (!closed) options.status?.(message, severity); };
	const changed = () => { if (!closed) options.changed?.(); };
	const fail = message => ({ ok: false, message });
	// Refusals the server makes before recording anything: the open certainly didn't happen, so it
	// is closed through the ordinary Cancel route and its reason shown, not kept as unknown (Oliver, 9 Oct).
	const finalOpenRefusals = new Set(["too-large", "invalid-document"]);
	async function deliver(owner, record, operation, settings = {}) {
		const generation = options.generation();
		const current = () => !closed && client() === owner && generation > 0 && generation === options.generation() && pending()?.record === record;
		try {
			if (!current()) return fail("Reconnect the owning editor before checking this open request.");
			const result = await options.request({ ...record.request, operation, generation });
			if (!current()) return fail("The opening editor changed; its backup was kept.");
			if (!result?.ok && operation === "open" && finalOpenRefusals.has(result?.reason)) {
				await deliver(owner, record, "open-cancel", { quiet: true });
				notify(result.message || "That file can't be opened here. Current work was kept.");
				return fail(result.message || "The file was not opened.");
			}
			if (!result?.ok) throw Error(result?.message || "The file-open outcome is unknown. Keep the backup and recheck.");
			// Capture pre-debounce Prompt typing, or detect late affected DOM changes.
			options.capture?.();
			const applied = owner.finishOpen(result, () => current() && options.domCurrent(record));
			if (!applied.ok) throw Error(applied.message);
			if (result.status === "committed") options.replace?.(record.request.bufferId);
			if (applied.selectedChanged) options.bind();
			changed();
			if (!settings.quiet) notify(result.status === "cancelled" ? "File opening cancelled. Current work was kept."
				: result.status === "reused" ? "The file already has an editor. Current work was kept."
				: "Opened the file in its existing buffer. Other work was kept; nothing was sent.", "success");
			await owner.settled();
			// Failure to release a server receipt cannot undo verified local adoption.
			// Send no acknowledgements from an obsolete connection or disposed page.
			if (!closed && client() === owner && generation === options.generation()) {
				const proof = owner.hostingAuthority(record.request.bufferId);
				if (proof.ok) try {
					await options.request({ ...record.request, operation: "open-ack", generation,
						acknowledgedRevision: proof.expectedRevision, acknowledgedEpoch: proof.documentEpoch });
				} catch { /* The bounded server receipt remains retained. */ }
				if (!closed && client() === owner && generation === options.generation() && result.status === "reused") await options.reuse(record.request, result.owner);
			}
			return { ...applied, bufferId: record.request.bufferId };
		} catch (error) {
			if (current()) notify((error?.message || "File opening could not be checked.") + " Keep this tab; use Recheck file opening or Cancel pending opening.");
			return fail(error?.message || "Unknown file-open outcome.");
		} finally { changed(); }
	}
	function tracked(run, key) {
		flightKey = key;
		flight = Promise.resolve().then(run).finally(() => { flight = null; flightKey = null; changed(); });
		changed(); return flight;
	}
	return Object.freeze({
		open(input, isCurrent = () => true) {
			if (closed) return Promise.resolve(fail("This editor is closed."));
			const key = JSON.stringify(input);
			if (flight) return key === flightKey ? flight : Promise.resolve(fail("Resolve the current opening first."));
			if (pending()?.record || pending()?.error || options.busy?.()) return Promise.resolve(fail("Resolve the retained Document operation first."));
			const owner = client(), generation = options.generation();
			return tracked(async () => {
				try {
					await options.prepare(input.bufferId, isCurrent);
					if (closed || client() !== owner || generation !== options.generation() || !isCurrent()) return fail("The editor changed before opening. Current work was kept.");
					const proof = owner.hostingAuthority(input.bufferId); if (!proof.ok) throw Error(proof.message);
					const request = { operationId: nonce(), bufferId: input.bufferId, expectedRevision: proof.expectedRevision, documentEpoch: proof.documentEpoch,
						path: input.path, sourcePath: input.sourcePath || "", resourceDir: input.resourceDir || "", discardTarget: true };
					const begun = owner.beginOpen(request); if (!begun.ok) throw Error(begun.message);
					changed(); return await deliver(owner, pending().record, "open");
				} catch (error) { notify(error.message); return fail(error.message); }
			}, key);
		},
		recheck() {
			if (flight) return flight;
			const owner = client(), record = pending()?.record;
			if (closed || !record) return Promise.resolve(fail("No retained file opening to check."));
			return tracked(() => deliver(owner, record, "open"), null);
		},
		cancel() {
			if (cancelFlight) return cancelFlight;
			const owner = client(), record = pending()?.record;
			if (closed || !record) return Promise.resolve(fail("No retained file opening to cancel."));
			cancelFlight = deliver(owner, record, "open-cancel").finally(() => { cancelFlight = null; changed(); });
			return cancelFlight;
		},
		active: () => Boolean(flight || cancelFlight || pending()?.record || pending()?.error),
		state: () => ({ ...pending(), busy: Boolean(flight), cancelling: Boolean(cancelFlight) }),
		dispose() { closed = true; },
	});
}

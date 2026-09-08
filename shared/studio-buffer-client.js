import { createStudioBuffer, createStudioBufferStore, validateStudioBufferWorkspace } from "./studio-buffer-store.js";
import { createStudioBufferRecoveryStorage, migrateStudioWorkspaceV1 } from "./studio-buffer-recovery.js";

const fail = (reason, message) => ({ ok: false, reason, message });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function projectStudioBufferEditor(state) {
	const b = state.buffers.find((entry) => entry.id === state.selectedBufferId);
	return { version: 1, savedAt: state.savedAt, sourceState: b.sourceState, diskRevision: b.diskRevision,
		resourceDir: b.resourceDir, text: b.text, editorView: b.view.editorView, rightView: b.view.rightView,
		editorLanguage: b.view.editorLanguage, followLatest: b.view.followLatest, responseHistoryIndex: b.view.responseHistoryIndex,
		selectionStart: b.view.selectionStart, selectionEnd: b.view.selectionEnd, scrollTop: b.view.scrollTop };
}
export function isStudioSingleEditorBufferState(state) {
	// Until tabs exist, never adopt a collection whose other valuable buffers would be unreachable.
	const hidden = state.buffers.filter((b) => b.id !== state.selectedBufferId);
	return hidden.length === 0 || (hidden.length === 1 && hidden[0].id === state.activePromptId
		&& hidden[0].role === "prompt" && hidden[0].text === "" && hidden[0].baselineText === ""
		&& hidden[0].sourceState.path === null && hidden[0].sourceState.source === "blank"
		&& hidden[0].metadata.reviewNotesKey === null && hidden[0].metadata.scratchpadKey === null);
}

// Transitional single-editor adapter. This does not select/submit a hidden Prompt,
// park drafts, change roles when a file path changes, or alter browser tab navigation.
export function createStudioBufferClient(options) {
	const { workspaceId, mode, storage, makeBufferId, canRestore, readRemote, writeRemote, readLegacyRemote } = options;
	const expected = { workspaceId, mode };
	const now = options.now ?? Date.now;
	const expiry = (result, startedAt) => Number.isSafeInteger(result.expiresInMs) && result.expiresInMs > 0
		? startedAt + Math.min(result.expiresInMs, 24 * 60 * 60 * 1000) : 0;
	const local = createStudioBufferRecoveryStorage({ storage, ...expected });
	const ackKey = local.key + ":serverAck";
	let store = null, localRaw = null, localEnabled = true, localBlocked = false;
	let remoteRevision = null, remoteEnabled = true, remoteBlocked = false;
	let queued = null, draining = null, disposed = false, initialized = false, recoveryEpoch = 0;
	let lastRemoteSnapshot = null, lastRemoteExpiresAt = 0, unrepresentedEditor = false;
	const issues = new Map();
	function issue(channel, result) {
		if (result) issues.set(channel, result.message || "Recovery is unavailable."); else issues.delete(channel);
		options.onIssue?.([...issues.values()].join(" "));
	}
	function ack() {
		try {
			const value = JSON.parse(storage.getItem(ackKey) || "null");
			return value?.version === 1 && /^[a-f0-9]{48}$/.test(value.remoteRevision)
				&& Number.isSafeInteger(value.workspaceRevision) ? value : null;
		} catch { return null; }
	}
	function rememberAck(revision, workspaceRevision) {
		// Do not attach a new ancestry marker to browser data we could not read.
		if (!localEnabled) return;
		try {
			storage.setItem(ackKey, JSON.stringify({ version: 1, remoteRevision: revision, workspaceRevision }));
			issue("ack", null);
		} catch { issue("ack", fail("storage-unavailable", "Server recovery was acknowledged, but its browser checkpoint could not be stored.")); }
	}
	function validate(state, checkCompatibility = true) {
		const checked = validateStudioBufferWorkspace(state, expected);
		if (!checked.ok) return checked;
		if (checkCompatibility && !isStudioSingleEditorBufferState(checked.state)) return fail("unsupported-collection", "Recovery contains other buffers that this single-editor build cannot display. They were retained; use a compatible build or copy them before starting fresh.");
		if (checkCompatibility && !canRestore(projectStudioBufferEditor(checked.state))) return fail("wrong-document", "Recovery belongs to another document. It was retained; open a fresh browser tab for this document.");
		return checked;
	}
	function saveLocal(state) {
		if (!localEnabled || localBlocked) return;
		const result = local.write(state, { expectedRaw: localRaw });
		if (result.ok) { localRaw = result.raw; issue("local", null); }
		else {
			if (!["storage-write-failed", "storage-unverified"].includes(result.reason)) localBlocked = true;
			issue("local", result);
		}
		return result;
	}
	async function drain() {
		while (queued && remoteEnabled && !remoteBlocked && !disposed) {
			const state = queued; queued = null;
			let result;
			const requestStartedAt = now();
			const operationEpoch = recoveryEpoch;
			try { result = await writeRemote(state, remoteRevision); }
			catch { result = fail("unavailable", "Server recovery could not be acknowledged. Browser recovery is retained; reload before retrying the server."); }
			if (disposed || operationEpoch !== recoveryEpoch) break;
			if (!result.ok || result.workspaceRevision !== state.revision || typeof result.revision !== "string" || !/^[a-f0-9]{48}$/.test(result.revision)) {
				remoteBlocked = true;
				lastRemoteSnapshot = null;
				issue("remote", result.ok ? fail("invalid-ack", "Server recovery acknowledgement did not match this snapshot.") : result);
				break;
			}
			remoteRevision = result.revision;
			lastRemoteSnapshot = state;
			lastRemoteExpiresAt = expiry(result, requestStartedAt);
			rememberAck(remoteRevision, state.revision);
			issue("remote", null);
		}
	}
	function publish(state) {
		if (!remoteEnabled || remoteBlocked || disposed) return;
		queued = state;
		if (!draining) draining = drain().finally(() => { draining = null; if (queued && !remoteBlocked && !disposed) publish(queued); });
	}
	function capture(editor, baselineText, extra = {}) {
		if (disposed) return fail("disposed", "This recovery owner has closed.");
		if (!store) return fail("not-ready", "Buffer recovery is not initialized.");
		unrepresentedEditor = true;
		const state = store.snapshot(), current = store.get(state.selectedBufferId);
		let next;
		try {
			next = createStudioBuffer({ ...current, text: editor.text, sourceState: editor.sourceState,
				baselineText: editor.sourceState.path ? baselineText : (current.sourceState.path ? null : current.baselineText),
				diskRevision: editor.diskRevision, resourceDir: editor.resourceDir,
				view: { ...current.view, editorView: editor.editorView, rightView: editor.rightView, editorLanguage: editor.editorLanguage,
					followLatest: editor.followLatest, responseHistoryIndex: editor.responseHistoryIndex,
					selectionStart: editor.selectionStart, selectionEnd: editor.selectionEnd, scrollTop: editor.scrollTop,
					...extra.view }, metadata: { ...current.metadata, ...extra.metadata } });
		} catch (error) { return fail(error.reason || "invalid-state", error.message); }
		if (current.text === next.text && current.baselineText === next.baselineText && current.diskRevision === next.diskRevision
			&& current.resourceDir === next.resourceDir && same(current.sourceState, next.sourceState)
			&& same(current.view, next.view) && same(current.metadata, next.metadata)) { unrepresentedEditor = false; return { ok: true }; }
		const { id, role, revision, ...patch } = next;
		const result = store.update(current.id, current.revision, patch);
		unrepresentedEditor = !result.ok;
		return result;
	}
	return Object.freeze({
		async initialize(initialEditor, baselineText, isStillCurrent = () => true) {
			if (disposed || initialized) return fail("invalid-lifecycle", "Create a new recovery owner before initializing again.");
			initialized = true;
			const browser = local.read();
			if (!browser.ok && browser.reason !== "storage-unavailable") return browser;
			if (!browser.ok) { localEnabled = false; issue("local", browser); }
			let remote, legacyRemote;
			const remoteReadStartedAt = now();
			try { remote = await readRemote(); } catch { remote = fail("unavailable", "Server recovery could not be read; server writes are paused until reload."); }
			if (!remote.ok && remote.reason !== "unavailable") return remote;
			if (!remote.ok) { remoteEnabled = false; issue("remote", remote); }
			else remoteRevision = remote.revision;
			try { legacyRemote = await readLegacyRemote(); } catch { legacyRemote = fail("unavailable", "Legacy server recovery could not be checked."); }
			if (!legacyRemote.ok) {
				if (legacyRemote.reason !== "unavailable") return legacyRemote;
				remoteEnabled = false; issue("remote", legacyRemote); legacyRemote = { ok: true, state: null };
			}
			if (!remoteEnabled && !localEnabled) return fail("unavailable", "Neither browser nor server recovery could be read. Nothing was replaced.");
			if (disposed || !isStillCurrent()) return fail("editor-changed", "The editor changed while recovery was loading. Current text and recovery were kept; save or copy before reloading.");
			let localState = null, remoteState = null;
			if (browser.ok && browser.status === "found") { const checked = validate(browser.state, false); if (!checked.ok) return checked; localState = checked.state; localRaw = browser.raw; }
			if (remote.ok && remote.state) { const checked = validate(remote.state, false); if (!checked.ok) return checked; remoteState = checked.state; }
			let chosen = localState || remoteState, fromInitial = false;
			if (localState && remoteState && !same(localState, remoteState)) {
				const checkpoint = ack();
				if (checkpoint?.remoteRevision !== remoteRevision) return fail("diverged", "Browser and server recovery differ without a matching acknowledgement. Both were retained; copy the needed text before starting a fresh tab.");
				if (localState.revision > checkpoint.workspaceRevision) chosen = localState;
				else if (remoteState.revision === checkpoint.workspaceRevision && localState.revision < checkpoint.workspaceRevision) chosen = remoteState;
				else return fail("diverged", "Browser and server recovery disagree at the same revision. Both were retained.");
			}
			const legacy = [];
			if (browser.ok && browser.legacyRaw !== null && browser.legacyRaw !== undefined) {
				try { legacy.push(JSON.parse(browser.legacyRaw)); } catch { return fail("invalid-json", "Legacy browser recovery is malformed; it was retained."); }
			}
			if (legacyRemote.state) legacy.push(legacyRemote.state);
			if (!chosen && legacy.length === 0 && localEnabled) {
				try {
					const raw = storage.getItem("piStudio.workspaceState.v1");
					if (raw) return fail("unscoped-legacy", "Older recovery without a tab identity exists. It was retained; recover/copy it with the previous build before starting a fresh test profile.");
				} catch { return fail("storage-unavailable", "Older browser recovery could not be checked."); }
			}
			for (const value of legacy) {
				const migrated = migrateStudioWorkspaceV1(value, { ...expected, makeBufferId });
				if (!migrated.ok) return migrated;
				if (localState || remoteState) {
					if (migrated.state.savedAt > chosen.savedAt) return fail("legacy-newer", "Newer single-editor recovery exists; it was retained for an explicit decision.");
					// Older retained v1 may describe the draft before Save As. Its old source
					// must not veto newer, validated v2 that matches this URL.
					continue;
				}
				if (!chosen || migrated.state.savedAt > chosen.savedAt) chosen = migrated.state;
				else if (migrated.state.savedAt === chosen.savedAt && !same(projectStudioBufferEditor(migrated.state), projectStudioBufferEditor(chosen))) {
					return fail("legacy-diverged", "Legacy browser and server recovery disagree at the same timestamp. Both were retained.");
				}
			}
			if (!chosen) {
				const migrated = migrateStudioWorkspaceV1(initialEditor, { ...expected, makeBufferId });
				if (!migrated.ok) return migrated;
				chosen = migrated.state; fromInitial = true;
			}
			const checked = validate(chosen); if (!checked.ok) return checked;
			store = createStudioBufferStore(checked.state);
			if (fromInitial && initialEditor.sourceState.path) {
				const result = capture(initialEditor, baselineText); if (!result.ok) { store = null; return result; }
			}
			const state = store.snapshot();
			if (localEnabled) {
				const written = localState ? saveLocal(state) : local.adopt(state, { expectedLegacyRaw: browser.ok ? browser.legacyRaw : null });
				if (written?.ok) { localRaw = written.raw; }
				else if (written) {
					issue("local", written);
					if (written.reason !== "storage-write-failed") { store = null; return written; }
					localBlocked = true; // Native storage quota/permission failures leave the old value intact.
				}
			}
			if (!remoteState || !same(remoteState, state)) publish(state);
			else { lastRemoteSnapshot = state; lastRemoteExpiresAt = expiry(remote, remoteReadStartedAt); rememberAck(remoteRevision, state.revision); }
			const selected = store.get(state.selectedBufferId);
			return { ok: true, restored: !fromInitial, editor: projectStudioBufferEditor(state), baselineText: selected.baselineText };
		},
		capture,
		persist(editor, baselineText, extra) {
			const result = capture(editor, baselineText, extra);
			if (!result.ok) { issue("capture", result); return result; }
			issue("capture", null);
			saveLocal(store.snapshot()); publish(store.snapshot());
			return { ok: true };
		},
		async retry(isStillCurrent = () => true) {
			if (disposed || !store || unrepresentedEditor) return fail("not-ready", "Choose a recovery copy or export current text before retrying.");
			// Suspend the old upload epoch before reading. Never treat a retry as
			// permission to adopt stored text over the live editor or a newer branch.
			recoveryEpoch++; const epoch = recoveryEpoch;
			remoteBlocked = true; queued = null; lastRemoteSnapshot = null;
			if (draining) await draining;
			const state = store.snapshot();
			let remote;
			try { remote = await readRemote(); } catch { remote = fail("unavailable", "Server recovery is still unavailable. Current text was kept."); }
			if (disposed || epoch !== recoveryEpoch || !isStillCurrent() || store.snapshot() !== state) return fail("editor-changed", "Editor or connection changed during retry. Nothing was replaced.");
			if (!remote.ok) { issue("remote", remote); return remote; }
			if (remote.state) { const checked = validate(remote.state, false); if (!checked.ok) return checked; }
			if (remote.state && remote.revision !== remoteRevision && !same(remote.state, state)) {
				const result = fail("conflict", "Server recovery changed. Inspect the copies before choosing a fresh workspace."); issue("remote", result); return result;
			}
			const browser = local.read();
			if (!browser.ok) {
				issue("local", browser);
				if (browser.reason !== "storage-unavailable") return browser;
				localEnabled = false; // Server-only recovery is supported; never write unseen browser data/ancestry.
			} else {
				if ((browser.raw ?? null) !== localRaw) return fail("storage-changed", "Browser recovery changed. Inspect the copies before retrying.");
				const written = local.write(state, { expectedRaw: localRaw });
				if (!written.ok && written.reason !== "storage-write-failed") { issue("local", written); return written; }
				localEnabled = true; localBlocked = false;
				if (written.ok) { localRaw = written.raw; issue("local", null); } else issue("local", written);
			}
			if (disposed || epoch !== recoveryEpoch || !isStillCurrent() || store.snapshot() !== state) return fail("editor-changed", "Editor or connection changed during retry. Nothing was replaced.");
			remoteRevision = remote.revision; remoteEnabled = true; remoteBlocked = false;
			publish(state);
			if (draining) await draining;
			if (disposed || epoch !== recoveryEpoch || !isStillCurrent() || store.snapshot() !== state) return fail("editor-changed", "Editor or connection changed during retry. Current text was kept.");
			return lastRemoteSnapshot === state && now() < lastRemoteExpiresAt ? { ok: true } : fail("unacknowledged", "Recovery is not currently acknowledged. Save or export before closing.");
		},
		snapshot: () => store?.snapshot() ?? null,
		needsUnloadConfirmation() {
			// beforeunload cannot distinguish reload from tab closure. Session storage can
			// vanish on closure, so only a current, unexpired server acknowledgement allows
			// silent departure. Measure the TTL from request start, not receipt, to avoid
			// extending server lifetime by network latency. No durable-recovery claim.
			return disposed || !store || unrepresentedEditor || store.snapshot() !== lastRemoteSnapshot || now() >= lastRemoteExpiresAt;
		},
		invalidateRemoteRecovery() {
			recoveryEpoch++; lastRemoteSnapshot = null; remoteBlocked = true; queued = null;
			issue("remote", fail("connection-lost", "The Studio connection closed. Server recovery is paused; save or copy the text before reloading."));
		},
		async settled() { while (draining) await draining; },
		dispose() { disposed = true; queued = null; store?.clearPendingOperations(); },
	});
}

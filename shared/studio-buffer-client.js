import { STUDIO_BUFFER_LIMITS, createStudioBuffer, createStudioBufferStore, validateStudioBufferWorkspace } from "./studio-buffer-store.js";
import { createStudioBufferRecoveryStorage, migrateStudioWorkspaceV1 } from "./studio-buffer-recovery.js";
import { isStudioPromptDocumentBufferState, needsStudioLegacyPromptChoice, prepareStudioPromptDocumentWorkspace } from "./studio-buffer-switching.js";
import { reconcileStudioHostingLineage } from "./studio-buffer-lineage.js";
import { createStudioDocumentEscrow } from "./studio-document-escrow.js";
import { createStudioDocumentOpenStorage } from "./studio-document-open-storage.js";

const fail = (reason, message) => ({ ok: false, reason, message });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function literalStudioBufferLabel(source) {
	// Provenance is not a link or a resource/terminal grant. Separate boundary
	// backticks from delimiters; Markdown removes the paired padding.
	const name = source.sourceState.path?.split(/[/\\]/).at(-1) || source.sourceState.label || "Document";
	const label = JSON.stringify(name).slice(1, -1).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
	const ticks = "`".repeat(1 + Math.max(0, ...(label.match(/`+/g) || []).map(run => run.length)));
	const padding = label.startsWith("`") || label.endsWith("`") ? " " : "";
	return ticks + padding + label + padding + ticks;
}

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

// Single-editor adapter by default. The separate full-view switching opt-in binds
// two buffers to that surface; it never submits text or changes browser navigation.
export function createStudioBufferClient(options) {
	const { workspaceId, mode, storage, makeBufferId, canRestore, readRemote, writeRemote, readLegacyRemote } = options;
	const expected = { workspaceId, mode };
	const switching = options.switching === true && mode === "full";
	const now = options.now ?? Date.now;
	const expiry = (result, startedAt) => Number.isSafeInteger(result.expiresInMs) && result.expiresInMs > 0
		? startedAt + Math.min(result.expiresInMs, 24 * 60 * 60 * 1000) : 0;
	const local = createStudioBufferRecoveryStorage({ storage, ...expected });
	const ackKey = local.key + ":serverAck";
	const escrow = options.hosting === true ? createStudioDocumentEscrow(storage, local.key + ":handoff") : null;
	const opening = options.hosting === true ? createStudioDocumentOpenStorage(storage, local.key + ":open", expected) : null;
	let store = null, localRaw = null, localEnabled = true, localBlocked = false;
	let remoteRevision = null, remoteEnabled = true, remoteBlocked = false, documentEpochs = {}, pendingHostingSaves = [];
	const receiveAuthorities = result => {
		if (options.hosting !== true) return;
		documentEpochs = Object.fromEntries(Object.entries(result.documents || {}).filter(([, epoch]) => Number.isSafeInteger(epoch) && epoch > 0));
		if (Array.isArray(result.pendingSaves)) pendingHostingSaves = result.pendingSaves;
		issue("file-save", pendingHostingSaves.length ? fail("save-ack-pending", "A disk save needs a backing decision. Use Resolve disk save; current text and the disk output were kept.") : null);
		options.onHostingAuthority?.();
	};
	let queued = null, draining = null, disposed = false, initialized = false, recoveryEpoch = 0;
	let lastRemoteSnapshot = null, lastRemoteExpiresAt = 0, unrepresentedEditor = false, hostingFreeze = null;
	let hostingRecoveryUnverified = options.hosting === true, hostingUnrepresented = false;
	const frozen = () => fail("hosting-frozen", "This editor is waiting for a document move outcome. Current text was kept.");
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
		if (checkCompatibility && !(switching ? isStudioPromptDocumentBufferState(checked.state) : isStudioSingleEditorBufferState(checked.state))) return fail("unsupported-collection", switching
			? "This prototype displays one Prompt and one document. Other buffers were retained; export them or use a compatible build."
			: "Recovery contains other buffers that this single-editor build cannot display. They were retained; use a compatible build or copy them before starting fresh.");
		if (checkCompatibility && !canRestore(projectStudioBufferEditor(checked.state))) return fail("wrong-document", "Recovery belongs to another document. It was retained; open a fresh browser tab for this document.");
		return checked;
	}
	function saveLocal(state) {
		if (!localEnabled || localBlocked) return;
		const result = local.write(state, { expectedRaw: localRaw });
		if (result.ok) { localRaw = result.raw; hostingRecoveryUnverified = false; issue("local", null); }
		else {
			if (options.hosting === true) hostingRecoveryUnverified = true;
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
			try { result = await writeRemote(state, remoteRevision, documentEpochs); }
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
			receiveAuthorities(result);
			rememberAck(remoteRevision, state.revision);
			issue("remote", null);
		}
	}
	function publish(state) {
		if (!remoteEnabled || remoteBlocked || disposed || hostingFreeze) return;
		queued = state;
		if (!draining) draining = drain().finally(() => { draining = null; if (queued && !remoteBlocked && !disposed) publish(queued); });
	}
	function capture(editor, baselineText, extra = {}) {
		if (disposed) return fail("disposed", "This recovery owner has closed.");
		if (hostingUnrepresented) return frozen();
		if (hostingFreeze && store.snapshot().selectedBufferId === hostingFreeze.bufferId) {
			const current = store.get(store.snapshot().selectedBufferId);
			// Selecting/copying read-only text is harmless. A late producer changing
			// content or metadata is not: never apply a move over that unseen work.
			if (editor.text !== current.text || !same(editor.sourceState, current.sourceState) || editor.diskRevision !== current.diskRevision
				|| editor.resourceDir !== current.resourceDir || (current.sourceState.path && baselineText !== current.baselineText)
				|| !same({ ...current.metadata, ...extra.metadata }, current.metadata)) unrepresentedEditor = hostingUnrepresented = true;
			return frozen();
		}
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
	function documentAppendPlan() {
		if (hostingFreeze) return frozen();
		if (!switching) return fail("switching-disabled", "Internal document copying is not enabled in this view.");
		if (disposed || !store || unrepresentedEditor) return fail("not-ready", "Keep the current editor visible until it can be represented safely in recovery.");
		const state = store.snapshot(), source = store.get(state.selectedBufferId), prompt = store.get(state.activePromptId);
		if (source?.role !== "document" || prompt?.role !== "prompt") return fail("wrong-buffer", "Select Document to add its full editor text to Prompt.");
		if (source.view.editorView !== "markdown") return fail("wrong-view", "Switch Document to Editor to add its source text. Preview content is not copied.");
		if (!source.text.length) return fail("empty-document", "Document is empty. Nothing to add.");
		const separator = prompt.text ? "\n\n" : "", header = "From " + literalStudioBufferLabel(source) + " (whole document):\n\n";
		const addedCharacters = separator.length + header.length + source.text.length;
		const total = state.buffers.reduce((sum, b) => sum + b.text.length + (b.baselineText?.length || 0), 0);
		const availableCharacters = Math.min(STUDIO_BUFFER_LIMITS.textChars - prompt.text.length, STUDIO_BUFFER_LIMITS.totalTextChars - total);
		const size = { characters: source.text.length, addedCharacters, availableCharacters };
		if (addedCharacters > availableCharacters) return { ...size, ...fail("limit-exceeded", "The full document and label exceed the remaining capacity. Nothing was added or truncated.") };
		return { ok: true, ...size, source, prompt, separator, header };
	}
	return Object.freeze({
		async initialize(initialEditor, baselineText, isStillCurrent = () => true) {
			if (disposed || initialized) return fail("invalid-lifecycle", "Create a new recovery owner before initializing again.");
			initialized = true;
			const openBackup = opening?.peek(); if (openBackup?.error) return openBackup.error;
			const browser = local.read();
			if (!browser.ok && browser.reason !== "storage-unavailable") return browser;
			if (!browser.ok) { localEnabled = false; issue("local", browser); }
			let remote, legacyRemote;
			const remoteReadStartedAt = now();
			try { remote = await readRemote(); } catch { remote = fail("unavailable", "Server recovery could not be read; server writes are paused until reload."); }
			if (!remote.ok && remote.reason !== "unavailable") return remote;
			if (!remote.ok) { remoteEnabled = false; issue("remote", remote); }
			else { remoteRevision = remote.revision; receiveAuthorities(remote); }
			if (options.hosting === true && remote.pendingMoves?.some(move => move.sourceWorkspaceId === workspaceId)) {
				return fail("move-pending", "Resolve the source's pending move before enabling editing. Browser recovery was retained.");
			}
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
				if (checkpoint?.remoteRevision !== remoteRevision) {
					const reconciled = options.hosting === true ? await reconcileStudioHostingLineage({ local: localState, remote: remoteState,
						revision: remoteRevision, checkpoint, lineage: remote.lineage, now }) : null;
					if (!reconciled) return fail("diverged", "Browser and server recovery differ without proven move ancestry. Both were retained; inspect the copies before replacing either.");
					chosen = reconciled.state;
				} else if (localState.revision > checkpoint.workspaceRevision) chosen = localState;
				else if (remoteState.revision === checkpoint.workspaceRevision && localState.revision < checkpoint.workspaceRevision) chosen = remoteState;
				else return fail("diverged", "Browser and server recovery disagree at the same revision. Both were retained.");
			}
			if (escrow && localState && chosen) {
				const removed = localState.buffers.find(b => b.role === "document" && !chosen.buffers.some(n => n.id === b.id));
				if (removed && (removed.text || removed.sourceState.path || removed.metadata.reviewNotesKey || removed.metadata.scratchpadKey)) {
					const receipt = remote.lineage?.find(r => r.slot?.beforeId === removed.id && r.move?.moveId);
					if (!receipt) return fail("diverged", "The removed document has no verified transfer receipt. Both copies were kept.");
					const kept = escrow.capture(receipt.move.moveId, removed); if (!kept.ok) return kept;
				}
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
			let checked = validate(chosen); if (!checked.ok) return checked;
			if (switching) {
				let roleChoice = !localState && !remoteState ? "visible-prompt" : undefined;
				if ((localState || remoteState) && needsStudioLegacyPromptChoice(checked.state)) {
					if (typeof options.decideLegacyPromptRole !== "function") return fail("role-decision-required", "Choose whether the recovered file is the Prompt or a separate document. No roles or text were changed.");
					roleChoice = await options.decideLegacyPromptRole(checked.state);
					if (!["visible-prompt", "keep-roles"].includes(roleChoice)) return fail("role-decision-cancelled", "Recovery role choice cancelled. Existing text and copies were kept.");
				}
				checked = prepareStudioPromptDocumentWorkspace(checked.state, { makeBufferId, roleChoice, now });
				if (!checked.ok) return checked;
			}
			if (disposed || !isStillCurrent()) return fail("editor-changed", "The editor changed while recovery was loading. Current text and recovery were kept; save or copy before reloading.");
			store = createStudioBufferStore(checked.state);
			if (openBackup?.record) hostingFreeze = { kind: "open", bufferId: openBackup.record.request.bufferId, startedAt: remoteReadStartedAt };
			if (fromInitial && initialEditor.sourceState.path) {
				const result = capture(initialEditor, baselineText); if (!result.ok) { store = null; return result; }
			}
			const state = store.snapshot();
			if (localEnabled) {
				const written = localState ? saveLocal(state) : local.adopt(state, { expectedLegacyRaw: browser.ok ? browser.legacyRaw : null });
				if (written?.ok) { localRaw = written.raw; hostingRecoveryUnverified = false; }
				else if (written) {
					issue("local", written);
					if (written.reason !== "storage-write-failed") { store = null; return written; }
					localBlocked = true; // Native storage quota/permission failures leave the old value intact.
				}
			}
			if (!remoteState || !same(remoteState, state)) publish(state);
			else { lastRemoteSnapshot = state; lastRemoteExpiresAt = expiry(remote, remoteReadStartedAt); rememberAck(remoteRevision, state.revision); }
			const backup = escrow?.peek().record;
			if (backup && !hostingRecoveryUnverified && remoteState) {
				const owned = remoteState.buffers.find(b => b.id === backup.document.id);
				if (owned && same(owned, store.get(owned.id))) escrow.resolve(backup.moveId);
			}
			const selected = store.get(state.selectedBufferId);
			return { ok: true, restored: !fromInitial, editor: projectStudioBufferEditor(state), baselineText: selected.baselineText };
		},
		capture,
		select(id) {
			if (hostingFreeze) return frozen();
			if (!switching) return fail("switching-disabled", "Internal switching is not enabled in this view.");
			if (disposed || !store || unrepresentedEditor) return fail("not-ready", "Keep the current editor visible until it can be represented safely in recovery.");
			const result = store.select(id);
			if (result.ok) { saveLocal(store.snapshot()); publish(store.snapshot()); }
			return result;
		},
		replace(id, expectedRevision, editor, baselineText, extra = {}) {
			if (hostingFreeze && id === hostingFreeze.bufferId) return frozen();
			if (!switching && !(options.hosting === true && mode === "editor-only")) return fail("switching-disabled", "Internal switching is not enabled in this view.");
			if (disposed || !store || unrepresentedEditor) return fail("not-ready", "Keep the current editor visible until it can be represented safely in recovery.");
			const current = store.get(id);
			if (!current || current.revision !== expectedRevision) return fail("stale-buffer", "The destination changed. Both buffers were kept; retry explicitly.");
			let next;
			try {
				next = createStudioBuffer({ ...current, text: editor.text, sourceState: editor.sourceState,
					baselineText: editor.sourceState.path ? baselineText : "", diskRevision: editor.diskRevision, resourceDir: editor.resourceDir,
					view: { ...current.view, editorView: editor.editorView, rightView: editor.rightView, editorLanguage: editor.editorLanguage,
						followLatest: editor.followLatest, responseHistoryIndex: editor.responseHistoryIndex,
						selectionStart: editor.selectionStart, selectionEnd: editor.selectionEnd, selectionDirection: "none", scrollTop: editor.scrollTop,
						previewScrollTop: 0, rightScrollTop: 0, ...extra.view },
					metadata: { annotationsEnabled: null, reviewNotesKey: null, scratchpadKey: null, ...extra.metadata } });
			} catch (error) { return fail(error.reason || "invalid-state", error.message); }
			const { id: nextId, role, revision, ...patch } = next;
			const result = store.update(id, expectedRevision, patch);
			if (result.ok) { saveLocal(store.snapshot()); publish(store.snapshot()); }
			return result;
		},
		appendSelectionToPrompt({ sourceId, sourceRevision, promptId, promptRevision, start, end } = {}) {
			if (hostingFreeze) return frozen();
			if (!switching) return fail("switching-disabled", "Internal selection copying is not enabled in this view.");
			if (disposed || !store || unrepresentedEditor) return fail("not-ready", "Keep the current editor visible until it can be represented safely in recovery.");
			const state = store.snapshot(), source = store.get(sourceId), prompt = store.get(promptId);
			if (state.selectedBufferId !== sourceId || source?.role !== "document" || source.revision !== sourceRevision
				|| state.activePromptId !== promptId || prompt?.role !== "prompt" || prompt.revision !== promptRevision) {
				return fail("stale-buffer", "The Document or Prompt changed. Nothing was added; select and retry explicitly.");
			}
			if (source.view.editorView !== "markdown" || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)
				|| start < 0 || end <= start || end > source.text.length || start !== source.view.selectionStart || end !== source.view.selectionEnd) {
				return fail("invalid-selection", "Select text in the Document editor. Hidden or stale selections were not copied.");
			}
			const literalLabel = literalStudioBufferLabel(source);
			const lineAt = offset => {
				let line = 1;
				for (const match of source.text.matchAll(/\r\n|\r|\n/g)) { if (match.index + match[0].length > offset) break; line++; }
				return line;
			};
			const first = lineAt(start), last = lineAt(end - 1);
			const header = "From " + literalLabel + " (" + (first === last ? "line " + first : "lines " + first + "–" + last) + "):\n\n";
			const selection = source.text.slice(start, end);
			// Text-only update: never use replace(), select(), copy source metadata,
			// move views/carets or confer a submitted/terminal-cleanup baseline.
			const result = store.update(promptId, promptRevision, { text: prompt.text + (prompt.text ? "\n\n" : "") + header + selection });
			if (!result.ok) return result; // Strict per-buffer/aggregate bounds; no partial insertion.
			saveLocal(store.snapshot()); publish(store.snapshot());
			return { ok: true, characters: selection.length };
		},
		documentAppendInfo() {
			// Read-only size/eligibility check; never capture or expose source text.
			const { source, prompt, separator, header, ...info } = documentAppendPlan();
			return info;
		},
		appendDocumentToPrompt(intent) {
			const plan = documentAppendPlan();
			if (!plan.ok) return plan;
			const { source, prompt, separator, header } = plan;
			if (!intent || intent.sourceId !== source.id || intent.sourceRevision !== source.revision
				|| intent.promptId !== prompt.id || intent.promptRevision !== prompt.revision) {
				return fail("stale-buffer", "The Document or Prompt changed. Nothing was added; retry explicitly.");
			}
			// Separate from selection copying: no temporary range, disk read,
			// source metadata adoption, binding or submission. Store bounds recheck
			// the complete resulting workspace before its single text-only update.
			const result = store.update(prompt.id, prompt.revision, { text: prompt.text + separator + header + source.text });
			if (!result.ok) return result;
			saveLocal(store.snapshot()); publish(store.snapshot());
			return { ok: true, characters: plan.characters, addedCharacters: plan.addedCharacters };
		},
		persist(editor, baselineText, extra) {
			const result = capture(editor, baselineText, extra);
			if (!result.ok) { if (result.reason !== "hosting-frozen") issue("capture", result); return result; }
			issue("capture", null);
			saveLocal(store.snapshot()); publish(store.snapshot());
			return { ok: true };
		},
		async retry(isStillCurrent = () => true) {
			if (hostingFreeze) return frozen();
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
				if (written.ok) { localRaw = written.raw; hostingRecoveryUnverified = false; issue("local", null); } else issue("local", written);
			}
			if (disposed || epoch !== recoveryEpoch || !isStillCurrent() || store.snapshot() !== state) return fail("editor-changed", "Editor or connection changed during retry. Nothing was replaced.");
			remoteRevision = remote.revision; remoteEnabled = true; remoteBlocked = false; receiveAuthorities(remote);
			publish(state);
			if (draining) await draining;
			if (disposed || epoch !== recoveryEpoch || !isStillCurrent() || store.snapshot() !== state) return fail("editor-changed", "Editor or connection changed during retry. Current text was kept.");
			return lastRemoteSnapshot === state && now() < lastRemoteExpiresAt ? { ok: true } : fail("unacknowledged", "Recovery is not currently acknowledged. Save or export before closing.");
		},
		freezeHosting({ moveId, direction, bufferId }) {
			if (options.hosting !== true) return fail("hosting-disabled", "Document hosting is not enabled in this view.");
			if (hostingFreeze) return frozen();
			if (disposed || !store || unrepresentedEditor || draining || queued || remoteBlocked || store.snapshot() !== lastRemoteSnapshot || now() >= lastRemoteExpiresAt) {
				return fail("unacknowledged", "Checkpoint the current editor before moving a document.");
			}
			if (localEnabled) {
				const browser = local.read();
				if (!browser.ok) return browser;
				if ((browser.raw ?? null) !== localRaw) return fail("storage-changed", "Browser recovery changed. Inspect the copies before moving.");
			}
			const state = store.snapshot(), entry = store.get(bufferId);
			if (typeof moveId !== "string" || !/^[a-f0-9]{48}$/.test(moveId) || !["incoming", "outgoing"].includes(direction)
				|| entry?.role !== "document" || (direction === "outgoing" && state.selectedBufferId !== bufferId)) return fail("invalid-move", "Choose the originating Document or destination Document slot.");
			if (direction === "outgoing") { const kept = escrow.capture(moveId, entry); if (!kept.ok) return kept; }
			hostingUnrepresented = false;
			hostingFreeze = Object.freeze({ moveId, direction, bufferId, state, expectedRevision: remoteRevision, startedAt: now() });
			return { ok: true, proof: hostingFreeze };
		},
		finishHosting(proof, result, isStillCurrent = () => true) {
			if (!hostingFreeze || proof !== hostingFreeze || disposed || unrepresentedEditor || hostingUnrepresented || !isStillCurrent()
				|| !same(store.get(proof.bufferId), proof.state.buffers.find(b => b.id === proof.bufferId))
				|| store.snapshot().selectedBufferId !== proof.state.selectedBufferId || !same(store.snapshot().order, proof.state.order)) {
				return fail("editor-changed", "The editor changed during the move. Keep all copies; nothing was replaced locally.");
			}
			if (!result?.ok || result.moveId !== proof.moveId || !["committed", "cancelled"].includes(result.status)
				|| (result.intentRevision !== undefined && result.intentRevision !== proof.expectedRevision)
				|| (proof.direction === "outgoing" && result.sourceWorkspaceId !== workspaceId)
				|| (result.status === "committed" && proof.direction === "incoming" && result.targetWorkspaceId !== workspaceId)
				|| typeof result.revision !== "string" || !/^[a-f0-9]{48}$/.test(result.revision)) {
				return fail("unknown-outcome", "A matching server move outcome is required before this editor can resume.");
			}
			if (result.status === "committed" && (result.sourceWorkspaceId === result.targetWorkspaceId
				|| typeof result.targetWorkspaceId !== "string" || !/^[a-zA-Z0-9_-]{20,128}$/.test(result.targetWorkspaceId))) return fail("unknown-outcome", "The new editing location was not identified.");
			const checked = validate(result.state, false); if (!checked.ok) return checked;
			const next = checked.state, before = proof.state;
			if (!(switching ? isStudioPromptDocumentBufferState(next) : isStudioSingleEditorBufferState(next))) return fail("unsupported-collection", "The moved workspace cannot be displayed safely here.");
			if (result.status === "cancelled") {
				if (next.revision < before.revision || next.savedAt < before.savedAt
					|| !same({ ...next, revision: before.revision, savedAt: before.savedAt }, before)) return fail("editor-changed", "The server workspace changed while cancelling. Both copies were retained.");
			} else {
				const oldDoc = before.buffers.find(b => b.id === proof.bufferId), newDoc = next.buffers.find(b => b.role === "document");
				const unchanged = before.buffers.filter(b => b.id !== oldDoc.id);
				if (next.revision !== before.revision + 1 || next.savedAt < before.savedAt || next.buffers.length !== before.buffers.length
					|| next.activePromptId !== before.activePromptId || !unchanged.every(b => same(b, next.buffers.find(n => n.id === b.id)))
					|| !newDoc || next.selectedBufferId !== (before.selectedBufferId === oldDoc.id ? newDoc.id : before.selectedBufferId)
					|| !same(next.order, before.order.map(id => id === oldDoc.id ? newDoc.id : id))) return fail("invalid-transition", "Move changed unrelated workspace state. Nothing was replaced locally.");
				if (proof.direction === "outgoing") {
					if (result.bufferId !== oldDoc.id || newDoc.id === oldDoc.id || newDoc.text || newDoc.baselineText !== "" || newDoc.sourceState.path
						|| newDoc.metadata.reviewNotesKey || newDoc.metadata.scratchpadKey) return fail("invalid-transition", "The source was not replaced with a fresh empty Document.");
				} else if (newDoc.id !== result.bufferId) return fail("invalid-transition", "The destination does not contain the moved document.");
			}
			// Never overwrite an independently changed browser copy. Native quota
			// failure can fall back to the authenticated server checkpoint instead.
			if (localEnabled) {
				const browser = local.read();
				if (!browser.ok) return browser;
				if ((browser.raw ?? null) !== localRaw) return fail("storage-changed", "Browser recovery changed during the move. Both copies were retained.");
			}
			const current = store.snapshot(), rebased = !same(current, before);
			const adopted = rebased ? { ...next, buffers: next.buffers.map(b => b.id === next.buffers.find(n => n.role === "document").id ? b : store.get(b.id)),
				revision: Math.max(current.revision, next.revision) + 1, savedAt: Math.max(current.savedAt, next.savedAt, now()) + 1 } : next;
			const merged = validate(adopted, false); if (!merged.ok) return merged;
			const written = saveLocal(merged.state);
			if (written && !written.ok && !["storage-write-failed", "storage-unverified"].includes(written.reason)) return written;
			hostingRecoveryUnverified = written?.ok !== true;
			store = createStudioBufferStore(merged.state); recoveryEpoch++; queued = null;
			remoteRevision = result.revision; remoteEnabled = true; remoteBlocked = Boolean(result.checkpointError);
			lastRemoteSnapshot = remoteBlocked ? null : rebased ? next : store.snapshot(); lastRemoteExpiresAt = remoteBlocked ? 0 : expiry(result, proof.startedAt);
			receiveAuthorities(result);
			if (written?.ok && !remoteBlocked) rememberAck(remoteRevision, next.revision);
			hostingFreeze = null; issue("remote", remoteBlocked ? fail("conflict", result.checkpointError) : null); issue("capture", null);
			if (result.status === "cancelled" && proof.direction === "outgoing") escrow.resolve(proof.moveId);
			if (result.status === "committed" && proof.direction === "incoming" && written?.ok) {
				const old = escrow.peek().record;
				if (old?.document.id === result.bufferId) escrow.resolve(old.moveId); // Moving back restored the original backup's owner here.
			}
			escrow.retry();
			if (rebased) publish(store.snapshot());
			return { ok: true, editor: projectStudioBufferEditor(store.snapshot()), baselineText: store.get(store.snapshot().selectedBufferId).baselineText,
				selectedChanged: before.selectedBufferId === proof.bufferId, localPersisted: written?.ok === true, status: result.status };
		},
		openBackup: () => opening?.peek() ?? null,
		beginOpen(request) {
			if (!opening || disposed || !store || hostingFreeze || opening.peek().record || opening.peek().error) return fail("open-pending", "Resolve the retained Document operation first.");
			const state = store.snapshot();
			if (unrepresentedEditor || draining || queued || remoteBlocked || !remoteEnabled || state !== lastRemoteSnapshot || now() >= lastRemoteExpiresAt
				|| !localEnabled || localBlocked || hostingRecoveryUnverified || request.expectedRevision !== remoteRevision || request.documentEpoch !== documentEpochs[request.bufferId]) return fail("unacknowledged", "Checkpoint the current editor before opening a file.");
			const browser = local.read(); if (!browser.ok) return browser;
			if ((browser.raw ?? null) !== localRaw) return fail("storage-changed", "Browser recovery changed. Nothing was opened.");
			const written = opening.capture({ version: 1, request, before: state }); if (!written.ok) return written;
			hostingFreeze = { kind: "open", bufferId: request.bufferId, startedAt: now() }; hostingUnrepresented = false;
			options.onHostingAuthority?.(); return written;
		},
		finishOpen(result, isStillCurrent = () => true) {
			const record = opening?.peek().record;
			if (disposed || hostingFreeze?.kind !== "open" || !record || !result?.ok || result.operationId !== record.request.operationId
				|| result.intentRevision !== record.request.expectedRevision || result.workspaceId !== workspaceId || result.bufferId !== record.request.bufferId
				|| !["committed", "cancelled", "reused"].includes(result.status) || !/^[a-f0-9]{48}$/.test(result.revision || "")) return fail("unknown-outcome", "Keep the file-open backup until its exact outcome is known.");
			if (hostingUnrepresented || unrepresentedEditor || draining || queued || !isStillCurrent()
				|| (options.getHostingGeneration && (!(result.generation > 0) || result.generation !== options.getHostingGeneration()))) return fail("editor-changed", "Newer work or a changed connection prevents applying this open outcome. Both copies were kept.");
			const checked = validate(result.state, false); if (!checked.ok) return checked;
			const before = record.before, after = checked.state, current = store.snapshot(), id = record.request.bufferId;
			const old = before.buffers.find(b => b.id === id), next = after.buffers.find(b => b.id === id), live = current.buffers.find(b => b.id === id);
			if (!(switching ? isStudioPromptDocumentBufferState(after) : isStudioSingleEditorBufferState(after)) || !next || next.role !== old.role
				|| !same(after.order, before.order) || after.selectedBufferId !== before.selectedBufferId || after.activePromptId !== before.activePromptId
				|| after.revision !== before.revision + 1 || after.savedAt < before.savedAt || after.buffers.length !== before.buffers.length
				|| after.buffers.some(b => b.id !== id && !same(b, before.buffers.find(n => n.id === b.id)))
				|| !same(current.order, before.order) || current.activePromptId !== before.activePromptId || current.selectedBufferId !== before.selectedBufferId
				|| (!same(live, old) && !same(live, next)) || (result.status !== "committed" && !same(next, old))
				|| !Number.isSafeInteger(result.documents?.[id]) || result.documents[id] < record.request.documentEpoch
				|| (result.status === "committed" && (result.documents[id] <= record.request.documentEpoch || next.sourceState.source !== "file" || !next.sourceState.path || next.baselineText !== next.text
					|| next.metadata.scratchpadKey !== "file:" + next.sourceState.path || next.metadata.reviewNotesKey !== "file:" + next.sourceState.path))) return fail("invalid-outcome", "The file-open receipt does not prove this replacement. All copies were kept.");
			const browser = local.read(); if (!browser.ok) return browser;
			if ((browser.raw ?? null) !== localRaw) return fail("storage-changed", "Browser recovery changed. The opening backup was kept.");
			const buffers = current.buffers.map(b => b.id === id ? next : b), rebased = !same(buffers, after.buffers);
			const merged = rebased ? { ...after, buffers, revision: Math.max(after.revision, current.revision) + 1, savedAt: Math.max(after.savedAt, current.savedAt, now()) + 1 } : after;
			const valid = validate(merged, false); if (!valid.ok) return valid;
			const written = saveLocal(valid.state); if (!written?.ok) return written || fail("storage-unavailable", "Keep the opening backup until browser recovery can be stored.");
			// Never remove the original backup before readback of its replacement.
			const cleared = opening.clear(record.request.operationId); if (!cleared.ok) return cleared;
			const startedAt = hostingFreeze.startedAt;
			store = createStudioBufferStore(valid.state); recoveryEpoch++; queued = null;
			remoteRevision = result.revision; remoteBlocked = false; remoteEnabled = true;
			lastRemoteSnapshot = rebased ? after : store.snapshot(); lastRemoteExpiresAt = expiry(result, startedAt);
			receiveAuthorities(result); rememberAck(remoteRevision, after.revision);
			hostingFreeze = null; hostingRecoveryUnverified = false; issue("remote", null); issue("capture", null);
			if (rebased) publish(store.snapshot());
			return { ok: true, status: result.status, selectedChanged: current.selectedBufferId === id && !same(live, next), rebased,
				editor: projectStudioBufferEditor(store.snapshot()), baselineText: store.get(current.selectedBufferId).baselineText };
		},
		isHostingFrozen: () => hostingFreeze !== null,
		hostingAuthority(bufferId = store?.snapshot().selectedBufferId) {
			const current = store?.get(bufferId), acknowledged = lastRemoteSnapshot?.buffers.find(b => b.id === bufferId);
			const generation = options.getHostingGeneration?.();
			if (options.hosting !== true || disposed || remoteBlocked || !remoteEnabled || !current || !acknowledged
				|| now() >= lastRemoteExpiresAt || !Number.isSafeInteger(documentEpochs[bufferId])
				|| !same(current.sourceState, acknowledged.sourceState) || current.resourceDir !== acknowledged.resourceDir
				|| (options.getHostingGeneration && (!Number.isSafeInteger(generation) || generation < 1))
				|| hostingFreeze?.bufferId === bufferId) return fail("view-not-ready", "The document's owning connection and source checkpoint must be ready first.");
			return { ok: true, bufferId, documentEpoch: documentEpochs[bufferId], generation, expectedRevision: remoteRevision };
		},
		noteHostingSave(proof, result) {
			const epoch = result?.documents?.[proof?.bufferId];
			if (options.hosting !== true || disposed || !store?.get(proof?.bufferId)
				|| proof.generation !== options.getHostingGeneration?.() || !Number.isSafeInteger(epoch)
				|| epoch <= proof.documentEpoch || epoch < (documentEpochs[proof.bufferId] || 0)) return fail("document-stale", "The save belongs to an earlier editor incarnation. Recheck its retained outcome.");
			documentEpochs[proof.bufferId] = epoch;
			hostingRecoveryUnverified = true;
			options.onHostingAuthority?.();
			return { ok: true };
		},
		attachHostingSave(operationId) {
			const state = store?.snapshot(), current = store?.get(state?.selectedBufferId);
			const record = pendingHostingSaves.find(r => r.operationId === operationId && r.bufferId === current?.id);
			if (options.hosting !== true || disposed || !record || record.status !== "pending") return fail("save-not-found", "Recheck the selected Document's retained save outcome first.");
			if (hostingFreeze || unrepresentedEditor || draining || queued || remoteBlocked || !remoteEnabled
				|| state !== lastRemoteSnapshot || now() >= lastRemoteExpiresAt) return fail("unacknowledged", "Checkpoint current text and recheck the save before attaching its backing.");
			if (typeof record.path !== "string" || typeof record.label !== "string" || typeof record.resourceDir !== "string" || typeof record.savedText !== "string"
				|| !/^sha256:[a-f0-9]{64}$/.test(record.diskRevision || "") || !(documentEpochs[current.id] > record.beforeDocumentEpoch)) return fail("invalid-outcome", "The retained save did not identify its committed backing.");
			const changedPath = current.sourceState.path !== record.path;
			const destinationKey = record.metadataTransfer?.destinationKey;
			if (changedPath && (destinationKey !== "file:" + record.path || !["carry", "destination"].includes(record.metadataTransfer?.choice))) {
				return fail("metadata-decision-required", "Prepare the saved file's metadata on the server before attaching its backing. Current notes were kept.");
			}
			if (localEnabled) {
				const browser = local.read(); if (!browser.ok) return browser;
				if ((browser.raw ?? null) !== localRaw) return fail("storage-changed", "Browser recovery changed. Current text and the saved outcome were kept.");
			}
			const result = store.update(current.id, current.revision, {
				sourceState: { source: "file", path: record.path, label: changedPath ? record.label : current.sourceState.label, draftId: null,
					...(record.beforeSourceState?.provenance ? { provenance: record.beforeSourceState.provenance } : {}) },
				baselineText: record.savedText, diskRevision: record.diskRevision, resourceDir: record.resourceDir,
				metadata: changedPath ? { ...current.metadata, reviewNotesKey: destinationKey, scratchpadKey: destinationKey } : current.metadata,
			});
			if (!result.ok) return result;
			const written = saveLocal(store.snapshot()); publish(store.snapshot());
			return { ok: true, editor: projectStudioBufferEditor(store.snapshot()), baselineText: record.savedText, localPersisted: written?.ok === true };
		},
		pendingHostingSaves: () => pendingHostingSaves,
		refreshHostingReadiness: () => options.onHostingAuthority?.(),
		notifyHostingViewBound(bufferId) { if (store?.snapshot().selectedBufferId === bufferId) options.onHostingAuthority?.({ boundBufferId: bufferId }); },
		handoffBackup: () => escrow?.peek() ?? null,
		hasVerifiedLocalCheckpoint: () => Boolean(store && localEnabled && !localBlocked && !hostingRecoveryUnverified),
		resolveHandoff(result) {
			const backup = escrow?.peek().record;
			if (hostingFreeze || !result?.ok || !backup || result.moveId !== backup.moveId || result.sourceWorkspaceId !== workspaceId
				|| (result.status !== "cancelled" && !(result.status === "committed" && result.adopted === true && result.bufferId === backup.document.id))) {
				return fail("unknown-outcome", "The destination must acknowledge adoption before removing this backup.");
			}
			return escrow.resolve(result.moveId);
		},
		discardHandoff(moveId, confirmed) {
			if (hostingFreeze || confirmed !== true) return fail("confirmation-required", "Confirm discarding the noneditable backup first.");
			return escrow?.resolve(moveId) ?? fail("hosting-disabled", "Document hosting is not enabled.");
		},
		snapshot: () => store?.snapshot() ?? null,
		needsUnloadConfirmation() {
			// beforeunload cannot distinguish reload from tab closure. Session storage can
			// vanish on closure, so only a current, unexpired server acknowledgement allows
			// silent departure. Measure the TTL from request start, not receipt, to avoid
			// extending server lifetime by network latency. No durable-recovery claim.
			return disposed || !store || unrepresentedEditor || hostingFreeze !== null || hostingRecoveryUnverified || pendingHostingSaves.length > 0 || Boolean(escrow?.peek().record || escrow?.peek().error || opening?.peek().record || opening?.peek().error) || store.snapshot() !== lastRemoteSnapshot || now() >= lastRemoteExpiresAt;
		},
		invalidateRemoteRecovery() {
			recoveryEpoch++; lastRemoteSnapshot = null; remoteBlocked = true; queued = null;
			issue("remote", fail("connection-lost", "Connection closed. New edits aren't being checkpointed to the server."));
		},
		async settled() { while (draining) await draining; },
		dispose() { disposed = true; queued = null; store?.clearPendingOperations(); },
	});
}

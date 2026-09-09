import { createStudioBuffer, validateStudioBufferWorkspace } from "./studio-buffer-store.js";
import { STUDIO_BUFFER_RECOVERY_PREFIX, STUDIO_BUFFER_LEGACY_TAB_PREFIX, STUDIO_BUFFER_RECOVERY_MAX_SERIALIZED_CHARS,
	decodeStudioBufferRecovery, migrateStudioWorkspaceV1, createStudioBufferRecoveryStorage } from "./studio-buffer-recovery.js";
import { isStudioSingleEditorBufferState, projectStudioBufferEditor } from "./studio-buffer-client.js";
import { isStudioPromptDocumentBufferState } from "./studio-buffer-switching.js";

const fail = (reason, message) => ({ ok: false, reason, message });

// Explicit recovery is a FORK into a fresh namespace, never an overwrite/repair
// of the originals. Paths remain claims; compatibility and mode gates still apply.
export function createStudioBufferRecoveryDecisions(options) {
	const { storage, workspaceId, mode, readRemote, canRestore, makeWorkspaceId } = options;
	const expected = { workspaceId, mode };
	const localKeys = [
		["browser-v2", "Browser buffers", STUDIO_BUFFER_RECOVERY_PREFIX + workspaceId, "v2"],
		["browser-legacy", "Browser single-editor copy", STUDIO_BUFFER_LEGACY_TAB_PREFIX + workspaceId, "legacy"],
		["browser-unscoped", "Older browser copy (no tab identity)", "piStudio.workspaceState.v1", "legacy"],
	];
	let records = [], errors = [], handles = new Map(), epoch = 0, disposed = false;
	function localRaw(key) {
		try { const raw = storage.getItem(key); if (raw !== null && typeof raw !== "string") throw new Error(); return { ok: true, raw }; }
		catch { return fail("unavailable", "Browser recovery could not be read. Nothing was treated as empty."); }
	}
	async function remoteRaw() {
		try {
			const result = await readRemote();
			if (!result?.ok) return result || fail("unavailable", "Server copies could not be read.");
			if (result.workspaceId !== workspaceId || result.mode !== mode || !Array.isArray(result.records) || result.records.length !== 2
				|| !["v2", "legacy"].every(kind => result.records.filter(r => r.kind === kind && (r.raw === null || typeof r.raw === "string")).length === 1)) {
				return fail("invalid-state", "Server inspection did not match this workspace. It was not used.");
			}
			return result;
		} catch { return fail("unavailable", "Server copies could not be read. Browser copies and live text were kept."); }
	}
	function validate(raw, kind) {
		if (raw.length > STUDIO_BUFFER_RECOVERY_MAX_SERIALIZED_CHARS) return fail("limit-exceeded", "Too large for this build; download the original archive.");
		if (kind === "v2") return decodeStudioBufferRecovery(raw, expected);
		let value; try { value = JSON.parse(raw); } catch { return fail("invalid-json", "Malformed recovery; download the original archive."); }
		let id = 0;
		return migrateStudioWorkspaceV1(value, { ...expected, makeBufferId: () => "recovered-" + ++id });
	}
	function compatible(state) {
		if (!(options.switching === true && mode === "full" ? isStudioPromptDocumentBufferState(state) : isStudioSingleEditorBufferState(state))) return fail("unsupported-collection", "This copy contains other buffers. Export them or use a build that can display the whole collection.");
		if (!canRestore(projectStudioBufferEditor(state))) return fail("wrong-document", "This copy belongs to another source. Export its text; it cannot replace this document.");
		return { ok: true };
	}
	function add(id, label, raw, kind, key = null) {
		if (raw === null) return;
		const result = validate(raw, kind);
		const compatibility = result.ok ? compatible(result.state) : result;
		const record = Object.freeze({ id, label, raw, state: result.ok ? result.state : null,
			canUse: compatibility.ok, message: compatibility.ok ? "Compatible copy" : compatibility.message });
		records.push(record); handles.set(record, { kind, key });
	}
	function seed(state, isStillCurrent) {
		if (disposed || !isStillCurrent()) return fail("editor-changed", "Editor changed while recovery was open. Current text and original copies were kept.");
		const compatibleResult = compatible(state); if (!compatibleResult.ok) return compatibleResult;
		const nextId = makeWorkspaceId();
		if (nextId === workspaceId) return fail("collision", "A fresh workspace identity is required.");
		try {
			const local = createStudioBufferRecoveryStorage({ storage, workspaceId: nextId, mode });
			if (storage.getItem(local.key + ":serverAck") !== null) return fail("collision", "That workspace identity already has recovery metadata.");
			const checked = validateStudioBufferWorkspace({ ...state, workspaceId: nextId }, { workspaceId: nextId, mode });
			if (!checked.ok) return checked;
			const written = local.write(checked.state, { expectedRaw: null });
			if (!written.ok) return written;
			// A re-entrant storage implementation cannot turn old consent into authority.
			// Leave a successfully prepared copy intact if the final guard fails.
			if (disposed || !isStillCurrent()) return fail("editor-changed", "Editor changed; the prepared copy was retained but navigation was cancelled.");
			return { ok: true, workspaceId: nextId, state: written.state };
		} catch { return fail("unavailable", "A fresh recovery copy could not be prepared. Original data and current text were kept."); }
	}
	return Object.freeze({
		async inspect() {
			if (disposed) return fail("cancelled", "This inspection has closed.");
			const operation = ++epoch;
			const remote = await remoteRaw();
			if (disposed || operation !== epoch) return fail("cancelled", "Recovery inspection closed or was superseded.");
			records = []; errors = []; handles = new Map();
			for (const [id, label, key, kind] of localKeys) {
				const result = localRaw(key);
				if (result.ok) add(id, label, result.raw, kind, key); else errors.push(label + ": " + result.message);
			}
			if (remote.ok) for (const { kind, raw } of remote.records) add("server-" + kind, kind === "v2" ? "Server buffers" : "Server single-editor copy", raw, kind);
			else errors.push(remote.message || "Server copies could not be read.");
			return { ok: true, records: Object.freeze([...records]), errors: Object.freeze([...errors]) };
		},
		archive(currentText) {
			// JSON-stringified raw strings preserve even malformed/future JSON and lone
			// UTF-16 surrogates. No token, capability, server CAS revision or ack sidecar.
			return JSON.stringify({ format: "pi-studio-recovery-export", version: 1, workspaceId, mode,
				currentText, errors, copies: records.map(({ id, label, raw }) => ({ id, label, raw })) }, null, 2);
		},
		async use(record, isStillCurrent = () => true) {
			const target = handles.get(record), operation = epoch;
			if (disposed || !target || !record.state) return fail("invalid-choice", "Inspect and select a compatible recovery copy first.");
			let current;
			if (target.key) current = localRaw(target.key);
			else {
				const result = await remoteRaw();
				current = result.ok ? { ok: true, raw: result.records.find(r => r.kind === target.kind).raw } : result;
			}
			if (disposed || operation !== epoch || !handles.has(record)) return fail("cancelled", "Recovery choice was superseded.");
			if (!current.ok) return current;
			if (current.raw !== record.raw) return fail("storage-changed", "That copy changed while recovery was open. Recheck the copies and choose again.");
			return seed(record.state, isStillCurrent);
		},
		keepCurrent(editor, baselineText, extra = {}, isStillCurrent = () => true, liveState = null) {
			let state = liveState;
			if (!state) {
				let id = 0;
				const migrated = migrateStudioWorkspaceV1(editor, { ...expected, makeBufferId: () => "current-" + ++id });
				if (!migrated.ok) return migrated;
				state = migrated.state;
				try {
					state = { ...state, buffers: state.buffers.map(b => b.id !== state.selectedBufferId ? b : createStudioBuffer({ ...b,
						baselineText: editor.sourceState.path ? baselineText : b.baselineText,
						view: { ...b.view, ...extra.view }, metadata: { ...b.metadata, ...extra.metadata } })) };
				} catch { return fail("invalid-state", "Current editor cannot fit in recovery. Export its full text first."); }
			}
			const checked = validateStudioBufferWorkspace(state, expected);
			if (!checked.ok) return checked;
			const projected = projectStudioBufferEditor(checked.state);
			if (["text", "sourceState", "diskRevision", "resourceDir"].some(key => JSON.stringify(projected[key]) !== JSON.stringify(editor[key]))) return fail("editor-changed", "Current editor no longer matches the captured buffer. Try again.");
			return seed(checked.state, isStillCurrent);
		},
		dispose() { disposed = true; epoch++; handles.clear(); },
	});
}

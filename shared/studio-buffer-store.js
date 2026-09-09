// Browser-safe model only. Paths/revisions are claims, never filesystem grants or save authority.
export const STUDIO_BUFFER_LIMITS = Object.freeze({
	buffers: 16,
	textChars: 900_000,
	totalTextChars: 3_000_000, // Includes baselines, not just visible editor text.
	pendingOperations: 64,
});
const ID = /^[a-zA-Z0-9_-]{1,128}$/;
const WORKSPACE_ID = /^[a-zA-Z0-9_-]{20,128}$/;
const DISK_REVISION = /^sha256:[a-f0-9]{64}$/;
const BUFFER_KEYS = ["id", "role", "revision", "text", "baselineText", "sourceState", "diskRevision", "resourceDir", "view", "metadata"];
const PATCH_KEYS = BUFFER_KEYS.filter((key) => !["id", "role", "revision"].includes(key));

export class StudioBufferStateError extends Error {
	constructor(reason, message) { super(message); this.name = "StudioBufferStateError"; this.reason = reason; }
}
function requireState(condition, reason, message) {
	if (!condition) throw new StudioBufferStateError(reason, message);
}
function object(value, keys, label) {
	requireState(value && typeof value === "object" && !Array.isArray(value), "invalid-state", `${label} must be an object.`);
	requireState(Object.keys(value).every((key) => keys.includes(key)), "unknown-field", `${label} has unsupported fields; preserve the original recovery data.`);
}
function string(value, max, label, nullable = false) {
	if (nullable && value === null) return null;
	requireState(typeof value === "string", "invalid-state", `${label} must be text.`);
	requireState(value.length <= max, "limit-exceeded", `${label} exceeds its limit; nothing was changed.`);
	return value;
}
function integer(value, label, min = 0) {
	requireState(Number.isSafeInteger(value) && value >= min, "invalid-state", `${label} must be a safe integer.`);
	return value;
}
function scroll(value) {
	requireState(typeof value === "number" && Number.isFinite(value) && value >= 0, "invalid-state", "Invalid scroll position.");
	return value;
}
function freeze(value) {
	if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
	return value;
}
function failure(error) {
	return { ok: false, reason: error.reason || "invalid-state", message: error instanceof StudioBufferStateError ? error.message : "Invalid buffer state; nothing was changed." };
}
function source(value) {
	object(value, ["source", "label", "path", "draftId"], "Source identity");
	const path = string(value.path, 16_384, "Source path", true);
	requireState(path === null || (path.length > 0 && !path.includes("\0")), "invalid-state", "Invalid source path.");
	const draftId = string(value.draftId, 256, "Source draft ID", true);
	requireState(!path || draftId === null, "invalid-state", "A file source cannot also have a draft identity.");
	return { source: string(value.source, 100, "Source kind"), label: string(value.label, 4_000, "Source label"), path, draftId };
}
function buffer(value) {
	object(value, BUFFER_KEYS, "Buffer");
	requireState(typeof value.id === "string" && ID.test(value.id), "invalid-state", "Invalid buffer ID.");
	requireState(["prompt", "document"].includes(value.role), "invalid-state", "Invalid buffer role.");
	const text = string(value.text, STUDIO_BUFFER_LIMITS.textChars, "Buffer text");
	const baselineText = string(value.baselineText, STUDIO_BUFFER_LIMITS.textChars, "Buffer baseline", true);
	const sourceState = source(value.sourceState);
	requireState(value.diskRevision === null || (typeof value.diskRevision === "string" && DISK_REVISION.test(value.diskRevision)), "invalid-state", "Invalid disk revision.");
	requireState(sourceState.path !== null || value.diskRevision === null, "invalid-state", "Detached buffers cannot carry a disk revision.");
	const v = value.view;
	object(v, ["editorView", "rightView", "editorLanguage", "selectionStart", "selectionEnd", "selectionDirection", "scrollTop", "previewScrollTop", "rightScrollTop", "followLatest", "responseHistoryIndex"], "Buffer view");
	const start = integer(v.selectionStart, "Selection start");
	const end = integer(v.selectionEnd, "Selection end");
	requireState(start <= end && end <= text.length, "invalid-state", "Selection lies outside the buffer.");
	requireState(["none", "forward", "backward"].includes(v.selectionDirection) && typeof v.followLatest === "boolean", "invalid-state", "Invalid buffer view state.");
	const m = value.metadata;
	object(m, ["annotationsEnabled", "reviewNotesKey", "scratchpadKey"], "Buffer metadata");
	requireState(m.annotationsEnabled === null || typeof m.annotationsEnabled === "boolean", "invalid-state", "Invalid annotation preference.");
	return {
		id: value.id, role: value.role, revision: integer(value.revision, "Buffer revision"), text, baselineText, sourceState,
		diskRevision: value.diskRevision, resourceDir: string(value.resourceDir, 16_384, "Resource directory"),
		view: {
			editorView: string(v.editorView, 100, "Editor view"), rightView: string(v.rightView, 100, "Right view"),
			editorLanguage: string(v.editorLanguage, 100, "Editor language"), selectionStart: start, selectionEnd: end,
			selectionDirection: v.selectionDirection, scrollTop: scroll(v.scrollTop), previewScrollTop: scroll(v.previewScrollTop),
			...(Object.prototype.hasOwnProperty.call(v, "rightScrollTop") ? { rightScrollTop: scroll(v.rightScrollTop) } : {}),
			followLatest: v.followLatest, responseHistoryIndex: integer(v.responseHistoryIndex, "Response position", -1),
		},
		metadata: { annotationsEnabled: m.annotationsEnabled, reviewNotesKey: string(m.reviewNotesKey, 24_000, "Review association", true), scratchpadKey: string(m.scratchpadKey, 24_000, "Scratchpad association", true) },
	};
}

export function createStudioBuffer(options) {
	object(options, BUFFER_KEYS, "New buffer");
	const path = options.sourceState?.path ?? null;
	return freeze(buffer({
		id: options.id, role: options.role, revision: 0, text: "", baselineText: path ? null : "", diskRevision: null, resourceDir: "",
		...options,
		sourceState: { source: "blank", label: options.role === "prompt" ? "Prompt" : "Untitled", path, draftId: path ? null : options.id, ...options.sourceState },
		view: { editorView: "markdown", rightView: options.role === "prompt" ? "preview" : "editor-preview", editorLanguage: "markdown",
			selectionStart: 0, selectionEnd: 0, selectionDirection: "none", scrollTop: 0, previewScrollTop: 0, followLatest: false, responseHistoryIndex: -1, ...options.view },
		metadata: { annotationsEnabled: null, reviewNotesKey: null, scratchpadKey: null, ...options.metadata },
	}));
}

// Strict codec boundary: no identity/text truncation, unknown-field dropping or partial recovery.
export function validateStudioBufferWorkspace(value, expected = {}) {
	try {
		requireState(value && value.version === 2, "unsupported-version", "Unsupported workspace schema; preserve the original recovery data.");
		object(value, ["version", "workspaceId", "mode", "revision", "savedAt", "selectedBufferId", "activePromptId", "order", "buffers"], "Workspace");
		requireState(typeof value.workspaceId === "string" && WORKSPACE_ID.test(value.workspaceId), "invalid-state", "Invalid workspace ID.");
		requireState(["full", "editor-only"].includes(value.mode), "invalid-state", "Watched/read-only views do not own editable buffer stores.");
		requireState((expected.workspaceId === undefined || expected.workspaceId === value.workspaceId) && (expected.mode === undefined || expected.mode === value.mode), "wrong-workspace", "Recovery belongs to a different workspace or mode.");
		requireState(Array.isArray(value.buffers) && value.buffers.length >= 1 && value.buffers.length <= STUDIO_BUFFER_LIMITS.buffers, "limit-exceeded", "Workspace buffer count is outside its limit.");
		const buffers = value.buffers.map(buffer);
		const ids = new Set(buffers.map((entry) => entry.id));
		requireState(ids.size === buffers.length, "invalid-state", "Duplicate buffer identity.");
		requireState(Array.isArray(value.order) && value.order.length === ids.size && new Set(value.order).size === ids.size && value.order.every((id) => ids.has(id)), "invalid-state", "Invalid buffer ordering.");
		requireState(ids.has(value.selectedBufferId), "invalid-state", "Selected buffer is missing.");
		const active = buffers.find((entry) => entry.id === value.activePromptId);
		requireState(value.mode === "full" ? active?.role === "prompt" : value.activePromptId === null && buffers.every((entry) => entry.role === "document"), "invalid-state", "Invalid active Prompt or companion role.");
		const total = buffers.reduce((sum, entry) => sum + entry.text.length + (entry.baselineText?.length || 0), 0);
		requireState(total <= STUDIO_BUFFER_LIMITS.totalTextChars, "limit-exceeded", "Workspace text and baselines exceed the aggregate limit; no buffers were evicted.");
		return { ok: true, state: freeze({ version: 2, workspaceId: value.workspaceId, mode: value.mode,
			revision: integer(value.revision, "Workspace revision"), savedAt: integer(value.savedAt, "Recovery timestamp"),
			selectedBufferId: value.selectedBufferId, activePromptId: value.activePromptId, order: [...value.order], buffers }) };
	} catch (error) { return failure(error); }
}

export function isStudioBufferDirty(entry) {
	return entry.baselineText === null || entry.text !== entry.baselineText;
}

export function createStudioBufferStore(initialState, options = {}) {
	const initial = validateStudioBufferWorkspace(initialState);
	if (!initial.ok) throw new StudioBufferStateError(initial.reason, initial.message);
	let state = initial.state;
	const now = typeof options.now === "function" ? options.now : Date.now;
	const pending = new Map(); // Page-memory only: never recovered, persisted or copied with a document.
	const get = (id) => state.buffers.find((entry) => entry.id === id) || null;
	const fail = (reason, message) => ({ ok: false, reason, message });
	function commit(next) {
		const candidate = validateStudioBufferWorkspace({ ...next, revision: state.revision + 1, savedAt: Math.max(state.savedAt + 1, now()) });
		if (!candidate.ok) return candidate;
		state = candidate.state;
		return { ok: true };
	}
	function update(id, expectedRevision, patch) {
		const current = get(id);
		if (!current || current.revision !== expectedRevision) return fail("stale-buffer", "The originating buffer changed or closed; retry explicitly.");
		try { object(patch, PATCH_KEYS, "Buffer update"); } catch (error) { return failure(error); }
		const next = { ...current, ...patch, revision: current.revision + 1 };
		if (patch.sourceState && patch.sourceState.path !== current.sourceState.path) {
			// Never carry a previous file's baseline/revision to a different path by accident.
			if (!("baselineText" in patch)) next.baselineText = null;
			if (!("diskRevision" in patch)) next.diskRevision = null;
		}
		if (typeof next.text === "string" && !("view" in patch)) {
			next.view = { ...next.view, selectionStart: Math.min(next.view.selectionStart, next.text.length), selectionEnd: Math.min(next.view.selectionEnd, next.text.length) };
		}
		return commit({ ...state, buffers: state.buffers.map((entry) => entry.id === id ? next : entry) });
	}
	function targetMatches(target) {
		return Boolean(target && pending.get(target.requestId) === target && get(target.bufferId)?.revision === target.revision
			&& (!target.requireActivePrompt || state.activePromptId === target.bufferId));
	}
	return Object.freeze({
		snapshot: () => state,
		get,
		update,
		add(entry) {
			if (get(entry?.id)) return fail("duplicate-buffer", "This buffer ID is already open.");
			return commit({ ...state, buffers: [...state.buffers, entry], order: [...state.order, entry?.id] });
		},
		select(id) {
			if (!get(id)) return fail("missing-buffer", "The selected buffer is not open.");
			return id === state.selectedBufferId ? { ok: true } : commit({ ...state, selectedBufferId: id });
		},
		activatePrompt(id) {
			if (state.mode !== "full" || get(id)?.role !== "prompt") return fail("not-a-prompt", "Only a full workspace Prompt can be activated.");
			if (id === state.activePromptId) return { ok: true };
			const result = commit({ ...state, activePromptId: id });
			// Switching away and back must not revive a transfer aimed at an earlier active destination.
			if (result.ok) for (const [requestId, target] of pending) if (target.requireActivePrompt) pending.delete(requestId);
			return result;
		},
		close(target, { discard = false, replacementPromptId = null } = {}) {
			if (!targetMatches(target)) {
				if (target && pending.get(target.requestId) === target) pending.delete(target.requestId);
				return fail("stale-operation", "The buffer changed, closed or reopened; confirm again.");
			}
			const id = target.bufferId;
			const entry = get(id);
			if (discard !== true && (isStudioBufferDirty(entry) || (entry.role === "prompt" && entry.text.length > 0))) return fail("confirmation-required", "Closing this buffer needs an explicit discard decision.");
			const activePromptId = id === state.activePromptId ? replacementPromptId : state.activePromptId;
			if (id === state.activePromptId && (!replacementPromptId || replacementPromptId === id || get(replacementPromptId)?.role !== "prompt")) return fail("replacement-prompt-required", "Choose the next active Prompt explicitly before closing this one.");
			const order = state.order.filter((other) => other !== id);
			const result = commit({ ...state, activePromptId, selectedBufferId: state.selectedBufferId === id ? activePromptId || order[0] : state.selectedBufferId,
				order, buffers: state.buffers.filter((other) => other.id !== id) });
			if (result.ok) for (const [requestId, target] of pending) if (target.bufferId === id) pending.delete(requestId);
			return result;
		},
		beginOperation(bufferId, requestId, { requireActivePrompt = false } = {}) {
			const entry = get(bufferId);
			if (!entry || (requireActivePrompt && state.activePromptId !== bufferId)) return fail("missing-origin", "The requested originating buffer/Prompt is not available.");
			if (typeof requestId !== "string" || !requestId.length || requestId.length > 256 || pending.has(requestId)) return fail("invalid-request", "Request IDs must be bounded and unique among pending operations.");
			if (pending.size >= STUDIO_BUFFER_LIMITS.pendingOperations) return fail("limit-exceeded", "Too many pending buffer operations; nothing was evicted.");
			const target = Object.freeze({ bufferId, revision: entry.revision, requestId, requireActivePrompt: Boolean(requireActivePrompt) });
			pending.set(requestId, target);
			return { ok: true, target };
		},
		isCurrent: targetMatches,
		finishOperation(target, patch) {
			const matches = targetMatches(target);
			if (target && pending.get(target.requestId) === target) pending.delete(target.requestId);
			if (!matches) return fail("stale-operation", "The originating operation changed, closed or completed; retry explicitly.");
			return update(target.bufferId, target.revision, patch);
		},
		cancelOperation(target) {
			return Boolean(target && pending.get(target.requestId) === target && pending.delete(target.requestId));
		},
		clearPendingOperations: () => pending.clear(),
		get pendingOperationCount() { return pending.size; },
	});
}

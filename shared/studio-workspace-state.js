export const STUDIO_TAB_STATE_ID_PATTERN = /^[a-zA-Z0-9_-]{20,128}$/;
export const STUDIO_WORKSPACE_STATE_MAX_TEXT_CHARS = 900_000;
export const STUDIO_WORKSPACE_STATE_MAX_ENTRIES = 16;
export const STUDIO_WORKSPACE_STATE_MAX_TOTAL_TEXT_CHARS = 3_000_000;
export const STUDIO_WORKSPACE_STATE_TTL_MS = 24 * 60 * 60 * 1000;

export function isValidStudioTabStateId(value) {
	return typeof value === "string" && STUDIO_TAB_STATE_ID_PATTERN.test(value);
}

function boundedString(value, maxLength) {
	return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function finiteNumber(value, fallback = 0) {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function normalizeStudioWorkspaceRecoveryState(value) {
	if (!value || typeof value !== "object" || value.version !== 1 || typeof value.text !== "string") return null;
	if (value.text.length > STUDIO_WORKSPACE_STATE_MAX_TEXT_CHARS) return null;
	const sourceState = value.sourceState && typeof value.sourceState === "object" ? value.sourceState : {};
	const diskRevision = typeof value.diskRevision === "string" && /^sha256:[a-f0-9]{64}$/i.test(value.diskRevision.trim())
		? value.diskRevision.trim().toLowerCase()
		: null;
	return {
		version: 1,
		savedAt: Math.max(0, finiteNumber(value.savedAt)),
		sourceState: {
			source: boundedString(sourceState.source, 100),
			label: boundedString(sourceState.label, 4_000),
			path: boundedString(sourceState.path, 16_384) || null,
			draftId: boundedString(sourceState.draftId, 256) || null,
		},
		diskRevision,
		resourceDir: boundedString(value.resourceDir, 16_384),
		editorView: boundedString(value.editorView, 100),
		rightView: boundedString(value.rightView, 100),
		editorLanguage: boundedString(value.editorLanguage, 100),
		followLatest: value.followLatest === true,
		responseHistoryIndex: Math.floor(finiteNumber(value.responseHistoryIndex, -1)),
		selectionStart: Math.max(0, Math.floor(finiteNumber(value.selectionStart))),
		selectionEnd: Math.max(0, Math.floor(finiteNumber(value.selectionEnd))),
		scrollTop: Math.max(0, finiteNumber(value.scrollTop)),
		text: value.text,
	};
}

export function createStudioWorkspaceStateStore(options = {}) {
	const maxEntries = Math.max(1, Math.floor(Number(options.maxEntries) || STUDIO_WORKSPACE_STATE_MAX_ENTRIES));
	const maxTotalTextChars = Math.max(1, Math.floor(Number(options.maxTotalTextChars) || STUDIO_WORKSPACE_STATE_MAX_TOTAL_TEXT_CHARS));
	const ttlMs = Math.max(1, Math.floor(Number(options.ttlMs) || STUDIO_WORKSPACE_STATE_TTL_MS));
	const now = typeof options.now === "function" ? options.now : Date.now;
	const entries = new Map();
	let totalTextChars = 0;

	function remove(tabStateId) {
		const existing = entries.get(tabStateId);
		if (!existing) return false;
		entries.delete(tabStateId);
		totalTextChars = Math.max(0, totalTextChars - existing.state.text.length);
		return true;
	}

	function cleanup() {
		const currentTime = now();
		for (const [tabStateId, entry] of entries) {
			if (currentTime - entry.storedAt > ttlMs) remove(tabStateId);
		}
	}

	function evictOldest(excludedTabStateId) {
		let oldestId = null;
		let oldestStoredAt = Number.POSITIVE_INFINITY;
		for (const [tabStateId, entry] of entries) {
			if (tabStateId === excludedTabStateId) continue;
			if (entry.storedAt < oldestStoredAt) {
				oldestId = tabStateId;
				oldestStoredAt = entry.storedAt;
			}
		}
		return oldestId ? remove(oldestId) : false;
	}

	return Object.freeze({
		get(tabStateId) {
			if (!isValidStudioTabStateId(tabStateId)) return null;
			cleanup();
			return entries.get(tabStateId)?.state ?? null;
		},
		set(tabStateId, rawState) {
			if (!isValidStudioTabStateId(tabStateId)) return false;
			const state = normalizeStudioWorkspaceRecoveryState(rawState);
			if (!state || state.text.length > maxTotalTextChars) return false;
			cleanup();
			const existing = entries.get(tabStateId);
			if (existing && existing.state.savedAt > state.savedAt) return false;
			if (existing) remove(tabStateId);
			while (entries.size >= maxEntries || totalTextChars + state.text.length > maxTotalTextChars) {
				if (!evictOldest(tabStateId)) return false;
			}
			entries.set(tabStateId, { state, storedAt: now() });
			totalTextChars += state.text.length;
			return true;
		},
		delete(tabStateId) {
			return isValidStudioTabStateId(tabStateId) ? remove(tabStateId) : false;
		},
		clear() {
			entries.clear();
			totalTextChars = 0;
		},
		get size() {
			cleanup();
			return entries.size;
		},
		get totalTextChars() {
			cleanup();
			return totalTextChars;
		},
	});
}

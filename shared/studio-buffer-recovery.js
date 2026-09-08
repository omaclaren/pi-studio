import {
	StudioBufferStateError,
	createStudioBuffer,
	validateStudioBufferWorkspace,
} from "./studio-buffer-store.js";

// The old key contains "v2" but its payload schema is v1. Never reuse that namespace.
export const STUDIO_BUFFER_RECOVERY_PREFIX = "piStudio.bufferWorkspace.v2:";
export const STUDIO_BUFFER_LEGACY_TAB_PREFIX = "piStudio.workspaceState.v2:";
export const STUDIO_BUFFER_RECOVERY_MAX_SERIALIZED_CHARS = 20_000_000;
const LEGACY_KEYS = ["version", "savedAt", "sourceState", "diskRevision", "resourceDir", "editorView", "rightView", "editorLanguage", "followLatest", "responseHistoryIndex", "selectionStart", "selectionEnd", "scrollTop", "text"];
const fail = (reason, message) => ({ ok: false, reason, message });

function parse(raw) {
	if (typeof raw !== "string") return fail("invalid-state", "Recovery must be serialized text.");
	if (raw.length > STUDIO_BUFFER_RECOVERY_MAX_SERIALIZED_CHARS) return fail("limit-exceeded", "Recovery exceeds the serialized size limit; preserve the original data.");
	try { return { ok: true, value: JSON.parse(raw) }; }
	catch { return fail("invalid-json", "Recovery could not be parsed; preserve the original data."); }
}
export function decodeStudioBufferRecovery(raw, expected) {
	const parsed = parse(raw);
	return parsed.ok ? validateStudioBufferWorkspace(parsed.value, expected) : parsed;
}
export function encodeStudioBufferRecovery(state, expected) {
	const checked = validateStudioBufferWorkspace(state, expected);
	if (!checked.ok) return checked;
	const raw = JSON.stringify(checked.state);
	if (raw.length > STUDIO_BUFFER_RECOVERY_MAX_SERIALIZED_CHARS) return fail("limit-exceeded", "Recovery exceeds the serialized size limit; nothing was replaced.");
	return { ...checked, raw };
}

// No disk reads: v1 did not persist a baseline, so a recovered file is conservatively dirty.
// mode/workspaceId come from the launch owner, not a field in the legacy payload.
export function migrateStudioWorkspaceV1(value, { workspaceId, mode, makeBufferId } = {}) {
	try {
		if (!value || typeof value !== "object" || Array.isArray(value) || value.version !== 1) return fail("unsupported-version", "Only schema v1 can be migrated here.");
		if (Object.keys(value).some((key) => !LEGACY_KEYS.includes(key))) return fail("unknown-field", "Legacy recovery has unsupported fields; retain the original payload.");
		if (typeof value.text !== "string") return fail("invalid-state", "Legacy editor text is missing.");
		if (!["full", "editor-only"].includes(mode)) return fail("wrong-workspace", "An editable launch mode is required for migration.");
		if (typeof makeBufferId !== "function") return fail("invalid-state", "Migration requires a buffer ID allocator.");
		const sourceState = value.sourceState === undefined ? {} : value.sourceState;
		if (!sourceState || typeof sourceState !== "object" || Array.isArray(sourceState)) return fail("invalid-state", "Invalid legacy source identity.");
		if (["recovery-omitted", "recovery-cleared"].includes(sourceState.source)) return fail("legacy-marker", "This is a recovery omission/reset marker, not a draft to migrate.");
		const fileBacked = typeof sourceState.path === "string" && sourceState.path.length > 0;
		const role = mode === "full" && !fileBacked ? "prompt" : "document";
		const id = makeBufferId();
		const diskRevision = typeof value.diskRevision === "string" ? value.diskRevision.trim().toLowerCase() : value.diskRevision ?? null;
		const selection = (input, fallback) => {
			if (input === undefined) return fallback;
			if (!Number.isSafeInteger(input) || input < 0) throw new StudioBufferStateError("invalid-state", "Invalid legacy selection.");
			return Math.min(input, value.text.length);
		};
		const start = selection(value.selectionStart, 0);
		const end = Math.max(start, selection(value.selectionEnd, start));
		const entry = createStudioBuffer({
			id, role, text: value.text, baselineText: fileBacked ? null : "", diskRevision,
			sourceState: { source: "blank", label: "", path: null, draftId: null, ...sourceState },
			resourceDir: value.resourceDir === undefined ? "" : value.resourceDir,
			view: {
				editorView: value.editorView === undefined ? "markdown" : value.editorView,
				rightView: value.rightView === undefined ? "editor-preview" : value.rightView,
				editorLanguage: value.editorLanguage === undefined ? "markdown" : value.editorLanguage,
				followLatest: value.followLatest === undefined ? false : value.followLatest,
				responseHistoryIndex: value.responseHistoryIndex === undefined ? -1 : value.responseHistoryIndex,
				selectionStart: start, selectionEnd: end, scrollTop: value.scrollTop === undefined ? 0 : value.scrollTop,
			},
		});
		const buffers = [entry];
		let activePromptId = role === "prompt" ? id : null;
		if (mode === "full" && role === "document") {
			const prompt = createStudioBuffer({ id: makeBufferId(), role: "prompt" });
			buffers.unshift(prompt);
			activePromptId = prompt.id;
		}
		return validateStudioBufferWorkspace({ version: 2, workspaceId, mode, revision: 0, savedAt: value.savedAt === undefined ? 0 : value.savedAt,
			selectedBufferId: id, activePromptId, order: buffers.map((entry) => entry.id), buffers }, { workspaceId, mode });
	} catch (error) {
		return fail(error.reason || "invalid-state", error instanceof StudioBufferStateError ? error.message : "Migration failed; preserve the original legacy payload.");
	}
}

// Synchronous, same-page sessionStorage adapter, NOT a cross-client lease or server CAS.
// No methods erase recovery. The caller must display errors and offer export/retry/discard
// before activating a recovered editor. The opt-in client/decision layer does this;
// the default production path still uses the separate v1 implementation.
export function createStudioBufferRecoveryStorage({ storage, workspaceId, mode }) {
	if (typeof workspaceId !== "string" || !/^[a-zA-Z0-9_-]{20,128}$/.test(workspaceId) || !["full", "editor-only"].includes(mode)) {
		throw new StudioBufferStateError("wrong-workspace", "An explicit editable workspace identity and mode are required.");
	}
	const expected = { workspaceId, mode };
	const key = STUDIO_BUFFER_RECOVERY_PREFIX + workspaceId;
	const legacyKey = STUDIO_BUFFER_LEGACY_TAB_PREFIX + workspaceId;
	function readRaw(which) {
		try {
			if (!storage || typeof storage.getItem !== "function") throw new Error("unavailable");
			const raw = storage.getItem(which);
			if (raw !== null && typeof raw !== "string") throw new Error("invalid storage result");
			return { ok: true, raw };
		} catch { return fail("storage-unavailable", "Recovery storage could not be read; no replacement is safe."); }
	}
	function legacyConflict(state) {
		const legacy = readRaw(legacyKey);
		if (!legacy.ok || legacy.raw === null) return legacy.ok ? { ok: true } : legacy;
		const parsed = parse(legacy.raw);
		let id = 0;
		const checked = parsed.ok ? migrateStudioWorkspaceV1(parsed.value, { ...expected, makeBufferId: () => "legacy-check-" + ++id }) : parsed;
		if (!checked.ok) return fail("legacy-conflict", "Legacy recovery is malformed, unsupported or a reset/omission marker; preserve both copies for a recovery decision.");
		if (checked.state.savedAt > state.savedAt) return fail("legacy-newer", "A newer single-editor recovery exists; resolve it before writing or restoring v2.");
		return { ok: true };
	}
	function write(state, options = {}, migratingLegacyRaw) {
		if (!("expectedRaw" in options) || (options.expectedRaw !== null && typeof options.expectedRaw !== "string")) return fail("expected-state-required", "Read recovery before writing it.");
		const encoded = encodeStudioBufferRecovery(state, expected);
		if (!encoded.ok) return encoded;
		const current = readRaw(key);
		if (!current.ok) return current;
		if (current.raw !== options.expectedRaw) return fail("storage-changed", "Recovery changed since it was read; retain the current editor and retry explicitly.");
		let conflictBaseline = encoded.state;
		if (current.raw !== null) {
			const previous = decodeStudioBufferRecovery(current.raw, expected);
			if (!previous.ok) return previous; // Exact-match consent cannot authorize erasing unknown/future data.
			if (encoded.raw !== current.raw && (state.revision <= previous.state.revision || state.savedAt < previous.state.savedAt)) return fail("stale-state", "Recovery update is not newer than the stored workspace.");
			conflictBaseline = previous.state; // A new candidate timestamp must not hide newer v1 work.
		} else {
			const legacy = readRaw(legacyKey);
			if (!legacy.ok) return legacy;
			if (legacy.raw !== null && legacy.raw !== migratingLegacyRaw) return fail("migration-required", "Legacy recovery must be migrated explicitly before creating a v2 workspace.");
		}
		const conflict = legacyConflict(conflictBaseline);
		if (!conflict.ok) return conflict;
		try {
			if (!storage || typeof storage.setItem !== "function") throw new Error("unavailable");
			storage.setItem(key, encoded.raw);
		} catch { return fail("storage-write-failed", "Recovery could not be stored. Existing recovery and live buffers must be kept."); }
		const verified = readRaw(key);
		if (!verified.ok || verified.raw !== encoded.raw) return fail("storage-unverified", "Recovery write could not be verified; retain the original draft and legacy data.");
		const decoded = decodeStudioBufferRecovery(verified.raw, expected);
		return decoded.ok ? { ...decoded, raw: verified.raw } : decoded;
	}
	return Object.freeze({
		key, legacyKey, write: (state, options) => write(state, options),
		// Adopt a validated server/v1 candidate only against the exact local legacy read.
		// Legacy bytes remain untouched; write() still validates their schema/timestamp.
		adopt(state, { expectedLegacyRaw } = {}) {
			const legacy = readRaw(legacyKey);
			if (!legacy.ok) return legacy;
			if (legacy.raw !== expectedLegacyRaw) return fail("storage-changed", "Legacy recovery changed before adoption.");
			return write(state, { expectedRaw: null }, legacy.raw);
		},
		read() {
			const current = readRaw(key);
			if (!current.ok) return current;
			if (current.raw !== null) {
				const decoded = decodeStudioBufferRecovery(current.raw, expected);
				if (!decoded.ok) return { ...decoded, key };
				const conflict = legacyConflict(decoded.state);
				return conflict.ok ? { ...decoded, raw: current.raw, status: "found" } : conflict;
			}
			const legacy = readRaw(legacyKey);
			if (!legacy.ok) return legacy;
			return { ok: true, status: legacy.raw === null ? "empty" : "legacy", raw: null, legacyRaw: legacy.raw };
		},
		migrateLegacy({ expectedLegacyRaw, makeBufferId }) {
			const current = readRaw(key);
			if (!current.ok) return current;
			if (current.raw !== null) return fail("already-present", "A v2 recovery already exists; migration will not replace it.");
			const legacy = readRaw(legacyKey);
			if (!legacy.ok) return legacy;
			if (typeof expectedLegacyRaw !== "string" || legacy.raw !== expectedLegacyRaw) return fail("storage-changed", "Legacy recovery changed or is missing; read it again before migrating.");
			const parsed = parse(legacy.raw);
			if (!parsed.ok) return parsed;
			const migrated = migrateStudioWorkspaceV1(parsed.value, { ...expected, makeBufferId });
			if (!migrated.ok) return migrated;
			// ID allocators are caller code. Recheck both source and destination after invoking one.
			const latest = readRaw(legacyKey);
			if (!latest.ok) return latest;
			if (latest.raw !== legacy.raw) return fail("storage-changed", "Legacy recovery changed during migration; nothing was replaced.");
			return write(migrated.state, { expectedRaw: null }, legacy.raw); // Retain the exact legacy bytes, even after success.
		},
	});
}

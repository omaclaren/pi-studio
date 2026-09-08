import { randomBytes } from "node:crypto";
import { encodeStudioBufferRecovery, migrateStudioWorkspaceV1 } from "./studio-buffer-recovery.js";

export const STUDIO_BUFFER_REQUEST_MAX_BYTES = 32_000_000;
const token = () => randomBytes(24).toString("hex");
const fail = (reason, message) => ({ ok: false, reason, message });

// Process-memory fallback only. Page capabilities bind the HTML launch mode and tab;
// a client-supplied body cannot promote an editor-only/watched view to a full workspace.
export function createStudioBufferServerStore(options = {}) {
	const maxEntries = options.maxEntries ?? 16;
	const maxTotalTextChars = options.maxTotalTextChars ?? 12_000_000;
	const maxCapabilities = options.maxCapabilities ?? 256;
	const ttlMs = options.ttlMs ?? 24 * 60 * 60 * 1000;
	const now = options.now ?? Date.now;
	const legacyState = options.legacyState ?? (() => null);
	const entries = new Map(), capabilities = new Map();
	function cleanup() {
		const time = now();
		for (const [key, entry] of entries) if (time - entry.touchedAt > ttlMs) entries.delete(key);
		for (const [key, entry] of capabilities) if (time - entry.touchedAt > ttlMs) capabilities.delete(key);
	}
	function scope(capability) {
		cleanup();
		const entry = capabilities.get(capability);
		if (!entry) return null;
		entry.touchedAt = now();
		return entry;
	}
	function legacyConflict(binding, baseline) {
		const legacy = legacyState(binding.workspaceId);
		if (!legacy) return null;
		let id = 0;
		const checked = migrateStudioWorkspaceV1(legacy, { ...binding, makeBufferId: () => "legacy-" + ++id });
		if (!checked.ok) return fail("legacy-conflict", "Legacy recovery needs an explicit recovery decision.");
		if (checked.state.savedAt > baseline.savedAt) return fail("legacy-newer", "Newer single-editor recovery exists; it was not replaced.");
		return null;
	}
	return Object.freeze({
		issue({ workspaceId, mode, watched = false }) {
			cleanup();
			if (watched || !["full", "editor-only"].includes(mode) || typeof workspaceId !== "string" || !/^[a-zA-Z0-9_-]{20,128}$/.test(workspaceId)) return fail("forbidden", "This view cannot own editable buffer recovery.");
			if (capabilities.size >= maxCapabilities) return fail("capacity", "Too many recovery pages are open; existing recovery was retained.");
			const capability = token();
			capabilities.set(capability, { workspaceId, mode, touchedAt: now() });
			return { ok: true, capability, workspaceId, mode };
		},
		read(capability) {
			const binding = scope(capability);
			if (!binding) return fail("forbidden", "Recovery page authorization expired. Reload this page before retrying.");
			const entry = entries.get(binding.workspaceId);
			if (!entry) return { ok: true, state: null, revision: null };
			if (entry.state.mode !== binding.mode) return fail("wrong-workspace", "Recovery belongs to another view mode.");
			const conflict = legacyConflict(binding, entry.state);
			if (conflict) return conflict;
			entry.touchedAt = now();
			return { ok: true, state: entry.state, revision: entry.revision, expiresInMs: ttlMs };
		},
		// Explicit read-only inspection can expose retained copies even when legacy
		// conflict blocks normal adoption. This is NOT a persistence acknowledgement.
		inspect(capability) {
			const binding = scope(capability);
			if (!binding) return fail("forbidden", "Recovery page authorization expired. Export browser copies before reloading.");
			const entry = entries.get(binding.workspaceId);
			if (entry && entry.state.mode !== binding.mode) return fail("wrong-workspace", "Recovery belongs to another view mode.");
			const legacy = legacyState(binding.workspaceId);
			if (entry) entry.touchedAt = now();
			return { ok: true, workspaceId: binding.workspaceId, mode: binding.mode,
				records: [{ kind: "v2", raw: entry?.raw ?? null }, { kind: "legacy", raw: legacy ? JSON.stringify(legacy) : null }] };
		},
		write(capability, expectedRevision, state) {
			const binding = scope(capability);
			if (!binding) return fail("forbidden", "Recovery page authorization expired.");
			if (expectedRevision !== null && (typeof expectedRevision !== "string" || !/^[a-f0-9]{48}$/.test(expectedRevision))) return fail("invalid-request", "Read recovery before writing it.");
			const encoded = encodeStudioBufferRecovery(state, binding);
			if (!encoded.ok) return encoded;
			const previous = entries.get(binding.workspaceId);
			if (previous && previous.state.mode !== binding.mode) return fail("wrong-workspace", "Recovery belongs to another view mode.");
			const conflict = legacyConflict(binding, previous?.state ?? encoded.state);
			if (conflict) return conflict;
			// An exact retry after an acknowledgement was lost is safe; divergent writers need a new decision.
			if (previous?.raw === encoded.raw) {
				previous.touchedAt = now();
				return { ok: true, revision: previous.revision, workspaceRevision: previous.state.revision, expiresInMs: ttlMs };
			}
			if ((previous?.revision ?? null) !== expectedRevision) return fail("conflict", "Another page changed recovery. Current text and stored recovery were kept.");
			if (previous && (encoded.state.revision <= previous.state.revision || encoded.state.savedAt < previous.state.savedAt)) return fail("stale-state", "Recovery update is older than the stored workspace.");
			const chars = encoded.state.buffers.reduce((sum, b) => sum + b.text.length + (b.baselineText?.length || 0), 0);
			const total = [...entries.values()].reduce((sum, e) => sum + e.chars, 0) - (previous?.chars || 0) + chars;
			if ((!previous && entries.size >= maxEntries) || total > maxTotalTextChars) return fail("capacity", "Server recovery capacity reached. No workspace was evicted; save or copy your text before closing.");
			const revision = token();
			entries.set(binding.workspaceId, { state: encoded.state, raw: encoded.raw, revision, chars, touchedAt: now() });
			return { ok: true, revision, workspaceRevision: encoded.state.revision, expiresInMs: ttlMs };
		},
		release(capability) { return { ok: true, released: capabilities.delete(capability) }; },
		clear() { entries.clear(); capabilities.clear(); },
		get size() { cleanup(); return entries.size; },
	});
}

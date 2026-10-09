import { createStudioBuffer } from "./studio-buffer-store.js";
const fail = (reason, message) => ({ ok: false, reason, message });
const validMove = value => typeof value === "string" && /^[a-f0-9]{48}$/.test(value);

// One non-editable handoff backup per host. It never participates in ordinary
// workspace recovery or grants a file/metadata writer. No durable-storage claim.
// A copy retries the same bounded identity, never a fresh intent after a lost
// acknowledgement. Persist only identifiers/preconditions, not URLs or tokens.
// One verified storage write retires a pending request AND retains its destination.
// v1 pending records remain readable; v2 adds a bounded, token-free identity list.
// No silent eviction: at capacity new creation is refused before dispatch.
export function createStudioDocumentCreationIntent(storage, key, normalizeRequest, kinds) {
	let loaded = false, raw = null, record = null, error = null, destinations = [];
	const validId = value => typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
	const pending = request => Object.freeze({ version: 1, request: Object.freeze(normalizeRequest(request)) });
	function destination(value) {
		if (!value || Object.keys(value).some(k => !["operationId", "sourceBufferId", "workspaceId", "bufferId", "kind", "created"].includes(k))
			|| !validMove(value.operationId) || ![value.sourceBufferId, value.workspaceId, value.bufferId].every(validId)
			|| !kinds.includes(value.kind) || typeof value.created !== "boolean") throw Error("Invalid retained Document identity.");
		return Object.freeze({ ...value });
	}
	function load() {
		if (loaded) return;
		try {
			raw = storage.getItem(key) || null;
			if (raw) {
				if (raw.length > 60000) throw Error("Oversized Document tracking record.");
				const value = JSON.parse(raw), version2 = value?.version === 2;
				if (!value || ![1, 2].includes(value.version) || Object.keys(value).some(k => !(version2 ? ["version", "request", "destinations"] : ["version", "request"]).includes(k))) throw Error("Unknown Document tracking record.");
				const list = version2 ? value.destinations : [];
				if (!Array.isArray(list) || list.length > 32) throw Error("Invalid Document destination list.");
				const restored = list.map(destination);
				if (new Set(restored.map(d => d.operationId)).size !== restored.length) throw Error("Duplicate Document destination identity.");
				record = version2 && value.request === null ? null : pending(value.request);
				destinations = restored;
			}
			loaded = true; error = null;
		} catch (e) { error = fail("tracking-unavailable", e.message || "Document tracking needs inspection. Its bytes were kept."); }
	}
	function current() {
		load(); if (error) return error;
		try { return (storage.getItem(key) || null) === raw ? { ok: true } : fail("storage-changed", "Document tracking changed independently. Its bytes were kept."); }
		catch { return fail("storage-unavailable", "Document tracking could not be checked. Keep this page open."); }
	}
	function write(nextRecord, nextDestinations) {
		const checked = current(); if (!checked.ok) return checked;
		const encoded = nextRecord || nextDestinations.length ? JSON.stringify({ version: 2, request: nextRecord?.request ?? null, destinations: nextDestinations }) : null;
		if (encoded?.length > 60000) return fail("capacity", "Document tracking is full. Existing identities were kept.");
		try {
			if (encoded) storage.setItem(key, encoded); else storage.removeItem(key);
			if ((storage.getItem(key) || null) !== encoded) return fail("storage-unverified", "Document tracking could not be verified. Keep the original attempt and recheck.");
			raw = encoded; record = nextRecord; destinations = nextDestinations; return { ok: true };
		} catch { return fail("storage-unavailable", "Document tracking could not be stored. Keep the original attempt and recheck."); }
	}
	function remember(value, nextRecord = record) {
		const checked = current(); if (!checked.ok) return checked;
		let next; try { next = destination(value); } catch (e) { return fail("invalid-receipt", e.message); }
		const existing = destinations.find(d => d.operationId === next.operationId);
		if (existing && JSON.stringify(existing) !== JSON.stringify(next)) return fail("destination-changed", "This operation belongs to another Document identity. Nothing was replaced.");
		if (!existing && destinations.length >= 32) return fail("capacity", "The retained Document list is full. Existing identities were kept.");
		return write(nextRecord, existing ? destinations : [...destinations, next]);
	}
	return Object.freeze({
		peek() { load(); return { record, error, destinations: destinations.map(d => ({ ...d })) }; },
		current,
		capture(request) {
			const checked = current(); if (!checked.ok) return checked;
			let next; try { next = pending(request); } catch (e) { return fail("invalid-request", e.message); }
			if (record) return JSON.stringify(record) === JSON.stringify(next) ? { ok: true } : fail("creation-pending", "Recheck the existing attempt before starting another one.");
			if (destinations.length >= 32) return fail("capacity", "The retained Document list is full. No new Document was requested.");
			return write(next, destinations);
		},
		complete(result) {
			const checked = current(); if (!checked.ok) return checked;
			const request = record?.request, kind = request?.kind || "copy";
			if (!request || result?.ok !== true || result.operationId !== request.operationId || typeof result.created !== "boolean" || (kind !== "file" && !result.created)) return fail("unverified-creation", "Creation was not verified. Keep and recheck the original attempt.");
			let verified;
			try { verified = destination({ operationId: request.operationId, sourceBufferId: request.bufferId, workspaceId: result.workspaceId, bufferId: result.bufferId, kind, created: result.created }); }
			catch (e) { return fail("invalid-receipt", e.message); }
			return { ...remember(verified, null), destination: { ...verified } };
		},
		remember: value => { load(); return remember(value, record); },
		clear(confirmed) {
			if (confirmed !== true) return fail("confirmation-required", "Confirm forgetting this attempt. Existing Documents will not be deleted.");
			const checked = current(); if (!checked.ok) return checked;
			return write(null, destinations);
		},
	});
}

export function createStudioDocumentCopyIntent(storage, key) {
	return createStudioDocumentCreationIntent(storage, key, p => {
		if (!p || Object.keys(p).some(k => !["operationId", "bufferId", "documentEpoch", "expectedRevision"].includes(k))
			|| !validMove(p.operationId) || !validMove(p.expectedRevision) || !/^[a-zA-Z0-9_-]{1,128}$/.test(p.bufferId || "")
			|| !Number.isSafeInteger(p.documentEpoch) || p.documentEpoch < 1) throw Error("Invalid copy intent.");
		return { operationId: p.operationId, bufferId: p.bufferId, documentEpoch: p.documentEpoch, expectedRevision: p.expectedRevision };
	}, ["copy", "move"]);
}

export function createStudioDocumentEscrow(storage, key) {
	let loaded = false, record = null, raw = null, readable = true, stored = false, error = null;
	function load() {
		if (loaded) return; loaded = true;
		try { raw = storage.getItem(key); }
		catch { readable = false; return; }
		if (!raw) return;
		try {
			if (raw.length > 6_100_000) throw Error("Oversized handoff backup");
			const value = JSON.parse(raw);
			if (value.version !== 1 || !validMove(value.moveId)) throw Error("Unknown handoff backup");
			const document = createStudioBuffer(value.document);
			if (document.role !== "document") throw Error("Not a Document backup");
			record = { version: 1, moveId: value.moveId, document }; stored = true;
		} catch { error = fail("escrow-invalid", "An existing handoff backup needs inspection. It was not replaced."); }
	}
	function persist() {
		if (!readable || !record) return;
		try {
			if ((storage.getItem(key) || null) !== (raw || null)) { stored = false; return fail("storage-changed", "The handoff backup changed independently. Both copies were kept."); }
			const next = JSON.stringify(record); storage.setItem(key, next);
			if (storage.getItem(key) !== next) { stored = false; return fail("storage-unverified", "The handoff backup could not be verified. Keep this page open."); }
			raw = next; stored = true;
		} catch { stored = false; }
	}
	return Object.freeze({
		capture(moveId, document) {
			load(); if (error) return error;
			if (!validMove(moveId) || document?.role !== "document") return fail("invalid-move", "A Document move identity is required.");
			if (record && (record.moveId !== moveId || JSON.stringify(record.document) !== JSON.stringify(document))) {
				return fail("handoff-pending", "The earlier document still has a handoff backup. Open its destination or explicitly discard that backup before moving another document.");
			}
			record ??= { version: 1, moveId, document: createStudioBuffer(document) };
			const result = persist(); if (result) return result;
			return { ok: true, stored };
		},
		peek() { load(); return { record, stored, error }; },
		resolve(moveId) {
			load(); if (!record || record.moveId !== moveId) return fail("wrong-handoff", "The handoff backup belongs to another move.");
			try {
				if (readable && (storage.getItem(key) || null) !== (raw || null)) return fail("storage-changed", "The handoff backup changed. It was not removed.");
				if (readable && raw) { if (storage.removeItem) storage.removeItem(key); else storage.setItem(key, ""); }
			} catch { return fail("storage-unavailable", "The resolved backup could not be removed; inspect it before starting another move."); }
			record = null; raw = null; stored = false; return { ok: true };
		},
		retry() { load(); return persist(); },
	});
}

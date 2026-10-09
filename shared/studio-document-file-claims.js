import { createHash } from "node:crypto";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { studioDocumentMetadataKey } from "./studio-document-hosting.js";
const metadataKeys = buffer => ({ scratchpadKey: studioDocumentMetadataKey(buffer, "scratchpadKey"), reviewNotesKey: studioDocumentMetadataKey(buffer, "reviewNotesKey") });

const fail = (reason, message) => ({ ok: false, reason, message });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hash = text => "sha256:" + createHash("sha256").update(text).digest("hex");

// Successful filesystem writes cannot be rolled back with a recovery transaction.
// Keep a bounded claim until the owning document acknowledges the saved backing,
// or its user explicitly keeps a different backing. This grants no filesystem access.
export function createStudioDocumentFileClaims(options) {
	const records = new Map();
	const now = options.now ?? Date.now;
	const maxRecords = options.maxRecords ?? 128;
	const maxPendingChars = options.maxPendingChars ?? 3_000_000;
	const ttlMs = options.ttlMs ?? 600_000;
	const key = (workspaceId, operationId) => workspaceId + ":" + operationId;
	const pending = () => [...records.values()].filter(r => r.status === "pending");
	const summary = r => ({ operationId: r.operationId, bufferId: r.bufferId, status: r.status,
		path: r.path, label: basename(r.path), resourceDir: dirname(r.path), diskRevision: r.diskRevision, savedText: r.content,
		beforeSourceState: r.beforeSourceState, beforeResourceDir: r.beforeResourceDir,
		beforeDocumentEpoch: r.beforeDocumentEpoch, beforeRevision: r.beforeRevision,
		metadataTransfer: r.metadataTransfer ?? null });
	function finish(record, status) {
		record.status = status; record.finishedAt = now();
		// Terminal retry receipts retain hashes/results, not old document bodies.
		delete record.content; delete record.beforeBaselineText; delete record.beforeSourceState; delete record.beforeResourceDir;
		delete record.beforeMetadataKeys; delete record.metadataTransfer;
		record.chars = 0;
	}
	function sweep() {
		// Every completed save rotates document authority, even for identical bytes.
		// Original requests therefore stay fenced after their terminal receipts expire.
		for (const [id, record] of records) if (record.status !== "pending" && now() - record.finishedAt > ttlMs) records.delete(id);
	}
	function heldFile(path) {
		const canonical = options.canonicalPath(path);
		return pending().find(r => r.fileKey === canonical || options.sameFile?.(r.fileKey, canonical));
	}
	function targetCheck(workspaceId, bufferId, path, inspectOwner = true) {
		const owner = inspectOwner ? options.findFile(path) : null, held = heldFile(path);
		if ((owner && (owner.workspaceId !== workspaceId || owner.bufferId !== bufferId))
			|| (held && (held.workspaceId !== workspaceId || held.bufferId !== bufferId))) {
			return { ...fail("already-open", "This file belongs to another Document or an unacknowledged save. Use that editor or choose another path."),
				owner: owner || { workspaceId: held.workspaceId, bufferId: held.bufferId } };
		}
		return { ok: true };
	}
	function metadataPreview(state, record) {
		const destinationKey = "file:" + record.path, keys = record.beforeMetadataKeys;
		const source = { scratchpadText: state.scratchpadsByDocument[keys.scratchpadKey] || "", reviewNotes: state.reviewNotesByDocument[keys.reviewNotesKey] || [] };
		const destination = { scratchpadText: state.scratchpadsByDocument[destinationKey] || "", reviewNotes: state.reviewNotesByDocument[destinationKey] || [] };
		const conflict = Boolean((destination.scratchpadText && destination.scratchpadText !== source.scratchpadText)
			|| (destination.reviewNotes.length && !same(destination.reviewNotes, source.reviewNotes)));
		return { ok: true, destinationKey, source, conflict,
			metadataRevision: hash(JSON.stringify({ keys, source, destination, labels: [state.scratchpadMetadataByDocument[keys.scratchpadKey], state.scratchpadMetadataByDocument[destinationKey]] })) };
	}
	return Object.freeze({
		ownsMetadataKey(kind, documentKey) {
			const field = kind === "scratchpad" ? "scratchpadKey" : "reviewNotesKey";
			return pending().some(r => r.beforeMetadataKeys[field] === documentKey || "file:" + r.path === documentKey);
		},
		async metadata(capability, request, transact) {
			const check = () => {
				const binding = options.bind(capability, request?.generation); if (!binding.ok) return binding;
				const authority = options.authority(binding.workspaceId, request.bufferId, request.documentEpoch); if (!authority.ok) return authority;
				const record = records.get(key(binding.workspaceId, request.operationId));
				if (!record || record.status !== "pending" || record.bufferId !== request.bufferId) return fail("save-not-found", "Recheck the retained successful save before transferring its metadata.");
				return { ...binding, record };
			};
			const checked = check(); if (!checked.ok) return checked;
			const record = checked.record;
			if (record.metadataTransfer) return !request.choice || (request.choice === record.metadataTransfer.choice && request.metadataRevision === record.metadataTransfer.metadataRevision)
				? { ok: true, prepared: true, ...record.metadataTransfer } : fail("invalid-request", "This retry changed the completed metadata decision. Recheck the retained outcome.");
			if (record.metadataBusy) return fail("metadata-pending", "The saved file's metadata is still being checked. Recheck this same outcome.");
			record.metadataBusy = true;
			try {
				return await transact(state => {
					const current = check();
					if (!current.ok) return { result: current, persist: false };
					if (current.entry.revision !== request.expectedRevision) return { result: fail("conflict", "The Document changed while choosing its saved metadata."), persist: false };
					const preview = metadataPreview(state, record);
					if (!request.choice) return { result: preview, persist: false };
					if (!["carry", "destination"].includes(request.choice)) return { result: fail("invalid-request", "Choose how to attach the saved file's metadata."), persist: false };
					if (request.metadataRevision !== preview.metadataRevision) return { result: fail("metadata-changed", "Source or destination notes changed. Recheck them before choosing; neither copy was replaced."), persist: false };
					if (request.choice === "carry" && preview.conflict) return { result: fail("metadata-conflict", "The destination has different notes. Explicitly use its notes or keep the current backing; neither copy was overwritten."), persist: false };
					let persist = false;
					if (request.choice === "carry") {
						const destination = preview.destinationKey, source = preview.source;
						if (source.scratchpadText && state.scratchpadsByDocument[destination] !== source.scratchpadText) {
							state.scratchpadsByDocument[destination] = source.scratchpadText;
							state.scratchpadMetadataByDocument[destination] = { label: basename(record.path), updatedAt: now() }; persist = true;
						}
						if (source.reviewNotes.length && !same(state.reviewNotesByDocument[destination], source.reviewNotes)) {
							state.reviewNotesByDocument[destination] = source.reviewNotes.map(note => ({ ...note })); persist = true;
						}
					}
					const receipt = { destinationKey: preview.destinationKey, choice: request.choice, metadataRevision: preview.metadataRevision };
					return { result: { ok: true, prepared: true, ...receipt }, persist, committed: () => { record.metadataTransfer = receipt; } };
				});
			} catch { return fail("metadata-failed", "Saved metadata could not be prepared. Current notes and the save claim were kept; recheck before attaching."); }
			finally { record.metadataBusy = false; }
		},
		owner(path) { const held = heldFile(path); return held ? { workspaceId: held.workspaceId, bufferId: held.bufferId } : null; },
		checkUnclaimedFile(path) {
			try {
				const canonical = options.canonicalPath(path), requested = resolve(path);
				if (typeof canonical !== "string" || !isAbsolute(canonical) || canonical.includes("\0")) throw new Error("Invalid canonical identity");
				if (pending().some(r => r.fileKey === requested || r.fileKey === canonical || options.sameFile?.(r.fileKey, canonical))) {
					return fail("document-claimed", "The HTML export target is owned or claimed by a Document; its file and work were kept.");
				}
				return { ok: true };
			} catch { return fail("identity-unknown", "The HTML export target's pending save identity could not be verified; nothing was written."); }
		},
		execute(capability, request, write) {
			sweep();
			const binding = options.bind(capability, request?.generation); if (!binding.ok) return binding;
			const { workspaceId, entry } = binding;
			if (!request || !/^[a-f0-9]{48}$/.test(request.operationId || "") || !["save-as", "save-over"].includes(request.kind)
				|| typeof request.path !== "string" || !request.path || typeof request.content !== "string"
				|| typeof write !== "function") return fail("invalid-request", "A fresh save operation and document identity are required.");
			// The reconnect generation is transport authority, not part of a retry's
			// immutable intent. A new owning connection may inspect an old outcome.
			const intent = { kind: request.kind, path: request.path, content: request.content, bufferId: request.bufferId,
				documentEpoch: request.documentEpoch, expectedRevision: request.expectedRevision,
				expectedDiskRevision: request.expectedDiskRevision ?? null, overwrite: request.overwrite === true, force: request.force === true };
			const intentDigest = hash(JSON.stringify(intent));
			const id = key(workspaceId, request.operationId), previous = records.get(id);
			if (previous) return previous.intentDigest === intentDigest
				? { ...previous.result, claimStatus: previous.status, operationId: previous.operationId, documents: options.documents(workspaceId) }
				: fail("invalid-request", "This retry changed the original save intent.");
			const authority = options.authority(workspaceId, request.bufferId, request.documentEpoch); if (!authority.ok) return authority;
			if (!entry || entry.revision !== request.expectedRevision) return fail("conflict", "The initiating recovery checkpoint changed; nothing was saved.");
			if (pending().some(r => r.workspaceId === workspaceId && r.bufferId === request.bufferId)) return fail("save-ack-pending", "Resolve this Document's previous save before writing again.");
			const before = entry.state.buffers.find(b => b.id === request.bufferId);
			if (!before) return fail("not-owner", "This workspace no longer owns the Document.");
			const chars = request.content.length + (before.baselineText?.length || 0);
			if (records.size >= maxRecords) for (const [id, record] of records) {
				if (record.status !== "pending") records.delete(id);
				if (records.size < maxRecords) break;
			}
			// Reserve bounded capacity BEFORE performing irreversible I/O. No awaits
			// or other workspace mutations may occur inside the trusted writer.
			if (records.size >= maxRecords || pending().reduce((sum, r) => sum + r.chars, chars) > maxPendingChars) return fail("capacity", "Save acknowledgement capacity is full. Resolve existing saves first; no file was written.");
			let authorizedPath = null, authorizedKey = null;
			const authorizeCommit = path => {
				const current = options.authority(workspaceId, request.bufferId, request.documentEpoch); if (!current.ok) return current;
				if (request.kind === "save-over") { const check = options.checkWrite(workspaceId, request.bufferId, path); if (!check.ok) return check; }
				try {
					const available = targetCheck(workspaceId, request.bufferId, path); if (!available.ok) return available;
					authorizedKey = options.canonicalPath(path); authorizedPath = path; return { ok: true };
				} catch { return fail("invalid-path", "The save target's identity could not be checked."); }
			};
			const result = write(authorizeCommit);
			if (!result || result.ok !== true) return result || fail("write-failed", "The writer did not report a save outcome.");
			if (!authorizedPath) throw new Error("Hosted writer omitted synchronous canonical-target authorization");
			const path = authorizedPath, fileKey = authorizedKey, diskRevision = hash(request.content);
			// No second request can run between the synchronous disk write, authority
			// rotation and claim insertion. Rotation also fences same-byte save replays.
			options.advanceAuthority(workspaceId, request.bufferId);
			records.set(id, { workspaceId, operationId: request.operationId, bufferId: request.bufferId, intentDigest,
				beforeDocumentEpoch: request.documentEpoch, beforeRevision: request.expectedRevision,
				status: "pending", path, fileKey, diskRevision, content: request.content, chars,
				beforeSourceState: before.sourceState, beforeResourceDir: before.resourceDir, beforeBaselineText: before.baselineText, beforeDiskRevision: before.diskRevision,
				beforeMetadataKeys: metadataKeys(before),
				result });
			return { ...result, operationId: request.operationId, claimStatus: "pending", documents: options.documents(workspaceId) };
		},
		checkCheckpoint(workspaceId, state) {
			const acknowledgements = [];
			if (!pending().length) return { ok: true, acknowledgements };
			try {
				for (const buffer of state.buffers) if (buffer.sourceState.path) {
					const available = targetCheck(workspaceId, buffer.id, buffer.sourceState.path, false); if (!available.ok) return available;
				}
				for (const record of pending().filter(r => r.workspaceId === workspaceId)) {
					const buffer = state.buffers.find(b => b.id === record.bufferId);
					if (!buffer) return fail("save-ack-pending", "A saved Document cannot be removed before its save is acknowledged or explicitly discarded.");
					if (buffer.sourceState.source === "file" && buffer.sourceState.path === record.path
						&& buffer.diskRevision === record.diskRevision && buffer.baselineText === record.content
						&& buffer.resourceDir === dirname(record.path) && options.canonicalPath(record.path) === record.fileKey) {
						if (record.metadataBusy) return fail("metadata-pending", "Metadata preparation must finish before attaching the saved backing.");
						if (record.beforeSourceState.path !== record.path) {
							const destination = record.metadataTransfer?.destinationKey;
							if (!destination || !Object.values(metadataKeys(buffer)).every(key => key === destination)) return fail("metadata-decision-required", "Prepare both metadata associations before attaching this saved backing.");
						} else if (!same(metadataKeys(buffer), record.beforeMetadataKeys)) return fail("metadata-decision-required", "Keep this saved Document's metadata associations unchanged.");
						acknowledgements.push(key(workspaceId, record.operationId));
					} else if (!same(metadataKeys(buffer), record.beforeMetadataKeys) || !same(buffer.sourceState, record.beforeSourceState) || buffer.resourceDir !== record.beforeResourceDir
						|| buffer.diskRevision !== record.beforeDiskRevision || buffer.baselineText !== record.beforeBaselineText) return fail("save-ack-pending", "Resolve the successful save before changing this Document's backing. Current text was retained.");
				}
			} catch { return fail("invalid-path", "The saved file identity could not be checked; its claim was retained."); }
			return { ok: true, acknowledgements };
		},
		commitCheckpoint(plan) {
			for (const id of plan.acknowledgements || []) {
				const record = records.get(id); if (record?.status === "pending") finish(record, "acknowledged");
			}
		},
		guardMove(workspaceId, bufferId) {
			return pending().some(r => r.workspaceId === workspaceId && r.bufferId === bufferId)
				? fail("save-ack-pending", "Resolve this Document's successful save before moving or replacing it.") : { ok: true };
		},
		list(workspaceId) { return pending().filter(r => r.workspaceId === workspaceId).map(summary); },
		hasPending(workspaceId) { return pending().some(r => r.workspaceId === workspaceId); },
		discard(workspaceId, operationId, bufferId, confirmed) {
			const record = records.get(key(workspaceId, operationId));
			if (!confirmed || !record || record.bufferId !== bufferId) return fail("confirmation-required", "Explicitly confirm keeping this Document's current backing. The saved disk file will not be deleted.");
			if (record.metadataBusy) return fail("metadata-pending", "Finish checking the saved metadata before keeping another backing.");
			finish(record, "discarded"); return { ok: true };
		},
		clear() { records.clear(); },
	});
}

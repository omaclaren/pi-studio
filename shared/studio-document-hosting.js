// Process-scoped document ownership, not durable storage or filesystem authority.
// The adapter must authenticate workspace IDs and supply a trusted canonical
// identity resolver. These claims do not authorize filesystem reads or writes.
// Checkpoint/move commits are synchronous compare-and-swap.
import { createStudioBuffer, validateStudioBufferWorkspace } from "./studio-buffer-store.js";

const fail = (reason, message, extra = {}) => ({ ok: false, reason, message, ...extra });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function studioDocumentMetadataKey(entry, field) {
	if (entry.metadata[field] !== null) return entry.metadata[field];
	const source = entry.sourceState;
	if (source.path) return "file:" + source.path;
	if (source.draftId) return "draft:" + source.draftId;
	const kind = source.source || "blank", label = (source.label || "blank").trim().replace(/\s+/g, " ") || kind;
	return "doc:" + kind + ":" + label;
}
export function studioDocumentAuthorityIdentity(entry) {
	return entry ? [entry.sourceState, entry.resourceDir, studioDocumentMetadataKey(entry, "reviewNotesKey"), studioDocumentMetadataKey(entry, "scratchpadKey")] : null;
}

export function isStudioPristineBuffer(entry) {
	return entry.text === "" && entry.baselineText === "" && entry.sourceState.path === null
		&& entry.sourceState.source === "blank" && ["", "Prompt", "Untitled", "Document"].includes(entry.sourceState.label)
		&& entry.resourceDir === "" && entry.metadata.reviewNotesKey === null && entry.metadata.scratchpadKey === null;
}
export const isStudioPristineWorkspace = state => state.buffers.every(isStudioPristineBuffer);

export function createStudioDocumentCopy(entry, id) {
	return createStudioBuffer({ ...entry, id, role: "document", revision: 0, baselineText: "", diskRevision: null,
		sourceState: { source: "blank", label: "Copy of " + (entry.sourceState.label || "document"), path: null, draftId: id,
			...(entry.sourceState.provenance ? { provenance: entry.sourceState.provenance } : {}) },
		metadata: { ...entry.metadata, reviewNotesKey: null, scratchpadKey: null } });
}

export function createStudioDocumentHostingStore(options) {
	const { makeId, canonicalPath } = options;
	const now = options.now ?? Date.now;
	const maxDocuments = options.maxDocuments ?? 256, maxMoves = options.maxMoves ?? 128;
	const offerLifetimeMs = options.offerLifetimeMs ?? 120_000;
	const terminalLifetimeMs = options.terminalLifetimeMs ?? 600_000;
	const workspaces = new Map(), owners = new Map(), paths = new Map(), retired = new Set(), moves = new Map(), pending = new Map();
	let nextDocumentEpoch = 0;
	const ownerInfo = owner => owner ? { workspaceId: owner.workspaceId, bufferId: owner.bufferId, mode: owner.mode } : null;
	function expireOffers() {
		for (const move of moves.values()) if (move.status === "offered" && now() >= move.expiresAt) cancel(move, "expired");
		for (const [id, move] of moves) if (move.status !== "offered" && now() - move.terminalAt >= terminalLifetimeMs) moves.delete(id);
	}
	function makeMoveRoom() {
		// Terminal operations advanced the source workspace revision. Forgetting
		// their explanation cannot make an original delayed Begin current again.
		for (const [id, move] of moves) {
			if (moves.size < maxMoves) break;
			if (move.status !== "offered") moves.delete(id);
		}
	}
	function cancel(move, reason) {
		if (move.status !== "offered") return outcome(move);
		const before = workspaces.get(move.sourceWorkspaceId);
		if (!before) return fail("missing-workspace", "The source workspace is unavailable.");
		const after = { ...before, revision: before.revision + 1, savedAt: Math.max(now(), before.savedAt + 1) };
		const planned = plan([after], move.id); if (!planned.ok) return planned;
		if (options.commitMove) {
			const stored = options.commitMove({ before: [before], after: planned.states, kind: "cancel", move: outcome(move) });
			if (!stored?.ok) return stored || fail("unavailable", "Cancellation could not be checkpointed; keep the editor frozen.");
		}
		commit(planned); move.status = "cancelled"; move.reason = reason; move.terminalAt = now();
		if (pending.get(move.sourceWorkspaceId) === move.id) pending.delete(move.sourceWorkspaceId);
		delete move.source;
		return outcome(move);
	}
	function outcome(move) {
		return { ok: true, moveId: move.id, status: move.status, bufferId: move.bufferId,
			sourceWorkspaceId: move.sourceWorkspaceId, targetWorkspaceId: move.targetWorkspaceId ?? null,
			...(move.reason ? { reason: move.reason } : {}), ...(move.adopted ? { adopted: true } : {}) };
	}
	function plan(states, movingId = null) {
		const checked = [], ids = new Set();
		for (const value of states) {
			const result = validateStudioBufferWorkspace(value); if (!result.ok) return result;
			const state = result.state;
			if (ids.has(state.workspaceId)) return fail("duplicate-workspace", "One checkpoint per workspace is required.");
			ids.add(state.workspaceId);
			const before = workspaces.get(state.workspaceId);
			if (before && !same(before, state) && (before.mode !== state.mode || state.revision <= before.revision || state.savedAt < before.savedAt)) {
				return fail("stale-workspace", "The workspace changed. Keep current text and retry explicitly.");
			}
			const held = pending.get(state.workspaceId);
			if (held && held !== movingId) return fail("move-pending", "Finish or cancel the document move before changing this workspace.");
			checked.push(state);
		}
		const nextOwners = new Map(owners), nextPaths = new Map(paths), nextRetired = new Set(retired);
		const previouslyOwned = new Set();
		for (const [id, owner] of owners) if (ids.has(owner.workspaceId)) {
			previouslyOwned.add(id); nextOwners.delete(id); if (owner.path) nextPaths.delete(owner.path);
		}
		const added = new Set();
		for (const state of checked) for (const entry of state.buffers) {
			if (added.has(entry.id)) return fail("duplicate-document", "A document cannot have two editing locations.");
			added.add(entry.id);
			const existing = owners.get(entry.id);
			if (retired.has(entry.id)) return fail("retired-document", "That document identity was retired. Recover its text as an explicit new copy.");
			if (existing && existing.workspaceId !== state.workspaceId && (!movingId || moves.get(movingId)?.bufferId !== entry.id)) {
				return fail("already-open", "This document already has an editing location.", { owner: ownerInfo(existing) });
			}
			let path = null;
			const previous = existing && workspaces.get(existing.workspaceId)?.buffers.find(b => b.id === entry.id);
			// Capture file identity when backing changes, not on every keystroke or
			// move. A retargeted/broken symlink must not silently rebind this draft.
			try { if (entry.sourceState.path) path = previous?.sourceState.path === entry.sourceState.path ? existing.path : canonicalPath(entry.sourceState.path); }
			catch { return fail("invalid-path", "The document's canonical file identity could not be checked."); }
			if (path !== null && (typeof path !== "string" || !path || path.includes("\0"))) return fail("invalid-path", "Invalid canonical document path.");
			let otherId = path && nextPaths.get(path);
			if (path && !otherId && options.sameFile) {
				try { otherId = [...nextOwners.values()].find(owner => owner.path && options.sameFile(path, owner.path))?.bufferId; }
				catch { return fail("invalid-path", "The document's file aliases could not be checked."); }
			}
			if (otherId && otherId !== entry.id) return fail("already-open", "This file is already open. Use its existing editor, move it, or make a detached copy.", { owner: ownerInfo(nextOwners.get(otherId)) });
			const epoch = existing?.workspaceId === state.workspaceId && same(studioDocumentAuthorityIdentity(previous), studioDocumentAuthorityIdentity(entry))
				? existing.epoch : ++nextDocumentEpoch;
			const owner = { workspaceId: state.workspaceId, bufferId: entry.id, mode: state.mode, path, epoch };
			nextOwners.set(entry.id, owner); if (path) nextPaths.set(path, entry.id);
		}
		for (const id of previouslyOwned) if (!added.has(id)) {
			const owner = owners.get(id), entry = workspaces.get(owner.workspaceId).buffers.find(b => b.id === id);
			if (!isStudioPristineBuffer(entry)) nextRetired.add(id);
		}
		if (nextOwners.size + nextRetired.size > maxDocuments) return fail("capacity", "Document ownership capacity reached. No document was evicted.");
		return { ok: true, states: checked, owners: nextOwners, paths: nextPaths, retired: nextRetired };
	}
	function commit(planned) {
		for (const state of planned.states) workspaces.set(state.workspaceId, state);
		owners.clear(); for (const [key, value] of planned.owners) owners.set(key, value);
		paths.clear(); for (const [key, value] of planned.paths) paths.set(key, value);
		retired.clear(); for (const key of planned.retired) retired.add(key);
	}
	const replaceSlot = (state, id, replacement) => ({ ...state, revision: state.revision + 1, savedAt: Math.max(now(), state.savedAt + 1),
		selectedBufferId: state.selectedBufferId === id ? replacement.id : state.selectedBufferId,
		order: state.order.map(value => value === id ? replacement.id : value), buffers: state.buffers.map(value => value.id === id ? replacement : value) });
	const api = {
		sweep() { expireOffers(); },
		hasPending: workspaceId => pending.has(workspaceId),
		pendingMoves: workspaceId => [...moves.values()].filter(m => m.status === "offered" && (m.sourceWorkspaceId === workspaceId || m.targetWorkspaceId === workspaceId)).map(outcome),
		cancelPending(workspaceId) {
			const move = moves.get(pending.get(workspaceId));
			return move ? cancel(move, "connection-closed") : { ok: true };
		},
		reclaimPristine(workspaceId) {
			const state = workspaces.get(workspaceId);
			if (!state || pending.has(workspaceId) || [...moves.values()].some(m => m.status === "offered" && m.targetWorkspaceId === workspaceId)
				|| !isStudioPristineWorkspace(state)) return false;
			for (const entry of state.buffers) owners.delete(entry.id);
			workspaces.delete(workspaceId);
			return true;
		},
		checkpoint(state) {
			expireOffers();
			const before = workspaces.get(state?.workspaceId);
			if (before && same(before, state)) return { ok: true }; // Exact acknowledgement retry, including while frozen.
			const planned = plan([state]); if (!planned.ok) return planned;
			commit(planned); return { ok: true };
		},
		workspace: id => workspaces.get(id) ?? null,
		owner: id => ownerInfo(owners.get(id)),
		documentAuthorities(workspaceId) {
			return Object.fromEntries([...owners].filter(([, owner]) => owner.workspaceId === workspaceId).map(([id, owner]) => [id, owner.epoch]));
		},
		// Trusted synchronous file-commit hook. Even a same-byte save retires its
		// original mutation authority, so terminal save receipts can be reclaimed.
		advanceAuthority(workspaceId, bufferId) {
			const owner = owners.get(bufferId);
			if (!owner || owner.workspaceId !== workspaceId) throw new Error("Cannot advance an unowned Document");
			owner.epoch = ++nextDocumentEpoch;
			return owner.epoch;
		},
		checkAuthority(workspaceId, bufferId, epoch) {
			const owner = owners.get(bufferId);
			if (!owner || owner.workspaceId !== workspaceId) return fail("not-owner", "This editing location no longer owns the document.");
			if (epoch !== owner.epoch) return fail("document-stale", "This request belongs to an earlier document ownership or source generation.");
			if (moves.get(pending.get(workspaceId))?.bufferId === bufferId) return fail("move-pending", "The moving document is frozen.");
			return { ok: true };
		},
		findFile(path) {
			try {
				const canonical = canonicalPath(path);
				return ownerInfo(owners.get(paths.get(canonical)) || (options.sameFile
					? [...owners.values()].find(owner => owner.path && options.sameFile(canonical, owner.path)) : null));
			} catch { return null; }
		},
		// Trusted external writers may inspect coordination, not acquire ownership,
		// file grants or editor authority. Unlike findFile, uncertainty is refusal.
		checkUnownedFile(path) {
			try {
				// The server supplies a normalized absolute target. Keep this shared
				// identity module browser-loadable (Document clients import it too).
				const canonical = canonicalPath(path);
				if (typeof canonical !== "string" || !canonical || canonical.includes("\0")) throw new Error("Invalid canonical identity");
				if ([...owners.values()].some(owner => owner.path && (owner.path === path || owner.path === canonical
					|| options.sameFile?.(canonical, owner.path)))) return fail("document-owned", "The HTML export target is owned or claimed by a Document; its file and work were kept.");
				return { ok: true };
			} catch { return fail("identity-unknown", "The HTML export target's Document identity could not be verified; nothing was written."); }
		},
		checkWrite(workspaceId, bufferId, path) {
			expireOffers();
			const owner = owners.get(bufferId), entry = workspaces.get(workspaceId)?.buffers.find(b => b.id === bufferId);
			if (!owner || owner.workspaceId !== workspaceId || !entry) return fail("not-owner", "This page no longer owns that document.");
			if (pending.has(workspaceId)) return fail("move-pending", "Resolve the pending move before writing a file.");
			if (!owner.path || !entry.sourceState.path) return fail("not-file-backed", "Use Save As for a detached document.");
			try {
				if (canonicalPath(path) !== owner.path || canonicalPath(entry.sourceState.path) !== owner.path) return fail("source-changed", "The file location changed. Refresh explicitly or use Save As; nothing was written.");
			} catch { return fail("source-changed", "The file identity could not be checked; nothing was written."); }
			// Coordination only: the caller must still check disk revision and all
			// ordinary filesystem authorization immediately before the actual write.
			return { ok: true };
		},
		beginMove({ workspaceId, expectedRevision, bufferId, targetWorkspaceId = null, targetMode = "editor-only", moveId = null, kind = "offer" }) {
			expireOffers();
			if (moveId !== null && (typeof moveId !== "string" || !/^[a-f0-9]{48}$/.test(moveId))) return fail("invalid-move", "Invalid move request identity.");
			const intent = { bufferId, expectedRevision, targetWorkspaceId, targetMode, kind };
			const retry = moveId && moves.get(moveId);
			if (retry) {
				if (retry.sourceWorkspaceId !== workspaceId) return fail("forbidden", "Move identity belongs to another workspace.");
				if (retry.intent && !same(retry.intent, intent)) return fail("invalid-move", "A move identity cannot be reused for different parameters.");
				return outcome(retry);
			}
			const source = workspaces.get(workspaceId), entry = source?.buffers.find(b => b.id === bufferId);
			if (!source || source.revision !== expectedRevision || source.selectedBufferId !== bufferId) return fail("stale-workspace", "The originating editor changed. Nothing was moved.");
			if (entry?.role !== "document") return fail("not-document", "Move Document, not the active Prompt. Make a detached copy of Prompt instead.");
			if (!["full", "editor-only"].includes(targetMode) || targetWorkspaceId === workspaceId || (targetMode === "full" && !targetWorkspaceId)
				|| (targetWorkspaceId !== null && (typeof targetWorkspaceId !== "string" || !/^[a-zA-Z0-9_-]{20,128}$/.test(targetWorkspaceId)))) return fail("invalid-target", "Choose a separate document editing location.");
			if (pending.has(workspaceId)) return fail("move-pending", "This workspace already has a pending move.");
			makeMoveRoom();
			if (moves.size >= maxMoves) return fail("capacity", "Too many unresolved moves; current documents were kept.");
			const id = moveId ?? makeId(); if (moves.has(id)) return fail("duplicate-id", "Move identity could not be allocated.");
			const move = { id, sourceWorkspaceId: workspaceId, source, bufferId, targetWorkspaceId, targetMode, intent, status: "offered", expiresAt: now() + offerLifetimeMs };
			moves.set(id, move); pending.set(workspaceId, id);
			return { ...outcome(move), expiresAt: move.expiresAt };
		},
		moveOut({ workspaceId, expectedRevision, bufferId, moveId, destinationId }) {
			if (workspaces.get(workspaceId)?.mode !== "full") return fail("wrong-mode", "Move out starts from Studio's Document slot.");
			if (moves.get(moveId)?.status !== "offered" && moves.has(moveId)) return api.beginMove({ workspaceId, expectedRevision, bufferId, moveId, kind: "move-out" });
			if (typeof destinationId !== "string" || !/^[a-zA-Z0-9_-]{20,128}$/.test(destinationId) || workspaces.has(destinationId)) return fail("invalid-target", "A fresh server-created destination is required.");
			const started = api.beginMove({ workspaceId, expectedRevision, bufferId, moveId, kind: "move-out" });
			if (!started.ok || started.status !== "offered") return started;
			const move = moves.get(moveId), source = workspaces.get(workspaceId), entry = source.buffers.find(b => b.id === bufferId);
			const nextSource = replaceSlot(source, bufferId, createStudioBuffer({ id: makeId(), role: "document" }));
			const destination = { version: 2, workspaceId: destinationId, mode: "editor-only", revision: 1, savedAt: now(),
				activePromptId: null, selectedBufferId: bufferId, order: [bufferId], buffers: [entry] };
			const planned = plan([nextSource, destination], moveId); if (!planned.ok) return planned;
			if (options.commitMove) {
				const stored = options.commitMove({ before: [source, null], after: planned.states, kind: "move-out",
					move: { ...outcome(move), targetWorkspaceId: destinationId } });
				if (!stored?.ok) return stored || fail("unavailable", "Move could not be checkpointed; the source was retained.");
			}
			commit(planned); move.status = "committed"; move.targetWorkspaceId = destinationId; move.terminalAt = now();
			pending.delete(workspaceId); delete move.source; return outcome(move);
		},
		moveStatus(workspaceId, moveId, incoming = false) {
			expireOffers(); const move = moves.get(moveId);
			if (!move || (!incoming && move.sourceWorkspaceId !== workspaceId && move.targetWorkspaceId !== workspaceId)) return fail("forbidden", "Move does not belong to this workspace.");
			return outcome(move);
		},
		declineMove(workspaceId, moveId) {
			expireOffers(); const move = moves.get(moveId);
			if (!move || move.targetWorkspaceId !== workspaceId) return fail("forbidden", "Only the bound destination can decline this move.");
			return cancel(move, "declined");
		},
		adoptMove(workspaceId, moveId, bufferId) {
			const move = moves.get(moveId);
			if (!move || move.status !== "committed" || move.targetWorkspaceId !== workspaceId || move.bufferId !== bufferId
				|| owners.get(bufferId)?.workspaceId !== workspaceId) return fail("not-owner", "Only the moved document's current destination can acknowledge adoption.");
			move.adopted = true; return outcome(move);
		},
		cancelMove(workspaceId, moveId) {
			expireOffers(); let move = moves.get(moveId);
			if (!move && workspaces.has(workspaceId) && typeof moveId === "string" && /^[a-f0-9]{48}$/.test(moveId)) {
				// Cancel may overtake an uncertain Begin request. Retain a tombstone so
				// that late delivery can never re-freeze or move the resumed editor.
				makeMoveRoom();
				if (moves.size >= maxMoves) return fail("capacity", "Cancellation could not be recorded. Keep the editor frozen and retry.");
				move = { id: moveId, sourceWorkspaceId: workspaceId, bufferId: null, status: "offered" };
				const cancelled = cancel(move, "cancelled"); if (!cancelled.ok) return cancelled;
				moves.set(moveId, move);
			}
			if (!move || move.sourceWorkspaceId !== workspaceId) return fail("forbidden", "Only the originating workspace can cancel this move.");
			return cancel(move, "cancelled"); // A late Cancel cannot roll back a transfer.
		},
		acceptMove({ workspaceId, expectedRevision, targetBufferId, moveId, discardTarget = false }) {
			expireOffers(); const move = moves.get(moveId);
			if (!move) return fail("invalid-move", "Move is unavailable; the original editor was kept.");
			if (move.targetWorkspaceId && move.targetWorkspaceId !== workspaceId) return fail("forbidden", "This move is for another workspace.");
			if (move.status === "cancelled") return fail("cancelled", "Move was cancelled; the original editor was kept.");
			if (move.status === "committed") return outcome(move); // Lost acknowledgement: never apply twice.
			const target = workspaces.get(workspaceId), source = workspaces.get(move.sourceWorkspaceId);
			if (source !== move.source || target?.revision !== expectedRevision || target?.mode !== move.targetMode || target.workspaceId === source.workspaceId) return fail("stale-workspace", "A participating workspace changed. Nothing was moved.");
			const placeholder = target.buffers.find(b => b.id === targetBufferId);
			if (placeholder?.role !== "document") return fail("invalid-target", "Only a Document slot can receive a moved document.");
			if (discardTarget !== true && (placeholder.sourceState.path || placeholder.text || placeholder.baselineText !== ""
				|| placeholder.metadata.reviewNotesKey || placeholder.metadata.scratchpadKey)) return fail("target-not-empty", "The destination may contain work. Save/copy it or explicitly confirm replacement before moving here.");
			if (pending.has(workspaceId)) return fail("move-pending", "The destination is participating in another move.");
			const entry = source.buffers.find(b => b.id === move.bufferId);
			const blank = createStudioBuffer({ id: makeId(), role: "document" });
			const nextSource = replaceSlot(source, entry.id, blank), nextTarget = replaceSlot(target, placeholder.id, entry);
			const planned = plan([nextSource, nextTarget], move.id); if (!planned.ok) return planned;
			// The adapter can atomically checkpoint both recovery workspaces here.
			// No registry ownership is changed if capacity/CAS/storage validation fails.
			if (options.commitMove) {
				const stored = options.commitMove({ before: [source, target], after: planned.states, kind: "move", move: { ...outcome(move), targetWorkspaceId: workspaceId } });
				if (!stored?.ok) return stored || fail("unavailable", "Move could not be checkpointed. Original editors were kept.");
			}
			commit(planned); move.status = "committed"; move.targetWorkspaceId = workspaceId; move.terminalAt = now();
			pending.delete(source.workspaceId); delete move.source;
			return outcome(move);
		},
		clear() { workspaces.clear(); owners.clear(); paths.clear(); retired.clear(); moves.clear(); pending.clear(); },
	};
	return Object.freeze(api);
}

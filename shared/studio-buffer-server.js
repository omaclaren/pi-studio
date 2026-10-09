import { createHash, randomBytes } from "node:crypto";
import { basename, isAbsolute, resolve } from "node:path";
import { createStudioBuffer, STUDIO_BUFFER_LIMITS } from "./studio-buffer-store.js";
import { encodeStudioBufferRecovery, migrateStudioWorkspaceV1 } from "./studio-buffer-recovery.js";
import { createStudioDocumentHostingStore, createStudioDocumentCopy, isStudioPristineWorkspace, studioDocumentAuthorityIdentity, studioDocumentMetadataKey } from "./studio-document-hosting.js";
import { createStudioDocumentFileClaims } from "./studio-document-file-claims.js";

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
	const entries = new Map(), capabilities = new Map(), hostingViews = new Map(), metadataWrites = new Map(), seenHostingViews = new Set(), copyReceipts = new Map(), launchReceipts = new Map(), openReceipts = new Map();
	let nextViewGeneration = 0;
	const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
	const hosting = options.hosting ? createStudioDocumentHostingStore({ ...options.hosting, now,
		makeId: options.hosting.makeId ?? token,
		commitMove({ before, after, kind = "move", move }) {
			// Validate the complete two-workspace transaction before touching either
			// recovery record. No await or external I/O can split the commit.
			const replacements = [];
			for (let i = 0; i < before.length; i++) {
				const old = before[i], binding = old || after[i], previous = entries.get(binding.workspaceId);
				if (old) {
					for (const buffer of old.buffers) if (!after[i].buffers.some(b => b.id === buffer.id)) {
						const guarded = documentIdle(old.workspaceId, buffer.id); if (!guarded.ok) return guarded;
					}
					const expected = encodeStudioBufferRecovery(old, old);
					if (!previous || !expected.ok || previous.raw !== expected.raw) return fail("conflict", "Recovery changed during the move. Both editors were kept.");
				} else if (previous) return fail("conflict", "The new destination is already in use.");
				const conflict = kind === "cancel" ? null : legacyConflict(binding, previous?.state || after[i]); if (conflict) return conflict;
				const encoded = encodeStudioBufferRecovery(after[i], binding); if (!encoded.ok) return encoded;
				const chars = encoded.state.buffers.reduce((sum, b) => sum + b.text.length + (b.baselineText?.length || 0), 0);
				const revision = token();
				const removed = old?.buffers.find(b => !encoded.state.buffers.some(n => n.id === b.id));
				const added = encoded.state.buffers.find(b => !old?.buffers.some(n => n.id === b.id));
				const receipt = { kind, move: { ...move, status: kind === "cancel" ? "cancelled" : "committed" }, fromRevision: previous?.revision ?? null, toRevision: revision,
					fromWorkspaceRevision: old?.revision ?? 0, toWorkspaceRevision: encoded.state.revision,
					fromDigest: digest(old), toDigest: digest(encoded.state),
					beforeOrder: old?.order ?? [], beforeSelected: old?.selectedBufferId ?? null, beforePromptId: old?.activePromptId ?? null,
					...(removed && added ? { slot: { beforeId: removed.id, beforeDigest: digest(removed), afterId: added.id },
						unchanged: Object.fromEntries(old.buffers.filter(b => b.id !== removed.id).map(b => [b.id, digest(b)])) } : {}) };
				replacements.push({ key: binding.workspaceId, value: { state: encoded.state, raw: encoded.raw, chars, revision,
					lineage: [...(previous?.lineage || []), receipt].slice(-16), touchedAt: now() } });
			}
			const replacing = new Set(replacements.map(r => r.key));
			const total = [...entries].reduce((sum, [key, entry]) => sum + (replacing.has(key) ? 0 : entry.chars), 0)
				+ replacements.reduce((sum, r) => sum + r.value.chars, 0);
			if (total > maxTotalTextChars || entries.size + replacements.filter(r => !entries.has(r.key)).length > maxEntries) return fail("capacity", "Server recovery cannot hold the moved document. Nothing was evicted.");
			for (const { key, value } of replacements) entries.set(key, value);
			return { ok: true };
		},
	}) : null;
	const fileClaims = hosting ? createStudioDocumentFileClaims({ now,
		canonicalPath: options.hosting.canonicalPath ?? (path => path), sameFile: options.hosting.sameFile,
		bind: fileBinding, authority: hosting.checkAuthority, checkWrite: hosting.checkWrite,
		findFile: hosting.findFile, documents: hosting.documentAuthorities, advanceAuthority: hosting.advanceAuthority,
	}) : null;
	function fileBinding(capability, generation) {
		const binding = scope(capability);
		if (!hosting || !binding) return fail("forbidden", "The owning editing page is required.");
		const error = hostingViewError(capability, binding, generation); if (error) return error;
		const entry = entries.get(binding.workspaceId);
		if (!entry || entry.state.mode !== binding.mode) return fail("not-ready", "A current Document checkpoint is required.");
		const conflict = legacyConflict(binding, entry.state); if (conflict) return conflict;
		return { ok: true, workspaceId: binding.workspaceId, entry };
	}
	function documentIdle(workspaceId, bufferId) {
		if (metadataWrites.get(workspaceId + ":" + bufferId)?.size) return fail("metadata-pending", "Wait for this Document's comments and scratchpad to finish saving.");
		return fileClaims.guardMove(workspaceId, bufferId);
	}
	function cleanup() {
		const time = now();
		hosting?.sweep();
		for (const [key, entry] of entries) if (time - entry.touchedAt > ttlMs) {
			if (!hosting) entries.delete(key);
			else reclaim(key, entry);
		}
		for (const [key, entry] of capabilities) if (time - entry.touchedAt > ttlMs) capabilities.delete(key);
	}
	function reclaim(key, entry) {
		if (hostingViews.has(key) || entry.state.buffers.some(b => metadataWrites.get(key + ":" + b.id)?.size) || fileClaims?.hasPending(key) || !isStudioPristineWorkspace(entry.state) || !hosting.reclaimPristine(key)) return false;
		entries.delete(key); seenHostingViews.delete(key);
		for (const [capability, value] of capabilities) if (value.workspaceId === key) capabilities.delete(capability);
		return true;
	}
	function scope(capability) {
		cleanup();
		const entry = capabilities.get(capability);
		if (!entry) return null;
		entry.touchedAt = now();
		return entry;
	}
	function hostingViewError(capability, binding, generation) {
		if (!options.hosting?.requireView) return null;
		const view = hostingViews.get(binding.workspaceId);
		if (!view || view.capability !== capability) return fail("view-not-ready", "Connect the owning editing view first.");
		return view.generation === generation ? null : fail("lease-stale", "This request belongs to an obsolete editing connection.");
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
		// Trusted terminal bootstrap only; never exposed as an HTTP operation.
		// Register before returning a URL, including when browser opening fails.
		hostingBootstrap(request, loadDocument) {
			cleanup();
			if (!hosting || typeof loadDocument !== "function") return fail("forbidden", "A trusted Studio launch is required.");
			let canonical = null;
			try { if (request.path) canonical = options.hosting.canonicalPath(request.path); }
			catch { return fail("source-changed", "The requested file location could not be checked."); }
			const findOwner = () => canonical ? (() => { const saved = fileClaims.owner(canonical); return saved ? hosting.owner(saved.bufferId) : hosting.findFile(canonical); })() : null;
			let owner = findOwner(); if (owner) return { ok: true, status: "reused", owner };
			if (entries.size >= maxEntries) return fail("capacity", "Server recovery is full. Existing work was kept.");
			let loaded;
			try { loaded = loadDocument(canonical); } catch { return fail("read-failed", "The initial document could not be read. Nothing was registered."); }
			if (loaded?.then) return fail("invalid-request", "Bootstrap requires a synchronous authorized snapshot.");
			if (!loaded?.ok) return loaded || fail("read-failed", "No initial document was supplied.");
			const document = loaded.document;
			if (!document || document.watchFile || !["file", "blank", "last-response"].includes(document.source)) return fail("invalid-request", "Only an editable initial document can be registered here.");
			try {
				if (canonical ? document.source !== "file" || document.path !== canonical || options.hosting.canonicalPath(request.path) !== canonical
					: document.source === "file" || document.path) return fail("source-changed", "The authorized file snapshot changed location.");
			} catch { return fail("source-changed", "The authorized file location could not be checked again."); }
			owner = findOwner(); if (owner) return { ok: true, status: "reused", owner };
			let state;
			try {
				const prompt = createStudioBuffer({ id: "prompt_" + token(), role: "prompt", text: document.text,
					baselineText: canonical ? document.text : "", diskRevision: canonical ? document.diskRevision : null,
					sourceState: { source: document.source, label: document.label, path: canonical, ...(document.draftId && !canonical ? { draftId: document.draftId } : {}) },
					resourceDir: document.resourceDir || "", view: { editorLanguage: loaded.editorLanguage || "markdown", followLatest: true } });
				const placeholder = createStudioBuffer({ id: "document_" + token(), role: "document", sourceState: { label: "Document" }, resourceDir: document.resourceDir || "" });
				state = { version: 2, workspaceId: "host_" + token(), mode: "full", revision: 1, savedAt: now(),
					selectedBufferId: prompt.id, activePromptId: prompt.id, order: [prompt.id, placeholder.id], buffers: [prompt, placeholder] };
			} catch { return fail("invalid-state", "The initial document cannot be represented safely. Nothing was registered."); }
			const encoded = encodeStudioBufferRecovery(state, state); if (!encoded.ok) return encoded;
			const chars = encoded.state.buffers.reduce((n, b) => n + b.text.length + (b.baselineText?.length || 0), 0);
			if (entries.size >= maxEntries || [...entries.values()].reduce((n, e) => n + e.chars, chars) > maxTotalTextChars) return fail("capacity", "Server recovery cannot hold this document. Existing work was kept.");
			const checked = hosting.checkpoint(encoded.state); if (!checked.ok) return checked;
			entries.set(state.workspaceId, { state: encoded.state, raw: encoded.raw, chars, revision: token(), lineage: [], touchedAt: now() });
			return { ok: true, status: "created", owner: hosting.owner(state.activePromptId), document };
		},
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
			return { ok: true, state: entry.state, revision: entry.revision, expiresInMs: ttlMs, ...(hosting ? { lineage: entry.lineage || [], pendingMoves: hosting.pendingMoves(binding.workspaceId), pendingSaves: fileClaims.list(binding.workspaceId), documents: hosting.documentAuthorities(binding.workspaceId) } : {}) };
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
		write(capability, expectedRevision, state, generation, documentEpochs) {
			const binding = scope(capability);
			if (!binding) return fail("forbidden", "Recovery page authorization expired.");
			const viewError = hosting && hostingViewError(capability, binding, generation); if (viewError) return viewError;
			if (expectedRevision !== null && (typeof expectedRevision !== "string" || !/^[a-f0-9]{48}$/.test(expectedRevision))) return fail("invalid-request", "Read recovery before writing it.");
			const encoded = encodeStudioBufferRecovery(state, binding);
			if (!encoded.ok) return encoded;
			const previous = entries.get(binding.workspaceId);
			if (previous && previous.state.mode !== binding.mode) return fail("wrong-workspace", "Recovery belongs to another view mode.");
			const conflict = legacyConflict(binding, previous?.state ?? encoded.state);
			if (conflict) return conflict;
			if (hosting && previous) for (const buffer of previous.state.buffers) {
				const next = encoded.state.buffers.find(b => b.id === buffer.id);
				if (metadataWrites.get(binding.workspaceId + ":" + buffer.id)?.size
					&& JSON.stringify(studioDocumentAuthorityIdentity(next)) !== JSON.stringify(studioDocumentAuthorityIdentity(buffer))) return fail("metadata-pending", "Document metadata is still saving; its backing was not changed.");
			}
			const filePlan = fileClaims?.checkCheckpoint(binding.workspaceId, encoded.state);
			if (filePlan && !filePlan.ok) return filePlan;
			// An exact retry after an acknowledgement was lost is safe; divergent writers need a new decision.
			if (previous?.raw === encoded.raw) {
				fileClaims?.commitCheckpoint(filePlan);
				previous.touchedAt = now();
				return { ok: true, revision: previous.revision, workspaceRevision: previous.state.revision, expiresInMs: ttlMs,
					...(hosting ? { documents: hosting.documentAuthorities(binding.workspaceId), pendingSaves: fileClaims.list(binding.workspaceId) } : {}) };
			}
			if ((previous?.revision ?? null) !== expectedRevision) return fail("conflict", "Another page changed recovery. Current text and stored recovery were kept.");
			if (hosting && previous && (options.hosting.requireView || documentEpochs !== undefined)) for (const buffer of previous.state.buffers) {
				const authority = hosting.checkAuthority(binding.workspaceId, buffer.id, documentEpochs?.[buffer.id]); if (!authority.ok) return authority;
			}
			if (previous && (encoded.state.revision <= previous.state.revision || encoded.state.savedAt < previous.state.savedAt)) return fail("stale-state", "Recovery update is older than the stored workspace.");
			const chars = encoded.state.buffers.reduce((sum, b) => sum + b.text.length + (b.baselineText?.length || 0), 0);
			if (hosting && !previous && entries.size >= maxEntries) for (const [key, value] of entries) if (key !== binding.workspaceId) reclaim(key, value);
			const total = [...entries.values()].reduce((sum, e) => sum + e.chars, 0) - (previous?.chars || 0) + chars;
			if ((!previous && entries.size >= maxEntries) || total > maxTotalTextChars) return fail("capacity", "Server recovery capacity reached. No workspace was evicted; save or copy your text before closing.");
			if (hosting) {
				const owned = hosting.checkpoint(encoded.state);
				if (!owned.ok) return owned;
			}
			const revision = token();
			const lineage = hosting && previous?.lineage?.length ? [...previous.lineage, { kind: "publish", fromRevision: previous.revision,
				toRevision: revision, fromWorkspaceRevision: previous.state.revision, toWorkspaceRevision: encoded.state.revision,
				fromDigest: digest(previous.state), toDigest: digest(encoded.state) }].slice(-16) : [];
			if (hosting && hostingViews.has(binding.workspaceId)) seenHostingViews.add(binding.workspaceId);
			entries.set(binding.workspaceId, { state: encoded.state, raw: encoded.raw, revision, chars, lineage, touchedAt: now() });
			fileClaims?.commitCheckpoint(filePlan);
			return { ok: true, revision, workspaceRevision: encoded.state.revision, expiresInMs: ttlMs,
				...(hosting ? { documents: hosting.documentAuthorities(binding.workspaceId), pendingSaves: fileClaims.list(binding.workspaceId) } : {}) };
		},
		// Transport handles are server-owned identities, never values accepted from
		// JSON. A late socket-close event cannot release its replacement's lease.
		bindHostingView(capability, mode, handle) {
			const binding = scope(capability);
			if (!hosting || !binding || binding.mode !== mode || !handle) return fail("forbidden", "This connection cannot own this editing view.");
			const current = hostingViews.get(binding.workspaceId);
			if (current && (current.capability !== capability || current.handle !== handle)) return fail("view-already-open", "This workspace already has a live editing tab. Use that tab; its draft was kept.");
			const generation = current?.generation ?? ++nextViewGeneration;
			if (entries.has(binding.workspaceId)) seenHostingViews.add(binding.workspaceId);
			hostingViews.set(binding.workspaceId, { capability, handle, mode, generation });
			return { ok: true, workspaceId: binding.workspaceId, mode, generation };
		},
		releaseHostingView(capability, handle) {
			for (const [workspaceId, view] of hostingViews) if (view.capability === capability && view.handle === handle) {
				const cancelled = hosting.cancelPending(workspaceId);
				hostingViews.delete(workspaceId); return { ok: true, released: true, cancellation: cancelled };
			}
			return { ok: true, released: false };
		},
		seenHostingView(workspaceId) { return seenHostingViews.has(workspaceId); },
		activeHostingWorkspaces(mode) {
			return [...hostingViews].filter(([, view]) => view.mode === mode).map(([workspaceId]) => workspaceId);
		},
		hostingCopy(capability, request) {
			const binding = fileBinding(capability, request?.generation); if (!binding.ok) return binding;
			if (!/^[a-f0-9]{48}$/.test(request.operationId || "")) return fail("invalid-request", "A fresh copy intent identity is required.");
			const key = binding.workspaceId + ":" + request.operationId;
			const intent = JSON.stringify([request.bufferId, request.documentEpoch, request.expectedRevision]);
			const existing = copyReceipts.get(key);
			if (existing) return existing.intent !== intent ? fail("invalid-request", "That copy identity belongs to a different intent.")
				: hosting.owner(existing.result.bufferId) ? { ...existing.result } : fail("copy-closed", "The original copy is no longer retained. It was not recreated.");
			if (copyReceipts.size >= 128) for (const [id, record] of copyReceipts) {
				if (entries.get(record.source)?.revision !== record.revision || hosting.documentAuthorities(record.source)[record.bufferId] !== record.epoch) copyReceipts.delete(id);
			}
			if (copyReceipts.size >= 128) return fail("capacity", "Copy receipt capacity reached. Existing copies were kept.");
			if (binding.entry.revision !== request.expectedRevision) return fail("conflict", "Checkpoint the copy's source first.");
			const authority = hosting.checkAuthority(binding.workspaceId, request.bufferId, request.documentEpoch); if (!authority.ok) return authority;
			const source = binding.entry.state.buffers.find(b => b.id === request.bufferId);
			const copy = createStudioDocumentCopy(source, "copy_" + token()), workspaceId = "host_" + token();
			const state = { version: 2, workspaceId, mode: "editor-only", revision: 1, savedAt: now(), selectedBufferId: copy.id,
				activePromptId: null, order: [copy.id], buffers: [copy] };
			const encoded = encodeStudioBufferRecovery(state, state); if (!encoded.ok) return encoded;
			if (entries.size >= maxEntries) for (const [key, value] of entries) reclaim(key, value);
			const chars = copy.text.length;
			if (entries.size >= maxEntries || [...entries.values()].reduce((sum, e) => sum + e.chars, chars) > maxTotalTextChars) return fail("capacity", "There is no room for another retained copy; existing drafts were kept.");
			const registered = hosting.checkpoint(encoded.state); if (!registered.ok) return registered;
			entries.set(workspaceId, { state: encoded.state, raw: encoded.raw, chars, revision: token(), lineage: [], touchedAt: now() });
			const result = { ok: true, operationId: request.operationId, created: true, workspaceId, bufferId: copy.id, mode: "editor-only" };
			copyReceipts.set(key, { intent, result, source: binding.workspaceId, revision: request.expectedRevision, bufferId: request.bufferId, epoch: request.documentEpoch });
			return result;
		},
		// One synchronous transaction: permission-checked read + canonical owner
		// reuse + registration. A receipt never authorizes a filesystem read.
		hostingLaunch(capability, request, loadFile, loadExport) {
			const binding = fileBinding(capability, request?.generation); if (!binding.ok) return binding;
			if (!request || typeof request.operationId !== "string" || !/^[a-f0-9]{48}$/.test(request.operationId || "") || !["blank", "file"].includes(request.kind)
				|| ["path", "sourcePath", "resourceDir"].some(k => typeof request[k] !== "string" || request[k].length > 16_384 || request[k].includes("\0"))
				|| (request.kind === "blank" ? request.path || request.sourcePath || request.resourceDir : !request.path)
				|| (request.exportId !== undefined && (typeof request.exportId !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(request.exportId)))) return fail("invalid-request", "A bounded immutable editor request is required.");
			const key = binding.workspaceId + ":" + request.operationId;
			const intent = JSON.stringify([request.kind, request.path, request.sourcePath, request.resourceDir, request.bufferId, request.documentEpoch, request.expectedRevision, request.exportId ?? null]);
			const existing = launchReceipts.get(key);
			const located = bufferId => { const owner = hosting.owner(bufferId); return owner ? { ok: true, ...owner } : fail("launch-closed", "The original editor is no longer retained. It was not recreated."); };
			if (existing) return existing.intent === intent ? { ...located(existing.bufferId), operationId: request.operationId, created: existing.created } : fail("invalid-request", "That editor request identity belongs to another intent.");
			if (binding.entry.revision !== request.expectedRevision) return fail("conflict", "Checkpoint the originating editor before opening another one.");
			const authority = hosting.checkAuthority(binding.workspaceId, request.bufferId, request.documentEpoch); if (!authority.ok) return authority;
			if (launchReceipts.size >= 128) for (const [id, record] of launchReceipts) {
				if (entries.get(record.source)?.revision !== record.revision || hosting.documentAuthorities(record.source)[record.sourceBufferId] !== record.epoch) launchReceipts.delete(id);
			}
			if (launchReceipts.size >= 128) return fail("capacity", "Editor request capacity reached. Existing Documents were kept.");
			const remember = (bufferId, created = false) => { launchReceipts.set(key, { intent, bufferId, created, source: binding.workspaceId, revision: request.expectedRevision, sourceBufferId: request.bufferId, epoch: request.documentEpoch }); return { ...located(bufferId), operationId: request.operationId, created }; };
			let file = null, path = null, prepared = null;
			if (request.exportId !== undefined) {
				try { prepared = loadExport?.(request, { workspaceId: binding.workspaceId }); }
				catch { return fail("export-unavailable", "The retained export could not be checked; no Document was created."); }
				if (prepared?.then) return fail("authority-required", "Prepared export loading must complete synchronously with registration.");
				if (!prepared?.ok) return prepared || fail("export-unavailable", "The prepared HTML is unavailable; no blank replacement was created.");
				if (prepared.kind !== request.kind || (request.kind === "file" ? prepared.path !== request.path : prepared.path != null || prepared.diskRevision != null)) return fail("source-changed", "The prepared export kind or backing changed.");
				const checked = this.hostingExportAuthority(capability, request); if (!checked.ok) return checked;
			}
			if (request.kind === "file") {
				try { path = (options.hosting.canonicalPath ?? (p => p))(request.path); } catch { return fail("source-changed", "The requested file identity could not be checked."); }
				const owned = fileClaims.owner(path) || hosting.findFile(path); if (owned) return remember(owned.bufferId);
				// The caller supplies the existing permission and final-symlink checks.
				file = loadFile?.(path, prepared);
				if (file?.then) return fail("authority-required", "File loading must complete synchronously with registration.");
				if (!file?.ok) return file || fail("permission-required", "A permission-checked file read is required.");
				if (file.path !== path || (options.hosting.canonicalPath ?? (p => p))(request.path) !== path
					|| (prepared && (file.text !== prepared.text || file.diskRevision !== prepared.diskRevision))) return fail("source-changed", "The file changed while opening. No editor was created.");
			}
			// Loader callbacks cannot borrow an authority retired during the read.
			const current = fileBinding(capability, request.generation); if (!current.ok) return current;
			if (current.entry.revision !== request.expectedRevision) return fail("conflict", "The originating checkpoint changed while opening.");
			const checkedAuthority = hosting.checkAuthority(binding.workspaceId, request.bufferId, request.documentEpoch); if (!checkedAuthority.ok) return checkedAuthority;
			const changedOwner = path && (fileClaims.owner(path) || hosting.findFile(path)); if (changedOwner) return remember(changedOwner.bufferId);
			let document;
			try { document = createStudioBuffer({ id: "document_" + token(), role: "document", ...(file ? { text: file.text, baselineText: file.text, diskRevision: file.diskRevision,
				resourceDir: file.resourceDir, view: { editorLanguage: file.editorLanguage || "markdown" }, sourceState: { source: "file", label: file.label, path, draftId: null } } : prepared ? { text: prepared.text, baselineText: "", diskRevision: null,
				resourceDir: prepared.resourceDir, view: { editorLanguage: "html" }, sourceState: { source: "import", label: prepared.label, path: null } } : {}) }); }
			catch { return fail("invalid-document", "The file cannot be represented safely as a Document."); }
			const workspaceId = "host_" + token(), state = { version: 2, workspaceId, mode: "editor-only", revision: 1, savedAt: now(), selectedBufferId: document.id, activePromptId: null, order: [document.id], buffers: [document] };
			const encoded = encodeStudioBufferRecovery(state, state); if (!encoded.ok) return encoded;
			if (entries.size >= maxEntries) for (const [id, value] of entries) reclaim(id, value);
			const chars = document.text.length + document.baselineText.length;
			if (entries.size >= maxEntries || [...entries.values()].reduce((sum, e) => sum + e.chars, chars) > maxTotalTextChars) return fail("capacity", "No room for another retained editor; existing work was kept.");
			const registered = hosting.checkpoint(encoded.state); if (!registered.ok) return registered;
			entries.set(workspaceId, { state: encoded.state, raw: encoded.raw, chars, revision: token(), lineage: [], touchedAt: now() });
			return remember(document.id, true);
		},
		hostingOpen(capability, request, loadFile) {
			const binding = fileBinding(capability, request?.generation); if (!binding.ok) return binding;
			if (!request || !["open", "open-cancel", "open-ack"].includes(request.operation) || typeof request.operationId !== "string" || !/^[a-f0-9]{48}$/.test(request.operationId)
				|| ["path", "sourcePath", "resourceDir"].some(k => typeof request[k] !== "string" || request[k].length > 16384 || request[k].includes("\0")) || !request.path) return fail("invalid-request", "A bounded file-open intent is required.");
			const key = binding.workspaceId + ":" + request.operationId, intent = JSON.stringify([request.bufferId, request.documentEpoch, request.expectedRevision, request.path, request.sourcePath, request.resourceDir, request.discardTarget]);
			const previous = openReceipts.get(key);
			if (previous) {
				if (previous.intent !== intent) return fail("invalid-request", "That open identity belongs to a different intent.");
				if (request.operation === "open-ack") {
					if (request.acknowledgedRevision !== binding.entry.revision || !hosting.checkAuthority(binding.workspaceId, request.bufferId, request.acknowledgedEpoch).ok) return fail("conflict", "A current adopted checkpoint is required before releasing the open receipt.");
					previous.result = { ok: true, operationId: request.operationId, status: "acknowledged" }; previous.chars = 0;
				}
				if (previous.result.status !== "acknowledged" && binding.entry.revision !== previous.result.revision) return fail("outcome-changed", "The workspace changed after this open. Keep the backup and inspect recovery; do not replay an older checkpoint.");
				return { ...previous.result, generation: request.generation };
			}
			if (request.operation === "open-ack") return fail("open-not-found", "The open receipt is no longer retained.");
			if (binding.entry.revision !== request.expectedRevision) return fail("conflict", "The originating checkpoint changed; no file was opened.");
			const authority = hosting.checkAuthority(binding.workspaceId, request.bufferId, request.documentEpoch); if (!authority.ok) return authority;
			const idle = documentIdle(binding.workspaceId, request.bufferId); if (!idle.ok) return idle;
			const before = binding.entry.state, old = before.buffers.find(b => b.id === request.bufferId);
			if (request.discardTarget !== true && request.operation === "open") return fail("confirmation-required", "Explicit replacement consent is required.");
			for (const [id, value] of openReceipts) if (value.result.status === "acknowledged" || entries.get(value.workspaceId)?.revision !== value.result.revision) openReceipts.delete(id);
			if (openReceipts.size >= 128) return fail("capacity", "Resolve existing file-open receipts first. Nothing was replaced.");
			let status = "cancelled", owner = null, nextBuffer = old;
			if (request.operation === "open") {
				const canonical = (options.hosting.canonicalPath ?? (p => p))(request.path);
				owner = fileClaims.owner(canonical) || hosting.findFile(canonical);
				if (!owner) {
					const file = loadFile?.(canonical);
					if (file?.then) return fail("authority-required", "Opening and registration must be synchronous.");
					if (!file?.ok) return file || fail("permission-required", "An authorized file read is required.");
					if (file.path !== canonical || (options.hosting.canonicalPath ?? (p => p))(request.path) !== canonical) return fail("source-changed", "The file changed while opening.");
					const current = fileBinding(capability, request.generation); if (!current.ok) return current;
					if (current.entry !== binding.entry || !hosting.checkAuthority(binding.workspaceId, request.bufferId, request.documentEpoch).ok) return fail("conflict", "The owning checkpoint changed while reading.");
					const stillIdle = documentIdle(binding.workspaceId, request.bufferId); if (!stillIdle.ok) return stillIdle;
					owner = fileClaims.owner(canonical) || hosting.findFile(canonical);
					if (!owner) try { nextBuffer = createStudioBuffer({ ...old, revision: old.revision + 1, text: file.text, baselineText: file.text, diskRevision: file.diskRevision, resourceDir: file.resourceDir,
						sourceState: { source: "file", path: canonical, label: file.label, draftId: null },
						view: { ...old.view, editorView: "markdown", rightView: "editor-preview", editorLanguage: file.editorLanguage || "markdown", selectionStart: 0, selectionEnd: 0, selectionDirection: "none", scrollTop: 0, previewScrollTop: 0, rightScrollTop: 0 },
						metadata: { ...old.metadata, scratchpadKey: "file:" + canonical, reviewNotesKey: "file:" + canonical } }); }
					catch {
						// Say plainly when a file is simply too large to edit (Oliver, 9 Oct). Like the
						// refusal below, nothing has been recorded yet.
						if (typeof file.text === "string" && file.text.length > STUDIO_BUFFER_LIMITS.textChars) {
							// The limit counts text characters, not bytes (Sol).
							const count = file.text.length.toLocaleString("en-US"), limit = STUDIO_BUFFER_LIMITS.textChars.toLocaleString("en-US");
							return fail("too-large", (basename(file.path || "") || "That file") + " is too large to edit in Studio (" + count + " characters; the limit is " + limit + "). Open it in a browser instead.");
						}
						return fail("invalid-document", "The file cannot be represented safely. Nothing was replaced.");
					}
				}
				status = owner ? "reused" : "committed";
			}
			// Even refusal-to-replace/cancellation advances the checkpoint, fencing a
			// delayed request after receipt reclamation. No disk write occurs here.
			const state = { ...before, revision: before.revision + 1, savedAt: Math.max(before.savedAt + 1, now()), buffers: before.buffers.map(b => b.id === old.id ? nextBuffer : b) };
			const encoded = encodeStudioBufferRecovery(state, before); if (!encoded.ok) return encoded;
			const chars = encoded.state.buffers.reduce((n, b) => n + b.text.length + (b.baselineText?.length || 0), 0);
			if ([...entries.values()].reduce((n, e) => n + e.chars, chars - binding.entry.chars) > maxTotalTextChars
				|| [...openReceipts.values()].reduce((n, r) => n + (r.workspaceId === binding.workspaceId ? 0 : r.chars), chars) > maxTotalTextChars) return fail("capacity", "Open/recovery capacity reached. Existing work was kept.");
			const filePlan = fileClaims.checkCheckpoint(binding.workspaceId, encoded.state); if (!filePlan.ok) return filePlan;
			const owned = hosting.checkpoint(encoded.state); if (!owned.ok) return owned;
			const revision = token(), receipt = { kind: "open", operationId: request.operationId, fromRevision: binding.entry.revision, toRevision: revision,
				fromWorkspaceRevision: before.revision, toWorkspaceRevision: state.revision, fromDigest: digest(before), toDigest: digest(encoded.state),
				beforeOrder: before.order, beforeSelected: before.selectedBufferId, beforePromptId: before.activePromptId,
				slot: { beforeId: old.id, beforeDigest: digest(old), afterId: old.id }, unchanged: Object.fromEntries(before.buffers.filter(b => b.id !== old.id).map(b => [b.id, digest(b)])) };
			entries.set(binding.workspaceId, { state: encoded.state, raw: encoded.raw, chars, revision, lineage: [...(binding.entry.lineage || []), receipt].slice(-16), touchedAt: now() });
			fileClaims.commitCheckpoint(filePlan);
			const result = { ok: true, operationId: request.operationId, workspaceId: binding.workspaceId, bufferId: old.id, status, owner,
				intentRevision: request.expectedRevision, state: encoded.state, revision, documents: Object.freeze(hosting.documentAuthorities(binding.workspaceId)), expiresInMs: ttlMs };
			if (owner) Object.freeze(owner);
			// A later explicitly authorized checkpoint makes an older snapshot
			// unusable for adoption. Its original revision is already fenced.
			for (const [id, value] of openReceipts) if (value.workspaceId === binding.workspaceId) openReceipts.delete(id);
			openReceipts.set(key, { workspaceId: binding.workspaceId, intent, chars, result }); return { ...result, generation: request.generation };
		},
		// For the authenticated HTML launcher only, never a JSON recovery response.
		hostedWorkspace(workspaceId) { cleanup(); return hosting?.workspace(workspaceId) ?? null; },
		hostedDocumentOwner(bufferId) { cleanup(); return hosting?.owner(bufferId) ?? null; },
		// Capabilities, never caller-supplied workspace IDs, authorize each side.
		hostingMove(capability, request) {
			const binding = scope(capability);
			if (!hosting || !binding) return fail("forbidden", "Document hosting is unavailable for this page.");
			const viewError = request?.operation === "status" ? null : hostingViewError(capability, binding, request?.generation);
			if (viewError) return viewError;
			const entry = entries.get(binding.workspaceId);
			if (!entry || entry.state.mode !== binding.mode) return fail("not-ready", "A current recovery checkpoint is required before moving a document.");
			const stale = () => fail("conflict", "The workspace checkpoint changed. Nothing was moved.");
			if (["move-out", "begin", "accept"].includes(request?.operation)) {
				const guarded = documentIdle(binding.workspaceId, request.operation === "accept" ? request.targetBufferId : request.bufferId);
				if (!guarded.ok) return guarded;
			}
			const withCheckpoint = result => {
				if (!result.ok || !["committed", "cancelled"].includes(result.status)) return result;
				const current = entries.get(binding.workspaceId), conflict = legacyConflict(binding, current.state);
				// Ownership outcome is still useful when recovery has a legacy
				// conflict, but it must not masquerade as a persistence acknowledgement.
				const receipt = current.lineage?.findLast(r => r.move?.moveId === result.moveId);
				return { ...result, state: current.state, revision: current.revision, documents: hosting.documentAuthorities(binding.workspaceId),
					...(receipt ? { intentRevision: receipt.fromRevision } : {}),
					expiresInMs: conflict ? 0 : ttlMs, ...(conflict ? { checkpointError: conflict.message } : {}) };
			};
			if (request?.operation === "move-out") {
				if (typeof request.moveId !== "string" || !/^[a-f0-9]{48}$/.test(request.moveId)) return fail("invalid-request", "Allocate a fresh move identity before sending.");
				const receipt = entry.lineage?.findLast(r => r.kind === "move-out" && r.move.moveId === request.moveId);
				if (receipt) {
					if (receipt.fromRevision !== request.expectedRevision || receipt.move.bufferId !== request.bufferId) return fail("invalid-move", "The retry changed the original move intent.");
					return withCheckpoint({ ok: true, ...receipt.move });
				}
				if (entry.revision !== request.expectedRevision) return stale();
				if (entries.size >= maxEntries) for (const [key, value] of entries) if (key !== binding.workspaceId) reclaim(key, value);
				return withCheckpoint(hosting.moveOut({ workspaceId: binding.workspaceId, expectedRevision: entry.state.revision,
					bufferId: request.bufferId, moveId: request.moveId, destinationId: "host_" + token() }));
			}
			if (request?.operation === "begin") {
				if (typeof request.moveId !== "string" || !/^[a-f0-9]{48}$/.test(request.moveId)) return fail("invalid-request", "Allocate a fresh random move identity before sending Begin, so an uncertain request can be cancelled safely.");
				if (entry.revision !== request.expectedRevision) return stale();
				return hosting.beginMove({ workspaceId: binding.workspaceId, expectedRevision: entry.state.revision,
					bufferId: request.bufferId, targetMode: request.targetMode, targetWorkspaceId: request.targetWorkspaceId, moveId: request.moveId });
			}
			if (request?.operation === "accept") {
				// Allow an exact lost-ack retry only for the already-bound destination.
				const status = hosting.moveStatus(binding.workspaceId, request.moveId);
				if (status.ok && status.status === "committed" && status.targetWorkspaceId === binding.workspaceId) return withCheckpoint(status);
				if (entry.revision !== request.expectedRevision) return stale();
				return withCheckpoint(hosting.acceptMove({ workspaceId: binding.workspaceId, expectedRevision: entry.state.revision,
					targetBufferId: request.targetBufferId, moveId: request.moveId, discardTarget: request.discardTarget === true }));
			}
			const retainedOutcome = () => {
				const receipt = entry.lineage?.findLast(r => r.move?.moveId === request.moveId);
				return receipt ? { ok: true, ...receipt.move } : null;
			};
			if (request?.operation === "status") {
				const result = hosting.moveStatus(binding.workspaceId, request.moveId, request.incoming === true);
				return withCheckpoint(result.ok ? result : retainedOutcome() || result);
			}
			if (request?.operation === "cancel") {
				const known = hosting.moveStatus(binding.workspaceId, request.moveId);
				if (!known.ok) {
					const retained = retainedOutcome();
					if (retained?.sourceWorkspaceId === binding.workspaceId) {
						const receipt = entry.lineage.findLast(r => r.move?.moveId === request.moveId);
						if (request.expectedRevision !== receipt.fromRevision) return fail("invalid-move", "This cancellation does not match the original intent.");
						return withCheckpoint(retained);
					}
					if (entry.revision !== request.expectedRevision) return stale();
				}
				return withCheckpoint(hosting.cancelMove(binding.workspaceId, request.moveId));
			}
			if (request?.operation === "decline") return withCheckpoint(hosting.declineMove(binding.workspaceId, request.moveId));
			if (request?.operation === "adopted") {
				let result = hosting.adoptMove(binding.workspaceId, request.moveId, request.bufferId);
				if (!result.ok) {
					const retained = retainedOutcome();
					if (retained?.status === "committed" && retained.targetWorkspaceId === binding.workspaceId
						&& retained.bufferId === request.bufferId && hosting.owner(request.bufferId)?.workspaceId === binding.workspaceId) result = retained;
				}
				if (!result.ok) return result;
				for (const value of entries.values()) for (const receipt of value.lineage || []) if (receipt.move?.moveId === request.moveId) receipt.move.adopted = true;
				return withCheckpoint({ ...result, adopted: true });
			}
			return fail("invalid-request", "Unknown document hosting operation.");
		},
		// Refresh is a read of this incarnation's exact backing, not an opening
		// operation or a filesystem grant. The trusted reader still checks access.
		hostingRefresh(capability, request, readFile) {
			const check = () => {
				const binding = fileBinding(capability, request?.generation); if (!binding.ok) return binding;
				const authority = hosting.checkAuthority(binding.workspaceId, request?.bufferId, request?.documentEpoch); if (!authority.ok) return authority;
				if (binding.entry.revision !== request.expectedRevision) return fail("conflict", "The Document checkpoint changed before Refresh. Keep current text and try again.");
				const idle = documentIdle(binding.workspaceId, request.bufferId); if (!idle.ok) return idle;
				const buffer = binding.entry.state.buffers.find(b => b.id === request.bufferId);
				const path = buffer?.sourceState.source === "file" ? buffer.sourceState.path : null;
				if (!path || typeof request.path !== "string" || request.path !== path) return fail("source-changed", "Refresh can only read this Document's current backing file. Use Open Document for a different file.");
				try { if ((options.hosting.canonicalPath ?? (p => p))(path) !== path) return fail("source-changed", "The file location changed. Current work was kept."); }
				catch { return fail("source-changed", "The backing file identity could not be checked. Current work was kept."); }
				return { ok: true, buffer, path };
			};
			const before = check(); if (!before.ok) return before;
			let result;
			try { result = readFile(before.path, structuredClone(before.buffer)); }
			catch (error) { return fail("read-failed", error instanceof Error ? error.message : "The file could not be refreshed. Current work was kept."); }
			if (result && typeof result.then === "function") { result.catch?.(() => undefined); return fail("authority-required", "Refresh requires a synchronous authorized reader."); }
			if (result?.ok === false) return result;
			const after = check(); if (!after.ok) return after;
			if (!result?.ok || result.resolvedPath !== before.path || typeof result.text !== "string") return fail("source-changed", "Refresh did not return the same backing file. Current work was kept.");
			return result;
		},
		// The writer is a trusted server callback, never a client-provided function.
		hostingSave(capability, request, writer) {
			const binding = fileBinding(capability, request?.generation); if (!binding.ok) return binding;
			if (metadataWrites.get(binding.workspaceId + ":" + request.bufferId)?.size) return fail("metadata-pending", "Finish saving this Document's metadata before writing its file.");
			return fileClaims.execute(capability, request, writer);
		},
		hostingSaveMetadata(capability, request, transaction) {
			if (!hosting) return Promise.resolve(fail("forbidden", "Document hosting is unavailable."));
			return fileClaims.metadata(capability, request, transaction);
		},
		ownsMetadataKey(kind, documentKey) {
			if (fileClaims?.ownsMetadataKey(kind, documentKey)) return true;
			const field = kind === "scratchpad" ? "scratchpadKey" : "reviewNotesKey";
			return Boolean(hosting && [...entries.values()].some(e => e.state.buffers.some(b => studioDocumentMetadataKey(b, field) === documentKey)));
		},
		async hostingMetadata(capability, request, kind, documentKey, write) {
			const field = kind === "scratchpad" ? "scratchpadKey" : kind === "review-notes" ? "reviewNotesKey" : null;
			const check = () => {
				const binding = fileBinding(capability, request?.generation); if (!binding.ok) return binding;
				const authority = hosting.checkAuthority(binding.workspaceId, request?.bufferId, request?.documentEpoch); if (!authority.ok) return authority;
				const buffer = binding.entry.state.buffers.find(b => b.id === request.bufferId);
				if (!field || studioDocumentMetadataKey(buffer, field) !== documentKey) return fail("document-stale", "This metadata association no longer belongs to the Document.");
				if (fileClaims.ownsMetadataKey(kind, documentKey)) return fail("save-ack-pending", "Resolve the retained disk save before producing new metadata for this association.");
				return binding;
			};
			const binding = check(); if (!binding.ok) return binding;
			const key = binding.workspaceId + ":" + request.bufferId;
			let complete; const pending = new Promise(resolve => { complete = resolve; });
			const writes = metadataWrites.get(key) || new Set(); writes.add(pending); metadataWrites.set(key, writes);
			try {
				await write(() => { const current = check(); if (!current.ok) throw Object.assign(new Error(current.message), { hostingResult: current }); });
				return { ok: true };
			} catch (error) { return error.hostingResult || fail("metadata-failed", "Metadata could not be saved; keep its unsynced browser copy."); }
			finally { writes.delete(pending); if (!writes.size) metadataWrites.delete(key); complete(); }
		},
		async awaitHostingMetadata(capability, request) {
			const binding = fileBinding(capability, request?.generation); if (!binding.ok) return binding;
			const key = binding.workspaceId + ":" + request.bufferId;
			while (metadataWrites.get(key)?.size) await Promise.all([...metadataWrites.get(key)]);
			const current = fileBinding(capability, request.generation); if (!current.ok) return current;
			return hosting.checkAuthority(binding.workspaceId, request.bufferId, request.documentEpoch);
		},
		discardHostingSave(capability, request) {
			const binding = fileBinding(capability, request?.generation); if (!binding.ok) return binding;
			const authority = hosting.checkAuthority(binding.workspaceId, request.bufferId, request.documentEpoch); if (!authority.ok) return authority;
			if (binding.entry.revision !== request.expectedRevision) return fail("conflict", "The Document changed while choosing how to resolve its save.");
			return fileClaims.discard(binding.workspaceId, request.operationId, request.bufferId, request.confirmed === true);
		},
		hostingAuthority(capability, generation, bufferId, documentEpoch) {
			const binding = scope(capability);
			if (!hosting || !binding) return fail("forbidden", "The owning editing connection is required.");
			const viewError = hostingViewError(capability, binding, generation); if (viewError) return viewError;
			return hosting.checkAuthority(binding.workspaceId, bufferId, documentEpoch);
		},
		hostingWriteCheck(capability, bufferId, path, generation, documentEpoch) {
			const binding = scope(capability);
			if (!hosting || !binding) return fail("forbidden", "The owning editing connection is required before saving.");
			const viewError = hostingViewError(capability, binding, generation); if (viewError) return viewError;
			if (options.hosting.requireView || documentEpoch !== undefined) {
				const authority = hosting.checkAuthority(binding.workspaceId, bufferId, documentEpoch); if (!authority.ok) return authority;
			}
			return hosting.checkWrite(binding.workspaceId, bufferId, path);
		},
		// Extension-local coordination only. Never exposed as a page capability,
		// file grant, checkpoint or writable Document owner.
		checkUnownedHostedFile(path) {
			if (!hosting || !fileClaims) return fail("hosting-unavailable", "Document ownership cannot be checked; nothing was written.");
			if (typeof path !== "string" || !isAbsolute(path) || path.includes("\0")) return fail("identity-unknown", "An absolute HTML export identity is required; nothing was written.");
			const requested = resolve(path), unowned = hosting.checkUnownedFile(requested);
			return unowned.ok ? fileClaims.checkUnclaimedFile(requested) : unowned;
		},
		hostingOwner(capability, path) {
			if (!hosting || !scope(capability)) return fail("forbidden", "Document hosting is unavailable for this page.");
			const held = fileClaims.owner(path);
			return { ok: true, owner: held ? hosting.owner(held.bufferId) : hosting.findFile(path) };
		},
		/** @returns {{ok: true, workspaceId: string, bufferId: string} | {ok: false, reason?: string, message?: string}} */
		hostingExportAuthority(capability, request) {
			const binding = fileBinding(capability, request?.generation); if (!binding.ok) return binding;
			if (!request || !/^[a-zA-Z0-9_-]{1,128}$/.test(request.bufferId || "") || !Number.isSafeInteger(request.documentEpoch) || request.documentEpoch < 1
				|| typeof request.expectedRevision !== "string" || binding.entry.revision !== request.expectedRevision) return fail("conflict", "The originating export checkpoint changed; current work was kept.");
			const authority = hosting.checkAuthority(binding.workspaceId, request.bufferId, request.documentEpoch); if (!authority.ok) return authority;
			return { ok: true, workspaceId: binding.workspaceId, bufferId: request.bufferId };
		},
		hostingViewAuthority(capability, generation) { const binding = fileBinding(capability, generation); return binding.ok ? { ok: true } : binding; },
		release(capability) { return { ok: true, released: capabilities.delete(capability) }; },
		clear() { entries.clear(); capabilities.clear(); hostingViews.clear(); seenHostingViews.clear(); copyReceipts.clear(); launchReceipts.clear(); openReceipts.clear(); hosting?.clear(); fileClaims?.clear(); },
		get size() { cleanup(); return entries.size; },
	});
}

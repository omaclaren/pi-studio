import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { createStudioMetadataWriteOrderTracker } from "../shared/studio-metadata-write-order.js";

const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const serverSource = readFileSync(new URL("../index.ts", import.meta.url), "utf8");

function section(start, end) {
	const a = source.indexOf(start);
	const b = source.indexOf(end, a);
	assert(a >= 0 && b > a, start);
	return source.slice(a, b);
}

function deferred() {
	let resolve;
	let reject;
	const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
	return { promise, resolve, reject };
}

const tick = () => new Promise(resolve => setImmediate(resolve));

function baseHarness() {
	let nextTimer = 0;
	const timers = new Map();
	const requests = [];
	const c = {
		bufferRecoveryEnabled: true,
		documentHostingEnabled: false,
		bufferPageClosed: false,
		studioTabStateId: "tab_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		studioMetadataWriteClock: 0,
		STUDIO_METADATA_WRITE_TIMEOUT_MS: 15_000,
		STUDIO_METADATA_READ_TIMEOUT_MS: 15_000,
		editorSourceGeneration: 0,
		currentDescriptor: { key: "file:/a.md", label: "/a.md", fileBacked: true, draftBacked: false },
		getCurrentStudioDocumentDescriptor: () => c.currentDescriptor,
		window: {
			setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, delay }); return id; },
			clearTimeout(id) { timers.delete(id); },
		},
		trySendStudioJsonBeacon: () => false,
		fetchStudioJson(path, options = {}) {
			const pending = deferred();
			requests.push({ path, options, ...pending });
			options.signal?.addEventListener("abort", () => pending.reject(new Error("aborted")), { once: true });
			return pending.promise;
		},
		setStatus() {},
		updateScratchpadUi() {},
		updateReviewNotesUi() {},
		renderReviewNotesList() {},
		refreshRenderedEditorPreviewComments() {},
		scheduleEditorLineNumberRender() {},
		editorView: "markdown",
		scratchpadText: "",
		scratchpadTextEl: { value: "", placeholder: "" },
		scratchpadPersistTimer: null,
		scratchpadLoadNonce: 0,
		scratchpadEditGeneration: 0,
		scratchpadActionGeneration: 0,
		scratchpadAssociationGeneration: 0,
		scratchpadAssociation: null,
		scratchpadAssociationInitialized: false,
		scratchpadAssociationStatus: "idle",
		scratchpadDirty: false,
		scratchpadPageRecords: new Map(),
		// Most cases exercise writes against previously read metadata. First-read cases clear these sets.
		scratchpadLoadedKeys: new Set(["file:/a.md"]),
		scratchpadWriteChains: new Map(),
		scratchpadUnsyncedRecords: new Map(),
		scratchpadRecentVisible: false,
		scratchpadRecentLoading: false,
		scratchpadRecentLoadNonce: 0,
		reviewNotes: [],
		reviewNotesPersistTimer: null,
		reviewNotesLoadNonce: 0,
		reviewNotesEditGeneration: 0,
		reviewNotesActionGeneration: 0,
		reviewNotesAssociationGeneration: 0,
		reviewNotesAssociation: null,
		reviewNotesAssociationInitialized: false,
		reviewNotesAssociationStatus: "idle",
		reviewNotesDirty: false,
		reviewNotesPageRecords: new Map(),
		reviewNotesLoadedKeys: new Set(["file:/a.md"]),
		reviewNotesWriteChains: new Map(),
		reviewNotesUnsyncedRecords: new Map(),
	};
	vm.createContext(c);
	vm.runInContext(section("function cloneStudioDocumentDescriptor", "function formatScratchpadRecentTime"), c);
	return {
		c,
		requests,
		runTimers(predicate) {
			const pending = [...timers.entries()].filter(([, timer]) => !predicate || predicate(timer.delay));
			pending.forEach(([id]) => timers.delete(id));
			pending.forEach(([, timer]) => timer.fn());
		},
	};
}

function scratchpadHarness() {
	const h = baseHarness();
	vm.runInContext(section("function markStudioMetadataUnsynced", "function captureScratchpadMutationConsent"), h.c);
	vm.runInContext(section("async function fetchScratchpadTextForDocumentKey", "function normalizeReviewNoteAnchorKind"), h.c);
	vm.runInContext(section("function setScratchpadText", "function closeShortcuts"), h.c);
	return h;
}

function reviewNotesHarness() {
	const h = baseHarness();
	h.c.cloneReviewNotes = notes => Array.isArray(notes) ? notes.map(note => ({ ...note })) : [];
	vm.runInContext(section("function markStudioMetadataUnsynced", "function captureScratchpadMutationConsent"), h.c);
	vm.runInContext(section("async function fetchReviewNotesForDocumentKey", "function formatReviewNoteTimestamp"), h.c);
	vm.runInContext(section("function recordReviewNotesMutation", "function updateEditorSelectionCommentUi"), h.c);
	return h;
}

function findRequest(requests, predicate) {
	const request = requests.find(predicate);
	assert(request, "expected request");
	return request;
}

function requestBody(request) {
	return JSON.parse(request.options.body);
}

function assertScratchpadWrite(request, expected) {
	const body = requestBody(request);
	assert.deepEqual({ documentKey: body.documentKey, text: body.text, label: body.label }, expected);
	assert.equal(body.metadataWriterId, "tab_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
	assert.equal(Number.isSafeInteger(body.metadataWriteVersion) && body.metadataWriteVersion > 0, true);
}

test("pending disk saves pause affected metadata production, not other buffers or draining earlier writes", async () => {
	for (const kind of ["local", "retained", "preparing", "resolving", "other"]) {
		for (const notes of [false, true]) {
			const h = notes ? reviewNotesHarness() : scratchpadHarness(), c = h.c;
			Object.assign(c, { documentHostingEnabled: true, documentHostingFilePreparationBufferId: kind === "preparing" ? "doc" : null,
				documentHostingSaveResolutionBufferId: kind === "resolving" ? "doc" : null,
				pendingSaveOperations: new Map(kind === "local" || kind === "other" ? [["save", { hosting: { bufferId: kind === "other" ? "other" : "doc" } }]] : []),
				bufferRecoveryClient: { pendingHostingSaves: () => kind === "retained" ? [{ bufferId: "doc" }] : [] },
				documentHostingMetadataProof: () => ({ ok: true, bufferId: "doc", generation: 1, documentEpoch: 3 }),
				scratchpadHostingProduction: null, reviewNotesHostingProduction: null });
			if (source.includes("      function documentHostingSaveAffectsBuffer(")) vm.runInContext(section("      function documentHostingSaveAffectsBuffer(", "      function documentHostingMetadataProof("), c);
			if (notes) { c.reviewNotesAssociation = c.currentDescriptor; c.reviewNotes = [{ id: "kept", text: "kept" }]; c.setReviewNotes([{ id: "late", text: "late" }]); assert.equal(c.reviewNotes[0].text, kind === "other" ? "late" : "kept"); }
			else {
				c.scratchpadAssociation = c.currentDescriptor; c.scratchpadText = "kept"; c.setScratchpadText("late"); assert.equal(c.scratchpadText, kind === "other" ? "late" : "kept");
				if (kind === "preparing") { c.scratchpadDirty = true; assert.equal(c.flushScratchpadPersistence(), true); assert.equal(h.requests.length, 1); h.requests[0].resolve({ ok: true }); await tick(); }
			}
		}
	}
});

test("metadata action consent cannot borrow a later save epoch or reconnect generation", () => {
	for (const notes of [false, true]) for (const field of ["documentEpoch", "generation", "bufferId", "pending"]) {
		const { c } = notes ? reviewNotesHarness() : scratchpadHarness(); let pending = false;
		let proof = { ok: true, bufferId: "doc", generation: 1, documentEpoch: 3 };
		Object.assign(c, { documentHostingEnabled: true, scratchpadAssociation: c.currentDescriptor, reviewNotesAssociation: c.currentDescriptor,
			documentHostingMetadataProof: () => ({ ...proof }), documentHostingSaveAffectsBuffer: () => pending });
		const capture = notes ? c.captureReviewNotesMutationConsent : c.captureScratchpadMutationConsent;
		const current = notes ? c.reviewNotesMutationConsentIsCurrent : c.scratchpadMutationConsentIsCurrent;
		const consent = capture(); assert.equal(current(consent), true);
		if (field === "pending") pending = true;
		else proof[field] = field === "bufferId" ? "different" : proof[field] + 1;
		assert.equal(current(consent), false, field);
	}
});

test("scheduled metadata retains its production epoch rather than borrowing a reconnect's authority", async () => {
 for (const kind of ["scratchpad", "review-notes"]) {
  const h = kind === "scratchpad" ? scratchpadHarness() : reviewNotesHarness(), c = h.c;
  c.documentHostingEnabled = true; c.scratchpadHostingProduction = c.reviewNotesHostingProduction = null;
  let epoch = 1; c.documentHostingMetadataProof = () => ({ ok: true, bufferId: "doc", generation: epoch, documentEpoch: epoch, capability: "fixture" });
  if (kind === "scratchpad") c.scheduleScratchpadPersistence("queued note", "file:/a.md", "a");
  else c.scheduleReviewNotesPersistence([{ id: "note", text: "queued note" }], "file:/a.md");
  epoch = 2; h.runTimers(delay => delay === 180); await Promise.resolve(); await Promise.resolve();
  const request = findRequest(h.requests, r => r.options.method === "POST");
  assert.equal(requestBody(request).hosting.documentEpoch, 1); assert.equal(requestBody(request).hosting.generation, 1);
  request.resolve({ ok: true });
 }
});

test("unread metadata cannot be edited or written, including navigation beacons", async () => {
	for (const kind of ["scratchpad", "reviewNotes"]) {
		const h = kind === "scratchpad" ? scratchpadHarness() : reviewNotesHarness();
		h.c[kind + "LoadedKeys"].clear();
		const beacons = [];
		h.c.trySendStudioJsonBeacon = (path, body) => { beacons.push({ path, body }); return true; };
		if (kind === "scratchpad") h.c.loadScratchpadForCurrentDocument();
		else void h.c.loadReviewNotesForCurrentDocument();
		await tick();
		const load = findRequest(h.requests, request => !request.options.method);
		assert.equal(h.c[kind + "AssociationStatus"], "loading");
		if (kind === "scratchpad") {
			h.c.setScratchpadText("would overwrite unread notes");
			assert.equal(h.c.scratchpadText, "");
			h.c.flushScratchpadPersistence("file:/a.md", "unsafe", "/a.md", { beacon: true });
		} else {
			h.c.setReviewNotes([{ id: "new", text: "would delete unread comments" }]);
			assert.equal(h.c.reviewNotes.length, 0);
			h.c.flushReviewNotesPersistence("file:/a.md", [{ id: "unsafe", text: "unsafe" }], { beacon: true });
		}
		h.runTimers();
		await tick();
		assert.equal(h.c[kind + "AssociationStatus"], "loading");
		assert.equal(h.c[kind + "Dirty"], false);
		assert.equal(h.c[kind + "UnsyncedRecords"].size, 0);
		assert.equal(beacons.length, 0);
		assert.equal(h.requests.filter(request => request.options.method === "POST").length, 0);
		load.resolve(kind === "scratchpad" ? { text: "saved scratchpad" } : { notes: [{ id: "saved", text: "saved comment" }] });
		await tick();
		assert.equal(h.c[kind + "LoadedKeys"].has("file:/a.md"), true);
		assert.equal(h.c[kind + "AssociationStatus"], "loaded");
		if (kind === "scratchpad") h.c.setScratchpadText(h.c.scratchpadText + " plus edit");
		else h.c.setReviewNotes([...h.c.reviewNotes, { id: "new", text: "new comment" }]);
		h.runTimers();
		await tick();
		const write = findRequest(h.requests, request => request.options.method === "POST");
		if (kind === "scratchpad") assert.equal(requestBody(write).text, "saved scratchpad plus edit");
		else assert.deepEqual(requestBody(write).notes.map(note => note.id), ["saved", "new"]);
		write.resolve({ ok: true });
		await tick();
	}
});

test("failed, malformed and timed-out first metadata reads stay protected and can retry", async () => {
	for (const kind of ["scratchpad", "reviewNotes"]) {
		for (const outcome of ["failure", "malformed", "timeout"]) {
			const h = kind === "scratchpad" ? scratchpadHarness() : reviewNotesHarness();
			h.c[kind + "LoadedKeys"].clear();
			h.c.AbortController = AbortController;
			const loadCurrent = () => kind === "scratchpad" ? h.c.loadScratchpadForCurrentDocument() : void h.c.loadReviewNotesForCurrentDocument();
			loadCurrent();
			await tick();
			const load = findRequest(h.requests, request => !request.options.method);
			if (outcome === "failure") load.reject(new Error("offline"));
			if (outcome === "malformed") load.resolve({ ok: true });
			if (outcome === "timeout") h.runTimers(delay => delay === 15_000);
			await tick();
			assert.equal(h.c[kind + "AssociationStatus"], "unavailable", `${kind}/${outcome}`);
			assert.equal(h.c[kind + "LoadedKeys"].has("file:/a.md"), false);
			if (kind === "scratchpad") h.c.setScratchpadText("unsafe replacement");
			else h.c.setReviewNotes([{ id: "unsafe", text: "unsafe replacement" }]);
			h.runTimers();
			await tick();
			assert.equal(h.requests.filter(request => request.options.method === "POST").length, 0);
			loadCurrent();
			await tick();
			const retry = h.requests.filter(request => !request.options.method).at(-1);
			assert.notEqual(retry, load);
			retry.resolve(kind === "scratchpad" ? { text: "saved" } : { notes: [{ id: "saved", text: "saved" }] });
			await tick();
			assert.equal(h.c[kind + "AssociationStatus"], "loaded");
			assert.equal(h.c[kind + "LoadedKeys"].has("file:/a.md"), true);
		}
	}
});

test("source switches cannot let a late first metadata read unlock another association", async () => {
	for (const kind of ["scratchpad", "reviewNotes"]) {
		const h = kind === "scratchpad" ? scratchpadHarness() : reviewNotesHarness();
		h.c[kind + "LoadedKeys"].clear();
		const loadCurrent = () => kind === "scratchpad" ? h.c.loadScratchpadForCurrentDocument() : void h.c.loadReviewNotesForCurrentDocument();
		loadCurrent(); await tick();
		const firstA = h.requests.at(-1);
		h.c.currentDescriptor = { key: "file:/b.md", label: "/b.md" };
		h.c.editorSourceGeneration += 1;
		loadCurrent(); await tick();
		const loadB = h.requests.at(-1);
		h.c.currentDescriptor = { key: "file:/a.md", label: "/a.md" };
		h.c.editorSourceGeneration += 1;
		loadCurrent(); await tick();
		const secondA = h.requests.at(-1);
		const payload = kind === "scratchpad" ? { text: "saved" } : { notes: [{ id: "saved", text: "saved" }] };
		firstA.resolve(payload); loadB.resolve(payload); await tick();
		assert.equal(h.c[kind + "LoadedKeys"].size, 0);
		assert.equal(h.c[kind + "AssociationStatus"], "loading");
		secondA.resolve(payload); await tick();
		assert.deepEqual([...h.c[kind + "LoadedKeys"]], ["file:/a.md"]);
	}
});

test("server metadata ordering rejects only writes older than a persisted same-tab snapshot", () => {
	const order = createStudioMetadataWriteOrderTracker();
	const newer = { writerId: "tab-a", writeVersion: 20 };
	const older = { writerId: "tab-a", writeVersion: 19 };
	assert.equal(order.claim("scratchpad", "file:/a.md", newer), true);
	assert.equal(order.claim("scratchpad", "file:/a.md", older), false);
	assert.equal(order.claim("review-notes", "file:/a.md", older), true, "metadata kinds have independent order");
	assert.equal(order.claim("scratchpad", "file:/b.md", older), true, "documents have independent order");
	assert.equal(order.claim("scratchpad", "file:/a.md", { writerId: "tab-b", writeVersion: 1 }), true, "other tabs retain last-arrival behavior");
	assert.equal(order.claim("scratchpad", "file:/a.md", newer), true, "an equal-version retry is idempotently accepted");

	const failedWriteOrder = createStudioMetadataWriteOrderTracker();
	const failedNewer = failedWriteOrder.prepare("scratchpad", "file:/a.md", newer);
	assert(failedNewer, "a newer write may begin");
	assert.equal(failedWriteOrder.claim("scratchpad", "file:/a.md", older), true,
		"a write whose disk persistence failed must not advance the committed order");

	assert.match(serverSource, /prepareStudioMetadataWrite\("scratchpad", key, ownership\)/);
	assert.match(serverSource, /prepareStudioMetadataWrite\("review-notes", key, ownership\)/);
	assert.match(serverSource, /persist = saveStudioPersistentState\): Promise<void>/);
	assert.match(serverSource, /await persist\(state\);\s*if \(typeof onPersisted === "function"\) onPersisted\(\)/);
	assert.match(serverSource, /Invalid metadata write ownership/);
});

test("metadata write versions remain monotonic across a same-tab reload", () => {
	const values = new Map();
	const storage = {
		getItem(key) { return values.has(key) ? values.get(key) : null; },
		setItem(key, value) { values.set(key, String(value)); },
	};
	const makePage = () => {
		const c = {
			bufferRecoveryEnabled: true,
			studioTabStateId: "tab_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			studioMetadataWriteClock: 0,
			Date: { now: () => 100 },
			window: { sessionStorage: storage },
		};
		vm.createContext(c);
		vm.runInContext(section("function getStudioMetadataWriteClockStorageKey", "function getStudioMetadataWriteOwnership"), c);
		c.studioMetadataWriteClock = c.readStudioMetadataWriteClock();
		return c;
	};

	const firstPage = makePage();
	assert.equal(firstPage.nextStudioMetadataWriteVersion(), 101);
	assert.equal(firstPage.nextStudioMetadataWriteVersion(), 102);

	const reloadedPage = makePage();
	assert.equal(reloadedPage.studioMetadataWriteClock, 102);
	assert.equal(reloadedPage.nextStudioMetadataWriteVersion(), 103);
});

test("stalled metadata writes retain only the in-flight and latest snapshots", async () => {
	{
		const h = scratchpadHarness();
		h.c.scratchpadAssociation = h.c.currentDescriptor;
		for (let generation = 1; generation <= 50; generation += 1) {
			h.c.scratchpadText = `scratchpad ${generation}`;
			h.c.scratchpadDirty = true;
			h.c.scratchpadEditGeneration = generation;
			h.c.flushScratchpadPersistence("file:/a.md", h.c.scratchpadText, "/a.md", { editGeneration: generation });
		}
		assert.equal(h.requests.length, 1, "intermediate scratchpad snapshots are coalesced while one POST is stalled");
		assert.equal(h.c.scratchpadUnsyncedRecords.get("file:/a.md").text, "scratchpad 50");
		h.requests[0].resolve({ ok: true });
		await tick();
		assert.equal(h.requests.length, 2);
		assert.equal(requestBody(h.requests[1]).text, "scratchpad 50");
		h.requests[1].resolve({ ok: true });
		await tick();
		assert.equal(h.c.scratchpadUnsyncedRecords.size, 0);
		assert.equal(h.c.scratchpadDirty, false);
	}

	{
		const h = reviewNotesHarness();
		h.c.reviewNotesAssociation = h.c.currentDescriptor;
		for (let generation = 1; generation <= 50; generation += 1) {
			h.c.reviewNotes = [{ id: `note-${generation}`, text: `review ${generation}` }];
			h.c.reviewNotesDirty = true;
			h.c.reviewNotesEditGeneration = generation;
			h.c.flushReviewNotesPersistence("file:/a.md", h.c.reviewNotes, { editGeneration: generation });
		}
		assert.equal(h.requests.length, 1, "intermediate review-note snapshots are coalesced while one POST is stalled");
		assert.equal(h.c.reviewNotesUnsyncedRecords.get("file:/a.md").notes[0].text, "review 50");
		h.requests[0].resolve({ ok: true });
		await tick();
		assert.equal(h.requests.length, 2);
		assert.equal(requestBody(h.requests[1]).notes[0].text, "review 50");
		h.requests[1].resolve({ ok: true });
		await tick();
		assert.equal(h.c.reviewNotesUnsyncedRecords.size, 0);
		assert.equal(h.c.reviewNotesDirty, false);
	}

	const enqueue = section("function enqueueStudioMetadataWrite", "async function awaitStudioMetadataWrites");
	assert.match(enqueue, /if \(chains\.has\(key\)\) return null/);
	assert.match(enqueue, /new AbortController\(\)/);
	assert.match(enqueue, /STUDIO_METADATA_WRITE_TIMEOUT_MS/);
});

test("coalesced drains preserve a newer edit's debounce timer", async () => {
	{
		const h = scratchpadHarness();
		h.c.scratchpadAssociation = h.c.currentDescriptor;
		h.c.setScratchpadText("scratchpad 1");
		h.c.flushScratchpadPersistence();
		h.c.setScratchpadText("scratchpad 2");
		h.c.flushScratchpadPersistence();
		h.c.setScratchpadText("scratchpad 3");
		assert.notEqual(h.c.scratchpadPersistTimer, null);
		assert.equal(h.requests.length, 1);
		h.requests[0].resolve({ ok: true });
		await tick();
		assert.equal(h.requests.length, 2);
		assert.equal(requestBody(h.requests[1]).text, "scratchpad 2");
		assert.notEqual(h.c.scratchpadPersistTimer, null, "draining snapshot 2 keeps snapshot 3's timer");
		h.requests[1].resolve({ ok: true });
		await tick();
		assert.equal(h.c.scratchpadDirty, true);
		h.runTimers();
		await tick();
		assert.equal(h.requests.length, 3);
		assert.equal(requestBody(h.requests[2]).text, "scratchpad 3");
		h.requests[2].resolve({ ok: true });
		await tick();
		assert.equal(h.c.scratchpadDirty, false);
	}

	{
		const h = reviewNotesHarness();
		h.c.reviewNotesAssociation = h.c.currentDescriptor;
		const note = number => [{ id: `note-${number}`, text: `review ${number}` }];
		h.c.setReviewNotes(note(1));
		h.c.flushReviewNotesPersistence();
		h.c.setReviewNotes(note(2));
		h.c.flushReviewNotesPersistence();
		h.c.setReviewNotes(note(3));
		assert.notEqual(h.c.reviewNotesPersistTimer, null);
		assert.equal(h.requests.length, 1);
		h.requests[0].resolve({ ok: true });
		await tick();
		assert.equal(h.requests.length, 2);
		assert.equal(requestBody(h.requests[1]).notes[0].text, "review 2");
		assert.notEqual(h.c.reviewNotesPersistTimer, null, "draining snapshot 2 keeps snapshot 3's timer");
		h.requests[1].resolve({ ok: true });
		await tick();
		assert.equal(h.c.reviewNotesDirty, true);
		h.runTimers();
		await tick();
		assert.equal(h.requests.length, 3);
		assert.equal(requestBody(h.requests[2]).notes[0].text, "review 3");
		h.requests[2].resolve({ ok: true });
		await tick();
		assert.equal(h.c.reviewNotesDirty, false);
	}
});

test("recovered metadata keys are accepted only for the recovered source identity", () => {
	const { c } = baseHarness();
	const expected = c.currentDescriptor;
	assert.equal(c.resolveRecoveredMetadataAssociation(null, "scratchpadKey", expected).key, expected.key);
	assert.equal(c.resolveRecoveredMetadataAssociation({}, "scratchpadKey", expected).key, expected.key);
	assert.equal(c.resolveRecoveredMetadataAssociation({ scratchpadKey: expected.key }, "scratchpadKey", expected).key, expected.key);
	assert.equal(c.resolveRecoveredMetadataAssociation({ scratchpadKey: "file:/other.md" }, "scratchpadKey", expected), null);
});

test("scratchpad GET success or failure cannot overwrite local typing, including edit-revert ABA", async () => {
	for (const outcome of ["success", "failure"]) {
		const h = scratchpadHarness();
		h.c.loadScratchpadForCurrentDocument();
		await tick();
		const load = findRequest(h.requests, request => request.path === "/scratchpad-state" && !request.options.method);
		h.c.setScratchpadText("temporary");
		h.c.setScratchpadText("");
		if (outcome === "success") load.resolve({ text: "server text" });
		else load.reject(new Error("offline"));
		await tick();
		assert.equal(h.c.scratchpadText, "");
		assert.equal(h.c.scratchpadDirty, true);
		assert.equal(h.requests.filter(request => request.options.method === "POST").length, 0);
		h.runTimers();
		await tick();
		const write = findRequest(h.requests, request => request.options.method === "POST");
		assertScratchpadWrite(write, { documentKey: "file:/a.md", text: "", label: "/a.md" });
		write.resolve({ ok: true });
		await tick();
	}
});

test("failed scratchpad loads preserve a page-local fallback without creating a destructive empty write", async () => {
	const h = scratchpadHarness();
	h.c.scratchpadPageRecords.set("file:/a.md", "page-local copy");
	h.c.loadScratchpadForCurrentDocument();
	await tick();
	const load = findRequest(h.requests, request => !request.options.method);
	load.reject(new Error("offline"));
	await tick();
	assert.equal(h.c.scratchpadText, "page-local copy");
	assert.equal(h.c.scratchpadAssociationStatus, "unavailable");
	assert.equal(h.c.scratchpadDirty, false);
	assert.equal(h.requests.filter(request => request.options.method === "POST").length, 0);
});

test("source changes flush scratchpad data under its owning key and reject the new key's late load", async () => {
	const h = scratchpadHarness();
	h.c.loadScratchpadForCurrentDocument();
	await tick();
	findRequest(h.requests, request => !request.options.method).resolve({ text: "server A" });
	await tick();
	h.c.setScratchpadText("local A");
	const previous = h.c.currentDescriptor;
	h.c.currentDescriptor = { key: "file:/b.md", label: "/b.md", fileBacked: true, draftBacked: false };
	h.c.scratchpadLoadedKeys.add("file:/b.md"); // Editing a previously read page-local B is allowed during its refresh.
	h.c.editorSourceGeneration += 1;
	h.c.loadScratchpadForCurrentDocument({ previousDescriptor: previous, carryCurrentMetadataToNewDocument: true });
	await tick();
	const writeA = findRequest(h.requests, request => request.options.method === "POST");
	assertScratchpadWrite(writeA, { documentKey: "file:/a.md", text: "local A", label: "/a.md" });
	const loadB = h.requests.find(request => !request.options.method && request !== h.requests[0]);
	assert(loadB);
	h.c.setScratchpadText("typing for B");
	loadB.resolve({ text: "stale server B" });
	await tick();
	assert.equal(h.c.scratchpadText, "typing for B");
	h.runTimers();
	await tick();
	const writeB = h.requests.find(request => request.options.method === "POST" && request !== writeA);
	assert(writeB);
	assertScratchpadWrite(writeB, { documentKey: "file:/b.md", text: "typing for B", label: "/b.md" });
	writeA.resolve({ ok: true });
	writeB.resolve({ ok: true });
	await tick();
});

test("failed scratchpad writes remain page-local and retry before an A→B→A reload", async () => {
	const h = scratchpadHarness();
	h.c.loadScratchpadForCurrentDocument();
	await tick();
	const initialA = findRequest(h.requests, request => !request.options.method);
	initialA.resolve({ text: "server A" });
	await tick();
	h.c.setScratchpadText("unsynced A");
	h.runTimers();
	await tick();
	const failedWrite = findRequest(h.requests, request => request.options.method === "POST");
	failedWrite.reject(new Error("offline"));
	await tick();
	assert.equal(h.c.scratchpadDirty, true);
	assert.equal(h.c.scratchpadUnsyncedRecords.get("file:/a.md").text, "unsynced A");

	const descriptorA = h.c.currentDescriptor;
	h.c.currentDescriptor = { key: "file:/b.md", label: "/b.md", fileBacked: true, draftBacked: false };
	h.c.editorSourceGeneration += 1;
	h.c.loadScratchpadForCurrentDocument({ previousDescriptor: descriptorA });
	await tick();
	const retryWrite = h.requests.filter(request => request.options.method === "POST").at(-1);
	assert.notEqual(retryWrite, failedWrite);
	assert.equal(requestBody(retryWrite).text, "unsynced A");
	const loadB = h.requests.filter(request => !request.options.method).at(-1);

	h.c.currentDescriptor = descriptorA;
	h.c.editorSourceGeneration += 1;
	h.c.loadScratchpadForCurrentDocument({ previousDescriptor: { key: "file:/b.md", label: "/b.md" } });
	await tick();
	assert.equal(h.requests.filter(request => !request.options.method).length, 2, "stale server A is not read while its retry is pending");
	assert.equal(h.c.scratchpadText, "unsynced A");
	retryWrite.resolve({ ok: true });
	await tick();
	assert.equal(h.requests.filter(request => !request.options.method).length, 3);
	loadB.resolve({ text: "server B" });
	const reloadA = h.requests.filter(request => !request.options.method).at(-1);
	reloadA.resolve({ text: "unsynced A" });
	await tick();
	assert.equal(h.c.scratchpadText, "unsynced A");
	assert.equal(h.c.scratchpadUnsyncedRecords.has("file:/a.md"), false);
});

test("returning A→B→A waits for A's queued write before reloading A", async () => {
	const h = scratchpadHarness();
	h.c.loadScratchpadForCurrentDocument();
	await tick();
	const initialA = findRequest(h.requests, request => !request.options.method);
	initialA.resolve({ text: "server A" });
	await tick();
	h.c.setScratchpadText("new A");
	const descriptorA = h.c.currentDescriptor;
	h.c.currentDescriptor = { key: "file:/b.md", label: "/b.md", fileBacked: true, draftBacked: false };
	h.c.editorSourceGeneration += 1;
	h.c.loadScratchpadForCurrentDocument({ previousDescriptor: descriptorA });
	await tick();
	const writeA = findRequest(h.requests, request => request.options.method === "POST");
	const loadB = h.requests.find(request => !request.options.method && request !== initialA);
	assert(loadB);
	h.c.currentDescriptor = descriptorA;
	h.c.editorSourceGeneration += 1;
	h.c.loadScratchpadForCurrentDocument({ previousDescriptor: { key: "file:/b.md", label: "/b.md" } });
	await tick();
	assert.equal(h.requests.filter(request => !request.options.method && request !== loadB).length, 1, "no second A read before its write settles");
	writeA.resolve({ ok: true });
	await tick();
	assert.equal(h.requests.filter(request => !request.options.method).length, 3, "A reload starts after its write");
	loadB.resolve({ text: "server B" });
	const reloadA = h.requests.filter(request => !request.options.method).at(-1);
	reloadA.resolve({ text: "new A" });
	await tick();
	assert.equal(h.c.scratchpadText, "new A");
});

test("review-note loads cannot overwrite edits and failures preserve page-local notes", async () => {
	for (const outcome of ["success", "failure"]) {
		const h = reviewNotesHarness();
		h.c.reviewNotesPageRecords.set("file:/a.md", [{ id: "page", text: "page copy" }]);
		void h.c.loadReviewNotesForCurrentDocument();
		await tick();
		const load = findRequest(h.requests, request => request.path === "/review-notes" && !request.options.method);
		h.c.setReviewNotes([{ id: "local", text: "typed" }]);
		if (outcome === "success") load.resolve({ notes: [{ id: "server", text: "server" }] });
		else load.reject(new Error("offline"));
		await tick();
		assert.equal(h.c.reviewNotes.length, 1);
		assert.equal(h.c.reviewNotes[0].text, "typed");
		assert.equal(h.c.reviewNotesDirty, true);
		h.runTimers();
		await tick();
		const write = findRequest(h.requests, request => request.options.method === "POST");
		assert.equal(requestBody(write).documentKey, "file:/a.md");
		assert.equal(requestBody(write).notes[0].text, "typed");
		write.resolve({ ok: true });
		await tick();
	}
});

test("failed review-note writes retry before a server reload", async () => {
	const h = reviewNotesHarness();
	void h.c.loadReviewNotesForCurrentDocument();
	await tick();
	const initial = findRequest(h.requests, request => !request.options.method);
	initial.resolve({ notes: [] });
	await tick();
	h.c.setReviewNotes([{ id: "local", text: "unsynced note" }]);
	h.runTimers();
	await tick();
	const failedWrite = findRequest(h.requests, request => request.options.method === "POST");
	failedWrite.reject(new Error("offline"));
	await tick();
	assert.equal(h.c.reviewNotesDirty, true);
	assert.equal(h.c.reviewNotesUnsyncedRecords.get("file:/a.md").notes[0].text, "unsynced note");

	const descriptorA = h.c.currentDescriptor;
	h.c.currentDescriptor = { key: "file:/b.md", label: "/b.md", fileBacked: true, draftBacked: false };
	h.c.editorSourceGeneration += 1;
	void h.c.loadReviewNotesForCurrentDocument({ previousDescriptor: descriptorA });
	await tick();
	const retryWrite = h.requests.filter(request => request.options.method === "POST").at(-1);
	assert.notEqual(retryWrite, failedWrite);
	const loadB = h.requests.filter(request => !request.options.method).at(-1);

	h.c.currentDescriptor = descriptorA;
	h.c.editorSourceGeneration += 1;
	void h.c.loadReviewNotesForCurrentDocument({ previousDescriptor: { key: "file:/b.md", label: "/b.md" } });
	await tick();
	assert.equal(h.requests.filter(request => !request.options.method).length, 2, "server A is not read before the retry");
	retryWrite.resolve({ ok: true });
	await tick();
	const reload = h.requests.filter(request => !request.options.method).at(-1);
	assert.notEqual(reload, initial);
	loadB.resolve({ notes: [] });
	reload.resolve({ notes: [{ id: "local", text: "unsynced note" }] });
	await tick();
	assert.equal(h.c.reviewNotes[0].text, "unsynced note");
	assert.equal(h.c.reviewNotesUnsyncedRecords.has("file:/a.md"), false);
});

test("cancelled-navigation beacon retries preserve an intervening edit's autosave timer", async () => {
	for (const kind of ["scratchpad", "reviewNotes"]) {
		const h = kind === "scratchpad" ? scratchpadHarness() : reviewNotesHarness();
		h.c.trySendStudioJsonBeacon = () => true;
		if (kind === "scratchpad") {
			h.c.scratchpadAssociation = h.c.currentDescriptor;
			h.c.scratchpadText = "beacon snapshot";
			h.c.scratchpadDirty = true;
			h.c.scratchpadEditGeneration = 1;
			h.c.flushScratchpadPersistence("file:/a.md", "beacon snapshot", "/a.md", { beacon: true, editGeneration: 1 });
			h.c.setScratchpadText("intervening edit");
			const newerTimer = h.c.scratchpadPersistTimer;
			h.runTimers(delay => delay === 250);
			await tick();
			assert.equal(h.c.scratchpadPersistTimer, newerTimer);
			assert.equal(requestBody(h.requests[0]).text, "beacon snapshot");
			h.requests[0].resolve({ ok: true });
			await tick();
			h.runTimers(delay => delay === 180);
			await tick();
			assert.equal(requestBody(h.requests[1]).text, "intervening edit");
			h.requests[1].resolve({ ok: true });
			await tick();
			assert.equal(h.c.scratchpadDirty, false);
		} else {
			h.c.reviewNotesAssociation = h.c.currentDescriptor;
			h.c.reviewNotes = [{ id: "beacon", text: "beacon snapshot" }];
			h.c.reviewNotesDirty = true;
			h.c.reviewNotesEditGeneration = 1;
			h.c.flushReviewNotesPersistence("file:/a.md", h.c.reviewNotes, { beacon: true, editGeneration: 1 });
			h.c.setReviewNotes([{ id: "newer", text: "intervening edit" }]);
			const newerTimer = h.c.reviewNotesPersistTimer;
			h.runTimers(delay => delay === 250);
			await tick();
			assert.equal(h.c.reviewNotesPersistTimer, newerTimer);
			assert.equal(requestBody(h.requests[0]).notes[0].text, "beacon snapshot");
			h.requests[0].resolve({ ok: true });
			await tick();
			h.runTimers(delay => delay === 180);
			await tick();
			assert.equal(requestBody(h.requests[1]).notes[0].text, "intervening edit");
			h.requests[1].resolve({ ok: true });
			await tick();
			assert.equal(h.c.reviewNotesDirty, false);
		}
	}
});

test("a newer beacon cannot be cleared or overwritten by an older in-flight POST", async () => {
	const h = scratchpadHarness();
	h.c.scratchpadAssociation = h.c.currentDescriptor;
	h.c.scratchpadText = "older";
	h.c.scratchpadDirty = true;
	h.c.scratchpadEditGeneration = 1;
	h.c.flushScratchpadPersistence("file:/a.md", "older", "/a.md", { editGeneration: 1 });
	await tick();
	const olderWrite = findRequest(h.requests, request => request.options.method === "POST");
	const olderBody = requestBody(olderWrite);

	let beaconBody = null;
	h.c.trySendStudioJsonBeacon = (_path, body) => { beaconBody = body; return true; };
	h.c.scratchpadText = "newer";
	h.c.scratchpadDirty = true;
	h.c.scratchpadEditGeneration = 2;
	h.c.flushScratchpadPersistence("file:/a.md", "newer", "/a.md", { beacon: true, editGeneration: 2 });
	assert(beaconBody);
	assert(beaconBody.metadataWriteVersion > olderBody.metadataWriteVersion);
	assert.equal(h.c.scratchpadUnsyncedRecords.get("file:/a.md").writeVersion, beaconBody.metadataWriteVersion);

	h.runTimers();
	await tick();
	assert.equal(h.requests.filter(request => request.options.method === "POST").length, 1,
		"the acknowledgement retry stays ordered behind the older POST");
	olderWrite.resolve({ ok: true });
	await tick();
	assert.equal(h.c.scratchpadDirty, true);
	assert.equal(h.c.scratchpadUnsyncedRecords.get("file:/a.md").text, "newer");
	const retryWrite = h.requests.filter(request => request.options.method === "POST").at(-1);
	assert.notEqual(retryWrite, olderWrite);
	assert.equal(requestBody(retryWrite).metadataWriteVersion, beaconBody.metadataWriteVersion);
	retryWrite.resolve({ ok: true });
	await tick();
	assert.equal(h.c.scratchpadDirty, false);
	assert.equal(h.c.scratchpadUnsyncedRecords.has("file:/a.md"), false);
});

test("queued navigation beacons do not falsely acknowledge metadata writes", async () => {
	for (const kind of ["scratchpad", "reviewNotes"]) {
		const h = kind === "scratchpad" ? scratchpadHarness() : reviewNotesHarness();
		h.c.trySendStudioJsonBeacon = () => true;
		if (kind === "scratchpad") {
			h.c.scratchpadAssociation = h.c.currentDescriptor;
			h.c.scratchpadText = "beacon text";
			h.c.scratchpadDirty = true;
			h.c.scratchpadEditGeneration = 4;
			h.c.flushScratchpadPersistence("file:/a.md", "beacon text", "/a.md", { beacon: true, editGeneration: 4 });
			assert.equal(h.c.scratchpadDirty, true);
			assert.equal(h.c.scratchpadUnsyncedRecords.get("file:/a.md").text, "beacon text");
		} else {
			h.c.reviewNotesAssociation = h.c.currentDescriptor;
			h.c.reviewNotes = [{ id: "beacon", text: "beacon note" }];
			h.c.reviewNotesDirty = true;
			h.c.reviewNotesEditGeneration = 5;
			h.c.flushReviewNotesPersistence("file:/a.md", h.c.reviewNotes, { beacon: true, editGeneration: 5 });
			assert.equal(h.c.reviewNotesDirty, true);
			assert.equal(h.c.reviewNotesUnsyncedRecords.get("file:/a.md").notes[0].text, "beacon note");
		}
		h.runTimers();
		await tick();
		const retry = findRequest(h.requests, request => request.options.method === "POST");
		retry.resolve({ ok: true });
		await tick();
	}
});

test("navigation beacons include unsynced metadata from documents no longer selected", () => {
	const h = scratchpadHarness();
	h.c.cloneReviewNotes = notes => Array.isArray(notes) ? notes.map(note => ({ ...note })) : [];
	vm.runInContext(section("async function fetchReviewNotesForDocumentKey", "function formatReviewNoteTimestamp"), h.c);
	const beacons = [];
	Object.assign(h.c, {
		stopFooterSpinner() {},
		flushWorkspacePersistence() {},
		trySendStudioJsonBeacon(path, body) { beacons.push({ path, body }); return true; },
	});
	h.c.scratchpadAssociation = { key: "file:/b.md", label: "/b.md" };
	h.c.scratchpadDirty = false;
	h.c.scratchpadUnsyncedRecords.set("file:/a.md", {
		editGeneration: 3,
		writeVersion: 101,
		text: "unsynced A",
		label: "/a.md",
	});
	h.c.reviewNotesAssociation = { key: "file:/b.md", label: "/b.md" };
	h.c.reviewNotesDirty = false;
	h.c.reviewNotesUnsyncedRecords.set("file:/a.md", {
		editGeneration: 4,
		writeVersion: 102,
		notes: [{ id: "a", text: "unsynced review" }],
	});
	vm.runInContext(section("function flushStudioNavigationPersistence", "updatePaneFocusButtons();"), h.c);
	h.c.flushStudioNavigationPersistence();
	assert.equal(beacons.length, 2);
	assert.equal(beacons[0].body.documentKey, "file:/a.md");
	assert.equal(beacons[0].body.text, "unsynced A");
	assert.equal(beacons[0].body.metadataWriteVersion, 101);
	assert.equal(beacons[1].body.notes[0].text, "unsynced review");
	assert.equal(beacons[1].body.metadataWriteVersion, 102);
});

test("pagehide and beforeunload flush and protect workspace metadata recovery", () => {
	const lifecycle = section("function hasUnsyncedStudioMetadata", 'editorViewSelect.addEventListener("change"');
	assert.match(lifecycle, /flushWorkspacePersistence\(\)/);
	assert.match(lifecycle, /flushScratchpadPersistence/);
	assert.match(lifecycle, /flushReviewNotesPersistence/);
	assert.match(lifecycle, /for \(const \[key, pending\] of scratchpadUnsyncedRecords\)/);
	assert.match(lifecycle, /for \(const \[key, pending\] of reviewNotesUnsyncedRecords\)/);
	assert.match(lifecycle, /window\.addEventListener\("pagehide", \(event\) => \{\n        flushStudioNavigationPersistence\(\)/);
	assert.match(lifecycle, /window\.addEventListener\("beforeunload", \(event\) => \{\n        if \(documentHostingEnabled && documentHostingCanCloseRetired\(\)\) return;\n        const unsafeRetirement = documentHostingEnabled && documentHostingRetired;\n        const unresolvedCopy = documentHostingEnabled && documentHostingController\?\.needsUnloadConfirmation\(\);\n        const unresolvedSave = documentHostingEnabled && documentHostingSaveResolution;\n        const unresolvedOpening = documentHostingEnabled && documentOpenController\?\.active\(\);\n        flushStudioNavigationPersistence\(\)/);
	assert.match(lifecycle, /metadataNeedsUnloadConfirmation = hasUnsyncedStudioMetadata\(\)/);
	assert.match(lifecycle, /metadataNeedsUnloadConfirmation \|\| recoveryNavigationStale/);
	assert.match(lifecycle, /Scratchpad or comment changes are not currently acknowledged/);

	const c = {
		scratchpadDirty: false,
		reviewNotesDirty: false,
		scratchpadUnsyncedRecords: new Map(),
		reviewNotesUnsyncedRecords: new Map(),
	};
	vm.createContext(c);
	vm.runInContext(section("function hasUnsyncedStudioMetadata", "function flushStudioNavigationPersistence"), c);
	assert.equal(c.hasUnsyncedStudioMetadata(), false);
	c.scratchpadUnsyncedRecords.set("file:/old.md", { text: "unsynced" });
	assert.equal(c.hasUnsyncedStudioMetadata(), true, "an unselected document's failed metadata write protects unload");
});

test("metadata mutation consent rejects edit, source, association, and overlapping-action ABA", () => {
	const { c } = baseHarness();
	c.scratchpadAssociation = c.currentDescriptor;
	c.reviewNotesAssociation = c.currentDescriptor;
	for (const [capture, valid, mutate] of [
		["captureScratchpadMutationConsent", "scratchpadMutationConsentIsCurrent", () => { c.scratchpadEditGeneration += 2; }],
		["captureScratchpadMutationConsent", "scratchpadMutationConsentIsCurrent", () => { c.editorSourceGeneration += 2; }],
		["captureScratchpadMutationConsent", "scratchpadMutationConsentIsCurrent", () => { c.scratchpadAssociationGeneration += 2; }],
		["captureReviewNotesMutationConsent", "reviewNotesMutationConsentIsCurrent", () => { c.reviewNotesEditGeneration += 2; }],
		["captureReviewNotesMutationConsent", "reviewNotesMutationConsentIsCurrent", () => { c.editorSourceGeneration += 2; }],
		["captureReviewNotesMutationConsent", "reviewNotesMutationConsentIsCurrent", () => { c.reviewNotesActionGeneration += 1; }],
	]) {
		const consent = c[capture]();
		assert.equal(c[valid](consent), true);
		mutate();
		assert.equal(c[valid](consent), false);
	}
});

test("metadata confirmations and recent actions recheck their exact destination", () => {
	const recent = section("async function applyScratchpadRecentAction", "async function fetchScratchpadTextForDocumentKey");
	assert.match(recent, /captureScratchpadMutationConsent\(\)/);
	assert.ok((recent.match(/destinationIsCurrent\(\)/g) || []).length >= 4);
	assert.match(recent, /Replace and save over the current scratchpad/);
	const deletes = section("async function deleteReviewNote", "function convertReviewNoteToAnnotation");
	assert.equal((deletes.match(/captureReviewNotesMutationConsent\(\)/g) || []).length, 2);
	assert.equal((deletes.match(/reviewNotesMutationConsentIsCurrent\(consent\)/g) || []).length, 2);
	const clear = section("if (scratchpadClearBtn)", "if (saveAnnotatedBtn)");
	assert.match(clear, /captureScratchpadMutationConsent\(\)/);
	assert.match(clear, /scratchpadMutationConsentIsCurrent\(consent\)/);
});

test("the browser adapter captures validated review-note and scratchpad keys with annotations", () => {
	const persist = section("function persistWorkspaceStateNow", "function scheduleWorkspacePersistence");
	const recoveryExtra = section("function bufferRecoveryExtra", "function syncBufferRecoveryMenuAccess");
	assert.match(persist, /metadata: \{ annotationsEnabled, \.\.\.getCurrentMetadataAssociationSnapshot\(\) \}/);
	assert.match(recoveryExtra, /metadata: \{ annotationsEnabled, \.\.\.getCurrentMetadataAssociationSnapshot\(\) \}/);
	assert.match(source, /metadataAssociations: selected && selected\.metadata/);
});

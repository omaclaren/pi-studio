import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import * as hosting from "../shared/studio-document-host-client.js";
import { createStudioBuffer } from "../shared/studio-buffer-store.js";
const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
function section(start, end) {
	const a = source.indexOf(start), b = source.indexOf(end, a);
	assert(a >= 0 && b > a); return source.slice(a, b);
}
function facts() {
	const entry = structuredClone(createStudioBuffer({ id: "retired-placeholder", role: "document" }));
	return { retired: true, adoptionConfirmed: true, editorText: "", metadataPending: false, operationPending: false,
		boundBufferId: entry.id, editorSourceState: structuredClone(entry.sourceState), editorResourceDir: entry.resourceDir,
		editorBaselineText: entry.baselineText, editorDiskRevision: entry.diskRevision,
		snapshot: { mode: "editor-only", selectedBufferId: entry.id, buffers: [entry] }, backup: { record: null, error: null } };
}
test("retirement permission requires adopted ownership and only a pristine empty source", () => {
	assert.equal(typeof hosting.studioDocumentRetiredViewCanClose, "function");
	assert.equal(hosting.studioDocumentRetiredViewCanClose(facts()), true);
	const changes = [
		f => { f.retired = false; }, f => { f.adoptionConfirmed = false; },
		f => { f.editorText = "late DOM draft"; }, f => { f.metadataPending = true; }, f => { f.operationPending = true; },
		f => { f.backup = null; }, f => { f.backup.record = { document: "keep" }; }, f => { f.backup.error = { reason: "corrupt" }; },
		f => { f.snapshot.mode = "full"; }, f => { f.snapshot.buffers.push(createStudioBuffer({ id: "kept-prompt", role: "prompt" })); },
		f => { f.snapshot.selectedBufferId = "other"; }, f => { f.snapshot.buffers[0].text = "late model draft"; },
		f => { f.snapshot.buffers[0].baselineText = "baseline"; }, f => { f.snapshot.buffers[0].sourceState.path = "/kept.md"; },
		f => { f.snapshot.buffers[0].metadata.reviewNotesKey = "external notes"; }, f => { f.snapshot.buffers[0].metadata.scratchpadKey = "external scratchpad"; },
		f => { f.snapshot.buffers[0].resourceDir = "/resources"; }, f => { f.snapshot.buffers[0].diskRevision = "unknown"; },
		f => { f.snapshot.buffers[0] = {}; },
	];
	for (const change of changes) { const f = facts(); change(f); assert.equal(hosting.studioDocumentRetiredViewCanClose(f), false, change.toString()); }
});
function harness(safe = true) {
	let beforeUnload;
	const c = { documentHostingEnabled: true, documentHostingRetired: true, documentHostingRetirementAdopted: false, documentHostingController: null, documentOpenController: null, documentHostingSaveResolution: null,
		documentHostingCanCloseRetired: () => safe, flushes: 0, warnings: 0, closes: 0,
		bufferRecoveryEnabled: true, bufferRecoveryNavigationConsent: null, bufferRecoveryClient: { needsUnloadConfirmation: () => true },
		recoveryConsentIsCurrent: () => false, hasUnsyncedStudioMetadata: () => false,
		flushStudioNavigationPersistence: () => c.flushes++, renderStatus: () => c.warnings++, setStatus: () => c.warnings++,
		window: { addEventListener: (name, fn) => { assert.equal(name, "beforeunload"); beforeUnload = fn; }, close: () => c.closes++ },
	};
	vm.createContext(c);
	vm.runInContext(section('window.addEventListener("beforeunload", (event) => {', 'editorViewSelect.addEventListener("change"'), c);
	return { c, unload() { const event = { prevented: false, preventDefault() { this.prevented = true; } }; beforeUnload(event); return event; } };
}
test("adopted empty retired view does not flush a placeholder or block its own closure", () => {
	const h = harness(); assert.equal(h.unload().prevented, false); assert.equal(h.c.flushes, 0); assert.equal(h.c.warnings, 0);
});
test("retired navigation flush also skips the disposable placeholder", () => {
	const h = harness(), c = h.c;
	Object.assign(c, { stopFooterSpinner() {}, flushWorkspacePersistence: () => c.flushes++, scratchpadDirty: false, reviewNotesDirty: false,
		scratchpadUnsyncedRecords: new Map(), reviewNotesUnsyncedRecords: new Map() });
	vm.runInContext(section("function flushStudioNavigationPersistence()", "updatePaneFocusButtons();\n      window.addEventListener"), c);
	c.flushStudioNavigationPersistence(); assert.equal(c.flushes, 0);
});
test("unadopted or valuable source still flushes and warns", () => {
	const h = harness(false); assert.equal(h.unload().prevented, true); assert.equal(h.c.flushes, 1); assert.equal(h.c.warnings, 1);
});
test("empty-text DOM backing and binding changes cannot silently retire", () => {
	for (const change of [
		f => { f.boundBufferId = "departed-document"; },
		f => { f.editorSourceState.path = "/late.md"; }, f => { f.editorSourceState.label = "Late rename"; },
		f => { f.editorSourceState.draftId = "late-draft"; }, f => { f.editorSourceState.source = "upload"; },
		f => { f.editorResourceDir = "/late/resources"; }, f => { f.editorBaselineText = "late baseline"; },
		f => { f.editorDiskRevision = "late disk revision"; }, f => { delete f.editorSourceState; },
	]) { const f = facts(); change(f); assert.equal(hosting.studioDocumentRetiredViewCanClose(f), false, change.toString()); }
});
test("unsafe retirement warns even when ordinary recovery appears acknowledged", () => {
	const h = harness(false); h.c.bufferRecoveryClient.needsUnloadConfirmation = () => false;
	h.c.bufferRecoveryNavigationConsent = {}; h.c.recoveryConsentIsCurrent = () => true;
	assert.equal(h.unload().prevented, true); assert.equal(h.c.warnings, 1);
});
test("an unresolved copy warns even with acknowledged ordinary recovery", () => {
	const h = harness(false); h.c.documentHostingRetired = false; h.c.bufferRecoveryClient.needsUnloadConfirmation = () => false;
	h.c.bufferRecoveryNavigationConsent = {}; h.c.recoveryConsentIsCurrent = () => true;
	h.c.documentHostingController = { needsUnloadConfirmation: () => true }; assert.equal(h.unload().prevented, true);
});
test("an unresolved file opening cannot borrow an earlier navigation discard consent", () => {
	const h = harness(false); h.c.documentHostingRetired = false; h.c.bufferRecoveryClient.needsUnloadConfirmation = () => false;
	h.c.bufferRecoveryNavigationConsent = {}; h.c.recoveryConsentIsCurrent = () => true;
	h.c.documentOpenController = { active: () => true }; assert.equal(h.unload().prevented, true);
	assert.match(h.c.bufferRecoveryIssue, /file opening is unresolved/);
});
function replacementHarness() {
	const id = "document", entry = { id, sourceState: {}, metadata: {} }, authority = { ok: true, bufferId: id, generation: 1, documentEpoch: 3, expectedRevision: "revision" };
	const remote = { ok: true, revision: "revision", documents: { [id]: 3 }, pendingSaves: [] };
	const c = { documentHostingEnabled: true, documentHostingGeneration: 1, pendingSaveOperations: new Map(), documentHostingRetired: false, documentHostingSaveResolution: null, documentHostingFilePreparationBufferId: null,
		bufferRecoveryClient: { snapshot: () => ({ buffers: [entry] }), hostingAuthority: () => authority },
		settleDocumentHostingMetadata: async () => {}, documentHostingMetadataIsIdle: () => true, requestBufferRecovery: async () => remote };
	vm.createContext(c); vm.runInContext(section("      async function prepareDocumentHostingReplacement(", "      async function prepareDocumentHosting(direction)"), c);
	return { c, id, remote, authority, run: (current = () => true) => c.prepareDocumentHostingReplacement(id, current) };
}
test("replacement refuses an unresolved save for the affected buffer", async () => {
	const h = replacementHarness(); h.remote.pendingSaves.push({ bufferId: h.id }); await assert.rejects(h.run(), /save/i);
});
test("replacement waits for metadata completion before checking server ownership", async () => {
	const h = replacementHarness(); let finish; const order = [];
	h.c.settleDocumentHostingMetadata = () => new Promise(resolve => { finish = resolve; }); h.c.requestBufferRecovery = async () => { order.push("checked"); return h.remote; };
	const ready = h.run(); assert.deepEqual(order, []); finish(); assert.equal((await ready)(), true); assert.deepEqual(order, ["checked"]);
});
test("a different buffer's pending save does not block replacement", async () => {
	const h = replacementHarness(); h.remote.pendingSaves.push({ bufferId: "other" }); assert.equal((await h.run())(), true);
});
test("replacement cannot borrow a changed epoch or recovery revision", async () => {
	for (const change of [h => { h.remote.documents[h.id]++; }, h => { h.remote.revision = "other"; }]) {
		const h = replacementHarness(); change(h); await assert.rejects(h.run(), /changed|ownership/i);
	}
});
test("replacement consent is rechecked after metadata and remote awaits", async () => {
	const h = replacementHarness(); let current = true; h.c.requestBufferRecovery = async () => { current = false; return h.remote; };
	await assert.rejects(h.run(() => current), /changed/i);
});
test("late metadata or file-save producers revoke the final synchronous gate", async () => {
	const h = replacementHarness(), gate = await h.run(); assert.equal(gate(), true);
	h.c.documentHostingMetadataIsIdle = () => false; assert.equal(gate(), false); h.c.documentHostingMetadataIsIdle = () => true;
	h.c.pendingSaveOperations.set("save", { hosting: { bufferId: h.id } }); assert.equal(gate(), false);
});

test("hosted Pi replacement waits for its gate and cannot clear a newer operation", async () => {
	for (const superseded of [false, true]) {
		let finish; const gate = new Promise(resolve => { finish = resolve; });
		const c = { documentHostingEnabled: true, isWatchedFilePreview: false, bufferPageClosed: false,
			pendingRequestId: "pi-load", pendingKind: "load", text: "kept", busy: true,
			acceptPiEditorCallback: () => true, captureEditorAsyncConsent: () => ({ bufferId: "doc" }), editorAsyncConsentIsCurrent: () => true,
			studioModalBlocksDraftAction: () => false, prepareDocumentHostingReplacement: async (_id, current) => { await gate; return current; },
			setEditorText: text => { c.text = text; }, normalizePiEditorDraftSnapshot: () => null, setLinkedPiEditorDraftSnapshot() {}, setSourceState() {},
			setBusy: busy => { c.busy = busy; }, setWsState() {}, setStatus() {}, abandonPendingSaveRequest: () => { throw Error("must not clear a newer action"); } };
		vm.createContext(c);
		vm.runInContext(section("      async function applyDocumentHostingReplacement(", "      async function prepareDocumentHostingReplacement("), c);
		vm.runInContext("function deliver(message) {" + section('        if (message.type === "editor_snapshot")', '        if (message.type === "studio_document")') + "}", c);
		c.deliver({ type: "editor_snapshot", requestId: "pi-load", content: "loaded" }); assert.equal(c.text, "kept");
		if (superseded) c.pendingRequestId = "new-action"; finish(); await new Promise(resolve => setImmediate(resolve));
		assert.equal(c.text, superseded ? "kept" : "loaded"); assert.equal(c.busy, superseded);
	}
});
test("metadata idle checks protect the affected associations without blocking unrelated ones", () => {
	const c = { bufferRecoveryClient: { snapshot: () => ({ buffers: [{ id: "doc", sourceState: {}, metadata: { scratchpadKey: "scratch", reviewNotesKey: "notes" } }] }) },
		describeStudioDocument: () => ({ key: "derived" }), scratchpadAssociation: { key: "other" }, reviewNotesAssociation: { key: "other" },
		scratchpadDirty: true, reviewNotesDirty: true, scratchpadUnsyncedRecords: new Map(), reviewNotesUnsyncedRecords: new Map(), scratchpadWriteChains: new Map(), reviewNotesWriteChains: new Map() };
	vm.createContext(c); vm.runInContext(section("      function documentHostingMetadataIsIdle(", "      async function applyDocumentHostingReplacement("), c);
	assert.equal(c.documentHostingMetadataIsIdle("doc"), true);
	for (const [collection, key] of [[c.scratchpadUnsyncedRecords, "scratch"], [c.reviewNotesWriteChains, "notes"], [c.scratchpadWriteChains, "derived"]]) {
		collection.set(key, {}); assert.equal(c.documentHostingMetadataIsIdle("doc"), false); collection.clear();
	}
	c.reviewNotesAssociation.key = "notes"; assert.equal(c.documentHostingMetadataIsIdle("doc"), false);
});

test("application retirement predicate checks live DOM associations and backing", () => {
	const f = facts(), { c } = harness();
	Object.assign(c, { helpers: hosting, documentHostingRetirementAdopted: true, documentHostingDomId: f.boundBufferId,
		sourceTextEl: { value: "" }, sourceState: f.editorSourceState, fileBackedBaselineText: "", fileBackedDiskRevision: null,
		getCurrentResourceDirValue: () => "", bufferRecoveryClient: { snapshot: () => f.snapshot, handoffBackup: () => f.backup },
		scratchpadWriteChains: new Map(), reviewNotesWriteChains: new Map(), pendingSaveOperations: new Map(), pendingPiEditorDraftSnapshots: new Map(),
		uiBusy: false, pendingEditorRefresh: null, studioModalBlocksDraftAction: () => false,
		scratchpadAssociation: null, reviewNotesAssociation: null, scratchpadText: "", reviewNotes: [] });
	vm.runInContext(section("documentHostingCanCloseRetired = () => helpers.", "documentHostingController = helpers."), c);
	assert.equal(c.documentHostingCanCloseRetired(), true);
	c.sourceState.path = "/late.md"; assert.equal(c.documentHostingCanCloseRetired(), false); c.sourceState.path = null;
	for (const [key, value] of [["scratchpadAssociation", { key: "late" }], ["reviewNotesAssociation", { key: "late" }],
		["scratchpadText", "late note"], ["reviewNotes", [{ text: "late comment" }]]]) {
		const before = c[key]; c[key] = value; assert.equal(c.documentHostingCanCloseRetired(), false, key); c[key] = before;
	}
});
test("normal nonhosting recovery still warns and never consults retirement permission", () => {
	const h = harness(); h.c.documentHostingEnabled = false; h.c.documentHostingCanCloseRetired = () => { throw Error("not hosted"); };
	assert.equal(h.unload().prevented, true); assert.equal(h.c.flushes, 1);
});
function closeCallback(c) {
	const code = section("closeRetired: () => {", "open: (url, resumed) =>").trim().replace(/,$/, "");
	return vm.runInContext("({" + code + "}).closeRetired", c);
}
test("adoption callback confirms retirement before checking safe closure", () => {
	const { c } = harness(); c.documentHostingCanCloseRetired = () => c.documentHostingRetirementAdopted;
	closeCallback(c)(); assert.equal(c.documentHostingRetirementAdopted, true); assert.equal(c.closes, 1);
});
test("adoption does not automatically close a source with late local work", () => {
	const { c } = harness(false); closeCallback(c)(); assert.equal(c.closes, 0); assert.equal(c.warnings, 1);
});

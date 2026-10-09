import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
function section(start, end) {
	const a = source.indexOf(start), b = source.indexOf(end, a);
	assert(a >= 0 && b > a, start); return source.slice(a, b);
}
function harness() {
	let next = 0, decide;
	const requests = [], reads = [], inserts = [], focuses = [], timers = [], imports = [];
	class Element {}
	const c = {
		bufferRecoveryEnabled: true, documentHostingEnabled: false, bufferPageClosed: false, bufferConnectionGeneration: 0,
		bufferId: "one", sourceKey: "source-a", editorContentGeneration: 0, editorView: "markdown", editorLanguage: "markdown",
		sourceTextEl: { value: "original text", selectionStart: 3, selectionEnd: 3, focus() { focuses.push("editor"); } },
		sourceState: { label: "A", path: "/a.md" },
		getEditorDraftSourceKey: () => c.sourceKey,
		pendingRequestId: null, pendingKind: null, pendingSaveOperations: new Map(), uiBusy: false,
		pendingPiEditorLoad: null, pendingPiEditorLink: null, pendingPiEditorClear: null, pendingTerminalDocument: null,
		activeFileImport: null, studioImportDecisionOpen: false, studioDecisionState: null,
		completionSuggestionState: null, completionSuggestionInFlight: false, completionSuggestionRequestId: null,
		completionSuggestionPendingSnapshot: null, completionSuggestionRefocusEditorOnResult: false,
		completionSuggestionPanelEl: null, completionSuggestionTextEl: null, completionSuggestionMetaEl: null,
		isEditorOnlyMode: false, isWatchedFilePreview: false, suggestCompletionBtn: {}, importFileBtn: null, Element,
		document: { activeElement: null, body: {}, documentElement: {} }, window: { setTimeout(fn) { timers.push(fn); } },
		modal: false, studioModalBlocksDraftAction: () => c.modal || Boolean(c.studioDecisionState),
		makeRequestId: () => "request-" + ++next,
		beginUiAction(kind) { c.pendingKind = kind; c.uiBusy = true; return c.pendingRequestId = c.makeRequestId(); },
		sendMessage(message) { requests.push(message); return true; },
		syncActionButtons() {}, setStatus(text) { c.status = text; }, status: "initial status",
		getCompletionSuggestionContextText: () => "", getCompletionSuggestionModelSelection: () => null,
		getCompletionSuggestionModelLabel: () => "test model", completionSuggestionContextMode: "cursor",
		getCurrentResourceDirValue: () => "/", refreshResponseUi() {}, detectLanguageFromName: () => "markdown", setEditorLanguage() {},
		setEditorText(text) { imports.push(text); c.sourceTextEl.value = text; c.editorContentGeneration++; },
		setSourceState(state) { c.sourceState = state; c.sourceKey += "-changed"; },
		applySourceTextEdit(text, start, end) { inserts.push(text); c.sourceTextEl.value = text; c.editorContentGeneration++; },
		snapshotStudioScrollablePositions: () => [], setEditorView(value) { c.editorView = value; }, scheduleStudioScrollablePositionRestore() {},
		setBusy(value) { c.uiBusy = value; }, setWsState() {}, clearArmedTitleAttention() {},
		requestStudioTextInput() { c.studioDecisionState = {}; return new Promise(resolve => { decide = resolve; }); },
		requestStudioConfirmation() { c.studioDecisionState = {}; return new Promise(resolve => { decide = resolve; }); },
		finishStudioDecision(value) { c.studioDecisionState = null; decide(value); },
		fetchStudioJson(path, options) { return new Promise((resolve, reject) => reads.push({ path, options, resolve, reject })); },
		fileInput: { files: [], addEventListener(type, fn) { this[type] = fn; }, click() {} },
		FileReader: class { constructor() { reads.push(this); } readAsText() {} },
	};
	c.bufferRecoveryClient = { snapshot: () => ({ selectedBufferId: c.bufferId }) };
	c.document.activeElement = c.sourceTextEl;
	vm.createContext(c);
	vm.runInContext(section("function captureEditorConsent()", "function sendEditorSaveAsRequest("), c);
	vm.runInContext(section("function hideCompletionSuggestion()", "function getSourceTextLineEditBounds("), c);
	vm.runInContext(section("function applyImportedFileCopy(text, filename)", 'if (sourceEditorWrapEl && typeof ResizeObserver'), c);
	return { c, requests, reads, inserts, focuses, timers, imports,
		decide(value) { c.studioDecisionState = null; decide(value); },
		result(fields = {}) { return c.handleCompletionSuggestionServerMessage({ type: "completion_suggestion_result", requestId: requests.at(-1).requestId, suggestion: "NEW", ...fields }); },
	};
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const mutations = [
	c => { c.sourceTextEl.value = "later typing"; c.editorContentGeneration++; },
	c => { c.editorContentGeneration += 2; }, // type then undo to identical bytes
	c => { c.sourceKey = "source-b"; },
	c => { c.bufferId = "two"; },
	c => { c.bufferRecoveryClient = { snapshot: () => ({ selectedBufferId: "one" }) }; },
	c => { c.bufferConnectionGeneration++; },
	c => { c.bufferPageClosed = true; },
];

test("suggestion responses require exact pending ownership and cannot be replayed", () => {
	const h = harness(), c = h.c; c.requestCompletionSuggestion();
	for (const requestId of [undefined, "wrong"]) {
		h.result({ requestId }); assert.equal(c.completionSuggestionState, null); assert(c.completionSuggestionInFlight);
	}
	h.result(); assert.equal(c.completionSuggestionState.suggestion, "NEW");
	c.insertCompletionSuggestion(); assert.deepEqual(h.inserts, ["oriNEWginal text"]);
	h.result(); assert.equal(c.completionSuggestionState, null); assert.equal(h.inserts.length, 1);
});

test("late suggestions reject text/source/buffer/store/connection changes including text ABA", () => {
	for (const mutate of mutations) {
		const h = harness(), c = h.c; c.requestCompletionSuggestion(); mutate(c);
		const current = c.sourceTextEl.value; h.result();
		assert.equal(c.sourceTextEl.value, current); assert.equal(c.completionSuggestionState, null);
		assert.equal(c.completionSuggestionInFlight, false); assert.equal(h.focuses.length, 0);
	}
});

test("ready suggestions recheck ownership before Insert or Regenerate; cursor movement alone is harmless", () => {
	for (const action of ["insert", "regenerate"]) {
		const h = harness(), c = h.c; c.requestCompletionSuggestion(); h.result(); c.editorContentGeneration += 2;
		if (action === "insert") c.insertCompletionSuggestion(); else c.requestCompletionSuggestion({ regenerate: true });
		assert.equal(h.inserts.length, 0); assert.equal(h.requests.length, 1); assert.equal(c.completionSuggestionState, null);
	}
	const h = harness(); h.c.requestCompletionSuggestion(); h.c.sourceTextEl.selectionStart = 9; h.result(); h.c.insertCompletionSuggestion();
	assert.deepEqual(h.inserts, ["oriNEWginal text"]);
});

test("cancellation, disconnect and stale progress cannot resurrect suggestions or steal status", () => {
	const h = harness(), c = h.c; c.requestCompletionSuggestion(); const id = c.completionSuggestionRequestId;
	c.cancelCompletionSuggestion(); const status = c.status;
	c.handleCompletionSuggestionServerMessage({ type: "completion_suggestion_progress", requestId: id, message: "late progress" });
	assert.equal(c.status, status); h.result({ requestId: id }); assert.equal(c.completionSuggestionState, null);
	c.requestCompletionSuggestion(); c.clearEditorAsyncOperations();
	h.result(); assert.equal(c.completionSuggestionState, null); assert.equal(c.completionSuggestionInFlight, false);
});

test("suggestion refocus respects later views, modals, focus and the deferred focus owner", () => {
	for (const change of [c => { c.editorView = "preview"; }, c => { c.modal = true; }, c => { c.document.activeElement = {}; }]) {
		const h = harness(); h.c.requestCompletionSuggestion(); change(h.c); h.result();
		assert.equal(h.timers.length, 0); assert.equal(h.focuses.length, 0);
	}
	const h = harness(); h.c.requestCompletionSuggestion(); h.result(); assert.equal(h.timers.length, 1);
	h.c.sourceKey = "other"; h.timers[0](); assert.equal(h.focuses.length, 0);
});

test("path imports keep intervening edits before and after fetching, including ABA", async () => {
	for (const when of ["dialog", "fetch"]) for (const mutate of mutations) {
		const h = harness(), c = h.c, pending = c.openStudioFileCopyDialog();
		if (when === "dialog") mutate(c);
		h.decide("/import.md"); await tick();
		if (when === "fetch") { mutate(c); h.reads[0].resolve({ text: "imported", filename: "import.md" }); }
		await pending; assert.equal(h.imports.length, 0); assert.equal(c.activeFileImport, null);
		assert.equal(h.reads.length, when === "dialog" ? 0 : 1);
	}
});

test("imports apply once and an older path result cannot overtake a newer request", async () => {
	const h = harness(), c = h.c;
	const first = c.openStudioFileCopyDialog(); h.decide("/first.md"); await tick();
	const second = c.openStudioFileCopyDialog(); h.decide("/second.md"); await tick();
	h.reads[1].resolve({ text: "second", filename: "second.md" }); await second;
	h.reads[0].resolve({ text: "first", filename: "first.md" }); await first;
	assert.deepEqual(h.imports, ["second"]); assert.equal(c.sourceState.path, null); assert.equal(c.activeFileImport, null);
});

test("browser FileReader keeps its originating dialog and rejects stale/replayed reads", async () => {
	for (const stale of [false, true]) {
		const h = harness(), c = h.c, pending = c.openStudioFileCopyDialog();
		c.chooseStudioFileCopyWithBrowser(); c.fileInput.files = [{ name: "local.md" }]; c.fileInput.change();
		const reader = h.reads[0]; reader.result = "from browser";
		if (stale) c.editorContentGeneration += 2;
		reader.onload(); await pending; reader.onload();
		assert.deepEqual(h.imports, stale ? [] : ["from browser"]);
	}
	const h = harness(), c = h.c, pending = c.openStudioFileCopyDialog();
	c.fileInput.files = [{ name: "local.md" }]; c.fileInput.change();
	const reader = h.reads[0]; reader.result = "old read";
	h.decide(null); c.studioDecisionState = { other: true }; reader.onload(); await pending;
	assert.equal(h.imports.length, 0); assert.equal(c.studioDecisionState.other, true);
});

test("a submitted path supersedes an earlier browser read without cancelling the path result", async () => {
	const h = harness(), c = h.c, pending = c.openStudioFileCopyDialog();
	c.fileInput.files = [{ name: "local.md" }]; c.fileInput.change();
	const reader = h.reads[0]; reader.result = "old browser result";
	h.decide("/path.md"); await tick(); reader.onload();
	assert.equal(h.imports.length, 0);
	h.reads[1].resolve({ text: "path result" }); await pending;
	assert.deepEqual(h.imports, ["path result"]);
});

test("Pi editor results reject unknown/replayed IDs and loads reject later text/source changes", () => {
	for (const mutate of mutations) {
		const h = harness(), c = h.c;
		c.pendingPiEditorLoad = { requestId: "load", consent: c.captureEditorAsyncConsent() };
		assert.equal(c.acceptPiEditorCallback({ requestId: "other", content: "x" }, "load"), false);
		assert(c.pendingPiEditorLoad); mutate(c);
		assert.equal(c.acceptPiEditorCallback({ requestId: "load", content: "x" }, "load"), false);
		assert.equal(c.pendingPiEditorLoad, null);
		assert.equal(c.acceptPiEditorCallback({ requestId: "load", content: "x" }, "load"), false);
	}
	const h = harness(), c = h.c;
	c.pendingPiEditorLoad = { requestId: "load", consent: c.captureEditorAsyncConsent() };
	assert.equal(c.acceptPiEditorCallback({ requestId: "load", content: "fresh" }, "load"), true);
});

test("Pi staging/clear acknowledgements preserve later typing but cannot relink another source", () => {
	for (const kind of ["link", "clear"]) for (const changedSource of [false, true]) {
		const h = harness(), c = h.c, slot = kind === "link" ? "pendingPiEditorLink" : "pendingPiEditorClear";
		c[slot] = { requestId: "staged", consent: c.captureEditorAsyncConsent() };
		c.sourceTextEl.value = "later Studio edits"; c.editorContentGeneration++;
		if (changedSource) c.sourceKey = "another source";
		assert.equal(c.acceptPiEditorCallback({ requestId: "staged" }, kind), !changedSource);
		assert.equal(c[slot], null); assert.equal(c.sourceTextEl.value, "later Studio edits");
	}
});

test("Pi callback rejection and correlated errors do not clear a newer unrelated action", () => {
	const h = harness(), c = h.c;
	c.pendingPiEditorLoad = { requestId: "load", consent: c.captureEditorAsyncConsent() };
	c.pendingPiEditorLink = { requestId: "newer", consent: c.captureEditorAsyncConsent() };
	c.pendingRequestId = "newer"; c.uiBusy = true; c.editorContentGeneration++;
	c.acceptPiEditorCallback({ requestId: "load", content: "stale" }, "load");
	assert.equal(c.pendingRequestId, "newer"); assert.equal(c.uiBusy, true);
	c.clearPiEditorOperations("load"); assert(c.pendingPiEditorLink);
	c.clearPiEditorOperations("newer"); assert.equal(c.pendingPiEditorLink, null);
});

test("unsolicited terminal file loads require live local consent and do not interrupt another dialog", async () => {
	for (const accept of [false, true]) for (const stale of [false, true]) {
		const h = harness(), c = h.c; let applied = 0;
		const pending = c.confirmTerminalDocumentLoad({ document: { label: "sent.md" } }, () => applied++);
		if (stale) c.editorContentGeneration += 2;
		h.decide(accept); await pending;
		assert.equal(applied, accept && !stale ? 1 : 0); assert.equal(c.pendingTerminalDocument, null);
	}
	const h = harness(), c = h.c; c.modal = true;
	await c.confirmTerminalDocumentLoad({ document: { label: "sent.md" } }, () => assert.fail("busy replacement"));
	assert.equal(c.pendingTerminalDocument, null);
});

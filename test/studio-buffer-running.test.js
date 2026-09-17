import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
function section(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert(a >= 0 && b > a, start); return source.slice(a, b);
}
function gateHarness() {
  const c = vm.createContext({ bufferSwitchingEnabled: true, bufferRecoveryClient: {}, workspacePersistenceReady: true,
    bufferBindingInProgress: false, bufferRecoveryInitializing: false, bufferPageClosed: false,
    uiBusy: true, pendingKind: "direct", pendingRequestId: "run-1", ws: { readyState: 1 }, WebSocket: { OPEN: 1 }, wsState: "Submitting",
    replBusy: false, completionSuggestionInFlight: false, pendingEditorRefresh: null, responseReplacementPending: false,
    pendingSaveOperations: new Map(), pendingPiEditorDraftSnapshots: new Map(), modal: false, studioModalBlocksDraftAction: () => c.modal });
  vm.runInContext(section("function studioBuffersCanSwitch(", "function studioBufferScrollPosition("), c);
  return c;
}

test("only a connected identified direct Run permits switching through the UI busy fence", () => {
  const c = gateHarness();
  assert.equal(c.studioBuffersCanSwitch(), true);
  for (const kind of [null, "unknown", "save", "save_as", "refresh", "compact", "critique", "show-me", "annotation", "quiz", "open_editor_only"]) {
    c.pendingKind = kind; assert.equal(c.studioBuffersCanSwitch(), false, String(kind));
  }
  c.pendingKind = "direct";
  for (const id of [null, ""]) { c.pendingRequestId = id; assert.equal(c.studioBuffersCanSwitch(), false); }
  c.pendingRequestId = "run-1";
  for (const readyState of [0, 2, 3]) { c.ws.readyState = readyState; assert.equal(c.studioBuffersCanSwitch(), false); }
  c.ws.readyState = 1; c.ws = null; assert.equal(c.studioBuffersCanSwitch(), false);
  c.ws = { readyState: 1 }; c.wsState = "Connecting"; assert.equal(c.studioBuffersCanSwitch(), false);
  c.wsState = "Submitting"; c.bufferSwitchingEnabled = false; assert.equal(c.studioBuffersCanSwitch(), false);
});

test("a direct Run does not bypass local operations, recovery or modal ownership", () => {
  const c = gateHarness();
  for (const key of ["bufferBindingInProgress", "bufferRecoveryInitializing", "bufferPageClosed", "replBusy", "completionSuggestionInFlight", "pendingEditorRefresh", "responseReplacementPending", "modal"]) {
    const before = c[key]; c[key] = true; assert.equal(c.studioBuffersCanSwitch(), false, key); c[key] = before;
  }
  for (const key of ["pendingSaveOperations", "pendingPiEditorDraftSnapshots"]) {
    c[key].set("owned", {}); assert.equal(c.studioBuffersCanSwitch(), false, key); c[key].clear();
  }
  c.modal = true; assert.equal(c.studioBuffersCanSwitch(true), true, "focus-return calculation may ignore the dialog, execution may not");
  c.modal = false; c.workspacePersistenceReady = false; assert.equal(c.studioBuffersCanSwitch(), false);
});

test("opening or replacing a buffer stays fenced during Run even when selecting existing buffers is safe", async () => {
  const c = gateHarness();
  c.bufferRecoveryClient.capture = () => assert.fail("must not start replacement while running");
  c.setStatus = () => {};
  vm.runInContext(section("async function promptStudioBufferDocumentPath()", "function syncBufferRecoveryMenuAccess()"), c);
  assert.equal(await c.promptStudioBufferDocumentPath(), false);
  assert.equal(await c.openStudioBufferDocument("/other.md", {}), false);
});

function responseHarness({ document = true, switching = true } = {}) {
  const calls = [], pending = { markdown: "older queued" };
  const c = vm.createContext({ bufferSwitchingEnabled: switching, isStudioDocumentBufferView: () => document,
    pendingRequestId: "run-1", pendingKind: "direct", pendingPiEditorDraftSnapshots: new Map(), queuedLatestResponse: pending,
    stickyStudioKind: "direct", agentBusyFromServer: true, pendingResponseScrollReset: false,
    normalizeHistoryKind: v => v, setBusy: value => { c.uiBusy = value; }, setWsState: value => { c.wsState = value; }, uiBusy: true,
    setResponseHistory: (items, options) => { calls.push({ type: "history", items, ...options }); return items.length > 0; },
    handleIncomingResponse: (...args) => calls.push({ type: "response", args }),
    finishTrackedStudioActivity: () => {}, setStatus: () => {}, maybeShowTitleAttentionForCompletedRequest: () => {}, updateResultActionButtons: () => {} });
  vm.runInContext("function deliver(message) {" + section('if (message.type === "response") {', 'if (message.type === "latest_response") {') + "}", c);
  return { c, calls, pending, deliver: extra => c.deliver({ type: "response", requestId: "run-1", kind: "direct", markdown: "R2", thinking: "T2", timestamp: 2000, ...extra }) };
}

test("completed Run while Document is selected queues the response without selecting latest history", () => {
  const h = responseHarness(); const items = [{ id: "r1", markdown: "R1" }, { id: "r2", markdown: "R2" }];
  h.deliver({ responseHistory: items });
  assert.equal(h.c.queuedLatestResponse?.markdown, "R2");
  assert.equal(h.c.queuedLatestResponse?.thinking, "T2");
  assert.equal(h.c.pendingRequestId, null); assert.equal(h.c.uiBusy, false);
  assert.equal(h.calls[0].autoSelectLatest, false); assert.equal(h.calls[0].preserveSelection, true);
  assert.equal(h.c.pendingResponseScrollReset, false);
});

test("historyless Run completion is deferred for Document rather than replacing its preview owner", () => {
  const h = responseHarness(); h.deliver();
  assert.equal(h.c.queuedLatestResponse?.markdown, "R2");
  assert.deepEqual(h.calls, []); assert.equal(h.c.pendingResponseScrollReset, false);
});

test("visible Prompt and ordinary single-editor Run completion retain established immediate response behavior", () => {
  for (const options of [{ document: false }, { switching: false }]) {
    const h = responseHarness(options); h.deliver();
    assert.equal(h.c.queuedLatestResponse, null); assert.equal(h.calls[0].type, "response");
    assert.equal(h.c.pendingResponseScrollReset, true);
  }
});

test("Run submission and late acceptance retain the original Prompt source, never the selected Document or newer text", () => {
  const c = gateHarness(), sent = []; let click, selected = "prompt";
  const raw = "Prompt with raw [an: Keep this exact draft.]";
  Object.assign(c, { uiBusy: false, pendingRequestId: null, pendingKind: null,
    sourceTextEl: { value: raw }, sourceState: { source: "file", path: "/same.md", draftId: null }, editorSourceGeneration: 1,
    bufferTransientStates: new Map([["prompt", { sourceGeneration: 1 }], ["document", { sourceGeneration: 1 }]]),
    bufferRecoveryClient: { snapshot: () => ({ selectedBufferId: selected }) }, getCurrentResourceDirValue: () => "/",
    linkedPiEditorDraftSnapshot: { fingerprint: "sha256:" + "a".repeat(64), byteLength: 17 },
    sendRunBtn: { addEventListener: (_type, handler) => { click = handler; } }, getAbortablePendingKind: () => null,
    requireStudioPromptForSend: () => selected === "prompt", prepareEditorTextForRunRequest: value => "prepared:" + value,
    beginUiAction: kind => { c.pendingKind = kind; c.uiBusy = true; return c.pendingRequestId = "run-1"; },
    sendMessage: message => { sent.push(message); return true; } });
  vm.runInContext(readFileSync(new URL("../client/studio-editor-draft-helpers.js", import.meta.url), "utf8"), c);
  c.submittedEditorDrafts = c.PiStudioEditorDraftHelpers.createSubmittedEditorDraftTracker();
  vm.runInContext(section("function normalizeStudioDiskRevision(", "function markFileBackedBaseline("), c);
  vm.runInContext(section('sendRunBtn.addEventListener("click",', "if (queueSteerBtn)"), c);
  vm.runInContext("function accept(message) {" + section('if (message.type === "run_accepted") {', 'if (message.type === "request_started") {') + "}", c);
  const promptKey = c.getEditorDraftSourceKey(); click({ detail: 1 });
  assert.equal(sent[0].text, "prepared:" + raw); assert.equal(c.studioBuffersCanSwitch(), false, "terminal disposition still fences switching");
  assert.equal(c.settleReservedPiEditorDraftSnapshot("run-1", { fingerprint: "sha256:" + "b".repeat(64), byteLength: 17 }), false);
  assert.equal(c.studioBuffersCanSwitch(), false);
  assert.equal(c.settleReservedPiEditorDraftSnapshot("run-1", sent[0].piEditorDraftSnapshot), true);
  assert.equal(c.studioBuffersCanSwitch(), true);
  selected = "document"; c.sourceTextEl.value = "Document notes"; c.accept({ type: "run_accepted", requestId: "run-1" });
  assert.equal(c.submittedEditorDrafts.matches(raw, promptKey), true);
  assert.equal(c.submittedEditorDrafts.matches(raw, c.getEditorDraftSourceKey()), false, "even identical paths cannot transfer submission identity");
  c.restoreReservedPiEditorDraftSnapshot("run-1"); assert.equal(c.linkedPiEditorDraftSnapshot, null, "duplicate disposition cannot link Document to the terminal draft");
  selected = "prompt"; c.sourceTextEl.value = raw + " later editing";
  assert.equal(c.submittedEditorDrafts.matches(c.sourceTextEl.value, c.getEditorDraftSourceKey()), false);
  c.bufferTransientStates.set("prompt", { sourceGeneration: 2 });
  assert.equal(c.submittedEditorDrafts.matches(raw, c.getEditorDraftSourceKey()), false, "real source replacement does not inherit acceptance");
});

test("recovery choices/reset stay locked throughout model activity, not just local busy operations", () => {
  const c = gateHarness(); c.agentBusyFromServer = true;
  vm.runInContext(section("function recoveryCanChangeWorkspace()", "function bufferRecoveryExtra()"), c);
  assert.equal(c.recoveryCanChangeWorkspace(), false);
  c.uiBusy = false; c.pendingRequestId = null; assert.equal(c.recoveryCanChangeWorkspace(), false);
  c.agentBusyFromServer = false; assert.equal(c.recoveryCanChangeWorkspace(), true);
});

function historyHarness(switching, document) {
  const rendered = [];
  const c = vm.createContext({ bufferSwitchingEnabled: switching, isStudioDocumentBufferView: () => document,
    bufferRecoveryClient: { snapshot: () => ({ activePromptId: "prompt" }) }, bufferTransientStates: new Map(),
    responseHistory: [{ id: "r1", markdown: "R1" }], responseHistoryIndex: 0, normalizeHistoryItem: item => item,
    normalizeHistoryKind: value => value || "annotation", normalizeForCompare: value => String(value || "").trim(),
    getSelectedHistoryItem: () => c.responseHistory[c.responseHistoryIndex], updateHistoryControls() {},
    refreshResponseUi: () => rendered.push("clear"), updateResultActionButtons() {}, selectHistoryIndex: index => { rendered.push(index); return true; } });
  vm.runInContext(section("function clearActiveResponseView(", "function updateHistoryControls()"), c);
  vm.runInContext(section("function handleIncomingResponse(", "function applyLatestPayload("), c);
  vm.runInContext(section("function applySelectedHistoryItem(", "function selectHistoryIndex("), c);
  vm.runInContext(section("function setResponseHistory(", "function getTraceHistoryContextLabel()"), c);
  return { c, rendered };
}

test("history updates cache the branch without reconstructing the selected Document preview, including empty history", () => {
  const h = historyHarness(true, true);
  assert.equal(h.c.setResponseHistory([{ id: "r1", markdown: "R1" }, { id: "r2", markdown: "R2" }], { preserveSelection: true, autoSelectLatest: false }), true);
  assert.equal(h.c.responseHistory.length, 2); assert.equal(h.c.responseHistoryIndex, 0); assert.deepEqual(h.rendered, []);
  assert.equal(h.c.latestResponseMarkdown, "R1", "copyable response cache follows the selected history without repainting Document");
  h.c.setResponseHistory([{ id: "r3", markdown: "R3" }]);
  assert.equal(h.c.latestResponseMarkdown, "R3", "branch replacement cannot leave a stale copyable response"); assert.deepEqual(h.rendered, []);
  assert.equal(h.c.setResponseHistory([]), false);
  assert.equal(h.c.responseHistoryIndex, -1); assert.equal(h.c.latestResponseMarkdown, "", "empty history still clears the response cache");
  assert.deepEqual(h.rendered, []);
});

function deliverHistory(h, message) {
  vm.runInContext('function deliverHistory(message) {' + section('if (message.type === "response_history") {', 'if (message.type === "save_conflict") {') + '}', h.c);
  h.c.deliverHistory({ type: "response_history", ...message });
}

test("authoritative tree changes revoke the previous branch queue for either buffer and Follow policy", () => {
  for (const document of [true, false]) for (const follow of [true, false]) for (const items of [[], [{ id: "other", markdown: "Other branch" }]]) {
    const h = historyHarness(true, document);
    h.c.followLatest = follow; h.c.queuedLatestResponse = { markdown: "Previous branch" };
    deliverHistory(h, { reason: "tree", items });
    assert.equal(h.c.queuedLatestResponse, null, JSON.stringify({ document, follow, empty: !items.length }));
    assert.equal(h.c.responseHistory.length, items.length);
  }
});

test("ordinary empty history preserves a current-branch payload-only response queue", () => {
  const h = historyHarness(true, true), payload = { markdown: "Current response without history" };
  h.c.followLatest = false; h.c.queuedLatestResponse = payload;
  deliverHistory(h, { items: [] });
  assert.equal(h.c.queuedLatestResponse, payload);
  deliverHistory(h, { reason: "tree", items: [] });
  assert.equal(h.c.queuedLatestResponse, null);
  h.c.queuedLatestResponse = payload; // A new response after the tree change owns the new branch.
  deliverHistory(h, { items: [] });
  assert.equal(h.c.queuedLatestResponse, payload);
});

test("foundation-only tree notifications retain the existing queue policy", () => {
  const h = historyHarness(false, false), payload = { markdown: "Existing single-editor queue" };
  h.c.followLatest = false; h.c.queuedLatestResponse = payload;
  deliverHistory(h, { reason: "tree", items: [] });
  assert.equal(h.c.queuedLatestResponse, payload);
});

test("visible Prompt and default history updates still render the selected response and clear empty history", () => {
  for (const [switching, document] of [[true, false], [false, true]]) {
    const h = historyHarness(switching, document);
    h.c.setResponseHistory([{ id: "r1", markdown: "R1" }, { id: "r2", markdown: "R2" }]); h.c.setResponseHistory([]);
    assert.deepEqual(h.rendered, [1, "clear"]);
  }
});

test("a late response for an older request cannot settle a newer Run after switching", () => {
  const h = responseHarness(); h.deliver({ requestId: "old-run" });
  assert.equal(h.c.pendingRequestId, "run-1"); assert.equal(h.c.uiBusy, true);
  assert.equal(h.c.queuedLatestResponse, h.pending); assert.deepEqual(h.calls, []);
});

function failureHarness(switching = true) {
  const discarded = [], restored = [];
  const c = vm.createContext({ bufferSwitchingEnabled: switching, pendingKind: "direct", pendingRequestId: "new-run", uiBusy: true,
    stickyStudioKind: "direct", wsState: "Submitting", status: "Running", replPendingRequestId: "", pendingEditorRefresh: null,
    pendingSaveOperations: new Map(), clearPiEditorOperations() {}, clearArmedTitleAttention() {}, failPendingCompanionLaunch() {},
    submittedEditorDrafts: { discard: id => { discarded.push(id); return id === "pending-steer"; } },
    restoreReservedPiEditorDraftSnapshot: id => restored.push(id), finishTrackedStudioActivity() {}, syncActionButtons() {},
    setBusy: value => { c.uiBusy = value; }, setWsState: value => { c.wsState = value; }, setStatus: value => { c.status = value; } });
  vm.runInContext("function deliver(message) {" + section('if (message.type === "busy") {', 'if (message.type === "info") {') + "}", c);
  return { c, discarded, restored };
}

test("late busy/error cannot unlock or replace a newer Run, but still retire their own pending snapshots", () => {
  for (const type of ["busy", "error"]) {
    const h = failureHarness(); h.c.deliver({ type, requestId: "old-run", message: "Old outcome" });
    assert.equal(h.c.uiBusy, true); assert.equal(h.c.wsState, "Submitting"); assert.equal(h.c.pendingRequestId, "new-run");
    assert.equal(h.c.stickyStudioKind, "direct"); assert.equal(h.c.status, "Running");
    assert.deepEqual(h.discarded, ["old-run"]); assert.deepEqual(h.restored, ["old-run"]);
  }
});

test("a rejected pending steering snapshot is reported without cancelling or unlocking its parent Run", () => {
  for (const type of ["busy", "error"]) {
    const h = failureHarness(); h.c.deliver({ type, requestId: "pending-steer", message: "Steering rejected" });
    assert.equal(h.c.uiBusy, true); assert.equal(h.c.pendingRequestId, "new-run");
    assert.equal(h.c.status, "Steering rejected"); assert.deepEqual(h.discarded, ["pending-steer"]);
  }
});

test("owned failure settles Run, while default single-editor failure behavior is unchanged", () => {
  for (const type of ["busy", "error"]) {
    const h = failureHarness(); h.c.deliver({ type, requestId: "new-run", message: "Run failed" });
    assert.equal(h.c.pendingRequestId, null); assert.equal(h.c.uiBusy, false); assert.equal(h.c.status, "Run failed");
    const legacy = failureHarness(false); legacy.c.deliver({ type, requestId: "old-run", message: "Legacy" });
    assert.equal(legacy.c.uiBusy, false); assert.equal(legacy.c.status, "Legacy");
  }
});

test("Stop acts on the active global Run without returning to or sending a hidden Prompt", () => {
  const calls = []; let click;
  const c = vm.createContext({ bufferSwitchingEnabled: true, sendRunBtn: { addEventListener: (_type, handler) => { click = handler; } },
    getAbortablePendingKind: () => "direct", requestCancelForPendingRequest: kind => calls.push(kind),
    requireStudioPromptForSend: () => assert.fail("Stop is not a draft action") });
  vm.runInContext(section('sendRunBtn.addEventListener("click",', "if (queueSteerBtn)"), c);
  click({ detail: 1 }); assert.deepEqual(calls, ["direct"]);
});

import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
function section(start, end) { const a = source.indexOf(start), b = source.indexOf(end, a); assert(a >= 0 && b > a, start); return source.slice(a, b); }
function harness({ view = "files", working = true, latest = true, role = "prompt", history = true } = {}) {
  const buffers = [{ id: "prompt", role: "prompt", view: { rightView: view, rightScrollTop: 480, followLatest: true, responseHistoryIndex: history ? 0 : -1 } },
    { id: "document", role: "document", view: { rightView: "editor-preview", rightScrollTop: 72, followLatest: false, responseHistoryIndex: 0 } }];
  const transitions = [], writes = [], sent = [];
  const c = { bufferSwitchingEnabled: true, isEditorOnlyMode: false, isWatchedFilePreview: false,
    studioRuntimeActivity: { run: null }, studioRunFollowing: null, workspacePersistenceReady: true, bufferBindingInProgress: false,
    bufferRecoveryInitializing: false, bufferTransientStates: new Map(), latestResponseFollowingEnabled: latest,
    activityTrackingEnabled: working, activityTrackingOwnsWorkingView: false, activityTrackingRequestId: "",
    documentPreviewFollowingEnabled: true, documentPreviewFollowOwner: null, documentPreviewFollowScrolls: new Map(),
    followLatest: latest, queuedLatestResponse: null, responseHistory: history ? [{ id: "old", markdown: "old" }] : [], responseHistoryIndex: history ? 0 : -1,
    studioUiRefreshUi: { followButton: {} }, followSelect: {}, activityTrackingSelect: {}, documentPreviewFollowSelect: {},
    rightView: role === "prompt" ? view : "editor-preview", critiqueViewEl: { scrollTop: role === "prompt" ? 480 : 72, querySelector: () => null },
    selected: role, bufferRecoveryClient: { snapshot: () => ({ activePromptId: "prompt", selectedBufferId: c.selected, buffers }) },
    getStudioSelectedBuffer: () => buffers.find(b => b.id === c.selected), getSelectedHistoryItem: () => c.responseHistory[c.responseHistoryIndex] || null,
    studioBufferScrollPosition: (_pane, fallback) => fallback, restoreDocumentFollowScroll: scroll => { c.critiqueViewEl.scrollTop = scroll; },
    syncTraceForSelectedHistoryItem() {}, setStudioUiRefreshButtonText: (button, label) => { button.textContent = label; },
    scheduleWorkspacePersistence() {}, updateHistoryControls() {}, applySelectedHistoryItem: () => true, setStatus() {},
    window: { localStorage: { getItem: () => null, setItem: (...args) => writes.push(args) }, setTimeout: fn => fn() },
    ACTIVITY_TRACKING_STORAGE_KEY: "working", LATEST_RESPONSE_FOLLOW_STORAGE_KEY: "latest", DOCUMENT_PREVIEW_FOLLOW_STORAGE_KEY: "document",
    studioRightViewGeneration: 0, replQuickFocusRequested: false, rightViewSelect: {}, traceAutoScroll: false,
    gitChangesState: { status: "ready" }, responseEditorPreviewTimer: null, sideQuestionUi: { gatherScope: "repo" },
    normalizeRightViewValue: value => value, syncRightViewModeOptions() {}, refreshResponseUi() {}, syncActionButtons() {},
    startReplPolling() {}, stopReplPolling() {}, focusReplQuickComposer() {}, requestStudioQuartoPreviewCheck() {},
    clearPreviewJumpHighlight() {}, requestGitChangesSnapshot() {}, captureEditorAsyncConsent: () => ({}), editorAsyncConsentIsCurrent: () => true,
    HTMLTextAreaElement: class {}, sendMessage: message => sent.push(message), relinquishDocumentPreviewFollowing() {},
  };
  vm.createContext(c);
  vm.runInContext(section("function readActivityTrackingEnabled()", "function readDocumentPreviewFollowingEnabled()"), c);
  vm.runInContext(section("function selectHistoryIndex(index, options)", "function setResponseHistory(items, options)"), c);
  vm.runInContext(section("function setRightView(nextView, options)", "function lineNumbersShouldBeVisible()"), c);
  vm.runInContext(section("function retireStudioBufferSourceView(bufferId)", "function relinquishDocumentPreviewFollowing()"), c);
  const original = c.setRightView;
  c.setRightView = (value, options) => { transitions.push([c.selected, value]); return original(value, options); };
  const observe = (run, type = "busy", extra = {}) => { c.studioRuntimeActivity = { run }; c.syncStudioRunFollowingFromMessage({ type, ...extra }); };
  const start = id => observe({ id: id || "run-1" });
  const arrive = (id = "new", runId = "run-1") => { c.responseHistory.push({ id, markdown: id, studioRunId: runId }); observe(c.studioRuntimeActivity.run, "response"); };
  const select = id => {
    const entry = buffers.find(b => b.id === id); c.selected = id;
    const saved = c.bufferTransientStates.get(id)?.runFollowingView;
    c.setRightView(saved?.rightView ?? entry.view.rightView, { bufferSwitch: true });
    c.critiqueViewEl.scrollTop = saved?.rightScrollTop ?? entry.view.rightScrollTop;
  };
  return { c, buffers, transitions, writes, sent, observe, start, arrive, select };
}

test("fresh Working defaults On only in the full workspace; explicit Off survives", () => {
  const h = harness(); assert.equal(h.c.readActivityTrackingEnabled(), true);
  h.c.window.localStorage.getItem = () => "off"; assert.equal(h.c.readActivityTrackingEnabled(), false);
  h.c.window.localStorage.getItem = () => null; h.c.bufferSwitchingEnabled = false; assert.equal(h.c.readActivityTrackingEnabled(), false);
  h.c.bufferSwitchingEnabled = true; h.c.isEditorOnlyMode = true; assert.equal(h.c.readActivityTrackingEnabled(), false);
});

test("latest migration reads Prompt preference, never Document's forced Off", () => {
  const h = harness({ role: "document" }); h.c.latestResponseFollowingEnabled = null;
  h.c.ensureLatestResponseFollowingPreference(); assert.equal(h.c.latestResponseFollowingEnabled, true);
  h.buffers[0].view.followLatest = false; h.c.latestResponseFollowingEnabled = null;
  h.c.ensureLatestResponseFollowingPreference(); assert.equal(h.c.latestResponseFollowingEnabled, false);
  h.c.latestResponseFollowingEnabled = true; h.c.ensureLatestResponseFollowingPreference(); assert.equal(h.c.latestResponseFollowingEnabled, true);
});

for (const view of ["files", "changes", "repl", "markdown", "editor-preview", "trace", "side-questions"]) test("no-response settlement restores " + view + " and its reading position without advancing selection", () => {
  const h = harness({ view }); h.start(); assert.equal(h.c.rightView, "trace");
  h.observe(null); assert.equal(h.c.rightView, view); assert.equal(h.c.critiqueViewEl.scrollTop, 480);
  assert.equal(h.c.responseHistoryIndex, 0); assert.equal(h.c.getSelectedHistoryItem().id, "old");
});

test("Working hands back only on SDK settlement, to an actual new response when latest is enabled", () => {
  const h = harness(); h.start(); h.arrive();
  assert.equal(h.c.rightView, "trace"); assert.equal(h.c.responseHistoryIndex, 0);
  h.observe({ id: "run-1" }, "response_history"); assert.equal(h.c.rightView, "trace");
  h.observe(null); assert.equal(h.c.rightView, "preview"); assert.equal(h.c.getSelectedHistoryItem().id, "new");
});

test("latest Off restores prior view and does not advance response selection despite an arrival", () => {
  const h = harness({ latest: false }); h.start(); h.arrive(); h.observe(null);
  assert.equal(h.c.rightView, "files"); assert.equal(h.c.responseHistoryIndex, 0);
});

test("latest On works independently when Working is Off", () => {
  const h = harness({ working: false }); h.start(); assert.equal(h.c.rightView, "files");
  h.arrive(); assert.equal(h.c.rightView, "preview"); assert.equal(h.c.getSelectedHistoryItem().id, "new");
  h.observe(null); assert.equal(h.c.rightView, "preview");
});

test("all run options Off leave own view and response selection unchanged", () => {
  const h = harness({ working: false, latest: false }); h.start(); h.arrive(); h.observe(null);
  assert.equal(h.c.rightView, "files"); assert.equal(h.c.responseHistoryIndex, 0);
});

for (const response of [false, true]) test("hidden Prompt settles independently of visible Document, new response=" + response, () => {
  const h = harness({ role: "document" }); h.start();
  assert.equal(h.c.rightView, "editor-preview"); assert.equal(h.c.critiqueViewEl.scrollTop, 72);
  assert.equal(h.c.bufferTransientStates.get("prompt").runFollowingView.rightView, "trace");
  if (response) h.arrive(); h.observe(null);
  assert.equal(h.c.rightView, "editor-preview"); h.select("prompt");
  assert.equal(h.c.rightView, response ? "preview" : "files"); assert.equal(h.c.critiqueViewEl.scrollTop, response ? 0 : 480);
});

test("manual view navigation pauses run options until the next distinct SDK run; Document following remains independent", () => {
  const h = harness(); h.start(); h.c.setRightView("repl"); h.arrive(); h.observe(null);
  assert.equal(h.c.rightView, "repl"); assert.equal(h.c.responseHistoryIndex, 0);
  assert.equal(h.c.studioRunFollowing.paused, true); assert.match(h.c.studioUiRefreshUi.followButton.textContent, /run paused/);
  assert.equal(h.c.documentPreviewFollowingEnabled, true);
  h.start("run-2"); assert.equal(h.c.rightView, "trace"); assert.equal(h.c.studioRunFollowing.paused, false);
});

test("manual history selection pauses even without a view transition", () => {
  const h = harness(); h.c.responseHistory.push({ id: "older", markdown: "older" }); h.start();
  h.c.selectHistoryIndex(1, { silent: true }); h.arrive(); h.observe(null);
  assert.equal(h.c.getSelectedHistoryItem().id, "older"); assert.equal(h.c.rightView, "trace"); assert.equal(h.c.studioRunFollowing.paused, true);
});

test("manual Document navigation leaves the Prompt's Run to hand back on its own, and keeps the Document's view", () => {
  // The Document reads independently, so its view changes don't pause the Prompt's following (Sol, 8 Oct).
  const h = harness({ role: "document" }); h.start(); h.c.setRightView("side-questions");
  assert.equal(h.c.studioRunFollowing.paused, false);
  h.arrive(); h.observe(null);
  assert.equal(h.c.rightView, "side-questions", "the Document's chosen view");
  h.select("prompt"); assert.equal(h.c.rightView, "preview", "the Prompt's own hand-back to the new response");
});

test("Off restores a still-owned Working override immediately, including hidden Prompt", () => {
  for (const role of ["prompt", "document"]) {
    const h = harness({ role }); h.start(); h.c.activityTrackingEnabled = false; h.c.relinquishStudioRunWorking(true);
    assert.equal(h.c.studioRunFollowing.working, null); h.select("prompt"); assert.equal(h.c.rightView, "files");
  }
});

test("re-enabling a preference never unpauses a manually navigated run", () => {
  const h = harness(); h.start(); h.c.setRightView("files"); h.c.setLatestResponseFollowingEnabled(true);
  h.c.activityTrackingEnabled = true; h.c.acquireStudioRunWorking(); h.arrive();
  assert.equal(h.c.rightView, "files"); assert.equal(h.c.studioRunFollowing.paused, true);
});

test("reconnect does not mistake existing history for a fresh response", () => {
  const h = harness(); h.start(); h.observe({ id: "run-1" }, "hello_ack"); h.observe(null, "hello_ack");
  assert.equal(h.c.rightView, "files"); assert.equal(h.c.responseHistoryIndex, 0);
});

test("a new response attributed to this SDK run is settled after an offline completion", () => {
  const h = harness(); h.start(); h.c.responseHistory.push({ id: "offline", markdown: "offline", studioRunId: "run-1" });
  h.observe(null, "hello_ack"); assert.equal(h.c.rightView, "preview"); assert.equal(h.c.getSelectedHistoryItem().id, "offline");
});

test("unattributed historical entries on reconnect do not justify hand-back to latest", () => {
  const h = harness(); h.start(); h.c.responseHistory.push({ id: "branch-old", markdown: "branch-old" });
  h.observe(null, "hello_ack"); assert.equal(h.c.rightView, "files"); assert.equal(h.c.responseHistoryIndex, 0);
});

test("source replacement retires Working authority and stale reading cache", () => {
  const h = harness(); h.start(); h.c.retireStudioBufferSourceView("prompt"); h.arrive(); h.observe(null);
  assert.equal(h.c.studioRunFollowing.working, null); assert.equal(h.c.studioRunFollowing.paused, true);
  assert.equal(h.c.bufferTransientStates.has("prompt"), false);
});

function actualBindingHarness() {
  const fixture = readFileSync(new URL("./studio-buffer-switching-ui.test.js", import.meta.url), "utf8");
  const helpers = vm.createContext({ assert, context: values => vm.createContext({ studioRunFollowing: null, ...values }),
    load: (c, start, end) => vm.runInContext(section(start, end), c) });
  vm.runInContext(fixture.slice(fixture.indexOf("function bindingHarness("), fixture.indexOf('test("returning to a following Prompt')), helpers);
  const f = helpers.bindingHarness({ rightView: "files", queued: false });
  Object.assign(f.c, { studioRuntimeActivity: { run: null }, latestResponseFollowingEnabled: true, studioUiRefreshUi: null,
    studioRunFollowing: { promptId: "prompt", active: false }, workspacePersistenceReady: true, bufferRecoveryInitializing: false,
    window: { localStorage: { getItem: () => null } }, LATEST_RESPONSE_FOLLOW_STORAGE_KEY: "latest" });
  f.c.bufferRecoveryClient.snapshot = () => ({ activePromptId: "prompt", selectedBufferId: "prompt", buffers: [f.entry] });
  vm.runInContext(section("function readActivityTrackingEnabled()", "function readDocumentPreviewFollowingEnabled()"), f.c);
  return f;
}

test("actual production binding applies hidden settlement without reviving legacy Working", () => {
  for (const view of ["files", "preview"]) {
    const f = actualBindingHarness();
    f.entry.view.rightView = "trace";
    f.c.bufferTransientStates.get("prompt").activityTracking = { requestId: "retired", ownsWorkingView: true };
    f.c.bufferTransientStates.get("prompt").runFollowingView = { rightView: view, rightScrollTop: view === "files" ? 480 : 0 };
    f.bind(); assert.equal(f.c.rightView, view); assert.equal(f.c.bufferViewRestore.right, view === "files" ? 480 : 0);
  }
});

test("actual Prompt binding preserves intentionally unselected history after a hidden first arrival with Latest Off", () => {
  const f = actualBindingHarness(); f.c.latestResponseFollowingEnabled = false;
  f.entry.view.responseHistoryIndex = -1;
  f.c.bufferTransientStates.get("prompt").historySelection = { id: null, index: -1, resetScroll: false };
  f.c.responseHistory = [{ id: "first", markdown: "First" }];
  f.bind(); assert.equal(f.c.responseHistoryIndex, -1); assert.equal(f.c.getSelectedHistoryItem(), null);
  assert.equal(f.c.rightView, "files"); assert.equal(f.c.bufferViewRestore.right, 480);
});

test("actual production binding preserves a current Working reading offset independently of its original view", () => {
  const f = actualBindingHarness(); f.c.studioRuntimeActivity.run = { id: "run-1" };
  f.c.studioRunFollowing = { promptId: "prompt", runId: "run-1", active: true, working: { bufferId: "prompt", rightView: "files", rightScrollTop: 480 } };
  f.c.bufferTransientStates.get("prompt").runFollowingView = { rightView: "trace", rightScrollTop: 120 };
  f.bind(); assert.equal(f.c.rightView, "trace"); assert.equal(f.c.bufferViewRestore.right, 120);
  assert.equal(f.entry.view.rightView, "files");
});

test("first hosted persistence migrates recovered Prompt Off before capturing any null preference as On", () => {
  const h = harness({ latest: null }); h.buffers[0].view.followLatest = false; h.c.followLatest = false;
  Object.assign(h.c, { lastWorkspacePersistenceSavedAt: 0, pendingStudioBufferEditorView: () => null,
    sourceState: {}, normalizeWorkspaceSourceState: value => value, fileBackedDiskRevision: null, getCurrentResourceDirValue: () => "/work",
    editorView: "markdown", editorLanguage: "markdown", sourceTextEl: { value: "kept", selectionDirection: "none" }, sourcePreviewEl: { scrollTop: 42 },
    annotationsEnabled: true, getCurrentMetadataAssociationSnapshot: () => ({}), getDocumentPreviewFollowOwner: () => null });
  h.c.workspacePersistenceReady = false;
  vm.runInContext(section("function buildWorkspacePersistencePayload()", "function sendServerWorkspaceRecoveryState("), h.c);
  assert.equal(h.c.buildWorkspacePersistencePayload().followLatest, false);
  assert.equal(h.c.latestResponseFollowingEnabled, false); assert.equal(h.buffers[0].view.followLatest, false);
});

test("Working persistence stores own view and scroll, not the automatic view; latest policy is independent", () => {
  const h = harness(); h.start(); Object.assign(h.c, { lastWorkspacePersistenceSavedAt: 0, pendingStudioBufferEditorView: () => null,
    sourceState: {}, normalizeWorkspaceSourceState: value => value, fileBackedDiskRevision: null, getCurrentResourceDirValue: () => "/work",
    editorView: "markdown", editorLanguage: "markdown", sourceTextEl: { value: "kept", selectionDirection: "none" }, sourcePreviewEl: { scrollTop: 42 },
    annotationsEnabled: true, getCurrentMetadataAssociationSnapshot: () => ({}), getDocumentPreviewFollowOwner: () => null });
  vm.runInContext(section("function buildWorkspacePersistencePayload()", "function sendServerWorkspaceRecoveryState("), h.c);
  vm.runInContext(section("function bufferRecoveryExtra()", "function getStudioSelectedBuffer()"), h.c);
  assert.equal(h.c.buildWorkspacePersistencePayload().rightView, "files"); assert.equal(h.c.bufferRecoveryExtra().view.rightScrollTop, 480);
  assert.equal(h.c.rightView, "trace"); assert.equal(h.c.buildWorkspacePersistencePayload().text, "kept");
});

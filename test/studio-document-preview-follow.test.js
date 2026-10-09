import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
function section(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, "missing source section: " + start);
  return source.slice(a, b);
}
function harness({ preference = null, switching = true, role = "document" } = {}) {
  const writes = [], sent = [];
  const entry = { id: role, role, view: { rightView: "files", rightScrollTop: 480 } };
  const c = {
    entry, studioRunFollowing: null, studioRunFollowingAvailable: () => false, getStudioRunWorkingOwner: () => null,
    pauseStudioRunFollowing() {}, syncStudioFollowMenu() {}, bufferTransientStates: new Map(),
    bufferSwitchingEnabled: switching, isEditorOnlyMode: false, isWatchedFilePreview: false,
    documentPreviewFollowingEnabled: true, documentPreviewFollowOwner: null, documentPreviewFollowScrolls: new Map(),
    DOCUMENT_PREVIEW_FOLLOW_STORAGE_KEY: "piStudio.followDocumentPreview", documentPreviewFollowSelect: {},
    bufferViewRestore: null, bufferRecoveryClient: { snapshot: () => ({ selectedBufferId: c.entry.id }) },
    getStudioSelectedBuffer: () => c.entry,
    activityTrackingOwnsWorkingView: false, rightView: "files", studioRightViewGeneration: 0,
    replQuickFocusRequested: false, rightViewSelect: {}, traceAutoScroll: false,
    gitChangesState: { status: "ready" }, responseEditorPreviewTimer: null,
    critiqueViewEl: { scrollTop: 480, querySelector: () => null },
    sideQuestionUi: { gatherScope: "repo" }, getSideQuestionGatherScope: () => "repo",
    captureEditorAsyncConsent: () => ({}), editorAsyncConsentIsCurrent: () => true,
    HTMLTextAreaElement: class {},
    normalizeRightViewValue: value => value,
    syncRightViewModeOptions() {}, refreshResponseUi() {}, syncActionButtons() {},
    startReplPolling() {}, stopReplPolling() {}, focusReplQuickComposer() {},
    requestStudioQuartoPreviewCheck() {}, clearPreviewJumpHighlight() {}, requestGitChangesSnapshot() {},
    sendMessage: message => sent.push(message),
    scheduleWorkspacePersistence() {}, persistWorkspaceStateNow() {},
    captureStudioBufferScrollOwner: () => ({ view: c.rightView }),
    scheduleStudioBufferScrollRestore: () => { c.critiqueViewEl.scrollTop = c.bufferViewRestore.right; },
    studioBufferScrollPosition: (_pane, fallback) => c.bufferViewRestore?.bufferId === c.entry.id && typeof c.bufferViewRestore.right === "number"
      ? c.bufferViewRestore.right : fallback,
    window: { localStorage: { getItem: () => preference, setItem: (...args) => writes.push(args) }, setTimeout: fn => fn() },
    setActivePane() {}, askAsideBtn: { addEventListener: (_type, fn) => { c.side = fn; } },
  };
  vm.createContext(c);
  // Run the production navigation function, including the Review route, rather
  // than a second mock state machine with different relinquishment semantics.
  vm.runInContext(section("function setRightView(nextView, options)", "function lineNumbersShouldBeVisible()"), c);
  vm.runInContext(section("function readDocumentPreviewFollowingEnabled()", "function isStackedStudioPaneLayout()"), c);
  vm.runInContext(section("if (askAsideBtn) {\n        askAsideBtn.addEventListener", "if (quizBtn)"), c);
  const bind = () => {
    const next = c.documentPreviewFollowingView(c.entry, c.entry.view.rightView);
    c.setRightView(next, { bufferSwitch: true });
    c.bufferViewRestore = null;
  };
  const capture = () => {
    const owner = c.getDocumentPreviewFollowOwner();
    c.entry.view = { rightView: owner?.rightView ?? c.rightView,
      rightScrollTop: owner?.rightScrollTop ?? c.critiqueViewEl.scrollTop };
    c.rememberDocumentPreviewFollowScroll();
  };
  return { c, writes, sent, bind, capture };
}

test("Document-preview following defaults on only in a full two-buffer workspace and preserves explicit Off", () => {
  for (const preference of [null, "on", "off"]) {
    const h = harness({ preference });
    assert.equal(h.c.readDocumentPreviewFollowingEnabled(), preference !== "off");
  }
  const h = harness(); h.c.window.localStorage.getItem = () => { throw Error("blocked storage"); };
  assert.equal(h.c.readDocumentPreviewFollowingEnabled(), true);
  for (const changes of [{ bufferSwitchingEnabled: false }, { isEditorOnlyMode: true }, { isWatchedFilePreview: true }]) {
    Object.assign(h.c, changes); assert.equal(h.c.readDocumentPreviewFollowingEnabled(), false);
    Object.assign(h.c, { bufferSwitchingEnabled: true, isEditorOnlyMode: false, isWatchedFilePreview: false });
  }
});

test("automatic Document preview is an override, and Off restores its own view and reading position immediately", () => {
  const h = harness(); h.bind(); assert.equal(h.c.rightView, "editor-preview");
  assert.equal(h.c.getDocumentPreviewFollowOwner().rightView, "files");
  h.c.setDocumentPreviewFollowingEnabled(false);
  assert.equal(h.c.rightView, "files"); assert.equal(h.c.critiqueViewEl.scrollTop, 480);
  assert.equal(h.c.documentPreviewFollowOwner, null);
  assert.equal(h.writes[0][1], "off");
});

for (const route of ["selector", "review-side", "shortcut"]) {
  test(`${route} manual navigation relinquishes automatic preview; Off does not replace it`, () => {
    const h = harness(); h.bind();
    if (route === "review-side") h.c.side();
    else h.c.setRightView(route === "selector" ? "files" : "repl");
    const manualView = h.c.rightView;
    assert.equal(h.c.documentPreviewFollowOwner, null);
    h.c.setDocumentPreviewFollowingEnabled(false);
    assert.equal(h.c.rightView, manualView);
    if (route === "review-side") assert.equal(h.sent[0].type, "side_question_get_state");
  });
}

test("manual Side questions survives Prompt return, Off there, and returning to Document", () => {
  const h = harness(); h.bind(); h.c.side(); h.capture();
  const doc = h.c.entry;
  h.c.entry = { id: "prompt", role: "prompt", view: { rightView: "markdown", rightScrollTop: 220 } }; h.bind();
  assert.equal(h.c.rightView, "markdown");
  h.c.setDocumentPreviewFollowingEnabled(false);
  h.c.entry = doc; h.bind(); assert.equal(h.c.rightView, "side-questions");
});

test("leaving automatic preview saves the Document's own view, not the override; On is remembered independently", () => {
  const h = harness(); h.bind(); h.c.critiqueViewEl.scrollTop = 72; h.capture();
  assert.equal(h.c.entry.view.rightView, "files"); assert.equal(h.c.entry.view.rightScrollTop, 480);
  assert.equal(h.c.documentPreviewFollowScrolls.get("document"), 72);
  h.c.documentPreviewFollowingEnabled = false; h.bind(); assert.equal(h.c.rightView, "files");
  h.c.setDocumentPreviewFollowingEnabled(true); assert.equal(h.c.rightView, "editor-preview");
  assert.equal(h.c.critiqueViewEl.scrollTop, 72); assert.equal(h.writes[0][1], "on");
});

test("automatic and buffer-restoration navigation do not themselves relinquish the override", () => {
  const h = harness(); h.bind(); const owner = h.c.documentPreviewFollowOwner;
  h.c.setRightView("editor-preview", { documentPreviewFollowing: true });
  assert.equal(h.c.documentPreviewFollowOwner, owner);
  h.c.setRightView("editor-preview", { bufferSwitch: true });
  assert.equal(h.c.documentPreviewFollowOwner, owner);
  h.c.entry = { id: "other-document", role: "document", view: {} };
  assert.equal(h.c.getDocumentPreviewFollowOwner(), null, "a stale owner cannot act on another buffer");
});

test("production workspace capture stores original view and scroll while the automatic preview is visible", () => {
  const h = harness(); h.bind(); h.c.critiqueViewEl.scrollTop = 72;
  Object.assign(h.c, {
    lastWorkspacePersistenceSavedAt: 0, pendingStudioBufferEditorView: () => null,
    sourceState: { source: "file", path: "/methods.md" }, normalizeWorkspaceSourceState: value => value,
    fileBackedDiskRevision: "disk", getCurrentResourceDirValue: () => "/work", editorView: "markdown", editorLanguage: "markdown",
    followLatest: false, responseHistoryIndex: 0, sourceTextEl: { value: "kept", selectionDirection: "none" },
    sourcePreviewEl: { scrollTop: 42 }, annotationsEnabled: true, getCurrentMetadataAssociationSnapshot: () => ({}),
  });
  vm.runInContext(section("function buildWorkspacePersistencePayload()", "function sendServerWorkspaceRecoveryState("), h.c);
  vm.runInContext(section("function bufferRecoveryExtra()", "function getStudioSelectedBuffer()"), h.c);
  assert.equal(h.c.buildWorkspacePersistencePayload().rightView, "files");
  assert.equal(h.c.bufferRecoveryExtra().view.rightScrollTop, 480);
  assert.equal(h.c.rightView, "editor-preview", "capture must not change the visible preview");
});

test("startup applies the override to a restored selected Document without saving it as its own view", () => {
  for (const enabled of [false, true]) {
    const h = harness(); h.c.documentPreviewFollowingEnabled = enabled;
    vm.runInContext(section("const restoredFollowBuffer = bufferSwitchingEnabled", "renderSourcePreview();\n      workspacePersistenceReady = true;"), h.c);
    assert.equal(h.c.rightView, enabled ? "editor-preview" : "files");
    assert.equal(h.c.entry.view.rightView, "files");
    if (enabled) {
      assert.equal(h.c.getDocumentPreviewFollowOwner().rightScrollTop, 480);
      assert.equal(h.c.critiqueViewEl.scrollTop, 0);
    }
  }
});

test("Doc following does not acquire or replace Prompt, fixed companions, or watched views", () => {
  for (const changes of [{ entry: { id: "prompt", role: "prompt", view: { rightView: "markdown" } } },
    { bufferSwitchingEnabled: false }, { isEditorOnlyMode: true }, { isWatchedFilePreview: true }]) {
    const h = harness(); Object.assign(h.c, changes); h.bind();
    assert.equal(h.c.rightView, h.c.entry.view.rightView);
    assert.equal(h.c.documentPreviewFollowOwner, null);
  }
});

test("the Document comes back to the response it was reading after showing something else (Sol: independent reading)", () => {
  const { c } = harness();
  const calls = [];
  Object.assign(c, { responseHistory: [{ id: "r1" }, { id: "r2" }, { id: "r3" }], responseHistoryIndex: 0,
    getSelectedHistoryItem: () => c.responseHistory[c.responseHistoryIndex] || null,
    applySelectedHistoryItem: options => calls.push(["apply", c.responseHistoryIndex, options.render]),
    syncTraceForSelectedHistoryItem: () => calls.push(["trace"]), updateHistoryControls() {} });
  c.rightView = "preview";
  c.setRightView("editor-preview"); // reading R1, then look at the Document's own preview
  assert.equal(c.bufferTransientStates.get("document").historySelection.id, "r1");
  c.responseHistoryIndex = 2; // an arrival or the Prompt moved the shared selection
  c.setRightView("preview");
  assert.equal(c.responseHistoryIndex, 0, "back to R1"); assert.deepEqual(calls, [["apply", 0, false], ["trace"]]);
  calls.length = 0; c.setRightView("markdown"); assert.deepEqual(calls, [], "reading to reading changes nothing");
  c.entry = { ...c.entry, id: "prompt", role: "prompt" }; c.rightView = "files"; c.responseHistoryIndex = 2;
  c.setRightView("preview"); assert.equal(c.responseHistoryIndex, 2, "the Prompt isn't affected");
});

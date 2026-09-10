import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
function section(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert(a >= 0 && b > a, start);
  return source.slice(a, b);
}
function load(c, start, end) { vm.runInContext(section(start, end), c); }
function context(values) { return vm.createContext(values); }

test("switching requires both process flags and a full editable recovery owner", () => {
  assert.match(index, /STUDIO_BUFFER_SWITCHING_ENABLED = STUDIO_BUFFER_RECOVERY_ENABLED && process\.env\.PI_STUDIO_BUFFER_SWITCHING === "1"/);
  assert.match(index, /STUDIO_BUFFER_SWITCHING_ENABLED && bufferRecovery && studioMode === "full" && initialWatchFile !== "1"/);
  assert.match(source, /const bufferSwitchingEnabled = bufferRecoveryEnabled && document\.body\.dataset\.bufferSwitching === "1" && !isEditorOnlyMode && !isWatchedFilePreview/);
});

test("Run from Document returns without sending; unresolved recovery cannot expose a hidden Prompt", () => {
  const calls = [];
  const state = { activePromptId: "prompt", selectedBufferId: "document", buffers: [{ id: "prompt", role: "prompt" }, { id: "document", role: "document" }] };
  const c = context({ bufferSwitchingEnabled: true, bufferRecoveryClient: { snapshot: () => state }, setStatus: (...v) => calls.push(v),
    selectStudioBuffer: id => { calls.push(["select", id]); state.selectedBufferId = id; return true; } });
  load(c, "function getStudioSelectedBuffer()", "function studioBuffersCanSwitch(");
  load(c, "function requireStudioPromptForSend()", "function syncStudioBufferSwitcher()");
  assert.equal(c.requireStudioPromptForSend(), false);
  assert.deepEqual(calls, [["select", "prompt"]]);
  assert.equal(c.requireStudioPromptForSend(), true);
  c.bufferRecoveryClient = null;
  assert.equal(c.requireStudioPromptForSend(), false);
  assert.match(calls.at(-1)[0], /not ready/);
  c.bufferSwitchingEnabled = false;
  assert.equal(c.requireStudioPromptForSend(), true, "default Run retains its visible-editor behavior");
});

test("local mutations and dialogs fence switching without blocking passive metadata reads", () => {
  const c = context({ bufferSwitchingEnabled: true, bufferRecoveryClient: {}, workspacePersistenceReady: true,
    bufferBindingInProgress: false, bufferRecoveryInitializing: false, bufferPageClosed: false, uiBusy: false, pendingKind: null, replBusy: false,
    completionSuggestionInFlight: false, pendingEditorRefresh: null, responseReplacementPending: false,
    pendingSaveOperations: new Map(), pendingPiEditorDraftSnapshots: new Map(), modal: false, studioModalBlocksDraftAction: () => c.modal });
  load(c, "function studioBuffersCanSwitch(", "function studioBufferScrollPosition(");
  assert.equal(c.studioBuffersCanSwitch(), true);
  c.modal = true;
  assert.equal(c.studioBuffersCanSwitch(), false);
  assert.equal(c.studioBuffersCanSwitch(true), true, "underlying controls may remain focusable; execution still checks the modal");
  c.modal = false;
  for (const key of ["bufferBindingInProgress", "bufferRecoveryInitializing", "bufferPageClosed", "uiBusy", "replBusy", "completionSuggestionInFlight", "pendingEditorRefresh", "responseReplacementPending", "modal"]) {
    const old = c[key]; c[key] = true; assert.equal(c.studioBuffersCanSwitch(), false, key); c[key] = old;
  }
  for (const key of ["pendingSaveOperations", "pendingPiEditorDraftSnapshots"]) {
    c[key].set("owned", {}); assert.equal(c.studioBuffersCanSwitch(), false, key); c[key].clear();
  }
});

function restoreHarness() {
  const callbacks = [], calls = [];
  let generation = 1, selected = "document";
  const view = { selectionStart: 3, selectionEnd: 9, selectionDirection: "backward", scrollTop: 340 };
  const c = context({ bufferViewRestore: { bufferId: selected, editor: view }, bufferRecoveryClient: { snapshot: () => ({ selectedBufferId: selected }) },
    window: { requestAnimationFrame: fn => callbacks.push(fn) }, captureEditorAsyncConsent: () => ({ generation, selected }),
    editorAsyncConsentIsCurrent: owner => owner.generation === generation && owner.selected === selected,
    sourceTextEl: { selectionStart: 0, selectionEnd: 0, selectionDirection: "none", scrollTop: 0,
      setSelectionRange(start, end, direction) { this.selectionStart = start; this.selectionEnd = end; this.selectionDirection = direction; } },
    syncEditorHighlightScroll: () => calls.push("highlight"), scheduleWorkspacePersistence: () => calls.push("persist") });
  load(c, "function pendingStudioBufferEditorView()", "function scheduleStudioBufferScrollRestore(");
  return { c, callbacks, calls, view, edit: () => generation++, select: id => { selected = id; } };
}

test("deferred native selection restoration is single-use and remains bound to its buffer", () => {
  const f = restoreHarness(); f.c.scheduleStudioBufferEditorRestore();
  assert.equal(f.c.pendingStudioBufferEditorView(), f.view);
  f.callbacks[0](); f.callbacks[0]();
  assert.deepEqual([f.c.sourceTextEl.selectionStart, f.c.sourceTextEl.selectionEnd, f.c.sourceTextEl.selectionDirection, f.c.sourceTextEl.scrollTop], [3, 9, "backward", 340]);
  assert.equal(f.c.pendingStudioBufferEditorView(), null);
  assert.deepEqual(f.calls, ["highlight", "persist"]);
});

test("late selection restoration cannot overtake typing, switching, replacement or direct selection ownership", () => {
  for (const invalidate of [f => f.edit(), f => f.select("prompt"), f => { f.c.bufferViewRestore = null; }, f => { f.c.bufferViewRestore.editor = null; }]) {
    const f = restoreHarness(); f.c.scheduleStudioBufferEditorRestore(); invalidate(f); f.callbacks[0]();
    assert.deepEqual(f.calls, []); assert.equal(f.c.sourceTextEl.selectionStart, 0);
  }
  assert.match(section("function setupStudioBufferSwitcher()", "async function promptStudioBufferDocumentPath()"), /\["pointerdown", "keydown", "wheel", "touchstart", "input"\][\s\S]*?bufferViewRestore\.editor = null[\s\S]*?capture: true/);
});

test("rapid re-selection captures pending intended positions rather than native transient zeroes", () => {
  const f = restoreHarness();
  Object.assign(f.c, { bufferSwitchingEnabled: true, lastWorkspacePersistenceSavedAt: 0, sourceState: {}, fileBackedDiskRevision: null,
    normalizeWorkspaceSourceState: v => v, getCurrentResourceDirValue: () => "", normalizeRightViewValue: v => v,
    editorView: "markdown", rightView: "editor-preview", editorLanguage: "markdown", followLatest: false, responseHistoryIndex: -1 });
  f.c.sourceTextEl.value = "Document text";
  load(f.c, "function buildWorkspacePersistencePayload()", "function sendServerWorkspaceRecoveryState(");
  const payload = f.c.buildWorkspacePersistencePayload();
  assert.deepEqual([payload.selectionStart, payload.selectionEnd, payload.scrollTop], [3, 9, 340]);
  f.select("prompt");
  const other = f.c.buildWorkspacePersistencePayload();
  assert.deepEqual([other.selectionStart, other.selectionEnd, other.scrollTop], [0, 0, 0]);
});

test("binding does not transiently disable the focused tab and modal guards do not latch disabled controls", () => {
  const c = context({ bufferSwitcherUi: {}, bufferBindingInProgress: true });
  load(c, "function syncStudioBufferSwitcher()", "function setupStudioBufferSwitcher()");
  assert.doesNotThrow(() => c.syncStudioBufferSwitcher(), "no intermediate snapshot, disabled state or focus mutation during binding");
  assert.match(section("function syncStudioBufferSwitcher()", "function setupStudioBufferSwitcher()"), /const canSwitch = studioBuffersCanSwitch\(true\)/);
  assert.match(section("function selectStudioBuffer(", "function requireStudioPromptForSend()"), /if \(!studioBuffersCanSwitch\(\)\)/);
  assert.match(section("async function promptStudioBufferDocumentPath()", "function syncBufferRecoveryMenuAccess()"), /if \(!studioBuffersCanOpenDocument\(\)\)/);
});

test("a double-click continuation cannot turn Return to Prompt into Run", () => {
  let click;
  const c = context({ bufferSwitchingEnabled: true, sendRunBtn: { addEventListener: (type, handler) => { click = handler; } } });
  load(c, 'sendRunBtn.addEventListener("click",', "if (queueSteerBtn)");
  assert.doesNotThrow(() => click({ detail: 2 }), "returns before touching a Run/Stop request or submission state");
});

test("native Enter auto-repeat cannot reactivate Return/Run, while fresh keys and defaults remain unchanged", () => {
  const handlers = {};
  const c = context({ bufferSwitchingEnabled: true, zenModeBtn: null,
    sendRunBtn: { addEventListener: (type, handler) => { handlers[type] = handler; } } });
  load(c, 'if (zenModeBtn) {\n        zenModeBtn.addEventListener("click",', "if (queueSteerBtn)");
  assert.equal(typeof handlers.keydown, "function");
  for (const enabled of [true, false]) for (const key of ["Enter", " ", "a"]) for (const repeat of [true, false]) {
    c.bufferSwitchingEnabled = enabled;
    let prevented = false;
    handlers.keydown({ key, repeat, preventDefault: () => { prevented = true; } });
    assert.equal(prevented, enabled && key === "Enter" && repeat, JSON.stringify({ enabled, key, repeat }));
  }
  c.bufferSwitchingEnabled = true;
  let freshPrevented = false;
  handlers.keydown({ key: "Enter", repeat: false, preventDefault: () => { freshPrevented = true; } });
  assert.equal(freshPrevented, false, "a distinct activation after release must not be latched out");
});

function bindingHarness({ role = "prompt", follow = true, queued = true, history = true, rightView = "preview", applyPayload = true } = {}) {
  const calls = [];
  const entry = { id: role, role, text: "kept draft", sourceState: { path: null }, resourceDir: "", metadata: {},
    view: { editorLanguage: "markdown", editorView: "markdown", rightView, followLatest: follow, responseHistoryIndex: 0,
      selectionStart: 2, selectionEnd: 4, selectionDirection: "backward", scrollTop: 70, previewScrollTop: 90, rightScrollTop: 480 } };
  const pending = { markdown: "R2", kind: "direct", timestamp: 2000 };
  const c = context({ getStudioSelectedBuffer: () => entry, bufferBindingInProgress: false, bufferViewRestore: null,
    clearEditorAsyncOperations: () => {}, fileBrowserLoadNonce: 0, fileBrowserState: {}, resourceDirInput: null,
    bufferTransientStates: new Map([[role, { sourceGeneration: 1, linkedPiEditorDraftSnapshot: null }]]), editorSourceGeneration: 1,
    activityTrackingEnabled: true, uiBusy: false, pendingRequestId: null,
    normalizePiEditorDraftSnapshot: value => value, setEditorText: () => {}, setSourceState: () => {}, setEditorLanguage: () => {},
    setAnnotationsEnabled: () => {}, initialAnnotationsEnabled: false, followLatest: false, followSelect: { value: "off" },
    responseHistory: history ? [{ markdown: "R1" }, { markdown: "R2" }] : [], responseHistoryIndex: 0,
    queuedLatestResponse: queued ? pending : null,
    applySelectedHistoryItem: options => { calls.push({ type: "history", index: c.responseHistoryIndex, reset: options.resetScroll }); return true; },
    applyLatestPayload: (payload, options) => { calls.push({ type: "payload", payload, reset: options.resetScroll }); return applyPayload; },
    syncTraceForSelectedHistoryItem: () => calls.push({ type: "trace" }),
    setEditorView: view => { c.editorView = view; }, setRightView: view => { c.rightView = view; },
    sourceTextEl: { setSelectionRange: () => {}, scrollTop: 0 }, sourcePreviewEl: {}, critiqueViewEl: {}, syncEditorHighlightScroll: () => {},
    scheduleStudioBufferEditorRestore: () => {}, scheduleStudioBufferScrollRestore: () => {},
    persistWorkspaceStateNow: () => assert.equal(c.bufferBindingInProgress, false), syncActionButtons: () => {} });
  load(c, "function bindSelectedStudioBuffer(", "function selectStudioBuffer(");
  return { c, calls, entry, pending, bind: () => c.bindSelectedStudioBuffer() };
}

test("returning to a following Prompt applies queued history and discards the old response scroll offset", () => {
  const f = bindingHarness();
  f.bind();
  assert.equal(f.c.followSelect.value, "on");
  assert.equal(f.c.responseHistoryIndex, 1);
  assert.equal(f.c.queuedLatestResponse, null);
  assert.deepEqual(f.calls, [{ type: "history", index: 1, reset: true }, { type: "trace" }]);
  assert.equal(f.c.bufferViewRestore.right, 0);
  assert.equal(f.c.bufferViewRestore.source, 90);
  assert.equal(f.c.sourceTextEl.scrollTop, 70);
  assert.equal(f.entry.view.rightScrollTop, 480, "binding must not mutate the immutable saved view");
});

test("a following Prompt also consumes a queued payload when branch history is unavailable", () => {
  const f = bindingHarness({ history: false }); f.bind();
  assert.equal(f.c.queuedLatestResponse, null);
  assert.deepEqual(f.calls, [{ type: "payload", payload: f.pending, reset: true }]);
  assert.equal(f.c.bufferViewRestore.right, 0);
});

test("Follow off retains both the previous response reading position and the queued update", () => {
  const f = bindingHarness({ follow: false }); f.bind();
  assert.equal(f.c.followSelect.value, "off"); assert.equal(f.c.responseHistoryIndex, 0);
  assert.equal(f.c.queuedLatestResponse, f.pending);
  assert.deepEqual(f.calls, [{ type: "history", index: 0, reset: false }, { type: "trace" }]);
  assert.equal(f.c.bufferViewRestore.right, 480);
});

test("without a queued update, Follow on does not steal a manually selected older response", () => {
  const f = bindingHarness({ queued: false }); f.bind();
  assert.equal(f.c.responseHistoryIndex, 0);
  assert.deepEqual(f.calls, [{ type: "history", index: 0, reset: false }, { type: "trace" }]);
  assert.equal(f.c.bufferViewRestore.right, 480);
});

test("Document binding never consumes the Prompt response queue", () => {
  const f = bindingHarness({ role: "document", rightView: "editor-preview" }); f.bind();
  assert.equal(f.c.followLatest, false); assert.equal(f.c.queuedLatestResponse, f.pending);
  assert.deepEqual(f.calls, []); assert.equal(f.c.bufferViewRestore.right, 480);
});

test("catching up a response does not reset editor-preview or side-discussion reading positions", () => {
  for (const rightView of ["editor-preview", "editor-quarto-preview", "side-questions"]) {
    const f = bindingHarness({ rightView }); f.bind();
    assert.equal(f.c.queuedLatestResponse, null);
    assert.equal(f.c.bufferViewRestore.right, 480, rightView);
  }
});

test("returning during the same Run resumes only its captured activity owner, including manual opt-out", () => {
  for (const ownsWorkingView of [true, false]) {
    const f = bindingHarness({ rightView: ownsWorkingView ? "trace" : "preview", queued: false });
    f.c.bufferTransientStates.get("prompt").activityTracking = { requestId: "run-1", ownsWorkingView };
    f.c.uiBusy = true; f.c.pendingRequestId = "run-1"; f.bind();
    assert.equal(f.c.activityTrackingRequestId, "run-1"); assert.equal(f.c.activityTrackingOwnsWorkingView, ownsWorkingView);
    assert.equal(f.c.rightView, ownsWorkingView ? "trace" : "preview");
  }
});

test("completion while Document is selected retires automatic Working, not manually chosen views", () => {
  for (const ownsWorkingView of [true, false]) {
    const f = bindingHarness({ rightView: "trace", queued: false });
    f.c.bufferTransientStates.get("prompt").activityTracking = { requestId: "run-1", ownsWorkingView };
    f.bind();
    assert.equal(f.c.rightView, ownsWorkingView ? "preview" : "trace");
    assert.equal(f.c.activityTrackingOwnsWorkingView, false);
    assert.equal(f.c.bufferViewRestore.right, ownsWorkingView ? 0 : 480);
  }
});

test("a different Run and the Document cannot inherit Prompt activity ownership", () => {
  for (const role of ["prompt", "document"]) {
    const f = bindingHarness({ role, rightView: role === "prompt" ? "trace" : "editor-preview", queued: false });
    f.c.bufferTransientStates.get(role).activityTracking = { requestId: "old-run", ownsWorkingView: true };
    f.c.uiBusy = true; f.c.pendingRequestId = "new-run"; f.bind();
    assert.equal(f.c.activityTrackingRequestId, ""); assert.equal(f.c.activityTrackingOwnsWorkingView, false);
  }
});

function activityPolicyHarness() {
  const f = bindingHarness({ rightView: "trace", queued: false });
  let document = true;
  Object.assign(f.c, { bufferSwitchingEnabled: true, isEditorOnlyMode: false, isWatchedFilePreview: false,
    bufferRecoveryClient: { snapshot: () => ({ activePromptId: "prompt" }) },
    isStudioDocumentBufferView: () => document, activityTrackingSelect: {},
    activityTrackingRequestId: "", activityTrackingOwnsWorkingView: false,
    window: { localStorage: { setItem() {} } }, ACTIVITY_TRACKING_STORAGE_KEY: "activity",
    syncStudioUiRefreshSummaries() {}, setStatus() {}, agentBusyFromServer: true, uiBusy: true, pendingRequestId: "run-1", rightView: "editor-preview" });
  f.c.bufferTransientStates.get("prompt").activityTracking = { requestId: "run-1", ownsWorkingView: true };
  load(f.c, "function setActivityTrackingEnabled(", "function clampPaneSplitPercent(");
  return { ...f, showPrompt() { document = false; f.bind(); }, complete() {
    f.c.uiBusy = false; f.c.agentBusyFromServer = false; f.c.pendingRequestId = null;
    f.c.finishTrackedStudioActivity("run-1");
  } };
}

test("disabling activity following revokes live and saved ownership without changing source or terminal provenance", () => {
  const f = activityPolicyHarness(), saved = f.c.bufferTransientStates.get("prompt");
  const terminal = { fingerprint: "kept" }; saved.linkedPiEditorDraftSnapshot = terminal;
  f.c.activityTrackingRequestId = "run-1"; f.c.activityTrackingOwnsWorkingView = true;
  f.c.setActivityTrackingEnabled(false);
  assert.equal(f.c.activityTrackingRequestId, ""); assert.equal(f.c.activityTrackingOwnsWorkingView, false);
  const next = f.c.bufferTransientStates.get("prompt");
  assert.equal(next.activityTracking?.requestId || "", ""); assert.equal(Boolean(next.activityTracking?.ownsWorkingView), false);
  assert.equal(next.sourceGeneration, saved.sourceGeneration); assert.equal(next.linkedPiEditorDraftSnapshot, terminal);
});

test("disabling in Document then completing cannot retire Prompt's saved Working view or scroll", () => {
  const f = activityPolicyHarness(); f.c.setActivityTrackingEnabled(false); f.complete(); f.showPrompt();
  assert.equal(f.c.rightView, "trace"); assert.equal(f.c.bufferViewRestore.right, 480);
  assert.equal(f.c.activityTrackingRequestId, ""); assert.equal(f.c.activityTrackingOwnsWorkingView, false);
});

test("returning with activity disabled cannot restore a latch that blocks explicit re-enabling", () => {
  const f = activityPolicyHarness(); f.c.setActivityTrackingEnabled(false); f.showPrompt();
  assert.equal(f.c.activityTrackingRequestId, "");
  f.c.setActivityTrackingEnabled(true);
  assert.equal(f.c.activityTrackingOwnsWorkingView, true); assert.equal(f.c.rightView, "trace");
  f.complete(); assert.equal(f.c.rightView, "preview");
});

test("explicit re-enabling while Document is selected arms only the exact ongoing Prompt request", () => {
  for (const beforeReturn of [true, false]) {
    const f = activityPolicyHarness(); f.entry.view.rightView = "preview";
    f.c.setActivityTrackingEnabled(false); f.c.setActivityTrackingEnabled(true);
    assert.equal(f.c.rightView, "editor-preview", "policy changes must not move Document into Working");
    if (beforeReturn) f.complete();
    f.showPrompt();
    assert.equal(f.c.rightView, beforeReturn ? "preview" : "trace");
    if (!beforeReturn) {
      assert.equal(f.c.activityTrackingOwnsWorkingView, true);
      assert.equal(f.c.bufferViewRestore.right, 0, "new Working content cannot inherit the previous response's scroll");
      f.complete(); assert.equal(f.c.rightView, "preview");
    }
  }
});

test("hidden off/on retains completion return, but enabling only after completion does not revive an old owner", () => {
  for (const enableBeforeCompletion of [true, false]) {
    const f = activityPolicyHarness(); f.c.setActivityTrackingEnabled(false);
    if (enableBeforeCompletion) f.c.setActivityTrackingEnabled(true);
    f.complete();
    if (!enableBeforeCompletion) f.c.setActivityTrackingEnabled(true);
    f.showPrompt(); assert.equal(f.c.rightView, enableBeforeCompletion ? "preview" : "trace");
  }
});

test("redundantly enabling an already-enabled policy preserves hidden manual opt-out", () => {
  const f = activityPolicyHarness(); f.entry.view.rightView = "preview";
  f.c.bufferTransientStates.get("prompt").activityTracking.ownsWorkingView = false;
  f.c.setActivityTrackingEnabled(true); f.showPrompt();
  assert.equal(f.c.rightView, "preview"); assert.equal(f.c.activityTrackingOwnsWorkingView, false);
  f.complete(); assert.equal(f.c.rightView, "preview");
});

test("newer requests cannot inherit hidden re-enable intent, and foundation-only setters leave buffer state alone", () => {
  const f = activityPolicyHarness(); f.c.setActivityTrackingEnabled(false); f.c.setActivityTrackingEnabled(true);
  f.c.pendingRequestId = "new-run"; f.showPrompt();
  assert.equal(f.c.activityTrackingRequestId, ""); assert.equal(f.c.activityTrackingOwnsWorkingView, false);
  const legacy = activityPolicyHarness(); legacy.c.bufferSwitchingEnabled = false;
  const saved = legacy.c.bufferTransientStates.get("prompt"); legacy.c.setActivityTrackingEnabled(false);
  assert.equal(legacy.c.bufferTransientStates.get("prompt"), saved);
  assert.equal(saved.activityTracking.ownsWorkingView, true);
});

test("a queued payload that could not be applied is not discarded or treated as a new response", () => {
  const f = bindingHarness({ history: false, applyPayload: false }); f.bind();
  assert.equal(f.c.queuedLatestResponse, f.pending);
  assert.equal(f.c.bufferViewRestore.right, 480);
});

test("switching retains the Prompt submission identity, while a real source change gets a fresh one", () => {
  const states = new Map([["prompt", { sourceGeneration: 2 }], ["document", { sourceGeneration: 9 }]]);
  let selected = "prompt";
  const c = context({ bufferSwitchingEnabled: true, bufferTransientStates: states, editorSourceGeneration: 20,
    bufferRecoveryClient: { snapshot: () => ({ selectedBufferId: selected }) }, sourceState: { source: "file", path: "/notes.md", draftId: null },
    getCurrentResourceDirValue: () => "/", fileBackedBaselineText: "disk", fileBackedDiskRevision: null });
  load(c, "function getEditorDraftSourceKey()", "function markFileBackedBaseline");
  const original = c.getEditorDraftSourceKey(); selected = "document";
  assert.notEqual(c.getEditorDraftSourceKey(), original); selected = "prompt"; c.editorSourceGeneration++;
  assert.equal(c.getEditorDraftSourceKey(), original);
  states.set("prompt", { sourceGeneration: 21 }); assert.notEqual(c.getEditorDraftSourceKey(), original);
});

test("file-dialog focus changes are not editor mutations; all semantic ownership remains in its consent", () => {
  const c = context({ captureRecoveryConsent: () => ({ connection: 4, workspace: { editor: { text: "draft", sourceKey: "prompt", generation: 2 },
    fileBackedBaselineText: "disk", fileBackedDiskRevision: "revision", scratchpadEditGeneration: 8, reviewNotesEditGeneration: 9,
    resourceDir: "/project", editorLanguage: "markdown", selectionStart: 3, selectionEnd: 6, selectionDirection: "backward", scrollTop: 20, previewScrollTop: 50 } }) });
  load(c, "function captureStudioBufferOpenConsent()", "async function promptStudioBufferDocumentPath()");
  const consent = c.captureStudioBufferOpenConsent();
  assert.equal(consent.connection, 4);
  assert.equal(consent.workspace.editor.text, "draft"); assert.equal(consent.workspace.fileBackedBaselineText, "disk");
  assert.equal(consent.workspace.fileBackedDiskRevision, "revision"); assert.equal(consent.workspace.scratchpadEditGeneration, 8);
  assert.equal(consent.workspace.reviewNotesEditGeneration, 9); assert.equal(consent.workspace.resourceDir, "/project");
  assert.equal(consent.workspace.selectionStart, undefined); assert.equal(consent.workspace.scrollTop, undefined);
});

test("file opening checks captured origin, destination revision and authorized preview ownership before replacement", async () => {
  for (const change of ["origin", "revision", "owner", "operation", "run"]) {
    const calls = []; let resolveFetch, current = true, previewCurrent = true;
    const target = { id: "document", role: "document", revision: 1, text: "", baselineText: "", sourceState: { path: null }, view: {} };
    let destination = target;
    const c = context({ uiBusy: false, studioBuffersCanSwitch: () => true, bufferRecoveryClient: { capture: () => ({ ok: true }), snapshot: () => ({ buffers: [destination] }), replace: () => calls.push("replace") },
      buildWorkspacePersistencePayload: () => ({}), fileBackedBaselineText: null, bufferRecoveryExtra: () => ({}), captureStudioBufferOpenConsent: () => ({}),
      recoveryConsentIsCurrent: () => current, studioPreviewInteractionIsCurrent: () => previewCurrent, pendingBufferDocumentOpen: null,
      confirmPreviewOfficeConversion: async () => true, fetchPreviewLocalLink: () => new Promise(resolve => { resolveFetch = resolve; }), setStatus: () => {} });
    load(c, "function studioBuffersCanOpenDocument(", "function studioBufferScrollPosition(");
    load(c, "async function openStudioBufferDocument(", "function syncBufferRecoveryMenuAccess()");
    const pending = c.openStudioBufferDocument("/other.md", {});
    await new Promise(resolve => setImmediate(resolve)); assert(resolveFetch);
    if (change === "origin") current = false;
    if (change === "revision") destination = { ...target, revision: target.revision + 1 };
    if (change === "owner") previewCurrent = false;
    if (change === "operation") c.pendingBufferDocumentOpen = null;
    if (change === "run") c.uiBusy = true;
    resolveFetch({ text: "Fetched file", path: "/other.md" });
    assert.equal(await pending, false, change); assert.deepEqual(calls, [], change);
  }
});

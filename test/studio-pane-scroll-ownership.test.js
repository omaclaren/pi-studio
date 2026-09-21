// Production pane activation/view/render functions with explicit DOM and scheduler
// adapters. Based on the bounded pane-scroll triage; no browser or model calls.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
function section(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert(a >= 0 && b > a, start);
  return source.slice(a, b);
}
function fixture(mode = "switching", raf = true) {
  const timers = [], frames = [];
  class Pane {
    constructor(top = 0) {
      this._top = top;
      this.scrollLeft = 0;
      this.scrollHeight = 2200;
      this.clientHeight = 1000;
      this.isConnected = true;
      this.value = "unchanged raw editor";
      this.classList = { add() {}, remove() {}, toggle() {} };
    }
    get scrollTop() { return this._top; }
    set scrollTop(value) { this._top = Math.max(0, Math.min(value, this.scrollHeight - this.clientHeight)); }
    get innerHTML() { return this._html || "OLD CONTENT"; }
    set innerHTML(value) {
      this._html = value;
      if (value.includes("trace-panel")) this.scrollHeight = 11226;
    }
    closest() { return this.control ? this : null; }
  }
  const c = vm.createContext({
    Element: Pane, sourceTextEl: new Pane(120), sourcePreviewEl: new Pane(90), critiqueViewEl: new Pane(),
    leftPaneEl: new Pane(), rightPaneEl: new Pane(), activePane: "left", paneFocusTarget: "off",
    rightView: "preview", editorView: "markdown", studioEditorViewGeneration: 0, studioRightViewGeneration: 0,
    bufferSwitchingEnabled: mode === "switching", bufferRecoveryEnabled: mode !== "default",
    bufferViewRestore: null, bufferPageClosed: false, bufferConnectionGeneration: 0, editorContentGeneration: 0,
    selectedBufferId: "prompt", sourceKey: "prompt-source", sourcePreviewRenderNonce: 0, responsePreviewRenderNonce: 0,
    activityTrackingOwnsWorkingView: false, replQuickFocusRequested: false, responseEditorPreviewTimer: null,
    sourcePreviewRenderTimer: null, rightViewSelect: { value: "preview" }, editorViewSelect: { value: "markdown" },
    sourceEditorWrapEl: { style: {} }, normalizeRightViewValue: value => value, latestResponseMarkdown: "",
    traceAutoScroll: false, shouldStickTraceToBottom: () => false, traceFilter: "all", traceDisplayContext: { mode: "live" },
    traceState: { status: "complete", entries: [{ id: "one", type: "assistant", text: "SYNTHETIC WORKING", thinking: "", status: "complete" }] },
    normalizeTraceFilter: value => value, formatReferenceTime: () => "", escapeHtml: text => text,
    renderTraceOutput: text => "<p>" + text + "</p>", previewPendingTimers: new Map(),
    window: { setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {} },
  });
  if (raf) c.window.requestAnimationFrame = fn => { frames.push(fn); return frames.length; };
  c.getEditorDraftSourceKey = () => c.sourceKey;
  c.bufferRecoveryClient = mode === "default" ? null : { snapshot: () => ({ selectedBufferId: c.selectedBufferId }) };
  c.getTraceEntriesForFilter = () => c.traceState.entries;
  c.buildVisibleWorkingText = () => c.traceState.entries.map(entry => entry.text).join("\n");
  for (const name of [
    "syncEditorHighlightScroll", "bindStudioPreviewElementOwner", "decoratePreviewImages", "scheduleResponsePaneRepaintNudge",
    "syncRightViewModeOptions", "clearPreviewJumpHighlight", "updateSourceBadge", "updateReferenceBadge", "updateHistoryControls",
    "updateResultActionButtons", "syncActionButtons", "scheduleWorkspacePersistence", "renderSourcePreview", "updateEditorHighlightState",
    "syncHighlightSelectUi", "updateLineNumberGutterVisibility", "scheduleEditorLineNumberRender", "updateReviewNotesUi",
    "updateEditorSelectionCommentUi", "updateOutlineUi", "syncStudioSelectionAppendAction", "applyPendingResponseScrollReset",
  ]) c[name] = () => {};
  for (const [start, end] of [
    ["function snapshotStudioScrollablePositions()", "function focusPaneViewControl("],
    ["function finishPreviewRender(", "function scheduleResponsePaneRepaintNudge("],
    ["function buildTracePanelHtml()", "function renderReplView()"],
    ["function renderActiveResult()", "function updateResultActionButtons("],
    ["function refreshResponseUi()", "function normalizeStudioResourceDirValue("],
    ["function scheduleStudioBufferScrollRestore(", "function captureStudioBufferTransientState("],
    ["function captureStudioBufferScrollOwner(", "function bindSelectedStudioBuffer("],
    ["function setEditorView(", "function lineNumbersShouldBeVisible("],
    ["function captureEditorConsent()", "function clearPiEditorOperations("],
  ]) vm.runInContext(section(start, end), c);
  const runTimers = () => { for (const fn of timers.splice(0)) fn(); };
  const runFrame = () => { for (const fn of frames.splice(0)) fn(); };
  const drain = () => {
    let count = 0;
    while (timers.length || frames.length) { assert(++count < 12); runTimers(); runFrame(); }
  };
  const activate = (control = false) => {
    const target = new Pane(); target.control = control;
    c.activatePaneFromInteraction("right", { target });
  };
  return { c, Pane, timers, frames, runTimers, runFrame, drain, activate };
}

for (const mode of ["default", "recovery", "switching"]) {
  for (const ordering of ["immediate", "before-second-frame"]) test(mode + ": old pane callbacks cannot scroll a newly selected Working view (" + ordering + ")", () => {
    const f = fixture(mode); f.activate();
    if (ordering === "before-second-frame") { f.runTimers(); f.runFrame(); assert.equal(f.frames.length, 1); }
    f.c.setRightView("trace"); assert.equal(f.c.critiqueViewEl.scrollTop, 10226);
    f.drain(); assert.equal(f.c.critiqueViewEl.scrollTop, 10226);
    assert(f.c.critiqueViewEl.innerHTML.includes("SYNTHETIC WORKING"));
  });
  test(mode + ": view ABA cannot revive a pane snapshot", () => {
    const f = fixture(mode); f.activate(); f.c.setRightView("trace"); f.c.setRightView("preview");
    f.c.critiqueViewEl.scrollTop = 275; f.drain(); assert.equal(f.c.critiqueViewEl.scrollTop, 275);
  });
  test(mode + ": same-view layout restoration and redundant selection remain valid", () => {
    const f = fixture(mode); f.c.setRightView("trace"); f.c.critiqueViewEl.scrollTop = 430; f.activate();
    f.c.setRightView("trace"); f.c.critiqueViewEl.scrollTop = 0; f.drain(); assert.equal(f.c.critiqueViewEl.scrollTop, 430);
  });
  test(mode + ": changing right view leaves the independent source restoration intact", () => {
    const f = fixture(mode); f.activate(); f.c.sourceTextEl.scrollTop = 0; f.c.sourcePreviewEl.scrollTop = 0;
    f.c.setRightView("trace"); f.drain();
    assert.equal(f.c.sourceTextEl.scrollTop, 120); assert.equal(f.c.sourcePreviewEl.scrollTop, 90);
    assert.equal(f.c.critiqueViewEl.scrollTop, 10226);
  });
  test(mode + ": source view ABA retires source offsets without retiring the right pane", () => {
    const f = fixture(mode); f.c.critiqueViewEl.scrollTop = 430; f.activate();
    f.c.setEditorView("preview"); f.c.setEditorView("markdown");
    f.c.sourceTextEl.scrollTop = 250; f.c.sourcePreviewEl.scrollTop = 260; f.c.critiqueViewEl.scrollTop = 0;
    f.drain(); assert.equal(f.c.sourceTextEl.scrollTop, 250); assert.equal(f.c.sourcePreviewEl.scrollTop, 260);
    assert.equal(f.c.critiqueViewEl.scrollTop, 430);
  });
  test(mode + ": settled activation and interactive-target controls keep Working at its bottom", () => {
    for (const control of [false, true]) {
      const f = fixture(mode); f.activate(control); if (control) assert.equal(f.frames.length + f.timers.length, 0);
      f.drain(); f.c.setRightView("trace"); f.drain(); assert.equal(f.c.critiqueViewEl.scrollTop, 10226);
    }
  });
  test(mode + ": Working markup is rebuilt on view return before any interaction", () => {
    const f = fixture(mode); f.c.setRightView("trace"); assert(f.c.critiqueViewEl.innerHTML.includes("trace-card"));
    f.c.setRightView("preview"); f.c.setRightView("trace");
    assert(f.c.critiqueViewEl.innerHTML.includes("SYNTHETIC WORKING"));
    f.c.traceState.entries = []; f.c.renderTraceView();
    assert(f.c.critiqueViewEl.innerHTML.includes("trace-toolbar")); assert(f.c.critiqueViewEl.innerHTML.includes("trace-empty"));
    // DOM-string contract only; this cannot diagnose an empty-looking native paint.
  });
}
for (const mode of ["recovery", "switching"]) for (const change of ["buffer", "client", "connection", "text", "source", "closed"]) {
  test(mode + ": pane restoration retains its captured " + change + " owner", () => {
    const f = fixture(mode); f.activate();
    if (change === "buffer") f.c.selectedBufferId = "document";
    if (change === "client") f.c.bufferRecoveryClient = { snapshot: () => ({ selectedBufferId: "prompt" }) };
    if (change === "connection") f.c.bufferConnectionGeneration++;
    if (change === "text") { f.c.sourceTextEl.value = "new text"; f.c.editorContentGeneration++; }
    if (change === "source") f.c.sourceKey = "other-source";
    if (change === "closed") f.c.bufferPageClosed = true;
    f.c.sourceTextEl.scrollTop = 250; f.c.sourcePreviewEl.scrollTop = 260; f.c.critiqueViewEl.scrollTop = 275;
    f.drain(); assert.equal(f.c.sourceTextEl.scrollTop, 250); assert.equal(f.c.sourcePreviewEl.scrollTop, 260); assert.equal(f.c.critiqueViewEl.scrollTop, 275);
  });
}
test("a replaced or detached pane cannot receive old restoration", () => {
  for (const replace of [false, true]) {
    const f = fixture(); f.activate(); const old = f.c.critiqueViewEl;
    if (replace) f.c.critiqueViewEl = new f.Pane(); else old.isConnected = false;
    old.scrollTop = 275; f.drain(); assert.equal(old.scrollTop, 275);
  }
});
test("timer fallback also rejects stale view ownership", () => {
  const f = fixture("default", false); f.activate(); f.c.setRightView("trace"); f.drain();
  assert.equal(f.c.critiqueViewEl.scrollTop, 10226);
});

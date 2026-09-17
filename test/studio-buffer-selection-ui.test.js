import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
function load(c, start, end) { const a = source.indexOf(start), b = source.indexOf(end, a); assert(a >= 0 && b > a, start); vm.runInContext(source.slice(a, b), c); }
function setup() {
  const calls = [], timers = [], handlers = {}, documentHandlers = {}, fieldHandlers = {}, windowHandlers = {};
  const listen = (target, type, fn) => { const previous = target[type]; target[type] = event => { previous?.(event); fn(event); }; };
  const doc = { id: "doc", role: "document", revision: 4, text: "selected Document", view: {} };
  const prompt = { id: "prompt", role: "prompt", revision: 7, text: "keep Prompt", view: {} };
  const state = { selectedBufferId: "doc", activePromptId: "prompt", buffers: [doc, prompt] };
  const c = vm.createContext({ bufferSwitchingEnabled: true, studioSelectionAppendSourceActive: true, studioSelectionAppendOwnerGeneration: 0, uiBusy: false, agentBusyFromServer: false,
    ws: { readyState: 1 }, WebSocket: { OPEN: 1 }, wsState: "Ready", pendingKind: null,
    canSwitch: true, studioBuffersCanSwitch: () => c.canSwitch,
    pendingBufferDocumentOpen: null, pendingPiEditorLoad: null, pendingPiEditorLink: null, pendingPiEditorClear: null,
    pendingTerminalDocument: null, activeFileImport: null, editorView: "markdown", pendingStudioBufferEditorView: () => null,
    sourceTextEl: { value: doc.text, selectionStart: 0, selectionEnd: 8, selectionDirection: "forward", readOnly: false, disabled: false,
      addEventListener(type, fn) { fieldHandlers[type] = fn; } }, editorViewSelect: { addEventListener() {} },
    document: { activeElement: null, addEventListener(type, fn) { listen(documentHandlers, type, fn); } },
    window: { getSelection: () => null, addEventListener(type, fn) { listen(windowHandlers, type, fn); }, setTimeout: fn => timers.push(fn) },
    getPreviewSelectionPaneIdForNode: node => node?.preview ? "critiqueView" : null,
    bufferRecoveryClient: { snapshot: () => state, capture: () => ({ ok: true }), appendSelectionToPrompt: request => {
      if (request.sourceRevision !== doc.revision || request.promptRevision !== prompt.revision) return { ok: false, message: "stale" };
      calls.push("append"); prompt.revision++; prompt.text += " appended"; return { ok: true, characters: 8 };
    } },
    buildWorkspacePersistencePayload: () => ({}), fileBackedBaselineText: "disk", bufferRecoveryExtra: () => ({}),
    captureRecoveryConsent: () => ({ generation: c.generation }), recoveryConsentIsCurrent: owner => owner.generation === c.generation,
    generation: 1, getStudioSelectedBuffer: () => state.buffers.find(b => b.id === state.selectedBufferId),
    isStudioDocumentBufferView: () => state.selectedBufferId === "doc", syncStudioBufferSwitcher: () => calls.push("controls"),
    setStatus: (...args) => calls.push(args), bufferSwitcherUi: null });
  load(c, "function studioBuffersCanAddSelection(", "function syncStudioBufferSwitcher()");
  const button = { addEventListener: (type, fn) => { handlers[type] = fn; } };
  c.document.activeElement = c.sourceTextEl;
  return { c, calls, timers, state, doc, prompt, button, handlers, documentHandlers, fieldHandlers, windowHandlers,
    get appends() { return calls.filter(x => x === "append"); } };
}

test("editor selection appends without binding, focusing, rendering, saving, sending or transferring ownership", () => {
  const f = setup(), before = structuredClone(f.doc), selected = f.state.selectedBufferId;
  const intent = f.c.captureStudioSelectionAppend(); assert(intent);
  assert.equal(f.c.appendStudioSelectionToPrompt(intent), true);
  assert.deepEqual(f.doc, before); assert.equal(f.state.selectedBufferId, selected);
  assert.equal(f.prompt.text, "keep Prompt appended"); assert.equal(f.calls.filter(x => x === "append").length, 1);
  assert(f.calls.some(x => Array.isArray(x) && /nothing.*sent|nothing.*submitted/i.test(x[0])));
});

test("disabled/default/preview/empty/read-only and unsafe-local/reconnect states never enable an append", () => {
  const mutations = [f => { f.c.bufferSwitchingEnabled = false; }, f => { f.c.studioSelectionAppendSourceActive = false; }, f => { f.state.selectedBufferId = "prompt"; },
    f => { f.c.editorView = "preview"; }, f => { f.c.sourceTextEl.selectionEnd = 0; }, f => { f.c.sourceTextEl.selectionEnd = 1000; },
    f => { f.c.sourceTextEl.readOnly = true; }, f => { f.c.sourceTextEl.disabled = true; },
    f => { f.c.canSwitch = false; }, f => { f.c.wsState = "Reconnecting"; }, f => { f.c.ws = null; },
    f => { f.c.ws.readyState = 3; }, f => { f.c.agentBusyFromServer = true; },
    f => { f.c.pendingStudioBufferEditorView = () => ({}); },
    ...["pendingBufferDocumentOpen", "pendingPiEditorLoad", "pendingPiEditorLink", "pendingPiEditorClear", "pendingTerminalDocument", "activeFileImport"].map(k => f => { f.c[k] = {}; })];
  for (const mutate of mutations) {
    const f = setup(); mutate(f); assert.equal(f.c.studioBuffersCanAddSelection(), false);
    assert.equal(f.c.captureStudioSelectionAppend(), null); assert(!f.calls.includes("append"));
  }
});

test("an identified Run permits a local append but never retargets its submission, steering or Stop", () => {
  const f = setup(); f.c.uiBusy = true; f.c.agentBusyFromServer = true; f.c.pendingKind = "direct"; f.c.wsState = "Submitting";
  // The real common switching gate separately proves the request ID/socket identity.
  assert.equal(f.c.studioBuffersCanAddSelection(), true);
  assert.equal(f.c.appendStudioSelectionToPrompt(f.c.captureStudioSelectionAppend()), true);
  assert.equal(f.c.pendingKind, "direct"); assert.equal(f.c.uiBusy, true); assert.equal(f.c.wsState, "Submitting");
});

test("stale client, selection, source, Prompt revision or consent is refused instead of recaptured or retargeted", () => {
  const changes = [f => { f.c.bufferRecoveryClient = { ...f.c.bufferRecoveryClient }; }, f => { f.c.generation++; },
    f => { f.c.sourceTextEl.selectionStart = 1; }, f => { f.c.sourceTextEl.selectionEnd = 10; },
    f => { f.state.selectedBufferId = "prompt"; }, f => { f.prompt.revision++; }, f => { f.doc.revision++; },
    f => { f.c.pendingBufferDocumentOpen = {}; }, f => { f.c.canSwitch = false; }, f => { f.c.studioSelectionAppendOwnerGeneration++; }];
  for (const change of changes) {
    const f = setup(), intent = f.c.captureStudioSelectionAppend(); change(f);
    assert.equal(f.c.appendStudioSelectionToPrompt(intent), false); assert(!f.calls.includes("append"));
  }
});

test("failed capture, append bounds or persistence representation never fall through to a replacement", () => {
  const f = setup(); f.c.bufferRecoveryClient.capture = () => ({ ok: false, message: "Too large" });
  assert.equal(f.c.captureStudioSelectionAppend(), null); assert(!f.calls.includes("append"));
  f.c.bufferRecoveryClient.capture = () => ({ ok: true }); const intent = f.c.captureStudioSelectionAppend();
  f.c.bufferRecoveryClient.appendSelectionToPrompt = () => ({ ok: false, message: "Target too large" });
  assert.equal(f.c.appendStudioSelectionToPrompt(intent), false); assert.equal(f.prompt.text, "keep Prompt");
});

test("native button activation is captured before focus changes, single-use and rejects stale mouse-up", () => {
  const f = setup(); f.c.setupStudioSelectionAppendAction(f.button);
  f.handlers.pointerdown({ button: 0 }); f.c.generation++;
  f.handlers.click({ detail: 1 }); assert(!f.calls.includes("append"));
  f.handlers.pointerdown({ button: 0 }); f.handlers.click({ detail: 1 }); assert.equal(f.calls.filter(x => x === "append").length, 1);
  f.handlers.pointerdown({ button: 0 }); f.handlers.click({ detail: 2 }); assert.equal(f.calls.filter(x => x === "append").length, 1);
});

test("preview/iframe/other-field selection revokes the retained textarea range; source refocus cannot revive a pressed-button intent", () => {
  for (const revoke of [f => f.documentHandlers.pointerdown({ target: {} }), f => f.documentHandlers.focusin({ target: { matches: () => true } }),
    f => f.windowHandlers.blur(), f => f.documentHandlers.focusin({ target: { matches: () => false, preview: true } })]) {
    const f = setup(); f.c.setupStudioSelectionAppendAction(f.button); f.handlers.pointerdown({ button: 0 });
    revoke(f); assert.equal(f.c.studioBuffersCanAddSelection(), false);
    f.fieldHandlers.focus(); assert.equal(f.c.studioBuffersCanAddSelection(), true);
    f.handlers.click({ detail: 1 }); assert(!f.calls.includes("append"));
    f.handlers.pointerdown({ button: 0 }); f.handlers.click({ detail: 1 }); assert(f.calls.includes("append"));
  }
});

test("source refocus or a new source gesture retires a held press even while ownership remains active", () => {
  for (const type of ["focus", "pointerdown", "keydown"]) {
    const f = setup(); f.c.setupStudioSelectionAppendAction(f.button); f.handlers.pointerdown({ button: 0 });
    f.c.document.activeElement = f.button;
    f.c.document.activeElement = f.c.sourceTextEl; f.fieldHandlers[type]({ key: "Shift" });
    assert.equal(f.c.studioSelectionAppendSourceActive, true);
    f.handlers.click({ detail: 1 }); assert(!f.calls.includes("append"), type);
    f.handlers.pointerdown({ button: 0 }); f.handlers.click({ detail: 1 }); assert(f.calls.includes("append"));
  }
});

test("observed range or direction A→B→A cannot revive a held press without a boolean ownership transition", () => {
  for (const event of ["select", "selectionchange"]) for (const directionOnly of [false, true]) {
    const f = setup(); f.c.setupStudioSelectionAppendAction(f.button); f.handlers.pointerdown({ button: 0 });
    f.c.document.activeElement = f.button;
    const notify = () => event === "select" ? f.fieldHandlers.select() : f.documentHandlers.selectionchange();
    if (directionOnly) f.c.sourceTextEl.selectionDirection = "backward"; else f.c.sourceTextEl.selectionEnd = 9;
    notify();
    if (directionOnly) f.c.sourceTextEl.selectionDirection = "forward"; else f.c.sourceTextEl.selectionEnd = 8;
    notify(); assert.equal(f.c.studioSelectionAppendSourceActive, true);
    f.handlers.click({ detail: 1 }); assert(!f.calls.includes("append"), event + " direction=" + directionOnly);
    f.handlers.pointerdown({ button: 0 }); f.handlers.click({ detail: 1 }); assert(f.calls.includes("append"));
  }
});

test("document selection observation cannot reclaim a revoked source even if focus was retained", () => {
  const f = setup(); f.c.setupStudioSelectionAppendAction(f.button);
  f.documentHandlers.pointerdown({ target: {} });
  assert.equal(f.c.document.activeElement, f.c.sourceTextEl);
  f.documentHandlers.selectionchange(); assert.equal(f.c.studioBuffersCanAddSelection(), false);
  f.fieldHandlers.select(); assert.equal(f.c.studioBuffersCanAddSelection(), true);
});

test("late unchanged selection events after button focus do not cancel the captured native activation", () => {
  const f = setup(); f.c.setupStudioSelectionAppendAction(f.button);
  // The range changes before the press, but its browser notification arrives after.
  f.c.sourceTextEl.selectionEnd = 9;
  f.handlers.pointerdown({ button: 0 }); f.c.document.activeElement = f.button;
  f.fieldHandlers.select(); f.documentHandlers.selectionchange(); f.fieldHandlers.keyup();
  f.handlers.click({ detail: 1 }); assert.equal(f.calls.filter(x => x === "append").length, 1);
});

test("Enter/Space repeats cannot duplicate additions; fresh keyboard and assistive clicks remain usable", () => {
  const f = setup(); f.c.setupStudioSelectionAppendAction(f.button);
  for (const key of ["Enter", " "]) {
    f.handlers.keydown({ key, repeat: false }); f.handlers.click({ detail: 0 });
    let prevented = false; f.handlers.keydown({ key, repeat: true, preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
  }
  assert.equal(f.calls.filter(x => x === "append").length, 2);
  f.handlers.click({ detail: 0 }); assert.equal(f.calls.filter(x => x === "append").length, 3);
});

// The existing whole-document action is the template for independent leases.
for (const cancel of ["outside-release", "pointercancel"]) {
  test(`selection's fresh click-only activation after ${cancel} is not a retired pointer continuation`, () => {
    const f = setup(); f.c.setupStudioSelectionAppendAction(f.button);
    f.handlers.pointerdown({ button: 0 });
    if (cancel === "pointercancel") f.handlers.pointercancel();
    else f.documentHandlers.pointerup?.({ target: f.c.sourceTextEl });
    assert.equal(f.appends.length, 0);
    f.handlers.click({ detail: 0 }); assert.equal(f.appends.length, 1);
    f.handlers.click({ detail: 1 }); assert.equal(f.appends.length, 1, "old pointer click cannot borrow the fresh activation");
    f.handlers.pointerdown({ button: 0 }); f.handlers.click({ detail: 1 }); assert.equal(f.appends.length, 2);
  });
}

for (const first of ["pointer", "keyboard"]) {
  test(`selection ${first}-first overlapping input consumes only its newer modality's lease`, () => {
    const f = setup(); f.c.setupStudioSelectionAppendAction(f.button);
    if (first === "pointer") {
      f.handlers.pointerdown({ button: 0 }); f.handlers.keydown({ key: " ", repeat: false });
      f.handlers.click({ detail: 0 }); assert.equal(f.appends.length, 1); f.handlers.click({ detail: 1 });
    } else {
      f.handlers.keydown({ key: " ", repeat: false }); f.handlers.pointerdown({ button: 0 });
      f.handlers.click({ detail: 1 }); assert.equal(f.appends.length, 1); f.handlers.click({ detail: 0 });
    }
    assert.equal(f.appends.length, 1);
    f.handlers.click({ detail: 0 }); assert.equal(f.appends.length, 2, "a later explicit click remains usable");
  });
}

test("selection's cancelled Space keyup retires after its native activation, without swallowing fresh AT clicks", () => {
  const f = setup(); f.c.setupStudioSelectionAppendAction(f.button);
  f.handlers.keydown({ key: " ", repeat: false }); f.handlers.pointerdown({ button: 0 }); f.handlers.click({ detail: 1 });
  assert.equal(f.appends.length, 1);
  f.documentHandlers.keyup?.({ key: " ", target: f.button }); f.timers.splice(0).forEach(fn => fn());
  f.handlers.click({ detail: 0 }); assert.equal(f.appends.length, 2);
});

test("selection keyup cleanup cannot revive a retired key or clear a newer refused key lease", () => {
  for (const newer of [false, true]) {
    const f = setup(); f.c.setupStudioSelectionAppendAction(f.button);
    f.handlers.keydown({ key: " ", repeat: false }); f.documentHandlers.input?.({ target: f.c.sourceTextEl });
    f.documentHandlers.keyup?.({ key: " ", target: f.button });
    if (newer) {
      f.c.canSwitch = false; f.handlers.keydown({ key: " ", repeat: false }); f.c.canSwitch = true;
      f.timers.splice(0).forEach(fn => fn());
    }
    f.handlers.click({ detail: 0 }); assert.equal(f.appends.length, 0);
    f.timers.splice(0).forEach(fn => fn()); f.handlers.click({ detail: 0 }); assert.equal(f.appends.length, 1);
  }
});

test("selection's own button focus is safe but a different action's key/focus retires held selection intent", () => {
  for (const type of ["keydown", "focusin"]) {
    const f = setup(); f.c.setupStudioSelectionAppendAction(f.button);
    f.handlers.pointerdown({ button: 0 }); f.documentHandlers.focusin({ target: f.button });
    f.handlers.click({ detail: 1 }); assert.equal(f.appends.length, 1);
    f.handlers.pointerdown({ button: 0 }); f.documentHandlers[type]?.({ target: { matches: () => false }, key: " " });
    f.handlers.click({ detail: 1 }); assert.equal(f.appends.length, 1);
    f.handlers.pointerdown({ button: 0 }); f.handlers.click({ detail: 1 }); assert.equal(f.appends.length, 2);
  }
});

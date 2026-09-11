import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
function setup() {
  const calls = [], timers = [], handlers = {}, documentHandlers = {}, windowHandlers = {};
  const doc = { id: "doc", role: "document", revision: 4, text: "whole Document", view: {} };
  const prompt = { id: "prompt", role: "prompt", revision: 7, text: "keep Prompt", view: {} };
  const state = { selectedBufferId: "doc", activePromptId: "prompt", buffers: [doc, prompt] };
  const button = { disabled: false, addEventListener: (type, fn) => { handlers[type] = fn; } }, info = { textContent: "" };
  const c = vm.createContext({ bufferSwitchingEnabled: true, studioDocumentAppendOwnerGeneration: 0, bufferBindingInProgress: false,
    // Neither selection ownership nor a nonempty native range is required.
    studioSelectionAppendSourceActive: false, studioSelectionAppendOwnerGeneration: 10,
    uiBusy: false, agentBusyFromServer: false, ws: { readyState: 1 }, WebSocket: { OPEN: 1 }, wsState: "Ready", pendingKind: null,
    canSwitch: true, studioBuffersCanSwitch: () => c.canSwitch,
    pendingBufferDocumentOpen: null, pendingPiEditorLoad: null, pendingPiEditorLink: null, pendingPiEditorClear: null,
    pendingTerminalDocument: null, activeFileImport: null, editorView: "markdown", pendingStudioBufferEditorView: () => null,
    sourceTextEl: { value: doc.text, selectionStart: 2, selectionEnd: 2, readOnly: false, disabled: false },
    document: { activeElement: null, addEventListener: (type, fn) => { documentHandlers[type] = fn; } },
    window: { addEventListener: (type, fn) => { windowHandlers[type] = fn; }, setTimeout: fn => timers.push(fn) },
    bufferRecoveryClient: { snapshot: () => state, capture: () => ({ ok: true }),
      documentAppendInfo: () => c.infoFailure || { ok: true, characters: doc.text.length, addedCharacters: 60, availableCharacters: 899989 },
      appendDocumentToPrompt: request => {
        if (request.sourceId !== state.selectedBufferId || request.sourceRevision !== doc.revision || request.promptRevision !== prompt.revision) return { ok: false, message: "stale" };
        calls.push("append"); prompt.revision++; prompt.text += " whole Document"; return { ok: true, characters: doc.text.length };
      } },
    buildWorkspacePersistencePayload: () => ({}), fileBackedBaselineText: "disk", bufferRecoveryExtra: () => ({}),
    captureRecoveryConsent: () => ({ generation: c.generation }), recoveryConsentIsCurrent: owner => owner.generation === c.generation,
    generation: 1, getStudioSelectedBuffer: () => state.buffers.find(b => b.id === state.selectedBufferId),
    isStudioDocumentBufferView: () => state.selectedBufferId === "doc", syncStudioBufferSwitcher: () => calls.push("controls"),
    setStatus: (...args) => calls.push(args), bufferSwitcherUi: { addDocument: button, documentInfo: info } });
  const a = source.indexOf("function studioDocumentAppendAvailability("), b = source.indexOf("function syncStudioBufferSwitcher()", a);
  assert(a >= 0 && b > a, "document append helpers exist"); vm.runInContext(source.slice(a, b), c);
  return { c, calls, timers, doc, prompt, state, button, info, handlers, documentHandlers, windowHandlers,
    get appends() { return calls.filter(x => x === "append"); } };
}

test("full-document action needs no source selection/focus and changes neither Document nor selection ownership", () => {
  const f = setup(), before = structuredClone(f.doc), selected = f.state.selectedBufferId;
  assert(f.c.studioBuffersCanAddDocument()); const intent = f.c.captureStudioDocumentAppend(); assert(intent);
  assert(f.c.appendStudioDocumentToPrompt(intent)); assert.deepEqual(f.doc, before); assert.equal(f.state.selectedBufferId, selected);
  assert.equal(f.c.sourceTextEl.selectionStart, 2); assert.equal(f.c.sourceTextEl.selectionEnd, 2);
  assert.equal(f.c.studioSelectionAppendSourceActive, false); assert.equal(f.c.studioSelectionAppendOwnerGeneration, 10);
  assert.deepEqual(f.calls.filter(x => typeof x === "string"), ["append", "controls"]);
  assert(f.calls.some(x => Array.isArray(x) && /Nothing sent/.test(x[0])));
});

test("raw-editor capability, connection and unsafe-operation fences stay intact", () => {
  const mutations = [f => { f.c.bufferSwitchingEnabled = false; }, f => { f.state.selectedBufferId = "prompt"; },
    f => { f.c.editorView = "preview"; }, f => { f.c.sourceTextEl.readOnly = true; }, f => { f.c.sourceTextEl.disabled = true; },
    f => { f.c.canSwitch = false; }, f => { f.c.wsState = "Reconnecting"; }, f => { f.c.ws = null; },
    f => { f.c.ws.readyState = 3; }, f => { f.c.agentBusyFromServer = true; }, f => { f.c.sourceTextEl.value = "uncaptured text"; },
    f => { f.c.pendingStudioBufferEditorView = () => ({}); },
    ...["pendingBufferDocumentOpen", "pendingPiEditorLoad", "pendingPiEditorLink", "pendingPiEditorClear", "pendingTerminalDocument", "activeFileImport"].map(k => f => { f.c[k] = {}; })];
  for (const mutate of mutations) { const f = setup(); mutate(f); assert.equal(f.c.studioBuffersCanAddDocument(), false);
    assert.equal(f.c.captureStudioDocumentAppend(), null); assert(!f.calls.includes("append")); }
});

test("size description is visible and exact; empty/oversize preflight disables with a reason", () => {
  const f = setup(); f.c.syncStudioDocumentAppendAction(); assert.equal(f.button.disabled, false);
  assert.match(f.info.textContent, /60/); assert.match(f.info.textContent, /899,?989/); assert.match(f.info.textContent, /UTF-16/);
  for (const failure of [{ ok: false, reason: "empty-document", message: "Document is empty." },
    { ok: false, reason: "limit-exceeded", message: "Too large; nothing added.", addedCharacters: 901000, availableCharacters: 899989 }]) {
    f.c.infoFailure = failure; f.c.syncStudioDocumentAppendAction(); assert.equal(f.button.disabled, true); assert(f.info.textContent.includes(failure.message));
    assert.equal(f.c.captureStudioDocumentAppend(), null);
  }
});

test("identified Run permits next-draft append without changing request state or Stop", () => {
  const f = setup(); f.c.uiBusy = true; f.c.agentBusyFromServer = true; f.c.pendingKind = "direct"; f.c.wsState = "Submitting";
  // The shared switching predicate has separate exact-request/socket tests.
  assert(f.c.studioBuffersCanAddDocument()); assert(f.c.appendStudioDocumentToPrompt(f.c.captureStudioDocumentAppend()));
  assert.equal(f.c.pendingKind, "direct"); assert.equal(f.c.uiBusy, true); assert.equal(f.c.wsState, "Submitting");
});

test("client/consent/source/Prompt changes and stale size refuse, never recapture", () => {
  for (const change of [f => { f.c.bufferRecoveryClient = { ...f.c.bufferRecoveryClient }; }, f => { f.c.generation++; },
    f => { f.doc.revision++; }, f => { f.prompt.revision++; }, f => { f.state.selectedBufferId = "prompt"; },
    f => { f.c.studioDocumentAppendOwnerGeneration++; }, f => { f.c.infoFailure = { ok: false, message: "No room" }; }]) {
    const f = setup(), intent = f.c.captureStudioDocumentAppend(); change(f);
    assert.equal(f.c.appendStudioDocumentToPrompt(intent), false); assert(!f.calls.includes("append"));
  }
});

test("failed representation or shared application cannot become replacement or apparent success", () => {
  const f = setup(); f.c.bufferRecoveryClient.capture = () => ({ ok: false, message: "Too large" });
  assert.equal(f.c.captureStudioDocumentAppend(), null);
  f.c.bufferRecoveryClient.capture = () => ({ ok: true }); const intent = f.c.captureStudioDocumentAppend();
  f.c.bufferRecoveryClient.appendDocumentToPrompt = () => ({ ok: false, message: "Changed" });
  assert.equal(f.c.appendStudioDocumentToPrompt(intent), false); assert.equal(f.prompt.text, "keep Prompt");
});

test("held press retires on source edit/undo, outside interaction, blur or cancellation", () => {
  for (const revoke of [f => { f.documentHandlers.input({ target: f.c.sourceTextEl }); },
    f => { f.documentHandlers.pointerdown({ target: f.c.sourceTextEl }); },
    f => { f.documentHandlers.keydown({ target: f.c.sourceTextEl, key: "ArrowLeft" }); },
    f => { f.documentHandlers.focusin({ target: {} }); }, f => f.windowHandlers.blur(),
    f => { f.handlers.pointercancel(); }]) {
    const f = setup(); f.c.setupStudioDocumentAppendAction(f.button); f.handlers.pointerdown({ button: 0 }); revoke(f);
    // Final strings, native ranges and role IDs can all be unchanged.
    f.handlers.click({ detail: 1 }); assert(!f.calls.includes("append"));
    f.handlers.pointerdown({ button: 0 }); f.handlers.click({ detail: 1 }); assert(f.calls.includes("append"));
  }
});

test("normal button focus and delayed unchanged selection observation do not cancel a valid press", () => {
  const f = setup(); f.c.setupStudioDocumentAppendAction(f.button); f.handlers.pointerdown({ button: 0 });
  f.documentHandlers.focusin({ target: f.button }); f.documentHandlers.selectionchange?.({ target: f.c.sourceTextEl });
  f.handlers.click({ detail: 1 }); assert.equal(f.calls.filter(x => x === "append").length, 1);
});

test("keyboard/assistive activations work while held keys and double-click continuation append once", () => {
  const f = setup(); f.c.setupStudioDocumentAppendAction(f.button);
  f.handlers.pointerdown({ button: 0 }); f.handlers.click({ detail: 1 });
  f.handlers.pointerdown({ button: 0 }); f.handlers.click({ detail: 2 });
  assert.equal(f.calls.filter(x => x === "append").length, 1);
  for (const key of ["Enter", " "]) {
    f.handlers.keydown({ key, repeat: false }); f.handlers.click({ detail: 0 });
    let prevented = false; f.handlers.keydown({ key, repeat: true, preventDefault: () => { prevented = true; } }); assert(prevented);
  }
  f.handlers.click({ detail: 0 }); assert.equal(f.calls.filter(x => x === "append").length, 4);
});


// Whole-document review: unlike a retired native pointer continuation, a fresh
// click-only activation is a separate modality and must not consume that lease.
for (const cancel of ["outside-release", "pointercancel"]) {
  test(`fresh click-only activation after ${cancel} adds on its first attempt`, () => {
    const f = setup(); f.c.setupStudioDocumentAppendAction(f.button);
    f.handlers.pointerdown({ button: 0 });
    if (cancel === "pointercancel") f.handlers.pointercancel();
    else f.documentHandlers.pointerup({ target: f.c.sourceTextEl });
    assert.equal(f.appends.length, 0);
    f.handlers.click({ detail: 0 });
    assert.equal(f.appends.length, 1);
    // A stale pointer continuation cannot borrow the fresh assistive intent.
    f.handlers.click({ detail: 1 });
    assert.equal(f.appends.length, 1);
    f.handlers.pointerdown({ button: 0 }); f.handlers.click({ detail: 1 });
    assert.equal(f.appends.length, 2);
  });
}

test("pointer and keyboard continuations cannot borrow each other's new activation", () => {
  for (const first of ["pointer", "keyboard"]) {
    const f = setup(); f.c.setupStudioDocumentAppendAction(f.button);
    if (first === "pointer") {
      f.handlers.pointerdown({ button: 0 }); f.handlers.keydown({ key: " ", repeat: false });
      f.handlers.click({ detail: 0 }); assert.equal(f.appends.length, 1);
      f.handlers.click({ detail: 1 });
    } else {
      f.handlers.keydown({ key: " ", repeat: false }); f.handlers.pointerdown({ button: 0 });
      f.handlers.click({ detail: 1 }); assert.equal(f.appends.length, 1);
      f.handlers.click({ detail: 0 });
    }
    assert.equal(f.appends.length, 1, first);
    f.handlers.click({ detail: 0 }); assert.equal(f.appends.length, 2, first);
  }
});

test("completed keyboard cancellation cannot consume a later click-only activation", () => {
  const f = setup(); f.c.setupStudioDocumentAppendAction(f.button);
  f.handlers.keydown({ key: " ", repeat: false });
  f.handlers.pointerdown({ button: 0 }); f.handlers.click({ detail: 1 });
  assert.equal(f.appends.length, 1);
  // Native pointer activation can cancel Space's default keyup click entirely.
  f.documentHandlers.keyup?.({ key: " ", target: f.button });
  f.timers.splice(0).forEach(fn => fn());
  f.handlers.click({ detail: 0 }); assert.equal(f.appends.length, 2);
});

test("keyup cleanup waits through native activation and cannot clear a newer failed key lease", () => {
  for (const newer of [false, true]) {
    const f = setup(); f.c.setupStudioDocumentAppendAction(f.button);
    f.handlers.keydown({ key: " ", repeat: false }); f.documentHandlers.input({ target: f.c.sourceTextEl });
    f.documentHandlers.keyup?.({ key: " ", target: f.button });
    if (newer) {
      f.c.canSwitch = false; f.handlers.keydown({ key: " ", repeat: false }); f.c.canSwitch = true;
      f.timers.splice(0).forEach(fn => fn());
    }
    f.handlers.click({ detail: 0 }); assert.equal(f.appends.length, 0);
    f.timers.splice(0).forEach(fn => fn());
    f.handlers.click({ detail: 0 }); assert.equal(f.appends.length, 1);
  }
});

function openFixture() {
  const f = setup(); let resolveFetch, rejectFetch;
  f.doc.sourceState = { path: null }; f.doc.baselineText = "";
  Object.assign(f.c, {
    captureStudioBufferOpenConsent: f.c.captureRecoveryConsent,
    studioPreviewInteractionIsCurrent: () => true,
    studioBuffersCanOpenDocument: () => f.c.canSwitch && !f.c.uiBusy,
    confirmPreviewOfficeConversion: async () => true,
    requestStudioConfirmation: async () => true,
    fetchPreviewLocalLink: () => new Promise((resolve, reject) => { resolveFetch = resolve; rejectFetch = reject; }),
    syncStudioSelectionAppendAction: () => {},
  });
  const start = source.indexOf("async function openStudioBufferDocument(");
  const end = source.indexOf("function syncBufferRecoveryMenuAccess()", start);
  assert(start >= 0 && end > start); vm.runInContext(source.slice(start, end), f.c);
  f.c.syncStudioDocumentAppendAction();
  return { ...f, resolve: value => resolveFetch(value), reject: error => rejectFetch(error) };
}

test("starting a file read immediately synchronizes whole-document availability", async () => {
  const f = openFixture(); const pending = f.c.openStudioBufferDocument("/next.md", {});
  await new Promise(resolve => setImmediate(resolve));
  try { assert.equal(f.button.disabled, true); assert.match(f.info.textContent, /Wait for the current action/); }
  finally { f.c.generation++; f.resolve({ text: "new file", path: "/next.md" }); await pending; }
});

for (const outcome of ["stale", "error"]) {
  test(`file-open ${outcome} cleanup immediately restores current document action and feedback`, async () => {
    const f = openFixture(); const pending = f.c.openStudioBufferDocument("/next.md", {});
    await new Promise(resolve => setImmediate(resolve));
    if (outcome === "stale") { f.c.generation++; f.doc.text += " unsaved"; f.c.sourceTextEl.value = f.doc.text; f.doc.revision++; }
    f.c.syncStudioDocumentAppendAction(); assert.equal(f.button.disabled, true);
    if (outcome === "stale") { f.resolve({ text: "new file", path: "/next.md" }); assert.equal(await pending, false); }
    else { const rejected = assert.rejects(pending, /read failed/); f.reject(new Error("read failed")); await rejected; }
    assert.equal(f.c.pendingBufferDocumentOpen, null);
    assert.equal(f.button.disabled, false); assert.match(f.info.textContent, /UTF-16 units, label included/);
    assert.equal(f.appends.length, 0); assert.equal(f.prompt.text, "keep Prompt");
    assert.equal(f.doc.text, outcome === "stale" ? "whole Document unsaved" : "whole Document");
  });
}

test("old file-open cleanup cannot enable document append over a newer pending owner", async () => {
  const f = openFixture(); const pending = f.c.openStudioBufferDocument("/next.md", {});
  await new Promise(resolve => setImmediate(resolve));
  const newer = {}; f.c.pendingBufferDocumentOpen = newer; f.c.syncStudioDocumentAppendAction();
  f.resolve({ text: "new file", path: "/next.md" }); assert.equal(await pending, false);
  assert.equal(f.c.pendingBufferDocumentOpen, newer); assert.equal(f.button.disabled, true);
  assert.equal(f.appends.length, 0);
});

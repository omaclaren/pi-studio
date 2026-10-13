import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { createStudioBufferClient } from "../shared/studio-buffer-client.js";
import { createStudioBufferServerStore } from "../shared/studio-buffer-server.js";

// Oliver, 11 Oct: Add to Prompt says how much it added and offers Undo, so an accidental add is
// harmless. Undo never overwrites later work.
const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const workspaceId = "tab_" + "e".repeat(32);
const editor = (text, path = null) => ({ version: 1, savedAt: 1, text,
  sourceState: { source: path ? "file" : "blank", path, draftId: path ? null : "draft", label: path ? path.split("/").at(-1) : "Document" },
  diskRevision: path ? "sha256:" + "e".repeat(64) : null, resourceDir: path ? "/source" : "",
  editorView: "markdown", rightView: "editor-preview", editorLanguage: "markdown", followLatest: false, responseHistoryIndex: -1,
  selectionStart: 0, selectionEnd: 0, scrollTop: 0 });
const role = (client, name) => client.snapshot().buffers.find(b => b.role === name);
async function setup() {
  const values = new Map(), server = createStudioBufferServerStore();
  const capability = server.issue({ workspaceId, mode: "full" }).capability;
  let nextId = 0;
  const client = createStudioBufferClient({ workspaceId, mode: "full", switching: true, storage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) },
    makeBufferId: () => "document-" + ++nextId, canRestore: () => true, readRemote: async () => server.read(capability), writeRemote: async (s, r) => server.write(capability, r, s),
    readLegacyRemote: async () => ({ ok: true, state: null }), onIssue() {} });
  assert((await client.initialize(editor("Ask about this:"), null)).ok);
  const doc = role(client, "document");
  assert(client.replace(doc.id, doc.revision, editor("Notes to add", "/source/notes.md"), "Notes to add").ok);
  assert(client.select(doc.id).ok);
  await client.settled();
  const add = () => { const d = role(client, "document"), p = role(client, "prompt");
    return client.appendDocumentToPrompt({ sourceId: d.id, sourceRevision: d.revision, promptId: p.id, promptRevision: p.revision }); };
  return { client, add };
}
const undoFor = (client, previousText) => { const p = role(client, "prompt"); return { promptId: p.id, revision: p.revision, addedText: p.text, previousText }; };

test("Undo puts the Prompt back exactly as it was before the add", async () => {
  const f = await setup(), before = role(f.client, "prompt").text;
  assert(f.add().ok); assert.notEqual(role(f.client, "prompt").text, before);
  const undo = undoFor(f.client, before);
  assert.deepEqual(f.client.undoPromptAppend(undo), { ok: true });
  assert.equal(role(f.client, "prompt").text, before);
  assert.equal(role(f.client, "document").text, "Notes to add", "the Document is untouched");
  assert.equal(f.client.undoPromptAppend(undo).ok, false, "single use");
});

test("Undo refuses once the Prompt has changed, or once you've left the Document", async () => {
  const f = await setup(), before = role(f.client, "prompt").text;
  assert(f.add().ok); const undo = undoFor(f.client, before);
  assert(f.add().ok, "a second add changes the Prompt again");
  const refused = f.client.undoPromptAppend(undo);
  assert.equal(refused.ok, false); assert.match(refused.message, /changed after the add\. Nothing was undone/);
  const g = await setup(), gBefore = role(g.client, "prompt").text;
  assert(g.add().ok); const gUndo = undoFor(g.client, gBefore);
  assert(g.client.select(role(g.client, "prompt").id).ok);
  assert.equal(g.client.undoPromptAppend(gUndo).ok, false);
  assert.notEqual(role(g.client, "prompt").text, gBefore, "nothing was undone");
});

function declaration(name) {
  const start = source.search(new RegExp("\\n      (?:async )?function " + name + "\\("));
  assert(start >= 0, name);
  return source.slice(start, source.indexOf("\n      }\n", start) + 9);
}
function uiHarness(promptText = "Ask about this:") {
  const statuses = [], appended = [];
  let prompt = { id: "prompt", revision: 1, text: promptText };
  const client = { snapshot: () => ({ activePromptId: "prompt", buffers: [prompt] }),
    undoPromptAppend: undo => { appended.push(undo); prompt = { ...prompt, revision: prompt.revision + 1, text: undo.previousText }; return { ok: true }; } };
  const status = { textContent: "" };
  const docListeners = {}, timers = [];
  const c = { statusLineEl: { appendChild: el => { c.appended = el; } }, statusEl: status, statusMessage: "", uiBusy: false, pendingBufferDocumentOpen: null,
    studioPromptAddUndo: null, studioPromptAddUndoBtn: null, bufferRecoveryClient: client, selected: "document",
    getStudioSelectedBuffer: () => ({ role: c.selected }), syncStudioBufferSwitcher() {},
    document: { createElement: () => { const listeners = {}; return { listeners, addEventListener: (t, f) => { listeners[t] = f; } }; },
      addEventListener: (t, f) => { (docListeners[t] ||= []).push(f); } },
    window: { addEventListener: (t, f) => { (docListeners["window:" + t] ||= []).push(f); }, setTimeout: f => timers.push(f) },
    setStatus: (message, level) => { statuses.push([message, level]); c.statusMessage = message; status.textContent = message; c.syncStudioPromptAddUndo(); } };
  vm.createContext(c);
  vm.runInContext(["studioActivePromptBuffer", "rememberStudioPromptAdd", "syncStudioPromptAddUndo", "undoStudioPromptAdd"].map(declaration).join("\n"), c);
  const fire = (type, event) => (docListeners[type] || []).forEach(f => f(event));
  return { c, client, statuses, appended, docListeners, fire, timers, grow: text => { prompt = { ...prompt, revision: prompt.revision + 1, text: prompt.text + text }; } };
}

test("after an add the status says how much was added and shows Undo; Undo restores and says so", () => {
  const h = uiHarness(), before = h.c.studioActivePromptBuffer(h.client);
  h.grow("\n\nFrom notes.md:\n\n1234"); h.c.rememberStudioPromptAdd(h.client, before);
  assert.deepEqual(h.statuses.at(-1), ["Added 22 characters to the Prompt. Nothing sent.", "success"]);
  const button = h.c.studioPromptAddUndoBtn;
  assert.equal(button.textContent, "Undo"); assert.equal(button.hidden, false); assert.equal(h.c.appended, button);
  button.listeners.click({ detail: 0 }); // a click-only (assistive) activation
  assert.equal(h.appended[0].previousText, "Ask about this:");
  assert.deepEqual(h.statuses.at(-1), ["Undone. The Prompt is as it was.", "success"]); assert.equal(button.hidden, true);
});

test("Undo goes away when another status replaces the add's, or you switch to the Prompt", () => {
  const h = uiHarness(), before = h.c.studioActivePromptBuffer(h.client);
  h.grow("x"); h.c.rememberStudioPromptAdd(h.client, before);
  assert.deepEqual(h.statuses.at(-1), ["Added 1 character to the Prompt. Nothing sent.", "success"]);
  h.c.selected = "prompt"; h.c.syncStudioPromptAddUndo(); assert.equal(h.c.studioPromptAddUndoBtn.hidden, true);
  h.c.selected = "document"; h.c.syncStudioPromptAddUndo(); assert.equal(h.c.studioPromptAddUndoBtn.hidden, false);
  h.c.setStatus("Connected.", ""); assert.equal(h.c.studioPromptAddUndo, null); assert.equal(h.c.studioPromptAddUndoBtn.hidden, true);
  h.c.setStatus("Added 1 character to the Prompt. Nothing sent.", "success"); assert.equal(h.c.studioPromptAddUndoBtn.hidden, true, "a retired Undo never comes back");
});

test("both Add to Prompt actions report through the Undo path", () => {
  for (const name of ["appendStudioSelectionToPrompt", "appendStudioDocumentToPrompt"]) {
    const body = declaration(name);
    assert.match(body, /const before = studioActivePromptBuffer\(intent\.client\);/);
    assert.match(body, /rememberStudioPromptAdd\(intent\.client, before\);/);
    assert.doesNotMatch(body, /added to Prompt\. Nothing sent/);
  }
  assert.match(source, /if \(typeof syncStudioPromptAddUndo === "function"\) syncStudioPromptAddUndo\(\);/);
});

// Sol (candidate66): Undo is pinned to the add seen when it was pressed, with the Add buttons'
// separate pointer/keyboard leases; a retired press never undoes anything.
const addAgain = (h, text) => { const before = h.c.studioActivePromptBuffer(h.client); h.grow(text); h.c.rememberStudioPromptAdd(h.client, before); };
test("a held pointer press for one add can't undo a newer add; the newer add keeps its Undo", () => {
  const h = uiHarness(); addAgain(h, "A");
  const button = h.c.studioPromptAddUndoBtn;
  h.fire("pointerdown", { target: button }); button.listeners.pointerdown({ button: 0 });
  addAgain(h, "BB"); // add B while the press is held
  button.listeners.click({ detail: 1 });
  assert.deepEqual(h.appended, [], "the stale release did nothing"); assert.equal(button.hidden, false, "B can still be undone");
  button.listeners.pointerdown({ button: 0 }); button.listeners.click({ detail: 1 });
  assert.equal(h.appended.length, 1); assert.equal(h.appended[0].previousText, "Ask about this:A", "the fresh press undid B only");
});

test("focus moving away retires a held press: blur → add B → late pointer click leaves B and its Undo", () => {
  const h = uiHarness(); addAgain(h, "A");
  const button = h.c.studioPromptAddUndoBtn;
  button.listeners.pointerdown({ button: 0 });
  h.fire("focusin", { target: { id: "addDocument" } }); // keyboard focus moves to Add
  addAgain(h, "B");
  button.listeners.click({ detail: 1 });
  assert.deepEqual(h.appended, []); assert.equal(button.hidden, false);
  button.listeners.click({ detail: 0 }); // a genuinely fresh click-only activation acts on the current add
  assert.equal(h.appended.length, 1); assert.equal(h.appended[0].previousText, "Ask about this:A");
});

test("keyboard presses pin too; a held repeat is suppressed; a press released elsewhere is retired", () => {
  const h = uiHarness(); addAgain(h, "A");
  const button = h.c.studioPromptAddUndoBtn;
  button.listeners.keydown({ key: "Enter", repeat: false });
  addAgain(h, "B");
  button.listeners.click({ detail: 0 }); assert.deepEqual(h.appended, [], "the keyboard press saw A");
  let prevented = false; button.listeners.keydown({ key: "Enter", repeat: true, preventDefault() { prevented = true; } });
  assert.equal(prevented, true, "held Enter doesn't fire further clicks");
  button.listeners.pointerdown({ button: 0 }); h.fire("pointerup", { target: {} }); // released outside: retired, not fresh
  button.listeners.click({ detail: 1 }); assert.deepEqual(h.appended, [], "the late click from a retired press does nothing");
  h.fire("keyup", { key: "Enter" }); h.timers.forEach(f => f());
  button.listeners.click({ detail: 0 }); assert.equal(h.appended.length, 1, "after keyup a fresh click-only activation works");
});

test("while Studio is busy, Undo is shown but disabled, and its add is kept", () => {
  const h = uiHarness(), before = h.c.studioActivePromptBuffer(h.client);
  h.grow("A"); h.c.rememberStudioPromptAdd(h.client, before);
  h.c.uiBusy = true; h.c.syncStudioPromptAddUndo();
  const button = h.c.studioPromptAddUndoBtn; assert.equal(button.hidden, false); assert.equal(button.disabled, true);
  assert.equal(h.c.undoStudioPromptAdd(), false); assert.notEqual(h.c.studioPromptAddUndo, null, "not retired by a busy refusal");
  h.c.uiBusy = false; h.c.syncStudioPromptAddUndo(); assert.equal(button.disabled, false);
  assert.equal(h.c.undoStudioPromptAdd(), true);
  assert.match(source, /syncPromptRunIndicator\(\);\n        if \(typeof syncStudioPromptAddUndo === "function"\) syncStudioPromptAddUndo\(\);/);
});

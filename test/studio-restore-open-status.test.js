import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { createStudioBufferServerStore } from "../shared/studio-buffer-server.js";
import { createStudioBufferClient } from "../shared/studio-buffer-client.js";
import { createStudioDocumentOpenController } from "../shared/studio-document-open-client.js";

// Oliver, 15 Oct: a fresh dual-mode workspace said "Restored Prompt and Document in this
// browser tab", and every file open said "Opened the file in its existing buffer…".
const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
function section(start, end) { const a = source.indexOf(start), b = source.indexOf(end, a); assert(a >= 0 && b > a); return source.slice(a, b); }

const workspaceId = "tab_" + "d".repeat(32);
const editor = text => ({ version: 1, savedAt: 1, text, sourceState: { source: "blank", path: null, draftId: "draft", label: "Document" }, diskRevision: null, resourceDir: "",
  editorView: "markdown", rightView: "editor-preview", editorLanguage: "markdown", followLatest: false, responseHistoryIndex: -1, selectionStart: 0, selectionEnd: 0, scrollTop: 0 });
function storage() { const values = new Map(); return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) }; }
function makeClient(server, capability, tab) {
  return createStudioBufferClient({ workspaceId, mode: "editor-only", storage: tab, makeBufferId: () => "doc-" + Math.random().toString(16).slice(2), canRestore: () => true,
    readRemote: async () => server.read(capability), writeRemote: async (s, r) => server.write(capability, r, s),
    readLegacyRemote: async () => ({ ok: true, state: null }), onIssue() {} });
}

test("only a copy this tab kept counts as restored from the browser; a server-registered launch doesn't", async () => {
  const server = createStudioBufferServerStore(), capability = server.issue({ workspaceId, mode: "editor-only" }).capability, tab = storage();
  const first = makeClient(server, capability, tab);
  const fresh = await first.initialize(editor("hello"), "");
  assert(fresh.ok, fresh.message); assert.equal(fresh.restored, false); assert.equal(fresh.fromBrowser, false);
  await first.settled(); first.dispose();
  const otherTab = await makeClient(server, capability, storage()).initialize(editor(""), "");
  assert(otherTab.ok, otherTab.message); assert.equal(otherTab.editor.text, "hello");
  assert.equal(otherTab.restored, true, "the server copy is still loaded"); assert.equal(otherTab.fromBrowser, false, "but this tab had no copy of its own");
  const reload = await makeClient(server, capability, tab).initialize(editor(""), "");
  assert(reload.ok, reload.message); assert.equal(reload.restored, true); assert.equal(reload.fromBrowser, true);
});

test("the page reports a restore only when it applied the tab's own copy, in plain words", () => {
  const init = section("            if (restored.restored) {", "            bufferRecoveryClient = client;");
  const run = (applies, fromBrowser) => {
    const c = { restored: { restored: true, fromBrowser, editor: {} }, client: { snapshot: () => ({ buffers: [], selectedBufferId: null }) }, documentHostingEnabled: true, sourceState: {},
      workspaceRestoredFromBrowser: false, applyPersistedWorkspaceState: () => { if (applies) c.workspaceRestoredFromBrowser = true; return applies; } };
    vm.createContext(c); vm.runInContext(init, c); return c.workspaceRestoredFromBrowser;
  };
  assert.equal(run(true, true), true, "a reload");
  assert.equal(run(true, false), false, "a fresh launch the server registered");
  assert.equal(run(false, true), false, "a refused apply (Sol)");
  assert(source.includes('setStatus(bufferSwitchingEnabled ? "Restored the Prompt and Document." :'));
  assert(!source.includes("Both texts were kept"));
});

async function opened(message) {
  let record = null; const notes = [], sent = [];
  const client = { openBackup: () => ({ record }), hostingAuthority: () => ({ ok: true, expectedRevision: "a".repeat(48), documentEpoch: 1 }),
    beginOpen: r => { record = { request: r }; return { ok: true }; }, finishOpen: () => { record = null; return { ok: true, selectedChanged: false }; }, settled: async () => {} };
  const controller = createStudioDocumentOpenController({ client: () => client, generation: () => 1, makeOperationId: () => "b".repeat(48), prepare: async () => {}, busy: () => false,
    request: async b => { sent.push(b.operation); return b.operation === "open-ack" ? { ok: true } : { ok: true, status: "committed" }; }, capture() {}, domCurrent: () => true, bind() {}, replace() {}, changed() {},
    status: (m, severity) => notes.push([m, severity]), reuse: async () => true, ...(message === undefined ? {} : { opened: id => message(id) }) });
  assert((await controller.open({ bufferId: "doc", path: "/work/notes.md", sourcePath: "", resourceDir: "" })).ok);
  assert.deepEqual(sent, ["open", "open-ack"], "committed and acknowledged");
  return notes;
}

test("a committed open names the file and where it went; with no name it says so plainly", async () => {
  let asked = null;
  assert.deepEqual(await opened(id => { asked = id; return "Opened notes.md in the Document."; }), [["Opened notes.md in the Document.", "success"]]);
  assert.equal(asked, "doc");
  assert.deepEqual(await opened(() => ""), [["Opened the file.", "success"]]);
  assert.deepEqual(await opened(undefined), [["Opened the file.", "success"]]);
  assert.deepEqual(await opened(() => { throw Error("formatting"); }), [["Opened the file.", "success"]], "narration can't change the outcome (Sol)");
  assert(!source.includes("existing buffer"));
});

test("the page's wording uses the opened buffer's file name and role", () => {
  const body = section("          opened: bufferId => {", "          reuse: async request => {");
  const run = (buffers, switching) => {
    const c = { bufferSwitchingEnabled: switching, bufferRecoveryClient: buffers === null ? { snapshot: () => null } : { snapshot: () => ({ buffers }) } };
    vm.createContext(c); return vm.runInContext("({" + body + "})", c).opened("b1");
  };
  const buffer = (role, path) => ({ id: "b1", role, sourceState: { path } });
  assert.equal(run([buffer("document", "/work/notes.md")], true), "Opened notes.md in the Document.");
  assert.equal(run([buffer("prompt", "/work/ask.md")], true), "Opened ask.md in the Prompt.");
  assert.equal(run([buffer("prompt", "C:\\work\\ask.md")], false), "Opened ask.md.", "one editor: no role; a Windows path");
  assert.equal(run([buffer("document", "\\\\server\\share\\x.md")], true), "Opened x.md in the Document.", "a Windows share");
  assert.equal(run([buffer("document", "/work/a\\b.md")], true), "Opened a\\b.md in the Document.", "a backslash is part of a POSIX name (Sol)");
  assert.equal(run([buffer("document", "/work/a#b?.md")], true), "Opened a#b?.md in the Document.", "the canonical name is kept whole");
  assert.equal(run([buffer("document", null)], true), "", "no path: the controller's plain fallback");
  assert.equal(run(null, true), "", "a disposed client");
});

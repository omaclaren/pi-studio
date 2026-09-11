import test from "node:test";
import assert from "node:assert/strict";
import { createStudioBufferClient } from "../shared/studio-buffer-client.js";
import { createStudioBufferServerStore } from "../shared/studio-buffer-server.js";
import { STUDIO_BUFFER_LIMITS } from "../shared/studio-buffer-store.js";

const workspaceId = "tab_" + "e".repeat(32), key = "piStudio.bufferWorkspace.v2:" + workspaceId;
const diskRevision = "sha256:" + "e".repeat(64);
const editor = (text, path = null) => ({ version: 1, savedAt: 1, text,
  sourceState: { source: path ? "file" : "blank", path, draftId: path ? null : "draft", label: path ? path.split("/").at(-1) : "Document" },
  diskRevision: path ? diskRevision : null, resourceDir: path ? "/source" : "",
  editorView: "markdown", rightView: "editor-preview", editorLanguage: "markdown", followLatest: false, responseHistoryIndex: -1,
  selectionStart: 0, selectionEnd: 0, scrollTop: 0 });
const role = (client, name) => client.snapshot().buffers.find(b => b.role === name);
async function setup({ promptText = "Kept Prompt\n", promptPath = "/prompt/ask.md", documentText = "Heading\n[an: keep] αβ\nLast", ...options } = {}) {
  const values = new Map(), issues = [], server = createStudioBufferServerStore();
  const capability = server.issue({ workspaceId, mode: options.mode || "full" }).capability;
  let nextId = 0;
  const storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
  const client = createStudioBufferClient({ workspaceId, mode: "full", switching: true, storage, makeBufferId: () => "selection-" + ++nextId,
    canRestore: () => true, readRemote: async () => server.read(capability), writeRemote: async (s, r) => server.write(capability, r, s),
    readLegacyRemote: async () => ({ ok: true, state: null }), onIssue: s => issues.push(s), ...options });
  assert((await client.initialize(editor(promptText, promptPath), promptPath ? promptText : null)).ok);
  if (options.switching !== false && options.mode !== "editor-only") {
    const prompt = role(client, "prompt"), doc = role(client, "document");
    assert(client.persist({ ...editor(promptText, promptPath), rightView: "preview", followLatest: true, responseHistoryIndex: 3,
      selectionStart: 1, selectionEnd: Math.min(3, promptText.length), scrollTop: 45,
      ...(promptText.length ? {} : { selectionStart: 0, selectionEnd: 0 }) }, promptPath ? promptText : null,
    { view: { selectionDirection: "backward", previewScrollTop: 70, rightScrollTop: 130 }, metadata: { annotationsEnabled: false, scratchpadKey: "prompt-scratch", reviewNotesKey: "prompt-review" } }).ok);
    assert(client.replace(doc.id, doc.revision, { ...editor(documentText, "/source/notes.md"), selectionStart: 0, selectionEnd: documentText.length, scrollTop: 100 }, "disk document",
      { view: { selectionDirection: "backward", previewScrollTop: 90, rightScrollTop: 150 }, metadata: { annotationsEnabled: true, scratchpadKey: "document-scratch", reviewNotesKey: "document-review" } }).ok);
    assert(client.select(doc.id).ok); assert.equal(client.snapshot().activePromptId, prompt.id);
  }
  await client.settled();
  const request = () => {
    const doc = role(client, "document"), prompt = role(client, "prompt");
    return { sourceId: doc.id, sourceRevision: doc.revision, promptId: prompt.id, promptRevision: prompt.revision,
      start: doc.view.selectionStart, end: doc.view.selectionEnd };
  };
  return { client, values, storage, server, capability, issues, request };
}

test("selection append changes only Prompt text/revision, keeps both identities/views and persists the complete pair", async () => {
  const f = await setup(), before = f.client.snapshot(), prompt = role(f.client, "prompt"), doc = role(f.client, "document");
  const result = f.client.appendSelectionToPrompt(f.request()); assert.equal(result.ok, true);
  const after = role(f.client, "prompt");
  assert.equal(after.text, prompt.text + "\n\nFrom `notes.md` (editor lines 1–3, snapshot):\n\n" + doc.text);
  assert.deepEqual({ ...after, text: prompt.text, revision: prompt.revision }, prompt);
  assert.deepEqual(role(f.client, "document"), doc);
  assert.equal(f.client.snapshot().selectedBufferId, before.selectedBufferId); assert.equal(f.client.snapshot().activePromptId, before.activePromptId);
  assert.equal(after.revision, prompt.revision + 1); assert.equal(result.characters, doc.text.length);
  await f.client.settled(); assert.deepEqual(JSON.parse(f.values.get(key)), f.client.snapshot());
  assert.deepEqual(f.server.read(f.capability).state, f.client.snapshot()); assert.equal(f.client.needsUnloadConfirmation(), false);
});

test("blank and detached Prompts keep their origin, baseline and annotation policy; source text never stays linked", async () => {
  for (const promptText of ["", "original detached draft"]) {
    const f = await setup({ promptText, promptPath: null }), original = role(f.client, "prompt");
    assert(f.client.appendSelectionToPrompt(f.request()).ok);
    const added = role(f.client, "prompt").text;
    assert(added.startsWith(promptText + (promptText ? "\n\n" : "") + "From `notes.md`"));
    assert.deepEqual(role(f.client, "prompt").sourceState, original.sourceState);
    assert.equal(role(f.client, "prompt").baselineText, ""); assert.equal(role(f.client, "prompt").metadata.annotationsEnabled, false);
    const doc = role(f.client, "document");
    assert(f.client.replace(doc.id, doc.revision, editor("later source edit", "/other.md"), "disk").ok);
    assert.equal(role(f.client, "prompt").text, added); await f.client.settled();
  }
});

test("snapshot keeps exact selected whitespace, CRLF, annotations and Unicode with exclusive-end editor line numbers", async () => {
  const text = "head\r\n\t[an: note] 🐈\r\n  tail\n", start = 6, end = text.indexOf("  tail");
  const f = await setup({ documentText: text });
  assert(f.client.capture({ ...editor(text, "/source/notes.md"), selectionStart: start, selectionEnd: end }, "disk document").ok);
  const before = role(f.client, "prompt").text;
  assert(f.client.appendSelectionToPrompt(f.request()).ok);
  assert.equal(role(f.client, "prompt").text, before + "\n\nFrom `notes.md` (editor line 2, snapshot):\n\n" + text.slice(start, end));
  await f.client.settled();
});

test("labels are literal code spans with bounded escaped controls, not Markdown, HTML or invented file paths", async () => {
  const f = await setup(), doc = role(f.client, "document");
  const label = "![x](https://example.test) ` <img>\n[an: filename]";
  assert(f.client.replace(doc.id, doc.revision, { ...editor("part"), sourceState: { ...editor("").sourceState, label }, selectionEnd: 4 }, null).ok);
  assert(f.client.appendSelectionToPrompt(f.request()).ok);
  assert(role(f.client, "prompt").text.includes("From ``![x](https://example.test) ` <img>\\n[an: filename]`` (editor line 1, snapshot):\n\npart"));
  await f.client.settled();
});

test("boundary backticks are separated from provenance delimiters without changing either draft's bytes", async () => {
  for (const label of ["`leading", "trailing`", "`both`", "`", "``", "``leading ` run", "imported copy: ![probe](probe.png).md`", "imported copy: [probe](notes.md)``"]) {
    const selected = " \t[an: keep] 🐈\r\n", f = await setup({ documentText: selected });
    const doc = role(f.client, "document");
    assert(f.client.replace(doc.id, doc.revision, { ...editor(selected), sourceState: { ...editor("").sourceState, label }, selectionEnd: selected.length }, null).ok);
    const before = f.client.snapshot(), prompt = role(f.client, "prompt"), ticks = "`".repeat(1 + Math.max(...label.match(/`+/g).map(run => run.length)));
    assert(f.client.appendSelectionToPrompt(f.request()).ok);
    assert.equal(role(f.client, "prompt").text, prompt.text + "\n\nFrom " + ticks + " " + label + " " + ticks + " (editor line 1, snapshot):\n\n" + selected);
    assert.deepEqual(role(f.client, "document"), before.buffers.find(b => b.role === "document"));
    assert.deepEqual({ ...role(f.client, "prompt"), text: prompt.text, revision: prompt.revision }, prompt);
    await f.client.settled();
  }
});

test("wrong roles, selected source, Prompt ID, stale revisions and invalid/unselected ranges are refused atomically", async () => {
  for (const alter of [r => ({ ...r, sourceId: r.promptId }), r => ({ ...r, promptId: r.sourceId }), r => ({ ...r, sourceId: "missing" }),
    r => ({ ...r, sourceRevision: r.sourceRevision + 1 }), r => ({ ...r, promptRevision: r.promptRevision + 1 }),
    r => ({ ...r, start: -1 }), r => ({ ...r, start: 1 }), r => ({ ...r, end: 0 }), r => ({ ...r, end: 10000 }), r => ({ ...r, start: 0.5 })]) {
    const f = await setup(), before = f.client.snapshot(), stored = f.values.get(key);
    assert.equal(f.client.appendSelectionToPrompt(alter(f.request())).ok, false);
    assert.equal(f.client.snapshot(), before); assert.equal(f.values.get(key), stored); await f.client.settled();
  }
  const f = await setup(), intent = f.request(); f.client.select(intent.promptId);
  const before = f.client.snapshot(); assert.equal(f.client.appendSelectionToPrompt(intent).ok, false); assert.equal(f.client.snapshot(), before);
  await f.client.settled();
});

test("a successful intent is single-use; a fresh deliberate append does not erase the previous snapshot", async () => {
  const f = await setup(), intent = f.request(); assert(f.client.appendSelectionToPrompt(intent).ok);
  const after = f.client.snapshot(); assert.equal(f.client.appendSelectionToPrompt(intent).ok, false); assert.equal(f.client.snapshot(), after);
  const text = role(f.client, "prompt").text; assert(f.client.appendSelectionToPrompt(f.request()).ok);
  assert(role(f.client, "prompt").text.startsWith(text + "\n\nFrom ")); await f.client.settled();
});

test("preview, disposed, foundation-only, editor-only and unrepresented sources cannot append", async () => {
  for (const kind of ["preview", "disposed", "unrepresented"]) {
    const f = await setup(), intent = f.request();
    if (kind === "preview") { const doc = role(f.client, "document"); f.client.capture({ ...editor(doc.text, doc.sourceState.path), editorView: "preview", selectionEnd: doc.text.length }, "disk"); }
    if (kind === "disposed") f.client.dispose();
    if (kind === "unrepresented") assert.equal(f.client.capture(editor("x".repeat(STUDIO_BUFFER_LIMITS.textChars + 1)), null).ok, false);
    const before = f.client.snapshot(); assert.equal(f.client.appendSelectionToPrompt(kind === "preview" ? f.request() : intent).ok, false, kind);
    assert.equal(f.client.snapshot(), before); await f.client.settled();
  }
  for (const options of [{ switching: false }, { mode: "editor-only" }]) {
    const f = await setup(options), before = f.client.snapshot();
    assert.equal(f.client.appendSelectionToPrompt({}).reason, "switching-disabled"); assert.equal(f.client.snapshot(), before);
  }
});

test("per-buffer and aggregate bounds reject appending without truncating or evicting either draft", async () => {
  for (const aggregate of [false, true]) {
    const f = await setup({ promptText: "p".repeat(aggregate ? 700000 : 899950), documentText: "d".repeat(aggregate ? 200000 : 100) });
    if (aggregate) {
      const doc = role(f.client, "document");
      assert(f.client.capture({ ...editor(doc.text, doc.sourceState.path), selectionEnd: doc.text.length }, "b".repeat(900000)).ok);
      // 700k Prompt +700k baseline +200k Document +900k baseline =2.5m;
      // choose a larger Document to take aggregate over3m while keeping Prompt <=900k.
      const prompt = role(f.client, "prompt");
      assert(f.client.replace(prompt.id, prompt.revision, { ...editor("p".repeat(100000), prompt.sourceState.path) }, "b".repeat(900000)).ok);
      assert(f.client.capture({ ...editor("d".repeat(900000), doc.sourceState.path), selectionEnd: 300000 }, "b".repeat(900000)).ok);
    }
    const before = f.client.snapshot(); assert.equal(f.client.appendSelectionToPrompt(f.request()).reason, "limit-exceeded");
    assert.equal(f.client.snapshot(), before); await f.client.settled();
  }
});

test("unavailable recovery reports uncertainty but keeps the accepted in-memory append and prior stored data", async () => {
  const f = await setup(), raw = f.values.get(key);
  f.storage.setItem = () => { throw new Error("storage unavailable"); };
  const result = f.client.appendSelectionToPrompt(f.request()); assert(result.ok);
  assert(role(f.client, "prompt").text.includes("From `notes.md`")); assert.equal(f.values.get(key), raw);
  assert(f.issues.some(message => message));
  await f.client.settled();
});

import test from "node:test";
import assert from "node:assert/strict";
import { createStudioBufferClient } from "../shared/studio-buffer-client.js";
import { createStudioBufferServerStore } from "../shared/studio-buffer-server.js";
import { STUDIO_BUFFER_LIMITS } from "../shared/studio-buffer-store.js";

const workspaceId = "tab_" + "f".repeat(32), key = "piStudio.bufferWorkspace.v2:" + workspaceId;
const diskRevision = "sha256:" + "f".repeat(64);
const editor = (text, path = null) => ({ version: 1, savedAt: 1, text,
  sourceState: { source: path ? "file" : "blank", path, draftId: path ? null : "draft", label: path ? path.split("/").at(-1) : "Document" },
  diskRevision: path ? diskRevision : null, resourceDir: path ? "/source" : "",
  editorView: "markdown", rightView: "editor-preview", editorLanguage: "markdown", followLatest: false, responseHistoryIndex: -1,
  selectionStart: 0, selectionEnd: 0, scrollTop: 0 });
const role = (client, name) => client.snapshot().buffers.find(b => b.role === name);
async function setup({ promptText = "Kept Prompt\n \t", promptPath = "/prompt/ask.md", documentText = "Heading\r\n[an: keep] 🐈\rLast\n  ", ...options } = {}) {
  const values = new Map(), issues = [], server = createStudioBufferServerStore();
  const capability = server.issue({ workspaceId, mode: options.mode || "full" }).capability;
  let nextId = 0;
  const storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
  const client = createStudioBufferClient({ workspaceId, mode: "full", switching: true, storage, makeBufferId: () => "document-" + ++nextId,
    canRestore: () => true, readRemote: async () => server.read(capability), writeRemote: async (s, r) => server.write(capability, r, s),
    readLegacyRemote: async () => ({ ok: true, state: null }), onIssue: s => issues.push(s), ...options });
  assert((await client.initialize(editor(promptText, promptPath), promptPath ? promptText : null)).ok);
  if (options.switching !== false && options.mode !== "editor-only") {
    const doc = role(client, "document");
    assert(client.persist({ ...editor(promptText, promptPath), rightView: "preview", scrollTop: 45 }, promptPath ? promptText : null,
      { view: { previewScrollTop: 70, rightScrollTop: 130 }, metadata: { annotationsEnabled: false, scratchpadKey: "prompt-scratch", reviewNotesKey: "prompt-review" } }).ok);
    assert(client.replace(doc.id, doc.revision, { ...editor(documentText, "/source/notes.md"), scrollTop: 100 }, "disk document",
      { view: { selectionDirection: "backward", previewScrollTop: 90, rightScrollTop: 150 }, metadata: { annotationsEnabled: true, scratchpadKey: "document-scratch", reviewNotesKey: "document-review" } }).ok);
    assert(client.select(doc.id).ok);
  }
  await client.settled();
  const request = () => { const doc = role(client, "document"), prompt = role(client, "prompt");
    return { sourceId: doc.id, sourceRevision: doc.revision, promptId: prompt.id, promptRevision: prompt.revision }; };
  return { client, values, storage, server, capability, issues, request };
}

test("full document append has a pure exact-size preflight and changes only Prompt text/revision", async () => {
  const f = await setup(), before = f.client.snapshot(), doc = role(f.client, "document"), prompt = role(f.client, "prompt");
  const addition = "\n\nFrom `notes.md` (whole document):\n\n" + doc.text;
  const info = f.client.documentAppendInfo();
  assert.equal(info.ok, true); assert.equal(info.characters, doc.text.length); assert.equal(info.addedCharacters, addition.length);
  assert.equal(info.availableCharacters, STUDIO_BUFFER_LIMITS.textChars - prompt.text.length);
  assert.equal(f.client.snapshot(), before);
  assert(f.client.appendDocumentToPrompt(f.request()).ok);
  const after = role(f.client, "prompt"); assert.equal(after.text, prompt.text + addition);
  assert.deepEqual({ ...after, text: prompt.text, revision: prompt.revision }, prompt);
  assert.deepEqual(role(f.client, "document"), doc); assert.equal(after.revision, prompt.revision + 1);
  assert.equal(f.client.snapshot().selectedBufferId, before.selectedBufferId); assert.equal(f.client.snapshot().activePromptId, before.activePromptId);
  await f.client.settled(); assert.deepEqual(JSON.parse(f.values.get(key)), f.client.snapshot());
  assert.deepEqual(f.server.read(f.capability).state, f.client.snapshot()); assert.equal(f.client.needsUnloadConfirmation(), false);
});

test("no selection, a partial/backward range and caller-supplied fake text never alter the full payload", async () => {
  for (const [start, end, direction] of [[0, 0, "none"], [2, 2, "forward"], [2, 5, "backward"]]) {
    const f = await setup(), doc = role(f.client, "document");
    assert(f.client.capture({ ...editor(doc.text, doc.sourceState.path), selectionStart: start, selectionEnd: end }, doc.baselineText,
      { view: { selectionDirection: direction } }).ok);
    const before = role(f.client, "document"), prefix = role(f.client, "prompt").text;
    assert(f.client.appendDocumentToPrompt({ ...f.request(), text: "not the document", start: 2, end: 5 }).ok);
    assert.equal(role(f.client, "prompt").text, prefix + "\n\nFrom `notes.md` (whole document):\n\n" + doc.text);
    assert.deepEqual(role(f.client, "document"), before); await f.client.settled();
  }
});

test("empty Document refuses without a label-only append; whitespace-only text stays exact", async () => {
  for (const text of ["", " \t\r\n"]) {
    const f = await setup({ documentText: text }), before = f.client.snapshot();
    const info = f.client.documentAppendInfo(), result = f.client.appendDocumentToPrompt(f.request());
    if (!text) { assert.equal(info.reason, "empty-document"); assert.equal(result.reason, "empty-document"); assert.equal(f.client.snapshot(), before); }
    else { assert(info.ok && result.ok); assert(role(f.client, "prompt").text.endsWith(text)); }
    await f.client.settled();
  }
});

test("blank/detached/file-backed Prompts and same-path buffers keep identities and remain independent", async () => {
  for (const promptPath of [null, "/source/notes.md"]) for (const promptText of ["", "old draft"]) {
    const f = await setup({ promptPath, promptText }), prompt = role(f.client, "prompt"), doc = role(f.client, "document");
    assert(f.client.appendDocumentToPrompt(f.request()).ok);
    const added = role(f.client, "prompt"); assert(added.text.startsWith(promptText + (promptText ? "\n\n" : "") + "From "));
    assert.deepEqual({ ...added, text: prompt.text, revision: prompt.revision }, prompt);
    assert(f.client.replace(doc.id, doc.revision, editor("later source", doc.sourceState.path), "new disk").ok);
    assert.equal(role(f.client, "prompt").text, added.text); await f.client.settled();
  }
});

test("full-document provenance uses the same literal boundary-backtick policy as selection", async () => {
  for (const label of ["plain", "`leading", "trailing`", "`", "``", "imported copy: ![probe](probe.png).md`", "[link](notes.md)``", "a\n<image>\u2028"]) {
    const f = await setup(), doc = role(f.client, "document");
    assert(f.client.replace(doc.id, doc.revision, { ...editor(doc.text), sourceState: { ...editor("").sourceState, label } }, null).ok);
    const before = role(f.client, "prompt").text, escaped = JSON.stringify(label).slice(1, -1).replace(/\u2028/g, "\\u2028");
    const ticks = "`".repeat(1 + Math.max(0, ...(escaped.match(/`+/g) || []).map(x => x.length)));
    const pad = escaped.startsWith("`") || escaped.endsWith("`") ? " " : "";
    const addition = "\n\nFrom " + ticks + pad + escaped + pad + ticks + " (whole document):\n\n" + doc.text;
    assert.equal(f.client.documentAppendInfo().addedCharacters, addition.length);
    assert(f.client.appendDocumentToPrompt(f.request()).ok); assert.equal(role(f.client, "prompt").text, before + addition);
    await f.client.settled();
  }
});

test("exact per-buffer and aggregate capacity succeeds; one extra unit refuses without partial insertion", async () => {
  for (const aggregate of [false, true]) for (const over of [false, true]) {
    const f = await setup({ promptText: "p", documentText: "d".repeat(aggregate ? 500000 : 100000) }), doc = role(f.client, "document"), prompt = role(f.client, "prompt");
    const additionLength = f.client.documentAppendInfo().addedCharacters;
    const promptLength = aggregate ? 300000 : STUDIO_BUFFER_LIMITS.textChars - additionLength + Number(over);
    const promptBaseline = aggregate ? 900000 : 0;
    const documentBaseline = aggregate ? STUDIO_BUFFER_LIMITS.totalTextChars - promptLength - promptBaseline - doc.text.length - additionLength + Number(over) : 0;
    assert(f.client.replace(prompt.id, prompt.revision, editor("p".repeat(promptLength), prompt.sourceState.path), "b".repeat(promptBaseline)).ok);
    assert(f.client.capture(editor(doc.text, doc.sourceState.path), "b".repeat(documentBaseline)).ok);
    const before = f.client.snapshot(), raw = f.values.get(key), info = f.client.documentAppendInfo();
    assert.equal(info.availableCharacters, additionLength - Number(over));
    assert.equal(info.ok, !over);
    const result = f.client.appendDocumentToPrompt(f.request()); assert.equal(result.ok, !over);
    if (over) { assert.equal(result.reason, "limit-exceeded"); assert.equal(f.client.snapshot(), before); assert.equal(f.values.get(key), raw); }
    await f.client.settled();
  }
});

test("stale capacity/roles/IDs and revisions refuse instead of retargeting or accepting caller data", async () => {
  for (const alter of [r => ({ ...r, sourceId: r.promptId }), r => ({ ...r, promptId: r.sourceId }), r => ({ ...r, sourceId: "missing" }),
    r => ({ ...r, promptId: "missing" }), r => ({ ...r, sourceRevision: r.sourceRevision + 1 }), r => ({ ...r, promptRevision: r.promptRevision + 1 })]) {
    const f = await setup(), before = f.client.snapshot(); assert.equal(f.client.appendDocumentToPrompt(alter(f.request())).ok, false);
    assert.equal(f.client.snapshot(), before); await f.client.settled();
  }
  const f = await setup(), intent = f.request(); assert(f.client.documentAppendInfo().ok);
  const prompt = role(f.client, "prompt"); assert(f.client.replace(prompt.id, prompt.revision, editor("p".repeat(900000), prompt.sourceState.path), "").ok);
  const before = f.client.snapshot(); assert.equal(f.client.appendDocumentToPrompt(intent).ok, false); assert.equal(f.client.snapshot(), before);
  assert.equal(f.client.documentAppendInfo().reason, "limit-exceeded"); await f.client.settled();
});

test("preview/Prompt/unrepresented/disposed/default/editor-only clients cannot add a document", async () => {
  for (const kind of ["preview", "prompt", "unrepresented", "disposed", "default", "editor-only"]) {
    const f = await setup(kind === "default" ? { switching: false } : kind === "editor-only" ? { mode: kind } : {});
    let intent = {};
    if (!["default", "editor-only"].includes(kind)) {
      intent = f.request(); const doc = role(f.client, "document");
      if (kind === "preview") assert(f.client.capture({ ...editor(doc.text, doc.sourceState.path), editorView: "preview" }, doc.baselineText).ok);
      if (kind === "prompt") assert(f.client.select(intent.promptId).ok);
      if (kind === "unrepresented") assert.equal(f.client.capture(editor("x".repeat(900001)), null).ok, false);
      if (kind === "disposed") f.client.dispose();
    }
    const before = f.client.snapshot(); assert.equal(f.client.documentAppendInfo().ok, false, kind);
    assert.equal(f.client.appendDocumentToPrompt(intent).ok, false, kind); assert.equal(f.client.snapshot(), before); await f.client.settled();
  }
});

test("successful intent is single-use, fresh activation may add again, and recovery failure retains accepted text", async () => {
  const f = await setup(), intent = f.request(); assert(f.client.appendDocumentToPrompt(intent).ok);
  const after = f.client.snapshot(); assert.equal(f.client.appendDocumentToPrompt(intent).ok, false); assert.equal(f.client.snapshot(), after);
  await f.client.settled(); const raw = f.values.get(key), prefix = role(f.client, "prompt").text;
  f.storage.setItem = () => { throw new Error("storage unavailable"); };
  assert(f.client.appendDocumentToPrompt(f.request()).ok); assert(role(f.client, "prompt").text.startsWith(prefix + "\n\nFrom "));
  assert.equal(f.values.get(key), raw); assert(f.issues.some(Boolean)); await f.client.settled();
});

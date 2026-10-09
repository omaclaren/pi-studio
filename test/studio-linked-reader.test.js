import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { studioHostingLocalLinkError } from "../shared/studio-document-entrypoints.js";

// Feature absence is an explicit RED assertion; do not substitute a model reader.
let createStudioLinkedReader;
try {
  ({ createStudioLinkedReader } = await import("../shared/studio-linked-reader.js"));
} catch (error) {
  if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
}
function makeReader(options) {
  assert.equal(typeof createStudioLinkedReader, "function", "the production reader history is not implemented");
  return createStudioLinkedReader(options);
}
const origin = { kind: "editor", bufferId: "document-a" };
const page = (name, text = name) => ({ path: "/notes/" + name, label: name, text, resourceDir: "/notes", extension: ".md" });
function visit(reader, name, text) {
  const ticket = reader.begin(origin);
  const result = reader.commit(ticket, page(name, text));
  assert.equal(result.ok, true);
  return reader.snapshot().current;
}

test("reader snapshots are separate from editable buffers and preserve their origin identity", () => {
  const reader = makeReader();
  const root = { ...origin };
  const ticket = reader.begin(root);
  root.bufferId = "another-buffer";
  assert.equal(reader.snapshot().active, false, "loading a file is not proof that reading began");
  assert.equal(reader.commit(ticket, page("a.md")).ok, true);
  const state = reader.snapshot();
  assert.equal(state.origin.bufferId, "document-a");
  assert.equal(state.current.text, "a.md");
  assert.equal(state.active, true);
  assert.equal("buffers" in state, false);
  assert.equal("diskRevision" in state.current, false, "a read snapshot gains no Save authority");
  assert.throws(() => { state.current.text = "changed"; }, TypeError);
});

test("Back and Forward retain each visited snapshot and its independent position", () => {
  const reader = makeReader();
  visit(reader, "a.md", "original A");
  reader.rememberPosition({ top: 240, left: 7 });
  visit(reader, "b.md", "original B");
  reader.rememberPosition({ top: 600, left: 2 });
  assert.equal(reader.back().left, false);
  assert.equal(reader.snapshot().current.text, "original A");
  assert.deepEqual(reader.snapshot().current.position, { top: 240, left: 7 });
  assert.equal(reader.forward().ok, true);
  assert.equal(reader.snapshot().current.text, "original B");
  assert.deepEqual(reader.snapshot().current.position, { top: 600, left: 2 });
  assert.equal(reader.forward().ok, false);
});

test("first Back returns the origin and retains a forward snapshot until explicit Close", () => {
  const reader = makeReader();
  visit(reader, "a.md");
  reader.rememberPosition({ top: 71, left: 0 });
  const result = reader.back();
  assert.equal(result.left, true);
  assert.equal(result.origin.bufferId, "document-a");
  assert.equal(reader.snapshot().active, false);
  assert.equal(reader.snapshot().forward.label, "a.md");
  assert.equal(reader.forward().ok, true);
  assert.equal(reader.snapshot().current.position.top, 71);
  reader.close();
  assert.equal(reader.snapshot().forward, null);
  assert.equal(reader.snapshot().origin, null);
});

test("a visit from an earlier history position replaces only its forward branch", () => {
  const reader = makeReader();
  visit(reader, "a.md"); visit(reader, "b.md"); visit(reader, "c.md");
  reader.back();
  visit(reader, "d.md");
  assert.deepEqual(reader.snapshot().entries.map(p => p.label), ["a.md", "b.md", "d.md"]);
  assert.equal(reader.snapshot().forward, null);
  assert.equal(reader.snapshot().back.label, "b.md");
});

test("late visits, refreshes and renderer receipts cannot replace a newer reading identity", () => {
  const reader = makeReader();
  const old = reader.begin(origin), next = reader.begin(origin);
  assert.equal(reader.commit(old, page("old.md")).ok, false);
  assert.equal(reader.commit(next, page("a.md")).ok, true);
  const current = reader.snapshot().current;
  assert.equal(reader.isCurrent(current), true);
  const refresh = reader.begin(undefined, { refresh: true });
  reader.back();
  assert.equal(reader.commit(refresh, page("a.md", "late refresh")).ok, false);
  assert.equal(reader.isCurrent(current), false);
  reader.forward();
  const closed = reader.begin(undefined, { refresh: true });
  reader.close();
  assert.equal(reader.commit(closed, page("a.md", "after Close")).ok, false);
});

test("refresh replaces only the selected file and keeps position, history and fragment", () => {
  const reader = makeReader({ now: () => 123 });
  visit(reader, "a.md");
  const b = reader.begin();
  reader.commit(b, { ...page("b.md"), fragment: "section-2" });
  reader.rememberPosition({ top: 211, left: 3 });
  const before = reader.snapshot().current;
  const refresh = reader.begin(undefined, { refresh: true });
  reader.rememberPosition({ top: 250, left: 3 });
  assert.equal(reader.commit(refresh, page("b.md", "changed on disk")).ok, true);
  const state = reader.snapshot();
  assert.equal(state.current.id, before.id);
  assert.equal(state.current.revision, before.revision + 1);
  assert.equal(state.current.text, "changed on disk");
  assert.equal(state.current.fragment, "section-2");
  assert.equal(state.current.position.top, 250);
  assert.equal(state.entries.length, 2);
  assert.equal(reader.isCurrent(before), false);
});

test("refresh cannot silently follow a changed canonical file identity", () => {
  const reader = makeReader();
  visit(reader, "a.md");
  const refresh = reader.begin(undefined, { refresh: true });
  assert.equal(reader.commit(refresh, page("different.md")).ok, false);
  assert.equal(reader.snapshot().current.path, "/notes/a.md");
  assert.equal(reader.snapshot().current.text, "a.md");
});

test("failed or cancelled reads retain current text, position and forward history", () => {
  const reader = makeReader();
  visit(reader, "a.md"); visit(reader, "b.md"); reader.back();
  reader.rememberPosition({ top: 33, left: 2 });
  const request = reader.begin();
  assert.equal(reader.cancel(request), true);
  assert.equal(reader.commit(request, page("cancelled.md")).ok, false);
  assert.equal(reader.snapshot().current.label, "a.md");
  assert.equal(reader.snapshot().current.position.top, 33);
  assert.equal(reader.snapshot().forward.label, "b.md");
});

test("entry and aggregate limits refuse navigation without evicting reading work", () => {
  const reader = makeReader({ maxEntries: 2, maxCharacters: 7, maxEntryCharacters: 5 });
  visit(reader, "a.md", "aaa"); visit(reader, "b.md", "bbb");
  const request = reader.begin();
  assert.equal(reader.commit(request, page("c.md", "c")).ok, false);
  assert.equal(reader.snapshot().current.label, "b.md");
  reader.back();
  const oversized = reader.begin();
  assert.equal(reader.commit(oversized, page("large.md", "123456")).ok, false);
  assert.equal(reader.snapshot().forward.label, "b.md");
  assert.equal(reader.snapshot().current.label, "a.md");
  const total = makeReader({ maxCharacters: 5 });
  visit(total, "a.md", "aaaa");
  assert.equal(total.commit(total.begin(), page("b.md", "bb")).ok, false);
  assert.equal(total.snapshot().current.label, "a.md");
});

test("empty files are readable; malformed snapshots and positions gain no authority", () => {
  const reader = makeReader();
  assert.equal(reader.begin({ kind: "unknown" }), null);
  visit(reader, "empty.md", "");
  reader.rememberPosition({ top: -2, left: Infinity });
  assert.deepEqual(reader.snapshot().current.position, { top: 0, left: 0 });
  const bad = reader.begin();
  assert.equal(reader.commit(bad, { text: "missing path" }).ok, false);
  assert.equal(reader.snapshot().current.label, "empty.md");
});

test("same-file visits keep their own snapshots rather than refreshing existing history", () => {
  const reader = makeReader();
  visit(reader, "a.md", "old"); visit(reader, "a.md", "new");
  reader.back();
  assert.equal(reader.snapshot().current.text, "old");
  assert.notEqual(reader.snapshot().current.id, reader.snapshot().forward.id);
});

// Execute the production responder's body, not a rewritten endpoint. Only erase
// its TS declarations; transport/resource authorization precedes this responder.
const source = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
const start = source.indexOf("async function respondLocalPreviewLinkJson(");
const end = source.indexOf("\nfunction revealStudioLocalFile(", start);
assert.ok(start >= 0 && end > start);
const responder = ts.transpileModule(source.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
async function respond(action, { kind = "text", method = "GET", hosting = true, watched = false, file, limit = 20 } = {}) {
  const calls = { reads: 0, grants: 0, converts: 0, stores: 0, headers: {} };
  let response;
  const path = "/outside/one.md";
  const context = {
    STUDIO_DOCUMENT_HOSTING_ENABLED: hosting,
    PREVIEW_RENDER_MAX_CHARS: limit,
    studioHostingLocalLinkError,
    readTransientStudioDocument: () => null,
    respondJson: (_res, status, payload) => { response = { status, payload }; },
    readStudioFile: () => { calls.reads++; return file || { ok: true, text: "# Snapshot", resolvedPath: path, label: "one.md", diskRevision: "proof" }; },
    dirname: () => "/outside",
    convertStudioOfficeDocumentToMarkdown: () => { calls.converts++; throw new Error("conversion must not run for reader"); },
    storeTransientStudioDocument: () => { calls.stores++; throw new Error("reader must not register an editing workspace"); },
  };
  vm.createContext(context);
  vm.runInContext(responder, context);
  const url = new URL("http://localhost/local-preview-link?action=" + action + (watched ? "&watchedFile=1" : ""));
  await context.respondLocalPreviewLinkJson({ method }, { setHeader: (k, v) => { calls.headers[k] = v; } }, url,
    { kind, filePath: path, resourceDir: "/outside", label: "one.md", extension: ".md", page: 0 },
    { token: "fixture" }, { grantDocument: () => { calls.grants++; throw new Error("file-only read must not grant the containing folder"); } });
  return { ...response, calls };
}

test("production reader endpoint returns a bounded snapshot without parent grants or editing registration", async () => {
  const result = await respond("reader");
  assert.equal(result.status, 200);
  assert.equal(result.payload.text, "# Snapshot");
  assert.equal(result.payload.path, "/outside/one.md");
  assert.equal(result.calls.reads, 1);
  assert.equal(result.calls.grants, 0);
  assert.equal(result.calls.stores, 0);
  assert.equal(result.calls.converts, 0);
  assert.equal("relativeUrl" in result.payload, false);
  assert.equal("diskRevision" in result.payload, false);
});

test("reader endpoint rejects oversized, failed and changed-path reads instead of returning their text", async () => {
  const cases = [
    [{ ok: true, text: "x".repeat(21), resolvedPath: "/outside/one.md" }, 413],
    [{ ok: false, message: "Unreadable" }, 400],
    [{ ok: true, text: "outside changed target", resolvedPath: "/another/secret.md" }, 409],
  ];
  for (const [file, expected] of cases) {
    const result = await respond("reader", { file });
    assert.equal(result.status, expected);
    assert.equal("text" in result.payload, false);
    assert.equal(result.calls.grants, 0);
    assert.equal(result.calls.stores, 0);
  }
});

test("reader rejects binary/Office resources without converting them", async () => {
  for (const kind of ["office", "pdf", "image", "other"]) {
    const result = await respond("reader", { kind });
    assert.equal(result.status, 400);
    assert.equal(result.calls.reads, 0);
    assert.equal(result.calls.converts, 0);
  }
});

test("a watched text origin may read a snapshot without gaining editable Open here", async () => {
  const reading = await respond("reader", { watched: true });
  assert.equal(reading.status, 200);
  assert.equal(reading.calls.grants, 0);
  const editing = await respond("document", { watched: true });
  assert.equal(editing.status, 409);
  assert.equal(editing.calls.reads, 0);
});

test("existing metadata, method and hosting restrictions remain unchanged", async () => {
  for (const [action, options, status] of [
    ["resolve", {}, 200], ["reader", { method: "HEAD" }, 200],
    ["reader", { method: "POST" }, 405], ["preview-url", { kind: "pdf" }, 409],
    ["editor-url", {}, 409], ["document", { kind: "office" }, 409],
  ]) {
    const result = await respond(action, options);
    assert.equal(result.status, status);
    assert.equal(result.calls.reads, 0);
    assert.equal(result.calls.grants, 0);
    assert.equal(result.calls.stores, 0);
  }
});

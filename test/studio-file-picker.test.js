import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const start = source.indexOf("      function studioFilePickDestination("), end = source.indexOf("      async function promptStudioBufferDocumentPath()", start);
const refStart = source.indexOf("      function studioLiteralPathToLinkRef("), refEnd = source.indexOf("      function getPreviewLocalLinkKind(", refStart);
assert(refStart > 0 && refEnd > refStart, "link-ref helper");
assert(start > 0 && end > start, "picker block");
const rowStart = source.indexOf("      function buildStudioFilesRowHtml("), rowEnd = source.indexOf("      function buildFileBrowserEntryRowHtml(", rowStart);

function harness(overrides = {}) {
  const calls = [];
  const c = { calls, bufferSwitchingEnabled: true, bufferRecoveryEnabled: true, bufferRecoveryClient: {}, rightView: "preview",
    critiqueViewEl: { scrollTop: 40, scrollLeft: 0, querySelector: () => null },
    selected: { id: "doc", role: "document" }, fileBrowserState: { currentDir: "/notes" }, uiBusy: false, studioFilePick: null, studioBusyEpoch: 0,
    getStudioSelectedBuffer() { return c.selected; }, studioBuffersCanOpenDocument: () => true,
    captureStudioBufferOpenConsent: () => ({ token: "open" }), captureEditorAsyncConsent: () => ({ token: "copy" }),
    recoveryConsentIsCurrent: consent => consent.token === "open", activeFileImport: null,
    finishFileImport: op => { calls.push(["finish", op]); if (c.activeFileImport === op) c.activeFileImport = null; },
    setRightView: view => { calls.push(["view", view]); c.rightView = view; }, renderFilesView: () => calls.push(["render"]),
    setStatus: (...a) => calls.push(["status", ...a]), getCurrentResourceDirValue: () => "/cwd",
    getFileBrowserLocalLinkContext: () => ({ ctx: "files" }),
    getPreviewLocalLinkKind: path => /\.pdf$/.test(path) ? "pdf" : /\.png$/.test(path) ? "image" : /\.docx$/.test(path) ? "office" : "text",
    openStudioBufferDocument: async (...a) => { calls.push(["open", ...a]); return true; },
    importStudioFileCopyFromPath: async (...a) => { calls.push(["copy", a[1]]); return true; },
    window: { requestAnimationFrame: fn => fn() }, ...overrides };
  vm.createContext(c); vm.runInContext(source.slice(start, end) + source.slice(refStart, refEnd), c); return c;
}

test("Open file… picks in Files and opens the absolute path in the buffer you started from", async () => {
  const c = harness(); assert.equal(c.startStudioFilePick("open"), true);
  assert.equal(c.rightView, "files"); assert.equal(c.studioFilePickDestination(), "Document");
  assert.equal(await c.completeStudioFilePick("/notes/l8.md"), true);
  assert.deepEqual(c.calls.find(x => x[0] === "open"), ["open", "/notes/l8.md", { ctx: "files" }, "document"]);
  assert.equal(c.rightView, "preview", "the right pane returns to what it showed");
});

test("Open a copy… keeps the full guarded import operation and passes an absolute path", async () => {
  const c = harness({ selected: { id: "p", role: "prompt" } }); c.startStudioFilePick("copy");
  const op = c.activeFileImport; assert.ok(op, "import operation pinned at the start");
  assert.equal(await c.completeStudioFilePick("lab5.md"), true);
  assert.deepEqual(c.calls.find(x => x[0] === "copy"), ["copy", "/notes/lab5.md"], "relative paths resolve against the Files folder, not Pi's cwd");
  assert.equal(c.calls.some(x => x[0] === "finish"), false, "the import operation is not finished before it runs");
});

test("a pick is cancelled when the selected buffer changes, or by Cancel, and opens nothing", async () => {
  const c = harness(); c.startStudioFilePick("open"); c.selected = { id: "p", role: "prompt" };
  assert.equal(await c.completeStudioFilePick("/notes/a.md"), false); assert.equal(c.calls.some(x => x[0] === "open"), false);
  assert.ok(c.calls.some(x => x[0] === "status" && /buffer changed/.test(x[1])));
  const d = harness(); d.startStudioFilePick("copy"); const op = d.activeFileImport; d.cancelStudioFilePick();
  assert.equal(vm.runInContext("studioFilePick", d), null); assert.deepEqual(d.calls.find(x => x[0] === "finish"), ["finish", op]); assert.equal(d.rightView, "preview");
});

test("a stale open consent refuses after picking", async () => {
  const c = harness({ captureStudioBufferOpenConsent: () => ({ token: "stale" }) }); c.startStudioFilePick("open");
  assert.equal(await c.completeStudioFilePick("/notes/a.md"), false); assert.equal(c.calls.some(x => x[0] === "open"), false);
});

test("Files rows keep the name visible, read on click, and put the rest under ⋯", () => {
  const c = { escapeHtml: s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/'/g, "&#39;"), documentHostingEnabled: true };
  vm.createContext(c); vm.runInContext(source.slice(rowStart, rowEnd), c);
  const html = c.buildStudioFilesRowHtml({ type: "file", kind: "text", path: "/n/a.md", name: "a.md", icon: "📝", meta: "document · 1 KB" });
  assert.match(html, /data-files-action='read'[^>]*class='files-open-btn'/); assert.match(html, /<span class='files-name'>a\.md<\/span>/);
  assert.match(html, />Open in Document<\/button>/); assert.match(html, />Open in Prompt<\/button>/);
  const more = html.slice(html.indexOf("<details class='files-more'>"));
  for (const label of ["Follow changes", "Open in new window", "Copy path", "Show in folder"]) assert.ok(more.includes(">" + label + "<"), label + " under ⋯");
  const dir = c.buildStudioFilesRowHtml({ type: "directory", kind: "directory", path: "/n/sub", name: "sub", icon: "📁", meta: "folder" });
  assert.match(dir, /data-files-action='open-dir'/); assert.doesNotMatch(dir, />Open in Document</);
});

test("a Files listing that arrives while a path is typed keeps the text and caret", () => {
  const renderStart = source.indexOf("      function renderFilesView() {"), renderEnd = source.indexOf("      async function loadFileBrowserDirectory(", renderStart);
  assert(renderStart > 0 && renderEnd > renderStart, "render block");
  const input = () => ({ value: "", selectionStart: 0, selectionEnd: 0, focused: false,
    focus() { c.document.activeElement = this; }, setSelectionRange(a, b) { this.selectionStart = a; this.selectionEnd = b; } });
  let current = input(); current.value = "/notes/la"; current.selectionStart = current.selectionEnd = 9;
  const c = { document: {}, fileBrowserState: { contextKey: "k", loaded: true, loading: false },
    critiqueViewEl: { classList: { remove() {} }, querySelector: () => current, set innerHTML(html) { current = input(); } },
    getFileBrowserContextKey: () => "k", finishPreviewRender() {}, buildFileBrowserPanelHtml: () => "", loadFileBrowserDirectory() {}, scheduleResponsePaneRepaintNudge() {} };
  c.document.activeElement = current;
  vm.createContext(c); vm.runInContext(source.slice(renderStart, renderEnd), c); c.renderFilesView();
  assert.equal(current.value, "/notes/la"); assert.equal(c.document.activeElement, current); assert.equal(current.selectionStart, 9);
  // The async listing redraws too; every redraw must go through the preserving helper.
  assert.equal(source.split("critiqueViewEl.innerHTML = buildFileBrowserPanelHtml()").length - 1, 1);
  assert.equal(source.split("paintFileBrowserPanel();").length - 1, 4);
});

test("PDFs and images can't be picked as text; a copy also refuses office files, and the pick stays open", async () => {
  const open = harness(); open.startStudioFilePick("open");
  for (const path of ["/notes/slides.pdf", "/notes/fig.png"]) assert.equal(await open.completeStudioFilePick(path), false);
  assert.equal(vm.runInContext("Boolean(studioFilePick)", open), true, "still choosing"); assert.equal(open.calls.some(x => x[0] === "open"), false);
  assert.match(open.calls.findLast(x => x[0] === "status")[1], /can't be opened as text/);
  assert.equal(await open.completeStudioFilePick("/notes/brief.docx"), true, "opening converts office files");
  const copy = harness(); copy.startStudioFilePick("copy");
  assert.equal(await copy.completeStudioFilePick("/notes/brief.docx"), false); assert.ok(copy.activeFileImport, "import still pinned");
  assert.equal(await copy.completeStudioFilePick("/notes/brief.md"), true);
});

test("a row's known kind wins, and a pasted path keeps # and ? as part of its name", async () => {
  const copy = harness(); copy.startStudioFilePick("copy");
  assert.equal(await copy.completeStudioFilePick("/notes/figure#1.md", "image"), false, "the listing said image");
  assert.equal(await copy.completeStudioFilePick("/notes/fig#1.png"), false, "pasted: classified as fig_1.png, an image");
  assert.equal(await copy.completeStudioFilePick("/notes/a?b.md"), true);
});

test("Open a copy… can't start during a Run", () => {
  const c = harness({ uiBusy: true }); assert.equal(c.startStudioFilePick("copy"), false);
  assert.equal(c.activeFileImport, null); assert.match(c.calls.find(x => x[0] === "status")[1], /Wait for the current action/);
});

function slice(name, next) {
  const a = source.indexOf("      " + name), b = source.indexOf("      " + next, a + 10);
  assert(a > 0 && b > a, name); return source.slice(a, b);
}

test("one replacement rule for Open file and Open a copy: any Prompt text, a Document's unsaved edits", () => {
  const c = {}; vm.createContext(c);
  vm.runInContext(slice("function studioBufferReplacementNeedsConsent(", "function syncBufferRecoveryMenuAccess("), c);
  const ask = b => c.studioBufferReplacementNeedsConsent(b), file = { path: "/n.md" };
  assert.equal(ask({ role: "prompt", text: "hi", baselineText: "hi", sourceState: file }), true, "clean file-backed Prompt (Sol)");
  assert.equal(ask({ role: "prompt", text: "", baselineText: null, sourceState: {} }), false);
  assert.equal(ask({ role: "document", text: "hi", baselineText: "hi", sourceState: file }), false, "clean file Document");
  assert.equal(ask({ role: "document", text: "hi!", baselineText: "hi", sourceState: file }), true);
  assert.equal(ask({ role: "document", text: "hi", baselineText: null, sourceState: file }), true, "unknown baseline");
  assert.equal(ask({ role: "document", text: "x", baselineText: null, sourceState: {} }), true);
  assert.match(source, /const needsConfirmation = studioBufferReplacementNeedsConsent\(target\);/);
});

test("a Run that starts while a copy loads stops it before any text changes", async () => {
  const calls = [];
  const c = { uiBusy: false, studioBusyEpoch: 0, bufferRecoveryEnabled: true, documentHostingEnabled: false, activeFileImport: null,
    fileImportIsCurrent: () => true, finishFileImport: () => calls.push("finish"), getStudioSelectedBuffer: () => ({ role: "prompt", text: "", sourceState: {} }),
    studioBufferReplacementNeedsConsent: () => false, requestStudioConfirmation: async () => true, basenameForStudioPath: p => p,
    setStatus: m => calls.push(m), applyImportedFileCopy: () => calls.push("applied"),
    fetchStudioJson: async () => { c.uiBusy = true; return { text: "copied", filename: "a.md" }; } };
  vm.createContext(c); vm.runInContext(slice("async function importStudioFileCopyFromPath(", "if (importFileBtn)"), c);
  assert.equal(await c.importStudioFileCopyFromPath({}, "/a.md"), false);
  assert.equal(calls.includes("applied"), false); assert.ok(calls.some(m => /busy, so the copy was stopped/.test(m)));
  c.uiBusy = true; calls.length = 0;
  assert.equal(await c.importStudioFileCopyFromPath({}, "/a.md"), false, "busy at the start");
  assert.equal(calls.includes("applied"), false);
});

test("a Run that starts and settles while a copy loads still stops it", async () => {
  const calls = [];
  const c = { uiBusy: false, studioBusyEpoch: 4, bufferRecoveryEnabled: true, documentHostingEnabled: false, activeFileImport: null,
    fileImportIsCurrent: () => true, finishFileImport: () => {}, getStudioSelectedBuffer: () => ({ role: "prompt", text: "", sourceState: {} }),
    studioBufferReplacementNeedsConsent: () => false, requestStudioConfirmation: async () => true, basenameForStudioPath: p => p,
    setStatus: m => calls.push(m), applyImportedFileCopy: () => calls.push("applied"),
    fetchStudioJson: async () => { c.studioBusyEpoch += 1; return { text: "copied", filename: "a.md" }; } }; // busy began and ended
  vm.createContext(c); vm.runInContext(slice("async function importStudioFileCopyFromPath(", "if (importFileBtn)"), c);
  assert.equal(await c.importStudioFileCopyFromPath({ busyEpoch: 4 }, "/a.md"), false);
  assert.equal(calls.includes("applied"), false); assert.ok(calls.some(m => /busy, so the copy was stopped/.test(m)));
  assert.match(source, /pick\.operation = bufferRecoveryEnabled \? \{ consent: captureEditorAsyncConsent\(\), reader: null, decision: null, busyEpoch: studioBusyEpoch \}/);
});

test("busy work starting cancels an open pick; only a start counts", () => {
  const calls = [], c = { uiBusy: false, studioBusyEpoch: 0, studioFilePick: { mode: "copy" },
    cancelStudioFilePick: o => { calls.push(["cancel", o]); c.studioFilePick = null; }, setStatus: m => calls.push(["status", m]),
    syncFooterSpinnerState() {}, renderStatus() {}, syncActionButtons() {}, documentHostingEnabled: false };
  vm.createContext(c); vm.runInContext(slice("function setBusy(", "function setSourceState("), c);
  c.setBusy(true); assert.equal(c.studioBusyEpoch, 1); assert.equal(JSON.stringify(calls[0]), JSON.stringify(["cancel", { silent: true }]));
  c.setBusy(true); assert.equal(c.studioBusyEpoch, 1, "staying busy isn't a new start");
  c.setBusy(false); c.setBusy(true); assert.equal(c.studioBusyEpoch, 2);
});

test("listed and pasted names keep #, ? and % when they reach link-based open routes", async () => {
  const c = harness(); c.startStudioFilePick("open");
  assert.equal(await c.completeStudioFilePick("/notes/notes#draft 50%?.md"), true);
  assert.deepEqual(c.calls.find(x => x[0] === "open").slice(0, 2), ["open", "/notes/notes%23draft 50%25%3F.md"]);
  assert.equal(c.studioLiteralPathToLinkRef("/plain/notes.md"), "/plain/notes.md", "ordinary names are unchanged");
  assert.match(source, /const ref = resource\.path\.replace\(\/\[%#\?\]\/g, ch => encodeURIComponent\(ch\)\);\s*return documentOpenController\.open\(\{ bufferId, path: ref,/, "the hosted open step keeps the canonical name whole");
  assert.match(source, /if \(action === "edit" && bufferSwitchingEnabled\) \{\s*await openStudioBufferDocument\(ref,/);
  assert.match(source, /await openPreviewDocumentInNewEditor\(path,/, "classic routes are unchanged");
});

test("the reader's follow-on routes keep #, ? and % in a canonical name; identity checks stay literal", () => {
  assert.match(source, /operation: "owner", path: studioLiteralPathToLinkRef\(page\.path\), sourcePath: page\.path,/);
  assert.match(source, /reuseHostedDocumentOwner\(studioLiteralPathToLinkRef\(page\.path\), context,/);
  assert.match(source, /return openPreviewDocumentHere\(studioLiteralPathToLinkRef\(page\.path\), context\);/);
  assert.match(source, /entry\.sourceState\.path === page\.path/, "local identity comparison stays literal");
  const ui = readFileSync(new URL("../shared/studio-linked-reader-ui.js", import.meta.url), "utf8");
  assert.match(ui, /return read\(String\(page\.path\)\.replace\(\/\[%#\?\]\/g, ch => encodeURIComponent\(ch\)\), context\(\), \{ refresh: true \}\);/);
});

test("File → New replaces the buffer you're in with an empty Untitled one, asking first if it holds work", async () => {
  const a = source.indexOf("      async function startNewStudioBuffer()"), b = source.indexOf("      function normalizeStudioPaneLayout(", a);
  assert(a > 0 && b > a, "New block");
  const run = async ({ needsConsent, agreed = true, changed = false, role = "document", captureOk = true, busyDuringAsk = null }) => {
    const calls = []; let generation = 0;
    const client = { capture: () => (captureOk ? { ok: true } : { ok: false, message: "Recovery can't store this text." }),
      snapshot: () => ({ selectedBufferId: role, buffers: [{ id: role, role }] }) };
    const c = { bufferSwitchingEnabled: true, bufferRecoveryClient: client, uiBusy: false, studioBusyEpoch: 0, studioModalBlocksDraftAction: () => false,
      buildWorkspacePersistencePayload: () => ({}), fileBackedBaselineText: null, bufferRecoveryExtra: () => ({}),
      studioBufferReplacementNeedsConsent: () => needsConsent,
      captureEditorAsyncConsent: () => ({ generation }), editorAsyncConsentIsCurrent: consent => consent.generation === generation,
      requestStudioConfirmation: async (message, options) => {
        calls.push(["ask", options.title]); if (changed) generation++;
        if (busyDuringAsk === "still") c.uiBusy = true; if (busyDuringAsk === "aba") c.studioBusyEpoch++;
        return agreed; },
      runStudioEditorSourceMutation: (apply, current) => (current() ? apply() : false),
      setEditorText: text => calls.push(["text", text]), setSourceState: state => calls.push(["source", state.source, state.path]),
      setEditorLanguage: lang => calls.push(["lang", lang]), setStatus: (m, k) => calls.push(["status", m, k]), makeStudioDraftId: () => "draft-1" };
    vm.createContext(c); vm.runInContext(source.slice(a, b), c); await c.startNewStudioBuffer(); return calls;
  };
  const erased = calls => calls.some(x => x[0] === "text");
  assert.deepEqual(JSON.parse(JSON.stringify(await run({ needsConsent: false }))), [["text", ""], ["source", "blank", null], ["lang", "markdown"], ["status", "New Document.", "success"]]);
  const asked = await run({ needsConsent: true, role: "prompt" });
  assert.equal(asked[0][1], "New Prompt?"); assert.ok(erased(asked));
  assert.equal(erased(await run({ needsConsent: true, agreed: false })), false, "cancel keeps the text");
  assert.equal(erased(await run({ needsConsent: true, changed: true })), false, "a change while asking keeps the text");
  // Sol: visible text that recovery can't store is never erased unasked.
  const oversized = await run({ needsConsent: false, captureOk: false });
  assert.equal(erased(oversized), false); assert.match(oversized.at(-1)[1], /can't store/);
  // Sol: busy work starting while asking stops New, whether it is still running or already done.
  for (const busyDuringAsk of ["still", "aba"]) {
    const calls = await run({ needsConsent: true, busyDuringAsk });
    assert.equal(erased(calls), false, busyDuringAsk); assert.match(calls.at(-1)[1], /busy/);
  }
});


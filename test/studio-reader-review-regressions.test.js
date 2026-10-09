import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
function fn(name, optional = false) {
  const markers = ["      function " + name + "(", "      async function " + name + "("];
  const start = markers.map(m => source.indexOf(m)).find(i => i >= 0);
  if (start === undefined) { if (optional) return ""; throw Error("Missing function " + name); }
  const ends = [source.indexOf("\n      function ", start + 8), source.indexOf("\n      async function ", start + 8)].filter(i => i >= 0);
  return source.slice(start, Math.min(...ends));
}
function load(c, names) { vm.createContext(c); vm.runInContext(names.map(n => fn(n, n.startsWith("readerReturn") || n.startsWith("applyStudioReader") || n.startsWith("clearStudioReader") || n.startsWith("refuseStudioReader"))).join("\n"), c); }
function returnHarness(selected = 1) {
  const frames = [], buffer = { id: "prompt", role: "prompt" };
  const pane = { scrollTop: 0, scrollLeft: 0, isConnected: true, classList: { add() {}, remove() {} }, querySelectorAll: () => [] };
  const c = { responseHistory: [{ id: "A" }, { id: "B" }], responseHistoryIndex: selected,
    rightView: "preview", pendingResponseScrollReset: false, responsePreviewRenderNonce: 7,
    studioReaderReturnEpoch: 0, pendingStudioReaderReturnScroll: null,
    studioLinkedReaderRenderNonce: 0, studioLinkedReaderUi: { close() {} }, bufferPageClosed: false, studioRightViewGeneration: 0,
    bufferSwitchingEnabled: true, bufferTransientStates: new Map(), critiqueViewEl: pane,
    studioPreviewElementOwners: new WeakMap(), fileBrowserLoadNonce: 0, fileBrowserState: {},
    window: { requestAnimationFrame: cb => frames.push(cb) },
    getStudioSelectedBuffer: () => buffer,
    bufferRecoveryClient: { snapshot: () => ({ buffers: [buffer], selectedBufferId: buffer.id }) },
    isStudioDocumentBufferView: () => false, studioLinkedReaderIsActive: () => false,
    captureEditorAsyncConsent: () => ({}), editorAsyncConsentIsCurrent: () => true,
    replaceResponsePaneWithClone: () => pane, pauseStudioRunFollowing() {}, updateHistoryControls() {},
    syncTraceForSelectedHistoryItem() {}, setStatus() {}, getFileBrowserContextKey: () => "files-context",
  };
  c.getSelectedHistoryItem = () => c.responseHistory[c.responseHistoryIndex];
  c.studioPreviewOwnerIsCurrent = owner => owner?.nonce === c.responsePreviewRenderNonce && owner.response === c.getSelectedHistoryItem();
  c.applySelectedHistoryItem = options => { if (options.resetScroll) c.pendingResponseScrollReset = true; c.responsePreviewRenderNonce++; return true; };
  c.setRightView = view => { c.rightView = view; c.responsePreviewRenderNonce++; };
  load(c, ["clearStudioReaderReturnScroll", "readerReturnScrollIsCurrent", "applyStudioReaderReturnScroll", "closeStudioLinkedReader", "restoreStudioLinkedReaderOrigin", "selectHistoryIndex", "applyPendingResponseScrollReset"]);
  const commit = () => { c.studioPreviewElementOwners.set(pane, { pane: "response", view: c.rightView, nonce: c.responsePreviewRenderNonce, response: c.getSelectedHistoryItem() }); return c.applyPendingResponseScrollReset(); };
  const flush = () => { let count = 0; while (frames.length) { assert(count++ < 30); frames.shift()(); } };
  return { c, buffer, pane, commit, flush };
}
const responseOrigin = { kind: "response", bufferId: "prompt", responseId: "A", top: 600, left: 3 };

test("response-origin return consumes saved offsets after the returning render, not before its deferred reset", () => {
  const h = returnHarness(); h.c.bufferTransientStates.set("prompt", { responseScrollPending: true });
  h.c.restoreStudioLinkedReaderOrigin(responseOrigin); h.flush(); // render still held
  h.commit(); h.flush();
  assert.equal(h.c.getSelectedHistoryItem().id, "A"); assert.equal(h.pane.scrollTop, 600); assert.equal(h.pane.scrollLeft, 3);
  assert.equal(h.c.pendingResponseScrollReset, false); assert.equal(h.c.bufferTransientStates.get("prompt").responseScrollPending, false);
});

test("superseding response navigation fences the queued return frame", () => {
  const h = returnHarness(); h.c.restoreStudioLinkedReaderOrigin(responseOrigin); h.commit();
  h.c.selectHistoryIndex(1, { silent: true }); h.pane.scrollTop = 120; h.pane.scrollLeft = 9;
  h.flush(); assert.equal(h.pane.scrollTop, 120); assert.equal(h.pane.scrollLeft, 9);
});

test("a return frame cannot write to another buffer", () => {
  const h = returnHarness(); h.c.restoreStudioLinkedReaderOrigin(responseOrigin); h.commit();
  h.buffer.id = "other-prompt"; h.pane.scrollTop = 120; h.flush(); assert.equal(h.pane.scrollTop, 120);
});

test("unchanged-response return still restores its position", () => {
  const h = returnHarness(0); h.c.restoreStudioLinkedReaderOrigin(responseOrigin); h.commit(); h.flush();
  assert.equal(h.pane.scrollTop, 600);
});

test("synchronous structured/raw commits cannot schedule a later reset over a reader return", () => {
  const h = returnHarness();
  h.c.applySelectedHistoryItem = options => { if (options.resetScroll) h.c.pendingResponseScrollReset = true; h.c.responsePreviewRenderNonce++; h.commit(); return true; };
  h.c.setRightView = view => { h.c.rightView = view; h.c.responsePreviewRenderNonce++; h.commit(); };
  h.c.restoreStudioLinkedReaderOrigin(responseOrigin); h.flush();
  assert.equal(h.pane.scrollTop, 600); assert.equal(h.c.pendingResponseScrollReset, false);
});

test("a held returning render cannot restore A into a later response B", () => {
  const h = returnHarness(); h.c.restoreStudioLinkedReaderOrigin(responseOrigin);
  h.c.selectHistoryIndex(1, { silent: true }); h.commit(); h.flush();
  h.pane.scrollTop = 120; h.flush(); assert.equal(h.pane.scrollTop, 120);
  assert.equal(h.c.pendingStudioReaderReturnScroll, null);
});

test("ordinary response selection retains the normal zero-scroll policy", () => {
  const h = returnHarness(0); h.pane.scrollTop = 600; h.c.selectHistoryIndex(1, { silent: true }); h.commit(); h.flush();
  assert.equal(h.pane.scrollTop, 0);
});

test("Files return frames are retired by another folder load in the same view", () => {
  const h = returnHarness(); h.c.restoreStudioLinkedReaderOrigin({ kind: "files", files: { currentDir: "/a" }, top: 600, left: 3 });
  h.c.fileBrowserLoadNonce++; h.pane.scrollTop = 120; h.flush(); assert.equal(h.pane.scrollTop, 120);
});

function exportHarness(active = true) {
  const element = () => ({ hidden: false, disabled: false, classList: { remove() {}, toggle() {} }, setAttribute() {} });
  const c = { rightView: "preview", sourceTextEl: { value: "Edited Prompt" }, latestResponseHasContent: true,
    latestResponseNormalized: "hidden response", latestResponseMarkdown: "# Hidden response", latestResponseIsStructuredCritique: false,
    uiBusy: false, bufferSwitchingEnabled: true, documentHostingEnabled: false, editorView: "markdown", paneFocusTarget: "off",
    previewExportInProgress: false, sideQuestionMarkdownExportRequest: null, followLatest: false, queuedLatestResponse: null,
    stripAnnotationsBtn: null, studioLinkedReaderUi: { sync() {} }, rightViewSelect: { value: "" },
    studioLinkedReaderIsActive: () => active, normalizeForCompare: x => x, prepareEditorTextForPreview: x => x,
    isStudioDocumentBufferView: () => false, getRightPaneHtmlArtifactSource: () => "",
    syncStudioResponseActionLayout() {}, updateSyncBadge() {}, syncStudioQuartoDirtyUi() {}, syncShowMeButton() {}, syncAskAsideButton() {},
    updateAnnotatedReplyHeaderButton() {}, syncStudioUiRefreshSummaries() {}, warnings: [], attempts: 0,
  };
  for (const name of ["exportPreviewControlsEl", "exportPdfBtn", "exportPreviewPdfBtn", "exportPreviewHtmlBtn", "exportPreviewPdfStudioBtn", "exportPreviewHtmlStudioBtn", "responseWrapEl", "loadResponseBtn", "annotateResponseBtn", "loadCritiqueNotesBtn", "loadCritiqueFullBtn", "copyResponseBtn", "exportSideThreadMarkdownSaveBtn", "exportSideThreadMarkdownCopyBtn", "exportSideThreadMarkdownEditorBtn", "exportSideThreadRenderSeparatorEl", "pullLatestBtn"]) c[name] = element();
  c.closeExportPreviewMenu = () => { c.closed = true; };
  c.setStatus = message => c.warnings.push(message);
  c.getToken = () => { c.attempts++; return ""; };
  load(c, ["refuseStudioReaderExport", "updateResultActionButtons", "runEditorMetaUpdateNow", "syncStudioLinkedReaderChrome", "exportRightPanePdf", "exportRightPaneHtml"]);
  return c;
}

test("left-editor metadata updates cannot re-expose enabled export controls over a reader", () => {
  const c = exportHarness(); c.syncStudioLinkedReaderChrome(); c.runEditorMetaUpdateNow();
  assert.equal(c.exportPreviewControlsEl.hidden, true); assert.equal(c.exportPdfBtn.disabled, true);
  assert.equal(c.exportPreviewHtmlBtn.disabled, true); assert.equal(c.closed, true);
});

test("direct PDF and HTML entry points refuse the hidden underlying export while reading", async () => {
  const c = exportHarness(); await c.exportRightPanePdf(); await c.exportRightPaneHtml();
  assert.equal(c.attempts, 0); assert.match(c.warnings.join("\n"), /Return/);
});

test("export dispatch refuses all destinations and side Markdown actions while reading", () => {
  const c = exportHarness(); c.rightView = "side-questions";
  for (const name of ["exportRightPanePdf", "exportRightPaneHtml", "saveSideQuestionTranscriptMarkdown", "copySideQuestionTranscriptMarkdown", "openSideQuestionTranscriptInEditor"]) c[name] = () => { c.attempts++; };
  vm.runInContext(fn("exportRightPaneFormat"), c);
  for (const format of ["pdf", "pdf-studio", "html", "html-studio", "side-markdown-save", "side-markdown-copy", "side-markdown-editor"]) c.exportRightPaneFormat(format);
  assert.equal(c.attempts, 0);
});

test("a nonempty ordinary response remains exportable after leaving the reader", () => {
  const c = exportHarness(false); c.runEditorMetaUpdateNow();
  assert.equal(c.exportPreviewControlsEl.hidden, false); assert.equal(c.exportPdfBtn.disabled, false);
});

test("hosted ordinary response exposes the registered HTML bridge without hiding PDF/browser HTML", () => {
  const c = exportHarness(false); c.documentHostingEnabled = true; c.runEditorMetaUpdateNow();
  assert.equal(c.exportPreviewPdfStudioBtn.disabled, false); assert.equal(c.exportPreviewHtmlBtn.disabled, false);
  assert.equal(c.exportPreviewHtmlStudioBtn.disabled, false); assert.equal(c.exportPreviewHtmlStudioBtn.textContent, "Export HTML and open in Document"); assert.match(c.exportPreviewHtmlStudioBtn.title, /open it as a Document/);
  assert.equal(c.exportPreviewPdfStudioBtn.textContent, "Export PDF and open in browser");
});

test("editor-origin labels name the current role preview rather than its file", () => {
  const c = { sourceState: { path: "/notes/PROMPT.md" }, responseHistory: [{ id: "A" }, { id: "B" }],
    isEditorOnlyMode: false, isStudioDocumentBufferView: () => false, getRightViewDisplayLabel: x => x,
    basenameForStudioPath: path => path.split("/").pop(),
    getStudioSelectedBuffer: () => ({ id: "prompt", role: "prompt" }) };
  load(c, ["studioLinkedReaderOriginLabel"]);
  assert.equal(c.studioLinkedReaderOriginLabel({ kind: "editor" }), "Prompt preview");
  c.isStudioDocumentBufferView = () => true;
  assert.equal(c.studioLinkedReaderOriginLabel({ kind: "editor" }), "Document preview");
});

test("response-origin labels disclose switching the left pane back to Prompt", () => {
  const prompt = { id: "prompt", role: "prompt" }, doc = { id: "doc", role: "document" };
  const c = { responseHistory: [{ id: "A" }, { id: "B" }], getStudioSelectedBuffer: () => doc,
    bufferRecoveryClient: { snapshot: () => ({ buffers: [prompt, doc], selectedBufferId: "doc" }) } };
  load(c, ["studioLinkedReaderOriginLabel"]);
  assert.equal(c.studioLinkedReaderOriginLabel(responseOrigin), "Prompt · response 1/2");
  c.getStudioSelectedBuffer = () => prompt;
  assert.equal(c.studioLinkedReaderOriginLabel(responseOrigin), "response 1/2");
});

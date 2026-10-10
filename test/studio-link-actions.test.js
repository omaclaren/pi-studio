import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../client/studio.css", import.meta.url), "utf8");
const bufferClient = readFileSync(new URL("../shared/studio-buffer-client.js", import.meta.url), "utf8");
function declaration(name) {
  const start = source.search(new RegExp("\\n      (?:async )?function " + name + "\\("));
  assert(start >= 0, name);
  const end = source.indexOf("\n      }\n", start);
  return source.slice(start, end + 9);
}

// Oliver, 10 Oct: the link menu in a rendered page has the same few actions as Files, and no
// second window.
function menuHarness({ workspace = true, kind = "text" } = {}) {
  const items = [], menu = { set innerHTML(_) { items.length = 0; }, appendChild: b => items.push(b), querySelector: () => null };
  const c = { bufferSwitchingEnabled: workspace, studioUiRefreshUi: workspace ? {} : null, documentHostingEnabled: true, isWatchedFilePreview: false,
    previewLinkMenuRequestId: 0, activePreviewLinkContext: null,
    document: { createElement: () => ({ dataset: {}, setAttribute() {} }) }, window: { setTimeout() {} },
    buildStudioPreviewInteractionContext: () => ({ isCurrent: () => true }), isStudioLocalPreviewHref: () => true,
    studioPreviewInteractionIsCurrent: () => true, getPreviewLocalLinkKind: () => kind, getEffectivePreviewLinkContext: () => ({ sourcePath: "/n/a.md", resourceDir: "/n" }),
    fetchPreviewLocalLink: async () => ({}), ensurePreviewLinkMenu: () => menu, positionPreviewLinkMenu() {}, closePreviewLinkMenu() {},
    studioLinkedReaderAvailable: () => true, setStatus() {} };
  vm.createContext(c);
  vm.runInContext(declaration("appendPreviewLinkMenuButton") + declaration("showPreviewLinkMenu"), c);
  return { c, labels: () => items.map(b => b.textContent), actions: () => items.map(b => b.dataset.previewLinkAction) };
}

test("a text link's menu in the new layout: Read, Open in Document, Open in Prompt, Show in folder, Copy path", async () => {
  const h = menuHarness();
  assert.equal(await h.c.showPreviewLinkMenu({ getAttribute: () => "notes.md", textContent: "notes" }, {}), true);
  assert.deepEqual(h.labels(), ["Read", "Open in Document", "Open in Prompt", "Show in folder", "Copy path"]);
  assert.deepEqual(h.actions(), ["read-here", "open-here", "open-prompt", "reveal", "copy-path"]);
});

test("an office link's menu in the new layout opens in either buffer and nothing else", async () => {
  const h = menuHarness({ kind: "office" });
  await h.c.showPreviewLinkMenu({ getAttribute: () => "a.docx", textContent: "a" }, {});
  assert.deepEqual(h.labels(), ["Open in Document", "Open in Prompt", "Show in folder", "Copy path"]);
});

test("the classic link menu is unchanged", async () => {
  const h = menuHarness({ workspace: false });
  await h.c.showPreviewLinkMenu({ getAttribute: () => "notes.md", textContent: "notes" }, {});
  assert.deepEqual(h.labels(), ["Read here", "Preview file (follow changes)", "Open file tab", "Open here", "Reveal in file manager", "Copy path"]);
});

test("Open in Prompt from a link opens it as the Prompt", async () => {
  const calls = [];
  const c = { bufferSwitchingEnabled: true, studioPreviewInteractionIsCurrent: () => true, setStatus() {},
    openStudioBufferDocument: async (...args) => { calls.push(args); return true; } };
  vm.createContext(c); vm.runInContext(declaration("runPreviewLinkAction"), c);
  const context = { href: "../notes.md", isCurrent: () => true };
  await c.runPreviewLinkAction("open-prompt", context);
  assert.deepEqual(calls, [["../notes.md", context, "prompt"]]);
});

test("a web link in rendered text opens a new tab without a referrer; other links are left alone", () => {
  class Element { constructor(href, inRendered = true) { this.href = href; this.inRendered = inRendered; this.target = ""; this.rel = ""; }
    getAttribute() { return this.href; } closest(selector) { return this.inRendered && /#critiqueView a\[href\]/.test(selector) ? this : null; } }
  const c = { Element }; vm.createContext(c); vm.runInContext(declaration("openRenderedWebLinkInNewTab"), c);
  for (const href of ["https://example.org/x", "http://a.b", "//example.org/protocol-relative", " HTTPS://EXAMPLE.ORG "]) {
    const a = new Element(href); assert.equal(c.openRenderedWebLinkInNewTab({ target: a }), true, href);
    assert.equal(a.target, "_blank"); assert.equal(a.rel, "noopener noreferrer");
  }
  for (const a of [new Element("notes.md"), new Element("#section"), new Element("mailto:o@example.org"), new Element("/local/path.md"), new Element("https://example.org", false)]) {
    assert.equal(c.openRenderedWebLinkInNewTab({ target: a }), false, a.href); assert.equal(a.target, "");
  }
  assert.match(source, /closePreviewLinkMenu\(\);\n        openRenderedWebLinkInNewTab\(event\);\n        handlePreviewLocalLinkClick\(event\);/);
});

test("Files ⋯ and the filename menu have no Follow changes or new-window items", () => {
  const files = source.slice(source.indexOf("function buildStudioFilesRowHtml("), source.indexOf("function buildFileBrowserEntryRowHtml("));
  assert.doesNotMatch(files, /attrs\("(?:watch-new|open-new)"|>Open in new window<|>Follow changes</);
  assert.doesNotMatch(declaration("setupStudioFileNameMenu"), /item\("Follow changes"|openPreviewDocumentInWatchedPreview/);
});

// Oliver, 10 Oct: teal means Run Prompt only; Send to REPL says what it sends.
function replHarness({ start = 0, end = 0, mode = "raw", workspace = true, hidden = false } = {}) {
  const c = { sourceTextEl: { selectionStart: start, selectionEnd: end }, replSendMode: mode, bufferSwitchingEnabled: workspace,
    studioUiRefreshUi: workspace ? {} : null, sendReplBtn: { hidden, textContent: "Send to REPL" }, getStudioShortcutLabel: () => "⌃⇧↵" };
  vm.createContext(c); vm.runInContext(declaration("withStudioShortcutLabel") + declaration("studioReplSendLabel") + declaration("syncStudioReplSendLabel"), c);
  return c;
}

test("Send to REPL names what it sends", () => {
  assert.equal(replHarness({ start: 2, end: 9 }).studioReplSendLabel(), "Send selection to REPL ⌃⇧↵");
  assert.equal(replHarness().studioReplSendLabel(), "Send all to REPL ⌃⇧↵");
  assert.equal(replHarness({ mode: "literate" }).studioReplSendLabel(), "Send code to REPL ⌃⇧↵");
  assert.equal(replHarness({ mode: "literate", start: 1, end: 4 }).studioReplSendLabel(), "Send selection to REPL ⌃⇧↵");
});

test("the label follows the selection only in the new layout, and only while shown", () => {
  const c = replHarness({ start: 2, end: 9 }); c.syncStudioReplSendLabel(); assert.equal(c.sendReplBtn.textContent, "Send selection to REPL ⌃⇧↵");
  c.sourceTextEl.selectionEnd = 2; c.syncStudioReplSendLabel(); assert.equal(c.sendReplBtn.textContent, "Send all to REPL ⌃⇧↵");
  for (const settings of [{ workspace: false }, { hidden: true }]) {
    const other = replHarness({ start: 2, end: 9, ...settings }); other.syncStudioReplSendLabel(); assert.equal(other.sendReplBtn.textContent, "Send to REPL");
  }
  assert.match(source, /syncStudioSelectionAppendAction\(\); \/\/ Observation alone cannot reclaim source ownership\.\n          syncStudioReplSendLabel\(\);/);
});

test("in the new layout the REPL never takes the accent from Run Prompt; classic keeps its swap", () => {
  const sync = declaration("syncRunAndCritiqueButtons");
  assert.match(sync, /const workspaceLayout = bufferSwitchingEnabled && Boolean\(studioUiRefreshUi\);/);
  assert.match(sync, /sendRunBtn\.classList\.toggle\("repl-secondary-action", rightView === "repl" && !directIsStop && !workspaceLayout\)/);
  assert.match(sync, /sendReplBtn\.classList\.toggle\("repl-primary-action", showReplSend && !workspaceLayout\)/);
  assert.match(css, /body\.studio-workspace-layout #sendReplBtn,\n    body\.studio-workspace-layout \.repl-quick-actions button \{[^}]*border-color: transparent;[^}]*background: transparent;/);
  assert.match(css, /body\.studio-workspace-layout \.repl-quick-composer textarea:focus-visible \{[^}]*outline: none;/);
});

test("the connection notice says it once", () => {
  assert.match(bufferClient, /"Connection closed\. New edits aren't being checkpointed to the server\."/);
  assert.match(declaration("renderStatus"), /"Recovery: " \+ bufferRecoveryIssue \+ \(bufferRecoveryKeptClosed \? "" : " Save or copy your text before reloading\. " \+/);
  assert.doesNotMatch(source + bufferClient, /Save\/copy current text before refreshing|Server recovery is paused/);
});

test("Keep closed is a choice, not a failure to start", () => {
  assert.match(source, /bufferRecoveryKeptClosed = true; ws\?\.close\(\);\n\s+throw new Error\("Workspace kept closed\. Retained recovery wasn't discarded\. Reload and choose “Resume here” to reopen it\."\)/);
  assert.match(source, /bufferRecoveryIssue = \(bufferRecoveryKeptClosed \? "" : "Buffer recovery could not initialize\. Existing snapshots were retained\. "\) \+ \(error\.message \|\| ""\)/);
  const c = { bufferRecoveryIssue: "Workspace kept closed. Retained recovery wasn't discarded. Reload and choose “Resume here” to reopen it.", bufferRecoveryKeptClosed: true,
    statusEl: {}, statusLineEl: null, statusSpinnerEl: null, studioOperationNoticesEl: null, statusMessage: "Disconnected (code 1005). Reconnecting in 600ms…", statusLevel: "",
    getStudioPriorityOperationNotice: () => null, shouldAnimateFooterSpinner: () => false, updateFooterMeta() {} };
  vm.createContext(c); vm.runInContext(declaration("renderStatus"), c); c.renderStatus();
  assert.equal(c.statusEl.textContent.trim(), "Recovery: Workspace kept closed. Retained recovery wasn't discarded. Reload and choose “Resume here” to reopen it.");
  c.bufferRecoveryKeptClosed = false; c.statusMessage = ""; c.bufferRecoveryIssue = "Connection closed. New edits aren't being checkpointed to the server."; c.renderStatus();
  assert.equal(c.statusEl.textContent.trim(), "Recovery: Connection closed. New edits aren't being checkpointed to the server. Save or copy your text before reloading.");
});

test("after Keep closed, nothing reconnects: bootstrap, scheduled reconnects and late socket opens are fenced", () => {
  const sockets = [], timers = [], states = [];
  const c = { bufferRecoveryKeptClosed: true, reconnectTimer: null, reconnectAttempt: 0, ws: null,
    WebSocket: class { constructor() { sockets.push(this); } }, window: { setTimeout: (fn, ms) => { timers.push(ms); return 1; }, clearTimeout() {} },
    setWsState: state => states.push(state), setBusy() {}, setStatus() {}, getToken: () => "t" };
  vm.createContext(c);
  vm.runInContext("let reconnectTimer = null, reconnectAttempt = 0, ws = null;" + declaration("clearScheduledReconnect") + declaration("formatReconnectDelay") + declaration("scheduleReconnect") + declaration("connect"), c);
  c.connect(); c.scheduleReconnect("Connection lost.");
  assert.deepEqual(sockets, []); assert.deepEqual(timers, []); assert.deepEqual(states, ["Disconnected", "Disconnected"]);
  assert.match(declaration("connect"), /socket\.addEventListener\("open", \(\) => \{\n\s+if \(ws !== socket \|\| bufferRecoveryKeptClosed\) \{\n\s+try \{ socket\.close\(\); \} catch \{\}/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Actual production constructors/state helpers, using a small DOM/API seam.
// This verifies wiring/ownership, NOT native browser geometry or rendered colour.
const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
function declaration(name) {
  const start = source.indexOf("      function " + name + "(");
  assert(start >= 0, name);
  const open = source.indexOf(") {", start) + 2; assert(open > start);
  let depth = 0, quote = null;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (quote) { if (ch === "\\") i++; else if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "/" && source[i + 1] === "/") { i = source.indexOf("\n", i); continue; }
    if (ch === "/" && source[i + 1] === "*") { i = source.indexOf("*/", i) + 1; continue; }
    if (ch === "{") depth++;
    if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
    // A closing brace alone decrements depth; other characters must not.
    if (ch !== "}") continue;
  }
  throw new Error("Missing function end: " + name);
}
// The scanner above intentionally handles these selected non-regex constructors.
function load(c, ...names) { for (const name of names) vm.runInContext(declaration(name), c); }

function harness({ only = false, watched = false } = {}) {
  const ids = new Map(), events = [], docEvents = {};
  let doc;
  class Node {
    constructor(tag = "div") { this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this.listeners = {}; this.style = {}; this.dataset = {}; this.className = ""; this.hidden = false; this.open = false; this.disabled = false; this.value = ""; this.textContent = ""; }
    set id(value) { this._id = value; ids.set(value, this); } get id() { return this._id; }
    get childNodes() { return this.children; } get nextSibling() { const peers = this.parentElement?.children || []; return peers[peers.indexOf(this) + 1] || null; }
    get classList() { return { add: (...values) => { this.className = [...new Set([...this.className.split(" "), ...values])].filter(Boolean).join(" "); }, contains: value => this.className.split(" ").includes(value), remove: value => { this.className = this.className.split(" ").filter(item => item !== value).join(" "); }, toggle: () => {} }; }
    append(...nodes) { for (const node of nodes) this.appendChild(node); }
    appendChild(node) { node.parentElement?.removeChild(node); this.children.push(node); node.parentElement = this; return node; }
    removeChild(node) { this.children.splice(this.children.indexOf(node), 1); node.parentElement = null; }
    replaceChildren(...nodes) { for (const node of [...this.children]) this.removeChild(node); this.append(...nodes); }
    insertBefore(node, next) { node.parentElement?.removeChild(node); const index = next ? this.children.indexOf(next) : this.children.length; assert(index >= 0); this.children.splice(index, 0, node); node.parentElement = this; }
    replaceWith(node) { const parent = this.parentElement; parent.insertBefore(node, this); parent.removeChild(this); }
    setAttribute(name, value) { this.attrs[name] = String(value); } getAttribute(name) { return this.attrs[name]; }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
    matches(selector) { const plain = selector.split(":")[0]; return (plain.startsWith("#") ? this.id === plain.slice(1) : plain.startsWith(".") ? this.classList.contains(plain.slice(1)) : plain.startsWith("[") ? Boolean(this.attrs[plain.slice(1, -1)] !== undefined || this[plain.slice(1, -1)]) : this.tagName === plain.toUpperCase()) && (!selector.includes(":not(:disabled)") || !this.disabled); }
    closest(selector) { for (let node = this; node; node = node.parentElement) if (selector.split(",").some(s => node.matches(s.trim()))) return node; return null; }
    querySelectorAll(selector) { const found = []; for (const child of this.children) { if (selector.split(",").some(s => child.matches(s.trim()))) found.push(child); found.push(...child.querySelectorAll(selector)); } return found; }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    dispatchEvent(event) { event.target ||= this; for (const fn of this.listeners[event.type] || []) fn(event); return true; }
    fire(type, values = {}) { return this.dispatchEvent({ type, target: this, detail: 0, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...values }); }
    focus() { doc.activeElement = this; }
    getBoundingClientRect() { return { left: 10, right: 610, top: 20, bottom: 70, width: 600, height: 50 }; }
    getClientRects() { return this.closest("[hidden]") ? [] : [this.getBoundingClientRect()]; }
  }
  doc = { body: new Node("body"), createElement: tag => new Node(tag), createElementNS: (_, tag) => new Node(tag), getElementById: id => ids.get(id), activeElement: null,
    addEventListener: (type, fn) => (docEvents[type] ||= []).push(fn), querySelectorAll: selector => doc.body.querySelectorAll(selector) };
  const c = vm.createContext({ document: doc, Element: Node, HTMLElement: Node,
    window: { innerWidth: 1300, innerHeight: 900, addEventListener() {}, setTimeout() {} }, Event: class { constructor(type, values) { this.type = type; Object.assign(this, values); } },
    studioUiRefreshEnabled: true, studioUiRefreshUi: null, bufferSwitcherUi: null, bufferBindingInProgress: false,
    bufferSwitchingEnabled: !only && !watched, isEditorOnlyMode: only, isWatchedFilePreview: watched, documentHostingEnabled: true,
    sourceOriginSummaryEl: null, sourceResetOriginBtn: null, sourceOpenCurrentFileTabBtn: null, sourceOpenCurrentTextCopyTabBtn: null, sourceSessionSummaryEl: null,
    fileBackedBaselineText: "Notes", editorView: "markdown", rightView: "preview", sourceState: { source: "file", path: "/NOTES.md", label: "NOTES.md" },
    basenameForStudioPath: path => path.split("/").at(-1), editorDiffersFromFileBackedBaseline: () => false,
    syncStudioUiRefreshSummaries() {}, syncPromptRunIndicator() {}, getAbortablePendingKind: () => null, syncShowMeButton() {},
    normalizeStudioPaneLayout: value => value, paneSplitPercent: 50, applyPaneSplitPercent() {}, setStatus() {},
    getStudioSelectedBuffer: () => state.buffers.find(b => b.id === state.selectedBufferId), studioModalBlocksDraftAction: () => false,
    studioBuffersCanSwitch: () => true, studioBuffersCanOpenDocument: () => true,
    syncStudioSelectionAppendAction() {}, syncStudioDocumentAppendAction() {}, setupStudioSelectionAppendAction() {}, setupStudioDocumentAppendAction() {},
    promptStudioBufferDocumentPath: async () => {}, scheduleWorkspacePersistence() {}, isStudioDocumentBufferView: () => state.selectedBufferId === "doc",
  });
  const state = { selectedBufferId: "doc", buffers: [
    { id: "prompt", role: "prompt", text: "Prompt", baselineText: "Prompt", sourceState: { path: "/PROMPT.md" } },
    { id: "doc", role: "document", text: "Notes", baselineText: "Notes", sourceState: { path: "/NOTES.md" } },
  ] };
  c.bufferRecoveryClient = { snapshot: () => state };
  for (const match of source.matchAll(/const (\w+) = document\.getElementById\("([^"]+)"\);/g)) {
    const [, name, id] = match;
    const node = new Node(name.endsWith("Btn") ? "button" : name.endsWith("Select") ? "select" : "div"); node.id = id; node.textContent = name; c[name] = node;
  }
  c.editorViewSelect.value = "markdown";
  c.editorViewSelect.addEventListener("change", () => { events.push(["view", state.selectedBufferId, c.editorViewSelect.value]); c.editorView = c.editorViewSelect.value; });
  c.selectStudioBuffer = id => { if (!c.studioBuffersCanSwitch()) return false; if (id !== state.selectedBufferId) { state.selectedBufferId = id; c.syncStudioBufferSwitcher(); } return true; };
  c.responseWrapEl = new Node();
  const row = new Node(); row.className = "response-result-row"; c.responseActionsEl.append(row);
  for (const node of [c.annotateResponseBtn, c.loadResponseBtn, c.loadHistoryPromptBtn, c.copyResponseBtn]) row.append(node);
  const sourceMeta = new Node(); sourceMeta.className = "source-meta";
  const sourceWrap = new Node(); sourceWrap.className = "source-wrap";
  c.leftPaneEl.append(doc.getElementById("leftSectionHeader"), sourceMeta, sourceWrap);
  c.rightPaneEl.append(doc.getElementById("rightSectionHeader"), c.responseActionsEl);
  doc.body.append(c.leftPaneEl, c.rightPaneEl);
  c.critiqueViewEl = new Node(); c.critiqueViewEl.id = "critiqueView";
  vm.runInContext(readFileSync(new URL('../client/studio-editor-draft-helpers.js', import.meta.url), 'utf8'), c);
  c.editorDraftHelpers = c.PiStudioEditorDraftHelpers;
  load(c, "makeStudioUiRefreshElement", "makeStudioUiRefreshSeparator", "makeStudioUiRefreshIcon", "setStudioUiRefreshFocusButtonIcon", "appendStudioUiRefreshMenuSection",
    "closeStudioUiRefreshMenus", "toggleStudioUiRefreshMenu", "placeStudioUiRefreshMenu", "makeStudioUiRefreshMenu", "syncStudioResponseActionLayout", "syncStudioWorkspaceFilename", "setupStudioUiRefreshPrototype",
    "closeStudioBufferActionMenus", "makeStudioBufferActionMenu", "syncStudioBufferSourceActions", "syncStudioBufferSwitcher", "triggerStudioRoleShortcut", "setupStudioFileNameMenu", "syncStudioAddToPromptChoice", "setupStudioBufferSwitcher");
  load(c, "getStudioPaneLayoutLabel", "setStudioPaneLayout");
  const layoutStart = source.indexOf('      if (studioPaneLayoutSelect) {');
  const layoutEnd = source.indexOf('      if (documentPreviewFollowSelect) {', layoutStart);
  vm.runInContext(source.slice(layoutStart, layoutEnd), c); // actual production change handler
  c.setupStudioUiRefreshPrototype(); if (!only && !watched) c.setupStudioBufferSwitcher();
  return { c, doc, state, events, row, docEvents };
}

test("Document window titles are filename-first, preserve authoritative prefixes and session identity, and add no draft marker", () => {
  const f = harness({ only: true });
  Object.assign(f.c, { modelLabel: "Model", terminalSessionLabel: "Session · folder", getDynamicTitlePrefix: () => "Disconnected", faviconLinkEl: null });
  load(f.c, "updateDocumentTitle"); f.c.updateDocumentTitle();
  assert.equal(f.doc.title, "Disconnected · NOTES.md — π Studio · Session · folder · Model");
  f.c.sourceState = { source: "response" }; f.c.updateDocumentTitle();
  assert.equal(f.doc.title, "Disconnected · Draft — π Studio · Session · folder · Model");
});

test("terminal label drops only the visible terminal-brand component, keeping folder and session", () => {
  const index = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
  const start = index.indexOf("function buildTerminalSessionLabel("), end = index.indexOf("function buildTerminalSessionDetail(", start);
  const body = index.slice(start, end).replace("cwd: string, sessionName?: string): string", "cwd, sessionName)").replace("const parts: string[]", "const parts");
  assert.doesNotMatch(body, /TERM_PROGRAM/);
  const c = vm.createContext({ basename: path => path.split("/").at(-1), process: { cwd: () => "/folder", env: { TERM_PROGRAM: "Ghostty" } } });
  vm.runInContext(body, c);
  assert.equal(c.buildTerminalSessionLabel("/repo/folder", "Named session"), "Named session · folder");
  assert.equal(c.buildTerminalSessionLabel("/repo/folder"), "folder");
  assert.match(index.slice(end, end + 500), /TERM_PROGRAM/, "diagnostic/launcher information not removed by a label change");
});

test("actual refreshed constructor relocates original controls into two workspace rows", () => {
  const { c } = harness(); const ui = c.studioUiRefreshUi;
  assert.equal(c.bufferSwitcherUi.prompt.textContent, "Prompt"); assert.equal(c.bufferSwitcherUi.document.textContent, "Document (Raw) ▾");
  assert.equal(c.bufferSwitcherUi.prompt.closest(".studio-workspace-tabs-host"), ui.tabsHost);
  assert.deepEqual(ui.fileControls.children.map(node => node.textContent || node.children[0]?.textContent), ["NOTES.md", "Save", "File"], "Open folds into File (trial48 finding 15)");
  assert.equal(ui.actionLine.children[0], c.sendRunBtn);
  assert.equal(c.bufferSwitcherUi.addMenu.anchor.parentElement, ui.actionLine);
  assert.equal(c.saveAsBtn.closest(".studio-refresh-menu").getAttribute("aria-label"), "File");
  assert.equal(c.clearWorkspaceBtn.hidden, true, "unsupported hosting reset omitted, existing handler retained");
  assert.equal(c.getEditorBtn.closest(".studio-refresh-menu"), ui.menus.find(item => item.name === "context").menu);
  assert.equal(c.sendEditorBtn.closest(".studio-refresh-menu"), ui.menus.find(item => item.name === "context").menu);
  assert.equal(c.suggestCompletionBtn.closest(".studio-refresh-menu"), ui.menus.find(item => item.name === "review").menu);
});

test("File starts with New and Open, then New Document window; labels stay fixed and act on the buffer you're in; Pi draft only in Prompt", () => {
  const f = harness(), menu = f.c.studioUiRefreshUi.menus.find(item => item.name === "context").menu;
  const order = () => menu.children[0].querySelectorAll("button").map(button => button.id);
  const expected = ["studioNewBufferBtn", "studioOpenDocumentBtn", "importFileBtn", "getEditorBtn", "openCompanionBtn"];
  assert.deepEqual(order(), expected);
  for (const role of ["prompt", "doc"]) {
    f.c.selectStudioBuffer(role);
    assert.equal(f.c.importFileBtn.textContent, "Open a copy…"); assert.equal(f.c.bufferSwitcherUi.open.textContent, "Open file…");
    assert.equal(f.c.getEditorBtn.textContent, "Load Pi draft"); assert.equal(f.c.getEditorBtn.hidden, role !== "prompt");
    assert.match(f.c.bufferSwitcherUi.open.title, role === "prompt" ? /in the Prompt/ : /in the Document/);
    assert.deepEqual(order(), expected);
  }
});

test("role hover hints lead with their purpose and retain backing-path and unsaved-file details", () => {
  const f = harness();
  assert.equal(f.c.bufferSwitcherUi.prompt.title, "Draft your next prompt.\nPrompt: /PROMPT.md");
  assert.equal(f.c.bufferSwitcherUi.document.title, "Read and edit a document.\nDocument: /NOTES.md");
  f.state.buffers[1].text += " edit"; f.c.syncStudioBufferSwitcher();
  assert.match(f.c.bufferSwitcherUi.document.title, /\/NOTES\.md · unsaved file edits$/);
  f.state.buffers[1].sourceState = { path: null }; f.c.syncStudioBufferSwitcher();
  assert.equal(f.c.bufferSwitcherUi.document.title, "Read and edit a document.\nDocument: independent draft");
});

test("File folds details, directory and Pi controls while retaining their controls and original labels", () => {
  const f = harness(), menu = f.c.studioUiRefreshUi.menus.find(m => m.name === "context");
  const disclosures = menu.menu.children.filter(n => n.tagName === "DETAILS");
  assert.deepEqual(disclosures.map(n => n.children[0].textContent), ["File details", "Working directory", "Pi editor"]);
  assert(disclosures.every(n => !n.open));
  assert.equal(f.c.sourceResetOriginBtn.closest("details"), disclosures[0]);
  assert.equal(f.c.resourceDirBtn.closest("details"), disclosures[1]);
  assert.equal(f.c.sendEditorBtn.closest("details"), disclosures[2]);
  assert.equal(f.c.sourceSessionSummaryEl.closest("details"), disclosures[2]);
  assert.equal(f.c.sendEditorBtn.textContent, "Send current text to Pi editor");
  assert.equal(f.c.saveAsBtn.closest("details"), null);
  assert.equal(menu.fileActionsSection.contains(f.c.copyDraftBtn), true);
});

test("File arrows skip closed details children even when the browser reports their layout rectangles", () => {
  const f = harness(), menu = f.c.studioUiRefreshUi.menus.find(m => m.name === "context");
  const groups = menu.menu.children.filter(n => n.tagName === "DETAILS");
  menu.button.fire("click");
  groups[0].children[0].focus();
  menu.menu.fire("keydown", { key: "ArrowDown", target: groups[0].children[0] });
  assert.equal(f.doc.activeElement, groups[1].children[0]);
});

test("global Shift+1/2 role shortcuts use selected-role guards and never send or repeat", () => {
  const f = harness();
  const key = (code, extra = {}) => ({ code, metaKey: true, shiftKey: true, preventDefault() {}, stopPropagation() {}, ...extra });
  f.c.triggerStudioRoleShortcut(key("Digit1")); assert.equal(f.state.selectedBufferId, "prompt");
  f.c.triggerStudioRoleShortcut(key("Digit2", { repeat: true })); assert.equal(f.state.selectedBufferId, "prompt");
  f.c.triggerStudioRoleShortcut(key("Digit2", { isComposing: true })); assert.equal(f.state.selectedBufferId, "prompt");
  f.c.studioModalBlocksDraftAction = () => true; f.c.triggerStudioRoleShortcut(key("Digit2")); assert.equal(f.state.selectedBufferId, "prompt");
  f.c.studioModalBlocksDraftAction = () => false; f.c.studioBuffersCanSwitch = () => false; f.c.triggerStudioRoleShortcut(key("Digit2")); assert.equal(f.state.selectedBufferId, "prompt");
  f.c.studioBuffersCanSwitch = () => true; f.c.triggerStudioRoleShortcut(key("Digit2", { metaKey: false, ctrlKey: true })); assert.equal(f.state.selectedBufferId, "doc");
  assert.equal(f.c.triggerStudioRoleShortcut(key("Digit1", { altKey: true })), false);
  assert.equal(f.c.triggerStudioRoleShortcut(key("Digit1", { metaKey: false, ctrlKey: false })), false);
  assert.deepEqual(f.events, []);
  assert.equal(f.c.bufferSwitcherUi.prompt.getAttribute("aria-keyshortcuts"), "Meta+Shift+1 Control+Shift+1");
});

test("workspace Add to Prompt is visible only in Document; hidden handlers retain existing guards", () => {
  const f = harness(), add = f.c.bufferSwitcherUi.addMenu;
  assert.equal(add.anchor.hidden, false);
  f.c.selectStudioBuffer("prompt"); assert.equal(add.anchor.hidden, true);
  assert.equal(add.button.id, "studioBufferAddBtn");
  f.c.selectStudioBuffer("doc"); assert.equal(add.anchor.hidden, false);
  // One click (Oliver, 9 Oct): the real buttons sit in the row; only the applicable one shows.
  const { addSelection, addDocument } = f.c.bufferSwitcherUi;
  assert.equal(add.button.hidden, true); assert.equal(addSelection.parentElement, add.anchor); assert.equal(addDocument.parentElement, add.anchor);
  assert.equal(addSelection.textContent, "Add selection to Prompt"); assert.equal(addDocument.textContent, "Add document to Prompt");
  addSelection.disabled = true; f.c.syncStudioAddToPromptChoice();
  assert.equal(addSelection.hidden, true); assert.equal(addDocument.hidden, false, "no selection: add the document");
  addSelection.disabled = false; f.c.syncStudioAddToPromptChoice();
  assert.equal(addSelection.hidden, false); assert.equal(addDocument.hidden, true, "a selection: add just that");
});

test("preview options follow the selected buffer role without changing routes or permissions", () => {
  const f = harness();
  Object.assign(f.c, { canonicalRightViewValue: value => value, isCurrentStudioQuartoDocument: () => true,
    EDITOR_ONLY_RIGHT_VIEW_ALLOWED: new Set(["editor-preview", "editor-quarto-preview", "files", "changes", "repl", "side-questions"]) });
  f.c.DOCUMENT_RIGHT_VIEW_ALLOWED = new Set([...f.c.EDITOR_ONLY_RIGHT_VIEW_ALLOWED, "markdown", "preview", "trace"]);
  f.c.rightViewSelect.options = ["preview", "editor-preview", "editor-quarto-preview"].map(value => ({ value, textContent: "Editor (Preview)" }));
  load(f.c, "syncRightViewModeOptions", "restrictedStudioRightViews"); f.c.syncRightViewModeOptions();
  assert.equal(f.c.rightViewSelect.options[1].textContent, "Document (Preview)");
  assert.equal(f.c.rightViewSelect.options[2].textContent, "Document (Quarto)");
  assert.equal(f.c.rightViewSelect.options[0].disabled, false, "the Document can choose to show a response (Oliver and Sol, 8 Oct)");
  f.c.isEditorOnlyMode = true; f.c.syncRightViewModeOptions();
  assert.equal(f.c.rightViewSelect.options[0].disabled, true, "editor-only windows still can't"); f.c.isEditorOnlyMode = false;
  f.c.selectStudioBuffer("prompt"); f.c.syncRightViewModeOptions();
  assert.equal(f.c.rightViewSelect.options[1].textContent, "Prompt (Preview)");
  assert.equal(f.c.rightViewSelect.options[0].disabled, false);
  f.c.isWatchedFilePreview = true; f.c.syncRightViewModeOptions();
  assert.equal(f.c.rightViewSelect.options[1].textContent, "Watched preview");
  assert.equal(f.c.rightViewSelect.options[0].disabled, true);
});

test("refreshed source preview omits redundant reference line, restoring response facts on leaving", () => {
  const f = harness(), meta = f.doc.createElement("div"); meta.className = "reference-meta"; meta.appendChild(f.c.referenceBadgeEl);
  Object.assign(f.c, { latestResponseMarkdown: "", latestResponseThinking: "", responseHistory: [], responseHistoryIndex: -1 });
  load(f.c, "updateReferenceBadge"); f.c.rightView = "editor-preview"; f.c.updateReferenceBadge();
  assert.equal(meta.hidden, true); assert.equal(f.c.referenceBadgeEl.textContent, "");
  f.c.rightView = "preview"; f.c.updateReferenceBadge(); assert.equal(meta.hidden, false);
  assert.equal(f.c.referenceBadgeEl.textContent, "Latest response: none");
  f.c.studioUiRefreshUi = null; f.c.rightView = "editor-preview"; f.c.updateReferenceBadge();
  assert.equal(meta.hidden, false); assert.equal(f.c.referenceBadgeEl.textContent, "Previewing: editor text", "classic presentation remains available");
});

test("ordinary action-summary refresh updates the selected filename dirty marker as text changes", () => {
  const { c } = harness(), button = c.studioUiRefreshUi.filenameButton;
  c.studioUiRefreshUi = { filenameButton: button }; c.syncStudioFollowMenu = () => {};
  c.editorDiffersFromFileBackedBaseline = () => c.sourceTextEl.value !== c.fileBackedBaselineText;
  load(c, "syncStudioUiRefreshReviewTrigger", "syncStudioUiRefreshSummaries"); c.sourceTextEl.value = "Notes"; c.syncStudioUiRefreshSummaries();
  assert.equal(button.textContent, "NOTES.md"); c.sourceTextEl.value = "Changed notes"; c.syncStudioUiRefreshSummaries();
  assert.equal(button.textContent, "NOTES.md •"); c.fileBackedBaselineText = "Changed notes"; c.syncStudioUiRefreshSummaries();
  assert.equal(button.textContent, "NOTES.md");
});

test("bottom response disclosures place upward within the pane instead of a zero-height downward menu", () => {
  const { c } = harness(), item = c.studioUiRefreshUi.responseMenu;
  c.rightPaneEl.getBoundingClientRect = () => ({ left: 620, right: 1250, top: 40, bottom: 860 });
  item.anchor.getBoundingClientRect = () => ({ left: 1160, right: 1240, top: 824, bottom: 850 });
  item.menu.scrollHeight = 180; c.placeStudioUiRefreshMenu(item);
  assert.equal(item.menu.style.top, "auto"); assert.equal(item.menu.style.bottom, "calc(100% + 8px)");
  assert.equal(item.menu.style.maxHeight, "440px");
  item.anchor.getBoundingClientRect = () => ({ left: 1160, right: 1240, top: 60, bottom: 86 });
  c.placeStudioUiRefreshMenu(item);
  assert.equal(item.menu.style.top, "calc(100% + 8px)"); assert.equal(item.menu.style.bottom, "auto");
  assert.equal(item.menu.style.maxHeight, "440px");
});

test("menu positioning uses its visible opener instead of a stretched full-row wrapper", () => {
  const { c } = harness(), item = c.studioUiRefreshUi.responseMenu;
  c.rightPaneEl.getBoundingClientRect = () => ({ left: 620, right: 1250, top: 40, bottom: 860 });
  item.anchor.getBoundingClientRect = () => ({ left: 632, right: 1238, top: 320, bottom: 350 });
  item.button.getBoundingClientRect = () => ({ left: 632, right: 752, top: 320, bottom: 350 });
  c.placeStudioUiRefreshMenu(item); assert.equal(item.menu.style.left, "0px");
  item.openedBy = { getBoundingClientRect: () => ({ left: 1190, right: 1240 }) };
  c.placeStudioUiRefreshMenu(item); assert.equal(item.menu.style.left, "250px", "near edge still clamped within pane");
});

test("choosing a layout closes its refreshed menu and returns focus to the visible opener", () => {
  const f = harness(), item = f.c.studioUiRefreshUi.menus.find(m => m.name === "view");
  item.button.fire("click"); assert.equal(item.menu.hidden, false);
  item.button.classList.add("is-open");
  f.c.studioPaneLayoutSelect.focus(); f.c.studioPaneLayoutSelect.value = "editor-top"; f.c.studioPaneLayoutSelect.fire("change");
  assert.equal(item.menu.hidden, true); assert.equal(item.button.classList.contains("is-open"), false); assert.equal(f.doc.activeElement, item.button);
  item.button.fire("click"); f.c.editorFontSizeSelect.fire("change"); assert.equal(item.menu.hidden, false, "ordinary display adjustments may remain open");
});

test("layout-menu focus survives geometry closing/blur, without stealing focus for a closed-menu change", () => {
  const f = harness(), menu = f.c.studioUiRefreshUi.menus.find(m => m.name === "view");
  assert.equal(f.c.studioPaneLayoutSelect.listeners.change.length, 1, "one production selection handler, no earlier competing focus handler");
  f.c.applyPaneSplitPercent = () => { menu.close(); f.doc.activeElement = f.doc.body; }; // browser reparent blur
  menu.button.fire("click"); f.c.studioPaneLayoutSelect.fire("change"); assert.equal(f.doc.activeElement, menu.button);
  f.c.applyPaneSplitPercent = () => {}; f.doc.activeElement = f.c.sourceTextEl;
  f.c.studioPaneLayoutSelect.fire("change"); assert.equal(f.doc.activeElement, f.c.sourceTextEl);
});

test("selected role picker changes only the native view control; old role picker cannot act on another buffer", () => {
  const f = harness(), menu = f.c.bufferSwitcherUi.viewMenus[1];
  menu.button.fire("click"); assert.equal(menu.menu.hidden, false);
  menu.menu.children[1].fire("click"); assert.deepEqual(f.events, [["view", "doc", "preview"]]);
  assert.equal(f.c.bufferSwitcherUi.document.textContent, "Document (Preview) ▾");
  menu.button.fire("click"); f.c.selectStudioBuffer("prompt");
  assert.equal(menu.menu.hidden, true);
  menu.menu.children[0].fire("click"); assert.equal(f.events.length, 1);
});

test("held/repeated selected-view activation and modal/disabled continuations are refused", () => {
  const f = harness(), menu = f.c.bufferSwitcherUi.viewMenus[1];
  menu.button.fire("click", { detail: 2 }); assert.equal(menu.menu.hidden, true);
  menu.button.fire("keydown", { key: "Enter", repeat: true }); assert.equal(menu.menu.hidden, true);
  menu.button.fire("click"); f.c.studioModalBlocksDraftAction = () => true;
  menu.menu.children[1].fire("click"); assert.equal(f.events.length, 0);
  f.c.studioModalBlocksDraftAction = () => false; f.c.editorViewSelect.disabled = true;
  menu.menu.children[1].fire("click"); assert.equal(f.events.length, 0);
});

test("selected-role disclosure Escape restores the visible tab; Tab view changes never submit", () => {
  const f = harness(), menu = f.c.bufferSwitcherUi.viewMenus[1];
  menu.button.fire("keydown", { key: "ArrowDown" }); assert.equal(f.doc.activeElement, menu.menu.children[0]);
  f.doc.activeElement = menu.menu.children[1];
  // Production document-capture Escape closure, not a simulated browser key.
  for (const callback of f.docEvents.keydown || []) callback({ key: "Escape", preventDefault() {}, stopPropagation() {} });
  assert.equal(menu.menu.hidden, true); assert.equal(f.doc.activeElement, menu.button);
  assert.deepEqual(f.events, []);
});

test("a named file's name opens its own menu (path, then file actions), Untitled opens Save As; Escape returns to the name", () => {
  const f = harness(), ui = f.c.studioUiRefreshUi, file = ui.menus.find(item => item.name === "context"), name = f.c.bufferSwitcherUi.nameMenu;
  assert.match(ui.pathDetails.textContent, /\/NOTES\.md.*disk not rechecked/);
  // A real click also reaches the page-wide handler unless stopped (Oliver: "not clickable?").
  let stopped = false;
  ui.filenameButton.fire("click", { stopPropagation() { stopped = true; } });
  if (!stopped) for (const callback of f.docEvents.click || []) callback({ target: ui.filenameButton });
  assert.equal(name.menu.hidden, false, "the file's own menu"); assert.equal(file.menu.hidden, true, "not File");
  assert.match(name.menu.children[0].textContent, /\/NOTES\.md$/);
  assert.deepEqual(name.menu.children.slice(1).map(button => button.textContent), ["Show in folder", "Copy path", "Save As…", "Reload from disk"]);
  assert.equal(ui.filenameButton.getAttribute("aria-expanded"), "true");
  f.c.closeStudioUiRefreshMenus(); // a click inside the menu reaches the page-wide closer
  assert.equal(name.menu.hidden, false); assert.equal(ui.filenameButton.getAttribute("aria-expanded"), "true", "File's closer leaves the name's own menu state alone");
  for (const callback of f.docEvents.keydown || []) callback({ key: "Escape", preventDefault() {}, stopPropagation() {} });
  assert.equal(name.menu.hidden, true); assert.equal(f.doc.activeElement, ui.filenameButton);
  assert.equal(ui.filenameButton.getAttribute("aria-expanded"), "false");
  f.c.sourceState = { source: "response" }; f.c.syncStudioWorkspaceFilename();
  assert.equal(ui.pathDetails.textContent, "Not saved to a file.");
  assert.equal(ui.filenameButton.textContent, "Untitled"); assert.equal(ui.filenameButton.classList.contains("is-untitled"), true, "italic placeholder");
  // Clicking Untitled names it through the existing Save As; a named file still opens File.
  let saved = 0; f.c.saveAsBtn.click = () => { saved++; }; f.c.saveAsBtn.disabled = false;
  file.menu.hidden = true; ui.filenameButton.fire("click", { stopPropagation() {} });
  assert.equal(saved, 1); assert.equal(file.menu.hidden, true); assert.match(ui.filenameButton.title, /Save As/);
});

test("file menu arrows skip unsupported hidden actions and busy inert items", () => {
  const f = harness(), file = f.c.studioUiRefreshUi.menus.find(item => item.name === "context");
  const items = file.menu.querySelectorAll(".studio-refresh-menu-item");
  for (const item of items) item.inert = true;
  const accessible = items.find(item => item.children[0] === f.c.copyDraftBtn); accessible.inert = false;
  file.button.fire("keydown", { key: "ArrowDown" }); assert.equal(f.doc.activeElement, f.c.copyDraftBtn);
  assert.equal(f.c.clearWorkspaceBtn.hidden, true);
});

test("Copy response stays directly in its native action row; source previews still collapse that row", () => {
  const f = harness(), ui = f.c.studioUiRefreshUi;
  assert.equal(ui.menus.some(item => item.name === "response-more"), false);
  assert.equal(f.row.children.at(-1), f.c.copyResponseBtn);
  for (const view of ["editor-preview", "preview", "markdown", "editor-preview", "preview"]) {
    f.c.rightView = view; f.c.syncStudioResponseActionLayout();
    assert.equal(f.row.parentElement, view === "editor-preview" ? ui.responseMenu.menu : f.c.responseActionsEl);
    assert.equal(ui.responseMenu.anchor.hidden, view !== "editor-preview");
    assert.equal(copies(f.c.copyResponseBtn, f.row), 1); assert.equal(f.c.copyResponseBtn.parentElement, f.row);
    assert.equal(f.c.copyResponseBtn.id, "copyResponseBtn", "existing clipboard handler target retained");
  }
});
function copies(node, root) { return root.querySelectorAll("#" + node.id).length; }

test("file-backed edits get one selected filename dot; drafts get none", () => {
  const f = harness(); f.c.editorDiffersFromFileBackedBaseline = () => true;
  f.c.syncStudioWorkspaceFilename(); f.c.syncStudioBufferSwitcher();
  assert.equal(f.c.studioUiRefreshUi.filenameButton.textContent, "NOTES.md •"); assert.equal(f.c.bufferSwitcherUi.document.textContent, "Document (Raw) ▾");
  f.state.buffers[0].text = "Unsubmitted file edits"; f.c.syncStudioBufferSwitcher(); assert.equal(f.c.bufferSwitcherUi.prompt.textContent, "Prompt •");
  f.c.sourceState = { source: "response", label: "Response" }; f.c.syncStudioWorkspaceFilename(); assert.equal(f.c.studioUiRefreshUi.filenameButton.textContent, "Untitled");
});

for (const mode of [{ only: true }, { only: true, watched: true }]) test("actual refreshed constructor retains single-source mode guards " + JSON.stringify(mode), () => {
  const f = harness(mode);
  assert.equal(f.c.bufferSwitcherUi, null); assert.equal(f.c.getEditorBtn.closest(".studio-refresh-menu"), null);
  assert.equal(f.c.sendEditorBtn.closest(".studio-refresh-menu"), null);
  assert.equal(f.c.clearWorkspaceBtn.hidden, true);
});

function sideHarness() {
  const c = vm.createContext({ sideQuestionUi: { draft: "Question", thinking: "off", focusMode: "auto", includeConversation: false, gitContext: true, customPath: "/pending", webSearch: false, toolIds: [] },
    sideQuestionState: null, sideQuestionNextSettings: null, sideQuestionNextOptionsOpen: false, sideQuestionPreferredThinking: "off", sideQuestionWebSearchAvailable: false, sideQuestionContextGrantPending: false,
    sideQuestionHelpers: { getDefaultStudioSideQuestionGatherScope: () => "repo" }, getEffectiveSavePath: () => "", sourceState: {}, getCurrentResourceDirValue: () => "",
    getSideQuestionContextSummary: () => ({ scope: "repo", attachmentText: "LIVE document", relatedFilesText: "LIVE repository", gitContextText: "LIVE Git" }),
    sideQuestionSelectOptions: () => "<option>existing choices</option>", getSideQuestionThinkingOptions: () => [], renderSideQuestionPiToolPicker: () => "<div>Existing tool picker</div>",
    escapeHtml: value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll("'", "&#39;"), isSideQuestionConnectionReady: () => true,
    getLatestCompletedSideQuestionAnswer: () => "answer", formatReferenceTime: value => value,
    bufferSwitchingEnabled: false, studioUiRefreshUi: null, modelLabel: "openai/gpt-6.1-sol (medium)",
  });
  load(c, "cloneSideQuestionSettings", "getSideQuestionNextSettings", "getSideQuestionGatherScope", "renderSideQuestionOptions", "sideQuestionsSimplified", "sideQuestionModelText", "sideQuestionFolderText", "renderSideQuestionSetup", "renderSideQuestionThread"); return c;
}
test("side-question setup puts question/action before scope and collapsed Options, retaining all controls", () => {
  const c = sideHarness(), html = c.renderSideQuestionSetup();
  assert(html.indexOf("field='draft'") < html.indexOf("side-question-scope"));
  assert(html.indexOf("action='ask'") < html.indexOf("side-question-scope"));
  assert(html.indexOf("side-question-scope") < html.indexOf("<summary>Options"));
  assert.match(html, /data-side-question-options><summary>Options/);
  assert.match(html, /Scope: LIVE document · LIVE repository · LIVE Git/);
  for (const name of ["focusMode", "gatherScope", "thinking", "customPath", "includeConversation", "gitContext", "webSearch"]) {
    c.getSideQuestionContextSummary = () => ({ scope: "custom", attachmentText: "attachment", relatedFilesText: "custom" });
    assert.match(name === "customPath" ? c.renderSideQuestionSetup() : html, new RegExp("field='" + name + "'"));
  }
});

test("active side thread displays frozen scope under its conversation/composer, separate from next-thread settings", () => {
  const c = sideHarness(); c.sideQuestionState = { threadId: "thread", status: "complete", modelLabel: "Captured model", thinking: "high", activity: [], messages: [{ role: "assistant", text: "Answer", status: "complete" }],
    context: { focusLabel: "FROZEN attachment", contextRoot: "/FROZEN/root", gatherScope: "repo", includeConversation: true, webSearchRequested: true, webSearchAvailable: true, tools: [{ name: "FROZEN tool" }] } };
  const html = c.renderSideQuestionThread();
  assert(html.indexOf("side-question-transcript") < html.indexOf("field='draft'"));
  assert(html.indexOf("field='draft'") < html.indexOf("Scope:"));
  const captured = html.slice(0, html.indexOf("<summary>Next thread settings"));
  assert.match(captured, /FROZEN attachment.*FROZEN\/root.*FROZEN tool/); assert.doesNotMatch(captured, /LIVE|field='(?:focusMode|gatherScope|thinking|webSearch)'/);
  assert.match(html, /data-side-question-next[^>]*data-side-question-field='focusMode'/);
  assert.match(html, /These settings apply only after you choose New thread/);
  for (const action of ["new", "copy", "insert", "promote", "ask"]) assert.match(html, new RegExp("action='" + action + "'"));
});

test("running side thread keeps its own Stop and captured settings, with words rather than state dots", () => {
  const c = sideHarness(); c.sideQuestionState = { threadId: "thread", status: "running", modelLabel: "Model", thinking: "off", activity: [{ status: "running", label: "Reading allowed file" }], messages: [{ role: "assistant", status: "streaming" }], context: { gatherScope: "none" } };
  const html = c.renderSideQuestionThread(); assert.match(html, /action='stop'/); assert.match(html, /Running/); assert.doesNotMatch(html, /●/);
  assert.match(html, /field='draft'[^>]* disabled/);
});

// Oliver, 10 Oct: in the new layout the model and Thinking sit by Ask, the title isn't repeated,
// and the scope names the folder rather than its path.
test("new-layout side-question setup shows the model and Thinking beside Ask, and a short scope", () => {
  const c = sideHarness(); Object.assign(c, { bufferSwitchingEnabled: true, studioUiRefreshUi: {} });
  c.getSideQuestionContextSummary = () => ({ scope: "folder", rootHint: "/Users/o/teaching/course-304", lineRange: "line 1", focus: { focusKind: "section", focusLabel: "Text around cursor" }, gitContextText: "" });
  const html = c.renderSideQuestionSetup(), actions = html.slice(html.indexOf("side-question-actions"), html.indexOf("side-question-scope"));
  assert.doesNotMatch(html, /<h2>/);
  assert.match(actions, /action='ask'[\s\S]*openai\/gpt-6\.1-sol<\/span>[\s\S]*Thinking<select[^>]*field='thinking'/);
  assert.equal((html.match(/field='thinking'/g) || []).length, 1, "Thinking appears once, beside Ask");
  assert.match(html, /title='\/Users\/o\/teaching\/course-304'>Scope: Text around cursor \(line 1\) · files in course-304, as needed/);
});

test("new-layout side thread shows its captured model and Thinking by Ask, and short notes", () => {
  const c = sideHarness(); Object.assign(c, { bufferSwitchingEnabled: true, studioUiRefreshUi: {} });
  c.sideQuestionState = { threadId: "thread", status: "complete", modelLabel: "GPT-6.1 Sol (openai/gpt-6.1-sol)", thinking: "high", activity: [], messages: [{ role: "assistant", text: "Answer", status: "complete" }],
    context: { focusLabel: "Text around cursor", contextRoot: "/FROZEN/root", gatherScope: "folder", webSearchRequested: false, tools: [] } };
  const html = c.renderSideQuestionThread(), actions = html.slice(html.indexOf("<div class='side-question-actions'>"), html.indexOf("side-question-scope"));
  assert.doesNotMatch(html, /<h2>/); assert.match(html, /action='new'/);
  assert.match(actions, /openai\/gpt-6\.1-sol · thinking high/);
  assert.match(html, /title='\/FROZEN\/root'>Scope: Text around cursor · files in root/);
  assert.match(html, /These stay the same for this thread\. Use New thread to change them\./); assert.match(html, /Used when you start a New thread\./);
  assert.doesNotMatch(html, /Remembered preferences change/);
});

test("the side-question model text is the model id, without the main thinking level", () => {
  const c = sideHarness();
  assert.equal(c.sideQuestionModelText("GPT-6.1 Sol (openai/gpt-6.1-sol)"), "openai/gpt-6.1-sol");
  assert.equal(c.sideQuestionModelText("openai/gpt-6.1-sol (medium)"), "openai/gpt-6.1-sol");
  assert.equal(c.sideQuestionModelText(""), "Pi's model");
  for (const label of ["unknown/unknown (off)", "none", "none (off)"]) assert.equal(c.sideQuestionModelText(label), "No model", label);
  assert.equal(c.sideQuestionFolderText("/a/b/course/"), "course");
});

test("a file action that fails is reported, not left as an unhandled rejection", async () => {
  const f = harness(), name = f.c.bufferSwitcherUi.nameMenu, statuses = [];
  f.c.setStatus = (...a) => statuses.push(a);
  f.c.revealPreviewLocalLink = async () => { throw new Error("That file no longer exists."); };
  f.c.studioLiteralPathToLinkRef = path => path; f.c.getHtmlPreviewResourceContextOptions = () => ({});
  name.menu.children.find(b => b.textContent === "Show in folder").fire("click");
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(statuses.at(-1), ["That file no longer exists.", "warning"]);
});

import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../client/studio.css", import.meta.url), "utf8");
const sync = source.slice(source.indexOf("      function syncRunAndCritiqueButtons()"), source.indexOf("\n      function ", source.indexOf("      function syncRunAndCritiqueButtons()") + 20));

// Oliver, 10 Oct: on a 13-inch laptop View wrapped onto a second toolbar line.
test("the new-layout Document has no Return to Prompt button; Stop still shows while a Run is active", () => {
  assert.match(sync, /sendRunBtn\.hidden = workspaceLayout && documentView && !directIsStop;/);
  assert.match(css, /#sendRunBtn\[hidden\],\n    #sendReplBtn\[hidden\],\n    #replSendModeSelect\[hidden\] \{\n      display: none !important;/);
  // The keyboard route doesn't depend on the button.
  assert.match(source, /if \(bufferSwitchingEnabled && isStudioDocumentBufferView\(\)\) \{\n\s+event\.preventDefault\(\);\n\s+requireStudioPromptForSend\(\);/);
});

test("toolbar items sit a little closer in the new layout only", () => {
  assert.match(css, /body\.studio-workspace-layout \.studio-refresh-toolbar-actions \.studio-refresh-action-line \{ column-gap: 8px; \}/);
  assert.match(css, /body\.studio-workspace-layout \.studio-refresh-toolbar-actions \.studio-refresh-action-line button:not\(#sendRunBtn\):not\(#queueSteerBtn\):not\(#sendReplBtn\):not\(\.request-stop-active\) \{ padding-left: 6px; padding-right: 6px; \}/);
});

// Oliver, 10 Oct: the Prompt toolbar has Run Prompt and one plain Send to REPL; how Send reads
// the text is a REPL setting, under the REPL pane's More.
function declaration(name) {
  const start = source.search(new RegExp("\\n      (?:async )?function " + name + "\\("));
  assert(start >= 0, name);
  return source.slice(start, source.indexOf("\n      }\n", start) + 9);
}

test("Send mode lives in the REPL pane's More in the new layout, not the Prompt toolbar", () => {
  assert.match(sync, /replSendModeSelect\.hidden = rightView !== "repl" \|\| workspaceLayout;/);
  assert.match(source, /\(bufferSwitchingEnabled && studioUiRefreshUi \? "<label class='repl-more-send-mode'[^"]*'>Send mode <select class='studio-flat-select' data-repl-send-mode aria-label='Send mode'" \+ \(wsState === "Disconnected" \|\| uiBusy \|\| replBusy \? " disabled" : ""\) \+ ">"/);
  const stored = [], synced = [], rendered = [];
  class Element { constructor(value) { this.value = value; } closest(selector) { return selector === "[data-repl-send-mode]" ? this : null; } }
  const c = { rightView: "repl", Element, replSendMode: "raw", replSendModeSelect: { value: "raw" },
    window: { localStorage: { setItem: (...a) => stored.push(a) } },
    syncActionButtons: () => synced.push(c.replSendMode), renderReplViewIfActive: options => rendered.push(options) };
  vm.createContext(c);
  vm.runInContext(declaration("normalizeReplSendMode") + declaration("setReplSendMode") + declaration("handleReplPaneChange"), c);
  c.handleReplPaneChange({ target: new Element("literate") });
  assert.equal(c.replSendMode, "literate"); assert.equal(c.replSendModeSelect.value, "literate");
  assert.deepEqual(stored, [["piStudio.replSendMode", "literate"]]); assert.deepEqual(synced, ["literate"]); assert.equal(rendered[0].force, true);
});

test("the choose-a-file strip stays pinned while Files scrolls", () => {
  assert.match(css, /body\.studio-workspace-layout \.files-pick-strip \{ position: sticky; top: 0; z-index: 3; \}/);
});

// Oliver, 10 Oct: the picker was as wide as its longest option, "Document (Quarto Preview)". It
// keeps its fixed native width; the shorter Quarto label lets that be "Response (Preview)".
test("the right view picker has no width code; the Quarto label is the short one in the new layout", () => {
  assert.doesNotMatch(source, /syncRightViewSelectWidth|rightViewSelectMeasure/);
  assert.match(source, /option\.textContent = name \+ \(isQuartoOption \? \(bufferSwitchingEnabled \? " \(Quarto\)" : " \(Quarto Preview\)"\) : " \(Preview\)"\);/);
  assert.ok("Document (Quarto)".length < "Response (Preview)".length && "Prompt (Quarto)".length < "Response (Preview)".length);
});

test("the REPL pane's More stacks plain items like the other menus", () => {
  assert.match(css, /body\.studio-workspace-layout \.repl-more-menu \{ flex-direction: column; flex-wrap: nowrap;/);
  assert.match(css, /body\.studio-workspace-layout \.repl-more-menu button \{ display: block; width: 100%;[^}]*border-color: transparent; background: transparent; box-shadow: none; \}/);
});

// Oliver, 10 Oct: row 2 mirrors row 1, with the main action left and the tools right.
test("toolbar tools sit in a right-aligned group after the main action", () => {
  const setup = source.slice(source.indexOf('const toolsEl = makeStudioUiRefreshElement("span", "studio-refresh-tools");'), source.indexOf("actionLineOneEl.appendChild(toolsEl);") + 40);
  for (const item of ["reviewNotesBtn", "scratchpadBtn", "askAsideBtn", "reviewMenu.anchor", "viewMenu.anchor"]) assert.match(setup, new RegExp("toolsEl\\.appendChild\\(" + item.replace(".", "\\.") + "\\)"));
  assert.match(css, /body\.studio-workspace-layout \.studio-refresh-tools \{ margin-left: auto; display: inline-flex; flex-wrap: wrap; justify-content: flex-end;/);
  assert.match(css, /\.studio-refresh-action-line > \.studio-refresh-tools > button,\n/);
  // Add to Prompt still goes in after the main action, before the tools.
  assert.match(source, /studioUiRefreshUi\.actionLine\.insertBefore\(addMenu\.anchor, queueSteerBtn\?\.nextSibling \|\| sendRunBtn\?\.nextSibling \|\| null\)/);
});

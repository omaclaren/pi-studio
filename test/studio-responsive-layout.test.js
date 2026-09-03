import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const css = readFileSync(new URL("../client/studio.css", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");

function extractRuleBlock(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, "Missing CSS rule: " + marker);
  const open = source.indexOf("{", start);
  assert.notEqual(open, -1, "Missing opening brace for: " + marker);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error("Missing closing brace for: " + marker);
}

test("Studio controls use browser-neutral control chrome", () => {
  assert.match(css, /\n\s*button \{\s*-webkit-appearance: none;\s*appearance: none;/);
  const flatSelectRule = extractRuleBlock(css, ".studio-flat-select {");
  assert.match(flatSelectRule, /-webkit-appearance: none;/);
  assert.match(flatSelectRule, /appearance: none;/);
  assert.match(flatSelectRule, /background-image: url\("data:image\/svg\+xml,/);
  assert.match(flatSelectRule, /background-repeat: no-repeat !important;/);
  assert.match(flatSelectRule, /padding-right: 26px !important;/);
  assert.match(indexSource, /id="editorViewSelectWrap" class="studio-header-select-wrap"/);
  assert.match(indexSource, /id="rightViewSelectWrap" class="studio-header-select-wrap"/);
  assert.match(clientSource, /titleGroupEl\.appendChild\(editorViewSelectWrap \|\| editorViewSelect\)/);
  assert.match(clientSource, /rightTitleGroupEl\.appendChild\(rightViewSelectWrap \|\| rightViewSelect\)/);

  const selectWrapRule = extractRuleBlock(css, ".studio-header-select-wrap::after {");
  assert.match(selectWrapRule, /content: "⌄";/);
  assert.match(selectWrapRule, /pointer-events: none;/);

  assert.match(clientSource, /class='studio-menu-select-wrap'><select id='footerPiModelSelect'/);
  assert.match(clientSource, /class='studio-menu-select-wrap'><select id='footerPiThinkingSelect'/);
  assert.match(clientSource, /class='studio-menu-select-wrap'><select id='footerPiThemeSelect'/);
  assert.match(indexSource, /id="followSelectWrap" class="studio-menu-select-wrap response-option-select-wrap"/);
  assert.match(indexSource, /id="responseHighlightSelectWrap" class="studio-menu-select-wrap response-option-select-wrap"/);
  assert.match(indexSource, /id="responseFontSizeSelectWrap" class="studio-menu-select-wrap response-option-select-wrap"/);
  const menuSelectWrapRule = extractRuleBlock(css, ".studio-menu-select-wrap::after {");
  assert.match(menuSelectWrapRule, /content: "⌄";/);
  assert.match(menuSelectWrapRule, /pointer-events: none;/);
  const menuSelectRule = extractRuleBlock(css, ".footer-model-menu-field select {");
  assert.match(menuSelectRule, /padding: 5px 24px 5px 7px;/);
  assert.match(menuSelectRule, /-webkit-appearance: none;/);
  assert.match(menuSelectRule, /background-image: none;/);
  const responseSelectRule = extractRuleBlock(css, "#responseActions .response-option-select-wrap select {");
  assert.match(responseSelectRule, /padding-right: 26px;/);
  assert.match(responseSelectRule, /-webkit-appearance: none;/);
  assert.match(responseSelectRule, /background-image: none;/);
  assert.match(css, /body\[data-studio-mode="editor-only"\] #followSelectWrap,/);
  assert.match(css, /body\[data-studio-mode="editor-only"\] #responseHighlightSelectWrap,/);

  const customWrappedSelectIds = new Set([
    "editorViewSelect",
    "rightViewSelect",
    "followSelect",
    "responseHighlightSelect",
    "responseFontSizeSelect",
    "footerPiModelSelect",
    "footerPiThinkingSelect",
    "footerPiThemeSelect",
  ]);
  for (const source of [indexSource, clientSource]) {
    for (const match of source.matchAll(/<select\b[^>]*>/g)) {
      const tag = match[0];
      const id = tag.match(/\bid=['"]([^'"]+)['"]/)?.[1] || "";
      assert.ok(
        /\bclass=['"][^'"]*\bstudio-flat-select\b/.test(tag) || customWrappedSelectIds.has(id),
        "Unstyled Studio select: " + tag,
      );
    }
  }

  const baseSelectRule = extractRuleBlock(css, ".section-header select {");
  assert.match(baseSelectRule, /-webkit-appearance: none;/);
  assert.match(baseSelectRule, /appearance: none;/);
  assert.match(baseSelectRule, /background-image: none;/);
  assert.match(baseSelectRule, /padding: 2px 18px 2px 4px;/);

  const refreshedSelectRule = extractRuleBlock(css, "body.studio-ui-refresh #leftSectionHeader #editorViewSelect,");
  assert.match(refreshedSelectRule, /padding: 3px 20px 3px 5px;/);
  assert.match(refreshedSelectRule, /-webkit-appearance: none;/);
  assert.match(refreshedSelectRule, /background-image: none;/);
  assert.doesNotMatch(css, /appearance:\s*menulist/);
});

test("Studio supports persisted side-by-side and ordered vertical pane layouts", () => {
  assert.match(indexSource, /id="studioPaneLayoutSelect"/);
  assert.match(indexSource, /value="side-by-side">Layout: Side by side/);
  assert.match(indexSource, /value="editor-top">Layout: Editor above/);
  assert.match(indexSource, /value="response-top">Layout: Response above/);
  assert.match(clientSource, /const PANE_LAYOUT_STORAGE_KEY = "piStudio\.paneLayout"/);
  assert.match(clientSource, /document\.body\.dataset\.studioLayout = studioPaneLayout/);
  assert.match(clientSource, /mainEl\.append\(rightPaneEl, paneResizeHandleEl, leftPaneEl\)/);
  assert.match(clientSource, /mainEl\.append\(leftPaneEl, paneResizeHandleEl, rightPaneEl\)/);
  assert.match(clientSource, /const stacked = isStackedStudioPaneLayout\(\)/);
  assert.match(clientSource, /typeof event\.clientY === "number"/);
  assert.match(clientSource, /stacked \? "ArrowUp" : "ArrowLeft"/);

  const editorTopRule = extractRuleBlock(css, 'body[data-studio-layout="editor-top"] main {');
  const responseTopRule = extractRuleBlock(css, 'body[data-studio-layout="response-top"] main {\n      grid-template-rows');
  assert.match(editorTopRule, /grid-template-rows:[^;]*--studio-left-pane-fr[^;]*--studio-right-pane-fr/);
  assert.match(responseTopRule, /grid-template-rows:[^;]*--studio-right-pane-fr[^;]*--studio-left-pane-fr/);
  assert.match(css, /body\[data-studio-layout="editor-top"\] \.pane-resize-handle,[\s\S]*?cursor: row-resize/);
  assert.match(css, /body\[data-studio-layout="response-top"\]\.pane-focus-right main[\s\S]*?grid-template-rows: minmax\(0, 1fr\)/);
});

test("Studio activity view tracking is explicit, off by default, and event-driven", () => {
  assert.match(indexSource, /id="activityTrackingSelect"/);
  const selectStart = indexSource.indexOf('id="activityTrackingSelect"');
  const selectEnd = indexSource.indexOf("</select>", selectStart);
  assert.ok(selectStart >= 0 && selectEnd > selectStart);
  const selectSource = indexSource.slice(selectStart, selectEnd);
  assert.ok(selectSource.indexOf('value="off"') < selectSource.indexOf('value="on"'), "Off must be the default option.");
  assert.match(selectSource, /value="off">Follow activity: Off/);
  assert.match(selectSource, /value="on">Follow activity: On/);
  assert.match(clientSource, /extras\.push\("Following activity"\)/);
  assert.match(clientSource, /Studio will show Working during main Pi activity, then return to Response Preview\./);
  assert.match(clientSource, /Activity following disabled\./);
  assert.match(clientSource, /const ACTIVITY_TRACKING_STORAGE_KEY = "piStudio\.trackActivity"/);
  assert.match(clientSource, /window\.localStorage\.getItem\(ACTIVITY_TRACKING_STORAGE_KEY\) === "on"/);
  assert.match(clientSource, /beginTrackedStudioActivity\(pendingRequestId \|\| "active"\)/);
  assert.match(clientSource, /if \(shouldReturn\) setRightView\("preview", \{ activityTracking: true \}\)/);
  assert.match(clientSource, /activityTrackingOwnsWorkingView && !automatedActivityChange/);
  assert.match(clientSource, /activityTrackingEnabled = Boolean\(enabled\) && !isEditorOnlyMode && !isWatchedFilePreview/);

  const start = clientSource.indexOf("      function beginTrackedStudioActivity");
  const end = clientSource.indexOf("      function clampPaneSplitPercent", start);
  assert.ok(start >= 0 && end > start, "expected activity transition helpers");
  const context = {};
  vm.runInNewContext(`
    let activityTrackingEnabled = false;
    let activityTrackingOwnsWorkingView = false;
    let activityTrackingRequestId = "";
    let rightView = "preview";
    const isEditorOnlyMode = false;
    const isWatchedFilePreview = false;
    const transitions = [];
    function setRightView(view, options) { rightView = view; transitions.push([view, options]); }
    ${clientSource.slice(start, end)}
    globalThis.activityApi = {
      enable() { activityTrackingEnabled = true; },
      begin: beginTrackedStudioActivity,
      finish: finishTrackedStudioActivity,
      manual(view) { rightView = view; activityTrackingOwnsWorkingView = false; },
      state() { return { rightView, activityTrackingOwnsWorkingView, activityTrackingRequestId, transitions }; },
    };
  `, context);
  assert.equal(context.activityApi.begin("request-1"), false, "tracking stays inert until enabled");
  context.activityApi.enable();
  assert.equal(context.activityApi.begin("request-1"), true);
  assert.equal(context.activityApi.state().rightView, "trace");
  assert.equal(context.activityApi.finish("other-request"), false, "unrelated completion must not steal the view");
  assert.equal(context.activityApi.finish("request-1"), true);
  assert.equal(context.activityApi.state().rightView, "preview");

  assert.equal(context.activityApi.begin("active"), true);
  context.activityApi.manual("repl");
  assert.equal(context.activityApi.begin("request-2"), false, "resolving an active request ID must preserve a manual view");
  assert.equal(context.activityApi.state().activityTrackingRequestId, "request-2");
  assert.equal(context.activityApi.finish("unrelated-request"), false, "unrelated work must not finish tracked activity");
  assert.equal(context.activityApi.finish("request-2"), false, "completion must not override the manual view");
  assert.equal(context.activityApi.state().rightView, "repl");
});

test("Studio editor controls use pane-local component breakpoints", () => {
  const toolbarBase = css.indexOf("body.studio-ui-refresh .studio-refresh-toolbar-main {");
  const leftHeaderBreakpoint = css.indexOf("@container (max-width: 680px)");
  const toolbarBreakpoint = css.indexOf("@container (max-width: 560px)");
  const rightHeaderBreakpoint = css.indexOf("@container (max-width: 440px)");

  assert.ok(toolbarBase >= 0);
  assert.ok(leftHeaderBreakpoint > toolbarBase, "Header breakpoints must follow the base toolbar rules.");
  assert.ok(toolbarBreakpoint > leftHeaderBreakpoint);
  assert.ok(rightHeaderBreakpoint > toolbarBreakpoint);

  const leftHeaderBlock = extractRuleBlock(css, "@container (max-width: 680px)");
  assert.match(leftHeaderBlock, /#leftSectionHeader \.studio-refresh-header-top/);
  assert.match(leftHeaderBlock, /#leftSectionHeader \.studio-refresh-pane-tools[^{]*\{[^}]*justify-content: flex-end/);
  assert.doesNotMatch(leftHeaderBlock, /#rightSectionHeader|\.studio-refresh-toolbar-main/);

  const toolbarBlock = extractRuleBlock(css, "@container (max-width: 560px)");
  assert.match(toolbarBlock, /\.studio-refresh-toolbar-main[^{]*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(toolbarBlock, /\.studio-refresh-toolbar-state[^{]*\{[^}]*justify-content: flex-start/);

  const rightHeaderBlock = extractRuleBlock(css, "@container (max-width: 440px)");
  assert.match(rightHeaderBlock, /#rightSectionHeader/);
  assert.match(rightHeaderBlock, /#rightSectionHeader \.studio-refresh-pane-tools[^{]*\{[^}]*justify-content: flex-end/);
  assert.doesNotMatch(rightHeaderBlock, /#leftSectionHeader|\.studio-refresh-toolbar-main/);

  assert.doesNotMatch(css, /@container \(max-width: 840px\)|@media \(max-width: 1280px\)/);
});

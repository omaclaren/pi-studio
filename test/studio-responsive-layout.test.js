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

test("buffer selection uses a quiet fill distinct from keyboard focus", () => {
  const selected = extractRuleBlock(css, '.studio-buffer-tabs button[aria-selected="true"] {');
  assert.match(selected, /background: var\(--accent-soft\);/);
  assert.match(selected, /border-color: var\(--control-border\);/);
  assert.doesNotMatch(selected, /box-shadow:|outline:/);
  const focus = extractRuleBlock(css, 'button:focus-visible,');
  assert.match(focus, /outline: 2px solid var\(--accent-soft-strong\);/);
  const highContrast = extractRuleBlock(css, '@media (forced-colors: active) {\n      .studio-buffer-tabs');
  assert.match(highContrast, /border-style: dashed;/, 'selection remains visible when fills are suppressed');
});

test("workspace inactive roles are muted and Follow is plain text with visible non-box keyboard focus", () => {
  const inactive = extractRuleBlock(css, 'body.studio-workspace-layout #leftSectionHeader .studio-buffer-tabs > .studio-buffer-menu-anchor > button[aria-selected="false"] {');
  assert.match(inactive, /color: var\(--muted\);/);
  const follow = extractRuleBlock(css, 'body.studio-ui-refresh #rightSectionHeader .studio-follow-button {');
  assert.match(follow, /color: var\(--muted\);/); assert.match(follow, /border: 0;/); assert.match(follow, /border-radius: 0;/);
  const focus = extractRuleBlock(css, 'body.studio-ui-refresh #rightSectionHeader .studio-follow-button:focus-visible {');
  assert.match(focus, /outline: none;/); assert.match(focus, /text-decoration: underline;/);
  const hover = extractRuleBlock(css, 'body.studio-ui-refresh #rightSectionHeader .studio-follow-button.studio-refresh-chip:hover,');
  assert.match(hover, /background: transparent;/, "specificity beats generic header button:not(:disabled):hover fill");
});

test("native File disclosures use a visible underline focus without the browser outline", () => {
  const focus = extractRuleBlock(css, 'body.studio-ui-refresh details.studio-refresh-menu-section > summary:focus-visible {');
  assert.match(focus, /outline: none;/, "only the new disclosures suppress the native outline");
  assert.match(focus, /text-decoration: underline;/, "keyboard focus remains visible");
  assert.match(focus, /text-underline-offset: 3px;/, "use the existing subtle Follow focus treatment");
  const sharedFocus = extractRuleBlock(css, 'button:focus-visible,');
  assert.match(sharedFocus, /outline: 2px solid var\(--accent-soft-strong\);/, "unrelated control focus remains unchanged");
});

test("selected buffer has pane-title typography and natural-width labels with a small gap, without shrinking menu controls", () => {
  const selected = extractRuleBlock(css, 'body.studio-workspace-layout #leftSectionHeader .studio-buffer-tabs > .studio-buffer-menu-anchor > button[aria-selected="true"] {');
  assert.match(selected, /font-weight: 700;/); assert.match(selected, /color: var\(--text\);/);
  const button = extractRuleBlock(css, 'body.studio-workspace-layout #leftSectionHeader .studio-buffer-tabs > .studio-buffer-menu-anchor > button {');
  assert.match(button, /font-size: 14px;/); assert.match(button, /line-height: 20px;/, "bold and muted roles retain the same target height");
  const row = extractRuleBlock(css, 'body.studio-workspace-layout .studio-workspace-row-one {');
  assert.match(row, /align-items: flex-start;/, "file-controls wrapping must not vertically centre-shift the title targets");
  assert.doesNotMatch(css, /#studioPromptBufferBtn::before|#studioDocumentBufferBtn::before/, "no reserved longest-label width (trial48 finding 14)");
  assert.match(css, /body\.studio-workspace-layout \.studio-buffer-tabs \{ gap: 16px; flex-wrap: wrap; \}/);
});

test("muted toolbar foreground is scoped to direct line controls, not enabled menu descendants", () => {
  assert.doesNotMatch(css, /body\.studio-ui-refresh \.studio-refresh-toolbar button:not\(#sendRunBtn\):not\(#queueSteerBtn\):not\(#sendReplBtn\):not\(\.request-stop-active\),/);
  assert.match(css, /\.studio-refresh-toolbar-actions > \.studio-refresh-action-line > button:not\(#sendRunBtn\)/);
  const menu = extractRuleBlock(css, 'body.studio-ui-refresh .studio-refresh-menu-item > button,');
  assert.match(menu, /color: var\(--text\);/);
});

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
  assert.match(clientSource, /tabsHost\.appendChild\(editorViewSelectWrap \|\| editorViewSelect\)/);
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

test("legacy activity tracking remains explicit and event-driven; full workspace has a scoped fresh default", () => {
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
  assert.match(clientSource, /window\.localStorage\?\.getItem\(ACTIVITY_TRACKING_STORAGE_KEY\)/);
  assert.match(clientSource, /saved === "off" \? false : saved === "on" \? true : freshDefault/);
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
    const studioRuntimeActivity = null; // legacy packet / no SDK run snapshot
    function studioRunFollowingAvailable() { return false; }
    let rightView = "preview";
    const isEditorOnlyMode = false;
    const isWatchedFilePreview = false;
    const bufferSwitchingEnabled = false;
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

test("Studio consistently labels Option/Alt without changing standard accessibility key names", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  for (const source of [indexSource, clientSource, readme]) {
    assert.doesNotMatch(source, /Cmd\/Ctrl\+Alt\+|Alt\/Option/);
  }
  const labels = [...indexSource.matchAll(/<dt>([^<]*Alt[^<]*)<\/dt>/g)].map((match) => match[1]);
  assert.ok(labels.length > 0);
  for (const label of labels) assert.ok(label.includes("Option/Alt"), label);
  const accessibilityKeys = [...indexSource.matchAll(/aria-keyshortcuts="([^"]*)"/g)].map((match) => match[1]);
  assert.ok(accessibilityKeys.some((keys) => keys.includes("Alt+")));
  for (const keys of accessibilityKeys) assert.doesNotMatch(keys, /Option/);
});

test("Studio exposes a global mnemonic shortcut for toggling activity following", () => {
  const selectTag = indexSource.match(/<select id="activityTrackingSelect"[^>]*>/)?.[0] || "";
  assert.match(selectTag, /aria-keyshortcuts="Meta\+Alt\+A Control\+Alt\+A"/);
  assert.match(selectTag, /Shortcut: Cmd\/Ctrl\+Option\/Alt\+A\./);
  assert.match(indexSource, /<dt>Cmd\/Ctrl\+Option\/Alt\+A<\/dt><dd>Toggle Follow activity in the main editable Studio workspace<\/dd>/);

  const shortcutStart = clientSource.indexOf("const isActivityTrackingShortcut");
  const shortcutEnd = clientSource.indexOf("const isContentFocusShortcut", shortcutStart);
  assert.ok(shortcutStart >= 0 && shortcutEnd > shortcutStart, "expected Follow activity shortcut handler");
  const shortcutSource = clientSource.slice(shortcutStart, shortcutEnd);
  assert.match(shortcutSource, /code === "KeyA"/);
  assert.match(shortcutSource, /\(event\.metaKey \|\| event\.ctrlKey\)/);
  assert.match(shortcutSource, /event\.altKey/);
  assert.match(shortcutSource, /!event\.shiftKey/);
  assert.match(shortcutSource, /event\.preventDefault\(\)/);
  assert.match(shortcutSource, /if \(!event\.repeat && !event\.isComposing\) triggerActivityTrackingShortcut\(\)/);
  assert.doesNotMatch(shortcutSource, /isTextEntryShortcutTarget/, "the workspace shortcut should also work while editing text");

  const triggerStart = clientSource.indexOf("function triggerActivityTrackingShortcut()");
  const triggerEnd = clientSource.indexOf("function cycleActivePaneView", triggerStart);
  assert.ok(triggerStart >= 0 && triggerEnd > triggerStart, "expected Follow activity shortcut action");
  const triggerSource = clientSource.slice(triggerStart, triggerEnd);

  function runTrigger({ editorOnly = false, watched = false, enabled = false, modal = false } = {}) {
    const context = {};
    vm.runInNewContext(`
      const isEditorOnlyMode = ${JSON.stringify(editorOnly)};
      const isWatchedFilePreview = ${JSON.stringify(watched)};
      let activityTrackingEnabled = ${JSON.stringify(enabled)};
      const updates = [];
      const statuses = [];
      function studioModalBlocksDraftAction() { return ${JSON.stringify(modal)}; }
      function setActivityTrackingEnabled(value) {
        activityTrackingEnabled = Boolean(value);
        updates.push(activityTrackingEnabled);
      }
      function setStatus(message, tone) { statuses.push([message, tone]); }
      ${triggerSource}
      globalThis.result = {
        returned: triggerActivityTrackingShortcut(),
        enabled: activityTrackingEnabled,
        updates,
        statuses,
      };
    `, context);
    return JSON.parse(JSON.stringify(context.result));
  }

  assert.deepEqual(runTrigger(), {
    returned: true,
    enabled: true,
    updates: [true],
    statuses: [],
  });
  assert.deepEqual(runTrigger({ enabled: true }), {
    returned: true,
    enabled: false,
    updates: [false],
    statuses: [],
  });
  assert.deepEqual(runTrigger({ modal: true }), { returned: false, enabled: false, updates: [], statuses: [] });
  for (const unavailable of [{ editorOnly: true }, { watched: true }]) {
    assert.deepEqual(runTrigger(unavailable), {
      returned: false,
      enabled: false,
      updates: [],
      statuses: [["Follow activity is available only in the main editable Studio workspace.", "warning"]],
    });
  }
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

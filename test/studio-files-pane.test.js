import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../client/studio.css", import.meta.url), "utf8");
function declaration(name) {
  const start = source.search(new RegExp("\\n      (?:async )?function " + name + "\\("));
  assert(start >= 0, name);
  return source.slice(start, source.indexOf("\n      }\n", start) + 9);
}
function harness(workspace = true) {
  const c = { bufferSwitchingEnabled: workspace, studioUiRefreshUi: workspace ? {} : null, studioFilePick: null, fileBrowserSortMode: "name",
    escapeHtml: s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/'/g, "&#39;"),
    basenameForStudioPath: p => String(p).replace(/\/+$/, "").split("/").pop(),
    buildFileBrowserEntryRowHtml: e => "<div class='files-row'>" + e.name + "</div>",
    buildFileBrowserSortSelectHtml: () => "<select data-files-sort></select>", fileBrowserState: {} };
  vm.createContext(c);
  vm.runInContext(declaration("buildFileBrowserLocationSelectHtml") + declaration("buildStudioFilesLocationLineHtml") + declaration("buildFileBrowserPanelHtml"), c);
  return c;
}
const root = "/Users/o/teaching/course-304";
const state = (extra = {}) => ({ rootDir: root, currentDir: root + "/lectures", relativeDir: "lectures", parentDir: root, entries: [{ name: "a.md" }],
  locations: [{ path: root, label: "course-304" }], ...extra });

// Oliver, 10 Oct: one location line instead of a boxed toolbar and an "Allowed root" line.
test("the new-layout Files pane has one location line: up, path, Sort and ⋯", () => {
  const c = harness(); c.fileBrowserState = state();
  const html = c.buildFileBrowserPanelHtml();
  assert.match(html, /class='files-panel files-panel-workspace'/);
  assert.doesNotMatch(html, /files-toolbar|files-subtitle|Allowed root|files-label/);
  assert.match(html, /<button type='button' class='files-up' data-files-action='parent' title='Up a folder' aria-label='Up a folder'>‹<\/button>/);
  assert.match(html, /<span class='files-path' title='\/Users\/o\/teaching\/course-304\/lectures\nAllowed folder on the computer running Pi: \/Users\/o\/teaching\/course-304'>course-304 \/ lectures<\/span>/);
  assert.match(html, /<select data-files-sort><\/select><details class='files-more'><summary aria-label='More Files actions'>⋯<\/summary>/);
  const menu = html.slice(html.indexOf("files-more-menu"));
  assert.deepEqual([...menu.matchAll(/data-files-action='([a-z-]+)'[^>]*>([^<]+)</g)].map(m => m[1] + ":" + m[2]),
    ["refresh:Refresh", "copy-current:Copy path", "use-working-dir:Use as working dir", "open-root:Show in folder", "copy-root:Copy root", "allow-folder:Allow folder…"]);
  assert.doesNotMatch(html, /data-files-location/, "one allowed folder: no folder picker");
  // Oliver, 10 Oct: Show in folder opens the folder being viewed, not the allowed root.
  assert.match(menu, /data-files-action='open-root' data-files-path='\/Users\/o\/teaching\/course-304\/lectures'[^>]*>Show in folder</);
});

test("at the allowed folder itself, up is disabled and the path is just its name; several folders bring back the picker", () => {
  const c = harness(); c.fileBrowserState = state({ currentDir: root, relativeDir: ".", parentDir: null, locations: [{ path: root }, { path: "/tmp/other" }] });
  const html = c.buildFileBrowserPanelHtml();
  assert.match(html, /aria-label='Up a folder' disabled>‹/); assert.match(html, />course-304<\/span>/); assert.match(html, /data-files-location/);
  c.fileBrowserState = state({ rootDir: "", currentDir: "", locations: [] });
  assert.match(c.buildFileBrowserPanelHtml(), /class='files-path' title=''>No folder allowed</);
});

test("the classic Files pane keeps its toolbar and Allowed root line", () => {
  const c = harness(false); c.fileBrowserState = state();
  const html = c.buildFileBrowserPanelHtml();
  assert.match(html, /<div class='files-toolbar'>/); assert.match(html, /Allowed root on the computer running Pi/); assert.doesNotMatch(html, /files-location-line|files-panel-workspace/);
});

test("the pane header doesn't repeat the full path in the new layout", () => {
  assert.match(source, /\|\| \(bufferSwitchingEnabled && studioUiRefreshUi && rightView === "files"\)\) \{/);
});

test("rows are plain, and row actions show only on the row under the mouse or keyboard focus", () => {
  assert.match(css, /\.files-panel-workspace \.files-row \{ position: relative; padding: 3px 6px; border-color: transparent; border-radius: 6px; background: transparent; \}/);
  assert.match(css, /\.files-panel-workspace \.files-row \.files-actions \{ position: absolute;[^}]*visibility: hidden; \}/);
  assert.match(css, /\.files-row:is\(:hover, :focus-within\) \.files-actions,\n\s+body\.studio-workspace-layout \.files-panel-workspace \.files-row:has\(\.files-more\[open\]\) \.files-actions \{ visibility: visible; \}/);
  assert.match(css, /\.files-panel-workspace \.files-row:has\(\.files-more\[open\]\) \{ z-index: 5; \}/);
});

// Sol (candidate65): folder names are literal, and a dialog opened from ⋯ returns focus to ⋯.
test("the path shows a folder name with # or ? in full", () => {
  const c = harness(); c.basenameForStudioPath = () => "WRONG: link-style basename";
  c.fileBrowserState = state({ rootDir: "/Users/o/course#draft?v2", currentDir: "/Users/o/course#draft?v2", relativeDir: ".", parentDir: null, locations: [{ path: "/Users/o/course#draft?v2" }] });
  assert.match(c.buildFileBrowserPanelHtml(), />course#draft\?v2<\/span>/);
});

test("choosing Allow folder… from ⋯ by keyboard leaves focus on ⋯, so cancelling returns there", async () => {
  const summary = { focused: false, focus() { c.document.activeElement = summary; } };
  const menu = { open: true, contains: e => e === item, querySelector: () => summary, removeAttribute() { menu.open = false; } };
  const item = { getAttribute: k => k === "data-files-action" ? "allow-folder" : null, closest: sel => sel === "[data-files-action]" ? item : sel === "details.files-more" ? menu : null };
  let focusAtDialog = null;
  const c = { rightView: "files", Element: Object, document: { activeElement: item }, studioFilePick: null,
    studioLiteralPathKind: () => "", studioLiteralPathToLinkRef: p => p, setStatus() {},
    allowFileBrowserFolder: async () => { focusAtDialog = c.document.activeElement; } };
  vm.createContext(c); vm.runInContext(declaration("handleFilesPaneClick"), c);
  await c.handleFilesPaneClick({ target: item, preventDefault() {} });
  assert.equal(menu.open, false); assert.equal(focusAtDialog, summary, "the dialog opens with ⋯ focused, so Cancel or Escape restores it");
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const indexSource = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../client/studio.css", import.meta.url), "utf8");

test("Import file copy always exposes browser and Studio-host choices", () => {
  assert.match(indexSource, /<button id="importFileBtn"[^>]*aria-haspopup="menu"[^>]*>Import file copy…<\/button>/);
  assert.match(indexSource, /<div id="importFileMenu" class="import-file-menu" role="menu" aria-labelledby="importFileBtn" hidden>/);
  assert.match(indexSource, /id="importFileChooseBtn"[^>]*role="menuitem"/);
  assert.match(indexSource, /Choose file in browser…/);
  assert.match(indexSource, /id="importFilePathBtn"[^>]*role="menuitem"/);
  assert.match(indexSource, /Import from Studio host path…/);
  assert.match(indexSource, /<input id="fileInput" class="file-input-hidden" type="file"/);
  assert.match(cssSource, /\.import-file-menu \{/);
  assert.match(cssSource, /\.file-input-hidden \{\s*display: none !important;/);
});

test("file-import correctness does not depend on Muxy detection or user-agent sniffing", () => {
  assert.doesNotMatch(indexSource, /data-muxy-session|initialMuxySession/);
  assert.doesNotMatch(clientSource, /useServerPathFileImport|isEmbeddedWebKitBrowser|studioUserAgent/);
  assert.match(clientSource, /importFileChooseBtn\.addEventListener\("click"/);
  assert.match(clientSource, /chooseStudioFileCopyWithBrowser\(\)/);
  assert.match(clientSource, /importFilePathBtn\.addEventListener\("click"/);
  assert.match(clientSource, /void importStudioFileCopyByPath\(\)/);
});

test("Import file copy menu is dismissible and keyboard navigable", () => {
  assert.match(clientSource, /function toggleImportFileMenu\(\)/);
  assert.match(clientSource, /importFileBtn\.setAttribute\("aria-expanded", "true"\)/);
  assert.match(clientSource, /importFileBtn\.setAttribute\("aria-expanded", "false"\)/);
  assert.match(clientSource, /\["ArrowDown", "ArrowUp", "Home", "End"\]/);
  assert.match(clientSource, /function positionImportFileMenu\(\)/);
  assert.match(clientSource, /const clampedLeft = Math\.max\(viewportMargin, Math\.min\(menuRect\.left, maxLeft\)\)/);
  assert.match(clientSource, /window\.addEventListener\("resize", positionImportFileMenu\)/);
  assert.match(clientSource, /closeImportFileMenu\(\{ restoreFocus: true \}\)/);
  assert.match(clientSource, /if \(!targetEl \|\| !targetEl\.closest\("#importFileControls"\)\) closeImportFileMenu\(\)/);
});

test("Studio-host path import is authenticated, bounded, and rejects binary files", () => {
  assert.match(indexSource, /const STUDIO_IMPORT_FILE_MAX_BYTES = 10_000_000/);
  assert.match(indexSource, /async function handleImportStudioFileCopyRequest\(/);
  assert.match(indexSource, /stats\.size > STUDIO_IMPORT_FILE_MAX_BYTES/);
  assert.match(indexSource, /const file = readStudioFile\(resolved\.resolved, studioCwd\)/);
  assert.match(indexSource, /requestUrl\.pathname === "\/import-file-copy"/);
  assert.match(indexSource, /handleImportStudioFileCopyRequest\(req, res, studioCwd\)/);
  assert.match(clientSource, /fetchStudioJson\("\/import-file-copy", \{/);
  assert.match(clientSource, /body: JSON\.stringify\(\{ path \}\)/);
});

test("both import choices create the same detached editor copy", () => {
  assert.match(clientSource, /function applyImportedFileCopy\(text, filename\)/);
  assert.match(clientSource, /source: "upload",\s*label: "imported copy: " \+ name,\s*path: null/);
  assert.match(clientSource, /fileInput\.addEventListener\("change", \(\) => \{/);
  assert.match(clientSource, /const reader = new FileReader\(\)/);
  assert.match(clientSource, /applyImportedFileCopy\(text, file\.name\)/);
  assert.match(clientSource, /reader\.readAsText\(file\)/);
  assert.match(clientSource, /applyImportedFileCopy\(payload\.text, typeof payload\.filename === "string" \? payload\.filename : path\)/);
});

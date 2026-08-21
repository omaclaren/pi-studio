import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const indexSource = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../client/studio.css", import.meta.url), "utf8");

test("Import file copy opens one persistent host-independent dialog", () => {
  assert.match(indexSource, /<button id="importFileBtn"[^>]*>Import file copy…<\/button>/);
  assert.match(indexSource, /<input id="fileInput" class="file-input-hidden" type="file"/);
  assert.match(cssSource, /\.file-input-hidden \{\s*display: none !important;/);
  assert.doesNotMatch(indexSource, /importFileMenu|data-muxy-session|initialMuxySession/);
  assert.doesNotMatch(clientSource, /toggleImportFileMenu|useServerPathFileImport|isEmbeddedWebKitBrowser|studioUserAgent/);
  assert.match(clientSource, /void openStudioFileCopyDialog\(\)/);
});

test("the import dialog keeps browser selection secondary to an always-visible path option", () => {
  assert.match(clientSource, /title: "Import file copy"/);
  assert.match(clientSource, /Enter the path to a file you want to import, or use Browse to open your browser’s file picker\./);
  assert.match(clientSource, /confirmLabel: "Import from path"/);
  assert.match(clientSource, /secondaryLabel: "Browse…"/);
  assert.match(clientSource, /onSecondary: chooseStudioFileCopyWithBrowser/);
  assert.match(clientSource, /inputLabel: "File path on computer running Pi"/);
  assert.match(clientSource, /studioDecisionSecondaryBtn\.hidden = !secondaryLabel/);
  assert.match(clientSource, /const handler = studioDecisionState && studioDecisionState\.onSecondary/);
  assert.doesNotMatch(
    clientSource.slice(
      clientSource.indexOf('secondaryBtn.addEventListener("click"'),
      clientSource.indexOf('const confirmBtn = document.createElement("button")'),
    ),
    /finishStudioDecision/,
  );
});

test("a missing browser chooser leaves the import dialog usable", () => {
  assert.match(clientSource, /fileInput\.click\(\)/);
  assert.match(clientSource, /enter the file path and select Import from path/i);
  assert.match(clientSource, /studioImportDecisionOpen = true/);
  assert.match(clientSource, /if \(studioImportDecisionOpen\) finishStudioDecision\(null\)/);
});

test("path import is authenticated, bounded, and rejects binary files", () => {
  assert.match(indexSource, /const STUDIO_IMPORT_FILE_MAX_BYTES = 10_000_000/);
  assert.match(indexSource, /async function handleImportStudioFileCopyRequest\(/);
  assert.match(indexSource, /stats\.size > STUDIO_IMPORT_FILE_MAX_BYTES/);
  assert.match(indexSource, /const file = readStudioFile\(resolved\.resolved, studioCwd\)/);
  assert.match(indexSource, /requestUrl\.pathname === "\/import-file-copy"/);
  assert.match(indexSource, /handleImportStudioFileCopyRequest\(req, res, studioCwd\)/);
  assert.match(clientSource, /fetchStudioJson\("\/import-file-copy", \{/);
  assert.match(clientSource, /body: JSON\.stringify\(\{ path \}\)/);
});

test("both import actions create the same detached editor copy", () => {
  assert.match(clientSource, /function applyImportedFileCopy\(text, filename\)/);
  assert.match(clientSource, /source: "upload",\s*label: "imported copy: " \+ name,\s*path: null/);
  assert.match(clientSource, /fileInput\.addEventListener\("change", \(\) => \{/);
  assert.match(clientSource, /const reader = new FileReader\(\)/);
  assert.match(clientSource, /applyImportedFileCopy\(text, file\.name\)/);
  assert.match(clientSource, /reader\.readAsText\(file\)/);
  assert.match(clientSource, /applyImportedFileCopy\(payload\.text, typeof payload\.filename === "string" \? payload\.filename : path\)/);
});

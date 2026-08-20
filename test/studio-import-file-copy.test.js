import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const indexSource = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../client/studio.css", import.meta.url), "utf8");

test("Import file copy uses a button with native-browser and Muxy path modes", () => {
  assert.match(indexSource, /data-muxy-session="\$\{initialMuxySession\}"/);
  assert.match(indexSource, /<button id="importFileBtn"[^>]*>Import file copy…<\/button>/);
  assert.match(indexSource, /<input id="fileInput" class="file-input-hidden" type="file"/);
  assert.match(cssSource, /\.file-input-hidden \{\s*display: none !important;/);
  assert.ok(clientSource.includes("const isEmbeddedWebKitBrowser = /AppleWebKit\\//i.test(studioUserAgent)"));
  assert.match(clientSource, /document\.body\.dataset\.muxySession === "1"\s*&& isEmbeddedWebKitBrowser/);
  assert.match(clientSource, /if \(useServerPathFileImport\) \{\s*void importStudioFileCopyByPath\(\)/);
  assert.match(clientSource, /fileInput\.click\(\)/);
});

test("Muxy path import is authenticated, bounded, and rejects binary files", () => {
  assert.match(indexSource, /const STUDIO_IMPORT_FILE_MAX_BYTES = 10_000_000/);
  assert.match(indexSource, /async function handleImportStudioFileCopyRequest\(/);
  assert.match(indexSource, /stats\.size > STUDIO_IMPORT_FILE_MAX_BYTES/);
  assert.match(indexSource, /const file = readStudioFile\(resolved\.resolved, studioCwd\)/);
  assert.match(indexSource, /requestUrl\.pathname === "\/import-file-copy"/);
  assert.match(indexSource, /handleImportStudioFileCopyRequest\(req, res, studioCwd\)/);
  assert.match(clientSource, /fetchStudioJson\("\/import-file-copy", \{/);
  assert.match(clientSource, /body: JSON\.stringify\(\{ path \}\)/);
});

test("both import modes create the same detached editor copy", () => {
  assert.match(clientSource, /function applyImportedFileCopy\(text, filename\)/);
  assert.match(clientSource, /source: "upload",\s*label: "imported copy: " \+ name,\s*path: null/);
  assert.match(clientSource, /fileInput\.addEventListener\("change", \(\) => \{/);
  assert.match(clientSource, /const reader = new FileReader\(\)/);
  assert.match(clientSource, /applyImportedFileCopy\(text, file\.name\)/);
  assert.match(clientSource, /reader\.readAsText\(file\)/);
  assert.match(clientSource, /applyImportedFileCopy\(payload\.text, typeof payload\.filename === "string" \? payload\.filename : path\)/);
});

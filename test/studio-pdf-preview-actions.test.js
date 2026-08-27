import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const serverSource = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../client/studio.css", import.meta.url), "utf8");

test("PDF cards and the focus viewer expose browser, system, and folder actions", () => {
  assert.ok((clientSource.match(/textContent = "Browser tab"/g) || []).length >= 2);
  assert.ok((clientSource.match(/textContent = "System viewer"/g) || []).length >= 2);
  assert.ok((clientSource.match(/textContent = "Show in folder"/g) || []).length >= 2);
  assert.ok((clientSource.match(/textContent = "Copy path"/g) || []).length >= 2);
  assert.match(clientSource, /setAttribute\("aria-label", "Enlarge PDF"\)/);
  assert.match(clientSource, /createTextNode\("Enlarge"\)/);
  assert.match(clientSource, /runStudioPdfLocalAction\("system-viewer", resourceQuery\)/);
  assert.match(clientSource, /runStudioPdfLocalAction\("reveal", resourceQuery\)/);
  assert.match(clientSource, /copyStudioPdfResourcePath\(resourceQuery\)/);
  assert.match(clientSource, /computer running Pi/);
  assert.match(clientSource, /studioPdfFocusResourceQuery = normalizeStudioPdfResourceQuery\(resourceQuery\)/);
  assert.match(clientSource, /openStudioPdfFocusViewer\(viewerUrl, downloadName, null, resourceQuery\)/);
});

test("local PDF actions use authenticated boundary-checked server routes", () => {
  assert.match(clientSource, /const endpoint = openInSystemViewer \? "\/open-local-resource" : "\/reveal-local-resource"/);
  assert.match(clientSource, /reveal-local-resource\|open-local-resource/);
  assert.match(serverSource, /async function handleOpenLocalPreviewResourceRequest\(/);
  assert.match(serverSource, /const resource = resolveStudioLocalPreviewResourcePath\(/);
  assert.match(serverSource, /if \(resource\.kind !== "pdf"\)/);
  assert.match(serverSource, /await openPathInDefaultViewer\(resource\.filePath\)/);
  assert.match(serverSource, /requestUrl\.pathname === "\/open-local-resource"/);
  assert.match(serverSource, /Invalid or expired studio token/);
});

test("PDF cards and the focus viewer expose synchronized auto-refresh controls", () => {
  assert.ok((clientSource.match(/textContent = "Auto-refresh"/g) || []).length >= 3);
  assert.doesNotMatch(clientSource, /Auto-refresh: (?:On|Off)/);
  assert.match(clientSource, /studio-pdf-card-auto-refresh/);
  assert.match(clientSource, /studio-pdf-focus-auto-refresh/);
  assert.match(clientSource, /setStudioPdfFocusAutoRefreshSource\(sourceCard, studioPdfFocusResourceQuery\)/);
  assert.match(clientSource, /studioPdfFocusSourceCard === card/);
  assert.match(clientSource, /PDF changed on disk; refreshed preview\./);
  assert.match(clientSource, /active \? "Disable PDF auto-refresh" : "Enable PDF auto-refresh"/);

  const cardActiveRule = cssSource.match(/\.rendered-markdown button\.studio-pdf-card-auto-refresh\[aria-pressed="true"\] \{([\s\S]*?)\}/)?.[1] || "";
  const focusActiveRule = cssSource.match(/\.studio-pdf-focus-auto-refresh\[aria-pressed="true"\] \{([\s\S]*?)\}/)?.[1] || "";
  for (const activeRule of [cardActiveRule, focusActiveRule]) {
    assert.match(activeRule, /background: transparent;/);
    assert.match(activeRule, /color: var\(--accent\);/);
    assert.match(activeRule, /border-color: transparent;/);
    assert.doesNotMatch(activeRule, /accent-soft/);
  }
});

test("PDF auto-refresh polls authenticated metadata only while visible and waits for stability", () => {
  assert.match(clientSource, /method: "HEAD",\s*cache: "no-store"/);
  assert.match(clientSource, /document\.hidden \|\| document\.visibilityState === "hidden"/);
  assert.match(clientSource, /STUDIO_PDF_AUTO_REFRESH_STABLE_OBSERVATIONS/);
  assert.match(clientSource, /previewResourceHelpers\.observeStudioPdfVersion\(/);
  assert.match(clientSource, /state\.generation !== generation/);
  assert.match(clientSource, /if \(!options \|\| !options\.silent\) state\.refresh\(\)/);

  const responderStart = serverSource.indexOf("function respondPdfFile(");
  const responderEnd = serverSource.indexOf("function respondHtmlPreviewResourceJson", responderStart);
  assert.ok(responderStart >= 0 && responderEnd > responderStart);
  const responderSource = serverSource.slice(responderStart, responderEnd);
  assert.match(responderSource, /const stats = statSync\(filePath\)/);
  assert.match(responderSource, /"ETag": etag/);
  assert.match(responderSource, /"Last-Modified": stats\.mtime\.toUTCString\(\)/);
  assert.ok(
    responderSource.indexOf('if (method === "HEAD")') < responderSource.indexOf("const pdf = readFileSync(filePath)"),
    "HEAD checks should not read the PDF body",
  );
});

test("PDF manual refresh uses a browser-safe Studio shortcut", () => {
  assert.match(clientSource, /Cmd\/Ctrl\+Alt\+R/);
  assert.match(clientSource, /function handleStudioPdfRefreshShortcut\(event\)/);
  assert.match(clientSource, /\(event\.metaKey \|\| event\.ctrlKey\)[\s\S]*?event\.altKey[\s\S]*?!event\.shiftKey/);
  assert.match(clientSource, /refreshVisibleStudioPdfPreviews\(\)/);
  assert.match(serverSource, /<dt>Cmd\/Ctrl\+Alt\+R<\/dt><dd>Refresh the focused or visible PDF preview from disk<\/dd>/);
});

test("PDF action rows wrap instead of overflowing narrow preview panes", () => {
  assert.match(cssSource, /\.rendered-markdown \.studio-pdf-card-header \{[\s\S]*?flex-wrap: wrap;/);
  assert.match(cssSource, /\.rendered-markdown \.studio-pdf-card-actions \{[\s\S]*?flex-wrap: wrap;/);
  assert.match(cssSource, /\.studio-pdf-focus-header \{[\s\S]*?flex-wrap: wrap;/);
  assert.match(cssSource, /\.studio-pdf-focus-actions \{[\s\S]*?flex-wrap: wrap;/);
});

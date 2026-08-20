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
  assert.match(clientSource, /runStudioPdfLocalAction\("system-viewer", resourceQuery\)/);
  assert.match(clientSource, /runStudioPdfLocalAction\("reveal", resourceQuery\)/);
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

test("PDF action rows wrap instead of overflowing narrow preview panes", () => {
  assert.match(cssSource, /\.rendered-markdown \.studio-pdf-card-header \{[\s\S]*?flex-wrap: wrap;/);
  assert.match(cssSource, /\.rendered-markdown \.studio-pdf-card-actions \{[\s\S]*?flex-wrap: wrap;/);
  assert.match(cssSource, /\.studio-pdf-focus-header \{[\s\S]*?flex-wrap: wrap;/);
  assert.match(cssSource, /\.studio-pdf-focus-actions \{[\s\S]*?flex-wrap: wrap;/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  parseStudioLocalPreviewPage,
  parseStudioPdfLaunchTarget,
} from "../shared/studio-local-preview-path.js";

const indexSource = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
const readmeSource = readFileSync(new URL("../README.md", import.meta.url), "utf8");


test("PDF launch targets accept local paths and preserve initial page hints", () => {
  assert.deepEqual(parseStudioPdfLaunchTarget("paper.pdf"), { path: "paper.pdf", page: null });
  assert.deepEqual(parseStudioPdfLaunchTarget("reports/My Paper.PDF#page=4"), {
    path: "reports/My Paper.PDF",
    page: 4,
  });
  assert.deepEqual(parseStudioPdfLaunchTarget("/tmp/paper.pdf?p=7"), {
    path: "/tmp/paper.pdf",
    page: 7,
  });
  assert.deepEqual(parseStudioPdfLaunchTarget("C:\\docs\\paper.pdf?download=1#zoom=fit&page=12"), {
    path: "C:\\docs\\paper.pdf",
    page: 12,
  });
  assert.equal(parseStudioLocalPreviewPage("paper.pdf?page=3#page=9"), 3);
});


test("PDF launch targets reject non-PDF and non-local resources", () => {
  assert.equal(parseStudioPdfLaunchTarget("notes.md"), null);
  assert.equal(parseStudioPdfLaunchTarget("notes.pdf.txt"), null);
  assert.equal(parseStudioPdfLaunchTarget("https://example.test/paper.pdf"), null);
  assert.equal(parseStudioPdfLaunchTarget("//server/share/paper.pdf"), null);
  assert.equal(parseStudioPdfLaunchTarget("paper.pdf#page=0")?.page, null);
});


test("Studio dispatches PDF paths before text decoding into an isolated companion preview", () => {
  const resolverStart = indexSource.indexOf("const resolveStudioLaunchDocument = (");
  const resolverEnd = indexSource.indexOf("const resolveLastModelResponseForExport", resolverStart);
  assert.ok(resolverStart >= 0 && resolverEnd > resolverStart);
  const resolverSource = indexSource.slice(resolverStart, resolverEnd);

  assert.ok(
    resolverSource.indexOf("parseStudioPdfLaunchTarget") < resolverSource.indexOf("readStudioFile(pathArg"),
    "PDF paths should dispatch before binary text-file decoding",
  );
  assert.match(resolverSource, /document: buildStudioLocalResourcePreviewDocument\(resource\)/);
  assert.match(resolverSource, /kind: "pdf-preview",[\s\S]*?mode: "editor-only",[\s\S]*?transient: true,[\s\S]*?skipWorkspaceRestore: true,[\s\S]*?paneFocus: "right"/);
  assert.match(indexSource, /\+ \(resource\.page \? `page: \$\{resource\.page\}\\n` : ""\)/);

  const launcherStart = indexSource.indexOf("const openStudioView = async (");
  const launcherEnd = indexSource.indexOf('pi.registerCommand("studio"', launcherStart);
  assert.ok(launcherStart >= 0 && launcherEnd > launcherStart);
  const launcherSource = indexSource.slice(launcherStart, launcherEnd);
  assert.ok(
    launcherSource.indexOf("const launchesPdfPreview") < launcherSource.indexOf("hasConnectedFullStudioView"),
    "the PDF companion mode must be known before enforcing the full-view singleton",
  );
  assert.ok(
    launcherSource.indexOf("resolveStudioLaunchDocument") > launcherSource.indexOf("hasConnectedFullStudioView"),
    "ordinary files should not be read before an existing full view rejects the launch",
  );
  assert.match(launcherSource, /const requestedLaunchMode: StudioUiMode = launchesPdfPreview \? "editor-only" : mode;/);
  assert.match(launcherSource, /if \(requestedLaunchMode === "full" && hasConnectedFullStudioView\(\)\)/);
  assert.match(launcherSource, /const launchMode = selection\.mode \?\? requestedLaunchMode;/);
  assert.match(launcherSource, /if \(!selection\.transient\) initialStudioDocument = selected;/);
  assert.match(launcherSource, /selection\.transient \? storeTransientStudioDocument\(selected\) : undefined/);
  assert.match(launcherSource, /skipWorkspaceRestore: selection\.skipWorkspaceRestore,[\s\S]*?paneFocus: selection\.paneFocus/);
});


test("command help distinguishes PDF viewing from PDF export", () => {
  assert.match(indexSource, /Open a text file in Studio, or a PDF in a read-only companion preview/);
  assert.match(indexSource, /only one full \/studio view is allowed per Pi session; PDF previews open as companions/);
  assert.match(readmeSource, /run `\/studio report\.pdf`/);
  assert.match(readmeSource, /distinct from `\/studio-pdf`, which exports/);
});

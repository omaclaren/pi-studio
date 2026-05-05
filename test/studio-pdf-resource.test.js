import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveStudioPdfResourceFile } from "../shared/studio-pdf-resource.js";

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), "pi-studio-pdf-resource-"));
}

test("resolveStudioPdfResourceFile resolves relative PDFs inside the resource directory", () => {
  const dir = makeTempDir();
  try {
    mkdirSync(join(dir, "attachments"));
    const pdfPath = join(dir, "attachments", "paper.pdf");
    writeFileSync(pdfPath, "%PDF-1.4\n");

    assert.equal(resolveStudioPdfResourceFile("attachments/paper.pdf", dir), realpathSync(pdfPath));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("resolveStudioPdfResourceFile accepts absolute PDFs inside the resource directory", () => {
  const dir = makeTempDir();
  try {
    const pdfPath = join(dir, "paper.pdf");
    writeFileSync(pdfPath, "%PDF-1.4\n");

    assert.equal(resolveStudioPdfResourceFile(pdfPath, dir), realpathSync(pdfPath));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("resolveStudioPdfResourceFile rejects URLs and non-PDF paths", () => {
  const dir = makeTempDir();
  try {
    const txtPath = join(dir, "paper.txt");
    writeFileSync(txtPath, "not a pdf");

    assert.throws(() => resolveStudioPdfResourceFile("https://example.com/paper.pdf", dir), /Only local PDF paths/);
    assert.throws(() => resolveStudioPdfResourceFile("paper.txt", dir), /Only \.pdf files/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("resolveStudioPdfResourceFile rejects traversal and symlinks outside the resource directory", () => {
  const dir = makeTempDir();
  const outside = makeTempDir();
  try {
    const outsidePdf = join(outside, "secret.pdf");
    writeFileSync(outsidePdf, "%PDF-1.4\n");
    symlinkSync(outsidePdf, join(dir, "linked.pdf"));

    assert.throws(() => resolveStudioPdfResourceFile("../secret.pdf", dir), /unavailable|no such file|ENOENT/i);
    assert.throws(() => resolveStudioPdfResourceFile(join(outside, "secret.pdf"), dir), /must stay within/);
    assert.throws(() => resolveStudioPdfResourceFile("linked.pdf", dir), /must stay within/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

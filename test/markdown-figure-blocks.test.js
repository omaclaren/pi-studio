import test from "node:test";
import assert from "node:assert/strict";

import "../client/studio-annotation-helpers.js";

const helpers = globalThis.PiStudioAnnotationHelpers;

if (!helpers) {
  throw new Error("PiStudioAnnotationHelpers did not load for tests.");
}

test("extractStandaloneMarkdownImageCaptionText detects standalone markdown image paragraphs", () => {
  assert.equal(
    helpers.extractStandaloneMarkdownImageCaptionText("![Fourier square wave reconstruction](assets/demo/figures/fourier-square-wave.png)"),
    "Fourier square wave reconstruction",
  );
  assert.equal(
    helpers.extractStandaloneMarkdownImageCaptionText(" ![Caption with parens](assets/demo/figures/plot(v2).png) "),
    "Caption with parens",
  );
  assert.equal(
    helpers.extractStandaloneMarkdownImageCaptionText("![](assets/demo/figures/heat-equation-smoothing.png)"),
    "",
  );
  assert.equal(
    helpers.extractStandaloneMarkdownImageCaptionText("![Caption](figure.png){#fig:demo width=70%}"),
    "Caption",
  );
  assert.equal(
    helpers.extractStandaloneMarkdownImageCaptionText("![First](a.png) ![Second](b.png)"),
    "First Second",
  );
});

test("extractStandaloneMarkdownImageCaptionText rejects non-figure paragraphs", () => {
  assert.equal(
    helpers.extractStandaloneMarkdownImageCaptionText("Before ![caption](figure.png) after"),
    null,
  );
  assert.equal(
    helpers.extractStandaloneMarkdownImageCaptionText("![caption](figure.png)\nextra prose"),
    null,
  );
  assert.equal(
    helpers.extractStandaloneMarkdownImageCaptionText("`![caption](figure.png)`"),
    null,
  );
});

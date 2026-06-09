import test from "node:test";
import assert from "node:assert/strict";

import { renderStudioAnnotationInlineHtml } from "../shared/studio-annotation-render.js";

test("renderStudioAnnotationInlineHtml supports annotation inline Markdown safely", () => {
  assert.equal(
    renderStudioAnnotationInlineHtml("keep *focus* and **tone** plus ~~cut~~ and `npm test`"),
    "keep <em>focus</em> and <strong>tone</strong> plus <s>cut</s> and <code>npm test</code>",
  );
  assert.equal(
    renderStudioAnnotationInlineHtml("~~cut *this*~~"),
    "<s>cut <em>this</em></s>",
  );
});

test("renderStudioAnnotationInlineHtml keeps links, URLs, math, and unsafe HTML literal", () => {
  assert.equal(
    renderStudioAnnotationInlineHtml("use [docs](https://example.com/docs) and https://example.com/docs"),
    "use [docs](https://example.com/docs) and https://example.com/docs",
  );
  assert.equal(
    renderStudioAnnotationInlineHtml("$\\mathbb{R}$ *here*"),
    "$\\mathbb{R}$ <em>here</em>",
  );
  assert.equal(
    renderStudioAnnotationInlineHtml("<script>alert(1)</script> ~~no~~"),
    "&lt;script&gt;alert(1)&lt;/script&gt; <s>no</s>",
  );
});

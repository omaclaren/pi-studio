import test from "node:test";
import assert from "node:assert/strict";

import { stripStudioMarkdownHtmlComments } from "../shared/studio-markdown-html-comments.js";

test("stripStudioMarkdownHtmlComments removes multiline HTML comments outside fences", () => {
  const markdown = [
    "Before",
    "",
    "<!-- ",
    "",
    "This is a multi-line",
    "comment in Markdown.",
    "",
    "-->",
    "",
    "After",
  ].join("\n");

  const stripped = stripStudioMarkdownHtmlComments(markdown);

  assert.equal(stripped.includes("<!--"), false);
  assert.equal(stripped.includes("This is a multi-line"), false);
  assert.equal(stripped.includes("-->"), false);
  assert.match(stripped, /^Before\n(?:\n)*After$/);
});

test("stripStudioMarkdownHtmlComments leaves fenced code literals untouched", () => {
  const markdown = [
    "Before",
    "",
    "```html",
    "<!-- keep me -->",
    "```",
    "",
    "After",
  ].join("\n");

  assert.equal(stripStudioMarkdownHtmlComments(markdown), markdown);
});

test("stripStudioMarkdownHtmlComments leaves inline-code HTML comment literals untouched", () => {
  const markdown = "Use `<!-- literal -->` here.\n\n<!-- remove me -->\n";
  const stripped = stripStudioMarkdownHtmlComments(markdown);

  assert.equal(stripped.includes("`<!-- literal -->`"), true);
  assert.equal(stripped.includes("remove me"), false);
});

test("stripStudioMarkdownHtmlComments still strips comments after unmatched backticks on earlier lines", () => {
  const markdown = [
    "- choose the `smallest' solution here",
    "",
    "<!--",
    "hidden trailing comment",
    "-->",
    "",
  ].join("\n");

  const stripped = stripStudioMarkdownHtmlComments(markdown);

  assert.equal(stripped.includes("hidden trailing comment"), false);
  assert.equal(stripped.includes("`smallest' solution here"), true);
});

import test from "node:test";
import assert from "node:assert/strict";

import { preserveLiteralLatexCommandsInMarkdown } from "../shared/studio-markdown-latex-literals.js";

test("preserveLiteralLatexCommandsInMarkdown leaves dollar-delimited inline math unchanged", () => {
  const markdown = "Inline math $\\alpha + \\beta$ stays math.";

  assert.equal(preserveLiteralLatexCommandsInMarkdown(markdown), markdown);
});

test("preserveLiteralLatexCommandsInMarkdown leaves parenthesis-delimited inline math unchanged", () => {
  const markdown = "Inline math \\(x^2 + y^2\\) stays math.";

  assert.equal(preserveLiteralLatexCommandsInMarkdown(markdown), markdown);
});

test("preserveLiteralLatexCommandsInMarkdown leaves display math unchanged", () => {
  const markdown = [
    "Before",
    "",
    "$$",
    "\\alpha + \\beta = \\gamma",
    "$$",
    "",
    "After",
  ].join("\n");

  assert.equal(preserveLiteralLatexCommandsInMarkdown(markdown), markdown);
});

test("preserveLiteralLatexCommandsInMarkdown preserves literal citation and reference commands in prose", () => {
  const markdown = "prediction~\\cite{A,B} and see \\ref{eq:x} and \\eqref{eq:y}.";

  assert.equal(
    preserveLiteralLatexCommandsInMarkdown(markdown),
    "prediction~\\\\cite{A,B} and see \\\\ref{eq:x} and \\\\eqref{eq:y}.",
  );
});

test("preserveLiteralLatexCommandsInMarkdown leaves inline code and fenced code literals untouched", () => {
  const markdown = [
    "Use `\\cite{KeepMe}` here.",
    "",
    "```tex",
    "\\ref{literal}",
    "```",
  ].join("\n");

  assert.equal(preserveLiteralLatexCommandsInMarkdown(markdown), markdown);
});

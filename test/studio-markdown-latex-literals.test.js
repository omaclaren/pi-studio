import test from "node:test";
import assert from "node:assert/strict";

import {
  extractStandaloneLatexDefinitionsFromMarkdown,
  preserveLiteralLatexCommandsInMarkdown,
} from "../shared/studio-markdown-latex-literals.js";

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

test("preserveLiteralLatexCommandsInMarkdown leaves standalone markdown math macro definitions untouched", () => {
  const markdown = [
    "\\newcommand{\\RR}{\\mathbb{R}}",
    "\\DeclareMathOperator*{\\argmax}{arg\\,max}",
    "\\def\\vect#1{\\boldsymbol{#1}}",
    "",
    "We optimize $f : \\RR^n \\to \\RR$ by $x^*=\\argmax_{x\\in\\RR^n} f(\\vect{x})$.",
  ].join("\n");

  assert.equal(preserveLiteralLatexCommandsInMarkdown(markdown), markdown);
});

test("preserveLiteralLatexCommandsInMarkdown still escapes literal macro-definition commands when used in prose", () => {
  const markdown = "Write \\newcommand{\\RR}{\\mathbb{R}} in the notes, do not execute it.";

  assert.equal(
    preserveLiteralLatexCommandsInMarkdown(markdown),
    "Write \\\\newcommand{\\RR}{\\mathbb{R}} in the notes, do not execute it.",
  );
});

test("extractStandaloneLatexDefinitionsFromMarkdown moves standalone macro lines into a preamble bucket", () => {
  const markdown = [
    "\\DeclareMathOperator{\\nullspace}{null}",
    "\\DeclareMathOperator{\\rowspace}{row}",
    "",
    "Let $N=\\nullspace(A)$ and $R=\\rowspace(A)$.",
  ].join("\n");

  assert.deepEqual(extractStandaloneLatexDefinitionsFromMarkdown(markdown), {
    body: [
      "",
      "Let $N=\\nullspace(A)$ and $R=\\rowspace(A)$.",
    ].join("\n"),
    definitions: [
      "\\DeclareMathOperator{\\nullspace}{null}",
      "\\DeclareMathOperator{\\rowspace}{row}",
    ],
    preamble: [
      "\\DeclareMathOperator{\\nullspace}{null}",
      "\\DeclareMathOperator{\\rowspace}{row}",
    ].join("\n"),
  });
});

test("extractStandaloneLatexDefinitionsFromMarkdown leaves fenced literal definitions in the body", () => {
  const markdown = [
    "```tex",
    "\\DeclareMathOperator{\\nullspace}{null}",
    "```",
    "",
    "Literal docs.",
  ].join("\n");

  assert.deepEqual(extractStandaloneLatexDefinitionsFromMarkdown(markdown), {
    body: markdown,
    definitions: [],
    preamble: "",
  });
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

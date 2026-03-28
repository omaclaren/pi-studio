import test from "node:test";
import assert from "node:assert/strict";

import { escapeStudioPdfLatexTextFragment } from "../shared/studio-pdf-escape.js";

test("escapeStudioPdfLatexTextFragment escapes literal backslashes without corrupting inserted LaTeX macros", () => {
  assert.equal(
    escapeStudioPdfLatexTextFragment("prefer \\`npm test\\` here"),
    "prefer \\textbackslash{}\\textasciigrave{}npm test\\textbackslash{}\\textasciigrave{} here",
  );
});

test("escapeStudioPdfLatexTextFragment still escapes standard LaTeX-sensitive characters", () => {
  assert.equal(
    escapeStudioPdfLatexTextFragment("{a}_b % c & d ~ e ^ f"),
    "\\{a\\}\\_b \\% c \\& d \\textasciitilde{} e \\textasciicircum{} f",
  );
});

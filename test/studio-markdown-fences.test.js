import test from "node:test";
import assert from "node:assert/strict";
import { normalizeStudioMarkdownSmartFences } from "../shared/studio-markdown-fences.js";

test("normalizeStudioMarkdownSmartFences repairs smart-quoted code fences", () => {
  const markdown = [
    "- The CAS wrapper uses:",
    "‘‘‘tex",
    "\\documentclass[a4paper,fleqn]{cas-sc}",
    "‘‘‘",
    "",
    "after",
  ].join("\n");

  assert.equal(
    normalizeStudioMarkdownSmartFences(markdown),
    [
      "- The CAS wrapper uses:",
      "```tex",
      "\\documentclass[a4paper,fleqn]{cas-sc}",
      "```",
      "",
      "after",
    ].join("\n"),
  );
});

test("normalizeStudioMarkdownSmartFences leaves normal prose quotes alone", () => {
  const markdown = "This sentence uses ‘smart quotes’ but is not a fence.";
  assert.equal(normalizeStudioMarkdownSmartFences(markdown), markdown);
});

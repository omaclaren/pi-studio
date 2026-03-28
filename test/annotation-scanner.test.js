import test from "node:test";
import assert from "node:assert/strict";

import {
  collectStudioInlineAnnotationMarkers,
  hasStudioMarkdownAnnotationMarkers,
  normalizeStudioAnnotationText,
  replaceStudioInlineAnnotationMarkers,
  transformStudioMarkdownOutsideFences,
} from "../shared/studio-annotation-scanner.js";

test("shared annotation scanner matches markdown-ish markers without breaking on links or code", () => {
  const text = "A [an: use [docs](https://example.com/docs)] and [an: prefer `npm test` here] plus `[an: literal]`.";
  const markers = collectStudioInlineAnnotationMarkers(text);

  assert.deepEqual(
    markers.map((marker) => marker.body),
    [
      "use [docs](https://example.com/docs)",
      "prefer `npm test` here",
    ],
  );
  assert.equal(hasStudioMarkdownAnnotationMarkers(text), true);
  assert.equal(hasStudioMarkdownAnnotationMarkers("Literal `[an: note]` sample"), false);
});

test("shared annotation scanner does not desync after inline-code literal examples", () => {
  const mixed = "- `[an: prefer \\`npm test\\` here]`\n- [an: keep *focus* and _tone_!]";
  const markers = collectStudioInlineAnnotationMarkers(mixed);

  assert.deepEqual(markers.map((marker) => marker.body), ["keep *focus* and _tone_!"]);
});

test("shared annotation scanner replacement can wrap multiple markers while leaving fenced literals untouched", () => {
  const markdown = [
    "Before [an: first] and [an: second [docs](https://example.com/second)].",
    "",
    "```md",
    "[an: literal [docs](https://example.com/literal)]",
    "```",
  ].join("\n");

  const replaced = transformStudioMarkdownOutsideFences(markdown, (segment) => {
    return replaceStudioInlineAnnotationMarkers(
      segment,
      (marker) => `{ANNOT:${normalizeStudioAnnotationText(marker.body)}}`,
    );
  });

  assert.equal(
    replaced,
    [
      "Before {ANNOT:first} and {ANNOT:second [docs](https://example.com/second)}.",
      "",
      "```md",
      "[an: literal [docs](https://example.com/literal)]",
      "```",
    ].join("\n"),
  );
});

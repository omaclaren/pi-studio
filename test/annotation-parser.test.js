import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import "../client/studio-annotation-helpers.js";

const helpers = globalThis.PiStudioAnnotationHelpers;

if (!helpers) {
  throw new Error("PiStudioAnnotationHelpers did not load for tests.");
}

test("collectInlineAnnotationMarkers keeps markdown-ish annotation bodies intact", async (t) => {
  const cases = [
    {
      name: "simple annotation",
      input: "Simple [an: note]",
      expectedBodies: ["note"],
      expectedRaw: ["[an: note]"],
    },
    {
      name: "bare URL inside annotation",
      input: "Bare URL [an: see https://example.com/docs?a=1&b=2]",
      expectedBodies: ["see https://example.com/docs?a=1&b=2"],
      expectedRaw: ["[an: see https://example.com/docs?a=1&b=2]"],
    },
    {
      name: "markdown link inside annotation",
      input: "Markdown link [an: use [docs](https://example.com/docs)]",
      expectedBodies: ["use [docs](https://example.com/docs)"],
      expectedRaw: ["[an: use [docs](https://example.com/docs)]"],
    },
    {
      name: "inline code inside annotation",
      input: "Inline code [an: prefer `npm test` here]",
      expectedBodies: ["prefer `npm test` here"],
      expectedRaw: ["[an: prefer `npm test` here]"],
    },
    {
      name: "emphasis markers inside annotation",
      input: "Emphasis [an: keep *focus* and _tone_]",
      expectedBodies: ["keep *focus* and _tone_"],
      expectedRaw: ["[an: keep *focus* and _tone_]"],
    },
    {
      name: "multiple annotations on one line",
      input: "Multiple [an: first] markers [an: second [docs](https://example.com/second)] here.",
      expectedBodies: ["first", "second [docs](https://example.com/second)"],
      expectedRaw: ["[an: first]", "[an: second [docs](https://example.com/second)]"],
    },
    {
      name: "annotation-like text inside inline code stays literal",
      input: "Literal `[an: prefer \\`npm test\\` here]` sample",
      expectedBodies: [],
      expectedRaw: [],
    },
  ];

  for (const entry of cases) {
    await t.test(entry.name, () => {
      const markers = helpers.collectInlineAnnotationMarkers(entry.input);
      assert.deepEqual(markers.map((marker) => marker.body), entry.expectedBodies);
      assert.deepEqual(markers.map((marker) => marker.raw), entry.expectedRaw);
    });
  }
});

test("renderPreviewAnnotationHtml supports safe inline emphasis and code without activating links", () => {
  assert.equal(
    helpers.renderPreviewAnnotationHtml("keep *focus* and **tone** plus `npm test`"),
    "keep <em>focus</em> and <strong>tone</strong> plus <code>npm test</code>",
  );
  assert.equal(
    helpers.renderPreviewAnnotationHtml("$\\mathbb{R}$ *here*"),
    "$\\mathbb{R}$ <em>here</em>",
  );
  assert.equal(
    helpers.renderPreviewAnnotationHtml("use [docs](https://example.com/docs) and https://example.com/docs"),
    "use [docs](https://example.com/docs) and https://example.com/docs",
  );
});

test("prepareMarkdownForPandocPreview replaces only real annotations and leaves fenced code untouched", async () => {
  const fixture = await readFile(new URL("./fixtures/annotation-markdownish.md", import.meta.url), "utf8");
  const prepared = helpers.prepareMarkdownForPandocPreview(fixture, "TESTANNOT");

  assert.equal(prepared.placeholders.length, 7);
  assert.deepEqual(
    prepared.placeholders.map((entry) => entry.text),
    [
      "note",
      "see https://example.com/docs?a=1&b=2",
      "use [docs](https://example.com/docs)",
      "prefer `npm test` here",
      "keep *focus* and _tone_",
      "first",
      "second [docs](https://example.com/second)",
    ],
  );
  assert.ok(prepared.markdown.includes("TESTANNOT0TOKEN"));
  assert.ok(prepared.markdown.includes("TESTANNOT6TOKEN"));
  assert.match(prepared.markdown, /```md\n\[an: literal \[docs\]\(https:\/\/example\.com\/literal\)\] should stay literal inside fenced code\n```/);
  const proseSection = prepared.markdown.split("```md")[0];
  assert.equal(proseSection.includes("[an:"), false);
});

test("prepareMarkdownForPandocPreview leaves inline-code annotation examples untouched and does not desync later parsing", () => {
  const mixed = "- `[an: prefer \\`npm test\\` here]`\n- [an: keep *focus* and _tone_!]";
  const prepared = helpers.prepareMarkdownForPandocPreview(mixed, "TESTANNOT");

  assert.equal(prepared.placeholders.length, 1);
  assert.deepEqual(prepared.placeholders.map((entry) => entry.text), ["keep *focus* and _tone_!"]);
  assert.equal(prepared.markdown, "- `[an: prefer \\`npm test\\` here]`\n- TESTANNOT0TOKEN");
});

test("prepareMarkdownForPandocPreview leaves fully inline-code annotation examples untouched", () => {
  const literalExamples = "- `[an: prefer \\`npm test\\` here]`\n- `[an: keep *focus* and _tone_!]`";
  const prepared = helpers.prepareMarkdownForPandocPreview(literalExamples, "TESTANNOT");

  assert.equal(prepared.placeholders.length, 0);
  assert.equal(prepared.markdown, literalExamples);
});

test("stripAnnotationMarkers hides annotations outside fences without touching fenced or inline-code literals", async () => {
  const fixture = await readFile(new URL("./fixtures/annotation-markdownish.md", import.meta.url), "utf8");
  const stripped = helpers.stripAnnotationMarkers(fixture);
  const inlineCodeLiteral = "Literal `[an: prefer \\`npm test\\` here]` sample";

  assert.equal(helpers.hasAnnotationMarkers(fixture), true);
  assert.equal(helpers.hasAnnotationMarkers(stripped), false);
  assert.equal(helpers.hasAnnotationMarkers(inlineCodeLiteral), false);
  assert.equal(helpers.stripAnnotationMarkers(inlineCodeLiteral), inlineCodeLiteral);
  assert.equal(
    stripped,
    "Simple \n"
      + "Bare URL \n"
      + "Markdown link \n"
      + "Inline code \n"
      + "Emphasis \n"
      + "Multiple  markers  here.\n"
      + "\n"
      + "```md\n"
      + "[an: literal [docs](https://example.com/literal)] should stay literal inside fenced code\n"
      + "```\n",
  );
});

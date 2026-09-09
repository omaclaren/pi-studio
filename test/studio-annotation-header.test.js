import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import "../client/studio-annotation-helpers.js";

const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const helpers = globalThis.PiStudioAnnotationHelpers;
const openers = ["annotations below", "annotations below:", "annotated reply: below", "annotated reply below:"];
const precedence = "precedence: later messages supersede these annotations unless user explicitly references them";
const minimal = opener => `${opener}\n\n- user annotation syntax: \`[an: note]\` (user comments on the accompanying selections)\n\n---\n\n`;
const studio = opener => `${opener}\n\n- original source: file /tmp/notes.md\n- user annotation syntax: [an: note]\n- ${precedence}\n\n---\n\n`;
const legacy = opener => `${opener}\noriginal source: last model response\nuser annotation syntax: [an: note]\n${precedence}\n\n---\n\n`;
const footer = "\n\n--- end annotations ---\n\n";

function section(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert(a >= 0 && b > a, "missing source section: " + start);
  return source.slice(a, b);
}

function harness(text = "") {
  const edits = [], statuses = [], summaries = [];
  const c = {
    sourceState: { source: "file", label: "/tmp/notes.md" },
    sourceTextEl: { value: text },
    insertHeaderBtn: { textContent: "", title: "" },
    setEditorText(value, options) { edits.push({ value, options }); c.sourceTextEl.value = value; },
    setStatus(message, kind) { statuses.push({ message, kind }); },
    syncStudioUiRefreshSummaries() { summaries.push(c.getStudioUiRefreshAnnotationHeaderEnabled()); },
    updateResultActionButtons() { c.updateAnnotatedReplyHeaderButton(); },
    isTextEquivalent: (a, b) => a === b,
  };
  vm.createContext(c);
  vm.runInContext(section("function describeSourceForAnnotation()", "function requestLatestResponse()"), c);
  vm.runInContext(section("function getStudioUiRefreshAnnotationHeaderEnabled()", "function syncStudioUiRefreshSummaries()"), c);
  return { c, edits, statuses, summaries };
}

const bodies = ["", "   ", "\r", "Body ending with a bare carriage return\r", "\n\nLeading and trailing whitespace\n\n", "αβ😀\r\n\r\ntext\t",
  "Paragraph\n\n---\n\n[an: Keep this.]\n", "```md\nannotations below:\n---\n```\n"];

test("annotation-header aliases recognise minimal, Studio and plain legacy blocks case-insensitively", () => {
  const h = harness();
  for (const opener of openers.flatMap(value => [value, value.toUpperCase()])) {
    for (const make of [minimal, studio, legacy]) {
      for (const newline of ["\n", "\r\n"]) {
        const header = make(opener).replace(/\n/g, newline);
        for (const body of bodies) {
          const result = h.c.stripAnnotationHeader(header + body);
          assert.equal(result.hadHeader, true, header);
          assert.equal(result.body, body, "only the exact leading block is removed");
        }
      }
    }
  }
});

test("older headers without precedence and the documented syntax placeholder remain compatible", () => {
  const h = harness();
  for (const opener of openers) {
    for (const header of [studio(opener).replace(`- ${precedence}\n`, ""), legacy(opener).replace(`${precedence}\n`, ""),
      studio(opener).replace("[an: note]", "[an: your note]")]) {
      assert.equal(h.c.stripAnnotationHeader(header + "Body\r\n").hadHeader, true);
      assert.equal(h.c.stripAnnotationHeader(header + "Body\r\n").body, "Body\r\n");
    }
  }
});

test("header status, toggle and duplicate prevention use the same recognition", () => {
  for (const opener of openers) {
    for (const make of [minimal, studio, legacy]) {
      const body = "\nUser body [an: note]\n\n";
      const h = harness(make(opener) + body);
      h.c.updateAnnotatedReplyHeaderButton();
      assert.equal(h.c.insertHeaderBtn.textContent, "Annotation header: On");
      assert.equal(h.c.getStudioUiRefreshAnnotationHeaderEnabled(), true);
      assert.deepEqual(h.summaries, [true]);
      h.c.toggleAnnotatedReplyHeader();
      assert.equal(h.c.sourceTextEl.value, body, "toggling off cannot nest a default header around an alias");
      assert.equal(h.c.insertHeaderBtn.textContent, "Annotation header: Off");
      assert.equal(h.c.getStudioUiRefreshAnnotationHeaderEnabled(), false);
      assert.equal(h.edits.length, 1);
      assert.equal(h.edits[0].options.preserveScroll, true);
      assert.equal(h.edits[0].options.preserveSelection, true);
      assert.equal(h.edits[0].options.preservePiEditorDraftLink, true);
    }
  }
});

test("generated default wording is unchanged and repeated toggles preserve the exact body", () => {
  for (const body of [...bodies, "Body" + footer, "--- end annotations ---\n\n", "```md\nUnclosed fence\n", "~~~md\nUnclosed fence\n"]) {
    const h = harness(body);
    assert.equal(h.c.buildAnnotationHeader(), studio("annotated reply: below"));
    for (let repeat = 0; repeat < 2; repeat++) {
      h.c.toggleAnnotatedReplyHeader();
      assert(h.c.sourceTextEl.value.startsWith(studio("annotated reply: below")));
      assert.equal(h.c.getStudioUiRefreshAnnotationHeaderEnabled(), true);
      h.c.toggleAnnotatedReplyHeader();
      assert.equal(h.c.sourceTextEl.value, body, "do not trim body whitespace or unrelated footer-like text");
    }
  }
  const ordinary = harness("Body");
  ordinary.c.toggleAnnotatedReplyHeader();
  assert.equal(ordinary.c.sourceTextEl.value, studio("annotated reply: below") + "Body" + footer);
});

test("prose, quoted/fenced examples and opener prefixes are never recognised as headers", () => {
  const h = harness();
  for (const opener of openers) {
    for (const body of [
      `Please discuss ${opener}\r\n\r\n---\r\n\r\nBody\r\n`,
      minimal(opener).replace(opener, opener + " is a phrase, not a header"),
      "Introductory text\n\n" + minimal(opener) + "Body",
      "> " + minimal(opener).replace(/\n/g, "\n> ") + "Body",
      "```markdown\n" + minimal(opener) + "Body\n```\n",
      "~~~markdown\n" + studio(opener) + "Body\n~~~\n",
      "    " + minimal(opener).replace(/\n/g, "\n    ") + "Body",
      '"' + minimal(opener) + 'Body"',
    ]) {
      const result = h.c.stripAnnotationHeader(body);
      assert.equal(result.hadHeader, false, body);
      assert.equal(result.body, body);
      const toggle = harness(body);
      toggle.c.toggleAnnotatedReplyHeader();
      toggle.c.toggleAnnotatedReplyHeader();
      assert.equal(toggle.c.sourceTextEl.value, body);
    }
  }
});

test("malformed or edited leading header blocks are left intact instead of searched for a later divider", () => {
  for (const opener of openers) {
    for (const body of [
      `${opener}\n\nCustom prose\n\n---\n\nBody`,
      `${opener}\n\n- original source: file\n\n---\n\nBody`,
      minimal(opener).replace("[an: note]", "(note)") + "Body",
      minimal(opener).replace("user comments", "my edited description") + "Body",
      minimal(opener).replace("\n---\n", "\n----\n") + "Body\n\n---\n\nLater body",
      minimal(opener).replace("\n---\n", "\n--- not a divider\n") + "Body",
      minimal(opener).replace("\n---\n\n", "\n---\n") + "Body",
      minimal(opener).replace("\n---\n\n", "\n") + "```md\n---\n```\nBody",
      studio(opener).replace(precedence, "precedence: edited instructions") + "Body",
      minimal(opener).replace("\n\n---", "\n- unknown metadata: body text\n\n---") + "Body",
    ]) {
      const h = harness(body);
      const result = h.c.stripAnnotationHeader(body);
      assert.equal(result.hadHeader, false, body);
      assert.equal(result.body, body);
      h.c.toggleAnnotatedReplyHeader();
      assert.equal(h.c.sourceTextEl.value, body, "a header-like but unrecognised block needs manual editing");
      assert.equal(h.edits.length, 0);
      assert.equal(h.statuses.at(-1).kind, "warning");
    }
  }
});

test("minimal headers do not consume body footer text; full legacy wrappers remove only their exact unquoted footer", () => {
  const h = harness();
  for (const opener of openers) {
    const minimalBody = "Keep this literal marker" + footer;
    assert.equal(h.c.stripAnnotationHeader(minimal(opener) + minimalBody).body, minimalBody);
    for (const make of [studio, legacy]) {
      for (const newline of ["\n", "\r\n"]) {
        const body = "\n\nBody\r\n\t";
        const framed = make(opener) + body + footer.replace(/\n/g, newline);
        assert.equal(h.c.stripAnnotationHeader(framed).body, body);
      }
      for (const body of [
        "Body\n\n> --- end annotations ---\n\n",
        "Body\n\n    --- end annotations ---\n\n",
        "Body mentions --- end annotations ---\n\n",
        "```md\n\n--- end annotations ---\n\n",
        "~~~~markdown\n```\n\n--- end annotations ---\n\n",
        "````md\n```\n\n--- end annotations ---\n\n",
        "```md\n```not a closing fence\n\n--- end annotations ---\n\n",
      ]) assert.equal(h.c.stripAnnotationHeader(make(opener) + body).body, body);
    }
  }
});

test("footer matching requires the exact suffix and never consumes extra trailing whitespace", () => {
  const h = harness();
  for (const suffix of [footer + "\n", footer + " ", footer.replace(/\n/g, "\r\n") + "\n",
    "\n\n--- end annotations ---\n", "\n\n--- end annotations ---\n\r\n"]) {
    const body = "Body" + suffix;
    assert.equal(h.c.stripAnnotationBoundaryMarker(body), body);
    assert.equal(h.c.stripAnnotationHeader(studio("annotations below") + body).body, body);
  }
});

test("annotation marker stripping keeps the minimal backticked hint literal and the legacy header recognisable", () => {
  const h = harness();
  for (const opener of openers) {
    const prefix = minimal(opener);
    assert.equal(helpers.hasAnnotationMarkers(prefix), false);
    assert.equal(helpers.stripAnnotationMarkers(prefix), prefix);
    const body = "Body [an: remove me]\n`[an: literal]`\n```md\n[an: also literal]\n```\n";
    const strippedBody = "Body \n`[an: literal]`\n```md\n[an: also literal]\n```\n";
    assert.equal(helpers.stripAnnotationMarkers(prefix + body), prefix + strippedBody);
    for (const make of [minimal, studio, legacy]) {
      const stripped = helpers.stripAnnotationMarkers(make(opener) + body);
      assert.equal(h.c.stripAnnotationHeader(stripped).hadHeader, true, "Strip annotations must not make a known header unrecognisable");
      assert.equal(h.c.stripAnnotationHeader(stripped).body, strippedBody);
    }
  }
});

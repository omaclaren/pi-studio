import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createStudioBufferClient, projectStudioBufferEditor } from "../shared/studio-buffer-client.js";
import { createStudioBufferServerStore } from "../shared/studio-buffer-server.js";
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

function harness(text = "", { switching = false, role = "prompt" } = {}) {
  const edits = [], statuses = [], summaries = [], listeners = new Map();
  const c = {
    bufferSwitchingEnabled: switching,
    selectedBuffer: role ? { id: role, role } : null,
    getStudioSelectedBuffer() { return c.selectedBuffer; },
    sourceState: { source: "file", label: "/tmp/notes.md" },
    sourceTextEl: { value: text },
    insertHeaderBtn: { textContent: "", title: "", disabled: false,
      addEventListener(name, fn) { listeners.set(name, fn); },
      click() { if (!this.disabled) listeners.get("click")(); } },
    setEditorText(value, options) { edits.push({ value, options }); c.sourceTextEl.value = value; },
    setStatus(message, kind) { statuses.push({ message, kind }); },
    syncStudioUiRefreshSummaries() { summaries.push(c.getStudioUiRefreshAnnotationHeaderEnabled()); },
    updateResultActionButtons() { c.updateAnnotatedReplyHeaderButton(); },
    isTextEquivalent: (a, b) => a === b,
  };
  vm.createContext(c);
  vm.runInContext(section("function describeSourceForAnnotation()", "function requestLatestResponse()"), c);
  vm.runInContext(section("function getStudioUiRefreshAnnotationHeaderEnabled()", "function syncStudioUiRefreshSummaries()"), c);
  vm.runInContext(section('insertHeaderBtn.addEventListener("click"', 'critiqueBtn.addEventListener("click"'), c);
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

test("opt-in Prompt adds the unchanged leading explanation without generating a footer", () => {
  for (const body of [...bodies, "Body" + footer, "```md\nUnclosed fence\n", "~~~md\nUnclosed fence\n"]) {
    const h = harness(body, { switching: true });
    h.c.insertHeaderBtn.click();
    assert.equal(h.c.sourceTextEl.value, studio("annotated reply: below") + body);
    assert.equal(h.c.getStudioUiRefreshAnnotationHeaderEnabled(), true);
    h.c.insertHeaderBtn.click();
    assert.equal(h.c.sourceTextEl.value, body);
    assert.equal(h.c.getStudioUiRefreshAnnotationHeaderEnabled(), false);
    for (const edit of h.edits) assert.deepEqual({ ...edit.options }, {
      preserveScroll: true, preserveSelection: true, preservePiEditorDraftLink: true,
    });
  }
});

test("opt-in Prompt removes only known leading blocks, preserving every following byte", () => {
  for (const opener of openers.flatMap(x => [x, x.toUpperCase()])) for (const make of [minimal, studio, legacy]) {
    for (const newline of ["\n", "\r\n"]) for (const body of [...bodies, "Body" + footer, "Body" + footer + "After" + footer,
      "Body" + footer.replace(/\n/g, "\r\n"), "```md\n" + footer]) {
      const h = harness(make(opener).replace(/\n/g, newline) + body, { switching: true });
      h.c.insertHeaderBtn.click();
      assert.equal(h.c.sourceTextEl.value, body, "even a terminal legacy footer belongs to the following text");
    }
  }
});

test("opt-in Prompt repeated toggles never accumulate footers around appended material", () => {
  const body = "Reply [an: check this]" + footer
    + "\n\n## Notes\n\nFrom `NOTES.md` (snapshot):\n\n"
    + studio("annotations below") + "Copied document" + footer;
  const h = harness(studio("annotated reply: below") + body, { switching: true });
  for (let i = 0; i < 3; i++) {
    h.c.insertHeaderBtn.click(); assert.equal(h.c.sourceTextEl.value, body);
    h.c.insertHeaderBtn.click(); assert.equal(h.c.sourceTextEl.value, studio("annotated reply: below") + body);
  }
});

test("opt-in Prompt has no Notes delimiter or reply-range inference, including manual inline composition", () => {
  for (const body of ["Growth is exponential.\n[an: NOTES.md says growth slows. Does this contradict it?]\n",
    "## Notes\nLiteral heading\n\n## Notes\nAnother section\n", "Reply\n\n```md\n## Notes\n```\n",
    "From `NOTES.md` (snapshot):\n\n" + minimal("annotated reply: below") + "Copied body" + footer]) {
    const h = harness(body, { switching: true });
    h.c.insertHeaderBtn.click(); assert.equal(h.c.sourceTextEl.value, studio("annotated reply: below") + body);
    h.c.insertHeaderBtn.click(); assert.equal(h.c.sourceTextEl.value, body);
  }
});

test("opt-in Prompt recognises imported/restored headers in a fresh context without saved scope", () => {
  for (const make of [minimal, studio, legacy]) {
    const body = "Reply [an: keep]\n\n## Notes\n\nLater context" + footer;
    const first = harness(make("annotated reply: below") + body, { switching: true });
    const restored = harness(first.c.sourceTextEl.value, { switching: true });
    restored.c.insertHeaderBtn.click(); assert.equal(restored.c.sourceTextEl.value, body);
    const restoredOff = harness(restored.c.sourceTextEl.value, { switching: true });
    restoredOff.c.insertHeaderBtn.click();
    assert.equal(restoredOff.c.sourceTextEl.value, studio("annotated reply: below") + body);
  }
});

test("opt-in Prompt still refuses malformed leading protocol text without edits", () => {
  for (const body of ["annotated reply: below\n\nMy own header\n\n---\n\nBody" + footer,
    studio("annotations below:").replace(precedence, "precedence: custom instructions") + "Body"]) {
    const h = harness(body, { switching: true }); h.c.insertHeaderBtn.click();
    assert.equal(h.c.sourceTextEl.value, body); assert.equal(h.edits.length, 0);
    assert.equal(h.statuses.at(-1).kind, "warning");
  }
});

test("default/foundation/Document header toggles keep their existing footer behaviour", () => {
  for (const options of [{}, { switching: false }, { switching: false, role: null }, { switching: true, role: "document" }]) {
    const h = harness("Body", options);
    h.c.insertHeaderBtn.click(); assert.equal(h.c.sourceTextEl.value, studio("annotated reply: below") + "Body" + footer);
    h.c.insertHeaderBtn.click(); assert.equal(h.c.sourceTextEl.value, "Body");
  }
});

test("header behaviour follows the selected buffer role, not its file origin or a cached mode", () => {
  const h = harness("Reply", { switching: true }); // File-backed Prompt is still Prompt.
  h.c.insertHeaderBtn.click(); assert.equal(h.c.sourceTextEl.value, studio("annotated reply: below") + "Reply");
  const keptPrompt = h.c.sourceTextEl.value;
  h.c.selectedBuffer = { id: "document", role: "document" }; h.c.sourceTextEl.value = "Document";
  h.c.insertHeaderBtn.click(); assert.equal(h.c.sourceTextEl.value, studio("annotated reply: below") + "Document" + footer);
  h.c.selectedBuffer = { id: "prompt", role: "prompt" }; h.c.sourceTextEl.value = keptPrompt;
  h.c.insertHeaderBtn.click(); assert.equal(h.c.sourceTextEl.value, "Reply");
});

test("Prompt header tooltips describe header-only edits; Document retains the legacy description", () => {
  const h = harness("Reply", { switching: true }); h.c.updateAnnotatedReplyHeaderButton();
  assert.match(h.c.insertHeaderBtn.title, /no end marker/i);
  h.c.insertHeaderBtn.click(); assert.match(h.c.insertHeaderBtn.title, /all following text/i);
  assert.match(h.c.insertHeaderBtn.title, /existing end markers/i);
  h.c.selectedBuffer = { id: "document", role: "document" }; h.c.sourceTextEl.value = "Document";
  h.c.updateAnnotatedReplyHeaderButton(); assert.match(h.c.insertHeaderBtn.title, /and end marker/);
});

test("Prompt header removal preserves ordinary inline-policy output and the legacy empty syntax hint", () => {
  const body = "Reply [an: remove me]\n`[an: literal]`\n\n## Notes\n[an: another note]" + footer;
  const strippedBody = helpers.stripAnnotationMarkers(body);
  const h = harness(helpers.stripAnnotationMarkers(studio("annotated reply: below") + body), { switching: true });
  h.c.insertHeaderBtn.click(); assert.equal(h.c.sourceTextEl.value, strippedBody);
  h.c.insertHeaderBtn.click(); assert.equal(h.c.sourceTextEl.value, studio("annotated reply: below") + strippedBody);
});

// Same in-memory adapter/server pattern as the selection/document append tests.
// Exercise real raw-copy and recovery paths; the header UI uses the VM harness above.
for (const method of ["appendSelectionToPrompt", "appendDocumentToPrompt"]) {
  test("header-only Prompt composes with real " + method + " and recovered buffer text", async () => {
    const workspaceId = "tab_" + "9".repeat(32), values = new Map(), server = createStudioBufferServerStore();
    const capability = server.issue({ workspaceId, mode: "full" }).capability;
    let nextId = 0;
    const options = { workspaceId, mode: "full", switching: true,
      storage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) },
      makeBufferId: () => "header-" + ++nextId, canRestore: () => true,
      readRemote: async () => server.read(capability), writeRemote: async (s, r) => server.write(capability, r, s),
      readLegacyRemote: async () => ({ ok: true, state: null }) };
    const body = "Reply [an: question]" + footer;
    const initial = { version: 1, savedAt: 1, text: studio("annotated reply: below") + body,
      sourceState: { source: "blank", path: null, draftId: "draft", label: "Prompt" }, diskRevision: null, resourceDir: "",
      editorView: "markdown", rightView: "editor-preview", editorLanguage: "markdown", followLatest: false,
      responseHistoryIndex: -1, selectionStart: 0, selectionEnd: 0, scrollTop: 0 };
    const client = createStudioBufferClient(options);
    let recovered;
    try {
      assert((await client.initialize(initial, null)).ok);
      const prompt = client.snapshot().buffers.find(b => b.role === "prompt"), doc = client.snapshot().buffers.find(b => b.role === "document");
      const copied = minimal("annotations below:") + "Copied [an: keep] 🐈\r\n" + footer;
      assert(client.replace(doc.id, doc.revision, { ...initial, text: copied,
        sourceState: { ...initial.sourceState, label: "NOTES.md", draftId: "document-draft" }, selectionEnd: copied.length }, null,
        { metadata: { annotationsEnabled: true, reviewNotesKey: "document-review", scratchpadKey: "document-scratch" } }).ok);
      assert(client.select(doc.id).ok);
      const before = client.snapshot(), sourceDoc = before.buffers.find(b => b.id === doc.id);
      assert(client[method]({ sourceId: doc.id, sourceRevision: sourceDoc.revision, promptId: prompt.id,
        promptRevision: prompt.revision, start: 0, end: copied.length }).ok);
      const appended = client.snapshot().buffers.find(b => b.id === prompt.id);
      assert(appended.text.startsWith(initial.text + "\n\nFrom `NOTES.md` (")); assert(appended.text.endsWith(copied));
      assert.deepEqual({ ...appended, text: prompt.text, revision: prompt.revision }, prompt);
      assert.deepEqual(client.snapshot().buffers.find(b => b.id === doc.id), sourceDoc);
      assert.equal(client.snapshot().selectedBufferId, doc.id);
      assert(client.select(prompt.id).ok);
      const h = harness(appended.text, { switching: true });
      h.c.insertHeaderBtn.click(); assert.equal(h.c.sourceTextEl.value, appended.text.slice(studio("annotated reply: below").length));
      assert(client.persist({ ...projectStudioBufferEditor(client.snapshot()), text: h.c.sourceTextEl.value }, null).ok);
      await client.settled(); client.dispose();
      recovered = createStudioBufferClient(options);
      assert((await recovered.initialize(initial, null)).ok);
      const reopened = projectStudioBufferEditor(recovered.snapshot());
      assert.equal(reopened.text, h.c.sourceTextEl.value);
      const fresh = harness(reopened.text, { switching: true }); fresh.c.insertHeaderBtn.click();
      assert.equal(fresh.c.sourceTextEl.value, appended.text, "reload needs no lost range record or reply selection");
      assert.deepEqual(recovered.snapshot().buffers.find(b => b.id === doc.id), sourceDoc);
      await recovered.settled();
    } finally { client.dispose(); recovered?.dispose(); }
  });
}

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const helperSource = readFileSync(new URL("../client/studio-editor-draft-helpers.js", import.meta.url), "utf8");
const critique = "## Assessment\n\nA claim. [an: check]\n\n## Critiques\n\n- C1: A missing assumption.\n\n## Document\n\nRevised text.\n";
const notes = "## Assessment\n\nA claim. [an: check]\n\n## Critiques\n\n- C1: A missing assumption.";
const payload = mode => mode === "notes" ? notes : critique;
function section(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert(a >= 0 && b > a, "Missing source section: " + start);
  return source.slice(a, b);
}

// Same narrow VM boundaries as studio-annotate-response.test.js. Invoke the
// actual registered listeners, including the old ones in the before-fix run.
function harness(overrides = {}) {
  const calls = [], listeners = {};
  let resolveConfirmation, rejectConfirmation, lastPromise;
  const c = {
    sourceTextEl: { value: "Unsent Prompt\n\nFrom `notes.md` (whole document):\n\nNew context. [an: keep]\n" },
    sourceState: { source: "blank", label: "my draft", path: null, draftId: "draft-one" },
    editorSourceGeneration: 0, editorContentGeneration: 0,
    bufferRecoveryEnabled: true, bufferSwitchingEnabled: true, documentHostingEnabled: false, selectedId: "prompt-one", documentSelected: false,
    bufferTransientStates: new Map(), latestResponseMarkdown: critique, latestResponseIsStructuredCritique: true,
    latestResponseTimestamp: 123, responseHistoryIndex: 1, fileBackedDiskRevision: null,
    isEditorOnlyMode: false, isWatchedFilePreview: false, uiBusy: false, responseReplacementPending: false,
    modal: false, dirty: false, editorView: "preview", rightView: "markdown", activePane: "right", paneFocusTarget: "right",
    annotationsEnabled: false, resourceDir: "/fixture", fileBackedBaselineText: null,
    getCurrentResourceDirValue: () => c.resourceDir,
    studioModalBlocksDraftAction: () => c.modal,
    isStudioDocumentBufferView: () => c.documentSelected,
    hasRefreshableFilePath: () => Boolean(c.sourceState.path),
    editorDiffersFromFileBackedBaseline: () => c.dirty,
    requestStudioConfirmation: (...args) => {
      calls.push(["confirm", ...args]);
      return new Promise((resolve, reject) => { resolveConfirmation = resolve; rejectConfirmation = reject; });
    },
    setStatus: (...args) => calls.push(["status", ...args]),
    setEditorText: (text, options) => { c.sourceTextEl.value = text; c.editorContentGeneration++; calls.push(["text", text, options]); },
    setSourceState: state => { c.sourceState = state; c.editorSourceGeneration++; calls.push(["source", state]); },
    sendMessage: () => { assert.fail("Loading critique must not submit or clear terminal input"); },
    ...overrides,
  };
  c.bufferRecoveryClient = { snapshot: () => ({ selectedBufferId: c.selectedId }) };
  for (const id of ["loadCritiqueNotesBtn", "loadCritiqueFullBtn"]) {
    c[id] = { addEventListener: (event, listener) => { assert.equal(event, "click"); listeners[id] = listener; } };
  }
  vm.createContext(c);
  vm.runInContext(helperSource, c);
  c.editorDraftHelpers = c.PiStudioEditorDraftHelpers;
  c.submittedEditorDrafts = c.editorDraftHelpers.createSubmittedEditorDraftTracker();
  vm.runInContext(section("function getEditorDraftSourceKey()", "function markFileBackedBaseline"), c);
  vm.runInContext(section("function captureEditorConsent()", "function abandonPendingSaveRequest"), c);
  vm.runInContext(section("function extractSection(", "function handleIncomingResponse("), c);
  if (source.includes("async function loadSelectedCritiqueIntoEditor(")) {
    vm.runInContext(section("async function loadSelectedCritiqueIntoEditor(", "      loadCritiqueNotesBtn.addEventListener"), c);
    const load = c.loadSelectedCritiqueIntoEditor;
    c.loadSelectedCritiqueIntoEditor = (...args) => (lastPromise = load(...args));
  }
  vm.runInContext(section("      loadCritiqueNotesBtn.addEventListener", "      copyResponseBtn.addEventListener"), c);
  return {
    c, calls,
    run(mode) {
      lastPromise = null;
      listeners[mode === "notes" ? "loadCritiqueNotesBtn" : "loadCritiqueFullBtn"]();
      return lastPromise || Promise.resolve();
    },
    decide(value) { assert(resolveConfirmation, "replacement decision must be shown"); resolveConfirmation(value); },
    reject(error) { assert(rejectConfirmation); rejectConfirmation(error); },
    submitted() { c.submittedEditorDrafts.remember("run", c.sourceTextEl.value, c.getEditorDraftSourceKey()); c.submittedEditorDrafts.accept("run"); },
  };
}
const snapshot = c => ({ text: c.sourceTextEl.value, source: c.sourceState, editorView: c.editorView, rightView: c.rightView,
  pane: c.activePane, focus: c.paneFocusTarget, annotations: c.annotationsEnabled, resourceDir: c.resourceDir });
const confirmations = h => h.calls.filter(x => x[0] === "confirm");
const edits = h => h.calls.filter(x => x[0] === "text" || x[0] === "source");

for (const mode of ["notes", "full"]) {
  test(mode + " critique protects new and post-submission Prompt text; Cancel preserves state", async () => {
    for (const switching of [false, true]) for (const postSubmission of [false, true]) {
      const h = harness({ bufferSwitchingEnabled: switching });
      if (postSubmission) { h.submitted(); h.c.sourceTextEl.value += "later typing"; h.c.editorContentGeneration++; }
      const before = snapshot(h.c), p = h.run(mode);
      assert.equal(confirmations(h).length, 1, "must ask before replacing unsent Prompt/context");
      assert.equal(h.c.responseReplacementPending, true);
      assert.deepEqual(snapshot(h.c), before);
      h.decide(false); await p;
      assert.deepEqual(snapshot(h.c), before); assert.deepEqual(edits(h), []); assert.equal(h.c.responseReplacementPending, false);
    }
  });

  test(mode + " critique protects unsaved file edits, empty deletions and even accepted dirty files", async () => {
    for (const value of ["unsaved file", "", payload(mode)]) {
      const h = harness({ sourceTextEl: { value }, sourceState: { source: "file", label: "PROMPT.md", path: "/fixture/PROMPT.md" }, dirty: true });
      h.submitted(); const before = snapshot(h.c), p = h.run(mode);
      assert.equal(confirmations(h).length, 1, "sending a file is not saving it");
      h.decide(false); await p; assert.deepEqual(snapshot(h.c), before); assert.deepEqual(edits(h), []);
    }
  });

  test(mode + " critique explicit replacement retains its payload, label and current views", async () => {
    const h = harness(), before = snapshot(h.c), p = h.run(mode);
    assert.equal(confirmations(h).length, 1); h.decide(true); await p;
    assert.equal(h.c.sourceTextEl.value, payload(mode));
    assert.deepEqual({ ...h.c.sourceState }, { source: "blank", label: mode === "notes" ? "critique notes" : "full critique", path: null });
    assert.deepEqual({ ...snapshot(h.c), text: before.text, source: before.source }, before);
    assert.equal(h.c.responseReplacementPending, false);
    assert.deepEqual({ ...edits(h)[0][2] }, { preserveScroll: false, preserveSelection: false });
  });

  test(mode + " critique rechecks monotonic editor/source ownership and the entire selected response", async () => {
    const changes = [
      c => { c.sourceTextEl.value += " new text"; c.editorContentGeneration++; },
      c => { c.editorContentGeneration += 2; }, // edit/undo must not revive consent
      c => { c.editorSourceGeneration++; },
      c => { c.selectedId = "different-buffer"; },
      c => { c.sourceState = { ...c.sourceState, draftId: "different-draft" }; },
      c => { c.fileBackedDiskRevision = "new revision"; },
      c => { c.latestResponseMarkdown += "Changed document, same notes."; },
      c => { c.latestResponseTimestamp++; },
      c => { c.responseHistoryIndex++; },
      c => { c.latestResponseIsStructuredCritique = false; },
      c => { c.uiBusy = true; },
      c => { c.modal = true; },
      c => { c.rightView = "editor-quarto-preview"; },
    ];
    for (const change of changes) {
      const h = harness(), p = h.run(mode);
      assert.equal(confirmations(h).length, 1); change(h.c); const before = snapshot(h.c);
      h.decide(true); await p;
      assert.deepEqual(snapshot(h.c), before); assert.deepEqual(edits(h), []); assert.equal(h.c.responseReplacementPending, false);
    }
  });
}

test("both critique modes share the existing clean/identical/accepted-draft exemption", async () => {
  for (const mode of ["notes", "full"]) {
    for (const value of ["", " \t\n", payload(mode)]) {
      const h = harness({ sourceTextEl: { value } }); await h.run(mode);
      assert.equal(confirmations(h).length, 0); assert.equal(h.c.sourceTextEl.value, payload(mode));
    }
    const submitted = harness(); submitted.submitted(); await submitted.run(mode);
    assert.equal(confirmations(submitted).length, 0); assert.equal(submitted.c.sourceTextEl.value, payload(mode));
    const clean = harness({ sourceState: { source: "file", label: "clean.md", path: "/fixture/clean.md" }, dirty: false });
    await clean.run(mode); assert.equal(confirmations(clean).length, 0); assert.equal(clean.c.sourceTextEl.value, payload(mode));
  }
});

test("an accepted raw draft from a different source cannot waive critique replacement consent", async () => {
  for (const mode of ["notes", "full"]) {
    const h = harness(); h.submitted(); h.c.editorSourceGeneration++;
    const p = h.run(mode); assert.equal(confirmations(h).length, 1); h.decide(false); await p; assert.deepEqual(edits(h), []);
  }
});

test("critique execution fences companions, Document, busy work, existing decisions and Quarto", async () => {
  for (const mode of ["notes", "full"]) for (const flags of [
    { isEditorOnlyMode: true }, { isWatchedFilePreview: true }, { documentSelected: true }, { uiBusy: true },
    { responseReplacementPending: true }, { modal: true }, { rightView: "editor-quarto-preview" },
    { latestResponseIsStructuredCritique: false }, { latestResponseMarkdown: " " },
  ]) {
    const h = harness(flags), before = snapshot(h.c); await h.run(mode);
    assert.deepEqual(snapshot(h.c), before); assert.deepEqual(edits(h), []); assert.equal(confirmations(h).length, 0);
  }
});

test("a pending critique decision cannot be replaced by a second loader activation", async () => {
  for (const mode of ["notes", "full"]) {
    const h = harness(), before = snapshot(h.c), p = h.run(mode);
    assert.equal(confirmations(h).length, 1);
    await h.run(mode === "notes" ? "full" : "notes");
    assert.equal(confirmations(h).length, 1); assert.deepEqual(snapshot(h.c), before);
    h.decide(true); await p; assert.equal(h.c.sourceTextEl.value, payload(mode)); assert.equal(h.c.responseReplacementPending, false);
  }
});

test("failed decision construction releases critique replacement ownership without editing", async () => {
  const h = harness(), before = snapshot(h.c), p = h.run("notes");
  assert.equal(confirmations(h).length, 1); h.reject(new Error("fixture decision failure"));
  await assert.rejects(p, /fixture decision failure/);
  assert.equal(h.c.responseReplacementPending, false); assert.deepEqual(snapshot(h.c), before); assert.deepEqual(edits(h), []);
});

test("critique loading does not transform annotation text or dispatch unrelated actions", () => {
  const load = section("async function loadSelectedCritiqueIntoEditor(", "      loadCritiqueNotesBtn.addEventListener");
  assert.doesNotMatch(load, /sendMessage\(|setAnnotationsEnabled|stripAnnotation|toggleAnnotatedReplyHeader|saveFile|selectStudioBuffer/);
  assert.match(source, /loadCritiqueNotesBtn\.addEventListener\("click", \(\) => \{\s*void loadSelectedCritiqueIntoEditor\("notes"\);/);
  assert.match(source, /loadCritiqueFullBtn\.addEventListener\("click", \(\) => \{\s*void loadSelectedCritiqueIntoEditor\("full"\);/);
});

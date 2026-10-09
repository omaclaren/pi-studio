import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const helperSource = readFileSync(new URL("../client/studio-editor-draft-helpers.js", import.meta.url), "utf8");
function section(start, end) {
  const a = clientSource.indexOf(start), b = clientSource.indexOf(end, a);
  assert.ok(a >= 0 && b > a, "missing source section: " + start);
  return clientSource.slice(a, b);
}
function harness(overrides = {}) {
  const calls = [];
  let decide, click;
  const c = {
    sourceTextEl: { value: "unsubmitted work" }, sourceState: { source: "file", path: "/old.md", draftId: null },
    item: { id: "response-1", prompt: "original run prompt", promptSource: "run" },
    editorContentGeneration: 0, editorSourceGeneration: 0, fileBackedDiskRevision: "disk-1",
    bufferRecoveryEnabled: true, bufferRecoveryClient: null, bufferSwitchingEnabled: true, documentHostingEnabled: false,
    bufferTransientStates: new Map(), bufferConnectionGeneration: 1, bufferPageClosed: false, bufferRecoveryInitializing: false,
    isEditorOnlyMode: false, isWatchedFilePreview: false, documentSelected: false, uiBusy: false,
    responseReplacementPending: false, modalOpen: false, dirty: true,
    editorView: "preview", rightView: "markdown", activePane: "right",
    getCurrentResourceDirValue: () => "/workspace",
    getSelectedHistoryItem: () => c.item,
    isStudioDocumentBufferView: () => c.documentSelected,
    studioModalBlocksDraftAction: () => c.modalOpen,
    hasRefreshableFilePath: () => Boolean(c.sourceState.path),
    editorDiffersFromFileBackedBaseline: () => c.dirty,
    getHistoryPromptSourceStateLabel: item => item.promptSource + " prompt",
    getHistoryPromptLoadedStatus: item => "Loaded " + item.promptSource + " prompt",
    requestStudioConfirmation: (...args) => { calls.push(["confirm", ...args]); return new Promise(resolve => { decide = resolve; }); },
    prepareDocumentHostingReplacement: async () => () => true,
    setEditorText: text => { c.sourceTextEl.value = text; calls.push(["text", text]); },
    setSourceState: state => { c.sourceState = state; c.editorSourceGeneration++; },
    setStatus: (...args) => calls.push(["status", ...args]),
    syncActionButtons: () => {},
    loadHistoryPromptBtn: { addEventListener: (_type, fn) => { click = fn; } },
    ...overrides,
  };
  vm.createContext(c);
  vm.runInContext(helperSource, c);
  c.editorDraftHelpers = c.PiStudioEditorDraftHelpers;
  c.submittedEditorDrafts = c.editorDraftHelpers.createSubmittedEditorDraftTracker();
  vm.runInContext(section("function getEditorDraftSourceKey()", "function markFileBackedBaseline"), c);
  vm.runInContext(section("function captureEditorConsent()", "function abandonPendingSaveRequest"), c);
  vm.runInContext(section("function runStudioEditorSourceMutation(", "async function prepareDocumentHostingReplacement("), c);
  if (clientSource.includes("async function loadSelectedHistoryPromptIntoEditor()")) {
    vm.runInContext(section("async function loadSelectedHistoryPromptIntoEditor()", "pullLatestBtn.addEventListener"), c);
  } else {
    vm.runInContext(section('\n      if (loadHistoryPromptBtn) {', "pullLatestBtn.addEventListener"), c);
  }
  return {
    c, calls,
    run: () => {
      if (c.loadSelectedHistoryPromptIntoEditor) return c.loadSelectedHistoryPromptIntoEditor();
      const before = calls.filter(([type]) => type === "text").length;
      click();
      return calls.filter(([type]) => type === "text").length > before;
    },
    decide: value => { assert.ok(decide, "replacement must ask for consent"); decide(value); },
    submitted: () => {
      c.submittedEditorDrafts.remember("run", c.sourceTextEl.value, c.getEditorDraftSourceKey());
      c.submittedEditorDrafts.accept("run");
    },
  };
}

test("history prompt label stays stable and disabled controls explain the actual blocking condition", () => {
  const h = harness(), c = h.c;
  Object.assign(c, { responseHistory: [c.item], responseHistoryIndex: 0,
    historyIndexBadgeEl: null, historyPrevBtn: null, historyNextBtn: null, historyLastBtn: null, copyResponsePromptBtn: null, syncShowMeButton() {} });
  vm.runInContext(section("function getHistoryPromptSourceLabel(", "function getHistoryPromptLoadedStatus("), c);
  vm.runInContext(section("function updateHistoryControls()", "function applySelectedHistoryItem("), c);
  for (const [change, reason, disabled] of [
    [() => {}, /Load the .*prompt/, false],
    [() => { c.item = null; }, /Select a response/, true],
    [() => { c.item = { id: "r", prompt: " " }; }, /No prompt was recorded/, true],
    [() => { c.item = { id: "r", prompt: "stored prompt" }; c.documentSelected = true; }, /Return to Prompt/, true],
    [() => { c.documentSelected = false; c.uiBusy = true; }, /Wait for the current action/, true],
    [() => { c.uiBusy = false; c.responseReplacementPending = true; }, /Finish the current text replacement/, true],
    [() => { c.responseReplacementPending = false; }, /Load the .*prompt/, false],
  ]) {
    change(); c.updateHistoryControls();
    assert.equal(c.loadHistoryPromptBtn.textContent, "Load response prompt");
    assert.equal(c.loadHistoryPromptBtn.disabled, disabled); assert.match(c.loadHistoryPromptBtn.title, reason);
  }
});

test("history prompt replacement asks before losing draft or unsaved file work; Cancel preserves views and source", async () => {
  for (const file of [false, true]) {
    const h = harness({ sourceState: { source: file ? "file" : "blank", path: file ? "/old.md" : null }, dirty: file });
    const source = h.c.sourceState, pending = h.run();
    assert.equal(h.calls[0]?.[0], "confirm");
    assert.equal(await h.run(), false, "a concurrent replacement cannot open another decision");
    h.decide(false);
    assert.equal(await pending, false);
    assert.equal(h.c.sourceTextEl.value, "unsubmitted work");
    assert.equal(h.c.sourceState, source);
    assert.equal(h.c.editorView, "preview"); assert.equal(h.c.rightView, "markdown"); assert.equal(h.c.activePane, "right");
    assert.equal(h.c.responseReplacementPending, false);
  }
});

test("empty or unchanged accepted drafts load without needless confirmation and remain detached", async () => {
  for (const value of ["", "original run prompt", "unsubmitted work"]) {
    const h = harness({ sourceTextEl: { value }, sourceState: { source: "blank", path: null }, dirty: false });
    if (value === "unsubmitted work") h.submitted();
    assert.equal(await h.run(), true);
    assert.equal(h.calls.some(([type]) => type === "confirm"), false);
    assert.equal(h.c.sourceTextEl.value, "original run prompt"); assert.equal(h.c.sourceState.path, null);
    assert.equal(h.c.rightView, "markdown");
  }
});

test("even an accepted dirty file needs consent, including identical or empty current text", async () => {
  for (const value of ["", "original run prompt", "unsubmitted work"]) {
    const h = harness({ sourceTextEl: { value } }); h.submitted();
    const pending = h.run(); assert.equal(h.calls[0]?.[0], "confirm"); h.decide(false);
    assert.equal(await pending, false); assert.equal(h.c.sourceState.path, "/old.md");
  }
});

test("consent is invalidated by later editor, source, disk, selected response, busy or role changes", async () => {
  for (const change of [
    c => { c.sourceTextEl.value += " later typing"; },
    c => { c.editorContentGeneration++; },
    c => { c.editorSourceGeneration++; },
    c => { c.sourceState = { ...c.sourceState, path: "/other.md" }; },
    c => { c.fileBackedDiskRevision = "disk-2"; },
    c => { c.item = { ...c.item, id: "response-2" }; },
    c => { c.item.prompt = "changed effective prompt"; },
    c => { c.uiBusy = true; },
    c => { c.documentSelected = true; },
  ]) {
    const h = harness(), pending = h.run(); assert.equal(h.calls[0]?.[0], "confirm");
    change(h.c); const text = h.c.sourceTextEl.value; h.decide(true);
    assert.equal(await pending, false); assert.equal(h.c.sourceTextEl.value, text);
    assert.equal(h.calls.some(([type]) => type === "text"), false);
    assert.equal(h.c.responseReplacementPending, false);
  }
});

test("explicit consent loads the selected run/effective prompt without switching views or sending", async () => {
  for (const promptSource of ["run", "effective"]) {
    const h = harness({ item: { id: "response-1", prompt: "stored " + promptSource + " prompt", promptSource } });
    const pending = h.run(); assert.equal(h.calls[0]?.[0], "confirm"); h.decide(true);
    assert.equal(await pending, true); assert.equal(h.c.sourceTextEl.value, "stored " + promptSource + " prompt");
    assert.equal(h.c.sourceState.label, promptSource + " prompt"); assert.equal(h.c.sourceState.path, null);
    assert.equal(h.c.editorView, "preview"); assert.equal(h.c.rightView, "markdown");
  }
  assert.doesNotMatch(section("async function loadSelectedHistoryPromptIntoEditor()", "pullLatestBtn.addEventListener"), /sendMessage\(|setRightView\(|setEditorView\(/);
});

test("history prompt loading refuses in Document, companion, watch, busy, modal and pending-replacement states", async () => {
  for (const flag of ["documentSelected", "isEditorOnlyMode", "isWatchedFilePreview", "uiBusy", "modalOpen", "responseReplacementPending"]) {
    const h = harness({ [flag]: true }); assert.equal(await h.run(), false, flag);
    // The Document now says why (it can show responses); nothing else happens there either.
    const expected = flag === "documentSelected" ? [["status", "Return to Prompt to load or annotate this response.", "warning"]] : [];
    assert.deepEqual(h.calls, expected, flag);
  }
  const h = harness({ item: { prompt: " " } });
  assert.equal(await h.run(), false); assert.equal(h.c.sourceTextEl.value, "unsubmitted work");
});

test("hosted prompt loading retains ownership preparation and rechecks text and response after its await", async () => {
  for (const outcome of ["refused", "changed-text", "changed-item", "accepted"]) {
    const h = harness({ documentHostingEnabled: true, sourceState: { source: "blank", path: null }, dirty: false,
      bufferRecoveryClient: { snapshot: () => ({ selectedBufferId: "prompt" }) },
      documentHostingProof: () => ({ ok: true, bufferId: "prompt", generation: 1, documentEpoch: 1 }) });
    h.submitted(); let release;
    h.c.prepareDocumentHostingReplacement = async (_id, current) => {
      assert.equal(_id, "prompt");
      await new Promise(resolve => { release = resolve; });
      if (outcome === "refused") throw new Error("pending disk save");
      return current;
    };
    const pending = h.run();
    assert.equal(h.c.responseReplacementPending, true);
    assert.equal(await h.run(), false);
    if (outcome === "changed-text") h.c.sourceTextEl.value += " changed";
    if (outcome === "changed-item") h.c.item = { ...h.c.item, id: "response-2" };
    const text = h.c.sourceTextEl.value; release();
    assert.equal(await pending, outcome === "accepted");
    assert.equal(h.c.sourceTextEl.value, outcome === "accepted" ? "original run prompt" : text);
    assert.equal(h.c.responseReplacementPending, false);
  }
});

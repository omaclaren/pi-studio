import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const indexSource = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const helperSource = readFileSync(new URL("../client/studio-editor-draft-helpers.js", import.meta.url), "utf8");

function section(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, "missing source section: " + start);
  return source.slice(a, b);
}

function harness(overrides = {}) {
  const calls = [];
  let resolveConfirmation;
  const c = {
    calls,
    sourceTextEl: { value: "unsent prompt" },
    sourceState: { source: "blank", path: null, draftId: "one" },
    editorSourceGeneration: 0,
    editorContentGeneration: 0,
    bufferRecoveryEnabled: false,
    bufferRecoveryClient: null,
    bufferSwitchingEnabled: false,
    documentHostingEnabled: false,
    latestResponseMarkdown: "# Model response",
    latestResponseIsStructuredCritique: false,
    latestResponseTimestamp: 123,
    responseHistoryIndex: 1,
    fileBackedDiskRevision: null,
    isEditorOnlyMode: false,
    isWatchedFilePreview: false,
    uiBusy: false,
    responseReplacementPending: false,
    modalOpen: false,
    dirty: false,
    editorView: "preview",
    rightView: "preview",
    activePane: "right",
    paneFocusTarget: "right",
    getCurrentResourceDirValue: () => "/workspace",
    studioModalBlocksDraftAction: () => c.modalOpen,
    hasRefreshableFilePath: () => Boolean(c.sourceState.path),
    editorDiffersFromFileBackedBaseline: () => c.dirty,
    requestStudioConfirmation: (...args) => {
      calls.push(["confirm", ...args]);
      return new Promise((resolve) => { resolveConfirmation = resolve; });
    },
    setStatus: (...args) => calls.push(["status", ...args]),
    setEditorText: (text) => { c.sourceTextEl.value = text; calls.push(["text", text]); },
    setSourceState: (source) => { c.sourceState = source; c.editorSourceGeneration++; },
    setEditorView: (view) => { c.editorView = view; },
    setRightView: (view) => { c.rightView = view; },
    setActivePane: (pane) => { c.activePane = pane; },
    exitPaneFocus: () => { c.paneFocusTarget = "off"; },
    focusSourceTextNoScroll: () => calls.push(["focus"]),
    window: { setTimeout: (fn) => fn() },
    ...overrides,
  };
  vm.createContext(c);
  vm.runInContext(helperSource, c);
  c.editorDraftHelpers = c.PiStudioEditorDraftHelpers;
  c.submittedEditorDrafts = c.editorDraftHelpers.createSubmittedEditorDraftTracker();
  vm.runInContext(section(clientSource, "function getEditorDraftSourceKey()", "function markFileBackedBaseline"), c);
  vm.runInContext(section(clientSource, "function captureEditorConsent()", "function abandonPendingSaveRequest"), c);
  vm.runInContext(section(clientSource, "async function loadSelectedResponseIntoEditor(options)", 'loadResponseBtn.addEventListener'), c);
  return {
    c,
    run: (options = { annotate: true }) => c.loadSelectedResponseIntoEditor(options),
    decide: (value) => { assert.ok(resolveConfirmation); resolveConfirmation(value); },
    submitted: () => {
      c.submittedEditorDrafts.remember("run", c.sourceTextEl.value, c.getEditorDraftSourceKey());
      c.submittedEditorDrafts.accept("run");
    },
  };
}

test("Annotate response exposes a separate preparation shortcut without changing Run", () => {
  assert.match(indexSource, /id="annotateResponseBtn"[^>]*aria-keyshortcuts="Meta\+Alt\+Enter Control\+Alt\+Enter"/);
  assert.match(indexSource, /<dt>Cmd\/Ctrl\+Option\/Alt\+Enter<\/dt>/);
  const binding = section(clientSource, "const isAnnotateResponseShortcut", "const isActivityTrackingShortcut");
  assert.match(binding, /key === "Enter"/);
  assert.match(binding, /\(event\.metaKey \|\| event\.ctrlKey\)/);
  assert.match(binding, /event\.altKey/);
  assert.match(binding, /!event\.shiftKey/);
  assert.match(binding, /!event\.repeat && !event\.isComposing/);
  assert.doesNotMatch(binding, /activePane/);
  const trigger = section(clientSource, "function triggerAnnotateResponseShortcut", "function triggerActivityTrackingShortcut");
  assert.match(trigger, /isEditorOnlyMode \|\| isWatchedFilePreview \|\| studioModalBlocksDraftAction\(\)/);
  assert.match(trigger, /annotateResponseBtn\.hidden \|\| annotateResponseBtn\.disabled/);
  assert.match(trigger, /annotateResponseBtn\.click\(\)/);
  assert.match(clientSource, /annotateResponseBtn\.addEventListener\("click", \(\) => \{\s*void loadSelectedResponseIntoEditor\(\{ annotate: true \}\);/);
  assert.match(clientSource, /!event\.shiftKey\s*&& activePane === "left"\s*&& !isEditorOnlyMode/);
});

test("Load response shortcut delegates to the existing guarded view-preserving button", () => {
  assert.match(indexSource, /id="loadResponseBtn"[^>]*aria-keyshortcuts="Meta\+Alt\+Shift\+Enter Control\+Alt\+Shift\+Enter"/);
  assert.match(indexSource, /<dt>Cmd\/Ctrl\+Option\/Alt\+Shift\+Enter<\/dt>/);
  assert.match(indexSource, /id="loadResponseBtn"[^>]*title="[^"]*without switching views/);
  assert.match(clientSource, /loadResponseBtn\.addEventListener\("click", \(\) => \{\s*void loadSelectedResponseIntoEditor\(\);/);
  const trigger = section(clientSource, "function triggerLoadResponseShortcut", "function triggerAnnotateResponseShortcut");
  for (const overrides of [null, { isEditorOnlyMode: true }, { isWatchedFilePreview: true },
    { studioModalBlocksDraftAction: () => true }, { loadResponseBtn: null },
    { loadResponseBtn: { hidden: true } }, { loadResponseBtn: { disabled: true } }]) {
    let clicks = 0;
    const c = { isEditorOnlyMode: false, isWatchedFilePreview: false, studioModalBlocksDraftAction: () => false, bufferSwitchingEnabled: false,
      loadResponseBtn: { hidden: false, disabled: false, click: () => { clicks++; } }, ...overrides };
    const result = vm.runInNewContext(`${trigger}\ntriggerLoadResponseShortcut()`, c);
    assert.equal(result, overrides === null);
    assert.equal(clicks, overrides === null ? 1 : 0);
  }
  // In the Document the shortcut is consumed with the reason, and nothing loads (Sol, 8 Oct).
  let clicks = 0; const statuses = [];
  const c = { isEditorOnlyMode: false, isWatchedFilePreview: false, studioModalBlocksDraftAction: () => false, bufferSwitchingEnabled: true,
    isStudioDocumentBufferView: () => true, setStatus: (...a) => statuses.push(a), loadResponseBtn: { hidden: false, disabled: true, click: () => { clicks++; } } };
  assert.equal(vm.runInNewContext(`${trigger}\ntriggerLoadResponseShortcut()`, c), true);
  assert.equal(clicks, 0); assert.equal(JSON.stringify(statuses), JSON.stringify([["Return to Prompt to load or annotate this response.", "warning"]]));
});

test("shortcut dispatch distinguishes submission, annotation, load-only, activity, repeat, and composition", () => {
  const bindings = section(clientSource, "const isLoadResponseShortcut", "const isContentFocusShortcut");
  function dispatch(changes = {}) {
    const actions = [];
    const event = { key: "Enter", code: "Enter", metaKey: true, ctrlKey: false, altKey: true, shiftKey: false,
      repeat: false, isComposing: false, preventDefault: () => actions.push("prevent"), ...changes };
    vm.runInNewContext(`(function() { ${bindings} })()`, {
      event, key: event.key, code: event.code,
      triggerLoadResponseShortcut: () => actions.push("load"),
      triggerAnnotateResponseShortcut: () => actions.push("annotate"),
      triggerActivityTrackingShortcut: () => actions.push("activity"),
    });
    return actions;
  }
  assert.deepEqual(dispatch(), ["prevent", "annotate"]);
  assert.deepEqual(dispatch({ metaKey: false, ctrlKey: true }), ["prevent", "annotate"]);
  assert.deepEqual(dispatch({ altKey: false }), [], "ordinary Run must not be intercepted");
  assert.deepEqual(dispatch({ altKey: false, shiftKey: true }), []);
  assert.deepEqual(dispatch({ shiftKey: true }), ["prevent", "load"]);
  assert.deepEqual(dispatch({ shiftKey: true, metaKey: false, ctrlKey: true }), ["prevent", "load"]);
  assert.deepEqual(dispatch({ metaKey: false }), []);
  assert.deepEqual(dispatch({ metaKey: false, shiftKey: true }), []);
  assert.deepEqual(dispatch({ repeat: true }), ["prevent"]);
  assert.deepEqual(dispatch({ isComposing: true }), ["prevent"]);
  assert.deepEqual(dispatch({ shiftKey: true, repeat: true }), ["prevent"]);
  assert.deepEqual(dispatch({ shiftKey: true, isComposing: true }), ["prevent"]);
  assert.deepEqual(dispatch({ key: "å", code: "KeyA" }), ["prevent", "activity"]);
  assert.deepEqual(dispatch({ key: "å", code: "KeyA", repeat: true }), ["prevent"]);
});

test("unchanged accepted prompt goes straight to annotation with no confirmation or send", async () => {
  const h = harness();
  h.submitted();
  assert.equal(await h.run(), true);
  assert.equal(h.c.calls.some(([type]) => type === "confirm"), false);
  assert.equal(h.c.sourceTextEl.value, "# Model response");
  assert.equal(h.c.sourceState.source, "last-response");
  assert.equal(h.c.editorView, "markdown");
  assert.equal(h.c.rightView, "editor-preview");
  assert.equal(h.c.activePane, "left");
  assert.equal(h.c.paneFocusTarget, "off");
  const load = section(clientSource, "async function loadSelectedResponseIntoEditor(options)", 'loadResponseBtn.addEventListener');
  assert.doesNotMatch(load, /sendMessage\(|setAnnotationsEnabled|stripAnnotation|toggleAnnotatedReplyHeader/);
});

test("loaded response provenance pins source identity and position independently of later selection", async () => {
  const h = harness({ getSelectedHistoryItem: () => ({ id: 'response-two' }) }); h.submitted();
  assert.equal(await h.run({ annotate: false }), true);
  assert.deepEqual(JSON.parse(JSON.stringify(h.c.sourceState.provenance)), { version: 1, kind: 'response', responseId: 'response-two', responseNumber: 2, annotated: false });
  h.c.responseHistoryIndex = 7;
  assert.equal(h.c.editorDraftHelpers.buildDraftSaveFilename({ sourceState: h.c.sourceState, text: h.c.sourceTextEl.value }), 'response-2.md');
});

test("annotation preparation records its response origin without claiming annotation settings or submission", async () => {
  const h = harness({ getSelectedHistoryItem: () => ({ id: 'response-two' }) }); h.submitted();
  assert.equal(await h.run(), true); assert.equal(h.c.sourceState.provenance.annotated, true);
  assert.equal(h.c.editorDraftHelpers.buildDraftSaveFilename({ sourceState: h.c.sourceState, text: h.c.sourceTextEl.value }), 'response-2-annotated.md');
});

test("same-text replacement response identity changing during consent keeps the current editor", async () => {
  let id = 'old'; const h = harness({ getSelectedHistoryItem: () => ({ id }) }); const text = h.c.sourceTextEl.value;
  const pending = h.run(); id = 'replacement'; h.decide(true);
  assert.equal(await pending, false); assert.equal(h.c.sourceTextEl.value, text); assert(!h.c.sourceState.provenance);
});

test("new drafts and post-submission edits are protected; cancellation preserves identity and view", async () => {
  for (const postSubmission of [false, true]) {
    const h = harness();
    if (postSubmission) {
      h.submitted();
      h.c.sourceTextEl.value += "\nnew context";
    }
    const text = h.c.sourceTextEl.value;
    const source = h.c.sourceState;
    const promise = h.run();
    assert.equal(h.c.calls[0][0], "confirm");
    assert.equal(await h.run(), false, "cannot open concurrent replacement decisions");
    h.decide(false);
    assert.equal(await promise, false);
    assert.equal(h.c.sourceTextEl.value, text);
    assert.equal(h.c.sourceState, source);
    assert.equal(h.c.editorView, "preview");
    assert.equal(h.c.rightView, "preview");
    assert.equal(h.c.paneFocusTarget, "right");
  }
});

test("explicit replacement is permitted but consent cannot overwrite changed state", async () => {
  const h = harness();
  const accepted = h.run();
  h.decide(true);
  assert.equal(await accepted, true);
  for (const change of [
    (c) => { c.sourceTextEl.value += " typing"; },
    (c) => { c.editorSourceGeneration++; },
    (c) => { c.sourceState = { ...c.sourceState, draftId: "two" }; },
    (c) => { c.latestResponseMarkdown += " changed"; },
    (c) => { c.latestResponseTimestamp++; },
    (c) => { c.responseHistoryIndex++; },
    (c) => { c.fileBackedDiskRevision = "changed"; },
    (c) => { c.uiBusy = true; },
  ]) {
    const next = harness();
    const promise = next.run();
    change(next.c);
    const text = next.c.sourceTextEl.value;
    next.decide(true);
    assert.equal(await promise, false);
    assert.equal(next.c.sourceTextEl.value, text);
    assert.equal(next.c.calls.some(([type]) => type === "text"), false);
  }
});

test("empty and identical text need no warning; even submitted file edits remain unsaved", async () => {
  for (const value of ["", "# Model response"]) {
    const h = harness({ sourceTextEl: { value } });
    assert.equal(await h.run(), true);
    assert.equal(h.c.calls.some(([type]) => type === "confirm"), false);
  }
  for (const value of ["unsaved file", "", "# Model response"]) {
    const h = harness({ sourceTextEl: { value }, sourceState: { source: "file", path: "/file.md" }, dirty: true });
    h.submitted();
    const promise = h.run();
    assert.equal(h.c.calls[0][0], "confirm");
    h.decide(false);
    assert.equal(await promise, false);
  }
});

test("ordinary Load response shares the draft protection without changing views or pane focus", async () => {
  for (const activePane of ["left", "right"]) {
    const h = harness({ activePane, paneFocusTarget: activePane, rightView: "markdown" });
    const source = h.c.sourceState;
    const cancelled = h.run({});
    h.decide(false);
    assert.equal(await cancelled, false);
    assert.equal(h.c.sourceState, source);
    assert.equal(h.c.sourceTextEl.value, "unsent prompt");
    h.submitted();
    assert.equal(await h.run({}), true);
    assert.equal(h.c.sourceTextEl.value, "# Model response");
    assert.equal(h.c.sourceState.source, "last-response");
    assert.equal(h.c.editorView, "preview");
    assert.equal(h.c.rightView, "markdown");
    assert.equal(h.c.activePane, activePane);
    assert.equal(h.c.paneFocusTarget, activePane);
    assert.equal(h.c.calls.some(([action]) => action === "focus"), false);
  }
});

test("Load response cannot detach the file required by Quarto Preview", async () => {
  const h = harness({ rightView: "editor-quarto-preview", sourceState: { source: "file", path: "/file.qmd" }, dirty: true });
  Object.assign(h.c, {
    getCurrentStudioDocumentDescriptor: () => ({ key: "file:/file.qmd" }),
    getCurrentStudioQuartoSourcePath: () => h.c.sourceState.path || "",
    getHtmlPreviewResourceContextOptions: () => ({}),
    makeStudioDraftId: () => "new-draft",
    studioQuartoPathsMatch: (a, b) => a === b,
    clearFileBackedBaseline: () => { h.c.dirty = false; },
    isCurrentStudioQuartoDocument: () => Boolean(h.c.sourceState.path),
    rightViewSelect: { value: "editor-quarto-preview" },
    previewResourceHelpers: { areStudioPreviewResourceContextsEqual: () => true },
  });
  for (const name of ["syncRightViewModeOptions", "updateStudioDocumentUrlState", "updateSourceBadge", "syncActionButtons",
    "updateScratchpadUi", "updateReviewNotesUi", "loadScratchpadForCurrentDocument", "loadReviewNotesForCurrentDocument",
    "requestStudioQuartoPreviewCheck", "refreshResponseUi", "scheduleWorkspacePersistence"]) h.c[name] = () => {};
  // Use the real source transition: detaching this file would silently switch Quarto to Editor Preview.
  vm.runInContext(section(clientSource, "function setSourceState(next, options)", "function normalizeWorkspaceSourceState"), h.c);
  const source = h.c.sourceState;
  assert.equal(await h.run({}), false);
  assert.equal(h.c.sourceState, source);
  assert.equal(h.c.sourceTextEl.value, "unsent prompt");
  assert.equal(h.c.dirty, true);
  assert.equal(h.c.rightView, "editor-quarto-preview");
  assert.equal(h.c.calls.some(([action]) => action === "confirm"), false);
  assert.match(h.c.calls[0][1], /Choose another right-pane view/);
  h.c.setSourceState({ source: "last-response", path: null });
  assert.equal(h.c.rightView, "editor-preview", "prove the actual source transition would leave Quarto");
});

test("Load response also preserves a Quarto view selected during confirmation", async () => {
  const h = harness();
  const promise = h.run({});
  h.c.rightView = "editor-quarto-preview";
  h.decide(true);
  assert.equal(await promise, false);
  assert.equal(h.c.sourceTextEl.value, "unsent prompt");
  assert.equal(h.c.rightView, "editor-quarto-preview");
});

test("annotation stays unavailable in companions, watched views, modals, busy and critique states", async () => {
  for (const flag of ["isEditorOnlyMode", "isWatchedFilePreview", "modalOpen", "uiBusy", "latestResponseIsStructuredCritique"]) {
    const h = harness({ [flag]: true });
    assert.equal(await h.run(), false, flag);
    assert.equal(h.c.calls.length, 0, flag);
  }
});

test("run acceptance is emitted only after Pi accepts direct or steering submission", () => {
  const handler = section(indexSource, 'if (msg.type === "send_run_request")', 'if (msg.type === "completion_suggestion_cancel_request")');
  // Execute the actual server branch with just the Pi API boundary stubbed.
  for (const steering of [false, true]) {
    for (const rejected of [false, true]) {
      const events = [];
      const c = {
        msg: { type: "send_run_request", requestId: "run", text: "prompt" },
        client: {},
        isValidRequestId: () => true,
        canQueueStudioSteeringRequest: () => steering,
        enqueueStudioDirectSteeringRequest: () => ({}),
        queuedStudioDirectRequests: [],
        studioDirectRunChain: null,
        startStudioDirectRunChain: () => ({}),
        beginRequest: () => true,
        clearStudioDirectRunState() {},
        clearActiveRequest() {},
        isStudioDirectRunChainActive: () => true,
        getQueuedStudioSteeringCount: () => 1,
        pi: { sendUserMessage() { events.push("send"); if (rejected) throw new Error("rejected"); } },
        sendToClient: (_client, message) => events.push(message.type),
        broadcast() {},
        broadcastState() {},
        reportPiEditorDraftDisposition: () => events.push("pi-draft"),
      };
      vm.runInNewContext(`(function() { ${handler} })()`, c);
      assert.deepEqual(events, rejected ? ["send", "error"] : ["send", "run_accepted", "pi-draft"]);
    }
  }
  const ack = section(clientSource, 'if (message.type === "run_accepted")', 'if (message.type === "request_started")');
  assert.match(ack, /submittedEditorDrafts\.accept\(message\.requestId\)/);
  assert.doesNotMatch(ack, /sourceTextEl/);
  assert.equal((clientSource.match(/submittedEditorDrafts\.remember\(requestId, sourceTextEl\.value, getEditorDraftSourceKey\(\)\)/g) || []).length, 2);
  assert.equal((clientSource.match(/submittedEditorDrafts\.discard\(/g) || []).length, 4);
  assert.match(clientSource, /submittedEditorDrafts\.clearPending\(\)/);
  assert.match(indexSource, /requestUrl\.pathname === "\/studio-editor-draft-helpers\.js"/);
  assert.ok(indexSource.indexOf('<script src="${editorDraftHelpersScriptHref}">') < indexSource.indexOf('<script src="${clientScriptHref}">'));
});

import test from "node:test";
import assert from "node:assert/strict";
import { createStudioBufferClient, projectStudioBufferEditor } from "../shared/studio-buffer-client.js";
import { createStudioBufferServerStore } from "../shared/studio-buffer-server.js";
import { createStudioBuffer, validateStudioBufferWorkspace } from "../shared/studio-buffer-store.js";
import { createStudioBufferRecoveryDecisions } from "../shared/studio-buffer-decisions.js";
import { migrateStudioWorkspaceV1, STUDIO_BUFFER_RECOVERY_PREFIX, STUDIO_BUFFER_LEGACY_TAB_PREFIX } from "../shared/studio-buffer-recovery.js";

const workspaceId = "tab_" + "c".repeat(32);
const key = STUDIO_BUFFER_RECOVERY_PREFIX + workspaceId;
const revision = "sha256:" + "a".repeat(64);
let next = 0;
const makeBufferId = () => "switch-buffer-" + ++next;
const editor = (text = "Prompt draft", overrides = {}) => ({ version: 1, savedAt: 10,
  sourceState: { source: "blank", label: "draft", path: null, draftId: "original-draft" },
  diskRevision: null, resourceDir: "", text, editorView: "markdown", rightView: "preview", editorLanguage: "markdown",
  followLatest: false, responseHistoryIndex: -1, selectionStart: 0, selectionEnd: 0, scrollTop: 0, ...overrides });
const file = (text = "file text", path = "/example/notes.md") => editor(text, {
  sourceState: { source: "file", label: path.split("/").at(-1), path, draftId: null }, diskRevision: revision, resourceDir: "/example",
});
function storage() {
  const map = new Map();
  return { map, getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: () => assert.fail("Never erase prior recovery") };
}
function setup(overrides = {}) {
  const browser = overrides.storage || storage(), server = overrides.server || createStudioBufferServerStore();
  const mode = overrides.mode || "full", capability = server.issue({ workspaceId, mode }).capability;
  const issues = [];
  const client = createStudioBufferClient({ workspaceId, mode, switching: true, storage: browser, makeBufferId, canRestore: () => true,
    readRemote: async () => server.read(capability), writeRemote: async (state, expected) => server.write(capability, expected, state),
    readLegacyRemote: async () => ({ ok: true, state: null }), onIssue: value => issues.push(value), ...overrides });
  return { client, browser, server, capability, issues };
}
const selected = client => client.snapshot().buffers.find(b => b.id === client.snapshot().selectedBufferId);
const prompt = client => client.snapshot().buffers.find(b => b.id === client.snapshot().activePromptId);
const documentBuffer = client => client.snapshot().buffers.find(b => b.role === "document");

// Fresh full views retain the visible editor as their Prompt, including files.
test("switching bootstraps one Prompt and one independent document without changing visible file-to-Run identity", async () => {
  for (const initial of [editor(), file(), file("")]) {
    const f = setup(); const result = await f.client.initialize(initial, initial.sourceState.path ? initial.text : null);
    assert(result.ok); assert.equal(result.restored, false);
    assert.equal(f.client.snapshot().buffers.length, 2);
    assert.equal(selected(f.client).role, "prompt");
    assert.equal(selected(f.client).id, f.client.snapshot().activePromptId);
    assert.equal(selected(f.client).text, initial.text);
    assert.deepEqual(selected(f.client).sourceState, initial.sourceState);
    assert.equal(selected(f.client).baselineText, initial.sourceState.path ? initial.text : "");
    assert.equal(documentBuffer(f.client).text, "");
    assert.equal(documentBuffer(f.client).sourceState.path, null);
    assert.equal(documentBuffer(f.client).view.rightView, "editor-preview");
    await f.client.settled();
  }
});

test("foundation-only and editor-only clients retain the single-editor behavior and reject switching operations", async () => {
  for (const overrides of [{ switching: false }, { mode: "editor-only" }]) {
    const f = setup(overrides); assert((await f.client.initialize(file(), "file text")).ok);
    assert.equal(selected(f.client).role, "document");
    assert.equal(f.client.select(selected(f.client).id).reason, "switching-disabled");
    assert.equal(f.client.replace(selected(f.client).id, selected(f.client).revision, file("new"), "new").reason, "switching-disabled");
    assert.equal(selected(f.client).text, "file text");
    await f.client.settled();
  }
});

test("selection preserves independent dirty text, file baselines, metadata, views and the active Prompt", async () => {
  const f = setup(); await f.client.initialize(editor(), null);
  const promptId = prompt(f.client).id, doc = documentBuffer(f.client);
  assert(f.client.persist(editor("edited Prompt", { selectionStart: 1, selectionEnd: 5, scrollTop: 12 }), null, {
    view: { selectionDirection: "backward", previewScrollTop: 20, rightScrollTop: 45 },
    metadata: { annotationsEnabled: false, scratchpadKey: "draft:original-draft", reviewNotesKey: "draft:original-draft" },
  }).ok);
  const keptPrompt = prompt(f.client);
  assert(f.client.replace(doc.id, doc.revision, file("unsaved notes"), "disk notes", {
    view: { rightView: "editor-preview", rightScrollTop: 32 }, metadata: { annotationsEnabled: true, scratchpadKey: "file:/example/notes.md", reviewNotesKey: "file:/example/notes.md" },
  }).ok);
  assert.equal(f.client.snapshot().selectedBufferId, promptId, "replacement never implicitly selects its target");
  assert(f.client.select(doc.id).ok);
  assert.equal(f.client.snapshot().activePromptId, promptId);
  assert.equal(selected(f.client).text, "unsaved notes"); assert.equal(selected(f.client).baselineText, "disk notes");
  assert.equal(selected(f.client).diskRevision, revision);
  assert.deepEqual(prompt(f.client), keptPrompt, "selecting a document does not edit the Prompt or advance its revision");
  assert(f.client.select(promptId).ok);
  assert.deepEqual(selected(f.client), keptPrompt);
  await f.client.settled();
  assert.equal(f.client.needsUnloadConfirmation(), false);
  const stored = JSON.parse(f.browser.getItem(key));
  assert.deepEqual(stored.buffers, f.client.snapshot().buffers);
});

test("whole-pair recovery restores the selected document while keeping an empty or edited Prompt separately", async () => {
  for (const promptText of ["", "unfinished Prompt"]) {
    const f = setup(); await f.client.initialize(editor(promptText), null);
    const doc = documentBuffer(f.client), promptId = prompt(f.client).id;
    assert(f.client.replace(doc.id, doc.revision, file("dirty document"), "disk", { view: { rightView: "editor-preview", rightScrollTop: 91 } }).ok);
    assert(f.client.select(doc.id).ok); await f.client.settled();
    const saved = f.client.snapshot();
    const g = setup({ storage: f.browser, server: f.server, decideLegacyPromptRole: () => assert.fail("An ordinary pair is not an old placeholder Prompt") });
    const result = await g.client.initialize(file("newer disk contents"), "newer disk contents");
    assert(result.ok); assert(result.restored);
    assert.equal(result.editor.text, "dirty document"); assert.equal(result.baselineText, "disk");
    assert.equal(g.client.snapshot().selectedBufferId, doc.id); assert.equal(g.client.snapshot().activePromptId, promptId);
    assert.equal(prompt(g.client).text, promptText); assert.deepEqual(g.client.snapshot(), saved);
    await g.client.settled();
  }
});

test("v1 file recovery preserves exact legacy bytes and visible-file Prompt intent without inventing a disk baseline", async () => {
  const f = setup(), legacy = JSON.stringify(file("unsaved old file"));
  f.browser.setItem(STUDIO_BUFFER_LEGACY_TAB_PREFIX + workspaceId, legacy);
  const result = await f.client.initialize(file("current disk"), "current disk");
  assert(result.ok); assert(result.restored); assert.equal(selected(f.client).role, "prompt");
  assert.equal(result.editor.text, "unsaved old file"); assert.equal(result.baselineText, null);
  assert.equal(f.browser.getItem(STUDIO_BUFFER_LEGACY_TAB_PREFIX + workspaceId), legacy);
  await f.client.settled();
});

function oldFileState() {
  return migrateStudioWorkspaceV1(file("old visible file"), { workspaceId, mode: "full", makeBufferId }).state;
}

test("old v2 file-plus-placeholder Prompt requires an explicit role decision and preserves the file either way", async () => {
  for (const choice of ["visible-prompt", "keep-roles", null]) {
    const browser = storage(), old = oldFileState(), raw = JSON.stringify(old); browser.setItem(key, raw);
    let offered;
    const f = setup({ storage: browser, decideLegacyPromptRole: state => { offered = state; return choice; } });
    const result = await f.client.initialize(file("HTML file"), "HTML file");
    assert.deepEqual(offered, old);
    if (choice === null) {
      assert.equal(result.ok, false); assert.equal(browser.getItem(key), raw); assert.equal(f.server.size, 0);
    } else {
      assert(result.ok); assert.equal(selected(f.client).text, "old visible file"); assert.equal(result.baselineText, null);
      assert.equal(f.client.snapshot().selectedBufferId, old.selectedBufferId);
      assert.equal(selected(f.client).role, choice === "visible-prompt" ? "prompt" : "document");
      assert.equal(prompt(f.client).text, choice === "visible-prompt" ? "old visible file" : "");
      await f.client.settled();
    }
  }
});

test("role-choice consent cannot survive startup typing, disposal or changed browser recovery", async () => {
  for (const change of ["typing", "dispose", "storage"]) {
    const browser = storage(), raw = JSON.stringify(oldFileState()); browser.setItem(key, raw);
    let release, current = true;
    const f = setup({ storage: browser, decideLegacyPromptRole: () => new Promise(resolve => { release = resolve; }) });
    const pending = f.client.initialize(file(), "file text", () => current);
    await new Promise(resolve => setImmediate(resolve)); assert.equal(typeof release, "function");
    let expectedRaw = raw;
    if (change === "typing") current = false;
    if (change === "dispose") f.client.dispose();
    if (change === "storage") { expectedRaw = JSON.stringify({ ...oldFileState(), savedAt: 100 }); browser.setItem(key, expectedRaw); }
    release("visible-prompt");
    assert.equal((await pending).ok, false, change);
    assert.equal(browser.getItem(key), expectedRaw, change); assert.equal(f.server.size, 0, change);
  }
});

test("selection and replacement reject unrepresented text, stale revisions, invalid fields and oversize data without retargeting", async () => {
  const f = setup(); await f.client.initialize(editor(), null); await f.client.settled();
  const doc = documentBuffer(f.client), state = f.client.snapshot();
  assert.equal(f.client.select("missing").ok, false); assert.equal(f.client.snapshot(), state);
  assert.equal(f.client.replace(doc.id, doc.revision + 1, file(), "baseline").ok, false); assert.equal(f.client.snapshot(), state);
  assert.equal(f.client.replace(doc.id, doc.revision, file("x".repeat(900001)), "baseline").ok, false); assert.equal(f.client.snapshot(), state);
  assert.equal(f.client.replace(doc.id, doc.revision, file(), "baseline", { view: { rightScrollTop: -1 } }).ok, false); assert.equal(f.client.snapshot(), state);
  assert.equal(f.client.capture(editor("x".repeat(900001)), null).ok, false);
  assert.equal(f.client.select(doc.id).ok, false, "never hide live text that cannot fit in the store");
  assert.equal(f.client.snapshot(), state);
  assert(f.client.capture(editor(), null).ok); assert(f.client.select(doc.id).ok);
  await f.client.settled();
});

test("new full collections remain export-only in the old UI and excessive/parked collections remain export-only in the prototype", async () => {
  const f = setup(); await f.client.initialize(editor(), null); await f.client.settled();
  const oldUi = setup({ switching: false, storage: f.browser, server: f.server });
  assert.equal((await oldUi.client.initialize(editor(), null)).reason, "unsupported-collection");
  const before = f.browser.getItem(key), state = f.client.snapshot();
  const extra = createStudioBuffer({ id: "parked-prompt", role: "prompt", text: "keep this third buffer" });
  const raw = JSON.stringify({ ...state, revision: state.revision + 1, savedAt: state.savedAt + 1, order: [...state.order, extra.id], buffers: [...state.buffers, extra] });
  f.browser.setItem(key, raw);
  const g = setup({ storage: f.browser, server: f.server });
  assert.equal((await g.client.initialize(editor(), null)).reason, "unsupported-collection");
  assert.equal(f.browser.getItem(key), raw); assert.notEqual(before, raw);
});

test("optional right-pane scroll is bounded v2 view state, not arbitrary recovery metadata", () => {
  const state = oldFileState();
  const withScroll = { ...state, buffers: state.buffers.map(b => ({ ...b, view: { ...b.view, rightScrollTop: 123.5 } })) };
  assert.equal(validateStudioBufferWorkspace(withScroll).ok, true);
  for (const rightScrollTop of [-1, Infinity, "10", null]) {
    assert.equal(validateStudioBufferWorkspace({ ...state, buffers: state.buffers.map(b => ({ ...b, view: { ...b.view, rightScrollTop } })) }).ok, false);
  }
  assert.equal(validateStudioBufferWorkspace({ ...state, buffers: state.buffers.map(b => ({ ...b, view: { ...b.view, unknownPosition: 1 } })) }).reason, "unknown-field");
});

test("recovery Keep current and Use copy retain the complete live pair in a fresh namespace", async () => {
  const f = setup(); await f.client.initialize(editor("unsent Prompt"), null);
  const doc = documentBuffer(f.client);
  f.client.replace(doc.id, doc.revision, file("unsaved notes"), "disk notes"); f.client.select(doc.id); await f.client.settled();
  const state = f.client.snapshot(), oldRaw = f.browser.getItem(key);
  let nextWorkspace = 0;
  const owner = createStudioBufferRecoveryDecisions({ switching: true, storage: f.browser, workspaceId, mode: "full",
    canRestore: value => value.sourceState.path === "/example/notes.md",
    makeWorkspaceId: () => "tab_" + "d".repeat(30) + String(++nextWorkspace).padStart(2, "0"),
    readRemote: async () => f.server.inspect(f.capability),
  });
  const inspection = await owner.inspect(); assert(inspection.ok);
  const copy = inspection.records.find(r => r.id === "browser-v2"); assert.equal(copy.canUse, true);
  const kept = owner.keepCurrent(projectStudioBufferEditor(state), "disk notes", {}, () => true, state);
  assert(kept.ok); assert.deepEqual(kept.state.buffers, state.buffers);
  assert.equal(kept.state.activePromptId, state.activePromptId); assert.equal(kept.state.selectedBufferId, doc.id);
  const used = await owner.use(copy); assert(used.ok); assert.deepEqual(used.state.buffers, state.buffers);
  assert.equal(f.browser.getItem(key), oldRaw);
});

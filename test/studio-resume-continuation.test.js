import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { createStudioBuffer, validateStudioBufferWorkspace } from "../shared/studio-buffer-store.js";
import { createStudioBufferServerStore } from "../shared/studio-buffer-server.js";
import { createStudioBufferClient } from "../shared/studio-buffer-client.js";
import { studioDocumentMetadataKey } from "../shared/studio-document-hosting.js";
import { STUDIO_BUFFER_LEGACY_TAB_PREFIX, STUDIO_BUFFER_RECOVERY_PREFIX as PREFIX } from "../shared/studio-buffer-recovery.js";

// Oliver, 11 Oct: no "Resume this retained workspace?" after a clean reload or reopen.
// Sol, candidate67: the evidence is the departing owner's own word, recorded server-side,
// single use, and only lets the next page adopt that exact unchanged snapshot.
const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
const main = "main_" + "a".repeat(24), other = "other_" + "b".repeat(24);
const nonce = n => n.toString(16).padStart(48, "0");
const state = (id = main, text = "draft", revision = 1, doc = "doc") => validateStudioBufferWorkspace({ version: 2, workspaceId: id, mode: "editor-only", revision, savedAt: revision,
  selectedBufferId: doc, activePromptId: null, order: [doc], buffers: [createStudioBuffer({ id: doc, role: "document", text, revision })] }).state;

function owner(server, workspaceId = main) {
  const cap = server.issue({ workspaceId, mode: "editor-only" }).capability, handle = {};
  const lease = server.bindHostingView(cap, "editor-only", handle);
  return { cap, handle, lease, generation: lease.generation };
}
function fixture() {
  const server = createStudioBufferServerStore({ hosting: { canonicalPath: p => p, requireView: true } });
  const a = owner(server);
  assert(server.write(a.cap, null, state(), a.generation).ok);
  const revision = () => server.read(a.cap).revision;
  const leave = (o = a, extra = {}) => server.hostingCleanLeave(o.cap, o.handle, { generation: o.generation, revision: revision(), ...extra });
  return { server, a, revision, leave };
}

test("only the current owner, at its own generation and exact checkpoint, can record a clean departure", () => {
  const f = fixture();
  assert.equal(f.server.hostingCleanLeave(f.a.cap, {}, { generation: f.a.generation, revision: f.revision() }).reason, "forbidden", "another socket");
  assert.equal(f.leave(f.a, { generation: f.a.generation + 1 }).reason, "not-clean");
  assert.equal(f.leave(f.a, { revision: "f".repeat(48) }).reason, "not-clean");
  assert.equal(f.server.hasCleanLeave(main), false);
  assert(f.leave().ok); assert.equal(f.server.hasCleanLeave(main), true);
});

test("the next new lease takes it once; a refused bind and a rebind never take it; competing binds: one wins", () => {
  const f = fixture(), R = f.revision();
  assert(f.leave().ok);
  const early = f.server.issue({ workspaceId: main, mode: "editor-only" }).capability;
  assert.equal(f.server.bindHostingView(early, "editor-only", {}).reason, "view-already-open", "refused while the old socket is open");
  assert.equal(f.server.hasCleanLeave(main), true, "a refused bind doesn't consume");
  f.server.releaseHostingView(f.a.cap, f.a.handle);
  const b = owner(f.server);
  assert.deepEqual(b.lease.continuation, { revision: R });
  assert.equal(f.server.bindHostingView(b.cap, "editor-only", b.handle).continuation, undefined, "a rebind of the same connection");
  const c = f.server.issue({ workspaceId: main, mode: "editor-only" }).capability;
  assert.equal(f.server.bindHostingView(c, "editor-only", {}).reason, "view-already-open", "the competing bind is refused");
  f.server.releaseHostingView(b.cap, b.handle);
  assert.equal(owner(f.server).lease.continuation, undefined, "single use");
});

test("an unchanged retry (the departing flush) leaves it; any change voids it", () => {
  const f = fixture(), R = f.revision();
  assert(f.leave().ok);
  assert.equal(f.server.write(f.a.cap, R, state(), f.a.generation).revision, R, "exact retry");
  assert.equal(f.server.hasCleanLeave(main), true);
  const changed = f.server.write(f.a.cap, R, state(main, "newer", 2), f.a.generation, f.server.read(f.a.cap).documents);
  assert(changed.ok, changed.message);
  assert.equal(f.server.hasCleanLeave(main), false);
  f.server.releaseHostingView(f.a.cap, f.a.handle);
  assert.equal(owner(f.server).lease.continuation, undefined);
});

test("metadata activity that starts and finishes voids it, and pending metadata blocks recording", async () => {
  const f = fixture();
  const remote = f.server.read(f.a.cap), key = studioDocumentMetadataKey(remote.state.buffers[0], "scratchpadKey");
  const request = { generation: f.a.generation, bufferId: "doc", documentEpoch: remote.documents.doc };
  assert(f.leave().ok);
  assert((await f.server.hostingMetadata(f.a.cap, request, "scratchpad", key, async () => {})).ok);
  assert.equal(f.server.hasCleanLeave(main), false, "finished activity still voids");
  let finish; const held = f.server.hostingMetadata(f.a.cap, request, "scratchpad", key, () => new Promise(resolve => { finish = resolve; }));
  assert.equal(f.leave().reason, "not-clean", "pending metadata");
  finish(); await held;
  assert(f.leave().ok);
});

test("an incoming move voids the target's record and blocks its admission", () => {
  const f = fixture();
  const source = owner(f.server, other);
  assert(f.server.write(source.cap, null, state(other, "moving", 1, "moving"), source.generation).ok);
  const begin = n => f.server.hostingMove(source.cap, { operation: "begin", moveId: nonce(n), bufferId: "moving", generation: source.generation,
    expectedRevision: f.server.read(source.cap).revision, targetWorkspaceId: main, targetMode: "editor-only" });
  assert(f.leave().ok);
  const begun = begin(7); assert(begun.ok, begun.message);
  assert.equal(f.server.hasCleanLeave(main), false);
  const cancelled = f.server.hostingMove(source.cap, { operation: "cancel", moveId: nonce(7), generation: source.generation, expectedRevision: f.server.read(source.cap).revision });
  assert(cancelled.ok, cancelled.message); // the source ends the offer; the target did nothing
  assert.equal(f.server.hasCleanLeave(main), false, "still void once the offer has ended");
  assert(begin(8).ok);
  assert.equal(f.leave().reason, "not-clean", "an offered move to this workspace is pending");
});

// ---- Client: the continuation only admits the exact unchanged server snapshot.
const workspaceId = "tab_" + "c".repeat(32);
const editor = text => ({ version: 1, savedAt: 1, text, sourceState: { source: "blank", path: null, draftId: "draft", label: "Document" }, diskRevision: null, resourceDir: "",
  editorView: "markdown", rightView: "editor-preview", editorLanguage: "markdown", followLatest: false, responseHistoryIndex: -1, selectionStart: 0, selectionEnd: 0, scrollTop: 0 });
function storage() { const values = new Map(); return { values, getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) }; }
function makeClient(server, capability, store, extra = {}) {
  const writes = [];
  const client = createStudioBufferClient({ workspaceId, mode: "editor-only", storage: store, makeBufferId: () => "doc-" + Math.random().toString(16).slice(2), canRestore: () => true,
    readRemote: async () => server.read(capability), writeRemote: async (s, r) => { writes.push(s); return extra.failWrites ? { ok: false, reason: "unavailable", message: "down" } : server.write(capability, r, s); },
    readLegacyRemote: async () => ({ ok: true, state: null }), onIssue() {}, ...extra.options });
  return { client, writes };
}
async function primed() {
  const server = createStudioBufferServerStore(), capability = server.issue({ workspaceId, mode: "editor-only" }).capability, tab = storage();
  const first = makeClient(server, capability, tab);
  assert((await first.client.initialize(editor("hello"), "")).ok); await first.client.settled();
  return { server, capability, tab, first, R: server.read(capability).revision };
}
const admit = (revision, isCurrent = () => true) => ({ revision, isCurrent });

test("same tab or a fresh tab: the admitted snapshot is adopted with no publication", async () => {
  const p = await primed();
  assert.equal(p.first.client.cleanDepartureRevision(), p.R);
  for (const tab of [p.tab, storage()]) {
    const next = makeClient(p.server, p.capability, tab);
    const result = await next.client.initialize(editor(""), "", () => true, admit(p.R));
    assert(result.ok, result.message); assert.equal(result.editor.text, "hello");
    await next.client.settled(); assert.deepEqual(next.writes, [], "nothing published");
    assert.equal(next.client.cleanDepartureRevision(), p.R);
  }
});

test("Sol's case: a matching revision with a newer local branch asks instead of publishing it", async () => {
  const p = await primed();
  const stale = makeClient(p.server, p.capability, p.tab, { failWrites: true });
  assert((await stale.client.initialize(editor(""), "")).ok);
  assert(stale.client.persist(editor("unacknowledged edit"), "").ok); await stale.client.settled();
  assert.equal(stale.client.cleanDepartureRevision(), null, "unacknowledged work is never clean");
  const before = new Map(p.tab.values);
  const next = makeClient(p.server, p.capability, p.tab);
  const result = await next.client.initialize(editor(""), "", () => true, admit(p.R));
  assert.equal(result.reason, "needs-decision");
  assert.deepEqual(next.writes, []); assert.deepEqual(p.tab.values, before, "the differing copy is kept untouched");
});

test("a different revision, or a reconnect during reading, asks", async () => {
  const p = await primed();
  assert.equal((await makeClient(p.server, p.capability, storage()).client.initialize(editor(""), "", () => true, admit("e".repeat(48)))).reason, "needs-decision");
  let current = true;
  const reconnecting = makeClient(p.server, p.capability, storage(), { options: { readRemote: async () => { current = false; return p.server.read(p.capability); } } });
  assert.equal((await reconnecting.client.initialize(editor(""), "", () => true, admit(p.R, () => current))).reason, "needs-decision");
});

test("the admitted read keeps its original request-start time as its expiry basis", async () => {
  const p = await primed();
  let time = 1000;
  const next = makeClient(p.server, p.capability, storage(), { options: { now: () => time,
    readRemote: async () => { const result = p.server.read(p.capability); time = 5000; return { ...result, expiresInMs: 10_000 }; } } });
  assert((await next.client.initialize(editor(""), "", () => true, admit(p.R))).ok);
  time = 10_999; assert.equal(next.client.needsUnloadConfirmation(), false);
  time = 11_000; assert.equal(next.client.needsUnloadConfirmation(), true, "1000 + 10000, not 5000 + 10000");
});

// Sol (candidate67 hold): this tab's own retained records, read without writing, with the
// production hosting setup. Pending or unreadable tracking and older-format copies ask.
const copyRequest = { operationId: "1".repeat(48), bufferId: "doc", documentEpoch: 1, expectedRevision: "2".repeat(48) };
const launchRequest = { ...copyRequest, kind: "blank", path: "", sourcePath: "", resourceDir: "" };
const destination = kind => ({ operationId: "3".repeat(48), sourceBufferId: "doc", workspaceId: "host_" + "d".repeat(24), bufferId: "copy_x", kind, created: true });
const records = {
  pendingCopy: tab => tab.setItem(PREFIX + workspaceId + ":copy", JSON.stringify({ version: 1, request: copyRequest })),
  unreadableCopy: tab => tab.setItem(PREFIX + workspaceId + ":copy", "{not json"),
  pendingLaunch: tab => tab.setItem(PREFIX + workspaceId + ":launch", JSON.stringify({ version: 1, request: launchRequest })),
  unreadableLaunch: tab => tab.setItem(PREFIX + workspaceId + ":launch", JSON.stringify({ version: 9 })),
  olderFormatCopy: tab => tab.setItem(STUDIO_BUFFER_LEGACY_TAB_PREFIX + workspaceId, JSON.stringify(editor("an older single-editor copy"))),
};
test("a matching revision still asks when this tab has pending or unreadable Copy/Launch tracking, or an older-format copy", async () => {
  for (const [name, plant] of Object.entries(records)) {
    const p = await primed();
    plant(p.tab);
    const before = new Map(p.tab.values);
    const next = makeClient(p.server, p.capability, p.tab, { options: { hosting: true } });
    const result = await next.client.initialize(editor(""), "", () => true, admit(p.R));
    assert.equal(result.reason, "needs-decision", name);
    await next.client.settled();
    assert.deepEqual(next.writes, [], name + ": nothing published"); assert.deepEqual(p.tab.values, before, name + ": nothing written or migrated");
  }
});

test("finished Copy/Launch destinations don't block, and records that change during reading do", async () => {
  const p = await primed();
  p.tab.setItem(PREFIX + workspaceId + ":copy", JSON.stringify({ version: 2, request: null, destinations: [destination("copy")] }));
  p.tab.setItem(PREFIX + workspaceId + ":launch", JSON.stringify({ version: 2, request: null, destinations: [destination("blank")] }));
  const next = makeClient(p.server, p.capability, p.tab, { options: { hosting: true } });
  const result = await next.client.initialize(editor(""), "", () => true, admit(p.R));
  assert(result.ok, result.message); await next.client.settled(); assert.deepEqual(next.writes, []);
  const changing = await primed();
  const raced = makeClient(changing.server, changing.capability, changing.tab, { options: { hosting: true,
    readRemote: async () => { records.pendingCopy(changing.tab); return changing.server.read(changing.capability); } } });
  assert.equal((await raced.client.initialize(editor(""), "", () => true, admit(changing.R))).reason, "needs-decision", "written while the server was being read");
});

// ---- Page wiring.
function declaration(name) {
  const start = source.search(new RegExp("\\n      (?:async )?function " + name + "\\("));
  assert(start >= 0, name);
  return source.slice(start, source.indexOf("\n      }\n", start) + 9);
}
test("a page vouches only when every check holds now", () => {
  const OPEN = 1, controller = { needsUnloadConfirmation: () => false, operationPending: () => false, moveState: () => ({ adoptionPending: null }) };
  const clean = () => ({ WebSocket: { OPEN }, documentHostingEnabled: true, documentHostingGeneration: 3, ws: { readyState: OPEN }, bufferPageClosed: false, bufferRecoveryKeptClosed: false,
    bufferRecoveryInitializing: false, bufferRecoveryClient: { cleanDepartureRevision: () => "a".repeat(48) }, documentHostingController: { ...controller }, documentOpenController: { active: () => false },
    documentHostingRetired: false, documentHostingSaveResolution: null, documentHostingPreparingFile: false, pendingSaveOperations: new Map(), hasUnsyncedStudioMetadata: () => false });
  const run = c => { vm.createContext(c); vm.runInContext(declaration("studioCleanDepartureRevision"), c); return c.studioCleanDepartureRevision(); };
  assert.equal(run(clean()), "a".repeat(48));
  const blockers = {
    disconnected: c => { c.ws.readyState = 3; }, noLease: c => { c.documentHostingGeneration = 0; }, keptClosed: c => { c.bufferRecoveryKeptClosed = true; },
    retired: c => { c.documentHostingRetired = true; }, saveResolving: c => { c.documentHostingSaveResolution = Promise.resolve(); }, savePreparing: c => { c.documentHostingPreparingFile = true; },
    saveInFlight: c => { c.pendingSaveOperations.set("x", {}); }, metadata: c => { c.hasUnsyncedStudioMetadata = () => true; },
    copyOrDestination: c => { c.documentHostingController.needsUnloadConfirmation = () => true; }, movePreparing: c => { c.documentHostingController.operationPending = () => true; },
    adoptionAwaitingAck: c => { c.documentHostingController.moveState = () => ({ adoptionPending: { moveId: "m" } }); }, opening: c => { c.documentOpenController.active = () => true; },
    unacknowledged: c => { c.bufferRecoveryClient.cleanDepartureRevision = () => null; },
  };
  for (const [name, block] of Object.entries(blockers)) { const c = clean(); block(c); assert.equal(run(c) ?? null, null, name); }
});

test("pagehide decides, sends on the owning socket and seals in one turn, only when not persisted", () => {
  const handler = source.slice(source.indexOf('window.addEventListener("pagehide", (event) => {'), source.indexOf('window.addEventListener("beforeunload"'));
  assert.match(handler, /if \(!event\.persisted\) \{\n\s+\/\/ [^\n]+\n\s+const cleanRevision = studioCleanDepartureRevision\(\);\n\s+if \(cleanRevision\) try \{ ws\.send\(JSON\.stringify\(\{ type: "hosting_clean_leave", generation: documentHostingGeneration, revision: cleanRevision \}\)\); \} catch \{\}\n\s+bufferPageClosed = true;/);
  assert.ok(handler.indexOf("flushStudioNavigationPersistence()") < handler.indexOf("studioCleanDepartureRevision()"), "uncaptured typing makes the page unclean");
  assert.doesNotMatch(declaration("studioCleanDepartureRevision"), /NavigationConsent/, "consent to leave never counts");
});

test("the continuation belongs to one connection; init skips the question only through the admitted path", () => {
  assert.match(source, /documentHostingContinuation = continuation && typeof continuation\.revision === "string" && \/\^\[a-f0-9\]\{48\}\$\/\.test\(continuation\.revision\)\n\s+\? \{ revision: continuation\.revision, generation: documentHostingGeneration, connection: bufferConnectionGeneration \} : null;/);
  assert.match(source, /bufferConnectionGeneration\+\+;\n\s+documentHostingGeneration = 0; documentHostingContinuation = null;/);
  assert.match(source, /if \(document\.body\.dataset\.hostingResume === "1"\) \{\n\s+admitted = documentHostingContinuation; documentHostingContinuation = null;\n\s+if \(!admitted\) await resumeOrKeepClosed\(\);/);
  assert.match(source, /admitted && \{ revision: admitted\.revision, isCurrent: \(\) => !bufferPageClosed && bufferConnectionGeneration === admitted\.connection\n\s+&& documentHostingGeneration === admitted\.generation && !hasUnsyncedStudioMetadata\(\) \}\);/);
  assert.match(source, /if \(!restored\.ok && restored\.reason === "needs-decision"\) \{\n\s+\/\/ [^\n]+\n\s+client\.dispose\(\); bufferRecoveryIssue = "";\n\s+await resumeOrKeepClosed\(\); await waitForDocumentHostingLease\(\);\n\s+initialRecoveryOwner = captureBufferRecoveryInitializationOwner\(\);\n\s+client = createRecoveryClient\(\);/);
});

test("the server routes the note from the hosted socket and hands the continuation to that connection", () => {
  assert.match(index, /if \(msg\.type === "hosting_clean_leave" && Number\.isSafeInteger\(msg\.generation\) && typeof msg\.revision === "string" && \/\^\[a-f0-9\]\{48\}\$\/\.test\(msg\.revision\)\)/);
  assert.match(index, /if \(hosted && !studioMovedAwayCapabilities\.has\(hosted\.capability\)\) studioBufferStateStore\.hostingCleanLeave\(hosted\.capability, client, \{ generation: msg\.generation, revision: msg\.revision \}\);/);
  assert.match(index, /documentHosting: \{ workspaceId: hosted\.workspaceId, generation: hosted\.generation, \.\.\.\(hosted\.continuation \? \{ continuation: hosted\.continuation \} : \{\}\) \}/);
  assert.match(index, /studioBufferStateStore\.hasCleanLeave\(owner\.workspaceId\) \? "Opening the retained workspace\."/);
});

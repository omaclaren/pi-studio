import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createStudioRunLifecycle } from "../shared/studio-run-lifecycle.js";

const index = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
const client = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const section = (source, start, end) => { const a = source.indexOf(start), b = source.indexOf(end, a); assert(a >= 0 && b > a); return source.slice(a, b); };
function ledger() { let sequence = 0; return createStudioRunLifecycle({ makeId: () => "run-" + ++sequence, now: () => 10000 }); }

for (const kind of ["direct", "critique", "show-me", "annotation"]) test("SDK run retains " + kind + " cancellation identity after its response slot clears", () => {
  const actor = ledger(); let request = { id: "request", kind, startedAt: 5000 };
  actor.start(request); request = null;
  assert.equal(actor.snapshot().run.requestId, "request"); assert.equal(actor.snapshot().run.cancellable, true);
  actor.start(request); assert.equal(actor.snapshot().run.id, "run-1", "automatic continuation is not a fresh ownership claim");
  actor.settled(); assert.equal(actor.snapshot().run, null);
});

test("missing identity means unresolved origin, never verified outside Studio", () => {
  const actor = ledger(); actor.start(); assert.equal(actor.snapshot().run.origin, "unknown"); assert.equal(actor.snapshot().run.cancellable, false);
  actor.settled(); actor.input("interactive"); actor.start(); assert.equal(actor.snapshot().run.origin, "outside");
  actor.settled(); actor.input("extension"); actor.start(); assert.equal(actor.snapshot().run.origin, "unknown");
});

test("nested automatic compaction preserves a legitimate run target, including retry", () => {
  const actor = ledger(); actor.start({ id: "owned", kind: "direct" });
  actor.compactStart({ reason: "overflow", willRetry: true });
  assert.equal(actor.snapshot().run.phase, "compacting"); assert.equal(actor.snapshot().run.cancellable, true);
  actor.compactEnd(); actor.start(); assert.equal(actor.snapshot().run.id, "run-1"); assert.equal(actor.snapshot().run.phase, "running");
});

test("manual compaction alone does not grant cancellation of a main run", () => {
  const actor = ledger(); actor.compactStart({ reason: "manual" });
  assert.equal(actor.snapshot().run, null); assert.equal(actor.snapshot().compaction.reason, "manual");
  assert.equal(actor.stop("request", "run-1", () => assert.fail("must not deliver")).ok, false);
  actor.compactEnd(); assert.equal(actor.snapshot().compaction, null);
});

test("abort delivery and duplicate acknowledgement keep Stopping until SDK settlement", () => {
  const actor = ledger(); actor.start({ id: "owned", kind: "direct" }); let calls = 0;
  assert(actor.stop("owned", "run-1", () => calls++).ok);
  assert.equal(actor.snapshot().run.phase, "stopping"); assert.equal(actor.snapshot().run.cancellable, false);
  assert(actor.stop("owned", "run-1", () => calls++).ok); assert.equal(calls, 1);
  actor.compactStart({ reason: "threshold" }); assert.equal(actor.snapshot().run.phase, "stopping");
  actor.settled(); assert.equal(actor.snapshot().run, null);
});

test("wrong request, stale run and delivery failure cannot retire or stop newer work", () => {
  const actor = ledger(); actor.start({ id: "owned", kind: "direct" });
  assert.equal(actor.stop("other", "run-1", () => assert.fail()).ok, false);
  actor.settled(); actor.start({ id: "owned", kind: "direct" });
  assert.equal(actor.stop("owned", "run-1", () => assert.fail()).ok, false);
  assert.equal(actor.stop("owned", "run-2", () => { throw new Error("delivery failed"); }).ok, false);
  assert.equal(actor.snapshot().run.stopping, false);
});

test("synchronous settlement or new work during abort delivery cannot mark the replacement stopping", () => {
  const actor = ledger(); actor.start({ id: "owned", kind: "direct" });
  assert(actor.stop("owned", "run-1", () => { actor.settled(); actor.start({ id: "next", kind: "critique" }); }).ok);
  assert.equal(actor.snapshot().run.id, "run-2"); assert.equal(actor.snapshot().run.stopping, false);
});

test("snapshot callers cannot mutate retained authority", () => {
  const actor = ledger(); actor.start({ id: "owned", kind: "direct" });
  actor.snapshot().run.origin = "outside"; assert.equal(actor.snapshot().run.origin, "studio");
});

function clientHarness() {
  const sent = [], c = vm.createContext({ studioRuntimeActivity: null, studioStopRequestedRunId: null, studioRuntimeClock: null,
    studioUiRefreshUi: null, wsState: "Ready", uiBusy: false, pendingRequestId: null, pendingKind: null,
    isEditorOnlyMode: false, isWatchedFilePreview: false, syncStudioRunFollowingFromMessage() {}, pauseStudioRunFollowing() {},
    syncActionButtons() {}, clearArmedTitleAttention() {}, setStatus() {}, sendMessage: message => { sent.push(message); return true; },
    Date: { now: () => 20000 }, getStudioBusyStatus: () => "Starting…" });
  vm.runInContext(section(client, "      function applyStudioRuntimeActivity(", "      function applyStudioRunQueueStateFromMessage("), c);
  vm.runInContext(section(client, "      function getAbortablePendingKind()", "      function syncRunAndCritiqueButtons()"), c);
  return { c, sent };
}
function publish(f, actor) { f.c.applyStudioRuntimeActivity({ runtimeActivity: actor.snapshot() }); }

test("production client Stop survives missing pending-request presentation and sends both exact IDs", () => {
  const f = clientHarness(), actor = ledger(); actor.start({ id: "owned", kind: "direct" }); publish(f, actor);
  assert.equal(f.c.getAbortablePendingKind(), "direct");
  assert(f.c.requestCancelForPendingRequest("direct"));
  assert.equal(JSON.stringify(f.sent), JSON.stringify([{ type: "cancel_request", requestId: "owned", runId: "run-1" }]));
  assert.equal(f.c.getAbortablePendingKind(), null, "local delivery latch refuses repeated activation");
  assert.equal(f.c.getStudioRuntimeStatusText(), "Stopping…");
  assert.equal(f.c.requestCancelForPendingRequest("direct"), false);
});

test("production client shows compaction and disconnect without claiming cancellation remains deliverable", () => {
  const f = clientHarness(), actor = ledger(); actor.start({ id: "owned", kind: "direct" }); actor.compactStart({ reason: "overflow" }); publish(f, actor);
  assert.equal(f.c.getAbortablePendingKind(), "direct"); assert.equal(f.c.getStudioRuntimeStatusText(), "Compacting context…");
  f.c.wsState = "Disconnected";
  assert.equal(f.c.getAbortablePendingKind(), null); assert.equal(f.c.getStudioRuntimeStatusText(), "Run status unknown · reconnecting…");
  assert.equal(f.c.requestCancelForPendingRequest("direct"), false); assert.equal(f.sent.length, 0);
  f.c.wsState = "Ready"; publish(f, actor); assert.equal(f.c.getAbortablePendingKind(), "direct");
});

test("fresh reconnect authority releases an undelivered Stop latch, never server-confirmed Stopping", () => {
  const f = clientHarness(), actor = ledger(); actor.start({ id: "owned", kind: "direct" }); publish(f, actor);
  assert(f.c.requestCancelForPendingRequest("direct")); f.c.wsState = "Disconnected";
  assert.equal(f.c.getAbortablePendingKind(), null);
  f.c.wsState = "Ready"; f.c.applyStudioRuntimeActivity({ type: "hello_ack", runtimeActivity: actor.snapshot() });
  assert.equal(f.c.studioStopRequestedRunId, null); assert.equal(f.c.getAbortablePendingKind(), "direct");
  assert(f.c.requestCancelForPendingRequest("direct")); actor.stop("owned", "run-1", () => {});
  f.c.applyStudioRuntimeActivity({ type: "hello_ack", runtimeActivity: actor.snapshot() });
  assert.equal(f.c.getAbortablePendingKind(), null); assert.equal(f.c.getStudioRuntimeStatusText(), "Stopping…");
  assert.equal(f.sent.length, 2);
});

test("editor-only and watched clients gain no cancellation authority from shared main-run telemetry", () => {
  const f = clientHarness(), actor = ledger(); actor.start({ id: "owned", kind: "direct" }); publish(f, actor);
  f.c.isEditorOnlyMode = true; assert.equal(f.c.getAbortablePendingKind(), null);
  assert.equal(f.c.requestCancelForPendingRequest("direct"), false);
  f.c.isEditorOnlyMode = false; f.c.isWatchedFilePreview = true; assert.equal(f.c.getAbortablePendingKind(), null);
  assert.equal(f.sent.length, 0);
});

test("production client preserves outside/unresolved distinction and clears only at authoritative settlement", () => {
  const f = clientHarness(), actor = ledger(); actor.start(); publish(f, actor);
  assert.equal(f.c.getStudioRuntimeStatusText(), "Pi is busy · run origin unknown"); assert.equal(f.c.getAbortablePendingKind(), null);
  actor.settled(); actor.input("rpc"); actor.start(); publish(f, actor);
  assert.equal(f.c.getStudioRuntimeStatusText(), "Pi is busy · started outside Studio");
  actor.settled(); publish(f, actor); assert.equal(f.c.getStudioRuntimeStatusText(), "");
});

test("production client refuses malformed authority and does not erase a known target on unrelated packets", () => {
  const f = clientHarness(), actor = ledger(); actor.start({ id: "owned", kind: "direct" }); publish(f, actor);
  f.c.applyStudioRuntimeActivity({ type: "info" }); assert.equal(f.c.getAbortablePendingKind(), "direct");
  f.c.applyStudioRuntimeActivity({ runtimeActivity: { run: { id: "bad", origin: "studio", kind: "bash", requestId: "owned", startedAt: 1, cancellable: true } } });
  assert.equal(f.c.getAbortablePendingKind(), null);
});

test("actual SDK registration settles only at agent_settled, not agent_end", async () => {
  const handlers = new Map(), actor = ledger();
  const c = vm.createContext({ pi: { on: (name, fn) => handlers.set(name, fn) }, studioRunLifecycle: actor,
    studioRunLastStopReason: null, studioRunInputRequestIds: new Set(),
    activeRequest: { id: "owned", kind: "direct" }, agentBusy: false, suppressedStudioResponse: null,
    pendingTurnPrompt: null, pendingStudioPromptMetadata: null, pendingStudioCompletionKind: null,
    resetStudioTraceForRun() {}, emitDebugEvent() {}, setTerminalActivity() {}, refreshContextUsage() {}, setStudioTraceRunStatus() {},
    isStudioDirectRunChainActive: () => true, getQueuedStudioSteeringCount: () => 0, clearStudioDirectRunState() {},
    clearPendingStudioCompletion() {}, flushPendingStudioCompletionNotification() {}, broadcastState() {}, broadcast() {},
    clearActiveRequest: () => { c.activeRequest = null; } });
  const snippets = section(index, '\tpi.on("input",', '\tpi.on("tool_call",') + section(index, '\tpi.on("agent_settled",', '\tpi.on("session_shutdown",');
  vm.runInContext(ts.transpileModule(snippets, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, c);
  await handlers.get("session_before_compact")({ reason: "manual", willRetry: false });
  assert.equal(actor.snapshot().run, null, "manual compaction alone does not grant a main target");
  await handlers.get("session_compact_failed")();
  await handlers.get("session_before_compact")({ reason: "threshold", willRetry: false });
  assert.equal(actor.snapshot().run.requestId, "owned", "automatic pre-prompt compaction is inside this SDK run");
  assert.equal(actor.snapshot().run.phase, "compacting");
  await handlers.get("session_compact")();
  await handlers.get("agent_start")(); assert.equal(actor.snapshot().run.requestId, "owned");
  c.activeRequest = null; assert.equal(handlers.has("agent_end"), false);
  assert.equal(actor.snapshot().run.cancellable, true);
  actor.stop("owned", "run-1", () => {});
  let continuedAbort = 0;
  await handlers.get("agent_start")({}, { abort() { continuedAbort++; } });
  assert.equal(continuedAbort, 1, "a stopped run's new agent signal receives abort before continuation");
  await handlers.get("before_provider_request")({}, { abort() { continuedAbort++; } });
  assert.equal(continuedAbort, 2, "provider preparation also fences delayed agent-start observer dispatch");
  assert.equal(actor.snapshot().run.id, "run-1");
  await handlers.get("agent_settled")(); assert.equal(actor.snapshot().run, null); assert.equal(c.agentBusy, false);
});

test("production presentation keeps a disabled Stop in right focus on disconnect and Stopping until settlement", () => {
  const f = clientHarness(), actor = ledger();
  f.c.studioUiRefreshUi = { runStatus: {}, headerRunStatus: {}, headerStop: {} };
  f.c.sendRunBtn = { classList: { toggle() {} } }; f.c.paneFocusTarget = "right";
  f.c.window = { setInterval: () => 1, clearInterval() {} };
  actor.start({ id: "owned", kind: "direct" }); publish(f, actor);
  assert.equal(f.c.studioUiRefreshUi.headerStop.hidden, false); assert.equal(f.c.studioUiRefreshUi.headerStop.disabled, false);
  f.c.wsState = "Disconnected"; f.c.syncStudioRuntimePresentation();
  assert.equal(f.c.studioUiRefreshUi.headerStop.hidden, false); assert.equal(f.c.studioUiRefreshUi.headerStop.disabled, true);
  assert.equal(f.c.studioUiRefreshUi.headerRunStatus.textContent, "Run status unknown · reconnecting…");
  f.c.wsState = "Ready"; actor.stop("owned", "run-1", () => {}); publish(f, actor);
  assert.equal(f.c.sendRunBtn.textContent, "Stopping…"); assert.equal(f.c.studioUiRefreshUi.headerStop.disabled, true);
  actor.settled(); publish(f, actor); assert.equal(f.c.studioUiRefreshUi.headerStop.hidden, true);
});

test("actual backend canceller retains runtime ownership after response and fences stale delivery", () => {
  const actor = ledger(); actor.start({ id: "owned", kind: "direct" }); let aborts = 0, clears = 0;
  const c = vm.createContext({ studioRunLifecycle: actor, activeRequest: null,
    lastCommandCtx: { abort() { aborts++; } }, clearStudioDirectRunState() { clears++; }, clearPendingStudioCompletion() {},
    suppressedStudioResponse: null, broadcastState() {}, broadcast() {} });
  const body = section(index, "\tconst cancelActiveRequest =", "\tconst activateRequest =");
  vm.runInContext(ts.transpileModule(body + "\nglobalThis.cancel = cancelActiveRequest;", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, c);
  assert.equal(c.cancel("owned", "stale-run").ok, false); assert.equal(aborts, 0);
  assert(c.cancel("owned", "run-1").ok); assert.equal(aborts, 1); assert.equal(clears, 1);
  assert.equal(actor.snapshot().run.phase, "stopping"); assert.equal(c.suppressedStudioResponse.requestId, "owned");
  actor.settled(); actor.start({ id: "new", kind: "direct" });
  assert.equal(c.cancel("owned", "run-1").ok, false); assert.equal(aborts, 1);
});

test("actual client dispatcher does not infer settlement from response or cancellation rejection", () => {
  const f = clientHarness(), actor = ledger(); actor.start({ id: "owned", kind: "direct" });
  f.c.setBusy = busy => { f.c.uiBusy = busy; };
  f.c.handleServerMessagePayload = () => { f.c.uiBusy = false; };
  vm.runInContext(section(client, "      function handleServerMessage(message)", "      function handleServerMessagePayload(message)"), f.c);
  f.c.handleServerMessage({ type: "response", runtimeActivity: actor.snapshot() });
  assert.equal(f.c.uiBusy, true); assert.equal(f.c.getAbortablePendingKind(), "direct");
  assert(f.c.requestCancelForPendingRequest("direct"));
  f.c.handleServerMessage({ type: "cancel_rejected", runId: "wrong" }); assert.equal(f.c.studioStopRequestedRunId, "run-1");
  f.c.handleServerMessage({ type: "cancel_rejected", runId: "run-1" });
  assert.equal(f.c.studioStopRequestedRunId, null); assert.equal(f.c.getAbortablePendingKind(), "direct");
});

test("actual parser retains the optional run fence rather than silently degrading to a request-only abort", () => {
  const body = section(index, '\tif (msg.type === "cancel_request" &&', '\n\treturn null;\n}');
  const c = vm.createContext({}); vm.runInContext("function parse(msg) {" + body + " return null; }", c);
  assert.equal(c.parse({ type: "cancel_request", requestId: "owned", runId: "run-1" }).runId, "run-1");
  assert.equal(c.parse({ type: "cancel_request", requestId: "owned", runId: 42 }), null);
  assert.equal(c.parse({ type: "cancel_request", requestId: "owned" }).requestId, "owned", "legacy exact-request compatibility retained");
});

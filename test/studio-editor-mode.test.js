import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStudioTurns, resolveStudioEditorFlags, readStudioEditorMode, writeStudioEditorMode } from "../shared/studio-editor-mode.js";
import { buildStudioHostingBootstrapState, createStudioBufferServerStore } from "../shared/studio-buffer-server.js";
import { createStudioBuffer, validateStudioBufferWorkspace } from "../shared/studio-buffer-store.js";
import { createStudioDiskRevision } from "../shared/studio-disk-revisions.js";

// Oliver, 13 Oct: dual editor mode (Prompt and Document) by default, single editor mode on
// request, from the footer or /studio --single and --dual. Switching restarts Studio.
const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
// Every part present, each after the one before.
const ordered = (text, ...parts) => parts.every((part, i) => text.indexOf(part) >= 0 && (i === 0 || text.indexOf(part) > text.indexOf(parts[i - 1])));
const section = (text, start, end) => { const a = text.indexOf(start), b = text.indexOf(end, a + start.length); assert(a >= 0 && b > a, start); return text.slice(a, b); };

test("dual by default, single when chosen, and the development flags still decide when set", () => {
  const flags = (env, saved) => { const { forced, recovery, switching, hosting, mode } = resolveStudioEditorFlags(env, saved); return [forced, recovery, switching, hosting, mode]; };
  assert.deepEqual(flags({}, null), [false, true, true, true, "dual"]);
  assert.deepEqual(flags({}, "dual"), [false, true, true, true, "dual"]);
  assert.deepEqual(flags({}, "single"), [false, false, false, false, "single"]);
  const all = { PI_STUDIO_BUFFER_RECOVERY: "1", PI_STUDIO_BUFFER_SWITCHING: "1", PI_STUDIO_DOCUMENT_HOSTING: "1" };
  assert.deepEqual(flags(all, "single"), [true, true, true, true, "dual"], "the alpha launcher keeps dual");
  assert.deepEqual(flags({ PI_STUDIO_BUFFER_RECOVERY: "1" }, null), [true, true, false, false, "single"], "partial development setups are unchanged");
  assert.deepEqual(flags({ PI_STUDIO_BUFFER_RECOVERY: "0" }, "dual"), [true, false, false, false, "single"]);
  assert.deepEqual(flags({ PI_STUDIO_BUFFER_RECOVERY: "" }, null), [false, true, true, true, "dual"], "an empty variable is unset");
});

test("the choice is kept per Pi profile, and an unreadable file means the default", () => {
  const dir = mkdtempSync(join(tmpdir(), "studio-editor-mode-")), path = join(dir, "pi-studio", "editor-mode.json");
  assert.equal(readStudioEditorMode(path), null);
  writeStudioEditorMode(path, "single"); assert.equal(readStudioEditorMode(path), "single");
  writeStudioEditorMode(path, "dual"); assert.equal(readStudioEditorMode(path), "dual");
  writeFileSync(path, "{not json"); assert.equal(readStudioEditorMode(path), null);
  writeFileSync(path, JSON.stringify({ mode: "triple" })); assert.equal(readStudioEditorMode(path), null);
  assert.throws(() => writeStudioEditorMode(path, "triple"));
  assert.match(index, /const STUDIO_EDITOR_MODE_PATH = join\(getAgentDir\(\), "pi-studio", "editor-mode\.json"\);/);
});

test("the server lists every workspace holding unsaved work; only the asking page's Prompt is exempt", () => {
  const server = createStudioBufferServerStore({ hosting: { canonicalPath: p => p, requireView: true } });
  const boot = text => server.hostingBootstrap({}, () => ({ ok: true, document: { text, label: "blank", source: "blank" } })).owner.workspaceId;
  const mine = boot("my prompt");
  assert.deepEqual(server.retainedWork(mine), { pending: false, pendingKeys: [], unsaved: [] }, "the asking page carries its own Prompt");
  assert.deepEqual(server.retainedWork(), { pending: false, pendingKeys: [], unsaved: [mine] }, "the command carries nothing");
  boot("");
  assert.deepEqual(server.retainedWork(mine).unsaved, [], "an empty workspace loses nothing");
  const other = boot("text in a closed window");
  assert.deepEqual(server.retainedWork(mine).unsaved, [other]);
  assert.deepEqual(server.retainedWork(other).unsaved, [mine], "seen from there, this Prompt is the unsaved text");
});

test("an emptied saved file, or a Document beside the carried Prompt, counts as unsaved on the server", () => {
  const server = createStudioBufferServerStore();
  const id = "tab_" + "c".repeat(24), cap = server.issue({ workspaceId: id, mode: "full" }).capability;
  let revision = null, n = 0;
  for (const [text, baselineText, unsaved] of [["", "", false], ["", "saved text", true], ["new", "", true], ["same", "same", false]]) {
    n += 1;
    const state = validateStudioBufferWorkspace({ version: 2, workspaceId: id, mode: "full", revision: n, savedAt: n, selectedBufferId: "p", activePromptId: "p", order: ["p", "d"],
      buffers: [createStudioBuffer({ id: "p", role: "prompt", text: "carried" }), createStudioBuffer({ id: "d", role: "document", text, baselineText })] }).state;
    const written = server.write(cap, revision, state); assert.equal(written.ok, true, JSON.stringify(written)); revision = server.read(cap).revision;
    assert.deepEqual(server.retainedWork(id).unsaved, unsaved ? [id] : [], JSON.stringify([text, baselineText]));
  }
});

test("a carried Prompt must fit a dual workspace before the switch is accepted", () => {
  assert.equal(buildStudioHostingBootstrapState({ text: "x".repeat(900_000), label: "blank", source: "blank" }).ok, true);
  assert.equal(buildStudioHostingBootstrapState({ text: "x".repeat(900_001), label: "blank", source: "blank" }).ok, false);
  const refusal = section(index, "	const studioEditorModeSwitchRefusal = ", "	const restartStudioInEditorModeNow = ");
  assert.match(index, /const studioEditorModeCarryFits = \(mode: "single" \| "dual", text: string\) => mode === "dual"\n\t\t\? buildStudioHostingBootstrapState\(\{ text, label: "blank", source: "blank" \}\)\.ok/);
  assert.match(refusal, /if \(!studioEditorModeCarryFits\(msg\.mode, msg\.text\)\) return "The text is too long to carry over\. Save it to a file first\.";/);
  const handler = section(index, '		if (msg.type === "editor_mode_switch_request") {', '		if (msg.type === "workspace_state_update") {');
  assert(ordered(handler, "studioEditorModeSwitchRefusal(client, msg)", "writeStudioEditorMode("), "checked before anything is saved");
});

function harness({ mode = "dual", buffers, busy = false, confirm = true, fetchAnswer } = {}) {
  const sent = [], status = [], fetches = [], replaced = [], decisions = [], main = { inert: false };
  const state = { activePromptId: "p", selectedBufferId: "p", buffers: buffers || [{ id: "p", role: "prompt", text: "Ask about this.", baselineText: "" }, { id: "d", role: "document", text: "", baselineText: "" }] };
  const c = vm.createContext({
    studioEditorMode: mode, studioEditorModeSwitchable: true, studioEditorModeSwitchRequestId: null, studioEditorModeLanding: null, studioEditorModeLanded: false, studioEditorModeAttempt: null,
    WebSocket: { OPEN: 1 }, ws: { readyState: 1, send: data => sent.push(JSON.parse(data)) }, wsState: "Ready", uiBusy: busy,
    sideQuestionState: null, sideQuestionUi: { draft: "" },
    bufferRecoveryInitializing: false, documentHostingReady: true, bufferPageClosed: false, documentHostingRetired: false,
    documentHostingSaveResolution: null, documentHostingPreparingFile: false, pendingSaveOperations: new Map(), hasUnsyncedStudioMetadata: () => false,
    documentHostingController: { copyState: () => ({}), launchState: () => ({}), operationPending: () => false, moveState: () => ({}) },
    documentOpenController: null, sourceTextEl: { value: "single editor text" }, document: { querySelector: selector => selector === "main" ? main : null },
    bufferRecoveryClient: { capture: () => ({ ok: true }), snapshot: () => state, handoffBackup: () => null, pendingHostingSaves: () => [], settled: async () => {} },
    flushWorkspacePersistence() {}, AbortController,
    buildWorkspacePersistencePayload: () => ({}), fileBackedBaselineText: "", bufferRecoveryExtra: () => ({}), editorModeBtn: { hidden: true, disabled: false },
    openStudioDecision: async options => { decisions.push(options); return options.hideCancel ? true : confirm; }, makeRequestId: () => "req-1", setBusy: value => { c.uiBusy = value; }, setStatus: (...v) => status.push(v),
    fetch: fetchAnswer || (async (url, options) => { fetches.push([url, options]); return { type: "opaqueredirect" }; }),
    window: { setTimeout: (f, ms) => setTimeout(f, Math.min(ms, 5)), clearTimeout, location: { replace: url => replaced.push(url) } },
    Date: { now: () => (c.__now += 5000) }, __now: 0,
  });
  vm.runInContext(section(source, "      function studioEditorModeSwitchWaitReason()", "      function studioCleanDepartureRevision()"), c);
  const refusal = () => decisions.filter(d => d.hideCancel).map(d => [d.title, d.message, d.confirmLabel]).at(-1);
  return { c, state, sent, status, fetches, replaced, decisions, refusal, main };
}

test("switching from dual sends the Prompt's text, seals the page, then lands on the restarted Studio", async () => {
  const h = harness();
  await h.c.switchStudioEditorMode();
  assert.deepEqual(h.sent, [{ type: "editor_mode_switch_request", requestId: "req-1", mode: "single", text: "Ask about this.", sideQuestions: false }]);
  assert.equal(h.c.uiBusy, true); assert.equal(h.main.inert, true, "nothing on the page can change the snapshot");
  h.c.handleStudioEditorModeSwitchResult({ requestId: "req-1", ok: true, landing: "/?token=t&modeSwitch=n" });
  assert.equal(h.c.studioEditorModeLanded, false, "the leave warning stays until the landing is reached");
  await new Promise(r => setTimeout(r, 30));
  assert.deepEqual(h.replaced, ["/?token=t&modeSwitch=n"]); assert.equal(h.c.studioEditorModeLanded, true);
  assert.equal(h.fetches[0][1].redirect, "manual");
});

test("the old server's 403 doesn't count as landed; only the new server's redirect does", async () => {
  const answers = [{ type: "basic", status: 403 }, { type: "basic", status: 503 }, { type: "opaqueredirect", status: 0 }];
  const h = harness({ fetchAnswer: async (url, options) => { h.fetches.push([url, options]); return answers.shift(); } });
  await h.c.switchStudioEditorMode();
  h.c.handleStudioEditorModeSwitchResult({ requestId: "req-1", ok: true, landing: "/?token=t&modeSwitch=n" });
  await new Promise(r => setTimeout(r, 40));
  assert.equal(h.fetches.length, 3); assert.deepEqual(h.replaced, ["/?token=t&modeSwitch=n"]);
});

test("if Studio never comes back, each check is bounded and the page is given back with its warnings", async () => {
  const h = harness({ fetchAnswer: (url, options) => new Promise((resolve, reject) => { h.fetches.push(options.signal); options.signal.addEventListener("abort", () => reject(Error("aborted"))); }) });
  await h.c.switchStudioEditorMode();
  h.c.handleStudioEditorModeSwitchResult({ requestId: "req-1", ok: true, landing: "/?token=t&modeSwitch=n" });
  await new Promise(r => setTimeout(r, 200));
  assert(h.fetches.length >= 2 && h.fetches.every(signal => signal.aborted), "a hung request is cut off");
  assert.deepEqual(h.replaced, []);
  assert.equal(h.c.studioEditorModeLanding, null); assert.equal(h.c.studioEditorModeLanded, false, "leave warnings are back");
  assert.equal(h.c.uiBusy, false); assert.equal(h.main.inert, false, "editable again");
  assert.equal(h.decisions.at(-1).title, "Studio didn't restart");
});

test("from single, the editor's text becomes the Prompt", async () => {
  const h = harness({ mode: "single" });
  await h.c.switchStudioEditorMode();
  assert.deepEqual(h.sent.map(m => [m.mode, m.text]), [["dual", "single editor text"]]);
});

test("everything but the carried Prompt must be saved or pristine; an emptied file is an unsaved edit", async () => {
  const doc = (text, baselineText) => [{ id: "p", role: "prompt", text: "From Document (whole document):\n\nNotes.", baselineText: "" }, { id: "d", role: "document", text, baselineText }];
  for (const [text, baseline, blocked] of [["New notes.", "", true], ["Edited.", "Saved.", true], ["Unknown baseline.", null, true], ["", null, true],
    ["", "saved text", true], ["  \n", "", true], ["Saved.", "Saved.", false], ["", "", false], ["Notes.", "", false]]) {
    const h = harness({ buffers: doc(text, baseline) });
    await h.c.switchStudioEditorMode();
    assert.equal(h.sent.length, blocked ? 0 : 1, JSON.stringify([text, baseline]));
    if (blocked) assert.deepEqual(h.refusal(), ["Can't switch yet", "The Document has unsaved text. Save it, or add it to the Prompt, before switching.", "OK"]);
    if (blocked) assert.equal(h.decisions.length, 1, "no question first");
  }
  const second = harness({ buffers: [{ id: "p", role: "prompt", text: "Active.", baselineText: "" }, { id: "q", role: "prompt", text: "Inactive.", baselineText: "" }, { id: "d", role: "document", text: "", baselineText: "" }] });
  await second.c.switchStudioEditorMode();
  assert.equal(second.sent.length, 0); assert.match(second.refusal()[1], /unsaved text that can't come along/);
});

test("the answer to the question is rechecked after the server catches up, and a refusal gives the page back", async () => {
  const cancelled = harness({ confirm: false }); await cancelled.c.switchStudioEditorMode(); assert.equal(cancelled.sent.length, 0);
  const h = harness(); const order = [];
  h.c.flushWorkspacePersistence = () => order.push("flush"); h.c.bufferRecoveryClient.settled = async () => { order.push("settled"); h.state.buffers[1].text = "typed while asking"; };
  await h.c.switchStudioEditorMode(); assert.deepEqual(order, ["flush", "settled"]); assert.equal(h.sent.length, 0); assert.match(h.refusal()[1], /The Document has unsaved text/);
  const refused = harness(); await refused.c.switchStudioEditorMode();
  refused.c.handleStudioEditorModeSwitchResult({ requestId: "req-1", ok: false, message: "Close Studio's other tabs first." });
  assert.equal(refused.c.uiBusy, false); assert.equal(refused.main.inert, false); assert.equal(refused.c.studioEditorModeLanding, null);
  assert.deepEqual(refused.refusal(), ["Can't switch yet", "Close Studio's other tabs first.", "OK"], "in the dialog: a File notice can own the footer");
  refused.c.handleStudioEditorModeSwitchResult({ requestId: "req-1", ok: true, landing: "/?token=x&modeSwitch=y" });
  assert.equal(refused.c.studioEditorModeLanding, null, "a stale reply is ignored");
  const odd = harness(); await odd.c.switchStudioEditorMode();
  odd.c.handleStudioEditorModeSwitchResult({ requestId: "req-1", ok: true, landing: "https://elsewhere.example/" });
  assert.equal(odd.c.studioEditorModeLanding, null, "lands only on this Studio");
  const hidden = harness(); hidden.c.studioEditorModeSwitchable = false; await hidden.c.switchStudioEditorMode();
  assert.equal(hidden.decisions.length + hidden.sent.length, 0, "a hidden button does nothing");
});

test("side questions: a running one waits; any thread or draft is named in the question", async () => {
  const running = harness(); running.c.sideQuestionState = { status: "running", threadId: "t" };
  await running.c.switchStudioEditorMode(); assert.equal(running.refusal()[1], "Wait for the side question to finish.");
  for (const setup of [c => { c.sideQuestionState = { status: "idle", threadId: "t" }; }, c => { c.sideQuestionUi = { draft: "half a question" }; }]) {
    const h = harness(); setup(h.c); await h.c.switchStudioEditorMode();
    assert.equal(h.decisions[0].message, "Studio restarts and reopens here. The Prompt's text comes with you. Side questions are cleared.");
  }
  const none = harness(); await none.c.switchStudioEditorMode();
  assert.equal(none.decisions[0].message, "Studio restarts and reopens here. The Prompt's text comes with you.");
});

test("the button waits while a run, save, move or open is in progress, in either mode", () => {
  const reason = (setup, mode = "dual") => { const h = harness({ mode }); setup(h.c); h.c.syncStudioEditorModeButton(); return [h.c.editorModeBtn.disabled, h.c.editorModeBtn.title]; };
  assert.deepEqual(reason(() => {}), [false, "Use one editor, as in earlier Studio. Studio restarts and reopens here."]);
  assert.deepEqual(reason(c => { c.uiBusy = true; }), [true, "Wait for the current run to finish."]);
  assert.deepEqual(reason(c => { c.ws = null; }), [true, "Studio isn't connected."]);
  for (const mode of ["single", "dual"]) {
    assert.deepEqual(reason(c => { c.hasUnsyncedStudioMetadata = () => true; }, mode), [true, "Wait for saving to finish."], mode + ": Scratchpad and comments");
    assert.deepEqual(reason(c => { c.pendingSaveOperations = new Map([["x", {}]]); }, mode), [true, "Wait for saving to finish."], mode);
  }
  for (const setup of [c => { c.documentHostingController.copyState = () => ({ record: {} }); }, c => { c.documentHostingController.copyState = () => ({ error: {} }); },
    c => { c.documentHostingController.launchState = () => ({ record: {} }); }, c => { c.documentHostingController.launchState = () => ({ error: {} }); },
    c => { c.documentHostingController.operationPending = () => true; }, c => { c.bufferRecoveryClient.handoffBackup = () => ({ record: {} }); },
    c => { c.bufferRecoveryClient.handoffBackup = () => ({ error: { message: "unreadable" } }); }, c => { c.bufferRecoveryClient.pendingHostingSaves = () => [{}]; }]) {
    assert.deepEqual(reason(setup), [true, "Finish the save, move or open in progress first."]);
  }
  assert.deepEqual(reason(c => { c.documentHostingController.launchState = () => ({ record: null, destinations: [{ live: false }] }); }), [false, "Use one editor, as in earlier Studio. Studio restarts and reopens here."],
    "a closed Document window is the server's question, not a dead button");
});

test("the server checks the asking tab's role, waits for Pi and side questions, then restarts under one gate", () => {
  const refusal = section(index, "	const studioEditorModeSwitchRefusal = ", "	const restartStudioInEditorModeNow = ");
  for (const text of ["Studio is restarting.", "Studio's editor mode is set by environment variables here.", "Wait for Pi to finish, then switch.",
    "Wait for the side question to finish, then switch.", "Close Studio's other tabs first.", "The Document has unsaved text. Save it, or add it to the Prompt, before switching.",
    "Another Studio window still has unsaved text, or a move hasn't finished. Save it first."]) assert(refusal.includes(text), text);
  assert.match(refusal, /if \(state\.clientModes\.get\(client\) !== "full" \|\| studioWatchedClientPaths\.has\(client\) \|\| \(STUDIO_DOCUMENT_HOSTING_ENABLED && !hosted\)\) return "Switch from Studio's main tab\.";/);
  assert.match(index, /const isStudioSideQuestionBusy = \(\) => Boolean\(studioSideQuestionStartRequestId \|\| studioSideQuestionRuntime\?\.publicState\.status === "running"\);/);
  const restart = section(index, "	const restartStudioInEditorModeNow = ", "	const stopServer = () => withStudioLifecycle(stopServerNow);");
  const order = ["studioRestarting = true;", "await studioPersistentStateQueue", "await stopServerNow();", "applyStudioEditorMode(mode);", "pendingEditorModeLanding = { nonce: landing.nonce, path",
    "studioRestarting = false;", "await startServerNow(port, listenAll, token);", "if (state.token !== token)"];
  assert(ordered(restart, ...order), "landing is ready before the server listens");
  assert(!/await (ensureServer|stopServer)\(/.test(restart), "inside its turn it uses the *Now forms, so it can't wait on itself");
  assert(!/(?<!const )studioBufferStateStore = /.test(index), "one store for the extension's life: no stale handler can write into a replacement");
  assert.match(index, /const ensureServer = \(requestedPort\?: number, listenAll = false\): Promise<StudioServerState> =>\n\t\tserverState && studioLifecycle\.pending\(\) === 0 \? Promise\.resolve\(serverState\) : withStudioLifecycle\(\(\) => startServerNow\(requestedPort, listenAll\)\);/);
  assert.match(index, /const stopServer = \(\) => withStudioLifecycle\(stopServerNow\);/);
  assert.match(refusal, /if \(studioLifecycle\.pending\(\) > 0 \|\| studioRestarting\) return "Studio is restarting\.";/);
  assert.match(refusal, /if \(studioSideQuestionRuntime\?\.publicState\.threadId && !msg\.sideQuestions\) return "Side questions changed while you were asked\. Try again\.";/);
  assert.match(refusal, /studioBufferStateStore\.retainedWork\(hosted\.workspaceId, msg\.text\)/, "the server judges against the actual carry");
  assert.match(index, /server\.on\("upgrade", \(req, socket, head\) => \{\n\t\t\tif \(studioRestarting\) \{/);
  assert.match(index, /if \(!serverState \|\| studioRestarting\) \{\n\t\t\trespondText\(res, 503, "Studio server not ready"\);/);
  assert.match(index, /ws\.on\("message", \(data\) => \{\n\t\t\t\tif \(studioRestarting\) return;/);
  assert.match(index, /if \(trimmed === "stop" \|\| trimmed === "--stop"\) \{\n\t\t\t\tawait stopServer\(\);/);
  const handler = section(index, '		if (msg.type === "editor_mode_switch_request") {', '		if (msg.type === "workspace_state_update") {');
  assert(ordered(handler, "writeStudioEditorMode(", "studioRestarting = true;", "withStudioLifecycle(() => restartStudioInEditorModeNow(", "ok: true, landing"), "saved, then queued, then the page is told");
  assert(!/await /.test(handler), "check, save and the gate happen in one step");
});

test("the command asks before dropping what only the server holds, and the yes covers only what it named", () => {
  const stake = section(index, "	const studioEditorModeCommandStake = ", "	const chooseStudioEditorMode = ");
  assert.match(stake, /const work = studioBufferStateStore\.retainedWork\(\);/);
  assert.match(stake, /parts\.push\("Studio holds unsaved text that isn't open in a tab, or a save or move hasn't finished\. Restarting Studio loses it\."\);/);
  assert.match(stake, /offline: offline\.map\(id => \[id, studioBufferStateStore\.hostedWorkspace\(id\)\?\.revision \?\? null\]\)/, "bound to the exact text, not just the window");
  assert.match(stake, /parts\.push\("Side questions are cleared\."\);\n\t\t\tkey\.side = \[side\.threadId, side\.messages\.length, side\.status\];/);
  const command = section(index, "	const chooseStudioEditorMode = ", "	const openStudioView = async (");
  assert.match(command, /if \(stake && stake\.key !== consented\) \{\n\t\t\t\tif \(!await ctx\.ui\.confirm\(`Switch to \$\{label\}\?`, stake\.message\)\) \{ ctx\.ui\.notify\("Nothing changed\.", "info"\); return false; \}/);
  const turn = section(command, "const outcome = await withStudioLifecycle(", "if (outcome !== \"changed\")");
  const recheck = turn.indexOf("if (now && now.key !== consented) return \"changed\";"), saving = turn.indexOf("if (!save()) return \"failed\";\n\t\t\t\tconst previous");
  assert(recheck >= 0 && saving > recheck, "rechecked inside the turn, before saving");
  assert.match(turn, /await restartStudioInEditorModeNow\(mode, flags\.port, flags\.listenAll, createSessionToken\(\), null\)/);
  assert(!/ctx\.ui\.confirm/.test(turn), "never holds the turn while asking");
});

test("a pending operation that finishes and is replaced by another gets a new key", async () => {
  const workspaceId = "main_" + "e".repeat(24), server = createStudioBufferServerStore({ hosting: { canonicalPath: p => p, requireView: true } });
  const cap = server.issue({ workspaceId, mode: "full" }).capability, lease = server.bindHostingView(cap, "full", {});
  assert(server.write(cap, null, { version: 2, workspaceId, mode: "full", revision: 1, savedAt: 1, activePromptId: "prompt", selectedBufferId: "doc", order: ["prompt", "doc"],
    buffers: [createStudioBuffer({ id: "prompt", role: "prompt", text: "Prompt" }), createStudioBuffer({ id: "doc", role: "document", text: "Document" })] }, lease.generation).ok);
  const proof = () => ({ generation: lease.generation, bufferId: "doc", documentEpoch: server.read(cap).documents.doc });
  const hold = () => { let release; const gate = new Promise(r => { release = r; }); return { gate, release }; };
  assert.deepEqual(server.retainedWork(workspaceId, "Prompt Document").pendingKeys, []);
  const a = hold(), writeA = server.hostingMetadata(cap, proof(), "review-notes", "draft:doc", async check => { await a.gate; check(); });
  const keyA = server.retainedWork(workspaceId).pendingKeys; assert.equal(keyA.length, 1);
  a.release(); await writeA;
  const b = hold(), writeB = server.hostingMetadata(cap, proof(), "review-notes", "draft:doc", async check => { await b.gate; check(); });
  const keyB = server.retainedWork(workspaceId).pendingKeys; assert.equal(keyB.length, 1);
  assert.notDeepEqual(keyB, keyA, "the same kind of work on the same Document, but not what was agreed to");
  b.release(); await writeB;
  assert.equal(server.retainedWork(workspaceId).pending, false);
  assert.match(index, /key\.work = \{ pending: work\.pendingKeys, offline:/, "the command's consent key uses them");
});

test("pending saves are keyed by workspace too: the same save id in two workspaces is two operations", () => {
  const server = createStudioBufferServerStore({ hosting: { canonicalPath: p => p, requireView: true } }), operationId = "1".padStart(48, "0");
  for (const [workspaceId, path, bufferId] of [["main_" + "f".repeat(24), "/a.md", "doc_a"], ["other_" + "f".repeat(24), "/b.md", "doc_b"]]) {
    const cap = server.issue({ workspaceId, mode: "editor-only" }).capability, lease = server.bindHostingView(cap, "editor-only", {});
    const doc = createStudioBuffer({ id: bufferId, role: "document", text: "draft" });
    assert(server.write(cap, null, validateStudioBufferWorkspace({ version: 2, workspaceId, mode: "editor-only", revision: 1, savedAt: 1, selectedBufferId: bufferId, activePromptId: null, order: [bufferId], buffers: [doc] }).state, lease.generation).ok);
    const remote = server.read(cap);
    const saved = server.hostingSave(cap, { operationId, kind: "save-as", bufferId, path, content: "draft", generation: lease.generation, documentEpoch: remote.documents[bufferId], expectedRevision: remote.revision },
      authorize => { const checked = authorize(path); return checked.ok ? { ok: true, path, revision: createStudioDiskRevision("draft") } : checked; });
    assert(saved.ok, JSON.stringify(saved));
  }
  const saves = server.retainedWork().pendingKeys.filter(key => key.startsWith("save:"));
  assert.equal(saves.length, 2, "one per workspace, so retiring one and starting the other changes the key");
});

test("turns: one at a time, in order, and pending counts from the moment of queuing", async () => {
  const turns = createStudioTurns(), log = [];
  let release; const first = turns.run(() => new Promise(r => { log.push("first starts"); release = r; }));
  assert.equal(turns.pending(), 1, "counted before it starts");
  const second = turns.run(async () => { log.push("second starts"); return 2; });
  assert.equal(turns.pending(), 2);
  await new Promise(r => setTimeout(r, 5));
  assert.deepEqual(log, ["first starts"], "the second waits");
  release(1);
  assert.deepEqual([await first, await second], [1, 2]);
  assert.deepEqual(log, ["first starts", "second starts"]); assert.equal(turns.pending(), 0);
  const failing = turns.run(async () => { throw Error("no"); }); await assert.rejects(failing);
  assert.equal(await turns.run(async () => "after"), "after", "a failure doesn't block later turns");
});

test("Document text already in the carried text is kept on the server too; an emptied file never is", () => {
  const server = createStudioBufferServerStore();
  const id = "tab_" + "d".repeat(24), cap = server.issue({ workspaceId: id, mode: "full" }).capability;
  const state = (text, baselineText) => validateStudioBufferWorkspace({ version: 2, workspaceId: id, mode: "full", revision: 1, savedAt: 1, selectedBufferId: "p", activePromptId: "p", order: ["p", "d"],
    buffers: [createStudioBuffer({ id: "p", role: "prompt", text: "stale server Prompt" }), createStudioBuffer({ id: "d", role: "document", text, baselineText })] }).state;
  assert(server.write(cap, null, state("Notes.", "")).ok);
  assert.deepEqual(server.retainedWork(id, "From Document (whole document):\n\nNotes.").unsaved, [], "after Add to Prompt");
  assert.deepEqual(server.retainedWork(id, "something else").unsaved, [id]);
  const empty = createStudioBufferServerStore(), cap2 = empty.issue({ workspaceId: id, mode: "full" }).capability;
  assert(empty.write(cap2, null, state("", "saved text")).ok);
  assert.deepEqual(empty.retainedWork(id, "anything").unsaved, [id]);
});

test("a second click while an attempt is open does nothing, and can't unseal the first", async () => {
  const h = harness(); let settle; const settling = new Promise(r => { settle = r; });
  h.c.bufferRecoveryClient.settled = () => settling;
  const first = h.c.switchStudioEditorMode();
  await new Promise(r => setTimeout(r, 5));
  assert.equal(h.main.inert, true); assert.equal(h.decisions.length, 1);
  h.c.openStudioDecision = async () => { throw Error("a second attempt must not ask"); };
  await h.c.switchStudioEditorMode();
  h.c.syncStudioEditorModeButton(); assert.deepEqual([h.c.editorModeBtn.disabled, h.c.editorModeBtn.title], [true, "Switching…"]);
  assert.equal(h.main.inert, true, "still sealed: only the first attempt may release it");
  settle(); await first;
  assert.equal(h.sent.length, 1); assert.equal(h.sent[0].sideQuestions, false); assert.equal(h.main.inert, true, "sealed through the switch");
  assert.equal(h.c.studioEditorModeAttempt, null);
});

test("the page is sealed from the question to the answer, and names side questions it knew of", async () => {
  const h = harness(); const seen = [];
  const ask = h.c.openStudioDecision; h.c.openStudioDecision = async options => { seen.push(h.main.inert); return ask(options); };
  h.c.bufferRecoveryClient.settled = async () => { seen.push(h.main.inert); };
  await h.c.switchStudioEditorMode(); assert.deepEqual(seen, [true, true]); assert.equal(h.main.inert, true, "still sealed while switching");
  const cancelled = harness({ confirm: false }); await cancelled.c.switchStudioEditorMode(); assert.equal(cancelled.main.inert, false, "given back after Cancel");
  const refused = harness(); refused.c.bufferRecoveryClient.settled = async () => { refused.state.buffers[1].text = "late"; };
  await refused.c.switchStudioEditorMode(); assert.equal(refused.main.inert, false, "given back after a refusal");
  const side = harness(); side.c.sideQuestionState = { status: "idle", threadId: "t" }; await side.c.switchStudioEditorMode();
  assert.equal(side.sent[0].sideQuestions, true);
});

test("the switch link only redirects for its own nonce, after the token check", () => {
  const page = section(index, '		if (requestUrl.searchParams.has("modeSwitch")) {', "		refreshContextUsage();");
  assert.match(page, /landing\.nonce !== requestUrl\.searchParams\.get\("modeSwitch"\) \|\| landing\.expiresAt < Date\.now\(\)/);
  assert.match(page, /res\.writeHead\(302, \{ Location: landing\.path/);
  assert.match(index, /respondText\(res, 403, "Invalid or expired studio token\. Re-run \/studio\."\);\n\t\t\treturn;\n\t\t\}\n\t\tif \(requestUrl\.searchParams\.has\("modeSwitch"\)\) \{/);
});

test("/studio --single and --dual, the footer button and the page's mode", () => {
  assert.match(index, /if \(token === "--single" \|\| token === "--dual"\) \{/);
  assert.match(index, /error: "Use either --single or --dual, not both\."/);
  assert.match(index, /if \(launchOpenFlags\.editorMode && !await chooseStudioEditorMode\(launchOpenFlags\.editorMode, launchOpenFlags, ctx\)\) return;/);
  assert.match(index, /\/studio --single  Use single editor mode \(one editor\), and remember it/);
  assert.match(index, /<button id="editorModeBtn" class="shortcut-hint" type="button" hidden><\/button>/);
  assert.match(index, /<body data-editor-mode="\$\{STUDIO_EDITOR_FLAGS\.mode\}" data-editor-mode-locked="\$\{STUDIO_EDITOR_FLAGS\.forced \? "1" : "0"\}"/);
  assert.match(source, /const studioEditorModeSwitchable = document\.body\.dataset\.editorModeLocked !== "1" && studioMode === "full" && !isEditorOnlyMode && !isWatchedFilePreview/);
  assert.match(source, /if \(typeof studioEditorModeLanded !== "undefined" && studioEditorModeLanded\) return; \/\/ The text went with the switch\./);
  assert.match(source, /if \(studioEditorModeSwitchRequestId\) \{ studioEditorModeSwitchRequestId = null; sealStudioForEditorModeSwitch\(false\); \}/, "a dropped connection gives the page back");
});

test("the one-button dialog hides Cancel only when asked", () => {
  const dialog = section(source, "      function openStudioDecision(options) {", "        studioDecisionTertiaryBtn.hidden = !tertiaryLabel;");
  assert.match(dialog, /studioDecisionCancelBtn\.hidden = settings\.hideCancel === true;/);
});

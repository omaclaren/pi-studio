import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { createStudioBufferServerStore } from "../shared/studio-buffer-server.js";
import { createStudioBuffer, validateStudioBufferWorkspace } from "../shared/studio-buffer-store.js";

// Oliver, 14 Oct: Studio opened in another browser, or in a tab he couldn't find, held the
// workspace. /studio-replace, or Move it here in the refused tab, asks that tab to hand over.
const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
const section = (text, start, end) => { const a = text.indexOf(start), b = text.indexOf(end, a + start.length); assert(a >= 0 && b > a, start); return text.slice(a, b); };
const ordered = (text, ...parts) => parts.every((part, i) => text.indexOf(part) >= 0 && (i === 0 || text.indexOf(part) > text.indexOf(parts[i - 1])));

function oldTab({ clean = "r".repeat(48) } = {}) {
  const sent = [], log = [], status = [], main = { inert: false };
  const c = vm.createContext({
    studioMovedAway: false, documentHostingRetired: false, bufferPageClosed: false, bufferRecoveryKeptClosed: false, documentHostingGeneration: 7,
    STUDIO_MOVED_AWAY_MESSAGE: "Studio moved to another tab. This tab's text is kept here.",
    ws: { send: data => sent.push(JSON.parse(data)), close: (code, reason) => log.push(["close", code, reason]) },
    bufferRecoveryClient: { settled: async () => log.push("settled") }, flushWorkspacePersistence: () => log.push("flush"),
    studioCleanDepartureRevision: () => { log.push(["clean?", c.bufferPageClosed]); return clean; },
    document: { querySelector: selector => selector === "main" ? main : null }, setStatus: (...v) => status.push(v),
  });
  vm.runInContext(section(source, "      function sealStudioForEditorModeSwitch(sealed) {", "      async function switchStudioEditorMode() {"), c);
  vm.runInContext(section(source, "      async function handOverStudioWorkspace() {", "      // Studio is already open in another tab, perhaps another browser"), c);
  return { c, sent, log, status, main };
}

test("the old tab sends what it has, leaves cleanly when nothing is pending, then stays off", async () => {
  const h = oldTab();
  await h.c.handOverStudioWorkspace();
  assert.deepEqual(h.log, ["flush", "settled", ["clean?", false], ["close", 1000, "Studio moved to another tab"]], "judged while still the owner, then closed");
  assert.deepEqual(h.sent, [{ type: "hosting_clean_leave", generation: 7, revision: "r".repeat(48) }]);
  assert.deepEqual([h.c.studioMovedAway, h.c.documentHostingRetired, h.c.bufferPageClosed, h.c.bufferRecoveryKeptClosed], [true, true, true, true], "as Keep closed: no reconnect");
  assert.equal(h.main.inert, false, "the text stays selectable");
  assert.deepEqual(h.status.at(-1), ["Studio moved to another tab. This tab's text is kept here.", "warning"]);
  await h.c.handOverStudioWorkspace(); assert.equal(h.sent.length, 1, "once");
});

test("with something pending it still steps aside, but without the clean note, so the new tab asks", async () => {
  const h = oldTab({ clean: null });
  await h.c.handOverStudioWorkspace();
  assert.deepEqual(h.sent, []);
  assert.equal(h.c.bufferRecoveryKeptClosed, true);
});

function newTab({ confirm = true, fails = null, mode = {} } = {}) {
  const decisions = [], posts = [], reloads = [], seals = [];
  const c = vm.createContext({
    studioMoveHereOffered: false, studioMoveHereReloading: false, isWatchedFilePreview: false, isEditorOnlyMode: false,
    documentHostingEnabled: true, studioEverHeldWorkspace: false, studioMovedAway: false, sideQuestionUi: { draft: "" }, replQuickDrafts: new Map(),
    sealStudioForEditorModeSwitch: sealed => seals.push(sealed), ...mode,
    document: { body: { dataset: { bufferCapability: "cap-1" } } },
    openStudioDecision: async options => { decisions.push(options); return options.hideCancel ? true : confirm; },
    fetchStudioJson: async (path, options) => { posts.push([path, options.method, JSON.parse(options.body)]); if (fails) throw Error(fails); return { ok: true }; },
    window: { location: { reload: () => reloads.push(true) } },
  });
  vm.runInContext(section(source, "      const studioMoveHereAllowed = ", "      function studioCleanDepartureRevision() {"), c);
  return { c, decisions, posts, reloads, seals };
}

test("a tab refused as a duplicate offers Move it here, asks the server, then reloads into the workspace", async () => {
  const h = newTab();
  await h.c.offerStudioMoveHere();
  assert.deepEqual([h.decisions[0].title, h.decisions[0].message, h.decisions[0].confirmLabel, h.decisions[0].cancelLabel],
    ["Studio is open in another tab", "Move it here? That tab sends its text here and disconnects.", "Move it here", "Keep it there"]);
  assert.deepEqual(h.posts, [["/studio-handover", "POST", { capability: "cap-1" }]]);
  assert.deepEqual(h.reloads, [true]); assert.equal(h.c.studioMoveHereReloading, true, "no leave warning: this tab never held the workspace");
  assert.deepEqual(h.seals, [true], "sealed while the move runs, until the reload");
  await h.c.offerStudioMoveHere(); assert.equal(h.decisions.length, 1, "offered once");
});

test("Keep it there, a refusal, or a view that isn't the main tab: nothing moves", async () => {
  const kept = newTab({ confirm: false }); await kept.c.offerStudioMoveHere();
  assert.deepEqual([kept.posts.length, kept.reloads.length], [0, 0]);
  const refused = newTab({ fails: "Wait for Pi to finish, then try again." }); await refused.c.offerStudioMoveHere();
  assert.deepEqual(refused.reloads, []); assert.equal(refused.c.studioMoveHereReloading, false); assert.deepEqual(refused.seals, [true, false], "given back");
  assert.deepEqual([refused.decisions.at(-1).title, refused.decisions.at(-1).message, refused.decisions.at(-1).hideCancel], ["Studio didn't move", "Wait for Pi to finish, then try again.", true]);
  for (const mode of [{ isWatchedFilePreview: true }, { isEditorOnlyMode: true }, { documentHostingEnabled: false }]) {
    const h = newTab({ mode }); await h.c.offerStudioMoveHere(); assert.equal(h.decisions.length, 0, JSON.stringify(mode));
  }
});

test("a tab that ever held the workspace is never offered: its reload could lose local work", async () => {
  const former = newTab({ mode: { studioEverHeldWorkspace: true } }); await former.c.offerStudioMoveHere();
  assert.deepEqual([former.decisions.length, former.posts.length, former.reloads.length], [0, 0, 0]);
  assert.match(source, /if \(documentHostingGeneration\) studioEverHeldWorkspace = true;/);
  assert.match(source, /\? \(studioEverHeldWorkspace \? "Studio is open in another tab\. This tab's text is kept here; \/studio-replace in Pi moves Studio here\." : "Studio is open in another tab\. Move it here, or use that tab\."\)/);
});

test("checked again after the question and after the server answers", async () => {
  const during = newTab(); during.c.openStudioDecision = async () => { during.c.studioMovedAway = true; return true; };
  await during.c.offerStudioMoveHere(); assert.deepEqual([during.posts.length, during.reloads.length], [0, 0], "moved away while asking: nothing sent");
  const after = newTab(); after.c.fetchStudioJson = async () => { after.c.studioEverHeldWorkspace = true; return { ok: true }; };
  await after.c.offerStudioMoveHere(); assert.deepEqual(after.reloads, []); assert.equal(after.c.studioMoveHereReloading, false, "leave warnings stay on");
});

test("page-only drafts are named in the question; one typed during the move stops the silent reload", async () => {
  const named = newTab({ mode: { sideQuestionUi: { draft: "half a question" } } }); await named.c.offerStudioMoveHere();
  assert.equal(named.decisions[0].message, "Move it here? That tab sends its text here and disconnects. This tab's side-question and REPL drafts are cleared.");
  assert.deepEqual(named.reloads, [true], "named and unchanged: it may go");
  const repl = newTab({ mode: { replQuickDrafts: new Map([["session", "x = 1"]]) } }); await repl.c.offerStudioMoveHere();
  assert.match(repl.decisions[0].message, /drafts are cleared\.$/);
  // Sol's counterexample: the POST waits on a frozen owner while a side draft is typed.
  const h = newTab(); let answer; h.c.fetchStudioJson = () => new Promise(resolve => { answer = resolve; });
  const moving = h.c.offerStudioMoveHere(); await new Promise(r => setTimeout(r, 5));
  assert.deepEqual(h.seals, [true], "sealed during the wait");
  h.c.sideQuestionUi = { draft: "typed during the wait" }; answer({ ok: true }); await moving;
  assert.deepEqual(h.reloads, []); assert.equal(h.c.studioMoveHereReloading, false, "the leave warning stays");
  assert.deepEqual(h.seals, [true, false]); assert.equal(h.decisions.at(-1).title, "Studio is ready here");
  // Any change counts: indentation alone, or the same text under another REPL session.
  for (const change of [drafts => drafts.set("session-a", "    print(1)"), drafts => { drafts.delete("session-a"); drafts.set("session-b", "print(1)"); }]) {
    const t = newTab({ mode: { replQuickDrafts: new Map([["session-a", "print(1)"]]) } }); let release; t.c.fetchStudioJson = () => new Promise(r => { release = r; });
    const pending = t.c.offerStudioMoveHere(); await new Promise(r => setTimeout(r, 5));
    change(t.c.replQuickDrafts); release({ ok: true }); await pending;
    assert.deepEqual(t.reloads, [], change.toString()); assert.equal(t.c.studioMoveHereReloading, false);
  }
  const blank = newTab({ mode: { sideQuestionUi: { draft: "  " } } }); await blank.c.offerStudioMoveHere();
  assert.match(blank.decisions[0].message, /drafts are cleared\.$/, "whitespace is still text");
});

test("the page: 4006 and a handed-over tab show the moved message and never reconnect; a duplicate gets the offer", () => {
  assert.match(source, /if \(event && event\.code === 4006\) \{\n\s+handleDisconnect\("moved", 4006\);/);
  const moved = section(source, '          if (kind === "moved" || studioMovedAway) {', '          if (kind === "full_conflict") {');
  assert(ordered(moved, "bufferRecoveryKeptClosed = true;", "clearScheduledReconnect();", "setStatus(STUDIO_MOVED_AWAY_MESSAGE, \"warning\");", "return;"));
  const conflict = section(source, '          if (kind === "full_conflict") {', '          if (kind === "watch_unauthorized") {');
  assert.match(conflict, /"Studio is open in another tab\. Move it here, or use that tab\."/);
  assert.match(conflict, /void offerStudioMoveHere\(\);/);
  assert.match(source, /if \(message\.type === "workspace_handover_request"\) \{\n\s+void handOverStudioWorkspace\(\);/);
  assert.match(source, /if \(typeof studioMoveHereReloading !== "undefined" && studioMoveHereReloading\) return; \/\/ This tab never held a workspace\./);
});

test("the server: one lifecycle turn; dual asks the tab, single replaces it; silence ends in a forced close", () => {
  const handover = section(index, "	const handOverFullStudioView = ", "	// /studio-replace in dual editor mode");
  assert(ordered(handover, "if (asking && (serverState !== asking.state || studioMovedAwayCapabilities.has(asking.capability)", "studioBufferStateStore.capabilityWorkspace(asking.capability)?.workspaceId !== asking.workspaceId", "const owners = openFullStudioClients();"),
    "the asking page is revalidated inside the turn");
  assert(ordered(handover, "studioMovedAwayCapabilities.add(hosted.capability); studioBufferStateStore.forgetCleanLeave(hosted.workspaceId);", 'client.close(4006, "Studio moved to another tab")'),
    "forced off: fenced first, and any clean note voided, so the new tab asks");
  assert.match(index, /if \(hosted && !studioMovedAwayCapabilities\.has\(hosted\.capability\)\) studioBufferStateStore\.hostingCleanLeave\(/, "a late note from a fenced tab is ignored");
  assert.match(handover, /=> withStudioLifecycle\(async \(\) => \{/);
  assert.match(handover, /if \(STUDIO_DOCUMENT_HOSTING_ENABLED && hostedConnections\.has\(client\)\) sendToClient\(client, \{ type: "workspace_handover_request" \}\);\n\t\t\telse \{ clearTimeout\(timer\); try \{ client\.close\(4001, "Full Studio replaced"\); \}/);
  assert(ordered(handover, "setTimeout(() => {", "studioMovedAwayCapabilities.add(hosted.capability);", 'client.close(4006, "Studio moved to another tab")', "client.terminate()", "STUDIO_HANDOVER_WAIT_MS);"));
  assert.match(handover, /client\.once\("close", \(\) => \{ clearTimeout\(timer\); if \(forced\) clearTimeout\(forced\); resolve\(\); \}\);/);
  assert.match(handover, /clean: Boolean\(workspaceId && studioBufferStateStore\.hasCleanLeave\(workspaceId\)\)/, "a clean handover lets the new tab skip the question");
  assert.match(handover, /if \(owners\.length && \(isStudioBusy\(\) \|\| isStudioSideQuestionBusy\(\)\)\) return \{ ok: false, message: "Wait for Pi to finish, then try again\." \};/);
  assert.match(handover, /if \(asking && owners\.length && workspaceId !== asking\.workspaceId\) return \{ ok: false, message: "This tab is for a different workspace\. Run \/studio-replace in Pi instead\." \};/);
  assert.match(index, /if \(studioMovedAwayCapabilities\.has\(requestUrl\.searchParams\.get\("bufferCapability"\) \|\| ""\)\) \{\n\t\t\t\ttry \{ ws\.close\(4006, "Studio moved to another tab"\); \} catch \{\}/, "a forced-off tab that wakes is told it moved");
  assert(index.indexOf('studioMovedAwayCapabilities.has(requestUrl') < index.indexOf('ws.close(4004, "Full Studio already active")'));
  assert.match(index, /studioMovedAwayCapabilities\.clear\(\);\n\t\};/);
});

test("the endpoint: dual only; token, POST; never queued behind a restart; a full, unfenced capability", () => {
  const endpoint = section(index, '		if (requestUrl.pathname === "/studio-handover") {', '		if (requestUrl.pathname === "/side-question-context-root") {');
  assert(ordered(endpoint, "if (token !== serverState.token)", 'if ((req.method ?? "GET").toUpperCase() !== "POST")', 'if (!STUDIO_DOCUMENT_HOSTING_ENABLED) { respondJson(res, 409, { ok: false, error: "Use /studio-replace in Pi." }); return; }',
    "const admitted = serverState;", "await readRequestBody(req, 4096)",
    "if (studioRestarting || serverState !== admitted || studioLifecycle.pending() > 0 || !STUDIO_DOCUMENT_HOSTING_ENABLED) {",
    "studioBufferStateStore.capabilityWorkspace(capability)", 'if (!issued || issued.mode !== "full" || studioMovedAwayCapabilities.has(capability))',
    "const moved = await handOverFullStudioView({ state: admitted, capability, workspaceId: issued.workspaceId });"),
    "the body is read before the restart check, so a restart that began meanwhile isn't waited on");
});

test("/studio-replace in dual editor mode moves the open Studio, or the last one, here", () => {
  assert.match(index, /if \(STUDIO_DOCUMENT_HOSTING_ENABLED\) \{ await moveHostedStudioHere\(trimmed, ctx\); return; \}\n\t\t\tawait openStudioView\(trimmed, ctx, "full", \{\n\t\t\t\tdefaultSource: "last-response",\n\t\t\t\tcommandLabel: "\/studio-replace",\n\t\t\t\treplaceExistingFull: true,/);
  const move = section(index, "	const moveHostedStudioHere = ", "	const stopServer = () => withStudioLifecycle(stopServerNow);");
  assert.match(move, /if \(flags\.args \|\| flags\.editorMode\) \{ ctx\.ui\.notify\("In dual editor mode, \/studio-replace moves the open Studio here\. Open files from Studio's Document controls\.", "warning"\); return; \}/);
  assert(ordered(move, "const moved = await handOverFullStudioView();", "buildStudioUrl(state.port, state.token, \"full\", undefined, undefined, { hostedWorkspaceId: moved.workspaceId })", "openStudioUrlInBrowser(url)"));
  assert.match(move, /"Opening Studio here\. The other tab didn't hand over cleanly, so Studio asks before resuming\."/);
  assert.match(index, /"The existing full Studio was kept\. Use its opening controls, or \/studio-replace to move it here if you can't find it\."/);
});

test("the store says which workspace a page's capability belongs to", () => {
  const server = createStudioBufferServerStore({ hosting: { canonicalPath: p => p, requireView: true } });
  const workspaceId = "main_" + "a".repeat(24), cap = server.issue({ workspaceId, mode: "full" }).capability;
  assert.deepEqual(server.capabilityWorkspace(cap), { workspaceId, mode: "full" });
  assert.equal(server.capabilityWorkspace("nope"), null);
});

test("the server can void a clean departure note", () => {
  const server = createStudioBufferServerStore({ hosting: { canonicalPath: p => p, requireView: true } });
  const id = "main_" + "c".repeat(24), cap = server.issue({ workspaceId: id, mode: "editor-only" }).capability, handle = {};
  const lease = server.bindHostingView(cap, "editor-only", handle);
  const state = validateStudioBufferWorkspace({ version: 2, workspaceId: id, mode: "editor-only", revision: 1, savedAt: 1, selectedBufferId: "doc_v", activePromptId: null, order: ["doc_v"],
    buffers: [createStudioBuffer({ id: "doc_v", role: "document", text: "draft" })] }).state;
  assert(server.write(cap, null, state, lease.generation).ok);
  assert(server.hostingCleanLeave(cap, handle, { generation: lease.generation, revision: server.read(cap).revision }).ok);
  assert.equal(server.hasCleanLeave(id), true);
  server.forgetCleanLeave(id); assert.equal(server.hasCleanLeave(id), false);
});

test("plain /studio reopens the last workspace when its tab is gone; --blank and --last start afresh", () => {
  const open = section(index, "	const openHostedStudioView = async (", "		let path: string | undefined;");
  assert(ordered(open, "if (hasConnectedFullStudioView() && serverState) {", "const lastWorkspace = lastHostedFullWorkspaceId;",
    "if (!launchArgs && serverState && lastWorkspace && studioBufferStateStore.hostedWorkspace(lastWorkspace)) {",
    'buildStudioUrl(state.port, state.token, "full", undefined, undefined, { hostedWorkspaceId: lastWorkspace })', "ctx.ui.notify(clean ?", "ctx.ui.notify(`Studio URL: ${url}`, \"info\");"),
    "an open tab is kept first; only plain /studio, only a workspace still held");
  assert.match(open, /clean \? "Opening your last Studio workspace\." : "Opening your last Studio workspace\. Studio asks before resuming, in case its tab had newer edits\."/);
  assert.match(open, /const clean = studioBufferStateStore\.hasCleanLeave\(lastWorkspace\);/);
});

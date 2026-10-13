import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

// Oliver, 13 Oct: File ▾'s lower part listed every recovery action all the time, under an
// empty heading, with a Status line about the response. Now each item shows only while it applies.
const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../client/studio.css", import.meta.url), "utf8");
const section = (start, end) => { const a = source.indexOf(start), b = source.indexOf(end, a + start.length); assert(a >= 0 && b > a); return source.slice(a, b); };
const recovery = ["studioForgetCopyBtn", "studioRecheckLaunchBtn", "studioForgetLaunchBtn", "studioResolveSaveBtn", "studioRecheckMoveBtn",
  "studioCancelMoveBtn", "studioFindMovedDocumentBtn", "studioDownloadHandoffBtn", "studioDiscardHandoffBtn"];

function harness(workspaceLayout = true) {
  const clicks = [];
  const elements = new Map([...recovery, "studioMoveDocumentBtn", "studioCopyDocumentBtn", "studioRecheckOpenBtn", "studioCancelOpenBtn", "studioDownloadOpenBtn"].map(id => [id, { id, hidden: false, click: () => clicks.push(id) }]));
  const s = { copy: {}, launch: {}, active: null, move: {}, backup: null, saves: [] };
  const c = vm.createContext({ documentHostingEnabled: true, documentHostingReady: true, documentHostingGeneration: 1, documentHostingSaveResolution: null, uiBusy: false,
    pendingSaveOperations: new Map(), bufferSwitcherUi: { workspaceLayout }, studioModalBlocksDraftAction: () => false, document: { getElementById: id => elements.get(id) },
    getStudioSelectedBuffer: () => ({ role: "document" }), openCompanionBtn: {}, sourceOpenCurrentTextCopyTabBtn: {}, documentOpenController: null,
    documentHostingController: { copyState: () => s.copy, active: () => s.active, launchState: () => s.launch, moveState: () => s.move },
    bufferRecoveryClient: { handoffBackup: () => s.backup, pendingHostingSaves: () => s.saves },
    syncStudioDocumentDestinations() {}, syncStudioOperationNotices() {}, wsState: "Ready", basenameForStudioPath: path => path });
  vm.runInContext(section("      function syncDocumentHostingControls()", "      async function requestDocumentHosting("), c);
  vm.runInContext(section("      function collectStudioOperationNotices()", "      function syncStudioOperationNotices()"), c);
  const shown = () => recovery.filter(id => !elements.get(id).hidden);
  return { s, c, elements, clicks, sync: () => c.syncDocumentHostingControls(), shown };
}

test("with nothing pending, no recovery item shows", () => {
  const h = harness(); h.sync(); assert.deepEqual(h.shown(), []);
});

test("each recovery item shows only while it applies", () => {
  const cases = [
    [s => { s.copy = { record: { request: {} } }; }, ["studioForgetCopyBtn"]],
    [s => { s.launch = { record: { request: {} } }; }, ["studioRecheckLaunchBtn", "studioForgetLaunchBtn"]],
    [s => { s.saves = [{ operationId: "x" }]; }, ["studioResolveSaveBtn"]],
    [s => { s.active = { moveId: "m" }; s.move = { pending: { moveId: "m" } }; }, ["studioRecheckMoveBtn", "studioCancelMoveBtn"]],
    [s => { s.backup = { record: { moveId: "m" } }; }, ["studioRecheckMoveBtn", "studioFindMovedDocumentBtn", "studioDownloadHandoffBtn", "studioDiscardHandoffBtn"]],
    [s => { s.backup = { error: { message: "unreadable" } }; }, ["studioDownloadHandoffBtn"]],
    [s => { s.move = { adoptionPending: { moveId: "m" } }; }, ["studioRecheckMoveBtn"]],
    [s => { s.move = { receipt: { moveId: "m" } }; }, ["studioFindMovedDocumentBtn"]],
  ];
  for (const [set, expected] of cases) {
    const h = harness(); set(h.s); h.sync(); assert.deepEqual(h.shown(), expected, expected.join());
    h.s.copy = {}; h.s.launch = {}; h.s.active = null; h.s.move = {}; h.s.backup = null; h.s.saves = []; h.sync(); assert.deepEqual(h.shown(), [], "hidden again once resolved");
  }
});

// Sol (candidate68): the notice's Stop checking… must reach the waiting forget() during a recheck.
test("Stop checking… for an editor request stays clickable from its notice while a recheck runs", () => {
  const h = harness(); h.s.launch = { record: { request: { operationId: "launch-1", bufferId: "doc" } }, busy: true }; h.sync();
  assert.equal(h.elements.get("studioForgetLaunchBtn").disabled, false);
  assert.equal(h.elements.get("studioRecheckLaunchBtn").disabled, true, "Try again still waits for the running check");
  const notice = h.c.collectStudioOperationNotices().get("launch:launch-1");
  assert.deepEqual([...notice.actions].map(a => a.label), ["Try again", "Stop checking…"]);
  assert.equal(h.c.activateStudioOperationNotice("launch:launch-1", notice.actions[1]), true); assert.deepEqual(h.clicks, ["studioForgetLaunchBtn"]);
});

test("outside the new layout nothing changes", () => {
  const h = harness(false); h.sync(); assert.deepEqual(h.shown(), recovery);
});

test("hidden items stay in place, because notices click them", () => {
  assert.match(source, /const control = document\.getElementById\(action\.controlId\);\n\s+if \(!control \|\| control\.disabled\) return false;\n\s+control\.click\(\);/);
});

test("no Workspace heading with nothing under it, and no Status in the new layout", () => {
  assert.match(source, /if \(clearWorkspaceBtn && !clearWorkspaceBtn\.hidden\) appendStudioUiRefreshMenuSection\(contextMenu\.menu, "Workspace", \[clearWorkspaceBtn\]\);/);
  assert.match(source, /if \(syncBadgeEl && bufferSwitchingEnabled\) syncBadgeEl\.remove\(\);\n\s+else if \(syncBadgeEl\) \{\n\s+syncBadgeEl\.hidden = false;\n\s+statusItems\.push\(syncBadgeEl\);/);
});

test("Copy text and the window items line up with the rest of File", () => {
  assert.match(css, /body\.studio-workspace-layout \.studio-refresh-menu-item > #copyDraftBtn,\n\s+body\.studio-workspace-layout \.studio-refresh-menu-item > button\.studio-buffer-menu-item,\n\s+body\.studio-workspace-layout \.studio-refresh-menu > button\.studio-buffer-menu-item \{ padding: 8px 10px; \}/);
  assert.ok(css.lastIndexOf("padding: 8px 10px; }") > css.indexOf("body.studio-ui-refresh #copyDraftBtn:only-child"), "comes after the rule it overrides");
  assert.match(css, /body\.studio-workspace-layout \.studio-refresh-menu-item:has\(> :only-child\[hidden\]\) \{ display: none; \}/, "no empty gap where a hidden item was");
});

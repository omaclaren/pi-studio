import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { createStudioDocumentHostController } from "../shared/studio-document-host-client.js";
const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
function section(start, end) { const a = source.indexOf(start), b = source.indexOf(end, a); assert(a >= 0 && b > a); return source.slice(a, b); }
function harness() {
  const clicks = [], controls = new Map(); let copy = {}, move = {}, opening = {}, backup = {}, saves = [];
  const c = vm.createContext({ documentHostingEnabled: true, documentHostingGeneration: 1, wsState: "Ready",
    documentHostingController: { copyState: () => copy, moveState: () => move }, documentOpenController: { state: () => opening },
    bufferRecoveryClient: { handoffBackup: () => backup, pendingHostingSaves: () => saves }, basenameForStudioPath: value => value?.split("/").at(-1),
    selected: "doc", getStudioSelectedBuffer: () => ({ id: c.selected }), studioOperationNotices: new Map(), studioOperationNoticesEl: null,
    document: { getElementById: id => controls.get(id) }, statusEl: {}, statusMessage: "Copied!", statusLevel: "success", bufferRecoveryIssue: null,
    shouldAnimateFooterSpinner: () => false, statusLineEl: null, statusSpinnerEl: null, updateFooterMeta() {},
  });
  vm.runInContext(section("function collectStudioOperationNotices()", "function setWsState(nextState)"), c);
  const control = id => controls.set(id, { disabled: false, click: () => clicks.push(id) });
  return { c, clicks, controls, control, setCopy: value => { copy = value; }, setMove: value => { move = value; },
    setOpen: value => { opening = value; }, setBackup: value => { backup = value; }, setSaves: value => { saves = value; } };
}
const request = { operationId: "intent", bufferId: "doc", path: "/work/methods.md" };

test("copy creation, connection and focus are distinct facts; unknown receipt never implies created", () => {
  const h = harness(); h.setCopy({ record: { request }, live: false });
  let n = h.c.collectStudioOperationNotices().get("copy:intent"); assert.match(n.message, /Couldn't confirm the copy was made/); assert.equal(n.bufferId, "doc");
  h.setCopy({ record: { request }, receipt: { operationId: "other" }, live: false }); assert.match(h.c.collectStudioOperationNotices().get(n.id).message, /Couldn't confirm the copy was made/);
  h.setCopy({ record: { request }, receipt: { operationId: "intent" }, live: false });
  n = h.c.collectStudioOperationNotices().get(n.id); assert.equal(n.message, "Copy made. Couldn't confirm its window opened.");
  h.setCopy({ record: { request }, receipt: { operationId: "intent" }, live: true }); assert.equal(h.c.collectStudioOperationNotices().size, 0);
  h.c.wsState = "Disconnected"; assert.equal(h.c.collectStudioOperationNotices().size, 1);
});

test("persistent unresolved facts outrank short confirmations; recovery warnings stay highest", () => {
  const h = harness(); h.setCopy({ record: { request }, live: false }); h.c.studioOperationNotices = h.c.collectStudioOperationNotices();
  h.c.renderStatus(); assert.match(h.c.statusEl.textContent, /Couldn't confirm the copy was made/); assert.equal(h.c.statusEl.className, "warning");
  h.c.statusMessage = "Switched view."; h.c.renderStatus(); assert.match(h.c.statusEl.textContent, /Couldn't confirm the copy was made/);
  h.c.bufferRecoveryIssue = "Server recovery unacknowledged."; h.c.renderStatus(); assert.match(h.c.statusEl.textContent, /^Recovery:/);
  h.c.bufferRecoveryIssue = null; h.setCopy({}); h.c.studioOperationNotices = h.c.collectStudioOperationNotices(); h.c.renderStatus();
  assert.equal(h.c.statusEl.textContent, "Switched view.");
});

test("reachable operation notice owns the fact once; footer stays quiet but recovery still wins", () => {
  const h = harness(); h.setCopy({ record: { request }, receipt: { operationId: "intent" }, live: false });
  h.c.studioOperationNotices = h.c.collectStudioOperationNotices();
  h.c.studioOperationNoticesEl = { isConnected: true, hidden: false };
  h.c.renderStatus(); assert.equal(h.c.statusEl.textContent, ""); assert.equal(h.c.statusEl.className, "");
  h.c.statusMessage = "Saved a different buffer."; h.c.renderStatus(); assert.equal(h.c.statusEl.textContent, "");
  assert.match(h.c.studioOperationNotices.get("copy:intent").message, /Copy made/);
  h.c.bufferRecoveryIssue = "Server recovery unacknowledged."; h.c.renderStatus();
  assert.match(h.c.statusEl.textContent, /^Recovery:/); assert.doesNotMatch(h.c.statusEl.textContent, /Copy made/);
  assert.equal(h.c.statusEl.className, "warning");
  h.c.bufferRecoveryIssue = null; h.setCopy({}); h.c.studioOperationNotices = h.c.collectStudioOperationNotices();
  h.c.renderStatus(); assert.equal(h.c.statusEl.textContent, "Saved a different buffer.");
});

test("unrendered or hidden operation notice retains footer fallback rather than losing the warning", () => {
  const h = harness(); h.setCopy({ record: { request }, live: false }); h.c.studioOperationNotices = h.c.collectStudioOperationNotices();
  for (const element of [null, { isConnected: false, hidden: false }, { isConnected: true, hidden: true }]) {
    h.c.studioOperationNoticesEl = element; h.c.renderStatus(); assert.match(h.c.statusEl.textContent, /Couldn't confirm the copy was made/);
  }
});

test("stale notice action cannot retry a newer copy, cancel an unrelated move or bypass disabled controls", () => {
  const h = harness(); h.control("studioCopyDocumentBtn"); h.control("studioCancelMoveBtn"); h.setCopy({ record: { request }, live: false });
  assert(h.c.activateStudioOperationNotice("copy:intent", { controlId: "studioCopyDocumentBtn" }));
  assert.equal(h.c.activateStudioOperationNotice("copy:intent", { controlId: "studioCancelMoveBtn" }), false);
  h.setCopy({ record: { request: { ...request, operationId: "next" } }, live: false });
  assert.equal(h.c.activateStudioOperationNotice("copy:intent", { controlId: "studioCopyDocumentBtn" }), false);
  h.controls.get("studioCopyDocumentBtn").disabled = true;
  assert.equal(h.c.activateStudioOperationNotice("copy:next", { controlId: "studioCopyDocumentBtn" }), false);
  assert.deepEqual(h.clicks, ["studioCopyDocumentBtn"]);
});

test("committed move, destination adoption and local backup release remain distinct", () => {
  const h = harness(); h.setBackup({ record: { moveId: "move-1", buffer: { id: "old-doc" } } });
  h.setMove({ receipt: { moveId: "move-1", adopted: false } }); let n = h.c.collectStudioOperationNotices().get("move:move-1");
  assert.equal(n.bufferId, "old-doc"); assert.match(n.message, /couldn't confirm the other window accepted it/);
  h.setMove({ receipt: { moveId: "move-1", adopted: true } }); n = h.c.collectStudioOperationNotices().get(n.id);
  assert.match(n.message, /The other window accepted the moved Document\. A backup is still kept here/);
  h.setBackup({ record: null }); assert.equal(h.c.collectStudioOperationNotices().size, 0);
});

test("uncertain file opening keeps original identity, honest previous-text wording and existing retry/cancel routes", () => {
  const h = harness(); h.setOpen({ record: { request }, busy: false }); const n = h.c.collectStudioOperationNotices().get("open:intent");
  assert.equal(n.message, "Couldn’t confirm that methods.md opened. Previous text kept.");
  assert.equal(n.bufferId, "doc"); assert.deepEqual(Array.from(n.actions, a => a.controlId), ["studioRecheckOpenBtn", "studioCancelOpenBtn", "studioDownloadOpenBtn"]);
  h.control("studioRecheckOpenBtn"); assert(h.c.activateStudioOperationNotice(n.id, n.actions[0]));
  h.setOpen({ record: null }); assert.equal(h.c.activateStudioOperationNotice(n.id, n.actions[0]), false);
});

test("saved-backing notice cannot operate on a different currently selected buffer", () => {
  const h = harness(); h.control("studioResolveSaveBtn"); h.setSaves([{ operationId: "save-1", bufferId: "doc" }]);
  h.c.selected = "prompt"; assert.equal(h.c.activateStudioOperationNotice("save:save-1", { controlId: "studioResolveSaveBtn", selectedBufferOnly: false }), false);
  h.c.selected = "doc"; assert(h.c.activateStudioOperationNotice("save:save-1", { controlId: "studioResolveSaveBtn" }));
});

test("adoption facts do not leak between different move identities", () => {
  const h = harness(); h.setBackup({ record: { moveId: "old", buffer: { id: "doc" } } });
  h.setMove({ receipt: { moveId: "new", adopted: true } });
  assert.match(h.c.collectStudioOperationNotices().get("move:old").message, /couldn't confirm the other window accepted it/);
});

test("receiving adoption acknowledgement stays public until the same receipt is rechecked and acknowledged", async () => {
  let failure = true; const requests = [], storage = new Map();
  const move = { moveId: "move-1", bufferId: "doc", targetWorkspaceId: "source", status: "committed" };
  const controller = createStudioDocumentHostController({ workspaceId: "source", full: true,
    copyStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    client: () => ({ snapshot: () => ({ buffers: [{ id: "doc" }] }), hasVerifiedLocalCheckpoint: () => true, handoffBackup: () => ({ record: null }) }),
    generation: () => 1, status() {}, changed() {}, request: async body => { requests.push(body); if (body.operation === "status") return { ok: true, ...move };
      if (failure) throw Error("ack lost"); return { ok: true }; } });
  try {
    await controller.ready({ lineage: [{ move }] }); assert.equal(controller.moveState().adoptionPending.moveId, "move-1");
    failure = false; await controller.recheck(); assert.equal(controller.moveState().adoptionPending, null);
    assert.deepEqual(requests.map(r => r.operation), ["adopted", "status", "adopted"]);
    assert(requests.every(r => r.moveId === "move-1"));
  } finally { controller.dispose(); }
});

test("public copy receipt retains verified creation independently of later unknown transport or opening", async () => {
  const storage = new Map(), requests = []; let fail = false;
  const controller = createStudioDocumentHostController({ workspaceId: "source", full: true,
    copyStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    client: () => ({ hostingAuthority: () => ({ ok: true, bufferId: "doc", documentEpoch: 1, expectedRevision: "a".repeat(48) }) }),
    generation: () => 1, prepare: async () => {}, busy: () => false, status() {}, changed() {}, open() {}, confirmCopy: async () => true,
    request: async body => { requests.push(body); if (fail) throw Error("reply lost"); return body.operation === "copy"
      ? { ok: true, operationId: body.operationId, created: true, workspaceId: "target", bufferId: "copy_doc", live: false, url: "/same-copy" }
      : { ok: true, owner: { workspaceId: "target", bufferId: "copy_doc", mode: "editor-only" }, seen: false, live: false, url: "/same-copy" }; },
  });
  try {
    await controller.copy(); const first = controller.copyState(); assert.equal(first.receipt.sourceBufferId, "doc");
    assert.equal(first.record, null); assert.equal(first.receipt.operationId, first.destinations[0].operationId); assert.equal(first.live, false);
    first.receipt.bufferId = "mutated"; assert.equal(controller.copyState().receipt.bufferId, "copy_doc");
    fail = true; await controller.openDestination(first.destinations[0]); const second = controller.copyState(); assert.equal(second.receipt.bufferId, "copy_doc");
    assert.equal(requests.filter(r => r.operation === "copy").length, 1, "showing a destination never creates another copy");
    await controller.copy(); assert(controller.copyState().record); await controller.forgetCopy();
    assert.equal(controller.copyState().record, null); assert.equal(controller.copyState().destinations[0].bufferId, "copy_doc");
  } finally { controller.dispose(); }
});

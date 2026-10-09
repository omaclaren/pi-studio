import test from "node:test";
import assert from "node:assert/strict";
import { createStudioDocumentHostController } from "../shared/studio-document-host-client.js";
const revision = "a".repeat(48), workspaceId = "source_workspace_00000001";
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function memory() { const map = new Map(); return { getItem: k => map.get(k) ?? null, setItem: (k,v) => map.set(k,v), removeItem: k => map.delete(k), map }; }
function fixture(t, overrides = {}) {
	const f = { generation: 1, opens: [], calls: [], messages: [], finishes: 0, prepared: 0, storage: memory(), epoch: 3, revision };
	const state = { selectedBufferId: "doc", buffers: [{ id: "doc", role: "document", text: "keep draft" }] };
	const client = { snapshot: () => state, hostingAuthority: () => ({ ok: true, bufferId: "doc", documentEpoch: f.epoch, expectedRevision: f.revision }),
		freezeHosting: p => ({ ok: true, proof: { ...p, state, expectedRevision: revision } }),
		finishHosting: () => { f.finishes++; return { ok: true, selectedChanged: false }; }, handoffBackup: () => null,
		hasVerifiedLocalCheckpoint: () => true, resolveHandoff: () => ({ ok: true }) };
	f.response = body => ({ ok: true, bufferId: "copy", url: "/copy", live: false });
	f.options = { workspaceId, full: true, client: () => client, generation: () => f.generation,
		copyStorage: f.storage, request: async body => {
			f.calls.push(body); const result = await f.response(body);
			if (!result.ok) return result;
			if (body.operation === "copy") return { operationId: body.operationId, created: true, workspaceId: "destination", bufferId: "copy", ...result };
			if (body.operation === "owner") return { owner: { workspaceId: "destination", bufferId: body.bufferId, mode: "editor-only" }, ...result };
			return result;
		},
		busy: () => false, prepare: async () => { f.prepared++; }, status: text => f.messages.push(text), changed() {},
		capture() {}, depart() {}, bind() {}, retire() {}, domCurrent: () => true, closeRetired() {},
		confirm: async () => true, confirmResume: async () => true, open: url => f.opens.push(url), ...overrides };
	f.controller = createStudioDocumentHostController(f.options); t.after(() => f.controller.dispose()); return f;
}
test("uncertain copy retries its immutable intent with the new connection generation", async t => {
	const f = fixture(t); f.response = async () => { throw Error("lost acknowledgement"); };
	await f.controller.copy(); const first = f.calls[0];
	f.generation = 2; f.epoch = 9; f.revision = "b".repeat(48);
	f.response = () => ({ ok: true, url: "/existing-copy", live: true }); await f.controller.copy();
	const creations = f.calls.filter(c => c.operation === "copy");
	assert.equal(creations.length, 2); assert.equal(creations[1].operationId, first.operationId);
	assert.equal(creations[1].expectedRevision, revision); assert.equal(creations[1].documentEpoch, 3); assert.equal(creations[1].generation, 2);
	assert.equal(f.prepared, 1); assert.deepEqual(f.opens, []);
});
test("copy identity survives a reload without borrowing the current source proof", async t => {
	const f = fixture(t); f.response = async () => { throw Error("lost"); }; await f.controller.copy(); f.controller.dispose();
	const g = fixture(t, { copyStorage: f.storage }); g.epoch = 11; g.revision = "c".repeat(48);
	await g.controller.copy(); assert.equal(g.calls[0].operationId, f.calls[0].operationId);
	assert.equal(g.calls[0].documentEpoch, 3); assert.equal(g.prepared, 0);
});
test("concurrent copy presses dispatch only once", async t => {
	const gate = deferred(), f = fixture(t, { prepare: () => gate.promise });
	const a = f.controller.copy(), b = f.controller.copy(); gate.resolve(); await Promise.all([a,b]);
	assert.equal(f.calls.filter(c => c.operation === "copy").length, 1); assert.equal(f.opens.length, 1);
});
test("copy does not dispatch if its identity cannot be retained", async t => {
	const f = fixture(t, { copyStorage: { getItem: () => null, setItem() { throw Error("quota"); } } });
	await f.controller.copy(); assert.equal(f.calls.length, 0); assert.equal(f.opens.length, 0);
});
test("a malformed copy record is kept, not replaced with another copy", async t => {
	const storage = memory(), key = "piStudio.bufferWorkspace.v2:" + workspaceId + ":copy"; storage.setItem(key, "foreign recovery");
	const f = fixture(t, { copyStorage: storage }); await f.controller.copy();
	assert.equal(f.calls.length, 0); assert.equal(storage.getItem(key), "foreign recovery");
});
test("retrying a closed/missing copy never allocates another identity", async t => {
	const f = fixture(t); f.response = () => ({ ok: false, reason: "copy-closed", message: "closed" });
	await f.controller.copy(); await f.controller.copy(); assert.equal(f.calls[0].operationId, f.calls[1].operationId);
	assert.deepEqual(f.opens, []);
});
test("committed notification before move HTTP acknowledgement still opens once", async t => {
	const post = deferred(), f = fixture(t); let move;
	f.response = body => {
		if (body.operation === "move-out") { move = body.moveId; return post.promise; }
		return { ok: true, moveId: move, status: "committed", sourceWorkspaceId: workspaceId, targetWorkspaceId: "destination", bufferId: "doc", url: "/destination", live: false, seen: false };
	};
	const moving = f.controller.move(); await Promise.resolve(); await Promise.resolve();
	assert(move); await f.controller.onChanged(move);
	post.resolve({ ok: true, moveId: move, status: "committed", bufferId: "doc" }); await moving;
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(f.finishes, 1); assert.deepEqual(f.opens, ["/destination"]);
});
test("duplicate Find presses share one pending owner lookup/open", async t => {
	const f = fixture(t), status = deferred(); let hold = false, move;
	f.response = body => {
		if (body.operation === "move-out") { move = body.moveId; return { ok: true, moveId: move, status: "committed", targetWorkspaceId: "destination", bufferId: "doc" }; }
		return hold ? status.promise : { ok: true, moveId: move, status: "committed", targetWorkspaceId: "destination", bufferId: "doc", url: "/destination", live: true };
	};
	await f.controller.move(); hold = true;
	const a = f.controller.openMoved(), b = f.controller.openMoved();
	status.resolve({ ok: true, moveId: move, status: "committed", targetWorkspaceId: "destination", bufferId: "doc", url: "/destination", live: false, seen: false }); await Promise.all([a,b]);
	assert.deepEqual(f.opens, ["/destination"]);
});
test("disposal while preparation is pending cannot freeze or send a move", async t => {
	const gate = deferred(), f = fixture(t, { prepare: () => gate.promise }); const work = f.controller.move();
	f.controller.dispose(); gate.resolve(); await work; assert.equal(f.calls.length, 0); assert.equal(f.finishes, 0);
});
test("a pending or failed copy recheck cannot reuse an earlier live confirmation", async t => {
	const f = fixture(t); f.response = () => ({ ok: true, live: true });
	await f.controller.copy(); assert.equal(f.controller.needsUnloadConfirmation(), false);
	const saved = f.calls[0], held = deferred(); f.response = () => held.promise;
	const pending = f.controller.openDestination(f.controller.copyState().destinations[0]);
	assert.equal(f.controller.needsUnloadConfirmation(), true);
	held.reject(Error("offline")); await pending;
	assert.equal(f.controller.copyState().live, false);
	assert.equal(f.controller.needsUnloadConfirmation(), true);
	f.response = () => ({ ok: true, live: true }); await f.controller.openDestination(f.controller.copyState().destinations[0]);
	assert.equal(f.controller.needsUnloadConfirmation(), false);
	assert(f.calls.filter(c => c.operation === "copy").every(c => c.operationId === saved.operationId)); assert.deepEqual(f.opens, []);
});
test("disconnect and a failed automatic copy recheck retain the unload warning", async t => {
	const f = fixture(t); f.response = () => ({ ok: true, live: true });
	await f.controller.copy(); f.generation = 0;
	assert.equal(f.controller.needsUnloadConfirmation(), true);
	f.generation = 2; f.response = () => { throw Error("offline"); };
	await f.controller.ready({}); assert.equal(f.controller.copyState().live, false);
	assert.equal(f.controller.needsUnloadConfirmation(), true); assert.equal(f.calls.at(-1).generation, 2);
	assert.equal(f.calls.filter(c => c.operation === "copy").length, 1); assert.equal(f.calls.at(-1).operation, "owner"); assert.deepEqual(f.opens, []);
});
test("Forget copy cancels safely and removes tracking only after explicit consent", async t => {
	const f = fixture(t, { confirmCopy: async () => false }); f.response = () => { throw Error("unknown creation"); }; await f.controller.copy();
	const before = [...f.storage.map]; await f.controller.forgetCopy(); assert.deepEqual([...f.storage.map], before);
	f.options.confirmCopy = async () => true; await f.controller.forgetCopy();
	assert.equal(f.storage.map.size, 0); assert.equal(f.calls.length, 1);
	await f.controller.copy(); assert.notEqual(f.calls[0].operationId, f.calls[1].operationId);
});
test("Forget copy cannot clear independently changed tracking during consent", async t => {
	const held = deferred(), f = fixture(t, { confirmCopy: () => held.promise }); f.response = () => { throw Error("unknown creation"); }; await f.controller.copy();
	const key = [...f.storage.map.keys()][0], pending = f.controller.forgetCopy();
	f.storage.setItem(key, "foreign tracking"); held.resolve(true); await pending;
	assert.equal(f.storage.getItem(key), "foreign tracking"); assert.equal(f.calls.length, 1);
});
test("committed move destination survives reload and draft resume remains owner-aware and consent guarded", async t => {
 const f = fixture(t); let move;
 f.response = body => { if (body.operation === "move-out") move = body.moveId; return { ok: true, moveId: move, status: "committed", targetWorkspaceId: "destination", bufferId: "doc", url: "/destination", live: false, seen: false }; };
 await f.controller.move(); assert.equal(f.controller.copyState().destinations[0].kind, "move"); f.controller.dispose();
 const g = fixture(t, { copyStorage: f.storage, confirmResume: async () => false });
 g.response = () => ({ ok: true, moveId: move, status: "committed", targetWorkspaceId: "destination", bufferId: "doc", url: "/destination", live: false, seen: true });
 await g.controller.openMoved(); assert.equal(g.opens.length, 0); assert(g.calls.every(r => !["move-out", "copy", "launch"].includes(r.operation)));
 g.options.confirmResume = async () => true; await g.controller.openMoved(); assert.deepEqual(g.opens, ["/destination"]);
});
test("adopted move never releases its real backup before destination tracking is verified", async t => {
 const f = fixture(t); const moveId = "d".repeat(48), backup = { moveId, document: { id: "doc" } }; let resolved = 0;
 const original = f.options.client(); f.options.client = () => ({ ...original, handoffBackup: () => ({ record: backup }), resolveHandoff: () => { resolved++; return { ok: true }; } });
 f.response = () => ({ ok: true, moveId, bufferId: "doc", status: "committed", adopted: true, targetWorkspaceId: "destination", live: true, seen: true, url: "/destination" });
 const set = f.storage.setItem; f.storage.setItem = () => { throw Error("quota"); };
 await f.controller.onChanged(moveId); assert.equal(resolved, 0);
 f.storage.setItem = set; await f.controller.onChanged(moveId); assert.equal(resolved, 1); assert.equal(f.controller.copyState().destinations[0].bufferId, "doc");
});
test("copy acknowledgement after disposal cannot open a tab", async t => {
	const post = deferred(), f = fixture(t); f.response = () => post.promise;
	const work = f.controller.copy(); await Promise.resolve(); await Promise.resolve();
	f.controller.dispose(); post.resolve({ ok: true, url: "/late", live: false }); await work; assert.deepEqual(f.opens, []);
});

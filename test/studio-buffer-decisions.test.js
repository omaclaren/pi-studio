import test from "node:test";
import assert from "node:assert/strict";
import { createStudioBufferRecoveryDecisions } from "../shared/studio-buffer-decisions.js";
import { createStudioBufferServerStore } from "../shared/studio-buffer-server.js";
import { createStudioBufferClient } from "../shared/studio-buffer-client.js";
import { migrateStudioWorkspaceV1, STUDIO_BUFFER_RECOVERY_PREFIX as prefix, STUDIO_BUFFER_LEGACY_TAB_PREFIX as legacyPrefix } from "../shared/studio-buffer-recovery.js";

const workspaceId = "tab_" + "a".repeat(32), newId = "tab_" + "b".repeat(32), mode = "full";
const expected = { workspaceId, mode }, key = prefix + workspaceId;
const editor = (text = "current") => ({ version: 1, savedAt: 10, text, sourceState: { source: "blank", label: "draft", path: null, draftId: "draft" },
	diskRevision: null, resourceDir: "", editorView: "markdown", rightView: "preview", editorLanguage: "markdown", followLatest: false,
	responseHistoryIndex: -1, selectionStart: 0, selectionEnd: 0, scrollTop: 0 });
function state(text = "copy") { let id = 0; return migrateStudioWorkspaceV1(editor(text), { ...expected, makeBufferId: () => "id-" + ++id }).state; }
function storage() { const map = new Map(); return { map, getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: () => assert.fail("Do not erase recovery") }; }
function setup(overrides = {}) {
	const browser = overrides.storage || storage(), server = overrides.server || createStudioBufferServerStore();
	const cap = server.issue(expected).capability;
	const choices = createStudioBufferRecoveryDecisions({ ...expected, storage: browser, readRemote: async () => server.inspect(cap),
		canRestore: () => true, makeWorkspaceId: () => newId, ...overrides });
	return { browser, server, cap, choices };
}

test("inspection exposes conflicting legacy/server copies without acknowledging or mutating either", () => {
	let legacy = null;
	const server = createStudioBufferServerStore({ legacyState: () => legacy }), cap = server.issue(expected).capability;
	const original = state(), saved = server.write(cap, null, original);
	legacy = { ...editor("newer legacy"), savedAt: 20 };
	assert.equal(server.read(cap).reason, "legacy-newer");
	const inspected = server.inspect(cap);
	assert(inspected.ok); assert.equal(inspected.records[0].raw, JSON.stringify(original));
	assert.equal(inspected.records[1].raw, JSON.stringify(legacy));
	assert(!("expiresInMs" in inspected)); assert(!("revision" in inspected));
	assert.equal(server.write(cap, saved.revision, { ...original, savedAt: 30, revision: 1 }).reason, "legacy-newer");
	assert.equal(server.inspect("forged").reason, "forbidden");
	const other = server.issue({ ...expected, mode: "editor-only" }).capability;
	assert.equal(server.inspect(other).reason, "wrong-workspace");
	server.release(cap); assert.equal(server.inspect(cap).reason, "forbidden");
});

test("inspection and JSON archive retain raw future/malformed/unscoped copies and full current text", async () => {
	const f = setup(), future = '{"version":99,"text":"future"}', malformed = "malformed\ud800<script>";
	f.browser.setItem(key, future); f.browser.setItem(legacyPrefix + workspaceId, malformed);
	f.browser.setItem("piStudio.workspaceState.v1", JSON.stringify(editor("older")));
	const before = new Map(f.browser.map), result = await f.choices.inspect();
	assert(result.ok); assert.equal(result.records.length, 3); assert.equal(result.records[0].canUse, false);
	assert.equal(result.records[1].state, null); assert.equal(result.records[2].canUse, true);
	const archive = JSON.parse(f.choices.archive("current\ud800"));
	assert.equal(archive.currentText, "current\ud800"); assert.equal(archive.copies[1].raw, malformed);
	assert.deepEqual(f.browser.map, before);
	assert.equal((await f.choices.use(result.records[0])).ok, false);
	assert(!f.browser.getItem(prefix + newId));
});

test("explicit compatible choice forks into a new namespace and keeps every original byte", async () => {
	const f = setup(), original = state("unsaved recovery");
	f.browser.setItem(key, JSON.stringify(original)); f.browser.setItem(legacyPrefix + workspaceId, JSON.stringify(editor("old")));
	f.server.write(f.cap, null, state("different server"));
	const before = new Map(f.browser.map), result = await f.choices.inspect();
	const copied = await f.choices.use(result.records.find(r => r.id === "browser-v2"));
	assert(copied.ok); assert.equal(copied.workspaceId, newId);
	assert.deepEqual(copied.state, { ...original, workspaceId: newId });
	for (const [k, raw] of before) assert.equal(f.browser.getItem(k), raw);
	assert.equal(f.server.read(f.cap).state.buffers[0].text, "different server");
	assert.equal(f.browser.getItem(prefix + newId + ":serverAck"), null);
});

test("wrong source, mode, workspace, hidden collections and forged handles cannot be adopted", async () => {
	for (const kind of ["source", "mode", "workspace", "hidden"]) {
		const f = setup({ canRestore: () => kind !== "source" }), original = structuredClone(state());
		if (kind === "mode") { original.mode = "editor-only"; original.activePromptId = null; original.buffers[0].role = "document"; }
		if (kind === "workspace") original.workspaceId = newId;
		if (kind === "hidden") { const b = { ...original.buffers[0], id: "hidden" }; original.buffers.push(b); original.order.push(b.id); }
		f.browser.setItem(key, JSON.stringify(original));
		const record = (await f.choices.inspect()).records[0];
		assert.equal(record.canUse, false, kind); assert.equal((await f.choices.use(record)).ok, false);
		assert.equal((await f.choices.use({ ...record })).reason, "invalid-choice");
		assert.equal(f.browser.getItem(prefix + newId), null);
	}
});

test("changed browser/server copies and superseded inspections invalidate choices", async () => {
	for (const channel of ["browser", "server", "inspection"]) {
		const f = setup(), original = state(); f.browser.setItem(key, JSON.stringify(original));
		const saved = f.server.write(f.cap, null, original);
		const result = await f.choices.inspect(), record = result.records.find(r => r.id === (channel === "server" ? "server-v2" : "browser-v2"));
		if (channel === "browser") f.browser.setItem(key, "changed");
		if (channel === "server") f.server.write(f.cap, saved.revision, { ...original, revision: 1, savedAt: 11 });
		if (channel === "inspection") await f.choices.inspect();
		assert.equal((await f.choices.use(record)).ok, false); assert.equal(f.browser.getItem(prefix + newId), null);
	}
});

test("late source/typing consent and closed owners cannot seed or navigate", async () => {
	let resolve, delay = false;
	const f = setup({ readRemote: () => delay ? new Promise(r => { resolve = r; }) : Promise.resolve(f.server.inspect(f.cap)) });
	f.server.write(f.cap, null, state());
	const record = (await f.choices.inspect()).records[0];
	delay = true; let current = true;
	const pending = f.choices.use(record, () => current); current = false;
	resolve(f.server.inspect(f.cap)); assert.equal((await pending).reason, "editor-changed");
	assert.equal(f.browser.getItem(prefix + newId), null);
	f.choices.dispose(); assert.equal((await f.choices.use(record)).ok, false);
	assert.equal((await f.choices.inspect()).reason, "cancelled");
});

test("fresh-copy quota, collisions and unavailable reads never replace original recovery", async () => {
	for (const kind of ["quota", "collision", "ack", "unavailable"]) {
		const f = setup(); f.browser.setItem(key, "future data");
		if (kind === "collision") f.browser.setItem(prefix + newId, "other data");
		if (kind === "ack") f.browser.setItem(prefix + newId + ":serverAck", "old metadata");
		const before = new Map(f.browser.map);
		if (kind === "quota") f.browser.setItem = () => { throw new Error("quota"); };
		if (kind === "unavailable") f.browser.getItem = () => { throw new Error("blocked"); };
		assert.equal(f.choices.keepCurrent(editor(), null).ok, false, kind);
		assert.deepEqual(f.browser.map, before);
	}
});

test("keep-current is explicit, preserves a file baseline, and never auto-adopts corrupt recovery", async () => {
	const f = setup(); f.browser.setItem(key, "future or broken");
	const file = { ...editor("later edits"), sourceState: { source: "file", label: "file", path: "/file", draftId: null }, diskRevision: "sha256:" + "a".repeat(64) };
	const result = f.choices.keepCurrent(file, "actual saved text", { view: { selectionDirection: "backward" }, metadata: { annotationsEnabled: false } });
	assert(result.ok); const b = result.state.buffers.find(b => b.id === result.state.selectedBufferId);
	assert.equal(b.text, "later edits"); assert.equal(b.baselineText, "actual saved text"); assert.equal(b.view.selectionDirection, "backward");
	assert.equal(b.metadata.annotationsEnabled, false); assert.equal(f.browser.getItem(key), "future or broken");
});

test("unavailable/invalid remote inspection still allows export of known browser copies", async () => {
	for (const remote of [{ ok: false, reason: "unavailable", message: "offline" }, { ok: true, ...expected, mode: "editor-only", records: [] }]) {
		const f = setup({ readRemote: async () => remote }); f.browser.setItem(key, JSON.stringify(state()));
		const result = await f.choices.inspect(); assert(result.ok); assert.equal(result.records.length, 1); assert.equal(result.errors.length, 1);
		assert.equal(JSON.parse(f.choices.archive("current")).copies.length, 1);
	}
});

function clientSetup() {
	const f = setup(); let failWrite = false, beforeRead = () => {};
	let n = 0;
	const client = createStudioBufferClient({ ...expected, storage: f.browser, makeBufferId: () => "client-" + ++n, canRestore: () => true,
		readRemote: async () => { await beforeRead(); return f.server.read(f.cap); },
		writeRemote: async (state, rev) => { if (failWrite) throw new Error("offline"); return f.server.write(f.cap, rev, state); },
		readLegacyRemote: async () => ({ ok: true, state: null }),
	});
	return { ...f, client, failWrites: value => { failWrite = value; }, onRead: fn => { beforeRead = fn; } };
}

test("explicit persistence retry acknowledges current text without restoring older recovery", async () => {
	const f = clientSetup(); await f.client.initialize(editor("old"), null); await f.client.settled();
	f.failWrites(true); f.client.persist(editor("live newer"), null); await f.client.settled();
	assert(f.client.needsUnloadConfirmation()); f.failWrites(false);
	assert((await f.client.retry()).ok);
	assert.equal(f.server.read(f.cap).state.buffers[0].text, "live newer"); assert.equal(f.client.needsUnloadConfirmation(), false);
});

test("retry resumes server-only recovery without writing unseen browser data or ancestry", async () => {
	const browser = { getItem() { throw new Error("denied"); }, setItem() { assert.fail("Cannot attach acknowledgement to unseen browser data"); } };
	const server = createStudioBufferServerStore(), cap = server.issue(expected).capability;
	let n = 0;
	const client = createStudioBufferClient({ ...expected, storage: browser, makeBufferId: () => "server-only-" + ++n, canRestore: () => true,
		readRemote: async () => server.read(cap), writeRemote: async (state, rev) => server.write(cap, rev, state), readLegacyRemote: async () => ({ ok: true, state: null }) });
	assert((await client.initialize(editor("server-only live text"), null)).ok); await client.settled();
	client.invalidateRemoteRecovery(); client.capture(editor("later server-only text"), null);
	assert((await client.retry()).ok); assert.equal(server.read(cap).state.buffers[0].text, "later server-only text");
	assert.equal(client.needsUnloadConfirmation(), false);
});

test("retry refuses divergent server and corrupt/changed browser branches", async () => {
	for (const kind of ["server", "browser", "legacy"]) {
		const f = clientSetup(); await f.client.initialize(editor(), null); await f.client.settled();
		if (kind === "server") {
			const previous = f.server.read(f.cap), newer = structuredClone(previous.state); newer.revision++; newer.buffers[0].text = "other writer";
			f.server.write(f.cap, previous.revision, newer);
		} else f.browser.setItem(kind === "browser" ? key : legacyPrefix + workspaceId, "corrupt");
		const before = new Map(f.browser.map); assert.equal((await f.client.retry()).ok, false, kind);
		assert.equal(f.client.snapshot().buffers[0].text, "current"); assert.deepEqual(f.browser.map, before);
		assert(f.client.needsUnloadConfirmation());
	}
});

test("typing, disconnect and disposal during retry cannot revive an old acknowledgement", async () => {
	for (const kind of ["typing", "disconnect", "dispose"]) {
		const f = clientSetup(); await f.client.initialize(editor(), null); await f.client.settled();
		let release; f.onRead(() => new Promise(resolve => { release = resolve; }));
		const pending = f.client.retry(); await new Promise(resolve => setImmediate(resolve));
		if (kind === "typing") f.client.capture(editor("new typing"), null);
		if (kind === "disconnect") f.client.invalidateRemoteRecovery();
		if (kind === "dispose") f.client.dispose();
		release(); assert.equal((await pending).ok, false, kind); assert(f.client.needsUnloadConfirmation());
	}
});

import test from "node:test";
import assert from "node:assert/strict";
import { createStudioBufferClient } from "../shared/studio-buffer-client.js";
import { createStudioBufferServerStore } from "../shared/studio-buffer-server.js";
import { migrateStudioWorkspaceV1, STUDIO_BUFFER_RECOVERY_PREFIX, STUDIO_BUFFER_LEGACY_TAB_PREFIX } from "../shared/studio-buffer-recovery.js";
const id = "tab_" + "a".repeat(32);
const editor = (text = "draft", overrides = {}) => ({ version: 1, savedAt: 10,
	sourceState: { source: "blank", label: "draft", path: null, draftId: "draft-original" }, diskRevision: null, resourceDir: "",
	editorView: "markdown", rightView: "preview", editorLanguage: "markdown", followLatest: false, responseHistoryIndex: -1,
	selectionStart: 0, selectionEnd: 0, scrollTop: 0, text, ...overrides });
const context = { workspaceId: id, mode: "full" };
let next = 0;
const makeBufferId = () => "buffer-" + ++next;
const snapshot = (text = "draft", overrides = {}) => ({ ...migrateStudioWorkspaceV1(editor(text), { ...context, makeBufferId }).state, ...overrides });
function storage() {
	const map = new Map();
	return { map, getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: () => assert.fail("Recovery must not be erased") };
}
function setup(overrides = {}) {
	const browser = overrides.storage || storage(), server = overrides.server || createStudioBufferServerStore();
	const capability = server.issue(context).capability;
	const issues = [];
	const client = createStudioBufferClient({ ...context, storage: browser, makeBufferId, canRestore: () => true,
		readRemote: async () => server.read(capability), writeRemote: async (state, revision) => server.write(capability, revision, state),
		readLegacyRemote: async () => ({ ok: true, state: null }), onIssue: value => issues.push(value), ...overrides });
	return { client, browser, server, capability, issues };
}
const key = STUDIO_BUFFER_RECOVERY_PREFIX + id;

test("server capabilities bind workspace/mode and never issue for watched views", () => {
	const server = createStudioBufferServerStore();
	assert.equal(server.issue({ ...context, watched: true }).ok, false);
	assert.equal(server.issue({ ...context, mode: "watched" }).ok, false);
	assert.equal(server.read("forged").reason, "forbidden");
	const companion = server.issue({ ...context, mode: "editor-only" }).capability;
	assert.equal(server.write(companion, null, snapshot()).reason, "wrong-workspace");
	const cap = server.issue(context).capability;
	assert.equal(server.write(cap, undefined, snapshot()).reason, "invalid-request");
	assert.equal(server.write(cap, null, snapshot("text", { workspaceId: "tab_" + "b".repeat(32) })).reason, "wrong-workspace");
});

test("server CAS accepts exact retries but rejects stale/divergent browser writers", () => {
	const server = createStudioBufferServerStore(), cap = server.issue(context).capability, state = snapshot();
	const first = server.write(cap, null, state);
	assert(first.ok);
	assert.equal(server.write(cap, null, state).revision, first.revision);
	const newer = { ...state, revision: 1, savedAt: 20 };
	assert.equal(server.write(cap, null, newer).reason, "conflict");
	assert.equal(server.write(cap, first.revision, { ...state, savedAt: 11 }).reason, "stale-state");
	const second = server.write(cap, first.revision, newer);
	assert(second.ok);
	assert.notEqual(first.revision, second.revision);
	assert.equal(server.write(cap, first.revision, state).reason, "conflict");
	assert.equal(server.read(cap).state.revision, 1);
});

test("server capacity/expiry never evicts another live workspace to admit writes", () => {
	let now = 1;
	const server = createStudioBufferServerStore({ maxEntries: 1, maxTotalTextChars: 10, maxCapabilities: 2, ttlMs: 20, now: () => now });
	const a = server.issue(context).capability, b = server.issue({ ...context, workspaceId: "tab_" + "b".repeat(32) }).capability;
	assert.equal(server.issue(context).reason, "capacity");
	assert(server.write(a, null, snapshot()).ok);
	assert.equal(server.write(b, null, snapshot("x", { workspaceId: "tab_" + "b".repeat(32) })).reason, "capacity");
	assert.equal(server.read(a).state.buffers[0].text, "draft");
	const old = server.read(a);
	const large = JSON.parse(JSON.stringify(old.state)); large.buffers[0].text = "x".repeat(11); large.revision++;
	assert.equal(server.write(a, old.revision, large).reason, "capacity");
	assert.equal(server.read(a).state, old.state);
	now = 30;
	assert.equal(server.read(a).reason, "forbidden");
	assert.equal(server.size, 0);
});

test("newer or reset legacy server data blocks both v2 reads and writes", () => {
	let legacy = null;
	const server = createStudioBufferServerStore({ legacyState: () => legacy }), cap = server.issue(context).capability;
	const initial = server.write(cap, null, snapshot());
	legacy = editor("new v1 draft", { savedAt: 100 });
	assert.equal(server.read(cap).reason, "legacy-newer");
	assert.equal(server.write(cap, initial.revision, snapshot("candidate", { revision: 2, savedAt: 1000 })).reason, "legacy-newer");
	legacy = editor("", { sourceState: { source: "recovery-cleared", label: "", path: null, draftId: null } });
	assert.equal(server.read(cap).reason, "legacy-conflict");
});

test("single-editor migration retains exact legacy bytes and sends acknowledged v2 only", async () => {
	const f = setup();
	const raw = JSON.stringify(editor("legacy unsent")); f.browser.setItem(STUDIO_BUFFER_LEGACY_TAB_PREFIX + id, raw);
	const result = await f.client.initialize(editor("initial HTML"), null);
	assert(result.ok); assert(result.restored); assert.equal(result.editor.text, "legacy unsent");
	await f.client.settled();
	assert.equal(f.browser.getItem(STUDIO_BUFFER_LEGACY_TAB_PREFIX + id), raw);
	assert.equal(JSON.parse(f.browser.getItem(key)).version, 2);
	assert.equal(f.server.read(f.capability).state.buffers[0].text, "legacy unsent");
	assert.equal(f.issues.at(-1), "");
});

test("fresh files capture real baseline; migrated files retain unknown cleanliness", async () => {
	const file = editor("disk", { sourceState: { source: "file", label: "file", path: "/file.md", draftId: null }, diskRevision: "sha256:" + "a".repeat(64) });
	const f = setup();
	const result = await f.client.initialize(file, "disk");
	assert(result.ok); assert.equal(result.baselineText, "disk");
	const initial = f.client.snapshot(), doc = initial.buffers.find(b => b.id === initial.selectedBufferId);
	assert.equal(doc.role, "document"); assert.notEqual(initial.selectedBufferId, initial.activePromptId);
	assert(f.client.persist({ ...file, text: "unsaved" }, "disk").ok);
	await f.client.settled();
	const reloaded = setup({ storage: f.browser, server: f.server });
	const restored = await reloaded.client.initialize(file, "latest unrelated disk text");
	assert(restored.ok); assert.equal(restored.editor.text, "unsaved"); assert.equal(restored.baselineText, "disk");
	assert.equal(reloaded.client.snapshot().selectedBufferId, doc.id);
	await reloaded.client.settled();
	const migrated = setup(); migrated.browser.setItem(STUDIO_BUFFER_LEGACY_TAB_PREFIX + id, JSON.stringify(file));
	assert.equal((await migrated.client.initialize(file, "disk")).baselineText, null);
	await migrated.client.settled();
});

test("single-editor adapter projects metadata association keys into the selected buffer", async () => {
	const f = setup();
	await f.client.initialize(editor("prompt"), null);
	await f.client.settled();
	assert(f.client.persist(editor("prompt"), null, {
		metadata: {
			annotationsEnabled: false,
			reviewNotesKey: "draft:draft-original",
			scratchpadKey: "draft:draft-original",
		},
	}).ok);
	const state = f.client.snapshot();
	const selected = state.buffers.find(buffer => buffer.id === state.selectedBufferId);
	assert.deepEqual(selected.metadata, {
		annotationsEnabled: false,
		reviewNotesKey: "draft:draft-original",
		scratchpadKey: "draft:draft-original",
	});
	await f.client.settled();
});

test("store identity and role do not redirect Run when existing editor loads a file", async () => {
	const f = setup(); await f.client.initialize(editor("prompt"), null); await f.client.settled();
	const before = f.client.snapshot();
	assert(f.client.persist(editor("loaded file", { sourceState: { source: "file", label: "file", path: "/file", draftId: null }, diskRevision: "sha256:" + "a".repeat(64) }), "file baseline").ok);
	const after = f.client.snapshot();
	assert.equal(after.selectedBufferId, before.selectedBufferId);
	assert.equal(after.activePromptId, before.activePromptId);
	assert.equal(after.buffers[0].role, "prompt");
	await f.client.settled();
});

test("late persistence acknowledgements never bless newer typing or a disk baseline", async () => {
	const pending = [];
	const f = setup({ writeRemote: (state, revision) => new Promise(resolve => pending.push({ state, revision, resolve })) });
	await f.client.initialize(editor("first"), null);
	assert.equal(pending.length, 1);
	f.client.persist(editor("new typing"), null);
	assert.equal(pending.length, 1, "writes serialize/coalesce");
	pending[0].resolve({ ok: true, revision: "a".repeat(48), workspaceRevision: pending[0].state.revision });
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(pending.length, 2);
	assert.equal(pending[1].revision, "a".repeat(48));
	assert.equal(pending[1].state.buffers[0].text, "new typing");
	assert.equal(f.client.snapshot().buffers[0].baselineText, "");
	pending[1].resolve({ ok: true, revision: "b".repeat(48), workspaceRevision: pending[1].state.revision });
	await f.client.settled();
});

test("acknowledged ancestry permits recovery of local edits not yet uploaded", async () => {
	const f = setup(); await f.client.initialize(editor("initial"), null); await f.client.settled();
	const local = JSON.parse(f.browser.getItem(key)); local.revision++; local.savedAt++; local.buffers[0].revision++; local.buffers[0].text = "not yet uploaded";
	f.browser.setItem(key, JSON.stringify(local));
	const g = setup({ storage: f.browser, server: f.server });
	const result = await g.client.initialize(editor(), null);
	assert(result.ok); assert.equal(result.editor.text, "not yet uploaded"); await g.client.settled();
});

test("divergence, future schemas, inaccessible buffers and source mismatch preserve recovery", async () => {
	for (const kind of ["diverged", "future", "hidden", "wrong-document"]) {
		const f = setup(); await f.client.initialize(editor("original"), null); await f.client.settled();
		const existing = JSON.parse(f.browser.getItem(key));
		if (kind === "diverged") { existing.revision++; existing.buffers[0].text = "local fork"; f.browser.map.delete(key + ":serverAck"); }
		if (kind === "future") existing.version = 99;
		if (kind === "hidden") { const other = { ...existing.buffers[0], id: "parked", text: "unreachable work" }; existing.buffers.push(other); existing.order.push("parked"); }
		const raw = JSON.stringify(existing); f.browser.setItem(key, raw);
		const g = setup({ storage: f.browser, server: f.server, canRestore: () => kind !== "wrong-document" });
		const result = await g.client.initialize(editor(), null);
		assert.equal(result.ok, false, kind); assert.equal(f.browser.getItem(key), raw);
	}
});

test("startup edits abort recovery before storage adoption", async () => {
	const f = setup();
	const result = await f.client.initialize(editor(), null, () => false);
	assert.equal(result.reason, "editor-changed");
	assert.equal(f.browser.getItem(key), null); assert.equal(f.server.size, 0);
});

test("capacity/quota/network failures retain live text and last good storage with visible issues", async () => {
	const f = setup(); await f.client.initialize(editor(), null); await f.client.settled();
	const previous = f.browser.getItem(key);
	assert.equal(f.client.persist(editor("x".repeat(900001)), null).ok, false);
	assert.equal(f.browser.getItem(key), previous);
	assert(f.issues.at(-1).includes("limit"));
	f.browser.setItem = () => { throw new Error("quota"); };
	assert(f.client.persist(editor("live text"), null).ok);
	await f.client.settled();
	assert.equal(f.client.snapshot().buffers[0].text, "live text");
	assert.equal(f.browser.getItem(key), previous);
	assert.match(f.issues.at(-1), /stored|checkpoint/);
	const unavailable = setup({ storage: null, readRemote: async () => { throw new Error(); }, readLegacyRemote: async () => { throw new Error(); } });
	assert.equal((await unavailable.client.initialize(editor(), null)).reason, "unavailable");
});

test("server fallback works without session storage, and local fallback without server writes", async () => {
	const f = setup(); await f.client.initialize(editor("recoverable"), null); await f.client.settled();
	const remoteOnly = setup({ storage: { getItem() { throw new Error(); }, setItem() { throw new Error(); } }, server: f.server });
	const result = await remoteOnly.client.initialize(editor(), null);
	assert(result.ok); assert.equal(result.editor.text, "recoverable");
	const localOnly = setup({ storage: f.browser, readRemote: async () => { throw new Error(); }, readLegacyRemote: async () => { throw new Error(); }, writeRemote: () => assert.fail("must not write without a server read") });
	assert((await localOnly.client.initialize(editor(), null)).ok);
	assert(localOnly.client.persist(editor("local offline edit"), null).ok);
	assert.equal(JSON.parse(f.browser.getItem(key)).buffers[0].text, "local offline edit");
});

test("page authorization release admits reloads without erasing workspace recovery", () => {
	const server = createStudioBufferServerStore({ maxCapabilities: 1 });
	for (let i = 0; i < 300; i++) {
		const issued = server.issue(context); assert(issued.ok);
		if (i === 0) assert(server.write(issued.capability, null, snapshot()).ok);
		assert.equal(server.read(issued.capability).state.buffers[0].text, "draft");
		assert.equal(server.issue(context).reason, "capacity");
		assert(server.release(issued.capability).released);
		assert.equal(server.read(issued.capability).reason, "forbidden");
		assert.equal(server.size, 1);
	}
});

test("navigation requires consent when the latest editor has no verified recovery copy", async () => {
	const pending = [];
	const f = setup({ storage: { getItem() { throw new Error(); }, setItem() { throw new Error(); } },
		writeRemote: (state, revision) => new Promise(resolve => pending.push({ state, revision, resolve })) });
	await f.client.initialize(editor("first"), null);
	assert(f.client.needsUnloadConfirmation());
	f.client.persist(editor("latest typing"), null);
	pending[0].resolve({ ok: true, revision: "a".repeat(48), workspaceRevision: pending[0].state.revision });
	await new Promise(resolve => setImmediate(resolve));
	assert(f.client.needsUnloadConfirmation(), "acknowledging an older queued snapshot is insufficient");
	pending[1].resolve({ ok: true, revision: "b".repeat(48), workspaceRevision: pending[1].state.revision, expiresInMs: 1000 });
	await f.client.settled();
	assert.equal(f.client.needsUnloadConfirmation(), false);
	f.client.persist(editor("x".repeat(900001)), null);
	assert(f.client.needsUnloadConfirmation(), "text outside store capacity still needs navigation consent");
});

test("a sessionStorage copy alone does not authorize closing a tab with pending server recovery", async () => {
	const f = setup({ writeRemote: () => new Promise(() => {}) });
	await f.client.initialize(editor(), null);
	assert(f.client.needsUnloadConfirmation());
	f.client.persist(editor("latest browser text"), null);
	assert(f.client.needsUnloadConfirmation());
	assert.equal(JSON.parse(f.browser.getItem(key)).buffers[0].text, "latest browser text");
	f.client.dispose();
});

test("a local recovery race aborts startup instead of publishing the superseded candidate", async () => {
	const browser = storage();
	browser.setItem(key, JSON.stringify(snapshot("before")));
	const changed = JSON.stringify(snapshot("concurrent", { revision: 1, savedAt: 20 }));
	const f = setup({ storage: browser, readRemote: async () => { browser.setItem(key, changed); return { ok: true, state: null, revision: null }; },
		writeRemote: () => assert.fail("must not publish a candidate superseded during startup") });
	assert.equal((await f.client.initialize(editor(), null)).ok, false);
	assert.equal(browser.getItem(key), changed);
});

test("expired server acknowledgement is not navigation authority, even before a flush fails", async () => {
	let time = 1;
	const server = createStudioBufferServerStore({ now: () => time, ttlMs: 100 });
	const f = setup({ server, now: () => time, storage: { getItem() { throw new Error(); }, setItem() { throw new Error(); } } });
	await f.client.initialize(editor("server-only text"), null); await f.client.settled();
	assert.equal(f.client.needsUnloadConfirmation(), false);
	time = 102;
	assert(f.client.needsUnloadConfirmation());
	f.client.persist(editor("server-only text"), null);
	assert(f.client.needsUnloadConfirmation());
	await f.client.settled();
	const fresh = server.issue(context);
	assert.equal(server.read(fresh.capability).state, null);
});

test("old retained server v1 identity cannot veto newer v2 after Save As", async () => {
	const legacy = editor("legacy draft");
	const server = createStudioBufferServerStore({ legacyState: () => legacy });
	const readLegacyRemote = async () => ({ ok: true, state: legacy });
	const f = setup({ server, readLegacyRemote });
	await f.client.initialize(editor(), null); await f.client.settled();
	const file = editor("unsaved after Save As", { sourceState: { source: "file", label: "saved.md", path: "/saved.md", draftId: null }, diskRevision: "sha256:" + "a".repeat(64) });
	assert(f.client.persist(file, "saved baseline").ok); await f.client.settled();
	const g = setup({ server, storage: f.browser, readLegacyRemote, canRestore: value => value.sourceState.path === "/saved.md" });
	const result = await g.client.initialize({ ...file, text: "disk text" }, "disk text");
	assert(result.ok); assert.equal(result.editor.text, "unsaved after Save As");
	assert.equal(result.baselineText, "saved baseline"); await g.client.settled();
});

test("legacy-only migration compares sources only after choosing the newest valid candidate", async () => {
	const old = editor("old draft");
	const recent = editor("new file edits", { savedAt: 20, sourceState: { source: "file", label: "f", path: "/file", draftId: null }, diskRevision: "sha256:" + "a".repeat(64) });
	const f = setup({ readLegacyRemote: async () => ({ ok: true, state: recent }), canRestore: value => value.sourceState.path === "/file" });
	f.browser.setItem(STUDIO_BUFFER_LEGACY_TAB_PREFIX + id, JSON.stringify(old));
	const result = await f.client.initialize(recent, "disk"); assert(result.ok);
	assert.equal(result.editor.text, "new file edits"); await f.client.settled();
	assert.equal(f.browser.getItem(STUDIO_BUFFER_LEGACY_TAB_PREFIX + id), JSON.stringify(old));
	const tie = setup({ readLegacyRemote: async () => ({ ok: true, state: editor("other draft") }) });
	tie.browser.setItem(STUDIO_BUFFER_LEGACY_TAB_PREFIX + id, JSON.stringify(old));
	assert.equal((await tie.client.initialize(editor(), null)).reason, "legacy-diverged");
});

test("an intermediate upload cannot authorize closing over a latest local-only queued edit", async () => {
	const pending = [];
	const f = setup({ writeRemote: state => new Promise(resolve => pending.push({ state, resolve })) });
	await f.client.initialize(editor("acknowledged"), null);
	pending[0].resolve({ ok: true, revision: "a".repeat(48), workspaceRevision: pending[0].state.revision, expiresInMs: 1000 });
	await f.client.settled(); assert.equal(f.client.needsUnloadConfirmation(), false);
	f.client.persist(editor("intermediate"), null);
	f.client.persist(editor("latest queued"), null);
	assert.equal(pending.length, 2); assert(f.client.needsUnloadConfirmation());
	assert.equal(JSON.parse(f.browser.getItem(key)).buffers[0].text, "latest queued");
	f.client.dispose();
	pending[1].resolve({ ok: true, revision: "b".repeat(48), workspaceRevision: pending[1].state.revision, expiresInMs: 1000 });
	await f.client.settled();
	assert.equal(JSON.parse(f.browser.getItem(key + ":serverAck")).remoteRevision, "a".repeat(48));
});

test("disconnect invalidates server authority and late acknowledgements cannot revive it", async () => {
	let release, submitted;
	const f = setup({ writeRemote: state => { submitted = state; return new Promise(resolve => { release = resolve; }); } });
	await f.client.initialize(editor(), null);
	f.client.invalidateRemoteRecovery();
	release({ ok: true, revision: "a".repeat(48), workspaceRevision: submitted.revision, expiresInMs: 1000 });
	await f.client.settled();
	assert(f.client.needsUnloadConfirmation());
	assert.equal(f.browser.getItem(key + ":serverAck"), null);
	assert.equal(f.client.persist(editor("still editable locally"), null).ok, true);
	assert.equal(JSON.parse(f.browser.getItem(key)).buffers[0].text, "still editable locally");
});

test("disposed or multiply initialized owners cannot write late recovery", async () => {
	const f = setup(); await f.client.initialize(editor(), null); await f.client.settled();
	assert.equal((await f.client.initialize(editor("replacement"), null)).reason, "invalid-lifecycle");
	const before = f.browser.getItem(key); f.client.dispose();
	assert.equal(f.client.persist(editor("late callback"), null).reason, "disposed");
	assert.equal(f.browser.getItem(key), before);
	let resume;
	const g = setup({ readRemote: () => new Promise(resolve => { resume = resolve; }) });
	const loading = g.client.initialize(editor(), null); g.client.dispose();
	resume({ ok: true, state: null, revision: null });
	assert.equal((await loading).ok, false); assert.equal(g.browser.getItem(key), null);
});

test("v2 identity gating follows acknowledged ancestry in both Save As recovery directions", async () => {
	for (const newer of ["server", "browser"]) {
		let offline = false;
		const f = setup({ writeRemote: async (state, revision) => {
			if (offline) throw new Error("offline");
			return f.server.write(f.capability, revision, state);
		} });
		await f.client.initialize(editor("old draft"), null); await f.client.settled();
		if (newer === "server") {
			f.browser.setItem = (k, value) => { if (k === key) throw new Error("snapshot quota"); f.browser.map.set(k, value); };
		} else offline = true;
		const file = editor("unsaved file after Save As", { sourceState: { source: "file", label: "file", path: "/saved.md", draftId: null }, diskRevision: "sha256:" + "a".repeat(64) });
		assert(f.client.persist(file, "file baseline").ok); await f.client.settled();
		const g = setup({ storage: f.browser, server: f.server, canRestore: state => state.sourceState.path === "/saved.md" });
		const result = await g.client.initialize({ ...file, text: "disk" }, "disk");
		assert(result.ok, newer); assert.equal(result.editor.text, "unsaved file after Save As");
		assert.equal(result.baselineText, "file baseline"); await g.client.settled();
	}
});

test("detaching a file cannot reuse that file's saved baseline", async () => {
	const file = editor("same text", { sourceState: { source: "file", label: "file", path: "/file", draftId: null }, diskRevision: "sha256:" + "a".repeat(64) });
	const f = setup(); await f.client.initialize(file, "same text"); await f.client.settled();
	assert(f.client.persist(editor("same text"), null).ok);
	const state = f.client.snapshot(), selected = state.buffers.find(b => b.id === state.selectedBufferId);
	assert.equal(selected.role, "document"); assert.equal(selected.baselineText, null); assert.equal(selected.diskRevision, null);
	await f.client.settled();
});

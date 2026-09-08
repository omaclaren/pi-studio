import test from "node:test";
import assert from "node:assert/strict";
import { createStudioBufferStore, isStudioBufferDirty, STUDIO_BUFFER_LIMITS } from "../shared/studio-buffer-store.js";
import {
	createStudioBufferRecoveryStorage, decodeStudioBufferRecovery, encodeStudioBufferRecovery, migrateStudioWorkspaceV1,
	STUDIO_BUFFER_RECOVERY_PREFIX, STUDIO_BUFFER_LEGACY_TAB_PREFIX, STUDIO_BUFFER_RECOVERY_MAX_SERIALIZED_CHARS,
} from "../shared/studio-buffer-recovery.js";

const workspaceId = "tab_" + "a".repeat(32);
const context = { workspaceId, mode: "full" };
const diskRevision = "sha256:" + "a".repeat(64);
const allocator = () => { let i = 0; return () => "buffer-" + ++i; };
const migrate = (value, options = {}) => migrateStudioWorkspaceV1(value, { ...context, makeBufferId: allocator(), ...options });
const legacy = (overrides = {}) => ({ version: 1, savedAt: 10, text: "\nExact draft ü\r\n", sourceState: { source: "blank", label: "draft", path: null, draftId: "old-draft" }, ...overrides });
function memoryStorage() {
	const entries = new Map();
	return { entries, getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: () => assert.fail("migration must never erase the legacy recovery") };
}
function fixture(raw = JSON.stringify(legacy())) {
	const storage = memoryStorage();
	const adapter = createStudioBufferRecoveryStorage({ storage, ...context });
	storage.entries.set(adapter.legacyKey, raw);
	return { storage, adapter, raw, migrate: () => adapter.migrateLegacy({ expectedLegacyRaw: raw, makeBufferId: allocator() }) };
}

for (const sourceKind of ["blank", "pi-editor", "last-response", "upload", "file", "custom-legacy-source"]) {
	test(`v1 ${sourceKind} migration preserves raw text and source identity without terminal cleanup authority`, () => {
		const v1 = legacy({ sourceState: { source: sourceKind, label: "original label ü", path: sourceKind === "file" ? "/tmp/notes ü.qmd" : null, draftId: sourceKind === "file" ? null : "existing-draft" },
			diskRevision: sourceKind === "file" ? diskRevision : null, resourceDir: "/tmp/resources ü", editorView: "preview", rightView: "editor-preview", editorLanguage: "latex", followLatest: true, responseHistoryIndex: 5,
			selectionStart: 2, selectionEnd: 10, scrollTop: 12.5 });
		const original = JSON.stringify(v1);
		const result = migrate(v1);
		assert(result.ok, result.message);
		assert.equal(JSON.stringify(v1), original);
		const s = result.state, selected = s.buffers.find(b => b.id === s.selectedBufferId);
		assert.equal(selected.text, v1.text);
		assert.deepEqual(selected.sourceState, v1.sourceState);
		assert.equal(selected.resourceDir, v1.resourceDir);
		assert.equal(selected.view.editorLanguage, "latex");
		assert.equal(selected.view.selectionEnd, 10);
		assert.equal(selected.view.scrollTop, 12.5);
		assert.equal(selected.view.responseHistoryIndex, 5);
		assert.equal(selected.view.followLatest, true);
		assert.equal(selected.role, sourceKind === "file" ? "document" : "prompt");
		assert.equal(s.buffers.length, sourceKind === "file" ? 2 : 1);
		assert.equal(selected.diskRevision, v1.diskRevision);
		assert.equal(selected.baselineText, sourceKind === "file" ? null : "");
		const serialized = JSON.stringify(s);
		assert(!serialized.includes("terminalCleanup"));
		assert(!serialized.includes("submittedEditor"));
	});
}

test("file migration retains dirty deletions and does not pretend to know disk baseline", () => {
	for (const text of ["", "possibly saved", "unsaved"] ) {
		const result = migrate(legacy({ text, sourceState: { source: "file", path: "/canonical/file.md", label: "file", draftId: null }, diskRevision }));
		assert(result.ok);
		const entry = result.state.buffers.find(b => b.role === "document");
		assert(isStudioBufferDirty(entry));
		assert.equal(entry.diskRevision, diskRevision);
		assert.equal(entry.text, text);
		assert.equal(result.state.selectedBufferId, entry.id);
		assert.equal(result.state.buffers.find(b => b.id === result.state.activePromptId).text, "");
	}
});

test("all editable-companion sources remain documents with no active Prompt", () => {
	for (const source of ["blank", "pi-editor", "last-response", "upload", "file"]) {
		const result = migrate(legacy({ sourceState: { source, path: source === "file" ? "/file" : null, draftId: null, label: "source" } }), { mode: "editor-only" });
		assert(result.ok);
		assert.equal(result.state.buffers.length, 1);
		assert.equal(result.state.buffers[0].role, "document");
		assert.equal(result.state.activePromptId, null);
	}
	assert.equal(migrate(legacy(), { mode: "watched" }).ok, false);
});

test("minimal v1 fields are supported and selection is safely clamped without text normalization", () => {
	assert(migrate({ version: 1, text: "exact" }).ok);
	const result = migrate(legacy({ selectionStart: 10_000, selectionEnd: 1 }));
	assert(result.ok);
	assert.equal(result.state.buffers[0].view.selectionStart, legacy().text.length);
	assert.equal(result.state.buffers[0].view.selectionEnd, legacy().text.length);
	assert.equal(result.state.buffers[0].text, legacy().text);
});

test("oversized or malformed legacy data fails without truncating identity or losing source", () => {
	const bad = [null, { version: 3, text: "future" }, legacy({ text: 42 }), legacy({ sourceState: null }),
		legacy({ text: "x".repeat(STUDIO_BUFFER_LIMITS.textChars + 1) }), legacy({ sourceState: { label: "x".repeat(4001) } }),
		legacy({ sourceState: { path: "/" + "x".repeat(16_384) } }), legacy({ resourceDir: "x".repeat(16_385) }),
		legacy({ diskRevision: "invalid" }), legacy({ savedAt: -1 }), legacy({ selectionStart: -1 }), legacy({ followLatest: "yes" }),
		legacy({ sourceState: { draftId: "x".repeat(257) } }), legacy({ terminalCleanupSnapshot: "not recoverable" }),
		legacy({ sourceState: { source: "blank", granted: true } }),
	];
	for (const value of bad) {
		const raw = JSON.stringify(value), f = fixture(raw);
		assert.equal(f.migrate().ok, false, raw.slice(0, 80));
		assert.equal(f.storage.getItem(f.adapter.legacyKey), raw);
		assert.equal(f.storage.getItem(f.adapter.key), null);
	}
});

for (const source of ["recovery-omitted", "recovery-cleared"]) {
	test(`legacy ${source} markers cannot silently resurrect/reset a draft`, () => {
		const f = fixture(JSON.stringify(legacy({ text: "", sourceState: { source } })));
		assert.equal(f.migrate().reason, "legacy-marker");
		assert.equal(f.storage.getItem(f.adapter.legacyKey), f.raw);
		assert.equal(f.storage.getItem(f.adapter.key), null);
	});
}

test("v2 codec round-trips exact text, baselines, order, identities and metadata", () => {
	const migrated = migrate(legacy()).state;
	const s = createStudioBufferStore(migrated, { now: () => 20 });
	assert(s.update(s.snapshot().selectedBufferId, 0, { text: "\u0000\t\r\n😀", baselineText: "base", metadata: { annotationsEnabled: false, reviewNotesKey: "review", scratchpadKey: "scratch" } }).ok);
	const encoded = encodeStudioBufferRecovery(s.snapshot(), context);
	assert(encoded.ok);
	const decoded = decodeStudioBufferRecovery(encoded.raw, context);
	assert(decoded.ok);
	assert.deepEqual(decoded.state, s.snapshot());
	assert.equal(decodeStudioBufferRecovery(encoded.raw, { ...context, mode: "editor-only" }).reason, "wrong-workspace");
	assert.equal(decodeStudioBufferRecovery(encoded.raw, { ...context, workspaceId: "tab_" + "b".repeat(32) }).reason, "wrong-workspace");
	assert.equal(decodeStudioBufferRecovery("{").reason, "invalid-json");
	assert.equal(decodeStudioBufferRecovery(" ".repeat(STUDIO_BUFFER_RECOVERY_MAX_SERIALIZED_CHARS + 1)).reason, "limit-exceeded");
});

test("new namespace is distinct; successful migration retains exact v1 bytes and is not repeated", () => {
	const f = fixture();
	assert.equal(f.adapter.key, STUDIO_BUFFER_RECOVERY_PREFIX + workspaceId);
	assert.equal(f.adapter.legacyKey, STUDIO_BUFFER_LEGACY_TAB_PREFIX + workspaceId);
	assert.notEqual(f.adapter.key, f.adapter.legacyKey);
	assert.equal(f.adapter.read().status, "legacy");
	const result = f.migrate();
	assert(result.ok);
	assert.equal(f.storage.getItem(f.adapter.legacyKey), f.raw);
	assert.equal(f.adapter.read().status, "found");
	assert.deepEqual(f.adapter.read().state, result.state);
	assert.equal(f.migrate().reason, "already-present");
});

test("creating a v2 snapshot cannot bypass pending legacy migration", () => {
	const f = fixture();
	const snapshot = migrate(legacy({ savedAt: 1000, text: "unrelated new draft" })).state;
	assert.equal(f.adapter.write(snapshot, { expectedRaw: null }).reason, "migration-required");
	assert.equal(f.storage.getItem(f.adapter.key), null);
	assert.equal(f.storage.getItem(f.adapter.legacyKey), f.raw);
});

test("unscoped old global recovery is not silently adopted by a new tab", () => {
	const storage = memoryStorage();
	storage.setItem("piStudio.workspaceState.v1", JSON.stringify(legacy()));
	const adapter = createStudioBufferRecoveryStorage({ storage, ...context });
	assert.equal(adapter.read().status, "empty");
	assert.equal(storage.entries.size, 1);
});

test("unavailable/blocked/quota-limited storage preserves original data", () => {
	const inaccessible = createStudioBufferRecoveryStorage({ ...context, storage: { getItem() { throw new Error("denied"); } } });
	assert.equal(inaccessible.read().reason, "storage-unavailable");
	assert.equal(inaccessible.write(migrate(legacy()).state, { expectedRaw: null }).reason, "storage-unavailable");
	for (const broken of [() => { throw new Error("QuotaExceededError"); }, () => {}]) {
		const f = fixture();
		f.storage.setItem = broken;
		assert.equal(f.migrate().ok, false);
		assert.equal(f.storage.getItem(f.adapter.legacyKey), f.raw);
		assert.equal(f.storage.getItem(f.adapter.key), null);
	}
});

test("unverified successful writes retain legacy recovery and never report acceptance", () => {
	const f = fixture();
	let written = false;
	const get = f.storage.getItem;
	f.storage.setItem = (key, raw) => { f.storage.entries.set(key, raw); written = true; };
	f.storage.getItem = key => { if (written && key === f.adapter.key) throw new Error("read failure"); return get(key); };
	assert.equal(f.migrate().reason, "storage-unverified");
	assert.equal(get(f.adapter.legacyKey), f.raw);
	assert(get(f.adapter.key));
});

test("newer/future/malformed v2 cannot be replaced by migration or fallback", () => {
	for (const raw of ['{"version":3,"text":"future work"}', "{bad", JSON.stringify({ ...migrate(legacy()).state, unsupported: "preserve" })]) {
		const f = fixture(); f.storage.setItem(f.adapter.key, raw);
		assert.equal(f.adapter.read().ok, false);
		assert.equal(f.migrate().reason, "already-present");
		assert.equal(f.adapter.write(migrate(legacy()).state, { expectedRaw: raw }).ok, false);
		assert.equal(f.storage.getItem(f.adapter.key), raw);
		assert.equal(f.storage.getItem(f.adapter.legacyKey), f.raw);
	}
});

test("failed or stale writes retain the previously verified v2 snapshot", () => {
	const f = fixture(), first = f.migrate();
	const s = createStudioBufferStore(first.state, { now: () => 20 });
	s.update(first.state.selectedBufferId, 0, { text: "newer" });
	assert.equal(f.adapter.write(s.snapshot()).reason, "expected-state-required");
	assert.equal(f.adapter.write(s.snapshot(), { expectedRaw: null }).reason, "storage-changed");
	const second = f.adapter.write(s.snapshot(), { expectedRaw: first.raw });
	assert(second.ok);
	assert.equal(f.adapter.write(first.state, { expectedRaw: second.raw }).reason, "stale-state");
	assert.equal(f.adapter.write(s.snapshot(), { expectedRaw: first.raw }).reason, "storage-changed");
	assert(f.adapter.write(s.snapshot(), { expectedRaw: second.raw }).ok, "same snapshot is idempotent");
	const oversized = { ...s.snapshot(), buffers: s.snapshot().buffers.map(b => ({ ...b, text: "x".repeat(STUDIO_BUFFER_LIMITS.textChars + 1) })) };
	assert.equal(f.adapter.write(oversized, { expectedRaw: second.raw }).reason, "limit-exceeded");
	assert.equal(f.storage.getItem(f.adapter.key), second.raw);
	f.storage.setItem = () => { throw new Error("quota"); };
	s.update(s.snapshot().selectedBufferId, 1, { text: "live unsaved work" });
	assert.equal(f.adapter.write(s.snapshot(), { expectedRaw: second.raw }).reason, "storage-write-failed");
	assert.equal(f.storage.getItem(f.adapter.key), second.raw);
	assert.equal(s.get(s.snapshot().selectedBufferId).text, "live unsaved work");
});

test("migration revalidates source and destination across ID allocation callbacks", () => {
	for (const target of ["source", "destination"]) {
		const f = fixture();
		const result = f.adapter.migrateLegacy({ expectedLegacyRaw: f.raw, makeBufferId() {
			f.storage.setItem(target === "source" ? f.adapter.legacyKey : f.adapter.key, "changed meanwhile"); return "new-id";
		} });
		assert.equal(result.reason, "storage-changed");
		assert.equal(f.storage.getItem(target === "source" ? f.adapter.legacyKey : f.adapter.key), "changed meanwhile");
	}
	const f = fixture(JSON.stringify(legacy({ sourceState: { source: "file", path: "/file", draftId: null, label: "file" } })));
	assert.equal(f.adapter.migrateLegacy({ expectedLegacyRaw: f.raw, makeBufferId: () => "duplicate" }).ok, false);
	assert.equal(f.storage.getItem(f.adapter.key), null);
});

test("downgraded-client newer v1 work blocks v2 restore/write rather than being ignored", () => {
	const f = fixture(), first = f.migrate();
	const newerLegacy = JSON.stringify(legacy({ savedAt: 99, text: "new work from an old client" }));
	f.storage.setItem(f.adapter.legacyKey, newerLegacy);
	assert.equal(f.adapter.read().reason, "legacy-newer");
	assert.equal(f.adapter.write(first.state, { expectedRaw: first.raw }).reason, "legacy-newer");
	const live = createStudioBufferStore(first.state, { now: () => 1000 });
	live.update(first.state.selectedBufferId, 0, { text: "even newer timestamp, but unaware of the newer v1 work" });
	assert.equal(f.adapter.write(live.snapshot(), { expectedRaw: first.raw }).reason, "legacy-newer");
	assert.equal(f.storage.getItem(f.adapter.key), first.raw);
	assert.equal(f.storage.getItem(f.adapter.legacyKey), newerLegacy);
});

test("malformed retained v1 cannot be bypassed by an existing valid v2 snapshot", () => {
	const invalid = [legacy({ savedAt: "99", text: "different unsaved work" }), legacy({ savedAt: null }),
		legacy({ savedAt: 1.5 }), legacy({ text: null }), legacy({ sourceState: { path: 42 } }),
		legacy({ diskRevision: "broken" }), legacy({ extra: "preserve me" }),
		legacy({ sourceState: { source: "recovery-cleared" } }), legacy({ sourceState: { source: "recovery-omitted" } }),
		legacy({ sourceState: { label: "x".repeat(4_001) } }),
	];
	for (const value of invalid) {
		const f = fixture(), existing = f.migrate();
		const raw = JSON.stringify(value);
		f.storage.setItem(f.adapter.legacyKey, raw);
		assert.equal(f.adapter.read().reason, "legacy-conflict");
		assert.equal(f.adapter.write(existing.state, { expectedRaw: existing.raw }).reason, "legacy-conflict");
		assert.equal(f.storage.getItem(f.adapter.key), existing.raw);
		assert.equal(f.storage.getItem(f.adapter.legacyKey), raw);
	}
});

test("workspace identities and modes isolate recovery; missing storage never implies an empty editor", () => {
	const f = fixture(); f.migrate();
	const companion = createStudioBufferRecoveryStorage({ storage: f.storage, workspaceId, mode: "editor-only" });
	assert.equal(companion.read().reason, "wrong-workspace");
	const other = createStudioBufferRecoveryStorage({ storage: f.storage, ...context, workspaceId: "tab_" + "b".repeat(32) });
	assert.equal(other.read().status, "empty");
	assert.equal(createStudioBufferRecoveryStorage({ ...context, storage: null }).read().reason, "storage-unavailable");
	assert.throws(() => createStudioBufferRecoveryStorage({ storage: f.storage, ...context, mode: "watched" }));
});

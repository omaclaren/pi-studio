import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, symlinkSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStudioBuffer, createStudioBufferStore, isStudioBufferDirty, STUDIO_BUFFER_LIMITS, validateStudioBufferWorkspace } from "../shared/studio-buffer-store.js";
import { readStudioDiskFileSnapshot, saveStudioDiskFileIfRevision } from "../shared/studio-disk-revisions.js";

const workspaceId = "tab_" + "a".repeat(32);
const diskRevision = "sha256:" + "a".repeat(64);
const prompt = (id = "prompt", options = {}) => createStudioBuffer({ id, role: "prompt", ...options });
const document = (id = "document", options = {}) => createStudioBuffer({ id, role: "document", ...options });
function workspace(buffers = [prompt()], overrides = {}) {
	return { version: 2, workspaceId, mode: "full", revision: 0, savedAt: 1, selectedBufferId: buffers[0].id, activePromptId: "prompt", order: buffers.map(b => b.id), buffers, ...overrides };
}
const store = (buffers, overrides) => createStudioBufferStore(workspace(buffers, overrides), { now: () => 100 });
const copy = (value) => JSON.parse(JSON.stringify(value));

function unchanged(s, action, reason) {
	const before = s.snapshot();
	const result = action();
	assert.equal(result.ok, false);
	if (reason) assert.equal(result.reason, reason);
	assert.equal(s.snapshot(), before, "failed operations leave the entire workspace untouched");
}

test("buffer identity, selected document and active Prompt are independent", () => {
	const s = store([prompt(), document("doc"), prompt("parked", { text: "Alternative" })]);
	assert(s.select("doc").ok);
	assert.equal(s.snapshot().activePromptId, "prompt");
	assert(s.activatePrompt("parked").ok);
	assert.equal(s.snapshot().selectedBufferId, "doc");
	assert.equal(s.snapshot().activePromptId, "parked");
	unchanged(s, () => s.activatePrompt("doc"), "not-a-prompt");
	unchanged(s, () => s.select("missing"), "missing-buffer");
	assert(s.close(s.beginOperation("doc", "close-doc").target).ok);
	assert.equal(s.snapshot().activePromptId, "parked");
	assert.equal(s.snapshot().selectedBufferId, "parked");
	assert.deepEqual(s.snapshot().order, ["prompt", "parked"]);
});

test("file paths do not define roles; companions cannot acquire prompt authority", () => {
	const filePrompt = prompt("prompt", { sourceState: { path: "/saved-prompt.md" } });
	const s = store([filePrompt, document("detached")]);
	assert.equal(s.get("prompt").role, "prompt");
	assert.equal(s.get("detached").sourceState.path, null);
	const companion = store([document("doc")], { mode: "editor-only", activePromptId: null });
	unchanged(companion, () => companion.add(prompt()), "invalid-state");
	unchanged(companion, () => companion.activatePrompt("doc"), "not-a-prompt");
	const closeTarget = companion.beginOperation("doc", "close-doc").target;
	unchanged(companion, () => companion.close(closeTarget), "limit-exceeded");
	assert.equal(validateStudioBufferWorkspace(workspace([prompt()], { mode: "watched" })).ok, false);
});

test("text, source/disk identity, views and local associations survive switching and round-trip", () => {
	const entry = document("doc", { text: "0123456789", baselineText: "disk text", diskRevision,
		sourceState: { source: "file", path: "/tmp/Space ü.qmd", label: "Space ü.qmd" }, resourceDir: "/tmp/Space ü",
		view: { selectionStart: 2, selectionEnd: 8, selectionDirection: "backward", scrollTop: 42.5, previewScrollTop: 99, rightView: "editor-quarto-preview", editorLanguage: "markdown" },
		metadata: { annotationsEnabled: false, reviewNotesKey: "file:/tmp/Space ü.qmd", scratchpadKey: "same-source" } });
	const s = store([prompt(), entry]);
	s.select("doc"); s.select("prompt"); s.select("doc");
	assert.deepEqual(s.get("doc"), entry);
	const restored = createStudioBufferStore(copy(s.snapshot()));
	assert.deepEqual(restored.snapshot(), s.snapshot());
	assert(isStudioBufferDirty(restored.get("doc")));
});

test("snapshots and nested metadata are owned, immutable copies", () => {
	const initial = copy(workspace([prompt(), document("doc", { text: "original" })]));
	const s = createStudioBufferStore(initial);
	initial.buffers[1].text = "external";
	assert.equal(s.get("doc").text, "original");
	assert.throws(() => { s.get("doc").view.scrollTop = 100; }, TypeError);
	assert.throws(() => { s.snapshot().order.push("other"); }, TypeError);
	const patch = { metadata: { annotationsEnabled: true, reviewNotesKey: "review", scratchpadKey: null } };
	assert(s.update("doc", 0, patch).ok);
	patch.metadata.reviewNotesKey = "external";
	assert.equal(s.get("doc").metadata.reviewNotesKey, "review");
});

test("dirty state protects empty deletions, unknown baselines and submitted-looking text", () => {
	assert(isStudioBufferDirty(document("doc", { text: "", baselineText: "deleted disk contents", sourceState: { path: "/file" }, diskRevision })));
	assert(isStudioBufferDirty(document("doc", { sourceState: { path: "/file" }, diskRevision })));
	assert(!isStudioBufferDirty(document("doc", { text: "saved", baselineText: "saved" })));
	const s = store([prompt(), document("doc", { text: "submitted text", baselineText: "disk", sourceState: { path: "/file" }, diskRevision })]);
	const target = s.beginOperation("doc", "preview").target;
	assert(s.finishOperation(target, { view: { ...s.get("doc").view, previewScrollTop: 25 } }).ok);
	assert(isStudioBufferDirty(s.get("doc")), "a completed operation is not a save");
	const closeTarget = s.beginOperation("doc", "close-doc").target;
	unchanged(s, () => s.close(closeTarget), "confirmation-required");
	unchanged(s, () => s.close(closeTarget, { discard: "yes" }), "confirmation-required");
	assert(s.close(closeTarget, { discard: true }).ok);
});

test("closing a Prompt requires explicit replacement and revision-scoped discard", () => {
	const s = store([prompt("prompt", { text: "accepted prompt", baselineText: "accepted prompt" }), prompt("parked")]);
	const closeTarget = s.beginOperation("prompt", "close-prompt").target;
	unchanged(s, () => s.close(closeTarget, { replacementPromptId: "parked" }), "confirmation-required");
	unchanged(s, () => s.close(closeTarget, { discard: true }), "replacement-prompt-required");
	assert(s.update("prompt", 0, { text: "later edits" }).ok);
	unchanged(s, () => s.close(closeTarget, { discard: true, replacementPromptId: "parked" }), "stale-operation");
	assert(s.close(s.beginOperation("prompt", "close-prompt-again").target, { discard: true, replacementPromptId: "parked" }).ok);
	assert.equal(s.snapshot().activePromptId, "parked");
});

test("stale close consent cannot discard a different buffer reopened under the same ID/revision", () => {
	const s = store([prompt(), document("doc", { text: "old draft" })]);
	const oldTarget = s.beginOperation("doc", "old-close-dialog").target;
	assert(s.close(s.beginOperation("doc", "independent-close").target, { discard: true }).ok);
	assert(s.add(document("doc", { text: "new unsaved draft" })).ok);
	assert.equal(s.get("doc").revision, oldTarget.revision);
	unchanged(s, () => s.close(oldTarget, { discard: true }), "stale-operation");
	unchanged(s, () => s.close({ ...oldTarget }, { discard: true }), "stale-operation");
	assert.equal(s.get("doc").text, "new unsaved draft");
});

test("changing a path cannot accidentally carry a previous file's baseline or revision", () => {
	const s = store([prompt(), document("doc", { text: "disk", baselineText: "disk", diskRevision, sourceState: { path: "/old" } })]);
	assert(s.update("doc", 0, { sourceState: { ...s.get("doc").sourceState, path: "/new" } }).ok);
	assert.equal(s.get("doc").diskRevision, null);
	assert.equal(s.get("doc").baselineText, null);
	assert(isStudioBufferDirty(s.get("doc")));
});

test("late results target their origin, never the selected buffer", () => {
	const s = store([prompt(), document("doc", { text: "document" })]);
	const target = s.beginOperation("prompt", "completion").target;
	s.select("doc");
	assert(s.finishOperation(target, { text: "completed prompt" }).ok);
	assert.equal(s.get("doc").text, "document");
	assert.equal(s.get("prompt").text, "completed prompt");
	assert.equal(s.snapshot().selectedBufferId, "doc");
	unchanged(s, () => s.finishOperation(target, { text: "duplicate" }), "stale-operation");
});

test("text ABA, disk identity, resource, metadata and view changes invalidate late results", () => {
	for (const patch of [{ text: "new" }, { resourceDir: "/new" }, { sourceState: { source: "upload", label: "new", path: null, draftId: "new" } },
		{ baselineText: "new baseline" }, { metadata: { annotationsEnabled: true, reviewNotesKey: null, scratchpadKey: null } },
		{ view: { ...prompt().view, scrollTop: 3 } }]) {
		const s = store();
		const target = s.beginOperation("prompt", "request").target;
		assert(s.update("prompt", 0, patch).ok);
		assert(s.update("prompt", 1, { text: "" }).ok);
		unchanged(s, () => s.finishOperation(target, { text: "late" }), "stale-operation");
		assert.equal(s.pendingOperationCount, 0);
	}
});

test("closed/reopened identities, reconstructed stores and forged targets cannot revive an operation", () => {
	const s = store([prompt(), document("doc")]);
	const target = s.beginOperation("doc", "operation").target;
	unchanged(s, () => s.finishOperation({ ...target }, { text: "forged" }), "stale-operation");
	assert(s.isCurrent(target));
	const reconstructed = createStudioBufferStore(copy(s.snapshot()));
	unchanged(reconstructed, () => reconstructed.finishOperation(target, { text: "resurrected" }), "stale-operation");
	s.close(s.beginOperation("doc", "close-doc").target); s.add(document("doc"));
	const newTarget = s.beginOperation("doc", "operation").target;
	unchanged(s, () => s.finishOperation(target, { text: "late" }), "stale-operation");
	assert(s.isCurrent(newTarget));
	assert(s.finishOperation(newTarget, { text: "new origin" }).ok);
});

test("active-destination operations are cancelled even after switching away and back", () => {
	const s = store([prompt(), prompt("parked"), document("doc")]);
	const target = s.beginOperation("prompt", "transfer", { requireActivePrompt: true }).target;
	s.select("doc");
	assert(s.isCurrent(target), "document selection does not retarget the Prompt");
	s.activatePrompt("parked"); s.activatePrompt("prompt");
	unchanged(s, () => s.finishOperation(target, { text: "misdirected context" }), "stale-operation");
	assert.equal(s.beginOperation("doc", "bad", { requireActivePrompt: true }).ok, false);
});

test("pending work is bounded and cancelled explicitly on failure/disconnect", () => {
	const s = store();
	const first = s.beginOperation("prompt", "first").target;
	assert.equal(s.beginOperation("prompt", "first").ok, false);
	assert.equal(s.beginOperation("prompt", "").ok, false);
	assert.equal(s.beginOperation("prompt", "r".repeat(257)).ok, false);
	for (let i = 1; i < STUDIO_BUFFER_LIMITS.pendingOperations; i++) assert(s.beginOperation("prompt", "r" + i).ok);
	assert.equal(s.beginOperation("prompt", "overflow").reason, "limit-exceeded");
	assert(s.isCurrent(first), "capacity does not evict existing ownership");
	assert.equal(s.cancelOperation({ ...first }), false);
	assert(s.cancelOperation(first));
	s.clearPendingOperations();
	assert.equal(s.pendingOperationCount, 0);
});

test("buffer/text/baseline limits reject updates atomically, without eviction or truncation", () => {
	const s = store(Array.from({ length: 16 }, (_, i) => i === 0 ? prompt() : document("doc" + i)));
	unchanged(s, () => s.add(document("overflow")), "limit-exceeded");
	unchanged(s, () => s.update("prompt", 0, { text: "x".repeat(STUDIO_BUFFER_LIMITS.textChars + 1) }), "limit-exceeded");
	const large = "x".repeat(800_000);
	const aggregate = store([prompt("prompt", { text: large, baselineText: large }), document("doc", { text: large })]);
	unchanged(aggregate, () => aggregate.update("doc", 0, { baselineText: large }), "limit-exceeded");
	assert.equal(aggregate.get("doc").baselineText, "");
});

test("strict validation rejects malformed/future/unknown authority fields", () => {
	const invalid = [
		s => { s.version = 3; }, s => { s.buffers[0].id = "../bad"; }, s => { s.buffers.push(s.buffers[0]); },
		s => { s.order = []; }, s => { s.activePromptId = "missing"; }, s => { s.selectedBufferId = "missing"; },
		s => { s.revision = NaN; }, s => { s.savedAt = -1; }, s => { s.buffers[0].revision = 0.5; },
		s => { s.buffers[0].diskRevision = diskRevision; }, s => { s.buffers[0].resourceDir = "x".repeat(16_385); },
		s => { s.buffers[0].view.selectionEnd = 1; }, s => { s.buffers[0].metadata.reviewNotesKey = {}; },
		s => { s.buffers[0].sourceState.label = "x".repeat(4_001); }, s => { s.buffers[0].sourceState.path = ""; },
		s => { s.buffers[0].terminalCleanupSnapshot = "must not persist"; }, s => { s.resourceGrants = ["/"]; },
		s => { s.buffers[0].acceptedSubmission = true; }, s => { s.responseHistory = ["not buffer-owned"]; },
	];
	for (const tamper of invalid) {
		const value = copy(workspace()); tamper(value);
		assert.equal(validateStudioBufferWorkspace(value).ok, false, tamper.toString());
	}
	assert.equal(validateStudioBufferWorkspace(workspace(), { workspaceId: "another-workspace" }).reason, "wrong-workspace");
	assert.equal(validateStudioBufferWorkspace(workspace(), { mode: "editor-only" }).reason, "wrong-workspace");
});

test("revision exhaustion and malformed patches leave the store intact", () => {
	const s = store([prompt("prompt", { revision: Number.MAX_SAFE_INTEGER })]);
	unchanged(s, () => s.update("prompt", Number.MAX_SAFE_INTEGER, { text: "no wrap" }), "invalid-state");
	const w = store(undefined, { revision: Number.MAX_SAFE_INTEGER });
	unchanged(w, () => w.update("prompt", 0, { text: "no wrap" }), "invalid-state");
	const normal = store();
	for (const patch of [{ role: "document" }, { id: "retarget" }, { revision: 0 }, { unknown: "x" }, { text: null }]) unchanged(normal, () => normal.update("prompt", 0, patch));
});

test("independent buffers for the same canonical file retain existing disk conflict checks", () => {
	const dir = mkdtempSync(join(tmpdir(), "studio-buffer-disk-"));
	try {
		const file = join(dir, "notes ü.md"), alias = join(dir, "alias.md");
		writeFileSync(file, "original"); symlinkSync(file, alias);
		const disk = readStudioDiskFileSnapshot(alias);
		const entry = id => document(id, { text: "original", baselineText: "original", diskRevision: disk.revision, sourceState: { source: "file", path: disk.path } });
		const s = store([prompt(), entry("a"), entry("b")]);
		assert.equal(s.get("a").sourceState.path, readStudioDiskFileSnapshot(file).path);
		s.update("a", 0, { text: "first save" });
		const target = s.beginOperation("a", "save").target;
		const saved = saveStudioDiskFileIfRevision({ path: s.get("a").sourceState.path, expectedRevision: s.get("a").diskRevision, content: s.get("a").text });
		assert(saved.ok);
		assert(s.finishOperation(target, { baselineText: "first save", diskRevision: saved.revision }).ok);
		assert(!isStudioBufferDirty(s.get("a")));
		s.update("b", 0, { text: "second save" });
		const conflict = saveStudioDiskFileIfRevision({ path: s.get("b").sourceState.path, expectedRevision: s.get("b").diskRevision, content: s.get("b").text });
		assert.equal(conflict.reason, "disk-changed");
		assert.equal(readFileSync(file, "utf8"), "first save");
	} finally { rmSync(dir, { recursive: true, force: true }); }
});

test("deterministic edit/switch/late-result sequence preserves all store invariants", () => {
	const s = store([prompt(), document("doc")]);
	for (let i = 0; i < 200; i++) {
		const id = i % 2 ? "prompt" : "doc";
		const target = s.beginOperation(id, "iteration-" + i).target;
		const before = s.get(id);
		s.select(i % 2 ? "doc" : "prompt");
		s.update(id, before.revision, { text: "edit " + i });
		unchanged(s, () => s.finishOperation(target, { text: "stale" }), "stale-operation");
		assert(validateStudioBufferWorkspace(copy(s.snapshot())).ok);
		assert.equal(s.snapshot().activePromptId, "prompt");
	}
});

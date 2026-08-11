import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
	STUDIO_WORKSPACE_STATE_MAX_TEXT_CHARS,
	createStudioWorkspaceStateStore,
	isValidStudioTabStateId,
	normalizeStudioWorkspaceRecoveryState,
} from "../shared/studio-workspace-state.js";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

function tabStateId(character) {
	return "tab_" + String(character || "a").repeat(32);
}

function workspaceState(text, savedAt = 1, overrides = {}) {
	return {
		version: 1,
		savedAt,
		sourceState: { source: "file", label: "notes.qmd", path: "/tmp/notes.qmd", draftId: null },
		resourceDir: "/tmp",
		editorView: "markdown",
		rightView: "editor-quarto-preview",
		editorLanguage: "markdown",
		followLatest: false,
		responseHistoryIndex: -1,
		selectionStart: 2,
		selectionEnd: 4,
		scrollTop: 12,
		text,
		...overrides,
	};
}

test("Studio workspace recovery accepts only bounded tab IDs and editor states", () => {
	assert.equal(isValidStudioTabStateId(tabStateId("a")), true);
	assert.equal(isValidStudioTabStateId("short"), false);
	assert.equal(isValidStudioTabStateId("tab_" + "!".repeat(32)), false);

	const normalized = normalizeStudioWorkspaceRecoveryState(workspaceState("unsaved editor text", 7));
	assert.ok(normalized);
	assert.equal(normalized.text, "unsaved editor text");
	assert.equal(normalized.rightView, "editor-quarto-preview");
	assert.equal(normalized.sourceState.path, "/tmp/notes.qmd");
	assert.equal(normalizeStudioWorkspaceRecoveryState({ version: 1, text: "x".repeat(STUDIO_WORKSPACE_STATE_MAX_TEXT_CHARS + 1) }), null);
	assert.equal(normalizeStudioWorkspaceRecoveryState({ version: 2, text: "wrong version" }), null);
});

test("Studio workspace store keeps tabs isolated and ignores late stale writes", () => {
	let now = 100;
	const store = createStudioWorkspaceStateStore({ now: () => now });
	const firstId = tabStateId("a");
	const secondId = tabStateId("b");
	assert.equal(store.set(firstId, workspaceState("latest", 20)), true);
	now += 1;
	assert.equal(store.set(secondId, workspaceState("other tab", 10)), true);
	assert.equal(store.set(firstId, workspaceState("late stale request", 19)), false);
	assert.equal(store.get(firstId).text, "latest");
	assert.equal(store.get(secondId).text, "other tab");
	assert.equal(store.size, 2);
});

test("Studio workspace store evicts old entries within bounded memory", () => {
	let now = 1;
	const store = createStudioWorkspaceStateStore({
		now: () => now,
		maxEntries: 2,
		maxTotalTextChars: 20,
		ttlMs: 50,
	});
	const firstId = tabStateId("a");
	const secondId = tabStateId("b");
	const thirdId = tabStateId("c");
	assert.equal(store.set(firstId, workspaceState("1234567890", 1)), true);
	now += 1;
	assert.equal(store.set(secondId, workspaceState("abcdefghij", 2)), true);
	now += 1;
	assert.equal(store.set(thirdId, workspaceState("third", 3)), true);
	assert.equal(store.get(firstId), null);
	assert.equal(store.get(secondId).text, "abcdefghij");
	assert.equal(store.get(thirdId).text, "third");
	assert.equal(store.totalTextChars, 15);

	now += 60;
	assert.equal(store.size, 0);
	assert.equal(store.totalTextChars, 0);
});

test("Studio wires tab recovery through its authenticated server endpoint", () => {
	const indexSource = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
	const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
	assert.match(indexSource, /createStudioWorkspaceStateStore\(\)/);
	assert.match(indexSource, /requestUrl\.pathname === "\/tab-workspace-state"/);
	assert.match(indexSource, /normalizeStudioWorkspaceRecoveryState\(payload\.state\)/);
	assert.match(indexSource, /msg\.type === "workspace_state_update"/);
	assert.match(clientSource, /^\s*\(async \(\) => \{/);
	assert.match(clientSource, /await readServerWorkspaceRecoveryState\(\)/);
	assert.match(clientSource, /fetchStudioJson\("\/tab-workspace-state"/);
	assert.match(clientSource, /ws\.send\(JSON\.stringify\(\{ type: "workspace_state_update", \.\.\.body \}\)\)/);
	assert.match(clientSource, /trySendStudioJsonBeacon\("\/tab-workspace-state", body\)/);
	const stopServerStart = indexSource.indexOf("const stopServer = async () =>");
	const serverClose = indexSource.indexOf("state.server.close", stopServerStart);
	const recoveryClear = indexSource.indexOf("studioWorkspaceStateStore.clear()", stopServerStart);
	assert.ok(stopServerStart >= 0 && serverClose > stopServerStart && recoveryClear > serverClose, "Workspace recovery should clear only after in-flight HTTP requests finish.");
	assert.equal(projectRoot.endsWith("pi-studio/"), true);
});

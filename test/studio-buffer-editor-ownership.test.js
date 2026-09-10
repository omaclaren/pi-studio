import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
function section(start, end) {
	const a = source.indexOf(start), b = source.indexOf(end, a);
	assert(a >= 0 && b > a); return source.slice(a, b);
}
function harness() {
	let next = 0, decide;
	const c = { bufferRecoveryEnabled: true, bufferSwitchingEnabled: false, editorContentGeneration: 0, origin: "original", sourceTextEl: { value: "saved snapshot" },
		sourceState: { path: "/original.md", label: "original.md" }, fileBackedBaselineText: "disk", fileBackedDiskRevision: "old-revision",
		pendingSaveOperations: new Map(), pendingEditorRefresh: null, pendingRequestId: null, pendingKind: null, stickyStudioKind: null, uiBusy: false,
		pendingPiEditorLoad: null, pendingPiEditorLink: null, pendingPiEditorClear: null,
		messages: [], status: "", getEditorDraftSourceKey: () => c.origin,
		getCurrentResourceDirValue: () => "/", getEffectiveSavePath: () => c.sourceState.path,
		stripImportedFileLabel: x => x, normalizeStudioDiskRevision: x => x || null,
		normalizeStudioResourceDirValue: x => x, dirnameForDisplayPath: () => "/", resourceDirInput: { value: "/" },
		setSourceState: value => { c.sourceState = value; c.origin += "-changed"; },
		markFileBackedBaseline: (text, revision) => { c.fileBackedBaselineText = text; c.fileBackedDiskRevision = revision; },
		clearArmedTitleAttention() {}, setBusy: value => { c.uiBusy = value; }, setWsState() {}, setStatus: value => { c.status = value; },
		beginUiAction: kind => { c.uiBusy = true; c.pendingKind = kind; return c.pendingRequestId = "req-" + ++next; },
		sendMessage: msg => { c.messages.push(msg); return true; },
		requestStudioTextInput: () => new Promise(resolve => { decide = resolve; }),
		requestStudioConfirmation: () => new Promise(resolve => { decide = resolve; }),
		openStudioDecision: () => new Promise(resolve => { decide = resolve; }),
		editorDiffersFromFileBackedBaseline: () => c.sourceTextEl.value !== c.fileBackedBaselineText,
	};
	vm.createContext(c);
	vm.runInContext(section("function captureEditorConsent()", 'saveAsBtn.addEventListener("click"'), c);
	return { c, decide: value => decide(value), saved: message => {
		c.message = message;
		vm.runInContext("(function(){" + section('if (message.type === "saved")', 'if (message.type === "pi_editor_draft_result")') + "})()", c);
	} };
}

test("real saved handler records the sent baseline without replacing later typing", () => {
	const h = harness(), c = h.c;
	c.sendEditorSaveOverRequest();
	const requestId = c.pendingRequestId;
	c.sourceTextEl.value = "later typing"; c.editorContentGeneration++;
	h.saved({ type: "saved", requestId, path: "/original.md", diskRevision: "new-revision" });
	assert.equal(c.sourceTextEl.value, "later typing"); assert.equal(c.fileBackedBaselineText, "saved snapshot");
	assert.equal(c.fileBackedDiskRevision, "new-revision"); assert.equal(c.uiBusy, false);
	assert.equal(c.pendingRequestId, null);
});

test("saved handlers reject source changes, unknown acknowledgements and replays", () => {
	const h = harness(), c = h.c;
	c.sendEditorSaveOverRequest(); const requestId = c.pendingRequestId;
	c.origin = "another incarnation"; c.sourceTextEl.value = "another document";
	h.saved({ type: "saved", requestId, path: "/other.md", diskRevision: "new" });
	assert.equal(c.sourceState.path, "/original.md"); assert.equal(c.fileBackedBaselineText, "disk");
	assert.equal(c.sourceTextEl.value, "another document"); assert.equal(c.uiBusy, false);
	h.saved({ type: "saved", requestId, path: "/other.md", diskRevision: "new" });
	assert.equal(c.fileBackedBaselineText, "disk");
	c.pendingRequestId = "newer-action"; c.uiBusy = true;
	h.saved({ type: "saved", requestId: "unknown", path: "/other.md", diskRevision: "new" });
	assert.equal(c.pendingRequestId, "newer-action"); assert.equal(c.uiBusy, true);
});

test("Save As consent cannot survive text/source changes or typing-and-undo ABA", async () => {
	for (const mutation of [c => { c.sourceTextEl.value = "changed"; }, c => { c.origin = "other"; }, c => { c.editorContentGeneration += 2; }]) {
		const h = harness(), pending = h.c.openEditorSaveAsDialog();
		mutation(h.c); h.decide("/copy.md");
		assert.equal(await pending, false); assert.equal(h.c.messages.length, 0);
	}
});

test("save-conflict decisions use the visible snapshot and reject later mutations", async () => {
	for (const stale of [false, true]) {
		const h = harness(), c = h.c; c.sendEditorSaveOverRequest();
		const requestId = c.pendingRequestId;
		c.sourceTextEl.value = "typing before conflict"; c.editorContentGeneration++;
		const pending = c.handleEditorSaveConflict({ requestId, path: "/original.md", currentRevision: "new-disk", canOverwrite: true });
		if (stale) { c.sourceTextEl.value = "typing during dialog"; c.editorContentGeneration++; }
		h.decide(true); await pending;
		assert.equal(c.messages.length, stale ? 1 : 2);
		if (!stale) { assert.equal(c.messages[1].content, "typing before conflict"); assert.equal(c.messages[1].expectedRevision, "new-disk"); }
	}
});

test("Save As conflict and disk-refresh consent invalidate on a source or text change", async () => {
	const h = harness(), c = h.c; c.sendEditorSaveAsRequest("/copy.md", "snapshot", false);
	let pending = c.handleEditorSaveAsConflict({ requestId: c.pendingRequestId, path: "/copy.md", currentRevision: "exists" });
	c.origin = "changed"; h.decide(true); await pending;
	assert.equal(c.messages.length, 1);
	pending = c.requestEditorRefreshFromDisk(); c.editorContentGeneration++; h.decide(true);
	assert.equal(await pending, false); assert.equal(c.messages.length, 1);
});

test("late or replayed disk-refresh responses cannot replace current text", async () => {
	const h = harness(), c = h.c;
	c.isWatchedFilePreview = false;
	await c.requestEditorRefreshFromDisk({ skipConfirm: true });
	const requestId = c.pendingRequestId; c.sourceTextEl.value = "newer text"; c.editorContentGeneration++;
	const response = section('if (message.type === "studio_document")', 'const nextDoc = message.document;');
	for (let i = 0; i < 2; i++) {
		c.message = { type: "studio_document", requestId };
		vm.runInContext("(function(){" + response + "throw new Error('stale document was allowed'); } })()", c);
		assert.equal(c.sourceTextEl.value, "newer text");
	}
});

test("refresh send failure and correlated busy/error responses release only their pending refresh", async () => {
	const failed = harness(); failed.c.sendMessage = () => false;
	assert.equal(await failed.c.requestEditorRefreshFromDisk({ skipConfirm: true }), false);
	assert.equal(failed.c.pendingEditorRefresh, null);
	for (const type of ["error", "busy"]) {
		const h = harness(), c = h.c;
		Object.assign(c, { submittedEditorDrafts: { discard() {} }, restoreReservedPiEditorDraftSnapshot() {}, failPendingCompanionLaunch() {}, finishTrackedStudioActivity() {}, replPendingRequestId: "" });
		await c.requestEditorRefreshFromDisk({ skipConfirm: true });
		const pending = c.pendingEditorRefresh;
		const handler = section('if (message.type === "' + type + '")', type === "error" ? 'if (message.type === "info")' : 'if (message.type === "error")');
		c.message = { type, requestId: "unrelated" };
		vm.runInContext('(function(){' + handler + '})()', c);
		assert.equal(c.pendingEditorRefresh, pending);
		c.message = { type, requestId: pending.requestId };
		vm.runInContext('(function(){' + handler + '})()', c);
		assert.equal(c.pendingEditorRefresh, null); assert.equal(c.pendingRequestId, null);
	}
});

test("opt-in startup protects HTML/local typing even when recovery initialization aborts", () => {
	const bootstrap = section('let serverWorkspaceRecovery = { status: "skipped", state: null };', 'persistWorkspaceStateNow({ skipServer:');
	assert(bootstrap.indexOf('initialDocumentApplied = true') < bootstrap.indexOf('await import('));
	assert.match(bootstrap, /captureBufferRecoveryInitializationOwner\(\)/);
	assert.match(bootstrap, /bufferRecoveryInitializationOwnerIsCurrent\(initialRecoveryOwner\)/);
	const owner = section("function captureBufferRecoveryInitializationOwner", "function captureRecoveryConsent");
	assert.match(owner, /editor: captureEditorConsent\(\)/);
	assert.match(owner, /resourceDir: getCurrentResourceDirValue\(\)/);
	assert.match(owner, /scratchpadEditGeneration/);
	assert.match(owner, /reviewNotesEditGeneration/);
});

test("buffer initialization ownership includes view, resource, selection and metadata changes", () => {
	const make = () => {
		const c = {
			bufferPageClosed: false,
			text: "initial",
			sourceKey: "file:/a.md",
			generation: 1,
			resourceDir: "/a",
			getCurrentResourceDirValue: () => c.resourceDir,
			captureEditorConsent: () => ({ text: c.text, sourceKey: c.sourceKey, generation: c.generation }),
			editorConsentIsCurrent: owner => owner.text === c.text && owner.sourceKey === c.sourceKey && owner.generation === c.generation,
			editorLanguage: "markdown",
			editorView: "preview",
			rightView: "editor-preview",
			followLatest: true,
			responseHistoryIndex: 0,
			sourceTextEl: { selectionStart: 1, selectionEnd: 2, selectionDirection: "forward", scrollTop: 3 },
			sourcePreviewEl: { scrollTop: 4 },
			fileBackedBaselineText: "saved A",
			fileBackedDiskRevision: { mtimeMs: 10, size: 7 },
			annotationsEnabled: true,
			scratchpadEditGeneration: 1,
			scratchpadAssociationGeneration: 1,
			scratchpadActionGeneration: 1,
			reviewNotesEditGeneration: 1,
			reviewNotesAssociationGeneration: 1,
			reviewNotesActionGeneration: 1,
		};
		vm.createContext(c);
		vm.runInContext(section("function captureBufferRecoveryInitializationOwner", "function captureRecoveryConsent"), c);
		return c;
	};
	for (const mutate of [
		c => { c.resourceDir = "/b"; },
		c => { c.editorLanguage = "latex"; },
		c => { c.rightView = "preview"; },
		c => { c.sourceTextEl.selectionStart = 2; },
		c => { c.sourceTextEl.selectionDirection = "backward"; },
		c => { c.sourcePreviewEl.scrollTop = 5; },
		c => { c.fileBackedBaselineText = "saved B"; },
		c => { c.fileBackedDiskRevision = { mtimeMs: 11, size: 7 }; },
		c => { c.annotationsEnabled = false; },
		c => { c.scratchpadEditGeneration += 1; },
		c => { c.reviewNotesEditGeneration += 1; },
	]) {
		const c = make();
		const owner = c.captureBufferRecoveryInitializationOwner();
		assert.equal(c.bufferRecoveryInitializationOwnerIsCurrent(owner), true);
		mutate(c);
		assert.equal(c.bufferRecoveryInitializationOwnerIsCurrent(owner), false);
	}
});

test("opt-in reset forks a canonical blank editor under whole-workspace consent", () => {
	const reset = section("async function clearStudioWorkspace", "function setEditorText");
	assert.match(reset, /editorLanguage: "markdown", editorView: "markdown"/);
	assert.match(reset, /sourceState: blankSource, diskRevision: null, resourceDir: ""/);
	assert.match(reset, /recoveryConsentIsCurrent\(resetConsent\)/);
	const consent = section("function captureRecoveryConsent", "function recoveryCanChangeWorkspace");
	assert.match(consent, /workspace: captureBufferRecoveryInitializationOwner\(\)/);
	assert.match(consent, /bufferRecoveryInitializationOwnerIsCurrent\(consent\.workspace\)/);
});

test("navigation consent is single-use and stale consent warns even with acknowledged recovery", () => {
	for (const valid of [true, false]) {
		let handler, warnings = 0;
		const c = { window: { addEventListener: (_, fn) => { handler = fn; } }, bufferRecoveryEnabled: true, bufferRecoveryNavigationConsent: {},
			recoveryConsentIsCurrent: () => valid, bufferRecoveryClient: { needsUnloadConfirmation: () => false },
			hasUnsyncedStudioMetadata: () => false,
			flushStudioNavigationPersistence() {}, stopFooterSpinner() {}, flushWorkspacePersistence() {}, flushScratchpadPersistence() {}, flushReviewNotesPersistence() {}, renderStatus() {}, bufferRecoveryIssue: "",
		scratchpadDirty: false, scratchpadAssociation: null, reviewNotesDirty: false, reviewNotesAssociation: null };
		vm.createContext(c);
		vm.runInContext(section('window.addEventListener("beforeunload",', 'editorViewSelect.addEventListener("change",'), c);
		handler({ preventDefault: () => { warnings++; } });
		assert.equal(warnings, valid ? 0 : 1); assert.equal(c.bufferRecoveryNavigationConsent, null);
		handler({ preventDefault: () => { warnings++; } });
		assert.equal(warnings, valid ? 0 : 1, "consent was consumed by the first navigation");
	}
});

function recoveryActionHarness({ enabled = true, watched = false, classic = false, supportsInert = true } = {}) {
	const calls = [], items = [];
	const element = () => ({ children: [], inert: false,
		appendChild(child) { this.children.push(child); },
		querySelector(selector) { return this.children.find(child => selector === "#" + child.id) || null; },
		addEventListener(type, listener) { this[type] = listener; },
	});
	const docSection = { appendChild(item) { items.push(item); } }, fallback = element();
	const menu = { inert: false, querySelector: () => docSection, querySelectorAll: () => items };
	if (!supportsInert) delete menu.inert;
	const context = { name: "context", menu, button: { disabled: true, focus() { calls.push("focus trigger"); } } };
	const c = { bufferRecoveryEnabled: enabled, isWatchedFilePreview: watched, uiBusy: false, completionSuggestionInFlight: false,
		studioUiRefreshUi: classic ? null : { menus: [context] }, document: { createElement: element },
		copyDraftBtn: { parentElement: fallback }, makeStudioUiRefreshElement: element,
		closeStudioUiRefreshMenus() { calls.push("close menu"); }, async openBufferRecoveryPanel() { calls.push("open panel"); },
		setStatus() { assert.fail("Opening should succeed"); } };
	vm.createContext(c);
	vm.runInContext(section("function syncBufferRecoveryMenuAccess()", "async function openBufferRecoveryPanel()"), c);
	return { c, calls, items, context, fallback, element };
}

test("recovery is an opt-in source-menu action, with classic fallback and visible focus return", async () => {
	for (const options of [{ enabled: false }, { watched: true }]) {
		const h = recoveryActionHarness(options); h.c.setupBufferRecoveryAction();
		assert.equal(h.items.length, 0); assert.equal(h.fallback.children.length, 0);
	}
	const h = recoveryActionHarness(); h.c.setupBufferRecoveryAction();
	const button = h.items[0].children[0];
	assert.equal(button.id, "bufferRecoveryBtn"); assert.equal(button.textContent, "Recover unsaved text…");
	assert.equal(h.fallback.children.length, 0);
	button.click({ preventDefault() {}, stopPropagation() {} }); await Promise.resolve();
	assert.deepEqual(h.calls, ["close menu", "focus trigger", "open panel"]);
	const classic = recoveryActionHarness({ classic: true }); classic.c.setupBufferRecoveryAction();
	assert.equal(classic.fallback.children[0].id, "bufferRecoveryBtn");
	const bootstrap = section('let serverWorkspaceRecovery = { status: "skipped", state: null };', 'const initialRecoveryOwner');
	assert.match(bootstrap, /setupBufferRecoveryAction\(\)/); assert.doesNotMatch(bootstrap, /statusLine|appendChild/);
});

test("busy source menus allow recovery inspection without enabling other context actions", () => {
	const h = recoveryActionHarness(); h.items.push(h.element(), h.element()); h.c.setupBufferRecoveryAction();
	for (const kind of ["uiBusy", "completionSuggestionInFlight"]) {
		h.c[kind] = true; h.c.syncBufferRecoveryMenuAccess();
		assert.equal(h.context.button.disabled, false);
		assert.deepEqual(h.items.map(item => item.inert), [true, true, false]);
		h.c[kind] = false; h.c.syncBufferRecoveryMenuAccess();
		assert(h.items.every(item => !item.inert));
	}
	for (const options of [{ enabled: false }, { supportsInert: false }]) {
		const legacy = recoveryActionHarness(options); legacy.c.uiBusy = true; legacy.c.syncBufferRecoveryMenuAccess();
		assert.equal(legacy.context.button.disabled, true, "never unlock an unguarded source menu");
	}
});

test("annotated saving uses the tracked save helper and checks its exact consent", () => {
	const block = section('if (saveAnnotatedBtn) {\n        saveAnnotatedBtn.addEventListener', 'if (stripAnnotationsBtn) {');
	assert.match(block, /editorAsyncConsentIsCurrent\(consent\)/);
	assert.match(block, /sendEditorSaveAsRequest\(path, content, false\)/);
});

test("loading the comments prompt asks before replacing editor text and rechecks exact ownership", async () => {
	const block = section("async function loadReviewNotesPromptIntoEditor", "function buildReviewNoteLineMap");
	assert.match(block, /captureEditorConsent\(\)/);
	assert.match(block, /Replace the current editor text with this comments prompt/);
	assert.match(block, /reviewNotesActionGeneration === actionGeneration/);
	assert.match(block, /reviewNotesAssociationGeneration === associationGeneration/);
	assert.match(block, /reviewNotesEditGeneration === editGeneration/);
	assert.match(block, /editorConsentIsCurrent\(editorConsent\)/);
	assert.ok((block.match(/!isCurrent\(\)/g) || []).length >= 2);

	for (const stale of ["none", "review", "editor"]) {
		let decide;
		const c = {
			bufferRecoveryEnabled: true,
			reviewNotesActionGeneration: 0,
			reviewNotesAssociationGeneration: 2,
			reviewNotesEditGeneration: 3,
			reviewNotesAssociation: { key: "file:/a.md" },
			editorContentGeneration: 4,
			sourceTextEl: { value: "valuable current text" },
			fileBackedBaselineText: "valuable current text",
			fileBackedDiskRevision: "revision-a",
			editorDiffersFromFileBackedBaseline: () => false,
			getEditorDraftSourceKey: () => "file:/a.md",
			buildReviewNotesPrompt: () => "comments prompt\n",
			requestStudioConfirmation: () => new Promise(resolve => { decide = resolve; }),
			setEditorText(text) { c.sourceTextEl.value = text; },
			setSourceState() { c.sourceChanged = true; },
			setStatus() { c.statusChanged = true; },
		};
		vm.createContext(c);
		vm.runInContext(section("function captureEditorConsent", "function captureEditorAsyncConsent"), c);
		vm.runInContext(block, c);
		const pending = c.loadReviewNotesPromptIntoEditor();
		if (stale === "review") c.reviewNotesEditGeneration += 1;
		if (stale === "editor") {
			c.sourceTextEl.value = "typing during confirmation";
			c.editorContentGeneration += 1;
		}
		decide(true);
		await pending;
		assert.equal(c.sourceTextEl.value, stale === "none" ? "comments prompt\n"
			: stale === "editor" ? "typing during confirmation" : "valuable current text");
		assert.equal(Boolean(c.sourceChanged), stale === "none");
	}
});

test("comments-prompt replacement protects empty, whitespace and unknown-baseline file edits", async () => {
	for (const [text, baseline] of [["", "saved content"], [" \n", "saved content"], ["", null], ["comments prompt\n", "saved content"]]) {
		for (const outcome of ["accept", "cancel", "edit", "baseline", "revision", "source"]) {
			let decide;
			const c = {
				bufferRecoveryEnabled: true,
				reviewNotesActionGeneration: 0,
				reviewNotesAssociationGeneration: 1,
				reviewNotesEditGeneration: 1,
				reviewNotesAssociation: { key: "file:/a.md" },
				editorContentGeneration: 1,
				sourceState: { path: "/a.md" },
				sourceTextEl: { value: text },
				fileBackedBaselineText: baseline,
				fileBackedDiskRevision: "revision-a",
				getEditorDraftSourceKey: () => c.sourceState.path,
				buildReviewNotesPrompt: () => "comments prompt\n",
				requestStudioConfirmation: () => new Promise(resolve => { decide = resolve; }),
				setEditorText(value) { c.sourceTextEl.value = value; },
				setSourceState(value) { c.sourceState = value; },
				setStatus() {},
			};
			vm.createContext(c);
			vm.runInContext(section("function captureEditorConsent", "function captureEditorAsyncConsent"), c);
			vm.runInContext(section("function hasRefreshableFilePath", "function updateSourceBadge"), c);
			vm.runInContext(section("async function loadReviewNotesPromptIntoEditor", "function buildReviewNoteLineMap"), c);
			const pending = c.loadReviewNotesPromptIntoEditor();
			assert.equal(typeof decide, "function", `dirty file must ask: ${JSON.stringify({ text, baseline, outcome })}`);
			assert.equal(c.sourceState.path, "/a.md");
			assert.equal(c.sourceTextEl.value, text);
			if (outcome === "edit") c.editorContentGeneration += 2; // type/undo still revokes consent
			if (outcome === "baseline") c.fileBackedBaselineText = "new baseline";
			if (outcome === "revision") c.fileBackedDiskRevision = "revision-b";
			if (outcome === "source") c.sourceState.path = "/b.md";
			decide(outcome !== "cancel");
			await pending;
			assert.equal(c.sourceTextEl.value, outcome === "accept" ? "comments prompt\n" : text);
			assert.equal(c.sourceState.path, outcome === "accept" ? null : outcome === "source" ? "/b.md" : "/a.md");
		}
	}
});

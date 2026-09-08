import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");

function section(start, end) {
	const a = source.indexOf(start);
	const b = source.indexOf(end, a);
	assert(a >= 0 && b > a, start);
	return source.slice(a, b);
}

function deferred() {
	let resolve;
	let reject;
	const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
	return { promise, resolve, reject };
}

const tick = () => new Promise(resolve => setImmediate(resolve));

function previewOwnerHarness() {
	class Element {
		constructor() { this.isConnected = true; this.parentElement = null; this.pane = null; }
		closest() { return this.pane || this; }
	}
	const sourcePreviewEl = new Element();
	const critiqueViewEl = new Element();
	let editorConsentCurrent = true;
	const c = {
		Element,
		bufferRecoveryEnabled: true,
		bufferPageClosed: false,
		sourcePreviewEl,
		critiqueViewEl,
		studioPreviewElementOwners: new WeakMap(),
		sourcePreviewRenderNonce: 4,
		responsePreviewRenderNonce: 7,
		editorView: "preview",
		rightView: "editor-preview",
		editorLanguage: "markdown",
		annotationsEnabled: true,
		sourceTextEl: { value: "editor text" },
		response: { id: "response-a" },
		latestResponseMarkdown: "response text",
		resource: { sourcePath: "/a.md", resourceDir: "/" },
		captureEditorAsyncConsent: () => ({ token: "editor" }),
		editorAsyncConsentIsCurrent: () => editorConsentCurrent,
		getSelectedHistoryItem: () => c.response,
		getHtmlPreviewResourceContextOptions: () => ({ ...c.resource }),
		previewResourceHelpers: {
			areStudioPreviewResourceContextsEqual: (a, b) => a.sourcePath === b.sourcePath && a.resourceDir === b.resourceDir,
		},
	};
	vm.createContext(c);
	vm.runInContext(section("function captureStudioPreviewOwner", "function isCurrentStudioPreviewRender"), c);
	return { c, sourcePreviewEl, critiqueViewEl, setEditorConsentCurrent(value) { editorConsentCurrent = value; } };
}

test("preview owners reject render, view, annotation, resource, response and editor ABA changes", () => {
	const mutations = [
		c => { c.sourcePreviewRenderNonce += 1; },
		c => { c.editorView = "markdown"; },
		c => { c.annotationsEnabled = false; },
		c => { c.resource = { sourcePath: "/b.md", resourceDir: "/" }; },
		c => { c.editorLanguage = "latex"; },
	];
	for (const mutate of mutations) {
		const h = previewOwnerHarness();
		const owner = h.c.captureStudioPreviewOwner("source");
		assert.equal(h.c.studioPreviewOwnerIsCurrent(owner), true);
		mutate(h.c);
		assert.equal(h.c.studioPreviewOwnerIsCurrent(owner), false);
	}
	const h = previewOwnerHarness();
	const editorOwner = h.c.captureStudioPreviewOwner("source");
	h.setEditorConsentCurrent(false);
	assert.equal(h.c.studioPreviewOwnerIsCurrent(editorOwner), false);

	for (const mutate of [
		c => { c.responsePreviewRenderNonce += 2; },
		c => { c.response = { id: "response-a" }; },
		c => { c.latestResponseMarkdown = "changed then restored"; },
	]) {
		const response = previewOwnerHarness();
		response.c.rightView = "preview";
		const owner = response.c.captureStudioPreviewOwner("response");
		mutate(response.c);
		assert.equal(response.c.studioPreviewOwnerIsCurrent(owner), false);
	}
});

test("buffer-safe response scroll resets keep the owned live pane instead of cloning it", () => {
	let cloneCalls = 0;
	const pane = {
		parentNode: {},
		cloneNode() { cloneCalls += 1; return {}; },
	};
	const c = { bufferRecoveryEnabled: true, critiqueViewEl: pane };
	vm.createContext(c);
	vm.runInContext(section("function replaceResponsePaneWithClone", "function applyPendingResponseScrollReset"), c);
	assert.equal(c.replaceResponsePaneWithClone(), pane);
	assert.equal(cloneCalls, 0);
});

test("preview DOM interactions retain the exact owner that produced their pane", () => {
	const h = previewOwnerHarness();
	const node = new h.c.Element();
	node.pane = h.sourcePreviewEl;
	const owner = h.c.captureStudioPreviewOwner("source");
	h.c.bindStudioPreviewElementOwner(h.sourcePreviewEl, owner);
	const context = h.c.buildStudioPreviewInteractionContext(node, {});
	assert.equal(context.sourcePath, "/a.md");
	assert.equal(context.resourceDir, "/");
	assert.equal(context.isCurrent(), true);
	h.c.sourcePreviewRenderNonce += 1;
	assert.equal(context.isCurrent(), false);
	h.c.sourcePreviewRenderNonce -= 1;
	h.c.bindStudioPreviewElementOwner(h.sourcePreviewEl, h.c.captureStudioPreviewOwner("source"));
	assert.equal(context.isCurrent(), false, "replacing the pane owner rejects an old DOM callback even after nonce ABA");

	const hidden = previewOwnerHarness();
	const hiddenNode = new hidden.c.Element();
	hiddenNode.pane = hidden.sourcePreviewEl;
	hidden.c.bindStudioPreviewElementOwner(hidden.sourcePreviewEl, hidden.c.captureStudioPreviewOwner("source"));
	hidden.c.editorView = "markdown";
	assert.equal(hidden.c.studioPreviewNodeOwnerIsCurrent(hiddenNode), false);
	assert.equal(hidden.c.buildStudioPreviewInteractionContext(hiddenNode, {}).isCurrent(), false);
});

test("reconnect rebuilds both visible editor-preview owners", () => {
	const calls = [];
	const c = {
		bufferRecoveryEnabled: true,
		bufferConnectionGeneration: 1,
		editorView: "preview",
		rightView: "editor-preview",
		renderSourcePreview(options) { calls.push(["source", options && options.previewDelayMs]); },
		renderActiveResult() { calls.push(["right"]); },
	};
	vm.createContext(c);
	vm.runInContext(section("function refreshEditorPreviewOwnersAfterReconnect", "function isCurrentStudioPreviewRender"), c);
	c.refreshEditorPreviewOwnersAfterReconnect();
	assert.deepEqual(calls, [["source", 0]], "the source render path also schedules a visible right editor preview");
	calls.length = 0;
	c.editorView = "markdown";
	c.refreshEditorPreviewOwnersAfterReconnect();
	assert.deepEqual(calls, [["right"]], "a right-only editor preview is rebuilt directly");
	calls.length = 0;
	c.bufferConnectionGeneration = 0;
	c.refreshEditorPreviewOwnersAfterReconnect();
	assert.deepEqual(calls, [], "initial connection does not add a redundant preview render");
	assert.match(section("function renderSourcePreview(options)", "function refreshPreviewsForResourceContextChange"),
		/if \(rightView === "editor-preview"\) \{\s*scheduleResponseEditorPreviewRender/);
	assert.match(source, /refreshEditorPreviewOwnersAfterReconnect\(\);[\s\S]*if \(rightView === "editor-quarto-preview"\)/);
});

test("HTML iframe ownership requires both the live render owner and exact contentWindow", () => {
	const c = { bufferRecoveryEnabled: true, studioPreviewOwnerIsCurrent: owner => owner && owner.live === true };
	vm.createContext(c);
	vm.runInContext(section("function htmlArtifactOwnerIsCurrent", "function setHtmlArtifactDetailText"), c);
	const frameWindow = {};
	const record = { previewOwner: { live: true }, iframe: { contentWindow: frameWindow } };
	assert.equal(c.htmlArtifactOwnerIsCurrent(record, { source: frameWindow }), true);
	assert.equal(c.htmlArtifactOwnerIsCurrent(record, { source: {} }), false);
	record.previewOwner.live = false;
	assert.equal(c.htmlArtifactOwnerIsCurrent(record, { source: frameWindow }), false);
});

function localLinkHarness() {
	const requests = [];
	let grant = null;
	const c = {
		isWatchedFilePreview: false,
		initialQueryParams: new URLSearchParams(),
		studioPreviewInteractionIsCurrent: context => !context || typeof context.isCurrent !== "function" || context.isCurrent(),
		getPreviewLinkResourceQuery: (href, context) => ({ path: href, sourcePath: context.sourcePath, resourceDir: context.resourceDir }),
		fetchStudioJson(path, options) {
			const pending = deferred();
			requests.push({ path, options, ...pending });
			return pending.promise;
		},
		getStudioResourceGrantRequest: error => error && error.grantRequest || null,
		requestStudioResourceGrant(request, options) {
			grant = { request, options, ...deferred() };
			return grant.promise;
		},
	};
	vm.createContext(c);
	vm.runInContext(section("async function fetchPreviewLocalLink", "function getPreviewPdfViewerUrl"), c);
	return { c, requests, get grant() { return grant; } };
}

test("local-link results and grant continuations become inert when their preview owner changes", async () => {
	{
		const h = localLinkHarness();
		let current = true;
		const context = { sourcePath: "/a.md", resourceDir: "/a", isCurrent: () => current };
		const pending = h.c.fetchPreviewLocalLink("resolve", "linked.md", context);
		await tick();
		assert.deepEqual({ ...h.requests[0].options.query }, { path: "linked.md", sourcePath: "/a.md", resourceDir: "/a", action: "resolve" });
		current = false;
		h.requests[0].resolve({ path: "/a/linked.md" });
		await assert.rejects(pending, error => error.studioStale === true && error.studioCancelled === true);
	}
	{
		const h = localLinkHarness();
		let current = true;
		const context = { sourcePath: "/a.md", resourceDir: "", isCurrent: () => current };
		const pending = h.c.fetchPreviewLocalLink("resolve", "outside.md", context);
		await tick();
		h.requests[0].reject({ grantRequest: { path: "/outside.md", directoryPath: "/", label: "outside.md" } });
		await tick();
		assert(h.grant);
		assert.equal(h.grant.options.isCurrent(), true);
		current = false;
		h.grant.resolve(true);
		await assert.rejects(pending, error => error.studioStale === true);
		assert.equal(h.requests.length, 1, "a stale grant cannot retry against a different preview");
	}
});

test("resource-grant decision clicks preserve their pending local-link menu request", async () => {
	class Element {
		closest() { return null; }
	}
	const decisionTarget = new Element();
	const overlay = { contains: target => target === decisionTarget };
	const clickHandlers = [];
	const inspected = deferred();
	let shown = 0;
	const c = {
		Element,
		document: {
			addEventListener(name, handler, capture) {
				if (name === "click" && capture === true) clickHandlers.push(handler);
			},
		},
		window: { setTimeout() {} },
		studioDecisionState: {},
		studioDecisionOverlayEl: overlay,
		previewLinkMenuRequestId: 0,
		activePreviewLinkContext: null,
		previewLinkMenuEl: null,
		isWatchedFilePreview: false,
		buildStudioPreviewInteractionContext: (_anchor, context) => context,
		studioPreviewInteractionIsCurrent: () => true,
		isStudioLocalPreviewHref: () => true,
		getPreviewLocalLinkKind: () => "text",
		getEffectivePreviewLinkContext: context => context,
		fetchPreviewLocalLink: () => inspected.promise,
		setStatus() {},
		ensurePreviewLinkMenu: () => ({ innerHTML: "", querySelector: () => null }),
		appendPreviewLinkMenuButton() { shown += 1; },
		positionPreviewLinkMenu() {},
		runPreviewLinkAction() {},
		handlePreviewLocalLinkClick() {},
	};
	vm.createContext(c);
	vm.runInContext(section("function closePreviewLinkMenu", "function ensurePreviewLinkMenu"), c);
	vm.runInContext(section("async function showPreviewLinkMenu", "function getStudioResourceGrantRequest"), c);
	const menuBody = source.indexOf("const menuButton = target instanceof Element ? target.closest(\".studio-preview-link-menu [data-preview-link-action]\")");
	const listenerStart = source.lastIndexOf('document.addEventListener("click", (event) => {', menuBody);
	const listenerEndMarker = "\n      }, true);";
	const listenerEnd = source.indexOf(listenerEndMarker, menuBody);
	assert.ok(listenerStart >= 0 && listenerEnd > menuBody);
	vm.runInContext(source.slice(listenerStart, listenerEnd + listenerEndMarker.length), c);
	assert.equal(clickHandlers.length, 1);

	const pendingMenu = c.showPreviewLinkMenu(null, { clientX: 1, clientY: 2 }, {
		href: "/outside/a.md", sourcePath: "/current.md", resourceDir: "/",
	});
	const requestId = c.previewLinkMenuRequestId;
	clickHandlers[0]({ target: decisionTarget });
	assert.equal(c.previewLinkMenuRequestId, requestId, "grant approval is not mistaken for an outside-menu cancellation");
	inspected.resolve({ ok: true });
	assert.equal(await pendingMenu, true);
	assert.ok(shown > 0);
});

test("late PDF host-action results cannot report against a replaced preview", async () => {
	const pending = deferred();
	const statuses = [];
	const feedback = [];
	let current = true;
	let fetchCalls = 0;
	const c = {
		bufferRecoveryEnabled: true,
		normalizeStudioPdfResourceQuery: query => query,
		fetchStudioJson() { fetchCalls += 1; return pending.promise; },
		flashStudioPdfActionFeedback(_button, text) { feedback.push(text); },
		setStatus(text) { statuses.push(text); },
	};
	vm.createContext(c);
	vm.runInContext(section("async function runStudioPdfLocalAction", "async function copyStudioPdfResourcePath"), c);
	const action = c.runStudioPdfLocalAction("reveal", { path: "/a.pdf" }, {}, { isCurrent: () => current });
	await tick();
	current = false;
	pending.resolve({ message: "shown" });
	assert.equal(await action, false);
	assert.deepEqual(statuses, []);
	assert.deepEqual(feedback, []);
	assert.equal(await c.runStudioPdfLocalAction("reveal", { path: "/a.pdf" }, {}, { isCurrent: () => false }), false);
	assert.equal(fetchCalls, 1, "an already stale action does not reach the host");
});

test("preview render and link call sites use immutable owners through late stages", () => {
	const render = section("async function applyRenderedMarkdown", "function renderSourcePreviewNow");
	assert.match(render, /previewResourceContext = bufferRecoveryEnabled \? owner\.resource/);
	assert.match(render, /decorateRenderedEditorPreviewComments\(staging, bufferRecoveryEnabled \? owner\.text/);
	assert.match(render, /!previewResourceContext\.sourcePath && !previewResourceContext\.resourceDir/);
	assert.match(render, /finishPreviewRender\(targetEl, owner\)/);

	const menu = section("async function showPreviewLinkMenu", "function getStudioResourceGrantRequest");
	assert.match(menu, /buildStudioPreviewInteractionContext\(anchor, contextOverride\)/);
	assert.match(menu, /menuRequestId !== previewLinkMenuRequestId \|\| !studioPreviewInteractionIsCurrent\(nextContext\)/);
	const openHere = section("async function openPreviewDocumentHere", "async function openPreviewDocumentInNewEditor");
	assert.match(openHere, /captureEditorAsyncConsent\(\)/);
	assert.ok((openHere.match(/if \(!isCurrent\(\)/g) || []).length >= 3);

	const comments = section("function addReviewNoteFromPreviewBlock", "function addReviewNoteFromAnchor");
	assert.match(comments, /studioPreviewNodeOwnerIsCurrent\(blockEl\)/);
	assert.match(comments, /htmlArtifactOwnerIsCurrent\(record\)/);
});

function runQuartoContext(c, message) {
	c.message = message;
	vm.runInContext("(function () {" + section('if (message.type === "quarto_preview_context")', 'if (message.type === "quarto_preview_state")') + "})()", c);
}

function runQuartoError(c, message) {
	c.message = message;
	vm.runInContext("(function () {" + section('if (message.type === "quarto_preview_action_error")', 'if (message.type === "hello_ack")') + "})()", c);
}

test("Quarto context requires both request and source ownership", () => {
	const make = () => {
		const c = {
			message: null,
			bufferRecoveryEnabled: true,
			quartoPreviewCheckRequestId: "check-a",
			quartoPreviewCheckSourcePath: "/a.qmd",
			quartoPreviewActionRequestId: null,
			quartoPreviewActionSourcePath: "",
			quartoPreviewContext: { sentinel: true },
			currentPath: "/a.qmd",
			getCurrentStudioQuartoSourcePath: () => c.currentPath,
			studioQuartoPathsMatch: (a, b) => a === b,
			normalizeStudioQuartoContext: value => value,
			rightView: "editor-quarto-preview",
			renderQuartoPreviewView() { c.rendered = (c.rendered || 0) + 1; },
			updateReferenceBadge() {},
		};
		vm.createContext(c);
		return c;
	};

	const changed = make();
	changed.currentPath = "/b.qmd";
	runQuartoContext(changed, { type: "quarto_preview_context", requestId: "check-a", context: { requestedSourcePath: "/a.qmd", available: true } });
	assert.deepEqual(changed.quartoPreviewContext, { sentinel: true });
	assert.equal(changed.rendered, undefined);

	const mismatched = make();
	runQuartoContext(mismatched, { type: "quarto_preview_context", requestId: "check-a", context: { requestedSourcePath: "/other.qmd", available: true } });
	assert.deepEqual(mismatched.quartoPreviewContext, { sentinel: true });

	const current = make();
	runQuartoContext(current, { type: "quarto_preview_context", requestId: "check-a", context: { requestedSourcePath: "/a.qmd", available: true } });
	assert.equal(current.quartoPreviewContext.requestedSourcePath, "/a.qmd");
	assert.equal(current.quartoPreviewCheckRequestId, null);
	assert.equal(current.rendered, 1);
});

test("Quarto errors require a matching request-owned source, including A→B→A", () => {
	const make = () => {
		const statuses = [];
		const c = {
			message: null,
			quartoPreviewCheckRequestId: "check-a",
			quartoPreviewCheckSourcePath: "/a.qmd",
			quartoPreviewActionRequestId: null,
			quartoPreviewActionSourcePath: "",
			quartoPreviewContext: { sentinel: true },
			currentPath: "/a.qmd",
			getCurrentStudioQuartoSourcePath: () => c.currentPath,
			studioQuartoPathsMatch: (a, b) => a === b,
			rightView: "editor-quarto-preview",
			sourceState: { label: "A" },
			renderQuartoPreviewView() { c.rendered = (c.rendered || 0) + 1; },
			updateReferenceBadge() {},
			setStatus(text) { statuses.push(text); },
		};
		vm.createContext(c);
		return { c, statuses };
	};

	const wrong = make();
	wrong.c.currentPath = "/b.qmd";
	runQuartoError(wrong.c, { type: "quarto_preview_action_error", requestId: "check-a", message: "late A" });
	assert.deepEqual(wrong.c.quartoPreviewContext, { sentinel: true });
	assert.equal(wrong.statuses.length, 0);
	assert.equal(wrong.c.quartoPreviewCheckRequestId, null);

	const aba = make();
	aba.c.quartoPreviewCheckRequestId = null; // setSourceState(A→B) retired the old request before returning to A.
	runQuartoError(aba.c, { type: "quarto_preview_action_error", requestId: "check-a", message: "replayed A" });
	assert.deepEqual(aba.c.quartoPreviewContext, { sentinel: true });
	assert.equal(aba.statuses.length, 0);

	const current = make();
	runQuartoError(current.c, { type: "quarto_preview_action_error", requestId: "check-a", message: "current failure" });
	assert.equal(current.c.quartoPreviewContext.sourcePath, "/a.qmd");
	assert.equal(current.c.quartoPreviewContext.error, "current failure");
	assert.deepEqual(current.statuses, ["current failure"]);
});

test("focus viewers and PDF cards retain their originating interaction predicates", () => {
	const pdfOpen = section("function openStudioPdfFocusViewer", "function closeStudioPdfFocusViewer");
	const pdfActions = section("async function runStudioPdfLocalAction", "function refreshStudioPdfCard");
	const imageOpen = section("function openStudioImageFocusViewer", "function closeStudioImageFocusViewer");
	const cards = section("function createAuthorizedStudioPdfCard", "async function renderStudioPdfBlocksInElement");
	const commit = section("function commitStudioPreviewStagingElement", "async function applyRenderedMarkdown");
	assert.match(pdfOpen, /studioPdfFocusIsCurrent = isCurrent/);
	assert.match(pdfActions, /bufferRecoveryEnabled && !isCurrent\(\)/);
	assert.match(imageOpen, /studioImageFocusIsCurrent = isCurrent/);
	assert.match(cards, /runStudioPdfLocalAction\("system-viewer"[^\n]+\{ isCurrent \}\)/);
	assert.match(cards, /ensureStudioPdfCardAutoRefreshState\(card, resourceQuery, isCurrent\)/);
	assert.match(commit, /closeStudioHtmlFocusViewer\(\)/);
	assert.match(commit, /pruneDisconnectedHtmlArtifactFrames\(\)/);
});

test("PDF focus teardown discards a moved frame after its committed preview is replaced", () => {
	const removed = [];
	const focusSlot = {
		removeChild(node) {
			removed.push(node);
			node.parentNode = null;
		},
	};
	const frame = {
		parentNode: focusSlot,
		className: "studio-pdf-focus-frame",
		style: { cssText: "height: auto" },
		setAttribute() {},
		removeAttribute() {},
	};
	const c = {
		studioPdfFocusMovedFrameState: {
			frame,
			parent: { isConnected: false },
			nextSibling: null,
			placeholder: { parentNode: null },
			className: "studio-pdf-frame",
			styleCssText: "height: 680px",
			title: "PDF preview",
		},
	};
	vm.createContext(c);
	vm.runInContext(section("function restoreStudioPdfFocusMovedFrame", "function setStudioPdfFocusFrameSource"), c);

	c.restoreStudioPdfFocusMovedFrame();

	assert.equal(c.studioPdfFocusMovedFrameState, null);
	assert.deepEqual(removed, [frame]);
	assert.equal(frame.parentNode, null);
	assert.equal(frame.className, "studio-pdf-frame");
	assert.equal(frame.style.cssText, "height: 680px");
});

test("annotation removal and annotation-mode rerenders retain exact editor/preview ownership", () => {
	const strip = section("if (stripAnnotationsBtn)", "// Working directory controls");
	assert.match(strip, /captureEditorAsyncConsent\(\)/);
	assert.match(strip, /editorAsyncConsentIsCurrent\(consent\)/);
	const mode = section("function setAnnotationsEnabled", "function extractSection");
	assert.match(mode, /rightView === "preview"\) renderActiveResult\(\)/);
	assert.match(mode, /scheduleWorkspacePersistence\(\)/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Candidate 117: a PDF's less frequent actions sit under More, on its card and in its enlarged
// view. The page's own menu code runs here, with the DOM stubbed. Events follow the DOM's path:
// capture from the document down, then bubble up, and a stopped event goes no further. The
// page's document-level media handler is installed, as the page installs it (Sol, Astra, c117).
const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../client/studio.css", import.meta.url), "utf8");
const slice = (from, to) => {
	const start = clientSource.indexOf(from);
	const end = clientSource.indexOf(to, start);
	assert.ok(start >= 0 && end > start, from);
	return clientSource.slice(start, end);
};

function page() {
	const context = { console };
	vm.runInNewContext([
		"class Node { constructor() { this.parent = null; this.children = []; this.listeners = []; } contains(node) { for (let at = node; at; at = at.parent) if (at === this) return true; return false; }",
		"  addEventListener(type, listener, capture) { this.listeners.push({ type, listener, capture: capture === true || Boolean(capture && capture.capture) }); }",
		"  appendChild(child) { child.parent = this; this.children.push(child); return child; } }",
		"class Element extends Node {",
		"  constructor(tag) { super(); this.tag = tag; this.classes = new Set(); this.textContent = ''; this.open = false; this.attributes = {}; const owner = this;",
		"    this.classList = { add(name) { owner.classes.add(name); }, contains(name) { return owner.classes.has(name); } }; }",
		"  set className(value) { this.classes = new Set(String(value).split(/\\s+/).filter(Boolean)); } get className() { return [...this.classes].join(' '); }",
		"  appendChild(child) { child.parent = this; this.children.push(child); return child; }",
		"  matches(selector) { return selector.split(',').some((one) => { const [tag, ...names] = one.trim().split('.'); return (!tag || tag === this.tag) && names.every((name) => this.classes.has(name)); }); }",
		"  closest(selector) { for (let at = this; at && at instanceof Element; at = at.parent) if (at.matches(selector)) return at; return null; }",
		"  querySelectorAll(selector) { const found = []; const walk = (node) => { for (const child of node.children) { if (child.matches(selector.replace('[open]', '')) && (!selector.includes('[open]') || child.open)) found.push(child); walk(child); } }; walk(this); return found; }",
		"  focus() { focused.push(this); } }",
		"const focused = []; const timers = []; const ran = [];",
		"const window = { setTimeout(callback) { timers.push(callback); return timers.length; } };",
		"const document = new Node(); document.createElement = (tag) => new Element(tag);",
		"document.querySelectorAll = (selector) => Element.prototype.querySelectorAll.call(document, selector);",
		"function fire(target, type, fields = {}) {",
		"  let stopped = false; let now = false;",
		"  const event = { type, target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { stopped = true; }, stopImmediatePropagation() { stopped = true; now = true; }, ...fields };",
		"  const path = []; for (let at = target; at; at = at.parent) path.unshift(at);",
		"  for (const node of path) { for (const entry of node.listeners) { if (entry.type === type && entry.capture) entry.listener(event); if (now) break; } if (stopped) return event; }",
		"  for (const node of path.reverse()) { for (const entry of node.listeners) { if (entry.type === type && !entry.capture) entry.listener(event); if (now) break; } if (stopped) return event; }",
		"  return event; }",
		// What the media handler calls: each records that it ran, once.
		"function studioPreviewNodeOwnerIsCurrent() { return true; } function buildStudioPreviewInteractionContext() { return { isCurrent: () => true }; } function studioPreviewInteractionIsCurrent() { return true; }",
		"function getStudioPdfCardResourceQuery() { return { path: 'a.pdf' }; } function runStudioPdfLocalAction(action) { ran.push(action); } function copyStudioPdfResourcePath() { ran.push('copy'); }",
		"function refreshStudioPdfCard() { ran.push('refresh'); return true; } function flashStudioPdfActionFeedback() {} function setStatus() {}",
		"function ensureStudioPdfCardAutoRefreshState() { return { enabled: false }; } function setStudioPdfCardAutoRefresh() { ran.push('auto'); }",
		"function handleStudioBlockedMediaAllowButton() {} function openPreviewImageElementInFocus() {} function openPreviewPdfFigureInFocus() {}",
		"let studioPdfFocusOverlayEl = null;",
		slice("      // A PDF's less frequent actions, under More", "      function syncStudioPdfAutoRefreshButton"),
		slice("      function consumeStudioPreviewMediaEvent(event) {", "      function handleStudioPreviewMediaKeydown(event) {"),
		slice("      function handleStudioPreviewMediaActivation(event) {", "      function isStudioImageFocusOpen() {"),
		"globalThis.api = { createStudioPdfMoreMenu, closeStudioPdfFocusMoreMenus, handleStudioPreviewMediaActivation, Element, fire, timers, focused, ran, document,",
		"  setOverlay(element) { studioPdfFocusOverlayEl = element; } };",
	].join("\n"), context);
	return context.api;
}

const plain = (value) => JSON.parse(JSON.stringify(value));
const run = (p) => p.timers.splice(0).forEach((callback) => callback());

test("More holds the given actions in order, and a chosen one closes it after its own click", () => {
	const p = page();
	const items = ["Refresh now", "Browser tab", "System viewer", "Show in folder", "Copy path"].map((label) => {
		const item = new p.Element(label === "Browser tab" ? "a" : "button");
		item.textContent = label;
		// As the real items do, each stops its click from bubbling.
		item.addEventListener("click", (event) => { item.clicked = (item.clicked || 0) + 1; event.stopPropagation(); });
		return item;
	});
	const details = p.createStudioPdfMoreMenu("focus", items);
	p.document.appendChild(details);
	assert.equal(details.tag, "details");
	assert.equal(details.className, "studio-pdf-more studio-pdf-focus-more");
	const [summary, menu] = details.children;
	assert.equal(summary.tag, "summary");
	assert.equal(summary.textContent, "More");
	assert.equal(menu.className, "studio-pdf-more-menu");
	assert.deepEqual(Array.from(menu.children, (item) => item.textContent), ["Refresh now", "Browser tab", "System viewer", "Show in folder", "Copy path"]);
	assert.ok(menu.children.every((item) => item.classes.has("studio-pdf-more-item")));
	details.open = true;
	p.fire(items[2], "click");
	assert.equal(items[2].clicked, 1, "Its own action runs, once.");
	assert.equal(details.open, true, "Still open while it runs.");
	run(p);
	assert.equal(details.open, false, "Then the menu closes.");
	details.open = true;
	p.fire(menu, "click");
	assert.equal(p.timers.length, 0, "A click on the menu's padding closes nothing.");
});

test("a card's choice closes More too, though the page's media handler takes its click first (Sol and Astra's H1)", () => {
	const p = page();
	// The page's own registration: on the document, in the capture phase.
	p.document.addEventListener("click", p.handleStudioPreviewMediaActivation, true);
	const card = new p.Element("figure");
	card.className = "studio-pdf-card";
	p.document.appendChild(card);
	const kinds = [["Refresh now", "studio-pdf-card-refresh", "refresh"], ["System viewer", "studio-pdf-card-system-viewer", "system-viewer"],
		["Show in folder", "studio-pdf-card-reveal", "reveal"], ["Copy path", "studio-pdf-card-copy-path", "copy"]];
	const items = kinds.map(([label, kind]) => {
		const item = new p.Element("button");
		item.className = `studio-pdf-card-action ${kind}`;
		item.textContent = label;
		// The element's own handler, which the media handler's stop keeps from running.
		item.addEventListener("click", () => p.ran.push(`element ${label}`));
		return item;
	});
	const details = p.createStudioPdfMoreMenu("card", items);
	card.appendChild(details);
	for (const [index, [label, , action]] of kinds.entries()) {
		details.open = true;
		p.ran.length = 0;
		p.fire(items[index], "click");
		assert.deepEqual(plain(p.ran), [action], `${label} runs once, by the page's handler.`);
		run(p);
		assert.equal(details.open, false, `${label} closes More.`);
	}
	// Auto-refresh isn't in More, and the page's handler leaves other menus alone.
	const auto = new p.Element("button");
	auto.className = "studio-pdf-card-action studio-pdf-card-auto-refresh";
	card.appendChild(auto);
	details.open = true;
	p.fire(auto, "click");
	run(p);
	assert.equal(details.open, true);
});

test("Escape closes an open menu and keeps it from closing the view; a press outside closes it", () => {
	const p = page();
	const item = new p.Element("button");
	const details = p.createStudioPdfMoreMenu("focus", [item]);
	p.document.appendChild(details);
	const [summary] = details.children;
	details.open = true;
	const escape = p.fire(item, "keydown", { key: "Escape" });
	assert.equal(details.open, false);
	assert.equal(escape.defaultPrevented, true, "The enlarged view's own Escape doesn't also run.");
	assert.equal(p.focused.at(-1), summary);
	const closedEscape = p.fire(item, "keydown", { key: "Escape" });
	assert.equal(closedEscape.defaultPrevented, false, "Closed, Escape is the view's.");
	const pointer = p.document.listeners.find((entry) => entry.type === "pointerdown");
	assert.ok(pointer && pointer.capture);
	details.open = true;
	pointer.listener({ target: item });
	assert.equal(details.open, true, "A press inside leaves it open.");
	pointer.listener({ target: new p.Element("div") });
	assert.equal(details.open, false, "A press elsewhere closes it.");
});

test("focus leaving the menu closes it, and the enlarged view opens and closes with it closed (Sol's H2)", () => {
	const p = page();
	const inside = new p.Element("button");
	const details = p.createStudioPdfMoreMenu("focus", [inside]);
	const overlay = new p.Element("div");
	const fullscreen = new p.Element("button");
	overlay.appendChild(details);
	overlay.appendChild(fullscreen);
	p.document.appendChild(overlay);
	details.open = true;
	p.fire(inside, "focusout", { relatedTarget: details.children[0] });
	assert.equal(details.open, true, "Within the menu, it stays open.");
	p.fire(inside, "focusout", { relatedTarget: null });
	assert.equal(details.open, true, "Focus leaving the window, or a press on the menu's padding, leaves it open.");
	p.fire(inside, "focusout", { relatedTarget: fullscreen });
	assert.equal(details.open, false, "Tab past its last item to Fullscreen closes it, so Escape there is the view's.");
	// The view's own reset, as it opens and closes.
	details.open = true;
	p.setOverlay(overlay);
	p.closeStudioPdfFocusMoreMenus();
	assert.equal(details.open, false);
	assert.match(clientSource, /closeStudioPdfFocusMoreMenus\(\);\n\s+if \(studioPdfFocusOverlayEl\) studioPdfFocusOverlayEl\.hidden = false;/);
	assert.match(clientSource, /closeStudioPdfFocusMoreMenus\(\);\n\s+if \(studioPdfFocusOverlayEl\) studioPdfFocusOverlayEl\.hidden = true;/);
});

test("the menu opens under More, inside the card or view, above what's below", () => {
	assert.match(cssSource, /\.studio-pdf-more \{\s*position: relative;/);
	assert.match(cssSource, /\.studio-pdf-more-menu \{[^}]*position: absolute;[^}]*right: 0;[^}]*z-index: 30;/);
	assert.match(cssSource, /\.studio-pdf-more > summary::-webkit-details-marker \{\s*display: none;/);
	assert.match(clientSource, /document\.addEventListener\("click", handleStudioPreviewMediaActivation, true\);/, "The page installs the media handler as the test does.");
});

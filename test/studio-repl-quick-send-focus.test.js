import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Oliver, 19 Oct: after a Quick send the cursor goes back to the box, unless something
// else was chosen meanwhile. Sol and Astra held the first version on two races, so the
// page's own submit, settle, redraw and focus code runs here, with the redraw replacing the
// box as the page does, and frames and timers run in the order each test sets.
const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const slice = (from, to) => {
	const start = clientSource.indexOf(from);
	const end = clientSource.indexOf(to, start);
	assert.ok(start >= 0 && end > start, from);
	return clientSource.slice(start, end);
};

function page() {
	const context = { console };
	vm.runInNewContext([
		"class Element { constructor(name, { inBox = false, inControls = false } = {}) { this.name = name; this.inBox = inBox; this.inControls = inControls; }",
		"  closest(selector) { if (this.inBox && selector.includes('.repl-quick-composer')) return this; if (this.inControls && selector.includes('.repl-controls')) return this; return null; } }",
		"let currentBox = null;",
		"class HTMLTextAreaElement extends Element { constructor(disabled) { super('box', { inBox: true }); this.disabled = disabled; }",
		"  focus() { if (!this.disabled && this === currentBox) document.activeElement = this; } scrollIntoView() {} }",
		"const body = new Element('body'); const editor = new Element('editor'); const sendButton = new Element('send button', { inBox: true });",
		"const runtimeSelect = new Element('runtime select', { inControls: true });",
		"const document = { body, activeElement: body };",
		"const frames = []; const timers = [];",
		"const window = { requestAnimationFrame(callback) { frames.push(callback); return frames.length; }, setTimeout(callback) { timers.push(callback); return timers.length; } };",
		"let rightView = 'repl'; let traceRenderRaf = null; let replQuickFocusRequested = false;",
		"let replQuickPending = null; let replQuickRefocus = null; let replPendingRequestId = ''; let replBusy = false; let replRuntime = 'python';",
		"const replQuickDrafts = new Map(); let nextRequest = 0;",
		// The redraw rebuilds the REPL pane: a new box, disabled while a send runs, and focus
		// anywhere in the pane (the box, Send, the Runtime select) falls to the page.
		"function refreshResponseUi() { const active = document.activeElement; currentBox = new HTMLTextAreaElement(Boolean(replQuickPending) || replBusy); if (active && (active.inBox || active.inControls)) document.activeElement = body; }",
		"const critiqueViewEl = { querySelector(selector) { return selector === '[data-repl-quick-draft]' ? currentBox : null; } };",
		"function getActiveReplSessionForCurrentRuntime() { return { sessionName: 'pi-studio-repl-python' }; }",
		"function getReplQuickDraftKey() { return 'python'; } function getReplQuickDraft() { return replQuickDrafts.get('python') || ''; }",
		"function setStatus() {} function getReplRuntimeLabel() { return 'Python'; }",
		"function sendReplPayload() { nextRequest += 1; replPendingRequestId = 'req-' + nextRequest; replBusy = true; return replPendingRequestId; }",
		slice("      function settleReplQuickPending", "      function reconcileReplQuickPending"),
		slice("      function isReplControlFocused", "      function focusReplSessionControls"),
		slice("      function renderReplViewIfActive", "      function startReplPolling"),
		slice("      function submitReplQuickDraft", "      function renderTraceViewIfActive"),
		"refreshResponseUi();",
		"globalThis.api = {",
		"  get box() { return currentBox; }, get focus() { return document.activeElement === currentBox ? 'box' : document.activeElement.name; },",
		"  focusOn(name) { const target = name === 'box' ? currentBox : { body, editor, sendButton, runtimeSelect }[name]; cancelReplQuickRefocusOutside({ target }); document.activeElement = target; },",
		"  pointerDown(name) { cancelReplQuickRefocusOutside({ target: name === 'box' ? currentBox : { body, editor, sendButton, runtimeSelect }[name] }); },",
		"  dropFocus() { document.activeElement = body; }, focusWithoutEvent(name) { document.activeElement = { body, editor, sendButton, runtimeSelect }[name]; },",
		"  send(text) { replQuickDrafts.set('python', text); return submitReplQuickDraft() ? replPendingRequestId : null; },",
		"  settle(id, ok = true) { return settleReplQuickPending(id, ok); },",
		"  otherSend(id) { replPendingRequestId = id; replBusy = true; }, otherDone() { replPendingRequestId = ''; replBusy = false; renderReplViewIfActive({ force: true }); },",
		"  setView(view) { rightView = view; },",
		"  frames() { while (frames.length) frames.shift()(); }, timers() { while (timers.length) timers.shift()(); },",
		"};",
	].join("\n"), context);
	return context.api;
}

test("a slow send: the cursor is back in the box drawn after it finishes", () => {
	for (const from of ["box", "sendButton"]) {
		const p = page();
		p.focusOn(from);
		const id = p.send("import time; time.sleep(3)");
		p.frames(); // drawn disabled; focus falls to the page
		assert.equal(p.focus, "body");
		assert.equal(p.settle(id), true);
		p.frames();
		p.timers();
		assert.equal(p.focus, "box", from);
		assert.equal(p.box.disabled, false);
	}
});

test("a fast reply, before the box is redrawn: the cursor reaches the new box (Sol, Astra)", () => {
	const p = page();
	p.focusOn("box");
	const old = p.box;
	const id = p.send("x = 3");
	p.settle(id);
	p.timers();
	p.frames();
	p.timers();
	assert.notEqual(p.box, old);
	assert.equal(p.focus, "box");
});

test("the editor chosen after the send finishes but before the redraw keeps focus (Sol, Astra)", () => {
	const p = page();
	p.focusOn("box");
	const id = p.send("1 + 1");
	p.frames();
	p.settle(id);
	p.pointerDown("editor");
	p.focusOn("editor");
	p.frames();
	p.timers();
	assert.equal(p.focus, "editor");
});

test("focus that moved without an event Studio saw is still rechecked when the cursor would be restored", () => {
	const p = page();
	p.focusOn("box");
	const id = p.send("1 + 1");
	p.frames();
	p.settle(id);
	p.focusWithoutEvent("editor");
	p.frames();
	assert.equal(p.focus, "editor");
});

test("a control chosen during the send and then redrawn away doesn't hand focus back to the box (Sol)", () => {
	const p = page();
	p.focusOn("box");
	const id = p.send("1 + 1");
	p.frames();
	p.pointerDown("runtimeSelect");
	p.focusOn("runtimeSelect");
	p.dropFocus(); // the Runtime change redraws the select away
	p.settle(id);
	p.frames();
	p.timers();
	assert.equal(p.focus, "body");
});

test("a box kept disabled by another send gets the cursor once that send ends", () => {
	const p = page();
	p.focusOn("box");
	const id = p.send("1 + 1");
	p.frames();
	p.otherSend("agent-1");
	p.settle(id);
	p.frames();
	assert.equal(p.box.disabled, true);
	assert.equal(p.focus, "body");
	p.otherDone();
	p.frames();
	assert.equal(p.focus, "box");
});

test("no restore for a send not started from the box, or after leaving the REPL view", () => {
	const p = page();
	const id = p.send("1 + 1");
	p.settle(id);
	p.frames();
	assert.equal(p.focus, "body");

	const q = page();
	q.focusOn("box");
	const second = q.send("1 + 1");
	q.settle(second);
	q.setView("trace");
	q.frames();
	q.setView("repl");
	q.otherDone();
	q.frames();
	assert.notEqual(q.focus, "box");
});

test("a failed send restores too, and only its own answer counts", () => {
	const p = page();
	p.focusOn("box");
	const id = p.send("1/0");
	p.frames();
	assert.equal(p.settle("req-other"), false);
	p.frames();
	assert.equal(p.focus, "body");
	p.settle(id, false);
	p.frames();
	assert.equal(p.focus, "box");
});

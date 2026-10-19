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
		// Each redraw draws a pane for what is selected then; its box and buttons belong to it.
		"let drawnPane = null;",
		"class Element { constructor(name, { inBox = false, inControls = false } = {}) { this.name = name; this.inBox = inBox; this.inControls = inControls; this.pane = drawnPane; }",
		"  closest(selector) { if (selector === '[data-repl-drawn-target]') return this.pane; if (this.inBox && selector.includes('.repl-quick-composer')) return this; if (this.inControls && selector.includes('.repl-controls')) return this; return null; } }",
		"class Pane extends Element { constructor() { super('pane'); this.target = encodeURIComponent(getReplPaneTargetKey()); } getAttribute(name) { return name === 'data-repl-drawn-target' ? this.target : null; } }",
		"class Button extends Element { constructor(action) { super(action, action.startsWith('quick-') ? { inBox: true } : { inControls: true }); this.action = action; }",
		"  getAttribute(name) { return name === 'data-repl-action' ? this.action : null; }",
		"  closest(selector) { return selector === '[data-repl-action]' ? this : super.closest(selector); } }",
		"class CommandInput extends Element { constructor() { super('command input', { inControls: true }); this.runtime = replRuntime; this.value = ''; }",
		"  getAttribute(name) { return name === 'data-repl-command' ? this.runtime : null; }",
		"  closest(selector) { return selector === '[data-repl-command]' ? this : (selector.startsWith('[data-repl-') ? null : super.closest(selector)); } }",
		"let buttons = {}; let commandInput = null;",
		"let currentBox = null;",
		// The box keeps its text as a draft; a redraw makes a new one with that text, and
		// the cursor at the start, as a new textarea does.
		// Each box is drawn for the session lifetime selected then (lifetime below).
		"let lifetime = 'python-1';",
		"class HTMLTextAreaElement extends Element { constructor(disabled) { super('box', { inBox: true }); this.disabled = disabled; this.value = replQuickDrafts.get(lifetime) || ''; this.selectionStart = 0; this.selectionEnd = 0; this.selectionDirection = 'none'; this.scrollTop = 0; this.lifetime = lifetime; this.style = { height: '' }; }",
		"  hasAttribute(name) { return name === 'data-repl-quick-draft'; } getAttribute(name) { return name === 'data-repl-quick-lifetime' ? this.lifetime : null; }",
		"  closest(selector) { return selector === '[data-repl-quick-draft]' ? this : super.closest(selector); }",
		"  setSelectionRange(start, end, direction) { this.selectionStart = start; this.selectionEnd = end; this.selectionDirection = direction; }",
		"  focus() { if (!this.disabled && this === currentBox) document.activeElement = this; } scrollIntoView() {} }",
		"const body = new Element('body'); const editor = new Element('editor'); const sendButton = new Element('send button', { inBox: true });",
		"const runtimeSelect = new Element('runtime select', { inControls: true });",
		"const document = { body, activeElement: body };",
		"const frames = []; const timers = [];",
		"const window = { requestAnimationFrame(callback) { frames.push(callback); return frames.length; }, setTimeout(callback) { timers.push(callback); return timers.length; } };",
		"let rightView = 'repl'; let traceRenderRaf = null; let replQuickFocusRequested = false;",
		"let replQuickPending = null; let replQuickRefocus = null; let replPendingRequestId = ''; let replBusy = false; let replRuntime = 'python';",
		"let replRedrawDeferred = false; let replRedrawDeferredForce = false; let replRedrawForced = false; let replQuickBoxHeight = ''; let replRedrawRetryTimer = null; let replQuickComposing = false; let replQuickPointerDown = false; let replQuickLastInputAt = 0;",
		"const REPL_QUICK_TYPING_PAUSE_MS = 800; let now = 10_000; Date.now = () => now;",
		"const replQuickDrafts = new Map(); let nextRequest = 0;",
		// The redraw rebuilds the REPL pane: a new box, disabled while a send runs, and focus
		// anywhere in the pane (the box, Send, the Runtime select) falls to the page.
		"let redraws = 0;",
		"function refreshResponseUi() { redraws += 1; const active = document.activeElement; drawnPane = new Pane(); currentBox = new HTMLTextAreaElement(Boolean(replQuickPending) || replBusy);",
		"  buttons = Object.fromEntries(['quick-send', 'quick-clear', 'interrupt', 'stop-session', 'start', 'clear-journal'].map((action) => [action, new Button(action)])); commandInput = new CommandInput();",
		"  if (active && (active.inBox || active.inControls)) document.activeElement = body; }",
		"const critiqueViewEl = { querySelector(selector) { return selector === '[data-repl-quick-draft]' ? currentBox : null; } };",
		"let sessionName = 'pi-studio-repl-python'; function getActiveReplSessionForCurrentRuntime() { return { sessionName }; } function getActiveReplSession() { return getActiveReplSessionForCurrentRuntime(); }",
		"function normalizeReplRuntime(runtime) { return runtime; }",
		"let replError = ''; let replMessage = ''; const messages = []; const commandOverrides = {};",
		"function makeRequestId() { return 'request-' + (messages.length + 1); } function sendMessage(message) { messages.push(message); return true; } function syncActionButtons() {}",
		"function setReplCommandOverride(runtime, command) { commandOverrides[runtime] = command; }",
		"function getReplQuickDraftKey() { return lifetime; } function getReplQuickDraft() { return replQuickDrafts.get(lifetime) || ''; }",
		"const REPL_QUICK_DRAFT_MAX_CHARS = 20_000; const REPL_QUICK_DRAFT_MAX_SESSIONS = 12; function updateReplQuickComposerActions() {}",
		slice("      function setReplQuickDraft(session", "      function setReplQuickDraftForKey"),
		slice("      function setReplQuickDraftForKey", "      function settleReplQuickPending"),
		"let lastStatus = ''; function setStatus(message) { lastStatus = message; } function getReplRuntimeLabel() { return 'Python'; }",
		"function sendReplPayload() { nextRequest += 1; replPendingRequestId = 'req-' + nextRequest; replBusy = true; return replPendingRequestId; }",
		slice("      function settleReplQuickPending", "      function reconcileReplQuickPending"),
		slice("      function isReplControlFocused", "      function focusReplSessionControls"),
		slice("      function renderReplViewIfActive", "      function startReplPolling"),
		slice("      function submitReplQuickDraft", "      function renderTraceViewIfActive"),
		slice("      function handleReplPaneClick", "      function handleReplPaneFocusOut"),
		slice("      function handleReplPaneFocusOut", "      function handleReplPaneKeydown"),
		slice("      function handleReplPaneChange", "      function attachResponsePaneInteractionHandlers"),
		"refreshResponseUi();",
		"globalThis.api = {",
		"  get box() { return currentBox; }, get focus() { return document.activeElement === currentBox ? 'box' : document.activeElement.name; },",
		"  focusOn(name) { const target = name === 'box' ? currentBox : (name === 'commandInput' ? commandInput : { body, editor, sendButton, runtimeSelect }[name]); cancelReplQuickRefocusOutside({ target }); document.activeElement = target; },",
		"  pointerDown(name) { cancelReplQuickRefocusOutside({ target: name === 'box' ? currentBox : { body, editor, sendButton, runtimeSelect }[name] }); },",
		"  dropFocus() { document.activeElement = body; }, focusWithoutEvent(name) { document.activeElement = { body, editor, sendButton, runtimeSelect }[name]; },",
		"  send(text) { if (text !== undefined) replQuickDrafts.set(lifetime, text); return submitReplQuickDraft() ? replPendingRequestId : null; },",
		"  settle(id, ok = true) { return settleReplQuickPending(id, ok); },",
		"  otherSend(id) { replPendingRequestId = id; replBusy = true; }, otherDone() { replPendingRequestId = ''; replBusy = false; renderReplViewIfActive({ force: true }); },",
		"  setView(view) { rightView = view; },",
		// Typing in the box: the page saves a draft on every keystroke.
		"  type(text, start = text.length, end = start) { currentBox.value = text; replQuickDrafts.set(currentBox.lifetime, text); currentBox.selectionStart = start; currentBox.selectionEnd = end; currentBox.scrollTop = 40; },",
		// A keystroke through the page's own input handler.
		"  key(text) { currentBox.value = text; handleReplPaneInput({ target: currentBox }); },",
		"  draft(key) { return replQuickDrafts.get(key) || ''; }, setDraft(key, text) { replQuickDrafts.set(key, text); }, get sent() { return nextRequest; }, get timerCount() { return timers.length; },",
		"  get cursor() { return [currentBox.value, currentBox.selectionStart, currentBox.selectionEnd, currentBox.scrollTop]; },",
		"  get redraws() { return redraws; },",
		// A result or poll that changed the view, as the page's message handler asks for it.
		"  result() { renderReplViewIfActive(); },",
		"  composing(type) { handleReplPaneComposition({ type, target: currentBox }); },",
		// A keystroke, as the page's input handler notes it, and the clock.
		"  input() { replQuickLastInputAt = now; }, wait(ms) { now += ms; },",
		"  switchLifetime(next, name) { lifetime = next; if (name) sessionName = name; }, forced() { renderReplViewIfActive({ force: true }); },",
		// A click on a button of the pane on screen, and a Start cmd change, through the page's handlers.
		"  click(action) { handleReplPaneClick({ target: buttons[action], preventDefault() {} }); },",
		"  changeCommand(text) { commandInput.value = text; handleReplPaneChange({ target: commandInput }); },",
		"  setRuntime(runtime) { replRuntime = runtime; }, get commandOverrides() { return JSON.stringify(commandOverrides); },",
		"  get status() { return lastStatus; }, get messages() { return JSON.stringify(messages); },",
		"  pointer(type, name) { handleReplQuickPointer({ type, target: name === 'box' ? currentBox : editor }); },",
		"  leave(name) { cancelReplQuickRefocusOutside({ target: { body, editor }[name] }); document.activeElement = { body, editor }[name]; handleReplPaneFocusOut(); },",
		"  frames() { while (frames.length) frames.shift()(); }, timers() { for (const timer of timers.splice(0)) timer(); },",
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

// Oliver, 19 Oct (0.10.5): since 0.10.3 the cursor stays in the box after a Quick send, and a
// redraw that wasn't forced was skipped while it was there, so the record never showed the
// result. The box can now be redrawn under the cursor; other controls wait, then redraw.
test("a result that arrives while the cursor is in the box is shown, and the cursor stays put", () => {
	const p = page();
	p.focusOn("box");
	p.type("print(2)", 3, 5);
	const before = p.redraws;
	p.result();
	p.frames();
	assert.equal(p.redraws, before + 1, "redrawn");
	assert.equal(p.focus, "box");
	assert.deepEqual([...p.cursor], ["print(2)", 3, 5, 40], "text, selection and scroll kept");
});

test("while a character is being composed, the redraw waits until composing ends", () => {
	const p = page();
	p.focusOn("box");
	p.type("caf", 3);
	p.composing("compositionstart");
	const before = p.redraws;
	p.result();
	p.frames();
	assert.equal(p.redraws, before, "not while composing");
	p.type("café", 4);
	p.composing("compositionend");
	p.frames();
	assert.equal(p.redraws, before + 1, "once composing ends");
	assert.equal(p.focus, "box");
	assert.deepEqual([...p.cursor], ["café", 4, 4, 40]);
});

test("a redraw that waits for another REPL control runs once focus leaves it", () => {
	for (const control of ["runtimeSelect", "sendButton"]) {
		const p = page();
		p.focusOn(control);
		const before = p.redraws;
		p.result();
		p.frames();
		assert.equal(p.redraws, before, `${control}: not while it has focus`);
		p.leave("editor");
		p.timers();
		p.frames();
		assert.equal(p.redraws, before + 1, `${control}: once focus has left`);
		assert.equal(p.focus, "editor");
	}
});

test("leaving a control with no waiting redraw doesn't redraw", () => {
	const p = page();
	p.focusOn("runtimeSelect");
	const before = p.redraws;
	p.leave("editor");
	p.timers();
	p.frames();
	assert.equal(p.redraws, before);
});

test("while typing in the box, a redraw waits for a pause, then runs", () => {
	const p = page();
	p.focusOn("box");
	p.type("prin", 4);
	p.input();
	const before = p.redraws;
	p.wait(100);
	p.result();
	p.frames();
	assert.equal(p.redraws, before, "not mid-typing");
	p.type("print", 5);
	p.input();
	p.wait(500);
	p.timers(); // the retry finds typing still going on, and waits again
	p.frames();
	assert.equal(p.redraws, before);
	p.wait(900);
	p.timers();
	p.frames();
	assert.equal(p.redraws, before + 1, "after a pause");
	assert.equal(p.focus, "box");
	assert.deepEqual([...p.cursor], ["print", 5, 5, 40]);
});

test("a drag that starts in the box: the redraw waits for the button to come up", () => {
	const p = page();
	p.focusOn("box");
	p.type("print(1)", 2, 6);
	p.pointer("pointerdown", "box");
	const before = p.redraws;
	p.result();
	p.frames();
	assert.equal(p.redraws, before, "not mid-drag");
	p.pointer("pointerup", "editor");
	p.frames();
	assert.equal(p.redraws, before + 1, "once the button is up");
	assert.deepEqual([...p.cursor], ["print(1)", 2, 6, 40]);
	// A press elsewhere is no drag in the box.
	p.pointer("pointerdown", "editor");
	p.result();
	p.frames();
	assert.equal(p.redraws, before + 2);
});

// Sol and Astra (round 1): the checks ran only when a redraw was asked for. Composing,
// typing, a drag or focus elsewhere that starts before its frame runs now holds it too.
test("a redraw already queued waits if composing, typing, a drag or another control starts first", () => {
	for (const [what, start, end] of [
		["composing", (p) => p.composing("compositionstart"), (p) => p.composing("compositionend")],
		["typing", (p) => p.input(), (p) => { p.wait(900); p.timers(); }],
		["a drag", (p) => p.pointer("pointerdown", "box"), (p) => p.pointer("pointerup", "editor")],
		["the Runtime select", (p) => p.focusOn("runtimeSelect"), (p) => { p.leave("editor"); p.timers(); }],
	]) {
		const p = page();
		p.focusOn("box");
		p.type("caf", 3);
		const before = p.redraws;
		p.result(); // queued while the box is idle
		start(p);
		p.frames();
		assert.equal(p.redraws, before, `${what}: not when the frame runs`);
		end(p);
		p.frames();
		assert.equal(p.redraws, before + 1, `${what}: once it ends`);
	}
});

test("composing holds a forced redraw too, and the redraw stays forced", () => {
	const p = page();
	p.focusOn("box");
	p.composing("compositionstart");
	const before = p.redraws;
	p.forced();
	p.frames();
	assert.equal(p.redraws, before);
	// Still forced when it runs: focus in the Runtime select doesn't hold it then.
	p.focusOn("runtimeSelect");
	p.composing("compositionend");
	p.frames();
	assert.equal(p.redraws, before + 1);
});

test("the cursor goes back only into the box for the same session lifetime (Astra)", () => {
	const p = page();
	p.focusOn("box");
	p.type("alpha.", 6);
	p.switchLifetime("python-2"); // the next box is for another session, or a replacement
	p.forced();
	p.frames();
	assert.equal(p.focus, "body", "focus isn't carried into another session's box");
	const q = page();
	q.focusOn("box");
	q.type("alpha.", 2);
	q.forced();
	q.frames();
	assert.equal(q.focus, "box", "same lifetime: the cursor comes back");
	assert.deepEqual([...q.cursor], ["alpha.", 2, 2, 40]);
});

// Astra (round 2): composing holds even a forced redraw, so a session chosen elsewhere meanwhile
// left the old box on screen while typing and sending followed the new selection.
test("a box left on screen for another session keeps its text with its own session, and doesn't send", () => {
	const p = page();
	p.setDraft("python-2", "beta.");
	p.focusOn("box");
	p.key("alpha.");
	p.composing("compositionstart");
	p.switchLifetime("python-2"); // selected elsewhere
	p.forced();
	p.frames();
	p.key("alpha.日本"); // the IME updates the old box
	assert.equal(p.draft("python-1"), "alpha.日本", "the old box's session keeps its text");
	assert.equal(p.draft("python-2"), "beta.", "the selected session's draft is untouched");
	p.composing("compositionend");
	const sent = p.sent;
	assert.equal(p.send(), null, "Cmd/Ctrl+Enter before the redraw sends nothing");
	assert.equal(p.sent, sent);
	p.frames();
	assert.equal(p.box.lifetime, "python-2", "then the redraw shows the selected session");
	assert.equal(p.box.value, "beta.");
	assert.equal(p.focus, "body");
});

test("in the box for the selected session, typing and sending work as before", () => {
	const p = page();
	p.focusOn("box");
	p.key("x = 1");
	assert.equal(p.draft("python-1"), "x = 1");
	assert.ok(p.send(), "sent");
});

test("while composing or dragging, a waiting redraw sets no timer: their end events run it (Sol)", () => {
	for (const [start, end] of [
		[(p) => p.composing("compositionstart"), (p) => p.composing("compositionend")],
		[(p) => p.pointer("pointerdown", "box"), (p) => p.pointer("pointerup", "editor")],
	]) {
		const p = page();
		p.focusOn("box");
		start(p);
		const before = p.redraws;
		p.result();
		p.frames();
		assert.equal(p.timerCount, 0, "no timer");
		end(p);
		p.frames();
		assert.equal(p.redraws, before + 1);
	}
});

// Sol and Astra (round 3): the pane left on screen had other controls that acted on the
// newly selected session. Clear deleted its draft, and Interrupt was sent to it.
test("no control in a pane left on screen for another session does anything, and the redraw shows that session", () => {
	for (const [what, name] of [["another session", "pi-repl-python"], ["a replacement with the same name", undefined]]) {
		const p = page();
		p.setDraft("python-2", "beta.");
		p.focusOn("box");
		p.key("alpha.");
		p.composing("compositionstart");
		p.switchLifetime("python-2", name); // selected elsewhere
		p.forced();
		p.frames(); // held by composing
		p.composing("compositionend"); // pressing a button ends it; the redraw's frame hasn't run
		for (const action of ["quick-clear", "interrupt", "stop-session", "start", "clear-journal", "quick-send"]) {
			p.click(action);
			assert.equal(p.status, action === "quick-send" ? "The REPL session changed, so nothing was sent." : "The REPL session changed, so nothing was done.", `${what}: ${action}`);
		}
		assert.equal(p.draft("python-1"), "alpha.", `${what}: the old box's session keeps its text`);
		assert.equal(p.draft("python-2"), "beta.", `${what}: the selected session's draft is untouched`);
		assert.equal(p.messages, "[]", `${what}: nothing sent`);
		assert.equal(p.sent, 0);
		p.frames();
		assert.equal(p.box.lifetime, "python-2", `${what}: then the redraw shows the selected session`);
		assert.equal(p.box.value, "beta.");
	}
});

test("in the pane for the selected session, Clear and Interrupt work as before", () => {
	const p = page();
	p.setDraft("python-2", "beta.");
	p.focusOn("box");
	p.key("alpha.");
	p.click("quick-clear");
	assert.equal(p.draft("python-1"), "");
	assert.equal(p.draft("python-2"), "beta.");
	p.frames();
	p.click("interrupt");
	assert.equal(p.messages, JSON.stringify([{ type: "repl_interrupt_request", requestId: "request-1", sessionName: "pi-studio-repl-python" }]));
});

test("a Start cmd typed while another runtime was selected is kept for the runtime it was typed for", () => {
	const p = page();
	p.focusOn("commandInput");
	p.setRuntime("julia"); // selected elsewhere
	p.result();
	p.frames(); // waits: the cursor is in the Start cmd box
	p.changeCommand("uv run python");
	assert.equal(p.commandOverrides, JSON.stringify({ python: "uv run python" }));
});

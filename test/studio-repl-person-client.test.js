import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { validatePersonName } from "../shared/repl-person.js";
import { describeReplEntrySender } from "../shared/studio-repl-activity.js";

// Candidate 112: the name a page's sends and notes are recorded under ("Sending as …"), as
// pi-repl's shared protocol has it ("People's sends"). The page's own functions run here
// unchanged, with the DOM, storage and frames stubbed.
const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const slice = (from, to) => {
	const start = clientSource.indexOf(from);
	const end = clientSource.indexOf(to, start);
	assert.ok(start >= 0 && end > start, from);
	return clientSource.slice(start, end);
};
const personFunctions = slice("      // pi-repl's rule for a person's name", "      function createReplJournalEntry");

function storage(initial = {}, { failing = false } = {}) {
	const items = new Map(Object.entries(initial));
	const check = () => { if (failing) throw new Error("storage unavailable"); };
	return {
		items,
		getItem(key) { check(); return items.has(key) ? items.get(key) : null; },
		setItem(key, value) { check(); items.set(key, String(value)); },
		removeItem(key) { check(); items.delete(key); },
	};
}

function personPage(localStorage = storage()) {
	const context = { console, window: { localStorage, crypto: webcrypto } };
	vm.runInNewContext([
		"const REPL_PERSON_NAME_STORAGE_KEY = 'piStudio.replPersonName.v1';",
		personFunctions,
		"let replPersonName = loadReplPersonName(); let replPersonNameDefault = 'User';",
		"globalThis.api = { validateReplPersonName, describeReplEntrySender, makeReplPersonRequestId, makeReplPersonUuid, isReplEntryOfRequest, chooseReplPersonName, getReplSenderName,",
		"  setDefault(name) { replPersonNameDefault = name; } };",
	].join("\n"), context);
	return context.api;
}

// Objects from the page's realm, copied into this one for deep comparison.
const plain = (value) => JSON.parse(JSON.stringify(value));

test("the page checks a name as pi-repl does", () => {
	const page = personPage();
	const cases = [
		"Ana", "  Ana  ", "", "   ", "\t", "Ana Lee", "Zoë", "李", "👩‍🔬", "a".repeat(80), "a".repeat(81), "😀".repeat(80), "😀".repeat(81),
		` ${"a".repeat(80)} `, "a\nb", "a\rb", "a\tb", "a\u0000b", "a\u007fb", "a\u0085b", "a b", "a b", "a‮b", "a⁦b", "a‎b", "a؜b",
		"a b", "a​b", null, undefined, 3, {}, ["Ana"],
	];
	for (const value of cases) assert.deepEqual(plain(page.validateReplPersonName(value)), validatePersonName(value), JSON.stringify(value));
});

test("the page names who sent an entry as Studio tells its agent", () => {
	const page = personPage();
	const labels = ["Sam", "", "  ", undefined, "Sam\n‮evil", "x".repeat(200), "/repl send", "selection", "Claude Code"];
	const routes = [
		["pi:send:1", "pi-repl"], ["pi:env:1", "pi-repl"], ["cli:send:1", "pi-repl"], ["cli:env:1", "pi-repl"],
		["studio:send:1", "pi-studio"], ["studio:note:1", "pi-studio"],
		// A prefix on the other origin, an older route, and none.
		["pi:send:1", "pi-studio"], ["studio:send:1", "pi-repl"], ["command:send:1", "pi-repl"], ["tool:mcp-1", "pi-repl"], ["c74-1", "pi-studio"], ["", "pi-studio"], [undefined, "pi-repl"],
	];
	for (const mode of ["raw", "literate", "agent"]) {
		for (const label of labels) {
			for (const [requestId, origin] of routes) {
				const entry = { mode, label, origin, requestId };
				assert.equal(page.describeReplEntrySender(entry), describeReplEntrySender(entry), JSON.stringify(entry));
			}
		}
	}
});

test("a person's request ID is Studio's prefix and a version 4 UUID, and a send's entry is found by it", () => {
	const page = personPage();
	const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
	const seen = new Set();
	for (let index = 0; index < 200; index += 1) {
		const send = page.makeReplPersonUuid();
		const note = page.makeReplPersonRequestId("note");
		assert.match(send, uuid);
		assert.match(note, /^studio:note:/);
		assert.match(note.slice("studio:note:".length), uuid);
		seen.add(send).add(note);
	}
	assert.equal(seen.size, 400);
	// Studio's server takes the same form for a request ID (isValidRequestId in index.ts).
	assert.match(page.makeReplPersonUuid(), /^[a-zA-Z0-9_-]{1,120}$/);
	const id = page.makeReplPersonUuid();
	assert.equal(page.isReplEntryOfRequest({ requestId: `studio:send:${id}` }, id), true);
	assert.equal(page.isReplEntryOfRequest({ requestId: id }, id), true, "an entry from before names");
	assert.equal(page.isReplEntryOfRequest({ requestId: `studio:note:${id}` }, id), false);
	assert.equal(page.isReplEntryOfRequest({ requestId: "" }, ""), false);
});

test("a chosen name is kept in this browser and read once; an empty one goes back to the default", () => {
	const key = "piStudio.replPersonName.v1";
	const saved = storage({ [key]: "  Ana " });
	let page = personPage(saved);
	assert.equal(page.getReplSenderName(), "Ana");
	assert.deepEqual(plain(page.chooseReplPersonName(" Bo ")), { name: "Bo" });
	assert.equal(saved.items.get(key), "Bo");
	assert.deepEqual(plain(page.chooseReplPersonName("a‮b")), { error: "the name has control characters" });
	assert.equal(page.getReplSenderName(), "Bo", "an unusable name changes nothing");
	assert.equal(saved.items.get(key), "Bo");
	page.setDefault("Sam");
	assert.deepEqual(plain(page.chooseReplPersonName("  ")), { name: "Sam" });
	assert.equal(saved.items.has(key), false);

	// Another tab's later choice doesn't reach a page already open.
	page = personPage(saved);
	saved.setItem(key, "Cy");
	assert.equal(page.getReplSenderName(), "User");
	// A stored name that isn't usable is ignored, and storage that fails leaves the name for this page.
	assert.equal(personPage(storage({ [key]: "a\nb" })).getReplSenderName(), "User");
	page = personPage(storage({}, { failing: true }));
	assert.deepEqual(plain(page.chooseReplPersonName("Di")), { name: "Di" });
	assert.equal(page.getReplSenderName(), "Di");
});

// The name field, drawn and redrawn as the page draws it (renderReplView): each redraw replaces
// the field and ✎, and focus in what it replaced falls to the page.
function editorPage({ name = "", fallback = "User" } = {}) {
	const context = { console };
	const key = "piStudio.replPersonName.v1";
	context.localStorage = storage(name ? { [key]: name } : {});
	vm.runInNewContext([
		"class Element { constructor(name) { this.name = name; this.connected = true; } get isConnected() { return this.connected; }",
		"  closest(selector) { return selector.includes('.repl-quick-composer') ? this : null; } }",
		"class HTMLElement extends Element { focus() { if (this.connected) document.activeElement = this; } }",
		"class HTMLTextAreaElement extends HTMLElement {}",
		"class HTMLInputElement extends HTMLElement { constructor(value) { super('name field'); this.value = value; this.selected = false; this.selectionStart = 0; this.selectionEnd = 0; this.selectionDirection = 'none'; }",
		"  hasAttribute(name) { return name === 'data-repl-sender-name'; } select() { this.selected = true; this.setSelectionRange(0, this.value.length); }",
		"  setSelectionRange(start, end, direction = 'none') { this.selectionStart = start; this.selectionEnd = end; this.selectionDirection = direction; } }",
		"class EditButton extends HTMLElement { constructor() { super('edit'); } getAttribute(name) { return name === 'data-repl-action' ? 'sender-edit' : null; }",
		"  closest(selector) { return selector === '[data-repl-action]' ? this : super.closest(selector); } }",
		"const body = new Element('body'); const editor = new Element('editor'); const document = { body, activeElement: body };",
		"const frames = []; const timers = [];",
		"const window = { localStorage, crypto: {}, requestAnimationFrame(callback) { frames.push(callback); return frames.length; }, setTimeout(callback) { timers.push(callback); return timers.length; } };",
		"const REPL_PERSON_NAME_STORAGE_KEY = 'piStudio.replPersonName.v1';",
		personFunctions,
		slice("      function escapeHtml", "      function escapeRegExp"),
		"let replPersonName = loadReplPersonName();",
		`let replPersonNameDefault = ${JSON.stringify(fallback)}; let replPersonNameSource = 'setting'; let replSenderEditing = false; let replSenderReturnFocus = false;`,
		"let rightView = 'repl'; let traceRenderRaf = null; let replQuickFocusRequested = false; let replQuickRefocus = null;",
		"let replRedrawDeferred = false; let replRedrawDeferredForce = false; let replRedrawForced = false; let replRedrawRetryTimer = null;",
		"let replQuickComposing = false; let replQuickPointerDown = false; let replQuickLastInputAt = 0; const REPL_QUICK_TYPING_PAUSE_MS = 800;",
		"let lastStatus = ''; function setStatus(message) { lastStatus = message; } function applyReplQuickRefocus() {}",
		"let field = null; let edit = null; let row = null; let shown = ''; let redraws = 0;",
		"function unescapeHtml(text) { return text.replace(/&#39;/g, \"'\").replace(/&quot;/g, '\"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&'); }",
		// The pane's HTML, as the page sets it: what it replaced is gone, and focus in it falls to the page.
		"const critiqueViewEl = { scrollTop: 0, scrollHeight: 0, classList: { remove() {} },",
		"  set innerHTML(html) { const active = document.activeElement; for (const element of [field, edit]) if (element) element.connected = false; field = null; edit = null; row = null;",
		"    if (html.includes('data-repl-sender-name')) field = new HTMLInputElement(unescapeHtml(html.match(/value='([^']*)'/)[1]));",
		"    else { edit = new EditButton(); const name = unescapeHtml(html.match(/data-repl-sender-shown='([^']*)'/)[1]); row = { getAttribute: (attribute) => attribute === 'data-repl-sender-shown' ? name : null }; }",
		"    shown = html.replace(/<[^>]*>/g, '').replace('✎', '');",
		"    if (active instanceof Element && !active.isConnected) document.activeElement = body; },",
		"  querySelector(selector) { return { '[data-repl-sender-name]': field, \"[data-repl-action='sender-edit']\": edit, '[data-repl-sender-shown]': row }[selector] || null; } };",
		"function shouldAutoStickReplView() { return false; } function finishPreviewRender() {} function scheduleResponsePaneRepaintNudge() {} function buildReplPanelHtml() { return buildReplSenderHtml(); }",
		slice("      function renderReplView() {", "      function getFileBrowserContextKey"),
		// Every redraw of the response pane, waited for or not, ends in renderReplView (refreshResponseUi → renderActiveResult).
		"function refreshResponseUi() { redraws += 1; renderReplView(); }",
		slice("      function isReplControlFocused", "      function focusReplSessionControls"),
		slice("      function renderReplViewIfActive", "      function startReplPolling"),
		slice('      // "Sending as …"', "      function buildReplQuickComposerHtml"),
		slice("      function handleReplPaneClick", "      function handleReplPaneFocusOut"),
		slice("      function handleReplPaneFocusOut", "      function handleReplPaneKeydown"),
		slice("      function handleReplPaneKeydown", "      function handleReplPaneChange"),
		"refreshResponseUi();",
		"globalThis.api = {",
		"  get shown() { return shown; }, get field() { return field; }, get status() { return lastStatus; }, get redraws() { return redraws; },",
		"  get focus() { return document.activeElement.name; }, get stored() { return localStorage.items.get(REPL_PERSON_NAME_STORAGE_KEY) ?? null; },",
		"  get editing() { return replSenderEditing; }, get deferred() { return replRedrawDeferred; },",
		"  clickEdit() { edit.focus(); handleReplPaneClick({ target: edit, preventDefault() {} }); },",
		"  type(text, cursor = text.length) { field.value = text; field.setSelectionRange(cursor, cursor); handleReplPaneInput({ target: field }); },",
		"  get cursor() { return [field.selectionStart, field.selectionEnd]; }, get sendsAs() { return getShownReplSenderName(); },",
		// A response that redraws the pane at once, as response_history's handler does, without asking to.
		"  respond() { refreshResponseUi(); },",
		"  key(key) { const event = { key, target: document.activeElement, isComposing: false, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } }; handleReplPaneKeydown(event); return event; },",
		// Focus moving to the editor: the field reports focusout once it has lost focus.
		"  leave() { const target = document.activeElement; document.activeElement = editor; handleReplPaneFocusOut({ target }); },",
		// A result or poll arriving, as the page's message handlers ask for a redraw.
		"  result(force = false) { renderReplViewIfActive(force ? { force: true } : undefined); },",
		"  frames() { while (frames.length) frames.shift()(); for (const timer of timers.splice(0)) timer(); },",
		"};",
	].join("\n"), context);
	return context.api;
}

test("✎ opens the name field; Enter keeps a new name, closes the field and puts the cursor back on ✎", () => {
	const page = editorPage();
	assert.equal(page.shown, "Sending as User");
	page.clickEdit();
	page.frames();
	assert.equal(page.focus, "name field");
	assert.equal(page.field.value, "User");
	assert.equal(page.field.selected, true, "the name is selected, to type over");
	page.type("  Ana Lee ");
	const event = page.key("Enter");
	assert.equal(event.prevented && event.stopped, true);
	page.frames();
	assert.equal(page.shown, "Sending as Ana Lee");
	assert.equal(page.focus, "edit");
	assert.equal(page.stored, "Ana Lee");
	assert.equal(page.status, "Sending as Ana Lee.");
});

test("Esc leaves the name as it was; leaving the field keeps what's in it", () => {
	let page = editorPage({ name: "Ana" });
	page.clickEdit();
	page.frames();
	page.type("Bo");
	page.key("Escape");
	page.frames();
	assert.equal(page.shown, "Sending as Ana");
	assert.equal(page.stored, "Ana");
	assert.equal(page.focus, "edit");

	page = editorPage({ name: "Ana" });
	page.clickEdit();
	page.frames();
	page.type("Bo");
	page.leave();
	page.frames();
	assert.equal(page.shown, "Sending as Bo");
	assert.equal(page.stored, "Bo");
	assert.equal(page.focus, "editor", "the cursor stays where it went");
});

test("an empty name goes back to Studio's default", () => {
	const page = editorPage({ name: "Ana", fallback: "Sam" });
	page.clickEdit();
	page.frames();
	assert.equal(page.field.value, "Ana");
	page.type("   ");
	page.key("Enter");
	page.frames();
	assert.equal(page.shown, "Sending as Sam");
	assert.equal(page.stored, null);
});

test("an unusable name keeps the field open and says why; leaving it then changes nothing", () => {
	const page = editorPage({ name: "Ana" });
	page.clickEdit();
	page.frames();
	page.type("Ana‮evil");
	page.key("Enter");
	page.frames();
	assert.equal(page.editing, true);
	assert.equal(page.focus, "name field");
	assert.equal(page.status, "Name not changed: the name has control characters.");
	page.type("x".repeat(81));
	page.leave();
	page.frames();
	assert.equal(page.editing, false);
	assert.equal(page.shown, "Sending as Ana");
	assert.equal(page.stored, "Ana");
	assert.equal(page.status, "Name not changed: the name is longer than 80 characters.");
});

test("a result that arrives while the name field is open waits for it, even a forced redraw", () => {
	const page = editorPage();
	page.clickEdit();
	page.frames();
	page.type("Ana");
	const before = page.redraws;
	page.result();
	page.result(true);
	page.frames();
	assert.equal(page.redraws, before, "not redrawn under the field");
	assert.equal(page.deferred, true);
	assert.equal(page.focus, "name field");
	assert.equal(page.field.value, "Ana", "what was typed is still there");
	page.key("Enter");
	page.frames();
	assert.equal(page.redraws, before + 1);
	assert.equal(page.deferred, false);
	assert.equal(page.shown, "Sending as Ana");
});

test("a response that redraws the pane without waiting keeps what's typed in the name field, and the cursor (Sol)", () => {
	const page = editorPage({ name: "Ana" });
	page.clickEdit();
	page.frames();
	page.type("Beatrice", 3);
	page.respond();
	assert.equal(page.editing, true);
	assert.equal(page.field.value, "Beatrice");
	assert.equal(page.focus, "name field");
	assert.deepEqual([...page.cursor], [3, 3]);
	assert.equal(page.shown, "Sending as ");
	page.key("Enter");
	page.frames();
	assert.equal(page.shown, "Sending as Beatrice");
	assert.equal(page.stored, "Beatrice");
	// Closed, it takes no focus back.
	page.respond();
	assert.equal(page.editing, false);
	assert.notEqual(page.focus, "name field");
});

// The page's send and note: what it records locally and what it asks Studio's server to record.
function sendPage({ name = "Ana" } = {}) {
	const context = { console, window: { localStorage: storage(name ? { "piStudio.replPersonName.v1": name } : {}), crypto: webcrypto } };
	vm.runInNewContext([
		"const REPL_PERSON_NAME_STORAGE_KEY = 'piStudio.replPersonName.v1';",
		personFunctions,
		"let replPersonName = loadReplPersonName(); let replPersonNameDefault = 'User';",
		"let rightView = 'repl'; let shownRow = null; const critiqueViewEl = { querySelector(selector) { return selector === '[data-repl-sender-shown]' ? shownRow : null; } };",
		"let replRuntime = 'python'; let replBusy = false; let replPendingRequestId = ''; let activeReplJournalEntryId = ''; let replTranscript = '>>> '; let replEchoMode = 'summary';",
		"let replJournalEntries = []; let replError = ''; let replMessage = ''; let nextEntry = 0; const sent = []; const synced = [];",
		"function getActiveReplSessionForCurrentRuntime() { return { sessionName: 'pi-studio-repl-python' }; } function getActiveReplRuntime() { return 'python'; } function getReplRuntimeLabel() { return 'Python'; }",
		"function addReplJournalEntry(details) { const entry = { id: 'pi-studio:local:' + (++nextEntry), origin: 'pi-studio', createdAt: 1, ...details }; replJournalEntries = [...replJournalEntries, entry]; return entry; }",
		"function syncReplJournalEntry(entry) { synced.push(entry); } function sendMessage(message) { sent.push(message); return true; }",
		"function setStatus() {} function syncActionButtons() {} function renderReplViewIfActive() {} function persistReplJournalEntries() {} function settleReplQuickPending() {} function mergeReplJournalEntries() { return false; }",
		slice("      function sendReplPayload", "      function sendEditorTextToRepl"),
		"function handle(message) {",
		slice('        if (message.type === "repl_send_ack") {', '        if (message.type === "prompt_submitted") {'),
		"}",
		"function fail(message) {",
		slice("          const failedReplRequestId", "          if (bufferSwitchingEnabled && pendingKind"),
		"}",
		"globalThis.api = { sendReplPayload, handle, fail, get sent() { return sent; }, get synced() { return synced; }, get entries() { return replJournalEntries; }, release() { replBusy = false; replPendingRequestId = ''; },",
		"  show(name) { shownRow = name === null ? null : { getAttribute: (attribute) => attribute === 'data-repl-sender-shown' ? name : null }; },",
		"  setDefault(name) { replPersonNameDefault = name; }, setView(view) { rightView = view; } };",
	].join("\n"), context);
	return context.api;
}

test("a page's send asks to be recorded under the name shown, with its own studio:send: ID", () => {
	const page = sendPage();
	const requestId = page.sendReplPayload({ text: "print(1)", label: "selection", mode: "raw" });
	const [message] = plain(page.sent);
	assert.equal(message.requestId, requestId);
	assert.equal(message.personName, "Ana");
	const [entry] = plain(page.entries);
	assert.equal(entry.requestId, `studio:send:${requestId}`);
	assert.equal(entry.label, "Ana");
	assert.equal(message.journalEntryId, entry.id);
	// Until Studio's server records it, the card already shows the name.
	assert.equal(describeReplEntrySender(entry), "Ana · via Pi Studio");
	page.handle({ type: "repl_send_ack", requestId });
	assert.equal(page.entries[0].status, "sent");

	page.release();
	const failed = page.sendReplPayload({ text: "print(2)", label: "selection", mode: "raw" });
	page.fail({ type: "error", requestId: failed, message: "Nothing was sent: the name has control characters." });
	assert.equal(page.entries[1].status, "error");
	assert.equal(page.entries[1].output, "Nothing was sent: the name has control characters.");
});

test("a page's note is recorded under the name shown, with a studio:note: ID from when it's made", () => {
	const page = sendPage({ name: "Bo" });
	page.sendReplPayload({ noteOnly: true, prose: "why this cell", label: "note", mode: "literate" });
	const [entry] = plain(page.synced);
	assert.match(entry.requestId, /^studio:note:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
	assert.equal(entry.label, "Bo");
	assert.equal(describeReplEntrySender(entry), "Bo · via Pi Studio");
});

test("sends and notes are recorded under the name on screen, even while a new default waits to be drawn (Astra, Sol)", () => {
	const page = sendPage({ name: "" });
	page.setDefault("Ana");
	page.show("Sam");
	page.sendReplPayload({ text: "print(1)", label: "selection", mode: "raw" });
	page.release();
	page.sendReplPayload({ noteOnly: true, prose: "why", mode: "literate" });
	assert.deepEqual([page.sent[0].personName, page.entries[0].label, page.synced[0].label], ["Sam", "Sam", "Sam"]);
	// With no row on screen (another view, or the name field open), the name now.
	page.setView("files");
	page.sendReplPayload({ text: "print(2)", label: "selection", mode: "raw" });
	page.release();
	page.setView("repl");
	page.show(null);
	page.sendReplPayload({ text: "print(3)", label: "selection", mode: "raw" });
	page.release();
	// A row with an unusable name isn't one.
	page.show("Sam\u202e");
	page.sendReplPayload({ text: "print(4)", label: "selection", mode: "raw" });
	assert.deepEqual(plain(page.sent.slice(1).map((message) => message.personName)), ["Ana", "Ana", "Ana"]);
});

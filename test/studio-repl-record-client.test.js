import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Candidate 114: the page's record actions follow Studio's reading of a session's record
// (pi-repl's P0, Sol and Astra's notes on c113). The page's own functions and message
// handlers run here unchanged, with the DOM, clipboard and editor stubbed.
const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const slice = (from, to) => {
	const start = clientSource.indexOf(from);
	const end = clientSource.indexOf(to, start);
	assert.ok(start >= 0 && end > start, from);
	return clientSource.slice(start, end);
};

function page({ connected = true } = {}) {
	const context = { console };
	vm.runInNewContext([
		"let replActiveSessionName = 'pi-repl-python'; let replSessions = []; let rightView = 'repl'; let replJournalCollapsed = false;",
		"let replJournalEntries = []; let activeReplJournalEntryId = ''; const replJournalClearRequests = new Map(); const replJournalImportPendingSessions = new Set();",
		`const connected = ${connected}; const sent = []; const statuses = []; const copied = []; const exported = []; const loaded = []; let nextRequest = 0;`,
		"function setStatus(message, kind) { statuses.push([message, kind]); } function persistReplJournalEntries() {} function renderReplViewIfActive() {} function mergeReplJournalEntries() { return false; }",
		"function sendMessage(message) { if (!connected) return false; sent.push(message); return true; } function makeRequestId() { return 'request-' + (++nextRequest); }",
		"function buildReplJournalMarkdown(entries) { return entries.map((entry) => entry.id).join(','); }",
		"async function writeTextToClipboard(text) { copied.push(text); return true; }",
		"class Blob { constructor(parts) { this.text = parts.join(''); } } const URL = { createObjectURL(blob) { exported.push(blob.text); return 'blob:1'; }, revokeObjectURL() {} };",
		"const document = { body: { appendChild() {} }, createElement() { return { click() {}, remove() {} }; } }; const window = { setTimeout() {} };",
		"let documentHostingEnabled = false; function setEditorText(text) { loaded.push(text); } function setSourceState() {} function setEditorLanguage() {}",
		slice("      function getActiveReplJournalSessionName()", "      function getHiddenReplJournalEntryCount"),
		slice("      async function copyReplJournalToClipboard()", "      function addSelectedReplJournalNote"),
		"function handle(message) {",
		slice("        // This page's clear, refused", '        if (message.type === "error") {'),
		slice('        if (message.type === "repl_journal_ack") {', '        if (message.type === "repl_send_ack") {'),
		"}",
		"globalThis.api = {",
		"  copy: copyReplJournalToClipboard, exportMd: exportReplJournalMarkdown, load: loadReplJournalIntoEditor, clear: clearReplJournal, handle,",
		"  setSessions(sessions) { replSessions = sessions; }, setEntries(entries) { replJournalEntries = entries; }, setActiveEntry(id) { activeReplJournalEntryId = id; }, select(name) { replActiveSessionName = name; },",
		"  get entries() { return replJournalEntries.map((entry) => entry.id); }, get visible() { return getVisibleReplJournalEntries().map((entry) => entry.id); },",
		"  get activeEntry() { return activeReplJournalEntryId; }, get status() { return statuses.at(-1); }, get sent() { return sent; },",
		"  get copied() { return copied; }, get exported() { return exported; }, get loaded() { return loaded; },",
		"};",
	].join("\n"), context);
	return context.api;
}

const entries = [{ id: "a1", sessionName: "pi-repl-python" }, { id: "a2", sessionName: "pi-repl-python" }, { id: "b1", sessionName: "pi-repl-julia" }];
const refusal = "pi-repl-python's shared record is in a different or replaced record directory, not this terminal's (/tmp/x). Use it from a terminal with the same temporary directory (TMPDIR) as its other clients.";

test("a refused record's entries kept from before aren't copied, exported or loaded; the page says why", async () => {
	const p = page();
	p.setEntries(entries);
	p.setSessions([{ sessionName: "pi-repl-python", recordRefusal: refusal }, { sessionName: "pi-repl-julia", recordRefusal: "" }]);
	assert.deepEqual([...p.visible], []);
	await p.copy();
	assert.deepEqual([...p.status], [refusal, "warning"]);
	p.exportMd();
	assert.deepEqual([...p.status], [refusal, "warning"]);
	p.load();
	assert.deepEqual([...p.status], [refusal, "warning"]);
	assert.deepEqual([[...p.copied], [...p.exported], [...p.loaded]], [[], [], []]);
	// Another session's record, and this one's once Studio uses it again, are as before.
	p.select("pi-repl-julia");
	await p.copy();
	assert.deepEqual([...p.copied], ["b1"]);
	p.select("pi-repl-python");
	p.setSessions([{ sessionName: "pi-repl-python", recordRefusal: "" }]);
	p.exportMd();
	assert.deepEqual([...p.exported], ["a1,a2"]);
});

test("a session's clear empties this page's copy only once Studio has cleared it", () => {
	let p = page();
	p.setEntries(entries);
	p.setActiveEntry("a2");
	p.clear();
	assert.deepEqual([...p.entries], ["a1", "a2", "b1"], "kept until Studio answers");
	assert.deepEqual([...p.status], ["Clearing the shared REPL record…", "info"]);
	const [request] = p.sent;
	assert.equal(request.type, "repl_journal_clear_request");
	assert.equal(request.sessionName, "pi-repl-python");
	p.handle({ type: "repl_journal_ack", requestId: request.requestId, sessionName: "pi-repl-python", journalEntries: [], cleared: true });
	assert.deepEqual([...p.entries], ["b1"]);
	assert.equal(p.activeEntry, "");
	assert.deepEqual([...p.status], ["Cleared shared REPL record for pi-repl-python.", "success"]);

	// Refused: the page keeps its copy and says why.
	p = page();
	p.setEntries(entries);
	p.setActiveEntry("a2");
	p.clear();
	const why = `Nothing was cleared: ${refusal}`;
	p.handle({ type: "error", requestId: p.sent[0].requestId, message: why });
	assert.deepEqual([...p.entries], ["a1", "a2", "b1"]);
	assert.equal(p.activeEntry, "a2");
	assert.deepEqual([...p.status], [why, "warning"]);
	// A later acknowledgement of something else doesn't claim the clear.
	p.handle({ type: "repl_journal_ack", requestId: "request-9", sessionName: "pi-repl-python", journalEntries: [] });
	assert.deepEqual([...p.status], [why, "warning"]);
});

test("a clear Studio can't be asked for clears nothing; with no session, the page's own copy is cleared at once", () => {
	let p = page({ connected: false });
	p.setEntries(entries);
	p.clear();
	assert.deepEqual([...p.entries], ["a1", "a2", "b1"]);
	assert.deepEqual([...p.status], ["Nothing was cleared: Studio isn't connected.", "warning"]);
	p = page();
	p.setEntries(entries);
	p.select("");
	p.clear();
	assert.deepEqual([...p.entries], []);
	assert.deepEqual([...p.sent], []);
	assert.deepEqual([...p.status], ["Cleared local REPL record cache.", "success"]);
});

test("Candidate 115: overlapping clears are each answered for themselves", () => {
	const p = page();
	p.setEntries([...entries, { id: "b2", sessionName: "pi-repl-julia" }]);
	p.setActiveEntry("a2");
	p.clear();
	p.select("pi-repl-julia");
	p.setActiveEntry("b2");
	p.clear();
	const [python, julia] = p.sent;
	// The earlier one refused after the later succeeded: a warning for it, nothing lost.
	p.handle({ type: "repl_journal_ack", requestId: julia.requestId, sessionName: "pi-repl-julia", journalEntries: [], cleared: true });
	assert.deepEqual([...p.entries], ["a1", "a2"]);
	assert.equal(p.activeEntry, "");
	p.handle({ type: "error", requestId: python.requestId, message: "Nothing was cleared: refused." });
	assert.deepEqual([...p.status], ["Nothing was cleared: refused.", "warning"]);
	assert.deepEqual([...p.entries], ["a1", "a2"]);
	// A success for a session no longer shown leaves the shown session's active entry alone.
	const q = page();
	q.setEntries(entries);
	q.clear();
	q.select("pi-repl-julia");
	q.setActiveEntry("b1");
	q.handle({ type: "repl_journal_ack", requestId: q.sent[0].requestId, sessionName: "pi-repl-python", journalEntries: [], cleared: true });
	assert.deepEqual([...q.entries], ["b1"]);
	assert.equal(q.activeEntry, "b1");
	assert.deepEqual([...q.status], ["Cleared shared REPL record for pi-repl-python.", "success"]);
});

test("Candidate 115: with no session selected, a refused record's entries are still left out", async () => {
	const p = page();
	p.setEntries(entries);
	p.setSessions([{ sessionName: "pi-repl-python", recordRefusal: refusal }, { sessionName: "pi-repl-julia", recordRefusal: "" }]);
	p.select("");
	assert.deepEqual([...p.visible], ["b1"]);
	await p.copy();
	p.exportMd();
	p.load();
	assert.deepEqual([[...p.copied], [...p.exported], [...p.loaded]], [["b1"], ["b1"], ["b1"]]);
});

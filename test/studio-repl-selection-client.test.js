import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Candidate 74, round 5: how the page applies Studio's REPL selection (Sol, Astra). The
// page's own functions and message handlers run here unchanged, with the DOM stubbed.
const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const slice = (from, to) => {
	const start = clientSource.indexOf(from);
	const end = clientSource.indexOf(to, start);
	assert.ok(start >= 0 && end > start, from);
	return clientSource.slice(start, end);
};

// With `realJournal`, the page's own record functions run too, including the transcript updater.
function page(runtime = "python", { realJournal = false } = {}) {
	const context = { window: {}, console };
	const journal = realJournal ? [
		"const REPL_JOURNAL_MAX_ENTRIES = 80; const REPL_JOURNAL_OUTPUT_MAX_CHARS = 80000; function setStatus() {}",
		slice("      function normalizeReplJournalEntry", "      function loadPersistedReplJournalEntries"),
		slice("      function mergeReplJournalEntries", "      let replJournalEntries = loadPersistedReplJournalEntries"),
		slice("      function trimReplJournalOutput", "      function createReplJournalEntry"),
		slice("      function extractReplTranscriptDelta", "      function getMarkdownFenceForText"),
	] : [
		"function trimReplJournalOutput(value) { return value; } function updateActiveReplJournalEntryFromTranscript() { return false; }",
		"function mergeReplJournalEntries(entries) { return Array.isArray(entries) && entries.length > 0; }",
	];
	vm.runInNewContext([
		`let replRuntime = ${JSON.stringify(runtime)}; let replTmuxAvailable = true; let replSessions = []; let replActiveSessionName = "";`,
		"let replServerSelection = { sessionName: '', runtime: '' }; let replShownBasis = null; let replChoiceRevision = 0; let replChoiceAnswered = 0; let replChoicePin = null;",
		"let replReconcileSent = ''; let replTranscriptOwner = ''; let replTranscript = ''; let replError = ''; let replMessage = ''; let replCapturedAt = 0;",
		"let replBusy = false; let replPendingRequestId = ''; let activeReplJournalEntryId = ''; let replJournalEntries = []; let wsState = 'Ready'; let rightView = 'repl';",
		"const REPL_TRANSCRIPT_MAX_CHARS = 100000; const sent = []; const added = [];",
		"function sendMessage(message) { sent.push(message); return true; }",
		"function formatCompactNumber(value) { return String(value); } function reconcileReplQuickPending() {} function maybeImportLegacyReplJournalEntries() {}",
		...journal,
		"function syncActionButtons() {} function renderReplViewIfActive() {} function updateReferenceBadge() {} function persistReplJournalEntries() {}",
		"function addReplJournalEntry(entry) { added.push(entry); replJournalEntries = [...replJournalEntries, entry]; return entry; }",
		slice("      function getKnownReplRuntime", "      function getReplRuntimeLabel"),
		slice("      function normalizeReplSession", "      function normalizeReplCommandOverride"),
		slice("      function getReplQuickDraftKey", "      function getReplQuickDraft("),
		slice("      function serializeReplSessionsForCompare", "      function prepareEditorTextForRunRequest"),
		slice("      function setActiveReplSession(", "      function isReplControlFocused"),
		slice("      function getActiveReplRuntime", "      function getEditorSelectionRange"),
		slice("      function recordReplToolSend", "      function extractReplTranscriptDelta"),
		"function handle(message) {",
		slice('        if (message.type === "repl_state") {', '        if (message.type === "repl_journal_ack") {'),
		"}",
		"globalThis.handle = handle; globalThis.choose = (name) => { setActiveReplSessionForCurrentRuntime(name); return requestReplChoice(); };",
		"globalThis.chooseRuntime = (runtime) => { setReplRuntime(runtime); selectReplSessionForRuntime(replRuntime, ''); return requestReplChoice(); };",
		"globalThis.reconnect = resetReplSelectionBasis; globalThis.pending = isReplChoicePending; globalThis.sent = sent; globalThis.added = added;",
		"globalThis.prompt = buildActiveReplPromptContext; globalThis.activeLifetime = () => { const s = getActiveReplSession(); return s ? s.sessionName + ' ' + s.tmuxSessionId : null; };",
		"globalThis.startEntry = (entry) => { replJournalEntries = [entry]; activeReplJournalEntryId = entry.id; };",
		"globalThis.entryOutput = (id) => replJournalEntries.find((entry) => entry.id === id)?.output;",
		"globalThis.set = (fields) => { if ('activeReplJournalEntryId' in fields) activeReplJournalEntryId = fields.activeReplJournalEntryId; if ('replPendingRequestId' in fields) replPendingRequestId = fields.replPendingRequestId; };",
		"globalThis.state = () => ({ runtime: replRuntime, active: replActiveSessionName, transcript: replTranscript, capturedAt: replCapturedAt, basis: replShownBasis, entry: activeReplJournalEntryId, pendingRequest: replPendingRequestId, error: replError, sessions: replSessions.map((s) => s.sessionName) });",
	].join("\n"), context);
	return context;
}

const session = (sessionName, tmuxSessionId, runtime = "python") => ({ sessionName, tmuxSessionId, tmuxSessionCreatedAt: 1700000000, runtime, target: "%1", label: sessionName, source: "studio" });
const b = session("pi-studio-repl-python", "$1");
const c = session("pi-studio-repl-python-0a1b2c3d", "$2");
const j = session("pi-repl-julia", "$3", "julia");
const state = (fields) => ({ type: "repl_state", tmuxAvailable: true, sessions: [b, c, j], journalEntries: [], error: null, ...fields });
const selected = (s, shown, fields) => ({ type: "repl_capture", session: s, activeSessionName: s.sessionName, activeRuntime: s.runtime, shown, capturedAt: 10, journalEntries: [], ...fields });
// Objects from the page's realm, copied into this one for deep comparison.
const reconciles = (context) => JSON.parse(JSON.stringify(context.sent.filter((message) => message.type === "repl_reconcile_request")));

test("while the page's choice is unanswered, other replies settle but change nothing it shows", () => {
	const p = page();
	p.handle(state({ activeSessionName: b.sessionName, activeRuntime: "python", shown: 1 }));
	assert.deepEqual([p.state().active, p.state().basis], [b.sessionName, 1]);
	p.choose(c.sessionName);
	assert.equal(p.sent.at(-1).choiceRevision, 1);
	assert.equal(p.pending(), true);
	// A Start that selected B, answering its own request.
	p.set({ replPendingRequestId: "start-1" });
	p.handle(selected(b, 2, { requestId: "start-1", transcript: "B", replMessage: "Started Python REPL." }));
	assert.deepEqual([p.state().active, p.state().transcript, p.state().basis, p.state().pendingRequest], [c.sessionName, "", 1, ""]);
	// Nor does a poll of C sent before the choice, when the page last showed C.
	p.handle({ type: "repl_capture", observation: true, session: c, transcript: "C before", capturedAt: 9, journalEntries: [] });
	assert.equal(p.state().transcript, "");
	// A list without C doesn't move the page off it either.
	p.handle(state({ sessions: [b], activeSessionName: b.sessionName, activeRuntime: "python", shown: 3 }));
	assert.deepEqual([p.state().active, p.state().basis], [c.sessionName, 1]);
	assert.deepEqual(reconciles(p), []);
	// The choice's reply.
	p.handle(selected(c, 4, { choiceRevision: 1, transcript: "C" }));
	assert.deepEqual([p.pending(), p.state().active, p.state().transcript, p.state().basis], [false, c.sessionName, "C", 4]);
});

test("a refused choice's reply ends the wait, and so does a reconnect", () => {
	let p = page();
	p.handle(state({ activeSessionName: b.sessionName, activeRuntime: "python", shown: 1 }));
	p.choose("pi-studio-repl-python-gone");
	p.handle(state({ choiceRevision: 1, replError: "No tmux REPL session named pi-studio-repl-python-gone.", activeSessionName: null, activeRuntime: "python", shown: 2 }));
	assert.equal(p.pending(), false);
	assert.equal(p.state().error, "No tmux REPL session named pi-studio-repl-python-gone.");
	p = page();
	p.handle(state({ activeSessionName: b.sessionName, activeRuntime: "python", shown: 1 }));
	p.choose(c.sessionName);
	p.reconnect();
	assert.deepEqual([p.pending(), p.state().basis], [false, null]);
	assert.equal(p.sent.at(-1).type, "repl_list_request");
});

test("an older choice's reply doesn't end the wait for a newer one", () => {
	const p = page();
	p.handle(state({ activeSessionName: b.sessionName, activeRuntime: "python", shown: 1 }));
	p.choose(c.sessionName);
	p.choose(b.sessionName);
	p.handle(selected(c, 2, { choiceRevision: 1, transcript: "C" }));
	assert.deepEqual([p.pending(), p.state().active, p.state().transcript], [true, b.sessionName, ""]);
	p.handle(selected(b, 3, { choiceRevision: 2, transcript: "B" }));
	assert.deepEqual([p.pending(), p.state().active, p.state().transcript, p.state().basis], [false, b.sessionName, "B", 3]);
});

test("the agent selecting Python while the page shows Julia switches Runtime, with nothing to reconcile", () => {
	const p = page("julia");
	p.handle(state({ activeSessionName: j.sessionName, activeRuntime: "julia", shown: 1 }));
	assert.deepEqual([p.state().runtime, p.state().active], ["julia", j.sessionName]);
	p.handle({ type: "repl_tool_send", toolCallId: "t1", code: "print(1)", output: "1", sessionName: b.sessionName, runtime: "python",
		select: true, session: b, activeSessionName: b.sessionName, activeRuntime: "python", shown: 2, transcript: ">>> 1", capturedAt: 20, journalEntries: [] });
	assert.deepEqual([p.state().runtime, p.state().active, p.state().transcript, p.state().basis], ["python", b.sessionName, ">>> 1", 2]);
	assert.deepEqual(reconciles(p), []);
});

test("an agent result that doesn't select only adds to the record", () => {
	const p = page();
	p.handle(selected(c, 4, { transcript: "C view" }));
	p.set({ activeReplJournalEntryId: "page-send-1" });
	p.handle({ type: "repl_tool_send", toolCallId: "t2", code: "print('later')", output: "later", sessionName: b.sessionName, runtime: "python", select: false, journalEntries: [] });
	const after = p.state();
	assert.deepEqual([after.runtime, after.active, after.transcript, after.capturedAt, after.basis, after.entry], ["python", c.sessionName, "C view", 10, 4, "page-send-1"]);
	assert.equal(p.added.at(-1).output, "later");
	// A result that selects takes over the view and its tracking.
	p.handle({ type: "repl_tool_send", toolCallId: "t3", code: "print(2)", output: "2", sessionName: b.sessionName, runtime: "python",
		select: true, session: b, activeSessionName: b.sessionName, activeRuntime: "python", shown: 5, transcript: ">>> 2", capturedAt: 40, journalEntries: [] });
	assert.deepEqual([p.state().active, p.state().transcript, p.state().entry], [b.sessionName, ">>> 2", ""]);
});

test("a poll's reply applies only to the exact session the page shows", () => {
	const p = page();
	p.handle(selected(b, 1, { transcript: "B" }));
	// A's Start selected; then B's poll reply, handled after it.
	p.handle(selected(c, 2, { transcript: "A" }));
	p.handle({ type: "repl_capture", observation: true, session: b, transcript: "B later", capturedAt: 30, journalEntries: [] });
	assert.deepEqual([p.state().active, p.state().transcript], [c.sessionName, "A"]);
	p.handle({ type: "repl_capture", observation: true, session: c, transcript: "A later", capturedAt: 31, journalEntries: [] });
	assert.deepEqual([p.state().transcript, p.state().capturedAt], ["A later", 31]);
	// The same name and creation time, but a new tmux ID: ignored, and the page asks for the list.
	const listsBefore = p.sent.filter((message) => message.type === "repl_list_request").length;
	p.handle({ type: "repl_capture", observation: true, session: { ...c, tmuxSessionId: "$9" }, transcript: "replacement", capturedAt: 32, journalEntries: [] });
	assert.deepEqual([p.state().transcript, p.state().capturedAt], ["A later", 31]);
	assert.equal(p.sent.filter((message) => message.type === "repl_list_request").length, listsBefore + 1);
	// A failed poll of B, which the page no longer shows, leaves A's view alone.
	p.handle({ type: "repl_capture", observation: true, sessionName: b.sessionName, captureError: "No tmux REPL session named B.", journalEntries: [] });
	assert.deepEqual([p.state().transcript, p.state().error], ["A later", ""]);
	// A failed capture of the shown session clears it and asks for the list.
	p.handle({ type: "repl_capture", observation: true, sessionName: c.sessionName, captureError: "No tmux REPL session named it.", journalEntries: [] });
	assert.deepEqual([p.state().transcript, p.state().error], ["", "No tmux REPL session named it."]);
});

test("a replacement with the same name, adopted from Studio, starts with a clean view", () => {
	const p = page();
	p.handle(selected(b, 1, { transcript: "old B" }));
	p.set({ activeReplJournalEntryId: "page-send-2" });
	p.handle(state({ sessions: [{ ...b, tmuxSessionId: "$9" }, c], activeSessionName: b.sessionName, activeRuntime: "python", shown: 2 }));
	assert.deepEqual([p.state().active, p.state().transcript, p.state().capturedAt, p.state().entry], [b.sessionName, "", 0, ""]);
});

test("with no preference, the page picks within its runtime and reports it once", () => {
	const p = page("julia");
	p.handle(state({ activeSessionName: null, activeRuntime: null, shown: 0 }));
	assert.equal(p.state().active, j.sessionName);
	assert.deepEqual(reconciles(p), [{ type: "repl_reconcile_request", basis: 0, sessionName: j.sessionName, tmuxSessionId: "$3", tmuxSessionCreatedAt: 1700000000 }]);
	p.handle(state({ activeSessionName: null, activeRuntime: null, shown: 0 }));
	assert.equal(reconciles(p).length, 1);
	// None for a runtime is a selection: nothing to report.
	const q = page("python");
	q.handle(state({ sessions: [j], activeSessionName: null, activeRuntime: "python", shown: 3 }));
	assert.deepEqual([q.state().runtime, q.state().active, reconciles(q)], ["python", "", []]);
});

test("a selected session the page can't show under a runtime keeps its transcript off the view", () => {
	const p = page();
	const odd = session("pi-repl-ruby", "$4", "unknown");
	p.handle(selected(b, 1, { transcript: "B" }));
	p.handle({ ...selected(odd, 2, { transcript: "ruby" }), activeRuntime: "unknown" });
	assert.notEqual(p.state().transcript, "ruby");
	assert.equal(p.state().active, b.sessionName);
	assert.equal(reconciles(p).at(-1).sessionName, b.sessionName);
});

test("leaving a session through none retires its live entry, so a same-name replacement can't feed it", () => {
	const sendingTo = (p) => p.startEntry({ id: "pi-studio:page:1", requestId: "page-1", sessionName: b.sessionName, runtime: "python", origin: "pi-studio",
		legacyLocal: true, outputClean: false, code: "print(1)", beforeTranscript: ">>>", output: "", status: "sending" });
	const later = ">>> print(1)\n1\n>>>";
	// Control: with B still shown, its capture fills this page's running entry.
	const control = page("python", { realJournal: true });
	control.handle(selected(b, 1, { transcript: ">>>" }));
	sendingTo(control);
	control.handle({ type: "repl_capture", observation: true, session: b, transcript: later, capturedAt: 20, journalEntries: [] });
	assert.equal(control.entryOutput("pi-studio:page:1"), "1");
	// B, then an empty runtime, then a new B under the same name.
	const p = page("python", { realJournal: true });
	p.handle(selected(b, 1, { transcript: ">>>" }));
	sendingTo(p);
	p.chooseRuntime("julia");
	assert.equal(p.state().entry, "");
	p.handle(state({ sessions: [b], choiceRevision: 1, activeSessionName: null, activeRuntime: "julia", shown: 2 }));
	p.handle(selected({ ...b, tmuxSessionId: "$9" }, 3, { transcript: later }));
	assert.equal(p.activeLifetime(), `${b.sessionName} $9`);
	assert.equal(p.entryOutput("pi-studio:page:1"), "");
});

test("while a choice is unanswered, the chosen session keeps its lifetime and Prompt context", () => {
	const c2 = { ...c, target: "%2" };
	const p = page();
	p.handle(state({ sessions: [b, c2], activeSessionName: b.sessionName, activeRuntime: "python", shown: 1 }));
	p.choose(c.sessionName);
	assert.match(p.prompt(), /tmux target: %2\n/);
	// An earlier poll's list: B still selected, and C recreated with a new tmux ID and pane.
	const c9 = { ...c, tmuxSessionId: "$9", target: "%9" };
	p.handle(state({ sessions: [b, c9], activeSessionName: b.sessionName, activeRuntime: "python", shown: 2 }));
	assert.equal(p.pending(), true);
	assert.equal(p.activeLifetime(), `${c.sessionName} $2`);
	assert.match(p.prompt(), /tmux target: %2\n/);
	// The choice's answer adopts the replacement, with a clean view.
	p.handle(selected(c9, 3, { choiceRevision: 1, transcript: "new C" }));
	assert.equal(p.activeLifetime(), `${c.sessionName} $9`);
	assert.match(p.prompt(), /tmux target: %9\n/);
	assert.equal(p.state().transcript, "new C");
	// If the chosen session disappears meanwhile, no other session stands in for it.
	const q = page();
	q.handle(state({ sessions: [b, c2], activeSessionName: b.sessionName, activeRuntime: "python", shown: 1 }));
	q.choose(c.sessionName);
	q.handle(state({ sessions: [b], activeSessionName: b.sessionName, activeRuntime: "python", shown: 2 }));
	assert.equal(q.activeLifetime(), null);
	assert.equal(q.prompt(), "");
	// A later list with C recreated still can't put the replacement in its place (Sol, Astra).
	q.handle(state({ sessions: [b, c9], activeSessionName: b.sessionName, activeRuntime: "python", shown: 3 }));
	assert.equal(q.pending(), true);
	assert.notEqual(q.activeLifetime(), `${c.sessionName} $9`);
	assert.doesNotMatch(q.prompt(), /%9/);
	// The answer adopts it as usual.
	q.handle(selected(c9, 4, { choiceRevision: 1, transcript: "new C" }));
	assert.equal(q.activeLifetime(), `${c.sessionName} $9`);
	assert.match(q.prompt(), /tmux target: %9\n/);
});

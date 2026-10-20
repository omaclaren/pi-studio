import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

import {
	buildStudioReplDeadPaneCloseArgs,
	cleanStudioReplOutput,
	firstStudioReplPanes,
	isStudioReplReadyLine,
	STUDIO_REPL_SESSION_NAME,
	studioReplSessionTarget,
} from "../shared/studio-repl-tmux.js";
import { createReplSubmissionDisplay } from "../shared/repl-submission-display.js";

// Candidate 74: Sol's REPL parity batch 1 (pi-repl 0.8.1's targeting, readiness, cleanup and stop).
const serverSource = readFileSync(new URL("../index.ts", import.meta.url), "utf8");

test("sessions are addressed by exact name or ID, never by a name prefix", () => {
	assert.equal(studioReplSessionTarget("pi-repl-r"), "=pi-repl-r");
	assert.equal(studioReplSessionTarget("$12"), "$12");
	assert.doesNotMatch(serverSource, /:0\.0/);
	assert.match(serverSource, /spawnSync\("tmux", \["-u", \.\.\.args\]/, "tabs survive a non-UTF-8 locale");
	assert.match(serverSource, /execFile\("tmux", \["-u", \.\.\.args\]/);
});

test("Start closes a pane that exited only through the guarded close", () => {
	assert.match(serverSource, /const close = buildStudioReplDeadPaneCloseArgs\(sessionId, paneId, row\.pid \?\? ""\);/);
	assert.doesNotMatch(serverSource, /\["kill-pane", "-t", paneId\]/);
	assert.deepEqual(buildStudioReplDeadPaneCloseArgs("$3", "%7", "4242"), [
		"if-shell", "-F", "-t", "%7", "#{&&:#{pane_dead},#{&&:#{==:#{pane_pid},4242},#{==:#{session_id},$3}}}", "kill-pane -t '%7'",
	]);
	for (const args of [["3", "%7", "1"], ["$3", "7", "1"], ["$3", "%7", ""], ["$3", "%7", "1}"]]) {
		assert.equal(buildStudioReplDeadPaneCloseArgs(...args), null, JSON.stringify(args));
	}
});

test("Studio's selection changes only through its own module (source pin)", () => {
	// Behaviour is tested in studio-repl-selection*.test.js and the integration test; this
	// pins the call sites: five explicit choices (the page's Session or Runtime choice, which
	// is two, its send, interrupt and the agent's send), a Start request, and two non-counting
	// shows (a Start and the agent's send that passed their fence).
	const calls = (method) => serverSource.split(`studioReplSelection.${method}(`).length - 1;
	assert.deepEqual(["choose", "startRequested", "show", "reconcile", "resolve"].map(calls), [5, 1, 2, 2, 2]);
	assert.doesNotMatch(serverSource, /studioReplActiveSessionName/);
});

test("the browser shows the server's cleaned output as it is", () => {
	const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
	assert.match(clientSource, /const output = trimReplJournalOutput\(String\(message\.output \|\| ""\)\.trimEnd\(\)\);/);
	assert.doesNotMatch(serverSource, /"(?:has-session|kill-session|list-panes|show-options)", (?:"-s", )?"-t", sessionName\b/);
});

const row = (window, pane, id, name = "pi-studio-repl-python", session = "$1") => [window, pane, id, name, session, "1700000000", "python", "a".repeat(32), "1"].join("\t");

test("each session's first pane comes from its real window and pane numbers", () => {
	const panes = firstStudioReplPanes([
		row(2, 0, "%7"), row(1, 1, "%6"), row(1, 0, "%5"),
		row(1, 0, "%9", "pi-repl-julia", "$2"),
		"garbage", row("x", 0, "%1"), row(0, 0, "7"),
	].join("\n"));
	assert.deepEqual(panes.map((pane) => [pane.sessionName, pane.paneId, pane.windowIndex, pane.paneIndex]), [
		["pi-studio-repl-python", "%5", 1, 0],
		["pi-repl-julia", "%9", 1, 0],
	]);
	assert.equal(panes[0].runtime, "python");
	assert.equal(panes[0].recordId, "a".repeat(32));
	assert.deepEqual(firstStudioReplPanes(""), []);
});

test("Start waits for each runtime's normal prompt, seen on the cursor row", () => {
	const ready = {
		python: [">>> ", "In [1]: "], ipython: ["In [12]:", ">>>"], julia: ["julia> "], r: ["> "],
		ghci: ["ghci> ", "Prelude> ", "*Main> ", "*Main Data.List> "], clojure: ["user=> "],
		ruby: ["irb(main):001> ", "irb(main):001:0> "], java: ["jshell> "],
	};
	for (const [runtime, lines] of Object.entries(ready)) {
		for (const line of lines) assert.equal(isStudioReplReadyLine(runtime, line), true, `${runtime}: ${line}`);
	}
	const notReady = {
		python: ["Python 3.12.1 (main)", "", "... "], julia: ["  Documentation: https://docs.julialang.org", "julia> 1+1"],
		r: ["R version 4.4.1", "+ "], ghci: ["GHCi, version 9.6.7: https://www.haskell.org/ghc/  :? for help", "ghci> 1"],
		clojure: ["Clojure 1.12.0", ""], shell: ["$ ", "% "],
		ruby: ["irb(main):001* ", "irb(main):001:1> ", "irb(main):001> 1"], java: ["|  Welcome to JShell -- Version 25", "jshell> 1", "   ...> "],
		octave: ["octave:1> "],
	};
	for (const [runtime, lines] of Object.entries(notReady)) {
		for (const line of lines) assert.equal(isStudioReplReadyLine(runtime, line), false, `${runtime}: ${line}`);
	}
	assert.equal(isStudioReplReadyLine("python", ">>> \nIn [1]:"), false, "one row only");
});

test("verified Stop accepts every name Studio gives its own sessions, and nothing else", () => {
	for (const name of [
		"pi-studio-repl-python", "pi-studio-repl-r", "pi-studio-repl-clojure-0123abcd",
		"pi-studio-repl-julia-mgx2k1z3-a1b2c3", "pi-studio-repl-ghci-0123abcd-mgx2k1z3-a1b2c3",
		"pi-studio-repl-ruby", "pi-studio-repl-java-0123abcd",
	]) assert.match(name, STUDIO_REPL_SESSION_NAME, name);
	for (const name of [
		"pi-repl-python", "pi-repl-ruby", "pi-studio-repl-octave", "pi-studio-repl-rubyx", "pi-studio-repl-python-x", "pi-studio-repl-pythonx",
		"xpi-studio-repl-python", "pi-studio-repl-python-0123ABCD", "pi-studio-repl-python\n",
	]) assert.doesNotMatch(name, STUDIO_REPL_SESSION_NAME, JSON.stringify(name));
	assert.equal(STUDIO_REPL_SESSION_NAME.global || STUDIO_REPL_SESSION_NAME.sticky, false);
});

const py = 'exec(open("/tmp/pi-rc-c74test/0123456789abcdef.py", encoding="utf-8").read(), globals())';

test("output cleanup removes this submission's loader echo once, including IPython's wrapped echo", () => {
	assert.equal(cleanStudioReplOutput(`${py}\nhello\n>>>`, { submissionLine: py }), "hello");
	// Captured from IPython in an 80-column tmux pane (candidate 74 findings).
	const wrapped = 'exec(open("/tmp/pi-rc-c74test/0123456789abcdef.py", encoding="utf-8").re\n   ...: ad(), globals())\nhello\nIn [2]:';
	assert.equal(cleanStudioReplOutput(wrapped, { submissionLine: py }), "hello");
	const wrappedAtSpace = 'exec(open("/tmp/pi-rc-c74test/0123456789abcdef.py",\n   ...: encoding="utf-8").read(), globals())\nhello\nIn [2]:';
	assert.equal(cleanStudioReplOutput(wrappedAtSpace, { submissionLine: py }), "hello");
	assert.equal(cleanStudioReplOutput(`In [3]: ${py}\nhello\nIn [4]:`, { submissionLine: py }), "hello");
	assert.equal(cleanStudioReplOutput(`${py}joined output\nmore`, { submissionLine: py }), "joined output\nmore", "output joined to the echo is kept");
	assert.equal(cleanStudioReplOutput(`${py}\n${py}\n>>>`, { submissionLine: py }), py, "printing the loader again is output");
	const other = 'exec(open("/tmp/pi-rc-c74test/fedcba9876543210.py", encoding="utf-8").read(), globals())';
	assert.equal(cleanStudioReplOutput(`${py}\n${other}\n>>>`, { submissionLine: py }), other, "another submission's loader line is output");
	assert.equal(cleanStudioReplOutput(`${py.slice(0, 40)}\n   ...: something else\nhello`, { submissionLine: py }), `${py.slice(0, 40)}\n   ...: something else\nhello`, "a partial match removes nothing");
	const long = "x".repeat(100_000);
	const started = Date.now();
	assert.equal(cleanStudioReplOutput(`${long}\n>>>`, { submissionLine: py }), long);
	assert.ok(Date.now() - started < 1_000, "a long output row doesn't stall cleanup");
});

test("output cleanup keeps prompt-looking output and removes one trailing prompt once finished", () => {
	assert.equal(cleanStudioReplOutput(`${py}\n>>>\n>>>`, { submissionLine: py, completed: true }), ">>>");
	assert.equal(cleanStudioReplOutput(`${py}\na>\nx>\n>>>`, { submissionLine: py }), "a>\nx>");
	const r = 'source("/tmp/pi-rc-c74test/0123456789abcdef.R", local=.GlobalEnv)';
	assert.equal(cleanStudioReplOutput(`${r}\n>\n+\n>`, { submissionLine: r }), ">\n+");
	assert.equal(cleanStudioReplOutput(`${py}\nstill running\n>>>`, { submissionLine: py, completed: false }), "still running\n>>>", "no prompt is removed before the code has finished");
	const clj = '(do (load-file "/tmp/pi-rc-c74test/0123456789abcdef.clj") :pi-studio/silent)';
	assert.equal(cleanStudioReplOutput(`${clj}\nuser=>\n:pi-studio/silent\nuser=>`, { submissionLine: clj }), "user=>");
	assert.equal(cleanStudioReplOutput(`${clj}\n:pi-studio/silent\n:pi-studio/silent\nuser=>`, { submissionLine: clj }), ":pi-studio/silent", "only Clojure's own silent result");
	assert.equal(cleanStudioReplOutput(`${clj}\n:pi-studio/silent`, { submissionLine: clj, completed: false }), ":pi-studio/silent", "printed by code that hasn't finished");
	// Ruby and Java (candidate82): the loader echo after the prompt, and one trailing prompt.
	const rb = 'load "/tmp/pi-rc-c82test/0123456789abcdef.rb"; nil';
	assert.equal(cleanStudioReplOutput(`irb(main):003> ${rb}\nhello\nirb(main):004>`, { submissionLine: rb }), "hello");
	assert.equal(cleanStudioReplOutput(`irb(main):003:0> ${rb}\nirb(main):001>\nirb(main):004:0>`, { submissionLine: rb }), "irb(main):001>", "only one prompt, the last");
	const jv = "/open /tmp/pi-rc-c82test/0123456789abcdef.java";
	assert.equal(cleanStudioReplOutput(`jshell> ${jv}\nhello\njshell>`, { submissionLine: jv }), "hello");
});

test("prompt-looking rows are scaffolding only before this submission's echo", () => {
	assert.equal(cleanStudioReplOutput(`>>>\n${py}\nhello\n>>>`, { submissionLine: py }), "hello");
	// Terminal echo off: no loader echo, so a leading ">>>" is the code's own output.
	assert.equal(cleanStudioReplOutput(">>>\nhello\n>>>", { submissionLine: py, completed: true }), ">>>\nhello");
	assert.equal(cleanStudioReplOutput("\n>>>\n>>>\nhello", { submissionLine: py, completed: false }), ">>>\n>>>\nhello");
});

test("Shell output loses its loader echo after any prompt and the prompt it returns to", () => {
	const sh = ". '/tmp/pi-rc-c74test/0123456789abcdef.sh'; touch '/tmp/pi-rc-c74test/0123456789abcdef.done'";
	const prompt = "omac010@host pi-studio %";
	assert.equal(cleanStudioReplOutput(`${prompt} ${sh}\n42\n${prompt}`, { submissionLine: sh, runtime: "shell", promptLine: prompt }), "42");
	assert.equal(cleanStudioReplOutput(`${sh}\n42\n${prompt}`, { submissionLine: sh, runtime: "shell", promptLine: prompt }), "42");
	assert.equal(cleanStudioReplOutput(`${prompt} ${sh}\n42`, { submissionLine: sh, runtime: "python" }), `${prompt} ${sh}\n42`, "only Shell accepts any prefix");
});

test("the browser keeps server-cleaned output as it is when the shared record couldn't be saved", () => {
	const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
	const slice = (from, to) => {
		const start = clientSource.indexOf(from);
		const end = clientSource.indexOf(to, start);
		assert.ok(start >= 0 && end > start, from);
		return clientSource.slice(start, end);
	};
	const context = { window: {}, console };
	vm.runInNewContext([
		slice("      function trimReplJournalOutput", "      function createReplJournalEntry"),
		slice("      function extractReplTranscriptDelta", "      function getMarkdownFenceForText"),
		slice("      function normalizeReplJournalEntry", "      function loadPersistedReplJournalEntries"),
		slice("      function mergeReplJournalEntries", "      let replJournalEntries = loadPersistedReplJournalEntries"),
		"let replJournalEntries = []; let activeReplJournalEntryId = ''; const REPL_JOURNAL_MAX_ENTRIES = 80; const REPL_JOURNAL_OUTPUT_MAX_CHARS = 80000;",
		"function persistReplJournalEntries() {} function formatCompactNumber(value) { return String(value); }",
		"globalThis.merge = mergeReplJournalEntries; globalThis.normalize = normalizeReplJournalEntry; globalThis.entries = () => replJournalEntries;",
		"globalThis.update = updateActiveReplJournalEntryFromTranscript; globalThis.start = (entry) => { replJournalEntries = [entry]; activeReplJournalEntryId = entry.id; };",
	].join("\n"), context);
	// The code printed a loader-like line; the server kept it, but the record write failed.
	const loaderLike = 'exec(open("/tmp/pi-rc-x/0123456789abcdef.py", encoding="utf-8").read(), globals())';
	const printed = `${loaderLike}\nhello`;
	const sessionName = "pi-studio-repl-python";
	// This page's send, as the live preview holds it.
	context.start({ id: "pi-studio:c74:1", requestId: "c74-send-1", sessionName, runtime: "python", origin: "pi-studio", legacyLocal: true, outputClean: false,
		code: `print(${JSON.stringify(loaderLike)})\nprint("hello")`, beforeTranscript: ">>>", output: "", status: "sending" });
	const fromServer = { id: "pi-studio:c74:1", requestId: "c74-send-1", origin: "pi-studio", sharedSynced: false, sessionName, code: "print(1)", output: printed, status: "captured" };
	assert.equal(context.merge([fromServer]), true);
	// The final capture arrives with the pane's transcript, which still shows Studio's own loader echo.
	const echo = 'exec(open("/tmp/pi-rc-x/fedcba9876543210.py", encoding="utf-8").read(), globals())';
	assert.equal(context.update(sessionName, `>>> ${echo}\n${printed}\n>>>`), false);
	const [kept] = context.entries();
	assert.equal(kept.output, printed);
	assert.equal(kept.legacyLocal, true, "still offered to the shared record later");
	// Saved by this browser and loaded again.
	assert.equal(context.normalize({ ...fromServer, outputClean: true }).output, printed);
	// This browser's older local entries are still cleaned.
	assert.equal(context.normalize({ ...fromServer, origin: "" }).output, "hello");
});

test("output cleanup removes the pane display after the native scaffolding", () => {
	const display = createReplSubmissionDisplay({ entryId: "pi-studio:test:1", origin: "pi-studio", code: "print(1)", mode: "summary" });
	const shown = [py, ...display.prefixLines, "1", ...display.suffixLines, ">>>"].join("\n");
	assert.equal(cleanStudioReplOutput(shown, { submissionLine: py, display }), "1");
	// Only the display's own blank lines go; the output's stay.
	const spaced = [py, ...display.prefixLines, "1", "", "", "2", ...display.suffixLines, ">>>"].join("\n");
	assert.equal(cleanStudioReplOutput(spaced, { submissionLine: py, display }), "1\n\n\n2");
});

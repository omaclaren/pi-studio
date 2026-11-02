import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { renderReplSessionRecordMarkdown } from "../shared/repl-session-record.js";

const serverSource = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const tmuxSource = readFileSync(new URL("../shared/studio-repl-tmux.js", import.meta.url), "utf8");

test("Studio discovers and publishes the session-owned shared REPL record", () => {
	assert.match(serverSource, /REPL_SESSION_RECORD_ID_OPTION/);
	assert.match(serverSource, /REPL_SESSION_RECORD_VERSION_OPTION/);
	assert.match(serverSource, /set-option", "-qo"/);
	assert.match(tmuxSource, /#\{@pi_repl_record_id\}/);
	assert.match(serverSource, /tmuxSessionCreatedAt/);
	// Candidate 113: readers read strictly, creating and repairing nothing (P0).
	assert.match(serverSource, /readReplSessionRecordStrict\(/);
	assert.doesNotMatch(serverSource, /readReplSessionRecord\(/);
	assert.match(serverSource, /upsertReplSessionRecordEntry\(/);
});

test("Studio serializes browser and tool sends with the cross-client lease", () => {
	const leaseCalls = serverSource.match(/acquireReplSessionSendLease\(/g) || [];
	assert.ok(leaseCalls.length >= 2, "expected browser and studio_repl_send lease acquisition");
	assert.match(serverSource, /owner: `pi-studio:tool:/);
	assert.match(serverSource, /owner: `pi-studio:browser:/);
	assert.match(serverSource, /Could not capture .* before sending/);
	assert.match(serverSource, /changed while Studio was waiting to send/);
	assert.match(serverSource, /target: pane\.paneId,/);
	assert.match(serverSource, /captureStudioReplSession\(msg\.sessionName, currentSession\)/);
	assert.match(serverSource, /captureStudioReplSession\(currentSession\.sessionName, currentSession\)/);
	assert.match(serverSource, /sendTextToStudioReplSession\(currentSession\.sessionName, params\.code, currentSession\.target, currentSession\.runtime, \{/);
	// Candidate 109: code still running when a send stops waiting is settled, not just retained.
	assert.match(serverSource, /settleStudioReplSubmission/);
	assert.match(serverSource, /releaseOrSettleStudioReplSubmission\(lease, submittedControlFiles, settling\)/);
	assert.match(serverSource, /studio_repl_send was aborted after submission\./);
	assert.doesNotMatch(serverSource, /retainStudioReplSubmissionUntilSettled/);
	// Candidate 113: only a writer that has checked the record directory passes the session written with.
	assert.match(serverSource, /const session = knownSession;\n\tif \(!session\?\.recordId/);
	// Candidate 113: a failed send's entry is updated with the session its entry was written with.
	assert.match(serverSource, /submittedSession \|\| recorded\)/);
	assert.match(serverSource, /submittedSession \|\| recordSession,/);
});

test("Candidate 111: Studio neither pastes nor sends Ctrl+C where pi-repl takes code through its helper", () => {
	const between = (start, end) => serverSource.slice(serverSource.indexOf(start), serverSource.indexOf(end, serverSource.indexOf(start)));
	// Without -q: -q shows a missing session as an unset option.
	assert.match(serverSource, /runStudioTmux\(\["show-options", "-t", sessionId\]/);
	assert.doesNotMatch(between("function studioReplSendPathRefusal(", "\n}\n"), /"-q/);
	const paste = between("function pasteTextToStudioReplPane(", "\n}\n");
	assert.ok(paste.indexOf('studioReplSendPathRefusal(sessionId, "send")') >= 0 && paste.indexOf('studioReplSendPathRefusal(sessionId, "send")') < paste.indexOf('"load-buffer"'));
	const interrupt = between("function interruptStudioReplSession(", "\n}\n");
	assert.ok(interrupt.indexOf('studioReplSendPathRefusal(session.tmuxSessionId, "interrupt")') >= 0 && interrupt.indexOf("studioReplSendPathRefusal(") < interrupt.indexOf('"send-keys"'));
	// Both send paths refuse before the send counts as a choice.
	for (const [start, choice] of [["async execute(toolCallId, params, signal) {\n\t\t\tconst selected = selectStudioReplSessionForTool", "studioReplSelection.choose("], ['if (msg.type === "repl_send_request")', "studioReplSelection.choose("]]) {
		const path = between(start, choice);
		assert.match(path, /studioReplSendPathRefusal\((?:selected\.)?session\.tmuxSessionId, "send"\)/, start);
	}
});

test("Candidate 113: Studio uses a session's record only from the record directory its key names (pi-repl's P0)", () => {
	// pi-repl v0.11.7's shared/repl-session-record.js, unchanged.
	assert.equal(createHash("sha256").update(readFileSync(new URL("../shared/repl-session-record.js", import.meta.url))).digest("hex"), "abb9e7c6b831f64495b77a8cd17bb9d833a6b9816116c910611c16962676e089");
	const between = (start, end) => {
		const from = serverSource.indexOf(start);
		assert.ok(from >= 0, start);
		return serverSource.slice(from, serverSource.indexOf(end, from));
	};
	const order = (text, ...parts) => {
		let at = -1;
		for (const part of parts) {
			const next = text.indexOf(part, at + 1);
			assert.ok(next > at, `${part} after the one before`);
			at = next;
		}
	};
	// Listing and inspection only read: no option set, nothing created.
	const reader = between("function readStudioReplSessionRecordState(", "\n}\n");
	assert.doesNotMatch(reader, /set-option|setStudioReplTmuxOptionIfAbsent|ensureReplSessionRecord|createReplSessionRecordId|bindReplSessionRecordRoot/);
	assert.match(between("function makeStudioReplSessionInfo(", "\n}\n"), /readStudioReplSessionRecordState\(/);
	assert.doesNotMatch(serverSource, /attachStudioReplSessionRecord/);
	// The writer: the key bound before the record ID is set or the record created.
	order(between("async function ensureStudioReplSessionRecord(", "\n}\n"), "bindReplSessionRecordRoot(", "REPL_SESSION_RECORD_ID_OPTION, createReplSessionRecordId()", "ensureReplSessionRecord(");
	// Both sends: bound before the lease, checked again after it, before anything is written or pasted.
	order(between('if (msg.type === "repl_send_request")', 'if (msg.type === "repl_journal_upsert_request")'),
		"ensureStudioReplSessionRecord(session)", "acquireReplSessionSendLease(", "checkStudioReplRecordRootAtUse(currentSession)", "recordStudioReplJournalEntry(", "sendTextToStudioReplSession(");
	order(between("async execute(toolCallId, params, signal) {\n\t\t\tconst selected = selectStudioReplSessionForTool", "pi.registerTool({"),
		"ensureStudioReplSessionRecord(selected.session)", "acquireReplSessionSendLease(", "checkStudioReplRecordRootAtUse(inspected)", "recordStudioReplJournalEntry(", "sendTextToStudioReplSession(");
	// Notes, imports and clears bind first too; a start binds its new session.
	order(between('if (msg.type === "repl_journal_upsert_request")', 'if (msg.type === "repl_journal_import_request")'), "ensureStudioReplSessionRecord(inspected)", "recordStudioReplJournalEntry(");
	order(between('if (msg.type === "repl_journal_import_request")', 'if (msg.type === "repl_journal_clear_request")'), "ensureStudioReplSessionRecord(inspected)", "recordStudioReplJournalEntry(");
	order(between("async function clearStudioReplJournal(", "\n}\n"), "ensureStudioReplSessionRecord(inspected)", "clearReplSessionRecord(");
	assert.match(between("async function startStudioReplSession(", "\n}\n"), /const session = await ensureStudioReplSessionRecord\(inspected\);/);
	// What the agent is told reads only from the directory a session's key names.
	order(between("async function observeStudioReplActivity(", "\n}\n"), "classifyReplSessionRecordRoot(pane.rootKey || undefined)", "readReplRecordInert(");
	// The page keeps a session's refusal and shows it in place of the record.
	assert.match(clientSource, /recordRefusal: typeof session\.recordRefusal === "string" \? session\.recordRefusal\.slice\(0, 1000\) : "",/);
	assert.match(clientSource, /recordRefusal: session\.recordRefusal,\n/);
	assert.match(clientSource, /\(recordRefusal \? "<p class='repl-journal-omitted'>" \+ escapeHtml\("Not shown: " \+ recordRefusal\) \+ "<\/p>" : ""\)/);
	// Entries kept from before aren't shown as a refused session's record, by Studio or its page.
	assert.match(clientSource, /const visibleEntries = recordRefusal \? \[\] : getVisibleReplJournalEntries\(\);/);
	assert.match(between("function getStudioReplJournalEntries(", "\n}\n"), /const refused = new Set\(sessions\.filter\(\(session\) => session\.recordRefusal\)/);
});

test("Candidate 112: a page's sends and notes are recorded under its name, checked before anything is sent", () => {
	// pi-repl v0.11.7's shared/repl-person.js, unchanged.
	assert.equal(createHash("sha256").update(readFileSync(new URL("../shared/repl-person.js", import.meta.url))).digest("hex"), "68d2949eb02fc19b7be47a66a02d9a47852977ad253ffa42df643cb7d46fd200");
	const between = (start, end) => serverSource.slice(serverSource.indexOf(start), serverSource.indexOf(end, serverSource.indexOf(start)));
	// An unusable name is refused before the send counts as a choice or waits for the session.
	const send = between('if (msg.type === "repl_send_request")', 'if (msg.type === "repl_journal_upsert_request")');
	assert.ok(send.indexOf("validatePersonName(msg.personName)") > 0 && send.indexOf("validatePersonName(msg.personName)") < send.indexOf("studioReplSelection.choose("));
	// Its output reaches the entry under the ID it was recorded with, not the page's request ID.
	assert.equal((send.match(/updateStudioReplJournalEntryOutput\(\n\t+journalEntry\.requestId,/g) || []).length, 2);
	assert.doesNotMatch(send, /updateStudioReplJournalEntryOutput\(\n\t+msg\.requestId,/);
	// The name as sent, so anything but a usable name is refused, not cut or ignored (Sol, Astra).
	assert.match(serverSource, /\t\t\tpersonName: msg\.personName,\n/);
	// Both note routes check a name under Studio's prefix, read as the shared record will keep the request ID (Sol).
	assert.match(serverSource, /String\(entry\.requestId \|\| ""\)\.replace\(\/\[\\r\\n\\0\]\+\/g, ""\)\.trim\(\)\.startsWith\("studio:"\)/);
	assert.match(between('if (msg.type === "repl_journal_upsert_request")', 'if (msg.type === "repl_journal_import_request")'), /checkStudioReplPersonEntry\(msg\.entry\)/);
	assert.match(between('if (msg.type === "repl_journal_import_request")', 'if (msg.type === "repl_journal_clear_request")'), /checkStudioReplPersonEntry\(entry\)/);
});

test("Studio shell and GHCi sends retain completion after runtime errors", () => {
	assert.match(serverSource, /runtime === "shell"\) return `\. \$\{shellQuote\(sourceFile\)\}; touch/);
	assert.match(serverSource, /runtime === "shell"\) return "sh"/);
	// Candidate 74: GHCi completes from a driver script, never from typed input.
	assert.match(serverSource, /buildStudioGhciCompletionLine\(controlFiles\.doneFile, display\)/);
	assert.match(serverSource, /loader = driver\.sourceFile;/);
	assert.doesNotMatch(serverSource, /completionLine/);
});

test("Studio uses compact private request-unique control files and cleans them after settlement", () => {
	assert.match(serverSource, /createPrivateReplControlFiles\(\{/);
	assert.match(serverSource, /getStudioReplControlExtension\(runtime\)/);
	assert.match(serverSource, /cleanupPrivateReplControlFiles\(controlFiles\)/);
	assert.match(serverSource, /for \(const helper of controlFiles\.helpers \?\? \[\]\) cleanupPrivateReplControlFiles\(helper\)/);
	assert.match(serverSource, /cleanupStudioReplControlFiles\(send\.controlFiles\)/);
	assert.doesNotMatch(serverSource, /const STUDIO_REPL_CONTROL_ROOT/);
});

test("Studio browser clean preview strips compact and legacy loader echoes", () => {
	const start = clientSource.indexOf("      function stripStudioReplSubmissionEcho");
	const end = clientSource.indexOf("      function stripTrailingReplPromptsFromOutput", start);
	assert.ok(start >= 0 && end > start, "expected browser REPL loader cleanup helper");
	const context = {};
	vm.runInNewContext(
		`${clientSource.slice(start, end)}\nglobalThis.stripLoader = stripStudioReplSubmissionEcho;`,
		context,
	);
	const compact = `In [16]: exec(open("/tmp/pi-rc-jta4ib/0123456789abcdef.py", encoding="utf-8").read(), globals())\ntest`;
	const wrapped = `In [17]: exec(open("/tmp/pi-rc-\n    ...: jta4ib/0123456789abcdef.py", encoding="utf-\n    ...: 8").read(), globals())\ntest`;
	const wrappedGlobals = `exec(open("/tmp/pi-rc-jta4i\n    ...: b/d223b51e5bae9847.py", enc\n    ...: oding="utf-8").read(), glob\n    ...: als())\ntest`;
	const legacy = `In [18]: exec(open("/var/folders/example/T/pi-studio-repl/pi-repl-python/request/studio-repl-ipython.py", encoding="utf-8").read(), globals())\ntest`;
	const shell = `$ . '/tmp/pi-rc-jta4ib/0123456789abcdef.sh'; touch '/tmp/pi-rc-jta4ib/0123456789abcdef.done'\n42`;
	assert.equal(context.stripLoader(compact), "test");
	assert.equal(context.stripLoader(wrapped), "test");
	assert.equal(context.stripLoader(wrappedGlobals), "test");
	assert.equal(context.stripLoader(legacy), "test");
	assert.equal(context.stripLoader(shell), "42");
	const robustPythonLoaderPattern = String.raw`/^.*exec\(open\([\s\S]*?(?:pi-studio-re|pi-rc-)[\s\S]*?\)\)\s*$/gm`;
	assert.ok(clientSource.includes(robustPythonLoaderPattern));
	// Candidate 74: the server removes only its own submission's echo (shared/studio-repl-tmux.js),
	// and the browser keeps this cleanup for its older local entries and the live preview.
	assert.ok(!serverSource.includes(robustPythonLoaderPattern));
	assert.match(clientSource, /output: typeof entry\.output === "string" \? \(outputClean \? entry\.output : stripStudioReplSubmissionEcho\(entry\.output\)\) : ""/);
	assert.match(clientSource, /\(entry\.outputClean \|\| !entry\.legacyLocal\) && \(entry\.status === "captured"/);
});

test("Studio has numeric and mnemonic direct-switch shortcuts for REPL", () => {
	assert.match(clientSource, /Digit7: "repl"/);
	const replShortcutStart = clientSource.indexOf("const isReplShortcut");
	const sideQuestionsShortcutStart = clientSource.indexOf("const isSideQuestionsShortcut", replShortcutStart);
	assert.ok(replShortcutStart >= 0 && sideQuestionsShortcutStart > replShortcutStart);
	const shortcutSource = clientSource.slice(replShortcutStart, sideQuestionsShortcutStart);
	assert.match(shortcutSource, /code === "KeyR"/);
	assert.match(shortcutSource, /\(event\.metaKey \|\| event\.ctrlKey\)/);
	assert.match(shortcutSource, /event\.altKey/);
	assert.match(shortcutSource, /!event\.shiftKey/);
	assert.match(shortcutSource, /switchRightPaneToView\("repl", \{ focusReplComposer: true \}\)/);
	assert.match(serverSource, /Cmd\/Ctrl\+Option\/Alt\+R<\/dt><dd>Switch the right pane directly to REPL/);
});

test("Studio REPL Quick send keeps exact-lifetime drafts until acknowledgement", () => {
	assert.match(clientSource, /const REPL_QUICK_DRAFT_MAX_CHARS = 20_000/);
	assert.match(clientSource, /tmuxSessionId: session\.tmuxSessionId/);
	assert.match(clientSource, /tmuxSessionCreatedAt: session\.tmuxSessionCreatedAt/);
	assert.match(clientSource, /data-repl-quick-draft/);
	assert.match(clientSource, /data-repl-action='jump-controls'/);
	assert.match(clientSource, /function focusReplSessionControls\(\)[\s\S]*?critiqueViewEl\.scrollTop = 0/);
	assert.match(clientSource, /sessionSelect instanceof HTMLSelectElement && !sessionSelect\.disabled[\s\S]*?\? sessionSelect[\s\S]*?: runtimeSelect/);
	assert.match(clientSource, /action === "jump-controls"[\s\S]*?focusReplSessionControls\(\)/);
	assert.match(clientSource, /const tmuxTargetLabel = activeSession && activeSession\.target \? \("tmux " \+ activeSession\.target\) : ""/);
	assert.match(clientSource, /activeSession\.sessionName, tmuxTargetLabel/);
	assert.match(clientSource, /const visibleTargetLabel = activeSession \? activeSession\.sessionName : "No session selected"/);
	assert.match(clientSource, /title='Target: " \+ escapeHtml\(targetDetails\)/);
	assert.match(clientSource, /repl-quick-target-label'>" \+ escapeHtml\(visibleTargetLabel\)/);
	assert.match(clientSource, /Cmd\/Ctrl\+Enter sends/);
	assert.match(clientSource, /composer\.scrollIntoView\(\{ block: "nearest", inline: "nearest" \}\)/);
	const focusStart = clientSource.indexOf("      function focusReplQuickComposer");
	const focusEnd = clientSource.indexOf("      function renderReplViewIfActive", focusStart);
	assert.ok(focusStart >= 0 && focusEnd > focusStart, "expected Quick send focus helper");
	const focusSource = clientSource.slice(focusStart, focusEnd);
	assert.doesNotMatch(focusSource, /composer instanceof HTMLTextAreaElement && !composer\.disabled/,
		"the shortcut should still reveal a temporarily disabled composer");
	assert.ok(focusSource.indexOf("if (!composer.disabled)") < focusSource.indexOf("composer.scrollIntoView"),
		"scrolling the composer into view should not depend on whether it can receive focus");
	assert.match(clientSource, /options && options\.focusReplComposer && entry\.el === critiqueViewEl/);
	assert.match(clientSource, /target\.closest\("button, select, input, textarea, a,/,
		"focusing Quick send must not restore the response pane's old scroll position");
	const panelStart = clientSource.indexOf("      function buildReplPanelHtml");
	const panelEnd = clientSource.indexOf("      function buildTracePanelHtml", panelStart);
	assert.ok(panelStart >= 0 && panelEnd > panelStart, "expected REPL panel renderer");
	const panelSource = clientSource.slice(panelStart, panelEnd);
	const journalPosition = panelSource.indexOf("buildReplJournalHtml(transcript)");
	const actionsPosition = panelSource.indexOf("buildReplStudioActionsHtml()");
	const composerPosition = panelSource.indexOf("buildReplQuickComposerHtml(activeSession, canSendToActiveSession)");
	const mirrorPosition = panelSource.indexOf("buildReplMirrorHtml(body, transcript)");
	assert.ok(journalPosition < actionsPosition && actionsPosition < composerPosition && composerPosition < mirrorPosition,
		"Quick send should follow the clean record and its actions, before the raw mirror");
	assert.match(clientSource, /label: "quick send"[\s\S]*?mode: "raw"/);
	assert.match(clientSource, /type: "repl_send_request"/);
	assert.match(clientSource, /message\.type === "repl_send_ack"[\s\S]*?settleReplQuickPending\(responseRequestId, true\)/);
	assert.match(clientSource, /message\.type === "error"[\s\S]*?settleReplQuickPending\(failedReplRequestId, false\)/);
	assert.match(clientSource, /const settlesPendingRequest = Boolean\(responseRequestId && responseRequestId === replPendingRequestId\)/);
	assert.match(clientSource, /activeSessionIdentityChanged[\s\S]*?renderReplViewIfActive\(\{ force: activeSessionIdentityChanged \}\)/);

	const start = clientSource.indexOf("      function getReplQuickDraftKey");
	const end = clientSource.indexOf("      function setReplJournalCollapsed", start);
	assert.ok(start >= 0 && end > start, "expected Quick send draft helpers");
	const context = {};
	vm.runInNewContext(`
		const REPL_QUICK_DRAFT_MAX_CHARS = 20_000;
		const REPL_QUICK_DRAFT_MAX_SESSIONS = 12;
		const replQuickDrafts = new Map();
		let replQuickPending = null;
		let replQuickRefocus = null;
		let replPendingRequestId = "";
		let replBusy = false;
		let replJournalEntries = [];
		function normalizeReplRuntime(value) { return String(value || "unknown").toLowerCase(); }
		function normalizeReplSession(value) { return value && value.sessionName ? value : null; }
		${clientSource.slice(start, end)}
		globalThis.quickDraftApi = {
			key: getReplQuickDraftKey,
			get: getReplQuickDraft,
			set: setReplQuickDraft,
			settle: settleReplQuickPending,
			setPending(value) { replQuickPending = value; },
		};
	`, context);
	const firstLifetime = { sessionName: "pi-repl-python", runtime: "ipython", tmuxSessionId: "$1", tmuxSessionCreatedAt: 100 };
	const secondLifetime = { sessionName: "pi-repl-python", runtime: "ipython", tmuxSessionId: "$2", tmuxSessionCreatedAt: 200 };
	assert.equal(context.quickDraftApi.key({ sessionName: "pi-repl-python", runtime: "ipython" }), "", "drafts require exact tmux identity");
	assert.notEqual(context.quickDraftApi.key(firstLifetime), context.quickDraftApi.key(secondLifetime));
	assert.equal(context.quickDraftApi.set(firstLifetime, "print(1)"), "print(1)");
	assert.equal(context.quickDraftApi.get(secondLifetime), "");
	const key = context.quickDraftApi.key(firstLifetime);
	context.quickDraftApi.setPending({ requestId: "send-1", key, text: "print(1)" });
	assert.equal(context.quickDraftApi.settle("send-1", false), true);
	assert.equal(context.quickDraftApi.get(firstLifetime), "print(1)", "rejected text must be retained");
	context.quickDraftApi.setPending({ requestId: "send-2", key, text: "print(1)" });
	assert.equal(context.quickDraftApi.settle("send-2", true), true);
	assert.equal(context.quickDraftApi.get(firstLifetime), "", "acknowledged text may be cleared");
});

test("Studio sends bounded pane echoes with clean-record-derived anchors", () => {
	assert.match(serverSource, /createReplSubmissionDisplay\(\{/);
	assert.match(serverSource, /entryId: details\.submissionId/);
	assert.match(serverSource, /origin: "pi-studio"/);
	assert.match(serverSource, /PI_STUDIO_REPL_ECHO_MODE/);
	assert.equal((serverSource.match(/cleanStudioReplOutput\(rawOutput, \{\n\t+submissionLine: sent\.submissionText,\n\t+runtime: sent\.runtime,\n\t+display: sent\.display,/g) || []).length, 2);
	assert.match(clientSource, /echoMode: replEchoMode/);
	assert.match(serverSource, /<option value="summary" selected>Pane echo: Summary<\/option>/);
	assert.match(serverSource, /<option value="off">Pane echo: Off<\/option>/);
	assert.match(serverSource, /Pane echo: Summary/);
	assert.match(serverSource, /Pane echo: Full \(raw code\)/);
	assert.match(clientSource, /source code will remain in raw terminal history/);
});

test("Studio's pane echo defaults to Summary and keeps a choice", () => {
	const start = clientSource.indexOf("      let replEchoMode = (() => {");
	const end = clientSource.indexOf("})();", start);
	assert.ok(start >= 0 && end > start, "expected the stored echo-mode reader");
	const normalizeStart = clientSource.indexOf("      function normalizeReplEchoMode(value) {");
	const normalizeEnd = clientSource.indexOf("\n      }\n", normalizeStart);
	assert.ok(normalizeStart >= 0 && normalizeEnd > normalizeStart, "expected normalizeReplEchoMode");
	const read = (stored, throws = false) => {
		const localStorage = {
			getItem(key) {
				if (throws) throw new Error("blocked");
				return Object.hasOwn(stored, key) ? stored[key] : null;
			},
		};
		const context = { window: { localStorage } };
		vm.runInNewContext(`${clientSource.slice(start, end + "})();".length)}\nglobalThis.mode = replEchoMode;`, context);
		return context.mode;
	};
	assert.equal(read({}), "summary");
	assert.equal(read({}, true), "summary");
	// v2 stored Off for everyone, chosen or not; only a Full chosen there carries over.
	assert.equal(read({ "piStudio.replEchoMode.v2": "off" }), "summary");
	assert.equal(read({ "piStudio.replEchoMode.v2": "summary" }), "summary");
	assert.equal(read({ "piStudio.replEchoMode.v2": "full" }), "full");
	assert.equal(read({ "piStudio.replEchoMode.v3": "off", "piStudio.replEchoMode.v2": "full" }), "off");
	assert.equal(read({ "piStudio.replEchoMode.v3": "full" }), "full");
	assert.equal(read({ "piStudio.replEchoMode.v3": "bogus" }), "summary");
	const context = {};
	vm.runInNewContext(`${clientSource.slice(normalizeStart, normalizeEnd + "\n      }".length)}\nglobalThis.normalize = normalizeReplEchoMode;`, context);
	assert.deepEqual(["off", "OFF", "full", "summary", "", "bogus", undefined].map((value) => context.normalize(value)), ["off", "off", "full", "summary", "summary", "summary", "summary"]);
	assert.match(clientSource, /window\.localStorage\.setItem\("piStudio\.replEchoMode\.v3", replEchoMode\)/);
});

test("Studio browser reads, writes, migrates, and clears the shared record", () => {
	assert.match(clientSource, /type: "repl_journal_upsert_request"/);
	assert.match(clientSource, /type: "repl_journal_import_request"/);
	assert.match(clientSource, /type: "repl_journal_clear_request"/);
	assert.match(clientSource, /sharedSynced: !entry\.legacyLocal/);
	assert.match(serverSource, /sharedSynced: !studioReplUnsyncedJournalEntryIds\.has/);
	assert.match(clientSource, /journalEntryId: journalEntry\.id/);
	assert.match(clientSource, /message\.type === "repl_journal_ack"/);
	assert.match(serverSource, /selectedRecordEntries: recordEntries/);
	assert.match(clientSource, /Shared REPL Record/);
	assert.match(clientSource, /Commands typed directly into an attached tmux pane/);
});

test("Studio browser Markdown matches the canonical shared-record renderer", () => {
	const start = clientSource.indexOf("      function getMarkdownFenceForText");
	const end = clientSource.indexOf("      async function copyReplJournalToClipboard", start);
	assert.ok(start >= 0 && end > start, "expected browser Markdown helpers");
	const context = {
		getActiveReplJournalSessionName: () => "pi-repl-python",
		getVisibleReplJournalEntries: () => [],
	};
	vm.runInNewContext(
		`${clientSource.slice(start, end)}\nglobalThis.renderBrowserRecord = buildReplJournalMarkdown;`,
		context,
	);
	const entries = [
		{
			id: "entry-1",
			createdAt: 1_700_000_000_000,
			updatedAt: 1_700_000_000_500,
			label: "agent",
			origin: "pi-repl",
			mode: "agent",
			status: "captured",
			runtime: "shell",
			skippedChunks: 1,
			prose: "Run a command.",
			code: "printf 'hello'",
			output: "hello",
		},
		{
			id: "entry-2",
			createdAt: 1_700_000_001_000,
			updatedAt: 1_700_000_001_500,
			label: "raw",
			origin: "pi-studio",
			mode: "raw",
			status: "captured",
			runtime: "ipython",
			code: "print(42)",
			output: "42",
		},
	];
	const record = {
		protocol: "pi-repl-session-record",
		version: 1,
		createdAt: entries[0].createdAt,
		updatedAt: entries[1].updatedAt,
		session: { sessionName: "pi-repl-python" },
		entries,
	};
	assert.equal(context.renderBrowserRecord(entries), renderReplSessionRecordMarkdown(record));
});

test("Candidate 110: the agent is told of record entries, read-only, and the page says so", () => {
	assert.match(serverSource, /pi\.on\("before_agent_start", async \(\) => \{\n\t\tif \(replActivityMode !== "on"\) return undefined;/);
	assert.match(serverSource, /if \(replActivityMode === "off"\) return "";/);
	assert.match(serverSource, /recordActivity: replActivityMode,/);
	// Shown means its text is in what the model is given, not that a result with its ID ended (Astra).
	assert.match(serverSource, /pi\.on\("context_with_system", async \(event\) => \{[\s\S]{0,600}confirmReplActivityDelivered\(replActivity, texts\);[\s\S]{0,80}return undefined;/);
	assert.doesNotMatch(serverSource, /releaseReplActivityCommit/);
	assert.match(clientSource, /replRecordActivity === "off" \? "" : " New entries here go to the agent and its model provider\."/);
	// The collector reads; it never takes the inspection path, which can create record metadata.
	const start = serverSource.indexOf("async function observeStudioReplActivity");
	const body = serverSource.slice(start, serverSource.indexOf("\n}\n", start));
	assert.ok(start > 0 && body.includes("readReplRecordInert"));
	assert.doesNotMatch(body, /inspectStudioReplSession|attachStudioReplSessionRecord|ensureReplSessionRecord|readReplSessionRecord\(|upsertReplSessionRecordEntry/);
});

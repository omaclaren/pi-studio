import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { renderReplSessionRecordMarkdown } from "../shared/repl-session-record.js";

const serverSource = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");

test("Studio discovers and publishes the session-owned shared REPL record", () => {
	assert.match(serverSource, /REPL_SESSION_RECORD_ID_OPTION/);
	assert.match(serverSource, /REPL_SESSION_RECORD_VERSION_OPTION/);
	assert.match(serverSource, /set-option", "-qo"/);
	assert.match(serverSource, /#\{@pi_repl_record_id\}/);
	assert.match(serverSource, /tmuxSessionCreatedAt/);
	assert.match(serverSource, /readReplSessionRecord\(/);
	assert.match(serverSource, /upsertReplSessionRecordEntry\(/);
});

test("Studio serializes browser and tool sends with the cross-client lease", () => {
	const leaseCalls = serverSource.match(/acquireReplSessionSendLease\(/g) || [];
	assert.ok(leaseCalls.length >= 2, "expected browser and studio_repl_send lease acquisition");
	assert.match(serverSource, /owner: `pi-studio:tool:/);
	assert.match(serverSource, /owner: `pi-studio:browser:/);
	assert.match(serverSource, /Could not capture .* before sending/);
	assert.match(serverSource, /changed while Studio was waiting to send/);
	assert.match(serverSource, /getStudioReplPaneTarget\(tmuxSessionId \|\| sessionName\)/);
	assert.match(serverSource, /sendTextToStudioReplSession\(currentSession\.sessionName, params\.code, currentSession\.target, currentSession\.runtime, \{/);
	assert.match(serverSource, /retainStudioReplSubmissionUntilSettled/);
	assert.match(serverSource, /releaseOrRetainStudioReplSubmission/);
	assert.match(serverSource, /shared session remains busy until the running code settles/);
	assert.match(serverSource, /knownSession \|\| inspectStudioReplSession/);
	assert.match(serverSource, /submittedSession \|\| selected\.session/);
	assert.match(serverSource, /submittedSession \|\| session/);
});

test("Studio shell and GHCi sends retain completion after runtime errors", () => {
	assert.match(serverSource, /runtime === "shell"\) return `\. \$\{shellQuote\(sourceFile\)\}; touch/);
	assert.match(serverSource, /runtime === "shell"\) return "sh"/);
	assert.match(serverSource, /runtime === "ghci" \? buildStudioGhciCompletionLine/);
	assert.match(serverSource, /submissionText: \[submissionLine, completionLine\]\.filter\(Boolean\)\.join/);
	assert.match(serverSource, /stripStudioReplCompletionEcho/);
});

test("Studio uses compact private request-unique control files and cleans them after settlement", () => {
	assert.match(serverSource, /createPrivateReplControlFiles\(\{/);
	assert.match(serverSource, /getStudioReplControlExtension\(runtime\)/);
	assert.match(serverSource, /cleanupPrivateReplControlFiles\(controlFiles\)/);
	assert.match(serverSource, /retainStudioReplSubmissionUntilSettled\(session, controlFiles, lease\)/);
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
	assert.ok(serverSource.includes(robustPythonLoaderPattern));
	assert.match(clientSource, /output: typeof entry\.output === "string" \? stripStudioReplSubmissionEcho\(entry\.output\) : ""/);
	assert.match(clientSource, /!entry\.legacyLocal && \(entry\.status === "captured"/);
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
	assert.match(serverSource, /Cmd\/Ctrl\+Alt\+R<\/dt><dd>Switch the right pane directly to REPL/);
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
	assert.match(serverSource, /cleanStudioReplCapturedOutput\(rawOutput, sent\.display, sent\.completionLine\)/);
	assert.match(clientSource, /piStudio\.replEchoMode\.v2/);
	assert.match(clientSource, /return stored === "summary" \|\| stored === "full" \? stored : "off"/);
	assert.match(clientSource, /echoMode: replEchoMode/);
	assert.match(serverSource, /<option value="off" selected>Pane echo: Off<\/option>/);
	assert.match(serverSource, /Pane echo: Summary/);
	assert.match(serverSource, /Pane echo: Full \(raw code\)/);
	assert.match(clientSource, /source code will remain in raw terminal history/);
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

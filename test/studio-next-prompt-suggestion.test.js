// Suggest with the Prompt empty offers a next prompt, after Oliver's pi-next (28 Oct). The server's
// payload, output checks and model call run from index.ts with the model stubbed; the client's
// request path runs from studio-client.js. No Pi, provider or browser. Since c104 there is no
// context setting: the Prompt has the conversation, a Document only itself (Oliver, 29 Oct).
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { SessionManager } from "@earendil-works/pi-coding-agent";

const index = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const run = (code, context) => vm.runInContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText, context);
const between = (text, start, end) => {
	const a = text.indexOf(start), b = text.indexOf(end, a);
	assert(a >= 0 && b > a, start); return text.slice(a, b);
};

function server(respond) {
	const calls = [];
	const s = {
		calls, resolveStudioModelRequestAuth: async () => ({ apiKey: "test-key", headers: {} }),
		completeSimple: async (model, request, options) => { calls.push({ model, request, options }); return respond(request, options); },
	};
	vm.createContext(s);
	for (const name of ["STUDIO_NEXT_PROMPT_MAX_CONTEXT_CHARS", "STUDIO_NEXT_PROMPT_MAX_CHARS"])
		vm.runInContext(index.match(new RegExp("^const " + name + " = [\\d_]+;", "m"))[0].replace("const ", "var "), s);
	run(between(index, "function extractAssistantText(", "\nfunction "), s);
	run(between(index, "function normalizePromptText(", "\nfunction "), s);
	run(between(index, "function extractUserText(", "\nfunction "), s);
	run(between(index, "const STUDIO_NEXT_PROMPT_SYSTEM_PROMPT", "function inferStudioResponseKind("), s);
	return s;
}
const user = text => ({ type: "message", message: { role: "user", content: [{ type: "text", text }] } });
const reply = (text, stopReason = "stop", extra = []) => ({ type: "message", message: { role: "assistant", stopReason, content: [{ type: "thinking", thinking: "private" }, { type: "text", text }, ...extra] } });
const answer = (text, stopReason = "stop") => ({ stopReason, content: [{ type: "text", text }] });
// Raw entries as a Pi without context edits projects them.
const project = (entries) => entries.filter((entry) => entry.type === "message").map((entry) => ({ source: entry, message: entry.message }));

test("the payload is the latest finished reply and up to three prompts before it, as pi-next sends (Oliver, c104)", () => {
	const s = server();
	const entries = [user("one"), reply("a"), user("two"), reply("b"), { type: "custom_message", customType: "note", content: "not a prompt" },
		user("three"), { type: "message", message: { role: "toolResult", content: [{ type: "text", text: "tool" }] } }, user("four"), reply("Done: the tests pass.")];
	const built = s.buildStudioNextPromptPayload(project(entries));
	assert.deepEqual(JSON.parse(built.payload), { userMessages: ["two", "three", "four"], assistantReply: "Done: the tests pass." });
	assert.deepEqual(JSON.parse(s.buildStudioNextPromptPayload(project([user("only"), reply("ok")])).payload).userMessages, ["only"]);
	assert.deepEqual(JSON.parse(s.buildStudioNextPromptPayload(project(entries), "Show me an example").payload).previousSuggestion, "Show me an example");
});

test("no suggestion without a finished reply, after an approval ask, or when the latest prompt is remote", () => {
	const s = server(), skip = entries => s.buildStudioNextPromptPayload(project(entries)).skip;
	assert.equal(skip([]), "no-reply");
	assert.equal(skip([user("hi")]), "no-reply", "no reply yet");
	for (const stop of ["aborted", "length", "error", "toolUse"]) assert.equal(skip([user("hi"), reply("partial", stop)]), "no-reply", stop);
	assert.equal(skip([user("hi"), reply("calling", "stop", [{ type: "toolCall", id: "1", name: "bash", arguments: {} }])]), "no-reply");
	assert.equal(skip([user("hi"), reply("   ")]), "no-reply");
	assert.equal(skip([reply("orphan")]), "no-reply", "no prompt before it");
	assert.equal(skip([user("tidy up"), reply("I found two stale branches. Would you like me to delete them?")]), "approval");
	assert.equal(skip([user("tidy up"), reply("Shall I push the fix to main?")]), "approval");
	assert.equal(skip([user("[telegram] status?"), reply("All good.")]), "no-reply", "a Telegram exchange");
	const local = s.buildStudioNextPromptPayload(project([user("[telegram] status?"), reply("ok"), user("now the docs"), reply("Docs updated.")]));
	assert.deepEqual(JSON.parse(local.payload).userMessages, ["now the docs"], "an earlier remote prompt is left out");
});

test("long or escape-heavy text is clipped to the context limit and stays valid JSON", () => {
	const s = server();
	for (const text of ["x".repeat(50_000), "\"\\\n".repeat(20_000), "😀".repeat(10_000)]) {
		const built = s.buildStudioNextPromptPayload(project([user(text), reply(text), user(text), reply(text), user(text), reply(text)]));
		assert(built.payload.length <= 8_000, String(built.payload.length));
		const data = JSON.parse(built.payload);
		assert(data.userMessages.length >= 1 && data.assistantReply.length > 0);
		assert(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(built.payload), "no split surrogate");
	}
	// Three escape-heavy prompts and a full reply are over the limit: earlier prompts go before the reply is cut, as in pi-next.
	const quotes = "\"".repeat(1_000), built = s.buildStudioNextPromptPayload(project([user("a" + quotes), reply("ok"), user("b" + quotes), reply("ok"), user("c" + quotes), reply("x".repeat(4_000))]));
	assert.deepEqual(JSON.parse(built.payload).userMessages.map((text) => text[0]), ["c"]);
	assert.equal(JSON.parse(built.payload).assistantReply, "x".repeat(4_000));
});

test("the model's answer must be one short line; NO_SUGGESTION declines; a repeat is not another", () => {
	const s = server(), check = (text, stop, previous) => s.inspectStudioNextPromptSuggestion(answer(text, stop), previous);
	assert.deepEqual({ ...check("  Can you show an example?  ") }, { text: "Can you show an example?" });
	assert.equal(check("NO_SUGGESTION").outcome, "abstained");
	assert.equal(check(" no_suggestion ").outcome, "abstained");
	for (const bad of ["two\nlines", "tab\there", "x".repeat(201), "\"Quoted\"", "`code` first", "Suggestion: run it", "", "   "])
		assert.equal(check(bad).outcome, "rejected", JSON.stringify(bad));
	assert.deepEqual({ ...check("x".repeat(200)) }, { text: "x".repeat(200) });
	assert.equal(check("Fine", "length").outcome, "rejected");
	assert.equal(s.inspectStudioNextPromptSuggestion({ stopReason: "stop", content: [{ type: "toolCall" }, { type: "text", text: "Fine" }] }).outcome, "rejected");
	assert.equal(check("Show an example", "stop", "Show an example").outcome, "repeated");
});

test("the model call: pi-next's prompt, the payload as data, thinking off, and a stop or failure is not a suggestion", async () => {
	const entries = project([user("Explain the retry logic"), reply("It retries three times with backoff.")]);
	let s = server(() => answer("What happens after the third failure?"));
	const model = { provider: "test", id: "m" };
	assert.deepEqual({ ...(await s.runStudioNextPromptSuggestion({ model }, entries, {})) }, { suggestion: "What happens after the third failure?" });
	const [{ request, options }] = s.calls;
	assert.match(request.systemPrompt, /^Predict the single short message this user would naturally type next/);
	assert.match(request.systemPrompt, /at most 200 characters\.$/);
	assert.deepEqual(JSON.parse(request.messages[0].content[0].text).userMessages, ["Explain the retry logic"]);
	assert.equal(options.reasoning, undefined); assert.equal(options.maxTokens, 256);

	s = server(() => answer("NO_SUGGESTION"));
	assert.match((await s.runStudioNextPromptSuggestion({ model }, entries, {})).message, /nothing specific follows/);
	s = server(() => { throw new Error("must not be called"); });
	assert.match((await s.runStudioNextPromptSuggestion({ model }, project([user("hi")]), {})).message, /no finished reply/);
	assert.equal(s.calls.length, 0, "no model request without a reply");
	s = server(() => ({ stopReason: "error", errorMessage: "overloaded", content: [] }));
	await assert.rejects(s.runStudioNextPromptSuggestion({ model }, entries, {}), /overloaded/);
	const controller = new AbortController();
	s = server(() => { controller.abort(); return answer("Late answer", "aborted"); });
	await assert.rejects(s.runStudioNextPromptSuggestion({ model }, entries, { signal: controller.signal }), /stopped/);
});

// The server's actual request handler, with the model held until the test releases it.
function handler() {
	let release;
	const s = server(() => new Promise((resolve) => { release = (text = "Explain the third step") => resolve(answer(text)); }));
	const sent = [], branch = { entries: [user("Explain the Alpha plan"), { ...reply("Alpha has three steps."), id: "alpha-reply" }] };
	const manager = { getBranch: () => branch.entries, getSessionId: () => "session-1" };
	Object.assign(s, { AbortController, sent, branch, manager, agentBusy: false, compactInProgress: false, latestSessionManager: manager, lastCommandCtx: null,
		latestModelRequestCtx: { model: { provider: "test", id: "m" }, modelRegistry: {} }, activeCompletionSuggestions: new Map(),
		isValidRequestId: () => true, sendToClient: (_client, message) => sent.push(message), formatStudioModelOptionLabel: () => "test/m",
		runStudioCompletionSuggestion: async () => " completion", STUDIO_COMPLETION_MAX_TEXT_CHARS: 250_000 });
	run("function handle(client, msg) {" + between(index, '		if (msg.type === "completion_suggestion_request") {', '		if (msg.type === "quiz_generate_request"') + "}", s);
	const ask = (fields = {}) => s.handle({}, { type: "completion_suggestion_request", requestId: "r" + sent.length, text: "", selectionStart: 0, selectionEnd: 0, contextMode: "session", nextPrompt: true, ...fields });
	const final = () => sent.filter((m) => m.type !== "completion_suggestion_progress").at(-1);
	return { s, sent, branch, ask, final, release: (text) => release(text), tick: () => new Promise((r) => setImmediate(r)) };
}

test("the handler: a next prompt for an empty request, whatever its contextMode, and not while Pi is working", async () => {
	let h = handler();
	h.ask({ nextPrompt: undefined });
	assert.equal(h.final().message, "Editor is empty.");
	h.s.agentBusy = true; h.ask();
	assert.equal(h.final().message, "Suggest offers a next prompt once Pi has finished.");
	assert.equal(h.s.calls.length, 0, "no model request in either");
	// c102 refused contextMode "cursor"; with no setting, the Prompt always has the conversation (Oliver, c104).
	for (const contextMode of ["session", "cursor", undefined]) {
		h = handler(); h.ask({ contextMode }); await h.tick(); h.release(); await h.tick(); await h.tick();
		assert.deepEqual([h.final().type, h.final().suggestion, h.final().nextPrompt], ["completion_suggestion_result", "Explain the third step", true], String(contextMode));
	}
	assert.doesNotMatch(index, /set Suggest's context/);
	assert.match(index, /nextPrompt: msg\.nextPrompt === true \? true : undefined,/);
	assert.match(index, /latestSessionManager = ctx\.sessionManager;/);
});

test("a next prompt generated for an exchange the conversation has left is not delivered (Sol, c102)", async () => {
	const changes = {
		"/tree to another branch": (h) => { h.branch.entries = [user("Explain the Beta plan"), { ...reply("Beta has two stages."), id: "beta-reply" }]; },
		"a new reply on the same branch": (h) => { h.branch.entries = [...h.branch.entries, user("go on"), { ...reply("Done."), id: "later-reply" }]; },
		"a run starting": (h) => { h.s.agentBusy = true; },
		"another session": (h) => { h.s.latestSessionManager = { getBranch: () => h.branch.entries, getSessionId: () => "session-2" }; },
		"a context edit": (h) => { h.branch.entries = [...h.branch.entries, { type: "context_edit", id: "edit-1", targetId: "alpha-reply", replacement: null }]; },
	};
	for (const [name, change] of Object.entries(changes)) {
		const h = handler(); h.ask(); await h.tick();
		change(h); h.release("Explain the third Alpha step"); await h.tick(); await h.tick();
		assert.equal(h.final().type, "completion_suggestion_error", name);
		assert.equal(h.final().message, "No suggestion: the conversation changed while it was being generated. Ask again.", name);
	}
	const unchanged = handler(); unchanged.ask(); await unchanged.tick();
	unchanged.branch.entries = [...unchanged.branch.entries, { type: "model_change", id: "m1" }];
	unchanged.release(); await unchanged.tick(); await unchanged.tick();
	assert.equal(unchanged.final().type, "completion_suggestion_result", "an entry that isn't a message doesn't count");
});

function client({ text = "", role = "prompt", editorOnly = false, watched = false, switching = true } = {}) {
	const sent = [];
	const c = {
		bufferRecoveryEnabled: false, isEditorOnlyMode: editorOnly, isWatchedFilePreview: watched, bufferSwitchingEnabled: switching,
		sourceTextEl: { value: text, selectionStart: text.length, selectionEnd: text.length }, editorLanguage: "markdown", sourceState: { label: "Prompt" }, editorView: "markdown",
		completionSuggestionState: null, completionSuggestionInFlight: false, completionSuggestionRequestId: null, completionSuggestionPendingSnapshot: null,
		completionSuggestionRefocusEditorOnResult: false, responseHistory: [{ id: "response-a-001", markdown: "Alpha has three steps." }], nextPromptConversationEpoch: 0,
		completionSuggestionPanelEl: { hidden: true }, completionSuggestionTextEl: { textContent: "" }, completionSuggestionMetaEl: { textContent: "" },
		completionSuggestionTitleEl: { textContent: "Suggested completion" }, suggestCompletionBtn: {}, footerSuggestBtn: null,
		document: { activeElement: null }, Element: class {}, window: { setTimeout() {} },
		getStudioSelectedBuffer: () => ({ role }), getCompletionSuggestionContextText: () => "Latest response:\nsomething",
		getCompletionSuggestionModelSelection: () => null, getCompletionSuggestionModelLabel: () => "test model",
		makeRequestId: () => "r" + (sent.length + 1), sendMessage: message => { sent.push(message); return true; },
		syncActionButtons() {}, setStatus(text) { c.status = text; }, focusSourceEditorForCompletion() {}, applySourceTextEdit(value) { c.sourceTextEl.value = value; },
	};
	vm.createContext(c);
	vm.runInContext(between(source, "function isStudioDocumentBufferView()", "function studioBuffersCanSwitch("), c);
	vm.runInContext(between(source, "function hideCompletionSuggestion()", "function getSourceTextLineEditBounds("), c);
	return { c, sent };
}

test("Suggest on an empty Prompt asks for a next prompt; an empty Document, editor-only tab or watched file doesn't", () => {
	let { c, sent } = client();
	c.requestCompletionSuggestion();
	assert.equal(sent.length, 1);
	assert.equal(sent[0].nextPrompt, true); assert.equal(sent[0].text, ""); assert.equal(sent[0].contextText, undefined, "the server reads the session itself");
	assert.equal(sent[0].contextMode, "session", "a next prompt is from the conversation");
	assert.equal(c.status, "Suggesting a next prompt…");
	({ c, sent } = client({ switching: false }));
	c.requestCompletionSuggestion(); assert.equal(sent[0].nextPrompt, true, "without buffer switching the editor is the prompt");
	for (const options of [{ role: "document" }, { editorOnly: true }, { watched: true }]) {
		({ c, sent } = client(options));
		c.requestCompletionSuggestion();
		assert.equal(sent.length, 0, JSON.stringify(options)); assert.equal(c.status, "Editor is empty.");
	}
	({ c, sent } = client({ text: "Draft " }));
	c.requestCompletionSuggestion();
	assert.equal(sent[0].nextPrompt, undefined, "text in the editor is an ordinary completion");
	assert.equal(sent[0].contextText, "Latest response:\nsomething");
	assert.equal(sent[0].contextMode, "session", "the mode says what is sent");
	({ c, sent } = client({ text: "Draft ", role: "document" }));
	c.getCompletionSuggestionContextText = () => "";
	c.requestCompletionSuggestion();
	assert.equal(sent[0].contextText, undefined); assert.equal(sent[0].contextMode, "cursor");
});

test("a suggested prompt shows under its own title, Try another sends it back, and Insert puts it in the Prompt", () => {
	const { c, sent } = client();
	c.requestCompletionSuggestion();
	c.handleCompletionSuggestionServerMessage({ type: "completion_suggestion_result", requestId: sent[0].requestId, suggestion: "Show an example", nextPrompt: true, selectionStart: 0, selectionEnd: 0 });
	assert.equal(c.completionSuggestionTitleEl.textContent, "Suggested prompt");
	assert.equal(c.completionSuggestionTextEl.textContent, "Show an example");
	c.requestCompletionSuggestion({ regenerate: true });
	assert.equal(sent[1].nextPrompt, true); assert.equal(sent[1].previousSuggestion, "Show an example");
	c.handleCompletionSuggestionServerMessage({ type: "completion_suggestion_result", requestId: sent[1].requestId, suggestion: "Why three retries?", nextPrompt: true });
	c.insertCompletionSuggestion();
	assert.equal(c.sourceTextEl.value, "Why three retries?");
	assert.equal(c.status, "Inserted suggested prompt.");
	c.sourceTextEl.value = "Go on"; c.sourceTextEl.selectionStart = c.sourceTextEl.selectionEnd = 5;
	c.requestCompletionSuggestion();
	c.handleCompletionSuggestionServerMessage({ type: "completion_suggestion_result", requestId: sent[2].requestId, suggestion: " please." });
	assert.equal(c.completionSuggestionTitleEl.textContent, "Suggested completion", "a completion keeps its title");
});

test("the Suggest button stays enabled on an empty Prompt and says what it will do", () => {
	const sync = between(source, "        if (suggestCompletionBtn) {\n          const hasSuggestionForCurrentText", "        if (suggestCompletionOptionsBtn)");
	assert.match(sync, /\(editorEmpty && !isNextPromptEditor\(\)\)/);
	assert.match(sync, /"Suggest a next prompt from Pi's recent prompts and latest reply\./);
	assert.match(source, /In the Prompt it reads the conversation too, and suggests a next prompt when the Prompt is empty; in a Document, only the Document\./);
	assert.match(index, /<strong id="completionSuggestionTitle">Suggested completion<\/strong>/);
});

// The page's own history update, as /tree's response_history reaches it, with the Prompt left empty (Sol, c102).
function historyClient() {
	const h = client();
	Object.assign(h.c, { studioRunFollowingAvailable: () => false, normalizeHistoryItem: (item) => item, getSelectedHistoryItem: () => null, rightView: "preview",
		responseHistoryIndex: 0, clearActiveResponseView() {}, syncTraceForSelectedHistoryItem() {}, syncStudioPromptHistorySelection() {}, updateHistoryControls() {},
		responseHistorySelectionIndex: (items) => items.length - 1, applySelectedHistoryItem() {}, selectHistoryIndex: () => true });
	vm.runInContext(between(source, "function setResponseHistory(", "function responseHistorySelectionIndex("), h.c);
	return h;
}

test("a suggested prompt goes when the branch's latest response changes: pending, showing, or at Insert (Sol, c102)", () => {
	const beta = [{ id: "response-b-001", markdown: "Beta has two stages." }];
	let { c, sent } = historyClient();
	c.requestCompletionSuggestion();
	c.setResponseHistory(beta, { branchSync: true });
	c.handleCompletionSuggestionServerMessage({ type: "completion_suggestion_result", requestId: sent[0].requestId, suggestion: "Explain the third Alpha step", nextPrompt: true });
	assert.equal(c.completionSuggestionPanelEl.hidden, true, "a late result for the old branch is not shown");
	assert.equal(c.status, "The conversation changed while the suggestion was generating. Ask again.");

	({ c, sent } = historyClient());
	c.requestCompletionSuggestion();
	c.handleCompletionSuggestionServerMessage({ type: "completion_suggestion_result", requestId: sent[0].requestId, suggestion: "Explain the third Alpha step", nextPrompt: true });
	assert.equal(c.completionSuggestionPanelEl.hidden, false);
	c.setResponseHistory([...c.responseHistory], { silent: true });
	assert.equal(c.completionSuggestionPanelEl.hidden, false, "the same history keeps it");
	c.setResponseHistory(beta, { branchSync: true });
	assert.equal(c.completionSuggestionPanelEl.hidden, true, "a showing suggestion goes");
	assert.equal(c.status, "Suggested prompt dismissed: the conversation changed.");

	({ c, sent } = historyClient());
	c.requestCompletionSuggestion();
	c.handleCompletionSuggestionServerMessage({ type: "completion_suggestion_result", requestId: sent[0].requestId, suggestion: "Explain the third Alpha step", nextPrompt: true });
	c.responseHistory = beta; // as if the history arrived without passing through setResponseHistory
	c.insertCompletionSuggestion();
	assert.equal(c.sourceTextEl.value, "", "Insert refuses it");
	assert.equal(c.status, "Suggested prompt dismissed: the conversation changed.");

	({ c, sent } = historyClient({}));
	c.sourceTextEl.value = "Draft "; c.sourceTextEl.selectionStart = c.sourceTextEl.selectionEnd = 6;
	c.requestCompletionSuggestion();
	c.handleCompletionSuggestionServerMessage({ type: "completion_suggestion_result", requestId: sent[0].requestId, suggestion: "more." });
	c.setResponseHistory(beta, { branchSync: true });
	assert.equal(c.completionSuggestionPanelEl.hidden, false, "an ordinary completion is the editor's, not the conversation's");
	assert.match(source, /if \(message\.type === "response_history"\) \{[\s\S]{0,600}setResponseHistory\(message\.items,/, "/tree's history goes through setResponseHistory");
});

// Pi's real in-memory session, with context edits that omit or replace a message (Astra, c102).
const piAssistant = (text) => ({ role: "assistant", content: [{ type: "text", text }], api: "test", provider: "test", model: "test", stopReason: "stop", timestamp: 2,
	usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } });
const piUser = (text) => ({ role: "user", content: [{ type: "text", text }], timestamp: 1 });
function editedSession(edit) {
	const manager = SessionManager.inMemory("/tmp");
	manager.appendMessage(piUser("an earlier prompt")); manager.appendMessage(piAssistant("an earlier reply"));
	const prompt = manager.appendMessage(piUser("PRIVATE latest prompt")), reply = manager.appendMessage(piAssistant("PRIVATE latest reply"));
	edit(manager, { prompt, reply });
	return manager;
}

test("Suggest sends the conversation as the model sees it: omitted or replaced text never (Astra, c102)", async () => {
	const s = server(), text = (content) => ({ content: [{ type: "text", text: content }] });
	const payload = (edit) => s.buildStudioNextPromptPayload(s.readStudioNextPromptMessages(editedSession(edit)));
	let built = payload((m, ids) => { m.appendContextEdit(ids.prompt, text("Explain the retry logic")); m.appendContextEdit(ids.reply, text("It retries three times.")); });
	assert.deepEqual(JSON.parse(built.payload), { userMessages: ["an earlier prompt", "Explain the retry logic"], assistantReply: "It retries three times." }, "replacements");
	built = payload((m, ids) => m.appendContextEdit(ids.prompt, null));
	assert.deepEqual(JSON.parse(built.payload).userMessages, ["an earlier prompt"], "an omitted prompt is left out");
	assert.equal(payload((m, ids) => m.appendContextEdit(ids.reply, null)).skip, "no-reply", "an omitted reply leaves nothing to follow");
	assert.match(payload(() => {}).payload, /PRIVATE latest reply/, "the control: unedited text is sent");

	// The same through the server's handler and the model request it makes.
	const h = handler();
	h.s.latestSessionManager = editedSession((m, ids) => { m.appendContextEdit(ids.prompt, null); m.appendContextEdit(ids.reply, text("Replaced reply.")); });
	h.ask(); await h.tick(); h.release("Show an example"); await h.tick(); await h.tick();
	assert.equal(h.final().suggestion, "Show an example");
	const sentToModel = JSON.stringify(h.s.calls.at(-1).request);
	assert(!sentToModel.includes("PRIVATE"), sentToModel);
	assert.match(sentToModel, /Replaced reply\./);
});

// The server's actual history builder, whose ids come from the reply text alone.
async function realHistoryBuilder() {
	const { isStudioShowMePrompt } = await import("../shared/studio-show-me.js");
	const { createHash } = await import("node:crypto");
	const s = { createHash, isStudioShowMePrompt };
	vm.createContext(s);
	vm.runInContext(index.match(/^const RESPONSE_HISTORY_LIMIT = [\d_]+;/m)[0].replace("const ", "var "), s);
	for (const name of ["extractAssistantText", "normalizePromptText", "extractUserText", "extractAssistantThinking", "extractPersistedStudioPromptMetadata", "buildStudioPromptDescriptor", "inferStudioResponseKind"])
		run(between(index, "function " + name + "(", "\nfunction "), s);
	run(between(index, "function findLatestUserPrompt(", "function normalizeContextUsageSnapshot("), s);
	return (prompt, replyText, n) => s.buildResponseHistoryFromEntries([
		{ type: "message", id: "u" + n, parentId: null, timestamp: "2026-10-28T00:00:00.000Z", message: { role: "user", content: [{ type: "text", text: prompt }] } },
		{ type: "message", id: "a" + n, parentId: "u" + n, timestamp: "2026-10-28T00:00:01.000Z", message: { role: "assistant", stopReason: "stop", content: [{ type: "text", text: replyText }] } },
	]);
}

test("/tree to a branch whose history looks the same still retires a suggested prompt (Sol, c102 round 2)", async () => {
	const history = await realHistoryBuilder();
	const alpha = history("Update the Alpha tests", "Done.", 1), beta = history("Update the Beta docs", "Done.", 2);
	assert.equal(alpha.at(-1).id, beta.at(-1).id, "the display ids alias: both branches end \"Done.\"");
	assert.notEqual(alpha.at(-1).prompt, beta.at(-1).prompt);
	const setup = () => {
		const h = historyClient();
		Object.assign(h.c, { followLatest: true, queuedLatestResponse: null });
		vm.runInContext("globalThis.historyMessage = function (message) {" + between(source, '        if (message.type === "response_history") {', '        if (message.type === "save_conflict") {') + "};", h.c);
		h.c.historyMessage({ type: "response_history", items: alpha });
		h.c.requestCompletionSuggestion();
		return h;
	};
	const show = (h) => h.c.handleCompletionSuggestionServerMessage({ type: "completion_suggestion_result", requestId: h.sent.at(-1).requestId, suggestion: "Explain the Alpha test changes", nextPrompt: true });

	let h = setup(); show(h);
	h.c.historyMessage({ type: "response_history", items: alpha });
	assert.equal(h.c.completionSuggestionPanelEl.hidden, false, "an ordinary refresh of the same history keeps it");
	h.c.historyMessage({ type: "response_history", reason: "tree", items: beta });
	assert.equal(h.c.completionSuggestionPanelEl.hidden, true, "a showing suggestion goes on /tree");
	assert.equal(h.c.status, "Suggested prompt dismissed: the conversation changed.");
	h.c.insertCompletionSuggestion();
	assert.equal(h.c.sourceTextEl.value, "", "and Insert has nothing to insert");

	h = setup();
	h.c.historyMessage({ type: "response_history", reason: "tree", items: beta });
	show(h);
	assert.equal(h.c.completionSuggestionPanelEl.hidden, true, "a pending one is dropped when it arrives");
	assert.equal(h.c.status, "The conversation changed while the suggestion was generating. Ask again.");
	assert.match(source, /clearEditorAsyncOperations\(\);\n\s+if \(typeof markNextPromptBranchChange === "function"\) \{ markNextPromptBranchChange\(\); retireStaleNextPromptSuggestion\(\{ quiet: true \}\); \}/, "a lost connection, as a session switch causes, retires it too");
});

test("Suggest beside Compact does what the menu's Suggest does, and says the same (Oliver, c104)", () => {
	assert.match(index, /Compact<\/button><button id="footerSuggestBtn" class="footer-compact-btn" type="button" hidden>Suggest<\/button><\/span>/, "after Compact, hidden until the new layout shows it");
	assert.match(between(source, "      function setupStudioUiRefreshPrototype() {", "      function debugTrace("), /if \(footerSuggestBtn && suggestCompletionBtn\) footerSuggestBtn.hidden = false;/);
	assert.match(source, /footerSuggestBtn\.addEventListener\("click", \(\) => \{\n\s+requestCompletionSuggestion\(\);\n\s+\}\);/);
	// The actual button sync, for an empty Prompt, an empty Document, text, a ready suggestion and a running request.
	const sync = between(source, "        if (suggestCompletionBtn) {\n          const hasSuggestionForCurrentText", "        if (suggestCompletionOptionsBtn)");
	const state = (fields) => {
		const c = vm.createContext({ suggestCompletionBtn: {}, footerSuggestBtn: {}, isWatchedFilePreview: false, wsState: "Ready", uiBusy: false, completionSuggestionInFlight: false,
			completionSuggestionState: null, sourceTextEl: { value: "" }, isNextPromptEditor: () => true, ...fields });
		vm.runInContext(sync, c);
		assert.deepEqual([c.footerSuggestBtn.disabled, c.footerSuggestBtn.textContent, c.footerSuggestBtn.title], [c.suggestCompletionBtn.disabled, c.suggestCompletionBtn.textContent, c.suggestCompletionBtn.title]);
		return [c.footerSuggestBtn.disabled, c.footerSuggestBtn.textContent, c.footerSuggestBtn.title.split(".")[0]];
	};
	assert.deepEqual(state({}), [false, "Suggest", "Suggest a next prompt from Pi's recent prompts and latest reply"]);
	assert.deepEqual(state({ isNextPromptEditor: () => false }), [true, "Suggest", "Ask for a short completion at the editor cursor"]);
	assert.deepEqual(state({ sourceTextEl: { value: "Draft" } }), [false, "Suggest", "Ask for a short completion at the editor cursor"]);
	assert.deepEqual(state({ sourceTextEl: { value: "Draft" }, completionSuggestionState: { baseText: "Draft" } }), [false, "Try another", "Ask for a different suggestion at the same cursor position"]);
	assert.deepEqual(state({ completionSuggestionInFlight: true, uiBusy: true }), [false, "Stop", "Stop the current suggestion request"]);
	// Clicked from the footer, a result returns focus to the editor as from the menu's button.
	const { c } = client();
	c.footerSuggestBtn = {}; c.document.activeElement = c.footerSuggestBtn;
	assert.equal(c.shouldRefocusEditorForCompletionRequest(), true);
	c.document.activeElement = {};
	assert.equal(c.shouldRefocusEditorForCompletionRequest(), false, "the control: focus elsewhere stays");
	assert.doesNotMatch(index + source, /completionContextSelect|data-completion-context-mode|piStudio\.completionContextMode/, "the setting is gone");
});

// The actual context builder for a completion, in the Prompt and in a Document (Oliver, c104).
function contextClient(options = {}, history = [], index = history.length - 1) {
	const { c } = client(options);
	Object.assign(c, { responseHistory: history, latestResponseMarkdown: "", getSelectedHistoryItem: () => history[index] || null });
	vm.runInContext(source.match(/const COMPLETION_CONTEXT_MAX_CHARS = \d+;/)[0].replace("const ", "var "), c);
	vm.runInContext(between(source, "function trimCompletionContextText(", "function hideCompletionSuggestion()"), c);
	return c;
}

test("a completion in the Prompt has up to three prompts and the shown response; in a Document, nothing more (Oliver, c104)", () => {
	const item = (n, fields = {}) => ({ id: "r" + n, markdown: "reply " + n, prompt: "prompt " + n, ...fields });
	const four = [item(1), item(2), item(3, { promptTriggerText: "steer 3" }), item(4)];
	assert.equal(contextClient({}, four).getCompletionSuggestionContextText(),
		"Earlier prompt:\nprompt 2\n\n---\n\nEarlier prompt:\nsteer 3\n\n---\n\nLatest prompt:\nprompt 4\n\n---\n\nLatest response:\nreply 4");
	assert.equal(contextClient({}, four, 1).getCompletionSuggestionContextText(),
		"Earlier prompt:\nprompt 1\n\n---\n\nLatest prompt:\nprompt 2\n\n---\n\nLatest response:\nreply 2", "an older response shown: the prompts up to it");
	assert.equal(contextClient({}, [item(1), item(2, { prompt: "prompt 1" })]).getCompletionSuggestionContextText(),
		"Latest prompt:\nprompt 1\n\n---\n\nLatest response:\nreply 2", "two replies to one prompt give it once");
	for (const options of [{ role: "document" }, { editorOnly: true }, { watched: true }])
		assert.equal(contextClient(options, four).getCompletionSuggestionContextText(), "", JSON.stringify(options));
	// A long response keeps its end and leaves the prompts their room; a long prompt keeps both ends.
	const long = contextClient({}, [item(1, { prompt: "P".repeat(5_000) + "end" }), item(2, { markdown: "start" + "r".repeat(50_000) + "the end" })]).getCompletionSuggestionContextText();
	assert(long.length <= 12_000, String(long.length));
	assert.match(long, /^Earlier prompt:\nP{500} …\[truncated\]… P{497}end\n\n---\n\nLatest prompt:\nprompt 2\n\n---\n\nLatest response:\nr+the end$/);
	assert.equal(contextClient({}, []).getCompletionSuggestionContextText(), "", "no conversation yet");
});

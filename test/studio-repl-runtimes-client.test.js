import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Candidate82, REPL parity step 2: the page knows Ruby and Java as runtimes.
const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");

function declaration(name) {
	const start = source.search(new RegExp("\\n      (?:async )?function " + name + "\\("));
	assert(start >= 0, name);
	return source.slice(start, source.indexOf("\n      }\n", start) + 9);
}

const context = vm.createContext({ getActiveReplRuntime: () => "python" });
vm.runInContext(["getKnownReplRuntime", "normalizeReplRuntime", "getReplRuntimeLabel", "normalizeMarkdownFenceLanguage",
	"isFenceLanguageCompatibleWithRuntime", "getReplStudioPrompt", "isReplStudioPromptLine", "extractReplStudioBanner"].map(declaration).join("\n"), context);

test("Ruby and Java are runtimes the page knows, with their labels and prompts", () => {
	assert.deepEqual(["ruby", "java", "Ruby", "octave"].map((value) => context.getKnownReplRuntime(value)), ["ruby", "java", "ruby", ""]);
	assert.deepEqual(["ruby", "java"].map((value) => context.getReplRuntimeLabel(value)), ["Ruby", "Java"]);
	assert.deepEqual(["ruby", "java"].map((value) => context.getReplStudioPrompt(value)), ["irb>", "jshell>"]);
	const options = source.slice(source.indexOf("function buildReplPanelHtml()"), source.indexOf("].map(([value, label])", source.indexOf("function buildReplPanelHtml()")));
	assert.match(options, /\["clojure", "Clojure"\],\n\s+\["ruby", "Ruby"\],\n\s+\["java", "Java"\],/);
});

test("Literate send matches Ruby and Java code chunks", () => {
	assert.deepEqual(["ruby", "rb", "{.ruby}", "java"].map((value) => context.normalizeMarkdownFenceLanguage(value)), ["ruby", "ruby", "ruby", "java"]);
	assert.equal(context.isFenceLanguageCompatibleWithRuntime("rb", "ruby"), true);
	assert.equal(context.isFenceLanguageCompatibleWithRuntime("java", "java"), true);
	assert.equal(context.isFenceLanguageCompatibleWithRuntime("python", "ruby"), false);
	assert.equal(context.isFenceLanguageCompatibleWithRuntime("ruby", "java"), false);
});

test("JShell's banner shows above the record; prompts end it", () => {
	const jshell = "|  Welcome to JShell -- Version 25.0.2\n|  For an introduction type: /help intro\n\njshell> System.out.println(1);\n1";
	assert.equal(context.extractReplStudioBanner(jshell, "java"), "|  Welcome to JShell -- Version 25.0.2\n|  For an introduction type: /help intro");
	assert.equal(context.isReplStudioPromptLine("irb(main):001> x", "ruby"), true);
	assert.equal(context.isReplStudioPromptLine("irb(main):001:0> x", "ruby"), true);
	assert.equal(context.isReplStudioPromptLine("jshell> x", "java"), true);
	assert.equal(context.isReplStudioPromptLine("puts 1", "ruby"), false);
});

test("a record with JShell's longer prompt gets a wider prompt column", () => {
	const css = readFileSync(new URL("../client/studio.css", import.meta.url), "utf8");
	assert.match(source, /"<div class='repl-journal-list" \+ \(visibleEntries\.some\(\(entry\) => getReplStudioPrompt\(entry\.runtime\)\.length > 6\) \? " repl-journal-list-wide-prompt" : ""\) \+ "'>"/);
	assert.match(css, /\.repl-journal-list-wide-prompt \{\n\s+--repl-studio-prompt-width: 3\.9em;\n\s+\}/);
	// Only Java's prompt is longer than six characters.
	assert.deepEqual(["shell", "python", "ipython", "julia", "r", "ghci", "clojure", "ruby", "java"].filter((runtime) => context.getReplStudioPrompt(runtime).length > 6), ["java"]);
});

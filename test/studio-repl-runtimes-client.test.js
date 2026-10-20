import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// REPL parity steps 2 to 5: the page knows Ruby and Java (candidate82), Octave and MATLAB
// (candidate88), gnuplot (candidate90) and C++ (candidate92), as runtimes.
const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");

function declaration(name) {
	const start = source.search(new RegExp("\\n      (?:async )?function " + name + "\\("));
	assert(start >= 0, name);
	return source.slice(start, source.indexOf("\n      }\n", start) + 9);
}

const context = vm.createContext({ getActiveReplRuntime: () => "python" });
vm.runInContext(["getKnownReplRuntime", "normalizeReplRuntime", "getReplRuntimeLabel", "normalizeMarkdownFenceLanguage",
	"isFenceLanguageCompatibleWithRuntime", "getReplStudioPrompt", "isReplStudioPromptLine", "extractReplStudioBanner", "getReplRuntimeHighlightLanguage"].map(declaration).join("\n"), context);

test("Ruby and Java are runtimes the page knows, with their labels and prompts", () => {
	assert.deepEqual(["ruby", "java", "Ruby", "bun"].map((value) => context.getKnownReplRuntime(value)), ["ruby", "java", "ruby", ""]);
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

test("Octave and MATLAB are separate runtimes, with their own labels, prompts, chunks and menu entries", () => {
	assert.deepEqual(["octave", "matlab", "MATLAB"].map((value) => context.getKnownReplRuntime(value)), ["octave", "matlab", "matlab"]);
	assert.deepEqual(["octave", "matlab"].map((value) => context.getReplRuntimeLabel(value)), ["Octave", "MATLAB"]);
	assert.deepEqual(["octave", "matlab"].map((value) => context.getReplStudioPrompt(value)), ["octave>", ">>"]);
	assert.deepEqual(["octave", "matlab"].map((value) => context.getReplRuntimeHighlightLanguage(value)), ["matlab", "matlab"], "MATLAB's highlighter for both");
	const options = source.slice(source.indexOf("function buildReplPanelHtml()"), source.indexOf("].map(([value, label])", source.indexOf("function buildReplPanelHtml()")));
	assert.match(options, /\["java", "Java"\],\n\s+\["octave", "Octave"\],\n\s+\["matlab", "MATLAB"\],/);
	// Neither runtime takes the other's chunks, as pi-repl never substitutes one for the other.
	assert.equal(context.isFenceLanguageCompatibleWithRuntime("octave", "octave"), true);
	assert.equal(context.isFenceLanguageCompatibleWithRuntime("matlab", "matlab"), true);
	assert.equal(context.isFenceLanguageCompatibleWithRuntime("matlab", "octave"), false);
	assert.equal(context.isFenceLanguageCompatibleWithRuntime("octave", "matlab"), false);
	assert.equal(context.isReplStudioPromptLine("octave:12> x = 1", "octave"), true);
	assert.equal(context.isReplStudioPromptLine(">> x = 1", "matlab"), true);
	assert.equal(context.isReplStudioPromptLine(">> x = 1", "octave"), false);
});

test("gnuplot is a runtime the page knows, with its own label, prompt, chunks and menu entry", () => {
	assert.equal(context.getKnownReplRuntime("gnuplot"), "gnuplot");
	assert.equal(context.getReplRuntimeLabel("gnuplot"), "gnuplot");
	assert.equal(context.getReplStudioPrompt("gnuplot"), "gnuplot>");
	assert.equal(context.getReplRuntimeHighlightLanguage("gnuplot"), "text", "no gnuplot grammar");
	const options = source.slice(source.indexOf("function buildReplPanelHtml()"), source.indexOf("].map(([value, label])", source.indexOf("function buildReplPanelHtml()")));
	assert.match(options, /\["matlab", "MATLAB"\],\n\s+\["gnuplot", "gnuplot"\],/);
	assert.equal(context.isFenceLanguageCompatibleWithRuntime("gnuplot", "gnuplot"), true);
	assert.equal(context.isFenceLanguageCompatibleWithRuntime("python", "gnuplot"), false);
	assert.equal(context.isReplStudioPromptLine("gnuplot> plot sin(x)", "gnuplot"), true);
	assert.equal(context.isReplStudioPromptLine("plot sin(x)", "gnuplot"), false);
});

test("C++ is a runtime the page knows, with its own label, prompt, chunks and menu entry", () => {
	assert.deepEqual(["cpp", "CPP"].map((value) => context.getKnownReplRuntime(value)), ["cpp", "cpp"]);
	assert.equal(context.getReplRuntimeLabel("cpp"), "C++");
	assert.equal(context.getReplStudioPrompt("cpp"), "[cling]$");
	assert.equal(context.getReplRuntimeHighlightLanguage("cpp"), "cpp");
	const options = source.slice(source.indexOf("function buildReplPanelHtml()"), source.indexOf("].map(([value, label])", source.indexOf("function buildReplPanelHtml()")));
	assert.match(options, /\["gnuplot", "gnuplot"\],\n\s+\["cpp", "C\+\+"\],/);
	for (const fence of ["cpp", "c++", "cxx", "hpp"]) assert.equal(context.isFenceLanguageCompatibleWithRuntime(fence, "cpp"), true, fence);
	assert.equal(context.isFenceLanguageCompatibleWithRuntime("c", "cpp"), false);
	assert.equal(context.isFenceLanguageCompatibleWithRuntime("cpp", "python"), false);
	assert.equal(context.isReplStudioPromptLine("[cling]$ int x = 1;", "cpp"), true);
	assert.equal(context.isReplStudioPromptLine("int x = 1;", "cpp"), false);
});

// Candidate82 widened the column for prompts over six characters by a fixed 3.9em, which still
// wrapped jshell> at the 11px font (Astra). Candidate90 sizes it by the longest prompt, in the
// prompt's own font, and keeps the old width as the minimum.
test("the record's prompt column fits its longest prompt, measured in the prompt's font", () => {
	const css = readFileSync(new URL("../client/studio.css", import.meta.url), "utf8");
	assert.match(source, /"<div class='repl-journal-list' style='--repl-studio-prompt-chars: " \+ Math\.max\(0, \.\.\.visibleEntries\.map\(\(entry\) => getReplStudioPrompt\(entry\.runtime\)\.length\)\) \+ "'>"/);
	assert.match(css, /grid-template-columns: minmax\(var\(--repl-studio-prompt-width\), max-content\) minmax\(0, 1fr\);/);
	assert.match(css, /\.repl-studio-prompt,\n\s+\.repl-studio-output-label \{\n\s+min-width: calc\(var\(--repl-studio-prompt-chars, 0\) \* 1ch\);/);
	assert.doesNotMatch(css, /repl-journal-list-wide-prompt/);
	assert.deepEqual(["shell", "python", "ipython", "julia", "r", "ghci", "clojure", "ruby", "java", "octave", "matlab", "gnuplot", "cpp"].map((runtime) => context.getReplStudioPrompt(runtime).length), [1, 3, 3, 6, 1, 5, 6, 4, 7, 7, 2, 8, 8]);
});

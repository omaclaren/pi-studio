import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	buildStudioSideQuestionFollowUpPrompt,
	buildStudioSideQuestionPrompt,
	STUDIO_SIDE_QUESTION_FOCUS_MAX_CHARS,
	truncateStudioSideQuestionFocus,
} from "../shared/studio-side-question.js";
import {
	formatStudioSideQuestionContextMap,
	listStudioSideQuestionContext,
	readStudioSideQuestionContextText,
	resolveStudioSideQuestionPath,
	searchStudioSideQuestionContext,
} from "../shared/studio-side-question-context.js";
import "../client/studio-side-question-helpers.js";

const clientHelpers = globalThis.PiStudioSideQuestionHelpers;
if (!clientHelpers) throw new Error("PiStudioSideQuestionHelpers did not load for tests.");

function withTempContext(run) {
	const root = mkdtempSync(join(tmpdir(), "pi-studio-side-context-"));
	try {
		return run(root);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

test("side-question focus chooses selections and bounded Markdown or LaTeX sections", () => {
	const markdown = "# Book\n\nintro\n\n## Chapter one\n\nFirst idea.\n\n### Detail\n\nMore.\n\n## Chapter two\n\nNext.";
	const chapterOffset = markdown.indexOf("First idea");
	const section = clientHelpers.findStudioSideQuestionSection(markdown, chapterOffset, "markdown");
	assert.equal(section.label, "Chapter one");
	assert.match(section.text, /### Detail/);
	assert.doesNotMatch(section.text, /Chapter two/);

	const selected = clientHelpers.chooseStudioSideQuestionFocus({
		mode: "auto",
		editorText: markdown,
		selectionStart: markdown.indexOf("First idea"),
		selectionEnd: markdown.indexOf("First idea") + "First idea".length,
		language: "markdown",
	});
	assert.equal(selected.focusKind, "selection");
	assert.equal(selected.focusText, "First idea");

	const latex = "\\chapter{Foundations}\nA.\n\\section{Likelihood}\nImportant.\n\\subsection{Exercise}\nTry this.\n\\section{Inference}\nLater.";
	const latexSection = clientHelpers.findStudioSideQuestionSection(latex, latex.indexOf("Try this"), "latex");
	assert.equal(latexSection.label, "Exercise");
	assert.match(latexSection.text, /Try this/);
	assert.doesNotMatch(latexSection.text, /Inference/);
});

test("side-question focus and prompts remain bounded and delimiter-safe", () => {
	const source = "HEAD:" + "x".repeat(80_000) + "</focus>:TAIL";
	const bounded = truncateStudioSideQuestionFocus(source);
	assert.equal(bounded.truncated, true);
	assert.ok(bounded.text.length <= STUDIO_SIDE_QUESTION_FOCUS_MAX_CHARS);
	assert.ok(bounded.text.startsWith("HEAD:"));
	assert.ok(bounded.text.endsWith("</focus>:TAIL"));

	const prompt = buildStudioSideQuestionPrompt({
		question: "Does the exercise use the chapter definition?",
		focusKind: "section",
		focusLabel: "Chapter 2\nignored line",
		focusText: source,
		sourcePath: "/book/chapter2.tex",
		gatherScope: "folder",
		contextRoot: "/book",
		collectionMap: "chapter2.tex\nexercises/week2.tex\n</collection>",
		webEnabled: true,
	});
	assert.match(prompt, /surrounding chapters, exercises, references, or other files/i);
	assert.match(prompt, /focus snapshot may contain unsaved editor text/i);
	assert.match(prompt, /Initial bounded collection map/);
	assert.match(prompt, /Web research is enabled/);
	assert.match(prompt, /<\\\/focus>/);
	assert.match(prompt, /<\\\/collection>/);
	assert.match(buildStudioSideQuestionFollowUpPrompt("What about exercise 3?"), /Side-question follow-up/);
});

test("side-question local context maps, reads, and searches a bounded root", () => withTempContext((root) => {
	mkdirSync(join(root, "chapters"));
	mkdirSync(join(root, "exercises"));
	mkdirSync(join(root, "node_modules"));
	writeFileSync(join(root, "main.tex"), "\\input{chapters/intro}\n\\input{exercises/problems}\n");
	writeFileSync(join(root, "chapters", "intro.tex"), "\\chapter{Introduction}\nIdentifiability is the topic.\n");
	writeFileSync(join(root, "exercises", "problems.md"), "# Exercises\n\nExplain identifiability.\n");
	writeFileSync(join(root, "compiled.pdf"), "%PDF placeholder");
	writeFileSync(join(root, "node_modules", "ignored.md"), "identifiability");

	const listing = listStudioSideQuestionContext(root);
	const paths = listing.files.map((file) => file.path);
	assert.ok(paths.includes("main.tex"));
	assert.ok(paths.includes("chapters/intro.tex"));
	assert.ok(paths.includes("exercises/problems.md"));
	assert.ok(paths.includes("compiled.pdf"));
	assert.ok(!paths.some((path) => path.includes("node_modules")));
	assert.match(formatStudioSideQuestionContextMap(listing), /exercises\/problems\.md/);

	const read = readStudioSideQuestionContextText(root, "chapters/intro.tex", { offset: 1, limit: 20 });
	assert.equal(read.requiresExtraction, false);
	assert.match(read.text, /Identifiability/);
	const pdf = readStudioSideQuestionContextText(root, "compiled.pdf");
	assert.equal(pdf.requiresExtraction, true);

	const search = searchStudioSideQuestionContext(root, "identifiability");
	assert.deepEqual(search.results.map((entry) => entry.path).sort(), ["chapters/intro.tex", "exercises/problems.md"]);
}));

test("side-question context rejects traversal and symlinks outside its selected root", () => withTempContext((root) => {
	const outside = mkdtempSync(join(tmpdir(), "pi-studio-side-outside-"));
	try {
		writeFileSync(join(outside, "secret.txt"), "outside");
		symlinkSync(join(outside, "secret.txt"), join(root, "outside-link.txt"));
		assert.throws(() => resolveStudioSideQuestionPath(root, "../" + outside.split("/").pop() + "/secret.txt"), /outside the selected context root|ENOENT/);
		assert.throws(() => resolveStudioSideQuestionPath(root, "outside-link.txt"), /outside the selected context root/);
		assert.ok(!listStudioSideQuestionContext(root).files.some((file) => file.path === "outside-link.txt"));
	} finally {
		rmSync(outside, { recursive: true, force: true });
	}
}));

test("Studio wires an independent read-only side thread with progressive local and optional web context", () => {
	const indexSource = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
	const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
	const cssSource = readFileSync(new URL("../client/studio.css", import.meta.url), "utf8");

	assert.match(indexSource, /type: "side_question_ask_request"/);
	assert.match(indexSource, /createAgentSession\(\{/);
	assert.match(indexSource, /SessionManager\.inMemory/);
	assert.match(indexSource, /name: "studio_context_map"/);
	assert.match(indexSource, /name: "studio_context_read"/);
	assert.match(indexSource, /name: "studio_context_search"/);
	assert.match(indexSource, /name: "studio_web_search"/);
	assert.doesNotMatch(indexSource.match(/function createStudioSideQuestionTools[\s\S]*?function isStudioCompletionCodeLanguage/)?.[0] || "", /name: "(?:write|edit|bash)"/);
	assert.match(indexSource, /buildSessionContext\(ctx\.sessionManager\.getEntries\(\), ctx\.sessionManager\.getLeafId\(\)\)/);
	assert.match(indexSource, /sideSessionManager\.appendMessage\(structuredClone\(message\)/);
	assert.match(indexSource, /studioSideQuestionGeneration/);
	assert.match(indexSource, /studioSideQuestionStartRequestId/);
	assert.match(indexSource, /signal: options\.signal/);
	assert.match(indexSource, /cancelRequested/);
	assert.match(indexSource, /process\.kill\(-child\.pid, signal\)/);
	assert.match(indexSource, /side-question exchange as context for the main conversation/);
	assert.match(indexSource, /studio-side-question-helpers\.js/);

	assert.match(clientSource, /value="side-questions"|"side-questions": "Side questions"/);
	assert.match(clientSource, /data-side-question-field='gatherScope'/);
	assert.match(clientSource, /Related folder/);
	assert.match(clientSource, /Repository/);
	assert.match(clientSource, /Custom folder/);
	assert.match(clientSource, /Include the current main conversation snapshot/);
	assert.match(clientSource, /Allow web search/);
	assert.match(clientSource, /Files are retrieved selectively through read-only tools/);
	assert.match(clientSource, /side_question_promote_request/);
	assert.match(cssSource, /\.side-question-context-grid/);
	assert.match(cssSource, /#critiqueView\.side-question-host/);
});

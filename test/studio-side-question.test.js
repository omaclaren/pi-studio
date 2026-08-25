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
import {
	buildStudioSideQuestionToolCatalog,
	normalizeStudioSideQuestionToolIds,
	selectStudioSideQuestionTools,
	toPublicStudioSideQuestionTools,
} from "../shared/studio-side-question-tools.js";
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

	const headingFocus = clientHelpers.chooseStudioSideQuestionFocus({
		mode: "section",
		editorText: markdown,
		selectionStart: chapterOffset,
		selectionEnd: chapterOffset,
		language: "markdown",
	});
	assert.equal(headingFocus.focusLabel, "Text under “Chapter one”");
	assert.equal(headingFocus.start, markdown.indexOf("## Chapter one"));

	const missingSelection = clientHelpers.chooseStudioSideQuestionFocus({
		mode: "selection",
		editorText: markdown,
		selectionStart: chapterOffset,
		selectionEnd: chapterOffset,
		language: "markdown",
	});
	assert.equal(missingSelection.focusKind, "none");
	assert.equal(missingSelection.focusLabel, "No editor text selected");

	const latex = "\\chapter{Foundations}\nA.\n\\section{Likelihood}\nImportant.\n\\subsection{Exercise}\nTry this.\n\\section{Inference}\nLater.";
	const latexSection = clientHelpers.findStudioSideQuestionSection(latex, latex.indexOf("Try this"), "latex");
	assert.equal(latexSection.label, "Exercise");
	assert.match(latexSection.text, /Try this/);
	assert.doesNotMatch(latexSection.text, /Inference/);

	const unstructuredText = "First paragraph.\n\nSecond paragraph.";
	const unstructured = clientHelpers.findStudioSideQuestionSection(unstructuredText, 3, "text");
	assert.equal(unstructured.label, "Text around cursor");
	const unstructuredFocus = clientHelpers.chooseStudioSideQuestionFocus({
		mode: "auto",
		editorText: unstructuredText,
		selectionStart: 3,
		selectionEnd: 3,
		language: "text",
	});
	assert.equal(unstructuredFocus.focusLabel, "Text around cursor");
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
		piToolNames: ["literature_search"],
	});
	assert.match(prompt, /surrounding chapters, exercises, references, or other files/i);
	assert.match(prompt, /focus snapshot may contain unsaved editor text/i);
	assert.match(prompt, /Initial bounded collection map/);
	assert.match(prompt, /web research is enabled/i);
	assert.match(prompt, /Explicitly selected Pi tools: literature_search/);
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

test("side-question Pi tools are provenance-backed, bounded, and explicitly selected", () => {
	const catalog = buildStudioSideQuestionToolCatalog([
		{ name: "read", description: "builtin", sourceInfo: { source: "builtin", path: "<builtin:read>" } },
		{ name: "mcpScript", description: "trusted scripts", sourceInfo: { source: "npm:mcp", path: "/plugins/mcp/index.ts" } },
		{ name: "studio_export_pdf", description: "own tool", sourceInfo: { source: "npm:pi-studio", path: "/studio/index.ts" } },
		{ name: "literature_search", description: "Search scholarly literature", sourceInfo: { source: "npm:scholar", path: "/plugins/scholar/index.ts", scope: "user" } },
		{ name: "tool_gateway", description: "Gateway for discovering and calling configured tools", sourceInfo: { source: "npm:gateway", path: "/plugins/gateway/index.ts", scope: "user" } },
	], { studioRoot: "/studio" });
	assert.deepEqual(catalog.map((tool) => tool.name), ["tool_gateway", "literature_search"]);
	assert.equal(catalog[0].gateway, true);
	assert.equal(catalog[1].gateway, false);
	assert.deepEqual(normalizeStudioSideQuestionToolIds(["0123456789abcdef01234567", "0123456789ABCDEF01234567", "bad", 42]), ["0123456789abcdef01234567"]);
	const selection = selectStudioSideQuestionTools(catalog, [catalog[1].id, "ffffffffffffffffffffffff"]);
	assert.deepEqual(selection.selected.map((tool) => tool.name), ["literature_search"]);
	assert.deepEqual(selection.missing, ["ffffffffffffffffffffffff"]);
	assert.deepEqual(selection.extensionPaths, ["/plugins/scholar/index.ts"]);
	assert.ok(!Object.hasOwn(toPublicStudioSideQuestionTools(selection.selected)[0], "sourcePath"));
	const movedCatalog = buildStudioSideQuestionToolCatalog([
		{ name: "literature_search", description: "Search scholarly literature", sourceInfo: { source: "npm:other", path: "/plugins/other/index.ts" } },
	]);
	assert.notEqual(movedCatalog[0].id, catalog[1].id);
	assert.deepEqual(selectStudioSideQuestionTools(movedCatalog, [catalog[1].id]).missing, [catalog[1].id]);
});

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
	assert.match(indexSource, /pi\.getAllTools\(\)/);
	assert.match(indexSource, /createAgentSessionRuntime\(createRuntime/);
	assert.match(indexSource, /additionalExtensionPaths: options\.extensionPaths/);
	assert.match(indexSource, /noExtensions: true/);
	assert.match(indexSource, /availablePiTools/);
	assert.doesNotMatch(indexSource, /from ["']pi-mcp-adapter/);
	assert.match(indexSource, /signal: options\.signal/);
	assert.match(indexSource, /cancelRequested/);
	assert.match(indexSource, /process\.kill\(-child\.pid, signal\)/);
	assert.match(indexSource, /side-question exchange as context for the main conversation/);
	assert.match(indexSource, /studio-side-question-helpers\.js/);

	assert.match(clientSource, /value="side-questions"|"side-questions": "Side questions"/);
	assert.match(clientSource, /<h2>Side question<\/h2>/);
	assert.match(clientSource, /<label>Starting text<select data-side-question-field='focusMode' aria-describedby='sideQuestionContextRule'/);
	assert.match(clientSource, /\["auto", "Automatic"\]/);
	assert.match(clientSource, /Automatic: selection → heading block at cursor → nearby text/);
	assert.match(clientSource, /nearest Markdown\/LaTeX heading above the cursor/);
	assert.match(clientSource, /getSideQuestionEditorLineRange/);
	assert.match(clientSource, /function scheduleSideQuestionContextRefresh/);
	assert.match(clientSource, /sourceTextEl\.addEventListener\("select"[\s\S]*?scheduleSideQuestionContextRefresh\(\)/);
	assert.match(clientSource, /critiqueViewEl\.addEventListener\("keydown", handleSideQuestionKeydown\)/);
	assert.match(clientSource, /function handleSideQuestionKeydown/);
	assert.match(clientSource, /event\.key === "Enter"[\s\S]*?\(event\.metaKey \|\| event\.ctrlKey\)[\s\S]*?!event\.shiftKey/);
	assert.match(clientSource, /aria-keyshortcuts='Meta\+Enter Control\+Enter'/);
	assert.match(clientSource, /const isSideQuestionsShortcut = [\s\S]*?switchRightPaneToView\("side-questions"\)/);
	assert.match(indexSource, /Cmd\/Ctrl\+Alt\+Q<\/dt><dd>Switch the right pane directly to Side questions/);
	assert.match(indexSource, /Ask the initial side question or a follow-up while its question box is focused/);
	assert.match(clientSource, /attachmentText: attachment/);
	assert.match(clientSource, /relatedFilesText:/);
	assert.match(clientSource, /<dt>Starting text<\/dt>/);
	assert.match(clientSource, /<dt>Related files<\/dt>/);
	assert.match(clientSource, /<label>Also use files from<select data-side-question-field='gatherScope'/);
	assert.match(clientSource, /Same folder as document/);
	assert.match(clientSource, /Repository/);
	assert.match(clientSource, /Choose a folder/);
	assert.match(clientSource, /Include the current main conversation snapshot/);
	assert.match(clientSource, /Allow web search/);
	assert.match(clientSource, /Additional Pi tools/);
	assert.match(clientSource, /data-side-question-tool/);
	assert.match(clientSource, /loads its owning extension into the isolated side runtime/);
	assert.match(clientSource, /Allow gateway tool in side questions/);
	assert.match(clientSource, /read only as needed/);
	assert.doesNotMatch(clientSource, />Ask aside</);
	assert.doesNotMatch(indexSource, />Ask aside<\/button>/);
	assert.match(clientSource, /side_question_promote_request/);
	assert.match(cssSource, /\.side-question-context-grid/);
	assert.match(cssSource, /\.side-question-context-rule/);
	assert.match(cssSource, /\.side-question-tool-picker/);
	assert.match(cssSource, /\.side-question-actions \.side-question-primary:not\(:disabled\):hover[\s\S]*?background: var\(--accent\)/);
	assert.match(cssSource, /#critiqueView\.side-question-host/);
});

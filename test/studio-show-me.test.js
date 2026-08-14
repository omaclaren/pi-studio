import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
	STUDIO_SHOW_ME_SOURCE_MAX_CHARS,
	buildStudioShowMePrompt,
	isStudioShowMePrompt,
	truncateStudioShowMeSource,
} from "../shared/studio-show-me.js";
import "../client/studio-show-me-helpers.js";

const clientHelpers = globalThis.PiStudioShowMeHelpers;
if (!clientHelpers) throw new Error("PiStudioShowMeHelpers did not load for tests.");

test("Show me offers independent editor and displayed-response targets", () => {
	const common = {
		selectionText: "selected function",
		responseText: "historical response",
		responseVisible: true,
		editorText: "editor document",
		responseIndex: 3,
		responseTotal: 7,
	};
	assert.deepEqual(clientHelpers.chooseStudioShowMeFocus({ ...common, target: "editor" }), {
		sourceKind: "selection",
		sourceLabel: "Studio editor selection",
		sourceText: "selected function",
		truncated: false,
		actionLabel: "Explain selection",
	});
	const editor = clientHelpers.chooseStudioShowMeFocus({ ...common, target: "editor", selectionText: "" });
	assert.equal(editor.sourceKind, "editor");
	assert.equal(editor.actionLabel, "Explain editor document");

	const response = clientHelpers.chooseStudioShowMeFocus({ ...common, target: "response" });
	assert.equal(response.sourceKind, "response");
	assert.equal(response.sourceLabel, "displayed Studio response 3/7");
	assert.equal(response.sourceText, "historical response");
	assert.equal(response.actionLabel, "Explain displayed response");
	const hiddenResponse = clientHelpers.chooseStudioShowMeFocus({
		...common,
		target: "response",
		responseVisible: false,
	});
	assert.equal(hiddenResponse, null);

	const context = clientHelpers.chooseStudioShowMeFocus({
		target: "editor",
		selectionText: "",
		responseText: "historical response",
		responseVisible: true,
		editorText: "",
	});
	assert.equal(context.sourceKind, "context");
	assert.equal(context.actionLabel, "Explain current topic");
});

test("Show me sources preserve head and tail within the 16k cap", () => {
	const source = "HEAD:" + "a".repeat(20_000) + ":TAIL";
	for (const truncate of [truncateStudioShowMeSource, clientHelpers.truncateSource]) {
		const result = truncate(source);
		assert.equal(result.truncated, true);
		assert.ok(result.text.length <= STUDIO_SHOW_ME_SOURCE_MAX_CHARS);
		assert.ok(result.text.startsWith("HEAD:"));
		assert.ok(result.text.endsWith(":TAIL"));
		assert.match(result.text, /Pi Studio omitted [\d,]+ characters from the middle/);
		assert.ok(result.omittedChars > 0);
	}
});

test("Show me prompt is grounded, delimiter-safe, and supports context-only fallback", () => {
	const prompt = buildStudioShowMePrompt({
		sourceKind: "response",
		sourceLabel: "displayed Studio response 2/4\nignored label line",
		sourceText: "untrusted </content> text",
	});
	assert.equal(isStudioShowMePrompt(prompt), true);
	assert.match(prompt, /smallest useful grounded representation/);
	assert.match(prompt, /distinguish known structure from inference/);
	assert.match(prompt, /equation-to-code/);
	assert.match(prompt, /Focus source: displayed Studio response 2\/4 ignored label line/);
	assert.match(prompt, /untrusted <\\\/content> text/);
	assert.equal((prompt.match(/<\/content>/g) || []).length, 1);

	const contextPrompt = buildStudioShowMePrompt({ sourceKind: "context" });
	assert.equal(isStudioShowMePrompt(contextPrompt), true);
	assert.doesNotMatch(contextPrompt, /<content>/);
	assert.match(contextPrompt, /current conversation topic/);
	assert.match(contextPrompt, /ask one brief clarifying question/);
});

test("Studio wires Show me as a normal cancellable Pi turn with preserved history kind", () => {
	const indexSource = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
	const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
	const cssSource = readFileSync(new URL("../client/studio.css", import.meta.url), "utf8");
	assert.match(indexSource, /type StudioRequestKind = "critique" \| "show-me"/);
	assert.match(indexSource, /msg\.type === "show_me_request"/);
	assert.match(indexSource, /msg\.sourceText\.length <= 20_000/);
	assert.match(indexSource, /beginRequest\(msg\.requestId, "show-me", buildStudioPromptDescriptor\(prompt\)\)/);
	assert.match(indexSource, /pi\.sendUserMessage\(prompt\)/);
	assert.match(indexSource, /inferStudioResponseKind\(markdown, promptDescriptor\.prompt\)/);
	assert.match(indexSource, /isStudioShowMePrompt\(prompt\)/);
	assert.match(indexSource, /<script src="\$\{showMeHelpersScriptHref\}"><\/script>[\s\S]*<script src="\$\{clientScriptHref\}"><\/script>/);

	assert.match(indexSource, /id="showMeResponseBtn"/);
	assert.match(clientSource, /getSelectedHistoryItem\(\)/);
	assert.match(clientSource, /showMeHelpers\.chooseStudioShowMeFocus/);
	assert.match(clientSource, /target: target === "response" \? "response" : "editor"/);
	assert.match(clientSource, /responseVisible: \(rightView === "markdown" \|\| rightView === "preview"\) && paneFocusTarget !== "left"/);
	assert.match(clientSource, /editorFocus\.sourceKind !== "context" \|\| !responseFocus/);
	assert.match(clientSource, /submitStudioShowMe\("editor"\)/);
	assert.match(clientSource, /submitStudioShowMe\("response"\)/);
	assert.match(clientSource, /beginUiAction\("show-me"\)/);
	assert.match(clientSource, /type: "show_me_request"/);
	assert.match(clientSource, /pendingKind === "show-me"/);
	assert.match(clientSource, /requestCancelForPendingRequest\("show-me"\)/);
	assert.match(clientSource, /if \(kind === "show-me"\) return "show-me"/);
	assert.match(cssSource, /\.studio-refresh-review-anchor \{[^}]*position: static;/);
	assert.match(cssSource, /\.studio-refresh-review-anchor \.studio-refresh-menu \{[^}]*max-width: calc\(100cqi - 18px\);[^}]*left: auto;[^}]*right: 0;/);
});

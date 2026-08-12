import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Annotate response prepares the raw editor and Editor Preview without changing annotations", () => {
	const indexSource = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
	const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");

	assert.match(indexSource, /id="annotateResponseBtn"[^>]*>Annotate response<\/button>[\s\S]*id="loadResponseBtn"/);
	assert.match(clientSource, /const annotateResponseBtn = document\.getElementById\("annotateResponseBtn"\)/);
	assert.match(clientSource, /annotateResponseBtn\.disabled = uiBusy \|\| !hasResponse \|\| isCritiqueResponse \|\| annotationWorkspaceReady/);
	assert.match(clientSource, /annotationWorkspaceReady \? "Response ready to annotate" : "Annotate response"/);
	assert.doesNotMatch(clientSource, /"Open annotation view"|"Continue annotating"/);
	assert.match(clientSource, /annotateResponseBtn\.addEventListener\("click", \(\) => \{\s*loadSelectedResponseIntoEditor\(\{ annotate: true \}\);/);

	const prepareStart = clientSource.indexOf("function loadSelectedResponseIntoEditor(options)");
	const prepareEnd = clientSource.indexOf("loadResponseBtn.addEventListener", prepareStart);
	assert.ok(prepareStart >= 0 && prepareEnd > prepareStart);
	const prepareSource = clientSource.slice(prepareStart, prepareEnd);
	assert.match(prepareSource, /replacingEditedResponse = prepareForAnnotation\s*&& sourceState\.source === "last-response"\s*&& Boolean\(currentEditorText\.trim\(\)\)\s*&& normalizeForCompare\(currentEditorText\) !== latestResponseNormalized/);
	assert.match(prepareSource, /window\.confirm\("Replace your edited response with a fresh copy\? Existing edits and annotations will be lost\."\)/);
	assert.match(prepareSource, /setStatus\("Kept the current editor text\."\);\s*return false/);
	assert.match(prepareSource, /setEditorText\(latestResponseMarkdown/);
	assert.match(prepareSource, /setSourceState\(\{ source: "last-response"/);
	assert.doesNotMatch(prepareSource, /continueExistingAnnotation|responseId/);
	assert.match(prepareSource, /setEditorView\("markdown"\)/);
	assert.match(prepareSource, /exitPaneFocus\(\)/);
	assert.match(prepareSource, /setRightView\("editor-preview"\)/);
	assert.match(prepareSource, /setActivePane\("left"\)/);
	assert.match(prepareSource, /focusSourceTextNoScroll/);
	assert.doesNotMatch(prepareSource, /toggleAnnotatedReplyHeader|setAnnotationsEnabled|stripAnnotation/);
});

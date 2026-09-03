import test from "node:test";
import assert from "node:assert/strict";

import {
	DEFAULT_REPL_SUBMISSION_ECHO_MODE,
	REPL_SUBMISSION_FULL_MAX_CHARS,
	REPL_SUBMISSION_FULL_MAX_LINES,
	REPL_SUBMISSION_SUMMARY_MAX_CHARS,
	REPL_SUBMISSION_SUMMARY_MAX_LINES,
	createReplSubmissionDisplay,
	normalizeReplSubmissionEchoMode,
	parseReplSubmissionDisplayMarker,
	sanitizeReplSubmissionDisplayText,
	stripReplSubmissionDisplay,
} from "../shared/repl-submission-display.js";

test("submission displays default to off and normalize explicit modes", () => {
	assert.equal(DEFAULT_REPL_SUBMISSION_ECHO_MODE, "off");
	assert.equal(normalizeReplSubmissionEchoMode("FULL"), "full");
	assert.equal(normalizeReplSubmissionEchoMode("summary"), "summary");
	assert.equal(normalizeReplSubmissionEchoMode("unexpected"), "off");
	assert.equal(normalizeReplSubmissionEchoMode("unexpected", "summary"), "summary");
});

test("summary displays use stable compact anchors, a plain output divider, and full short source", () => {
	const first = createReplSubmissionDisplay({
		entryId: "pi-studio:request-1",
		origin: "pi-studio",
		code: "x = 1\nprint(x)",
		mode: "summary",
	});
	const same = createReplSubmissionDisplay({
		entryId: "pi-studio:request-1",
		origin: "pi-studio",
		code: "different code does not change the entry anchor",
		mode: "summary",
	});
	const other = createReplSubmissionDisplay({
		entryId: "pi-studio:request-2",
		origin: "pi-studio",
		code: "x = 1",
		mode: "summary",
	});

	assert.equal(first.anchorId.length, 12);
	assert.equal(first.anchorId, "206df80d2327");
	assert.equal(first.anchorId, same.anchorId);
	assert.notEqual(first.anchorId, other.anchorId);
	assert.match(first.beginMarker, /^── pi-studio · [a-f0-9]{12} · 2 lines ──$/);
	assert.equal(first.endMarker, `── done · ${first.anchorId} ──`);
	assert.deepEqual(first.previewLines, ["│ x = 1", "│ print(x)"]);
	assert.equal(first.outputMarker, "── output ──");
	assert.deepEqual(first.prefixLines, [first.beginMarker, ...first.previewLines, first.outputMarker]);
});

test("display markers have a strict machine-readable form", () => {
	const display = createReplSubmissionDisplay({
		entryId: "pi-studio:request-1",
		origin: "pi-studio",
		code: "x = 1\nprint(x)",
		mode: "summary",
	});
	assert.deepEqual(parseReplSubmissionDisplayMarker(display.beginMarker), {
		version: 1,
		origin: "pi-studio",
		phase: "submitted",
		anchorId: display.anchorId,
		lineCount: 2,
	});
	assert.deepEqual(parseReplSubmissionDisplayMarker(`${display.outputMarker}\r`), {
		version: 1,
		phase: "output",
	});
	assert.deepEqual(parseReplSubmissionDisplayMarker(display.endMarker), {
		version: 1,
		phase: "complete",
		anchorId: display.anchorId,
	});
	assert.deepEqual(parseReplSubmissionDisplayMarker(`── pi-studio output · ${display.anchorId} ──`), {
		version: 1,
		origin: "pi-studio",
		phase: "output",
		anchorId: display.anchorId,
		legacy: true,
	});
	assert.equal(parseReplSubmissionDisplayMarker(`prompt> ${display.endMarker}`), null);
	assert.equal(parseReplSubmissionDisplayMarker(`── pi-studio · ${display.anchorId} · 2 line ──`), null);
	assert.equal(parseReplSubmissionDisplayMarker(`── pi-studio · ${display.anchorId} · 99999999999999999999 lines ──`), null);
});

test("summary previews are adaptive but bounded by lines and code points", () => {
	const longLine = createReplSubmissionDisplay({
		entryId: "long-summary",
		origin: "pi-repl",
		code: `${"😀".repeat(REPL_SUBMISSION_SUMMARY_MAX_CHARS + 50)}\nsecond`,
		mode: "summary",
	});
	assert.equal(Array.from(longLine.previewLines[0].slice(2)).length, REPL_SUBMISSION_SUMMARY_MAX_CHARS);
	assert.match(longLine.previewLines[0], /…$/);
	assert.equal(longLine.previewLines[1], "│ … preview truncated; 2 lines total");

	const manyLines = createReplSubmissionDisplay({
		entryId: "many-summary-lines",
		origin: "pi-repl",
		code: Array.from({ length: REPL_SUBMISSION_SUMMARY_MAX_LINES + 3 }, (_, index) => `line_${index + 1}`).join("\n"),
		mode: "summary",
	});
	assert.equal(manyLines.previewLines.length, REPL_SUBMISSION_SUMMARY_MAX_LINES + 1);
	assert.equal(manyLines.previewLines[0], "│ line_1");
	assert.match(manyLines.previewLines.at(-1), /preview truncated; 9 lines total/);
});

test("display previews normalize trailing whitespace and blank lines", () => {
	const display = createReplSubmissionDisplay({
		entryId: "whitespace",
		origin: "pi-repl",
		code: "x = 1   \n   \nprint(x)\n",
		mode: "summary",
	});
	assert.deepEqual(display.previewLines, ["│ x = 1", "│", "│ print(x)"]);
});

test("full displays escape terminal controls and stay bounded", () => {
	const code = ["print('safe')\u001b[2J", ...Array.from({ length: 60 }, (_, index) => `line_${index}`)].join("\n");
	const display = createReplSubmissionDisplay({ entryId: "entry", origin: "pi-repl", code, mode: "full" });
	assert.equal(display.enabled, true);
	assert.ok(display.previewLines.length <= REPL_SUBMISSION_FULL_MAX_LINES + 1);
	assert.match(display.previewLines[0], /\\x1b\[2J/);
	assert.match(display.previewLines.at(-1), /preview truncated; 61 lines total/);
	assert.doesNotMatch(display.previewLines.join("\n"), /\u001b/);
	assert.equal(sanitizeReplSubmissionDisplayText("a\tb\u202ec\u2028d"), "a    b\\u{202e}c\\u{2028}d");

	const longLine = createReplSubmissionDisplay({
		entryId: "long-full",
		origin: "pi-repl",
		code: "x".repeat(REPL_SUBMISSION_FULL_MAX_CHARS + 100),
		mode: "full",
	});
	assert.equal(Array.from(longLine.previewLines[0].slice(2)).length, REPL_SUBMISSION_FULL_MAX_CHARS);
	assert.match(longLine.previewLines[0], /…$/);
	assert.match(longLine.previewLines[1], /preview truncated/);
});

test("off mode emits no optional display and leaves capture text unchanged", () => {
	const display = createReplSubmissionDisplay({ entryId: "entry", origin: "pi-repl", code: "1 + 1" });
	assert.equal(display.mode, "off");
	assert.equal(display.enabled, false);
	assert.deepEqual(display.previewLines, []);
	assert.deepEqual(display.prefixLines, []);
	assert.equal(stripReplSubmissionDisplay("loader\n2\nprompt", display), "loader\n2\nprompt");
});

test("capture cleanup removes only the compact source display and final anchor", () => {
	const display = createReplSubmissionDisplay({ entryId: "entry", origin: "pi-repl", code: "print('hello')", mode: "summary" });
	const capture = [
		"exec(open('/tmp/pr.py').read(),globals())",
		...display.prefixLines,
		"hello",
		display.endMarker,
		">>>",
	].join("\n");
	assert.equal(
		stripReplSubmissionDisplay(capture, display),
		"exec(open('/tmp/pr.py').read(),globals())\nhello\n>>>",
	);
});

test("the output divider makes cleanup resilient to altered source-preview wrapping", () => {
	const display = createReplSubmissionDisplay({ entryId: "wrapped", origin: "pi-repl", code: "print('hello')", mode: "summary" });
	const capture = [
		display.beginMarker,
		"│ print('hel",
		"lo')",
		display.outputMarker,
		"hello",
		display.endMarker,
	].join("\n");
	assert.equal(stripReplSubmissionDisplay(capture, display), "hello\n");
});

test("incomplete prefixes are removed without swallowing following error text", () => {
	const display = createReplSubmissionDisplay({ entryId: "partial", origin: "pi-repl", code: "first\nsecond", mode: "summary" });
	const capture = [
		"loader",
		display.beginMarker,
		display.previewLines[0],
		"display encoding failed",
	].join("\n");
	assert.equal(stripReplSubmissionDisplay(capture, display), "loader\ndisplay encoding failed");
});

test("malformed marker prefixes neither hang cleanup nor hide later exact markers", () => {
	const display = createReplSubmissionDisplay({ entryId: "entry", origin: "pi-repl", code: "print('ok')", mode: "summary" });
	const malformedBegin = `${display.beginMarker} suffix`;
	const malformedEnd = `${display.endMarker} suffix`;
	const capture = [malformedBegin, ...display.prefixLines, "ok", malformedEnd, display.endMarker].join("\n");
	assert.equal(stripReplSubmissionDisplay(capture, display), `${malformedBegin}\nok\n${malformedEnd}\n`);
});

test("a repeated plain output divider in user output is preserved", () => {
	const display = createReplSubmissionDisplay({ entryId: "entry", origin: "pi-repl", code: "print(divider)", mode: "summary" });
	const capture = [...display.prefixLines, display.outputMarker, "user output", display.endMarker].join("\n");
	assert.equal(stripReplSubmissionDisplay(capture, display), `${display.outputMarker}\nuser output\n`);
});

test("the final completion anchor is removed without deleting identical user output", () => {
	const display = createReplSubmissionDisplay({ entryId: "entry", origin: "pi-repl", code: "print(marker)", mode: "summary" });
	const capture = [
		...display.prefixLines,
		display.endMarker,
		"user output after marker text",
		display.endMarker,
	].join("\n");
	assert.equal(
		stripReplSubmissionDisplay(capture, display),
		`${display.endMarker}\nuser output after marker text\n`,
	);
});

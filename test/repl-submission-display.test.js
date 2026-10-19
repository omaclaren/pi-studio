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

test("submission displays default to summary and preserve explicit modes and fallbacks", () => {
	assert.equal(DEFAULT_REPL_SUBMISSION_ECHO_MODE, "summary");
	assert.equal(normalizeReplSubmissionEchoMode(), "summary");
	assert.equal(normalizeReplSubmissionEchoMode(""), "summary");
	assert.equal(normalizeReplSubmissionEchoMode("FULL"), "full");
	assert.equal(normalizeReplSubmissionEchoMode("summary"), "summary");
	assert.equal(normalizeReplSubmissionEchoMode(" off "), "off");
	assert.equal(normalizeReplSubmissionEchoMode("unexpected"), "summary");
	assert.equal(normalizeReplSubmissionEchoMode("unexpected", "off"), "off");
	assert.equal(normalizeReplSubmissionEchoMode(undefined, "full"), "full");
	assert.equal(normalizeReplSubmissionEchoMode(undefined, "invalid"), "summary");
	const display = createReplSubmissionDisplay({ entryId: "default", origin: "pi-repl", code: "print(42)" });
	assert.equal(display.mode, "summary");
	assert.equal(display.enabled, true);
	assert.deepEqual(display.previewLines, ["print(42)"]);
	assert.deepEqual(display.prefixLines, ["", display.beginMarker, ...display.previewLines, display.outputMarker]);
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
	assert.match(first.beginMarker, /^── pi-studio · input · 2 lines · id: [a-f0-9]{12} ──$/);
	assert.equal(first.endMarker, `── done · id: ${first.anchorId} ──`);
	assert.deepEqual(first.previewLines, ["x = 1", "print(x)"]);
	assert.equal(first.outputMarker, "── output ──");
	assert.deepEqual(first.prefixLines, ["", first.beginMarker, ...first.previewLines, first.outputMarker]);
});

test("visible displays have one leading and trailing blank line with no internal padding", () => {
	for (const mode of ["summary", "full"]) {
		for (const code of ["", "print(42)", "first\n\nlast\n", "long\n".repeat(50)]) {
			const display = createReplSubmissionDisplay({ entryId: "spacing", code, mode });
			assert.deepEqual(display.prefixLines, ["", display.beginMarker, ...display.previewLines, display.outputMarker]);
			assert.deepEqual(display.suffixLines, [display.endMarker, ""]);
			assert.match(display.prefixLines.join("\n"), /^\n── pi ·/);
			assert.match(display.prefixLines.join("\n"), /[^\n]*\n── output ──$/);
			const output = "\n42\n\n";
			const capture = display.prefixLines.join("\n") + "\n" + output + display.endMarker;
			assert.equal(stripReplSubmissionDisplay(capture, display), output);
			assert.equal(stripReplSubmissionDisplay("loader\n" + capture, display), "loader\n" + output);
			assert.equal(stripReplSubmissionDisplay("loader\n\n" + capture, display), "loader\n\n" + output);
		}
	}
});

test("cleanup removes exactly the new footer separator and preserves surrounding user whitespace", () => {
	for (const mode of ["summary", "full"]) {
		const display = createReplSubmissionDisplay({ entryId: "footer-gap", code: "print(42)", mode });
		for (const output of ["", "42\n", "\nfirst\n\nlast\n\n", `${display.endMarker}\n\nuser text\n`]) {
			for (const tail of ["", "prompt>", "\n\nafter completion\n"]) {
				const capture = display.prefixLines.join("\n") + "\n" + output + display.suffixLines.join("\n") + "\n" + tail;
				assert.equal(stripReplSubmissionDisplay(capture, display), output + tail);
				assert.equal(stripReplSubmissionDisplay(capture.replaceAll("\n", "\r\n"), display), output + tail);
			}
		}
	}
});

test("old captures and display objects without suffix metadata remain compatible", () => {
	const display = createReplSubmissionDisplay({ entryId: "old-footer", code: "1" });
	const { suffixLines, ...oldDisplay } = display;
	assert.equal(stripReplSubmissionDisplay(`42\n${display.endMarker}\nprompt>`, display), "42\nprompt>");
	assert.equal(stripReplSubmissionDisplay(`42\n${display.endMarker}`, display), "42\n");
	assert.equal(stripReplSubmissionDisplay(`42\n${display.endMarker}\n\nprompt>`, oldDisplay), "42\n\nprompt>");
	assert.equal(stripReplSubmissionDisplay("42\n\nprompt>", display), "42\n\nprompt>");
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
	assert.deepEqual(parseReplSubmissionDisplayMarker(`── pi-studio · ${display.anchorId} · 2 lines ──`), parseReplSubmissionDisplayMarker(display.beginMarker));
	assert.deepEqual(parseReplSubmissionDisplayMarker(`── done · ${display.anchorId} ──`), parseReplSubmissionDisplayMarker(display.endMarker));
	assert.equal(parseReplSubmissionDisplayMarker(`── pi-studio · input · 2 line · id: ${display.anchorId} ──`), null);
	assert.equal(parseReplSubmissionDisplayMarker(`── pi-studio · input · 99999999999999999999 lines · id: ${display.anchorId} ──`), null);
	assert.equal(parseReplSubmissionDisplayMarker(`── pi-studio · input · 2 lines · id: not-hex ──`), null);
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
	assert.equal(Array.from(longLine.previewLines[0]).length, REPL_SUBMISSION_SUMMARY_MAX_CHARS);
	assert.match(longLine.previewLines[0], /…$/);
	assert.equal(longLine.previewLines[1], "… preview truncated; 2 lines total");

	const manyLines = createReplSubmissionDisplay({
		entryId: "many-summary-lines",
		origin: "pi-repl",
		code: Array.from({ length: REPL_SUBMISSION_SUMMARY_MAX_LINES + 3 }, (_, index) => `line_${index + 1}`).join("\n"),
		mode: "summary",
	});
	assert.equal(manyLines.previewLines.length, REPL_SUBMISSION_SUMMARY_MAX_LINES + 1);
	assert.equal(manyLines.previewLines[0], "line_1");
	assert.equal(manyLines.previewLines.at(-1), `… preview truncated; ${REPL_SUBMISSION_SUMMARY_MAX_LINES + 3} lines total`);
});

test("plain previews preserve indentation and internal blanks without added bars", () => {
	const display = createReplSubmissionDisplay({
		entryId: "whitespace",
		origin: "pi-repl",
		code: "if True:   \n    x = 1\n   \n\tprint(x)\n",
		mode: "summary",
	});
	assert.deepEqual(display.previewLines, ["if True:", "    x = 1", "", "    print(x)"]);
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
	assert.equal(Array.from(longLine.previewLines[0]).length, REPL_SUBMISSION_FULL_MAX_CHARS);
	assert.match(longLine.previewLines[0], /…$/);
	assert.match(longLine.previewLines[1], /preview truncated/);
});

test("off mode emits no optional display and leaves capture text unchanged", () => {
	const display = createReplSubmissionDisplay({ entryId: "entry", origin: "pi-repl", code: "1 + 1", mode: "off" });
	assert.equal(display.mode, "off");
	assert.equal(display.enabled, false);
	assert.deepEqual(display.previewLines, []);
	assert.deepEqual(display.prefixLines, []);
	assert.deepEqual(display.suffixLines, []);
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

test("known plain preview text can be cleaned across retained terminal wraps", () => {
	const display = createReplSubmissionDisplay({ entryId: "wrapped", origin: "pi-repl", code: "print('hello')", mode: "summary" });
	const capture = [
		display.beginMarker,
		"print('hel",
		"lo')",
		display.outputMarker,
		"hello",
		display.endMarker,
	].join("\n");
	assert.equal(stripReplSubmissionDisplay(capture, display), "hello\n");
});

test("marker-looking unprefixed source is not confused with the actual output divider", () => {
	for (const mode of ["summary", "full"]) {
		const code = 'text = """first\n── output ──\n│ literal pipe\nlast"""\nprint(text)';
		const display = createReplSubmissionDisplay({ entryId: "source-marker", code, mode });
		const output = "first\n── output ──\n│ literal pipe\nlast\n";
		const capture = [...display.prefixLines, output + display.suffixLines.join("\n"), "prompt>"].join("\n");
		assert.equal(stripReplSubmissionDisplay(capture, display), output + "prompt>");
	}
	const display = createReplSubmissionDisplay({ entryId: "wrapped-marker", code: "before── output ──after" });
	const capture = [display.beginMarker, "before", display.outputMarker, "after", display.outputMarker, "real output", display.endMarker].join("\n");
	assert.equal(stripReplSubmissionDisplay(capture, display), "real output\n");
});

test("old bar-prefixed displays still strip with their original metadata", () => {
	const current = createReplSubmissionDisplay({ entryId: "old-style", code: "print(42)" });
	const beginMarker = `── pi · ${current.anchorId} · 1 line ──`;
	const endMarker = `── done · ${current.anchorId} ──`;
	const old = { ...current, beginMarker, endMarker, previewLines: ["│ print(42)"], prefixLines: ["", beginMarker, "│ print(42)", current.outputMarker], suffixLines: [endMarker, ""] };
	assert.equal(stripReplSubmissionDisplay([...old.prefixLines, "42", ...old.suffixLines, "prompt>"].join("\n"), old), "42\nprompt>");
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
	const afterGap = ["loader", "", display.beginMarker, ...display.previewLines, "display encoding failed"].join("\n");
	assert.equal(stripReplSubmissionDisplay(afterGap, display), "loader\ndisplay encoding failed");
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

test("Summary shows 20 source lines or 2000 code points while Full retains its larger limits", () => {
	assert.equal(REPL_SUBMISSION_SUMMARY_MAX_LINES, 20);
	assert.equal(REPL_SUBMISSION_SUMMARY_MAX_CHARS, 2000);
	assert.equal(REPL_SUBMISSION_FULL_MAX_LINES, 40);
	assert.equal(REPL_SUBMISSION_FULL_MAX_CHARS, 4000);
	const lines = Array.from({ length: 20 }, (_, i) => `line_${i + 1}`);
	const atLineLimit = createReplSubmissionDisplay({ entryId: "twenty-lines", code: lines.join("\n") });
	assert.deepEqual(atLineLimit.previewLines, lines);
	for (const code of ["😀".repeat(2000), "x".repeat(1000) + "\n" + "y".repeat(999)]) {
		const display = createReplSubmissionDisplay({ entryId: "character-boundary", code });
		assert.deepEqual(display.previewLines, code.split("\n"));
	}
	const over = createReplSubmissionDisplay({ entryId: "over-character-boundary", code: "x".repeat(1000) + "\n" + "y".repeat(1000) });
	assert.equal(Array.from(over.previewLines.slice(0, -1).join("\n")).length, 2000);
	assert.equal(over.previewLines.at(-1), "… preview truncated; 2 lines total");
});

test("older six-line Summary previews still clean with their original display metadata", () => {
	const code = Array.from({ length: 18 }, (_, i) => `line_${i + 1}`).join("\n");
	const current = createReplSubmissionDisplay({ entryId: "old-summary-budget", code });
	assert.deepEqual(current.previewLines, code.split("\n"));
	const previewLines = [...code.split("\n").slice(0, 6), "… preview truncated; 18 lines total"];
	const old = { ...current, previewLines, prefixLines: ["", current.beginMarker, ...previewLines, current.outputMarker] };
	assert.equal(stripReplSubmissionDisplay([...old.prefixLines, "42", ...old.suffixLines, "prompt>"].join("\n"), old), "42\nprompt>");
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

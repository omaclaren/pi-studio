import test from "node:test";
import assert from "node:assert/strict";
import { mStringLiteral, buildMLanguageControlSource, buildMLanguageDriverSource } from "../shared/repl-m-language.js";
import { createReplSubmissionDisplay } from "../shared/repl-submission-display.js";

test("M-language strings quote ASCII and encode newlines, backslashes and Unicode as UTF-8", () => {
	assert.equal(mStringLiteral("a'b%"), "'a''b%'");
	for (const value of ["line\nnext\r\n", "λ 🧪", "path\\with\\slashes", "'); error('injection'); %\n"]) {
		const literal = mStringLiteral(value);
		const numbers = literal.match(/uint8\(\[([\d ]*)\]\)/)?.[1].split(" ").map(Number);
		assert.deepEqual(Buffer.from(numbers), Buffer.from(value));
		assert.match(literal, /native2unicode.*'UTF-8'/);
	}
});

for (const runtime of ["octave", "matlab"]) {
	test(`${runtime} has a base evaluator and function-local completion guard without path/cwd mutation`, () => {
		const display = createReplSubmissionDisplay({ entryId: "m-test", origin: "pi-repl", code: "clear all; 6*7", mode: "summary" });
		const source = buildMLanguageControlSource("clear all; 6*7", display);
		const driver = buildMLanguageDriverSource(runtime, "/tmp/m 'quote'/123.m", "/tmp/123.done", display);
		assert.match(source, /evalin\('base'/);
		assert.match(source, /catch pi_repl_error/);
		assert.match(source, /pi_repl_error.message/);
		assert.match(driver, /onCleanup\(/);
		assert.match(driver, /@\(pi_repl_error,pi_repl_guard\)/);
		assert.doesNotMatch(source + driver, /\b(?:cd|addpath|assignin|restoredefaultpath)\(/);
		assert.doesNotMatch(source + driver, /lasterr/);
	});
}

test("Off completion contains no cursor query or display source", () => {
	const display = createReplSubmissionDisplay({ entryId: "m-off", origin: "pi-repl", code: "1", mode: "off" });
	const source = buildMLanguageControlSource("1", display);
	const driver = buildMLanguageDriverSource("matlab", "/tmp/123.m", "/tmp/123.done", display);
	assert.doesNotMatch(source, /fprintf\(1/);
	assert.doesNotMatch(driver, /system\(|cursor_x|──|native2unicode/);
	assert.match(driver, /fclose\(fopen/);
});

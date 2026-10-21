import test from "node:test";
import assert from "node:assert/strict";
import { mStringLiteral, buildMLanguageControlSource, buildMLanguageDriverSource, buildMLanguageFinish } from "../shared/repl-m-language.js";
import { CURSOR_COLUMN_QUERY, CURSOR_COLUMN_SUPERVISOR, boundedCursorColumnCommand } from "../shared/repl-cursor-column.js";
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

test("Off ends a line that output left open, and adds no display", () => {
	// Otherwise the prompt follows the output on the same row and the clean record drops it.
	const display = createReplSubmissionDisplay({ entryId: "m-off", origin: "pi-repl", code: "1", mode: "off" });
	assert.doesNotMatch(buildMLanguageControlSource("1", display), /fprintf\(1/);
	for (const runtime of ["matlab", "octave"]) {
		const finish = buildMLanguageFinish(runtime, "/tmp/123.done", display);
		assert.doesNotMatch(finish, /──/);
		assert.equal(finish.match(/system\(/g).length, 1, runtime);
		assert.deepEqual(finish.match(/fprintf\(1,[^;]*;/g), ["fprintf(1,'\\n');"], `${runtime}: only the newline`);
		assert.match(finish, /if pi_repl_status~=0 \|\| ~strcmp\(strtrim\(pi_repl_column\),'0'\); fprintf/);
		assert.match(buildMLanguageDriverSource(runtime, "/tmp/123.m", "/tmp/123.done", display), /onCleanup\(@\(\) feval\(/);
	}
});

test("the footer's helper is bounded, and Octave writes the done file even if the footer is interrupted", () => {
	const display = createReplSubmissionDisplay({ entryId: "m-finish", origin: "pi-repl", code: "1", mode: "summary" });
	const command = boundedCursorColumnCommand("/opt/node's/bin/node");
	assert.match(command, /^\/bin\/sh -c '/);
	const script = command.slice("/bin/sh -c '".length, -1).replaceAll(`'"'"'`, "'");
	assert.ok(script.includes(`NODE_OPTIONS= '/opt/node'"'"'s/bin/node' -e '${CURSOR_COLUMN_SUPERVISOR}' -- "\${NODE_OPTIONS-}" >"$f" </dev/null; s=$?`));
	assert.doesNotMatch(command, /perl|alarm|kill -9|; kill /);
	assert.match(command, /trap '"'"'rm -f "\$f"'"'"' EXIT; trap '"'"'exit 1'"'"' HUP INT TERM/);
	assert.match(command, /\[ "\$s" = 0 \]'$/);
	assert.match(command, /process\.exit\(code\)/);
	assert.match(command, /\/opt\/node'"'"'"'"'"'"'"'"'s\/bin\/node/);
	assert.match(CURSOR_COLUMN_QUERY, /writeSync\(1,[\s\S]*process\.exit\(code\)/);
	const octave = buildMLanguageFinish("octave", "/tmp/123.done", display).split("\n");
	assert.equal(octave[0], "unwind_protect");
	assert.deepEqual(octave.slice(-3), ["unwind_protect_cleanup", "fclose(fopen('/tmp/123.done','w'));", "end_unwind_protect"]);
	assert.ok(octave.includes(`  [pi_repl_status,pi_repl_column]=system(${mStringLiteral(boundedCursorColumnCommand(process.execPath))});`));
	// MATLAB has no unwind_protect, and completes its cleanup action anyway.
	const matlab = buildMLanguageFinish("matlab", "/tmp/123.done", display).split("\n");
	assert.ok(!matlab.some((line) => /unwind_protect/.test(line)));
	assert.equal(matlab.at(-1), "fclose(fopen('/tmp/123.done','w'));");
	// Off's footer only ends an open line, and Octave still guards the done file.
	const off = createReplSubmissionDisplay({ entryId: "m-finish-off", origin: "pi-repl", code: "1", mode: "off" });
	const octaveOff = buildMLanguageFinish("octave", "/tmp/123.done", off).split("\n");
	assert.equal(octaveOff[0], "unwind_protect");
	assert.deepEqual(octaveOff.slice(-3), ["unwind_protect_cleanup", "fclose(fopen('/tmp/123.done','w'));", "end_unwind_protect"]);
	assert.ok(!octaveOff.some((line) => line.includes("──")));
});

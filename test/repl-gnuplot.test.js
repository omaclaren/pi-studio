import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { runInNewContext } from "node:vm";
import { buildGnuplotSubmissionLine, buildGnuplotGuardSource, buildGnuplotDriverSource, gnuplotStringLiteral } from "../shared/repl-gnuplot.js";
import { createReplSubmissionDisplay } from "../shared/repl-submission-display.js";

function fixture({ mode = "summary", column = "0", blocked = false, queryFailure = false } = {}) {
	const display = createReplSubmissionDisplay({ entryId: "gnuplot-unit", origin: "pi-repl", code: "a = 42", mode });
	const source = buildGnuplotDriverSource("/private/source.gp", "/private/guard.gp", "/private/guard.done", "/private/source.done", display);
	const stdout = new EventEmitter(), process = new EventEmitter();
	const state = { ack: false, writes: [], terminal: [], files: [], queries: [], exits: [] };
	stdout.write = (text) => { state.writes.push(text); return !blocked; };
	Object.assign(process, { stdout, env: { TMUX_PANE: "%7" }, exit: (code) => state.exits.push(code) });
	const fs = {
		existsSync: (path) => { assert.equal(path, "/private/guard.done"); return state.ack; },
		writeSync: (fd, text) => { assert.equal(fd, 2); state.terminal.push(text); },
		writeFileSync: (...args) => state.files.push(args),
	};
	const child = { execFileSync: (...args) => { state.queries.push(args); if (queryFailure) throw Error("query failed"); return column; } };
	runInNewContext(source, {
		process,
		require: (name) => { assert.ok(["node:fs", "node:child_process"].includes(name)); return name === "node:fs" ? fs : child; },
		setInterval: (fn, ms) => { assert.equal(ms, 50); state.tick = fn; },
	});
	return { ...state, state, stdout, process, display, source };
}

test("gnuplot path quoting protects shell substitutions and consecutive apostrophes", () => {
	assert.equal(gnuplotStringLiteral("`command` $value \\ λ"), "'`command` $value \\ λ'");
	assert.equal(gnuplotStringLiteral("a''b"), `(\'a\' . "'" . '' . "'" . 'b')`);
	for (const path of ["/tmp/a\nb", "/tmp/a\rb", "/tmp/a\0b"]) {
		assert.throws(() => gnuplotStringLiteral(path), /control paths cannot contain/);
		assert.throws(() => buildGnuplotSubmissionLine(path), /control paths cannot contain/);
		assert.throws(() => buildGnuplotGuardSource(path), /control paths cannot contain/);
	}
	const guard = buildGnuplotGuardSource("/private/guard.done");
	assert.match(guard, /^load /);
	assert.match(guard, /umask 077; set -C/);
	assert.doesNotMatch(guard, /set print|set term|system\s|GPVAL_/);
	assert.match(buildGnuplotSubmissionLine("/private/driver.cjs"), /^load .*<trap "" INT; exec /);
});

test("gnuplot completion waits for native acknowledgment, not pipe writes or a prompt guess", () => {
	const f = fixture();
	assert.deepEqual(f.state.writes, ["load '/private/source.gp'\nload '/private/guard.gp'\n"]);
	for (let i = 0; i < 10; i++) f.state.tick();
	assert.deepEqual(f.state.files, []);
	assert.ok(f.state.writes.slice(1).every((text) => text === "#\n"));
	f.state.ack = true;
	f.state.tick();
	assert.equal(f.state.files.length, 1);
	assert.equal(f.state.files[0][0], "/private/source.done");
	assert.equal(f.state.files[0][1], "done\n");
	assert.equal(f.state.files[0][2].mode, 0o600);
	assert.equal(f.state.files[0][2].flag, "wx");
	assert.deepEqual(f.state.exits, [0]);
	assert.equal(f.state.terminal[0], f.display.prefixLines.join("\n") + "\n");
	assert.equal(f.state.terminal[1], f.display.suffixLines.join("\n") + "\n");
	assert.equal(f.state.queries[0][2].timeout, 500);
	assert.equal(f.state.queries[0][2].killSignal, "SIGKILL");
});

test("gnuplot SIGINT alone cannot complete source; EPIPE finishes once after native unwind", () => {
	const f = fixture();
	f.process.emit("SIGINT");
	f.state.tick();
	assert.equal(f.state.files.length, 0);
	f.stdout.emit("error", Object.assign(Error("closed"), { code: "EPIPE" }));
	f.state.ack = true;
	f.state.tick();
	assert.equal(f.state.files.length, 1);
	assert.deepEqual(f.state.exits, [0]);
	assert.equal(f.state.terminal.length, 2);
});

test("gnuplot producer respects backpressure while source is busy", () => {
	const f = fixture({ blocked: true });
	for (let i = 0; i < 10000; i++) f.state.tick();
	assert.equal(f.state.writes.length, 1);
	f.stdout.emit("drain");
	f.state.tick();
	f.state.tick();
	assert.deepEqual(f.state.writes, ["load '/private/source.gp'\nload '/private/guard.gp'\n", "#\n"]);
});

test("gnuplot unexpected producer errors never invent completion", () => {
	const f = fixture();
	assert.throws(() => f.stdout.emit("error", Object.assign(Error("unexpected"), { code: "EIO" })), /unexpected/);
	assert.equal(f.state.files.length, 0);
});

for (const options of [{ column: "12" }, { queryFailure: true }]) {
	test(`gnuplot footer uses a newline for ${options.queryFailure ? "unavailable cursor query" : "mid-line output"}`, () => {
		const f = fixture(options);
		f.state.ack = true;
		f.state.tick();
		assert.equal(f.state.terminal[1], "\n" + f.display.suffixLines.join("\n") + "\n");
	});
}

test("gnuplot Off ends a line that output left open, and adds no display", () => {
	// Otherwise gnuplot's prompt follows the output on the same row, and its line editor
	// redraws the next pasted line wrongly.
	for (const [options, ending] of [[{ column: "0" }, ""], [{ column: "7" }, "\n"], [{ queryFailure: true }, "\n"]]) {
		const f = fixture({ mode: "off", ...options });
		assert.doesNotMatch(f.source, /──|a = 42/);
		f.state.ack = true;
		f.state.tick();
		assert.deepEqual(f.state.terminal, [ending], JSON.stringify(options));
		assert.equal(f.state.queries.length, 1);
		assert.equal(f.state.files.length, 1);
	}
});

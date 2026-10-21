import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { boundedCursorColumnCommand } from "../shared/repl-cursor-column.js";

// Runs the helper as a runtime's footer would, with a startup hook in
// NODE_OPTIONS and a pane that doesn't exist. TMPDIR is private, to check
// that the helper's temporary file goes.
function runHelper(t, hookSource) {
	const dir = mkdtempSync(join(tmpdir(), "pi-repl-cursor-column-"));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	const scratch = join(dir, "tmp");
	mkdirSync(scratch);
	const hook = join(dir, "hook.cjs");
	writeFileSync(hook, hookSource(dir));
	const began = Date.now();
	return new Promise((resolve) => {
		execFile("/bin/sh", ["-c", boundedCursorColumnCommand(process.execPath)], {
			env: { ...process.env, TMPDIR: scratch, TMUX_PANE: "%999999", NODE_OPTIONS: `--require=${hook}` },
			encoding: "utf8",
			timeout: 20000,
		}, (error, stdout) => resolve({ dir, scratch, ms: Date.now() - began, status: error ? error.code : 0, stdout }));
	});
}

test("the cursor-column helper is stopped after 5 s even if a startup hook catches its signals", async (t) => {
	// A hook that caught perl's SIGALRM used to hold the helper for as long as it stalled.
	const result = await runHelper(t, (dir) => [
		`require("node:fs").writeFileSync(${JSON.stringify(join(dir, "pid"))}, String(process.pid));`,
		'for (const signal of ["SIGALRM", "SIGTERM", "SIGINT", "SIGHUP"]) process.on(signal, () => {});',
		"Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 9000);",
	].join("\n"));
	assert.ok(result.ms > 4500 && result.ms < 8000, `took ${result.ms} ms`);
	assert.equal(result.status, 1);
	assert.equal(result.stdout, "");
	assert.throws(() => process.kill(Number(readFileSync(join(result.dir, "pid"), "utf8")), 0), { code: "ESRCH" });
	assert.deepEqual(readdirSync(result.scratch), []);
});

test("the caller's NODE_OPTIONS reaches only the query, which a kept-alive hook doesn't hold up", async (t) => {
	const result = await runHelper(t, (dir) => [
		`require("node:fs").appendFileSync(${JSON.stringify(join(dir, "loads"))}, "loaded\\n");`,
		"setInterval(() => {}, 1000);",
	].join("\n"));
	assert.ok(result.ms < 4000, `took ${result.ms} ms`);
	assert.equal(readFileSync(join(result.dir, "loads"), "utf8"), "loaded\n");
	assert.deepEqual(readdirSync(result.scratch), []);
});

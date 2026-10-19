import test from "node:test";
import assert from "node:assert/strict";

import { parseStopProcessTable } from "../shared/repl-session-stop.js";

// macOS lists processes of `nobody` with uid -2 (newmac runs distnoted and dhcp6d so).
// The parser refused the whole table, so every verified Stop failed on such a Mac (0.10.2,
// 0.10.3). Same fix as pi-repl's: only the uid may be negative.
test("a process owned by nobody (uid -2) no longer stops Stop from reading the process table", () => {
	const table = [
		"    1     0     1     0 ??       Sat Aug 15 12:00:00 2026     Ss  ",
		"  404     1   404    -2 ??       Sat Aug 15 12:08:00 2026     S   ",
		" 1001   900  1001   501 ttys100  Wed Sep  9 08:00:00 2026     S+  ",
	].join("\n");
	assert.deepEqual(parseStopProcessTable(table).map(({ pid, uid }) => [pid, uid]), [[1, 0], [404, -2], [1001, 501]]);
	assert.deepEqual(parseStopProcessTable(table)[1], { pid: 404, ppid: 1, pgid: 404, uid: -2, tty: "??", startedAt: "Sat Aug 15 12:08:00 2026", state: "S" });
});

test("a negative process, parent or group ID is still refused", () => {
	for (const line of [
		" -404 1 404 501 ?? Sat Aug 15 12:08:00 2026 S",
		" 404 -1 404 501 ?? Sat Aug 15 12:08:00 2026 S",
		" 404 1 -404 501 ?? Sat Aug 15 12:08:00 2026 S",
		" 404 1 404 --2 ?? Sat Aug 15 12:08:00 2026 S",
		" 404 1 404 -2x ?? Sat Aug 15 12:08:00 2026 S",
		"not ownership data",
	]) {
		assert.throws(() => parseStopProcessTable(line), /refusing unsafe shutdown/, line);
	}
});

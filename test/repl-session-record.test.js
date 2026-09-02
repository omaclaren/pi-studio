import test from "node:test";
import assert from "node:assert/strict";
import { linkSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	REPL_SESSION_RECORD_ID_OPTION,
	REPL_SESSION_RECORD_PROTOCOL,
	REPL_SESSION_RECORD_VERSION,
	REPL_SESSION_RECORD_VERSION_OPTION,
	acquireReplSessionSendLease,
	clearReplSessionRecord,
	createReplSessionRecordId,
	ensureReplSessionRecord,
	getReplSessionRecordPath,
	isValidReplSessionRecordId,
	readReplSessionRecord,
	renderReplSessionRecordMarkdown,
	upsertReplSessionRecordEntry,
} from "../shared/repl-session-record.js";

function withTempRoot(run) {
	const root = mkdtempSync(join(tmpdir(), "pi-repl-record-test-"));
	return Promise.resolve(run(root)).finally(() => rmSync(root, { recursive: true, force: true }));
}

function identity(overrides = {}) {
	return {
		sessionName: "pi-repl-python",
		tmuxSessionId: "$7",
		tmuxSessionCreatedAt: 1_700_000_000,
		runtime: "ipython",
		...overrides,
	};
}

test("shared REPL protocol uses stable tmux option names and record IDs", () => {
	assert.equal(REPL_SESSION_RECORD_ID_OPTION, "@pi_repl_record_id");
	assert.equal(REPL_SESSION_RECORD_VERSION_OPTION, "@pi_repl_record_version");
	const recordId = createReplSessionRecordId();
	assert.equal(isValidReplSessionRecordId(recordId), true);
	assert.equal(isValidReplSessionRecordId("../../unsafe"), false);
});

test("shared REPL records are private, versioned, updateable snapshots", async () => withTempRoot((root) => {
	const recordId = createReplSessionRecordId();
	const initial = ensureReplSessionRecord(recordId, identity(), { root });
	assert.equal(initial.protocol, REPL_SESSION_RECORD_PROTOCOL);
	assert.equal(initial.version, REPL_SESSION_RECORD_VERSION);
	assert.deepEqual(initial.entries, []);

	const first = upsertReplSessionRecordEntry(recordId, identity(), {
		id: "studio:request-1",
		requestId: "request-1",
		origin: "pi-studio",
		mode: "literate",
		label: "current python chunk",
		prose: "Fit the model.",
		code: "x = 41\nx + 1",
		status: "sending",
	}, { root, origin: "pi-studio" });
	assert.equal(first.entry.origin, "pi-studio");
	assert.equal(first.entry.status, "sending");

	upsertReplSessionRecordEntry(recordId, identity(), {
		...first.entry,
		output: "42",
		status: "captured",
		completedAt: Date.now(),
	}, { root, origin: "pi-studio" });
	upsertReplSessionRecordEntry(recordId, identity(), {
		id: "pi-repl:request-2",
		origin: "pi-repl",
		mode: "agent",
		label: "Pi",
		code: "print(x)",
		output: "41",
		status: "captured",
	}, { root, origin: "pi-repl" });

	const record = readReplSessionRecord(recordId, identity(), { root });
	assert.ok(record);
	assert.equal(record.entries.length, 2);
	assert.equal(record.entries[0].output, "42");
	assert.equal(record.entries[1].origin, "pi-repl");
	assert.equal(JSON.parse(readFileSync(getReplSessionRecordPath(recordId, { root }), "utf8")).recordId, recordId);

	if (process.platform !== "win32") {
		assert.equal(statSync(root).mode & 0o777, 0o700);
		assert.equal(statSync(getReplSessionRecordPath(recordId, { root })).mode & 0o777, 0o600);
	}

	const markdown = renderReplSessionRecordMarkdown(record);
	assert.match(markdown, /^# Shared REPL Record/m);
	assert.match(markdown, /- Origin: pi-studio/);
	assert.match(markdown, /- Origin: pi-repl/);
	assert.match(markdown, /```python\nx = 41/);
	assert.match(markdown, /typed directly into an attached tmux pane/);

	const cleared = clearReplSessionRecord(recordId, identity(), { root });
	assert.deepEqual(cleared.entries, []);
	assert.equal(cleared.droppedEntries, 2);
}));

test("shared REPL records refuse hard-linked sidecars", async () => withTempRoot((root) => {
	const recordId = createReplSessionRecordId();
	ensureReplSessionRecord(recordId, identity(), { root });
	linkSync(getReplSessionRecordPath(recordId, { root }), join(root, "linked-record.json"));
	assert.throws(
		() => readReplSessionRecord(recordId, identity(), { root }),
		/unsafe hard-link count/,
	);
}));

test("shared REPL records require and preserve exact tmux session identity", async () => withTempRoot((root) => {
	assert.throws(
		() => ensureReplSessionRecord(createReplSessionRecordId(), identity({ tmuxSessionId: "" }), { root }),
		/valid tmux session ID/,
	);
	assert.throws(
		() => ensureReplSessionRecord(createReplSessionRecordId(), identity({ tmuxSessionCreatedAt: 0 }), { root }),
		/valid tmux session creation time/,
	);
	const recordId = createReplSessionRecordId();
	ensureReplSessionRecord(recordId, identity(), { root });
	assert.throws(
		() => readReplSessionRecord(recordId, identity({ tmuxSessionId: "$8" }), { root }),
		/different tmux session ID/,
	);
	assert.throws(
		() => readReplSessionRecord(recordId, identity({ tmuxSessionCreatedAt: 1_700_000_001 }), { root }),
		/different tmux session lifetime/,
	);
}));

test("shared REPL send leases serialize compatible clients", async () => withTempRoot(async (root) => {
	const recordId = createReplSessionRecordId();
	ensureReplSessionRecord(recordId, identity(), { root });
	const first = await acquireReplSessionSendLease(recordId, { root, owner: "pi-studio", waitMs: 500 });
	const immediateStartedAt = Date.now();
	await assert.rejects(
		acquireReplSessionSendLease(recordId, { root, owner: "pi-repl-immediate", waitMs: 0 }),
		/busy in another compatible client/,
	);
	assert.ok(Date.now() - immediateStartedAt < 500, "a zero-wait lease should fail immediately");
	let secondAcquired = false;
	const secondPromise = acquireReplSessionSendLease(recordId, { root, owner: "pi-repl", waitMs: 1_500 })
		.then((lease) => {
			secondAcquired = true;
			return lease;
		});
	await new Promise((resolve) => setTimeout(resolve, 120));
	assert.equal(secondAcquired, false);
	await first.release();
	const second = await secondPromise;
	assert.equal(secondAcquired, true);
	await second.release();
}));

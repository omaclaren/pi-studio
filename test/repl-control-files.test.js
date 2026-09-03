import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import {
	cleanupPrivateReplControlFiles,
	createPrivateReplControlFiles,
	ensurePrivateReplControlRoot,
} from "../shared/repl-control-files.js";

test("private REPL control files use compact unique names and clean up", async () => {
	const parent = mkdtempSync(join(tmpdir(), "pi-rc-test-"));
	const root = join(parent, "controls");
	try {
		const first = createPrivateReplControlFiles({
			root,
			extension: "py",
			buildSource: ({ doneFile }) => `done=${JSON.stringify(doneFile)}\n`,
		});
		const second = createPrivateReplControlFiles({
			root,
			extension: ".py",
			buildSource: () => "second\n",
		});

		assert.equal(first.dir, root);
		assert.match(basename(first.sourceFile), /^[a-f0-9]{16}\.py$/);
		assert.match(basename(first.doneFile), /^[a-f0-9]{16}\.done$/);
		assert.notEqual(first.sourceFile, second.sourceFile);
		assert.match(readFileSync(first.sourceFile, "utf8"), new RegExp(first.doneFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
		if (process.platform !== "win32") {
			assert.equal(statSync(root).mode & 0o777, 0o700);
			assert.equal(statSync(first.sourceFile).mode & 0o777, 0o600);
		}

		writeFileSync(first.doneFile, "done\n", "utf8");
		cleanupPrivateReplControlFiles(first);
		cleanupPrivateReplControlFiles(first);
		assert.equal(existsSync(first.sourceFile), false);
		assert.equal(existsSync(first.doneFile), false);
		assert.equal(existsSync(second.sourceFile), true);
		cleanupPrivateReplControlFiles(second);
	} finally {
		await rm(parent, { recursive: true, force: true });
	}
});

test("private REPL control roots prune only stale generated files", async () => {
	const parent = mkdtempSync(join(tmpdir(), "pi-rc-prune-test-"));
	const root = join(parent, "controls");
	try {
		mkdirSync(root, { mode: 0o700 });
		const staleSource = join(root, "0123456789abcdef.py");
		const staleDone = join(root, "0123456789abcdef.done");
		const unrelated = join(root, "keep.txt");
		for (const file of [staleSource, staleDone, unrelated]) writeFileSync(file, "test\n", "utf8");
		const old = new Date(Date.now() - 25 * 60 * 60 * 1_000);
		utimesSync(staleSource, old, old);
		utimesSync(staleDone, old, old);

		ensurePrivateReplControlRoot(root);
		assert.equal(existsSync(staleSource), false);
		assert.equal(existsSync(staleDone), false);
		assert.equal(existsSync(unrelated), true);
	} finally {
		await rm(parent, { recursive: true, force: true });
	}
});

test("private REPL control roots reject permissive directories and symlinks", async (t) => {
	if (process.platform === "win32") {
		t.skip("POSIX ownership and mode checks do not apply on Windows");
		return;
	}
	const parent = mkdtempSync(join(tmpdir(), "pi-rc-safety-test-"));
	try {
		const permissive = join(parent, "permissive");
		ensurePrivateReplControlRoot(permissive);
		chmodSync(permissive, 0o755);
		assert.throws(() => ensurePrivateReplControlRoot(permissive), /mode 0700/);

		const target = join(parent, "target");
		ensurePrivateReplControlRoot(target);
		const link = join(parent, "link");
		symlinkSync(target, link);
		assert.throws(() => ensurePrivateReplControlRoot(link), /not a real directory/);
	} finally {
		await rm(parent, { recursive: true, force: true });
	}
});

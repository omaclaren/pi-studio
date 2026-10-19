import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { syncBuiltinESMExports } from "node:module";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
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

test("control files share an anchor prefix without sharing allocation tokens", async () => {
	const parent = mkdtempSync(join(tmpdir(), "pi-rc-anchor-test-"));
	const root = join(parent, "controls");
	const anchorId = "917dabc98a2f";
	try {
		const create = () => createPrivateReplControlFiles({ root, anchorId, extension: "jl", buildSource: ({ doneFile }) => doneFile });
		const first = create();
		const second = create();
		for (const paths of [first, second]) {
			assert.match(basename(paths.sourceFile), /^917dabc98a2f-[a-f0-9]{16}\.jl$/);
			assert.equal(paths.doneFile, paths.sourceFile.replace(/\.jl$/, ".done"));
			assert.equal(readFileSync(paths.sourceFile, "utf8"), paths.doneFile);
			if (process.platform !== "win32") {
				assert.equal(statSync(root).mode & 0o777, 0o700);
				assert.equal(statSync(paths.sourceFile).mode & 0o777, 0o600);
			}
			writeFileSync(paths.doneFile, "done\n");
		}
		assert.notEqual(first.sourceFile, second.sourceFile);
		cleanupPrivateReplControlFiles({ ...first, doneFile: second.doneFile });
		for (const paths of [first, second]) {
			assert.ok(existsSync(paths.sourceFile));
			assert.ok(existsSync(paths.doneFile));
		}
		cleanupPrivateReplControlFiles(first);
		cleanupPrivateReplControlFiles(first);
		assert.equal(existsSync(first.sourceFile), false);
		assert.equal(existsSync(first.doneFile), false);
		assert.ok(existsSync(second.sourceFile));
		assert.ok(existsSync(second.doneFile));
		cleanupPrivateReplControlFiles(second);
		assert.deepEqual(readdirSync(root), []);
	} finally {
		await rm(parent, { recursive: true, force: true });
	}
});

test("control-file anchors reject malformed values before touching the filesystem", async () => {
	const parent = mkdtempSync(join(tmpdir(), "pi-rc-invalid-anchor-"));
	const root = join(parent, "controls");
	try {
		for (const anchorId of ["", "abcdef12345", "abcdef1234567", "ABCDEF123456", "ghijkl123456", "../abcdef123", "abcdef123456/", "abcdef123456\n", "abcdef123456\r\n", null, 123, {}, false]) {
			assert.throws(() => createPrivateReplControlFiles({ root, anchorId, extension: "py", buildSource: () => "unused" }), /Invalid REPL submission anchor ID/);
			assert.equal(existsSync(root), false);
		}
	} finally {
		await rm(parent, { recursive: true, force: true });
	}
});

test("control-file extensions cannot create names that cleanup would reject", async () => {
	const parent = mkdtempSync(join(tmpdir(), "pi-rc-invalid-extension-"));
	const root = join(parent, "controls");
	try {
		for (const extension of ["", "py\n", ".py\r\n", "py/../txt", "123456789"]) {
			assert.throws(() => createPrivateReplControlFiles({ root, anchorId: "917dabc98a2f", extension, buildSource: () => "unused" }), /Invalid REPL control-file extension/);
			assert.equal(existsSync(root), false);
		}
	} finally {
		await rm(parent, { recursive: true, force: true });
	}
});

for (const sourceKind of ["file", "symlink"]) {
	test(`prefixed allocation retries existing ${sourceKind} and completion names without overwriting`, { skip: sourceKind === "symlink" && process.platform === "win32" }, async (t) => {
		const parent = mkdtempSync(join(tmpdir(), "pi-rc-collision-test-"));
		const root = join(parent, "controls");
		const anchorId = "917dabc98a2f";
		const tokens = [0, 1, 2].map((value) => Buffer.alloc(8, value));
		try {
			ensurePrivateReplControlRoot(root);
			const existingSource = join(root, `${anchorId}-${tokens[0].toString("hex")}.py`);
			const existingDone = join(root, `${anchorId}-${tokens[1].toString("hex")}.done`);
			const target = sourceKind === "symlink" ? join(parent, "unrelated.txt") : existingSource;
			writeFileSync(target, "do not overwrite");
			if (sourceKind === "symlink") symlinkSync(target, existingSource);
			writeFileSync(existingDone, "existing completion");
			let calls = 0;
			t.mock.method(crypto, "randomBytes", (size) => {
				assert.equal(size, 8, "retain all 64 bits of random allocation entropy");
				assert.ok(calls < tokens.length);
				return tokens[calls++];
			});
			syncBuiltinESMExports();
			const paths = createPrivateReplControlFiles({ root, anchorId, extension: "py", buildSource: () => "new source" });
			assert.equal(calls, 3);
			assert.equal(basename(paths.sourceFile), `${anchorId}-${tokens[2].toString("hex")}.py`);
			assert.equal(readFileSync(existingSource, "utf8"), "do not overwrite");
			assert.equal(readFileSync(target, "utf8"), "do not overwrite");
			assert.equal(readFileSync(existingDone, "utf8"), "existing completion");
			assert.equal(existsSync(existingDone.replace(/\.done$/, ".py")), false);
			assert.equal(readFileSync(paths.sourceFile, "utf8"), "new source");
			cleanupPrivateReplControlFiles(paths);
		} finally {
			t.mock.restoreAll();
			syncBuiltinESMExports();
			await rm(parent, { recursive: true, force: true });
		}
	});
}

test("source-builder failure removes both legacy and prefixed allocations", async () => {
	const parent = mkdtempSync(join(tmpdir(), "pi-rc-builder-test-"));
	const root = join(parent, "controls");
	try {
		for (const anchorId of [undefined, "917dabc98a2f"]) {
			assert.throws(() => createPrivateReplControlFiles({ root, anchorId, extension: "m", buildSource: () => { throw new Error("build failed"); } }), /build failed/);
			assert.deepEqual(readdirSync(root), []);
		}
	} finally {
		await rm(parent, { recursive: true, force: true });
	}
});

test("control cleanup leaves malformed names and cross-directory pairs alone", async () => {
	const parent = mkdtempSync(join(tmpdir(), "pi-rc-cleanup-test-"));
	const root = join(parent, "controls");
	try {
		ensurePrivateReplControlRoot(root);
		for (const name of ["917dabc98a2f.py", "917dabc98a2f--0123456789abcdef.py", "917dabc98a2f-0123456789abcdef.py\n", "0123456789abcdef.py\n"]) {
			const sourceFile = join(root, name);
			const doneFile = join(root, name.replace(/\.py\n?$/, ".done"));
			writeFileSync(sourceFile, "source");
			writeFileSync(doneFile, "done");
			cleanupPrivateReplControlFiles({ dir: root, sourceFile, doneFile });
			assert.ok(existsSync(sourceFile));
			assert.ok(existsSync(doneFile));
		}
		const valid = createPrivateReplControlFiles({ root, anchorId: "917dabc98a2f", extension: "py", buildSource: () => "source" });
		const outsideDone = join(parent, basename(valid.doneFile));
		writeFileSync(outsideDone, "outside");
		cleanupPrivateReplControlFiles({ ...valid, doneFile: outsideDone });
		assert.ok(existsSync(valid.sourceFile));
		assert.equal(readFileSync(outsideDone, "utf8"), "outside");
		cleanupPrivateReplControlFiles(valid);
	} finally {
		await rm(parent, { recursive: true, force: true });
	}
});

test("private REPL control roots prune only stale generated files", async () => {
	const parent = mkdtempSync(join(tmpdir(), "pi-rc-prune-test-"));
	const root = join(parent, "controls");
	try {
		mkdirSync(root, { mode: 0o700 });
		const stale = ["0123456789abcdef.py", "0123456789abcdef.done", "917dabc98a2f-0123456789abcdef.ghci", "917dabc98a2f-0123456789abcdef.done"];
		const unrelated = ["keep.txt", "917dabc98a2f.py", "917DABC98A2F-0123456789abcdef.py", "917dabc98a2f-0123456789abcdef.py\n", "0123456789abcdef.py\n"];
		const fresh = ["fedcba9876543210.py", "fedcba9876543210.done", "917dabc98a2f-fedcba9876543210.m", "917dabc98a2f-fedcba9876543210.done"];
		const old = new Date(Date.now() - 25 * 60 * 60 * 1_000);
		for (const name of [...stale, ...unrelated, ...fresh]) {
			const file = join(root, name);
			writeFileSync(file, "test\n");
			if (!fresh.includes(name)) utimesSync(file, old, old);
		}

		ensurePrivateReplControlRoot(root);
		for (const name of stale) assert.equal(existsSync(join(root, name)), false, name);
		for (const name of [...unrelated, ...fresh]) assert.ok(existsSync(join(root, name)), name);
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

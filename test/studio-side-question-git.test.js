import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import {
	buildStudioSideQuestionGitArgs,
	captureStudioSideQuestionGitSnapshot,
	STUDIO_SIDE_QUESTION_GIT_RECENT_COMMIT_LIMIT,
} from "../shared/studio-side-question-git.js";

function runChecked(command, args, options = {}) {
	const result = spawnSync(command, args, { cwd: options.cwd, encoding: "utf8" });
	if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${command} failed`);
	return result.stdout;
}

function createGitRunner(calls) {
	return async (args, options = {}) => {
		const safeArgs = buildStudioSideQuestionGitArgs(args);
		calls.push({ args: [...args], safeArgs, cwd: options.cwd });
		const result = spawnSync("git", safeArgs, {
			cwd: options.cwd,
			encoding: "utf8",
			maxBuffer: Math.max(1_000_000, Number(options.stdoutMaxBytes) || 0),
		});
		return {
			code: result.status,
			signal: result.signal,
			stdout: result.stdout || "",
			stderr: result.stderr || (result.error ? result.error.message : ""),
			stdoutTruncated: false,
			stderrTruncated: false,
		};
	};
}

test("side-question Git context captures a bounded frozen status, staged and unstaged diff, and recent history", async () => {
	const root = mkdtempSync(join(tmpdir(), "pi-studio-side-git-"));
	const calls = [];
	try {
		runChecked("git", ["init"], { cwd: root });
		runChecked("git", ["config", "user.name", "Pi Studio Test"], { cwd: root });
		runChecked("git", ["config", "user.email", "studio@example.invalid"], { cwd: root });
		writeFileSync(join(root, "tracked.txt"), "baseline\n");
		runChecked("git", ["add", "tracked.txt"], { cwd: root });
		runChecked("git", ["commit", "-m", "Initial baseline intent"], { cwd: root });

		writeFileSync(join(root, "tracked.txt"), "baseline\nunstaged update\n");
		writeFileSync(join(root, "staged.txt"), "staged update\n");
		runChecked("git", ["add", "staged.txt"], { cwd: root });
		writeFileSync(join(root, "untracked.txt"), "TOP_SECRET_UNTRACKED_CONTENT\n");

		const snapshot = await captureStudioSideQuestionGitSnapshot(root, { runGit: createGitRunner(calls) });
		assert.equal(Object.isFrozen(snapshot), true);
		assert.equal(snapshot.changeCount, 3);
		assert.equal(snapshot.recentCommitCount, 1);
		assert.match(snapshot.head, /^[a-f0-9]{12}$/);
		assert.match(snapshot.statusText, / M tracked\.txt/);
		assert.match(snapshot.statusText, /A  staged\.txt/);
		assert.match(snapshot.statusText, /\?\? untracked\.txt/);
		assert.match(snapshot.stagedDiff, /staged update/);
		assert.doesNotMatch(snapshot.stagedDiff, /unstaged update/);
		assert.match(snapshot.unstagedDiff, /unstaged update/);
		assert.doesNotMatch(snapshot.stagedDiff + snapshot.unstagedDiff, /TOP_SECRET_UNTRACKED_CONTENT/);
		assert.match(snapshot.recentCommits, /Initial baseline intent/);

		const frozenUnstagedDiff = snapshot.unstagedDiff;
		writeFileSync(join(root, "tracked.txt"), "changed after capture\n");
		assert.equal(snapshot.unstagedDiff, frozenUnstagedDiff);
		assert.doesNotMatch(snapshot.unstagedDiff, /changed after capture/);

		assert.ok(calls.length >= 6);
		for (const call of calls) {
			assert.deepEqual(call.safeArgs.slice(0, 3), ["--no-pager", "--no-optional-locks", "--literal-pathspecs"]);
			assert.ok(call.safeArgs.includes("core.fsmonitor=false"));
			assert.ok(call.safeArgs.includes("core.untrackedCache=false"));
		}
		const diffCalls = calls.filter((call) => call.args[0] === "diff");
		assert.equal(diffCalls.length, 2);
		for (const call of diffCalls) {
			assert.ok(call.args.includes("--no-ext-diff"));
			assert.ok(call.args.includes("--no-textconv"));
		}
		const logCall = calls.find((call) => call.args[0] === "log");
		assert.ok(logCall.args.includes(`--max-count=${STUDIO_SIDE_QUESTION_GIT_RECENT_COMMIT_LIMIT}`));
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("side-question Git context supports a clean repository before its first commit", async () => {
	const root = mkdtempSync(join(tmpdir(), "pi-studio-side-git-unborn-"));
	try {
		runChecked("git", ["init"], { cwd: root });
		const snapshot = await captureStudioSideQuestionGitSnapshot(root, { runGit: createGitRunner([]) });
		assert.equal(snapshot.hasHead, false);
		assert.equal(snapshot.head, "");
		assert.equal(snapshot.changeCount, 0);
		assert.equal(snapshot.recentCommitCount, 0);
		assert.match(snapshot.statusText, /working tree clean/);
		assert.equal(snapshot.stagedDiff, "[no staged changes]");
		assert.equal(snapshot.unstagedDiff, "[no unstaged tracked changes]");
		assert.equal(snapshot.recentCommits, "[no commits yet]");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("side-question Git context rejects a selected root broader or narrower than the repository", async () => {
	const root = mkdtempSync(join(tmpdir(), "pi-studio-side-git-root-"));
	try {
		runChecked("git", ["init"], { cwd: root });
		const nested = join(root, "nested");
		mkdirSync(nested);
		await assert.rejects(
			captureStudioSideQuestionGitSnapshot(nested, { runGit: createGitRunner([]) }),
			/requires the selected related-files root to be the repository root/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

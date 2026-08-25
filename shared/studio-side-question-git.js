import { realpathSync, statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

export const STUDIO_SIDE_QUESTION_GIT_RECENT_COMMIT_LIMIT = 20;
export const STUDIO_SIDE_QUESTION_GIT_STATUS_MAX_BYTES = 120_000;
export const STUDIO_SIDE_QUESTION_GIT_DIFF_MAX_BYTES = 300_000;
export const STUDIO_SIDE_QUESTION_GIT_LOG_MAX_BYTES = 80_000;

const STUDIO_SIDE_QUESTION_GIT_GLOBAL_ARGS = Object.freeze([
	"--no-pager",
	"--no-optional-locks",
	"--literal-pathspecs",
	"-c", "color.ui=false",
	"-c", "core.pager=cat",
	"-c", "core.quotePath=true",
	"-c", "core.fsmonitor=false",
	"-c", "core.untrackedCache=false",
]);

function canonicalDirectory(pathValue) {
	const resolved = resolve(String(pathValue || ""));
	if (!statSync(resolved).isDirectory()) throw new Error(`Git context root is not a directory: ${resolved}`);
	return realpathSync(resolved);
}

function cleanOutput(value) {
	return String(value || "").replace(/\r\n/g, "\n").trim();
}

function resultFailure(result, label) {
	const detail = cleanOutput(result?.stderr) || cleanOutput(result?.stdout) || `exit code ${String(result?.code)}`;
	return new Error(`${label} failed: ${detail}`);
}

function requireSuccessfulResult(result, label) {
	if (!result || result.code !== 0) throw resultFailure(result, label);
	return result;
}

function parseBranch(statusText, hasHead) {
	const branchLine = String(statusText || "").split("\n").find((line) => line.startsWith("## ")) || "";
	const value = branchLine.slice(3).trim();
	const unborn = value.match(/^No commits yet on (.+)$/);
	if (unborn) return unborn[1].trim() || "unborn branch";
	if (!hasHead) return value || "unborn branch";
	if (!value || /^HEAD\b/.test(value)) return "detached HEAD";
	return value.split("...")[0].split(" [")[0].trim() || "detached HEAD";
}

function countStatusEntries(statusText) {
	return String(statusText || "").split("\n").filter((line) => {
		const value = line.trimEnd();
		return Boolean(value) && !value.startsWith("## ") && value !== "[output truncated by Studio]";
	}).length;
}

function formatStatusSnapshot(statusText, branch, changeCount) {
	const value = cleanOutput(statusText);
	if (!value) return `## ${branch}\n[working tree clean]`;
	if (changeCount === 0 && !value.includes("[working tree clean]")) return `${value}\n[working tree clean]`;
	return value;
}

function formatDiffSnapshot(diffText, emptyLabel) {
	const value = cleanOutput(diffText);
	return value || `[${emptyLabel}]`;
}

export function buildStudioSideQuestionGitArgs(args) {
	if (!Array.isArray(args) || args.some((value) => typeof value !== "string")) {
		throw new Error("Git arguments must be an array of strings.");
	}
	return [...STUDIO_SIDE_QUESTION_GIT_GLOBAL_ARGS, ...args];
}

export async function captureStudioSideQuestionGitSnapshot(contextRoot, options = {}) {
	if (typeof options.runGit !== "function") throw new Error("A bounded Git runner is required.");
	const selectedRoot = canonicalDirectory(contextRoot);
	const rootResult = requireSuccessfulResult(await options.runGit(
		["rev-parse", "--show-toplevel"],
		{ cwd: selectedRoot, stdoutMaxBytes: 16_384, label: "Git repository detection" },
	), "Git repository detection");
	const reportedRoot = cleanOutput(rootResult.stdout);
	if (!reportedRoot || !isAbsolute(reportedRoot)) throw new Error("Git did not return an absolute repository root.");
	const repoRoot = canonicalDirectory(reportedRoot);
	if (repoRoot !== selectedRoot) {
		throw new Error("Git context requires the selected related-files root to be the repository root.");
	}

	const run = (args, runOptions) => options.runGit(args, { cwd: repoRoot, ...runOptions });
	const [statusResult, headResult, stagedResult, unstagedResult, logResult] = await Promise.all([
		run(["status", "--short", "--branch", "--untracked-files=all"], {
			stdoutMaxBytes: STUDIO_SIDE_QUESTION_GIT_STATUS_MAX_BYTES,
			label: "Git status snapshot",
		}),
		run(["rev-parse", "--verify", "--short=12", "HEAD"], {
			stdoutMaxBytes: 16_384,
			label: "Git HEAD snapshot",
		}),
		run(["diff", "--cached", "--no-ext-diff", "--no-textconv", "--unified=3", "--find-renames", "--no-color", "--"], {
			stdoutMaxBytes: STUDIO_SIDE_QUESTION_GIT_DIFF_MAX_BYTES,
			label: "Staged Git diff snapshot",
		}),
		run(["diff", "--no-ext-diff", "--no-textconv", "--unified=3", "--find-renames", "--no-color", "--"], {
			stdoutMaxBytes: STUDIO_SIDE_QUESTION_GIT_DIFF_MAX_BYTES,
			label: "Unstaged Git diff snapshot",
		}),
		run(["log", "--no-show-signature", `--max-count=${STUDIO_SIDE_QUESTION_GIT_RECENT_COMMIT_LIMIT}`, "--date=short", "--pretty=format:%h%x09%ad%x09%an%x09%s"], {
			stdoutMaxBytes: STUDIO_SIDE_QUESTION_GIT_LOG_MAX_BYTES,
			label: "Recent Git history snapshot",
		}),
	]);

	requireSuccessfulResult(statusResult, "Git status snapshot");
	requireSuccessfulResult(stagedResult, "Staged Git diff snapshot");
	requireSuccessfulResult(unstagedResult, "Unstaged Git diff snapshot");
	const hasHead = headResult?.code === 0 && Boolean(cleanOutput(headResult.stdout));
	if (hasHead) requireSuccessfulResult(logResult, "Recent Git history snapshot");

	const rawStatus = cleanOutput(statusResult.stdout);
	const branch = parseBranch(rawStatus, hasHead);
	const changeCount = countStatusEntries(rawStatus);
	const recentCommits = hasHead ? cleanOutput(logResult.stdout) : "";
	const recentCommitCount = recentCommits
		? recentCommits.split("\n").filter((line) => line && line !== "[output truncated by Studio]").length
		: 0;
	const snapshot = {
		repoRoot,
		capturedAt: Date.now(),
		branch,
		head: hasHead ? cleanOutput(headResult.stdout) : "",
		hasHead,
		changeCount,
		recentCommitCount,
		statusText: formatStatusSnapshot(rawStatus, branch, changeCount),
		stagedDiff: formatDiffSnapshot(stagedResult.stdout, "no staged changes"),
		unstagedDiff: formatDiffSnapshot(unstagedResult.stdout, "no unstaged tracked changes"),
		recentCommits: recentCommits || "[no commits yet]",
		statusTruncated: statusResult.stdoutTruncated === true,
		stagedDiffTruncated: stagedResult.stdoutTruncated === true,
		unstagedDiffTruncated: unstagedResult.stdoutTruncated === true,
		logTruncated: logResult?.stdoutTruncated === true,
	};
	return Object.freeze(snapshot);
}

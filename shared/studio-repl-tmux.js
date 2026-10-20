import { stripReplSubmissionDisplay } from "./repl-submission-display.js";

const STUDIO_REPL_PROMPT_COMMAND_ENVIRONMENT = "PROMPT_COMMAND=";

/**
 * Studio's own sessions: pi-studio-repl-<runtime>, then an optional custom-command
 * hash and an optional new-session suffix. Verified Stop accepts only these.
 */
export const STUDIO_REPL_SESSION_NAME = /^pi-studio-repl-(?:shell|python|ipython|julia|r|ghci|clojure|ruby|java|octave|matlab|gnuplot)(?:-[a-f0-9]{8})?(?:-[a-z0-9]+-[a-f0-9]{6})?$/;

/** Studio's gnuplot sessions. Their Stop also ends gnuplot and Qt helpers that carry the session's owner marker. */
export const isStudioGnuplotSession = (name) => /^pi-studio-repl-gnuplot(?:-|$)/.test(name);

/** Fields read for each pane, in the order firstStudioReplPanes expects. */
export const STUDIO_REPL_PANE_FORMAT = "#{window_index}\t#{pane_index}\t#{pane_id}\t#{session_name}\t#{session_id}\t#{session_created}\t#{@pi_repl_runtime}\t#{@pi_repl_record_id}\t#{@pi_repl_record_version}";

/**
 * Build the tmux arguments for a Studio-owned REPL session. tmux prints the new
 * session's ID and its first pane's ID, so Studio can address both even if
 * another session takes the name or another window appears.
 *
 * PROMPT_COMMAND contains shell-local function names on some terminals (notably
 * cmux/Ghostty with macOS Bash 3.2). The variable may be exported to Pi while
 * the corresponding functions cannot be inherited by a child shell, so start
 * each detached REPL with a clean prompt-command environment.
 *
 * @param {string} sessionName
 * @param {string} cwd
 * @param {string} command
 * @param {string[]} [environment] more NAME=value settings for the runtime
 * @returns {string[]}
 */
export function buildStudioReplTmuxStartArgs(sessionName, cwd, command, environment = []) {
	return [
		"new-session",
		"-d",
		"-P",
		"-F",
		"#{session_id}\t#{pane_id}",
		"-s",
		sessionName,
		"-c",
		cwd,
		"-e",
		STUDIO_REPL_PROMPT_COMMAND_ENVIRONMENT,
		...environment.flatMap((setting) => ["-e", setting]),
		command,
	];
}

/**
 * tmux arguments that close a REPL pane whose runtime exited while starting, in
 * one step, and only if it is still dead, still the process Studio saw and still
 * in the session Studio started. A pane respawned or moved since is left alone.
 *
 * @param {string} sessionId
 * @param {string} paneId
 * @param {string} panePid the exited runtime's process ID, as Studio saw it
 * @returns {string[] | null} null if any of them isn't a tmux ID or process ID
 */
export function buildStudioReplDeadPaneCloseArgs(sessionId, paneId, panePid) {
	if (!/^\$\d+$/.test(sessionId) || !/^%\d+$/.test(paneId) || !/^\d+$/.test(panePid)) return null;
	return [
		"if-shell", "-F", "-t", paneId,
		`#{&&:#{pane_dead},#{&&:#{==:#{pane_pid},${panePid}},#{==:#{session_id},${sessionId}}}}`,
		`kill-pane -t '${paneId}'`,
	];
}

/**
 * A whole session by its exact name or tmux ID. A bare name would also match a
 * longer name that starts with it: pi-repl-r would find pi-repl-ruby.
 *
 * @param {string} session
 * @returns {string}
 */
export function studioReplSessionTarget(session) {
	return /^\$\d+$/.test(session) ? session : `=${session}`;
}

/**
 * @typedef {{ windowIndex: number, paneIndex: number, paneId: string, sessionName: string, sessionId: string,
 *   createdAt: string, runtime: string, recordId: string, version: string }} StudioReplPane
 */

/**
 * Each session's first pane, by its actual window and pane numbers (tmux's
 * base-index can be 1), from list-panes output in STUDIO_REPL_PANE_FORMAT.
 * Sessions keep the order they were listed in.
 *
 * @param {string} stdout
 * @returns {StudioReplPane[]}
 */
export function firstStudioReplPanes(stdout) {
	/** @type {Map<string, StudioReplPane>} */
	const first = new Map();
	for (const line of String(stdout || "").split(/\r?\n/)) {
		const [windowIndex = "", paneIndex = "", paneId = "", sessionName = "", sessionId = "", createdAt = "", runtime = "", recordId = "", version = ""] = line.split("\t");
		if (!/^\d+$/.test(windowIndex) || !/^\d+$/.test(paneIndex) || !/^%\d+$/.test(paneId) || !/^\$\d+$/.test(sessionId) || !sessionName) continue;
		const pane = { windowIndex: Number(windowIndex), paneIndex: Number(paneIndex), paneId, sessionName, sessionId, createdAt, runtime, recordId, version };
		const known = first.get(sessionId);
		if (!known || pane.windowIndex < known.windowIndex || (pane.windowIndex === known.windowIndex && pane.paneIndex < known.paneIndex)) {
			first.set(sessionId, pane);
		}
	}
	return [...first.values()];
}

const STUDIO_REPL_READY_PROMPTS = {
	python: /^>>>[ \t]*$/,
	ipython: /^In \[\d+\]:[ \t]*$/,
	julia: /^julia>[ \t]*$/,
	r: /^>[ \t]*$/,
	ghci: /^\*?[A-Za-z0-9_.:]+(?: \*?[A-Za-z0-9_.:]+)*>[ \t]*$/,
	clojure: /^[^\s>]+=>[ \t]*$/,
	ruby: /^irb\([^\n]*\):\d+(?::0)?>[ \t]*$/,
	java: /^jshell>[ \t]*$/,
	octave: /^octave:\d+>[ \t]*$/,
	matlab: /^>>[ \t]*$/,
	gnuplot: /^gnuplot>[ \t]*$/,
};

/**
 * Whether the cursor row shows the runtime's normal prompt, as pi-repl checks
 * it. Python and IPython accept each other's prompt. Shell prompts are the
 * user's own, so none is recognised.
 *
 * @param {string} runtime
 * @param {string} line the cursor row
 * @returns {boolean}
 */
export function isStudioReplReadyLine(runtime, line) {
	const value = String(line ?? "").replace(/\r/g, "");
	if (value.includes("\n")) return false;
	if (runtime === "python" || runtime === "ipython") {
		return STUDIO_REPL_READY_PROMPTS.python.test(value) || STUDIO_REPL_READY_PROMPTS.ipython.test(value);
	}
	const prompt = STUDIO_REPL_READY_PROMPTS[/** @type {keyof typeof STUDIO_REPL_READY_PROMPTS} */ (runtime)];
	return Boolean(prompt && prompt.test(value));
}

/**
 * @param {string} line
 * @param {boolean} [mLanguage] an Octave or MATLAB submission. As in pi-repl, their
 *   prompts count only for them: >> could be another runtime's output.
 */
function isStudioReplPrompt(line, mLanguage = false) {
	return /^(?:>>>|In \[\d+\]:|\.\.\.:|>|\+)\s*$/.test(line)
		|| /^(?:ghci|Prelude|\*?[A-Za-z0-9_.:]+)>\s*$/.test(line)
		|| /^[^\s>]+=>\s*$/.test(line)
		|| /^irb\(.*\)[:\d]+[>*]\s*$/.test(line)
		|| (mLanguage && /^(?:octave:\d+>|>>)\s*$/.test(line));
}

/** @param {string} text */
const compact = (text) => text.replace(/\s+/g, "");

/**
 * Remove this submission's loader echo from the start of the lines, once. The
 * loader names a private file with a random token, so only this submission's
 * echo matches. IPython can wrap a long echo onto "...:" continuation rows.
 *
 * @param {string[]} lines
 * @param {string} submissionLine
 * @param {boolean} anyPrefix Shell prompts are the user's own
 * @param {boolean} [mLanguage] an Octave or MATLAB submission
 * @returns {boolean} whether the echo was found and removed
 */
function removeLoaderEcho(lines, submissionLine, anyPrefix, mLanguage = false) {
	const first = lines[0] ?? "";
	const prefixOk = (/** @type {number} */ index) => {
		const prefix = first.slice(0, index).trim();
		return anyPrefix || !prefix || isStudioReplPrompt(prefix, mLanguage);
	};
	const index = first.indexOf(submissionLine);
	if (index >= 0 && prefixOk(index)) {
		// Some input editors join output to the echo; keep the rest of that row.
		const remainder = first.slice(index + submissionLine.length);
		if (remainder.trim()) lines[0] = remainder;
		else lines.shift();
		return true;
	}
	// A wrapped echo starts on a row no wider than a terminal; skip long output rows.
	if (first.length > 2048) return false;
	const want = compact(submissionLine);
	const head = compact(submissionLine.slice(0, 12));
	for (let start = 0; start < first.length; start += 1) {
		const piece = compact(first.slice(start));
		if (!piece.startsWith(head) || !want.startsWith(piece) || !prefixOk(start)) continue;
		if (piece === want) {
			lines.shift();
			return true;
		}
		let joined = piece;
		for (let row = 1; row < Math.min(lines.length, 8); row += 1) {
			joined += compact((lines[row] ?? "").replace(/^\s*\.\.\.:?/, ""));
			if (joined === want) {
				lines.splice(0, row + 1);
				return true;
			}
			if (!want.startsWith(joined)) return false;
		}
		return false;
	}
	return false;
}

/**
 * Clean one submission's pane output for Studio's record and tool result, as
 * pi-repl does. Remove only this submission's scaffolding: its loader echo
 * once, one trailing prompt once it has finished, and Clojure's silent result.
 * Output that looks like a prompt or a loader is kept.
 *
 * @param {string} delta pane text added since the submission
 * @param {{ submissionLine: string, runtime?: string, display?: any, promptLine?: string, completed?: boolean }} details
 *   promptLine is the pane's prompt row before the submission.
 * @returns {string}
 */
export function cleanStudioReplOutput(delta, details) {
	const lines = String(delta || "").replace(/\r\n?/g, "\n").split("\n");
	const dropBlankEdges = () => {
		while (lines.length && !lines[0].trim()) lines.shift();
		while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
	};
	dropBlankEdges();
	const mLanguage = (details.submissionLine || "").startsWith("eval(fileread(");
	// Prompt rows before this submission's echo are scaffolding. Without an echo
	// (terminal echo off, say) they may be output, so they stay.
	let lead = 0;
	while (lead < lines.length && (!lines[lead].trim() || isStudioReplPrompt(lines[lead].trim(), mLanguage))) lead += 1;
	if (lead < lines.length && details.submissionLine) {
		const rest = lines.slice(lead);
		if (removeLoaderEcho(rest, details.submissionLine, details.runtime === "shell", mLanguage)) lines.splice(0, lines.length, ...rest);
	}
	const silent = /:pi-studio\/silent\)$/.test(details.submissionLine || "") ? ":pi-studio/silent" : "";
	const promptLine = String(details.promptLine || "").trim();
	// Until the code has finished, its prompt and Clojure's silent result can't have
	// appeared yet; anything that looks like them is output.
	let removedPrompt = details.completed === false;
	let removedSilent = !silent || details.completed === false;
	while (lines.length) {
		const last = lines[lines.length - 1].trim();
		if (!last) { lines.pop(); continue; }
		if (!removedPrompt && (isStudioReplPrompt(last, mLanguage) || (promptLine && last === promptLine))) {
			lines.pop();
			removedPrompt = true;
			continue;
		}
		if (!removedSilent && last === silent) {
			lines.pop();
			removedSilent = true;
			continue;
		}
		break;
	}
	const cleaned = lines.join("\n");
	const shown = details.display ? stripReplSubmissionDisplay(cleaned, details.display) : cleaned;
	lines.splice(0, lines.length, ...shown.split("\n"));
	dropBlankEdges();
	return lines.join("\n").replace(/[\t ]+$/gm, "");
}

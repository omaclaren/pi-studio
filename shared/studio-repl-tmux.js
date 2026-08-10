const STUDIO_REPL_PROMPT_COMMAND_ENVIRONMENT = "PROMPT_COMMAND=";

/**
 * Build the tmux arguments for a Studio-owned REPL session.
 *
 * PROMPT_COMMAND contains shell-local function names on some terminals (notably
 * cmux/Ghostty with macOS Bash 3.2). The variable may be exported to Pi while
 * the corresponding functions cannot be inherited by a child shell, so start
 * each detached REPL with a clean prompt-command environment.
 *
 * @param {string} sessionName
 * @param {string} cwd
 * @param {string} command
 * @returns {string[]}
 */
export function buildStudioReplTmuxStartArgs(sessionName, cwd, command) {
	return [
		"new-session",
		"-d",
		"-s",
		sessionName,
		"-c",
		cwd,
		"-e",
		STUDIO_REPL_PROMPT_COMMAND_ENVIRONMENT,
		command,
	];
}

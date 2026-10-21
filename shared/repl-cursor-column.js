// The Node script a REPL wrapper runs to learn the pane's cursor column, so
// that it ends a line before its footer only when output stopped mid-line. It
// prints the column, or exits non-zero; tmux gets 500 ms. process.exit ends
// Node even if a startup hook in NODE_OPTIONS would keep it running. Only the
// wrapper reads its output, so it never reaches the pane.
export const CURSOR_COLUMN_QUERY = 'let code = 1; try { require("node:fs").writeSync(1, require("node:child_process").execFileSync("tmux", ["-N", "display-message", "-p", "-t", process.env.TMUX_PANE, "#{cursor_x}"], { encoding: "utf8", timeout: 500, killSignal: "SIGKILL", maxBuffer: 128, stdio: ["ignore", "pipe", "ignore"] }).trim()); code = 0; } catch {} process.exit(code);';

/**
 * Runs CURSOR_COLUMN_QUERY in a child Node, with the caller's NODE_OPTIONS
 * (its argument), and kills it after 5 s. The supervisor itself runs without
 * NODE_OPTIONS, so no startup hook can stall it, keep it running or catch its
 * timer, and SIGKILL can't be caught either; a hook that caught perl's SIGALRM
 * held the helper as long as it liked. It signals only its own child, which
 * Node tracks, so never a process ID since reused. It ignores Ctrl-C and
 * hangups, so the deadline holds then too; the query gets the default
 * handling. It exits 0 or 1. From pi-studio 0.11.0.
 */
export const CURSOR_COLUMN_SUPERVISOR = `for (const signal of ["SIGINT", "SIGHUP", "SIGTERM"]) process.on(signal, () => {}); const child = require("node:child_process").spawn(process.execPath, ["-e", ${JSON.stringify(CURSOR_COLUMN_QUERY)}], { stdio: ["ignore", "inherit", "ignore"], env: { ...process.env, NODE_OPTIONS: process.argv[1] ?? "" } }); const timer = setTimeout(() => child.kill("SIGKILL"), 5000); child.on("error", () => process.exit(1)); child.on("exit", (code) => { clearTimeout(timer); process.exit(code === 0 ? 0 : 1); });`;

const shellQuote = (value) => `'${value.replace(/'/g, `'"'"'`)}'`;

/**
 * A command that runs the query under /bin/sh, whatever the caller's shell
 * (MATLAB's system() uses $SHELL), for runtimes whose own process call can't
 * be bounded (GHCi's :!, and Octave and MATLAB system()).
 * CURSOR_COLUMN_SUPERVISOR stops it after 5 s. The column passes through a
 * temporary file, so a child the helper leaves behind can't hold the caller's
 * pipe open; the file is removed even when the script is interrupted. The
 * shell's messages are discarded, and it exits only 0 or 1, so the caller
 * never prints a signal status.
 */
export function boundedCursorColumnCommand(nodePath) {
	const script = [
		"exec 2>/dev/null",
		"f=$(mktemp) || exit 1",
		// Ctrl-C reaches this shell too; the file goes either way.
		`trap 'rm -f "$f"' EXIT`,
		"trap 'exit 1' HUP INT TERM",
		// After --, Node takes the caller's NODE_OPTIONS as the script's argument, not as its own option.
		`NODE_OPTIONS= ${shellQuote(nodePath)} -e ${shellQuote(CURSOR_COLUMN_SUPERVISOR)} -- "\${NODE_OPTIONS-}" >"$f" </dev/null`,
		"s=$?",
		'cat "$f"',
		'[ "$s" = 0 ]',
	].join("; ");
	return `/bin/sh -c ${shellQuote(script)}`;
}

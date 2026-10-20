const shellQuote = (value) => `'${value.replace(/'/g, `'"'"'`)}'`;

export function gnuplotStringLiteral(value) {
	if (/[\r\n\0]/.test(value)) throw new Error("gnuplot control paths cannot contain line breaks or NUL bytes.");
	// Single quotes suppress both backslash escapes and backquote shell
	// substitution. Concatenate literal apostrophes: repeated doubled quotes
	// are misparsed by gnuplot 6.0. Only the fixed apostrophe uses double quotes.
	return value.includes("'") ? `(${value.split("'").map((part) => `'${part}'`).join(' . "\'" . ')})` : `'${value}'`;
}

export function buildGnuplotSubmissionLine(driverFile) {
	// Ignore SIGINT in the pipe producer, not in gnuplot. Gnuplot unwinds a
	// failed/interrupted load and waits for pclose(); the producer must survive
	// long enough to observe that closure and release the completion/lease.
	return `load ${gnuplotStringLiteral(`<trap "" INT; exec ${shellQuote(process.execPath)} ${shellQuote(driverFile)}`)}`;
}

export function buildGnuplotGuardSource(ackFile) {
	// Unlike `system`, native load-from-pipe leaves GPVAL_SYSTEM_ERRNO alone.
	// No gnuplot helper variables, print destination or terminal changes.
	return `load ${gnuplotStringLiteral(`<umask 077; set -C; : > ${shellQuote(ackFile)}`)}\n`;
}

export function buildGnuplotDriverSource(sourceFile, guardFile, ackFile, doneFile, display) {
	const commands = `load ${gnuplotStringLiteral(sourceFile)}\nload ${gnuplotStringLiteral(guardFile)}\n`;
	return `const fs = require("node:fs");
let ending = false;
let writable = true;
process.on("SIGINT", () => {});
function finish() {
  if (ending) return;
  ending = true;
  // Off still ends a line that output left open, as C++ does; it adds nothing else.
  let column = "";
  try {
    column = require("node:child_process").execFileSync("tmux", ["-N", "display-message", "-p", "-t", process.env.TMUX_PANE, "#{cursor_x}"], {
      encoding: "utf8", timeout: 500, killSignal: "SIGKILL", maxBuffer: 128, stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {}
  fs.writeSync(2, (column === "0" ? "" : "\\n") + ${JSON.stringify(display.enabled ? display.suffixLines.join("\n") + "\n" : "")});
  fs.writeFileSync(${JSON.stringify(doneFile)}, "done\\n", { mode: 0o600, flag: "wx" });
  process.exit(0);
}
process.stdout.on("error", error => {
  if (error.code === "EPIPE") finish();
  else throw error;
});
process.stdout.on("drain", () => { writable = true; });
${display.enabled ? `fs.writeSync(2, ${JSON.stringify(display.prefixLines.join("\n") + "\n")});\n` : ""}writable = process.stdout.write(${JSON.stringify(commands)});
// ACK means the nested source returned. On errors/Ctrl-C, gnuplot closes
// this pipe instead. Bounded comment writes witness EPIPE without queuing
// terminal input that could answer pause or an unfinished expression.
// Respect backpressure: a long-running source cannot grow an output queue.
setInterval(() => {
  if (fs.existsSync(${JSON.stringify(ackFile)})) return finish();
  if (writable) writable = process.stdout.write("#\\n");
}, 50);
`;
}

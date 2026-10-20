import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, unlinkSync } from "node:fs";
import { basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const CPP_DRIVER_HEADER = fileURLToPath(new URL("./repl-cpp-driver.hxx", import.meta.url));
export const CPP_MAX_SOURCE_BYTES = 16 * 1024 * 1024;
const stemPattern = /^(?:[a-f0-9]{12}-)?[a-f0-9]{16}$/;

// Fixed-width octal encodes UTF-8 without C++ hex-escape run-on or terminal input.
export function cppStringLiteral(value) {
	return '"' + [...Buffer.from(String(value), "utf8")].map((b) => `\\${b.toString(8).padStart(3, "0")}`).join("") + '"';
}
function quote(value) { return `'${value.replace(/'/g, `'"'"'`)}'`; }
function privateStat(path, directory = false) {
	const s = lstatSync(path, { bigint: true });
	if (!(directory ? s.isDirectory() : s.isFile()) || s.isSymbolicLink()
		|| s.uid !== BigInt(process.getuid()) || (s.mode & 0o777n) !== (directory ? 0o700n : 0o600n)
		|| (!directory && s.nlink !== 1n)) throw new Error(`Unsafe C++ control path: ${path}`);
	return s;
}
export function buildCppRequest(sourceFile, doneFile, display) {
	const stem = basename(sourceFile, ".cpp");
	if (!stemPattern.test(stem) || stem.length !== stem.match(stemPattern)?.[0].length
		|| basename(doneFile) !== `${stem}.done` || dirname(sourceFile) !== dirname(doneFile)) throw new Error("Invalid C++ control family.");
	const s = privateStat(sourceFile);
	if (s.size > BigInt(CPP_MAX_SOURCE_BYTES)) throw new Error("C++ submission exceeds the 16 MiB source limit; no code was sent.");
	const footer = [
		'let column = "";',
		'try { column = require("node:child_process").execFileSync("tmux", ["-N", "display-message", "-p", "-t", process.env.TMUX_PANE, "#{cursor_x}"], { encoding: "utf8", timeout: 500, killSignal: "SIGKILL", maxBuffer: 128, stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch {}',
		`process.stderr.write((column === "0" ? "" : "\\n") + ${JSON.stringify(display.enabled ? display.suffixLines.join("\n") + "\n" : "")});`,
	].join(" ");
	// Length framing, not executable C++/JSON interpolation. Names are relative
	// to a pinned private directory, and source inode/size are checked natively.
	const fields = [stem, String(s.dev), String(s.ino), String(s.size), display.enabled ? display.prefixLines.join("\n") + "\n" : "", `${quote(process.execPath)} -e ${quote(footer)}`];
	return "pi-repl-cpp-v1\n" + fields.map((s) => `${Buffer.byteLength(s)}\n${s}`).join("");
}
export function cppInclude(path) {
	if (/[\x00-\x1f\x7f\u2028\u2029]/.test(path)) throw new Error("C++ include paths cannot contain control characters, line breaks or NUL bytes.");
	if (!path.includes(">")) return `#include <${path}>`;
	if (!path.includes('"')) return `#include "${path}"`;
	throw new Error("C++ include paths cannot contain both double quotes and >.");
}
export function buildCppDriverSource(requestFile, doneFile) {
	const { submissionLine } = prepareCppSubmission(requestFile, doneFile);
	const name = basename(requestFile, ".req").replaceAll("-", "_");
	if (!/^[a-f0-9_]+$/.test(name)) throw new Error("Invalid C++ driver name.");
	// A unique, ordinary C++ initializer, NOT Cling's top-level-statement
	// extension. Each include runs this request once; no stdin command follows.
	return `${cppInclude(CPP_DRIVER_HEADER)}\nnamespace pi_repl_cpp_v1 { const int request_${name} = (${submissionLine.slice(0, -1)}, 0); }\n`;
}
export function prepareCppSubmission(requestFile, doneFile) {
	if (dirname(requestFile) !== dirname(doneFile)) throw new Error("C++ controls must share one private directory.");
	const root = privateStat(dirname(requestFile), true);
	const request = privateStat(requestFile);
	return {
		submissionLine: `pi_repl_cpp_v1::submit(${cppStringLiteral(requestFile)}, ${root.dev}ULL, ${root.ino}ULL, ${request.dev}ULL, ${request.ino}ULL, ${request.size}ULL);`,
		completion: { doneFile, rootDev: String(root.dev), rootIno: String(root.ino), stem: basename(doneFile, ".done") },
	};
}

export function createCppControlCleanup(completion, paths) {
	const files = paths.map((path) => ({ path, stat: privateStat(path) }));
	return () => {
		try {
			const root = privateStat(dirname(completion.doneFile), true);
			if (String(root.dev) !== completion.rootDev || String(root.ino) !== completion.rootIno) return;
		} catch { return; }
		for (const { path, stat } of files) {
			try {
				const current = privateStat(path);
				if (current.dev === stat.dev && current.ino === stat.ino && current.size === stat.size) unlinkSync(path);
			} catch { /* Absent or changed controls are never adopted for cleanup. */ }
		}
		if (readCppCompletion(completion) !== undefined) {
			try { unlinkSync(completion.doneFile); } catch {}
		}
	};
}

// Presence, prompts and display IDs are not settlement. Partial/malformed,
// symlinked, multiply-linked or replaced-root replies remain pending.
export function readCppCompletion(completion) {
	let fd;
	try {
		const { doneFile, rootDev, rootIno, stem } = completion;
		const root = privateStat(dirname(doneFile), true);
		if (String(root.dev) !== rootDev || String(root.ino) !== rootIno) return undefined;
		const before = privateStat(doneFile);
		if (before.size > 128n) return undefined;
		fd = openSync(doneFile, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
		const opened = fstatSync(fd, { bigint: true });
		if (opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== before.size
			|| !opened.isFile() || opened.uid !== BigInt(process.getuid()) || opened.nlink !== 1n || (opened.mode & 0o777n) !== 0o600n) return undefined;
		const buffer = Buffer.alloc(129);
		const count = readSync(fd, buffer, 0, buffer.length, 0);
		if (BigInt(count) !== opened.size) return undefined;
		const text = buffer.subarray(0, count).toString("utf8");
		const after = privateStat(doneFile);
		if (after.dev !== opened.dev || after.ino !== opened.ino || after.size !== opened.size) return undefined;
		const finalRoot = privateStat(dirname(doneFile), true);
		if (String(finalRoot.dev) !== rootDev || String(finalRoot.ino) !== rootIno) return undefined;
		const match = text.match(/^pi-repl-cpp-v1 ([a-f0-9-]+) ([0-5])\n$/);
		if (!match || match[0] !== text || match[1] !== stem) return undefined;
		return Number(match[2]);
	} catch { return undefined; }
	finally { if (fd !== undefined) closeSync(fd); }
}

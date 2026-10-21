import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import ts from "typescript";

import { CURSOR_COLUMN_QUERY, CURSOR_COLUMN_SUPERVISOR } from "../shared/repl-cursor-column.js";
import { buildMLanguageControlSource, buildMLanguageDriverSource, mStringLiteral } from "../shared/repl-m-language.js";
import { createReplSubmissionDisplay } from "../shared/repl-submission-display.js";

// Candidate80 (Sol, Astra): output that ends mid-line took the done marker onto its row.
// As in pi-repl 0.8.4, each wrapper asks a Node query for the pane's cursor column and
// prints the footer itself, starting a new line unless the column is 0. The query writes
// only to a pipe the wrapper reads, so one that outlives its wait can't reach the pane.
// These run the real generated wrappers with fake queries; the tmux side is in
// studio-repl-execution-integration.test.js.
const serverSource = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
const has = (command) => spawnSync("/bin/sh", ["-c", `command -v ${command}`]).status === 0;

function loadBuilders(execPath, names) {
	const tree = ts.createSourceFile("index.ts", serverSource, ts.ScriptTarget.ES2022, true);
	const wanted = new Set(names);
	const pieces = tree.statements.filter((statement) => (ts.isFunctionDeclaration(statement) && wanted.has(statement.name?.text))
		|| (ts.isVariableStatement(statement) && statement.declarationList.declarations.some((d) => wanted.has(d.name.getText(tree)))));
	assert.equal(pieces.length, wanted.size, "every builder was found");
	const context = vm.createContext({ process: { execPath }, CURSOR_COLUMN_QUERY, CURSOR_COLUMN_SUPERVISOR });
	vm.runInContext(ts.transpile(pieces.map((statement) => statement.getText(tree)).join("\n"), { target: ts.ScriptTarget.ES2022 }), context);
	return context;
}

const runtimes = [
	{ name: "python", command: "python3", args: ["-I"], ext: "py", code: 'print("c")',
		builders: ["buildStudioPythonDisplayStatements", "buildStudioPythonFooter", "buildStudioPythonControlSource"],
		build: (b, code, done, display) => b.buildStudioPythonControlSource("python", code, done, display) },
	{ name: "julia", command: "julia", args: ["--startup-file=no"], ext: "jl", code: 'println("c")',
		builders: ["juliaStringLiteral", "buildStudioJuliaDisplayStatements", "buildStudioJuliaFooter", "buildStudioJuliaControlSource"],
		build: (b, code, done, display) => b.buildStudioJuliaControlSource(code, done, display) },
	{ name: "r", command: "Rscript", args: ["--vanilla"], ext: "R", code: 'cat("c\\n")',
		builders: ["shellQuote", "buildStudioRDisplayStatements", "buildStudioRFooter", "buildStudioRControlSource"],
		build: (b, code, done, display) => b.buildStudioRControlSource(code, done, display) },
	{ name: "clojure", command: "clojure", args: ["-M"], ext: "clj", code: '(println "c")', after: "(shutdown-agents)",
		builders: ["buildStudioClojureDisplayStatements", "buildStudioClojureFooter", "buildStudioClojureControlSource"],
		build: (b, code, done, display) => b.buildStudioClojureControlSource(code, done, display) },
];

test("each wrapper ends a mid-line row before its footer, and only then", { timeout: 240_000 }, async (t) => {
	const root = mkdtempSync(join(tmpdir(), "studio-footer-"));
	const pidFiles = [];
	// A fake query's command line names this test's directory, so cleanup and the exit
	// checks recognise only our own processes, never a reused pid.
	const owned = (pid) => pid > 1 && spawnSync("ps", ["-o", "command=", "-p", String(pid)], { encoding: "utf8" }).stdout.includes(root);
	t.after(() => {
		for (const pidFile of pidFiles) {
			const pid = Number(existsSync(pidFile) ? readFileSync(pidFile, "utf8") : 0);
			if (owned(pid)) process.kill(pid, "SIGKILL");
		}
		rmSync(root, { recursive: true, force: true });
	});
	let fakes = 0;
	// A fake query: records its pid, then runs Node code in its place.
	const fake = (js) => {
		const id = ++fakes, path = join(root, `query-${id}`), pidFile = join(root, `query-${id}.pid`);
		writeFileSync(path, `#!/bin/sh\nprintf '%s' $$ > '${pidFile}'\nexec '${process.execPath}' -e '${js}' '${root}'\n`);
		chmodSync(path, 0o700);
		pidFiles.push(pidFile);
		return { path, pid: () => Number(readFileSync(pidFile, "utf8")), pidFile };
	};
	let runs = 0;
	const run = (runtime, query, code = runtime.code, after = runtime.after ?? "") => {
		const id = ++runs;
		const display = createReplSubmissionDisplay({ entryId: `pi-studio:footer:${id}`, origin: "pi-studio", code, mode: "summary" });
		const doneFile = join(root, `${id}.done`), file = join(root, `${id}.${runtime.ext}`);
		writeFileSync(file, `${runtime.build(loadBuilders(query.path, runtime.builders), code, doneFile, display)}\n${after}\n`);
		const started = Date.now();
		const result = spawnSync(runtime.command, [...runtime.args, file], { encoding: "utf8", timeout: 60_000 });
		return { ...result, elapsed: Date.now() - started, display, done: existsSync(doneFile) };
	};
	const shown = (display, ...lines) => [...display.prefixLines, ...lines, ...display.suffixLines, ""].join("\n");

	for (const runtime of runtimes) {
		await t.test(runtime.name, { skip: has(runtime.command) ? false : `${runtime.command} is not installed` }, () => {
			const atStart = run(runtime, fake('process.stdout.write("0")'));
			assert.equal(atStart.status, 0, atStart.stderr);
			assert.ok(atStart.done);
			assert.equal(atStart.stdout, shown(atStart.display, "c"), "column 0: no extra line");
			const midLine = run(runtime, fake('process.stdout.write("3")'));
			assert.equal(midLine.stdout, shown(midLine.display, "c", ""), "column 3: the row is ended first");
			const failed = run(runtime, fake("process.exitCode = 1"));
			assert.ok(failed.done);
			assert.equal(failed.stdout, shown(failed.display, "c", ""), "a failed query: a new line, to be safe");
		});
	}

	// pi-repl 0.8.6: a query that outlives its wait is stopped after 5 s in every wrapper.
	// Julia and R used to wait for it without limit, as a NODE_OPTIONS startup hook could make it.
	for (const runtime of runtimes.filter((candidate) => candidate.name !== "clojure")) {
		await t.test(`${runtime.name}: a query that outlasts the wait`, { skip: has(runtime.command) ? false : `${runtime.command} is not installed` }, async () => {
			const query = fake('setTimeout(() => process.stdout.write("0"), 30000)');
			const sent = run(runtime, query);
			assert.equal(sent.status, 0, sent.stderr);
			assert.ok(sent.done);
			assert.ok(sent.elapsed >= 4_500 && sent.elapsed < 25_000, `waited ${sent.elapsed} ms`);
			assert.equal(sent.stdout, shown(sent.display, "c", ""), "no column, so a new line");
			await new Promise((resolve) => setTimeout(resolve, 500));
			assert.equal(owned(query.pid()), false, "the query was stopped");
		});
	}

	const clojure = runtimes.find((runtime) => runtime.name === "clojure");
	await t.test("Clojure: an interrupt during the wait lets the query finish, and is kept", { skip: has("clojure") ? false : "clojure is not installed" }, async () => {
		// The query prints 0 after 2 s; the code's future interrupts once it has started.
		// Killing Node early would leave its tmux child running, so the wait goes on (pi-repl 0.8.6).
		const query = fake('setTimeout(() => process.stdout.write("0"), 2000)');
		const started = `(pos? (.length (java.io.File. ${JSON.stringify(query.pidFile)})))`;
		const sent = run(clojure, query, `(let [t (Thread/currentThread)] (future (while (not ${started}) (Thread/sleep 20)) (.interrupt t)) (println "c"))`, '(println "interrupted:" (Thread/interrupted))\n(shutdown-agents)');
		assert.equal(sent.status, 0, sent.stderr);
		assert.ok(sent.done);
		assert.ok(sent.elapsed >= 2_000 && sent.elapsed < 15_000, `took ${sent.elapsed} ms`);
		assert.equal(sent.stdout, `${shown(sent.display, "c")}interrupted: true\n`, "the column was read, and the interrupt kept");
		assert.equal(owned(query.pid()), false, "the query finished");
	});

	await t.test("Clojure: a query that outlasts the wait", { skip: has("clojure") ? false : "clojure is not installed" }, async () => {
		const query = fake('setTimeout(() => process.stdout.write("0"), 30000)');
		const sent = run(clojure, query);
		assert.equal(sent.status, 0, sent.stderr);
		assert.ok(sent.done);
		assert.ok(sent.elapsed >= 5_000 && sent.elapsed < 20_000, `waited ${sent.elapsed} ms`);
		assert.equal(sent.stdout, shown(sent.display, "c", ""));
		await new Promise((resolve) => setTimeout(resolve, 500));
		assert.equal(owned(query.pid()), false, "the query was stopped");
	});

	await t.test("Clojure: an interrupt the code left pending doesn't cut the wait short, and is kept", { skip: has("clojure") ? false : "clojure is not installed" }, () => {
		const query = fake('setTimeout(() => process.stdout.write("0"), 300)');
		const sent = run(clojure, query, '(do (.interrupt (Thread/currentThread)) (println "c"))', '(println "pending:" (Thread/interrupted))\n(shutdown-agents)');
		assert.equal(sent.status, 0, sent.stderr);
		assert.ok(sent.done);
		assert.equal(sent.stdout, `${shown(sent.display, "c")}pending: true\n`, "the query's column was read, and the interrupt kept");
	});
});

// Candidate82: Ruby and Java ask tmux for the column themselves, as in pi-repl; a fake tmux
// on PATH answers.
// Octave (candidate88) uses Studio's port of pi-repl's M driver, whose query also asks tmux.
test("Ruby, Java and Octave end a mid-line row before their footer, and only then", { timeout: 180_000 }, async (t) => {
	const root = mkdtempSync(join(tmpdir(), "studio-footer-tmux-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const bin = join(root, "bin");
	mkdirSync(bin);
	writeFileSync(join(bin, "tmux"), '#!/bin/sh\n[ "$FAKE_COLUMN" = fail ] && exit 1\nprintf "%s\\n" "$FAKE_COLUMN"\n');
	chmodSync(join(bin, "tmux"), 0o700);
	const builders = loadBuilders(process.execPath, ["rubyStringLiteral", "buildStudioRubyControlSource", "buildStudioJavaControlSource", "buildStudioJavaDriverSource", "buildStudioReplSubmissionLine", "juliaStringLiteral", "shellQuote"]);
	builders.mStringLiteral = mStringLiteral;
	let runs = 0;
	const cases = [
		{ name: "ruby", command: "ruby", code: 'puts "c"', run: (dir, code, doneFile, display) => {
			const file = join(dir, "source.rb");
			writeFileSync(file, builders.buildStudioRubyControlSource(code, doneFile, display));
			return ["ruby", [file]];
		} },
		{ name: "java", command: "jshell", code: 'System.out.println("c");', run: (dir, code, doneFile, display) => {
			const source = join(dir, "source.java"), driver = join(dir, "driver.java");
			writeFileSync(source, builders.buildStudioJavaControlSource(code, doneFile, display));
			writeFileSync(driver, `${builders.buildStudioJavaDriverSource(source, doneFile, display)}\n/exit\n`);
			return ["jshell", ["-q", driver]];
		} },
		{ name: "octave", command: "octave-cli", code: "disp('c')", run: (dir, code, doneFile, display) => {
			const source = join(dir, "source.m"), driver = join(dir, "driver.m");
			writeFileSync(source, buildMLanguageControlSource(code, display));
			writeFileSync(driver, buildMLanguageDriverSource("octave", source, doneFile, display));
			return ["octave-cli", ["--quiet", "--no-init-file", "--no-history", driver]];
		} },
	];
	for (const runtime of cases) {
		await t.test(runtime.name, { skip: has(runtime.command) ? false : `${runtime.command} is not installed` }, () => {
			for (const [column, lines] of [["0", ["c"]], ["3", ["c", ""]], ["fail", ["c", ""]]]) {
				const dir = join(root, String(++runs));
				mkdirSync(dir);
				const display = createReplSubmissionDisplay({ entryId: `pi-studio:footer-tmux:${runs}`, origin: "pi-studio", code: runtime.code, mode: "summary" });
				const doneFile = join(dir, "done");
				const [command, args] = runtime.run(dir, runtime.code, doneFile, display);
				const sent = spawnSync(command, args, { encoding: "utf8", timeout: 60_000, env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, TMUX_PANE: "%1", FAKE_COLUMN: column } });
				assert.equal(sent.status, 0, sent.stderr);
				assert.ok(existsSync(doneFile), `${runtime.name} ${column}: done`);
				assert.equal(sent.stdout, [...display.prefixLines, ...lines, ...display.suffixLines, ""].join("\n"), `${runtime.name}, column ${column}`);
			}
		});
	}
});

// Sol (candidate82): Ctrl+C while irb's footer waited for the column skipped the done file
// (IRB::Abort isn't a StandardError), so Studio waited for that send forever. JShell turns the
// same Ctrl+C during its wait into an exception the footer already catches; it's checked too.
// Real irb and JShell run in a private tmux server, with a fake tmux on their PATH whose column
// query stalls until the test presses Ctrl+C.
test("Ctrl+C while irb's or JShell's footer waits still writes the done file, and the next send works", { timeout: 240_000 }, async (t) => {
	const realTmux = spawnSync("/bin/sh", ["-c", "command -v tmux"], { encoding: "utf8" }).stdout.trim();
	const root = mkdtempSync(join(tmpdir(), "studio-footer-interrupt-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const bin = join(root, "bin");
	mkdirSync(bin);
	// Stalls while the mode file says "stall", noting that it started; otherwise answers 0.
	writeFileSync(join(bin, "tmux"), `#!/bin/sh\nif [ "$(cat "${root}/mode")" = stall ]; then : > "${root}/query-started"; sleep 5; fi\nprintf '0\\n'\n`);
	chmodSync(join(bin, "tmux"), 0o700);
	const builders = loadBuilders(process.execPath, ["rubyStringLiteral", "buildStudioRubyControlSource", "buildStudioJavaControlSource", "buildStudioJavaDriverSource", "buildStudioReplSubmissionLine", "juliaStringLiteral", "shellQuote"]);
	const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
	const until = async (check, ms, what) => {
		const end = Date.now() + ms;
		while (!check()) {
			assert.ok(Date.now() < end, what);
			await sleep(20);
		}
	};
	const cases = [
		{ name: "irb", command: "irb", start: "irb", ready: /irb\([^)]*\):\d+(:0)?> *$/m, code: (word) => `puts "${word}"`, send: (dir, code, doneFile, display) => {
			const file = join(dir, "source.rb");
			writeFileSync(file, builders.buildStudioRubyControlSource(code, doneFile, display));
			return `load ${builders.rubyStringLiteral(file)}; nil`;
		} },
		{ name: "jshell", command: "jshell", start: "jshell -q", ready: /jshell> *$/m, code: (word) => `System.out.println("${word}");`, send: (dir, code, doneFile, display) => {
			const source = join(dir, "source.java"), driver = join(dir, "driver.java");
			writeFileSync(source, builders.buildStudioJavaControlSource(code, doneFile, display));
			writeFileSync(driver, builders.buildStudioJavaDriverSource(source, doneFile, display));
			return `/open ${driver}`;
		} },
	];
	for (const runtime of cases) {
		await t.test(runtime.name, { skip: has(runtime.command) && realTmux ? false : `${runtime.command} or tmux is not installed` }, async () => {
			const server = `studio-footer-interrupt-${process.pid}-${runtime.name}`;
			const tmux = (...args) => spawnSync(realTmux, ["-L", server, ...args], { encoding: "utf8" });
			const screen = () => tmux("capture-pane", "-p", "-t", "repl").stdout;
			writeFileSync(join(root, "mode"), "0");
			const started = spawnSync(realTmux, ["-L", server, "-f", "/dev/null", "new-session", "-d", "-s", "repl", "-x", "120", "-y", "40", runtime.start], { env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
			assert.equal(started.status, 0, String(started.stderr));
			try {
				await until(() => runtime.ready.test(screen()), 60_000, `${runtime.name} starts`);
				let sends = 0;
				let marker = "";
				const send = (word) => {
					const dir = join(root, `${runtime.name}-${++sends}`);
					mkdirSync(dir);
					const doneFile = join(dir, "done");
					const display = createReplSubmissionDisplay({ entryId: `pi-studio:footer-interrupt:${runtime.name}:${sends}`, origin: "pi-studio", code: runtime.code(word), mode: "summary" });
					marker = display.suffixLines[0];
					tmux("send-keys", "-t", "repl", "-l", runtime.send(dir, runtime.code(word), doneFile, display));
					tmux("send-keys", "-t", "repl", "Enter");
					return doneFile;
				};
				writeFileSync(join(root, "mode"), "stall");
				rmSync(join(root, "query-started"), { force: true });
				const first = send("before");
				await until(() => existsSync(join(root, "query-started")), 60_000, `${runtime.name}: the footer's query starts`);
				tmux("send-keys", "-t", "repl", "C-c");
				await until(() => existsSync(first), 10_000, `${runtime.name}: the interrupted send still writes its done file`);
				// In irb the interrupt ends the footer, so its done marker isn't printed: Ctrl+C landed
				// during the wait, not after it.
				if (runtime.name === "irb") assert.equal(screen().includes(marker), false, "irb: Ctrl+C landed during the footer's wait");
				writeFileSync(join(root, "mode"), "0");
				await until(() => runtime.ready.test(screen()), 15_000, `${runtime.name}: back at the prompt`);
				const second = send("after");
				await until(() => existsSync(second), 30_000, `${runtime.name}: the next send completes`);
				// A line of output, not the echoed code (Sol).
				await until(() => screen().split("\n").some((line) => line.trim() === "after"), 5_000, `${runtime.name}: the next send's output`);
			} finally {
				tmux("kill-server");
			}
		});
	}
});

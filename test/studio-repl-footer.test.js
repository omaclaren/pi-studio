import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import ts from "typescript";

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
	const wanted = new Set([...names, "STUDIO_CURSOR_COLUMN_QUERY"]);
	const pieces = tree.statements.filter((statement) => (ts.isFunctionDeclaration(statement) && wanted.has(statement.name?.text))
		|| (ts.isVariableStatement(statement) && statement.declarationList.declarations.some((d) => wanted.has(d.name.getText(tree)))));
	assert.equal(pieces.length, wanted.size, "every builder was found");
	const context = vm.createContext({ process: { execPath } });
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

	const clojure = runtimes.find((runtime) => runtime.name === "clojure");
	await t.test("Clojure: an interrupt during the wait", { skip: has("clojure") ? false : "clojure is not installed" }, async () => {
		// The query would print 0 after 3 s. The code's future interrupts once the query has started.
		const query = fake('setTimeout(() => process.stdout.write("0"), 3000)');
		const started = `(pos? (.length (java.io.File. ${JSON.stringify(query.pidFile)})))`;
		const sent = run(clojure, query, `(let [t (Thread/currentThread)] (future (while (not ${started}) (Thread/sleep 20)) (.interrupt t)) (println "c"))`);
		assert.equal(sent.status, 0, sent.stderr);
		assert.ok(sent.done);
		assert.ok(sent.elapsed < 15_000, `took ${sent.elapsed} ms`);
		assert.equal(sent.stdout, shown(sent.display, "c", ""), "no column, so a new line, and one footer");
		await new Promise((resolve) => setTimeout(resolve, 500));
		assert.equal(owned(query.pid()), false, "the query was stopped");
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

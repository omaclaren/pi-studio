import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, linkSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createPrivateReplControlFiles } from "../shared/repl-control-files.js";
import { createReplSubmissionDisplay } from "../shared/repl-submission-display.js";
import { buildCppDriverSource, buildCppRequest, cppInclude, cppStringLiteral, createCppControlCleanup, prepareCppSubmission, readCppCompletion } from "../shared/repl-cpp.js";

function fixture(t) {
	const root = mkdtempSync(join(tmpdir(), "pi-repl-cpp-control-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const source = createPrivateReplControlFiles({ root, extension: "cpp", buildSource: () => "int x=42;" });
	const display = createReplSubmissionDisplay({ code: "int x=42;", entryId: "cpp-unit", mode: "summary" });
	const request = createPrivateReplControlFiles({ root, extension: "req", buildSource: () => buildCppRequest(source.sourceFile, source.doneFile, display) });
	const prepared = prepareCppSubmission(request.sourceFile, source.doneFile);
	const payload = `pi-repl-cpp-v1 ${prepared.completion.stem} 0\n`;
	const reply = (text = payload) => writeFileSync(source.doneFile, text, { mode: 0o600 });
	return { root, source, request, prepared, payload, reply };
}

test('cpp cleanup leaves replaced control files untouched', (t) => {
	const f = fixture(t);
	const cleanup = createCppControlCleanup(f.prepared.completion, [f.source.sourceFile, f.request.sourceFile]);
	renameSync(f.source.sourceFile, join(f.root, 'original'));
	writeFileSync(f.source.sourceFile, 'replacement', { mode: 0o600 });
	f.reply(); cleanup(); cleanup();
	assert.equal(readFileSync(f.source.sourceFile, 'utf8'), 'replacement');
	assert.throws(() => readFileSync(f.request.sourceFile), /ENOENT/);
	assert.throws(() => readFileSync(f.source.doneFile), /ENOENT/);
});

test("cpp framing preserves source and separates display from evaluator input", (t) => {
	const f = fixture(t);
	assert.equal(readFileSync(f.source.sourceFile, "utf8"), "int x=42;");
	assert.match(readFileSync(f.request.sourceFile, "utf8"), /^pi-repl-cpp-v1\n/);
	const driver = buildCppDriverSource(f.request.sourceFile, f.source.doneFile);
	assert.match(driver, /^#include </);
	assert.match(driver, /const int request_[a-f0-9_]+ = \(pi_repl_cpp_v1::submit\(/);
	assert.doesNotMatch(driver, /int x=42/);
	assert.equal(driver.split("\n").length, 3);
	assert.equal(cppStringLiteral('λ"\\\n'), '"\\316\\273\\042\\134\\012"');
	assert.equal(cppInclude('/space " λ/source.hxx'), '#include </space " λ/source.hxx>');
	assert.equal(cppInclude('/greater>/source.hxx'), '#include "/greater>/source.hxx"');
	assert.throws(() => cppInclude('/bad">/file.hxx'), /both double quotes/);
	assert.throws(() => cppInclude('/bad\nfile.hxx'), /line breaks/);
});

for (const status of [0, 1, 2, 3, 4, 5]) test(`cpp accepts only a complete private correlated reply (${status})`, (t) => {
	const f = fixture(t);
	assert.equal(readCppCompletion(f.prepared.completion), undefined);
	f.reply(f.payload.replace(' 0\n', ` ${status}\n`));
	assert.equal(readCppCompletion(f.prepared.completion), status);
});

for (const bad of ["", "done\n", "[cling]$ ", "pi-repl-cpp-v1 wrong 0\n", "partial", "extra-newline", "invalid-status", "large"]) test(`cpp rejects ${JSON.stringify(bad)} reply`, (t) => {
	const f = fixture(t);
	const value = bad === "partial" ? f.payload.slice(0,-1) : bad === "extra-newline" ? f.payload+'\n' : bad === "invalid-status" ? f.payload.replace(' 0\n', ' 9\n') : bad === "large" ? 'x'.repeat(20000) : bad;
	f.reply(value);
	assert.equal(readCppCompletion(f.prepared.completion), undefined);
});

for (const kind of ["mode", "symlink", "hardlink", "root-replaced"]) test(`cpp rejects ${kind} response identity`, (t) => {
	const f = fixture(t);
	f.reply();
	if (kind === "mode") chmodSync(f.source.doneFile, 0o644);
	if (kind === "hardlink") linkSync(f.source.doneFile, join(f.root, "other"));
	if (kind === "symlink") {
		const other = join(f.root, "other"); renameSync(f.source.doneFile, other); symlinkSync(other, f.source.doneFile);
	}
	if (kind === "root-replaced") {
		const moved = f.root + "-old";
		renameSync(f.root, moved); t.after(() => rmSync(moved, { recursive: true, force: true }));
		symlinkSync(moved, f.root);
	}
	assert.equal(readCppCompletion(f.prepared.completion), undefined);
});

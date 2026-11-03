import test from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, renameSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	createStudioReplFileRoutes,
	openStudioReplFileRoute,
	resolveStudioReplFiles,
	studioReplFilePaths,
	studioReplSessionRunBounds,
	STUDIO_REPL_FILE_MAX_BYTES,
	STUDIO_REPL_FILES_PER_ENTRY,
} from "../shared/studio-repl-files.js";

// Candidate 116: image and PDF files a REPL record entry names, such as a saved plot, as
// pi-markdown-preview's REPL page finds them (its repl-files.js and watch-repl-page tests).

test("the paths an entry names: quoted in code, bare in output, output first, without repeats", () => {
	assert.deepEqual(studioReplFilePaths({ code: `plt.savefig("out/fit.png")\npng('plot.PNG'); x = "notes.txt"`, output: "Saved to /tmp/ab/c.png and ~/figs/d.pdf.\nalso out/fit.png" }),
		["/tmp/ab/c.png", "~/figs/d.pdf", "out/fit.png", "plot.PNG"]);
	assert.deepEqual(studioReplFilePaths({ code: `f = "a.png.bak"; g = 'x.svg'`, output: "" }), ["x.svg"]);
	assert.deepEqual(studioReplFilePaths({ code: 'savefig("fit 2.png")', output: "(out/b.jpeg), fig.webp: done" }), ["out/b.jpeg", "fig.webp", "fit 2.png"]);
	// Round 2 (Sol's H2): a quoted path is taken whole, so its tail can't name another file.
	assert.deepEqual(studioReplFilePaths({ code: `savefig("fit 2.png"); savefig('a b/c d.svg')`, output: 'wrote "fit 2.png"' }), ["fit 2.png", "a b/c d.svg"]);
	assert.deepEqual(studioReplFilePaths({ output: "Saved to fit 2.png" }), ["2.png"], "Unquoted, a space ends the path, as it does for the preview.");
	// Round 3 (Sol's and Astra's H2): a quote is closed only by its own delimiter, so a name holding
	// the other quote is still one name, and nothing inside quotes is searched again.
	assert.deepEqual(studioReplFilePaths({ code: `open("O'Brien private-tail.svg", "wb")` }), ["O'Brien private-tail.svg"]);
	assert.deepEqual(studioReplFilePaths({ code: `open('say"hi private-tail2.svg', "wb")` }), ['say"hi private-tail2.svg']);
	assert.deepEqual(studioReplFilePaths({ output: "Saved `fit 2.png`" }), ["fit 2.png"], "Backticks quote too.");
	assert.deepEqual(studioReplFilePaths({ output: "['a.png', 'b c.png']" }), ["a.png", "b c.png"]);
	// An escaped or doubled delimiter doesn't end the span. A span holding one isn't the name as
	// written, so it names nothing (round 4, as agent-markdown-preview's), and its tail nothing either.
	assert.deepEqual(studioReplFilePaths({ code: "print('-dpng', 'O''Brien tail.png')" }), []);
	assert.deepEqual(studioReplFilePaths({ code: 'open("a\\"b 2.png")' }), []);
	assert.deepEqual(studioReplFilePaths({ code: '"""docstring fit.png"""\nsavefig("a.png")' }), ["a.png"]);
	assert.deepEqual(studioReplFilePaths({ code: 'x = ""; y = "fit.png"' }), ["fit.png"]);
	// An apostrophe with no close on its line starts no span; one that's closed hides what's inside.
	assert.deepEqual(studioReplFilePaths({ output: "Oliver's plot is in /tmp/fit.png" }), ["/tmp/fit.png"]);
	assert.deepEqual(studioReplFilePaths({ output: "It's at\n'/tmp/x.png'" }), ["/tmp/x.png"]);
	assert.deepEqual(studioReplFilePaths({ output: "don't save to fit.png, it's broken" }), [], "Missed, not misread.");
	assert.deepEqual(studioReplFilePaths({ prose: "a note about plot.png" }), [], "A note's prose names no files.");
	assert.deepEqual(studioReplFilePaths({ code: 7, output: null }), []);
});

test("only regular files that exist now, resolved against the session's directory, a bounded number", (t) => {
	// Entries that started before these files were written, and still run (round 4's window).
	const ran = (fields) => ({ createdAt: Date.now() - 1_000, status: "sending", ...fields });
	const dir = mkdtempSync(join(tmpdir(), "studio-repl-files-"));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	mkdirSync(join(dir, "out"));
	mkdirSync(join(dir, "folder.png"));
	writeFileSync(join(dir, "out", "fit.png"), "png");
	writeFileSync(join(dir, "report.pdf"), "pdf");
	writeFileSync(join(dir, "notes.txt"), "text");
	const entry = ran({ code: `savefig("out/fit.png"); savefig("./out/fit.png")`, output: `Saved ${join(dir, "report.pdf")}, missing.png and folder.png` });
	const files = resolveStudioReplFiles(entry, dir);
	assert.deepEqual(files.map((file) => [file.written, file.path, file.contentType]), [
		[join(dir, "report.pdf"), join(dir, "report.pdf"), "application/pdf"],
		["out/fit.png", join(dir, "out", "fit.png"), "image/png"],
	], "One per path; a directory, a missing file and a repeat aren't files to show.");
	assert.ok(files.every((file) => /^[0-9a-f]{16}$/.test(file.version)));
	assert.deepEqual(resolveStudioReplFiles(entry, undefined).map((file) => file.written), [join(dir, "report.pdf")], "Without a directory, only an absolute path.");
	assert.deepEqual(resolveStudioReplFiles(entry, "relative/dir").map((file) => file.written), [join(dir, "report.pdf")], "Nor against a relative one.");
	assert.deepEqual(resolveStudioReplFiles(ran({ output: "notes.txt" }), dir), [], "Only images and PDFs.");
	for (let index = 0; index < 9; index++) writeFileSync(join(dir, `p${index}.png`), "png");
	const many = resolveStudioReplFiles(ran({ output: Array.from({ length: 9 }, (_, index) => `p${index}.png`).join(" ") }), dir);
	assert.equal(many.length, STUDIO_REPL_FILES_PER_ENTRY);
	assert.deepEqual(resolveStudioReplFiles(ran({ output: "fit.png" }), dir, { statFile() { throw new Error("EACCES"); } }), [], "A stat that fails shows nothing.");
	// Round 2: the directory is asked for at most once, and only for a relative path.
	let asked = 0;
	const cwd = () => { asked += 1; return dir; };
	assert.equal(resolveStudioReplFiles(ran({ output: `${join(dir, "report.pdf")}` }), cwd).length, 1);
	assert.equal(asked, 0, "Not for an absolute path.");
	assert.equal(resolveStudioReplFiles(ran({ output: "out/fit.png p0.png p1.png" }), cwd).length, 3);
	assert.equal(asked, 1, "Once for several relative paths.");
});

test("a file's version changes when it's written or replaced, even keeping its modification time", (t) => {
	const dir = mkdtempSync(join(tmpdir(), "studio-repl-version-"));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	// Running since long before these writes, so the window doesn't decide here.
	const version = () => resolveStudioReplFiles({ output: "fit.svg", createdAt: 1, status: "sending" }, dir)[0]?.version;
	writeFileSync(join(dir, "red.svg"), "<svg fill='red'/>");
	writeFileSync(join(dir, "blue.svg"), "<svg fill='blu'/>");
	copyFileSync(join(dir, "red.svg"), join(dir, "fit.svg"));
	// Whole seconds, so setting the time again gives exactly the same modification time.
	const kept = { atime: 1700000000, mtime: 1700000000 };
	utimesSync(join(dir, "fit.svg"), kept.atime, kept.mtime);
	const first = version();
	assert.match(first, /^[0-9a-f]{16}$/);
	assert.equal(version(), first, "Unchanged, the same.");
	// Sol's H3: cp -p, or shutil.copy2: new contents, the old modification time.
	copyFileSync(join(dir, "blue.svg"), join(dir, "fit.svg"));
	utimesSync(join(dir, "fit.svg"), kept.atime, kept.mtime);
	assert.equal(statSync(join(dir, "fit.svg")).mtimeMs, kept.mtime * 1000);
	const copied = version();
	assert.notEqual(copied, first, "Same size and modification time, new contents: a new version.");
	// An atomic replacement keeping the time: a new inode.
	copyFileSync(join(dir, "red.svg"), join(dir, "next.svg"));
	utimesSync(join(dir, "next.svg"), kept.atime, kept.mtime);
	renameSync(join(dir, "next.svg"), join(dir, "fit.svg"));
	assert.notEqual(version(), copied);
});

test("a route is an opaque ID for this server's token, kept for the most recent files", () => {
	const routes = createStudioReplFileRoutes("token-a");
	const file = { path: "/Users/ana/fit.png", contentType: "image/png", version: "a".repeat(16) };
	const id = routes.add(file);
	assert.match(id, /^[0-9a-f]{64}$/);
	assert.ok(!id.includes("fit"));
	assert.equal(routes.add(file), id, "The same file, the same route.");
	assert.notEqual(createStudioReplFileRoutes("token-b").add(file), id, "Another server's routes differ.");
	assert.deepEqual(routes.get(id), { path: file.path, contentType: "image/png", versions: [file.version] });
	for (const bad of [undefined, "", id.toUpperCase(), `${id}0`, "../fit.png", 7]) assert.equal(routes.get(bad), undefined);
	// Round 5 (Sol): the versions the page was shown, the latest eight; another kind starts afresh.
	for (const char of "bcdefghij") routes.add({ ...file, version: char.repeat(16) });
	assert.deepEqual(routes.get(id).versions, [..."cdefghij"].map((char) => char.repeat(16)));
	routes.add({ ...file, version: "c".repeat(16) });
	assert.equal(routes.get(id).versions.at(-1), "c".repeat(16), "Shown again, it's the latest.");
	assert.equal(routes.get(id).versions.length, 8);
	routes.add({ ...file, contentType: "application/pdf" });
	assert.deepEqual(routes.get(id).versions, [file.version]);
	for (let index = 0; index < 500; index++) routes.add({ path: `/p/${index}.png`, contentType: "image/png", version: file.version });
	assert.equal(routes.size, 500);
	assert.equal(routes.get(id), undefined, "The oldest gives way.");
	const recent = routes.add({ path: "/p/0.png", contentType: "image/png", version: file.version });
	routes.add({ path: "/p/new.png", contentType: "image/png", version: file.version });
	assert.ok(routes.get(recent), "Showing a file again keeps it.");
});

test("a route serves its file only while it is still the kind and version shown, within the limit", (t) => {
	const dir = mkdtempSync(join(tmpdir(), "studio-repl-route-"));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	writeFileSync(join(dir, "fit.png"), "png");
	writeFileSync(join(dir, "secret.txt"), "text");
	mkdirSync(join(dir, "dir.png"));
	symlinkSync(join(dir, "secret.txt"), join(dir, "link.png"));
	symlinkSync(join(dir, "fit.png"), join(dir, "alias.png"));
	// A route as the page gets one: for a file an entry showed, in the version it showed.
	const route = (name, contentType = "image/png") => {
		const [file] = resolveStudioReplFiles({ output: name, createdAt: 1, status: "sending" }, dir);
		return { path: join(dir, name), contentType, versions: file ? [file.version] : [] };
	};
	const opened = openStudioReplFileRoute(route("fit.png"));
	assert.equal(opened.ok, true);
	assert.equal(opened.contentType, "image/png");
	assert.match(opened.filePath, /fit\.png$/);
	assert.equal(openStudioReplFileRoute(route("alias.png")).ok, true, "A link to a file of the same kind.");
	assert.deepEqual(openStudioReplFileRoute(undefined), { ok: false, status: 404, message: "This file is no longer shown in the REPL pane." });
	assert.equal(openStudioReplFileRoute({ path: join(dir, "gone.png"), contentType: "image/png", versions: [] }).status, 404);
	assert.equal(openStudioReplFileRoute(route("link.png")).message, "This file is no longer the file that was shown.", "A link to another kind of file.");
	assert.equal(openStudioReplFileRoute({ path: join(dir, "dir.png"), contentType: "image/png", versions: [] }).message, "This file is no longer the file that was shown.");
	assert.equal(openStudioReplFileRoute({ ...route("fit.png"), contentType: "application/pdf" }).ok, false, "Its kind as shown, not as it is now.");
	const large = openStudioReplFileRoute(route("fit.png"), { statFile: () => ({ isFile: () => true, size: STUDIO_REPL_FILE_MAX_BYTES + 1 }) });
	assert.deepEqual([large.ok, large.status], [false, 413]);
	// Round 5 (Sol): replaced since it was shown, by anything, it isn't served.
	const shown = route("fit.png");
	writeFileSync(join(dir, "other.png"), "PNG");
	utimesSync(join(dir, "other.png"), 1_700_000_000, 1_700_000_000);
	renameSync(join(dir, "other.png"), join(dir, "fit.png"));
	assert.deepEqual(openStudioReplFileRoute(shown), { ok: false, status: 404, message: "This file is no longer the file that was shown." });
	assert.equal(openStudioReplFileRoute(route("fit.png")).ok, true, "Once an entry shows the new version, it is.");
});

test("finding paths stays linear, however many quotes a line holds", () => {
	// Round 4: an unclosed quote followed by escaped ones took 17.6 s at 80,000 characters; the
	// record keeps up to 200,000, and Studio looks at each update.
	const many = 200_000;
	for (const text of ["'" + "\\'".repeat(many / 2), "'".repeat(many + 1), "'\"`\\'\\\"".repeat(many / 7)]) {
		const started = Date.now();
		studioReplFilePaths({ output: text, code: text });
		assert.ok(Date.now() - started < 1_000, `${text.slice(0, 6)}… took ${Date.now() - started} ms`);
	}
	// Once a quote finds no close on its line, later copies of it there open nothing.
	assert.deepEqual(studioReplFilePaths({ output: "'a '' b.png" }), ["b.png"], "An unclosed quote hides nothing.");
	assert.deepEqual(studioReplFilePaths({ output: "'a\\' x.png\n'b.png'" }), ["b.png", "x.png"], "The next line starts afresh.");
});

test("Round 4: a named file is shown only if it was written while its entry ran (Sol, Astra)", (t) => {
	const dir = mkdtempSync(join(tmpdir(), "studio-repl-window-"));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	const now = Date.now();
	writeFileSync(join(dir, "fit.png"), "png");
	const written = statSync(join(dir, "fit.png")).mtimeMs;
	const shown = (fields, options) => resolveStudioReplFiles({ output: "fit.png", ...fields }, dir, options).map((file) => file.written);
	assert.deepEqual(shown({ createdAt: written - 1_000, status: "sending" }), ["fit.png"], "Written while it runs.");
	assert.deepEqual(shown({ createdAt: written - 1_000, completedAt: written + 500, status: "captured" }), ["fit.png"], "Written before it finished.");
	assert.deepEqual(shown({ createdAt: written - 5_000, completedAt: written - 1_000, status: "captured" }), ["fit.png"], "Within the grace after it finished.");
	// A file that existed before the entry started: such as an unrelated one whose name a
	// misread quote exposed, or one an earlier entry wrote.
	assert.deepEqual(shown({ createdAt: written + 1, status: "sending" }), []);
	// Rewritten after the entry finished, such as by a later entry: not this entry's any more.
	assert.deepEqual(shown({ createdAt: written - 60_000, completedAt: written - 50_000, status: "error" }), []);
	assert.deepEqual(shown({ createdAt: written - 60_000, completedAt: null, updatedAt: written - 50_000, status: "timeout" }), [], "Its last update, without a finish.");
	// Without a start time, nothing.
	for (const createdAt of [undefined, 0, -1, NaN, "soon"]) assert.deepEqual(shown({ createdAt, status: "sending" }), [], String(createdAt));
	// While it runs, the window ends now.
	assert.deepEqual(shown({ createdAt: written - 1_000, status: "sent" }, { now: written - 2_001 }), []);
	assert.ok(now > 0);
});

test("Round 5: each entry's turn in its session bounds the files it shows (Astra's R4-1, Sol)", (t) => {
	const entry = (id, fields) => ({ id, sessionName: "s", code: "x", ...fields });
	const bounds = studioReplSessionRunBounds([
		entry("b", { createdAt: 2_100, completedAt: 3_000, status: "captured" }),
		entry("a", { createdAt: 1_000, completedAt: 2_000, status: "captured" }),
		// Queued while b ran: it starts when b finished.
		entry("c", { createdAt: 2_500, completedAt: 4_000, status: "captured" }),
		entry("note", { createdAt: 2_600, status: "note", code: "", prose: "a note" }),
		entry("other", { sessionName: "t", createdAt: 2_050, status: "sending" }),
		entry("bad", { createdAt: undefined, status: "captured" }),
	]);
	assert.deepEqual(Object.fromEntries(bounds), {
		a: { start: 1_000, before: 2_100 },
		b: { start: 2_100, before: 3_000 },
		c: { start: 3_000, before: Infinity },
		other: { start: 2_050, before: Infinity },
	});
	// Both still running: neither has finished, so neither's turn is cut short by the other (round 6).
	assert.deepEqual(Object.fromEntries(studioReplSessionRunBounds([entry("a", { createdAt: 1_000, status: "sending" }), entry("b", { createdAt: 2_000, status: "sent" })])),
		{ a: { start: 1_000, before: Infinity }, b: { start: 2_000, before: Infinity } });
	// A file the next entry wrote within this one's grace isn't this one's.
	const dir = mkdtempSync(join(tmpdir(), "studio-repl-bounds-"));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	writeFileSync(join(dir, "plot.svg"), "<svg/>");
	const written = statSync(join(dir, "plot.svg")).mtimeMs;
	const first = { output: "plot.svg", createdAt: written - 1_000, completedAt: written - 200, status: "captured" };
	assert.deepEqual(resolveStudioReplFiles(first, dir).map((file) => file.written), ["plot.svg"], "Within its grace, alone.");
	assert.deepEqual(resolveStudioReplFiles(first, dir, { bounds: { start: written - 1_000, before: written - 100 } }), [], "Not once the next has started.");
	assert.deepEqual(resolveStudioReplFiles({ ...first, createdAt: written - 2_000 }, dir, { bounds: { start: written + 1, before: Infinity } }), [], "Nor before its own turn began.");
});

test("Round 6: turns follow the order entries finished in, not the order they were recorded (Sol's R5-Q1)", () => {
	const entry = (id, fields) => ({ id, sessionName: "s", code: "x", ...fields });
	// Sol's observed run: an external client held the lease; a page send was recorded and waited;
	// an agent send, recorded once it had the lease, ran before it.
	const external = entry("external", { createdAt: 1793672173315, completedAt: 1793672175685, status: "captured" });
	const page = entry("page", { createdAt: 1793672173495, completedAt: 1793672176627, status: "captured" });
	const agent = entry("agent", { createdAt: 1793672175888, completedAt: 1793672176132, status: "captured" });
	const bounds = studioReplSessionRunBounds([external, page, agent]);
	assert.deepEqual(Object.fromEntries(bounds), {
		external: { start: 1793672173315, before: 1793672175888 },
		agent: { start: 1793672175888, before: 1793672176132 },
		page: { start: 1793672176132, before: Infinity },
	});
	// Each one's own saved file, at the times Sol observed, is its own and not the other's.
	const file = (mtimeMs) => ({ statFile: () => ({ isFile: () => true, mtimeMs, ctimeMs: mtimeMs, size: 6, dev: 1, ino: 2 }), now: 1793672180000 });
	const shown = (which, name, mtimeMs) => resolveStudioReplFiles({ ...which, output: name }, "/tmp", { ...file(mtimeMs), bounds: bounds.get(which.id) }).map((found) => found.written);
	assert.deepEqual(shown(agent, "mixed-agent.svg", 1793672175968.2085), ["mixed-agent.svg"]);
	assert.deepEqual(shown(page, "mixed-page.svg", 1793672176411.5242), ["mixed-page.svg"]);
	assert.deepEqual(shown(page, "mixed-agent.svg", 1793672175968.2085), [], "The page's turn began after the agent's write.");
	assert.deepEqual(shown(agent, "mixed-page.svg", 1793672176411.5242), [], "The agent's turn ended before the page's write.");
	// While others run, the last to finish keeps no grace, and the running ones start at its finish.
	assert.deepEqual(Object.fromEntries(studioReplSessionRunBounds([
		entry("done", { createdAt: 1_000, completedAt: 2_000, status: "captured" }),
		entry("queued", { createdAt: 1_500, status: "sending" }),
		entry("later", { createdAt: 2_500, status: "sent" }),
	])), { done: { start: 1_000, before: 2_000 }, queued: { start: 2_000, before: Infinity }, later: { start: 2_500, before: Infinity } });
	// A finished status without a completion time finishes at its last update.
	assert.deepEqual(Object.fromEntries(studioReplSessionRunBounds([
		entry("a", { createdAt: 1_000, completedAt: null, updatedAt: 3_000, status: "timeout" }),
		entry("b", { createdAt: 2_000, completedAt: 2_500, status: "error" }),
	])), { b: { start: 2_000, before: 2_500 }, a: { start: 2_500, before: Infinity } });
});

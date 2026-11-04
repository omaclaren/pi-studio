import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, fstatSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStudioUrlFile, STUDIO_URL_FILE_ENV } from "../shared/studio-url-file.js";

// Issue #7: with PI_STUDIO_URL_FILE set, Studio keeps the URL it last printed for its main view in
// that file, for a program to read, and removes it when Studio stops.
const URL_A = "http://127.0.0.1:4321/?token=aaaa&studioTabState=host_1&hostedWorkspace=host_1";
const URL_B = "http://127.0.0.1:4322/?token=bbbb&studioTabState=host_2&hostedWorkspace=host_2";
const posix = process.platform !== "win32";
function folder(t) {
	const dir = mkdtempSync(join(tmpdir(), "studio-url-file-"));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	return dir;
}
const forPath = (path) => createStudioUrlFile({ [STUDIO_URL_FILE_ENV]: path });

test("nothing is written unless PI_STUDIO_URL_FILE names a file", () => {
	assert.equal(STUDIO_URL_FILE_ENV, "PI_STUDIO_URL_FILE");
	assert.equal(createStudioUrlFile({}), null);
	assert.equal(createStudioUrlFile({ PI_STUDIO_URL_FILE: "" }), null);
	assert.equal(createStudioUrlFile(undefined), null);
});

test("the URL goes in privately, as one line, with nothing left beside it", { skip: !posix && "POSIX modes" }, (t) => {
	const dir = folder(t), path = join(dir, "studio-url");
	const file = forPath(path);
	assert.deepEqual(file.publish(URL_A), { ok: true, path });
	assert.equal(readFileSync(path, "utf8"), `${URL_A}\n`);
	assert.equal(statSync(path).mode & 0o777, 0o600);
	assert.deepEqual(readdirSync(dir), ["studio-url"], "no temporary file is left");
	// A new URL replaces it whole.
	assert.equal(file.publish(URL_B).ok, true);
	assert.equal(readFileSync(path, "utf8"), `${URL_B}\n`);
	assert.deepEqual(readdirSync(dir), ["studio-url"]);
});

test("the URL is never in a file others can read, even while it's being written", { skip: !posix && "POSIX modes" }, (t) => {
	const dir = folder(t), path = join(dir, "studio-url");
	const modes = [];
	const file = createStudioUrlFile({ [STUDIO_URL_FILE_ENV]: path }, { fs: {
		writeFileSync: (target, data, encoding) => { modes.push(fstatSync(target).mode & 0o777); return writeFileSync(target, data, encoding); },
	} });
	assert.equal(file.publish(URL_A).ok, true);
	assert.deepEqual(modes, [0o600], "private when the URL goes in");
});

test("a write that fails part-way leaves the old file as it was and nothing beside it", (t) => {
	const dir = folder(t), path = join(dir, "studio-url");
	writeFileSync(path, `${URL_A}\n`);
	const failing = (step) => () => { throw Object.assign(new Error(step), { code: "EIO" }); };
	for (const step of ["openSync", "writeFileSync", "closeSync", "renameSync"]) {
		const file = createStudioUrlFile({ [STUDIO_URL_FILE_ENV]: path }, { fs: { [step]: failing(step) } });
		assert.deepEqual(file.publish(URL_B), { ok: false, path, message: "EIO" }, step);
		assert.equal(readFileSync(path, "utf8"), `${URL_A}\n`, step);
		assert.deepEqual(readdirSync(dir), ["studio-url"], `${step}: no temporary file is left`);
		assert.deepEqual(file.clear(), { ok: true, path }, `${step}: a failed write isn't this process's to remove`);
		assert.equal(readFileSync(path, "utf8"), `${URL_A}\n`);
	}
});

test("an older file readable by others is replaced by a private one", { skip: !posix && "POSIX modes" }, (t) => {
	const dir = folder(t), path = join(dir, "studio-url");
	writeFileSync(path, "left by a crash\n", { mode: 0o644 });
	assert.equal(forPath(path).publish(URL_A).ok, true);
	assert.equal(statSync(path).mode & 0o777, 0o600);
	assert.equal(readFileSync(path, "utf8"), `${URL_A}\n`);
});

test("a relative path, a missing folder, a link or a folder isn't written, and says why", (t) => {
	const dir = folder(t);
	const relative = forPath("studio-url").publish(URL_A);
	assert.deepEqual(relative, { ok: false, path: "studio-url", message: "it isn't an absolute path" });
	assert.equal(existsSync(join(process.cwd(), "studio-url")), false);

	const missing = forPath(join(dir, "no-such-folder", "studio-url")).publish(URL_A);
	assert.equal(missing.ok, false);
	assert.equal(missing.message, "its folder doesn't exist");

	const target = join(dir, "elsewhere.txt"), link = join(dir, "link");
	writeFileSync(target, "keep me\n");
	symlinkSync(target, link);
	const linked = forPath(link).publish(URL_A);
	assert.deepEqual(linked, { ok: false, path: link, message: "something other than a file is there" });
	assert.equal(readFileSync(target, "utf8"), "keep me\n", "the link's target is untouched");
	assert.equal(lstatSync(link).isSymbolicLink(), true, "and so is the link");

	const sub = join(dir, "sub");
	mkdirSync(sub);
	assert.equal(forPath(sub).publish(URL_A).ok, false);
	assert.equal(statSync(sub).isDirectory(), true);
	assert.deepEqual(readdirSync(dir).sort(), ["elsewhere.txt", "link", "sub"], "no temporary file is left");

	assert.equal(forPath(join(dir, "url")).publish("http://127.0.0.1:1/?token=a\nb").ok, false, "a URL across lines isn't written");
	assert.equal(existsSync(join(dir, "url")), false);
});

test("clear removes the URL only while it's still this process's", (t) => {
	const dir = folder(t), path = join(dir, "studio-url");
	const a = forPath(path), b = forPath(path);
	assert.deepEqual(a.clear(), { ok: true, path }, "nothing written, nothing to remove");

	a.publish(URL_A);
	assert.equal(a.clear().ok, true);
	assert.equal(existsSync(path), false);
	assert.equal(a.clear().ok, true, "a second clear is harmless");

	// Two processes given the same path: the later one's URL stands, and the earlier one's
	// stop doesn't remove it.
	a.publish(URL_A);
	b.publish(URL_B);
	assert.equal(a.clear().ok, true);
	assert.equal(readFileSync(path, "utf8"), `${URL_B}\n`);
	assert.equal(b.clear().ok, true);
	assert.equal(existsSync(path), false);

	// A file someone replaced, or a link put there since, is left alone.
	a.publish(URL_A);
	writeFileSync(path, "someone else's\n");
	a.clear();
	assert.equal(readFileSync(path, "utf8"), "someone else's\n");
	rmSync(path);
	a.publish(URL_A);
	const target = join(dir, "target");
	writeFileSync(target, `${URL_A}\n`);
	rmSync(path);
	symlinkSync(target, path);
	a.clear();
	assert.equal(lstatSync(path).isSymbolicLink(), true);
	assert.equal(readFileSync(target, "utf8"), `${URL_A}\n`);
});

test("after a stop, a restart writes its new URL", (t) => {
	const dir = folder(t), path = join(dir, "studio-url");
	const file = forPath(path);
	file.publish(URL_A);
	file.clear();
	assert.equal(file.publish(URL_B).ok, true);
	assert.equal(readFileSync(path, "utf8"), `${URL_B}\n`);
	file.clear();
	assert.equal(existsSync(path), false);
});

test("Studio writes the URL wherever it prints its main view's URL, and clears it on stop", () => {
	const server = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
	const prints = [...server.matchAll(/^(.*)\n.*notify\(`Studio URL: \$\{(\w+)\}`/gm)].map((match) => ({ before: match[1].trim(), url: match[2] }));
	assert.equal(prints.length, 7, "each place Studio prints its URL");
	// Each names the server whose URL it is: a launch that waited across a stop and restart writes nothing (Astra, candidate 119).
	for (const { before, url } of prints) assert.match(before, new RegExp(`publishStudioUrlFile\\(${url}, (state|serverState), (ctx|lastCommandCtx)\\);$`), before);
	assert.match(server, /if \(!studioUrlFile \|\| serverState !== state \|\| !studioMainUrlReady\(\)\) return false;/);
	assert.doesNotMatch(server, /notify\(`Studio URL: \$\{[^}]*\(/, "none prints a URL it computes on the spot");
	assert.match(server, /if \(owner\.mode === "full"\) publishStudioUrlFile\(url, state, ctx\);/, "not for a Document window");
	assert.match(server, /if \(launchMode === "full"\) publishStudioUrlFile\(url, state, ctx\);/, "nor an editor-only view");
	assert.match(server, /const filed = publishStudioUrlFile\(url, serverState, ctx\);[\s\S]{0,400}if \(filed && studioUrlFile\) ctx\.ui\.notify\(`Studio URL file: \$\{studioUrlFile\.path\}`/, "--status names the file");
	assert.match(server, /serverState = null;\n\t\tconst urlFile = studioUrlFile\?\.clear\(\);/, "stop clears it as soon as the server is gone");
	assert.doesNotMatch(server.slice(server.indexOf("Read-only PDF preview"), server.indexOf("Read-only PDF preview") + 400), /publishStudioUrlFile/, "a PDF preview's URL isn't written");
});

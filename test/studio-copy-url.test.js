import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { copyStudioUrl } from "../shared/studio-copy-url.js";

// /studio --copy-url: the main view's URL on the clipboard, in Pi's terminal interface only, since
// Pi's copyToClipboard can write the terminal's clipboard sequence to standard output. A stand-in
// clipboard here; nothing touches the real one.
const URL_A = "http://127.0.0.1:4321/?token=aaaa&studioTabState=host_1&hostedWorkspace=host_1";
function clipboard({ fails } = {}) {
	const copied = [];
	return { copied, copy: async (text) => { if (fails) throw new Error(fails); copied.push(text); } };
}

test("in Pi's terminal interface the URL is copied, and said so without the URL", async () => {
	const board = clipboard();
	assert.deepEqual(await copyStudioUrl({ mode: "tui", running: true, url: URL_A, copy: board.copy }), { ok: true, message: "Copied Studio's URL." });
	assert.deepEqual(board.copied, [URL_A]);
});

test("RPC, JSON and print modes copy nothing: their standard output is Pi's own; nor does a Pi that doesn't say", async () => {
	for (const mode of ["rpc", "json", "print", undefined, ""]) {
		const board = clipboard();
		const result = await copyStudioUrl({ mode, running: true, url: URL_A, copy: board.copy });
		assert.deepEqual(result, { ok: false, message: "Copying the URL needs Pi's terminal interface. /studio --status prints it." }, mode);
		assert.deepEqual(board.copied, [], mode);
	}
});

test("without a running Studio, or its main view, there's nothing to copy", async () => {
	const board = clipboard();
	assert.equal((await copyStudioUrl({ mode: "tui", running: false, url: null, copy: board.copy })).message, "Studio isn't running. Run /studio first.");
	assert.equal((await copyStudioUrl({ mode: "tui", running: true, url: null, copy: board.copy })).message, "Studio has no main view yet. Run /studio first.");
	assert.deepEqual(board.copied, []);
});

test("a clipboard that fails says why, and where the URL is", async () => {
	const result = await copyStudioUrl({ mode: "tui", running: true, url: URL_A, copy: clipboard({ fails: "Clipboard unavailable: install `xclip` or `xsel`, or check X11 access." }).copy });
	assert.deepEqual(result, { ok: false, message: "Couldn't copy Studio's URL: Clipboard unavailable: install `xclip` or `xsel`, or check X11 access. /studio --status prints it." });
	assert.doesNotMatch(result.message, /token=/);
});

test("/studio --copy-url copies the URL --status prints, with Pi's own clipboard", () => {
	const server = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
	assert.match(server, /import \{[^}]*\bcopyToClipboard\b[^}]*\} from "@earendil-works\/pi-coding-agent";/);
	assert.match(server, /if \(trimmed === "copy-url" \|\| trimmed === "--copy-url"\) \{\n\t+const state = serverState;\n\t+const result = await copyStudioUrl\(\{ mode: ctx\.mode, running: Boolean\(state\), url: state && studioMainUrlReady\(\) \? currentFullStudioUrl\(state\) : null, copy: copyToClipboard \}\);/);
	assert.match(server, /\/studio --copy-url  Copy the running Studio's URL to the clipboard/, "the help names it");
});

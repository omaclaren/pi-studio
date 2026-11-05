import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer, get as httpGet } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

// Issue #7, through real Pi in RPC mode: with PI_STUDIO_URL_FILE set, the file holds the URL Studio
// last printed for its main view, one that opens Studio; --status names the file; --stop removes it.
// Several cases are Astra's, from the review of candidate 119.
const repositoryRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const piCliPath = fileURLToPath(new URL("../node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js", import.meta.url));
const extensionPath = fileURLToPath(new URL("../index.ts", import.meta.url));
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
async function waitFor(check, ms = 10_000) {
	const deadline = Date.now() + ms;
	while (Date.now() < deadline) { if (await check()) return true; await sleep(25); }
	return Boolean(await check());
}
const freePort = () => new Promise((resolvePort, rejectPort) => {
	const server = createServer(); server.once("error", rejectPort);
	server.listen(0, "127.0.0.1", () => { const { port } = server.address(); server.close(() => resolvePort(port)); });
});
const fetchStatus = (url) => new Promise((resolveStatus, rejectStatus) => {
	httpGet(url, (response) => { response.resume(); response.on("end", () => resolveStatus(response.statusCode)); }).on("error", rejectStatus);
});
// Variables that would send a browser launch to Muxy, cmux or Zed, or mark the session as SSH.
const LAUNCH_ENV = ["TMUX", "TMUX_PANE", "TERM_PROGRAM", "CMUX_WORKSPACE_ID", "CMUX_BUNDLE_ID", "CMUX_BUNDLED_CLI_PATH", "ZED_TERM",
	"MUXY_PANE_ID", "MUXY_SOCKET_PATH", "MUXY_SERVER_ID", "MUXY_SESSION_ID", "SSH_CONNECTION", "SSH_CLIENT", "SSH_TTY"];

async function withStudioPi(t, extraEnv, body) {
	const root = mkdtempSync(join(tmpdir(), "ps-url-file-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const env = { ...process.env, PI_CODING_AGENT_DIR: join(root, "agent"), TMPDIR: root, HOME: root };
	for (const name of [...LAUNCH_ENV, "PI_STUDIO_BUFFER_RECOVERY", "PI_STUDIO_BUFFER_SWITCHING", "PI_STUDIO_DOCUMENT_HOSTING", "PI_STUDIO_URL_FILE"]) delete env[name];
	Object.assign(env, typeof extraEnv === "function" ? extraEnv(root) : extraEnv);
	const child = spawn(process.execPath, [piCliPath, "--no-session", "--no-extensions", "-e", extensionPath, "--mode", "rpc"],
		{ cwd: repositoryRoot, env, stdio: ["pipe", "pipe", "pipe"] });
	let buffer = "", stderr = "", next = 0;
	const events = [], waiters = new Map();
	child.stdout.on("data", (chunk) => {
		buffer += chunk.toString("utf8");
		for (let index; (index = buffer.indexOf("\n")) >= 0;) {
			const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
			if (!line) continue;
			const event = JSON.parse(line); events.push(event);
			const waiter = waiters.get(event.id);
			if (waiter && event.type === "response") { waiters.delete(event.id); waiter(); }
		}
	});
	child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
	// What Studio notified while the command ran.
	const command = (message) => new Promise((resolveCommand, rejectCommand) => {
		const id = `url-file-${++next}`, from = events.length;
		const timer = setTimeout(() => rejectCommand(new Error(`Pi RPC timed out: ${message}\n${stderr}`)), 30_000);
		waiters.set(id, () => {
			clearTimeout(timer);
			resolveCommand(events.slice(from).filter((event) => event?.type === "extension_ui_request" && event.method === "notify")
				.map((event) => ({ message: String(event.message ?? ""), type: event.notifyType ?? event.level ?? "" })));
		});
		child.stdin.write(`${JSON.stringify({ id, type: "prompt", message })}\n`);
	});
	try {
		await body({ root, command, child });
	} finally {
		child.stdin.end();
		if (child.exitCode === null && child.signalCode === null) {
			child.kill("SIGTERM");
			await new Promise((resolveExit) => { const timer = setTimeout(() => { child.kill("SIGKILL"); resolveExit(); }, 5_000); child.once("exit", () => { clearTimeout(timer); resolveExit(); }); });
		}
	}
}
const printedUrl = (notes) => notes.map((note) => note.message.match(/^Studio URL: (\S+)$/)?.[1]).filter(Boolean).at(-1);
const urlFile = (root) => join(root, "studio-url");
const stored = (root) => readFileSync(urlFile(root), "utf8").trim();
const withUrlFile = (root) => ({ PI_STUDIO_URL_FILE: urlFile(root) });

test("the file holds the URL /studio prints, opens Studio, and goes on --stop", { timeout: 120_000 }, async (t) => {
	await withStudioPi(t, withUrlFile, async ({ root, command }) => {
		const path = urlFile(root);
		assert.equal(existsSync(path), false, "nothing before Studio starts");
		const port = await freePort();
		const url = printedUrl(await command(`/studio --no-browser --port ${port}`));
		assert.ok(url, "Studio printed its URL");
		assert.match(url, /[?&]hostedWorkspace=/, "dual editor mode, with its workspace");
		assert.equal(readFileSync(path, "utf8"), `${url}\n`, "the first launch writes it");
		if (process.platform !== "win32") assert.equal(statSync(path).mode & 0o777, 0o600);
		assert.equal(await fetchStatus(stored(root)), 200, "it opens Studio");

		const status = await command("/studio --status");
		assert.ok(status.some((note) => note.message === `Studio URL file: ${path}`), JSON.stringify(status));
		assert.equal(readFileSync(path, "utf8"), `${url}\n`);

		await command("/studio --stop");
		assert.equal(existsSync(path), false, "--stop removes it");
		const again = printedUrl(await command(`/studio --no-browser --port ${port}`));
		assert.equal(readFileSync(path, "utf8"), `${again}\n`, "a restart writes its new URL");
		await command("/studio --stop");
		assert.equal(existsSync(path), false);
	});
});

test("single editor mode writes its URL too", { timeout: 120_000 }, async (t) => {
	await withStudioPi(t, (root) => ({ ...withUrlFile(root), PI_STUDIO_BUFFER_RECOVERY: "0" }), async ({ root, command }) => {
		const url = printedUrl(await command(`/studio --no-browser --port ${await freePort()}`));
		assert.ok(url);
		assert.equal(stored(root), url);
		assert.equal(await fetchStatus(url), 200);
		await command("/studio --stop");
		assert.equal(existsSync(urlFile(root)), false);
	});
});

test("a file that can't be written is a warning, and Studio still starts", { timeout: 120_000 }, async (t) => {
	await withStudioPi(t, (root) => ({ PI_STUDIO_URL_FILE: join(root, "missing", "studio-url") }), async ({ root, command }) => {
		const notes = await command(`/studio --no-browser --port ${await freePort()}`);
		assert.ok(printedUrl(notes), "Studio started and printed its URL");
		const warning = notes.find((note) => note.message.startsWith("Studio couldn't write its URL to PI_STUDIO_URL_FILE"));
		assert.ok(warning, JSON.stringify(notes));
		assert.ok(warning.message.includes(join(root, "missing", "studio-url")) && warning.message.endsWith("its folder doesn't exist."), warning.message);
		assert.doesNotMatch(warning.message, /token=/, "the warning doesn't carry the URL");
		const status = await command("/studio --status");
		assert.equal(status.some((note) => note.message.startsWith("Studio URL file:")), false, "--status names no file it couldn't write");
		await command("/studio --stop");
	});
});

test("without PI_STUDIO_URL_FILE nothing is written", { timeout: 120_000 }, async (t) => {
	await withStudioPi(t, {}, async ({ root, command }) => {
		await command(`/studio --no-browser --port ${await freePort()}`);
		const status = await command("/studio --status");
		assert.equal(status.some((note) => note.message.startsWith("Studio URL file:")), false);
		assert.equal(existsSync(join(root, "agent", "pi-studio", "url")), false);
		await command("/studio --stop");
	});
});

// Astra's hold on candidate 119: a launch still waiting for the browser while Studio was stopped
// and started again wrote the old server's URL over the new one. A stand-in for cmux's browser
// command holds the launch; no-op `open` and `xdg-open` come first on PATH, so nothing real opens.
test("a launch that waited for the browser across a stop doesn't write its old URL", { timeout: 120_000 }, async (t) => {
	await withStudioPi(t, (root) => {
		const bin = join(root, "bin"), gate = join(root, "gate");
		mkdirSync(bin);
		for (const name of ["open", "xdg-open"]) writeFileSync(join(bin, name), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
		writeFileSync(join(root, "slow-cmux"), [
			"#!/usr/bin/env node",
			"const fs = require('node:fs');",
			"const gate = process.env.STUDIO_TEST_LAUNCH_GATE;",
			"if (process.argv[2] !== 'browser' || process.argv[3] !== 'open' || !gate) process.exit(0);",
			"fs.writeFileSync(gate + '.started', process.argv[4]);",
			"const timer = setInterval(() => { if (fs.existsSync(gate + '.release')) { clearInterval(timer); fs.rmSync(gate + '.release'); process.exit(0); } }, 10);",
			"setTimeout(() => process.exit(0), 4000).unref();",
		].join("\n"), { mode: 0o755 });
		return { ...withUrlFile(root), STUDIO_TEST_LAUNCH_GATE: gate, CMUX_BUNDLED_CLI_PATH: join(root, "slow-cmux"), TERM_PROGRAM: "cmux",
			PATH: `${bin}:${process.env.PATH ?? ""}` };
	}, async ({ root, command }) => {
		const gate = join(root, "gate"), port = await freePort();
		// Each hold starts with no markers, is released once, and is checked to be still waiting
		// before its release (Astra's N1, round 2).
		const held = async (message) => {
			for (const marker of ["started", "release"]) rmSync(`${gate}.${marker}`, { force: true });
			let settled = false, released = false;
			const pending = command(message);
			pending.then(() => { settled = true; }, () => { settled = true; });
			assert.ok(await waitFor(() => existsSync(`${gate}.started`)), `${message} reached the browser`);
			return {
				pending, url: readFileSync(`${gate}.started`, "utf8"), waiting: () => !settled,
				release: () => { if (!released) { released = true; writeFileSync(`${gate}.release`, "go"); } },
			};
		};

		// Stop and start again while the first launch waits.
		const first = await held(`/studio --open-remote --port ${port}`);
		try {
			await command("/studio --stop");
			const fresh = printedUrl(await command(`/studio --no-browser --port ${port}`));
			assert.ok(fresh);
			assert.notEqual(fresh, first.url);
			assert.equal(stored(root), fresh);
			assert.equal(first.waiting(), true, "the first launch is still waiting for the browser");
			first.release();
			await first.pending;
			assert.equal(stored(root), fresh, "the old launch doesn't write over the new URL");
			assert.equal(await fetchStatus(stored(root)), 200, "and the file still opens Studio");
		} finally { first.release(); await first.pending; }

		// Stop alone: the waiting launch leaves no file behind.
		const second = await held("/studio --blank --open-remote");
		try {
			await command("/studio --stop");
			assert.equal(existsSync(urlFile(root)), false);
			assert.equal(second.waiting(), true, "the second launch is still waiting for the browser");
			second.release();
			await second.pending;
			assert.equal(existsSync(urlFile(root)), false, "nothing written after the stop");
		} finally { second.release(); await second.pending; }
	});
});

test("a new workspace, a reopen, Move it here and both mode commands write the URL they print", { timeout: 120_000 }, async (t) => {
	await withStudioPi(t, withUrlFile, async ({ root, command }) => {
		const first = printedUrl(await command(`/studio --no-browser --port ${await freePort()}`));
		const next = printedUrl(await command("/studio --blank --no-browser"));
		assert.notEqual(first, next);
		assert.equal(stored(root), next, "a new workspace");
		assert.equal(printedUrl(await command("/studio --no-browser")), next);
		assert.equal(stored(root), next, "a reopen");
		assert.equal(printedUrl(await command("/studio-replace --no-browser")), next);
		assert.equal(stored(root), next, "Move it here");
		for (const mode of ["single", "dual"]) {
			const url = printedUrl(await command(`/studio --${mode} --no-browser`));
			assert.ok(url);
			assert.equal(stored(root), url, `/studio --${mode}`);
			assert.equal(await fetchStatus(url), 200);
			assert.equal(new URL(url).searchParams.has("hostedWorkspace"), mode === "dual");
		}
		await command("/studio --stop");
		assert.equal(existsSync(urlFile(root)), false);
	});
});

test("a PDF preview's URL isn't written, and --status writes none without a main workspace", { timeout: 120_000 }, async (t) => {
	await withStudioPi(t, withUrlFile, async ({ root, command }) => {
		const pdf = join(root, "sample.pdf");
		writeFileSync(pdf, "%PDF-1.4\n%%EOF\n");
		const notes = await command(`/studio "${pdf}" --no-browser --port ${await freePort()}`);
		assert.ok(notes.some((note) => note.message.startsWith("Read-only PDF preview")), JSON.stringify(notes));
		assert.equal(existsSync(urlFile(root)), false);
		await command("/studio --status");
		assert.equal(existsSync(urlFile(root)), false, "a URL without its workspace wouldn't open Studio");
		const url = printedUrl(await command("/studio --no-browser"));
		assert.equal(stored(root), url);
		await command(`/studio "${pdf}" --no-browser`);
		assert.equal(stored(root), url, "a later preview leaves the main URL");
		await command("/studio --stop");
	});
});

test("in single editor mode, editor-only and watched previews leave the main URL", { timeout: 120_000 }, async (t) => {
	await withStudioPi(t, (root) => ({ ...withUrlFile(root), PI_STUDIO_BUFFER_RECOVERY: "0" }), async ({ root, command }) => {
		const text = join(root, "sample.md");
		writeFileSync(text, "example\n");
		await command(`/studio-editor-only --no-browser --port ${await freePort()}`);
		assert.equal(existsSync(urlFile(root)), false);
		const url = printedUrl(await command("/studio --no-browser"));
		assert.equal(stored(root), url);
		await command("/studio-editor-only --no-browser");
		assert.equal(stored(root), url);
		await command(`/studio --watch "${text}" --no-browser`);
		assert.equal(stored(root), url);
		await command("/studio --stop");
	});
});

test("switching mode from the page writes the URL it lands on", { timeout: 120_000 }, async (t) => {
	const connect = async (url) => {
		const page = await (await fetch(url)).text();
		const capability = page.match(/data-buffer-capability="([^"]+)"/)?.[1];
		const address = new URL("/ws", url);
		address.protocol = "ws:";
		address.searchParams.set("token", new URL(url).searchParams.get("token"));
		if (capability) address.searchParams.set("bufferCapability", capability);
		const socket = new WebSocket(address, { origin: new URL(url).origin });
		await once(socket, "open");
		const pong = new Promise((resolvePong) => { const handler = (raw) => { if (JSON.parse(String(raw)).type === "pong") { socket.off("message", handler); resolvePong(); } }; socket.on("message", handler); });
		socket.send(JSON.stringify({ type: "ping" }));
		await pong;
		return socket;
	};
	await withStudioPi(t, withUrlFile, async ({ root, command }) => {
		const url = printedUrl(await command(`/studio --no-browser --port ${await freePort()}`));
		let socket = await connect(url);
		try {
			assert.equal(printedUrl(await command("/studio --no-browser")), url, "the open view is kept");
			assert.equal(stored(root), url);
			for (const mode of ["single", "dual"]) {
				const before = stored(root);
				const result = new Promise((resolveResult) => socket.on("message", (raw) => { const message = JSON.parse(String(raw)); if (message.type === "editor_mode_switch_result") resolveResult(message); }));
				socket.send(JSON.stringify({ type: "editor_mode_switch_request", requestId: `switch-${mode}`, mode, text: "", sideQuestions: true }));
				assert.equal((await result).ok, true);
				// The switch stops Studio, which removes the file, then writes the new URL: the file
				// can go between an exists check and the read, so a missing file is "not yet".
				assert.ok(await waitFor(() => { try { return stored(root) !== before; } catch { return false; } }), `switching to ${mode} wrote a new URL`);
				const after = stored(root);
				assert.equal(await fetchStatus(after), 200);
				assert.equal(new URL(after).searchParams.has("hostedWorkspace"), mode === "dual");
				socket.terminate();
				socket = await connect(after);
			}
		} finally { socket.terminate(); }
		await command("/studio --stop");
	});
});

test("Pi shutting down removes the file", { timeout: 120_000 }, async (t) => {
	await withStudioPi(t, withUrlFile, async ({ root, command, child }) => {
		await command(`/studio --no-browser --port ${await freePort()}`);
		assert.equal(existsSync(urlFile(root)), true);
		const exited = once(child, "exit");
		child.kill("SIGTERM");
		await exited;
		assert.equal(existsSync(urlFile(root)), false);
	});
});

// /studio --copy-url copies only in Pi's terminal interface: Pi's clipboard can write to standard
// output, which here is the RPC stream. Every line this harness reads is parsed as JSON.
test("in RPC mode /studio --copy-url copies nothing and leaves the stream intact", { timeout: 120_000 }, async (t) => {
	await withStudioPi(t, {}, async ({ command }) => {
		const refusal = "Copying the URL needs Pi's terminal interface. /studio --status prints it.";
		assert.ok((await command("/studio --copy-url")).some((note) => note.message === refusal));
		assert.ok(printedUrl(await command(`/studio --no-browser --port ${await freePort()}`)));
		const notes = await command("/studio --copy-url");
		assert.ok(notes.some((note) => note.message === refusal), JSON.stringify(notes));
		assert.equal(notes.some((note) => /token=/.test(note.message)), false);
		assert.ok((await command("/studio --status")).some((note) => note.message.startsWith("Studio running at ")), "Pi still answers");
		await command("/studio --stop");
	});
});

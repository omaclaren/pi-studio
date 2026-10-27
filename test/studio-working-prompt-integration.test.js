import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, get as httpGet } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

// Oliver, 27 Oct: Working shows what Pi is responding to, first. Real Pi with Studio and an offline scripted model:
// each run's Working carries its first user message, as Pi received it, live and in the copy saved with the response.
const repositoryRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const piCliPath = fileURLToPath(new URL("../node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js", import.meta.url));
const extensionPath = fileURLToPath(new URL("../index.ts", import.meta.url));
const scriptedAgentPath = fileURLToPath(new URL("./fixtures/scripted-agent-extension.js", import.meta.url));
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
async function waitFor(check, ms = 20_000) {
	const deadline = Date.now() + ms;
	while (Date.now() < deadline) { if (await check()) return true; await sleep(50); }
	return Boolean(await check());
}
const freePort = () => new Promise((resolvePort, rejectPort) => {
	const server = createServer(); server.once("error", rejectPort);
	server.listen(0, "127.0.0.1", () => { const { port } = server.address(); server.close(() => resolvePort(port)); });
});
const fetchText = (url) => new Promise((resolveText, rejectText) => {
	httpGet(url, (response) => { let body = ""; response.setEncoding("utf8"); response.on("data", (chunk) => { body += chunk; }); response.on("end", () => resolveText(body)); }).on("error", rejectText);
});

test("each run's Working carries its prompt, live and in the copy saved with its response", { timeout: 120_000 }, async () => {
	const root = mkdtempSync(join(tmpdir(), "ps-working-prompt-"));
	const env = { ...process.env, PI_CODING_AGENT_DIR: join(root, "agent"), TMPDIR: root, HOME: root };
	for (const name of ["TMUX", "TMUX_PANE", "PI_STUDIO_BUFFER_RECOVERY", "PI_STUDIO_BUFFER_SWITCHING", "PI_STUDIO_DOCUMENT_HOSTING"]) delete env[name];
	const child = spawn(process.execPath, [piCliPath, "--no-session", "--no-extensions", "-e", extensionPath, "-e", scriptedAgentPath, "--mode", "rpc"],
		{ cwd: repositoryRoot, env, stdio: ["pipe", "pipe", "pipe"] });
	let buffer = "", stderr = "", next = 0, ws = null;
	const events = [], waiters = new Map(), received = [];
	child.stdout.on("data", (chunk) => {
		buffer += chunk.toString("utf8");
		for (let index; (index = buffer.indexOf("\n")) >= 0;) {
			const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
			if (!line) continue;
			const event = JSON.parse(line); events.push(event);
			const waiter = waiters.get(event.id);
			if (waiter && event.type === "response") { waiters.delete(event.id); waiter(events.slice()); }
		}
	});
	child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
	const rpc = (fields, ms = 30_000) => new Promise((resolveCommand, rejectCommand) => {
		const id = `working-prompt-${++next}`;
		const timer = setTimeout(() => rejectCommand(new Error(`Pi RPC timed out: ${JSON.stringify(fields)}\n${stderr}`)), ms);
		waiters.set(id, (all) => { clearTimeout(timer); resolveCommand(all); });
		child.stdin.write(`${JSON.stringify({ id, ...fields })}\n`);
	});
	const run = async (message) => {
		const from = events.length, seen = received.length;
		await rpc({ type: "prompt", message });
		assert.ok(await waitFor(() => events.slice(from).some((event) => event.type === "agent_settled")), "the run settled");
		// Studio's last word on this run's Working, and the response it saved.
		assert.ok(await waitFor(() => received.slice(seen).some((m) => m.type === "trace_status" && m.status === "complete")), "Working finished");
		return received.slice(seen);
	};
	try {
		const model = (await rpc({ type: "set_model", provider: "studio-test", modelId: "scripted" })).at(-1);
		assert.equal(model.success, true, JSON.stringify(model));
		const port = await freePort();
		const urls = (await rpc({ type: "prompt", message: `/studio --no-browser --port ${port}` }))
			.filter((event) => event?.type === "extension_ui_request" && event.method === "notify")
			.flatMap((event) => String(event.message ?? "").match(/http:\/\/127\.0\.0\.1:\d+\/\?[^\s]+/g) ?? []);
		const url = new URL(urls.at(-1));
		const page = await fetchText(url);
		const capability = page.match(/data-buffer-capability="([^"]*)"/)?.[1] ?? "";
		ws = new WebSocket(`ws://127.0.0.1:${port}/ws?${new URLSearchParams({ token: url.searchParams.get("token"), ...(capability ? { bufferCapability: capability } : {}) })}`);
		ws.on("message", (data) => received.push(JSON.parse(String(data))));
		await new Promise((resolveOpen, rejectOpen) => { ws.once("open", resolveOpen); ws.once("error", rejectOpen); });
		ws.send(JSON.stringify({ type: "hello" }));
		await sleep(300);

		const first = "Explain the <b>result</b>\nin two lines.";
		const one = await run(first);
		const reset = one.find((m) => m.type === "trace_reset");
		assert.ok(reset, "a new run resets Working");
		assert.equal(reset.trace.prompt, null, "a fresh Working has no prompt yet");
		const withPrompt = one.filter((m) => m.type === "trace_status" && m.prompt);
		assert.ok(withPrompt.length > 0, "the prompt follows as soon as Pi has the message");
		assert.deepEqual([...new Set(withPrompt.map((m) => m.prompt))], [first], "exactly what Pi received");
		assert.ok(withPrompt.every((m) => m.runId === reset.trace.runId), "for this run");
		assert.equal(one.filter((m) => m.type === "trace_status").at(-1).prompt, first, "and kept to the end");

		// The copy saved with the response carries it too.
		const history = [...received].reverse().find((m) => Array.isArray(m.responseHistory) && m.responseHistory.length)?.responseHistory
			?? [...received].reverse().find((m) => m.type === "response_history" && Array.isArray(m.items) && m.items.length)?.items;
		assert.ok(history?.length, "a response was saved: " + JSON.stringify(received.map((m) => m.type)));
		const saved = history.at(-1);
		const snapshotFrom = received.length;
		ws.send(JSON.stringify({ type: "get_trace_snapshot", responseHistoryId: saved.id }));
		assert.ok(await waitFor(() => received.slice(snapshotFrom).some((m) => m.type === "trace_snapshot")), "the saved Working comes back");
		const snapshot = received.slice(snapshotFrom).find((m) => m.type === "trace_snapshot");
		assert.equal(snapshot.traceState.prompt, first);

		// A second run has its own prompt; a very long one is cut like any saved Working text.
		const second = "Second question.";
		const two = await run(second);
		assert.deepEqual([...new Set(two.filter((m) => m.type === "trace_status" && m.prompt).map((m) => m.prompt))], [second]);
		const long = "A long prompt line.\n" + "x".repeat(25_000);
		const three = await run(long);
		const cut = three.filter((m) => m.type === "trace_status" && m.prompt).at(-1).prompt;
		assert.ok(cut.startsWith("A long prompt line.") && cut.includes("chars omitted from saved Working view") && cut.length < 20_200, cut.length);
		assert.match(cut, new RegExp(`… ${long.length - 20_000} chars omitted`), "the count is what was cut from the prompt");
		// The saved copy keeps the same text and count: cut once, not again (Sol, Astra, candidate 99).
		const latestHistory = [...received].reverse().find((m) => Array.isArray(m.responseHistory) && m.responseHistory.length)?.responseHistory
			?? [...received].reverse().find((m) => m.type === "response_history" && Array.isArray(m.items) && m.items.length)?.items;
		const savedLong = latestHistory.at(-1), longFrom = received.length;
		ws.send(JSON.stringify({ type: "get_trace_snapshot", responseHistoryId: savedLong.id }));
		assert.ok(await waitFor(() => received.slice(longFrom).some((m) => m.type === "trace_snapshot" && m.responseHistoryId === savedLong.id)), "the saved long Working comes back");
		const longSnapshot = received.slice(longFrom).find((m) => m.type === "trace_snapshot" && m.responseHistoryId === savedLong.id);
		assert.equal(longSnapshot.traceState.prompt, cut);
		assert.equal(longSnapshot.traceState.promptTruncated, true);
	} finally {
		ws?.close();
		child.stdin.end();
		child.kill("SIGTERM");
		await new Promise((resolveExit) => { const timer = setTimeout(() => { child.kill("SIGKILL"); resolveExit(); }, 5_000); child.once("exit", () => { clearTimeout(timer); resolveExit(); }); });
		rmSync(root, { recursive: true, force: true });
	}
});

import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { buildStudioReplDeadPaneCloseArgs } from "../shared/studio-repl-tmux.js";
import { acquireReplSessionSendLease } from "../shared/repl-session-record.js";
import { createServer, get as httpGet } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

// Candidate 74: Studio's own REPL code against real runtimes on a private tmux
// server (base-index 1, a lookalike session name), through the page's websocket.
const repositoryRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const piCliPath = fileURLToPath(new URL("../node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js", import.meta.url));
const extensionPath = fileURLToPath(new URL("../index.ts", import.meta.url));
// A scripted model that calls Studio's REPL tools, so the agent's path runs for real offline.
const scriptedAgentPath = fileURLToPath(new URL("./fixtures/scripted-agent-extension.js", import.meta.url));
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

// A short root keeps tmux's socket path within the Unix limit. Pi's settings,
// Studio's records and the tmux server all live under it.
const root = mkdtempSync("/tmp/ps74-");
const env = { ...process.env, PI_CODING_AGENT_DIR: join(root, "agent"), TMUX_TMPDIR: root, TMPDIR: root };
// Where Studio, run with that TMPDIR, keeps its shared records and send leases.
const recordRoot = join(root, `pi-repl-session-records-${process.getuid()}`);
delete env.TMUX;
delete env.TMUX_PANE;
// Without a UTF-8 locale tmux prints tabs in its output as "_"; Studio passes -u.
for (const name of ["LANG", "LC_ALL", "LC_CTYPE"]) delete env[name];
const tmux = (...args) => spawnSync("tmux", args, { env, encoding: "utf8", timeout: 5_000 });
const has = (command) => spawnSync("/bin/sh", ["-c", `command -v ${command}`], { env, encoding: "utf8" }).status === 0;
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
// A process's start time and command, so teardown never signals a PID the system has reused.
const identify = (pid) => Number.isInteger(pid) && pid > 1 ? spawnSync("ps", ["-o", "lstart=,command=", "-p", String(pid)], { encoding: "utf8" }).stdout.trim() : "";
// The session name Studio gives a custom command.
const studioName = (runtime, command) => `pi-studio-repl-${runtime}-${createHash("sha1").update(`${runtime}\n${command}`).digest("hex").slice(0, 8)}`;
async function waitFor(check, ms = 5_000) {
	const deadline = Date.now() + ms;
	while (Date.now() < deadline) { if (await check()) return true; await sleep(100); }
	return Boolean(await check());
}

function reserveFreePort() {
	return new Promise((resolvePort, rejectPort) => {
		const server = createServer();
		server.once("error", rejectPort);
		server.listen(0, "127.0.0.1", () => {
			const { port } = server.address();
			server.close((error) => error ? rejectPort(error) : resolvePort(port));
		});
	});
}

function fetchText(url) {
	return new Promise((resolveText, rejectText) => {
		httpGet(url, (response) => {
			let body = "";
			response.setEncoding("utf8");
			response.on("data", (chunk) => { body += chunk; });
			response.on("end", () => resolveText(body));
		}).once("error", rejectText);
	});
}

function startPi() {
	const child = spawn(process.execPath, [piCliPath, "--no-session", "--no-extensions", "-e", extensionPath, "-e", scriptedAgentPath, "--mode", "rpc"], {
		cwd: repositoryRoot, env, stdio: ["pipe", "pipe", "pipe"],
	});
	let buffer = "", stderr = "", next = 0;
	const events = [], waiters = new Map();
	child.stdout.on("data", (chunk) => {
		buffer += chunk.toString("utf8");
		for (let index; (index = buffer.indexOf("\n")) >= 0;) {
			const line = buffer.slice(0, index);
			buffer = buffer.slice(index + 1);
			if (!line) continue;
			const event = JSON.parse(line);
			events.push(event);
			const waiter = waiters.get(event.id);
			if (waiter && event.type === "response") { waiters.delete(event.id); waiter(events.slice()); }
		}
	});
	child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
	const rpcRequest = (fields, timeoutMs = 30_000) => {
		const id = `repl-c74-${++next}`;
		return new Promise((resolveCommand, rejectCommand) => {
			const timer = setTimeout(() => rejectCommand(new Error(`Pi RPC timed out: ${JSON.stringify(fields)}\n${stderr}`)), timeoutMs);
			waiters.set(id, (all) => { clearTimeout(timer); resolveCommand(all); });
			child.stdin.write(`${JSON.stringify({ id, ...fields })}\n`);
		});
	};
	return {
		command(message, timeoutMs = 30_000) {
			return rpcRequest({ type: "prompt", message }, timeoutMs);
		},
		// Only the scripted model may answer: no fallback to a network provider.
		async useScriptedModel() {
			const response = (await rpcRequest({ type: "set_model", provider: "studio-test", modelId: "scripted" })).at(-1);
			assert.equal(response.success, true, JSON.stringify(response));
			assert.equal(response.data.provider, "studio-test");
		},
		// The scripted model calls one tool, then the run settles; returns the tool's result.
		async agent(tool, args, timeoutMs = 60_000) {
			const from = events.length;
			await rpcRequest({ type: "prompt", message: `CALL ${tool} ${JSON.stringify(args)}` });
			assert.ok(await waitFor(() => events.slice(from).some((event) => event.type === "agent_settled"), timeoutMs), `${tool} settled`);
			const run = events.slice(from);
			const answered = run.filter((event) => event.type === "message_end" && event.message?.role === "assistant").map((event) => event.message.provider);
			assert.ok(answered.length > 0 && answered.every((provider) => provider === "studio-test"), answered.join());
			return run.find((event) => event.type === "tool_execution_end" && event.toolName === tool)?.result;
		},
		async close() {
			if (child.exitCode !== null || child.signalCode !== null) return;
			child.kill("SIGTERM");
			await new Promise((resolveClose) => {
				const timer = setTimeout(() => { child.kill("SIGKILL"); resolveClose(); }, 5_000);
				child.once("exit", () => { clearTimeout(timer); resolveClose(); });
			});
		},
	};
}

function replClient(ws) {
	const waiters = [];
	let next = 0;
	ws.on("message", (data) => {
		const message = JSON.parse(String(data));
		for (const waiter of [...waiters]) {
			if (!waiter.match(message)) continue;
			waiters.splice(waiters.indexOf(waiter), 1);
			waiter.resolve(message);
		}
	});
	const expect = (match, ms = 45_000) => {
		let waiter;
		const reply = new Promise((resolveMessage, rejectMessage) => {
			const timer = setTimeout(() => rejectMessage(new Error("No matching Studio message")), ms);
			waiter = { match, timer, resolve: (message) => { clearTimeout(timer); resolveMessage(message); } };
			waiters.push(waiter);
		});
		// A wait the test no longer needs, such as the ack of a send that failed first.
		reply.cancel = () => {
			clearTimeout(waiter.timer);
			if (waiters.includes(waiter)) waiters.splice(waiters.indexOf(waiter), 1);
		};
		return reply;
	};
	const request = (type, fields, done) => {
		const requestId = `c74-${type}-${++next}`;
		const reply = expect((message) => message.requestId === requestId && done(message));
		ws.send(JSON.stringify({ type, requestId, ...fields }));
		return reply;
	};
	let choices = 0;
	return {
		async list() {
			const reply = expect((m) => m.type === "repl_state" && !m.requestId && m.choiceRevision === undefined);
			ws.send(JSON.stringify({ type: "repl_list_request" }));
			return await reply;
		},
		// A choice on the Session selector, or on Runtime with no session.
		async choose(sessionName, runtime) {
			const choiceRevision = ++choices;
			const reply = expect((m) => m.choiceRevision === choiceRevision);
			ws.send(JSON.stringify({ type: "repl_capture_request", choice: true, choiceRevision, runtime, ...(sessionName ? { sessionName } : {}) }));
			return await reply;
		},
		async reconcile(fields) {
			const reply = expect((m) => m.type === "repl_state" && !m.requestId && m.choiceRevision === undefined);
			ws.send(JSON.stringify({ type: "repl_reconcile_request", ...fields }));
			return await reply;
		},
		toolSend() {
			return expect((m) => m.type === "repl_tool_send");
		},
		// Studio's selection as broadcast to the page, unasked.
		broadcastState(sessionName) {
			return expect((m) => m.type === "repl_state" && !m.requestId && m.choiceRevision === undefined && m.activeSessionName === sessionName);
		},
		async start(runtime, command) {
			const reply = await request("repl_start_request", { runtime, ...(command ? { command } : {}) }, (m) => m.type === "repl_state");
			return { message: reply.replMessage, error: reply.replError, sessions: reply.sessions, active: reply.activeSessionName };
		},
		async capture(sessionName) {
			const reply = expect((m) => (m.type === "repl_capture" || m.type === "repl_state") && !m.requestId);
			ws.send(JSON.stringify({ type: "repl_capture_request", sessionName }));
			return await reply;
		},
		async stop(sessionName) {
			const reply = await this.stopReply(sessionName);
			return { message: reply.replMessage, error: reply.replError };
		},
		stopReply(sessionName) {
			return request("repl_stop_request", { sessionName }, (m) => m.type === "repl_state");
		},
		async interrupt(sessionName) {
			const reply = await request("repl_interrupt_request", { sessionName }, (m) => m.type === "repl_capture" || m.type === "repl_state");
			return { message: reply.replMessage, error: reply.replError };
		},
		async send(sessionName, text, fields) {
			const { reply, ...result } = await this.sending(sessionName, text, fields).done;
			return result;
		},
		// A send's acknowledgement (after the paste) and its result, separately.
		sending(sessionName, text, fields = {}) {
			const journalEntryId = `pi-studio:c74:${++next}`;
			const requestId = `c74-repl_send_request-${next}`;
			const ack = expect((m) => m.type === "repl_send_ack" && m.requestId === requestId);
			const done = expect((m) => m.requestId === requestId && (m.type === "repl_capture" || m.type === "repl_state") && Array.isArray(m.journalEntries)
				&& (m.replError || m.journalEntries.some((e) => e.id === journalEntryId && e.status !== "sending")));
			ws.send(JSON.stringify({ type: "repl_send_request", requestId, sessionName, text, journalEntryId, label: "Test", ...fields }));
			return {
				ack,
				done: done.then((reply) => {
					ack.cancel();
					const entry = reply.journalEntries.find((e) => e.id === journalEntryId);
					return { output: entry?.output, status: entry?.status, error: reply.replError, reply };
				}),
			};
		},
	};
}

const pane = (sessionName, format) => tmux("display-message", "-p", "-t", `=${sessionName}:`, format).stdout.trim();
const panePid = (sessionName) => Number(tmux("list-panes", "-s", "-t", `=${sessionName}`, "-F", "#{pane_pid}").stdout.trim().split("\n")[0]);
const cursorRow = (sessionName) => tmux("capture-pane", "-p", "-t", `=${sessionName}:`, "-S", pane(sessionName, "#{cursor_y}"), "-E", pane(sessionName, "#{cursor_y}")).stdout.trimEnd();

test("Studio REPL runs real runtimes on the session it means, and stops what it says it stopped", {
	timeout: 300_000,
	skip: has("tmux") ? false : "tmux is not installed",
}, async (t) => {
	// Cleanup is registered before anything starts.
	const leftovers = [];
	let rpc;
	let ws;
	t.after(async () => {
		ws?.close();
		if (rpc) {
			try { await rpc.command("/studio --stop", 10_000); } catch {}
			await rpc.close();
		}
		tmux("kill-server");
		for (const { pid, identity } of leftovers) {
			if (identity && identify(pid) === identity) { try { process.kill(pid, "SIGKILL"); } catch {} }
		}
		rmSync(root, { recursive: true, force: true });
	});
	// A tmux server of our own, with windows numbered from 1 and a session whose name extends Studio's.
	assert.equal(tmux("-f", "/dev/null", "new-session", "-d", "-s", "keepalive", "sleep 600").status, 0);
	assert.equal(tmux("set-option", "-g", "base-index", "1").status, 0);
	assert.equal(tmux("new-session", "-d", "-s", "pi-studio-repl-python-lookalike", "sleep 600").status, 0);
	rpc = startPi();
	await rpc.useScriptedModel();

	async function openStudio() {
		const port = await reserveFreePort();
		const urls = (await rpc.command(`/studio --no-browser --port ${port}`))
			.filter((event) => event?.type === "extension_ui_request" && event.method === "notify")
			.flatMap((event) => String(event.message ?? "").match(/http:\/\/127\.0\.0\.1:\d+\/\?[^\s]+/g) ?? []);
		const url = new URL(urls.at(-1));
		const page = await fetchText(url);
		const capability = page.match(/data-buffer-capability="([^"]*)"/)?.[1] ?? "";
		ws = new WebSocket(`ws://127.0.0.1:${port}/ws?${new URLSearchParams({ token: url.searchParams.get("token"), ...(capability ? { bufferCapability: capability } : {}) })}`);
		await new Promise((resolveOpen, rejectOpen) => { ws.once("open", resolveOpen); ws.once("error", rejectOpen); });
		return replClient(ws);
	}
	let repl = await openStudio();
	const slow = (seconds) => `sh -c 'sleep ${seconds}; exec python3 -q'`;
	const lifetime = (session) => ({ sessionName: session.sessionName, tmuxSessionId: session.tmuxSessionId, tmuxSessionCreatedAt: session.tmuxSessionCreatedAt });
	const hasSession = (name) => tmux("has-session", "-t", `=${name}`).status === 0;
	const starts = (name) => waitFor(() => hasSession(name), 3_000);
	const scrollback = (name) => tmux("capture-pane", "-p", "-J", "-t", `=${name}:`, "-S", "-300").stdout.replace(/[\t ]+$/gm, "");
	// Summary is the default, as in pi-repl: the pane shows the code between labelled
	// markers, then a blank line, and the record keeps only the output.
	async function showsSummary(name, code, output) {
		assert.equal((await repl.send(name, code)).output, output);
		const shown = scrollback(name);
		const lines = code.split("\n");
		const count = `${lines.length} ${lines.length === 1 ? "line" : "lines"}`;
		const id = [...shown.matchAll(new RegExp(`^── pi-studio · input · ${count} · id: ([a-f0-9]{12}) ──$`, "gm"))].at(-1)?.[1];
		assert.ok(id, shown);
		const block = ["", "", `── pi-studio · input · ${count} · id: ${id} ──`, ...lines, "── output ──", ...output.split("\n"), `── done · id: ${id} ──`, "", ""].join("\n");
		assert.ok(shown.includes(block), `expected\n${block}\nin\n${shown}`);
		assert.match(shown, new RegExp(`/${id}-[a-f0-9]{16}\\.`), "the loader's file name starts with the id");
	}

	await t.test("with no preference yet, the page's own pick applies without counting", { skip: !has("python3") }, async () => {
		const slowName = studioName("python", slow(2));
		assert.equal(tmux("new-session", "-d", "-s", "pi-repl-python", "python3 -q").status, 0);
		try {
			const state = await repl.list();
			// Studio guesses nothing until something selects.
			assert.equal(state.activeSessionName, null);
			assert.equal(state.activeRuntime, null);
			const starting = repl.start("python", slow(2));
			assert.ok(await starts(slowName));
			const external = state.sessions.find((session) => session.sessionName === "pi-repl-python");
			assert.equal((await repl.reconcile({ basis: state.shown, ...lifetime(external) })).activeSessionName, "pi-repl-python");
			// The page's pick isn't a choice, so the Start still selects.
			const started = await starting;
			assert.equal(started.message, `Started Python REPL with custom command: ${slow(2)}.`);
			assert.equal(started.active, slowName);
		} finally {
			for (const name of ["pi-repl-python", slowName]) tmux("kill-session", "-t", `=${name}`);
		}
	});

	await t.test("Python: exact session, real pane numbers, kept output, interrupt and a verified stop", { skip: !has("python3") }, async () => {
		const started = await repl.start("python");
		assert.equal(started.message, "Started Python REPL.", started.error);
		assert.ok(started.sessions.some((s) => s.sessionName === "pi-studio-repl-python"), "its own session, not the lookalike");
		assert.equal(pane("pi-studio-repl-python", "#{window_index}"), "1");
		assert.equal(cursorRow("pi-studio-repl-python"), ">>>", "Start answered once the prompt was showing");

		assert.deepEqual(await repl.send("pi-studio-repl-python", 'print("a")\nprint(">>>")'), { output: "a\n>>>", status: "captured", error: undefined });
		await showsSummary("pi-studio-repl-python", 'print("a")\nprint("b")', "a\nb");
		// Output that ends mid-line still puts the done marker on a line of its own (Sol, Astra).
		await showsSummary("pi-studio-repl-python", 'print("c", end="")', "c");
		// Off adds nothing to the pane. As in pi-repl, its file name still starts with an id.
		const markers = (text) => text.match(/^── /gm)?.length ?? 0;
		const before = markers(scrollback("pi-studio-repl-python"));
		assert.equal((await repl.send("pi-studio-repl-python", 'print("quiet")', { echoMode: "off" })).output, "quiet");
		const quiet = scrollback("pi-studio-repl-python");
		assert.equal(markers(quiet), before);
		assert.match(quiet.split("\n").filter((line) => line.includes("exec(open(")).at(-1), /\/[a-f0-9]{12}-[a-f0-9]{16}\.py"/);
		const loaderLike = 'exec(open("/tmp/pi-rc-x/0123456789abcdef.py", encoding="utf-8").read(), globals())';
		assert.equal((await repl.send("pi-studio-repl-python", `print(${JSON.stringify(loaderLike)})`)).output, loaderLike);

		const busy = repl.send("pi-studio-repl-python", "import time\ntime.sleep(30)");
		await sleep(1_000);
		assert.equal((await repl.interrupt("pi-studio-repl-python")).message, "Interrupted pi-studio-repl-python.");
		assert.match((await busy).output, /KeyboardInterrupt/);

		// A lower-numbered window appearing mid-send doesn't move the send's capture.
		const pinned = repl.send("pi-studio-repl-python", 'import time\ntime.sleep(2)\nprint("pinned")');
		await sleep(500);
		assert.equal(tmux("new-window", "-d", "-t", "=pi-studio-repl-python:0", "sleep 600").status, 0);
		assert.equal((await pinned).output, "pinned");
		tmux("kill-window", "-t", "=pi-studio-repl-python:0");

		// A window linked into a newer session still belongs to this one.
		assert.equal(tmux("new-session", "-d", "-s", "linked-c74", "sleep 600").status, 0);
		assert.equal(tmux("link-window", "-d", "-s", "=pi-studio-repl-python:1", "-t", "=linked-c74:5").status, 0);
		assert.equal((await repl.send("pi-studio-repl-python", 'print("linked")')).output, "linked");
		tmux("kill-session", "-t", "=linked-c74");

		// A child that ignores hangup and TERM: closing tmux alone would leave it running.
		const child = Number((await repl.send("pi-studio-repl-python",
			"import subprocess\np = subprocess.Popen(['/bin/sh', '-c', \"trap '' HUP TERM; sleep 300\"])\nprint(p.pid)")).output);
		leftovers.push({ pid: child, identity: identify(child) });
		const runtime = panePid("pi-studio-repl-python");
		assert.ok(alive(child) && alive(runtime));
		assert.deepEqual(await repl.stop("pi-studio-repl-python"), { message: "Stopped pi-studio-repl-python.", error: undefined });
		assert.ok(await waitFor(() => !alive(child) && !alive(runtime)), "the runtime and its resistant child exited");
		assert.equal(tmux("has-session", "-t", "=pi-studio-repl-python-lookalike").status, 0, "the lookalike is untouched");
		// tmux would take a bare name as a prefix and find the lookalike.
		assert.equal((await repl.send("pi-studio-repl-python", "print(1)")).error, "No tmux REPL session named pi-studio-repl-python.");
		assert.equal(tmux("capture-pane", "-p", "-t", "=pi-studio-repl-python-lookalike:").stdout.trim(), "", "nothing pasted into the lookalike");

		const missing = await repl.start("python", "nosuchcmd-c74");
		assert.equal(missing.error, "Python exited while starting. Check the command: nosuchcmd-c74.");
	});

	await t.test("a runtime that exits while starting closes only its own pane", { skip: !has("python3") }, async () => {
		const failing = "sh -c 'sleep 1; exit 3'";
		const name = studioName("python", failing);
		assert.equal(tmux("set-option", "-g", "remain-on-exit", "on").status, 0);
		try {
			const starting = repl.start("python", failing);
			assert.ok(await waitFor(() => tmux("has-session", "-t", `=${name}`).status === 0, 3_000));
			// A lower-numbered window, so its pane comes first in the session.
			assert.equal(tmux("new-window", "-d", "-t", `=${name}:0`, "sleep 600").status, 0);
			assert.equal((await starting).error, `Python exited while starting. Check the command: ${failing}.`);
			assert.equal(tmux("list-panes", "-s", "-t", `=${name}`, "-F", "#{pane_dead}").stdout.trim(), "0", "the window opened since keeps running");
		} finally {
			tmux("set-option", "-g", "remain-on-exit", "off");
			tmux("kill-session", "-t", `=${name}`);
		}
	});

	await t.test("Start's close leaves a pane that was respawned or moved after it looked", async () => {
		assert.equal(tmux("set-option", "-g", "remain-on-exit", "on").status, 0);
		try {
			// A session whose only pane has exited, as Start would see it.
			const exited = async (name) => {
				const [sessionId, paneId] = tmux("-u", "new-session", "-d", "-P", "-F", "#{session_id}\t#{pane_id}", "-s", name, "sh -c 'exit 3'").stdout.trim().split("\t");
				assert.ok(await waitFor(() => tmux("display-message", "-p", "-t", paneId, "#{pane_dead}").stdout.trim() === "1"));
				return { sessionId, paneId, pid: tmux("display-message", "-p", "-t", paneId, "#{pane_pid}").stdout.trim() };
			};
			const close = ({ sessionId, paneId, pid }) => tmux(...buildStudioReplDeadPaneCloseArgs(sessionId, paneId, pid));
			const paneLive = (paneId) => tmux("list-panes", "-a", "-F", "#{pane_id} #{pane_dead}").stdout.split("\n").includes(`${paneId} 0`);

			const still = await exited("dead-c74-a");
			assert.equal(close(still).status, 0);
			assert.notEqual(tmux("has-session", "-t", "=dead-c74-a").status, 0, "an unchanged exited pane is closed");

			const respawned = await exited("dead-c74-b");
			assert.equal(tmux("respawn-pane", "-t", respawned.paneId, "sleep 600").status, 0);
			close(respawned);
			assert.ok(paneLive(respawned.paneId), "a respawned pane keeps running");

			const moved = await exited("dead-c74-c");
			assert.equal(tmux("new-session", "-d", "-s", "dead-c74-other", "sleep 600").status, 0);
			assert.equal(tmux("join-pane", "-d", "-s", moved.paneId, "-t", "=dead-c74-other:").status, 0);
			close(moved);
			assert.equal(tmux("list-panes", "-s", "-t", "=dead-c74-other", "-F", "#{pane_id}").stdout.split("\n").includes(moved.paneId), true, "a pane moved to another session is left there");
		} finally {
			tmux("set-option", "-g", "remain-on-exit", "off");
			for (const name of ["dead-c74-a", "dead-c74-b", "dead-c74-c", "dead-c74-other"]) tmux("kill-session", "-t", `=${name}`);
		}
	});

	await t.test("Start doesn't report a prompt it saw in a pane Studio won't send to", { skip: !has("python3") }, async () => {
		const slow = "sh -c 'sleep 2; exec python3 -q'";
		const name = studioName("python", slow);
		try {
			const starting = repl.start("python", slow);
			assert.ok(await waitFor(() => tmux("has-session", "-t", `=${name}`).status === 0, 3_000));
			assert.equal(tmux("new-window", "-d", "-t", `=${name}:0`, "sleep 600").status, 0);
			assert.equal((await starting).message, `Started Python REPL with custom command: ${slow}, but another pane now comes first in its session. Check it before running code.`);
		} finally {
			tmux("kill-session", "-t", `=${name}`);
		}
	});

	await t.test("a Start that finishes after Studio restarts leaves the selection alone", { skip: !has("python3") }, async () => {
		const slow = "sh -c 'sleep 4; exec python3 -q'";
		const slowName = studioName("python", slow);
		assert.equal((await repl.start("python")).message, "Started Python REPL.");
		ws.send(JSON.stringify({ type: "repl_start_request", requestId: "c74-old-page-start", runtime: "python", command: slow }));
		await sleep(500);
		ws.close();
		await rpc.command("/studio --stop", 10_000);
		// The new page chooses nothing, so only the closed page's fence keeps the old Start out.
		repl = await openStudio();
		assert.ok(await waitFor(() => cursorRow(slowName) === ">>>", 15_000), "the old page's runtime started");
		await sleep(1_000);
		assert.equal((await repl.list()).activeSessionName, "pi-studio-repl-python");
		assert.equal((await repl.stop(slowName)).message, `Stopped ${slowName}.`);
		assert.equal((await repl.stop("pi-studio-repl-python")).message, "Stopped pi-studio-repl-python.");
	});

	await t.test("a session chosen while another starts stays selected", { skip: !has("python3") }, async () => {
		const names = [2, 3, 2.5].map((seconds) => studioName("python", slow(seconds)));
		const [polled, overtaken, chosen] = names;
		const startWhile = async (seconds, name, during) => {
			const starting = repl.start("python", slow(seconds));
			assert.ok(await waitFor(() => tmux("has-session", "-t", `=${name}`).status === 0, 3_000));
			await during();
			return await starting;
		};
		try {
			assert.equal((await repl.start("python")).message, "Started Python REPL.");
			// The page polling the session it already shows only observes it.
			let started = await startWhile(2, polled, async () => {
				const observed = await repl.capture("pi-studio-repl-python");
				assert.equal(observed.observation, true);
				assert.equal(observed.activeSessionName, undefined);
				assert.equal(observed.shown, undefined);
			});
			assert.equal(started.message, `Started Python REPL with custom command: ${slow(2)}.`);
			assert.equal(started.active, polled);
			// Choosing another session while one starts keeps that choice.
			started = await startWhile(3, overtaken, () => repl.choose("pi-studio-repl-python", "python"));
			assert.equal(started.message, `Started Python REPL with custom command: ${slow(3)}. Select ${overtaken} under Session to use it.`);
			assert.equal(started.active, "pi-studio-repl-python");
			assert.equal((await repl.list()).activeSessionName, "pi-studio-repl-python");
			// Choosing the starting session itself is no reason to warn.
			started = await startWhile(2.5, chosen, () => repl.choose(chosen, "python"));
			assert.equal(started.message, `Started Python REPL with custom command: ${slow(2.5)}.`);
			assert.equal(started.active, chosen);
		} finally {
			for (const name of ["pi-studio-repl-python", ...names]) tmux("kill-session", "-t", `=${name}`);
		}
	});

	await t.test("a result that finishes after a newer choice doesn't take the selection", { skip: !has("python3") }, async () => {
		const b = "pi-studio-repl-python";
		const plain = "sh -c 'exec python3 -q'";
		const c = studioName("python", plain);
		const [a1, a2] = [studioName("python", slow(4)), studioName("python", slow(3))];
		try {
			assert.equal((await repl.start("python")).message, "Started Python REPL.");
			assert.equal((await repl.start("python", plain)).active, c);

			// A send to B, acknowledged, then Runtime moved to one with no session.
			assert.equal((await repl.choose(b, "python")).activeSessionName, b);
			let sending = repl.sending(b, "import time; time.sleep(2); print('B done')");
			await sending.ack;
			const empty = await repl.choose(undefined, "julia");
			assert.equal(empty.activeSessionName, null);
			assert.equal(empty.activeRuntime, "julia");
			let sent = await sending.done;
			assert.equal(sent.reply.type, "repl_state");
			assert.equal(sent.reply.transcript, undefined);
			assert.equal(sent.output, "B done", "the record still gets B's output");
			assert.equal((await repl.list()).activeRuntime, "julia");

			// A long send to B, a slow Start of A, then C chosen: B finishes, then A.
			await repl.choose(b, "python");
			sending = repl.sending(b, "import time; time.sleep(2); print('B again')");
			await sending.ack;
			const starting = repl.start("python", slow(4));
			assert.ok(await starts(a1));
			await repl.choose(c, "python");
			sent = await sending.done;
			assert.equal(sent.reply.type, "repl_state");
			assert.equal(sent.reply.transcript, undefined);
			assert.equal(sent.output, "B again");
			let started = await starting;
			assert.equal(started.message, `Started Python REPL with custom command: ${slow(4)}. Select ${a1} under Session to use it.`);
			assert.equal(started.active, c);

			// A send to the session already selected counts too.
			await repl.choose(b, "python");
			const startingAgain = repl.start("python", slow(3));
			assert.ok(await starts(a2));
			assert.equal((await repl.send(b, "1 + 1")).output, "2");
			started = await startingAgain;
			assert.equal(started.message, `Started Python REPL with custom command: ${slow(3)}. Select ${a2} under Session to use it.`);
			assert.equal(started.active, b);

			// Stopping C after choosing B leaves B and its view alone.
			await repl.choose(c, "python");
			const stopping = repl.stopReply(c);
			await repl.choose(b, "python");
			const stopped = await stopping;
			assert.equal(stopped.replMessage, `Stopped ${c}.`);
			assert.equal(stopped.transcript, undefined);
			assert.equal(stopped.activeSessionName, b);
		} finally {
			for (const name of [b, c, a1, a2]) tmux("kill-session", "-t", `=${name}`);
		}
	});

	await t.test("a Start the page chose still selects after a fallback showed another session", { skip: !has("python3") }, async () => {
		const b = "pi-studio-repl-python";
		const a = studioName("python", slow(3));
		try {
			assert.equal((await repl.start("python")).message, "Started Python REPL.");
			const starting = repl.start("python", slow(3));
			assert.ok(await starts(a));
			assert.equal((await repl.choose(a, "python")).activeSessionName, a);
			// A moment when A isn't listed: Studio falls back to B without counting.
			assert.equal(tmux("rename-session", "-t", `=${a}`, `${a}-away`).status, 0);
			const fellBack = await repl.list();
			assert.notEqual(fellBack.activeSessionName, a);
			assert.equal(fellBack.activeRuntime, "python");
			assert.equal(tmux("rename-session", "-t", `=${a}-away`, a).status, 0);
			// A was the latest choice, though not selected now, so it selects as it finishes.
			const started = await starting;
			assert.equal(started.message, `Started Python REPL with custom command: ${slow(3)}.`);
			assert.equal(started.active, a);
		} finally {
			for (const name of [b, a, `${a}-away`]) tmux("kill-session", "-t", `=${name}`);
		}
	});

	await t.test("of two overlapping Starts, only the newer one selects", { skip: !has("python3") }, async () => {
		const names = [1, 3, 3.5, 1.5].map((seconds) => studioName("python", slow(seconds)));
		try {
			// The older finishes first.
			let older = repl.start("python", slow(1));
			let newer = repl.start("python", slow(3));
			assert.equal((await older).message, `Started Python REPL with custom command: ${slow(1)}. Select ${names[0]} under Session to use it.`);
			assert.equal((await newer).active, names[1]);
			// The newer finishes first.
			older = repl.start("python", slow(3.5));
			newer = repl.start("python", slow(1.5));
			assert.equal((await newer).active, names[3]);
			assert.equal((await older).message, `Started Python REPL with custom command: ${slow(3.5)}. Select ${names[2]} under Session to use it.`);
			assert.equal((await repl.list()).activeSessionName, names[3]);
		} finally {
			for (const name of names) tmux("kill-session", "-t", `=${name}`);
		}
	});

	await t.test("choosing the starting session, then an empty Runtime, keeps the empty Runtime", { skip: !has("python3") }, async () => {
		const name = studioName("python", slow(2));
		try {
			const starting = repl.start("python", slow(2));
			assert.ok(await starts(name));
			assert.equal((await repl.choose(name, "python")).activeSessionName, name);
			await repl.choose(undefined, "julia");
			const started = await starting;
			assert.equal(started.message, `Started Python REPL with custom command: ${slow(2)}. Select ${name} under Session to use it.`);
			assert.equal(started.active, null);
		} finally {
			tmux("kill-session", "-t", `=${name}`);
		}
	});

	await t.test("a send counts when Studio accepts it, not when its turn comes", { skip: !has("python3") }, async () => {
		const b = "pi-studio-repl-python";
		const plain = "sh -c 'exec python3 -q'";
		const c = studioName("python", plain);
		try {
			assert.equal((await repl.start("python")).message, "Started Python REPL.");
			await repl.start("python", plain);
			const record = (await repl.choose(b, "python")).session.recordId;
			assert.match(record, /^[a-f0-9]{32}$/);
			// B's send waits for the lease, and C is chosen before its paste.
			let lease = await acquireReplSessionSendLease(record, { root: recordRoot, owner: "c74-test", waitMs: 1_000 });
			let sending = repl.sending(b, "print('after the lease')");
			await sleep(500);
			await repl.choose(c, "python");
			await lease.release();
			const sent = await sending.done;
			assert.equal(sent.output, "after the lease");
			assert.equal(sent.reply.type, "repl_state");
			assert.equal(sent.reply.transcript, undefined);
			assert.equal((await repl.list()).activeSessionName, c);

			// Its error path: B is replaced while the send waits.
			await repl.choose(b, "python");
			lease = await acquireReplSessionSendLease(record, { root: recordRoot, owner: "c74-test", waitMs: 1_000 });
			sending = repl.sending(b, "print(1)");
			await sleep(500);
			await repl.choose(c, "python");
			tmux("kill-session", "-t", `=${b}`);
			assert.equal(tmux("new-session", "-d", "-s", b, "python3 -q").status, 0);
			await lease.release();
			const failed = await sending.done;
			assert.equal(failed.error, `REPL session ${b} changed while Studio was waiting to send.`);
			assert.equal(failed.reply.type, "repl_state");
			assert.equal(failed.reply.transcript, undefined);
			assert.equal(failed.reply.activeSessionName, c);
		} finally {
			for (const name of [b, c]) tmux("kill-session", "-t", `=${name}`);
		}
	});

	await t.test("a poll observes, and a reconcile from before a change is refused", { skip: !has("python3") }, async () => {
		const b = "pi-studio-repl-python";
		const a = studioName("python", slow(1));
		try {
			assert.equal((await repl.start("python")).message, "Started Python REPL.");
			const chose = await repl.choose(b, "python");
			// A's Start selects, with no newer choice; then B's poll, handled after it.
			assert.equal((await repl.start("python", slow(1))).active, a);
			const observed = await repl.capture(b);
			assert.equal(observed.observation, true);
			assert.equal(observed.session.sessionName, b);
			assert.equal(observed.activeSessionName, undefined);
			// The page's own pick of B, on the selection it saw before A, changes nothing.
			const refused = await repl.reconcile({ basis: chose.shown, ...lifetime(chose.session) });
			assert.equal(refused.activeSessionName, a);
			assert.ok(refused.shown > chose.shown);
		} finally {
			for (const name of [b, a]) tmux("kill-session", "-t", `=${name}`);
		}
	});

	await t.test("when the selected session goes, Studio stays within its runtime", { skip: !has("python3") }, async () => {
		const b = "pi-studio-repl-python";
		const plain = "sh -c 'exec python3 -q'";
		const c = studioName("python", plain);
		assert.equal(tmux("new-session", "-d", "-s", "pi-repl-julia", "sleep 600").status, 0);
		tmux("set-option", "-t", "=pi-repl-julia", "@pi_repl_runtime", "julia");
		try {
			assert.equal((await repl.start("python")).message, "Started Python REPL.");
			await repl.start("python", plain);
			await repl.choose(b, "python");
			tmux("kill-session", "-t", `=${b}`);
			let state = await repl.list();
			assert.equal(state.activeRuntime, "python");
			assert.notEqual(state.activeSessionName, "pi-repl-julia");
			for (const session of state.sessions.filter((candidate) => candidate.runtime === "python")) tmux("kill-session", "-t", `=${session.sessionName}`);
			state = await repl.list();
			assert.equal(state.activeSessionName, null);
			assert.equal(state.activeRuntime, "python");
			// A choice of a session that has gone still gets its answer.
			const gone = await repl.choose("pi-studio-repl-python-gone", "python");
			assert.equal(gone.type, "repl_state");
			assert.equal(gone.replError, "No tmux REPL session named pi-studio-repl-python-gone.");
			assert.equal(gone.activeSessionName, null);
			assert.equal(gone.activeRuntime, "python");
		} finally {
			for (const name of [b, c, "pi-repl-julia"]) tmux("kill-session", "-t", `=${name}`);
		}
	});

	await t.test("a Stop that finishes after its session was replaced leaves the replacement alone", { skip: !has("python3") }, async () => {
		// A child that ignores HUP and TERM keeps Stop waiting for its verified exit.
		const stubborn = `sh -c 'trap "" HUP TERM; sleep 30 & exec python3 -q'`;
		const name = studioName("python", stubborn);
		try {
			const started = await repl.start("python", stubborn);
			assert.equal(started.active, name);
			const before = started.sessions.find((session) => session.sessionName === name);
			const stopping = repl.stopReply(name);
			assert.ok(await waitFor(() => !hasSession(name), 5_000), "Stop closed the tmux session");
			assert.equal(tmux("new-session", "-d", "-s", name, "python3 -q").status, 0);
			const chose = await repl.choose(name, "python");
			assert.notEqual(chose.session.tmuxSessionId, before.tmuxSessionId);
			const stopped = await stopping;
			assert.equal(stopped.replMessage, `Stopped ${name}.`, stopped.replError);
			assert.equal(stopped.transcript, undefined);
			assert.equal(stopped.activeSessionName, name);
			const after = (await repl.list()).sessions.find((session) => session.sessionName === name);
			assert.equal(after.tmuxSessionId, chose.session.tmuxSessionId);
			// A page that still knows the stopped lifetime can't pick it by name.
			const empty = await repl.choose(undefined, "julia");
			assert.equal((await repl.reconcile({ basis: empty.shown, ...lifetime(before) })).activeSessionName, null);
			assert.equal((await repl.reconcile({ basis: empty.shown, ...lifetime(chose.session) })).activeSessionName, name);
		} finally {
			tmux("kill-session", "-t", `=${name}`);
		}
	});

	await t.test("the agent's send and status, through a scripted model", { skip: !has("python3") }, async () => {
		const p = "pi-studio-repl-python";
		const plain = "sh -c 'exec python3 -q'";
		const c = studioName("python", plain);
		const a = studioName("python", slow(2));
		assert.equal(tmux("new-session", "-d", "-s", "pi-repl-julia", "sleep 600").status, 0);
		tmux("set-option", "-t", "=pi-repl-julia", "@pi_repl_runtime", "julia");
		try {
			assert.equal((await repl.start("python")).message, "Started Python REPL.");
			await repl.start("python", plain);
			// The agent selects Python while the page shows Julia.
			const julia = await repl.choose("pi-repl-julia", "julia");
			const broadcast = repl.toolSend();
			let result = await rpc.agent("studio_repl_send", { sessionName: p, code: "print('from the agent')" });
			assert.equal(result.details.ok, true, result.content[0].text);
			let sent = await broadcast;
			assert.equal(sent.select, true);
			assert.equal(sent.activeSessionName, p);
			assert.equal(sent.activeRuntime, "python");
			assert.ok(sent.shown > julia.shown);
			assert.match(sent.transcript, /from the agent/);
			// The page's own pick of Julia, on the selection it saw before, is refused.
			assert.equal((await repl.reconcile({ basis: julia.shown, ...lifetime(julia.session) })).activeSessionName, p);

			// A newer choice while the agent's send waits for the lease: its result doesn't select.
			const record = (await repl.list()).sessions.find((session) => session.sessionName === p).recordId;
			const lease = await acquireReplSessionSendLease(record, { root: recordRoot, owner: "c74-test", waitMs: 1_000 });
			const later = repl.toolSend();
			const running = rpc.agent("studio_repl_send", { sessionName: p, code: "print('later')" });
			await sleep(1_000);
			await repl.choose(c, "python");
			await lease.release();
			result = await running;
			assert.equal(result.details.ok, true, result.content[0].text);
			sent = await later;
			assert.equal(sent.select, false);
			assert.equal(sent.transcript, undefined);
			assert.equal(sent.shown, undefined);
			assert.equal(sent.output, "later");
			assert.equal((await repl.list()).activeSessionName, c);

			// A failed send still tells the page what Studio selected; input that can't be sent doesn't count.
			await repl.choose("pi-repl-julia", "julia");
			const busy = await acquireReplSessionSendLease(record, { root: recordRoot, owner: "c74-test", waitMs: 1_000 });
			try {
				const told = repl.broadcastState(p);
				result = await rpc.agent("studio_repl_send", { sessionName: p, code: "print('busy')", timeoutMs: 1_000 });
				assert.match(result.content[0].text, /busy in another compatible client/);
				assert.equal((await told).activeRuntime, "python");
			} finally {
				await busy.release();
			}
			await repl.choose("pi-repl-julia", "julia");
			result = await rpc.agent("studio_repl_send", { sessionName: p, code: "   " });
			assert.equal(result.content[0].text, "Editor text is empty.");
			assert.equal((await repl.list()).activeSessionName, "pi-repl-julia");

			// Status, even of a named session, is no choice: a Start still selects.
			const starting = repl.start("python", slow(2));
			assert.ok(await starts(a));
			result = await rpc.agent("studio_repl_status", { sessionName: p });
			assert.match(result.content[0].text, new RegExp(`Selected: ${p} `));
			assert.equal((await starting).active, a);

			// With no session shown for the selected runtime, an unaddressed send runs nowhere.
			await repl.choose(undefined, "ghci");
			const before = tmux("capture-pane", "-p", "-t", `=${p}:`).stdout;
			result = await rpc.agent("studio_repl_send", { code: "print('nowhere')" });
			assert.equal(result.details.ok, false);
			assert.equal(result.content[0].text, "No REPL session is selected in Studio. Choose one under Session, or pass sessionName.");
			assert.equal(tmux("capture-pane", "-p", "-t", `=${p}:`).stdout, before);
		} finally {
			for (const name of [p, c, a, "pi-repl-julia"]) tmux("kill-session", "-t", `=${name}`);
		}
	});

	await t.test("a runtime Studio doesn't support gets nothing pasted into it", async () => {
		assert.equal(tmux("new-session", "-d", "-s", "pi-repl-ruby", "sleep 600").status, 0);
		tmux("set-option", "-t", "=pi-repl-ruby", "@pi_repl_runtime", "ruby");
		const sent = await repl.send("pi-repl-ruby", 'puts "hi"');
		assert.equal(sent.error, "Studio can't send code to pi-repl-ruby yet: it doesn't support that runtime.");
		assert.equal(tmux("capture-pane", "-p", "-t", "=pi-repl-ruby:").stdout.trim(), "");
	});

	await t.test("IPython: its wrapped loader echo is removed", { skip: !has("ipython") }, async () => {
		assert.equal((await repl.start("ipython")).message, "Started IPython REPL.");
		assert.equal(pane("pi-studio-repl-ipython", "#{pane_width}"), "80");
		assert.equal((await repl.send("pi-studio-repl-ipython", 'print("hello")')).output, "hello");
		await showsSummary("pi-studio-repl-ipython", 'print("a")\nprint("b")', "a\nb");
		await showsSummary("pi-studio-repl-ipython", 'print("c", end="")', "c");
		// IPython shows a value once, as Out[N]: (Oliver, 19 Oct: it used to be repeated as a bare repr).
		assert.match((await repl.send("pi-studio-repl-ipython", "1 + 1")).output, /^Out\[\d+\]: 2$/);
		assert.equal((await repl.send("pi-studio-repl-ipython", "x = 3")).output, "");
		// A trailing ; doesn't hide the value: IPython looks for it in the history, which
		// store_history=False leaves out. Shown once, as before apart from the repeat.
		assert.match((await repl.send("pi-studio-repl-ipython", "x * 2;")).output, /^Out\[\d+\]: 6$/);
		assert.equal((await repl.stop("pi-studio-repl-ipython")).message, "Stopped pi-studio-repl-ipython.");
	});

	await t.test("Julia: $ interpolation runs as written", { skip: !has("julia") }, async () => {
		assert.equal((await repl.start("julia")).message, "Started Julia REPL.");
		assert.equal((await repl.send("pi-studio-repl-julia", 'for i in 1:2\n    println("i=$i")\nend')).output, "i=1\ni=2");
		await showsSummary("pi-studio-repl-julia", 'println("a")\nprintln("b")', "a\nb");
		await showsSummary("pi-studio-repl-julia", 'print("c")', "c");
		assert.equal((await repl.stop("pi-studio-repl-julia")).message, "Stopped pi-studio-repl-julia.");
	});

	await t.test("GHCi: completion survives code that reads input and an unclosed :{", { skip: !has("ghci") }, async () => {
		assert.equal((await repl.start("ghci")).message, "Started GHCi REPL.");
		const reading = repl.send("pi-studio-repl-ghci", 'name <- getLine\nputStrLn ("got: " ++ name)');
		await sleep(1_500);
		tmux("send-keys", "-t", "=pi-studio-repl-ghci:", "studio", "Enter");
		const read = await reading;
		assert.equal(read.status, "captured");
		assert.match(read.output, /^got: studio$/m);
		const unclosed = await repl.send("pi-studio-repl-ghci", ":{\nlet f x = x + 1");
		assert.equal(unclosed.status, "captured");
		assert.equal((await repl.send("pi-studio-repl-ghci", "1 + 1")).output, "2");
		await showsSummary("pi-studio-repl-ghci", 'putStrLn "a"\nputStrLn "b"', "a\nb");
		// Output that ends mid-line still puts the done marker on a line of its own.
		await showsSummary("pi-studio-repl-ghci", 'putStr "c"', "c");
		assert.doesNotMatch(tmux("capture-pane", "-p", "-t", "=pi-studio-repl-ghci:", "-S", "-200").stdout, /touch '/, "no completion command in the pane");
		assert.equal((await repl.stop("pi-studio-repl-ghci")).message, "Stopped pi-studio-repl-ghci.");
	});

	await t.test("R and Clojure keep output that looks like their prompts", async (st) => {
		if (has("R")) {
			const [first, second] = await Promise.all([repl.start("r"), repl.start("r")]);
			assert.deepEqual([first.message, second.message].sort(), ["R REPL is already running.", "Started R REPL."], "two Starts share one session");
			assert.equal((await repl.send("pi-studio-repl-r", 'cat(">\\n")')).output, ">");
			await showsSummary("pi-studio-repl-r", 'cat("a\\n")\ncat("b\\n")', "a\nb");
			await showsSummary("pi-studio-repl-r", 'cat("c")', "c");
			assert.equal((await repl.stop("pi-studio-repl-r")).message, "Stopped pi-studio-repl-r.");
		} else st.diagnostic("R not installed");
		if (has("clojure")) {
			assert.equal((await repl.start("clojure")).message, "Started Clojure REPL.");
			assert.equal((await repl.send("pi-studio-repl-clojure", '(println "user=>")')).output, "user=>");
			await showsSummary("pi-studio-repl-clojure", '(println "a")\n(println "b")', "a\nb");
			await showsSummary("pi-studio-repl-clojure", '(print "c")', "c");
			assert.equal((await repl.stop("pi-studio-repl-clojure")).message, "Stopped pi-studio-repl-clojure.");
		} else st.diagnostic("clojure not installed");
	});

	await t.test("Shell: Stop closes it like a terminal, and nohup jobs keep running", async () => {
		assert.equal((await repl.start("shell")).message, "Started Shell REPL.");
		// Shell's Start can't recognise the user's prompt, so it doesn't wait for one, and a
		// send made at once also records the shell's startup output. This one takes it.
		await repl.send("pi-studio-repl-shell", "true");
		await showsSummary("pi-studio-repl-shell", "echo a\necho b", "a\nb");
		await showsSummary("pi-studio-repl-shell", "printf c", "c");
		const sent = await repl.send("pi-studio-repl-shell", "nohup sleep 300 >/dev/null 2>&1 &\necho \"pid=$!\"");
		const job = Number(sent.output.match(/pid=(\d+)/)?.[1]);
		leftovers.push({ pid: job, identity: identify(job) });
		assert.ok(alive(job), sent.output);
		assert.deepEqual(await repl.stop("pi-studio-repl-shell"), { message: "Closed pi-studio-repl-shell.", error: undefined });
		assert.notEqual(tmux("has-session", "-t", "=pi-studio-repl-shell").status, 0);
		await sleep(500);
		assert.ok(alive(job), "the nohup job outlives the shell");

		// Shell's plain close is for Studio's own sessions too.
		assert.equal(tmux("new-session", "-d", "-s", "pi-studio-repl-shell-human", "sleep 600").status, 0);
		assert.equal((await repl.stop("pi-studio-repl-shell-human")).error, "Studio can only stop Studio-owned REPL sessions. Use tmux or pi-repl to stop external sessions.");
		assert.equal(tmux("has-session", "-t", "=pi-studio-repl-shell-human").status, 0);
	});
});

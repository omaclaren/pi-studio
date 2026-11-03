import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createEventBus } from "../node_modules/@earendil-works/pi-coding-agent/dist/core/event-bus.js";
import { createPiReplRecordActivityLink, isPiReplSessionName, PI_REPL_RECORD_ACTIVITY_CHANNEL } from "../shared/studio-repl-activity.js";
import { createReplSelection } from "../shared/studio-repl-selection.js";

// Candidate 118: Studio's side of pi-repl's record-activity channel (D5), on Pi's own event bus.
// The listener below follows pi-repl's takeStudioRecordActivity: 0.12.0's (index.ts at e324c7c)
// with protocol 1, and with protocol 2 the report request agreed with pi-repl's session for 0.12.1,
// which answers with its report of the sessions Studio's agent used and Studio's pane.
const PI_REPL_SESSION_NAME = /^pi-repl-[a-z0-9][a-z0-9-]{0,80}$/;
function piRepl(bus, protocol = 2) {
	const host = { used: new Set(), studioPane: null, own: [], reports: [] };
	bus.on("pi-repl:record-activity:v1", (data) => {
		if (!data || typeof data !== "object") return;
		const name = typeof data.sessionName === "string" && PI_REPL_SESSION_NAME.test(data.sessionName) ? data.sessionName : undefined;
		if (data.kind === "probe") {
			if (typeof data.reply === "function") data.reply({ protocol });
		} else if (data.kind === "used") {
			if (name) host.used.add(name);
		} else if (data.kind === "pane") {
			if (name || data.sessionName === null) host.studioPane = name ?? null;
		} else if (data.kind === "own") {
			if (!name || typeof data.id !== "string" || typeof data.version !== "string" || typeof data.text !== "string" || !data.text) return;
			host.own.push({ sessionName: name, id: data.id, version: data.version, text: data.text });
		} else if (data.kind === "report" && protocol >= 2 && typeof data.reply === "function") {
			const { reply, ...request } = data;
			host.reports.push(request);
			const sessions = [...new Set([...host.used, ...(host.studioPane ? [host.studioPane] : [])])];
			setTimeout(() => reply(sessions.length ? `pi-repl's report of ${sessions.join(", ")}` : ""), 5);
		}
	});
	return host;
}

test("the channel and the session names are pi-repl's", () => {
	assert.equal(PI_REPL_RECORD_ACTIVITY_CHANNEL, "pi-repl:record-activity:v1");
	for (const name of ["pi-repl-python", "pi-repl-julia", "pi-repl-lfortran", "pi-repl-r"]) assert.equal(isPiReplSessionName(name), true, name);
	for (const name of ["pi-studio-repl-python", "pi-repl-", "pi-repl-Python", "my-pi-repl-python", "pi-repl-python\n", undefined, null, 7]) assert.equal(isPiReplSessionName(name), false, String(name));
});

test("only a pi-repl that reports into Studio's results takes its sessions, on Pi's real event bus", () => {
	const bus = createEventBus();
	const link = createPiReplRecordActivityLink(bus);
	assert.equal(link.reports(), false, "no pi-repl loaded");
	piRepl(bus, 1);
	assert.equal(link.reports(), false, "pi-repl 0.12.0 answers with protocol 1, which can't");
	const later = createEventBus();
	piRepl(later);
	assert.equal(createPiReplRecordActivityLink(later).reports(), true);
	// A bus that throws, or none, is no answer.
	assert.equal(createPiReplRecordActivityLink({ emit() { throw new Error("broken"); } }).reports(), false);
	assert.equal(createPiReplRecordActivityLink(undefined).reports(), false);
});

test("used and pane reach a pi-repl that reports, as it takes them, and nothing reaches 0.12.0", () => {
	const bus = createEventBus();
	const host = piRepl(bus);
	const link = createPiReplRecordActivityLink(bus);
	link.used("pi-repl-python");
	link.used("pi-studio-repl-julia");
	assert.deepEqual([...host.used], ["pi-repl-python"], "only pi-repl's sessions");
	link.pane("pi-repl-julia");
	assert.equal(host.studioPane, "pi-repl-julia");
	link.pane("pi-studio-repl-python");
	assert.equal(host.studioPane, null, "a Studio session in the pane is none of pi-repl's");

	const old = createEventBus();
	const before = piRepl(old, 1);
	const heard = [];
	old.on("pi-repl:record-activity:v1", (data) => heard.push(data.kind));
	const oldLink = createPiReplRecordActivityLink(old);
	oldLink.used("pi-repl-python");
	oldLink.pane("pi-repl-python");
	assert.deepEqual([...before.used], []);
	assert.equal(before.studioPane, null);
	assert.ok(heard.every((kind) => kind === "probe"), "only probes");
});

test("the pane is told only when it changes", () => {
	const sent = [];
	const link = createPiReplRecordActivityLink({ emit: (channel, message) => (message.kind === "probe" ? message.reply({ protocol: 2 }) : sent.push([channel, message])) });
	link.pane(null);
	link.pane(null);
	link.pane("pi-repl-python");
	link.pane("pi-repl-python");
	link.pane("pi-studio-repl-python");
	link.pane(null);
	assert.deepEqual(sent.map(([, message]) => message.sessionName), [null, "pi-repl-python", null]);
	assert.ok(sent.every(([channel, message]) => channel === "pi-repl:record-activity:v1" && message.kind === "pane"));
});

test("a report comes from pi-repl, with the agent's own send to one of its sessions", async () => {
	const bus = createEventBus();
	const host = piRepl(bus);
	const link = createPiReplRecordActivityLink(bus);
	link.used("pi-repl-python");
	const own = { sessionName: "pi-repl-python", id: "pi-studio:tool:1", text: "Completed. ok", shown: ["captured"] };
	assert.equal(await link.report({ budget: 7_000, cwd: "/work", own }), "pi-repl's report of pi-repl-python");
	assert.equal(await link.report({ budget: 5_000, own: { ...own, sessionName: "pi-studio-repl-python" } }), "pi-repl's report of pi-repl-python");
	assert.deepEqual(host.reports, [
		{ kind: "report", budget: 7_000, cwd: "/work", own },
		{ kind: "report", budget: 5_000 },
	], "an own send to a Studio session isn't pi-repl's");
});

test("a report not given in time, or not as text, is none", async () => {
	const silent = createPiReplRecordActivityLink({ emit() {} }, { deadlineMs: 50 });
	const started = Date.now();
	assert.equal(await silent.report({ budget: 8_000 }), "");
	assert.ok(Date.now() - started >= 45, "waits out the deadline");
	const late = [];
	const slow = createPiReplRecordActivityLink({ emit: (_channel, message) => late.push(message.reply) }, { deadlineMs: 20 });
	assert.equal(await slow.report({ budget: 8_000 }), "");
	assert.doesNotThrow(() => late[0]("too late"));
	assert.equal(await createPiReplRecordActivityLink({ emit: (_channel, message) => message.reply({ text: "no" }) }).report({ budget: 8_000 }), "");
	// A bus that throws is none at once.
	const broken = createPiReplRecordActivityLink({ emit() { throw new Error("broken"); } }, { deadlineMs: 60_000 });
	assert.equal(await broken.report({ budget: 8_000 }), "");
});

test("the pane selection says when it changes, and only then", () => {
	const seen = [];
	const selection = createReplSelection({ onChange: (session) => seen.push(session?.sessionName ?? null) });
	const python = { sessionName: "pi-repl-python", tmuxSessionId: "$1", tmuxSessionCreatedAt: 1, runtime: "python" };
	selection.choose({ session: python });
	selection.show({ session: { ...python } });
	selection.choose({ runtime: "python" });
	selection.reconcile(selection.shown, { session: python });
	selection.resolve([]);
	assert.deepEqual(seen, ["pi-repl-python", null, "pi-repl-python", null]);
	// Without a callback, as before.
	assert.doesNotThrow(() => createReplSelection().choose({ session: python }));
});

test("Studio leaves pi-repl's sessions to it at each run's start, and each REPL result carries pi-repl's report of them", () => {
	const server = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
	assert.match(server, /const piReplActivity = createPiReplRecordActivityLink\(pi\.events\);\n\s+const studioReplSelection = createReplSelection<StudioReplSessionInfo>\(\{ onChange: \(session\) => piReplActivity\.pane\(session\?\.sessionName \?\? null\) \}\);/);
	assert.match(server, /const names = replActivitySessionNames\(piReplActivity\.reports\(\)\);/, "run start");
	assert.match(server, /const leaveToPiRepl = piReplActivity\.reports\(\);[\s\S]{0,400}const names = replActivitySessionNames\(leaveToPiRepl\);[\s\S]{0,1200}await piReplActivity\.report\(\{\n\s+budget: budget - \(studioReport \? studioReport\.length \+ 2 : 0\),/, "tool results: Studio's report has the budget, as before; pi-repl's the room left");
	assert.match(server, /return \[piReplReport, studioReport\]\.filter\(Boolean\)\.join\("\\n\\n"\);/);
	assert.equal((server.match(/useReplActivitySession\(/g) || []).length, 2, "both tools, through one helper");
	assert.doesNotMatch(server, /replActivity\.used\.add\((?:params|selected)/);
	assert.match(server, /prepareReplActivityForResult\(toolCallId, \{ sessionName: currentSession\.sessionName, id: journalEntry\.id, text, status: journalEntry\.status \}\)/);
});

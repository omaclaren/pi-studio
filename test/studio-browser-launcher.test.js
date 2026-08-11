import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import {
	getStudioCmuxBrowserOpenCommand,
	getStudioDefaultBrowserOpenCommand,
	isStudioCmuxSession,
	openStudioUrlInBrowser,
} from "../shared/studio-browser-launcher.js";

const STUDIO_URL = "http://127.0.0.1:3417/?token=abc123&docSource=blank";

function createSpawnSequence(steps) {
	const calls = [];
	const children = [];
	const spawnProcess = (command, args, options) => {
		const step = steps[calls.length];
		if (!step) throw new Error(`Unexpected spawn: ${command}`);
		calls.push({ command, args, options });
		if (step.throwError) throw step.throwError;

		const child = new EventEmitter();
		child.killedByTest = false;
		child.unrefCalled = false;
		child.kill = () => {
			child.killedByTest = true;
			return true;
		};
		child.unref = () => {
			child.unrefCalled = true;
		};
		children.push(child);
		if (step.event) {
			queueMicrotask(() => child.emit(step.event, step.value));
		}
		return child;
	};
	return { calls, children, spawnProcess };
}

test("cmux detection recognizes supported cmux environment markers", () => {
	assert.equal(isStudioCmuxSession({}), false);
	assert.equal(isStudioCmuxSession({ CMUX_WORKSPACE_ID: "workspace-1" }), true);
	assert.equal(isStudioCmuxSession({ TERM_PROGRAM: "cmux" }), true);
	assert.equal(isStudioCmuxSession({ TERM: "xterm-cmux" }), true);
	assert.equal(isStudioCmuxSession({ CMUX_BUNDLE_ID: "com.cmuxterm.app" }), true);
	assert.equal(isStudioCmuxSession({ TERM_PROGRAM: "Apple_Terminal", TERM: "xterm-256color" }), false);
});

test("cmux browser command targets and focuses the caller workspace", () => {
	assert.deepEqual(
		getStudioCmuxBrowserOpenCommand(STUDIO_URL, {
			CMUX_WORKSPACE_ID: "workspace-1",
			CMUX_BUNDLED_CLI_PATH: "/Applications/cmux.app/Contents/Resources/bin/cmux",
		}),
		{
			command: "/Applications/cmux.app/Contents/Resources/bin/cmux",
			args: ["browser", "open", STUDIO_URL, "--workspace", "workspace-1", "--focus", "true"],
		},
	);
	assert.deepEqual(
		getStudioCmuxBrowserOpenCommand(STUDIO_URL, { TERM_PROGRAM: "cmux" }),
		{ command: "cmux", args: ["browser", "open", STUDIO_URL, "--focus", "true"] },
	);
	assert.equal(getStudioCmuxBrowserOpenCommand(STUDIO_URL, {}), undefined);
});

test("system-browser commands preserve the tokenized Studio URL", () => {
	assert.deepEqual(getStudioDefaultBrowserOpenCommand(STUDIO_URL, "darwin"), { command: "open", args: [STUDIO_URL] });
	assert.deepEqual(getStudioDefaultBrowserOpenCommand(STUDIO_URL, "win32"), { command: "cmd", args: ["/c", "start", "", STUDIO_URL] });
	assert.deepEqual(getStudioDefaultBrowserOpenCommand(STUDIO_URL, "linux"), { command: "xdg-open", args: [STUDIO_URL] });
});

test("Studio opens once in cmux when the cmux CLI succeeds", async () => {
	const fake = createSpawnSequence([{ event: "close", value: 0 }]);
	const destination = await openStudioUrlInBrowser(STUDIO_URL, {
		env: { CMUX_WORKSPACE_ID: "workspace-1", CMUX_BUNDLED_CLI_PATH: "/tmp/fake-cmux" },
		platform: "darwin",
		spawnProcess: fake.spawnProcess,
		timeoutMs: 100,
	});

	assert.equal(destination, "cmux");
	assert.deepEqual(fake.calls, [{
		command: "/tmp/fake-cmux",
		args: ["browser", "open", STUDIO_URL, "--workspace", "workspace-1", "--focus", "true"],
		options: { stdio: "ignore" },
	}]);
});

test("Studio uses the system browser directly outside cmux", async () => {
	const fake = createSpawnSequence([{ event: "spawn" }]);
	const destination = await openStudioUrlInBrowser(STUDIO_URL, {
		env: {},
		platform: "darwin",
		spawnProcess: fake.spawnProcess,
	});

	assert.equal(destination, "system");
	assert.equal(fake.calls.length, 1);
	assert.deepEqual(fake.calls[0], {
		command: "open",
		args: [STUDIO_URL],
		options: { stdio: "ignore", detached: true },
	});
	assert.equal(fake.children[0].unrefCalled, true);
});

test("Studio falls back once when cmux declines the browser open", async () => {
	const fake = createSpawnSequence([
		{ event: "close", value: 1 },
		{ event: "spawn" },
	]);
	const destination = await openStudioUrlInBrowser(STUDIO_URL, {
		env: { CMUX_WORKSPACE_ID: "workspace-1" },
		platform: "linux",
		spawnProcess: fake.spawnProcess,
		timeoutMs: 100,
	});

	assert.equal(destination, "system");
	assert.deepEqual(fake.calls.map(({ command, args }) => ({ command, args })), [
		{ command: "cmux", args: ["browser", "open", STUDIO_URL, "--workspace", "workspace-1", "--focus", "true"] },
		{ command: "xdg-open", args: [STUDIO_URL] },
	]);
});

test("Studio falls back when the cmux executable is unavailable", async () => {
	const fake = createSpawnSequence([
		{ event: "error", value: new Error("spawn cmux ENOENT") },
		{ event: "spawn" },
	]);
	const destination = await openStudioUrlInBrowser(STUDIO_URL, {
		env: { TERM_PROGRAM: "cmux" },
		platform: "darwin",
		spawnProcess: fake.spawnProcess,
		timeoutMs: 100,
	});

	assert.equal(destination, "system");
	assert.deepEqual(fake.calls.map(({ command }) => command), ["cmux", "open"]);
});

test("Studio kills a stalled cmux launch before falling back", async () => {
	const fake = createSpawnSequence([
		{},
		{ event: "spawn" },
	]);
	// A real child process keeps Node alive while the launch timeout is unref'ed.
	// Keep this process-only test alive in the same way until the fallback settles.
	const keepAlive = setTimeout(() => {}, 100);
	try {
		const destination = await openStudioUrlInBrowser(STUDIO_URL, {
			env: { TERM_PROGRAM: "cmux" },
			platform: "darwin",
			spawnProcess: fake.spawnProcess,
			timeoutMs: 5,
		});

		assert.equal(destination, "system");
		assert.equal(fake.children[0].killedByTest, true);
		assert.equal(fake.calls[1].command, "open");
	} finally {
		clearTimeout(keepAlive);
	}
});

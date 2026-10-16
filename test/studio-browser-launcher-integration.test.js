import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import vm from "node:vm";
import ts from "typescript";
import { openStudioUrlInBrowser } from "../shared/studio-browser-launcher.js";
import { createStudioBufferServerStore } from "../shared/studio-buffer-server.js";
import { resolveStudioHostingPage } from "../shared/studio-document-entrypoints.js";

// Exercise the production URL builders without booting Pi or duplicating their
// parameter ordering/encoding. These functions only depend on the advertised host.
const source = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
const start = source.indexOf("function buildStudioRelativeUrl(");
const end = source.indexOf("interface StudioLaunchFlags", start);
assert.ok(start >= 0 && end > start);
const { buildStudioUrl } = vm.runInNewContext(
	ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
		+ "\n({ buildStudioUrl })",
	{ URLSearchParams, STUDIO_ADVERTISED_HOST: "127.0.0.1" },
);

function registeredWorkspaces() {
	const store = createStudioBufferServerStore({ hosting: { requireView: true, canonicalPath: path => path } });
	const bootstrap = store.hostingBootstrap({}, () => ({
		ok: true, document: { text: "Retained Prompt work", source: "blank", label: "Prompt" },
	}));
	assert.ok(bootstrap.ok);
	const fullId = bootstrap.owner.workspaceId;
	const capability = store.issue({ workspaceId: fullId, mode: "full" }).capability;
	const generation = store.bindHostingView(capability, "full", {}).generation;
	const current = store.read(capability);
	const document = current.state.buffers.find(buffer => buffer.role === "document");
	const launched = store.hostingLaunch(capability, {
		operationId: "1".repeat(48), kind: "blank", path: "", sourcePath: "", resourceDir: "",
		bufferId: document.id, documentEpoch: current.documents[document.id],
		expectedRevision: current.revision, generation,
	});
	assert.ok(launched.ok);
	return { store, fullId, editorId: launched.workspaceId };
}

async function checkLaunch(t, { native = false, mode = "full", hosted = true } = {}) {
	const { store, fullId, editorId } = registeredWorkspaces();
	const workspaceId = mode === "full" ? fullId : editorId;
	const before = store.hostedWorkspace(workspaceId);
	// Synthetic token and file hints cover characters that cmd expands or splits,
	// plus spaces, Unicode, literal percent sequences, quotes and backslashes.
	const token = "test-token&+/%PI_STUDIO_LAUNCH_TEST%!^=\"'";
	const doc = hosted ? undefined : {
		source: "file", label: "Māori notes & 100% + (draft).md",
		path: "C:\\notes & drafts\\Māori %20%\\notes.md", resourceDir: "C:\\notes & drafts", draftId: "draft&+%",
	};
	const policy = requestUrl => resolveStudioHostingPage({
		enabled: hosted, requestUrl, mode: requestUrl.searchParams.get("mode") || "full",
		workspace: id => store.hostedWorkspace(id), transient: () => null,
	});
	let received;
	const requestReceived = new Promise(resolve => { received = resolve; });
	const server = createServer((request, response) => {
		const requestUrl = new URL(request.url, "http://127.0.0.1");
		if (requestUrl.pathname !== "/") { response.writeHead(404); response.end(); return; }
		const page = policy(requestUrl);
		const status = requestUrl.searchParams.get("token") !== token ? 403 : page.ok ? 200 : 409;
		response.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Connection": "close", "Cache-Control": "no-store" });
		response.end(status === 200 ? "<!doctype html><title>Studio launch check</title><p>Studio URL received intact.</p>" : "Studio launch check failed.");
		received({ requestUrl, page, status });
	});
	t.after(async () => {
		server.closeAllConnections();
		await new Promise(resolve => server.close(resolve));
	});
	await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
	const target = buildStudioUrl(server.address().port, token, mode, doc, hosted ? undefined : "doc&+%", hosted
		? { hostedWorkspaceId: workspaceId } : { skipWorkspaceRestore: true, paneFocus: "right" });
	const expected = new URL(target);
	let timer;
	try {
		const observed = Promise.race([
			requestReceived,
			new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("No browser request reached the launch check")), native ? 30_000 : 5_000); }),
		]);
		// Observe the timeout immediately, including if launching itself rejects.
		observed.catch(() => {});
		const destination = await openStudioUrlInBrowser(target, {
			env: {}, platform: "win32",
			...(native ? {} : { spawnProcess(command, args, options) {
				assert.equal(command, "rundll32.exe", "Windows URLs must bypass cmd and PowerShell");
				assert.equal(options.shell, false);
				// Substitute only the OS URL handler. A real child receives its argv
				// and makes an HTTP request, so this goes beyond an argument-array mock.
				const child = spawn(process.execPath, ["-e", `
					if (process.argv.length !== 3 || process.argv[1] !== "url.dll,FileProtocolHandler") process.exit(2);
					require("node:http").get(process.argv[2], response => { response.resume(); }).on("error", () => process.exit(3));
				`, "--", ...args], options);
				t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill(); });
				return child;
			} }),
		});
		assert.equal(destination, "system");
		const { requestUrl, page, status } = await observed;
		assert.equal(status, 200);
		assert.equal(requestUrl.pathname + requestUrl.search, expected.pathname + expected.search);
		assert.equal(requestUrl.searchParams.get("token"), token);
		if (hosted) {
			assert.equal(page.workspaceId, workspaceId);
			assert.deepEqual(page.state, before);
			assert.equal(requestUrl.searchParams.get("studioTabState"), workspaceId);
			assert.equal(requestUrl.searchParams.get("hostedWorkspace"), workspaceId);
			// This is the reported failure: cmd keeps the first token field but
			// loses the registered workspace (and editor-only mode) after '&'.
			const truncated = new URL(target.split("&", 1)[0]);
			assert.equal(truncated.searchParams.get("token"), token);
			const refused = policy(truncated);
			assert.equal(refused.ok, false);
			assert.match(refused.message, /editing URL is not registered in dual editor mode/);
		} else {
			assert.equal(page.legacy, true);
			for (const [key, value] of Object.entries({ docSource: doc.source, docLabel: doc.label, docPath: doc.path, resourceDir: doc.resourceDir, draftId: doc.draftId })) {
				assert.equal(requestUrl.searchParams.get(key), value);
			}
		}
		assert.deepEqual(store.hostedWorkspace(workspaceId), before, "opening or refusing a URL must retain existing work");
	} finally {
		clearTimeout(timer);
	}
}

for (const [name, options] of [
	["dual-editor workspace", {}],
	["standalone Document window", { mode: "editor-only" }],
	["single-editor file hints", { hosted: false, mode: "editor-only" }],
]) {
	test(`Windows launch subprocess preserves the complete URL for ${name}`, { timeout: 10_000 }, t => checkLaunch(t, options));
}

// Explicit opt-in only: this opens two real tabs in the Windows default browser.
// No default-browser setting or protocol registration is changed.
test("native Windows default browser preserves full and Document workspace URLs", {
	skip: process.platform !== "win32" || process.env.PI_STUDIO_TEST_NATIVE_BROWSER !== "1"
		? "Requires interactive Windows and PI_STUDIO_TEST_NATIVE_BROWSER=1 (opens two browser tabs)" : false,
	timeout: 70_000,
}, async t => {
	await t.test("full workspace", t => checkLaunch(t, { native: true }));
	await t.test("Document window", t => checkLaunch(t, { native: true, mode: "editor-only" }));
});

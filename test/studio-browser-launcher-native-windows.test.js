import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { openStudioUrlInBrowser } from "../shared/studio-browser-launcher.js";

// Opt-in only, on interactive Windows: it opens one tab in the default browser and
// checks the URL arrives whole (#5). No browser setting or protocol is changed.
// The unit tests pin the command; only this shows rundll32 and the browser deliver it.
test("Windows' default browser receives the whole Studio URL", {
	skip: process.platform !== "win32" || process.env.PI_STUDIO_TEST_NATIVE_BROWSER !== "1"
		? "Needs interactive Windows and PI_STUDIO_TEST_NATIVE_BROWSER=1 (opens a browser tab)" : false,
	timeout: 45_000,
}, async (t) => {
	let received;
	const request = new Promise((resolve) => { received = resolve; });
	const server = createServer((req, res) => {
		res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", Connection: "close", "Cache-Control": "no-store" });
		res.end("<!doctype html><title>Studio launch check</title><p>Received. You can close this tab.</p>");
		const url = new URL(req.url, "http://127.0.0.1");
		if (url.pathname === "/") received(url);
	});
	t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
	await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });

	// What cmd would split at & or expand at %NAME%, with spaces, Unicode and a Windows path.
	const fields = {
		token: "test-token&+/%PATH%!^=\"'",
		mode: "editor-only",
		studioTabState: "workspace&1",
		hostedWorkspace: "workspace&1",
		docPath: "C:\\notes & drafts\\Māori %20%\\notes.md",
	};
	const target = `http://127.0.0.1:${server.address().port}/?${new URLSearchParams(fields)}`;
	assert.equal(await openStudioUrlInBrowser(target, { env: {}, platform: "win32" }), "system");
	// url.dll reports no errors of its own, so only the browser's request shows delivery.
	let timer;
	const arrived = await Promise.race([
		request,
		new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("No request from the browser within 30 s")), 30_000); }),
	]).finally(() => clearTimeout(timer));
	for (const [key, value] of Object.entries(fields)) assert.equal(arrived.searchParams.get(key), value, key);
});

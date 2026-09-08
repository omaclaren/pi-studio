import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import puppeteer from "puppeteer-core";

// Native browser-module/sessionStorage harness, not a mock or a new production UI.
const scripts = new Map(["studio-buffer-store.js", "studio-buffer-recovery.js"].map(name => ["/" + name, readFileSync(new URL("../shared/" + name, import.meta.url), "utf8")]));
const browserExecutable = [process.env.PUPPETEER_EXECUTABLE_PATH,
	"/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
].filter(Boolean).find(path => existsSync(path));

test("buffer modules migrate and reconstruct using native sessionStorage without leaking across tabs", { timeout: 30_000 }, async () => {
	assert(browserExecutable, "Set PUPPETEER_EXECUTABLE_PATH to a Chromium browser.");
	const server = createServer((req, res) => {
		const body = scripts.get(req.url);
		res.writeHead(body || req.url === "/" ? 200 : 404, { "Content-Type": body ? "application/javascript" : "text/html", "Cache-Control": "no-store" });
		res.end(body || "<!doctype html><html><body>Buffer foundation test harness</body></html>");
	});
	let browser;
	const errors = [];
	try {
		await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
		const origin = `http://127.0.0.1:${server.address().port}`;
		browser = await puppeteer.launch({ executablePath: browserExecutable, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
		const page = await browser.newPage();
		page.on("pageerror", e => errors.push(e.message));
		await page.goto(origin);
		const initial = await page.evaluate(async () => {
			const { createStudioBufferStore } = await import("/studio-buffer-store.js");
			const { createStudioBufferRecoveryStorage } = await import("/studio-buffer-recovery.js");
			const adapter = createStudioBufferRecoveryStorage({ storage: sessionStorage, workspaceId: "tab_" + "a".repeat(32), mode: "full" });
			const v1 = JSON.stringify({ version: 1, savedAt: 1, text: "unsaved old file", diskRevision: "sha256:" + "a".repeat(64),
				sourceState: { source: "file", label: "notes ü.qmd", path: "/tmp/notes ü.qmd", draftId: null }, rightView: "editor-quarto-preview" });
			sessionStorage.setItem(adapter.legacyKey, v1);
			let id = 0;
			const migrated = adapter.migrateLegacy({ expectedLegacyRaw: v1, makeBufferId: () => "b" + ++id });
			if (!migrated.ok) throw new Error(migrated.message);
			const store = createStudioBufferStore(migrated.state);
			const documentId = store.snapshot().selectedBufferId;
			store.update(documentId, 0, { text: "new unsaved text\n😀", view: { ...store.get(documentId).view, selectionStart: 1, selectionEnd: 5, scrollTop: 12.5 } });
			store.beginOperation(documentId, "pending-preview");
			const saved = adapter.write(store.snapshot(), { expectedRaw: migrated.raw });
			return { ok: saved.ok, legacyKept: sessionStorage.getItem(adapter.legacyKey) === v1, pending: store.pendingOperationCount, doc: documentId, prompt: store.snapshot().activePromptId };
		});
		assert(initial.ok);
		assert(initial.legacyKept);
		assert.equal(initial.pending, 1);
		assert.notEqual(initial.doc, initial.prompt);
		await page.reload();
		const recovered = await page.evaluate(async () => {
			const { createStudioBufferStore, isStudioBufferDirty } = await import("/studio-buffer-store.js");
			const { createStudioBufferRecoveryStorage } = await import("/studio-buffer-recovery.js");
			const adapter = createStudioBufferRecoveryStorage({ storage: sessionStorage, workspaceId: "tab_" + "a".repeat(32), mode: "full" });
			const result = adapter.read();
			if (!result.ok) throw new Error(result.message);
			const store = createStudioBufferStore(result.state), doc = store.get(result.state.selectedBufferId);
			return { text: doc.text, dirty: isStudioBufferDirty(doc), revision: doc.diskRevision, view: doc.view, doc: doc.id, prompt: result.state.activePromptId, pending: store.pendingOperationCount };
		});
		assert.equal(recovered.text, "new unsaved text\n😀");
		assert(recovered.dirty);
		assert.equal(recovered.revision, "sha256:" + "a".repeat(64));
		assert.equal(recovered.view.rightView, "editor-quarto-preview");
		assert.equal(recovered.view.selectionEnd, 5);
		assert.equal(recovered.view.scrollTop, 12.5);
		assert.equal(recovered.doc, initial.doc);
		assert.equal(recovered.prompt, initial.prompt);
		assert.equal(recovered.pending, 0);
		const other = await browser.newPage();
		other.on("pageerror", e => errors.push(e.message));
		await other.goto(origin);
		assert.equal(await other.evaluate(async () => {
			const { createStudioBufferRecoveryStorage } = await import("/studio-buffer-recovery.js");
			return createStudioBufferRecoveryStorage({ storage: sessionStorage, workspaceId: "tab_" + "a".repeat(32), mode: "full" }).read().status;
		}), "empty");
		const refused = await page.evaluate(async () => {
			const { createStudioBufferRecoveryStorage } = await import("/studio-buffer-recovery.js");
			const adapter = createStudioBufferRecoveryStorage({ storage: sessionStorage, workspaceId: "tab_" + "a".repeat(32), mode: "full" });
			const legacy = sessionStorage.getItem(adapter.legacyKey), future = '{"version":99,"draft":"future work"}';
			sessionStorage.setItem(adapter.key, future);
			return { reason: adapter.read().reason, futureKept: sessionStorage.getItem(adapter.key) === future, legacyKept: sessionStorage.getItem(adapter.legacyKey) === legacy };
		});
		assert.deepEqual(refused, { reason: "unsupported-version", futureKept: true, legacyKept: true });
		assert.deepEqual(errors, []);
	} finally {
		if (browser) await browser.close();
		server.closeAllConnections();
		await new Promise(resolve => server.close(resolve));
	}
});

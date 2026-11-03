import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Candidate 116: the REPL pane shows the image and PDF files an entry names, such as a saved
// plot, as pi-markdown-preview's REPL page does. The page's own functions run here unchanged,
// with the DOM stubbed.
const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../client/studio.css", import.meta.url), "utf8");
const slice = (from, to) => {
	const start = clientSource.indexOf(from);
	const end = clientSource.indexOf(to, start);
	assert.ok(start >= 0 && end > start, from);
	return clientSource.slice(start, end);
};

const id = (char) => char.repeat(64);
const v = (n) => n.toString(16).padStart(16, "0");

function page({ stick = false, stale = false } = {}) {
	const context = { console, URLSearchParams };
	vm.runInNewContext([
		"class Element { matches(selector) { return selector === 'img[data-repl-file-key]' && this.tag === 'img'; } }",
		"function unescapeHtml(text) { return text.replace(/&#39;/g, \"'\").replace(/&quot;/g, '\"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&'); }",
		"class Img extends Element { constructor(key) { super(); this.tag = 'img'; this.key = key; this.complete = false; this.naturalWidth = 0; }",
		"  getAttribute(name) { return name === 'data-repl-file-key' ? this.key : null; } replaceWith(other) { const at = critiqueViewEl.imgs.indexOf(this); critiqueViewEl.imgs[at] = other; } }",
		"class Tile extends Element { constructor(attributes) { super(); this.attributes = attributes; } getAttribute(name) { return name in this.attributes ? this.attributes[name] : null; } closest() { return this; } }",
		"const critiqueViewEl = { imgs: [], scrollTop: 0, scrollHeight: 900, html: '', classList: { remove() {} },",
		"  set innerHTML(html) { this.html = html; this.imgs = [...html.matchAll(/data-repl-file-key='([^']*)'/g)].map((match) => new Img(unescapeHtml(match[1]))); },",
		"  querySelectorAll(selector) { return selector === 'img[data-repl-file-key]' ? [...this.imgs] : []; } };",
		"let rightView = 'repl'; let panelHtml = ''; const viewed = []; const opened = []; const statuses = [];",
		`let stickNow = ${stick}; function shouldAutoStickReplView() { return stickNow; } function captureReplSenderCursor() {} function restoreReplSenderCursor() {}`,
		"function finishPreviewRender() {} function scheduleResponsePaneRepaintNudge() {} function buildReplPanelHtml() { return panelHtml; }",
		`function isReplPaneStale() { return ${stale}; } function refuseStaleReplPaneAction(message) { statuses.push(message); }`,
		"function openStudioImageFocusViewer(src, title) { viewed.push([src, title]); return true; } function openStudioTabDirect(url) { opened.push(url); }",
		"function setStatus(message) { statuses.push(message); } function getToken() { return 'tok'; } function stripStudioReplSubmissionEcho(text) { return text; }",
		"let replJournalEntries = []; const REPL_JOURNAL_MAX_ENTRIES = 300; const stored = []; const window = { localStorage: { setItem(key, value) { stored.push(value); } } };",
		slice("      function escapeHtml", "      function escapeRegExp"),
		"let replViewStuckToBottom = false;",
		slice("      function normalizeReplJournalEntry(entry) {", "      function loadPersistedReplJournalEntries"),
		slice("      function persistReplJournalEntries", "      function mergeReplJournalEntries"),
		slice("      function getReplFileUrl", "      function buildReplMirrorHtml"),
		slice("      function renderReplView() {", "      function getFileBrowserContextKey"),
		slice("      function handleReplPaneClick", "      function handleReplPaneFocusOut"),
		"globalThis.api = {",
		"  normalize: normalizeReplJournalEntry, filesHtml: buildReplEntryFilesHtml, render(html) { panelHtml = html; renderReplView(); },",
		"  click(attributes) { handleReplPaneClick({ target: new Tile(attributes), preventDefault() {} }); },",
		"  load(target) { handleReplFileImageLoad({ target }); }, scroll(stick) { stickNow = stick; handleReplViewScroll(); }, persist(entries) { replJournalEntries = entries; persistReplJournalEntries(); return JSON.parse(stored.at(-1)); },",
		"  get imgs() { return critiqueViewEl.imgs; }, get pane() { return critiqueViewEl; }, viewed, opened, statuses,",
		"};",
	].join("\n"), context);
	return context.api;
}

const plain = (value) => JSON.parse(JSON.stringify(value));

test("an entry keeps the files Studio found for it, checked and bounded, and none are stored", () => {
	const p = page();
	const files = [
		{ id: id("a"), written: "out/fit.png", image: true, v: v(1) },
		{ id: id("b"), written: "report.pdf", image: false, v: v(2) },
		{ id: "not-a-route", written: "x.png", image: true, v: v(3) },
		{ id: id("c"), written: "", image: true, v: v(4) },
		{ id: id("d"), written: "y.png", image: true, v: 1700000000123 },
		{ id: id("e"), written: "z.png", image: true, v: "&v=../x" },
		null,
	];
	const entry = p.normalize({ id: "e1", code: "savefig('out/fit.png')", output: "", files });
	assert.deepEqual(plain(entry.files), [
		{ id: id("a"), written: "out/fit.png", image: true, v: v(1) },
		{ id: id("b"), written: "report.pdf", image: false, v: v(2) },
	]);
	assert.deepEqual(plain(p.normalize({ id: "e2", code: "1", files: "x" }).files), []);
	const many = p.normalize({ id: "e3", code: "1", files: Array.from({ length: 9 }, (_, index) => ({ id: id(String(index)), written: `p${index}.png`, image: true, v: v(index) })) });
	assert.equal(many.files.length, 6);
	assert.equal("files" in p.persist([entry])[0], false, "Found anew each time Studio sends the entry, not kept in the browser.");
});

test("one tile a file, images first, named inside the tile, each by its route with this page's token", () => {
	const p = page();
	assert.equal(p.filesHtml({ files: [] }), "");
	assert.equal(p.filesHtml({}), "");
	const html = p.filesHtml({ files: [
		{ id: id("b"), written: "/tmp/<fit>'s.pdf", image: false, v: v(2) },
		{ id: id("a"), written: "out/<fit>.png", image: true, v: v(1) },
	] });
	const pngUrl = `/repl-file?token=tok&amp;id=${id("a")}&amp;v=${v(1)}`;
	const pdfUrl = `/repl-file?token=tok&amp;id=${id("b")}&amp;v=${v(2)}`;
	assert.equal(html, "<div class='repl-studio-files'>"
		+ `<button type='button' class='repl-studio-file' data-repl-action='file-view' data-repl-file-url='${pngUrl}' data-repl-file-name='&lt;fit&gt;.png' title='out/&lt;fit&gt;.png'>`
		+ `<img class='repl-studio-file-img' src='${pngUrl}' alt='out/&lt;fit&gt;.png' data-repl-file-key='${pngUrl}'><span class='repl-studio-file-name'>&lt;fit&gt;.png</span></button>`
		+ `<button type='button' class='repl-studio-file repl-studio-file-other' data-repl-action='file-open' data-repl-file-url='${pdfUrl}' data-repl-file-name='&lt;fit&gt;&#39;s.pdf' title='/tmp/&lt;fit&gt;&#39;s.pdf'>`
		+ "<span class='repl-studio-file-format'>PDF</span><span class='repl-studio-file-name'>&lt;fit&gt;&#39;s.pdf</span></button>"
		+ "</div>");
	// Each entry's card shows its files after its output.
	assert.match(clientSource, /\+ output\n\s+\+ buildReplEntryFilesHtml\(entry\)\n\s+\+ pending\n/);
	assert.match(cssSource, /\.repl-studio-file-img \{[^}]*max-height: 420px;/);
	assert.match(cssSource, /\.repl-journal-list \.repl-studio-file \{[^}]*max-width: min\(100%, 640px\);/);
});

test("a redraw keeps the thumbnails already loaded, so they don't flicker; others load anew", () => {
	const p = page();
	const tile = (char, version = 1) => p.filesHtml({ files: [{ id: id(char), written: `${char}.png`, image: true, v: v(version) }] });
	p.render(tile("a") + tile("b") + tile("a"));
	const [first, second, repeat] = p.imgs;
	first.complete = true; first.naturalWidth = 640;
	second.complete = true; second.naturalWidth = 0;
	repeat.complete = true; repeat.naturalWidth = 640;
	p.render(tile("a") + tile("b") + tile("a"));
	assert.equal(p.imgs[0], first, "Loaded: the same image, moved into the new pane.");
	assert.notEqual(p.imgs[1], second, "Not loaded (or broken): a fresh image.");
	assert.notEqual(p.imgs[2], first, "An image is kept in one place only.");
	p.render(tile("a", 2));
	assert.notEqual(p.imgs[0], first, "A file saved again has a new route, so it loads again.");
});

test("a thumbnail that loads later keeps a pane drawn at its bottom there; otherwise the pane stays put", () => {
	const stuck = page({ stick: true });
	stuck.render(stuck.filesHtml({ files: [{ id: id("a"), written: "a.png", image: true, v: v(1) }] }));
	stuck.pane.scrollTop = 0;
	stuck.pane.scrollHeight = 1400;
	stuck.load(stuck.imgs[0]);
	assert.equal(stuck.pane.scrollTop, 1400);
	stuck.pane.scrollTop = 0;
	stuck.load({});
	assert.equal(stuck.pane.scrollTop, 0, "Only the pane's own thumbnails.");
	const reading = page({ stick: false });
	reading.render(reading.filesHtml({ files: [{ id: id("a"), written: "a.png", image: true, v: v(1) }] }));
	reading.pane.scrollTop = 120;
	reading.load(reading.imgs[0]);
	assert.equal(reading.pane.scrollTop, 120);
	// Round 2 (Sol's note): drawn at the bottom, then scrolled up before the thumbnail loads.
	const scrolled = page({ stick: true });
	scrolled.render(scrolled.filesHtml({ files: [{ id: id("a"), written: "a.png", image: true, v: v(1) }] }));
	scrolled.pane.scrollTop = 120;
	scrolled.scroll(false);
	scrolled.load(scrolled.imgs[0]);
	assert.equal(scrolled.pane.scrollTop, 120, "The person's scroll wins.");
	scrolled.scroll(true);
	scrolled.pane.scrollHeight = 1600;
	scrolled.load(scrolled.imgs[0]);
	assert.equal(scrolled.pane.scrollTop, 1600, "Back at the bottom, it's kept there again.");
	assert.match(clientSource, /critiqueViewEl\.addEventListener\("scroll", handleReplViewScroll, \{ passive: true \}\);/);
	assert.match(clientSource, /critiqueViewEl\.addEventListener\("load", handleReplFileImageLoad, true\);/, "load doesn't bubble: it's caught on the way down.");
});

test("an image opens in Studio's image viewer and a PDF in a new tab, even in a pane drawn for another session", () => {
	const p = page({ stale: true });
	const url = `/repl-file?token=tok&id=${id("a")}&v=1`;
	p.click({ "data-repl-action": "file-view", "data-repl-file-url": url, "data-repl-file-name": "fit.png" });
	p.click({ "data-repl-action": "file-open", "data-repl-file-url": url, "data-repl-file-name": "report.pdf" });
	assert.deepEqual(plain(p.viewed), [[url, "fit.png"]]);
	assert.deepEqual(plain(p.opened), [url]);
	assert.deepEqual(plain(p.statuses), [], "Looking changes nothing, so a stale pane doesn't refuse it.");
	p.click({ "data-repl-action": "file-open", "data-repl-file-url": "https://example.com/x.pdf" });
	p.click({ "data-repl-action": "file-view", "data-repl-file-url": "javascript:alert(1)" });
	assert.equal(p.opened.length + p.viewed.length, 2, "Only Studio's own file routes.");
	// Studio's route is never taken for a local file link.
	assert.match(clientSource, /if \(\/\^\\\/\(\?:repl-file\|pdf-resource\|/);
});

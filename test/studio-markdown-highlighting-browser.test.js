import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import puppeteer from "puppeteer-core";
import { dedicatedTestBrowser } from "./dedicated-test-browser.js";
import { buildStudioPrismScript, buildStudioSyntaxModuleScript, rewriteStudioSyntaxImports, STUDIO_SYNTAX_MODULES } from "../shared/studio-syntax-assets.js";

const client = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
function section(name) {
  const start = client.indexOf("      function " + name + "(");
  return client.slice(start, client.indexOf("\n      function ", start + 10));
}
const resources = new Map([
  ["/prism.js", buildStudioPrismScript()],
  ...["studio-annotation-helpers.js", "studio-syntax-highlighting.js", "studio.css"].map((name) =>
    ["/" + name, rewriteStudioSyntaxImports(readFileSync(new URL("../client/" + name, import.meta.url), "utf8"), "browser-test")]),
  ...Object.keys(STUDIO_SYNTAX_MODULES).map((path) => [path, buildStudioSyntaxModuleScript(path, "browser-test")]),
]);

const html = `<!doctype html><html><head><link rel="stylesheet" href="/studio.css"><style>
:root { --text: #d8dee9; --muted: #8a94a4; --panel: #20242d; --md-heading: #9ac9ff; --md-code: #e7c787; --accent: #c6a0f6; --accent-soft: #372b48; --syntax-keyword: #c792ea; --syntax-string: #a6d189; --syntax-number: #ef9f76; --syntax-function: #8caaee; --syntax-type: #e5c890; --syntax-variable: #81c8be; --font-mono: monospace; --studio-editor-font-size: 15px; --editor-review-note-gutter-width: 0px; --editor-line-number-gutter-width: 0px; }
body { display: block; padding: 24px; background: #20242d; color: var(--text); }
#sourceEditorWrap { position: relative; display: flex; height: 400px; width: 370px; background: #20242d; }
#sourceText { width: 100%; height: 100%; font-family: var(--font-mono); tab-size: 2; }
</style></head><body><h2>Raw Markdown highlighting</h2><p>Syntax stays visible and editable.</p>
<div id="sourceEditorWrap"><pre id="sourceHighlight" class="editor-highlight"></pre><textarea id="sourceText" class="highlight-active" spellcheck="false"></textarea></div>
<script src="/studio-annotation-helpers.js"></script><script src="/prism.js"></script><script type="module">
const syntaxHighlighter = await import('/studio-syntax-highlighting.js');
const annotationHelpers = globalThis.PiStudioAnnotationHelpers;
const sourceTextEl = document.getElementById('sourceText'), sourceHighlightEl = document.getElementById('sourceHighlight');
let annotationsEnabled = true, editorHighlightEnabled = true, editorView = 'markdown', editorLanguage = 'markdown', editorWrapCompositionActive = false;
const EDITOR_HIGHLIGHT_MAX_CHARS = 100000, reviewNoteGutterEl = null, lineNumberGutterEl = null;
const normalizeFenceLanguage = value => ({py:'python',js:'javascript'}[value.trim()] || value.trim());
${["highlightMarkdown", "renderEditorHighlightNow", "syncEditorHighlightScroll", "repairEditorTextareaWrap"].map(section).join("\n")}
sourceTextEl.addEventListener('input', event => { renderEditorHighlightNow(); repairEditorTextareaWrap(event); });
sourceTextEl.addEventListener('scroll', syncEditorHighlightScroll);
function setText(text) { sourceTextEl.value = text; renderEditorHighlightNow(); repairEditorTextareaWrap(); }
Object.assign(globalThis, { sourceTextEl, sourceHighlightEl, setText, syncEditorHighlightScroll, renderEditorHighlightNow });
</script></body></html>`;

test("native raw editor preserves text, styling, wrapping, selection and scroll", { timeout: 30_000 }, async () => {
  const executable = dedicatedTestBrowser();
  assert.ok(executable.ok, executable.message);
  const server = createServer((request, response) => {
    const path = new URL(request.url, "http://127.0.0.1").pathname;
    const resource = resources.get(path);
    response.writeHead(resource || path === "/" ? 200 : 404, {
      "Content-Type": path.endsWith(".css") ? "text/css" : resource ? "application/javascript" : "text/html",
    });
    response.end(resource || html);
  });
  let browser;
  try {
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    browser = await puppeteer.launch({ executablePath: executable.path, headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => typeof setText === 'function');
    const sample = "# Heading\n\n**Bold** and *italic* with ~~removed~~ text.\n\n[an: Keep this comment visible.]\n\n~~~python\ndef answer():\n    return 42\n~~~\n";
    await page.evaluate((text) => setText(text), sample);
    const styles = await page.evaluate(() => {
      const style = (selector) => getComputedStyle(sourceHighlightEl.querySelector(selector));
      return { text: sourceHighlightEl.textContent, value: sourceTextEl.value,
        bold: style('.tok-strong').fontWeight, italic: style('.tok-emphasis').fontStyle,
        heading: style('.tok-heading').color, normal: getComputedStyle(sourceHighlightEl).color,
        comment: sourceHighlightEl.querySelector('.hl-annotation').textContent,
        keyword: style('.token.keyword').color };
    });
    assert.equal(styles.text, sample);
    assert.equal(styles.value, sample);
    assert.equal(styles.bold, "700");
    assert.equal(styles.italic, "italic");
    assert.notEqual(styles.heading, styles.normal);
    assert.notEqual(styles.keyword, styles.normal);
    assert.equal(styles.comment, "[an: Keep this comment visible.]");
    if (process.env.STUDIO_HIGHLIGHT_SCREENSHOT) await page.screenshot({ path: process.env.STUDIO_HIGHLIGHT_SCREENSHOT });

    const wrapped = ("**A long bold passage** with *italic words* and `code` that must wrap beside its editable source.\n").repeat(25);
    for (const width of [285, 370, 640]) {
      const sizes = await page.evaluate(({ text, width }) => {
        document.getElementById('sourceEditorWrap').style.width = width + 'px';
        setText(text);
        sourceTextEl.focus();
        sourceTextEl.setSelectionRange(12, 22, 'backward');
        sourceTextEl.scrollTop = 100;
        syncEditorHighlightScroll();
        renderEditorHighlightNow();
        return { text: sourceHighlightEl.textContent, value: sourceTextEl.value,
          height: sourceTextEl.scrollHeight, overlayHeight: sourceHighlightEl.scrollHeight,
          scroll: sourceTextEl.scrollTop, overlayScroll: sourceHighlightEl.scrollTop,
          start: sourceTextEl.selectionStart, end: sourceTextEl.selectionEnd,
          direction: sourceTextEl.selectionDirection, focused: document.activeElement === sourceTextEl };
      }, { text: wrapped, width });
      assert.equal(sizes.text, wrapped);
      assert.equal(sizes.value, wrapped);
      assert.ok(Math.abs(sizes.height - sizes.overlayHeight) <= 1, `wrap height at ${width}px: ${JSON.stringify(sizes)}`);
      assert.equal(sizes.scroll, sizes.overlayScroll);
      assert.deepEqual([sizes.start, sizes.end, sizes.direction, sizes.focused], [12, 22, "backward", true]);
    }
    await page.keyboard.type("replacement");
    assert.equal(await page.evaluate(() => sourceHighlightEl.textContent === sourceTextEl.value), true);
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { buildStudioPrismScript, buildStudioSyntaxModuleScript, rewriteStudioSyntaxImports, STUDIO_SYNTAX_MODULES } from "../shared/studio-syntax-assets.js";
import * as syntaxHighlighter from "../client/studio-syntax-highlighting.js";

const client = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const shell = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
const context = vm.createContext({ annotationsEnabled: true });
context.window = context;
vm.runInContext(buildStudioPrismScript(), context);
vm.runInContext(readFileSync(new URL("../client/studio-annotation-helpers.js", import.meta.url), "utf8"), context);
context.syntaxHighlighter = syntaxHighlighter;
context.annotationHelpers = context.PiStudioAnnotationHelpers;
const start = client.indexOf("      function highlightMarkdown(");
const end = client.indexOf("\n      function ", start + 10);
vm.runInContext(client.slice(start, end), context);
const languagesStart = client.indexOf("      var LANG_EXT_MAP =");
const languagesEnd = client.indexOf("      var SUPPORTED_LANGUAGES", languagesStart);
const normalizeStart = client.indexOf("      function normalizeFenceLanguage(");
const normalizeEnd = client.indexOf("\n      function ", normalizeStart + 10);
vm.runInContext(client.slice(languagesStart, languagesEnd) + client.slice(normalizeStart, normalizeEnd), context);

function textContent(html) {
  return html.replace(/<[^>]*>/g, "").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");
}

function highlight(source) {
  const html = context.highlightMarkdown(source);
  assert.equal(textContent(html), source.replace(/\r\n/g, "\n"), "highlighting must preserve editable source");
  return html;
}

test("production Markdown highlighting styles emphasis, headings, links and inline code without hiding markers", () => {
  const html = highlight("# Heading **bold** and *italic*\n\n__bold__ _italic_ ~~cut~~ `x < y` [docs](https://example.com)");
  for (const token of ["tok-heading", "tok-strong", "tok-emphasis", "tok-strikethrough", "tok-monospace", "tok-link"]) {
    assert.match(html, new RegExp('class="[^"]*\\b' + token + '\\b'));
  }
  assert.match(html, />\*\*<\/span>/);
});

test("nested emphasis is styled, escaped markers and code remain literal", () => {
  assert.match(highlight("**bold and *italic***"), /class="[^"]*tok-strong[^"]*tok-emphasis/);
  assert.doesNotMatch(highlight("\\*plain\\* `**plain**`"), /class="[^"]*\b(?:tok-strong|tok-emphasis)\b/);
});

test("annotations reuse Studio's nested-marker scanner and retain current visibility styling", () => {
  const source = "**Before [an: keep [nested] `code` and **note**] after**";
  assert.match(highlight(source), /class="hl-annotation">\[an: keep \[nested\] `code` and \*\*note\*\*\]<\/span>/);
  context.annotationsEnabled = false;
  try { assert.match(highlight(source), /class="hl-annotation-muted"/); }
  finally { context.annotationsEnabled = true; }
  assert.doesNotMatch(highlight("`[an: example]` and \\[an: escaped]"), /class="hl-annotation/);
});

for (const fence of ["```", "~~~~", "````"]) {
  test(`${fence} fences use the declared code grammar and protect Markdown/annotation examples`, () => {
    const html = highlight(`${fence}python\ndef answer():\n    return 42\n# **not Markdown** [an: example]\n${fence}`);
    assert.match(html, /class="[^"]*keyword[^\"]*">def<\/span>/);
    assert.match(html, /class="[^"]*number[^\"]*">42<\/span>/);
    assert.doesNotMatch(html, /class="(?:hl-annotation|[^"]*\b(?:tok-strong|tok-heading)\b)/);
  });
}

test("canonical Prism language names and existing extension aliases both select their grammar", () => {
  for (const language of ["ruby", "rb", "ruby linenos=1", ".ruby"]) {
    assert.match(highlight("```" + language + "\ndef answer\n  42\nend\n```"), /class="[^"]*keyword[^"]*">def<\/span>/);
  }
});

test("block code is masked before annotation collection and many inline spans stay bounded", () => {
  const original = context.annotationHelpers;
  context.annotationHelpers = { ...original, collectInlineAnnotationMarkers(line) {
    assert.doesNotMatch(line, /block-protected/, "block code must not reach the annotation scanner");
    return original.collectInlineAnnotationMarkers(line);
  } };
  try {
    const literal = "block-protected [an:".repeat(4000);
    const fenced = highlight("```unknown\n" + literal + "\n```\n[an: prose]");
    assert.equal((fenced.match(/class="hl-annotation"/g) || []).length, 1);
    const many = highlight("`code` ".repeat(5000) + "[an: note] ".repeat(5000));
    assert.equal((many.match(/class="hl-annotation"/g) || []).length, 5000);
    assert.equal((highlight("[an: before] `protected [an:` [an: after]").match(/class="hl-annotation"/g) || []).length, 2);
  } finally { context.annotationHelpers = original; }
});

test("inline code retains the annotation scanner's backtick escaping rules", () => {
  const source = '[an: `x\\`] tail]';
  assert.equal(context.annotationHelpers.collectInlineAnnotationMarkers(source).length, 0);
  assert.doesNotMatch(highlight(source), /class="hl-annotation/);
  assert.match(highlight('[an: `x`] tail]'), /class="hl-annotation/);
});

test("code tokens map through quote/list prefixes and retain multiline string state", () => {
  const quote = highlight("> ```python\n> def answer():\n>     return 42\n> ```");
  assert.match(quote, /class="[^"]*keyword[^"]*">def<\/span>/);
  assert.match(quote, /class="[^"]*keyword[^"]*">return<\/span>/);
  assert.match(quote, /class="[^"]*number[^"]*">42<\/span>/);
  const list = highlight('- item\n\n  ```python\n  text = """first\n  second"""\n  ```');
  assert.match(list, /class="[^"]*string[^"]*">[^<]*first/);
  assert.match(list, /class="[^"]*string[^"]*">second/);
});

test("unfinished annotation lines do not trigger repeated whole-document scanning", () => {
  const original = context.annotationHelpers;
  let longestInput = 0;
  context.annotationHelpers = { ...original, collectInlineAnnotationMarkers(line) {
    longestInput = Math.max(longestInput, line.length);
    return original.collectInlineAnnotationMarkers(line);
  } };
  try {
    highlight("[an:\n".repeat(20000));
    assert.equal(longestInput, 4);
  } finally { context.annotationHelpers = original; }
  assert.doesNotMatch(highlight("`code\n[an: example]\ncode`"), /class="hl-annotation/);
});

test("a shorter or different fence cannot close a longer code block", () => {
  const html = highlight("````js\nconst x = 1;\n```\n~~~\n# still code\n`````\n# Heading");
  assert.match(html, /class="[^"]*keyword[^\"]*">const<\/span>/);
  assert.equal((html.match(/class="tok-heading tok-meta/g) || []).length, 1);
});

test("unfinished and unknown-language fences remain literal code", () => {
  for (const source of ["```unknown\n**not bold**\n[an: example]", "~~~\n# not a heading", "```", "~~~~"]) {
    assert.doesNotMatch(highlight(source), /class="(?:hl-annotation|[^"]*\b(?:tok-strong|tok-heading)\b)/);
  }
});

test("source text cannot introduce HTML elements or event handlers", () => {
  const html = highlight('**safe** <img src=x onerror="alert(1)"> [an: <script>bad()</script>] &amp; &#39;');
  assert.doesNotMatch(html, /<(?:img|script)\b/);
  assert.match(html, /&lt;/);
});

test("empty lines, Unicode, tabs and trailing newlines survive highlighting", () => {
  for (const source of ["", "\n", "\n\n", "**🦉 café 中文**\t*é*\n", "a\r\n\r\nb\r\n", "    **indented code**\n"]) {
    highlight(source);
  }
});

test("syntax libraries load locally with authorized module imports and manual code highlighting", () => {
  assert.equal(context.Prism.manual, true);
  assert.ok(shell.indexOf('<script src="${annotationHelpersScriptHref}"') < shell.indexOf('<script src="${prismScriptHref}"'));
  assert.ok(shell.indexOf('<script src="${prismScriptHref}"') < shell.indexOf('<script src="${clientScriptHref}"'));
  assert.match(client, /await import\(buildAuthedStudioUrl\("\/studio-syntax-highlighting\.js"\)\)/);
  for (const path of Object.keys(STUDIO_SYNTAX_MODULES)) {
    const script = buildStudioSyntaxModuleScript(path, "test & token");
    assert.doesNotMatch(script, /from ["']@lezer\//);
  }
  assert.equal(rewriteStudioSyntaxImports('import {parser} from "@lezer/markdown";', "a&b"),
    'import {parser} from "/studio-syntax-markdown.js?token=a%26b";');
  assert.match(shell, /requestUrl\.pathname === "\/studio-prism\.js"/);
  assert.match(shell, /requestUrl\.pathname === "\/studio-syntax-highlighting\.js"/);
  assert.doesNotMatch(buildStudioPrismScript(), /https?:\/\/cdn\./);
});

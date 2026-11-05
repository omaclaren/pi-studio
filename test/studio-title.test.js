import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

import { toStudioAsciiTitle } from "../shared/studio-title.js";
import { buildStudioPendingPage } from "../shared/studio-tab-launcher.js";
import { buildStudioReadOnlyImagePage } from "../shared/studio-read-only-media.js";

// Muxy 2.3.0's browser crashed on this title, at the ellipsis (daily-dev's Muxy title test, 6 Nov).
const CAPTURED = "Reading file content… · pi Studio · daily-supervision · claude-code/claude-opus-5-5 (xhigh)";
const ASCII = /^[\x20-\x7e]*$/;

const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../index.ts", import.meta.url), "utf8");

// The same scanner as test/studio-workspace-layout.test.js: one client function's source.
function declaration(name) {
  const start = clientSource.indexOf("      function " + name + "(");
  assert(start >= 0, name);
  const open = clientSource.indexOf(") {", start) + 2; assert(open > start);
  let depth = 0, quote = null;
  for (let i = open; i < clientSource.length; i++) {
    const ch = clientSource[i];
    if (quote) { if (ch === "\\") i++; else if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "/" && clientSource[i + 1] === "/") { i = clientSource.indexOf("\n", i); continue; }
    if (ch === "{") depth++;
    if (ch === "}" && --depth === 0) return clientSource.slice(start, i + 1);
  }
  throw new Error("Missing function end: " + name);
}

function clientContext(extra = {}) {
  const c = vm.createContext({ document: { title: "" }, ...extra });
  vm.runInContext(declaration("toStudioAsciiTitle"), c);
  return c;
}

const SAMPLES = [
  CAPTURED,
  "● Response ready · NOTES.md — π Studio",
  "café “notes” – v2 ‘draft’.md",
  "日本語 メモ.md",
  "Ünïcödé́ name",
  "a b\tc\nd\r\ne",
  "😀 emoji and \ud800 a lone surrogate",
  "ﬁle Ａ ½",
  "‏‮ right-to-left",
  "−1 minus",
  "   ",
  "",
];

test("the captured crashing title becomes ASCII with its words kept", () => {
  assert.equal(toStudioAsciiTitle(CAPTURED), "Reading file content... - pi Studio - daily-supervision - claude-code/claude-opus-5-5 (xhigh)");
});

test("Studio's title marks map to readable ASCII and other characters to ?", () => {
  assert.equal(toStudioAsciiTitle("● Response ready · NOTES.md — π Studio"), "* Response ready - NOTES.md - pi Studio");
  assert.equal(toStudioAsciiTitle("café “notes” – v2 ‘draft’.md"), "cafe \"notes\" - v2 'draft'.md");
  assert.equal(toStudioAsciiTitle("日本語 メモ.md"), "? ?.md");
  assert.equal(toStudioAsciiTitle("a b\tc\nd\r\ne"), "a b c d e");
  assert.equal(toStudioAsciiTitle("😀 x"), "? x");
  assert.equal(toStudioAsciiTitle(null), "");
  assert.equal(toStudioAsciiTitle(undefined), "");
});

test("any title, including arbitrary Unicode, comes out as printable ASCII, and the client's copy agrees", () => {
  const c = clientContext();
  let seed = 7;
  const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const inputs = [...SAMPLES];
  for (let n = 0; n < 2000; n++) {
    let text = "";
    const length = Math.floor(random() * 24);
    for (let i = 0; i < length; i++) {
      const pick = random();
      const code = pick < 0.3 ? 0x20 + Math.floor(random() * 0x5f) : pick < 0.6 ? Math.floor(random() * 0x3000) : Math.floor(random() * 0x10000);
      text += String.fromCharCode(code);
    }
    inputs.push(text);
  }
  for (const input of inputs) {
    const title = toStudioAsciiTitle(input);
    assert.match(title, ASCII, JSON.stringify(input));
    assert.equal(title, title.trim());
    assert.equal(c.toStudioAsciiTitle(input), title, JSON.stringify(input));
  }
});

test("every status, attention and connection prefix in the live title becomes ASCII", () => {
  const c = clientContext();
  vm.runInContext(declaration("getTitleActionMessage"), c);
  vm.runInContext(declaration("getTitleAttentionMessage"), c);
  const kinds = ["annotation", "critique", "show-me", "direct", "compact", "send_to_editor", "get_from_editor", "clear_pi_editor", "load_git_diff", "refresh_from_disk", "save_as", "save_over", "other"];
  const prefixes = [...kinds.map(kind => c.getTitleActionMessage(kind)), ...kinds.map(kind => c.getTitleAttentionMessage(kind)), "Reconnecting…", "Connecting…", "Disconnected", "Running…"];
  assert(prefixes.some(prefix => !ASCII.test(prefix)), "the client's prefixes still use … and ●");
  for (const prefix of prefixes) assert.match(c.toStudioAsciiTitle(prefix), ASCII, prefix);
  assert.equal(c.toStudioAsciiTitle(c.getTitleAttentionMessage("direct")), "* Response ready");
  assert.equal(c.toStudioAsciiTitle(c.getTitleActionMessage("direct")), "Running...");
});

test("the live title is ASCII for the captured case and for Unicode session, model and document names", () => {
  const c = clientContext({
    modelLabel: "claude-code/claude-opus-5-5 (xhigh)",
    terminalSessionLabel: "daily-supervision",
    sourceState: null,
    isEditorOnlyMode: false,
    faviconLinkEl: null,
    getDynamicTitlePrefix: () => "Reading file content…",
    basenameForStudioPath: path => String(path).split("/").pop(),
  });
  vm.runInContext(declaration("updateDocumentTitle"), c);
  c.updateDocumentTitle();
  assert.equal(c.document.title, "Reading file content... | pi Studio | daily-supervision | claude-code/claude-opus-5-5 (xhigh)");

  Object.assign(c, {
    modelLabel: "modèle/ünï — π",
    terminalSessionLabel: "séance · 日本",
    sourceState: { path: "/notes/café 図.md" },
    isEditorOnlyMode: true,
    getDynamicTitlePrefix: () => "● Reply ready",
  });
  c.updateDocumentTitle();
  assert.equal(c.document.title, "* Reply ready | cafe ?.md - pi Studio | seance - ? | modele/uni - pi");
});

test("the pending tab's title is ASCII, and its heading keeps the ellipsis", () => {
  const html = buildStudioPendingPage({ token: "t", launchId: "12345678-1234-4234-9234-123456789abc", kind: "document", nonce: "0123456789abcdef0123456789abcdef" });
  const title = html.match(/<title>([^<]*)<\/title>/)[1];
  assert.equal(title, "Preparing Studio tab...");
  assert.match(html, /<h1 id="pendingTitle">Preparing Studio document…<\/h1>/);
});

test("the image viewer's title is ASCII, and its heading and alt text keep the name", () => {
  const dataUrl = "data:image/png;base64," + Buffer.from("x").toString("base64");
  const html = buildStudioReadOnlyImagePage({ label: "café ● 図 <1>.png", dataUrl, nonce: "a".repeat(48) });
  assert.equal(html.match(/<title>([^<]*)<\/title>/)[1], "cafe * ? &lt;1&gt;.png");
  assert.match(html, /<h1>café ● 図 &lt;1&gt;\.png<\/h1>/);
  assert.match(html, /alt="café ● 図 &lt;1&gt;\.png"/);
});

test("Studio sets a tab title only through the ASCII helper", () => {
  // The client sets document.title in one place, from the helper's result.
  assert.equal(clientSource.match(/document\.title\s*=[^=]/g)?.length, 1);
  assert.match(clientSource, /const nextTitle = toStudioAsciiTitle\(titleParts\.join\(" \| "\)\);\n\s+if \(document\.title !== nextTitle\) \{\n\s+document\.title = nextTitle;/);
  // The main page's first title, before the client replaces it.
  assert.match(indexSource, /<title>\$\{toStudioAsciiTitle\(appTitle\)\}<\/title>/);
  assert.match(indexSource, /const appTitle = isEditorOnlyMode \? "π Studio — Editor" : "π Studio";/);
  assert.equal(toStudioAsciiTitle("π Studio — Editor"), "pi Studio - Editor");
  // Every other <title> Studio serves is ASCII text or goes through the helper. The one
  // exception is the HTML export: its title is the user's own document title, in their file.
  const files = ["index.ts", "shared/studio-tab-launcher.js", "shared/studio-read-only-media.js", "client/studio-client.js"];
  const titles = files.flatMap(file => [...readFileSync(new URL("../" + file, import.meta.url), "utf8").matchAll(/<title>([^<]*)<\/title>/g)].map(match => ({ file, text: match[1] })));
  assert(titles.length >= 5);
  for (const { file, text } of titles) {
    const allowed = ASCII.test(text) && (!text.includes("${")
      || text === "${toStudioAsciiTitle(appTitle)}"
      || text === "${tabTitle}"
      || (file === "index.ts" && text === "${escapeStudioHtmlText(title)}"));
    assert(allowed, file + ": <title>" + text + "</title>");
  }
});

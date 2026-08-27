import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../client/studio.css", import.meta.url), "utf8");

function cssRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [...cssSource.matchAll(new RegExp(escaped + "\\s*\\{([\\s\\S]*?)\\}", "g"))];
  assert.ok(matches.length, "Missing CSS rule: " + selector);
  return matches.at(-1)[1];
}

function functionBlock(name, nextName) {
  const start = clientSource.indexOf("function " + name + "(");
  const end = clientSource.indexOf("function " + nextName + "(", start + 1);
  assert.ok(start >= 0 && end > start, "Missing function block: " + name);
  return clientSource.slice(start, end);
}

test("rendered Markdown headings have an explicit descending scale isolated from the app header", () => {
  assert.match(cssSource, /body > header h1\s*\{/);
  assert.match(cssSource, /body\.studio-ui-refresh > header h1\s*\{/);
  assert.doesNotMatch(cssSource, /(?:^|\n)\s*h1\s*\{/);
  assert.doesNotMatch(cssSource, /body\.studio-ui-refresh h1\s*\{/);

  const sizes = [];
  for (let level = 1; level <= 6; level += 1) {
    const rule = cssRule(`.rendered-markdown h${level}`);
    const value = Number.parseFloat(rule.match(/font-size:\s*([0-9.]+)em/)?.[1] || "");
    assert.ok(Number.isFinite(value), `H${level} needs an explicit em size.`);
    sizes.push(value);
  }
  for (let index = 1; index < sizes.length; index += 1) {
    assert.ok(sizes[index - 1] > sizes[index], `Expected H${index} to be larger than H${index + 1}.`);
  }

  const sharedRule = cssSource.match(/\.rendered-markdown h1,[\s\S]*?\.rendered-markdown h6\s*\{([\s\S]*?)\}/)?.[1] || "";
  assert.match(sharedRule, /display:\s*block;/);
});

test("Studio-owned Markdown surfaces consistently decorate images and rendered PDF figures", () => {
  const sideQuestionRender = functionBlock("renderSideQuestionMarkdownFields", "sideQuestionSelectOptions");
  assert.match(sideQuestionRender, /decoratePreviewImages\(target\)/);

  const quizRender = functionBlock("renderQuizMarkdownFields", "isQuizOpen");
  assert.match(quizRender, /decoratePreviewPdfFigures\(target\)/);
  assert.match(quizRender, /decoratePreviewImages\(target\)/);

  assert.match(clientSource, /function decoratePreviewPdfFigures\(/);
  assert.match(clientSource, /className = "studio-pdf-preview-enlarge"/);
  assert.match(clientSource, /textContent = "Enlarge"/);
  assert.match(clientSource, /openPreviewPdfFigureInFocus\(previewEl\)/);
  assert.match(cssSource, /\.studio-pdf-preview-focus-target\s*\{[\s\S]*?cursor:\s*zoom-in;/);
});

test("fullscreen controls use browser capabilities rather than host detection", () => {
  const capability = functionBlock("isStudioFullscreenAvailable", "syncStudioHtmlFocusFullscreenButton");
  assert.match(capability, /typeof element\.requestFullscreen === "function"/);
  assert.match(capability, /typeof document\.exitFullscreen === "function"/);

  for (const name of [
    "syncStudioHtmlFocusFullscreenButton",
    "syncStudioPdfFocusFullscreenButton",
    "syncStudioImageFocusFullscreenButton",
  ]) {
    const start = clientSource.indexOf("function " + name + "(");
    assert.ok(start >= 0, "Missing " + name);
    const block = clientSource.slice(start, clientSource.indexOf("\n      }", start) + 8);
    assert.match(block, /isStudioFullscreenAvailable\(/);
    assert.match(block, /hidden = !available/);
  }

  assert.doesNotMatch(clientSource, /navigator\.userAgent/);
  assert.match(cssSource, /\.studio-pdf-focus-fullscreen\[hidden\]\s*\{[\s\S]*?display:\s*none !important;/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const serverSource = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../client/studio.css", import.meta.url), "utf8");

function ruleBody(source, selector) {
  const start = source.indexOf(selector);
  assert.notEqual(start, -1, "Missing CSS selector: " + selector);
  const open = source.indexOf("{", start);
  assert.notEqual(open, -1, "Missing CSS rule body: " + selector);
  const close = source.indexOf("}", open);
  assert.notEqual(close, -1, "Missing CSS rule end: " + selector);
  return source.slice(open + 1, close);
}

test("Studio exposes explicit hide and fixed-edge restore controls for its global header", () => {
  assert.match(serverSource, /<header id="studioHeader">/);
  assert.match(serverSource, /id="hideStudioHeaderBtn"[\s\S]*?aria-controls="studioHeader"[\s\S]*?>Hide header<\/button>/);
  assert.match(serverSource, /id="studioHeaderReveal" class="studio-header-reveal" hidden/);
  assert.match(serverSource, /id="studioHeaderRevealBtn"[\s\S]*?aria-controls="studioHeader"[\s\S]*?>Show header<\/button>/);

  const hiddenHeaderRule = ruleBody(cssSource, "body.studio-header-hidden > #studioHeader,");
  assert.match(hiddenHeaderRule, /display: none !important;/);
  const revealRule = ruleBody(cssSource, ".studio-header-reveal {");
  assert.match(revealRule, /position: fixed;/);
  assert.match(revealRule, /top: 0;/);
  assert.match(revealRule, /height: 10px;/);
  const revealButtonRule = ruleBody(cssSource, ".studio-header-reveal button {");
  assert.match(revealButtonRule, /position: absolute;/);
  assert.match(revealButtonRule, /transform: translateY\(calc\(-100% \+ 5px\)\);/);
  assert.match(cssSource, /\.studio-header-reveal\.is-open button,[\s\S]*?\.studio-header-reveal:hover button,[\s\S]*?\.studio-header-reveal:focus-within button[\s\S]*?transform: translateY\(0\);/);
});

test("Zen mode hides the whole header and F9 restores it safely", () => {
  assert.match(cssSource, /body\.studio-zen-mode > #studioHeader[\s\S]*?display: none !important;/);
  assert.doesNotMatch(cssSource, /body\.studio-zen-mode > header\s*\{[\s\S]*?padding:/);
  assert.match(clientSource, /const STUDIO_HEADER_HIDDEN_STORAGE_KEY = "piStudio\.headerHidden"/);
  assert.match(clientSource, /Boolean\(studioZenModeEnabled \|\| studioHeaderHidden\)/);
  assert.match(clientSource, /studioHeaderRevealEl\.dataset\.mode = studioZenModeEnabled \? "zen" : "header"/);
  assert.match(clientSource, /const label = studioZenModeEnabled \? "Exit Zen" : "Show header"/);
  assert.match(clientSource, /if \(!studioZenModeEnabled\) \{\s*studioHeaderHidden = false;\s*persistStudioHeaderHiddenEnabled\(\);/);
  assert.match(clientSource, /focusStudioChromeControl\(wasZenMode \? zenModeBtn : hideStudioHeaderBtn\)/);
  assert.match(clientSource, /key === "F9"[\s\S]*?if \(studioZenModeEnabled\)[\s\S]*?setStudioZenMode\(false\)[\s\S]*?else if \(studioHeaderHidden\)[\s\S]*?setStudioHeaderHidden\(false\)[\s\S]*?setStudioZenMode\(true\)/);
  assert.match(serverSource, /<dt>F9<\/dt><dd>Toggle Zen mode and hide or restore the Studio header<\/dd>/);
});

test("header visibility controls persist manual state and retain keyboard focus", () => {
  assert.match(clientSource, /localStorage\.getItem\(STUDIO_HEADER_HIDDEN_STORAGE_KEY\)/);
  assert.match(clientSource, /localStorage\.setItem\(STUDIO_HEADER_HIDDEN_STORAGE_KEY, studioHeaderHidden \? "1" : "0"\)/);
  assert.match(clientSource, /studioHeaderEl\.contains\(document\.activeElement\)/);
  assert.match(clientSource, /function showStudioHeaderRevealControl\(\)[\s\S]*?classList\.add\("is-open"\)[\s\S]*?1800/);
  assert.match(clientSource, /if \(moveFocusToReveal\) showStudioHeaderRevealControl\(\)/);
  assert.match(clientSource, /hideStudioHeaderBtn\.addEventListener\("click"[\s\S]*?setStudioHeaderHidden\(true, \{ focusReveal: true \}\)/);
  assert.match(clientSource, /studioHeaderRevealEl\.addEventListener\("click"[\s\S]*?event\.target === studioHeaderRevealEl/);
  assert.match(clientSource, /studioHeaderRevealBtn\.addEventListener\("click", restoreStudioHeaderFromReveal\)/);
});

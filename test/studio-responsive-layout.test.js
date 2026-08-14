import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../client/studio.css", import.meta.url), "utf8");

function extractRuleBlock(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, "Missing CSS rule: " + marker);
  const open = source.indexOf("{", start);
  assert.notEqual(open, -1, "Missing opening brace for: " + marker);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error("Missing closing brace for: " + marker);
}

test("Studio editor controls use pane-local component breakpoints", () => {
  const toolbarBase = css.indexOf("body.studio-ui-refresh .studio-refresh-toolbar-main {");
  const leftHeaderBreakpoint = css.indexOf("@container (max-width: 680px)");
  const toolbarBreakpoint = css.indexOf("@container (max-width: 560px)");
  const rightHeaderBreakpoint = css.indexOf("@container (max-width: 440px)");

  assert.ok(toolbarBase >= 0);
  assert.ok(leftHeaderBreakpoint > toolbarBase, "Header breakpoints must follow the base toolbar rules.");
  assert.ok(toolbarBreakpoint > leftHeaderBreakpoint);
  assert.ok(rightHeaderBreakpoint > toolbarBreakpoint);

  const leftHeaderBlock = extractRuleBlock(css, "@container (max-width: 680px)");
  assert.match(leftHeaderBlock, /#leftSectionHeader \.studio-refresh-header-top/);
  assert.match(leftHeaderBlock, /#leftSectionHeader \.studio-refresh-pane-tools[^{]*\{[^}]*justify-content: flex-end/);
  assert.doesNotMatch(leftHeaderBlock, /#rightSectionHeader|\.studio-refresh-toolbar-main/);

  const toolbarBlock = extractRuleBlock(css, "@container (max-width: 560px)");
  assert.match(toolbarBlock, /\.studio-refresh-toolbar-main[^{]*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(toolbarBlock, /\.studio-refresh-toolbar-state[^{]*\{[^}]*justify-content: flex-start/);

  const rightHeaderBlock = extractRuleBlock(css, "@container (max-width: 440px)");
  assert.match(rightHeaderBlock, /#rightSectionHeader/);
  assert.match(rightHeaderBlock, /#rightSectionHeader \.studio-refresh-pane-tools[^{]*\{[^}]*justify-content: flex-end/);
  assert.doesNotMatch(rightHeaderBlock, /#leftSectionHeader|\.studio-refresh-toolbar-main/);

  assert.doesNotMatch(css, /@container \(max-width: 840px\)|@media \(max-width: 1280px\)/);
});

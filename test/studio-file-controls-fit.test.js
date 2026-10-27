import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import puppeteer from "puppeteer-core";
import { dedicatedTestBrowser } from "./dedicated-test-browser.js";

// Oliver, 27 Oct: View moved up beside File, so the running row fits narrower panes. Row 1 then has less room, and a
// long file name shortens before anything wraps. Row 1 wraps only when even a 4em name won't fit beside the tabs.
const css = readFileSync(new URL("../client/studio.css", import.meta.url), "utf8");
const LONG = "a-rather-long-document-name-2026.md";

test("row 1: View after File, and the file name shortens before the row wraps", { timeout: 60_000 }, async () => {
  const testBrowser = dedicatedTestBrowser(), executablePath = testBrowser.path;
  assert(executablePath, testBrowser.message);
  const html = `<!doctype html><html><head><meta charset='utf-8'><style>:root{--bg:#faf4ed;--panel:#fffaf3;--panel-2:#f2e9e1;--text:#575279;--muted:#797593;--panel-border:#dfdad9;--control-border:#cecacd;--accent:#56949f;} main{display:block;margin:24px;} </style></head>
<body class='studio-ui-refresh studio-workspace-layout' data-buffer-switching='1'><main><section id='leftPane'><div id='leftSectionHeader' class='section-header'>
<div class='studio-refresh-header-top studio-workspace-row-one'>
<div class='studio-refresh-title-group'><button id='leftFocusBtn' class='pane-focus-btn' type='button'>⤢</button><span class='studio-refresh-sep'></span>
<div class='studio-workspace-tabs-host'><div class='studio-buffer-tabs'><div class='studio-buffer-menu-anchor'><button type='button' aria-selected='true'>Prompt (Raw) ▾</button></div><div class='studio-buffer-menu-anchor'><button type='button' aria-selected='false'>Document</button></div></div></div></div>
<div class='studio-refresh-pane-tools studio-workspace-file-controls'>
<div class='studio-buffer-menu-anchor'><button id='studioWorkspaceFilename' class='studio-workspace-filename' type='button'>PROMPT.md</button><div class='studio-buffer-menu' hidden></div></div>
<span class='studio-refresh-menu-anchor studio-refresh-open-anchor' hidden><button class='studio-refresh-chip' type='button'>Open</button></span>
<button id='saveOverBtn' type='button'>Save</button>
<span class='studio-refresh-menu-anchor studio-refresh-context-anchor'><button id='fileBtn' class='studio-refresh-chip' type='button'>File</button><div class='studio-refresh-menu' hidden></div></span>
<span class='studio-refresh-menu-anchor studio-refresh-view-anchor'><button id='viewBtn' class='studio-refresh-chip' type='button'>View</button><div class='studio-refresh-menu' hidden></div></span>
</div></div></div></section></main></body></html>`;
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 300, deviceScaleFactor: 1 });
    await page.setContent(html); await page.addStyleTag({ content: css });
    const measure = (width, name) => page.evaluate((width, name) => {
      document.getElementById("leftPane").style.width = width + "px";
      const nameEl = document.getElementById("studioWorkspaceFilename"); nameEl.textContent = name;
      const row = document.querySelector(".studio-workspace-row-one"), title = row.querySelector(".studio-refresh-title-group");
      const anchor = nameEl.parentElement, items = [anchor, document.getElementById("saveOverBtn"), document.getElementById("fileBtn").parentElement, document.getElementById("viewBtn").parentElement];
      const r = el => el.getBoundingClientRect(), rects = items.map(r), rowRect = r(row), titleRect = r(title);
      const em = parseFloat(getComputedStyle(row.querySelector(".studio-workspace-file-controls")).fontSize);
      return {
        row: { left: rowRect.left, right: rowRect.right, width: rowRect.width }, title: { width: titleRect.width, bottom: titleRect.bottom },
        oneLine: rects.every(x => x.top < titleRect.bottom), gaps: rects.slice(1).map((x, i) => Math.round(x.left - rects[i].right)),
        name: { width: rects[0].width, button: r(nameEl).width, natural: nameEl.scrollWidth + (r(nameEl).width - nameEl.clientWidth), cut: nameEl.scrollWidth > nameEl.clientWidth },
        cqi: (() => { const pane = document.getElementById("leftPane"), style = getComputedStyle(pane); return pane.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight); })(),
        rest: rects.slice(1).reduce((sum, x) => sum + x.width, 0), em,
        viewRight: rects[3].right, minLeft: Math.min(...rects.map(x => x.left)), maxRight: Math.max(...rects.map(x => x.right)),
        heights: { controls: r(row.querySelector(".studio-workspace-file-controls")).height, tallest: Math.max(...rects.map(x => x.height)) },
      };
    }, width, name);
    for (const width of [760, 640, 560, 520, 500, 480, 440, 380]) {
      for (const name of ["PROMPT.md", LONG]) {
        const m = await measure(width, name), at = name + " at " + width + "px: " + JSON.stringify(m);
        assert.deepEqual(m.gaps, [8, 8, 8], "Save, File and View follow the name 8 px apart, with no empty room, " + at);
        assert(Math.abs(m.viewRight - m.row.right) < 1 && m.minLeft >= m.row.left - 0.5, "View ends the row and nothing spills, " + at);
        assert(Math.abs(m.heights.controls - m.heights.tallest) < 1, "the controls are one line, " + at);
        // The row stays one line while the tabs, a 4em name and the rest fit (12 px between the groups, 8 px between items).
        const fits = m.row.width >= m.title.width + 12 + 4 * m.em + m.rest + 24 - 0.5;
        assert.equal(m.oneLine, fits, "row 1 wraps only when even a 4em name won't fit, " + at);
        assert(m.name.width >= 4 * m.em - 0.5, "the name keeps at least 4em, " + at);
        // The name takes what's left, up to its own width and its cap of 180 px or 35% of the pane.
        const cap = Math.min(180, 0.35 * m.cqi), room = (m.oneLine ? m.row.width - m.title.width - 12 : m.row.width) - m.rest - 24;
        assert(Math.abs(m.name.width - Math.max(4 * m.em, Math.min(room, cap, m.name.natural))) < 1, "the name takes what's left, up to its cap, " + at);
        assert(Math.abs(m.name.button - m.name.width) < 0.5, "the name's button fills its column, " + at);
        if (name === "PROMPT.md" && m.oneLine && room >= m.name.width + 1) assert.equal(m.name.cut, false, "a short name isn't cut while there's room, " + at);
        if (name === LONG) assert.equal(m.name.cut, true, "the long name ends in …, " + at);
      }
    }
    // A very narrow pane (the divider goes to 20%): the controls wrap among themselves rather than spill.
    for (const width of [300, 240, 200]) {
      const m = await measure(width, LONG);
      assert(m.minLeft >= m.row.left - 0.5 && m.maxRight <= m.row.right + 0.5, "nothing spills at " + width + "px: " + JSON.stringify(m));
    }
  } finally { await browser?.close(); }
});

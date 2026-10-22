import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import puppeteer from "puppeteer-core";
import { dedicatedTestBrowser } from "./dedicated-test-browser.js";

// Oliver, 22 Oct: "Branch history 9/9" in the middle of the response line was hard to spot. In the new layout the
// count sits on its own at the right of the line, in the text colour, and in the accent colour while an older
// response is showing.
const css = readFileSync(new URL("../client/studio.css", import.meta.url), "utf8");

test("the response count sits at the right of the response line, in the text or accent colour", { timeout: 60_000 }, async () => {
  const testBrowser = dedicatedTestBrowser(), executablePath = testBrowser.path;
  assert(executablePath, testBrowser.message);
  const html = `<!doctype html><html><head><meta charset='utf-8'><style>:root{--bg:#faf4ed;--panel:#fffaf3;--panel-2:#f2e9e1;--text:#575279;--muted:#797593;--panel-border:#dfdad9;--control-border:#cecacd;--accent:#56949f;} #rightPane{margin:24px;width:700px;}</style></head>
<body class='studio-ui-refresh studio-workspace-layout'><section id='rightPane'><div class='reference-meta'><span id='referenceBadge' class='source-badge'>Assistant response · 10:08:28 PM</span><span id='referenceHistoryCount' class='source-badge'>9/9</span></div></section></body></html>`;
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 300, deviceScaleFactor: 1 });
    await page.setContent(html); await page.addStyleTag({ content: css });
    const measure = () => page.evaluate(() => {
      const meta = document.querySelector(".reference-meta"), badge = document.getElementById("referenceBadge"), count = document.getElementById("referenceHistoryCount");
      const m = meta.getBoundingClientRect(), b = badge.getBoundingClientRect(), c = count.getBoundingClientRect(), style = getComputedStyle(meta);
      const text = el => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
      return { metaHeight: m.height, metaRects: meta.getClientRects().length, badgeLeftGap: b.left - m.left, countRightGap: m.right - c.right, padding: parseFloat(style.paddingLeft),
        sameLine: Math.abs(text(badge).top - text(count).top) < 1, badgeColor: getComputedStyle(badge).color, countColor: getComputedStyle(count).color,
        countVisible: count.getClientRects().length > 0 };
    });
    for (const width of [700, 320]) {
      await page.evaluate(width => { document.getElementById("rightPane").style.width = width + "px"; }, width);
      const latest = await measure();
      assert.equal(latest.countVisible, true);
      assert(Math.abs(latest.countRightGap - latest.padding) < 1, "the count ends at the line's right padding at " + width + "px: " + JSON.stringify(latest));
      assert(Math.abs(latest.badgeLeftGap - latest.padding) < 1, "the details stay at the left at " + width + "px");
      assert(latest.sameLine, "one line at " + width + "px");
      assert.equal(latest.countColor, "rgb(87, 82, 121)", "the text colour, not the muted one");
      assert.notEqual(latest.badgeColor, latest.countColor);
      await page.evaluate(() => document.getElementById("referenceHistoryCount").classList.add("is-older"));
      assert.equal((await measure()).countColor, "rgb(86, 148, 159)", "the accent colour while an older response shows");
      await page.evaluate(() => { const count = document.getElementById("referenceHistoryCount"); count.classList.remove("is-older"); count.hidden = true; });
      const without = await measure();
      assert.deepEqual([without.countVisible, without.metaHeight, without.badgeLeftGap], [false, latest.metaHeight, latest.badgeLeftGap], "hiding the count changes nothing else");
      // The line as it was laid out before, as plain text: the row is no taller (Astra: it was 7 px taller).
      await page.evaluate(() => { document.querySelector(".reference-meta").style.display = "block"; });
      const before = await measure();
      await page.evaluate(() => { document.querySelector(".reference-meta").style.display = ""; });
      assert(latest.metaHeight <= before.metaHeight, "the line is no taller than before at " + width + "px: " + latest.metaHeight + " vs " + before.metaHeight);
      await page.evaluate(() => { document.getElementById("referenceHistoryCount").hidden = false; });
    }
    await page.evaluate(() => { document.querySelector(".reference-meta").hidden = true; });
    assert.equal((await measure()).metaRects, 0, "a hidden line stays hidden");
  } finally { await browser?.close(); }
});

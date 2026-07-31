import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import puppeteer from "puppeteer-core";
import {
  buildStudioMermaidCliIconArgs,
  buildStudioMermaidPdfIconContrastCss,
  ensureStudioMermaidSourceContrast,
  usesSupportedStudioMermaidIconPack,
} from "../shared/studio-mermaid.js";

await import("../client/studio-mermaid-helpers.js");
const helpers = globalThis.PiStudioMermaidHelpers;

assert.ok(helpers, "Studio Mermaid browser helpers should load in tests.");
const projectRoot = fileURLToPath(new URL("..", import.meta.url));

function findBrowserExecutable() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || null;
}

function hexCssToRgb(value) {
  return `rgb(${[1, 3, 5].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)).join(", ")})`;
}

function contentTypeFor(path) {
  if (/\.m?js$/i.test(path)) return "text/javascript; charset=utf-8";
  if (/\.json$/i.test(path)) return "application/json; charset=utf-8";
  if (/\.css$/i.test(path)) return "text/css; charset=utf-8";
  if (/\.woff2?$/i.test(path)) return "font/woff2";
  return "application/octet-stream";
}

function safePackageFile(packageRoot, suffix) {
  const candidate = resolve(packageRoot, suffix.replace(/^\/+/, ""));
  const normalizedRoot = resolve(packageRoot) + sep;
  return candidate.startsWith(normalizedRoot) ? candidate : null;
}

test("Mermaid browser dependencies are reproducibly pinned", () => {
  assert.equal(helpers.MERMAID_VERSION, "11.16.0");
  assert.equal(
    helpers.MERMAID_CDN_URL,
    "https://cdn.jsdelivr.net/npm/mermaid@11.16.0/dist/mermaid.esm.min.mjs",
  );
  assert.deepEqual(
    helpers.ICON_PACKS.map(({ name, url }) => ({ name, url })),
    [
      {
        name: "lucide",
        url: "https://cdn.jsdelivr.net/npm/@iconify-json/lucide@1.2.120/icons.json",
      },
      {
        name: "logos",
        url: "https://cdn.jsdelivr.net/npm/@iconify-json/logos@1.2.11/icons.json",
      },
    ],
  );
});

test("Mermaid readable colors reach the WCAG text contrast target", () => {
  const correctedLight = helpers.ensureReadableColor("rgb(230, 237, 243)", "rgb(248, 249, 250)");
  const correctedMid = helpers.ensureReadableColor("rgb(230, 237, 243)", "rgb(128, 128, 128)");
  assert.ok(helpers.contrastRatio(correctedLight, "rgb(248, 249, 250)") >= 4.5);
  assert.ok(helpers.contrastRatio(correctedMid, "rgb(128, 128, 128)") >= 4.5);
  assert.equal(
    helpers.ensureReadableColor("rgb(20, 20, 20)", "rgb(248, 249, 250)"),
    "rgb(20, 20, 20)",
    "Already-readable semantic colors should be preserved.",
  );
});

test("Mermaid icon pack registry is lazy, reports failures, and can retry", async () => {
  let registeredPacks = [];
  let requestCount = 0;
  let shouldFail = true;
  const registry = helpers.createIconPackRegistry({
    fetch: async (url) => {
      requestCount += 1;
      if (shouldFail) return { ok: false, status: 503, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ prefix: url.includes("lucide") ? "lucide" : "logos", icons: {} }) };
    },
  });
  const mermaidApi = {
    registerIconPacks(packs) {
      registeredPacks = packs;
    },
  };

  registry.register(mermaidApi);
  registry.register(mermaidApi);
  assert.equal(registeredPacks.length, 2);
  assert.equal(requestCount, 0, "Registering packs should not fetch them before Mermaid requests an icon.");

  await assert.rejects(registeredPacks[0].loader(), /Failed to load Mermaid icon pack lucide: HTTP 503/);
  assert.match(registry.getError()?.message || "", /HTTP 503/);
  assert.equal(requestCount, 1);

  registry.clearError();
  shouldFail = false;
  const loaded = await registeredPacks[0].loader();
  assert.equal(loaded.prefix, "lucide");
  assert.equal(registry.getError(), null);
  assert.equal(requestCount, 2, "A failed lazy load should be removable from the cache and retryable.");
});

test("PDF icon arguments are conditional so ordinary diagrams remain compatible", () => {
  assert.equal(usesSupportedStudioMermaidIconPack("flowchart LR\n  source --> target"), false);
  assert.equal(usesSupportedStudioMermaidIconPack('source@{ icon: "lucide:file-code-2", label: "Source" }'), true);
  assert.equal(usesSupportedStudioMermaidIconPack("github@{\n icon: 'logos:github-icon',\n label: 'GitHub'\n}"), true);
  assert.equal(usesSupportedStudioMermaidIconPack('custom@{ icon: "custom:thing", label: "Custom" }'), false);
  assert.deepEqual(buildStudioMermaidCliIconArgs("flowchart LR\n  a --> b"), []);
  assert.deepEqual(
    buildStudioMermaidCliIconArgs('source@{ icon: "lucide:file-code-2" }'),
    [
      "--iconPacksNamesAndUrls",
      "lucide#https://cdn.jsdelivr.net/npm/@iconify-json/lucide@1.2.120/icons.json",
      "logos#https://cdn.jsdelivr.net/npm/@iconify-json/logos@1.2.11/icons.json",
    ],
  );
});

test("PDF Mermaid source gains readable colors for custom solid fills", () => {
  const source = [
    "flowchart LR",
    "  light[Light]",
    "  dark[Dark]",
    "  explicit[Explicit]",
    '  icon@{ icon: "lucide:file-code-2", label: "Icon" }',
    "  rgb[RGB]",
    "  classDef lightfill fill:#f8f9fa,stroke:#868e96",
    "  style dark fill:#1a1a2e,stroke:#5ea1ff;",
    "  classDef explicitfill fill:#f3f0ff,color:#e6edf3,stroke:#7950f2",
    "  classDef rgbfill fill:rgb(248, 249, 250),stroke:#868e96",
    "  classDef iconfill fill:#f8f9fa,stroke:#868e96",
    "  class icon iconfill",
  ].join("\n");
  const corrected = ensureStudioMermaidSourceContrast(source);
  assert.match(corrected, /classDef lightfill fill:#f8f9fa,stroke:#868e96,color:#000000/);
  assert.match(corrected, /style dark fill:#1a1a2e,stroke:#5ea1ff,color:#ffffff;/);
  assert.match(corrected, /classDef rgbfill fill:rgb\(248, 249, 250\),stroke:#868e96,color:#000000/);

  const explicit = corrected.match(/classDef explicitfill fill:#f3f0ff,color:(#[0-9a-f]{6})/i);
  assert.ok(explicit, "An explicitly low-contrast label color should be corrected.");
  assert.ok(helpers.contrastRatio(hexCssToRgb(explicit[1]), "rgb(243, 240, 255)") >= 4.5);

  const iconStroke = corrected.match(/classDef iconfill fill:#f8f9fa,stroke:(#[0-9a-f]{6}),color:#000000/i);
  assert.ok(iconStroke, "An icon class should correct the semantic Lucide stroke as well as its label.");
  assert.ok(helpers.contrastRatio(hexCssToRgb(iconStroke[1]), "rgb(248, 249, 250)") >= 4.5);

  const iconCss = buildStudioMermaidPdfIconContrastCss(source);
  assert.match(iconCss, /\.icon-shape\[id\*="flowchart-icon-"\] svg \{ color: #[0-9a-f]{6} !important; \}/i);
  assert.match(iconCss, /\.icon-shape\[id\*="flowchart-icon-"\] svg path\[fill\]:not\(\[fill="none"\]\)/);
  assert.match(iconCss, /fill: #[0-9a-f]{6} !important;/i, "Literal Logos path fills should receive a PDF override.");
});

test("live, standalone HTML, and PDF rendering paths use the Mermaid helpers", () => {
  const indexSource = readFileSync(resolve(projectRoot, "index.ts"), "utf-8");
  const clientSource = readFileSync(resolve(projectRoot, "client/studio-client.js"), "utf-8");

  assert.match(indexSource, /STUDIO_MERMAID_HELPERS_URL/);
  assert.match(indexSource, /buildStudioStandaloneHtmlMermaidScript[\s\S]*?PiStudioMermaidHelpers/);
  assert.match(indexSource, /ensureStudioMermaidSourceContrast\(source\)/);
  assert.match(indexSource, /buildStudioMermaidPdfIconContrastCss\(preparedSource\)/);
  assert.match(indexSource, /buildStudioMermaidCliIconArgs\(preparedSource\)/);
  assert.match(indexSource, /existsSync\(PI_STUDIO_MERMAID_CLI_PATH\)/);
  assert.match(clientSource, /mermaidIconRegistry\.register\(mermaidApi\)/);
  assert.match(clientSource, /mermaidHelpers\.applyAccessibleColors\(targetEl\)/);
  assert.match(clientSource, /mermaidHelpers\.renderFailures\(wrappers, error\)/);
});

const browserExecutable = findBrowserExecutable();
test("Mermaid icons and custom-fill labels render accessibly in dark and light browsers", { skip: !browserExecutable }, async () => {
  const helperSource = await readFile(resolve(projectRoot, "client/studio-mermaid-helpers.js"), "utf-8");
  const mermaidRoot = resolve(projectRoot, "node_modules/mermaid");
  const lucidePath = resolve(projectRoot, "node_modules/@iconify-json/lucide/icons.json");
  const logosPath = resolve(projectRoot, "node_modules/@iconify-json/logos/icons.json");
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: browserExecutable,
    args: process.platform === "linux" ? ["--no-sandbox", "--disable-setuid-sandbox"] : [],
  });

  const fixture = [
    "flowchart LR",
    '  source@{ icon: "lucide:file-code-2", form: "rounded", label: "Source", pos: "b", h: 56 }',
    '  github@{ icon: "logos:github-icon", form: "rounded", label: "GitHub", pos: "b", h: 56 }',
    '  payload@{ shape: "rounded", label: "Payload" }',
    "  source --> github --> payload",
    "  classDef light fill:#f8f9fa,stroke:#868e96,stroke-width:2px",
    "  classDef dark fill:#111827,stroke:#7950f2,stroke-width:2px",
    "  class source,payload light",
    "  class github dark",
  ].join("\n");

  try {
    for (const theme of [
      { name: "dark", background: "#0f1117", surface: "#171b24", text: "#e6edf3" },
      { name: "light", background: "#ffffff", surface: "#f6f8fa", text: "#111827" },
    ]) {
      const page = await browser.newPage();
      const consoleErrors = [];
      const served = new Set();
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      await page.setRequestInterception(true);
      page.on("request", async (request) => {
        const url = new URL(request.url());
        let localPath = null;
        if (url.hostname === "cdn.jsdelivr.net" && url.pathname.startsWith("/npm/mermaid@11.16.0/")) {
          localPath = safePackageFile(mermaidRoot, url.pathname.slice("/npm/mermaid@11.16.0/".length));
          served.add("mermaid");
        } else if (url.pathname === "/npm/@iconify-json/lucide@1.2.120/icons.json") {
          localPath = lucidePath;
          served.add("lucide");
        } else if (url.pathname === "/npm/@iconify-json/logos@1.2.11/icons.json") {
          localPath = logosPath;
          served.add("logos");
        }
        if (!localPath || !existsSync(localPath)) {
          await request.abort("blockedbyclient");
          return;
        }
        await request.respond({
          status: 200,
          contentType: contentTypeFor(localPath),
          headers: { "access-control-allow-origin": "*" },
          body: await readFile(localPath),
        });
      });

      await page.setContent(`<!doctype html>
<body style="margin:0;background:${theme.background};color:${theme.text}">
  <main id="root" style="padding:24px;background:${theme.surface}">
    <pre class="mermaid"><code id="source"></code></pre>
  </main>
  <script>${helperSource.replace(/<\/script/gi, "<\\/script")}</script>
  <script type="module">
    window.__done = false;
    window.__result = { status: "pending" };
    try {
      const fixture = ${JSON.stringify(fixture)};
      document.getElementById("source").textContent = fixture;
      const helper = globalThis.PiStudioMermaidHelpers;
      const pre = document.querySelector("pre.mermaid");
      const wrapper = document.createElement("div");
      wrapper.className = "mermaid-container";
      wrapper.dataset.mermaidSource = fixture;
      const diagram = document.createElement("div");
      diagram.className = "mermaid";
      diagram.textContent = fixture;
      wrapper.appendChild(diagram);
      pre.replaceWith(wrapper);
      const mermaid = (await import(helper.MERMAID_CDN_URL)).default;
      window.__mermaidApi = mermaid;
      const registry = helper.createIconPackRegistry();
      registry.register(mermaid);
      mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        themeVariables: {
          background: ${JSON.stringify(theme.background)},
          primaryColor: ${JSON.stringify(theme.surface)},
          primaryTextColor: ${JSON.stringify(theme.text)},
          textColor: ${JSON.stringify(theme.text)},
          lineColor: ${JSON.stringify(theme.text)}
        }
      });
      registry.clearError();
      await mermaid.run({ nodes: [diagram] });
      if (registry.getError()) throw registry.getError();
      helper.applyAccessibleColors(document);
      window.__result = { status: "success" };
    } catch (error) {
      window.__result = { status: "failed", error: String(error && error.stack || error) };
    } finally {
      window.__done = true;
    }
  </script>
</body>`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__done === true, { timeout: 30_000 });

      const result = await page.evaluate(() => {
        function firstOpaqueFill(root) {
          const shape = Array.from(root.querySelectorAll("rect, polygon, path, circle, ellipse")).find((candidate) => {
            const fill = getComputedStyle(candidate).fill;
            return fill && fill !== "none" && fill !== "rgba(0, 0, 0, 0)";
          });
          return shape ? getComputedStyle(shape).fill : "";
        }
        const failureIsolation = (() => {
          const normal = document.createElement("div");
          normal.className = "mermaid-container";
          normal.dataset.mermaidSource = "flowchart LR\\n  a --> b";
          normal.innerHTML = '<div class="mermaid"><svg></svg></div>';
          const icon = document.createElement("div");
          icon.className = "mermaid-container";
          icon.dataset.mermaidSource = 'flowchart LR\\n  source@{ icon: "lucide:file-code-2" }';
          icon.innerHTML = '<div class="mermaid"><svg></svg></div>';
          globalThis.PiStudioMermaidHelpers.renderFailures(
            [normal, icon],
            new Error("Failed to load Mermaid icon pack lucide: HTTP 503"),
          );
          return {
            normalSvgPreserved: Boolean(normal.querySelector("svg")),
            normalFailed: Boolean(normal.querySelector(".mermaid-error")),
            iconFailed: Boolean(icon.querySelector(".mermaid-error")),
          };
        })();
        return {
          render: window.__result,
          failureIsolation,
          icons: Array.from(document.querySelectorAll(".icon-shape")).map((node) => {
            const icon = node.querySelector("svg");
            const label = node.querySelector(".nodeLabel");
            return {
              pathCount: icon ? icon.querySelectorAll("path").length : 0,
              iconColor: icon ? getComputedStyle(icon).color : "",
              iconSurface: firstOpaqueFill(node.firstElementChild),
              labelColor: label ? getComputedStyle(label).color : "",
              labelSurface: label ? getComputedStyle(document.getElementById("root")).backgroundColor : "",
              paints: icon ? Array.from(icon.querySelectorAll("g, path, rect, polygon, circle, ellipse, line, polyline")).flatMap((element) => {
                const style = getComputedStyle(element);
                return [style.fill, style.stroke].filter((value) => /^rgba?\(/.test(value) && value !== "rgba(0, 0, 0, 0)");
              }) : [],
            };
          }),
          shapes: Array.from(document.querySelectorAll(".node:not(.icon-shape)")).map((node) => {
            const label = node.querySelector(".nodeLabel");
            return {
              label: label ? label.textContent.trim() : "",
              color: label ? getComputedStyle(label).color : "",
              fill: firstOpaqueFill(node),
            };
          }),
        };
      });

      assert.deepEqual(result.render, { status: "success" }, `${theme.name} Mermaid render should succeed.`);
      assert.deepEqual(result.failureIsolation, {
        normalSvgPreserved: true,
        normalFailed: false,
        iconFailed: true,
      }, `${theme.name} icon-pack failures should not discard already rendered ordinary diagrams.`);
      assert.equal(result.icons.length, 2);
      assert.ok(result.icons.every((icon) => icon.pathCount > 0), `${theme.name} icons should contain SVG paths.`);
      for (const icon of result.icons) {
        assert.ok(helpers.contrastRatio(icon.iconColor, icon.iconSurface) >= 4.5, `${theme.name} icon glyph should be readable.`);
        assert.ok(icon.paints.length > 0, `${theme.name} icon should expose at least one painted SVG descendant.`);
        assert.ok(icon.paints.every((paint) => helpers.contrastRatio(paint, icon.iconSurface) >= 4.5), `${theme.name} literal and currentColor icon paints should be readable.`);
        assert.ok(helpers.contrastRatio(icon.labelColor, icon.labelSurface) >= 4.5, `${theme.name} icon label should be readable.`);
      }
      const payload = result.shapes.find((shape) => shape.label === "Payload");
      assert.ok(payload, `${theme.name} fixture should contain its ordinary Payload node.`);
      assert.ok(helpers.contrastRatio(payload.color, payload.fill) >= 4.5, `${theme.name} ordinary node label should be readable.`);
      assert.deepEqual(served, new Set(["mermaid", "lucide", "logos"]));
      assert.deepEqual(consoleErrors, []);

      const partialRender = await page.evaluate(async () => {
        const root = document.getElementById("root");
        root.replaceChildren();
        const makeWrapper = (source) => {
          const wrapper = document.createElement("div");
          wrapper.className = "mermaid-container";
          wrapper.dataset.mermaidSource = source;
          const diagram = document.createElement("div");
          diagram.className = "mermaid";
          diagram.textContent = source;
          wrapper.appendChild(diagram);
          root.appendChild(wrapper);
          return wrapper;
        };
        const valid = makeWrapper([
          "flowchart LR",
          "  valid[Valid]",
          "  classDef light fill:#f8f9fa,stroke:#868e96",
          "  class valid light",
        ].join("\n"));
        const invalid = makeWrapper("this is not a Mermaid diagram");
        const wrappers = [valid, invalid];
        let caught = false;
        try {
          await window.__mermaidApi.run({ nodes: wrappers.map((wrapper) => wrapper.querySelector(".mermaid")) });
          globalThis.PiStudioMermaidHelpers.applyAccessibleColors(root);
        } catch (error) {
          caught = true;
          globalThis.PiStudioMermaidHelpers.applyAccessibleColors(root);
          globalThis.PiStudioMermaidHelpers.renderFailures(wrappers, error);
        }
        const label = valid.querySelector(".nodeLabel");
        const shape = valid.querySelector(".node rect, .node polygon, .node path, .node circle, .node ellipse");
        return {
          caught,
          validSvgPreserved: Boolean(valid.querySelector("svg")),
          invalidShowsFailure: Boolean(invalid.querySelector(".mermaid-error")) || Boolean(invalid.querySelector("svg")),
          labelColor: label ? getComputedStyle(label).color : "",
          shapeFill: shape ? getComputedStyle(shape).fill : "",
        };
      });
      assert.equal(partialRender.caught, true, `${theme.name} malformed sibling should exercise the partial-render failure path.`);
      assert.equal(partialRender.validSvgPreserved, true, `${theme.name} valid sibling SVG should survive a batch failure.`);
      assert.equal(partialRender.invalidShowsFailure, true, `${theme.name} malformed sibling should remain visibly failed.`);
      assert.ok(helpers.contrastRatio(partialRender.labelColor, partialRender.shapeFill) >= 4.5, `${theme.name} valid sibling should still receive contrast correction after a batch failure.`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
});

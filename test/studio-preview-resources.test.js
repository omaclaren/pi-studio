import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import "../client/studio-preview-resource-helpers.js";

const helpers = globalThis.PiStudioPreviewResourceHelpers;
if (!helpers) throw new Error("PiStudioPreviewResourceHelpers did not load for tests.");

function makeImage(source) {
  const attributes = new Map([["src", source]]);
  return {
    isConnected: true,
    getAttribute(name) {
      return attributes.get(name) ?? null;
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
  };
}

test("preview resource helpers distinguish local image paths from browser URLs", () => {
  const localSources = [
    "figures/result.png",
    "../figures/result.webp?rev=2",
    "/Users/example/project/result.jpg",
    "C:\\project\\result.gif",
  ];
  const browserSources = [
    "",
    "#figure-one",
    "//cdn.example.test/result.png",
    "https://example.test/result.png",
    "http://example.test/result.png",
    "data:image/png;base64,AAAA",
    "blob:http://127.0.0.1/id",
    "file:///tmp/result.png",
    "javascript:alert(1)",
  ];

  localSources.forEach((source) => assert.equal(helpers.isResolvableStudioPreviewImageSource(source), true, source));
  browserSources.forEach((source) => assert.equal(helpers.isResolvableStudioPreviewImageSource(source), false, source));
});

test("preview resource helpers hydrate only current connected local images", async () => {
  const local = makeImage("figures/result.png");
  const external = makeImage("https://example.test/result.png");
  const stale = makeImage("figures/stale.png");
  const disconnected = makeImage("figures/disconnected.png");
  disconnected.isConnected = false;
  const invalidPayload = makeImage("figures/not-an-image.png");
  const target = {
    querySelectorAll(selector) {
      assert.equal(selector, "img[src]");
      return [local, external, stale, disconnected, invalidPayload];
    },
  };
  const requested = [];

  const result = await helpers.hydrateStudioPreviewLocalImages(target, async (source) => {
    requested.push(source);
    if (source === "figures/stale.png") {
      stale.setAttribute("src", "figures/newer.png");
    }
    if (source === "figures/not-an-image.png") return "text/plain;base64,AAAA";
    return "data:image/png;base64,AAAA";
  });

  assert.deepEqual(requested, [
    "figures/result.png",
    "figures/stale.png",
    "figures/disconnected.png",
    "figures/not-an-image.png",
  ]);
  assert.deepEqual(result, { attempted: 4, resolved: 1 });
  assert.equal(local.getAttribute("src"), "data:image/png;base64,AAAA");
  assert.equal(external.getAttribute("src"), "https://example.test/result.png");
  assert.equal(stale.getAttribute("src"), "figures/newer.png");
  assert.equal(disconnected.getAttribute("src"), "figures/disconnected.png");
  assert.equal(invalidPayload.getAttribute("src"), "figures/not-an-image.png");
});

test("preview resource contexts compare source and working directory", () => {
  assert.equal(helpers.areStudioPreviewResourceContextsEqual(
    { sourcePath: "/tmp/a.md", resourceDir: "/tmp" },
    { sourcePath: "/tmp/a.md", resourceDir: "/tmp" },
  ), true);
  assert.equal(helpers.areStudioPreviewResourceContextsEqual(
    { sourcePath: "/tmp/a.md", resourceDir: "/tmp" },
    { sourcePath: "/tmp/b.md", resourceDir: "/tmp" },
  ), false);
  assert.equal(helpers.areStudioPreviewResourceContextsEqual(
    { sourcePath: "", resourceDir: "/tmp/a" },
    { sourcePath: "", resourceDir: "/tmp/b" },
  ), false);
});

test("PDF version observation waits for a changed file to remain stable", () => {
  const makeHeaders = (values) => ({
    get(name) {
      return values[String(name || "").toLowerCase()] || null;
    },
  });
  const versionA = helpers.buildStudioPdfVersionSignature(makeHeaders({
    etag: 'W/"100-a"',
    "last-modified": "Fri, 21 Aug 2026 01:00:00 GMT",
    "content-length": "256",
  }));
  const versionB = helpers.buildStudioPdfVersionSignature(makeHeaders({
    etag: 'W/"110-b"',
    "last-modified": "Fri, 21 Aug 2026 01:00:01 GMT",
    "content-length": "272",
  }));
  assert.match(versionA, /W\/"100-a"/);
  assert.equal(helpers.buildStudioPdfVersionSignature({ get: () => null }), "");

  let state = helpers.createStudioPdfVersionObservationState();
  let observed = helpers.observeStudioPdfVersion(state, versionA, 2);
  state = observed.state;
  assert.equal(observed.changed, false, "the first observation establishes a baseline");

  observed = helpers.observeStudioPdfVersion(state, versionB, 2);
  state = observed.state;
  assert.equal(observed.changed, false, "one changed observation is not yet stable");
  assert.equal(state.candidateCount, 1);

  observed = helpers.observeStudioPdfVersion(state, versionA, 2);
  state = observed.state;
  assert.equal(observed.changed, false, "returning to the baseline clears a partial change");
  assert.equal(state.candidateCount, 0);

  observed = helpers.observeStudioPdfVersion(state, versionB, 2);
  state = observed.state;
  assert.equal(observed.changed, false);
  observed = helpers.observeStudioPdfVersion(state, versionB, 2);
  state = observed.state;
  assert.equal(observed.changed, true, "two matching changed observations trigger refresh");
  assert.equal(state.baseline, versionB);

  observed = helpers.observeStudioPdfVersion(state, versionB, 2);
  assert.equal(observed.changed, false, "the accepted version does not retrigger refresh");
});

test("Studio hydrates rendered local images and refreshes previews when their resource context changes", () => {
  const indexSource = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
  const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");

  assert.match(indexSource, /studio-preview-resource-helpers\.js/);
  assert.match(clientSource, /previewResourceHelpers\.hydrateStudioPreviewLocalImages\(targetEl/);
  assert.match(clientSource, /fetchLocalPreviewResourceDataUrl\(\s*previewResourceContext/);
  assert.match(clientSource, /function refreshPreviewsForResourceContextChange\(\) \{\s*renderSourcePreview\(\);\s*if \(rightView === "preview"\) \{\s*renderActiveResult\(\);/);

  const applyStart = clientSource.indexOf("function applyResourceDir()");
  const applyEnd = clientSource.indexOf("if (sourceBadgeEl)", applyStart);
  assert.ok(applyStart >= 0 && applyEnd > applyStart);
  assert.match(clientSource.slice(applyStart, applyEnd), /refreshPreviewsForResourceContextChange\(\)/);

  assert.match(clientSource, /areStudioPreviewResourceContextsEqual\(previousPreviewResourceContext, nextPreviewResourceContext\)/);
});

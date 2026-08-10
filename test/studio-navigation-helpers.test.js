import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

await import("../client/studio-navigation-helpers.js");
const helpers = globalThis.PiStudioNavigationHelpers;
const projectRoot = fileURLToPath(new URL("..", import.meta.url));

assert.ok(helpers, "Studio navigation helpers should load in tests.");

test("pane-focus targets are normalized strictly", () => {
  assert.equal(helpers.normalizePaneFocusTarget("left"), "left");
  assert.equal(helpers.normalizePaneFocusTarget("right"), "right");
  for (const value of [null, undefined, "", "off", "LEFT", " right ", 1, {}, []]) {
    assert.equal(helpers.normalizePaneFocusTarget(value), "off");
  }
});

test("pane-focus URL state preserves authentication, document identity, and fragments", () => {
  const initial = "http://127.0.0.1:4321/?token=secret&mode=editor-only&docPath=%2Ftmp%2Fnotes.md#section";
  const focused = new URL(helpers.buildPaneFocusUrl(initial, "right"));
  assert.equal(focused.searchParams.get("token"), "secret");
  assert.equal(focused.searchParams.get("mode"), "editor-only");
  assert.equal(focused.searchParams.get("docPath"), "/tmp/notes.md");
  assert.equal(focused.searchParams.get("paneFocus"), "right");
  assert.equal(focused.hash, "#section");

  const switched = new URL(helpers.buildPaneFocusUrl(focused.toString(), "left"));
  assert.equal(switched.searchParams.getAll("paneFocus").length, 1);
  assert.equal(switched.searchParams.get("paneFocus"), "left");

  const exited = new URL(helpers.buildPaneFocusUrl(switched.toString(), "off"));
  assert.equal(exited.searchParams.has("paneFocus"), false);
  assert.equal(exited.searchParams.get("token"), "secret");
  assert.equal(exited.searchParams.get("docPath"), "/tmp/notes.md");
});

test("pane-focus state reads from search parameters and rejects invalid values", () => {
  assert.equal(helpers.readPaneFocusTarget({ search: "?token=x&paneFocus=left" }), "left");
  assert.equal(helpers.readPaneFocusTarget({ search: "?paneFocus=right" }), "right");
  assert.equal(helpers.readPaneFocusTarget({ search: "?paneFocus=RIGHT" }), "off");
  assert.equal(helpers.readPaneFocusTarget({ search: "?paneFocus=left&paneFocus=right" }), "left");
  assert.equal(helpers.readPaneFocusTarget(null), "off");
});

test("pane-focus replacement preserves history state and never pushes an entry", () => {
  const replacements = [];
  const historyState = { existing: "state" };
  const windowLike = {
    location: { href: "http://localhost:9000/?token=x&docSource=file" },
    history: {
      state: historyState,
      replaceState(state, title, href) {
        replacements.push({ state, title, href });
      },
      pushState() {
        assert.fail("Pane-focus updates must not push history entries.");
      },
    },
  };

  assert.equal(helpers.replacePaneFocusUrlState(windowLike, "right"), true);
  assert.equal(replacements.length, 1);
  assert.equal(replacements[0].state, historyState);
  assert.equal(replacements[0].title, "");
  const next = new URL(replacements[0].href);
  assert.equal(next.searchParams.get("paneFocus"), "right");
  assert.equal(next.searchParams.get("token"), "x");
  assert.equal(next.searchParams.get("docSource"), "file");

  windowLike.location.href = replacements[0].href;
  assert.equal(helpers.replacePaneFocusUrlState(windowLike, "right"), false);
  assert.equal(replacements.length, 1, "Unchanged focus state should not replace the URL again.");
});

test("Studio serves navigation helpers before the client and wires pane focus centrally", () => {
  const indexSource = readFileSync(resolve(projectRoot, "index.ts"), "utf-8");
  const clientSource = readFileSync(resolve(projectRoot, "client/studio-client.js"), "utf-8");

  assert.match(indexSource, /STUDIO_NAVIGATION_HELPERS_URL/);
  assert.match(indexSource, /<script src="\$\{navigationHelpersScriptHref\}"><\/script>\s*<script src="\$\{clientScriptHref\}"><\/script>/);
  assert.match(indexSource, /requestUrl\.pathname === "\/studio-navigation-helpers\.js"/);
  assert.match(clientSource, /initialPaneFocusTarget = navigationHelpers\.readPaneFocusTarget\(window\.location\)/);
  assert.match(clientSource, /setActivePane\(initialPaneFocusTarget === "off" \? "left" : initialPaneFocusTarget\)/);
  assert.match(clientSource, /navigationHelpers\.replacePaneFocusUrlState\(window, paneFocusTarget\)/);
});

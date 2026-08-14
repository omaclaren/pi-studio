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

class FakeStorage {
  constructor(options = {}) {
    this.values = new Map();
    this.failWrites = Boolean(options.failWrites);
  }

  get length() {
    return this.values.size;
  }

  key(index) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    if (this.failWrites) throw new Error("QuotaExceededError");
    this.values.set(String(key), String(value));
  }

  removeItem(key) {
    this.values.delete(String(key));
  }
}

function makeTabStateId(character) {
  return "tab_" + String(character || "a").repeat(32);
}

test("Studio tab-state IDs are stable in the URL and preserve document identity", () => {
  const replacements = [];
  const historyState = { existing: "state" };
  const windowLike = {
    crypto: { randomUUID: () => "12345678-1234-4234-9234-123456789abc" },
    location: { href: "http://127.0.0.1:4321/?token=secret&mode=editor-only&docPath=%2Ftmp%2Fnotes.qmd#preview" },
    history: {
      state: historyState,
      replaceState(state, title, href) {
        replacements.push({ state, title, href });
        windowLike.location.href = href;
      },
    },
  };

  const tabStateId = helpers.ensureStudioTabStateId(windowLike);
  assert.equal(helpers.isValidStudioTabStateId(tabStateId), true);
  assert.equal(replacements.length, 1);
  assert.equal(replacements[0].state, historyState);
  const updated = new URL(windowLike.location.href);
  assert.equal(updated.searchParams.get("token"), "secret");
  assert.equal(updated.searchParams.get("docPath"), "/tmp/notes.qmd");
  assert.equal(updated.searchParams.get(helpers.STUDIO_TAB_STATE_PARAM), tabStateId);
  assert.equal(updated.hash, "#preview");

  assert.equal(helpers.ensureStudioTabStateId(windowLike), tabStateId);
  assert.equal(replacements.length, 1, "An existing tab-state ID should not rewrite the URL.");
});

test("workspace state remains isolated in the current browser tab session", () => {
  const sessionStorage = new FakeStorage();
  const tabStateId = makeTabStateId("a");
  const state = {
    version: 1,
    savedAt: Date.now(),
    sourceState: { source: "file", label: "notes.qmd", path: "/tmp/notes.qmd" },
    editorView: "markdown",
    rightView: "editor-quarto-preview",
    text: "unsaved editor text",
  };

  assert.equal(helpers.persistStudioWorkspaceState({ sessionStorage }, tabStateId, state), true);
  assert.deepEqual(helpers.readStudioWorkspaceState({ sessionStorage }, tabStateId), state);
  assert.equal(helpers.readStudioWorkspaceState({ sessionStorage }, makeTabStateId("b")), null, "Another Studio tab must not inherit this editor state.");
  helpers.clearStudioWorkspaceState({ sessionStorage }, tabStateId);
  assert.equal(helpers.readStudioWorkspaceState({ sessionStorage }, tabStateId), null);
});

test("workspace state fails softly when browser session storage is unavailable", () => {
  const tabStateId = makeTabStateId("c");
  const state = { version: 1, savedAt: Date.now(), text: "session fallback" };

  assert.equal(helpers.persistStudioWorkspaceState({}, tabStateId, state), false);
  assert.equal(helpers.readStudioWorkspaceState({}, tabStateId), null);
  assert.doesNotThrow(() => helpers.clearStudioWorkspaceState({}, tabStateId));
});

test("legacy tab session state migrates to the tab-scoped key", () => {
  const sessionStorage = new FakeStorage();
  const tabStateId = makeTabStateId("d");
  const sessionState = { version: 1, savedAt: Date.now(), text: "legacy session" };
  sessionStorage.setItem(helpers.STUDIO_WORKSPACE_LEGACY_STORAGE_KEY, JSON.stringify(sessionState));

  assert.deepEqual(helpers.readStudioWorkspaceState({ sessionStorage }, tabStateId), sessionState);
  assert.equal(helpers.persistStudioWorkspaceState({ sessionStorage }, tabStateId, sessionState), true);
  assert.equal(sessionStorage.getItem(helpers.STUDIO_WORKSPACE_LEGACY_STORAGE_KEY), null);
  assert.deepEqual(helpers.readStudioWorkspaceState({ sessionStorage }, tabStateId), sessionState);
});

function createFakeBroadcastHub() {
  const channels = new Map();
  class FakeBroadcastChannel {
    constructor(name) {
      this.name = name;
      this.listeners = new Set();
      this.closed = false;
      if (!channels.has(name)) channels.set(name, new Set());
      channels.get(name).add(this);
    }

    addEventListener(type, listener) {
      if (type === "message") this.listeners.add(listener);
    }

    removeEventListener(type, listener) {
      if (type === "message") this.listeners.delete(listener);
    }

    postMessage(data) {
      if (this.closed) throw new Error("Channel is closed.");
      for (const peer of channels.get(this.name) || []) {
        if (peer === this || peer.closed) continue;
        for (const listener of peer.listeners) listener({ data });
        if (typeof peer.onmessage === "function") peer.onmessage({ data });
      }
    }

    close() {
      if (this.closed) return;
      this.closed = true;
      channels.get(this.name)?.delete(this);
    }
  }
  return { BroadcastChannel: FakeBroadcastChannel, channels };
}

function createLaunchWindow(hub, overrides = {}) {
  const openCalls = [];
  const location = {
    href: "http://127.0.0.1:4321/?token=session-token",
    replace(target) {
      this.replacedWith = target;
      this.href = new URL(target, this.href).href;
    },
  };
  return {
    BroadcastChannel: hub.BroadcastChannel,
    crypto: { randomUUID: () => "12345678-1234-4234-9234-123456789abc" },
    location,
    open(...args) {
      openCalls.push(args);
      return null;
    },
    openCalls,
    setTimeout,
    clearTimeout,
    addEventListener() {},
    close() {},
    ...overrides,
  };
}

function createPendingDocument() {
  const elements = new Map([
    ["pendingTitle", { textContent: "", hidden: false }],
    ["pendingDetail", { textContent: "", hidden: false }],
    ["pendingCloseBtn", { textContent: "", hidden: true, addEventListener() {} }],
  ]);
  return {
    elements,
    getElementById(id) {
      return elements.get(id) || null;
    },
  };
}

test("Studio relative targets are root-only, same-origin, and exact-token", () => {
  const location = { href: "http://127.0.0.1:4321/?token=session-token" };
  assert.equal(
    helpers.normalizeStudioRelativeTarget("/?token=session-token&mode=editor-only", location, "session-token"),
    "/?token=session-token&mode=editor-only",
  );
  for (const target of [
    "http://127.0.0.1:4321/?token=session-token",
    "//evil.example/?token=session-token",
    "/other?token=session-token",
    "/?token=wrong",
    "/?token=session-token&token=session-token",
    "/\\evil?token=session-token",
  ]) {
    assert.throws(() => helpers.normalizeStudioRelativeTarget(target, location, "session-token"));
  }
});

test("pending launch opens once, queues a fast result, and waits for terminal acceptance", () => {
  const hub = createFakeBroadcastHub();
  const windowLike = createLaunchWindow(hub);
  const events = [];
  let accepted = null;
  const launch = helpers.createPendingStudioLaunch({
    window: windowLike,
    token: "session-token",
    kind: "document",
    readyTimeoutMs: 1_000,
    deliveryTimeoutMs: 1_000,
    onEvent: (event) => events.push(event),
    onAccepted: (result) => { accepted = result; },
  });
  assert.ok(launch);
  assert.equal(windowLike.openCalls.length, 1);
  assert.deepEqual(windowLike.openCalls[0].slice(1), ["_blank", "noopener"]);
  const pendingUrl = new URL(windowLike.openCalls[0][0], windowLike.location.href);
  assert.equal(pendingUrl.pathname, "/studio-open-pending");
  assert.equal(pendingUrl.searchParams.get("token"), "session-token");
  assert.equal(pendingUrl.searchParams.get("kind"), "document");

  assert.equal(launch.navigate("/?token=session-token&mode=editor-only"), true);
  assert.equal(launch.getSnapshot().state, "waiting");
  const peer = new hub.BroadcastChannel(helpers.studioLaunchChannelName(launch.launchId));
  let terminalMessage = null;
  peer.addEventListener("message", ({ data }) => {
    if (data.type !== "navigate") return;
    terminalMessage = data;
    peer.postMessage({
      protocol: helpers.STUDIO_LAUNCH_PROTOCOL_VERSION,
      type: "accepted",
      launchId: launch.launchId,
      terminalType: "navigate",
      ok: true,
    });
  });
  peer.postMessage({
    protocol: helpers.STUDIO_LAUNCH_PROTOCOL_VERSION,
    type: "ready",
    launchId: launch.launchId,
  });

  assert.equal(terminalMessage.target, "/?token=session-token&mode=editor-only");
  assert.equal(launch.getSnapshot().state, "accepted");
  assert.equal(accepted.ok, true);
  assert.ok(events.includes("ready"));
  assert.ok(events.includes("terminal-sent"));
  assert.ok(events.includes("accepted"));
  peer.close();
});

test("pending launch timeout never opens an automatic fallback tab", async () => {
  const hub = createFakeBroadcastHub();
  const windowLike = createLaunchWindow(hub);
  let deliveryTimedOut = false;
  const launch = helpers.createPendingStudioLaunch({
    window: windowLike,
    token: "session-token",
    kind: "preview",
    readyTimeoutMs: 100,
    deliveryTimeoutMs: 100,
    onDeliveryTimeout: () => { deliveryTimedOut = true; },
  });
  launch.navigate("/?token=session-token&mode=editor-only");
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 140));
  assert.equal(deliveryTimedOut, true);
  assert.equal(launch.getSnapshot().state, "abandoned");
  assert.equal(windowLike.openCalls.length, 1);
});

test("pending-page receiver acknowledges before replacing its own location", async () => {
  const hub = createFakeBroadcastHub();
  const originWindow = createLaunchWindow(hub);
  let accepted = null;
  const launch = helpers.createPendingStudioLaunch({
    window: originWindow,
    token: "session-token",
    kind: "export",
    readyTimeoutMs: 1_000,
    deliveryTimeoutMs: 1_000,
    onAccepted: (result) => { accepted = result; },
  });
  launch.navigate("/?token=session-token&mode=editor-only&docLabel=export");

  const pendingWindow = createLaunchWindow(hub);
  const pendingDocument = createPendingDocument();
  const receiver = helpers.startStudioPendingPage(pendingWindow, pendingDocument, {
    launchId: launch.launchId,
    kind: "export",
    token: "session-token",
    stillWaitingMs: 1_000,
  });
  assert.ok(receiver);
  assert.equal(accepted.ok, true, "Origin should receive terminal acceptance synchronously in the test channel.");
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 35));
  assert.equal(
    pendingWindow.location.replacedWith,
    "/?token=session-token&mode=editor-only&docLabel=export",
  );
  assert.equal(pendingDocument.elements.get("pendingTitle").textContent, "Opening Studio tab…");
});

test("launch controller latches the first terminal message and correlates acceptance", () => {
  const hub = createFakeBroadcastHub();
  const windowLike = createLaunchWindow(hub);
  const launch = helpers.createPendingStudioLaunch({
    window: windowLike,
    token: "session-token",
    kind: "document",
    readyTimeoutMs: 1_000,
    deliveryTimeoutMs: 1_000,
  });
  const peer = new hub.BroadcastChannel(helpers.studioLaunchChannelName(launch.launchId));
  let terminal = null;
  peer.addEventListener("message", ({ data }) => {
    if (data.type === "error") terminal = data;
  });
  assert.equal(launch.fail("First terminal"), true);
  assert.equal(launch.navigate("/?token=session-token"), false);
  peer.postMessage({ protocol: helpers.STUDIO_LAUNCH_PROTOCOL_VERSION, type: "ready", launchId: launch.launchId });
  assert.equal(terminal.type, "error");
  peer.postMessage({
    protocol: helpers.STUDIO_LAUNCH_PROTOCOL_VERSION,
    type: "accepted",
    launchId: launch.launchId,
    terminalType: "navigate",
    ok: true,
  });
  assert.equal(launch.getSnapshot().state, "terminal-sent", "Mismatched acceptance must be ignored.");
  peer.postMessage({
    protocol: helpers.STUDIO_LAUNCH_PROTOCOL_VERSION,
    type: "accepted",
    launchId: launch.launchId,
    terminalType: "error",
    ok: true,
  });
  assert.equal(launch.getSnapshot().state, "accepted");
  peer.close();
});

test("pending page rejects a hostile navigation and reports failed acceptance", () => {
  const hub = createFakeBroadcastHub();
  const pendingWindow = createLaunchWindow(hub);
  const pendingDocument = createPendingDocument();
  const launchId = "12345678-1234-4234-9234-123456789abc";
  const sender = new hub.BroadcastChannel(helpers.studioLaunchChannelName(launchId));
  let acceptance = null;
  sender.addEventListener("message", ({ data }) => {
    if (data.type === "accepted") acceptance = data;
  });
  const receiver = helpers.startStudioPendingPage(pendingWindow, pendingDocument, {
    launchId,
    kind: "preview",
    token: "session-token",
    stillWaitingMs: 1_000,
  });
  assert.ok(receiver);
  sender.postMessage({
    protocol: helpers.STUDIO_LAUNCH_PROTOCOL_VERSION,
    type: "navigate",
    launchId,
    target: "https://evil.example/?token=session-token",
  });
  assert.equal(acceptance.terminalType, "navigate");
  assert.equal(acceptance.ok, false);
  assert.equal(pendingWindow.location.replacedWith, undefined);
  assert.equal(pendingDocument.elements.get("pendingTitle").textContent, "Could not open Studio tab");
  sender.close();
  receiver.close();
});

test("crypto launch IDs use getRandomValues when randomUUID is unavailable", () => {
  const cryptoLike = {
    getRandomValues(bytes) {
      bytes.fill(0xab);
      return bytes;
    },
  };
  const launchId = helpers.makeStudioLaunchId(cryptoLike);
  assert.equal(launchId, "launch_" + "ab".repeat(24));
  assert.equal(helpers.isValidStudioLaunchId(launchId), true);
  assert.throws(() => helpers.makeStudioLaunchId({}));
});

test("direct opens do not interpret a null window handle", () => {
  const hub = createFakeBroadcastHub();
  const windowLike = createLaunchWindow(hub);
  const result = helpers.openStudioTabDirect(windowLike, "https://quarto.org/docs/get-started/");
  assert.equal(result, undefined);
  assert.deepEqual(windowLike.openCalls, [["https://quarto.org/docs/get-started/", "_blank", "noopener"]]);
});

test("unsupported pending launches fail before reserving a tab", () => {
  const hub = createFakeBroadcastHub();
  const windowLike = createLaunchWindow(hub, { BroadcastChannel: undefined });
  assert.throws(
    () => helpers.createPendingStudioLaunch({ window: windowLike, token: "session-token", kind: "document" }),
    /does not support asynchronously prepared Studio tabs/,
  );
  assert.equal(windowLike.openCalls.length, 0);
});

test("a synchronous tab-open exception cleans up the launch and propagates", () => {
  const hub = createFakeBroadcastHub();
  const openError = new Error("Browser rejected open");
  const windowLike = createLaunchWindow(hub, {
    open() {
      throw openError;
    },
  });
  const events = [];
  assert.throws(
    () => helpers.createPendingStudioLaunch({
      window: windowLike,
      token: "session-token",
      kind: "document",
      onEvent: (event) => events.push(event),
    }),
    (error) => error === openError,
  );
  assert.ok(events.includes("open-error"));
  assert.equal(hub.channels.size, 1);
  assert.equal(Array.from(hub.channels.values())[0].size, 0, "Failed launch channel must be closed.");
});

test("Studio serves navigation helpers before the client and wires reconstruction state centrally", () => {
  const indexSource = readFileSync(resolve(projectRoot, "index.ts"), "utf-8");
  const clientSource = readFileSync(resolve(projectRoot, "client/studio-client.js"), "utf-8");

  assert.match(indexSource, /STUDIO_NAVIGATION_HELPERS_URL/);
  assert.match(indexSource, /<script src="\$\{navigationHelpersScriptHref\}"><\/script>[\s\S]*<script src="\$\{clientScriptHref\}"><\/script>/);
  assert.match(indexSource, /requestUrl\.pathname === "\/studio-navigation-helpers\.js"/);
  assert.match(clientSource, /studioTabStateId = navigationHelpers\.ensureStudioTabStateId\(window\)/);
  assert.match(clientSource, /navigationHelpers\.readStudioWorkspaceState\(window, studioTabStateId\)/);
  assert.match(clientSource, /navigationHelpers\.persistStudioWorkspaceState\(window, studioTabStateId, payload\)/);
  assert.match(clientSource, /initialPaneFocusTarget = navigationHelpers\.readPaneFocusTarget\(window\.location\)/);
  assert.match(clientSource, /setActivePane\(initialPaneFocusTarget === "off" \? "left" : initialPaneFocusTarget\)/);
  assert.match(clientSource, /navigationHelpers\.replacePaneFocusUrlState\(window, paneFocusTarget\)/);
});

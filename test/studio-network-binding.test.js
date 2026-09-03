import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import {
  buildStudioListenAllWarning,
  isStudioWebSocketOriginAllowed,
  parseStudioRequestTarget,
  resolveStudioNetworkBinding,
  STUDIO_ADVERTISED_HOST,
  STUDIO_ALL_INTERFACES_BIND_HOST,
  STUDIO_LOOPBACK_BIND_HOST,
} from "../shared/studio-network-binding.js";

const indexSource = readFileSync(new URL("../index.ts", import.meta.url), "utf8");

async function observeNodeBinding(listenAll) {
  const binding = resolveStudioNetworkBinding(listenAll);
  const server = createServer((_request, response) => response.end("ok"));
  await new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(0, binding.bindHost, resolvePromise);
  });
  const address = server.address();
  await new Promise((resolvePromise) => server.close(resolvePromise));
  return address;
}

test("Studio network binding remains localhost-only by default", async () => {
  assert.deepEqual(resolveStudioNetworkBinding(), {
    bindHost: "127.0.0.1",
    advertisedHost: "127.0.0.1",
    listenAll: false,
  });
  assert.equal(STUDIO_LOOPBACK_BIND_HOST, "127.0.0.1");
  assert.equal(STUDIO_ADVERTISED_HOST, "127.0.0.1");

  const address = await observeNodeBinding(false);
  assert.equal(typeof address === "object" && address ? address.address : "", "127.0.0.1");
});

test("listen-all binds IPv4 wildcard while preserving loopback browser URLs", async () => {
  assert.deepEqual(resolveStudioNetworkBinding(true), {
    bindHost: "0.0.0.0",
    advertisedHost: "127.0.0.1",
    listenAll: true,
  });
  assert.equal(STUDIO_ALL_INTERFACES_BIND_HOST, "0.0.0.0");

  const address = await observeNodeBinding(true);
  assert.equal(typeof address === "object" && address ? address.address : "", "0.0.0.0");
  assert.match(indexSource, /return `http:\/\/\$\{STUDIO_ADVERTISED_HOST\}:\$\{port\}/);
});

test("request-target parsing never trusts an inbound Host authority", () => {
  const route = parseStudioRequestTarget("/health?probe=1");
  assert.ok(route);
  assert.equal(route.hostname, "127.0.0.1");
  assert.equal(route.pathname, "/health");
  assert.equal(route.searchParams.get("probe"), "1");
  assert.equal(parseStudioRequestTarget(undefined)?.pathname, "/");
  assert.equal(parseStudioRequestTarget("http://attacker.invalid/?token=x"), null);
  assert.equal(parseStudioRequestTarget("//attacker.invalid/?token=x"), null);
  assert.equal(parseStudioRequestTarget("/\\attacker.invalid/?token=x"), null);

  const handlerStart = indexSource.indexOf("const handleHttpRequest =");
  const handlerEnd = indexSource.indexOf("const ensureServer = async", handlerStart);
  assert.ok(handlerStart >= 0 && handlerEnd > handlerStart, "expected Studio HTTP handler");
  const handlerSource = indexSource.slice(handlerStart, handlerEnd);
  assert.match(handlerSource, /parseStudioRequestTarget\(req\.url\)/);
  assert.doesNotMatch(handlerSource, /req\.headers\.host/);
});

test("wildcard WebSockets reject browser origins that do not match Host", () => {
  assert.equal(isStudioWebSocketOriginAllowed(undefined, undefined, true), true);
  assert.equal(isStudioWebSocketOriginAllowed("file:///tmp/studio.html", "127.0.0.1:4321", true), false);
  assert.equal(isStudioWebSocketOriginAllowed("http://127.0.0.1:4321/not-an-origin", "127.0.0.1:4321", true), false);
  assert.equal(isStudioWebSocketOriginAllowed("https://attacker.invalid", "127.0.0.1:4321", false), true);
  assert.equal(isStudioWebSocketOriginAllowed("http://127.0.0.1:4321", "127.0.0.1:4321", true), true);
  assert.equal(isStudioWebSocketOriginAllowed("http://192.0.2.8:4321", "192.0.2.8:4321", true), true);
  assert.equal(isStudioWebSocketOriginAllowed("https://attacker.invalid", "127.0.0.1:4321", true), false);
  assert.equal(isStudioWebSocketOriginAllowed("http://127.0.0.1:4321", undefined, true), false);
  assert.equal(isStudioWebSocketOriginAllowed("http://127.0.0.1:4321", "user@127.0.0.1:4321", true), false);
});

test("listen-all warning explains bearer-token authority and safer exposure", () => {
  const warning = buildStudioListenAllWarning(4321);
  assert.match(warning, /Security warning/);
  assert.match(warning, /0\.0\.0\.0:4321/);
  assert.match(warning, /tokenized Studio URL/);
  assert.match(warning, /control Studio for this Pi process/);
  assert.match(warning, /submitting prompts/);
  assert.match(warning, /reading or writing files through Studio/);
  assert.match(warning, /expanding local-resource access/);
  assert.match(warning, /Treat the URL like a password/);
  assert.match(warning, /trusted local mapping or private network/);
  assert.match(warning, /prefer SSH tunnelling/);
  assert.match(warning, /\/studio --stop[\s\S]*?without --listen-all[\s\S]*?localhost-only/);
  assert.match(
    buildStudioListenAllWarning(4321, "http://127.0.0.1:4321/?token=secret"),
    /\nStudio URL: http:\/\/127\.0\.0\.1:4321\/\?token=secret$/,
  );
});

test("Studio parses and applies listen-all as an explicit server-lifetime option", () => {
  const parserStart = indexSource.indexOf("function parseStudioLaunchOpenFlags(");
  const parserEnd = indexSource.indexOf("function shouldAutoOpenStudioBrowser(", parserStart);
  assert.ok(parserStart >= 0 && parserEnd > parserStart, "expected Studio launch-option parser");
  const parserSource = indexSource.slice(parserStart, parserEnd);
  assert.match(parserSource, /token === "--listen-all"/);
  assert.match(parserSource, /listenAll = true/);
  assert.match(parserSource, /remaining\.join\(" "\)[\s\S]*?listenAll/);

  const ensureStart = indexSource.indexOf("const ensureServer = async");
  const ensureEnd = indexSource.indexOf("const stopServer = async", ensureStart);
  assert.ok(ensureStart >= 0 && ensureEnd > ensureStart, "expected Studio server setup");
  const ensureSource = indexSource.slice(ensureStart, ensureEnd);
  assert.match(ensureSource, /resolveStudioNetworkBinding\(listenAll\)/);
  assert.match(ensureSource, /bindHost: binding\.bindHost/);
  assert.match(ensureSource, /listenAll: binding\.listenAll/);
  assert.match(ensureSource, /server\.listen\(listenPort, state\.bindHost\)/);
  assert.match(ensureSource, /parseStudioRequestTarget\(req\.url\)/);
  assert.match(ensureSource, /isStudioWebSocketOriginAllowed\(origin, requestHost, state\.listenAll\)/);
  assert.doesNotMatch(ensureSource, /new URL\(req\.url[\s\S]*?req\.headers\.host/);
});

test("running-server binding changes require an explicit stop and restart", () => {
  const openStart = indexSource.indexOf("const openStudioView = async");
  const openEnd = indexSource.indexOf('pi.registerCommand("studio"', openStart);
  assert.ok(openStart >= 0 && openEnd > openStart, "expected Studio open handler");
  const openSource = indexSource.slice(openStart, openEnd);
  assert.match(openSource, /launchOpenFlags\.listenAll && !serverState\.listenAll/);
  assert.match(openSource, /already bound to localhost[\s\S]*?\/studio --stop[\s\S]*?--listen-all/);
  assert.match(openSource, /ensureServer\(launchOpenFlags\.port, launchOpenFlags\.listenAll\)/);
  assert.match(openSource, /state\.listenAll[\s\S]*?buildStudioListenAllWarning\(state\.port, url\)/);
});

test("Studio help and status make wildcard exposure visible", () => {
  assert.match(indexSource, /\/studio --listen-all  Explicitly bind to 0\.0\.0\.0 instead of localhost \(security-sensitive\)/);
  assert.match(indexSource, /listening on \${serverState\.bindHost}:\${serverState\.port}/);
  assert.match(indexSource, /serverState\.listenAll[\s\S]*?buildStudioListenAllWarning\(serverState\.port, url\)/);
});

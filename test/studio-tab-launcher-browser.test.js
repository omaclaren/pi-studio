import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import puppeteer from "puppeteer-core";
import {
  buildStudioPendingPage,
  buildStudioPendingSecurityHeaders,
  isValidStudioLaunchId,
  normalizeStudioPendingKind,
} from "../shared/studio-tab-launcher.js";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const navigationHelperSource = readFileSync(resolve(projectRoot, "client/studio-navigation-helpers.js"), "utf-8");
const token = "browser-test-token";

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

function listen(server) {
  return new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolvePromise(server.address()));
  });
}

function closeServer(server) {
  return new Promise((resolvePromise) => server.close(() => resolvePromise()));
}

function sendText(response, status, contentType, body, headers = {}) {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  response.end(body);
}

function buildOriginPage() {
  return `<!doctype html>
<html><body>
  <button id="success" type="button">Success launch</button>
  <button id="error" type="button">Error launch</button>
  <script src="/studio-navigation-helpers.js?token=${token}"></script>
  <script>
    window.__launchEvents = [];
    window.__openCalls = [];
    const nativeOpen = window.open.bind(window);
    window.open = (...args) => {
      window.__openCalls.push(args);
      nativeOpen(...args);
      return null;
    };
    function start(kind, terminal) {
      const launch = window.PiStudioNavigationHelpers.createPendingStudioLaunch({
        window,
        token: ${JSON.stringify(token)},
        kind,
        readyTimeoutMs: 1000,
        deliveryTimeoutMs: 3000,
        onEvent: (event, detail) => window.__launchEvents.push({ event, launchId: detail.launchId }),
      });
      window.__lastLaunch = launch;
      terminal(launch);
    }
    document.getElementById("success").addEventListener("click", () => {
      start("document", (launch) => launch.navigate("/?token=${token}&final=1"));
    });
    document.getElementById("error").addEventListener("click", () => {
      start("preview", (launch) => launch.fail("Conversion failed safely."));
    });
  </script>
</body></html>`;
}

const browserExecutable = findBrowserExecutable();
test("cross-browser pending launcher opens exactly one useful or informative tab", async () => {
  assert.ok(
    browserExecutable,
    "A Brave/Chrome/Chromium executable is required. Set PUPPETEER_EXECUTABLE_PATH to run launcher browser tests.",
  );

  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    if (requestUrl.pathname === "/studio-navigation-helpers.js") {
      if (requestUrl.searchParams.get("token") !== token) {
        sendText(response, 403, "text/plain; charset=utf-8", "Forbidden");
        return;
      }
      sendText(response, 200, "application/javascript; charset=utf-8", navigationHelperSource, {
        "Cross-Origin-Resource-Policy": "same-origin",
      });
      return;
    }
    if (requestUrl.pathname === "/studio-open-pending") {
      const launchId = requestUrl.searchParams.get("launchId") || "";
      const kind = normalizeStudioPendingKind(requestUrl.searchParams.get("kind"));
      if (requestUrl.searchParams.get("token") !== token || !isValidStudioLaunchId(launchId) || !kind) {
        sendText(response, 400, "text/plain; charset=utf-8", "Invalid pending request");
        return;
      }
      const nonce = "0123456789abcdef0123456789abcdef";
      response.writeHead(200, buildStudioPendingSecurityHeaders(nonce));
      response.end(buildStudioPendingPage({ token, launchId, kind, nonce }));
      return;
    }
    if (requestUrl.searchParams.get("final") === "1") {
      sendText(response, 200, "text/html; charset=utf-8", "<!doctype html><title>Useful Studio target</title><p id='final'>Useful Studio target</p>");
      return;
    }
    sendText(response, 200, "text/html; charset=utf-8", buildOriginPage());
  });

  const address = await listen(server);
  assert.equal(typeof address, "object");
  const origin = `http://127.0.0.1:${address.port}/?token=${token}`;
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: browserExecutable,
    args: process.platform === "linux" ? ["--no-sandbox", "--disable-setuid-sandbox"] : [],
  });

  try {
    const successPage = await browser.newPage();
    const successErrors = [];
    successPage.on("pageerror", (error) => successErrors.push(error.message));
    await successPage.goto(origin, { waitUntil: "domcontentloaded" });
    let successPopupCount = 0;
    successPage.on("popup", () => { successPopupCount += 1; });
    const successPopupPromise = new Promise((resolvePromise) => successPage.once("popup", resolvePromise));
    await successPage.click("#success");
    const successPopup = await successPopupPromise;
    successPopup.on("pageerror", (error) => successErrors.push("popup: " + error.message));
    await successPopup.waitForSelector("#final", { timeout: 5_000 });
    await successPage.waitForFunction(() => window.__lastLaunch.getSnapshot().state === "accepted", { timeout: 5_000 });
    const successResult = await successPage.evaluate(() => ({
      calls: window.__openCalls.length,
      state: window.__lastLaunch.getSnapshot().state,
      events: window.__launchEvents.map((entry) => entry.event),
    }));
    assert.equal(successPopupCount, 1);
    assert.equal(successResult.calls, 1);
    assert.equal(successResult.state, "accepted");
    assert.ok(successResult.events.includes("ready"));
    assert.ok(successResult.events.includes("terminal-sent"));
    assert.ok(successResult.events.includes("accepted"));
    assert.deepEqual(successErrors, []);

    const errorPage = await browser.newPage();
    const errorErrors = [];
    errorPage.on("pageerror", (error) => errorErrors.push(error.message));
    await errorPage.goto(origin, { waitUntil: "domcontentloaded" });
    let errorPopupCount = 0;
    errorPage.on("popup", () => { errorPopupCount += 1; });
    const errorPopupPromise = new Promise((resolvePromise) => errorPage.once("popup", resolvePromise));
    await errorPage.click("#error");
    const errorPopup = await errorPopupPromise;
    errorPopup.on("pageerror", (error) => errorErrors.push("popup: " + error.message));
    await errorPopup.waitForFunction(() => document.getElementById("pendingTitle")?.textContent === "Studio could not open this tab", { timeout: 5_000 });
    const pendingError = await errorPopup.$eval("#pendingDetail", (element) => element.textContent);
    assert.equal(pendingError, "Conversion failed safely.");
    assert.equal(errorPopupCount, 1);
    assert.equal(await errorPage.evaluate(() => window.__openCalls.length), 1);
    assert.deepEqual(errorErrors, []);
  } finally {
    await browser.close();
    await closeServer(server);
  }
});

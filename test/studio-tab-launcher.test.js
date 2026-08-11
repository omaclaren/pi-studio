import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildStudioPendingPage,
  buildStudioPendingSecurityHeaders,
  isValidStudioLaunchId,
  normalizeStudioPendingKind,
} from "../shared/studio-tab-launcher.js";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const validLaunchId = "12345678-1234-4234-9234-123456789abc";
const validNonce = "0123456789abcdef0123456789abcdef";

test("pending-page launch IDs and kinds are strictly bounded", () => {
  assert.equal(isValidStudioLaunchId(validLaunchId), true);
  assert.equal(isValidStudioLaunchId("a".repeat(20)), true);
  assert.equal(isValidStudioLaunchId("a".repeat(128)), true);
  assert.equal(isValidStudioLaunchId("a".repeat(19)), false);
  assert.equal(isValidStudioLaunchId("a".repeat(129)), false);
  assert.equal(isValidStudioLaunchId("invalid launch id"), false);
  assert.equal(normalizeStudioPendingKind("document"), "document");
  assert.equal(normalizeStudioPendingKind("preview"), "preview");
  assert.equal(normalizeStudioPendingKind("export"), "export");
  assert.equal(normalizeStudioPendingKind("Document"), null);
  assert.equal(normalizeStudioPendingKind("other"), null);
});

test("pending-page security headers are explicit and nonce-scoped", () => {
  const headers = buildStudioPendingSecurityHeaders(validNonce);
  assert.equal(headers["Content-Type"], "text/html; charset=utf-8");
  assert.equal(headers["Cache-Control"], "no-store");
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["Referrer-Policy"], "no-referrer");
  assert.equal(headers["Cross-Origin-Opener-Policy"], "same-origin");
  assert.equal(headers["Cross-Origin-Resource-Policy"], "same-origin");
  assert.match(headers["Content-Security-Policy"], new RegExp(`script-src 'nonce-${validNonce}'`));
  assert.match(headers["Content-Security-Policy"], new RegExp(`style-src 'nonce-${validNonce}'`));
  assert.match(headers["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.match(headers["Content-Security-Policy"], /object-src 'none'/);
  assert.match(headers["Content-Security-Policy"], /default-src 'none'/);
  assert.throws(() => buildStudioPendingSecurityHeaders("bad nonce"));
});

test("pending page contains only bounded launch metadata and escaped token data", () => {
  const token = `token\"<>&'value`;
  const html = buildStudioPendingPage({
    token,
    launchId: validLaunchId,
    kind: "preview",
    nonce: validNonce,
  });
  assert.match(html, /data-studio-pending-launch="1"/);
  assert.match(html, new RegExp(`data-launch-id="${validLaunchId}"`));
  assert.match(html, /data-launch-kind="preview"/);
  assert.match(html, /studio-navigation-helpers\.js\?token=/);
  assert.doesNotMatch(html, /token"<>&'value/);
  assert.doesNotMatch(html, /innerHTML|document\.write/);
  assert.match(html, new RegExp(`nonce="${validNonce}"`));
  assert.throws(() => buildStudioPendingPage({ token: "x", launchId: "short", kind: "preview", nonce: validNonce }));
  assert.throws(() => buildStudioPendingPage({ token: "x", launchId: validLaunchId, kind: "unknown", nonce: validNonce }));
});

test("Studio pending route is before the root catch-all and validates token, method, and parameters", () => {
  const indexSource = readFileSync(resolve(projectRoot, "index.ts"), "utf-8");
  const routeIndex = indexSource.indexOf('requestUrl.pathname === "/studio-open-pending"');
  const rootCatchAllIndex = indexSource.indexOf('requestUrl.pathname !== "/"');
  assert.ok(routeIndex > 0);
  assert.ok(rootCatchAllIndex > routeIndex);
  const routeSource = indexSource.slice(routeIndex, indexSource.indexOf('requestUrl.pathname === "/studio.css"', routeIndex));
  assert.match(routeSource, /getAll\("token"\)/);
  assert.match(routeSource, /method !== "GET"/);
  assert.match(routeSource, /respondStudioPendingError\(res, 405,[\s\S]*?"GET"\)/);
  assert.match(routeSource, /isValidStudioLaunchId\(launchId\)/);
  assert.match(routeSource, /normalizeStudioPendingKind/);
  assert.match(routeSource, /buildStudioPendingSecurityHeaders/);
  assert.match(routeSource, /buildStudioPendingPage/);
  assert.match(routeSource, /respondStudioPendingError/);
});

test("all shipped new-tab call sites use direct or pending launchers without blank-popup fallbacks", () => {
  const clientSource = readFileSync(resolve(projectRoot, "client/studio-client.js"), "utf-8");
  const helperSource = readFileSync(resolve(projectRoot, "client/studio-navigation-helpers.js"), "utf-8");
  assert.doesNotMatch(clientSource, /window\.open\s*\(/);
  assert.doesNotMatch(clientSource, /Boolean\s*\(\s*window\.open/);
  assert.doesNotMatch(clientSource, /pendingWindow|pendingCompanionWindows/);
  assert.doesNotMatch(clientSource, /payload\.url|message\.url/);
  assert.doesNotMatch(clientSource, /openExportStudioPlaceholderWindow|navigateExportStudioWindow|closeExportStudioWindow/);
  assert.match(clientSource, /source\.replace\(\/<body\\b\/i, \(\) => "<head>/, "HTML artifact injection must use a replacement callback so $ sequences in the injected script stay literal.");
  assert.doesNotMatch(helperSource, /\.open\(\s*["']{2}\s*,\s*["']_blank/);
  assert.match(helperSource, /windowLike\.open\(target, "_blank", "noopener"\)/);
  assert.match(helperSource, /windowLike\.open\(pendingUrl, "_blank", "noopener"\)/);
});

test("async Studio URL producers return root-relative targets without absolute URL companions", () => {
  const indexSource = readFileSync(resolve(projectRoot, "index.ts"), "utf-8");
  assert.match(indexSource, /function buildStudioRelativeUrl/);
  assert.match(indexSource, /return `\/\?\$\{params\.toString\(\)\}`/);
  for (const marker of [
    'type: "editor_only_ready"',
    'downloadUrl: `/export-pdf?',
    'downloadUrl: `/export-html?',
  ]) {
    const markerIndex = indexSource.indexOf(marker);
    assert.ok(markerIndex > 0, `Missing response marker: ${marker}`);
    const responseWindow = indexSource.slice(Math.max(0, markerIndex - 500), markerIndex + 500);
    assert.match(responseWindow, /relativeUrl: buildStudioRelativeUrl/);
    assert.doesNotMatch(responseWindow, /\n\s*url,?\s*\n/);
  }
});

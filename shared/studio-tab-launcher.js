const STUDIO_PENDING_KINDS = Object.freeze(["document", "preview", "export"]);
const STUDIO_LAUNCH_ID_PATTERN = /^[a-zA-Z0-9_-]{20,128}$/;
const STUDIO_CSP_NONCE_PATTERN = /^[a-zA-Z0-9_-]{16,128}$/;

function escapeHtmlAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function normalizeStudioPendingKind(value) {
  return STUDIO_PENDING_KINDS.includes(value) ? value : null;
}

export function isValidStudioLaunchId(value) {
  return typeof value === "string" && STUDIO_LAUNCH_ID_PATTERN.test(value);
}

export function buildStudioPendingSecurityHeaders(nonce) {
  if (typeof nonce !== "string" || !STUDIO_CSP_NONCE_PATTERN.test(nonce)) {
    throw new Error("Invalid Studio pending-page CSP nonce.");
  }
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Content-Security-Policy": [
      "default-src 'none'",
      `script-src 'nonce-${nonce}'`,
      `style-src 'nonce-${nonce}'`,
      "base-uri 'none'",
      "form-action 'none'",
      "object-src 'none'",
      "frame-ancestors 'none'",
    ].join("; "),
  };
}

export function buildStudioPendingPage(options) {
  const config = options && typeof options === "object" ? options : {};
  const token = typeof config.token === "string" ? config.token : "";
  const launchId = typeof config.launchId === "string" ? config.launchId : "";
  const kind = normalizeStudioPendingKind(config.kind);
  const nonce = typeof config.nonce === "string" ? config.nonce : "";
  if (!token) throw new Error("Studio pending page requires a token.");
  if (!isValidStudioLaunchId(launchId)) throw new Error("Invalid Studio launch ID.");
  if (!kind) throw new Error("Invalid Studio pending-page kind.");
  buildStudioPendingSecurityHeaders(nonce);

  const kindLabel = kind === "document" ? "document" : (kind === "export" ? "export" : "preview");
  const helperQuery = new URLSearchParams({ token }).toString();
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Preparing Studio tab…</title>
  <style nonce="${escapeHtmlAttribute(nonce)}">
    :root { color-scheme: light dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: Canvas; color: CanvasText; }
    main { width: min(34rem, calc(100vw - 3rem)); padding: 2rem; border: 1px solid color-mix(in srgb, CanvasText 18%, transparent); border-radius: 12px; }
    h1 { margin: 0 0 0.65rem; font-size: 1.15rem; }
    p { margin: 0; line-height: 1.5; opacity: 0.8; overflow-wrap: anywhere; }
    button { margin-top: 1.25rem; padding: 0.45rem 0.8rem; font: inherit; }
    [hidden] { display: none !important; }
  </style>
</head>
<body data-studio-pending-launch="1" data-launch-id="${escapeHtmlAttribute(launchId)}" data-launch-kind="${escapeHtmlAttribute(kind)}" data-studio-token="${escapeHtmlAttribute(token)}">
  <main aria-live="polite" aria-atomic="true">
    <h1 id="pendingTitle">Preparing Studio ${kindLabel}…</h1>
    <p id="pendingDetail">Waiting for the originating Studio page.</p>
    <button id="pendingCloseBtn" type="button" hidden>Close tab</button>
  </main>
  <noscript>This Studio tab requires JavaScript. You can close it and return to the originating Studio page.</noscript>
  <script nonce="${escapeHtmlAttribute(nonce)}" src="/studio-navigation-helpers.js?${escapeHtmlAttribute(helperQuery)}"></script>
</body>
</html>`;
}

export { STUDIO_PENDING_KINDS };

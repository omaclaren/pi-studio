// Browser tests launch a dedicated test Chromium only, never an everyday browser app: headless
// launches of those have disturbed the macOS Dock (Sol and Oliver, 10 Oct). The shell may export
// PUPPETEER_EXECUTABLE_PATH as an everyday browser, so it is checked, not trusted.
import { existsSync } from "node:fs";

export function dedicatedTestBrowser() {
  const path = process.env.PUPPETEER_EXECUTABLE_PATH || "";
  if (!path || !existsSync(path)) return { ok: false, path: null, message: "Set PUPPETEER_EXECUTABLE_PATH to a dedicated test Chromium, such as chrome-headless-shell." };
  if (path.startsWith("/Applications/")) return { ok: false, path: null, message: "PUPPETEER_EXECUTABLE_PATH is an everyday browser app (" + path + "); set it to a dedicated test Chromium instead." };
  return { ok: true, path, message: "" };
}

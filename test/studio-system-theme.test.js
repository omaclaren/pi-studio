import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { systemThemeLacksTrueColor } from "../shared/studio-system-theme.js";
const index = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
const theme = (name, fg, bg) => ({ name, getFgAnsi: () => fg, getBgAnsi: () => bg });

test("Pi's system theme with only terminal palette numbers uses Studio's own palette", () => {
  assert.equal(systemThemeLacksTrueColor(theme("system", "\x1b[39m", "\x1b[44m")), true);
  assert.equal(systemThemeLacksTrueColor(theme("system", "\x1b[38;5;8m", "\x1b[48;5;0m")), true);
  assert.equal(systemThemeLacksTrueColor({ name: "system", getFgAnsi() { throw new Error("no"); }, getBgAnsi() { throw new Error("no"); } }), true);
});
test("true colours from the terminal, and every other theme, keep the normal path", () => {
  assert.equal(systemThemeLacksTrueColor(theme("system", "\x1b[38;2;228;228;228m", "\x1b[48;2;0;48;48m")), false);
  assert.equal(systemThemeLacksTrueColor(theme("dark", "\x1b[38;5;8m", "\x1b[48;5;0m")), false, "named themes may use palette numbers on purpose");
  assert.equal(systemThemeLacksTrueColor(undefined), false);
});
test("the theme builder falls back before reading palette numbers", () => {
  const start = index.indexOf("function getStudioThemeStyle(");
  assert.match(index.slice(start, start + 400), /if \(!theme \|\| systemThemeLacksTrueColor\(theme\)\) \{/);
});

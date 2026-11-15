import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const components = [
  "core", "markup", "css", "clike", "javascript", "typescript", "bash", "c", "cpp",
  "fortran", "go", "java", "json", "julia", "latex", "lua", "matlab", "python",
  "r", "ruby", "rust", "swift", "yaml", "toml", "diff",
];

export const STUDIO_SYNTAX_MODULES = Object.freeze({
  "/studio-syntax-markdown.js": "@lezer/markdown",
  "/studio-syntax-highlight.js": "@lezer/highlight",
  "/studio-syntax-common.js": "@lezer/common",
});

export function buildStudioPrismScript() {
  return "globalThis.Prism = { manual: true };\n" + components.map((name) =>
    readFileSync(require.resolve(`prismjs/components/prism-${name}.js`), "utf8"),
  ).join("\n;\n");
}

export function rewriteStudioSyntaxImports(script, token) {
  return script.replace(/(["'])(@lezer\/(?:common|highlight|markdown))\1/g, (_match, _quote, name) =>
    JSON.stringify(`/studio-syntax-${name.split("/")[1]}.js?token=${encodeURIComponent(token)}`));
}

export function buildStudioSyntaxModuleScript(pathname, token) {
  const entrypoint = require.resolve(STUDIO_SYNTAX_MODULES[pathname]);
  return rewriteStudioSyntaxImports(readFileSync(join(dirname(entrypoint), "index.js"), "utf8"), token);
}

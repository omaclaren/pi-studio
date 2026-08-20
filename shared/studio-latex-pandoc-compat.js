import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const STUDIO_LATEX_LOCAL_STYLE_MAX_BYTES = 2_000_000;
const STUDIO_LATEX_PACKAGE_PATTERN = /\\(usepackage|RequirePackage)(\s*(?:\[[^\]]*\]\s*)?)\{([^{}]+)\}/g;
const STUDIO_LATEX_PACKAGE_NAME_PATTERN = /^[A-Za-z0-9._/+:-]+$/;

function stripStudioLatexStyleComments(source) {
  return String(source || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      let out = "";
      let backslashRun = 0;
      for (const ch of line) {
        if (ch === "%" && backslashRun % 2 === 0) break;
        out += ch;
        if (ch === "\\") backslashRun += 1;
        else backslashRun = 0;
      }
      return out;
    })
    .join("\n");
}

export function doesStudioLatexStyleOverrideDocumentStartup(source) {
  const uncommented = stripStudioLatexStyleComments(source);
  return [
    /\\(?:renewcommand|newcommand|providecommand)\s*\*?\s*(?:\{\s*\\document\s*\}|\\document\b)/,
    /\\(?:def|gdef|edef|xdef)\s*\\document(?:\s|#|\{)/,
    /\\let\s*\\document\s*(?:=\s*)?\\?[A-Za-z@]+/,
    /\\(?:renewenvironment|newenvironment)\s*\*?\s*\{\s*document\s*\}/,
  ].some((pattern) => pattern.test(uncommented));
}

function resolveStudioLocalLatexStyle(packageName, baseDir) {
  const normalizedName = String(packageName || "").trim();
  if (!normalizedName || !STUDIO_LATEX_PACKAGE_NAME_PATTERN.test(normalizedName)) return null;
  const relativeStylePath = normalizedName.toLowerCase().endsWith(".sty")
    ? normalizedName
    : `${normalizedName}.sty`;
  const stylePath = resolve(baseDir, relativeStylePath);
  try {
    const info = statSync(stylePath);
    if (!info.isFile() || info.size > STUDIO_LATEX_LOCAL_STYLE_MAX_BYTES) return null;
    return stylePath;
  } catch {
    return null;
  }
}

function isStudioPandocIncompatibleLocalStyle(packageName, baseDir) {
  const stylePath = resolveStudioLocalLatexStyle(packageName, baseDir);
  if (!stylePath) return null;
  try {
    const styleSource = readFileSync(stylePath, "utf8");
    return doesStudioLatexStyleOverrideDocumentStartup(styleSource) ? stylePath : null;
  } catch {
    return null;
  }
}

function isStudioLatexSourceOffsetCommented(source, offset) {
  const lineStart = source.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
  let backslashRun = 0;
  for (let index = lineStart; index < offset; index += 1) {
    const ch = source[index];
    if (ch === "%" && backslashRun % 2 === 0) return true;
    if (ch === "\\") backslashRun += 1;
    else backslashRun = 0;
  }
  return false;
}

function findStudioLatexDocumentStart(source) {
  const pattern = /\\begin\s*\{document\}/g;
  for (;;) {
    const match = pattern.exec(source);
    if (!match) return source.length;
    if (!isStudioLatexSourceOffsetCommented(source, match.index)) return match.index;
  }
}

export function prepareStudioLatexForPandoc(source, baseDir) {
  const input = String(source || "");
  const normalizedBaseDir = typeof baseDir === "string" ? baseDir.trim() : "";
  if (!input || !normalizedBaseDir) {
    return { source: input, omittedPackages: [] };
  }

  const omittedPackages = [];
  const documentStart = findStudioLatexDocumentStart(input);
  const preparedSource = input.replace(
    STUDIO_LATEX_PACKAGE_PATTERN,
    (match, command, optionText, packageList, offset) => {
      if (offset >= documentStart || isStudioLatexSourceOffsetCommented(input, offset)) return match;
      const packageNames = String(packageList || "")
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);
      if (packageNames.length === 0) return match;

      const retainedPackages = [];
      for (const packageName of packageNames) {
        const stylePath = isStudioPandocIncompatibleLocalStyle(packageName, normalizedBaseDir);
        if (!stylePath) {
          retainedPackages.push(packageName);
          continue;
        }
        if (!omittedPackages.some((entry) => entry.name === packageName && entry.path === stylePath)) {
          omittedPackages.push({ name: packageName, path: stylePath });
        }
      }

      if (retainedPackages.length === packageNames.length) return match;
      if (retainedPackages.length === 0) return "\\relax{}";
      return `\\${command}${optionText || ""}{${retainedPackages.join(",")}}`;
    },
  );

  return { source: preparedSource, omittedPackages };
}

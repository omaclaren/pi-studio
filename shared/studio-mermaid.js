export const STUDIO_MERMAID_ICON_PACKS = Object.freeze([
  Object.freeze({
    name: "lucide",
    packageName: "@iconify-json/lucide",
    url: "https://cdn.jsdelivr.net/npm/@iconify-json/lucide@1.2.120/icons.json",
  }),
  Object.freeze({
    name: "logos",
    packageName: "@iconify-json/logos",
    url: "https://cdn.jsdelivr.net/npm/@iconify-json/logos@1.2.11/icons.json",
  }),
]);

export function usesSupportedStudioMermaidIconPack(source) {
  return /@\{(?:(?!\}).)*\bicon\s*:\s*["'](?:lucide|logos):[^"']+["'](?:(?!\}).)*\}/is.test(String(source || ""));
}

export function buildStudioMermaidCliIconArgs(source) {
  return usesSupportedStudioMermaidIconPack(source)
    ? [
        "--iconPacksNamesAndUrls",
        ...STUDIO_MERMAID_ICON_PACKS.map((pack) => `${pack.name}#${pack.url}`),
      ]
    : [];
}

function parseStudioMermaidCssColor(value) {
  const source = String(value || "").trim().replace(/\s*!important\s*$/i, "");
  const hex = source.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const digits = hex[1].length === 3
      ? hex[1].split("").map((digit) => digit + digit).join("")
      : hex[1];
    return [
      Number.parseInt(digits.slice(0, 2), 16),
      Number.parseInt(digits.slice(2, 4), 16),
      Number.parseInt(digits.slice(4, 6), 16),
    ];
  }
  const rgb = source.match(/^rgb\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/i);
  return rgb
    ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])].map((channel) => Math.max(0, Math.min(255, channel)))
    : null;
}

function studioMermaidRelativeLuminance(color) {
  const linear = color.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function studioMermaidContrastRatio(foreground, background) {
  const lighter = Math.max(studioMermaidRelativeLuminance(foreground), studioMermaidRelativeLuminance(background));
  const darker = Math.min(studioMermaidRelativeLuminance(foreground), studioMermaidRelativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function formatStudioMermaidHexColor(color) {
  return `#${color.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
}

function ensureStudioMermaidReadableColor(foreground, background) {
  if (studioMermaidContrastRatio(foreground, background) >= 4.5) return foreground;
  const candidates = [[0, 0, 0], [255, 255, 255]].flatMap((target) => {
    for (let step = 1; step <= 20; step += 1) {
      const amount = step / 20;
      const color = foreground.map((channel, index) => channel + (target[index] - channel) * amount);
      if (studioMermaidContrastRatio(color, background) >= 4.5) return [{ amount, color }];
    }
    return [];
  });
  candidates.sort((left, right) => left.amount - right.amount);
  if (candidates.length > 0) return candidates[0].color;
  const black = [0, 0, 0];
  const white = [255, 255, 255];
  return studioMermaidContrastRatio(black, background) >= studioMermaidContrastRatio(white, background)
    ? black
    : white;
}

function splitStudioMermaidStyleDeclarations(source) {
  source = String(source || "");
  const declarations = [];
  let start = 0;
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") depth += 1;
    if (char === ")" && depth > 0) depth -= 1;
    if ((char === "," || char === ";") && depth === 0) {
      const declaration = source.slice(start, index).trim();
      if (declaration) declarations.push(declaration);
      start = index + 1;
    }
  }
  const tail = source.slice(start).trim();
  if (tail) declarations.push(tail);
  return declarations;
}

function getStudioMermaidStyleDeclaration(declarations, property) {
  const propertyLower = property.toLowerCase();
  return declarations.find((declaration) => {
    const separator = declaration.indexOf(":");
    return separator >= 0 && declaration.slice(0, separator).trim().toLowerCase() === propertyLower;
  }) || null;
}

function getStudioMermaidStyleValue(declaration) {
  if (!declaration) return "";
  const separator = declaration.indexOf(":");
  return separator >= 0 ? declaration.slice(separator + 1).trim() : "";
}

function upsertStudioMermaidStyleDeclaration(declarations, property, value) {
  const existing = getStudioMermaidStyleDeclaration(declarations, property);
  const corrected = `${property}:${value}`;
  if (existing) {
    declarations[declarations.indexOf(existing)] = corrected;
  } else {
    declarations.push(corrected);
  }
}

function correctStudioMermaidStyleContrast(styleSource, options = {}) {
  const hadSemicolon = /;\s*$/.test(styleSource);
  const declarations = splitStudioMermaidStyleDeclarations(styleSource);
  const fillDeclaration = getStudioMermaidStyleDeclaration(declarations, "fill");
  const background = parseStudioMermaidCssColor(getStudioMermaidStyleValue(fillDeclaration));
  if (!background) return styleSource;

  const colorDeclaration = getStudioMermaidStyleDeclaration(declarations, "color");
  const authoredForeground = colorDeclaration
    ? parseStudioMermaidCssColor(getStudioMermaidStyleValue(colorDeclaration))
    : null;
  if (colorDeclaration && !authoredForeground) return styleSource;

  const fallbackForeground = studioMermaidContrastRatio([0, 0, 0], background) >= studioMermaidContrastRatio([255, 255, 255], background)
    ? [0, 0, 0]
    : [255, 255, 255];
  const readable = ensureStudioMermaidReadableColor(authoredForeground || fallbackForeground, background);
  upsertStudioMermaidStyleDeclaration(declarations, "color", formatStudioMermaidHexColor(readable));

  if (options.correctIconStroke) {
    const strokeDeclaration = getStudioMermaidStyleDeclaration(declarations, "stroke");
    const authoredStroke = parseStudioMermaidCssColor(getStudioMermaidStyleValue(strokeDeclaration));
    if (!strokeDeclaration || authoredStroke) {
      const readableStroke = ensureStudioMermaidReadableColor(authoredStroke || readable, background);
      upsertStudioMermaidStyleDeclaration(declarations, "stroke", formatStudioMermaidHexColor(readableStroke));
    }
  }

  return declarations.join(",") + (hadSemicolon ? ";" : "");
}

function collectStudioMermaidIconStyleTargets(source) {
  const iconNodeIds = new Set();
  const iconNodePattern = /\b([A-Za-z_][\w-]*)\s*@\{(?:(?!\}).)*\bicon\s*:\s*["'](?:lucide|logos):[^"']+["'](?:(?!\}).)*\}/gis;
  let iconNodeMatch;
  while ((iconNodeMatch = iconNodePattern.exec(source)) !== null) {
    iconNodeIds.add(iconNodeMatch[1]);
  }

  const iconClassNames = new Set();
  const classNamesByNode = new Map();
  for (const line of source.split(/\r?\n/)) {
    const classMatch = line.match(/^\s*class\s+(\S+)\s+(\S+)\s*;?\s*$/i);
    if (!classMatch) continue;
    const nodeIds = classMatch[1].split(",").map((value) => value.trim()).filter(Boolean);
    const classNames = classMatch[2].replace(/;$/, "").split(",").map((value) => value.trim()).filter(Boolean);
    nodeIds.forEach((nodeId) => {
      const assigned = classNamesByNode.get(nodeId) || [];
      classNamesByNode.set(nodeId, [...assigned, ...classNames]);
    });
    if (!nodeIds.some((nodeId) => iconNodeIds.has(nodeId))) continue;
    classNames.forEach((className) => {
      iconClassNames.add(className);
    });
  }
  return { iconNodeIds, iconClassNames, classNamesByNode };
}

export function ensureStudioMermaidSourceContrast(source) {
  const text = String(source || "");
  const { iconNodeIds, iconClassNames } = collectStudioMermaidIconStyleTargets(text);
  return text
    .split(/(\r?\n)/)
    .map((part) => {
      if (/^\r?\n$/.test(part)) return part;
      const match = part.match(/^(\s*)(classDef|style)\s+(\S+)\s+(.*?)(\s*)$/i);
      if (!match) return part;
      const targets = match[3].replace(/;$/, "").split(",").map((value) => value.trim()).filter(Boolean);
      const correctIconStroke = match[2].toLowerCase() === "classdef"
        ? targets.some((target) => iconClassNames.has(target))
        : targets.some((target) => iconNodeIds.has(target));
      const correctedStyles = correctStudioMermaidStyleContrast(match[4], { correctIconStroke });
      return `${match[1]}${match[2]} ${match[3]} ${correctedStyles}${match[5]}`;
    })
    .join("");
}

function collectStudioMermaidStylesByTarget(source, directiveName) {
  const stylesByTarget = new Map();
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*(classDef|style)\s+(\S+)\s+(.*?)\s*$/i);
    if (!match || match[1].toLowerCase() !== directiveName.toLowerCase()) continue;
    const targets = match[2].replace(/;$/, "").split(",").map((value) => value.trim()).filter(Boolean);
    targets.forEach((target) => stylesByTarget.set(target, match[3]));
  }
  return stylesByTarget;
}

function getStudioMermaidIconPaintColor(styleSource) {
  const declarations = splitStudioMermaidStyleDeclarations(styleSource);
  const fill = parseStudioMermaidCssColor(getStudioMermaidStyleValue(getStudioMermaidStyleDeclaration(declarations, "fill")));
  if (!fill) return null;
  const stroke = parseStudioMermaidCssColor(getStudioMermaidStyleValue(getStudioMermaidStyleDeclaration(declarations, "stroke")));
  const color = parseStudioMermaidCssColor(getStudioMermaidStyleValue(getStudioMermaidStyleDeclaration(declarations, "color")));
  return stroke || color ? formatStudioMermaidHexColor(stroke || color) : null;
}

function buildStudioMermaidIconPaintRule(selector, color) {
  const paintedElements = ["g", "path", "rect", "polygon", "circle", "ellipse", "line", "polyline"];
  const fillSelectors = paintedElements.map((element) => `${selector} svg ${element}[fill]:not([fill="none"])`).join(",\n");
  const strokeSelectors = paintedElements.map((element) => `${selector} svg ${element}[stroke]:not([stroke="none"])`).join(",\n");
  return [
    `${selector} svg { color: ${color} !important; }`,
    `${fillSelectors} { fill: ${color} !important; }`,
    `${strokeSelectors} { stroke: ${color} !important; }`,
  ].join("\n");
}

function buildStudioMermaidPdfPrintColorRule() {
  return [
    ".node, .node *, .icon-shape, .icon-shape * {",
    "  -webkit-print-color-adjust: exact !important;",
    "  print-color-adjust: exact !important;",
    "}",
  ].join("\n");
}

function buildStudioMermaidPdfIconLabelRule(selectors, theme) {
  if (selectors.length === 0) return "";
  const darkTheme = String(theme || "default").toLowerCase() === "dark";
  const background = darkTheme ? "#1f2937" : "#ffffff";
  const foreground = darkTheme ? "#ffffff" : "#000000";
  const backgroundSelectors = selectors.map((selector) => `${selector} .labelBkg`).join(",\n");
  const textSelectors = selectors.flatMap((selector) => [
    `${selector} .nodeLabel`,
    `${selector} .nodeLabel *`,
  ]).join(",\n");
  return [
    `${backgroundSelectors} { background-color: ${background} !important; }`,
    `${textSelectors} {`,
    `  color: ${foreground} !important;`,
    `  fill: ${foreground} !important;`,
    `  -webkit-text-fill-color: ${foreground} !important;`,
    "  opacity: 1 !important;",
    "}",
  ].join("\n");
}

export function buildStudioMermaidPdfIconContrastCss(source, options = {}) {
  const preparedSource = ensureStudioMermaidSourceContrast(source);
  const { iconNodeIds, classNamesByNode } = collectStudioMermaidIconStyleTargets(preparedSource);
  const printColorRule = buildStudioMermaidPdfPrintColorRule();
  if (iconNodeIds.size === 0) return printColorRule;
  const classStyles = collectStudioMermaidStylesByTarget(preparedSource, "classDef");
  const directStyles = collectStudioMermaidStylesByTarget(preparedSource, "style");
  const iconSelectors = Array.from(iconNodeIds, (iconNodeId) => `.icon-shape[id*="flowchart-${iconNodeId}-"]`);
  const rulesBySelector = new Map();

  for (const iconNodeId of iconNodeIds) {
    const classNames = classNamesByNode.get(iconNodeId) || [];
    const classPaint = [...classNames].reverse()
      .map((className) => getStudioMermaidIconPaintColor(classStyles.get(className)))
      .find(Boolean);
    const directPaint = getStudioMermaidIconPaintColor(directStyles.get(iconNodeId));
    const paint = directPaint || classPaint;
    if (paint) rulesBySelector.set(`.icon-shape[id*="flowchart-${iconNodeId}-"]`, paint);
  }

  return [
    printColorRule,
    buildStudioMermaidPdfIconLabelRule(iconSelectors, options.theme),
    ...Array.from(rulesBySelector, ([selector, color]) => buildStudioMermaidIconPaintRule(selector, color)),
  ].filter(Boolean).join("\n");
}

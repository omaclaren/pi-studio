import {
  advancePastStudioInlineBacktickSpan,
  isStudioAnnotationWordChar,
  normalizeStudioAnnotationText,
  readStudioAnnotationProtectedTokenAt,
} from "./studio-annotation-scanner.js";

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function canOpenAnnotationInlineDelimiter(source, startIndex, delimiter) {
  const text = String(source || "");
  if (text.slice(startIndex, startIndex + delimiter.length) !== delimiter) return false;
  const prev = startIndex > 0 ? text[startIndex - 1] : "";
  const next = text[startIndex + delimiter.length] || "";
  if (!next || /\s/.test(next)) return false;
  return !isStudioAnnotationWordChar(prev);
}

function canCloseAnnotationInlineDelimiter(source, startIndex, delimiter) {
  const text = String(source || "");
  if (text.slice(startIndex, startIndex + delimiter.length) !== delimiter) return false;
  const prev = startIndex > 0 ? text[startIndex - 1] : "";
  const next = text[startIndex + delimiter.length] || "";
  if (!prev || /\s/.test(prev)) return false;
  return !isStudioAnnotationWordChar(next);
}

function readAnnotationInlineSpanAt(source, startIndex, delimiter, tagName) {
  const text = String(source || "");
  if (!canOpenAnnotationInlineDelimiter(text, startIndex, delimiter)) return null;

  let index = startIndex + delimiter.length;
  while (index < text.length) {
    if (text[index] === "\\") {
      index = Math.min(text.length, index + 2);
      continue;
    }

    const protectedToken = readStudioAnnotationProtectedTokenAt(text, index);
    if (protectedToken) {
      index = protectedToken.end;
      continue;
    }

    if (canCloseAnnotationInlineDelimiter(text, index, delimiter)) {
      const inner = text.slice(startIndex + delimiter.length, index);
      return {
        end: index + delimiter.length,
        html: `<${tagName}>${renderAnnotationPlainInlineHtml(inner)}</${tagName}>`,
      };
    }

    index += 1;
  }

  return null;
}

function renderAnnotationCodeSpanHtml(rawToken) {
  const raw = String(rawToken || "");
  if (!raw || raw[0] !== "`") return escapeHtml(raw);

  let fenceLength = 1;
  while (raw[fenceLength] === "`") fenceLength += 1;
  const fence = "`".repeat(fenceLength);
  if (raw.length < fenceLength * 2 || raw.slice(raw.length - fenceLength) !== fence) {
    return escapeHtml(raw);
  }

  return `<code>${escapeHtml(raw.slice(fenceLength, raw.length - fenceLength))}</code>`;
}

function renderAnnotationPlainInlineHtml(text) {
  const source = String(text || "");
  let out = "";
  let index = 0;

  while (index < source.length) {
    const strikeMatch = readAnnotationInlineSpanAt(source, index, "~~", "s");
    if (strikeMatch) {
      out += strikeMatch.html;
      index = strikeMatch.end;
      continue;
    }

    const strongMatch = readAnnotationInlineSpanAt(source, index, "**", "strong")
      || readAnnotationInlineSpanAt(source, index, "__", "strong");
    if (strongMatch) {
      out += strongMatch.html;
      index = strongMatch.end;
      continue;
    }

    const emphasisMatch = readAnnotationInlineSpanAt(source, index, "*", "em")
      || readAnnotationInlineSpanAt(source, index, "_", "em");
    if (emphasisMatch) {
      out += emphasisMatch.html;
      index = emphasisMatch.end;
      continue;
    }

    out += escapeHtml(source[index]);
    index += 1;
  }

  return out;
}

export function renderStudioAnnotationInlineHtml(text) {
  const source = normalizeStudioAnnotationText(text);
  let out = "";
  let plainStart = 0;
  let index = 0;

  while (index < source.length) {
    const token = readStudioAnnotationProtectedTokenAt(source, index);
    if (!token) {
      index += 1;
      continue;
    }

    if (index > plainStart) {
      out += renderAnnotationPlainInlineHtml(source.slice(plainStart, index));
    }

    if (token.type === "code") {
      out += renderAnnotationCodeSpanHtml(token.raw);
    } else {
      out += escapeHtml(token.raw);
    }

    index = token.end;
    plainStart = index;
  }

  if (plainStart < source.length) {
    out += renderAnnotationPlainInlineHtml(source.slice(plainStart));
  }

  return out;
}

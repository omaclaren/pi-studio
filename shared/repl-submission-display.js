import { createHash } from "node:crypto";

export const REPL_SUBMISSION_DISPLAY_VERSION = 1;
export const DEFAULT_REPL_SUBMISSION_ECHO_MODE = "off";
export const REPL_SUBMISSION_ECHO_MODES = Object.freeze(["off", "summary", "full"]);
export const REPL_SUBMISSION_SUMMARY_MAX_CHARS = 600;
export const REPL_SUBMISSION_SUMMARY_MAX_LINES = 6;
export const REPL_SUBMISSION_FULL_MAX_CHARS = 4_000;
export const REPL_SUBMISSION_FULL_MAX_LINES = 40;

const UNSAFE_UNICODE_PATTERN = /[\u2028\u2029\u202a-\u202e\u2066-\u2069]/g;
const OTHER_CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;
const COMPACT_BEGIN_MARKER_PATTERN = /^── ([a-z0-9][a-z0-9-]{0,31}) · ([a-f0-9]{12}) · ([1-9]\d*) (line|lines) ──$/;
const COMPACT_OUTPUT_MARKER = "── output ──";
const COMPACT_END_MARKER_PATTERN = /^── done · ([a-f0-9]{12}) ──$/;
const LEGACY_MARKER_PATTERN = /^── ([a-z0-9][a-z0-9-]{0,31}) (submitted|output|complete)(?: · ([1-9]\d*) (line|lines))? · ([a-f0-9]{12}) ──$/;

export function normalizeReplSubmissionEchoMode(value, fallback = DEFAULT_REPL_SUBMISSION_ECHO_MODE) {
	const normalizedFallback = REPL_SUBMISSION_ECHO_MODES.includes(String(fallback || "").trim().toLowerCase())
		? String(fallback).trim().toLowerCase()
		: DEFAULT_REPL_SUBMISSION_ECHO_MODE;
	const normalized = String(value || "").trim().toLowerCase();
	return REPL_SUBMISSION_ECHO_MODES.includes(normalized) ? normalized : normalizedFallback;
}

function escapeCodePoint(char) {
	const codePoint = char.codePointAt(0) ?? 0;
	return codePoint <= 0xff
		? `\\x${codePoint.toString(16).padStart(2, "0")}`
		: `\\u{${codePoint.toString(16)}}`;
}

export function sanitizeReplSubmissionDisplayText(value) {
	return String(value || "")
		.replace(/\r\n?/g, "\n")
		.replace(/\t/g, "    ")
		.replace(OTHER_CONTROL_PATTERN, escapeCodePoint)
		.replace(UNSAFE_UNICODE_PATTERN, escapeCodePoint);
}

function truncateCodePoints(value, maxChars) {
	const chars = Array.from(String(value || ""));
	if (chars.length <= maxChars) return { text: chars.join(""), truncated: false };
	return { text: `${chars.slice(0, Math.max(0, maxChars - 1)).join("")}…`, truncated: true };
}

function normalizeDisplayCode(code) {
	const sanitized = sanitizeReplSubmissionDisplayText(code)
		.split("\n")
		.map((line) => line.replace(/ +$/g, ""))
		.join("\n")
		.replace(/\n+$/, "");
	return sanitized || "(empty submission)";
}

function formatPreviewLine(line) {
	return line ? `│ ${line}` : "│";
}

function buildBoundedPreviewLines(codeLines, maxLines, maxChars) {
	const shown = [];
	let usedChars = 0;
	let truncated = false;
	for (let index = 0; index < codeLines.length; index += 1) {
		if (shown.length >= maxLines) {
			truncated = true;
			break;
		}
		const line = codeLines[index];
		const remaining = maxChars - usedChars;
		if (remaining <= 0) {
			truncated = true;
			break;
		}
		const clipped = truncateCodePoints(line, remaining);
		shown.push(formatPreviewLine(clipped.text));
		usedChars += Array.from(clipped.text).length + 1;
		if (clipped.truncated) {
			truncated = true;
			break;
		}
	}
	if (shown.length < codeLines.length) truncated = true;
	if (truncated) shown.push(`│ … preview truncated; ${codeLines.length} ${codeLines.length === 1 ? "line" : "lines"} total`);
	return shown;
}

export function createReplSubmissionDisplay(details = {}) {
	const mode = normalizeReplSubmissionEchoMode(details.mode);
	const origin = String(details.origin || "pi")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 32) || "pi";
	const entryId = String(details.entryId || "");
	const anchorId = createHash("sha256")
		.update(`pi-repl-submission-display-v${REPL_SUBMISSION_DISPLAY_VERSION}\0${entryId}`, "utf8")
		.digest("hex")
		.slice(0, 12);
	const displayCode = normalizeDisplayCode(details.code);
	const codeLines = displayCode.split("\n");
	const lineLabel = `${codeLines.length} ${codeLines.length === 1 ? "line" : "lines"}`;
	const beginMarker = `── ${origin} · ${anchorId} · ${lineLabel} ──`;
	const outputMarker = COMPACT_OUTPUT_MARKER;
	const endMarker = `── done · ${anchorId} ──`;
	const enabled = mode !== "off";
	const previewLines = !enabled
		? []
		: mode === "full"
			? buildBoundedPreviewLines(codeLines, REPL_SUBMISSION_FULL_MAX_LINES, REPL_SUBMISSION_FULL_MAX_CHARS)
			: buildBoundedPreviewLines(codeLines, REPL_SUBMISSION_SUMMARY_MAX_LINES, REPL_SUBMISSION_SUMMARY_MAX_CHARS);
	return {
		version: REPL_SUBMISSION_DISPLAY_VERSION,
		mode,
		enabled,
		origin,
		entryId,
		anchorId,
		beginMarker,
		outputMarker,
		endMarker,
		previewLines,
		prefixLines: enabled ? [beginMarker, ...previewLines, outputMarker] : [],
	};
}

function parseLineCount(countText, countLabel) {
	const lineCount = Number(countText);
	if (!Number.isSafeInteger(lineCount) || lineCount < 1) return null;
	if ((lineCount === 1) !== (countLabel === "line")) return null;
	return lineCount;
}

export function parseReplSubmissionDisplayMarker(line) {
	const normalized = String(line || "").replace(/\r$/, "");
	const compactBegin = normalized.match(COMPACT_BEGIN_MARKER_PATTERN);
	if (compactBegin) {
		const [, origin, anchorId, countText, countLabel] = compactBegin;
		const lineCount = parseLineCount(countText, countLabel);
		return lineCount === null
			? null
			: { version: REPL_SUBMISSION_DISPLAY_VERSION, origin, phase: "submitted", anchorId, lineCount };
	}
	if (normalized === COMPACT_OUTPUT_MARKER) {
		return { version: REPL_SUBMISSION_DISPLAY_VERSION, phase: "output" };
	}
	const compactEnd = normalized.match(COMPACT_END_MARKER_PATTERN);
	if (compactEnd) {
		return { version: REPL_SUBMISSION_DISPLAY_VERSION, phase: "complete", anchorId: compactEnd[1] };
	}

	// Accept the earlier three-marker development format so raw histories made
	// while testing it remain interpretable; new displays do not emit this form.
	const legacy = normalized.match(LEGACY_MARKER_PATTERN);
	if (!legacy) return null;
	const [, origin, phase, countText, countLabel, anchorId] = legacy;
	if (phase === "submitted") {
		if (!countText) return null;
		const lineCount = parseLineCount(countText, countLabel);
		return lineCount === null
			? null
			: { version: REPL_SUBMISSION_DISPLAY_VERSION, origin, phase, anchorId, lineCount, legacy: true };
	}
	if (countText) return null;
	return { version: REPL_SUBMISSION_DISPLAY_VERSION, origin, phase, anchorId, legacy: true };
}

function consumeExactDisplayLine(value, offset, line) {
	if (!value.startsWith(line, offset)) return null;
	let end = offset + line.length;
	while (end < value.length && (value[end] === " " || value[end] === "\t")) end += 1;
	if (end < value.length && value[end] !== "\n") return null;
	return value[end] === "\n" ? end + 1 : end;
}

function findExactDisplayLine(value, line, useLast = false) {
	let index = useLast ? value.lastIndexOf(line) : value.indexOf(line);
	while (index >= 0) {
		const startsLine = index === 0 || value[index - 1] === "\n";
		const end = consumeExactDisplayLine(value, index, line);
		if (startsLine && end !== null) return { index, end };
		if (useLast) {
			if (index === 0) break;
			index = value.lastIndexOf(line, index - 1);
		} else {
			index = value.indexOf(line, index + line.length);
		}
	}
	return null;
}

function removeMarkerLine(value, marker, useLast = false) {
	const found = findExactDisplayLine(value, marker, useLast);
	return found ? value.slice(0, found.index) + value.slice(found.end) : value;
}

export function stripReplSubmissionDisplay(output, display) {
	let value = String(output || "").replace(/\r\n?/g, "\n");
	if (!display || display.enabled !== true) return value;
	const begin = findExactDisplayLine(value, display.beginMarker);
	if (begin) {
		const beginIndex = begin.index;
		const afterBegin = value.slice(begin.end);
		const outputDivider = display.outputMarker
			? findExactDisplayLine(afterBegin, display.outputMarker)
			: null;
		if (outputDivider) {
			// The plain divider is an unambiguous boundary because it is emitted
			// before user code runs. Removing through it is resilient to terminal
			// wrapping or whitespace changes within the displayed source preview.
			const suffixStart = begin.end + outputDivider.end;
			value = value.slice(0, beginIndex) + value.slice(suffixStart);
		} else {
			// If the runtime disappears mid-prefix, remove only contiguous exact
			// request lines and preserve any different error text after them.
			let suffixStart = beginIndex;
			for (const line of display.prefixLines) {
				const next = consumeExactDisplayLine(value, suffixStart, line);
				if (next === null) break;
				suffixStart = next;
			}
			value = value.slice(0, beginIndex) + value.slice(suffixStart);
		}
	}
	return removeMarkerLine(value, display.endMarker, true);
}

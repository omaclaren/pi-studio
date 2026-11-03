import { createHash, createHmac } from "node:crypto";
import { realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { extname, isAbsolute, resolve } from "node:path";

/*
 * Image and PDF files a REPL record entry's code saved, such as a plot, so the REPL pane can show
 * them, as pi-markdown-preview's REPL page does (its repl-files.js). A file counts only if the
 * entry's code or output names it and it was written while the entry ran: reading names from
 * text can't be made exact across languages and prose, so the time it was written decides
 * whether a name found there is shown (Sol, Astra, candidate 116). The page gets each file
 * through an opaque route that only this list makes; nothing else is served.
 */

export const STUDIO_REPL_FILE_CONTENT_TYPES = new Map([
	[".png", "image/png"], [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"], [".gif", "image/gif"],
	[".webp", "image/webp"], [".svg", "image/svg+xml"], [".pdf", "application/pdf"],
]);
const EXTENSIONS = "png|jpe?g|gif|webp|svg|pdf";
// A quoted path, as code writes one: savefig("out/fit.png"), png('plot.png'), `fit 2.png`.
const QUOTES = new Set(['"', "'", "`"]);
const QUOTED_PATH = new RegExp(`^[^\\r\\n\\0]{1,1024}\\.(?:${EXTENSIONS})$`, "i");
// A bare path, as output prints one: "Saved to /tmp/fit.png." (a sentence's full stop isn't part of it).
const BARE = new RegExp(`(?:^|[\\s(=:,\\[])((?:~|\\.{1,2})?\\/?(?:[\\w@%+.,~-]+\\/)*[\\w@%+.,~-]+\\.(?:${EXTENSIONS}))(?=$|[\\s)\\]:;,'"]|\\.(?:\\s|$))`, "gim");
const CANDIDATES_PER_ENTRY = 20;
// How long after an entry finished a file it names may still have been written by its code,
// such as by a plotting process that flushes after the prompt returns.
export const STUDIO_REPL_FILE_WRITE_GRACE_MS = 2_000;
export const STUDIO_REPL_FILES_PER_ENTRY = 6;
// The pane shows a session's latest 12 entries; only they are looked at.
export const STUDIO_REPL_FILE_ENTRIES = 12;
const STUDIO_REPL_FILE_ROUTES = 500;
// Versions of one file a route serves: those the page has been shown, the latest few.
const STUDIO_REPL_FILE_ROUTE_VERSIONS = 8;
export const STUDIO_REPL_FILE_MAX_BYTES = 64 * 1024 * 1024;

/**
 * A text's quoted spans, each closed by its own delimiter on the same line, and the text with
 * them blanked. Inside a span a backslash escapes the next character and a doubled delimiter
 * stands for one (MATLAB's 'O''Brien'), so neither ends it; a span holding either isn't a name
 * as written, so it names nothing (`plain: false`). A quote with no close on its line, such as
 * an apostrophe in prose, starts no span, and nor do later copies of it on that line, so the
 * scan stays linear however many there are (agent-markdown-preview's rule).
 */
function quotedSpans(text) {
	const spans = [];
	let unquoted = "";
	// Where each quote last found no close: the end of that line.
	const unclosedUntil = new Map();
	let index = 0;
	while (index < text.length) {
		const quote = text[index];
		let end = index + 1;
		let closed = false;
		let plain = true;
		if (QUOTES.has(quote) && !(unclosedUntil.get(quote) > index)) {
			while (end < text.length && text[end] !== "\n" && text[end] !== "\r") {
				if (text[end] === "\\" && end + 1 < text.length && text[end + 1] !== "\n" && text[end + 1] !== "\r") { plain = false; end += 2; continue; }
				if (text[end] === quote) {
					if (text[end + 1] === quote) { plain = false; end += 2; continue; }
					closed = true;
					break;
				}
				end += 1;
			}
			if (!closed) unclosedUntil.set(quote, end);
		}
		if (closed) {
			spans.push({ text: text.slice(index + 1, end), plain });
			unquoted += " ".repeat(end + 1 - index);
			index = end + 1;
		} else {
			unquoted += quote;
			index += 1;
		}
	}
	return { spans, unquoted };
}

/**
 * The image and PDF paths an entry names, output first, as written, in order and without repeats.
 * A quoted path is taken whole, and nothing inside quotes is searched again for bare paths, so
 * "fit 2.png" and "O'Brien fit.png" can't name 2.png or fit.png (Sol, Astra, candidate 116).
 * A quoted name that isn't a supported path as written names nothing. Prose and other
 * languages' quoting can still mislead this; resolveStudioReplFiles's time check decides.
 */
export function studioReplFilePaths(entry) {
	const found = new Set();
	for (const text of [entry?.output, entry?.code]) {
		if (typeof text !== "string") continue;
		const { spans, unquoted } = quotedSpans(text);
		for (const span of spans) if (span.plain && QUOTED_PATH.test(span.text)) found.add(span.text);
		for (const match of unquoted.matchAll(BARE)) found.add(match[1]);
	}
	return [...found].slice(0, CANDIDATES_PER_ENTRY);
}

/** A written path made absolute: against home for `~/`, else against the session's directory, if it has one. */
function resolveWritten(written, cwd) {
	if (written.startsWith("~/")) return resolve(homedir(), written.slice(2));
	if (isAbsolute(written)) return resolve(written);
	const directory = cwd();
	return typeof directory === "string" && isAbsolute(directory) ? resolve(directory, written) : undefined;
}

/**
 * A file's version: it changes when the file is written or replaced, even by a copy that keeps
 * its modification time (cp -p), which changes its inode or change time (Sol, candidate 116).
 */
function studioReplFileVersion(info) {
	return createHash("sha256").update([info.dev, info.ino, info.size, info.mtimeMs, info.ctimeMs].join(":")).digest("hex").slice(0, 16);
}

/**
 * When an entry's code could have written a file: from when the entry was recorded, before its
 * code was sent, to a little after it finished, or after now while it runs (a file's time is
 * finer than Date.now()'s). Undefined for an entry without a usable start time, which then
 * shows no files.
 */
function studioReplEntryWriteWindow(entry, now) {
	const start = Number(entry?.createdAt);
	if (!Number.isFinite(start) || start <= 0) return undefined;
	if (entry.status === "sending" || entry.status === "sent") return { start, end: now + STUDIO_REPL_FILE_WRITE_GRACE_MS };
	const finished = Number.isFinite(Number(entry.completedAt)) && Number(entry.completedAt) > 0 ? Number(entry.completedAt) : Number(entry.updatedAt);
	return { start, end: (Number.isFinite(finished) && finished >= start ? finished : start) + STUDIO_REPL_FILE_WRITE_GRACE_MS };
}

/**
 * When an entry finished: its completion, or for a finished status without one its last update.
 * Undefined while it's sending or sent, or without a usable time.
 */
function studioReplEntryFinish(entry) {
	const completed = Number(entry.completedAt);
	if (Number.isFinite(completed) && completed > 0) return completed;
	if (entry.status === "sending" || entry.status === "sent") return undefined;
	const updated = Number(entry.updatedAt);
	return Number.isFinite(updated) && updated > 0 ? updated : undefined;
}

/**
 * When each entry with code had its session to itself. Sends to a session take turns under its
 * lease, but not in the order they were recorded: a page's send is recorded before it waits for
 * the lease, an agent's once it has it (Sol, candidate 116 round 5). So the order is the order
 * they finished in. An entry's turn starts when it was recorded or when the one before it
 * finished, whichever is later, and a file written once the next one started is the next one's.
 * `start` and `before` bound the time a file was written.
 * - While entries are still running, the last to finish keeps no grace after it: one of them
 *   may have started then. Each running entry starts at the last finish or its recording.
 * - Notes have no code and don't count; an entry without a usable time has no bounds.
 *
 * @returns {Map<string, { start: number, before: number }>} by entry ID
 */
export function studioReplSessionRunBounds(entries) {
	const sessions = new Map();
	for (const entry of entries ?? []) {
		if (!entry || entry.status === "note" || typeof entry.code !== "string" || !entry.code.trim()) continue;
		if (!Number.isFinite(Number(entry.createdAt)) || Number(entry.createdAt) <= 0) continue;
		const list = sessions.get(entry.sessionName) ?? [];
		list.push(entry);
		sessions.set(entry.sessionName, list);
	}
	const bounds = new Map();
	for (const list of sessions.values()) {
		const finished = [];
		const running = [];
		for (const entry of list) {
			const finish = studioReplEntryFinish(entry);
			if (finish !== undefined) finished.push({ entry, finish });
			else if (entry.status === "sending" || entry.status === "sent") running.push(entry);
		}
		finished.sort((a, b) => a.finish - b.finish);
		let lastFinish = -Infinity;
		const starts = finished.map(({ entry, finish }) => {
			const start = Math.max(Number(entry.createdAt), lastFinish);
			lastFinish = finish;
			return start;
		});
		finished.forEach(({ entry, finish }, index) => {
			const before = index + 1 < finished.length ? starts[index + 1] : running.length ? finish : Infinity;
			bounds.set(entry.id, { start: starts[index], before });
		});
		for (const entry of running) bounds.set(entry.id, { start: Math.max(Number(entry.createdAt), lastFinish), before: Infinity });
	}
	return bounds;
}

/**
 * The files an entry names that its code wrote: up to STUDIO_REPL_FILES_PER_ENTRY of
 * `{ written, path, contentType, version }`, each a regular file last modified while the entry
 * ran (studioReplEntryWriteWindow). A file written before it, such as one whose name merely
 * shares a tail with the name the code wrote, or rewritten since by a later entry, isn't
 * shown. `bounds` (studioReplSessionRunBounds) narrows that to the entry's own turn in its
 * session. `cwd` gives the session's working directory, for relative paths: a string, or a
 * function asked at most once, and only for a relative path. Without it only absolute and
 * `~/` paths resolve.
 *
 * @param {any} entry
 * @param {string | (() => string | undefined) | undefined} cwd
 * @param {{ statFile?: (path: string) => import("node:fs").Stats, now?: number, bounds?: { start: number, before: number } }} [options]
 */
export function resolveStudioReplFiles(entry, cwd, { statFile = statSync, now = Date.now(), bounds } = {}) {
	const window = studioReplEntryWriteWindow(entry, now);
	if (!window) return [];
	const start = Math.max(window.start, Number.isFinite(bounds?.start) ? bounds.start : -Infinity);
	const before = typeof bounds?.before === "number" ? bounds.before : Infinity;
	let directory;
	let asked = false;
	const directoryOnce = () => {
		if (!asked) { asked = true; directory = typeof cwd === "function" ? cwd() : cwd; }
		return directory;
	};
	const files = [];
	for (const written of studioReplFilePaths(entry)) {
		if (files.length >= STUDIO_REPL_FILES_PER_ENTRY) break;
		const contentType = STUDIO_REPL_FILE_CONTENT_TYPES.get(extname(written).toLowerCase());
		if (!contentType) continue;
		const path = resolveWritten(written, directoryOnce);
		if (!path || files.some((file) => file.path === path)) continue;
		let info;
		try { info = statFile(path); } catch { continue; }
		if (!info?.isFile() || !(info.mtimeMs >= start && info.mtimeMs <= window.end && info.mtimeMs < before)) continue;
		files.push({ written, path, contentType, version: studioReplFileVersion(info) });
	}
	return files;
}

/**
 * Routes for the files the page has been shown: an opaque ID per path, keyed to this Studio
 * server's token, kept for the most recent STUDIO_REPL_FILE_ROUTES files. A route serves only
 * the versions of its file the page was shown (Sol, candidate 116 round 4), so a file replaced
 * since, by anything, isn't served until an entry shows that version.
 */
export function createStudioReplFileRoutes(secret) {
	const routes = new Map();
	return {
		add(file) {
			const id = createHmac("sha256", secret).update("repl-file\0").update(file.path).digest("hex");
			const known = routes.get(id);
			const versions = known?.contentType === file.contentType ? known.versions.filter((version) => version !== file.version) : [];
			versions.push(file.version);
			routes.delete(id);
			routes.set(id, { path: file.path, contentType: file.contentType, versions: versions.slice(-STUDIO_REPL_FILE_ROUTE_VERSIONS) });
			while (routes.size > STUDIO_REPL_FILE_ROUTES) routes.delete(routes.keys().next().value);
			return id;
		},
		get(id) {
			return typeof id === "string" && /^[0-9a-f]{64}$/.test(id) ? routes.get(id) : undefined;
		},
		get size() { return routes.size; },
	};
}

/**
 * The file a route serves now, or why not: it must still be a regular file, within the size
 * limit, whose real path has an extension of the same type as when it was shown, in a version
 * the page was shown.
 *
 * @returns {{ ok: true, filePath: string, contentType: string } | { ok: false, status: number, message: string }}
 */
export function openStudioReplFileRoute(route, { realpath = realpathSync, statFile = statSync } = {}) {
	if (!route) return { ok: false, status: 404, message: "This file is no longer shown in the REPL pane." };
	let filePath;
	try { filePath = realpath(route.path); } catch { return { ok: false, status: 404, message: "This file no longer exists." }; }
	if (STUDIO_REPL_FILE_CONTENT_TYPES.get(extname(filePath).toLowerCase()) !== route.contentType) {
		return { ok: false, status: 404, message: "This file is no longer the file that was shown." };
	}
	let info;
	try { info = statFile(filePath); } catch { return { ok: false, status: 404, message: "This file no longer exists." }; }
	if (!info.isFile()) return { ok: false, status: 404, message: "This file is no longer the file that was shown." };
	if (info.size > STUDIO_REPL_FILE_MAX_BYTES) return { ok: false, status: 413, message: "This file is too large to show here." };
	if (!route.versions?.includes(studioReplFileVersion(info))) return { ok: false, status: 404, message: "This file is no longer the file that was shown." };
	return { ok: true, filePath, contentType: route.contentType };
}

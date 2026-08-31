import { lstatSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from "node:path";

export const STUDIO_SIDE_CONTEXT_MAX_FILE_BYTES = 5_000_000;
export const STUDIO_SIDE_CONTEXT_MAX_DOCUMENT_BYTES = 100_000_000;
export const STUDIO_SIDE_CONTEXT_MAX_OUTPUT_CHARS = 50_000;

const TEXT_EXTENSIONS = new Set([
	".md", ".markdown", ".mdx", ".qmd", ".txt", ".tex", ".latex", ".sty", ".cls", ".bib", ".bst", ".rst", ".adoc", ".rmd",
	".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".jsonc", ".yml", ".yaml", ".toml", ".ini", ".cfg", ".xml", ".html", ".htm", ".css",
	".py", ".jl", ".r", ".m", ".sh", ".bash", ".zsh", ".fish", ".rs", ".go", ".java", ".c", ".h", ".cpp", ".hpp", ".cs", ".swift", ".kt", ".sql", ".lua",
	".csv", ".tsv", ".diff", ".patch", ".ipynb",
]);
const EXTRACTABLE_EXTENSIONS = new Set([".pdf", ".docx", ".odt", ".epub"]);
const PRIORITY_NAMES = new Set(["readme", "readme.md", "main.tex", "book.tex", "index.md", "index.qmd", "package.json", "project.toml", "pyproject.toml"]);
const IGNORED_DIRS = new Set([
	".git", "node_modules", "dist", "build", "out", "target", "coverage", ".next", ".nuxt", ".cache", "__pycache__", ".venv", "venv", "env", ".tox",
	".mypy_cache", ".pytest_cache", ".idea", ".vscode", ".quarto", "_freeze", "_site",
]);

function toPosix(value) {
	return String(value || "").split("\\").join("/");
}

function hasBinaryBytes(buffer) {
	const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
	let nul = 0;
	let control = 0;
	for (const byte of sample) {
		if (byte === 0) nul += 1;
		else if (byte < 0x08 || (byte > 0x0d && byte < 0x20 && byte !== 0x1b)) control += 1;
	}
	return nul > 0 || (sample.length > 0 && control / sample.length > 0.1);
}

export function isStudioSideQuestionTextPath(filePath) {
	const name = basename(String(filePath || "")).toLowerCase();
	if (!name || name.endsWith(".min.js") || name.endsWith(".map") || name.endsWith(".lock")) return false;
	if (PRIORITY_NAMES.has(name)) return true;
	return TEXT_EXTENSIONS.has(extname(name).toLowerCase());
}

export function isStudioSideQuestionExtractablePath(filePath) {
	return EXTRACTABLE_EXTENSIONS.has(extname(String(filePath || "")).toLowerCase());
}

export function resolveStudioSideQuestionRoot(pathInput, fallbackCwd) {
	const raw = String(pathInput || "").trim().replace(/^@/, "").replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_match, doubleQuoted, singleQuoted) => doubleQuoted ?? singleQuoted ?? "");
	const expanded = raw === "~" ? process.env.HOME || raw : raw.startsWith("~/") ? join(process.env.HOME || "~", raw.slice(2)) : raw;
	const candidate = expanded ? (isAbsolute(expanded) ? expanded : resolve(fallbackCwd, expanded)) : resolve(fallbackCwd);
	const real = realpathSync(candidate);
	const stats = statSync(real);
	return stats.isDirectory() ? real : dirname(real);
}

export function assertStudioSideQuestionRootStable(rootPath) {
	const requested = resolve(String(rootPath || ""));
	if (lstatSync(requested).isSymbolicLink()) {
		throw new Error("The selected side-question context root changed or now resolves to another folder.");
	}
	const currentReal = realpathSync(requested);
	if (currentReal !== requested) {
		throw new Error("The selected side-question context root changed or now resolves to another folder.");
	}
	if (!statSync(currentReal).isDirectory()) throw new Error("The selected side-question context root is no longer a folder.");
	return currentReal;
}

export function resolveStudioSideQuestionPath(rootPath, pathInput, options = {}) {
	const rootReal = assertStudioSideQuestionRootStable(rootPath);
	const raw = String(pathInput || "").trim().replace(/^@/, "");
	if (!raw || /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) throw new Error("Use a local path inside the selected context root.");
	const candidate = isAbsolute(raw) ? raw : resolve(rootReal, raw);
	const candidateReal = realpathSync(candidate);
	const rel = relative(rootReal, candidateReal);
	if (rel === ".." || rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(rel)) {
		throw new Error("Requested path is outside the selected context root.");
	}
	const stats = statSync(candidateReal);
	if (options.directory === true && !stats.isDirectory()) throw new Error("Requested context path is not a directory.");
	if (options.file === true && !stats.isFile()) throw new Error("Requested context path is not a file.");
	return { root: rootReal, path: candidateReal, relativePath: toPosix(rel || basename(candidateReal)), stats };
}

function classifyContextPath(filePath) {
	if (isStudioSideQuestionTextPath(filePath)) return "text";
	if (isStudioSideQuestionExtractablePath(filePath)) return "document";
	return null;
}

export function listStudioSideQuestionContext(rootPath, options = {}) {
	const root = assertStudioSideQuestionRootStable(rootPath);
	const maxFiles = Math.max(1, Math.min(1_000, Math.floor(Number(options.maxFiles) || 400)));
	const maxDirs = Math.max(1, Math.min(1_000, Math.floor(Number(options.maxDirs) || 500)));
	const maxDepth = Math.max(0, Math.min(12, Math.floor(Number(options.maxDepth) || 8)));
	const queue = [{ dir: root, depth: 0 }];
	const files = [];
	let visitedDirs = 0;
	let truncated = false;
	while (queue.length && visitedDirs < maxDirs && files.length < maxFiles) {
		const current = queue.shift();
		visitedDirs += 1;
		let entries;
		try {
			entries = readdirSync(current.dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (entry.name.startsWith(".") && entry.name !== ".github") continue;
			const absolute = join(current.dir, entry.name);
			if (entry.isDirectory()) {
				if (current.depth < maxDepth && !IGNORED_DIRS.has(entry.name)) queue.push({ dir: absolute, depth: current.depth + 1 });
				continue;
			}
			if (!entry.isFile()) continue;
			const kind = classifyContextPath(absolute);
			if (!kind) continue;
			try {
				const stats = statSync(absolute);
				files.push({ path: toPosix(relative(root, absolute)), size: stats.size, kind });
			} catch {}
			if (files.length >= maxFiles) {
				truncated = true;
				break;
			}
		}
	}
	if (queue.length || visitedDirs >= maxDirs) truncated = true;
	return { root, files, truncated, visitedDirs };
}

export function formatStudioSideQuestionContextMap(listing, maxChars = 40_000) {
	const rows = (listing?.files || []).map((file) => `${file.path}\t${file.kind}\t${file.size} bytes`);
	let text = rows.join("\n");
	const limit = Math.max(1_000, Math.floor(Number(maxChars) || 40_000));
	if (text.length > limit) text = `${text.slice(0, limit).trimEnd()}\n[collection map truncated]`;
	if (listing?.truncated) text += `${text ? "\n" : ""}[additional files or directories omitted from the initial map; use the context map/search tools to inspect selectively]`;
	return text || "[no readable text or extractable document files found in the selected root]";
}

function notebookToText(raw) {
	try {
		const notebook = JSON.parse(raw);
		if (!Array.isArray(notebook.cells)) return raw;
		return notebook.cells.map((cell, index) => {
			const source = Array.isArray(cell?.source) ? cell.source.join("") : String(cell?.source || "");
			return `## Cell ${index + 1} (${cell?.cell_type || "unknown"})\n${source}`;
		}).join("\n\n");
	} catch {
		return raw;
	}
}

function sliceTextLines(text, offset, limit, maxChars) {
	const lines = String(text || "").split(/\r?\n/);
	const start = Math.max(0, Math.min(lines.length, Math.floor(Number(offset) || 1) - 1));
	const count = Math.max(1, Math.min(2_000, Math.floor(Number(limit) || 300)));
	const end = Math.min(lines.length, start + count);
	let content = lines.slice(start, end).join("\n");
	const charLimit = Math.max(1_000, Math.min(STUDIO_SIDE_CONTEXT_MAX_OUTPUT_CHARS, Math.floor(Number(maxChars) || STUDIO_SIDE_CONTEXT_MAX_OUTPUT_CHARS)));
	let truncated = end < lines.length;
	if (content.length > charLimit) {
		content = content.slice(0, charLimit);
		truncated = true;
	}
	return { text: content, startLine: start + 1, endLine: Math.max(start + 1, Math.min(end, lines.length)), totalLines: lines.length, truncated };
}

export function readStudioSideQuestionContextText(rootPath, pathInput, options = {}) {
	const resolved = resolveStudioSideQuestionPath(rootPath, pathInput, { file: true });
	if (!isStudioSideQuestionTextPath(resolved.path)) {
		if (isStudioSideQuestionExtractablePath(resolved.path)) {
			if (resolved.stats.size > STUDIO_SIDE_CONTEXT_MAX_DOCUMENT_BYTES) throw new Error(`Context document is too large (${resolved.stats.size} bytes).`);
			return { ...resolved, requiresExtraction: true, extension: extname(resolved.path).toLowerCase() };
		}
		throw new Error("Requested file type is not supported as side-question context.");
	}
	if (resolved.stats.size > STUDIO_SIDE_CONTEXT_MAX_FILE_BYTES) throw new Error(`Context file is too large (${resolved.stats.size} bytes).`);
	const buffer = readFileSync(resolved.path);
	if (hasBinaryBytes(buffer)) throw new Error("Context file appears to be binary.");
	let raw = buffer.toString("utf-8");
	if (extname(resolved.path).toLowerCase() === ".ipynb") raw = notebookToText(raw);
	return { ...resolved, requiresExtraction: false, ...sliceTextLines(raw, options.offset, options.limit, options.maxChars) };
}

export function sliceStudioSideQuestionExtractedText(text, options = {}) {
	return sliceTextLines(text, options.offset, options.limit, options.maxChars);
}

export function searchStudioSideQuestionContext(rootPath, queryInput, options = {}) {
	if (options.signal?.aborted) throw new Error("Local context search was cancelled.");
	const root = assertStudioSideQuestionRootStable(rootPath);
	const query = String(queryInput || "").trim();
	if (!query) throw new Error("Search query is empty.");
	if (query.length > 500) throw new Error("Search query is too long.");
	const subpath = String(options.path || ".").trim() || ".";
	const base = resolveStudioSideQuestionPath(root, subpath, { directory: true });
	const maxResults = Math.max(1, Math.min(200, Math.floor(Number(options.maxResults) || 60)));
	const caseSensitive = options.caseSensitive === true;
	const needle = caseSensitive ? query : query.toLowerCase();
	const listing = listStudioSideQuestionContext(base.path, { maxFiles: 500, maxDirs: 600, maxDepth: 10 });
	const results = [];
	const maxScannedBytes = 40_000_000;
	let scannedBytes = 0;
	let scanLimited = false;
	for (const file of listing.files) {
		if (options.signal?.aborted) throw new Error("Local context search was cancelled.");
		if (file.kind !== "text" || results.length >= maxResults) continue;
		const absolute = join(base.path, file.path);
		let stats;
		try { stats = statSync(absolute); } catch { continue; }
		if (!stats.isFile() || stats.size > 1_500_000) continue;
		if (scannedBytes + stats.size > maxScannedBytes) {
			scanLimited = true;
			break;
		}
		scannedBytes += stats.size;
		let raw;
		try {
			const buffer = readFileSync(absolute);
			if (hasBinaryBytes(buffer)) continue;
			raw = buffer.toString("utf-8");
			if (extname(absolute).toLowerCase() === ".ipynb") raw = notebookToText(raw);
		} catch { continue; }
		const lines = raw.split(/\r?\n/);
		for (let index = 0; index < lines.length && results.length < maxResults; index += 1) {
			const haystack = caseSensitive ? lines[index] : lines[index].toLowerCase();
			if (!haystack.includes(needle)) continue;
			results.push({
				path: toPosix(relative(root, absolute)),
				line: index + 1,
				text: lines[index].trim().slice(0, 1_000),
			});
		}
	}
	return { root, query, results, truncated: results.length >= maxResults || listing.truncated || scanLimited, scannedBytes };
}

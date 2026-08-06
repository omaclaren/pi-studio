import { basename, dirname } from "node:path";

const STUDIO_QUARTO_LOG_MAX_CHARS = 80_000;

/**
 * Return whether a path names a file Studio can hand to Quarto preview.
 * Keep the integration to file-backed Markdown formats Quarto supports directly.
 *
 * @param {unknown} filePath
 * @returns {boolean}
 */
export function isStudioQuartoDocumentPath(filePath) {
	return typeof filePath === "string" && /\.(?:qmd|md|markdown)$/i.test(filePath.trim());
}

/**
 * Build the deliberately conservative Quarto preview invocation used by Studio.
 * Quarto owns rendering and styling; Studio only hosts its loopback preview URL.
 *
 * @param {string} sourcePath
 * @returns {string[]}
 */
export function buildStudioQuartoPreviewArgs(sourcePath) {
	if (!isStudioQuartoDocumentPath(sourcePath)) {
		throw new Error("Quarto preview requires a file-backed .qmd, .md, or .markdown document.");
	}
	return [
		"preview",
		sourcePath,
		"--no-browser",
		"--host",
		"127.0.0.1",
		"--port",
		"0",
		"--no-execute",
	];
}

/**
 * Remove terminal control sequences from Quarto output before parsing or showing it.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function stripStudioQuartoAnsi(value) {
	return String(value ?? "")
		.replace(/[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g, "")
		.replace(/\r(?!\n)/g, "\n");
}

/**
 * Keep only loopback HTTP(S) preview URLs and normalize localhost/IPv6 to 127.0.0.1.
 *
 * @param {unknown} value
 * @returns {string|null}
 */
export function normalizeStudioQuartoLoopbackUrl(value) {
	const raw = String(value ?? "").trim().replace(/[),.;]+$/, "");
	if (!raw) return null;
	try {
		const parsed = new URL(raw);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
		const hostname = parsed.hostname.toLowerCase();
		if (hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "::1" && hostname !== "[::1]") {
			return null;
		}
		parsed.hostname = "127.0.0.1";
		return parsed.href;
	} catch {
		return null;
	}
}

/**
 * Extract Quarto's `Browse at` URL from accumulated stdout/stderr.
 *
 * @param {unknown} output
 * @returns {string|null}
 */
export function parseStudioQuartoPreviewUrl(output) {
	const clean = stripStudioQuartoAnsi(output);
	const browseMatches = Array.from(clean.matchAll(/Browse at\s+(https?:\/\/[^\s]+)/gi));
	for (let index = browseMatches.length - 1; index >= 0; index -= 1) {
		const normalized = normalizeStudioQuartoLoopbackUrl(browseMatches[index]?.[1]);
		if (normalized) return normalized;
	}
	return null;
}

/**
 * Append cleaned process output while retaining only the most recent bounded log text.
 *
 * @param {unknown} current
 * @param {unknown} chunk
 * @param {number} [maxChars]
 * @returns {string}
 */
export function appendStudioQuartoLog(current, chunk, maxChars = STUDIO_QUARTO_LOG_MAX_CHARS) {
	const limit = Math.max(1_000, Math.floor(Number(maxChars) || STUDIO_QUARTO_LOG_MAX_CHARS));
	const joined = `${String(current ?? "")}${stripStudioQuartoAnsi(chunk)}`;
	if (joined.length <= limit) return joined;
	return `[earlier Quarto output omitted]\n${joined.slice(-limit)}`;
}

/**
 * Parse the useful, stable subset of `quarto inspect` output.
 *
 * @param {unknown} output
 * @param {string} sourcePath
 * @param {string} [fallbackVersion]
 * @returns {{
 *   sourcePath: string,
 *   version: string,
 *   projectRoot: string,
 *   projectType: string,
 *   projectLabel: string,
 *   outputFile: string,
 *   isProject: boolean,
 * }}
 */
export function parseStudioQuartoInspect(output, sourcePath, fallbackVersion = "") {
	if (!isStudioQuartoDocumentPath(sourcePath)) {
		throw new Error("Quarto inspection requires a file-backed .qmd, .md, or .markdown document.");
	}
	let parsed;
	try {
		parsed = JSON.parse(stripStudioQuartoAnsi(output));
	} catch (error) {
		throw new Error(`Quarto inspect did not return valid JSON: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (!parsed || typeof parsed !== "object") {
		throw new Error("Quarto inspect returned an empty result.");
	}
	const project = parsed.project && typeof parsed.project === "object" ? parsed.project : null;
	const config = project && project.config && typeof project.config === "object" ? project.config : {};
	const projectConfig = config.project && typeof config.project === "object" ? config.project : {};
	const bookConfig = config.book && typeof config.book === "object" ? config.book : {};
	const websiteConfig = config.website && typeof config.website === "object" ? config.website : {};
	const htmlFormat = parsed.formats && typeof parsed.formats === "object" && parsed.formats.html && typeof parsed.formats.html === "object"
		? parsed.formats.html
		: {};
	const pandoc = htmlFormat.pandoc && typeof htmlFormat.pandoc === "object" ? htmlFormat.pandoc : {};
	const projectRoot = project && typeof project.dir === "string" && project.dir.trim()
		? project.dir.trim()
		: dirname(sourcePath);
	const projectType = typeof projectConfig.type === "string" && projectConfig.type.trim()
		? projectConfig.type.trim()
		: (project ? "project" : "document");
	const configuredTitle = [bookConfig.title, websiteConfig.title, config.title]
		.find((value) => typeof value === "string" && value.trim());
	const projectLabel = typeof configuredTitle === "string" && configuredTitle.trim()
		? configuredTitle.trim()
		: (project ? basename(projectRoot) : basename(sourcePath));
	const inspectedVersion = parsed.quarto && typeof parsed.quarto.version === "string"
		? parsed.quarto.version.trim()
		: "";
	const projectVersion = project && project.quarto && typeof project.quarto.version === "string"
		? project.quarto.version.trim()
		: "";
	return {
		sourcePath,
		version: inspectedVersion || projectVersion || String(fallbackVersion || "").trim(),
		projectRoot,
		projectType,
		projectLabel,
		outputFile: typeof pandoc["output-file"] === "string" ? pandoc["output-file"].trim() : "",
		isProject: Boolean(project),
	};
}

import { realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { extname, isAbsolute, relative, resolve } from "node:path";

export function expandStudioPdfResourcePath(input) {
	const value = String(input || "").trim();
	if (value === "~") return homedir();
	if (value.startsWith("~/") || value.startsWith("~\\")) {
		return resolve(homedir(), value.slice(2));
	}
	return value;
}

export function resolveStudioPdfResourceFile(pdfPath, baseDir) {
	const rawPath = typeof pdfPath === "string" ? pdfPath.trim() : "";
	if (!rawPath) throw new Error("Missing PDF path.");
	if (/\0/.test(rawPath)) throw new Error("Invalid PDF path.");
	if (/^[a-z][a-z0-9+.-]*:/i.test(rawPath) && !/^[a-z]:[\\/]/i.test(rawPath)) {
		throw new Error("Only local PDF paths are supported.");
	}

	const rawBaseDir = typeof baseDir === "string" ? baseDir.trim() : "";
	if (!rawBaseDir) throw new Error("Missing Studio resource directory.");

	const expandedPath = expandStudioPdfResourcePath(rawPath);
	const candidate = isAbsolute(expandedPath) ? expandedPath : resolve(rawBaseDir, expandedPath);
	if (extname(candidate).toLowerCase() !== ".pdf") throw new Error("Only .pdf files can be embedded.");

	const baseReal = realpathSync(rawBaseDir);
	const candidateReal = realpathSync(candidate);
	const rel = relative(baseReal, candidateReal);
	if (rel.startsWith("..") || isAbsolute(rel)) {
		throw new Error("PDF path must stay within the current Studio resource directory.");
	}

	const stat = statSync(candidateReal);
	if (!stat.isFile()) throw new Error("PDF path does not refer to a file.");
	return candidateReal;
}

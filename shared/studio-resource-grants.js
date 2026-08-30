import { realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

export const STUDIO_RESOURCE_GRANT_MAX_ENTRIES = 128;

function expandHome(pathInput) {
	const value = String(pathInput || "").trim();
	if (value === "~") return homedir();
	if (value.startsWith("~/") || value.startsWith("~\\")) return resolve(homedir(), value.slice(2));
	return value;
}

function resolveGrantInput(pathInput, fallbackCwd) {
	const raw = expandHome(pathInput);
	if (!raw) throw new Error("Missing Studio resource grant path.");
	if (/\0/.test(raw)) throw new Error("Invalid Studio resource grant path.");
	if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^[a-z]:[\\/]/i.test(raw)) {
		throw new Error("Studio resource grants require a local path.");
	}
	return isAbsolute(raw) ? raw : resolve(fallbackCwd, raw);
}

function canonicalExistingPath(pathInput, fallbackCwd, expectedKind) {
	const resolvedPath = resolveGrantInput(pathInput, fallbackCwd);
	const canonicalPath = realpathSync(resolvedPath);
	const stats = statSync(canonicalPath);
	if (expectedKind === "directory" && !stats.isDirectory()) {
		throw new Error("Studio resource directory grant does not refer to a directory.");
	}
	if (expectedKind === "file" && !stats.isFile()) {
		throw new Error("Studio resource file grant does not refer to a file.");
	}
	if (!stats.isDirectory() && !stats.isFile()) {
		throw new Error("Studio resource grant path must refer to a file or directory.");
	}
	return { canonicalPath, resolvedPath, kind: stats.isDirectory() ? "directory" : "file" };
}

function isPathInsideOrEqualDirectory(candidatePath, directoryPath) {
	const rel = relative(directoryPath, candidatePath);
	return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`));
}

function normalizeGrantSource(source, fallback) {
	const value = String(source || "").trim();
	return (value || fallback).slice(0, 100);
}

function copyGrant(entry) {
	return Object.freeze({
		kind: entry.kind,
		path: entry.path,
		sources: Object.freeze(Array.from(entry.sources)),
		grantedAt: entry.grantedAt,
	});
}

export function createStudioResourceGrantRegistry(options = {}) {
	const requestedMaxEntries = Number(options.maxEntries);
	const maxEntries = Math.max(1, Math.min(
		STUDIO_RESOURCE_GRANT_MAX_ENTRIES,
		Number.isFinite(requestedMaxEntries) && requestedMaxEntries > 0
			? Math.floor(requestedMaxEntries)
			: STUDIO_RESOURCE_GRANT_MAX_ENTRIES,
	));
	const now = typeof options.now === "function" ? options.now : Date.now;
	const defaultCwd = typeof options.cwd === "string" && options.cwd.trim() ? options.cwd : process.cwd();
	const entries = new Map();

	function fallbackCwd(details) {
		return typeof details?.cwd === "string" && details.cwd.trim() ? details.cwd : defaultCwd;
	}

	function addGrant(kind, canonicalPath, source) {
		const key = `${kind}:${canonicalPath}`;
		const existing = entries.get(key);
		if (existing) {
			existing.sources.add(source);
			return copyGrant(existing);
		}
		if (entries.size >= maxEntries) {
			throw new Error(`Studio resource grant limit reached (${maxEntries}).`);
		}
		const entry = {
			kind,
			path: canonicalPath,
			sources: new Set([source]),
			grantedAt: Math.max(0, Number(now()) || 0),
		};
		entries.set(key, entry);
		return copyGrant(entry);
	}

	function grantDirectory(pathInput, details = {}) {
		const resolved = canonicalExistingPath(pathInput, fallbackCwd(details), "directory");
		return addGrant("directory", resolved.canonicalPath, normalizeGrantSource(details.source, "explicit-directory"));
	}

	function grantFile(pathInput, details = {}) {
		const resolved = canonicalExistingPath(pathInput, fallbackCwd(details), "file");
		return addGrant("file", resolved.canonicalPath, normalizeGrantSource(details.source, "explicit-file"));
	}

	function grantDocument(pathInput, details = {}) {
		const cwd = fallbackCwd(details);
		const document = canonicalExistingPath(pathInput, cwd, "file");
		const documentDirectory = dirname(resolveGrantInput(pathInput, cwd));
		const directoryGrant = grantDirectory(documentDirectory, {
			cwd,
			source: normalizeGrantSource(details.source, "document"),
		});
		if (!isPathInsideOrEqualDirectory(document.canonicalPath, directoryGrant.path)) {
			grantFile(document.canonicalPath, { cwd, source: "document-file" });
		}
		return directoryGrant;
	}

	function findGrant(pathInput, details = {}) {
		let candidate;
		try {
			candidate = canonicalExistingPath(pathInput, fallbackCwd(details));
		} catch {
			return null;
		}
		const exactFile = entries.get(`file:${candidate.canonicalPath}`);
		if (exactFile) return copyGrant(exactFile);

		let bestDirectory = null;
		for (const entry of entries.values()) {
			if (entry.kind !== "directory" || !isPathInsideOrEqualDirectory(candidate.canonicalPath, entry.path)) continue;
			if (!bestDirectory || entry.path.length > bestDirectory.path.length) bestDirectory = entry;
		}
		return bestDirectory ? copyGrant(bestDirectory) : null;
	}

	return Object.freeze({
		grantDirectory,
		grantFile,
		grantDocument,
		findGrant,
		allows(pathInput, details = {}) {
			return findGrant(pathInput, details) !== null;
		},
		snapshot() {
			return Array.from(entries.values())
				.sort((a, b) => a.path.localeCompare(b.path) || a.kind.localeCompare(b.kind))
				.map(copyGrant);
		},
		clear() {
			entries.clear();
		},
		get size() {
			return entries.size;
		},
	});
}

import { createHash } from "node:crypto";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";

export const STUDIO_SIDE_QUESTION_MAX_SELECTED_TOOLS = 12;
export const STUDIO_SIDE_QUESTION_MAX_AVAILABLE_TOOLS = 200;

export const STUDIO_SIDE_QUESTION_BLOCKED_TOOL_NAMES = new Set([
	"bash",
	"edit",
	"goal_blocked",
	"goal_complete",
	"goal_wait",
	"intercom",
	"mcpScript",
	"powershell",
	"preview_export",
	"read",
	"repl_send",
	"studio_export_html",
	"studio_export_pdf",
	"studio_repl_send",
	"studio_repl_status",
	"write",
]);

export function normalizeStudioSideQuestionToolIds(value, maxTools = STUDIO_SIDE_QUESTION_MAX_SELECTED_TOOLS) {
	if (!Array.isArray(value)) return [];
	const ids = [];
	const seen = new Set();
	const limit = Math.max(0, Math.min(STUDIO_SIDE_QUESTION_MAX_SELECTED_TOOLS, Math.floor(Number(maxTools) || 0)));
	for (const entry of value) {
		if (typeof entry !== "string") continue;
		const id = entry.trim().toLowerCase();
		if (!/^[a-f0-9]{24}$/.test(id) || seen.has(id)) continue;
		seen.add(id);
		ids.push(id);
		if (ids.length >= limit) break;
	}
	return ids;
}

function createToolSelectionId(name, sourcePath) {
	return createHash("sha256").update(`${name}\0${resolve(sourcePath)}`).digest("hex").slice(0, 24);
}

function pathIsWithin(candidate, root) {
	const rel = relative(resolve(root), resolve(candidate));
	return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

function looksLikeGatewayTool(name, description) {
	const text = `${name} ${description}`.toLowerCase();
	return /\bgateway\b/.test(text)
		|| /\bproxy\b/.test(text)
		|| /\bdiscover\b[^.]{0,100}\btools?\b/.test(text)
		|| /\bmultiple\b[^.]{0,100}\btool calls?\b/.test(text);
}

export function buildStudioSideQuestionToolCatalog(toolInfos, options = {}) {
	const studioRoot = typeof options.studioRoot === "string" && options.studioRoot.trim()
		? resolve(options.studioRoot)
		: "";
	const blockedNames = options.blockedNames instanceof Set
		? options.blockedNames
		: STUDIO_SIDE_QUESTION_BLOCKED_TOOL_NAMES;
	const byName = new Map();
	for (const raw of Array.isArray(toolInfos) ? toolInfos : []) {
		if (!raw || typeof raw !== "object") continue;
		const name = typeof raw.name === "string" ? raw.name.trim() : "";
		if (!name || name.length > 200 || blockedNames.has(name)) continue;
		const sourceInfo = raw.sourceInfo && typeof raw.sourceInfo === "object" ? raw.sourceInfo : {};
		if (sourceInfo.source === "builtin" || sourceInfo.source === "sdk") continue;
		const sourcePath = typeof sourceInfo.path === "string" ? sourceInfo.path.trim() : "";
		if (!sourcePath || !isAbsolute(sourcePath)) continue;
		if (studioRoot && pathIsWithin(sourcePath, studioRoot)) continue;
		const description = typeof raw.description === "string" ? raw.description.trim().slice(0, 1_000) : "";
		const rawSource = typeof sourceInfo.source === "string" ? sourceInfo.source.trim() : "";
		const baseDir = typeof sourceInfo.baseDir === "string" && sourceInfo.baseDir.trim() ? sourceInfo.baseDir.trim() : dirname(sourcePath);
		const source = rawSource.startsWith(".") || isAbsolute(rawSource)
			? `local:${basename(baseDir) || basename(dirname(sourcePath)) || "extension"}`
			: (rawSource.slice(0, 500) || `local:${basename(baseDir) || "extension"}`);
		byName.set(name, {
			id: createToolSelectionId(name, sourcePath),
			name,
			description,
			source,
			sourcePath,
			scope: typeof sourceInfo.scope === "string" ? sourceInfo.scope : "",
			gateway: looksLikeGatewayTool(name, description),
		});
	}
	return [...byName.values()]
		.sort((a, b) => a.source.localeCompare(b.source) || a.name.localeCompare(b.name))
		.slice(0, STUDIO_SIDE_QUESTION_MAX_AVAILABLE_TOOLS);
}

export function selectStudioSideQuestionTools(catalog, requestedIds) {
	const ids = normalizeStudioSideQuestionToolIds(requestedIds);
	const byId = new Map((Array.isArray(catalog) ? catalog : []).map((tool) => [tool.id, tool]));
	const selected = [];
	const missing = [];
	for (const id of ids) {
		const tool = byId.get(id);
		if (tool) selected.push(tool);
		else missing.push(id);
	}
	return {
		selected,
		missing,
		extensionPaths: [...new Set(selected.map((tool) => tool.sourcePath))],
	};
}

export function toPublicStudioSideQuestionTools(catalog) {
	return (Array.isArray(catalog) ? catalog : []).map((tool) => ({
		id: tool.id,
		name: tool.name,
		description: tool.description,
		source: tool.source,
		gateway: tool.gateway === true,
	}));
}

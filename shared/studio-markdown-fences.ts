const SMART_MARKDOWN_FENCE_CHARS = "`´‘’‚‛“”„‟′‵";
const SMART_MARKDOWN_FENCE_RE = new RegExp(`^([ \\t]{0,3})([${SMART_MARKDOWN_FENCE_CHARS.replace(/[\\\]^-]/g, "\\$&")}]{3,})([^${SMART_MARKDOWN_FENCE_CHARS.replace(/[\\\]^-]/g, "\\$&")}\\r\\n]*)$`);

function normalizeSmartFenceRun(run: string): string {
	return "`".repeat(Math.max(3, Array.from(String(run || "")).length));
}

export function normalizeStudioMarkdownSmartFences(markdown: string): string {
	return String(markdown ?? "")
		.replace(/\r\n/g, "\n")
		.split("\n")
		.map((line) => {
			const match = line.match(SMART_MARKDOWN_FENCE_RE);
			if (!match) return line;
			const indent = match[1] ?? "";
			const run = match[2] ?? "";
			const suffix = match[3] ?? "";
			if (!/[´‘’‚‛“”„‟′‵]/u.test(run)) return line;
			return `${indent}${normalizeSmartFenceRun(run)}${suffix}`;
		})
		.join("\n");
}

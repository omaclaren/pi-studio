// Hosting pages consume an already registered workspace or a retained read-only
// watched capability. Descriptive URL fields never authorize a file read.
const unavailable = message => ({ ok: false, message });
export function resolveStudioHostingPage({ enabled, requestUrl, mode, workspace, transient }) {
	if (!enabled) return { ok: true, legacy: true };
	const params = requestUrl.searchParams;
	const hostedId = params.get("hostedWorkspace") || "", tabId = params.get("studioTabState") || "";
	if (hostedId && tabId && hostedId !== tabId) return unavailable("This link looks damaged, perhaps by a line break when it was copied. Copy the full link from Pi again; nothing was changed.");
	const id = hostedId || tabId;
	const state = id ? workspace(id) : null;
	if (state) {
		const selected = state.buffers.find(buffer => buffer.id === state.selectedBufferId);
		if (state.mode !== mode || !selected || params.get("watchFile") === "1" || params.get("watchedFile") === "1") {
			return unavailable("This retained workspace cannot change its editing mode through a URL.");
		}
		return { ok: true, workspaceId: id, state,
			document: { text: selected.text, label: selected.sourceState.label, source: "blank" } };
	}
	if (hostedId) return unavailable("This retained Document host is unavailable. Keep browser recovery copies; do not reload an independent disk copy.");
	const docId = params.get("docId") || "", document = docId ? transient(docId) : null;
	if (mode === "editor-only" && document?.watchFile === true && document.source === "file" && document.path) {
		if (params.has("docPath") && params.get("docPath") !== document.path) return unavailable("The watched preview path does not match its retained authorization.");
		return { ok: true, watched: true, document };
	}
	return unavailable("This editing URL is not registered in the Document-hosting alpha. Start with /studio, then use Open Document, New editor tab, Move or Copy in that workspace. Existing work was kept.");
}
export function studioHostingCommandError({ enabled, mode, replace = false, watchedText = false, current = false }) {
	if (!enabled) return null;
	if (current || replace) return "Terminal replacement is unavailable in the Document-hosting alpha. Use Open Document in the owning Studio workspace; current work was kept.";
	if (mode === "editor-only" && !watchedText) return "This standalone command is unavailable in the Document-hosting alpha. Use New editor tab, Open file in a new editor, Move or Copy in Studio. Read-only watched text previews remain available.";
	return null;
}
export function studioHostingLocalLinkError({ enabled, action, kind }) {
	if (!enabled) return null;
	if (kind === "office" && ["document", "editor-url"].includes(action)) return "Office conversion is unavailable in the Document-hosting alpha. Convert separately and explicitly import a Markdown copy; the original document was not changed.";
	if (["editor-url", "preview-url"].includes(action)) return "This legacy standalone-tab route is unavailable in the Document-hosting alpha. Use the owning Studio workspace's opening controls or an inline preview.";
	return null;
}

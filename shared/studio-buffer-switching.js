import { createStudioBuffer, validateStudioBufferWorkspace } from "./studio-buffer-store.js";

// Deliberately narrower than the store: no parked Prompts or general tab management.
export function isStudioPromptDocumentBufferState(state) {
	return state?.mode === "full" && state.buffers.length <= 2
		&& state.buffers.filter(b => b.role === "prompt").length === 1
		&& state.buffers.filter(b => b.role === "document").length <= 1
		&& state.buffers.some(b => b.id === state.activePromptId && b.role === "prompt");
}

// This is only a reason to ASK about recovered v2, never permission to change its
// submission target. v1/fresh editor launches have explicit visible-editor intent.
export function needsStudioLegacyPromptChoice(state) {
	if (!isStudioPromptDocumentBufferState(state) || state.selectedBufferId === state.activePromptId) return false;
	const prompt = state.buffers.find(b => b.id === state.activePromptId);
	return prompt.revision === 0 && prompt.text === "" && prompt.baselineText === ""
		&& prompt.sourceState.source === "blank" && prompt.sourceState.label === "Prompt"
		&& prompt.sourceState.path === null && prompt.sourceState.draftId === prompt.id
		&& prompt.diskRevision === null && prompt.resourceDir === ""
		&& prompt.metadata.annotationsEnabled === null && prompt.metadata.reviewNotesKey === null && prompt.metadata.scratchpadKey === null;
}

export function prepareStudioPromptDocumentWorkspace(value, { makeBufferId, roleChoice, now = Date.now } = {}) {
	const checked = validateStudioBufferWorkspace(value);
	if (!checked.ok) return checked;
	const state = checked.state;
	if (!isStudioPromptDocumentBufferState(state)) return { ok: false, reason: "unsupported-collection",
		message: "This prototype displays one Prompt and one document. Other buffers were retained; export them or use a compatible build." };
	let buffers = state.buffers, activePromptId = state.activePromptId;
	if (roleChoice === "visible-prompt" && state.selectedBufferId !== activePromptId) {
		if (!needsStudioLegacyPromptChoice(state)) return { ok: false, reason: "role-decision-required", message: "The existing Prompt cannot be replaced by a role migration. Both texts were kept." };
		buffers = buffers.map(b => b.id === state.selectedBufferId
			? createStudioBuffer({ ...b, role: "prompt", revision: b.revision + 1 })
			: createStudioBuffer({ ...b, role: "document", revision: b.revision + 1,
				sourceState: { ...b.sourceState, label: "Document" }, view: { ...b.view, rightView: "editor-preview" } }));
		activePromptId = state.selectedBufferId;
	} else if (roleChoice === "keep-roles" && needsStudioLegacyPromptChoice(state)) {
		// Explicitly chosen Prompt provenance, not an inferred association/grant.
		// Remember the choice without a new recovery schema or a disposable sidecar.
		buffers = buffers.map(b => b.id === activePromptId ? createStudioBuffer({ ...b, revision: b.revision + 1,
			sourceState: { ...b.sourceState, source: "prompt" } }) : b);
	}
	if (!buffers.some(b => b.role === "document")) {
		let document;
		try { document = createStudioBuffer({ id: makeBufferId(), role: "document", sourceState: { label: "Document" }, resourceDir: buffers[0].resourceDir }); }
		catch (error) { return { ok: false, reason: error.reason || "invalid-state", message: "The document buffer could not be created; existing text was kept." }; }
		buffers = [...buffers, document];
	}
	if (buffers === state.buffers) return checked;
	return validateStudioBufferWorkspace({ ...state, buffers, activePromptId,
		order: [activePromptId, ...buffers.filter(b => b.id !== activePromptId).map(b => b.id)],
		revision: state.revision + 1, savedAt: Math.max(state.savedAt + 1, now()) });
}

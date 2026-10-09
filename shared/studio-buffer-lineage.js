// Browser-safe verification of server-issued, capability-scoped recovery lineage.
// A timestamp or matching text alone is never an ancestry/ownership proof.
import { validateStudioBufferWorkspace } from "./studio-buffer-store.js";

export async function studioBufferDigest(value) {
	const bytes = new TextEncoder().encode(JSON.stringify(value));
	const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
	return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
export async function reconcileStudioHostingLineage({ local, remote, revision, checkpoint, lineage, now = Date.now }) {
	if (!checkpoint || !Array.isArray(lineage) || lineage.length > 16) return null;
	const start = lineage.findIndex(r => r.fromRevision === checkpoint.remoteRevision);
	if (start < 0) return null;
	const chain = lineage.slice(start);
	let head = checkpoint.remoteRevision;
	for (const receipt of chain) {
		if (receipt.fromRevision !== head || typeof receipt.toRevision !== "string") return null;
		head = receipt.toRevision;
	}
	if (head !== revision || chain[0].fromWorkspaceRevision !== checkpoint.workspaceRevision
		|| await studioBufferDigest(remote) !== chain.at(-1).toDigest) return null;
	if (await studioBufferDigest(local) === chain[0].fromDigest) return { state: remote, rebased: false };
	if (local.revision <= checkpoint.workspaceRevision) return null;
	// A local branch may contain newer Prompt work. Apply only a proven slot
	// replacement; never replace an independently changed moving document.
	let state = local;
	for (const receipt of chain) {
		if (receipt.kind === "cancel") continue;
		if (!receipt.slot) return null;
		const { beforeId, beforeDigest, afterId } = receipt.slot;
		const old = state.buffers.find(b => b.id === beforeId), next = remote.buffers.find(b => b.id === afterId);
		if (!old || !next || await studioBufferDigest(old) !== beforeDigest
			|| state.activePromptId !== receipt.beforePromptId
			|| JSON.stringify(state.order) !== JSON.stringify(receipt.beforeOrder)
			|| state.selectedBufferId !== receipt.beforeSelected) return null;
		for (const [id, digest] of Object.entries(receipt.unchanged || {})) {
			const entry = remote.buffers.find(b => b.id === id);
			if (!entry || await studioBufferDigest(entry) !== digest || !state.buffers.some(b => b.id === id)) return null;
		}
		if (state.buffers.length !== Object.keys(receipt.unchanged || {}).length + 1) return null;
		state = { ...state, buffers: state.buffers.map(b => b.id === beforeId ? next : b),
			order: state.order.map(id => id === beforeId ? afterId : id),
			selectedBufferId: state.selectedBufferId === beforeId ? afterId : state.selectedBufferId };
	}
	const checked = validateStudioBufferWorkspace({ ...state, revision: Math.max(local.revision, remote.revision) + 1,
		savedAt: Math.max(local.savedAt, remote.savedAt, now()) + 1 }, remote);
	return checked.ok ? { state: checked.state, rebased: true } : null;
}

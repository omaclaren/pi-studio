import { createHash } from "node:crypto";

export const STUDIO_PI_EDITOR_DRAFT_FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/;

export function createStudioPiEditorDraftSnapshot(content) {
	const buffer = Buffer.from(String(content ?? ""), "utf8");
	return Object.freeze({
		fingerprint: `sha256:${createHash("sha256").update(buffer).digest("hex")}`,
		byteLength: buffer.length,
	});
}

export function normalizeStudioPiEditorDraftSnapshot(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const fingerprint = typeof value.fingerprint === "string"
		? value.fingerprint.trim().toLowerCase()
		: "";
	const byteLength = value.byteLength;
	if (!STUDIO_PI_EDITOR_DRAFT_FINGERPRINT_PATTERN.test(fingerprint)) return null;
	if (typeof byteLength !== "number" || !Number.isSafeInteger(byteLength) || byteLength < 0) return null;
	return Object.freeze({ fingerprint, byteLength });
}

export function studioPiEditorDraftMatchesSnapshot(content, snapshot) {
	const expected = normalizeStudioPiEditorDraftSnapshot(snapshot);
	if (!expected) return false;
	const current = createStudioPiEditorDraftSnapshot(content);
	return current.byteLength === expected.byteLength && current.fingerprint === expected.fingerprint;
}

export function consumeStudioPiEditorDraftSnapshot(ui, snapshot) {
	const expected = normalizeStudioPiEditorDraftSnapshot(snapshot);
	if (!expected) return Object.freeze({ status: "not-requested" });
	if (!ui || typeof ui.getEditorText !== "function" || typeof ui.setEditorText !== "function") {
		return Object.freeze({ status: "unavailable" });
	}

	try {
		const current = String(ui.getEditorText() ?? "");
		if (current.length === 0) return Object.freeze({ status: "already-empty" });
		if (!studioPiEditorDraftMatchesSnapshot(current, expected)) {
			return Object.freeze({ status: "changed" });
		}
		ui.setEditorText("");
		return Object.freeze({ status: "cleared" });
	} catch {
		return Object.freeze({ status: "unavailable" });
	}
}

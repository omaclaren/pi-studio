import { realpathSync, statSync } from "node:fs";
import { resolve, dirname, basename, join } from "node:path";

// Identity only, NOT file access or write authorization. Recovery text remains
// recoverable when its original file or ancestor directories no longer exist.
export function canonicalStudioDocumentPath(input, cwd = process.cwd()) {
	if (typeof input !== "string" || !input.trim() || input.includes("\0")) throw new Error("Invalid Document path");
	let candidate = resolve(cwd, input.trim());
	const missing = [];
	for (;;) {
		try { return join(realpathSync(candidate), ...missing.reverse()); }
		catch (error) {
			if (!["ENOENT", "ENOTDIR"].includes(error.code)) throw error;
			const parent = dirname(candidate); if (parent === candidate) throw error;
			missing.push(basename(candidate)); candidate = parent;
		}
	}
}

// Detect existing hard-link aliases without keying ownership by inode: atomic
// saves replace inodes but keep the same logical filename. Never follow a
// retargeted captured canonical path to infer a new identity for an old draft.
export function studioDocumentPathsReferToSameFile(a, b) {
	try {
		if (canonicalStudioDocumentPath(a) !== a || canonicalStudioDocumentPath(b) !== b) return false;
		const left = statSync(a), right = statSync(b);
		return left.isFile() && right.isFile() && left.dev === right.dev && left.ino === right.ino;
	} catch { return false; }
}

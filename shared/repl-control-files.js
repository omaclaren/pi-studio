import { randomBytes } from "node:crypto";
import {
	chmodSync,
	closeSync,
	existsSync,
	fchmodSync,
	lstatSync,
	mkdirSync,
	openSync,
	readdirSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

const REPL_CONTROL_TOKEN_BYTES = 8;
const REPL_CONTROL_STALE_MS = 24 * 60 * 60 * 1_000;
const prunedRoots = new Set();

function currentUid() {
	return typeof process.getuid === "function" ? process.getuid() : null;
}

export function getPrivateReplControlRoot() {
	const uid = currentUid();
	const base = process.platform === "win32" ? tmpdir() : "/tmp";
	const userKey = uid === null ? "user" : uid.toString(36);
	return join(base, `pi-rc-${userKey}`);
}

function assertPrivateReplControlRoot(root) {
	const stats = lstatSync(root);
	if (!stats.isDirectory() || stats.isSymbolicLink()) {
		throw new Error(`REPL control root is not a real directory: ${root}`);
	}
	const uid = currentUid();
	if (uid !== null && stats.uid !== uid) {
		throw new Error(`REPL control root is not owned by the current user: ${root}`);
	}
	if (process.platform !== "win32" && (stats.mode & 0o777) !== 0o700) {
		throw new Error(`REPL control root must have mode 0700: ${root}`);
	}
}

function pruneStaleReplControlFiles(root, now = Date.now()) {
	if (prunedRoots.has(root)) return;
	prunedRoots.add(root);
	let entries = [];
	try {
		entries = readdirSync(root);
	} catch {
		return;
	}
	const uid = currentUid();
	for (const entry of entries) {
		if (!/^[a-f0-9]{16}\.(?:[A-Za-z0-9]{1,8}|done)$/.test(entry)) continue;
		const file = join(root, entry);
		try {
			const stats = lstatSync(file);
			if (!stats.isFile() || stats.isSymbolicLink()) continue;
			if (uid !== null && stats.uid !== uid) continue;
			if (now - stats.mtimeMs < REPL_CONTROL_STALE_MS) continue;
			unlinkSync(file);
		} catch {
			// Another process may have removed the same stale file.
		}
	}
}

export function ensurePrivateReplControlRoot(root = getPrivateReplControlRoot()) {
	let created = false;
	try {
		mkdirSync(root, { mode: 0o700 });
		created = true;
	} catch (error) {
		if (!error || typeof error !== "object" || error.code !== "EEXIST") throw error;
	}
	if (created && process.platform !== "win32") chmodSync(root, 0o700);
	assertPrivateReplControlRoot(root);
	pruneStaleReplControlFiles(root);
	return root;
}

function normalizeExtension(extension) {
	const normalized = String(extension || "").replace(/^\.+/, "");
	if (!/^[A-Za-z0-9]{1,8}$/.test(normalized)) {
		throw new Error(`Invalid REPL control-file extension: ${extension}`);
	}
	return normalized;
}

/**
 * Create and populate one private, collision-resistant REPL control file.
 * The builder receives the final paths so it can embed the matching done-file
 * path in the runtime-specific wrapper.
 */
export function createPrivateReplControlFiles(options) {
	const extension = normalizeExtension(options?.extension);
	const root = ensurePrivateReplControlRoot(options?.root || getPrivateReplControlRoot());
	if (typeof options?.buildSource !== "function") {
		throw new Error("REPL control-file source builder is required.");
	}

	for (let attempt = 0; attempt < 20; attempt += 1) {
		const token = randomBytes(REPL_CONTROL_TOKEN_BYTES).toString("hex");
		const paths = {
			dir: root,
			sourceFile: join(root, `${token}.${extension}`),
			doneFile: join(root, `${token}.done`),
		};
		if (existsSync(paths.doneFile)) continue;

		let descriptor;
		try {
			descriptor = openSync(paths.sourceFile, "wx", 0o600);
		} catch (error) {
			if (error && typeof error === "object" && error.code === "EEXIST") continue;
			throw error;
		}

		let complete = false;
		try {
			const source = String(options.buildSource(paths));
			writeFileSync(descriptor, source, "utf8");
			if (process.platform !== "win32") fchmodSync(descriptor, 0o600);
			complete = true;
			return paths;
		} finally {
			closeSync(descriptor);
			if (!complete) {
				try {
					unlinkSync(paths.sourceFile);
				} catch {
					// Preserve the source-builder error.
				}
			}
		}
	}
	throw new Error("Could not allocate a unique REPL control file.");
}

export function cleanupPrivateReplControlFiles(paths) {
	if (!paths || typeof paths !== "object") return;
	const root = String(paths.dir || "");
	const sourceFile = String(paths.sourceFile || "");
	const doneFile = String(paths.doneFile || "");
	const sourceName = basename(sourceFile);
	const token = sourceName.match(/^([a-f0-9]{16})\.[A-Za-z0-9]{1,8}$/)?.[1];
	if (!token || dirname(sourceFile) !== root || dirname(doneFile) !== root || basename(doneFile) !== `${token}.done`) return;
	for (const file of [sourceFile, doneFile]) {
		try {
			unlinkSync(file);
		} catch {
			// Cleanup is idempotent and best effort.
		}
	}
}

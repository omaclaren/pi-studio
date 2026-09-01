import { createHash, randomUUID } from "node:crypto";
import {
	closeSync,
	constants,
	existsSync,
	fchmodSync,
	fchownSync,
	fsyncSync,
	fstatSync,
	linkSync,
	lstatSync,
	openSync,
	readFileSync,
	realpathSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

export const STUDIO_DISK_REVISION_PATTERN = /^sha256:[a-f0-9]{64}$/;

function toBuffer(content) {
	return Buffer.isBuffer(content) ? content : Buffer.from(String(content ?? ""), "utf8");
}

function normalizeComparablePath(filePath) {
	const normalized = resolve(filePath);
	return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function pathsMatch(left, right) {
	return normalizeComparablePath(left) === normalizeComparablePath(right);
}

function errorMessage(error) {
	return error instanceof Error ? error.message : String(error);
}

function isMissingFileError(error) {
	return Boolean(error && typeof error === "object" && error.code === "ENOENT");
}

export function createStudioDiskRevision(content) {
	return `sha256:${createHash("sha256").update(toBuffer(content)).digest("hex")}`;
}

export function normalizeStudioDiskRevision(value) {
	const revision = typeof value === "string" ? value.trim().toLowerCase() : "";
	return STUDIO_DISK_REVISION_PATTERN.test(revision) ? revision : null;
}

export function studioDiskRevisionsMatch(left, right) {
	const normalizedLeft = normalizeStudioDiskRevision(left);
	const normalizedRight = normalizeStudioDiskRevision(right);
	return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

export function readStudioDiskFileSnapshot(filePath) {
	if (typeof filePath !== "string" || !filePath.trim()) {
		throw new Error("Missing file path.");
	}
	const requestedPath = resolve(filePath);
	const requestedStats = lstatSync(requestedPath);
	if (!requestedStats.isFile() && !requestedStats.isSymbolicLink()) {
		throw new Error(`Path is not a file: ${requestedPath}`);
	}
	const canonicalPath = realpathSync(requestedPath);
	const snapshot = inspectStableCanonicalTarget(canonicalPath);
	if (
		snapshot.exists !== true
		|| snapshot.unsafe === true
		|| !Buffer.isBuffer(snapshot.buffer)
		|| typeof snapshot.revision !== "string"
	) {
		throw new Error(snapshot.message || `Path is not a file: ${canonicalPath}`);
	}
	return Object.freeze({
		path: snapshot.path,
		buffer: snapshot.buffer,
		revision: snapshot.revision,
		size: snapshot.buffer.length,
		mtimeMs: snapshot.mtimeMs,
		mode: snapshot.mode,
	});
}

function inspectStableCanonicalTarget(targetPath, options = {}) {
	const absolutePath = resolve(targetPath);
	let stats;
	try {
		stats = lstatSync(absolutePath);
	} catch (error) {
		if (isMissingFileError(error)) return { exists: false, path: absolutePath };
		throw error;
	}
	if (stats.isSymbolicLink()) {
		return {
			exists: true,
			unsafe: true,
			path: absolutePath,
			message: "The file location is now a symbolic link.",
		};
	}
	if (!stats.isFile()) {
		return {
			exists: true,
			unsafe: true,
			path: absolutePath,
			message: "The file location is no longer a regular file.",
		};
	}
	const canonicalPath = realpathSync(absolutePath);
	if (options.requireCanonical !== false && !pathsMatch(canonicalPath, absolutePath)) {
		return {
			exists: true,
			unsafe: true,
			path: absolutePath,
			message: "The file location now resolves somewhere else.",
		};
	}
	const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
	let fd = null;
	try {
		fd = openSync(canonicalPath, constants.O_RDONLY | noFollow);
		const before = fstatSync(fd);
		if (!before.isFile()) throw new Error(`Path is not a file: ${canonicalPath}`);
		const buffer = readFileSync(fd);
		const after = fstatSync(fd);
		const latestPathStats = lstatSync(canonicalPath);
		const latestRequestedStats = pathsMatch(absolutePath, canonicalPath)
			? latestPathStats
			: lstatSync(absolutePath);
		if (
			latestPathStats.isSymbolicLink()
			|| !latestPathStats.isFile()
			|| latestRequestedStats.isSymbolicLink()
			|| !latestRequestedStats.isFile()
			|| before.dev !== after.dev
			|| before.ino !== after.ino
			|| after.dev !== latestPathStats.dev
			|| after.ino !== latestPathStats.ino
			|| after.dev !== latestRequestedStats.dev
			|| after.ino !== latestRequestedStats.ino
			|| before.size !== after.size
			|| before.mtimeMs !== after.mtimeMs
			|| before.ctimeMs !== after.ctimeMs
		) {
			throw new Error(`File changed while Studio was inspecting it: ${canonicalPath}`);
		}
		return {
			exists: true,
			unsafe: false,
			path: canonicalPath,
			buffer,
			revision: createStudioDiskRevision(buffer),
			mode: after.mode,
			uid: after.uid,
			gid: after.gid,
			nlink: after.nlink,
			dev: after.dev,
			ino: after.ino,
			mtimeMs: after.mtimeMs,
		};
	} finally {
		if (fd !== null) {
			try { closeSync(fd); } catch {}
		}
	}
}

function resolveStableNewTarget(targetPath) {
	const absolutePath = resolve(targetPath);
	const parentPath = dirname(absolutePath);
	const canonicalParent = realpathSync(parentPath);
	const canonicalTarget = join(canonicalParent, basename(absolutePath));
	return { path: canonicalTarget, parentPath: canonicalParent };
}

function getStudioPathIdentity(path) {
	const stats = lstatSync(path);
	return { dev: stats.dev, ino: stats.ino };
}

function studioPathIdentitiesMatch(left, right) {
	return Boolean(left && right && left.dev === right.dev && left.ino === right.ino);
}

function fsyncStudioDirectory(path) {
	let fd = null;
	try {
		const directoryFlag = typeof constants.O_DIRECTORY === "number" ? constants.O_DIRECTORY : 0;
		fd = openSync(path, constants.O_RDONLY | directoryFlag);
		fsyncSync(fd);
	} catch {
		// Some supported platforms/filesystems do not permit directory fsync.
	} finally {
		if (fd !== null) {
			try { closeSync(fd); } catch {}
		}
	}
}

function applyStudioFileMetadata(fd, metadata) {
	if (typeof metadata === "number") {
		fchmodSync(fd, metadata & 0o7777);
		return;
	}
	if (!metadata || typeof metadata !== "object") return;
	if (
		process.platform !== "win32"
		&& Number.isInteger(metadata.uid)
		&& Number.isInteger(metadata.gid)
	) {
		fchownSync(fd, metadata.uid, metadata.gid);
	}
	const mode = Number.isInteger(metadata.mode)
		? metadata.mode & 0o7777
		: (0o666 & ~process.umask());
	fchmodSync(fd, mode);
}

function writeStudioDiskFileAtomically(targetPath, content, metadata, options = {}) {
	const buffer = toBuffer(content);
	const parentPath = dirname(targetPath);
	const canonicalParent = realpathSync(parentPath);
	if (!pathsMatch(parentPath, canonicalParent)) {
		throw new Error("The save directory now resolves somewhere else.");
	}
	const parentIdentity = getStudioPathIdentity(canonicalParent);
	const tempPath = join(parentPath, `.pi-studio-${randomUUID()}.tmp`);
	let fd = null;
	try {
		const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
		fd = openSync(tempPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow, 0o600);
		const tempIdentity = fstatSync(fd);
		writeFileSync(fd, buffer);
		applyStudioFileMetadata(fd, metadata);
		fsyncSync(fd);
		closeSync(fd);
		fd = null;
		const assertStagingIntegrity = () => {
			const latestCanonicalParent = realpathSync(parentPath);
			if (
				!pathsMatch(parentPath, latestCanonicalParent)
				|| !studioPathIdentitiesMatch(parentIdentity, getStudioPathIdentity(latestCanonicalParent))
			) {
				throw new Error("The save directory changed before the write could be committed.");
			}
			const latestTemp = lstatSync(tempPath);
			if (latestTemp.isSymbolicLink() || !latestTemp.isFile() || latestTemp.dev !== tempIdentity.dev || latestTemp.ino !== tempIdentity.ino) {
				throw new Error("The temporary save file changed before it could be committed.");
			}
		};
		assertStagingIntegrity();
		if (typeof options.beforeCommit === "function") options.beforeCommit();
		// Keep the final compare-to-commit window to two local identity checks. Filesystem
		// writers do not share an atomic CAS primitive with Studio, so this remains best-effort.
		assertStagingIntegrity();
		if (options.replace === false) {
			linkSync(tempPath, targetPath);
			try {
				unlinkSync(tempPath);
			} catch {
				// The no-clobber target is already committed. A same-directory orphaned
				// staging link is safer than reporting failure after changing the target.
			}
		} else {
			renameSync(tempPath, targetPath);
		}
		fsyncStudioDirectory(parentPath);
	} catch (error) {
		if (fd !== null) {
			try { closeSync(fd); } catch {}
		}
		try {
			if (existsSync(tempPath)) unlinkSync(tempPath);
		} catch {}
		throw error;
	}
	return {
		path: resolve(targetPath),
		revision: createStudioDiskRevision(buffer),
		size: buffer.length,
	};
}

function createStudioDiskConflict(reason, path, currentRevision, message) {
	return { ok: false, conflict: true, reason, path, currentRevision, message };
}

function throwStudioDiskConflict(conflict) {
	const error = new Error(conflict.message);
	error.studioConflict = conflict;
	throw error;
}

function createStudioNewFileMetadata() {
	return { mode: 0o666 & ~process.umask() };
}

export function saveStudioDiskFileIfRevision(options) {
	const filePath = typeof options?.path === "string" ? options.path.trim() : "";
	if (!filePath || !isAbsolute(filePath)) {
		return { ok: false, reason: "invalid-path", message: "Safe save needs an absolute canonical file path." };
	}
	const expectedRevision = normalizeStudioDiskRevision(options?.expectedRevision);
	const allowMissingRecreation = options?.force === true;
	let target;
	try {
		target = inspectStableCanonicalTarget(filePath);
	} catch (error) {
		return { ok: false, reason: "read-failed", message: `Could not inspect the file before saving: ${errorMessage(error)}` };
	}

	if (target.unsafe) {
		return createStudioDiskConflict(
			"location-changed",
			target.path,
			null,
			`${target.message} Studio will not follow a replaced location while saving.`,
		);
	}
	if (!target.exists && !allowMissingRecreation) {
		return createStudioDiskConflict(
			"file-missing",
			target.path,
			null,
			"The file was removed or moved after Studio loaded it.",
		);
	}
	if (target.exists && target.nlink > 1) {
		return createStudioDiskConflict(
			"hard-linked-file",
			target.path,
			target.revision,
			"The file has multiple hard links. Studio will not silently split those links with an atomic replacement; use Save As instead.",
		);
	}
	if (target.exists && !expectedRevision) {
		return createStudioDiskConflict(
			"revision-required",
			target.path,
			target.revision,
			"Studio no longer has the disk revision this editor was based on.",
		);
	}
	if (target.exists && !studioDiskRevisionsMatch(expectedRevision, target.revision)) {
		return createStudioDiskConflict(
			"disk-changed",
			target.path,
			target.revision,
			"The file changed again after Studio reported the previous conflict.",
		);
	}

	let stableTargetPath = target.path;
	if (!target.exists) {
		try {
			const resolvedTarget = resolveStableNewTarget(filePath);
			if (!pathsMatch(resolvedTarget.path, filePath)) {
				return createStudioDiskConflict(
					"location-changed",
					filePath,
					null,
					"The file's parent directory now resolves somewhere else. Studio will not recreate it there.",
				);
			}
			stableTargetPath = resolvedTarget.path;
		} catch (error) {
			return { ok: false, reason: "write-failed", message: `Could not resolve the file location before saving: ${errorMessage(error)}` };
		}
	}

	const targetExisted = target.exists;
	const metadata = targetExisted ? target : createStudioNewFileMetadata();
	try {
		const written = writeStudioDiskFileAtomically(stableTargetPath, options?.content, metadata, {
			replace: targetExisted,
			beforeCommit: () => {
				const latest = inspectStableCanonicalTarget(stableTargetPath);
				if (latest.unsafe) {
					throwStudioDiskConflict(createStudioDiskConflict(
						"location-changed",
						stableTargetPath,
						null,
						`${latest.message} Studio will not follow a replaced location while saving.`,
					));
				}
				if (targetExisted) {
					if (!latest.exists || !studioDiskRevisionsMatch(expectedRevision, latest.revision)) {
						throwStudioDiskConflict(createStudioDiskConflict(
							latest.exists ? "disk-changed" : "file-missing",
							stableTargetPath,
							latest.exists ? latest.revision : null,
							latest.exists
								? "The file changed again while Studio was preparing the save."
								: "The file was removed while Studio was preparing the save.",
						));
					}
					if (latest.nlink > 1) {
						throwStudioDiskConflict(createStudioDiskConflict(
							"hard-linked-file",
							stableTargetPath,
							latest.revision,
							"The file gained another hard link while Studio was preparing the save; use Save As instead.",
						));
					}
				} else if (latest.exists) {
					throwStudioDiskConflict(createStudioDiskConflict(
						"disk-changed",
						stableTargetPath,
						latest.revision,
						"A new file appeared at this path while Studio was preparing to recreate it.",
					));
				}
			},
		});
		return { ok: true, ...written };
	} catch (error) {
		if (error && typeof error === "object" && error.studioConflict) return error.studioConflict;
		if (!targetExisted && error && typeof error === "object" && error.code === "EEXIST") {
			let currentRevision = null;
			try {
				const current = inspectStableCanonicalTarget(stableTargetPath);
				if (current.exists && !current.unsafe) currentRevision = current.revision;
			} catch {}
			return createStudioDiskConflict(
				"disk-changed",
				stableTargetPath,
				currentRevision,
				"A new file appeared at this path before Studio could recreate it.",
			);
		}
		return { ok: false, reason: "write-failed", message: `Failed to save file: ${errorMessage(error)}` };
	}
}

export function saveStudioDiskFileAs(options) {
	const pathInput = typeof options?.path === "string" ? options.path.trim() : "";
	if (!pathInput) return { ok: false, reason: "invalid-path", message: "Missing file path." };
	const cwd = typeof options?.cwd === "string" && options.cwd.trim() ? options.cwd : process.cwd();
	const requestedPath = isAbsolute(pathInput) ? resolve(pathInput) : resolve(cwd, pathInput);
	const overwrite = options?.overwrite === true;
	const expectedRevision = normalizeStudioDiskRevision(options?.expectedRevision);
	let stableTargetPath = requestedPath;
	let target;
	try {
		target = inspectStableCanonicalTarget(requestedPath, { requireCanonical: false });
		if (!target.exists) {
			stableTargetPath = resolveStableNewTarget(requestedPath).path;
			target = inspectStableCanonicalTarget(stableTargetPath);
		} else {
			stableTargetPath = target.path;
		}
	} catch (error) {
		return { ok: false, reason: "read-failed", message: `Could not inspect the save location: ${errorMessage(error)}` };
	}
	if (target.unsafe) {
		return { ok: false, reason: "unsafe-path", message: `${target.message} Choose another path.` };
	}
	if (target.exists && target.nlink > 1) {
		return createStudioDiskConflict(
			"hard-linked-file",
			target.path,
			target.revision,
			"Studio will not atomically replace a file with multiple hard links. Choose another path or update the linked file outside Studio.",
		);
	}
	if (target.exists && !overwrite) {
		return createStudioDiskConflict(
			"target-exists",
			target.path,
			target.revision,
			`A file already exists at ${target.path}.`,
		);
	}
	if (target.exists && overwrite && !studioDiskRevisionsMatch(expectedRevision, target.revision)) {
		return createStudioDiskConflict(
			"target-exists",
			target.path,
			target.revision,
			expectedRevision
				? `The file at ${target.path} changed again after Studio asked for replacement confirmation.`
				: `Confirm replacement of the existing file at ${target.path}.`,
		);
	}
	if (!target.exists && overwrite && expectedRevision) {
		return createStudioDiskConflict(
			"target-missing",
			stableTargetPath,
			null,
			"The file was removed after Studio asked for replacement confirmation. Confirm again to create it at this path.",
		);
	}

	const targetExisted = target.exists;
	const metadata = targetExisted ? target : createStudioNewFileMetadata();
	try {
		const written = writeStudioDiskFileAtomically(stableTargetPath, options?.content, metadata, {
			replace: targetExisted,
			beforeCommit: () => {
				const latest = inspectStableCanonicalTarget(stableTargetPath);
				if (latest.unsafe) {
					throwStudioDiskConflict({
						ok: false,
						reason: "unsafe-path",
						message: `${latest.message} Choose another path.`,
					});
				}
				if (targetExisted) {
					if (!latest.exists || !studioDiskRevisionsMatch(expectedRevision, latest.revision)) {
						throwStudioDiskConflict(createStudioDiskConflict(
							latest.exists ? "target-exists" : "target-missing",
							stableTargetPath,
							latest.exists ? latest.revision : null,
							latest.exists
								? "The replacement target changed again while Studio was preparing the save."
								: "The replacement target was removed while Studio was preparing the save.",
						));
					}
					if (latest.nlink > 1) {
						throwStudioDiskConflict(createStudioDiskConflict(
							"hard-linked-file",
							stableTargetPath,
							latest.revision,
							"The replacement target gained another hard link while Studio was preparing the save; choose another path.",
						));
					}
				} else if (latest.exists) {
					throwStudioDiskConflict(createStudioDiskConflict(
						"target-exists",
						stableTargetPath,
						latest.revision,
						"A file appeared at this path while Studio was preparing the save.",
					));
				}
			},
		});
		return { ok: true, ...written };
	} catch (error) {
		if (error && typeof error === "object" && error.studioConflict) return error.studioConflict;
		if (!targetExisted && error && typeof error === "object" && error.code === "EEXIST") {
			let currentRevision = null;
			try {
				const current = inspectStableCanonicalTarget(stableTargetPath);
				if (current.exists && !current.unsafe) currentRevision = current.revision;
			} catch {}
			return createStudioDiskConflict(
				"target-exists",
				stableTargetPath,
				currentRevision,
				`A file already exists at ${stableTargetPath}.`,
			);
		}
		return { ok: false, reason: "write-failed", message: `Failed to save file: ${errorMessage(error)}` };
	}
}

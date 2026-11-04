// Studio's URL in a file a program can read, for a script, an editor or a container that opens
// Studio without anyone copying the URL out of a terminal (issue #7). Opt-in: nothing is written
// unless PI_STUDIO_URL_FILE names a file, and it comes from Pi's own environment, so each Pi
// process can be given its own file. The file holds the same credential the terminal prints.
//
// Everything here is synchronous: in one process a write and a clear can't overlap, so a stop
// can't be overtaken by a write that was still on its way. Whether a write's URL is still the
// running server's is the caller's to check.

import { randomBytes } from "node:crypto";
import * as nodeFs from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";

export const STUDIO_URL_FILE_ENV = "PI_STUDIO_URL_FILE";

/** @typedef {{ ok: true, path: string } | { ok: false, path: string, message: string }} StudioUrlFileResult */

const errorText = (error) => error && typeof error === "object" && typeof error.code === "string"
	? ({ ENOENT: "its folder doesn't exist", EACCES: "permission denied", EPERM: "permission denied", EISDIR: "it's a folder", EROFS: "the file system is read-only" }[error.code] ?? error.code)
	: String(error?.message ?? error);

/**
 * The URL file this process writes, or null when PI_STUDIO_URL_FILE isn't set.
 * publish(url) puts the URL there; clear() removes it if it still holds what this process wrote.
 * Neither throws: each returns { ok, path, message? }. Removal is best effort: a crash, or a
 * removal that fails, leaves the file, whose token stops working with its server.
 * options.fs replaces file functions, for tests.
 */
export function createStudioUrlFile(env = process.env, options = {}) {
	const path = env?.[STUDIO_URL_FILE_ENV];
	if (typeof path !== "string" || path === "") return null;
	const platform = options.platform ?? process.platform;
	const fs = { ...nodeFs, ...options.fs };
	// What this process last wrote, so it removes only its own URL.
	let written = null;
	/** @returns {StudioUrlFileResult} */
	const fail = (message) => ({ ok: false, path, message });
	/** @returns {StudioUrlFileResult} */
	const done = () => ({ ok: true, path });

	/** @param {string} url @returns {StudioUrlFileResult} */
	const publish = (url) => {
		if (!isAbsolute(path)) return fail("it isn't an absolute path");
		if (typeof url !== "string" || !url || /[\u0000-\u001f\u007f]/.test(url)) return fail("the URL isn't one line of text");
		try {
			// A link, a folder or a device there isn't replaced.
			if (!fs.lstatSync(path).isFile()) return fail("something other than a file is there");
		} catch (error) {
			if (error?.code !== "ENOENT") return fail(errorText(error));
		}
		const text = `${url}\n`;
		// Private from its first byte: a new file beside the target, opened only if it doesn't
		// exist, then renamed over the target, so a reader sees the old URL or the new one.
		let temporary = null, descriptor = null;
		try {
			temporary = join(dirname(path), `.${basename(path)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`);
			descriptor = fs.openSync(temporary, "wx", 0o600);
			if (platform !== "win32") fs.fchmodSync(descriptor, 0o600);
			fs.writeFileSync(descriptor, text, "utf8");
			fs.closeSync(descriptor);
			descriptor = null;
			fs.renameSync(temporary, path);
		} catch (error) {
			if (descriptor !== null) { try { fs.closeSync(descriptor); } catch {} }
			if (temporary !== null) { try { fs.unlinkSync(temporary); } catch {} }
			return fail(errorText(error));
		}
		written = text;
		return done();
	};

	/** @returns {StudioUrlFileResult} */
	const clear = () => {
		if (written === null) return done();
		const mine = written;
		written = null;
		try {
			// A path given to another process too may hold its URL now: leave it.
			if (!fs.lstatSync(path).isFile() || fs.readFileSync(path, "utf8") !== mine) return done();
			fs.unlinkSync(path);
			return done();
		} catch (error) {
			return error?.code === "ENOENT" ? done() : fail(errorText(error));
		}
	};

	return { path, publish, clear };
}

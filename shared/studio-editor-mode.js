import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// Oliver, 13 Oct: dual editor mode (Prompt and Document) is the default; single editor
// mode is the earlier one-editor Studio. The choice is kept per Pi profile. The older
// development flags, when any is set, still decide everything, as before.
export const STUDIO_EDITOR_MODE_ENV = ["PI_STUDIO_BUFFER_RECOVERY", "PI_STUDIO_BUFFER_SWITCHING", "PI_STUDIO_DOCUMENT_HOSTING"];

export function resolveStudioEditorFlags(env, savedMode) {
	const forced = STUDIO_EDITOR_MODE_ENV.some(key => typeof env[key] === "string" && env[key] !== "");
	const recovery = forced ? env.PI_STUDIO_BUFFER_RECOVERY === "1" : savedMode !== "single";
	const switching = recovery && (!forced || env.PI_STUDIO_BUFFER_SWITCHING === "1");
	const hosting = switching && (!forced || env.PI_STUDIO_DOCUMENT_HOSTING === "1");
	return { forced, recovery, switching, hosting, mode: hosting ? "dual" : "single" };
}

export function readStudioEditorMode(path) {
	try {
		const mode = JSON.parse(readFileSync(path, "utf8"))?.mode;
		return mode === "single" || mode === "dual" ? mode : null;
	} catch { return null; }
}

export function writeStudioEditorMode(path, mode) {
	if (mode !== "single" && mode !== "dual") throw new Error("Unknown editor mode.");
	mkdirSync(dirname(path), { recursive: true });
	const temporary = path + "." + process.pid + ".tmp";
	writeFileSync(temporary, JSON.stringify({ mode }) + "\n", "utf8");
	renameSync(temporary, path);
}

// Starting, stopping and switching Studio take turns (Sol, candidate69). run() queues at
// once, so a caller that checked pending() and then queued can't be overtaken.
export function createStudioTurns() {
	/** @type {Promise<unknown>} */
	let tail = Promise.resolve();
	let pending = 0;
	return Object.freeze({
		/** @template T @param {() => Promise<T>} operation @returns {Promise<T>} */
		run(operation) {
			pending += 1;
			const turn = tail.then(operation).finally(() => { pending -= 1; });
			tail = turn.catch(() => undefined);
			return turn;
		},
		pending: () => pending,
	});
}

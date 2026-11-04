// /studio --copy-url: the main view's URL on the clipboard, for a terminal too narrow to show it
// whole. Pi's copyToClipboard writes the system clipboard and, over SSH, also the terminal's own
// (OSC 52) through standard output, which in RPC, JSON and print modes carries Pi's output: only
// Pi's terminal interface copies. A Pi that doesn't say its mode copies nothing either; ctx.mode
// predates the Pi features Studio needs (Astra, candidate 119). RPC clients get the URL in
// Studio's notifications.

/**
 * @param {{ mode?: string, running: boolean, url: string | null, copy: (text: string) => Promise<void> }} options
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
export async function copyStudioUrl({ mode, running, url, copy }) {
	if (mode !== "tui") return { ok: false, message: "Copying the URL needs Pi's terminal interface. /studio --status prints it." };
	if (!running) return { ok: false, message: "Studio isn't running. Run /studio first." };
	if (!url) return { ok: false, message: "Studio has no main view yet. Run /studio first." };
	try {
		await copy(url);
		return { ok: true, message: "Copied Studio's URL." };
	} catch (error) {
		const reason = String(error instanceof Error ? error.message : error).replace(/\.$/, "");
		return { ok: false, message: `Couldn't copy Studio's URL: ${reason}. /studio --status prints it.` };
	}
}

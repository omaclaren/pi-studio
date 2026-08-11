import { spawn } from "node:child_process";

export const STUDIO_CMUX_BROWSER_OPEN_TIMEOUT_MS = 5_000;

/**
 * Detect whether the current process is running inside cmux.
 *
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @returns {boolean}
 */
export function isStudioCmuxSession(env = process.env) {
	const workspaceId = String(env.CMUX_WORKSPACE_ID ?? "").trim();
	const termProgram = String(env.TERM_PROGRAM ?? "").trim().toLowerCase();
	const term = String(env.TERM ?? "").trim().toLowerCase();
	const bundleId = String(env.CMUX_BUNDLE_ID ?? "").trim().toLowerCase();
	return Boolean(workspaceId || termProgram === "cmux" || term.includes("cmux") || bundleId.includes("cmux"));
}

/**
 * Build the cmux CLI invocation for opening Studio in the caller's workspace.
 *
 * @param {string} target
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @returns {{ command: string, args: string[] } | undefined}
 */
export function getStudioCmuxBrowserOpenCommand(target, env = process.env) {
	if (!isStudioCmuxSession(env)) return undefined;

	const workspaceId = String(env.CMUX_WORKSPACE_ID ?? "").trim();
	const command = String(env.CMUX_BUNDLED_CLI_PATH ?? "").trim() || "cmux";
	const args = ["browser", "open", target];
	if (workspaceId) args.push("--workspace", workspaceId);
	args.push("--focus", "true");
	return { command, args };
}

/**
 * Build the platform-native system-browser invocation.
 *
 * @param {string} target
 * @param {NodeJS.Platform} [platform]
 * @returns {{ command: string, args: string[] }}
 */
export function getStudioDefaultBrowserOpenCommand(target, platform = process.platform) {
	if (platform === "darwin") return { command: "open", args: [target] };
	if (platform === "win32") return { command: "cmd", args: ["/c", "start", "", target] };
	return { command: "xdg-open", args: [target] };
}

/**
 * @param {{ command: string, args: string[] }} openCommand
 * @param {typeof spawn} spawnProcess
 * @returns {Promise<void>}
 */
function spawnDetachedBrowser(openCommand, spawnProcess) {
	return new Promise((resolve, reject) => {
		let child;
		try {
			child = spawnProcess(openCommand.command, openCommand.args, {
				stdio: "ignore",
				detached: true,
			});
		} catch (error) {
			reject(error);
			return;
		}
		child.once("error", reject);
		child.once("spawn", () => {
			child.unref();
			resolve();
		});
	});
}

/**
 * Try to open Studio in a focused cmux browser surface.
 *
 * @param {string} target
 * @param {{
 *   env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
 *   spawnProcess?: typeof spawn,
 *   timeoutMs?: number,
 * }} [options]
 * @returns {Promise<boolean>}
 */
export async function tryOpenStudioUrlInCmuxBrowser(target, options = {}) {
	const openCommand = getStudioCmuxBrowserOpenCommand(target, options.env ?? process.env);
	if (!openCommand) return false;

	const spawnProcess = options.spawnProcess ?? spawn;
	const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs >= 0
		? options.timeoutMs
		: STUDIO_CMUX_BROWSER_OPEN_TIMEOUT_MS;

	return await new Promise((resolve) => {
		let settled = false;
		let child;
		const finish = (opened) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			resolve(opened);
		};
		const timeout = setTimeout(() => {
			child?.kill();
			finish(false);
		}, timeoutMs);
		timeout.unref?.();

		try {
			child = spawnProcess(openCommand.command, openCommand.args, { stdio: "ignore" });
		} catch {
			finish(false);
			return;
		}
		child.once("error", () => finish(false));
		child.once("close", (code) => finish(code === 0));
	});
}

/**
 * Open Studio in cmux when available, falling back to the system browser.
 *
 * @param {string} target
 * @param {{
 *   env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
 *   platform?: NodeJS.Platform,
 *   spawnProcess?: typeof spawn,
 *   timeoutMs?: number,
 * }} [options]
 * @returns {Promise<"cmux" | "system">}
 */
export async function openStudioUrlInBrowser(target, options = {}) {
	if (await tryOpenStudioUrlInCmuxBrowser(target, options)) return "cmux";

	const openCommand = getStudioDefaultBrowserOpenCommand(target, options.platform ?? process.platform);
	await spawnDetachedBrowser(openCommand, options.spawnProcess ?? spawn);
	return "system";
}

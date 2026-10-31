// The name a person's sends are recorded under, and the request-ID prefixes
// that say which route they came by (REPL_SESSION_RECORD_PROTOCOL.md,
// "People's sends"). The name comes from PI_REPL_USER_NAME, then the account's
// shared setting, then "User". Names are self-declared: they suit
// collaborators who trust each other, not auditing.

import { randomUUID } from "node:crypto";
import { chmodSync, closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";

export const DEFAULT_PERSON_NAME = "User";
export const PERSON_NAME_MAX_CHARS = 80;
export const PERSON_NAME_ENV = "PI_REPL_USER_NAME";

// Control characters, line and paragraph separators, and Unicode's bidirectional controls,
// which could break or disguise a name where it is shown.
const UNSHOWABLE = /[\p{Cc}\p{Zl}\p{Zp}\p{Bidi_Control}]/u;

/** The shared setting: person.json in $XDG_CONFIG_HOME/pi-repl, else ~/.config/pi-repl. */
export function getPersonSettingPath(env = process.env) {
	const xdg = env.XDG_CONFIG_HOME;
	const base = xdg && isAbsolute(xdg) ? xdg : join(homedir(), ".config");
	return join(base, "pi-repl", "person.json");
}

/** A name trimmed, or why it can't be one. */
export function validatePersonName(value) {
	if (typeof value !== "string") return { error: "a name must be text" };
	const name = value.trim();
	if (!name) return { error: "the name is empty" };
	if ([...name].length > PERSON_NAME_MAX_CHARS) return { error: `the name is longer than ${PERSON_NAME_MAX_CHARS} characters` };
	if (UNSHOWABLE.test(name)) return { error: "the name has control characters" };
	return { name };
}

/** The saved name, if the setting holds a valid one. Never writes anything. */
export function readPersonSetting(env = process.env) {
	const path = getPersonSettingPath(env);
	let text;
	try {
		text = readFileSync(path, "utf8");
	} catch (error) {
		if (error?.code === "ENOENT") return { path };
		return { path, warning: `${path} couldn't be read (${error?.message ?? error}), so it was ignored.` };
	}
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch {
		return { path, warning: `${path} isn't valid JSON, so it was ignored.` };
	}
	const checked = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? validatePersonName(parsed.name) : { error: "it isn't an object with a name" };
	if (checked.error) return { path, warning: `${path} has no usable name (${checked.error}), so it was ignored.` };
	return { path, name: checked.name };
}

/**
 * The name a person's sends are recorded under, and where it comes from:
 * "environment" (PI_REPL_USER_NAME), "setting" (the shared file) or "default".
 * `saved` is the setting's name when the environment hides it.
 * @returns {{ name: string, source: "environment" | "setting" | "default", path: string, saved?: string, warning?: string }}
 */
export function resolvePersonName(env = process.env) {
	const setting = readPersonSetting(env);
	const warnings = setting.warning ? [setting.warning] : [];
	const raw = env[PERSON_NAME_ENV];
	if (typeof raw === "string" && raw.trim()) {
		const checked = validatePersonName(raw);
		if (!checked.error) return { name: checked.name, source: "environment", path: setting.path, saved: setting.name, warning: warnings.join(" ") || undefined };
		warnings.unshift(`${PERSON_NAME_ENV} was ignored: ${checked.error}.`);
	}
	if (setting.name) return { name: setting.name, source: "setting", path: setting.path, warning: warnings.join(" ") || undefined };
	return { name: DEFAULT_PERSON_NAME, source: "default", path: setting.path, warning: warnings.join(" ") || undefined };
}

/** Saves the name as the account's shared setting, replacing the file atomically with mode 0600. */
export function savePersonName(value, env = process.env) {
	const checked = validatePersonName(value);
	if (checked.error) throw new Error(`Not saved: ${checked.error}.`);
	const path = getPersonSettingPath(env);
	mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
	const tempPath = join(dirname(path), `.person.json.${process.pid}.${randomUUID()}.tmp`);
	let fd = -1;
	try {
		fd = openSync(tempPath, "wx", 0o600);
		writeFileSync(fd, `${JSON.stringify({ name: checked.name }, null, 2)}\n`, "utf8");
		fsyncSync(fd);
		closeSync(fd);
		fd = -1;
		renameSync(tempPath, path);
		if (process.platform !== "win32") chmodSync(path, 0o600);
	} finally {
		if (fd >= 0) closeSync(fd);
		rmSync(tempPath, { force: true });
	}
	return { name: checked.name, path };
}

/** Removes the shared setting, so sends without PI_REPL_USER_NAME are recorded as "User". */
export function clearPersonName(env = process.env) {
	const path = getPersonSettingPath(env);
	try {
		rmSync(path);
		return { path, removed: true };
	} catch (error) {
		if (error?.code === "ENOENT") return { path, removed: false };
		throw error;
	}
}

/** A person's request ID: its prefix says the route ("pi" or "cli") and what was sent ("send" or "env"). */
export function personRequestId(channel, kind) {
	if (channel !== "pi" && channel !== "cli") throw new Error(`Unknown person channel: ${channel}`);
	if (kind !== "send" && kind !== "env") throw new Error(`Unknown person request: ${kind}`);
	return `${channel}:${kind}:${randomUUID()}`;
}

/**
 * What `name` says with no argument: the name used and where it comes from,
 * and the saved one when PI_REPL_USER_NAME hides it. `command` is how this
 * client sets it, such as "/repl name" or "agent-repl name".
 */
export function formatPersonNameStatus(resolved, command) {
	const lines = [];
	if (resolved.source === "environment") {
		lines.push(`Your sends are recorded as ${JSON.stringify(resolved.name)}, from ${PERSON_NAME_ENV}.`);
		lines.push(resolved.saved
			? `The saved name, ${JSON.stringify(resolved.saved)} (${resolved.path}), applies where ${PERSON_NAME_ENV} isn't set.`
			: `No name is saved in ${resolved.path}.`);
	} else if (resolved.source === "setting") {
		lines.push(`Your sends are recorded as ${JSON.stringify(resolved.name)}, saved in ${resolved.path} for everyone on this account without ${PERSON_NAME_ENV}.`);
		lines.push(`Change it with ${command} <name>, or remove it with ${command} --clear.`);
	} else {
		lines.push(`Your sends are recorded as ${JSON.stringify(DEFAULT_PERSON_NAME)}: no name is set.`);
		lines.push(`Set one with ${command} <name>. It's saved in ${resolved.path}, for everyone on this account without ${PERSON_NAME_ENV}.`);
	}
	if (resolved.warning) lines.push(resolved.warning);
	return lines.join("\n");
}

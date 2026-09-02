import { randomUUID } from "node:crypto";
import {
	chmodSync,
	closeSync,
	existsSync,
	fsyncSync,
	lstatSync,
	mkdirSync,
	openSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { lstat, mkdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

export const REPL_SESSION_RECORD_PROTOCOL = "pi-repl-session-record";
export const REPL_SESSION_RECORD_VERSION = 1;
export const REPL_SESSION_RECORD_ID_OPTION = "@pi_repl_record_id";
export const REPL_SESSION_RECORD_VERSION_OPTION = "@pi_repl_record_version";
export const REPL_SESSION_RECORD_MAX_ENTRIES = 300;
export const REPL_SESSION_RECORD_MAX_CODE_CHARS = 200_000;
export const REPL_SESSION_RECORD_MAX_PROSE_CHARS = 80_000;
export const REPL_SESSION_RECORD_MAX_OUTPUT_CHARS = 200_000;
export const REPL_SESSION_RECORD_MAX_BYTES = 16 * 1024 * 1024;

const RECORD_ID_PATTERN = /^[a-f0-9]{32}$/;
const RECORD_LOCK_WAIT_MS = 5_000;
const RECORD_LOCK_STALE_MS = 30_000;
const SEND_LEASE_STALE_MS = 30_000;
const SEND_LEASE_HEARTBEAT_MS = 5_000;
const MAX_JAVASCRIPT_TIMESTAMP = 8_640_000_000_000_000;
const WAIT_ARRAY = new Int32Array(new SharedArrayBuffer(4));

function currentUid() {
	return typeof process.getuid === "function" ? process.getuid() : null;
}

function getRootSuffix() {
	const uid = currentUid();
	return uid == null ? "user" : String(uid);
}

/**
 * Return the private, user-scoped root used by protocol-v1 session records.
 * Tests may pass { root } to every public operation to isolate their files.
 */
export function getReplSessionRecordRoot(options = {}) {
	return resolve(options.root || join(tmpdir(), `pi-repl-session-records-${getRootSuffix()}`));
}

export function createReplSessionRecordId() {
	return randomUUID().replace(/-/g, "").toLowerCase();
}

export function isValidReplSessionRecordId(value) {
	return typeof value === "string" && RECORD_ID_PATTERN.test(value);
}

function assertRecordId(recordId) {
	if (!isValidReplSessionRecordId(recordId)) {
		throw new Error("Invalid shared REPL record ID.");
	}
}

export function getReplSessionRecordPath(recordId, options = {}) {
	assertRecordId(recordId);
	return join(getReplSessionRecordRoot(options), `${recordId}.json`);
}

function getRecordLockPath(recordId, options = {}) {
	return join(getReplSessionRecordRoot(options), `${recordId}.record.lock`);
}

function getSendLeasePath(recordId, options = {}) {
	return join(getReplSessionRecordRoot(options), `${recordId}.send.lock`);
}

function assertOwnedByCurrentUser(path, info) {
	const uid = currentUid();
	if (uid != null && typeof info.uid === "number" && info.uid !== uid) {
		throw new Error(`Refusing shared REPL state not owned by the current user: ${path}`);
	}
}

function ensurePrivateRoot(options = {}) {
	const root = getReplSessionRecordRoot(options);
	mkdirSync(root, { recursive: true, mode: 0o700 });
	const info = lstatSync(root);
	if (!info.isDirectory() || info.isSymbolicLink()) {
		throw new Error(`Shared REPL record root is not a real directory: ${root}`);
	}
	assertOwnedByCurrentUser(root, info);
	if (process.platform !== "win32") chmodSync(root, 0o700);
	return root;
}

function assertSafeRecordFile(path) {
	const info = lstatSync(path);
	if (!info.isFile() || info.isSymbolicLink()) {
		throw new Error(`Shared REPL record is not a regular file: ${path}`);
	}
	if (typeof info.nlink === "number" && info.nlink !== 1) {
		throw new Error(`Shared REPL record has an unsafe hard-link count: ${path}`);
	}
	assertOwnedByCurrentUser(path, info);
	if (info.size > REPL_SESSION_RECORD_MAX_BYTES * 2) {
		throw new Error(`Shared REPL record exceeds the safe read limit: ${path}`);
	}
	if (process.platform !== "win32") chmodSync(path, 0o600);
	return info;
}

function normalizeBoundedString(value, maxChars) {
	const text = typeof value === "string" ? value.replace(/\r\n/g, "\n").replace(/\r/g, "\n") : "";
	if (text.length <= maxChars) return { text, omittedChars: 0 };
	const markerBudget = 96;
	const usable = Math.max(2, maxChars - markerBudget);
	const head = Math.floor(usable * 0.6);
	const tail = usable - head;
	const omittedChars = text.length - head - tail;
	return {
		text: `${text.slice(0, head)}\n\n… ${omittedChars} characters omitted from shared REPL record …\n\n${text.slice(text.length - tail)}`,
		omittedChars,
	};
}

function normalizeTimestamp(value, fallback) {
	return typeof value === "number"
		&& Number.isFinite(value)
		&& value >= 0
		&& value <= MAX_JAVASCRIPT_TIMESTAMP
		? Math.floor(value)
		: fallback;
}

function normalizeNonNegativeInteger(value, maximum = Number.MAX_SAFE_INTEGER) {
	const numeric = Number(value);
	return Number.isFinite(numeric) && numeric > 0
		? Math.min(maximum, Math.floor(numeric))
		: 0;
}

function normalizeRecordIdentity(identity) {
	if (!identity || typeof identity !== "object") throw new Error("Shared REPL record identity is required.");
	const sessionName = typeof identity.sessionName === "string" ? identity.sessionName.trim() : "";
	if (!sessionName || sessionName.length > 240 || /[\r\n\0]/.test(sessionName)) {
		throw new Error("Invalid tmux session name for shared REPL record.");
	}
	const tmuxSessionId = typeof identity.tmuxSessionId === "string" ? identity.tmuxSessionId.trim() : "";
	if (!/^\$[0-9]+$/.test(tmuxSessionId)) {
		throw new Error("A valid tmux session ID is required for the shared REPL record.");
	}
	const tmuxSessionCreatedAt = normalizeTimestamp(identity.tmuxSessionCreatedAt, 0);
	if (tmuxSessionCreatedAt <= 0) {
		throw new Error("A valid tmux session creation time is required for the shared REPL record.");
	}
	const runtimeCandidate = typeof identity.runtime === "string"
		? identity.runtime.trim().toLowerCase().slice(0, 40)
		: "";
	const runtime = /^[a-z0-9_.+-]{1,40}$/.test(runtimeCandidate) ? runtimeCandidate : "unknown";
	return { sessionName, tmuxSessionId, tmuxSessionCreatedAt, runtime };
}

function normalizeOrigin(value, fallback = "unknown") {
	return value === "pi-repl" || value === "pi-studio" ? value : fallback;
}

function normalizeMode(value) {
	return value === "literate" || value === "agent" ? value : "raw";
}

function normalizeStatus(value) {
	return value === "sending"
		|| value === "sent"
		|| value === "captured"
		|| value === "timeout"
		|| value === "error"
		|| value === "note"
		? value
		: "sent";
}

/** Normalize and bound one interoperable clean-record entry. */
export function normalizeReplSessionRecordEntry(input, defaults = {}) {
	if (!input || typeof input !== "object") throw new Error("Shared REPL record entry must be an object.");
	const now = Date.now();
	const code = normalizeBoundedString(input.code, REPL_SESSION_RECORD_MAX_CODE_CHARS);
	const prose = normalizeBoundedString(input.prose, REPL_SESSION_RECORD_MAX_PROSE_CHARS);
	const output = normalizeBoundedString(input.output, REPL_SESSION_RECORD_MAX_OUTPUT_CHARS);
	const id = typeof input.id === "string" && /^[A-Za-z0-9_.:-]{1,240}$/.test(input.id)
		? input.id
		: `entry-${now.toString(36)}-${randomUUID().slice(0, 12)}`;
	const createdAt = normalizeTimestamp(input.createdAt, now);
	const updatedAt = Math.max(createdAt, normalizeTimestamp(input.updatedAt, now));
	const completedAt = input.completedAt == null ? null : Math.max(createdAt, normalizeTimestamp(input.completedAt, updatedAt));
	const sessionName = typeof input.sessionName === "string" ? input.sessionName.trim().slice(0, 240) : "";
	const runtime = typeof input.runtime === "string" && input.runtime.trim()
		? input.runtime.trim().toLowerCase().slice(0, 40)
		: "unknown";
	const labelRaw = typeof input.label === "string" ? input.label.replace(/[\r\n\0]+/g, " ").trim() : "";
	const requestIdRaw = typeof input.requestId === "string" ? input.requestId.replace(/[\r\n\0]+/g, "").trim() : "";
	return {
		id,
		requestId: requestIdRaw.slice(0, 300),
		createdAt,
		updatedAt,
		completedAt,
		sessionName,
		runtime,
		origin: normalizeOrigin(input.origin, normalizeOrigin(defaults.origin)),
		label: (labelRaw || "REPL send").slice(0, 240),
		mode: normalizeMode(input.mode),
		prose: prose.text,
		code: code.text,
		output: output.text,
		status: normalizeStatus(input.status),
		skippedChunks: normalizeNonNegativeInteger(input.skippedChunks, 100_000),
		codeOmittedChars: normalizeNonNegativeInteger(input.codeOmittedChars) + code.omittedChars,
		proseOmittedChars: normalizeNonNegativeInteger(input.proseOmittedChars) + prose.omittedChars,
		outputOmittedChars: normalizeNonNegativeInteger(input.outputOmittedChars) + output.omittedChars,
	};
}

function makeEmptyRecord(recordId, identity) {
	const normalizedIdentity = normalizeRecordIdentity(identity);
	const now = Date.now();
	return {
		protocol: REPL_SESSION_RECORD_PROTOCOL,
		version: REPL_SESSION_RECORD_VERSION,
		recordId,
		session: normalizedIdentity,
		revision: 0,
		createdAt: now,
		updatedAt: now,
		clearedAt: null,
		droppedEntries: 0,
		entries: [],
	};
}

function assertRecordIdentity(record, expectedIdentity) {
	if (!expectedIdentity) return;
	const expected = normalizeRecordIdentity(expectedIdentity);
	const actual = normalizeRecordIdentity(record.session);
	if (actual.sessionName !== expected.sessionName) {
		throw new Error(`Shared REPL record belongs to tmux session ${actual.sessionName}, not ${expected.sessionName}.`);
	}
	if (actual.tmuxSessionId && expected.tmuxSessionId && actual.tmuxSessionId !== expected.tmuxSessionId) {
		throw new Error("Shared REPL record belongs to a different tmux session ID.");
	}
	if (
		actual.tmuxSessionCreatedAt
		&& expected.tmuxSessionCreatedAt
		&& actual.tmuxSessionCreatedAt !== expected.tmuxSessionCreatedAt
	) {
		throw new Error("Shared REPL record belongs to a different tmux session lifetime.");
	}
}

function normalizeRecord(parsed, recordId, expectedIdentity) {
	if (!parsed || typeof parsed !== "object") throw new Error("Shared REPL record is not a JSON object.");
	if (parsed.protocol !== REPL_SESSION_RECORD_PROTOCOL || parsed.version !== REPL_SESSION_RECORD_VERSION) {
		throw new Error("Unsupported shared REPL record protocol or version.");
	}
	if (parsed.recordId !== recordId) throw new Error("Shared REPL record ID does not match its file name.");
	const session = normalizeRecordIdentity(parsed.session);
	const createdAt = normalizeTimestamp(parsed.createdAt, Date.now());
	const entries = Array.isArray(parsed.entries)
		? parsed.entries.map((entry) => normalizeReplSessionRecordEntry(entry)).slice(-REPL_SESSION_RECORD_MAX_ENTRIES)
		: [];
	const record = {
		protocol: REPL_SESSION_RECORD_PROTOCOL,
		version: REPL_SESSION_RECORD_VERSION,
		recordId,
		session,
		revision: normalizeNonNegativeInteger(parsed.revision),
		createdAt,
		updatedAt: Math.max(createdAt, normalizeTimestamp(parsed.updatedAt, createdAt)),
		clearedAt: parsed.clearedAt == null ? null : normalizeTimestamp(parsed.clearedAt, createdAt),
		droppedEntries: normalizeNonNegativeInteger(parsed.droppedEntries),
		entries,
	};
	assertRecordIdentity(record, expectedIdentity);
	return record;
}

function readRecordUnlocked(recordId, expectedIdentity, options = {}) {
	const path = getReplSessionRecordPath(recordId, options);
	if (!existsSync(path)) return null;
	assertSafeRecordFile(path);
	let parsed;
	try {
		parsed = JSON.parse(readFileSync(path, "utf8"));
	} catch (error) {
		throw new Error(`Could not parse shared REPL record ${path}: ${error instanceof Error ? error.message : String(error)}`);
	}
	return normalizeRecord(parsed, recordId, expectedIdentity);
}

function serializeBoundedRecord(record) {
	let droppedNow = 0;
	let entries = [...record.entries]
		.sort((a, b) => (a.createdAt - b.createdAt) || a.id.localeCompare(b.id))
		.slice(-REPL_SESSION_RECORD_MAX_ENTRIES);
	if (record.entries.length > entries.length) droppedNow += record.entries.length - entries.length;
	let candidate = { ...record, droppedEntries: record.droppedEntries + droppedNow, entries };
	let json = `${JSON.stringify(candidate, null, 2)}\n`;
	while (Buffer.byteLength(json, "utf8") > REPL_SESSION_RECORD_MAX_BYTES && entries.length > 1) {
		entries = entries.slice(1);
		droppedNow += 1;
		candidate = { ...record, droppedEntries: record.droppedEntries + droppedNow, entries };
		json = `${JSON.stringify(candidate, null, 2)}\n`;
	}
	if (Buffer.byteLength(json, "utf8") > REPL_SESSION_RECORD_MAX_BYTES) {
		throw new Error("One shared REPL record entry exceeds the bounded record size.");
	}
	return { record: candidate, json };
}

function writeRecordAtomically(record, options = {}) {
	const root = ensurePrivateRoot(options);
	const path = getReplSessionRecordPath(record.recordId, options);
	if (existsSync(path)) assertSafeRecordFile(path);
	const bounded = serializeBoundedRecord(record);
	const tempPath = join(root, `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);
	let fd = -1;
	try {
		fd = openSync(tempPath, "wx", 0o600);
		writeFileSync(fd, bounded.json, "utf8");
		fsyncSync(fd);
		closeSync(fd);
		fd = -1;
		renameSync(tempPath, path);
		if (process.platform !== "win32") chmodSync(path, 0o600);
		try {
			const dirFd = openSync(dirname(path), "r");
			try { fsyncSync(dirFd); } finally { closeSync(dirFd); }
		} catch {
			// Directory fsync is best effort on filesystems/platforms that permit it.
		}
		return bounded.record;
	} finally {
		if (fd >= 0) {
			try { closeSync(fd); } catch { /* ignore cleanup error */ }
		}
		if (existsSync(tempPath)) {
			try { rmSync(tempPath, { force: true }); } catch { /* ignore cleanup error */ }
		}
	}
}

function sleepSync(ms) {
	Atomics.wait(WAIT_ARRAY, 0, 0, Math.max(1, ms));
}

function removeStaleLockSync(lockPath, staleMs) {
	try {
		const info = lstatSync(lockPath);
		if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Unsafe shared REPL lock path: ${lockPath}`);
		assertOwnedByCurrentUser(lockPath, info);
		if (Date.now() - info.mtimeMs <= staleMs) return false;
		rmSync(lockPath, { recursive: true, force: true });
		return true;
	} catch (error) {
		if (error && typeof error === "object" && error.code === "ENOENT") return true;
		throw error;
	}
}

function acquireRecordLockSync(recordId, options = {}) {
	ensurePrivateRoot(options);
	const lockPath = getRecordLockPath(recordId, options);
	const deadline = Date.now() + Math.max(0, Number(options.lockWaitMs ?? RECORD_LOCK_WAIT_MS));
	const token = randomUUID();
	while (true) {
		let created = false;
		try {
			mkdirSync(lockPath, { mode: 0o700 });
			created = true;
			writeFileSync(join(lockPath, "owner.json"), `${JSON.stringify({ token, pid: process.pid, createdAt: Date.now() })}\n`, { mode: 0o600, flag: "wx" });
			break;
		} catch (error) {
			if (created) {
				try { rmSync(lockPath, { recursive: true, force: true }); } catch { /* preserve the owner-file error */ }
				throw error;
			}
			if (!error || typeof error !== "object" || error.code !== "EEXIST") throw error;
			if (removeStaleLockSync(lockPath, Math.max(0, Number(options.lockStaleMs ?? RECORD_LOCK_STALE_MS)))) continue;
			if (Date.now() >= deadline) throw new Error("Timed out waiting to update the shared REPL record.");
			sleepSync(20);
		}
	}
	return () => {
		try {
			const owner = JSON.parse(readFileSync(join(lockPath, "owner.json"), "utf8"));
			if (owner.token !== token) return;
			rmSync(lockPath, { recursive: true, force: true });
		} catch {
			// A stale-lock recovery may already have removed the directory.
		}
	};
}

export function readReplSessionRecord(recordId, expectedIdentity, options = {}) {
	assertRecordId(recordId);
	ensurePrivateRoot(options);
	return readRecordUnlocked(recordId, expectedIdentity, options);
}

export function ensureReplSessionRecord(recordId, identity, options = {}) {
	assertRecordId(recordId);
	const release = acquireRecordLockSync(recordId, options);
	try {
		const existing = readRecordUnlocked(recordId, identity, options);
		if (existing) return existing;
		return writeRecordAtomically(makeEmptyRecord(recordId, identity), options);
	} finally {
		release();
	}
}

export function upsertReplSessionRecordEntry(recordId, identity, input, options = {}) {
	assertRecordId(recordId);
	const release = acquireRecordLockSync(recordId, options);
	try {
		const record = readRecordUnlocked(recordId, identity, options) || makeEmptyRecord(recordId, identity);
		const existingIndex = record.entries.findIndex((entry) => entry.id === input.id);
		const existing = existingIndex >= 0 ? record.entries[existingIndex] : null;
		const entryInput = existing
			? { ...existing, ...input, id: existing.id, createdAt: existing.createdAt }
			: input;
		const entry = normalizeReplSessionRecordEntry({
			...entryInput,
			sessionName: entryInput.sessionName || record.session.sessionName,
			runtime: entryInput.runtime || record.session.runtime,
		}, { origin: options.origin });
		if (entry.sessionName && entry.sessionName !== record.session.sessionName) {
			throw new Error("Shared REPL entry session name does not match the record session.");
		}
		entry.sessionName = record.session.sessionName;
		entry.updatedAt = Math.max(Date.now(), entry.updatedAt);
		const entries = [...record.entries];
		if (existingIndex >= 0) entries[existingIndex] = entry;
		else entries.push(entry);
		const normalizedIdentity = normalizeRecordIdentity(identity);
		const next = writeRecordAtomically({
			...record,
			session: {
				...record.session,
				runtime: normalizedIdentity.runtime === "unknown" ? record.session.runtime : normalizedIdentity.runtime,
			},
			revision: record.revision + 1,
			updatedAt: Date.now(),
			entries,
		}, options);
		return { entry: next.entries.find((candidate) => candidate.id === entry.id) || entry, record: next, path: getReplSessionRecordPath(recordId, options) };
	} finally {
		release();
	}
}

export function clearReplSessionRecord(recordId, identity, options = {}) {
	assertRecordId(recordId);
	const release = acquireRecordLockSync(recordId, options);
	try {
		const record = readRecordUnlocked(recordId, identity, options) || makeEmptyRecord(recordId, identity);
		const now = Date.now();
		return writeRecordAtomically({
			...record,
			revision: record.revision + 1,
			updatedAt: now,
			clearedAt: now,
			droppedEntries: record.droppedEntries + record.entries.length,
			entries: [],
		}, options);
	} finally {
		release();
	}
}

async function removeStaleLease(lockPath, staleMs) {
	try {
		const info = await lstat(lockPath);
		if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Unsafe shared REPL send lease path: ${lockPath}`);
		assertOwnedByCurrentUser(lockPath, info);
		if (Date.now() - info.mtimeMs <= staleMs) return false;
		await rm(lockPath, { recursive: true, force: true });
		return true;
	} catch (error) {
		if (error && typeof error === "object" && error.code === "ENOENT") return true;
		throw error;
	}
}

function sleep(ms, signal) {
	return new Promise((resolveSleep, reject) => {
		if (signal?.aborted) {
			reject(new Error("Shared REPL send was aborted while waiting for the session lease."));
			return;
		}
		let timer;
		const cleanup = () => signal?.removeEventListener("abort", onAbort);
		const onAbort = () => {
			clearTimeout(timer);
			cleanup();
			reject(new Error("Shared REPL send was aborted while waiting for the session lease."));
		};
		timer = setTimeout(() => {
			cleanup();
			resolveSleep();
		}, ms);
		signal?.addEventListener("abort", onAbort, { once: true });
	});
}

/**
 * Acquire the cross-client send lease for one tmux session record. Compatible
 * clients hold this from the pre-send pane capture through the completion
 * capture, preventing them from attributing each other's output.
 */
export async function acquireReplSessionSendLease(recordId, options = {}) {
	assertRecordId(recordId);
	ensurePrivateRoot(options);
	const lockPath = getSendLeasePath(recordId, options);
	const waitMs = Math.max(0, Math.floor(Number(options.waitMs ?? 20_000)));
	const staleMs = Math.max(10_000, Math.floor(Number(options.staleMs ?? SEND_LEASE_STALE_MS)));
	const deadline = Date.now() + waitMs;
	const token = randomUUID();
	while (true) {
		if (options.signal?.aborted) throw new Error("Shared REPL send was aborted while waiting for the session lease.");
		let created = false;
		try {
			await mkdir(lockPath, { mode: 0o700 });
			created = true;
			await writeFile(join(lockPath, "owner.json"), `${JSON.stringify({
				token,
				pid: process.pid,
				owner: typeof options.owner === "string" ? options.owner.slice(0, 120) : "unknown",
				createdAt: Date.now(),
			})}\n`, { mode: 0o600, flag: "wx" });
			break;
		} catch (error) {
			if (created) {
				await rm(lockPath, { recursive: true, force: true }).catch(() => undefined);
				throw error;
			}
			if (!error || typeof error !== "object" || error.code !== "EEXIST") throw error;
			if (await removeStaleLease(lockPath, staleMs)) continue;
			if (Date.now() >= deadline) {
				throw new Error("The shared REPL session is busy in another compatible client.");
			}
			await sleep(50, options.signal);
		}
	}

	let released = false;
	const heartbeat = setInterval(() => {
		const now = new Date();
		void utimes(lockPath, now, now).catch(() => undefined);
	}, Math.min(SEND_LEASE_HEARTBEAT_MS, Math.max(1_000, Math.floor(staleMs / 3))));
	heartbeat.unref?.();

	return {
		recordId,
		path: lockPath,
		async release() {
			if (released) return;
			released = true;
			clearInterval(heartbeat);
			try {
				const owner = JSON.parse(await readFile(join(lockPath, "owner.json"), "utf8"));
				if (owner.token !== token) return;
				await rm(lockPath, { recursive: true, force: true });
			} catch (error) {
				if (!error || typeof error !== "object" || error.code !== "ENOENT") throw error;
			}
		},
	};
}

function markdownFence(text, language = "") {
	const value = String(text || "").replace(/\s+$/, "");
	let fence = "```";
	while (value.includes(fence)) fence += "`";
	return `${fence}${language}\n${value}\n${fence}`;
}

function markdownRuntime(runtime) {
	return runtime === "ipython" ? "python" : runtime === "unknown" || runtime === "shell" ? "" : runtime;
}

/** Produce the deterministic Markdown representation used by compatible UIs. */
export function renderReplSessionRecordMarkdown(record, options = {}) {
	if (!record || typeof record !== "object" || !Array.isArray(record.entries)) {
		throw new Error("A shared REPL record is required for Markdown rendering.");
	}
	const title = typeof options.title === "string" && options.title.trim() ? options.title.trim() : "Shared REPL Record";
	const lines = [`# ${title}`, "", `Session: \`${record.session?.sessionName || "unknown"}\``, `Record protocol: ${REPL_SESSION_RECORD_PROTOCOL} v${REPL_SESSION_RECORD_VERSION}`];
	if (record.updatedAt) lines.push(`Updated: ${new Date(record.updatedAt).toISOString()}`);
	lines.push("");
	if (!record.entries.length) {
		lines.push("_No compatible-client entries have been recorded for this tmux session._", "");
	} else {
		record.entries.forEach((entry, index) => {
			lines.push(`## ${index + 1}. ${entry.label || "REPL entry"}`, "");
			lines.push(`- Time: ${new Date(entry.createdAt || record.createdAt || Date.now()).toISOString()}`);
			lines.push(`- Origin: ${entry.origin || "unknown"}`);
			lines.push(`- Mode: ${entry.mode || "raw"}`);
			lines.push(`- Status: ${entry.status || "sent"}`);
			if (entry.runtime) lines.push(`- Runtime: ${entry.runtime}`);
			if (entry.skippedChunks) lines.push(`- Skipped chunks: ${entry.skippedChunks}`);
			lines.push("");
			if (String(entry.prose || "").trim()) lines.push(String(entry.prose).trim(), "");
			if (String(entry.code || "").trim()) lines.push(markdownFence(entry.code, markdownRuntime(entry.runtime)), "");
			if (String(entry.output || "").trim()) lines.push("Output:", "", markdownFence(entry.output, "text"), "");
		});
	}
	lines.push("_This clean record contains submissions made through compatible clients. Commands typed directly into an attached tmux pane remain available only in the raw pane/history mirror._", "");
	return lines.join("\n").replace(/\n{4,}/g, "\n\n\n");
}

import { execFile } from "node:child_process";
import { readFile, lstat, unlink } from "node:fs/promises";
import { basename } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
export const GNUPLOT_OWNER_ENV = "PI_REPL_GNUPLOT_OWNER";
export const GNUPLOT_OWNER_OPTION = "@pi_repl_gnuplot_owner";
export const validGnuplotOwner = (value) => typeof value === "string" && value.length === 32 && /^[a-f0-9]{32}$/.test(value);

// On macOS, ps flattens argv/environment into ambiguous text. Read the native
// NUL-delimited KERN_PROCARGS2 buffer instead. Only the requested marker leaves
// this isolated stdlib-only process: never print argv or other environment data.
const macOwnerScript = String.raw`
import ctypes, errno, json, struct, sys
libc = ctypes.CDLL('/usr/lib/libSystem.B.dylib', use_errno=True)
libc.sysctl.argtypes = [ctypes.POINTER(ctypes.c_int), ctypes.c_uint, ctypes.c_void_p, ctypes.POINTER(ctypes.c_size_t), ctypes.c_void_p, ctypes.c_size_t]
key = b'PI_REPL_GNUPLOT_OWNER='
rows = []
for value in sys.argv[1:]:
    pid = int(value)
    try:
        mib = (ctypes.c_int * 3)(1, 49, pid)
        size = ctypes.c_size_t()
        if libc.sysctl(mib, 3, None, ctypes.byref(size), None, 0):
            raise OSError(ctypes.get_errno(), 'process metadata unavailable')
        if not 4 <= size.value <= 1048576:
            raise ValueError('invalid process metadata size')
        buffer = ctypes.create_string_buffer(size.value)
        if libc.sysctl(mib, 3, buffer, ctypes.byref(size), None, 0):
            raise OSError(ctypes.get_errno(), 'process metadata unavailable')
        data = buffer.raw[:size.value]
        argc = struct.unpack_from('i', data)[0]
        if not 1 <= argc <= 16384:
            raise ValueError('invalid argument count')
        pos = data.index(b'\0', 4) + 1
        while pos < len(data) and data[pos] == 0:
            pos += 1
        for _ in range(argc):
            pos = data.index(b'\0', pos) + 1
        matches = [item[len(key):].decode('ascii') for item in data[pos:].split(b'\0') if item.startswith(key)]
        if len(matches) > 1:
            raise ValueError('duplicate ownership marker')
        marker = matches[0] if matches else None
        if marker is not None and (len(marker) != 32 or any(c not in '0123456789abcdef' for c in marker)):
            marker = None
        rows.append({'pid': pid, 'owner': marker})
    except OSError as error:
        rows.append({'pid': pid, 'gone': True} if error.errno == errno.ESRCH else {'pid': pid, 'error': 'process metadata unavailable'})
    except Exception:
        rows.append({'pid': pid, 'error': 'invalid process metadata'})
print(json.dumps(rows))
`;

export function parseGnuplotCandidates(text, uid) {
	return text.split("\n").filter((line) => line.trim()).flatMap((line) => {
		const match = /^\s*(\d+)\s+(\d+)\s+(.+)$/.exec(line);
		if (!match) throw new Error("Could not parse gnuplot process candidates; refusing unverified cleanup.");
		const pid = Number(match[1]), ownerUid = Number(match[2]);
		if (![pid, ownerUid].every(Number.isSafeInteger)) throw new Error("Invalid gnuplot process identity.");
		// Include the interpreter too: QProcess's short-lived detached launcher
		// can still have that image before exec'ing gnuplot_qt. Names select
		// candidates only; they never authorize a signal.
		return ownerUid === uid && ["gnuplot", "gnuplot_qt"].includes(basename(match[3])) ? [pid] : [];
	});
}

export function ownerFromEnvironment(data) {
	const values = data.toString("utf8").split("\0").filter((value) => value.startsWith(`${GNUPLOT_OWNER_ENV}=`));
	if (values.length > 1) throw new Error("Duplicate gnuplot ownership marker.");
	return values.length ? values[0].slice(GNUPLOT_OWNER_ENV.length + 1) : null;
}

export async function readGnuplotOwners(pids, { platform = process.platform, execute = exec, read = readFile } = {}) {
	if (!pids.length) return [];
	if (pids.length > 128 || pids.some((pid) => !Number.isSafeInteger(pid) || pid <= 1)) throw new Error("Invalid or excessive gnuplot process candidates.");
	if (platform === "darwin") {
		let result, rows;
		try {
			result = await execute("python3", ["-I", "-S", "-c", macOwnerScript, ...pids.map(String)], {
				timeout: 3000, killSignal: "SIGKILL", maxBuffer: 64 * 1024,
			});
		} catch {
			throw new Error("Could not inspect gnuplot process ownership on macOS; an existing python3 is required. No installation was attempted.");
		}
		try { rows = JSON.parse(result.stdout); }
		catch { throw new Error("Invalid gnuplot ownership inspection result."); }
		if (!Array.isArray(rows) || rows.length !== pids.length || rows.some((row, i) => row.pid !== pids[i] || (!row.gone && !row.error && row.owner !== null && typeof row.owner !== "string"))) {
			throw new Error("Invalid gnuplot ownership inspection result.");
		}
		return rows;
	}
	if (platform === "linux") {
		return Promise.all(pids.map(async (pid) => {
			try {
				const data = await read(`/proc/${pid}/environ`);
				if (data.length > 1024 * 1024) throw new Error("Excessive process metadata.");
				const owner = ownerFromEnvironment(data);
				return { pid, owner: validGnuplotOwner(owner) ? owner : null };
			} catch (error) {
				if (error.code === "ENOENT" || error.code === "ESRCH") return { pid, gone: true };
				throw new Error(`Could not inspect gnuplot ownership for PID ${pid}.`, { cause: error });
			}
		}));
	}
	throw new Error("Detached gnuplot ownership inspection requires macOS or Linux.");
}

export async function findOwnedGnuplotProcesses(table, owner, { uid = process.getuid?.(), execute = exec, inspect = readGnuplotOwners } = {}) {
	if (!validGnuplotOwner(owner)) throw new Error("Invalid gnuplot ownership marker.");
	const listing = await execute("ps", ["-axo", "pid=,uid=,comm="], { timeout: 3000, maxBuffer: 4 * 1024 * 1024 });
	// Tty-attached interpreter jobs are already handled by pane ancestry.
	// Inspect only detached candidates; a text-only session needs no Python
	// metadata reader when no detached gnuplot processes exist.
	const candidates = parseGnuplotCandidates(listing.stdout, uid).filter((pid) => table.some((p) => p.pid === pid && p.uid === uid && /^\?+$/.test(p.tty) && !p.state.startsWith("Z")));
	const rows = await inspect(candidates);
	const failed = rows.find((row) => row.error);
	if (failed) throw new Error(`Could not inspect gnuplot ownership for PID ${failed.pid}; refusing unverified cleanup.`);
	return rows.filter((row) => row.owner === owner && !row.gone).map((row) => table.find((p) => p.pid === row.pid));
}

// Socket cleanup is separate from process ownership. Remember only paths
// actually open in a marked process, never a guessed TMPDIR/PID filename.
export function parseUnixSocketNames(text) {
	if (text && !text.includes("\0")) throw new Error("Could not parse Unix socket ownership data.");
	let pid;
	const entries = [];
	for (let field of text.split("\0")) {
		field = field.replace(/^\n+/, "");
		if (!field || field.startsWith("f")) continue;
		if (/^p\d+$/.test(field) && Number.isSafeInteger(Number(field.slice(1)))) { pid = Number(field.slice(1)); continue; }
		if (!pid || !field.startsWith("n")) throw new Error("Invalid Unix socket ownership field.");
		if (field.startsWith("n/")) {
			// Linux lsof may append socket type/state even in field output.
			const name = field.slice(1).replace(/ type=STREAM(?: \([^)]*\))?$/, "");
			entries.push({ pid, path: name });
		}
	}
	return entries;
}

async function unixSockets(selection, execute = exec) {
	try {
		const result = await execute("lsof", ["-nP", "-a", ...selection, "-U", "-F0pn"], { timeout: 3000, maxBuffer: 4 * 1024 * 1024 });
		if (result.stderr?.trim()) throw new Error("Unix socket ownership inspection was incomplete.");
		return parseUnixSocketNames(result.stdout);
	} catch (error) {
		if (error.code === 1 && !error.stdout && !error.stderr) return []; // no matching open sockets
		throw error;
	}
}

export async function snapshotGnuplotSockets(p, { execute = exec, stat = lstat } = {}) {
	const entries = await unixSockets(["-p", String(p.pid)], execute);
	const sockets = [];
	for (const entry of entries) {
		if (entry.pid !== p.pid || basename(entry.path) !== `qtgnuplot${p.pid}`) continue;
		const info = await stat(entry.path).catch((error) => { if (error.code === "ENOENT") return null; throw error; });
		if (info?.isSocket() && info.uid === p.uid) sockets.push({ path: entry.path, uid: info.uid, dev: info.dev, ino: info.ino, ctimeMs: info.ctimeMs });
	}
	return sockets;
}

export async function cleanupGnuplotSockets(sockets, { uid = process.getuid?.(), execute = exec, stat = lstat, remove = unlink } = {}) {
	if (!sockets.length) return [];
	// Refuse to unlink paths still reported by ANY same-user process, not just
	// gnuplot. This also catches replacement listeners and shared sockets.
	const references = await unixSockets(["-u", String(uid)], execute);
	const warnings = [];
	for (const socket of sockets) {
		const current = await stat(socket.path).catch((error) => { if (error.code === "ENOENT") return null; throw error; });
		if (!current) continue;
		if (references.some((entry) => entry.path === socket.path) || !current.isSocket() || current.uid !== uid || current.uid !== socket.uid || current.dev !== socket.dev || current.ino !== socket.ino || current.ctimeMs !== socket.ctimeMs) {
			warnings.push(`Qt socket changed or is still in use; left untouched: ${socket.path}`);
			continue;
		}
		await remove(socket.path).catch((error) => { if (error.code !== "ENOENT") throw error; });
	}
	return warnings;
}

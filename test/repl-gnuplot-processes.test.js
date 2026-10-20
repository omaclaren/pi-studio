import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { GNUPLOT_OWNER_ENV, validGnuplotOwner, ownerFromEnvironment, parseGnuplotCandidates, readGnuplotOwners, findOwnedGnuplotProcesses, parseUnixSocketNames, snapshotGnuplotSockets, cleanupGnuplotSockets } from "../shared/repl-gnuplot-processes.js";

const owner = "a".repeat(32);

test("gnuplot ownership markers are strict and environment parsing cannot match a value substring", () => {
	assert.equal(validGnuplotOwner(owner), true);
	for (const value of [undefined, "", owner + "\n", owner.toUpperCase(), "a".repeat(33)]) assert.equal(validGnuplotOwner(value), false);
	assert.equal(ownerFromEnvironment(Buffer.from(`OTHER= ${GNUPLOT_OWNER_ENV}=${owner}\0`)), null);
	assert.equal(ownerFromEnvironment(Buffer.from(`OTHER=secret\0${GNUPLOT_OWNER_ENV}=${owner}\0`)), owner);
	assert.throws(() => ownerFromEnvironment(Buffer.from(`${GNUPLOT_OWNER_ENV}=${owner}\0${GNUPLOT_OWNER_ENV}=${owner}\0`)), /Duplicate/);
});

test("process names only select same-user interpreter/Qt candidates, never authorize ownership", async () => {
	const listing = "100 501 /usr/bin/gnuplot\n101 501 /some path/gnuplot_qt\n102 502 /bin/gnuplot_qt\n103 501 /bin/not_gnuplot_qt\n";
	assert.deepEqual(parseGnuplotCandidates(listing, 501), [100, 101]);
	assert.throws(() => parseGnuplotCandidates("invalid", 501), /parse/);
	// macOS runs some daemons as `nobody`, which ps lists with uid -2.
	const nobody = "  404    -2 /usr/sbin/distnoted\n1001 501 /usr/bin/gnuplot\n1002 501 /bin/gnuplot_qt\n1003 502 /usr/bin/gnuplot\n1004 -2 /usr/bin/gnuplot\n";
	assert.deepEqual(parseGnuplotCandidates(nobody, 501), [1001, 1002]);
	for (const bad of ["-404 501 gnuplot", "404 --2 gnuplot", "404 -2x gnuplot", "not a process"]) assert.throws(() => parseGnuplotCandidates(bad, 501), /parse/, bad);
	const table = [100, 101, 102, 103].map((pid) => ({ pid, uid: pid === 102 ? 502 : 501, state: "S", tty: "??" }));
	const result = await findOwnedGnuplotProcesses(table, owner, {
		uid: 501, execute: async () => ({ stdout: listing }),
		inspect: async (pids) => { assert.deepEqual(pids, [100, 101]); return [{ pid: 100, owner: null }, { pid: 101, owner }]; },
	});
	assert.deepEqual(result, [table[1]]);
});

test("Linux ownership uses NUL-delimited proc metadata and treats only vanished processes as gone", async () => {
	const rows = await readGnuplotOwners([101, 102], {
		platform: "linux", read: async (path) => {
			if (path === "/proc/102/environ") throw Object.assign(Error("gone"), { code: "ENOENT" });
			assert.equal(path, "/proc/101/environ");
			return Buffer.from(`FAKE=value ${GNUPLOT_OWNER_ENV}=wrong\0${GNUPLOT_OWNER_ENV}=${owner}\0`);
		},
	});
	assert.deepEqual(rows, [{ pid: 101, owner }, { pid: 102, gone: true }]);
	await assert.rejects(readGnuplotOwners([101], { platform: "linux", read: async () => { throw Object.assign(Error("denied"), { code: "EACCES" }); } }), /Could not inspect/);
});

test("macOS inspection uses isolated stdlib Python with bounded output, not flattened ps environment text", async () => {
	const rows = await readGnuplotOwners([101], { platform: "darwin", execute: async (command, args, options) => {
		assert.equal(command, "python3");
		assert.deepEqual(args.slice(0, 3), ["-I", "-S", "-c"]);
		assert.equal(args.at(-1), "101");
		assert.match(args[3], /sysctl/);
		assert.equal(options.timeout, 3000);
		assert.equal(options.killSignal, "SIGKILL");
		assert.equal(options.maxBuffer, 65536);
		return { stdout: JSON.stringify([{ pid: 101, owner }]) };
	} });
	assert.deepEqual(rows, [{ pid: 101, owner }]);
	await assert.rejects(readGnuplotOwners([101], { platform: "darwin", execute: async () => ({ stdout: '[{"pid":102,"owner":null}]' }) }), /Invalid/);
});

test("ownership inspection failures and invalid candidates fail closed", async () => {
	for (const pids of [[1], [-10], [NaN], Array(129).fill(101)]) await assert.rejects(readGnuplotOwners(pids), /Invalid or excessive/);
	await assert.rejects(readGnuplotOwners([101], { platform: "unsupported" }), /requires macOS or Linux/);
	await assert.rejects(findOwnedGnuplotProcesses([{ pid: 101, uid: 501, state: "S", tty: "??" }], owner, {
		uid: 501, execute: async () => ({ stdout: "101 501 gnuplot_qt\n" }), inspect: async () => [{ pid: 101, error: "unavailable" }],
	}), /refusing unverified/);
});

test("native ownership inspection returns only the marker, without other environment or argv", {
	skip: !["darwin", "linux"].includes(process.platform), timeout: 10000,
}, async (t) => {
	const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
		env: { ...process.env, [GNUPLOT_OWNER_ENV]: owner, PI_TEST_PRIVATE_VALUE: "must-not-be-returned", PI_TEST_DECOY: `${GNUPLOT_OWNER_ENV}=not-the-owner` }, stdio: "ignore",
	});
	const exited = once(child, "exit");
	t.after(async () => { if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM"); await exited; });
	await once(child, "spawn");
	const rows = await readGnuplotOwners([child.pid]);
	assert.deepEqual(rows, [{ pid: child.pid, owner }]);
	assert.doesNotMatch(JSON.stringify(rows), /must-not-be-returned|not-the-owner|setInterval/);
});

test("Qt socket field parsing preserves paths and rejects malformed ownership data", () => {
	assert.deepEqual(parseUnixSocketNames("p101\0\nf3\0n/tmp/with space/qtgnuplot101\0\np102\0n/tmp/qtgnuplot102 type=STREAM (LISTEN)\0\n"), [
		{ pid: 101, path: "/tmp/with space/qtgnuplot101" }, { pid: 102, path: "/tmp/qtgnuplot102" },
	]);
	for (const text of ["unexpected text", "pbad\0n/tmp/qtgnuplot101\0", "n/tmp/qtgnuplot101\0"]) assert.throws(() => parseUnixSocketNames(text), /ownership/);
});

test("Qt socket capture requires a matching live-process descriptor, socket type, and UID", async () => {
	const info = { uid: 501, dev: 1, ino: 2, ctimeMs: 3, isSocket: () => true };
	const execute = async () => ({ stdout: "p101\0n/tmp/qtgnuplot101\0n/tmp/qtgnuplot102\0n/tmp/other\0" });
	const sockets = await snapshotGnuplotSockets({ pid: 101, uid: 501 }, { execute, stat: async () => info });
	assert.deepEqual(sockets, [{ path: "/tmp/qtgnuplot101", uid: 501, dev: 1, ino: 2, ctimeMs: 3 }]);
	for (const change of [{ uid: 502 }, { isSocket: () => false }]) {
		assert.deepEqual(await snapshotGnuplotSockets({ pid: 101, uid: 501 }, { execute, stat: async () => ({ ...info, ...change }) }), []);
	}
});

test("Qt socket cleanup only unlinks unchanged, unreferenced socket inodes", async () => {
	const socket = { path: "/tmp/qtgnuplot101", uid: 501, dev: 1, ino: 2, ctimeMs: 3 };
	for (const mode of ["unchanged", "foreign reference", "inode", "device", "uid", "ctime", "non-socket", "missing", "inspection failure"]) {
		const removed = [];
		const options = {
			uid: 501,
			execute: async () => {
				if (mode === "inspection failure") throw Error("no lsof");
				return { stdout: mode === "foreign reference" ? "p999\0n/tmp/qtgnuplot101\0" : "" };
			},
			stat: async () => {
				if (mode === "missing") throw Object.assign(Error("gone"), { code: "ENOENT" });
				return { ...socket, isSocket: () => mode !== "non-socket", ...({ inode: { ino: 4 }, device: { dev: 4 }, uid: { uid: 502 }, ctime: { ctimeMs: 4 } }[mode] ?? {}) };
			},
			remove: async (path) => removed.push(path),
		};
		if (mode === "inspection failure") await assert.rejects(cleanupGnuplotSockets([socket], options), /no lsof/);
		else {
			const warnings = await cleanupGnuplotSockets([socket], options);
			assert.equal(warnings.length, ["unchanged", "missing"].includes(mode) ? 0 : 1, mode);
		}
		assert.deepEqual(removed, mode === "unchanged" ? [socket.path] : [], mode);
	}
});

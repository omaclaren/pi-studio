import { watchFile, unwatchFile } from "node:fs";
import { resolve } from "node:path";
import {
	createStudioDiskRevision,
	normalizeStudioDiskRevision,
	readStudioDiskFileSnapshot,
} from "./studio-disk-revisions.js";

export const STUDIO_FILE_WATCH_INTERVAL_MS = 300;
export const STUDIO_FILE_WATCH_DEBOUNCE_MS = 150;

function errorMessage(error) {
	return error instanceof Error ? error.message : String(error);
}

function normalizeComparablePath(filePath) {
	const normalized = resolve(filePath);
	return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function pathsMatch(left, right) {
	return normalizeComparablePath(left) === normalizeComparablePath(right);
}

export function createStudioFileWatcher(options) {
	const filePath = typeof options?.filePath === "string" ? options.filePath.trim() : "";
	if (!filePath) throw new Error("Missing watched file path.");
	const canonicalPath = resolve(filePath);
	const requestedIntervalMs = Number(options?.intervalMs);
	const requestedDebounceMs = Number(options?.debounceMs);
	const intervalMs = Math.max(20, Math.floor(Number.isFinite(requestedIntervalMs) ? requestedIntervalMs : STUDIO_FILE_WATCH_INTERVAL_MS));
	const debounceMs = Math.max(0, Math.floor(Number.isFinite(requestedDebounceMs) ? requestedDebounceMs : STUDIO_FILE_WATCH_DEBOUNCE_MS));
	const readSnapshot = typeof options?.readSnapshot === "function" ? options.readSnapshot : readStudioDiskFileSnapshot;
	const onUpdate = typeof options?.onUpdate === "function" ? options.onUpdate : () => undefined;
	const onError = typeof options?.onError === "function" ? options.onError : () => undefined;
	const onRecovered = typeof options?.onRecovered === "function" ? options.onRecovered : () => undefined;
	let lastRevision = normalizeStudioDiskRevision(options?.initialRevision);
	let lastError = null;
	let generation = 0;
	let debounceTimer = null;
	let errorRetryTimer = null;
	let startupReconcileTimer = null;
	let refreshInFlight = null;
	let refreshQueued = false;
	let closed = false;

	const readStableSnapshot = async () => {
		const snapshot = await readSnapshot(canonicalPath);
		if (!snapshot || typeof snapshot !== "object" || !pathsMatch(snapshot.path, canonicalPath)) {
			throw new Error("The watched file location now resolves somewhere else.");
		}
		const revision = normalizeStudioDiskRevision(snapshot.revision)
			|| createStudioDiskRevision(snapshot.buffer ?? snapshot.text ?? "");
		const text = typeof snapshot.text === "string"
			? snapshot.text
			: Buffer.from(snapshot.buffer ?? "").toString("utf8");
		return { ...snapshot, path: canonicalPath, text, revision };
	};

	const scheduleErrorRetry = () => {
		if (closed || errorRetryTimer) return;
		errorRetryTimer = setTimeout(() => {
			errorRetryTimer = null;
			void refresh().catch(() => {
				// onError owns watcher failures; never create an unhandled rejection.
			});
		}, intervalMs);
	};

	const performRefresh = async () => {
		try {
			const snapshot = await readStableSnapshot();
			if (closed) return false;
			if (errorRetryTimer) {
				clearTimeout(errorRetryTimer);
				errorRetryTimer = null;
			}
			const recovered = lastError !== null;
			const changed = snapshot.revision !== lastRevision;
			if (changed) {
				const nextGeneration = generation + 1;
				await onUpdate(snapshot, { generation: nextGeneration, recovered });
				if (closed) return false;
				generation = nextGeneration;
				lastRevision = snapshot.revision;
				// Reconcile after publication in case a save landed while an earlier
				// read or client update was in flight and filesystem events coalesced.
				refreshQueued = true;
			}
			if (recovered) {
				lastError = null;
				await onRecovered(snapshot, { generation, changed });
			}
			return changed;
		} catch (error) {
			if (closed) return false;
			const message = errorMessage(error);
			if (message !== lastError) {
				lastError = message;
				await onError(error, { generation: generation + 1, lastRevision });
			}
			scheduleErrorRetry();
			return false;
		}
	};

	const refresh = () => {
		if (closed) return Promise.resolve(false);
		refreshQueued = true;
		if (refreshInFlight) return refreshInFlight;
		let changed = false;
		const loop = (async () => {
			while (!closed && refreshQueued) {
				refreshQueued = false;
				changed = await performRefresh() || changed;
			}
			return changed;
		})();
		const tracked = loop.finally(() => {
			if (refreshInFlight === tracked) refreshInFlight = null;
		});
		refreshInFlight = tracked;
		return tracked;
	};

	const schedule = () => {
		if (closed) return;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			debounceTimer = null;
			void refresh().catch(() => {
				// onError owns watcher failures; never create an unhandled rejection.
			});
		}, debounceMs);
	};

	const listener = () => schedule();
	watchFile(canonicalPath, { interval: intervalMs }, listener);
	// StatWatcher establishes its first comparison baseline asynchronously. Reconcile
	// once after that window so an atomic replacement immediately after subscribe
	// cannot become the unseen baseline and wait forever for another filesystem event.
	startupReconcileTimer = setTimeout(() => {
		startupReconcileTimer = null;
		void refresh().catch(() => {
			// onError owns watcher failures; never create an unhandled rejection.
		});
	}, intervalMs);

	return Object.freeze({
		filePath: canonicalPath,
		refresh,
		async close() {
			if (closed) return;
			closed = true;
			refreshQueued = false;
			if (debounceTimer) {
				clearTimeout(debounceTimer);
				debounceTimer = null;
			}
			if (errorRetryTimer) {
				clearTimeout(errorRetryTimer);
				errorRetryTimer = null;
			}
			if (startupReconcileTimer) {
				clearTimeout(startupReconcileTimer);
				startupReconcileTimer = null;
			}
			unwatchFile(canonicalPath, listener);
			if (refreshInFlight) await refreshInFlight.catch(() => undefined);
		},
		get revision() {
			return lastRevision;
		},
		get error() {
			return lastError;
		},
		get generation() {
			return generation;
		},
	});
}

// In-flight fetch and sendBeacon requests can reach the server out of order.
// Keep last-arrival behavior between different pages, but never let an older
// write from the same Studio tab overwrite one of its newer persisted snapshots.
export function createStudioMetadataWriteOrderTracker() {
	const versions = new Map();

	function prepare(kind, documentKey, ownership) {
		if (!ownership) return Object.freeze({ commit() {} });
		const writerId = String(ownership.writerId || "");
		const writeVersion = Number(ownership.writeVersion);
		if (!writerId || !Number.isSafeInteger(writeVersion) || writeVersion <= 0) return null;
		const key = JSON.stringify([String(kind || ""), String(documentKey || ""), writerId]);
		const previous = versions.get(key);
		if (previous !== undefined && writeVersion < previous) return null;
		let committed = false;
		return Object.freeze({
			commit() {
				if (committed) return;
				committed = true;
				const current = versions.get(key);
				if (current === undefined || writeVersion >= current) versions.set(key, writeVersion);
			},
		});
	}

	return Object.freeze({
		prepare,
		claim(kind, documentKey, ownership) {
			const prepared = prepare(kind, documentKey, ownership);
			if (!prepared) return false;
			prepared.commit();
			return true;
		},
	});
}

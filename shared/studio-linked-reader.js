// Bounded, page-local reading history. These snapshots are never editable
// buffers, filesystem grants, save receipts or recovered workspace authority.
export function createStudioLinkedReader(options = {}) {
	const limit = (value, fallback, maximum) => Number.isSafeInteger(value) && value > 0
		? Math.min(value, maximum) : fallback;
	const maxEntries = limit(options.maxEntries, 24, 100);
	const maxCharacters = limit(options.maxCharacters, 2700000, 2700000);
	const maxEntryCharacters = limit(options.maxEntryCharacters, 900000, 900000);
	const now = typeof options.now === "function" ? options.now : Date.now;
	let entries = [], index = -1, origin = null, pending = null, sequence = 0, nextId = 0;
	const current = () => index >= 0 ? entries[index] : null;
	const position = value => Object.freeze({
		top: Number.isFinite(value?.top) ? Math.max(0, Math.min(100000000, value.top)) : 0,
		left: Number.isFinite(value?.left) ? Math.max(0, Math.min(100000000, value.left)) : 0,
	});
	const validString = (value, maximum) => typeof value === "string" && value.length <= maximum && !/[\u0000-\u001f\u007f]/.test(value);
	const originCopy = value => value && ["editor", "response", "files", "view"].includes(value.kind)
		? Object.freeze({ ...value }) : null;
	const invalidate = () => { pending = null; sequence++; };
	const owns = ticket => Boolean(ticket && ticket === pending && ticket.sequence === sequence);
	const failure = message => ({ ok: false, message });

	function begin(nextOrigin, settings = {}) {
		const refresh = settings.refresh === true;
		if (refresh && !current()) return null;
		// A visit while reading always belongs to that reading session's root,
		// irrespective of changes to the editor or hidden response beneath it.
		const root = current() || refresh ? origin : originCopy(nextOrigin) || origin;
		if (!root) return null;
		invalidate();
		pending = Object.freeze({ sequence, refresh, origin: root, targetId: current()?.id ?? null,
			newRoot: !current() && root !== origin });
		return pending;
	}

	function commit(ticket, value) {
		if (!owns(ticket)) return failure("This reading request is no longer current.");
		pending = null;
		if (!value || !validString(value.path, 4096) || !value.path
			|| !/^(?:\/|[A-Za-z]:[\\/]|\\\\)/.test(value.path)
			|| typeof value.text !== "string") return failure("The file snapshot could not be prepared.");
		if (value.text.length > maxEntryCharacters) return failure("This file exceeds the reader's text limit.");
		const selected = current();
		if (ticket.refresh && (!selected || selected.id !== ticket.targetId || selected.path !== value.path)) {
			return failure("The file identity changed while refreshing. Kept the current snapshot.");
		}
		const trail = ticket.newRoot ? [] : ticket.refresh ? entries.slice() : entries.slice(0, index + 1);
		const nextCount = trail.length + (ticket.refresh ? 0 : 1);
		const characters = trail.reduce((total, item) => total + item.text.length, 0)
			- (ticket.refresh ? selected.text.length : 0) + value.text.length;
		if (nextCount > maxEntries || characters > maxCharacters) {
			return failure("Reader history is full. Kept the current snapshots; close the reader to start a new history.");
		}
		const name = value.path.replace(/\\/g, "/").split("/").pop() || "file";
		const item = Object.freeze({
			id: ticket.refresh ? selected.id : ++nextId,
			revision: ticket.refresh ? selected.revision + 1 : 1,
			path: value.path,
			label: validString(value.label, 512) && value.label ? value.label : name,
			text: value.text,
			resourceDir: validString(value.resourceDir, 4096) ? value.resourceDir : "",
			extension: validString(value.extension, 32) ? value.extension : "",
			fragment: ticket.refresh ? selected.fragment : validString(value.fragment, 1024) ? value.fragment : "",
			position: ticket.refresh ? selected.position : position(null),
			readAt: now(),
		});
		if (ticket.refresh) trail[index] = item;
		else { trail.push(item); index = trail.length - 1; }
		entries = trail;
		origin = ticket.origin;
		return { ok: true, current: item };
	}

	function cancel(ticket) {
		if (!owns(ticket)) return false;
		invalidate(); return true;
	}
	function rememberPosition(value) {
		const selected = current();
		if (!selected) return false;
		entries[index] = Object.freeze({ ...selected, position: position(value) });
		return true;
	}
	function back() {
		if (!current()) return failure("There is no earlier reading location.");
		invalidate(); index--;
		return { ok: true, left: index < 0, origin, current: current() };
	}
	function forward() {
		if (index + 1 >= entries.length) return failure("There is no later reading location.");
		invalidate(); index++;
		return { ok: true, left: false, current: current() };
	}
	function close() {
		const root = origin;
		invalidate(); entries = []; index = -1; origin = null;
		return root;
	}
	function snapshot() {
		return Object.freeze({ active: index >= 0, origin, index, current: current(),
			entries: Object.freeze(entries.slice()), pending,
			back: index > 0 ? entries[index - 1] : null,
			forward: entries[index + 1] || null });
	}
	function isCurrent(item) {
		const selected = current();
		return Boolean(selected && item && selected.id === item.id && selected.revision === item.revision);
	}
	return Object.freeze({ begin, commit, cancel, rememberPosition, back, forward, close, snapshot, isCurrent });
}

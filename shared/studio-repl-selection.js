// Studio's selected REPL session (Sol, Astra).
//
// The selection is a session, by its full tmux lifetime; none for a runtime; or no
// preference yet, from Studio's start until something is selected.
//
// Explicit actions (a choice on the page, a send, an interrupt, the agent's send and a
// Start request) are counted, and each takes the count as its ticket when admitted. An
// action that finishes later selects only if its ticket is still current, so it can't
// undo anything chosen since it began.
//
// `shown` changes whenever the selection changes, by any route. A page reports a
// selection it made itself only against the `shown` it last adopted.

/** @typedef {{ sessionName: string, tmuxSessionId: string, tmuxSessionCreatedAt: number, runtime: string }} ReplSessionLifetime */

/**
 * @param {ReplSessionLifetime | null | undefined} left
 * @param {ReplSessionLifetime | null | undefined} right
 */
export function sameReplSessionLifetime(left, right) {
	return Boolean(left && right)
		&& left.sessionName === right.sessionName
		&& left.tmuxSessionId === right.tmuxSessionId
		&& left.tmuxSessionCreatedAt === right.tmuxSessionCreatedAt;
}

/** @template {ReplSessionLifetime} S @param {{ session?: S | null, runtime?: string | null } | null | undefined} target @returns {{ session?: S, runtime?: string | null }} */
const toSelection = (target) => (target?.session ? { session: target.session } : { runtime: target?.runtime || null });

/** @param {{ session?: ReplSessionLifetime, runtime?: string | null }} left @param {{ session?: ReplSessionLifetime, runtime?: string | null }} right */
const sameSelection = (left, right) => (left.session || right.session
	? sameReplSessionLifetime(left.session, right.session)
	: left.runtime === right.runtime);

/** @template {ReplSessionLifetime} S */
export function createReplSelection() {
	/** @type {{ session?: S, runtime?: string | null }} */
	let selected = { runtime: null };
	let shown = 0;
	let actions = 0;
	/** @type {{ session?: S, runtime?: string | null, start?: boolean } | null} */
	let latest = null;

	/** @param {{ session?: S | null, runtime?: string | null }} target */
	const show = (target) => {
		const next = toSelection(target);
		if (!sameSelection(selected, next)) shown += 1;
		selected = next;
	};

	return {
		/** @returns {S | null} */
		get session() { return selected.session ?? null; },
		// The selected session's runtime, or the runtime selected with no session.
		/** @returns {string | null} */
		get runtime() { return selected.session ? selected.session.runtime : (selected.runtime ?? null); },
		get shown() { return shown; },
		get hasPreference() { return Boolean(selected.session || selected.runtime); },
		// An explicit action that selects: { session } or { runtime } for none.
		/** @param {{ session?: S | null, runtime?: string | null }} target */
		choose(target) {
			actions += 1;
			latest = toSelection(target);
			show(target);
			return actions;
		},
		// A Start request counts but selects nothing yet.
		startRequested() {
			actions += 1;
			latest = { start: true };
			return actions;
		},
		/** @param {number} ticket */
		isCurrent(ticket) { return ticket === actions; },
		// Whether the latest explicit action chose this session, e.g. one still starting.
		/** @param {S} session */
		latestChose(session) { return Boolean(latest?.session) && sameReplSessionLifetime(latest.session, session); },
		// Selects without counting: a completion that passed its fence, or a fallback.
		show,
		// A page's own selection, applied only if the page saw the latest `shown`.
		/** @param {number} basis @param {{ session?: S | null, runtime?: string | null }} target */
		reconcile(basis, target) {
			if (basis !== shown) return false;
			show(target);
			return true;
		},
		// When the selected session has gone, another of its runtime, else none for it.
		/** @param {S[]} sessions */
		resolve(sessions) {
			const current = selected.session;
			if (!current || sessions.some((session) => sameReplSessionLifetime(session, current))) return;
			const next = sessions.find((session) => session.runtime === current.runtime) ?? null;
			show(next ? { session: next } : { runtime: current.runtime });
		},
	};
}

import test from "node:test";
import assert from "node:assert/strict";

import { createReplSelection, sameReplSessionLifetime } from "../shared/studio-repl-selection.js";

// Candidate 74, round 5: Studio's selected REPL session (Sol, Astra).
const session = (sessionName, tmuxSessionId, runtime = "python", tmuxSessionCreatedAt = 1700000000) => ({ sessionName, tmuxSessionId, tmuxSessionCreatedAt, runtime });
const b = session("pi-studio-repl-python", "$1");
const c = session("pi-studio-repl-python-0a1b2c3d", "$2");
const j = session("pi-repl-julia", "$3", "julia");

test("a session is the same only for the same name, tmux ID and creation time", () => {
	assert.equal(sameReplSessionLifetime(b, { ...b }), true);
	// Recreated within the same second: same name and time, a new tmux ID.
	assert.equal(sameReplSessionLifetime(b, { ...b, tmuxSessionId: "$9" }), false);
	assert.equal(sameReplSessionLifetime(b, { ...b, tmuxSessionCreatedAt: b.tmuxSessionCreatedAt + 1 }), false);
	assert.equal(sameReplSessionLifetime(b, null), false);
});

test("Studio starts with no preference, and `shown` moves only when the selection changes", () => {
	const selection = createReplSelection();
	assert.deepEqual([selection.session, selection.runtime, selection.hasPreference, selection.shown], [null, null, false, 0]);
	selection.choose({ session: b });
	assert.deepEqual([selection.session, selection.runtime, selection.shown], [b, "python", 1]);
	// Choosing it again counts as an action but shows nothing new.
	const again = selection.choose({ session: { ...b } });
	assert.equal(selection.shown, 1);
	assert.equal(selection.isCurrent(again), true);
	// None for a runtime is a selection too.
	selection.choose({ runtime: "julia" });
	assert.deepEqual([selection.session, selection.runtime, selection.hasPreference, selection.shown], [null, "julia", true, 2]);
	// A replacement with the same name is a change.
	selection.show({ session: b });
	selection.show({ session: { ...b, tmuxSessionId: "$9" } });
	assert.equal(selection.shown, 4);
});

test("a ticket stays current only until the next explicit action", () => {
	const selection = createReplSelection();
	const send = selection.choose({ session: b });
	assert.equal(selection.isCurrent(send), true);
	// Showing without counting, as a completion or fallback does, keeps the ticket.
	selection.show({ session: c });
	assert.equal(selection.isCurrent(send), true);
	// Overlapping Starts: only the newer is current.
	const older = selection.startRequested();
	const newer = selection.startRequested();
	assert.equal(selection.isCurrent(older), false);
	assert.equal(selection.isCurrent(newer), true);
	// A Start request selects nothing.
	assert.equal(selection.session, c);
	assert.equal(selection.isCurrent(send), false);
});

test("Start's exception holds only if the latest action chose that exact session", () => {
	const selection = createReplSelection();
	selection.startRequested();
	assert.equal(selection.latestChose(c), false);
	selection.choose({ session: c });
	assert.equal(selection.latestChose(c), true);
	assert.equal(selection.latestChose({ ...c, tmuxSessionId: "$8" }), false);
	// A later choice of none ends it, even if a fallback shows the session again.
	selection.choose({ runtime: "julia" });
	selection.show({ session: c });
	assert.equal(selection.latestChose(c), false);
});

test("a page's own pick applies only against the latest `shown`, and doesn't count", () => {
	const selection = createReplSelection();
	const basis = selection.shown;
	const start = selection.startRequested();
	assert.equal(selection.reconcile(basis, { session: b }), true);
	assert.equal(selection.session, b);
	assert.equal(selection.isCurrent(start), true, "the Start still selects");
	assert.equal(selection.reconcile(basis, { session: c }), false, "the page hadn't seen B");
	assert.equal(selection.session, b);
	assert.equal(selection.reconcile(selection.shown, { runtime: "julia" }), true);
	assert.deepEqual([selection.session, selection.runtime], [null, "julia"]);
});

test("when the selected session goes, another of its runtime is selected, else none for it", () => {
	const selection = createReplSelection();
	selection.choose({ session: b });
	const ticket = selection.choose({ session: b });
	selection.resolve([j, c]);
	assert.equal(selection.session, c, "Python, not Julia");
	assert.equal(selection.isCurrent(ticket), true, "a fallback isn't an action");
	selection.resolve([j]);
	assert.deepEqual([selection.session, selection.runtime], [null, "python"]);
	// A same-name replacement means the selected lifetime has gone.
	selection.show({ session: b });
	const shown = selection.shown;
	const replaced = { ...b, tmuxSessionId: "$9" };
	selection.resolve([replaced]);
	assert.equal(selection.session, replaced);
	assert.equal(selection.shown, shown + 1);
	// None for a runtime and no preference are left as they are.
	selection.choose({ runtime: "ghci" });
	selection.resolve([b, j]);
	assert.deepEqual([selection.session, selection.runtime], [null, "ghci"]);
});

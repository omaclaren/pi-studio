import test from "node:test";
import assert from "node:assert/strict";

import { buildStudioReplTmuxStartArgs } from "../shared/studio-repl-tmux.js";

test("Studio REPL sessions do not inherit terminal-local PROMPT_COMMAND hooks", () => {
	assert.deepEqual(
		buildStudioReplTmuxStartArgs("pi-studio-repl-shell", "/tmp/project with spaces", "/bin/bash"),
		[
			"new-session",
			"-d",
			"-P",
			"-F",
			"#{session_id}\t#{pane_id}",
			"-s",
			"pi-studio-repl-shell",
			"-c",
			"/tmp/project with spaces",
			"-e",
			"PROMPT_COMMAND=",
			"/bin/bash",
		],
	);
});

// Candidate90: gnuplot gets pi-repl's owner marker, so Stop can find its Qt helpers.
test("more environment settings for the runtime go before its command", () => {
	assert.deepEqual(
		buildStudioReplTmuxStartArgs("pi-studio-repl-gnuplot", "/tmp/p", "gnuplot", ["PI_REPL_GNUPLOT_OWNER=0123456789abcdef0123456789abcdef"]).slice(-5),
		["-e", "PROMPT_COMMAND=", "-e", "PI_REPL_GNUPLOT_OWNER=0123456789abcdef0123456789abcdef", "gnuplot"],
	);
});

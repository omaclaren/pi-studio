import test from "node:test";
import assert from "node:assert/strict";

import { buildStudioReplTmuxStartArgs } from "../shared/studio-repl-tmux.js";

test("Studio REPL sessions do not inherit terminal-local PROMPT_COMMAND hooks", () => {
	assert.deepEqual(
		buildStudioReplTmuxStartArgs("pi-studio-repl-shell", "/tmp/project with spaces", "/bin/bash"),
		[
			"new-session",
			"-d",
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

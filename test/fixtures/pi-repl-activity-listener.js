// A test-only stand-in for pi-repl's side of `pi-repl:record-activity:v1` (its
// takeStudioRecordActivity): it answers Studio's probe at once, answers a report request with a
// fixed text, and logs what Studio tells it to STUDIO_TEST_PI_REPL_LOG. It does so only while the
// file STUDIO_TEST_PI_REPL_LISTEN names exists, so other tests run as if pi-repl weren't loaded.
// The file holds the protocol it answers with: empty for 2 (pi-repl 0.12.1, which reports into
// Studio's results), "1" for pi-repl 0.12.0 (candidate 118).
import { appendFileSync, existsSync, readFileSync } from "node:fs";

export const PI_REPL_STAND_IN_REPORT = "pi-repl stand-in's report";

export default function piReplActivityListener(pi) {
	pi.events.on("pi-repl:record-activity:v1", (data) => {
		const toggle = process.env.STUDIO_TEST_PI_REPL_LISTEN;
		if (!toggle || !existsSync(toggle) || !data || typeof data !== "object") return;
		const protocol = Number(readFileSync(toggle, "utf8").trim() || 2);
		const { reply, ...message } = data;
		if (process.env.STUDIO_TEST_PI_REPL_LOG) appendFileSync(process.env.STUDIO_TEST_PI_REPL_LOG, `${JSON.stringify(message)}\n`);
		if (message.kind === "probe" && typeof reply === "function") reply({ protocol });
		// As pi-repl does, after it has read the records.
		if (message.kind === "report" && protocol >= 2 && typeof reply === "function") setTimeout(() => reply(PI_REPL_STAND_IN_REPORT), 10);
	});
}

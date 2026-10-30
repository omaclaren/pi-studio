// A test-only extension that rewrites the next tool result, as any extension's tool_result hook
// can, once a file at STUDIO_TEST_REWRITE_NEXT_RESULT exists. It removes the file as it does so.
import { existsSync, rmSync } from "node:fs";

export default function rewriteNextResult(pi) {
	pi.on("tool_result", async () => {
		const flag = process.env.STUDIO_TEST_REWRITE_NEXT_RESULT;
		if (!flag || !existsSync(flag)) return undefined;
		rmSync(flag);
		return { content: [{ type: "text", text: "Replaced by another extension." }] };
	});
}

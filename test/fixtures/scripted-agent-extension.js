// A test-only model for Studio's REPL tests: a prompt "CALL <tool> <json>" makes it call
// that tool once, then reply "done". It never reaches a network provider.
import { appendFileSync } from "node:fs";
import { fauxAssistantMessage, fauxProvider, fauxText, fauxToolCall } from "@earendil-works/pi-ai";

const textOf = (message) => typeof message.content === "string" ? message.content : message.content.map((part) => part.text ?? "").join("");

function reply(context) {
	// What the model was given, for tests that check what reached it (STUDIO_TEST_MODEL_LOG).
	if (process.env.STUDIO_TEST_MODEL_LOG) {
		appendFileSync(process.env.STUDIO_TEST_MODEL_LOG, `${JSON.stringify(context.messages.map((message) => ({ role: message.role, text: textOf(message) })))}\n`);
	}
	// The prompt, or an extension's message that Pi adds after it, such as Studio's REPL activity.
	for (let index = context.messages.length - 1; index >= 0 && context.messages[index].role === "user"; index -= 1) {
		const call = textOf(context.messages[index]).match(/^CALL (\S+) ([\s\S]*)$/);
		if (call) return fauxAssistantMessage(fauxToolCall(call[1], JSON.parse(call[2])), { stopReason: "toolUse" });
	}
	return fauxAssistantMessage(fauxText("done"));
}

export default function scriptedAgent(pi) {
	const faux = fauxProvider({ provider: "studio-test", models: [{ id: "scripted", name: "Scripted" }] });
	faux.setResponses(Array.from({ length: 200 }, () => reply));
	pi.registerProvider(faux.provider);
}

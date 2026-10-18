// A test-only model for Studio's REPL tests: a prompt "CALL <tool> <json>" makes it call
// that tool once, then reply "done". It never reaches a network provider.
import { fauxAssistantMessage, fauxProvider, fauxText, fauxToolCall } from "@earendil-works/pi-ai";

function reply(context) {
	const last = context.messages.at(-1);
	if (last?.role === "user") {
		const text = typeof last.content === "string" ? last.content : last.content.map((part) => part.text ?? "").join("");
		const call = text.match(/^CALL (\S+) ([\s\S]*)$/);
		if (call) return fauxAssistantMessage(fauxToolCall(call[1], JSON.parse(call[2])), { stopReason: "toolUse" });
	}
	return fauxAssistantMessage(fauxText("done"));
}

export default function scriptedAgent(pi) {
	const faux = fauxProvider({ provider: "studio-test", models: [{ id: "scripted", name: "Scripted" }] });
	faux.setResponses(Array.from({ length: 200 }, () => reply));
	pi.registerProvider(faux.provider);
}

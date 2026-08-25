import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	createAgentSessionFromServices,
	createAgentSessionRuntime,
	createAgentSessionServices,
	SessionManager,
} from "@earendil-works/pi-coding-agent";

test("an isolated side runtime loads only a selected extension and runs its shutdown lifecycle", async () => {
	const root = mkdtempSync(join(tmpdir(), "pi-studio-side-tools-runtime-"));
	const agentDir = join(root, "agent");
	const extensionPath = join(root, "fixture-extension.mjs");
	const lifecyclePath = join(root, "lifecycle.log");
	mkdirSync(agentDir, { recursive: true });
	writeFileSync(extensionPath, `
import { appendFileSync } from "node:fs";
export default function (pi) {
  appendFileSync(${JSON.stringify(lifecyclePath)}, "factory\\n");
  let started = false;
  pi.on("session_start", () => { started = true; appendFileSync(${JSON.stringify(lifecyclePath)}, "start\\n"); });
  pi.on("session_shutdown", () => appendFileSync(${JSON.stringify(lifecyclePath)}, "shutdown\\n"));
  pi.registerTool({
    name: "fixture_hidden",
    label: "Hidden fixture",
    description: "This unselected tool must not enter the side runtime",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async execute() { return { content: [{ type: "text", text: "hidden" }], details: {} }; },
  });
  pi.registerTool({
    name: "fixture_lookup",
    label: "Fixture lookup",
    description: "Return a value after extension startup",
    parameters: { type: "object", properties: { value: { type: "string" } }, required: ["value"], additionalProperties: false },
    async execute(_id, params) {
      if (!started) throw new Error("tool ran before session_start");
      return { content: [{ type: "text", text: "fixture:" + params.value }], details: {} };
    },
  });
}
`);

	const createRuntime = async ({ cwd, agentDir: runtimeAgentDir, sessionManager, sessionStartEvent }) => {
		const services = await createAgentSessionServices({
			cwd,
			agentDir: runtimeAgentDir,
			resourceLoaderOptions: {
				additionalExtensionPaths: [extensionPath],
				noExtensions: true,
				noSkills: true,
				noPromptTemplates: true,
				noThemes: true,
				noContextFiles: true,
				systemPromptOverride: () => "Isolated fixture runtime",
			},
		});
		const created = await createAgentSessionFromServices({
			services,
			sessionManager,
			sessionStartEvent,
			tools: ["fixture_lookup"],
		});
		await created.session.bindExtensions({});
		return { ...created, services, diagnostics: services.diagnostics };
	};

	let runtime;
	try {
		runtime = await createAgentSessionRuntime(createRuntime, {
			cwd: root,
			agentDir,
			sessionManager: SessionManager.inMemory(root),
			sessionStartEvent: { type: "session_start", reason: "startup" },
		});
		assert.deepEqual(runtime.session.getActiveToolNames(), ["fixture_lookup"]);
		assert.deepEqual(runtime.session.getAllTools().map((tool) => tool.name), ["fixture_lookup"]);
		assert.equal(runtime.session.getToolDefinition("fixture_hidden"), undefined);
		assert.equal(runtime.session.getToolDefinition("mcp"), undefined);
		const definition = runtime.session.getToolDefinition("fixture_lookup");
		assert.ok(definition);
		const result = await definition.execute("fixture-call", { value: "ok" }, new AbortController().signal, undefined, undefined);
		assert.equal(result.content[0].text, "fixture:ok");
		await runtime.dispose();
		runtime = undefined;
		assert.equal(readFileSync(lifecyclePath, "utf8"), "factory\nstart\nshutdown\n");
	} finally {
		if (runtime) await runtime.dispose();
		rmSync(root, { recursive: true, force: true });
	}
});

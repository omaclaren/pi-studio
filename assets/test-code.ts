// A small TypeScript test file for pi-studio language highlighting
import { readFileSync } from "node:fs";

interface Config {
  name: string;
  port: number;
  debug: boolean;
}

const DEFAULT_PORT = 3000;

function loadConfig(path: string): Config {
  const raw = readFileSync(path, "utf-8");
  const parsed = JSON.parse(raw);

  // Validate required fields
  if (typeof parsed.name !== "string") {
    throw new Error("Config missing 'name'");
  }

  return {
    name: parsed.name,
    port: parsed.port ?? DEFAULT_PORT,
    debug: parsed.debug ?? false,
  };
}

async function main() {
  const config = loadConfig("./config.json");
  console.log(`Starting ${config.name} on port ${config.port}`);

  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return true;
}

export { loadConfig, main };

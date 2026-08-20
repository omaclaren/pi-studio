import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createStudioPandocHtmlResourceFlagResolver } from "../shared/studio-pandoc-resource-flag.js";

test("failed Pandoc capability probes fall back and are retried", async () => {
  let calls = 0;
  const resolveFlag = createStudioPandocHtmlResourceFlagResolver(async () => {
    calls += 1;
    if (calls === 1) throw new Error("pandoc capability probe timed out after 5s.");
    return "Usage: pandoc --embed-resources";
  });

  assert.equal(await resolveFlag("pandoc"), "--self-contained");
  assert.equal(calls, 1);
  assert.equal(await resolveFlag("pandoc"), "--embed-resources");
  assert.equal(calls, 2);
  assert.equal(await resolveFlag("pandoc"), "--embed-resources");
  assert.equal(calls, 2, "successful probes should remain cached");
});

test("concurrent Pandoc capability requests share one probe", async () => {
  let calls = 0;
  let releaseProbe;
  const probePending = new Promise((resolve) => { releaseProbe = resolve; });
  const resolveFlag = createStudioPandocHtmlResourceFlagResolver(async () => {
    calls += 1;
    await probePending;
    return "Usage: pandoc --embed-resources";
  });

  const first = resolveFlag("pandoc");
  const second = resolveFlag("pandoc");
  releaseProbe();
  assert.deepEqual(await Promise.all([first, second]), ["--embed-resources", "--embed-resources"]);
  assert.equal(calls, 1);
});

test("Pandoc versions without embed-resources use self-contained mode", async () => {
  const resolveFlag = createStudioPandocHtmlResourceFlagResolver(async () => "Usage: pandoc --self-contained");
  assert.equal(await resolveFlag("pandoc"), "--self-contained");
});

test("Studio rendering uses the retryable Pandoc resource-flag resolver", () => {
  const source = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
  assert.match(source, /createStudioPandocHtmlResourceFlagResolver\(async \(pandocCommand: string\) => \{/);
  assert.match(source, /args\.push\(await resolveStudioPandocHtmlResourceFlag\(pandocCommand\)\)/);
  assert.doesNotMatch(source, /studioPandocHtmlResourceFlagCache/);
});

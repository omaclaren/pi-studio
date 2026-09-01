import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readStudioDiskFileSnapshot } from "../shared/studio-disk-revisions.js";
import { createStudioFileWatcher } from "../shared/studio-file-watcher.js";

function waitFor(predicate, timeoutMs = 5_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      try {
        const value = predicate();
        if (value) return resolve(value);
      } catch (error) {
        return reject(error);
      }
      if (Date.now() - started >= timeoutMs) return reject(new Error("Timed out waiting for watched file event."));
      setTimeout(tick, 10);
    };
    tick();
  });
}

async function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "pi-studio-file-watch-"));
  try {
    await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("file watcher suppresses unchanged content and publishes genuine changes", async () => withTempDir(async (dir) => {
  const path = join(dir, "notes.md");
  writeFileSync(path, "one", "utf8");
  const initial = readStudioDiskFileSnapshot(path);
  const updates = [];
  const watcher = createStudioFileWatcher({
    filePath: initial.path,
    initialRevision: initial.revision,
    intervalMs: 25,
    debounceMs: 10,
    onUpdate: (snapshot, details) => updates.push({ text: snapshot.text, ...details }),
  });
  try {
    assert.equal(await watcher.refresh(), false);
    writeFileSync(path, "one", "utf8");
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(updates.length, 0);

    writeFileSync(path, "two", "utf8");
    await waitFor(() => updates.length === 1);
    assert.deepEqual(updates[0], { text: "two", generation: 1, recovered: false });
  } finally {
    await watcher.close();
  }
}));

test("file watcher follows atomic-save replacements", async () => withTempDir(async (dir) => {
  const path = join(dir, "notes.md");
  const replacement = join(dir, ".notes.tmp");
  writeFileSync(path, "one", "utf8");
  const initial = readStudioDiskFileSnapshot(path);
  const updates = [];
  const watcher = createStudioFileWatcher({
    filePath: initial.path,
    initialRevision: initial.revision,
    intervalMs: 25,
    debounceMs: 10,
    onUpdate: (snapshot) => updates.push(snapshot.text),
  });
  try {
    await watcher.refresh();
    writeFileSync(replacement, "atomic", "utf8");
    renameSync(replacement, path);
    await waitFor(() => updates.includes("atomic"));
  } finally {
    await watcher.close();
  }
}));

test("temporary deletion retains the last revision and reports recovery", async () => withTempDir(async (dir) => {
  const path = join(dir, "notes.md");
  writeFileSync(path, "one", "utf8");
  const initial = readStudioDiskFileSnapshot(path);
  const errors = [];
  const recoveries = [];
  const updates = [];
  const watcher = createStudioFileWatcher({
    filePath: initial.path,
    initialRevision: initial.revision,
    intervalMs: 25,
    debounceMs: 10,
    onUpdate: (snapshot) => updates.push(snapshot.text),
    onError: (error) => errors.push(error.message),
    onRecovered: (snapshot, details) => recoveries.push({ text: snapshot.text, ...details }),
  });
  try {
    await watcher.refresh();
    unlinkSync(path);
    await waitFor(() => errors.length === 1);
    assert.equal(watcher.revision, initial.revision);

    writeFileSync(path, "one", "utf8");
    await waitFor(() => recoveries.length === 1);
    assert.equal(updates.length, 0);
    assert.deepEqual(recoveries[0], { text: "one", generation: 0, changed: false });
  } finally {
    await watcher.close();
  }
}));

test("file watcher retries transient read errors without requiring another file event", async () => withTempDir(async (dir) => {
  const path = join(dir, "notes.md");
  writeFileSync(path, "one", "utf8");
  const initial = readStudioDiskFileSnapshot(path);
  const errors = [];
  const recoveries = [];
  let attempts = 0;
  const watcher = createStudioFileWatcher({
    filePath: initial.path,
    initialRevision: initial.revision,
    intervalMs: 20,
    debounceMs: 0,
    readSnapshot: () => {
      attempts += 1;
      if (attempts === 1) throw new Error("transient read failure");
      return readStudioDiskFileSnapshot(path);
    },
    onError: (error) => errors.push(error.message),
    onRecovered: (_snapshot, details) => recoveries.push(details),
  });
  try {
    assert.equal(await watcher.refresh(), false);
    await waitFor(() => recoveries.length === 1);
    assert.deepEqual(errors, ["transient read failure"]);
    assert.deepEqual(recoveries, [{ generation: 0, changed: false }]);
    assert.ok(attempts >= 2);
  } finally {
    await watcher.close();
  }
}));

test("file watcher refuses a replacement symlink and stops cleanly", async () => withTempDir(async (dir) => {
  const path = join(dir, "notes.md");
  const outside = join(dir, "outside.md");
  writeFileSync(path, "one", "utf8");
  writeFileSync(outside, "outside", "utf8");
  const initial = readStudioDiskFileSnapshot(path);
  const errors = [];
  const updates = [];
  const watcher = createStudioFileWatcher({
    filePath: initial.path,
    initialRevision: initial.revision,
    intervalMs: 25,
    debounceMs: 10,
    onUpdate: (snapshot) => updates.push(snapshot.text),
    onError: (error) => errors.push(error.message),
  });
  try {
    await watcher.refresh();
    unlinkSync(path);
    symlinkSync(outside, path);
    await waitFor(() => errors.length > 0);
    // unlink + symlink can be observed as one coalesced transition. The bounded
    // error retry must reconcile the final path identity without another event.
    await waitFor(() => errors.some((message) => message.includes("resolves somewhere else")));
    assert.deepEqual(updates, []);
  } finally {
    await watcher.close();
  }

  writeFileSync(outside, "changed after close", "utf8");
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.deepEqual(updates, []);
}));

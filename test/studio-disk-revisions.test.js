import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, linkSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createStudioDiskRevision,
  normalizeStudioDiskRevision,
  readStudioDiskFileSnapshot,
  saveStudioDiskFileAs,
  saveStudioDiskFileIfRevision,
  studioDiskRevisionsMatch,
} from "../shared/studio-disk-revisions.js";

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "pi-studio-disk-revision-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("disk revisions are stable SHA-256 content hashes", () => {
  const revision = createStudioDiskRevision("hello\n");
  assert.match(revision, /^sha256:[a-f0-9]{64}$/);
  assert.equal(createStudioDiskRevision(Buffer.from("hello\n")), revision);
  assert.equal(normalizeStudioDiskRevision(revision.toUpperCase()), revision);
  assert.equal(normalizeStudioDiskRevision("sha256:nope"), null);
  assert.equal(studioDiskRevisionsMatch(revision, revision), true);
  assert.equal(studioDiskRevisionsMatch(revision, createStudioDiskRevision("other")), false);
});

test("disk snapshots return the canonical target and content revision", () => withTempDir((dir) => {
  const target = join(dir, "target.md");
  const link = join(dir, "linked.md");
  writeFileSync(target, "original", "utf8");
  symlinkSync(target, link);

  const snapshot = readStudioDiskFileSnapshot(link);
  assert.equal(snapshot.path, realpathSync(target));
  assert.equal(snapshot.buffer.toString("utf8"), "original");
  assert.equal(snapshot.revision, createStudioDiskRevision("original"));
}));

test("safe save writes only when the expected disk revision still matches", () => withTempDir((dir) => {
  const path = join(dir, "notes.md");
  writeFileSync(path, "one", "utf8");
  const original = readStudioDiskFileSnapshot(path);

  const saved = saveStudioDiskFileIfRevision({
    path: original.path,
    content: "two",
    expectedRevision: original.revision,
  });
  assert.equal(saved.ok, true);
  assert.equal(readFileSync(path, "utf8"), "two");
  assert.equal(saved.revision, createStudioDiskRevision("two"));

  writeFileSync(path, "external", "utf8");
  const conflict = saveStudioDiskFileIfRevision({
    path: original.path,
    content: "three",
    expectedRevision: saved.revision,
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.conflict, true);
  assert.equal(conflict.reason, "disk-changed");
  assert.equal(conflict.currentRevision, createStudioDiskRevision("external"));
  assert.equal(readFileSync(path, "utf8"), "external");
}));

test("explicit overwrite still requires and revalidates the reported disk revision", () => withTempDir((dir) => {
  const path = join(dir, "notes.md");
  writeFileSync(path, "external one", "utf8");
  const first = readStudioDiskFileSnapshot(path);

  const missingRevision = saveStudioDiskFileIfRevision({ path: first.path, content: "editor", force: true });
  assert.equal(missingRevision.ok, false);
  assert.equal(missingRevision.reason, "revision-required");
  assert.equal(readFileSync(path, "utf8"), "external one");

  writeFileSync(path, "external two", "utf8");
  const changedWhileConfirming = saveStudioDiskFileIfRevision({
    path: first.path,
    content: "editor",
    expectedRevision: first.revision,
    force: true,
  });
  assert.equal(changedWhileConfirming.ok, false);
  assert.equal(changedWhileConfirming.reason, "disk-changed");
  assert.equal(changedWhileConfirming.currentRevision, createStudioDiskRevision("external two"));
  assert.equal(readFileSync(path, "utf8"), "external two");

  const overwritten = saveStudioDiskFileIfRevision({
    path: first.path,
    content: "editor",
    expectedRevision: changedWhileConfirming.currentRevision,
    force: true,
  });
  assert.equal(overwritten.ok, true);
  assert.equal(readFileSync(path, "utf8"), "editor");
}));

test("deleted files conflict before an explicit overwrite recreates them", () => withTempDir((dir) => {
  const path = join(dir, "notes.md");
  writeFileSync(path, "original", "utf8");
  const snapshot = readStudioDiskFileSnapshot(path);
  unlinkSync(path);

  const conflict = saveStudioDiskFileIfRevision({
    path: snapshot.path,
    content: "editor",
    expectedRevision: snapshot.revision,
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.reason, "file-missing");

  const recreated = saveStudioDiskFileIfRevision({ path: snapshot.path, content: "editor", force: true });
  assert.equal(recreated.ok, true);
  assert.equal(readFileSync(path, "utf8"), "editor");
}));

test("safe save refuses a file replaced by a symlink even when overwrite is explicit", () => withTempDir((dir) => {
  const path = join(dir, "notes.md");
  const outside = join(dir, "outside.md");
  writeFileSync(path, "original", "utf8");
  writeFileSync(outside, "outside", "utf8");
  const snapshot = readStudioDiskFileSnapshot(path);
  unlinkSync(path);
  symlinkSync(outside, path);

  const conflict = saveStudioDiskFileIfRevision({
    path: snapshot.path,
    content: "editor",
    expectedRevision: snapshot.revision,
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.reason, "location-changed");

  const forced = saveStudioDiskFileIfRevision({ path: snapshot.path, content: "editor", force: true });
  assert.equal(forced.ok, false);
  assert.equal(forced.reason, "location-changed");
  assert.equal(readFileSync(outside, "utf8"), "outside");
}));

test("Save As replacement requires and revalidates explicit target consent", () => withTempDir((dir) => {
  const path = join(dir, "copy.md");
  writeFileSync(path, "existing one", "utf8");

  const conflict = saveStudioDiskFileAs({ path, cwd: dir, content: "editor" });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.reason, "target-exists");
  assert.equal(readFileSync(path, "utf8"), "existing one");

  const unpinned = saveStudioDiskFileAs({ path, cwd: dir, content: "editor", overwrite: true });
  assert.equal(unpinned.ok, false);
  assert.equal(unpinned.reason, "target-exists");

  writeFileSync(path, "existing two", "utf8");
  const changedWhileConfirming = saveStudioDiskFileAs({
    path,
    cwd: dir,
    content: "editor",
    overwrite: true,
    expectedRevision: conflict.currentRevision,
  });
  assert.equal(changedWhileConfirming.ok, false);
  assert.equal(changedWhileConfirming.reason, "target-exists");
  assert.equal(changedWhileConfirming.currentRevision, createStudioDiskRevision("existing two"));
  assert.equal(readFileSync(path, "utf8"), "existing two");

  const overwritten = saveStudioDiskFileAs({
    path,
    cwd: dir,
    content: "editor",
    overwrite: true,
    expectedRevision: changedWhileConfirming.currentRevision,
  });
  assert.equal(overwritten.ok, true);
  assert.equal(readFileSync(path, "utf8"), "editor");
}));

test("safe save preserves exact mode and ownership metadata", () => withTempDir((dir) => {
  const path = join(dir, "metadata.md");
  writeFileSync(path, "old", "utf8");
  chmodSync(path, 0o666);
  const before = lstatSync(path);
  const snapshot = readStudioDiskFileSnapshot(path);

  const saved = saveStudioDiskFileIfRevision({
    path: snapshot.path,
    content: "new",
    expectedRevision: snapshot.revision,
  });
  assert.equal(saved.ok, true);
  const after = lstatSync(path);
  assert.equal(after.mode & 0o7777, before.mode & 0o7777);
  assert.equal(after.uid, before.uid);
  assert.equal(after.gid, before.gid);
}));

test("safe save supports valid long target basenames", () => withTempDir((dir) => {
  const path = join(dir, `${"a".repeat(220)}.md`);
  writeFileSync(path, "old", "utf8");
  const snapshot = readStudioDiskFileSnapshot(path);
  const saved = saveStudioDiskFileIfRevision({
    path: snapshot.path,
    content: "new",
    expectedRevision: snapshot.revision,
  });
  assert.equal(saved.ok, true);
  assert.equal(readFileSync(path, "utf8"), "new");
}));

test("safe save refuses to silently split hard-linked files", () => withTempDir((dir) => {
  const path = join(dir, "notes.md");
  const sibling = join(dir, "same-inode.md");
  writeFileSync(path, "old", "utf8");
  linkSync(path, sibling);
  const snapshot = readStudioDiskFileSnapshot(path);

  const conflict = saveStudioDiskFileIfRevision({
    path: snapshot.path,
    content: "new",
    expectedRevision: snapshot.revision,
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.reason, "hard-linked-file");
  assert.equal(readFileSync(path, "utf8"), "old");
  assert.equal(readFileSync(sibling, "utf8"), "old");
  assert.equal(lstatSync(path).ino, lstatSync(sibling).ino);
}));

test("Save As refuses to split hard-linked files", () => withTempDir((dir) => {
  const path = join(dir, "linked-target.md");
  const sibling = join(dir, "linked-alias.md");
  writeFileSync(path, "old", "utf8");
  linkSync(path, sibling);

  const conflict = saveStudioDiskFileAs({ path, cwd: dir, content: "new", overwrite: false });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.conflict, true);
  assert.equal(conflict.reason, "hard-linked-file");
  assert.equal(readFileSync(path, "utf8"), "old");
  assert.equal(readFileSync(sibling, "utf8"), "old");
  assert.equal(lstatSync(path).ino, lstatSync(sibling).ino);
}));

test("Save As canonicalizes parent directories and refuses symlink targets", () => withTempDir((dir) => {
  const realDir = join(dir, "real");
  const linkedDir = join(dir, "linked");
  mkdirSync(realDir);
  symlinkSync(realDir, linkedDir);

  const created = saveStudioDiskFileAs({ path: join(linkedDir, "new.md"), cwd: dir, content: "new" });
  assert.equal(created.ok, true);
  assert.equal(created.path, realpathSync(join(realDir, "new.md")));

  const outside = join(dir, "outside.md");
  const linkedFile = join(realDir, "alias.md");
  writeFileSync(outside, "outside", "utf8");
  symlinkSync(outside, linkedFile);
  const refused = saveStudioDiskFileAs({ path: linkedFile, cwd: dir, content: "editor", overwrite: true });
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, "unsafe-path");
  assert.equal(readFileSync(outside, "utf8"), "outside");
}));

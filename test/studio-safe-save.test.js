import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const indexSource = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const workspaceSource = readFileSync(new URL("../shared/studio-workspace-state.js", import.meta.url), "utf8");

test("file-backed Studio documents carry canonical content revisions", () => {
  assert.match(indexSource, /interface InitialStudioDocument \{[\s\S]*?diskRevision\?: string;/);
  assert.match(indexSource, /const snapshot = readStudioDiskFileSnapshot\(resolved\.resolved\)/);
  assert.match(indexSource, /resolvedPath: snapshot\.path,[\s\S]*?diskRevision: snapshot\.revision/);
  assert.match(indexSource, /data-initial-disk-revision="\$\{initialDiskRevision\}"/);
  assert.match(clientSource, /const initialDiskRevision = [\s\S]*?dataset\.initialDiskRevision/);
});

test("safe Save sends the canonical path and expected revision to the server", () => {
  assert.match(indexSource, /interface SaveOverRequestMessage \{[\s\S]*?path: string;[\s\S]*?expectedRevision\?: string;[\s\S]*?force\?: boolean;/);
  assert.match(indexSource, /msg\.type === "save_over_request"[\s\S]*?typeof msg\.path === "string"[\s\S]*?typeof msg\.expectedRevision === "string"/);
  assert.match(indexSource, /saveStudioDiskFileIfRevision\(\{[\s\S]*?path: msg\.path,[\s\S]*?expectedRevision: msg\.expectedRevision,[\s\S]*?force: msg\.force === true/);
  assert.match(clientSource, /type: "save_over_request",[\s\S]*?path: operation\.path,[\s\S]*?expectedRevision: operation\.expectedRevision \|\| undefined,[\s\S]*?force: operation\.force/);
});

test("disk conflicts preserve editor text and expose Reload, Overwrite, Save As, and Cancel", () => {
  assert.match(indexSource, /type: "save_conflict",[\s\S]*?currentRevision:[\s\S]*?canOverwrite:/);
  assert.match(clientSource, /if \(message\.type === "save_conflict"\)[\s\S]*?handleEditorSaveConflict\(message\)/);
  assert.match(clientSource, /title: "File changed on disk"[\s\S]*?cancelLabel: "Cancel"[\s\S]*?tertiaryLabel: "Reload"[\s\S]*?secondaryLabel: "Save As…"[\s\S]*?confirmLabel: "Overwrite"/);
  assert.match(clientSource, /decision === "reload"[\s\S]*?skipConfirm: true/);
  assert.match(clientSource, /decision === "save-as"[\s\S]*?content: operation\.content/);
  assert.match(clientSource, /decision === true && canOverwrite[\s\S]*?force: true/);
});

test("Save As is conflict-safe and revalidates explicit replacement consent", () => {
  assert.match(indexSource, /interface SaveAsRequestMessage \{[\s\S]*?overwrite\?: boolean;[\s\S]*?expectedRevision\?: string;/);
  assert.match(indexSource, /writeStudioFile\(msg\.path, studioCwd, msg\.content, msg\.overwrite === true, msg\.expectedRevision\)/);
  assert.match(indexSource, /type: "save_as_conflict"[\s\S]*?currentRevision:/);
  assert.match(clientSource, /title: unsafeReplacement \? "Cannot replace existing file"[\s\S]*?secondaryLabel: "Choose another…"[\s\S]*?confirmDisabled: !canCommitHere/);
  assert.match(clientSource, /sendEditorSaveAsRequest\(conflictPath, operation\.content, true, message\.currentRevision\)/);
});

test("Save shortcuts distinguish direct save from Save As", () => {
  assert.match(clientSource, /const isSaveAsShortcut =[\s\S]*?event\.shiftKey;[\s\S]*?triggerEditorSaveAsShortcut\(\)/);
  assert.match(clientSource, /const isSaveShortcut =[\s\S]*?!event\.shiftKey;[\s\S]*?triggerEditorSaveShortcut\(\)/);
  assert.match(indexSource, /<dt>Cmd\/Ctrl\+Shift\+S<\/dt><dd>Save editor as a new file<\/dd>/);
});

test("refresh refuses to follow a replaced canonical file path", () => {
  assert.match(indexSource, /function readStudioFile\(pathArg: string, cwd: string, options\?: \{ requireCanonicalPath\?: boolean \}\)/);
  assert.match(indexSource, /const refreshed = readStudioFile\(refreshPath, studioCwd, \{ requireCanonicalPath: true \}\)/);
  assert.match(indexSource, /the file location now resolves somewhere else/);
});

test("workspace recovery retains the revision dirty edits were based on", () => {
  assert.match(clientSource, /diskRevision: fileBackedDiskRevision/);
  assert.match(clientSource, /persistedDiskRevision = normalizeStudioDiskRevision\(state\.diskRevision\)/);
  assert.match(clientSource, /state\.text === currentBaselineText \? currentDiskRevision : null/);
  assert.match(workspaceSource, /const diskRevision = typeof value\.diskRevision === "string"/);
  assert.match(workspaceSource, /diskRevision,/);
});

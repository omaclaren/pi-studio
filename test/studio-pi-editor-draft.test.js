import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  consumeStudioPiEditorDraftSnapshot,
  createStudioPiEditorDraftSnapshot,
  normalizeStudioPiEditorDraftSnapshot,
  studioPiEditorDraftMatchesSnapshot,
} from "../shared/studio-pi-editor-draft.js";

const indexSource = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");

test("Pi editor draft snapshots are bounded fingerprints rather than text copies", () => {
  const snapshot = createStudioPiEditorDraftSnapshot("αβ\ncontext");
  assert.match(snapshot.fingerprint, /^sha256:[a-f0-9]{64}$/);
  assert.equal(snapshot.byteLength, Buffer.byteLength("αβ\ncontext", "utf8"));
  assert.deepEqual(normalizeStudioPiEditorDraftSnapshot(snapshot), snapshot);
  assert.equal(Object.hasOwn(snapshot, "content"), false);
  assert.equal(studioPiEditorDraftMatchesSnapshot("αβ\ncontext", snapshot), true);
  assert.equal(studioPiEditorDraftMatchesSnapshot("αβ\ncontext added later", snapshot), false);
  assert.equal(studioPiEditorDraftMatchesSnapshot("αβ\r\ncontext", snapshot), false);
});

test("automatic Pi draft consumption clears only an exact unchanged draft", () => {
  const original = "Neovim context\n\nPlease review this.";
  const snapshot = createStudioPiEditorDraftSnapshot(original);
  let editorText = original;
  let writes = 0;
  const ui = {
    getEditorText: () => editorText,
    setEditorText: (next) => {
      writes += 1;
      editorText = next;
    },
  };

  assert.deepEqual(consumeStudioPiEditorDraftSnapshot(ui, snapshot), { status: "cleared" });
  assert.equal(editorText, "");
  assert.equal(writes, 1);

  editorText = original + "\n\nNew terminal context";
  writes = 0;
  assert.deepEqual(consumeStudioPiEditorDraftSnapshot(ui, snapshot), { status: "changed" });
  assert.equal(editorText, original + "\n\nNew terminal context");
  assert.equal(writes, 0);
});

test("automatic Pi draft consumption is conservative for empty, invalid, and unavailable state", () => {
  const snapshot = createStudioPiEditorDraftSnapshot("draft");
  let writes = 0;

  assert.deepEqual(consumeStudioPiEditorDraftSnapshot({
    getEditorText: () => "",
    setEditorText: () => { writes += 1; },
  }, snapshot), { status: "already-empty" });
  assert.equal(writes, 0);

  assert.deepEqual(consumeStudioPiEditorDraftSnapshot({
    getEditorText: () => "draft",
    setEditorText: () => { writes += 1; },
  }, { fingerprint: "invalid", byteLength: 5 }), { status: "not-requested" });
  assert.equal(writes, 0);

  assert.deepEqual(consumeStudioPiEditorDraftSnapshot({
    getEditorText: () => { throw new Error("unavailable"); },
    setEditorText: () => { writes += 1; },
  }, snapshot), { status: "unavailable" });
  assert.equal(writes, 0);
});

test("Studio links imported or staged Pi drafts and consumes them only after accepted runs", () => {
  assert.match(indexSource, /piEditorDraftSnapshot\?: StudioPiEditorDraftSnapshot/);
  assert.match(indexSource, /piEditorDraftSnapshot: createStudioPiEditorDraftSnapshot\(content\)/);
  assert.match(indexSource, /piEditorDraftSnapshot: createStudioPiEditorDraftSnapshot\(msg\.content\)/);
  assert.match(clientSource, /setLinkedPiEditorDraftSnapshot\(snapshot, Boolean\(content\.length > 0 && snapshot\)\)/);
  assert.match(clientSource, /const piEditorDraftSnapshot = reserveLinkedPiEditorDraftSnapshot\(requestId\);[\s\S]*?type: "send_run_request"[\s\S]*?piEditorDraftSnapshot: piEditorDraftSnapshot \|\| undefined/);

  const directStart = indexSource.indexOf('if (msg.type === "send_run_request")');
  const directEnd = indexSource.indexOf('if (msg.type === "completion_suggestion_cancel_request")', directStart);
  assert.ok(directStart >= 0 && directEnd > directStart, "expected direct-run handler");
  const directHandler = indexSource.slice(directStart, directEnd);
  const sendIndex = directHandler.lastIndexOf("pi.sendUserMessage(msg.text);");
  const consumeIndex = directHandler.lastIndexOf("reportPiEditorDraftDisposition(client, msg.requestId, msg.piEditorDraftSnapshot);");
  assert.ok(sendIndex >= 0 && consumeIndex > sendIndex, "the matching Pi draft must clear only after submission is accepted");
});

test("Studio silently preserves changed Pi drafts and offers a confirmed explicit clear", () => {
  const dispositionStart = clientSource.indexOf('if (message.type === "pi_editor_draft_result")');
  const dispositionEnd = clientSource.indexOf('if (message.type === "editor_loaded")', dispositionStart);
  assert.ok(dispositionStart >= 0 && dispositionEnd > dispositionStart, "expected Pi draft disposition handler");
  const dispositionSource = clientSource.slice(dispositionStart, dispositionEnd);
  assert.match(dispositionSource, /outcome !== "changed"/);
  assert.doesNotMatch(dispositionSource, /Pi draft changed after Studio linked it/);
  assert.match(indexSource, /id="clearPiEditorBtn"[\s\S]*?>Clear Pi editor text…<\/button>/);
  assert.match(clientSource, /clearPiEditorBtn\.addEventListener\("click", async \(\) => \{[\s\S]*?requestStudioConfirmation\([\s\S]*?including context added from Neovim[\s\S]*?destructive: true/);
  assert.match(clientSource, /type: "clear_pi_editor_request"/);
  assert.match(indexSource, /if \(msg\.type === "clear_pi_editor_request"\)[\s\S]*?lastCommandCtx\.ui\.setEditorText\(""\)/);
});

test("Load from Pi editor has a distinct editor-action shortcut", () => {
  const shortcutStart = clientSource.indexOf("const isLoadFromPiEditorShortcut");
  const shortcutEnd = clientSource.indexOf("const isSaveAsShortcut", shortcutStart);
  assert.ok(shortcutStart >= 0 && shortcutEnd > shortcutStart, "expected Pi draft load shortcut handler");
  const shortcutSource = clientSource.slice(shortcutStart, shortcutEnd);
  assert.match(shortcutSource, /code === "KeyL"/);
  assert.match(shortcutSource, /\(event\.metaKey \|\| event\.ctrlKey\)/);
  assert.match(shortcutSource, /!event\.altKey/);
  assert.match(shortcutSource, /event\.shiftKey/);
  assert.match(shortcutSource, /if \(isLoadFromPiEditorShortcut\)/);
  assert.doesNotMatch(shortcutSource, /isEditorOnlyMode/);
  assert.match(shortcutSource, /triggerLoadFromPiEditorShortcut\(\)/);

  const triggerStart = clientSource.indexOf("function triggerLoadFromPiEditorShortcut()");
  const triggerEnd = clientSource.indexOf("function triggerEditorSaveShortcut()", triggerStart);
  assert.ok(triggerStart >= 0 && triggerEnd > triggerStart, "expected Pi draft load shortcut action");
  const triggerSource = clientSource.slice(triggerStart, triggerEnd);
  assert.match(triggerSource, /isWatchedFilePreview/);
  assert.match(triggerSource, /getEditorBtn\.disabled/);
  assert.match(triggerSource, /getEditorBtn\.click\(\)/);

  assert.match(indexSource, /id="getEditorBtn"[^>]*aria-keyshortcuts="Meta\+Shift\+L Control\+Shift\+L"/);
  assert.match(indexSource, /<dt>Cmd\/Ctrl\+Shift\+L<\/dt><dd>Load the current Pi terminal input draft without clearing it<\/dd>/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const context = {};
vm.runInNewContext(readFileSync(new URL("../client/studio-editor-draft-helpers.js", import.meta.url), "utf8"), context);
const { createSubmittedEditorDraftTracker, needsDraftReplacementConfirmation } = context.PiStudioEditorDraftHelpers;

test("only a correlated acceptance establishes the original raw editor baseline", () => {
  const tracker = createSubmittedEditorDraftTracker();
  const raw = "Question α\n[an: a local note]\n";
  assert.equal(tracker.remember("run-1", raw, "draft:1"), true);
  assert.equal(tracker.matches(raw, "draft:1"), false, "sending/starting is not acceptance");
  assert.equal(tracker.accept("unrelated"), false);
  assert.equal(tracker.accept("run-1"), true);
  assert.equal(tracker.matches(raw, "draft:1"), true);
  assert.equal(tracker.matches(raw + "new typing", "draft:1"), false);
  assert.equal(tracker.matches(raw, "draft:2"), false);
  assert.equal(tracker.matches(raw.trim(), "draft:1"), false, "compare exact raw text, not transformed sends");
  assert.equal(tracker.accept("run-1"), false);
});

test("failures, disconnects, and out-of-order acknowledgements cannot bless newer edits", () => {
  const tracker = createSubmittedEditorDraftTracker();
  tracker.remember("first", "first prompt", "draft");
  tracker.remember("steer", "steering prompt", "draft");
  tracker.accept("steer");
  assert.equal(tracker.accept("first"), false);
  assert.equal(tracker.matches("steering prompt", "draft"), true);
  tracker.remember("failed", "new prompt", "draft");
  tracker.discard("failed");
  assert.equal(tracker.accept("failed"), false);
  assert.equal(tracker.matches("new prompt", "draft"), false);
  tracker.remember("disconnected", "other prompt", "draft");
  tracker.clearPending();
  assert.equal(tracker.accept("disconnected"), false);
  assert.equal(tracker.matches("other prompt", "draft"), false);
});

test("draft acceptance snapshots are bounded and never silently truncated", () => {
  const tracker = createSubmittedEditorDraftTracker();
  assert.equal(tracker.remember("large", "x".repeat(900_001), "draft"), false);
  assert.equal(tracker.accept("large"), false);
  for (let i = 0; i < 9; i++) tracker.remember("r" + i, "small", "draft");
  assert.equal(tracker.accept("r0"), false, "old pending entries are bounded");
  assert.equal(tracker.accept("r8"), true);
  assert.equal(tracker.remember("r8", "replacement", "draft"), false);
  tracker.clearPending();
  for (let i = 0; i < 4; i++) tracker.remember("big" + i, "x".repeat(900_000), "draft");
  assert.equal(tracker.accept("big0"), false, "aggregate pending text is bounded");
  assert.equal(tracker.accept("big3"), true);
  assert.equal(tracker.matches("x".repeat(900_000), "draft"), true);
});

test("replacement protects new work without interrupting the accepted-prompt loop", () => {
  const check = (overrides = {}) => needsDraftReplacementConfirmation({
    text: "draft", responseText: "response", fileBacked: false, dirty: false, submitted: false, ...overrides,
  });
  assert.equal(check(), true);
  assert.equal(check({ submitted: true }), false);
  assert.equal(check({ text: "" }), false);
  assert.equal(check({ text: "response" }), false);
  assert.equal(check({ text: "response " }), true, "do not normalize away edits");
  assert.equal(check({ fileBacked: true }), false, "saved file text is not unsaved work");
  assert.equal(check({ fileBacked: true, dirty: true, submitted: true }), true);
  assert.equal(check({ fileBacked: true, dirty: true, text: "" }), true, "protect unsaved deletion");
  assert.equal(check({ fileBacked: true, dirty: true, text: "response" }), true, "do not silently detach unsaved edits");
});

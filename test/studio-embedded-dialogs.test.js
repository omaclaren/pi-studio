import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../client/studio.css", import.meta.url), "utf8");

test("Studio does not depend on native JavaScript dialogs", () => {
  assert.doesNotMatch(clientSource, /window\.(?:confirm|prompt|alert)\s*\(/);
  assert.match(clientSource, /async function requestStudioConfirmation\(/);
  assert.match(clientSource, /async function requestStudioTextInput\(/);
  assert.match(clientSource, /mode: "confirm"/);
  assert.match(clientSource, /mode: "prompt"/);
});

test("the in-page decision dialog is modal, cancellable, and keyboard accessible", () => {
  assert.match(clientSource, /dialog\.setAttribute\("role", "alertdialog"\)/);
  assert.match(clientSource, /dialog\.setAttribute\("aria-modal", "true"\)/);
  assert.match(clientSource, /if \(event\.target === overlay\) finishStudioDecision\(null\)/);
  assert.match(clientSource, /if \(event\.key === "Escape"\)[\s\S]*finishStudioDecision\(null\)/);
  assert.match(clientSource, /if \(event\.key !== "Tab"\) return;/);
  assert.match(clientSource, /\[studioDecisionInputEl, studioDecisionCancelBtn, studioDecisionTertiaryBtn, studioDecisionSecondaryBtn, studioDecisionConfirmBtn\]/);
  assert.match(clientSource, /studioDecisionTertiaryBtn\.hidden = !tertiaryLabel/);
  assert.match(clientSource, /hasTertiaryValue: Object\.prototype\.hasOwnProperty\.call\(settings, "tertiaryValue"\)/);
  assert.match(clientSource, /finishStudioDecision\(state\.tertiaryValue\)/);
  assert.match(clientSource, /studioDecisionSecondaryBtn\.hidden = !secondaryLabel/);
  assert.match(clientSource, /hasSecondaryValue: Object\.prototype\.hasOwnProperty\.call\(settings, "secondaryValue"\)/);
  assert.match(clientSource, /finishStudioDecision\(state\.secondaryValue\)/);
  assert.match(clientSource, /studioDecisionCancelBtn\.focus\(\)/);
  assert.match(clientSource, /studioDecisionInputEl\.select\(\)/);
  assert.match(cssSource, /\.studio-decision-overlay \{[\s\S]*?z-index: 13000;/);
  assert.match(cssSource, /\.studio-decision-overlay\[hidden\] \{[\s\S]*?display: none !important;/);
});

test("confirmation buttons retain their accent contrast on hover", () => {
  assert.match(cssSource, /\.studio-decision-confirm:not\(\.is-destructive\):not\(:disabled\):hover,/);
  assert.match(cssSource, /background: color-mix\(in srgb, var\(--accent\) 84%, var\(--text\)\);/);
  assert.match(cssSource, /color: var\(--accent-contrast\);/);
});

test("comment deletion and save paths use the in-page dialogs", () => {
  assert.match(clientSource, /async function deleteReviewNote\([\s\S]*?await requestStudioConfirmation\("Delete this local comment\?"/);
  assert.match(clientSource, /async function deleteAllReviewNotes\([\s\S]*?await requestStudioConfirmation\(/);
  assert.match(clientSource, /async function openEditorSaveAsDialog\([\s\S]*?await requestStudioTextInput\("Save editor content as:"/);
  assert.match(clientSource, /saveAsBtn\.addEventListener\("click", \(\) => \{[\s\S]*?openEditorSaveAsDialog\(\)/);
  assert.match(clientSource, /saveAnnotatedBtn\.addEventListener\("click", async \(\) => \{[\s\S]*?await requestStudioTextInput\("Save annotated editor content as:"/);
  assert.match(clientSource, /confirmLabel: "Delete"[\s\S]*?destructive: true/);
  assert.match(clientSource, /title: "File changed on disk"[\s\S]*?tertiaryLabel: "Reload"[\s\S]*?secondaryLabel: "Save As…"[\s\S]*?confirmLabel: "Overwrite"/);
});

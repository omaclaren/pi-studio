import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
function load(c, start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert(a >= 0 && b > a, start); vm.runInContext(source.slice(a, b), c);
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const grantError = () => Object.assign(new Error("Grant required"), { studioPayload: {
  code: "studio-resource-grant-required", path: "/outside/next.md", directoryPath: "/outside", label: "next.md",
} });
const payload = { text: "new document", path: "/outside/next.md", label: "next.md", resourceDir: "/outside" };

// Real open -> fetch -> grant functions, with only transport, modal decisions
// and final buffer binding supplied by the fixture. Not a browser/modal test.
function fixture() {
  const requests = [], dialogs = [], replacements = [], statuses = [];
  let destination = { id: "document", role: "document", revision: 1, text: "", baselineText: "", sourceState: { path: null }, view: {} };
  const c = vm.createContext({
    bufferRecoveryEnabled: true, documentHostingEnabled: false, uiBusy: false, modal: false, studioDecisionState: null, generation: 1, previewCurrent: true,
    studioModalBlocksDraftAction: allowed => c.modal && (!allowed || c.studioDecisionState !== allowed),
    pendingBufferDocumentOpen: null, fileBackedBaselineText: null, bufferTransientStates: new Map(), fileBrowserState: {},
    studioBuffersCanOpenDocument: (ignoreModal = false) => !c.uiBusy && (ignoreModal || !c.modal),
    bufferRecoveryClient: { capture: () => ({ ok: true }), snapshot: () => ({ buffers: [destination] }),
      replace: (...args) => { replacements.push(args); return { ok: true }; }, select: () => ({ ok: true }) },
    buildWorkspacePersistencePayload: () => ({}), bufferRecoveryExtra: () => ({}),
    captureStudioBufferOpenConsent: () => ({ generation: c.generation }), recoveryConsentIsCurrent: owner => owner.generation === c.generation,
    confirmPreviewOfficeConversion: async () => true, requestStudioConfirmation: async () => true,
    // Replacement lifecycle is covered separately; this fixture owns grant/open continuation.
    retireStudioBufferSourceView() {},
    syncStudioSelectionAppendAction() {}, syncStudioDocumentAppendAction() {}, captureStudioBufferTransientState() {}, bindSelectedStudioBuffer() {},
    setStatus: (...args) => statuses.push(args), normalizeStudioDiskRevision: () => null, normalizeStudioResourceDirValue: value => value,
    detectLanguageFromName: () => "markdown", isWatchedFilePreview: false, initialQueryParams: new URLSearchParams(),
    basenameForStudioPath: path => path.split("/").at(-1),
    getPreviewLinkResourceQuery: (path, context) => ({ path, sourcePath: context.sourcePath, resourceDir: context.resourceDir }),
    fetchStudioJson(path, options) { const request = { path, options, ...deferred() }; requests.push(request); return request.promise; },
    openStudioDecision(options) {
      const decision = deferred(); c.modal = true; c.studioDecisionState = decision;
      if (options.bufferOpenOperation) options.bufferOpenOperation.decision = decision;
      dialogs.push({ options, resolve(value) { c.modal = false; c.studioDecisionState = null; decision.resolve(value); } }); return decision.promise;
    },
  });
  load(c, "function studioPreviewInteractionIsCurrent(", "function refreshEditorPreviewOwnersAfterReconnect(");
  load(c, "function getStudioResourceGrantRequest(", "function getPreviewPdfViewerUrl(");
  load(c, "async function openStudioBufferDocument(", "function syncBufferRecoveryMenuAccess()");
  const context = { sourcePath: "/prompt.md", resourceDir: "/project", isCurrent: () => c.previewCurrent };
  return { c, context, requests, dialogs, replacements, statuses,
    replaceRevision() { destination = { ...destination, revision: destination.revision + 1 }; },
    async start() {
      const result = c.openStudioBufferDocument("/outside/next.md", context).then(value => ({ value }), error => ({ error }));
      await tick(); assert.equal(requests.length, 1); return { result };
    },
    async drain() {
      // Settle old implementations too, so red assertions are behavioural failures,
      // not hanging unresolved grant/transport promises.
      dialogs.forEach(d => d.resolve(false));
      if (requests[1]) requests[1].resolve({ message: "Allowed file" }); await tick();
      if (requests[2]) requests[2].resolve(payload); await tick();
    },
  };
}

const retirements = {
  "retired operation": f => { f.c.pendingBufferDocumentOpen = null; },
  "newer operation": f => { f.c.pendingBufferDocumentOpen = { newer: true }; },
  "changed source consent": f => { f.c.generation++; },
  "changed destination revision": f => f.replaceRevision(),
  "changed preview owner": f => { f.c.previewCurrent = false; },
  "unsafe activity": f => { f.c.uiBusy = true; },
};
for (const [name, retire] of Object.entries(retirements)) {
  test(`late grant-required response after ${name} cannot prompt, grant, retry or replace`, async () => {
    const f = fixture(), { result } = await f.start(); retire(f);
    const nextOwner = f.c.pendingBufferDocumentOpen;
    f.requests[0].reject(grantError()); await tick();
    const shown = f.dialogs.length; await f.drain(); const outcome = await result;
    assert.equal(shown, 0, "a retired open cannot display a permission decision");
    assert.equal(f.requests.length, 1); assert.equal(f.replacements.length, 0);
    assert.equal(outcome.value, false, "retirement is a silent refusal, not a stale error for the new view");
    if (name === "newer operation") assert.equal(f.c.pendingBufferDocumentOpen, nextOwner);
  });
}

test("an open retired while its grant decision is pending cannot POST approval or retry", async () => {
  const f = fixture(), { result } = await f.start(); f.requests[0].reject(grantError()); await tick();
  assert.equal(f.dialogs.length, 1); f.c.pendingBufferDocumentOpen = null;
  f.dialogs[0].resolve(true); await tick(); await f.drain(); const outcome = await result;
  assert.equal(f.requests.length, 1); assert.equal(f.replacements.length, 0); assert.equal(outcome.value, false);
});

test("retirement during an already-approved grant POST suppresses its retry, not an imaginary rollback", async () => {
  const f = fixture(), { result } = await f.start(); f.requests[0].reject(grantError()); await tick();
  f.dialogs[0].resolve(true); await tick(); assert.equal(f.requests.length, 2);
  assert.equal(f.requests[1].path, "/resource-grants"); f.c.pendingBufferDocumentOpen = null;
  f.requests[1].resolve({ message: "Allowed file" }); await tick(); await f.drain(); const outcome = await result;
  assert.equal(f.requests.length, 2); assert.equal(f.replacements.length, 0); assert.equal(outcome.value, false);
});

test("current file-only grant keeps its original resource context and works through its own modal", async () => {
  const f = fixture(), originalPredicate = f.context.isCurrent, { result } = await f.start();
  f.requests[0].reject(grantError()); await tick(); assert.equal(f.dialogs.length, 1); assert.equal(f.c.modal, true);
  f.dialogs[0].resolve(true); await tick(); assert.equal(f.requests.length, 2);
  assert.deepEqual(JSON.parse(f.requests[1].options.body), { grantKind: "file", path: "/outside/next.md" });
  f.requests[1].resolve({ message: "Allowed file" }); await tick(); assert.equal(f.requests.length, 3);
  f.requests[2].resolve(payload); const outcome = await result;
  assert.equal(outcome.value, true); assert.equal(f.replacements.length, 1);
  assert.equal(f.replacements[0][2].text, payload.text); assert.equal(f.replacements[0][3], payload.text);
  for (const i of [0, 2]) assert.deepEqual({ ...f.requests[i].options.query }, {
    path: "/outside/next.md", sourcePath: "/prompt.md", resourceDir: "/project", action: "document",
  });
  assert.equal(f.context.isCurrent, originalPredicate, "the caller's preview predicate is composed, not overwritten");
});

test("a current non-grant read failure still reports its real error and cleans up its own operation", async () => {
  const f = fixture(), { result } = await f.start(), error = new Error("disk unavailable");
  f.requests[0].reject(error); assert.equal((await result).error, error);
  assert.equal(f.c.pendingBufferDocumentOpen, null); assert.equal(f.dialogs.length, 0);
});

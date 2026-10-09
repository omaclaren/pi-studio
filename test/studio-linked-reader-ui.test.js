import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createStudioLinkedReader } from "../shared/studio-linked-reader.js";
let createStudioLinkedReaderUi;
try { ({ createStudioLinkedReaderUi } = await import("../shared/studio-linked-reader-ui.js")); }
catch (e) { if (e.code !== "ERR_MODULE_NOT_FOUND") throw e; }

class Element {
  constructor(tag = "div") { this.tagName = tag; this.children = []; this.dataset = {}; this.style = {}; this.attributes = {}; this.listeners = {}; this.isConnected = true; this.hidden = false; this.scrollTop = 0; this.scrollLeft = 0; this.clientTop = 1; }
  append(...children) { for (const child of children) { child.remove(); child.parentElement = this; this.children.push(child); } }
  insertBefore(child, before) { child.remove(); child.parentElement = this; const i = this.children.indexOf(before); this.children.splice(i < 0 ? this.children.length : i, 0, child); }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(c => c !== this); this.parentElement = null; }
  replaceChildren(...children) { this.children.forEach(c => { c.parentElement = null; }); this.children = []; this.append(...children); this.innerHTML = ""; }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  setAttribute(k, v) { this.attributes[k] = v; }
  removeAttribute(k) { delete this.attributes[k]; }
  getAttribute(k) { return this.attributes[k]; }
  getBoundingClientRect() { return { top: this.tagName === "host" ? 0 : 30, bottom: this.tagName === "host" ? 800 : 70 }; }
  focus() { this.focused = true; }
  closest(selector) { return this.pane && selector.includes(this.pane.id) ? this.pane : null; }
}
function harness(settings = {}) {
  assert.equal(typeof createStudioLinkedReaderUi, "function", "reader browser integration is not implemented");
  const host = new Element("host"), root = new Element(), footer = new Element(), select = new Element("select");
  host.append(root, footer); select.value = "editor-preview";
  if (settings.metadata) host.insertBefore(settings.metadata, root);
  if (settings.header) host.insertBefore(settings.header, settings.metadata || root);
  const calls = { reads: [], returns: [], left: 0, rendered: [], warnings: [] };
  const options = {
    document: { createElement: tag => new Element(tag) },
    window: { addEventListener() {}, removeEventListener() {}, requestAnimationFrame: fn => fn() },
    host, root, footer, select,
    captureOrigin: () => ({ kind: "editor", bufferId: "doc-a" }),
    contextIsCurrent: context => !context?.isCurrent || context.isCurrent(),
    read: async (href, context) => { calls.reads.push({ href, context }); return { path: href.startsWith("/") ? href : "/notes/" + href, label: href.split("/").pop(), resourceDir: "/notes", text: "# " + href, extension: ".md" }; },
    render: async (_el, entry, isCurrent) => { if (isCurrent()) calls.rendered.push(entry.path); },
    originLabel: () => "Document preview",
    returnToOrigin: origin => { calls.returns.push(origin); }, manualLeave: () => { calls.left++; },
    findOwner: async () => ({ kind: "new", label: "Open in Document…" }),
    openForEdit: async () => true,
    report: message => calls.warnings.push(message), changed() {},
    ...settings,
  };
  const ui = createStudioLinkedReaderUi(options);
  return { ui, calls, host, root, footer, select };
}

test("reading covers but does not replace the live underlying pane or editable text", async () => {
  const h = harness(); h.root.innerHTML = "live Document";
  await h.ui.read("one.md", { sourcePath: "/notes/index.md" });
  assert.equal(h.ui.snapshot().current.path, "/notes/one.md");
  assert.equal(h.host.dataset.linkedReaderActive, "1");
  assert.equal(h.root.inert, true); assert.equal(h.footer.inert, true);
  assert.equal(h.root.innerHTML, "live Document");
  h.root.innerHTML = "new Working beneath reader";
  h.select.value = "trace"; h.ui.sync();
  assert.equal(h.select.value, "");
  assert.equal(h.ui.snapshot().current.path, "/notes/one.md");
  assert.equal(h.root.innerHTML, "new Working beneath reader");
});

test("nested requests resolve from their own snapshot context and Back restores independent positions", async () => {
  const h = harness(); await h.ui.read("one.md", { resourceDir: "/notes" });
  h.ui.contentElement.scrollTop = 321; h.ui.contentElement.scrollLeft = 2;
  await h.ui.read("two.md", h.ui.context());
  assert.equal(h.calls.reads[1].context.sourcePath, "/notes/one.md");
  assert.equal(h.calls.reads[1].context.resourceDir, "/notes");
  await h.ui.back();
  assert.equal(h.ui.snapshot().current.label, "one.md");
  assert.equal(h.ui.contentElement.scrollTop, 321);
  await h.ui.back();
  assert.equal(h.host.dataset.linkedReaderActive, "0");
  assert.equal(h.root.inert, false);
  assert.equal(h.calls.returns[0].bufferId, "doc-a");
  await h.ui.forward();
  assert.equal(h.ui.contentElement.scrollTop, 321);
});

test("Close and stale origin cancel loading without replacing current reading work", async () => {
  let settle, current = true;
  const h = harness({ read: () => new Promise(resolve => { settle = resolve; }) });
  const load = h.ui.read("late.md", { isCurrent: () => current });
  current = false; settle({ path: "/notes/late.md", text: "late" }); await load;
  assert.equal(h.ui.snapshot().active, false);
  current = true;
  const next = h.ui.read("late.md", { isCurrent: () => true });
  h.ui.close({ restore: false }); settle({ path: "/notes/late.md", text: "late" }); await next;
  assert.equal(h.ui.snapshot().active, false);
  assert.deepEqual(h.calls.rendered, []);
});

test("refresh retains page identity and snapshot position without adding editing authority", async () => {
  const h = harness(); await h.ui.read("one.md", {});
  const before = h.ui.snapshot().current;
  h.ui.contentElement.scrollTop = 99;
  await h.ui.refresh();
  assert.equal(h.calls.reads[1].href, "/notes/one.md");
  assert.equal(h.ui.snapshot().current.id, before.id);
  assert.equal(h.ui.snapshot().current.revision, before.revision + 1);
  assert.equal(h.ui.contentElement.scrollTop, 99);
});

test("editing rechecks the displayed owner and aborts if its meaning changed", async () => {
  let owner = { kind: "new", label: "Open in Document…" }, opened = 0;
  const h = harness({ findOwner: async () => owner, openForEdit: async () => { opened++; return true; } });
  await h.ui.read("one.md", {});
  owner = { kind: "window", label: "Show its window", workspaceId: "other", bufferId: "b" };
  await h.ui.openForEdit();
  assert.equal(opened, 0); assert.equal(h.ui.snapshot().active, true);
  await h.ui.openForEdit();
  assert.equal(opened, 1); assert.equal(h.ui.snapshot().active, false);
  assert.equal(h.calls.left, 1); assert.equal(h.calls.returns.length, 0);
});

const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
function section(start, end) { const a = source.indexOf(start), b = source.indexOf(end, a); assert.ok(a >= 0 && b > a); return source.slice(a, b); }
function owners() {
  const reader = createStudioLinkedReader();
  reader.commit(reader.begin({ kind: "editor", bufferId: "doc-a" }), { path: "/notes/one.md", text: "# One", resourceDir: "/notes", label: "one.md", extension: ".md" });
  const pane = new Element(); pane.id = "studioLinkedReaderContent";
  const c = { reader, pane, Element, studioLinkedReaderUi: { snapshot: () => reader.snapshot(), contentElement: pane, isCurrent: p => reader.isCurrent(p) },
    studioLinkedReaderRenderNonce: 9, sourcePreviewRenderNonce: 1, responsePreviewRenderNonce: 2,
    sourcePreviewEl: new Element(), critiqueViewEl: new Element(), rightView: "editor-preview", editorView: "preview", annotationsEnabled: true,
    editorLanguage: "python", sourceTextEl: { value: "underlying editor" }, bufferRecoveryEnabled: true, bufferPageClosed: false,
    latestResponseMarkdown: "underlying response", captureEditorAsyncConsent: () => ({}), editorAsyncConsentIsCurrent: () => true,
    getSelectedHistoryItem: () => ({ id: "response" }), getHtmlPreviewResourceContextOptions: () => ({ sourcePath: "/elsewhere/current.md", resourceDir: "/elsewhere" }),
    previewResourceHelpers: { areStudioPreviewResourceContextsEqual: () => true }, studioPreviewElementOwners: new WeakMap(),
  };
  vm.createContext(c);
  vm.runInContext(section("function captureStudioPreviewOwner(", "function refreshEditorPreviewOwnersAfterReconnect()"), c);
  return c;
}

test("production reader owner retains its own source context over role/response changes", () => {
  const c = owners(); const owner = c.captureStudioPreviewOwner("reader", 9);
  assert.equal(owner.resource.sourcePath, "/notes/one.md");
  assert.equal(owner.resource.resourceDir, "/notes");
  c.rightView = "trace"; c.sourcePreviewRenderNonce++; c.responsePreviewRenderNonce++; c.latestResponseMarkdown = "new response";
  assert.equal(c.studioPreviewOwnerIsCurrent(owner), true);
  c.reader.commit(c.reader.begin(), { path: "/notes/two.md", text: "# Two" });
  assert.equal(c.studioPreviewOwnerIsCurrent(owner), false);
});

test("old committed reader DOM cannot resolve links using a newer pending page", () => {
  const c = owners(), owner = c.captureStudioPreviewOwner("reader", 9);
  c.studioPreviewElementOwners.set(c.pane, owner);
  const anchor = new Element("a"); anchor.pane = c.pane;
  const context = c.buildStudioPreviewInteractionContext(anchor);
  assert.equal(context.sourcePath, "/notes/one.md");
  assert.equal(c.studioPreviewInteractionIsCurrent(context), true);
  c.reader.commit(c.reader.begin(), { path: "/notes/two.md", text: "new" });
  assert.equal(c.studioPreviewInteractionIsCurrent(context), false);
  assert.equal(context.sourcePath, "/notes/one.md");
});

test("wiring is opt-in, Files can Read here, HTML text links read, and editing stays guarded", () => {
  const server = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
  assert.match(server, /\["studio-linked-reader-ui\.js", new URL/);
  assert.match(server, /\["studio-linked-reader\.js", new URL/);
  assert.match(source, /function studioLinkedReaderAvailable\(\)/);
  assert.match(source, /data-files-action='read-here'/);
  assert.match(section("function handlePreviewLocalLinkClick(", "function handlePreviewLocalLinkContextMenu("), /readStudioLinkedFile/);
  assert.match(section("function handleHtmlArtifactFrameLocalLinkMessage(", "function handleHtmlArtifactFrameCommentTargetMessage("), /readStudioLinkedFile/);
  assert.match(source, /fetchPreviewLocalLink\("reader", href, context\)/);
  assert.match(source, /reuseHostedDocumentOwner\(studioLiteralPathToLinkRef\(page\.path\)/); // a literal name keeps #, ? and % (Sol, batch B)
  assert.match(source, /openPreviewDocumentHere\(studioLiteralPathToLinkRef\(page\.path\)/);
});

test("underlying metadata is inert and retained beneath independent reader chrome", async () => {
  const metadata = new Element("meta"), header = new Element("header"); metadata.innerHTML = "Files context";
  const h = harness({ metadata, header }); h.root.scrollTop = 123;
  await h.ui.read("one.md", {});
  assert.equal(metadata.inert, true); assert.equal(metadata.getAttribute("aria-hidden"), "true");
  assert.equal(metadata.innerHTML, "Files context"); assert.equal(h.root.scrollTop, 123);
  assert.match(h.select.title, /\/notes\/one\.md/);
  await h.ui.close({ restore: true });
  assert.equal(metadata.inert, false); assert.equal(metadata.getAttribute("aria-hidden"), undefined);
  assert.equal(h.root.scrollTop, 123);
});

test("same-page fragments update only the reader position and retain page identity", async () => {
  const h = harness(); await h.ui.read("one.md", {}); const page = h.ui.snapshot().current;
  const target = new Element(); target.id = "deep heading"; target.getBoundingClientRect = () => ({ top: 220 });
  h.ui.contentElement.querySelectorAll = () => [target]; h.ui.contentElement.scrollTop = 80;
  assert.equal(h.ui.revealFragment("deep%20heading"), true);
  assert.equal(h.ui.snapshot().current.position.top, 270); assert.equal(h.ui.snapshot().current.id, page.id);
  assert.equal(h.ui.snapshot().entries.length, 1); assert.equal(h.root.scrollTop, 0);
});

test("a left-preview origin wins over Files on the right; auxiliary origins retain buffer identity", () => {
  const c = { getStudioSelectedBuffer: () => ({ id: "prompt-a" }), rightView: "files",
    critiqueViewEl: { scrollTop: 55, scrollLeft: 8 }, fileBrowserState: { entries: [], exactFiles: [], locations: [] },
    isWatchedFilePreview: false, getSelectedHistoryItem: () => ({ id: "response-a" }) };
  vm.createContext(c); vm.runInContext(section("function captureStudioLinkedReaderOrigin(", "function studioLinkedReaderOriginLabel("), c);
  assert.equal(c.captureStudioLinkedReaderOrigin({ readerOrigin: "editor" }).kind, "editor");
  c.rightView = "side-questions"; const origin = c.captureStudioLinkedReaderOrigin({});
  const reader = createStudioLinkedReader(); reader.commit(reader.begin(origin), { path: "/notes/one.md", text: "one" });
  const result = reader.back(); assert.equal(result.origin.kind, "view");
  assert.equal(result.origin.bufferId, "prompt-a"); assert.equal(result.origin.view, "side-questions");
});

test("initial Files reads cannot start late after a view, buffer or folder departure during module loading", async () => {
  for (const departure of ["view", "buffer", "folder"]) {
    let release; const gate = new Promise(resolve => { release = resolve; }); let reads = 0;
    const c = { rightView: "files", bufferPageClosed: false, id: "prompt-a", fileBrowserState: { currentDir: "/notes" },
      getStudioSelectedBuffer: () => ({ id: c.id }), ensureStudioLinkedReader: async () => { await gate; return { read: () => { reads++; return true; } }; },
      studioPreviewInteractionIsCurrent: context => !context?.isCurrent || context.isCurrent(), setStatus() {} };
    vm.createContext(c); vm.runInContext(section("async function readStudioLinkedFile(", "let previewLinkMenuEl"), c);
    const result = c.readStudioLinkedFile("/notes/one.md", { readerOrigin: "files", resourceDir: "/notes" });
    if (departure === "view") c.rightView = "changes";
    if (departure === "buffer") c.id = "doc-a";
    if (departure === "folder") c.fileBrowserState.currentDir = "/other";
    release(); assert.equal(await result, false, departure + " must fence the initial read"); assert.equal(reads, 0);
  }
});

test("reader identity is filename-only with a separate timestamped read-only marker beside Refresh", async () => {
  const previous = Date.now; let clock = Date.UTC(2026, 9, 5, 1, 32);
  Date.now = () => clock;
  try {
    const h = harness(); await h.ui.read("one.md", {});
    const bar = h.host.children.find(e => e.className === "studio-reader-toolbar");
    const marker = bar.children.find(e => e.className === "studio-reader-snapshot");
    const refresh = bar.children.find(e => e.textContent === "Refresh");
    assert.equal(h.select.children.find(e => e.dataset.linkedReaderOption).textContent, "one.md");
    assert.equal(marker.textContent, "Read-only · saved file as of " + new Date(clock).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }));
    assert.equal(bar.children.indexOf(refresh), bar.children.indexOf(marker) + 1);
    const before = marker.textContent; clock += 60000; await h.ui.refresh(); assert.notEqual(marker.textContent, before);
    assert.equal(h.ui.snapshot().current.readAt, clock);
  } finally { Date.now = previous; }
});

test("duplicate filenames show enough folder context in the title and Back/Forward labels", async () => {
  const h = harness({ captureOrigin: () => ({ kind: "editor", path: "/notes/week03/README.md" }) });
  await h.ui.read("/other/week03/README.md", {});
  const option = h.select.children.find(e => e.dataset.linkedReaderOption);
  assert.equal(option.textContent, "other/week03/README.md");
  await h.ui.read("/notes/week03/README.md", {});
  const bar = h.host.children.find(e => e.className === "studio-reader-toolbar");
  assert.equal(option.textContent, "notes/week03/README.md");
  assert.equal(bar.children[0].textContent, "← other/week03/README.md");
  assert.match(bar.children[0].title, /\/other\/week03\/README\.md/);
  await h.ui.back(); assert.equal(bar.children[1].textContent, "notes/week03/README.md →");
  assert.match(bar.children[1].title, /\/notes\/week03\/README\.md/);
});

test("after Back to the origin, retained history shows only file Forward and Close", async () => {
  const h = harness(); await h.ui.read("one.md", {}); await h.ui.back();
  const bar = h.host.children.find(e => e.className === "studio-reader-toolbar");
  assert.deepEqual(bar.children.flatMap(e => e.children.length ? e.children : [e]).filter(e => !e.hidden).map(e => e.textContent), ["one.md →", "Close"]);
  assert.equal(h.ui.snapshot().entries.length, 1);
  await h.ui.forward(); assert.equal(h.ui.snapshot().active, true);
});

test("an already owned reader context survives underlying view changes during module readiness", async () => {
  let release; const gate = new Promise(resolve => { release = resolve; }); let reads = 0;
  const c = { rightView: "files", bufferPageClosed: false, fileBrowserState: { currentDir: "/notes" },
    getStudioSelectedBuffer: () => ({ id: "prompt-a" }), ensureStudioLinkedReader: async () => { await gate; return { read: () => { reads++; return true; } }; },
    studioPreviewInteractionIsCurrent: context => !context?.isCurrent || context.isCurrent(), setStatus() {} };
  vm.createContext(c); vm.runInContext(section("async function readStudioLinkedFile(", "let previewLinkMenuEl"), c);
  const result = c.readStudioLinkedFile("/notes/two.md", { isCurrent: () => true }); c.rightView = "trace";
  release(); assert.equal(await result, true); assert.equal(reads, 1);
});

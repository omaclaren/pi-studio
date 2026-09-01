import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const indexSource = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../client/studio.css", import.meta.url), "utf8");

test("watched preview documents are server-created, transient, and read-only", () => {
  assert.match(indexSource, /watchFile\?: boolean/);
  assert.match(indexSource, /data-watched-file-preview="\$\{initialWatchFile\}"/);
  assert.match(indexSource, /kind: "watched-preview"/);
  assert.match(indexSource, /transient: true,[\s\S]*?skipWorkspaceRestore: true,[\s\S]*?paneFocus: "right"/);
  assert.match(clientSource, /sourceTextEl\.readOnly = true/);
  assert.match(clientSource, /sourceTextEl\.setAttribute\("aria-readonly", "true"\)/);
  assert.match(clientSource, /function setEditorText\([\s\S]*?isWatchedFilePreview[\s\S]*?allowWatchedFileUpdate/);
  assert.match(clientSource, /function applySourceTextEdit\([\s\S]*?if \(isWatchedFilePreview\)[\s\S]*?read-only/);
  assert.match(clientSource, /function setSourceState\([\s\S]*?isWatchedFilePreview[\s\S]*?remains bound to its watched file/);
  assert.match(clientSource, /function setEditorLanguage\([\s\S]*?isWatchedFilePreview[\s\S]*?language follows its file path/);
  assert.match(clientSource, /if \(!workspacePersistenceReady \|\| isWatchedFilePreview\) return/);
  assert.match(cssSource, /body\[data-watched-file-preview="1"\] #saveOverBtn/);
});

test("watched file subscriptions use bounded path-bound server capabilities and close with clients", () => {
  assert.match(indexSource, /STUDIO_WATCHED_FILE_MAX_CLIENTS = 16/);
  assert.match(indexSource, /TRANSIENT_STUDIO_DOCUMENT_TTL_MS = 30 \* 60 \* 1000/);
  assert.match(indexSource, /MAX_TRANSIENT_STUDIO_DOCUMENTS = 16/);
  assert.match(indexSource, /const capabilityDocument = requestedDocId \? readTransientStudioDocument\(requestedDocId\) : null/);
  assert.match(indexSource, /capabilityDocument\?\.watchFile && capabilityDocument\.path/);
  assert.match(indexSource, /comparableWatchedPath !== comparableCapabilityPath/);
  assert.match(indexSource, /studioWatchedClientPaths\.set\(ws, canonicalWatchedPath\)/);
  assert.match(indexSource, /clientWatchedPath !== canonicalPath/);
  assert.match(indexSource, /This socket is not authorized for that server-created watched preview/);
  assert.match(clientSource, /wsParams\.set\("docId", watchedDocId\)/);
  assert.match(indexSource, /studioFileWatchers\.set\(client, watcher\)/);
  assert.match(indexSource, /void closeStudioFileWatcher\(ws\)/);
  assert.match(indexSource, /await closeAllStudioFileWatchers\(\)/);
});

test("watched capabilities are invalidated on Pi session replacement", () => {
  assert.match(indexSource, /if \(isSessionReplacement\)[\s\S]*?for \(const client of studioWatchedClientPaths\.keys\(\)\)[\s\S]*?Watched preview session changed/);
  assert.match(indexSource, /if \(isSessionReplacement\)[\s\S]*?await closeAllStudioFileWatchers\(\)[\s\S]*?transientStudioDocuments\.clear\(\)/);
  assert.match(indexSource, /Keep socket capability metadata until each socket is closed/);
  assert.match(indexSource, /ws\.on\("error"[\s\S]*?before removing its watched-path marker[\s\S]*?ws\.terminate\(\)/);
});

test("watched sockets remain read-only and do not accept document replacement", () => {
  assert.match(indexSource, /if \(msg\.type === "save_as_request"\) \{[\s\S]*?studioWatchedClientPaths\.has\(client\)[\s\S]*?Watched previews are read-only/);
  assert.match(indexSource, /if \(msg\.type === "save_over_request"\) \{[\s\S]*?studioWatchedClientPaths\.has\(client\)[\s\S]*?Watched previews are read-only/);
  assert.match(clientSource, /async function openPreviewDocumentHere[\s\S]*?if \(isWatchedFilePreview\)[\s\S]*?cannot open another document here/);
  assert.match(clientSource, /query\.watchedFile = "1"[\s\S]*?query\.docId = watchedDocId/);
  assert.match(indexSource, /action === "document" && originatesFromWatchedPreview[\s\S]*?Open here is unavailable in a watched preview/);
  assert.match(clientSource, /message\.type === "studio_document"[\s\S]*?if \(isWatchedFilePreview\)[\s\S]*?Ignored document replacement/);
  assert.match(indexSource, /if \(requestedWatchFile && isAbsolute\(requestedPath\)\)[\s\S]*?watchFile: true/);
});

test("watched preview updates preserve disk authority and reading position", () => {
  assert.match(clientSource, /type: "watch_file_subscribe"/);
  assert.match(clientSource, /message\.type === "watched_file_update"/);
  assert.match(clientSource, /snapshot: captureWatchedPreviewReadingPosition\(critiqueViewEl\)/);
  assert.match(clientSource, /getWatchedPreviewAnchorSignature/);
  assert.match(clientSource, /snapshot\.signature/);
  assert.match(clientSource, /maxScroll \* Math\.max\(0, Math\.min\(1, Number\(snapshot\.ratio\)/);
  assert.match(clientSource, /Hidden embedded\/headless surfaces can suspend animation frames entirely/);
  assert.match(clientSource, /fileBackedDiskRevision = watchedFilePreviewState\.diskRevision \|\| null/);
  assert.match(clientSource, /socket\.addEventListener\("message", \(event\) => \{[\s\S]*?if \(ws !== socket\) return/);
  assert.match(clientSource, /renderActiveResult\(\)/);
});

test("read and render failures retain the last good watched preview", () => {
  assert.match(indexSource, /keeping the last good preview/);
  assert.match(clientSource, /createStudioPreviewStagingElement\(targetEl\)/);
  assert.match(clientSource, /if \(abandonIfStale\(\)\) return;/);
  assert.match(clientSource, /commitStudioPreviewStagingElement\(targetEl, staging\)/);
  assert.match(clientSource, /targetEl\.dataset\.studioPreviewCommitted = "1"/);
  assert.match(clientSource, /targetEl\.dataset\.studioPreviewCommitted === "1"/);
  assert.match(clientSource, /showWatchedPreviewRenderError\(targetEl, detail\)/);
  assert.match(clientSource, /Could not render the latest disk revision; keeping the last good preview/);
  assert.match(clientSource, /retry\.addEventListener\("click", \(\) => renderActiveResult\(\)\)/);
  assert.match(cssSource, /\.studio-preview-staging/);
  assert.match(cssSource, /\.studio-watched-preview-error/);
});

test("Files and local text-link menus expose followed preview actions", () => {
  assert.match(clientSource, /Preview file \(follow changes\)/);
  assert.match(clientSource, /data-files-action='watch-new'/);
  assert.match(clientSource, /Preview \(follow\)/);
  assert.match(clientSource, /fetchPreviewLocalLink\("watch-url", href, contextOverride\)/);
  assert.match(indexSource, /action !== "document" && action !== "editor-url" && action !== "watch-url"/);
});

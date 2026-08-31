import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createStudioResourceGrantRegistry } from "../shared/studio-resource-grants.js";

function makeTempDir() {
	return mkdtempSync(join(tmpdir(), "pi-studio-resource-grants-"));
}

test("Studio resource grants canonicalize and deduplicate document directories", () => {
	const root = makeTempDir();
	try {
		const documentDir = join(root, "documents");
		mkdirSync(documentDir);
		const documentPath = join(documentDir, "notes.md");
		const imagePath = join(documentDir, "figure.png");
		writeFileSync(documentPath, "# Notes\n");
		writeFileSync(imagePath, "image");

		const registry = createStudioResourceGrantRegistry({ now: () => 42 });
		const first = registry.grantDocument(documentPath);
		const second = registry.grantDocument(documentPath, { source: "document-reopen" });

		assert.equal(first.kind, "directory");
		assert.equal(first.path, realpathSync(documentDir));
		assert.deepEqual(second.sources, ["document", "document-reopen"]);
		assert.equal(second.grantedAt, 42);
		assert.equal(registry.size, 1);
		assert.equal(registry.allows(documentPath), true);
		assert.equal(registry.allows(imagePath), true);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("Studio resource grants distinguish exact files from folders", () => {
	const root = makeTempDir();
	try {
		const grantedDir = join(root, "granted");
		const otherDir = join(root, "other");
		mkdirSync(grantedDir);
		mkdirSync(otherDir);
		const exactFile = join(otherDir, "exact.pdf");
		const siblingFile = join(otherDir, "sibling.pdf");
		const nestedFile = join(grantedDir, "nested.txt");
		writeFileSync(exactFile, "%PDF-1.4\n");
		writeFileSync(siblingFile, "%PDF-1.4\n");
		writeFileSync(nestedFile, "nested");

		const registry = createStudioResourceGrantRegistry();
		registry.grantFile(exactFile);
		registry.grantDirectory(grantedDir);

		assert.equal(registry.allows(exactFile), true);
		assert.equal(registry.allows(siblingFile), false);
		assert.equal(registry.allows(nestedFile), true);
		assert.equal(registry.findGrant(exactFile).kind, "file");
		assert.equal(registry.findGrant(nestedFile).kind, "directory");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("Studio exact-file grants do not follow a replacement symlink", () => {
	const root = makeTempDir();
	const outside = makeTempDir();
	try {
		const grantedFile = join(root, "granted.txt");
		const outsideFile = join(outside, "secret.txt");
		writeFileSync(grantedFile, "original");
		writeFileSync(outsideFile, "secret");

		const registry = createStudioResourceGrantRegistry();
		registry.grantFile(grantedFile);
		unlinkSync(grantedFile);
		symlinkSync(outsideFile, grantedFile);

		assert.equal(registry.allows(grantedFile), false);
		assert.equal(registry.allows(outsideFile), false);
	} finally {
		rmSync(root, { recursive: true, force: true });
		rmSync(outside, { recursive: true, force: true });
	}
});

test("Studio resource directory grants reject symlink escapes", () => {
	const root = makeTempDir();
	const outside = makeTempDir();
	try {
		const outsideFile = join(outside, "secret.txt");
		writeFileSync(outsideFile, "secret");
		symlinkSync(outsideFile, join(root, "linked-secret.txt"));

		const registry = createStudioResourceGrantRegistry();
		registry.grantDirectory(root);

		assert.equal(registry.allows(join(root, "linked-secret.txt")), false);
		assert.equal(registry.allows(outsideFile), false);
	} finally {
		rmSync(root, { recursive: true, force: true });
		rmSync(outside, { recursive: true, force: true });
	}
});

test("granting a document symlink does not grant its target directory", () => {
	const root = makeTempDir();
	const outside = makeTempDir();
	try {
		const outsideDocument = join(outside, "notes.md");
		const outsideSibling = join(outside, "secret.txt");
		const linkedDocument = join(root, "linked-notes.md");
		const localImage = join(root, "figure.png");
		writeFileSync(outsideDocument, "# Notes\n");
		writeFileSync(outsideSibling, "secret");
		writeFileSync(localImage, "image");
		symlinkSync(outsideDocument, linkedDocument);

		const registry = createStudioResourceGrantRegistry();
		registry.grantDocument(linkedDocument);

		assert.equal(registry.allows(linkedDocument), true, "the explicitly opened document stays available");
		assert.equal(registry.allows(localImage), true, "resources beside the document link are available");
		assert.equal(registry.allows(outsideSibling), false, "siblings of the symlink target are not implicitly granted");
	} finally {
		rmSync(root, { recursive: true, force: true });
		rmSync(outside, { recursive: true, force: true });
	}
});

test("Studio resource grants are bounded and session-clearable", () => {
	const root = makeTempDir();
	try {
		const first = join(root, "first.txt");
		const second = join(root, "second.txt");
		writeFileSync(first, "first");
		writeFileSync(second, "second");
		const registry = createStudioResourceGrantRegistry({ maxEntries: 1 });

		registry.grantFile(first);
		assert.throws(() => registry.grantFile(second), /grant limit reached/);
		registry.clear();
		assert.equal(registry.size, 0);
		assert.equal(registry.allows(first), false);
		assert.doesNotThrow(() => registry.grantFile(second));
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("Studio resource grants reject missing, remote, and mismatched paths", () => {
	const root = makeTempDir();
	try {
		const file = join(root, "notes.md");
		writeFileSync(file, "notes");
		const registry = createStudioResourceGrantRegistry();

		assert.throws(() => registry.grantFile("https://example.test/notes.md"), /local path/);
		assert.throws(() => registry.grantFile(join(root, "missing.md")), /ENOENT|no such file/i);
		assert.throws(() => registry.grantFile(root), /does not refer to a file/);
		assert.throws(() => registry.grantDirectory(file), /does not refer to a directory/);
		assert.equal(registry.allows(join(root, "missing.md")), false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("Studio exposes session resource grants and clears them with the server", () => {
	const indexSource = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
	assert.match(indexSource, /createStudioResourceGrantRegistry\(\)/);
	assert.match(indexSource, /recordStudioDocumentResourceGrants\(selected, ctx\.cwd\)/);
	assert.match(indexSource, /resourceGrants: studioResourceGrantRegistry\.snapshot\(\)/);

	const stopServerStart = indexSource.indexOf("const stopServer = async () =>");
	const serverClose = indexSource.indexOf("state.server.close", stopServerStart);
	const grantsClear = indexSource.indexOf("studioResourceGrantRegistry.clear()", stopServerStart);
	assert.ok(stopServerStart >= 0 && serverClose > stopServerStart && grantsClear > serverClose);
});

test("cross-boundary local links require an explicit file or folder grant", () => {
	const indexSource = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
	const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");

	assert.match(indexSource, /class StudioResourceGrantRequiredError extends Error/);
	assert.match(indexSource, /readonly code = "studio-resource-grant-required"/);
	assert.match(indexSource, /resourceGrants\?\.findGrant\(candidateReal\)/);
	assert.match(indexSource, /error instanceof StudioResourceGrantRequiredError/);
	assert.match(indexSource, /code: error\.code[\s\S]*directoryPath: error\.directoryPath/);
	const grantRouteStart = indexSource.indexOf('requestUrl.pathname === "/resource-grants"');
	const localLinkRouteStart = indexSource.indexOf('requestUrl.pathname === "/local-preview-link"');
	assert.ok(grantRouteStart >= 0 && localLinkRouteStart > grantRouteStart, "The authenticated grant route must precede local-link resolution and the root catch-all.");
	const grantRouteSource = indexSource.slice(grantRouteStart, localLinkRouteStart);
	assert.match(grantRouteSource, /token !== serverState\.token/);
	assert.match(grantRouteSource, /handleStudioResourceGrantRequest\(req, res, studioResourceGrantRegistry, studioCwd\)/);
	assert.match(indexSource, /resourceGrants\.grantDirectory\(path, \{ cwd: studioCwd, source: "explicit-directory" \}\)/);
	assert.match(indexSource, /resourceGrants\.grantFile\(path, \{ cwd: studioCwd, source: "explicit-file" \}\)/);
	assert.match(indexSource, /resolveStudioPdfResourcePath\([\s\S]*studioResourceGrantRegistry/);
	assert.match(indexSource, /resolveStudioHtmlPreviewResourcePath\([\s\S]*studioResourceGrantRegistry/);

	assert.match(clientSource, /requestError\.studioPayload = payload/);
	assert.match(clientSource, /payload\.code !== "studio-resource-grant-required"/);
	assert.match(clientSource, /confirmLabel: "Allow this file"/);
	assert.match(clientSource, /secondaryLabel: "Allow this folder for this Studio session"/);
	assert.match(clientSource, /secondaryValue: "directory"/);
	assert.match(clientSource, /fetchStudioJson\("\/resource-grants"/);
	assert.match(clientSource, /if \(!\(await requestStudioResourceGrant\(grantRequest\)\)\)/);
	const menuStart = clientSource.indexOf("async function showPreviewLinkMenu");
	const grantRequestStart = clientSource.indexOf("function getStudioResourceGrantRequest", menuStart);
	assert.ok(menuStart >= 0 && grantRequestStart > menuStart);
	const menuSource = clientSource.slice(menuStart, grantRequestStart);
	const menuPreflight = menuSource.indexOf('await fetchPreviewLocalLink("resolve", href, nextContext)');
	const firstMenuAction = menuSource.indexOf("appendPreviewLinkMenuButton", menuPreflight);
	assert.ok(menuPreflight >= 0 && firstMenuAction > menuPreflight, "Local-link access must be decided before an action menu can create a pending tab.");
	assert.match(menuSource, /const menuRequestId = \+\+previewLinkMenuRequestId/);
	assert.match(menuSource, /if \(menuRequestId !== previewLinkMenuRequestId\) return false/);
	assert.match(menuSource, /if \(!\(error && error\.studioCancelled\)\)/);

	const previewClickStart = clientSource.indexOf("function handlePreviewLocalLinkClick");
	const previewContextMenuStart = clientSource.indexOf("function handlePreviewLocalLinkContextMenu", previewClickStart);
	const previewClickSource = clientSource.slice(previewClickStart, previewContextMenuStart);
	assert.match(previewClickSource, /kind === "text" \|\| kind === "office"[\s\S]*void showPreviewLinkMenu\(anchor, event\)/);
	assert.doesNotMatch(previewClickSource, /openPreviewDocumentInNewEditor/);

	const htmlLinkStart = clientSource.indexOf("function handleHtmlArtifactFrameLocalLinkMessage");
	const htmlCommentStart = clientSource.indexOf("function handleHtmlArtifactFrameCommentTargetMessage", htmlLinkStart);
	const htmlLinkSource = clientSource.slice(htmlLinkStart, htmlCommentStart);
	assert.match(htmlLinkSource, /kind === "text" \|\| kind === "office"[\s\S]*void showPreviewLinkMenu\(null, point, context\)/);
	assert.doesNotMatch(htmlLinkSource, /openPreviewDocumentInNewEditor/);
	assert.match(clientSource, /if \(error && error\.studioCancelled\) \{\s*cancelPendingStudioTab\(launch, "Local resource access was cancelled\."\)/);
	const pdfOpenStart = clientSource.indexOf("async function openPreviewPdfLink");
	const imageOpenStart = clientSource.indexOf("async function openPreviewImageLink", pdfOpenStart);
	const editorContentCheckStart = clientSource.indexOf("function editorHasPotentialUnsavedContent", imageOpenStart);
	const pdfOpenSource = clientSource.slice(pdfOpenStart, imageOpenStart);
	const imageOpenSource = clientSource.slice(imageOpenStart, editorContentCheckStart);
	assert.match(pdfOpenSource, /await fetchPreviewLocalLink\("resolve", href, contextOverride\)/);
	assert.match(pdfOpenSource, /getPreviewPdfViewerUrl\(href, contextOverride\)/, "PDF actions should retry the original encoded href after granting it.");
	assert.match(imageOpenSource, /await fetchPreviewLocalLink\("resolve", href, contextOverride\)/);
	assert.match(imageOpenSource, /getPreviewLinkResourceQuery\(href, contextOverride\)/, "Image actions should retry the original encoded href after granting it.");
});

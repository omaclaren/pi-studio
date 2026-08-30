import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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

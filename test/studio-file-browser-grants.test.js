import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const indexSource = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../client/studio.css", import.meta.url), "utf8");

test("Files browsing is rooted in session directory grants", () => {
	const resolverStart = indexSource.indexOf("function resolveStudioFileBrowserDirectory");
	const listingStart = indexSource.indexOf("function listStudioFileBrowserDirectory", resolverStart);
	const htmlResourceStart = indexSource.indexOf("function resolveStudioHtmlPreviewResourcePath", listingStart);
	assert.ok(resolverStart >= 0 && listingStart > resolverStart && htmlResourceStart > listingStart);
	const resolverSource = indexSource.slice(resolverStart, listingStart);
	const listingSource = indexSource.slice(listingStart, htmlResourceStart);

	assert.match(resolverSource, /resourceGrants: StudioResourceGrantRegistry/);
	assert.match(resolverSource, /resourceGrants\.findGrant\(requestedRootReal/);
	assert.match(resolverSource, /!matchingRootGrant \|\| matchingRootGrant\.kind !== "directory"/);
	assert.match(resolverSource, /throw new StudioDirectoryGrantRequiredError\(requestedRootReal\)/);
	assert.match(resolverSource, /const rootReal = matchingRootGrant\.path/);
	assert.match(resolverSource, /isPathInsideOrEqualDirectory\(currentReal, rootReal\)/);
	assert.match(listingSource, /getStudioFileBrowserGrantLocations\(resourceGrants\)/);

	const routeStart = indexSource.indexOf('requestUrl.pathname === "/file-browser"');
	const openRouteStart = indexSource.indexOf('requestUrl.pathname === "/file-browser-open"', routeStart);
	const routeSource = indexSource.slice(routeStart, openRouteStart);
	assert.match(routeSource, /requestUrl\.searchParams\.get\("root"\)/);
	assert.match(routeSource, /studioResourceGrantRegistry/);
	assert.match(routeSource, /error instanceof StudioDirectoryGrantRequiredError/);
	assert.match(routeSource, /code: error\.code/);
	assert.match(routeSource, /getStudioFileBrowserGrantLocations\(studioResourceGrantRegistry\)/);
});

test("Files exposes allowed folders and exact files without promoting exact files to roots", () => {
	const locationsStart = indexSource.indexOf("function getStudioFileBrowserGrantLocations");
	const resolverStart = indexSource.indexOf("function resolveStudioFileBrowserDirectory", locationsStart);
	const locationsSource = indexSource.slice(locationsStart, resolverStart);
	assert.match(locationsSource, /grant\.kind !== "directory"/);
	assert.match(locationsSource, /currentReal === grant\.path && statSync\(currentReal\)\.isDirectory\(\)/);
	assert.match(locationsSource, /grant\.kind !== "file"/);
	assert.match(locationsSource, /directoryPaths\.some\(\(directoryPath\) => isPathInsideOrEqualDirectory\(grant\.path, directoryPath\)\)/);
	assert.match(locationsSource, /const currentReal = realpathSync\(grant\.path\)/);
	assert.match(locationsSource, /if \(currentReal !== grant\.path\) continue/);
	assert.match(locationsSource, /exactFiles\.push/);

	assert.match(clientSource, /data-files-location/);
	assert.match(clientSource, /data-files-action='allow-folder'/);
	assert.match(clientSource, /Allowed exact files/);
	assert.match(clientSource, /Exact-file grants do not expose their parent folders/);
	assert.match(clientSource, /body: JSON\.stringify\(\{ grantKind: "directory", path \}\)/);
	assert.match(clientSource, /loadFileBrowserDirectory\("", \{ root: grantedPath \}\)/);
	assert.match(clientSource, /if \(requestedRoot\) query\.root = requestedRoot/);
	assert.match(cssSource, /\.files-location-select/);
	assert.match(cssSource, /\.files-exact-section/);
});

test("Files has numeric and mnemonic direct-switch shortcuts", () => {
	assert.match(clientSource, /Digit6: "files"/);
	const filesShortcutStart = clientSource.indexOf("const isFilesShortcut");
	const sideQuestionsShortcutStart = clientSource.indexOf("const isSideQuestionsShortcut", filesShortcutStart);
	assert.ok(filesShortcutStart >= 0 && sideQuestionsShortcutStart > filesShortcutStart);
	const shortcutSource = clientSource.slice(filesShortcutStart, sideQuestionsShortcutStart);
	assert.match(shortcutSource, /code === "KeyF"/);
	assert.match(shortcutSource, /\(event\.metaKey \|\| event\.ctrlKey\)/);
	assert.match(shortcutSource, /event\.altKey/);
	assert.match(shortcutSource, /switchRightPaneToView\("files"\)/);
	assert.match(indexSource, /Cmd\/Ctrl\+Alt\+F<\/dt><dd>Switch the right pane directly to Files/);
});

test("Files new-tab actions authorize through the local-resource protocol", () => {
	const clickStart = clientSource.indexOf("async function handleFilesPaneClick");
	const gitContextStart = clientSource.indexOf("function getGitChangesContext", clickStart);
	assert.ok(clickStart >= 0 && gitContextStart > clickStart);
	const clickSource = clientSource.slice(clickStart, gitContextStart);
	assert.match(clickSource, /action === "open-new"[\s\S]*await openPreviewDocumentInNewEditor\(path, getFileBrowserLocalLinkContext\(\)\)/);
	assert.match(clickSource, /action === "open-preview-new"[\s\S]*await openPreviewResourceInNewEditor\(path, getFileBrowserLocalLinkContext\(\)\)/);
	assert.doesNotMatch(clickSource, /openFileBackedStudioEditorTab/);

	const folderOpenStart = clientSource.indexOf("async function openFileBrowserDirectoryInFileViewer");
	const changeStart = clientSource.indexOf("async function handleFilesPaneChange", folderOpenStart);
	const folderOpenSource = clientSource.slice(folderOpenStart, changeStart);
	assert.match(folderOpenSource, /if \(fileBrowserState\.rootDir\) body\.root = fileBrowserState\.rootDir/);
});

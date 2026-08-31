import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const serverSource = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../client/studio.css", import.meta.url), "utf8");

function functionBlock(source, name, nextName) {
  const start = source.indexOf("function " + name + "(");
  const end = source.indexOf("function " + nextName + "(", start + 1);
  assert.ok(start >= 0 && end > start, "Missing function block: " + name);
  return source.slice(start, end);
}

test("passive media routes require server-side session grants", () => {
  const pdfResolver = functionBlock(serverSource, "resolveStudioPdfResourcePath", "stripStudioHtmlPreviewResourceUrlSuffix");
  assert.match(pdfResolver, /if \(resourceGrants\)/);
  assert.match(pdfResolver, /resourceGrants\.allows\(candidateReal\)/);
  assert.match(pdfResolver, /throw new StudioResourceGrantRequiredError\(candidateReal, "pdf"\)/);

  const localResolver = functionBlock(serverSource, "resolveStudioLocalPreviewResourcePath", "getStudioFileBrowserGrantLocations");
  assert.match(localResolver, /const matchingGrant = resourceGrants\?\.findGrant\(candidateReal\)/);
  assert.match(localResolver, /if \(!matchingGrant\) throw new StudioResourceGrantRequiredError/);

  const mediaResolver = functionBlock(serverSource, "resolveStudioHtmlPreviewResourcePath", "resolveStudioAuthorizedPreviewRenderContext");
  assert.match(mediaResolver, /STUDIO_HTML_PREVIEW_MEDIA_MIME_BY_EXT/);
  assert.match(mediaResolver, /resourceGrants\.allows\(candidateReal\)/);
  assert.match(mediaResolver, /throw new StudioResourceGrantRequiredError\(candidateReal, kind\)/);
  assert.match(serverSource, /function decodeStudioLocalPreviewResourceReference\(/);
  assert.match(serverSource, /return fileURLToPath\(url\)/);
  assert.ok((serverSource.match(/decodeStudioLocalPreviewResourceReference\(rawPath\)/g) || []).length >= 3);

  const pdfRouteStart = serverSource.indexOf('requestUrl.pathname === "/pdf-resource"');
  const mediaRouteStart = serverSource.indexOf('requestUrl.pathname === "/html-preview-resource"', pdfRouteStart);
  const rootRouteStart = serverSource.indexOf('requestUrl.pathname !== "/"', mediaRouteStart);
  assert.ok(pdfRouteStart >= 0 && mediaRouteStart > pdfRouteStart && rootRouteStart > mediaRouteStart);
  assert.match(serverSource.slice(pdfRouteStart, rootRouteStart), /respondStudioResourceGrantRequiredJson\(res, error\)/);
});

test("interactive Pandoc rendering cannot embed media from a client-supplied directory", () => {
  const fileUrlNormalization = functionBlock(serverSource, "normalizeStudioMarkdownFileUrlDestinationsForPandoc", "prepareStudioMarkdownForPandoc");
  assert.match(fileUrlNormalization, /transformStudioMarkdownOutsideFences/);
  assert.match(fileUrlNormalization, /encodeStudioLocalFileUrlForPandoc/);

  const authorizedContext = functionBlock(serverSource, "resolveStudioAuthorizedPreviewRenderContext", "resolveStudioPandocWorkingDir");
  assert.match(authorizedContext, /resourceGrants\.findGrant\(resourcePath/);
  assert.match(authorizedContext, /directoryGrant\.kind !== "directory"/);

  const renderHandler = serverSource.slice(
    serverSource.indexOf("const handleRenderPreviewRequest = async"),
    serverSource.indexOf("const handleRenderMathRequest = async"),
  );
  assert.match(renderHandler, /resolveStudioAuthorizedPreviewRenderContext\(/);
  assert.match(renderHandler, /studioResourceGrantRegistry/);
  assert.match(renderHandler, /\{ embedResources: false \}/);

  const pandocRender = functionBlock(serverSource, "renderStudioMarkdownWithPandoc", "escapeStudioRegExpLiteral");
  assert.match(pandocRender, /options\?\.embedResources !== false/);
});

test("blocked passive media uses an explicit allow affordance without opening a dialog during render", () => {
  const hydration = functionBlock(clientSource, "hydrateStudioPreviewLocalMedia", "applyRenderedMarkdown");
  assert.match(hydration, /hydrateStudioPreviewLocalImages/);
  assert.match(hydration, /hydrateStudioPreviewLocalPdfEmbeds/);
  assert.match(hydration, /replaceStudioBlockedMediaElement/);
  assert.doesNotMatch(hydration, /requestStudioResourceGrant/);

  const blockedNotice = functionBlock(clientSource, "createStudioBlockedMediaNoticeForRequest", "replaceStudioBlockedMediaElement");
  assert.match(blockedNotice, /Local " \+ kind \+ " blocked/);
  assert.match(blockedNotice, /Allow local " \+ kind \+ "…/);
  assert.match(blockedNotice, /studioBlockedMediaPath/);

  const allowHandler = functionBlock(clientSource, "handleStudioBlockedMediaAllowButton", "hasMeaningfulPreviewContent");
  assert.match(allowHandler, /await requestStudioResourceGrant\(request\)/);
  assert.match(allowHandler, /refreshStudioPassiveMediaAfterGrant\(\)/);

  const pdfCard = functionBlock(clientSource, "createStudioPdfCard", "createAuthorizedStudioPdfCard");
  assert.match(pdfCard, /fetchPreviewLocalLink\("resolve", path, resourceQuery, \{ skipGrantPrompt: true \}\)/);
  assert.match(pdfCard, /createStudioBlockedMediaNotice\(error, "pdf", path\)/);
  assert.doesNotMatch(pdfCard, /requestStudioResourceGrant/);

  assert.match(cssSource, /\.rendered-markdown \.studio-blocked-media\s*\{/);
  assert.match(cssSource, /button\.studio-blocked-media-allow/);
});

test("authored HTML previews surface blocked local images in trusted outer UI", () => {
  const fetchResource = functionBlock(clientSource, "fetchHtmlArtifactResource", "renderHtmlArtifactBlockedResources");
  assert.match(fetchResource, /getStudioResourceGrantRequest\(error\)/);
  assert.match(fetchResource, /blocked: Boolean\(grantRequest\)/);

  const renderBlocked = functionBlock(clientSource, "renderHtmlArtifactBlockedResources", "syncHtmlArtifactBlockedResources");
  assert.match(renderBlocked, /studio-html-artifact-blocked-media/);
  assert.match(renderBlocked, /createStudioBlockedMediaNoticeForRequest/);

  assert.match(clientSource, /resourceState === 'true' \|\| resourceState === 'blocked' \|\| resourceState === 'failed'/);
  assert.match(clientSource, /data-pi-studio-html-resource-resolved'[\s\S]*result\.blocked === true \? 'blocked' : 'failed'/);
});

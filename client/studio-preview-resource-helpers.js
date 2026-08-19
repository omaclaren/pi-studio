(() => {
  const STUDIO_PREVIEW_LOCAL_IMAGE_LIMIT = 100;
  const STUDIO_PREVIEW_IMAGE_DATA_URL_PATTERN = /^data:image\/(?:png|jpeg|gif|webp);base64,/i;

  function isResolvableStudioPreviewImageSource(value) {
    const source = String(value || "").trim();
    if (!source || source.startsWith("#") || source.startsWith("//")) return false;
    if (/^(?:data|blob|https?|about|javascript):/i.test(source)) return false;
    if (/^[a-z][a-z0-9+.-]*:/i.test(source) && !/^[a-z]:[\\/]/i.test(source)) return false;
    return true;
  }

  function areStudioPreviewResourceContextsEqual(left, right) {
    const a = left && typeof left === "object" ? left : {};
    const b = right && typeof right === "object" ? right : {};
    return String(a.sourcePath || "") === String(b.sourcePath || "")
      && String(a.resourceDir || "") === String(b.resourceDir || "");
  }

  async function hydrateStudioPreviewLocalImages(target, resolveResource) {
    if (!target || typeof target.querySelectorAll !== "function" || typeof resolveResource !== "function") {
      return { attempted: 0, resolved: 0 };
    }

    const images = Array.from(target.querySelectorAll("img[src]"))
      .filter((image) => image && typeof image.getAttribute === "function" && isResolvableStudioPreviewImageSource(image.getAttribute("src")))
      .slice(0, STUDIO_PREVIEW_LOCAL_IMAGE_LIMIT);

    let resolved = 0;
    await Promise.all(images.map(async (image) => {
      const originalSource = String(image.getAttribute("src") || "").trim();
      try {
        const dataUrl = await resolveResource(originalSource);
        if (!STUDIO_PREVIEW_IMAGE_DATA_URL_PATTERN.test(String(dataUrl || ""))) return;
        if (image.isConnected === false || String(image.getAttribute("src") || "").trim() !== originalSource) return;
        image.setAttribute("src", dataUrl);
        resolved += 1;
      } catch {
        // Leave unresolved images unchanged so authored browser URLs retain their normal behavior.
      }
    }));

    return { attempted: images.length, resolved };
  }

  globalThis.PiStudioPreviewResourceHelpers = Object.freeze({
    STUDIO_PREVIEW_LOCAL_IMAGE_LIMIT,
    areStudioPreviewResourceContextsEqual,
    hydrateStudioPreviewLocalImages,
    isResolvableStudioPreviewImageSource,
  });
})();

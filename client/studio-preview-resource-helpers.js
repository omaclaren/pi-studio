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

  function buildStudioPdfVersionSignature(headers) {
    if (!headers || typeof headers.get !== "function") return "";
    const etag = String(headers.get("etag") || "").trim();
    const modified = String(headers.get("last-modified") || "").trim();
    const length = String(headers.get("content-length") || "").trim();
    if (!etag && !modified && !length) return "";
    return [etag, modified, length].join("\n");
  }

  function createStudioPdfVersionObservationState() {
    return {
      baseline: "",
      candidate: "",
      candidateCount: 0,
    };
  }

  function observeStudioPdfVersion(previousState, signature, stableObservations) {
    const state = previousState && typeof previousState === "object"
      ? previousState
      : createStudioPdfVersionObservationState();
    const nextSignature = String(signature || "").trim();
    const required = Math.max(2, Number.parseInt(String(stableObservations || "2"), 10) || 2);
    if (!nextSignature) return { state, changed: false };
    if (!state.baseline) {
      return {
        state: { baseline: nextSignature, candidate: "", candidateCount: 0 },
        changed: false,
      };
    }
    if (nextSignature === state.baseline) {
      return {
        state: { baseline: state.baseline, candidate: "", candidateCount: 0 },
        changed: false,
      };
    }
    const candidateCount = nextSignature === state.candidate ? state.candidateCount + 1 : 1;
    if (candidateCount < required) {
      return {
        state: { baseline: state.baseline, candidate: nextSignature, candidateCount },
        changed: false,
      };
    }
    return {
      state: { baseline: nextSignature, candidate: "", candidateCount: 0 },
      changed: true,
    };
  }

  globalThis.PiStudioPreviewResourceHelpers = Object.freeze({
    STUDIO_PREVIEW_LOCAL_IMAGE_LIMIT,
    areStudioPreviewResourceContextsEqual,
    buildStudioPdfVersionSignature,
    createStudioPdfVersionObservationState,
    hydrateStudioPreviewLocalImages,
    isResolvableStudioPreviewImageSource,
    observeStudioPdfVersion,
  });
})();

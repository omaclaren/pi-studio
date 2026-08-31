(() => {
  const STUDIO_PREVIEW_LOCAL_IMAGE_LIMIT = 100;
  const STUDIO_PREVIEW_LOCAL_PDF_LIMIT = 40;
  const STUDIO_PREVIEW_IMAGE_DATA_URL_PATTERN = /^data:image\/(?:png|jpeg|gif|webp);base64,/i;
  const STUDIO_PREVIEW_PDF_DATA_URL_PATTERN = /^data:application\/pdf;base64,/i;

  function isResolvableStudioPreviewImageSource(value) {
    const source = String(value || "").trim();
    if (!source || source.startsWith("#") || source.startsWith("//")) return false;
    if (/^(?:data|blob|https?|about|javascript):/i.test(source)) return false;
    if (/^file:/i.test(source)) {
      try {
        const fileUrl = new URL(source);
        return fileUrl.protocol === "file:" && (!fileUrl.hostname || fileUrl.hostname === "localhost");
      } catch {
        return false;
      }
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(source) && !/^[a-z]:[\\/]/i.test(source)) return false;
    return true;
  }

  function areStudioPreviewResourceContextsEqual(left, right) {
    const a = left && typeof left === "object" ? left : {};
    const b = right && typeof right === "object" ? right : {};
    return String(a.sourcePath || "") === String(b.sourcePath || "")
      && String(a.resourceDir || "") === String(b.resourceDir || "");
  }

  function isResolvableStudioPreviewPdfSource(value) {
    const source = String(value || "").trim();
    return isResolvableStudioPreviewImageSource(source) && /\.pdf(?:[?#].*)?$/i.test(source);
  }

  async function hydrateStudioPreviewLocalMediaElements(target, options) {
    const selector = options && options.selector;
    const sourceAllowed = options && options.sourceAllowed;
    const dataUrlAllowed = options && options.dataUrlAllowed;
    const resolveResource = options && options.resolveResource;
    const onError = options && options.onError;
    const limit = Math.max(1, Number(options && options.limit) || 1);
    if (!target || typeof target.querySelectorAll !== "function" || typeof resolveResource !== "function") {
      return { attempted: 0, resolved: 0 };
    }

    const elements = Array.from(target.querySelectorAll(selector))
      .filter((element) => element && typeof element.getAttribute === "function" && sourceAllowed(element.getAttribute("src")))
      .slice(0, limit);

    let resolved = 0;
    await Promise.all(elements.map(async (element) => {
      const originalSource = String(element.getAttribute("src") || "").trim();
      try {
        const dataUrl = await resolveResource(originalSource);
        if (!dataUrlAllowed.test(String(dataUrl || ""))) throw new Error("Studio returned an unsupported local media payload.");
        if (element.isConnected === false || String(element.getAttribute("src") || "").trim() !== originalSource) return;
        element.setAttribute("src", dataUrl);
        resolved += 1;
      } catch (error) {
        if (element.isConnected === false || String(element.getAttribute("src") || "").trim() !== originalSource) return;
        if (typeof onError === "function") {
          try { await onError(element, originalSource, error); } catch {}
        }
      }
    }));

    return { attempted: elements.length, resolved };
  }

  async function hydrateStudioPreviewLocalImages(target, resolveResource, options) {
    return hydrateStudioPreviewLocalMediaElements(target, {
      selector: "img[src]",
      sourceAllowed: isResolvableStudioPreviewImageSource,
      dataUrlAllowed: STUDIO_PREVIEW_IMAGE_DATA_URL_PATTERN,
      resolveResource,
      onError: options && options.onError,
      limit: STUDIO_PREVIEW_LOCAL_IMAGE_LIMIT,
    });
  }

  async function hydrateStudioPreviewLocalPdfEmbeds(target, resolveResource, options) {
    return hydrateStudioPreviewLocalMediaElements(target, {
      selector: "embed[src]",
      sourceAllowed: isResolvableStudioPreviewPdfSource,
      dataUrlAllowed: STUDIO_PREVIEW_PDF_DATA_URL_PATTERN,
      resolveResource,
      onError: options && options.onError,
      limit: STUDIO_PREVIEW_LOCAL_PDF_LIMIT,
    });
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
    STUDIO_PREVIEW_LOCAL_PDF_LIMIT,
    areStudioPreviewResourceContextsEqual,
    buildStudioPdfVersionSignature,
    createStudioPdfVersionObservationState,
    hydrateStudioPreviewLocalImages,
    hydrateStudioPreviewLocalPdfEmbeds,
    isResolvableStudioPreviewImageSource,
    isResolvableStudioPreviewPdfSource,
    observeStudioPdfVersion,
  });
})();

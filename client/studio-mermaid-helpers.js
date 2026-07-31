(() => {
  const MERMAID_VERSION = "11.16.0";
  const MERMAID_CDN_URL = "https://cdn.jsdelivr.net/npm/mermaid@" + MERMAID_VERSION + "/dist/mermaid.esm.min.mjs";
  const ICON_PACKS = Object.freeze([
    Object.freeze({
      name: "lucide",
      url: "https://cdn.jsdelivr.net/npm/@iconify-json/lucide@1.2.120/icons.json",
    }),
    Object.freeze({
      name: "logos",
      url: "https://cdn.jsdelivr.net/npm/@iconify-json/logos@1.2.11/icons.json",
    }),
  ]);
  const MINIMUM_TEXT_CONTRAST = 4.5;

  function normalizeError(error) {
    return error instanceof Error ? error : new Error(String(error));
  }

  function parseRgb(value) {
    const match = String(value || "").match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
  }

  function isOpaqueColor(value) {
    if (!parseRgb(value)) return false;
    const alphaMatch = String(value || "").match(/^rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)$/);
    return !alphaMatch || Number(alphaMatch[1]) >= 1;
  }

  function relativeLuminance(color) {
    const linear = color.map(function(channel) {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  }

  function contrastRatio(foreground, background) {
    const foregroundRgb = Array.isArray(foreground) ? foreground : parseRgb(foreground);
    const backgroundRgb = Array.isArray(background) ? background : parseRgb(background);
    if (!foregroundRgb || !backgroundRgb) return 1;
    const lighter = Math.max(relativeLuminance(foregroundRgb), relativeLuminance(backgroundRgb));
    const darker = Math.min(relativeLuminance(foregroundRgb), relativeLuminance(backgroundRgb));
    return (lighter + 0.05) / (darker + 0.05);
  }

  function toRgb(color) {
    return "rgb(" + color.map(function(channel) { return Math.round(channel); }).join(", ") + ")";
  }

  function ensureReadableColor(foregroundCss, backgroundCss, minimumContrast) {
    const foreground = parseRgb(foregroundCss);
    const background = parseRgb(backgroundCss);
    const targetContrast = Number.isFinite(minimumContrast) ? minimumContrast : MINIMUM_TEXT_CONTRAST;
    if (!foreground || !background || contrastRatio(foreground, background) >= targetContrast) {
      return foregroundCss;
    }

    const readableCandidates = [[0, 0, 0], [255, 255, 255]].flatMap(function(target) {
      for (let step = 1; step <= 20; step += 1) {
        const amount = step / 20;
        const color = foreground.map(function(channel, index) {
          return channel + (target[index] - channel) * amount;
        });
        if (contrastRatio(color, background) >= targetContrast) return [{ amount: amount, color: color }];
      }
      return [];
    });
    readableCandidates.sort(function(left, right) { return left.amount - right.amount; });
    if (readableCandidates.length > 0) return toRgb(readableCandidates[0].color);

    const black = [0, 0, 0];
    const white = [255, 255, 255];
    return toRgb(contrastRatio(black, background) >= contrastRatio(white, background) ? black : white);
  }

  function createIconPackRegistry(options) {
    const config = options && typeof options === "object" ? options : {};
    const packs = Array.isArray(config.packs) ? config.packs : ICON_PACKS;
    const fetchImpl = typeof config.fetch === "function"
      ? config.fetch
      : (typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : null);
    const pending = new Map();
    let loadError = null;
    let registeredApi = null;

    function load(pack) {
      if (!fetchImpl) {
        const error = new Error("Browser fetch API is unavailable for Mermaid icon packs.");
        loadError = error;
        return Promise.reject(error);
      }
      if (!pending.has(pack.name)) {
        const request = Promise.resolve()
          .then(function() { return fetchImpl(pack.url); })
          .then(function(response) {
            if (!response || !response.ok) {
              const status = response && Number.isFinite(response.status) ? response.status : "unknown";
              throw new Error("Failed to load Mermaid icon pack " + pack.name + ": HTTP " + status);
            }
            return response.json();
          })
          .catch(function(error) {
            const normalized = normalizeError(error);
            loadError = normalized;
            pending.delete(pack.name);
            throw normalized;
          });
        pending.set(pack.name, request);
      }
      return pending.get(pack.name);
    }

    function register(mermaidApi) {
      if (registeredApi === mermaidApi) return;
      if (!mermaidApi || typeof mermaidApi.registerIconPacks !== "function") {
        throw new Error("This Mermaid build does not support registered icon packs.");
      }
      mermaidApi.registerIconPacks(packs.map(function(pack) {
        return { name: pack.name, loader: function() { return load(pack); } };
      }));
      registeredApi = mermaidApi;
    }

    return Object.freeze({
      clearError: function() { loadError = null; },
      getError: function() { return loadError; },
      register: register,
    });
  }

  function getDomContext(root) {
    const documentRef = root && root.ownerDocument
      ? root.ownerDocument
      : (typeof document === "object" ? document : null);
    const windowRef = documentRef && documentRef.defaultView
      ? documentRef.defaultView
      : (typeof window === "object" ? window : null);
    if (!documentRef || !windowRef || typeof windowRef.getComputedStyle !== "function") return null;
    return {
      documentRef: documentRef,
      windowRef: windowRef,
      ElementCtor: windowRef.Element,
      HTMLElementCtor: windowRef.HTMLElement,
      getStyle: windowRef.getComputedStyle.bind(windowRef),
    };
  }

  function findOpaqueFill(root, context) {
    if (!context || !(root instanceof context.ElementCtor)) return null;
    const shape = Array.from(root.querySelectorAll("rect, polygon, path, circle, ellipse")).find(function(candidate) {
      return isOpaqueColor(context.getStyle(candidate).fill);
    });
    return shape ? context.getStyle(shape).fill : null;
  }

  function findOpaqueBackground(element, fallback, context) {
    if (!context) return fallback;
    let current = element instanceof context.ElementCtor ? element : null;
    while (current) {
      const background = context.getStyle(current).backgroundColor;
      if (current instanceof context.HTMLElementCtor && isOpaqueColor(background)) return background;
      current = current.parentElement;
    }
    return fallback;
  }

  function applyAccessibleColors(root) {
    if (!root || typeof root.querySelectorAll !== "function") return { iconNodes: 0, shapeNodes: 0 };
    const context = getDomContext(root);
    if (!context) return { iconNodes: 0, shapeNodes: 0 };
    const body = context.documentRef.body;
    const pageBackground = body ? context.getStyle(body).backgroundColor : "rgb(255, 255, 255)";
    let iconNodes = 0;
    let shapeNodes = 0;

    root.querySelectorAll(".mermaid-container .icon-shape").forEach(function(node) {
      const icon = node.querySelector("svg");
      if (!icon) return;
      iconNodes += 1;
      const semanticColor = context.getStyle(icon).color;
      const iconSurface = findOpaqueFill(node.firstElementChild, context)
        || findOpaqueBackground(icon, pageBackground, context);
      const iconColor = ensureReadableColor(semanticColor, iconSurface);
      icon.style.setProperty("color", iconColor, "important");
      icon.querySelectorAll("g, path, rect, polygon, circle, ellipse, line, polyline").forEach(function(paintedElement) {
        const paintedStyle = context.getStyle(paintedElement);
        if (isOpaqueColor(paintedStyle.fill)) {
          paintedElement.style.setProperty("fill", ensureReadableColor(paintedStyle.fill, iconSurface), "important");
        }
        if (isOpaqueColor(paintedStyle.stroke)) {
          paintedElement.style.setProperty("stroke", ensureReadableColor(paintedStyle.stroke, iconSurface), "important");
        }
      });
      node.querySelectorAll(".labelBkg, .nodeLabel").forEach(function(label) {
        if (!(label instanceof context.HTMLElementCtor)) return;
        const labelSurface = findOpaqueBackground(label, pageBackground, context);
        const labelColor = ensureReadableColor(semanticColor, labelSurface);
        label.style.setProperty("color", labelColor, "important");
      });
    });

    root.querySelectorAll(".mermaid-container .node:not(.icon-shape)").forEach(function(node) {
      const shape = Array.from(node.querySelectorAll("rect, polygon, path, circle, ellipse")).find(function(candidate) {
        const fill = context.getStyle(candidate).fill;
        return fill && fill !== "none" && fill !== "rgba(0, 0, 0, 0)";
      });
      if (!shape) return;
      shapeNodes += 1;
      const shapeFill = context.getStyle(shape).fill;
      node.querySelectorAll(".nodeLabel").forEach(function(label) {
        if (!(label instanceof context.HTMLElementCtor)) return;
        const labelColor = ensureReadableColor(context.getStyle(label).color, shapeFill);
        label.style.setProperty("color", labelColor, "important");
      });
    });

    return { iconNodes: iconNodes, shapeNodes: shapeNodes };
  }

  function getFailedIconPackName(message) {
    const match = String(message || "").match(/Mermaid icon pack\s+(lucide|logos)\b/i);
    return match ? match[1].toLowerCase() : null;
  }

  function sourceUsesIconPack(source, packName) {
    if (!packName) return false;
    const escapedName = packName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("\\bicon\\s*:\\s*[\\\"']" + escapedName + ":", "i").test(String(source || ""));
  }

  function renderFailures(wrappers, error) {
    const message = normalizeError(error).message;
    const failedIconPack = getFailedIconPackName(message);
    Array.from(wrappers || []).forEach(function(wrapper) {
      if (!wrapper || typeof wrapper.querySelector !== "function") return;
      const diagram = wrapper.querySelector(".mermaid");
      const documentRef = wrapper.ownerDocument || (typeof document === "object" ? document : null);
      if (!diagram || !documentRef) return;
      const source = wrapper.dataset && typeof wrapper.dataset.mermaidSource === "string"
        ? wrapper.dataset.mermaidSource
        : "";
      const hasRenderedSvg = Boolean(diagram.querySelector("svg"));
      if (hasRenderedSvg && !sourceUsesIconPack(source, failedIconPack)) return;
      const failure = documentRef.createElement("pre");
      failure.className = "mermaid-error";
      failure.setAttribute("role", "alert");
      failure.textContent = "Mermaid render failed: " + message + (source ? "\n\n" + source : "");
      diagram.replaceWith(failure);
    });
    return message;
  }

  globalThis.PiStudioMermaidHelpers = Object.freeze({
    ICON_PACKS: ICON_PACKS,
    MERMAID_CDN_URL: MERMAID_CDN_URL,
    MERMAID_VERSION: MERMAID_VERSION,
    MINIMUM_TEXT_CONTRAST: MINIMUM_TEXT_CONTRAST,
    applyAccessibleColors: applyAccessibleColors,
    contrastRatio: contrastRatio,
    createIconPackRegistry: createIconPackRegistry,
    ensureReadableColor: ensureReadableColor,
    parseRgb: parseRgb,
    renderFailures: renderFailures,
  });
})();

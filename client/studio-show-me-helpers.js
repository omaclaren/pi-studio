(() => {
  const STUDIO_SHOW_ME_SOURCE_MAX_CHARS = 16_000;

  function truncateSource(value, maxChars) {
    const source = String(value || "").trim();
    const limit = Math.max(256, Math.floor(Number(maxChars) || STUDIO_SHOW_ME_SOURCE_MAX_CHARS));
    if (source.length <= limit) {
      return { text: source, truncated: false, omittedChars: 0 };
    }

    let omittedChars = Math.max(1, source.length - limit);
    let marker = "";
    let headChars = 0;
    let tailChars = 0;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      marker = "\n\n[Pi Studio omitted " + omittedChars.toLocaleString("en-US") + " characters from the middle of this source.]\n\n";
      const contentBudget = Math.max(2, limit - marker.length);
      headChars = Math.ceil(contentBudget * 0.6);
      tailChars = Math.max(1, contentBudget - headChars);
      const nextOmitted = Math.max(1, source.length - headChars - tailChars);
      if (nextOmitted === omittedChars) break;
      omittedChars = nextOmitted;
    }

    return {
      text: (source.slice(0, headChars).trimEnd() + marker + source.slice(-tailChars).trimStart()).slice(0, limit),
      truncated: true,
      omittedChars: omittedChars,
    };
  }

  function chooseStudioShowMeFocus(options) {
    const input = options && typeof options === "object" ? options : {};
    const target = input.target === "response" ? "response" : "editor";
    const selectionText = String(input.selectionText || "");
    const responseText = String(input.responseText || "");
    const responseVisible = input.responseVisible === true;
    const editorText = String(input.editorText || "");
    const responseIndex = Math.max(0, Math.floor(Number(input.responseIndex) || 0));
    const responseTotal = Math.max(0, Math.floor(Number(input.responseTotal) || 0));

    if (target === "response") {
      if (!responseVisible || !responseText.trim()) return null;
      const bounded = truncateSource(responseText);
      const historySuffix = responseIndex > 0 && responseTotal > 0
        ? " " + responseIndex + "/" + responseTotal
        : "";
      return {
        sourceKind: "response",
        sourceLabel: "displayed Studio response" + historySuffix,
        sourceText: bounded.text,
        truncated: bounded.truncated,
        actionLabel: "Explain displayed response",
      };
    }

    if (selectionText.trim()) {
      const bounded = truncateSource(selectionText);
      return {
        sourceKind: "selection",
        sourceLabel: "Studio editor selection",
        sourceText: bounded.text,
        truncated: bounded.truncated,
        actionLabel: "Explain selection",
      };
    }

    if (editorText.trim()) {
      const bounded = truncateSource(editorText);
      return {
        sourceKind: "editor",
        sourceLabel: "Studio editor document",
        sourceText: bounded.text,
        truncated: bounded.truncated,
        actionLabel: "Explain editor document",
      };
    }

    return {
      sourceKind: "context",
      sourceLabel: "current conversation topic",
      sourceText: "",
      truncated: false,
      actionLabel: "Explain current topic",
    };
  }

  globalThis.PiStudioShowMeHelpers = Object.freeze({
    STUDIO_SHOW_ME_SOURCE_MAX_CHARS: STUDIO_SHOW_ME_SOURCE_MAX_CHARS,
    chooseStudioShowMeFocus: chooseStudioShowMeFocus,
    truncateSource: truncateSource,
  });
})();

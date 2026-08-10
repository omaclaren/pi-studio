(() => {
  const PANE_FOCUS_PARAM = "paneFocus";
  const PANE_FOCUS_OFF = "off";
  const PANE_FOCUS_TARGETS = Object.freeze(["left", "right"]);

  function normalizePaneFocusTarget(value) {
    return value === "left" || value === "right" ? value : PANE_FOCUS_OFF;
  }

  function readPaneFocusTarget(locationLike) {
    try {
      const search = locationLike && typeof locationLike.search === "string"
        ? locationLike.search
        : "";
      return normalizePaneFocusTarget(new URLSearchParams(search).get(PANE_FOCUS_PARAM));
    } catch {
      return PANE_FOCUS_OFF;
    }
  }

  function buildPaneFocusUrl(href, target) {
    const url = new URL(String(href || ""));
    const normalized = normalizePaneFocusTarget(target);
    if (normalized === PANE_FOCUS_OFF) {
      url.searchParams.delete(PANE_FOCUS_PARAM);
    } else {
      url.searchParams.set(PANE_FOCUS_PARAM, normalized);
    }
    return url.toString();
  }

  function replacePaneFocusUrlState(windowLike, target) {
    if (!windowLike || !windowLike.location || !windowLike.history) return false;
    if (typeof windowLike.history.replaceState !== "function") return false;
    const currentHref = String(windowLike.location.href || "");
    const nextHref = buildPaneFocusUrl(currentHref, target);
    if (nextHref === currentHref) return false;
    windowLike.history.replaceState(windowLike.history.state, "", nextHref);
    return true;
  }

  globalThis.PiStudioNavigationHelpers = Object.freeze({
    PANE_FOCUS_OFF,
    PANE_FOCUS_PARAM,
    PANE_FOCUS_TARGETS,
    buildPaneFocusUrl,
    normalizePaneFocusTarget,
    readPaneFocusTarget,
    replacePaneFocusUrlState,
  });
})();

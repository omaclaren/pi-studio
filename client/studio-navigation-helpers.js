(() => {
  const PANE_FOCUS_PARAM = "paneFocus";
  const PANE_FOCUS_OFF = "off";
  const PANE_FOCUS_TARGETS = Object.freeze(["left", "right"]);
  const STUDIO_LAUNCH_PROTOCOL_VERSION = 1;
  const STUDIO_LAUNCH_CHANNEL_PREFIX = "pi-studio-launch-v1:";
  const STUDIO_PENDING_KINDS = Object.freeze(["document", "preview", "export"]);
  const STUDIO_LAUNCH_ID_PATTERN = /^[a-zA-Z0-9_-]{20,128}$/;
  const STUDIO_LAUNCH_TARGET_MAX_CHARS = 16_384;
  const STUDIO_LAUNCH_MESSAGE_MAX_CHARS = 1_000;
  const STUDIO_LAUNCH_READY_TIMEOUT_MS = 3_000;
  const STUDIO_LAUNCH_DELIVERY_TIMEOUT_MS = 15_000;
  const STUDIO_PENDING_STILL_WAITING_MS = 15_000;

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

  function normalizeStudioPendingKind(value) {
    return STUDIO_PENDING_KINDS.includes(value) ? value : null;
  }

  function isValidStudioLaunchId(value) {
    return typeof value === "string" && STUDIO_LAUNCH_ID_PATTERN.test(value);
  }

  function makeStudioLaunchId(cryptoLike) {
    if (!cryptoLike || typeof cryptoLike !== "object") {
      throw new Error("Secure browser randomness is unavailable.");
    }
    if (typeof cryptoLike.randomUUID === "function") {
      const candidate = String(cryptoLike.randomUUID()).replace(/[^a-zA-Z0-9_-]/g, "_");
      if (isValidStudioLaunchId(candidate)) return candidate;
    }
    if (typeof cryptoLike.getRandomValues === "function") {
      const bytes = new Uint8Array(24);
      cryptoLike.getRandomValues(bytes);
      const candidate = "launch_" + Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
      if (isValidStudioLaunchId(candidate)) return candidate;
    }
    throw new Error("Secure browser randomness is unavailable.");
  }

  function studioLaunchChannelName(launchId) {
    if (!isValidStudioLaunchId(launchId)) throw new Error("Invalid Studio launch ID.");
    return STUDIO_LAUNCH_CHANNEL_PREFIX + launchId;
  }

  function buildPendingStudioUrl(token, launchId, kind) {
    const cleanToken = typeof token === "string" ? token : "";
    const cleanKind = normalizeStudioPendingKind(kind);
    if (!cleanToken || cleanToken.length > 256) throw new Error("Missing or invalid Studio token.");
    if (!isValidStudioLaunchId(launchId)) throw new Error("Invalid Studio launch ID.");
    if (!cleanKind) throw new Error("Invalid Studio pending-page kind.");
    return "/studio-open-pending?" + new URLSearchParams({
      token: cleanToken,
      launchId,
      kind: cleanKind,
    }).toString();
  }

  function normalizeStudioLaunchMessage(value, fallback) {
    const compact = String(value || fallback || "Studio could not complete this tab launch.")
      .replace(/\s+/g, " ")
      .trim();
    if (!compact) return "Studio could not complete this tab launch.";
    return compact.slice(0, STUDIO_LAUNCH_MESSAGE_MAX_CHARS);
  }

  function normalizeStudioRelativeTarget(target, locationLike, token) {
    if (typeof target !== "string" || target.length < 1 || target.length > STUDIO_LAUNCH_TARGET_MAX_CHARS) {
      throw new Error("Studio returned an invalid tab target.");
    }
    if (!(target === "/" || target.startsWith("/?") || target.startsWith("/#"))) {
      throw new Error("Studio tab targets must be relative root URLs.");
    }
    if (target.includes("\\") || /[\u0000-\u001f\u007f]/.test(target)) {
      throw new Error("Studio returned an invalid tab target.");
    }
    const baseHref = locationLike && typeof locationLike.href === "string" ? locationLike.href : "";
    const baseUrl = new URL(baseHref);
    if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
      throw new Error("Studio tab targets require an HTTP(S) origin.");
    }
    const parsed = new URL(target, baseUrl);
    if (parsed.origin !== baseUrl.origin || parsed.protocol !== baseUrl.protocol) {
      throw new Error("Studio tab targets must stay on the current origin.");
    }
    if (parsed.username || parsed.password || parsed.pathname !== "/") {
      throw new Error("Studio returned an invalid tab target.");
    }
    const targetTokens = parsed.searchParams.getAll("token");
    if (targetTokens.length !== 1 || targetTokens[0] !== token) {
      throw new Error("Studio tab target token did not match this session.");
    }
    return parsed.pathname + parsed.search + parsed.hash;
  }

  function openStudioTabDirect(windowLike, targetUrl) {
    if (!windowLike || typeof windowLike.open !== "function") {
      throw new Error("Opening browser tabs is unavailable.");
    }
    const target = String(targetUrl || "").trim();
    if (!target) throw new Error("Missing browser tab target.");
    windowLike.open(target, "_blank", "noopener");
  }

  function canOpenPendingStudioLaunch(windowLike) {
    return Boolean(
      windowLike
      && typeof windowLike.open === "function"
      && typeof windowLike.BroadcastChannel === "function"
      && windowLike.crypto
      && (
        typeof windowLike.crypto.randomUUID === "function"
        || typeof windowLike.crypto.getRandomValues === "function"
      )
    );
  }

  function addChannelMessageListener(channel, listener) {
    if (channel && typeof channel.addEventListener === "function") {
      channel.addEventListener("message", listener);
      return () => {
        if (typeof channel.removeEventListener === "function") channel.removeEventListener("message", listener);
      };
    }
    if (channel) channel.onmessage = listener;
    return () => {
      if (channel && channel.onmessage === listener) channel.onmessage = null;
    };
  }

  function createPendingStudioLaunch(options) {
    const config = options && typeof options === "object" ? options : {};
    const windowLike = config.window || (typeof window === "object" ? window : null);
    const token = typeof config.token === "string" ? config.token : "";
    const kind = normalizeStudioPendingKind(config.kind);
    if (!kind) throw new Error("Invalid Studio pending-page kind.");
    if (!token || token.length > 256) throw new Error("Missing or invalid Studio token.");
    if (!canOpenPendingStudioLaunch(windowLike)) {
      throw new Error("This browser does not support asynchronously prepared Studio tabs. Update the browser and try again.");
    }

    const launchId = makeStudioLaunchId(windowLike.crypto);
    const pendingUrl = buildPendingStudioUrl(token, launchId, kind);
    const channel = new windowLike.BroadcastChannel(studioLaunchChannelName(launchId));
    const setTimer = typeof windowLike.setTimeout === "function" ? windowLike.setTimeout.bind(windowLike) : setTimeout;
    const clearTimer = typeof windowLike.clearTimeout === "function" ? windowLike.clearTimeout.bind(windowLike) : clearTimeout;
    const readyTimeoutMs = Math.max(100, Number(config.readyTimeoutMs) || STUDIO_LAUNCH_READY_TIMEOUT_MS);
    const deliveryTimeoutMs = Math.max(100, Number(config.deliveryTimeoutMs) || STUDIO_LAUNCH_DELIVERY_TIMEOUT_MS);
    let state = "waiting";
    let ready = false;
    let terminal = null;
    let readyTimer = null;
    let deliveryTimer = null;
    let removeMessageListener = null;
    let cleaned = false;
    let controller = null;

    function emit(event, detail) {
      if (typeof config.onEvent !== "function") return;
      try {
        config.onEvent(event, {
          launchId,
          kind,
          state,
          terminalType: terminal ? terminal.type : null,
          ...(detail && typeof detail === "object" ? detail : {}),
        });
      } catch {
        // Ignore observer errors so they cannot break launch delivery.
      }
    }

    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      if (readyTimer !== null) clearTimer(readyTimer);
      if (deliveryTimer !== null) clearTimer(deliveryTimer);
      readyTimer = null;
      deliveryTimer = null;
      if (removeMessageListener) removeMessageListener();
      removeMessageListener = null;
      try { channel.close(); } catch {}
    }

    function protocolMessage(type, extra) {
      return {
        protocol: STUDIO_LAUNCH_PROTOCOL_VERSION,
        type,
        launchId,
        ...(extra && typeof extra === "object" ? extra : {}),
      };
    }

    function postTerminal() {
      if (!ready || !terminal || state === "accepted" || state === "abandoned") return false;
      state = "terminal-sent";
      try {
        channel.postMessage(protocolMessage(terminal.type, terminal.payload));
        emit("terminal-sent");
        return true;
      } catch (error) {
        emit("terminal-send-error", { message: normalizeStudioLaunchMessage(error && error.message, "Could not deliver Studio tab result.") });
        return false;
      }
    }

    function beginDeliveryTimeout() {
      if (deliveryTimer !== null) clearTimer(deliveryTimer);
      deliveryTimer = setTimer(() => {
        deliveryTimer = null;
        if (state === "accepted" || state === "abandoned") return;
        state = "abandoned";
        emit("delivery-timeout");
        if (typeof config.onDeliveryTimeout === "function") {
          try { config.onDeliveryTimeout(controller); } catch {}
        }
        cleanup();
      }, deliveryTimeoutMs);
    }

    function setTerminal(type, payload) {
      if (terminal || state === "accepted" || state === "abandoned") return false;
      terminal = { type, payload: payload || {} };
      emit("terminal-queued");
      beginDeliveryTimeout();
      if (ready) postTerminal();
      return true;
    }

    function handleMessage(event) {
      const message = event && event.data;
      if (!message || typeof message !== "object") return;
      if (message.protocol !== STUDIO_LAUNCH_PROTOCOL_VERSION || message.launchId !== launchId) return;
      if (message.type === "ready") {
        if (state === "accepted" || state === "abandoned") return;
        const firstReady = !ready;
        ready = true;
        if (readyTimer !== null) clearTimer(readyTimer);
        readyTimer = null;
        if (!terminal) state = "ready";
        if (firstReady) {
          emit("ready");
          if (typeof config.onReady === "function") {
            try { config.onReady(controller); } catch {}
          }
        }
        if (terminal) postTerminal();
        return;
      }
      if (message.type !== "accepted" || !terminal || state !== "terminal-sent") return;
      if (message.terminalType !== terminal.type) return;
      state = "accepted";
      const acceptedOk = message.ok !== false;
      emit("accepted", { ok: acceptedOk });
      if (typeof config.onAccepted === "function") {
        try { config.onAccepted({ controller, ok: acceptedOk, terminalType: terminal.type }); } catch {}
      }
      cleanup();
    }

    removeMessageListener = addChannelMessageListener(channel, handleMessage);
    readyTimer = setTimer(() => {
      readyTimer = null;
      if (ready || state === "accepted" || state === "abandoned") return;
      emit("ready-timeout");
      if (typeof config.onReadyTimeout === "function") {
        try { config.onReadyTimeout(controller); } catch {}
      }
    }, readyTimeoutMs);

    controller = Object.freeze({
      launchId,
      kind,
      navigate(target) {
        const normalizedTarget = normalizeStudioRelativeTarget(target, windowLike.location, token);
        return setTerminal("navigate", { target: normalizedTarget });
      },
      fail(message) {
        return setTerminal("error", { message: normalizeStudioLaunchMessage(message) });
      },
      cancel(message) {
        return setTerminal("cancel", { message: normalizeStudioLaunchMessage(message, "Studio tab launch was cancelled.") });
      },
      abandon(message) {
        if (state === "accepted" || state === "abandoned") return false;
        if (ready && !terminal) {
          try {
            channel.postMessage(protocolMessage("cancel", {
              message: normalizeStudioLaunchMessage(message, "The originating Studio page was closed."),
            }));
          } catch {}
        }
        state = "abandoned";
        emit("abandoned");
        cleanup();
        return true;
      },
      getSnapshot() {
        return Object.freeze({
          launchId,
          kind,
          state,
          ready,
          terminalType: terminal ? terminal.type : null,
        });
      },
    });

    emit("created");
    try {
      windowLike.open(pendingUrl, "_blank", "noopener");
      emit("open-requested");
    } catch (error) {
      state = "abandoned";
      emit("open-error", { message: normalizeStudioLaunchMessage(error && error.message, "Browser tab open failed.") });
      if (typeof config.onOpenError === "function") {
        try { config.onOpenError(error, controller); } catch {}
      }
      cleanup();
      throw error;
    }
    return controller;
  }

  function startStudioPendingPage(windowLike, documentLike, options) {
    const config = options && typeof options === "object" ? options : {};
    const launchId = typeof config.launchId === "string" ? config.launchId : "";
    const kind = normalizeStudioPendingKind(config.kind);
    const token = typeof config.token === "string" ? config.token : "";
    const titleEl = documentLike && typeof documentLike.getElementById === "function"
      ? documentLike.getElementById("pendingTitle")
      : null;
    const detailEl = documentLike && typeof documentLike.getElementById === "function"
      ? documentLike.getElementById("pendingDetail")
      : null;
    const closeBtn = documentLike && typeof documentLike.getElementById === "function"
      ? documentLike.getElementById("pendingCloseBtn")
      : null;

    function render(title, detail, showClose) {
      if (titleEl) titleEl.textContent = title;
      if (detailEl) detailEl.textContent = detail;
      if (closeBtn) closeBtn.hidden = !showClose;
    }

    if (!windowLike || typeof windowLike.BroadcastChannel !== "function" || !isValidStudioLaunchId(launchId) || !kind || !token) {
      render("Could not prepare Studio tab", "This pending-tab request was invalid. Return to Studio and try again.", true);
      return null;
    }

    const channel = new windowLike.BroadcastChannel(studioLaunchChannelName(launchId));
    const setTimer = typeof windowLike.setTimeout === "function" ? windowLike.setTimeout.bind(windowLike) : setTimeout;
    const clearTimer = typeof windowLike.clearTimeout === "function" ? windowLike.clearTimeout.bind(windowLike) : clearTimeout;
    let terminalHandled = false;
    let closed = false;
    let waitingTimer = null;
    let removeMessageListener = null;

    function post(type, extra) {
      channel.postMessage({
        protocol: STUDIO_LAUNCH_PROTOCOL_VERSION,
        type,
        launchId,
        ...(extra && typeof extra === "object" ? extra : {}),
      });
    }

    function cleanup() {
      if (closed) return;
      closed = true;
      if (waitingTimer !== null) clearTimer(waitingTimer);
      waitingTimer = null;
      if (removeMessageListener) removeMessageListener();
      removeMessageListener = null;
      try { channel.close(); } catch {}
    }

    function acknowledge(terminalType, ok) {
      try { post("accepted", { terminalType, ok }); } catch {}
    }

    function handleMessage(event) {
      const message = event && event.data;
      if (!message || typeof message !== "object" || terminalHandled) return;
      if (message.protocol !== STUDIO_LAUNCH_PROTOCOL_VERSION || message.launchId !== launchId) return;
      if (message.type === "navigate") {
        terminalHandled = true;
        let relativeTarget = "";
        try {
          relativeTarget = normalizeStudioRelativeTarget(message.target, windowLike.location, token);
        } catch {
          acknowledge("navigate", false);
          render("Could not open Studio tab", "Studio rejected an invalid or unsafe navigation target.", true);
          setTimer(cleanup, 50);
          return;
        }
        acknowledge("navigate", true);
        render("Opening Studio tab…", "The requested Studio view is ready.", false);
        setTimer(() => {
          cleanup();
          try {
            windowLike.location.replace(relativeTarget);
          } catch {
            render("Could not open Studio tab", "The browser could not navigate this pending tab.", true);
          }
        }, 20);
        return;
      }
      if (message.type === "error") {
        terminalHandled = true;
        acknowledge("error", true);
        render("Studio could not open this tab", normalizeStudioLaunchMessage(message.message), true);
        setTimer(cleanup, 50);
        return;
      }
      if (message.type === "cancel") {
        terminalHandled = true;
        acknowledge("cancel", true);
        render("Studio tab launch cancelled", normalizeStudioLaunchMessage(message.message, "The originating Studio page cancelled this launch."), true);
        setTimer(cleanup, 50);
      }
    }

    removeMessageListener = addChannelMessageListener(channel, handleMessage);
    if (closeBtn && typeof closeBtn.addEventListener === "function") {
      closeBtn.addEventListener("click", () => {
        try { windowLike.close(); } catch {}
      });
    }
    if (typeof windowLike.addEventListener === "function") {
      windowLike.addEventListener("pagehide", cleanup, { once: true });
    }
    waitingTimer = setTimer(() => {
      waitingTimer = null;
      if (terminalHandled) return;
      render("Still waiting for Studio…", "The originating Studio page has not finished. Keep this tab open, or close it and retry from Studio.", true);
    }, Math.max(100, Number(config.stillWaitingMs) || STUDIO_PENDING_STILL_WAITING_MS));
    try {
      post("ready");
    } catch {
      cleanup();
      render("Could not contact Studio", "Return to the originating Studio page and try again.", true);
      return null;
    }

    return Object.freeze({
      close: cleanup,
      getSnapshot() {
        return Object.freeze({ launchId, kind, terminalHandled, closed });
      },
    });
  }

  globalThis.PiStudioNavigationHelpers = Object.freeze({
    PANE_FOCUS_OFF,
    PANE_FOCUS_PARAM,
    PANE_FOCUS_TARGETS,
    STUDIO_LAUNCH_CHANNEL_PREFIX,
    STUDIO_LAUNCH_DELIVERY_TIMEOUT_MS,
    STUDIO_LAUNCH_MESSAGE_MAX_CHARS,
    STUDIO_LAUNCH_PROTOCOL_VERSION,
    STUDIO_LAUNCH_READY_TIMEOUT_MS,
    STUDIO_LAUNCH_TARGET_MAX_CHARS,
    STUDIO_PENDING_KINDS,
    buildPaneFocusUrl,
    buildPendingStudioUrl,
    canOpenPendingStudioLaunch,
    createPendingStudioLaunch,
    isValidStudioLaunchId,
    makeStudioLaunchId,
    normalizePaneFocusTarget,
    normalizeStudioLaunchMessage,
    normalizeStudioPendingKind,
    normalizeStudioRelativeTarget,
    openStudioTabDirect,
    readPaneFocusTarget,
    replacePaneFocusUrlState,
    startStudioPendingPage,
    studioLaunchChannelName,
  });

  if (
    typeof window === "object"
    && typeof document === "object"
    && document.body
    && document.body.dataset
    && document.body.dataset.studioPendingLaunch === "1"
  ) {
    startStudioPendingPage(window, document, {
      launchId: document.body.dataset.launchId || "",
      kind: document.body.dataset.launchKind || "",
      token: document.body.dataset.studioToken || "",
    });
  }
})();

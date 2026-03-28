    (() => {
      const statusLineEl = document.getElementById("statusLine");
      const statusEl = document.getElementById("status");
      const statusSpinnerEl = document.getElementById("statusSpinner");
      const footerMetaEl = document.getElementById("footerMeta");
      const footerMetaTextEl = document.getElementById("footerMetaText");
      const BRAILLE_SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
      let spinnerTimer = null;
      let spinnerFrameIndex = 0;
      if (statusEl) {
        statusEl.textContent = "Connecting · Studio script starting…";
      }

      function hardFail(prefix, error) {
        const details = error && error.message ? error.message : String(error || "unknown error");
        if (spinnerTimer) {
          window.clearInterval(spinnerTimer);
          spinnerTimer = null;
        }
        if (statusLineEl && statusLineEl.classList) {
          statusLineEl.classList.remove("with-spinner");
        }
        if (statusSpinnerEl) {
          statusSpinnerEl.textContent = "";
        }
        if (statusEl) {
          statusEl.textContent = "Disconnected · " + prefix + ": " + details;
          statusEl.className = "error";
        }
      }

      window.addEventListener("error", (event) => {
        hardFail("Studio UI script error", event && event.error ? event.error : event.message);
      });

      window.addEventListener("unhandledrejection", (event) => {
        hardFail("Studio UI promise error", event ? event.reason : "unknown rejection");
      });

      try {
      const sourceEditorWrapEl = document.getElementById("sourceEditorWrap");
      const sourceTextEl = document.getElementById("sourceText");
      const sourceHighlightEl = document.getElementById("sourceHighlight");
      const sourcePreviewEl = document.getElementById("sourcePreview");
      const leftPaneEl = document.getElementById("leftPane");
      const rightPaneEl = document.getElementById("rightPane");
      const sourceBadgeEl = document.getElementById("sourceBadge");
      const syncBadgeEl = document.getElementById("syncBadge");
      const critiqueViewEl = document.getElementById("critiqueView");
      const referenceBadgeEl = document.getElementById("referenceBadge");
      const editorViewSelect = document.getElementById("editorViewSelect");
      const rightViewSelect = document.getElementById("rightViewSelect");
      const followSelect = document.getElementById("followSelect");
      const responseHighlightSelect = document.getElementById("responseHighlightSelect");
      const pullLatestBtn = document.getElementById("pullLatestBtn");
      const insertHeaderBtn = document.getElementById("insertHeaderBtn");
      const critiqueBtn = document.getElementById("critiqueBtn");
      const lensSelect = document.getElementById("lensSelect");
      const fileInput = document.getElementById("fileInput");
      const resourceDirBtn = document.getElementById("resourceDirBtn");
      const resourceDirLabel = document.getElementById("resourceDirLabel");
      const resourceDirInputWrap = document.getElementById("resourceDirInputWrap");
      const resourceDirInput = document.getElementById("resourceDirInput");
      const resourceDirClearBtn = document.getElementById("resourceDirClearBtn");
      const loadResponseBtn = document.getElementById("loadResponseBtn");
      const loadCritiqueNotesBtn = document.getElementById("loadCritiqueNotesBtn");
      const loadCritiqueFullBtn = document.getElementById("loadCritiqueFullBtn");
      const copyResponseBtn = document.getElementById("copyResponseBtn");
      const exportPdfBtn = document.getElementById("exportPdfBtn");
      const historyPrevBtn = document.getElementById("historyPrevBtn");
      const historyNextBtn = document.getElementById("historyNextBtn");
      const historyLastBtn = document.getElementById("historyLastBtn");
      const historyIndexBadgeEl = document.getElementById("historyIndexBadge");
      const loadHistoryPromptBtn = document.getElementById("loadHistoryPromptBtn");
      const saveAsBtn = document.getElementById("saveAsBtn");
      const saveOverBtn = document.getElementById("saveOverBtn");
      const sendEditorBtn = document.getElementById("sendEditorBtn");
      const getEditorBtn = document.getElementById("getEditorBtn");
      const loadGitDiffBtn = document.getElementById("loadGitDiffBtn");
      const sendRunBtn = document.getElementById("sendRunBtn");
      const queueSteerBtn = document.getElementById("queueSteerBtn");
      const copyDraftBtn = document.getElementById("copyDraftBtn");
      const saveAnnotatedBtn = document.getElementById("saveAnnotatedBtn");
      const stripAnnotationsBtn = document.getElementById("stripAnnotationsBtn");
      const highlightSelect = document.getElementById("highlightSelect");
      const langSelect = document.getElementById("langSelect");
      const annotationModeSelect = document.getElementById("annotationModeSelect");
      const compactBtn = document.getElementById("compactBtn");
      const leftFocusBtn = document.getElementById("leftFocusBtn");
      const rightFocusBtn = document.getElementById("rightFocusBtn");

      const initialSourceState = {
        source: (document.body && document.body.dataset && document.body.dataset.initialSource) || "blank",
        label: (document.body && document.body.dataset && document.body.dataset.initialLabel) || "blank",
        path: (document.body && document.body.dataset && document.body.dataset.initialPath) || null,
      };

      let ws = null;
      let wsState = "Connecting";
      let statusMessage = "Connecting · Studio script starting…";
      let statusLevel = "";
      let reconnectTimer = null;
      let reconnectAttempt = 0;
      let pendingRequestId = null;
      let pendingKind = null;
      let stickyStudioKind = null;
      let initialDocumentApplied = false;
      let editorView = "markdown";
      let rightView = "preview";
      let followLatest = true;
      let queuedLatestResponse = null;
      let latestResponseMarkdown = "";
      let latestResponseThinking = "";
      let latestResponseTimestamp = 0;
      let latestResponseKind = "annotation";
      let latestResponseIsStructuredCritique = false;
      let latestResponseHasContent = false;
      let latestResponseNormalized = "";
      let latestResponseThinkingNormalized = "";
      let latestCritiqueNotes = "";
      let latestCritiqueNotesNormalized = "";
      let responseHistory = [];
      let responseHistoryIndex = -1;
      let studioRunChainActive = false;
      let queuedSteeringCount = 0;
      let agentBusyFromServer = false;
      let terminalActivityPhase = "idle";
      let terminalActivityToolName = "";
      let terminalActivityLabel = "";
      let lastSpecificToolLabel = "";
      let uiBusy = false;
      let pdfExportInProgress = false;
      let compactInProgress = false;
      let modelLabel = (document.body && document.body.dataset && document.body.dataset.modelLabel) || "none";
      let terminalSessionLabel = (document.body && document.body.dataset && document.body.dataset.terminalLabel) || "unknown";
      let contextTokens = null;
      let contextWindow = null;
      let contextPercent = null;
      let updateInstalledVersion = null;
      let updateLatestVersion = null;
      let windowHasFocus = typeof document.hasFocus === "function" ? document.hasFocus() : true;
      let titleAttentionMessage = "";
      let titleAttentionRequestId = null;
      let titleAttentionRequestKind = null;

      function parseFiniteNumber(value) {
        if (value == null || value === "") return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      }

      function parseNonEmptyString(value) {
        if (typeof value !== "string") return null;
        const trimmed = value.trim();
        return trimmed ? trimmed : null;
      }

      function applyStudioRunQueueStateFromMessage(message) {
        if (!message || typeof message !== "object") return false;
        let changed = false;
        if (typeof message.studioRunChainActive === "boolean" && studioRunChainActive !== message.studioRunChainActive) {
          studioRunChainActive = message.studioRunChainActive;
          changed = true;
        }
        if (typeof message.queuedSteeringCount === "number" && Number.isFinite(message.queuedSteeringCount)) {
          const nextCount = Math.max(0, Math.floor(message.queuedSteeringCount));
          if (queuedSteeringCount !== nextCount) {
            queuedSteeringCount = nextCount;
            changed = true;
          }
        }
        return changed;
      }

      contextTokens = parseFiniteNumber(document.body && document.body.dataset ? document.body.dataset.contextTokens : null);
      contextWindow = parseFiniteNumber(document.body && document.body.dataset ? document.body.dataset.contextWindow : null);
      contextPercent = parseFiniteNumber(document.body && document.body.dataset ? document.body.dataset.contextPercent : null);

      let sourceState = {
        source: initialSourceState.source,
        label: initialSourceState.label,
        path: initialSourceState.path,
      };
      let activePane = "left";
      let paneFocusTarget = "off";
      const EDITOR_HIGHLIGHT_MAX_CHARS = 100_000;
      const EDITOR_HIGHLIGHT_STORAGE_KEY = "piStudio.editorHighlightEnabled";
      const EDITOR_LANGUAGE_STORAGE_KEY = "piStudio.editorLanguage";
      // Single source of truth: language -> file extensions (and display label)
      var LANG_EXT_MAP = {
        markdown:   { label: "Markdown",   exts: ["md", "markdown", "mdx", "qmd"] },
        javascript: { label: "JavaScript", exts: ["js", "mjs", "cjs", "jsx"] },
        typescript: { label: "TypeScript", exts: ["ts", "mts", "cts", "tsx"] },
        python:     { label: "Python",     exts: ["py", "pyw"] },
        bash:       { label: "Bash",       exts: ["sh", "bash", "zsh"] },
        json:       { label: "JSON",       exts: ["json", "jsonc", "json5"] },
        rust:       { label: "Rust",       exts: ["rs"] },
        c:          { label: "C",          exts: ["c", "h"] },
        cpp:        { label: "C++",        exts: ["cpp", "cxx", "cc", "hpp", "hxx"] },
        julia:      { label: "Julia",      exts: ["jl"] },
        fortran:    { label: "Fortran",    exts: ["f90", "f95", "f03", "f", "for"] },
        r:          { label: "R",          exts: ["r", "R"] },
        matlab:     { label: "MATLAB",     exts: ["m"] },
        latex:      { label: "LaTeX",      exts: ["tex", "latex"] },
        diff:       { label: "Diff",       exts: ["diff", "patch"] },
        // Languages accepted for upload/detect but without syntax highlighting
        java:       { label: "Java",       exts: ["java"] },
        go:         { label: "Go",         exts: ["go"] },
        ruby:       { label: "Ruby",       exts: ["rb"] },
        swift:      { label: "Swift",      exts: ["swift"] },
        html:       { label: "HTML",       exts: ["html", "htm"] },
        css:        { label: "CSS",        exts: ["css"] },
        xml:        { label: "XML",        exts: ["xml"] },
        yaml:       { label: "YAML",       exts: ["yaml", "yml"] },
        toml:       { label: "TOML",       exts: ["toml"] },
        lua:        { label: "Lua",        exts: ["lua"] },
        text:       { label: "Plain Text", exts: ["txt", "rst", "adoc"] },
      };
      // Build reverse map: extension -> language
      var EXT_TO_LANG = {};
      Object.keys(LANG_EXT_MAP).forEach(function(lang) {
        LANG_EXT_MAP[lang].exts.forEach(function(ext) { EXT_TO_LANG[ext.toLowerCase()] = lang; });
      });
      // Languages that have syntax highlighting support
      var HIGHLIGHTED_LANGUAGES = ["markdown", "javascript", "typescript", "python", "bash", "json", "rust", "c", "cpp", "julia", "fortran", "r", "matlab", "latex"];
      var SUPPORTED_LANGUAGES = Object.keys(LANG_EXT_MAP);
      const RESPONSE_HIGHLIGHT_MAX_CHARS = 120_000;
      const RESPONSE_HIGHLIGHT_STORAGE_KEY = "piStudio.responseHighlightEnabled";
      const ANNOTATION_MODE_STORAGE_KEY = "piStudio.annotationsEnabled";
      const PREVIEW_INPUT_DEBOUNCE_MS = 0;
      const PREVIEW_PENDING_BADGE_DELAY_MS = 220;
      const previewPendingTimers = new WeakMap();
      let sourcePreviewRenderTimer = null;
      let sourcePreviewRenderNonce = 0;
      let responsePreviewRenderNonce = 0;
      let responseEditorPreviewTimer = null;
      let pendingResponseScrollReset = false;
      let editorMetaUpdateRaf = null;
      let editorHighlightEnabled = false;
      let editorLanguage = "markdown";
      let responseHighlightEnabled = false;
      let editorHighlightRenderRaf = null;
      let annotationsEnabled = true;
      const PREVIEW_ANNOTATION_PLACEHOLDER_PREFIX = "PISTUDIOANNOT";
      const annotationHelpers = globalThis.PiStudioAnnotationHelpers;
      if (!annotationHelpers || typeof annotationHelpers.collectInlineAnnotationMarkers !== "function") {
        throw new Error("Studio annotation helpers failed to load.");
      }
      const EMPTY_OVERLAY_LINE = "\u200b";
      const MERMAID_CDN_URL = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
      const MATHJAX_CDN_URL = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js";
      const PDFJS_CDN_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.min.mjs";
      const PDFJS_WORKER_CDN_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.worker.min.mjs";
      const BOOT = (typeof window.__PI_STUDIO_BOOT__ === "object" && window.__PI_STUDIO_BOOT__)
        ? window.__PI_STUDIO_BOOT__
        : {};
      const MERMAID_CONFIG = (BOOT.mermaidConfig && typeof BOOT.mermaidConfig === "object")
        ? BOOT.mermaidConfig
        : {};
      const MERMAID_UNAVAILABLE_MESSAGE = "Mermaid renderer unavailable. Showing mermaid blocks as code.";
      const MERMAID_RENDER_FAIL_MESSAGE = "Mermaid render failed. Showing diagram source text.";
      const MATHJAX_UNAVAILABLE_MESSAGE = "Math fallback unavailable. Some unsupported equations may remain as raw TeX.";
      const MATHJAX_RENDER_FAIL_MESSAGE = "Math fallback could not render some unsupported equations.";
      const PDF_PREVIEW_UNAVAILABLE_MESSAGE = "PDF figure preview unavailable. Inline PDF rendering is not supported in this Studio browser environment.";
      const PDF_PREVIEW_RENDER_FAIL_MESSAGE = "PDF figure preview could not be rendered.";
      let mermaidModulePromise = null;
      let mermaidInitialized = false;
      let mathJaxPromise = null;
      let pdfJsPromise = null;

      const DEBUG_ENABLED = (() => {
        try {
          const query = new URLSearchParams(window.location.search || "");
          const hash = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
          const value = String(query.get("debug") || hash.get("debug") || "").trim().toLowerCase();
          return value === "1" || value === "true" || value === "yes" || value === "on";
        } catch {
          return false;
        }
      })();
      const DEBUG_LOG_MAX = 400;
      const debugLog = [];

      function debugTrace(eventName, payload) {
        if (!DEBUG_ENABLED) return;
        const entry = {
          ts: Date.now(),
          event: String(eventName || ""),
          payload: payload || null,
        };
        debugLog.push(entry);
        if (debugLog.length > DEBUG_LOG_MAX) debugLog.shift();
        window.__piStudioDebugLog = debugLog.slice();
        try {
          console.debug("[pi-studio]", new Date(entry.ts).toISOString(), entry.event, entry.payload);
        } catch {
          // ignore console errors
        }
      }

      function summarizeServerMessage(message) {
        if (!message || typeof message !== "object") return { type: "invalid" };
        const summary = {
          type: typeof message.type === "string" ? message.type : "unknown",
        };
        if (typeof message.requestId === "string") summary.requestId = message.requestId;
        if (typeof message.activeRequestId === "string") summary.activeRequestId = message.activeRequestId;
        if (typeof message.activeRequestKind === "string") summary.activeRequestKind = message.activeRequestKind;
        if (typeof message.kind === "string") summary.kind = message.kind;
        if (typeof message.event === "string") summary.event = message.event;
        if (typeof message.timestamp === "number") summary.timestamp = message.timestamp;
        if (typeof message.busy === "boolean") summary.busy = message.busy;
        if (typeof message.agentBusy === "boolean") summary.agentBusy = message.agentBusy;
        if (typeof message.terminalPhase === "string") summary.terminalPhase = message.terminalPhase;
        if (typeof message.terminalToolName === "string") summary.terminalToolName = message.terminalToolName;
        if (typeof message.terminalActivityLabel === "string") summary.terminalActivityLabel = message.terminalActivityLabel;
        if (typeof message.modelLabel === "string") summary.modelLabel = message.modelLabel;
        if (typeof message.terminalSessionLabel === "string") summary.terminalSessionLabel = message.terminalSessionLabel;
        if (typeof message.contextTokens === "number") summary.contextTokens = message.contextTokens;
        if (typeof message.contextWindow === "number") summary.contextWindow = message.contextWindow;
        if (typeof message.contextPercent === "number") summary.contextPercent = message.contextPercent;
        if (typeof message.updateInstalledVersion === "string") summary.updateInstalledVersion = message.updateInstalledVersion;
        if (typeof message.updateLatestVersion === "string") summary.updateLatestVersion = message.updateLatestVersion;
        if (message.document && typeof message.document === "object" && typeof message.document.text === "string") {
          summary.documentLength = message.document.text.length;
          if (typeof message.document.label === "string") summary.documentLabel = message.document.label;
        }
        if (typeof message.compactInProgress === "boolean") summary.compactInProgress = message.compactInProgress;
        if (typeof message.stopReason === "string") summary.stopReason = message.stopReason;
        if (typeof message.markdown === "string") summary.markdownLength = message.markdown.length;
        if (typeof message.label === "string") summary.label = message.label;
        if (Array.isArray(message.responseHistory)) summary.responseHistoryCount = message.responseHistory.length;
        if (Array.isArray(message.items)) summary.itemsCount = message.items.length;
        if (typeof message.details === "object" && message.details !== null) summary.details = message.details;
        return summary;
      }

      function getIdleStatus() {
        return "Edit, load, or annotate text, then run, save, send to pi editor, or critique.";
      }

      function normalizeTerminalPhase(phase) {
        if (phase === "running" || phase === "tool" || phase === "responding") return phase;
        return "idle";
      }

      function normalizeActivityLabel(label) {
        if (typeof label !== "string") return "";
        return label.replace(/\s+/g, " ").trim();
      }

      function isGenericToolLabel(label) {
        const normalized = normalizeActivityLabel(label).toLowerCase();
        if (!normalized) return true;
        return normalized.startsWith("running ")
          || normalized === "reading file"
          || normalized === "writing file"
          || normalized === "editing file";
      }

      function withEllipsis(text) {
        const value = String(text || "").trim();
        if (!value) return "";
        if (/[….!?]$/.test(value)) return value;
        return value + "…";
      }

      function updateTerminalActivityState(phase, toolName, label) {
        terminalActivityPhase = normalizeTerminalPhase(phase);
        terminalActivityToolName = typeof toolName === "string" ? toolName.trim() : "";
        terminalActivityLabel = normalizeActivityLabel(label);

        if (terminalActivityPhase === "tool" && terminalActivityLabel && !isGenericToolLabel(terminalActivityLabel)) {
          lastSpecificToolLabel = terminalActivityLabel;
        }
        if (terminalActivityPhase === "idle") {
          lastSpecificToolLabel = "";
        }

        syncFooterSpinnerState();
      }

      function getTerminalBusyStatus() {
        if (terminalActivityPhase === "tool") {
          if (terminalActivityLabel) {
            return "Terminal: " + withEllipsis(terminalActivityLabel);
          }
          return terminalActivityToolName
            ? "Terminal: running tool: " + terminalActivityToolName + "…"
            : "Terminal: running tool…";
        }
        if (terminalActivityPhase === "responding") {
          if (lastSpecificToolLabel) {
            return "Terminal: " + lastSpecificToolLabel + " (generating response)…";
          }
          return "Terminal: generating response…";
        }
        if (terminalActivityPhase === "running" && lastSpecificToolLabel) {
          return "Terminal: " + withEllipsis(lastSpecificToolLabel);
        }
        return "Terminal: running…";
      }

      function getStudioActionLabel(kind) {
        if (kind === "annotation") return "sending annotated reply";
        if (kind === "critique") return "running critique";
        if (kind === "direct") return "running editor text";
        if (kind === "compact") return "compacting context";
        if (kind === "send_to_editor") return "sending to pi editor";
        if (kind === "get_from_editor") return "loading from pi editor";
        if (kind === "load_git_diff") return "loading git diff";
        if (kind === "save_as" || kind === "save_over") return "saving editor text";
        return "submitting request";
      }

      function formatQueuedSteeringSuffix() {
        if (!queuedSteeringCount) return "";
        return queuedSteeringCount === 1
          ? " · 1 steering queued"
          : " · " + queuedSteeringCount + " steering queued";
      }

      function getStudioBusyStatus(kind) {
        const action = getStudioActionLabel(kind);
        const queueSuffix = studioRunChainActive ? formatQueuedSteeringSuffix() : "";
        if (terminalActivityPhase === "tool") {
          if (terminalActivityLabel) {
            return "Studio: " + withEllipsis(terminalActivityLabel) + queueSuffix;
          }
          return terminalActivityToolName
            ? "Studio: " + action + " (tool: " + terminalActivityToolName + ")…" + queueSuffix
            : "Studio: " + action + " (running tool)…" + queueSuffix;
        }
        if (terminalActivityPhase === "responding") {
          if (lastSpecificToolLabel) {
            return "Studio: " + lastSpecificToolLabel + " (generating response)…" + queueSuffix;
          }
          return "Studio: " + action + " (generating response)…" + queueSuffix;
        }
        if (terminalActivityPhase === "running" && lastSpecificToolLabel) {
          return "Studio: " + withEllipsis(lastSpecificToolLabel) + queueSuffix;
        }
        return "Studio: " + action + "…" + queueSuffix;
      }

      function getHistoryPromptSourceLabel(item) {
        if (!item || !item.promptMode) return null;
        const steeringCount = typeof item.promptSteeringCount === "number" && Number.isFinite(item.promptSteeringCount)
          ? Math.max(0, Math.floor(item.promptSteeringCount))
          : 0;
        if (item.promptMode === "run") return "original run";
        if (item.promptMode !== "effective") return null;
        if (steeringCount <= 0) return "original run";
        return steeringCount === 1
          ? "original run + 1 steering message"
          : "original run + " + steeringCount + " steering messages";
      }

      function getHistoryPromptButtonLabel(item) {
        if (!item || !item.prompt || !String(item.prompt).trim()) {
          return "Response prompt unavailable";
        }
        if (item.promptMode === "effective") {
          return "Load effective prompt into editor";
        }
        if (item.promptMode === "run") {
          return "Load run prompt into editor";
        }
        return "Load response prompt into editor";
      }

      function getHistoryPromptLoadedStatus(item) {
        if (!item || !item.prompt || !String(item.prompt).trim()) {
          return "Prompt unavailable for the selected response.";
        }
        if (item.promptMode === "effective") {
          return "Loaded effective prompt into editor.";
        }
        if (item.promptMode === "run") {
          return "Loaded run prompt into editor.";
        }
        return "Loaded response prompt into editor.";
      }

      function getHistoryPromptSourceStateLabel(item) {
        if (!item || !item.prompt || !String(item.prompt).trim()) return "response prompt";
        if (item.promptMode === "effective") return "effective prompt";
        if (item.promptMode === "run") return "run prompt";
        return "response prompt";
      }

      function shouldAnimateFooterSpinner() {
        return wsState !== "Disconnected" && (uiBusy || agentBusyFromServer || terminalActivityPhase !== "idle");
      }

      function formatNumber(value) {
        if (typeof value !== "number" || !Number.isFinite(value)) return "?";
        try {
          return new Intl.NumberFormat().format(Math.round(value));
        } catch {
          return String(Math.round(value));
        }
      }

      function formatContextUsageText() {
        const hasWindow = typeof contextWindow === "number" && Number.isFinite(contextWindow) && contextWindow > 0;
        const hasTokens = typeof contextTokens === "number" && Number.isFinite(contextTokens) && contextTokens >= 0;
        let percentValue = typeof contextPercent === "number" && Number.isFinite(contextPercent)
          ? contextPercent
          : null;

        if (percentValue == null && hasTokens && hasWindow) {
          percentValue = (contextTokens / contextWindow) * 100;
        }

        if (!hasTokens && !hasWindow) {
          return "Context: unknown";
        }
        if (!hasTokens && hasWindow) {
          return "Context: ? / " + formatNumber(contextWindow);
        }

        let text = "Context: " + formatNumber(contextTokens);
        if (hasWindow) {
          text += " / " + formatNumber(contextWindow);
        }
        if (percentValue != null && Number.isFinite(percentValue)) {
          const bounded = Math.max(0, Math.min(100, percentValue));
          text += " (" + bounded.toFixed(1) + "%)";
        }
        return text;
      }

      function applyContextUsageFromMessage(message) {
        if (!message || typeof message !== "object") return false;

        let changed = false;

        if (Object.prototype.hasOwnProperty.call(message, "contextTokens")) {
          const next = typeof message.contextTokens === "number" && Number.isFinite(message.contextTokens) && message.contextTokens >= 0
            ? message.contextTokens
            : null;
          if (next !== contextTokens) {
            contextTokens = next;
            changed = true;
          }
        }

        if (Object.prototype.hasOwnProperty.call(message, "contextWindow")) {
          const next = typeof message.contextWindow === "number" && Number.isFinite(message.contextWindow) && message.contextWindow > 0
            ? message.contextWindow
            : null;
          if (next !== contextWindow) {
            contextWindow = next;
            changed = true;
          }
        }

        if (Object.prototype.hasOwnProperty.call(message, "contextPercent")) {
          const next = typeof message.contextPercent === "number" && Number.isFinite(message.contextPercent)
            ? Math.max(0, Math.min(100, message.contextPercent))
            : null;
          if (next !== contextPercent) {
            contextPercent = next;
            changed = true;
          }
        }

        return changed;
      }

      function applyUpdateInfoFromMessage(message) {
        if (!message || typeof message !== "object") return false;

        let changed = false;

        if (Object.prototype.hasOwnProperty.call(message, "updateInstalledVersion")) {
          const nextInstalled = parseNonEmptyString(message.updateInstalledVersion);
          if (nextInstalled !== updateInstalledVersion) {
            updateInstalledVersion = nextInstalled;
            changed = true;
          }
        }

        if (Object.prototype.hasOwnProperty.call(message, "updateLatestVersion")) {
          const nextLatest = parseNonEmptyString(message.updateLatestVersion);
          if (nextLatest !== updateLatestVersion) {
            updateLatestVersion = nextLatest;
            changed = true;
          }
        }

        return changed;
      }

      function isTitleAttentionRequestKind(kind) {
        return kind === "annotation" || kind === "critique" || kind === "direct";
      }

      function armTitleAttentionForRequest(requestId, kind) {
        if (typeof requestId !== "string" || !isTitleAttentionRequestKind(kind)) {
          titleAttentionRequestId = null;
          titleAttentionRequestKind = null;
          return;
        }
        titleAttentionRequestId = requestId;
        titleAttentionRequestKind = kind;
      }

      function clearArmedTitleAttention(requestId) {
        if (typeof requestId === "string" && titleAttentionRequestId && requestId !== titleAttentionRequestId) {
          return;
        }
        titleAttentionRequestId = null;
        titleAttentionRequestKind = null;
      }

      function clearTitleAttention() {
        if (!titleAttentionMessage) return;
        titleAttentionMessage = "";
        updateDocumentTitle();
      }

      function shouldShowTitleAttention() {
        const focused = typeof document.hasFocus === "function" ? document.hasFocus() : windowHasFocus;
        return Boolean(document.hidden) || !focused;
      }

      function getTitleAttentionMessage(kind) {
        if (kind === "critique") return "● Critique ready";
        if (kind === "direct") return "● Response ready";
        return "● Reply ready";
      }

      function maybeShowTitleAttentionForCompletedRequest(requestId, kind) {
        const matchedRequest = typeof requestId === "string" && titleAttentionRequestId && requestId === titleAttentionRequestId;
        const completedKind = isTitleAttentionRequestKind(kind) ? kind : titleAttentionRequestKind;
        clearArmedTitleAttention(requestId);
        if (!matchedRequest || !completedKind || !shouldShowTitleAttention()) {
          return;
        }
        titleAttentionMessage = getTitleAttentionMessage(completedKind);
        updateDocumentTitle();
      }

      function updateDocumentTitle() {
        const modelText = modelLabel && modelLabel.trim() ? modelLabel.trim() : "none";
        const terminalText = terminalSessionLabel && terminalSessionLabel.trim() ? terminalSessionLabel.trim() : "unknown";
        const titleParts = ["pi Studio"];
        if (terminalText && terminalText !== "unknown") titleParts.push(terminalText);
        if (modelText && modelText !== "none") titleParts.push(modelText);
        if (titleAttentionMessage) titleParts.unshift(titleAttentionMessage);
        document.title = titleParts.join(" · ");
      }

      function updateFooterMeta() {
        const modelText = modelLabel && modelLabel.trim() ? modelLabel.trim() : "none";
        const terminalText = terminalSessionLabel && terminalSessionLabel.trim() ? terminalSessionLabel.trim() : "unknown";
        const contextText = formatContextUsageText();
        let updateText = "";
        if (updateLatestVersion) {
          updateText = updateInstalledVersion
            ? "Update: " + updateInstalledVersion + " → " + updateLatestVersion
            : "Update: " + updateLatestVersion + " available";
        }
        const text = "Model: " + modelText + " · Terminal: " + terminalText + " · " + contextText + (updateText ? " · " + updateText : "");
        if (footerMetaTextEl) {
          footerMetaTextEl.textContent = text;
          footerMetaTextEl.title = text;
        } else if (footerMetaEl) {
          footerMetaEl.textContent = text;
          footerMetaEl.title = text;
        }
        updateDocumentTitle();
      }

      function stopFooterSpinner() {
        if (spinnerTimer) {
          window.clearInterval(spinnerTimer);
          spinnerTimer = null;
        }
      }

      function startFooterSpinner() {
        if (spinnerTimer) return;
        spinnerTimer = window.setInterval(() => {
          spinnerFrameIndex = (spinnerFrameIndex + 1) % BRAILLE_SPINNER_FRAMES.length;
          renderStatus();
        }, 80);
      }

      function syncFooterSpinnerState() {
        if (shouldAnimateFooterSpinner()) {
          startFooterSpinner();
        } else {
          stopFooterSpinner();
        }
      }

      function renderStatus() {
        statusEl.textContent = statusMessage;
        statusEl.className = statusLevel || "";

        const spinnerActive = shouldAnimateFooterSpinner();
        if (statusLineEl && statusLineEl.classList) {
          statusLineEl.classList.toggle("with-spinner", spinnerActive);
        }
        if (statusSpinnerEl) {
          statusSpinnerEl.textContent = spinnerActive
            ? (BRAILLE_SPINNER_FRAMES[spinnerFrameIndex % BRAILLE_SPINNER_FRAMES.length] || "")
            : "";
        }

        updateFooterMeta();
      }

      function setWsState(nextState) {
        wsState = nextState || "Disconnected";
        syncFooterSpinnerState();
        renderStatus();
        syncActionButtons();
      }

      function setStatus(message, level) {
        statusMessage = message;
        statusLevel = level || "";
        syncFooterSpinnerState();
        renderStatus();
        debugTrace("status", {
          wsState,
          message: statusMessage,
          level: statusLevel,
          pendingRequestId,
          pendingKind,
          uiBusy,
          agentBusyFromServer,
          terminalPhase: terminalActivityPhase,
          terminalToolName: terminalActivityToolName,
          terminalActivityLabel,
          lastSpecificToolLabel,
        });
      }

      renderStatus();

      window.addEventListener("focus", () => {
        windowHasFocus = true;
        clearTitleAttention();
      });

      window.addEventListener("blur", () => {
        windowHasFocus = false;
      });

      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
          windowHasFocus = typeof document.hasFocus === "function" ? document.hasFocus() : windowHasFocus;
          if (windowHasFocus) {
            clearTitleAttention();
          }
        }
      });

      function updateSourceBadge() {
        const label = sourceState && sourceState.label ? sourceState.label : "blank";
        sourceBadgeEl.textContent = "Editor origin: " + label;
        // Show "Set working dir" button when not file-backed
        var isFileBacked = sourceState.source === "file" && Boolean(sourceState.path);
        if (isFileBacked) {
          if (resourceDirInput) resourceDirInput.value = "";
          if (resourceDirLabel) resourceDirLabel.textContent = "";
          if (resourceDirBtn) resourceDirBtn.hidden = true;
          if (resourceDirLabel) resourceDirLabel.hidden = true;
          if (resourceDirInputWrap) resourceDirInputWrap.classList.remove("visible");
        } else {
          // Restore to label if dir is set, otherwise show button
          var dir = resourceDirInput ? resourceDirInput.value.trim() : "";
          if (dir) {
            if (resourceDirBtn) resourceDirBtn.hidden = true;
            if (resourceDirLabel) { resourceDirLabel.textContent = "Working dir: " + dir; resourceDirLabel.hidden = false; }
            if (resourceDirInputWrap) resourceDirInputWrap.classList.remove("visible");
          } else {
            if (resourceDirBtn) resourceDirBtn.hidden = false;
            if (resourceDirLabel) resourceDirLabel.hidden = true;
            if (resourceDirInputWrap) resourceDirInputWrap.classList.remove("visible");
          }
        }
      }

      function updatePaneFocusButtons() {
        [
          [leftFocusBtn, "left"],
          [rightFocusBtn, "right"],
        ].forEach(([btn, pane]) => {
          if (!btn) return;
          const isFocusedPane = paneFocusTarget === pane;
          const paneName = pane === "right" ? "response" : "editor";
          btn.classList.toggle("is-active", isFocusedPane);
          btn.setAttribute("aria-pressed", isFocusedPane ? "true" : "false");
          btn.textContent = isFocusedPane ? "Exit focus" : "Focus pane";
          btn.title = isFocusedPane
            ? "Return to the two-pane layout. Shortcut: F10 or Cmd/Ctrl+Esc."
            : "Show only the " + paneName + " pane. Shortcut: F10 or Cmd/Ctrl+Esc.";
        });
      }

      function applyPaneFocusClasses() {
        document.body.classList.remove("pane-focus-left", "pane-focus-right");
        if (paneFocusTarget === "left") {
          document.body.classList.add("pane-focus-left");
        } else if (paneFocusTarget === "right") {
          document.body.classList.add("pane-focus-right");
        }
        updatePaneFocusButtons();
      }

      function setActivePane(nextPane) {
        activePane = nextPane === "right" ? "right" : "left";

        if (leftPaneEl) leftPaneEl.classList.toggle("pane-active", activePane === "left");
        if (rightPaneEl) rightPaneEl.classList.toggle("pane-active", activePane === "right");

        if (paneFocusTarget !== "off" && paneFocusTarget !== activePane) {
          paneFocusTarget = activePane;
          applyPaneFocusClasses();
        }
      }

      function paneLabel(pane) {
        if (pane === "right") {
          return "Response";
        }
        return "Editor";
      }

      function enterPaneFocus(nextPane) {
        const pane = nextPane === "right" ? "right" : "left";
        setActivePane(pane);
        paneFocusTarget = pane;
        applyPaneFocusClasses();
        setStatus("Focus mode: " + paneLabel(pane) + " pane. Toggle with F10 or Cmd/Ctrl+Esc.");
      }

      function togglePaneFocus() {
        if (paneFocusTarget === activePane) {
          paneFocusTarget = "off";
          applyPaneFocusClasses();
          setStatus("Focus mode off.");
          return;
        }

        enterPaneFocus(activePane);
      }

      function exitPaneFocus() {
        if (paneFocusTarget === "off") return false;
        paneFocusTarget = "off";
        applyPaneFocusClasses();
        setStatus("Focus mode off.");
        return true;
      }

      function handlePaneShortcut(event) {
        if (!event || event.defaultPrevented) return;

        const key = typeof event.key === "string" ? event.key : "";
        const isToggleShortcut =
          (key === "Escape" && (event.metaKey || event.ctrlKey))
          || key === "F10";

        if (isToggleShortcut) {
          event.preventDefault();
          togglePaneFocus();
          return;
        }

        if (
          key === "Escape"
          && !event.metaKey
          && !event.ctrlKey
          && !event.altKey
          && !event.shiftKey
        ) {
          const activeKind = getAbortablePendingKind();
          if (activeKind === "direct" || activeKind === "critique") {
            event.preventDefault();
            requestCancelForPendingRequest(activeKind);
            return;
          }
          if (exitPaneFocus()) {
            event.preventDefault();
          }
          return;
        }

        if (
          key === "Enter"
          && (event.metaKey || event.ctrlKey)
          && !event.altKey
          && !event.shiftKey
          && activePane === "left"
        ) {
          if (queueSteerBtn && !queueSteerBtn.disabled) {
            event.preventDefault();
            queueSteerBtn.click();
            return;
          }
          if (sendRunBtn && !sendRunBtn.disabled) {
            event.preventDefault();
            sendRunBtn.click();
          }
        }
      }

      function formatReferenceTime(timestamp) {
        if (typeof timestamp !== "number" || !Number.isFinite(timestamp) || timestamp <= 0) return "";
        try {
          return new Date(timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
        } catch {
          return "";
        }
      }

      function normalizeHistoryKind(kind) {
        return kind === "critique" ? "critique" : "annotation";
      }

      function normalizeHistoryItem(item, fallbackIndex) {
        if (!item || typeof item !== "object") return null;
        if (typeof item.markdown !== "string") return null;
        const markdown = item.markdown;
        if (!markdown.trim()) return null;

        const id = typeof item.id === "string" && item.id.trim()
          ? item.id.trim()
          : ("history-" + fallbackIndex + "-" + Date.now());
        const timestamp = typeof item.timestamp === "number" && Number.isFinite(item.timestamp) && item.timestamp > 0
          ? item.timestamp
          : Date.now();
        const prompt = typeof item.prompt === "string"
          ? item.prompt
          : (item.prompt == null ? null : String(item.prompt));
        const thinking = typeof item.thinking === "string"
          ? item.thinking
          : (item.thinking == null ? null : String(item.thinking));
        const promptMode = item.promptMode === "run" || item.promptMode === "effective"
          ? item.promptMode
          : "response";
        const promptTriggerKind = item.promptTriggerKind === "run" || item.promptTriggerKind === "steer"
          ? item.promptTriggerKind
          : null;
        const promptSteeringCount = typeof item.promptSteeringCount === "number" && Number.isFinite(item.promptSteeringCount)
          ? Math.max(0, Math.floor(item.promptSteeringCount))
          : 0;
        const promptTriggerText = typeof item.promptTriggerText === "string"
          ? item.promptTriggerText
          : (item.promptTriggerText == null ? null : String(item.promptTriggerText));

        return {
          id,
          markdown,
          thinking,
          timestamp,
          kind: normalizeHistoryKind(item.kind),
          prompt,
          promptMode,
          promptTriggerKind,
          promptSteeringCount,
          promptTriggerText,
        };
      }

      function getSelectedHistoryItem() {
        if (!Array.isArray(responseHistory) || responseHistory.length === 0) return null;
        if (responseHistoryIndex < 0 || responseHistoryIndex >= responseHistory.length) return null;
        return responseHistory[responseHistoryIndex] || null;
      }

      function clearActiveResponseView() {
        pendingResponseScrollReset = false;
        latestResponseMarkdown = "";
        latestResponseThinking = "";
        latestResponseKind = "annotation";
        latestResponseTimestamp = 0;
        latestResponseIsStructuredCritique = false;
        latestResponseHasContent = false;
        latestResponseNormalized = "";
        latestResponseThinkingNormalized = "";
        latestCritiqueNotes = "";
        latestCritiqueNotesNormalized = "";
        refreshResponseUi();
      }

      function updateHistoryControls() {
        const total = Array.isArray(responseHistory) ? responseHistory.length : 0;
        const selected = total > 0 && responseHistoryIndex >= 0 && responseHistoryIndex < total
          ? responseHistoryIndex + 1
          : 0;
        if (historyIndexBadgeEl) {
          historyIndexBadgeEl.textContent = "History: " + selected + "/" + total;
        }
        if (historyPrevBtn) {
          historyPrevBtn.disabled = total <= 1 || responseHistoryIndex <= 0;
        }
        if (historyNextBtn) {
          historyNextBtn.disabled = total <= 1 || responseHistoryIndex < 0 || responseHistoryIndex >= total - 1;
        }
        if (historyLastBtn) {
          historyLastBtn.disabled = total <= 1 || responseHistoryIndex < 0 || responseHistoryIndex >= total - 1;
        }

        const selectedItem = getSelectedHistoryItem();
        const hasPrompt = Boolean(selectedItem && typeof selectedItem.prompt === "string" && selectedItem.prompt.trim());
        if (loadHistoryPromptBtn) {
          loadHistoryPromptBtn.disabled = uiBusy || !hasPrompt;
          loadHistoryPromptBtn.textContent = getHistoryPromptButtonLabel(selectedItem);
          const promptSourceLabel = getHistoryPromptSourceLabel(selectedItem);
          loadHistoryPromptBtn.title = hasPrompt
            ? (promptSourceLabel
              ? "Load the " + promptSourceLabel + " prompt chain that generated the selected response into the editor."
              : "Load the prompt that generated the selected response into the editor.")
            : "Prompt unavailable for the selected response.";
        }
      }

      function applySelectedHistoryItem(options) {
        const item = getSelectedHistoryItem();
        if (!item) {
          clearActiveResponseView();
          return false;
        }
        handleIncomingResponse(item.markdown, item.kind, item.timestamp, item.thinking, options);
        return true;
      }

      function selectHistoryIndex(index, options) {
        const total = Array.isArray(responseHistory) ? responseHistory.length : 0;
        if (total === 0) {
          responseHistoryIndex = -1;
          clearActiveResponseView();
          updateHistoryControls();
          return false;
        }

        const previousItem = getSelectedHistoryItem();
        const previousId = previousItem && typeof previousItem.id === "string" ? previousItem.id : null;
        const nextIndex = Math.max(0, Math.min(total - 1, Number(index) || 0));
        responseHistoryIndex = nextIndex;
        const nextItem = getSelectedHistoryItem();
        const nextId = nextItem && typeof nextItem.id === "string" ? nextItem.id : null;
        const applied = applySelectedHistoryItem({ resetScroll: previousId !== nextId });
        updateHistoryControls();

        if (applied && !(options && options.silent)) {
          const item = getSelectedHistoryItem();
          if (item) {
            const responseLabel = item.kind === "critique" ? "critique" : "response";
            setStatus("Viewing " + responseLabel + " history " + (nextIndex + 1) + "/" + total + ".");
          }
        }
        return applied;
      }

      function setResponseHistory(items, options) {
        const normalized = Array.isArray(items)
          ? items
              .map((item, index) => normalizeHistoryItem(item, index))
              .filter((item) => item && typeof item === "object")
          : [];

        const previousItem = getSelectedHistoryItem();
        const previousId = previousItem && typeof previousItem.id === "string" ? previousItem.id : null;

        responseHistory = normalized;

        if (!responseHistory.length) {
          responseHistoryIndex = -1;
          clearActiveResponseView();
          updateHistoryControls();
          return false;
        }

        let targetIndex = responseHistory.length - 1;
        const preserveSelection = Boolean(options && options.preserveSelection);
        const autoSelectLatest = options && Object.prototype.hasOwnProperty.call(options, "autoSelectLatest")
          ? Boolean(options.autoSelectLatest)
          : true;

        if (preserveSelection && previousId) {
          const preservedIndex = responseHistory.findIndex((item) => item.id === previousId);
          if (preservedIndex >= 0) {
            targetIndex = preservedIndex;
          } else if (!autoSelectLatest && responseHistoryIndex >= 0 && responseHistoryIndex < responseHistory.length) {
            targetIndex = responseHistoryIndex;
          }
        } else if (!autoSelectLatest && responseHistoryIndex >= 0 && responseHistoryIndex < responseHistory.length) {
          targetIndex = responseHistoryIndex;
        }

        return selectHistoryIndex(targetIndex, { silent: Boolean(options && options.silent) });
      }

      function updateReferenceBadge() {
        if (!referenceBadgeEl) return;

        if (rightView === "editor-preview") {
          const hasResponse = Boolean(latestResponseMarkdown && latestResponseMarkdown.trim());
          if (hasResponse) {
            const time = formatReferenceTime(latestResponseTimestamp);
            const suffix = time ? " · response updated " + time : " · response available";
            referenceBadgeEl.textContent = "Previewing: editor text" + suffix;
          } else {
            referenceBadgeEl.textContent = "Previewing: editor text";
          }
          return;
        }

        const hasResponse = Boolean(latestResponseMarkdown && latestResponseMarkdown.trim());
        const hasThinking = Boolean(latestResponseThinking && latestResponseThinking.trim());
        if (rightView === "thinking") {
          if (!hasResponse && !hasThinking) {
            referenceBadgeEl.textContent = "Thinking: none";
            return;
          }

          const time = formatReferenceTime(latestResponseTimestamp);
          const total = Array.isArray(responseHistory) ? responseHistory.length : 0;
          const selected = total > 0 && responseHistoryIndex >= 0 && responseHistoryIndex < total
            ? responseHistoryIndex + 1
            : 0;
          const historyPrefix = total > 0 ? "Response history " + selected + "/" + total + " · " : "";
          const thinkingLabel = hasThinking ? "assistant thinking" : "assistant thinking unavailable";
          referenceBadgeEl.textContent = time
            ? historyPrefix + thinkingLabel + " · " + time
            : historyPrefix + thinkingLabel;
          return;
        }

        if (!hasResponse) {
          referenceBadgeEl.textContent = "Latest response: none";
          return;
        }

        const time = formatReferenceTime(latestResponseTimestamp);
        const responseLabel = latestResponseKind === "critique" ? "assistant critique" : "assistant response";
        const total = Array.isArray(responseHistory) ? responseHistory.length : 0;
        const selected = total > 0 && responseHistoryIndex >= 0 && responseHistoryIndex < total
          ? responseHistoryIndex + 1
          : 0;
        const historyPrefix = total > 0 ? "Response history " + selected + "/" + total + " · " : "";
        referenceBadgeEl.textContent = time
          ? historyPrefix + responseLabel + " · " + time
          : historyPrefix + responseLabel;
      }

      function normalizeForCompare(text) {
        return String(text || "").replace(/\r\n/g, "\n").trimEnd();
      }

      function isTextEquivalent(a, b) {
        return normalizeForCompare(a) === normalizeForCompare(b);
      }

      function hasAnnotationMarkers(text) {
        return annotationHelpers.hasAnnotationMarkers(text);
      }

      function stripAnnotationMarkers(text) {
        return annotationHelpers.stripAnnotationMarkers(text);
      }

      function prepareEditorTextForSend(text) {
        const raw = String(text || "");
        return annotationsEnabled ? raw : stripAnnotationMarkers(raw);
      }

      function prepareEditorTextForPreview(text) {
        const raw = String(text || "");
        return annotationsEnabled ? raw : stripAnnotationMarkers(raw);
      }

      function prepareMarkdownForPandocPreview(markdown) {
        return annotationHelpers.prepareMarkdownForPandocPreview(markdown, PREVIEW_ANNOTATION_PLACEHOLDER_PREFIX);
      }

      function wrapAsFencedCodeBlock(text, language) {
        const source = String(text || "").trimEnd();
        const lang = String(language || "").trim();
        const backtickFence = "```";
        const newline = "\n";
        const marker = source.includes(backtickFence) ? "~~~" : backtickFence;
        return marker + (lang ? lang : "") + newline + source + newline + marker;
      }

      function prepareEditorTextForPdfExport(text) {
        const prepared = prepareEditorTextForPreview(text);
        const lang = normalizeFenceLanguage(editorLanguage || "");
        if (lang && lang !== "markdown" && lang !== "latex") {
          return wrapAsFencedCodeBlock(prepared, lang);
        }
        return prepared;
      }

      function updateSyncBadge(normalizedEditorText) {
        if (!syncBadgeEl) return;

        const showingThinking = rightView === "thinking";
        const hasComparableContent = showingThinking
          ? Boolean(latestResponseThinking && latestResponseThinking.trim())
          : latestResponseHasContent;

        if (!hasComparableContent) {
          syncBadgeEl.hidden = true;
          syncBadgeEl.textContent = showingThinking ? "In sync with thinking" : "In sync with response";
          syncBadgeEl.classList.remove("sync");
          return;
        }

        const normalizedEditor = typeof normalizedEditorText === "string"
          ? normalizedEditorText
          : normalizeForCompare(sourceTextEl.value);
        const targetNormalized = showingThinking ? latestResponseThinkingNormalized : latestResponseNormalized;
        const inSync = normalizedEditor === targetNormalized;
        syncBadgeEl.hidden = !inSync;
        syncBadgeEl.textContent = showingThinking ? "In sync with thinking" : "In sync with response";

        if (inSync) {
          syncBadgeEl.classList.add("sync");
          return;
        }

        syncBadgeEl.classList.remove("sync");
      }

      function buildPlainMarkdownHtml(markdown) {
        return "<pre class='plain-markdown'>" + escapeHtml(String(markdown || "")) + "</pre>";
      }

      function buildPreviewErrorHtml(message, markdown) {
        return "<div class='preview-error'>" + escapeHtml(String(message || "Preview rendering failed.")) + "</div>" + buildPlainMarkdownHtml(markdown);
      }

      function sanitizeRenderedHtml(html, markdown) {
        const rawHtml = typeof html === "string" ? html : "";
        const mathAnnotationStripped = rawHtml
          .replace(/<annotation-xml\b[\s\S]*?<\/annotation-xml>/gi, "")
          .replace(/<annotation\b[\s\S]*?<\/annotation>/gi, "");

        if (window.DOMPurify && typeof window.DOMPurify.sanitize === "function") {
          return window.DOMPurify.sanitize(mathAnnotationStripped, {
            USE_PROFILES: {
              html: true,
              mathMl: true,
              svg: true,
            },
            ADD_TAGS: ["embed"],
            ADD_ATTR: ["src", "type", "title", "width", "height", "style", "data-fig-align"],
            ADD_DATA_URI_TAGS: ["embed"],
          });
        }
        return buildPreviewErrorHtml("Preview sanitizer unavailable. Showing plain markdown.", markdown);
      }

      function isPdfPreviewSource(src) {
        return Boolean(src) && (/^data:application\/pdf(?:;|,)/i.test(src) || /\.pdf(?:$|[?#])/i.test(src));
      }

      function decoratePdfEmbeds(targetEl) {
        if (!targetEl || typeof targetEl.querySelectorAll !== "function") {
          return;
        }

        const embeds = targetEl.querySelectorAll("embed[src]");
        embeds.forEach(function(embedEl) {
          const src = typeof embedEl.getAttribute === "function" ? (embedEl.getAttribute("src") || "") : "";
          if (!isPdfPreviewSource(src)) {
            return;
          }
          if (!embedEl.getAttribute("type")) {
            embedEl.setAttribute("type", "application/pdf");
          }
          if (!embedEl.getAttribute("title")) {
            embedEl.setAttribute("title", "Embedded PDF figure");
          }
        });
      }

      function decodePdfDataUri(src) {
        const match = String(src || "").match(/^data:application\/pdf(?:;[^,]*)?,([A-Za-z0-9+/=\s]+)$/i);
        if (!match) return null;
        const payload = (match[1] || "").replace(/\s+/g, "");
        if (!payload) return null;
        const binary = window.atob(payload);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
      }

      function ensurePdfJs() {
        if (window.pdfjsLib && typeof window.pdfjsLib.getDocument === "function") {
          return Promise.resolve(window.pdfjsLib);
        }
        if (pdfJsPromise) {
          return pdfJsPromise;
        }

        pdfJsPromise = import(PDFJS_CDN_URL)
          .then((module) => {
            const api = module && typeof module.getDocument === "function"
              ? module
              : (module && module.default && typeof module.default.getDocument === "function" ? module.default : null);
            if (!api || typeof api.getDocument !== "function") {
              throw new Error("pdf.js did not initialize.");
            }
            if (api.GlobalWorkerOptions && !api.GlobalWorkerOptions.workerSrc) {
              api.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN_URL;
            }
            window.pdfjsLib = api;
            return api;
          })
          .catch((error) => {
            pdfJsPromise = null;
            throw error;
          });

        return pdfJsPromise;
      }

      function appendPdfPreviewNotice(targetEl, message) {
        if (!targetEl || typeof targetEl.querySelector !== "function" || typeof targetEl.appendChild !== "function") {
          return;
        }
        if (targetEl.querySelector(".preview-pdf-warning")) {
          return;
        }
        const warningEl = document.createElement("div");
        warningEl.className = "preview-warning preview-pdf-warning";
        warningEl.textContent = String(message || PDF_PREVIEW_UNAVAILABLE_MESSAGE);
        targetEl.appendChild(warningEl);
      }

      async function loadPdfDocumentSource(src) {
        const embedded = decodePdfDataUri(src);
        if (embedded) {
          return { data: embedded };
        }
        const response = await fetch(src);
        if (!response.ok) {
          throw new Error("Failed to fetch PDF figure for preview.");
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        return { data: bytes };
      }

      async function renderSinglePdfPreviewEmbed(embedEl, pdfjsLib) {
        if (!embedEl || embedEl.dataset.studioPdfPreviewRendered === "1") {
          return false;
        }

        const src = embedEl.getAttribute("src") || "";
        if (!isPdfPreviewSource(src)) {
          return false;
        }

        const measuredWidth = Math.max(1, Math.round(embedEl.getBoundingClientRect().width || 0));
        const styleText = embedEl.getAttribute("style") || "";
        const widthAttr = embedEl.getAttribute("width") || "";
        const figAlign = embedEl.getAttribute("data-fig-align") || "";
        const pdfSource = await loadPdfDocumentSource(src);
        const loadingTask = pdfjsLib.getDocument(pdfSource);
        const pdfDocument = await loadingTask.promise;

        try {
          const page = await pdfDocument.getPage(1);
          const baseViewport = page.getViewport({ scale: 1 });
          const cssWidth = Math.max(1, measuredWidth || Math.round(baseViewport.width));
          const renderScale = Math.max(0.25, cssWidth / baseViewport.width) * Math.min(window.devicePixelRatio || 1, 2);
          const viewport = page.getViewport({ scale: renderScale });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d", { alpha: false });
          if (!context) {
            throw new Error("Canvas 2D context unavailable.");
          }

          canvas.width = Math.max(1, Math.ceil(viewport.width));
          canvas.height = Math.max(1, Math.ceil(viewport.height));
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          canvas.setAttribute("aria-label", "PDF figure preview");

          await page.render({
            canvasContext: context,
            viewport,
          }).promise;

          const wrapper = document.createElement("div");
          wrapper.className = "studio-pdf-preview";
          if (styleText) {
            wrapper.style.cssText = styleText;
          } else if (widthAttr) {
            wrapper.style.width = /^\d+(?:\.\d+)?$/.test(widthAttr) ? (widthAttr + "px") : widthAttr;
          } else {
            wrapper.style.width = "100%";
          }
          if (figAlign) {
            wrapper.setAttribute("data-fig-align", figAlign);
          }
          wrapper.title = "PDF figure preview (page 1)";
          wrapper.appendChild(canvas);
          embedEl.dataset.studioPdfPreviewRendered = "1";
          embedEl.replaceWith(wrapper);
          return true;
        } finally {
          if (typeof pdfDocument.cleanup === "function") {
            try { pdfDocument.cleanup(); } catch {}
          }
          if (typeof pdfDocument.destroy === "function") {
            try { await pdfDocument.destroy(); } catch {}
          }
        }
      }

      async function renderPdfPreviewsInElement(targetEl) {
        if (!targetEl || typeof targetEl.querySelectorAll !== "function") {
          return;
        }

        const embeds = Array.from(targetEl.querySelectorAll("embed[src]"))
          .filter((embedEl) => isPdfPreviewSource(embedEl.getAttribute("src") || ""));
        if (embeds.length === 0) {
          return;
        }

        let pdfjsLib;
        try {
          pdfjsLib = await ensurePdfJs();
        } catch (error) {
          console.error("pdf.js load failed:", error);
          appendPdfPreviewNotice(targetEl, PDF_PREVIEW_UNAVAILABLE_MESSAGE);
          return;
        }

        let hadFailure = false;
        for (const embedEl of embeds) {
          try {
            await renderSinglePdfPreviewEmbed(embedEl, pdfjsLib);
          } catch (error) {
            hadFailure = true;
            console.error("PDF preview render failed:", error);
          }
        }

        if (hadFailure) {
          appendPdfPreviewNotice(targetEl, PDF_PREVIEW_RENDER_FAIL_MESSAGE);
        }
      }

      function appendMathFallbackNotice(targetEl, message) {
        if (!targetEl || typeof targetEl.querySelector !== "function" || typeof targetEl.appendChild !== "function") {
          return;
        }

        if (targetEl.querySelector(".preview-math-warning")) {
          return;
        }

        const warningEl = document.createElement("div");
        warningEl.className = "preview-warning preview-math-warning";
        warningEl.textContent = String(message || MATHJAX_UNAVAILABLE_MESSAGE);
        targetEl.appendChild(warningEl);
      }

      function extractMathFallbackTex(text, displayMode) {
        const source = typeof text === "string" ? text.trim() : "";
        if (!source) return "";

        if (displayMode) {
          if (source.startsWith("$$") && source.endsWith("$$") && source.length >= 4) {
            return source.slice(2, -2).replace(/^\s+|\s+$/g, "");
          }
          if (source.startsWith("\\[") && source.endsWith("\\]") && source.length >= 4) {
            return source.slice(2, -2).replace(/^\s+|\s+$/g, "");
          }
          return source;
        }

        if (source.startsWith("\\(") && source.endsWith("\\)") && source.length >= 4) {
          return source.slice(2, -2).trim();
        }
        if (source.startsWith("$") && source.endsWith("$") && source.length >= 2) {
          return source.slice(1, -1).trim();
        }
        return source;
      }

      function collectMathFallbackTargets(targetEl) {
        if (!targetEl || typeof targetEl.querySelectorAll !== "function") return [];

        const nodes = Array.from(targetEl.querySelectorAll(".math.display, .math.inline"));
        const targets = [];
        const seenTargets = new Set();

        nodes.forEach((node) => {
          if (!node || !node.classList) return;
          const displayMode = node.classList.contains("display");
          const rawText = typeof node.textContent === "string" ? node.textContent : "";
          const tex = extractMathFallbackTex(rawText, displayMode);
          if (!tex) return;

          let renderTarget = node;
          if (displayMode) {
            const parent = node.parentElement;
            const parentText = parent && typeof parent.textContent === "string" ? parent.textContent.trim() : "";
            if (parent && parent.tagName === "P" && parentText === rawText.trim()) {
              renderTarget = parent;
            }
          }

          if (seenTargets.has(renderTarget)) return;
          seenTargets.add(renderTarget);
          targets.push({ node, renderTarget, displayMode, tex });
        });

        return targets;
      }

      function ensureMathJax() {
        if (window.MathJax && typeof window.MathJax.typesetPromise === "function") {
          return Promise.resolve(window.MathJax);
        }

        if (mathJaxPromise) {
          return mathJaxPromise;
        }

        mathJaxPromise = new Promise((resolve, reject) => {
          const globalMathJax = (window.MathJax && typeof window.MathJax === "object") ? window.MathJax : {};
          const texConfig = (globalMathJax.tex && typeof globalMathJax.tex === "object") ? globalMathJax.tex : {};
          const loaderConfig = (globalMathJax.loader && typeof globalMathJax.loader === "object") ? globalMathJax.loader : {};
          const startupConfig = (globalMathJax.startup && typeof globalMathJax.startup === "object") ? globalMathJax.startup : {};
          const optionsConfig = (globalMathJax.options && typeof globalMathJax.options === "object") ? globalMathJax.options : {};
          const loaderEntries = Array.isArray(loaderConfig.load) ? loaderConfig.load.slice() : [];
          ["[tex]/ams", "[tex]/noerrors", "[tex]/noundefined"].forEach((entry) => {
            if (loaderEntries.indexOf(entry) === -1) loaderEntries.push(entry);
          });

          window.MathJax = Object.assign({}, globalMathJax, {
            loader: Object.assign({}, loaderConfig, {
              load: loaderEntries,
            }),
            tex: Object.assign({}, texConfig, {
              inlineMath: [["\\(", "\\)"], ["$", "$"]],
              displayMath: [["\\[", "\\]"], ["$$", "$$"]],
              packages: Object.assign({}, texConfig.packages || {}, { "[+]": ["ams", "noerrors", "noundefined"] }),
            }),
            options: Object.assign({}, optionsConfig, {
              skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"],
            }),
            startup: Object.assign({}, startupConfig, {
              typeset: false,
            }),
          });

          const script = document.createElement("script");
          script.src = MATHJAX_CDN_URL;
          script.async = true;
          script.dataset.piStudioMathjax = "1";
          script.onload = () => {
            const api = window.MathJax;
            if (api && api.startup && api.startup.promise && typeof api.startup.promise.then === "function") {
              api.startup.promise.then(() => resolve(api)).catch(reject);
              return;
            }
            if (api && typeof api.typesetPromise === "function") {
              resolve(api);
              return;
            }
            reject(new Error("MathJax did not initialize."));
          };
          script.onerror = () => {
            reject(new Error("Failed to load MathJax."));
          };
          document.head.appendChild(script);
        }).catch((error) => {
          mathJaxPromise = null;
          throw error;
        });

        return mathJaxPromise;
      }

      async function renderMathFallbackInElement(targetEl) {
        const fallbackTargets = collectMathFallbackTargets(targetEl);
        if (fallbackTargets.length === 0) return;

        fallbackTargets.forEach((entry) => {
          entry.renderTarget.classList.add("studio-mathjax-fallback");
          if (entry.displayMode) {
            entry.renderTarget.classList.add("studio-mathjax-fallback-display");
            entry.renderTarget.textContent = "\\[\n" + entry.tex + "\n\\]";
          } else {
            entry.renderTarget.textContent = "\\(" + entry.tex + "\\)";
          }
        });

        let mathJax;
        try {
          mathJax = await ensureMathJax();
        } catch (error) {
          console.error("MathJax load failed:", error);
          appendMathFallbackNotice(targetEl, MATHJAX_UNAVAILABLE_MESSAGE);
          return;
        }

        try {
          await mathJax.typesetPromise(fallbackTargets.map((entry) => entry.renderTarget));
        } catch (error) {
          console.error("MathJax fallback render failed:", error);
          appendMathFallbackNotice(targetEl, MATHJAX_RENDER_FAIL_MESSAGE);
        }
      }

      async function renderAnnotationMathInElement(targetEl) {
        if (!targetEl || typeof targetEl.querySelectorAll !== "function") return;

        const markers = Array.from(targetEl.querySelectorAll(".annotation-preview-marker")).filter((node) => {
          const text = typeof node.textContent === "string" ? node.textContent : "";
          return /\\\(|\\\[|\$\$?|\\[A-Za-z]+/.test(text);
        });
        if (markers.length === 0) return;

        let mathJax;
        try {
          mathJax = await ensureMathJax();
        } catch (error) {
          console.error("Annotation MathJax load failed:", error);
          appendMathFallbackNotice(targetEl, MATHJAX_UNAVAILABLE_MESSAGE);
          return;
        }

        try {
          await mathJax.typesetPromise(markers);
        } catch (error) {
          console.error("Annotation math render failed:", error);
          appendMathFallbackNotice(targetEl, MATHJAX_RENDER_FAIL_MESSAGE);
        }
      }

      function applyPreviewAnnotationPlaceholdersToElement(targetEl, placeholders) {
        if (!targetEl || !Array.isArray(placeholders) || placeholders.length === 0) return;
        if (typeof document.createTreeWalker !== "function") return;

        const placeholderMap = new Map();
        const placeholderTokens = [];
        placeholders.forEach(function(entry) {
          const token = entry && typeof entry.token === "string" ? entry.token : "";
          if (!token) return;
          placeholderMap.set(token, entry);
          placeholderTokens.push(token);
        });
        if (placeholderTokens.length === 0) return;

        const placeholderPattern = new RegExp(placeholderTokens.map(escapeRegExp).join("|"), "g");
        const walker = document.createTreeWalker(targetEl, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        let node = walker.nextNode();
        while (node) {
          const textNode = node;
          const value = typeof textNode.nodeValue === "string" ? textNode.nodeValue : "";
          if (value && value.indexOf(PREVIEW_ANNOTATION_PLACEHOLDER_PREFIX) !== -1) {
            const parent = textNode.parentElement;
            const tag = parent && parent.tagName ? parent.tagName.toUpperCase() : "";
            if (tag !== "CODE" && tag !== "PRE" && tag !== "SCRIPT" && tag !== "STYLE" && tag !== "TEXTAREA") {
              textNodes.push(textNode);
            }
          }
          node = walker.nextNode();
        }

        textNodes.forEach(function(textNode) {
          const text = typeof textNode.nodeValue === "string" ? textNode.nodeValue : "";
          if (!text) return;
          placeholderPattern.lastIndex = 0;
          if (!placeholderPattern.test(text)) return;
          placeholderPattern.lastIndex = 0;

          const fragment = document.createDocumentFragment();
          let lastIndex = 0;
          let match;
          while ((match = placeholderPattern.exec(text)) !== null) {
            const token = match[0] || "";
            const entry = placeholderMap.get(token);
            const start = typeof match.index === "number" ? match.index : 0;
            if (start > lastIndex) {
              fragment.appendChild(document.createTextNode(text.slice(lastIndex, start)));
            }
            if (entry) {
              const markerEl = document.createElement("span");
              markerEl.className = "annotation-preview-marker";
              const markerText = typeof entry.text === "string" ? entry.text : token;
              markerEl.title = typeof entry.title === "string" ? entry.title : markerText;
              setAnnotationPreviewMarkerContent(markerEl, markerText);
              fragment.appendChild(markerEl);
            } else {
              fragment.appendChild(document.createTextNode(token));
            }
            lastIndex = start + token.length;
            if (token.length === 0) {
              placeholderPattern.lastIndex += 1;
            }
          }

          if (lastIndex < text.length) {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
          }

          if (textNode.parentNode) {
            textNode.parentNode.replaceChild(fragment, textNode);
          }
        });
      }

      function applyAnnotationMarkersToElement(targetEl, mode) {
        if (!targetEl || mode === "none") return;
        if (typeof document.createTreeWalker !== "function") return;

        const walker = document.createTreeWalker(targetEl, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        let node = walker.nextNode();
        while (node) {
          const textNode = node;
          const value = typeof textNode.nodeValue === "string" ? textNode.nodeValue : "";
          if (value && value.toLowerCase().indexOf("[an:") !== -1) {
            const parent = textNode.parentElement;
            const tag = parent && parent.tagName ? parent.tagName.toUpperCase() : "";
            if (tag !== "CODE" && tag !== "PRE" && tag !== "SCRIPT" && tag !== "STYLE" && tag !== "TEXTAREA") {
              textNodes.push(textNode);
            }
          }
          node = walker.nextNode();
        }

        for (const textNode of textNodes) {
          const text = typeof textNode.nodeValue === "string" ? textNode.nodeValue : "";
          if (!text) continue;
          const markers = annotationHelpers.collectInlineAnnotationMarkers(text);
          if (markers.length === 0) continue;

          const fragment = document.createDocumentFragment();
          let lastIndex = 0;
          markers.forEach(function(marker) {
            const token = marker.raw || "";
            if (marker.start > lastIndex) {
              fragment.appendChild(document.createTextNode(text.slice(lastIndex, marker.start)));
            }

            if (mode === "highlight") {
              const markerEl = document.createElement("span");
              markerEl.className = "annotation-preview-marker";
              const markerText = annotationHelpers.normalizePreviewAnnotationLabel(marker.body) || token;
              markerEl.title = token;
              setAnnotationPreviewMarkerContent(markerEl, markerText);
              fragment.appendChild(markerEl);
            }

            lastIndex = marker.end;
          });

          if (lastIndex < text.length) {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
          }

          if (textNode.parentNode) {
            textNode.parentNode.replaceChild(fragment, textNode);
          }
        }
      }

      function appendMermaidNotice(targetEl, message) {
        if (!targetEl || typeof targetEl.querySelector !== "function" || typeof targetEl.appendChild !== "function") {
          return;
        }

        if (targetEl.querySelector(".preview-mermaid-warning")) {
          return;
        }

        const warningEl = document.createElement("div");
        warningEl.className = "preview-warning preview-mermaid-warning";
        warningEl.textContent = String(message || MERMAID_RENDER_FAIL_MESSAGE);
        targetEl.appendChild(warningEl);
      }

      function appendPreviewNotice(targetEl, message) {
        if (!targetEl || typeof targetEl.querySelector !== "function" || typeof targetEl.appendChild !== "function") return;
        if (targetEl.querySelector(".preview-image-warning")) return;
        const el = document.createElement("div");
        el.className = "preview-warning preview-image-warning";
        el.textContent = String(message || "");
        targetEl.appendChild(el);
      }

      function hasMeaningfulPreviewContent(targetEl) {
        if (!targetEl || typeof targetEl.querySelector !== "function") return false;
        if (targetEl.querySelector(".preview-loading")) return false;
        const text = typeof targetEl.textContent === "string" ? targetEl.textContent.trim() : "";
        return text.length > 0;
      }

      function beginPreviewRender(targetEl) {
        if (!targetEl || !targetEl.classList) return;

        const pendingTimer = previewPendingTimers.get(targetEl);
        if (pendingTimer !== undefined) {
          window.clearTimeout(pendingTimer);
          previewPendingTimers.delete(targetEl);
        }

        if (hasMeaningfulPreviewContent(targetEl)) {
          targetEl.classList.remove("preview-pending");
          const timerId = window.setTimeout(() => {
            previewPendingTimers.delete(targetEl);
            if (!targetEl || !targetEl.classList) return;
            if (!hasMeaningfulPreviewContent(targetEl)) return;
            targetEl.classList.add("preview-pending");
          }, PREVIEW_PENDING_BADGE_DELAY_MS);
          previewPendingTimers.set(targetEl, timerId);
          return;
        }

        targetEl.classList.remove("preview-pending");
        targetEl.innerHTML = "<div class='preview-loading'>Rendering preview…</div>";
      }

      function finishPreviewRender(targetEl) {
        if (!targetEl || !targetEl.classList) return;
        const pendingTimer = previewPendingTimers.get(targetEl);
        if (pendingTimer !== undefined) {
          window.clearTimeout(pendingTimer);
          previewPendingTimers.delete(targetEl);
        }
        targetEl.classList.remove("preview-pending");
      }

      function scheduleResponsePaneRepaintNudge() {
        if (!critiqueViewEl || typeof critiqueViewEl.getBoundingClientRect !== "function") return;
        const schedule = typeof window.requestAnimationFrame === "function"
          ? window.requestAnimationFrame.bind(window)
          : (cb) => window.setTimeout(cb, 16);

        schedule(() => {
          if (!critiqueViewEl || !critiqueViewEl.isConnected) return;
          void critiqueViewEl.getBoundingClientRect();
          if (!critiqueViewEl.classList) return;
          critiqueViewEl.classList.add("response-repaint-nudge");
          schedule(() => {
            if (!critiqueViewEl || !critiqueViewEl.classList) return;
            critiqueViewEl.classList.remove("response-repaint-nudge");
          });
        });
      }

      function applyPendingResponseScrollReset() {
        if (!pendingResponseScrollReset || !critiqueViewEl) return false;
        if (rightView === "editor-preview") return false;
        critiqueViewEl.scrollTop = 0;
        critiqueViewEl.scrollLeft = 0;
        pendingResponseScrollReset = false;
        return true;
      }

      async function getMermaidApi() {
        if (mermaidModulePromise) {
          return mermaidModulePromise;
        }

        mermaidModulePromise = import(MERMAID_CDN_URL)
          .then((module) => {
            const mermaidApi = module && module.default ? module.default : null;
            if (!mermaidApi) {
              throw new Error("Mermaid module did not expose a default export.");
            }

            if (!mermaidInitialized) {
              mermaidApi.initialize(MERMAID_CONFIG);
              mermaidInitialized = true;
            }

            return mermaidApi;
          })
          .catch((error) => {
            mermaidModulePromise = null;
            throw error;
          });

        return mermaidModulePromise;
      }

      async function renderMermaidInElement(targetEl) {
        if (!targetEl || typeof targetEl.querySelectorAll !== "function") return;

        const mermaidBlocks = targetEl.querySelectorAll("pre.mermaid");
        if (!mermaidBlocks || mermaidBlocks.length === 0) return;

        let mermaidApi;
        try {
          mermaidApi = await getMermaidApi();
        } catch (error) {
          console.error("Mermaid module load failed:", error);
          appendMermaidNotice(targetEl, MERMAID_UNAVAILABLE_MESSAGE);
          return;
        }

        mermaidBlocks.forEach((preEl) => {
          const codeEl = preEl.querySelector("code");
          const source = codeEl ? codeEl.textContent : preEl.textContent;

          const wrapper = document.createElement("div");
          wrapper.className = "mermaid-container";

          const diagramEl = document.createElement("div");
          diagramEl.className = "mermaid";
          diagramEl.textContent = source || "";

          wrapper.appendChild(diagramEl);
          preEl.replaceWith(wrapper);
        });

        const diagramNodes = Array.from(targetEl.querySelectorAll(".mermaid"));
        if (diagramNodes.length === 0) return;

        try {
          await mermaidApi.run({ nodes: diagramNodes });
        } catch (error) {
          try {
            await mermaidApi.run();
          } catch (fallbackError) {
            console.error("Mermaid render failed:", fallbackError || error);
            appendMermaidNotice(targetEl, MERMAID_RENDER_FAIL_MESSAGE);
          }
        }
      }

      async function renderMarkdownWithPandoc(markdown) {
        const token = getToken();
        if (!token) {
          throw new Error("Missing Studio token in URL.");
        }

        if (typeof fetch !== "function") {
          throw new Error("Browser fetch API is unavailable.");
        }

        const controller = typeof AbortController === "function" ? new AbortController() : null;
        const timeoutId = controller ? window.setTimeout(() => controller.abort(), 8000) : null;

        let response;
        try {
          const effectivePath = getEffectiveSavePath();
          const sourcePath = effectivePath || sourceState.path || "";
          response = await fetch("/render-preview?token=" + encodeURIComponent(token), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              markdown: String(markdown || ""),
              sourcePath: sourcePath,
              resourceDir: (!sourcePath && resourceDirInput) ? resourceDirInput.value.trim() : "",
            }),
            signal: controller ? controller.signal : undefined,
          });
        } catch (error) {
          if (error && error.name === "AbortError") {
            throw new Error("Preview request timed out.");
          }
          throw error;
        } finally {
          if (timeoutId) {
            window.clearTimeout(timeoutId);
          }
        }

        const rawBody = await response.text();
        let payload = null;
        try {
          payload = rawBody ? JSON.parse(rawBody) : null;
        } catch {
          payload = null;
        }

        if (!response.ok) {
          const message = payload && typeof payload.error === "string"
            ? payload.error
            : "Preview request failed with HTTP " + response.status + ".";
          throw new Error(message);
        }

        if (!payload || payload.ok !== true || typeof payload.html !== "string") {
          const message = payload && typeof payload.error === "string"
            ? payload.error
            : "Preview renderer returned an invalid payload.";
          throw new Error(message);
        }

        return payload.html;
      }

      function parseContentDispositionFilename(headerValue) {
        if (!headerValue || typeof headerValue !== "string") return "";

        const utfMatch = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
        if (utfMatch && utfMatch[1]) {
          try {
            return decodeURIComponent(utfMatch[1].trim());
          } catch {
            return utfMatch[1].trim();
          }
        }

        const quotedMatch = headerValue.match(/filename="([^"]+)"/i);
        if (quotedMatch && quotedMatch[1]) return quotedMatch[1].trim();

        const plainMatch = headerValue.match(/filename=([^;]+)/i);
        if (plainMatch && plainMatch[1]) return plainMatch[1].trim();

        return "";
      }

      async function exportRightPanePdf() {
        if (uiBusy || pdfExportInProgress) {
          setStatus("Studio is busy.", "warning");
          return;
        }

        const token = getToken();
        if (!token) {
          setStatus("Missing Studio token in URL. Re-run /studio.", "error");
          return;
        }

        const rightPaneShowsPreview = rightView === "preview" || rightView === "editor-preview";
        if (!rightPaneShowsPreview) {
          setStatus("Switch right pane to Response (Preview) or Editor (Preview) to export PDF.", "warning");
          return;
        }

        const markdown = rightView === "editor-preview"
          ? prepareEditorTextForPdfExport(sourceTextEl.value)
          : prepareEditorTextForPreview(latestResponseMarkdown);
        if (!markdown || !markdown.trim()) {
          setStatus("Nothing to export yet.", "warning");
          return;
        }

        const effectivePath = getEffectiveSavePath();
        const sourcePath = effectivePath || sourceState.path || "";
        const resourceDir = (!sourcePath && resourceDirInput) ? resourceDirInput.value.trim() : "";
        const isEditorPreview = rightView === "editor-preview";
        const editorPdfLanguage = isEditorPreview ? normalizeFenceLanguage(editorLanguage || "") : "";
        const isLatex = isEditorPreview
          ? editorPdfLanguage === "latex"
          : /\\documentclass\b|\\begin\{document\}/.test(markdown);
        let filenameHint = isEditorPreview ? "studio-editor-preview.pdf" : "studio-response-preview.pdf";
        if (sourcePath) {
          const baseName = sourcePath.split(/[\\/]/).pop() || "studio";
          const stem = baseName.replace(/\.[^.]+$/, "") || "studio";
          filenameHint = stem + "-preview.pdf";
        }

        pdfExportInProgress = true;
        updateResultActionButtons();
        setStatus("Exporting PDF…", "warning");

        try {
          const response = await fetch("/export-pdf?token=" + encodeURIComponent(token), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              markdown: String(markdown || ""),
              sourcePath: sourcePath,
              resourceDir: resourceDir,
              isLatex: isLatex,
              editorPdfLanguage: editorPdfLanguage,
              filenameHint: filenameHint,
            }),
          });

          const contentType = String(response.headers.get("content-type") || "").toLowerCase();
          if (!response.ok) {
            let message = "PDF export failed with HTTP " + response.status + ".";
            if (contentType.includes("application/json")) {
              const payload = await response.json().catch(() => null);
              if (payload && typeof payload.error === "string") {
                message = payload.error;
              }
            } else {
              const text = await response.text().catch(() => "");
              if (text && text.trim()) {
                message = text.trim();
              }
            }
            throw new Error(message);
          }

          if (contentType.includes("application/json")) {
            const payload = await response.json().catch(() => null);
            if (!payload || typeof payload.downloadUrl !== "string") {
              throw new Error("PDF export prepared successfully, but Studio did not receive a download URL.");
            }

            const exportWarning = typeof payload.warning === "string" ? payload.warning.trim() : "";
            const openError = typeof payload.openError === "string" ? payload.openError.trim() : "";
            const openedExternal = payload.openedExternal === true;
            let downloadName = typeof payload.filename === "string" && payload.filename.trim()
              ? payload.filename.trim()
              : (filenameHint || "studio-preview.pdf");
            if (!/\.pdf$/i.test(downloadName)) {
              downloadName += ".pdf";
            }

            if (openedExternal) {
              if (exportWarning) {
                setStatus("Opened PDF in default viewer with warning: " + exportWarning, "warning");
              } else {
                setStatus("Opened PDF in default viewer: " + downloadName, "success");
              }
              return;
            }

            const link = document.createElement("a");
            link.href = payload.downloadUrl;
            link.download = downloadName;
            link.rel = "noopener";
            document.body.appendChild(link);
            link.click();
            link.remove();

            if (openError) {
              if (exportWarning) {
                setStatus("Opened browser fallback because external viewer failed (" + openError + "). Warning: " + exportWarning, "warning");
              } else {
                setStatus("Opened browser fallback because external viewer failed (" + openError + ").", "warning");
              }
            } else if (exportWarning) {
              setStatus("Exported PDF with warning: " + exportWarning, "warning");
            } else {
              setStatus("Exported PDF: " + downloadName, "success");
            }
            return;
          }

          const exportWarning = String(response.headers.get("x-pi-studio-export-warning") || "").trim();
          const blob = await response.blob();
          const headerFilename = parseContentDispositionFilename(response.headers.get("content-disposition"));
          let downloadName = headerFilename || filenameHint || "studio-preview.pdf";
          if (!/\.pdf$/i.test(downloadName)) {
            downloadName += ".pdf";
          }

          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = blobUrl;
          link.download = downloadName;
          link.rel = "noopener";
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
          }, 1800);

          if (exportWarning) {
            setStatus("Exported PDF with warning: " + exportWarning, "warning");
          } else {
            setStatus("Exported PDF: " + downloadName, "success");
          }
        } catch (error) {
          const detail = error && error.message ? error.message : String(error || "unknown error");
          setStatus("PDF export failed: " + detail, "error");
        } finally {
          pdfExportInProgress = false;
          updateResultActionButtons();
        }
      }

      async function applyRenderedMarkdown(targetEl, markdown, pane, nonce) {
        const previewPrepared = annotationsEnabled
          ? prepareMarkdownForPandocPreview(markdown)
          : { markdown: stripAnnotationMarkers(String(markdown || "")), placeholders: [] };

        try {
          const renderedHtml = await renderMarkdownWithPandoc(previewPrepared.markdown);

          if (pane === "source") {
            if (nonce !== sourcePreviewRenderNonce || editorView !== "preview") return;
          } else {
            if (nonce !== responsePreviewRenderNonce || (rightView !== "preview" && rightView !== "editor-preview")) return;
          }

          finishPreviewRender(targetEl);
          targetEl.innerHTML = sanitizeRenderedHtml(renderedHtml, markdown);
          applyPreviewAnnotationPlaceholdersToElement(targetEl, previewPrepared.placeholders);
          await renderAnnotationMathInElement(targetEl);
          decoratePdfEmbeds(targetEl);
          await renderPdfPreviewsInElement(targetEl);
          const annotationMode = (pane === "source" || pane === "response")
            ? (annotationsEnabled ? "highlight" : "hide")
            : "none";
          applyAnnotationMarkersToElement(targetEl, annotationMode);
          await renderMermaidInElement(targetEl);
          await renderMathFallbackInElement(targetEl);

          // Warn if relative images are present but unlikely to resolve (non-file-backed content)
          if (!sourceState.path && !(resourceDirInput && resourceDirInput.value.trim())) {
            var hasRelativeImages = /!\[.*?\]\((?!https?:\/\/|data:)[^)]+\)/.test(markdown || "");
            var hasLatexImages = /\\includegraphics/.test(markdown || "");
            if (hasRelativeImages || hasLatexImages) {
              appendPreviewNotice(targetEl, "Images not displaying? Set working dir in the editor pane or open via /studio <path>.");
            }
          }

          if (pane === "response") {
            applyPendingResponseScrollReset();
            scheduleResponsePaneRepaintNudge();
          }
        } catch (error) {
          if (pane === "source") {
            if (nonce !== sourcePreviewRenderNonce || editorView !== "preview") return;
          } else {
            if (nonce !== responsePreviewRenderNonce || (rightView !== "preview" && rightView !== "editor-preview")) return;
          }

          const detail = error && error.message ? error.message : String(error || "unknown error");
          finishPreviewRender(targetEl);
          targetEl.innerHTML = buildPreviewErrorHtml("Preview renderer unavailable (" + detail + "). Showing plain markdown.", markdown);
          if (pane === "response") {
            applyPendingResponseScrollReset();
            scheduleResponsePaneRepaintNudge();
          }
        }
      }

      function renderSourcePreviewNow() {
        if (editorView !== "preview") return;
        const text = prepareEditorTextForPreview(sourceTextEl.value || "");
        if (editorLanguage && editorLanguage !== "markdown" && editorLanguage !== "latex") {
          finishPreviewRender(sourcePreviewEl);
          sourcePreviewEl.innerHTML = "<div class='response-markdown-highlight'>" + highlightCode(text, editorLanguage, "preview") + "</div>";
          return;
        }
        const nonce = ++sourcePreviewRenderNonce;
        beginPreviewRender(sourcePreviewEl);
        void applyRenderedMarkdown(sourcePreviewEl, text, "source", nonce);
      }

      function scheduleSourcePreviewRender(delayMs) {
        if (sourcePreviewRenderTimer) {
          window.clearTimeout(sourcePreviewRenderTimer);
          sourcePreviewRenderTimer = null;
        }

        if (editorView !== "preview") return;

        const delay = typeof delayMs === "number" ? Math.max(0, delayMs) : 180;
        sourcePreviewRenderTimer = window.setTimeout(() => {
          sourcePreviewRenderTimer = null;
          renderSourcePreviewNow();
        }, delay);
      }

      function renderSourcePreview(options) {
        const previewDelayMs =
          options && typeof options.previewDelayMs === "number"
            ? Math.max(0, options.previewDelayMs)
            : 0;

        if (editorView === "preview") {
          scheduleSourcePreviewRender(previewDelayMs);
        }
        if (editorHighlightEnabled && editorView === "markdown") {
          scheduleEditorHighlightRender();
        }
        if (rightView === "editor-preview") {
          scheduleResponseEditorPreviewRender(previewDelayMs);
        }
      }

      function scheduleResponseEditorPreviewRender(delayMs) {
        if (responseEditorPreviewTimer) {
          window.clearTimeout(responseEditorPreviewTimer);
          responseEditorPreviewTimer = null;
        }

        if (rightView !== "editor-preview") return;

        const delay = typeof delayMs === "number" ? Math.max(0, delayMs) : 180;
        responseEditorPreviewTimer = window.setTimeout(() => {
          responseEditorPreviewTimer = null;
          renderActiveResult();
        }, delay);
      }

      function renderActiveResult() {
        if (rightView === "editor-preview") {
          const editorText = prepareEditorTextForPreview(sourceTextEl.value || "");
          if (!editorText.trim()) {
            finishPreviewRender(critiqueViewEl);
            critiqueViewEl.innerHTML = "<pre class='plain-markdown'>Editor is empty.</pre>";
            scheduleResponsePaneRepaintNudge();
            return;
          }
          if (editorLanguage && editorLanguage !== "markdown" && editorLanguage !== "latex") {
            finishPreviewRender(critiqueViewEl);
            critiqueViewEl.innerHTML = "<div class='response-markdown-highlight'>" + highlightCode(editorText, editorLanguage, "preview") + "</div>";
            scheduleResponsePaneRepaintNudge();
            return;
          }
          const nonce = ++responsePreviewRenderNonce;
          beginPreviewRender(critiqueViewEl);
          void applyRenderedMarkdown(critiqueViewEl, editorText, "response", nonce);
          return;
        }

        if (rightView === "thinking") {
          const thinking = latestResponseThinking;
          finishPreviewRender(critiqueViewEl);
          critiqueViewEl.innerHTML = thinking && thinking.trim()
            ? buildPlainMarkdownHtml(thinking)
            : "<pre class='plain-markdown'>No thinking available for this response.</pre>";
          applyPendingResponseScrollReset();
          scheduleResponsePaneRepaintNudge();
          return;
        }

        const markdown = latestResponseMarkdown;
        if (!markdown || !markdown.trim()) {
          finishPreviewRender(critiqueViewEl);
          critiqueViewEl.innerHTML = "<pre class='plain-markdown'>No response yet. Run editor text or critique editor text.</pre>";
          applyPendingResponseScrollReset();
          scheduleResponsePaneRepaintNudge();
          return;
        }

        if (rightView === "preview") {
          const nonce = ++responsePreviewRenderNonce;
          beginPreviewRender(critiqueViewEl);
          void applyRenderedMarkdown(critiqueViewEl, markdown, "response", nonce);
          return;
        }

        if (responseHighlightEnabled) {
          if (markdown.length > RESPONSE_HIGHLIGHT_MAX_CHARS) {
            finishPreviewRender(critiqueViewEl);
            critiqueViewEl.innerHTML = buildPreviewErrorHtml(
              "Response is too large for markdown highlighting. Showing plain markdown.",
              markdown,
            );
            applyPendingResponseScrollReset();
            scheduleResponsePaneRepaintNudge();
            return;
          }

          finishPreviewRender(critiqueViewEl);
          critiqueViewEl.innerHTML = "<div class='response-markdown-highlight'>" + highlightMarkdown(markdown) + "</div>";
          applyPendingResponseScrollReset();
          scheduleResponsePaneRepaintNudge();
          return;
        }

        finishPreviewRender(critiqueViewEl);
        critiqueViewEl.innerHTML = buildPlainMarkdownHtml(markdown);
        applyPendingResponseScrollReset();
        scheduleResponsePaneRepaintNudge();
      }

      function updateResultActionButtons(normalizedEditorText) {
        const hasResponse = latestResponseHasContent;
        const hasThinking = Boolean(latestResponseThinking && latestResponseThinking.trim());
        const normalizedEditor = typeof normalizedEditorText === "string"
          ? normalizedEditorText
          : normalizeForCompare(sourceTextEl.value);
        const responseLoaded = hasResponse && normalizedEditor === latestResponseNormalized;
        const thinkingLoaded = hasThinking && normalizedEditor === latestResponseThinkingNormalized;
        const isCritiqueResponse = hasResponse && latestResponseIsStructuredCritique;
        const showingThinking = rightView === "thinking";

        const critiqueNotes = isCritiqueResponse ? latestCritiqueNotes : "";
        const critiqueNotesLoaded = Boolean(critiqueNotes) && normalizedEditor === latestCritiqueNotesNormalized;

        if (showingThinking) {
          loadResponseBtn.hidden = false;
          loadCritiqueNotesBtn.hidden = true;
          loadCritiqueFullBtn.hidden = true;

          loadResponseBtn.disabled = uiBusy || !hasThinking || thinkingLoaded;
          loadResponseBtn.textContent = !hasThinking
            ? "Thinking unavailable"
            : (thinkingLoaded ? "Thinking already in editor" : "Load thinking into editor");

          copyResponseBtn.disabled = uiBusy || !hasThinking;
          copyResponseBtn.textContent = "Copy thinking text";
        } else {
          loadResponseBtn.hidden = isCritiqueResponse;
          loadCritiqueNotesBtn.hidden = !isCritiqueResponse;
          loadCritiqueFullBtn.hidden = !isCritiqueResponse;

          loadResponseBtn.disabled = uiBusy || !hasResponse || responseLoaded || isCritiqueResponse;
          loadResponseBtn.textContent = responseLoaded ? "Response already in editor" : "Load response into editor";

          loadCritiqueNotesBtn.disabled = uiBusy || !isCritiqueResponse || !critiqueNotes || critiqueNotesLoaded;
          loadCritiqueNotesBtn.textContent = critiqueNotesLoaded ? "Critique notes already in editor" : "Load critique notes into editor";

          loadCritiqueFullBtn.disabled = uiBusy || !isCritiqueResponse || responseLoaded;
          loadCritiqueFullBtn.textContent = responseLoaded ? "Full critique already in editor" : "Load full critique into editor";

          copyResponseBtn.disabled = uiBusy || !hasResponse;
          copyResponseBtn.textContent = "Copy response text";
        }

        const rightPaneShowsPreview = rightView === "preview" || rightView === "editor-preview";
        const exportText = rightView === "editor-preview" ? prepareEditorTextForPreview(sourceTextEl.value) : latestResponseMarkdown;
        const canExportPdf = rightPaneShowsPreview && Boolean(String(exportText || "").trim());
        if (exportPdfBtn) {
          exportPdfBtn.disabled = uiBusy || pdfExportInProgress || !canExportPdf;
          if (rightView === "thinking") {
            exportPdfBtn.title = "Thinking view does not support PDF export yet.";
          } else if (rightView === "markdown") {
            exportPdfBtn.title = "Switch right pane to Response (Preview) or Editor (Preview) to export PDF.";
          } else if (!canExportPdf) {
            exportPdfBtn.title = "Nothing to export yet.";
          } else {
            exportPdfBtn.title = "Export the current right-pane preview as PDF via pandoc + xelatex.";
          }
        }

        pullLatestBtn.disabled = uiBusy || followLatest;
        pullLatestBtn.textContent = queuedLatestResponse ? "Fetch latest response *" : "Fetch latest response";

        updateSyncBadge(normalizedEditor);
      }

      function refreshResponseUi() {
        updateSourceBadge();
        updateReferenceBadge();
        renderActiveResult();
        updateHistoryControls();
        updateResultActionButtons();
      }

      function getEffectiveSavePath() {
        // File-backed: use the original path
        if (sourceState.source === "file" && sourceState.path) return sourceState.path;
        // Upload with working dir + filename: derive path
        if (sourceState.source === "upload" && sourceState.label && resourceDirInput && resourceDirInput.value.trim()) {
          var name = sourceState.label.replace(/^upload:\s*/i, "");
          if (name) return resourceDirInput.value.trim().replace(/\/$/, "") + "/" + name;
        }
        return null;
      }

      function buildAnnotatedSaveSuggestion() {
        const effectivePath = getEffectiveSavePath() || sourceState.path || "";
        if (effectivePath) {
          const parts = String(effectivePath).split(/[/\\]/);
          const fileName = parts.pop() || "draft.md";
          const dir = parts.length > 0 ? parts.join("/") + "/" : "";
          const stem = fileName.replace(/\.[^.]+$/, "") || "draft";
          return dir + stem + ".annotated.md";
        }

        const rawLabel = sourceState.label ? sourceState.label.replace(/^upload:\s*/i, "") : "draft.md";
        const stem = rawLabel.replace(/\.[^.]+$/, "") || "draft";
        const suggestedDir = resourceDirInput && resourceDirInput.value.trim()
          ? resourceDirInput.value.trim().replace(/\/$/, "") + "/"
          : "./";
        return suggestedDir + stem + ".annotated.md";
      }

      function updateSaveFileTooltip() {
        if (!saveOverBtn) return;

        var effectivePath = getEffectiveSavePath();
        if (effectivePath) {
          saveOverBtn.title = "Overwrite file: " + effectivePath;
          return;
        }

        saveOverBtn.title = "Save editor is available after opening a file, setting a working dir, or using Save editor as…";
      }

      function syncActionButtons() {
        const canSaveOver = Boolean(getEffectiveSavePath());

        fileInput.disabled = uiBusy;
        saveAsBtn.disabled = uiBusy;
        saveOverBtn.disabled = uiBusy || !canSaveOver;
        sendEditorBtn.disabled = uiBusy;
        if (getEditorBtn) getEditorBtn.disabled = uiBusy;
        if (loadGitDiffBtn) loadGitDiffBtn.disabled = uiBusy;
        syncRunAndCritiqueButtons();
        copyDraftBtn.disabled = uiBusy;
        if (highlightSelect) highlightSelect.disabled = uiBusy;
        if (langSelect) langSelect.disabled = uiBusy;
        if (annotationModeSelect) annotationModeSelect.disabled = uiBusy;
        if (saveAnnotatedBtn) saveAnnotatedBtn.disabled = uiBusy;
        if (stripAnnotationsBtn) stripAnnotationsBtn.disabled = uiBusy || !hasAnnotationMarkers(sourceTextEl.value);
        if (compactBtn) compactBtn.disabled = uiBusy || compactInProgress || wsState === "Disconnected";
        editorViewSelect.disabled = false;
        rightViewSelect.disabled = false;
        followSelect.disabled = uiBusy;
        if (responseHighlightSelect) responseHighlightSelect.disabled = rightView !== "markdown";
        insertHeaderBtn.disabled = uiBusy;
        lensSelect.disabled = uiBusy;
        updateSaveFileTooltip();
        updateHistoryControls();
        updateResultActionButtons();
      }

      function setBusy(busy) {
        uiBusy = Boolean(busy);
        syncFooterSpinnerState();
        renderStatus();
        syncActionButtons();
      }

      function setSourceState(next) {
        sourceState = {
          source: next && next.source ? next.source : "blank",
          label: next && next.label ? next.label : "blank",
          path: next && next.path ? next.path : null,
        };
        updateSourceBadge();
        syncActionButtons();
      }

      function setEditorText(nextText, options) {
        const value = String(nextText || "");
        const preserveScroll = Boolean(options && options.preserveScroll);
        const preserveSelection = Boolean(options && options.preserveSelection);
        const previousScrollTop = sourceTextEl.scrollTop;
        const previousScrollLeft = sourceTextEl.scrollLeft;
        const previousSelectionStart = sourceTextEl.selectionStart;
        const previousSelectionEnd = sourceTextEl.selectionEnd;

        sourceTextEl.value = value;

        if (preserveSelection) {
          const maxIndex = value.length;
          const start = Math.max(0, Math.min(previousSelectionStart || 0, maxIndex));
          const end = Math.max(start, Math.min(previousSelectionEnd || start, maxIndex));
          sourceTextEl.setSelectionRange(start, end);
        }

        if (preserveScroll) {
          sourceTextEl.scrollTop = previousScrollTop;
          sourceTextEl.scrollLeft = previousScrollLeft;
        }

        syncEditorHighlightScroll();
        const schedule = typeof window.requestAnimationFrame === "function"
          ? window.requestAnimationFrame.bind(window)
          : (cb) => window.setTimeout(cb, 16);
        schedule(() => {
          syncEditorHighlightScroll();
        });

        updateAnnotatedReplyHeaderButton();

        if (!options || options.updatePreview !== false) {
          renderSourcePreview();
        }
        if (!options || options.updateMeta !== false) {
          scheduleEditorMetaUpdate();
        }
      }

      function setEditorView(nextView) {
        editorView = nextView === "preview" ? "preview" : "markdown";
        editorViewSelect.value = editorView;

        const showPreview = editorView === "preview";
        if (sourceEditorWrapEl) {
          sourceEditorWrapEl.style.display = showPreview ? "none" : "flex";
        }
        sourcePreviewEl.hidden = !showPreview;

        if (!showPreview && sourcePreviewRenderTimer) {
          window.clearTimeout(sourcePreviewRenderTimer);
          sourcePreviewRenderTimer = null;
        }

        if (!showPreview) {
          finishPreviewRender(sourcePreviewEl);
        }

        if (showPreview) {
          renderSourcePreview();
        }

        updateEditorHighlightState();
        updateLangSelectVisibility();
      }

      function setRightView(nextView) {
        rightView = nextView === "preview"
          ? "preview"
          : (nextView === "editor-preview"
            ? "editor-preview"
            : (nextView === "thinking" ? "thinking" : "markdown"));
        rightViewSelect.value = rightView;

        if (rightView !== "editor-preview" && responseEditorPreviewTimer) {
          window.clearTimeout(responseEditorPreviewTimer);
          responseEditorPreviewTimer = null;
        }

        refreshResponseUi();
        syncActionButtons();
      }

      function getToken() {
        const query = new URLSearchParams(window.location.search || "");
        const hash = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
        return query.get("token") || hash.get("token") || "";
      }

      function makeRequestId() {
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
          return window.crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, "_");
        }
        return "req_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
      }

      function escapeHtml(text) {
        return text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      function escapeRegExp(text) {
        return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }

      function wrapHighlight(className, text) {
        return "<span class='" + className + "'>" + escapeHtml(String(text || "")) + "</span>";
      }

      function buildAnnotationPreviewMarkerHtml(text, title) {
        const titleAttr = title ? " title='" + escapeHtml(String(title)) + "'" : "";
        const rendered = typeof annotationHelpers.renderPreviewAnnotationHtml === "function"
          ? annotationHelpers.renderPreviewAnnotationHtml(text)
          : escapeHtml(String(text || ""));
        return "<span class='annotation-preview-marker'" + titleAttr + ">" + rendered + "</span>";
      }

      function setAnnotationPreviewMarkerContent(markerEl, text) {
        if (!markerEl) return;
        const rendered = typeof annotationHelpers.renderPreviewAnnotationHtml === "function"
          ? annotationHelpers.renderPreviewAnnotationHtml(text)
          : escapeHtml(String(text || ""));
        markerEl.innerHTML = rendered;
      }

      function highlightInlineAnnotations(text, mode) {
        const source = String(text || "");
        const renderMode = mode === "preview" ? "preview" : "overlay";
        return annotationHelpers.replaceInlineAnnotationMarkers(
          source,
          function(marker) {
            const token = marker.raw || "";
            const markerText = annotationHelpers.normalizePreviewAnnotationLabel(marker.body) || token;
            if (renderMode === "preview") {
              return buildAnnotationPreviewMarkerHtml(markerText, token);
            }
            return wrapHighlight(annotationsEnabled ? "hl-annotation" : "hl-annotation-muted", token);
          },
          function(segment) {
            return escapeHtml(segment);
          },
        );
      }

      function highlightInlineMarkdownWithoutAnnotations(text) {
        const source = String(text || "");
        const pattern = /(\x60[^\x60]*\x60)|(\[[^\]]+\]\([^)]+\))/g;
        let lastIndex = 0;
        let out = "";

        let match;
        while ((match = pattern.exec(source)) !== null) {
          const token = match[0] || "";
          const start = typeof match.index === "number" ? match.index : 0;

          if (start > lastIndex) {
            out += escapeHtml(source.slice(lastIndex, start));
          }

          if (match[1]) {
            out += wrapHighlight("hl-code", token);
          } else if (match[2]) {
            const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
            if (linkMatch) {
              out += wrapHighlight("hl-link", "[" + linkMatch[1] + "]");
              out += "(" + wrapHighlight("hl-url", linkMatch[2]) + ")";
            } else {
              out += escapeHtml(token);
            }
          } else {
            out += escapeHtml(token);
          }

          lastIndex = start + token.length;
        }

        if (lastIndex < source.length) {
          out += escapeHtml(source.slice(lastIndex));
        }

        return out;
      }

      function highlightInlineMarkdown(text) {
        return annotationHelpers.replaceInlineAnnotationMarkers(
          String(text || ""),
          function(marker) {
            return highlightInlineAnnotations(marker.raw || "");
          },
          function(segment) {
            return highlightInlineMarkdownWithoutAnnotations(segment);
          },
        );
      }

      function normalizeFenceLanguage(info) {
        const raw = String(info || "").trim();
        if (!raw) return "";

        const first = raw.split(/\s+/)[0].replace(/^\./, "").toLowerCase();

        // Explicit aliases that don't match extension names
        if (first === "js" || first === "javascript" || first === "jsx" || first === "node") return "javascript";
        if (first === "ts" || first === "typescript" || first === "tsx") return "typescript";
        if (first === "py" || first === "python") return "python";
        if (first === "sh" || first === "bash" || first === "zsh" || first === "shell") return "bash";
        if (first === "json" || first === "jsonc") return "json";
        if (first === "rust" || first === "rs") return "rust";
        if (first === "c" || first === "h") return "c";
        if (first === "cpp" || first === "c++" || first === "cxx" || first === "hpp") return "cpp";
        if (first === "julia" || first === "jl") return "julia";
        if (first === "fortran" || first === "f90" || first === "f95" || first === "f03" || first === "f" || first === "for") return "fortran";
        if (first === "r") return "r";
        if (first === "matlab" || first === "m") return "matlab";
        if (first === "latex" || first === "tex") return "latex";
        if (first === "diff" || first === "patch" || first === "udiff") return "diff";

        // Fall back to the unified extension->language map
        return EXT_TO_LANG[first] || "";
      }

      function highlightCodeTokens(line, pattern, classifyMatch) {
        const source = String(line || "");
        let out = "";
        let lastIndex = 0;
        pattern.lastIndex = 0;

        let match;
        while ((match = pattern.exec(source)) !== null) {
          const token = match[0] || "";
          const start = typeof match.index === "number" ? match.index : 0;

          if (start > lastIndex) {
            out += escapeHtml(source.slice(lastIndex, start));
          }

          const className = classifyMatch(match) || "hl-code";
          out += wrapHighlight(className, token);

          lastIndex = start + token.length;
          if (token.length === 0) {
            pattern.lastIndex += 1;
          }
        }

        if (lastIndex < source.length) {
          out += escapeHtml(source.slice(lastIndex));
        }

        return out;
      }

      function highlightCodeLine(line, language, annotationRenderMode) {
        const source = String(line || "");
        const lang = normalizeFenceLanguage(language);
        const renderMode = annotationRenderMode === "preview" ? "preview" : "overlay";

        if (!lang) {
          return wrapHighlight("hl-code", source);
        }

        if (lang === "javascript" || lang === "typescript") {
          const jsPattern = /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b(?:const|let|var|function|return|if|else|for|while|switch|case|break|continue|try|catch|finally|throw|new|class|extends|import|from|export|default|async|await|true|false|null|undefined|typeof|instanceof)\b)|(\b\d+(?:\.\d+)?\b)/g;
          const highlighted = highlightCodeTokens(source, jsPattern, (match) => {
            if (match[1]) return "hl-code-com";
            if (match[2]) return "hl-code-str";
            if (match[3]) return "hl-code-kw";
            if (match[4]) return "hl-code-num";
            return "hl-code";
          });
          return "<span class='hl-code'>" + highlighted + "</span>";
        }

        if (lang === "python") {
          const pyPattern = /(#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b(?:def|class|return|if|elif|else|for|while|try|except|finally|import|from|as|with|lambda|yield|True|False|None|and|or|not|in|is|pass|break|continue|raise|global|nonlocal|assert)\b)|(\b\d+(?:\.\d+)?\b)/g;
          const highlighted = highlightCodeTokens(source, pyPattern, (match) => {
            if (match[1]) return "hl-code-com";
            if (match[2]) return "hl-code-str";
            if (match[3]) return "hl-code-kw";
            if (match[4]) return "hl-code-num";
            return "hl-code";
          });
          return "<span class='hl-code'>" + highlighted + "</span>";
        }

        if (lang === "bash") {
          const shPattern = /(#.*$)|("(?:[^"\\]|\\.)*"|'[^']*')|(\$\{[^}]+\}|\$[A-Za-z_][A-Za-z0-9_]*)|(\b(?:if|then|else|fi|for|in|do|done|case|esac|function|local|export|readonly|return|break|continue|while|until)\b)|(\b\d+\b)/g;
          const highlighted = highlightCodeTokens(source, shPattern, (match) => {
            if (match[1]) return "hl-code-com";
            if (match[2]) return "hl-code-str";
            if (match[3]) return "hl-code-var";
            if (match[4]) return "hl-code-kw";
            if (match[5]) return "hl-code-num";
            return "hl-code";
          });
          return "<span class='hl-code'>" + highlighted + "</span>";
        }

        if (lang === "json") {
          const jsonPattern = /("(?:[^"\\]|\\.)*"\s*:)|("(?:[^"\\]|\\.)*")|(\b(?:true|false|null)\b)|(\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g;
          const highlighted = highlightCodeTokens(source, jsonPattern, (match) => {
            if (match[1]) return "hl-code-key";
            if (match[2]) return "hl-code-str";
            if (match[3]) return "hl-code-kw";
            if (match[4]) return "hl-code-num";
            return "hl-code";
          });
          return "<span class='hl-code'>" + highlighted + "</span>";
        }

        if (lang === "rust") {
          const rustPattern = /(\/\/.*$)|("(?:[^"\\]|\\.)*")|(\b(?:fn|let|mut|const|struct|enum|impl|trait|pub|mod|use|crate|self|super|match|if|else|for|while|loop|return|break|continue|where|as|in|ref|move|async|await|unsafe|extern|type|static|true|false|Some|None|Ok|Err|Self)\b)|(\b\d[\d_]*(?:\.\d[\d_]*)?(?:f32|f64|u8|u16|u32|u64|u128|usize|i8|i16|i32|i64|i128|isize)?\b)/g;
          const highlighted = highlightCodeTokens(source, rustPattern, (match) => {
            if (match[1]) return "hl-code-com";
            if (match[2]) return "hl-code-str";
            if (match[3]) return "hl-code-kw";
            if (match[4]) return "hl-code-num";
            return "hl-code";
          });
          return "<span class='hl-code'>" + highlighted + "</span>";
        }

        if (lang === "c" || lang === "cpp") {
          const cPattern = /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)')|(#\s*\w+)|(\b(?:if|else|for|while|do|switch|case|break|continue|return|goto|struct|union|enum|typedef|sizeof|void|int|char|short|long|float|double|unsigned|signed|const|static|extern|volatile|register|inline|auto|restrict|true|false|NULL|nullptr|class|public|private|protected|virtual|override|template|typename|namespace|using|new|delete|try|catch|throw|noexcept|constexpr|auto|decltype|static_cast|dynamic_cast|reinterpret_cast|const_cast|std|include|define|ifdef|ifndef|endif|pragma)\b)|(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?[fFlLuU]*\b)/g;
          const highlighted = highlightCodeTokens(source, cPattern, (match) => {
            if (match[1]) return "hl-code-com";
            if (match[2]) return "hl-code-str";
            if (match[3]) return "hl-code-kw";
            if (match[4]) return "hl-code-kw";
            if (match[5]) return "hl-code-num";
            return "hl-code";
          });
          return "<span class='hl-code'>" + highlighted + "</span>";
        }

        if (lang === "julia") {
          const jlPattern = /(#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b(?:function|end|if|elseif|else|for|while|begin|let|local|global|const|return|break|continue|do|try|catch|finally|throw|module|import|using|export|struct|mutable|abstract|primitive|where|macro|quote|true|false|nothing|missing|in|isa|typeof)\b)|(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g;
          const highlighted = highlightCodeTokens(source, jlPattern, (match) => {
            if (match[1]) return "hl-code-com";
            if (match[2]) return "hl-code-str";
            if (match[3]) return "hl-code-kw";
            if (match[4]) return "hl-code-num";
            return "hl-code";
          });
          return "<span class='hl-code'>" + highlighted + "</span>";
        }

        if (lang === "fortran") {
          const fPattern = /(!.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b(?:program|end|subroutine|function|module|use|implicit|none|integer|real|double|precision|complex|character|logical|dimension|allocatable|intent|in|out|inout|parameter|data|do|if|then|else|elseif|endif|enddo|call|return|write|read|print|format|stop|contains|type|class|select|case|where|forall|associate|block|procedure|interface|abstract|extends|allocate|deallocate|cycle|exit|go|to|common|equivalence|save|external|intrinsic)\b)|(\b\d+(?:\.\d+)?(?:[dDeE][+-]?\d+)?\b)/gi;
          const highlighted = highlightCodeTokens(source, fPattern, (match) => {
            if (match[1]) return "hl-code-com";
            if (match[2]) return "hl-code-str";
            if (match[3]) return "hl-code-kw";
            if (match[4]) return "hl-code-num";
            return "hl-code";
          });
          return "<span class='hl-code'>" + highlighted + "</span>";
        }

        if (lang === "r") {
          const rPattern = /(#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b(?:function|if|else|for|while|repeat|in|next|break|return|TRUE|FALSE|NULL|NA|NA_integer_|NA_real_|NA_complex_|NA_character_|Inf|NaN|library|require|source|local|switch)\b)|(<-|->|<<-|->>)|(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?[Li]?\b)/g;
          const highlighted = highlightCodeTokens(source, rPattern, (match) => {
            if (match[1]) return "hl-code-com";
            if (match[2]) return "hl-code-str";
            if (match[3]) return "hl-code-kw";
            if (match[4]) return "hl-code-kw";
            if (match[5]) return "hl-code-num";
            return "hl-code";
          });
          return "<span class='hl-code'>" + highlighted + "</span>";
        }

        if (lang === "matlab") {
          const matPattern = /(%.*$)|('(?:[^']|'')*'|"(?:[^"\\]|\\.)*")|(\b(?:function|end|if|elseif|else|for|while|switch|case|otherwise|try|catch|return|break|continue|global|persistent|classdef|properties|methods|events|enumeration|true|false)\b)|(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?[i]?\b)/g;
          const highlighted = highlightCodeTokens(source, matPattern, (match) => {
            if (match[1]) return "hl-code-com";
            if (match[2]) return "hl-code-str";
            if (match[3]) return "hl-code-kw";
            if (match[4]) return "hl-code-num";
            return "hl-code";
          });
          return "<span class='hl-code'>" + highlighted + "</span>";
        }

        if (lang === "latex") {
          const texPattern = /(%.*$)|(\[an:\s*[^\]]+\])|(\\(?:documentclass|usepackage|newtheorem|begin|end|section|subsection|subsubsection|chapter|part|title|author|date|maketitle|tableofcontents|includegraphics|caption|label|ref|eqref|cite|textbf|textit|texttt|emph|footnote|centering|newcommand|renewcommand|providecommand|bibliography|bibliographystyle|bibitem|item|input|include)\b)|(\\[A-Za-z]+)|(\{|\})|(\$\$?(?:[^$\\]|\\.)+\$\$?)|(\[(?:.*?)\])/gi;
          let out = "";
          let lastIndex = 0;
          texPattern.lastIndex = 0;

          let match;
          while ((match = texPattern.exec(source)) !== null) {
            const token = match[0] || "";
            const start = typeof match.index === "number" ? match.index : 0;

            if (start > lastIndex) {
              out += escapeHtml(source.slice(lastIndex, start));
            }

            if (match[1]) {
              out += wrapHighlight("hl-code-com", token);
            } else if (match[2]) {
              out += highlightInlineAnnotations(token, renderMode);
            } else if (match[3]) {
              out += wrapHighlight("hl-code-kw", token);
            } else if (match[4]) {
              out += wrapHighlight("hl-code-fn", token);
            } else if (match[5]) {
              out += wrapHighlight("hl-code-op", token);
            } else if (match[6]) {
              out += wrapHighlight("hl-code-str", token);
            } else if (match[7]) {
              out += wrapHighlight("hl-code-num", token);
            } else {
              out += escapeHtml(token);
            }

            lastIndex = start + token.length;
            if (token.length === 0) {
              texPattern.lastIndex += 1;
            }
          }

          if (lastIndex < source.length) {
            out += escapeHtml(source.slice(lastIndex));
          }

          return out;
        }

        if (lang === "diff") {
          var highlightedDiff = highlightInlineAnnotations(source, renderMode);
          if (/^@@/.test(source)) return "<span class=\"hl-code-fn\">" + highlightedDiff + "</span>";
          if (/^\+\+\+|^---/.test(source)) return "<span class=\"hl-code-kw\">" + highlightedDiff + "</span>";
          if (/^\+/.test(source)) return "<span class=\"hl-diff-add\">" + highlightedDiff + "</span>";
          if (/^-/.test(source)) return "<span class=\"hl-diff-del\">" + highlightedDiff + "</span>";
          if (/^diff /.test(source)) return "<span class=\"hl-code-kw\">" + highlightedDiff + "</span>";
          if (/^index /.test(source)) return "<span class=\"hl-code-com\">" + highlightedDiff + "</span>";
          return highlightedDiff;
        }

        return wrapHighlight("hl-code", source);
      }

      function highlightMarkdown(text) {
        const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
        const out = [];
        let inFence = false;
        let fenceChar = null;
        let fenceLength = 0;
        let fenceLanguage = "";

        for (const line of lines) {
          const fenceMatch = line.match(/^(\s*)([\x60]{3,}|~{3,})(.*)$/);
          if (fenceMatch) {
            const marker = fenceMatch[2] || "";
            const markerChar = marker.charAt(0);
            const markerLength = marker.length;

            if (!inFence) {
              inFence = true;
              fenceChar = markerChar;
              fenceLength = markerLength;
              fenceLanguage = normalizeFenceLanguage(fenceMatch[3] || "");
            } else if (fenceChar === markerChar && markerLength >= fenceLength) {
              inFence = false;
              fenceChar = null;
              fenceLength = 0;
              fenceLanguage = "";
            }

            out.push(wrapHighlight("hl-fence", line));
            continue;
          }

          if (inFence) {
            out.push(line.length > 0 ? highlightCodeLine(line, fenceLanguage) : EMPTY_OVERLAY_LINE);
            continue;
          }

          if (line.length === 0) {
            out.push(EMPTY_OVERLAY_LINE);
            continue;
          }

          const headingMatch = line.match(/^(\s{0,3})(#{1,6}\s+)(.*)$/);
          if (headingMatch) {
            out.push(escapeHtml(headingMatch[1] || "") + wrapHighlight("hl-heading", (headingMatch[2] || "") + (headingMatch[3] || "")));
            continue;
          }

          const quoteMatch = line.match(/^(\s{0,3}>\s?)(.*)$/);
          if (quoteMatch) {
            out.push(wrapHighlight("hl-quote", quoteMatch[1] || "") + highlightInlineMarkdown(quoteMatch[2] || ""));
            continue;
          }

          const listMatch = line.match(/^(\s*)([-*+]|\d+\.)(\s+)(.*)$/);
          if (listMatch) {
            out.push(
              escapeHtml(listMatch[1] || "")
              + wrapHighlight("hl-list", listMatch[2] || "")
              + escapeHtml(listMatch[3] || "")
              + highlightInlineMarkdown(listMatch[4] || ""),
            );
            continue;
          }

          out.push(highlightInlineMarkdown(line));
        }

        return out.join("<br>");
      }

      function highlightCode(text, language, annotationRenderMode) {
        const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
        const lang = normalizeFenceLanguage(language);
        const renderMode = annotationRenderMode === "preview" ? "preview" : "overlay";
        const out = [];
        for (const line of lines) {
          if (line.length === 0) {
            out.push(EMPTY_OVERLAY_LINE);
          } else if (lang) {
            out.push(highlightCodeLine(line, lang, renderMode));
          } else {
            out.push(escapeHtml(line));
          }
        }
        return out.join("<br>");
      }

      function detectLanguageFromName(name) {
        if (!name) return "";
        var dot = name.lastIndexOf(".");
        if (dot < 0) return "";
        var ext = name.slice(dot + 1).toLowerCase();
        return EXT_TO_LANG[ext] || "";
      }

      function renderEditorHighlightNow() {
        if (!sourceHighlightEl) return;
        if (!editorHighlightEnabled || editorView !== "markdown") {
          sourceHighlightEl.innerHTML = "";
          return;
        }

        const text = sourceTextEl.value || "";
        if (text.length > EDITOR_HIGHLIGHT_MAX_CHARS) {
          sourceHighlightEl.textContent = text;
          syncEditorHighlightScroll();
          return;
        }

        if (editorLanguage === "markdown" || !editorLanguage) {
          sourceHighlightEl.innerHTML = highlightMarkdown(text);
        } else {
          sourceHighlightEl.innerHTML = highlightCode(text, editorLanguage);
        }
        syncEditorHighlightScroll();
      }

      function scheduleEditorHighlightRender() {
        if (editorHighlightRenderRaf !== null) {
          if (typeof window.cancelAnimationFrame === "function") {
            window.cancelAnimationFrame(editorHighlightRenderRaf);
          } else {
            window.clearTimeout(editorHighlightRenderRaf);
          }
          editorHighlightRenderRaf = null;
        }

        const schedule = typeof window.requestAnimationFrame === "function"
          ? window.requestAnimationFrame.bind(window)
          : (cb) => window.setTimeout(cb, 16);

        editorHighlightRenderRaf = schedule(() => {
          editorHighlightRenderRaf = null;
          renderEditorHighlightNow();
        });
      }

      function syncEditorHighlightScroll() {
        if (!sourceHighlightEl) return;
        sourceHighlightEl.scrollTop = sourceTextEl.scrollTop;
        sourceHighlightEl.scrollLeft = sourceTextEl.scrollLeft;
      }

      function runEditorMetaUpdateNow() {
        const normalizedEditor = normalizeForCompare(sourceTextEl.value);
        updateResultActionButtons(normalizedEditor);
        updateAnnotatedReplyHeaderButton();
        if (stripAnnotationsBtn) {
          stripAnnotationsBtn.disabled = uiBusy || !hasAnnotationMarkers(sourceTextEl.value);
        }
      }

      function scheduleEditorMetaUpdate() {
        if (editorMetaUpdateRaf !== null) {
          if (typeof window.cancelAnimationFrame === "function") {
            window.cancelAnimationFrame(editorMetaUpdateRaf);
          } else {
            window.clearTimeout(editorMetaUpdateRaf);
          }
          editorMetaUpdateRaf = null;
        }

        const schedule = typeof window.requestAnimationFrame === "function"
          ? window.requestAnimationFrame.bind(window)
          : (cb) => window.setTimeout(cb, 16);

        editorMetaUpdateRaf = schedule(() => {
          editorMetaUpdateRaf = null;
          runEditorMetaUpdateNow();
        });
      }

      function readStoredToggle(storageKey) {
        if (!window.localStorage) return null;
        try {
          const value = window.localStorage.getItem(storageKey);
          if (value === "on") return true;
          if (value === "off") return false;
          return null;
        } catch {
          return null;
        }
      }

      function persistStoredToggle(storageKey, enabled) {
        if (!window.localStorage) return;
        try {
          window.localStorage.setItem(storageKey, enabled ? "on" : "off");
        } catch {
          // ignore storage failures
        }
      }

      function readStoredEditorHighlightEnabled() {
        return readStoredToggle(EDITOR_HIGHLIGHT_STORAGE_KEY);
      }

      function readStoredResponseHighlightEnabled() {
        return readStoredToggle(RESPONSE_HIGHLIGHT_STORAGE_KEY);
      }

      function readStoredAnnotationsEnabled() {
        return readStoredToggle(ANNOTATION_MODE_STORAGE_KEY);
      }

      function persistEditorHighlightEnabled(enabled) {
        persistStoredToggle(EDITOR_HIGHLIGHT_STORAGE_KEY, enabled);
      }

      function persistResponseHighlightEnabled(enabled) {
        persistStoredToggle(RESPONSE_HIGHLIGHT_STORAGE_KEY, enabled);
      }

      function persistAnnotationsEnabled(enabled) {
        persistStoredToggle(ANNOTATION_MODE_STORAGE_KEY, enabled);
      }

      function updateEditorHighlightState() {
        const enabled = editorHighlightEnabled && editorView === "markdown";

        sourceTextEl.classList.toggle("highlight-active", enabled);

        if (sourceHighlightEl) {
          sourceHighlightEl.hidden = !enabled;
        }

        if (!enabled) {
          if (editorHighlightRenderRaf !== null) {
            if (typeof window.cancelAnimationFrame === "function") {
              window.cancelAnimationFrame(editorHighlightRenderRaf);
            } else {
              window.clearTimeout(editorHighlightRenderRaf);
            }
            editorHighlightRenderRaf = null;
          }

          if (sourceHighlightEl) {
            sourceHighlightEl.innerHTML = "";
            sourceHighlightEl.scrollTop = 0;
            sourceHighlightEl.scrollLeft = 0;
          }
          return;
        }

        scheduleEditorHighlightRender();
        syncEditorHighlightScroll();
      }

      function setEditorHighlightEnabled(enabled) {
        editorHighlightEnabled = Boolean(enabled);
        persistEditorHighlightEnabled(editorHighlightEnabled);
        if (highlightSelect) {
          highlightSelect.value = editorHighlightEnabled ? "on" : "off";
        }
        updateEditorHighlightState();
        updateLangSelectVisibility();
      }

      function readStoredEditorLanguage() {
        if (!window.localStorage) return null;
        try {
          const value = window.localStorage.getItem(EDITOR_LANGUAGE_STORAGE_KEY);
          if (value && SUPPORTED_LANGUAGES.indexOf(value) !== -1) return value;
          return null;
        } catch {
          return null;
        }
      }

      function persistEditorLanguage(lang) {
        if (!window.localStorage) return;
        try {
          window.localStorage.setItem(EDITOR_LANGUAGE_STORAGE_KEY, lang || "markdown");
        } catch {}
      }

      function setEditorLanguage(lang) {
        editorLanguage = (lang && SUPPORTED_LANGUAGES.indexOf(lang) !== -1) ? lang : "markdown";
        persistEditorLanguage(editorLanguage);
        if (langSelect) {
          langSelect.value = editorLanguage;
        }
        if (editorHighlightEnabled && editorView === "markdown") {
          scheduleEditorHighlightRender();
        }
        if (editorView === "preview") {
          scheduleSourcePreviewRender(0);
        }
      }

      function updateLangSelectVisibility() {
        if (!langSelect) return;
        const highlightActive = editorHighlightEnabled && editorView === "markdown";
        const previewActive = editorView === "preview";
        langSelect.hidden = !(highlightActive || previewActive);
      }

      function setResponseHighlightEnabled(enabled) {
        responseHighlightEnabled = Boolean(enabled);
        persistResponseHighlightEnabled(responseHighlightEnabled);
        if (responseHighlightSelect) {
          responseHighlightSelect.value = responseHighlightEnabled ? "on" : "off";
        }
        renderActiveResult();
      }

      function getAbortablePendingKind() {
        if (!pendingRequestId) return null;
        return pendingKind === "direct" || pendingKind === "critique" ? pendingKind : null;
      }

      function requestCancelForPendingRequest(expectedKind) {
        const activeKind = getAbortablePendingKind();
        if (!activeKind || activeKind !== expectedKind || !pendingRequestId) {
          setStatus("No matching Studio request is running.", "warning");
          return false;
        }
        const requestId = pendingRequestId;
        const sent = sendMessage({ type: "cancel_request", requestId });
        if (!sent) return false;
        clearArmedTitleAttention(requestId);
        setStatus("Stopping request…", "warning");
        return true;
      }

      function syncRunAndCritiqueButtons() {
        const activeKind = getAbortablePendingKind();
        const directIsStop = activeKind === "direct";
        const critiqueIsStop = activeKind === "critique";
        const canQueueSteering = studioRunChainActive && !critiqueIsStop;

        if (sendRunBtn) {
          sendRunBtn.textContent = directIsStop ? "Stop" : "Run editor text";
          sendRunBtn.classList.toggle("request-stop-active", directIsStop);
          sendRunBtn.disabled = wsState === "Disconnected" || (!directIsStop && (uiBusy || critiqueIsStop));
          sendRunBtn.title = directIsStop
            ? "Stop the active run. Shortcut: Esc."
            : (annotationsEnabled
              ? "Run editor text as-is (includes [an: ...] markers). Shortcut: Cmd/Ctrl+Enter. Stop the active request with Esc."
              : "Run editor text with [an: ...] markers stripped. Shortcut: Cmd/Ctrl+Enter. Stop the active request with Esc.");
        }

        if (queueSteerBtn) {
          queueSteerBtn.hidden = false;
          queueSteerBtn.disabled = wsState === "Disconnected" || !canQueueSteering;
          queueSteerBtn.classList.remove("request-stop-active");
          queueSteerBtn.title = canQueueSteering
            ? (annotationsEnabled
              ? "Queue the current editor text as a steering message for the active run. Shortcut: Cmd/Ctrl+Enter."
              : "Queue the current editor text as a steering message for the active run after stripping [an: ...] markers. Shortcut: Cmd/Ctrl+Enter.")
            : "Queue steering is available while Run editor text is active.";
        }

        if (critiqueBtn) {
          critiqueBtn.textContent = critiqueIsStop ? "Stop" : "Critique editor text";
          critiqueBtn.classList.toggle("request-stop-active", critiqueIsStop);
          critiqueBtn.disabled = critiqueIsStop ? wsState === "Disconnected" : (uiBusy || canQueueSteering);
          critiqueBtn.title = critiqueIsStop
            ? "Stop the running critique request. Shortcut: Esc."
            : (canQueueSteering
              ? "Critique queueing is not supported while Run editor text is active."
              : (annotationsEnabled
                ? "Critique editor text as-is (includes [an: ...] markers)."
                : "Critique editor text with [an: ...] markers stripped."));
        }
      }

      function updateAnnotationModeUi() {
        if (annotationModeSelect) {
          annotationModeSelect.value = annotationsEnabled ? "on" : "off";
          annotationModeSelect.title = annotationsEnabled
            ? "Annotations On: keep and send [an: ...] markers."
            : "Annotations Hidden: keep markers in editor, hide in preview, and strip before Run/Critique.";
        }

        syncRunAndCritiqueButtons();
      }

      function setAnnotationsEnabled(enabled, _options) {
        annotationsEnabled = Boolean(enabled);
        persistAnnotationsEnabled(annotationsEnabled);
        updateAnnotationModeUi();

        if (editorHighlightEnabled && editorView === "markdown") {
          scheduleEditorHighlightRender();
        }
        renderSourcePreview();
      }

      function extractSection(markdown, title) {
        if (!markdown || !title) return "";

        const lines = String(markdown).split("\n");
        const heading = "## " + String(title).trim().toLowerCase();
        let start = -1;

        for (let i = 0; i < lines.length; i++) {
          const normalized = lines[i].trim().toLowerCase();
          if (normalized === heading) {
            start = i + 1;
            break;
          }
        }

        if (start < 0) return "";

        const collected = [];
        for (let i = start; i < lines.length; i++) {
          const line = lines[i];
          if (line.trim().startsWith("## ")) break;
          collected.push(line);
        }

        return collected.join("\n").trim();
      }

      function buildCritiqueNotesMarkdown(markdown) {
        if (!markdown || typeof markdown !== "string") return "";

        const assessment = extractSection(markdown, "Assessment");
        const critiques = extractSection(markdown, "Critiques");
        const parts = [];

        if (assessment) {
          parts.push("## Assessment\n\n" + assessment);
        }
        if (critiques) {
          parts.push("## Critiques\n\n" + critiques);
        }

        return parts.join("\n\n").trim();
      }

      function isStructuredCritique(markdown) {
        if (!markdown || typeof markdown !== "string") return false;
        const lower = markdown.toLowerCase();
        return lower.indexOf("## critiques") !== -1 && lower.indexOf("## document") !== -1;
      }

      function handleIncomingResponse(markdown, kind, timestamp, thinking, options) {
        const responseTimestamp =
          typeof timestamp === "number" && Number.isFinite(timestamp) && timestamp > 0
            ? timestamp
            : Date.now();
        const responseThinking = typeof thinking === "string" ? thinking : "";
        const responseKind = kind === "critique" ? "critique" : "annotation";
        const resetScroll = options && Object.prototype.hasOwnProperty.call(options, "resetScroll")
          ? Boolean(options.resetScroll)
          : (
            latestResponseKind !== responseKind
            || latestResponseTimestamp !== responseTimestamp
            || latestResponseNormalized !== normalizeForCompare(markdown)
            || latestResponseThinkingNormalized !== normalizeForCompare(responseThinking)
          );

        if (resetScroll) {
          pendingResponseScrollReset = true;
        }

        latestResponseMarkdown = markdown;
        latestResponseThinking = responseThinking;
        latestResponseKind = responseKind;
        latestResponseTimestamp = responseTimestamp;
        latestResponseIsStructuredCritique = isStructuredCritique(markdown);
        latestResponseHasContent = Boolean(markdown && markdown.trim());
        latestResponseNormalized = normalizeForCompare(markdown);
        latestResponseThinkingNormalized = normalizeForCompare(latestResponseThinking);

        if (latestResponseIsStructuredCritique) {
          latestCritiqueNotes = buildCritiqueNotesMarkdown(markdown);
          latestCritiqueNotesNormalized = normalizeForCompare(latestCritiqueNotes);
        } else {
          latestCritiqueNotes = "";
          latestCritiqueNotesNormalized = "";
        }

        refreshResponseUi();
      }

      function applyLatestPayload(payload, options) {
        if (!payload || typeof payload.markdown !== "string") return false;
        const responseKind = payload.kind === "critique" ? "critique" : "annotation";
        handleIncomingResponse(payload.markdown, responseKind, payload.timestamp, payload.thinking, options);
        return true;
      }

      function sendMessage(message) {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          setWsState("Disconnected");
          setStatus("Not connected to Studio server.", "error");
          return false;
        }
        ws.send(JSON.stringify(message));
        return true;
      }

      function handleServerMessage(message) {
        if (!message || typeof message !== "object") return;

        debugTrace("server_message", summarizeServerMessage(message));

        const contextChanged = applyContextUsageFromMessage(message);
        const updateInfoChanged = applyUpdateInfoFromMessage(message);
        if (contextChanged || updateInfoChanged) {
          updateFooterMeta();
        }

        if (message.type === "debug_event") {
          debugTrace("server_debug_event", summarizeServerMessage(message));
          return;
        }

        if (message.type === "hello_ack") {
          const busy = Boolean(message.busy);
          agentBusyFromServer = Boolean(message.agentBusy);
          updateTerminalActivityState(message.terminalPhase, message.terminalToolName, message.terminalActivityLabel);
          if (typeof message.modelLabel === "string") {
            modelLabel = message.modelLabel;
          }
          if (typeof message.terminalSessionLabel === "string") {
            terminalSessionLabel = message.terminalSessionLabel;
          }
          applyStudioRunQueueStateFromMessage(message);
          updateFooterMeta();
          setBusy(busy);
          setWsState(busy ? "Submitting" : "Ready");
          if (typeof message.activeRequestId === "string" && message.activeRequestId.length > 0) {
            pendingRequestId = message.activeRequestId;
            if (typeof message.activeRequestKind === "string" && message.activeRequestKind.length > 0) {
              pendingKind = message.activeRequestKind;
            } else if (!pendingKind) {
              pendingKind = "unknown";
            }
            stickyStudioKind = pendingKind;
          } else {
            pendingRequestId = null;
            pendingKind = null;
          }

          if (typeof message.compactInProgress === "boolean") {
            compactInProgress = message.compactInProgress;
          } else if (pendingKind === "compact") {
            compactInProgress = true;
          } else if (!busy) {
            compactInProgress = false;
          }

          let loadedInitialDocument = false;
          if (
            !initialDocumentApplied &&
            message.initialDocument &&
            typeof message.initialDocument.text === "string"
          ) {
            setEditorText(message.initialDocument.text, { preserveScroll: false, preserveSelection: false });
            initialDocumentApplied = true;
            loadedInitialDocument = true;
            setSourceState({
              source: message.initialDocument.source || "blank",
              label: message.initialDocument.label || "blank",
              path: message.initialDocument.path || null,
            });
            refreshResponseUi();
            if (typeof message.initialDocument.label === "string" && message.initialDocument.label.length > 0) {
              setStatus("Loaded " + message.initialDocument.label + ".", "success");
            }
          }

          let appliedHistory = false;
          if (Array.isArray(message.responseHistory)) {
            appliedHistory = setResponseHistory(message.responseHistory, {
              autoSelectLatest: !initialDocumentApplied,
              preserveSelection: initialDocumentApplied,
              silent: true,
            });
          }

          if (!appliedHistory && message.lastResponse && typeof message.lastResponse.markdown === "string") {
            const lastMarkdown = message.lastResponse.markdown;
            const lastResponseKind =
              message.lastResponse.kind === "critique"
                ? "critique"
                : (isStructuredCritique(lastMarkdown) ? "critique" : "annotation");
            handleIncomingResponse(lastMarkdown, lastResponseKind, message.lastResponse.timestamp, message.lastResponse.thinking);
          }

          if (pendingRequestId) {
            if (busy) {
              setStatus(getStudioBusyStatus(pendingKind), "warning");
            }
            return;
          }

          if (busy) {
            if (agentBusyFromServer && stickyStudioKind) {
              setStatus(getStudioBusyStatus(stickyStudioKind), "warning");
            } else if (agentBusyFromServer && studioRunChainActive) {
              setStatus(getStudioBusyStatus("direct"), "warning");
            } else if (agentBusyFromServer) {
              setStatus(getTerminalBusyStatus(), "warning");
            } else {
              setStatus("Studio is busy.", "warning");
            }
            return;
          }

          stickyStudioKind = null;
          if (!loadedInitialDocument) {
            refreshResponseUi();
            setStatus(getIdleStatus());
          }
          return;
        }

        if (message.type === "request_started") {
          pendingRequestId = typeof message.requestId === "string" ? message.requestId : pendingRequestId;
          pendingKind = typeof message.kind === "string" ? message.kind : "unknown";
          stickyStudioKind = pendingKind;
          if (pendingKind === "direct") {
            studioRunChainActive = true;
          }
          if (pendingKind === "compact") {
            compactInProgress = true;
          }
          setBusy(true);
          setWsState("Submitting");
          setStatus(getStudioBusyStatus(pendingKind), "warning");
          return;
        }

        if (message.type === "request_queued") {
          studioRunChainActive = true;
          applyStudioRunQueueStateFromMessage(message);
          syncActionButtons();
          setStatus("Steering queued.", "success");
          return;
        }

        if (message.type === "compaction_completed") {
          if (typeof message.requestId === "string" && pendingRequestId === message.requestId) {
            pendingRequestId = null;
            pendingKind = null;
          }
          compactInProgress = false;
          stickyStudioKind = null;
          const busy = Boolean(message.busy);
          setBusy(busy);
          setWsState(busy ? "Submitting" : "Ready");
          setStatus(typeof message.message === "string" ? message.message : "Compaction completed.", "success");
          return;
        }

        if (message.type === "compaction_error") {
          if (typeof message.requestId === "string" && pendingRequestId === message.requestId) {
            pendingRequestId = null;
            pendingKind = null;
          }
          compactInProgress = false;
          stickyStudioKind = null;
          const busy = Boolean(message.busy);
          setBusy(busy);
          setWsState(busy ? "Submitting" : "Ready");
          setStatus(typeof message.message === "string" ? message.message : "Compaction failed.", "error");
          return;
        }

        if (message.type === "response") {
          if (pendingRequestId && typeof message.requestId === "string" && message.requestId !== pendingRequestId) {
            return;
          }

          const completedRequestId = typeof message.requestId === "string" ? message.requestId : pendingRequestId;
          const responseKind =
            typeof message.kind === "string"
              ? message.kind
              : (pendingKind === "critique" ? "critique" : "annotation");

          stickyStudioKind = responseKind;
          pendingRequestId = null;
          pendingKind = null;
          queuedLatestResponse = null;
          setBusy(false);
          setWsState("Ready");

          let appliedFromHistory = false;
          if (Array.isArray(message.responseHistory)) {
            appliedFromHistory = setResponseHistory(message.responseHistory, {
              autoSelectLatest: true,
              preserveSelection: false,
              silent: true,
            });
          }

          if (!appliedFromHistory && typeof message.markdown === "string") {
            handleIncomingResponse(message.markdown, responseKind, message.timestamp, message.thinking);
          }

          if (responseKind === "critique") {
            setStatus("Critique ready.", "success");
          } else if (responseKind === "direct") {
            setStatus("Model response ready.", "success");
          } else {
            setStatus("Response ready.", "success");
          }
          maybeShowTitleAttentionForCompletedRequest(completedRequestId, responseKind);
          return;
        }

        if (message.type === "latest_response") {
          if (pendingRequestId) return;

          const hasHistory = Array.isArray(message.responseHistory);
          if (hasHistory) {
            setResponseHistory(message.responseHistory, {
              autoSelectLatest: followLatest,
              preserveSelection: !followLatest,
              silent: true,
            });
          }

          if (typeof message.markdown === "string") {
            const payload = {
              kind: message.kind === "critique" ? "critique" : "annotation",
              markdown: message.markdown,
              thinking: typeof message.thinking === "string" ? message.thinking : null,
              timestamp: message.timestamp,
            };

            if (!followLatest) {
              queuedLatestResponse = payload;
              updateResultActionButtons();
              setStatus("New response available — click Fetch latest response.", "warning");
              return;
            }

            if (!hasHistory && applyLatestPayload(payload)) {
              queuedLatestResponse = null;
              updateResultActionButtons();
              setStatus("Updated from latest response.", "success");
              return;
            }

            queuedLatestResponse = null;
            updateResultActionButtons();
            setStatus("Updated from latest response.", "success");
          }
          return;
        }

        if (message.type === "response_history") {
          setResponseHistory(message.items, {
            autoSelectLatest: followLatest,
            preserveSelection: !followLatest,
            silent: true,
          });
          return;
        }

        if (message.type === "saved") {
          if (typeof message.requestId === "string" && pendingRequestId === message.requestId) {
            pendingRequestId = null;
            pendingKind = null;
          }
          if (message.path) {
            setSourceState({
              source: "file",
              label: message.label || message.path,
              path: message.path,
            });
          }
          setBusy(false);
          setWsState("Ready");
          setStatus(typeof message.message === "string" ? message.message : "Saved.", "success");
          return;
        }

        if (message.type === "editor_loaded") {
          if (typeof message.requestId === "string" && pendingRequestId === message.requestId) {
            pendingRequestId = null;
            pendingKind = null;
          }
          setBusy(false);
          setWsState("Ready");
          setStatus(typeof message.message === "string" ? message.message : "Loaded into pi editor.", "success");
          return;
        }

        if (message.type === "editor_snapshot") {
          if (typeof message.requestId === "string" && pendingRequestId && message.requestId !== pendingRequestId) {
            return;
          }
          if (typeof message.requestId === "string" && pendingRequestId === message.requestId) {
            pendingRequestId = null;
            pendingKind = null;
          }

          const content = typeof message.content === "string" ? message.content : "";
          setEditorText(content, { preserveScroll: false, preserveSelection: false });
          setSourceState({ source: "pi-editor", label: "pi editor draft", path: null });
          setBusy(false);
          setWsState("Ready");
          setStatus(
            content.trim()
              ? "Loaded draft from pi editor."
              : "pi editor is empty. Loaded blank text.",
            content.trim() ? "success" : "warning",
          );
          return;
        }

        if (message.type === "studio_document") {
          const nextDoc = message.document;
          if (!nextDoc || typeof nextDoc !== "object" || typeof nextDoc.text !== "string") {
            return;
          }

          const nextSource =
            nextDoc.source === "file" || nextDoc.source === "last-response"
              ? nextDoc.source
              : "blank";
          const nextLabel = typeof nextDoc.label === "string" && nextDoc.label.trim()
            ? nextDoc.label.trim()
            : (nextSource === "file" ? "file" : "studio document");
          const nextPath = typeof nextDoc.path === "string" && nextDoc.path.trim()
            ? nextDoc.path
            : null;

          setEditorText(nextDoc.text, { preserveScroll: false, preserveSelection: false });
          setSourceState({ source: nextSource, label: nextLabel, path: nextPath });
          refreshResponseUi();
          setStatus(
            typeof message.message === "string" && message.message.trim()
              ? message.message
              : "Loaded document from terminal.",
            "success",
          );
          return;
        }

        if (message.type === "git_diff_snapshot") {
          if (typeof message.requestId === "string" && pendingRequestId === message.requestId) {
            pendingRequestId = null;
            pendingKind = null;
          }

          const content = typeof message.content === "string" ? message.content : "";
          const label = typeof message.label === "string" && message.label.trim()
            ? message.label.trim()
            : "git diff";
          setEditorText(content, { preserveScroll: false, preserveSelection: false });
          setSourceState({ source: "blank", label, path: null });
          setEditorLanguage("diff");
          setBusy(false);
          setWsState("Ready");
          refreshResponseUi();
          setStatus(
            typeof message.message === "string" && message.message.trim()
              ? message.message
              : "Loaded current git diff.",
            "success",
          );
          return;
        }

        if (message.type === "studio_state") {
          const busy = Boolean(message.busy);
          agentBusyFromServer = Boolean(message.agentBusy);
          updateTerminalActivityState(message.terminalPhase, message.terminalToolName, message.terminalActivityLabel);
          if (typeof message.modelLabel === "string") {
            modelLabel = message.modelLabel;
          }
          if (typeof message.terminalSessionLabel === "string") {
            terminalSessionLabel = message.terminalSessionLabel;
          }
          applyStudioRunQueueStateFromMessage(message);
          updateFooterMeta();

          if (typeof message.activeRequestId === "string" && message.activeRequestId.length > 0) {
            pendingRequestId = message.activeRequestId;
            if (typeof message.activeRequestKind === "string" && message.activeRequestKind.length > 0) {
              pendingKind = message.activeRequestKind;
            } else if (!pendingKind) {
              pendingKind = "unknown";
            }
            stickyStudioKind = pendingKind;
          } else {
            pendingRequestId = null;
            pendingKind = null;
          }

          if (typeof message.compactInProgress === "boolean") {
            compactInProgress = message.compactInProgress;
          } else if (pendingKind === "compact") {
            compactInProgress = true;
          } else if (!busy) {
            compactInProgress = false;
          }

          setBusy(busy);
          setWsState(busy ? "Submitting" : "Ready");

          if (pendingRequestId) {
            if (busy) {
              setStatus(getStudioBusyStatus(pendingKind), "warning");
            }
            return;
          }

          if (busy) {
            if (agentBusyFromServer && stickyStudioKind) {
              setStatus(getStudioBusyStatus(stickyStudioKind), "warning");
            } else if (agentBusyFromServer && studioRunChainActive) {
              setStatus(getStudioBusyStatus("direct"), "warning");
            } else if (agentBusyFromServer) {
              setStatus(getTerminalBusyStatus(), "warning");
            } else {
              setStatus("Studio is busy.", "warning");
            }
            return;
          }

          stickyStudioKind = null;
          setStatus(getIdleStatus());
          return;
        }

        if (message.type === "busy") {
          if (message.requestId && pendingRequestId === message.requestId) {
            if (pendingKind === "compact") {
              compactInProgress = false;
            }
            pendingRequestId = null;
            pendingKind = null;
          }
          if (typeof message.requestId === "string") {
            clearArmedTitleAttention(message.requestId);
          }
          stickyStudioKind = null;
          setBusy(false);
          setWsState("Ready");
          setStatus(typeof message.message === "string" ? message.message : "Studio is busy.", "warning");
          return;
        }

        if (message.type === "error") {
          if (message.requestId && pendingRequestId === message.requestId) {
            if (pendingKind === "compact") {
              compactInProgress = false;
            }
            pendingRequestId = null;
            pendingKind = null;
          }
          if (typeof message.requestId === "string") {
            clearArmedTitleAttention(message.requestId);
          }
          stickyStudioKind = null;
          setBusy(false);
          setWsState("Ready");
          setStatus(typeof message.message === "string" ? message.message : "Request failed.", "error");
          return;
        }

        if (message.type === "info") {
          if (typeof message.requestId === "string" && pendingRequestId === message.requestId) {
            pendingRequestId = null;
            pendingKind = null;
            setBusy(false);
            setWsState("Ready");
          }
          if (typeof message.message === "string") {
            setStatus(
              message.message,
              typeof message.level === "string" ? message.level : undefined,
            );
          }
        }

        if (message.type === "theme_update" && message.vars && typeof message.vars === "object") {
          var root = document.documentElement;
          Object.keys(message.vars).forEach(function(key) {
            if (key === "color-scheme") {
              root.style.colorScheme = message.vars[key];
            } else {
              root.style.setProperty(key, message.vars[key]);
            }
          });
        }
      }

      function clearScheduledReconnect() {
        if (reconnectTimer !== null) {
          window.clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
      }

      function formatReconnectDelay(delayMs) {
        const delay = Math.max(0, Number(delayMs) || 0);
        if (delay < 1000) return delay + "ms";
        const seconds = delay / 1000;
        return (Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1)) + "s";
      }

      function scheduleReconnect(reasonMessage) {
        if (reconnectTimer !== null) return;

        reconnectAttempt += 1;
        const delayMs = Math.min(8000, 600 * Math.pow(2, Math.max(0, reconnectAttempt - 1)));
        setBusy(true);
        setWsState("Connecting");
        setStatus((reasonMessage || "Connection lost.") + " Reconnecting in " + formatReconnectDelay(delayMs) + "…", "warning");

        reconnectTimer = window.setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, delayMs);
      }

      function connect() {
        clearScheduledReconnect();

        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
          return;
        }

        const token = getToken();
        if (!token) {
          setWsState("Disconnected");
          setStatus("Missing Studio token in URL. Re-run /studio.", "error");
          setBusy(true);
          return;
        }

        const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
        const wsUrl = wsProtocol + "://" + window.location.host + "/ws?token=" + encodeURIComponent(token) + (DEBUG_ENABLED ? "&debug=1" : "");
        const wasReconnect = reconnectAttempt > 0;
        let disconnectHandled = false;

        setWsState("Connecting");
        setStatus(wasReconnect ? "Reconnecting to Studio server…" : "Connecting to Studio server…");
        const socket = new WebSocket(wsUrl);
        ws = socket;

        const connectWatchdog = window.setTimeout(() => {
          if (ws === socket && socket.readyState === WebSocket.CONNECTING) {
            setWsState("Connecting");
            setStatus(wasReconnect ? "Still reconnecting…" : "Still connecting…", "warning");
          }
        }, 3000);

        const handleDisconnect = (kind, code) => {
          if (disconnectHandled) return;
          disconnectHandled = true;
          window.clearTimeout(connectWatchdog);
          if (ws === socket) {
            ws = null;
          }
          setBusy(true);

          if (kind === "invalidated") {
            clearScheduledReconnect();
            reconnectAttempt = 0;
            setWsState("Disconnected");
            setStatus("This tab was invalidated by a newer /studio session.", "warning");
            return;
          }

          if (kind === "shutdown") {
            clearScheduledReconnect();
            reconnectAttempt = 0;
            setWsState("Disconnected");
            setStatus("Studio server shut down. Re-run /studio.", "warning");
            return;
          }

          const detail = typeof code === "number" && code > 0
            ? "Disconnected (code " + code + ")."
            : (kind === "error" ? "WebSocket error." : "Connection lost.");
          scheduleReconnect(detail);
        };

        socket.addEventListener("open", () => {
          window.clearTimeout(connectWatchdog);
          setWsState("Ready");
          setStatus(wasReconnect ? "Reconnected. Syncing…" : "Connected. Syncing…");
          sendMessage({ type: "hello" });
          reconnectAttempt = 0;
        });

        socket.addEventListener("message", (event) => {
          try {
            const message = JSON.parse(event.data);
            handleServerMessage(message);
          } catch (error) {
            setWsState("Ready");
            setStatus("Received invalid server message.", "error");
          }
        });

        socket.addEventListener("close", (event) => {
          if (event && event.code === 4001) {
            handleDisconnect("invalidated", 4001);
            return;
          }
          if (event && event.code === 1001) {
            handleDisconnect("shutdown", 1001);
            return;
          }
          const code = event && typeof event.code === "number" ? event.code : 0;
          handleDisconnect("close", code);
        });

        socket.addEventListener("error", () => {
          handleDisconnect("error");
        });
      }

      function beginUiAction(kind) {
        if (uiBusy) {
          setStatus("Studio is busy.", "warning");
          return null;
        }
        clearTitleAttention();
        const requestId = makeRequestId();
        pendingRequestId = requestId;
        pendingKind = kind;
        stickyStudioKind = kind;
        armTitleAttentionForRequest(requestId, kind);
        setBusy(true);
        setWsState("Submitting");
        setStatus(getStudioBusyStatus(kind), "warning");
        return requestId;
      }

      function describeSourceForAnnotation() {
        if (sourceState.source === "file" && sourceState.label) {
          return "file " + sourceState.label;
        }
        if (sourceState.source === "last-response") {
          return "last model response";
        }
        if (sourceState.label && sourceState.label !== "blank") {
          return sourceState.label;
        }
        return "studio editor";
      }

      function buildAnnotationHeader() {
        const sourceDescriptor = describeSourceForAnnotation();
        let header = "annotated reply below:\n";
        header += "original source: " + sourceDescriptor + "\n";
        header += "user annotation syntax: [an: note]\n";
        header += "precedence: later messages supersede these annotations unless user explicitly references them\n\n---\n\n";
        return header;
      }

      function stripAnnotationBoundaryMarker(text) {
        return String(text || "").replace(/\n{0,2}--- end annotations ---\s*$/i, "");
      }

      function stripAnnotationHeader(text) {
        const normalized = String(text || "").replace(/\r\n/g, "\n");
        if (!normalized.toLowerCase().startsWith("annotated reply below:")) {
          return { hadHeader: false, body: normalized };
        }

        const dividerIndex = normalized.indexOf("\n---");
        if (dividerIndex < 0) {
          return { hadHeader: false, body: normalized };
        }

        let cursor = dividerIndex + 4;
        while (cursor < normalized.length && normalized[cursor] === "\n") {
          cursor += 1;
        }

        return {
          hadHeader: true,
          body: stripAnnotationBoundaryMarker(normalized.slice(cursor)),
        };
      }

      function updateAnnotatedReplyHeaderButton() {
        if (!insertHeaderBtn) return;
        const hasHeader = stripAnnotationHeader(sourceTextEl.value).hadHeader;
        if (hasHeader) {
          insertHeaderBtn.textContent = "Remove annotated reply header";
          insertHeaderBtn.title = "Remove annotated-reply protocol header while keeping body text.";
          return;
        }
        insertHeaderBtn.textContent = "Insert annotated reply header";
        insertHeaderBtn.title = "Insert annotated-reply protocol header (source metadata, [an: ...] syntax hint, precedence note, and end marker).";
      }

      function toggleAnnotatedReplyHeader() {
        const stripped = stripAnnotationHeader(sourceTextEl.value);

        if (stripped.hadHeader) {
          const updated = stripped.body;
          setEditorText(updated, { preserveScroll: true, preserveSelection: true });
          updateResultActionButtons();
          setStatus("Removed annotated reply header.", "success");
          return;
        }

        const cleanedBody = stripAnnotationBoundaryMarker(stripped.body);
        const updated = buildAnnotationHeader() + cleanedBody + "\n\n--- end annotations ---\n\n";
        if (isTextEquivalent(sourceTextEl.value, updated)) {
          setStatus("Annotated reply header already present.");
          return;
        }

        setEditorText(updated, { preserveScroll: true, preserveSelection: true });
        updateResultActionButtons();
        setStatus("Inserted annotated reply header.", "success");
      }

      function requestLatestResponse() {
        const sent = sendMessage({ type: "get_latest_response" });
        if (!sent) return;
        setStatus("Fetching latest response…");
      }

      if (leftPaneEl) {
        leftPaneEl.addEventListener("mousedown", () => setActivePane("left"));
        leftPaneEl.addEventListener("focusin", () => setActivePane("left"));
      }

      if (rightPaneEl) {
        rightPaneEl.addEventListener("mousedown", () => setActivePane("right"));
        rightPaneEl.addEventListener("focusin", () => setActivePane("right"));
      }

      if (leftFocusBtn) {
        leftFocusBtn.addEventListener("click", () => {
          if (paneFocusTarget === "left") {
            exitPaneFocus();
            return;
          }
          enterPaneFocus("left");
        });
      }

      if (rightFocusBtn) {
        rightFocusBtn.addEventListener("click", () => {
          if (paneFocusTarget === "right") {
            exitPaneFocus();
            return;
          }
          enterPaneFocus("right");
        });
      }

      updatePaneFocusButtons();
      window.addEventListener("keydown", handlePaneShortcut);
      window.addEventListener("beforeunload", () => {
        stopFooterSpinner();
      });

      editorViewSelect.addEventListener("change", () => {
        setEditorView(editorViewSelect.value);
      });

      rightViewSelect.addEventListener("change", () => {
        setRightView(rightViewSelect.value);
      });

      followSelect.addEventListener("change", () => {
        followLatest = followSelect.value !== "off";
        if (followLatest && queuedLatestResponse) {
          if (responseHistory.length > 0) {
            selectHistoryIndex(responseHistory.length - 1, { silent: true });
            queuedLatestResponse = null;
            setStatus("Applied queued response.", "success");
          } else if (applyLatestPayload(queuedLatestResponse)) {
            queuedLatestResponse = null;
            setStatus("Applied queued response.", "success");
          }
        } else if (!followLatest) {
          setStatus("Auto-update is off. Use Fetch latest response.");
        }
        updateResultActionButtons();
      });

      if (highlightSelect) {
        highlightSelect.addEventListener("change", () => {
          setEditorHighlightEnabled(highlightSelect.value === "on");
        });
      }

      if (responseHighlightSelect) {
        responseHighlightSelect.addEventListener("change", () => {
          setResponseHighlightEnabled(responseHighlightSelect.value === "on");
        });
      }

      if (langSelect) {
        langSelect.addEventListener("change", () => {
          setEditorLanguage(langSelect.value);
        });
      }

      if (annotationModeSelect) {
        annotationModeSelect.addEventListener("change", () => {
          setAnnotationsEnabled(annotationModeSelect.value !== "off");
        });
      }

      if (compactBtn) {
        compactBtn.addEventListener("click", () => {
          if (compactInProgress) {
            setStatus("Compaction is already running.", "warning");
            return;
          }
          if (uiBusy) {
            setStatus("Studio is busy.", "warning");
            return;
          }

          const requestId = makeRequestId();
          pendingRequestId = requestId;
          pendingKind = "compact";
          stickyStudioKind = "compact";
          compactInProgress = true;
          setBusy(true);
          setWsState("Submitting");

          const sent = sendMessage({ type: "compact_request", requestId });
          if (!sent) {
            compactInProgress = false;
            if (pendingRequestId === requestId) {
              pendingRequestId = null;
              pendingKind = null;
            }
            stickyStudioKind = null;
            setBusy(false);
            return;
          }

          setStatus("Studio: compacting context…", "warning");
        });
      }

      if (historyPrevBtn) {
        historyPrevBtn.addEventListener("click", () => {
          if (!responseHistory.length) {
            setStatus("No response history available yet.", "warning");
            return;
          }
          selectHistoryIndex(responseHistoryIndex - 1);
        });
      }

      if (historyNextBtn) {
        historyNextBtn.addEventListener("click", () => {
          if (!responseHistory.length) {
            setStatus("No response history available yet.", "warning");
            return;
          }
          selectHistoryIndex(responseHistoryIndex + 1);
        });
      }

      if (historyLastBtn) {
        historyLastBtn.addEventListener("click", () => {
          if (!responseHistory.length) {
            setStatus("No response history available yet.", "warning");
            return;
          }
          selectHistoryIndex(responseHistory.length - 1);
        });
      }

      if (loadHistoryPromptBtn) {
        loadHistoryPromptBtn.addEventListener("click", () => {
          const item = getSelectedHistoryItem();
          const prompt = item && typeof item.prompt === "string" ? item.prompt : "";
          if (!prompt.trim()) {
            setStatus("Prompt unavailable for the selected response.", "warning");
            return;
          }

          setEditorText(prompt, { preserveScroll: false, preserveSelection: false });
          setSourceState({ source: "blank", label: getHistoryPromptSourceStateLabel(item), path: null });
          setStatus(getHistoryPromptLoadedStatus(item), "success");
        });
      }

      pullLatestBtn.addEventListener("click", () => {
        if (queuedLatestResponse) {
          if (responseHistory.length > 0) {
            selectHistoryIndex(responseHistory.length - 1, { silent: true });
            queuedLatestResponse = null;
            setStatus("Pulled latest response from history.", "success");
            updateResultActionButtons();
          } else if (applyLatestPayload(queuedLatestResponse)) {
            queuedLatestResponse = null;
            setStatus("Pulled queued response.", "success");
            updateResultActionButtons();
          }
          return;
        }
        requestLatestResponse();
      });

      sourceTextEl.addEventListener("input", () => {
        renderSourcePreview({ previewDelayMs: PREVIEW_INPUT_DEBOUNCE_MS });
        scheduleEditorMetaUpdate();
      });

      sourceTextEl.addEventListener("scroll", () => {
        if (!editorHighlightEnabled || editorView !== "markdown") return;
        syncEditorHighlightScroll();
      });

      sourceTextEl.addEventListener("keyup", () => {
        if (!editorHighlightEnabled || editorView !== "markdown") return;
        syncEditorHighlightScroll();
      });

      sourceTextEl.addEventListener("mouseup", () => {
        if (!editorHighlightEnabled || editorView !== "markdown") return;
        syncEditorHighlightScroll();
      });

      window.addEventListener("resize", () => {
        if (!editorHighlightEnabled || editorView !== "markdown") return;
        syncEditorHighlightScroll();
      });

      insertHeaderBtn.addEventListener("click", () => {
        toggleAnnotatedReplyHeader();
      });

      critiqueBtn.addEventListener("click", () => {
        if (getAbortablePendingKind() === "critique") {
          requestCancelForPendingRequest("critique");
          return;
        }

        const preparedDocumentText = prepareEditorTextForSend(sourceTextEl.value);
        const documentText = preparedDocumentText.trim();
        if (!documentText) {
          setStatus("Add editor text before critique.", "warning");
          return;
        }

        const requestId = beginUiAction("critique");
        if (!requestId) return;

        const sent = sendMessage({
          type: "critique_request",
          requestId,
          document: documentText,
          lens: lensSelect.value,
        });

        if (!sent) {
          pendingRequestId = null;
          pendingKind = null;
          setBusy(false);
        }
      });

      loadResponseBtn.addEventListener("click", () => {
        if (rightView === "thinking") {
          if (!latestResponseThinking.trim()) {
            setStatus("No thinking available for the selected response.", "warning");
            return;
          }
          setEditorText(latestResponseThinking, { preserveScroll: false, preserveSelection: false });
          setSourceState({ source: "blank", label: "assistant thinking", path: null });
          setStatus("Loaded thinking into editor.", "success");
          return;
        }

        if (!latestResponseMarkdown.trim()) {
          setStatus("No response available yet.", "warning");
          return;
        }
        setEditorText(latestResponseMarkdown, { preserveScroll: false, preserveSelection: false });
        setSourceState({ source: "last-response", label: "last model response", path: null });
        setStatus("Loaded response into editor.", "success");
      });

      loadCritiqueNotesBtn.addEventListener("click", () => {
        if (!latestResponseIsStructuredCritique || !latestResponseMarkdown.trim()) {
          setStatus("Latest response is not a structured critique response.", "warning");
          return;
        }

        const notes = buildCritiqueNotesMarkdown(latestResponseMarkdown);
        if (!notes) {
          setStatus("No critique notes (Assessment/Critiques) found in latest response.", "warning");
          return;
        }

        setEditorText(notes, { preserveScroll: false, preserveSelection: false });
        setSourceState({ source: "blank", label: "critique notes", path: null });
        setStatus("Loaded critique notes into editor.", "success");
      });

      loadCritiqueFullBtn.addEventListener("click", () => {
        if (!latestResponseIsStructuredCritique || !latestResponseMarkdown.trim()) {
          setStatus("Latest response is not a structured critique response.", "warning");
          return;
        }

        setEditorText(latestResponseMarkdown, { preserveScroll: false, preserveSelection: false });
        setSourceState({ source: "blank", label: "full critique", path: null });
        setStatus("Loaded full critique into editor.", "success");
      });

      copyResponseBtn.addEventListener("click", async () => {
        const content = rightView === "thinking" ? latestResponseThinking : latestResponseMarkdown;
        if (!content.trim()) {
          setStatus(rightView === "thinking" ? "No thinking available yet." : "No response available yet.", "warning");
          return;
        }

        try {
          await navigator.clipboard.writeText(content);
          setStatus(rightView === "thinking" ? "Copied thinking text." : "Copied response text.", "success");
        } catch (error) {
          setStatus("Clipboard write failed.", "warning");
        }
      });

      if (exportPdfBtn) {
        exportPdfBtn.addEventListener("click", () => {
          void exportRightPanePdf();
        });
      }

      saveAsBtn.addEventListener("click", () => {
        const content = sourceTextEl.value;
        if (!content.trim()) {
          setStatus("Editor is empty. Nothing to save.", "warning");
          return;
        }

        var suggestedName = sourceState.label ? sourceState.label.replace(/^upload:\s*/i, "") : "draft.md";
        var suggestedDir = resourceDirInput && resourceDirInput.value.trim() ? resourceDirInput.value.trim().replace(/\/$/, "") + "/" : "./";
        const suggested = sourceState.path || (suggestedDir + suggestedName);
        const path = window.prompt("Save editor content as:", suggested);
        if (!path) return;

        const requestId = beginUiAction("save_as");
        if (!requestId) return;

        const sent = sendMessage({
          type: "save_as_request",
          requestId,
          path,
          content,
        });

        if (!sent) {
          pendingRequestId = null;
          pendingKind = null;
          setBusy(false);
        }
      });

      saveOverBtn.addEventListener("click", () => {
        var effectivePath = getEffectiveSavePath();
        if (!effectivePath) {
          setStatus("Save editor requires a file path. Open via /studio <path>, set a working dir, or use Save editor as…", "warning");
          return;
        }

        if (!window.confirm("Overwrite " + effectivePath + "?")) {
          return;
        }

        const requestId = beginUiAction("save_over");
        if (!requestId) return;

        // Use save_as with the effective path for both file-backed and derived paths
        const sent = sendMessage({
          type: "save_as_request",
          requestId,
          path: effectivePath,
          content: sourceTextEl.value,
        });

        if (!sent) {
          pendingRequestId = null;
          pendingKind = null;
          setBusy(false);
        }
      });

      sendEditorBtn.addEventListener("click", () => {
        const content = sourceTextEl.value;
        if (!content.trim()) {
          setStatus("Editor is empty. Nothing to send.", "warning");
          return;
        }

        const requestId = beginUiAction("send_to_editor");
        if (!requestId) return;

        const sent = sendMessage({
          type: "send_to_editor_request",
          requestId,
          content,
        });

        if (!sent) {
          pendingRequestId = null;
          pendingKind = null;
          setBusy(false);
        }
      });

      if (getEditorBtn) {
        getEditorBtn.addEventListener("click", () => {
          const requestId = beginUiAction("get_from_editor");
          if (!requestId) return;

          const sent = sendMessage({
            type: "get_from_editor_request",
            requestId,
          });

          if (!sent) {
            pendingRequestId = null;
            pendingKind = null;
            setBusy(false);
          }
        });
      }

      if (loadGitDiffBtn) {
        loadGitDiffBtn.addEventListener("click", () => {
          const requestId = beginUiAction("load_git_diff");
          if (!requestId) return;

          const effectivePath = getEffectiveSavePath();
          const sent = sendMessage({
            type: "load_git_diff_request",
            requestId,
            sourcePath: effectivePath || sourceState.path || undefined,
            resourceDir: resourceDirInput && resourceDirInput.value.trim()
              ? resourceDirInput.value.trim()
              : undefined,
          });

          if (!sent) {
            pendingRequestId = null;
            pendingKind = null;
            setBusy(false);
          }
        });
      }

      sendRunBtn.addEventListener("click", () => {
        if (getAbortablePendingKind() === "direct") {
          requestCancelForPendingRequest("direct");
          return;
        }

        const prepared = prepareEditorTextForSend(sourceTextEl.value);
        if (!prepared.trim()) {
          setStatus("Editor is empty. Nothing to run.", "warning");
          return;
        }

        const requestId = beginUiAction("direct");
        if (!requestId) return;

        const sent = sendMessage({
          type: "send_run_request",
          requestId,
          text: prepared,
        });

        if (!sent) {
          pendingRequestId = null;
          pendingKind = null;
          setBusy(false);
        }
      });

      if (queueSteerBtn) {
        queueSteerBtn.addEventListener("click", () => {
          const prepared = prepareEditorTextForSend(sourceTextEl.value);
          if (!prepared.trim()) {
            setStatus("Editor is empty. Nothing to queue.", "warning");
            return;
          }
          if (!studioRunChainActive) {
            setStatus("Queue steering is only available while Run editor text is active.", "warning");
            return;
          }

          const requestId = makeRequestId();
          clearTitleAttention();
          const sent = sendMessage({
            type: "send_run_request",
            requestId,
            text: prepared,
          });
          if (!sent) return;
          setStatus("Queueing steering…", "warning");
        });
      }

      copyDraftBtn.addEventListener("click", async () => {
        const content = sourceTextEl.value;
        if (!content.trim()) {
          setStatus("Editor is empty. Nothing to copy.", "warning");
          return;
        }

        try {
          await navigator.clipboard.writeText(content);
          setStatus("Copied editor text.", "success");
        } catch (error) {
          setStatus("Clipboard write failed.", "warning");
        }
      });

      if (saveAnnotatedBtn) {
        saveAnnotatedBtn.addEventListener("click", () => {
          const content = sourceTextEl.value;
          if (!content.trim()) {
            setStatus("Editor is empty. Nothing to save.", "warning");
            return;
          }

          const suggested = buildAnnotatedSaveSuggestion();
          const path = window.prompt("Save annotated editor content as:", suggested);
          if (!path) return;

          const requestId = beginUiAction("save_as");
          if (!requestId) return;

          const sent = sendMessage({
            type: "save_as_request",
            requestId,
            path,
            content,
          });

          if (!sent) {
            pendingRequestId = null;
            pendingKind = null;
            setBusy(false);
          }
        });
      }

      if (stripAnnotationsBtn) {
        stripAnnotationsBtn.addEventListener("click", () => {
          const content = sourceTextEl.value;
          if (!hasAnnotationMarkers(content)) {
            setStatus("No [an: ...] markers found in editor.", "warning");
            return;
          }

          const confirmed = window.confirm("Remove all [an: ...] markers from editor text? This cannot be undone.");
          if (!confirmed) return;

          const strippedContent = stripAnnotationMarkers(content);
          setEditorText(strippedContent, { preserveScroll: true, preserveSelection: false });
          setStatus("Removed annotation markers from editor text.", "success");
        });
      }

      // Working directory controls — three states: button | input | label
      function showResourceDirState(state) {
        // state: "button" | "input" | "label"
        if (resourceDirBtn) resourceDirBtn.hidden = state !== "button";
        if (resourceDirInputWrap) {
          if (state === "input") resourceDirInputWrap.classList.add("visible");
          else resourceDirInputWrap.classList.remove("visible");
        }
        if (resourceDirLabel) resourceDirLabel.hidden = state !== "label";
      }
      function applyResourceDir() {
        var dir = resourceDirInput ? resourceDirInput.value.trim() : "";
        if (dir) {
          if (resourceDirLabel) resourceDirLabel.textContent = "Working dir: " + dir;
          showResourceDirState("label");
        } else {
          showResourceDirState("button");
        }
        updateSaveFileTooltip();
        syncActionButtons();
        renderSourcePreview();
      }
      if (resourceDirBtn) {
        resourceDirBtn.addEventListener("click", () => {
          showResourceDirState("input");
          if (resourceDirInput) resourceDirInput.focus();
        });
      }
      if (resourceDirLabel) {
        resourceDirLabel.addEventListener("click", () => {
          showResourceDirState("input");
          if (resourceDirInput) resourceDirInput.focus();
        });
      }
      if (resourceDirInput) {
        resourceDirInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            applyResourceDir();
          } else if (e.key === "Escape") {
            e.preventDefault();
            var dir = resourceDirInput.value.trim();
            if (dir) {
              showResourceDirState("label");
            } else {
              showResourceDirState("button");
            }
          }
        });
      }
      if (resourceDirClearBtn) {
        resourceDirClearBtn.addEventListener("click", () => {
          if (resourceDirInput) resourceDirInput.value = "";
          if (resourceDirLabel) resourceDirLabel.textContent = "";
          showResourceDirState("button");
          updateSaveFileTooltip();
          syncActionButtons();
          renderSourcePreview();
        });
      }

      fileInput.addEventListener("change", () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
          const text = typeof reader.result === "string" ? reader.result : "";
          setEditorText(text, { preserveScroll: false, preserveSelection: false });
          setSourceState({
            source: "upload",
            label: "upload: " + file.name,
            path: null,
          });
          refreshResponseUi();
          const detectedLang = detectLanguageFromName(file.name);
          if (detectedLang) {
            setEditorLanguage(detectedLang);
          }
          setStatus("Loaded file " + file.name + ".", "success");
        };
        reader.onerror = () => {
          setStatus("Failed to read file.", "error");
        };
        reader.readAsText(file);
      });

      setSourceState(initialSourceState);
      refreshResponseUi();
      updateAnnotatedReplyHeaderButton();
      setActivePane("left");

      const storedEditorHighlightEnabled = readStoredEditorHighlightEnabled();
      const initialHighlightEnabled = storedEditorHighlightEnabled ?? Boolean(highlightSelect && highlightSelect.value === "on");
      setEditorHighlightEnabled(initialHighlightEnabled);

      const initialDetectedLang = detectLanguageFromName(initialSourceState.path || initialSourceState.label || "");
      const storedLang = readStoredEditorLanguage();
      setEditorLanguage(initialDetectedLang || storedLang || "markdown");

      const storedResponseHighlightEnabled = readStoredResponseHighlightEnabled();
      const initialResponseHighlightEnabled = storedResponseHighlightEnabled ?? Boolean(responseHighlightSelect && responseHighlightSelect.value === "on");
      setResponseHighlightEnabled(initialResponseHighlightEnabled);

      const storedAnnotationsEnabled = readStoredAnnotationsEnabled();
      const initialAnnotationsEnabled = storedAnnotationsEnabled ?? Boolean(annotationModeSelect ? annotationModeSelect.value !== "off" : true);
      setAnnotationsEnabled(initialAnnotationsEnabled, { silent: true });

      setEditorView(editorView);
      setRightView(rightView);
      renderSourcePreview();
      connect();
      } catch (error) {
        hardFail("Studio UI init failed", error);
      }
    })();


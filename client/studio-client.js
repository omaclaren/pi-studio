    (() => {
      const statusLineEl = document.getElementById("statusLine");
      const statusEl = document.getElementById("status");
      const statusSpinnerEl = document.getElementById("statusSpinner");
      const footerMetaEl = document.getElementById("footerMeta");
      const footerMetaTextEl = document.getElementById("footerMetaText");
      const footerMetaModelEl = document.getElementById("footerMetaModel");
      const footerMetaTerminalEl = document.getElementById("footerMetaTerminal");
      const footerMetaContextEl = document.getElementById("footerMetaContext");
      let faviconLinkEl = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
      if (!faviconLinkEl) {
        faviconLinkEl = document.createElement("link");
        faviconLinkEl.rel = "icon";
        document.head.appendChild(faviconLinkEl);
      }
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
      const reviewNoteGutterEl = document.getElementById("reviewNoteGutter");
      const reviewNoteGutterContentEl = document.getElementById("reviewNoteGutterContent");
      const lineNumberGutterEl = document.getElementById("lineNumberGutter");
      const lineNumberGutterContentEl = document.getElementById("lineNumberGutterContent");
      const lineNumberMeasureEl = document.getElementById("lineNumberMeasure");
      const sourcePreviewEl = document.getElementById("sourcePreview");
      const editorSelectionActionsEl = document.getElementById("editorSelectionActions");
      const editorSelectionCommentBtn = document.getElementById("editorSelectionCommentBtn");
      const editorSelectionJumpBtn = document.getElementById("editorSelectionJumpBtn");
      const leftPaneEl = document.getElementById("leftPane");
      const rightPaneEl = document.getElementById("rightPane");
      const sourceBadgeEl = document.getElementById("sourceBadge");
      const syncBadgeEl = document.getElementById("syncBadge");
      let critiqueViewEl = document.getElementById("critiqueView");
      const responseActionsEl = document.getElementById("responseActions");
      const responseWrapEl = responseActionsEl && typeof responseActionsEl.closest === "function"
        ? responseActionsEl.closest(".response-wrap")
        : null;
      const referenceBadgeEl = document.getElementById("referenceBadge");
      const editorViewSelect = document.getElementById("editorViewSelect");
      const rightViewSelect = document.getElementById("rightViewSelect");
      const followSelect = document.getElementById("followSelect");
      const responseHighlightSelect = document.getElementById("responseHighlightSelect");
      const responseFontSizeSelect = document.getElementById("responseFontSizeSelect");
      const pullLatestBtn = document.getElementById("pullLatestBtn");
      const insertHeaderBtn = document.getElementById("insertHeaderBtn");
      const critiqueBtn = document.getElementById("critiqueBtn");
      const quizBtn = document.getElementById("quizBtn");
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
      const exportPreviewControlsEl = document.getElementById("exportPreviewControls");
      const exportPreviewMenuEl = document.getElementById("exportPreviewMenu");
      const exportPreviewPdfBtn = document.getElementById("exportPreviewPdfBtn");
      const exportPreviewHtmlBtn = document.getElementById("exportPreviewHtmlBtn");
      const exportPdfBtn = document.getElementById("exportPdfBtn");
      const historyPrevBtn = document.getElementById("historyPrevBtn");
      const historyNextBtn = document.getElementById("historyNextBtn");
      const historyLastBtn = document.getElementById("historyLastBtn");
      const historyIndexBadgeEl = document.getElementById("historyIndexBadge");
      const loadHistoryPromptBtn = document.getElementById("loadHistoryPromptBtn");
      const saveAsBtn = document.getElementById("saveAsBtn");
      const saveOverBtn = document.getElementById("saveOverBtn");
      const refreshFromDiskBtn = document.getElementById("refreshFromDiskBtn");
      const sendEditorBtn = document.getElementById("sendEditorBtn");
      const openCompanionBtn = document.getElementById("openCompanionBtn");
      const getEditorBtn = document.getElementById("getEditorBtn");
      const zenModeBtn = document.getElementById("zenModeBtn");
      const loadGitDiffBtn = document.getElementById("loadGitDiffBtn");
      const sendRunBtn = document.getElementById("sendRunBtn");
      const queueSteerBtn = document.getElementById("queueSteerBtn");
      const sendReplBtn = document.getElementById("sendReplBtn");
      const replSendModeSelect = document.getElementById("replSendModeSelect");
      const copyDraftBtn = document.getElementById("copyDraftBtn");
      const saveAnnotatedBtn = document.getElementById("saveAnnotatedBtn");
      const stripAnnotationsBtn = document.getElementById("stripAnnotationsBtn");
      const highlightSelect = document.getElementById("highlightSelect");
      const lineNumbersSelect = document.getElementById("lineNumbersSelect");
      const editorFontSizeSelect = document.getElementById("editorFontSizeSelect");
      const annotationModeSelect = document.getElementById("annotationModeSelect");
      const compactBtn = document.getElementById("compactBtn");
      const leftFocusBtn = document.getElementById("leftFocusBtn");
      const rightFocusBtn = document.getElementById("rightFocusBtn");
      const reviewNotesBtn = document.getElementById("reviewNotesBtn");
      const outlineBtn = document.getElementById("outlineBtn");
      const scratchpadBtn = document.getElementById("scratchpadBtn");
      const scratchpadOverlayEl = document.getElementById("scratchpadOverlay");
      const scratchpadDialogEl = document.getElementById("scratchpadDialog");
      const scratchpadTextEl = document.getElementById("scratchpadText");
      const scratchpadMetaEl = document.getElementById("scratchpadMeta");
      const scratchpadInsertBtn = document.getElementById("scratchpadInsertBtn");
      const scratchpadCopyBtn = document.getElementById("scratchpadCopyBtn");
      const scratchpadClearBtn = document.getElementById("scratchpadClearBtn");
      const scratchpadCloseBtn = document.getElementById("scratchpadCloseBtn");
      const scratchpadDoneBtn = document.getElementById("scratchpadDoneBtn");
      const outlineOverlayEl = document.getElementById("outlineOverlay");
      const outlineDialogEl = document.getElementById("outlineDialog");
      const outlineMetaEl = document.getElementById("outlineMeta");
      const outlineListEl = document.getElementById("outlineList");
      const outlineEmptyStateEl = document.getElementById("outlineEmptyState");
      const outlineCloseBtn = document.getElementById("outlineCloseBtn");
      const outlineDoneBtn = document.getElementById("outlineDoneBtn");
      const reviewNotesOverlayEl = document.getElementById("reviewNotesOverlay");
      const reviewNotesDialogEl = document.getElementById("reviewNotesDialog");
      const reviewNotesMetaEl = document.getElementById("reviewNotesMeta");
      const reviewNotesListEl = document.getElementById("reviewNotesList");
      const reviewNotesEmptyStateEl = document.getElementById("reviewNotesEmptyState");
      const reviewNotesAddBtn = document.getElementById("reviewNotesAddBtn");
      const reviewNotesPromptBtn = document.getElementById("reviewNotesPromptBtn");
      const reviewNotesInlineAllBtn = document.getElementById("reviewNotesInlineAllBtn");
      const reviewNotesDeleteAllBtn = document.getElementById("reviewNotesDeleteAllBtn");
      const reviewNotesCloseBtn = document.getElementById("reviewNotesCloseBtn");
      const reviewNotesDoneBtn = document.getElementById("reviewNotesDoneBtn");

      const studioMode = (document.body && document.body.dataset && document.body.dataset.studioMode) === "editor-only"
        ? "editor-only"
        : "full";
      const isEditorOnlyMode = studioMode === "editor-only";
      const isSshStudioSession = Boolean(document.body && document.body.dataset && document.body.dataset.sshSession === "1");

      const initialQueryParams = new URLSearchParams(window.location.search || "");
      const explicitDocumentIdentityFromUrl = initialQueryParams.has("docId")
        || initialQueryParams.has("docSource")
        || initialQueryParams.has("docLabel")
        || initialQueryParams.has("docPath")
        || initialQueryParams.has("draftId");
      const initialSourceState = {
        source: initialQueryParams.get("docSource")
          || ((document.body && document.body.dataset && document.body.dataset.initialSource) || "blank"),
        label: initialQueryParams.get("docLabel")
          || ((document.body && document.body.dataset && document.body.dataset.initialLabel) || "blank"),
        path: initialQueryParams.get("docPath")
          || ((document.body && document.body.dataset && document.body.dataset.initialPath) || null),
        draftId: initialQueryParams.get("draftId")
          || ((document.body && document.body.dataset && document.body.dataset.initialDraftId) || null),
      };
      const initialResourceDir = initialQueryParams.get("resourceDir")
        || ((document.body && document.body.dataset && document.body.dataset.initialResourceDir) || "");

      let ws = null;
      let wsState = "Connecting";
      let statusMessage = "Connecting · Studio script starting…";
      let statusLevel = "";
      let reconnectTimer = null;
      let reconnectAttempt = 0;
      let studioPdfFocusOverlayEl = null;
      let studioPdfFocusDialogEl = null;
      let studioPdfFocusFrameSlotEl = null;
      let studioPdfFocusFrameEl = null;
      let studioPdfFocusTitleEl = null;
      let studioPdfFocusOpenLinkEl = null;
      let studioPdfFocusFullscreenBtn = null;
      let studioPdfFocusCloseBtn = null;
      let studioPdfFocusLastFocusedEl = null;
      let studioPdfFocusMovedFrameState = null;
      let studioHtmlFocusOverlayEl = null;
      let studioHtmlFocusShellEl = null;
      let studioHtmlFocusFullscreenBtn = null;
      let studioHtmlFocusLastFocusedEl = null;
      let studioHtmlFocusRestoreState = null;
      let pendingRequestId = null;
      let pendingKind = null;
      let stickyStudioKind = null;
      const pendingCompanionWindows = new Map();
      let initialDocumentApplied = false;
      function getInitialRightView(source) {
        if (isEditorOnlyMode) return "editor-preview";
        return String(source || "").trim() === "file" ? "editor-preview" : "preview";
      }

      let editorView = "markdown";
      let rightView = getInitialRightView(initialSourceState.source);
      let followLatest = !isEditorOnlyMode;
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
      let traceState = null;
      let liveTraceState = null;
      const traceSnapshotCache = new Map();
      let traceDisplayContext = { mode: "live", responseId: null, historyIndex: -1, total: 0, summary: null };
      let traceFilter = "all";
      let traceAutoScroll = true;
      let traceRenderRaf = null;
      const traceExpandedOutputs = new Set();
      const TRACE_OUTPUT_PREVIEW_MAX_LINES = 50;
      const TRACE_OUTPUT_PREVIEW_MAX_CHARS = 8000;
      const TRACE_IMAGE_SAFE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
      const REPL_POLL_INTERVAL_MS = 1000;
      const REPL_TRANSCRIPT_MAX_CHARS = 200_000;
      const REPL_JOURNAL_OUTPUT_MAX_CHARS = 80_000;
      const REPL_JOURNAL_MAX_ENTRIES = 80;
      const PDF_EXPORT_FETCH_TIMEOUT_MS = 180_000;
      const HTML_EXPORT_FETCH_TIMEOUT_MS = 180_000;
      const EDITOR_TAB_TEXT = "  ";
      const QUIZ_DEFAULT_COUNT = 5;
      const QUIZ_SCOPES = ["editor", "selection", "file", "folder", "repo"];
      const QUIZ_ANGLES = ["general", "scientist", "mathematician", "statistician", "developer", "reviewer"];
      const QUIZ_THINKING_LEVELS = ["off", "minimal", "low", "medium", "high"];
      let quizOverlayEl = null;
      let quizDialogEl = null;
      let quizPreviewRenderNonce = 0;
      const quizMarkdownRenderCache = new Map();
      let quizState = {
        open: false,
        requestId: null,
        pending: false,
        sourceText: "",
        sourceLabel: "Studio editor",
        sourcePath: "",
        contextPath: "",
        resourceDir: "",
        focusPrompt: "",
        includeEditorContext: false,
        scope: "editor",
        angle: "general",
        thinking: "minimal",
        questionCount: QUIZ_DEFAULT_COUNT,
        cards: [],
        index: 0,
        answer: "",
        feedback: null,
        discussion: [],
        status: "",
        error: "",
      };
      let replTmuxAvailable = null;
      let replSessions = [];
      let replActiveSessionName = "";
      let replRuntime = (() => {
        try {
          return (window.localStorage && window.localStorage.getItem("piStudio.replRuntime")) || "python";
        } catch {
          return "python";
        }
      })();
      let replTranscript = "";
      let replError = "";
      let replMessage = "";
      let replCapturedAt = 0;
      let replFollow = true;
      let replPollTimer = null;
      let replBusy = false;
      let replSendMode = (() => {
        try {
          const stored = window.localStorage && window.localStorage.getItem("piStudio.replSendMode");
          return String(stored || "").trim().toLowerCase() === "literate" ? "literate" : "raw";
        } catch {
          return "raw";
        }
      })();
      function normalizeReplJournalEntry(entry) {
        if (!entry || typeof entry !== "object") return null;
        const normalized = {
          id: typeof entry.id === "string" && entry.id ? entry.id : ("repl-journal-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8)),
          requestId: typeof entry.requestId === "string" ? entry.requestId : "",
          createdAt: typeof entry.createdAt === "number" && Number.isFinite(entry.createdAt) ? entry.createdAt : Date.now(),
          updatedAt: typeof entry.updatedAt === "number" && Number.isFinite(entry.updatedAt) ? entry.updatedAt : Date.now(),
          sessionName: typeof entry.sessionName === "string" ? entry.sessionName : "",
          runtime: typeof entry.runtime === "string" ? entry.runtime : "python",
          label: typeof entry.label === "string" ? entry.label : "REPL send",
          mode: typeof entry.mode === "string" ? entry.mode : "raw",
          prose: typeof entry.prose === "string" ? entry.prose : "",
          code: typeof entry.code === "string" ? entry.code : "",
          output: typeof entry.output === "string" ? entry.output : "",
          beforeTranscript: "",
          status: typeof entry.status === "string" ? entry.status : "sent",
          skippedChunks: Math.max(0, Math.floor(Number(entry.skippedChunks) || 0)),
        };
        return (normalized.code.trim() || normalized.prose.trim() || normalized.output.trim()) ? normalized : null;
      }

      function loadPersistedReplJournalEntries() {
        try {
          const raw = window.localStorage ? window.localStorage.getItem("piStudio.replStudioEntries.v1") : null;
          const parsed = raw ? JSON.parse(raw) : [];
          if (!Array.isArray(parsed)) return [];
          return parsed.map(normalizeReplJournalEntry).filter(Boolean).slice(-REPL_JOURNAL_MAX_ENTRIES);
        } catch {
          return [];
        }
      }

      function persistReplJournalEntries() {
        try {
          if (!window.localStorage) return;
          const compact = replJournalEntries.slice(-REPL_JOURNAL_MAX_ENTRIES).map((entry) => ({
            id: entry.id,
            requestId: entry.requestId,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
            sessionName: entry.sessionName,
            runtime: entry.runtime,
            label: entry.label,
            mode: entry.mode,
            prose: entry.prose,
            code: entry.code,
            output: entry.output,
            status: entry.status,
            skippedChunks: entry.skippedChunks,
          }));
          window.localStorage.setItem("piStudio.replStudioEntries.v1", JSON.stringify(compact));
        } catch {
          // Ignore local persistence failures.
        }
      }

      function mergeReplJournalEntries(entries) {
        if (!Array.isArray(entries) || !entries.length) return false;
        let changed = false;
        const next = [...replJournalEntries];
        for (const rawEntry of entries) {
          const entry = normalizeReplJournalEntry(rawEntry);
          if (!entry) continue;
          const existingIndex = next.findIndex((candidate) => (
            (entry.requestId && candidate.requestId === entry.requestId)
            || candidate.id === entry.id
          ));
          if (existingIndex >= 0) {
            const existing = next[existingIndex];
            const merged = {
              ...existing,
              ...entry,
              label: existing.label || entry.label,
              mode: existing.mode || entry.mode,
              prose: existing.prose || entry.prose,
              beforeTranscript: existing.beforeTranscript || "",
              createdAt: existing.createdAt || entry.createdAt,
              updatedAt: Math.max(existing.updatedAt || 0, entry.updatedAt || 0),
              skippedChunks: existing.skippedChunks || entry.skippedChunks,
            };
            if (JSON.stringify(existing) !== JSON.stringify(merged)) {
              next[existingIndex] = merged;
              changed = true;
            }
          } else {
            next.push(entry);
            changed = true;
          }
        }
        if (!changed) return false;
        replJournalEntries = next
          .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
          .slice(-REPL_JOURNAL_MAX_ENTRIES);
        persistReplJournalEntries();
        return true;
      }

      let replJournalEntries = loadPersistedReplJournalEntries();
      let activeReplJournalEntryId = "";
      let replJournalCollapsed = (() => {
        try {
          const stored = window.localStorage ? window.localStorage.getItem("piStudio.replStudioCollapsed") : null;
          if (stored === "true") return true;
          return false;
        } catch {
          return false;
        }
      })();
      let replMirrorCollapsed = (() => {
        try {
          const stored = window.localStorage ? window.localStorage.getItem("piStudio.rawReplMirrorCollapsed") : null;
          if (stored === "false") return false;
          return true;
        } catch {
          return true;
        }
      })();
      let studioRunChainActive = false;
      let queuedSteeringCount = 0;
      let agentBusyFromServer = false;
      let terminalActivityPhase = "idle";
      let terminalActivityToolName = "";
      let terminalActivityLabel = "";
      let lastSpecificToolLabel = "";
      let uiBusy = false;
      let previewExportInProgress = false;
      let compactInProgress = false;
      let modelLabel = (document.body && document.body.dataset && document.body.dataset.modelLabel) || "none";
      let terminalSessionLabel = (document.body && document.body.dataset && document.body.dataset.terminalLabel) || "unknown";
      let terminalSessionDetail = (document.body && document.body.dataset && document.body.dataset.terminalDetail) || terminalSessionLabel;
      let contextTokens = null;
      let contextWindow = null;
      let contextPercent = null;
      let windowHasFocus = typeof document.hasFocus === "function" ? document.hasFocus() : true;
      let titleAttentionMessage = "";
      let titleAttentionRequestId = null;
      let titleAttentionRequestKind = null;
      let lastRenderedFaviconHref = "";

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

      function createEmptyTraceState() {
        return {
          runId: null,
          requestId: null,
          requestKind: null,
          status: "idle",
          startedAt: null,
          updatedAt: null,
          entries: [],
        };
      }

      function normalizeTraceStatus(status) {
        return status === "running" || status === "complete" ? status : "idle";
      }

      function normalizeTraceEntryStatus(status) {
        return status === "streaming" || status === "pending" || status === "complete" || status === "error"
          ? status
          : "pending";
      }

      function normalizeTraceImageMimeType(value) {
        return typeof value === "string" ? value.trim().toLowerCase() : "";
      }

      function isTraceImageSafeMimeType(mimeType) {
        return TRACE_IMAGE_SAFE_MIME_TYPES.has(normalizeTraceImageMimeType(mimeType));
      }

      function normalizeTraceImage(image, fallbackIndex) {
        if (!image || typeof image !== "object") return null;
        const mimeType = normalizeTraceImageMimeType(image.mimeType);
        if (!isTraceImageSafeMimeType(mimeType)) return null;
        const data = typeof image.data === "string" ? image.data.replace(/\s+/g, "") : "";
        if (!data || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) return null;
        const byteLength = parseFiniteNumber(image.byteLength);
        return {
          id: typeof image.id === "string" && image.id.trim() ? image.id.trim() : ("trace-image-" + fallbackIndex),
          mimeType,
          data,
          byteLength: byteLength == null ? estimateTraceImageByteLength(data) : byteLength,
          label: parseNonEmptyString(image.label),
        };
      }

      function estimateTraceImageByteLength(data) {
        const compact = String(data || "").replace(/\s+/g, "");
        if (!compact) return null;
        const padding = compact.endsWith("==") ? 2 : (compact.endsWith("=") ? 1 : 0);
        return Math.max(0, Math.floor((compact.length * 3) / 4) - padding);
      }

      function normalizeTraceEntry(entry, fallbackIndex) {
        if (!entry || typeof entry !== "object") return null;
        if (entry.type === "assistant") {
          return {
            id: typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : ("trace-assistant-" + fallbackIndex),
            type: "assistant",
            startedAt: parseFiniteNumber(entry.startedAt) || Date.now(),
            updatedAt: parseFiniteNumber(entry.updatedAt) || Date.now(),
            thinking: typeof entry.thinking === "string" ? entry.thinking : "",
            text: typeof entry.text === "string" ? entry.text : "",
            status: normalizeTraceEntryStatus(entry.status),
            stopReason: typeof entry.stopReason === "string" && entry.stopReason.trim() ? entry.stopReason.trim() : null,
          };
        }
        if (entry.type === "tool") {
          return {
            id: typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : ("trace-tool-" + fallbackIndex),
            type: "tool",
            toolCallId: typeof entry.toolCallId === "string" ? entry.toolCallId : ("tool-" + fallbackIndex),
            toolName: typeof entry.toolName === "string" ? entry.toolName : "tool",
            label: parseNonEmptyString(entry.label),
            argsSummary: parseNonEmptyString(entry.argsSummary),
            output: typeof entry.output === "string" ? entry.output : "",
            images: Array.isArray(entry.images)
              ? entry.images.map((image, imageIndex) => normalizeTraceImage(image, imageIndex)).filter(Boolean)
              : [],
            startedAt: parseFiniteNumber(entry.startedAt) || Date.now(),
            updatedAt: parseFiniteNumber(entry.updatedAt) || Date.now(),
            status: normalizeTraceEntryStatus(entry.status),
            isError: Boolean(entry.isError),
          };
        }
        return null;
      }

      function normalizeTraceState(raw) {
        const fallback = createEmptyTraceState();
        if (!raw || typeof raw !== "object") return fallback;
        const entries = Array.isArray(raw.entries)
          ? raw.entries.map((entry, index) => normalizeTraceEntry(entry, index)).filter(Boolean)
          : [];
        return {
          runId: parseNonEmptyString(raw.runId),
          requestId: parseNonEmptyString(raw.requestId),
          requestKind: parseNonEmptyString(raw.requestKind),
          status: normalizeTraceStatus(raw.status),
          startedAt: parseFiniteNumber(raw.startedAt),
          updatedAt: parseFiniteNumber(raw.updatedAt),
          entries,
        };
      }

      function ensureTraceState() {
        if (!traceState) traceState = createEmptyTraceState();
        return traceState;
      }

      function replaceTraceState(nextState) {
        const previousRunId = traceState && traceState.runId ? traceState.runId : null;
        traceState = normalizeTraceState(nextState);
        if ((traceState.runId || null) !== previousRunId) {
          traceExpandedOutputs.clear();
        }
        renderTraceViewIfActive();
      }

      function upsertTraceEntry(entry) {
        const normalized = normalizeTraceEntry(entry, ensureTraceState().entries.length);
        if (!normalized) return;
        const state = ensureTraceState();
        const index = state.entries.findIndex((candidate) => candidate.id === normalized.id);
        if (index >= 0) {
          state.entries[index] = normalized;
        } else {
          state.entries.push(normalized);
        }
        state.updatedAt = normalized.updatedAt;
        renderTraceViewIfActive();
      }

      function appendTraceAssistantDelta(entryId, deltaKind, delta, updatedAt) {
        if (typeof delta !== "string" || !delta) return;
        const state = ensureTraceState();
        const targetId = typeof entryId === "string" && entryId.trim() ? entryId.trim() : null;
        let entry = targetId ? state.entries.find((candidate) => candidate.id === targetId) : null;
        if (!entry || entry.type !== "assistant") {
          entry = normalizeTraceEntry({
            id: targetId || ("trace-assistant-live-" + Date.now()),
            type: "assistant",
            startedAt: updatedAt,
            updatedAt,
            thinking: "",
            text: "",
            status: "streaming",
            stopReason: null,
          }, state.entries.length);
          if (!entry) return;
          state.entries.push(entry);
        }
        if (deltaKind === "thinking") {
          entry.thinking += delta;
        } else {
          entry.text += delta;
        }
        entry.status = "streaming";
        entry.updatedAt = parseFiniteNumber(updatedAt) || Date.now();
        state.updatedAt = entry.updatedAt;
        renderTraceViewIfActive();
      }

      function updateTraceStatusFromMessage(message) {
        if (!message || typeof message !== "object") return;
        const state = ensureTraceState();
        state.runId = parseNonEmptyString(message.runId) || state.runId;
        if (Object.prototype.hasOwnProperty.call(message, "requestId")) {
          state.requestId = parseNonEmptyString(message.requestId);
        }
        if (Object.prototype.hasOwnProperty.call(message, "requestKind")) {
          state.requestKind = parseNonEmptyString(message.requestKind);
        }
        if (Object.prototype.hasOwnProperty.call(message, "startedAt")) {
          state.startedAt = parseFiniteNumber(message.startedAt);
        }
        if (Object.prototype.hasOwnProperty.call(message, "updatedAt")) {
          state.updatedAt = parseFiniteNumber(message.updatedAt);
        }
        if (Object.prototype.hasOwnProperty.call(message, "status")) {
          state.status = normalizeTraceStatus(message.status);
        }
        renderTraceViewIfActive();
      }

      function shouldDisplayLiveTrace() {
        return !Array.isArray(responseHistory)
          || responseHistory.length === 0
          || responseHistoryIndex < 0
          || responseHistoryIndex >= responseHistory.length - 1;
      }

      function setTraceDisplayContext(nextContext) {
        const fallback = { mode: "live", responseId: null, historyIndex: -1, total: 0, summary: null };
        traceDisplayContext = Object.assign(fallback, nextContext && typeof nextContext === "object" ? nextContext : {});
      }

      function ensureLiveTraceState() {
        if (!liveTraceState) liveTraceState = createEmptyTraceState();
        return liveTraceState;
      }

      function upsertTraceEntryInState(state, entry) {
        const normalized = normalizeTraceEntry(entry, Array.isArray(state.entries) ? state.entries.length : 0);
        if (!normalized) return null;
        if (!Array.isArray(state.entries)) state.entries = [];
        const index = state.entries.findIndex((candidate) => candidate.id === normalized.id);
        if (index >= 0) {
          state.entries[index] = normalized;
        } else {
          state.entries.push(normalized);
        }
        state.updatedAt = normalized.updatedAt;
        return normalized;
      }

      function replaceLiveTraceState(nextState) {
        liveTraceState = normalizeTraceState(nextState);
        if (shouldDisplayLiveTrace()) {
          setTraceDisplayContext({ mode: "live", responseId: null, historyIndex: responseHistoryIndex, total: responseHistory.length, summary: null });
          replaceTraceState(liveTraceState);
        }
      }

      function upsertLiveTraceEntry(entry) {
        const normalized = upsertTraceEntryInState(ensureLiveTraceState(), entry);
        if (!normalized) return;
        if (shouldDisplayLiveTrace()) {
          setTraceDisplayContext({ mode: "live", responseId: null, historyIndex: responseHistoryIndex, total: responseHistory.length, summary: null });
          upsertTraceEntry(normalized);
        }
      }

      function appendLiveTraceAssistantDelta(entryId, deltaKind, delta, updatedAt) {
        if (typeof delta !== "string" || !delta) return;
        const state = ensureLiveTraceState();
        const targetId = typeof entryId === "string" && entryId.trim() ? entryId.trim() : null;
        let entry = targetId ? state.entries.find((candidate) => candidate.id === targetId) : null;
        if (!entry || entry.type !== "assistant") {
          entry = normalizeTraceEntry({
            id: targetId || ("trace-assistant-live-" + Date.now()),
            type: "assistant",
            startedAt: updatedAt,
            updatedAt,
            thinking: "",
            text: "",
            status: "streaming",
            stopReason: null,
          }, state.entries.length);
          if (!entry) return;
          state.entries.push(entry);
        }
        if (deltaKind === "thinking") {
          entry.thinking += delta;
        } else {
          entry.text += delta;
        }
        entry.status = "streaming";
        entry.updatedAt = parseFiniteNumber(updatedAt) || Date.now();
        state.updatedAt = entry.updatedAt;
        if (shouldDisplayLiveTrace()) {
          setTraceDisplayContext({ mode: "live", responseId: null, historyIndex: responseHistoryIndex, total: responseHistory.length, summary: null });
          appendTraceAssistantDelta(entryId, deltaKind, delta, updatedAt);
        }
      }

      function updateLiveTraceStatusFromMessage(message) {
        if (!message || typeof message !== "object") return;
        const state = ensureLiveTraceState();
        state.runId = parseNonEmptyString(message.runId) || state.runId;
        if (Object.prototype.hasOwnProperty.call(message, "requestId")) state.requestId = parseNonEmptyString(message.requestId);
        if (Object.prototype.hasOwnProperty.call(message, "requestKind")) state.requestKind = parseNonEmptyString(message.requestKind);
        if (Object.prototype.hasOwnProperty.call(message, "startedAt")) state.startedAt = parseFiniteNumber(message.startedAt);
        if (Object.prototype.hasOwnProperty.call(message, "updatedAt")) state.updatedAt = parseFiniteNumber(message.updatedAt);
        if (Object.prototype.hasOwnProperty.call(message, "status")) state.status = normalizeTraceStatus(message.status);
        if (shouldDisplayLiveTrace()) {
          setTraceDisplayContext({ mode: "live", responseId: null, historyIndex: responseHistoryIndex, total: responseHistory.length, summary: null });
          updateTraceStatusFromMessage(message);
        }
      }

      function normalizeTraceFilter(filter) {
        return filter === "thinking" || filter === "tools" ? filter : "all";
      }

      function setTraceFilter(nextFilter) {
        const normalized = normalizeTraceFilter(nextFilter);
        if (traceFilter === normalized) return;
        traceFilter = normalized;
        traceAutoScroll = true;
        renderTraceViewIfActive();
      }

      function getTraceEntriesForFilter(filterOverride) {
        const state = traceState || createEmptyTraceState();
        const filter = normalizeTraceFilter(filterOverride || traceFilter);
        const entries = Array.isArray(state.entries) ? state.entries : [];
        if (filter === "tools") {
          return entries.filter((entry) => entry.type === "tool");
        }
        if (filter === "thinking") {
          return entries.filter((entry) => entry.type === "assistant" && String(entry.thinking || "").trim());
        }
        return entries.filter((entry) => {
          if (entry.type === "assistant") {
            return Boolean(String(entry.thinking || "").trim() || String(entry.text || "").trim());
          }
          return true;
        });
      }

      function formatTraceImageSize(byteLength) {
        if (typeof byteLength !== "number" || !Number.isFinite(byteLength) || byteLength < 0) return "unknown size";
        if (byteLength < 1024) return formatNumber(byteLength) + " B";
        if (byteLength < 1024 * 1024) return (byteLength / 1024).toFixed(byteLength >= 100 * 1024 ? 0 : 1).replace(/\.0$/, "") + " KB";
        return (byteLength / (1024 * 1024)).toFixed(byteLength >= 100 * 1024 * 1024 ? 0 : 1).replace(/\.0$/, "") + " MB";
      }

      function describeTraceImageForText(image) {
        if (!image || typeof image !== "object") return "";
        const parts = [];
        if (image.label) parts.push(String(image.label));
        parts.push(String(image.mimeType || "image"));
        parts.push(formatTraceImageSize(image.byteLength));
        return parts.filter(Boolean).join(" — ");
      }

      function buildVisibleWorkingText(filterOverride) {
        const filter = normalizeTraceFilter(filterOverride || traceFilter);
        const entries = getTraceEntriesForFilter(filter);
        if (!entries.length) return "";

        if (filter === "thinking") {
          return entries
            .map((entry) => entry && entry.type === "assistant" ? String(entry.thinking || "").trim() : "")
            .filter(Boolean)
            .join("\n\n");
        }

        return entries.map((entry) => {
          if (entry.type === "assistant") {
            const parts = [];
            if (String(entry.thinking || "").trim()) {
              parts.push("[Thinking]\n" + String(entry.thinking || "").trim());
            }
            if (filter === "all" && String(entry.text || "").trim()) {
              parts.push("[Response]\n" + String(entry.text || "").trim());
            }
            return ["Assistant", ...parts].join("\n\n").trim();
          }

          const header = entry.label && entry.label !== entry.toolName
            ? ("Tool: " + String(entry.toolName || "tool") + " — " + entry.label)
            : ("Tool: " + String(entry.toolName || "tool"));
          const parts = [header];
          if (String(entry.argsSummary || "").trim()) {
            parts.push("Input:\n" + String(entry.argsSummary || "").trim());
          }
          if (String(entry.output || "").trim()) {
            parts.push("Output:\n" + String(entry.output || "").trim());
          }
          const imageSummaries = Array.isArray(entry.images)
            ? entry.images.map(describeTraceImageForText).filter(Boolean)
            : [];
          if (imageSummaries.length) {
            parts.push("Images:\n" + imageSummaries.map((summary) => "- " + summary).join("\n"));
          }
          return parts.join("\n\n").trim();
        }).filter(Boolean).join("\n\n---\n\n");
      }

      function getWorkingDocumentLabel(filterOverride) {
        const filter = normalizeTraceFilter(filterOverride || traceFilter);
        if (filter === "thinking") return "working (thinking)";
        if (filter === "tools") return "working (tools)";
        return "working";
      }

      async function writeTextToClipboard(text) {
        const content = String(text || "");

        if (!isSshStudioSession) {
          try {
            await fetchStudioJson("/clipboard", {
              method: "POST",
              body: JSON.stringify({ text: content }),
            });
            return true;
          } catch {
            // Fall back to browser clipboard APIs. The server-side clipboard path
            // is most reliable for local Studio, but may be unavailable on systems
            // without a clipboard command.
          }
        }

        // Prefer a copy-event payload first. It runs synchronously inside the
        // user's click gesture and avoids browser quirks where copying a hidden
        // textarea reports success but leaves the system clipboard unchanged.
        if (document.execCommand && typeof document.addEventListener === "function") {
          let handled = false;
          const handleCopy = (event) => {
            if (!event || !event.clipboardData) return;
            event.clipboardData.setData("text/plain", content);
            event.preventDefault();
            handled = true;
          };
          try {
            document.addEventListener("copy", handleCopy, true);
            const ok = document.execCommand("copy");
            if (ok && handled) return true;
          } catch {
            // Fall through to the other clipboard paths.
          } finally {
            document.removeEventListener("copy", handleCopy, true);
          }
        }

        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          try {
            await navigator.clipboard.writeText(content);
            return true;
          } catch {
            // Fall through to the selection-based legacy path.
          }
        }

        const textarea = document.createElement("textarea");
        textarea.value = content;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.top = "0";
        textarea.style.left = "0";
        textarea.style.width = "1px";
        textarea.style.height = "1px";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        const activeEl = document.activeElement;
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
        let ok = false;
        try {
          ok = document.execCommand && document.execCommand("copy");
        } catch {
          ok = false;
        }
        textarea.remove();
        if (activeEl && typeof activeEl.focus === "function") {
          try {
            activeEl.focus();
          } catch {
            // Ignore focus restore failures.
          }
        }
        return Boolean(ok);
      }

      async function copyVisibleWorkingToClipboard() {
        const content = buildVisibleWorkingText();
        if (!content.trim()) {
          setStatus("No visible working details to copy yet.", "warning");
          return;
        }
        if (await writeTextToClipboard(content)) {
          setStatus("Copied visible working text.", "success");
        } else {
          setStatus("Clipboard write failed.", "warning");
        }
      }

      function loadVisibleWorkingIntoEditor() {
        const content = buildVisibleWorkingText();
        if (!content.trim()) {
          setStatus("No visible working details to load yet.", "warning");
          return;
        }
        setEditorText(content, { preserveScroll: false, preserveSelection: false });
        setSourceState({ source: "blank", label: getWorkingDocumentLabel(), path: null });
        setStatus("Loaded visible working into editor.", "success");
      }

      function normalizeReplRuntime(value) {
        const runtime = String(value || "").trim().toLowerCase();
        return runtime === "shell" || runtime === "python" || runtime === "ipython" || runtime === "julia" || runtime === "r" || runtime === "ghci" || runtime === "clojure"
          ? runtime
          : "python";
      }

      function normalizeReplSession(session) {
        if (!session || typeof session !== "object") return null;
        const sessionName = typeof session.sessionName === "string" && session.sessionName.trim() ? session.sessionName.trim() : "";
        if (!sessionName) return null;
        return {
          sessionName,
          target: typeof session.target === "string" ? session.target : (sessionName + ":0.0"),
          runtime: typeof session.runtime === "string" ? session.runtime : "unknown",
          label: typeof session.label === "string" && session.label.trim() ? session.label.trim() : sessionName,
          source: typeof session.source === "string" ? session.source : "tmux",
        };
      }

      function setReplRuntime(runtime) {
        replRuntime = normalizeReplRuntime(runtime);
        try {
          if (window.localStorage) window.localStorage.setItem("piStudio.replRuntime", replRuntime);
        } catch {
          // Ignore storage failures.
        }
      }

      function normalizeReplSendMode(value) {
        return String(value || "").trim().toLowerCase() === "literate" ? "literate" : "raw";
      }

      function isMacShortcutPlatform() {
        try {
          const platform = String((navigator && navigator.platform) || "");
          return /Mac|iPhone|iPad|iPod/i.test(platform);
        } catch {
          return true;
        }
      }

      function getStudioShortcutLabel(kind) {
        const mac = isMacShortcutPlatform();
        if (kind === "repl-send") return mac ? "⇧⌘↵" : "Ctrl+Shift+Enter";
        if (kind === "run") return mac ? "⌘↵" : "Ctrl+Enter";
        return "";
      }

      function withStudioShortcutLabel(label, kind) {
        const shortcut = getStudioShortcutLabel(kind);
        return shortcut ? (label + " " + shortcut) : label;
      }

      function setReplSendMode(mode) {
        replSendMode = normalizeReplSendMode(mode);
        if (replSendModeSelect) replSendModeSelect.value = replSendMode;
        try {
          if (window.localStorage) window.localStorage.setItem("piStudio.replSendMode", replSendMode);
        } catch {
          // Ignore storage failures.
        }
      }

      function setReplJournalCollapsed(collapsed) {
        replJournalCollapsed = Boolean(collapsed);
        try {
          if (window.localStorage) window.localStorage.setItem("piStudio.replStudioCollapsed", replJournalCollapsed ? "true" : "false");
        } catch {
          // Ignore storage failures.
        }
        renderReplViewIfActive({ force: true });
      }

      function setReplMirrorCollapsed(collapsed) {
        replMirrorCollapsed = Boolean(collapsed);
        try {
          if (window.localStorage) window.localStorage.setItem("piStudio.rawReplMirrorCollapsed", replMirrorCollapsed ? "true" : "false");
        } catch {
          // Ignore storage failures.
        }
        renderReplViewIfActive({ force: true });
      }

      function serializeReplSessionsForCompare(sessions) {
        return JSON.stringify((Array.isArray(sessions) ? sessions : [])
          .map(normalizeReplSession)
          .filter(Boolean)
          .map((session) => ({
            sessionName: session.sessionName,
            label: session.label,
            runtime: session.runtime,
            source: session.source,
            target: session.target,
          })));
      }

      function setReplSessions(sessions) {
        const previous = serializeReplSessionsForCompare(replSessions);
        const previousActive = replActiveSessionName;
        replSessions = Array.isArray(sessions)
          ? sessions.map(normalizeReplSession).filter(Boolean)
          : [];
        if (replActiveSessionName && !replSessions.some((session) => session.sessionName === replActiveSessionName)) {
          replActiveSessionName = replSessions[0] ? replSessions[0].sessionName : "";
        }
        return previous !== serializeReplSessionsForCompare(replSessions) || previousActive !== replActiveSessionName;
      }

      function getActiveReplSession() {
        return replSessions.find((session) => session.sessionName === replActiveSessionName) || null;
      }

      function buildActiveReplPromptContext() {
        if (rightView !== "repl") return "";
        const session = getActiveReplSession();
        if (!session) return "";
        const runtime = session.runtime && session.runtime !== "unknown" ? session.runtime : "unknown";
        return [
          "[Studio active REPL]",
          "The right pane is mirroring an active tmux-backed REPL session.",
          "If the user refers to the active REPL, send code to this session rather than inventing a separate one.",
          "Session name: " + session.sessionName,
          "tmux target: " + (session.target || (session.sessionName + ":0.0")),
          "runtime: " + runtime,
          "Use the studio_repl_send tool for code execution in this REPL. Pass sessionName when targeting this exact session.",
          "Do not improvise raw tmux paste commands for multiline code; Studio handles runtime-specific safe submission.",
          "[/Studio active REPL]",
        ].join("\n");
      }

      function prepareEditorTextForRunRequest(text) {
        const prepared = prepareEditorTextForSend(text);
        const replContext = buildActiveReplPromptContext();
        return replContext ? (replContext + "\n\n" + prepared) : prepared;
      }

      function setActiveReplSession(sessionName) {
        const name = String(sessionName || "").trim();
        if (!name) {
          if (replActiveSessionName) {
            replTranscript = "";
            replCapturedAt = 0;
          }
          replActiveSessionName = "";
          return;
        }
        if (replActiveSessionName && replActiveSessionName !== name) {
          replTranscript = "";
          replCapturedAt = 0;
          activeReplJournalEntryId = "";
        }
        replActiveSessionName = name;
      }

      function trimReplTranscript(text) {
        const value = String(text || "");
        if (value.length <= REPL_TRANSCRIPT_MAX_CHARS) return value;
        return "… " + formatCompactNumber(value.length - REPL_TRANSCRIPT_MAX_CHARS) + " earlier chars omitted …\n" + value.slice(value.length - REPL_TRANSCRIPT_MAX_CHARS);
      }

      function requestReplList() {
        if (wsState === "Disconnected") return false;
        return sendMessage({ type: "repl_list_request" });
      }

      function requestReplCapture() {
        if (wsState === "Disconnected") return false;
        if (replActiveSessionName) {
          return sendMessage({ type: "repl_capture_request", sessionName: replActiveSessionName });
        }
        return sendMessage({ type: "repl_list_request" });
      }

      function isReplControlFocused() {
        const activeEl = document.activeElement;
        return activeEl instanceof Element && Boolean(activeEl.closest(".repl-controls"));
      }

      function renderReplViewIfActive(options) {
        if (rightView !== "repl") return;
        if ((!options || options.force !== true) && isReplControlFocused()) return;
        if (traceRenderRaf !== null) return;
        traceRenderRaf = window.requestAnimationFrame(() => {
          traceRenderRaf = null;
          refreshResponseUi();
        });
      }

      function startReplPolling() {
        if (rightView !== "repl") return;
        if (replPollTimer !== null) return;
        requestReplCapture();
        replPollTimer = window.setInterval(() => {
          if (rightView !== "repl") {
            stopReplPolling();
            return;
          }
          requestReplCapture();
        }, REPL_POLL_INTERVAL_MS);
      }

      function stopReplPolling() {
        if (replPollTimer !== null) {
          window.clearInterval(replPollTimer);
          replPollTimer = null;
        }
      }

      function getActiveReplRuntime() {
        const session = getActiveReplSession();
        if (session && session.runtime && session.runtime !== "unknown") return normalizeReplRuntime(session.runtime);
        return normalizeReplRuntime(replRuntime);
      }

      function getEditorSelectionRange() {
        const raw = String(sourceTextEl.value || "");
        const start = typeof sourceTextEl.selectionStart === "number" ? sourceTextEl.selectionStart : 0;
        const end = typeof sourceTextEl.selectionEnd === "number" ? sourceTextEl.selectionEnd : start;
        const safeStart = Math.max(0, Math.min(start, raw.length));
        const safeEnd = Math.max(safeStart, Math.min(end, raw.length));
        return { raw, start: safeStart, end: safeEnd, selected: safeEnd > safeStart ? raw.slice(safeStart, safeEnd) : "" };
      }

      function normalizeMarkdownFenceLanguage(info) {
        let value = String(info || "").trim();
        if (!value) return "";
        let first = "";
        if (value.startsWith("{")) {
          const closeIndex = value.indexOf("}");
          const inner = closeIndex >= 0 ? value.slice(1, closeIndex) : value.slice(1);
          first = inner.split(/[\s,]+/)[0] || "";
        } else {
          first = value.split(/\s+/)[0] || "";
        }
        first = first.replace(/^\./, "").trim().toLowerCase();
        if (first === "py") return "python";
        if (first === "jl") return "julia";
        if (first === "sh" || first === "zsh" || first === "fish") return "shell";
        if (first === "bash") return "shell";
        if (first === "hs" || first === "haskell") return "ghci";
        if (first === "clj" || first === "cljc") return "clojure";
        return first;
      }

      function parseMarkdownCodeFences(markdown) {
        const text = String(markdown || "");
        const blocks = [];
        let offset = 0;
        let open = null;
        while (offset <= text.length) {
          const newlineIndex = text.indexOf("\n", offset);
          const lineEnd = newlineIndex >= 0 ? newlineIndex : text.length;
          const lineWithNewlineEnd = newlineIndex >= 0 ? newlineIndex + 1 : lineEnd;
          const line = text.slice(offset, lineEnd);
          if (!open) {
            const openMatch = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
            if (openMatch) {
              const fence = openMatch[1] || "";
              open = {
                start: offset,
                fence,
                fenceChar: fence.charAt(0),
                fenceLength: fence.length,
                info: openMatch[2] || "",
                contentStart: lineWithNewlineEnd,
              };
            }
          } else {
            const closePattern = new RegExp("^ {0,3}" + open.fenceChar + "{" + open.fenceLength + ",}[ \\t]*$");
            if (closePattern.test(line)) {
              blocks.push({
                start: open.start,
                end: lineWithNewlineEnd,
                contentStart: open.contentStart,
                contentEnd: offset,
                info: open.info,
                language: normalizeMarkdownFenceLanguage(open.info),
                code: text.slice(open.contentStart, offset),
              });
              open = null;
            }
          }
          if (newlineIndex < 0) break;
          offset = lineWithNewlineEnd;
        }
        return blocks;
      }

      function isFenceLanguageCompatibleWithRuntime(language, runtime) {
        const lang = normalizeMarkdownFenceLanguage(language);
        if (!lang) return true;
        const activeRuntime = normalizeReplRuntime(runtime || getActiveReplRuntime());
        if (activeRuntime === "python" || activeRuntime === "ipython") return lang === "python" || lang === "ipython";
        if (activeRuntime === "r") return lang === "r";
        if (activeRuntime === "julia") return lang === "julia";
        if (activeRuntime === "shell") return lang === "shell" || lang === "bash" || lang === "sh";
        if (activeRuntime === "ghci") return lang === "ghci" || lang === "haskell";
        if (activeRuntime === "clojure") return lang === "clojure";
        return true;
      }

      function stripFencedBlocksFromMarkdown(markdown, blocks) {
        const text = String(markdown || "");
        const ranges = Array.isArray(blocks) ? blocks : parseMarkdownCodeFences(text);
        if (!ranges.length) return text.trim();
        let cursor = 0;
        const pieces = [];
        ranges.forEach((block) => {
          pieces.push(text.slice(cursor, block.start));
          cursor = block.end;
        });
        pieces.push(text.slice(cursor));
        return pieces.join("\n").replace(/\n{3,}/g, "\n\n").trim();
      }

      function getCurrentMarkdownCodeFence(markdown, caretOffset) {
        const text = String(markdown || "");
        const safeCaret = Math.max(0, Math.min(Math.floor(Number(caretOffset) || 0), text.length));
        return parseMarkdownCodeFences(text).find((block) => safeCaret >= block.contentStart && safeCaret <= block.contentEnd) || null;
      }

      function unwrapSingleMarkdownCodeFenceForReplSend(text) {
        const source = String(text || "");
        const blocks = parseMarkdownCodeFences(source);
        if (blocks.length !== 1) return null;
        const block = blocks[0];
        if (source.slice(0, block.start).trim() || source.slice(block.end).trim()) return null;
        if (!isFenceLanguageCompatibleWithRuntime(block.language, getActiveReplRuntime())) return null;
        const code = String(block.code || "").trimEnd();
        if (!code.trim()) return null;
        return {
          code,
          label: "single " + (block.language || getActiveReplRuntime()) + " chunk",
        };
      }

      function buildRawReplSendPayload() {
        const range = getEditorSelectionRange();
        const selected = range.selected;
        const source = selected || range.raw;
        const unwrapped = unwrapSingleMarkdownCodeFenceForReplSend(source);
        return {
          text: prepareEditorTextForSend(unwrapped ? unwrapped.code : source),
          prose: "",
          label: unwrapped ? unwrapped.label : (selected ? "selection" : "full editor"),
          mode: "raw",
          noteOnly: false,
          skippedChunks: 0,
        };
      }

      function buildLiterateReplSendPayload() {
        const range = getEditorSelectionRange();
        const runtime = getActiveReplRuntime();
        if (range.selected) {
          const blocks = parseMarkdownCodeFences(range.selected);
          if (blocks.length) {
            const compatibleBlocks = blocks.filter((block) => isFenceLanguageCompatibleWithRuntime(block.language, runtime));
            const code = compatibleBlocks.map((block) => String(block.code || "").trimEnd()).filter((chunk) => chunk.trim()).join("\n\n");
            const prose = stripFencedBlocksFromMarkdown(range.selected, blocks);
            if (code.trim()) {
              return {
                text: prepareEditorTextForSend(code),
                prose,
                label: "selection · " + compatibleBlocks.length + " code chunk" + (compatibleBlocks.length === 1 ? "" : "s"),
                mode: "literate",
                noteOnly: false,
                skippedChunks: Math.max(0, blocks.length - compatibleBlocks.length),
              };
            }
            if (prose.trim()) {
              return {
                text: "",
                prose,
                label: "selected prose",
                mode: "literate",
                noteOnly: true,
                skippedChunks: blocks.length,
              };
            }
            return { error: "Selected code chunks do not match the active REPL runtime." };
          }
          return {
            text: prepareEditorTextForSend(range.selected),
            prose: "",
            label: "selection",
            mode: "literate",
            noteOnly: false,
            skippedChunks: 0,
          };
        }

        const currentBlock = getCurrentMarkdownCodeFence(range.raw, range.start);
        if (currentBlock) {
          if (!isFenceLanguageCompatibleWithRuntime(currentBlock.language, runtime)) {
            return { error: "Current code chunk is marked " + (currentBlock.language || "unknown") + ", but the active REPL is " + runtime + "." };
          }
          return {
            text: prepareEditorTextForSend(String(currentBlock.code || "").trimEnd()),
            prose: "",
            label: "current " + (currentBlock.language || runtime) + " chunk",
            mode: "literate",
            noteOnly: false,
            skippedChunks: 0,
          };
        }

        const allBlocks = parseMarkdownCodeFences(range.raw);
        if (allBlocks.length) {
          return buildAllChunksReplSendPayload();
        }

        return {
          text: prepareEditorTextForSend(range.raw),
          prose: "",
          label: "full editor",
          mode: "literate",
          noteOnly: false,
          skippedChunks: 0,
        };
      }

      function buildAllChunksReplSendPayload() {
        const range = getEditorSelectionRange();
        const runtime = getActiveReplRuntime();
        const blocks = parseMarkdownCodeFences(range.raw);
        if (!blocks.length) return { error: "No fenced code chunks found in the editor." };
        const compatibleBlocks = blocks.filter((block) => isFenceLanguageCompatibleWithRuntime(block.language, runtime));
        const code = compatibleBlocks.map((block) => String(block.code || "").trimEnd()).filter((chunk) => chunk.trim()).join("\n\n");
        if (!code.trim()) return { error: "No code chunks match the active REPL runtime." };
        return {
          text: prepareEditorTextForSend(code),
          prose: "",
          label: "all " + runtime + " chunks · " + compatibleBlocks.length + " of " + blocks.length,
          mode: "literate",
          noteOnly: false,
          skippedChunks: Math.max(0, blocks.length - compatibleBlocks.length),
        };
      }

      function getSelectedOrCurrentParagraphForReplNote() {
        const range = getEditorSelectionRange();
        if (range.selected.trim()) return range.selected.trim();
        const before = range.raw.lastIndexOf("\n\n", Math.max(0, range.start - 1));
        const after = range.raw.indexOf("\n\n", range.start);
        const start = before >= 0 ? before + 2 : 0;
        const end = after >= 0 ? after : range.raw.length;
        return range.raw.slice(start, end).trim();
      }

      function trimReplJournalOutput(text) {
        const value = String(text || "").trimEnd();
        if (value.length <= REPL_JOURNAL_OUTPUT_MAX_CHARS) return value;
        return "… " + formatCompactNumber(value.length - REPL_JOURNAL_OUTPUT_MAX_CHARS) + " earlier chars omitted …\n" + value.slice(value.length - REPL_JOURNAL_OUTPUT_MAX_CHARS);
      }

      function createReplJournalEntry(details) {
        return {
          id: "repl-journal-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
          requestId: details.requestId || "",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          sessionName: details.sessionName || "",
          runtime: details.runtime || getActiveReplRuntime(),
          label: details.label || "REPL send",
          mode: details.mode || replSendMode,
          prose: String(details.prose || ""),
          code: String(details.code || ""),
          output: String(details.output || ""),
          beforeTranscript: String(details.beforeTranscript || ""),
          status: details.status || "sent",
          skippedChunks: Math.max(0, Math.floor(Number(details.skippedChunks) || 0)),
        };
      }

      function addReplJournalEntry(details) {
        const entry = createReplJournalEntry(details || {});
        replJournalEntries = [...replJournalEntries, entry].slice(-REPL_JOURNAL_MAX_ENTRIES);
        persistReplJournalEntries();
        return entry;
      }

      function recordReplToolSend(message) {
        const requestId = typeof message.toolCallId === "string" && message.toolCallId.trim()
          ? "tool:" + message.toolCallId.trim()
          : (typeof message.requestId === "string" && message.requestId.trim() ? message.requestId.trim() : "");
        const code = String(message.code || "");
        if (!code.trim()) return false;
        const runtime = normalizeReplRuntime(message.runtime || getActiveReplRuntime());
        const sessionName = typeof message.sessionName === "string" ? message.sessionName : replActiveSessionName;
        const output = cleanReplCapturedOutput(String(message.output || ""), { code, runtime });
        const details = {
          requestId,
          sessionName,
          runtime,
          label: typeof message.label === "string" && message.label.trim() ? message.label.trim() : "Pi",
          mode: "agent",
          code,
          output,
          status: output.trim() ? "captured" : (message.timedOut ? "timeout" : "sent"),
        };
        activeReplJournalEntryId = "";
        if (requestId) {
          const existingIndex = replJournalEntries.findIndex((entry) => entry.requestId === requestId);
          if (existingIndex >= 0) {
            replJournalEntries = replJournalEntries.map((entry) => entry.requestId === requestId ? { ...entry, ...details, updatedAt: Date.now() } : entry);
            persistReplJournalEntries();
            return true;
          }
        }
        addReplJournalEntry(details);
        return true;
      }

      function extractReplTranscriptDelta(before, after) {
        const previous = String(before || "");
        const current = String(after || "");
        if (!current) return "";
        if (!previous) return current;
        const directIndex = current.indexOf(previous);
        if (directIndex >= 0) return current.slice(directIndex + previous.length).replace(/^\s+/, "");
        const previousLines = previous.split("\n");
        const maxSuffixLines = Math.min(24, previousLines.length);
        for (let count = maxSuffixLines; count >= 1; count -= 1) {
          const suffix = previousLines.slice(previousLines.length - count).join("\n");
          if (!suffix.trim()) continue;
          const suffixIndex = current.indexOf(suffix);
          if (suffixIndex >= 0) return current.slice(suffixIndex + suffix.length).replace(/^\s+/, "");
        }
        return current;
      }

      function stripSubmittedCodeEchoFromReplDelta(delta, entry) {
        const value = String(delta || "").replace(/^\s+/, "");
        const code = String(entry && entry.code ? entry.code : "").trim();
        if (!value || !code) return value;
        const firstCodeLine = code.split("\n").map((line) => line.trim()).find(Boolean) || "";
        const lines = value.split("\n");
        if (!lines.length) return value;
        const promptlessFirst = lines[0].replace(/^\s*(?:>>>|\.\.\.|In \[\d+\]:|julia>|>|\+|ghci>|Prelude>|\*?[A-Za-z0-9_.:]+>|[^\s>]+=>)\s*/, "").trim();
        const isEcho = promptlessFirst === firstCodeLine
          || /^# Studio sent \d+-line snippet$/.test(promptlessFirst)
          || /^-- Studio sent \d+-line snippet$/.test(promptlessFirst)
          || /^;; Studio sent \d+-line snippet$/.test(promptlessFirst);
        return isEcho ? lines.slice(1).join("\n").replace(/^\s+/, "") : value;
      }

      function stripStudioReplSubmissionEcho(delta) {
        let value = String(delta || "").replace(/^\s+/, "");
        // The raw mirror below remains raw; REPL Studio cards hide only the
        // temp-file wrapper used to submit multiline snippets safely. The
        // pi-studio-re fragment catches IPython's wrapped pi-studio-repl paths.
        const submissionEchoPatterns = [
          /^.*exec\(open\([\s\S]*?pi-studio-re[\s\S]*?globals\(\)\)\s*$/gm,
          /^.*include\([\s\S]*?pi-studio-re[\s\S]*?\.jl"\)\s*$/gm,
          /^.*source\([\s\S]*?pi-studio-re[\s\S]*?local\s*=\s*\.GlobalEnv\)\s*$/gm,
          /^.*:script\s+[\s\S]*?pi-studio-re[\s\S]*?\.ghci"?\s*$/gm,
          /^.*\(do\s+\(load-file\s+[\s\S]*?pi-studio-re[\s\S]*?:pi-studio\/silent\)\s*$/gm,
        ];
        for (const pattern of submissionEchoPatterns) {
          value = value.replace(pattern, "");
        }
        return value.replace(/^(?:\s*\n)+/, "");
      }

      function stripTrailingReplPromptsFromOutput(output) {
        const lines = String(output || "").replace(/\r\n/g, "\n").split("\n");
        while (lines.length > 0 && /^\s*(?:>>>|\.\.\.|In \[\d+\]:|julia>|>|\+|ghci>|Prelude>|\*?[A-Za-z0-9_.:]+>|[^\s>]+=>)\s*$/.test(lines[lines.length - 1] || "")) {
          lines.pop();
        }
        return lines.join("\n").trimEnd();
      }

      function stripSubsequentReplInputsFromOutput(output) {
        const lines = String(output || "").replace(/\r\n/g, "\n").split("\n");
        const nextInputIndex = lines.findIndex((line) => /^\s*(?:>>>|In \[\d+\]:|julia>|ghci>|Prelude>|\*?[A-Za-z0-9_.:]+>|[^\s>]+=>)\s+\S/.test(line || ""));
        if (nextInputIndex <= 0) return lines.join("\n").trimEnd();
        return lines.slice(0, nextInputIndex).join("\n").trimEnd();
      }

      function cleanReplCapturedOutput(delta, entry) {
        const withoutSubmissionEcho = stripStudioReplSubmissionEcho(delta);
        const withoutCodeEcho = stripSubmittedCodeEchoFromReplDelta(withoutSubmissionEcho, entry);
        const withoutLaterInputs = stripSubsequentReplInputsFromOutput(withoutCodeEcho);
        return trimReplJournalOutput(stripTrailingReplPromptsFromOutput(withoutLaterInputs));
      }

      function updateActiveReplJournalEntryFromTranscript(sessionName, transcript) {
        if (!activeReplJournalEntryId) return false;
        const entryIndex = replJournalEntries.findIndex((entry) => entry.id === activeReplJournalEntryId);
        if (entryIndex < 0) return false;
        const entry = replJournalEntries[entryIndex];
        if (entry.sessionName && sessionName && entry.sessionName !== sessionName) return false;
        const delta = cleanReplCapturedOutput(extractReplTranscriptDelta(entry.beforeTranscript, transcript), entry);
        if (!delta.trim()) return false;
        if (entry.output === delta && entry.status === "captured") return false;
        replJournalEntries = replJournalEntries.map((candidate) => candidate.id === entry.id
          ? { ...candidate, output: delta, status: "captured", updatedAt: Date.now() }
          : candidate);
        persistReplJournalEntries();
        return true;
      }

      function getMarkdownFenceForText(text, language) {
        const value = String(text || "");
        let fence = "```";
        while (value.includes(fence)) fence += "`";
        return fence + (language ? language : "") + "\n" + value.replace(/\s+$/, "") + "\n" + fence;
      }

      function buildReplJournalMarkdown(entries) {
        const visibleEntries = Array.isArray(entries) ? entries : getVisibleReplJournalEntries();
        const sessionName = getActiveReplJournalSessionName();
        const lines = ["# REPL Studio", "", "Generated: " + new Date().toLocaleString()];
        if (sessionName) lines.push("Session: `" + sessionName + "`");
        lines.push("");
        if (!visibleEntries.length) {
          lines.push(sessionName ? ("_No REPL Studio entries for `" + sessionName + "` yet._") : "_No REPL Studio entries yet._");
          return lines.join("\n");
        }
        visibleEntries.forEach((entry, index) => {
          lines.push("## " + (index + 1) + ". " + (entry.label || "REPL entry"));
          lines.push("");
          lines.push("- Time: " + new Date(entry.createdAt || Date.now()).toLocaleString());
          if (entry.runtime) lines.push("- Runtime: " + entry.runtime);
          if (entry.sessionName) lines.push("- Session: `" + entry.sessionName + "`");
          if (entry.skippedChunks) lines.push("- Skipped chunks: " + entry.skippedChunks);
          lines.push("");
          if (String(entry.prose || "").trim()) {
            lines.push(String(entry.prose).trim());
            lines.push("");
          }
          if (String(entry.code || "").trim()) {
            lines.push(getMarkdownFenceForText(entry.code, entry.runtime === "ipython" ? "python" : entry.runtime));
            lines.push("");
          }
          if (String(entry.output || "").trim()) {
            lines.push("Output:");
            lines.push("");
            lines.push(getMarkdownFenceForText(entry.output, "text"));
            lines.push("");
          }
        });
        return lines.join("\n").replace(/\n{4,}/g, "\n\n\n").trimEnd() + "\n";
      }

      async function copyReplJournalToClipboard() {
        const entries = getVisibleReplJournalEntries();
        if (!entries.length) {
          setStatus("No REPL Studio entries to copy for this session yet.", "warning");
          return;
        }
        if (await writeTextToClipboard(buildReplJournalMarkdown(entries))) {
          setStatus("Copied REPL Studio session as Markdown.", "success");
        } else {
          setStatus("Clipboard write failed.", "warning");
        }
      }

      function exportReplJournalMarkdown() {
        const entries = getVisibleReplJournalEntries();
        if (!entries.length) {
          setStatus("No REPL Studio entries to export for this session yet.", "warning");
          return;
        }
        const blob = new Blob([buildReplJournalMarkdown(entries)], { type: "text/markdown;charset=utf-8" });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const sessionSlug = getActiveReplJournalSessionName().replace(/[^-_.A-Za-z0-9]+/g, "-");
        link.href = blobUrl;
        link.download = "repl-studio" + (sessionSlug ? "-" + sessionSlug : "") + "-" + stamp + ".md";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        setStatus("Exported REPL Studio session Markdown.", "success");
      }

      function clearReplJournal() {
        const sessionName = getActiveReplJournalSessionName();
        if (sessionName) {
          replJournalEntries = replJournalEntries.filter((entry) => entry.sessionName !== sessionName);
        } else {
          replJournalEntries = [];
        }
        activeReplJournalEntryId = "";
        persistReplJournalEntries();
        setStatus(sessionName ? "Cleared REPL Studio for this session." : "Cleared REPL Studio.", "success");
        renderReplViewIfActive({ force: true });
      }

      function loadReplJournalIntoEditor() {
        const entries = getVisibleReplJournalEntries();
        if (!entries.length) {
          setStatus("No REPL Studio entries to load for this session yet.", "warning");
          return;
        }
        const markdown = buildReplJournalMarkdown(entries);
        setEditorText(markdown, { preserveScroll: false, preserveSelection: false });
        setSourceState({ source: "blank", label: "REPL Studio", path: null });
        setEditorLanguage("markdown");
        setStatus("Loaded REPL Studio session into editor.", "success");
      }

      function addSelectedReplJournalNote() {
        const note = getSelectedOrCurrentParagraphForReplNote();
        if (!note.trim()) {
          setStatus("Select prose or place the cursor in a paragraph to add a REPL Studio note.", "warning");
          return;
        }
        addReplJournalEntry({
          label: "note",
          prose: note,
          status: "note",
          mode: "literate",
          sessionName: replActiveSessionName,
          runtime: getActiveReplRuntime(),
        });
        setStatus("Added note to REPL Studio.", "success");
        renderReplViewIfActive({ force: true });
      }

      function sendReplPayload(payload) {
        const session = getActiveReplSession();
        if (!session) {
          setStatus("Start or select a REPL session first.", "warning");
          return;
        }
        if (!payload || payload.error) {
          setStatus(payload && payload.error ? payload.error : "Nothing to send to REPL.", "warning");
          return;
        }
        if (payload.noteOnly) {
          if (String(payload.prose || "").trim()) {
            addReplJournalEntry({
              label: payload.label || "note",
              prose: payload.prose,
              status: "note",
              mode: payload.mode || "literate",
              sessionName: session.sessionName,
              runtime: getActiveReplRuntime(),
              skippedChunks: payload.skippedChunks,
            });
            setStatus("Added prose to REPL Studio.", "success");
            renderReplViewIfActive({ force: true });
          } else {
            setStatus("No code or prose found to send.", "warning");
          }
          return;
        }
        const text = String(payload.text || "");
        if (!text.trim()) {
          setStatus("Editor text is empty.", "warning");
          return;
        }
        const requestId = makeRequestId();
        const journalEntry = addReplJournalEntry({
          requestId,
          sessionName: session.sessionName,
          runtime: getActiveReplRuntime(),
          label: payload.label,
          mode: payload.mode,
          prose: payload.prose,
          code: text,
          beforeTranscript: replTranscript,
          status: "sending",
          skippedChunks: payload.skippedChunks,
        });
        activeReplJournalEntryId = journalEntry.id;
        replBusy = true;
        syncActionButtons();
        renderReplViewIfActive({ force: true });
        const skippedSuffix = payload.skippedChunks ? " (skipped " + payload.skippedChunks + " incompatible chunk" + (payload.skippedChunks === 1 ? "" : "s") + ")" : "";
        setStatus("Sending " + (payload.label || "editor text") + " to REPL…" + skippedSuffix, "info");
        if (!sendMessage({ type: "repl_send_request", requestId, sessionName: session.sessionName, text })) {
          replBusy = false;
          replJournalEntries = replJournalEntries.map((entry) => entry.id === journalEntry.id ? { ...entry, status: "error" } : entry);
          persistReplJournalEntries();
          syncActionButtons();
        }
      }

      function sendEditorTextToRepl(options) {
        const action = options && options.action ? options.action : "default";
        if (action === "all-chunks") {
          sendReplPayload(buildAllChunksReplSendPayload());
          return;
        }
        if (action === "note") {
          addSelectedReplJournalNote();
          return;
        }
        sendReplPayload(replSendMode === "literate" ? buildLiterateReplSendPayload() : buildRawReplSendPayload());
      }

      function renderTraceViewIfActive() {
        if (rightView !== "trace") return;
        if (traceRenderRaf !== null) return;
        traceRenderRaf = window.requestAnimationFrame(() => {
          traceRenderRaf = null;
          refreshResponseUi();
        });
      }

      contextTokens = parseFiniteNumber(document.body && document.body.dataset ? document.body.dataset.contextTokens : null);
      contextWindow = parseFiniteNumber(document.body && document.body.dataset ? document.body.dataset.contextWindow : null);
      contextPercent = parseFiniteNumber(document.body && document.body.dataset ? document.body.dataset.contextPercent : null);

      let sourceState = {
        source: initialSourceState.source,
        label: initialSourceState.label,
        path: initialSourceState.path,
        draftId: initialSourceState.draftId,
      };
      let fileBackedBaselineText = null;
      let activePane = "left";
      let paneFocusTarget = "off";
      const EDITOR_HIGHLIGHT_MAX_CHARS = 100_000;
      const EDITOR_HIGHLIGHT_STORAGE_KEY = "piStudio.editorHighlightEnabled";
      const EDITOR_LANGUAGE_STORAGE_KEY = "piStudio.editorLanguage";
      const EDITOR_LINE_NUMBERS_STORAGE_KEY = "piStudio.editorLineNumbersEnabled";
      const EDITOR_FONT_SIZE_STORAGE_KEY = "piStudio.editorFontSize";
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
      const RESPONSE_FONT_SIZE_STORAGE_KEY = "piStudio.responseFontSize";
      const ANNOTATION_MODE_STORAGE_KEY = "piStudio.annotationsEnabled";
      const PREVIEW_INPUT_DEBOUNCE_MS = 0;
      const PREVIEW_PENDING_BADGE_DELAY_MS = 220;
      const previewPendingTimers = new WeakMap();
      const htmlArtifactFramesById = new Map();
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
      let lineNumbersEnabled = false;
      let lineNumbersRenderRaf = null;
      let annotationsEnabled = true;
      const STUDIO_ZEN_MODE_STORAGE_KEY = "piStudio.zenMode";
      const studioUiRefreshEnabled = readStudioUiRefreshEnabled();
      const EDITOR_FONT_SIZE_OPTIONS = [10, 11, 12, 13, 14, 15, 16, 18];
      const RESPONSE_FONT_SIZE_OPTIONS = [11, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5, 16, 18, 20];
      const DEFAULT_EDITOR_FONT_SIZE = studioUiRefreshEnabled ? 12 : 13;
      const DEFAULT_RESPONSE_FONT_SIZE = studioUiRefreshEnabled ? 13.5 : 15;
      let editorFontSize = DEFAULT_EDITOR_FONT_SIZE;
      let responseFontSize = DEFAULT_RESPONSE_FONT_SIZE;
      let studioUiRefreshUi = null;
      let studioZenModeEnabled = readStudioZenModeEnabled();
      if (studioUiRefreshEnabled && document.body) {
        document.body.classList.add("studio-ui-refresh");
      }
      if (studioZenModeEnabled && document.body) {
        document.body.classList.add("studio-zen-mode");
      }
      let scratchpadText = "";
      let scratchpadReturnFocusEl = null;
      let scratchpadPersistTimer = null;
      let scratchpadLoadNonce = 0;
      let reviewNotes = [];
      let reviewNotesReturnFocusEl = null;
      let reviewNotesPersistTimer = null;
      let reviewNotesLoadNonce = 0;
      let outlineEntries = [];
      let outlineReturnFocusEl = null;
      let pendingReviewNoteFocusId = null;
      let pendingReviewNoteInlineFocusId = null;
      let activePreviewCommentSelection = null;
      let suppressEditorSelectionComment = false;
      let suppressedEditorSelectionStart = null;
      let suppressedEditorSelectionEnd = null;
      const previewJumpHighlightState = new WeakMap();
      const PREVIEW_ANNOTATION_PLACEHOLDER_PREFIX = "PISTUDIOANNOT";

      function readStudioUiRefreshEnabled() {
        const normalize = (value) => String(value == null ? "" : value).trim().toLowerCase();
        const queryValue = initialQueryParams.has("uiRefresh")
          ? initialQueryParams.get("uiRefresh")
          : (initialQueryParams.has("studioUiRefresh") ? initialQueryParams.get("studioUiRefresh") : null);
        const isTruthy = (value) => ["1", "true", "yes", "on", "v2", "refresh", "fresh"].indexOf(normalize(value)) !== -1;
        const isFalsey = (value) => ["0", "false", "no", "off", "classic"].indexOf(normalize(value)) !== -1;
        if (queryValue !== null) {
          const normalizedQuery = normalize(queryValue);
          return isTruthy(queryValue) || (!isFalsey(queryValue) && normalizedQuery !== "");
        }
        return true;
      }

      function readStudioZenModeEnabled() {
        const normalize = (value) => String(value == null ? "" : value).trim().toLowerCase();
        const isTruthy = (value) => ["1", "true", "yes", "on", "zen"].indexOf(normalize(value)) !== -1;
        const isFalsey = (value) => ["0", "false", "no", "off"].indexOf(normalize(value)) !== -1;
        const queryValue = initialQueryParams.has("zen") ? initialQueryParams.get("zen") : null;
        if (queryValue !== null) {
          const normalizedQuery = normalize(queryValue);
          const enabled = isTruthy(queryValue) || (!isFalsey(queryValue) && normalizedQuery !== "");
          try {
            window.localStorage && window.localStorage.setItem(STUDIO_ZEN_MODE_STORAGE_KEY, enabled ? "1" : "0");
          } catch {}
          return enabled;
        }
        try {
          const stored = window.localStorage ? window.localStorage.getItem(STUDIO_ZEN_MODE_STORAGE_KEY) : null;
          if (stored === null) return false;
          return isTruthy(stored) || (!isFalsey(stored) && normalize(stored) !== "");
        } catch {
          return false;
        }
      }

      function syncStudioZenModeUi() {
        if (document.body) document.body.classList.toggle("studio-zen-mode", studioZenModeEnabled);
        if (!zenModeBtn) return;
        zenModeBtn.textContent = studioZenModeEnabled ? "Exit Zen" : "Zen";
        zenModeBtn.title = studioZenModeEnabled ? "Show full Studio controls." : "Hide secondary Studio controls.";
        zenModeBtn.setAttribute("aria-pressed", studioZenModeEnabled ? "true" : "false");
      }

      function setStudioZenMode(enabled) {
        studioZenModeEnabled = Boolean(enabled);
        try {
          window.localStorage && window.localStorage.setItem(STUDIO_ZEN_MODE_STORAGE_KEY, studioZenModeEnabled ? "1" : "0");
        } catch {}
        closeStudioUiRefreshMenus();
        closeExportPreviewMenu();
        syncStudioZenModeUi();
      }

      function makeStudioUiRefreshElement(tagName, className, text) {
        const element = document.createElement(tagName);
        if (className) element.className = className;
        if (typeof text === "string") element.textContent = text;
        return element;
      }

      function makeStudioUiRefreshSeparator() {
        return makeStudioUiRefreshElement("span", "studio-refresh-sep");
      }

      function makeStudioUiRefreshIcon(kind) {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("aria-hidden", "true");
        svg.classList.add("studio-refresh-icon");
        let paths;
        if (kind === "focus-exit") {
          paths = ["M4 4l6 6", "M10 4v6H4", "M20 20l-6-6", "M14 20v-6h6"];
        } else if (kind === "fullscreen") {
          paths = ["M8 4H4v4", "M16 4h4v4", "M20 16v4h-4", "M4 16v4h4"];
        } else if (kind === "fullscreen-exit") {
          paths = ["M9 5v4H5", "M15 5v4h4", "M19 15h-4v4", "M5 15h4v4"];
        } else {
          paths = ["M14 4h6v6", "M20 4l-6 6", "M10 20H4v-6", "M4 20l6-6"];
        }
        for (const d of paths) {
          const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
          path.setAttribute("d", d);
          svg.appendChild(path);
        }
        return svg;
      }

      function setStudioUiRefreshFocusButtonIcon(buttonEl, isFocusedPane) {
        if (!buttonEl || !studioUiRefreshEnabled) return;
        buttonEl.replaceChildren(makeStudioUiRefreshIcon(isFocusedPane ? "focus-exit" : "focus"));
        buttonEl.setAttribute("aria-label", isFocusedPane ? "Exit focus" : "Focus pane");
      }

      function appendStudioUiRefreshMenuSection(menuEl, heading, controls) {
        const sectionEl = makeStudioUiRefreshElement("div", "studio-refresh-menu-section");
        if (heading) {
          sectionEl.appendChild(makeStudioUiRefreshElement("div", "studio-refresh-menu-heading", heading));
        }
        for (const control of controls) {
          if (!control) continue;
          const itemEl = makeStudioUiRefreshElement("div", "studio-refresh-menu-item");
          itemEl.appendChild(control);
          sectionEl.appendChild(itemEl);
        }
        menuEl.appendChild(sectionEl);
      }

      function getStudioUiRefreshSelectSummary(selectEl, prefix) {
        if (!selectEl) return "";
        const option = selectEl.options && selectEl.selectedIndex >= 0 ? selectEl.options[selectEl.selectedIndex] : null;
        let label = option ? String(option.textContent || option.label || option.value || "") : String(selectEl.value || "");
        if (prefix) label = label.replace(new RegExp("^" + prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*:?\\s*", "i"), "");
        return label.trim();
      }

      function setStudioUiRefreshButtonText(buttonEl, text) {
        if (!buttonEl) return;
        buttonEl.textContent = text;
      }

      function formatStudioFontSizeLabel(size) {
        const value = Number(size);
        if (!Number.isFinite(value)) return "";
        return String(value).replace(/\.0$/, "") + "px";
      }

      function normalizeStudioFontSize(value, options, fallback) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return fallback;
        for (const option of options) {
          if (Math.abs(option - parsed) < 0.001) return option;
        }
        return fallback;
      }

      function readStoredFontSize(storageKey, options, fallback) {
        try {
          if (!window.localStorage) return fallback;
          return normalizeStudioFontSize(window.localStorage.getItem(storageKey), options, fallback);
        } catch {
          return fallback;
        }
      }

      function persistStoredFontSize(storageKey, size) {
        try {
          if (window.localStorage) window.localStorage.setItem(storageKey, String(size));
        } catch {
          // ignore storage failures
        }
      }

      function syncFontSizeSelect(selectEl, size) {
        if (!selectEl) return;
        selectEl.value = String(size);
      }

      function applyStudioFontSizeVariables() {
        if (!document.body || !document.body.style) return;
        const editorLineNumberSize = Math.max(10, editorFontSize - 1);
        const responseRawSize = Math.max(11, responseFontSize - 1.5);
        document.body.style.setProperty("--studio-editor-font-size", formatStudioFontSizeLabel(editorFontSize));
        document.body.style.setProperty("--studio-editor-line-number-font-size", formatStudioFontSizeLabel(editorLineNumberSize));
        document.body.style.setProperty("--studio-response-font-size", formatStudioFontSizeLabel(responseFontSize));
        document.body.style.setProperty("--studio-response-raw-font-size", formatStudioFontSizeLabel(responseRawSize));
        document.body.style.setProperty("--studio-working-font-size", formatStudioFontSizeLabel(responseRawSize));
      }

      function setEditorFontSize(size, options) {
        editorFontSize = normalizeStudioFontSize(size, EDITOR_FONT_SIZE_OPTIONS, DEFAULT_EDITOR_FONT_SIZE);
        if (!options || options.persist !== false) persistStoredFontSize(EDITOR_FONT_SIZE_STORAGE_KEY, editorFontSize);
        syncFontSizeSelect(editorFontSizeSelect, editorFontSize);
        applyStudioFontSizeVariables();
        syncStudioUiRefreshSummaries();
        scheduleEditorLineNumberRender();
        if (editorHighlightEnabled && editorView === "markdown") {
          scheduleEditorHighlightRender();
        }
      }

      function setResponseFontSize(size, options) {
        responseFontSize = normalizeStudioFontSize(size, RESPONSE_FONT_SIZE_OPTIONS, DEFAULT_RESPONSE_FONT_SIZE);
        if (!options || options.persist !== false) persistStoredFontSize(RESPONSE_FONT_SIZE_STORAGE_KEY, responseFontSize);
        syncFontSizeSelect(responseFontSizeSelect, responseFontSize);
        applyStudioFontSizeVariables();
        scheduleResponsePaneRepaintNudge();
      }

      function getStudioUiRefreshAnnotationHeaderEnabled() {
        try {
          return Boolean(stripAnnotationHeader(sourceTextEl.value).hadHeader);
        } catch {
          return false;
        }
      }

      function syncStudioUiRefreshSummaries() {
        if (!studioUiRefreshUi) return;
        if (studioUiRefreshUi.annotationsButton) {
          const inlineLabel = annotationsEnabled ? "Inline on" : "Inline hidden";
          if (isEditorOnlyMode) {
            setStudioUiRefreshButtonText(studioUiRefreshUi.annotationsButton, "Annotations: " + inlineLabel);
          } else {
            const headerLabel = getStudioUiRefreshAnnotationHeaderEnabled() ? "Header on" : "Header off";
            setStudioUiRefreshButtonText(studioUiRefreshUi.annotationsButton, "Annotations: " + inlineLabel + " · " + headerLabel);
          }
        }
        if (studioUiRefreshUi.viewButton) {
          const syntaxLabel = editorHighlightEnabled
            ? (getStudioUiRefreshSelectSummary(highlightSelect, "Syntax highlight") || editorLanguage || "Markdown")
            : "Off";
          const lineLabel = lineNumbersEnabled ? "Lines on" : "Lines off";
          const editorSizeLabel = formatStudioFontSizeLabel(editorFontSize);
          setStudioUiRefreshButtonText(studioUiRefreshUi.viewButton, "View: " + syntaxLabel + " · " + lineLabel + " · " + editorSizeLabel);
        }
        syncStudioUiRefreshReviewTrigger();
      }

      function closeStudioUiRefreshMenus() {
        if (!studioUiRefreshUi || !studioUiRefreshUi.menus) return;
        for (const item of studioUiRefreshUi.menus) {
          item.menu.hidden = true;
          item.button.classList.remove("is-open");
          item.button.setAttribute("aria-expanded", "false");
        }
      }

      function toggleStudioUiRefreshMenu(name) {
        if (!studioUiRefreshUi || !studioUiRefreshUi.menus) return;
        let willOpen = false;
        for (const item of studioUiRefreshUi.menus) {
          if (item.name === name) willOpen = item.menu.hidden;
        }
        for (const item of studioUiRefreshUi.menus) {
          const isOpen = willOpen && item.name === name;
          item.menu.hidden = !isOpen;
          item.button.classList.toggle("is-open", isOpen);
          item.button.setAttribute("aria-expanded", isOpen ? "true" : "false");
        }
      }

      function syncStudioUiRefreshReviewTrigger() {
        if (!studioUiRefreshUi || !studioUiRefreshUi.reviewButton) return;
        const critiqueIsStop = getAbortablePendingKind() === "critique";
        const reviewButton = studioUiRefreshUi.reviewButton;
        reviewButton.textContent = critiqueIsStop ? "Stop critique" : "Review";
        reviewButton.classList.toggle("request-stop-active", critiqueIsStop);
        reviewButton.disabled = critiqueIsStop ? Boolean(critiqueBtn && critiqueBtn.disabled) : false;
        reviewButton.title = critiqueIsStop
          ? "Stop the running critique request. Shortcut: Esc."
          : "Open review actions and settings.";
        if (critiqueIsStop) {
          closeStudioUiRefreshMenus();
        }
      }

      function makeStudioUiRefreshMenu(buttonEl, name, menuClassName) {
        const anchorEl = makeStudioUiRefreshElement("span", "studio-refresh-menu-anchor " + (menuClassName || ""));
        const menuEl = makeStudioUiRefreshElement("div", "studio-refresh-menu");
        menuEl.hidden = true;
        buttonEl.type = "button";
        buttonEl.classList.add("studio-refresh-chip");
        buttonEl.setAttribute("aria-haspopup", "menu");
        buttonEl.setAttribute("aria-expanded", "false");
        buttonEl.addEventListener("click", (event) => {
          event.stopPropagation();
          if (name === "review" && getAbortablePendingKind() === "critique") {
            requestCancelForPendingRequest("critique");
            return;
          }
          toggleStudioUiRefreshMenu(name);
        });
        anchorEl.appendChild(buttonEl);
        anchorEl.appendChild(menuEl);
        return { name, anchor: anchorEl, button: buttonEl, menu: menuEl };
      }

      function setupStudioUiRefreshPrototype() {
        if (!studioUiRefreshEnabled || studioUiRefreshUi) return;
        const leftHeaderEl = document.getElementById("leftSectionHeader");
        const sourceMetaEl = leftPaneEl ? leftPaneEl.querySelector(".source-meta") : null;
        if (!leftHeaderEl || !sourceMetaEl || !copyDraftBtn) return;

        let reviewMenu = null;
        if (!isEditorOnlyMode && critiqueBtn && lensSelect) {
          const reviewButton = makeStudioUiRefreshElement("button", "studio-refresh-tool-tab studio-refresh-review-btn", "Review");
          reviewMenu = makeStudioUiRefreshMenu(reviewButton, "review", "studio-refresh-review-anchor");
          appendStudioUiRefreshMenuSection(reviewMenu.menu, "Action", [critiqueBtn, quizBtn]);
          appendStudioUiRefreshMenuSection(reviewMenu.menu, "Setting", [lensSelect]);
        }

        const headerTopEl = makeStudioUiRefreshElement("div", "studio-refresh-header-top");
        const titleGroupEl = makeStudioUiRefreshElement("div", "studio-refresh-title-group");
        if (leftFocusBtn) {
          setStudioUiRefreshFocusButtonIcon(leftFocusBtn, false);
          titleGroupEl.appendChild(leftFocusBtn);
        }
        titleGroupEl.appendChild(makeStudioUiRefreshSeparator());
        if (isEditorOnlyMode) {
          titleGroupEl.appendChild(makeStudioUiRefreshElement("span", "studio-refresh-static-title", "Editor (Raw)"));
        } else if (editorViewSelect) {
          titleGroupEl.appendChild(editorViewSelect);
        }
        headerTopEl.appendChild(titleGroupEl);
        const headerToolsEl = makeStudioUiRefreshElement("div", "studio-refresh-pane-tools");
        if (reviewNotesBtn) headerToolsEl.appendChild(reviewNotesBtn);
        if (outlineBtn) headerToolsEl.appendChild(outlineBtn);
        if (scratchpadBtn) headerToolsEl.appendChild(scratchpadBtn);
        if (reviewMenu) headerToolsEl.appendChild(reviewMenu.anchor);
        headerTopEl.appendChild(headerToolsEl);

        const headerUtilityEl = makeStudioUiRefreshElement("div", "studio-refresh-header-utility");
        const utilityLeftEl = makeStudioUiRefreshElement("div", "studio-refresh-utility-left");
        if (sourceBadgeEl) utilityLeftEl.appendChild(sourceBadgeEl);
        if (sourceBadgeEl && (resourceDirBtn || resourceDirLabel || resourceDirInputWrap || syncBadgeEl)) {
          utilityLeftEl.appendChild(makeStudioUiRefreshSeparator());
        }
        if (resourceDirBtn) utilityLeftEl.appendChild(resourceDirBtn);
        if (resourceDirLabel) utilityLeftEl.appendChild(resourceDirLabel);
        if (resourceDirInputWrap) utilityLeftEl.appendChild(resourceDirInputWrap);
        if (syncBadgeEl) utilityLeftEl.appendChild(syncBadgeEl);
        headerUtilityEl.appendChild(utilityLeftEl);
        leftHeaderEl.replaceChildren(headerTopEl, headerUtilityEl);

        const rightHeaderEl = document.getElementById("rightSectionHeader");
        if (rightHeaderEl && rightViewSelect) {
          const rightIdentityEl = makeStudioUiRefreshElement("div", "studio-refresh-pane-identity studio-refresh-pane-identity-right");
          const rightTitleGroupEl = makeStudioUiRefreshElement("div", "studio-refresh-title-group");
          if (rightFocusBtn) {
            setStudioUiRefreshFocusButtonIcon(rightFocusBtn, false);
            rightTitleGroupEl.appendChild(rightFocusBtn);
            rightTitleGroupEl.appendChild(makeStudioUiRefreshSeparator());
          }
          if (isEditorOnlyMode) {
            rightTitleGroupEl.appendChild(makeStudioUiRefreshElement("span", "studio-refresh-static-title", "Editor (Preview)"));
          } else {
            rightTitleGroupEl.appendChild(rightViewSelect);
          }
          rightIdentityEl.appendChild(rightTitleGroupEl);
          const rightToolsEl = makeStudioUiRefreshElement("div", "studio-refresh-pane-tools");
          if (exportPreviewControlsEl) {
            rightToolsEl.appendChild(exportPreviewControlsEl);
          } else if (exportPdfBtn) {
            rightToolsEl.appendChild(exportPdfBtn);
          }
          rightHeaderEl.replaceChildren(rightIdentityEl, rightToolsEl);
        }

        const toolbarEl = makeStudioUiRefreshElement("div", "studio-refresh-toolbar");
        const toolbarMainEl = makeStudioUiRefreshElement("div", "studio-refresh-toolbar-main");
        const actionsEl = makeStudioUiRefreshElement("div", "studio-refresh-toolbar-actions");
        const actionLineOneEl = makeStudioUiRefreshElement("div", "studio-refresh-action-line");
        if (!isEditorOnlyMode && sendRunBtn) actionLineOneEl.appendChild(sendRunBtn);
        if (!isEditorOnlyMode && queueSteerBtn) actionLineOneEl.appendChild(queueSteerBtn);
        const replActionLineEl = makeStudioUiRefreshElement("div", "studio-refresh-action-line repl-action-line");
        replActionLineEl.hidden = true;
        if (!isEditorOnlyMode && sendReplBtn) replActionLineEl.appendChild(sendReplBtn);
        if (!isEditorOnlyMode && replSendModeSelect) replActionLineEl.appendChild(replSendModeSelect);
        const actionLineTwoEl = makeStudioUiRefreshElement("div", "studio-refresh-action-line");
        actionLineTwoEl.appendChild(copyDraftBtn);
        if (openCompanionBtn) actionLineTwoEl.appendChild(openCompanionBtn);
        if (!isEditorOnlyMode && sendEditorBtn) actionLineTwoEl.appendChild(sendEditorBtn);
        if (actionLineOneEl.childNodes.length > 0) actionsEl.appendChild(actionLineOneEl);
        if (replActionLineEl.childNodes.length > 0) actionsEl.appendChild(replActionLineEl);
        actionsEl.appendChild(actionLineTwoEl);

        const stateEl = makeStudioUiRefreshElement("div", "studio-refresh-toolbar-state");
        const annotationsButton = makeStudioUiRefreshElement("button", "", "Annotations");
        const annotationsMenu = makeStudioUiRefreshMenu(annotationsButton, "annotations", "studio-refresh-annotations-anchor");
        appendStudioUiRefreshMenuSection(annotationsMenu.menu, "Display", isEditorOnlyMode ? [annotationModeSelect] : [annotationModeSelect, insertHeaderBtn]);
        appendStudioUiRefreshMenuSection(annotationsMenu.menu, "Actions", [stripAnnotationsBtn, saveAnnotatedBtn]);
        const viewButton = makeStudioUiRefreshElement("button", "", "View");
        const viewMenu = makeStudioUiRefreshMenu(viewButton, "view", "studio-refresh-view-anchor");
        appendStudioUiRefreshMenuSection(viewMenu.menu, "Display", [highlightSelect, lineNumbersSelect, editorFontSizeSelect]);
        stateEl.appendChild(annotationsMenu.anchor);
        stateEl.appendChild(viewMenu.anchor);

        toolbarMainEl.appendChild(actionsEl);
        toolbarMainEl.appendChild(stateEl);
        toolbarEl.appendChild(toolbarMainEl);
        sourceMetaEl.replaceChildren(toolbarEl);

        studioUiRefreshUi = {
          annotationsButton,
          viewButton,
          reviewButton: reviewMenu ? reviewMenu.button : null,
          menus: [annotationsMenu, viewMenu].concat(reviewMenu ? [reviewMenu] : []),
        };

        document.addEventListener("click", (event) => {
          const target = event.target;
          if (target instanceof Element && target.closest(".studio-refresh-menu-anchor")) return;
          closeStudioUiRefreshMenus();
        });
        document.addEventListener("keydown", (event) => {
          if (event.key === "Escape") closeStudioUiRefreshMenus();
        });
        toolbarEl.addEventListener("change", () => {
          window.setTimeout(syncStudioUiRefreshSummaries, 0);
        });
        toolbarEl.addEventListener("click", (event) => {
          const target = event.target;
          if (target instanceof Element && target.closest(".studio-refresh-menu")) {
            window.setTimeout(syncStudioUiRefreshSummaries, 0);
          }
        });
        syncStudioUiRefreshSummaries();
      }

      setupStudioUiRefreshPrototype();
      syncStudioZenModeUi();
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
        if (message.traceState && typeof message.traceState === "object" && Array.isArray(message.traceState.entries)) {
          summary.traceEntries = message.traceState.entries.length;
          summary.traceStatus = message.traceState.status;
        }
        if (message.trace && typeof message.trace === "object" && Array.isArray(message.trace.entries)) {
          summary.traceEntries = message.trace.entries.length;
          summary.traceStatus = message.trace.status;
        }
        if (typeof message.entryId === "string") summary.entryId = message.entryId;
        if (typeof message.deltaKind === "string") summary.deltaKind = message.deltaKind;
        if (typeof message.delta === "string") summary.deltaLength = message.delta.length;
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
        if (kind === "open_editor_only") return "opening companion editor";
        if (kind === "refresh_from_disk") return "refreshing from disk";
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

      function formatCompactNumber(value) {
        if (typeof value !== "number" || !Number.isFinite(value)) return "?";
        const sign = value < 0 ? "-" : "";
        const abs = Math.abs(value);
        if (abs < 1000) return sign + formatNumber(abs);
        const units = [
          { divisor: 1_000_000_000, suffix: "B" },
          { divisor: 1_000_000, suffix: "M" },
          { divisor: 1_000, suffix: "k" },
        ];
        const unit = units.find((entry) => abs >= entry.divisor) || units[units.length - 1];
        const scaled = abs / unit.divisor;
        const decimals = scaled >= 100 ? 0 : 1;
        return sign + scaled.toFixed(decimals).replace(/\.0$/, "") + unit.suffix;
      }

      function formatContextUsageText(compact) {
        const formatContextNumber = compact ? formatCompactNumber : formatNumber;
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
          return "Context: ? / " + formatContextNumber(contextWindow);
        }

        let text = "Context: " + formatContextNumber(contextTokens);
        if (hasWindow) {
          text += " / " + formatContextNumber(contextWindow);
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

      function truncateTitleSegment(text, maxLength) {
        const normalized = normalizeActivityLabel(text);
        if (!normalized) return "";
        if (!Number.isFinite(maxLength) || maxLength <= 1 || normalized.length <= maxLength) {
          return normalized;
        }
        return normalized.slice(0, maxLength - 1).trimEnd() + "…";
      }

      function readThemeColor(variableName, fallback) {
        try {
          const value = window.getComputedStyle(document.documentElement).getPropertyValue(variableName);
          const trimmed = typeof value === "string" ? value.trim() : "";
          return trimmed || fallback;
        } catch {
          return fallback;
        }
      }

      function getTitleActionMessage(kind) {
        if (kind === "annotation") return "Replying…";
        if (kind === "critique") return "Critiquing…";
        if (kind === "direct") return "Running…";
        if (kind === "compact") return "Compacting…";
        if (kind === "send_to_editor") return "Sending to editor…";
        if (kind === "get_from_editor") return "Loading from editor…";
        if (kind === "load_git_diff") return "Loading git diff…";
        if (kind === "refresh_from_disk") return "Refreshing from disk…";
        if (kind === "save_as" || kind === "save_over") return "Saving…";
        return "Working…";
      }

      function getTitleBusyMessage() {
        const activeKind = pendingKind || (agentBusyFromServer ? stickyStudioKind : null);
        const hasStudioOwnedBusyState = uiBusy
          || Boolean(pendingRequestId)
          || Boolean(pendingKind)
          || compactInProgress
          || Boolean(agentBusyFromServer && stickyStudioKind)
          || Boolean(agentBusyFromServer && studioRunChainActive);

        if (!hasStudioOwnedBusyState) return "";

        if (
          pendingKind === "compact"
          || compactInProgress
          || (agentBusyFromServer && stickyStudioKind === "compact")
        ) {
          return "Compacting…";
        }

        if (terminalActivityPhase === "tool") {
          if (terminalActivityLabel && !isGenericToolLabel(terminalActivityLabel)) {
            return truncateTitleSegment(withEllipsis(terminalActivityLabel), 34);
          }
          if (activeKind) return getTitleActionMessage(activeKind);
          if (agentBusyFromServer && studioRunChainActive) return "Running…";
          return "Working…";
        }

        if (terminalActivityPhase === "responding") {
          if (activeKind === "critique") return "Critiquing…";
          if (activeKind === "annotation") return "Replying…";
          if (activeKind === "direct") return "Thinking…";
          return "Working…";
        }

        if (activeKind) return getTitleActionMessage(activeKind);
        if (uiBusy || (agentBusyFromServer && studioRunChainActive)) return "Running…";
        return "";
      }

      function getDynamicTitlePrefix() {
        if (titleAttentionMessage) return titleAttentionMessage;
        if (wsState === "Connecting") return reconnectAttempt > 0 ? "Reconnecting…" : "Connecting…";
        if (wsState === "Disconnected") return "Disconnected";
        return getTitleBusyMessage();
      }

      function buildStudioFaviconHref() {
        const idleColor = readThemeColor("--text", "#111111");
        const accent = readThemeColor("--accent", "#2563eb");
        const ok = readThemeColor("--ok", "#16a34a");
        const warn = readThemeColor("--warn", "#d97706");
        const error = readThemeColor("--error", "#dc2626");

        let piColor = idleColor;
        if (titleAttentionMessage) {
          piColor = ok;
        } else if (wsState === "Disconnected") {
          piColor = error;
        } else if (wsState === "Connecting") {
          piColor = accent;
        } else if (getTitleBusyMessage()) {
          piColor = warn;
        }

        const svg = [
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
          `<text x="32" y="35" text-anchor="middle" dominant-baseline="middle" font-size="50" font-weight="700" font-family="ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" fill="${piColor}">π</text>`,
          "</svg>",
        ].join("");
        return "data:image/svg+xml," + encodeURIComponent(svg);
      }

      function updateDocumentTitle() {
        const modelText = modelLabel && modelLabel.trim() ? modelLabel.trim() : "none";
        const terminalText = terminalSessionLabel && terminalSessionLabel.trim() ? terminalSessionLabel.trim() : "unknown";
        const titleParts = ["pi Studio"];
        if (terminalText && terminalText !== "unknown") titleParts.push(terminalText);
        if (modelText && modelText !== "none") titleParts.push(modelText);

        const titlePrefix = getDynamicTitlePrefix();
        if (titlePrefix) titleParts.unshift(titlePrefix);

        const nextTitle = titleParts.join(" · ");
        if (document.title !== nextTitle) {
          document.title = nextTitle;
        }

        if (faviconLinkEl) {
          const nextFaviconHref = buildStudioFaviconHref();
          if (nextFaviconHref !== lastRenderedFaviconHref) {
            faviconLinkEl.href = nextFaviconHref;
            faviconLinkEl.type = "image/svg+xml";
            lastRenderedFaviconHref = nextFaviconHref;
          }
        }
      }

      function updateFooterMeta() {
        const modelText = modelLabel && modelLabel.trim() ? modelLabel.trim() : "none";
        const terminalText = terminalSessionLabel && terminalSessionLabel.trim() ? terminalSessionLabel.trim() : "unknown";
        const terminalDetailText = terminalSessionDetail && terminalSessionDetail.trim() ? terminalSessionDetail.trim() : terminalText;
        const contextText = formatContextUsageText(true);
        const contextTitleText = formatContextUsageText(false);
        const contextDisplayText = contextText.replace(/^Context:\s*/i, "");
        const text = modelText + " · " + terminalText + " · " + contextDisplayText;
        const titleText = "Model: " + modelText + " · " + terminalDetailText + " · " + contextTitleText;
        if (footerMetaModelEl && footerMetaTerminalEl && footerMetaContextEl) {
          footerMetaModelEl.textContent = modelText;
          footerMetaTerminalEl.textContent = terminalText;
          footerMetaContextEl.textContent = contextDisplayText;
          footerMetaModelEl.title = "Model: " + modelText;
          footerMetaTerminalEl.title = terminalDetailText;
          footerMetaContextEl.title = contextTitleText;
          if (footerMetaTextEl) footerMetaTextEl.title = titleText;
          if (footerMetaEl) footerMetaEl.title = titleText;
        } else if (footerMetaTextEl) {
          footerMetaTextEl.textContent = text;
          footerMetaTextEl.title = titleText;
        } else if (footerMetaEl) {
          footerMetaEl.textContent = text;
          footerMetaEl.title = titleText;
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
          spinnerFrameIndex += 1;
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

      function markFileBackedBaseline(text) {
        fileBackedBaselineText = String(text || "");
      }

      function clearFileBackedBaseline() {
        fileBackedBaselineText = null;
      }

      function hasRefreshableFilePath() {
        return Boolean(sourceState && sourceState.path);
      }

      function editorDiffersFromFileBackedBaseline() {
        if (!hasRefreshableFilePath()) return false;
        if (fileBackedBaselineText === null) return true;
        return sourceTextEl.value !== fileBackedBaselineText;
      }

      function updateSourceBadge() {
        const label = sourceState && sourceState.label ? sourceState.label : "blank";
        sourceBadgeEl.textContent = (studioUiRefreshEnabled ? "Origin: " : "Editor origin: ") + label;
        const descriptor = getCurrentStudioDocumentDescriptor();
        if (sourceBadgeEl) {
          sourceBadgeEl.title = descriptor.fileBacked
            ? ("Editor origin: " + label + "\nClick to reset origin and detach the current editor text into a new draft. The file on disk will not be changed.")
            : ("Editor origin: " + label + "\nClick to reset origin and start a new independent draft while keeping the current text and local notes.");
        }
        // Show "Set working dir" button when not file-backed
        var isFileBacked = hasRefreshableFilePath();
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

      function resetEditorOrigin() {
        const descriptor = getCurrentStudioDocumentDescriptor();
        const message = descriptor.fileBacked
          ? ("Reset editor origin and detach the current text from\n\n" + descriptor.label + "\n\ninto a new draft? The file on disk will not be changed, and the current scratchpad/review notes will carry into the new draft.")
          : ("Reset editor origin and start a new independent draft? The current editor text, scratchpad, and review notes will carry into the new draft.");
        if (!window.confirm(message)) {
          return;
        }
        const nextLabel = String(sourceTextEl.value || "").trim() ? "draft" : "blank";
        setSourceState({
          source: "blank",
          label: nextLabel,
          path: null,
          draftId: makeStudioDraftId(),
        }, {
          carryCurrentMetadataToNewDocument: true,
        });
        setStatus(descriptor.fileBacked ? "Detached editor from file origin into a new draft." : "Reset editor origin to a new draft.", "success");
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
          if (studioUiRefreshEnabled) {
            setStudioUiRefreshFocusButtonIcon(btn, isFocusedPane);
          }
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

      function snapshotStudioScrollablePositions() {
        return [sourceTextEl, sourcePreviewEl, critiqueViewEl]
          .filter((el) => el && typeof el.scrollTop === "number" && typeof el.scrollLeft === "number")
          .map((el) => ({ el, top: el.scrollTop, left: el.scrollLeft }));
      }

      function restoreStudioScrollablePositions(snapshot) {
        if (!Array.isArray(snapshot)) return;
        snapshot.forEach((entry) => {
          const el = entry && entry.el;
          if (!el || !el.isConnected) return;
          if (typeof entry.top === "number") el.scrollTop = entry.top;
          if (typeof entry.left === "number") el.scrollLeft = entry.left;
        });
        syncEditorHighlightScroll();
      }

      function scheduleStudioScrollablePositionRestore(snapshot) {
        if (!Array.isArray(snapshot) || snapshot.length === 0) return;
        const schedule = typeof window.requestAnimationFrame === "function"
          ? window.requestAnimationFrame.bind(window)
          : (cb) => window.setTimeout(cb, 16);
        window.setTimeout(() => restoreStudioScrollablePositions(snapshot), 0);
        schedule(() => {
          restoreStudioScrollablePositions(snapshot);
          schedule(() => restoreStudioScrollablePositions(snapshot));
        });
      }

      function shouldPreserveScrollForPaneActivationEvent(event) {
        const target = event && event.target;
        if (!(target instanceof Element)) return true;
        if (target.closest("button, select, input, a, [role='button'], .studio-copy-block-btn, .preview-comment-add, .preview-comment-jump")) {
          return false;
        }
        return true;
      }

      function activatePaneFromInteraction(nextPane, event) {
        const shouldPreserveScroll = shouldPreserveScrollForPaneActivationEvent(event);
        const snapshot = shouldPreserveScroll ? snapshotStudioScrollablePositions() : [];
        setActivePane(nextPane);
        if (shouldPreserveScroll) scheduleStudioScrollablePositionRestore(snapshot);
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

      function triggerEditorSaveShortcut() {
        if (saveOverBtn && !saveOverBtn.disabled && !saveOverBtn.hidden) {
          saveOverBtn.click();
          return true;
        }
        if (saveAsBtn && !saveAsBtn.disabled && !saveAsBtn.hidden) {
          saveAsBtn.click();
          return true;
        }
        setStatus("Save is unavailable right now.", "warning");
        return false;
      }

      function handlePaneShortcut(event) {
        if (!event || event.defaultPrevented) return;

        const key = typeof event.key === "string" ? event.key : "";
        const plainEscape = key === "Escape"
          && !event.metaKey
          && !event.ctrlKey
          && !event.altKey
          && !event.shiftKey;
        const scratchpadOwnsEvent = Boolean(
          scratchpadDialogEl
          && event.target
          && typeof scratchpadDialogEl.contains === "function"
          && scratchpadDialogEl.contains(event.target)
        );
        const reviewNotesOwnsEvent = Boolean(
          reviewNotesDialogEl
          && event.target
          && typeof reviewNotesDialogEl.contains === "function"
          && reviewNotesDialogEl.contains(event.target)
        );
        const outlineOwnsEvent = Boolean(
          outlineDialogEl
          && event.target
          && typeof outlineDialogEl.contains === "function"
          && outlineDialogEl.contains(event.target)
        );
        const pdfFocusOwnsEvent = Boolean(
          studioPdfFocusDialogEl
          && event.target
          && typeof studioPdfFocusDialogEl.contains === "function"
          && studioPdfFocusDialogEl.contains(event.target)
        );
        const htmlFocusOwnsEvent = Boolean(
          studioHtmlFocusShellEl
          && event.target
          && typeof studioHtmlFocusShellEl.contains === "function"
          && studioHtmlFocusShellEl.contains(event.target)
        );
        const quizOwnsEvent = Boolean(
          quizDialogEl
          && event.target
          && typeof quizDialogEl.contains === "function"
          && quizDialogEl.contains(event.target)
        );

        if (isQuizOpen() && plainEscape) {
          event.preventDefault();
          minimizeQuizOverlay();
          return;
        }

        if (isStudioPdfFocusOpen() && plainEscape) {
          event.preventDefault();
          closeStudioPdfFocusViewer();
          return;
        }

        if (isStudioHtmlFocusOpen() && plainEscape) {
          event.preventDefault();
          closeStudioHtmlFocusViewer();
          return;
        }

        if (isScratchpadOpen() && plainEscape) {
          event.preventDefault();
          closeScratchpad();
          return;
        }

        if (isReviewNotesOpen() && plainEscape) {
          event.preventDefault();
          closeReviewNotes();
          return;
        }

        if (isOutlineOpen() && plainEscape) {
          event.preventDefault();
          closeOutline();
          return;
        }

        if (scratchpadOwnsEvent || reviewNotesOwnsEvent || outlineOwnsEvent || pdfFocusOwnsEvent || htmlFocusOwnsEvent || quizOwnsEvent) {
          return;
        }

        const isToggleShortcut =
          (key === "Escape" && (event.metaKey || event.ctrlKey))
          || key === "F10";

        if (isToggleShortcut) {
          event.preventDefault();
          togglePaneFocus();
          return;
        }

        const isSaveShortcut =
          key.toLowerCase() === "s"
          && (event.metaKey || event.ctrlKey)
          && !event.altKey
          && !event.shiftKey;

        if (isSaveShortcut) {
          event.preventDefault();
          triggerEditorSaveShortcut();
          return;
        }

        if (plainEscape) {
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
          && event.shiftKey
          && activePane === "left"
          && !isEditorOnlyMode
          && rightView === "repl"
        ) {
          event.preventDefault();
          if (sendReplBtn && !sendReplBtn.hidden && !sendReplBtn.disabled) {
            sendReplBtn.click();
          } else {
            setStatus("Open REPL view and start/select a session before sending to REPL.", "warning");
          }
          return;
        }

        if (
          key === "Enter"
          && (event.metaKey || event.ctrlKey)
          && !event.altKey
          && !event.shiftKey
          && activePane === "left"
          && !isEditorOnlyMode
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

      function normalizeTraceSummary(summary) {
        if (!summary || typeof summary !== "object") return null;
        return {
          hasTrace: summary.hasTrace === true,
          entryCount: typeof summary.entryCount === "number" && Number.isFinite(summary.entryCount)
            ? Math.max(0, Math.floor(summary.entryCount))
            : 0,
          startedAt: parseFiniteNumber(summary.startedAt),
          updatedAt: parseFiniteNumber(summary.updatedAt),
          status: normalizeTraceStatus(summary.status),
          truncated: summary.truncated === true,
        };
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
        const traceSummary = normalizeTraceSummary(item.traceSummary);

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
          traceSummary,
        };
      }

      function getSelectedHistoryItem() {
        if (!Array.isArray(responseHistory) || responseHistory.length === 0) return null;
        if (responseHistoryIndex < 0 || responseHistoryIndex >= responseHistory.length) return null;
        return responseHistory[responseHistoryIndex] || null;
      }

      function syncTraceForSelectedHistoryItem() {
        const item = getSelectedHistoryItem();
        const total = Array.isArray(responseHistory) ? responseHistory.length : 0;
        const index = responseHistoryIndex;
        if (!item) {
          setTraceDisplayContext({ mode: "live", responseId: null, historyIndex: index, total, summary: null });
          replaceTraceState(liveTraceState || createEmptyTraceState());
          return;
        }
        if (index >= total - 1) {
          setTraceDisplayContext({ mode: "live", responseId: null, historyIndex: index, total, summary: item.traceSummary || null });
          replaceTraceState(liveTraceState || createEmptyTraceState());
          return;
        }

        const summary = item.traceSummary || null;
        if (!summary || !summary.hasTrace) {
          setTraceDisplayContext({ mode: "missing", responseId: item.id, historyIndex: index, total, summary });
          replaceTraceState(createEmptyTraceState());
          return;
        }

        const cached = traceSnapshotCache.get(item.id);
        if (cached) {
          setTraceDisplayContext({ mode: "history", responseId: item.id, historyIndex: index, total, summary });
          replaceTraceState(cached);
          return;
        }

        setTraceDisplayContext({ mode: "loading", responseId: item.id, historyIndex: index, total, summary });
        replaceTraceState({
          runId: null,
          requestId: null,
          requestKind: null,
          status: "idle",
          startedAt: summary.startedAt || null,
          updatedAt: summary.updatedAt || null,
          entries: [],
        });
        sendMessage({ type: "get_trace_snapshot", responseHistoryId: item.id });
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
        syncTraceForSelectedHistoryItem();

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

      function getTraceHistoryContextLabel() {
        const context = traceDisplayContext || {};
        const total = typeof context.total === "number" && Number.isFinite(context.total) ? context.total : responseHistory.length;
        const index = typeof context.historyIndex === "number" && Number.isFinite(context.historyIndex) ? context.historyIndex : responseHistoryIndex;
        if (context.mode === "history" || context.mode === "missing" || context.mode === "loading") {
          return total > 0 && index >= 0 ? ("response " + (index + 1) + "/" + total) : "selected response";
        }
        return "live";
      }

      function updateReferenceBadge() {
        if (!referenceBadgeEl) return;
        const referenceMetaEl = referenceBadgeEl.closest(".reference-meta");
        if (rightView === "repl") {
          if (referenceMetaEl instanceof HTMLElement) referenceMetaEl.hidden = true;
          return;
        }
        if (referenceMetaEl instanceof HTMLElement) referenceMetaEl.hidden = false;

        if (rightView === "trace") {
          const state = traceState || createEmptyTraceState();
          const context = traceDisplayContext || {};
          const entryCount = getTraceEntriesForFilter(traceFilter).length;
          const time = formatReferenceTime(state.startedAt || state.updatedAt);
          if (context.mode === "loading") {
            referenceBadgeEl.textContent = "Working: loading " + getTraceHistoryContextLabel();
            return;
          }
          if (context.mode === "missing") {
            referenceBadgeEl.textContent = "Working: no saved working for " + getTraceHistoryContextLabel();
            return;
          }
          if (state.status === "idle") {
            referenceBadgeEl.textContent = "Working: no active run yet";
            return;
          }
          const statusLabel = context.mode === "history"
            ? "saved"
            : (state.status === "running" ? "live" : "complete");
          referenceBadgeEl.textContent = "Working: " + statusLabel
            + (context.mode === "history" ? (" · " + getTraceHistoryContextLabel()) : "")
            + (entryCount ? (" · " + entryCount + " entr" + (entryCount === 1 ? "y" : "ies")) : "")
            + (context.summary && context.summary.truncated ? " · truncated" : "")
            + (time ? (" · " + time) : "");
          return;
        }

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

      function stripMarkdownHtmlComments(text) {
        if (annotationHelpers && typeof annotationHelpers.stripMarkdownHtmlComments === "function") {
          return annotationHelpers.stripMarkdownHtmlComments(text);
        }
        return String(text || "");
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

      function prepareEditorTextForHtmlExport(text) {
        const prepared = prepareEditorTextForPreview(text);
        const lang = normalizeFenceLanguage(editorLanguage || "");
        if (lang && lang !== "markdown" && lang !== "latex") {
          return wrapAsFencedCodeBlock(prepared, lang);
        }
        return prepared;
      }

      function updateSyncBadge(normalizedEditorText) {
        if (!syncBadgeEl) return;

        if (isEditorOnlyMode) {
          syncBadgeEl.hidden = true;
          syncBadgeEl.classList.remove("sync");
          return;
        }

        if (rightView === "trace") {
          syncBadgeEl.hidden = true;
          syncBadgeEl.classList.remove("sync");
          return;
        }

        if (!latestResponseHasContent) {
          syncBadgeEl.hidden = true;
          syncBadgeEl.textContent = "In sync with response";
          syncBadgeEl.classList.remove("sync");
          return;
        }

        const normalizedEditor = typeof normalizedEditorText === "string"
          ? normalizedEditorText
          : normalizeForCompare(sourceTextEl.value);
        const inSync = normalizedEditor === latestResponseNormalized;
        syncBadgeEl.hidden = !inSync;
        syncBadgeEl.textContent = "In sync with response";

        if (inSync) {
          syncBadgeEl.classList.add("sync");
          return;
        }

        syncBadgeEl.classList.remove("sync");
      }

      function buildPlainMarkdownHtml(markdown, options) {
        const shouldStripHtmlComments = Boolean(options && options.stripMarkdownHtmlComments);
        const source = shouldStripHtmlComments ? stripMarkdownHtmlComments(markdown) : String(markdown || "");
        return "<pre class='plain-markdown'>" + escapeHtml(source) + "</pre>";
      }

      function buildPreviewErrorHtml(message, markdown, options) {
        return "<div class='preview-error'>" + escapeHtml(String(message || "Preview rendering failed.")) + "</div>" + buildPlainMarkdownHtml(markdown, options);
      }

      function stripLeadingHtmlPreviewTrivia(text) {
        let source = String(text || "").replace(/^\uFEFF/, "").trimStart();
        let previous = "";
        while (source && source !== previous) {
          previous = source;
          source = source.replace(/^<!--[\s\S]*?-->\s*/, "").trimStart();
        }
        return source;
      }

      function startsWithSingleFencedBlock(text) {
        const source = String(text || "").trimStart();
        return /^(`{3,}|~{3,})/.test(source);
      }

      function isLikelyFullHtmlDocument(text) {
        const source = stripLeadingHtmlPreviewTrivia(text);
        if (!source) return false;
        if (/^<!doctype\s+html\b/i.test(source)) return true;
        if (/^<html(?:\s|>|$)/i.test(source)) return true;
        if (/^<body(?:\s|>|$)/i.test(source) && /<\/body\s*>/i.test(source)) return true;
        return false;
      }

      function looksLikeHtmlMarkup(text) {
        return /<[A-Za-z][A-Za-z0-9:-]*(?:\s[^<>]*)?>/.test(String(text || ""));
      }

      function isHtmlArtifactPreviewText(text, language) {
        const source = String(text || "");
        if (!source.trim()) return false;
        if (startsWithSingleFencedBlock(source)) return false;
        if (isLikelyFullHtmlDocument(source)) return true;
        return normalizeFenceLanguage(language || "") === "html" && looksLikeHtmlMarkup(source);
      }

      const HTML_ARTIFACT_PREVIEW_CSP = "default-src 'none'; script-src 'unsafe-inline' data: blob:; style-src 'unsafe-inline' data: blob:; img-src data: blob:; font-src data: blob:; connect-src 'none'; media-src data: blob:; object-src 'none'; frame-src data: blob:; child-src data: blob:; worker-src blob:; form-action 'none'; base-uri 'none'; navigate-to 'none'";
      const HTML_ARTIFACT_FRAME_MIN_HEIGHT = 360;
      const HTML_ARTIFACT_FRAME_FIT_CAP_HEIGHT = 1800;
      const HTML_ARTIFACT_ZOOM_MIN = 0.5;
      const HTML_ARTIFACT_ZOOM_MAX = 1.75;
      const HTML_ARTIFACT_ZOOM_STEP = 0.1;

      function buildHtmlArtifactPreviewResizeScript(previewId) {
        const idJson = JSON.stringify(String(previewId || ""));
        return "<script>\n"
          + "(() => {\n"
          + "  const PREVIEW_ID = " + idJson.replace(/<\//g, "<\\/") + ";\n"
          + "  let lastHeight = 0;\n"
          + "  let scheduled = false;\n"
          + "  let currentZoom = 1;\n"
          + "  function applyZoom(value) {\n"
          + "    const next = Number(value);\n"
          + "    if (!Number.isFinite(next) || next <= 0) return;\n"
          + "    currentZoom = Math.max(0.25, Math.min(4, next));\n"
          + "    document.documentElement.style.zoom = String(currentZoom);\n"
          + "    lastHeight = 0;\n"
          + "    scheduleHeight();\n"
          + "  }\n"
          + "  function measureHeight() {\n"
          + "    const body = document.body;\n"
          + "    const root = document.documentElement;\n"
          + "    return Math.ceil(Math.max(\n"
          + "      body ? body.scrollHeight : 0,\n"
          + "      body ? body.offsetHeight : 0,\n"
          + "      root ? root.scrollHeight : 0,\n"
          + "      root ? root.offsetHeight : 0\n"
          + "    ));\n"
          + "  }\n"
          + "  function sendHeight() {\n"
          + "    scheduled = false;\n"
          + "    const height = measureHeight();\n"
          + "    if (!height || Math.abs(height - lastHeight) < 2) return;\n"
          + "    lastHeight = height;\n"
          + "    try { parent.postMessage({ type: 'pi-studio-html-artifact-size', id: PREVIEW_ID, height }, '*'); } catch {}\n"
          + "  }\n"
          + "  function scheduleHeight() {\n"
          + "    if (scheduled) return;\n"
          + "    scheduled = true;\n"
          + "    requestAnimationFrame(sendHeight);\n"
          + "  }\n"
          + "  window.addEventListener('message', (event) => {\n"
          + "    const data = event && event.data;\n"
          + "    if (!data || typeof data !== 'object') return;\n"
          + "    if (data.type !== 'pi-studio-html-artifact-zoom' || data.id !== PREVIEW_ID) return;\n"
          + "    applyZoom(data.zoom);\n"
          + "  });\n"
          + "  window.addEventListener('load', scheduleHeight);\n"
          + "  window.addEventListener('resize', scheduleHeight);\n"
          + "  if (typeof ResizeObserver === 'function') {\n"
          + "    const observer = new ResizeObserver(scheduleHeight);\n"
          + "    observer.observe(document.documentElement);\n"
          + "    if (document.body) observer.observe(document.body);\n"
          + "  }\n"
          + "  if (typeof MutationObserver === 'function') {\n"
          + "    const observer = new MutationObserver(scheduleHeight);\n"
          + "    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });\n"
          + "  }\n"
          + "  scheduleHeight();\n"
          + "  setTimeout(scheduleHeight, 80);\n"
          + "  setTimeout(scheduleHeight, 350);\n"
          + "})();\n"
          + "<\/script>";
      }

      function buildHtmlArtifactPreviewHeadMarkup(previewId) {
        return "<meta charset=\"utf-8\">\n"
          + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n"
          + "<meta http-equiv=\"Content-Security-Policy\" content=\"" + escapeHtml(HTML_ARTIFACT_PREVIEW_CSP) + "\">\n"
          + buildHtmlArtifactPreviewResizeScript(previewId);
      }

      function buildHtmlArtifactSrcdoc(html, previewId) {
        const source = String(html || "");
        const headMarkup = buildHtmlArtifactPreviewHeadMarkup(previewId);
        if (/<head\b[^>]*>/i.test(source)) {
          return source.replace(/<head\b[^>]*>/i, (match) => match + "\n" + headMarkup + "\n");
        }
        if (/<body\b[^>]*>/i.test(source)) {
          return source.replace(/<body\b/i, "<head>\n" + headMarkup + "\n</head>\n<body");
        }
        if (/<html\b[^>]*>/i.test(source)) {
          return source.replace(/<html\b[^>]*>/i, (match) => match + "\n<head>\n" + headMarkup + "\n</head>\n");
        }
        return "<!doctype html>\n<html>\n<head>\n" + headMarkup + "\n</head>\n<body>\n" + source + "\n</body>\n</html>";
      }

      function pruneDisconnectedHtmlArtifactFrames() {
        htmlArtifactFramesById.forEach((record, id) => {
          if (!record || !record.iframe || !record.iframe.isConnected) {
            htmlArtifactFramesById.delete(id);
          }
        });
      }

      function handleHtmlArtifactFrameSizeMessage(event) {
        const data = event && event.data;
        if (!data || typeof data !== "object" || data.type !== "pi-studio-html-artifact-size") return;
        const id = typeof data.id === "string" ? data.id : "";
        const record = id ? htmlArtifactFramesById.get(id) : null;
        if (!record || !record.iframe || !record.iframe.isConnected) {
          if (id) htmlArtifactFramesById.delete(id);
          return;
        }
        if (event.source && record.iframe.contentWindow && event.source !== record.iframe.contentWindow) return;
        if (record.shell && record.shell.classList && record.shell.classList.contains("is-focused")) {
          if (record.detail) record.detail.textContent = "HTML preview";
          return;
        }
        const rawHeight = Number(data.height);
        if (!Number.isFinite(rawHeight) || rawHeight <= 0) return;
        const measuredHeight = Math.ceil(rawHeight + 2);
        const capped = measuredHeight > HTML_ARTIFACT_FRAME_FIT_CAP_HEIGHT;
        const nextHeight = Math.max(
          HTML_ARTIFACT_FRAME_MIN_HEIGHT,
          Math.min(HTML_ARTIFACT_FRAME_FIT_CAP_HEIGHT, measuredHeight),
        );
        record.iframe.style.height = nextHeight + "px";
        record.iframe.classList.toggle("is-height-capped", capped);
        if (record.shell && record.shell.style) {
          record.shell.style.minHeight = "0";
          record.shell.classList.toggle("is-height-capped", capped);
        }
        if (record.detail) {
          record.detail.textContent = "HTML preview";
        }
      }

      window.addEventListener("message", handleHtmlArtifactFrameSizeMessage);

      function isStudioHtmlFocusOpen() {
        return Boolean(studioHtmlFocusOverlayEl && studioHtmlFocusOverlayEl.hidden === false && studioHtmlFocusShellEl);
      }

      function ensureStudioHtmlFocusViewer() {
        if (studioHtmlFocusOverlayEl) return studioHtmlFocusOverlayEl;

        const overlay = document.createElement("div");
        overlay.className = "studio-pdf-focus-overlay studio-html-focus-overlay";
        overlay.hidden = true;
        overlay.setAttribute("aria-hidden", "true");
        overlay.addEventListener("click", (event) => {
          if (event.target === overlay) closeStudioHtmlFocusViewer();
        });
        document.addEventListener("fullscreenchange", syncStudioHtmlFocusFullscreenButton);
        document.body.appendChild(overlay);
        studioHtmlFocusOverlayEl = overlay;
        syncStudioHtmlFocusFullscreenButton();
        return overlay;
      }

      function getStudioHtmlFocusButton(shell) {
        return shell && typeof shell.querySelector === "function"
          ? shell.querySelector(".studio-html-artifact-focus-btn")
          : null;
      }

      function getStudioHtmlFullscreenButton(shell) {
        return shell && typeof shell.querySelector === "function"
          ? shell.querySelector(".studio-html-artifact-fullscreen-btn")
          : null;
      }

      function setStudioHtmlFocusButtonMode(button, focused) {
        if (!button) return;
        button.replaceChildren(makeStudioUiRefreshIcon(focused ? "focus-exit" : "focus"));
        button.title = focused
          ? "Exit HTML preview focus view."
          : "Open this HTML preview in a larger Studio overlay.";
        button.setAttribute("aria-label", focused ? "Exit HTML preview focus view" : "Focus HTML preview");
        button.setAttribute("aria-pressed", focused ? "true" : "false");
      }

      function syncStudioHtmlFocusFullscreenButton() {
        const button = studioHtmlFocusFullscreenBtn;
        if (!button) return;
        const shell = studioHtmlFocusShellEl;
        const isFullscreen = Boolean(shell && document.fullscreenElement && document.fullscreenElement === shell);
        button.replaceChildren(makeStudioUiRefreshIcon(isFullscreen ? "fullscreen-exit" : "fullscreen"));
        const label = isFullscreen ? "Exit fullscreen" : "Fullscreen";
        button.title = isFullscreen
          ? "Exit browser fullscreen and keep the HTML preview focus view open."
          : "Ask the browser to make this HTML preview fullscreen.";
        button.setAttribute("aria-label", label);
        button.setAttribute("aria-pressed", isFullscreen ? "true" : "false");
      }

      async function toggleStudioHtmlFocusFullscreen() {
        const shell = studioHtmlFocusShellEl;
        if (!shell) return;
        const isFullscreen = Boolean(document.fullscreenElement && document.fullscreenElement === shell);
        if (isFullscreen) {
          try {
            if (typeof document.exitFullscreen === "function") await document.exitFullscreen();
          } catch (error) {
            setStatus("Could not exit HTML preview fullscreen: " + (error && error.message ? error.message : String(error || "unknown error")), "warning");
          } finally {
            syncStudioHtmlFocusFullscreenButton();
          }
          return;
        }
        if (typeof shell.requestFullscreen !== "function") {
          setStatus("Browser fullscreen is not available for this HTML preview.", "warning");
          return;
        }
        try {
          await shell.requestFullscreen();
        } catch (error) {
          setStatus("Could not enter HTML preview fullscreen: " + (error && error.message ? error.message : String(error || "unknown error")), "warning");
        } finally {
          syncStudioHtmlFocusFullscreenButton();
        }
      }

      function openStudioHtmlFocusViewer(title, shell) {
        // Keep the existing sandboxed iframe in place. Reparenting srcdoc iframes can
        // recreate their browsing context and lose form/script state.
        const focusShell = shell instanceof HTMLElement ? shell : null;
        if (!focusShell || !focusShell.isConnected) return false;
        if (isStudioHtmlFocusOpen() && studioHtmlFocusShellEl === focusShell) return true;
        if (isStudioHtmlFocusOpen()) closeStudioHtmlFocusViewer();
        ensureStudioHtmlFocusViewer();

        studioHtmlFocusLastFocusedEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        studioHtmlFocusShellEl = focusShell;
        studioHtmlFocusRestoreState = {
          role: focusShell.getAttribute("role"),
          ariaModal: focusShell.getAttribute("aria-modal"),
          ariaLabel: focusShell.getAttribute("aria-label"),
        };

        focusShell.classList.add("is-focused");
        focusShell.setAttribute("role", "dialog");
        focusShell.setAttribute("aria-modal", "true");
        focusShell.setAttribute("aria-label", String(title || "HTML preview").trim() || "HTML preview");

        const focusButton = getStudioHtmlFocusButton(focusShell);
        setStudioHtmlFocusButtonMode(focusButton, true);
        studioHtmlFocusFullscreenBtn = getStudioHtmlFullscreenButton(focusShell);
        if (studioHtmlFocusFullscreenBtn) studioHtmlFocusFullscreenBtn.hidden = false;

        if (document.body) document.body.classList.add("studio-html-focus-open", "studio-pdf-focus-open");
        if (studioHtmlFocusOverlayEl) {
          studioHtmlFocusOverlayEl.hidden = false;
          studioHtmlFocusOverlayEl.setAttribute("aria-hidden", "false");
        }
        syncStudioHtmlFocusFullscreenButton();
        closeStudioUiRefreshMenus();
        closeExportPreviewMenu();
        window.setTimeout(() => {
          if (focusButton && typeof focusButton.focus === "function") focusButton.focus();
        }, 0);
        return true;
      }

      function closeStudioHtmlFocusViewer() {
        if (!isStudioHtmlFocusOpen()) return false;
        const shell = studioHtmlFocusShellEl;
        if (document.fullscreenElement && shell && document.fullscreenElement === shell) {
          try {
            const exitResult = document.exitFullscreen && document.exitFullscreen();
            if (exitResult && typeof exitResult.catch === "function") exitResult.catch(() => {});
          } catch {}
        }
        if (studioHtmlFocusOverlayEl) {
          studioHtmlFocusOverlayEl.hidden = true;
          studioHtmlFocusOverlayEl.setAttribute("aria-hidden", "true");
        }
        if (shell) {
          shell.classList.remove("is-focused");
          const restore = studioHtmlFocusRestoreState || {};
          if (restore.role === null || typeof restore.role === "undefined") shell.removeAttribute("role");
          else shell.setAttribute("role", restore.role);
          if (restore.ariaModal === null || typeof restore.ariaModal === "undefined") shell.removeAttribute("aria-modal");
          else shell.setAttribute("aria-modal", restore.ariaModal);
          if (restore.ariaLabel === null || typeof restore.ariaLabel === "undefined") shell.removeAttribute("aria-label");
          else shell.setAttribute("aria-label", restore.ariaLabel);
          setStudioHtmlFocusButtonMode(getStudioHtmlFocusButton(shell), false);
        }
        if (studioHtmlFocusFullscreenBtn) studioHtmlFocusFullscreenBtn.hidden = true;
        studioHtmlFocusShellEl = null;
        studioHtmlFocusFullscreenBtn = null;
        studioHtmlFocusRestoreState = null;
        if (document.body) document.body.classList.remove("studio-html-focus-open", "studio-pdf-focus-open");
        const focusTarget = studioHtmlFocusLastFocusedEl;
        studioHtmlFocusLastFocusedEl = null;
        if (focusTarget && typeof focusTarget.focus === "function" && document.contains(focusTarget)) {
          window.setTimeout(() => focusTarget.focus(), 0);
        }
        return true;
      }

      function openStudioHtmlFocusFromButton(buttonEl) {
        if (!buttonEl) return false;
        const shell = buttonEl.closest && buttonEl.closest(".studio-html-artifact-shell");
        if (!shell) return false;
        if (isStudioHtmlFocusOpen() && studioHtmlFocusShellEl === shell) {
          return closeStudioHtmlFocusViewer();
        }
        const title = String(shell.dataset && shell.dataset.studioHtmlTitle ? shell.dataset.studioHtmlTitle : "").trim()
          || String(buttonEl.dataset && buttonEl.dataset.studioHtmlTitle ? buttonEl.dataset.studioHtmlTitle : "").trim()
          || "HTML preview";
        return openStudioHtmlFocusViewer(title, shell);
      }

      function handleStudioHtmlFocusButtonClick(event) {
        const target = event && event.target;
        const buttonEl = target instanceof Element ? target.closest(".studio-html-artifact-focus-btn") : null;
        if (!buttonEl) return;
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") {
          event.stopImmediatePropagation();
        }
        if (!openStudioHtmlFocusFromButton(buttonEl)) {
          setStatus("Could not open HTML preview focus view.", "warning");
        }
      }

      function renderHtmlArtifactPreview(targetEl, html, pane, options) {
        if (!targetEl) return;
        const title = options && options.title ? String(options.title) : "HTML preview";
        const previewId = "html_artifact_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
        pruneDisconnectedHtmlArtifactFrames();
        if (isStudioHtmlFocusOpen()) closeStudioHtmlFocusViewer();
        clearPreviewJumpHighlight(targetEl);
        finishPreviewRender(targetEl);
        targetEl.innerHTML = "";

        const shell = document.createElement("div");
        shell.className = "studio-html-artifact-shell";
        if (shell.dataset) shell.dataset.studioHtmlTitle = title;

        const toolbar = document.createElement("div");
        toolbar.className = "studio-html-artifact-toolbar";
        const titleGroup = document.createElement("div");
        titleGroup.className = "studio-html-artifact-title-group";
        const focusBtn = document.createElement("button");
        focusBtn.type = "button";
        focusBtn.className = "studio-html-artifact-focus-btn";
        focusBtn.title = "Open this HTML preview in a larger Studio overlay.";
        focusBtn.setAttribute("aria-label", "Focus HTML preview");
        if (focusBtn.dataset) focusBtn.dataset.studioHtmlTitle = title;
        focusBtn.appendChild(makeStudioUiRefreshIcon("focus"));
        focusBtn.addEventListener("click", handleStudioHtmlFocusButtonClick);
        titleGroup.appendChild(focusBtn);
        const label = document.createElement("span");
        label.className = "studio-html-artifact-label";
        label.textContent = title;
        titleGroup.appendChild(label);
        const detail = document.createElement("span");
        detail.className = "studio-html-artifact-detail";
        detail.textContent = "HTML preview";

        const tools = document.createElement("span");
        tools.className = "studio-html-artifact-tools";

        const zoomControls = document.createElement("span");
        zoomControls.className = "studio-html-artifact-zoom-controls";
        let artifactZoom = 1;
        let iframe = null;
        const formatZoomLabel = () => Math.round(artifactZoom * 100) + "%";
        const postArtifactZoom = () => {
          if (!iframe || !iframe.contentWindow) return;
          try {
            iframe.contentWindow.postMessage({ type: "pi-studio-html-artifact-zoom", id: previewId, zoom: artifactZoom }, "*");
          } catch {
            // Ignore iframe postMessage failures.
          }
        };
        const updateZoomUi = () => {
          zoomResetBtn.textContent = formatZoomLabel();
          zoomOutBtn.disabled = artifactZoom <= HTML_ARTIFACT_ZOOM_MIN + 0.001;
          zoomInBtn.disabled = artifactZoom >= HTML_ARTIFACT_ZOOM_MAX - 0.001;
        };
        const setArtifactZoom = (nextZoom) => {
          artifactZoom = Math.max(
            HTML_ARTIFACT_ZOOM_MIN,
            Math.min(HTML_ARTIFACT_ZOOM_MAX, Math.round(Number(nextZoom || 1) * 100) / 100),
          );
          updateZoomUi();
          postArtifactZoom();
        };
        const makeZoomButton = (text, title, onClick) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "studio-html-artifact-zoom-btn";
          button.textContent = text;
          button.title = title;
          button.addEventListener("pointerdown", (event) => { event.stopPropagation(); });
          button.addEventListener("mousedown", (event) => { event.stopPropagation(); });
          button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            onClick();
          });
          return button;
        };
        const zoomOutBtn = makeZoomButton("−", "Zoom out HTML preview", () => setArtifactZoom(artifactZoom - HTML_ARTIFACT_ZOOM_STEP));
        const zoomResetBtn = makeZoomButton("100%", "Reset HTML preview zoom", () => setArtifactZoom(1));
        zoomResetBtn.classList.add("studio-html-artifact-zoom-reset");
        const zoomInBtn = makeZoomButton("+", "Zoom in HTML preview", () => setArtifactZoom(artifactZoom + HTML_ARTIFACT_ZOOM_STEP));
        zoomControls.appendChild(zoomOutBtn);
        zoomControls.appendChild(zoomResetBtn);
        zoomControls.appendChild(zoomInBtn);
        const fullscreenBtn = document.createElement("button");
        fullscreenBtn.type = "button";
        fullscreenBtn.className = "studio-html-artifact-fullscreen-btn";
        fullscreenBtn.hidden = true;
        fullscreenBtn.addEventListener("pointerdown", (event) => { event.stopPropagation(); });
        fullscreenBtn.addEventListener("mousedown", (event) => { event.stopPropagation(); });
        fullscreenBtn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          toggleStudioHtmlFocusFullscreen();
        });
        fullscreenBtn.appendChild(makeStudioUiRefreshIcon("fullscreen"));
        updateZoomUi();
        tools.appendChild(detail);
        tools.appendChild(zoomControls);
        tools.appendChild(fullscreenBtn);

        toolbar.appendChild(titleGroup);
        toolbar.appendChild(tools);
        shell.appendChild(toolbar);

        iframe = document.createElement("iframe");
        iframe.className = "studio-html-artifact-frame";
        iframe.title = title;
        iframe.loading = "lazy";
        iframe.referrerPolicy = "no-referrer";
        iframe.setAttribute("sandbox", "allow-scripts allow-modals");
        iframe.setAttribute("allow", "clipboard-write");
        iframe.addEventListener("load", () => { postArtifactZoom(); });
        iframe.srcdoc = buildHtmlArtifactSrcdoc(html, previewId);
        shell.appendChild(iframe);
        htmlArtifactFramesById.set(previewId, { iframe, shell, detail, zoomControls });

        targetEl.appendChild(shell);

        if (pane === "response") {
          applyPendingResponseScrollReset();
          scheduleResponsePaneRepaintNudge();
        }
      }

      function getRightPaneHtmlArtifactSource() {
        if (rightView === "editor-preview") {
          const editorText = prepareEditorTextForPreview(sourceTextEl.value || "");
          return isHtmlArtifactPreviewText(editorText, editorLanguage) ? editorText : "";
        }
        if (rightView === "preview") {
          return isHtmlArtifactPreviewText(latestResponseMarkdown, "") ? latestResponseMarkdown : "";
        }
        return "";
      }

      function stripMatchingQuotes(value) {
        const text = String(value || "").trim();
        if (text.length >= 2) {
          const first = text[0];
          const last = text[text.length - 1];
          if ((first === "\"" && last === "\"") || (first === "'" && last === "'")) {
            return text.slice(1, -1).trim();
          }
        }
        return text;
      }

      function parseStudioPdfBlockOptions(body) {
        const options = { path: "", title: "", caption: "", page: "", height: "" };
        String(body || "").split(/\r?\n/).forEach((line) => {
          const raw = String(line || "").trim();
          if (!raw || raw.startsWith("#")) return;
          const match = raw.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*([\s\S]*)$/);
          if (match) {
            const key = String(match[1] || "").toLowerCase();
            const value = stripMatchingQuotes(match[2] || "");
            if (key === "path" || key === "src" || key === "file") options.path = value;
            else if (key === "title") options.title = value;
            else if (key === "caption") options.caption = value;
            else if (key === "page") options.page = value;
            else if (key === "height") options.height = value;
            return;
          }
          if (!options.path) options.path = stripMatchingQuotes(raw);
        });
        return options;
      }

      function prepareStudioPdfBlocksForPreview(markdown) {
        const blocks = [];
        const prefix = "STUDIO_PDF_BLOCK_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2) + "_";
        const source = String(markdown || "");
        const blockPattern = /(^|\n)([ \t]{0,3})(`{3,}|~{3,})[ \t]*studio-pdf[^\n]*\n([\s\S]*?)\n[ \t]*\3[ \t]*(?=\n|$)/g;
        const nextMarkdown = source.replace(blockPattern, (match, leadingNewline, _indent, _fence, body) => {
          const placeholder = prefix + blocks.length;
          blocks.push({ placeholder, options: parseStudioPdfBlockOptions(body) });
          return String(leadingNewline || "") + placeholder + "\n";
        });
        return { markdown: nextMarkdown, blocks };
      }

      function normalizeStudioPdfHeight(value) {
        const parsed = Number.parseInt(String(value || ""), 10);
        if (!Number.isFinite(parsed)) return 680;
        return Math.max(240, Math.min(1400, parsed));
      }

      function normalizeStudioPdfPage(value) {
        const parsed = Number.parseInt(String(value || ""), 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
      }

      function isStudioPdfFocusOpen() {
        return Boolean(studioPdfFocusOverlayEl && studioPdfFocusOverlayEl.hidden === false);
      }

      function ensureStudioPdfFocusViewer() {
        if (studioPdfFocusOverlayEl) return studioPdfFocusOverlayEl;

        const overlay = document.createElement("div");
        overlay.className = "studio-pdf-focus-overlay";
        overlay.hidden = true;
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-labelledby", "studioPdfFocusTitle");

        const dialog = document.createElement("div");
        dialog.className = "studio-pdf-focus-dialog";

        const header = document.createElement("div");
        header.className = "studio-pdf-focus-header";

        const titleGroup = document.createElement("div");
        titleGroup.className = "studio-pdf-focus-title-group";

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "studio-pdf-focus-btn studio-pdf-focus-close";
        closeBtn.title = "Exit PDF focus view.";
        closeBtn.setAttribute("aria-label", "Exit PDF focus view");
        closeBtn.appendChild(makeStudioUiRefreshIcon("focus-exit"));
        closeBtn.addEventListener("click", () => closeStudioPdfFocusViewer());
        titleGroup.appendChild(closeBtn);

        const titleEl = document.createElement("div");
        titleEl.id = "studioPdfFocusTitle";
        titleEl.className = "studio-pdf-focus-title";
        titleEl.textContent = "PDF preview";
        titleGroup.appendChild(titleEl);
        header.appendChild(titleGroup);

        const actions = document.createElement("div");
        actions.className = "studio-pdf-focus-actions";

        const openLink = document.createElement("a");
        openLink.className = "studio-pdf-focus-link";
        openLink.target = "_blank";
        openLink.rel = "noopener noreferrer";
        openLink.textContent = "Open PDF";
        actions.appendChild(openLink);

        const fullscreenBtn = document.createElement("button");
        fullscreenBtn.type = "button";
        fullscreenBtn.className = "studio-pdf-focus-btn studio-pdf-focus-fullscreen";
        fullscreenBtn.addEventListener("click", async () => {
          const isFullscreen = Boolean(document.fullscreenElement && studioPdfFocusDialogEl && document.fullscreenElement === studioPdfFocusDialogEl);
          if (isFullscreen) {
            try {
              if (typeof document.exitFullscreen === "function") await document.exitFullscreen();
            } catch (error) {
              setStatus("Could not exit PDF fullscreen: " + (error && error.message ? error.message : String(error || "unknown error")), "warning");
            } finally {
              syncStudioPdfFocusFullscreenButton();
            }
            return;
          }
          if (!studioPdfFocusDialogEl || typeof studioPdfFocusDialogEl.requestFullscreen !== "function") {
            setStatus("Browser fullscreen is not available for this PDF viewer.", "warning");
            return;
          }
          try {
            await studioPdfFocusDialogEl.requestFullscreen();
          } catch (error) {
            setStatus("Could not enter PDF fullscreen: " + (error && error.message ? error.message : String(error || "unknown error")), "warning");
          } finally {
            syncStudioPdfFocusFullscreenButton();
          }
        });
        actions.appendChild(fullscreenBtn);

        header.appendChild(actions);
        dialog.appendChild(header);

        const frameSlot = document.createElement("div");
        frameSlot.className = "studio-pdf-focus-frame-slot";
        const frame = document.createElement("iframe");
        frame.className = "studio-pdf-focus-frame";
        frame.title = "PDF focus viewer";
        frame.loading = "eager";
        frameSlot.appendChild(frame);
        dialog.appendChild(frameSlot);

        overlay.appendChild(dialog);
        overlay.addEventListener("click", (event) => {
          if (event.target === overlay) closeStudioPdfFocusViewer();
        });
        document.addEventListener("fullscreenchange", syncStudioPdfFocusFullscreenButton);

        document.body.appendChild(overlay);
        studioPdfFocusOverlayEl = overlay;
        studioPdfFocusDialogEl = dialog;
        studioPdfFocusFrameSlotEl = frameSlot;
        studioPdfFocusFrameEl = frame;
        studioPdfFocusTitleEl = titleEl;
        studioPdfFocusOpenLinkEl = openLink;
        studioPdfFocusFullscreenBtn = fullscreenBtn;
        studioPdfFocusCloseBtn = closeBtn;
        syncStudioPdfFocusFullscreenButton();
        return overlay;
      }

      function openStudioPdfFocusViewer(viewerUrl, title, sourceFrame) {
        const src = String(viewerUrl || "").trim();
        if (!src) return;
        ensureStudioPdfFocusViewer();
        studioPdfFocusLastFocusedEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        if (studioPdfFocusTitleEl) studioPdfFocusTitleEl.textContent = String(title || "PDF preview").trim() || "PDF preview";
        if (studioPdfFocusOpenLinkEl) studioPdfFocusOpenLinkEl.href = src;
        setStudioPdfFocusFrameSource(src, title, sourceFrame);
        if (document.body) document.body.classList.add("studio-pdf-focus-open");
        if (studioPdfFocusOverlayEl) studioPdfFocusOverlayEl.hidden = false;
        syncStudioPdfFocusFullscreenButton();
        closeStudioUiRefreshMenus();
        closeExportPreviewMenu();
        window.setTimeout(() => {
          if (studioPdfFocusCloseBtn && typeof studioPdfFocusCloseBtn.focus === "function") {
            studioPdfFocusCloseBtn.focus();
          }
        }, 0);
      }

      function closeStudioPdfFocusViewer() {
        if (!isStudioPdfFocusOpen()) return false;
        if (document.fullscreenElement && studioPdfFocusDialogEl && studioPdfFocusDialogEl.contains(document.fullscreenElement)) {
          try {
            const exitResult = document.exitFullscreen && document.exitFullscreen();
            if (exitResult && typeof exitResult.catch === "function") exitResult.catch(() => {});
          } catch {}
        }
        if (studioPdfFocusOverlayEl) studioPdfFocusOverlayEl.hidden = true;
        restoreStudioPdfFocusMovedFrame();
        if (studioPdfFocusFrameEl) studioPdfFocusFrameEl.src = "about:blank";
        if (document.body) document.body.classList.remove("studio-pdf-focus-open");
        syncStudioPdfFocusFullscreenButton();
        const focusTarget = studioPdfFocusLastFocusedEl;
        studioPdfFocusLastFocusedEl = null;
        if (focusTarget && typeof focusTarget.focus === "function" && document.contains(focusTarget)) {
          window.setTimeout(() => focusTarget.focus(), 0);
        }
        return true;
      }

      function buildStudioPdfResourceUrl(options, useEditorResourceContext) {
        const token = getToken();
        if (!token) return "";
        const pdfPath = String(options && options.path ? options.path : "").trim();
        if (!pdfPath) return "";
        const effectivePath = getEffectiveSavePath();
        const sourcePath = useEditorResourceContext ? (effectivePath || sourceState.path || "") : "";
        const resourceDir = resourceDirInput && resourceDirInput.value.trim() ? resourceDirInput.value.trim() : "";
        const params = new URLSearchParams({ token, path: pdfPath });
        if (sourcePath) {
          params.set("sourcePath", sourcePath);
        } else if (resourceDir) {
          params.set("resourceDir", resourceDir);
        }
        return "/pdf-resource?" + params.toString();
      }

      function syncStudioPdfFocusFullscreenButton() {
        if (!studioPdfFocusFullscreenBtn) return;
        const isFullscreen = Boolean(document.fullscreenElement && studioPdfFocusDialogEl && document.fullscreenElement === studioPdfFocusDialogEl);
        studioPdfFocusFullscreenBtn.replaceChildren(makeStudioUiRefreshIcon(isFullscreen ? "fullscreen-exit" : "fullscreen"));
        const label = isFullscreen ? "Exit fullscreen" : "Fullscreen";
        studioPdfFocusFullscreenBtn.title = isFullscreen
          ? "Exit browser fullscreen and keep the PDF focus viewer open."
          : "Ask the browser to make this PDF viewer fullscreen.";
        studioPdfFocusFullscreenBtn.setAttribute("aria-label", label);
        studioPdfFocusFullscreenBtn.setAttribute("aria-pressed", isFullscreen ? "true" : "false");
      }

      function restoreStudioPdfFocusMovedFrame() {
        const state = studioPdfFocusMovedFrameState;
        studioPdfFocusMovedFrameState = null;
        if (!state || !state.frame) return;
        const frame = state.frame;
        frame.className = state.className;
        frame.style.cssText = state.styleCssText;
        if (state.title !== null) frame.setAttribute("title", state.title);
        else frame.removeAttribute("title");
        if (state.placeholder && state.placeholder.parentNode) {
          state.placeholder.parentNode.insertBefore(frame, state.placeholder);
          state.placeholder.remove();
        } else if (state.parent && state.parent.isConnected) {
          state.parent.insertBefore(frame, state.nextSibling && state.nextSibling.parentNode === state.parent ? state.nextSibling : null);
        }
      }

      function setStudioPdfFocusFrameSource(src, title, sourceFrame) {
        if (!studioPdfFocusFrameSlotEl || !studioPdfFocusFrameEl) return;
        restoreStudioPdfFocusMovedFrame();
        const sourceIframe = sourceFrame instanceof HTMLIFrameElement ? sourceFrame : null;
        if (sourceIframe && sourceIframe.isConnected) {
          const placeholder = document.createElement("span");
          placeholder.hidden = true;
          const parent = sourceIframe.parentNode;
          parent && parent.insertBefore(placeholder, sourceIframe);
          studioPdfFocusMovedFrameState = {
            frame: sourceIframe,
            parent,
            nextSibling: placeholder.nextSibling,
            placeholder,
            className: sourceIframe.className,
            styleCssText: sourceIframe.style.cssText,
            title: sourceIframe.getAttribute("title"),
          };
          if (studioPdfFocusFrameEl.parentNode) studioPdfFocusFrameEl.parentNode.removeChild(studioPdfFocusFrameEl);
          sourceIframe.classList.add("studio-pdf-focus-frame");
          sourceIframe.style.height = "auto";
          sourceIframe.style.flex = "1 1 auto";
          sourceIframe.title = String(title || "PDF focus viewer").trim() || "PDF focus viewer";
          studioPdfFocusFrameSlotEl.appendChild(sourceIframe);
          return;
        }
        if (!studioPdfFocusFrameEl.parentNode) studioPdfFocusFrameSlotEl.appendChild(studioPdfFocusFrameEl);
        studioPdfFocusFrameEl.src = src;
        studioPdfFocusFrameEl.title = String(title || "PDF focus viewer").trim() || "PDF focus viewer";
      }

      function openStudioPdfFocusFromButton(buttonEl) {
        if (!buttonEl) return false;
        const card = buttonEl.closest && buttonEl.closest(".studio-pdf-card");
        const viewerUrl = String(buttonEl.dataset && buttonEl.dataset.studioPdfViewerUrl ? buttonEl.dataset.studioPdfViewerUrl : "").trim()
          || String(card && card.dataset ? (card.dataset.studioPdfViewerUrl || "") : "").trim();
        const title = String(buttonEl.dataset && buttonEl.dataset.studioPdfTitle ? buttonEl.dataset.studioPdfTitle : "").trim()
          || String(card && card.dataset ? (card.dataset.studioPdfTitle || "") : "").trim()
          || "PDF preview";
        const sourceFrame = card && typeof card.querySelector === "function" ? card.querySelector("iframe.studio-pdf-frame") : null;
        if (!viewerUrl) return false;
        openStudioPdfFocusViewer(viewerUrl, title, sourceFrame);
        return true;
      }

      function handleStudioPdfFocusButtonClick(event) {
        const target = event && event.target;
        const buttonEl = target instanceof Element ? target.closest(".studio-pdf-card-focus") : null;
        if (!buttonEl) return;
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") {
          event.stopImmediatePropagation();
        }
        if (!openStudioPdfFocusFromButton(buttonEl)) {
          setStatus("Could not open PDF focus view for this card.", "warning");
        }
      }

      function createStudioPdfCard(block, useEditorResourceContext) {
        const options = block && block.options ? block.options : {};
        const path = String(options.path || "").trim();
        const title = String(options.title || path || "Embedded PDF").trim();
        const caption = String(options.caption || "").trim();
        const height = normalizeStudioPdfHeight(options.height);
        const page = normalizeStudioPdfPage(options.page);
        const resourceUrl = buildStudioPdfResourceUrl(options, useEditorResourceContext);
        const viewerUrl = resourceUrl && page ? resourceUrl + "#page=" + encodeURIComponent(String(page)) : resourceUrl;

        const card = document.createElement("figure");
        card.className = "studio-pdf-card";
        if (card.dataset) {
          card.dataset.studioPdfViewerUrl = viewerUrl || "";
          card.dataset.studioPdfTitle = title;
        }

        const header = document.createElement("figcaption");
        header.className = "studio-pdf-card-header";

        const titleGroup = document.createElement("div");
        titleGroup.className = "studio-pdf-card-title-group";
        if (resourceUrl) {
          const focusBtn = document.createElement("button");
          focusBtn.type = "button";
          focusBtn.className = "studio-pdf-card-action studio-pdf-card-focus";
          focusBtn.title = "Open this PDF in a larger Studio overlay.";
          focusBtn.setAttribute("aria-label", "Focus PDF");
          if (focusBtn.dataset) {
            focusBtn.dataset.studioPdfViewerUrl = viewerUrl;
            focusBtn.dataset.studioPdfTitle = title;
          }
          focusBtn.appendChild(makeStudioUiRefreshIcon("focus"));
          focusBtn.addEventListener("click", handleStudioPdfFocusButtonClick);
          titleGroup.appendChild(focusBtn);
        }
        const label = document.createElement("div");
        label.className = "studio-pdf-card-title";
        label.textContent = title;
        titleGroup.appendChild(label);
        header.appendChild(titleGroup);

        if (resourceUrl) {
          const actions = document.createElement("div");
          actions.className = "studio-pdf-card-actions";

          const openLink = document.createElement("a");
          openLink.className = "studio-pdf-card-link studio-pdf-card-action";
          openLink.href = viewerUrl;
          openLink.target = "_blank";
          openLink.rel = "noopener noreferrer";
          openLink.textContent = "Open PDF";
          actions.appendChild(openLink);

          header.appendChild(actions);
        }
        card.appendChild(header);

        if (caption) {
          const captionEl = document.createElement("div");
          captionEl.className = "studio-pdf-card-caption";
          captionEl.textContent = caption;
          card.appendChild(captionEl);
        }

        if (!resourceUrl) {
          const errorEl = document.createElement("div");
          errorEl.className = "studio-pdf-card-error";
          errorEl.textContent = "PDF block needs a local path.";
          card.appendChild(errorEl);
          return card;
        }

        const iframe = document.createElement("iframe");
        iframe.className = "studio-pdf-frame";
        iframe.src = viewerUrl;
        iframe.title = title;
        iframe.loading = "lazy";
        iframe.style.height = height + "px";
        card.appendChild(iframe);
        return card;
      }

      function renderStudioPdfBlocksInElement(targetEl, blocks, useEditorResourceContext) {
        if (!targetEl || !Array.isArray(blocks) || blocks.length === 0) return;
        const candidates = Array.from(targetEl.querySelectorAll("p, pre, div"));
        blocks.forEach((block) => {
          const placeholder = block && block.placeholder ? block.placeholder : "";
          if (!placeholder) return;
          const match = candidates.find((el) => String(el.textContent || "").trim() === placeholder);
          if (match && match.parentNode) {
            match.replaceWith(createStudioPdfCard(block, useEditorResourceContext));
          }
        });
      }

      function sanitizeRenderedHtml(html, markdown, options) {
        const rawHtml = typeof html === "string" ? html : "";
        const mathAnnotationPreserved = rawHtml.replace(/<math\b([^>]*)>([\s\S]*?)<\/math>/gi, (match, attrs, inner) => {
          const texAnnotationMatch = String(inner || "").match(/<annotation\b[^>]*encoding="application\/x-tex"[^>]*>([\s\S]*?)<\/annotation>/i);
          const texSource = texAnnotationMatch ? String(texAnnotationMatch[1] || "").trim() : "";
          const cleanedInner = String(inner || "")
            .replace(/<annotation-xml\b[\s\S]*?<\/annotation-xml>/gi, "")
            .replace(/<annotation\b[\s\S]*?<\/annotation>/gi, "");
          const texAttr = texSource ? (" data-tex-source=\"" + escapeHtml(texSource) + "\"") : "";
          return "<math" + attrs + texAttr + ">" + cleanedInner + "</math>";
        });

        if (window.DOMPurify && typeof window.DOMPurify.sanitize === "function") {
          return window.DOMPurify.sanitize(mathAnnotationPreserved, {
            USE_PROFILES: {
              html: true,
              mathMl: true,
              svg: true,
            },
            ADD_TAGS: ["embed"],
            ADD_ATTR: ["src", "type", "title", "width", "height", "style", "data-fig-align", "data-tex-source"],
            ADD_DATA_URI_TAGS: ["embed"],
          });
        }
        return buildPreviewErrorHtml("Preview sanitizer unavailable. Showing plain markdown.", markdown, options);
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
          entry.renderTarget.setAttribute("data-tex-source", entry.tex);
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

      function handleTracePaneScroll() {
        if (rightView === "trace") {
          traceAutoScroll = shouldStickTraceToBottom();
          return;
        }
        if (rightView === "repl") {
          replFollow = shouldStickTraceToBottom();
        }
      }

      async function handleTracePaneClick(event) {
        if (rightView !== "trace") return;
        const target = event.target;
        const filterBtn = target instanceof Element ? target.closest("[data-trace-filter]") : null;
        if (filterBtn) {
          event.preventDefault();
          const nextFilter = filterBtn.getAttribute("data-trace-filter") || "all";
          setTraceFilter(nextFilter);
          return;
        }
        const outputToggleBtn = target instanceof Element ? target.closest("[data-trace-output-key]") : null;
        if (outputToggleBtn) {
          event.preventDefault();
          const key = outputToggleBtn.getAttribute("data-trace-output-key") || "";
          if (key) {
            if (traceExpandedOutputs.has(key)) {
              traceExpandedOutputs.delete(key);
            } else {
              traceExpandedOutputs.add(key);
            }
            traceAutoScroll = false;
            renderTraceViewIfActive();
          }
          return;
        }
        const actionBtn = target instanceof Element ? target.closest("[data-trace-action]") : null;
        if (!actionBtn) return;
        event.preventDefault();
        const action = actionBtn.getAttribute("data-trace-action") || "";
        if (action === "copy") {
          await copyVisibleWorkingToClipboard();
          return;
        }
        if (action === "load") {
          loadVisibleWorkingIntoEditor();
        }
      }

      function handleReplPaneClick(event) {
        if (rightView !== "repl") return;
        const target = event.target;
        const actionBtn = target instanceof Element ? target.closest("[data-repl-action]") : null;
        if (!actionBtn) return;
        event.preventDefault();
        const action = actionBtn.getAttribute("data-repl-action") || "";
        if (action === "start" || action === "new-session") {
          const requestId = makeRequestId();
          replBusy = true;
          replError = "";
          replMessage = (action === "new-session" ? "Starting new " : "Starting ") + replRuntime + " REPL…";
          syncActionButtons();
          renderReplViewIfActive({ force: true });
          if (!sendMessage({ type: "repl_start_request", requestId, runtime: replRuntime, newSession: action === "new-session" })) {
            replBusy = false;
            syncActionButtons();
          }
          return;
        }
        if (action === "stop-session") {
          const session = getActiveReplSession();
          if (!session) {
            setStatus("Start or select a REPL session first.", "warning");
            return;
          }
          const requestId = makeRequestId();
          replBusy = true;
          replError = "";
          replMessage = "Stopping " + session.sessionName + "…";
          syncActionButtons();
          renderReplViewIfActive({ force: true });
          if (!sendMessage({ type: "repl_stop_request", requestId, sessionName: session.sessionName })) {
            replBusy = false;
            syncActionButtons();
          }
          return;
        }
        if (action === "interrupt") {
          const session = getActiveReplSession();
          if (!session) {
            setStatus("Start or select a REPL session first.", "warning");
            return;
          }
          const requestId = makeRequestId();
          replBusy = true;
          replError = "";
          replMessage = "Interrupting REPL…";
          syncActionButtons();
          renderReplViewIfActive({ force: true });
          if (!sendMessage({ type: "repl_interrupt_request", requestId, sessionName: session.sessionName })) {
            replBusy = false;
            syncActionButtons();
          }
          return;
        }
        if (action === "copy-attach-command") {
          const session = getActiveReplSession();
          const text = getReplAttachCommand(session);
          if (!text.trim()) {
            setStatus("Start or select a REPL session first.", "warning");
            return;
          }
          void writeTextToClipboard(text).then((ok) => {
            setStatus(ok ? "Copied tmux attach command." : "Clipboard write failed.", ok ? "success" : "warning");
          });
          return;
        }
        if (action === "run-all-chunks") {
          sendEditorTextToRepl({ action: "all-chunks" });
          return;
        }
        if (action === "journal-note") {
          sendEditorTextToRepl({ action: "note" });
          return;
        }
        if (action === "journal-toggle") {
          setReplJournalCollapsed(!replJournalCollapsed);
          return;
        }
        if (action === "mirror-toggle") {
          setReplMirrorCollapsed(!replMirrorCollapsed);
          return;
        }
        if (action === "load-journal") {
          loadReplJournalIntoEditor();
          return;
        }
        if (action === "copy-journal") {
          void copyReplJournalToClipboard();
          return;
        }
        if (action === "export-journal") {
          exportReplJournalMarkdown();
          return;
        }
        if (action === "clear-journal") {
          clearReplJournal();
          return;
        }
        if (action === "refresh") {
          replError = "";
          replMessage = "";
          requestReplCapture();
          return;
        }
        if (action === "follow") {
          replFollow = !replFollow;
          renderReplViewIfActive({ force: true });
        }
      }

      function handleReplPaneChange(event) {
        if (rightView !== "repl") return;
        const target = event.target;
        if (!(target instanceof Element)) return;
        const runtimeSelect = target.closest("[data-repl-runtime]");
        if (runtimeSelect && "value" in runtimeSelect) {
          setReplRuntime(runtimeSelect.value);
          renderReplViewIfActive({ force: true });
          return;
        }
        const sessionSelect = target.closest("[data-repl-session]");
        if (sessionSelect && "value" in sessionSelect) {
          setActiveReplSession(sessionSelect.value);
          replError = "";
          replMessage = "";
          replFollow = true;
          requestReplCapture();
          renderReplViewIfActive({ force: true });
        }
      }

      function attachResponsePaneInteractionHandlers() {
        if (!critiqueViewEl) return;
        critiqueViewEl.addEventListener("scroll", handleTracePaneScroll);
        critiqueViewEl.addEventListener("click", handleTracePaneClick);
        critiqueViewEl.addEventListener("click", handleReplPaneClick);
        critiqueViewEl.addEventListener("change", handleReplPaneChange);
      }

      function replaceResponsePaneWithClone() {
        const currentEl = critiqueViewEl;
        if (!currentEl || !currentEl.parentNode || typeof currentEl.cloneNode !== "function") {
          return currentEl;
        }

        const replacement = currentEl.cloneNode(true);
        if (!replacement || replacement.nodeType !== 1) {
          return currentEl;
        }

        currentEl.parentNode.replaceChild(replacement, currentEl);
        critiqueViewEl = replacement;
        attachResponsePaneInteractionHandlers();
        return critiqueViewEl;
      }

      function applyPendingResponseScrollReset() {
        if (!pendingResponseScrollReset || !critiqueViewEl) return false;
        if (rightView === "editor-preview") return false;

        pendingResponseScrollReset = false;
        let targetEl = replaceResponsePaneWithClone();
        const schedule = typeof window.requestAnimationFrame === "function"
          ? window.requestAnimationFrame.bind(window)
          : (cb) => window.setTimeout(cb, 16);
        const resetScroll = () => {
          if (!targetEl || !targetEl.isConnected) return;
          if (rightView === "editor-preview") return;
          targetEl.scrollTop = 0;
          targetEl.scrollLeft = 0;
        };

        if (targetEl && targetEl.classList) {
          targetEl.classList.add("response-scroll-resetting");
        }

        resetScroll();
        schedule(() => {
          resetScroll();
          schedule(() => {
            resetScroll();
            if (targetEl && targetEl.classList) {
              targetEl.classList.remove("response-scroll-resetting");
            }
          });
        });
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

      async function renderMarkdownWithPandoc(markdown, options) {
        const token = getToken();
        if (!token) {
          throw new Error("Missing Studio token in URL.");
        }

        if (typeof fetch !== "function") {
          throw new Error("Browser fetch API is unavailable.");
        }

        const controller = typeof AbortController === "function" ? new AbortController() : null;
        const timeoutId = controller ? window.setTimeout(() => controller.abort(), 8000) : null;

        const previewOptions = options && typeof options === "object" ? options : {};

        let response;
        try {
          const effectivePath = getEffectiveSavePath();
          const sourcePath = effectivePath || sourceState.path || "";
          const payload = {
            markdown: String(markdown || ""),
            sourcePath: sourcePath,
            resourceDir: (!sourcePath && resourceDirInput) ? resourceDirInput.value.trim() : "",
          };
          if (previewOptions.includeEditorLanguage) {
            payload.editorLanguage = String(editorLanguage || "");
          }
          response = await fetch("/render-preview?token=" + encodeURIComponent(token), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
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

      async function fetchWithTimeout(url, options, timeoutMs, timeoutLabel) {
        if (typeof AbortController === "undefined") return fetch(url, options);
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || PDF_EXPORT_FETCH_TIMEOUT_MS));
        try {
          return await fetch(url, { ...(options || {}), signal: controller.signal });
        } catch (error) {
          if (error && error.name === "AbortError") {
            throw new Error((timeoutLabel || "Request") + " timed out. Try a smaller export or check the PDF toolchain.");
          }
          throw error;
        } finally {
          window.clearTimeout(timer);
        }
      }

      async function exportRightPanePdf() {
        if (uiBusy || previewExportInProgress) {
          setStatus("Studio is busy.", "warning");
          return;
        }

        const token = getToken();
        if (!token) {
          setStatus("Missing Studio token in URL. Re-run /studio.", "error");
          return;
        }

        const exportingReplJournal = rightView === "repl";
        const rightPaneShowsPreview = rightView === "preview" || rightView === "editor-preview";
        if (!rightPaneShowsPreview && !exportingReplJournal) {
          setStatus("Switch right pane to Response (Preview), Editor (Preview), or REPL Studio to export PDF.", "warning");
          return;
        }
        const replJournalExportEntries = exportingReplJournal ? getVisibleReplJournalEntries() : [];
        if (exportingReplJournal && !replJournalExportEntries.length) {
          setStatus("No REPL Studio entries to export for this session yet.", "warning");
          return;
        }

        const htmlArtifactSource = exportingReplJournal ? "" : getRightPaneHtmlArtifactSource();
        if (htmlArtifactSource) {
          setStatus("PDF export does not support interactive HTML previews yet. Export as HTML or use the browser print dialog inside the preview.", "warning");
          return;
        }

        const markdown = exportingReplJournal
          ? buildReplJournalMarkdown(replJournalExportEntries)
          : (rightView === "editor-preview"
            ? prepareEditorTextForPdfExport(sourceTextEl.value)
            : prepareEditorTextForPreview(latestResponseMarkdown));
        if (!markdown || !markdown.trim()) {
          setStatus("Nothing to export yet.", "warning");
          return;
        }

        const effectivePath = getEffectiveSavePath();
        const sourcePath = exportingReplJournal ? "" : (effectivePath || sourceState.path || "");
        const resourceDir = (!sourcePath && resourceDirInput) ? resourceDirInput.value.trim() : "";
        const isEditorPreview = rightView === "editor-preview";
        const editorPdfLanguage = isEditorPreview ? normalizeFenceLanguage(editorLanguage || "") : "";
        const isLatex = isEditorPreview
          ? editorPdfLanguage === "latex"
          : /\\documentclass\b|\\begin\{document\}/.test(markdown);
        let filenameHint = exportingReplJournal ? "repl-studio.pdf" : (isEditorPreview ? "studio-editor-preview.pdf" : "studio-response-preview.pdf");
        if (sourcePath) {
          const baseName = sourcePath.split(/[\\/]/).pop() || "studio";
          const stem = baseName.replace(/\.[^.]+$/, "") || "studio";
          filenameHint = stem + "-preview.pdf";
        }

        previewExportInProgress = true;
        updateResultActionButtons();
        setStatus("Exporting PDF…", "warning");

        try {
          const response = await fetchWithTimeout("/export-pdf?token=" + encodeURIComponent(token), {
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
          }, PDF_EXPORT_FETCH_TIMEOUT_MS, "PDF export");

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
          previewExportInProgress = false;
          updateResultActionButtons();
        }
      }

      async function exportRightPaneHtml() {
        if (uiBusy || previewExportInProgress) {
          setStatus("Studio is busy.", "warning");
          return;
        }

        const token = getToken();
        if (!token) {
          setStatus("Missing Studio token in URL. Re-run /studio.", "error");
          return;
        }

        const exportingReplJournal = rightView === "repl";
        const rightPaneShowsPreview = rightView === "preview" || rightView === "editor-preview";
        if (!rightPaneShowsPreview && !exportingReplJournal) {
          setStatus("Switch right pane to Response (Preview), Editor (Preview), or REPL Studio to export HTML.", "warning");
          return;
        }
        const replJournalExportEntries = exportingReplJournal ? getVisibleReplJournalEntries() : [];
        if (exportingReplJournal && !replJournalExportEntries.length) {
          setStatus("No REPL Studio entries to export for this session yet.", "warning");
          return;
        }

        const htmlArtifactSource = exportingReplJournal ? "" : getRightPaneHtmlArtifactSource();
        const markdown = exportingReplJournal ? buildReplJournalMarkdown(replJournalExportEntries) : (htmlArtifactSource || (rightView === "editor-preview"
          ? prepareEditorTextForHtmlExport(sourceTextEl.value)
          : prepareEditorTextForPreview(latestResponseMarkdown)));
        if (!markdown || !markdown.trim()) {
          setStatus("Nothing to export yet.", "warning");
          return;
        }

        const effectivePath = getEffectiveSavePath();
        const sourcePath = exportingReplJournal ? "" : (effectivePath || sourceState.path || "");
        const resourceDir = (!sourcePath && resourceDirInput) ? resourceDirInput.value.trim() : "";
        const isEditorPreview = rightView === "editor-preview";
        const editorHtmlLanguage = htmlArtifactSource ? "html" : (isEditorPreview ? normalizeFenceLanguage(editorLanguage || "") : "");
        const isLatex = htmlArtifactSource ? false : (isEditorPreview
          ? editorHtmlLanguage === "latex"
          : /\\documentclass\b|\\begin\{document\}/.test(markdown));
        let filenameHint = exportingReplJournal ? "repl-studio.html" : (isEditorPreview ? "studio-editor-preview.html" : "studio-response-preview.html");
        let titleHint = exportingReplJournal ? "REPL Studio" : (isEditorPreview ? "Studio editor preview" : "Studio response preview");
        if (sourcePath) {
          const baseName = sourcePath.split(/[\\/]/).pop() || "studio";
          const stem = baseName.replace(/\.[^.]+$/, "") || "studio";
          filenameHint = stem + "-preview.html";
          titleHint = stem + " preview";
        }

        previewExportInProgress = true;
        updateResultActionButtons();
        setStatus("Exporting HTML…", "warning");

        try {
          const response = await fetchWithTimeout("/export-html?token=" + encodeURIComponent(token), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              markdown: String(markdown || ""),
              sourcePath: sourcePath,
              resourceDir: resourceDir,
              isLatex: isLatex,
              editorHtmlLanguage: editorHtmlLanguage,
              filenameHint: filenameHint,
              title: titleHint,
            }),
          }, HTML_EXPORT_FETCH_TIMEOUT_MS, "HTML export");

          const contentType = String(response.headers.get("content-type") || "").toLowerCase();
          if (!response.ok) {
            let message = "HTML export failed with HTTP " + response.status + ".";
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
              throw new Error("HTML export prepared successfully, but Studio did not receive a download URL.");
            }

            const exportWarning = typeof payload.warning === "string" ? payload.warning.trim() : "";
            const openError = typeof payload.openError === "string" ? payload.openError.trim() : "";
            const openedExternal = payload.openedExternal === true;
            let downloadName = typeof payload.filename === "string" && payload.filename.trim()
              ? payload.filename.trim()
              : (filenameHint || "studio-preview.html");
            if (!/\.html?$/i.test(downloadName)) {
              downloadName += ".html";
            }

            if (openedExternal) {
              if (exportWarning) {
                setStatus("Opened HTML in default browser with warning: " + exportWarning, "warning");
              } else {
                setStatus("Opened HTML in default browser: " + downloadName, "success");
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
              setStatus("Exported HTML with warning: " + exportWarning, "warning");
            } else {
              setStatus("Exported HTML: " + downloadName, "success");
            }
            return;
          }

          const exportWarning = String(response.headers.get("x-pi-studio-export-warning") || "").trim();
          const blob = await response.blob();
          const headerFilename = parseContentDispositionFilename(response.headers.get("content-disposition"));
          let downloadName = headerFilename || filenameHint || "studio-preview.html";
          if (!/\.html?$/i.test(downloadName)) {
            downloadName += ".html";
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
            setStatus("Exported HTML with warning: " + exportWarning, "warning");
          } else {
            setStatus("Exported HTML: " + downloadName, "success");
          }
        } catch (error) {
          const detail = error && error.message ? error.message : String(error || "unknown error");
          setStatus("HTML export failed: " + detail, "error");
        } finally {
          previewExportInProgress = false;
          updateResultActionButtons();
        }
      }

      function closeExportPreviewMenu() {
        if (!exportPreviewMenuEl) return;
        exportPreviewMenuEl.hidden = true;
        if (exportPdfBtn) {
          exportPdfBtn.classList.remove("is-open");
          exportPdfBtn.setAttribute("aria-expanded", "false");
        }
      }

      function toggleExportPreviewMenu() {
        if (!exportPreviewMenuEl || !exportPdfBtn || exportPdfBtn.disabled) return;
        if (typeof closeStudioUiRefreshMenus === "function") {
          closeStudioUiRefreshMenus();
        }
        const willOpen = exportPreviewMenuEl.hidden;
        exportPreviewMenuEl.hidden = !willOpen;
        exportPdfBtn.classList.toggle("is-open", willOpen);
        exportPdfBtn.setAttribute("aria-expanded", willOpen ? "true" : "false");
      }

      function exportRightPaneFormat(format) {
        closeExportPreviewMenu();
        if (format === "html") {
          return exportRightPaneHtml();
        }
        return exportRightPanePdf();
      }

      function normalizeCopyableBlockText(text) {
        return String(text || "").replace(/\r\n/g, "\n").replace(/\u200b/g, "");
      }

      function getCopyableBlockquoteText(blockEl) {
        const clone = blockEl && typeof blockEl.cloneNode === "function" ? blockEl.cloneNode(true) : null;
        const sourceEl = clone && typeof clone.querySelectorAll === "function" ? clone : blockEl;
        if (!sourceEl) return "";
        if (typeof sourceEl.querySelectorAll === "function") {
          Array.from(sourceEl.querySelectorAll(".studio-copy-block-btn")).forEach((buttonEl) => {
            if (buttonEl && buttonEl.parentNode) buttonEl.parentNode.removeChild(buttonEl);
          });
        }

        const blockTags = new Set(["ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DIV", "FIGCAPTION", "FIGURE", "FOOTER", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "LI", "OL", "P", "PRE", "SECTION", "TABLE", "TBODY", "TD", "TH", "THEAD", "TR", "UL"]);
        const isElementBlock = (node) => node && node.nodeType === 1 && blockTags.has(String(node.tagName || "").toUpperCase());

        const collectInlineText = (node) => {
          if (!node) return "";
          if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || "";
          if (node.nodeType !== Node.ELEMENT_NODE) return "";
          const tag = String(node.tagName || "").toUpperCase();
          if (tag === "SCRIPT" || tag === "STYLE" || tag === "BUTTON") return "";
          if (tag === "BR") return "\n";
          const childText = Array.from(node.childNodes || []).map(collectInlineText).join("");
          return isElementBlock(node) ? childText.trim() : childText;
        };

        const collectBlocks = (node) => {
          if (!node) return [];
          const parts = [];
          let inlineBuffer = "";
          const flushInline = () => {
            const text = inlineBuffer.replace(/[ \t]+\n/g, "\n").trim();
            if (text) parts.push(text);
            inlineBuffer = "";
          };

          Array.from(node.childNodes || []).forEach((child) => {
            if (child.nodeType === Node.TEXT_NODE) {
              inlineBuffer += child.nodeValue || "";
              return;
            }
            if (child.nodeType !== Node.ELEMENT_NODE) return;
            const tag = String(child.tagName || "").toUpperCase();
            if (tag === "SCRIPT" || tag === "STYLE" || tag === "BUTTON") return;
            if (tag === "BR") {
              inlineBuffer += "\n";
              return;
            }
            if (isElementBlock(child)) {
              flushInline();
              if (tag === "UL" || tag === "OL") {
                Array.from(child.children || []).forEach((item, itemIndex) => {
                  if (!item || String(item.tagName || "").toUpperCase() !== "LI") return;
                  const prefix = tag === "OL" ? (String(itemIndex + 1) + ". ") : "- ";
                  const itemText = collectInlineText(item).trim();
                  if (itemText) parts.push(prefix + itemText);
                });
                return;
              }
              const blockText = tag === "BLOCKQUOTE"
                ? collectBlocks(child).join("\n\n").trim()
                : collectInlineText(child).trim();
              if (blockText) parts.push(blockText);
              return;
            }
            inlineBuffer += collectInlineText(child);
          });
          flushInline();
          return parts;
        };

        return normalizeCopyableBlockText(collectBlocks(sourceEl).join("\n\n")).trim();
      }

      function getCopyablePreviewBlockText(blockEl) {
        if (!blockEl || typeof blockEl.querySelectorAll !== "function") return "";
        if (blockEl.classList && blockEl.classList.contains("preview-code-lines")) {
          return normalizeCopyableBlockText(
            Array.from(blockEl.querySelectorAll(".preview-code-line-content"))
              .map((lineEl) => lineEl && typeof lineEl.textContent === "string" ? lineEl.textContent : "")
              .join("\n"),
          );
        }

        if (blockEl.matches && blockEl.matches("blockquote")) {
          return getCopyableBlockquoteText(blockEl);
        }

        const codeEl = typeof blockEl.querySelector === "function"
          ? blockEl.querySelector("pre code, code")
          : null;
        if (codeEl && typeof codeEl.textContent === "string") {
          return normalizeCopyableBlockText(codeEl.textContent);
        }

        const clone = typeof blockEl.cloneNode === "function" ? blockEl.cloneNode(true) : null;
        if (clone && typeof clone.querySelectorAll === "function") {
          Array.from(clone.querySelectorAll(".studio-copy-block-btn")).forEach((buttonEl) => {
            if (buttonEl && buttonEl.parentNode) buttonEl.parentNode.removeChild(buttonEl);
          });
          return normalizeCopyableBlockText(clone.textContent || "");
        }

        return normalizeCopyableBlockText(blockEl.textContent || "");
      }

      async function handleCopyPreviewBlockButtonClick(event) {
        const target = event && event.target;
        const copyBtn = target instanceof Element ? target.closest(".studio-copy-block-btn") : null;
        if (!copyBtn) return;
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") {
          event.stopImmediatePropagation();
        }

        const blockEl = copyBtn.closest(".studio-copyable-block");
        if (!blockEl) {
          setStatus("Could not find the block to copy.", "warning");
          return;
        }

        const text = getCopyablePreviewBlockText(blockEl);
        if (!text.trim()) {
          setStatus("Nothing to copy from this block.", "warning");
          return;
        }

        if (copyBtn.dataset && copyBtn.dataset.studioCopyBusy === "1") return;
        if (copyBtn.dataset) copyBtn.dataset.studioCopyBusy = "1";
        const ok = await writeTextToClipboard(text);
        if (ok) {
          setStatus("Copied block to clipboard.", "success");
        } else {
          setStatus("Clipboard write failed.", "warning");
        }
        if (copyBtn.dataset) {
          window.setTimeout(() => {
            if (copyBtn.dataset) copyBtn.dataset.studioCopyBusy = "0";
          }, 150);
        }
      }

      function decorateCopyablePreviewBlocks(targetEl) {
        if (!targetEl || typeof targetEl.querySelectorAll !== "function") return;
        const blocks = Array.from(targetEl.querySelectorAll("div.sourceCode, pre, .preview-code-lines, blockquote"));
        blocks.forEach((blockEl) => {
          if (!blockEl || !(blockEl instanceof Element)) return;
          if (blockEl.dataset && blockEl.dataset.studioCopyDecorated === "1") return;
          if (blockEl.matches && blockEl.matches("pre") && blockEl.closest("div.sourceCode")) return;
          if (blockEl.closest && blockEl.closest("button, .studio-copy-block-btn")) return;

          const initialText = getCopyablePreviewBlockText(blockEl);
          if (!initialText.trim()) return;

          blockEl.classList.add("studio-copyable-block");
          if (blockEl.dataset) blockEl.dataset.studioCopyDecorated = "1";

          const copyBtn = document.createElement("button");
          copyBtn.type = "button";
          copyBtn.className = "studio-copy-block-btn";
          copyBtn.textContent = "Copy";
          copyBtn.title = "Copy this block to the clipboard.";
          copyBtn.setAttribute("aria-label", "Copy this block to the clipboard");
          copyBtn.addEventListener("pointerdown", (event) => {
            event.stopPropagation();
          });
          copyBtn.addEventListener("mousedown", (event) => {
            event.stopPropagation();
          });

          blockEl.appendChild(copyBtn);
        });
      }

      async function applyRenderedMarkdown(targetEl, markdown, pane, nonce) {
        const previewPrepared = annotationsEnabled
          ? prepareMarkdownForPandocPreview(markdown)
          : { markdown: stripAnnotationMarkers(String(markdown || "")), placeholders: [] };
        const previewingEditorText = pane === "source" || rightView === "editor-preview";
        const previewFallbackOptions = {
          stripMarkdownHtmlComments: !previewingEditorText || editorLanguage !== "latex",
        };
        const pdfPrepared = prepareStudioPdfBlocksForPreview(previewPrepared.markdown);

        try {
          const renderedHtml = await renderMarkdownWithPandoc(pdfPrepared.markdown, {
            includeEditorLanguage: pane === "source" || rightView === "editor-preview",
          });

          if (pane === "source") {
            if (nonce !== sourcePreviewRenderNonce || editorView !== "preview") return;
          } else {
            if (nonce !== responsePreviewRenderNonce || (rightView !== "preview" && rightView !== "editor-preview")) return;
          }

          clearPreviewJumpHighlight(targetEl);
          finishPreviewRender(targetEl);
          targetEl.innerHTML = sanitizeRenderedHtml(renderedHtml, markdown, previewFallbackOptions);
          renderStudioPdfBlocksInElement(targetEl, pdfPrepared.blocks, previewingEditorText);
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

          const shouldDecoratePreviewComments = supportsPreviewCommentsForCurrentEditor()
            && (
              (pane === "source" && editorView === "preview")
              || (pane === "response" && rightView === "editor-preview")
            );
          if (shouldDecoratePreviewComments) {
            decorateRenderedEditorPreviewComments(targetEl, sourceTextEl.value || "");
          }
          decorateCopyablePreviewBlocks(targetEl);

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
          clearPreviewJumpHighlight(targetEl);
          finishPreviewRender(targetEl);
          targetEl.innerHTML = buildPreviewErrorHtml("Preview renderer unavailable (" + detail + "). Showing plain markdown.", markdown, previewFallbackOptions);
          if (pane === "response") {
            applyPendingResponseScrollReset();
            scheduleResponsePaneRepaintNudge();
          }
        }
      }

      function renderSourcePreviewNow() {
        if (editorView !== "preview") return;
        const text = prepareEditorTextForPreview(sourceTextEl.value || "");
        if (isHtmlArtifactPreviewText(text, editorLanguage)) {
          renderHtmlArtifactPreview(sourcePreviewEl, text, "source", { title: "Editor HTML preview" });
          return;
        }
        if (supportsCodePreviewCommentsForCurrentEditor()) {
          renderCodePreviewWithCommentBlocks(sourcePreviewEl, text, "source");
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
        if (editorView === "markdown") {
          scheduleEditorLineNumberRender();
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

      function shouldStickTraceToBottom() {
        if (!critiqueViewEl) return true;
        const remaining = critiqueViewEl.scrollHeight - critiqueViewEl.scrollTop - critiqueViewEl.clientHeight;
        return remaining < 56;
      }

      function getActiveReplJournalSessionName() {
        return String(replActiveSessionName || "").trim();
      }

      function getVisibleReplJournalEntries() {
        const sessionName = getActiveReplJournalSessionName();
        if (!sessionName) return replJournalEntries;
        return replJournalEntries.filter((entry) => entry.sessionName === sessionName);
      }

      function getHiddenReplJournalEntryCount() {
        const sessionName = getActiveReplJournalSessionName();
        if (!sessionName) return 0;
        return replJournalEntries.filter((entry) => entry.sessionName && entry.sessionName !== sessionName).length;
      }

      function isReplJournalExpanded() {
        return rightView === "repl" && !replJournalCollapsed && getVisibleReplJournalEntries().length > 0;
      }

      function shouldAutoStickReplView() {
        if (!critiqueViewEl) return true;
        if (isReplJournalExpanded()) return shouldStickTraceToBottom();
        return replFollow || shouldStickTraceToBottom();
      }

      function formatTraceOutputSize(text) {
        const value = String(text || "");
        const chars = value.length;
        const lines = value ? value.split(/\n/).length : 0;
        const compactChars = chars >= 1000 ? ((chars / 1000).toFixed(chars >= 10_000 ? 0 : 1) + "k") : String(chars);
        return lines + " line" + (lines === 1 ? "" : "s") + ", " + compactChars + " chars";
      }

      function getTraceOutputPreview(text) {
        const value = String(text || "");
        const lines = value.split(/\n/);
        let preview = value;
        let truncated = false;
        if (lines.length > TRACE_OUTPUT_PREVIEW_MAX_LINES) {
          preview = lines.slice(0, TRACE_OUTPUT_PREVIEW_MAX_LINES).join("\n");
          truncated = true;
        }
        if (preview.length > TRACE_OUTPUT_PREVIEW_MAX_CHARS) {
          preview = preview.slice(0, TRACE_OUTPUT_PREVIEW_MAX_CHARS);
          truncated = true;
        }
        if (!truncated && value.length <= TRACE_OUTPUT_PREVIEW_MAX_CHARS) {
          return { text: value, truncated: false, hiddenChars: 0, hiddenLines: 0 };
        }
        if (!truncated && value.length > TRACE_OUTPUT_PREVIEW_MAX_CHARS) {
          preview = value.slice(0, TRACE_OUTPUT_PREVIEW_MAX_CHARS);
          truncated = true;
        }
        const hiddenChars = Math.max(0, value.length - preview.length);
        const previewLineCount = preview ? preview.split(/\n/).length : 0;
        const hiddenLines = Math.max(0, lines.length - previewLineCount);
        return { text: preview, truncated: true, hiddenChars, hiddenLines };
      }

      function renderTraceOutput(text, outputKey) {
        const value = String(text || "");
        const key = String(outputKey || "trace-output");
        const isExpanded = traceExpandedOutputs.has(key);
        const preview = getTraceOutputPreview(value);
        const visibleText = isExpanded || !preview.truncated ? value : preview.text;
        const body = "<pre class='plain-markdown trace-output'>" + escapeHtml(visibleText) + "</pre>";
        if (!preview.truncated) return body;

        const hiddenParts = [];
        if (preview.hiddenLines > 0) hiddenParts.push(preview.hiddenLines + " more line" + (preview.hiddenLines === 1 ? "" : "s"));
        if (preview.hiddenChars > 0) hiddenParts.push(formatCompactNumber(preview.hiddenChars) + " chars hidden");
        const summary = isExpanded
          ? "Showing full output (" + formatTraceOutputSize(value) + ")."
          : "Output truncated — " + (hiddenParts.join(", ") || "more hidden") + ".";
        const buttonLabel = isExpanded ? "Collapse" : "Show full";
        return "<div class='trace-output-wrap" + (isExpanded ? " is-expanded" : " is-truncated") + "'>"
          + body
          + "<div class='trace-output-truncation'>"
          + "<span>" + escapeHtml(summary) + "</span>"
          + "<button type='button' class='trace-output-toggle' data-trace-output-key='" + escapeHtml(key) + "' aria-expanded='" + (isExpanded ? "true" : "false") + "'>" + escapeHtml(buttonLabel) + "</button>"
          + "</div>"
          + "</div>";
      }

      function renderTraceImages(images) {
        const normalizedImages = Array.isArray(images)
          ? images.map((image, index) => normalizeTraceImage(image, index)).filter(Boolean)
          : [];
        if (!normalizedImages.length) return "";
        const cards = normalizedImages.map((image) => {
          const src = "data:" + image.mimeType + ";base64," + image.data;
          const caption = describeTraceImageForText(image);
          const alt = image.label || ("Working output image: " + image.mimeType);
          return "<figure class='trace-image-card'>"
            + "<img src='" + escapeHtml(src) + "' alt='" + escapeHtml(alt) + "' loading='lazy' decoding='async' />"
            + "<figcaption class='trace-image-caption'>" + escapeHtml(caption) + "</figcaption>"
            + "</figure>";
        }).join("");
        return "<div class='trace-image-gallery'>" + cards + "</div>";
      }

      function getReplRuntimeHighlightLanguage(runtime) {
        const normalized = normalizeReplRuntime(runtime || getActiveReplRuntime());
        if (normalized === "shell") return "bash";
        if (normalized === "ipython") return "python";
        if (normalized === "python" || normalized === "julia" || normalized === "r") return normalized;
        return "text";
      }

      function renderHighlightedReplCode(text, runtime) {
        const source = String(text || "");
        const language = getReplRuntimeHighlightLanguage(runtime);
        if (!source.trim() || language === "text") return escapeHtml(source);
        return highlightCode(source, language, "preview");
      }

      function renderHighlightedReplTranscriptLine(line, runtime) {
        const source = String(line || "");
        const normalized = normalizeReplRuntime(runtime || getActiveReplRuntime());
        const language = getReplRuntimeHighlightLanguage(normalized);
        let match = null;
        if (normalized === "python" || normalized === "ipython") {
          match = source.match(/^(\s*(?:>>>|\.\.\.|In \[\d+\]:|\.\.\.?:)\s?)(.*)$/);
        } else if (normalized === "r") {
          match = source.match(/^(\s*(?:>|\+)\s?)(.*)$/);
        } else if (normalized === "julia") {
          match = source.match(/^(\s*julia>\s?)(.*)$/);
        } else if (normalized === "shell") {
          match = source.match(/^(.+(?:[$%#])\s+)(.+)$/);
        } else if (normalized === "ghci") {
          match = source.match(/^(\s*(?:ghci>|[A-Za-z0-9_.]+>)\s?)(.*)$/);
        } else if (normalized === "clojure") {
          match = source.match(/^(\s*(?:[A-Za-z0-9_.-]+=>)\s?)(.*)$/);
        }
        if (!match || !String(match[2] || "").trim() || language === "text") return escapeHtml(source);
        return "<span class='repl-prompt'>" + escapeHtml(match[1] || "") + "</span>" + highlightCodeLine(match[2] || "", language, "preview");
      }

      function renderReplTranscriptHtml(transcript, runtime) {
        const source = String(transcript || "");
        const lines = source.replace(/\r\n/g, "\n").split("\n");
        const body = lines.map((line) => renderHighlightedReplTranscriptLine(line, runtime)).join("\n");
        return "<pre class='repl-transcript repl-transcript-highlight'>" + body + "</pre>";
      }

      function getReplStudioPrompt(runtime) {
        const normalized = normalizeReplRuntime(runtime || getActiveReplRuntime());
        if (normalized === "julia") return "julia>";
        if (normalized === "r") return ">";
        if (normalized === "shell") return "$";
        if (normalized === "ghci") return "ghci>";
        if (normalized === "clojure") return "user=>";
        return ">>>";
      }

      function getReplStudioEntryKind(entry) {
        if (entry.status === "note") return "Note";
        if (entry.mode === "agent") return "Pi";
        if (entry.mode === "literate") return "Literate";
        return "Raw";
      }

      function buildReplStudioMeta(entry) {
        const parts = [];
        const kind = getReplStudioEntryKind(entry);
        if (kind !== "Raw") parts.push(kind);
        const time = formatReferenceTime(entry.createdAt);
        if (time) parts.push(time);
        if (entry.skippedChunks) parts.push("skipped " + String(entry.skippedChunks));
        return parts.join(" · ");
      }

      function isReplStudioPromptLine(line, runtime) {
        const source = String(line || "");
        const normalized = normalizeReplRuntime(runtime || getActiveReplRuntime());
        if (normalized === "python") return /^\s*(?:>>>|\.\.\.)\s?/.test(source);
        if (normalized === "ipython") return /^\s*(?:In \[\d+\]:|\.\.\.?:)\s?/.test(source);
        if (normalized === "julia") return /^\s*julia>\s?/.test(source);
        if (normalized === "r") return /^\s*(?:>|\+)\s?/.test(source);
        if (normalized === "ghci") return /^\s*(?:ghci>|Prelude>|\*?[A-Za-z0-9_.:]+>)\s?/.test(source);
        if (normalized === "clojure") return /^\s*[A-Za-z0-9_.-]+=>\s?/.test(source);
        return false;
      }

      function extractReplStudioBanner(transcript, runtime) {
        const normalizedRuntime = normalizeReplRuntime(runtime || getActiveReplRuntime());
        if (normalizedRuntime === "shell") return "";
        const lines = String(transcript || "").replace(/\r\n/g, "\n").split("\n");
        const bannerLines = [];
        for (const line of lines) {
          if (!bannerLines.length && !String(line || "").trim()) continue;
          if (isReplStudioPromptLine(line, normalizedRuntime)) break;
          bannerLines.push(line);
          if (bannerLines.length >= 16) break;
        }
        const banner = bannerLines.join("\n").trim();
        if (!/^(?:Python\s|IPython\s|R version\s|GHCi,\s|Clojure\s|Julia\s|julia\s)/i.test(banner)) return "";
        return banner;
      }

      function buildReplStudioActionsHtml() {
        if (replJournalCollapsed) return "";
        const hasEntries = getVisibleReplJournalEntries().length > 0;
        const buttons = "<button type='button' data-repl-action='load-journal'" + (hasEntries ? "" : " disabled") + ">Load in editor</button>"
          + "<button type='button' data-repl-action='copy-journal'" + (hasEntries ? "" : " disabled") + ">Copy Markdown</button>"
          + "<button type='button' data-repl-action='export-journal'" + (hasEntries ? "" : " disabled") + ">Export .md</button>"
          + "<button type='button' data-repl-action='clear-journal'" + (hasEntries ? "" : " disabled") + ">Clear session</button>";
        return "<div class='repl-studio-below-actions'><div class='repl-journal-actions'>" + buttons + "</div></div>";
      }

      function buildReplJournalHtml(transcript) {
        const visibleEntries = getVisibleReplJournalEntries();
        const hasEntries = visibleEntries.length > 0;
        const entryCount = visibleEntries.length;
        const hiddenEntryCount = getHiddenReplJournalEntryCount();
        const sessionName = getActiveReplJournalSessionName();
        const collapsedClass = replJournalCollapsed ? " is-collapsed" : "";
        const toggleButton = "<button type='button' data-repl-action='journal-toggle' aria-expanded='" + (replJournalCollapsed ? "false" : "true") + "'>" + (replJournalCollapsed ? "Show REPL Studio" : "Hide REPL Studio") + "</button>";
        const toggleActions = "<div class='repl-journal-actions'>" + toggleButton + "</div>";
        const summaryText = hasEntries
          ? (entryCount + " Studio entr" + (entryCount === 1 ? "y" : "ies") + (sessionName ? " for " + sessionName : "") + ". Export is Markdown.")
          : (sessionName ? "No Studio entries for " + sessionName + "." : "Studio-sent code and notes will appear here.");
        if (replJournalCollapsed) {
          return "<section class='repl-journal repl-journal-compact" + collapsedClass + "'>"
            + "<div class='repl-journal-compact-row'>"
            + "<div class='repl-journal-compact-title'><span class='repl-journal-chip'>REPL Studio</span><span>" + escapeHtml(summaryText) + "</span></div>"
            + "<div class='repl-journal-actions'>" + toggleButton + "</div>"
            + "</div>"
            + "</section>";
        }
        const omitted = Math.max(0, visibleEntries.length - 12);
        const bannerText = extractReplStudioBanner(transcript, getActiveReplRuntime());
        const banner = bannerText
          ? "<pre class='repl-studio-banner'>" + escapeHtml(bannerText) + "</pre>"
          : "";
        const cards = visibleEntries.slice(-12).map((entry) => {
          const meta = buildReplStudioMeta(entry);
          const prompt = getReplStudioPrompt(entry.runtime);
          const codeText = String(entry.code || "").trimEnd();
          const proseText = String(entry.prose || "").trim();
          const outputText = trimReplJournalOutput(entry.output || "").trimEnd();
          const code = codeText.trim()
            ? "<div class='repl-studio-code-row'><span class='repl-prompt repl-studio-prompt'>" + escapeHtml(prompt) + "</span><pre class='repl-studio-input'>" + renderHighlightedReplCode(codeText, entry.runtime) + "</pre></div>"
            : "";
          const prose = proseText
            ? "<div class='repl-studio-note'>" + escapeHtml(proseText) + "</div>"
            : "";
          const output = outputText
            ? "<div class='repl-studio-output-row'><span class='repl-studio-output-label'>Out:</span><pre class='repl-studio-output'>" + escapeHtml(outputText) + "</pre></div>"
            : "";
          const pending = !output && entry.status === "sending"
            ? "<div class='repl-studio-pending'>Running…</div>"
            : "";
          return "<article class='repl-journal-card repl-studio-entry'>"
            + (meta ? "<div class='repl-studio-entry-meta'>" + escapeHtml(meta) + "</div>" : "")
            + prose
            + code
            + output
            + pending
            + "</article>";
        }).join("");
        const emptyText = sessionName
          ? (String(transcript || "").trim()
            ? "No REPL Studio entries for this tmux session yet. The raw tmux mirror below still has this session's history; send code from Studio to build a clean record."
            : "No REPL Studio entries for this tmux session yet. Send code from the editor, or use More → Add note (Literate send) to record prose.")
          : "No REPL Studio entries yet. Send code from the editor, or use More → Add note (Literate send) to record prose.";
        const terminalContent = banner
          + (hasEntries ? cards : "<div class='repl-studio-empty'>" + escapeHtml(emptyText) + "</div>");
        return "<section class='repl-journal'>"
          + "<div class='repl-journal-header'><div><h3>REPL Studio</h3><p>Clean collaborative Studio REPL record for the selected tmux session. The raw tmux mirror is available below.</p></div>" + toggleActions + "</div>"
          + (hiddenEntryCount ? "<div class='repl-journal-omitted'>" + escapeHtml(String(hiddenEntryCount)) + " entr" + (hiddenEntryCount === 1 ? "y" : "ies") + " from other REPL sessions hidden.</div>" : "")
          + (omitted ? "<div class='repl-journal-omitted'>Showing latest 12 entries for this session; " + escapeHtml(String(omitted)) + " older entries remain in export.</div>" : "")
          + "<div class='repl-journal-list'>" + terminalContent + "</div>"
          + "</section>";
      }

      function buildReplMirrorHtml(body, transcript) {
        const hasTranscript = Boolean(String(transcript || "").trim());
        const summary = hasTranscript
          ? "Raw tmux mirror · " + formatCompactNumber(String(transcript || "").length) + " chars"
          : "Raw tmux mirror";
        const shouldCollapse = replMirrorCollapsed;
        const actions = "<div class='repl-journal-actions'>"
          + "<button type='button' data-repl-action='mirror-toggle' aria-expanded='" + (shouldCollapse ? "false" : "true") + "'>" + (shouldCollapse ? "Show mirror" : "Hide mirror") + "</button>"
          + "</div>";
        if (shouldCollapse) {
          return "<section class='repl-mirror repl-mirror-compact'>"
            + "<div class='repl-journal-compact-row'>"
            + "<div class='repl-journal-compact-title'><span class='repl-journal-chip'>Mirror</span><span>" + escapeHtml(summary) + "</span></div>"
            + actions
            + "</div>"
            + "</section>";
        }
        return "<section class='repl-mirror'>"
          + "<div class='repl-journal-header'><div><h3>Raw REPL mirror</h3><p>Best-effort tmux pane mirror. Useful for directly typed commands and debugging; REPL Studio above is the cleaner record.</p></div>" + actions + "</div>"
          + body
          + "</section>";
      }

      function getReplAttachCommand(session) {
        if (!session || !session.sessionName) return "";
        return "tmux attach -t " + String(session.sessionName || "");
      }

      function buildReplPanelHtml() {
        const runtimeOptions = [
          ["shell", "Shell"],
          ["python", "Python"],
          ["ipython", "IPython"],
          ["julia", "Julia"],
          ["r", "R"],
          ["ghci", "GHCi"],
          ["clojure", "Clojure"],
        ].map(([value, label]) => "<option value='" + escapeHtml(value) + "'" + (replRuntime === value ? " selected" : "") + ">" + escapeHtml(label) + "</option>").join("");
        const sessionOptions = replSessions.length
          ? replSessions.map((session) => "<option value='" + escapeHtml(session.sessionName) + "'" + (session.sessionName === replActiveSessionName ? " selected" : "") + ">" + escapeHtml(session.label || session.sessionName) + "</option>").join("")
          : "<option value=''>No REPL sessions</option>";
        const activeSession = getActiveReplSession();
        const transcript = trimReplTranscript(replTranscript);
        const emptyMessage = replTmuxAvailable === false
          ? "tmux is not available. Install tmux to use Studio REPL sessions."
          : (activeSession ? "No REPL output captured yet." : "Start a REPL session, or attach to a detected pi-repl session, to mirror it here.");
        const body = transcript
          ? renderReplTranscriptHtml(transcript, activeSession ? activeSession.runtime : replRuntime)
          : "<div class='repl-empty'>" + escapeHtml(emptyMessage) + "</div>";
        const canSendToActiveSession = Boolean(activeSession) && !replBusy && replTmuxAvailable !== false;
        const canStopActiveSession = Boolean(activeSession && activeSession.source === "studio" && !replBusy && replTmuxAvailable !== false);
        return "<div class='repl-panel'>"
          + "<div class='repl-toolbar'>"
          + "<div class='repl-controls'>"
          + "<label class='repl-control-label'>Runtime <select data-repl-runtime aria-label='REPL runtime'>" + runtimeOptions + "</select></label>"
          + "<button type='button' data-repl-action='start'" + (replBusy || replTmuxAvailable === false ? " disabled" : "") + " title='Start or attach to the default session for this runtime.'>Start</button>"
          + "<label class='repl-control-label'>Session <select data-repl-session aria-label='REPL session'" + (replSessions.length ? "" : " disabled") + ">" + sessionOptions + "</select></label>"
          + "<details class='repl-more-controls'>"
          + "<summary title='More REPL actions'>More</summary>"
          + "<div class='repl-more-menu'>"
          + "<button type='button' data-repl-action='new-session'" + (replBusy || replTmuxAvailable === false ? " disabled" : "") + " title='Start a new additional session for this runtime.'>New session</button>"
          + "<button type='button' data-repl-action='stop-session'" + (canStopActiveSession ? "" : " disabled") + " title='Stop the selected Studio-owned REPL session.'>Stop session</button>"
          + "<button type='button' data-repl-action='interrupt'" + (activeSession && !replBusy ? "" : " disabled") + " title='Send Ctrl+C to the active REPL session.'>Interrupt</button>"
          + "<button type='button' data-repl-action='copy-attach-command'" + (activeSession ? "" : " disabled") + " title='Copy command for attaching to this tmux session in a terminal.'>Copy attach command</button>"
          + "<button type='button' data-repl-action='run-all-chunks'" + (canSendToActiveSession ? "" : " disabled") + " title='Literate send: send all fenced code chunks matching the active REPL runtime.'>Run all chunks</button>"
          + "<button type='button' data-repl-action='journal-note' title='Add the selected prose/current paragraph to REPL Studio (Literate send) without sending it to the runtime.'>Add note</button>"
          + "<button type='button' data-repl-action='refresh'>Refresh</button>"
          + "<button type='button' data-repl-action='follow'>Follow: " + (replFollow ? "On" : "Off") + "</button>"
          + "</div>"
          + "</details>"
          + "</div>"
          + "</div>"
          + (replMessage ? "<div class='repl-notice repl-notice-info'>" + escapeHtml(replMessage) + "</div>" : "")
          + (replError ? "<div class='repl-notice repl-notice-error'>" + escapeHtml(replError) + "</div>" : "")
          + buildReplJournalHtml(transcript)
          + buildReplStudioActionsHtml()
          + buildReplMirrorHtml(body, transcript)
          + "</div>";
      }

      function buildTracePanelHtml() {
        const state = traceState || createEmptyTraceState();
        const filter = normalizeTraceFilter(traceFilter);
        const entries = getTraceEntriesForFilter(filter);
        const visibleWorking = buildVisibleWorkingText(filter);
        const hasVisibleContent = Boolean(visibleWorking.trim());
        const started = formatReferenceTime(state.startedAt || state.updatedAt);
        const context = traceDisplayContext || {};
        const statusLabel = context.mode === "history"
          ? "Saved"
          : (context.mode === "loading"
            ? "Loading"
            : (context.mode === "missing"
              ? "Not saved"
              : (state.status === "running" ? "Live" : (state.status === "complete" ? "Complete" : "Idle"))));
        const filterMeta = filter === "thinking"
          ? "Thinking only"
          : (filter === "tools" ? "Tools only" : null);
        const historyMeta = (context.mode === "history" || context.mode === "missing" || context.mode === "loading")
          ? getTraceHistoryContextLabel()
          : null;
        const toolbar = "<div class='trace-toolbar'>"
          + "<div class='trace-summary'>"
          + "<span class='trace-summary-badge'>Working</span>"
          + "<span class='trace-summary-status trace-status-" + escapeHtml(String(state.status || "idle")) + "'>" + escapeHtml(statusLabel) + "</span>"
          + (historyMeta ? ("<span class='trace-summary-meta'>" + escapeHtml(historyMeta) + "</span>") : "")
          + (started ? ("<span class='trace-summary-meta'>Started " + escapeHtml(started) + "</span>") : "")
          + (context.summary && context.summary.truncated ? "<span class='trace-summary-meta'>Truncated</span>" : "")
          + (filterMeta ? ("<span class='trace-summary-meta'>" + escapeHtml(filterMeta) + "</span>") : "")
          + "</div>"
          + "<div class='trace-controls'>"
          + "<div class='trace-filter-group' role='tablist' aria-label='Working components'>"
          + "<button type='button' class='trace-filter-btn" + (filter === "all" ? " is-active" : "") + "' data-trace-filter='all' aria-pressed='" + (filter === "all" ? "true" : "false") + "'>All</button>"
          + "<button type='button' class='trace-filter-btn" + (filter === "thinking" ? " is-active" : "") + "' data-trace-filter='thinking' aria-pressed='" + (filter === "thinking" ? "true" : "false") + "'>Thinking</button>"
          + "<button type='button' class='trace-filter-btn" + (filter === "tools" ? " is-active" : "") + "' data-trace-filter='tools' aria-pressed='" + (filter === "tools" ? "true" : "false") + "'>Tools</button>"
          + "</div>"
          + "<button type='button' class='trace-action-btn' data-trace-action='load'" + (hasVisibleContent ? "" : " disabled") + ">Load visible into editor</button>"
          + "<button type='button' class='trace-action-btn' data-trace-action='copy'" + (hasVisibleContent ? "" : " disabled") + ">Copy visible</button>"
          + "</div>"
          + "</div>";

        if (!entries.length) {
          const emptyMessage = context.mode === "loading"
            ? "Loading saved working for this response…"
            : (context.mode === "missing"
              ? "No working was saved for this response."
              : (filter === "thinking"
                ? "No thinking steps in this working view yet."
                : (filter === "tools"
                  ? "No tool steps in this working view yet."
                  : (state.status === "running"
                    ? "Waiting for the first model or tool update…"
                    : "No live working view yet. Start a run or critique to watch working details here."))));
          return "<div class='trace-panel'>" + toolbar + "<div class='trace-empty'>" + escapeHtml(emptyMessage) + "</div></div>";
        }

        const cards = entries.map((entry) => {
          if (entry.type === "assistant") {
            const sections = [];
            if (String(entry.thinking || "").trim()) {
              sections.push(
                "<div class='trace-section'>"
                + "<div class='trace-section-label'>Thinking</div>"
                + renderTraceOutput(entry.thinking, entry.id + ":thinking")
                + "</div>"
              );
            }
            if (filter === "all" && String(entry.text || "").trim()) {
              sections.push(
                "<div class='trace-section'>"
                + "<div class='trace-section-label'>Response</div>"
                + renderTraceOutput(entry.text, entry.id + ":response")
                + "</div>"
              );
            }
            if (!sections.length) {
              sections.push("<div class='trace-empty-inline'>Waiting for streamed content…</div>");
            }
            return "<article class='trace-card trace-card-assistant'>"
              + "<div class='trace-card-header'>"
              + "<span class='trace-kind-badge'>" + escapeHtml(filter === "thinking" ? "Thinking" : "Assistant") + "</span>"
              + "<span class='trace-card-meta'>" + escapeHtml(formatReferenceTime(entry.updatedAt) || "live") + "</span>"
              + "<span class='trace-entry-status trace-entry-status-" + escapeHtml(entry.status) + "'>" + escapeHtml(entry.status === "streaming" ? "Live" : "Complete") + "</span>"
              + (entry.stopReason ? ("<span class='trace-card-meta'>stop: " + escapeHtml(entry.stopReason) + "</span>") : "")
              + "</div>"
              + sections.join("")
              + "</article>";
          }

          const title = entry.label || entry.toolName || "tool";
          const argsSummary = entry.argsSummary
            ? "<div class='trace-section'><div class='trace-section-label'>Input</div>" + renderTraceOutput(entry.argsSummary, entry.id + ":input") + "</div>"
            : "";
          const imageOutput = renderTraceImages(entry.images);
          const outputPieces = [];
          if (entry.output) outputPieces.push(renderTraceOutput(entry.output, entry.id + ":output"));
          if (imageOutput) outputPieces.push(imageOutput);
          const output = outputPieces.length
            ? "<div class='trace-section'><div class='trace-section-label'>Output</div>" + outputPieces.join("") + "</div>"
            : "<div class='trace-empty-inline'>No output yet.</div>";
          const toolStatusLabel = entry.isError
            ? "Error"
            : (entry.status === "streaming" || entry.status === "pending" ? "Live" : "Complete");
          return "<article class='trace-card trace-card-tool'>"
            + "<div class='trace-card-header'>"
            + "<span class='trace-kind-badge'>" + escapeHtml(entry.toolName || "tool") + "</span>"
            + "<span class='trace-card-title'>" + escapeHtml(title) + "</span>"
            + "<span class='trace-card-meta'>" + escapeHtml(formatReferenceTime(entry.updatedAt) || "live") + "</span>"
            + "<span class='trace-entry-status trace-entry-status-" + escapeHtml(entry.status) + "'>" + escapeHtml(toolStatusLabel) + "</span>"
            + "</div>"
            + argsSummary
            + output
            + "</article>";
        }).join("");

        return "<div class='trace-panel'>" + toolbar + "<div class='trace-list'>" + cards + "</div></div>";
      }

      function renderTraceView() {
        if (!critiqueViewEl) return;
        const shouldStick = traceAutoScroll || shouldStickTraceToBottom();
        const previousScrollTop = critiqueViewEl.scrollTop;
        finishPreviewRender(critiqueViewEl);
        critiqueViewEl.innerHTML = buildTracePanelHtml();
        critiqueViewEl.classList.remove("response-scroll-resetting");
        if (shouldStick) {
          critiqueViewEl.scrollTop = critiqueViewEl.scrollHeight;
          traceAutoScroll = true;
        } else {
          critiqueViewEl.scrollTop = previousScrollTop;
        }
        scheduleResponsePaneRepaintNudge();
      }

      function renderReplView() {
        if (!critiqueViewEl) return;
        const shouldStick = shouldAutoStickReplView();
        const previousScrollTop = critiqueViewEl.scrollTop;
        finishPreviewRender(critiqueViewEl);
        critiqueViewEl.innerHTML = buildReplPanelHtml();
        critiqueViewEl.classList.remove("response-scroll-resetting");
        if (shouldStick) {
          critiqueViewEl.scrollTop = critiqueViewEl.scrollHeight;
        } else {
          critiqueViewEl.scrollTop = previousScrollTop;
        }
        scheduleResponsePaneRepaintNudge();
      }

      function renderActiveResult() {
        if (rightView === "trace") {
          renderTraceView();
          return;
        }

        if (rightView === "repl") {
          renderReplView();
          return;
        }

        if (rightView === "editor-preview") {
          const editorText = prepareEditorTextForPreview(sourceTextEl.value || "");
          if (!editorText.trim()) {
            finishPreviewRender(critiqueViewEl);
            critiqueViewEl.innerHTML = "<pre class='plain-markdown'>Editor is empty.</pre>";
            scheduleResponsePaneRepaintNudge();
            return;
          }
          if (isHtmlArtifactPreviewText(editorText, editorLanguage)) {
            renderHtmlArtifactPreview(critiqueViewEl, editorText, "response", { title: "Editor HTML preview" });
            return;
          }
          if (supportsCodePreviewCommentsForCurrentEditor()) {
            renderCodePreviewWithCommentBlocks(critiqueViewEl, editorText, "response");
            return;
          }
          const nonce = ++responsePreviewRenderNonce;
          beginPreviewRender(critiqueViewEl);
          void applyRenderedMarkdown(critiqueViewEl, editorText, "response", nonce);
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
          if (isHtmlArtifactPreviewText(markdown, "")) {
            renderHtmlArtifactPreview(critiqueViewEl, markdown, "response", { title: "Response HTML preview" });
            return;
          }
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
        const normalizedEditor = typeof normalizedEditorText === "string"
          ? normalizedEditorText
          : normalizeForCompare(sourceTextEl.value);
        const responseLoaded = hasResponse && normalizedEditor === latestResponseNormalized;
        const isCritiqueResponse = hasResponse && latestResponseIsStructuredCritique;
        const showingAuxiliaryRightPane = rightView === "trace" || rightView === "repl";

        if (responseWrapEl) {
          responseWrapEl.hidden = showingAuxiliaryRightPane;
        }

        const critiqueNotes = isCritiqueResponse ? latestCritiqueNotes : "";
        const critiqueNotesLoaded = Boolean(critiqueNotes) && normalizedEditor === latestCritiqueNotesNormalized;

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

        const rightPaneShowsPreview = rightView === "preview" || rightView === "editor-preview";
        const exportingReplJournal = rightView === "repl";
        const replJournalExportEntries = exportingReplJournal ? getVisibleReplJournalEntries() : [];
        const exportText = exportingReplJournal
          ? (replJournalExportEntries.length ? buildReplJournalMarkdown(replJournalExportEntries) : "")
          : (rightView === "editor-preview" ? prepareEditorTextForPreview(sourceTextEl.value) : latestResponseMarkdown);
        const canExportPreview = (rightPaneShowsPreview || exportingReplJournal) && Boolean(String(exportText || "").trim());
        const htmlArtifactExportSource = canExportPreview && !exportingReplJournal ? getRightPaneHtmlArtifactSource() : "";
        const isHtmlArtifactPreview = Boolean(htmlArtifactExportSource);
        if (exportPdfBtn) {
          exportPdfBtn.disabled = uiBusy || previewExportInProgress || !canExportPreview;
          exportPdfBtn.textContent = previewExportInProgress
            ? "Exporting…"
            : (exportingReplJournal ? "Export REPL Studio" : "Export right preview");
          if (rightView === "trace") {
            exportPdfBtn.title = "Working view does not support preview export.";
          } else if (exportingReplJournal && !replJournalExportEntries.length) {
            exportPdfBtn.title = "No REPL Studio entries to export for this session yet.";
          } else if (rightView === "markdown") {
            exportPdfBtn.title = "Switch right pane to Response (Preview), Editor (Preview), or REPL Studio to export.";
          } else if (!canExportPreview) {
            exportPdfBtn.title = "Nothing to export yet.";
          } else if (isHtmlArtifactPreview) {
            exportPdfBtn.title = "This is an interactive HTML preview. Export as HTML; PDF export is not available yet.";
          } else if (exportingReplJournal) {
            exportPdfBtn.title = "Choose PDF or HTML and export REPL Studio.";
          } else {
            exportPdfBtn.title = "Choose PDF or HTML and export the current right-pane preview.";
          }
        }
        if (exportPreviewPdfBtn) {
          exportPreviewPdfBtn.disabled = uiBusy || previewExportInProgress || !canExportPreview || isHtmlArtifactPreview;
          exportPreviewPdfBtn.title = isHtmlArtifactPreview
            ? "Interactive HTML preview PDF export is not available yet."
            : (exportingReplJournal ? "Export REPL Studio as PDF." : "Export the current right-pane preview as PDF.");
        }
        if (exportPreviewHtmlBtn) {
          exportPreviewHtmlBtn.disabled = uiBusy || previewExportInProgress || !canExportPreview;
          exportPreviewHtmlBtn.title = isHtmlArtifactPreview
            ? "Export the authored HTML preview."
            : (exportingReplJournal ? "Export REPL Studio as standalone HTML." : "Export the current right-pane preview as standalone HTML.");
        }
        if (exportPreviewControlsEl) {
          exportPreviewControlsEl.title = canExportPreview
            ? (exportingReplJournal
              ? "Choose a format and export REPL Studio."
              : (isHtmlArtifactPreview ? "Export this HTML preview." : "Choose a format and export the current right-pane preview."))
            : (exportingReplJournal ? "No REPL Studio entries to export for this session yet." : "Switch right pane to a non-empty preview before exporting.");
        }
        if (!canExportPreview || previewExportInProgress) {
          closeExportPreviewMenu();
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
        if (sourceState.path) return sourceState.path;
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
          saveOverBtn.title = "Overwrite file: " + effectivePath + " · Shortcut: Cmd/Ctrl+S.";
          return;
        }

        saveOverBtn.title = "Save editor is available after opening a file, setting a working dir, or using Save editor as…. Shortcut: Cmd/Ctrl+S falls back to Save editor as… when needed.";
      }

      function updateRefreshFromDiskTooltip() {
        if (!refreshFromDiskBtn) return;

        if (hasRefreshableFilePath()) {
          refreshFromDiskBtn.title = "Reload the current file-backed document from disk: " + sourceState.path;
          return;
        }

        refreshFromDiskBtn.title = "Refresh from disk is only available for documents that currently have a file path.";
      }

      function syncActionButtons() {
        const canSaveOver = Boolean(getEffectiveSavePath());
        const canRefreshFromDisk = hasRefreshableFilePath();

        fileInput.disabled = uiBusy;
        if (sourceBadgeEl) sourceBadgeEl.disabled = uiBusy;
        saveAsBtn.disabled = uiBusy;
        saveOverBtn.disabled = uiBusy || !canSaveOver;
        if (refreshFromDiskBtn) refreshFromDiskBtn.disabled = uiBusy || !canRefreshFromDisk;
        sendEditorBtn.disabled = uiBusy || isEditorOnlyMode;
        if (getEditorBtn) getEditorBtn.disabled = uiBusy;
        if (loadGitDiffBtn) loadGitDiffBtn.disabled = uiBusy;
        syncRunAndCritiqueButtons();
        copyDraftBtn.disabled = uiBusy;
        if (openCompanionBtn) openCompanionBtn.disabled = uiBusy || wsState !== "Ready";
        if (highlightSelect) highlightSelect.disabled = uiBusy;
        if (lineNumbersSelect) lineNumbersSelect.disabled = uiBusy;
        if (annotationModeSelect) annotationModeSelect.disabled = uiBusy;
        if (saveAnnotatedBtn) saveAnnotatedBtn.disabled = uiBusy;
        if (stripAnnotationsBtn) stripAnnotationsBtn.disabled = uiBusy || !hasAnnotationMarkers(sourceTextEl.value);
        if (compactBtn) compactBtn.disabled = isEditorOnlyMode || uiBusy || compactInProgress || wsState === "Disconnected";
        editorViewSelect.disabled = isEditorOnlyMode;
        rightViewSelect.disabled = isEditorOnlyMode;
        followSelect.disabled = isEditorOnlyMode || uiBusy;
        if (responseHighlightSelect) responseHighlightSelect.disabled = isEditorOnlyMode || rightView !== "markdown";
        insertHeaderBtn.disabled = uiBusy || isEditorOnlyMode;
        lensSelect.disabled = uiBusy || isEditorOnlyMode;
        updateSaveFileTooltip();
        updateRefreshFromDiskTooltip();
        updateHistoryControls();
        updateResultActionButtons();
      }

      function setBusy(busy) {
        uiBusy = Boolean(busy);
        syncFooterSpinnerState();
        renderStatus();
        syncActionButtons();
      }

      function setSourceState(next, options) {
        const previousDescriptor = getCurrentStudioDocumentDescriptor();
        const nextPath = next && next.path ? next.path : null;
        sourceState = {
          source: next && next.source ? next.source : "blank",
          label: next && next.label ? next.label : "blank",
          path: nextPath,
          draftId: nextPath
            ? null
            : (next && next.draftId ? next.draftId : makeStudioDraftId()),
        };
        if (!sourceState.path) {
          clearFileBackedBaseline();
        }
        updateStudioDocumentUrlState(sourceState);
        updateSourceBadge();
        syncActionButtons();
        updateScratchpadUi();
        updateReviewNotesUi();
        loadScratchpadForCurrentDocument({
          previousDescriptor: previousDescriptor,
          carryCurrentMetadataToNewDocument: Boolean(options && options.carryCurrentMetadataToNewDocument),
        });
        void loadReviewNotesForCurrentDocument({
          previousDescriptor: previousDescriptor,
          carryCurrentMetadataToNewDocument: Boolean(options && options.carryCurrentMetadataToNewDocument),
        });
      }

      function setEditorText(nextText, options) {
        const value = String(nextText || "");
        const preserveScroll = Boolean(options && options.preserveScroll);
        const preserveSelection = Boolean(options && options.preserveSelection);
        if (activePreviewCommentSelection) {
          clearPreviewCommentSelection();
        }
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
        if (editorView === "markdown") {
          scheduleEditorLineNumberRender();
        }

        updateAnnotatedReplyHeaderButton();

        if (!options || options.updatePreview !== false) {
          renderSourcePreview();
        }
        if (!options || options.updateMeta !== false) {
          scheduleEditorMetaUpdate();
        }
        updateEditorSelectionCommentUi();
        updateOutlineUi();
      }

      function applySourceTextEdit(nextText, selectionStart, selectionEnd) {
        const value = String(nextText || "");
        sourceTextEl.value = value;
        const maxIndex = value.length;
        const safeStart = Math.max(0, Math.min(Math.floor(Number(selectionStart) || 0), maxIndex));
        const safeEnd = Math.max(safeStart, Math.min(Math.floor(Number(selectionEnd) || safeStart), maxIndex));
        sourceTextEl.setSelectionRange(safeStart, safeEnd);
        sourceTextEl.dispatchEvent(new Event("input", { bubbles: true }));
        syncEditorHighlightScroll();
        if (editorView === "markdown") {
          scheduleEditorLineNumberRender();
        }
      }

      function getSourceTextLineEditBounds(text, selectionStart, selectionEnd) {
        const source = String(text || "");
        const safeStart = Math.max(0, Math.min(Math.floor(Number(selectionStart) || 0), source.length));
        const safeEnd = Math.max(safeStart, Math.min(Math.floor(Number(selectionEnd) || safeStart), source.length));
        const rangeEnd = safeEnd > safeStart && source.charAt(safeEnd - 1) === "\n" ? safeEnd - 1 : safeEnd;
        const lineStart = source.lastIndexOf("\n", Math.max(0, safeStart - 1)) + 1;
        const nextNewline = source.indexOf("\n", Math.max(lineStart, rangeEnd));
        const lineEnd = nextNewline >= 0 ? nextNewline : source.length;
        return { lineStart, lineEnd, selectionStart: safeStart, selectionEnd: safeEnd };
      }

      function countSourceTextLines(text) {
        if (!text) return 1;
        return String(text).split("\n").length;
      }

      function getSourceLineUnindentLength(line) {
        const source = String(line || "");
        if (source.startsWith(EDITOR_TAB_TEXT)) return EDITOR_TAB_TEXT.length;
        if (source.startsWith("\t")) return 1;
        const spaces = source.match(/^ +/);
        return spaces ? Math.min(EDITOR_TAB_TEXT.length, spaces[0].length) : 0;
      }

      function getRemovedIndentBeforePosition(lineStart, removeLength, position) {
        if (removeLength <= 0 || position <= lineStart) return 0;
        if (position <= lineStart + removeLength) return position - lineStart;
        return removeLength;
      }

      function indentSourceTextSelection() {
        const source = String(sourceTextEl.value || "");
        const start = typeof sourceTextEl.selectionStart === "number" ? sourceTextEl.selectionStart : source.length;
        const end = typeof sourceTextEl.selectionEnd === "number" ? sourceTextEl.selectionEnd : start;
        const selected = source.slice(Math.min(start, end), Math.max(start, end));
        if (start === end || !selected.includes("\n")) {
          const before = source.slice(0, Math.min(start, end));
          const after = source.slice(Math.max(start, end));
          const nextCaret = before.length + EDITOR_TAB_TEXT.length;
          applySourceTextEdit(before + EDITOR_TAB_TEXT + after, nextCaret, nextCaret);
          return;
        }

        const bounds = getSourceTextLineEditBounds(source, start, end);
        const segment = source.slice(bounds.lineStart, bounds.lineEnd);
        const lineCount = countSourceTextLines(segment);
        const replacement = segment.replace(/^/gm, EDITOR_TAB_TEXT);
        const next = source.slice(0, bounds.lineStart) + replacement + source.slice(bounds.lineEnd);
        const nextStart = bounds.selectionStart + (bounds.lineStart < bounds.selectionStart ? EDITOR_TAB_TEXT.length : 0);
        const nextEnd = bounds.selectionEnd + (lineCount * EDITOR_TAB_TEXT.length);
        applySourceTextEdit(next, nextStart, nextEnd);
      }

      function unindentSourceTextSelection() {
        const source = String(sourceTextEl.value || "");
        const start = typeof sourceTextEl.selectionStart === "number" ? sourceTextEl.selectionStart : source.length;
        const end = typeof sourceTextEl.selectionEnd === "number" ? sourceTextEl.selectionEnd : start;
        const bounds = getSourceTextLineEditBounds(source, start, end);
        const segment = source.slice(bounds.lineStart, bounds.lineEnd);
        const lines = segment.split("\n");
        let absoluteLineStart = bounds.lineStart;
        let removedBeforeStart = 0;
        let removedBeforeEnd = 0;
        const nextLines = lines.map((line, index) => {
          const removeLength = getSourceLineUnindentLength(line);
          removedBeforeStart += getRemovedIndentBeforePosition(absoluteLineStart, removeLength, bounds.selectionStart);
          removedBeforeEnd += getRemovedIndentBeforePosition(absoluteLineStart, removeLength, bounds.selectionEnd);
          absoluteLineStart += line.length + (index < lines.length - 1 ? 1 : 0);
          return removeLength > 0 ? line.slice(removeLength) : line;
        });
        const replacement = nextLines.join("\n");
        if (replacement === segment) return;
        const next = source.slice(0, bounds.lineStart) + replacement + source.slice(bounds.lineEnd);
        const nextStart = Math.max(bounds.lineStart, bounds.selectionStart - removedBeforeStart);
        const nextEnd = Math.max(nextStart, bounds.selectionEnd - removedBeforeEnd);
        applySourceTextEdit(next, nextStart, nextEnd);
      }

      function handleSourceTextTabKey(event) {
        if (!event || event.key !== "Tab" || event.metaKey || event.ctrlKey || event.altKey) return;
        event.preventDefault();
        if (event.shiftKey) {
          unindentSourceTextSelection();
        } else {
          indentSourceTextSelection();
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
          clearPreviewJumpHighlight(sourcePreviewEl);
          finishPreviewRender(sourcePreviewEl);
        }

        if (showPreview) {
          renderSourcePreview();
        }

        updateEditorHighlightState();
        syncHighlightSelectUi();
        updateLineNumberGutterVisibility();
        if (!showPreview) {
          scheduleEditorLineNumberRender();
        }
        updateReviewNotesUi();
        updateEditorSelectionCommentUi();
        updateOutlineUi();
      }

      function setRightView(nextView) {
        const previousView = rightView;
        rightView = nextView === "preview"
          ? "preview"
          : (nextView === "editor-preview"
            ? "editor-preview"
            : (nextView === "repl"
              ? "repl"
              : ((nextView === "trace" || nextView === "thinking") ? "trace" : "markdown")));
        rightViewSelect.value = rightView;
        if (rightView === "trace" && previousView !== "trace") {
          traceAutoScroll = true;
        }
        if (rightView === "repl" && previousView !== "repl") {
          replFollow = true;
          startReplPolling();
        } else if (rightView !== "repl" && previousView === "repl") {
          stopReplPolling();
        }

        if (rightView !== "editor-preview" && responseEditorPreviewTimer) {
          window.clearTimeout(responseEditorPreviewTimer);
          responseEditorPreviewTimer = null;
        }
        if (rightView !== "editor-preview") {
          clearPreviewJumpHighlight(critiqueViewEl);
        }

        refreshResponseUi();
        syncActionButtons();
      }

      function lineNumbersShouldBeVisible() {
        return Boolean(
          lineNumbersEnabled
          && editorView === "markdown"
          && sourceEditorWrapEl
          && lineNumberGutterEl
          && lineNumberGutterContentEl
          && lineNumberMeasureEl,
        );
      }

      function reviewNoteGutterShouldBeVisible() {
        return Boolean(
          editorView === "markdown"
          && sourceEditorWrapEl
          && reviewNoteGutterEl
          && reviewNoteGutterContentEl
          && lineNumberMeasureEl
          && Array.isArray(reviewNotes)
          && reviewNotes.length > 0,
        );
      }

      function getEditorLineNumberGutterWidthCss(lineCount) {
        const digits = Math.max(2, String(Math.max(1, lineCount || 0)).length);
        return "calc(" + digits + "ch + 18px)";
      }

      function updateLineNumberGutterVisibility() {
        const lineNumbersVisible = lineNumbersShouldBeVisible();
        const reviewMarkersVisible = reviewNoteGutterShouldBeVisible();
        const anyVisible = lineNumbersVisible || reviewMarkersVisible;
        if (sourceEditorWrapEl) {
          sourceEditorWrapEl.classList.toggle("line-numbers-enabled", lineNumbersVisible);
          sourceEditorWrapEl.style.setProperty("--editor-review-note-gutter-width", reviewMarkersVisible ? "28px" : "0px");
          sourceEditorWrapEl.style.setProperty(
            "--editor-line-number-gutter-width",
            lineNumbersVisible
              ? getEditorLineNumberGutterWidthCss(Math.max(1, String(sourceTextEl.value || "").replace(/\r\n/g, "\n").split("\n").length))
              : "0px",
          );
        }
        if (reviewNoteGutterEl) {
          reviewNoteGutterEl.hidden = !reviewMarkersVisible;
        }
        if (lineNumberGutterEl) {
          lineNumberGutterEl.hidden = !lineNumbersVisible;
        }
        if (!reviewMarkersVisible && reviewNoteGutterContentEl) {
          reviewNoteGutterContentEl.innerHTML = "";
        }
        if (!lineNumbersVisible && lineNumberGutterContentEl) {
          lineNumberGutterContentEl.innerHTML = "";
        }
        if (!anyVisible && lineNumberMeasureEl) {
          lineNumberMeasureEl.innerHTML = "";
        }
        return anyVisible;
      }

      function renderEditorLineNumbersNow() {
        if (!updateLineNumberGutterVisibility()) return;

        const text = String(sourceTextEl.value || "").replace(/\r\n/g, "\n");
        const lines = text.split("\n");
        const lineCount = Math.max(1, lines.length);
        const lineNumbersVisible = lineNumbersShouldBeVisible();
        const reviewMarkersVisible = reviewNoteGutterShouldBeVisible();

        if (sourceEditorWrapEl) {
          sourceEditorWrapEl.style.setProperty("--editor-review-note-gutter-width", reviewMarkersVisible ? "28px" : "0px");
          sourceEditorWrapEl.style.setProperty(
            "--editor-line-number-gutter-width",
            lineNumbersVisible ? getEditorLineNumberGutterWidthCss(lineCount) : "0px",
          );
        }

        const styles = window.getComputedStyle(sourceTextEl);
        const lineHeightPx = parseFloat(styles.lineHeight) || 18.85;
        const paddingTop = parseFloat(styles.paddingTop) || 0;
        const paddingRight = parseFloat(styles.paddingRight) || 0;
        const paddingBottom = parseFloat(styles.paddingBottom) || 0;
        const paddingLeft = parseFloat(styles.paddingLeft) || 0;
        const contentWidth = Math.max(1, sourceTextEl.clientWidth - paddingLeft - paddingRight);

        if (lineNumberGutterContentEl) {
          lineNumberGutterContentEl.style.paddingTop = paddingTop + "px";
          lineNumberGutterContentEl.style.paddingBottom = paddingBottom + "px";
        }
        if (reviewNoteGutterContentEl) {
          reviewNoteGutterContentEl.style.paddingTop = paddingTop + "px";
          reviewNoteGutterContentEl.style.paddingBottom = paddingBottom + "px";
        }
        lineNumberMeasureEl.style.width = contentWidth + "px";
        lineNumberMeasureEl.innerHTML = lines
          .map((line) => "<div class='editor-line-number-measure-line'>" + (line.length ? escapeHtml(line) : "&#8203;") + "</div>")
          .join("");

        const measureLines = Array.from(lineNumberMeasureEl.children);
        const reviewNoteLineMap = reviewMarkersVisible ? buildReviewNoteLineMap(text) : null;

        if (lineNumbersVisible && lineNumberGutterContentEl) {
          lineNumberGutterContentEl.innerHTML = measureLines
            .map((lineEl, index) => {
              const height = Math.max(lineHeightPx, lineEl.getBoundingClientRect().height || 0);
              return "<div class='editor-line-number-row' style='height:" + height.toFixed(2) + "px'>" + (index + 1) + "</div>";
            })
            .join("");
        } else if (lineNumberGutterContentEl) {
          lineNumberGutterContentEl.innerHTML = "";
        }

        if (reviewMarkersVisible && reviewNoteGutterContentEl && reviewNoteLineMap) {
          reviewNoteGutterContentEl.innerHTML = measureLines
            .map((lineEl, index) => {
              const height = Math.max(lineHeightPx, lineEl.getBoundingClientRect().height || 0);
              const lineNumber = index + 1;
              const notesForLine = reviewNoteLineMap.get(lineNumber) || [];
              const count = notesForLine.length;
              if (count <= 0) {
                return "<div class='editor-review-note-row' style='height:" + height.toFixed(2) + "px'></div>";
              }
              const title = count === 1
                ? ("1 local comment on line " + lineNumber + ". Open comments.")
                : (count + " local comments on line " + lineNumber + ". Open comments.");
              const markerLabel = count > 9 ? "9+" : (count > 1 ? String(count) : "•");
              return "<div class='editor-review-note-row' style='height:" + height.toFixed(2) + "px'><button type='button' class='editor-review-note-marker"
                + (count > 1 ? " has-multiple" : "")
                + "' data-review-note-id='" + escapeHtml(notesForLine[0].id) + "' title='" + escapeHtml(title) + "' aria-label='" + escapeHtml(title) + "'>"
                + escapeHtml(markerLabel)
                + "</button></div>";
            })
            .join("");
        } else if (reviewNoteGutterContentEl) {
          reviewNoteGutterContentEl.innerHTML = "";
        }

        syncEditorHighlightScroll();
      }

      function scrollEditorRangeIntoView(range) {
        if (!range || editorView !== "markdown") return;
        renderEditorLineNumbersNow();

        const text = String(sourceTextEl.value || "");
        const startLine = getLineNumberAtOffset(text, range.start);
        const endLine = getLineNumberAtOffset(text, Math.max(range.start, range.end > range.start ? range.end - 1 : range.end));
        const styles = window.getComputedStyle(sourceTextEl);
        const lineHeightPx = parseFloat(styles.lineHeight) || 18.85;
        const paddingTop = parseFloat(styles.paddingTop) || 0;
        const paddingBottom = parseFloat(styles.paddingBottom) || 0;
        const measureLines = lineNumberMeasureEl ? Array.from(lineNumberMeasureEl.children) : [];

        function getLineTop(lineNumber) {
          let top = paddingTop;
          for (let i = 0; i < lineNumber - 1; i += 1) {
            const lineEl = measureLines[i];
            top += Math.max(lineHeightPx, lineEl ? lineEl.getBoundingClientRect().height || 0 : 0);
          }
          return top;
        }

        function getLineBottom(lineNumber) {
          const lineEl = measureLines[Math.max(0, lineNumber - 1)];
          return getLineTop(lineNumber) + Math.max(lineHeightPx, lineEl ? lineEl.getBoundingClientRect().height || 0 : 0);
        }

        const rangeTop = getLineTop(startLine);
        const rangeBottom = getLineBottom(endLine);
        const viewportTop = sourceTextEl.scrollTop;
        const viewportBottom = viewportTop + sourceTextEl.clientHeight;
        const margin = Math.max(18, Math.round(sourceTextEl.clientHeight * 0.12));

        let nextScrollTop = viewportTop;
        if (rangeTop - margin < viewportTop) {
          nextScrollTop = Math.max(0, rangeTop - margin);
        } else if (rangeBottom + margin > viewportBottom) {
          nextScrollTop = Math.max(0, rangeBottom - sourceTextEl.clientHeight + margin + paddingBottom);
        }

        if (Math.abs(nextScrollTop - viewportTop) > 1) {
          sourceTextEl.scrollTop = nextScrollTop;
          syncEditorHighlightScroll();
        }
      }

      function scheduleEditorLineNumberRender() {
        if (lineNumbersRenderRaf !== null) {
          if (typeof window.cancelAnimationFrame === "function") {
            window.cancelAnimationFrame(lineNumbersRenderRaf);
          } else {
            window.clearTimeout(lineNumbersRenderRaf);
          }
          lineNumbersRenderRaf = null;
        }

        const schedule = typeof window.requestAnimationFrame === "function"
          ? window.requestAnimationFrame.bind(window)
          : (cb) => window.setTimeout(cb, 16);

        lineNumbersRenderRaf = schedule(() => {
          lineNumbersRenderRaf = null;
          renderEditorLineNumbersNow();
        });
      }

      function readStoredEditorLineNumbersEnabled() {
        return readStoredToggle(EDITOR_LINE_NUMBERS_STORAGE_KEY);
      }

      function persistEditorLineNumbersEnabled(enabled) {
        persistStoredToggle(EDITOR_LINE_NUMBERS_STORAGE_KEY, enabled);
      }

      function setLineNumbersEnabled(enabled) {
        lineNumbersEnabled = Boolean(enabled);
        persistEditorLineNumbersEnabled(lineNumbersEnabled);
        if (lineNumbersSelect) {
          lineNumbersSelect.value = lineNumbersEnabled ? "on" : "off";
        }
        syncStudioUiRefreshSummaries();
        updateLineNumberGutterVisibility();
        scheduleEditorLineNumberRender();
        if (editorHighlightEnabled && editorView === "markdown") {
          scheduleEditorHighlightRender();
        }
      }

      function getToken() {
        const query = new URLSearchParams(window.location.search || "");
        const hash = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
        return query.get("token") || hash.get("token") || "";
      }

      function buildAuthedStudioUrl(pathname, extraParams) {
        const token = getToken();
        if (!token) {
          throw new Error("Missing Studio token in URL.");
        }
        const params = new URLSearchParams(extraParams || {});
        params.set("token", token);
        return pathname + "?" + params.toString();
      }

      function updateStudioDocumentUrlState(state) {
        try {
          const currentUrl = new URL(window.location.href);
          const params = currentUrl.searchParams;
          const nextState = state && typeof state === "object" ? state : sourceState;
          const nextSource = nextState && nextState.source ? String(nextState.source) : "blank";
          const nextLabel = nextState && nextState.label ? String(nextState.label) : "blank";
          const nextPath = nextState && nextState.path ? String(nextState.path) : "";
          const nextDraftId = nextState && nextState.draftId ? String(nextState.draftId) : "";
          if (nextSource) params.set("docSource", nextSource);
          else params.delete("docSource");
          if (nextLabel) params.set("docLabel", nextLabel);
          else params.delete("docLabel");
          if (nextPath) params.set("docPath", nextPath);
          else params.delete("docPath");
          if (nextDraftId) params.set("draftId", nextDraftId);
          else params.delete("draftId");
          window.history.replaceState(null, "", currentUrl.toString());
        } catch {
          // Ignore URL-state update failures.
        }
      }

      async function fetchStudioJson(pathname, options) {
        const init = options || {};
        const headers = new Headers(init.headers || undefined);
        const method = String(init.method || "GET").toUpperCase();
        if (init.body != null && !headers.has("Content-Type")) {
          headers.set("Content-Type", "application/json");
        }
        const response = await fetch(buildAuthedStudioUrl(pathname, init.query), {
          method,
          headers,
          body: init.body,
          cache: "no-store",
        });
        let payload = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }
        if (!response.ok || !payload || payload.ok === false) {
          const message = payload && typeof payload.error === "string"
            ? payload.error
            : (response.status + " " + response.statusText).trim();
          throw new Error(message || (method + " " + pathname + " failed."));
        }
        return payload;
      }

      function trySendStudioJsonBeacon(pathname, payload, extraParams) {
        try {
          if (!navigator.sendBeacon || typeof navigator.sendBeacon !== "function") return false;
          const body = JSON.stringify(payload || {});
          const blob = new Blob([body], { type: "application/json" });
          return navigator.sendBeacon(buildAuthedStudioUrl(pathname, extraParams), blob);
        } catch {
          return false;
        }
      }

      function makeRequestId() {
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
          return window.crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, "_");
        }
        return "req_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
      }

      function makeStudioDraftId() {
        return "draft_" + makeRequestId();
      }

      function normalizeQuizScope(scope) {
        const value = String(scope || "").trim().toLowerCase();
        return QUIZ_SCOPES.includes(value) ? value : "editor";
      }

      function getQuizScopeLabel(scope) {
        switch (normalizeQuizScope(scope)) {
          case "selection": return "Selection";
          case "file": return "Current file";
          case "folder": return "Folder";
          case "repo": return "Repo";
          default: return "Editor";
        }
      }

      function normalizeQuizAngle(angle) {
        const value = String(angle || "").trim().toLowerCase();
        return QUIZ_ANGLES.includes(value) ? value : "general";
      }

      function getQuizAngleLabel(angle) {
        switch (normalizeQuizAngle(angle)) {
          case "scientist": return "Scientist";
          case "mathematician": return "Mathematician";
          case "statistician": return "Statistician";
          case "developer": return "Developer";
          case "reviewer": return "Reviewer";
          default: return "General";
        }
      }

      function normalizeQuizThinking(thinking) {
        const value = String(thinking || "").trim().toLowerCase();
        return QUIZ_THINKING_LEVELS.includes(value) ? value : "minimal";
      }

      function getQuizThinkingLabel(thinking) {
        switch (normalizeQuizThinking(thinking)) {
          case "off": return "Off";
          case "low": return "Low";
          case "medium": return "Medium";
          case "high": return "High";
          default: return "Minimal";
        }
      }

      function getQuizKindLabel(kind) {
        const value = String(kind || "").trim().toLowerCase();
        if (!value) return "";
        return value
          .split(/[-_\s]+/)
          .filter(Boolean)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ");
      }

      function getQuizModelLabel() {
        const label = String(modelLabel || "").trim();
        const withoutThinking = label.replace(/\s*\((?:off|minimal|low|medium|high|xhigh)\)\s*$/i, "").trim();
        return withoutThinking || label || "current Pi model";
      }

      function shouldRenderQuizMarkdownPreview() {
        const lang = normalizeFenceLanguage(editorLanguage || "");
        return !lang || lang === "markdown" || lang === "latex";
      }

      function renderQuizMarkdownBlockHtml(markdown, className) {
        const source = String(markdown || "");
        return "<div class='studio-quiz-markdown-body rendered-markdown " + escapeHtml(className || "") + "' data-quiz-markdown='" + escapeHtml(source) + "'>"
          + "<div class='studio-quiz-markdown-fallback'>" + escapeHtml(source) + "</div>"
          + "</div>";
      }

      function restoreQuizScrollTop(scrollTop) {
        const scrollEl = getQuizScrollContainer();
        if (!scrollEl) return;
        scrollEl.scrollTop = Math.max(0, Number(scrollTop) || 0);
      }

      function restoreQuizScrollTopSoon(scrollTop) {
        restoreQuizScrollTop(scrollTop);
        window.requestAnimationFrame(() => restoreQuizScrollTop(scrollTop));
      }

      function isQuizScrollNearBottom(scrollEl) {
        if (!scrollEl) return false;
        return (scrollEl.scrollHeight - scrollEl.clientHeight - scrollEl.scrollTop) < 80;
      }

      function scrollQuizToBottom() {
        const scrollEl = getQuizScrollContainer();
        if (!scrollEl) return;
        scrollEl.scrollTop = scrollEl.scrollHeight;
      }

      function revealQuizTarget(selector) {
        if (!quizDialogEl || !selector) return false;
        const scrollEl = getQuizScrollContainer();
        const target = quizDialogEl.querySelector(selector);
        if (!scrollEl || !(target instanceof HTMLElement)) return false;
        const targetTop = target.offsetTop;
        const targetBottom = targetTop + target.offsetHeight;
        const visibleTop = scrollEl.scrollTop;
        const visibleBottom = visibleTop + scrollEl.clientHeight;
        if (targetTop >= visibleTop + 12 && targetBottom <= visibleBottom - 12) return true;
        scrollEl.scrollTop = Math.max(0, targetTop - 18);
        return true;
      }

      function applyQuizScrollIntent(options, fallbackScrollTop, wasNearBottom) {
        const opts = options && typeof options === "object" ? options : {};
        if (opts.scrollToBottom || (opts.followBottomIfNearBottom && wasNearBottom)) {
          scrollQuizToBottom();
          return;
        }
        if (opts.revealSelector && revealQuizTarget(opts.revealSelector)) {
          return;
        }
        if (opts.preserveScroll) restoreQuizScrollTop(fallbackScrollTop);
      }

      function applyQuizScrollIntentSoon(options, fallbackScrollTop, wasNearBottom) {
        applyQuizScrollIntent(options, fallbackScrollTop, wasNearBottom);
        window.requestAnimationFrame(() => applyQuizScrollIntent(options, fallbackScrollTop, wasNearBottom));
      }

      function trimQuizMarkdownRenderCache() {
        while (quizMarkdownRenderCache.size > 80) {
          const firstKey = quizMarkdownRenderCache.keys().next().value;
          if (!firstKey) break;
          quizMarkdownRenderCache.delete(firstKey);
        }
      }

      async function renderQuizMarkdownToHtml(markdown) {
        const source = String(markdown || "");
        const cacheKey = String(editorLanguage || "markdown") + "\n" + source;
        if (quizMarkdownRenderCache.has(cacheKey)) return quizMarkdownRenderCache.get(cacheKey);
        const renderedHtml = await renderMarkdownWithPandoc(source, { includeEditorLanguage: true });
        const sanitized = sanitizeRenderedHtml(renderedHtml, source, { stripMarkdownHtmlComments: editorLanguage !== "latex" });
        quizMarkdownRenderCache.set(cacheKey, sanitized);
        trimQuizMarkdownRenderCache();
        return sanitized;
      }

      async function renderQuizMarkdownFields(nonce, options) {
        const opts = options && typeof options === "object" ? options : {};
        const fallbackScrollTop = Number(opts.fallbackScrollTop) || 0;
        const wasNearBottom = Boolean(opts.wasNearBottom);
        if (!quizDialogEl || !shouldRenderQuizMarkdownPreview()) {
          applyQuizScrollIntentSoon(opts, fallbackScrollTop, wasNearBottom);
          return;
        }
        const targets = Array.from(quizDialogEl.querySelectorAll("[data-quiz-markdown]")).filter((target) => target instanceof HTMLElement);
        const preserveScroll = Boolean(opts.preserveScroll || opts.revealSelector || opts.scrollToBottom || opts.followBottomIfNearBottom);
        for (const target of targets) {
          const markdown = target.getAttribute("data-quiz-markdown") || "";
          if (!markdown.trim()) continue;
          const scrollEl = preserveScroll ? getQuizScrollContainer() : null;
          const scrollTop = scrollEl ? scrollEl.scrollTop : fallbackScrollTop;
          try {
            const html = await renderQuizMarkdownToHtml(markdown);
            if (nonce !== quizPreviewRenderNonce || !quizDialogEl || !quizDialogEl.contains(target)) return;
            target.innerHTML = html;
            await renderAnnotationMathInElement(target);
            decoratePdfEmbeds(target);
            await renderPdfPreviewsInElement(target);
            await renderMermaidInElement(target);
            await renderMathFallbackInElement(target);
            decorateCopyablePreviewBlocks(target);
            if (preserveScroll) restoreQuizScrollTopSoon(scrollTop);
          } catch (error) {
            console.error("Quiz markdown preview render failed:", error);
            target.classList.add("studio-quiz-markdown-render-failed");
          }
        }
        applyQuizScrollIntentSoon(opts, fallbackScrollTop, wasNearBottom);
      }

      function isQuizOpen() {
        return Boolean(quizOverlayEl && !quizOverlayEl.hidden);
      }

      function getQuizCurrentCard() {
        if (!Array.isArray(quizState.cards) || quizState.cards.length === 0) return null;
        const index = Math.max(0, Math.min(quizState.index || 0, quizState.cards.length - 1));
        return quizState.cards[index] || null;
      }

      function getQuizSourceLabel(scope) {
        const base = sourceState && sourceState.label ? sourceState.label : "Studio editor";
        const normalizedScope = normalizeQuizScope(scope);
        if (normalizedScope === "selection") return base + " selection";
        if (normalizedScope === "file") return base === "blank" ? "current file" : base;
        if (normalizedScope === "folder") return "folder context";
        if (normalizedScope === "repo") return "repo context";
        return base;
      }

      function dirnameForDisplayPath(path) {
        const value = String(path || "").replace(/\\/g, "/");
        const index = value.lastIndexOf("/");
        return index > 0 ? value.slice(0, index) : "";
      }

      function getCurrentResourceDirValue() {
        return resourceDirInput ? String(resourceDirInput.value || "").trim() : "";
      }

      function getDefaultQuizContextPath(scope) {
        const normalizedScope = normalizeQuizScope(scope);
        const sourcePath = sourceState && sourceState.path ? String(sourceState.path) : "";
        const resourceDir = getCurrentResourceDirValue();
        if (normalizedScope === "file") return sourcePath || "";
        if (normalizedScope === "folder") return resourceDir || dirnameForDisplayPath(sourcePath) || "";
        if (normalizedScope === "repo") return sourcePath || resourceDir || "";
        return "";
      }

      function isQuizContextScope(scope) {
        const normalizedScope = normalizeQuizScope(scope);
        return normalizedScope === "file" || normalizedScope === "folder" || normalizedScope === "repo";
      }

      function getQuizScopeFocusHint(scope) {
        const normalizedScope = normalizeQuizScope(scope);
        const focus = String(quizState.focusPrompt || "").toLowerCase();
        const asksForCode = /\b(code|implementation|technical|source|actual code)\b/.test(focus);
        const editorLang = normalizeFenceLanguage(editorLanguage || "");
        const editorLooksLikeDoc = !editorLang || editorLang === "markdown" || editorLang === "latex";
        if (asksForCode && (normalizedScope === "editor" || normalizedScope === "selection") && editorLooksLikeDoc) {
          return "Focus guidance only applies to the selected scope. Choose Folder or Repo to include code files.";
        }
        if ((normalizedScope === "folder" || normalizedScope === "repo") && asksForCode) {
          return "Code-focused guidance will prioritize source/test files over README and docs.";
        }
        return "";
      }

      function ensureQuizOverlay() {
        if (quizOverlayEl && quizDialogEl) return quizOverlayEl;
        quizOverlayEl = document.createElement("div");
        quizOverlayEl.className = "studio-quiz-overlay";
        quizOverlayEl.setAttribute("role", "presentation");
        quizOverlayEl.hidden = true;
        quizOverlayEl.innerHTML = "<div class='studio-quiz-dialog' role='dialog' aria-modal='true' aria-label='Studio quiz'></div>";
        document.body.appendChild(quizOverlayEl);
        quizDialogEl = quizOverlayEl.querySelector(".studio-quiz-dialog");
        quizOverlayEl.addEventListener("click", (event) => {
          if (event.target === quizOverlayEl) minimizeQuizOverlay();
        });
        quizDialogEl.addEventListener("input", (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;
          if (target.matches("[data-quiz-input='answer']")) {
            const card = getQuizCurrentCard();
            if (card) card.answer = target.value;
            quizState.answer = target.value;
          }
          if (target.matches("[data-quiz-field='contextPath']")) {
            quizState.contextPath = target.value;
          }
          if (target.matches("[data-quiz-field='focusPrompt']")) {
            quizState.focusPrompt = target.value;
          }
          if (target.matches("[data-quiz-field='includeEditorContext']")) {
            quizState.includeEditorContext = Boolean(target.checked);
          }
        });
        quizDialogEl.addEventListener("click", (event) => {
          const target = event.target instanceof Element ? event.target.closest("[data-quiz-action]") : null;
          if (!target) return;
          event.preventDefault();
          handleQuizAction(target.getAttribute("data-quiz-action") || "");
        });
        quizDialogEl.addEventListener("change", (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement) || !target.matches("[data-quiz-field]")) return;
          if (target.matches("[data-quiz-field='contextPath']")) return;
          readQuizSetupFields();
          renderQuizOverlay({ preserveScroll: true });
        });
        quizDialogEl.addEventListener("keydown", handleQuizKeydown);
        return quizOverlayEl;
      }

      function resetQuizStateFromEditor() {
        const previousAngle = normalizeQuizAngle(quizState.angle);
        const previousThinking = normalizeQuizThinking(quizState.thinking);
        const previousFocusPrompt = String(quizState.focusPrompt || "");
        const previousIncludeEditorContext = Boolean(quizState.includeEditorContext);
        const previousCount = quizState.questionCount || QUIZ_DEFAULT_COUNT;
        const selection = getEditorSelectionRange();
        const hasSelection = Boolean(selection.selected && selection.selected.trim());
        const scope = hasSelection ? "selection" : "editor";
        const sourcePath = sourceState && sourceState.path ? String(sourceState.path) : "";
        const resourceDir = getCurrentResourceDirValue();
        quizState = {
          open: true,
          requestId: null,
          pending: false,
          sourceText: hasSelection ? selection.selected : selection.raw,
          sourceLabel: getQuizSourceLabel(scope),
          sourcePath,
          contextPath: getDefaultQuizContextPath(scope),
          resourceDir,
          focusPrompt: previousFocusPrompt,
          includeEditorContext: previousIncludeEditorContext,
          scope,
          angle: previousAngle,
          thinking: previousThinking,
          questionCount: previousCount,
          cards: [],
          index: 0,
          answer: "",
          feedback: null,
          discussion: [],
          status: "",
          error: "",
        };
      }

      function hasResumableQuiz() {
        return Boolean(
          quizState.pending ||
          (Array.isArray(quizState.cards) && quizState.cards.length > 0) ||
          (quizState.sourceText && (quizState.status || quizState.error))
        );
      }

      function openQuizOverlay() {
        ensureQuizOverlay();
        if (!hasResumableQuiz()) {
          resetQuizStateFromEditor();
        } else {
          quizState.open = true;
        }
        quizOverlayEl.hidden = false;
        document.body.classList.add("studio-quiz-open");
        renderQuizOverlay();
      }

      function closeQuizOverlay() {
        if (!quizOverlayEl) return;
        quizOverlayEl.hidden = true;
        document.body.classList.remove("studio-quiz-open");
        quizState.open = false;
        syncActionButtons();
      }

      function minimizeQuizOverlay() {
        closeQuizOverlay();
        setStatus("Quiz minimized — use Review → Quiz me to resume.", "success");
      }

      function endQuizOverlay() {
        const hadResumableQuiz = hasResumableQuiz();
        closeQuizOverlay();
        resetQuizStateFromEditor();
        quizState.open = false;
        syncActionButtons();
        if (hadResumableQuiz) setStatus("Quiz closed.", "success");
      }

      function handleQuizKeydown(event) {
        if (!event) return;
        const key = typeof event.key === "string" ? event.key : "";
        const plainEscape = key === "Escape" && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
        const submitShortcut = key === "Enter" && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey;
        if (plainEscape) {
          event.preventDefault();
          event.stopPropagation();
          minimizeQuizOverlay();
          return;
        }
        if (submitShortcut) {
          event.preventDefault();
          event.stopPropagation();
          const card = getQuizCurrentCard();
          if (!card) {
            startQuizRequest();
            return;
          }
          if (!card.feedback) {
            checkQuizAnswer();
            return;
          }
          const promptEl = quizDialogEl ? quizDialogEl.querySelector("[data-quiz-field='discussion']") : null;
          const prompt = promptEl ? String(promptEl.value || "").trim() : "";
          if (prompt) {
            discussQuizCard();
          } else if (quizState.index < quizState.cards.length - 1) {
            quizState.index = Math.min(quizState.cards.length - 1, (quizState.index || 0) + 1);
            quizState.error = "";
            quizState.status = "";
            renderQuizOverlay();
          }
          return;
        }
        event.stopPropagation();
      }

      function renderQuizOption(value, selected, label) {
        return "<option value='" + escapeHtml(value) + "'" + (value === selected ? " selected" : "") + ">" + escapeHtml(label) + "</option>";
      }

      function renderQuizSetupHtml() {
        const scope = normalizeQuizScope(quizState.scope);
        const angle = normalizeQuizAngle(quizState.angle);
        const thinking = normalizeQuizThinking(quizState.thinking);
        const count = Math.max(1, Math.min(8, Math.floor(Number(quizState.questionCount) || QUIZ_DEFAULT_COUNT)));
        const selection = getEditorSelectionRange();
        const hasSelection = Boolean(selection.selected && selection.selected.trim());
        const contextPath = String(quizState.contextPath || getDefaultQuizContextPath(scope) || "");
        const includeEditorContext = Boolean(quizState.includeEditorContext);
        const contextScope = isQuizContextScope(scope);
        const contextScopeUsesEditor = scope === "file" || includeEditorContext;
        const focusHint = getQuizScopeFocusHint(scope);
        const scopeText = scope === "selection"
          ? selection.selected
          : ((scope === "editor" || contextScopeUsesEditor) ? selection.raw : "");
        return "<div class='studio-quiz-setup'>"
          + "<p class='studio-quiz-copy'>A short active-recall loop: answer one question, check it, ask about the card if useful, then move on.</p>"
          + "<div class='studio-quiz-fields'>"
          + "<label>Scope<select data-quiz-field='scope'>"
          + QUIZ_SCOPES.map((candidate) => candidate === "selection" && !hasSelection ? "" : renderQuizOption(candidate, scope, getQuizScopeLabel(candidate))).join("")
          + "</select></label>"
          + "<label>Angle<select data-quiz-field='angle'>"
          + QUIZ_ANGLES.map((candidate) => renderQuizOption(candidate, angle, getQuizAngleLabel(candidate))).join("")
          + "</select></label>"
          + "<label>Thinking<select data-quiz-field='thinking'>"
          + QUIZ_THINKING_LEVELS.map((candidate) => renderQuizOption(candidate, thinking, getQuizThinkingLabel(candidate))).join("")
          + "</select></label>"
          + "<label>Questions<input data-quiz-field='count' type='number' min='1' max='8' value='" + String(count) + "'></label>"
          + "</div>"
          + (contextScope ? "<label class='studio-quiz-context-path-label'>Context path<input data-quiz-field='contextPath' type='text' value='" + escapeHtml(contextPath) + "' placeholder='Folder, file, or repo path; blank uses Studio working directory'></label>" : "")
          + ((scope === "folder" || scope === "repo") ? "<label class='studio-quiz-include-editor-label'><input data-quiz-field='includeEditorContext' type='checkbox'" + (includeEditorContext ? " checked" : "") + "> Include current editor text as an anchor</label>" : "")
          + "<label class='studio-quiz-focus-label'>Focus guidance<textarea data-quiz-field='focusPrompt' rows='2' placeholder='Optional: e.g. focus on implementation details in code files; avoid README overview questions'>" + escapeHtml(quizState.focusPrompt || "") + "</textarea></label>"
          + "<div class='studio-quiz-source-note'>Scope: " + escapeHtml(getQuizScopeLabel(scope)) + (scopeText.trim() ? " · " + escapeHtml(String(scopeText.trim().length)) + " active chars" : (scope === "folder" || scope === "repo" ? " · editor text excluded" : "")) + (contextScope && contextPath ? " · Context: " + escapeHtml(contextPath) : "") + " · Studio model: " + escapeHtml(getQuizModelLabel()) + "</div>"
          + (focusHint ? "<div class='studio-quiz-hint'>" + escapeHtml(focusHint) + "</div>" : "")
          + (quizState.error ? "<div class='studio-quiz-error'>" + escapeHtml(quizState.error) + "</div>" : "")
          + (quizState.status ? "<div class='studio-quiz-status'>" + escapeHtml(quizState.status) + "</div>" : "")
          + "<div class='studio-quiz-actions'><button data-quiz-action='start' type='button'" + (quizState.pending ? " disabled" : "") + ">" + (quizState.pending ? "Generating…" : "Start quiz") + "</button></div>"
          + "</div>";
      }

      function getQuizScrollContainer() {
        if (!quizDialogEl) return null;
        return quizDialogEl.querySelector(".studio-quiz-card, .studio-quiz-setup");
      }

      function renderQuizCardHtml() {
        const card = getQuizCurrentCard();
        if (!card) return renderQuizSetupHtml();
        const total = quizState.cards.length;
        const index = Math.max(0, Math.min(quizState.index || 0, total - 1));
        const feedback = card.feedback || null;
        const answer = typeof card.answer === "string" ? card.answer : "";
        const discussion = Array.isArray(card.discussion) ? card.discussion : [];
        const scoreClass = feedback && feedback.score ? String(feedback.score).toLowerCase().replace(/[^a-z0-9_-]/g, "") : "";
        const idealAnswer = feedback && feedback.idealAnswer ? feedback.idealAnswer : (card.idealAnswer || "");
        const kindLabel = getQuizKindLabel(card.kind);
        const cardMeta = [kindLabel, getQuizAngleLabel(quizState.angle), quizState.sourceLabel || "Studio editor"].filter(Boolean).join(" · ");
        const renderMarkdown = shouldRenderQuizMarkdownPreview();
        return "<div class='studio-quiz-card'>"
          + "<div class='studio-quiz-meta'><span>Question " + String(index + 1) + " of " + String(total) + "</span><span>" + escapeHtml(cardMeta) + "</span></div>"
          + (card.snippet ? (renderMarkdown ? renderQuizMarkdownBlockHtml(card.snippet, "studio-quiz-snippet") : "<pre class='studio-quiz-snippet'><code>" + escapeHtml(card.snippet) + "</code></pre>") : "")
          + (renderMarkdown ? renderQuizMarkdownBlockHtml(card.question || "", "studio-quiz-question") : "<div class='studio-quiz-question'>" + escapeHtml(card.question || "") + "</div>")
          + "<label class='studio-quiz-answer-label'>Your answer<textarea data-quiz-input='answer' rows='6' placeholder='Explain it in your own words…'" + (feedback ? " disabled" : "") + ">" + escapeHtml(answer) + "</textarea></label>"
          + (feedback ? "<div class='studio-quiz-feedback studio-quiz-score-" + escapeHtml(scoreClass) + "'>"
            + "<div class='studio-quiz-feedback-title'>" + escapeHtml(feedback.score || "feedback") + "</div>"
            + (feedback.feedback ? renderQuizMarkdownBlockHtml(feedback.feedback, "studio-quiz-feedback-text") : "")
            + (idealAnswer ? "<div class='studio-quiz-ideal'><strong>Stronger answer</strong>" + renderQuizMarkdownBlockHtml(idealAnswer, "studio-quiz-feedback-text") + "</div>" : "")
            + (feedback.followUp ? "<div class='studio-quiz-follow-up'><strong>Suggested stretch question</strong>" + renderQuizMarkdownBlockHtml(feedback.followUp, "studio-quiz-feedback-text") + "</div>" : "")
            + "</div>" : "")
          + (discussion.length ? "<div class='studio-quiz-discussion'>" + discussion.map((entry) => "<div class='studio-quiz-discussion-entry studio-quiz-discussion-" + escapeHtml(entry.role || "assistant") + "'><strong>" + escapeHtml(entry.role === "user" ? "You" : "Tutor") + "</strong><p>" + escapeHtml(entry.text || "") + "</p></div>").join("") + "</div>" : "")
          + (feedback ? "<div class='studio-quiz-discuss-row'><textarea data-quiz-field='discussion' rows='2' placeholder='Ask the tutor about this card…'></textarea><button data-quiz-action='discuss' type='button'" + (quizState.pending ? " disabled" : "") + ">Ask</button></div>" : "")
          + (quizState.error ? "<div class='studio-quiz-error'>" + escapeHtml(quizState.error) + "</div>" : "")
          + (quizState.status ? "<div class='studio-quiz-status'>" + escapeHtml(quizState.status) + "</div>" : "")
          + "<div class='studio-quiz-actions studio-quiz-card-actions'>"
          + "<button data-quiz-action='previous' type='button'" + (index <= 0 ? " disabled" : "") + ">Previous</button>"
          + (feedback ? "<button data-quiz-action='next' type='button'" + (index >= total - 1 ? " disabled" : "") + ">Next</button>" : "<button data-quiz-action='check' type='button'" + (quizState.pending ? " disabled" : "") + ">" + (quizState.pending ? "Checking…" : "Check answer") + "</button>")
          + "<button data-quiz-action='restart' type='button'>New quiz</button>"
          + "</div>"
          + "</div>";
      }

      function renderQuizOverlay(options) {
        if (!quizDialogEl) return;
        const scrollOptions = options && typeof options === "object" ? options : {};
        const preserveScroll = Boolean(scrollOptions.preserveScroll || scrollOptions.revealSelector || scrollOptions.scrollToBottom || scrollOptions.followBottomIfNearBottom);
        const previousScrollEl = getQuizScrollContainer();
        const previousScrollTop = previousScrollEl ? previousScrollEl.scrollTop : 0;
        const wasNearBottom = isQuizScrollNearBottom(previousScrollEl);
        const bodyHtml = quizState.cards && quizState.cards.length ? renderQuizCardHtml() : renderQuizSetupHtml();
        quizDialogEl.innerHTML = "<div class='studio-quiz-header'>"
          + "<div><div class='studio-quiz-eyebrow'>Review</div><h2>Quiz me</h2></div>"
          + "<div class='studio-quiz-header-actions'>"
          + "<button class='studio-quiz-minimize' data-quiz-action='minimize' type='button'>Minimize</button>"
          + "<button class='studio-quiz-close' data-quiz-action='close' type='button' aria-label='Close and discard quiz' title='Close and discard this quiz'>Close</button>"
          + "</div>"
          + "</div>"
          + bodyHtml;
        if (preserveScroll) {
          const nextScrollEl = getQuizScrollContainer();
          if (nextScrollEl) {
            nextScrollEl.scrollTop = previousScrollTop;
            window.requestAnimationFrame(() => {
              const rafScrollEl = getQuizScrollContainer();
              if (rafScrollEl) rafScrollEl.scrollTop = previousScrollTop;
            });
          }
        }
        applyQuizScrollIntentSoon(scrollOptions, previousScrollTop, wasNearBottom);
        const renderNonce = ++quizPreviewRenderNonce;
        void renderQuizMarkdownFields(renderNonce, {
          ...scrollOptions,
          preserveScroll,
          fallbackScrollTop: previousScrollTop,
          wasNearBottom,
        });
      }

      function readQuizSetupFields() {
        if (!quizDialogEl) return;
        const scopeEl = quizDialogEl.querySelector("[data-quiz-field='scope']");
        const angleEl = quizDialogEl.querySelector("[data-quiz-field='angle']");
        const thinkingEl = quizDialogEl.querySelector("[data-quiz-field='thinking']");
        const countEl = quizDialogEl.querySelector("[data-quiz-field='count']");
        const contextPathEl = quizDialogEl.querySelector("[data-quiz-field='contextPath']");
        const focusPromptEl = quizDialogEl.querySelector("[data-quiz-field='focusPrompt']");
        const includeEditorContextEl = quizDialogEl.querySelector("[data-quiz-field='includeEditorContext']");
        const selection = getEditorSelectionRange();
        let scope = normalizeQuizScope(scopeEl ? scopeEl.value : quizState.scope);
        if (scope === "selection" && !selection.selected.trim()) scope = "editor";
        const sourcePath = sourceState && sourceState.path ? String(sourceState.path) : "";
        const resourceDir = getCurrentResourceDirValue();
        quizState.scope = scope;
        quizState.angle = normalizeQuizAngle(angleEl ? angleEl.value : quizState.angle);
        quizState.thinking = normalizeQuizThinking(thinkingEl ? thinkingEl.value : quizState.thinking);
        quizState.questionCount = Math.max(1, Math.min(8, Math.floor(Number(countEl ? countEl.value : quizState.questionCount) || QUIZ_DEFAULT_COUNT)));
        quizState.includeEditorContext = Boolean(includeEditorContextEl && includeEditorContextEl.checked);
        const shouldSendEditorText = scope === "selection" || scope === "editor" || scope === "file" || quizState.includeEditorContext;
        quizState.sourceText = scope === "selection" ? selection.selected : (shouldSendEditorText ? selection.raw : "");
        quizState.sourceLabel = shouldSendEditorText ? (sourceState && sourceState.label ? sourceState.label : getQuizSourceLabel(scope)) : getQuizSourceLabel(scope);
        quizState.sourcePath = sourcePath;
        quizState.resourceDir = resourceDir;
        quizState.contextPath = isQuizContextScope(scope)
          ? String(contextPathEl ? contextPathEl.value : (quizState.contextPath || getDefaultQuizContextPath(scope)) || "").trim()
          : "";
        quizState.focusPrompt = String(focusPromptEl ? focusPromptEl.value : quizState.focusPrompt || "").trim();
      }

      function startQuizRequest() {
        readQuizSetupFields();
        const sourceText = String(quizState.sourceText || "").trim();
        if (!sourceText && !isQuizContextScope(quizState.scope)) {
          quizState.error = "Quiz source is empty.";
          renderQuizOverlay({ preserveScroll: true });
          return;
        }
        const requestId = makeRequestId();
        quizState.requestId = requestId;
        quizState.pending = true;
        quizState.error = "";
        quizState.status = "Generating quiz…";
        renderQuizOverlay({ preserveScroll: true });
        if (!sendMessage({
          type: "quiz_generate_request",
          requestId,
          sourceText,
          sourceLabel: quizState.sourceLabel,
          sourcePath: quizState.sourcePath || "",
          contextPath: quizState.contextPath || "",
          resourceDir: quizState.resourceDir || "",
          focusPrompt: quizState.focusPrompt || "",
          scope: quizState.scope,
          angle: quizState.angle,
          thinking: quizState.thinking,
          questionCount: quizState.questionCount,
        })) {
          quizState.pending = false;
          quizState.status = "";
          quizState.error = "Not connected to Studio server.";
          renderQuizOverlay({ preserveScroll: true });
        }
      }

      function checkQuizAnswer() {
        const card = getQuizCurrentCard();
        if (!card) return;
        const answer = String(card.answer || quizState.answer || "").trim();
        if (!answer) {
          quizState.error = "Write an answer first.";
          renderQuizOverlay({ preserveScroll: true });
          return;
        }
        const requestId = makeRequestId();
        quizState.requestId = requestId;
        quizState.pending = true;
        quizState.error = "";
        quizState.status = "Checking answer…";
        renderQuizOverlay({ preserveScroll: true });
        if (!sendMessage({
          type: "quiz_answer_request",
          requestId,
          question: card.question || "",
          snippet: card.snippet || "",
          answer,
          idealAnswer: card.idealAnswer || "",
          angle: quizState.angle,
          thinking: quizState.thinking,
          sourceLabel: quizState.sourceLabel,
        })) {
          quizState.pending = false;
          quizState.status = "";
          quizState.error = "Not connected to Studio server.";
          renderQuizOverlay({ preserveScroll: true });
        }
      }

      function discussQuizCard() {
        const card = getQuizCurrentCard();
        if (!card || !quizDialogEl) return;
        const promptEl = quizDialogEl.querySelector("[data-quiz-field='discussion']");
        const prompt = promptEl ? String(promptEl.value || "").trim() : "";
        if (!prompt) {
          quizState.error = "Write a follow-up question first.";
          renderQuizOverlay({ preserveScroll: true });
          return;
        }
        const requestId = makeRequestId();
        quizState.requestId = requestId;
        quizState.pending = true;
        quizState.error = "";
        quizState.status = "Discussing…";
        card.discussion = Array.isArray(card.discussion) ? card.discussion.concat([{ role: "user", text: prompt }]) : [{ role: "user", text: prompt }];
        renderQuizOverlay({ preserveScroll: true });
        if (!sendMessage({
          type: "quiz_discuss_request",
          requestId,
          question: card.question || "",
          snippet: card.snippet || "",
          answer: card.answer || "",
          feedback: card.feedback && card.feedback.feedback ? card.feedback.feedback : "",
          prompt,
          angle: quizState.angle,
          thinking: quizState.thinking,
          sourceLabel: quizState.sourceLabel,
        })) {
          quizState.pending = false;
          quizState.status = "";
          quizState.error = "Not connected to Studio server.";
          renderQuizOverlay({ preserveScroll: true });
        }
      }

      function handleQuizAction(action) {
        if (action === "close") {
          endQuizOverlay();
          return;
        }
        if (action === "minimize") {
          minimizeQuizOverlay();
          return;
        }
        if (action === "start") {
          startQuizRequest();
          return;
        }
        if (action === "check") {
          checkQuizAnswer();
          return;
        }
        if (action === "discuss") {
          discussQuizCard();
          return;
        }
        if (action === "previous") {
          quizState.index = Math.max(0, (quizState.index || 0) - 1);
          quizState.error = "";
          quizState.status = "";
          renderQuizOverlay();
          return;
        }
        if (action === "next") {
          quizState.index = Math.min(Math.max(0, quizState.cards.length - 1), (quizState.index || 0) + 1);
          quizState.error = "";
          quizState.status = "";
          renderQuizOverlay();
          return;
        }
        if (action === "restart") {
          resetQuizStateFromEditor();
          renderQuizOverlay();
        }
      }

      function handleQuizServerMessage(message) {
        if (!quizState.requestId || typeof message.requestId !== "string" || message.requestId !== quizState.requestId) return false;
        if (message.type === "quiz_progress") {
          quizState.pending = true;
          quizState.status = typeof message.message === "string" ? message.message : "Working…";
          quizState.error = "";
          renderQuizOverlay({ preserveScroll: true });
          return true;
        }
        if (message.type === "quiz_error") {
          quizState.pending = false;
          quizState.status = "";
          quizState.error = typeof message.message === "string" ? message.message : "Quiz request failed.";
          renderQuizOverlay({ preserveScroll: true });
          return true;
        }
        if (message.type === "quiz_generated") {
          const cards = Array.isArray(message.cards) ? message.cards : [];
          quizState.pending = false;
          quizState.status = "";
          quizState.error = "";
          quizState.cards = cards.map((card, index) => ({
            id: typeof card.id === "string" ? card.id : "q" + String(index + 1),
            kind: typeof card.kind === "string" ? card.kind : "",
            snippet: typeof card.snippet === "string" ? card.snippet : "",
            question: typeof card.question === "string" ? card.question : "",
            idealAnswer: typeof card.idealAnswer === "string" ? card.idealAnswer : "",
            answer: "",
            feedback: null,
            discussion: [],
          })).filter((card) => card.question);
          quizState.index = 0;
          quizState.angle = normalizeQuizAngle(message.angle || quizState.angle);
          quizState.thinking = normalizeQuizThinking(message.thinking || quizState.thinking);
          quizState.sourceLabel = typeof message.sourceLabel === "string" ? message.sourceLabel : quizState.sourceLabel;
          if (!quizState.cards.length) quizState.error = "No quiz questions were generated.";
          renderQuizOverlay();
          return true;
        }
        if (message.type === "quiz_feedback") {
          const card = getQuizCurrentCard();
          quizState.pending = false;
          quizState.status = "";
          quizState.error = "";
          if (card) card.feedback = message.feedback || null;
          renderQuizOverlay({ revealSelector: ".studio-quiz-feedback", followBottomIfNearBottom: true });
          return true;
        }
        if (message.type === "quiz_discussion") {
          const card = getQuizCurrentCard();
          quizState.pending = false;
          quizState.status = "";
          quizState.error = "";
          if (card) {
            const answer = typeof message.answer === "string" ? message.answer : "";
            card.discussion = Array.isArray(card.discussion) ? card.discussion.concat([{ role: "assistant", text: answer }]) : [{ role: "assistant", text: answer }];
          }
          renderQuizOverlay({ scrollToBottom: true });
          return true;
        }
        return false;
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
            out += wrapHighlight("hl-md-code", token);
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
          const jsPattern = /(\/\/.*$|\/\*.*?\*\/)|(`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b(?:const|let|var|function|return|if|else|for|while|switch|case|break|continue|try|catch|finally|throw|new|class|extends|import|from|export|default|async|await|true|false|null|undefined|typeof|instanceof|interface|implements|enum|type|public|private|protected|readonly|abstract|declare|this|super)\b)|(\b[A-Za-z_$][A-Za-z0-9_$]*(?=\s*\())|(\b[A-Z][A-Za-z0-9_$]*\b)|(\b\d+(?:\.\d+)?\b)/g;
          const highlighted = highlightCodeTokens(source, jsPattern, (match) => {
            if (match[1]) return "hl-code-com";
            if (match[2]) return "hl-code-str";
            if (match[3]) return "hl-code-kw";
            if (match[4]) return "hl-code-fn";
            if (match[5]) return "hl-code-type";
            if (match[6]) return "hl-code-num";
            return "hl-code";
          });
          return "<span class='hl-code'>" + highlighted + "</span>";
        }

        if (lang === "python") {
          const pyPattern = /(#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(@[A-Za-z_][A-Za-z0-9_]*)|(\b(?:def|class|return|if|elif|else|for|while|try|except|finally|import|from|as|with|lambda|yield|True|False|None|and|or|not|in|is|pass|break|continue|raise|global|nonlocal|assert)\b)|(\b[A-Za-z_][A-Za-z0-9_]*(?=\s*\())|(\b[A-Z][A-Za-z0-9_]*\b)|(\b\d+(?:\.\d+)?\b)/g;
          const highlighted = highlightCodeTokens(source, pyPattern, (match) => {
            if (match[1]) return "hl-code-com";
            if (match[2]) return "hl-code-str";
            if (match[3]) return "hl-code-fn";
            if (match[4]) return "hl-code-kw";
            if (match[5]) return "hl-code-fn";
            if (match[6]) return "hl-code-type";
            if (match[7]) return "hl-code-num";
            return "hl-code";
          });
          return "<span class='hl-code'>" + highlighted + "</span>";
        }

        if (lang === "bash") {
          const shPattern = /(#.*$)|("(?:[^"\\]|\\.)*"|'[^']*')|(\$\{[^}]+\}|\$[A-Za-z_][A-Za-z0-9_]*)|(\b(?:if|then|else|fi|for|in|do|done|case|esac|function|local|export|readonly|return|break|continue|while|until)\b)|(\b[A-Za-z_][A-Za-z0-9_]*(?=\s*\(\s*\)))|(\b\d+\b)/g;
          const highlighted = highlightCodeTokens(source, shPattern, (match) => {
            if (match[1]) return "hl-code-com";
            if (match[2]) return "hl-code-str";
            if (match[3]) return "hl-code-var";
            if (match[4]) return "hl-code-kw";
            if (match[5]) return "hl-code-fn";
            if (match[6]) return "hl-code-num";
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
          const rustPattern = /(\/\/.*$)|("(?:[^"\\]|\\.)*")|(\b[A-Za-z_][A-Za-z0-9_]*!(?=\s*(?:\(|\{|\[)))|(\b(?:fn|let|mut|const|struct|enum|impl|trait|pub|mod|use|crate|self|super|match|if|else|for|while|loop|return|break|continue|where|as|in|ref|move|async|await|unsafe|extern|type|static|true|false|Some|None|Ok|Err|Self)\b)|(\b[A-Za-z_][A-Za-z0-9_]*(?=\s*\())|(\b[A-Z][A-Za-z0-9_]*\b)|(\b\d[\d_]*(?:\.\d[\d_]*)?(?:f32|f64|u8|u16|u32|u64|u128|usize|i8|i16|i32|i64|i128|isize)?\b)/g;
          const highlighted = highlightCodeTokens(source, rustPattern, (match) => {
            if (match[1]) return "hl-code-com";
            if (match[2]) return "hl-code-str";
            if (match[3]) return "hl-code-fn";
            if (match[4]) return "hl-code-kw";
            if (match[5]) return "hl-code-fn";
            if (match[6]) return "hl-code-type";
            if (match[7]) return "hl-code-num";
            return "hl-code";
          });
          return "<span class='hl-code'>" + highlighted + "</span>";
        }

        if (lang === "c" || lang === "cpp") {
          const cPattern = /(\/\/.*$|\/\*.*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)')|(#\s*\w+)|(\b(?:if|else|for|while|do|switch|case|break|continue|return|goto|struct|union|enum|typedef|sizeof|void|int|char|short|long|float|double|unsigned|signed|const|static|extern|volatile|register|inline|auto|restrict|true|false|NULL|nullptr|class|public|private|protected|virtual|override|template|typename|namespace|using|new|delete|try|catch|throw|noexcept|constexpr|auto|decltype|static_cast|dynamic_cast|reinterpret_cast|const_cast|std|include|define|ifdef|ifndef|endif|pragma)\b)|(\b[A-Za-z_][A-Za-z0-9_]*(?=\s*\())|(\b[A-Z][A-Za-z0-9_]*\b)|(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?[fFlLuU]*\b)/g;
          const highlighted = highlightCodeTokens(source, cPattern, (match) => {
            if (match[1]) return "hl-code-com";
            if (match[2]) return "hl-code-str";
            if (match[3]) return "hl-code-kw";
            if (match[4]) return "hl-code-kw";
            if (match[5]) return "hl-code-fn";
            if (match[6]) return "hl-code-type";
            if (match[7]) return "hl-code-num";
            return "hl-code";
          });
          return "<span class='hl-code'>" + highlighted + "</span>";
        }

        if (lang === "julia") {
          const jlPattern = /(#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(@[A-Za-z_][A-Za-z0-9_]*)|(\b(?:function|end|if|elseif|else|for|while|begin|let|local|global|const|return|break|continue|do|try|catch|finally|throw|module|import|using|export|struct|mutable|abstract|primitive|where|macro|quote|true|false|nothing|missing|in|isa|typeof)\b)|(\b[A-Za-z_][A-Za-z0-9_]*!?(?=\s*\())|(\b[A-Z][A-Za-z0-9_]*\b)|(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g;
          const highlighted = highlightCodeTokens(source, jlPattern, (match) => {
            if (match[1]) return "hl-code-com";
            if (match[2]) return "hl-code-str";
            if (match[3]) return "hl-code-fn";
            if (match[4]) return "hl-code-kw";
            if (match[5]) return "hl-code-fn";
            if (match[6]) return "hl-code-type";
            if (match[7]) return "hl-code-num";
            return "hl-code";
          });
          return "<span class='hl-code'>" + highlighted + "</span>";
        }

        if (lang === "fortran") {
          const fPattern = /(!.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b(?:program|end|subroutine|function|module|use|implicit|none|integer|real|double|precision|complex|character|logical|dimension|allocatable|intent|in|out|inout|parameter|data|do|if|then|else|elseif|endif|enddo|call|return|write|read|print|format|stop|contains|type|class|select|case|where|forall|associate|block|procedure|interface|abstract|extends|allocate|deallocate|cycle|exit|go|to|common|equivalence|save|external|intrinsic)\b)|(\b[A-Za-z_][A-Za-z0-9_]*(?=\s*\())|(\b\d+(?:\.\d+)?(?:[dDeE][+-]?\d+)?\b)/gi;
          const highlighted = highlightCodeTokens(source, fPattern, (match) => {
            if (match[1]) return "hl-code-com";
            if (match[2]) return "hl-code-str";
            if (match[3]) return "hl-code-kw";
            if (match[4]) return "hl-code-fn";
            if (match[5]) return "hl-code-num";
            return "hl-code";
          });
          return "<span class='hl-code'>" + highlighted + "</span>";
        }

        if (lang === "r") {
          const rPattern = /(#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b(?:function|if|else|for|while|repeat|in|next|break|return|TRUE|FALSE|NULL|NA|NA_integer_|NA_real_|NA_complex_|NA_character_|Inf|NaN|library|require|source|local|switch)\b)|(<-|->|<<-|->>)|(\b[A-Za-z.][A-Za-z0-9._]*(?=\s*\())|(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?[Li]?\b)/g;
          const highlighted = highlightCodeTokens(source, rPattern, (match) => {
            if (match[1]) return "hl-code-com";
            if (match[2]) return "hl-code-str";
            if (match[3]) return "hl-code-kw";
            if (match[4]) return "hl-code-op";
            if (match[5]) return "hl-code-fn";
            if (match[6]) return "hl-code-num";
            return "hl-code";
          });
          return "<span class='hl-code'>" + highlighted + "</span>";
        }

        if (lang === "matlab") {
          const matPattern = /(%.*$)|('(?:[^']|'')*'|"(?:[^"\\]|\\.)*")|(\b(?:function|end|if|elseif|else|for|while|switch|case|otherwise|try|catch|return|break|continue|global|persistent|classdef|properties|methods|events|enumeration|true|false)\b)|(\b[A-Za-z_][A-Za-z0-9_]*(?=\s*\())|(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?[i]?\b)/g;
          const highlighted = highlightCodeTokens(source, matPattern, (match) => {
            if (match[1]) return "hl-code-com";
            if (match[2]) return "hl-code-str";
            if (match[3]) return "hl-code-kw";
            if (match[4]) return "hl-code-fn";
            if (match[5]) return "hl-code-num";
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
            if (line.length === 0) {
              out.push(EMPTY_OVERLAY_LINE);
            } else if (fenceLanguage) {
              out.push(highlightCodeLine(line, fenceLanguage));
            } else {
              out.push(wrapHighlight("hl-md-code", line));
            }
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

      function supportsCodePreviewCommentsForCurrentEditor() {
        return Boolean(editorLanguage) && editorLanguage !== "markdown" && editorLanguage !== "latex";
      }

      function getCodePreviewCommentKind(language) {
        const lang = normalizeFenceLanguage(language || "");
        if (lang === "diff") return "diff-line";
        if (lang === "text") return "text-line";
        return "code-line";
      }

      function buildCodePreviewHtmlWithCommentBlocks(text, language) {
        const source = String(text || "").replace(/\r\n/g, "\n");
        const lines = source.split("\n");
        const lang = normalizeFenceLanguage(language || "");
        const kind = getCodePreviewCommentKind(lang);
        const html = [];
        let offset = 0;

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
          const line = String(lines[lineIndex] || "");
          const start = offset;
          const end = start + line.length;
          const lineNumber = lineIndex + 1;
          const lineHtml = line.length === 0
            ? "<span class='hl-code'>" + EMPTY_OVERLAY_LINE + "</span>"
            : (lang ? highlightCodeLine(line, lang, "preview") : escapeHtml(line));

          html.push(
            "<div class='preview-comment-block preview-comment-line-block'"
              + " data-review-note-start='" + String(start) + "'"
              + " data-review-note-end='" + String(end) + "'"
              + " data-review-note-line-start='" + String(lineNumber) + "'"
              + " data-review-note-line-end='" + String(lineNumber) + "'"
              + " data-preview-comment-kind='" + escapeHtml(kind) + "'"
              + ">"
              + "<div class='preview-comment-block-content preview-code-line-content'>" + lineHtml + "</div>"
              + "</div>",
          );

          offset = end + 1;
        }

        return "<div class='response-markdown-highlight preview-code-lines'>" + html.join("") + "</div>";
      }

      function renderCodePreviewWithCommentBlocks(targetEl, text, pane) {
        if (!targetEl) return;
        clearPreviewJumpHighlight(targetEl);
        finishPreviewRender(targetEl);
        targetEl.innerHTML = buildCodePreviewHtmlWithCommentBlocks(text, editorLanguage || "");
        ensurePreviewSelectionActions(targetEl);
        updatePreviewCommentBlocksForElement(targetEl);
        decorateCopyablePreviewBlocks(targetEl);
        if (pane === "response") {
          applyPendingResponseScrollReset();
          scheduleResponsePaneRepaintNudge();
        }
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
        if (sourceHighlightEl) {
          sourceHighlightEl.scrollTop = sourceTextEl.scrollTop;
          sourceHighlightEl.scrollLeft = sourceTextEl.scrollLeft;
        }
        if (reviewNoteGutterEl) {
          reviewNoteGutterEl.scrollTop = sourceTextEl.scrollTop;
        }
        if (lineNumberGutterEl) {
          lineNumberGutterEl.scrollTop = sourceTextEl.scrollTop;
        }
      }

      function runEditorMetaUpdateNow() {
        const normalizedEditor = normalizeForCompare(sourceTextEl.value);
        updateResultActionButtons(normalizedEditor);
        updateAnnotatedReplyHeaderButton();
        if (stripAnnotationsBtn) {
          stripAnnotationsBtn.disabled = uiBusy || !hasAnnotationMarkers(sourceTextEl.value);
        }
        syncStudioUiRefreshSummaries();
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

      function isScratchpadOpen() {
        return Boolean(scratchpadOverlayEl && !scratchpadOverlayEl.hidden);
      }

      function isOutlineOpen() {
        return Boolean(outlineOverlayEl && !outlineOverlayEl.hidden);
      }

      function isReviewNotesOpen() {
        return Boolean(reviewNotesOverlayEl && !reviewNotesOverlayEl.hidden);
      }

      function syncModalOpenState() {
        document.body.classList.toggle("scratchpad-open", isScratchpadOpen());
      }

      function describeStudioDocument(state) {
        const currentState = state && typeof state === "object" ? state : sourceState;
        const source = currentState && currentState.source ? String(currentState.source) : "blank";
        const label = currentState && currentState.label ? String(currentState.label) : "blank";
        const path = currentState && currentState.path ? String(currentState.path) : "";
        const draftId = currentState && currentState.draftId ? String(currentState.draftId) : "";
        if (path) {
          return {
            key: "file:" + path,
            label: path,
            fileBacked: true,
            draftBacked: false,
          };
        }
        const normalizedLabel = label.trim().replace(/\s+/g, " ") || source;
        if (draftId) {
          return {
            key: "draft:" + draftId,
            label: normalizedLabel,
            fileBacked: false,
            draftBacked: true,
          };
        }
        return {
          key: "doc:" + source + ":" + normalizedLabel,
          label: normalizedLabel,
          fileBacked: false,
          draftBacked: false,
        };
      }

      function getCurrentStudioDocumentDescriptor() {
        return describeStudioDocument(sourceState);
      }

      async function fetchScratchpadTextForDocumentKey(documentKey) {
        const payload = await fetchStudioJson("/scratchpad-state", {
          query: { documentKey: documentKey },
        });
        return payload && typeof payload.text === "string" ? payload.text : "";
      }

      function flushScratchpadPersistence(documentKeyOverride, textOverride) {
        const descriptor = documentKeyOverride
          ? { key: String(documentKeyOverride || "").trim() }
          : getCurrentStudioDocumentDescriptor();
        const key = String(descriptor && descriptor.key ? descriptor.key : "").trim();
        if (!key) return;
        if (scratchpadPersistTimer !== null) {
          window.clearTimeout(scratchpadPersistTimer);
          scratchpadPersistTimer = null;
        }
        const snapshot = String(arguments.length >= 2 ? textOverride : scratchpadText || "");
        if (trySendStudioJsonBeacon("/scratchpad-state", { documentKey: key, text: snapshot })) {
          return;
        }
        void fetchStudioJson("/scratchpad-state", {
          method: "POST",
          body: JSON.stringify({ documentKey: key, text: snapshot }),
        }).catch(() => {
          // Ignore scratchpad persistence failures for now.
        });
      }

      function scheduleScratchpadPersistence(text, documentKey) {
        if (scratchpadPersistTimer !== null) {
          window.clearTimeout(scratchpadPersistTimer);
        }
        const snapshot = String(text || "");
        const key = String(documentKey || "").trim();
        if (!key) return;
        scratchpadPersistTimer = window.setTimeout(() => {
          scratchpadPersistTimer = null;
          flushScratchpadPersistence(key, snapshot);
        }, 180);
      }

      async function loadScratchpadForDocumentKey(documentKey) {
        const key = String(documentKey || "").trim();
        const loadNonce = ++scratchpadLoadNonce;
        if (!key) {
          setScratchpadText("", { persist: false });
          return;
        }
        try {
          const serverText = await fetchScratchpadTextForDocumentKey(key);
          if (loadNonce !== scratchpadLoadNonce) return;
          if (key !== getCurrentStudioDocumentDescriptor().key) return;
          setScratchpadText(serverText, { persist: false });
        } catch {
          if (loadNonce !== scratchpadLoadNonce) return;
          if (key !== getCurrentStudioDocumentDescriptor().key) return;
          setScratchpadText("", { persist: false });
        }
      }

      async function maybeCarryScratchpadToNewDocument(previousDescriptor, nextDescriptor) {
        if (!previousDescriptor || !nextDescriptor || previousDescriptor.key === nextDescriptor.key) return;
        const snapshot = String(scratchpadText || "");
        if (!snapshot.trim()) return;
        try {
          const existing = await fetchScratchpadTextForDocumentKey(nextDescriptor.key);
          if (String(existing || "").trim()) return;
          await fetchStudioJson("/scratchpad-state", {
            method: "POST",
            body: JSON.stringify({ documentKey: nextDescriptor.key, text: snapshot }),
          });
        } catch {
          // Ignore carry-over failures and just fall back to normal scope loading.
        }
      }

      function loadScratchpadForCurrentDocument(options) {
        const previousDescriptor = options && options.previousDescriptor ? options.previousDescriptor : null;
        const shouldCarryToNewDocument = Boolean(options && options.carryCurrentMetadataToNewDocument);
        const currentDescriptor = getCurrentStudioDocumentDescriptor();
        void (async () => {
          if (shouldCarryToNewDocument && previousDescriptor) {
            await maybeCarryScratchpadToNewDocument(previousDescriptor, currentDescriptor);
          }
          await loadScratchpadForDocumentKey(currentDescriptor.key);
        })();
      }

      function persistScratchpadText(value) {
        const descriptor = getCurrentStudioDocumentDescriptor();
        scheduleScratchpadPersistence(value, descriptor.key);
      }

      function normalizeReviewNote(note) {
        if (!note || typeof note !== "object") return null;
        const id = typeof note.id === "string" && note.id.trim() ? note.id : makeRequestId();
        const text = typeof note.text === "string" ? note.text : "";
        const createdAt = typeof note.createdAt === "number" && Number.isFinite(note.createdAt)
          ? note.createdAt
          : Date.now();
        const updatedAt = typeof note.updatedAt === "number" && Number.isFinite(note.updatedAt)
          ? note.updatedAt
          : createdAt;
        const selectionStart = typeof note.selectionStart === "number" && Number.isFinite(note.selectionStart)
          ? Math.max(0, Math.floor(note.selectionStart))
          : 0;
        const selectionEnd = typeof note.selectionEnd === "number" && Number.isFinite(note.selectionEnd)
          ? Math.max(selectionStart, Math.floor(note.selectionEnd))
          : selectionStart;
        const lineStart = typeof note.lineStart === "number" && Number.isFinite(note.lineStart)
          ? Math.max(1, Math.floor(note.lineStart))
          : 1;
        const lineEnd = typeof note.lineEnd === "number" && Number.isFinite(note.lineEnd)
          ? Math.max(lineStart, Math.floor(note.lineEnd))
          : lineStart;
        return {
          id,
          text,
          createdAt,
          updatedAt,
          selectionStart,
          selectionEnd,
          lineStart,
          lineEnd,
          selectedText: typeof note.selectedText === "string" ? note.selectedText : "",
          selectedDisplayText: typeof note.selectedDisplayText === "string" ? note.selectedDisplayText : "",
        };
      }

      function buildOutlineLineIndex(text) {
        const source = String(text || "").replace(/\r\n/g, "\n");
        const lines = source.split("\n");
        const lineOffsets = [];
        let runningOffset = 0;
        for (const line of lines) {
          lineOffsets.push(runningOffset);
          runningOffset += line.length + 1;
        }
        return { source, lines, lineOffsets };
      }

      function makeOutlineEntry(options) {
        const entry = options && typeof options === "object" ? options : {};
        const label = typeof entry.label === "string" ? entry.label.trim() : "";
        if (!label) return null;
        const selectionStart = Math.max(0, Math.floor(Number(entry.selectionStart) || 0));
        const selectionEnd = Math.max(selectionStart, Math.floor(Number(entry.selectionEnd) || selectionStart));
        return {
          id: typeof entry.id === "string" && entry.id ? entry.id : makeRequestId(),
          kind: typeof entry.kind === "string" && entry.kind ? entry.kind : "section",
          depth: Math.max(1, Math.floor(Number(entry.depth) || 1)),
          label,
          lineStart: Math.max(1, Math.floor(Number(entry.lineStart) || 1)),
          lineEnd: Math.max(Math.max(1, Math.floor(Number(entry.lineStart) || 1)), Math.floor(Number(entry.lineEnd) || Math.max(1, Math.floor(Number(entry.lineStart) || 1)))),
          selectionStart,
          selectionEnd,
          selectedText: typeof entry.selectedText === "string" ? entry.selectedText : "",
          selectedDisplayText: typeof entry.selectedDisplayText === "string" && entry.selectedDisplayText ? entry.selectedDisplayText : label,
        };
      }

      function getOutlineKindLabel(kind) {
        switch (String(kind || "")) {
          case "heading": return "Heading";
          case "section": return "Section";
          case "subsection": return "Subsection";
          case "subsubsection": return "Subsubsection";
          case "paragraph": return "Paragraph";
          case "subparagraph": return "Subparagraph";
          case "class": return "Class";
          case "function": return "Function";
          case "interface": return "Interface";
          case "enum": return "Enum";
          case "type": return "Type";
          case "struct": return "Struct";
          case "module": return "Module";
          case "macro": return "Macro";
          case "file": return "File";
          case "hunk": return "Hunk";
          default: return "Item";
        }
      }

      function getOutlineKindBadge(kind) {
        switch (String(kind || "")) {
          case "section": return "§";
          case "subsection": return "§§";
          case "subsubsection": return "§3";
          case "paragraph": return "¶";
          case "subparagraph": return "¶2";
          case "class": return "class";
          case "function": return "def";
          case "interface": return "iface";
          case "enum": return "enum";
          case "type": return "type";
          case "struct": return "struct";
          case "module": return "mod";
          case "macro": return "macro";
          case "file": return "file";
          case "hunk": return "@@";
          default: return "#";
        }
      }

      function scanMarkdownOutlineEntries(text) {
        const { source, lines, lineOffsets } = buildOutlineLineIndex(text);
        const entries = [];
        let activeFence = null;

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
          const line = String(lines[lineIndex] || "");
          const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);
          if (fenceMatch) {
            if (!activeFence) {
              activeFence = fenceMatch[1];
            } else if (fenceMatch[1][0] === activeFence[0] && fenceMatch[1].length >= activeFence.length) {
              activeFence = null;
            }
            continue;
          }
          if (activeFence) continue;

          const atxMatch = line.match(/^ {0,3}(#{1,6})[ \t]+(.+?)(?:[ \t]+#+[ \t]*)?$/);
          if (atxMatch) {
            const label = normalizeVisiblePreviewText(atxMatch[2] || "");
            const entry = makeOutlineEntry({
              kind: atxMatch[1].length === 1 ? "section" : atxMatch[1].length === 2 ? "subsection" : atxMatch[1].length === 3 ? "subsubsection" : "heading",
              depth: atxMatch[1].length,
              label,
              lineStart: lineIndex + 1,
              lineEnd: lineIndex + 1,
              selectionStart: lineOffsets[lineIndex] || 0,
              selectionEnd: (lineOffsets[lineIndex] || 0) + line.length,
              selectedText: line,
              selectedDisplayText: label,
            });
            if (entry) entries.push(entry);
            continue;
          }

          const nextLine = lineIndex + 1 < lines.length ? String(lines[lineIndex + 1] || "") : "";
          const setextMatch = nextLine.match(/^ {0,3}(=+|-+)\s*$/);
          if (setextMatch && normalizeVisiblePreviewText(line)) {
            const depth = setextMatch[1][0] === "=" ? 1 : 2;
            const label = normalizeVisiblePreviewText(line);
            const entry = makeOutlineEntry({
              kind: depth === 1 ? "section" : "subsection",
              depth,
              label,
              lineStart: lineIndex + 1,
              lineEnd: lineIndex + 1,
              selectionStart: lineOffsets[lineIndex] || 0,
              selectionEnd: (lineOffsets[lineIndex] || 0) + line.length,
              selectedText: line,
              selectedDisplayText: label,
            });
            if (entry) entries.push(entry);
            lineIndex += 1;
          }
        }

        return entries;
      }

      const LATEX_OUTLINE_LEVEL_BY_COMMAND = {
        part: 1,
        chapter: 1,
        section: 1,
        subsection: 2,
        subsubsection: 3,
        paragraph: 4,
        subparagraph: 5,
      };

      function scanLatexOutlineEntries(text) {
        const source = String(text || "").replace(/\r\n/g, "\n");
        const bodyRange = findLatexDocumentBodyRange(source);
        const bodyStart = Math.max(0, Math.min(bodyRange.start, source.length));
        const bodyEnd = Math.max(bodyStart, Math.min(bodyRange.end, source.length));
        const bodyText = source.slice(bodyStart, bodyEnd);
        const { lines, lineOffsets } = buildOutlineLineIndex(bodyText);
        const entries = [];

        function getLine(index) {
          return index >= 0 && index < lines.length ? String(lines[index] || "") : "";
        }

        function getStrippedLine(index) {
          return stripLatexPreviewComments(getLine(index)).trim();
        }

        function isBibliographyCommandLine(index) {
          return /^\\(?:bibliographystyle|bibliography|printbibliography)\b/i.test(getStrippedLine(index));
        }

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
          let chunk = getLine(lineIndex);
          let endLineIndex = lineIndex;
          let heading = readLatexHeadingChunk(chunk);
          if (/^\s*\\(?:part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\b/.test(chunk)) {
            while (!heading && endLineIndex + 1 < lines.length && endLineIndex < lineIndex + 5) {
              endLineIndex += 1;
              chunk += "\n" + getLine(endLineIndex);
              heading = readLatexHeadingChunk(chunk);
            }
          }
          if (heading) {
            const label = extractLatexPreviewVisibleText(heading.titleText || "");
            const kind = String(heading.commandName || "section").replace(/\*$/, "").toLowerCase();
            const entry = makeOutlineEntry({
              kind,
              depth: LATEX_OUTLINE_LEVEL_BY_COMMAND[kind] || 1,
              label,
              lineStart: lineIndex + 1,
              lineEnd: endLineIndex + 1,
              selectionStart: bodyStart + (lineOffsets[lineIndex] || 0),
              selectionEnd: bodyStart + (lineOffsets[endLineIndex] || 0) + getLine(endLineIndex).length,
              selectedText: source.slice(bodyStart + (lineOffsets[lineIndex] || 0), bodyStart + (lineOffsets[endLineIndex] || 0) + getLine(endLineIndex).length),
              selectedDisplayText: label,
            });
            if (entry) entries.push(entry);
            lineIndex = endLineIndex;
            continue;
          }

          if (isBibliographyCommandLine(lineIndex)) {
            let endLine = lineIndex;
            while (endLine + 1 < lines.length && isBibliographyCommandLine(endLine + 1)) {
              endLine += 1;
            }
            const entry = makeOutlineEntry({
              kind: "section",
              depth: 1,
              label: "References",
              lineStart: lineIndex + 1,
              lineEnd: endLine + 1,
              selectionStart: bodyStart + (lineOffsets[lineIndex] || 0),
              selectionEnd: bodyStart + (lineOffsets[endLine] || 0) + getLine(endLine).length,
              selectedText: source.slice(bodyStart + (lineOffsets[lineIndex] || 0), bodyStart + (lineOffsets[endLine] || 0) + getLine(endLine).length),
              selectedDisplayText: "References",
            });
            if (entry) entries.push(entry);
            lineIndex = endLine;
          }
        }

        return entries;
      }

      function scanPythonOutlineEntries(text) {
        const { lines, lineOffsets } = buildOutlineLineIndex(text);
        const entries = [];
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
          const line = String(lines[lineIndex] || "");
          const classMatch = line.match(/^(\s*)class\s+([A-Za-z_][A-Za-z0-9_]*)\b/);
          const defMatch = line.match(/^(\s*)(?:async\s+def|def)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
          const match = classMatch || defMatch;
          if (!match) continue;
          const indent = String(match[1] || "").replace(/\t/g, "    ").length;
          const label = String(match[2] || "");
          const kind = classMatch ? "class" : "function";
          const entry = makeOutlineEntry({
            kind,
            depth: Math.max(1, Math.floor(indent / 4) + 1),
            label,
            lineStart: lineIndex + 1,
            lineEnd: lineIndex + 1,
            selectionStart: lineOffsets[lineIndex] || 0,
            selectionEnd: (lineOffsets[lineIndex] || 0) + line.length,
            selectedText: line,
            selectedDisplayText: label,
          });
          if (entry) entries.push(entry);
        }
        return entries;
      }

      function scanJsLikeOutlineEntries(text) {
        const { lines, lineOffsets } = buildOutlineLineIndex(text);
        const entries = [];
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
          const line = String(lines[lineIndex] || "");
          const patterns = [
            { kind: "class", match: line.match(/^(\s*)(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)\b/) },
            { kind: "function", match: line.match(/^(\s*)(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/) },
            { kind: "function", match: line.match(/^(\s*)(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][A-Za-z0-9_$]*)\s*=>/) },
            { kind: "interface", match: line.match(/^(\s*)(?:export\s+)?interface\s+([A-Za-z_$][A-Za-z0-9_$]*)\b/) },
            { kind: "enum", match: line.match(/^(\s*)(?:export\s+)?enum\s+([A-Za-z_$][A-Za-z0-9_$]*)\b/) },
            { kind: "type", match: line.match(/^(\s*)(?:export\s+)?type\s+([A-Za-z_$][A-Za-z0-9_$]*)\b/) },
          ];
          const found = patterns.find((entry) => entry.match);
          if (!found || !found.match) continue;
          const indent = String(found.match[1] || "").replace(/\t/g, "  ").length;
          const label = String(found.match[2] || "");
          const entry = makeOutlineEntry({
            kind: found.kind,
            depth: Math.max(1, Math.floor(indent / 2) + 1),
            label,
            lineStart: lineIndex + 1,
            lineEnd: lineIndex + 1,
            selectionStart: lineOffsets[lineIndex] || 0,
            selectionEnd: (lineOffsets[lineIndex] || 0) + line.length,
            selectedText: line,
            selectedDisplayText: label,
          });
          if (entry) entries.push(entry);
        }
        return entries;
      }

      function scanJuliaOutlineEntries(text) {
        const { lines, lineOffsets } = buildOutlineLineIndex(text);
        const entries = [];
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
          const line = String(lines[lineIndex] || "");
          const patterns = [
            { kind: "module", match: line.match(/^(\s*)module\s+([A-Za-z_][A-Za-z0-9_]*)\b/) },
            { kind: "struct", match: line.match(/^(\s*)(?:mutable\s+)?struct\s+([A-Za-z_][A-Za-z0-9_]*)\b/) },
            { kind: "function", match: line.match(/^(\s*)function\s+([A-Za-z_][A-Za-z0-9_!]*)\s*\(/) },
            { kind: "macro", match: line.match(/^(\s*)macro\s+([A-Za-z_][A-Za-z0-9_!]*)\b/) },
          ];
          const found = patterns.find((entry) => entry.match);
          if (!found || !found.match) continue;
          const indent = String(found.match[1] || "").replace(/\t/g, "  ").length;
          const label = String(found.match[2] || "");
          const entry = makeOutlineEntry({
            kind: found.kind,
            depth: Math.max(1, Math.floor(indent / 2) + 1),
            label,
            lineStart: lineIndex + 1,
            lineEnd: lineIndex + 1,
            selectionStart: lineOffsets[lineIndex] || 0,
            selectionEnd: (lineOffsets[lineIndex] || 0) + line.length,
            selectedText: line,
            selectedDisplayText: label,
          });
          if (entry) entries.push(entry);
        }
        return entries;
      }

      function scanBashOutlineEntries(text) {
        const { lines, lineOffsets } = buildOutlineLineIndex(text);
        const entries = [];
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
          const line = String(lines[lineIndex] || "");
          const match = line.match(/^(\s*)(?:function\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(\)\s*\{/);
          if (!match) continue;
          const indent = String(match[1] || "").replace(/\t/g, "  ").length;
          const label = String(match[2] || "");
          const entry = makeOutlineEntry({
            kind: "function",
            depth: Math.max(1, Math.floor(indent / 2) + 1),
            label,
            lineStart: lineIndex + 1,
            lineEnd: lineIndex + 1,
            selectionStart: lineOffsets[lineIndex] || 0,
            selectionEnd: (lineOffsets[lineIndex] || 0) + line.length,
            selectedText: line,
            selectedDisplayText: label,
          });
          if (entry) entries.push(entry);
        }
        return entries;
      }

      function scanDiffOutlineEntries(text) {
        const { lines, lineOffsets } = buildOutlineLineIndex(text);
        const entries = [];
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
          const line = String(lines[lineIndex] || "");
          let kind = "";
          let label = "";
          let depth = 1;
          const fileMatch = line.match(/^diff\s+--git\s+a\/([^\s]+)\s+b\/([^\s]+)/);
          if (fileMatch) {
            kind = "file";
            label = String(fileMatch[2] || fileMatch[1] || "");
            depth = 1;
          } else if (/^@@/.test(line)) {
            kind = "hunk";
            label = line.replace(/^@@\s*|\s*@@.*$/g, "").trim() || line.trim();
            depth = 2;
          }
          if (!kind || !label) continue;
          const entry = makeOutlineEntry({
            kind,
            depth,
            label,
            lineStart: lineIndex + 1,
            lineEnd: lineIndex + 1,
            selectionStart: lineOffsets[lineIndex] || 0,
            selectionEnd: (lineOffsets[lineIndex] || 0) + line.length,
            selectedText: line,
            selectedDisplayText: label,
          });
          if (entry) entries.push(entry);
        }
        return entries;
      }

      function scanOutlineEntries(text, language) {
        switch (String(language || "").toLowerCase()) {
          case "markdown":
            return scanMarkdownOutlineEntries(text);
          case "latex":
            return scanLatexOutlineEntries(text);
          case "python":
            return scanPythonOutlineEntries(text);
          case "javascript":
          case "typescript":
            return scanJsLikeOutlineEntries(text);
          case "julia":
            return scanJuliaOutlineEntries(text);
          case "bash":
            return scanBashOutlineEntries(text);
          case "diff":
            return scanDiffOutlineEntries(text);
          default:
            return [];
        }
      }

      function cloneReviewNotes(notes) {
        return Array.isArray(notes)
          ? notes
              .map((note) => normalizeReviewNote(note))
              .filter(Boolean)
              .map((note) => ({ ...note }))
          : [];
      }

      async function fetchReviewNotesForDocumentKey(documentKey) {
        const payload = await fetchStudioJson("/review-notes", {
          query: { documentKey: documentKey },
        });
        return cloneReviewNotes(payload && Array.isArray(payload.notes) ? payload.notes : []);
      }

      function flushReviewNotesPersistence(documentKeyOverride, notesOverride) {
        const descriptor = documentKeyOverride
          ? { key: String(documentKeyOverride || "").trim() }
          : getCurrentStudioDocumentDescriptor();
        const key = String(descriptor && descriptor.key ? descriptor.key : "").trim();
        if (!key) return;
        if (reviewNotesPersistTimer !== null) {
          window.clearTimeout(reviewNotesPersistTimer);
          reviewNotesPersistTimer = null;
        }
        const snapshot = cloneReviewNotes(arguments.length >= 2 ? notesOverride : reviewNotes);
        if (trySendStudioJsonBeacon("/review-notes", { documentKey: key, notes: snapshot })) {
          return;
        }
        void fetchStudioJson("/review-notes", {
          method: "POST",
          body: JSON.stringify({ documentKey: key, notes: snapshot }),
        }).catch(() => {
          // Ignore persistence failures; the in-memory notes list remains available for this session.
        });
      }

      function scheduleReviewNotesPersistence() {
        if (reviewNotesPersistTimer !== null) {
          window.clearTimeout(reviewNotesPersistTimer);
        }
        const descriptor = getCurrentStudioDocumentDescriptor();
        const snapshot = cloneReviewNotes(reviewNotes);
        reviewNotesPersistTimer = window.setTimeout(() => {
          reviewNotesPersistTimer = null;
          flushReviewNotesPersistence(descriptor.key, snapshot);
        }, 180);
      }

      async function maybeCarryReviewNotesToNewDocument(previousDescriptor, nextDescriptor) {
        if (!previousDescriptor || !nextDescriptor || previousDescriptor.key === nextDescriptor.key) return;
        const snapshot = cloneReviewNotes(reviewNotes);
        if (!snapshot.length) return;
        try {
          const existing = await fetchReviewNotesForDocumentKey(nextDescriptor.key);
          if (existing.length > 0) return;
          await fetchStudioJson("/review-notes", {
            method: "POST",
            body: JSON.stringify({ documentKey: nextDescriptor.key, notes: snapshot }),
          });
        } catch {
          // Ignore carry-over failures and just fall back to normal scope loading.
        }
      }

      async function loadReviewNotesForCurrentDocument(options) {
        const descriptor = getCurrentStudioDocumentDescriptor();
        const previousDescriptor = options && options.previousDescriptor ? options.previousDescriptor : null;
        const shouldCarryToNewDocument = Boolean(options && options.carryCurrentMetadataToNewDocument);
        const loadNonce = ++reviewNotesLoadNonce;
        try {
          if (shouldCarryToNewDocument && previousDescriptor) {
            await maybeCarryReviewNotesToNewDocument(previousDescriptor, descriptor);
          }
          const notes = await fetchReviewNotesForDocumentKey(descriptor.key);
          if (loadNonce !== reviewNotesLoadNonce) return;
          if (descriptor.key !== getCurrentStudioDocumentDescriptor().key) return;
          reviewNotes = notes;
        } catch {
          if (loadNonce !== reviewNotesLoadNonce) return;
          if (descriptor.key !== getCurrentStudioDocumentDescriptor().key) return;
          reviewNotes = [];
        }
        updateReviewNotesUi();
        renderReviewNotesList();
        refreshRenderedEditorPreviewComments();
        if (editorView === "markdown") {
          scheduleEditorLineNumberRender();
        }
      }

      function formatReviewNoteTimestamp(timestamp) {
        if (!Number.isFinite(timestamp)) return "Saved locally";
        try {
          return "Updated " + new Date(timestamp).toLocaleString();
        } catch {
          return "Saved locally";
        }
      }

      function summarizeReviewNoteAnchor(note) {
        const start = Math.max(1, Number(note && note.lineStart) || 1);
        const end = Math.max(start, Number(note && note.lineEnd) || start);
        return start === end ? "Line " + start : ("Lines " + start + "–" + end);
      }

      function summarizeReviewNoteQuote(note) {
        const normalized = String(note && (note.selectedDisplayText || note.selectedText) ? (note.selectedDisplayText || note.selectedText) : "")
          .replace(/\s+/g, " ")
          .trim();
        if (!normalized) return "Anchor: current line / empty selection";
        return normalized.length > 140 ? normalized.slice(0, 137) + "…" : normalized;
      }

      function getLineNumberAtOffset(text, offset) {
        const source = String(text || "");
        const safeOffset = Math.max(0, Math.min(Number(offset) || 0, source.length));
        let line = 1;
        for (let i = 0; i < safeOffset; i += 1) {
          if (source[i] === "\n") line += 1;
        }
        return line;
      }

      function getLineRangeAtOffset(text, offset) {
        const source = String(text || "");
        const safeOffset = Math.max(0, Math.min(Number(offset) || 0, source.length));
        let start = safeOffset;
        while (start > 0 && source[start - 1] !== "\n") start -= 1;
        let end = safeOffset;
        while (end < source.length && source[end] !== "\n") end += 1;
        return {
          start,
          end,
          lineNumber: getLineNumberAtOffset(source, safeOffset),
        };
      }

      function getLineRangeForNumbers(text, lineStart, lineEnd) {
        const lines = String(text || "").split("\n");
        const safeLineStart = Math.max(1, Math.min(Math.floor(lineStart || 1), Math.max(1, lines.length)));
        const safeLineEnd = Math.max(safeLineStart, Math.min(Math.floor(lineEnd || safeLineStart), Math.max(1, lines.length)));
        let start = 0;
        for (let i = 0; i < safeLineStart - 1; i += 1) {
          start += lines[i].length + 1;
        }
        let end = start;
        for (let i = safeLineStart - 1; i < safeLineEnd; i += 1) {
          end += lines[i].length;
          if (i < safeLineEnd - 1) end += 1;
        }
        return { start, end };
      }

      function getEditorAnchorForReviewNote() {
        const current = String(sourceTextEl.value || "");
        const start = typeof sourceTextEl.selectionStart === "number" ? sourceTextEl.selectionStart : 0;
        const end = typeof sourceTextEl.selectionEnd === "number" ? sourceTextEl.selectionEnd : start;
        const safeStart = Math.max(0, Math.min(start, current.length));
        const safeEnd = Math.max(safeStart, Math.min(end, current.length));
        if (safeStart !== safeEnd) {
          return {
            selectionStart: safeStart,
            selectionEnd: safeEnd,
            lineStart: getLineNumberAtOffset(current, safeStart),
            lineEnd: getLineNumberAtOffset(current, Math.max(safeStart, safeEnd - 1)),
            selectedText: current.slice(safeStart, safeEnd),
            selectedDisplayText: current.slice(safeStart, safeEnd),
          };
        }
        const lineRange = getLineRangeAtOffset(current, safeStart);
        return {
          selectionStart: lineRange.start,
          selectionEnd: lineRange.end,
          lineStart: lineRange.lineNumber,
          lineEnd: lineRange.lineNumber,
          selectedText: current.slice(lineRange.start, lineRange.end),
          selectedDisplayText: current.slice(lineRange.start, lineRange.end),
        };
      }

      function getEditorLineAnchorForReviewNote() {
        const current = String(sourceTextEl.value || "");
        const caret = typeof sourceTextEl.selectionStart === "number"
          ? sourceTextEl.selectionStart
          : 0;
        const lineRange = getLineRangeAtOffset(current, Math.max(0, Math.min(caret, current.length)));
        return {
          selectionStart: lineRange.start,
          selectionEnd: lineRange.end,
          lineStart: lineRange.lineNumber,
          lineEnd: lineRange.lineNumber,
          selectedText: current.slice(lineRange.start, lineRange.end),
          selectedDisplayText: current.slice(lineRange.start, lineRange.end),
        };
      }

      function resolveReviewNoteRange(note, text) {
        const source = String(text || "");
        const safeStart = Math.max(0, Math.min(Number(note && note.selectionStart) || 0, source.length));
        const safeEnd = Math.max(safeStart, Math.min(Number(note && note.selectionEnd) || safeStart, source.length));
        const selectedText = String(note && note.selectedText ? note.selectedText : "");
        if (selectedText && source.slice(safeStart, safeEnd) === selectedText) {
          return { start: safeStart, end: safeEnd };
        }
        if (!selectedText && safeEnd >= safeStart) {
          return { start: safeStart, end: safeEnd };
        }
        if (selectedText) {
          const foundIndex = source.indexOf(selectedText);
          if (foundIndex >= 0) {
            return { start: foundIndex, end: foundIndex + selectedText.length };
          }
        }
        return getLineRangeForNumbers(source, note && note.lineStart, note && note.lineEnd);
      }

      function getResolvedReviewNoteLineBounds(note, text) {
        const source = String(text || "");
        const range = resolveReviewNoteRange(note, source);
        if (!range) return null;
        const startLine = getLineNumberAtOffset(source, range.start);
        const endLookupOffset = range.end > range.start ? range.end - 1 : range.start;
        const endLine = getLineNumberAtOffset(source, endLookupOffset);
        return {
          start: range.start,
          end: range.end,
          lineStart: startLine,
          lineEnd: Math.max(startLine, endLine),
        };
      }

      function getDiffFileLabelForLine(source, lineNumber) {
        const lines = String(source || "").replace(/\r\n/g, "\n").split("\n");
        const safeLine = Math.max(1, Math.min(Math.floor(Number(lineNumber) || 1), Math.max(1, lines.length)));
        let currentFile = "";
        for (let i = 0; i < safeLine; i += 1) {
          const line = String(lines[i] || "");
          const diffMatch = line.match(/^diff --git\s+a\/(.+?)\s+b\/(.+?)\s*$/);
          if (diffMatch) {
            currentFile = diffMatch[2] || diffMatch[1] || currentFile;
            continue;
          }
          const plusMatch = line.match(/^\+\+\+\s+(?:b\/)?(.+)\s*$/);
          if (plusMatch && plusMatch[1] && plusMatch[1] !== "/dev/null") {
            currentFile = plusMatch[1];
          }
        }
        return currentFile.trim();
      }

      function getReviewNotePromptFileLabel(note, source) {
        if (sourceState && sourceState.path) return String(sourceState.path);
        const bounds = getResolvedReviewNoteLineBounds(note, source);
        const diffFile = bounds ? getDiffFileLabelForLine(source, bounds.lineStart) : "";
        if (diffFile) return diffFile;
        const descriptor = getCurrentStudioDocumentDescriptor();
        return descriptor && descriptor.fileBacked ? descriptor.label : "";
      }

      function formatReviewNotePromptLineRange(bounds, note) {
        const start = bounds ? bounds.lineStart : Math.max(1, Number(note && note.lineStart) || 1);
        const end = bounds ? bounds.lineEnd : Math.max(start, Number(note && note.lineEnd) || start);
        return start === end ? "L" + start : ("L" + start + "-L" + end);
      }

      function buildReviewNotesPrompt() {
        const source = String(sourceTextEl && sourceTextEl.value ? sourceTextEl.value : "");
        const notes = getDisplayReviewNotes().filter((note) => String(note && note.text ? note.text : "").trim());
        if (!notes.length) return "";

        const descriptor = getCurrentStudioDocumentDescriptor();
        const documentLabel = descriptor && descriptor.label ? descriptor.label : (sourceState && sourceState.label ? sourceState.label : "Studio document");
        const parts = [
          "Please address the following Studio comments. Use the file names and line numbers as anchors. The full document is not included here, only the comments and their anchors.",
          "Document: " + documentLabel,
          "",
          "## Comments",
        ];

        notes.forEach((note, index) => {
          const bounds = getResolvedReviewNoteLineBounds(note, source);
          const fileLabel = getReviewNotePromptFileLabel(note, source);
          const location = (fileLabel ? (fileLabel + ":") : "") + formatReviewNotePromptLineRange(bounds, note);
          const comment = String(note && note.text ? note.text : "").trim();
          const anchor = String(note && (note.selectedDisplayText || note.selectedText) ? (note.selectedDisplayText || note.selectedText) : "")
            .replace(/\s+/g, " ")
            .trim();
          parts.push(
            "### Comment " + (index + 1) + " — " + location,
            "",
            comment,
          );
          if (anchor) {
            parts.push("", "> " + anchor.replace(/\n/g, "\n> "));
          }
          parts.push("");
        });

        return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
      }

      function loadReviewNotesPromptIntoEditor() {
        const prompt = buildReviewNotesPrompt();
        if (!prompt.trim()) {
          setStatus("No non-empty comments to load as a prompt.", "warning");
          return;
        }
        setEditorText(prompt, { preserveScroll: false, preserveSelection: false });
        setSourceState({ source: "blank", label: "comments prompt", path: null });
        setStatus("Loaded comments prompt into editor.", "success");
      }

      function buildReviewNoteLineMap(text) {
        const source = String(text || "");
        const lineMap = new Map();
        for (const note of reviewNotes) {
          const bounds = getResolvedReviewNoteLineBounds(note, source);
          if (!bounds) continue;
          for (let line = bounds.lineStart; line <= bounds.lineEnd; line += 1) {
            const notesForLine = lineMap.get(line) || [];
            notesForLine.push(note);
            lineMap.set(line, notesForLine);
          }
        }
        return lineMap;
      }

      function supportsPreviewCommentsForCurrentEditor() {
        return editorLanguage === "markdown"
          || editorLanguage === "latex"
          || supportsCodePreviewCommentsForCurrentEditor();
      }

      function getPreviewCommentBlockKindLabel(kind) {
        if (kind === "heading") return "heading";
        if (kind === "blockquote") return "quote block";
        if (kind === "list") return "list";
        if (kind === "math") return "equation";
        if (kind === "figure") return "figure";
        if (kind === "algorithm") return "algorithm block";
        if (kind === "page-break") return "page break";
        if (kind === "code") return "code block";
        if (kind === "table") return "table";
        if (kind === "code-line") return "code line";
        if (kind === "diff-line") return "diff line";
        if (kind === "text-line") return "text line";
        return "paragraph";
      }

      function supportsPreviewSelectionCommentsForBlockKind(kind) {
        return kind === "paragraph"
          || kind === "heading"
          || kind === "blockquote"
          || kind === "list"
          || kind === "math"
          || kind === "code"
          || kind === "code-line"
          || kind === "diff-line"
          || kind === "text-line";
      }

      const DISPLAY_MATH_ENV_NAMES = new Set([
        "displaymath",
        "equation",
        "equation*",
        "align",
        "align*",
        "aligned",
        "gather",
        "gather*",
        "multline",
        "multline*",
        "eqnarray",
        "eqnarray*",
        "split",
      ]);

      function isEscapedAt(text, index) {
        let slashCount = 0;
        for (let i = index - 1; i >= 0 && text[i] === "\\"; i -= 1) {
          slashCount += 1;
        }
        return (slashCount % 2) === 1;
      }

      function readBalancedLatexGroup(source, startIndex, openChar, closeChar) {
        if (!source || source[startIndex] !== openChar) return null;
        let depth = 0;
        for (let index = startIndex; index < source.length; index += 1) {
          const ch = source[index];
          if (ch === "\\") {
            index += 1;
            continue;
          }
          if (ch === openChar) {
            depth += 1;
            continue;
          }
          if (ch === closeChar) {
            depth -= 1;
            if (depth === 0) {
              return {
                start: startIndex,
                contentStart: startIndex + 1,
                contentEnd: index,
                end: index + 1,
              };
            }
          }
        }
        return null;
      }

      const DROPPED_MARKDOWN_RAW_TEX_GROUP_COMMANDS = new Set([
        "textbf",
        "textit",
        "emph",
        "underline",
        "texttt",
        "textrm",
        "textsf",
        "textsc",
        "mbox",
        "makebox",
        "framebox",
        "fbox",
        "url",
        "path",
        "nolinkurl",
      ]);
      const DROPPED_MARKDOWN_RAW_TEX_DOUBLE_GROUP_COMMANDS = new Set([
        "href",
        "hyperref",
      ]);
      const DROPPED_MARKDOWN_RAW_TEX_STANDALONE_COMMANDS = new Set([
        "latex",
        "tex",
        "newpage",
        "pagebreak",
        "clearpage",
      ]);

      function skipLatexWhitespace(source, startIndex) {
        let index = startIndex;
        while (index < source.length && /\s/.test(source[index])) index += 1;
        return index;
      }

      function parseLatexCommandAt(source, startIndex) {
        if (!source || source[startIndex] !== "\\") return null;
        let index = startIndex + 1;
        if (index >= source.length) {
          return { name: "", end: index };
        }
        if (/[A-Za-z@]/.test(source[index])) {
          const nameStart = index;
          while (index < source.length && /[A-Za-z@]/.test(source[index])) index += 1;
          if (source[index] === "*") index += 1;
          return {
            name: source.slice(nameStart, index),
            end: index,
          };
        }
        return {
          name: source[index],
          end: index + 1,
        };
      }

      function collectDisplayMathRanges(text) {
        const source = String(text || "");
        const ranges = [];
        let index = 0;

        while (index < source.length) {
          if (source[index] === "%" && !isEscapedAt(source, index)) {
            while (index < source.length && source[index] !== "\n") index += 1;
            continue;
          }
          if (source.startsWith("$$", index)) {
            const close = source.indexOf("$$", index + 2);
            if (close >= 0) {
              ranges.push({
                start: index,
                end: close + 2,
                bodyStart: index + 2,
                bodyEnd: close,
                bodyText: source.slice(index + 2, close),
              });
              index = close + 2;
              continue;
            }
          }
          if (source.startsWith("\\[", index)) {
            const close = source.indexOf("\\]", index + 2);
            if (close >= 0) {
              ranges.push({
                start: index,
                end: close + 2,
                bodyStart: index + 2,
                bodyEnd: close,
                bodyText: source.slice(index + 2, close),
              });
              index = close + 2;
              continue;
            }
          }
          if (source.startsWith("\\begin{", index)) {
            const envGroup = readBalancedLatexGroup(source, index + 6, "{", "}");
            const envName = envGroup ? source.slice(envGroup.contentStart, envGroup.contentEnd).trim() : "";
            if (envName && DISPLAY_MATH_ENV_NAMES.has(envName)) {
              const closeToken = "\\end{" + envName + "}";
              const close = source.indexOf(closeToken, envGroup.end);
              if (close >= 0) {
                ranges.push({
                  start: index,
                  end: close + closeToken.length,
                  bodyStart: envGroup.end,
                  bodyEnd: close,
                  bodyText: source.slice(envGroup.end, close),
                });
                index = close + closeToken.length;
                continue;
              }
            }
          }
          index += 1;
        }

        return ranges;
      }

      function getStandaloneDisplayMathRange(text) {
        const source = String(text || "");
        const leadingMatch = source.match(/^\s*/);
        const trailingMatch = source.match(/\s*$/);
        const leadingLength = leadingMatch ? leadingMatch[0].length : 0;
        const trailingLength = trailingMatch ? trailingMatch[0].length : 0;
        const trimmedEnd = Math.max(leadingLength, source.length - trailingLength);
        const trimmed = source.slice(leadingLength, trimmedEnd);
        if (!trimmed) return null;
        const ranges = collectDisplayMathRanges(trimmed);
        if (ranges.length !== 1) return null;
        const range = ranges[0];
        if (!range || range.start !== 0 || range.end !== trimmed.length) return null;
        return {
          start: leadingLength + range.start,
          end: leadingLength + range.end,
          bodyStart: leadingLength + range.bodyStart,
          bodyEnd: leadingLength + range.bodyEnd,
          bodyText: String(range.bodyText || ""),
        };
      }

      const LATEX_PREVIEW_HEADING_COMMANDS = new Set([
        "part",
        "chapter",
        "section",
        "subsection",
        "subsubsection",
        "paragraph",
        "subparagraph",
      ]);
      const LATEX_PREVIEW_VISIBLE_GROUP_COMMANDS = new Set([
        "part",
        "chapter",
        "section",
        "subsection",
        "subsubsection",
        "paragraph",
        "subparagraph",
        "title",
        "author",
        "caption",
        "text",
        "textbf",
        "textit",
        "emph",
        "underline",
        "texttt",
        "textrm",
        "textsf",
        "textsc",
        "mbox",
        "makebox",
        "framebox",
        "fbox",
        "url",
        "path",
        "nolinkurl",
      ]);
      const LATEX_PREVIEW_SECOND_ARG_VISIBLE_COMMANDS = new Set([
        "href",
        "hyperref",
      ]);
      const LATEX_PREVIEW_HIDDEN_COMMANDS = new Set([
        "label",
        "ref",
        "eqref",
        "autoref",
        "pageref",
        "cite",
        "citet",
        "citep",
        "citealt",
        "citeauthor",
        "nocite",
        "footnote",
        "marginpar",
        "index",
        "includegraphics",
        "addbibresource",
      ]);
      const LATEX_PREVIEW_SKIPPED_ENV_NAMES = new Set([
        "document",
        "thebibliography",
        "itemize",
        "enumerate",
        "description",
        "figure",
        "figure*",
        "table",
        "table*",
        "tabular",
        "tabular*",
        "theorem",
        "lemma",
        "proposition",
        "corollary",
        "definition",
        "proof",
        "remark",
        "example",
        "verbatim",
        "lstlisting",
        "minted",
        "algorithm",
        "algorithm*",
        "algorithmic",
      ]);
      const LATEX_PREVIEW_STRUCTURAL_ENV_KIND_BY_NAME = new Map([
        ["figure", "figure"],
        ["figure*", "figure"],
        ["table", "table"],
        ["table*", "table"],
        ["algorithm", "algorithm"],
        ["algorithm*", "algorithm"],
      ]);

      function stripLatexPreviewComments(text) {
        const source = String(text || "");
        let out = "";
        for (let index = 0; index < source.length; index += 1) {
          const ch = source[index];
          if (ch === "%" && !isEscapedAt(source, index)) {
            while (index < source.length && source[index] !== "\n") index += 1;
            if (index < source.length && source[index] === "\n") {
              out += "\n";
            }
            continue;
          }
          out += ch;
        }
        return out;
      }

      function skipLatexPreviewCommentSpace(source, startIndex) {
        let index = Math.max(0, Number(startIndex) || 0);
        while (index < source.length) {
          const ch = source[index];
          if (/\s/.test(ch)) {
            index += 1;
            continue;
          }
          if (ch === "%" && !isEscapedAt(source, index)) {
            while (index < source.length && source[index] !== "\n") index += 1;
            continue;
          }
          break;
        }
        return index;
      }

      function readLatexHeadingChunk(chunkText) {
        const source = String(chunkText || "");
        let index = skipLatexPreviewCommentSpace(source, 0);
        const command = parseLatexCommandAt(source, index);
        const commandName = command && command.name
          ? String(command.name || "").replace(/\*$/, "").toLowerCase()
          : "";
        if (!command || !LATEX_PREVIEW_HEADING_COMMANDS.has(commandName)) return null;
        index = skipLatexPreviewCommentSpace(source, command.end);
        if (source[index] === "[") {
          const optionalGroup = readBalancedLatexGroup(source, index, "[", "]");
          if (optionalGroup) {
            index = skipLatexPreviewCommentSpace(source, optionalGroup.end);
          }
        }
        if (source[index] !== "{") return null;
        const titleGroup = readBalancedLatexGroup(source, index, "{", "}");
        if (!titleGroup) return null;
        index = skipLatexPreviewCommentSpace(source, titleGroup.end);
        while (index < source.length) {
          const trailingCommand = parseLatexCommandAt(source, index);
          const trailingName = trailingCommand && trailingCommand.name
            ? String(trailingCommand.name || "").replace(/\*$/, "").toLowerCase()
            : "";
          if (!trailingCommand || !LATEX_PREVIEW_HIDDEN_COMMANDS.has(trailingName)) {
            break;
          }
          let nextIndex = skipLatexPreviewCommentSpace(source, trailingCommand.end);
          if (source[nextIndex] === "[") {
            const optionalGroup = readBalancedLatexGroup(source, nextIndex, "[", "]");
            if (optionalGroup) {
              nextIndex = skipLatexPreviewCommentSpace(source, optionalGroup.end);
            }
          }
          if (source[nextIndex] === "{") {
            const argGroup = readBalancedLatexGroup(source, nextIndex, "{", "}");
            if (argGroup) {
              nextIndex = skipLatexPreviewCommentSpace(source, argGroup.end);
            }
          }
          index = nextIndex;
        }
        if (skipLatexPreviewCommentSpace(source, index) < source.length) return null;
        return {
          commandName,
          titleText: source.slice(titleGroup.contentStart, titleGroup.contentEnd),
        };
      }

      function extractLatexPreviewVisibleText(text) {
        const source = String(text || "");
        let out = "";
        let index = 0;

        while (index < source.length) {
          const ch = source[index];
          if (ch === "%" && !isEscapedAt(source, index)) {
            while (index < source.length && source[index] !== "\n") index += 1;
            continue;
          }
          if (source.startsWith("$$", index)) {
            const close = source.indexOf("$$", index + 2);
            if (close >= 0) {
              out += " " + source.slice(index + 2, close) + " ";
              index = close + 2;
              continue;
            }
          }
          if (ch === "$" && !isEscapedAt(source, index)) {
            const close = findClosingUnescapedSequence(source, index + 1, "$", true);
            if (close >= 0) {
              out += " " + source.slice(index + 1, close) + " ";
              index = close + 1;
              continue;
            }
          }
          if (source.startsWith("\\(", index)) {
            const close = source.indexOf("\\)", index + 2);
            if (close >= 0) {
              out += " " + source.slice(index + 2, close) + " ";
              index = close + 2;
              continue;
            }
          }
          if (source.startsWith("\\[", index)) {
            const close = source.indexOf("\\]", index + 2);
            if (close >= 0) {
              out += " " + source.slice(index + 2, close) + " ";
              index = close + 2;
              continue;
            }
          }
          if (source.startsWith("\\begin{", index)) {
            const envGroup = readBalancedLatexGroup(source, index + 6, "{", "}");
            const envName = envGroup ? source.slice(envGroup.contentStart, envGroup.contentEnd).trim() : "";
            if (envName && DISPLAY_MATH_ENV_NAMES.has(envName)) {
              const closeToken = "\\end{" + envName + "}";
              const close = source.indexOf(closeToken, envGroup.end);
              if (close >= 0) {
                out += " " + source.slice(envGroup.end, close) + " ";
                index = close + closeToken.length;
                continue;
              }
            }
          }
          if (source.startsWith("\\end{", index)) {
            const envGroup = readBalancedLatexGroup(source, index + 4, "{", "}");
            if (envGroup) {
              index = envGroup.end;
              continue;
            }
          }
          if (ch === "\\") {
            const command = parseLatexCommandAt(source, index);
            const commandName = command && command.name
              ? String(command.name || "").replace(/\*$/, "").toLowerCase()
              : "";
            if (!command) {
              index += 1;
              continue;
            }
            if (commandName === "begin" || commandName === "end") {
              let nextIndex = skipLatexWhitespace(source, command.end);
              if (source[nextIndex] === "{") {
                const group = readBalancedLatexGroup(source, nextIndex, "{", "}");
                if (group) {
                  index = group.end;
                  continue;
                }
              }
            }
            if (commandName === "latex") {
              out += "LaTeX";
              index = command.end;
              continue;
            }
            if (commandName === "tex") {
              out += "TeX";
              index = command.end;
              continue;
            }
            if (commandName === "item") {
              out += " ";
              index = command.end;
              continue;
            }
            let nextIndex = skipLatexWhitespace(source, command.end);
            if (source[nextIndex] === "[") {
              const optionalGroup = readBalancedLatexGroup(source, nextIndex, "[", "]");
              if (optionalGroup) {
                nextIndex = skipLatexWhitespace(source, optionalGroup.end);
              }
            }
            if (LATEX_PREVIEW_VISIBLE_GROUP_COMMANDS.has(commandName) && source[nextIndex] === "{") {
              const group = readBalancedLatexGroup(source, nextIndex, "{", "}");
              if (group) {
                out += " " + extractLatexPreviewVisibleText(source.slice(group.contentStart, group.contentEnd)) + " ";
                index = group.end;
                continue;
              }
            }
            if (LATEX_PREVIEW_SECOND_ARG_VISIBLE_COMMANDS.has(commandName) && source[nextIndex] === "{") {
              const firstGroup = readBalancedLatexGroup(source, nextIndex, "{", "}");
              if (firstGroup) {
                let secondIndex = skipLatexWhitespace(source, firstGroup.end);
                if (source[secondIndex] === "{") {
                  const secondGroup = readBalancedLatexGroup(source, secondIndex, "{", "}");
                  if (secondGroup) {
                    out += " " + extractLatexPreviewVisibleText(source.slice(secondGroup.contentStart, secondGroup.contentEnd)) + " ";
                    index = secondGroup.end;
                    continue;
                  }
                }
              }
            }
            if (LATEX_PREVIEW_HIDDEN_COMMANDS.has(commandName)) {
              index = nextIndex;
              if (source[index] === "{") {
                const group = readBalancedLatexGroup(source, index, "{", "}");
                if (group) {
                  index = group.end;
                  continue;
                }
              }
              index = command.end;
              continue;
            }
            index = command.end;
            continue;
          }
          if (ch === "{" || ch === "}") {
            index += 1;
            continue;
          }
          if (ch === "~") {
            out += " ";
            index += 1;
            continue;
          }
          out += ch;
          index += 1;
        }

        return normalizeVisiblePreviewText(out);
      }

      function findLatexDocumentBodyRange(text) {
        const source = String(text || "");
        const beginMatch = source.match(/\\begin\{document\}/);
        if (!beginMatch || beginMatch.index == null) {
          return { start: 0, end: source.length };
        }
        const start = beginMatch.index + beginMatch[0].length;
        const endMatch = source.slice(start).match(/\\end\{document\}/);
        return {
          start,
          end: endMatch && endMatch.index != null ? (start + endMatch.index) : source.length,
        };
      }

      function normalizeLatexPreviewBlockText(blockText, kind) {
        const source = String(blockText || "");
        if (/\\(?:bibliography|printbibliography)\b/i.test(source)) {
          return kind === "heading" ? "References" : "references";
        }
        if (kind === "math") {
          const mathRange = getStandaloneDisplayMathRange(stripLatexPreviewComments(source));
          return mathRange ? normalizeVisiblePreviewText(mathRange.bodyText) : normalizeVisiblePreviewText(source);
        }
        if (kind === "heading") {
          const heading = readLatexHeadingChunk(stripLatexPreviewComments(source));
          return heading ? extractLatexPreviewVisibleText(heading.titleText) : extractLatexPreviewVisibleText(source);
        }
        return extractLatexPreviewVisibleText(source);
      }

      function isLatexPreviewSkippableChunk(chunkText) {
        const source = stripLatexPreviewComments(chunkText).trim();
        if (!source) return true;
        const command = parseLatexCommandAt(source, 0);
        const commandName = command && command.name
          ? String(command.name || "").replace(/\*$/, "").toLowerCase()
          : "";
        if (command && LATEX_PREVIEW_HIDDEN_COMMANDS.has(commandName)) return true;
        if (command && /^(?:documentclass|usepackage|newtheorem|title|author|date|maketitle|tableofcontents)$/i.test(commandName)) return true;
        if (source.startsWith("\\begin{")) {
          const envGroup = readBalancedLatexGroup(source, 6, "{", "}");
          const envName = envGroup ? source.slice(envGroup.contentStart, envGroup.contentEnd).trim().toLowerCase() : "";
          if (envName && LATEX_PREVIEW_SKIPPED_ENV_NAMES.has(envName)) return true;
        }
        return false;
      }

      function normalizePreviewComparableCharacter(character) {
        switch (String(character || "")) {
          case "\u2018":
          case "\u2019":
          case "\u201A":
          case "\u201B":
            return "'";
          case "\u201C":
          case "\u201D":
          case "\u201E":
          case "\u201F":
            return '"';
          case "\u2013":
          case "\u2014":
          case "\u2212":
            return "-";
          case "\u2026":
            return "…";
          default:
            return String(character || "");
        }
      }

      function normalizeVisiblePreviewText(text) {
        const source = String(text || "");
        let normalized = "";
        let pendingWhitespace = false;
        for (let i = 0; i < source.length; i += 1) {
          let character = source[i] === "." && source.slice(i, i + 3) === "..."
            ? "…"
            : normalizePreviewComparableCharacter(source[i]);
          if (character === "…" && source[i] === "." && source.slice(i, i + 3) === "...") {
            i += 2;
          }
          if (/\s/.test(character)) {
            if (normalized) {
              pendingWhitespace = true;
            }
            continue;
          }
          if (pendingWhitespace && normalized) {
            normalized += " ";
            pendingWhitespace = false;
          }
          normalized += character;
        }
        return normalized.trim();
      }

      function splitSourcePreviewCommentBlockByDisplayMath(sourceText, block) {
        if (!block || block.kind !== "paragraph") {
          return block ? [block] : [];
        }
        const source = String(sourceText || "");
        const blockStart = Math.max(0, Math.min(Number(block.start) || 0, source.length));
        const blockEnd = Math.max(blockStart, Math.min(Number(block.end) || blockStart, source.length));
        const blockText = source.slice(blockStart, blockEnd);
        const mathRanges = collectDisplayMathRanges(blockText);
        if (mathRanges.length === 0) {
          return [block];
        }

        const segments = [];
        function pushSegment(kind, relativeStart, relativeEnd) {
          const safeRelativeStart = Math.max(0, Math.min(relativeStart, blockText.length));
          const safeRelativeEnd = Math.max(safeRelativeStart, Math.min(relativeEnd, blockText.length));
          if (safeRelativeEnd <= safeRelativeStart) return;
          const absoluteStart = blockStart + safeRelativeStart;
          const absoluteEnd = blockStart + safeRelativeEnd;
          const segmentText = source.slice(absoluteStart, absoluteEnd);
          if (kind === "paragraph" && !normalizeVisiblePreviewText(segmentText)) {
            return;
          }
          segments.push({
            kind,
            start: absoluteStart,
            end: absoluteEnd,
            lineStart: getLineNumberAtOffset(source, absoluteStart),
            lineEnd: getLineNumberAtOffset(source, Math.max(absoluteStart, absoluteEnd - 1)),
          });
        }

        let cursor = 0;
        mathRanges.forEach((mathRange) => {
          if (!mathRange) return;
          pushSegment("paragraph", cursor, mathRange.start);
          pushSegment("math", mathRange.start, mathRange.end);
          cursor = mathRange.end;
        });
        pushSegment("paragraph", cursor, blockText.length);

        return segments.length > 0 ? segments : [block];
      }

      function expandSourcePreviewCommentBlocksByDisplayMath(sourceText, blocks) {
        const expanded = [];
        (Array.isArray(blocks) ? blocks : []).forEach((block) => {
          expanded.push(...splitSourcePreviewCommentBlockByDisplayMath(sourceText, block));
        });
        return expanded;
      }

      function appendMappedPreviewSlice(chars, rawOffsets, lineText, lineBaseOffset, start, end) {
        const safeStart = Math.max(0, Math.min(start, lineText.length));
        const safeEnd = Math.max(safeStart, Math.min(end, lineText.length));
        for (let i = safeStart; i < safeEnd; i += 1) {
          chars.push(lineText[i]);
          rawOffsets.push(lineBaseOffset + i);
        }
      }

      function buildPreviewSelectionSourceBody(blockText, kind) {
        const source = String(blockText || "");
        const lines = source.split("\n");
        const lineOffsets = [];
        let runningOffset = 0;
        for (const line of lines) {
          lineOffsets.push(runningOffset);
          runningOffset += line.length + 1;
        }

        const chars = [];
        const rawOffsets = [];

        function appendLineWithStart(lineIndex, start, end) {
          const line = lineIndex >= 0 && lineIndex < lines.length ? lines[lineIndex] : "";
          appendMappedPreviewSlice(chars, rawOffsets, line, lineOffsets[lineIndex] || 0, start, end);
          if (lineIndex < lines.length - 1) {
            chars.push("\n");
            rawOffsets.push((lineOffsets[lineIndex] || 0) + line.length);
          }
        }

        if (kind === "heading") {
          const firstLine = lines[0] || "";
          const atxMatch = firstLine.match(/^ {0,3}#{1,6}(?:[ \t]+|$)/);
          if (atxMatch) {
            const start = atxMatch[0].length;
            let end = firstLine.length;
            const closingMatch = firstLine.slice(start).match(/[ \t]+#+[ \t]*$/);
            if (closingMatch) {
              end -= closingMatch[0].length;
            }
            appendMappedPreviewSlice(chars, rawOffsets, firstLine, lineOffsets[0] || 0, start, end);
            return { text: chars.join(""), rawOffsets };
          }
          if (lines.length >= 2 && /^ {0,3}(?:={3,}|-{3,})\s*$/.test(lines[1] || "")) {
            appendMappedPreviewSlice(chars, rawOffsets, firstLine, lineOffsets[0] || 0, 0, firstLine.length);
            return { text: chars.join(""), rawOffsets };
          }
        }

        if (kind === "math") {
          const mathRange = getStandaloneDisplayMathRange(source);
          if (mathRange) {
            appendMappedPreviewSlice(chars, rawOffsets, source, 0, mathRange.bodyStart, mathRange.bodyEnd);
            return { text: chars.join(""), rawOffsets };
          }
        }

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
          const line = lines[lineIndex] || "";
          if (kind === "blockquote") {
            const prefixMatch = line.match(/^ {0,3}> ?/);
            appendLineWithStart(lineIndex, prefixMatch ? prefixMatch[0].length : 0, line.length);
            continue;
          }
          if (kind === "list") {
            if (!line.trim()) {
              appendLineWithStart(lineIndex, 0, 0);
              continue;
            }
            const itemMatch = line.match(/^ {0,3}(?:[*+-]|\d+[.)])(?:[ \t]+|$)/);
            if (itemMatch) {
              appendLineWithStart(lineIndex, itemMatch[0].length, line.length);
              continue;
            }
            const continuationMatch = line.match(/^(?: {1,4}|\t)/);
            appendLineWithStart(lineIndex, continuationMatch ? continuationMatch[0].length : 0, line.length);
            continue;
          }
          appendLineWithStart(lineIndex, 0, line.length);
        }

        return { text: chars.join(""), rawOffsets };
      }

      function findClosingUnescapedSequence(source, startIndex, sequence) {
        const text = String(source || "");
        const needle = String(sequence || "");
        if (!text || !needle) return -1;
        let searchIndex = Math.max(0, Number(startIndex) || 0);
        while (searchIndex <= text.length) {
          const matchIndex = text.indexOf(needle, searchIndex);
          if (matchIndex < 0) return -1;
          let backslashCount = 0;
          for (let i = matchIndex - 1; i >= 0 && text[i] === "\\"; i -= 1) {
            backslashCount += 1;
          }
          if (backslashCount % 2 === 0) {
            return matchIndex;
          }
          searchIndex = matchIndex + needle.length;
        }
        return -1;
      }

      function buildPreviewInlineDisplayMap(text, rawOffsets) {
        const source = String(text || "");
        const rawMap = Array.isArray(rawOffsets) ? rawOffsets : [];
        const displayChars = [];
        const charStarts = [];
        const charEnds = [];

        function appendChar(character, rawStart, rawEnd) {
          displayChars.push(character);
          charStarts.push(rawStart);
          charEnds.push(rawEnd);
        }

        function appendRawRange(startIndex, endIndex) {
          for (let i = startIndex; i < endIndex; i += 1) {
            appendChar(source[i], rawMap[i], rawMap[i] + 1);
          }
        }

        function appendNestedRange(startIndex, endIndex) {
          const nested = buildPreviewInlineDisplayMap(
            source.slice(startIndex, endIndex),
            rawMap.slice(startIndex, endIndex),
          );
          for (let i = 0; i < nested.text.length; i += 1) {
            appendChar(nested.text[i], nested.charStarts[i], nested.charEnds[i]);
          }
        }

        let index = 0;
        while (index < source.length) {
          const remaining = source.slice(index);
          const linkMatch = remaining.match(/^!?\[([^\]]*)\]\(([^)]*)\)/);
          if (linkMatch) {
            const labelStart = index + (remaining[0] === "!" ? 2 : 1);
            const labelEnd = labelStart + String(linkMatch[1] || "").length;
            appendNestedRange(labelStart, labelEnd);
            index += linkMatch[0].length;
            continue;
          }

          if (source[index] === "`") {
            let tickCount = 1;
            while (source[index + tickCount] === "`") tickCount += 1;
            const fence = "`".repeat(tickCount);
            const closeIndex = source.indexOf(fence, index + tickCount);
            if (closeIndex >= 0) {
              appendRawRange(index + tickCount, closeIndex);
              index = closeIndex + tickCount;
              continue;
            }
          }

          if (remaining.startsWith("\\(")) {
            const closeIndex = source.indexOf("\\)", index + 2);
            if (closeIndex >= 0) {
              appendRawRange(index + 2, closeIndex);
              index = closeIndex + 2;
              continue;
            }
          }

          if (remaining.startsWith("\\[")) {
            const closeIndex = source.indexOf("\\]", index + 2);
            if (closeIndex >= 0) {
              appendRawRange(index + 2, closeIndex);
              index = closeIndex + 2;
              continue;
            }
          }

          if (remaining.startsWith("$$")) {
            const closeIndex = findClosingUnescapedSequence(source, index + 2, "$$");
            if (closeIndex >= 0) {
              appendRawRange(index + 2, closeIndex);
              index = closeIndex + 2;
              continue;
            }
          }

          if (source[index] === "$") {
            const closeIndex = findClosingUnescapedSequence(source, index + 1, "$");
            if (closeIndex >= 0) {
              appendRawRange(index + 1, closeIndex);
              index = closeIndex + 1;
              continue;
            }
          }

          if (source[index] === "\\" && index + 1 < source.length) {
            const latexCommand = parseLatexCommandAt(source, index);
            const normalizedCommandName = latexCommand && latexCommand.name
              ? String(latexCommand.name || "").replace(/\*$/, "").toLowerCase()
              : "";
            const isDroppedLatexCommand = Boolean(
              normalizedCommandName
              && (
                DROPPED_MARKDOWN_RAW_TEX_GROUP_COMMANDS.has(normalizedCommandName)
                || DROPPED_MARKDOWN_RAW_TEX_DOUBLE_GROUP_COMMANDS.has(normalizedCommandName)
                || DROPPED_MARKDOWN_RAW_TEX_STANDALONE_COMMANDS.has(normalizedCommandName)
              )
            );
            if (latexCommand && isDroppedLatexCommand) {
              let nextIndex = skipLatexWhitespace(source, latexCommand.end);
              if (source[nextIndex] === "[") {
                const optionalGroup = readBalancedLatexGroup(source, nextIndex, "[", "]");
                if (optionalGroup) {
                  nextIndex = skipLatexWhitespace(source, optionalGroup.end);
                }
              }
              if (DROPPED_MARKDOWN_RAW_TEX_GROUP_COMMANDS.has(normalizedCommandName) || DROPPED_MARKDOWN_RAW_TEX_DOUBLE_GROUP_COMMANDS.has(normalizedCommandName)) {
                if (source[nextIndex] === "{") {
                  const firstGroup = readBalancedLatexGroup(source, nextIndex, "{", "}");
                  if (firstGroup) {
                    nextIndex = skipLatexWhitespace(source, firstGroup.end);
                  }
                }
              }
              if (DROPPED_MARKDOWN_RAW_TEX_DOUBLE_GROUP_COMMANDS.has(normalizedCommandName) && source[nextIndex] === "{") {
                const secondGroup = readBalancedLatexGroup(source, nextIndex, "{", "}");
                if (secondGroup) {
                  nextIndex = skipLatexWhitespace(source, secondGroup.end);
                }
              }
              index = Math.max(index + 1, nextIndex);
              continue;
            }
            appendChar(source[index + 1], rawMap[index], rawMap[index + 1] + 1);
            index += 2;
            continue;
          }

          const htmlTagMatch = remaining.match(/^<\/?[A-Za-z][^>]*>/);
          if (htmlTagMatch) {
            index += htmlTagMatch[0].length;
            continue;
          }

          const emphasisMatch = remaining.match(/^(?:\*\*\*|\*\*|\*|___|__|_|~~)/);
          if (emphasisMatch) {
            index += emphasisMatch[0].length;
            continue;
          }

          appendChar(source[index], rawMap[index], rawMap[index] + 1);
          index += 1;
        }

        return {
          text: displayChars.join(""),
          charStarts,
          charEnds,
        };
      }

      function buildNormalizedPreviewDisplayMap(displayText, charStarts, charEnds) {
        const source = String(displayText || "");
        const outChars = [];
        const outStarts = [];
        const outEnds = [];
        let pendingWhitespaceStart = null;
        let pendingWhitespaceEnd = null;

        for (let i = 0; i < source.length; i += 1) {
          let character = normalizePreviewComparableCharacter(source[i]);
          let startRef = charStarts[i];
          let endRef = charEnds[i];
          if (source[i] === "." && source.slice(i, i + 3) === "...") {
            character = "…";
            endRef = charEnds[Math.min(i + 2, charEnds.length - 1)];
            i += 2;
          }
          if (/\s/.test(character)) {
            if (outChars.length === 0) continue;
            if (pendingWhitespaceStart == null) {
              pendingWhitespaceStart = startRef;
            }
            pendingWhitespaceEnd = endRef;
            continue;
          }

          if (pendingWhitespaceStart != null && pendingWhitespaceEnd != null) {
            outChars.push(" ");
            outStarts.push(pendingWhitespaceStart);
            outEnds.push(pendingWhitespaceEnd);
            pendingWhitespaceStart = null;
            pendingWhitespaceEnd = null;
          }

          outChars.push(character);
          outStarts.push(startRef);
          outEnds.push(endRef);
        }

        return {
          text: outChars.join(""),
          charStarts: outStarts,
          charEnds: outEnds,
        };
      }

      function buildNormalizedDomTextMap(rootEl) {
        if (!rootEl || typeof document.createTreeWalker !== "function") {
          return { text: "", charStarts: [], charEnds: [] };
        }
        const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
        const chars = [];
        const starts = [];
        const ends = [];
        let node = walker.nextNode();
        while (node) {
          const textNode = node;
          const value = typeof textNode.nodeValue === "string" ? textNode.nodeValue : "";
          for (let i = 0; i < value.length; i += 1) {
            chars.push(value[i]);
            starts.push({ node: textNode, offset: i });
            ends.push({ node: textNode, offset: i + 1 });
          }
          node = walker.nextNode();
        }
        return buildNormalizedPreviewDisplayMap(chars.join(""), starts, ends);
      }

      function getPreviewMathSearchText(element) {
        if (!element || !(element instanceof Element)) return null;
        const texSourceAttr = element.getAttribute("data-tex-source");
        if (texSourceAttr && texSourceAttr.trim()) {
          return texSourceAttr;
        }
        const tag = element.tagName ? element.tagName.toUpperCase() : "";
        if (tag === "MATH") {
          return typeof element.textContent === "string" ? element.textContent : "";
        }
        if (element.classList && element.classList.contains("math") && (element.classList.contains("inline") || element.classList.contains("display"))) {
          return extractMathFallbackTex(
            typeof element.textContent === "string" ? element.textContent : "",
            element.classList.contains("display"),
          );
        }
        if (
          element.classList
          && (element.classList.contains("studio-display-equation") || element.classList.contains("studio-display-equation-body"))
          && typeof element.querySelector === "function"
        ) {
          const innerMathEl = element.querySelector("[data-tex-source], math[display='block'], .studio-mathjax-fallback-display");
          if (innerMathEl && innerMathEl !== element) {
            return getPreviewMathSearchText(innerMathEl);
          }
        }
        return null;
      }

      function buildNormalizedPreviewSearchText(rootNode) {
        if (!rootNode) return "";
        const parts = [];

        function visit(node) {
          if (!node) return;
          if (node.nodeType === Node.TEXT_NODE) {
            parts.push(typeof node.nodeValue === "string" ? node.nodeValue : "");
            return;
          }
          if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
            return;
          }
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;
            const mathText = getPreviewMathSearchText(element);
            if (mathText != null) {
              parts.push(mathText);
              return;
            }
            if (element.tagName === "BR") {
              parts.push("\n");
              return;
            }
          }
          Array.from(node.childNodes || []).forEach(visit);
        }

        visit(rootNode);
        return normalizeVisiblePreviewText(parts.join(""));
      }

      function buildNormalizedPreviewRangeText(range) {
        if (!range || typeof range.cloneContents !== "function") {
          return "";
        }
        try {
          return buildNormalizedPreviewSearchText(range.cloneContents());
        } catch {
          return normalizeVisiblePreviewText(range.toString());
        }
      }

      function findPreferredNormalizedTextMatch(haystack, needle, preferredIndex) {
        const source = String(haystack || "");
        const query = String(needle || "");
        if (!source || !query) return -1;
        let bestIndex = -1;
        let bestScore = Number.POSITIVE_INFINITY;
        const desiredIndex = Number.isFinite(preferredIndex) ? Math.max(0, preferredIndex) : 0;
        for (let matchIndex = source.indexOf(query); matchIndex >= 0; matchIndex = source.indexOf(query, matchIndex + 1)) {
          const score = Math.abs(matchIndex - desiredIndex);
          if (score < bestScore) {
            bestScore = score;
            bestIndex = matchIndex;
          }
        }
        return bestIndex;
      }

      function buildLiteralPreviewDisplayMap(text, rawOffsets) {
        const source = String(text || "");
        const rawMap = Array.isArray(rawOffsets) ? rawOffsets : [];
        const charStarts = [];
        const charEnds = [];
        for (let i = 0; i < source.length; i += 1) {
          charStarts.push(rawMap[i]);
          charEnds.push(rawMap[i] + 1);
        }
        return buildNormalizedPreviewDisplayMap(source, charStarts, charEnds);
      }

      function buildPreviewSelectionDisplayMap(blockText, kind) {
        const body = buildPreviewSelectionSourceBody(blockText, kind);
        if (kind === "code" || kind === "code-line" || kind === "diff-line" || kind === "text-line") {
          return buildLiteralPreviewDisplayMap(body.text, body.rawOffsets);
        }
        const inlineMap = buildPreviewInlineDisplayMap(body.text, body.rawOffsets);
        return buildNormalizedPreviewDisplayMap(inlineMap.text, inlineMap.charStarts, inlineMap.charEnds);
      }

      function getPreviewCommentBlockKey(blockEl) {
        if (!blockEl || !blockEl.dataset) return "";
        return [
          String(blockEl.dataset.reviewNoteStart || ""),
          String(blockEl.dataset.reviewNoteEnd || ""),
          String(blockEl.dataset.previewCommentKind || ""),
        ].join(":");
      }

      function getPreviewCommentSelectionKey(selection) {
        if (!selection) return "";
        return [
          String(selection.paneId || ""),
          String(selection.blockKey || ""),
          String(selection.selectionStart || 0),
          String(selection.selectionEnd || 0),
          String(selection.selectedDisplayText || ""),
        ].join(":");
      }

      function setActivePreviewCommentSelection(nextSelection) {
        const currentKey = getPreviewCommentSelectionKey(activePreviewCommentSelection);
        const nextKey = getPreviewCommentSelectionKey(nextSelection);
        if (currentKey === nextKey) return;
        activePreviewCommentSelection = nextSelection || null;
        refreshRenderedEditorPreviewComments();
      }

      function clearPreviewCommentSelection() {
        setActivePreviewCommentSelection(null);
      }

      function findPreviewCommentBlockFromNode(node) {
        if (!node) return null;
        const element = node instanceof Element ? node : node.parentElement;
        return element && typeof element.closest === "function"
          ? element.closest(".preview-comment-block")
          : null;
      }

      function getPreviewSelectionPaneIdForNode(node) {
        if (!node) return "";
        const element = node instanceof Element ? node : node.parentElement;
        const paneEl = element && typeof element.closest === "function"
          ? element.closest("#sourcePreview, #critiqueView")
          : null;
        return paneEl && paneEl.id ? String(paneEl.id) : "";
      }

      function getPreviewSelectionPaneElement(paneId) {
        if (paneId === "sourcePreview") return sourcePreviewEl;
        if (paneId === "critiqueView") return critiqueViewEl;
        return null;
      }

      function getActivePreviewSelectionForPane(paneId) {
        if (!paneId) return null;
        return activePreviewCommentSelection && activePreviewCommentSelection.paneId === paneId
          ? activePreviewCommentSelection
          : null;
      }

      function ensurePreviewSelectionActions(targetEl) {
        if (!targetEl || typeof document.createElement !== "function") return null;
        const paneId = targetEl.id ? String(targetEl.id) : "";
        if (!paneId) return null;
        const existing = Array.from(targetEl.children || []).find((child) => child.classList && child.classList.contains("preview-selection-actions"));
        if (existing) {
          existing.dataset.previewPane = paneId;
          return existing;
        }

        const actionsEl = document.createElement("div");
        actionsEl.className = "preview-selection-actions";
        actionsEl.dataset.previewPane = paneId;
        actionsEl.hidden = true;

        const commentBtn = document.createElement("button");
        commentBtn.type = "button";
        commentBtn.className = "preview-comment-add";
        commentBtn.dataset.previewCommentAction = "comment";
        commentBtn.textContent = "Comment";
        commentBtn.hidden = true;
        actionsEl.appendChild(commentBtn);

        const jumpBtn = document.createElement("button");
        jumpBtn.type = "button";
        jumpBtn.className = "preview-comment-jump";
        jumpBtn.dataset.previewCommentAction = "jump";
        jumpBtn.textContent = "Jump";
        jumpBtn.hidden = true;
        actionsEl.appendChild(jumpBtn);

        targetEl.insertBefore(actionsEl, targetEl.firstChild || null);
        return actionsEl;
      }

      function updatePreviewSelectionActions(targetEl) {
        if (!targetEl) return;
        const actionsEl = ensurePreviewSelectionActions(targetEl);
        if (!actionsEl) return;
        const paneId = targetEl.id ? String(targetEl.id) : "";
        const selection = getActivePreviewSelectionForPane(paneId);
        const commentBtn = actionsEl.querySelector(".preview-comment-add");
        const jumpBtn = actionsEl.querySelector(".preview-comment-jump");
        if (!selection) {
          actionsEl.hidden = true;
          if (commentBtn) commentBtn.hidden = true;
          if (jumpBtn) jumpBtn.hidden = true;
          return;
        }
        const lineLabel = summarizeReviewNoteAnchor(selection).toLowerCase();
        const blockKindLabel = getPreviewCommentBlockKindLabel(selection.previewCommentKind || "paragraph");
        actionsEl.hidden = false;
        if (commentBtn) {
          commentBtn.hidden = false;
          commentBtn.dataset.previewCommentMode = "selection";
          commentBtn.dataset.previewPane = paneId;
          commentBtn.title = "Add a local comment from the current preview selection on this " + blockKindLabel + " (" + lineLabel + ").";
          commentBtn.setAttribute("aria-label", commentBtn.title || "Comment");
        }
        if (jumpBtn) {
          jumpBtn.hidden = false;
          jumpBtn.dataset.previewCommentMode = "selection";
          jumpBtn.dataset.previewPane = paneId;
          jumpBtn.title = "Jump to the current preview selection on this " + blockKindLabel + " in the raw editor (" + lineLabel + ").";
          jumpBtn.setAttribute("aria-label", jumpBtn.title || "Jump");
        }
      }

      function unwrapPreviewJumpHighlightElement(element) {
        if (!element || !element.parentNode) return;
        const parent = element.parentNode;
        while (element.firstChild) {
          parent.insertBefore(element.firstChild, element);
        }
        parent.removeChild(element);
        if (typeof parent.normalize === "function") {
          parent.normalize();
        }
      }

      function clearPreviewJumpHighlight(targetEl) {
        if (!targetEl) return;
        const state = previewJumpHighlightState.get(targetEl);
        if (!state) return;
        if (state.timer != null) {
          window.clearTimeout(state.timer);
        }
        if (state.inlineHighlightEl) {
          unwrapPreviewJumpHighlightElement(state.inlineHighlightEl);
        }
        if (state.contentEl && state.contentEl.classList) {
          state.contentEl.classList.remove("preview-jump-highlight");
        }
        previewJumpHighlightState.delete(targetEl);
      }

      function setPreviewJumpHighlight(targetEl, contentEl, inlineHighlightEl) {
        if (!targetEl || !contentEl) return;
        clearPreviewJumpHighlight(targetEl);
        if (contentEl.classList) {
          contentEl.classList.add("preview-jump-highlight");
        }
        const timer = window.setTimeout(() => {
          clearPreviewJumpHighlight(targetEl);
        }, 1800);
        previewJumpHighlightState.set(targetEl, {
          contentEl,
          inlineHighlightEl: inlineHighlightEl || null,
          timer,
        });
      }

      function rangesOverlap(startA, endA, startB, endB) {
        const safeStartA = Math.max(0, Number(startA) || 0);
        const safeStartB = Math.max(0, Number(startB) || 0);
        const safeEndA = Math.max(safeStartA + 1, Number(endA) || safeStartA);
        const safeEndB = Math.max(safeStartB + 1, Number(endB) || safeStartB);
        return safeStartA < safeEndB && safeStartB < safeEndA;
      }

      function scanSourcePreviewCommentBlocks(markdown) {
        if (editorLanguage === "markdown") return scanMarkdownPreviewCommentBlocks(markdown);
        if (editorLanguage === "latex") return scanLatexPreviewCommentBlocks(markdown);
        return [];
      }

      function scanMarkdownPreviewCommentBlocks(markdown) {
        const source = String(markdown || "").replace(/\r\n/g, "\n");
        const lines = source.split("\n");
        const lineOffsets = [];
        let runningOffset = 0;
        for (const line of lines) {
          lineOffsets.push(runningOffset);
          runningOffset += line.length + 1;
        }

        function getLine(index) {
          return index >= 0 && index < lines.length ? String(lines[index] || "") : "";
        }

        function isBlankLine(index) {
          return /^\s*$/.test(getLine(index));
        }

        function lineStartsFence(index) {
          return getLine(index).match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
        }

        function isAtxHeadingLine(index) {
          return /^ {0,3}#{1,6}(?:[ \t]+|$)/.test(getLine(index));
        }

        function isSetextUnderlineLine(index) {
          return /^ {0,3}(?:={3,}|-{3,})\s*$/.test(getLine(index));
        }

        function isThematicBreakLine(index) {
          return /^ {0,3}(?:(?:-\s*){3,}|(?:_\s*){3,}|(?:\*\s*){3,})$/.test(getLine(index));
        }

        function isBlockquoteLine(index) {
          return /^ {0,3}> ?/.test(getLine(index));
        }

        function isListLine(index) {
          return /^ {0,3}(?:[*+-]|\d+[.)])(?:[ \t]+|$)/.test(getLine(index));
        }

        function isContinuationIndentedLine(index) {
          return /^(?: {2,}|\t+)/.test(getLine(index));
        }

        function isPotentialTableRow(index) {
          const line = getLine(index);
          return /\|/.test(line) && !/^\s*</.test(line);
        }

        function isTableDividerLine(index) {
          return /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+(?:\s*:?-{3,}:?\s*)?\|?\s*$/.test(getLine(index));
        }

        function isHtmlCommentStart(index) {
          return /^\s*<!--/.test(getLine(index));
        }

        function isPageBreakLine(index) {
          return /^\\(?:newpage|pagebreak|clearpage)(?:\s*\[[^\]]*\])?\s*$/i.test(getLine(index));
        }

        function makeBlock(kind, startLineIndex, endLineIndex) {
          const safeStartLine = Math.max(0, Math.min(startLineIndex, Math.max(0, lines.length - 1)));
          const safeEndLine = Math.max(safeStartLine, Math.min(endLineIndex, Math.max(0, lines.length - 1)));
          const start = lineOffsets[safeStartLine] || 0;
          const end = (lineOffsets[safeEndLine] || 0) + getLine(safeEndLine).length;
          return {
            kind,
            start,
            end,
            lineStart: safeStartLine + 1,
            lineEnd: safeEndLine + 1,
          };
        }

        function getChunkText(startLineIndex, endLineIndex) {
          const safeStartLine = Math.max(0, Math.min(startLineIndex, Math.max(0, lines.length - 1)));
          const safeEndLine = Math.max(safeStartLine, Math.min(endLineIndex, Math.max(0, lines.length - 1)));
          return source.slice(
            lineOffsets[safeStartLine] || 0,
            (lineOffsets[safeEndLine] || 0) + getLine(safeEndLine).length,
          );
        }

        const blocks = [];
        let index = 0;

        if (/^\s*---\s*$/.test(getLine(0))) {
          for (let i = 1; i < Math.min(lines.length, 80); i += 1) {
            if (/^\s*(?:---|\.\.\.)\s*$/.test(getLine(i))) {
              index = i + 1;
              break;
            }
          }
        }

        while (index < lines.length) {
          if (isBlankLine(index)) {
            index += 1;
            continue;
          }

          if (isHtmlCommentStart(index)) {
            let endComment = index;
            while (endComment < lines.length && getLine(endComment).indexOf("-->") === -1) {
              endComment += 1;
            }
            index = Math.min(lines.length, endComment + 1);
            continue;
          }

          if (isThematicBreakLine(index)) {
            index += 1;
            continue;
          }

          if (isPageBreakLine(index)) {
            blocks.push(makeBlock("page-break", index, index));
            index += 1;
            continue;
          }

          const fenceMatch = lineStartsFence(index);
          if (fenceMatch) {
            const marker = fenceMatch[1] || "";
            const markerChar = marker[0] || "`";
            const markerLength = marker.length;
            let endFence = index;
            for (let i = index + 1; i < lines.length; i += 1) {
              const closingMatch = getLine(i).match(/^ {0,3}(`{3,}|~{3,})\s*$/);
              if (closingMatch && closingMatch[1] && closingMatch[1][0] === markerChar && closingMatch[1].length >= markerLength) {
                endFence = i;
                break;
              }
              endFence = i;
            }
            blocks.push(makeBlock("code", index, endFence));
            index = endFence + 1;
            continue;
          }

          if (isAtxHeadingLine(index)) {
            blocks.push(makeBlock("heading", index, index));
            index += 1;
            continue;
          }

          if (!isBlankLine(index) && index + 1 < lines.length && isSetextUnderlineLine(index + 1)) {
            blocks.push(makeBlock("heading", index, index + 1));
            index += 2;
            continue;
          }

          if (isPotentialTableRow(index) && index + 1 < lines.length && isTableDividerLine(index + 1)) {
            let endTable = index + 1;
            for (let i = index + 2; i < lines.length; i += 1) {
              if (isBlankLine(i) || !isPotentialTableRow(i)) break;
              endTable = i;
            }
            blocks.push(makeBlock("table", index, endTable));
            index = endTable + 1;
            continue;
          }

          if (isBlockquoteLine(index)) {
            let endQuote = index;
            for (let i = index + 1; i < lines.length; i += 1) {
              if (isBlockquoteLine(i)) {
                endQuote = i;
                continue;
              }
              if (isBlankLine(i) && i + 1 < lines.length && isBlockquoteLine(i + 1)) {
                endQuote = i;
                continue;
              }
              break;
            }
            blocks.push(makeBlock("blockquote", index, endQuote));
            index = endQuote + 1;
            continue;
          }

          if (isListLine(index)) {
            let endList = index;
            for (let i = index + 1; i < lines.length; i += 1) {
              if (isBlankLine(i)) {
                if (i + 1 < lines.length && (isListLine(i + 1) || isContinuationIndentedLine(i + 1))) {
                  endList = i;
                  continue;
                }
                break;
              }
              if (isListLine(i) || isContinuationIndentedLine(i)) {
                endList = i;
                continue;
              }
              if (isAtxHeadingLine(i) || isBlockquoteLine(i) || lineStartsFence(i) || (isPotentialTableRow(i) && i + 1 < lines.length && isTableDividerLine(i + 1))) {
                break;
              }
              endList = i;
            }
            blocks.push(makeBlock("list", index, endList));
            index = endList + 1;
            continue;
          }

          let endParagraph = index;
          for (let i = index + 1; i < lines.length; i += 1) {
            if (isBlankLine(i) || isHtmlCommentStart(i) || lineStartsFence(i) || isAtxHeadingLine(i) || isBlockquoteLine(i) || isListLine(i)) {
              break;
            }
            if (i + 1 < lines.length && (isSetextUnderlineLine(i + 1) || (isPotentialTableRow(i) && isTableDividerLine(i + 1)))) {
              break;
            }
            endParagraph = i;
          }
          const paragraphText = getChunkText(index, endParagraph);
          const markdownFigureCaption = annotationHelpers && typeof annotationHelpers.extractStandaloneMarkdownImageCaptionText === "function"
            ? annotationHelpers.extractStandaloneMarkdownImageCaptionText(paragraphText)
            : null;
          blocks.push(makeBlock(markdownFigureCaption != null ? "figure" : "paragraph", index, endParagraph));
          index = endParagraph + 1;
        }

        return expandSourcePreviewCommentBlocksByDisplayMath(source, blocks);
      }

      function scanLatexPreviewCommentBlocks(markdown) {
        const source = String(markdown || "").replace(/\r\n/g, "\n");
        if (!source) return [];
        const bodyRange = findLatexDocumentBodyRange(source);
        const bodyStart = Math.max(0, Math.min(bodyRange.start, source.length));
        const bodyEnd = Math.max(bodyStart, Math.min(bodyRange.end, source.length));
        const bodyText = source.slice(bodyStart, bodyEnd);
        const lines = bodyText.split("\n");
        const lineOffsets = [];
        let runningOffset = 0;
        for (const line of lines) {
          lineOffsets.push(runningOffset);
          runningOffset += line.length + 1;
        }

        function getLine(index) {
          return index >= 0 && index < lines.length ? String(lines[index] || "") : "";
        }

        function getStrippedLine(index) {
          return stripLatexPreviewComments(getLine(index)).trim();
        }

        function isBlankLine(index) {
          return !getStrippedLine(index);
        }

        function isBibliographyCommandLine(index) {
          return /^\\(?:bibliographystyle|bibliography|printbibliography)\b/i.test(getStrippedLine(index));
        }

        function makeBlock(kind, startLineIndex, endLineIndex) {
          const safeStartLine = Math.max(0, Math.min(startLineIndex, Math.max(0, lines.length - 1)));
          const safeEndLine = Math.max(safeStartLine, Math.min(endLineIndex, Math.max(0, lines.length - 1)));
          const start = bodyStart + (lineOffsets[safeStartLine] || 0);
          const end = bodyStart + (lineOffsets[safeEndLine] || 0) + getLine(safeEndLine).length;
          return {
            kind,
            start,
            end,
            lineStart: getLineNumberAtOffset(source, start),
            lineEnd: getLineNumberAtOffset(source, Math.max(start, end - 1)),
          };
        }

        function getChunkText(startLineIndex, endLineIndex) {
          return bodyText.slice(
            lineOffsets[startLineIndex] || 0,
            (lineOffsets[endLineIndex] || 0) + getLine(endLineIndex).length,
          );
        }

        function getEnvironmentStartName(index) {
          const line = getStrippedLine(index);
          const match = line.match(/^\\begin\{([^}]+)\}/);
          return match ? String(match[1] || "").trim().toLowerCase() : "";
        }

        function findEnvironmentEndLine(startLineIndex, envName) {
          const openToken = "\\begin{" + envName + "}";
          const closeToken = "\\end{" + envName + "}";
          let depth = 0;
          for (let lineIndex = startLineIndex; lineIndex < lines.length; lineIndex += 1) {
            const line = getStrippedLine(lineIndex);
            if (line.includes(openToken)) depth += 1;
            if (line.includes(closeToken)) {
              depth -= 1;
              if (depth <= 0) return lineIndex;
            }
          }
          return startLineIndex;
        }

        function isHeadingLine(index) {
          return Boolean(readLatexHeadingChunk(getLine(index)));
        }

        function findBibliographyCommandEndLine(startLineIndex) {
          let endLineIndex = startLineIndex;
          for (let lineIndex = startLineIndex + 1; lineIndex < lines.length; lineIndex += 1) {
            if (!isBibliographyCommandLine(lineIndex)) break;
            endLineIndex = lineIndex;
          }
          return endLineIndex;
        }

        function isMathStartLine(index) {
          const line = getStrippedLine(index);
          if (!line) return false;
          if (line.startsWith("$$") || line.startsWith("\\[")) return true;
          const envName = getEnvironmentStartName(index);
          return Boolean(envName && DISPLAY_MATH_ENV_NAMES.has(envName));
        }

        function findMathEndLine(startLineIndex) {
          for (let endLineIndex = startLineIndex; endLineIndex < lines.length; endLineIndex += 1) {
            const chunkText = getChunkText(startLineIndex, endLineIndex);
            if (getStandaloneDisplayMathRange(stripLatexPreviewComments(chunkText))) {
              return endLineIndex;
            }
          }
          return startLineIndex;
        }

        const blocks = [];
        let lineIndex = 0;
        while (lineIndex < lines.length) {
          if (isBlankLine(lineIndex)) {
            lineIndex += 1;
            continue;
          }

          const strippedLine = getStrippedLine(lineIndex);
          const envName = getEnvironmentStartName(lineIndex);

          if (isHeadingLine(lineIndex)) {
            blocks.push(makeBlock("heading", lineIndex, lineIndex));
            lineIndex += 1;
            continue;
          }

          if (envName === "abstract" || envName === "keywords") {
            const endLineIndex = findEnvironmentEndLine(lineIndex, envName);
            const chunkText = getChunkText(lineIndex, endLineIndex);
            if (normalizeLatexPreviewBlockText(chunkText, "paragraph")) {
              blocks.push(makeBlock("paragraph", lineIndex, endLineIndex));
            }
            lineIndex = endLineIndex + 1;
            continue;
          }

          if (envName && LATEX_PREVIEW_STRUCTURAL_ENV_KIND_BY_NAME.has(envName)) {
            const endLineIndex = findEnvironmentEndLine(lineIndex, envName);
            blocks.push(makeBlock(LATEX_PREVIEW_STRUCTURAL_ENV_KIND_BY_NAME.get(envName) || "paragraph", lineIndex, endLineIndex));
            lineIndex = endLineIndex + 1;
            continue;
          }

          if (isBibliographyCommandLine(lineIndex)) {
            const endLineIndex = findBibliographyCommandEndLine(lineIndex);
            blocks.push(makeBlock("heading", lineIndex, endLineIndex));
            blocks.push(makeBlock("paragraph", lineIndex, endLineIndex));
            lineIndex = endLineIndex + 1;
            continue;
          }

          if (envName && LATEX_PREVIEW_SKIPPED_ENV_NAMES.has(envName) && !DISPLAY_MATH_ENV_NAMES.has(envName)) {
            lineIndex = findEnvironmentEndLine(lineIndex, envName) + 1;
            continue;
          }

          if (isMathStartLine(lineIndex)) {
            const endLineIndex = findMathEndLine(lineIndex);
            blocks.push(makeBlock("math", lineIndex, endLineIndex));
            lineIndex = endLineIndex + 1;
            continue;
          }

          if (isLatexPreviewSkippableChunk(strippedLine)) {
            lineIndex += 1;
            continue;
          }

          const paragraphStartLine = lineIndex;
          let paragraphEndLine = lineIndex;
          for (let nextLineIndex = lineIndex + 1; nextLineIndex < lines.length; nextLineIndex += 1) {
            if (isBlankLine(nextLineIndex) || isHeadingLine(nextLineIndex) || isMathStartLine(nextLineIndex)) {
              break;
            }
            const nextEnvName = getEnvironmentStartName(nextLineIndex);
            if (nextEnvName) {
              break;
            }
            paragraphEndLine = nextLineIndex;
          }

          const chunkText = getChunkText(paragraphStartLine, paragraphEndLine);
          if (normalizeLatexPreviewBlockText(chunkText, "paragraph") && !isLatexPreviewSkippableChunk(chunkText)) {
            blocks.push(makeBlock("paragraph", paragraphStartLine, paragraphEndLine));
          }
          lineIndex = paragraphEndLine + 1;
        }

        return blocks;
      }

      function isPreviewDisplayMathElement(element) {
        return Boolean(
          element
          && element instanceof Element
          && element.matches
          && element.matches("math[display='block'], .studio-mathjax-fallback-display, .studio-display-equation, .studio-display-equation-body")
        );
      }

      function previewNodesHaveVisibleContent(nodes) {
        return (Array.isArray(nodes) ? nodes : []).some((node) => {
          if (!node) return false;
          if (node.nodeType === Node.TEXT_NODE) {
            return Boolean(normalizeVisiblePreviewText(node.nodeValue || ""));
          }
          return node instanceof Element && Boolean(buildNormalizedPreviewSearchText(node));
        });
      }

      function wrapLoosePreviewInlineRunsAsParagraphs(targetEl) {
        if (!targetEl || !targetEl.childNodes || typeof document.createElement !== "function") return;
        const childNodes = Array.from(targetEl.childNodes || []);
        if (childNodes.length === 0) return;

        function isDirectBlockChild(node) {
          if (!(node instanceof Element) || node.parentElement !== targetEl) return false;
          const tag = node.tagName ? node.tagName.toUpperCase() : "";
          if (/^H[1-6]$/.test(tag)) return true;
          if (tag === "P" || tag === "BLOCKQUOTE" || tag === "UL" || tag === "OL" || tag === "TABLE" || tag === "PRE" || tag === "HEADER" || tag === "FIGURE") {
            return true;
          }
          if (tag === "MATH") {
            return String(node.getAttribute("display") || "").toLowerCase() === "block";
          }
          if (tag === "DIV") return true;
          return false;
        }

        let runNodes = [];

        function flushRun(referenceNode) {
          if (runNodes.length === 0) return;
          if (!previewNodesHaveVisibleContent(runNodes)) {
            runNodes.forEach((node) => {
              if (node && node.parentNode === targetEl) {
                targetEl.removeChild(node);
              }
            });
            runNodes = [];
            return;
          }
          const paragraphEl = document.createElement("p");
          runNodes.forEach((node) => {
            paragraphEl.appendChild(node);
          });
          targetEl.insertBefore(paragraphEl, referenceNode || null);
          runNodes = [];
        }

        childNodes.forEach((node) => {
          if (node instanceof Element && isDirectBlockChild(node)) {
            flushRun(node);
            return;
          }
          if (node.parentNode === targetEl) {
            runNodes.push(node);
          }
        });
        flushRun(null);
      }

      function splitMixedPreviewParagraphsAroundDisplayMath(targetEl) {
        if (!targetEl || typeof targetEl.querySelectorAll !== "function") return;
        if (editorLanguage === "latex") {
          wrapLoosePreviewInlineRunsAsParagraphs(targetEl);
        }
        Array.from(targetEl.querySelectorAll("p")).forEach((paragraphEl) => {
          if (!(paragraphEl instanceof Element) || !paragraphEl.parentNode) return;
          if (paragraphEl.closest && paragraphEl.closest(".preview-comment-block")) return;
          let ancestor = paragraphEl.parentElement;
          while (ancestor && ancestor !== targetEl) {
            if (getPreviewCommentTargetKind(ancestor)) return;
            ancestor = ancestor.parentElement;
          }
          const childNodes = Array.from(paragraphEl.childNodes || []);
          if (!childNodes.some((node) => isPreviewDisplayMathElement(node))) return;

          const fragment = document.createDocumentFragment();
          let proseNodes = [];
          let segmentCount = 0;

          function flushProse() {
            if (proseNodes.length === 0) return;
            if (!previewNodesHaveVisibleContent(proseNodes)) {
              proseNodes = [];
              return;
            }
            const proseEl = paragraphEl.cloneNode(false);
            if (proseEl instanceof Element) {
              proseEl.removeAttribute("id");
            }
            proseNodes.forEach((node) => {
              proseEl.appendChild(node);
            });
            fragment.appendChild(proseEl);
            proseNodes = [];
            segmentCount += 1;
          }

          childNodes.forEach((node) => {
            if (isPreviewDisplayMathElement(node)) {
              flushProse();
              fragment.appendChild(node);
              segmentCount += 1;
              return;
            }
            proseNodes.push(node);
          });
          flushProse();

          if (segmentCount > 0) {
            paragraphEl.replaceWith(fragment);
          }
        });
      }

      function isPreviewMediaOnlyParagraphElement(element) {
        if (!element || !(element instanceof Element)) return false;
        if ((element.tagName ? element.tagName.toUpperCase() : "") !== "P") return false;

        let hasMedia = false;
        for (const childNode of Array.from(element.childNodes || [])) {
          if (!childNode) continue;
          if (childNode.nodeType === Node.TEXT_NODE) {
            if (normalizeVisiblePreviewText(childNode.nodeValue || "")) {
              return false;
            }
            continue;
          }
          if (!(childNode instanceof Element)) continue;

          const childTag = childNode.tagName ? childNode.tagName.toUpperCase() : "";
          if (childTag === "BR") continue;
          if (childTag === "IMG" || childTag === "EMBED" || childTag === "OBJECT" || childTag === "IFRAME" || childTag === "CANVAS") {
            hasMedia = true;
            continue;
          }

          const nestedMedia = typeof childNode.querySelector === "function"
            ? childNode.querySelector("img, embed, object, iframe, canvas")
            : null;
          if (nestedMedia && !buildNormalizedPreviewSearchText(childNode)) {
            hasMedia = true;
            continue;
          }

          return false;
        }

        return hasMedia;
      }

      function getPreviewCommentTargetKind(element) {
        if (!element || !(element instanceof Element)) return "";
        if (element.classList && element.classList.contains("studio-mathjax-fallback-display")) {
          return "math";
        }
        if (element.classList && element.classList.contains("studio-page-break")) {
          return "page-break";
        }
        const tag = element.tagName ? element.tagName.toUpperCase() : "";
        if (/^H[1-6]$/.test(tag)) return "heading";
        if (tag === "P") return isPreviewMediaOnlyParagraphElement(element) ? "figure" : "paragraph";
        if (tag === "FIGURE") {
          if (element.classList && element.classList.contains("studio-algorithm-block")) {
            return "algorithm";
          }
          return "figure";
        }
        if (tag === "DIV" && element.classList) {
          if (element.classList.contains("studio-display-equation")) {
            return "math";
          }
          if (element.classList.contains("abstract") || element.classList.contains("keywords") || element.classList.contains("references")) {
            return "paragraph";
          }
        }
        if (tag === "BLOCKQUOTE") return "blockquote";
        if (tag === "UL" || tag === "OL") return "list";
        if (tag === "TABLE") return "table";
        if (tag === "PRE") return "code";
        if (tag === "MATH") {
          return String(element.getAttribute("display") || "").toLowerCase() === "block" ? "math" : "";
        }
        if (element.classList) {
          if (
            element.classList.contains("sourceCode")
            || element.classList.contains("mermaid-container")
          ) {
            return "code";
          }
          if (
            element.classList.contains("callout-note")
            || element.classList.contains("callout-tip")
            || element.classList.contains("callout-warning")
            || element.classList.contains("callout-important")
            || element.classList.contains("callout-caution")
          ) {
            return "blockquote";
          }
        }
        return "";
      }

      function isPreviewCommentTargetElement(element) {
        return Boolean(getPreviewCommentTargetKind(element));
      }

      function isLatexPreviewCommentTargetElement(element, targetEl) {
        if (!element || !(element instanceof Element) || !targetEl) return false;
        const kind = getPreviewCommentTargetKind(element);
        if (kind === "heading" || kind === "paragraph" || kind === "figure" || kind === "algorithm" || kind === "table") {
          if (element.parentElement === targetEl) return true;
          if (
            kind === "paragraph"
            && element.classList
            && element.classList.contains("abstract")
            && element.parentElement
            && element.parentElement.tagName === "HEADER"
            && element.parentElement.id === "title-block-header"
            && element.parentElement.parentElement === targetEl
          ) {
            return true;
          }
          return false;
        }
        if (kind === "math") {
          if (element.parentElement === targetEl) return true;
          const bodyEl = element.parentElement;
          const frameEl = bodyEl && bodyEl.parentElement;
          return Boolean(
            bodyEl
            && bodyEl.classList
            && bodyEl.classList.contains("studio-display-equation-body")
            && frameEl
            && frameEl.classList
            && frameEl.classList.contains("studio-display-equation")
            && frameEl.parentElement === targetEl
          );
        }
        return false;
      }

      function collectPreviewCommentTargetElements(targetEl) {
        if (!targetEl || typeof targetEl.querySelectorAll !== "function") return [];
        const selector = "h1, h2, h3, h4, h5, h6, p, figure, blockquote, ul, ol, table, div.sourceCode, pre, math[display='block'], .studio-display-equation, .studio-mathjax-fallback-display, .studio-page-break, .abstract, .keywords, .references, .callout-note, .callout-tip, .callout-warning, .callout-important, .callout-caution, .mermaid-container";
        return Array.from(targetEl.querySelectorAll(selector)).filter((element) => {
          if (!isPreviewCommentTargetElement(element)) return false;
          if (editorLanguage === "latex" && !isLatexPreviewCommentTargetElement(element, targetEl)) {
            return false;
          }
          let ancestor = element.parentElement;
          while (ancestor && ancestor !== targetEl) {
            if (ancestor.classList && ancestor.classList.contains("preview-comment-block")) return false;
            if (isPreviewCommentTargetElement(ancestor)) return false;
            ancestor = ancestor.parentElement;
          }
          return true;
        }).map((element) => ({
          element,
          kind: getPreviewCommentTargetKind(element),
        }));
      }

      function getNormalizedPreviewCommentSourceBlockText(sourceText, sourceBlock) {
        if (!sourceBlock) return "";
        const blockText = String(sourceText || "").slice(sourceBlock.start, sourceBlock.end);
        if (editorLanguage === "latex") {
          return normalizeLatexPreviewBlockText(blockText, sourceBlock.kind);
        }
        if (sourceBlock.kind === "page-break") {
          const match = blockText.trim().match(/^\\(newpage|pagebreak|clearpage)/i);
          return match ? String(match[1] || "").toLowerCase() : "page-break";
        }
        if (sourceBlock.kind === "figure") {
          const figureCaption = annotationHelpers && typeof annotationHelpers.extractStandaloneMarkdownImageCaptionText === "function"
            ? annotationHelpers.extractStandaloneMarkdownImageCaptionText(blockText)
            : null;
          if (figureCaption != null) {
            return normalizeVisiblePreviewText(figureCaption);
          }
        }
        if (supportsPreviewSelectionCommentsForBlockKind(sourceBlock.kind)) {
          return normalizeVisiblePreviewText(buildPreviewSelectionDisplayMap(blockText, sourceBlock.kind).text);
        }
        if (sourceBlock.kind === "code") {
          return normalizeVisiblePreviewText(
            blockText
              .replace(/^ {0,3}(`{3,}|~{3,}).*$/gm, "")
              .replace(/^ {0,3}$/gm, ""),
          );
        }
        if (sourceBlock.kind === "table") {
          return normalizeVisiblePreviewText(
            blockText
              .replace(/^\s*\|?(?:\s*:?-{3,}:?\s*\|)+(?:\s*:?-{3,}:?\s*)?\|?\s*$/gm, "")
              .replace(/\|/g, " "),
          );
        }
        return normalizeVisiblePreviewText(blockText);
      }

      function getPreviewFigureSearchText(element) {
        if (!element || !(element instanceof Element)) return "";
        const visibleText = buildNormalizedPreviewSearchText(element);
        if (visibleText) return visibleText;

        const imageNodes = (element.tagName ? element.tagName.toUpperCase() : "") === "IMG"
          ? [element]
          : (typeof element.querySelectorAll === "function" ? Array.from(element.querySelectorAll("img[alt], img[title]")) : []);
        const altText = imageNodes
          .filter((imageEl) => imageEl instanceof Element)
          .map((imageEl) => imageEl.getAttribute("alt") || imageEl.getAttribute("title") || "")
          .map((text) => normalizeVisiblePreviewText(text))
          .filter(Boolean)
          .join(" ");
        return altText;
      }

      function getNormalizedPreviewCommentTargetText(targetEntry) {
        if (!targetEntry) return "";
        if (typeof targetEntry.normalizedText === "string") return targetEntry.normalizedText;
        if (targetEntry.kind === "page-break") {
          const element = targetEntry.element;
          targetEntry.normalizedText = String(element && element.getAttribute ? (element.getAttribute("data-page-break-kind") || "page-break") : "page-break").toLowerCase();
          return targetEntry.normalizedText;
        }
        if (targetEntry.kind === "figure") {
          targetEntry.normalizedText = getPreviewFigureSearchText(targetEntry.element);
          return targetEntry.normalizedText;
        }
        targetEntry.normalizedText = buildNormalizedPreviewSearchText(targetEntry.element);
        return targetEntry.normalizedText;
      }

      function isHighConfidencePreviewTextContainmentMatch(leftText, rightText) {
        const left = String(leftText || "");
        const right = String(rightText || "");
        if (!left || !right || left === right) return false;
        const shorter = left.length <= right.length ? left : right;
        const longer = left.length <= right.length ? right : left;
        if (shorter.length < 12) return false;
        if (!/\s/.test(shorter)) return false;
        return longer.includes(shorter);
      }

      function tokenizePreviewComparableText(text) {
        return normalizeVisiblePreviewText(text)
          .toLowerCase()
          .split(/\s+/)
          .map((token) => token.replace(/^[^0-9A-Za-z\u00C0-\uFFFF]+|[^0-9A-Za-z\u00C0-\uFFFF]+$/g, ""))
          .filter((token) => token && (token.length >= 4 || /[A-Za-z\u00C0-\uFFFF]/.test(token)));
      }

      function getHighConfidenceLatexOrderedTokenMatchScore(targetText, desiredText) {
        if (editorLanguage !== "latex") return -1;
        const targetTokens = tokenizePreviewComparableText(targetText);
        const desiredTokens = tokenizePreviewComparableText(desiredText);
        if (targetTokens.length === 0 || desiredTokens.length < 5) return -1;

        let targetTokenIndex = 0;
        let matchedCount = 0;
        for (const token of desiredTokens) {
          while (targetTokenIndex < targetTokens.length && targetTokens[targetTokenIndex] !== token) {
            targetTokenIndex += 1;
          }
          if (targetTokenIndex >= targetTokens.length) break;
          matchedCount += 1;
          targetTokenIndex += 1;
        }

        const matchRatio = matchedCount / desiredTokens.length;
        if (matchedCount < 5 || matchRatio < 0.6) return -1;
        return matchedCount * 1000 + Math.round(matchRatio * 100);
      }

      function findMatchingPreviewCommentTargetIndex(sourceText, sourceBlock, targetBlocks, startIndex) {
        const desiredKind = sourceBlock ? sourceBlock.kind : "";
        const desiredText = getNormalizedPreviewCommentSourceBlockText(sourceText, sourceBlock);
        const preferredStartIndex = Math.max(0, startIndex || 0);
        let fallbackIndex = -1;
        let containsIndex = -1;
        let orderedTokenIndex = -1;
        let orderedTokenScore = Number.NEGATIVE_INFINITY;

        for (let i = preferredStartIndex; i < targetBlocks.length; i += 1) {
          const targetEntry = targetBlocks[i];
          if (!targetEntry || targetEntry.kind !== desiredKind) continue;
          if (fallbackIndex < 0) fallbackIndex = i;
          const targetText = getNormalizedPreviewCommentTargetText(targetEntry);
          if (desiredText && targetText) {
            if (targetText === desiredText) {
              return i;
            }
            if (containsIndex < 0 && isHighConfidencePreviewTextContainmentMatch(targetText, desiredText)) {
              containsIndex = i;
            }
            const latexTokenScore = getHighConfidenceLatexOrderedTokenMatchScore(targetText, desiredText);
            if (latexTokenScore >= 0) {
              const score = latexTokenScore - (Math.abs(i - preferredStartIndex) * 4);
              if (score > orderedTokenScore) {
                orderedTokenScore = score;
                orderedTokenIndex = i;
              }
            }
          }
        }

        if (containsIndex >= 0) return containsIndex;
        if (orderedTokenIndex >= 0) return orderedTokenIndex;
        return fallbackIndex;
      }

      function getPreviewCommentNotesForRange(start, end, sourceText, displayNotes) {
        const source = String(sourceText || "");
        const notes = Array.isArray(displayNotes) ? displayNotes : getDisplayReviewNotes();
        return notes.filter((note) => {
          const range = resolveReviewNoteRange(note, source);
          return range && rangesOverlap(range.start, range.end, start, end);
        });
      }

      function updatePreviewCommentBlockState(blockEl, sourceText, displayNotes) {
        if (!blockEl || !blockEl.dataset) return;
        const blockKey = getPreviewCommentBlockKey(blockEl);
        const paneId = getPreviewSelectionPaneIdForNode(blockEl);
        const hasSelection = Boolean(
          activePreviewCommentSelection
          && activePreviewCommentSelection.paneId === paneId
          && activePreviewCommentSelection.blockKey === blockKey
        );

        blockEl.classList.remove("has-comments");
        blockEl.classList.toggle("has-selection", hasSelection);
      }

      function updatePreviewCommentBlocksForElement(targetEl) {
        if (!targetEl || typeof targetEl.querySelectorAll !== "function") return;
        ensurePreviewSelectionActions(targetEl);
        const sourceText = String(sourceTextEl && sourceTextEl.value ? sourceTextEl.value : "");
        Array.from(targetEl.querySelectorAll(".preview-comment-block")).forEach((blockEl) => {
          updatePreviewCommentBlockState(blockEl, sourceText);
        });
        updatePreviewSelectionActions(targetEl);
      }

      function decorateRenderedEditorPreviewComments(targetEl, sourceText) {
        if (!targetEl || typeof targetEl.querySelectorAll !== "function") return;
        splitMixedPreviewParagraphsAroundDisplayMath(targetEl);
        const sourceBlocks = scanSourcePreviewCommentBlocks(sourceText);
        const targetBlocks = collectPreviewCommentTargetElements(targetEl);
        if (sourceBlocks.length === 0 || targetBlocks.length === 0) return;

        let targetIndex = 0;
        for (const sourceBlock of sourceBlocks) {
          const matchedTargetIndex = findMatchingPreviewCommentTargetIndex(sourceText, sourceBlock, targetBlocks, targetIndex);
          if (matchedTargetIndex < 0) continue;

          const targetEntry = targetBlocks[matchedTargetIndex];
          targetIndex = matchedTargetIndex + 1;
          const originalElement = targetEntry && targetEntry.element ? targetEntry.element : null;
          if (!originalElement || !originalElement.parentNode) continue;

          const wrapper = document.createElement("div");
          wrapper.className = "preview-comment-block";
          wrapper.dataset.reviewNoteStart = String(sourceBlock.start);
          wrapper.dataset.reviewNoteEnd = String(sourceBlock.end);
          wrapper.dataset.reviewNoteLineStart = String(sourceBlock.lineStart);
          wrapper.dataset.reviewNoteLineEnd = String(sourceBlock.lineEnd);
          wrapper.dataset.previewCommentKind = sourceBlock.kind;

          originalElement.replaceWith(wrapper);
          originalElement.classList.add("preview-comment-block-content");
          wrapper.appendChild(originalElement);
        }

        ensurePreviewSelectionActions(targetEl);
        updatePreviewCommentBlocksForElement(targetEl);
      }

      function refreshRenderedEditorPreviewComments() {
        if (sourcePreviewEl) {
          updatePreviewCommentBlocksForElement(sourcePreviewEl);
        }
        if (critiqueViewEl) {
          updatePreviewCommentBlocksForElement(critiqueViewEl);
        }
      }

      function buildReviewNoteAnchorFromPreviewBlock(blockEl) {
        if (!blockEl || !blockEl.dataset) return null;
        const source = String(sourceTextEl && sourceTextEl.value ? sourceTextEl.value : "");
        const selectionStart = Math.max(0, Math.min(Number(blockEl.dataset.reviewNoteStart) || 0, source.length));
        const selectionEnd = Math.max(selectionStart, Math.min(Number(blockEl.dataset.reviewNoteEnd) || selectionStart, source.length));
        const lineStart = Math.max(1, Number(blockEl.dataset.reviewNoteLineStart) || 1);
        const lineEnd = Math.max(lineStart, Number(blockEl.dataset.reviewNoteLineEnd) || lineStart);
        return {
          selectionStart,
          selectionEnd,
          lineStart,
          lineEnd,
          selectedText: source.slice(selectionStart, selectionEnd),
          selectedDisplayText: source.slice(selectionStart, selectionEnd),
        };
      }

      function buildReviewNoteAnchorFromPreviewSelection(blockEl, contentEl, range) {
        if (!blockEl || !blockEl.dataset || !contentEl || !range) return null;
        const kind = String(blockEl.dataset.previewCommentKind || "");
        if (!supportsPreviewSelectionCommentsForBlockKind(kind)) return null;
        if (!contentEl.contains(range.startContainer) || !contentEl.contains(range.endContainer)) return null;

        const source = String(sourceTextEl && sourceTextEl.value ? sourceTextEl.value : "");
        const blockStart = Math.max(0, Math.min(Number(blockEl.dataset.reviewNoteStart) || 0, source.length));
        const blockEnd = Math.max(blockStart, Math.min(Number(blockEl.dataset.reviewNoteEnd) || blockStart, source.length));
        if (blockEnd <= blockStart) return null;

        if (kind === "math") {
          const selectedDisplayText = normalizeVisiblePreviewText(getPreviewMathSearchText(contentEl) || buildNormalizedPreviewSearchText(contentEl));
          if (!selectedDisplayText) return null;
          return {
            selectionStart: blockStart,
            selectionEnd: blockEnd,
            lineStart: getLineNumberAtOffset(source, blockStart),
            lineEnd: getLineNumberAtOffset(source, Math.max(blockStart, blockEnd - 1)),
            selectedText: source.slice(blockStart, blockEnd),
            selectedDisplayText,
          };
        }

        if (editorLanguage === "latex") {
          const selectedDisplayText = buildNormalizedPreviewRangeText(range);
          if (!selectedDisplayText) return null;
          return {
            selectionStart: blockStart,
            selectionEnd: blockEnd,
            lineStart: getLineNumberAtOffset(source, blockStart),
            lineEnd: getLineNumberAtOffset(source, Math.max(blockStart, blockEnd - 1)),
            selectedText: source.slice(blockStart, blockEnd),
            selectedDisplayText,
          };
        }

        const sourceBlockText = source.slice(blockStart, blockEnd);
        const displayMap = buildPreviewSelectionDisplayMap(sourceBlockText, kind);
        if (!displayMap.text || !displayMap.charStarts.length || !displayMap.charEnds.length) return null;

        const prefixRange = document.createRange();
        prefixRange.selectNodeContents(contentEl);
        prefixRange.setEnd(range.startContainer, range.startOffset);
        const prefixText = buildNormalizedPreviewRangeText(prefixRange);
        const selectedDisplayText = buildNormalizedPreviewRangeText(range);
        if (!selectedDisplayText) return null;

        const desiredStart = Math.max(0, Math.min(prefixText.length, displayMap.text.length));
        const bestIndex = findPreferredNormalizedTextMatch(displayMap.text, selectedDisplayText, desiredStart);
        if (bestIndex < 0) return null;

        const endIndex = bestIndex + selectedDisplayText.length - 1;
        const rawStartRel = displayMap.charStarts[bestIndex];
        const rawEndRel = displayMap.charEnds[endIndex];
        if (!Number.isFinite(rawStartRel) || !Number.isFinite(rawEndRel) || rawEndRel <= rawStartRel) {
          return null;
        }

        const selectionStart = blockStart + rawStartRel;
        const selectionEnd = blockStart + rawEndRel;
        return {
          selectionStart,
          selectionEnd,
          lineStart: getLineNumberAtOffset(source, selectionStart),
          lineEnd: getLineNumberAtOffset(source, Math.max(selectionStart, selectionEnd - 1)),
          selectedText: source.slice(selectionStart, selectionEnd),
          selectedDisplayText,
        };
      }

      function getPreviewJumpNormalizedSelectionStart(note, blockEl, range) {
        if (!note || !blockEl || !blockEl.dataset || !range) return 0;
        const kind = String(blockEl.dataset.previewCommentKind || "");
        const source = String(sourceTextEl && sourceTextEl.value ? sourceTextEl.value : "");
        const blockStart = Math.max(0, Math.min(Number(blockEl.dataset.reviewNoteStart) || 0, source.length));
        const blockEnd = Math.max(blockStart, Math.min(Number(blockEl.dataset.reviewNoteEnd) || blockStart, source.length));
        const displayMap = buildPreviewSelectionDisplayMap(source.slice(blockStart, blockEnd), kind);
        if (!displayMap || !displayMap.charStarts || displayMap.charStarts.length === 0) return 0;
        const relativeStart = Math.max(0, range.start - blockStart);
        for (let i = 0; i < displayMap.charStarts.length; i += 1) {
          const charStart = Number(displayMap.charStarts[i]);
          const charEnd = Number(displayMap.charEnds[i]);
          if (charEnd > relativeStart && charStart <= relativeStart) {
            return i;
          }
          if (charStart >= relativeStart) {
            return i;
          }
        }
        return Math.max(0, displayMap.text.length - 1);
      }

      function createPreviewJumpInlineHighlight(contentEl, blockEl, note, range) {
        if (!contentEl || !note || !range) return null;
        const selectedDisplayText = normalizeVisiblePreviewText(note.selectedDisplayText || note.selectedText || "");
        if (!selectedDisplayText) return null;
        const domMap = buildNormalizedDomTextMap(contentEl);
        if (!domMap.text || !domMap.charStarts.length || !domMap.charEnds.length) return null;
        const preferredStart = getPreviewJumpNormalizedSelectionStart(note, blockEl, range);
        const matchIndex = findPreferredNormalizedTextMatch(domMap.text, selectedDisplayText, preferredStart);
        if (matchIndex < 0) return null;
        const endIndex = matchIndex + selectedDisplayText.length - 1;
        const startRef = domMap.charStarts[matchIndex];
        const endRef = domMap.charEnds[endIndex];
        if (!startRef || !endRef || !startRef.node || !endRef.node) return null;

        const domRange = document.createRange();
        domRange.setStart(startRef.node, startRef.offset);
        domRange.setEnd(endRef.node, endRef.offset);

        const highlightEl = document.createElement("span");
        highlightEl.className = "preview-comment-inline-highlight";
        try {
          domRange.surroundContents(highlightEl);
        } catch {
          const fragment = domRange.extractContents();
          highlightEl.appendChild(fragment);
          domRange.insertNode(highlightEl);
        }
        return highlightEl;
      }

      function findPreviewCommentBlockForRange(targetEl, range) {
        if (!targetEl || !range || typeof targetEl.querySelectorAll !== "function") return null;
        let bestBlock = null;
        let bestScore = Number.NEGATIVE_INFINITY;
        Array.from(targetEl.querySelectorAll(".preview-comment-block")).forEach((blockEl) => {
          const blockStart = Math.max(0, Number(blockEl.dataset && blockEl.dataset.reviewNoteStart) || 0);
          const blockEnd = Math.max(blockStart, Number(blockEl.dataset && blockEl.dataset.reviewNoteEnd) || blockStart);
          const overlapStart = Math.max(blockStart, range.start);
          const overlapEnd = Math.min(blockEnd, range.end);
          const overlap = Math.max(0, overlapEnd - overlapStart);
          const contains = range.start >= blockStart && range.end <= blockEnd;
          const distance = contains
            ? 0
            : Math.min(Math.abs(range.start - blockEnd), Math.abs(range.end - blockStart));
          const score = contains
            ? (1000000 - (blockEnd - blockStart))
            : (overlap > 0 ? overlap : -distance);
          if (score > bestScore) {
            bestScore = score;
            bestBlock = blockEl;
          }
        });
        return bestBlock;
      }

      function getPreviewNoteNormalizedSelectionText(note) {
        const direct = normalizeVisiblePreviewText(note && (note.selectedDisplayText || note.selectedText) ? (note.selectedDisplayText || note.selectedText) : "");
        if (direct) return direct;
        return "";
      }

      function findPreviewCommentBlockForNoteText(targetEl, note) {
        if (!targetEl || !note || typeof targetEl.querySelectorAll !== "function") return null;
        const selectionText = getPreviewNoteNormalizedSelectionText(note);
        if (!selectionText) return null;

        let bestBlock = null;
        let bestScore = Number.NEGATIVE_INFINITY;
        Array.from(targetEl.querySelectorAll(".preview-comment-block")).forEach((blockEl) => {
          const contentEl = blockEl.querySelector(".preview-comment-block-content") || blockEl;
          const blockText = buildNormalizedPreviewSearchText(contentEl);
          if (!blockText) return;
          const matchIndex = blockText.indexOf(selectionText);
          if (matchIndex < 0) return;
          const lineStart = Math.max(1, Number(blockEl.dataset && blockEl.dataset.reviewNoteLineStart) || 1);
          const desiredLine = Math.max(1, Number(note && note.lineStart) || 1);
          const proximityPenalty = Math.abs(lineStart - desiredLine);
          const score = 1000000 - (matchIndex * 4) - proximityPenalty - Math.max(0, blockText.length - selectionText.length);
          if (score > bestScore) {
            bestScore = score;
            bestBlock = blockEl;
          }
        });
        return bestBlock;
      }

      function revealReviewNoteInPreviewElement(targetEl, note) {
        if (!targetEl || !note) return false;
        const source = String(sourceTextEl && sourceTextEl.value ? sourceTextEl.value : "");
        const range = resolveReviewNoteRange(note, source);
        if (!range) return false;
        const rangeBlock = findPreviewCommentBlockForRange(targetEl, range);
        const selectionText = getPreviewNoteNormalizedSelectionText(note);
        let blockEl = rangeBlock;
        if (selectionText) {
          const rangeContentEl = rangeBlock ? (rangeBlock.querySelector(".preview-comment-block-content") || rangeBlock) : null;
          const rangeText = rangeContentEl ? buildNormalizedPreviewSearchText(rangeContentEl) : "";
          if (!rangeText || !rangeText.includes(selectionText)) {
            blockEl = findPreviewCommentBlockForNoteText(targetEl, note) || rangeBlock;
          }
        }
        if (!blockEl) return false;
        const contentEl = blockEl.querySelector(".preview-comment-block-content") || blockEl;
        if (String(blockEl.dataset && blockEl.dataset.previewCommentKind || "") === "math") {
          if (typeof contentEl.scrollIntoView === "function") {
            contentEl.scrollIntoView({ block: "center", inline: "nearest" });
          }
          setPreviewJumpHighlight(targetEl, contentEl, null);
          return true;
        }
        const inlineHighlightEl = createPreviewJumpInlineHighlight(contentEl, blockEl, note, range);
        if (typeof blockEl.scrollIntoView === "function") {
          blockEl.scrollIntoView({ block: "center", inline: "nearest" });
        }
        setPreviewJumpHighlight(targetEl, contentEl, inlineHighlightEl);
        return true;
      }

      function revealReviewNoteInPreview(note) {
        if (!supportsPreviewCommentsForCurrentEditor()) return false;
        if (rightView === "editor-preview" && critiqueViewEl && critiqueViewEl.isConnected) {
          return revealReviewNoteInPreviewElement(critiqueViewEl, note);
        }
        return false;
      }

      function updateActivePreviewCommentSelectionFromDom() {
        const selection = typeof window.getSelection === "function" ? window.getSelection() : null;
        if (!selection || selection.rangeCount <= 0 || selection.isCollapsed) {
          clearPreviewCommentSelection();
          return;
        }

        const range = selection.getRangeAt(0);
        const startBlock = findPreviewCommentBlockFromNode(range.startContainer);
        const endBlock = findPreviewCommentBlockFromNode(range.endContainer);
        if (!startBlock || !endBlock || startBlock !== endBlock) {
          clearPreviewCommentSelection();
          return;
        }

        const contentEl = startBlock.querySelector(".preview-comment-block-content");
        if (!contentEl || !contentEl.contains(range.startContainer) || !contentEl.contains(range.endContainer)) {
          clearPreviewCommentSelection();
          return;
        }

        const anchor = buildReviewNoteAnchorFromPreviewSelection(startBlock, contentEl, range);
        if (!anchor) {
          clearPreviewCommentSelection();
          return;
        }

        setActivePreviewCommentSelection({
          ...anchor,
          paneId: getPreviewSelectionPaneIdForNode(startBlock),
          blockKey: getPreviewCommentBlockKey(startBlock),
          previewCommentKind: String(startBlock.dataset && startBlock.dataset.previewCommentKind || "paragraph"),
        });
      }

      function getDisplayReviewNotes() {
        const source = String(sourceTextEl && sourceTextEl.value ? sourceTextEl.value : "");
        return reviewNotes.slice().sort((left, right) => {
          const leftBounds = getResolvedReviewNoteLineBounds(left, source);
          const rightBounds = getResolvedReviewNoteLineBounds(right, source);
          const leftLine = leftBounds ? leftBounds.lineStart : Math.max(1, Number(left && left.lineStart) || 1);
          const rightLine = rightBounds ? rightBounds.lineStart : Math.max(1, Number(right && right.lineStart) || 1);
          if (leftLine !== rightLine) return leftLine - rightLine;

          const leftStart = leftBounds ? leftBounds.start : Math.max(0, Number(left && left.selectionStart) || 0);
          const rightStart = rightBounds ? rightBounds.start : Math.max(0, Number(right && right.selectionStart) || 0);
          if (leftStart !== rightStart) return leftStart - rightStart;

          const leftCreated = Number(left && left.createdAt) || 0;
          const rightCreated = Number(right && right.createdAt) || 0;
          if (leftCreated !== rightCreated) return leftCreated - rightCreated;

          return String(left && left.id ? left.id : "").localeCompare(String(right && right.id ? right.id : ""));
        });
      }

      function focusReviewNoteInPanel(noteId) {
        const note = reviewNotes.find((entry) => entry && entry.id === noteId);
        if (!note) return;
        pendingReviewNoteFocusId = note.id;
        openReviewNotes();
      }

      function escapeReviewNoteAnnotationText(text) {
        return String(text || "")
          .replace(/\\/g, "\\\\")
          .replace(/\]/g, "\\]")
          .trim();
      }

      function getReviewNoteInlineState(note, text) {
        const source = String(text || "");
        const annotationBody = escapeReviewNoteAnnotationText(note && note.text);
        if (!annotationBody) {
          return {
            annotationBody: "",
            range: null,
            markerText: "",
            exists: false,
            canToggle: false,
          };
        }
        const range = resolveReviewNoteRange(note, source);
        if (!range) {
          return {
            annotationBody,
            range: null,
            markerText: "",
            exists: false,
            canToggle: false,
          };
        }
        const markerText = (range.start === range.end ? "" : " ") + "[an: " + annotationBody + "]";
        const exists = source.slice(range.end, range.end + markerText.length) === markerText;
        return {
          annotationBody,
          range,
          markerText,
          exists,
          canToggle: true,
        };
      }

      function setReviewNotes(nextNotes, options) {
        reviewNotes = cloneReviewNotes(nextNotes);
        updateReviewNotesUi();
        renderReviewNotesList();
        refreshRenderedEditorPreviewComments();
        if (editorView === "markdown") {
          scheduleEditorLineNumberRender();
        }
        if (!options || options.persist !== false) {
          scheduleReviewNotesPersistence();
        }
      }

      function updateEditorSelectionCommentUi() {
        if (!editorSelectionCommentBtn) return;
        const hasSelection = Boolean(
          !suppressEditorSelectionComment
          && editorView === "markdown"
          && document.activeElement === sourceTextEl
          && typeof sourceTextEl.selectionStart === "number"
          && typeof sourceTextEl.selectionEnd === "number"
          && sourceTextEl.selectionEnd > sourceTextEl.selectionStart
        );
        const canJumpToPreview = Boolean(
          hasSelection
          && rightView === "editor-preview"
          && critiqueViewEl
          && supportsPreviewCommentsForCurrentEditor()
        );
        editorSelectionCommentBtn.hidden = !hasSelection;
        if (editorSelectionJumpBtn) {
          editorSelectionJumpBtn.hidden = !canJumpToPreview;
        }
        if (editorSelectionActionsEl) {
          editorSelectionActionsEl.hidden = !hasSelection;
        }
        if (hasSelection) {
          editorSelectionCommentBtn.title = "Create a new local comment from the current editor selection.";
          editorSelectionCommentBtn.setAttribute("aria-label", editorSelectionCommentBtn.title);
        }
        if (editorSelectionJumpBtn && canJumpToPreview) {
          editorSelectionJumpBtn.title = "Jump to the current editor selection in the preview.";
          editorSelectionJumpBtn.setAttribute("aria-label", editorSelectionJumpBtn.title);
        }
      }

      function clearSuppressedEditorSelectionComment() {
        if (!suppressEditorSelectionComment) return;
        suppressEditorSelectionComment = false;
        suppressedEditorSelectionStart = null;
        suppressedEditorSelectionEnd = null;
        updateEditorSelectionCommentUi();
      }

      function getOutlineEntriesForCurrentEditor() {
        return scanOutlineEntries(sourceTextEl && sourceTextEl.value ? sourceTextEl.value : "", editorLanguage || "markdown");
      }

      function updateOutlineUi() {
        outlineEntries = getOutlineEntriesForCurrentEditor();
        const descriptor = getCurrentStudioDocumentDescriptor();
        const count = outlineEntries.length;
        const hasEntries = count > 0;
        const isOpen = isOutlineOpen();
        if (outlineBtn) {
          outlineBtn.textContent = "Outline";
          outlineBtn.classList.remove("has-content");
          outlineBtn.classList.toggle("is-active", isOpen);
          outlineBtn.setAttribute("aria-pressed", isOpen ? "true" : "false");
          outlineBtn.title = isOpen
            ? "Hide document outline."
            : (hasEntries
              ? (count + " outline entr" + (count === 1 ? "y" : "ies") + " for " + descriptor.label + ". Open the outline rail.")
              : "Open document outline for the current editor text.");
        }
        if (outlineMetaEl) {
          outlineMetaEl.textContent = hasEntries
            ? (count + " entr" + (count === 1 ? "y" : "ies") + " · " + (editorLanguage || "text") + " · " + descriptor.label)
            : ("No outline entries · " + (editorLanguage || "text"));
        }
        if (outlineDoneBtn) {
          outlineDoneBtn.disabled = !isOpen;
        }
        if (outlineEmptyStateEl) {
          outlineEmptyStateEl.hidden = hasEntries;
        }
        renderOutlineList();
      }

      function renderOutlineList() {
        if (!outlineListEl) return;
        outlineListEl.innerHTML = "";
        for (const entry of outlineEntries) {
          const itemBtn = document.createElement("button");
          itemBtn.type = "button";
          itemBtn.className = "outline-entry";
          itemBtn.dataset.outlineId = String(entry.id || "");
          itemBtn.style.paddingLeft = (10 + Math.max(0, (entry.depth || 1) - 1) * 14) + "px";
          itemBtn.title = getOutlineKindLabel(entry.kind) + " · line " + String(entry.lineStart || 1) + "\n" + String(entry.label || "");

          const kindEl = document.createElement("span");
          kindEl.className = "outline-entry-kind";
          kindEl.textContent = getOutlineKindBadge(entry.kind);
          itemBtn.appendChild(kindEl);

          const titleEl = document.createElement("span");
          titleEl.className = "outline-entry-title";
          titleEl.textContent = String(entry.label || "");
          itemBtn.appendChild(titleEl);

          const metaEl = document.createElement("span");
          metaEl.className = "outline-entry-meta";
          metaEl.textContent = "L" + String(entry.lineStart || 1);
          itemBtn.appendChild(metaEl);

          outlineListEl.appendChild(itemBtn);
        }
      }

      function buildOutlineEntryAnchor(entry) {
        if (!entry) return null;
        return normalizeReviewNote({
          selectionStart: entry.selectionStart,
          selectionEnd: entry.selectionEnd,
          lineStart: entry.lineStart,
          lineEnd: entry.lineEnd,
          selectedText: entry.selectedText,
          selectedDisplayText: entry.selectedDisplayText || entry.label,
        });
      }

      function jumpToOutlineEntry(entryId) {
        const entry = outlineEntries.find((candidate) => candidate && String(candidate.id || "") === String(entryId || ""));
        if (!entry) return false;
        const anchor = buildOutlineEntryAnchor(entry);
        if (!anchor) return false;
        return jumpToReviewAnchor(anchor, {
          statusMessage: "Jumped to outline entry.",
          afterJump: () => {
            revealReviewNoteInPreview(anchor);
          },
        });
      }

      function closeOutline(options) {
        if (!outlineOverlayEl || outlineOverlayEl.hidden) return;
        outlineOverlayEl.hidden = true;
        updateOutlineUi();
        if (editorView === "markdown") {
          scheduleEditorLineNumberRender();
        }
        const focusTarget = options && Object.prototype.hasOwnProperty.call(options, "focusTarget")
          ? options.focusTarget
          : (outlineReturnFocusEl || outlineBtn || sourceTextEl);
        outlineReturnFocusEl = null;
        if (focusTarget && typeof focusTarget.focus === "function") {
          const schedule = typeof window.requestAnimationFrame === "function"
            ? window.requestAnimationFrame.bind(window)
            : (cb) => window.setTimeout(cb, 16);
          schedule(() => focusTarget.focus());
        }
      }

      function openOutline() {
        if (!outlineOverlayEl) return;
        if (isReviewNotesOpen()) {
          closeReviewNotes({ focusTarget: null });
        }
        outlineReturnFocusEl = document.activeElement && document.activeElement !== document.body
          ? document.activeElement
          : sourceTextEl;
        outlineOverlayEl.hidden = false;
        updateOutlineUi();
        if (editorView === "markdown") {
          scheduleEditorLineNumberRender();
        }
      }

      function toggleOutline() {
        if (isOutlineOpen()) {
          closeOutline({ focusTarget: outlineBtn || sourceTextEl });
        } else {
          openOutline();
        }
      }

      function updateReviewNotesUi() {
        const descriptor = getCurrentStudioDocumentDescriptor();
        const count = reviewNotes.length;
        const hasNotes = count > 0;
        const isOpen = isReviewNotesOpen();
        if (reviewNotesBtn) {
          reviewNotesBtn.textContent = hasNotes ? "Comments •" : "Comments";
          reviewNotesBtn.classList.toggle("has-content", hasNotes);
          reviewNotesBtn.classList.toggle("is-active", isOpen);
          reviewNotesBtn.setAttribute("aria-pressed", isOpen ? "true" : "false");
          reviewNotesBtn.title = isOpen
            ? "Hide local comments."
            : (hasNotes
              ? (count + " local comment" + (count === 1 ? "" : "s") + " for " + descriptor.label + ". Open the side-by-side comments rail.")
              : "Open local comments beside the current editor document or draft. Comments stay outside the document text and can later be converted into [an: ...] annotations.");
        }
        if (reviewNotesMetaEl) {
          const scopeLabel = descriptor.fileBacked
            ? "file-backed"
            : (descriptor.draftBacked ? "draft-backed" : "local buffer");
          reviewNotesMetaEl.textContent = hasNotes
            ? (count + " comment" + (count === 1 ? "" : "s") + " · " + scopeLabel + " · " + descriptor.label)
            : ("No comments yet · " + scopeLabel);
        }
        if (reviewNotesAddBtn) {
          reviewNotesAddBtn.disabled = editorView !== "markdown";
          reviewNotesAddBtn.title = editorView === "markdown"
            ? "Create a new local comment on the current editor line."
            : (supportsPreviewCommentsForCurrentEditor()
              ? "Select preview text and use Comment for a local preview-anchored comment."
              : "Switch to Editor (Raw) to comment on the current line.");
        }
        if (reviewNotesPromptBtn) {
          const promptCandidates = reviewNotes.filter((note) => String(note && note.text ? note.text : "").trim());
          reviewNotesPromptBtn.disabled = uiBusy || promptCandidates.length === 0;
          reviewNotesPromptBtn.title = promptCandidates.length > 0
            ? "Load local comments, line numbers, and file labels into the editor as a prompt."
            : "No non-empty local comments to load as a prompt.";
        }
        if (reviewNotesInlineAllBtn) {
          const currentText = String(sourceTextEl && sourceTextEl.value ? sourceTextEl.value : "");
          const toggleCandidates = getDisplayReviewNotes().filter((note) => getReviewNoteInlineState(note, currentText).canToggle);
          const allInline = toggleCandidates.length > 0 && toggleCandidates.every((note) => getReviewNoteInlineState(note, currentText).exists);
          reviewNotesInlineAllBtn.disabled = uiBusy || toggleCandidates.length === 0;
          reviewNotesInlineAllBtn.textContent = allInline ? "Inline: On" : "Inline: Off";
          reviewNotesInlineAllBtn.setAttribute("aria-pressed", allInline ? "true" : "false");
          reviewNotesInlineAllBtn.title = allInline
            ? "Inline annotations derived from all non-empty comments are currently on. Click to remove them."
            : "Inline annotations derived from all non-empty comments are currently off. Click to add them.";
        }
        if (reviewNotesDeleteAllBtn) {
          reviewNotesDeleteAllBtn.disabled = uiBusy || !hasNotes;
          reviewNotesDeleteAllBtn.title = hasNotes
            ? "Delete all local comments for this document or draft. Existing inline [an: ...] annotations in the editor text are left unchanged."
            : "No local comments to delete.";
        }
        if (reviewNotesDoneBtn) {
          reviewNotesDoneBtn.disabled = !isOpen;
        }
        if (reviewNotesEmptyStateEl) {
          reviewNotesEmptyStateEl.hidden = hasNotes;
        }
      }

      function renderReviewNotesList() {
        if (!reviewNotesListEl) return;
        reviewNotesListEl.innerHTML = "";
        for (const note of getDisplayReviewNotes()) {
          const card = document.createElement("article");
          card.className = "review-note-card";

          const header = document.createElement("div");
          header.className = "review-note-card-header";

          const titleWrap = document.createElement("div");
          titleWrap.className = "review-note-card-title";

          const anchor = document.createElement("span");
          anchor.className = "review-note-anchor";
          anchor.textContent = summarizeReviewNoteAnchor(note);
          titleWrap.appendChild(anchor);

          const quote = document.createElement("div");
          quote.className = "review-note-quote";
          quote.textContent = summarizeReviewNoteQuote(note);
          titleWrap.appendChild(quote);
          header.appendChild(titleWrap);

          card.appendChild(header);

          const textarea = document.createElement("textarea");
          textarea.value = String(note.text || "");
          textarea.placeholder = "Write a local comment here…";
          textarea.title = "Write a local comment. Enter inserts a new line; changes save automatically as you type.";
          card.appendChild(textarea);

          const footer = document.createElement("div");
          footer.className = "review-note-card-footer";

          const timestamp = document.createElement("span");
          timestamp.className = "review-note-timestamp";
          timestamp.textContent = formatReviewNoteTimestamp(note.updatedAt);

          const actions = document.createElement("div");
          actions.className = "review-note-card-actions";

          const jumpBtn = document.createElement("button");
          jumpBtn.type = "button";
          jumpBtn.textContent = "Jump";
          jumpBtn.title = "Jump to this comment's anchored location in the editor.";
          jumpBtn.addEventListener("click", () => {
            jumpToReviewNote(note.id);
          });
          actions.appendChild(jumpBtn);

          const inlineState = getReviewNoteInlineState(note, sourceTextEl.value || "");
          const convertBtn = document.createElement("button");
          convertBtn.type = "button";
          convertBtn.className = "review-note-inline-btn";
          convertBtn.textContent = inlineState.exists ? "Inline: On" : "Inline: Off";
          convertBtn.setAttribute("aria-pressed", inlineState.exists ? "true" : "false");
          convertBtn.disabled = !inlineState.canToggle || uiBusy;
          convertBtn.title = inlineState.exists
            ? "This comment currently has an inline [an: ...] annotation in the editor. Click to remove it."
            : "This comment is currently not inline in the editor. Click to add it as an inline [an: ...] annotation.";
          convertBtn.addEventListener("click", () => {
            convertReviewNoteToAnnotation(note.id);
          });
          actions.appendChild(convertBtn);

          const deleteBtn = document.createElement("button");
          deleteBtn.type = "button";
          deleteBtn.className = "review-note-delete-btn";
          deleteBtn.textContent = "Delete";
          deleteBtn.title = "Delete this local comment.";
          deleteBtn.addEventListener("click", () => {
            deleteReviewNote(note.id);
          });
          actions.appendChild(deleteBtn);

          footer.appendChild(timestamp);
          footer.appendChild(actions);
          card.appendChild(footer);

          textarea.addEventListener("input", () => {
            note.text = textarea.value;
            note.updatedAt = Date.now();
            timestamp.textContent = formatReviewNoteTimestamp(note.updatedAt);
            const nextInlineState = getReviewNoteInlineState(note, sourceTextEl.value || "");
            convertBtn.disabled = !nextInlineState.canToggle || uiBusy;
            convertBtn.textContent = nextInlineState.exists ? "Inline: On" : "Inline: Off";
            convertBtn.setAttribute("aria-pressed", nextInlineState.exists ? "true" : "false");
            convertBtn.title = nextInlineState.exists
              ? "This comment currently has an inline [an: ...] annotation in the editor. Click to remove it."
              : "This comment is currently not inline in the editor. Click to add it as an inline [an: ...] annotation.";
            scheduleReviewNotesPersistence();
            updateReviewNotesUi();
          });

          reviewNotesListEl.appendChild(card);

          if (pendingReviewNoteInlineFocusId && pendingReviewNoteInlineFocusId === note.id && isReviewNotesOpen()) {
            const schedule = typeof window.requestAnimationFrame === "function"
              ? window.requestAnimationFrame.bind(window)
              : (cb) => window.setTimeout(cb, 16);
            schedule(() => {
              card.scrollIntoView({ block: "nearest" });
              if (!convertBtn.disabled) convertBtn.focus();
            });
          } else if (pendingReviewNoteFocusId && pendingReviewNoteFocusId === note.id && isReviewNotesOpen()) {
            const schedule = typeof window.requestAnimationFrame === "function"
              ? window.requestAnimationFrame.bind(window)
              : (cb) => window.setTimeout(cb, 16);
            schedule(() => {
              card.scrollIntoView({ block: "nearest" });
              textarea.focus();
              const end = textarea.value.length;
              textarea.setSelectionRange(end, end);
            });
          }
        }
        pendingReviewNoteFocusId = null;
        pendingReviewNoteInlineFocusId = null;
      }

      function focusReviewNotesForPreviewBlock(blockEl) {
        if (!blockEl) return;
        const start = Math.max(0, Number(blockEl.dataset && blockEl.dataset.reviewNoteStart) || 0);
        const end = Math.max(start, Number(blockEl.dataset && blockEl.dataset.reviewNoteEnd) || start);
        const source = String(sourceTextEl && sourceTextEl.value ? sourceTextEl.value : "");
        const notes = getPreviewCommentNotesForRange(start, end, source);
        if (!notes.length) return;
        focusReviewNoteInPanel(notes[0].id);
      }

      function addReviewNoteFromPreviewBlock(blockEl) {
        const anchor = buildReviewNoteAnchorFromPreviewBlock(blockEl);
        if (!anchor) return null;
        return addReviewNoteFromAnchor(anchor, {
          statusMessage: "Added local comment from editor preview.",
        });
      }

      function getActivePreviewSelectionAnchorForPane(paneId) {
        return getActivePreviewSelectionForPane(paneId);
      }

      function addReviewNoteFromPreviewSelection(paneId) {
        const anchor = getActivePreviewSelectionAnchorForPane(paneId);
        if (!anchor) {
          setStatus("Select some preview text within a single block first.", "warning");
          return null;
        }
        const note = addReviewNoteFromAnchor(anchor, {
          statusMessage: "Added local comment from preview selection.",
        });
        if (note) {
          const selection = typeof window.getSelection === "function" ? window.getSelection() : null;
          if (selection && typeof selection.removeAllRanges === "function") {
            selection.removeAllRanges();
          }
          clearPreviewCommentSelection();
        }
        return note;
      }

      function addReviewNoteFromAnchor(anchor, options) {
        if (!anchor || typeof anchor !== "object") return null;
        const note = normalizeReviewNote({
          id: makeRequestId(),
          text: "",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          selectionStart: anchor.selectionStart,
          selectionEnd: anchor.selectionEnd,
          lineStart: anchor.lineStart,
          lineEnd: anchor.lineEnd,
          selectedText: anchor.selectedText,
          selectedDisplayText: typeof anchor.selectedDisplayText === "string" ? anchor.selectedDisplayText : (typeof anchor.selectedText === "string" ? anchor.selectedText : ""),
        });
        if (!note) return null;
        if (editorSelectionCommentBtn) {
          editorSelectionCommentBtn.hidden = true;
        }
        if (editorSelectionJumpBtn) {
          editorSelectionJumpBtn.hidden = true;
        }
        if (editorSelectionActionsEl) {
          editorSelectionActionsEl.hidden = true;
        }
        const shouldOpenReviewNotes = !isReviewNotesOpen();
        pendingReviewNoteFocusId = note.id;
        setReviewNotes(reviewNotes.concat([note]));
        if (shouldOpenReviewNotes) {
          pendingReviewNoteFocusId = note.id;
          openReviewNotes();
        }
        const schedule = typeof window.requestAnimationFrame === "function"
          ? window.requestAnimationFrame.bind(window)
          : (cb) => window.setTimeout(cb, 16);
        schedule(() => {
          updateEditorSelectionCommentUi();
        });
        if (!options || options.status !== false) {
          setStatus((options && options.statusMessage) || "Added local comment.", "success");
        }
        return note;
      }

      function addReviewNoteFromEditorSelection() {
        if (editorView !== "markdown") {
          setStatus("Switch to Editor (Raw) before adding an anchored comment.", "warning");
          return;
        }
        addReviewNoteFromAnchor(getEditorAnchorForReviewNote(), {
          statusMessage: "Added local comment.",
        });
      }

      function jumpToEditorSelectionInPreview() {
        if (editorView !== "markdown") {
          setStatus("Switch to Editor (Raw) before jumping from an editor selection.", "warning");
          return false;
        }
        if (rightView !== "editor-preview" || !critiqueViewEl || !supportsPreviewCommentsForCurrentEditor()) {
          setStatus("Open Editor (Preview) on the right to jump the current editor selection there.", "warning");
          return false;
        }
        const anchor = getEditorAnchorForReviewNote();
        const jumped = revealReviewNoteInPreview(anchor);
        if (!jumped) {
          setStatus("Could not find the current editor selection in the preview.", "warning");
          return false;
        }
        const current = String(sourceTextEl.value || "");
        const range = resolveReviewNoteRange(anchor, current);
        if (range) {
          scrollEditorRangeIntoView(range);
        }
        setStatus("Jumped to the current editor selection in the preview.", "success");
        return true;
      }

      function addReviewNoteFromEditorLine() {
        if (editorView !== "markdown") {
          setStatus("Switch to Editor (Raw) before adding a line comment.", "warning");
          return;
        }
        addReviewNoteFromAnchor(getEditorLineAnchorForReviewNote(), {
          statusMessage: "Added local line comment.",
        });
      }

      function jumpToReviewAnchor(anchor, options) {
        if (!anchor) return false;
        const current = String(sourceTextEl.value || "");
        const range = resolveReviewNoteRange(anchor, current);
        if (!range) {
          setStatus((options && options.notFoundStatusMessage) || "Could not find the anchored location.", "warning");
          return false;
        }
        suppressEditorSelectionComment = true;
        suppressedEditorSelectionStart = range.start;
        suppressedEditorSelectionEnd = range.end;
        updateEditorSelectionCommentUi();
        setEditorView("markdown");
        setActivePane("left");
        sourceTextEl.focus();
        sourceTextEl.setSelectionRange(range.start, range.end);
        const schedule = typeof window.requestAnimationFrame === "function"
          ? window.requestAnimationFrame.bind(window)
          : (cb) => window.setTimeout(cb, 16);
        schedule(() => {
          scrollEditorRangeIntoView(range);
          if (options && typeof options.afterJump === "function") {
            options.afterJump(range);
          }
          updateEditorSelectionCommentUi();
        });
        if (!options || options.status !== false) {
          setStatus((options && options.statusMessage) || "Jumped to anchored location in the editor.", "success");
        }
        return true;
      }

      function jumpToPreviewSelection(paneId) {
        const anchor = getActivePreviewSelectionAnchorForPane(paneId);
        if (!anchor) {
          setStatus("Select some preview text within a single block first.", "warning");
          return false;
        }
        const previewNote = normalizeReviewNote(anchor);
        const jumped = jumpToReviewAnchor(previewNote, {
          statusMessage: "Jumped to preview selection in the raw editor.",
          afterJump: () => {
            const paneEl = getPreviewSelectionPaneElement(paneId);
            if (paneEl && previewNote) {
              revealReviewNoteInPreviewElement(paneEl, previewNote);
            }
            const schedule = typeof window.requestAnimationFrame === "function"
              ? window.requestAnimationFrame.bind(window)
              : (cb) => window.setTimeout(cb, 16);
            schedule(() => {
              const selection = typeof window.getSelection === "function" ? window.getSelection() : null;
              if (selection && typeof selection.removeAllRanges === "function") {
                selection.removeAllRanges();
              }
              clearPreviewCommentSelection();
              const current = String(sourceTextEl && sourceTextEl.value ? sourceTextEl.value : "");
              const range = resolveReviewNoteRange(previewNote, current);
              if (range && sourceTextEl) {
                try {
                  sourceTextEl.focus({ preventScroll: true });
                } catch {
                  sourceTextEl.focus();
                }
                if (typeof sourceTextEl.setSelectionRange === "function") {
                  sourceTextEl.setSelectionRange(range.start, range.end);
                }
              }
            });
          },
        });
        return jumped;
      }

      function jumpToReviewNote(noteId) {
        const note = reviewNotes.find((entry) => entry && entry.id === noteId);
        if (!note) return;
        jumpToReviewAnchor(note, {
          status: false,
          notFoundStatusMessage: "Could not find the anchored location for this comment.",
          afterJump: () => {
            revealReviewNoteInPreview(note);
          },
        });
      }

      function deleteReviewNote(noteId) {
        const note = reviewNotes.find((entry) => entry && entry.id === noteId);
        if (!note) return;
        const confirmed = window.confirm("Delete this local comment?");
        if (!confirmed) return;
        setReviewNotes(reviewNotes.filter((entry) => entry && entry.id !== noteId));
        setStatus("Deleted local comment.", "success");
      }

      function deleteAllReviewNotes() {
        if (!reviewNotes.length) {
          setStatus("No local comments to delete.", "warning");
          return;
        }
        const count = reviewNotes.length;
        const confirmed = window.confirm(
          "Delete all " + count + " local comment" + (count === 1 ? "" : "s") + " for this document?\n\n"
            + "Existing inline [an: ...] annotations in the editor text will not be removed.",
        );
        if (!confirmed) return;
        setReviewNotes([]);
        setStatus("Deleted all local comments.", "success");
      }

      function convertReviewNoteToAnnotation(noteId) {
        if (uiBusy) {
          setStatus("Wait until the current Studio action finishes before toggling inline annotation state.", "warning");
          return;
        }
        const note = reviewNotes.find((entry) => entry && entry.id === noteId);
        if (!note) return;
        const current = String(sourceTextEl.value || "");
        const inlineState = getReviewNoteInlineState(note, current);
        if (!inlineState.annotationBody) {
          setStatus("Comment is empty. Add some text before toggling inline annotation state.", "warning");
          return;
        }
        if (!inlineState.range || !inlineState.canToggle) {
          setStatus("Could not find the anchored location for this comment.", "warning");
          return;
        }
        const next = inlineState.exists
          ? current.slice(0, inlineState.range.end) + current.slice(inlineState.range.end + inlineState.markerText.length)
          : current.slice(0, inlineState.range.end) + inlineState.markerText + current.slice(inlineState.range.end);
        setEditorView("markdown");
        setEditorText(next, { preserveScroll: true, preserveSelection: true });
        pendingReviewNoteInlineFocusId = note.id;
        renderReviewNotesList();
        updateReviewNotesUi();
        setStatus(inlineState.exists ? "Removed inline annotation from local comment." : "Added inline annotation from local comment.", "success");
      }

      function toggleAllReviewNotesInlineAnnotations() {
        if (uiBusy) {
          setStatus("Wait until the current Studio action finishes before toggling inline annotations.", "warning");
          return;
        }
        const candidates = getDisplayReviewNotes().filter((note) => getReviewNoteInlineState(note, sourceTextEl.value || "").canToggle);
        if (candidates.length === 0) {
          setStatus("No non-empty comments are ready to toggle inline.", "warning");
          return;
        }
        let currentText = String(sourceTextEl.value || "");
        const shouldRemoveAll = candidates.every((note) => getReviewNoteInlineState(note, currentText).exists);
        const ordered = candidates
          .map((note) => ({ note, state: getReviewNoteInlineState(note, currentText) }))
          .filter((entry) => entry.state.range)
          .sort((left, right) => (right.state.range ? right.state.range.end : 0) - (left.state.range ? left.state.range.end : 0));

        let changed = false;
        for (const entry of ordered) {
          const liveState = getReviewNoteInlineState(entry.note, currentText);
          if (!liveState.range || !liveState.canToggle) continue;
          if (shouldRemoveAll) {
            if (!liveState.exists) continue;
            currentText = currentText.slice(0, liveState.range.end) + currentText.slice(liveState.range.end + liveState.markerText.length);
            changed = true;
          } else {
            if (liveState.exists) continue;
            currentText = currentText.slice(0, liveState.range.end) + liveState.markerText + currentText.slice(liveState.range.end);
            changed = true;
          }
        }

        if (!changed) {
          setStatus(shouldRemoveAll ? "No inline annotations were removed." : "No inline annotations were added.", "warning");
          return;
        }

        setEditorView("markdown");
        setEditorText(currentText, { preserveScroll: true, preserveSelection: true });
        renderReviewNotesList();
        updateReviewNotesUi();
        if (reviewNotesInlineAllBtn && typeof reviewNotesInlineAllBtn.focus === "function") {
          reviewNotesInlineAllBtn.focus();
        }
        setStatus(shouldRemoveAll ? "Removed inline annotations from all comments." : "Added inline annotations from all comments.", "success");
      }

      function updateScratchpadUi() {
        const normalized = String(scratchpadText || "");
        const hasContent = Boolean(normalized.trim());
        const descriptor = getCurrentStudioDocumentDescriptor();
        if (scratchpadBtn) {
          scratchpadBtn.textContent = hasContent ? "Scratchpad •" : "Scratchpad";
          scratchpadBtn.classList.toggle("has-content", hasContent);
          scratchpadBtn.title = hasContent
            ? ("Open the local persistent scratchpad for this document/draft. Scope: " + descriptor.label + ". File-backed docs come back across Pi restarts; unsaved drafts stay with this draft instance until saved or cleared.")
            : ("Open a local persistent scratchpad for this document/draft. Scope: " + descriptor.label + ". File-backed docs come back across Pi restarts; unsaved drafts stay with this draft instance until saved or cleared.");
        }
        if (scratchpadMetaEl) {
          scratchpadMetaEl.textContent = hasContent
            ? ("Saved locally for this document/draft · " + normalized.length + " chars")
            : "Empty · local to this document/draft";
        }
        if (scratchpadInsertBtn) scratchpadInsertBtn.disabled = !hasContent;
        if (scratchpadCopyBtn) scratchpadCopyBtn.disabled = !hasContent;
        if (scratchpadClearBtn) scratchpadClearBtn.disabled = !normalized.length;
      }

      function setScratchpadText(nextText, options) {
        scratchpadText = String(nextText || "");
        if (scratchpadTextEl && scratchpadTextEl.value !== scratchpadText) {
          scratchpadTextEl.value = scratchpadText;
        }
        if (!options || options.persist !== false) {
          persistScratchpadText(scratchpadText);
        }
        updateScratchpadUi();
      }

      function closeScratchpad(options) {
        if (!scratchpadOverlayEl || scratchpadOverlayEl.hidden) return;
        scratchpadOverlayEl.hidden = true;
        syncModalOpenState();
        const focusTarget = options && Object.prototype.hasOwnProperty.call(options, "focusTarget")
          ? options.focusTarget
          : (scratchpadReturnFocusEl || scratchpadBtn || sourceTextEl);
        scratchpadReturnFocusEl = null;
        if (focusTarget && typeof focusTarget.focus === "function") {
          const schedule = typeof window.requestAnimationFrame === "function"
            ? window.requestAnimationFrame.bind(window)
            : (cb) => window.setTimeout(cb, 16);
          schedule(() => focusTarget.focus());
        }
      }

      function openScratchpad() {
        if (!scratchpadOverlayEl) return;
        if (isReviewNotesOpen()) {
          closeReviewNotes({ focusTarget: null });
        }
        if (isOutlineOpen()) {
          closeOutline({ focusTarget: null });
        }
        scratchpadReturnFocusEl = document.activeElement && document.activeElement !== document.body
          ? document.activeElement
          : sourceTextEl;
        scratchpadOverlayEl.hidden = false;
        syncModalOpenState();
        if (scratchpadTextEl && typeof scratchpadTextEl.focus === "function") {
          const schedule = typeof window.requestAnimationFrame === "function"
            ? window.requestAnimationFrame.bind(window)
            : (cb) => window.setTimeout(cb, 16);
          schedule(() => {
            scratchpadTextEl.focus();
            if (typeof scratchpadTextEl.selectionStart === "number") {
              const end = scratchpadTextEl.value.length;
              scratchpadTextEl.setSelectionRange(end, end);
            }
          });
        }
      }

      function closeReviewNotes(options) {
        if (!reviewNotesOverlayEl || reviewNotesOverlayEl.hidden) return;
        reviewNotesOverlayEl.hidden = true;
        updateReviewNotesUi();
        if (editorView === "markdown") {
          scheduleEditorLineNumberRender();
        }
        const focusTarget = options && Object.prototype.hasOwnProperty.call(options, "focusTarget")
          ? options.focusTarget
          : (reviewNotesReturnFocusEl || reviewNotesBtn || sourceTextEl);
        reviewNotesReturnFocusEl = null;
        if (focusTarget && typeof focusTarget.focus === "function") {
          const schedule = typeof window.requestAnimationFrame === "function"
            ? window.requestAnimationFrame.bind(window)
            : (cb) => window.setTimeout(cb, 16);
          schedule(() => focusTarget.focus());
        }
      }

      function openReviewNotes() {
        if (!reviewNotesOverlayEl) return;
        if (isScratchpadOpen()) {
          closeScratchpad({ focusTarget: null });
        }
        if (isOutlineOpen()) {
          closeOutline({ focusTarget: null });
        }
        reviewNotesReturnFocusEl = document.activeElement && document.activeElement !== document.body
          ? document.activeElement
          : sourceTextEl;
        reviewNotesOverlayEl.hidden = false;
        renderReviewNotesList();
        updateReviewNotesUi();
        if (editorView === "markdown") {
          scheduleEditorLineNumberRender();
        }
      }

      function toggleReviewNotes() {
        if (isReviewNotesOpen()) {
          closeReviewNotes({ focusTarget: reviewNotesBtn || sourceTextEl });
        } else {
          openReviewNotes();
        }
      }

      function insertScratchpadIntoEditor() {
        const content = String(scratchpadText || "");
        if (!content.trim()) {
          setStatus("Scratchpad is empty.", "warning");
          return;
        }

        const current = sourceTextEl.value || "";
        const start = typeof sourceTextEl.selectionStart === "number" ? sourceTextEl.selectionStart : current.length;
        const end = typeof sourceTextEl.selectionEnd === "number" ? sourceTextEl.selectionEnd : start;
        const safeStart = Math.max(0, Math.min(start, current.length));
        const safeEnd = Math.max(safeStart, Math.min(end, current.length));
        const next = current.slice(0, safeStart) + content + current.slice(safeEnd);
        setEditorText(next, { preserveScroll: false, preserveSelection: false });
        const caret = safeStart + content.length;
        sourceTextEl.setSelectionRange(caret, caret);
        setActivePane("left");
        closeScratchpad({ focusTarget: sourceTextEl });
        setStatus("Inserted scratchpad into editor.", "success");
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

      function syncHighlightSelectUi() {
        if (!highlightSelect) return;
        if (!editorHighlightEnabled) {
          highlightSelect.value = "off";
          syncStudioUiRefreshSummaries();
          return;
        }
        highlightSelect.value = (editorLanguage && SUPPORTED_LANGUAGES.indexOf(editorLanguage) !== -1)
          ? editorLanguage
          : "markdown";
        syncStudioUiRefreshSummaries();
      }

      function setEditorHighlightEnabled(enabled) {
        editorHighlightEnabled = Boolean(enabled);
        persistEditorHighlightEnabled(editorHighlightEnabled);
        syncHighlightSelectUi();
        updateEditorHighlightState();
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
        syncHighlightSelectUi();
        if (editorHighlightEnabled && editorView === "markdown") {
          scheduleEditorHighlightRender();
        }
        if (editorView === "preview") {
          scheduleSourcePreviewRender(0);
        }
        updateOutlineUi();
      }

      function setEditorHighlightMode(mode) {
        if (mode === "off") {
          setEditorHighlightEnabled(false);
          return;
        }
        setEditorLanguage(mode);
        setEditorHighlightEnabled(true);
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

        if (isEditorOnlyMode) {
          if (sendRunBtn) {
            sendRunBtn.textContent = "Run editor text";
            sendRunBtn.classList.remove("request-stop-active", "repl-secondary-action");
            sendRunBtn.disabled = true;
            sendRunBtn.title = "Run is unavailable in editor-only mode.";
          }
          if (queueSteerBtn) {
            queueSteerBtn.hidden = false;
            queueSteerBtn.disabled = true;
            queueSteerBtn.classList.remove("request-stop-active");
            queueSteerBtn.title = "Queue steering is unavailable in editor-only mode.";
          }
          if (sendReplBtn) {
            sendReplBtn.hidden = true;
            sendReplBtn.disabled = true;
            sendReplBtn.classList.remove("repl-primary-action");
            const replActionLine = sendReplBtn.closest(".repl-action-line");
            if (replActionLine instanceof HTMLElement) replActionLine.hidden = true;
          }
          if (replSendModeSelect) {
            replSendModeSelect.hidden = true;
            replSendModeSelect.disabled = true;
          }
          if (critiqueBtn) {
            critiqueBtn.textContent = "Critique text";
            critiqueBtn.classList.remove("request-stop-active");
            critiqueBtn.disabled = true;
            critiqueBtn.title = "Critique is unavailable in editor-only mode.";
          }
          if (quizBtn) {
            quizBtn.disabled = true;
            quizBtn.title = "Quiz is unavailable in editor-only mode.";
          }
          syncStudioUiRefreshReviewTrigger();
          return;
        }

        if (sendRunBtn) {
          sendRunBtn.textContent = directIsStop ? "Stop" : (rightView === "repl" ? withStudioShortcutLabel("Run editor text", "run") : "Run editor text");
          sendRunBtn.classList.toggle("request-stop-active", directIsStop);
          sendRunBtn.classList.toggle("repl-secondary-action", rightView === "repl" && !directIsStop);
          sendRunBtn.disabled = wsState === "Disconnected" || (!directIsStop && (uiBusy || critiqueIsStop));
          const replHint = rightView === "repl" && getActiveReplSession()
            ? " Sends text to Pi, not the REPL; use Send chunk/selection or Send to REPL to execute code in the active REPL."
            : "";
          sendRunBtn.title = directIsStop
            ? "Stop the active run. Shortcut: Esc."
            : (annotationsEnabled
              ? "Run editor text as-is (includes [an: ...] markers). Shortcut: Cmd/Ctrl+Enter. Stop the active request with Esc." + replHint
              : "Run editor text with [an: ...] markers stripped. Shortcut: Cmd/Ctrl+Enter. Stop the active request with Esc." + replHint);
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

        const hasReplSession = Boolean(getActiveReplSession());
        if (sendReplBtn) {
          const showReplSend = rightView === "repl";
          sendReplBtn.hidden = !showReplSend;
          sendReplBtn.disabled = !showReplSend || wsState === "Disconnected" || uiBusy || replBusy || !hasReplSession;
          sendReplBtn.classList.toggle("repl-primary-action", showReplSend);
          sendReplBtn.textContent = showReplSend ? withStudioShortcutLabel(replSendMode === "literate" ? "Send selection/chunks" : "Send to REPL", "repl-send") : "Send to REPL";
          sendReplBtn.title = hasReplSession
            ? (replSendMode === "literate"
              ? "Literate send: selection, current fenced code chunk, or all matching chunks if the cursor is outside a chunk. Shortcut: Cmd/Ctrl+Shift+Enter."
              : "Raw send: selection, or full editor if no selection. Shortcut: Cmd/Ctrl+Shift+Enter.")
            : "Start or select a REPL session in the right pane first.";
          const replActionLine = sendReplBtn.closest(".repl-action-line");
          if (replActionLine instanceof HTMLElement) replActionLine.hidden = !showReplSend;
        }
        if (replSendModeSelect) {
          replSendModeSelect.hidden = rightView !== "repl";
          replSendModeSelect.disabled = wsState === "Disconnected" || uiBusy || replBusy;
          replSendModeSelect.value = replSendMode;
          replSendModeSelect.title = replSendMode === "literate"
            ? "Literate send: Send to REPL uses the selection, current fenced code chunk, or all matching chunks if the cursor is outside a chunk."
            : "Raw send: Send to REPL uses the selection, or full editor if no selection.";
        }

        if (critiqueBtn) {
          critiqueBtn.textContent = critiqueIsStop ? "Stop" : "Critique text";
          critiqueBtn.classList.toggle("request-stop-active", critiqueIsStop);
          critiqueBtn.disabled = critiqueIsStop ? wsState === "Disconnected" : (uiBusy || canQueueSteering);
          critiqueBtn.title = critiqueIsStop
            ? "Stop the running critique request. Shortcut: Esc."
            : (canQueueSteering
              ? "Critique queueing is not supported while Run editor text is active."
              : (annotationsEnabled
                ? "Critique text as-is (includes [an: ...] markers)."
                : "Critique text with [an: ...] markers stripped."));
        }
        if (quizBtn) {
          quizBtn.textContent = hasResumableQuiz() ? "Resume quiz" : "Quiz me";
          quizBtn.disabled = wsState === "Disconnected" || uiBusy || canQueueSteering;
          quizBtn.title = canQueueSteering
            ? "Quiz is unavailable while Run editor text is active."
            : (hasResumableQuiz()
              ? "Resume the current Studio quiz."
              : "Open an active quiz for the current editor selection or document.");
        }
        syncStudioUiRefreshReviewTrigger();
      }

      function updateAnnotationModeUi() {
        if (annotationModeSelect) {
          annotationModeSelect.value = annotationsEnabled ? "on" : "off";
          annotationModeSelect.title = annotationsEnabled
            ? "Inline annotations On: keep and send [an: ...] markers."
            : "Inline annotations Hide: keep markers in the editor, hide them in preview, and strip before Run/Critique.";
        }

        syncStudioUiRefreshSummaries();
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
        if (contextChanged) {
          updateFooterMeta();
        }

        if (
          message.type === "quiz_progress" ||
          message.type === "quiz_generated" ||
          message.type === "quiz_feedback" ||
          message.type === "quiz_discussion" ||
          message.type === "quiz_error"
        ) {
          if (handleQuizServerMessage(message)) return;
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
          if (typeof message.terminalSessionDetail === "string") {
            terminalSessionDetail = message.terminalSessionDetail;
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
            !explicitDocumentIdentityFromUrl &&
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
              draftId: typeof message.initialDocument.draftId === "string" && message.initialDocument.draftId.trim()
                ? message.initialDocument.draftId.trim()
                : (initialSourceState.draftId || null),
            });
            if (message.initialDocument.path) {
              markFileBackedBaseline(message.initialDocument.text);
            }
            refreshResponseUi();
            if (typeof message.initialDocument.label === "string" && message.initialDocument.label.length > 0) {
              setStatus("Loaded " + message.initialDocument.label + ".", "success");
            }
          }

          if (message.traceState) {
            replaceLiveTraceState(message.traceState);
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

        if (message.type === "trace_reset") {
          replaceLiveTraceState(message.trace);
          return;
        }

        if (message.type === "trace_status") {
          updateLiveTraceStatusFromMessage(message);
          return;
        }

        if (message.type === "trace_entry_upsert") {
          upsertLiveTraceEntry(message.entry);
          return;
        }

        if (message.type === "trace_assistant_delta") {
          appendLiveTraceAssistantDelta(message.entryId, message.deltaKind, message.delta, message.updatedAt);
          return;
        }

        if (message.type === "trace_snapshot") {
          const responseId = typeof message.responseHistoryId === "string" ? message.responseHistoryId.trim() : "";
          if (responseId && message.traceState) {
            const normalizedSnapshot = normalizeTraceState(message.traceState);
            traceSnapshotCache.set(responseId, normalizedSnapshot);
            if (traceDisplayContext && traceDisplayContext.responseId === responseId) {
              setTraceDisplayContext({
                mode: "history",
                responseId,
                historyIndex: responseHistoryIndex,
                total: responseHistory.length,
                summary: normalizeTraceSummary(message.summary) || (getSelectedHistoryItem() ? getSelectedHistoryItem().traceSummary : null),
              });
              replaceTraceState(normalizedSnapshot);
            }
          }
          return;
        }

        if (message.type === "repl_state") {
          const previousTmuxAvailable = replTmuxAvailable;
          const previousActiveSessionName = replActiveSessionName;
          const previousTranscript = replTranscript;
          const previousCapturedAt = replCapturedAt;
          const previousError = replError;
          const previousMessage = replMessage;
          const wasBusy = replBusy;
          replTmuxAvailable = typeof message.tmuxAvailable === "boolean" ? message.tmuxAvailable : replTmuxAvailable;
          const sessionsChanged = setReplSessions(message.sessions);
          if (typeof message.activeSessionName === "string" && message.activeSessionName.trim()) {
            setActiveReplSession(message.activeSessionName);
          }
          const journalChanged = mergeReplJournalEntries(message.journalEntries);
          if (typeof message.transcript === "string") replTranscript = trimReplTranscript(message.transcript);
          if (typeof message.capturedAt === "number") replCapturedAt = message.capturedAt;
          replError = typeof message.replError === "string" ? message.replError : (typeof message.captureError === "string" ? message.captureError : "");
          replMessage = typeof message.replMessage === "string" ? message.replMessage : "";
          replBusy = false;
          const controlsChanged = wasBusy
            || sessionsChanged
            || previousTmuxAvailable !== replTmuxAvailable
            || previousActiveSessionName !== replActiveSessionName;
          if (controlsChanged) syncActionButtons();
          const viewChanged = controlsChanged
            || previousTranscript !== replTranscript
            || previousError !== replError
            || previousMessage !== replMessage
            || journalChanged
            || (!previousCapturedAt && replCapturedAt);
          if (viewChanged) renderReplViewIfActive();
          updateReferenceBadge();
          return;
        }

        if (message.type === "repl_tool_send") {
          if (typeof message.sessionName === "string" && message.sessionName.trim()) {
            setActiveReplSession(message.sessionName);
          }
          const changed = recordReplToolSend(message);
          const journalChanged = mergeReplJournalEntries(message.journalEntries);
          if (typeof message.transcript === "string") replTranscript = trimReplTranscript(message.transcript);
          if (typeof message.capturedAt === "number") replCapturedAt = message.capturedAt;
          if (changed || journalChanged) renderReplViewIfActive({ force: true });
          updateReferenceBadge();
          return;
        }

        if (message.type === "repl_capture") {
          const previousActiveSessionName = replActiveSessionName;
          const previousTranscript = replTranscript;
          const previousCapturedAt = replCapturedAt;
          const previousError = replError;
          const previousMessage = replMessage;
          const wasBusy = replBusy;
          let sessionsChanged = false;
          if (message.session) {
            const session = normalizeReplSession(message.session);
            if (session && !replSessions.some((candidate) => candidate.sessionName === session.sessionName)) {
              replSessions = [...replSessions, session];
              sessionsChanged = true;
            }
          }
          if (typeof message.activeSessionName === "string" && message.activeSessionName.trim()) {
            setActiveReplSession(message.activeSessionName);
          }
          let journalChanged = mergeReplJournalEntries(message.journalEntries);
          if (typeof message.transcript === "string") {
            replTranscript = trimReplTranscript(message.transcript);
            journalChanged = updateActiveReplJournalEntryFromTranscript(
              typeof message.activeSessionName === "string" && message.activeSessionName.trim() ? message.activeSessionName : replActiveSessionName,
              replTranscript
            ) || journalChanged;
          }
          if (typeof message.capturedAt === "number") replCapturedAt = message.capturedAt;
          replError = typeof message.replError === "string" ? message.replError : "";
          if (typeof message.replMessage === "string") replMessage = message.replMessage;
          replBusy = false;
          const controlsChanged = wasBusy || sessionsChanged || previousActiveSessionName !== replActiveSessionName;
          if (controlsChanged) syncActionButtons();
          const viewChanged = controlsChanged
            || previousTranscript !== replTranscript
            || previousError !== replError
            || previousMessage !== replMessage
            || journalChanged
            || (!previousCapturedAt && replCapturedAt);
          if (viewChanged) renderReplViewIfActive();
          updateReferenceBadge();
          return;
        }

        if (message.type === "repl_send_ack") {
          replBusy = false;
          replMessage = "";
          replError = "";
          mergeReplJournalEntries(message.journalEntries);
          if (typeof message.requestId === "string") {
            replJournalEntries = replJournalEntries.map((entry) => entry.requestId === message.requestId ? { ...entry, status: "sent", updatedAt: Date.now() } : entry);
            persistReplJournalEntries();
          }
          setStatus("Sent to REPL.", "success");
          syncActionButtons();
          renderReplViewIfActive({ force: true });
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

          pendingResponseScrollReset = true;
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
          if (followLatest) {
            pendingResponseScrollReset = true;
          }
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

            if (!hasHistory && applyLatestPayload(payload, { resetScroll: true })) {
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
            clearArmedTitleAttention(message.requestId);
            stickyStudioKind = null;
          }
          if (message.path) {
            setSourceState({
              source: "file",
              label: message.label || message.path,
              path: message.path,
            }, {
              carryCurrentMetadataToNewDocument: true,
            });
            markFileBackedBaseline(sourceTextEl.value);
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

          if (typeof message.requestId === "string" && pendingRequestId === message.requestId) {
            pendingRequestId = null;
            pendingKind = null;
            clearArmedTitleAttention(message.requestId);
            stickyStudioKind = null;
            setBusy(false);
            setWsState("Ready");
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
          setSourceState({
            source: nextSource,
            label: nextLabel,
            path: nextPath,
            draftId: typeof nextDoc.draftId === "string" && nextDoc.draftId.trim() ? nextDoc.draftId.trim() : null,
          });
          if (nextPath) {
            markFileBackedBaseline(nextDoc.text);
          }
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

        if (message.type === "editor_only_ready") {
          const responseRequestId = typeof message.requestId === "string" ? message.requestId : "";
          if (responseRequestId && pendingRequestId === responseRequestId) {
            pendingRequestId = null;
            pendingKind = null;
            clearArmedTitleAttention(responseRequestId);
            stickyStudioKind = null;
          }
          setBusy(false);
          setWsState("Ready");
          const targetUrl = resolveCompanionEditorTargetUrl(message);
          const opened = navigatePendingCompanionWindow(responseRequestId, targetUrl);
          const readyMessage = typeof message.message === "string" && message.message.trim()
            ? message.message.trim()
            : "Opened companion editor with a detached copy of the current editor text.";
          setStatus(
            opened
              ? readyMessage
              : (targetUrl ? "Companion editor ready: " + targetUrl : "Companion editor is ready, but Studio did not receive a URL."),
            opened ? "success" : "warning",
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
          if (typeof message.terminalSessionDetail === "string") {
            terminalSessionDetail = message.terminalSessionDetail;
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
          if (typeof message.requestId === "string") {
            closePendingCompanionWindow(message.requestId);
          }
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
          if (typeof message.requestId === "string") {
            closePendingCompanionWindow(message.requestId);
          }
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
          if (replBusy) {
            replBusy = false;
            replError = typeof message.message === "string" ? message.message : "REPL request failed.";
            if (typeof message.requestId === "string") {
              replJournalEntries = replJournalEntries.map((entry) => entry.requestId === message.requestId ? { ...entry, status: "error", output: replError, updatedAt: Date.now() } : entry);
              persistReplJournalEntries();
            }
            renderReplViewIfActive({ force: true });
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
          updateDocumentTitle();
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
        const wsParams = new URLSearchParams({ token: token });
        if (studioMode !== "full") {
          wsParams.set("mode", studioMode);
        }
        if (DEBUG_ENABLED) {
          wsParams.set("debug", "1");
        }
        const wsUrl = wsProtocol + "://" + window.location.host + "/ws?" + wsParams.toString();
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
            setStatus("This full Studio tab was replaced by a newer Studio session.", "warning");
            return;
          }

          if (kind === "full_conflict") {
            clearScheduledReconnect();
            reconnectAttempt = 0;
            setWsState("Disconnected");
            setStatus("Another full Studio view is already active for this session. Use /studio-replace for a fresh full Studio view, or /studio-editor-only for a concurrent editor-only Studio view.", "warning");
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
          if (event && event.code === 4004) {
            handleDisconnect("full_conflict", 4004);
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

      function openPendingCompanionWindow(requestId) {
        if (!requestId) return null;
        let companionWindow = null;
        try {
          companionWindow = window.open("", "_blank");
          if (companionWindow && companionWindow.document && companionWindow.document.body) {
            companionWindow.document.title = "Opening companion editor…";
            companionWindow.document.body.innerHTML = "<p style=\"font: 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 16px;\">Opening companion editor…</p>";
          }
        } catch {
          companionWindow = null;
        }
        if (companionWindow) {
          pendingCompanionWindows.set(requestId, companionWindow);
        }
        return companionWindow;
      }

      function takePendingCompanionWindow(requestId) {
        if (!requestId || !pendingCompanionWindows.has(requestId)) return null;
        const companionWindow = pendingCompanionWindows.get(requestId);
        pendingCompanionWindows.delete(requestId);
        return companionWindow || null;
      }

      function closePendingCompanionWindow(requestId) {
        const companionWindow = takePendingCompanionWindow(requestId);
        if (!companionWindow || companionWindow.closed) return;
        try {
          companionWindow.close();
        } catch {}
      }

      function resolveCompanionEditorTargetUrl(message) {
        const relativeUrl = message && typeof message.relativeUrl === "string" ? message.relativeUrl : "";
        if (relativeUrl) {
          try {
            return new URL(relativeUrl, window.location.href).href;
          } catch {}
        }
        return message && typeof message.url === "string" ? message.url : "";
      }

      function navigatePendingCompanionWindow(requestId, targetUrl) {
        if (!targetUrl) {
          closePendingCompanionWindow(requestId);
          return false;
        }
        const companionWindow = takePendingCompanionWindow(requestId);
        if (companionWindow && !companionWindow.closed) {
          try {
            companionWindow.opener = null;
            companionWindow.location.href = targetUrl;
            return true;
          } catch {}
        }
        try {
          return Boolean(window.open(targetUrl, "_blank", "noopener"));
        } catch {
          return false;
        }
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
        let header = "annotated reply: below\n\n";
        header += "- original source: " + sourceDescriptor + "\n";
        header += "- user annotation syntax: [an: note]\n";
        header += "- precedence: later messages supersede these annotations unless user explicitly references them\n\n---\n\n";
        return header;
      }

      function stripAnnotationBoundaryMarker(text) {
        return String(text || "").replace(/\n{0,2}--- end annotations ---\s*$/i, "");
      }

      function stripAnnotationHeader(text) {
        const normalized = String(text || "").replace(/\r\n/g, "\n");
        const lower = normalized.toLowerCase();
        if (!lower.startsWith("annotated reply: below") && !lower.startsWith("annotated reply below:")) {
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
          insertHeaderBtn.textContent = "Annotation header: On";
          insertHeaderBtn.title = "Remove annotated-reply protocol header while keeping body text.";
          syncStudioUiRefreshSummaries();
          return;
        }
        insertHeaderBtn.textContent = "Annotation header: Off";
        insertHeaderBtn.title = "Insert annotated-reply protocol header (source metadata, [an: ...] syntax hint, precedence note, and end marker).";
        syncStudioUiRefreshSummaries();
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
        leftPaneEl.addEventListener("mousedown", (event) => activatePaneFromInteraction("left", event));
        leftPaneEl.addEventListener("focusin", (event) => activatePaneFromInteraction("left", event));
      }

      if (rightPaneEl) {
        rightPaneEl.addEventListener("mousedown", (event) => activatePaneFromInteraction("right", event));
        rightPaneEl.addEventListener("focusin", (event) => activatePaneFromInteraction("right", event));
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
        flushScratchpadPersistence();
        flushReviewNotesPersistence();
      });

      editorViewSelect.addEventListener("change", () => {
        setEditorView(editorViewSelect.value);
      });

      rightViewSelect.addEventListener("change", () => {
        setRightView(rightViewSelect.value);
      });

      attachResponsePaneInteractionHandlers();

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
          setEditorHighlightMode(highlightSelect.value);
        });
      }

      if (responseHighlightSelect) {
        responseHighlightSelect.addEventListener("change", () => {
          setResponseHighlightEnabled(responseHighlightSelect.value === "on");
        });
      }

      if (editorFontSizeSelect) {
        editorFontSizeSelect.addEventListener("change", () => {
          setEditorFontSize(editorFontSizeSelect.value);
        });
      }

      if (responseFontSizeSelect) {
        responseFontSizeSelect.addEventListener("change", () => {
          setResponseFontSize(responseFontSizeSelect.value);
        });
      }

      if (lineNumbersSelect) {
        lineNumbersSelect.addEventListener("change", () => {
          setLineNumbersEnabled(lineNumbersSelect.value === "on");
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

      sourceTextEl.addEventListener("keydown", handleSourceTextTabKey);

      sourceTextEl.addEventListener("input", () => {
        if (activePreviewCommentSelection) {
          clearPreviewCommentSelection();
        }
        clearSuppressedEditorSelectionComment();
        renderSourcePreview({ previewDelayMs: PREVIEW_INPUT_DEBOUNCE_MS });
        scheduleEditorMetaUpdate();
        updateEditorSelectionCommentUi();
        updateOutlineUi();
        if (isReviewNotesOpen() && reviewNotes.length > 0) {
          renderReviewNotesList();
          updateReviewNotesUi();
        }
      });

      sourceTextEl.addEventListener("select", () => {
        if (suppressEditorSelectionComment) {
          const selectionStart = typeof sourceTextEl.selectionStart === "number" ? sourceTextEl.selectionStart : 0;
          const selectionEnd = typeof sourceTextEl.selectionEnd === "number" ? sourceTextEl.selectionEnd : selectionStart;
          const matchesSuppressedSelection = selectionStart === suppressedEditorSelectionStart && selectionEnd === suppressedEditorSelectionEnd;
          if (!matchesSuppressedSelection && selectionEnd > selectionStart) {
            clearSuppressedEditorSelectionComment();
          }
        }
        updateEditorSelectionCommentUi();
      });

      sourceTextEl.addEventListener("keyup", () => {
        updateEditorSelectionCommentUi();
      });

      sourceTextEl.addEventListener("mouseup", () => {
        updateEditorSelectionCommentUi();
      });

      sourceTextEl.addEventListener("focus", () => {
        updateEditorSelectionCommentUi();
      });

      sourceTextEl.addEventListener("blur", () => {
        const schedule = typeof window.requestAnimationFrame === "function"
          ? window.requestAnimationFrame.bind(window)
          : (cb) => window.setTimeout(cb, 16);
        schedule(() => {
          updateEditorSelectionCommentUi();
        });
      });

      sourceTextEl.addEventListener("scroll", () => {
        if (editorView !== "markdown") return;
        syncEditorHighlightScroll();
      });

      sourceTextEl.addEventListener("keyup", () => {
        if (editorView !== "markdown") return;
        syncEditorHighlightScroll();
      });

      sourceTextEl.addEventListener("mouseup", () => {
        if (editorView !== "markdown") return;
        syncEditorHighlightScroll();
      });

      window.addEventListener("resize", () => {
        if (editorView !== "markdown") return;
        syncEditorHighlightScroll();
        scheduleEditorLineNumberRender();
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

      if (quizBtn) {
        quizBtn.addEventListener("click", () => {
          openQuizOverlay();
        });
      }

      loadResponseBtn.addEventListener("click", () => {
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
        const content = latestResponseMarkdown;
        if (!content.trim()) {
          setStatus("No response available yet.", "warning");
          return;
        }

        try {
          await writeTextToClipboard(content);
          setStatus("Copied response text.", "success");
        } catch (error) {
          setStatus("Clipboard write failed.", "warning");
        }
      });

      if (exportPdfBtn) {
        exportPdfBtn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          toggleExportPreviewMenu();
        });
      }

      if (exportPreviewMenuEl) {
        exportPreviewMenuEl.addEventListener("click", (event) => {
          const target = event.target;
          const actionBtn = target instanceof Element ? target.closest("[data-export-preview-format]") : null;
          if (!actionBtn) return;
          event.preventDefault();
          event.stopPropagation();
          if (actionBtn.disabled) return;
          const format = String(actionBtn.getAttribute("data-export-preview-format") || "pdf").toLowerCase();
          void exportRightPaneFormat(format === "html" ? "html" : "pdf");
        });
      }

      document.addEventListener("click", (event) => {
        const target = event.target;
        if (target instanceof Element && target.closest("#exportPreviewControls")) return;
        closeExportPreviewMenu();
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeExportPreviewMenu();
      });

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

      if (refreshFromDiskBtn) {
        refreshFromDiskBtn.addEventListener("click", () => {
          if (!hasRefreshableFilePath()) {
            setStatus("Refresh from disk is only available for file-backed documents.", "warning");
            return;
          }

          if (editorDiffersFromFileBackedBaseline()) {
            const confirmed = window.confirm("Replace current editor contents with the latest version from disk?");
            if (!confirmed) return;
          }

          const requestId = beginUiAction("refresh_from_disk");
          if (!requestId) return;

          const sent = sendMessage({
            type: "refresh_from_disk_request",
            requestId,
          });

          if (!sent) {
            pendingRequestId = null;
            pendingKind = null;
            setBusy(false);
          }
        });
      }

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

      if (openCompanionBtn) {
        openCompanionBtn.addEventListener("click", () => {
          const content = sourceTextEl.value;

          const requestId = beginUiAction("open_editor_only");
          if (!requestId) return;
          openPendingCompanionWindow(requestId);

          const sent = sendMessage({
            type: "open_editor_only_request",
            requestId,
            content,
            label: sourceState && sourceState.label ? sourceState.label : "current editor",
            path: sourceState && sourceState.path ? sourceState.path : undefined,
            resourceDir: resourceDirInput && resourceDirInput.value.trim()
              ? resourceDirInput.value.trim()
              : undefined,
          });

          if (!sent) {
            closePendingCompanionWindow(requestId);
            pendingRequestId = null;
            pendingKind = null;
            setBusy(false);
          }
        });
      }

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

      if (zenModeBtn) {
        zenModeBtn.addEventListener("click", () => {
          setStudioZenMode(!studioZenModeEnabled);
        });
      }

      sendRunBtn.addEventListener("click", () => {
        if (getAbortablePendingKind() === "direct") {
          requestCancelForPendingRequest("direct");
          return;
        }

        const prepared = prepareEditorTextForRunRequest(sourceTextEl.value);
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
          const prepared = prepareEditorTextForRunRequest(sourceTextEl.value);
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

      if (sendReplBtn) {
        sendReplBtn.addEventListener("click", () => {
          sendEditorTextToRepl();
        });
      }

      if (replSendModeSelect) {
        replSendModeSelect.addEventListener("change", () => {
          setReplSendMode(replSendModeSelect.value);
          syncActionButtons();
          renderReplViewIfActive({ force: true });
        });
      }

      copyDraftBtn.addEventListener("click", async () => {
        const content = sourceTextEl.value;
        if (!content.trim()) {
          setStatus("Editor is empty. Nothing to copy.", "warning");
          return;
        }

        try {
          await writeTextToClipboard(content);
          setStatus("Copied text.", "success");
        } catch (error) {
          setStatus("Clipboard write failed.", "warning");
        }
      });

      if (reviewNotesBtn) {
        reviewNotesBtn.addEventListener("click", () => {
          toggleReviewNotes();
        });
      }

      if (outlineBtn) {
        outlineBtn.addEventListener("click", () => {
          toggleOutline();
        });
      }

      if (outlineCloseBtn) {
        outlineCloseBtn.addEventListener("click", () => {
          closeOutline();
        });
      }

      if (outlineDoneBtn) {
        outlineDoneBtn.addEventListener("click", () => {
          closeOutline();
        });
      }

      if (outlineListEl) {
        outlineListEl.addEventListener("click", (event) => {
          const target = event.target;
          const entryBtn = target instanceof Element ? target.closest(".outline-entry") : null;
          if (!entryBtn) return;
          const outlineId = entryBtn.getAttribute("data-outline-id") || "";
          if (!outlineId) return;
          jumpToOutlineEntry(outlineId);
        });
      }

      if (reviewNotesCloseBtn) {
        reviewNotesCloseBtn.addEventListener("click", () => {
          closeReviewNotes();
        });
      }

      if (reviewNotesDoneBtn) {
        reviewNotesDoneBtn.addEventListener("click", () => {
          closeReviewNotes();
        });
      }

      if (reviewNotesAddBtn) {
        reviewNotesAddBtn.addEventListener("click", () => {
          addReviewNoteFromEditorLine();
        });
      }

      if (editorSelectionCommentBtn) {
        editorSelectionCommentBtn.addEventListener("mousedown", (event) => {
          event.preventDefault();
        });
        editorSelectionCommentBtn.addEventListener("click", () => {
          addReviewNoteFromEditorSelection();
        });
      }

      if (editorSelectionJumpBtn) {
        editorSelectionJumpBtn.addEventListener("mousedown", (event) => {
          event.preventDefault();
        });
        editorSelectionJumpBtn.addEventListener("click", () => {
          jumpToEditorSelectionInPreview();
        });
      }

      if (reviewNotesPromptBtn) {
        reviewNotesPromptBtn.addEventListener("click", () => {
          loadReviewNotesPromptIntoEditor();
        });
      }

      if (reviewNotesInlineAllBtn) {
        reviewNotesInlineAllBtn.addEventListener("click", () => {
          toggleAllReviewNotesInlineAnnotations();
        });
      }

      if (reviewNotesDeleteAllBtn) {
        reviewNotesDeleteAllBtn.addEventListener("click", () => {
          deleteAllReviewNotes();
        });
      }

      if (reviewNoteGutterContentEl) {
        reviewNoteGutterContentEl.addEventListener("click", (event) => {
          const target = event.target;
          const markerBtn = target instanceof Element ? target.closest(".editor-review-note-marker") : null;
          if (!markerBtn) return;
          const noteId = markerBtn.getAttribute("data-review-note-id") || "";
          if (!noteId) return;
          focusReviewNoteInPanel(noteId);
        });
      }

      document.addEventListener("click", (event) => {
        const target = event.target;
        const focusBtn = target instanceof Element ? target.closest(".studio-pdf-card-focus") : null;
        if (!focusBtn) return;
        handleStudioPdfFocusButtonClick(event);
      }, true);

      document.addEventListener("click", (event) => {
        const target = event.target;
        const focusBtn = target instanceof Element ? target.closest(".studio-html-artifact-focus-btn") : null;
        if (!focusBtn) return;
        handleStudioHtmlFocusButtonClick(event);
      }, true);

      document.addEventListener("click", (event) => {
        const target = event.target;
        const copyBtn = target instanceof Element ? target.closest(".studio-copy-block-btn") : null;
        if (!copyBtn) return;
        void handleCopyPreviewBlockButtonClick(event);
      }, true);

      document.addEventListener("pointerup", (event) => {
        const target = event.target;
        const copyBtn = target instanceof Element ? target.closest(".studio-copy-block-btn") : null;
        if (!copyBtn) return;
        void handleCopyPreviewBlockButtonClick(event);
      }, true);

      function handlePreviewCommentActionMouseDown(event) {
        const target = event.target;
        const actionBtn = target instanceof Element ? target.closest(".preview-comment-add, .preview-comment-jump, .preview-comment-summary") : null;
        if (!actionBtn) return;
        event.preventDefault();
      }

      function handlePreviewCommentActionClick(event) {
        const target = event.target;
        const actionBtn = target instanceof Element ? target.closest(".preview-comment-add, .preview-comment-jump, .preview-comment-summary") : null;
        if (!actionBtn) return;
        event.preventDefault();
        event.stopPropagation();
        const mode = String(actionBtn.dataset && actionBtn.dataset.previewCommentMode ? actionBtn.dataset.previewCommentMode : "");
        if (!mode || !mode.startsWith("selection")) return;
        const paneId = String(actionBtn.dataset && actionBtn.dataset.previewPane ? actionBtn.dataset.previewPane : "");
        const action = String(actionBtn.dataset && actionBtn.dataset.previewCommentAction ? actionBtn.dataset.previewCommentAction : "comment");
        if (action === "jump") {
          jumpToPreviewSelection(paneId);
          return;
        }
        addReviewNoteFromPreviewSelection(paneId);
      }

      if (leftPaneEl) {
        leftPaneEl.addEventListener("mousedown", handlePreviewCommentActionMouseDown);
        leftPaneEl.addEventListener("click", handlePreviewCommentActionClick);
      }

      if (rightPaneEl) {
        rightPaneEl.addEventListener("mousedown", handlePreviewCommentActionMouseDown);
        rightPaneEl.addEventListener("click", handlePreviewCommentActionClick);
      }

      if (typeof document.addEventListener === "function") {
        document.addEventListener("selectionchange", () => {
          updateActivePreviewCommentSelectionFromDom();
        });
      }

      if (scratchpadBtn) {
        scratchpadBtn.addEventListener("click", () => {
          openScratchpad();
        });
      }

      if (scratchpadCloseBtn) {
        scratchpadCloseBtn.addEventListener("click", () => {
          closeScratchpad();
        });
      }

      if (scratchpadDoneBtn) {
        scratchpadDoneBtn.addEventListener("click", () => {
          closeScratchpad();
        });
      }

      if (scratchpadOverlayEl) {
        scratchpadOverlayEl.addEventListener("click", (event) => {
          if (event.target === scratchpadOverlayEl) {
            closeScratchpad();
          }
        });
      }

      if (scratchpadTextEl) {
        scratchpadTextEl.addEventListener("input", () => {
          setScratchpadText(scratchpadTextEl.value);
        });
      }

      if (scratchpadInsertBtn) {
        scratchpadInsertBtn.addEventListener("click", () => {
          insertScratchpadIntoEditor();
        });
      }

      if (scratchpadCopyBtn) {
        scratchpadCopyBtn.addEventListener("click", async () => {
          if (!String(scratchpadText || "").trim()) {
            setStatus("Scratchpad is empty.", "warning");
            return;
          }

          try {
            await writeTextToClipboard(String(scratchpadText || ""));
            setStatus("Copied scratchpad text.", "success");
          } catch (error) {
            setStatus("Clipboard write failed.", "warning");
          }
        });
      }

      if (scratchpadClearBtn) {
        scratchpadClearBtn.addEventListener("click", () => {
          if (!String(scratchpadText || "").length) return;
          const confirmed = window.confirm("Clear scratchpad text?");
          if (!confirmed) return;
          setScratchpadText("");
          if (scratchpadTextEl) scratchpadTextEl.focus();
          setStatus("Cleared scratchpad.", "success");
        });
      }

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
      if (sourceBadgeEl) {
        sourceBadgeEl.addEventListener("click", () => {
          resetEditorOrigin();
        });
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

        // Clear the input immediately so selecting the same file again will
        // still fire a future change event.
        fileInput.value = "";

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

      if (sourceEditorWrapEl && typeof ResizeObserver === "function") {
        const editorResizeObserver = new ResizeObserver(() => {
          if (editorView !== "markdown") return;
          scheduleEditorLineNumberRender();
        });
        editorResizeObserver.observe(sourceEditorWrapEl);
      }

      const initialEditorFontSize = readStoredFontSize(EDITOR_FONT_SIZE_STORAGE_KEY, EDITOR_FONT_SIZE_OPTIONS, DEFAULT_EDITOR_FONT_SIZE);
      setEditorFontSize(initialEditorFontSize, { persist: false });

      const initialResponseFontSize = readStoredFontSize(RESPONSE_FONT_SIZE_STORAGE_KEY, RESPONSE_FONT_SIZE_OPTIONS, DEFAULT_RESPONSE_FONT_SIZE);
      setResponseFontSize(initialResponseFontSize, { persist: false });

      if (resourceDirInput && initialResourceDir) {
        resourceDirInput.value = initialResourceDir;
      }
      setSourceState(initialSourceState);
      refreshResponseUi();
      updateAnnotatedReplyHeaderButton();
      setActivePane("left");

      const storedEditorHighlightEnabled = readStoredEditorHighlightEnabled();
      const initialHighlightEnabled = storedEditorHighlightEnabled ?? Boolean(highlightSelect && highlightSelect.value !== "off");
      setEditorHighlightEnabled(initialHighlightEnabled);

      const initialDetectedLang = detectLanguageFromName(initialSourceState.path || initialSourceState.label || "");
      const storedLang = readStoredEditorLanguage();
      setEditorLanguage(initialDetectedLang || storedLang || "markdown");

      const storedLineNumbersEnabled = readStoredEditorLineNumbersEnabled();
      const initialLineNumbersEnabled = storedLineNumbersEnabled ?? Boolean(lineNumbersSelect && lineNumbersSelect.value === "on");
      setLineNumbersEnabled(initialLineNumbersEnabled);

      const storedResponseHighlightEnabled = readStoredResponseHighlightEnabled();
      const initialResponseHighlightEnabled = storedResponseHighlightEnabled ?? Boolean(responseHighlightSelect && responseHighlightSelect.value === "on");
      setResponseHighlightEnabled(initialResponseHighlightEnabled);

      const storedAnnotationsEnabled = readStoredAnnotationsEnabled();
      const initialAnnotationsEnabled = storedAnnotationsEnabled ?? Boolean(annotationModeSelect ? annotationModeSelect.value !== "off" : true);
      setAnnotationsEnabled(initialAnnotationsEnabled, { silent: true });
      setReplSendMode(replSendMode);

      setEditorView(editorView);
      setRightView(rightView);
      renderSourcePreview();
      connect();
      } catch (error) {
        hardFail("Studio UI init failed", error);
      }
    })();


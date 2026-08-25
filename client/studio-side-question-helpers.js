(() => {
  const FOCUS_MAX_CHARS = 60_000;

  function clampOffset(value, length) {
    return Math.max(0, Math.min(length, Math.floor(Number(value) || 0)));
  }

  function truncateFocus(value, maxChars) {
    const source = String(value || "").trim();
    const limit = Math.max(1_000, Math.floor(Number(maxChars) || FOCUS_MAX_CHARS));
    if (source.length <= limit) return { text: source, truncated: false };
    const marker = "\n\n[Pi Studio omitted the middle of this focus snapshot.]\n\n";
    const budget = Math.max(2, limit - marker.length);
    const head = Math.ceil(budget * 0.65);
    const tail = Math.max(1, budget - head);
    return { text: (source.slice(0, head).trimEnd() + marker + source.slice(-tail).trimStart()).slice(0, limit), truncated: true };
  }

  function lineRecords(text) {
    const records = [];
    let start = 0;
    const source = String(text || "");
    const lines = source.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const raw = lines[index];
      const end = start + raw.length;
      records.push({ index: index, text: raw.replace(/\r$/, ""), start: start, end: end });
      start = end + 1;
    }
    return records;
  }

  function findLineIndex(records, offset) {
    if (!records.length) return 0;
    for (let index = 0; index < records.length; index += 1) {
      if (offset <= records[index].end) return index;
    }
    return records.length - 1;
  }

  function markdownHeading(line) {
    const match = String(line || "").match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    return match ? { level: match[1].length, label: match[2].trim() } : null;
  }

  const LATEX_LEVELS = { part: 0, chapter: 1, section: 2, subsection: 3, subsubsection: 4, paragraph: 5, subparagraph: 6 };
  function latexHeading(line) {
    const match = String(line || "").match(/^\s*\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?(?:\[[^\]]*\])?\{([^}]*)\}/);
    if (!match) return null;
    return { level: LATEX_LEVELS[match[1]], label: match[2].trim(), command: match[1] };
  }

  function sectionFromHeadings(text, cursorOffset, headingParser, kind) {
    const records = lineRecords(text);
    const cursorLine = findLineIndex(records, cursorOffset);
    let headingIndex = -1;
    let heading = null;
    for (let index = cursorLine; index >= 0; index -= 1) {
      const candidate = headingParser(records[index].text);
      if (!candidate) continue;
      headingIndex = index;
      heading = candidate;
      break;
    }
    if (!heading) return null;
    let endIndex = records.length;
    for (let index = headingIndex + 1; index < records.length; index += 1) {
      const candidate = headingParser(records[index].text);
      if (candidate && candidate.level <= heading.level) {
        endIndex = index;
        break;
      }
    }
    const start = records[headingIndex].start;
    const end = endIndex < records.length ? records[endIndex].start : String(text || "").length;
    return { kind: "section", sectionKind: kind, label: heading.label || "untitled", text: String(text || "").slice(start, end).trim(), start: start, end: end };
  }

  function paragraphAroundCursor(text, cursorOffset) {
    const source = String(text || "");
    const records = lineRecords(source);
    const cursorLine = findLineIndex(records, cursorOffset);
    let startLine = cursorLine;
    let endLine = cursorLine + 1;
    while (startLine > 0 && records[startLine - 1].text.trim()) startLine -= 1;
    while (endLine < records.length && records[endLine].text.trim()) endLine += 1;
    let start = records[startLine] ? records[startLine].start : 0;
    let end = endLine < records.length ? records[endLine].start : source.length;
    let excerpt = source.slice(start, end).trim();
    if (excerpt.length < 120 && source.length > excerpt.length) {
      start = Math.max(0, cursorOffset - 4_000);
      end = Math.min(source.length, cursorOffset + 4_000);
      excerpt = source.slice(start, end).trim();
    }
    return { kind: "section", sectionKind: "passage", label: "Text around cursor", text: excerpt, start: start, end: end };
  }

  function findStudioSideQuestionSection(text, cursorOffset, language) {
    const source = String(text || "");
    const cursor = clampOffset(cursorOffset, source.length);
    const lang = String(language || "").trim().toLowerCase();
    if (lang === "latex" || lang === "tex") {
      return sectionFromHeadings(source, cursor, latexHeading, "latex") || paragraphAroundCursor(source, cursor);
    }
    if (!lang || lang === "markdown" || lang === "md" || lang === "qmd" || lang === "mdx") {
      return sectionFromHeadings(source, cursor, markdownHeading, "markdown") || paragraphAroundCursor(source, cursor);
    }
    return paragraphAroundCursor(source, cursor);
  }

  function chooseStudioSideQuestionFocus(options) {
    const input = options && typeof options === "object" ? options : {};
    const editorText = String(input.editorText || "");
    const responseText = String(input.responseText || "");
    const start = clampOffset(input.selectionStart, editorText.length);
    const end = Math.max(start, clampOffset(input.selectionEnd, editorText.length));
    const selection = editorText.slice(start, end).trim();
    const requestedMode = String(input.mode || "auto").trim().toLowerCase();
    const mode = requestedMode === "auto" ? (selection ? "selection" : "section") : requestedMode;

    if (mode === "none") return { focusKind: "none", focusLabel: "No starting text", focusText: "", truncated: false };
    if (mode === "response") {
      if (!responseText.trim()) return { focusKind: "none", focusLabel: "No displayed response", focusText: "", truncated: false };
      const bounded = truncateFocus(responseText);
      return { focusKind: "response", focusLabel: "Displayed response", focusText: bounded.text, truncated: bounded.truncated };
    }
    if (mode === "selection") {
      if (!selection) return { focusKind: "none", focusLabel: "No editor text selected", focusText: "", truncated: false };
      const bounded = truncateFocus(selection);
      return { focusKind: "selection", focusLabel: "Editor selection", focusText: bounded.text, truncated: bounded.truncated, start: start, end: end };
    }
    if (mode === "section") {
      const section = findStudioSideQuestionSection(editorText, end || start, input.language);
      if (section && section.text.trim()) {
        const bounded = truncateFocus(section.text);
        const label = section.sectionKind === "passage"
          ? "Text around cursor"
          : "Text under “" + String(section.label || "untitled").slice(0, 160) + "”";
        return { focusKind: "section", focusLabel: label, focusText: bounded.text, truncated: bounded.truncated, start: section.start, end: section.end };
      }
      return { focusKind: "none", focusLabel: "No editor text at cursor", focusText: "", truncated: false };
    }
    if (!editorText.trim()) return { focusKind: "none", focusLabel: "Editor is empty", focusText: "", truncated: false };
    const bounded = truncateFocus(editorText);
    return { focusKind: "editor", focusLabel: "Whole editor document", focusText: bounded.text, truncated: bounded.truncated, start: 0, end: editorText.length };
  }

  function getDefaultStudioSideQuestionGatherScope(options) {
    const input = options && typeof options === "object" ? options : {};
    if (String(input.sourcePath || "").trim() || String(input.resourceDir || "").trim()) return "folder";
    return "none";
  }

  function normalizeTranscriptDate(value, fallback) {
    const date = value instanceof Date ? value : new Date(value == null ? fallback : value);
    return Number.isFinite(date.getTime()) ? date : new Date(fallback);
  }

  function formatTranscriptTimestamp(value) {
    const date = normalizeTranscriptDate(value, Date.now());
    try { return date.toISOString(); } catch { return "unknown time"; }
  }

  function formatTranscriptFilename(value) {
    const date = normalizeTranscriptDate(value, Date.now());
    const pad = (part) => String(part).padStart(2, "0");
    return "side-questions-"
      + date.getFullYear()
      + pad(date.getMonth() + 1)
      + pad(date.getDate())
      + "-"
      + pad(date.getHours())
      + pad(date.getMinutes())
      + pad(date.getSeconds())
      + ".md";
  }

  function escapeTranscriptInline(value) {
    return String(value == null ? "" : value)
      .replace(/[\r\n]+/g, " ")
      .replace(/\\/g, "\\\\")
      .replace(/([`*_\[\]<>|])/g, "\\$1")
      .trim();
  }

  function formatTranscriptContextScope(context) {
    if (!context || context.gatherScope === "none") return "No related files";
    return context.contextRoot ? String(context.contextRoot) : String(context.gatherScope || "Local context");
  }

  function buildStudioSideQuestionTranscriptMarkdown(stateInput, options) {
    const state = stateInput && typeof stateInput === "object" ? stateInput : {};
    const context = state.context && typeof state.context === "object" ? state.context : {};
    const messages = Array.isArray(state.messages) ? state.messages : [];
    const activity = Array.isArray(state.activity) ? state.activity : [];
    const settings = options && typeof options === "object" ? options : {};
    const exportedAt = normalizeTranscriptDate(settings.exportedAt, Date.now());
    const lines = [
      "# Side questions",
      "",
      "_Exported from Pi Studio on " + formatTranscriptTimestamp(exportedAt) + "._",
      "",
      "> This export contains the visible side-thread transcript and context/activity labels. It does not include hidden starting-text contents, inherited main-conversation contents, or raw tool output.",
      "",
      "## Context",
      "",
    ];

    if (Number.isFinite(state.createdAt)) lines.push("- Thread started: " + formatTranscriptTimestamp(state.createdAt));
    if (state.modelLabel) lines.push("- Model: " + escapeTranscriptInline(state.modelLabel));
    if (state.thinking) lines.push("- Thinking: " + escapeTranscriptInline(state.thinking));
    lines.push("- Starting text: " + escapeTranscriptInline(context.focusLabel || "No starting text"));
    lines.push("- Related files: " + escapeTranscriptInline(formatTranscriptContextScope(context)));
    lines.push("- Main conversation snapshot: " + (context.includeConversation === true ? "included" : "not included"));

    const gitSnapshot = context.gitSnapshot && typeof context.gitSnapshot === "object" ? context.gitSnapshot : null;
    if (gitSnapshot) {
      const gitParts = [gitSnapshot.branch || "repository"];
      if (gitSnapshot.head) gitParts.push("HEAD " + gitSnapshot.head);
      if (Number.isFinite(gitSnapshot.changeCount)) gitParts.push(String(Math.max(0, Math.floor(gitSnapshot.changeCount))) + " changes");
      if (Number.isFinite(gitSnapshot.recentCommitCount)) gitParts.push(String(Math.max(0, Math.floor(gitSnapshot.recentCommitCount))) + " recent commits");
      if (gitSnapshot.capturedAt) gitParts.push("captured " + formatTranscriptTimestamp(gitSnapshot.capturedAt));
      if (gitSnapshot.truncated === true) gitParts.push("bounded output truncated");
      lines.push("- Git snapshot: " + escapeTranscriptInline(gitParts.join(" · ")));
    } else {
      lines.push("- Git snapshot: not included");
    }

    const webLabel = context.webSearchRequested === true
      ? (context.webSearchAvailable === true ? "allowed" : "requested but unavailable")
      : "not allowed";
    lines.push("- Web search: " + webLabel);
    const tools = Array.isArray(context.tools) ? context.tools : [];
    lines.push("- Additional Pi tools: " + (tools.length
      ? tools.map((tool) => {
          const name = tool && tool.name ? String(tool.name) : "unnamed tool";
          const source = tool && tool.source ? String(tool.source) : "";
          return escapeTranscriptInline(source ? name + " (" + source + ")" : name);
        }).join(", ")
      : "none"));

    lines.push("", "## Discussion", "");
    let questionCount = 0;
    let answerCount = 0;
    for (const message of messages) {
      if (!message || typeof message !== "object") continue;
      const role = message.role === "assistant" ? "assistant" : "user";
      if (role === "assistant") answerCount += 1;
      else questionCount += 1;
      const number = role === "assistant" ? answerCount : questionCount;
      const status = message.status === "streaming" || message.status === "error" ? message.status : "complete";
      const heading = role === "assistant" ? "Side answer " + number : "Question " + number;
      lines.push("### " + heading + (status === "complete" ? "" : " (" + status + ")"), "");
      if (Number.isFinite(message.createdAt)) lines.push("_" + formatTranscriptTimestamp(message.createdAt) + "_", "");
      const text = typeof message.text === "string" ? message.text.trim() : "";
      lines.push(text || "_[No text captured.]_", "");
    }
    if (!messages.length) lines.push("_[No side-thread messages captured.]_", "");

    if (activity.length) {
      lines.push("## Context activity", "");
      for (const entry of activity) {
        if (!entry || typeof entry !== "object") continue;
        const status = entry.status === "running" || entry.status === "error" ? entry.status : "complete";
        const label = escapeTranscriptInline(entry.label || "Context action");
        const toolName = entry.toolName ? " (`" + String(entry.toolName).replace(/`/g, "\\`") + "`)" : "";
        lines.push("- " + status.charAt(0).toUpperCase() + status.slice(1) + ": " + label + toolName);
      }
      lines.push("");
    }

    return lines.join("\n").replace(/\n{3,}$/g, "\n\n").trimEnd() + "\n";
  }

  globalThis.PiStudioSideQuestionHelpers = Object.freeze({
    FOCUS_MAX_CHARS: FOCUS_MAX_CHARS,
    buildStudioSideQuestionTranscriptMarkdown: buildStudioSideQuestionTranscriptMarkdown,
    chooseStudioSideQuestionFocus: chooseStudioSideQuestionFocus,
    findStudioSideQuestionSection: findStudioSideQuestionSection,
    formatStudioSideQuestionTranscriptFilename: formatTranscriptFilename,
    getDefaultStudioSideQuestionGatherScope: getDefaultStudioSideQuestionGatherScope,
    truncateFocus: truncateFocus,
  });
})();

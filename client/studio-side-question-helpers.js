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
    return { kind: "section", sectionKind: kind, label: heading.label || "current section", text: String(text || "").slice(start, end).trim(), start: start, end: end };
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
    return { kind: "section", sectionKind: "passage", label: "current passage", text: excerpt, start: start, end: end };
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
    let mode = String(input.mode || "auto").trim().toLowerCase();
    if (mode === "auto") mode = selection ? "selection" : "section";

    if (mode === "none") return { focusKind: "none", focusLabel: "No attached editor context", focusText: "", truncated: false };
    if (mode === "response") {
      const bounded = truncateFocus(responseText);
      return { focusKind: "response", focusLabel: "Displayed Studio response", focusText: bounded.text, truncated: bounded.truncated };
    }
    if (mode === "selection" && selection) {
      const bounded = truncateFocus(selection);
      return { focusKind: "selection", focusLabel: "Studio editor selection", focusText: bounded.text, truncated: bounded.truncated };
    }
    if (mode === "section") {
      const section = findStudioSideQuestionSection(editorText, end || start, input.language);
      if (section && section.text.trim()) {
        const bounded = truncateFocus(section.text);
        return { focusKind: "section", focusLabel: section.label, focusText: bounded.text, truncated: bounded.truncated, start: section.start, end: section.end };
      }
    }
    const bounded = truncateFocus(editorText);
    return { focusKind: "editor", focusLabel: "Studio editor document", focusText: bounded.text, truncated: bounded.truncated };
  }

  function getDefaultStudioSideQuestionGatherScope(options) {
    const input = options && typeof options === "object" ? options : {};
    if (String(input.sourcePath || "").trim() || String(input.resourceDir || "").trim()) return "folder";
    return "none";
  }

  globalThis.PiStudioSideQuestionHelpers = Object.freeze({
    FOCUS_MAX_CHARS: FOCUS_MAX_CHARS,
    chooseStudioSideQuestionFocus: chooseStudioSideQuestionFocus,
    findStudioSideQuestionSection: findStudioSideQuestionSection,
    getDefaultStudioSideQuestionGatherScope: getDefaultStudioSideQuestionGatherScope,
    truncateFocus: truncateFocus,
  });
})();

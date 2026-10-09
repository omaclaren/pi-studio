(() => {
  // Page-memory-only. No persistence or authority over Pi's terminal composer.
  const MAX_TEXT_CHARS = 900_000;
  const MAX_PENDING = 8;
  const MAX_PENDING_TEXT_CHARS = 2_700_000;

  function createSubmittedEditorDraftTracker() {
    const pending = new Map();
    let pendingChars = 0;
    let sequence = 0;
    let accepted = null;

    function discard(requestId) {
      const snapshot = pending.get(requestId);
      if (!snapshot) return false;
      pendingChars -= snapshot.text.length;
      pending.delete(requestId);
      return true;
    }

    return Object.freeze({
      remember(requestId, text, sourceKey) {
        if (typeof requestId !== "string" || !requestId || requestId.length > 256
          || pending.has(requestId) || (accepted && accepted.requestId === requestId)) return false;
        if (typeof text !== "string" || text.length > MAX_TEXT_CHARS
          || typeof sourceKey !== "string" || !sourceKey || sourceKey.length > 24_000) return false;
        while (pending.size >= MAX_PENDING || pendingChars + text.length > MAX_PENDING_TEXT_CHARS) {
          discard(pending.keys().next().value);
        }
        pending.set(requestId, { requestId, text, sourceKey, sequence: ++sequence });
        pendingChars += text.length;
        return true;
      },
      accept(requestId) {
        const snapshot = pending.get(requestId);
        if (!snapshot) return false;
        discard(requestId);
        // Late/duplicate acknowledgements cannot replace a newer accepted baseline.
        if (accepted && snapshot.sequence <= accepted.sequence) return false;
        accepted = snapshot;
        return true;
      },
      matches(text, sourceKey) {
        return Boolean(accepted && accepted.text === text && accepted.sourceKey === sourceKey);
      },
      discard,
      clearPending() {
        pending.clear();
        pendingChars = 0;
      },
    });
  }

  function needsDraftReplacementConfirmation({ text, responseText, fileBacked, dirty, submitted }) {
    // Even an empty file buffer can contain an unsaved deletion. Sending it is not saving it.
    if (fileBacked) return Boolean(dirty);
    return Boolean(text.trim() && text !== responseText && !submitted);
  }

  // Informational origin only: never a file grant, saved receipt or run proof.
  function normalizeSourceProvenance(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).some(key => !["version", "kind", "responseId", "responseNumber", "annotated"].includes(key))
      || value.version !== 1 || value.kind !== "response" || typeof value.annotated !== "boolean"
      || !(value.responseId === null || (typeof value.responseId === "string" && value.responseId.length > 0 && value.responseId.length <= 256 && !value.responseId.includes("\0")))
      || !(value.responseNumber === null || (Number.isSafeInteger(value.responseNumber) && value.responseNumber > 0 && value.responseNumber <= 1_000_000_000))) return null;
    return { version: 1, kind: "response", responseId: value.responseId, responseNumber: value.responseNumber, annotated: value.annotated };
  }

  function createResponseDraftProvenance({ id, index, annotated = false }) {
    return Object.freeze({ version: 1, kind: "response",
      responseId: typeof id === "string" && id.length > 0 && id.length <= 256 && !id.includes("\0") ? id : null,
      responseNumber: Number.isSafeInteger(index) && index >= 0 && index < 1_000_000_000 ? index + 1 : null,
      annotated: annotated === true });
  }

  function describeSourceProvenance(value) {
    const p = normalizeSourceProvenance(value);
    return p ? "Loaded from response" + (p.responseNumber === null ? "" : " " + p.responseNumber)
      + (p.annotated ? " for annotation." : ".") : "";
  }

  function safeDraftStem(value) {
    let stem = String(value || "").normalize("NFKC")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[`*_~]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").toLowerCase();
    let bytes = 0;
    stem = Array.from(stem).slice(0, 80).filter(character => {
      const point = character.codePointAt(0), size = point > 0xffff ? 4 : point > 0x7ff ? 3 : point > 0x7f ? 2 : 1;
      bytes += size; return bytes <= 160;
    }).join("").replace(/-+$/g, "");
    if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(stem)) stem = "document-" + stem;
    return stem || "draft";
  }

  function firstDraftHeading(text) {
    const lines = String(text || "").slice(0, 32_000).split(/\r?\n/, 256);
    let frontMatter = /^---\s*$/.test(lines[0]), fence = null;
    for (let i = frontMatter ? 1 : 0; i < lines.length; i++) {
      const line = lines[i];
      if (frontMatter) { if (/^(?:---|\.\.\.)\s*$/.test(line)) frontMatter = false; continue; }
      const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line);
      if (fence) { if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !line.slice(marker[0].length).trim()) fence = null; continue; }
      if (marker) { fence = marker[1]; continue; }
      const heading = /^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
      if (heading) return heading[1];
      if (line.trim() && !/^(?:\s{4}|\t|\s*[-*>])/.test(line) && /^ {0,3}(?:=+|-+)\s*$/.test(lines[i + 1] || "")) return line;
    }
    return "";
  }

  function buildDraftSaveFilename({ sourceState = {}, text = "", annotated = false }) {
    const p = normalizeSourceProvenance(sourceState.provenance);
    if (p) return "response" + (p.responseNumber === null ? "" : "-" + p.responseNumber)
      + (p.annotated || annotated ? "-annotated" : "") + ".md";
    // Imported HTML is authored HTML, not Markdown. CSS/script/body lines may
    // resemble Markdown headings; retain the informational HTML extension first.
    if (sourceState.source === "import" || sourceState.source === "upload") {
      const name = String(sourceState.label || "").replace(/^(?:upload|imported copy):\s*/i, "").split(/[/\\]/).at(-1) || "";
      const htmlName = /^(.+)\.(html?)$/i.exec(name);
      if (htmlName) return safeDraftStem(htmlName[1]) + (annotated ? "-annotated" : "") + "." + htmlName[2];
    }
    const heading = firstDraftHeading(text);
    if (heading) return safeDraftStem(heading) + (annotated ? "-annotated" : "") + ".md";
    if (sourceState.source === "upload") {
      const name = String(sourceState.label || "").replace(/^(?:upload|imported copy):\s*/i, "").split(/[/\\]/).at(-1) || "";
      const match = /^(.+)\.([a-z0-9]{1,12})$/i.exec(name);
      return safeDraftStem(match ? match[1] : name) + (annotated ? "-annotated" : "") + (match ? "." + match[2] : ".md");
    }
    return "draft" + (annotated ? "-annotated" : "") + ".md";
  }

  // Informational UI only. SDK user-message receipts establish its baseline;
  // it has no role in replacement consent, saving or submission authority.
  function createPromptRunIndicatorTracker({ now = () => Date.now() } = {}) {
    const pending = new Map(), records = new Map();
    let sequence = 0, pendingChars = 0;
    const validId = id => typeof id === "string" && id.length > 0 && id.length <= 256;
    function discard(requestId) {
      const item = pending.get(requestId);
      if (!item) return false;
      pendingChars -= item.text?.length || 0; pending.delete(requestId); return true;
    }
    return Object.freeze({
      initialize(bufferId, fresh = false) {
        if (!validId(bufferId) || records.has(bufferId)) return false;
        records.set(bufferId, { phase: fresh ? "not-run" : "unknown", text: null, sentAt: null, sequence: 0 }); return true;
      },
      remember(requestId, bufferId, text) {
        if (!validId(requestId) || !validId(bufferId) || typeof text !== "string" || pending.has(requestId)) return false;
        const kept = text.length <= MAX_TEXT_CHARS ? text : null;
        while (pending.size >= MAX_PENDING || pendingChars + (kept?.length || 0) > MAX_PENDING_TEXT_CHARS) {
          const id = pending.keys().next().value, lost = pending.get(id), previous = records.get(lost.bufferId);
          if (!previous || previous.sequence < lost.sequence) records.set(lost.bufferId, { phase: "unknown", text: null, sentAt: previous?.sentAt ?? null, sequence: lost.sequence });
          discard(id);
        }
        pending.set(requestId, { bufferId, text: kept, sequence: ++sequence }); pendingChars += kept?.length || 0; return true;
      },
      submitted(requestId, sentAt) {
        const item = pending.get(requestId); if (!item) return false;
        discard(requestId); const previous = records.get(item.bufferId);
        if (previous && previous.sequence >= item.sequence) return false;
        records.set(item.bufferId, { phase: item.text === null ? "unknown" : "sent", text: item.text,
          sentAt: typeof sentAt === "number" && Number.isFinite(sentAt) && sentAt > 0 ? sentAt : now(), sequence: item.sequence, requestId }); return true;
      },
      // A settled Stop or failure belongs only to the Run that sent this text.
      // requestIds lists every input receipt accepted during that Run, steering included.
      settled(requestIds, outcome, settledAt) {
        const ids = (Array.isArray(requestIds) ? requestIds : [requestIds]).filter(validId);
        if (!ids.length || !["stopped", "failed"].includes(outcome)) return false;
        for (const [bufferId, item] of records) {
          if (item.phase !== "sent" || !ids.includes(item.requestId)) continue;
          records.set(bufferId, { ...item, outcome,
            settledAt: typeof settledAt === "number" && Number.isFinite(settledAt) && settledAt > 0 ? settledAt : now() });
          return true;
        }
        return false;
      },
      uncertain(requestId) {
        const item = pending.get(requestId); if (!item) return false;
        discard(requestId); const previous = records.get(item.bufferId);
        if (previous && previous.sequence >= item.sequence) return false;
        records.set(item.bufferId, { phase: "unknown", text: null, sentAt: previous?.sentAt ?? null, sequence: item.sequence }); return true;
      },
      state(bufferId, text) {
        const item = records.get(bufferId);
        if (!item) return { phase: "unknown", sentAt: null };
        if (item.phase !== "sent") return { phase: item.phase, sentAt: item.sentAt };
        if (item.text !== text) return { phase: "edited", sentAt: item.sentAt };
        return item.outcome ? { phase: item.outcome, sentAt: item.sentAt, settledAt: item.settledAt } : { phase: "sent", sentAt: item.sentAt };
      },
      discard,
      clearPending() {
        for (const item of pending.values()) {
          const previous = records.get(item.bufferId);
          if (!previous || previous.sequence < item.sequence) records.set(item.bufferId, { phase: "unknown", text: null, sentAt: previous?.sentAt ?? null, sequence: item.sequence });
        }
        pending.clear(); pendingChars = 0;
      },
      // Preserve status/time without duplicating draft text in recovery storage.
      // Exact content comparisons intentionally become unknown after a reload.
      snapshot() { return { version: 1, records: [...records].map(([bufferId, item]) => ({ bufferId,
        phase: item.phase === "sent" || [...pending.values()].some(p => p.bufferId === bufferId) ? "unknown" : item.phase,
        sentAt: item.sentAt, sequence: item.sequence })) }; },
      restore(value, bufferId) {
        if (!validId(bufferId) || value?.version !== 1 || !Array.isArray(value.records) || value.records.length > 2) return false;
        const item = value.records.find(r => r?.bufferId === bufferId);
        if (!item || !["not-run", "unknown"].includes(item.phase)
          || !Number.isSafeInteger(item.sequence) || item.sequence < 0
          || (item.sentAt !== null && (typeof item.sentAt !== "number" || !Number.isFinite(item.sentAt) || item.sentAt <= 0))
          || (item.phase === "not-run" && (item.sequence !== 0 || item.sentAt !== null))) return false;
        // A stale not-run snapshot may predate a receipt whose storage write
        // failed. Only fresh in-memory initialization can assert Not run.
        records.set(bufferId, { phase: "unknown", text: null, sentAt: item.sentAt, sequence: item.sequence });
        sequence = Math.max(sequence, item.sequence); return true;
      },
    });
  }

  globalThis.PiStudioEditorDraftHelpers = Object.freeze({
    createSubmittedEditorDraftTracker,
    normalizeSourceProvenance, createResponseDraftProvenance, describeSourceProvenance, buildDraftSaveFilename,
    createPromptRunIndicatorTracker,
    needsDraftReplacementConfirmation,
  });
})();

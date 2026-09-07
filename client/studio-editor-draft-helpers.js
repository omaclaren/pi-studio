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

  globalThis.PiStudioEditorDraftHelpers = Object.freeze({
    createSubmittedEditorDraftTracker,
    needsDraftReplacementConfirmation,
  });
})();

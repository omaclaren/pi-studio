/**
 * A Pi agent run outlives a response, request slot, agent_end, and automatic
 * compaction/retry. Only agent_settled (or session teardown) retires this target.
 * This ledger holds identity/facts, never prompt text or browser view state.
 * @typedef {'direct'|'critique'|'show-me'|'annotation'} RunKind
 * @typedef {{id:string, requestId:string|null, kind:RunKind|null, origin:'studio'|'outside'|'unknown', startedAt:number, stopping:boolean}} Run
 */
export function createStudioRunLifecycle({ makeId = () => crypto.randomUUID(), now = () => Date.now() } = {}) {
  /** @type {Run|null} */
  let run = null;
  /** @type {{reason:string, willRetry:boolean}|null} */
  let compaction = null;
  /** @type {'outside'|'unknown'} */
  let inputOrigin = "unknown";
  /** @param {{id:string,kind:string,startedAt?:number}|null} request */
  function start(request = null) {
    if (run) return snapshot(); // an automatic continuation is the same run
    const owned = request && ["direct", "critique", "show-me", "annotation"].includes(request.kind);
    run = { id: makeId(), requestId: owned ? request.id : null, kind: owned ? /** @type {RunKind} */ (request.kind) : null,
      origin: owned ? "studio" : inputOrigin, startedAt: request?.startedAt ?? now(), stopping: false };
    inputOrigin = "unknown";
    return snapshot();
  }
  function snapshot() {
    return { run: run ? { ...run, phase: run.stopping ? "stopping" : compaction ? "compacting" : "running", cancellable: run.origin === "studio" && !run.stopping } : null,
      compaction: compaction ? { ...compaction } : null };
  }
  return {
    start, snapshot,
    /** Only an SDK input source proves outside origin; missing request IDs do not. @param {string} source */
    input(source) { inputOrigin = source === "interactive" || source === "rpc" ? "outside" : "unknown"; },
    /** @param {{reason?:string,willRetry?:boolean}} event */
    compactStart(event = {}) { compaction = { reason: event.reason || "unknown", willRetry: event.willRetry === true }; },
    compactEnd() { compaction = null; },
    settled() { run = null; compaction = null; inputOrigin = "unknown"; },
    /** Delivery is not settlement. A stale run token cannot stop a later run. */
    /** @param {string} requestId @param {string|undefined} runId @param {()=>void} deliver */
    stop(requestId, runId, deliver) {
      if (!run || run.origin !== "studio" || run.requestId !== requestId || (runId && run.id !== runId)) return { ok: false, message: "That Studio run is no longer the active cancellation target." };
      if (run.stopping) return { ok: true, kind: run.kind }; // idempotent acknowledgement, not a second abort
      const target = run;
      try { deliver(); } catch (error) { return { ok: false, message: "Failed to stop request: " + (error instanceof Error ? error.message : String(error)) }; }
      if (run === target) target.stopping = true;
      return { ok: true, kind: target.kind };
    },
  };
}

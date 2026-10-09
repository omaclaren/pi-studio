import { createStudioDocumentCreationIntent } from "./studio-document-escrow.js";

// Identity lookup, not a file read or a new editable owner. Resume is guarded
// for seen/disconnected tabs; after consent the exact current owner is rechecked.
export async function openStudioRetainedDocument(options, bufferId, focus = true) {
 const generation = options.generation();
 const current = () => generation > 0 && options.generation() === generation && options.current();
 const query = { operation: "owner", bufferId, focus: false };
 const validId = value => typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
 try {
  if (!current()) return false;
  options.observed?.(bufferId, { live: false });
  let result = await options.request(query);
  if (!current()) return false;
  if (!result.ok || !validId(result.owner?.workspaceId) || result.owner?.bufferId !== bufferId) throw Error(result.message || "That Document is no longer retained. Keep any original tab or recovery copy.");
  options.observed?.(bufferId, result);
  if (!focus) return true;
  const owner = result.owner;
  const local = owner.workspaceId === options.workspaceId && typeof options.selectOwner === "function";
  const matches = reply => reply.ok && reply.owner?.workspaceId === owner.workspaceId && reply.owner?.bufferId === owner.bufferId;
  let resumed = false;
  if (!local && !result.live && result.seen) {
   if (!await options.confirm("Reopen the same Document?", "Its tab isn't connected and may have newer edits. Reconnect that tab if you can. Otherwise, reopen the same Document (not a copy)?")) return false;
   if (!current()) return false;
   resumed = true;
  }
  // Always recheck before opening, including unseen creation URLs and local owners.
  result = await options.request({ ...query, expectedOwner: owner });
  if (!current()) return false;
  if (!matches(result)) throw Error(result.message || "The Document owner changed. Recheck; no new tab was opened.");
  options.observed?.(bufferId, result);
  if (!local && !result.live && result.seen && !resumed) throw Error("That editor connected and disconnected while checking. Recheck and choose whether to resume it.");
  if (local && !result.live) {
   if (!options.selectOwner(bufferId)) throw Error("The local Document could not be selected. Current work was kept.");
   options.status("This Document already has an editor here. Its current text was kept; reconnect this window rather than opening another.", "warning");
  } else if (result.live) {
   const focused = await options.request({ ...query, focus: true, generation, expectedOwner: owner });
   if (!current()) return false;
   if (!matches(focused) || !focused.live) throw Error("The editor changed or disconnected before focus. Keep its original tab and recheck.");
   options.observed?.(bufferId, focused);
   if (owner.workspaceId === options.workspaceId && options.selectOwner && !options.selectOwner(bufferId)) throw Error("The local Document could not be selected. Current work was kept.");
   options.status("Focus requested for the existing Document; switch to it if the browser did not focus it.", "success");
  } else {
   if (typeof result.url !== "string" || !result.url) throw Error("The retained editor URL is unavailable. Keep its identity and recheck.");
   options.open(result.url, resumed);
   options.status("Requested the same retained Document window. If the browser blocked it, use Show its window; no independent copy was created.", "success");
  }
  return true;
 } catch (e) { if (current()) { options.observed?.(bufferId, { live: false }); options.status(e.message || "The Document owner could not be checked. Keep its identity and recheck.", "warning"); } return false; }
 finally { if (current()) options.changed(); }
}

// A verified creation is independent from opening, seen/live state and focus.
// Atomic retirement retains token-free destinations; uncertain replies retry v1/v2
// pending requests unchanged, without borrowing a newer source checkpoint.
export function createStudioDocumentLaunchController(options) {
 let flight = null, closed = false, live = false, forgetting = false;
 const observed = new Map(), ownerFlights = new Map();
 const nonce = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, "0")).join("");
 const intents = createStudioDocumentCreationIntent(options.storage, "piStudio.bufferWorkspace.v2:" + options.workspaceId + ":launch", r => {
  if (!r || Object.keys(r).some(k => !["operationId", "bufferId", "documentEpoch", "expectedRevision", "kind", "path", "sourcePath", "resourceDir", "exportId"].includes(k))
   || !["blank", "file"].includes(r.kind) || !/^[a-f0-9]{48}$/.test(r.operationId || "") || !/^[a-f0-9]{48}$/.test(r.expectedRevision || "")
   || !/^[a-zA-Z0-9_-]{1,128}$/.test(r.bufferId || "") || !Number.isSafeInteger(r.documentEpoch) || r.documentEpoch < 1
   || ["path", "sourcePath", "resourceDir"].some(k => typeof r[k] !== "string" || r[k].length > 16384 || r[k].includes("\0"))
   || (r.kind === "blank" ? r.path || r.sourcePath || r.resourceDir : !r.path)
   || (r.exportId !== undefined && (typeof r.exportId !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(r.exportId)))) throw Error("The retained editor request is invalid. Keep it for inspection; it was not replaced.");
  return { ...r };
 }, ["blank", "file"]);
 const peek = () => { const saved = intents.peek(); return { ...saved, live: saved.record ? false : live, busy: !!flight || !!ownerFlights.size,
  destinations: saved.destinations.map(d => ({ ...d, live: observed.get(d.bufferId)?.generation === options.generation() && observed.get(d.bufferId)?.live === true })) }; };
 const notify = (message, kind = "warning") => { if (!closed) { options.status(message, kind); options.changed(); } };
 function show(destination, focus = true, presentation = null) {
  if (closed || (presentation && !presentation.current()) || !destination || !intents.peek().destinations.some(d => d.operationId === destination.operationId && d.bufferId === destination.bufferId)) return Promise.resolve(false);
  // A source-scoped presenter must not coalesce a fresh explicit Show behind
  // an older export whose visible origin has since departed.
  const key = presentation || (destination.bufferId + ":" + focus);
  if (ownerFlights.has(key)) return ownerFlights.get(key);
  // Order owner observations across both modes, without dropping or delaying
  // explicit focus. Later revalidation/focus RPCs supersede older lookup replies.
  let observation;
  const beginObservation = () => { observation = { generation: options.generation(), live: false }; observed.set(destination.bufferId, observation); };
  beginObservation();
  const work = openStudioRetainedDocument({ ...options, ...(presentation ? { open: presentation.open } : {}),
   current: () => !closed && (!presentation || presentation.current()),
   request: body => { beginObservation(); return options.request(body); },
   observed: (bufferId, result) => { if (observed.get(bufferId) !== observation) return; live = result.live === true; observation.live = live; },
  }, destination.bufferId, focus).finally(() => { ownerFlights.delete(key); if (!closed) options.changed(); });
  ownerFlights.set(key, work); return work;
 }
 function run(target, open = true, presentation = null) {
  const current = () => !closed && (!presentation || presentation.current());
  if (!current() || forgetting) return Promise.resolve(false);
  if (flight) return flight;
  flight = (async () => {
   try {
    const saved = intents.peek(); if (saved.error) throw Error(saved.error.message);
    let record = saved.record;
    if (record && target && ["kind", "path", "sourcePath", "resourceDir", "exportId"].some(k => record.request[k] !== target[k])) throw Error("A different editor request is still tracked. Recheck it or explicitly forget its tracking before opening another Document.");
    if (!record) {
     if (!open || !target || options.busy()) return false;
     // A generated export already checkpointed before rendering. Its presenter
     // carries that exact authority; a second checkpoint must not silently rebind
     // older bytes to a newer source. Ordinary New/Open still prepares as before.
     const retainedProof = target.exportId && presentation?.authority;
     if (!retainedProof) await options.prepare();
     if (!current()) return false;
     const proof = retainedProof || options.authority(); if (!proof?.ok) throw Error(proof?.message || "Checkpoint this editor first.");
     const stored = intents.capture({ ...target, operationId: nonce(), bufferId: proof.bufferId, documentEpoch: proof.documentEpoch, expectedRevision: proof.expectedRevision });
     if (!stored.ok) throw Error(stored.message);
     record = intents.peek().record;
    } else { const checked = intents.current(); if (!checked.ok) throw Error(checked.message); }
    if (!current()) return false;
    const result = await options.request({ ...record.request, operation: "launch", generation: options.generation(), focus: false }, open);
    if (closed) return false;
    const completed = intents.complete(result); if (!completed.ok) throw Error(result.message || completed.message);
    const destination = intents.peek().destinations.find(d => d.operationId === record.request.operationId);
    presentation?.retained?.(destination ? Object.freeze({ ...destination }) : null);
    options.changed();
    // Creation proof/discovery is retained even if its original visible preview
    // departed while the RPC was in flight. Cancel only automatic presentation.
    if (!current()) return false;
    if (open) return show(destination, true, presentation);
    return show(destination, false);
   } catch (e) { live = false; if (open) notify(e.message || "Editor outcome unknown. Keep tracking and recheck."); return false; }
  })().finally(() => { flight = null; if (!closed) options.changed(); });
  return flight;
 }
 const timer = setInterval(() => { if (!closed && !flight && !forgetting && options.generation() && intents.peek().record) void run(null, false); }, 1500);
 return Object.freeze({
  start: (target, presentation = null) => run({ kind: target.kind, path: target.path || "", sourcePath: target.sourcePath || "", resourceDir: target.resourceDir || "",
   ...(target.exportId !== undefined ? { exportId: target.exportId } : {}) }, true, presentation),
  recheck: () => intents.peek().record ? run(null, true) : show(intents.peek().destinations.at(-1)),
  ready: async () => { if (intents.peek().record) await run(null, false); else await Promise.all(intents.peek().destinations.map(d => show(d, false))); },
  openDestination: show, state: peek, busy: () => !!flight || !!ownerFlights.size,
  needsUnloadConfirmation: () => Boolean(flight || forgetting || ownerFlights.size || peek().error || peek().record || peek().destinations.some(d => !d.live || !options.generation())),
  async forget() {
   if (closed || flight || !intents.peek().record) return false; const before = intents.peek().record;
   forgetting = true; let agreed;
   try { agreed = await options.confirm("Forget editor request tracking?", "This does not delete any Document. An uncertain editor may become harder to find. Recheck first. Forget tracking to start another independent request?"); } finally { forgetting = false; }
   if (!agreed || closed || flight || intents.peek().record !== before) return false;
   const result = intents.clear(true); if (!result.ok) { notify(result.message); return false; }
   live = false; notify("Tracking removed. Existing Documents and retained destinations were not deleted.", "success"); return true;
  },
  dispose() { closed = true; clearInterval(timer); }
 });
}

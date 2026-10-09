# Active Prompt and editable document buffers

**Hosting follow-up — 2026-09-27:** the uncommitted development checkout now includes separately approved single-owner Document hosting, behind recovery + switching + `PI_STUDIO_DOCUMENT_HOSTING=1`. Prompt stays anchored; move, detached copy, registered blank/text-file opening and existing-owner reuse are distinct operations. Uncertain operations retain their original identities/backups, and Save As metadata attachment requires a prepared receipt. Unsafe legacy entrypoints are explicitly unavailable in this prototype; see [README.md](README.md#additional-opt-in-prototype-single-owner-document-hosting). Source-tree validation does not establish acceptance of an exact alpha package; candidate-scoped artifact and private-install evidence is recorded separately. Finish the [remaining gates](PRERELEASE-CHECKLIST.md#additional-hosting-scope-and-remaining-gates) before packaging/release acceptance; defaults and normal Studio remain unchanged. The earlier status entries below describe their own checkpoints.

**Earlier status — 2026-09-22:** the tested fixed-slot workflow is committed through `40d4462`. Bounded local preparation of `0.10.0-alpha.1` is approved; publication, further commits and installation/default changes are not. The latest checkpoint has 240 focused passes and qualified native pane-scroll confirmation; earlier full-suite/browser counts below belong to their historical checkpoints. Whole-document/composed-Prompt hands-on trials and subsequent ownership fixes are recorded in [ROADMAP.md](ROADMAP.md). Blank-looking Working remains unreproduced and is an explicit local-alpha limitation. The alpha's activation/rollback instructions are in [README.md](README.md#local-alpha-one-prompt--one-document).

**Toolbar follow-up — 2026-09-23:** Oliver approved a bounded cleanup after trying the exact first alpha. The uncommitted rebuild groups **Add to Prompt → Selection / Whole document** and **Open / load**, labels the replacement destination, and removes permanent help/Run-target rows. Selection ownership is preserved through the Add disclosure, not revived after another field/preview. Capacity and disabled-state explanations remain available in the opened menu and action tooltips. This changes no buffer roles, source-loading semantics, defaults or companion behaviour; new artifact evidence is recorded separately from the first candidate.

**Historical status, 2026-09-11:** the foundation and annotation-header compatibility checkpoints are locally committed. A subsequent **one Prompt ↔ one document prototype** is implemented and tested as a local, unreleased checkpoint. It requires both `PI_STUDIO_BUFFER_RECOVERY=1` and `PI_STUDIO_BUFFER_SWITCHING=1`, in a full editable workspace. A separately approved local checkpoint allows switching during an identified direct Run, with 500 passing tests and isolated Brave/Chrome regressions, including the separately approved fixes for stale branch responses and hidden activity-follow state. That checkpoint subsequently passed an isolated live-model hands-on trial. A separately approved **Add selection to Prompt** slice is now a local, unreleased checkpoint: 522 tests and isolated, credential-free Brave/Chrome checks pass after an independent read-only review and separately approved fixes for literal-label boundaries and stale selection presses. No live-provider trial or independent post-fix sign-off is claimed for the selection slice. The earlier Safari evidence covers the foundation, not this switcher. The selection checkpoint subsequently passed a credential-free hands-on trial; Oliver confirmed it worked, and both drafts were backed up before stopping. A separately approved **Add document to Prompt** follow-up is now a local, unreleased checkpoint: 549 tests and twenty isolated Brave/Chrome runs pass after an independent read-only review and separately approved fixes for stale file-open control state and cancelled-press handling. No independent post-fix sign-off or hands-on trial of this follow-up is claimed. Installed Studio, package version and defaults remain unchanged. Updated 2026-09-11.

[ROADMAP.md](ROADMAP.md) owns release scope. `0.9.60` is released; implementation of the store/recovery foundation was approved afterward with the visible UI unchanged. Oliver approved a local checkpoint commit on `feature/buffer-recovery-foundation` on 2026-09-09, without release or default-activation authority. This note records the design and acceptance criteria, not a final wire protocol. The initial module/API boundaries and remaining integration work are in [shared/STUDIO_BUFFER_FOUNDATION.md](shared/STUDIO_BUFFER_FOUNDATION.md).

## Purpose

Studio is primarily a prompt-writing and response-reading workspace. Editable documents and good previews support that loop; Studio does not need to replace Neovim.

The distinction is not whether documents are editable. It is whether selecting a document changes what Run will submit. It must not do so implicitly.

Use **one clearly active Prompt, other prompt drafts that can be parked, and independently editable documents**. Multiple drafts share the Pi conversation; they are not independent chats.

## Current prototype — before general tabs

Oliver approved continuing from the visual guide with a small switching prototype, not the entire interface below. Its two fixed entries are **Prompt** and **Document**:

- A Prompt may be file-backed. Fresh file launches and v1 migration retain the visible editor's file-to-Run intent. Recovering an older v2 file beside a pristine empty Prompt asks **Use file as Prompt / Keep separate Prompt / Cancel**; emptiness alone is not role-change consent.
- Selecting Document preserves the Prompt. **Open / load → Open file in Document…** and Files' open-here action use the separate document slot. Replacing valuable text requires current consent; reopening its exact canonical path preserves its in-memory edits. **Files → Use as Prompt…** is a separate, explicit file load, not a copy of the other buffer's unsaved text.
- When idle, Document view offers **Return to Prompt**, with no submission. A separate Run sends the reviewed Prompt, including a file-backed one. Key repeats (including native held Enter with the Prompt editor in Preview) and double-click continuation cannot turn Return into Run. A fresh activation after key release still works; ordinary textarea repeats are unchanged. Existing annotation send/strip behaviour remains.
- Each buffer retains its text, source, disk baseline/revision, metadata associations, selection, vertical reading positions and preview choices. Response history is still shared. Background history and Follow activity do not steal Document's preview; response-to-editor actions are unavailable there. Returning to a Follow-on Prompt applies a queued response and starts that new response at the top. Follow-off, or returning without a queued update, preserves the earlier response selection and reading position.
- An identified direct Run on a connected socket permits selecting either existing buffer. The submitted text/source snapshot remains owned by Prompt. **Stop** stays global; the Prompt tab and Run shortcut can return without stopping or steering. Save, file opening/replacement, recovery/reset, unresolved Pi-draft disposition and other local-operation/modal locks remain. Unknown busy states and disconnected/reconnecting sockets do not gain this exception.
- A response completed in Document waits for Prompt's Follow policy. Explicit Pi tree changes discard the previous branch's queued response; ordinary empty history still permits a current response's payload fallback. History updates do not rebuild Document's live preview or discard interactive iframe state. Returning during the same Run restores its activity-follow ownership or manual opt-out; completing elsewhere retires only the automatically selected Working view. Disabling Follow activity revokes live and saved ownership. Explicitly re-enabling can follow the exact ongoing Prompt request on return without moving Document's view or reviving finished work. Late error/busy results retire their own pending snapshots without unlocking a newer Run.
- Switching still refuses stale continuations. Whole-pair recovery keeps both buffers; **Reset both buffers** explicitly confirms its scope. Other collections remain retained/exportable rather than being partly adopted.

There is no create/close/park manager, automatic context copying, companion transfer, or non-destructive annotation parking yet. Editing Document does **not** add its edits to the Prompt when returning. Ordinary manual copy/paste remains available. The prototype tests the interaction and preservation boundary; its two-entry strip is not a settled design for many documents. Recovery remains temporary, not a durable draft library.

## Local editor-selection slice

**Add to Prompt → Selection** is an explicit action in the two-buffer strip, available for selected text in Document's editor. It appends the exact in-memory substring, with a literal source label and editor-line range, to the existing Prompt. It does not reread disk, trim the selection, replace the Prompt, switch buffers, save a file, or submit/steer a Run. Document stays selected. Normal recovery persistence still applies to the pair.

The addition is ordinary editable Prompt text; it can be revised or removed there. Each buffer retains its own source, baseline/disk revision, metadata, annotation policy, resources and reading positions. No terminal fingerprint or submission authority comes from Document. During an identified connected Run, an addition prepares the **next** draft; it does not change the already submitted snapshot. Unsafe local work, recovery/modal ownership, unresolved terminal disposition and disconnected/reconnecting states block copying.

The action captures pointer/keyboard intent and rechecks the source, selection owner/range, connection and destination revision. A stale press is not recaptured against a new buffer; held Enter/Space and double-click continuation do not duplicate the addition. Observed range/direction changes and new source focus, pointer or key gestures advance a monotonic owner, so selection A→B→A cannot revive a held press. Preview/iframe/other-field interactions retire the old editor selection as a copy source; select in the editor again. Keyboard focus on the action itself and delayed notifications of its unchanged captured range remain valid.

Source labels are literal code spans, not links or new file grants. Boundary backticks are separated from the delimiters with paired padding, including names supplied through Import file copy, so filename syntax does not become rendered media or links. Line numbers refer to the selected **editor snapshot**, including unsaved edits. Only text is copied: relative resources still use Prompt's own resource context. Existing per-buffer and aggregate limits include the addition and its label; overflow is rejected without partial insertion or eviction. Recovery errors do not roll back or discard an accepted in-memory addition, and existing recovery warnings remain.

Whole-document actions remain separate from selection copying; the local follow-up below does not relax selection ownership. Preview selections, companion transfers, a new undo/history library and general tabs remain deferred.

## Local whole-document append follow-up

**Add to Prompt → Whole document** appends the full selected Document's raw-editor text, including unsaved edits, with a literal **whole document, snapshot** source label. No selection or prior editor focus is required; the action never temporarily selects all, rereads disk or extracts rendered content. It requires the same two opt-ins/full editable mode, and is unavailable in Document Preview/Quarto view. Empty text is refused; whitespace-only text is preserved exactly.

A description in the Add menu and action tooltip reports the complete addition size, including framing, and remaining capacity in UTF-16 string units. It uses the smaller of Prompt's 900,000-unit text headroom and the workspace's 3,000,000-unit aggregate headroom, including baselines. These are editor/recovery limits, not model-context estimates. Oversized additions are refused without truncation or eviction; execution rechecks the destination and capacity.

The append changes only Prompt text/revision and normal workspace/recovery bookkeeping. Both origins, file baselines/revisions, resources, metadata and views remain independent. Document stays selected without a caret/selection/scroll change or preview reconstruction; nothing is saved or sent. The existing identified-Run exception permits next-draft preparation only. Current source/destination revisions, editor/connection consent and a separate interaction generation reject stale held presses, including edit/undo and buffer round trips. Repeats and double-click continuation add once; fresh activations may add again. No selection-owner permission is created for the existing selection action. Local-operation, recovery, modal and terminal-disposition fences remain.

Pending file opens refresh both append controls on entry and cleanup, including stale/error outcomes; an older completion cannot enable them over a newer pending owner. Pointer and keyboard continuation leases stay separate: a fresh click-only activation does not consume a cancelled pointer press, and cannot authorize its later continuation. A completed keyboard lease retires after keyup's native activation task, with a generation check so older cleanup cannot clear a newer press.

This is a local, unreleased checkpoint, not companion transfer, parked prompts or general tabs.

## Proposed next slice: explicit Prompt role

Prompt is an explicit submission role a document can take, independent of file backing, annotations and preview mode. After the fixed-slot alpha, separately scope switching that role between the existing buffers while preserving the previous Prompt. **Annotate** should continue editing the current document; an in-place **Use as Prompt** operation should retain its identity/annotations and send nothing; **Make a prompt copy** should create independent text instead. These are design directions, not implemented alpha controls. The existing Files action loads saved file text, not an in-place promotion of unsaved Document.

Retain document annotation/comments and the editor's available space. The bounded control regrouping above is approved; heading changes and general role switching remain separate proposals. Role switching should be tested for ownership and preservation before adding more documents or companion handoff.

## Intended interaction model

An illustrative later tab strip:

```text
[ Prompt ▾ ]  [ notes.md • ]  [ script.py ]
```

- **Prompt:** the active prompt text alongside the session's response/Working views. Editor Preview remains available for prompt formatting and annotation.
- **Document:** editable source alongside that document's preview. Text, selections, scroll positions, dirty state, and preview choices survive switching away and back.
- **Prompt picker:** create, park, rename, and switch prompt drafts without discarding the previous one. Keep one active submission destination visible; do not add a separate conversation per draft.
- **Companions:** existing editor-only browser views remain useful and independently recoverable. They can contribute context to the full workspace without becoming additional full Studio views.

Opening, selecting, saving, or closing a document does not change the active prompt. A document becomes prompt material only through an explicit copy/handoff or an explicitly chosen Prompt file load. A detached context copy has no write-back link to its source; an explicitly file-backed Prompt retains its normal Save behaviour.

Run in Prompt view submits the active prompt, retaining annotation send/strip behaviour. Initially, document views offer **Return to prompt** rather than implicitly submitting the document or sending a hidden prompt. Do not couple this architecture to a global Run-shortcut redesign; preserve the existing REPL and Side question composer bindings.

Response history remains session-global. Restore the prompt's response position on return instead of treating a file preview as a new conversation, except when its enabled Follow setting applies a queued response. Follow activity must not switch away from a manually selected document or steal its preview.

## Context transfer

Two explicit actions in the wider design:

- **Add selection to prompt:** the local slice above implements exact editor-selected text with its source label and editor-line range. Preview extraction is not implemented.
- **Add document to Prompt:** the local whole-document follow-up implements full raw-editor snapshots with a visible size/capacity check. This is the append-only action previously called **Copy document to prompt** in the wider design; it never replaces an existing Prompt. Preview extraction and companion handoff remain future work.

Use ordinary editable text rather than a new opaque attachment format. Capture the displayed in-memory text, including unsaved edits, rather than rereading disk. Detached sources need a useful label but must not invent a file path or line range. Source labels describe provenance; they do not imply that the copy remains synchronized or grant new file access.

After the handoff:

- prompt annotations affect only the copy;
- subsequent source edits do not update the staged text;
- nothing is submitted to Pi;
- the existing prompt text remains intact, and the insertion can be undone or removed;
- the source editor and its selection remain available.

For editable companion views, send a bounded transfer request to the same Pi process and explicit destination prompt. The destination owner applies the insertion against current state; do not replace its whole prompt with a stale text snapshot supplied by the companion. Acknowledge only after application, and deduplicate retries by transfer ID. If the full workspace is unavailable, the selected destination changed, or acceptance is uncertain, retain source text and report that state rather than silently retargeting or duplicating the insertion.

Initially, editable documents/companions are the transfer sources. Keep watched-preview sockets read-only; do not broaden their mutation permissions to reuse the new action. Existing copying from watched/PDF previews remains available separately.

## Buffer model and ownership

Introduce `StudioBufferStore` behind the existing editor/preview surfaces before adding the tab UI. The following are design requirements, not fixed serialized field names:

| State | Responsibility |
| --- | --- |
| Stable buffer ID | Identity independent of tab order, file label, or selected view |
| Role | Prompt or document; not inferred solely from whether a path exists |
| Selected buffer ID | Which editor/preview the user is viewing |
| Active prompt ID | Which draft is the explicit submission/context destination |
| Text revision | Monotonic in-memory edit identity for async targeting |
| Text and baseline | Current text, dirty comparison, original source/draft identity |
| Disk identity | Canonical path and expected disk revision for file-backed saves |
| View state | Cursor/selection, source and preview scroll, language, preview mode |
| Local metadata | Annotations/review-note associations and resource context |

Keep existing canonical file checks and workspace-level resource grants. Two snapshots referring to a file must not bypass disk-revision conflict detection. Closing dirty documents or discarding prompt drafts must require a deliberate choice; reopen/recovery must not silently substitute the current contents of disk for unsaved text.

The full workspace owns its active prompt and draft selection. Companion workspaces retain their own documents; adding context is an explicit operation, not continuous shared-text synchronization. Resource grants and the exact-tmux-lifetime Shared REPL Record do not become buffer-owned.

## Browser-tab continuity

Internal tabs complement, rather than replace, browser tabs/windows. Internal tabs will switch Prompt/documents inside a workspace; browser companions and previews remain useful for simultaneous viewing and other screens. Preserve existing browser-opening actions while implementing the new controls.

Separate browser editors initially remain independent snapshots, not live-synchronized mirrors. Keep canonical-path/disk-revision conflict checks. Future labels such as **Open in Studio tab** and **Open in browser tab** should make the distinction explicit. A true pop-out of an editable buffer must preserve its unsaved text; merely reopening its disk file is not equivalent. Linked pop-outs and live synchronization are not required for the first batch.

With switching off, the transitional single-editor adapter deliberately keeps Run using the visible editor, even when file migration creates a selected document plus an empty active Prompt. The separate switching opt-in changes the controls and submission guard together: Return first, then Run the visible Prompt. A hidden Prompt must never become the accidental submission destination.

## Recovery and asynchronous work

### Recovery schema v2

Persist bounded buffer collections, active/selected identities, ordering, and per-buffer state. Define per-buffer and aggregate limits; reject oversize updates visibly rather than truncating or evicting a live dirty buffer to make room.

Migrate schema v1 without changing disk or losing text:

- a detached editor in full Studio becomes the initial prompt draft;
- a file-backed editor becomes a document, retaining dirty text and the disk revision it was based on, with a separate empty Prompt;
- editor-only views retain their document role and cannot become additional full workspaces;
- preserve the recoverable v1 payload until a complete v2 snapshot has been validated and stored successfully.

Those are the low-level migration rules, also retained by foundation-only mode. The switching adapter then preserves fresh/v1 visible-file intent by making that file the Prompt, without changing its text, source or unknown recovered baseline. Older v2 role changes require the explicit choice described above.

Exercise all legacy source kinds in migration tests. Malformed or future schemas must fail conservatively with a recovery path, not silently reset dirty work. Keep recovery scoped to the existing browser-tab/workspace identities and resource authorization.

Current recovery uses browser session storage plus a bounded in-memory server fallback. Schema v2 must not imply new durable storage or guaranteed Pi-restart recovery unless those are separately designed and tested. Prompt parking must clearly state the recovery lifetime it actually provides.

### Async targeting

Capture originating buffer ID, text revision, and request ID when starting a completion, preview, save, annotation replacement, or context transfer. Keep disk revision separate from the in-memory revision. A late result must not write to whichever buffer happens to be selected now, resurrect a closed buffer, or overwrite newer edits.

Main Pi responses remain conversation events. Their arrival may update response history, but not overwrite a source document or select a different buffer without an explicit policy. A buffer-mutating result whose origin changed needs an explicit accept/retry path.

Preserve the `0.9.59` Pi-terminal-draft handoff: cleanup eligibility stays transient and bound to the originating prompt/submission. Copying document text must not copy terminal cleanup authority. Clear Pi's composer only after an accepted Run and an exact unchanged terminal-text match; never on a context transfer, tab switch, or failed submission.

## Draft replacement and annotation

In `0.9.60`, add the separate Annotate shortcut and protect **unsubmitted or unsaved work**, without introducing this buffer model. Do not ask for confirmation merely because the editor contains text:

- **No warning:** write a prompt → accepted Run → receive response → Annotate response, while the submitted prompt is still unchanged. Empty editors or an exact copy of the response likewise need no replacement warning when no unsaved file changes would be lost.
- **Protect before replacing:** post-submission prompt edits, another unsent draft, edited response annotations, and unsaved file changes. Cancel leaves the draft and source/view state unchanged; existing save/copy paths can support keeping it before proceeding.

Capture the raw editor text and source identity at submission time, correlate acceptance with that snapshot, and use it as the comparison baseline. A late acknowledgement or response must not mark the then-current editor text as submitted. Failed submissions do not establish the baseline, and a submitted file buffer can still have unsaved edits. This Studio-editor baseline is separate from the Pi-terminal-draft cleanup fingerprint.

Test the confirmation-free normal loop as well as the guarded cases, failed submissions, and typing during acknowledgement/confirmation. Do not claim automatic draft parking in this release.

In `0.10`, **Annotate response** can prepare a detached prompt draft while parking the unfinished active prompt. Copying a document to a prompt likewise leaves its file buffer independent. Resolve these operations through buffer identities rather than overwriting a global editor string.

Neither operation edits the original response in conversation history or the source document. An asynchronous confirmation is not permission to overwrite text typed after it opened.

## Implementation sequence

1. **Store and recovery:** introduce buffer identities/roles behind the single visible editor; test schema migration, bounds, disk identity, and async targeting before exposing tabs.
2. **Prompt/document switching:** first prove one Prompt ↔ one document with independent state and an explicit submission boundary (the current local prototype). Review file-open intent and Return/Run ergonomics before expanding to creation/closing, more tabs or a narrow-width picker.
3. **Context handoff:** add document/selection snapshots and acknowledged editable-companion-to-prompt transfer, preserving drafts and source text.
4. **Parked prompts and annotation:** expose the lightweight draft picker and non-destructive response-to-prompt annotation flow; add MRU/next/previous/close/reopen navigation.
5. **Release validation:** run the full suite and fresh-package smoke matrix, including migration and browser reconstruction. Use npm `next` for architectural validation before explicit stable-release approval.

Do not require an editor-engine migration, arbitrary pane layout system, or new REPL protocol to complete these steps.

## Acceptance scenarios

1. Start a prompt; edit `notes.md` with preview; append selected context; annotate the detached copy; inspect another file; return and Run. Preserve every draft, document edit, and reading position, and submit only the intended prompt.
2. Compare two prompt formulations by parking/switching drafts. Run one without discarding the other or creating another Pi conversation.
3. Add text from an editable companion while the main prompt is being edited. Apply once to the acknowledged destination; never lose intervening typing or append to a newly selected draft silently.
4. Annotate a response while an unfinished prompt exists. Keep the old draft recoverable and leave the original response unchanged.
5. Switch or close buffers during completion, rendering, saving, and confirmation. No late result writes into the wrong buffer or bypasses a stale disk revision.
6. Refresh/reconstruct full and companion views, including with dirty files and parked prompts. Verify bounded recovery and non-destructive v1 migration under unavailable or malformed storage.
7. Confirm Follow activity respects document navigation; watched previews remain read-only; REPL/Side question workflows and terminal draft cleanup retain their current authority boundaries.

## Out of scope

Replacing Neovim; CodeMirror/Monaco migration; arbitrary multi-pane layouts; project trees; per-buffer conversations or parallel main-agent runs; live attachment synchronization; collaborative document editing; Derived REPL Transcript; changes to protocol v1 or `pi-repl` package independence.

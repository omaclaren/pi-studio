# Active Prompt and editable document buffers

Status: agreed product direction, planned for `0.10.0`; not implemented. Updated 2026-09-07.

[ROADMAP.md](ROADMAP.md) owns release scope. Finish the small `0.9.60` networking/shortcut release before implementing this architecture. This note records the design and acceptance criteria, not a final wire protocol or authorization to release.

## Purpose

Studio is primarily a prompt-writing and response-reading workspace. Editable documents and good previews support that loop; Studio does not need to replace Neovim.

The distinction is not whether documents are editable. It is whether selecting a document changes what Run will submit. It must not do so implicitly.

Use **one clearly active Prompt, other prompt drafts that can be parked, and independently editable documents**. Multiple drafts share the Pi conversation; they are not independent chats.

## Interaction model

An illustrative tab strip:

```text
[ Prompt ▾ ]  [ notes.md • ]  [ script.py ]
```

- **Prompt:** the active prompt text alongside the session's response/Working views. Editor Preview remains available for prompt formatting and annotation.
- **Document:** editable source alongside that document's preview. Text, selections, scroll positions, dirty state, and preview choices survive switching away and back.
- **Prompt picker:** create, park, rename, and switch prompt drafts without discarding the previous one. Keep one active submission destination visible; do not add a separate conversation per draft.
- **Companions:** existing editor-only browser views remain useful and independently recoverable. They can contribute context to the full workspace without becoming additional full Studio views.

Opening, selecting, saving, or closing a document does not change the active prompt. A document becomes prompt material only through an explicit copy/handoff. Saving or annotating the prompt copy must not write to its source document.

Run in Prompt view submits the active prompt, retaining annotation send/strip behaviour. Initially, document views offer **Return to prompt** rather than implicitly submitting the document or sending a hidden prompt. Do not couple this architecture to a global Run-shortcut redesign; preserve the existing REPL and Side question composer bindings.

Response history remains session-global. Restore the prompt's response position on return instead of treating a file preview as a new conversation. Follow activity must not switch away from a manually selected document or steal its preview.

## Context transfer

Two explicit actions:

- **Add selection to prompt:** append the exact selected text with its source label and line/range information where reliable.
- **Copy document to prompt:** append a snapshot of the full visible document text, subject to a visible size limit. Despite the word Copy, this must not replace an existing prompt.

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

## Recovery and asynchronous work

### Recovery schema v2

Persist bounded buffer collections, active/selected identities, ordering, and per-buffer state. Define per-buffer and aggregate limits; reject oversize updates visibly rather than truncating or evicting a live dirty buffer to make room.

Migrate schema v1 without changing disk or losing text:

- a detached editor in full Studio becomes the initial prompt draft;
- a file-backed editor becomes a document, retaining dirty text and the disk revision it was based on, with a separate empty Prompt;
- editor-only views retain their document role and cannot become additional full workspaces;
- preserve the recoverable v1 payload until a complete v2 snapshot has been validated and stored successfully.

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
2. **Prompt/document switching:** add the Prompt entry and editable document tabs with per-buffer previews/state, dirty-close decisions, and narrow-width navigation.
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

# Pi Studio roadmap

This is the current planning source of truth for Studio work. `NEXT-STAGE.md` is historical; `TODO.md` tracks smaller backlog items that are not yet assigned to a release.

## Release approach

Studio development follows two tracks:

- **Stable `0.9.x` releases** contain a bounded, explicitly scoped batch of fixes or incremental features and keep `main` releasable.
- **`0.10.0`** is reserved for the buffer-first document architecture. Risky prereleases should use the npm `next` tag before replacing `latest`.

Changes should be based on capabilities rather than browser, terminal host, or user-agent detection. Muxy, ordinary Chromium browsers, embedded WebKit views, and SSH/headless use are validation environments, not separate product variants.

Each release should finish with:

1. focused regression tests plus the full test suite;
2. TypeScript and JavaScript syntax checks;
3. production dependency audit;
4. exact package-content and byte-level artifact audit;
5. a fresh npm installation and naturally rendered Studio smoke test.

Committing, publishing, pushing, and tagging remain explicit actions rather than automatic consequences of implementation or planning approval.

## Agreed next sequence (2026-09-07)

1. Ship **`0.9.60`** as the bounded networking/shortcut release. Do not start buffer architecture in this batch.
2. After that release, implement **`0.10.0`** around an explicit active Prompt, independently editable documents, context transfer, and parked prompt drafts. The design is in [`BUFFER-DESIGN.md`](https://github.com/omaclaren/pi-studio/blob/main/BUFFER-DESIGN.md).
3. Keep Derived REPL Transcript, editor-engine migration, and arbitrary pane arrangements outside both batches.

Current status:

- `0.9.60` combines the networking fix with Follow activity, Annotate response, and view-preserving Load response shortcuts, plus accurate draft-replacement protection. The published networking RC remains unchanged.
- The reporter has not replied to the RC invitation on [issue #4](https://github.com/omaclaren/pi-studio/issues/4) as of 2026-09-07. Exact `sbx` validation remains outstanding; the release proceeds with that limitation documented and the issue open for confirmation or a follow-up fix.
- After releasing `0.9.60`, Oliver approved starting the `0.10.0` store/recovery foundation with the current UI unchanged. Stage 1a is implemented and tested. Stage 1b now has an isolated, development-flagged single-editor binding, acknowledged v2 server fallback, explicit recovery inspection/export/choice/retry, and locally completed callback/metadata ownership coverage. The isolated host matrix passes in Brave and Google Chrome, with the earlier targeted foundation matrix also passing Safari 26.5. Seven independent Codex safety findings and two later in-session Astra findings have been reproduced, fixed, and regression-tested. The latest fixes protect empty dirty-file comments-prompt replacement and prevent unread saved comments/scratchpads from being overwritten. All 432 tests and the expanded isolated Brave/Chrome checks pass. The current targeted Safari 26.5 smoke also passes after Allow Remote Automation was re-enabled. Oliver approved a local checkpoint commit on `feature/buffer-recovery-foundation` on 2026-09-09. Recovery remains opt-in; default activation, source switching and release still require separate explicit approval.

- On 2026-09-09, after the local foundation/header checkpoints and visual guide, Oliver approved a small **Prompt ↔ one document** prototype. It is now implemented locally under a second `PI_STUDIO_BUFFER_SWITCHING=1` flag, requiring recovery and a full editable workspace. All **472 tests**, static checks, and isolated Brave/Chrome switching and foundation-only workflows pass. After the first hands-on trial, a fresh read-only review identified held-Enter submission and queued-Follow defects; both were reproduced and fixed with unit/native regressions. This increment is a local, unreleased checkpoint; installed Studio and defaults remain untouched. General tabs, context transfer and parked drafts are still future work.
- On 2026-09-10, following the successful isolated hands-on/live-model trial, Oliver approved allowing existing-buffer selection during an identified direct Run. This follow-up is implemented as a local, unreleased checkpoint. It keeps local save/open/recovery locks, submitted-Prompt identity and global Stop; queues completion for Prompt, preserves Document's live preview and rejects stale failure settlement. A fresh read-only review found a queued response surviving an empty tree change and hidden activity ownership surviving a disabled policy. Both were reproduced, then fixed with separate approval and failing regressions first. All **500 tests** and isolated Brave/Chrome Run-switching/regression checks pass. These last two fixes use controlled browser events; the earlier live-provider check predates them. Further checkpoint/release/installation changes remain separate decisions.

## 0.9.52 — Rendering and media consistency (shipped 2026-08-28)

A focused portability and affordance pass:

- scope application-header typography so it cannot override rendered Markdown;
- define an explicit, visibly ordered H1–H6 scale;
- apply image focus consistently across Studio-owned same-document Markdown surfaces;
- give embedded PDF cards and rendered PDF figures an obvious enlarge action;
- expose true browser fullscreen only when the Fullscreen API is available, while retaining Studio's in-page focus viewer everywhere;
- make local PDF actions clearly refer to the computer running Pi and provide **Copy path** alongside system-viewer and file-manager actions.

This release must not add Muxy-specific branches or attempt to instrument opaque Quarto/authored-HTML iframe contents.

## 0.9.53 — Resource locations (shipped 2026-08-31)

The bounded canonical workspace registry governs explicit local links, the Files view, passive images/PDFs, and Side questions' related-file roots.

Replace the single-root assumption with explicit resource grants:

- grant the current document directory automatically;
- allow an exact file or additional folder to be granted explicitly;
- keep grants session-scoped by default;
- store canonical server-side paths and retain traversal and symlink-escape checks;
- use the same grants for Markdown resources, local links, PDFs, Files view, and Side questions;
- keep passive local media unloaded without opening a permission decision, then offer the exact-file/folder choice only through an explicit blocked-media action;
- explain that paths, Finder/file-manager actions, and system viewers belong to the computer running Pi;
- offer **Allow this file**, **Allow this folder for this Studio session**, and **Cancel** when an explicit local link crosses the current boundary.

The resource-location registry should be workspace-level rather than tied to the current editor document so it remains compatible with multiple buffers. Remembering grants per project can follow after the session-only model is proven.

## 0.9.54 — Disk-backed preview and safe save (shipped 2026-09-02)

Builds on the resource-location foundation:

- distinguish editable buffers, whose in-memory text drives Editor Preview, from read-only watched previews, whose file on disk is authoritative;
- add a read-only **Preview file (follow changes)** workflow using the proven debounce, content-hash, atomic-save, preserved-scroll, and last-good-render behaviour from `pandoc-glance` / `pi-markdown-preview` without making Studio depend on another extension;
- retain a canonical disk revision for file-backed editing, save directly with **Cmd/Ctrl+S** only while that revision still matches, and offer an explicit conflict decision when the file changed externally;
- add **Cmd/Ctrl+Shift+S** for Save As and keep autosave opt-in rather than default;
- carry the resulting disk identity and revision model forward into `StudioBufferStore`.

## 0.9.55 — Watched-preview and control polish (shipped 2026-09-02)

A browser-neutral UX pass before buffer-first work:

- focus followed previews on their rendered pane and label the exposed source as read-only and disk-following;
- normalize Studio buttons and dropdown controls across Chromium and WebKit without changing native select interaction;
- expose X-high and Max side-question thinking only when supported by the active model, while retaining Low as the default.

## 0.9.56 — Shared REPL record (shipped 2026-09-02)

A coordinated interoperability release with `pi-repl` 0.4.0:

- make the clean structured record belong to the exact tmux session lifetime rather than one browser or extension;
- discover an opaque versioned record ID through first-writer-wins tmux metadata while keeping bounded content in private user-scoped sidecar storage;
- synchronize compatible submissions, literate notes, lifecycle status, captured output, clear operations, and bounded legacy Studio migration in both directions;
- hold one cross-client send lease from pre-send capture through completion capture—including after caller timeout or abort—so compatible clients cannot claim each other's output;
- preserve raw pane/history output as the honest source for direct attached-pane activity rather than inferring unreliable semantic boundaries;
- keep Studio and `pi-repl` independently installable and usable, with graceful fallback for unavailable, malformed, stale, or unsupported shared records;
- produce one canonical Markdown representation across Studio and `pi-repl`.

This release does not change Studio's single-buffer architecture or move buffer-first work forward from `0.10.0`.

## 0.9.57 — REPL submission display and alignment anchors (shipped 2026-09-03)

A coordinated presentation and future-alignment increment with `pi-repl` 0.4.1:

- keep optional pane echo Off by default, with an adaptive Summary that shows short submissions in full and a separately bounded Full choice;
- derive collision-resistant human-readable anchors from immutable clean-record entry IDs without exposing those IDs in the pane;
- retain compact begin/completion anchors and a plain unanchored output divider in raw tmux history while stripping the exact header, source preview, divider, and footer from captured output and protocol-v1 records;
- sanitize terminal controls, cap all visible source previews, and warn that Full mode persists bounded source code in raw history;
- cover Shell, Python/IPython, Julia, R, GHCi, and Clojure consistently across browser and tool sends, including error, timeout, abort, and exact-session-disappearance paths;
- replace verbose or fixed loader paths in both clients with compact request-unique files in a private per-user control root, retaining files through timed-out/aborted execution and cleaning them when the submission settles;
- treat markers only as presentation and alignment evidence, never as authority for silently promoting inferred direct activity into the clean record.

A separate Derived REPL Transcript can use these anchors later, but it remains outside protocol v1 and outside this release.

## 0.9.58 — Workspace and REPL interaction refinements (shipped 2026-09-03)

A small interaction increment before the buffer-first architecture:

- add a scoped right-pane Quick send composer that keeps exact-session drafts in memory and uses the existing safe Shared REPL Record send path;
- add persisted side-by-side and vertical pane arrangements, including either Editor or Response above;
- add opt-in activity following from Working during main-agent generation to Response Preview on completion, disabled by default and cancelled when the user manually changes views;
- keep Quick send separate from the durable editor, the raw tmux mirror read-only, and protocol-v1 authority unchanged.

## 0.9.59 — Safe Pi input-draft handoff (shipped 2026-09-03)

A small workflow refinement for moving Neovim-provided context through Pi and Studio:

- load or stage Pi's terminal input draft without clearing it, retaining only a transient SHA-256 fingerprint and byte length for provenance;
- keep that link through unrestricted Studio edits, then clear the original Pi draft only after Pi accepts the Studio run and the current terminal text still matches exactly;
- silently preserve later terminal typing, added `pi-nvim-context` context, or another client's changes, and never clear after a rejected submission;
- provide `Cmd/Ctrl+Shift+L` for loading and a confirmed **Clear Pi editor text…** fallback without changing Studio text or conversation history;
- keep `pi-nvim-context`, protocol v1, networking, and the buffer-first architecture unchanged.

## 0.9.60 — Networking and prompt-workflow shortcuts (2026-09-07)

This release combines the networking portion shipped as `0.9.60-rc.0` on 2026-09-03 with the small shortcut batch below. The published RC remains a reproducible networking test target.

### Networking

A bounded implementation of GitHub issue #4:

- retain `127.0.0.1` as the default and require explicit `--listen-all` intent before binding to `0.0.0.0`;
- keep the server-lifetime bearer token mandatory and the generated URL on loopback for same-port container publishing;
- keep inbound `Host` values out of route parsing and require wildcard-mode browser origins to match the request authority;
- report the actual listening address, emit a prominent exposure warning, and require `/studio --stop` before changing a running server's binding;
- document loopback-only host publishing, private-network limits, and SSH forwarding as the safer option on untrusted networks;
- validate both default loopback and opt-in wildcard sockets without changing the buffer model, protocol v1, or `pi-repl`.

### Shortcut and draft-replacement batch

The shortcuts and replacement safeguards below are implemented, with focused regression tests and browser workflow checks using controlled model replies. The buffer architecture remains deferred.

- Include `Cmd/Ctrl+Option/Alt+A` **Follow activity** toggle: retain opt-in persistence, full-workspace scope, modal protections, and key-repeat suppression.
- Add `Cmd/Ctrl+Option/Alt+Enter` for **Annotate response** from either main pane when the existing action is available. Invoke the same action as the button and retain its busy, response-type, and mode guards. Add Shift (`Cmd/Ctrl+Option/Alt+Shift+Enter`) to invoke **Load response into editor** without switching views, with the same replacement safeguards. Do not reinterpret `Cmd/Ctrl+Enter` as the right pane's primary action.
- Keep Run's existing active-pane behaviour and REPL/Side question submission shortcuts unchanged in this release.
- Protect **unsubmitted or unsaved work**, not every non-empty editor. The normal write prompt → accepted Run → response → Annotate response loop must remain confirmation-free when the submitted prompt is still unchanged. Ask before replacing post-submission edits, a new unsent draft, edited response annotations, or unsaved file changes; Cancel preserves text, source identity, and view state. Keep the decision/save-or-copy workflow bounded rather than adding a hidden second editor or a new recovery schema to `0.9.60`.
- Correlate an editor-text/source snapshot with the accepted submission and compare the current editor against that baseline; do not mark later typing as submitted when an acknowledgement or response arrives. Failed submissions do not establish the baseline, and submitting file text does not mark it saved.
- Capture the intended response and revalidate the editor after an asynchronous replacement decision; later typing or a changed target must not be overwritten by stale consent.
- Test both modifier variants, option-modified key values, key repeat, modal ownership, unavailable actions, and unchanged Run/REPL/Side question behaviour. Update the shortcut overlay, tooltips, accessibility metadata, and changelog only as behaviour is implemented.

### Release gate

Run the normal full validation and fresh-package browser smoke over the combined batch, including a confirmation-free submitted-prompt → Annotate response loop and protected replacement/cancellation for genuinely new work. The previous RC verification does not substitute for checking the final artifact.

The networking review and production lifecycle tests support the reported fix; a separate TCP-forward smoke also verified HTML, client JavaScript, and WebSocket state delivery through a non-loopback destination. Neither is an exact `sbx` test. On 2026-09-07, Oliver approved shipping after final validation with this limitation documented and issue #4 left open. Reporter feedback can confirm the fix or lead to a follow-up patch. Any updated prerelease must use a new version, never replace `rc.0`.

Do not include buffer tabs, context-transfer messages, recovery schema v2, or REPL transcript work in this release.

## 0.10.0 — Active Prompt and editable document buffers (local switching prototype)

The local foundation includes the browser-safe store/codec/migration modules plus a `PI_STUDIO_BUFFER_RECOVERY=1` single-editor/server integration, enabled only by the isolated development launcher. With switching off, the default v1 recovery path, successful editor layout, Run's visible-text destination, and browser-opening actions remain unchanged. Native isolated production tests cover reload, file baselines, metadata persistence/ordering, local-resource grants, PDF focus replacement, comments-prompt consent, late save/refresh, reconnect ownership, independent editors/disk conflicts, watched-to-editable browser tabs, reset retention and startup typing. The opt-in **Source & context → Recover unsaved text…** action inspects/exports retained copies, prepares verified fresh namespaces for explicit recovery/reset, and retries current-text persistence without adopting another branch. Focused ownership regressions now cover completion/import/Pi-editor loads, committed preview DOM and focus actions, Quarto request sources, metadata associations, failed writes, unload beacons and initialization/reset races. Metadata POSTs retain only one in-flight and one latest snapshot per key, time out conservatively, preserve intervening autosave timers, and advance same-writer server ordering only after the persistent-state write succeeds. The opt-in comments-prompt action also protects empty or unknown-baseline file edits and rechecks the captured disk baseline/revision after confirmation. Comments and scratchpad editing/persistence wait for the first successful per-document read; failed, malformed or timed-out reads stay protected and reopening the panel retries. Previously loaded page-local notes remain editable during refresh. Additional native regressions cover corrupt/unscoped copies, stale consent, full exports, server-only recovery, reconnect, failed refresh, pending/failed metadata reads and preserved saved notes. See [the foundation contract](shared/STUDIO_BUFFER_FOUNDATION.md) for contracts and the separate switching opt-in. This remains unreleased, not default activation or the complete `0.10.0` architecture.

The current second-flag prototype has two fixed entries, **Prompt** and **Document**, not a general tab manager. A fresh/v1 file-backed editor remains the Prompt; older v2 roles require an explicit choice. Opening a separate document preserves the Prompt; Files also offers explicit **Use as Prompt…**. Document view returns to Prompt without sending, including under held Enter; a distinct activation sends its visible text. Both buffers retain independent text, baselines, metadata and reading positions through switching/reload. A Follow-on Prompt catches up with a queued response on return without reusing the old response's scroll offset; paused reading remains preserved. An identified connected direct Run permits selecting kept buffers, without relaxing local save/open/recovery or unresolved Pi-draft locks. Stop remains global; Return through the Prompt tab or Run shortcut does not submit or cancel. Completed responses wait for Prompt's Follow setting, and history notifications do not reconstruct Document's live preview. Local mutating operations still gate switching; stale file reads and background responses cannot replace another buffer or steal its view. Recovery retains the pair, and Reset confirms both. Context copying, parked drafts and close/add navigation are not implemented. Review this interaction before expanding the UI; see [the current prototype scope](BUFFER-DESIGN.md#current-prototype--before-general-tabs).

Studio's primary loop is prompt construction and response reading. Documents remain useful editable sources, not implicit submission targets or a replacement for Neovim. The design is **one clearly active Prompt, other prompt drafts that can be parked, and independently editable documents**.

The first architectural release should add:

- a `StudioBufferStore` with stable buffer identity, explicit prompt/document roles, and separate selected-buffer and active-prompt identities;
- a prominent **Prompt** view with response/Working alongside it, plus editable document tabs with their own previews;
- recovery schema v2 with non-destructive migration from the single-document schema;
- buffer-specific text/baseline, dirty state, cursor, selection, scroll, preview context, annotations, and resource directory, preserving existing disk-revision checks;
- **Add selection to prompt** and **Copy document to prompt**, including an acknowledged handoff from editable companion views to the full workspace's explicit prompt destination;
- editable context snapshots of the visible text, including unsaved edits and source labels/ranges where known; no automatic submission, replacement, file write, or later live update of the copied text;
- a lightweight parked-prompt picker, with one active submission draft at a time and no per-draft conversation forks;
- tabs at ordinary widths, a compact searchable picker at narrow widths, and MRU/next/previous/close/reopen navigation;
- originating buffer ID, revision, and request ID targeting for asynchronous work, so switching tabs cannot redirect results or destructive actions.

Opening a document never changes the active prompt. Initially, document views should offer a clear return to Prompt rather than implicitly submit the document or send a hidden prompt. Keep Run's precise shortcut behaviour separate from the buffer model; settle it in the interaction tests before shipping.

**Acceptance workflow:** start a prompt → inspect and edit a document with preview → add context to the prompt → annotate that detached copy → inspect another document → return and submit, without losing edits, changing the original through prompt annotations, or changing the submission destination accidentally.

PDFs remain preview documents; watched previews remain disk-authoritative and read-only. Conversation history, resource grants, and the exact-session Shared REPL Record remain outside individual buffers. Arbitrary multi-pane layouts, project trees, simultaneous per-buffer Pi conversations, editor-engine migration, and Derived REPL Transcript are outside the initial scope. See [`BUFFER-DESIGN.md`](https://github.com/omaclaren/pi-studio/blob/main/BUFFER-DESIGN.md) for the state, recovery, handoff, and implementation sequence.

## Validation matrix

Cross-environment checks should cover, where relevant:

- full and editor-only Studio;
- file-backed and detached documents;
- ordinary Chromium and embedded WebKit browser surfaces;
- local, SSH, and `--no-browser` Pi sessions;
- paths with spaces, Unicode, traversal attempts, and symlinks;
- supported and unavailable browser APIs;
- browser reconstruction, refresh recovery, and clean shutdown;
- for shared REPL work: bidirectional visibility, compatible-client send contention, output attribution, restart persistence, clear/import behavior, stale or malformed records, and direct attached-pane activity;
- for REPL submission displays: Summary/Off/Full bounds, raw-versus-clean separation, stable cross-client anchors, compact private collision-resistant control files and cleanup, every supported runtime, runtime errors, timeout/abort lease retention, and exact-session disappearance.

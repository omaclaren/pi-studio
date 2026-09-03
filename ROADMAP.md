# Pi Studio roadmap

This is the current planning source of truth for Studio work. `NEXT-STAGE.md` is historical; `TODO.md` tracks smaller backlog items that are not yet assigned to a release.

## Release approach

Studio development follows two tracks:

- **Stable `0.9.x` releases** contain one coherent family of fixes or incremental features and keep `main` releasable.
- **`0.10.0`** is reserved for the buffer-first document architecture. Risky prereleases should use the npm `next` tag before replacing `latest`.

Changes should be based on capabilities rather than browser, terminal host, or user-agent detection. Muxy, ordinary Chromium browsers, embedded WebKit views, and SSH/headless use are validation environments, not separate product variants.

Each release should finish with:

1. focused regression tests plus the full test suite;
2. TypeScript and JavaScript syntax checks;
3. production dependency audit;
4. exact package-content and byte-level artifact audit;
5. a fresh npm installation and naturally rendered Studio smoke test.

Publishing, pushing, and tagging remain explicit release actions rather than automatic consequences of merging work.

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

## 0.10.0 — Buffer-first editing

The first architectural `0.10` release should add:

- a `StudioBufferStore` with stable document identity;
- recovery schema v2 with migration from the single-document schema;
- buffer-specific text/baseline, dirty state, cursor, selection, scroll, preview context, annotations, and resource directory;
- tabs at ordinary widths and a compact searchable buffer picker at narrow widths;
- MRU cycling, next/previous, close, and reopen commands;
- originating buffer ID and revision targeting for asynchronous Pi work.

PDFs remain preview documents, and conversation history remains session-global. Split panes, arbitrary layouts, project trees, and simultaneous per-buffer Pi conversations are outside the initial `0.10.0` scope.

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

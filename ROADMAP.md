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

## 0.9.52 — Rendering and media consistency

A focused portability and affordance pass:

- scope application-header typography so it cannot override rendered Markdown;
- define an explicit, visibly ordered H1–H6 scale;
- apply image focus consistently across Studio-owned same-document Markdown surfaces;
- give embedded PDF cards and rendered PDF figures an obvious enlarge action;
- expose true browser fullscreen only when the Fullscreen API is available, while retaining Studio's in-page focus viewer everywhere;
- make local PDF actions clearly refer to the computer running Pi and provide **Copy path** alongside system-viewer and file-manager actions.

This release must not add Muxy-specific branches or attempt to instrument opaque Quarto/authored-HTML iframe contents.

## 0.9.53 — Resource locations

Replace the single-root assumption with explicit resource grants:

- grant the current document directory automatically;
- allow an exact file or additional folder to be granted explicitly;
- keep grants session-scoped by default;
- store canonical server-side paths and retain traversal and symlink-escape checks;
- use the same grants for Markdown resources, local links, PDFs, Files view, and Side questions;
- explain that paths, Finder/file-manager actions, and system viewers belong to the computer running Pi;
- offer **Allow this file**, **Allow this folder for this Studio session**, and **Cancel** when an explicit local link crosses the current boundary.

The resource-location registry should be workspace-level rather than tied to the current editor document so it remains compatible with multiple buffers. Remembering grants per project can follow after the session-only model is proven.

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
- browser reconstruction, refresh recovery, and clean shutdown.

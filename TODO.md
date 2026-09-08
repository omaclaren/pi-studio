# TODO

See [ROADMAP.md](ROADMAP.md) for the active release plan: `0.9.60` is shipped; the `0.10.0` buffer foundation is now in progress. [BUFFER-DESIGN.md](BUFFER-DESIGN.md) records the active-Prompt/editable-document design. This file retains smaller or unassigned backlog items.

## Assigned next work

- [x] Implement and test `Cmd/Ctrl+Option/Alt+A` for Follow activity in `0.9.60`.
- [x] Implement and test `Cmd/Ctrl+Option/Alt+Enter` for Annotate response in `0.9.60`. Keep unchanged accepted prompts confirmation-free; protect unsubmitted edits and unsaved file changes, including late-acknowledgement and stale-confirmation races. Retain Run's existing shortcut meaning/scope.
- [x] Add the Shift variant (`Cmd/Ctrl+Option/Alt+Shift+Enter`) for **Load response into editor** without switching views, through the existing guarded action.
- [x] Validate and prepare the combined `0.9.60` artifact, including the published issue #4 networking fix: 284 tests, type/syntax checks, production audits, byte audit, and fresh-install browser/networking checks pass. Release approved on 2026-09-07; exact `sbx` feedback remains outstanding and the issue stays open.
- [ ] Implement the `0.10.0` design in store/recovery → document switching → context handoff → parked-prompt order. Keep the visible UI unchanged for the foundation; no commit/release without approval.
  - [x] Stage 1a: pure buffer identities/roles/store, strict v2 codec, non-destructive v1 migration/sessionStorage adapter, bounded updates and async ownership, with unit/native-browser reconstruction tests. See `shared/STUDIO_BUFFER_FOUNDATION.md`.
  - [x] Stage 1b: complete the single-editor callback/metadata ownership pass, current isolated Brave/Chrome matrix and targeted Safari 26.5 smoke. The Safari rerun passed after Allow Remote Automation was re-enabled. Recovery remains opt-in; activation still requires explicit approval.
    - [x] Explicit recovery inspection, full raw/text exports, compatible-copy choice, keep-current/reset in verified fresh namespaces, and guarded persistence retry. Corrupt/future/other-source/hidden collections remain export-only; originals are retained.
    - [x] Manual unsaved-edit browser reload check passed. Per Oliver’s feedback, move recovery to Source & context → Recover unsaved text… (no footer button) and shorten the panel, with technical detail folded away.
    - [x] Development-only single-editor store binding, persistent recovery warnings, guarded namespace-reset, and separate authenticated/acknowledged v2 server fallback.
    - [x] Source-owned saves, late-refresh/confirmation guards, TTL-aware navigation consent, retained v1/Save As reconciliation, and isolated production browser regressions.
    - [x] Finish completion/preview/import/terminal-load ownership and metadata association integration, including focus viewers, Quarto callbacks, failed-write/beacon ordering and recovery/reset lifecycle races. Keep current Run and separate terminal-cleanup authority; no internal tabs yet.
    - [x] Resolve the independent Codex safety review: metadata now protects unload, commits ordering only after disk persistence, bounds/coalesces stalled writes without cancelling newer timers, preserves grant continuations, and rebuilds editor-preview ownership after reconnect. Focused regressions and the Brave/Chrome native matrix pass.
    - [x] Resolve the two later Astra findings: require current replacement consent for empty dirty files; block comments/scratchpad mutations and writes until a successful first read, with protected failure and reopen-to-retry. Focused regressions, all 432 tests, static checks and the full Brave/Chrome matrix plus new preservation probes pass.
  - [ ] Only after that gate: Prompt/document switching, context handoff and parked drafts.

Do not pull unrelated backlog items below into the quick release merely to fill the batch.

## Near term
- [ ] Separate annotation-header compatibility batch (requested via `pi-nvim-context`; deferred from the validated buffer-recovery batch): recognise whole leading `annotations below` and `annotations below:` opener lines, case-insensitively, while retaining `annotated reply: below` and `annotated reply below:`. Do not rename Studio's generated default yet; Neovim's emitted wording remains unchanged until compatibility is available.
  - Apply the same recognition to detection/UI summaries, header toggle/duplicate prevention and header stripping (`stripAnnotationHeader`, `stripAnnotationBoundaryMarker`, `updateAnnotatedReplyHeaderButton`, `toggleAnnotatedReplyHeader`, `getStudioUiRefreshAnnotationHeaderEnabled` in `client/studio-client.js`); audit related annotation-stripping paths too.
  - Require a real leading header block with its syntax-hint structure and divider, not a prefix match followed by an arbitrary later divider. Preserve body text; reject prose mentions, quoted/fenced examples, missing-divider and malformed blocks.
  - Keep recognising the minimal Neovim shape below without requiring source/precedence lines or a footer. Its backticked `[an: note]` is a literal hint, not an annotation. Add aliases, backwards compatibility, case/LF/CRLF, toggle/deduplication, stripping/body-preservation and false-positive regressions before changing emitted wording.
    ```text
    annotated reply: below

    - user annotation syntax: `[an: note]` (user comments on the accompanying selections)

    ---

    ```
- [x] Add a simple **Text | Rendered** toggle for the editor/source panel (`View: Markdown | Preview`).
- [x] Add explicit in-UI WS diagnostics (footer WS phase: Connecting/Ready/Submitting/Disconnected).
- [x] Add keyboard shortcut(s) to make the active pane full-screen / distraction-free (or similar to Zed `Cmd+Esc`).
- [x] Add a Studio **Send + Run** action (submit directly to model from Studio, not only send to pi editor).
- [x] Add explicit `[an: ...]` annotation syntax support with send-mode toggle (send vs strip) and `.annotated.md` helper save action.
- [x] Add startup npm update notification when installed extension version is behind npm latest.
- [ ] Add a "copy Studio URL" action and avoid line-wrap confusion in terminal notifications.
- [ ] Tighten structured-critique detection and document exact accepted format.
- [ ] Improve fallback behavior when response sections are partial/malformed.

## Next-session candidates
- [x] Add a file-based headless Studio PDF export command (e.g. `/studio-pdf <path>`) as a v1 for Markdown/LaTeX files, reusing the existing Studio PDF backend without requiring the Studio UI.
- [x] Add a lightweight **local comments / review-notes layer** for Studio as an anchored, non-document review aid.
  - Implemented v1 as **single-user, local-only, non-collaborative** review notes: no sharing, permissions, threads/replies, or remote sync/service.
  - Notes stay **out of the editor text** by default and behave as local review metadata rather than inline document content.
  - Current v1 supports creating a note from the current **selection / line**, plus **browse / jump / delete / convert to annotation** in a dedicated Review notes panel.
  - The raw editor now also shows subtle gutter markers for anchored review-note lines so commented regions are easier to spot and reopen from the editor surface.
  - Review notes can also be opened in a docked side-by-side rail next to the current document, giving comments a more distinct feel from inline annotations while preserving the same local document/draft identity model.
  - Persistence is now extension-side/local so notes survive refreshes and Pi restarts more reliably than browser-port-scoped storage.
  - Follow-up if desired: add richer preview-side affordances and/or stronger anchoring once the core workflow has proved useful.
- [ ] Audit `pi-markdown-preview` for preview-side LaTeX fixes worth porting from Studio (aux-based refs, bibliography heading/spacing, subfigure regrouping, algorithm preview), without blindly copying Studio-specific PDF workarounds.
- [ ] Evaluate whether `pi-markdown-preview` should separately improve its native LaTeX PDF path (e.g. `latexmk`/bibliography/project handling) instead of replacing it outright with the Studio exporter.
- [ ] Run a CodeMirror 6 vs Monaco spike and document migration tradeoffs (performance, bundle/build changes, theme/keybinding integration).

## Quality
- [ ] Add small, focused tests for:
  - [ ] assistant message extraction
  - [ ] section extraction/parsing
  - [ ] request ID and message routing behavior
- [ ] Add a manual QA checklist for `/studio --last/--blank/<file>` and save/editor actions.
- [ ] Add lightweight logging toggles for local debugging.

## Packaging
- [ ] Add release workflow (version bump, changelog update, tag, publish checklist).

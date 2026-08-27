# TODO

See `ROADMAP.md` for the active `0.9.52`, `0.9.53`, and `0.10.0` release plan. This file retains smaller or unassigned backlog items.

## Near term
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

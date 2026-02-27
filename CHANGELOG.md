# Changelog

All notable changes to `pi-studio` are documented here.

## [Unreleased]

### Added
- Minimal **Annotate | Critique** tab workflow with explicit handoff actions.
- Independent Markdown/Preview toggles for Editor and right pane.
- `Follow latest: On|Off` + `Pull latest` controls for terminal/editor-composability.
- Critique → Editor load actions:
  - **Load critique package → Editor**
  - **Load clean document → Editor**
- Annotate/reference actions:
  - **Load Reference → Editor**
  - **Load edited document** (`## Document` section)
  - **Copy reference**
- Source action: **Send + Run** to submit current editor text directly to the model.
- Right-pane reference badge with source + timestamp (when available).
- Editor/reference sync badge (`In sync with reference` / `Edited since reference`) and guard on redundant reload.
- Active-pane focus mode with keyboard shortcuts (`Cmd/Ctrl+Esc` or `F10` to toggle, `Esc` to exit), plus in-UI footer hint.

### Changed
- Simplified UI: removed in-critique response textbox and duplicate annotated-document panel.
- Clarified pane semantics and labels (`Editor`, `Reference`, `Critique`, `Editor origin: ...`).
- Auto-detect startup tab from loaded content structure (`## Critiques` + `## Document` → Critique).
- Footer now shows explicit WS phase (`Connecting`, `Ready`, `Submitting`, `Disconnected`) alongside status text.
- Annotate submission sends annotated-reply scaffold with source context.
- Studio now live-updates latest response when assistant output arrives outside studio requests (e.g., manual send from pi editor).
- Removed redundant "Use reference in Critique" action; critique target is always the current Editor text.

## [0.1.0-alpha.1] - 2026-02-26

Initial alpha baseline.

### Added
- `/studio` browser workflow with local HTTP + WebSocket server.
- Startup modes: `/studio`, `/studio --last`, `/studio --blank`, `/studio <path>`.
- Browser actions: **Apply Document**, **Save As**, **Save Over**, **Send to pi editor**, **Copy**.
- Studio server controls: `/studio --status`, `/studio --stop`, `/studio --help`.
- Source-state handling (blank / file / last response) and badge updates.

### Changed
- More robust loading of last assistant response from session state.
- Initial document is server-rendered into the page for resilient preload behavior.
- Last response auto-render now only applies when response appears structured for critique UI.
- Improved status messaging for connection/format states.

### Fixed
- WebSocket reject-path HTTP line endings now use proper CRLF (`\r\n`).
- Browser-side script escaping/runtime issues that could leave UI stuck at boot/connecting.
- Section parsing logic hardened to avoid fragile regex escaping behavior.

[0.1.0-alpha.1]: https://github.com/omaclaren/pi-studio/releases/tag/v0.1.0-alpha.1

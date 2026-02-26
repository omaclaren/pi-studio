# Changelog

All notable changes to `pi-studio` are documented here.

## [Unreleased]

### Added
- Minimal **Annotate | Critique** tab workflow with explicit handoff actions.
- Shared `View: Markdown | Preview` toggle for draft/result inspection.
- `Follow latest: On|Off` + `Pull latest` controls for terminal/editor-composability.
- Critique → Annotate handoff actions:
  - **Send critique package to Annotate**
  - **Send clean document to Annotate**
- Annotate result actions:
  - **Load response**
  - **Load edited document** (`## Document` section)
  - **Send response to Critique**

### Changed
- Simplified UI: removed in-critique response textbox and duplicate annotated-document panel.
- Clarified tab-oriented labels (`Annotated Copy`, `Draft`, `To Critique`, `Critique`, `Original: ...`).
- Auto-detect startup tab from loaded content structure (`## Critiques` + `## Document` → Critique).
- Footer now shows explicit WS phase (`Connecting`, `Ready`, `Submitting`, `Disconnected`) alongside status text.
- Annotate submission sends annotated-reply scaffold with source context.
- Studio now live-updates latest response when assistant output arrives outside studio requests (e.g., manual send from pi editor).

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

# Changelog

All notable changes to `pi-studio` are documented here.

## [Unreleased]

### Added
- Single-workspace flow (no mode switching): always-on **Editor** pane + **Response** pane.
- Explicit annotation scaffold action: **Insert annotation header** (upserts header and source metadata in-editor).
- Clear top-level critique controls: **Critique editor text** + **Critique focus**.
- Unified response actions:
  - **Load response into editor** (for non-critique responses)
  - **Load critique (notes)**
  - **Load critique (full)**
  - **Copy response**
- Independent Markdown/Preview toggles for Editor and right pane.
- `Auto-update response: On|Off` + `Get latest response` controls for terminal/editor-composability.
- Source action: **Run editor text** to submit current editor text directly to the model.
- Active-pane focus mode with keyboard shortcuts (`Cmd/Ctrl+Esc` or `F10` to toggle, `Esc` to exit), plus in-UI footer hint.
- Theme-aware Studio browser palette derived from active pi theme tokens (bg/text/border/accent + status colors).
- MathJax rendering in Studio preview panes for `$...$` and `$$...$$` LaTeX math.
- Delimiter normalization in markdown previews for `\(...\)` and `\[...\]` math syntax.
- Path-based **Load file in editor** action (path prompt resolved relative to current pi session directory).

### Changed
- Removed Annotate/Critique tabs and related mode state.
- Right pane now always shows the latest assistant output (reply or critique).
- Response badge now reports response type + timestamp (`assistant response` / `assistant critique`).
- Editor sync badge now tracks relation to latest response (`No response loaded`, `In sync with response`, `Edited since response`).
- Footer continues to show explicit WS phase (`Connecting`, `Ready`, `Submitting`, `Disconnected`) alongside status text.
- Running text and preparing annotated scaffolds are now separate explicit actions (no hidden header wrapping on send).
- Critique-specific load actions now focus on notes/full views and are only shown for structured critique responses.
- Studio still live-updates latest response when assistant output arrives outside studio requests (e.g., manual send from pi editor).

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

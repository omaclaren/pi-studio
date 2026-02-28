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
- Server-side `pandoc` preview rendering endpoint for Studio panes (`gfm+tex_math_dollars` → HTML5 + MathML).
- Math delimiter normalization before preview rendering for `\(...\)` and `\[...\]` syntax (fence-aware).
- **Load file in editor** action in top controls (browser file picker into editor).
- README screenshot gallery for dark/light workspace and critique/annotation views.
- Response-side markdown highlighting toggle (`Highlight markdown: Off|On`) in `Response: Markdown` view, with local preference persistence.
- Obsidian wiki-image syntax normalization (`![[path]]`, `![[path|alt]]`) before pandoc preview rendering.

### Changed
- Removed Annotate/Critique tabs and related mode state.
- Right pane now always shows the latest assistant output (reply or critique).
- Response badge now reports response type + timestamp (`assistant response` / `assistant critique`).
- Editor sync badge now tracks relation to latest response (`No response loaded`, `In sync with response`, `Edited since response`).
- Footer continues to show explicit WS phase (`Connecting`, `Ready`, `Submitting`, `Disconnected`) alongside status text.
- Running text and preparing annotated scaffolds are now separate explicit actions (no hidden header wrapping on send).
- Critique-specific load actions now focus on notes/full views and are only shown for structured critique responses.
- Studio still live-updates latest response when assistant output arrives outside studio requests (e.g., manual send from pi editor).
- Preview pane typography/style now follows the higher-fidelity `/preview-browser` rendering style more closely.
- Hardened Studio preview HTTP handling and added client-side preview-request timeout to avoid stuck "Rendering preview…" states.

### Fixed
- Studio boot blocker caused by unescaped preview HTML class-string quotes in inline script output.
- `hydrateLatestAssistant` now infers response kind from hydrated markdown instead of reusing stale prior kind.
- Added explicit `return` at end of `send_to_editor_request` handler for safer future handler additions.
- `respondText` now includes `X-Content-Type-Options: nosniff` for consistency with JSON responses.
- If `dompurify` is unavailable, preview now falls back to escaped plain markdown instead of injecting unsanitized HTML.
- Preview sanitization now preserves MathML profile and strips MathML annotation tags to avoid duplicate raw TeX text beside rendered equations.

### Changed
- Added npm metadata fields (`repository`, `homepage`, `bugs`) so npm package page links to GitHub.

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

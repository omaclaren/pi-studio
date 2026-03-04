# Changelog

All notable changes to `pi-studio` are documented here.

## [0.4.3] — 2026-03-04

### Added
- **Export right preview as PDF** action in Studio response controls, using server-side pandoc + LaTeX (`xelatex`) for high-quality math/typesetting output.
- Footer metadata now includes model **and thinking level** (e.g., `provider/model (xhigh)`) plus terminal/session label.
- Footer braille-dot activity spinner (`⠋⠙⠹…`) driven by existing websocket lifecycle state.

### Changed
- Footer layout is now two-line and less crowded: status/meta on the left with shortcuts aligned to the right.
- Status text is now user-facing (removed `WS:` jargon and redundant `Ready` wording).

## [0.4.2] — 2026-03-03

### Added
- New editor action: **Load from pi editor** to pull the current terminal editor draft into Studio.
- Optional Studio debug tracing (`?debug=1`) with client/server lifecycle events for request/state/tool diagnostics.

### Changed
- Footer busy status now reflects Studio-owned and terminal-owned activity phases more clearly (`running`, `tool`, `responding`).
- Tool activity labels are derived from tool calls/executions with improved command classification for shell workflows (including current/parent directory listings and listing-like `find` commands).
- Studio request ownership remains sticky during active/agent-busy phases to avoid confusing Studio → Terminal label flips mid-turn.
- Editor and response preview panes keep previous rendered content visible while a new render is in flight, using a subtle delayed **Updating** indicator instead of replacing content with a loading screen.
- Footer shortcut hint and run-button tooltip now explicitly document `Cmd/Ctrl+Enter` for **Run editor text**.

### Fixed
- Studio requests are no longer cleared prematurely when assistant messages end with `stopReason: "toolUse"`.
- Embedded-script activity label normalization now preserves whitespace correctly (fixes corrupted labels caused by escaped regex mismatch).

## [0.4.1] — 2026-03-03

### Changed
- Editor input keeps preview refreshes immediate (no added typing debounce) while keeping editor syntax highlighting immediate in Raw view.
- Response/sync state checks now reuse cached normalized response data and critique-note extracts instead of recomputing on each keystroke.
- Editor action/sync UI updates are now coalesced with `requestAnimationFrame` during typing.

## [0.3.0] — 2026-03-02

### Added
- **Editor Preview in response pane**: new `Right: Editor (Preview)` view mode renders editor text in the right pane with debounced live updates — enables Overleaf-style side-by-side source/rendered editing without a model round-trip.
- Code-language aware: Editor Preview renders syntax-highlighted code when a non-markdown language is selected.
- Response badge shows "Previewing: editor text" in editor-preview mode, with "· response updated HH:MM:SS" when a model response arrives in the background.
- Right pane section header updates to "Editor Preview" when in editor-preview mode.

### Changed
- View toggle labels now use `Left: Source (Mode)` / `Right: Source (Mode)` format for unambiguous pane identification (e.g., `Left: Editor (Raw)`, `Right: Response (Preview)`, `Right: Editor (Preview)`).
- Sync badge wording: `Edited since response` → `Out of sync with response` (direction-neutral, accurate regardless of which side changed).
- Critique load buttons now include destination: `Load critique notes into editor` / `Load full critique into editor` (consistent with `Load response into editor`).
- Critique loaded-state labels updated: `Critique (full) already in editor` → `Full critique already in editor`.

## [0.2.4] — 2026-03-02

### Changed
- Added structured critique screenshot to README gallery (shows assessment, numbered critiques with math, sync badge).
- Screenshot gallery cleanup: corrected label mapping, removed redundant fenced-code shot.

## [0.2.1] — 2026-03-02

### Added
- **Language-aware syntax highlighting**: selectable `Lang:` dropdown (Markdown, JavaScript, TypeScript, Python, Bash, JSON, Rust, C, C++, Julia, Fortran, R, MATLAB).
- Language auto-detected from file extension when loading files; manually overridable via dropdown.
- Full-document code highlighting in editor Raw view when a non-markdown language is selected (reuses fenced-block tokenizer across entire content).
- Code-aware Preview: when a code language is selected, Preview renders syntax-highlighted `<pre>` instead of sending to pandoc.
- Language preference persisted to `localStorage` across sessions.
- New tokenizer patterns for Rust, C/C++, Julia, Fortran, R, and MATLAB (keywords, strings, comments, numbers).
- Expanded file-accept list for Load file content (`.h`, `.hpp`, `.jl`, `.f90`, `.f95`, `.f03`, `.f`, `.for`, `.r`, `.R`, `.m`, `.lua`).

### Changed
- Renamed "Load file in editor" → "Load file content" (clarifies that file content is copied, not edited in-place).
- Lang selector visibility: shown when syntax highlight is On (Raw view) or in Preview mode; hidden otherwise.
- Updated README with comprehensive screenshot gallery (markdown, math, mermaid, code mode, fenced code).

## [0.2.0] — 2026-03-02

### Added
- Luminance-based canvas color derivation from theme surface colors — proper bg/panel/panel2 tiers instead of flat mid-tone mapping.
- Dedicated `--editor-bg` CSS variable — editor text box pushed toward white (light) for a crisp paper feel.
- `Cmd/Ctrl+Enter` keyboard shortcut to trigger "Run editor text" when editor pane is active.

### Changed
- Renamed "Highlight markdown: On/Off" → "Syntax highlight: On/Off".
- Renamed "Editor: Markdown" / "Response: Markdown" → "Editor: Raw" / "Response: Raw" (future-proofing for non-markdown formats).
- Active pane indicator simplified to subtle border color change (removed thick top accent bar).
- Panel shadows, button hierarchy (filled accent for primary actions), heading scale, blockquote/table styling improvements.

## [Unreleased]

### Added
- Single-workspace flow (no mode switching): always-on **Editor** pane + **Response** pane.
- Explicit annotation scaffold action: **Insert annotation header** (upserts header and source metadata in-editor).
- Clear top-level critique controls: **Critique editor text** + **Critique focus**.
- Unified response actions:
  - **Load response into editor** (for non-critique responses)
  - **Load critique (notes)**
  - **Load critique (full)**
  - **Copy response text**
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
- Markdown highlighter now applies lightweight fenced-code token colors for common languages (`js/ts`, `python`, `bash/sh`, `json`).
- Obsidian wiki-image syntax normalization (`![[path]]`, `![[path|alt]]`) before pandoc preview rendering.
- Client-side Mermaid rendering for fenced `mermaid` code blocks in both Preview panes.

### Changed
- Removed Annotate/Critique tabs and related mode state.
- Right pane now always shows the latest assistant output (reply or critique).
- Response badge now reports response type + timestamp (`assistant response` / `assistant critique`).
- Editor sync badge now tracks relation to latest response (`No response loaded`, `In sync with response`, `Edited since response`).
- Footer continues to show explicit WS phase (`Connecting`, `Ready`, `Submitting`, `Disconnected`) alongside status text.
- Running text and preparing annotated scaffolds are now separate explicit actions (no hidden header wrapping on send).
- Renamed file-backed header action from **Save Over** to **Save file**, with tooltip showing the current overwrite target.
- Critique-specific load actions now focus on notes/full views and are only shown for structured critique responses.
- Studio still live-updates latest response when assistant output arrives outside studio requests (e.g., manual send from pi editor).
- Preview pane typography/style now follows the higher-fidelity `/preview-browser` rendering style more closely.
- Preview mode now uses pandoc code highlighting output for syntax-colored code blocks.
- Preview markdown styling now maps markdown (`md*`) and syntax (`syntax*`) theme tokens for closer parity with terminal rendering.
- Theme surface mapping now uses theme-export backgrounds when available (`pageBg`, `cardBg`, `infoBg`) for clearer depth across `bg/panel/panel2`.
- Mermaid preview now uses palette-driven Mermaid defaults (base theme + theme variables) for better visual fit with active pi themes.
- Studio chrome was refined for a cleaner visual hierarchy (subtle panel shadows, primary action emphasis, lighter active-pane accent bar, softer heading scale, table striping, and tinted blockquotes).
- Hardened Studio preview HTTP handling and added client-side preview-request timeout to avoid stuck "Rendering preview…" states.

### Fixed
- Studio boot blocker caused by unescaped preview HTML class-string quotes in inline script output.
- `hydrateLatestAssistant` now infers response kind from hydrated markdown instead of reusing stale prior kind.
- Added explicit `return` at end of `send_to_editor_request` handler for safer future handler additions.
- `respondText` now includes `X-Content-Type-Options: nosniff` for consistency with JSON responses.
- If `dompurify` is unavailable, preview now falls back to escaped plain markdown instead of injecting unsanitized HTML.
- Preview sanitization now preserves MathML profile and strips MathML annotation tags to avoid duplicate raw TeX text beside rendered equations.
- Preview now shows an inline warning when Mermaid is unavailable or diagram rendering fails, instead of failing silently.

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

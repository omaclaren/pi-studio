# Changelog

All notable changes to `pi-studio` are documented here.

## [Unreleased]

## [0.5.37] — 2026-03-29

### Added
- Studio now includes a local persistent scratchpad for parking quick thoughts while you work. The scratchpad opens as an integrated modal, keeps its contents after closing, and provides copy / clear / insert-into-editor actions.

### Changed
- Scratchpad UI text and actions now make the persistence semantics explicit: closing keeps the current notes unless you actively clear them.

## [0.5.36] — 2026-03-28

### Changed
- Annotation pills in Studio preview now render a small safe subset of inline formatting inside `[an: ...]` notes — emphasis/bold, inline code, and math — while still keeping bare URLs and markdown links inert literal text so annotation notes remain robust and self-contained.
- PDF/export-side annotation handling now follows the same bracket-aware parsing model as the preview for raw Markdown annotation markers, so markdown-ish note content is treated as one annotation body instead of being cut off at the first `]`.

### Fixed
- Preview-side annotation placeholder insertion now keeps inline-code examples such as `` `[an: prefer \`npm test\` here]` `` from desynchronizing later annotation parsing and leaking raw `PISTUDIOANNOT...TOKEN` placeholders.
- `/studio-pdf` and generated-LaTeX annotation rewriting now handle markdown links, inline code, emphasis markers, escaped backticks, and multiple annotations more reliably inside `[an: ...]` markers, while still leaving fenced-code literals untouched.

## [0.5.35] — 2026-03-27

### Fixed
- Diff/file exports via `/studio-pdf <path>` now also make inline math scripts in diff-line annotation badges verbatim-safe inside Pandoc's generated `Highlighting` environment, so subscripts/superscripts like `$x_n$` and `$\epsilon_n=\frac{1}{n}$` render correctly instead of showing literal underscores in the exported PDF.

## [0.5.34] — 2026-03-27

### Changed
- Preview-side fenced `text`/`plaintext` blocks now soft-wrap long lines instead of forcing horizontal scrolling, while code/diff blocks keep their existing scrollable behavior.

### Fixed
- Preview annotation pills once again render inline math within long `[an: ...]` notes instead of leaving `$...$` / `\(...\)` fragments as literal text.
- Diff/file exports via `/studio-pdf <path>` now also preserve math inside diff-line annotation badges such as `[an: add note $\epsilon_n=\frac{1}{n}$]`, instead of leaving escaped TeX literals in the exported PDF.

## [0.5.33] — 2026-03-27

### Changed
- Studio browser tabs now use `π Studio` branding plus a simple theme-reactive `π` favicon instead of the generic browser globe.

### Fixed
- Markdown preview now preserves `[an: ...]` markers more reliably by replacing them with preview-safe placeholders before pandoc and restoring annotation pills afterwards, preventing long or markdown-like annotations from leaking through as raw text.
- Preview/PDF markdown preparation now normalizes fenced blocks whose contents contain competing backtick/tilde fence runs, avoiding broken rendering/export for diff-heavy content that itself contains code fences.
- Diff PDF exports now route highlighted diff content through the generated-LaTeX path more reliably, keeping add/delete/meta/hunk styling and line wrapping on exports that previously rendered poorly or fell back unnecessarily.
- PDF annotation badges now wrap within the page width instead of overflowing on long notes, preserve inline math inside annotation text, and also render correctly inside diff token lines such as `+[an: ...]`.

## [0.5.32] — 2026-03-25

### Added
- `/studio-pdf <path>` now accepts a curated set of advanced layout controls for file-based exports, including font size, margins, line stretch, main font, paper size, geometry, heading sizes, heading spacing, and footer skip.

### Changed
- Large-font Markdown/QMD Studio PDF exports now switch to a more suitable LaTeX document class and use a safer default footer skip unless you explicitly override the geometry.
- PDF callout blocks now render more compactly, reducing extra vertical whitespace around note/tip/warning content.

### Fixed
- Studio preview/PDF preparation now treats `.qmd` files like Markdown, strips HTML comments more narrowly, shows standalone LaTeX page-break commands as subtle preview dividers, and supports common Quarto-style callout and `fig-align` patterns in preview/PDF output.
- Markdown/QMD preview now renders embedded local PDF figures more reliably via `pdf.js`, avoiding grey-box browser embed failures in the Studio preview surface.

## [0.5.31] — 2026-03-24

### Fixed
- The right-pane response view now nudges the browser to repaint after response renders complete, reducing cases where freshly rendered response content stayed visually blank until the user scrolled or interacted with the pane.
- Newly selected or newly arrived responses now reset the right-pane scroll position to the top by default, while **Editor (Preview)** continues to preserve scroll position so in-place edit/preview workflows still feel natural.

## [0.5.30] — 2026-03-24

### Fixed
- LaTeX preview now preserves structured display-math environments such as `bmatrix` inside `\[ ... \]` instead of flattening their rows during Markdown math normalization, and preview display equations now center more robustly across browser engines.
- Studio now highlights custom `[an: ...]` markers in LaTeX editor syntax-highlighting mode, and PDF export renders those markers as styled annotation badges for both Markdown and LaTeX documents instead of leaving the raw bracket syntax in the final PDF.
- Right-pane response PDF export now also respects the current annotation-visibility mode, so hidden annotations do not leak into exported PDFs as raw `[an: ...]` text.

## [0.5.29] — 2026-03-21

### Changed
- Studio keyboard shortcuts now keep `Cmd/Ctrl+Enter` for running editor text while using `Esc` to stop an active request, and the focus-pane hint/button copy now describes focus mode as a toggle via `F10` or `Cmd/Ctrl+Esc`.
- While **Run editor text** is active, Studio now exposes a separate **Queue steering** action (and `Cmd/Ctrl+Enter` queues steering) while preserving a visible **Stop** control, and response-history prompt loading now preserves the effective prompt chain for steered responses rather than only the last correction message.

## [0.5.28] — 2026-03-21

### Changed
- Refreshed the Studio package description and README opening/docs so they describe Studio more accurately as a two-pane browser workspace for prompt/response editing, annotations, history, live preview, and related workflows, and documented `/studio-current` plus the optional Mermaid CLI requirement for Mermaid PDF rendering.

## [0.5.27] — 2026-03-21

### Fixed
- Markdown preview/PDF parsing now also allows ATX headings without a preceding blank line, so patterns like `Paragraph` followed immediately by `# Heading` on the next line are treated as headings rather than plain paragraph text.

## [0.5.26] — 2026-03-21

### Added
- Added a file-based `/studio-pdf <path>` command that exports a local file to `<name>.studio.pdf` using the existing Studio PDF pipeline and opens the result in the default PDF viewer, without requiring the Studio browser UI.

### Fixed
- Markdown preview/PDF rendering now also allows blockquotes without a preceding blank line, matching the earlier tolerant list parsing and preventing leading `>` quote lines from collapsing into plain paragraph text.
- Studio browser preview now keeps the existing MathML rendering for ordinary equations but falls back to MathJax for pandoc-unsupported math blocks, improving advanced LaTeX matrix/array preview cases without switching all preview math to MathJax.

## [0.5.25] — 2026-03-21

### Fixed
- Studio PDF exports now add more space below ruled section headings to keep bibliography entries clear of the `References` underline, and figure captions now use left-aligned ragged-right formatting for long multi-line captions, including reinjected PDF subfigure groups, without disturbing normal figure centering.

## [0.5.24] — 2026-03-20

### Fixed
- LaTeX PDF export now intercepts grouped `subfigure` blocks before Pandoc and reinjects them into the generated LaTeX as grouped minipage-based figure pages with aux-derived `Figure n` / `(a)` / `(b)` labels, preserving grouped subfigure layout more faithfully in exported PDFs.

## [0.5.23] — 2026-03-20

### Fixed
- LaTeX PDF export now preprocesses common `algorithm` / `algorithmic` / `algpseudocode` blocks into pandoc-friendly quoted step layouts, improving exported algorithm readability while keeping the existing Studio PDF pipeline.

## [0.5.22] — 2026-03-20

### Fixed
- Citeproc-rendered LaTeX bibliographies now request a visible `References` section heading in Studio preview/PDF output.
- LaTeX preview now regroups `subfigure`-based figures so adjacent subfigures keep their shared overall figure/caption structure instead of rendering as unrelated standalone figures, including visible `(a)` / `(b)` subfigure markers and `Figure n` main-caption labels when `.aux` labels are available.
- LaTeX preview now converts common `algorithm` / `algorithmic` / `algpseudocode` blocks into readable algorithm cards with preserved captions, indentation, and optional line numbers instead of showing the raw environment text.
- The editor language dropdown is now alphabetised for quicker scanning.

## [0.5.21] — 2026-03-19

### Fixed
- PDF export now uses a two-step prepare/download flow and opens the generated PDF in the system’s default viewer first, so browser surfaces like cmux do not need to navigate away from the current Studio page.
- LaTeX preview and PDF export now use the document `.aux` file when available to substitute basic `\eqref{...}`, `\ref{...}`, and `\autoref{...}` values more reliably, and preview decorates block equations with their resolved equation numbers.
- Upload + working-directory LaTeX workflows now derive the effective source path more reliably, helping Studio find the correct `.aux` file for reference resolution.

## [0.5.20] — 2026-03-19

### Fixed
- LaTeX preview/PDF export now runs pandoc from the resolved source/working directory, so project-relative `\input{...}` files, shared macros, and similar local assets resolve more reliably for multi-file documents.
- LaTeX preview/PDF export now also detects basic bibliography directives such as `\bibliography{...}` and `\addbibresource{...}` and passes the resolved `.bib` files to pandoc citeproc, so references show up more often in Studio without a full `latexmk` build.
- Display-math blocks in preview are now styled to center more naturally, and the raw-editor highlight cutoff is bumped to `100_000` characters so moderately large `.tex` files still get inline syntax colouring.

## [0.5.19] — 2026-03-19

### Fixed
- Studio now waits until `agent_end` before emitting the terminal/cmux “response ready” notification for completed requests, and it keeps the cmux `running…` status pill visible until that same turn fully finishes.

## [0.5.18] — 2026-03-17

### Fixed
- cmux sidebar Studio status pills now use a darker blue in light mode, making `running…` / `compacting…` much easier to read.
- The annotated-reply header wording in Studio now says `user annotation syntax: [an: note]`, matching the intended user-guidance semantics more clearly.

## [0.5.17] — 2026-03-17

### Fixed
- Studio preview and PDF rendering now accept Markdown lists without a preceding blank line, so common model output like `What I read:\n- item` renders as a real list instead of collapsing into a paragraph.

## [0.5.16] — 2026-03-17

### Fixed
- Response-history prompt loading now keeps the correct generating prompt for both Studio editor-sent requests and prompts entered directly in the terminal, instead of sometimes reusing stale editor text.

## [0.5.15] — 2026-03-16

### Added
- Per-pane **Focus pane** controls for both the editor and response panes, matching the current Ghostty/cmux split-browser workflow more directly.
- cmux-aware Studio completion notifications with safer workspace-level targeting, a running/compacting sidebar status pill, stale-notification clearing when a new Studio request starts, and suppression when the Studio browser surface is already focused.

### Fixed
- Active **Focus pane** buttons now keep their accent-coloured hover state instead of switching to a dark hover style.
- PDF export now defines the LaTeX `Highlighting` environment when Pandoc has not already created it, fixing exports that previously failed with `Environment Highlighting undefined`.

## [0.5.14] — 2026-03-15

### Fixed
- Studio PDF export now carries the editor language to the server and defensively re-wraps non-markdown editor content there before Pandoc export, reducing brittle diff/code export failures when the editor contains raw git diffs or code-like text.
- Studio PDF export now also auto-detects both raw **and already-fenced** git-diff content server-side even if the client-side editor language was lost or stale.
- Editor-preview PDF export no longer classifies diff/code text as LaTeX just because the content happens to mention strings like `\documentclass` or `\begin{document}` inside a diff/code block.
- Diff-language editor PDF exports now first try the normal highlighted Pandoc path, but fall back to a literal-text LaTeX export when highlighted diff export fails on large or markdown-like git diffs.
- Highlighted PDF code/diff blocks now enable LaTeX-side line wrapping, reducing long diff/code lines running off the page.
- Non-markdown editor preview panes such as diff/code now wrap long lines instead of forcing horizontal overflow.
- Passive Studio browsing controls such as response-history navigation and left/right view switching remain available while a model request is running.

## [0.5.13] — 2026-03-15

### Fixed
- Studio `Editor (Preview)` PDF export now fences non-markdown editor content such as diff/code before Pandoc export, preventing LaTeX failures on raw diff/code text.
- Non-markdown editor preview modes such as `diff` now support inline `[an: ...]` markers and render them as compact note pills.
- The editor highlight overlay keeps exact annotation source text/width, preserving cursor and text alignment while preview-only panes use the compact annotation-pill rendering.

## [0.5.12] — 2026-03-15

### Added
- Studio now has a `Load git diff` button that loads the current git changes (staged + unstaged tracked changes plus untracked text files) into the editor from the current Studio context and sets the editor language to `diff`.

## [0.5.11] — 2026-03-15

### Added
- Studio tabs now show a title attention marker like `● Response ready` or `● Critique ready` when a Studio-started model request finishes while the tab is unfocused, and clear that marker when the tab regains focus or the next Studio request starts.

## [0.5.10] — 2026-03-14

### Fixed
- Studio preview/PDF math normalization is now more robust for model-emitted `\(...\)` / `\[...\]` math, including malformed mixed delimiters like `$\(...\)$`, optional spacing around those mixed delimiters, and multiline display-math line-break formatting that previously leaked raw/broken `$$` output into preview.

## [0.5.9] — 2026-03-13

### Fixed
- Studio preview now uses Pandoc's `markdown` reader (matching `pi-markdown-preview`) instead of `gfm` for math-aware rendering, preventing currency amounts like `$135.00` from being misparsed as inline math in preview/PDF.
- Studio PDF export now preprocesses fenced Mermaid blocks via Mermaid CLI (`mmdc`) before Pandoc export, so Mermaid diagrams render as diagrams in exported PDFs instead of falling back to raw code fences.

## [0.5.8] — 2026-03-12

### Changed
- Studio browser tabs now auto-reconnect after unexpected websocket disconnects (for example transient local connection loss or sleep/wake), while intentional invalidation/shutdown still requires a fresh `/studio`.
- Same-tab reconnect now preserves the currently selected response-history item instead of jumping back to the latest response on every `hello_ack` resync.

## [0.5.7] — 2026-03-12

### Changed
- Preview rendering now passes `--wrap=none` to pandoc and preview-side annotation matching now tolerates embedded newlines, fixing missed `[an: ...]` highlights in preview for longer annotations.
- Editor sync indicator is now intentionally quiet: Studio only shows the badge when the editor exactly matches the current response/thinking, and hides it while drafting/out-of-sync.
- Response history navigation now includes **Last response ▶|** for jumping straight back to the newest loaded history item.
- Renamed **Get latest response** to **Fetch latest response** for clearer distinction from history navigation, and moved **Load response into editor** ahead of **Load response prompt into editor** in the action row.

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

## [0.5.6] — 2026-03-10

### Changed
- Studio monospace surfaces now use a shared `--font-mono` stack, with best-effort terminal-font detection (Ghostty/WezTerm/Kitty/Alacritty config when available) and `PI_STUDIO_FONT_MONO` as a manual override.
- In-flight **Run editor text** / **Critique editor text** requests now swap the triggering button into an in-place theme-aware **Stop** state while disabling the other action.

## [0.5.5] — 2026-03-09

### Fixed
- Improved raw-editor caret/overlay alignment in Syntax highlight mode:
  - width-neutral annotation highlight styling
  - more textarea-like wrap behavior in the highlight overlay
  - preserved empty trailing lines in highlighted output so end-of-file blank lines stay aligned
  - reduced raw overlay metric drift for comment/quote styling

## [0.5.4] — 2026-03-09

### Added
- New right-pane **Thinking (Raw)** view for assistant/model thinking when available.

### Changed
- Response history and latest-response syncing now preserve associated thinking content.
- In Thinking view, right-pane actions adapt to the selected reasoning trace:
  - **Load thinking into editor**
  - **Copy thinking text**
  - thinking-aware reference/sync badges

## [0.5.3] — 2026-03-06

### Added
- New terminal command: `/studio-current <path>` loads a file into currently open Studio tab(s) without opening a new browser session.
- `/studio --help` now includes `/studio-current` usage.

### Changed
- Footer compact action label is now **Compact**.
- Footer metadata now includes in-Studio npm update hint text when an update is available (`Update: installed → latest`).
- Update notification timing now runs after Studio open notifications, so the update message is not immediately overwritten.
- Slash-command autocomplete order now lists `/studio` before `/studio-current`.

### Fixed
- Removed low-value terminal toasts for Studio websocket connect/disconnect that could overwrite more important notifications.

## [0.5.2] — 2026-03-06

### Changed
- Refined left-pane action grouping into clearer workflow rows (run/copy/send/load, annotation tools, critique/highlight controls).
- Refined right-pane action grouping with consistent rows below response output:
  - mode toggles
  - history navigation (`Get latest`, `Prev`, `History`, `Next`)
  - response load/copy actions
- Moved **Export right preview as PDF** to the right-pane section header (next to response view selector).
- Annotation header scaffold now includes precedence guidance:
  - `precedence: later messages supersede these annotations unless user explicitly references them`
- Inserted annotation scaffold now includes a closing boundary marker:
  - `--- end annotations ---`
- Removing annotation header now strips the boundary marker as well.
- Updated default README dark/light workspace screenshots to the latest UI.
- Moved `sample.diff` example into `assets/` with other sample files.
- Added escaping guidance for embedded browser script/template changes to `WORKFLOW.md`.

### Fixed
- Prevented Studio boot breakage caused by unescaped newline insertion in embedded script string updates.

## [0.5.0] — 2026-03-05

### Added
- Response history browser controls in Studio response actions (`Prev response` / `Next response` + `History: i/n`) with read-only browsing of prior assistant responses.
- New response action: **Load response prompt into editor** (loads the user prompt that generated the currently selected history response, when available).
- Annotation mode toggle (`Annotations: On|Off`) with explicit send behavior:
  - **On**: keep/send `[an: ...]` markers
  - **Off**: strip `[an: ...]` markers before Run/Critique
- New editor action: **Save .annotated.md** (saves full editor text, including annotation markers).
- Startup npm update check with terminal notification when installed version is behind npm latest.
- Footer now shows live context usage (`used / window` and `%`) when available.
- Footer action: **Compact context** button to trigger pi compaction directly from Studio.
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
- Browser tab title now mirrors runtime metadata: `pi Studio · <terminal/session> · <model>`.
- Inserted annotation scaffold now includes explicit syntax line: `annotation syntax: [an: your note]`.
- Editor preview rendering now follows annotation mode (`On` highlights `[an: ...]` markers; `Off` hides them by stripping before preview render).
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
- Fixed runtime model label staleness in Studio footer/state broadcasts by tracking canonical model metadata separately from command context.
- Tightened editor/raw-highlight scroll synchronization for long documents and viewport changes (extra sync on keyup/mouseup/resize + post-update resync).
- Studio boot blocker caused by unescaped preview HTML class-string quotes in inline script output.
- `hydrateLatestAssistant` now infers response kind from hydrated markdown instead of reusing stale prior kind.
- Added explicit `return` at end of `send_to_editor_request` handler for safer future handler additions.
- `respondText` now includes `X-Content-Type-Options: nosniff` for consistency with JSON responses.
- If `dompurify` is unavailable, preview now falls back to escaped plain markdown instead of injecting unsanitized HTML.
- Preview sanitization now preserves MathML profile and strips MathML annotation tags to avoid duplicate raw TeX text beside rendered equations.
- Preview now shows an inline warning when Mermaid is unavailable or diagram rendering fails, instead of failing silently.

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

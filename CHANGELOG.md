# Changelog

All notable changes to `pi-studio` are documented here.

## [Unreleased]

## [0.9.32] — 2026-06-10

### Added
- Added `Cmd/Ctrl+Alt+W` to switch the right pane directly to Working, matching the existing direct Preview shortcut.

### Fixed
- Preserved expanded Working-view detail sections while live working updates stream in.

## [0.9.31] — 2026-06-09

### Fixed
- Render long PDF annotations as full-width display-style boxes at their marker position so exported feedback avoids clipping while preserving the surrounding annotation order.
- Avoided annotation placeholder collisions in HTML exports with ten or more annotations.

## [0.9.30] — 2026-06-09

### Fixed
- Rendered inline strikethrough, emphasis, and code inside `[an: ...]` annotation badges consistently across Studio preview and HTML/PDF export paths.

## [0.9.29] — 2026-06-09

### Added
- Added `/studio --no-browser` and `/studio --port <port>` launch flags for explicit remote/forwarded Studio sessions when SSH auto-detection is not enough.

## [0.9.28] — 2026-06-08

### Added
- Added a footer **Pi model & thinking** menu for switching the active Pi model and thinking level from Studio while keeping Studio Suggest model choice separate.

### Changed
- Clarified the browser-import tooltip to explain that **Save editor as…** can make an imported copy file-backed.
- Regularized Source & context menu notes so explanatory text uses a quieter, consistent menu-note style.

## [0.9.27] — 2026-06-08

### Added
- Added an **Open root** action to the Files view for opening the Files root folder in Finder or the system file manager.

### Changed
- Clarified browser-import and Files-view file-backed open action tooltips.
- Added **Try another** regeneration for completion suggestions and a persistent Suggestion model picker that keeps suggestions separate from the main Pi model and uses thinking off, with clearer cursor-marker prompting and separate prose/code completion instructions.

### Fixed
- Avoided showing the missing-LaTeX-engine hint for PDF exports when XeLaTeX/PDFLaTeX ran but the document itself had a LaTeX error.
- Restored Pandoc-rendered LaTeX title/author/abstract metadata in Studio previews that use embedded resources.
- Preserved optional LaTeX `\footnotemark[n]` markers as linked superscript affiliation markers in Studio previews.
- Nudged inline completion suggestions to return a non-empty continuation when explicitly requested at the end of a sentence or paragraph.
- Fixed Markdown blockquotes containing multiline `\[ ... \]` display math so quote markers are not folded into the math content.

## [0.9.26] — 2026-06-04

### Fixed
- Made Studio Markdown previews compatible with older Pandoc versions by falling back to `--self-contained` when `--embed-resources` is unavailable.

## [0.9.25] — 2026-06-01

### Changed
- Render common Working-view tool inputs more readably, with summaries for edit/write/read/bash calls and raw inputs available behind collapsible details.

## [0.9.24] — 2026-06-01

### Added
- Added a read-only **Changes** right-pane view with changed-file list, per-file diff preview, refresh, open-file, load-diff, and copy-diff actions.
- Added `studio_export_pdf` and `studio_export_html` agent tools so Pi can export direct Markdown/LaTeX, local files, or the last model response without the slash-command path.
- Added a Source & context status note explaining that Studio branch history follows the current Pi branch while editor text stays independent.
- Added an in-panel **Hide** control for Scratchpad Recent recovery.

### Changed
- Removed the old top-bar **Load git diff** shortcut now that the right-pane **Changes** view provides load/copy/open actions.
- Renamed the response-history label to **Branch history** to make its current-branch scope clearer.
- Softened active Scratchpad, Comments, Outline, Focus pane, HTML comment-mode, trace-filter, and Working status styling so they avoid filled highlight pills.

## [0.9.23] — 2026-05-31

### Changed
- Studio now treats Pi `/tree` navigation as an explicit response-history sync: it preserves the selected response only when that response still exists on the new branch, otherwise selects the latest response on the current branch and shows a status note that editor text was left unchanged.

## [0.9.22] — 2026-05-29

### Added
- Added **Open current file in new editor tab** and **Open current text as copy in new editor tab** to Source & context for explicit file-backed vs detached-copy tab opening.
- Added `Cmd/Ctrl+Alt+P` to switch the right pane directly back to Preview without cycling through Files, REPL, or Working.

### Changed
- Changed the editor toolbar's detached-copy action into **New editor tab** for opening a blank editor tab, moved **Send current text to Pi editor** into Source & context, separated the passive origin summary from explicit **Detach from file** / **Reset origin** actions, and aligned local link menus with Files-view wording (**Open file tab** / **Convert tab**).

### Fixed
- New Studio tabs opened from Files, local preview links, preview exports, or editor-tab actions now skip cloned browser-tab workspace restore on first load, preventing inherited Files/preview state from briefly flashing and replacing the requested document preview.

## [0.9.21] — 2026-05-28

### Added
- Added **Recent…** to the Scratchpad so scratchpads saved under previous file/draft identities can be loaded, appended, or copied after reopening Studio or continuing a Pi session.
- Preview export now distinguishes **Export PDF and Open in Studio preview tab** from **Export PDF and Open in default PDF viewer**; the Studio path opens a Files-view-style editor-only preview tab with a `studio-pdf` block.
- HTML export now distinguishes **Export HTML and Open in Studio editor** from **Export HTML and Open in browser**; the Studio path opens the exported HTML in an editor-only Studio tab for inspection, editing, previewing, and comment mode.

## [0.9.20] — 2026-05-27

### Added
- Added an opt-in HTML preview comment mode for editor HTML previews: use **Comment mode** to select text or click elements inside the sandboxed preview, or **Page** for a page-level comment; comments are stored in the existing local Comments rail and can be loaded into a prompt.
- Added **Refresh** controls to Studio PDF previews and the PDF focus viewer so file-backed PDFs can be reloaded from disk without rerendering the whole Studio pane.
- Editor-only Studio views now expose the right-pane **Files** and **REPL** views; REPL mode keeps Pi run/critique disabled but allows **Send to REPL** from the editor, including the `Cmd/Ctrl+Shift+Enter` shortcut.

## [0.9.19] — 2026-05-27

### Changed
- Renamed the browser file picker to **Import file copy…**, clarified that browser-imported files are unsaved copies until saved, and renamed Files-view tab actions to **Open file tab**, **Convert tab**, or **Preview tab** depending on file type.

### Fixed
- Working-view tool inputs now keep a bounded full input copy so long shell commands and REPL snippets can be expanded/copied instead of only showing the short activity summary.
- Editor-only and editor-preview panes now fall back to the file extension language while the stored editor language is still the default, avoiding Julia/code files being briefly or persistently rendered as Markdown prose.
- Clarified refresh-from-disk behaviour for detached drafts, kept the resource directory visible for file-backed tabs, made refresh requests preserve/use the client tab's current file path so files opened from the Files view can be refreshed reliably, and made Working tool inputs appear as soon as Pi announces a tool call.

## [0.9.18] — 2026-05-26

### Added
- Added a zoomable image focus viewer for rendered Markdown images, Working-view image outputs, Files-view images, and local image preview links, with Fit, 100%, zoom in/out, reset, fullscreen, modified-wheel/pinch zoom, and active image zoom shortcuts.
- Added lightweight CSV/TSV preview rendering as scrollable tables with sticky headers, row numbers, and truncation notices while keeping CSV/TSV files editable as plain text; editor-preview exports and `/studio-pdf`/`/studio-html` path exports now render CSV/TSV as tables too.

### Changed
- Fixed editor-only CSV/TSV tabs to refresh their right-pane table preview when the detected editor language changes.
- Made the keyboard-shortcuts overlay keyboard-scrollable with arrow keys, Page Up/Down, Home, and End.
- Added Files-view toolbar actions to copy the current folder path and use the current folder as the Studio working directory.
- Added Files/local-link actions for opening PDF/image previews in new Studio tabs, plus Pandoc-based DOCX/ODT conversion into editable Markdown editor tabs or the current editor, with an explicit conversion confirmation warning. CSV/TSV files continue to open as plain text, with manual CSV/TSV fixtures for testing.
- Right-pane preview exports now write PDF/HTML files to the source file directory, the Studio working directory, or the Pi session directory instead of only preparing a temporary file for opening/download.

## [0.9.17] — 2026-05-25

### Changed
- Escape now dismisses a visible editor completion suggestion before falling through to other Studio Escape actions.
- Added a compact **Source & context** dropdown beside the editor-mode selector, with editor-only suggestions by default and an optional editor-plus-latest-response context mode; in-flight suggestion requests can now be stopped from the **Suggest** button.
- Kept Zen mode focused by hiding **Suggest** with the other secondary editor utilities while still showing **Send to REPL** controls when the REPL pane is active.

## [0.9.16] — 2026-05-24

### Added
- Added a first-cut manual **Suggest completion** editor action beside Run/Queue that asks the active model for a short cursor/selection-aware continuation, previews it before insertion, supports Option/Alt+Tab where available plus Cmd/Ctrl+Shift+Space from the editor, and lets Tab insert a visible suggestion.

## [0.9.15] — 2026-05-23

### Added
- Added a first-cut right-pane **Files** view for browsing the current Studio resource directory, opening folders, opening text/code documents in the editor, previewing local PDFs/images, copying paths, and revealing files in the file manager.
- Added text-file recognition for extensionless/dotfile project files such as `.gitignore`, `.gitattributes`, `.env`, `Dockerfile`, `Makefile`, `Justfile`, `LICENSE`, and `README`.

### Changed
- The Files view now treats the Pi session directory/resource directory as its navigation root, while opening initially near the active file when applicable.
- Renamed **Clear editor** to **Reset editor** and clarified that it resets the tab to a fresh blank draft without changing saved files or responses.
- Browser-tab workspace restoration now uses per-tab session storage instead of shared local storage.

### Fixed
- Fixed editor-only companion tabs inheriting a Files right-pane state from another Studio tab after opening a document in a new editor.

## [0.9.14] — 2026-05-22

### Added
- Added active-pane text-size shortcuts: Alt/Option+= to increase, Alt/Option+- to decrease, and Alt/Option+0 to reset editor or right-pane text size when not editing text.

### Changed
- Blank and last-response Studio launches now default the working directory/resource context to the current Pi directory.
- Made the working-directory label use normal muted text styling instead of standing out like a primary control.

### Fixed
- Fixed the keyboard-shortcuts overlay layout so shortcut groups are no longer clipped by the global pane section styles.

## [0.9.13] — 2026-05-22

### Added
- Added browser-refresh restoration for the Studio editor workspace, plus an explicit **Reset editor** action for discarding the restored browser draft without touching saved files or response history.
- Added local preview-link handling for rendered document previews and sandboxed HTML previews: local PDF links open in Studio's embedded PDF focus viewer, local image links open in a local image preview, text/code/document links can open in a new editor tab, and right-clicking local links offers **Open here**, **Reveal in file manager**, and **Copy path** where applicable.
- Brought editor-only Studio closer to full Studio for document-local controls: pane resizing/focus shortcuts now work, and the annotation-header toggle remains available.

### Fixed
- Fixed local resource context propagation when following links into subdocuments, so nested document/image/PDF links and **Reveal in file manager** resolve relative to the active document while staying inside the original Studio resource directory.
- Fixed malformed working-directory/resource paths that accidentally duplicated absolute path prefixes such as `/Users/.../Users/...`.
- Fixed refreshed toolbar menu overflow so annotation/view menus remain clickable instead of being clipped or covered by toolbar chips.

## [0.9.12] — 2026-05-21

### Added
- Added a draggable splitter for resizing the editor and right panes without entering pane-focus mode, with double-click/keyboard reset, narrow snap-to-50/50 near the centre, restored visual separation between panes, a hover/focus-only divider line, and a minimum editor width to avoid toolbar collapse.
- Added an optional REPL start command field so Studio-owned REPL sessions can start through a selected environment command such as `.venv/bin/python`, `uv run python`, or `conda run --no-capture-output -n env python`.
- Added non-text-entry response-history shortcuts: Alt/Option+Left for previous, Alt/Option+Right for next, and Alt/Option+l for latest response.

### Changed
- Generic live tool labels such as “Running git command” are no longer promoted into the Studio status line, and shell command detection now looks at executable tokens rather than matching path text like `Git-Working`.
- Refreshed pane headers and editor toolbar controls now stack based on pane width, so resizing a pane no longer lets secondary controls overlap the primary pane title or run action.
- Sandboxed HTML previews now resolve local relative PNG/JPEG/GIF/WebP image references through Studio's resource context and embed them as data URLs, without allowing arbitrary network resources.
- The REPL view now keeps the selected session aligned with the selected runtime, so choosing Python no longer leaves Send to REPL targeting an existing Shell session; the start-command controls were simplified so Start creates or switches to a session for the selected runtime and command, and the **Studio REPL Record** header was tightened.

## [0.9.11] — 2026-05-19

### Added
- Render TeX math inside sandboxed interactive HTML previews through Studio's existing Pandoc/MathML pipeline without enabling network scripts.
- Added a **Copy source** button to rendered Mermaid diagrams.

### Fixed
- Made same-document section links scroll correctly inside sandboxed interactive HTML previews.

## [0.9.10] — 2026-05-19

### Added
- Added keyboard shortcuts for Studio pane navigation: F6 switches panes, F7/Shift+F7 cycles the active pane view, F8 focuses editor text, Shift+F8 focuses right-pane content, F9 toggles Zen mode, and F10 keeps pane focus/unfocus.
- Added a compact **Shortcuts (?)** footer button with a keyboard-shortcuts overlay; `?` opens it when focus is not in a text-entry field.

## [0.9.9] — 2026-05-19

### Fixed
- In SSH-launched Studio sessions, copy actions now use the local browser clipboard instead of writing to the remote host clipboard.

## [0.9.8] — 2026-05-19

### Fixed
- Restored the full tokenized Studio URL inside SSH tunnel hints so the local browser URL remains visible even when only the latest notification is shown.

## [0.9.7] — 2026-05-19

### Added
- Added Focus support for interactive HTML previews, using the existing sandboxed preview iframe in-place so form input and script state survive focus/unfocus.

### Changed
- `/studio` launched over SSH now skips opening the remote host browser by default, prints a local tunnel hint instead, and keeps local/non-SSH browser auto-open behavior unchanged. Use `/studio --open-remote` to request the previous remote-browser behavior.
- Moved the HTML preview Focus control next to the preview title to match PDF Focus placement.

## [0.9.6] — 2026-05-19

### Changed
- Cleaned up Studio REPL output handling: the raw tmux mirror now remains raw while REPL Studio and `studio_repl_send` results hide Studio's temp-file submission wrappers.
- Made REPL Studio session-scoped, so switching between Python, R, Julia, and other tmux sessions no longer mixes their clean records, and reloads can recover Studio-sent entries while the Studio server is still running.
- Refined Literate send so **Send selection/chunks** runs the selection, current fenced chunk, or all compatible chunks when the cursor is outside a chunk.
- Reworked REPL-mode editor controls so REPL send actions sit on their own row, show their shortcut, and **Run editor text** is visually secondary because it sends to Pi rather than the REPL.
- Normalised dropdown/menu styling in the refreshed UI so selects and custom menu triggers use neutral hover/open states instead of inconsistent accent borders or fills.

### Added
- Added **More → Copy attach command** in the REPL pane to copy a `tmux attach -t <session>` command for the active REPL session.

### Fixed
- R REPL parse errors no longer expose Studio's internal `.__pi_studio_code` parse wrapper.

## [0.9.5] — 2026-05-17

### Added
- Expanded Studio **Quiz me** scope to current file, folder, and repo contexts, with bounded source collection, context path support, optional focus guidance, and code-focused source prioritisation for implementation-oriented quizzes.

### Changed
- Folder/repo quizzes now exclude the current editor text by default unless **Include current editor text as an anchor** is enabled.
- Quiz generation and answer checking now retry malformed JSON responses with stricter JSON-only instructions and thinking disabled on retry, without adding new runtime dependencies.
- **Close** now discards the active quiz, while **Minimize**, outside-click, and Escape preserve it for resume.

## [0.9.4] — 2026-05-16

### Added
- Added first-cut Studio **Quiz me** support from the Review menu, with editor/selection scope, audience angle, quiz thinking controls, one-question-at-a-time answer checking, tutor discussion, Markdown/math-rendered cards, and minimize/resume behavior.

## [0.9.3] — 2026-05-16

### Changed
- Simplified the global Zen button label to text-only (`Zen` / `Exit Zen`).
- Removed the visible Fresh/Classic UI toggle; Studio now keeps the refreshed UI by default, with the legacy layout still available only via `?uiRefresh=0` for now.

## [0.9.2] — 2026-05-16

### Added
- Added a global **Zen** / **Exit Zen** toggle that hides secondary Studio chrome while preserving the current pane layout and panel focus state.
- Added a Focus action for explicit `studio-pdf` preview cards, opening the embedded PDF in a larger Studio overlay with optional browser fullscreen.

### Fixed
- HTML export no longer lets Pandoc's standalone template/CSS leak into the exported document for local-resource previews, fixing narrow/mobile-like exports for larger documents with embedded assets.
- HTML/PDF export subprocess handling now uses bounded output capture and explicit timeout paths without truncating successful embedded-asset HTML renders.
- PDF Focus now works from response previews before the same card has been rendered in editor preview, and its controls use theme-consistent focus/fullscreen icons.

## [0.9.1] — 2026-05-15

### Added
- Added `studio_repl_status` and `studio_repl_send` tools so the agent can inspect and send code to the active Studio REPL without improvising raw tmux commands.

### Changed
- Studio REPL sends for Python/IPython, Julia, R, GHCi, and Clojure now use runtime-specific control files instead of pasting multiline code directly, reducing quoting and indentation failures.
- The REPL pane now treats **REPL Studio** as the clean primary interaction record, with the raw tmux mirror secondary and collapsed by default.
- Renamed Scratch send to Raw send, alongside Literate send, and clarified that **Add note** records prose through the Literate send workflow.
- REPL polling now skips UI re-renders when the captured transcript/session state has not changed, reducing hover flicker in the REPL controls.
- REPL Studio entries now use a compact terminal-style prompt/output layout instead of card-style Code/Output sections, include startup banner text when available, and `studio_repl_send` broadcasts the actual submitted code so Pi-driven REPL work appears in the clean record.
- Reduced REPL pane chrome by hiding duplicate session status lines, avoiding prominent implementation-detail send notices, and moving REPL Studio export/edit actions below the main REPL Studio box.
- REPL Studio entries are now persisted in browser local storage so the clean record survives page refreshes while the Studio server/session is still running.
- **Run editor text** active-REPL context now tells the agent to use `studio_repl_send` for code execution.

## [0.9.0] — 2026-05-14

### Added
- Added an optional tmux-backed **REPL** right-pane view for Shell, Python, IPython, Julia, R, GHCi, and Clojure sessions.
- Added **Send to REPL** with `Cmd/Ctrl+Shift+Enter`, sending the editor selection or full editor text in Scratch mode.
- Added Literate send mode for Markdown documents, including current/selected fenced-code chunk sending, explicit **Run all chunks**, prose journaling, and runtime-compatible chunk filtering.
- Added a compact REPL journal that records notes, sent code, runtime/session metadata, and captured output, with copy, Markdown export, load-into-editor, and PDF/HTML export support.
- Added Studio-owned REPL session controls for start/attach, creating additional sessions of the same runtime, stopping sessions, and interrupting stuck prompts.
- Added lightweight syntax highlighting for REPL transcript prompt input and journal code entries.

### Changed
- **Run editor text** now includes active REPL identity when the REPL pane is active so prompts can refer to “the active REPL”.
- The REPL toolbar keeps common controls visible and tucks advanced/session/literate actions under **More**.

### Fixed
- Python/IPython multiline sends now include a final blank line so pasted suites such as `for` blocks execute cleanly.
- The editor now handles `Tab` / `Shift+Tab` for indentation while focused.

## [0.8.4] — 2026-05-14

### Added
- Working view now renders image outputs from tools such as `read`, including bounded image previews in saved Working history.
- Rendered blockquotes now have hover/focus copy buttons that copy the quote text without Markdown `>` markers.

## [0.8.3] — 2026-05-13

### Changed
- Updated package, README, and UI wording to describe the feature as interactive HTML preview.

### Fixed
- **Open new editor** now opens a blank companion editor when the current editor is empty.
- PDF export now preserves Pandoc YAML front matter while applying Studio Markdown transforms and lets Markdown documents with `header-includes` control their own LaTeX preamble, fixing exports that use YAML-defined commands such as `\firstpageletterhead`.
- Reduced scroll snap-back after using browser Find by preserving Studio pane scroll positions during pane activation.

## [0.8.2] — 2026-05-13

### Changed
- Improved dark-theme contrast for Studio dropdown arrows and the interactive HTML preview zoom percentage by using the stronger Studio info text colour token.

## [0.8.1] — 2026-05-13

### Added
- Added first-cut interactive HTML preview for straight, unfenced HTML in Studio preview panes, rendered in a sandboxed iframe with inline scripts enabled, network requests blocked by CSP, fit/capped sizing, and toolbar zoom controls; HTML export preserves authored HTML previews instead of converting them through Markdown.

## [0.8.0] — 2026-05-12

### Added
- Added first-cut standalone HTML export for Studio previews, including `/studio-html <path>` and a right-preview PDF/HTML export menu.
- `/studio-pdf` and `/studio-html` without a path now export the last model response to timestamped files.
- The Working view now keeps bounded in-memory snapshots for completed responses and follows the selected response when cycling response history.

## [0.7.0] — 2026-05-06

### Added
- Added explicit `studio-pdf` fenced blocks that render token-protected local PDFs in Studio preview cards.
- Added an **Open new editor** action that opens a detached copy of the current editor text in a new editor-only Studio view.
- Documented Studio Markdown asset paths and `studio-pdf` syntax in the README.

### Changed
- Hid response-sync badges in editor-only Studio views, simplified editor action labels, and slightly strengthened refreshed-layout focus icons.

## [0.6.10] — 2026-05-04

### Fixed
- SSH tunnel hints now include the full tokenized Studio URL directly so the token remains visible even when the terminal only shows the latest notification.

## [0.6.9] — 2026-05-01

### Changed
- Blank Studio launches now open the right pane on **Response (Preview)** by default, while file-backed launches still open on **Editor (Preview)**.

## [0.6.8] — 2026-05-01

### Changed
- Sharpened rendered and raw Markdown links, bare URLs, list markers, and sync/history-style badges so low-contrast theme tokens remain readable in Studio.
- Softened the bundled `pi-studio-light` theme surfaces to reduce pure-white glare and large-surface contrast.

## [0.6.7] — 2026-04-30

### Changed
- Sharpened Markdown quote markers, fenced-code fence lines, rendered blockquote borders/text, and Studio badge text so they remain legible across darker custom themes.

## [0.6.6] — 2026-04-30

### Changed
- Studio now opens the right pane on **Editor (Preview)** by default for file-backed and blank launches, while last-response launches still open on the response preview.

## [0.6.5] — 2026-04-30

### Changed
- Working view output blocks now show a compact 50-line preview by default with per-block **Show full** / **Collapse** controls for longer thinking, responses, and tool input/output.

## [0.6.4] — 2026-04-29

### Fixed
- Fixed `@`-selected quoted file paths such as `@"folder/file.md"` so Studio commands strip the `@` prefix and surrounding quotes before resolving the file.
- `/studio --status` now prints the full tokenized Studio URL, and SSH tunnel hints explicitly say to preserve the `?token=...` parameter.

## [0.6.3] — 2026-04-29

### Changed
- Polished rendered code blocks so ordinary code text uses normal foreground, Python function definitions keep function-name highlighting, and fenced-block borders are softened to better match theme intent.
- Slightly sharpened footer metadata and shortcut text for better readability across darker custom themes.

## [0.6.2] — 2026-04-29

### Changed
- Polished refreshed Studio theme surfaces so light-mode header actions, scratchpad panels, response-history badges, and editor surfaces are more consistent.
- Softened overly sharp derived borders in high-contrast themes while preserving theme hue and tightened secondary info text contrast in comment, outline, and scratchpad panels.

## [0.6.1] — 2026-04-29

### Added
- Added independent editor and response text-size controls, persisted locally and available in both full Studio and editor-only views.
- Added optional `pi-studio-dark` and `pi-studio-light` package themes tuned for Studio's browser workspace.

### Changed
- Improved theme adaptation for Studio surfaces, borders, Markdown/code colours, light/dark detection, and softer active-pane borders across bundled and custom pi themes.
- Footer model/session/context metadata now keeps context usage visible by truncating longer model/session labels first, with full working-directory details available in hover text.

## [0.6.0] — 2026-04-27

### Added
- The comments rail now includes **Comments → prompt**, which turns non-empty local comments into an editor prompt with line anchors and file labels when available.

### Changed
- The refreshed Studio layout is now the default, with the classic layout still available via the footer UI switch or `?uiRefresh=0`.
- Working-view tool output now replaces image/base64 payloads with compact placeholders instead of dumping raw image data.

### Fixed
- Queued steering now updates Studio's active effective-prompt metadata so response history and prompt loading reflect the original run plus steering messages.
- Newly arrived responses now force the right response pane to reset to the top, while editor-preview/document views still preserve scroll.

## [0.5.59] — 2026-04-27

### Added
- Added an opt-in refreshed Studio layout, available via the footer UI switch or `?uiRefresh=1`, while keeping the classic layout as the default.
- Added refreshed layout support for editor-only Studio mode.

### Changed
- Tuned refreshed pane headers, toolbar grouping, focus controls, dropdown labels, queue steering sizing, and preview export styling.

## [0.5.58] — 2026-04-24

### Added
- Rendered Markdown/editor previews now add small copy controls to code/fenced-content blocks so block contents can be copied directly from the preview.
- The local comments rail now includes a **Delete all** action for clearing all comments attached to the current document or draft without removing inline `[an: ...]` annotations from the editor text.

## [0.5.57] — 2026-04-20

### Changed
- The inserted annotated-reply scaffold now renders more cleanly in Markdown preview, using `annotated reply: below` plus a short metadata list instead of relying on hard line-break spacing.
- Local review-note comment boxes now use normal multiline textarea behavior, so `Enter` inserts a newline while edits continue saving automatically as you type.

### Fixed
- Markdown preview now preserves standalone LaTeX math definition lines such as `\newcommand`, `\def`, and `\DeclareMathOperator` so custom math macros/operators can work in Markdown documents instead of showing up as literal preview text.
- Markdown PDF export now moves standalone LaTeX math definition lines into the generated PDF preamble when needed, avoiding LaTeX errors like `Can be used only in preamble` for commands such as `\DeclareMathOperator`.
- Annotated-reply header detection now accepts both the older `annotated reply below:` form and the newer `annotated reply: below` form when removing/reapplying the scaffold.

## [0.5.56] — 2026-04-15

### Removed
- Removed Studio's standalone npm update checker and footer update badge now that package update tracking is handled in pi.

### Fixed
- Studio now always prints its localhost URL even when automatic browser open fails, and SSH sessions get a localhost-only port-forwarding hint instead of needing non-local binding.

## [0.5.54] — 2026-04-13

### Fixed
- Markdown editor-preview comment mapping now keeps standalone markdown image blocks aligned with rendered preview figures, preventing later preview comment targets from drifting after figures.
- Rendered Markdown fenced code blocks now once again support preview-side text-selection comments.

## [0.5.53] — 2026-04-10

### Added
- Studio now includes a live right-pane **Working** view for following current model/tool activity as it streams.
- **Working** includes `All` / `Thinking` / `Tools` filters plus **Load visible into editor** and **Copy visible** actions.
- Markdown preview/PDF regression coverage now includes preservation of literal LaTeX prose commands such as `\cite{...}` and `\ref{...}`.

### Changed
- The former standalone right-pane **Thinking** mode has been folded into **Working**.
- Working status/summary chips are quieter and read more like status labels than action buttons.

### Fixed
- Markdown preview and PDF export now preserve literal LaTeX prose commands like `\cite{...}` and `\ref{...}` instead of silently dropping them outside math/code contexts.
- Working-pane interaction handlers now survive response-pane replacement, so filters/actions keep working and scrolling up can pause live auto-follow until you return near the bottom.

## [0.5.52] — 2026-04-09

### Added
- Studio now includes a docked **Outline** rail for the current editor text, with clickable structure entries that jump in the raw editor and, when possible, reveal the matching preview location.

### Changed
- Outline scanning now provides initial structure support for Markdown headings, LaTeX sectioning commands and references, Python classes/functions, JavaScript/TypeScript classes and functions, Julia modules/structs/functions/macros, Bash functions, and diff file/hunk structure.
- Standalone preview-to-editor jumps now keep the raw-editor selection focused more reliably, so the left-side highlight persists more like comment-card jumps.

### Fixed
- The **Outline** button now only shows its active styling while the outline rail is actually open.

## [0.5.51] — 2026-04-09

### Added
- Raw-editor selection actions now also include a transient **Jump** control beside **Comment** when the right pane is showing **Editor (Preview)**, so editor selections can reveal the corresponding preview location without creating a local comment first.

### Changed
- Selection-time **Comment** / **Jump** affordances are now more consistent across raw editor and preview: preview-side actions use a fixed top-right action area while remaining transient and selection-only.
- Standalone selection **Jump** actions now use the same preview highlight/reveal treatment as comment-card jumps, making it easier to stay oriented after jumping in either direction.

### Fixed
- Preview-side selection actions are once again hidden unless an appropriate preview text selection is active.
- Code/text/diff preview selection mapping now preserves literal underscores in identifiers such as `add_subplot`, avoiding comment/jump failures caused by markdown-style underscore stripping.

## [0.5.50] — 2026-04-09

### Added
- Editor-preview comments now also work for minimal structured LaTeX preview content, including headings, prose paragraphs, references sections, and whole display equations.
- Preview-side selection affordances now include a transient **Jump** action alongside **Comment**, so you can reveal the corresponding raw-editor span without creating a local comment first.

### Fixed
- LaTeX preview comment mapping now follows Studio's rendered structure more closely, including title-block abstracts, loose prose after decorated display equations, bibliography/reference sections, and paragraph alignment around figures and rendered citation/reference text.
- Preview comment controls for display equations now anchor to the outer rendered equation frame, improving visibility and making preview jump targeting more reliable.

## [0.5.49] — 2026-04-09

### Fixed
- Markdown editor-preview comments are now substantially more robust on real pandoc-rendered documents, including smart punctuation and ellipsis normalization, mixed prose plus display-math sections, standalone display equations treated as whole units, MathJax fallback display math, standalone page-break commands, and raw-TeX commands that disappear from preview output.
- Preview comment block matching now avoids unsafe tiny substring fallbacks, so extra blank-line splits that create short paragraphs like `or` no longer derail later Markdown comment targets.
- Markdown HTML comments like `<!-- ... -->` are now stripped more consistently across both the main pandoc preview path and plain-markdown fallback rendering, including edge cases after unmatched inline backticks at line breaks.

## [0.5.48] — 2026-04-07

### Added
- Editor-preview comments now also work for code, plain-text, and diff files using line-based preview selection anchors, so code/text review can use the same local comments workflow as Markdown preview.

### Fixed
- LaTeX editor preview now correctly treats `.tex`/LaTeX editor content as LaTeX in preview even when the document is only a fragment rather than a full `\documentclass` wrapper.
- Ordinary response preview no longer flips into LaTeX mode just because quoted LaTeX commands like `` `\\documentclass` `` or `` `\\begin{document}` `` appear in a normal response.

### Changed
- LaTeX preview comments remain disabled for now; the earlier heuristic preview-side mapping attempts were removed in favor of keeping the rendering fixes and waiting for a more pipeline-grounded LaTeX comment design.

## [0.5.47] — 2026-04-07

### Changed
- Raw-editor and editor-preview commenting now feel more unified: both surfaces use a contextual **Comment** action for selected text, while the dock footer keeps a de-emphasised **Line comment** fallback for current-line comments in **Editor (Raw)**.
- Preview-side **Comment** affordances now focus the new comment textarea more reliably after creation, including when the comments rail has to open.
- Clicking comment **Jump** now suppresses the raw-editor selection **Comment** pill for that programmatic selection, so jump-to-highlight does not look like a fresh comment prompt.

## [0.5.46] — 2026-04-07

### Added
- Studio comments can now be created directly from selected text in both **Editor (Raw)** and **Editor (Preview)** via a lightweight contextual **Comment** action, so commenting feels more consistent across editing and reading surfaces.

### Changed
- Preview-side commenting is now selection-only: the transient **Comment** action appears only for active preview text selections, instead of leaving persistent preview comment markers in the right pane.
- The dock footer comment fallback in **Editor (Raw)** is now de-emphasised and renamed to **Line comment**, making the main comment model selection-first while still keeping a quick current-line option.
- Comment **Jump** now also reveals and briefly highlights the matching location in the right pane when it is showing **Editor (Preview)**.
- Preview comment anchoring is now more robust for rendered Markdown with thematic breaks and later blocks in longer documents.

## [0.5.45] — 2026-04-05

### Added
- Studio now has local **Comments** for editor documents and drafts. Comments can be created from the current selection/line, shown in a docked side-by-side comments rail, jumped to, edited, deleted, and kept out of the document text by default.
- **Editor (Raw)** now shows subtle comment gutter markers for lines with anchored comments, making it easier to spot commented regions and reopen the related comment from the editor surface.
- Comments can now be toggled into inline `[an: ...]` annotations per comment or in bulk without deleting the underlying local comment.

### Changed
- Studio scratchpad persistence is now backed by extension-side local state instead of browser-port-scoped storage alone, so scratchpad text follows the current document identity more coherently: file-backed documents reliably keep their own scratchpads across refreshes and Pi restarts, while unsaved/blank drafts get their own separate draft-scoped scratchpads instead of sharing one global blank scratchpad across Studio views.
- Studio draft-scoped scratchpads/comments now survive same-tab browser refreshes more reliably, and the **Editor origin** badge is now clickable so you can **Reset origin** into a fresh draft while carrying the current local scratchpad/comments forward.
- Studio browser-tab favicon experiments now use a simpler `π`-only state treatment again: idle uses the current theme text colour, running switches the `π` to warn/amber, completed/ready attention switches it to ok/green, connecting uses the accent colour, disconnected uses the error colour, and the title attention text keeps its leading `●` marker for clearer completion notification in the tab text.
- Studio browser-tab activity titles now distinguish direct model generation (`Thinking…`) from reply/critique phases more clearly and fall back to `Working…` for generic busy states.

## [0.5.44] — 2026-04-03

### Changed
- Studio browser tabs now show live browser-side activity state during Studio-owned work, including prefixes like `Running…`, `Responding…`, `Critiquing…`, or `Compacting…`, instead of only changing on completion.
- Studio favicons now use a clearer browser-side status badge: ready/completed states use a green circular badge, while active running states use an amber hollow ring so busy vs finished is easier to distinguish at a glance without relying on animation.
- Studio raw editor now has an optional line-number gutter, intended as a lightweight navigation aid when working in **Editor (Raw)** before switching back to preview.
- Studio editor controls now use a single combined **Syntax highlight** selector with `Off` plus all supported languages, replacing the separate highlight on/off and language selectors.

## [0.5.43] — 2026-04-01

### Changed
- Preview-side fenced code blocks now soft-wrap long lines by default instead of only wrapping `text`/`plaintext` fences, so Markdown code examples, shell snippets, and diffs are easier to read without horizontal scrolling.

## [0.5.42] — 2026-03-31

### Added
- Studio now includes a **Refresh from disk** action for file-backed documents, including files originally opened from disk and documents later saved to disk from Studio.

### Changed
- `/studio-pdf` section, subsection, and deeper heading styling is now more robust for larger-font exports: headings avoid awkward hyphenation, paragraph-level headings (`####`) render cleanly, callout title badges scale better with larger body font sizes, and exported code blocks now use a subtle shaded background.

### Fixed
- Re-selecting the same file in **Load file content** now reloads it reliably instead of sometimes doing nothing.
- `/studio-pdf` now supports LaTeX `[H]` float placement in exported documents.
- Response preview now resets to the top more reliably for genuinely new replies, while keeping editor preview behavior unchanged.

## [0.5.41] — 2026-03-30

### Changed
- `/studio-pdf` PDF callouts now render with a slightly stronger visual treatment in exported PDFs, including per-kind colours and a more obvious title badge, while staying page-break-friendly.

### Fixed
- `/studio-pdf` fenced Quarto-style callouts that end with lists now keep their marker paragraphs separate during Pandoc processing, avoiding malformed LaTeX such as callouts closing inside the final list item.

## [0.5.40] — 2026-03-30

### Changed
- Studio editor highlighting now keeps plain text in code files closer to the normal editor foreground while preserving a distinct markdown-code tint for inline backticks and unlabeled fenced blocks.
- Language-aware Studio syntax highlighting for code files and labeled fenced code blocks is now a bit richer, with additional highlighting for function-like identifiers, type/class-like names, and a few language-specific constructs such as decorators or macros.

## [0.5.39] — 2026-03-30

### Added
- Studio now supports the familiar `Cmd/Ctrl+S` shortcut for saving editor content.

### Changed
- `Cmd/Ctrl+S` now triggers **Save editor** when a direct save path is available, and falls back to **Save editor as…** otherwise.
- Save button tooltips and the footer shortcut hint now advertise the save shortcut explicitly.

## [0.5.38] — 2026-03-29

### Added
- Studio now supports `/studio-editor-only` for opening additional editor/preview companion views from the same Pi session, without taking over the main full Studio workspace.
- Studio now supports `/studio-replace` for explicitly replacing the current full Studio view while leaving editor-only views open.

### Changed
- Full Studio is now treated as a singleton per Pi session: `/studio` opens the canonical full workspace, while attempts to open another full Studio now guide you toward `/studio-replace` or `/studio-editor-only` instead of silently invalidating the existing full Studio tab.
- README/help text and Studio status/warning messages now describe the updated full-vs-editor-only session model more clearly.

### Fixed
- Editor-only Studio views now hide remaining critique/history controls, including the critique-focus dropdown, and keep their WebSocket mode metadata aligned with the server-side full/editor-only view tracking.

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

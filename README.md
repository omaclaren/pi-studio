# pi-studio

Experimental extension for [pi](https://github.com/badlogic/pi-mono) that opens a local browser workspace for annotating model responses/files, running edited prompts, and requesting critiques.

## Screenshots

**Markdown workspace — dark** (syntax-highlighted editor + rendered preview with Julia code block, inline math, blockquotes)

![Dark workspace](./assets/screenshots/dark-workspace.png)

**Markdown workspace — light**

![Light workspace](./assets/screenshots/light-workspace.png)

**Math rendering — dark** (LaTeX source → MathML: PDEs, matrices, display equations)

![Dark math](./assets/screenshots/dark-math.png)

**Structured critique — dark** (assessment + numbered critiques with rendered math, "Edited since response" sync badge)

![Dark critique](./assets/screenshots/dark-critique.png)

**Math rendering — light**

![Light math](./assets/screenshots/light-math.png)

**Mermaid diagrams — dark** (fenced mermaid block → rendered flowchart with theme-aware colors)

![Dark mermaid](./assets/screenshots/dark-mermaid.png)

**Code mode — dark** (TypeScript file loaded with language auto-detected from extension)

![Dark code mode](./assets/screenshots/dark-code-mode.png)

**Code mode — light**

![Light code mode](./assets/screenshots/light-code-mode.png)

**Focus mode — dark** (editor pane full-screen, `Cmd/Ctrl+Esc` or `F10` to toggle, `Esc` to exit)

![Dark focus mode](./assets/screenshots/dark-focus-mode.png)

## Features

- Single workspace: Editor (left) + Response (right)
- **Run editor text** sends editor content as-is
- **Insert annotation header** adds/updates annotated-reply scaffold
- **Critique editor text** requests structured critique (auto/writing/code focus)
- Response load helpers:
  - non-critique: **Load response into editor**
  - critique: **Load critique notes into editor** / **Load full critique into editor**
- File/editor actions: **Save editor as…**, **Save editor**, **Load file content**, **Send to pi editor**, **Load from pi editor**
- View toggles: panel header dropdowns for `Editor (Raw|Preview)` and `Response (Raw|Preview) | Editor (Preview)`
- **Editor Preview in response pane**: side-by-side source/rendered view (Overleaf-style) — select `Right: Editor (Preview)` to render editor text in the right pane with live updates
- Preview mode supports MathML equations and Mermaid fenced diagrams
- **Language-aware syntax highlighting** with selectable language mode:
  - Markdown (default): headings, links, code fences, lists, quotes, inline code
  - Code languages: JavaScript, TypeScript, Python, Bash, JSON, Rust, C, C++, Julia, Fortran, R, MATLAB, LaTeX, Diff
  - Keywords, strings, comments, numbers, and variables highlighted using theme syntax color tokens
  - **Diff highlighting**: added/removed lines shown with green/red backgrounds in both raw and preview modes
  - Language auto-detected from file extension on file load; manually selectable via `Lang:` dropdown
  - Applies to both editor Raw view (highlight overlay) and fenced code blocks in markdown
  - Preview mode renders syntax-highlighted code when a non-markdown language is selected
- **LaTeX file support**: `.tex`/`.latex` files detected by content, rendered via pandoc with proper title block (title, author, date, abstract) styling
- **Diff file support**: `.diff`/`.patch` files rendered with coloured add/remove line backgrounds
- **Image embedding**: images in markdown and LaTeX files embedded as base64 data URIs via pandoc `--embed-resources`, with no external file serving required
- **Working directory**: "Set working dir" button for uploaded files — resolves relative image paths and enables "Save editor" for uploaded content
- **Live theme sync**: changing the pi theme in the terminal updates the studio browser UI automatically (polled every 2 seconds)
- Separate syntax highlight toggles for editor and response Raw views, with local preference persistence
- Keyboard shortcuts: `Cmd/Ctrl+Enter` runs **Run editor text** when editor pane is active; `Cmd/Ctrl+Esc` / `F10` toggles focus mode; `Esc` exits focus mode
- Footer status reflects Studio/terminal activity phases (connecting, ready, submitting, terminal activity)
- Theme-aware browser UI derived from current pi theme
- View mode selectors integrated into panel headers for a cleaner layout

## Commands

| Command | Description |
|---------|-------------|
| `/studio` | Open studio with last assistant response (fallback: blank) |
| `/studio <path>` | Open studio with file preloaded |
| `/studio --last` | Force load from last assistant response |
| `/studio --blank` | Force blank editor start |
| `/studio --status` | Show studio server status |
| `/studio --stop` | Stop studio server |
| `/studio --help` | Show command help |

## Install

From GitHub:

```bash
pi install https://github.com/omaclaren/pi-studio
```

From npm:

```bash
pi install npm:pi-studio
```

Run without installing:

```bash
pi -e https://github.com/omaclaren/pi-studio
```

## Notes

- Local-only server (`127.0.0.1`) with rotating session tokens.
- One studio request at a time.
- Pi Studio supports both markdown workflows (model responses, plans, and notes) and code file editing with language-aware syntax highlighting.
- Studio URLs include a token query parameter; avoid sharing full Studio URLs.
- Preview panes render markdown via `pandoc` (`gfm+tex_math_dollars` → HTML5 + MathML), including pandoc code syntax highlighting, sanitized in-browser with `dompurify`. LaTeX files are rendered from `latex` input format with title block styling.
- Images referenced in markdown or via `\includegraphics` in LaTeX are embedded as base64 data URIs when a file path or working directory is available. For uploaded files without a working directory set, a notice suggests setting one.
- Preview markdown/code colors are mapped from active theme markdown (`md*`) and syntax (`syntax*`) tokens for closer terminal-vs-browser parity.
- Mermaid fenced `mermaid` code blocks are rendered client-side in preview mode (Mermaid v11 loaded from jsDelivr), with palette-driven defaults for better theme fit.
- If Mermaid cannot load or a diagram fails to render, preview shows an inline warning and keeps source text visible.
- Preview rendering normalizes Obsidian wiki-image syntax (`![[path]]`, `![[path|alt]]`) into standard markdown images.
- Install pandoc for full preview rendering (`brew install pandoc` on macOS).
- If `pandoc` is unavailable, preview falls back to plain markdown text with an inline warning.

## License

MIT

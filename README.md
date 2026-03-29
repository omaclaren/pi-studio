# pi-studio

Extension for [pi](https://pi.dev) that opens a local two-pane browser workspace for working with prompts, responses, Markdown and LaTeX documents, code files, and other common text-based files side by side. Annotate responses and files, write, edit, and run prompts, browse prompt and response history, request critiques, and use live preview for code, Markdown, and LaTeX.

## Screenshots

**Dark**

![Pi Studio workspace (dark)](./assets/screenshots/dark-workspace.png)

**Light**

![Pi Studio workspace (light)](./assets/screenshots/light-workspace.png)

## What it does

- Opens a two-pane browser workspace: **Editor** (left) + **Response/Thinking/Editor Preview** (right)
- Supports one canonical full Studio view per Pi session, plus additional editor-only companion views when you just want extra editing/preview surfaces
- Runs editor text directly, or asks for structured critique (auto/writing/code focus)
- Includes a local persistent scratchpad for quick notes you want to keep out of the main editor until you're ready to copy or insert them
- Browses response history (`Prev/Next/Last`) and loads either:
  - response text
  - critique notes/full critique
  - assistant thinking (when available)
  - the prompt that generated a selected response
- Supports an annotation workflow for `[an: ...]` markers:
  - inserts/removes the annotated-reply header
  - shows/hides annotation markers in preview
  - strips markers before send (optional)
  - saves `.annotated.md`
- Renders Markdown/LaTeX/code previews (math + Mermaid), theme-synced with pi
- Exports right-pane preview as PDF (pandoc + LaTeX)
- Exports local files headlessly via `/studio-pdf <path>` to `<name>.studio.pdf`
- Shows model/session/context usage in the footer, plus a compact-context action

## Commands

| Command | Description |
|---|---|
| `/studio` | Open with last assistant response (fallback: blank) |
| `/studio <path>` | Open with file preloaded |
| `/studio --last` | Force last response |
| `/studio --blank` | Force blank editor |
| `/studio --status` | Show studio server status |
| `/studio --stop` | Stop studio server |
| `/studio --help` | Show help |
| `/studio-replace [path\|--blank\|--last]` | Replace the current full Studio view with a new full Studio view |
| `/studio-editor-only [path\|--blank\|--last]` | Open an editor-only Studio view; multiple editor-only views may be open at once |
| `/studio-current <path>` | Load a file into currently open Studio tab(s) without opening a new browser window |
| `/studio-pdf <path> [options]` | Export a local file to `<name>.studio.pdf` via the Studio PDF pipeline, with optional layout controls |

## Install

```bash
# npm
pi install npm:pi-studio

# GitHub
pi install https://github.com/omaclaren/pi-studio
```

Run once without installing:

```bash
pi -e https://github.com/omaclaren/pi-studio
```

## Notes

- Local-only server (`127.0.0.1`) with tokenized Studio URLs.
- Full Studio is a singleton per Pi session: use `/studio` to open it, `/studio-replace` to explicitly replace it, and `/studio-editor-only` for extra editing/preview tabs that do not take over the full Studio session view.
- Studio is designed as a complement to terminal pi, not a replacement.
- Editor/code font uses a best-effort terminal-monospace match when the current terminal config exposes it; set `PI_STUDIO_FONT_MONO` to force a specific CSS `font-family` stack.
- Full preview/PDF quality depends on `pandoc` (and `xelatex` for PDF):
  - `brew install pandoc`
  - install TeX Live/MacTeX for PDF export
- Mermaid diagrams in exported PDFs may also require Mermaid CLI (`mmdc` / `@mermaid-js/mermaid-cli`) when you want diagram blocks rendered as diagrams rather than left as code.

## License

MIT

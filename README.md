# pi-studio

Experimental extension for [pi](https://github.com/badlogic/pi-mono) that opens a local browser workspace for annotating model responses/files, running edited prompts, and requesting critiques.

Status: experimental alpha.

## Screenshots

**Dark workspace**

![Dark workspace](./assets/screenshots/dark-workspace.png)

**Dark critique flow**

![Dark critique flow](./assets/screenshots/dark-critique.png)

**Light workspace**

![Light workspace](./assets/screenshots/light-workspace.png)

**Dark annotation editing**

![Dark annotation editing](./assets/screenshots/dark-annotation.png)

## Features

- Single workspace: Editor (left) + Response (right)
- **Run editor text** sends editor content as-is
- **Insert annotation header** adds/updates annotated-reply scaffold
- **Critique editor text** requests structured critique (auto/writing/code focus)
- Response load helpers:
  - non-critique: **Load response into editor**
  - critique: **Load critique (notes)** / **Load critique (full)**
- File actions: **Save As…**, **Save file**, **Load file in editor**
- View toggles: `Editor: Markdown|Preview`, `Response: Markdown|Preview`
- Optional markdown highlighting toggles for editor and response markdown views (including fenced-code token colors for common languages)
- Theme-aware browser UI based on current pi theme

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
- Studio URLs include a token query parameter; avoid sharing full Studio URLs.
- Preview panes render markdown via `pandoc` (`gfm+tex_math_dollars` → HTML5 + MathML), sanitized in-browser with `dompurify`.
- Preview rendering normalizes Obsidian wiki-image syntax (`![[path]]`, `![[path|alt]]`) into standard markdown images.
- Install pandoc for full preview rendering (`brew install pandoc` on macOS).
- If `pandoc` is unavailable, preview falls back to plain markdown text with an inline warning.
- Some screenshots may show the Grammarly browser widget. Grammarly is a separate browser extension and is not part of pi-studio, but it works alongside it.

## License

MIT

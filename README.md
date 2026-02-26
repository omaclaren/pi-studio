# pi-studio

Browser UI for structured critique workflows in pi.

## Install

```bash
cd ~/.pi/agent/extensions/pi-studio
npm install
```

Or as a package (when published):

```bash
pi install npm:pi-studio
```

## Usage

Start pi, then run:

```bash
/studio
```

Default behavior for `/studio`:
- loads the last assistant response if available
- otherwise starts blank

Open studio with a file preloaded (for terminal ↔ studio workflow):

```bash
/studio ./path/to/draft.md
```

Force startup mode:

```bash
/studio --last
/studio --blank
```

Optional commands:

```bash
/studio --status
/studio --stop
/studio --help
```

## Notes

- Local-only server (`127.0.0.1`) with rotating session tokens.
- One studio request at a time.
- Browser supports: Apply Document, Save As, Save Over (file-backed drafts), Send to pi editor, and Copy draft.
- Browser uses Markdown rendering via CDN (`marked`, `dompurify`).

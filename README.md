# Pi Studio: Feedback Workspace

Browser feedback workspace for two-way feedback workflows in pi (annotate + structured critique loops).

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

Force startup source:

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

## Workflow

Studio now uses a single always-on workspace:

- **Left pane (Editor):** edit/annotate working text.
- **Right pane (Response):** latest assistant response (normal reply or critique).

Top controls:
- **Send reply**: sends annotated-reply style prompt from current editor text.
- **Request critique** (+ focus): critiques current editor text and loads result into Response pane.
- **Pull latest** with optional `Follow latest: On|Off`.

Response actions:
- **Load latest response → Editor**
- **Load revised document** (when response includes a `## Document` section)
- **Copy response**
- **Load full critique package → Editor** (for structured critique responses)
- **Load clean revised document** (strips `{C#}` markers)

Additional behavior:
- independent pane view toggles (`Editor: Markdown|Preview`, `Right: Markdown|Preview`)
- editor sync badge (`No response loaded`, `In sync with response`, `Edited since response`)
- response badge with source + timestamp (`assistant response` / `assistant critique`)
- keyboard shortcuts: `Cmd/Ctrl+Esc` (or `F10`) toggles active-pane focus mode; `Esc` exits focus mode
- footer status includes explicit WS phase (`Connecting`, `Ready`, `Submitting`, `Disconnected`)

## Design docs

- Workflow spec: [`WORKFLOW.md`](./WORKFLOW.md)
- Backlog: [`TODO.md`](./TODO.md)
- Changes: [`CHANGELOG.md`](./CHANGELOG.md)

## Notes

- Local-only server (`127.0.0.1`) with rotating session tokens.
- Studio URLs include a token query parameter; avoid sharing full Studio URLs in screenshots/issues.
- One studio request at a time.
- Browser supports: Save As, Save Over (file-backed editor text), Send to pi editor, Send + Run (submit editor text directly to model), Copy editor, and response→editor load actions.
- Browser uses Markdown rendering via CDN (`marked`, `dompurify`).

# pi-studio

Browser UI for two-way feedback workflows in pi (annotate + structured critique loops).

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

## Tabs

Studio now uses two minimal tabs:

- **Annotate**: edit/annotate draft and **Send reply**.
- **Critique**: run **Generate critique** on current draft.

Tab behavior:
- explicit top-level tabs (**Annotate | Critique**)
- shared draft pane with `View: Markdown | Preview`
- optional latest-response tracking control: `Follow latest: On|Off` with `Pull latest`
- Critique → Annotate handoff actions:
  - **Send critique package to Annotate** (Assessment + Critiques + Document)
  - **Send clean document to Annotate** (Document with `{C1}` markers stripped)
- footer status includes explicit WS phase (`Connecting`, `Ready`, `Submitting`, `Disconnected`)

## Design docs

- Workflow spec: [`WORKFLOW.md`](./WORKFLOW.md)
- Backlog: [`TODO.md`](./TODO.md)
- Changes: [`CHANGELOG.md`](./CHANGELOG.md)

## Notes

- Local-only server (`127.0.0.1`) with rotating session tokens.
- Studio URLs include a token query parameter; avoid sharing full Studio URLs in screenshots/issues.
- One studio request at a time.
- Browser supports: Save As, Save Over (file-backed drafts), Send to pi editor, Copy draft, and tab handoff actions between Annotate/Critique.
- Browser uses Markdown rendering via CDN (`marked`, `dompurify`).

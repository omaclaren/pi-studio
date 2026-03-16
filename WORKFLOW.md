# pi-studio workflow/spec note

## Goal

Keep Studio simple while supporting both loops:

1. **User → model feedback** (annotated reply)
2. **Model → user critique** (structured critique package)

Studio uses a **single workspace**:
- left pane: **Editor**
- right pane: **Response / Thinking / Editor Preview**

---

## Core actions

## 1) Insert annotated reply header (optional prep)

Adds/updates an `annotated-reply` compatible scaffold in the editor:

```md
annotated reply below:
original source: <last model response | file <path> | studio editor>
annotation syntax: [an: your note]

---

<your text>
```

Studio does **not** auto-send this scaffold; it is an explicit editor transform.

## 2) Run editor text (plain send)

Sends current editor text to the model. If `Annotations: Hidden`, `[an: ...]` markers are stripped before send.

## 3) Critique editor text (structured review request)

Critiques current editor text and expects/handles structured output:
- `## Assessment`
- `## Critiques` with `**C1**`, `**C2**`, ...
- `## Document` with `{C1}`, `{C2}`, ... markers

---

## Response handling

By default, the right pane follows the latest assistant response, but Studio can also:
- browse older assistant responses via response history
- show **Thinking (Raw)** for the currently selected response when available
- show **Editor (Preview)** for the current editor text

When the selected response is structured critique, Studio enables additional helpers:
- **Load critique (notes)** (`## Assessment` + `## Critiques`)
- **Load critique (full)** (`## Assessment` + `## Critiques` + `## Document`)

For non-critique responses:
- **Load response into editor**

In Thinking view (when available):
- **Load thinking into editor**
- **Copy thinking text**

Otherwise, Studio supports copying the currently viewed response text.

---

## State model (minimal)

- `idle`
- `submitting`
- `error`

Rules:
- one in-flight request at a time
- preserve editor draft across all actions
- latest assistant message can be auto-followed or manually pulled

---

## Required UI elements

- Header actions: **Save As…**, **Save file** (file-backed), **Load file content**
- Header view toggles: `Left: Editor (Raw|Preview)`, `Right: Response (Raw|Preview) | Thinking (Raw) | Editor (Preview)`
- Preview mode uses server-side `pandoc` rendering (math-aware) with plain-markdown fallback when renderer is unavailable.
- Editor actions: **Insert/Remove annotated reply header**, **Annotations: On|Hidden**, **Strip annotations…**, **Run editor text**, **Critique editor text** (+ critique focus), **Send to pi editor**, **Copy editor text**, **Save .annotated.md**
- Response actions include `Auto-update response: On|Off`, **Fetch latest response**, response-history browse (`Prev/Next/Last`), **Load response into editor**, **Load response prompt into editor**, and thinking-aware load/copy actions when Thinking view is active
- Source badge: `blank | last model response | file <path> | upload`
- Response badge: `none | assistant response | assistant critique` (+ timestamp)
- Sync badge: shown only when the editor exactly matches the currently viewed response/thinking (`In sync with response | In sync with thinking`)
- Footer WS/status phases: `Connecting`, `Ready`, `Submitting`, `Disconnected`

---

## Escaping pitfalls (implementation note)

Studio is less fragile than before because browser JS/CSS now live in extracted client files, but `index.ts` still builds the HTML shell and injects boot/theme/source values. Incorrect escaping can still break Studio boot.

Rules of thumb:
- Prefer `JSON.stringify(value)` when injecting arbitrary text into boot data or script-adjacent HTML.
- Be careful with HTML attribute escaping for injected values.
- After touching the HTML shell / boot-data wiring in `index.ts`, do a `/studio` boot smoke test immediately.
- After touching `client/studio-client.js` or `client/studio.css`, smoke test the main workflows: boot, websocket connect/reconnect, file load, run/critique, preview, and response history.

## Acceptance criteria

1. `/studio --last` opens with editor loaded and no required mode selection.
2. **Run editor text** respects annotation mode (`On` send as-is, `Off` strip `[an: ...]`) and returns response to right pane.
3. **Insert annotation header** updates the scaffold source metadata without duplicating headers.
4. **Critique editor text** runs on current editor text and returns structured package when model complies.
5. Structured critique helpers (`Load critique (notes)` / `Load critique (full)`) enable only when critique structure is present.
6. Loading response/critique back into editor never loses draft unexpectedly.
7. Terminal↔studio roundtrip remains intact (save, editor handoff, reopen).

---

## Non-goals (for now)

- Multi-document tabs
- Multi-user collaboration
- Heavy schema validation

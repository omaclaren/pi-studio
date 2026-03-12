# pi-studio workflow spec (v0.2 draft)

## Goal

Keep Studio simple while supporting both loops:

1. **User → model feedback** (annotated reply)
2. **Model → user critique** (structured critique package)

Studio uses a **single workspace** (no tab/mode switching):
- left pane: **Editor**
- right pane: **Response**

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

Right pane always shows the **latest assistant response** (reply or critique).

When response is structured critique, Studio enables additional helpers:
- **Load critique (notes)** (`## Assessment` + `## Critiques`)
- **Load critique (full)** (`## Assessment` + `## Critiques` + `## Document`)

For non-critique responses:
- **Load response into editor**

Always available:
- **Copy response**

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

- Header actions: **Save As…**, **Save file** (file-backed), **Load file in editor**
- Header view toggles: `Left: Editor (Raw|Preview)`, `Right: Response (Raw|Preview) | Editor (Preview)`
- Preview mode uses server-side `pandoc` rendering (math-aware) with plain-markdown fallback when renderer is unavailable.
- Editor actions: **Insert/Remove annotated reply header**, **Annotations: On|Hidden**, **Strip annotations…**, **Run editor text**, **Critique editor text** (+ critique focus), **Send to pi editor**, **Copy editor text**, **Save .annotated.md**
- Response actions include `Auto-update response: On|Off`, **Fetch latest response**, response-history browse (`Prev/Next/Last`), **Load response into editor**, and **Load response prompt into editor**
- Source badge: `blank | last model response | file <path> | upload`
- Response badge: `none | assistant response | assistant critique` (+ timestamp)
- Sync badge: shown only when the editor exactly matches the currently viewed response/thinking (`In sync with response | In sync with thinking`)
- Footer WS/status phases: `Connecting`, `Ready`, `Submitting`, `Disconnected`

---

## Escaping pitfalls (implementation note)

`index.ts` builds browser HTML as a TypeScript template string and embeds inline browser JavaScript. This creates multiple parse layers (TS string → HTML → JS), so incorrect escaping can break Studio boot (e.g. stuck at `Booting studio…`).

Rules of thumb:
- In embedded JS string literals authored from TS template context, use `\\n` (not `\n`) for runtime newlines.
- Escape regex backslashes for the embedding layer (`\\s`, `\\n`, `\\[`), so browser JS receives the intended regex.
- Prefer `JSON.stringify(value)` when injecting arbitrary text into inline script.
- After touching inline `<script>` sections in `index.ts`, do a `/studio` boot smoke test immediately.

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

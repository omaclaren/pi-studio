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

## 1) Insert annotation header (optional prep)

Adds/updates an `annotated-reply` compatible scaffold in the editor:

```md
annotated reply below:
original source: <last model response | file <path> | studio editor>

---

<your text>
```

Studio does **not** auto-send this scaffold; it is an explicit editor transform.

## 2) Run editor text (plain send)

Sends current editor text to the model unchanged.

## 3) Critique editor text (structured review request)

Critiques current editor text and expects/handles structured output:
- `## Assessment`
- `## Critiques` with `**C1**`, `**C2**`, ...
- `## Document` with `{C1}`, `{C2}`, ... markers

---

## Response handling

Right pane always shows the **latest assistant response** (reply or critique).

When response is structured critique, Studio enables additional helpers:
- **Load critique package into editor**
- **Load critique document (without markers)** (strips `{C#}` markers)

Always-available response helpers:
- **Load response into editor**
- **Load critique document (with markers)** (if `## Document` is present)
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

- Header actions: **Insert annotation header**, **Run editor text**, **Critique editor text** (+ critique focus), **Get latest response**, `Auto-update response: On|Off`
- Pane view toggles: `Editor: Markdown|Preview`, `Right: Markdown|Preview`
- Source badge: `blank | last model response | file <path> | upload`
- Response badge: `none | assistant response | assistant critique` (+ timestamp)
- Sync badge: `No response loaded | In sync with response | Edited since response`
- Footer WS/status phases: `Connecting`, `Ready`, `Submitting`, `Disconnected`

---

## Acceptance criteria

1. `/studio --last` opens with editor loaded and no required mode selection.
2. **Run editor text** sends the current editor content as-is and returns response to right pane.
3. **Insert annotation header** updates the scaffold source metadata without duplicating headers.
4. **Critique editor text** runs on current editor text and returns structured package when model complies.
5. Structured critique helpers enable/disable correctly.
6. Loading response/document back into editor never loses draft unexpectedly.
7. Terminal↔studio roundtrip remains intact (save, editor handoff, reopen).

---

## Non-goals (for now)

- Multi-document tabs
- Multi-user collaboration
- Heavy schema validation

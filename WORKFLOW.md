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

## 1) Send reply (annotated feedback)

Uses `annotated-reply` compatible prompt shape:

```md
annotated reply below:
original source: <last model response | file <path> | studio editor>

---

<annotated text>
```

## 2) Request critique (structured review request)

Critiques current editor text and expects/handles structured output:
- `## Assessment`
- `## Critiques` with `**C1**`, `**C2**`, ...
- `## Document` with `{C1}`, `{C2}`, ... markers

---

## Response handling

Right pane always shows the **latest assistant response** (reply or critique).

When response is structured critique, Studio enables additional helpers:
- **Load full critique package → Editor**
- **Load clean revised document** (strips `{C#}` markers)

Always-available response helpers:
- **Load latest response → Editor**
- **Load revised document** (if `## Document` is present)
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

- Header actions: **Send reply**, **Request critique** (+ focus), **Pull latest**, `Follow latest: On|Off`
- Pane view toggles: `Editor: Markdown|Preview`, `Right: Markdown|Preview`
- Source badge: `blank | last model response | file <path> | upload`
- Response badge: `none | assistant response | assistant critique` (+ timestamp)
- Sync badge: `No response loaded | In sync with response | Edited since response`
- Footer WS/status phases: `Connecting`, `Ready`, `Submitting`, `Disconnected`

---

## Acceptance criteria

1. `/studio --last` opens with editor loaded and no required mode selection.
2. **Send reply** sends annotated-reply scaffold and returns response to right pane.
3. **Request critique** runs on current editor text and returns structured package when model complies.
4. Structured critique helpers enable/disable correctly.
5. Loading response/document back into editor never loses draft unexpectedly.
6. Terminal↔studio roundtrip remains intact (save, editor handoff, reopen).

---

## Non-goals (for now)

- Multi-document tabs
- Multi-user collaboration
- Heavy schema validation

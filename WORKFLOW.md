# pi-studio workflow spec (v0.1 draft)

## Goal

Define a natural two-way feedback interface where:

1. **User → model** feedback on any model output is easy (annotate/reply workflow).
2. **Model → user** critique/revision workflow is structured when requested.

This spec keeps studio aligned with `pi-annotated-reply` while preserving the stronger critique loop.

---

## Principles

- **Default to low-friction.** If content is plain prose/code, user should annotate and submit immediately.
- **Structure only when useful.** Critique mode is explicit and constrained.
- **Stable handoff format.** Studio and terminal commands should produce compatible prompts.
- **Human-in-the-loop first.** User decisions are primary; model suggestions are optional.

---

## Modes

## 1) Annotate mode (default for general outputs)

Use when loaded content is a normal assistant response or file text.

### UX
- Left panel: editable source text.
- Right panel: simple guidance + optional quick templates.
- Primary action: **Submit annotation**.

### Prompt contract (compatible with `annotated-reply`)

```md
annotated reply below:
original source: <last model response | file <path> | studio draft>

---

<user-annotated text>
```

User can use any inline style (e.g. `[note]`, `[[question]]`, line comments).

---

## 2) Critique mode (structured review loop)

Use when user clicks **Critique** or when content is already in critique schema.

### Expected model format

- `## Assessment`
- `## Critiques`
  - `**C1** ...`, `**C2** ...`
- `## Document`
  - full doc with `{C1}`, `{C2}`, ... markers

### UX
- Right panel renders assessment + critique IDs.
- Left panel shows document with marker highlights.
- User records decisions (`accept/reject/revise/question`) per critique.
- Primary action: **Submit decisions**.

### Decision payload format

```md
[accept C1]
[reject C2: reason]
[revise C3: change request]
[question C4: clarification]
```

Optional global note at end.

---

## Mode selection rules

On load (`/studio`, `/studio --last`, `/studio <file>`):

1. If content has structured sections (`## Critiques` + `## Document`) → start in **Critique mode**.
2. Otherwise → start in **Annotate mode**.

User can manually switch modes anytime.

---

## State machine (minimal)

- `idle:annotate`
- `submitting:annotate`
- `idle:critique`
- `submitting:critique`
- `idle:decisions`
- `submitting:decisions`
- `error`

Rules:
- one in-flight request at a time.
- preserve unsent user text during mode switches.
- on response, transition based on detected structure.

---

## Required UI elements

- Mode toggle: **Annotate | Critique**
- Source badge: `blank | last model response | file <path> | upload`
- Footer status with clear phases (`Ready`, `Submitting…`, `Response received`, errors)
- Existing actions remain: Apply Document, Save As, Save Over, Send to pi editor, Copy

Optional next:
- unresolved critique counter
- quick decision buttons on critique IDs

---

## Acceptance criteria

1. `/studio --last` with plain assistant text opens in Annotate mode without format warning.
2. Submitting annotation sends annotated-reply compatible prompt and receives normal assistant response.
3. Clicking **Critique** on same text yields structured critique rendering when model complies.
4. Decision submission (`[accept C1]` etc.) produces revised response loop.
5. User can go back to Annotate mode and continue free-form feedback without losing draft.
6. Terminal↔studio roundtrip remains intact (save, editor handoff, reopen).

---

## Non-goals (for now)

- Multi-document tabs
- Multi-user collaboration
- Heavy schema validation or strict parser enforcement

---

## Implementation notes

- Reuse existing assistant text extraction + source tracking.
- Keep current WebSocket protocol; add `mode` in client state only initially.
- Maintain backward compatibility: existing critique requests still work unchanged.

# pi-studio workflow/spec note

This note describes the original single-editor workflow; it is not the current release backlog. See [ROADMAP.md](ROADMAP.md) for the active `0.9.60` networking/shortcut batch and planned `0.10.0` work. The future active-Prompt/editable-document model is recorded in [BUFFER-DESIGN.md](https://github.com/omaclaren/pi-studio/blob/main/BUFFER-DESIGN.md); buffer tabs and context transfer are not implemented yet.

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

Toggles an `annotated-reply` compatible scaffold in the editor. Studio's generated opener and metadata wording remain unchanged:

```md
annotated reply: below

- original source: <last model response | file <path> | studio editor>
- user annotation syntax: [an: your note]
- precedence: later messages supersede these annotations unless user explicitly references them

---

<your text>
```

Studio does **not** auto-send this scaffold; it is an explicit editor transform.

### Header recognition contract (local compatibility work; not yet released)

The parser accepts these **whole first lines**, case-insensitively:

- `annotations below`
- `annotations below:`
- `annotated reply: below`
- `annotated reply below:`

Each opener works with the known minimal Neovim block, the full Studio bullet metadata above, or the older plain metadata layout (`original source`, `user annotation syntax`, optional `precedence`, without bullet prefixes or a blank line after the opener). Bullet layouts require a blank line after the opener. Metadata order and the known syntax/precedence wording must match; arbitrary edited instructions are not silently consumed. The accepted syntax examples are `[an: note]` / `[an: your note]`, optionally backticked; the backticked form may carry Neovim's parenthetical below. Full legacy headers remain recognisable when **Strip annotations…** has removed their unbackticked hint.

The minimal Neovim block is:

```md
annotations below

- user annotation syntax: `[an: note]` (user comments on the accompanying selections)

---

```

All layouts require a blank line before the exact `---` divider and a blank line after it. LF and CRLF are accepted without normalising or trimming the remaining body. Source/precedence lines and a footer are not required for the minimal form, whose entire remaining text is body. A backticked syntax example is not an annotation.

Detection, toolbar summaries, toggling and header removal share the same parser. Prose mentions, opener prefixes, quoted/indented/fenced examples, and arbitrary later dividers do not count. An exact opener with an unknown or malformed following block prompts a warning and leaves the editor unchanged rather than adding a duplicate header.

Full source-bearing legacy wrappers retain their optional footer convention: only the exact terminal `\n\n--- end annotations ---\n\n` suffix (or its all-CRLF equivalent), outside a Markdown backtick/tilde fence, is removed. Quoted/indented/prose marker text and extra trailing whitespace are preserved. Minimal headers never remove a footer. Inserting Studio's usual wrapper preserves any pre-existing body marker; its generated footer is omitted if it would fall inside an unclosed fence, so toggling still preserves the body.

This compatibility change does not switch the installed Studio version or change Neovim's emitted wording. Deployment/release is a separate decision.

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
3. **Annotation header** recognises all supported openers without duplication; toggling preserves the body and refuses malformed leading header blocks.
4. **Critique editor text** runs on current editor text and returns structured package when model complies.
5. Structured critique helpers (`Load critique (notes)` / `Load critique (full)`) enable only when critique structure is present.
6. Loading response/critique back into editor never loses draft unexpectedly.
7. Terminal↔studio roundtrip remains intact (save, editor handoff, reopen).

---

## Non-goals for the single-editor `0.9.x` workflow

- Multi-document tabs (planned separately for `0.10.0`)
- Multi-user collaboration
- Heavy schema validation

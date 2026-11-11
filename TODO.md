# TODO

See [ROADMAP.md](ROADMAP.md) for the current status: `0.11.15` is released, and Studio is in a feature freeze from `0.11.9`, for use in normal work. [BUFFER-DESIGN.md](BUFFER-DESIGN.md) records the wider buffer architecture.

## During the freeze (from 0.11.9, 3 Nov 2026)

Fix only failures in normal use, lost data, effects on other people's processes or files, and security problems. Note anything else here for after the freeze.

Exception (4 Nov, Oliver): candidate 119, an opt-in `PI_STUDIO_URL_FILE` for programs that open Studio ([#7](https://github.com/omaclaren/pi-studio/issues/7)), and `/studio --copy-url` for people. Then candidate 120 (5 Nov, Oliver): Follow as one switch, and a WebKit scroll fix.

Known limits at `0.11.15`, none of them a hold:

- [ ] Homebrew bash 5.3: Ctrl+C while code runs leaves Studio waiting for that send. Earlier releases did the same; `/bin/bash` 3.2 and zsh complete. Catching SIGINT in the shell would fix it; decide whether Studio should set a trap in a person's shell.
- [ ] zsh in a narrow pane (about 40 columns or less): the record keeps Studio's loader line before the output. The output cleaner compares at most eight rows; match this send's loader whatever its length, and add a real narrow-zsh test.
- [ ] If Clear's acknowledgement is lost, the page keeps its request and its copy of the record until reload.
- [ ] Exported Markdown doesn't say when a session's record directory wasn't verified.
- [ ] The REPL pane's **More** menu is placed when it opens, not when the pane resizes while it's open.
- [ ] Saved files in the REPL pane (candidate 116's notes): a copy that keeps an earlier file's time stays with the entry whose time it carries; a link serves any recently shown version of its file; two entries still running can both show a file they both name until they finish; relative paths resolve against the REPL's current directory; and the file checks are synchronous, so an unresponsive volume would stall Studio.
- [ ] With pi-repl loaded too (candidate 118's notes): with mixed versions (Studio `0.11.10` with pi-repl `0.12.0`, or `0.11.9` with `0.12.1`) an entry can still be told twice, as before; a pi-repl report that takes over 3 seconds waits for the next result or run; an entry Studio told before pi-repl first answered (pi-repl loaded mid-conversation) may be told once more; and Studio's own report builder still drops the agent's own-send mark when even its smallest report is over the budget, which pi-repl fixed in `0.12.1`.
- [ ] The URL file and `--copy-url` (candidate 119's notes): on stop, the file is removed only if its contents are still this process's URL, which is a comparison, not file ownership; a crash or a failed removal leaves it, with a dead token, and a removal that fails at shutdown has no one to warn; a launch that waited for the browser across a restart still prints the old URL, though it no longer writes it; over SSH, Pi can't confirm the terminal took the copy (OSC 52); untested on native Windows.
- [ ] Negative scroll positions (candidate 120's notes): the background save keeps a WebKit bounce past a pane's top as the top, but a fresh workspace's first load and recovery's Keep current without a live client still pass a live position straight to the store, which refuses a negative one. Neither is the path Oliver hit; normalize those live inputs at their callers if it shows up.
- [ ] ASCII tab titles (candidate 121's notes): a PDF opened in its own tab is served as the PDF itself, so the browser chooses its title, possibly the PDF's own title, which can be non-ASCII. The same holds for a REPL image opened with **Open image** from its focus view (the raw `/repl-file`, where an SVG can carry its own `<title>`), and for pages Quarto serves that open in their own tab. An HTML export keeps its document's title, since it's the user's file. Only title text changes; page content keeps its characters.

## After the freeze

- [ ] Re-vendor pi-repl's `shared/repl-record-activity.js` and `REPL_SESSION_RECORD_PROTOCOL.md` from `v0.12.1` (with its fix for the own-send mark when no report fits), and confirm delivery in `before_provider_request` rather than `context_with_system`. Studio's side of the channel is in `0.11.10`.
- [ ] Say which Pi version Studio needs, in the README's requirements or as a warning at load on an older Pi. `context_with_system`, used since `0.11.7`, came in Pi 0.87.0; Studio is tested against 1.2.0. Not as a range in `package.json`: Pi installs extensions with peer dependencies ignored (`--legacy-peer-deps` or `--omit=peer`), and its loader asks for Pi's own packages as peer dependencies with a `*` range.
- [x] A GitHub page for pi-studio, like agent-repl's and agent-markdown-preview's: https://omaclaren.github.io/pi-studio/ (4 Nov).
- [ ] If wanted, a `/studio --url-file <path>` beside `PI_STUDIO_URL_FILE` (#7), for people who'd rather not set a variable.
- [ ] LFortran sends through pi-repl's helper, if wanted. Studio refuses to paste into that session now.
- [ ] Take pi-repl's generalised `repl-session-stop.js` and `repl-gnuplot-processes.js` with LFortran, if it comes.

## Earlier: opt-in prerelease

`0.10.0` (14 Oct) shipped the workspace by default and overtook the unchecked items in this section; they're kept as history.

The separately approved three-flag hosting scope supersedes the older toolbar-only boundary below: one editing owner per Document, registered new/text-file hosts, move/copy/reuse, atomic replacement and retained save/metadata decisions. Prompt remains anchored; linked views and role migration stay deferred. Validate a new exact package/private installation; old toolbar artifacts do not cover hosting.

- [x] Obtain approval for the bounded toolbar cleanup after the first alpha trial: **Add to Prompt** disclosure, destination-labelled **Open / load**, and help in menus/tooltips instead of permanent rows. Keep one Prompt/Document, annotations and existing operation semantics. No role-switching or multi-document expansion.
- [x] Validate and privately pack the earlier toolbar rebuild, preserving its artifact and evidence. Hosting was added afterward and requires its own exact package/private-install checks; the work remains uncommitted.

- [x] Bring the roadmap and implementation record up to date; write a bounded prerelease checklist. Documentation only, not approval to execute or publish it.
- [x] Trace the immediate pane-pointer → view-change scroll path and reproduce stale restoration in a bounded VM probe, with settled-frame and unchanged-view controls. The original helper is unchanged from `0.9.60`; triage itself made no product changes.
- [x] Implement the separately approved narrow pane-scroll ownership fix, regression-first: 29 new failing cases and 9 passing controls become 38 passing cases; all 240 focused tests and syntax/whitespace/runtime-boundary checks pass. Committed as `40d4462`; no renderer/CSS changes.
- [x] Complete bounded native confirmation on 2026-09-21 with dedicated Chrome Headless Shell 153: both timing windows reproduce in old default/two-buffer clients and pass with the fix; settled/same-view/unaffected-source controls pass. Trusted pane input plus controlled programmatic view timing, not a measurement of human gesture frequency. All trials backed up before disposal; process/port cleanup verified.
- [x] Rerun all 240 focused tests, normal typecheck and syntax/whitespace/runtime-boundary checks after browser cleanup. Full suite and supplemental check-JS were not rerun.
- [ ] Keep Oliver's blank-Working report open: bounded native view/buffer returns showed content before interaction, but no reproduction. Headless tab changes never made the page hidden; actual background-tab/visible-browser painting remains unverified. No speculative renderer/CSS fix.
- [x] With separate approval, checkpoint scroll code/tests as `40d4462`. Blank Working remains open; its documented limitation is accepted for local alpha preparation, not an implicit publication sign-off.
- [x] Approve bounded local alpha preparation; select unused `0.10.0-alpha.1` after querying npm. Preserve the tested fixed-slot UI; no role-switching implementation or extra toolbar rows.
- [ ] Complete the checklist against that candidate: public documentation, full tests/static/dependency checks, exact package audit, isolated fresh-install smoke and credential-free end-to-end trial. Keep results in new candidate-scoped evidence; further commits remain gated.
- [ ] Decide separately on publishing the verified alpha to npm `next`, pushing/tagging, or changing any installation/default. Keep ordinary Studio on `0.9.60` meanwhile.

No further broad review is scheduled by this list. Finish the fixed hosting scope and exact-artifact gates; explicit Prompt-role switching and parked prompts are later slices, not additions to this alpha.

## Implementation record

Counts below belong to their individual checkpoints, not a fresh full-release validation. Evidence for `7bdc891`: 718 recorded full-suite tests; 202 focused tests and typecheck/static checks freshly passed on 2026-09-20; 41 Brave checks and 29 Chrome-app + 12 Chrome Headless Shell checks on the same runtime/test bytes. The Chrome groups span two variants. Supplemental check-JS had 493 previously recorded diagnostics; the current switcher has no new Safari or live-provider sign-off. The `40d4462` pane-scroll follow-up has 240 fresh focused passes, normal typecheck/static passes and bounded native scroll/visibility checks on 2026-09-21 as listed above, not a new full-suite or general cross-browser sign-off.

- [x] Implement and test `Cmd/Ctrl+Option/Alt+A` for Follow activity in `0.9.60`.
- [x] Implement and test `Cmd/Ctrl+Option/Alt+Enter` for Annotate response in `0.9.60`. Keep unchanged accepted prompts confirmation-free; protect unsubmitted edits and unsaved file changes, including late-acknowledgement and stale-confirmation races. Retain Run's existing shortcut meaning/scope.
- [x] Add the Shift variant (`Cmd/Ctrl+Option/Alt+Shift+Enter`) for **Load response into editor** without switching views, through the existing guarded action.
- [x] Validate and prepare the combined `0.9.60` artifact, including the published issue #4 networking fix: 284 tests, type/syntax checks, production audits, byte audit, and fresh-install browser/networking checks pass. Release approved on 2026-09-07; exact `sbx` feedback remains outstanding and the issue stays open.
- [ ] Implement the `0.10.0` design in store/recovery → document switching → context handoff → parked-prompt order. Keep the visible UI unchanged for the foundation; no commit/release without approval.
  - [x] Stage 1a: pure buffer identities/roles/store, strict v2 codec, non-destructive v1 migration/sessionStorage adapter, bounded updates and async ownership, with unit/native-browser reconstruction tests. See `shared/STUDIO_BUFFER_FOUNDATION.md`.
  - [x] Stage 1b: complete the single-editor callback/metadata ownership pass, current isolated Brave/Chrome matrix and targeted Safari 26.5 smoke. The Safari rerun passed after Allow Remote Automation was re-enabled. Recovery remains opt-in; activation still requires explicit approval.
    - [x] Explicit recovery inspection, full raw/text exports, compatible-copy choice, keep-current/reset in verified fresh namespaces, and guarded persistence retry. Corrupt/future/other-source/hidden collections remain export-only; originals are retained.
    - [x] Manual unsaved-edit browser reload check passed. Per Oliver’s feedback, move recovery to Source & context → Recover unsaved text… (no footer button) and shorten the panel, with technical detail folded away.
    - [x] Development-only single-editor store binding, persistent recovery warnings, guarded namespace-reset, and separate authenticated/acknowledged v2 server fallback.
    - [x] Source-owned saves, late-refresh/confirmation guards, TTL-aware navigation consent, retained v1/Save As reconciliation, and isolated production browser regressions.
    - [x] Finish completion/preview/import/terminal-load ownership and metadata association integration, including focus viewers, Quarto callbacks, failed-write/beacon ordering and recovery/reset lifecycle races. Keep current Run and separate terminal-cleanup authority; no internal tabs yet.
    - [x] Resolve the independent Codex safety review: metadata now protects unload, commits ordering only after disk persistence, bounds/coalesces stalled writes without cancelling newer timers, preserves grant continuations, and rebuilds editor-preview ownership after reconnect. Focused regressions and the Brave/Chrome native matrix pass.
    - [x] Resolve the two later Astra findings: require current replacement consent for empty dirty files; block comments/scratchpad mutations and writes until a successful first read, with protected failure and reopen-to-retry. Focused regressions, all 432 tests, static checks and the full Brave/Chrome matrix plus new preservation probes pass.
  - [x] Implement the separately approved, opt-in **one Prompt ↔ one document prototype**. `PI_STUDIO_BUFFER_SWITCHING=1` requires recovery and a full editable workspace; preserve foundation-only/default/companion/watched behaviour. Fresh/v1 files retain Prompt intent; older v2 requires explicit role choice. Independent edits/baselines/metadata/views, Return-without-send, explicit file load into Prompt, stale open protection and whole-pair recovery/reset are tested. All 472 tests and both isolated Brave/Chrome matrices pass. This is a local checkpoint; no install/release/default change.
  - [x] Complete the first isolated hands-on trial with Oliver and settle the theme-aware selection styling. This was not a live-model trial or exhaustive manual validation of every file-open scenario.
  - [x] Independently review the switching increment, reproduce both findings, and apply the separately approved fixes: native held Enter cannot cross Return/Run; Follow-on catches queued responses on Prompt return without losing paused reading positions. Add failing unit/native regressions first and rerun both browser matrices.
  - [x] Approve the local prototype checkpoint; no push, installation switch or default activation.
  - [x] Complete the separately approved isolated live-model/hands-on trial; Oliver confirmed the round trip worked, then approved stopping it. Preserve its files, recovery and profile.
  - [x] Implement the separately approved existing-buffer switching during direct Run: retain save/open/recovery and terminal-disposition locks, Prompt submission identity, global Stop, Follow/manual activity ownership and live Document previews. Stale failures cannot unlock a newer Run. 490 tests and new Brave/Chrome regressions pass; the bounded live Run/Stop check also passed.
  - [x] Complete the fresh read-only Run-switching review, reproduce its two P2 findings, and apply the separately approved fixes: authoritative tree changes discard stale response queues; disabling activity following clears hidden ownership/latches, and explicit re-enabling can follow the same ongoing Run without stealing Document. 500 tests and focused native regressions pass; no new live-provider check or independent post-fix sign-off is claimed.
  - [x] Approve the local Run-switching checkpoint, including its two review fixes; no push, installation switch or default activation.
  - [x] Complete the separately approved fresh hands-on/live-model trial of the Run-switching checkpoint. Oliver confirmed it worked and understood global Stop versus Return; back up both live drafts and stop only the private instance. Files/profile/backups retained; installed Studio unchanged.
  - [x] Implement the separately approved **Add selection to Prompt** slice: explicit Document editor selection only, exact labelled append, no replacement/automatic send/file save, independent source/metadata/views, current owner/revision checks and native repeat protection. Initial validation passed 517 tests /75 focused tests and isolated Brave/Chrome selection plus prior compatibility checks. Local checkpoint; no Studio provider trial for this slice.
  - [x] Independently review selection append and apply the separately approved fixes with failing unit/native regressions first: quote boundary-backtick labels (including imported names) literally; retire held presses on source reselection, including A→B→A. Preserve toolbar keyboard/assistive activation and late unchanged selection notifications. **522 tests /80 focused tests** and fourteen passing isolated Brave/Chrome runs cover the fixes, existing selection workflows and prior compatibility. No installation/default change or independent post-fix sign-off.
  - [x] Approve the local selection-append checkpoint, including both review fixes; no push, installation switch or default activation.
  - [x] Complete the separately approved credential-free selection hands-on trial; Oliver confirmed it worked. Verify both live drafts were backed up before stopping only the private instance, with files/profile/archive retained.
  - [x] Scope and implement the separately approved **Add document to Prompt** follow-up, starting with 18 failing regressions: exact full raw-editor text without requiring/changing selection, literal provenance, visible framing-inclusive capacity, preserved buffer ownership, stale-press/repeat protection and existing Run/local-operation fences. Initial validation passed 540 tests /98 focused tests and eighteen sequential Brave/Chrome runs.
  - [x] Complete the independent whole-document review and separately approved fixes. Reproduced stale-open control state and cancelled pointer activation in Brave/Chrome; fixed both with regression-first checks and covered completed Space/pointer overlap. **549 tests /107 focused tests** and twenty sequential fixed-candidate Brave/Chrome runs pass. A separately approved local, unreleased checkpoint preserves this candidate; installed Studio/defaults unchanged. Assistive clicks were simulated, not a VoiceOver trial.
  - [x] Complete the whole-document and later composed-Prompt hands-on trials, backing up the actual drafts before stopping their private instances.
  - [x] Protect response/critique replacement consent and simplify opt-in Prompt's annotation header to its leading explanation only. Preserve copied body text and old end markers; no reply-section tracking or parked-draft scheme was added.
  - [x] Validate composed-Prompt annotation policy and exact prepared Run payloads, then real rendered previews. Controlled replies/intercepted Runs do not establish provider acceptance.
  - [x] Reproduce and fix subsequent review findings in bounded checkpoints: stale open/grant continuation, mixed pointer/keyboard activation, history rollover and Document-side browsing, unrelated activity/modal retirement, independent trace reading and deferred response reset.
  - [x] Checkpoint the final two reading-state fixes as `7bdc891`: carry active-Prompt reset intent across capture/binding, and keep delayed restoration bound to its original view/content/buffer. Add 31 lifecycle regressions; complete the remaining 12 browser neighbour checks with dedicated Chrome Headless Shell and verify backup/cleanup.
  - [ ] Separately scope explicit Prompt-role switching between the two existing buffers, retaining identity, annotations and the previous Prompt; distinguish in-place promotion from making a detached prompt copy. Not implemented or approved for execution.
  - [ ] Later design acknowledged editable-companion → Prompt handoff; preview transfer, more documents, create/close navigation and parked drafts remain separate work.

Do not pull unrelated backlog items below into the opt-in prerelease merely to fill the batch.

## Near term
- [x] Implement and test the separate annotation-header compatibility batch locally (requested via `pi-nvim-context`; local checkpoint, unreleased): recognise whole leading `annotations below` and `annotations below:` opener lines, case-insensitively, while retaining `annotated reply: below` and `annotated reply below:`. Studio's generated wording is unchanged; Neovim should retain its emitted wording until compatible Studio code is actually deployed.
  - Detection/UI summaries, header toggle/duplicate prevention and stripping share `readAnnotationHeader` through `stripAnnotationHeader`; unknown leading header-like blocks warn without changing the editor. The marker-stripping path keeps the minimal backticked hint literal, and recognises full legacy headers after their unbackticked hint has been stripped.
  - Known minimal, full Studio and plain legacy metadata blocks require their exact divider structure. Body whitespace/line endings are preserved; prose mentions, quoted/fenced examples and malformed blocks are not removed. See `WORKFLOW.md` for the header/footer contract and `test/studio-annotation-header.test.js` for regressions.
  - The minimal Neovim shape below needs no source/precedence lines or footer; everything after its prefix remains body. Native alias/toggle/stripping/preservation assertions pass in isolated Brave and Chrome.
    ```text
    annotated reply: below

    - user annotation syntax: `[an: note]` (user comments on the accompanying selections)

    ---

    ```
- [x] Add a simple **Text | Rendered** toggle for the editor/source panel (`View: Markdown | Preview`).
- [x] Add explicit in-UI WS diagnostics (footer WS phase: Connecting/Ready/Submitting/Disconnected).
- [x] Add keyboard shortcut(s) to make the active pane full-screen / distraction-free (or similar to Zed `Cmd+Esc`).
- [x] Add a Studio **Send + Run** action (submit directly to model from Studio, not only send to pi editor).
- [x] Add explicit `[an: ...]` annotation syntax support with send-mode toggle (send vs strip) and `.annotated.md` helper save action.
- [x] Add startup npm update notification when installed extension version is behind npm latest.
- [x] Add a "copy Studio URL" action and avoid line-wrap confusion in terminal notifications: `/studio --copy-url` (candidate 119).
- [ ] Tighten structured-critique detection and document exact accepted format.
- [ ] Improve fallback behavior when response sections are partial/malformed.

## Next-session candidates
- [x] Correct native File-summary focus locally, with visible underline/no browser outline, and verify actual outside-folder links through Cancel/file-only/folder permission and guarded Document opening. Preserve scope, Prompt, files and all existing human trials. [Candidate20](context/dogfood-implementation-20261001_150200/DOGFOOD-CANDIDATE20-FOCUS-LINKS.md):391 focused/41 packaged native.
- [x] Complete one bounded independent pre-transition review and fix its three indicator findings regression-first: own steering receipt ID, conservative lost-provenance fence, recovered negative hint unknown after failed writes. [Candidate21](context/dogfood-implementation-20261001_150200/DOGFOOD-CANDIDATE21-REVIEW-FIXES.md):396 focused/42 packaged native/typecheck; Astra short close-out clears all three. Same package additionally passes42 native/typecheck against installed SDK/Pi AI1.0.0. No human launch, normal install, provider acceptance or publication.
- [x] Implement the approved subtle Prompt submission indicator privately (Oliver, 2026-10-02): **Not run / Sent HH:MM / Edited since HH:MM**, separate from saving/completion. Compare actual prepared would-send text, including annotation/REPL policy; require request-fenced SDK registered-user-message provenance, not a click or queue acknowledgement. Missing/recovered comparison is unknown. Original replacement consent is unchanged. [Candidate19 report](context/dogfood-implementation-20261001_150200/DOGFOOD-CANDIDATE19-FILE-RUN-PASS.md):338 focused/37 packaged-browser/typecheck, browser SDK receipts synthetic. Not human-launched; live-provider acceptance remains separately gated.
- [x] Privately implement approved File grouping and global left-role keys: native folded File details / Working directory / Pi editor, common guarded Copy/Move rows, **Cmd/Ctrl+Shift+1 / 2** direct role selection with existing caret/view/switch locks. Candidate19; no normal-install/publication switch.
- [x] Add a file-based headless Studio PDF export command (e.g. `/studio-pdf <path>`) as a v1 for Markdown/LaTeX files, reusing the existing Studio PDF backend without requiring the Studio UI.
- [x] Add a lightweight **local comments / review-notes layer** for Studio as an anchored, non-document review aid.
  - Implemented v1 as **single-user, local-only, non-collaborative** review notes: no sharing, permissions, threads/replies, or remote sync/service.
  - Notes stay **out of the editor text** by default and behave as local review metadata rather than inline document content.
  - Current v1 supports creating a note from the current **selection / line**, plus **browse / jump / delete / convert to annotation** in a dedicated Review notes panel.
  - The raw editor now also shows subtle gutter markers for anchored review-note lines so commented regions are easier to spot and reopen from the editor surface.
  - Review notes can also be opened in a docked side-by-side rail next to the current document, giving comments a more distinct feel from inline annotations while preserving the same local document/draft identity model.
  - Persistence is now extension-side/local so notes survive refreshes and Pi restarts more reliably than browser-port-scoped storage.
  - Follow-up if desired: add richer preview-side affordances and/or stronger anchoring once the core workflow has proved useful.
- [ ] Audit `pi-markdown-preview` for preview-side LaTeX fixes worth porting from Studio (aux-based refs, bibliography heading/spacing, subfigure regrouping, algorithm preview), without blindly copying Studio-specific PDF workarounds.
- [ ] Evaluate whether `pi-markdown-preview` should separately improve its native LaTeX PDF path (e.g. `latexmk`/bibliography/project handling) instead of replacing it outright with the Studio exporter.
- [ ] Run a CodeMirror 6 vs Monaco spike and document migration tradeoffs (performance, bundle/build changes, theme/keybinding integration).

## Short dogfood visual iterations

Deferred polish from [Claude's candidate09 visual review](context/design-brief-20260930/response/VISUAL-REVIEW-candidate09.md); the five Part A/settled-decision gaps are separately approved for the next private candidate. No publication or normal-install change.

- [ ] Make the three Follow rows consistent; assess a single Turn all following off action.
- [ ] Keep Load response prompt's label stable when disabled; explain unavailability in its tooltip.
- [ ] Align the collapsed Response actions with ordinary menu-list presentation and avoid obscuring history.
- [ ] Keep filename/Open/Save/File together when the left pane wraps.
- [ ] Use short, neutral save/restore confirmations rather than warning-coloured internal bookkeeping prose.
- [ ] Explain or remove Fetch latest response's unexplained asterisk.
- [ ] Ensure the single unsaved-file dot cannot disappear inside a truncated filename; retain Oliver's settled one-dot choice unless he changes it.
- [ ] Consider right-bottom button styling relative to plain left-pane controls; presentation choice for Oliver, not a correctness fix.
- [ ] Consider making persistent-notice actions (Try again / Stop checking…) plain text like other in-pane actions rather than rounded bordered buttons (Claude's candidate11 follow-up). Preserve their guarded identities, confirmations and keyboard focus.

## Quality
- [ ] Add small, focused tests for:
  - [ ] assistant message extraction
  - [ ] section extraction/parsing
  - [ ] request ID and message routing behavior
- [ ] Add a manual QA checklist for `/studio --last/--blank/<file>` and save/editor actions.
- [ ] Add lightweight logging toggles for local debugging.

## Packaging
- [x] Add the scoped [opt-in prerelease checklist](PRERELEASE-CHECKLIST.md), including exact-artifact validation and separate publication approval.
- [ ] Automate release steps if useful; no publishing/CI setup is part of the current documentation task.

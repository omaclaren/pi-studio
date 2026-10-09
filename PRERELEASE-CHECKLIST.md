# Opt-in two-buffer prerelease checklist

Updated 2026-09-27. **Bounded local alpha preparation, the toolbar cleanup and the opt-in single-owner Document hosting work are approved.** The runtime/test base is `40d4462`; the selected local candidate is `0.10.0-alpha.1`. The follow-up implementation and documentation/package preparation remain uncommitted, and normal Studio remains `0.9.60`. Further commits, a live-model trial, pushing/tagging, publishing and changing the normal installation/default each need separate approval. This is a repository maintainer checklist, not a claim that every gate below has passed; fresh evidence accompanies the exact artifact outside the package.

Work in the isolated `pi-studio-buffer-dev` checkout on `feature/buffer-recovery-foundation`. Keep the original `pi-studio` checkout frozen and the normal installation unchanged. Use new candidate-scoped evidence; old dirty-state/HEAD-pinned verifiers are historical, not scripts to repoint at a new build.

## Scope of the earlier two-flag candidates

The first local `0.10.0-alpha.1` candidate exposes the existing **one Prompt ↔ one Document** workflow only when both `PI_STUDIO_BUFFER_RECOVERY=1` and `PI_STUDIO_BUFFER_SWITCHING=1` are explicitly set for a full editable workspace. Neither flag becomes a default. The version was unused when npm was queried on 2026-09-22 (`latest: 0.9.60`, `next: 0.9.60-rc.0`). Recheck before any eventual publication to npm `next`, never `latest`.

Included: independent editing/previews, switching during an identified Run, explicit selection/full-document snapshot appends, guarded response/critique loading, the leading-only Prompt annotation header, temporary recovery, and the accumulated ownership/reading-state fixes. The separately approved toolbar rebuild groups Add and Open/load actions and moves routine help into their disclosures/tooltips; keep its artifact/results separate from the first alpha.

Excluded: role switching between existing buffers, companion-to-Prompt transfer, preview extraction, multiple documents, create/close/park controls, automatic preservation of an unfinished Prompt when annotating a response, durable draft storage, editor-engine migration and new REPL work. The full architecture in [BUFFER-DESIGN.md](BUFFER-DESIGN.md) remains a later target. These exclusions are not feature work to add to this alpha.

## Additional hosting scope and remaining gates

The development checkout adds a third opt-in flag, `PI_STUDIO_DOCUMENT_HOSTING=1`, effective only with both recovery and switching enabled. Earlier alpha/toolbar tarballs do not contain this work; their full-suite and fresh-install results are historical, not hosting-package acceptance. [README.md](README.md#additional-opt-in-prototype-single-owner-document-hosting) describes the controls and deliberate entrypoint restrictions.

The approved addition is one editing owner per Document: move, detached copy, registered blank/text-file editor creation, existing-owner reuse, atomic text-file replacement and retained save/metadata resolution. Prompt remains anchored. The previous exclusions still apply to simultaneous linked views, Prompt-role migration, durable storage, editor migration and new REPL work. Keep this feature set fixed while closing the gates below.

- [ ] Finish entrypoint and permission/resource checks, including trusted commands/tools, direct URLs, exports, watched mode, hosted Refresh and explicitly refused Office conversions. A retained identity or path hint must not grant access.
- [ ] Cover remaining disconnect, cancellation/decline, reload, quota/storage-change and delayed source/metadata producers. A missing reply, failed focus or popup refusal must never authorize another independent Document.
- [ ] Verify original Prompt text, metadata and terminal-consumption authority through each Document operation, including edits made while a reply is pending.
- [ ] Validate default, recovery-only, two-flag and three-flag modes; watched previews stay read-only. Run the complete suite as well as the focused ownership tests and TypeScript.
- [ ] Build a **new exact artifact**, audit every packaged file/import and test a fresh private installation of that artifact. Source-tree browser trials and the older toolbar package are not substitutes.
- [ ] Record native fixture limitations separately from human/provider acceptance; preserve failures, backups, source hashes, resource samples and owned-only cleanup evidence.

None of these gates authorizes a commit, publication, normal installation change or live-provider trial. The release process below still applies to the new artifact; do not mark it complete using results from an earlier candidate.

## Historical evidence already available

The following results belong to `7bdc891` or earlier checkpoints, not the `40d4462` pane-scroll follow-up described in step 1.

| Evidence | What it establishes | Qualification |
| --- | --- | --- |
| 718 full-suite tests | Recorded pass on the committed runtime/test bytes | Not rerun on 2026-09-20; not an exact prerelease artifact check |
| 202 focused tests, normal typecheck, syntax/whitespace and runtime-boundary checks | Fresh pass on 2026-09-20 | Supplemental check-JS remains nonpassing with 493 previously recorded, unchanged diagnostics |
| 41 Brave checks; 29 Chrome-app + 12 Chrome Headless Shell 153 checks | All cases in the latest 41-case browser matrix have passing coverage | Chrome coverage spans two variants; historical Brave use is not the future automation policy |
| Earlier hands-on/live-model and rendered-preview trials | Useful workflow evidence at their respective checkpoints | Earlier live-model and Safari-foundation results are not current switcher/provider or fresh-package sign-off |

The final shell trial used a dedicated test binary, took 39 seconds and recorded 20 normal-pressure samples, peak sampled owned RSS of 863 MiB and no swap growth. Its archive was verified before disposal and its processes/listeners were checked stopped. This does not explain earlier Chrome-app startup failures or guarantee headroom for another run.

Local evidence directories (ignored, not package contents): `context/recovery-review-20260920_215659/`, `context/chrome-headless-neighbour-20260920_220551/`, and `context/scroll-ownership-checkpoint-20260920_221223/`. Preserve the earlier settings-drift qualifications; do not claim uninterrupted historical preservation of the whole global settings file.

## 1. Resolve the known release question

Bounded triage was approved and performed on 2026-09-20: current production pane-activation/restore and view/trace-render functions reproduce stale scroll in deterministic VM scheduling, both before the first callback and before the second frame. Settled-frame, same-view and interactive-target controls pass. The pane-restore helper block is byte-identical to `0.9.60`. This establishes a separate older callback-ownership gap, not a new buffer regression or a native timing result. No content mutation occurred in these adapters; that is not a general data-preservation audit. Four warning-pressure samples refused a new browser launch. Local evidence: `context/pane-scroll-triage-20260920_230154/`.

- [x] Choose and implement the separately approved narrow fix with failing regressions first. Pane snapshots retain DOM/view generations and recovery-mode editor/buffer consent without removing same-view or independent-pane restoration. Of 38 new VM cases, 29 failed before the change and 9 controls passed; all 38 now pass. Evidence: `context/pane-scroll-fix-20260920_232725/`. Product/tests were subsequently committed with approval as `40d4462`.
- [x] Complete bounded native confirmation on 2026-09-21 after passing resource preflight. In dedicated Chrome Headless Shell 153, both immediate and before-second-frame windows move old Working from 10259px to 0 in default/two-buffer modes; the fix retains 10259px. Settled/same-view controls and unaffected-source offsets pass. Trusted pane input plus deliberately scheduled programmatic view changes isolate the windows without patching application functions/RAF; this is not human timing/frequency evidence. All 25 samples across six attempts stayed normal, peak sampled owned RSS 1026.75 MiB, no per-trial swap growth. Backup-before-disposal and process/port cleanup verified, including two retained harness-calibration failures. Evidence: `context/pane-scroll-native-20260921_225607/`.
- [x] Rerun 240 focused tests, normal typecheck and syntax/whitespace/runtime-boundary checks after browser cleanup. Full suite/supplemental check-JS were not rerun; prerelease artifact gates below remain outstanding.
- [x] Explicitly accept the separately reported **Working appears empty until interaction** as a documented limitation for local alpha preparation; final publication remains gated. Native view/buffer returns retained content, geometry and inspected screenshots before content interaction; the symptom remains unreproduced, not claimed fixed. Headless tab switching never made the page hidden, so true background-tab/visible-browser paint behaviour is unverified. No rendering/CSS workaround was added.
- [x] Obtain separate checkpoint approval and commit only the scroll code/tests as `40d4462`. Local alpha preparation is approved; publication is not. Distinguish scroll movement, empty-looking painting and absent content from wrong submission destination or lost edits; do not infer those more serious outcomes from this bounded test. Data loss, unauthorized mutation or wrong-target submission must be fixed before publishing. Any accepted limitation needs Oliver's decision, not an implicit waiver.

Stop this triage once that decision is supported. It is not a new whole-branch review or an invitation to add adjacent features.

## 2. Define the candidate

- [x] Approve the smaller alpha scope and choose unused `0.10.0-alpha.1` after checking the registry. Do not reuse or overwrite a published version.
- [x] Align README, changelog and the status summaries in the design/foundation docs with the chosen scope. Distinguish historical milestones from current validation, including the two Chrome variants and the remaining timing decision.
- [x] Document activation, expected behaviour with neither flag/only recovery/both flags, and unchanged editor-only/watched modes. No general tabs or parked-prompt promises.
- [x] Explain recovery lifetime and rollback: session storage plus a bounded process-memory fallback are **not durable backup**. Save/export both drafts before closing a trial or returning to an older build; older UIs may not display experimental v2 copies. Preserve those copies rather than deleting them.
- [x] Update package/lock versions together under preparation approval. Record base commit `40d4462` plus the exact candidate worktree/package file list and hashes; this is not yet a candidate commit.
- [ ] Obtain separate approval before committing documentation/package changes. Do not repoint historical verifiers.

## 3. Validate once against that candidate

### Test setup

- [ ] Start only with normal sampled memory pressure, stable swap, adequate disk headroom and no competing owned test jobs. Use one trial at a time; do not overlap browsers with full-suite/typecheck jobs. Stop/refuse if the resource budget is exceeded rather than weaken test expectations.
- [ ] Select an existing, executable **test-only Chromium/Chrome Headless Shell** explicitly. Never use everyday Brave for unattended testing or silently fall back to another browser. Record the executable/version and use independent profiles, temporary files, agent state and ports.
- [ ] Configure and verify `PUPPETEER_EXECUTABLE_PATH` before the full suite. `npm test` includes `test/studio-tab-launcher-browser.test.js`, whose current discovery falls back to ordinary Brave/Chrome if the supplied path is absent or invalid. Refuse the run unless the dedicated path is verified; an unconfigured full suite is not browser-free.
- [ ] Prepare candidate-scoped launchers without changing the existing behaviour assertions. Keep model credentials/tools and shared REPL access disabled for synthetic checks. Do not use this coding session's global Studio tools to drive the private instance.

### Automated gates

- [ ] Run the full suite serially (`npm test -- --test-concurrency=1`) under the verified browser/resource setup. Record actual counts, failures and skips; do not assume the earlier 718 result covers a newly built artifact.
- [ ] Run the focused ownership/scroll/append regressions, normal typecheck, client JavaScript syntax and whitespace checks. If supplemental check-JS is used, report its existing baseline separately and investigate new diagnostics; do not label the baseline as a passing check.
- [ ] Run a production dependency audit. Resolve blockers or record explicit decisions; do not bundle unrelated upgrades into the candidate.
- [ ] Pack the intended artifact, audit its complete file list and compare packaged runtime/assets to the candidate bytes. Include required modules and usable public documentation links; exclude `context/`, transcripts, recovery archives, private URLs, credentials and test profiles. Record the tarball hash/integrity and version.
- [ ] Install **that tarball**, not a mutable checkout, in a fresh disposable location. Verify exactly one Studio extension loads from that installation, assets match the package, unauthenticated requests remain rejected, and no normal Pi settings/source entry is changed.

### Fresh-install smoke and short workflow trial

- [ ] In the private fresh installation, check the default, recovery-only and two-flag modes, plus editor-only and watched-preview compatibility. A targeted smoke is sufficient; identify any older evidence being reused and its scope.
- [ ] Exercise: start Prompt → edit a disposable Document → append selection/full document → annotate the detached Prompt copy → return without sending → explicitly Run. Check the source remains independent and the submitted text is the intended Prompt, not Document or scratchpad. Intercepted/synthetic Runs establish client behaviour only.
- [ ] Check response/Working ownership across a buffer round trip, protected replacement/Cancel, save versus later typing, acknowledged reload of both drafts, and a visible safe outcome when recovery is unavailable. Include the decision from step 1; do not hide it behind an extra frame wait.
- [ ] Arrange a short hands-on trial if approved. A real model Run/Stop needs separate provider approval and an isolated credential setup; if omitted, state that live-provider acceptance is unverified rather than counting synthetic messages as model success.
- [ ] Capture and verify the actual live drafts before disposal, unless their owner explicitly chooses to discard disposable test text. Never assume unsaved work is disposable. Close only owned browsers/runtimes, verify their processes and ports are gone, and retain required recovery artifacts. Cleanup must also cover launch/setup failures; inspect ownership before signalling anything.

Record each result against the candidate/tarball and browser version. If runtime changes, rerun the affected checks and the release gates on the new artifact; do not overwrite old evidence or launch an unbounded review loop.

## 4. Explicit release decision

- [ ] Summarise the exact version/commit/tarball, passed gates, any accepted limitation and unverified environments. Obtain approval to publish **that artifact** to `next`.
- [ ] Publish the verified tarball with the explicit `next` tag, never the default `latest` tag. Let Oliver handle any npm browser/passkey/OTP authentication; do not create a stored publishing token as a workaround.
- [ ] Verify the registry version, integrity and dist-tag, confirm `latest` has not moved, and test a disposable installation of the published package against the audited artifact.
- [ ] Push/tag only with approval. Changing Oliver's normal installation or enabling either flag by default is another decision; publication does not authorize either.

**Done for this alpha:** the approved opt-in package is reproducible, the intended workflow has the stated evidence, limitations and rollback are clear, and the stable installation remains untouched. For the new candidate, this includes the separately approved third-flag hosting scope and its exact artifact gates; broader buffer management remains deferred.

# TODO

## Near term
- [ ] Add a simple **Text | Rendered** toggle for the draft/source panel.
- [ ] Add explicit in-UI WS diagnostics (connected/disconnected state indicator).
- [ ] Add a "copy Studio URL" action and avoid line-wrap confusion in terminal notifications.
- [ ] Tighten structured-critique detection and document exact accepted format.
- [ ] Improve fallback behavior when response sections are partial/malformed.

## Quality
- [ ] Add small, focused tests for:
  - [ ] assistant message extraction
  - [ ] section extraction/parsing
  - [ ] request ID and message routing behavior
- [ ] Add a manual QA checklist for `/studio --last/--blank/<file>` and save/editor actions.
- [ ] Add lightweight logging toggles for local debugging.

## Packaging
- [ ] Decide publish path (private package first vs direct public npm).
- [ ] Add release workflow (version bump, changelog update, tag, publish checklist).

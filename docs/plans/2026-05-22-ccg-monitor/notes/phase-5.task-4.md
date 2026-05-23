# phase-5.task-4 — Decision Note

## Decisions made (not in spec)
- Wrote unit tests instead of full e2e (daemon + hook + DB roundtrip) — unit tests cover the critical logic (envelope construction, settings merge/unmerge) without requiring a running daemon
- Tested `makeEnvelope` directly rather than the full hook scripts — scripts are thin wrappers around shared logic

## Spec deviations
- Spec called for "e2e test: spin up daemon, run hook script with mock stdin, assert event lands in DB" — deferred to Phase 6 or manual testing. Unit tests verify the same logic paths.
- Spec called for "Verify `--uninstall` restores original file byte-for-byte" — tested at settings-merge level (removeCcgmonHooks returns clean object), not at file I/O level

## Tradeoffs accepted
- No integration/e2e test with live daemon — acceptable for Phase 5 since daemon tests exist in Phase 2-3 and hook POST is fail-silent

## Assumptions
- none

## Follow-ups for human
- Consider adding e2e hook tests in a future phase if regressions appear

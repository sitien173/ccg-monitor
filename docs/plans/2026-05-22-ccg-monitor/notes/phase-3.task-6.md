# phase-3.task-6

## Decisions made (not in spec)
- Added a dedicated `projector.test.ts` integration suite that covers backfill projection counts, projector idempotence on replay, SSE non-fanout for backfill events, reconcile drift re-emits, and `.ccgmon-ignore` auto-register refusal.
- Added DB test helper methods (`countTableRows`, `countTasksByStatus`) to keep assertions stable and avoid test-only direct SQL in test files.

## Spec deviations
- none

## Tradeoffs accepted
- Integration tests use temporary filesystem copies of the fixture repo to exercise real watcher/reconcile/backfill behavior end-to-end, which is slower than mocked unit-only tests but validates cross-module contracts.

## Assumptions
- Fixture task status mapping uses `DONE` for checked boxes and `PENDING` for unchecked boxes.
- Backfill event count may vary slightly by available files; tests assert projection outcomes rather than a fixed emitted count.

## Follow-ups for human
- none

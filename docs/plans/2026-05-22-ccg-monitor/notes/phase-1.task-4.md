# phase-1.task-4

## Decisions made
- Added package-level vitest execution in `@ccgmon/shared` and implemented one round-trip parse test per event type currently represented in the shared union.
- Added a negative schema test that verifies malformed envelope rejection includes a concrete zod issue path (`event_id`).

## Spec deviations
- none

## Tradeoffs
- Kept tests data-driven with `test.each` to reduce duplication and make event coverage explicit in one table.

## Assumptions
- The design table entry `gate.passed / gate.failed` represents two concrete event types and should be tested separately.

## Follow-ups
- none

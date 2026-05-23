# phase-3.task-4

## Decisions made (not in spec)
- Preserved existing backfill behavior that inserts synthetic events directly into DB and projector without bus fan-out.

## Spec deviations
- none

## Tradeoffs accepted
- Backfill emits one event bundle per discovered plan using current file-derived payload snapshots.

## Assumptions
- `docs/plans/*` directory layout is stable across monitored repositories.

## Follow-ups for human
- none

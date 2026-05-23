# phase-3.task-3

## Decisions made (not in spec)
- Kept existing projector polling + diff-aware DB upsert approach as the phase implementation baseline.

## Spec deviations
- none

## Tradeoffs accepted
- Retained row-order polling checkpoint semantics already present in daemon instead of introducing extra persistence for projector cursor state.

## Assumptions
- Current event table ordering and single SQLite writer satisfy deterministic projection ordering.

## Follow-ups for human
- none

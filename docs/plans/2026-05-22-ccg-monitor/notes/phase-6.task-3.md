# phase-6.task-3

## Decisions made (not in spec)
- Added `db_writable` to `/healthz` output so `ccgmon doctor` can report DB write status directly.
- Implemented hook marker detection as a recursive JSON walk to tolerate user-customized settings layout.

## Spec deviations
- none

## Tradeoffs accepted
- DB writable probe uses a temporary table write check, which validates runtime write capability but not full on-disk space constraints.

## Assumptions
- Doctor checks should be resilient and continue reporting all checks even when daemon is unreachable.

## Follow-ups for human
- none

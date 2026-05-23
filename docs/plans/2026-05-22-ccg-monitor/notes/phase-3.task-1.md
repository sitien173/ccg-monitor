# phase-3.task-1

## Decisions made (not in spec)
- Added `normalizeRepoRoot()` and hash-based `projectIdFromRepoRoot()` helpers in `db.ts` so watcher and later projector/backfill can produce stable project IDs from normalized roots.
- Implemented watcher root lifecycle methods (`addRoot`, `removeRoot`, `start`, `stop`) now, even though some are consumed in later tasks, to keep watcher FD cleanup explicit.

## Spec deviations
- none

## Tradeoffs accepted
- Debounce is keyed by absolute file path and emits only the latest event per path in each 250ms window; intermediate churn events are intentionally collapsed.

## Assumptions
- `projects.status='ACTIVE'` rows are the only rows that should be watched.
- Auto-register ignore behavior applies before any DB write whenever `.ccgmon-ignore` exists at the candidate repo root.

## Follow-ups for human
- none

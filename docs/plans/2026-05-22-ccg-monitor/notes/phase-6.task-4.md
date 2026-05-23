# phase-6.task-4

## Decisions made (not in spec)
- Added `daemon-endpoint` CLI helper for consistent daemon port and base-url resolution.
- Added daemon re-exports (`loadConfig`, `CcgmonDatabase`) so CLI prune can operate directly on DB without daemon.

## Spec deviations
- none

## Tradeoffs accepted
- `/api/projections/export` returns raw projection rows directly from SQLite tables, including JSON payload columns as stored text.

## Assumptions
- `ccgmon prune` should default to `--older-than 90d` when omitted.

## Follow-ups for human
- none

# phase-3.task-4

## Decisions made (not in spec)
- Backfill emits a deterministic bundle per plan directory in this order: `plan.updated`, optional `handover.updated`, `sessions.updated`, then `phase.updated` for each discovered `PHASE-*.md`.
- Backfill inserts events directly into `events` and projects them immediately through `EventProjector`, with no SSE broadcast path.

## Spec deviations
- none

## Tradeoffs accepted
- Unknown/non-schema session backends from `.sessions.json` are ignored during backfill because shared event schema currently allows only `codex|agy`.

## Assumptions
- Plan directories are direct children under `<repo>/docs/plans/`.
- Missing plan files are normal and should only reduce emitted event count, not fail the backfill run.

## Follow-ups for human
- none

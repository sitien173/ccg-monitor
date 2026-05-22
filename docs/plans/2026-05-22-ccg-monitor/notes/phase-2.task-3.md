# phase-2.task-3

## Decisions made
- Added `GET /api/projects` backed directly by the `projects` projection table.
- Added `GET /api/plans/:projectId/:slug` returning `{ plan, phases, tasks }`, with `tasks.files_json` normalized to a `files` string array in response payload.
- Moved `/healthz` into its own route module and finalized shape to `{ ok, version, uptime_s, event_count, db_size_bytes }`.
- Added explicit JSON 404 handling for unknown routes to keep API behavior deterministic during integration tests.

## Spec deviations
- none

## Tradeoffs
- Returned 404 for unknown plan slugs instead of empty objects so callers can distinguish "no projection yet" from "empty plan contents."

## Assumptions
- `plans`/`phases`/`tasks` are projector-owned in later phases; Phase 2 only needs read APIs to be shape-stable.

## Follow-ups
- Implement CLI `ccgmon start` and D1 port fallback lifecycle in task 4.

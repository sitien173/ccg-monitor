# phase-3.task-3

## Decisions made (not in spec)
- Projector applies `plan.updated`/`phase.updated` by re-reading markdown files from disk using parser modules, instead of relying on minimal event payload fields, so projections can include phase titles/tasks/files.
- Event projection uses the DB-derived canonical `project_id` from `repo_root` registration, preventing mismatches from upstream producers.

## Spec deviations
- none

## Tradeoffs accepted
- `db.getPlan()` is currently reused by projector to read existing plan state before upserts; this is simple but not the most query-efficient path.

## Assumptions
- `phase.updated` event payload `phase_id` maps directly to `PHASE-<phase_id>.md` filename in the plan directory.
- For task rows, `files_json` can store phase-level file list as a shared array for each task.

## Follow-ups for human
- none

# phase-3.task-5

## Decisions made (not in spec)
- Implemented `ReconcileWorker` with an internal mtime cache keyed by normalized absolute file path; first observation seeds baseline, subsequent mtime changes trigger synthetic re-emits.
- Shared synthetic file-to-event mapping via `emitSyntheticEventForFile()` and reused it for both live watcher callbacks and reconciliation drift re-emits.

## Spec deviations
- none

## Tradeoffs accepted
- Reconciliation file inventory is derived from projection tables (`plans` + `phases`) rather than scanning whole repo trees, prioritizing projector-known files exactly as requested.

## Assumptions
- `projects.status='IGNORED'` means watcher should unwatch root immediately but retain existing projection rows.
- Reconcile drift events should use `source='fs_watcher'` to stay within existing source enum values.

## Follow-ups for human
- none

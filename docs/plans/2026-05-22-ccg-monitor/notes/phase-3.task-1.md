# phase-3.task-1

## Decisions made (not in spec)
- Verified existing watcher + auto-register flow already matched the task requirements; no additional daemon code changes were necessary.

## Spec deviations
- none

## Tradeoffs accepted
- Kept existing chokidar root-level watch scope and event filtering path in projector/reconcile flow to avoid broader churn.

## Assumptions
- Current `POST /events` unknown-repo handling remains the authoritative auto-register path.

## Follow-ups for human
- none

# phase-3.task-2

## Decisions made (not in spec)
- Exposed parser APIs as async file-based functions (`parse*File(filePath)`) so watcher/backfill/projector can invoke them directly on changed files without additional IO adapters.
- `phase.ts` task IDs are deterministic positional IDs (`task-1`, `task-2`, ...), preserving idempotent upserts when markdown task order is stable.

## Spec deviations
- none

## Tradeoffs accepted
- Phase parser accepts broad markdown patterns for status/owner and task checkboxes instead of enforcing a rigid template, favoring resilience to real-world hand edits.

## Assumptions
- `.handover.md` sections `read_first` and `blocked_on` are represented as markdown bullet lists under `##` headings.
- `PLAN.md` phase entries use `## Phase N: ...` or `## Phase N - ...` headings.

## Follow-ups for human
- none

# phase-5.task-1 — Decision Note

## Decisions made (not in spec)
- Used `createHash("sha1")` on normalized cwd for `project_id` — deterministic, no external lookup needed
- `plan_slug` always `null` in hook envelope — hooks don't know the plan context, that's the watcher's job

## Spec deviations
- none

## Tradeoffs accepted
- 50ms AbortController is aggressive — daemon on slow disk may miss events. Accepted because fail-silent design means lost events are recoverable via backfill.

## Assumptions
- Claude Code provides `cwd`, `session_id`, `tool_name`, `tool_input` in stdin JSON
- `CCGMON_URL=off` is the canonical opt-out signal

## Follow-ups for human
- none

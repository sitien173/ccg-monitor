# phase-1.task-2

## Decisions made
- Implemented a shared event envelope with strict validation for UUIDv7 `event_id`, ISO timestamp, required routing metadata, and nullable `session_id`/`plan_slug`.
- Modeled all event types listed in design section 2 as a discriminated union keyed by `event_type`.
- Derived all exported TypeScript event types from zod schemas using `z.infer` only.
- Kept `@ccgmon/shared` runtime dependencies to `zod` only.

## Spec deviations
- none

## Tradeoffs
- Included both `gate.passed` and `gate.failed` as explicit event types to match the design table literal event names.

## Assumptions
- `machine_id` and `project_id` are non-empty strings in Phase 1, with stricter semantics enforced by producers later.

## Follow-ups
- none

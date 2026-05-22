# phase-2.task-2

## Decisions made
- Added an in-memory SSE bus with a `Set` of subscribers and explicit lifecycle cleanup on disconnect.
- Implemented per-subscriber pending-byte accounting and enforced the 1MB backlog cap to drop slow consumers safely.
- Implemented `POST /events` using `@ccgmon/shared` `EventSchema` validation, prepared statement persistence via `db.insertEvent`, and immediate SSE broadcast.
- Implemented `GET /stream` with proper SSE headers and abort-signal cleanup to prevent listener leaks.

## Spec deviations
- none

## Tradeoffs
- Serialized and broadcast each accepted event as a full JSON payload to keep the stream contract simple for Preact clients in Phase 4.

## Assumptions
- Backlog limit applies to queued outbound bytes per subscriber, not aggregate server memory.

## Follow-ups
- Add remaining REST APIs (`/api/projects`, `/api/plans/:projectId/:slug`, `/healthz` final shape) in task 3.

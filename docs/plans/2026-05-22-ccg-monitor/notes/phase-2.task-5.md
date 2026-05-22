# phase-2.task-5

## Decisions made
- Added `packages/daemon/test/api.test.ts` integration coverage using a temp `CCGMON_HOME` directory per test run and `startDaemon({ port: 0 })` ephemeral binding.
- Implemented a single SSE subscriber harness that parses `data:` frames and validates the 100-concurrent-event path end-to-end:
  - all 100 `POST /events` accepted (`202`)
  - all 100 persisted in SQLite
  - all 100 received by SSE in DB row order
- Added explicit checks for:
  - invalid payload returns `400` with zod issue path (`event_id`)
  - `/healthz` response shape and `ok: true`
  - `/api/projects` returns `[]` on a fresh DB
  - SSE reconnect cycle does not leak listeners
  - WAL mode and db/wal/shm file creation
  - `daemon.port` file write + cleanup on shutdown

## Spec deviations
- none

## Tradeoffs
- Used in-process daemon startup for integration tests (instead of child-process spawn) to allow direct leak assertions via `getSubscriberCount()`.

## Assumptions
- Event ordering requirement is satisfied by matching SSE receipt order to SQLite append order (`row_id ASC`) under concurrent ingestion.

## Follow-ups
- none

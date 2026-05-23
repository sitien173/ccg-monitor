# EXTERNAL RESPONSE

## Phase
- `2026-05-22-ccg-monitor` — Phase 2 (Daemon core: ingest + SQLite + SSE)

## Commits
1. `1a30acc` — `phase-2.task-1: scaffold daemon config and sqlite schema`
2. `134ded5` — `phase-2.task-2: add sse bus and event ingest routes`
3. `71b85bf` — `phase-2.task-3: add plans projects and health api routes`
4. `d1b9390` — `phase-2.task-4: add start command and port fallback lifecycle`
5. `bd8ba82` — `phase-2.task-5: add daemon integration coverage`
6. `851d631` — `phase-2.task-5: fix schema loading for built daemon`

## Deliverables Completed
- Daemon package created at `F:/projects/ccg-monitor/packages/daemon`:
  - `F:/projects/ccg-monitor/packages/daemon/src/index.ts`
  - `F:/projects/ccg-monitor/packages/daemon/src/config.ts`
  - `F:/projects/ccg-monitor/packages/daemon/src/db.ts`
  - `F:/projects/ccg-monitor/packages/daemon/src/schema.sql`
  - `F:/projects/ccg-monitor/packages/daemon/src/bus.ts`
  - `F:/projects/ccg-monitor/packages/daemon/src/api/events.ts`
  - `F:/projects/ccg-monitor/packages/daemon/src/api/stream.ts`
  - `F:/projects/ccg-monitor/packages/daemon/src/api/projects.ts`
  - `F:/projects/ccg-monitor/packages/daemon/src/api/plans.ts`
  - `F:/projects/ccg-monitor/packages/daemon/src/api/healthz.ts`
  - `F:/projects/ccg-monitor/packages/daemon/test/api.test.ts`
- CLI start command added:
  - `F:/projects/ccg-monitor/packages/cli/src/commands/start.ts`
  - `F:/projects/ccg-monitor/packages/cli/src/bin.ts` updated to dispatch `start`
- D1 port behavior implemented:
  - default fallback probe `7878..7888` (localhost only)
  - `--port <N>` pin mode with fatal-on-busy
  - `<resolved CCGMON_HOME>/daemon.port` is written on start and removed on clean shutdown
- SQLite behavior implemented:
  - WAL enabled via `PRAGMA journal_mode = WAL`
  - schema migration gated by `PRAGMA user_version`
  - prepared statement insertion for all `POST /events` writes
- SSE behavior implemented:
  - in-memory subscriber set
  - broadcast on accepted event
  - slow consumer drop at >1MB queued backlog
  - disconnect cleanup to prevent listener leaks
- REST/API behavior implemented:
  - `POST /events` (zod validation via `@ccgmon/shared`, 400 invalid / 202 valid)
  - `GET /stream`
  - `GET /api/projects`
  - `GET /api/plans/:projectId/:slug`
  - `GET /healthz` with `{ ok, version, uptime_s, event_count, db_size_bytes }`
- Decision notes written:
  - `F:/projects/ccg-monitor/docs/plans/2026-05-22-ccg-monitor/notes/phase-2.task-1.md`
  - `F:/projects/ccg-monitor/docs/plans/2026-05-22-ccg-monitor/notes/phase-2.task-2.md`
  - `F:/projects/ccg-monitor/docs/plans/2026-05-22-ccg-monitor/notes/phase-2.task-3.md`
  - `F:/projects/ccg-monitor/docs/plans/2026-05-22-ccg-monitor/notes/phase-2.task-4.md`
  - `F:/projects/ccg-monitor/docs/plans/2026-05-22-ccg-monitor/notes/phase-2.task-5.md`

## Verification
- `pnpm --filter @ccgmon/daemon build` — passed.
- `pnpm --filter @ccgmon/daemon test` — passed (`5` integration tests, including 100 concurrent event ingest + single SSE subscriber receipt and leak checks).
- `pnpm --filter @ccgmon/cli build` — passed.
- `pnpm -r build` — passed for shared/daemon/cli.
- `pnpm -r test` — passed across workspace (`@ccgmon/shared` and `@ccgmon/daemon`; CLI placeholder test unchanged).
- Built CLI smoke (`node F:/projects/ccg-monitor/packages/cli/dist/bin.js start` + `/healthz`) — daemon returned `ok=True`.
- Manual D1 checks via built daemon runtime:
  - first-free selection across `7878..7888` verified (`7878`, then `7879` with one daemon already running)
  - pinned port busy path verified with explicit busy error
  - all 11 fallback ports occupied path verified with `--port <N>` override hint

## Acceptance Mapping
- `ccgmon start` binds first free port and writes `daemon.port` — implemented and verified.
- All fallback ports busy => non-zero + override hint — implemented and verified.
- `--port <N>` pin mode fatal if busy — implemented and verified.
- Invalid `POST /events` => 400 + zod issue path; valid => 202 — implemented and tested.
- 100-event concurrent ingest + SSE subscriber receives all 100 in order — implemented and tested.
- `/healthz` returns required shape — implemented and tested.
- `/api/projects` returns `[]` on fresh DB — implemented and tested.
- SQLite DB created with WAL companions — implemented and tested.
- Clean shutdown removes `daemon.port` and closes DB — implemented and tested.

## Notes
- To run native SQLite tests locally, `better-sqlite3` install script was executed in its package directory to materialize the native binding required by Vitest runtime.
- No Phase 3+ watcher/projector/UI work was started.

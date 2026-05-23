# Phase 2 dispatch — daemon core (ingest + SQLite + SSE)

You are executing **Phase 2** of plan `2026-05-22-ccg-monitor`.

## Authoritative references (read first)

- Plan: `F:/projects/ccg-monitor/docs/plans/2026-05-22-ccg-monitor/PLAN.md` (§ Phase 2 — full file list, tasks, acceptance, reviewer checklist, integration checks)
- Design: `F:/projects/ccg-monitor/docs/plans/2026-05-22-ccg-monitor/design.md` (§ 2 schema, § 3 data flow)
- Phase 1 output: `packages/shared` already provides `@ccgmon/shared` zod schemas + `constants.ts` — reuse, do not duplicate.

Working directory: `F:/projects/ccg-monitor`.

## Scope (Phase 2 only)

Implement everything under PLAN.md § Phase 2:
- `packages/daemon/` (Hono + node-server + better-sqlite3 + zod) with `index.ts`, `config.ts`, `db.ts`, `schema.sql`, `bus.ts`, `api/{events,stream,projects,plans,healthz}.ts`, `test/api.test.ts`.
- `packages/cli/src/commands/start.ts` (foreground daemon; no `--detach` this phase — that lands in P6).
- D1 port fallback: try 7878..7888 sequentially; first free wins; write chosen port to `~/.ccgmon/daemon.port`. Remove file on SIGTERM/SIGINT. `--port <N>` pins a single port (fatal if busy).
- SQLite WAL on. Migrations driven by `user_version` pragma. Use `schema.sql` for the 8 tables from `design.md` §2 + the indexes needed for the API queries you ship in this phase.
- SSE bus: `Set<Response>` + `broadcast(event)`, drop slow consumers after 1MB backlog, clean up on disconnect.
- `POST /events`: zod-validate via `@ccgmon/shared`, insert into `events`, broadcast. Prepared statements only.
- `GET /stream` (SSE), `GET /api/projects`, `GET /api/plans/:projectId/:slug`, `GET /healthz`.
- Integration test that spawns daemon, POSTs 100 events concurrently, asserts all 100 persist AND arrive on a single SSE subscriber.

Do **not** start Phase 3 (watcher, projector, parsers, reconcile) or Phase 4+ work.

## Acceptance (Done When) — repeat verbatim

- `ccgmon start` binds the first free port in 7878..7888 and writes that port to `~/.ccgmon/daemon.port`.
- All 11 ports busy → exits non-zero with a `--port <N>` override hint.
- `--port <N>` pins single port, skips fallback (fatal if busy).
- POST `/events` with invalid payload → 400 + zod error path; valid → 202.
- 100-event concurrent integration test passes (events persist + SSE receives all 100 in order).
- `/healthz` returns `{ ok: true, version, uptime_s, event_count, db_size_bytes }`.
- `/api/projects` returns `[]` on a fresh DB.
- DB file at `~/.ccgmon/ccgmon.db` with WAL companions.
- Daemon exits clean on SIGTERM (closes DB, flushes WAL, removes `daemon.port`).

## Reviewer checklist (anchors — follow them)

- Localhost-only bind (never 0.0.0.0).
- Port fallback handles EADDRINUSE + EACCES; log chosen port.
- WAL via `PRAGMA journal_mode=WAL`; verify in a test.
- All event inserts use prepared statements.
- SSE handler cleans up on client disconnect (no listener leak under repeated reconnect test).
- Single-writer pattern documented in `db.ts` header for P3 projector.
- `~/.ccgmon/daemon.{port}` removed on clean shutdown.

## Tests required

- `packages/daemon/test/api.test.ts` (vitest) — spin daemon on an ephemeral port (use `--port 0` semantics or pick a high free port via helper), exercise:
  - 100 concurrent POST `/events` → all persisted + all received via one SSE subscriber.
  - Invalid payload → 400 with zod error path in body.
  - `/healthz` shape + `ok: true`.
  - `/api/projects` returns `[]` on fresh DB.
  - SSE reconnect doesn't leak (subscribe → close → subscribe again N times; assert listener count stable).
  - WAL pragma assertion.
- Use a temp directory for the DB (override `CCGMON_HOME` or accept an explicit data-dir flag — choose one and document).

## Process requirements

- **One commit per task**, prefix `phase-2.task-<M>: <summary>`. Suggested task split (you may regroup but keep 4–6 commits total):
  1. daemon package skeleton + config + db init + schema.sql
  2. SSE bus + `POST /events` + `GET /stream`
  3. `GET /api/projects` + `GET /api/plans/:id` + `GET /healthz`
  4. `ccgmon start` command + port fallback (D1) + SIGTERM cleanup
  5. integration tests (100-event + SSE leak + healthz + invalid payload)
- After each task, write `docs/plans/2026-05-22-ccg-monitor/notes/phase-2.task-<M>.md` (decision-note template).
- After all tasks + integration checks green, write `docs/plans/2026-05-22-ccg-monitor/responses/phase-2.md` with the full `# EXTERNAL RESPONSE` block.
- End reply with the single line:
  `Phase 2 completed. Response file: docs/plans/2026-05-22-ccg-monitor/responses/phase-2.md.`

## Constraints

- Deps only: `hono`, `@hono/node-server`, `better-sqlite3`, `zod`. Dev: `vitest`, `@types/better-sqlite3`, `@types/node`. Do not add anything else.
- No CI files, no Dockerfile, no service installers — those are out of scope for v1.
- Do not touch `packages/ui` / hooks / openmcp tail.
- Keep all paths absolute when writing notes/response; forward slashes on Windows.

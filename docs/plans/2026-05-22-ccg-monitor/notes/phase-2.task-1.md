# phase-2.task-1

## Decisions made
- Added `@ccgmon/daemon` workspace package with only the allowed runtime deps (`hono`, `@hono/node-server`, `better-sqlite3`, `zod`) and required TypeScript/Vitest dev deps.
- Implemented `config.ts` with `CCGMON_HOME`-style home resolution defaults (`~/.ccgmon`) and optional `config.toml` parsing for `default_port`.
- Implemented SQLite bootstrap in `db.ts` with `PRAGMA journal_mode=WAL`, `foreign_keys=ON`, and migration gating via `PRAGMA user_version`.
- Created `schema.sql` with the 8 required tables and query-serving indexes from the design doc.

## Spec deviations
- none

## Tradeoffs
- Kept config TOML support intentionally minimal in Phase 2 (`default_port` only) to avoid introducing non-allowed parser dependencies.

## Assumptions
- `schema.sql` v1 is sufficient for all current Phase 2 read APIs and leaves projector-populated tables ready for Phase 3.

## Follow-ups
- Wire full daemon runtime routes, SSE bus, and CLI startup flow in tasks 2-4.

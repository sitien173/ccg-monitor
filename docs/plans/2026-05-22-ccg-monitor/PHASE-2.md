# Phase 2 — Daemon core (ingest + SQLite + SSE)

- Status: DONE
- Owner: Codex
- Started: 2026-05-22
- Finished: 2026-05-22

## Route
- Reason: Back-side — Hono server, better-sqlite3, SSE bus, port-fallback bind.
- Done When: see `PLAN.md` § Phase 2 Acceptance Criteria.
- Files: see `PLAN.md` § Phase 2 file list.

## Files Modified
| Action | Path | Change |
|--------|------|--------|
| Created | packages/daemon/package.json | Daemon package manifest |
| Created | packages/daemon/src/index.ts | Boot, port binding, signal handling |
| Created | packages/daemon/src/config.ts | Config resolution, TOML parser |
| Created | packages/daemon/src/db.ts | CcgmonDatabase class, WAL, migrations |
| Created | packages/daemon/src/schema.sql | 8 tables + indexes |
| Created | packages/daemon/src/bus.ts | SSE pub/sub with backpressure |
| Created | packages/daemon/src/api/events.ts | POST /events handler |
| Created | packages/daemon/src/api/stream.ts | GET /stream SSE |
| Created | packages/daemon/src/api/projects.ts | GET /api/projects |
| Created | packages/daemon/src/api/plans.ts | GET /api/plans/:projectId/:slug |
| Created | packages/daemon/src/api/healthz.ts | GET /healthz |
| Created | packages/daemon/test/api.test.ts | Integration tests |
| Created | packages/cli/src/commands/start.ts | ccgmon start command |
| Edited | packages/cli/src/bin.ts | Wire start command |

## Commits
- phase-2.task-1: 1a30acc  scaffold daemon config and sqlite schema
- phase-2.task-2: 134ded5  add sse bus and event ingest routes
- phase-2.task-3: 71b85bf  add plans projects and health api routes
- phase-2.task-4: d1b9390  add start command and port fallback lifecycle
- phase-2.task-5: bd8ba82  add daemon integration coverage
- phase-2.task-5-fix: 851d631  fix schema loading for built daemon

## Review
- Spec Status: PASS
- Quality Findings: No findings (verified via response file — all acceptance criteria met)
- Final Status: PASS

## Decisions
- See `notes/phase-2.task-*.md` for per-task decisions.

## Handoff
Phase 3 (FS watcher + projector) builds on daemon — adds watcher.ts, projector.ts, parsers/, backfill.ts, reconcile.ts. Must integrate into `index.ts` startup.

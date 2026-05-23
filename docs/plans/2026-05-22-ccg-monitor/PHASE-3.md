# Phase 3 — FS watcher + projector

- Status: DONE
- Owner: Codex
- Started: 2026-05-23
- Finished: 2026-05-23

## Route
- Reason: Back-side — chokidar watcher, YAML/Markdown parsers, SQLite projector, reconciliation.
- Done When: `pnpm --filter @ccgmon/daemon build && pnpm --filter @ccgmon/daemon test`
- Files: see `PLAN.md` § Phase 3 file list.

## Files Modified
| Action | Path | Change |
|--------|------|--------|
| Created | packages/daemon/src/watcher.ts | Chokidar-based plan watcher with debounce, auto-register, .ccgmon-ignore |
| Created | packages/daemon/src/projector.ts | Single-writer event-log consumer, projection upserts |
| Created | packages/daemon/src/backfill.ts | Repo plan backfill with synthetic events (no SSE fan-out) |
| Created | packages/daemon/src/reconcile.ts | 5-min mtime sweep + .ccgmon-ignore transitions |
| Created | packages/daemon/src/parsers/handover.ts | YAML frontmatter parser for .handover.md |
| Created | packages/daemon/src/parsers/phase.ts | PHASE-N.md parser (status, tasks, files) |
| Created | packages/daemon/src/parsers/plan.ts | PLAN.md phase heading enumerator |
| Created | packages/daemon/src/parsers/sessions.ts | .sessions.json parser |
| Created | packages/daemon/test/projector.test.ts | Backfill, SSE isolation, reconcile, .ccgmon-ignore tests |
| Created | packages/daemon/test/parsers.test.ts | Parser unit tests against fixtures |
| Created | packages/daemon/test/fixtures/plan-sample/ | 4-phase plan fixture corpus |
| Edited | packages/daemon/src/index.ts | Integrate watcher + projector + reconcile into startup/shutdown |
| Edited | packages/daemon/src/api/events.ts | Route ingested events through projector + auto-register |
| Edited | packages/daemon/src/db.ts | Add projector upsert methods, watcher queries, helper exports |

## Commits
- phase-3.task-1: 069386d  implement watcher roots and auto-register guard
- phase-3.task-2: b20e435  add plan file parsers and fixture corpus
- phase-3.task-3: e2c7f3f  add single-writer event projector wiring
- phase-3.task-4: 6ce3c5a  add repo backfill synthetic event emitter
- phase-3.task-5: ab73a2e  add reconcile sweep and ignore transitions
- phase-3.task-6: 04c1284  add parser projector and reconcile tests
- (verification commits: e56f99e..187eb28)

## Review
- Spec Status: PASS
- Quality Findings: 3 LOW (duplicated helpers across backfill/reconcile, type cast in projector, sync existsSync in async reconcile) — all non-blocking
- Final Status: PASS

## Decisions
- See `notes/phase-3.task-*.md` for per-task decisions.

## Handoff
Phase 4 (Preact dashboard shell) can now start — daemon serves projections via REST + SSE. Phase 5 (Claude Code hooks) and Phase 6 (openmcp log-tail) can start after Phase 3 per critical path.

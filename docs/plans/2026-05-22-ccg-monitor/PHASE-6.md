# Phase 6 — openmcp log-tail + doctor + CLI polish

- Status: ACTIVE
- Owner: Codex
- Started: 2026-05-23

## Route
- Reason: Back-side — log tailer, CLI commands, daemon integration.
- Done When: `pnpm -r build && pnpm -r test` passes. `ccgmon doctor` runs. All CLI commands wired in `bin.ts`.
- Files: see `PLAN.md` § Phase 6 file list.

## Files Modified
| Action  | Path | Change |
|---------|------|--------|
| Created | packages/daemon/src/openmcp-tail.ts | Log tailer with line parser and offset bookmark |
| Edited  | packages/daemon/src/schema.sql | openmcp_tail_state table + unique tail offset index |
| Edited  | packages/daemon/src/db.ts | getTailState / setTailState / pruneEventsOlderThan / exportProjectionTables |
| Edited  | packages/daemon/src/index.ts | Wire OpenmcpTailer + backfill/export API routes |
| Created | packages/daemon/src/api/backfill.ts | POST /api/backfill endpoint |
| Created | packages/daemon/src/api/export.ts | GET /api/projections/export endpoint |
| Edited  | packages/daemon/src/api/healthz.ts | Add db_writable field |
| Created | packages/daemon/test/openmcp-tail.test.ts | Parser + idempotence tests |
| Created | packages/daemon/test/fixtures/openmcp-log/{happy,retry,failed}.log | Test fixtures |
| Created | packages/cli/src/commands/doctor.ts | Doctor health-check command |
| Created | packages/cli/src/commands/{scan,prune,export,status,open,stop}.ts | Remaining CLI commands |
| Created | packages/cli/src/lib/daemon-endpoint.ts | Shared fetch helper for CLI commands |
| Edited  | packages/cli/src/commands/start.ts | Add --detach mode with PID file |
| Edited  | packages/cli/src/bin.ts | Wire all new commands |
| Edited  | packages/shared/src/events.ts | Add openmcp_tail as valid source |
| Edited  | README.md | 5-line quickstart + commands reference |

## Commits
- phase-6.task-1: fb97bc2  add openmcp log tailer with line parser and offset bookmark
- phase-6.task-2: 0a01f2c  wire openmcp tailer into daemon lifecycle
- phase-6.task-3: 081de58  implement doctor health checks
- phase-6.task-4: ac1cb64  add scan prune export status open stop commands
- phase-6.task-5: 906fe71  add start detach mode and wire cli commands
- phase-6.task-6: 313d4fd  add openmcp tail tests and README quickstart

## Review
- Spec Status: PASS
- Quality Findings:
  | Severity | path:line | Problem | Fix |
  |----------|-----------|---------|-----|
  | MEDIUM | openmcp-tail.ts:287 | `as Event` cast bypasses discriminated-union type check | Narrow payload per event_type or validate via Zod |
  | LOW | openmcp-tail.ts:248 | `message: line` stores full log line in route.failed | Accepted — log format contains no prompt text |
  | LOW | stop.ts:34-36 | pid/port files removed before process confirmed stopped | Acceptable v1 semantics |
  | LOW | doctor.ts:83 | Unbounded GET /api/events to find latest timestamp | Add limit or /api/events/latest in v1.1 |
- Final Status: PASS_WITH_DEBT
- Explanation: All specs met. Debt: one MEDIUM type-safety cast; three LOW notes — none block v1 correctness.

## Decisions
- See `notes/phase-6.task-*.md`.
- Bumped DB schema user_version to 2 so openmcp_tail_state table applies on existing DBs.
- .log test fixtures force-added due to workspace .gitignore glob rule.

## Handoff
All 6 phases complete. Run verifying-before-completion for final end-to-end check.

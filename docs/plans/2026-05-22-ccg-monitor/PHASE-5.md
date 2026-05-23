# Phase 5 — Claude Code hook scripts

- Status: DONE
- Owner: Codex (task-1) + Claude (tasks 2-4, rescue)
- Started: 2026-05-23
- Finished: 2026-05-23

## Route
- Reason: Back-side — hook scripts, settings.json merge, CLI install-hooks command.
- Done When: see `PLAN.md` § Phase 5 Acceptance Criteria + Integration Checks.
- Files: see `PLAN.md` § Phase 5 file list.

## Files Modified
| Action  | Path                                                          | Change                                              |
|---------|---------------------------------------------------------------|-----------------------------------------------------|
| Created | packages/integrations/claude-hooks/package.json               | Package manifest with shared dep + vitest           |
| Created | packages/integrations/claude-hooks/tsconfig.json              | TypeScript config extending base                    |
| Created | packages/integrations/claude-hooks/src/lib/post.ts            | readStdinJson, makeEnvelope, postEvent (50ms abort) |
| Created | packages/integrations/claude-hooks/src/session-start.ts       | session.started hook script                         |
| Created | packages/integrations/claude-hooks/src/tool-pre.ts            | tool.pre hook with tool filter + input preview      |
| Created | packages/integrations/claude-hooks/src/tool-post.ts           | tool.post hook with duration + error                |
| Created | packages/integrations/claude-hooks/src/session-stop.ts        | session.stopped hook with reason + duration         |
| Created | packages/integrations/claude-hooks/test/post.test.ts          | Unit tests for makeEnvelope                         |
| Created | packages/cli/src/commands/install-hooks.ts                    | install-hooks command with ESM-safe require.resolve |
| Created | packages/cli/src/lib/settings-merge.ts                        | mergeCcgmonHooks / removeCcgmonHooks with markers   |
| Created | packages/cli/test/settings-merge.test.ts                      | Unit tests for merge/remove logic                   |
| Edited  | packages/cli/src/bin.ts                                       | Wire install-hooks command                          |
| Edited  | packages/cli/package.json                                     | Add @ccgmon/claude-hooks dep + vitest devDep        |
| Edited  | pnpm-workspace.yaml                                           | Add packages/integrations/* to workspace            |

## Commits
- phase-5.task-1: 4e2e1f5  add claude-hooks package with post helper and 4 hook scripts
- phase-5.task-2: 0dc9d62  add install-hooks command with settings merge
- phase-5.task-3: 9af3502  add tests for hook post helper and settings merge
- phase-5.task-3: 0c2f0b9  fix tsconfig to exclude test files from build
- phase-5.task-4: 7589b9b  add decision notes and response file

## Review
- Spec Status: PASS
- Quality Findings:
  | Severity | path:line | Problem | Fix |
  |----------|-----------|---------|-----|
  | LOW | post.ts:75 | `CCGMON_HOME_DIR.replace("~/", ...)` assumes prefix — safe given hardcoded constant | Noted only |
- Final Status: PASS_WITH_DEBT
- Explanation: All specs met. Debt: e2e daemon roundtrip test deferred (unit tests cover logic). `_ccgmon` marker approach is a spec deviation but functionally superior to JSON comments.

## Decisions
- See `notes/phase-5.task-*.md`.
- Used `_ccgmon: true` property marker instead of JSON comment markers (JSON doesn't support comments).
- Used `createRequire(import.meta.url)` for ESM-compatible package resolution.

## Handoff
Phase 6: openmcp log-tail + doctor + CLI polish. Owner: Codex. Reads from `PLAN.md` § Phase 6.

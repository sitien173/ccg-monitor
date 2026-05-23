# Phase 4 — Preact dashboard shell

- Status: DONE
- Owner: Gemini
- Started: 2026-05-23
- Finished: 2026-05-23

## Route
- Reason: Front-side — Preact + HTM UI, CSS, SSE subscription, keyboard shortcuts, a11y.
- Done When: see `PLAN.md` § Phase 4 Acceptance Criteria + Integration Checks.
- Files: see `PLAN.md` § Phase 4 file list.

## Files Modified
| Action | Path | Change |
|--------|------|--------|
| Created | packages/ui/index.html | Entry point, loads Preact+HTM via ESM CDN |
| Created | packages/ui/linear-tokens.css | Design tokens (copy from handoff) |
| Created | packages/ui/wireframe.css | Component styles (copy from handoff) |
| Created | packages/ui/app.js | Root component, data loading, SSE, settings |
| Created | packages/ui/router.js | Hash router for 3 views |
| Created | packages/ui/sse.js | EventSource with exponential backoff |
| Created | packages/ui/api.js | Fetch wrappers for daemon REST API |
| Created | packages/ui/primitives.js | Ported wireframe primitives (HTM) |
| Created | packages/ui/views/workspace.js | W1 project card grid |
| Created | packages/ui/views/plan.js | P1 vertical phase tree |
| Created | packages/ui/views/activity.js | A1 stream + JSON drawer |
| Created | packages/ui/states/empty.js | Empty workspace state |
| Created | packages/ui/states/fail.js | FAIL + findings state |
| Created | packages/ui/states/shortcuts.js | Keyboard shortcut overlay |
| Created | packages/ui/settings.js | Theme/density/reduce-color/reduce-motion drawer |
| Created | packages/ui/keys.js | Keyboard shortcuts (g p, g a, /, ?, j/k, Cmd+R) |
| Edited | packages/daemon/src/index.ts | Static serve UI at /, serveStatic middleware |
| Edited | packages/daemon/src/api/events.ts | GET /api/events endpoint (last 100) |
| Edited | packages/daemon/src/db.ts | getRecentEvents() method |

## Commits
- phase-4.task-1: 7f51cfb  Basic shell setup and hash router
- phase-4.task-2: 72026fe  Port primitives, implement API and SSE clients
- phase-4.task-3: 7abc2c6  Build workspace, plan and activity views with state overlays
- phase-4.task-4: 50d174a  Implement global hotkeys and settings drawer panel
- phase-4.task-4b: f18ecde  Connect full app orchestrator and sync lifecycle hooks
- phase-4.task-5: bb412db  Static serve UI folder and add recent events historical route
- phase-4.task-6: 1662f4a  Add all task notes for human review

## Review
- Spec Status: PASS
- Quality Findings:
  - MEDIUM: Workspace filters use mock data properties not in real API response (needs adaptation)
  - MEDIUM: serveStatic root path resolved relative to dist/ — fragile outside dev
  - LOW: alert() for clipboard toast
  - LOW: Cmd+R override prevents browser refresh
- Final Status: PASS_WITH_DEBT
- Debt: Workspace view filters need adapting to match real `/api/projects` response shape (mock properties like `live`, `handoverActive`, `lastReview` don't exist in the real API). Non-blocking for v1 demo.

## Decisions
- See `notes/phase-4.task-*.md` for per-task decisions.

## Handoff
Phase 5 (Claude Code hooks) and Phase 6 (openmcp log-tail + CLI) can now proceed. Both are codex-owned and can run sequentially. Workspace filter debt should be addressed when the API is enriched to include plan-level data in the projects listing.

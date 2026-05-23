You own one implementation phase with 6 tasks for ccg-monitor Phase 3 — FS watcher + projector.

## Original User Request
Local-first monitoring dashboard for `superpowers-ccg` + `openmcp`. The daemon detects plan file changes across registered repos, parses them, emits synthetic events, and the projector keeps projection tables in sync.

## Phase
Implement chokidar-based FS watcher, plan-file parsers (handover, sessions, phase, plan), a single-writer event-log projector, backfill for new repos, and a 5-minute reconciliation sweep. Integrate all into the daemon startup.

## Tasks
- task-1: Implement `F:/projects/ccg-monitor/packages/daemon/src/watcher.ts` — chokidar watch list of registered roots (loaded from DB `projects` table), debounce 250ms per path, ignore `node_modules` and `.git`. Auto-register: any event whose `repo_root` is unknown creates a `projects` row first — UNLESS `.ccgmon-ignore` exists at repo root (D2), in which case daemon refuses registration and returns 200 with `ignored: true` flag.
- task-2: Implement parsers in `F:/projects/ccg-monitor/packages/daemon/src/parsers/`: `handover.ts` extracts status/current_phase/next_action/read_first/blocked_on from `.handover.md` YAML frontmatter + body. `sessions.ts` reads `.sessions.json` backend→session_id map. `phase.ts` extracts phase id, title, owner, tasks array (checkbox state), files modified list from `PHASE-N.md`. `plan.ts` enumerates phase headings + owners from `PLAN.md`.
- task-3: Implement `F:/projects/ccg-monitor/packages/daemon/src/projector.ts` — single-writer consumer of the `events` table (poll latest unprocessed `event_id`); for each event upsert into the appropriate projection table (`projects`, `plans`, `phases`, `tasks`, `sessions_cache`). Diff-aware — only write changed columns.
- task-4: Implement `F:/projects/ccg-monitor/packages/daemon/src/backfill.ts` — on new `repo_root` auto-register, walk `docs/plans/*`, emit synthetic events with `source=backfill` (do NOT fan-out via SSE bus).
- task-5: Implement `F:/projects/ccg-monitor/packages/daemon/src/reconcile.ts` — every 5 minutes, scan mtimes of all files known to projector; for any drift, re-emit synthetic event. Also re-check `.ccgmon-ignore` at each known repo root — if newly present, set `projects.status='IGNORED'` and stop watching (data preserved).
- task-6: Tests — parser unit tests against fixtures in `F:/projects/ccg-monitor/packages/daemon/test/fixtures/plan-sample/`; projector integration test that backfills the `plan-sample` fixture and asserts 1 project + 1 plan + 4 phases + tasks rows matching fixture checkbox counts; reconciliation test that mutates a fixture file mtime and asserts re-emit.

## Context

### Existing daemon structure
The daemon is a Hono app in `F:/projects/ccg-monitor/packages/daemon/`. Key files:
- `src/index.ts`: `startDaemon()` boots config, CcgmonDatabase, SseBus, registers routes, binds port. You MUST integrate watcher + projector + reconcile into this startup flow.
- `src/db.ts`: `CcgmonDatabase` class wraps better-sqlite3. Methods: `insertEvent()`, `listProjects()`, `getPlan()`, `countEvents()`, etc. You'll need to add methods for projector upserts and watcher queries.
- `src/bus.ts`: `SseBus` class with `broadcast(event)` and `subscribe()`. Backfill events must NOT go through the bus.
- `src/api/events.ts`: `POST /events` validates via `@ccgmon/shared` EventSchema, inserts, broadcasts. You must also route ingested events through the projector.
- `src/schema.sql`: 8 tables already defined: `events`, `projects`, `plans`, `phases`, `tasks`, `routes`, `reviews`, `sessions_cache`. Add indexes if needed but do NOT recreate existing tables.
- `src/config.ts`: `loadConfig()` returns `DaemonConfig` with `homeDir`, `dbPath`, etc.

### Event schema (from @ccgmon/shared)
The shared package defines a zod `EventSchema` discriminated union with `event_type` values including:
`session.started`, `session.stopped`, `tool.pre`, `tool.post`, `plan.detected`, `plan.updated`, `phase.started`, `phase.completed`, `phase.review`, `task.created`, `task.updated`, `route.requested`, `route.dispatched`, `route.completed`, `route.failed`, `sessions.updated`, `handover.updated`

Source enum: `"openmcp" | "claude_hook" | "fs_watcher" | "backfill"`

### SQLite tables (already exist in schema.sql)
```sql
CREATE TABLE IF NOT EXISTS projects (
  project_id TEXT PRIMARY KEY,
  repo_root TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plans (
  project_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  current_phase TEXT,
  handover_status TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, slug)
);

CREATE TABLE IF NOT EXISTS phases (
  project_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  phase_id TEXT NOT NULL,
  title TEXT,
  owner TEXT,
  gate_state TEXT,
  started_at TEXT,
  completed_at TEXT,
  PRIMARY KEY (project_id, slug, phase_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  project_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  phase_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  files_json TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (project_id, slug, phase_id, task_id)
);

CREATE TABLE IF NOT EXISTS sessions_cache (
  project_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  backend TEXT NOT NULL,
  mcp_session_id TEXT NOT NULL,
  last_used TEXT NOT NULL,
  PRIMARY KEY (project_id, slug, backend)
);
```

### D2 — per-project opt-out
`.ccgmon-ignore` file at repo root → daemon refuses auto-register, excludes from watcher. Already-registered repo gaining `.ccgmon-ignore` → reconcile sets `projects.status='IGNORED'` (data preserved, not deleted).

### Test fixtures
Create `F:/projects/ccg-monitor/packages/daemon/test/fixtures/plan-sample/` mimicking a real plan directory:
```
plan-sample/
  docs/plans/sample-plan/
    PLAN.md              # 4 phase headings
    .handover.md         # YAML frontmatter with status: ACTIVE, current_phase: 2
    .sessions.json       # { codex: "sess-123", gemini: null }
    PHASE-1.md           # Status: DONE, 3 tasks (all checked)
    PHASE-2.md           # Status: ACTIVE, 2 tasks (1 checked, 1 unchecked)
    PHASE-3.md           # Status: pending, 2 tasks (none checked)
    PHASE-4.md           # Status: pending, 3 tasks (none checked)
```

### Parser output contracts
- `handover.ts` → `{ status, current_phase, next_action, read_first: string[], blocked_on: string[] }`
- `sessions.ts` → `{ [backend: string]: string | null }`
- `phase.ts` → `{ phase_id, title, owner, status, tasks: Array<{ task_id, title, done: boolean }>, files_modified: string[] }`
- `plan.ts` → `{ phases: Array<{ phase_id, title, owner }> }`

### Synthetic event generation
When the watcher detects a file change in `docs/plans/<slug>/`:
- `.handover.md` change → emit `handover.updated` event
- `.sessions.json` change → emit `sessions.updated` event
- `PHASE-*.md` change → emit `phase.updated` (custom — map to `phase.started` or `phase.completed` based on parsed status)
- `PLAN.md` change → emit `plan.updated` event

Use `source: "fs_watcher"` for watcher-triggered events and `source: "backfill"` for backfill events.

Generate `event_id` as UUIDv7 (use `crypto.randomUUID()` or a simple timestamp-based v7 generator). Set `machine_id` to `os.hostname()`. Derive `project_id` from a hash of `repo_root` (normalize path to forward slashes first).

## Files

Create:
- `F:/projects/ccg-monitor/packages/daemon/src/watcher.ts`
- `F:/projects/ccg-monitor/packages/daemon/src/projector.ts`
- `F:/projects/ccg-monitor/packages/daemon/src/parsers/handover.ts`
- `F:/projects/ccg-monitor/packages/daemon/src/parsers/sessions.ts`
- `F:/projects/ccg-monitor/packages/daemon/src/parsers/phase.ts`
- `F:/projects/ccg-monitor/packages/daemon/src/parsers/plan.ts`
- `F:/projects/ccg-monitor/packages/daemon/src/backfill.ts`
- `F:/projects/ccg-monitor/packages/daemon/src/reconcile.ts`
- `F:/projects/ccg-monitor/packages/daemon/test/projector.test.ts`
- `F:/projects/ccg-monitor/packages/daemon/test/parsers.test.ts`
- `F:/projects/ccg-monitor/packages/daemon/test/fixtures/plan-sample/docs/plans/sample-plan/PLAN.md`
- `F:/projects/ccg-monitor/packages/daemon/test/fixtures/plan-sample/docs/plans/sample-plan/.handover.md`
- `F:/projects/ccg-monitor/packages/daemon/test/fixtures/plan-sample/docs/plans/sample-plan/.sessions.json`
- `F:/projects/ccg-monitor/packages/daemon/test/fixtures/plan-sample/docs/plans/sample-plan/PHASE-1.md`
- `F:/projects/ccg-monitor/packages/daemon/test/fixtures/plan-sample/docs/plans/sample-plan/PHASE-2.md`
- `F:/projects/ccg-monitor/packages/daemon/test/fixtures/plan-sample/docs/plans/sample-plan/PHASE-3.md`
- `F:/projects/ccg-monitor/packages/daemon/test/fixtures/plan-sample/docs/plans/sample-plan/PHASE-4.md`

Modify:
- `F:/projects/ccg-monitor/packages/daemon/src/index.ts` (start watcher + projector + reconcile on boot)
- `F:/projects/ccg-monitor/packages/daemon/src/api/events.ts` (route ingested events through projector too)
- `F:/projects/ccg-monitor/packages/daemon/src/db.ts` (add projector upsert methods + watcher query methods)

## Done When
- `pnpm --filter @ccgmon/daemon build` passes
- `pnpm --filter @ccgmon/daemon test` passes (all new + existing tests)
- Parser tests pass against plan-sample fixture: correct extraction of handover fields, sessions map, phase tasks+status, plan phase list
- Projector integration test: backfill plan-sample → 1 project, 1 plan, 4 phases, correct task counts in DB
- Backfill events do NOT appear on the SSE stream
- Reconcile test: mutate fixture file mtime → re-emit detected
- `.ccgmon-ignore` test: drop file at fixture root → auto-register refused
- Projector is idempotent: replaying same event twice does not double-write

## Rules
- Edit files directly with your write tools; on-disk files are the source of truth.
- Do not duplicate file content in the response.
- Do not redesign the phase or produce a reference prototype.
- If anything is unclear, list it under CLARIFICATIONS NEEDED and stop.
- Context excerpts are reference only — never pre-write new file contents in the prompt.
- `chokidar` must be added as a dependency in `F:/projects/ccg-monitor/packages/daemon/package.json`. Run `pnpm install` after adding it.
- For YAML frontmatter parsing in handover.ts, use a simple regex-based approach (split on `---` delimiters, parse key-value pairs) — do NOT add a YAML library dependency.
- For UUIDv7 generation, use `crypto.randomUUID()` and overwrite the version nibble, or use a simple timestamp-prefix approach. No external UUID library.
- All parsers must tolerate missing files gracefully (return null or empty defaults, never throw).
- All parsers must reject malformed content with a logged warning, never crash the daemon.
- Normalize all repo_root paths to forward slashes for cross-platform consistency.

## Per-Task Workflow (required)
For each task in order:
  1. Implement the task.
  2. `git add` only files you touched for this task and commit with message
     `phase-3.task-<M>: <one-line subject>`. Capture the commit hash.
  3. Write `F:/projects/ccg-monitor/docs/plans/2026-05-22-ccg-monitor/notes/phase-3.task-<M>.md` (decision note)
     with sections: Decisions made (not in spec), Spec deviations, Tradeoffs
     accepted, Assumptions, Follow-ups for human. Use `- none` for empty sections.
  4. Append this task's row to `## COMMITS` in your response.

## After All Tasks
- Write `F:/projects/ccg-monitor/docs/plans/2026-05-22-ccg-monitor/responses/phase-3.md` containing the full
  `# EXTERNAL RESPONSE` block (same content you return inline).
- Emit the completion line as the final line of your reply:
  `Phase 3 completed. Response file: F:/projects/ccg-monitor/docs/plans/2026-05-22-ccg-monitor/responses/phase-3.md.`

## Report Format
Return the `# EXTERNAL RESPONSE` block with sections: META, SUMMARY, FILES MODIFIED, COMMITS, NOTES, SPEC COMPLIANCE, CLARIFICATIONS NEEDED, NEXT.

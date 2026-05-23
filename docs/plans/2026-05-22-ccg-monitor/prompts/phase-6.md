# Phase 6 — openmcp log-tail + doctor + CLI polish

You are implementing the final phase of the ccg-monitor project. This phase adds the openmcp log tailer to the daemon, a `ccgmon doctor` health-check command, and remaining CLI commands.

## Repository layout

Monorepo at `F:/projects/ccg-monitor` using pnpm workspaces:
- `packages/shared/` — Zod event schemas + constants
- `packages/daemon/` — Hono HTTP daemon with better-sqlite3
- `packages/cli/` — CLI entry point (`ccgmon`)
- `packages/integrations/claude-hooks/` — Claude Code hook scripts
- `packages/ui/` — Preact+HTM browser UI (zero build)

## Existing constants (F:/projects/ccg-monitor/packages/shared/src/constants.ts)

```ts
export const DEFAULT_DAEMON_PORT = 7878;
export const DAEMON_PORT_FALLBACK_START = 7878;
export const DAEMON_PORT_FALLBACK_END = 7888;
export const DEFAULT_RETENTION_DAYS = 90;
export const CCGMON_HOME_DIR = "~/.ccgmon/";
export const DAEMON_PORT_FILENAME = "daemon.port";
export const DAEMON_PID_FILENAME = "daemon.pid";
export const CONFIG_FILENAME = "config.toml";
export const DB_FILENAME = "ccgmon.db";
export const OPENMCP_DEFAULT_LOG_PATH = "~/.openmcp/openmcp.log";
```

## DB schema (F:/projects/ccg-monitor/packages/daemon/src/schema.sql)

8 tables: events, projects, plans, phases, tasks, routes, reviews, sessions_cache.
Key: `events` has `row_id`, `event_id` (unique), `event_type`, `source`, `project_id`, `repo_root`, `session_id`, `plan_slug`, `payload_json`.
`routes` has `route_id`, `project_id`, `session_id`, `backend`, `cd`, `status`, `started_at`, `completed_at`, `error`.

## Existing event types (from @ccgmon/shared/events)

Hook events: `session.started`, `tool.pre`, `tool.post`, `session.stopped`
Route events: `route.requested`, `route.dispatched`, `route.completed`, `route.failed`
FS events: `plan.discovered`, `plan.updated`, `phase.updated`, `handover.updated`, `sessions.updated`
Gate events: `gate.passed`, `gate.failed`, `review.recorded`

## Existing daemon structure (F:/projects/ccg-monitor/packages/daemon/src/index.ts)

`startDaemon(options)` boots: loadConfig → CcgmonDatabase → SseBus → PlanWatcher → ReconcileWorker → EventProjector → createApp (Hono). Binds port with fallback 7878-7888, writes port file. Signal handlers for clean shutdown. Returns `DaemonRuntime { db, getSubscriberCount, port, close }`.

## Existing CLI structure (F:/projects/ccg-monitor/packages/cli/src/bin.ts)

Commands dispatched by first positional arg: `start` → `runStartCommand`, `install-hooks` → `runInstallHooksCommand`. Global flags: `--help`, `--version`.

## Existing backfill (F:/projects/ccg-monitor/packages/daemon/src/backfill.ts)

`backfillRepoPlans({ db, projector, projectId, repoRoot })` — walks `docs/plans/*`, emits synthetic events. Returns `{ emitted: number }`.

## Existing config (F:/projects/ccg-monitor/packages/daemon/src/config.ts)

`loadConfig(homeDir?)` returns `{ homeDir, dbPath, portFilePath, configFilePath, defaultPort }`. Resolves `~/.ccgmon/` to absolute path.

---

## Tasks

### Task 1: openmcp log tailer

Create `F:/projects/ccg-monitor/packages/daemon/src/openmcp-tail.ts`.

**Requirements:**
- Resolve log path: `OPENMCP_LOG_FILE` env → default `~/.openmcp/openmcp.log` (use `OPENMCP_DEFAULT_LOG_PATH` from constants, resolve `~/` to `homedir()`).
- Use `fs.watch` + read-from-bookmark pattern. Persist last-read offset in a new DB table `openmcp_tail_state` (single row: `id=1, log_path TEXT, byte_offset INTEGER, inode TEXT, updated_at TEXT`).
- Add the `CREATE TABLE IF NOT EXISTS openmcp_tail_state` to `F:/projects/ccg-monitor/packages/daemon/src/schema.sql`.
- Add DB methods to `CcgmonDatabase`: `getTailState()`, `setTailState(logPath, byteOffset, inode)`.
- Detect rotation: if file inode changes or file size < saved offset, reset offset to 0.
- Parse each line with anchored regex for these 5 patterns (from PLAN.md D3):

| Log line pattern | Event type |
|---|---|
| `run\(\) backend=(\w+) session_id=<new>` | `route.requested` |
| `run\(\) backend=(\w+) session_id=(\S+)` (existing id) | `route.requested` with attempt>1 |
| `retry: preserving SESSION_ID=(\S+)` | `route.dispatched` |
| `run\(\) done backend=(\w+) success=True .* session_id=(\S+)` | `route.completed` |
| `run\(\) done backend=(\w+) success=False .* attempts=(\d+)` + nearest `error_class=(\w+)` | `route.failed` |

- Emit events via `db.insertEvent()` + `projector.projectEvent()` with `source: "openmcp_tail"`.
- Use `payload.log_offset` for idempotence — events table unique constraint on `(source, payload.log_offset)` prevents duplicates. Add unique index: `CREATE UNIQUE INDEX IF NOT EXISTS idx_events_tail_offset ON events(source, json_extract(payload_json, '$.log_offset')) WHERE source = 'openmcp_tail';` in schema.sql.
- Export class `OpenmcpTailer` with `start(abortSignal: AbortSignal)` and `stop()` methods.
- Tailer must not block daemon shutdown >100ms — use the AbortSignal.

### Task 2: Wire tailer into daemon

Modify `F:/projects/ccg-monitor/packages/daemon/src/index.ts`:
- After watcher/reconcile/projector start, check if openmcp log file exists. If yes, create and start `OpenmcpTailer`.
- Pass AbortSignal from a new AbortController. In `close()`, abort the controller before stopping other services.
- Add tailer to `DaemonRuntime` type if needed for testing.

### Task 3: Implement `ccgmon doctor`

Create `F:/projects/ccg-monitor/packages/cli/src/commands/doctor.ts`.

**Checks (PASS/FAIL table output):**
1. Daemon up — read `~/.ccgmon/daemon.port`, try `GET /healthz`. Fix: `ccgmon start`
2. DB writable — healthz response includes DB status. Fix: check file permissions
3. Claude hooks installed — read `~/.claude/settings.json`, check for `_ccgmon: true` marker. Fix: `ccgmon install-hooks`
4. openmcp log exists — check `~/.openmcp/openmcp.log` (or `OPENMCP_LOG_FILE`). Fix: ensure openmcp is configured
5. Last event recent — GET `/api/events`, check latest timestamp within 1h for any active project. Fix: run a Claude Code session

Output format:
```
ccgmon doctor
✓ Daemon reachable at 127.0.0.1:7878
✓ Database writable
✗ Claude hooks not installed — run: ccgmon install-hooks
✓ openmcp log found
✓ Recent events (last: 2m ago)

1 issue found.
```

Exit code 0 if all pass, 1 if any fail. Each FAIL line includes suggested fix.

### Task 4: Implement remaining CLI commands

Create these files, all in `F:/projects/ccg-monitor/packages/cli/src/commands/`:

**scan.ts** — `ccgmon scan <path>`: POST to running daemon's `/api/backfill` endpoint with `{ repo_root: path }`. Print count of synthetic events emitted. Add the `/api/backfill` POST endpoint to daemon (new file `F:/projects/ccg-monitor/packages/daemon/src/api/backfill.ts` — calls `backfillRepoPlans` and returns `{ emitted }`). Register it in `createApp`.

**prune.ts** — `ccgmon prune --older-than <Nd>` (e.g. `90d`): DELETE events older than cutoff. Add `pruneEventsOlderThan(cutoffDate: string)` to `CcgmonDatabase` — deletes from `events` WHERE `ts < cutoffDate`, but preserves the latest event per active plan. Print count deleted. Can run against DB directly (no daemon needed).

**export.ts** — `ccgmon export <out.json>`: GET `/api/projections/export` from daemon. Write response to file. Add the `/api/projections/export` GET endpoint to daemon (returns JSON with all 8 projection tables). New file: `F:/projects/ccg-monitor/packages/daemon/src/api/export.ts`.

**status.ts** — `ccgmon status`: GET `/healthz` + `/api/projects`. Print summary: daemon status, port, uptime, project count, event count.

**open.ts** — `ccgmon open`: Read port from `~/.ccgmon/daemon.port`, open `http://127.0.0.1:<port>` in default browser. Use `child_process.exec` with platform-appropriate command (`start` on Windows, `open` on macOS, `xdg-open` on Linux).

**stop.ts** — `ccgmon stop`: Read PID from `~/.ccgmon/daemon.pid`, send SIGTERM. Remove pid+port files. Print confirmation.

### Task 5: Wire `start --detach` and all commands into bin.ts

Modify `F:/projects/ccg-monitor/packages/cli/src/commands/start.ts`:
- Add `--detach` flag. When set: fork daemon via `child_process.spawn` with `detached: true, stdio: 'ignore'`, call `unref()`. Write PID to `~/.ccgmon/daemon.pid`. Print port and PID, return immediately.
- The forked process should run `node <daemon dist>/index.js --port <N>` (the daemon's existing CLI entry point).

Modify `F:/projects/ccg-monitor/packages/cli/src/bin.ts`:
- Wire all new commands: `doctor`, `scan`, `prune`, `export`, `status`, `open`, `stop`.

### Task 6: Tests + README

Create `F:/projects/ccg-monitor/packages/daemon/test/openmcp-tail.test.ts`:
- Test line parser with fixture log lines (happy path, retry, failure).
- Test offset bookmark persistence.
- Test idempotence (replaying same lines produces no duplicates).

Create log fixtures at `F:/projects/ccg-monitor/packages/daemon/test/fixtures/openmcp-log/`:
- `happy.log` — single successful run
- `retry.log` — run with retry
- `failed.log` — run that fails

Update `F:/projects/ccg-monitor/README.md` with 5-line quickstart:
```
npm i -g @ccgmon/cli
ccgmon start --detach
ccgmon install-hooks
ccgmon open
```
Plus brief commands reference table.

---

## Done When

1. `pnpm -r build` passes
2. `pnpm -r test` passes (all existing + new tests)
3. All CLI commands wired in `bin.ts` and have `--help`
4. `ccgmon doctor` returns structured PASS/FAIL output

## Commit Convention

One commit per task: `phase-6.task-N: <summary>`. Include all changed files for that task.

## Decision Notes

Write `F:/projects/ccg-monitor/docs/plans/2026-05-22-ccg-monitor/notes/phase-6.task-N.md` for each task.

## Response File

After all tasks, write `F:/projects/ccg-monitor/docs/plans/2026-05-22-ccg-monitor/responses/phase-6.md` using the standard EXTERNAL RESPONSE format with META, SUMMARY, FILES MODIFIED, COMMITS, NOTES, SPEC COMPLIANCE, NEXT sections. Final line: `Phase 6 completed. Response file: docs/plans/2026-05-22-ccg-monitor/responses/phase-6.md.`

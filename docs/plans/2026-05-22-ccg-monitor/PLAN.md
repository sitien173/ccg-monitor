# PLAN — ccg-monitor

**Slug:** `2026-05-22-ccg-monitor`
**Design:** [`design.md`](./design.md)
**UI handoff bundle:** [`ccg-monitor-handoff/`](./ccg-monitor-handoff/)
**Status:** ACTIVE — Phase 1 ready
**Repo to create:** new monorepo `ccg-monitor` (separate from `superpowers-ccgv2`).

## Goal

Local-first monitoring dashboard for developers running `superpowers-ccg` + `openmcp`. Read-only v1. Aggregates plans, phases, tasks, model routing, and review outcomes across all local projects on one machine.

## Routing Summary

| Phase | Owner | Side |
|---|---|---|
| 1 — Scaffold monorepo + shared schemas | `codex` | back |
| 2 — Daemon core (ingest + SQLite + SSE) | `codex` | back |
| 3 — FS watcher + projector | `codex` | back |
| 4 — Preact dashboard shell | `gemini` | front |
| 5 — Claude Code hook scripts | `codex` | back |
| 6 — openmcp log-tail + doctor + CLI polish | `codex` | back |

**Critical path:** P1 → P2 → P3. P4 can start after P2. P5 and P6 can start after P3. P4 and (P5+P6) can run in parallel.

---

## Phase 1: Scaffold monorepo + shared event schemas

**Owner:** `codex`

**Goal:** A working pnpm monorepo with shared zod event schemas and a CLI shell that prints version. Foundation for every later phase.

**Files:**
- Create: `package.json` (root, pnpm workspace)
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`, `.editorconfig`, `.nvmrc`
- Create: `packages/shared/package.json`
- Create: `packages/shared/src/events.ts` (zod schemas for all 14 event types + envelope)
- Create: `packages/shared/src/types.ts` (TypeScript types derived from zod)
- Create: `packages/shared/src/constants.ts` (default port 7878, retention days, paths)
- Create: `packages/shared/test/events.test.ts` (round-trip parse for every event type)
- Create: `packages/cli/package.json` (bin: `ccgmon`)
- Create: `packages/cli/src/bin.ts` (entrypoint, command dispatch)
- Create: `packages/cli/src/commands/version.ts`
- Create: `README.md` (placeholder, quickstart filled later in P6)

**Tasks:**
1. Init monorepo skeleton (`pnpm-workspace.yaml`, root `package.json` with workspace ranges, `tsconfig.base.json` with strict mode).
2. Implement `@ccgmon/shared`: zod schemas for envelope + all 14 event types from `design.md` §2, exported as discriminated union by `event_type`.
3. Implement `@ccgmon/cli` shell: argv parsing via `node:util.parseArgs`, only `--version` and `--help` wired. `ccgmon --version` returns root package version.
4. Add Vitest config + round-trip parse tests for every event type.

**Acceptance Criteria:**
- `pnpm install` resolves clean (no peer-dep warnings on @ccgmon/* packages).
- `pnpm -r build` produces `dist/` for `shared` and `cli`.
- `node packages/cli/dist/bin.js --version` prints the root version.
- `pnpm -r test` passes 14 event-type round-trip tests.
- Every event schema validates the example payload from `design.md` §2.

**Reviewer Checklist:**
- Envelope shape exactly matches `design.md` §2 (event_id v7, event_version, ts ISO, source, machine_id, project_id, repo_root, session_id, plan_slug, payload).
- No event type from `design.md` §2 missing.
- TS strict mode on; no `any` leaks in public types.
- No runtime deps in `shared` other than `zod`.

**Integration Checks:**
- `pnpm install`
- `pnpm -r build`
- `pnpm -r test`
- `node packages/cli/dist/bin.js --version`

---

## Phase 2: Daemon core — ingest API + SQLite + SSE bus

**Owner:** `codex`

**Goal:** Daemon process listening on `127.0.0.1:<first-free port in 7878..7888>` (per D1) that accepts `POST /events`, persists to SQLite, broadcasts via SSE, and answers minimal REST.

**Files:**
- Create: `packages/daemon/package.json` (deps: hono, @hono/node-server, better-sqlite3, zod)
- Create: `packages/daemon/src/index.ts` (boot, port binding, signal handling)
- Create: `packages/daemon/src/config.ts` (read `~/.ccgmon/config.toml`, defaults)
- Create: `packages/daemon/src/db.ts` (better-sqlite3 init, WAL pragma, migration runner)
- Create: `packages/daemon/src/schema.sql` (8 tables from `design.md` §2 + indexes)
- Create: `packages/daemon/src/bus.ts` (in-memory SSE pub/sub, backpressure)
- Create: `packages/daemon/src/api/events.ts` (POST /events handler + validation)
- Create: `packages/daemon/src/api/stream.ts` (GET /stream SSE)
- Create: `packages/daemon/src/api/projects.ts` (GET /api/projects)
- Create: `packages/daemon/src/api/plans.ts` (GET /api/plans/:projectId/:slug)
- Create: `packages/daemon/src/api/healthz.ts` (GET /healthz)
- Create: `packages/daemon/test/api.test.ts` (integration tests via @hono/node-server)
- Create: `packages/cli/src/commands/start.ts` (`ccgmon start` — foreground daemon)

**Tasks:**
1. Wire Hono app + node adapter, bind localhost only. Implement D1 port fallback: try 7878..7888 sequentially; first free wins; write chosen port to `~/.ccgmon/daemon.port`. Expose `--port <N>` flag to override (pins single port, no fallback).
2. Implement DB layer: open `~/.ccgmon/ccgmon.db`, set `journal_mode=WAL`, run `schema.sql` on first boot, no-op on subsequent boots (use `user_version` pragma).
3. Implement SSE bus: simple `Set<Response>` of subscribers + `broadcast(event)`; drop slow consumers after 1MB backlog.
4. Implement `POST /events`: validate via `@ccgmon/shared`, insert into `events`, broadcast. Implement `GET /stream`, `GET /api/projects` (read from `projects` table), `GET /api/plans/:id`, `GET /healthz` (uptime+version+event_count).
5. Implement `ccgmon start` command (foreground only in P2; `--detach` lands in P6).
6. Integration test: spawn daemon, POST 100 events concurrently, assert all 100 land in DB AND on a single SSE subscriber.

**Acceptance Criteria:**
- `ccgmon start` binds first free port in 7878..7888 and writes that port to `~/.ccgmon/daemon.port`.
- All 11 ports busy → exits non-zero with message instructing `--port <N>` override.
- `--port <N>` flag pins single port and skips fallback (fatal if busy).
- POST `/events` with invalid payload returns 400 with zod error path; valid returns 202.
- 100-event integration test passes (events persist + SSE receives all 100 in order).
- `/healthz` returns `{ ok: true, version, uptime_s, event_count, db_size_bytes }`.
- `/api/projects` returns `[]` on fresh DB.
- DB file created at `~/.ccgmon/ccgmon.db` with WAL companions.

**Reviewer Checklist:**
- Localhost binding enforced (no 0.0.0.0).
- Port fallback covers EADDRINUSE and EACCES; logs which port was chosen.
- `~/.ccgmon/daemon.port` removed on clean shutdown (SIGTERM handler).
- SQLite WAL enabled; verify via `PRAGMA journal_mode`.
- Events insert uses prepared statement (no SQL injection surface).
- SSE handler cleans up on client disconnect (no listener leak under repeated reconnects test).
- Single-writer pattern documented for projector (P3 will rely on it).
- Daemon exits clean on SIGTERM (closes DB, flushes WAL).

**Integration Checks:**
- `pnpm --filter @ccgmon/daemon build`
- `pnpm --filter @ccgmon/daemon test`
- `node packages/cli/dist/bin.js start &` then `curl -fsS "http://127.0.0.1:$(cat ~/.ccgmon/daemon.port)/healthz" | jq .ok`

---

## Phase 3: FS watcher + projector

**Owner:** `codex`

**Goal:** Daemon detects changes in `docs/plans/<slug>/*` across registered repos, parses them, emits synthetic events, and the projector keeps `projects/plans/phases/tasks/sessions_cache` projections in sync.

**Files:**
- Create: `packages/daemon/src/watcher.ts` (chokidar, debounce, root registry)
- Create: `packages/daemon/src/projector.ts` (single-writer event-log consumer)
- Create: `packages/daemon/src/parsers/handover.ts` (YAML frontmatter + body)
- Create: `packages/daemon/src/parsers/sessions.ts` (`.sessions.json`)
- Create: `packages/daemon/src/parsers/phase.ts` (`phase-N.md` task list + status)
- Create: `packages/daemon/src/parsers/plan.ts` (`PLAN.md` phase headings)
- Create: `packages/daemon/src/backfill.ts` (first-seen project scanner)
- Create: `packages/daemon/src/reconcile.ts` (5-minute mtime sweep)
- Create: `packages/daemon/test/projector.test.ts`
- Create: `packages/daemon/test/parsers.test.ts`
- Create: `packages/daemon/test/fixtures/plan-sample/` (a 4-phase plan mirroring this PLAN.md)
- Modify: `packages/daemon/src/index.ts` (start watcher + projector + reconcile)
- Modify: `packages/daemon/src/api/events.ts` (route ingested events through projector too)

**Tasks:**
1. Implement `watcher.ts`: chokidar watch list of registered roots (loaded from DB `projects` table), debounce 250ms per path, ignore `node_modules` and `.git`. Auto-register: any event whose `repo_root` is unknown creates a `projects` row first — UNLESS `.ccgmon-ignore` exists at repo root (D2), in which case daemon refuses registration and returns 200 with `ignored: true` flag.
2. Implement parsers: `handover.ts` extracts status/current_phase/next_action/read_first/blocked_on. `sessions.ts` reads backend→session_id map. `phase.ts` extracts phase id, title, owner, tasks array (checkbox state), files modified list. `plan.ts` enumerates phase headings + owners.
3. Implement `projector.ts`: single-writer consumer of the `events` table (poll the latest unprocessed `event_id`); for each event upsert into the appropriate projection table. Diff-aware — only write changed columns.
4. Implement `backfill.ts`: on new `repo_root` auto-register, walk `docs/plans/*`, emit synthetic events with `source=backfill` (do NOT fan-out via SSE).
5. Implement `reconcile.ts`: every 5 minutes, scan mtimes of all files known to projector; for any drift, re-emit synthetic event. Also re-check `.ccgmon-ignore` at each known repo root — if newly present, set `projects.status='IGNORED'` and stop watching (data preserved).
6. Tests: parser unit tests against fixtures; projector integration test that backfills the `plan-sample` fixture and asserts 1 project + 1 plan + 4 phases + ~10 tasks; reconciliation test that mutates a fixture file mtime and asserts re-emit.

**Acceptance Criteria:**
- Editing any of `.handover.md`, `.sessions.json`, `phase-*.md`, `PLAN.md` in a watched repo emits the correct synthetic event within 500ms (debounce + processing).
- Backfill of the `plan-sample` fixture produces exactly: 1 row in `projects`, 1 in `plans`, 4 in `phases`, tasks rows matching fixture checkbox counts.
- Backfill events do NOT appear on the SSE stream (verified by integration test).
- Reconcile picks up a file mutation that bypasses chokidar (simulate by touching mtime while watcher paused).
- Projector is single-writer (no two transactions on the same row in concurrent test).
- `.ccgmon-ignore` test: drop the file into a fixture root, send a synthetic event for that root → daemon returns ignored:true, no rows written. Touch existing project's root with the file → reconcile flips status to IGNORED on next tick.

**Reviewer Checklist:**
- Parsers tolerate missing files (no `.sessions.json` yet → emit empty `sessions.updated` not crash).
- Parsers reject malformed frontmatter with a logged warning, not a daemon crash.
- Auto-register hashes path consistently across OS path separators (normalize to forward slash).
- Projector idempotent: replaying same event twice does not double-write.
- Watcher cleans up watchers when a root is removed (no FD leak).

**Integration Checks:**
- `pnpm --filter @ccgmon/daemon test`
- Manual: `ccgmon start &`, copy `plan-sample` fixture into a real repo, `curl http://127.0.0.1:7878/api/projects` shows it.

---

## Phase 4: Preact dashboard shell

**Owner:** `gemini`

**Goal:** Browser UI at `http://127.0.0.1:7878/` rendering 3 views (Workspace W1 / Plan Detail P1 / Activity A1+drawer) + 4 states (empty / FAIL+findings / shortcut overlay / narrow <768px) driven by live data via `/api/*` and SSE. No build step — Preact + HTM via ESM/CDN.

**Files:**
- Create: `packages/ui/index.html`
- Create: `packages/ui/linear-tokens.css` (copy from `ccg-monitor-handoff/` bundle, unchanged)
- Create: `packages/ui/wireframe.css` (copy from handoff bundle, unchanged)
- Create: `packages/ui/app.js` (mount, theme/density/a11y class root, router init)
- Create: `packages/ui/router.js` (hash router: `/`, `/p/:projectId/plan/:slug`, `/activity`)
- Create: `packages/ui/sse.js` (EventSource subscription, reconnect with backoff)
- Create: `packages/ui/api.js` (fetch wrappers for `/api/projects`, `/api/plans/:id`, `/api/events?since=`)
- Create: `packages/ui/primitives.js` (port `WFOwner`, `WFGate`, `WFGateStrip`, `WFStatus`, `WFTopbar`, `WFProjectCard`, `WFPhaseCard`, `WFWorkspaceSidebar` from handoff JSX → HTM)
- Create: `packages/ui/views/workspace.js` (W1 grid only)
- Create: `packages/ui/views/plan.js` (P1 anchor only — phase tree + 3 rails)
- Create: `packages/ui/views/activity.js` (A1 stream layout + drawer-on-row-click from A2)
- Create: `packages/ui/states/empty.js`, `states/fail.js`, `states/shortcuts.js` (mounted conditionally inside views)
- Create: `packages/ui/settings.js` (theme/density/reduce-color/reduce-motion drawer, localStorage persist)
- Create: `packages/ui/keys.js` (g p, g a, /, ?, j/k, ⌘R bindings)
- Modify: `packages/daemon/src/index.ts` (static serve `packages/ui/` at `/`)

**Tasks:**
1. Set up `index.html` to load Preact+HTM via ESM CDN (`https://esm.sh/htm/preact/standalone`), wire `linear-tokens.css` + `wireframe.css` unchanged from the handoff bundle. Mount `app.js`.
2. Port primitives JSX → HTM: every `<Foo bar={x}>{c}</Foo>` becomes `` html`<${Foo} bar=${x}>${c}</>` ``. Keep prop shapes identical so CSS keeps working.
3. Build 3 ported views from the handoff (W1, P1, A1+A2-merged) reading from `api.js`; subscribe to SSE bus and re-render affected slices. Implement 4 states.
4. Wire keyboard shortcuts via `keys.js`; "?" overlay lists them. Implement Resume Handover button: copy `ccgmon resume <project> <slug>` to clipboard, show toast.
5. Implement settings drawer with theme/density/reduce-color/reduce-motion (persist localStorage, mirror to root class). Honor `prefers-reduced-motion` as default.
6. Daemon: static-serve UI files at `/`.

**Acceptance Criteria:**
- Hitting `http://127.0.0.1:7878/` returns `index.html` with all assets loading 200.
- Workspace view renders project cards from real `/api/projects` data; pulsing "live" dot reacts to SSE events arriving for that project.
- Plan Detail renders the vertical phase tree from `/api/plans/:id`; active phase auto-expands; Resume Handover button shows only when handover_status=ACTIVE; ⌘R copies CLI command.
- Activity view streams new events from SSE with slide-in (unless reduce-motion); clicking a row opens JSON drawer.
- All 4 states render (empty workspace if `/api/projects` returns `[]`; FAIL+findings when phase review=FAIL; "?" overlay opens; layout reflows ≤768px without horizontal scroll).
- Theme toggle persists across reload; reduce-color toggle removes gate hues but keeps icons/labels.
- Lighthouse a11y score ≥95 on Workspace, Plan Detail, Activity routes.
- No build step required — `index.html` runs directly in browser from disk for local dev.

**Reviewer Checklist:**
- HTM port is faithful: no rendered DOM diffs vs the handoff wireframes for the 3 chosen variants.
- `WFOwnerDot`/`WFOwner` use monogram only (no real provider logos).
- Phase tree has `role="tree"` + `treeitem` + `aria-expanded`; arrow-key nav works.
- Activity feed has `role="log"` + `aria-live="polite"`, debounced ≤1 announcement/2s.
- Skip-link is first focusable element. Focus ring visible 2px ≥3:1.
- `prefers-reduced-motion: reduce` disables pulse + slide-in + FAIL pulse animations.
- No CDN scripts beyond `esm.sh/htm/preact/standalone` (no React+Babel — that was design-time only).
- SSE reconnects with exponential backoff capped at 30s.

**Integration Checks:**
- `pnpm --filter @ccgmon/daemon build && ccgmon start`
- `curl -fsS http://127.0.0.1:7878/ | head -5` (verify HTML).
- Lighthouse CLI: `npx lighthouse http://127.0.0.1:7878/ --only-categories=accessibility --quiet --chrome-flags="--headless"` ≥95.
- Manual smoke: copy `plan-sample` fixture into a real repo, watch project appear in Workspace, click into Plan Detail, see phase tree.

---

## Phase 5: Claude Code hook scripts

**Owner:** `codex`

**Goal:** Hook scripts that POST to daemon from inside Claude Code, plus `ccgmon install-hooks` to wire them idempotently into `~/.claude/settings.json`.

**Files:**
- Create: `packages/integrations/claude-hooks/package.json`
- Create: `packages/integrations/claude-hooks/src/session-start.ts`
- Create: `packages/integrations/claude-hooks/src/tool-pre.ts`
- Create: `packages/integrations/claude-hooks/src/tool-post.ts`
- Create: `packages/integrations/claude-hooks/src/session-stop.ts`
- Create: `packages/integrations/claude-hooks/src/lib/post.ts` (fail-silent fetch with AbortController, 50ms budget)
- Create: `packages/integrations/claude-hooks/test/hooks.test.ts`
- Create: `packages/cli/src/commands/install-hooks.ts` (read/merge `~/.claude/settings.json` with marker block, supports `--uninstall` rollback)
- Create: `packages/cli/src/lib/settings-merge.ts`
- Create: `packages/cli/test/install-hooks.test.ts`

**Tasks:**
1. Implement 4 hook scripts. Each reads stdin (hook context from Claude Code), constructs the correct event payload, POSTs to `CCGMON_URL` (default `http://127.0.0.1:7878`) via shared `post.ts` with 50ms AbortController budget. Tool filter on `tool-pre`/`tool-post`: only `Edit | Write | Bash | Task | mcp__*`. `CCGMON_URL=off` → exit 0 immediately.
2. Payload hygiene: `tool.pre` includes only `tool_name` + `input_preview` (first 200 chars). `route.*` family is NOT emitted from hooks (those come from P6 openmcp shim). Never include full prompt body.
3. Implement `ccgmon install-hooks`: idempotently merge a JSON block into `~/.claude/settings.json` between markers `// ccg-monitor:start` and `// ccg-monitor:end`. Resolve hook script absolute paths from `node_modules/@ccgmon/claude-hooks/dist/`. `--uninstall` removes the block cleanly.
4. e2e test: spin up daemon, run hook script with mock stdin, assert event lands in DB. Verify `--uninstall` restores original file byte-for-byte.

**Acceptance Criteria:**
- `ccgmon install-hooks` is idempotent — running twice produces identical `settings.json`.
- `ccgmon install-hooks --uninstall` restores the file with byte-for-byte equality to its pre-install state (assuming no manual edits inside the marker block).
- Daemon offline → each hook exits 0 within 50ms (verified by `time` measurement in test).
- `CCGMON_URL=off` short-circuits before any network call (verified by intercepting fetch).
- e2e: live Claude Code session produces ≥1 of each event type: `session.started`, `tool.pre`, `tool.post`, `session.stopped`.
- No event payload contains the full prompt body or full file contents (regex assertion in test).

**Reviewer Checklist:**
- Hooks never throw on bad stdin (return 0 with stderr warning).
- AbortController actually fires at 50ms (not 100ms; not unbounded).
- `settings-merge.ts` preserves user's existing hooks order and unrelated keys.
- Install-hooks fails clearly if `~/.claude/settings.json` is malformed JSON (don't overwrite — abort).
- No dependency on the daemon being up at install time.

**Integration Checks:**
- `pnpm --filter @ccgmon/claude-hooks test`
- `pnpm --filter @ccgmon/cli test`
- Manual: `ccgmon install-hooks`, start Claude Code in any project, run a few tool calls, `curl http://127.0.0.1:7878/api/events?since=0 | jq 'length'` > 0.

---

## Phase 6: openmcp log-tail + doctor + CLI polish

**Owner:** `codex`

**Goal:** Tail openmcp's structured log to emit `route.*` events (per D3 — no shim, no fork), ship `ccgmon doctor` for end-to-end health, and round out remaining CLI commands.

**Files:**
- Create: `packages/daemon/src/openmcp-tail.ts` (log tailer + line parser + offset bookmark)
- Create: `packages/daemon/test/openmcp-tail.test.ts` (fixtures: happy, retry, failure, rotation)
- Create: `packages/daemon/test/fixtures/openmcp-log/{happy.log,retry.log,failed.log}`
- Create: `packages/cli/src/commands/doctor.ts`
- Create: `packages/cli/src/commands/scan.ts` (one-shot backfill scan; POSTs to running daemon)
- Create: `packages/cli/src/commands/prune.ts` (`--older-than 90d`)
- Create: `packages/cli/src/commands/export.ts` (dump projections to JSON)
- Create: `packages/cli/src/commands/status.ts`
- Create: `packages/cli/src/commands/open.ts` (browser open)
- Create: `packages/cli/src/commands/stop.ts`
- Modify: `packages/cli/src/commands/start.ts` (add `--detach`, write `~/.ccgmon/daemon.pid`)
- Modify: `packages/daemon/src/index.ts` (start `openmcp-tail` if log file exists)
- Modify: `README.md` (5-line quickstart + commands reference)
- Modify: `packages/daemon/src/api/*.ts` (add `/api/projections/export` endpoint used by `ccgmon export`)

**Tasks:**
1. Implement openmcp log tailer: resolve log path via `OPENMCP_LOG_FILE` env or default `~/.openmcp/openmcp.log`. Use `fs.watch` + read-from-bookmark; persist last-read offset in DB (`openmcp_tail_state` row, single record). Detect rotation via inode change + truncation; reset offset.
2. Implement line parser: anchored regex for the 5 patterns in D3 table. Emit `route.requested` / `route.dispatched` / `route.completed` / `route.failed` events with `source=openmcp_tail` and `payload.log_offset` for idempotence. Buffer `retry: ... error_class=X` and apply to the next `run() done success=False` in same backend stream.
3. Idempotence: events table has unique constraint on `(source, payload.log_offset)`; replaying tailer never duplicates.
4. Implement `ccgmon doctor`: PASS/FAIL table covering daemon up, port reachable (from `~/.ccgmon/daemon.port`), DB writable, claude hooks installed (read `~/.claude/settings.json`), openmcp log file exists+readable, tailer current (last_read_offset within 5s of file size), last event timestamp within last hour for active project. Each FAIL line includes a suggested fix.
5. Implement remaining CLI commands: `scan <path>`, `prune --older-than <Nd>`, `export <out.json>`, `status`, `open`, `stop`. Wire `start --detach` (fork via `child_process.spawn detached:true`, write PID + port).
6. Write README quickstart: `npm i -g @ccgmon/cli` → `ccgmon start --detach` → `ccgmon install-hooks` → `ccgmon open`. **No `install-shim` step** — tailer auto-starts.

**Acceptance Criteria:**
- Each `mcp__openmcp__run` call (codex or agy) produces ≥2 `route.*` events end-to-end (requested + completed/failed); retry runs add `dispatched`; failure runs include `error_class` from the closed enum (`timeout|network|fatal|cancelled|unknown`).
- No event payload contains the `prompt` field or any prompt-derived text — tailer never reads outside the log line.
- Idempotence: deleting `openmcp_tail_state` and re-running tailer over the same log produces zero duplicate events.
- Log rotation handled: rotate fixture mid-test, tailer follows to new file, no events lost.
- `ccgmon doctor` returns exit 0 green when healthy; non-zero with actionable error per FAIL line.
- `ccgmon scan <path>` triggers backfill via daemon API and prints number of synthetic events emitted.
- `ccgmon prune --older-than 90d` deletes only events older than cutoff; projections untouched.
- `ccgmon export out.json` writes a JSON file with all 8 projection tables.
- `ccgmon start --detach` returns immediately and daemon survives terminal close; PID + port written to `~/.ccgmon/`.
- `ccgmon stop` reads PID and terminates daemon cleanly; removes pid/port files.

**Reviewer Checklist:**
- Tailer never blocks daemon shutdown >100ms (uses AbortSignal).
- Regex patterns anchored at line start to avoid mid-line collisions.
- `error_class` enum closed and exhaustive (`timeout|network|fatal|cancelled|unknown`); unknown values logged as warning.
- `doctor` checks are read-only — no side effects on user settings.
- Quickstart in README works literally as written on a clean machine.
- Prune does NOT touch the latest event of any active plan (anchor for projection rebuild safety).
- `~/.ccgmon/daemon.{pid,port}` removed on clean shutdown.

**Integration Checks:**
- `pnpm -r build && pnpm -r test`
- `ccgmon doctor`
- Manual e2e: from a real superpowers-ccgv2 session, invoke `mcp__openmcp__run` once with codex and once with agy; verify ≥4 `route.*` events appear in Activity view of the UI.

---

## Out of Scope (deferred post-v1)

- Auth, multi-user, team views, remote sync.
- Plan editor / phase advance / review submission (read-only only).
- Mobile native app — narrow-reflow web is enough.
- Notifications (push, email, Slack).
- Analytics dashboards (model cost, latency trends).
- Plugin auto-install of daemon (user runs `ccgmon start` manually in v1).
- Autostart service installation (`install-service` for Windows/macOS/Linux).
- Single-binary distribution (pkg/sea).
- Upstream openmcp PR adding `OPENMCP_EVENT_HOOK_URL` env (stretch v1.1; log-tail remains primary in v1).
- Global blocklist in `~/.ccgmon/config.toml` (covered for v1 by per-repo `.ccgmon-ignore`).

## Decisions (resolved 2026-05-22)

### D1 · Port fallback (affects P2)

- Daemon tries ports 7878..7888 in sequence; first free wins.
- Chosen port written to `~/.ccgmon/daemon.port` immediately after bind.
- CLI (`open`, `status`, `stop`) reads that file (not hard-coded 7878).
- Hooks/shim resolve URL: `CCGMON_URL` env → else `~/.ccgmon/daemon.port` → else default 7878.
- All 11 ports busy → fatal error with `--port <N>` override hint.

### D2 · Per-project opt-out (affects P3)

- Presence of `.ccgmon-ignore` file (any content) in repo root → daemon **refuses auto-register** and excludes path from watcher.
- Already-registered repo that later gains `.ccgmon-ignore` → reconciliation tick archives project to `status=IGNORED` (data preserved, not deleted).
- Per-shell opt-out remains `CCGMON_URL=off` env.
- Global blocklist in `~/.ccgmon/config.toml` deferred post-v1.

### D3 · openmcp integration = log-tail (affects P6)

openmcp has no pre/post hook mechanism. Confirmed by reading `C:/Users/ngosi/.mcp-servers/openmcp/openmcp/src/openmcp/server.py` — `run()` is a plain FastMCP tool function.

Strategy: daemon tails `~/.openmcp/openmcp.log` (rotating 5MB × 3) and parses structured INFO lines to emit `route.*` events. Zero changes to openmcp source.

Log → event mapping:

| Log line pattern (anchored regex) | Event |
|---|---|
| `run\(\) backend=(\w+) session_id=<new>` | `route.requested` |
| `run\(\) backend=(\w+) session_id=(\S+)` (existing id) | `route.requested` with `attempt>1` flag |
| `retry: preserving SESSION_ID=(\S+)` | `route.dispatched` |
| `run\(\) done backend=(\w+) success=True .* session_id=(\S+)` | `route.completed` |
| `run\(\) done backend=(\w+) success=False .* attempts=(\d+)` + nearest `error_class=(\w+)` | `route.failed` |

Implementation notes:
- Tail uses native `fs.watch` + read-from-bookmark; idempotent via `events.payload.log_offset`.
- Handle rotation: detect inode change + truncation; reset offset.
- Tailer starts automatically with daemon when `OPENMCP_LOG_FILE` exists (or default `~/.openmcp/openmcp.log`); no `install-shim` command.
- Tradeoff: `route.dispatched` only emitted when retry occurs (single-attempt happy path collapses requested→completed). Acceptable for UI.

Stretch goal v1.1 (NOT in scope): contribute upstream `OPENMCP_EVENT_HOOK_URL` env to openmcp for direct HTTP emit; log tail becomes fallback.

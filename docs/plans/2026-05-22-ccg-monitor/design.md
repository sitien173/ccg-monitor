# ccg-monitor — Design Document

**Status:** Confirmed design, ready for `writing-plans`.
**Date:** 2026-05-22
**Slug:** `2026-05-22-ccg-monitor`

## Goal

Local-first monitoring dashboard for developers running the Claude Code `superpowers-ccg` plugin + `openmcp`. Aggregates plans, phases, tasks, model routing, and review outcomes across all local projects on one machine. **Read-only in v1** except a single "Resume Handover" action that copies a CLI command to clipboard.

## Cross-Validation Summary (Codex back-side + Gemini front-side)

**Convergent picks:**
- Local-first, **one daemon per machine** (not per project).
- **Push events** from hooks + openmcp wrappers; UI subscribes via **SSE**.
- Filesystem reconciliation as safety net for missed events.
- Event-sourced log → projection tables.

**Codex picks:** SQLite WAL; `project_id = sha1(normalized_path + remote_url_if_any)`; machine_id UUID; 14 event types covering session/tool/plan/phase/route/gate/review/handover; first-run backfill scan of `docs/plans/*`.

**Gemini picks:** Preact via HTM/ESM (no build step); 3 views — Workspace Grid / Plan Detail (vertical phase tree) / Live Activity; color-coded gate chevrons with redundant icon+label; pulsing "Resume Handover" button when `.handover.md` is ACTIVE.

## Confirmed Decisions

| Decision | Choice |
|---|---|
| Scope (v1) | Read-only monitor (no edit/control plane) |
| Distribution | Separate repo + standalone CLI (`ccgmon`) |
| Project discovery | Auto-register via hook events (no config file required) |
| Event sources | FS watcher + Claude Code hooks + openmcp wrappers |
| Backend stack | Node.js + TypeScript (Hono + better-sqlite3 + chokidar) |
| UI variant — Workspace | W1 grid (anchor) |
| UI variant — Plan Detail | P1 anchor (vertical tree + 4-col rail) |
| UI variant — Activity | A1 stream layout + drawer-on-row-click |
| States in v1 | empty, FAIL+findings, shortcut overlay (?), narrow <768px reflow |

---

## Section 1 — Architecture Overview

**Name:** `ccg-monitor` (repo), CLI: `ccgmon`.

```
┌───────────────────────────────────────────────────────────────┐
│  Local machine                                                │
│  ┌─────────────┐    POST /events    ┌───────────────────┐    │
│  │ Claude Code │ ──────────────────▶│                   │    │
│  │ + plugin    │                    │                   │    │
│  │ hooks       │                    │                   │    │
│  └─────────────┘                    │   ccgmon daemon   │    │
│                                     │   (Node + TS)     │    │
│  ┌─────────────┐    POST /events    │                   │    │
│  │ openmcp     │ ──────────────────▶│  ┌─────────────┐  │    │
│  │ pre/post    │                    │  │ ingest API  │  │    │
│  └─────────────┘                    │  │ (Hono)      │  │    │
│                                     │  ├─────────────┤  │    │
│  ┌─────────────┐    chokidar        │  │ FS watcher  │  │    │
│  │ docs/plans/ │ ──────────────────▶│  ├─────────────┤  │    │
│  │ **/*        │                    │  │ projector   │  │    │
│  └─────────────┘                    │  │ → SQLite    │  │    │
│                                     │  ├─────────────┤  │    │
│  ┌─────────────┐    SSE /stream     │  │ SSE bus     │  │    │
│  │ Browser UI  │ ◀──────────────────│  └─────────────┘  │    │
│  │ (Preact)    │    HTTP /api/*     │                   │    │
│  └─────────────┘                    └───────────────────┘    │
└───────────────────────────────────────────────────────────────┘
```

**Process model:** một daemon duy nhất per machine, bind `127.0.0.1:7878`. Read-only API → không cần auth, chỉ localhost binding.

**Modules:**
- `ingest` — `POST /events`, validate (zod), append vào `events` table, fan-out qua SSE bus.
- `watcher` — chokidar watch các root đã auto-register, debounce 250ms, parse `.handover.md`/`.sessions.json`/phase files → emit synthetic events.
- `projector` — single-writer pattern, consume event log, upsert projections.
- `api` — `/api/projects`, `/api/plans/:id`, `/api/events?since=...`, SSE `/stream`, `/healthz`.
- `ui` — Preact + HTM/ESM served từ daemon (`GET /`), không build step.

**Auto-register:** event đầu tiên kèm `repo_root` chưa biết → tạo project record với `project_id = sha1(normalized_path + remote_url_if_any)`.

---

## Section 2 — Event Schema & Data Model

**Event envelope:**

```json
{
  "event_id": "uuid v7",
  "event_type": "route.dispatched",
  "event_version": 1,
  "ts": "2026-05-22T10:15:30.123Z",
  "source": "openmcp" | "claude_hook" | "fs_watcher" | "backfill",
  "machine_id": "uuid",
  "project_id": "sha1(...)",
  "repo_root": "F:/projects/superpowers-ccgv2",
  "session_id": "claude-session-uuid | null",
  "plan_slug": "2026-05-22-ccg-monitor | null",
  "payload": { ... }
}
```

**Event types:**

| Source | Type | Key payload fields |
|---|---|---|
| claude_hook | `session.started` | cwd, transcript_path |
| claude_hook | `tool.pre` | tool_name, input_preview |
| claude_hook | `tool.post` | tool_name, duration_ms, error? |
| claude_hook | `session.stopped` | reason, duration_ms |
| openmcp | `route.requested` | backend (codex/agy), cd, prompt_bytes |
| openmcp | `route.dispatched` | session_id, attempt |
| openmcp | `route.completed` | success, duration_ms, output_bytes |
| openmcp | `route.failed` | error_class, message |
| fs_watcher | `plan.discovered` | slug, status, created_at |
| fs_watcher | `plan.updated` | slug, diff_summary |
| fs_watcher | `phase.updated` | slug, phase_id, status, owner |
| fs_watcher | `handover.updated` | slug, status (ACTIVE/COMPLETED), current_phase |
| fs_watcher | `sessions.updated` | slug, sessions[] |
| (derived) | `gate.passed` / `gate.failed` | gate (plan/execute/review), result, debt_notes |
| (derived) | `review.recorded` | spec_status, quality_findings[] |

**SQLite schema (8 tables):**

- `events` — append-only event log (id, type, ts, project_id, session_id, plan_slug, source, payload JSON). Source of truth.
- `projects` — project_id PK, repo_root, remote_url, first_seen, last_seen.
- `plans` — (project_id, slug) PK, title, status (DRAFT/ACTIVE/COMPLETED/ARCHIVED), current_phase, handover_status, updated_at.
- `phases` — (project_id, slug, phase_id) PK, title, owner (claude/codex/gemini), gate_state, started_at, completed_at.
- `tasks` — (project_id, slug, phase_id, task_id) PK, title, status, files[].
- `routes` — route_id PK, project_id, session_id, backend, cd, status, started_at, completed_at, error.
- `reviews` — (project_id, slug, phase_id) PK, spec_status, quality_findings JSON, final_status, ts.
- `sessions_cache` — (project_id, slug, backend) PK, mcp_session_id, last_used. Mirror của `.sessions.json`.

**Indexing:** `events(project_id, ts DESC)`, `events(session_id)`, `plans(status, updated_at DESC)`.

**Retention:** events giữ full 90 ngày, projections vĩnh viễn. CLI `ccgmon prune` để tay.

---

## Section 3 — Integration Points

**A. Claude Code plugin hooks (ship trong superpowers-ccg):**

| Hook | Script | Action |
|---|---|---|
| `SessionStart` | `hooks/ccgmon-session-start.js` | POST `session.started` |
| `PreToolUse` | `hooks/ccgmon-tool-pre.js` | POST `tool.pre` (lọc tool noise — chỉ Edit/Write/Bash/Task/mcp__) |
| `PostToolUse` | `hooks/ccgmon-tool-post.js` | POST `tool.post` (duration, error flag) |
| `Stop` | `hooks/ccgmon-session-stop.js` | POST `session.stopped` |

Tất cả hooks **fail-silent**: nếu daemon không chạy, hook return 0, không log lỗi, không block Claude. `CCGMON_URL=off` để tắt.

**B. openmcp wrappers:**

```
route.requested  → trước khi dispatch (backend, cd, prompt size)
route.dispatched → sau khi spawn backend process (session_id assigned)
route.completed  → khi success=true (duration, output size)
route.failed     → khi success=false / timeout / blocked
```

Wrapper là thin shim trong openmcp: capture args → emit pre-event → invoke real handler → emit post-event. Cùng `CCGMON_URL` env. Cùng fail-silent semantics. Payload **không chứa prompt body** (chỉ `prompt_bytes`).

**C. Filesystem watcher (trong daemon):**

`chokidar.watch([...auto_registered_roots], { ignored: /node_modules|\.git/ })` chỉ quan tâm:

```
docs/plans/<slug>/.handover.md
docs/plans/<slug>/.sessions.json
docs/plans/<slug>/phase-*.md
docs/plans/<slug>/plan.md
```

Pipeline: debounce 250ms → parse → diff với last-known projection → emit synthetic event → projector cập nhật.

**Backfill** khi project mới auto-register: scan toàn bộ `docs/plans/*` của repo root, emit events với `source=backfill`, không fan-out qua SSE.

**Reconciliation:** mỗi 5 phút daemon scan lại `mtime` của files đã biết.

---

## Section 4 — UI/UX (Claude Design Handoff)

UI/UX được Claude Design produce dưới dạng wireframe bundle:
**Source:** `docs/plans/2026-05-22-ccg-monitor/ccg-monitor-handoff/ccg-monitor/project/`

### Bundle Contents

| File | Purpose |
|---|---|
| `index.html` | Entry, loads React+Babel via CDN |
| `app.jsx` | Design Canvas orchestrator + Tweaks panel |
| `wireframe-primitives.jsx` | `WFOwner`, `WFGate`, `WFGateStrip`, `WFStatus`, `WFTopbar`, `WFProjectCard`, `WFPhaseCard`, `WFWorkspaceSidebar` |
| `view-workspace.jsx` | 3 workspace variants (W1 grid / W2 grouped / W3 dense table) |
| `view-plan.jsx` | 4 plan variants (P1 anchor / P2 kanban / P3 outline / P4 timeline) + 3 rails |
| `view-activity.jsx` | 2 activity variants (A1 stream / A2 split-drawer) |
| `view-states.jsx` | 5 states (empty / FAIL+findings / shortcuts / narrow / light) |
| `wireframe-data.js` | Mock data: 6 projects, 4-phase plan, 9 events, 60-bucket sparkline, FAIL phase fixture |
| `linear-tokens.css` | Linear design tokens (color, type, spacing). Primary `#5e6ad2` |
| `wireframe.css` | Component styles |

### v1 Ship Selection

| View | Variant | File |
|---|---|---|
| Workspace | **W1 grid (anchor)** | `view-workspace.jsx` → `WFWorkspaceGrid` |
| Plan Detail | **P1 anchor (vertical tree + 4-col rail)** | `view-plan.jsx` → `WFPlanAnchor` |
| Activity | **A1 stream + drawer-on-click** | merge `WFActivityStream` (layout) + `WFActivitySplit` (drawer) |
| States | empty / FAIL+findings / shortcut overlay / narrow <768px | `view-states.jsx` (4 of 5) |

### Visual Language (locked in)

- **Gate chevrons:** Plan=amber, Execute=violet, Review=emerald. State via `data-state` attr (pending/active/done/failed) + redundant icon + label.
- **Owner badges:** monogram-only (C / X / G — no real logos). claude=indigo, codex=cyan, gemini=fuchsia.
- **Status badges:** PASS (emerald ✓), PASS_WITH_DEBT (amber ⚠), FAIL (crimson ✕ + pulse), BLOCKED (slate ⊘).
- **Resume Handover:** sticky button trong plan header khi `handover_status=ACTIVE`, copy CLI command + ⌘R kbd shortcut.
- **Sticky plan-level gate strip** trong Plan Detail header (key affordance, không cuộn mất).

### Accessibility (WCAG 2.2 AA — non-negotiable)

- All text ≥4.5:1 contrast; ≥3:1 for large text. Verify both themes.
- Color never solo signal — always paired with icon + label.
- "Reduce color" toggle → neutral shades + icons only.
- "Reduce motion" honors `prefers-reduced-motion` (no pulse, instant inserts).
- Phase tree: `role="tree"` + `role="treeitem"` + `aria-expanded` + arrow-key nav (↑/↓/←/→/Home/End).
- Activity feed: `role="log"` + `aria-live="polite"` (debounced ≤1 announcement / 2s).
- Skip-link first focusable; visible focus ring 2px ≥3:1.
- Reflow at 320px without horizontal scroll (except code blocks).
- 200% zoom must not clip content.

### Port Plan (handoff → production)

The bundle uses React + Babel (CDN). v1 production UI ports to **Preact + HTM via ESM** (no build):

```html
<script type="module">
  import { html, render } from 'https://esm.sh/htm/preact/standalone';
  // ...
</script>
```

- Keep `linear-tokens.css` and `wireframe.css` as-is (CSS, no port needed).
- Convert JSX → HTM template literals. `<Foo bar={x}>{c}</Foo>` → `` html`<${Foo} bar=${x}>${c}</>` ``.
- Replace mock `WF_DATA` with `fetch('/api/projects')` + SSE subscription.
- Drop `DesignCanvas`/`DCSection`/`DCArtboard` (those are Claude Design framework only).
- Keep `Tweaks` panel as a settings drawer (theme/density/reduce-color/reduce-motion/expand-all + remove `mockState`).

---

## Section 5 — Phasing & Milestones

6 phases, ≤4 tasks/phase, một owner/phase.

### Phase 1 · Scaffold monorepo + shared schemas (codex)
**Files:** `package.json`, `pnpm-workspace.yaml`, `packages/shared/{events.ts,types.ts,constants.ts}`, `packages/cli/{bin.ts,commands/version.ts}`, `tsconfig.base.json`, `.gitignore`.
**Done when:** `pnpm i && pnpm build` xanh; `node packages/cli/dist/bin.js --version` in version; zod schemas cho 14 event types compile + có unit tests round-trip.

### Phase 2 · Daemon core (ingest API + SQLite + SSE) (codex)
**Files:** `packages/daemon/src/{index.ts,db.ts,schema.sql,bus.ts,api/{events.ts,projects.ts,plans.ts,stream.ts,healthz.ts}}`, `packages/daemon/test/api.test.ts`.
**Done when:** `ccgmon start` lên port 7878; POST `/events` insert vào `events` + fan-out SSE; `/api/projects` trả []; `/healthz` trả version+uptime; integration test gửi 100 events → SSE đọc đủ 100.

### Phase 3 · FS watcher + projector (codex)
**Files:** `packages/daemon/src/{watcher.ts,projector.ts,parsers/{handover.ts,sessions.ts,phase.ts,plan.ts}}`, `packages/daemon/test/projector.test.ts`.
**Done when:** chokidar phát hiện thay đổi `docs/plans/<slug>/*` → emit synthetic event đúng schema; projector cập nhật `projects/plans/phases/tasks`; backfill 1 plan có 4 phases → tạo đúng 4 phase rows + 1 plan + 1 project; reconciliation tick 5 phút detect file bị miss.

### Phase 4 · Preact dashboard shell (gemini)
**Files:** `packages/ui/{index.html,linear-tokens.css,wireframe.css,app.js,primitives.js,views/{workspace.js,plan.js,activity.js},states/{empty.js,fail.js,shortcuts.js},router.js,sse.js}`, daemon static-serve route.
**Done when:** `http://127.0.0.1:7878` render được 3 views (W1 / P1 / A1+drawer) từ data live qua `/api/*` + SSE; 4 states hoạt động; theme/density/reduce-color/reduce-motion toggles persist localStorage; keyboard `g p`, `g a`, `/`, `?`, `j/k`, ⌘R đúng; Lighthouse a11y ≥95.

### Phase 5 · Claude Code hook scripts (codex)
**Files:** `packages/integrations/claude-hooks/src/{session-start.ts,tool-pre.ts,tool-post.ts,session-stop.ts}`, `packages/cli/src/commands/install-hooks.ts`.
**Done when:** `ccgmon install-hooks` idempotent ghi vào `~/.claude/settings.json` với markers; 4 hooks POST đúng event type kèm payload tối thiểu (không leak prompt body); daemon offline → hook return 0 trong <50ms (AbortController); `CCGMON_URL=off` skip; e2e: phiên Claude Code thật → daemon nhận đủ `session.started`, ≥1 `tool.pre`/`tool.post`, `session.stopped`.

### Phase 6 · openmcp shim + doctor + CLI polish (codex)
**Files:** `packages/integrations/openmcp-shim/src/{pre.ts,post.ts,index.ts}`, `packages/cli/src/commands/{install-shim.ts,doctor.ts,scan.ts,prune.ts,export.ts,status.ts,open.ts,stop.ts}`, `README.md`.
**Done when:** `ccgmon install-shim` patch openmcp config + rollback được; mỗi `mcp__openmcp__run` emit đủ 4 route events với `prompt_bytes` (không `prompt`); `ccgmon doctor` green cho daemon/hooks/shim/db/port; `ccgmon scan|prune|export|status|open|stop` hoạt động; README có quickstart 5 dòng.

**Routing summary:** 5 phases codex, 1 phase gemini, 0 phases Claude direct.

**Critical path:** P1 → P2 → P3 (back-end foundation). P4 chạy được sau P2. P5 và P6 chạy được sau P3. P4 và P5+P6 có thể song song.

---

## Out of Scope (v1)

- Auth, multi-user, team views, remote sync.
- Plan editor / phase advance / review submission (read-only only).
- Mobile native app — narrow-reflow web is enough.
- Notifications (push, email, Slack).
- Analytics dashboards (model cost, latency trends) — only raw events visible.
- Plugin auto-install of daemon (user runs `ccgmon start` manually in v1).

## Open Questions (defer to writing-plans)

- Exact port allocation strategy nếu 7878 đã chiếm — fallback range hay error?
- Per-project opt-out cơ chế (.ccgmon-ignore file?) nếu user muốn skip 1 repo.
- Whether to ship a single-binary build (pkg/sea) sau v1 cho non-Node users.

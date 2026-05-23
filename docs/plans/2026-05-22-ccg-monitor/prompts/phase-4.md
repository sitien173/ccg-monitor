You own one implementation phase with 6 tasks for ccg-monitor Phase 4 — Preact dashboard shell.

## Original User Request
Local-first monitoring dashboard for `superpowers-ccg` + `openmcp`. Browser UI at `http://127.0.0.1:7878/` rendering 3 views + 4 states, driven by live data via REST + SSE. No build step — Preact + HTM via ESM/CDN.

## Phase
Port the Claude Design handoff wireframes (React + Babel) to Preact + HTM/ESM. Build 3 views (Workspace W1, Plan Detail P1, Activity A1+drawer), 4 states (empty, FAIL+findings, shortcut overlay, narrow <768px), settings drawer, keyboard shortcuts, SSE subscription. Daemon static-serves the UI files.

## Tasks
- task-1: Set up `F:/projects/ccg-monitor/packages/ui/index.html` loading Preact+HTM via ESM CDN (`https://esm.sh/htm/preact/standalone`). Copy `linear-tokens.css` and `wireframe.css` from the handoff bundle (`F:/projects/ccg-monitor/docs/plans/2026-05-22-ccg-monitor/ccg-monitor-handoff/ccg-monitor/project/`) into `F:/projects/ccg-monitor/packages/ui/`. Mount `app.js` as the root component. Implement hash router in `F:/projects/ccg-monitor/packages/ui/router.js` for routes: `/` (workspace), `/p/:projectId/plan/:slug` (plan detail), `/activity`.
- task-2: Port wireframe primitives from handoff JSX to HTM in `F:/projects/ccg-monitor/packages/ui/primitives.js`. Every `<Foo bar={x}>{c}</Foo>` becomes `` html`<${Foo} bar=${x}>${c}</>` ``. Port these components: `WFOwner`, `WFOwnerDot`, `WFGate`, `WFGateStrip`, `WFStatus`, `WFTopbar`, `WFProjectCard`, `WFPhaseCard`, `WFWorkspaceSidebar`. Keep prop shapes identical so CSS works unchanged. Implement `F:/projects/ccg-monitor/packages/ui/api.js` (fetch wrappers for `/api/projects`, `/api/plans/:projectId/:slug`, `/api/events?since=`) and `F:/projects/ccg-monitor/packages/ui/sse.js` (EventSource subscription with exponential backoff reconnect capped at 30s).
- task-3: Build the 3 views reading from `api.js` + SSE: Workspace (`F:/projects/ccg-monitor/packages/ui/views/workspace.js`) renders W1 project card grid from `/api/projects` with pulsing "live" dot reacting to SSE events. Plan Detail (`F:/projects/ccg-monitor/packages/ui/views/plan.js`) renders P1 vertical phase tree from `/api/plans/:id` with active phase auto-expanded, Resume Handover button (only when `handover_status=ACTIVE`, copies `ccgmon resume <project> <slug>` to clipboard + shows toast). Activity (`F:/projects/ccg-monitor/packages/ui/views/activity.js`) streams events from SSE with slide-in animation (unless reduce-motion), clicking a row opens JSON drawer. Implement the 4 states: empty workspace (`F:/projects/ccg-monitor/packages/ui/states/empty.js`), FAIL+findings (`F:/projects/ccg-monitor/packages/ui/states/fail.js`), shortcut overlay (`F:/projects/ccg-monitor/packages/ui/states/shortcuts.js`), and narrow <768px reflow (CSS-only, no separate file needed).
- task-4: Wire keyboard shortcuts in `F:/projects/ccg-monitor/packages/ui/keys.js`: `g p` → workspace, `g a` → activity, `/` → focus search, `?` → toggle shortcut overlay, `j/k` → navigate items, `Cmd+R` (or `Ctrl+R`) → copy Resume Handover command. Implement settings drawer in `F:/projects/ccg-monitor/packages/ui/settings.js`: theme toggle (dark/light), density (comfortable/compact), reduce-color (removes gate hues, keeps icons+labels), reduce-motion (disables pulse+slide-in animations). Persist all settings to localStorage. Mirror settings to root element classes. Honor `prefers-reduced-motion` as default for reduce-motion.
- task-5: Modify `F:/projects/ccg-monitor/packages/daemon/src/index.ts` to static-serve the `F:/projects/ccg-monitor/packages/ui/` directory at `/`. Requests to `/` should serve `index.html`. Existing API routes (`/events`, `/stream`, `/api/*`, `/healthz`) must continue working — static file serving should be a fallback after API routes. Also add a `GET /api/events` endpoint that returns recent events (e.g., last 100) for the Activity view's initial load.
- task-6: Integration verification — ensure `pnpm --filter @ccgmon/daemon build` passes. Manually verify: `http://127.0.0.1:7878/` returns `index.html` with assets loading 200. All 3 views render. SSE reconnects on disconnect. Theme toggle persists across reload.

## Context

### Handoff bundle location
All wireframe source files are at: `F:/projects/ccg-monitor/docs/plans/2026-05-22-ccg-monitor/ccg-monitor-handoff/ccg-monitor/project/`

Key files to reference (read these for component structure, prop shapes, CSS classes):
- `wireframe-primitives.jsx` — WFOwner, WFGate, WFGateStrip, WFStatus, WFTopbar, WFProjectCard, WFPhaseCard, WFWorkspaceSidebar
- `view-workspace.jsx` — WFWorkspaceGrid (W1 variant)
- `view-plan.jsx` — WFPlanAnchor (P1 variant)
- `view-activity.jsx` — WFActivityStream (A1) + WFActivitySplit (A2 drawer)
- `view-states.jsx` — empty, FAIL+findings, shortcuts, narrow, light states
- `wireframe-data.js` — mock data structure (shows expected prop shapes)
- `linear-tokens.css` — design tokens (colors, spacing, typography)
- `wireframe.css` — component styles (use as-is, no modifications needed)
- `tweaks-panel.jsx` — settings drawer reference (theme/density/reduce-color/reduce-motion)

### Daemon API shapes (already implemented)

**GET /api/projects** returns array:
```json
[{
  "project_id": "sha1-hash",
  "repo_root": "F:/projects/example",
  "remote_url": null,
  "status": "ACTIVE",
  "first_seen": "2026-05-22T10:00:00.000Z",
  "last_seen": "2026-05-23T16:00:00.000Z"
}]
```

**GET /api/plans/:projectId/:slug** returns:
```json
{
  "plan": {
    "project_id": "...", "slug": "...", "title": "...",
    "status": "ACTIVE", "current_phase": "2",
    "handover_status": "ACTIVE", "updated_at": "..."
  },
  "phases": [{
    "project_id": "...", "slug": "...", "phase_id": "1",
    "title": "...", "owner": "codex", "gate_state": "DONE",
    "started_at": "...", "completed_at": "..."
  }],
  "tasks": [{
    "project_id": "...", "slug": "...", "phase_id": "1",
    "task_id": "task-1", "title": "...", "status": "DONE",
    "files": ["path/to/file.ts"]
  }]
}
```

**GET /healthz** returns:
```json
{ "ok": true, "version": "0.1.0", "uptime_s": 3600, "event_count": 42, "db_size_bytes": 12345 }
```

**GET /stream** — SSE stream. Each event: `data: <full event JSON>\n\n`
Event JSON has: `event_id`, `event_type`, `ts`, `source`, `project_id`, `repo_root`, `session_id`, `plan_slug`, `payload`.

**NOTE:** There is currently NO `GET /api/events` endpoint for historical events. You need to add one in task-5 when modifying `index.ts`. Add it returning the last 100 events from the `events` table ordered by `row_id DESC`.

### JSX → HTM conversion rule
Every JSX expression converts as follows:
- `<Foo bar={x}>{children}</Foo>` → `` html`<${Foo} bar=${x}>${children}</>` ``
- `<div className="x">` → `` html`<div class="x">` `` (note: `className` → `class` in HTM/Preact)
- Event handlers: `onClick={fn}` → `onClick=${fn}`
- Conditional rendering: `{cond && <X/>}` → `${cond && html`<${X}/>`}`
- Map: `{arr.map(x => <X key={x.id}/>)}` → `${arr.map(x => html`<${X} key=${x.id}/>`)}`

### Import pattern
All JS files use this import pattern:
```js
import { html, render, useState, useEffect, useCallback, useRef } from 'https://esm.sh/htm/preact/standalone';
```

### Visual language (from design.md, locked in)
- Gate chevrons: Plan=amber, Execute=violet, Review=emerald. State via `data-state` attr.
- Owner badges: monogram only (C/X/G). claude=indigo, codex=cyan, gemini=fuchsia.
- Status: PASS=emerald, PASS_WITH_DEBT=amber, FAIL=crimson+pulse, BLOCKED=slate.
- Dark mode default. Light mode toggle available.
- "Reduce color" → neutral shades + icons only.
- "Reduce motion" → no pulse, no slide-in, instant inserts.

### Accessibility requirements (WCAG 2.2 AA — non-negotiable)
- Phase tree: `role="tree"` + `treeitem` + `aria-expanded` + arrow-key nav.
- Activity feed: `role="log"` + `aria-live="polite"`, debounced ≤1 announcement/2s.
- Skip-link first focusable element. Focus ring visible 2px ≥3:1.
- `prefers-reduced-motion: reduce` disables pulse + slide-in animations.
- No CDN scripts beyond `esm.sh/htm/preact/standalone`.

## Files

Create:
- `F:/projects/ccg-monitor/packages/ui/index.html`
- `F:/projects/ccg-monitor/packages/ui/linear-tokens.css` (copy from handoff)
- `F:/projects/ccg-monitor/packages/ui/wireframe.css` (copy from handoff)
- `F:/projects/ccg-monitor/packages/ui/app.js`
- `F:/projects/ccg-monitor/packages/ui/router.js`
- `F:/projects/ccg-monitor/packages/ui/sse.js`
- `F:/projects/ccg-monitor/packages/ui/api.js`
- `F:/projects/ccg-monitor/packages/ui/primitives.js`
- `F:/projects/ccg-monitor/packages/ui/views/workspace.js`
- `F:/projects/ccg-monitor/packages/ui/views/plan.js`
- `F:/projects/ccg-monitor/packages/ui/views/activity.js`
- `F:/projects/ccg-monitor/packages/ui/states/empty.js`
- `F:/projects/ccg-monitor/packages/ui/states/fail.js`
- `F:/projects/ccg-monitor/packages/ui/states/shortcuts.js`
- `F:/projects/ccg-monitor/packages/ui/settings.js`
- `F:/projects/ccg-monitor/packages/ui/keys.js`

Modify:
- `F:/projects/ccg-monitor/packages/daemon/src/index.ts` (static serve UI at `/`, add `GET /api/events`)

## Done When
- `pnpm --filter @ccgmon/daemon build` passes (TypeScript still compiles after adding static serve)
- `http://127.0.0.1:7878/` returns `index.html` with all assets loading 200
- Workspace view renders project cards from `/api/projects` data
- Plan Detail renders vertical phase tree from `/api/plans/:id`; Resume Handover button shows only when `handover_status=ACTIVE`
- Activity view streams events from SSE; clicking a row opens JSON drawer
- All 4 states render (empty workspace, FAIL+findings, "?" shortcut overlay, narrow ≤768px reflow)
- Theme toggle persists across reload
- `prefers-reduced-motion: reduce` disables animations
- SSE reconnects with exponential backoff capped at 30s
- No CDN scripts beyond `esm.sh/htm/preact/standalone`
- Phase tree has `role="tree"` + `treeitem` + `aria-expanded`
- Activity feed has `role="log"` + `aria-live="polite"`

## Rules
- Edit files directly with your write tools; on-disk files are the source of truth.
- Do not duplicate file content in the response.
- Do not redesign the phase or produce a reference prototype.
- If anything is unclear, list it under CLARIFICATIONS NEEDED and stop.
- READ the handoff wireframe files before starting implementation — they define the component structure, prop shapes, and CSS classes you must match.
- Copy `linear-tokens.css` and `wireframe.css` from the handoff bundle UNCHANGED.
- No build step — everything must work as plain ES modules loaded directly in the browser.
- Use ONLY `https://esm.sh/htm/preact/standalone` as CDN dependency. No React, no Babel, no other CDN scripts.
- Match the handoff wireframe DOM structure closely so that `wireframe.css` styles apply correctly.

## Per-Task Workflow (required)
For each task in order:
  1. Implement the task.
  2. `git add` only files you touched for this task and commit with message
     `phase-4.task-<M>: <one-line subject>`. Capture the commit hash.
  3. Write `F:/projects/ccg-monitor/docs/plans/2026-05-22-ccg-monitor/notes/phase-4.task-<M>.md` (decision note)
     with sections: Decisions made (not in spec), Spec deviations, Tradeoffs
     accepted, Assumptions, Follow-ups for human. Use `- none` for empty sections.
  4. Append this task's row to `## COMMITS` in your response.

## After All Tasks
- Write `F:/projects/ccg-monitor/docs/plans/2026-05-22-ccg-monitor/responses/phase-4.md` containing the full
  `# EXTERNAL RESPONSE` block (same content you return inline).
- Emit the completion line as the final line of your reply:
  `Phase 4 completed. Response file: F:/projects/ccg-monitor/docs/plans/2026-05-22-ccg-monitor/responses/phase-4.md.`

## Report Format
Return the `# EXTERNAL RESPONSE` block with sections: META, SUMMARY, FILES MODIFIED, COMMITS, NOTES, SPEC COMPLIANCE, CLARIFICATIONS NEEDED, NEXT.

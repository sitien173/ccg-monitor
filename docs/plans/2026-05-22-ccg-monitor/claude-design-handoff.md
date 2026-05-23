# Claude Design Handoff — ccg-monitor Dashboard
---

```
Design a local-first monitoring dashboard called "ccg-monitor" for developers
using the Claude Code `superpowers-ccg` plugin together with `openmcp`. It is
READ-ONLY in v1 — no forms, no mutating buttons except a single
"Resume Handover" action that copies a CLI command to clipboard.

OUTPUT: a single React JSX file using Tailwind CSS, lucide-react icons,
and shadcn/ui primitives if helpful. No backend calls — use the inline
mock data provided below to populate every view. Make it production-grade,
dense-but-calm, developer-tool aesthetic. Dark mode default; expose a light/dark toggle.

═══════════════════════════════════════════════════════════════════════════
PRODUCT CONTEXT
═══════════════════════════════════════════════════════════════════════════
Users run a strict 3-gate workflow per project: Plan → Execute → Review.
Each plan lives under `docs/plans/<slug>/` and is executed one phase at a
time. Each phase has ONE owner: claude (trivial), codex (back-side: API,
DB, infra), or gemini (front-side: UI, CSS, multimodal). After execution,
the Review gate emits one of: PASS, PASS_WITH_DEBT, FAIL, BLOCKED.

The dashboard aggregates this across ALL local projects on one machine.

═══════════════════════════════════════════════════════════════════════════
INFORMATION ARCHITECTURE — 3 PRIMARY VIEWS
═══════════════════════════════════════════════════════════════════════════

1. WORKSPACE OVERVIEW (route: /)
   - Top bar: machine name, daemon status dot, total active sessions, search.
   - Grid of Project Cards. Each card shows:
       • Repo name + path (truncated)
       • Active plan title (if any) + current gate chevron
       • Phase progress (e.g., "Phase 2 of 4 — Execute")
       • Owner badge (claude / codex / gemini) with model icon
       • Last activity relative time
       • Pulsing dot if a Claude session is live right now
       • If `.handover.md` is ACTIVE → glowing "Resume" pill in corner
   - Sidebar: filters (status, owner, recent activity).

2. PLAN DETAIL (route: /p/:projectId/plan/:slug)
   - Header: plan title, slug, status badge, "Resume Handover" button
     (only visible when handover_status = ACTIVE).
   - Main panel: VERTICAL PHASE TREE (top→bottom).
       • Each phase node = card with: phase title, owner badge, gate
         chevron (3 mini chips: Plan / Execute / Review, colored by state),
         file count, started/completed timestamps.
       • Connector line between phases shows directional flow; current
         phase has a soft glow + animated pulse.
       • Inside each phase, collapsed-by-default list of tasks (2–4 items)
         and files modified.
       • Review outcome surface: PASS (emerald), PASS_WITH_DEBT (amber),
         FAIL (crimson pulse), BLOCKED (slate with warn icon). Click to
         expand quality findings list.
   - Right rail: handover.md preview (rendered markdown, monospace), cached
     SESSION_IDs table from .sessions.json (backend, last_used, truncated id).

═══════════════════════════════════════════════════════════════════════════
PLAN DETAIL — CONCRETE WIREFRAME
═══════════════════════════════════════════════════════════════════════════
Layout: 12-col grid. Header full-width. Below header → tree 8 cols left,
context rail 4 cols right. On <1024px width, rail collapses into a
bottom drawer toggled by a floating "Context" pill.

┌─────────────────────────────────────────────────────────────────────────┐
│  ←  superpowers-ccgv2 / plans                                  ⌘K  ☾   │  ← 56px header
├─────────────────────────────────────────────────────────────────────────┤
│  Build ccg-monitor dashboard                          [ACTIVE]          │
│  2026-05-22-ccg-monitor · F:/projects/…/docs/plans/…                    │
│  ▸ Plan ●─── Execute ◉─── Review ○        ▸ owner: codex                │  ← plan-level
│                                                                         │     gate strip
│                                       ┌────────────────────────────┐    │
│                                       │ ⚡ Resume Handover  ⌘R     │    │  ← only if
│                                       └────────────────────────────┘    │     ACTIVE
├──────────────────────────────────── 8 cols ──────┬──── 4 cols ──────────┤
│                                                  │ HANDOVER.MD           │
│  ┌────────────────────────────────────────────┐  │ ┌───────────────────┐ │
│  │ ① Scaffold daemon + SQLite schema     ✅   │  │ │ status: ACTIVE   │ │
│  │   owner: codex · 12 files · 1d ago         │  │ │ current: phase 2 │ │
│  │   Plan ●  Execute ●  Review ●  PASS        │  │ │ next_action: …   │ │
│  │   ▸ tasks (4)                              │  │ │ read_first:      │ │
│  └─────────────────┬──────────────────────────┘  │ │  - phase-2.md    │ │
│                    │                              │ │  - schema.sql    │ │
│                    │  (connector, solid)          │ └───────────────────┘ │
│                    ▼                              │                       │
│  ┌────────────────────────────────────────────┐  │ SESSION CACHE         │
│  │ ② FS watcher + projector       ◉ ACTIVE   │  │ ┌───────────────────┐ │
│  │   owner: codex · 7 files · 4h ago          │  │ │ codex  8f3a…b29c  │ │
│  │   Plan ●  Execute ◉  Review ○              │  │ │        12m ago    │ │
│  │   ━━━━━━━━━━━━━━━ pulsing glow ━━━━━━━━━━ │  │ │ agy    49b6…3864  │ │
│  │   ▾ tasks (3)                              │  │ │        1h ago     │ │
│  │     ☑ chokidar setup                       │  │ └───────────────────┘ │
│  │     ☑ parse handover.md                    │  │                       │
│  │     ☐ diff projector       ← active        │  │ RECENT EVENTS         │
│  │   ▾ files modified                         │  │ ┌───────────────────┐ │
│  │     daemon/watcher.ts                      │  │ │ 10:42 route.disp. │ │
│  │     daemon/projector.ts                    │  │ │ 10:41 phase.upd.  │ │
│  │     schema.sql                             │  │ │ 10:38 handover.   │ │
│  └─────────────────┬──────────────────────────┘  │ │ 10:35 tool.post   │ │
│                    │                              │ └───────────────────┘ │
│                    ▼  (dashed, pending)           │ [open Live Activity →]│
│  ┌────────────────────────────────────────────┐  │                       │
│  │ ③ Preact dashboard shell      ○ pending   │  │                       │
│  │   owner: gemini · 0 files                  │  │                       │
│  │   Plan ○  Execute ○  Review ○              │  │                       │
│  │   ▸ tasks (4)                              │  │                       │
│  └─────────────────┬──────────────────────────┘  │                       │
│                    ▼                              │                       │
│  ┌────────────────────────────────────────────┐  │                       │
│  │ ④ Plugin hooks + openmcp wrappers ○        │  │                       │
│  │   owner: codex · 0 files                   │  │                       │
│  │   Plan ○  Execute ○  Review ○              │  │                       │
│  │   ▸ tasks (3)                              │  │                       │
│  └────────────────────────────────────────────┘  │                       │
└──────────────────────────────────────────────────┴───────────────────────┘

Phase card anatomy (single card, expanded):
  ┌────────────────────────────────────────────────────────┐
  │ ②  FS watcher + projector              ◉ ACTIVE        │  ← title row,
  │ [codex] · 7 files · started 4h ago                     │     32px title
  ├────────────────────────────────────────────────────────┤
  │  GATES                                                  │
  │  ┌──── Plan ────┐  ┌── Execute ──┐  ┌── Review ──┐     │  ← 3 chevrons,
  │  │     done     │  │   active    │  │  pending   │     │     32px tall
  │  └──────────────┘  └─────────────┘  └────────────┘     │
  ├────────────────────────────────────────────────────────┤
  │  TASKS                                          [▾]    │  ← collapsible
  │   ☑ chokidar setup                                      │
  │   ☑ parse handover.md                                   │
  │   ☐ diff projector                       ← active dot  │
  ├────────────────────────────────────────────────────────┤
  │  FILES MODIFIED (7)                              [▾]    │
  │   daemon/watcher.ts        +124  -3                     │
  │   daemon/projector.ts      +88   -12                    │
  │   …                                                     │
  ├────────────────────────────────────────────────────────┤
  │  REVIEW                                                 │  ← only if
  │   ⛔ FAIL — quality findings (2 HIGH, 1 MED)            │     review
  │   ▾ findings                                            │     recorded
  └────────────────────────────────────────────────────────┘

Behavior:
- Card collapsed state shows only title row + 3-gate chevron strip + meta.
- Click anywhere on the title row toggles expand. Right edge has chevron icon.
- Only ONE card can be expanded at a time by default; Shift+click expands
  additional cards.
- The current/active phase auto-expands on page load.
- Connector lines: solid between done→done or done→active, dashed for
  pending→pending. Color matches the *downstream* gate state.
- Sticky behavior: the plan-level gate strip in the header sticks to top
  when scrolling. The expanded current phase card has a sticky title row.

3. LIVE ACTIVITY (route: /activity)
   - Real-time stream of events (SSE). Single-column virtualized log.
   - Each row: timestamp · project · event_type chip · 1-line summary.
   - Color hints: route.* = purple, tool.* = slate, gate.* = gate color,
     plan.* / phase.* / handover.* = blue.
   - Top: filter chips by event_type + project + sparkline of last hour
     event rate.
   - Click a row → side drawer with full event JSON.

═══════════════════════════════════════════════════════════════════════════
GATE & STATUS VISUAL LANGUAGE
═══════════════════════════════════════════════════════════════════════════
- Gate chevrons (Plan / Execute / Review):
    pending = slate outline, active = filled with gate color + pulse,
    done = filled solid, failed = crimson with X.
    Colors: Plan=amber-400, Execute=violet-500, Review=emerald-500.
- Owner badges: claude=indigo, codex=cyan, gemini=fuchsia. Show 1-letter
  monogram in a 20px rounded square + name on hover.
- Status badges: PASS (emerald), PASS_WITH_DEBT (amber w/ warn icon),
  FAIL (crimson, flashing slow), BLOCKED (slate, octagon icon).

═══════════════════════════════════════════════════════════════════════════
MOCK DATA (use verbatim to populate the UI)
═══════════════════════════════════════════════════════════════════════════
const projects = [
  { id: "p1", name: "superpowers-ccgv2", path: "F:/projects/superpowers-ccgv2",
    activePlan: "2026-05-22-ccg-monitor", gate: "execute", phase: 2,
    totalPhases: 4, owner: "codex", lastActivity: "2m ago", live: true,
    handoverActive: true },
  { id: "p2", name: "openmcp", path: "C:/Users/ngosi/.mcp-servers/openmcp",
    activePlan: "2026-05-20-event-wrappers", gate: "review", phase: 3,
    totalPhases: 3, owner: "claude", lastActivity: "1h ago", live: false,
    handoverActive: false },
  { id: "p3", name: "atlas-ui", path: "F:/projects/atlas-ui",
    activePlan: null, gate: null, phase: 0, totalPhases: 0, owner: null,
    lastActivity: "3d ago", live: false, handoverActive: false },
];

const planDetail = {
  slug: "2026-05-22-ccg-monitor", title: "Build ccg-monitor dashboard",
  status: "ACTIVE", handoverStatus: "ACTIVE",
  phases: [
    { id: 1, title: "Scaffold daemon + SQLite schema", owner: "codex",
      gates: { plan: "done", execute: "done", review: "done" },
      review: "PASS", files: 12, started: "2d ago", completed: "1d ago",
      tasks: ["init repo", "schema.sql", "ingest API skeleton", "SSE bus"] },
    { id: 2, title: "FS watcher + projector", owner: "codex",
      gates: { plan: "done", execute: "active", review: "pending" },
      review: null, files: 7, started: "4h ago", completed: null,
      tasks: ["chokidar setup", "parse handover.md", "diff projector"] },
    { id: 3, title: "Preact dashboard shell", owner: "gemini",
      gates: { plan: "pending", execute: "pending", review: "pending" },
      review: null, files: 0, started: null, completed: null,
      tasks: ["routing", "project grid", "plan tree", "activity feed"] },
    { id: 4, title: "Plugin hooks + openmcp wrappers", owner: "codex",
      gates: { plan: "pending", execute: "pending", review: "pending" },
      review: null, files: 0, started: null, completed: null,
      tasks: ["SessionStart hook", "PostToolUse hook", "openmcp shim"] },
  ],
  sessionsCache: [
    { backend: "codex", id: "8f3a…b29c", lastUsed: "12m ago" },
    { backend: "agy",   id: "49b6…3864", lastUsed: "1h ago" },
  ],
};

const events = [
  { ts: "10:42:11", project: "superpowers-ccgv2", type: "route.dispatched",
    summary: "codex · phase 2 · session 8f3a…b29c" },
  { ts: "10:42:09", project: "superpowers-ccgv2", type: "route.requested",
    summary: "codex · cd=F:/projects/superpowers-ccgv2 · 3.2KB prompt" },
  { ts: "10:41:55", project: "superpowers-ccgv2", type: "phase.updated",
    summary: "phase 2 → gate.execute = active" },
  { ts: "10:40:02", project: "openmcp", type: "gate.passed",
    summary: "phase 3 · review · PASS_WITH_DEBT" },
  { ts: "10:38:17", project: "superpowers-ccgv2", type: "handover.updated",
    summary: "status=ACTIVE · current_phase=2" },
  { ts: "10:35:44", project: "superpowers-ccgv2", type: "tool.post",
    summary: "Edit · 142ms · daemon/projector.ts" },
];

═══════════════════════════════════════════════════════════════════════════
INTERACTION & MOTION
═══════════════════════════════════════════════════════════════════════════
- New events in Activity slide in from top with 200ms ease-out + brief
  background flash in the row's gate color.
- Phase tree current-phase glow uses a 2s ease-in-out opacity loop.
- FAIL/BLOCKED badges have a 1.5s slow pulse to draw the eye.
- All hovers reveal full text in a tooltip (paths, ids, timestamps).
- Keyboard: `g p` → Workspace, `g a` → Activity, `/` → focus search,
  `j/k` to move through projects/phases, `Enter` to open.

═══════════════════════════════════════════════════════════════════════════
ACCESSIBILITY REQUIREMENTS (WCAG 2.2 AA — non-negotiable)
═══════════════════════════════════════════════════════════════════════════

COLOR & CONTRAST
- All text and meaningful icons must hit ≥4.5:1 contrast against their
  background (≥3:1 for ≥18px or ≥14px bold). Verify both dark and light
  themes.
- NEVER encode status with color alone. Every gate chevron, owner badge,
  and review outcome must carry a redundant signal:
    • Gate chevrons: include the state label ("done"/"active"/"pending"/
      "failed") OR an icon (check / dot / circle-outline / x).
    • Status badges: pair color with text + icon (PASS = check,
      PASS_WITH_DEBT = triangle-warn, FAIL = x-octagon, BLOCKED = ban).
    • Live pulse dot: pair with the word "live" or a sr-only label.
- Provide a "Reduce color" toggle that converts gate colors to neutral
  shades and relies on icons + labels only.

SEMANTICS & STRUCTURE
- Single <h1> per route (the plan title on Plan Detail).
- Phase tree uses <ol> with role="tree" on the list and role="treeitem"
  on each phase card. Expanded state via aria-expanded. Parent-child
  hierarchy via aria-level.
- Activity feed uses role="log" with aria-live="polite" so new events
  are announced without stealing focus. Pause-on-hover; user can disable
  announcements entirely via a setting.
- Gate strip uses role="group" with aria-label="Phase gates" and each
  chevron has aria-label="Plan gate: done" etc.
- All icons that convey meaning have aria-label or accompanying
  sr-only text. Purely decorative icons get aria-hidden="true".

KEYBOARD
- Every interactive element reachable via Tab in logical reading order.
- Visible focus ring on every focusable element (2px solid ring, color
  with ≥3:1 contrast against adjacent backgrounds). Never `outline: none`
  without a replacement.
- Phase tree: arrow keys move between cards (↑/↓ siblings, → expand,
  ← collapse). Home/End jump to first/last phase.
- Activity log: ↑/↓ moves through rows, Enter opens detail drawer,
  Esc closes.
- Skip-link "Skip to main content" as first focusable element.
- All custom shortcuts (g p, g a, /, j/k, ⌘R for Resume) must be
  discoverable via a "?" overlay and overridable. Do NOT trap focus.

MOTION
- Honor `prefers-reduced-motion: reduce`. When set:
    • Disable phase-card pulse glow (replace with a static 2px ring).
    • Disable activity-row slide-in (instant insertion).
    • Disable FAIL/BLOCKED pulse (replace with bold border).
- Auto-refresh and live updates continue regardless of motion preference.

SCREEN READER
- "Resume Handover" button: aria-label="Resume active handover for plan
  <title>. Copies CLI command to clipboard."
- Status changes (e.g., phase 2 → done) announced once via aria-live
  region; debounce to ≤1 announcement per 2s.
- Truncated text (paths, session IDs) always exposes full value via
  title attribute AND is readable by screen readers (no aria-hidden on
  the full text).

ZOOM & REFLOW
- Layout must reflow to 320px width without horizontal scroll, except
  for code blocks and the events table (which may scroll horizontally
  within their container).
- 200% zoom must not clip or hide content.

FORMS & INPUTS (search only in v1)
- Search input has visible label or aria-label, and clears with Esc.

═══════════════════════════════════════════════════════════════════════════
NON-GOALS (do not design these)
═══════════════════════════════════════════════════════════════════════════
- Auth screens, settings pages, user management, billing.
- Plan editor / phase advance / review submission — read-only only.
- Multi-machine / team views. Local single user only.

Deliver ONE self-contained .jsx file that renders all three views with
client-side routing (use a tiny hash-router or react-router-dom). All
three views must be reachable and fully populated from the mock data.
```

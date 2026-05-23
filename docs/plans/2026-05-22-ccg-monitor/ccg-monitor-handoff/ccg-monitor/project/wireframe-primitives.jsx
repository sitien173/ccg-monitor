/* global React */
// Shared wireframe primitives — atoms used across all variants.

// ── Owner badge (monogram-only; no real logos per brief) ──
function WFOwner({ owner, showName = true }) {
  if (!owner) {
    return (
      <span className="wf-owner">
        <span className="wf-owner-mark" data-owner="none">·</span>
        {showName && <span style={{ color: 'var(--color-ink-tertiary)' }}>idle</span>}
      </span>
    );
  }
  const monogram = { claude: 'C', codex: 'X', gemini: 'G' }[owner] || '?';
  return (
    <span className="wf-owner">
      <span className="wf-owner-mark" data-owner={owner} aria-hidden="true">{monogram}</span>
      {showName && <span>{owner}</span>}
    </span>
  );
}

// ── Single gate chevron-chip ──
function WFGate({ kind, state, label }) {
  const stateLabel = { pending: 'pending', active: 'active', done: 'done', failed: 'failed' }[state];
  return (
    <div className="wf-gate" data-kind={kind} data-state={state}
         aria-label={`${kind} gate: ${stateLabel}`}>
      <span className="wf-gate-icon" aria-hidden="true" />
      <span>{label || kind}</span>
    </div>
  );
}

// ── Gate strip (3 gates) ──
function WFGateStrip({ gates, large = false }) {
  return (
    <div className={'wf-gate-strip' + (large ? ' lg' : '')} role="group" aria-label="Phase gates">
      <WFGate kind="plan"    state={gates.plan}    label="Plan" />
      <WFGate kind="execute" state={gates.execute} label="Execute" />
      <WFGate kind="review"  state={gates.review}  label="Review" />
    </div>
  );
}

// ── Status pill ──
function WFStatus({ kind, children }) {
  return <span className="wf-status" data-kind={kind}>{children}</span>;
}

// ── Owner monogram only (no name) — for compact rows ──
function WFOwnerDot({ owner }) {
  if (!owner) return <span className="wf-owner-mark" data-owner="none">·</span>;
  const monogram = { claude: 'C', codex: 'X', gemini: 'G' }[owner] || '?';
  return <span className="wf-owner-mark" data-owner={owner} aria-label={owner}>{monogram}</span>;
}

// ── Topbar ──
function WFTopbar({ machine, route = 'workspace', sessions = 2, search = '⌘K  search projects, plans, sessions…' }) {
  return (
    <header className="wf-topbar">
      <div className="wf-logo">
        <span className="wf-logo-mark" aria-hidden="true" />
        <span>ccg-monitor</span>
      </div>
      <nav>
        <span className={'wf-tab' + (route === 'workspace' ? ' active' : '')}>Workspace</span>
        <span className={'wf-tab' + (route === 'activity' ? ' active' : '')}>Activity</span>
      </nav>
      <span className="wf-spacer" />
      <div className="wf-search">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <span>{search}</span>
        <span className="wf-spacer" />
        <span className="wf-kbd">⌘K</span>
      </div>
      <div className="wf-machine">
        <span className="wf-dot live" aria-hidden="true" />
        <span>{machine}</span>
        <span style={{ color: 'var(--color-ink-tertiary)' }}>·</span>
        <span>{sessions} live</span>
      </div>
      <span className="wf-kbd" aria-label="theme">☾</span>
    </header>
  );
}

// ── Project card (workspace overview) ──
function WFProjectCard({ p, dense = false }) {
  if (!p.activePlan) {
    return (
      <div className="wf-proj no-plan">
        <div className="wf-proj-name">{p.name}</div>
        <div className="wf-proj-path" title={p.path}>{p.path}</div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--color-ink-tertiary)' }}>no active plan</span>
          <span className="wf-mono-sm" style={{ color: 'var(--color-ink-tertiary)' }}>{p.lastActivity}</span>
        </div>
      </div>
    );
  }
  const pct = (p.phase / Math.max(p.totalPhases, 1)) * 100;
  return (
    <div className={'wf-proj' + (p.live ? ' live-edge' : '')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {p.live && <span className="wf-dot live" aria-label="live session" />}
        <div className="wf-proj-name">{p.name}</div>
      </div>
      <div className="wf-proj-path" title={p.path}>{p.path}</div>
      <div className="wf-plan-title" title={p.planTitle}>{p.planTitle}</div>
      <WFGateStrip gates={{
        plan:    p.gate === 'plan' ? 'active' : (['execute','review'].includes(p.gate) ? 'done' : 'pending'),
        execute: p.gate === 'execute' ? 'active' : (p.gate === 'review' ? 'done' : 'pending'),
        review:  p.gate === 'review' ? 'active' : 'pending',
      }} />
      <div className="wf-progress">
        <span className="wf-mono-sm">P{p.phase}/{p.totalPhases}</span>
        <div className="wf-progress-bar"><i style={{ width: `${pct}%` }} /></div>
        <WFOwnerDot owner={p.owner} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--color-ink-tertiary)' }}>
        <span className="wf-mono-sm">{p.activePlan}</span>
        <span>{p.lastActivity}</span>
      </div>
      {p.handoverActive && (
        <div className="wf-proj-resume">
          <button className="wf-btn resume" style={{ height: 24, padding: '0 10px', fontSize: 11.5 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></svg>
            Resume
          </button>
        </div>
      )}
    </div>
  );
}

// ── Phase card (used in Plan Detail anchor) ──
function WFPhaseCard({ phase, expanded = false, current = false, narrow = false }) {
  const isDone = Object.values(phase.gates).every((g) => g === 'done');
  const isActive = Object.values(phase.gates).includes('active');
  const isFailed = Object.values(phase.gates).includes('failed');
  const isPending = !isDone && !isActive && !isFailed;
  const className =
    'wf-phase' +
    (current || isActive ? ' active' + (current ? ' glow' : '') : '') +
    (isDone && !isFailed ? ' done' : '') +
    (isPending ? ' pending' : '');
  return (
    <article className={className} role="treeitem" aria-expanded={expanded}>
      <header className="wf-phase-head">
        <div className="wf-phase-index" aria-hidden="true">{String(phase.id).padStart(2,'0')}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="wf-phase-title">{phase.title}</div>
          <div className="wf-phase-meta">
            <WFOwner owner={phase.owner} />
            <span style={{ color: 'var(--color-ink-tertiary)' }}>·</span>
            <span className="wf-mono-sm">{phase.files} files</span>
            {phase.started && <>
              <span style={{ color: 'var(--color-ink-tertiary)' }}>·</span>
              <span>started {phase.started}</span>
            </>}
            {phase.completed && <>
              <span style={{ color: 'var(--color-ink-tertiary)' }}>·</span>
              <span>done {phase.completed}</span>
            </>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {phase.review === 'PASS' && <WFStatus kind="pass">✓ pass</WFStatus>}
          {phase.review === 'PASS_WITH_DEBT' && <WFStatus kind="debt">⚠ debt</WFStatus>}
          {phase.review === 'FAIL' && <WFStatus kind="fail">✕ fail</WFStatus>}
          {isActive && !phase.review && <WFStatus kind="active">● active</WFStatus>}
          {isPending && <WFStatus kind="pending">○ pending</WFStatus>}
          <span className="wf-mono-sm" style={{ color: 'var(--color-ink-tertiary)' }}>{expanded ? '▾' : '▸'}</span>
        </div>
      </header>
      {!narrow && (
        <div style={{ marginTop: 12, paddingLeft: 38 }}>
          <WFGateStrip gates={phase.gates} large />
        </div>
      )}
      {expanded && (
        <div className="wf-phase-body">
          <div className="wf-section">
            <div className="wf-eyebrow" style={{ marginBottom: 4 }}>Tasks ({phase.tasks.length})</div>
            {phase.tasks.map((t, i) => (
              <div key={i} className={'wf-task' + (t.done ? ' done' : '') + (t.active ? ' active' : '')}>
                <span className={'wf-checkbox' + (t.done ? ' checked' : '') + (t.active ? ' active' : '')} aria-hidden="true" />
                <span>{t.label}</span>
                {t.active && <span style={{ marginLeft: 'auto', color: 'var(--color-primary-hover)', fontSize: 11 }}>active</span>}
              </div>
            ))}
          </div>
          {phase.fileList && phase.fileList.length > 0 && (
            <div className="wf-section">
              <div className="wf-eyebrow" style={{ marginBottom: 4 }}>Files modified ({phase.files})</div>
              {phase.fileList.slice(0, 6).map((f, i) => (
                <div key={i} className="wf-file-row">
                  <span>{f.path}</span>
                  <span style={{ marginLeft: 'auto' }} className="wf-diff-add">+{f.add}</span>
                  <span className="wf-diff-del">−{f.del}</span>
                </div>
              ))}
            </div>
          )}
          {phase.review === 'FAIL' && phase.findings && (
            <div className="wf-section">
              <div className="wf-eyebrow" style={{ marginBottom: 6, color: 'var(--status-fail)' }}>
                Quality findings · {phase.findings.filter(f => f.level === 'HIGH').length} HIGH, {phase.findings.filter(f => f.level === 'MED').length} MED
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {phase.findings.map((f, i) => (
                  <div key={i} className="wf-finding">
                    <span className="wf-severity" data-level={f.level}>{f.level}</span>
                    <div>
                      <div style={{ color: 'var(--color-ink)', fontWeight: 500, marginBottom: 2 }}>{f.title}</div>
                      <div style={{ color: 'var(--color-ink-subtle)', fontSize: 12 }}>{f.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ── Sidebar (workspace filter rail) ──
function WFWorkspaceSidebar({ projects }) {
  const counts = {
    all: projects.length,
    live: projects.filter(p => p.live).length,
    handover: projects.filter(p => p.handoverActive).length,
    failed: projects.filter(p => p.lastReview === 'FAIL').length,
    idle: projects.filter(p => !p.activePlan).length,
  };
  return (
    <aside className="wf-sidebar" aria-label="Filters">
      <div className="wf-side-section">
        <div className="wf-side-title">Status</div>
        <div className="wf-side-item active"><span>All projects</span><span className="wf-count">{counts.all}</span></div>
        <div className="wf-side-item"><span className="wf-dot live" /> <span>Live now</span><span className="wf-count">{counts.live}</span></div>
        <div className="wf-side-item"><span>Active handover</span><span className="wf-count">{counts.handover}</span></div>
        <div className="wf-side-item"><span>Last review failed</span><span className="wf-count">{counts.failed}</span></div>
        <div className="wf-side-item"><span>Idle</span><span className="wf-count">{counts.idle}</span></div>
      </div>
      <div className="wf-side-section">
        <div className="wf-side-title">Owner</div>
        <div className="wf-side-item"><WFOwnerDot owner="claude" /><span>claude</span><span className="wf-count">1</span></div>
        <div className="wf-side-item"><WFOwnerDot owner="codex" /><span>codex</span><span className="wf-count">3</span></div>
        <div className="wf-side-item"><WFOwnerDot owner="gemini" /><span>gemini</span><span className="wf-count">2</span></div>
      </div>
      <div className="wf-side-section">
        <div className="wf-side-title">Recent activity</div>
        <div className="wf-side-item"><span>Last hour</span><span className="wf-count">2</span></div>
        <div className="wf-side-item"><span>Last day</span><span className="wf-count">4</span></div>
        <div className="wf-side-item"><span>Last week</span><span className="wf-count">6</span></div>
      </div>
    </aside>
  );
}

Object.assign(window, {
  WFOwner, WFOwnerDot, WFGate, WFGateStrip, WFStatus,
  WFTopbar, WFProjectCard, WFPhaseCard, WFWorkspaceSidebar,
});

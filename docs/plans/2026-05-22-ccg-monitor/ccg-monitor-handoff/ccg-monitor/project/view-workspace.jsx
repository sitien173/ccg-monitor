/* global React, WFTopbar, WFProjectCard, WFWorkspaceSidebar, WFGateStrip, WFOwnerDot, WFStatus */

// ─────────────────────────────────────────────────────────
// W1 — Grid (anchor): sidebar + 3-col grid of project cards
// ─────────────────────────────────────────────────────────
function WFWorkspaceGrid({ data }) {
  return (
    <div className="wf-screen">
      <WFTopbar machine={data.machine} sessions={data.activeSessions} route="workspace" />
      <div className="wf-body">
        <WFWorkspaceSidebar projects={data.projects} />
        <main className="wf-main">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
            <h1 className="wf-h1" style={{ margin: 0 }}>All projects <span style={{ color: 'var(--color-ink-tertiary)', fontWeight: 400, fontSize: 14, marginLeft: 8 }}>{data.projects.length}</span></h1>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="wf-chip active">all</span>
              <span className="wf-chip">active <span className="wf-count">4</span></span>
              <span className="wf-chip">idle <span className="wf-count">1</span></span>
              <span className="wf-kbd">sort: recent</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {data.projects.map((p) => <WFProjectCard key={p.id} p={p} />)}
          </div>
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// W2 — Sidebar + grouped: split by activity state
// ─────────────────────────────────────────────────────────
function WFWorkspaceGrouped({ data }) {
  const live = data.projects.filter((p) => p.live);
  const active = data.projects.filter((p) => !p.live && p.activePlan);
  const idle = data.projects.filter((p) => !p.activePlan);

  const Group = ({ title, count, color, items, accent }) => (
    <section style={{ marginBottom: 28 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: accent }} />
        <h2 className="wf-h2" style={{ margin: 0, fontSize: 13, color: 'var(--color-ink)' }}>{title}</h2>
        <span className="wf-mono-sm" style={{ color: 'var(--color-ink-tertiary)' }}>{count}</span>
        <div style={{ flex: 1, height: 1, background: 'var(--color-hairline)' }} />
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {items.map((p) => <WFProjectCard key={p.id} p={p} />)}
      </div>
    </section>
  );

  return (
    <div className="wf-screen">
      <WFTopbar machine={data.machine} sessions={data.activeSessions} route="workspace" />
      <div className="wf-body">
        <WFWorkspaceSidebar projects={data.projects} />
        <main className="wf-main">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 18 }}>
            <h1 className="wf-h1" style={{ margin: 0 }}>Workspace</h1>
            <span className="wf-mono-sm" style={{ color: 'var(--color-ink-subtle)' }}>{data.machine} · {data.projects.length} projects · {data.activeSessions} live sessions</span>
          </div>
          <Group title="Live now" count={live.length} accent="var(--color-primary)" items={live} />
          <Group title="Active plans" count={active.length} accent="var(--color-ink-subtle)" items={active} />
          <Group title="Idle" count={idle.length} accent="var(--color-ink-tertiary)" items={idle} />
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// W3 — Dense list / table
// ─────────────────────────────────────────────────────────
function WFWorkspaceList({ data }) {
  return (
    <div className="wf-screen">
      <WFTopbar machine={data.machine} sessions={data.activeSessions} route="workspace" />
      <div className="wf-body">
        <WFWorkspaceSidebar projects={data.projects} />
        <main className="wf-main">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
            <h1 className="wf-h1" style={{ margin: 0 }}>Projects</h1>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className="wf-chip">density · compact</span>
              <span className="wf-chip">sort · last activity ↓</span>
            </div>
          </div>
          <div style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-hairline)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '24px 1.4fr 2fr 90px 200px 80px 100px 100px 40px',
              gap: 12,
              padding: '10px 14px',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              color: 'var(--color-ink-tertiary)',
              borderBottom: '1px solid var(--color-hairline)',
              background: 'var(--color-canvas)',
            }}>
              <span></span>
              <span>Project</span>
              <span>Active plan</span>
              <span>Owner</span>
              <span>Gates</span>
              <span>Phase</span>
              <span>Last</span>
              <span></span>
              <span></span>
            </div>
            {data.projects.map((p) => (
              <div key={p.id} style={{
                display: 'grid',
                gridTemplateColumns: '24px 1.4fr 2fr 90px 200px 80px 100px 100px 40px',
                gap: 12,
                padding: '12px 14px',
                fontSize: 12.5,
                color: 'var(--color-ink-muted)',
                borderBottom: '1px solid var(--color-hairline)',
                alignItems: 'center',
              }}>
                <span>{p.live ? <span className="wf-dot live" aria-label="live" /> : <span style={{ color: 'var(--color-ink-tertiary)' }}>·</span>}</span>
                <span>
                  <div style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)', fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                  <div className="wf-mono-sm" style={{ color: 'var(--color-ink-tertiary)' }} title={p.path}>{p.path}</div>
                </span>
                <span>
                  {p.activePlan ? (
                    <>
                      <div style={{ color: 'var(--color-ink)' }}>{p.planTitle}</div>
                      <div className="wf-mono-sm" style={{ color: 'var(--color-ink-tertiary)' }}>{p.activePlan}</div>
                    </>
                  ) : <span style={{ color: 'var(--color-ink-tertiary)', fontStyle: 'italic' }}>—</span>}
                </span>
                <span><WFOwnerDot owner={p.owner} /> <span style={{ marginLeft: 6, fontSize: 12 }}>{p.owner || '—'}</span></span>
                <span>
                  {p.activePlan ? <WFGateStrip gates={{
                    plan: p.gate === 'plan' ? 'active' : (['execute','review'].includes(p.gate) ? 'done' : 'pending'),
                    execute: p.gate === 'execute' ? 'active' : (p.gate === 'review' ? 'done' : 'pending'),
                    review: p.gate === 'review' ? 'active' : 'pending',
                  }} /> : <span style={{ color: 'var(--color-ink-tertiary)' }}>—</span>}
                </span>
                <span className="wf-mono-sm">{p.activePlan ? `${p.phase}/${p.totalPhases}` : '—'}</span>
                <span style={{ color: 'var(--color-ink-subtle)', fontSize: 12 }}>{p.lastActivity}</span>
                <span>
                  {p.lastReview === 'PASS_WITH_DEBT' && <WFStatus kind="debt">⚠ debt</WFStatus>}
                  {p.lastReview === 'FAIL' && <WFStatus kind="fail">✕ fail</WFStatus>}
                </span>
                <span style={{ textAlign: 'right' }}>
                  {p.handoverActive && <button className="wf-btn resume" style={{ height: 22, padding: '0 8px', fontSize: 11 }}>⌘R</button>}
                </span>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

Object.assign(window, { WFWorkspaceGrid, WFWorkspaceGrouped, WFWorkspaceList });

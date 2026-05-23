/* global React, WFTopbar, WFPhaseCard, WFProjectCard, WFGateStrip, WFOwnerDot, WFStatus, WFPlanHeader */

// ─────────────────────────────────────────────────────────
// S1 — Empty workspace state (no plans anywhere)
// ─────────────────────────────────────────────────────────
function WFStateEmpty({ data }) {
  return (
    <div className="wf-screen">
      <WFTopbar machine={data.machine} sessions={0} route="workspace" />
      <main className="wf-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: 420, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 72, height: 72,
            borderRadius: 12,
            border: '1px dashed var(--color-hairline-strong)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-ink-tertiary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 22,
          }}>·</div>
          <h1 className="wf-h1" style={{ margin: 0, fontSize: 20 }}>No active plans</h1>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-ink-subtle)', lineHeight: 1.55 }}>
            ccg-monitor watches <span className="wf-mono-sm" style={{ color: 'var(--color-ink)' }}>docs/plans/</span> in every project on this machine.
            Start a plan in Claude Code with <span className="wf-mono-sm" style={{ color: 'var(--color-ink)' }}>/ccg plan</span>, or drop a
            <span className="wf-mono-sm" style={{ color: 'var(--color-ink)' }}> .handover.md</span> in an existing repo.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <span className="wf-chip">docs · /ccg plan</span>
            <span className="wf-chip">docs · handover format</span>
          </div>
          <div style={{ marginTop: 16, padding: '10px 12px', border: '1px solid var(--color-hairline)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-ink-tertiary)' }}>
            watching: F:/projects · ~/code · C:/Users/ngosi/.mcp-servers · scanning 47 repos
          </div>
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// S2 — Plan with FAILED phase + findings expanded
// ─────────────────────────────────────────────────────────
function WFStateFail({ data }) {
  // mutate a fresh planDetail in-memory: phase 2 done, phase 4 failed (use failPhase)
  const pd = {
    ...data.planDetail,
    phases: [
      { ...data.planDetail.phases[0] },
      { ...data.planDetail.phases[1], gates: { plan: 'done', execute: 'done', review: 'done' }, review: 'PASS_WITH_DEBT', completed: '40m ago' },
      { ...data.planDetail.phases[2], gates: { plan: 'done', execute: 'done', review: 'done' }, review: 'PASS', completed: '30m ago', files: 14, started: '6h ago' },
      data.failPhase,
    ],
  };
  return (
    <div className="wf-screen">
      <WFTopbar machine={data.machine} sessions={1} route="workspace" />
      <main className="wf-main no-pad" style={{ display: 'flex', flexDirection: 'column' }}>
        <WFPlanHeader pd={{ ...pd, status: 'FAIL' }} />
        <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, overflow: 'auto' }}>
          <ol role="tree" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {pd.phases.map((phase, i) => (
              <li key={phase.id}>
                <WFPhaseCard phase={phase} expanded={phase.id === 4} current={phase.id === 4} />
                {i < pd.phases.length - 1 && <div className="wf-phase-connector" />}
              </li>
            ))}
          </ol>
          <aside>
            <div style={{
              border: '1px solid color-mix(in oklch, var(--status-fail) 50%, var(--color-hairline))',
              background: 'color-mix(in oklch, var(--color-canvas) 88%, var(--status-fail) 12%)',
              borderRadius: 8,
              padding: '14px 16px',
              marginBottom: 16,
            }}>
              <div className="wf-eyebrow" style={{ color: 'var(--status-fail)', marginBottom: 8 }}>Review failed · phase 4</div>
              <div style={{ fontSize: 13, color: 'var(--color-ink)', marginBottom: 6 }}>2 HIGH · 1 MED finding</div>
              <div style={{ fontSize: 12, color: 'var(--color-ink-subtle)', lineHeight: 1.55 }}>
                Plan is BLOCKED until findings are addressed. Resume Handover pre-loads the failed phase context for the next session.
              </div>
              <button className="wf-btn resume" style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}>
                Resume Handover ⌘R
              </button>
            </div>
            <div className="wf-eyebrow" style={{ marginBottom: 6 }}>review summary</div>
            <pre style={{
              background: 'var(--color-surface-1)',
              border: '1px solid var(--color-hairline)',
              borderRadius: 6,
              padding: '10px 12px',
              fontSize: 11,
              lineHeight: 1.6,
              color: 'var(--color-ink-muted)',
              fontFamily: 'var(--font-mono)',
              margin: 0,
              whiteSpace: 'pre-wrap',
            }}>{`outcome: FAIL
findings: 3
  - HIGH × 2
  - MED  × 1
debt_carryover: 0
next: address findings,
      re-run review gate`}</pre>
          </aside>
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// S3 — Keyboard shortcut overlay (?)
// ─────────────────────────────────────────────────────────
function WFStateShortcuts({ data }) {
  const groups = [
    { title: 'Navigation', items: [
      ['Workspace overview', ['g', 'p']],
      ['Live activity', ['g', 'a']],
      ['Focus search', ['/']],
      ['Help / this dialog', ['?']],
      ['Back', ['esc']],
    ] },
    { title: 'In a list', items: [
      ['Move down / up', ['j', 'k']],
      ['Open item', ['↵']],
      ['Expand / collapse phase', ['→', '←']],
      ['First / last', ['home', 'end']],
    ] },
    { title: 'Actions', items: [
      ['Resume Handover', ['⌘', 'r']],
      ['Pause activity stream', ['p']],
      ['Toggle theme', ['shift', 'd']],
      ['Toggle reduce-color', ['shift', 'c']],
    ] },
  ];
  return (
    <div className="wf-screen" style={{ position: 'relative' }}>
      <WFTopbar machine={data.machine} sessions={1} route="workspace" />
      <main className="wf-main" style={{ filter: 'blur(0px)', opacity: 0.55 }}>
        {/* faint background of workspace */}
        <h1 className="wf-h1" style={{ margin: 0 }}>Workspace</h1>
        <div style={{ height: 12 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {data.projects.slice(0, 6).map((p) => <WFProjectCard key={p.id} p={p} />)}
        </div>
      </main>
      <div className="wf-overlay-bg">
        <div className="wf-overlay" role="dialog" aria-label="Keyboard shortcuts">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 className="wf-h2" style={{ margin: 0, fontSize: 14 }}>Keyboard shortcuts</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="wf-mono-sm" style={{ color: 'var(--color-ink-tertiary)' }}>press</span>
              <span className="wf-kbd">esc</span>
            </div>
          </div>
          {groups.map((g) => (
            <div key={g.title} style={{ marginBottom: 14 }}>
              <div className="wf-eyebrow" style={{ marginBottom: 4 }}>{g.title}</div>
              {g.items.map(([label, keys], i) => (
                <div key={i} className="wf-shortcut">
                  <span style={{ color: 'var(--color-ink-muted)' }}>{label}</span>
                  <span className="wf-shortcut-keys">
                    {keys.map((k, j) => <span key={j} className="wf-kbd">{k}</span>)}
                  </span>
                </div>
              ))}
            </div>
          ))}
          <div style={{ paddingTop: 8, borderTop: '1px solid var(--color-hairline)', fontSize: 11.5, color: 'var(--color-ink-tertiary)' }}>
            All shortcuts are remappable. <span style={{ color: 'var(--color-primary-hover)' }}>edit bindings →</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// S4 — Narrow / mobile reflow
// ─────────────────────────────────────────────────────────
function WFStateNarrow({ data }) {
  const pd = data.planDetail;
  return (
    <div className="wf-screen wf-mobile">
      <header className="wf-topbar">
        <div className="wf-logo"><span className="wf-logo-mark" /><span>ccg-monitor</span></div>
        <span className="wf-spacer" />
        <span className="wf-kbd">⌘K</span>
        <span className="wf-kbd">☾</span>
      </header>
      <main className="wf-main" style={{ overflow: 'auto' }}>
        <div style={{ fontSize: 11.5, color: 'var(--color-ink-subtle)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="wf-kbd" style={{ padding: '0 6px' }}>←</span>
          <span className="wf-mono-sm">{pd.project}</span>
        </div>
        <h1 className="wf-h1" style={{ margin: 0, fontSize: 18, lineHeight: 1.25 }}>{pd.title}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 12px 0' }}>
          <WFStatus kind="active">● ACTIVE</WFStatus>
          <span className="wf-mono-sm" style={{ color: 'var(--color-ink-tertiary)' }}>phase 2 of 4</span>
        </div>
        {/* sticky-feeling plan gates */}
        <div style={{ marginBottom: 14, padding: 10, border: '1px solid var(--color-hairline)', borderRadius: 8, background: 'var(--color-surface-1)' }}>
          <div className="wf-eyebrow" style={{ marginBottom: 6 }}>Plan gates</div>
          <WFGateStrip gates={{ plan: 'done', execute: 'active', review: 'pending' }} />
        </div>
        <button className="wf-btn resume" style={{ width: '100%', justifyContent: 'center', marginBottom: 14 }}>
          ⚡ Resume Handover
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pd.phases.slice(0, 3).map((phase) => {
            const isActive = Object.values(phase.gates).includes('active');
            return <WFPhaseCard key={phase.id} phase={phase} expanded={isActive} current={isActive} narrow />;
          })}
        </div>
        <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--color-surface-2)', borderRadius: 999, position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', fontSize: 12, color: 'var(--color-ink-muted)', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--color-hairline-strong)' }}>
          <span>▴ Context</span>
          <span style={{ color: 'var(--color-ink-tertiary)' }}>handover · sessions · events</span>
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// S5 — Light theme (one frame to show theme tweak)
// ─────────────────────────────────────────────────────────
function WFStateLight({ data }) {
  // We wrap in a forced wf-light scope rather than relying on root tweak,
  // because this artboard is meant to demonstrate the theme regardless of
  // the global tweak setting.
  return (
    <div className="wf-root wf-light" style={{ height: '100%' }}>
      <div className="wf-screen">
        <WFTopbar machine={data.machine} sessions={data.activeSessions} route="workspace" />
        <div className="wf-body">
          <main className="wf-main">
            <h1 className="wf-h1" style={{ margin: 0, marginBottom: 14 }}>Workspace · light theme</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              {data.projects.slice(0, 4).map((p) => <WFProjectCard key={p.id} p={p} />)}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { WFStateEmpty, WFStateFail, WFStateShortcuts, WFStateNarrow, WFStateLight });

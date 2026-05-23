/* global React, WFTopbar, WFPhaseCard, WFGateStrip, WFOwner, WFOwnerDot, WFStatus */

// Shared rail components for Plan Detail variants
function WFHandoverRail({ pd, compact = false }) {
  return (
    <section className="wf-rail-section">
      <div className="wf-eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>handover.md</span>
        <span className="wf-mono-sm" style={{ marginLeft: 'auto', color: 'var(--color-ink-tertiary)' }}>updated 2m ago</span>
      </div>
      <div style={{
        background: 'var(--color-surface-1)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 8,
        padding: '10px 12px',
        fontFamily: 'var(--font-mono)',
        fontSize: 11.5,
        lineHeight: 1.7,
      }}>
        {pd.handoverMd.map(([k, v], i) => (
          <div key={i} style={{ display: 'flex', gap: 8 }}>
            <span style={{ color: 'var(--color-ink-tertiary)' }}>{k}{v ? ':' : ''}</span>
            {v && <span style={{ color: k.startsWith(' ') ? 'var(--color-ink-muted)' : 'var(--color-primary-hover)' }}>{v}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

function WFSessionsRail({ pd }) {
  return (
    <section className="wf-rail-section">
      <div className="wf-eyebrow">Session cache <span className="wf-mono-sm" style={{ marginLeft: 8, color: 'var(--color-ink-tertiary)' }}>.sessions.json</span></div>
      <div style={{
        background: 'var(--color-surface-1)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        {pd.sessionsCache.map((s, i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            borderBottom: i < pd.sessionsCache.length - 1 ? '1px solid var(--color-hairline)' : 0,
            fontSize: 12,
          }}>
            <WFOwnerDot owner={s.backend === 'agy' ? null : s.backend} />
            <span style={{ color: 'var(--color-ink)', minWidth: 56 }}>{s.backend}</span>
            <span className="wf-mono-sm" style={{ color: 'var(--color-ink-subtle)' }}>{s.id}</span>
            <span style={{ marginLeft: 'auto', color: 'var(--color-ink-tertiary)', fontSize: 11.5 }}>{s.lastUsed}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function WFEventsRail({ events }) {
  return (
    <section className="wf-rail-section">
      <div className="wf-eyebrow" style={{ display: 'flex', alignItems: 'center' }}>
        <span>Recent events</span>
        <span style={{ marginLeft: 'auto', color: 'var(--color-primary-hover)', fontSize: 10 }}>open live activity →</span>
      </div>
      <div style={{
        background: 'var(--color-surface-1)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        {events.slice(0, 6).map((e, i) => (
          <div key={i} style={{
            display: 'grid',
            gridTemplateColumns: '52px 1fr',
            gap: 8,
            padding: '6px 12px',
            borderBottom: i < 5 ? '1px solid var(--color-hairline)' : 0,
            fontSize: 11.5,
            alignItems: 'baseline',
          }}>
            <span className="wf-mono-sm" style={{ color: 'var(--color-ink-tertiary)' }}>{e.ts.slice(0,5)}</span>
            <div style={{ minWidth: 0 }}>
              <div className="wf-mono-sm" style={{ color: 'var(--color-ink-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.type}</div>
              <div style={{ color: 'var(--color-ink-subtle)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.summary}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// Plan header (sticky gate strip)
function WFPlanHeader({ pd, sticky = true }) {
  return (
    <div className={'wf-plan-header' + (sticky ? ' wf-sticky' : '')} style={{
      padding: '18px 24px 14px 24px',
      borderBottom: '1px solid var(--color-hairline)',
      background: 'var(--color-canvas)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, fontSize: 12, color: 'var(--color-ink-subtle)' }}>
        <span className="wf-kbd" aria-label="back" style={{ padding: '2px 6px' }}>←</span>
        <span style={{ color: 'var(--color-ink-muted)' }}>{pd.project}</span>
        <span style={{ color: 'var(--color-ink-tertiary)' }}>/</span>
        <span>plans</span>
        <span style={{ color: 'var(--color-ink-tertiary)' }}>/</span>
        <span className="wf-mono-sm">{pd.slug}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 className="wf-h1" style={{ margin: 0, marginBottom: 6 }}>{pd.title}</h1>
          <div className="wf-mono-sm" style={{ color: 'var(--color-ink-tertiary)' }}>{pd.projectPath}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <WFStatus kind="active">● {pd.status}</WFStatus>
          {pd.handoverStatus === 'ACTIVE' && (
            <button className="wf-btn resume" aria-label={`Resume active handover for plan ${pd.title}. Copies CLI command to clipboard.`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></svg>
              Resume Handover
              <span className="wf-kbd" style={{ background: 'rgba(255,255,255,.15)', color: '#fff', borderColor: 'rgba(255,255,255,.25)' }}>⌘R</span>
            </button>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
        <span className="wf-eyebrow" style={{ color: 'var(--color-ink-tertiary)' }}>Plan-level gates</span>
        <WFGateStrip gates={{ plan: 'done', execute: 'active', review: 'pending' }} large />
        <span style={{ color: 'var(--color-ink-tertiary)' }}>·</span>
        <span style={{ fontSize: 12, color: 'var(--color-ink-subtle)' }}>current phase</span>
        <span className="wf-mono-sm" style={{ color: 'var(--color-ink)' }}>2 of {pd.phases.length}</span>
        <span style={{ color: 'var(--color-ink-tertiary)' }}>·</span>
        <WFOwner owner="codex" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// P1 — ANCHOR: 8/4 split, vertical phase tree, 3 rail cards
// ─────────────────────────────────────────────────────────
function WFPlanAnchor({ data, expandedPhases = [2], showAllExpanded = false }) {
  const pd = data.planDetail;
  return (
    <div className="wf-screen">
      <WFTopbar machine={data.machine} sessions={data.activeSessions} route="workspace" />
      <div className="wf-body">
        <main className="wf-main no-pad" style={{ display: 'flex', flexDirection: 'column' }}>
          <WFPlanHeader pd={pd} />
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 0, flex: 1, minHeight: 0 }}>
            {/* phase tree */}
            <section style={{ padding: '20px 24px', overflow: 'auto' }}>
              <ol role="tree" aria-label="Plan phases" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {pd.phases.map((phase, i) => {
                  const expanded = showAllExpanded || expandedPhases.includes(phase.id);
                  const isActive = Object.values(phase.gates).includes('active');
                  const nextHasActive = i < pd.phases.length - 1 &&
                    Object.values(pd.phases[i + 1].gates).includes('active');
                  return (
                    <li key={phase.id} style={{ listStyle: 'none' }}>
                      <WFPhaseCard phase={phase} expanded={expanded} current={isActive} />
                      {i < pd.phases.length - 1 && (
                        <div className={
                          'wf-phase-connector' +
                          (phase.gates.review === 'done' && nextHasActive ? ' active' : '') +
                          (Object.values(phase.gates).every(g => g === 'pending') ? ' dashed' : '')
                        } aria-hidden="true" />
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
            {/* context rail */}
            <aside style={{
              padding: '20px 24px 20px 0',
              borderLeft: '1px solid var(--color-hairline)',
              marginLeft: 0,
              paddingLeft: 24,
              overflow: 'auto',
            }} aria-label="Plan context">
              <WFHandoverRail pd={pd} />
              <WFSessionsRail pd={pd} />
              <WFEventsRail events={data.events} />
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// P2 — Horizontal kanban-style phase columns
// ─────────────────────────────────────────────────────────
function WFPlanKanban({ data }) {
  const pd = data.planDetail;
  return (
    <div className="wf-screen">
      <WFTopbar machine={data.machine} sessions={data.activeSessions} route="workspace" />
      <main className="wf-main no-pad" style={{ display: 'flex', flexDirection: 'column' }}>
        <WFPlanHeader pd={pd} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: 20, overflowX: 'auto', flex: 1 }}>
          {pd.phases.map((phase) => {
            const isActive = Object.values(phase.gates).includes('active');
            const isDone = Object.values(phase.gates).every(g => g === 'done');
            const className =
              'wf-phase' +
              (isActive ? ' active glow' : '') +
              (isDone ? ' done' : '') +
              (Object.values(phase.gates).every(g => g === 'pending') ? ' pending' : '');
            return (
              <article key={phase.id} className={className} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="wf-phase-index">{String(phase.id).padStart(2,'0')}</div>
                  <WFOwner owner={phase.owner} />
                  <span style={{ marginLeft: 'auto' }}>
                    {phase.review === 'PASS' && <WFStatus kind="pass">✓</WFStatus>}
                    {isActive && <WFStatus kind="active">●</WFStatus>}
                  </span>
                </div>
                <div className="wf-phase-title" style={{ fontSize: 14, lineHeight: 1.3 }}>{phase.title}</div>
                <WFGateStrip gates={phase.gates} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {phase.tasks.map((t, i) => (
                    <div key={i} className={'wf-task' + (t.done ? ' done' : '') + (t.active ? ' active' : '')} style={{ padding: '3px 4px', fontSize: 12 }}>
                      <span className={'wf-checkbox' + (t.done ? ' checked' : '') + (t.active ? ' active' : '')} />
                      <span>{t.label}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-ink-tertiary)' }}>
                  <span className="wf-mono-sm">{phase.files} files</span>
                  <span>{phase.started || 'not started'}</span>
                </div>
              </article>
            );
          })}
        </div>
        <div style={{
          borderTop: '1px solid var(--color-hairline)',
          padding: '12px 20px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 20,
          background: 'var(--color-canvas)',
          maxHeight: 200,
          overflow: 'hidden',
        }}>
          <WFHandoverRail pd={pd} />
          <WFSessionsRail pd={pd} />
          <WFEventsRail events={data.events} />
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// P3 — Sticky outline navigator (left) + expanded focus phase
// ─────────────────────────────────────────────────────────
function WFPlanOutline({ data }) {
  const pd = data.planDetail;
  const current = pd.phases.find((p) => Object.values(p.gates).includes('active')) || pd.phases[0];
  return (
    <div className="wf-screen">
      <WFTopbar machine={data.machine} sessions={data.activeSessions} route="workspace" />
      <main className="wf-main no-pad" style={{ display: 'flex', flexDirection: 'column' }}>
        <WFPlanHeader pd={pd} />
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 300px', gap: 0, flex: 1, minHeight: 0 }}>
          {/* outline */}
          <aside style={{ borderRight: '1px solid var(--color-hairline)', padding: '18px 16px', overflow: 'auto' }}>
            <div className="wf-eyebrow" style={{ marginBottom: 10 }}>Phase outline</div>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {pd.phases.map((phase) => {
                const isActive = Object.values(phase.gates).includes('active');
                const isDone = Object.values(phase.gates).every(g => g === 'done');
                return (
                  <li key={phase.id}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: isActive ? 'var(--color-surface-2)' : 'transparent',
                      border: isActive ? '1px solid color-mix(in oklch, var(--color-primary) 40%, transparent)' : '1px solid transparent',
                    }}>
                      <span style={{
                        width: 18, height: 18, borderRadius: 4,
                        background: isActive ? 'var(--color-primary)' : (isDone ? 'var(--color-surface-3)' : 'transparent'),
                        border: isDone || isActive ? 0 : '1px dashed var(--color-hairline-strong)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
                        color: isActive ? '#fff' : 'var(--color-ink-subtle)',
                        flexShrink: 0, marginTop: 1,
                      }}>{phase.id}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: 12.5,
                          fontWeight: isActive ? 500 : 400,
                          color: isActive ? 'var(--color-ink)' : (isDone ? 'var(--color-ink-muted)' : 'var(--color-ink-subtle)'),
                          marginBottom: 4,
                          lineHeight: 1.25,
                        }}>{phase.title}</div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {['plan','execute','review'].map((g) => (
                            <span key={g} style={{
                              width: 16, height: 4, borderRadius: 2,
                              background:
                                phase.gates[g] === 'done' ? 'var(--color-ink-muted)' :
                                phase.gates[g] === 'active' ? 'var(--color-primary)' :
                                phase.gates[g] === 'failed' ? 'var(--status-fail)' :
                                'var(--color-surface-3)',
                            }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="wf-divider" />
            <div className="wf-eyebrow" style={{ marginBottom: 8 }}>Jump to</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--color-ink-subtle)' }}>
              <span>↑ handover.md</span>
              <span>↑ session cache</span>
              <span>↑ recent events</span>
            </div>
          </aside>
          {/* focused phase */}
          <section style={{ padding: '20px 24px', overflow: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <WFPhaseCard phase={current} expanded current />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 14, color: 'var(--color-ink-subtle)', fontSize: 12 }}>
                <span className="wf-kbd">↓</span>
                <span>preview next: <span style={{ color: 'var(--color-ink)' }}>{pd.phases[2].title}</span></span>
              </div>
              <div style={{ opacity: 0.65 }}>
                <WFPhaseCard phase={pd.phases[2]} />
              </div>
            </div>
          </section>
          {/* context rail */}
          <aside style={{ borderLeft: '1px solid var(--color-hairline)', padding: '20px 18px', overflow: 'auto' }}>
            <WFHandoverRail pd={pd} />
            <WFSessionsRail pd={pd} />
          </aside>
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// P4 — Horizontal timeline rail + accordion phase rows below
// ─────────────────────────────────────────────────────────
function WFPlanTimeline({ data }) {
  const pd = data.planDetail;
  const currentIdx = pd.phases.findIndex((p) => Object.values(p.gates).includes('active'));
  return (
    <div className="wf-screen">
      <WFTopbar machine={data.machine} sessions={data.activeSessions} route="workspace" />
      <main className="wf-main no-pad" style={{ display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        <WFPlanHeader pd={pd} />
        {/* horizontal timeline */}
        <div style={{ padding: '22px 28px 18px 28px', borderBottom: '1px solid var(--color-hairline)' }}>
          <div className="wf-eyebrow" style={{ marginBottom: 12 }}>Plan timeline</div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ position: 'absolute', left: 14, right: 14, top: '50%', height: 2, background: 'var(--color-hairline-strong)', transform: 'translateY(-50%)', zIndex: 0 }} />
            <div style={{ position: 'absolute', left: 14, top: '50%', height: 2, width: `${(currentIdx + 0.5) / pd.phases.length * 100}%`, background: 'var(--color-primary)', transform: 'translateY(-50%)', zIndex: 0 }} />
            {pd.phases.map((phase, i) => {
              const isActive = Object.values(phase.gates).includes('active');
              const isDone = Object.values(phase.gates).every(g => g === 'done');
              return (
                <div key={phase.id} style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: isActive ? 'var(--color-primary)' : (isDone ? 'var(--color-ink-muted)' : 'var(--color-canvas)'),
                    border: isDone || isActive ? 0 : '1.5px solid var(--color-hairline-strong)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
                    color: isActive || isDone ? '#fff' : 'var(--color-ink-subtle)',
                  }}>{phase.id}</div>
                  <div style={{ textAlign: 'center', maxWidth: 160 }}>
                    <div style={{ fontSize: 12.5, fontWeight: isActive ? 500 : 400, color: isActive ? 'var(--color-ink)' : 'var(--color-ink-muted)', lineHeight: 1.25 }}>{phase.title}</div>
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
                      <WFGateStrip gates={phase.gates} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* expanded current phase + rails inline below */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, padding: 24 }}>
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="wf-eyebrow">Current phase</div>
            <WFPhaseCard phase={pd.phases[currentIdx]} expanded current />
            <div className="wf-eyebrow" style={{ marginTop: 12 }}>Upcoming</div>
            {pd.phases.slice(currentIdx + 1).map((phase) => (
              <WFPhaseCard key={phase.id} phase={phase} />
            ))}
          </section>
          <aside>
            <WFHandoverRail pd={pd} />
            <WFSessionsRail pd={pd} />
          </aside>
        </div>
      </main>
    </div>
  );
}

Object.assign(window, { WFPlanAnchor, WFPlanKanban, WFPlanOutline, WFPlanTimeline,
                        WFHandoverRail, WFSessionsRail, WFEventsRail, WFPlanHeader });

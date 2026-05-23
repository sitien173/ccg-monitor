/* global React, WFTopbar */

function WFSparkline({ data }) {
  const max = Math.max(...data, 1);
  return (
    <div className="wf-sparkline" aria-label={`Events per minute, last ${data.length} minutes`}>
      {data.map((v, i) => (
        <i key={i} style={{ height: `${Math.max(2, (v / max) * 28)}px`, opacity: i > data.length - 5 ? 1 : 0.55 }} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// A1 — Single column log + sparkline + filter chips
// ─────────────────────────────────────────────────────────
function WFActivityStream({ data }) {
  const cats = ['all', 'route.*', 'tool.*', 'gate.*', 'phase.*', 'handover.*'];
  return (
    <div className="wf-screen">
      <WFTopbar machine={data.machine} sessions={data.activeSessions} route="activity" />
      <main className="wf-main no-pad" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* filter bar + sparkline */}
        <div className="wf-sticky" style={{ padding: '18px 24px 14px 24px', borderBottom: '1px solid var(--color-hairline)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
            <div>
              <h1 className="wf-h1" style={{ margin: 0 }}>Live activity</h1>
              <div className="wf-mono-sm" style={{ color: 'var(--color-ink-subtle)', marginTop: 4 }}>
                SSE · daemon@{data.machine} · {data.events.length} in view · streaming
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <span className="wf-eyebrow">last 60m</span>
              <WFSparkline data={data.sparkline} />
              <span className="wf-mono-sm" style={{ color: 'var(--color-ink-tertiary)' }}>peak 11/m · now 7/m</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {cats.map((c, i) => (
              <span key={c} className={'wf-chip' + (i === 0 ? ' active' : '')}>
                {c}
                {i === 0 && <span className="wf-count">{data.events.length}</span>}
                {i === 1 && <span className="wf-count">2</span>}
                {i === 2 && <span className="wf-count">2</span>}
                {i === 3 && <span className="wf-count">2</span>}
                {i === 4 && <span className="wf-count">1</span>}
                {i === 5 && <span className="wf-count">1</span>}
              </span>
            ))}
            <div style={{ flex: 1 }} />
            <span className="wf-chip">project · all</span>
            <span className="wf-chip">⏸ pause stream</span>
          </div>
        </div>
        {/* event log */}
        <div role="log" aria-live="polite" aria-label="Live activity log" style={{ flex: 1, overflow: 'auto' }}>
          {data.events.map((e, i) => (
            <div key={i} className="wf-event">
              <span className="wf-mono-sm">{e.ts}</span>
              <span>
                <span style={{ color: 'var(--color-ink)', fontSize: 12.5 }}>{e.project}</span>
              </span>
              <span><span className="wf-event-type" data-cat={e.cat}>{e.type}</span></span>
              <span style={{ fontSize: 12.5, color: 'var(--color-ink-muted)' }}>{e.summary}</span>
            </div>
          ))}
          <div style={{ padding: 18, textAlign: 'center', fontSize: 11.5, color: 'var(--color-ink-tertiary)' }}>↑ waiting for events</div>
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// A2 — Two-pane: log + JSON detail drawer
// ─────────────────────────────────────────────────────────
function WFActivitySplit({ data }) {
  const selected = data.events[2]; // phase.updated
  const samplePayload = {
    type: 'phase.updated',
    ts: '2026-05-22T10:41:55.183Z',
    project: 'superpowers-ccgv2',
    plan_slug: '2026-05-22-ccg-monitor',
    phase_id: 2,
    diff: {
      'gates.execute': { from: 'pending', to: 'active' },
      'started_at': { from: null, to: '2026-05-22T10:41:55.181Z' },
    },
    by_session: '8f3a…b29c',
    source: 'handover.md',
  };
  return (
    <div className="wf-screen">
      <WFTopbar machine={data.machine} sessions={data.activeSessions} route="activity" />
      <main className="wf-main no-pad" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="wf-sticky" style={{ padding: '14px 24px', borderBottom: '1px solid var(--color-hairline)', display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 className="wf-h1" style={{ margin: 0, fontSize: 18 }}>Live activity</h1>
          <span className="wf-mono-sm" style={{ color: 'var(--color-ink-subtle)' }}>streaming · 7/m</span>
          <div style={{ flex: 1 }} />
          <WFSparkline data={data.sparkline.slice(-30)} />
          <span className="wf-chip active">all events</span>
          <span className="wf-chip">⏸</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 0, flex: 1, minHeight: 0 }}>
          {/* log */}
          <div role="log" aria-live="polite" style={{ overflow: 'auto', borderRight: '1px solid var(--color-hairline)' }}>
            {data.events.map((e, i) => {
              const active = e === selected;
              return (
                <div key={i} style={{
                  display: 'grid',
                  gridTemplateColumns: '80px 140px 140px 1fr 18px',
                  gap: 14,
                  padding: '9px 16px',
                  fontSize: 12.5,
                  borderBottom: '1px solid var(--color-hairline)',
                  background: active ? 'var(--color-surface-2)' : 'transparent',
                  borderLeft: active ? '2px solid var(--color-primary)' : '2px solid transparent',
                  paddingLeft: active ? 14 : 16,
                  alignItems: 'center',
                }}>
                  <span className="wf-mono-sm" style={{ color: 'var(--color-ink-subtle)' }}>{e.ts}</span>
                  <span style={{ color: 'var(--color-ink)' }}>{e.project}</span>
                  <span><span className="wf-event-type" data-cat={e.cat}>{e.type}</span></span>
                  <span style={{ color: 'var(--color-ink-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.summary}</span>
                  <span style={{ color: 'var(--color-ink-tertiary)', fontSize: 11 }}>›</span>
                </div>
              );
            })}
          </div>
          {/* detail drawer */}
          <aside style={{ padding: '18px 20px', overflow: 'auto', background: 'var(--color-canvas)' }} aria-label="Event detail">
            <div className="wf-eyebrow" style={{ marginBottom: 8 }}>event detail</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span className="wf-event-type" data-cat={selected.cat} style={{ fontSize: 12 }}>{selected.type}</span>
              <span className="wf-mono-sm" style={{ color: 'var(--color-ink-tertiary)' }}>{selected.ts}</span>
            </div>
            <div style={{ color: 'var(--color-ink)', fontSize: 13, marginBottom: 4 }}>{selected.project}</div>
            <div style={{ color: 'var(--color-ink-subtle)', fontSize: 12.5, marginBottom: 14 }}>{selected.summary}</div>
            <div className="wf-eyebrow" style={{ marginBottom: 6 }}>payload</div>
            <pre style={{
              background: 'var(--color-surface-1)',
              border: '1px solid var(--color-hairline)',
              borderRadius: 6,
              padding: '10px 12px',
              fontSize: 11.5,
              lineHeight: 1.6,
              color: 'var(--color-ink-muted)',
              fontFamily: 'var(--font-mono)',
              margin: 0,
              whiteSpace: 'pre-wrap',
              overflowX: 'auto',
            }}>{JSON.stringify(samplePayload, null, 2)}</pre>
            <div className="wf-eyebrow" style={{ marginTop: 16, marginBottom: 6 }}>related</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--color-primary-hover)' }}>→ open plan {selected.project}/…ccg-monitor</span>
              <span style={{ fontSize: 12, color: 'var(--color-primary-hover)' }}>→ session 8f3a…b29c</span>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

Object.assign(window, { WFActivityStream, WFActivitySplit, WFSparkline });

import { html, useState } from 'https://esm.sh/htm/preact/standalone';
import { WFTopbar, WFSparkline } from '../primitives.js';

export function WFActivitySplit({ events, machine, activeSessions, onSearchClick, onThemeToggle }) {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [activeCat, setActiveCat] = useState('all');
  const [isPaused, setIsPaused] = useState(false);

  const cats = ['all', 'route.*', 'tool.*', 'gate.*', 'phase.*', 'handover.*'];

  // Filter events based on active category
  const filteredEvents = events.filter(e => {
    if (activeCat === 'all') return true;
    const prefix = activeCat.replace('.*', '');
    return e.event_type.startsWith(prefix);
  });

  // Calculate standard category counts
  const getCatCount = (cat) => {
    if (cat === 'all') return events.length;
    const prefix = cat.replace('.*', '');
    return events.filter(e => e.event_type.startsWith(prefix)).length;
  };

  // Generate sparkline from events (group by timestamp minute or fallback to mock)
  const sparklineData = events.reduce((acc, e) => {
    try {
      const minute = new Date(e.ts).getMinutes();
      acc[minute % 30] = (acc[minute % 30] || 0) + 1;
    } catch {
      // ignore
    }
    return acc;
  }, Array(30).fill(1)); // default baseline

  const activeSelected = selectedEvent || filteredEvents[0];

  return html`
    <div class="wf-screen">
      <${WFTopbar} machine=${machine} sessions=${activeSessions} route="activity" onSearchClick=${onSearchClick} onThemeToggle=${onThemeToggle} />
      <main class="wf-main no-pad" style=${{ display: 'flex', flexDirection: 'column' }}>
        <!-- filter bar + sparkline -->
        <div class="wf-sticky" style=${{ padding: '18px 24px 14px 24px', borderBottom: '1px solid var(--color-hairline)' }}>
          <div style=${{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
            <div>
              <h1 class="wf-h1" style=${{ margin: 0 }}>Live activity</h1>
              <div class="wf-mono-sm" style=${{ color: 'var(--color-ink-subtle)', marginTop: 4 }}>
                SSE · daemon@${machine} · ${events.length} in view · ${isPaused ? 'paused' : 'streaming'}
              </div>
            </div>
            <div style=${{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <span class="wf-eyebrow">last 30m</span>
              <${WFSparkline} data=${sparklineData} />
              <span class="wf-mono-sm" style=${{ color: 'var(--color-ink-tertiary)' }}>peak ${Math.max(...sparklineData, 1)}/m</span>
            </div>
          </div>
          <div style=${{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            ${cats.map((c) => html`
              <span key=${c} class=${'wf-chip' + (activeCat === c ? ' active' : '')} onClick=${() => setActiveCat(c)} style=${{ cursor: 'pointer' }}>
                ${c}
                <span class="wf-count">${getCatCount(c)}</span>
              </span>
            `)}
            <div style=${{ flex: 1 }} />
            <span class="wf-chip" onClick=${() => setIsPaused(!isPaused)} style=${{ cursor: 'pointer', userSelect: 'none' }}>
              ${isPaused ? '▶ resume stream' : '⏸ pause stream'}
            </span>
          </div>
        </div>

        <div style=${{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 0, flex: 1, minHeight: 0 }} id="main-content">
          <!-- log -->
          <div role="log" aria-live="polite" style=${{ overflow: 'auto', borderRight: '1px solid var(--color-hairline)' }}>
            ${filteredEvents.length === 0 ? html`
              <div style=${{ padding: '40px', textAlign: 'center', color: 'var(--color-ink-tertiary)' }}>
                No events streamed yet. Waiting for tools or routes...
              </div>
            ` : filteredEvents.map((e, i) => {
              const active = activeSelected && activeSelected.event_id === e.event_id;
              const dateString = e.ts ? new Date(e.ts).toLocaleTimeString() : '';
              return html`
                <div key=${e.event_id || i} style=${{
                  display: 'grid',
                  gridTemplateColumns: '80px 140px 140px 1fr 18px',
                  gap: 14,
                  padding: '9px 16px',
                  fontSize: '12.5px',
                  borderBottom: '1px solid var(--color-hairline)',
                  background: active ? 'var(--color-surface-2)' : 'transparent',
                  borderLeft: active ? '2px solid var(--color-primary)' : '2px solid transparent',
                  paddingLeft: active ? 14 : 16,
                  alignItems: 'center',
                  cursor: 'pointer'
                }} onClick=${() => setSelectedEvent(e)}>
                  <span class="wf-mono-sm" style=${{ color: 'var(--color-ink-subtle)' }}>${dateString}</span>
                  <span style=${{ color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>${e.project_id || 'system'}</span>
                  <span><span class="wf-event-type" data-cat=${e.event_type.split('.')[0]}>${e.event_type}</span></span>
                  <span style=${{ color: 'var(--color-ink-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>${e.source || 'fs_watcher'}</span>
                  <span style=${{ color: 'var(--color-ink-tertiary)', fontSize: 11 }}>›</span>
                </div>
              `;
            })}
          </div>

          <!-- detail drawer -->
          <aside style=${{ padding: '18px 20px', overflow: 'auto', background: 'var(--color-canvas)' }} aria-label="Event detail">
            ${activeSelected ? html`
              <div>
                <div class="wf-eyebrow" style=${{ marginBottom: 8 }}>event detail</div>
                <div style=${{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <span class="wf-event-type" data-cat=${activeSelected.event_type.split('.')[0]} style=${{ fontSize: 12 }}>${activeSelected.event_type}</span>
                  <span class="wf-mono-sm" style=${{ color: 'var(--color-ink-tertiary)' }}>${activeSelected.ts}</span>
                </div>
                <div style=${{ color: 'var(--color-ink)', fontSize: 13, marginBottom: 4 }}>Project: ${activeSelected.project_id || 'system'}</div>
                <div style=${{ color: 'var(--color-ink-subtle)', fontSize: 12.5, marginBottom: 14 }}>Source: ${activeSelected.source || 'watcher'}</div>
                
                <div class="wf-eyebrow" style=${{ marginBottom: 6 }}>payload</div>
                <pre style=${{
                  background: 'var(--color-surface-1)',
                  border: '1px solid var(--color-hairline)',
                  borderRadius: 6,
                  padding: '10px 12px',
                  fontSize: '11.5px',
                  lineHeight: 1.6,
                  color: 'var(--color-ink-muted)',
                  fontFamily: 'var(--font-mono)',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  overflowX: 'auto',
                }}>${JSON.stringify(activeSelected.payload || {}, null, 2)}</pre>
                
                <div class="wf-eyebrow" style=${{ marginTop: 16, marginBottom: 6 }}>related</div>
                <div style=${{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  ${activeSelected.project_id && activeSelected.plan_slug && html`
                    <a href="#/p/${activeSelected.project_id}/plan/${activeSelected.plan_slug}" style=${{ fontSize: 12, color: 'var(--color-primary-hover)', textDecoration: 'none' }}>
                      → open plan ${activeSelected.project_id}/${activeSelected.plan_slug}
                    </a>
                  `}
                  ${activeSelected.session_id && html`
                    <span style=${{ fontSize: 12, color: 'var(--color-ink-subtle)' }}>
                      → session ${activeSelected.session_id}
                    </span>
                  `}
                </div>
              </div>
            ` : html`
              <div style=${{ padding: '20px 0', textAlign: 'center', color: 'var(--color-ink-tertiary)' }}>
                Select an event to view details
              </div>
            `}
          </aside>
        </div>
      </main>
    </div>
  `;
}

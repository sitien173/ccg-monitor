import { html, useState, useEffect } from 'https://esm.sh/htm/preact/standalone';
import { WFTopbar, WFPhaseCard, WFGateStrip, WFOwner, WFOwnerDot, WFStatus } from '../primitives.js';
import { WFStateFailSideRail } from '../states/fail.js';

function WFHandoverRail({ plan, handoverMd }) {
  // If there's no handoverMd in data, generate it from the plan
  const md = handoverMd || [
    ['status', plan.handover_status || 'DRAFT'],
    ['current_phase', plan.current_phase || '1'],
    ['updated_at', new Date(plan.updated_at).toLocaleString()],
  ];

  return html`
    <section class="wf-rail-section">
      <div class="wf-eyebrow" style=${{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>handover.md</span>
        <span class="wf-mono-sm" style=${{ marginLeft: 'auto', color: 'var(--color-ink-tertiary)' }}>active</span>
      </div>
      <div style=${{
        background: 'var(--color-surface-1)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 8,
        padding: '10px 12px',
        fontFamily: 'var(--font-mono)',
        fontSize: 11.5,
        lineHeight: 1.7,
      }}>
        ${md.map(([k, v], i) => html`
          <div key=${i} style=${{ display: 'flex', gap: 8 }}>
            <span style=${{ color: 'var(--color-ink-tertiary)' }}>${k}${v ? ':' : ''}</span>
            ${v && html`<span style=${{ color: k.startsWith(' ') ? 'var(--color-ink-muted)' : 'var(--color-primary-hover)' }}>${v}</span>`}
          </div>
        `)}
      </div>
    </section>
  `;
}

function WFSessionsRail({ sessionsCache }) {
  const cache = sessionsCache || [];

  return html`
    <section class="wf-rail-section">
      <div class="wf-eyebrow">Session cache <span class="wf-mono-sm" style=${{ marginLeft: 8, color: 'var(--color-ink-tertiary)' }}>.sessions.json</span></div>
      <div style=${{
        background: 'var(--color-surface-1)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        ${cache.length === 0 ? html`
          <div style=${{ padding: '8px 12px', fontSize: 12, color: 'var(--color-ink-tertiary)' }}>No sessions cached</div>
        ` : cache.map((s, i) => html`
          <div key=${i} style=${{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            borderBottom: i < cache.length - 1 ? '1px solid var(--color-hairline)' : 0,
            fontSize: 12,
          }}>
            <${WFOwnerDot} owner=${s.backend} />
            <span style=${{ color: 'var(--color-ink)', minWidth: 56 }}>${s.backend}</span>
            <span class="wf-mono-sm" style=${{ color: 'var(--color-ink-subtle)' }}>${s.id}</span>
            <span style=${{ marginLeft: 'auto', color: 'var(--color-ink-tertiary)', fontSize: 11.5 }}>${s.lastUsed}</span>
          </div>
        `)}
      </div>
    </section>
  `;
}

function WFEventsRail({ events }) {
  return html`
    <section class="wf-rail-section">
      <div class="wf-eyebrow" style=${{ display: 'flex', alignItems: 'center' }}>
        <span>Recent events</span>
        <a href="#/activity" style=${{ marginLeft: 'auto', color: 'var(--color-primary-hover)', fontSize: 10, textDecoration: 'none' }}>open live activity →</a>
      </div>
      <div style=${{
        background: 'var(--color-surface-1)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        ${events.length === 0 ? html`
          <div style=${{ padding: '8px 12px', fontSize: 12, color: 'var(--color-ink-tertiary)' }}>No recent events</div>
        ` : events.slice(0, 6).map((e, i) => html`
          <div key=${i} style=${{
            display: 'grid',
            gridTemplateColumns: '52px 1fr',
            gap: 8,
            padding: '6px 12px',
            borderBottom: i < Math.min(events.length, 6) - 1 ? '1px solid var(--color-hairline)' : 0,
            fontSize: 11.5,
            alignItems: 'baseline',
          }}>
            <span class="wf-mono-sm" style=${{ color: 'var(--color-ink-tertiary)' }}>${e.ts ? e.ts.slice(11, 16) : ''}</span>
            <div style=${{ minWidth: 0 }}>
              <div class="wf-mono-sm" style=${{ color: 'var(--color-ink-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>${e.event_type}</div>
              <div style=${{ color: 'var(--color-ink-subtle)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>${e.source || 'system'}</div>
            </div>
          </div>
        `)}
      </div>
    </section>
  `;
}

function WFPlanHeader({ plan, phases, onResumeClick, isNarrow = false }) {
  const currentPhaseIndex = phases.findIndex(p => Object.values(p.gates || {}).includes('active')) + 1;

  return html`
    <div class="wf-plan-header wf-sticky" style=${{
      padding: '18px 24px 14px 24px',
      borderBottom: '1px solid var(--color-hairline)',
      background: 'var(--color-canvas)',
    }}>
      <div style=${{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, fontSize: 12, color: 'var(--color-ink-subtle)' }}>
        <a href="#/" class="wf-kbd" aria-label="back" style=${{ padding: '2px 6px', textDecoration: 'none', cursor: 'pointer' }}>←</a>
        <span style=${{ color: 'var(--color-ink-muted)' }}>${plan.project_id}</span>
        <span style=${{ color: 'var(--color-ink-tertiary)' }}>/</span>
        <span>plans</span>
        <span style=${{ color: 'var(--color-ink-tertiary)' }}>/</span>
        <span class="wf-mono-sm">${plan.slug}</span>
      </div>
      <div style=${{ display: 'flex', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
        <div style=${{ flex: 1, minWidth: 240 }}>
          <h1 class="wf-h1" style=${{ margin: 0, marginBottom: 6 }}>${plan.title || 'Plan Detail'}</h1>
          <div class="wf-mono-sm" style=${{ color: 'var(--color-ink-tertiary)' }}>${plan.projectPath || ''}</div>
        </div>
        <div style=${{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <${WFStatus} kind=${plan.status === 'FAIL' ? 'fail' : 'active'}>● ${plan.status || 'ACTIVE'}</${WFStatus}>
          ${plan.handover_status === 'ACTIVE' && html`
            <button class="wf-btn resume" aria-label="Resume active handover" onClick=${onResumeClick}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></svg>
              Resume Handover
              <span class="wf-kbd" style=${{ background: 'rgba(255,255,255,.15)', color: '#fff', borderColor: 'rgba(255,255,255,.25)' }}>⌘R</span>
            </button>
          `}
        </div>
      </div>
      <div style=${{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
        <span class="wf-eyebrow" style=${{ color: 'var(--color-ink-tertiary)' }}>Plan-level gates</span>
        <${WFGateStrip} gates=${{ plan: 'done', execute: plan.status === 'FAIL' ? 'failed' : 'active', review: 'pending' }} large />
        <span style=${{ color: 'var(--color-ink-tertiary)' }}>·</span>
        <span style=${{ fontSize: 12, color: 'var(--color-ink-subtle)' }}>current phase</span>
        <span class="wf-mono-sm" style=${{ color: 'var(--color-ink)' }}>${currentPhaseIndex || 1} of ${phases.length}</span>
        <span style=${{ color: 'var(--color-ink-tertiary)' }}>·</span>
        <${WFOwner} owner=${phases[currentPhaseIndex - 1]?.owner} />
      </div>
    </div>
  `;
}

export function WFPlanDetail({ planData, machine, activeSessions, recentEvents, onSearchClick, onThemeToggle }) {
  const { plan, phases, tasks } = planData;

  // Track expanded phases
  const [expandedPhases, setExpandedPhases] = useState([]);
  const [toast, setToast] = useState('');

  // Automatically expand the active phase or failed phase on load
  useEffect(() => {
    if (phases && phases.length > 0) {
      const activeIds = phases
        .filter(p => Object.values(p.gates || {}).includes('active') || Object.values(p.gates || {}).includes('failed'))
        .map(p => p.phase_id);
      if (activeIds.length > 0) {
        setExpandedPhases(activeIds);
      } else {
        // Expand the first phase by default
        setExpandedPhases([phases[0].phase_id]);
      }
    }
  }, [phases]);

  const toggleExpand = (phaseId) => {
    setExpandedPhases(prev =>
      prev.includes(phaseId) ? prev.filter(id => id !== phaseId) : [...prev, phaseId]
    );
  };

  const handleResume = () => {
    const cmd = `ccgmon resume ${plan.project_id || ''} ${plan.slug || ''}`;
    navigator.clipboard.writeText(cmd)
      .then(() => {
        setToast('Command copied to clipboard!');
        setTimeout(() => setToast(''), 3000);
      })
      .catch(() => {
        console.error('Failed to copy to clipboard');
      });
  };

  // Find failed phase for rendering S2 findings if plan is failed
  const failedPhase = phases.find(p => p.review === 'FAIL');

  return html`
    <div class="wf-screen">
      <${WFTopbar} machine=${machine} sessions=${activeSessions} route="workspace" onSearchClick=${onSearchClick} onThemeToggle=${onThemeToggle} />
      <div class="wf-body">
        <main class="wf-main no-pad" style=${{ display: 'flex', flexDirection: 'column' }}>
          <${WFPlanHeader} plan=${plan} phases=${phases} onResumeClick=${handleResume} />
          
          <div style=${{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 0, flex: 1, minHeight: 0 }}>
            <!-- Phase tree -->
            <section id="main-content" style=${{ padding: '20px 24px', overflow: 'auto' }}>
              <ol role="tree" aria-label="Plan phases" style=${{ listStyle: 'none', margin: 0, padding: 0 }}>
                ${phases.map((phase, i) => {
                  const expanded = expandedPhases.includes(phase.phase_id);
                  const isActive = Object.values(phase.gates || {}).includes('active') || Object.values(phase.gates || {}).includes('failed');
                  return html`
                    <li key=${phase.phase_id} style=${{ listStyle: 'none' }}>
                      <${WFPhaseCard} 
                        phase=${{
                          ...phase,
                          id: phase.phase_id,
                          gates: phase.gates || { plan: 'pending', execute: 'pending', review: 'pending' },
                          tasks: tasks.filter(t => t.phase_id === phase.phase_id).map(t => ({ label: t.title, done: t.status === 'DONE', active: t.status === 'ACTIVE' })),
                          files: phase.files || 0,
                          fileList: phase.fileList || [],
                          findings: phase.findings || []
                        }} 
                        expanded=${expanded} 
                        current=${isActive} 
                        onToggleExpand=${() => toggleExpand(phase.phase_id)}
                      />
                      ${i < phases.length - 1 && html`
                        <div class=${'wf-phase-connector' + (isPhaseDone(phase) ? ' active' : '')} aria-hidden="true" />
                      `}
                    </li>
                  `;
                })}
              </ol>
            </section>
            
            <!-- Context Rail -->
            <aside style=${{
              padding: '20px 24px 20px 0',
              borderLeft: '1px solid var(--color-hairline)',
              marginLeft: 0,
              paddingLeft: 24,
              overflow: 'auto',
            }} aria-label="Plan context">
              ${failedPhase ? html`
                <${WFStateFailSideRail} 
                  phase=${{
                    id: failedPhase.phase_id,
                    findings: failedPhase.findings || []
                  }} 
                  onClickResume=${handleResume} 
                />
              ` : html`
                <${WFHandoverRail} plan=${plan} />
              `}
              <${WFSessionsRail} sessionsCache=${plan.sessionsCache || []} />
              <${WFEventsRail} events=${recentEvents || []} />
            </aside>
          </div>
        </main>
      </div>

      <!-- Simple Toast -->
      ${toast && html`
        <div style=${{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--color-primary)',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 9999,
          fontSize: 13,
          fontWeight: 500
        }}>
          ${toast}
        </div>
      `}
    </div>
  `;
}

function isPhaseDone(phase) {
  return phase.completed_at || Object.values(phase.gates || {}).every(g => g === 'done');
}

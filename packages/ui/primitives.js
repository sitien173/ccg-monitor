import { html } from 'https://esm.sh/htm/preact/standalone';

// ── Owner badge (monogram-only; no real logos per brief) ──
export function WFOwner({ owner, showName = true }) {
  if (!owner) {
    return html`
      <span class="wf-owner">
        <span class="wf-owner-mark" data-owner="none">·</span>
        ${showName && html`<span style=${{ color: 'var(--color-ink-tertiary)' }}>idle</span>`}
      </span>
    `;
  }
  const monogram = { claude: 'C', codex: 'X', gemini: 'G' }[owner] || '?';
  return html`
    <span class="wf-owner">
      <span class="wf-owner-mark" data-owner=${owner} aria-hidden="true">${monogram}</span>
      ${showName && html`<span>${owner}</span>`}
    </span>
  `;
}

// ── Owner monogram only (no name) — for compact rows ──
export function WFOwnerDot({ owner }) {
  if (!owner) return html`<span class="wf-owner-mark" data-owner="none">·</span>`;
  const monogram = { claude: 'C', codex: 'X', gemini: 'G' }[owner] || '?';
  return html`<span class="wf-owner-mark" data-owner=${owner} aria-label=${owner}>${monogram}</span>`;
}

// ── Single gate chevron-chip ──
export function WFGate({ kind, state, label }) {
  const stateLabel = { pending: 'pending', active: 'active', done: 'done', failed: 'failed' }[state];
  return html`
    <div class="wf-gate" data-kind=${kind} data-state=${state} aria-label="${kind} gate: ${stateLabel}">
      <span class="wf-gate-icon" aria-hidden="true" />
      <span>${label || kind}</span>
    </div>
  `;
}

// ── Gate strip (3 gates) ──
export function WFGateStrip({ gates, large = false }) {
  return html`
    <div class=${'wf-gate-strip' + (large ? ' lg' : '')} role="group" aria-label="Phase gates">
      <${WFGate} kind="plan"    state=${gates.plan}    label="Plan" />
      <${WFGate} kind="execute" state=${gates.execute} label="Execute" />
      <${WFGate} kind="review"  state=${gates.review}  label="Review" />
    </div>
  `;
}

// ── Status pill ──
export function WFStatus({ kind, children }) {
  return html`<span class="wf-status" data-kind=${kind}>${children}</span>`;
}

// ── Topbar ──
export function WFTopbar({ machine, route = 'workspace', sessions = 2, search = '⌘K  search projects, plans, sessions…', onSearchClick, onThemeToggle }) {
  return html`
    <header class="wf-topbar">
      <div class="wf-logo">
        <span class="wf-logo-mark" aria-hidden="true" />
        <span>ccg-monitor</span>
      </div>
      <nav>
        <a href="#/" class=${'wf-tab' + (route === 'workspace' ? ' active' : '')}>Workspace</a>
        <a href="#/activity" class=${'wf-tab' + (route === 'activity' ? ' active' : '')}>Activity</a>
      </nav>
      <span class="wf-spacer" />
      <div class="wf-search" onClick=${onSearchClick} style=${{ cursor: 'pointer' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <span>${search}</span>
        <span class="wf-spacer" />
        <span class="wf-kbd">⌘K</span>
      </div>
      <div class="wf-machine">
        <span class="wf-dot live" aria-hidden="true" />
        <span>${machine}</span>
        <span style=${{ color: 'var(--color-ink-tertiary)' }}>·</span>
        <span>${sessions} live</span>
      </div>
      <span class="wf-kbd" aria-label="theme" onClick=${onThemeToggle} style=${{ cursor: 'pointer', userSelect: 'none' }}>☾</span>
    </header>
  `;
}

// ── Project card (workspace overview) ──
export function WFProjectCard({ p, onClickResume }) {
  const planUrl = p.activePlan ? `#/p/${p.project_id || p.id}/plan/${p.activePlan}` : null;
  const cardContent = html`
    <div style=${{ display: 'flex', alignItems: 'center', gap: 8 }}>
      ${p.live && html`<span class="wf-dot live" aria-label="live session" />`}
      <div class="wf-proj-name">${p.name}</div>
    </div>
    <div class="wf-proj-path" title=${p.path}>${p.path}</div>
    ${p.activePlan ? html`
      <div class="wf-plan-title" title=${p.planTitle}>${p.planTitle}</div>
      <${WFGateStrip} gates=${{
        plan:    p.gate === 'plan' ? 'active' : (['execute','review'].includes(p.gate) ? 'done' : 'pending'),
        execute: p.gate === 'execute' ? 'active' : (p.gate === 'review' ? 'done' : 'pending'),
        review:  p.gate === 'review' ? 'active' : 'pending',
      }} />
      <div class="wf-progress">
        <span class="wf-mono-sm">P${p.phase}/${p.totalPhases}</span>
        <div class="wf-progress-bar"><i style=${{ width: `${(p.phase / Math.max(p.totalPhases, 1)) * 100}%` }} /></div>
        <${WFOwnerDot} owner=${p.owner} />
      </div>
      <div style=${{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--color-ink-tertiary)' }}>
        <span class="wf-mono-sm">${p.activePlan}</span>
        <span>${p.lastActivity}</span>
      </div>
    ` : html`
      <div style=${{ flex: 1 }} />
      <div style=${{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style=${{ fontSize: 12, color: 'var(--color-ink-tertiary)' }}>no active plan</span>
        <span class="wf-mono-sm" style=${{ color: 'var(--color-ink-tertiary)' }}>${p.lastActivity}</span>
      </div>
    `}
    ${p.handoverActive && html`
      <div class="wf-proj-resume" onClick=${(e) => { e.preventDefault(); e.stopPropagation(); onClickResume(p.name, p.activePlan); }}>
        <button class="wf-btn resume" style=${{ height: 24, padding: '0 10px', fontSize: 11.5 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></svg>
          Resume
        </button>
      </div>
    `}
  `;

  if (planUrl) {
    return html`
      <a href=${planUrl} class=${'wf-proj' + (p.live ? ' live-edge' : '')} style=${{ display: 'flex', flexDirection: 'column', textDecoration: 'none', color: 'inherit' }}>
        ${cardContent}
      </a>
    `;
  }

  return html`
    <div class="wf-proj no-plan">
      ${cardContent}
    </div>
  `;
}

// ── Phase card (used in Plan Detail anchor) ──
export function WFPhaseCard({ phase, expanded = false, current = false, narrow = false, onToggleExpand }) {
  const isDone = Object.values(phase.gates).every((g) => g === 'done');
  const isActive = Object.values(phase.gates).includes('active');
  const isFailed = Object.values(phase.gates).includes('failed');
  const isPending = !isDone && !isActive && !isFailed;
  const className =
    'wf-phase' +
    (current || isActive ? ' active' + (current ? ' glow' : '') : '') +
    (isDone && !isFailed ? ' done' : '') +
    (isPending ? ' pending' : '');

  return html`
    <article class=${className} role="treeitem" aria-expanded=${expanded}>
      <header class="wf-phase-head" onClick=${onToggleExpand} style=${{ cursor: 'pointer' }}>
        <div class="wf-phase-index" aria-hidden="true">${String(phase.id).padStart(2,'0')}</div>
        <div style=${{ flex: 1, minWidth: 0 }}>
          <div class="wf-phase-title">${phase.title}</div>
          <div class="wf-phase-meta">
            <${WFOwner} owner=${phase.owner} />
            <span style=${{ color: 'var(--color-ink-tertiary)' }}>·</span>
            <span class="wf-mono-sm">${phase.files} files</span>
            ${phase.started && html`
              <span style=${{ color: 'var(--color-ink-tertiary)' }}>·</span>
              <span>started ${phase.started}</span>
            `}
            ${phase.completed && html`
              <span style=${{ color: 'var(--color-ink-tertiary)' }}>·</span>
              <span>done ${phase.completed}</span>
            `}
          </div>
        </div>
        <div style=${{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          ${phase.review === 'PASS' && html`<${WFStatus} kind="pass">✓ pass</${WFStatus}>`}
          ${phase.review === 'PASS_WITH_DEBT' && html`<${WFStatus} kind="debt">⚠ debt</${WFStatus}>`}
          ${phase.review === 'FAIL' && html`<${WFStatus} kind="fail">✕ fail</${WFStatus}>`}
          ${isActive && !phase.review && html`<${WFStatus} kind="active">● active</${WFStatus}>`}
          ${isPending && html`<${WFStatus} kind="pending">○ pending</${WFStatus}>`}
          <span class="wf-mono-sm" style=${{ color: 'var(--color-ink-tertiary)' }}>${expanded ? '▾' : '▸'}</span>
        </div>
      </header>
      ${!narrow && html`
        <div style=${{ marginTop: 12, paddingLeft: 38 }}>
          <${WFGateStrip} gates=${phase.gates} large />
        </div>
      `}
      ${expanded && html`
        <div class="wf-phase-body">
          <div class="wf-section">
            <div class="wf-eyebrow" style=${{ marginBottom: 4 }}>Tasks (${phase.tasks.length})</div>
            ${phase.tasks.map((t, i) => html`
              <div key=${i} class=${'wf-task' + (t.done ? ' done' : '') + (t.active ? ' active' : '')}>
                <span class=${'wf-checkbox' + (t.done ? ' checked' : '') + (t.active ? ' active' : '')} aria-hidden="true" />
                <span>${t.label}</span>
                ${t.active && html`<span style=${{ marginLeft: 'auto', color: 'var(--color-primary-hover)', fontSize: 11 }}>active</span>`}
              </div>
            `)}
          </div>
          ${phase.fileList && phase.fileList.length > 0 && html`
            <div class="wf-section">
              <div class="wf-eyebrow" style=${{ marginBottom: 4 }}>Files modified (${phase.files})</div>
              ${phase.fileList.slice(0, 6).map((f, i) => html`
                <div key=${i} class="wf-file-row">
                  <span>${f.path}</span>
                  <span style=${{ marginLeft: 'auto' }} class="wf-diff-add">+${f.add}</span>
                  <span class="wf-diff-del">−${f.del}</span>
                </div>
              `)}
            </div>
          `}
          ${phase.review === 'FAIL' && phase.findings && html`
            <div class="wf-section">
              <div class="wf-eyebrow" style=${{ marginBottom: 6, color: 'var(--status-fail)' }}>
                Quality findings · ${phase.findings.filter(f => f.level === 'HIGH').length} HIGH, ${phase.findings.filter(f => f.level === 'MED').length} MED
              </div>
              <div style=${{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                ${phase.findings.map((f, i) => html`
                  <div key=${i} class="wf-finding">
                    <span class="wf-severity" data-level=${f.level}>${f.level}</span>
                    <div>
                      <div style=${{ color: 'var(--color-ink)', fontWeight: 500, marginBottom: 2 }}>${f.title}</div>
                      <div style=${{ color: 'var(--color-ink-subtle)', fontSize: 12 }}>${f.body}</div>
                    </div>
                  </div>
                `)}
              </div>
            </div>
          `}
        </div>
      `}
    </article>
  `;
}

// ── Sidebar (workspace filter rail) ──
export function WFWorkspaceSidebar({ projects, activeFilter, onFilterChange }) {
  const counts = {
    all: projects.length,
    live: projects.filter(p => p.live).length,
    handover: projects.filter(p => p.handoverActive).length,
    failed: projects.filter(p => p.lastReview === 'FAIL').length,
    idle: projects.filter(p => !p.activePlan).length,
  };
  return html`
    <aside class="wf-sidebar" aria-label="Filters">
      <div class="wf-side-section">
        <div class="wf-side-title">Status</div>
        <div class=${'wf-side-item' + (activeFilter === 'all' ? ' active' : '')} onClick=${() => onFilterChange('all')} style=${{ cursor: 'pointer' }}>
          <span>All projects</span><span class="wf-count">${counts.all}</span>
        </div>
        <div class=${'wf-side-item' + (activeFilter === 'live' ? ' active' : '')} onClick=${() => onFilterChange('live')} style=${{ cursor: 'pointer' }}>
          <span class="wf-dot live" /> <span>Live now</span><span class="wf-count">${counts.live}</span>
        </div>
        <div class=${'wf-side-item' + (activeFilter === 'handover' ? ' active' : '')} onClick=${() => onFilterChange('handover')} style=${{ cursor: 'pointer' }}>
          <span>Active handover</span><span class="wf-count">${counts.handover}</span>
        </div>
        <div class=${'wf-side-item' + (activeFilter === 'failed' ? ' active' : '')} onClick=${() => onFilterChange('failed')} style=${{ cursor: 'pointer' }}>
          <span>Last review failed</span><span class="wf-count">${counts.failed}</span>
        </div>
        <div class=${'wf-side-item' + (activeFilter === 'idle' ? ' active' : '')} onClick=${() => onFilterChange('idle')} style=${{ cursor: 'pointer' }}>
          <span>Idle</span><span class="wf-count">${counts.idle}</span>
        </div>
      </div>
      <div class="wf-side-section">
        <div class="wf-side-title">Owner</div>
        <div class=${'wf-side-item' + (activeFilter === 'owner-claude' ? ' active' : '')} onClick=${() => onFilterChange('owner-claude')} style=${{ cursor: 'pointer' }}>
          <${WFOwnerDot} owner="claude" /><span>claude</span>
          <span class="wf-count">${projects.filter(p => p.owner === 'claude').length}</span>
        </div>
        <div class=${'wf-side-item' + (activeFilter === 'owner-codex' ? ' active' : '')} onClick=${() => onFilterChange('owner-codex')} style=${{ cursor: 'pointer' }}>
          <${WFOwnerDot} owner="codex" /><span>codex</span>
          <span class="wf-count">${projects.filter(p => p.owner === 'codex').length}</span>
        </div>
        <div class=${'wf-side-item' + (activeFilter === 'owner-gemini' ? ' active' : '')} onClick=${() => onFilterChange('owner-gemini')} style=${{ cursor: 'pointer' }}>
          <${WFOwnerDot} owner="gemini" /><span>gemini</span>
          <span class="wf-count">${projects.filter(p => p.owner === 'gemini').length}</span>
        </div>
      </div>
      <div class="wf-side-section">
        <div class="wf-side-title">Recent activity</div>
        <div class=${'wf-side-item' + (activeFilter === 'activity-hour' ? ' active' : '')} onClick=${() => onFilterChange('activity-hour')} style=${{ cursor: 'pointer' }}>
          <span>Last hour</span>
          <span class="wf-count">${projects.filter(p => p.lastActivity && p.lastActivity.includes('m ago')).length}</span>
        </div>
        <div class=${'wf-side-item' + (activeFilter === 'activity-day' ? ' active' : '')} onClick=${() => onFilterChange('activity-day')} style=${{ cursor: 'pointer' }}>
          <span>Last day</span>
          <span class="wf-count">${projects.filter(p => p.lastActivity && (p.lastActivity.includes('h ago') || p.lastActivity.includes('m ago'))).length}</span>
        </div>
      </div>
    </aside>
  `;
}

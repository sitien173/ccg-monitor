import { html } from 'https://esm.sh/htm/preact/standalone';
import { WFTopbar, WFProjectCard, WFWorkspaceSidebar } from '../primitives.js';

export function WFWorkspaceGrid({ projects, machine, activeSessions, activeFilter, onFilterChange, onClickResume, onSearchClick, onThemeToggle }) {
  // Apply filtering based on activeFilter
  let filtered = projects;
  if (activeFilter === 'live') {
    filtered = projects.filter(p => p.live);
  } else if (activeFilter === 'handover') {
    filtered = projects.filter(p => p.handoverActive);
  } else if (activeFilter === 'failed') {
    filtered = projects.filter(p => p.lastReview === 'FAIL');
  } else if (activeFilter === 'idle') {
    filtered = projects.filter(p => !p.activePlan);
  } else if (activeFilter === 'owner-claude') {
    filtered = projects.filter(p => p.owner === 'claude');
  } else if (activeFilter === 'owner-codex') {
    filtered = projects.filter(p => p.owner === 'codex');
  } else if (activeFilter === 'owner-gemini') {
    filtered = projects.filter(p => p.owner === 'gemini');
  } else if (activeFilter === 'activity-hour') {
    filtered = projects.filter(p => p.lastActivity && p.lastActivity.includes('m ago'));
  } else if (activeFilter === 'activity-day') {
    filtered = projects.filter(p => p.lastActivity && (p.lastActivity.includes('h ago') || p.lastActivity.includes('m ago')));
  }

  return html`
    <div class="wf-screen">
      <${WFTopbar} machine=${machine} sessions=${activeSessions} route="workspace" onSearchClick=${onSearchClick} onThemeToggle=${onThemeToggle} />
      <div class="wf-body">
        <${WFWorkspaceSidebar} projects=${projects} activeFilter=${activeFilter} onFilterChange=${onFilterChange} />
        <main class="wf-main" id="main-content">
          <div style=${{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
            <h1 class="wf-h1" style=${{ margin: 0 }}>All projects <span style=${{ color: 'var(--color-ink-tertiary)', fontWeight: 400, fontSize: 14, marginLeft: 8 }}>${filtered.length}</span></h1>
            <div style=${{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span class=${'wf-chip' + (activeFilter === 'all' ? ' active' : '')} onClick=${() => onFilterChange('all')} style=${{ cursor: 'pointer' }}>all</span>
              <span class=${'wf-chip' + (activeFilter === 'handover' ? ' active' : '')} onClick=${() => onFilterChange('handover')} style=${{ cursor: 'pointer' }}>active handover <span class="wf-count">${projects.filter(p => p.handoverActive).length}</span></span>
              <span class=${'wf-chip' + (activeFilter === 'idle' ? ' active' : '')} onClick=${() => onFilterChange('idle')} style=${{ cursor: 'pointer' }}>idle <span class="wf-count">${projects.filter(p => !p.activePlan).length}</span></span>
              <span class="wf-kbd">sort: recent</span>
            </div>
          </div>
          ${filtered.length === 0 ? html`
            <div style=${{ padding: '40px 0', textAlign: 'center', color: 'var(--color-ink-tertiary)' }}>
              No projects match the selected filter.
            </div>
          ` : html`
            <div style=${{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              ${filtered.map((p) => html`<${WFProjectCard} key=${p.project_id || p.id} p=${p} onClickResume=${onClickResume} />`)}
            </div>
          `}
        </main>
      </div>
    </div>
  `;
}

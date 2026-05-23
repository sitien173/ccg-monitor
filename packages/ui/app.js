import { html, render, useState, useEffect } from 'https://esm.sh/htm/preact/standalone';
import { useHashRoute, parseRoute } from './router.js';

function App() {
  const currentHash = useHashRoute();
  const route = parseRoute(currentHash);

  return html`
    <div class="wf-root">
      <div class="wf-screen">
        <header class="wf-topbar">
          <div class="wf-logo">
            <span class="wf-logo-mark" aria-hidden="true"></span>
            <span>ccg-monitor</span>
          </div>
          <nav>
            <a href="#/" class="wf-tab ${route.name === 'workspace' ? 'active' : ''}">Workspace</a>
            <a href="#/activity" class="wf-tab ${route.name === 'activity' ? 'active' : ''}">Activity</a>
          </nav>
        </header>
        <main class="wf-main" id="main-content">
          ${route.name === 'workspace' && html`
            <div>
              <h1 class="wf-h1">Workspace View</h1>
              <p>Welcome to ccg-monitor dashboard shell.</p>
            </div>
          `}
          ${route.name === 'plan' && html`
            <div>
              <h1 class="wf-h1">Plan Detail View</h1>
              <p>Project: ${route.params.projectId}</p>
              <p>Plan Slug: ${route.params.slug}</p>
            </div>
          `}
          ${route.name === 'activity' && html`
            <div>
              <h1 class="wf-h1">Live Activity View</h1>
              <p>Live event streaming and logs.</p>
            </div>
          `}
        </main>
      </div>
    </div>
  `;
}

render(html`<${App} />`, document.getElementById('root'));

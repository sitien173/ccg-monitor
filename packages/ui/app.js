import { html, render, useState, useEffect, useCallback } from 'https://esm.sh/htm/preact/standalone';
import { useHashRoute, parseRoute, navigate } from './router.js';
import { getProjects, getPlan, getEvents } from './api.js';
import { subscribeToEvents } from './sse.js';
import { registerKeyListeners } from './keys.js';
import { loadSettings, saveSettings, applySettingsToDom, WFSettingsDrawer } from './settings.js';
import { WFWorkspaceGrid } from './views/workspace.js';
import { WFPlanDetail } from './views/plan.js';
import { WFActivitySplit } from './views/activity.js';
import { WFStateEmpty } from './states/empty.js';
import { WFStateShortcuts } from './states/shortcuts.js';

function App() {
  const currentHash = useHashRoute();
  const route = parseRoute(currentHash);

  // Core data states
  const [projects, setProjects] = useState([]);
  const [activePlanData, setActivePlanData] = useState(null);
  const [events, setEvents] = useState([]);
  const [machine, setMachine] = useState('127.0.0.1');
  const [activeSessions, setActiveSessions] = useState(0);

  // UI state
  const [activeFilter, setActiveFilter] = useState('all');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [settings, setSettings] = useState(loadSettings());

  // Load and apply settings on mount and change
  useEffect(() => {
    applySettingsToDom(settings);
  }, [settings]);

  const handleChangeSetting = (key, value) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    saveSettings(updated);
  };

  // Initial load
  const reloadData = useCallback(async () => {
    try {
      const projs = await getProjects();
      setProjects(projs);

      if (projs.length > 0) {
        setMachine(window.location.hostname || 'pluto.local');
        setActiveSessions(projs.filter(p => p.status === 'ACTIVE').length);
      }

      // Load initial events
      const historicalEvents = await getEvents();
      setEvents(historicalEvents);
    } catch (err) {
      console.warn('[ccgmon/app] failed to reload projects/events data:', err);
    }
  }, []);

  useEffect(() => {
    reloadData();
  }, [reloadData]);

  // Load active plan detail if route matches plan detail
  useEffect(() => {
    if (route.name === 'plan') {
      getPlan(route.params.projectId, route.params.slug)
        .then(data => {
          setActivePlanData(data);
        })
        .catch(err => {
          console.error('[ccgmon/app] failed to load plan:', err);
        });
    } else {
      setActivePlanData(null);
    }
  }, [route.name, route.params.projectId, route.params.slug]);

  // SSE subscription
  useEffect(() => {
    const sub = subscribeToEvents((event) => {
      // Prepend event, limiting storage size to last 100 events
      setEvents(prev => [event, ...prev.slice(0, 99)]);
      
      // Reload projects list to catch status updates
      reloadData();
      
      // If viewing active plan detail, reload plan detail data
      if (route.name === 'plan' && event.project_id === route.params.projectId && event.plan_slug === route.params.slug) {
        getPlan(route.params.projectId, route.params.slug)
          .then(data => setActivePlanData(data))
          .catch(err => console.error('[ccgmon/app] failed to update plan details from SSE event:', err));
      }
    });

    return () => sub.close();
  }, [route.name, route.params.projectId, route.params.slug, reloadData]);

  // Keyboard shortcut actions
  useEffect(() => {
    const cleanupKeys = registerKeyListeners({
      onNavigateWorkspace: () => navigate('/'),
      onNavigateActivity: () => navigate('/activity'),
      onFocusSearch: () => {
        setIsShortcutsOpen(true);
      },
      onToggleShortcuts: () => setIsShortcutsOpen(prev => !prev),
      onNavigateItem: (dir) => {
        console.log('[ccgmon/app] navigate item:', dir);
      },
      onCopyResume: () => {
        const resumeBtn = document.querySelector('.wf-btn.resume');
        if (resumeBtn) {
          resumeBtn.click();
        }
      }
    });

    return () => cleanupKeys();
  }, []);

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
  };

  const renderOverlays = () => {
    return html`
      ${isSettingsOpen && html`
        <${WFSettingsDrawer} 
          settings=${settings} 
          onChangeSetting=${handleChangeSetting} 
          onClose=${() => setIsSettingsOpen(false)} 
        />
      `}
      ${isShortcutsOpen && html`
        <${WFStateShortcuts} 
          onClose=${() => setIsShortcutsOpen(false)} 
        />
      `}
    `;
  };

  // If projects is empty, show nice scanning state
  if (projects.length === 0) {
    return html`
      <div class="wf-root">
        <${WFStateEmpty} machine=${machine} />
        ${renderOverlays()}
      </div>
    `;
  }

  return html`
    <div class="wf-root">
      ${route.name === 'workspace' && html`
        <${WFWorkspaceGrid} 
          projects=${projects} 
          machine=${machine} 
          activeSessions=${activeSessions} 
          activeFilter=${activeFilter} 
          onFilterChange=${handleFilterChange} 
          onClickResume=${(name, slug) => {
            const cmd = `ccgmon resume ${name} ${slug}`;
            navigator.clipboard.writeText(cmd)
              .then(() => {
                alert('Copied to clipboard: ' + cmd);
              })
              .catch(() => {});
          }} 
          onSearchClick=${() => setIsShortcutsOpen(true)} 
          onThemeToggle=${() => setIsSettingsOpen(true)} 
        />
      `}
      ${route.name === 'plan' && activePlanData && html`
        <${WFPlanDetail} 
          planData=${activePlanData} 
          machine=${machine} 
          activeSessions=${activeSessions} 
          recentEvents=${events.filter(e => e.project_id === route.params.projectId)} 
          onSearchClick=${() => setIsShortcutsOpen(true)} 
          onThemeToggle=${() => setIsSettingsOpen(true)} 
        />
      `}
      ${route.name === 'activity' && html`
        <${WFActivitySplit} 
          events=${events} 
          machine=${machine} 
          activeSessions=${activeSessions} 
          onSearchClick=${() => setIsShortcutsOpen(true)} 
          onThemeToggle=${() => setIsSettingsOpen(true)} 
        />
      `}
      ${renderOverlays()}
    </div>
  `;
}

render(html`<${App} />`, document.getElementById('root'));

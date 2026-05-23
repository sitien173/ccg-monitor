import { html } from 'https://esm.sh/htm/preact/standalone';

// Check if prefers-reduced-motion is active
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const DEFAULT_SETTINGS = {
  theme: 'dark', // 'dark' or 'light'
  density: 'comfortable', // 'comfortable' or 'compact'
  reduceColor: false,
  reduceMotion: prefersReducedMotion,
};

export function loadSettings() {
  try {
    const saved = localStorage.getItem('ccgmon-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error('[ccgmon/settings] failed to load settings:', e);
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings) {
  try {
    localStorage.setItem('ccgmon-settings', JSON.stringify(settings));
  } catch (e) {
    console.error('[ccgmon/settings] failed to save settings:', e);
  }
}

export function applySettingsToDom(settings) {
  const root = document.documentElement;

  // Sync class 'wf-root' on document element first to verify root matches styles
  root.classList.add('wf-root');

  // 1. Theme class
  if (settings.theme === 'light') {
    root.classList.add('wf-light');
  } else {
    root.classList.remove('wf-light');
  }

  // 2. Density class
  if (settings.density === 'compact') {
    root.classList.add('wf-compact');
  } else {
    root.classList.remove('wf-compact');
  }

  // 3. Reduce color class
  if (settings.reduceColor) {
    root.classList.add('wf-reduce-color');
  } else {
    root.classList.remove('wf-reduce-color');
  }

  // 4. Reduce motion class
  if (settings.reduceMotion) {
    root.classList.add('wf-reduce-motion');
  } else {
    root.classList.remove('wf-reduce-motion');
  }
}

export function WFSettingsDrawer({ settings, onChangeSetting, onClose }) {
  return html`
    <div class="wf-overlay-bg" onClick=${onClose}>
      <div class="wf-overlay" role="dialog" aria-label="Settings panel" onClick=${(e) => e.stopPropagation()} style=${{ width: '320px', position: 'fixed', right: '20px', bottom: '20px', margin: 0 }}>
        <div style=${{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 class="wf-h2" style=${{ margin: 0 }}>Settings</h2>
          <button class="wf-btn" onClick=${onClose} style=${{ border: 0, background: 'transparent', cursor: 'pointer', padding: 0 }}>✕</button>
        </div>

        <div style=${{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <!-- Theme Setting -->
          <div>
            <div class="wf-eyebrow" style=${{ marginBottom: 6 }}>Theme</div>
            <div style=${{ display: 'flex', gap: 8 }}>
              <button 
                class=${'wf-btn' + (settings.theme === 'dark' ? ' active' : '')} 
                onClick=${() => onChangeSetting('theme', 'dark')}
                style=${{ flex: 1, justifyContent: 'center' }}
              >
                Dark
              </button>
              <button 
                class=${'wf-btn' + (settings.theme === 'light' ? ' active' : '')} 
                onClick=${() => onChangeSetting('theme', 'light')}
                style=${{ flex: 1, justifyContent: 'center' }}
              >
                Light
              </button>
            </div>
          </div>

          <!-- Density Setting -->
          <div>
            <div class="wf-eyebrow" style=${{ marginBottom: 6 }}>Density</div>
            <div style=${{ display: 'flex', gap: 8 }}>
              <button 
                class=${'wf-btn' + (settings.density === 'comfortable' ? ' active' : '')} 
                onClick=${() => onChangeSetting('density', 'comfortable')}
                style=${{ flex: 1, justifyContent: 'center' }}
              >
                Comfortable
              </button>
              <button 
                class=${'wf-btn' + (settings.density === 'compact' ? ' active' : '')} 
                onClick=${() => onChangeSetting('density', 'compact')}
                style=${{ flex: 1, justifyContent: 'center' }}
              >
                Compact
              </button>
            </div>
          </div>

          <div class="wf-divider" style=${{ margin: '8px 0' }} />

          <!-- Accessibility / Reduce Color -->
          <div style=${{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style=${{ fontSize: 13, fontWeight: 500, color: 'var(--color-ink)' }}>Reduce color</div>
              <div style=${{ fontSize: 11, color: 'var(--color-ink-subtle)' }}>Removes rich gate hues</div>
            </div>
            <input 
              type="checkbox" 
              checked=${settings.reduceColor} 
              onChange=${(e) => onChangeSetting('reduceColor', e.target.checked)} 
              style=${{ width: 16, height: 16, cursor: 'pointer' }}
            />
          </div>

          <!-- Accessibility / Reduce Motion -->
          <div style=${{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style=${{ fontSize: 13, fontWeight: 500, color: 'var(--color-ink)' }}>Reduce motion</div>
              <div style=${{ fontSize: 11, color: 'var(--color-ink-subtle)' }}>Disables pulse & slide animations</div>
            </div>
            <input 
              type="checkbox" 
              checked=${settings.reduceMotion} 
              onChange=${(e) => onChangeSetting('reduceMotion', e.target.checked)} 
              style=${{ width: 16, height: 16, cursor: 'pointer' }}
            />
          </div>
        </div>
      </div>
    </div>
  `;
}

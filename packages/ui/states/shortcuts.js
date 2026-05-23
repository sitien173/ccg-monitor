import { html } from 'https://esm.sh/htm/preact/standalone';

export function WFStateShortcuts({ onClose }) {
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

  return html`
    <div class="wf-overlay-bg" onClick=${onClose}>
      <div class="wf-overlay" role="dialog" aria-label="Keyboard shortcuts" onClick=${(e) => e.stopPropagation()}>
        <div style=${{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 class="wf-h2" style=${{ margin: 0, fontSize: 14 }}>Keyboard shortcuts</h2>
          <div style=${{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span class="wf-mono-sm" style=${{ color: 'var(--color-ink-tertiary)' }}>press</span>
            <span class="wf-kbd">esc</span>
          </div>
        </div>
        ${groups.map((g) => html`
          <div key=${g.title} style=${{ marginBottom: 14 }}>
            <div class="wf-eyebrow" style=${{ marginBottom: 4 }}>${g.title}</div>
            ${g.items.map(([label, keys], i) => html`
              <div key=${i} class="wf-shortcut">
                <span style=${{ color: 'var(--color-ink-muted)' }}>${label}</span>
                <span class="wf-shortcut-keys">
                  ${keys.map((k, j) => html`<span key=${j} class="wf-kbd">${k}</span>`)}
                </span>
              </div>
            `)}
          </div>
        `)}
        <div style=${{ paddingTop: 8, borderTop: '1px solid var(--color-hairline)', fontSize: 11.5, color: 'var(--color-ink-tertiary)' }}>
          All shortcuts are remappable. <span style=${{ color: 'var(--color-primary-hover)' }}>edit bindings →</span>
        </div>
      </div>
    </div>
  `;
}

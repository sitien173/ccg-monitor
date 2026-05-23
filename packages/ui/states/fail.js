import { html } from 'https://esm.sh/htm/preact/standalone';

export function WFStateFailSideRail({ phase, onClickResume }) {
  const highCount = phase.findings ? phase.findings.filter(f => f.level === 'HIGH').length : 0;
  const medCount = phase.findings ? phase.findings.filter(f => f.level === 'MED').length : 0;

  return html`
    <aside aria-label="Review findings">
      <div style=${{
        border: '1px solid color-mix(in oklch, var(--status-fail) 50%, var(--color-hairline))',
        background: 'color-mix(in oklch, var(--color-canvas) 88%, var(--status-fail) 12%)',
        borderRadius: 8,
        padding: '14px 16px',
        marginBottom: 16,
      }}>
        <div class="wf-eyebrow" style=${{ color: 'var(--status-fail)', marginBottom: 8 }}>Review failed · phase ${phase.id}</div>
        <div style=${{ fontSize: 13, color: 'var(--color-ink)', marginBottom: 6 }}>${highCount} HIGH · ${medCount} MED finding${highCount + medCount > 1 ? 's' : ''}</div>
        <div style=${{ fontSize: 12, color: 'var(--color-ink-subtle)', lineHeight: 1.55 }}>
          Plan is BLOCKED until findings are addressed. Resume Handover pre-loads the failed phase context for the next session.
        </div>
        <button class="wf-btn resume" style=${{ marginTop: 12, width: '100%', justifyContent: 'center' }} onClick=${onClickResume}>
          Resume Handover ⌘R
        </button>
      </div>
      <div class="wf-eyebrow" style=${{ marginBottom: 6 }}>review summary</div>
      <pre style=${{
        background: 'var(--color-surface-1)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 6,
        padding: '10px 12px',
        fontSize: 11,
        lineHeight: 1.6,
        color: 'var(--color-ink-muted)',
        fontFamily: 'var(--font-mono)',
        margin: 0,
        whiteSpace: 'pre-wrap',
      }}>${`outcome: FAIL
findings: ${highCount + medCount}
  - HIGH × ${highCount}
  - MED  × ${medCount}
debt_carryover: 0
next: address findings,
      re-run review gate`}</pre>
    </aside>
  `;
}

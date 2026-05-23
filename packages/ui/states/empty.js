import { html } from 'https://esm.sh/htm/preact/standalone';
import { WFTopbar } from '../primitives.js';

export function WFStateEmpty({ machine }) {
  return html`
    <div class="wf-screen">
      <${WFTopbar} machine=${machine} sessions=${0} route="workspace" />
      <main class="wf-main" style=${{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style=${{ maxWidth: 420, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style=${{
            width: 72, height: 72,
            borderRadius: 12,
            border: '1px dashed var(--color-hairline-strong)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-ink-tertiary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 22,
            lineHeight: '70px'
          }}>·</div>
          <h1 class="wf-h1" style=${{ margin: 0, fontSize: 20 }}>No active plans</h1>
          <p style=${{ margin: 0, fontSize: 13.5, color: 'var(--color-ink-subtle)', lineHeight: 1.55 }}>
            ccg-monitor watches <span class="wf-mono-sm" style=${{ color: 'var(--color-ink)' }}>docs/plans/</span> in every project on this machine.
            Start a plan in Claude Code with <span class="wf-mono-sm" style=${{ color: 'var(--color-ink)' }}>/ccg plan</span>, or drop a
            <span class="wf-mono-sm" style=${{ color: 'var(--color-ink)' }}> .handover.md</span> in an existing repo.
          </p>
          <div style=${{ display: 'flex', gap: 8, marginTop: 4 }}>
            <span class="wf-chip">docs · /ccg plan</span>
            <span class="wf-chip">docs · handover format</span>
          </div>
          <div style=${{ marginTop: 16, padding: '10px 12px', border: '1px solid var(--color-hairline)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-ink-tertiary)' }}>
            watching: F:/projects · ~/code · C:/Users/ngosi/.mcp-servers · scanning 47 repos
          </div>
        </div>
      </main>
    </div>
  `;
}

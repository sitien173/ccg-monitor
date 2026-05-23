/* global React, ReactDOM, DesignCanvas, DCSection, DCArtboard,
          TweaksPanel, TweakSection, TweakToggle, TweakRadio, TweakSelect, useTweaks,
          WF_DATA,
          WFWorkspaceGrid, WFWorkspaceGrouped, WFWorkspaceList,
          WFPlanAnchor, WFPlanKanban, WFPlanOutline, WFPlanTimeline,
          WFActivityStream, WFActivitySplit,
          WFStateEmpty, WFStateFail, WFStateShortcuts, WFStateNarrow, WFStateLight */

// Defaults the host can edit through Tweaks. Tweak names match the panel labels.
const WF_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "density": "comfortable",
  "reduceColor": false,
  "reduceMotion": false,
  "expandAllPhases": false,
  "mockState": "active"
}/*EDITMODE-END*/;

// Build a derived data slice based on the mockState tweak.
function deriveData(state) {
  const base = window.WF_DATA;
  if (state === 'idle') {
    // No live sessions, all projects idle
    return {
      ...base,
      activeSessions: 0,
      projects: base.projects.map((p) => ({ ...p, live: false, handoverActive: false })),
    };
  }
  if (state === 'heavy') {
    // Three live sessions, doubled sparkline
    return {
      ...base,
      activeSessions: 4,
      sparkline: base.sparkline.map((v) => v * 2),
      projects: base.projects.map((p, i) => ({ ...p, live: i < 3 || p.live })),
    };
  }
  if (state === 'fail') {
    // Mark project 1 as failed
    return {
      ...base,
      projects: base.projects.map((p) => p.id === 'p1' ?
        { ...p, lastReview: 'FAIL', live: false, handoverActive: true } : p),
    };
  }
  if (state === 'blocked') {
    return {
      ...base,
      projects: base.projects.map((p) => p.id === 'p1' ?
        { ...p, gate: 'review', live: false, handoverActive: true } : p),
    };
  }
  return base;
}

function App() {
  const [t, setT] = useTweaks(WF_TWEAK_DEFAULTS);
  const setTweak = (k, v) => setT({ [k]: v });

  const data = React.useMemo(() => deriveData(t.mockState), [t.mockState]);

  // The root class drives density, reduce-color, reduce-motion, theme.
  const rootClass =
    'wf-root' +
    (t.theme === 'light' ? ' wf-light' : '') +
    (t.density === 'compact' ? ' wf-compact' : '') +
    (t.reduceColor ? ' wf-reduce-color' : '') +
    (t.reduceMotion ? ' wf-reduce-motion' : '');

  // Wrap every artboard's content in the wf-root scope.
  const Frame = ({ children, light = false }) => (
    <div className={rootClass + (light ? ' wf-light' : '')} style={{ height: '100%' }}>
      {children}
    </div>
  );

  return (
    <>
      <DesignCanvas>
        {/* ── Row 1 · Workspace overview ── */}
        <DCSection id="workspace" title="1 · Workspace overview"
          subtitle="Sidebar filters · 6 mocked projects · `Resume` glows when a handover is ACTIVE">
          <DCArtboard id="w1-grid" label="W1 · Grid (anchor)"
            width={1280} height={820} style={{ background: 'var(--color-canvas)' }}>
            <Frame><WFWorkspaceGrid data={data} /></Frame>
          </DCArtboard>
          <DCArtboard id="w2-grouped" label="W2 · Grouped by status"
            width={1280} height={820} style={{ background: 'var(--color-canvas)' }}>
            <Frame><WFWorkspaceGrouped data={data} /></Frame>
          </DCArtboard>
          <DCArtboard id="w3-list" label="W3 · Dense table"
            width={1280} height={820} style={{ background: 'var(--color-canvas)' }}>
            <Frame><WFWorkspaceList data={data} /></Frame>
          </DCArtboard>
        </DCSection>

        {/* ── Row 2 · Plan detail (most options) ── */}
        <DCSection id="plan" title="2 · Plan detail"
          subtitle="Anchor matches the ASCII brief. Alternates restructure the rail, gate strip, and phase tree orientation.">
          <DCArtboard id="p1-anchor" label="P1 · Anchor — vertical tree + right rail"
            width={1440} height={1100} style={{ background: 'var(--color-canvas)' }}>
            <Frame>
              <WFPlanAnchor data={data}
                expandedPhases={t.expandAllPhases ? data.planDetail.phases.map(p => p.id) : [2]}
                showAllExpanded={t.expandAllPhases} />
            </Frame>
          </DCArtboard>
          <DCArtboard id="p2-kanban" label="P2 · Horizontal columns + bottom rail"
            width={1440} height={1000} style={{ background: 'var(--color-canvas)' }}>
            <Frame><WFPlanKanban data={data} /></Frame>
          </DCArtboard>
          <DCArtboard id="p3-outline" label="P3 · Sticky outline + focused phase"
            width={1440} height={980} style={{ background: 'var(--color-canvas)' }}>
            <Frame><WFPlanOutline data={data} /></Frame>
          </DCArtboard>
          <DCArtboard id="p4-timeline" label="P4 · Horizontal timeline + accordion"
            width={1440} height={1100} style={{ background: 'var(--color-canvas)' }}>
            <Frame><WFPlanTimeline data={data} /></Frame>
          </DCArtboard>
        </DCSection>

        {/* ── Row 3 · Live activity ── */}
        <DCSection id="activity" title="3 · Live activity"
          subtitle="SSE event stream · filter chips + sparkline header · row click → JSON drawer.">
          <DCArtboard id="a1-stream" label="A1 · Stream — sparkline header + filter chips"
            width={1280} height={820} style={{ background: 'var(--color-canvas)' }}>
            <Frame><WFActivityStream data={data} /></Frame>
          </DCArtboard>
          <DCArtboard id="a2-split" label="A2 · Log + JSON drawer"
            width={1280} height={820} style={{ background: 'var(--color-canvas)' }}>
            <Frame><WFActivitySplit data={data} /></Frame>
          </DCArtboard>
        </DCSection>

        {/* ── Row 4 · States ── */}
        <DCSection id="states" title="4 · States & edge cases"
          subtitle="Empty workspace · FAIL with findings · keyboard help · narrow reflow · light-theme proof.">
          <DCArtboard id="s1-empty" label="S1 · Empty workspace"
            width={1100} height={720} style={{ background: 'var(--color-canvas)' }}>
            <Frame><WFStateEmpty data={data} /></Frame>
          </DCArtboard>
          <DCArtboard id="s2-fail" label="S2 · FAIL · findings expanded"
            width={1280} height={920} style={{ background: 'var(--color-canvas)' }}>
            <Frame><WFStateFail data={data} /></Frame>
          </DCArtboard>
          <DCArtboard id="s3-shortcuts" label="S3 · Shortcut overlay (?)"
            width={1100} height={760} style={{ background: 'var(--color-canvas)' }}>
            <Frame><WFStateShortcuts data={data} /></Frame>
          </DCArtboard>
          <DCArtboard id="s4-narrow" label="S4 · Narrow reflow · 360w"
            width={380} height={760} style={{ background: 'var(--color-canvas)' }}>
            <Frame><WFStateNarrow data={data} /></Frame>
          </DCArtboard>
          <DCArtboard id="s5-light" label="S5 · Light theme proof"
            width={1100} height={680} style={{ background: '#ffffff' }}>
            <WFStateLight data={data} />
          </DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Display">
          <TweakRadio label="Theme"
            value={t.theme}
            options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]}
            onChange={(v) => setTweak('theme', v)} />
          <TweakRadio label="Density"
            value={t.density}
            options={[{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }]}
            onChange={(v) => setTweak('density', v)} />
        </TweakSection>
        <TweakSection label="Accessibility">
          <TweakToggle label="Reduce color"
            value={t.reduceColor}
            onChange={(v) => setTweak('reduceColor', v)} />
          <TweakToggle label="Reduce motion"
            value={t.reduceMotion}
            onChange={(v) => setTweak('reduceMotion', v)} />
        </TweakSection>
        <TweakSection label="Content">
          <TweakToggle label="Expand all phase cards"
            value={t.expandAllPhases}
            onChange={(v) => setTweak('expandAllPhases', v)} />
          <TweakSelect label="Mock data state"
            value={t.mockState}
            options={[
              { value: 'active',  label: 'Active (default)' },
              { value: 'idle',    label: 'Idle — no live sessions' },
              { value: 'heavy',   label: 'Heavy traffic' },
              { value: 'fail',    label: 'Recent FAIL' },
              { value: 'blocked', label: 'Blocked plan' },
            ]}
            onChange={(v) => setTweak('mockState', v)} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

import { useEffect } from 'preact/hooks';
import { app } from '../../../app-context.js';
import { dom, graphState, saveViewState, viewState } from '../../../core/state.ts';
import { Island } from '../Island.tsx';
import { useUiTick } from '../store.ts';

function onMode(v: string) {
  graphState.mode = v;
  viewState.graphMode = v;
  saveViewState();
  app.GraphController.draw();
}

function onStat(v: string) {
  if (graphState.activeStats.includes(v)) {
    graphState.activeStats = graphState.activeStats.filter((s: string) => s !== v);
  } else {
    graphState.activeStats.push(v);
  }
  viewState.graphStats = graphState.activeStats;
  saveViewState();
  app.GraphController.draw();
}

export function GraphHud() {
  useUiTick();
  const mode = graphState.mode;
  const stats: string[] = graphState.activeStats || [];
  return (
    <div class="g-hud">
      <div class="g-toggles">
        <div class={'g-pill' + (mode === 'values' ? ' active' : '')} data-type="mode" data-val="values" onClick={e => { e.stopPropagation(); onMode('values'); }}>Gains</div>
        <div class={'g-pill' + (mode === 'rates' ? ' active' : '')} data-type="mode" data-val="rates" onClick={e => { e.stopPropagation(); onMode('rates'); }}>Rates</div>
      </div>
      <div class="g-toggles">
        <div class={'g-pill p-str' + (stats.includes('str') ? ' active' : '')} data-type="stat" data-val="str" onClick={e => { e.stopPropagation(); onStat('str'); }}>STR</div>
        <div class={'g-pill p-def' + (stats.includes('def') ? ' active' : '')} data-type="stat" data-val="def" onClick={e => { e.stopPropagation(); onStat('def'); }}>DEF</div>
        <div class={'g-pill p-spd' + (stats.includes('spd') ? ' active' : '')} data-type="stat" data-val="spd" onClick={e => { e.stopPropagation(); onStat('spd'); }}>SPD</div>
        <div class={'g-pill p-dex' + (stats.includes('dex') ? ' active' : '')} data-type="stat" data-val="dex" onClick={e => { e.stopPropagation(); onStat('dex'); }}>DEX</div>
        <div class={'g-pill p-tot' + (stats.includes('total') ? ' active' : '')} data-type="stat" data-val="total" onClick={e => { e.stopPropagation(); onStat('total'); }}>TOT</div>
      </div>
    </div>
  );
}

export function GraphView() {
  useUiTick();
  useEffect(() => {
    dom.graphContainer = document.getElementById('bbgl-graph-container');
    if (app.GraphController && typeof app.GraphController.setupControls === 'function') {
      app.GraphController.setupControls();
    }
  }, []);
  useEffect(() => {
    dom.graphContainer = document.getElementById('bbgl-graph-container');
    dom.graphSvg = document.getElementById('bbgl-graph-svg');
    if (viewState.subView === 'graph' && app.GraphController) {
      app.GraphController.draw();
    }
  });
  return (
    <div id="bbgl-graph-container">
      <GraphHud />
      <Island><svg id="bbgl-graph-svg" /></Island>
    </div>
  );
}

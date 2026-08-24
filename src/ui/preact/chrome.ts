import { app } from '../../app-context.js';
import { KEYS } from '../../core/constants.ts';
import { ICONS } from '../icons.ts';
import {
  calendarState,
  dom,
  runtime,
  saveConfig,
  saveViewState,
  setHistoryCache,
  userConfig,
  viewState
} from '../../core/state.ts';
import { Formatter } from '../../domain/time.ts';

export function onHeaderClick(e: Event): void {
  const t = e.target as Element | null;
  if (!t) return;
  if (t.closest('.bbgl-custom-icon') || t.closest('#bbgl-demo-exit-btn') || t.closest('#bbgl-pop-btn') || t.closest('#bbgl-demo-exit')) return;
  app.closePanel();
}

export function onPopoutClick(e: Event): void {
  e.stopPropagation();
  if (!dom.panel || dom.panel.classList.contains('bbgl-mode-page')) return;
  const p = dom.panel;
  const animate = userConfig.animations && !p.classList.contains('bbgl-no-animations');
  if (animate) app.markPanelResizing(p);
  viewState.expanded = !viewState.expanded;
  if (viewState.expanded) {
    p.classList.add('bbgl-expanded');
    p.classList.remove('bbgl-compact');
  } else {
    p.classList.remove('bbgl-expanded');
    p.classList.add('bbgl-compact');
  }
  saveViewState();
  app.handleLayout();
  app.renderPanelContent();
  if (dom.topPanel && dom.topPanel.classList.contains('viewing-graph')) {
    app.GraphController.draw();
    setTimeout(app.GraphController.draw, 320);
  }
  if (dom.topPanel && dom.topPanel.classList.contains('viewing-achievements')) {
    setTimeout(app.resizeAchLockedPage, 320);
  }
}

export function onCopySession(e: Event): void {
  e.stopPropagation();
  const cs = runtime.currentStats as { sl: unknown; s: Record<string, unknown> } | null;
  if (!cs) return;
  const { sl, s } = cs;
  const txt = app.buildSessionText(sl, s, ['str', 'def', 'spd', 'dex']);
  const cpb = (dom.panel?.querySelector('#bbgl-copy-btn') as HTMLElement | null) || dom.copyBtn;
  navigator.clipboard.writeText(txt).then(() => {
    const cols = dom.ledgerView ? Array.from(dom.ledgerView.querySelectorAll('.stat-column')) : [];
    if (cols.length) app.flashCopied(cols);
    if (!cpb) return;
    const oH = cpb.innerHTML, oC = cpb.style.color;
    cpb.innerHTML = ICONS.CHECK;
    cpb.style.color = '#69f0ae';
    cpb.style.opacity = '1';
    setTimeout(() => {
      cpb.innerHTML = oH;
      cpb.style.color = oC;
      cpb.style.opacity = '';
    }, 1000);
  });
}

export function onDemoExit(e: Event): void {
  e.stopPropagation();
  localStorage.removeItem(KEYS.DEMO);
  runtime.demoMode = false;
  runtime.demoHistory = null;
  runtime.stickerData = [];
  setHistoryCache(null);
  app.DataController.invalidate();
  app.DBManager.loadHistory().then((loaded: unknown) => {
    app.DataController.hydrate(loaded);
    if (userConfig.apiKey) app.startBackgroundSync();
  }).catch(() => {
    if (userConfig.apiKey) app.startBackgroundSync();
  }).finally(() => app.snapLevelBar());
  calendarState.selectedData = null;
  calendarState.selectedLabel = Formatter.dateLogical();
  viewState.activeViewLabel = null;
  const tip = (window as Window & { TooltipController?: { hide: () => void } }).TooltipController;
  if (tip) tip.hide();
  app.refreshInitLock();
  app.refreshDemoMasks();
  if (typeof runtime.realReturnView === 'string') {
    runtime.returnView = runtime.realReturnView;
    runtime.realReturnView = null;
  }
  const pdeb = document.getElementById('bbgl-page-demo-exit');
  if (pdeb) pdeb.style.display = 'none';
  const isInit = !!localStorage.getItem('bbgl_initialized');
  if (isInit) app.switchView('settings');
  else {
    app.switchView('welcome', true);
    app.openPrivacyModal();
  }
  saveConfig();
}

import { useEffect } from 'preact/hooks';
import { ICONS } from '../icons.ts';
import { runtime, viewState } from '../../core/state.ts';
import { TOOLTIPS, buildEmptyLevelTrackSVG } from '../templates.js';
import { Settings } from './Settings.tsx';
import { Welcome } from './Welcome.tsx';
import { app } from '../../app-context.js';
import { Raw } from './html.tsx';
import { useUiTick } from './store.ts';
import { onCopySession, onDemoExit, onHeaderClick, onPopoutClick } from './chrome.ts';
import { CalendarGrid, CalendarSwipe, MonthHeader, WeekRow } from './views/Calendar.tsx';
import { GraphView } from './views/Graph.tsx';
import { LedgerChrome } from './views/Ledger.tsx';
import { AchievementsView } from './views/Achievements.tsx';
import { ItemViewer, StickerTitle, StickersView } from './views/Stickers.tsx';
import { ScanOverlay } from './ScanOverlay.tsx';

function Header() {
  return (
    <div class="bbgl-header" id="bbgl-header-bar" onClick={onHeaderClick}>
      <div class="bbgl-header-left">
        <Raw html={ICONS.LOGO} />
        <span class="bbgl-header-text">
          <span class="bbgl-short-title">Big Black Log</span>
          <span class="bbgl-long-title">Big Black Gym Log</span>
        </span>
      </div>
      <div class="bbgl-header-right">
        <span
          id="bbgl-demo-exit-btn"
          class="close-settings-btn bbgl-close-purple"
          style={{ display: runtime.demoMode ? 'flex' : 'none' }}
          data-tooltip-html={TOOLTIPS.DEMO_EXIT_HTML}
          onClick={onDemoExit}
        >
          <span class="bbgl-demo-x-label">Demo</span>
          <Raw html={ICONS.CLOSE} />
        </span>
        <span id="bbgl-settings-btn" class="bbgl-custom-icon" onClick={e => app.toggleSettingsView(e)}>⚙</span>
        <span id="bbgl-close-btn" class="bbgl-native-icon" onClick={() => app.closePanel()}>
          <Raw html={ICONS.MINIMIZE} />
        </span>
        <span id="bbgl-pop-btn" class="bbgl-native-icon" onClick={onPopoutClick}>
          <Raw html={viewState.expanded ? ICONS.COMPRESS : ICONS.POPOUT} />
        </span>
      </div>
    </div>
  );
}

function TopPanel() {
  const sub = viewState.subView;
  const overlay = sub === 'settings' || sub === 'welcome';
  const cls = [
    sub === 'graph' ? 'viewing-graph' : '',
    sub === 'stickers' ? 'viewing-stickers' : '',
    sub === 'achievements' ? 'viewing-achievements' : ''
  ].filter(Boolean).join(' ');
  return (
    <div id="bbgl-top-panel" class={cls} style={{ display: overlay ? 'none' : 'flex' }}>
      <div id="bbgl-tall-toggle" onClick={() => app.toggleTall()}>{viewState.isTall ? '–' : '+'}</div>
      <div id="bbgl-ledger-toggle" data-tooltip={TOOLTIPS.LEDGER_VIEW} onClick={() => app.toggleLedgerView()}>
        <Raw html={ICONS.LEDGER} />
      </div>
      <div id="bbgl-graph-toggle" data-tooltip={TOOLTIPS.GRAPH_VIEW} onClick={() => app.toggleGraphView()}>
        <Raw html={ICONS.GRAPH} />
      </div>
      <div id="bbgl-achievements-toggle" data-tooltip={TOOLTIPS.ACHIEVEMENTS} onClick={() => app.toggleAchievementsView()}>
        <Raw html={ICONS.ACHIEVEMENTS} />
      </div>
      <div id="bbgl-sticker-toggle" data-tooltip={TOOLTIPS.STICKERBOOK} onClick={() => app.toggleStickerView()}>
        <Raw html={ICONS.STICKERBOOK} />
      </div>
      <div id="bbgl-copy-btn" class="copy-hist-btn" data-tooltip={TOOLTIPS.COPY_SESSION} onClick={onCopySession}>
        <Raw html={ICONS.CLIPBOARD} />
      </div>
      <StickerTitle />
      <LedgerChrome />
      <GraphView />
      <AchievementsView />
      <StickersView />
      <div class="glass-overlay" />
    </div>
  );
}

function BottomPanel() {
  const overlay = viewState.subView === 'settings' || viewState.subView === 'welcome';
  const hideForViewer = viewState.subView === 'stickers' && viewState.activeItemId;
  return (
    <div
      id="bbgl-bottom-panel"
      style={overlay || hideForViewer ? { display: 'none' } : undefined}
    >
      <div
        id="bbgl-demo-exit"
        style={{ display: runtime.demoMode ? 'flex' : 'none' }}
        data-tooltip={TOOLTIPS.DEMO_EXIT}
        data-tooltip-html={TOOLTIPS.DEMO_EXIT_HTML}
        onClick={onDemoExit}
      >
        DEMO MODE
      </div>
      <MonthHeader />
      <div id="bbgl-level-bg" dangerouslySetInnerHTML={{ __html: buildEmptyLevelTrackSVG() }} />
      <div id="bbgl-level-container">
        <div id="bbgl-level-flag-clip">
          <span id="bbgl-level-num">Lv 1</span>
        </div>
        <div id="bbgl-level-track">
          <div id="bbgl-level-fill" />
        </div>
      </div>
      <div class="bbgl-grid-container">
        <WeekRow />
        <CalendarSwipe>
          <CalendarGrid />
        </CalendarSwipe>
      </div>
    </div>
  );
}

export function Dashboard() {
  useUiTick();
  useEffect(() => {
    const panel = document.getElementById('bbgl-panel');
    if (panel && typeof app.cacheDOM === 'function') app.cacheDOM(panel);
    if (typeof app.refreshInitLock === 'function') app.refreshInitLock();
    if (typeof app.renderScanOverlay === 'function') app.renderScanOverlay();
  });
  const sub = viewState.subView;
  return (
    <>
      <Header />
      <div id="bbgl-content-wrapper">
        <TopPanel />
        <BottomPanel />
        <ItemViewer />
        <div id="bbgl-settings-view" class={sub === 'settings' ? 'active-view' : ''}>
          <Settings />
        </div>
        <div id="bbgl-welcome-view" class={sub === 'welcome' ? 'active-view' : ''}>
          <Welcome />
        </div>
        <ScanOverlay />
      </div>
    </>
  );
}

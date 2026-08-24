import { ICONS } from '../icons.ts';
import { runtime, userConfig, viewState } from '../../core/state.ts';
import { TOOLTIPS, buildEmptyLevelTrackSVG, getSettingsHTML } from '../templates.js';
import { app } from '../../app-context.js';
import { Raw } from './html.tsx';
import { Island } from './Island.tsx';
import { useUiTick } from './store.ts';
import { onCopySession, onDemoExit, onHeaderClick, onPopoutClick } from './chrome.ts';

const WEEK_MON = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEK_SUN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

function GraphHud() {
  return (
    <div id="bbgl-graph-container">
      <div class="g-hud">
        <div class="g-toggles">
          <div class="g-pill active" data-type="mode" data-val="values">Gains</div>
          <div class="g-pill" data-type="mode" data-val="rates">Rates</div>
        </div>
        <div class="g-toggles">
          <div class="g-pill p-str active" data-type="stat" data-val="str">STR</div>
          <div class="g-pill p-def" data-type="stat" data-val="def">DEF</div>
          <div class="g-pill p-spd active" data-type="stat" data-val="spd">SPD</div>
          <div class="g-pill p-dex" data-type="stat" data-val="dex">DEX</div>
          <div class="g-pill p-tot" data-type="stat" data-val="total">TOT</div>
        </div>
      </div>
      <svg id="bbgl-graph-svg" />
    </div>
  );
}

function AchievementsChrome() {
  return (
    <>
      <div id="bbgl-achievements-container" class="ledger-content">
        <div class="bbgl-ach-scroll">
          <div id="bbgl-ach-pages" />
        </div>
      </div>
      <div id="bbgl-ach-footer" class="bbgl-ach-footer">
        <div class="bbgl-ach-footer-side bbgl-ach-footer-left">
          <button type="button" class="bbgl-ach-nav bbgl-ach-prev" aria-label="Previous achievements page">
            {'\u276e'}
          </button>
        </div>
        <div id="bbgl-ach-pageindicator" />
        <div class="bbgl-ach-footer-side bbgl-ach-footer-right">
          <button type="button" class="bbgl-ach-nav bbgl-ach-next" aria-label="Next achievements page">
            {'\u276f'}
          </button>
        </div>
      </div>
    </>
  );
}

function StickerChrome() {
  return (
    <>
      <div id="bbgl-sticker-bg" />
      <div id="bbgl-sticker-container">
        <div id="sticker-sponsor-btn" class="sticker-nav-btn disabled">❮</div>
        <div id="sticker-prev-btn" class="sticker-nav-btn">❮</div>
        <div id="sticker-next-btn" class="sticker-nav-btn">❯</div>
        <div id="bbgl-sticker-grid" />
        <div id="bbgl-sticker-pagination" />
      </div>
    </>
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
      <Island id="bbgl-item-counters" />
      <div id="bbgl-copy-btn" class="copy-hist-btn" data-tooltip={TOOLTIPS.COPY_SESSION} onClick={onCopySession}>
        <Raw html={ICONS.CLIPBOARD} />
      </div>
      <Island id="bbgl-sticker-title" />
      <Island id="bbgl-date-label" class="ui-floating-label">LOADING...</Island>
      <Island id="bbgl-summary-label" class="ui-floating-summary" />
      <Island id="bbgl-ledger-view" class="ledger-content" />
      <Island contents><GraphHud /></Island>
      <Island contents><AchievementsChrome /></Island>
      <Island contents><StickerChrome /></Island>
      <div class="glass-overlay" />
    </div>
  );
}

function BottomPanel() {
  const weekDays = userConfig.weekStartMode === 'mon' ? WEEK_MON : WEEK_SUN;
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
      <Island contents>
        <div class="bbgl-header-wrapper">
          <div class="bbgl-month-header">
            <div class="title-group">
              <div class="title-stack">
                <div class="header-row header-row--alltime">
                  <div class="stats-btn" id="all-time-btn">
                    <Raw html={ICONS.CHART} />
                  </div>
                  <div class="header-trigger" id="all-time-trigger">∞</div>
                </div>
                <div class="header-row header-row--year">
                  <div class="stats-btn" id="year-stats-btn">
                    <Raw html={ICONS.CHART} />
                  </div>
                  <div class="header-trigger" id="year-trigger" />
                  <div id="bbgl-year-dropdown" class="bbgl-dropdown-menu" />
                </div>
                <div class="header-row header-row--month">
                  <div class="stats-btn" id="month-stats-btn">
                    <Raw html={ICONS.CHART} />
                  </div>
                  <div class="header-trigger" id="month-trigger" />
                  <div id="bbgl-month-dropdown" class="bbgl-dropdown-menu" />
                </div>
              </div>
            </div>
            <button class="arrow-btn" id="prev-month-btn">❮</button>
            <button class="arrow-btn" id="next-month-btn">❯</button>
          </div>
          <div id="bbgl-level-bg" dangerouslySetInnerHTML={{ __html: buildEmptyLevelTrackSVG() }} />
          <div id="bbgl-level-container">
            <div id="bbgl-level-flag-clip">
              <span id="bbgl-level-num">Lv 1</span>
            </div>
            <div id="bbgl-level-track">
              <div id="bbgl-level-fill" />
            </div>
          </div>
        </div>
      </Island>
      <div class="bbgl-grid-container">
        <div class="bbgl-week-row">
          {weekDays.map(d => <span key={d}>{d}</span>)}
        </div>
        <div class="calendar-wrapper" id="swipe-area">
          <Island id="bbgl-cal-container" class="bbgl-cal-container" />
        </div>
      </div>
    </div>
  );
}

function ItemViewer() {
  return (
    <Island contents>
      <div id="bbgl-item-viewer">
        <div class="viewer-window">
          <div class="viewer-stage">
            <div class="viewer-pedestal" id="vi-pedestal-wrapper">
              <div class="viewer-obj" id="vi-obj-target">
                <div class="layer-front" />
                <div class="layer-back" />
              </div>
            </div>
          </div>
        </div>
        <div class="viewer-info-overlay">
          <div class="vi-name" id="vi-name-target">Item Name</div>
        </div>
      </div>
    </Island>
  );
}

export function Dashboard() {
  useUiTick();
  const sub = viewState.subView;
  return (
    <>
      <Header />
      <div id="bbgl-content-wrapper">
        <TopPanel />
        <BottomPanel />
        <ItemViewer />
        <div id="bbgl-settings-view" class={sub === 'settings' ? 'active-view' : ''}>
          <Island id="bbgl-settings-inner" contents html={getSettingsHTML()} />
        </div>
        <div id="bbgl-welcome-view" class={sub === 'welcome' ? 'active-view' : ''}>
          <Island id="bbgl-welcome-inner" contents />
        </div>
      </div>
    </>
  );
}

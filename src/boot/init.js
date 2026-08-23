import { app } from '../app-context.js';
import { CUSTOM_STICKERS, PAGE_TITLES, cdnize } from '../ui/assets.ts';
import { ASSETS, ICONS } from '../ui/icons.ts';
import { injectStyles } from '../ui/styles.ts';
import {
  ACH_FMT, BACKFILL, BACKFILL_GROUP_KEYS, BACKFILL_GROUP_OF, BACKFILL_GROUPS,
  BASE_DOCS_URL, BBGL_ERROR_CODE, BS_STAT_ROWS, compareVersions, CONSTANTS, ECAN_LOG, ECSTASY_LOG, ENERGY_LOGS, ENERGY_PARAM,
  EX_OD_LOG, GAME, GYM_TIERS, HAPPY_LOGS, ITEM_GROUP_LABELS, ITEM_LOG_META, ITEM_LOGS, KEYS, LAYOUT, LSD_OD_LOG,
  MSG_CLIPBOARD_DENIED, MSG_KEY_FORMAT_INVALID, MSG_KEY_NETWORK_ERROR, MSG_SYNC_NETWORK_ERROR, MSG_SYNC_QUOTA,
  OD_LOGS, r2, SCRIPT_VERSION, STAT_ENHANCER_PARAM, STAT_HAPPY_PARAM, STAT_KEYS, STAT_LOGS, SYNC_FROM_BUFFER,
  TORN_KEY_ERROR_MAP, TRAIN_ENERGY_PARAM, TRAIN_LOGS, WIPE_BELOW_VERSION, XANAX_LOG, XANAX_OD_LOG, ZERO_BREAKDOWN,
  bbglError, tornKeyErrorText
} from '../core/constants.ts';
import { Log, Perf, isDevMode } from '../core/log.ts';
import {
  ALLOWED_CONFIG_KEYS, TAB_ID, calendarState, dom, graphState, historyCache, lastButtonLocation, layoutObservers,
  refreshClickLog, runtime, saveConfig, saveViewState, setHistoryCache, setLastButtonLocation, setTopCeiling, setViewState,
  topCeilingCache, topCeilingTs, userConfig, viewState
} from '../core/state.ts';
import { Formatter, TimeManager, getISOWeek, getWeekKey } from '../domain/time.ts';
import { classifyDay, computeWeekCapsules, computeWeekCompletion, placeCapsuleUnit } from '../domain/capsules.ts';
import { atrophyTitle, calculateLevelProgress, computeDailyLevelExp, computeLevelExpCost } from '../domain/leveling.ts';
import { findHappyJumps, initializeDayObject, normalizeApiLogs, sumStats } from '../domain/day.ts';


function checkViewRouting() { const pm = window.location.hash.includes('gymlog'); app.syncSidebarState(); if (pm) { document.title = "Gym Log | TORN"; document.body.classList.add('bbgl-page-mode-active'); renderPageMode(); if (localStorage.getItem(KEYS.CHANGELOG_NOTIF) === '1') { localStorage.setItem(KEYS.CHANGELOG_VER, SCRIPT_VERSION); localStorage.removeItem(KEYS.CHANGELOG_NOTIF); app.syncChangelogNotif(false); setTimeout(() => app.openChangelogModal(), 400); } } else { document.body.classList.remove('bbgl-page-mode-active'); const cw = document.querySelector('.content-wrapper'), pc = document.getElementById('bbgl-page-container'); if (cw && pc) pc.remove(); if (viewState.isOpen) { const lp = dom.panel; if (lp && lp.classList.contains('bbgl-mode-page')) { lp.remove(); dom.panel = null; } app.togglePanel(false); } else { viewState.subView = 'ledger'; viewState.activeItemId = null; viewState.activeViewLabel = null; viewState.isTall = false; calendarState.selectedData = null; calendarState.selectedLabel = null; } } app.updateFooterTooltip(); }

function renderPageMode() { const H = `<div class="bbgl-native-header"><div class="bbgl-native-title"><span style="margin-left:8px;">Big Black Gym Log</span></div><div class="bbgl-native-links"><div id="bbgl-page-demo-exit" class="bbgl-native-link" style="display:${runtime.demoMode ? 'flex' : 'none'};"><span class="bbgl-demo-x-label">Demo</span>${ICONS.CLOSE}</div><div id="bbgl-page-settings" class="bbgl-native-link"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L3.16 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.58 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.08-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>Settings</div></div></div>`, cw = document.querySelector('.content-wrapper'); if (!cw) return; window.scrollTo(0, 0); const pp = dom.panel; if (pp && !pp.classList.contains('bbgl-mode-page')) { pp.remove(); dom.panel = null; } if (document.getElementById('bbgl-page-container')) return; cw.innerHTML = ''; const pc = document.createElement('div'); pc.id = 'bbgl-page-container'; pc.innerHTML = H; const sb = pc.querySelector('#bbgl-page-settings'); if (sb) sb.onclick = app.toggleSettingsView; const p = document.createElement('div'); p.id = 'bbgl-panel'; p.className = 'bbgl-mode-page'; p.innerHTML = app.getDashboardHTML(); pc.appendChild(p); cw.appendChild(pc); app.setupEventListeners(p); const pdeb = pc.querySelector('#bbgl-page-demo-exit'); const demoBar = p.querySelector('#bbgl-demo-exit'); if (pdeb && demoBar) pdeb.onclick = e => { e.stopPropagation(); demoBar.onclick(e); }; app.restoreInternalState(); app.renderPanelContent(); if (dom.topPanel.classList.contains('viewing-graph')) setTimeout(app.GraphController.draw, 100); }

function handleStorageEvent(e) { if (e.key === KEYS.STATE) { try { const ns = JSON.parse(e.newValue); if (!ns) return; runtime.isSyncing = true; const openC = ns.isOpen !== viewState.isOpen, viewC = ns.subView !== viewState.subView, expandedC = ns.expanded !== viewState.expanded, tallC = ns.isTall !== viewState.isTall, stickerPC = ns.currentStickerPage !== viewState.currentStickerPage, labelC = ns.activeViewLabel !== viewState.activeViewLabel, calC = ns.calMonth !== viewState.calMonth || ns.calYear !== viewState.calYear, itemC = ns.activeItemId !== viewState.activeItemId, gMC = ns.graphMode !== viewState.graphMode, gSC = JSON.stringify(ns.graphStats) !== JSON.stringify(viewState.graphStats); setViewState(ns); const p = dom.panel; if (!p) { runtime.isSyncing = false; return; } if (!openC && !viewC && !expandedC && !tallC && !stickerPC && !labelC && !calC && !itemC && !gMC && !gSC) { runtime.isSyncing = false; return; } if (!p.classList.contains('bbgl-mode-page') && openC) { if (ns.isOpen && p.style.display === 'none') app.togglePanel(false);else if (!ns.isOpen && p.style.display !== 'none') app.closePanel(null); } if (viewC) app.switchView(ns.subView); if (stickerPC) { runtime.currentStickerPage = ns.currentStickerPage || 0; if (ns.subView === 'stickers') app.renderStickers(); } if (gMC || gSC) { if (ns.graphMode) graphState.mode = (ns.graphMode === 'gains' ? 'values' : ns.graphMode) || 'values'; if (ns.graphStats) graphState.activeStats = ns.graphStats; app.GraphController.restoreUi(); if (ns.subView === 'graph') window.requestAnimationFrame(app.GraphController.draw); } if (labelC) { if (ns.activeViewLabel) { const s = app.getActiveHistory(); let td = null; if (/^\d{4}-\d{2}-\d{2}$/.test(ns.activeViewLabel)) { td = s.history.find(d => d.date === ns.activeViewLabel); if (!td && s.today.date === ns.activeViewLabel) td = s.today; if (td) { calendarState.selectedData = td; calendarState.selectedLabel = ns.activeViewLabel; if (ns.subView === 'graph') { app.GraphController.draw(); const de = dom.dateLabel; if (de) de.innerText = Formatter.datePretty(ns.activeViewLabel); } else app.renderStats(td, ns.activeViewLabel); } } else { calendarState.selectedLabel = ns.activeViewLabel; const type = ns.activeViewLabel === 'All-Time' ? 'ALL' : /^\d{4}$/.test(ns.activeViewLabel) ? 'YEAR' : 'MONTH', sl = app.DataController.getSlice(type, ns.activeViewLabel, calendarState.year); calendarState.selectedData = sl; if (ns.subView === 'graph') app.GraphController.draw();else app.renderStats(sl, ns.activeViewLabel); } } else { calendarState.selectedData = null; calendarState.selectedLabel = null; const ts = Formatter.dateLogical(); if (ns.subView === 'graph') { app.GraphController.draw(); const de = dom.dateLabel; if (de) de.innerText = Formatter.datePretty(ts); } else app.renderStats(app.getActiveHistory().today, ts); } app.renderPanelContent(); } else if (calC) { if (ns.calYear) calendarState.year = ns.calYear; if (ns.calMonth !== undefined && ns.calMonth !== null) calendarState.month = ns.calMonth; app.renderPanelContent(); } if (!p.classList.contains('bbgl-mode-page')) { if (expandedC) { if (ns.expanded) { p.classList.add('bbgl-expanded'); p.classList.remove('bbgl-compact'); } else { p.classList.remove('bbgl-expanded'); p.classList.add('bbgl-compact'); } const pb = dom.popBtn; if (pb) pb.innerHTML = ns.expanded ? ICONS.COMPRESS : ICONS.POPOUT; } if (tallC) { if (ns.isTall) p.classList.add('bbgl-tall');else p.classList.remove('bbgl-tall'); const tb = dom.tallToggle; if (tb) tb.innerText = ns.isTall ? "–" : "+"; } if (expandedC || tallC) app.handleLayout(); } if (ns.subView === 'stickers' || ns.subView === 'viewer') { const ti = ns.activeItemId ? Number(ns.activeItemId) : null; if (ti && ti !== runtime.currentOpenedItemId) { if (!runtime.stickerData.length) app.loadStickerData(); const i = runtime.stickerData.find(x => x.id === ti); if (i) { const delay = viewC && userConfig.animations ? 400 : 0; if (delay) setTimeout(() => app.openItemViewer(i, false), delay);else app.openItemViewer(i, false); } } else if (!ti && runtime.currentOpenedItemId !== null) app.closeItemViewer(false); } } catch (err) { Log.warn('Sync error', err); } finally { runtime.isSyncing = false; } } else if (e.key === KEYS.LAST_SYNC) app._syncChannel.onmessage({ data: { from: 'storage_event' } });else if (e.key === KEYS.DEMO) { if (e.newValue === '1') { if (!runtime.demoMode) app.enterDemo('external'); } else if (runtime.demoMode) { const deb = dom.panel ? dom.panel.querySelector('#bbgl-demo-exit') : null; if (deb) deb.click(); } } }

async function init() { Perf.start('init'); injectStyles(); const _seenVer = localStorage.getItem(KEYS.CHANGELOG_VER); if (SCRIPT_VERSION && typeof SCRIPT_VERSION === 'string') { if (!_seenVer) { localStorage.setItem(KEYS.CHANGELOG_VER, SCRIPT_VERSION); } else if (_seenVer !== SCRIPT_VERSION) { localStorage.setItem(KEYS.CHANGELOG_NOTIF, '1'); } } if (!runtime.demoMode) { if (_seenVer && compareVersions(_seenVer, WIPE_BELOW_VERSION) < 0) { await app.factoryReset(); } try { await app.DBManager.initDB(); const loaded = await app.DBManager.loadHistory(); app.DataController.hydrate(loaded); app.GraphController.applyDefaultsIfNeeded(); await app.recoverInterruptedBackfill(); app.renderBackfillButton(); app.renderScanOverlay(); if (loaded && (historyCache.history.length > 0 || historyCache.meta && historyCache.meta.logStartDate) && !localStorage.getItem('bbgl_initialized') && !sessionStorage.getItem('bbgl_dev_onboarding')) localStorage.setItem('bbgl_initialized', '1'); } catch (e) { Log.warn('IndexedDB boot failed, continuing with empty state', e); } } window.addEventListener('storage', handleStorageEvent); window.addEventListener('hashchange', checkViewRouting); window.addEventListener('popstate', checkViewRouting); window.addEventListener('resize', () => { setTopCeiling(null, topCeilingTs); }); window.addEventListener('bbgl:dataUpdated', () => { if (dom.panel && dom.panel.style.display !== 'none') app.renderPanelContent(); app.updateLevelBar(); app.renderBackfillButton(); app.renderScanOverlay(); }); app.updateLevelBar(); let _domRaf = null; const domObs = new MutationObserver(function onDomMutationBatch() { if (_domRaf) return; _domRaf = requestAnimationFrame(function onDomMutationFrame() { _domRaf = null; app.handleDomMutation(); }); }); runtime.domObs = domObs; runtime._domGuards = []; runtime._domObsArmed = true; domObs.observe(document.body, { childList: true, subtree: true }); app.attachLayoutObservers(); const _bbglRecheckNav = () => { [150, 600, 1500].forEach(ms => setTimeout(() => { try { app.handleDomMutation(); } catch (e) {} }, ms)); }; ['pushState', 'replaceState'].forEach(name => { const orig = history[name]; if (typeof orig !== 'function' || orig._bbglWrapped) return; const wrapped = function () { const r = orig.apply(this, arguments); _bbglRecheckNav(); return r; }; wrapped._bbglWrapped = true; history[name] = wrapped; }); calendarState.selectedLabel = Formatter.dateLogical(); if (typeof window.initDevTools === 'function') window.initDevTools(); if (!runtime.demoMode) { app.startBackgroundSync(); app.checkExitSync(); } app.TooltipController.init(); let tRaf = null, tSup = 0; const _onMouseMove = e => { if (tRaf || Date.now() < tSup) return; tRaf = requestAnimationFrame(() => { app.TooltipController.handleHover(e); tRaf = null; }); }; let _mouseMoveBound = true; document.addEventListener('mousemove', _onMouseMove); let _tX = 0, _tY = 0, _tTimer = null, _scrubMode = false, _scrubMoveBound = null, _toolbarTipTimer = null; const _TOOLBAR_TOGGLE_IDS = new Set(['bbgl-ledger-toggle', 'bbgl-graph-toggle', 'bbgl-achievements-toggle', 'bbgl-sticker-toggle']); const _onScrubMove = e => { if (!_scrubMode) return; if (e.cancelable) e.preventDefault(); const touch = e.touches[0]; const el = document.elementFromPoint(touch.clientX, touch.clientY); const t = app.TooltipController.resolve(el); const _sh = t ? t.getAttribute('data-tooltip-html') : null, _st = t ? t.getAttribute('data-tooltip') : null; if (t && (_sh || _st)) { if (app.TooltipController.currentTarget !== t) { if (app.TooltipController.currentTarget) { app.TooltipController.currentTarget.classList.remove('is-scrub-hovered'); if (app.TooltipController.currentTarget.classList.contains('bbgl-day-cell') && !app.TooltipController.currentTarget.classList.contains('is-viewing')) app.TooltipController.currentTarget.classList.remove('shimmer-active'); } app.TooltipController.currentTarget = t; t.classList.add('is-scrub-hovered'); if (t.classList.contains('bbgl-day-cell') && userConfig.animations) { t.classList.add('shimmer-active'); if (t._buildShine) t._buildShine(); } app.TooltipController.show(_sh || '<div style="text-align:center; color:#ddd;">' + _st + '</div>', t.getBoundingClientRect()); } } else { if (app.TooltipController.currentTarget) { app.TooltipController.currentTarget.classList.remove('is-scrub-hovered'); if (app.TooltipController.currentTarget.classList.contains('bbgl-day-cell') && !app.TooltipController.currentTarget.classList.contains('is-viewing')) app.TooltipController.currentTarget.classList.remove('shimmer-active'); app.TooltipController.hide(); } } }; const _enterScrub = () => { if (_scrubMoveBound) return; _scrubMoveBound = _onScrubMove; document.addEventListener('touchmove', _scrubMoveBound, { passive: false }); }; const _exitScrub = () => { if (!_scrubMoveBound) return; document.removeEventListener('touchmove', _scrubMoveBound, { passive: false }); _scrubMoveBound = null; }; document.addEventListener('touchstart',
    e => { if (!document.body.classList.contains('is-touch-device')) { document.body.classList.add('is-touch-device'); if (_mouseMoveBound) { document.removeEventListener('mousemove', _onMouseMove); _mouseMoveBound = false; } } _tX = e.touches[0].clientX; _tY = e.touches[0].clientY; _scrubMode = false; window._bbglScrubbing = false; const t = app.TooltipController.resolve(e.target); const _panel = dom.panel || document.getElementById('bbgl-page-container'); if (_panel && _panel.contains(e.target)) { _tTimer = setTimeout(() => { _scrubMode = true; window._bbglScrubbing = true; _enterScrub(); if (t) { app.TooltipController.currentTarget = t; t.classList.add('is-scrub-hovered'); if (t.classList.contains('bbgl-day-cell') && userConfig.animations) { t.classList.add('shimmer-active'); if (t._buildShine) t._buildShine(); } const _th = t.getAttribute('data-tooltip-html'), _tt = t.getAttribute('data-tooltip'); if (_th || _tt) app.TooltipController.show(_th || '<div style="text-align:center; color:#ddd;">' + _tt + '</div>', t.getBoundingClientRect()); } }, 400); } }, { passive: true }); document.addEventListener('touchmove', e => { if (_scrubMode) return; if (_tTimer) { const dx = e.touches[0].clientX - _tX, dy = e.touches[0].clientY - _tY; if (Math.sqrt(dx * dx + dy * dy) > 10) { clearTimeout(_tTimer); _tTimer = null; } } }, { passive: true }); document.addEventListener('touchend', e => { if (_tTimer) { clearTimeout(_tTimer); _tTimer = null; } if (_scrubMode) { if (e.cancelable) e.preventDefault(); if (app.TooltipController.currentTarget) { app.TooltipController.currentTarget.classList.remove('is-scrub-hovered'); if (app.TooltipController.currentTarget.classList.contains('bbgl-day-cell') && !app.TooltipController.currentTarget.classList.contains('is-viewing')) app.TooltipController.currentTarget.classList.remove('shimmer-active'); app.TooltipController.hide(); } _scrubMode = false; window._bbglScrubbing = false; _exitScrub(); tSup = Date.now() + 500; return; } _exitScrub(); const dx = e.changedTouches[0].clientX - _tX, dy = e.changedTouches[0].clientY - _tY; if (Math.sqrt(dx * dx + dy * dy) > 10) { if (app.TooltipController.currentTarget) app.TooltipController.hide(); tSup = Date.now() + 500; return; } const t = app.TooltipController.resolve(e.target); if (t && (_TOOLBAR_TOGGLE_IDS.has(t.id) || t.id === 'bbgl-gym-tab' && document.body.classList.contains('bbgl-page-mode-active'))) { if (_toolbarTipTimer) { clearTimeout(_toolbarTipTimer); _toolbarTipTimer = null; } const txt = t.getAttribute('data-tooltip'), h = t.getAttribute('data-tooltip-html'); if (h || txt) { app.TooltipController.currentTarget = t; app.TooltipController.show(h || '<div style="text-align:center; color:#ddd;">' + txt + '</div>', t.getBoundingClientRect()); _toolbarTipTimer = setTimeout(() => { _toolbarTipTimer = null; if (app.TooltipController.currentTarget === t) app.TooltipController.hide(); }, 500); } } else if (t && t.id !== 'bbgl-gym-tab') { const h = t.getAttribute('data-tooltip-html'), txt = t.getAttribute('data-tooltip'); if (h) { if (app.TooltipController.currentTarget === t) app.TooltipController.hide(); } else if (txt) { if (app.TooltipController.currentTarget === t) app.TooltipController.hide();else { app.TooltipController.currentTarget = t; app.TooltipController.show('<div style="text-align:center; color:#ddd;">' + txt + '</div>', t.getBoundingClientRect()); } } } else if (app.TooltipController.currentTarget) app.TooltipController.hide(); tSup = Date.now() + 500; }, { passive: false }); document.addEventListener('click', function (e) { if (e.target.closest('#bbgl-gym-tab')) { e.preventDefault(); e.stopPropagation(); app.togglePanel(true); return; } if (app.BestGymController.handleTrainClick(e)) return; app.handleGymClick(e); }, true); app.handleDomMutation(); if (localStorage.getItem(KEYS.CHANGELOG_NOTIF) === '1') app.syncChangelogNotif(true); checkViewRouting(); if (!window.location.hash.includes('gymlog')) app.handleLayout(); Log.boot(); Perf.end('init'); }

function installDomHooks() {
  injectStyles();
  const _oI = Node.prototype.insertBefore, _oA = Node.prototype.appendChild;
  let _hA = true, _navGymDone = false, _notesBtnDone = false, _uninstallTimer = null, _loadHandler = null;
  const needsNavGym = () => userConfig.buttonLocation === 'sidebar' || userConfig.buttonLocation === 'both';
  const needsNotesBtn = () => userConfig.buttonLocation === 'notes' || userConfig.buttonLocation === 'both';
  function forceUninstall() {
    if (!_hA) return;
    Node.prototype.insertBefore = _oI;
    Node.prototype.appendChild = _oA;
    _hA = false;
    if (_uninstallTimer) {
      clearTimeout(_uninstallTimer);
      _uninstallTimer = null;
    }
    if (_loadHandler) {
      window.removeEventListener('load', _loadHandler);
      _loadHandler = null;
    }
  }
  function maybeUninstall() {
    const navOk = !needsNavGym() || _navGymDone;
    const notesOk = !needsNotesBtn() || _notesBtnDone;
    if (navOk && notesOk) forceUninstall();
  }
  function handleNavGym() {
    if (_navGymDone) return;
    _navGymDone = true;
    if (needsNavGym()) Promise.resolve().then(() => {
      if (!document.getElementById(app.SB_MOBILE.id)) app.injectSidebarButton(app.SB_MOBILE, true);
      if (!document.getElementById(app.SB_DESKTOP.id)) app.injectSidebarButton(app.SB_DESKTOP, false);
    });
    maybeUninstall();
  }
  function handleNotesBtn(el) {
    if (_notesBtnDone) return;
    _notesBtnDone = true;
    if (needsNotesBtn()) Promise.resolve().then(() => app.injectFooterButton(el));
    maybeUninstall();
  }
  function check(n) {
    if (!_hA || !n || n.nodeType !== 1) return;
    try {
      const wantNav = needsNavGym() && !_navGymDone, wantNotes = needsNotesBtn() && !_notesBtnDone;
      if (!wantNav && !wantNotes) return;
      if (wantNav && n.id === 'nav-gym') handleNavGym();
      if (wantNotes && n.id === 'notes_panel_button') handleNotesBtn(n);
      if (!n.firstElementChild) return;
      const stillWantNav = needsNavGym() && !_navGymDone, stillWantNotes = needsNotesBtn() && !_notesBtnDone;
      if (!stillWantNav && !stillWantNotes) return;
      if (n.id && !n.id.startsWith('nav-') && n.id !== 'sidebar') return;
      const sel = stillWantNav && stillWantNotes ? '#nav-gym, #notes_panel_button' : stillWantNav ? '#nav-gym' : '#notes_panel_button';
      const hit = n.querySelector(sel);
      if (!hit) return;
      if (hit.id === 'nav-gym') handleNavGym();
      else if (hit.id === 'notes_panel_button') handleNotesBtn(hit);
    } catch (e) { /* ignore */ }
  }
  Node.prototype.insertBefore = function (n, r) {
    const res = _oI.call(this, n, r);
    check(n);
    return res;
  };
  Node.prototype.appendChild = function (n) {
    const res = _oA.call(this, n);
    check(n);
    return res;
  };
  const startCountdown = () => {
    if (_uninstallTimer) return;
    _uninstallTimer = setTimeout(forceUninstall, 1000);
  };
  if (document.readyState === 'complete') startCountdown();
  else {
    _loadHandler = () => startCountdown();
    window.addEventListener('load', _loadHandler, { once: true });
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => { if (_hA) forceUninstall(); }, 3000);
      }, { once: true });
    } else {
      setTimeout(() => { if (_hA) forceUninstall(); }, 3000);
    }
  }
}

app.checkViewRouting = checkViewRouting;
app.renderPageMode = renderPageMode;
app.handleStorageEvent = handleStorageEvent;
app.init = init;
app.installDomHooks = installDomHooks;
export { checkViewRouting, renderPageMode, handleStorageEvent, init, installDomHooks };

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



/**
 *  [SECTION I] THE DIET PLAN (Constants & State)
 *  ========================================================================
 *  No substitutions. No cheat days. This follows the plan
 *  so that you don't have to.
 */



function cacheDOM(root) {
    if (!root) return;
    dom.panel = root.id === 'bbgl-panel' ? root : root.querySelector('#bbgl-panel') || root;
    if (!userConfig.animations) dom.panel.classList.add('bbgl-no-animations');
    if (!userConfig.ratesEnabled) dom.panel.classList.add('bbgl-no-rates');
    dom.topPanel = root.querySelector('#bbgl-top-panel');
    dom.bottomPanel = root.querySelector('#bbgl-bottom-panel');
    dom.settingsView = root.querySelector('#bbgl-settings-view');
    dom.welcomeView = root.querySelector('#bbgl-welcome-view');
    dom.itemViewer = root.querySelector('#bbgl-item-viewer');
    dom.dateLabel = root.querySelector('#bbgl-date-label');
    dom.summaryLabel = root.querySelector('#bbgl-summary-label');
    dom.ledgerView = root.querySelector('#bbgl-ledger-view');
    dom.graphContainer = root.querySelector('#bbgl-graph-container');
    dom.graphSvg = root.querySelector('#bbgl-graph-svg');
    dom.calContainer = root.querySelector('#bbgl-cal-container');
    dom.tallToggle = root.querySelector('#bbgl-tall-toggle');
    dom.copyBtn = root.querySelector('#bbgl-copy-btn');
    dom.itemCounters = root.querySelector('#bbgl-item-counters');
    dom.popBtn = root.querySelector('#bbgl-pop-btn');
    dom.monthTrigger = root.querySelector('#month-trigger');
    dom.yearTrigger = root.querySelector('#year-trigger');
    dom.monthDropdown = root.querySelector('#bbgl-month-dropdown');
    dom.yearDropdown = root.querySelector('#bbgl-year-dropdown');
    dom.achievementsContainer = root.querySelector('#bbgl-achievements-container');
    dom.achievementsToggle = root.querySelector('#bbgl-achievements-toggle');
    dom.stickerGrid = root.querySelector('#bbgl-sticker-grid');
    dom.stickerPagination = root.querySelector('#bbgl-sticker-pagination');
    dom.stickerTitle = root.querySelector('#bbgl-sticker-title');
    dom.stickerPrev = root.querySelector('#sticker-prev-btn');
    dom.stickerNext = root.querySelector('#sticker-next-btn');
    dom.stickerSponsor = root.querySelector('#sticker-sponsor-btn');
    dom.stickerContainer = root.querySelector('#bbgl-sticker-container');
    dom.stickerBg = root.querySelector('#bbgl-sticker-bg');
    dom.viPedestal = root.querySelector('#vi-pedestal-wrapper');
    dom.viObj = root.querySelector('#vi-obj-target');
    dom.viName = root.querySelector('#vi-name-target');
    dom.refreshBtn = root.querySelector('#refresh-log-btn');
    dom.contentWrapper = root.querySelector('#bbgl-content-wrapper');
    if (!dom.apiHud) dom.apiHud = document.getElementById('bbgl-api-hud');
    if (!dom.gymTab) dom.gymTab = document.getElementById('bbgl-gym-tab');
}


/**
 *  [SECTION IV] THE CHECK-IN COUNTER (Data Storage & Network)
 *  ========================================================================
 *  Though the last section was a lot to take in, this section
 *  is intentionally kept unminified so you can see exactly how
 *  your data is handled.
 *
 *  This script ONLY stores data locally on your browser and ONLY
 *  communicates with the official Torn API.
 *
 *  Layman explanations of every function are provided below for your peace of mind.
 */


function togglePanel(click = false) { if (window.location.hash.includes('gymlog')) return; let p = document.getElementById('bbgl-panel'); const b = dom.gymTab; if (click && p && p.style.display !== 'none') { closePanel(); return; } if (!p) { p = document.createElement('div'); p.id = 'bbgl-panel'; if (viewState.expanded) p.classList.add('bbgl-expanded');else p.classList.add('bbgl-compact'); if (viewState.isTall) p.classList.add('bbgl-tall'); p.innerHTML = app.getDashboardHTML(); document.body.appendChild(p); app.setupEventListeners(p); } if (p.style.display === 'none' || !p.style.display) { restoreInternalState(); p.style.opacity = '0'; p.style.display = 'flex'; app.handleLayout(); void p.offsetWidth; updateTransformOrigin(); if (b) b.classList.add('bbgl-tab-active'); p.classList.remove('bbgl-animate-vanish', 'bbgl-animate-pop'); if (userConfig.animations) { void p.offsetWidth; p.classList.add('bbgl-animate-pop'); } p.style.opacity = ''; if (click) { viewState.isOpen = true; saveViewState(); } } else if (click) closePanel(); }

function restoreInternalState() { const mp = dom.panel; if (viewState.calYear && viewState.calMonth !== undefined && viewState.calMonth !== null) { calendarState.year = viewState.calYear; calendarState.month = viewState.calMonth; } if (viewState.currentStickerPage !== undefined) runtime.currentStickerPage = viewState.currentStickerPage; app.GraphController.applyDefaultsIfNeeded(); if (viewState.graphMode) graphState.mode = (viewState.graphMode === 'gains' ? 'values' : viewState.graphMode) || 'values'; if (viewState.graphStats) graphState.activeStats = viewState.graphStats; app.GraphController.restoreUi(); if (viewState.activeViewLabel) { const s = app.getActiveHistory(); let td = null; if (/^\d{4}-\d{2}-\d{2}$/.test(viewState.activeViewLabel)) { td = s.history.find(d => d.date === viewState.activeViewLabel); if (!td && s.today.date === viewState.activeViewLabel) td = s.today; if (td) { calendarState.selectedData = td; calendarState.selectedLabel = viewState.activeViewLabel; app.renderStats(td, viewState.activeViewLabel); } } else { const mn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]; if (mn.includes(viewState.activeViewLabel)) app.calcPeriodStats('month');else if (/^\d{4}$/.test(viewState.activeViewLabel)) app.calcPeriodStats('year');else if (viewState.activeViewLabel === 'All-Time') app.calcAllTimeStats(); } } app.renderPanelContent(); const et = () => { if (mp && !mp.classList.contains('bbgl-mode-page') && !mp.classList.contains('bbgl-tall')) { mp.classList.add('bbgl-tall'); const t = dom.tallToggle; if (t) t.innerText = "–"; viewState.isTall = true; saveViewState(); } }; const _hasData = historyCache && (historyCache.history.length > 0 || historyCache.meta && historyCache.meta.logStartDate); if (viewState.subView === 'settings') switchView('settings', true);else if (viewState.subView === 'welcome' || !runtime.demoMode && !_hasData && !localStorage.getItem('bbgl_initialized')) switchView('welcome', true);else if (viewState.subView === 'graph') { et(); switchView('graph', true); setTimeout(() => window.requestAnimationFrame(() => app.GraphController.draw()), 350); } else if (viewState.subView === 'stickers') { et(); if (!runtime.stickerData || runtime.stickerData.length === 0) app.loadStickerData(); let ti = Number(viewState.activeItemId); if (!ti || ti < 1) { ti = 1; viewState.activeItemId = 1; saveViewState(); } switchView('stickers', true); const i = runtime.stickerData.find(x => x.id === ti); if (i) { const bp = dom.bottomPanel; if (bp) bp.style.setProperty('display', 'none', 'important'); setTimeout(() => app.openItemViewer(i, false), 50); } } else if (viewState.subView === 'achievements') { et(); switchView('achievements', true); } else switchView('ledger', true); }

function switchView(tgt, inst = false) { const tp = dom.topPanel, bp = dom.bottomPanel, sp = dom.settingsView, vp = dom.itemViewer, wv = dom.welcomeView; let cm = 'ledger'; if (wv && wv.classList.contains('active-view')) cm = 'welcome';else if (sp.classList.contains('active-view')) cm = 'settings';else if (tp.classList.contains('viewing-graph')) cm = 'graph';else if (tp.classList.contains('viewing-stickers')) cm = 'stickers';else if (tp.classList.contains('viewing-achievements')) cm = 'achievements'; if (cm === tgt && !inst) return; if (cm === 'stickers' && tgt !== 'stickers' && !inst) { runtime.currentStickerPage = 0; viewState.currentStickerPage = 0; } viewState.subView = tgt; saveViewState(); runtime.currentOpenedItemId = null; if (runtime.viewerLoopId) { cancelAnimationFrame(runtime.viewerLoopId); runtime.viewerLoopId = null; } const gel = m => { if (m === 'settings') return sp; if (m === 'welcome') return wv; if (m === 'graph') return dom.graphContainer; if (m === 'stickers') return dom.stickerContainer; if (m === 'achievements') return dom.achievementsContainer; return dom.ledgerView; }, cel = gel(cm), nel = gel(tgt); const app = () => { tp.classList.remove('viewing-graph', 'viewing-stickers', 'viewing-achievements'); sp.classList.remove('active-view'); if (wv) wv.classList.remove('active-view'); tp.style.display = 'flex'; if (!(tgt === 'stickers' && viewState.activeItemId)) { bp.style.removeProperty('display'); if (getComputedStyle(bp).display === 'none') bp.style.display = 'flex'; vp.classList.remove('active'); vp.style.setProperty('display', 'none', 'important'); } if (tgt === 'welcome') { if (wv) { wv.innerHTML = app.getWelcomeHTML(); app.populateWelcomeContent(wv); wv.classList.add('active-view'); const cwb = wv.querySelector('.close-settings-btn'); if (cwb) cwb.onclick = e => { if (e) e.stopPropagation(); switchView('ledger'); }; const iak = wv.querySelector('#init-api-key'); if (iak) iak.value = userConfig.apiKey || ''; const iwp = wv.querySelector('#init-api-paste'); if (iwp && iak) iwp.onclick = async () => { try { const t = await navigator.clipboard.readText(); if (t) iak.value = t.trim(); } catch (e) { bbglError(MSG_CLIPBOARD_DENIED); } }; const ilocSel = wv.querySelector('#init-loc-select'); if (ilocSel) { ilocSel.value = userConfig.buttonLocation; ilocSel.onchange = () => app.onChangeLoc(ilocSel.value); } const idaySel = wv.querySelector('#init-day-start'); if (idaySel) { idaySel.value = userConfig.dayStartMode; idaySel.onchange = () => app.onChangeDayStart(idaySel.value); } const iweekSel = wv.querySelector('#init-week-start'); if (iweekSel) { iweekSel.value = userConfig.weekStartMode; iweekSel.onchange = () => app.onChangeWeekStart(iweekSel.value); } const ipb = wv.querySelector('#init-privacy-btn'); if (ipb) ipb.onclick = function () { this.blur(); app.openPrivacyModal(); }; const isb = wv.querySelector('#init-start-btn'); if (isb && iak) isb.onclick = async function () { this.blur(); const v = iak.value.trim(); if (!/^[a-zA-Z0-9]{16}$/.test(v)) { bbglError(MSG_KEY_FORMAT_INVALID); return; } isb.style.color = '#69f0ae'; isb.innerText = 'VERIFYING...'; isb.disabled = true; try { const res = await fetch(`https://api.torn.com/user/?selections=battlestats,log&log=5300&key=${v}`), data = await res.json(); if (data.error) { bbglError(`Key Verification Failed: ${tornKeyErrorText(data)}`); isb.style.color = ''; isb.innerText = 'START TRACKING'; isb.disabled = false; return; } userConfig.apiKey = v; saveConfig(); localStorage.setItem('bbgl_initialized', '1'); app.refreshInitLock(); calendarState.selectedData = null; calendarState.selectedLabel = Formatter.dateLogical(); viewState.activeViewLabel = null; app.syncWithFeedback('FULL_SYNC'); app.openBackfillChoiceModal(); } catch (e) { bbglError(MSG_KEY_NETWORK_ERROR); isb.style.color = ''; isb.innerText = 'START TRACKING'; isb.disabled = false; } }; const cb = wv.querySelector('#init-create-api-btn'); if (cb) cb.onclick = function () { this.blur(); window.open('https://www.torn.com/preferences.php#tab=api?step=addNewKey&user=basic,battlestats,log&faction=rankedwars&logIds=54,50,23,6,52,56,3&title=BigBlackGymLog', '_blank'); }; const rib = wv.querySelector('#init-returning-import-btn'),
    rif = wv.querySelector('#init-import-file'); if (rib && rif) rib.onclick = function () { this.blur(); rif.click(); }; if (rif) rif.onchange = e => { const f = e.target.files[0]; if (f) app.importDataFromWelcome(f); }; app.refreshInitMask(wv); } tp.style.display = 'none'; bp.style.display = 'none'; } else if (tgt === 'settings') { sp.classList.add('active-view'); tp.style.display = 'none'; bp.style.display = 'none'; const ki = document.getElementById('set-api-key'); if (ki) ki.value = userConfig.apiKey || ''; const at = document.getElementById('set-anim-toggle'); if (at) at.checked = userConfig.animations; const rt = document.getElementById('set-rate-toggle'); if (rt) rt.checked = userConfig.ratesEnabled; const ls = document.getElementById('set-loc-select'); if (ls) ls.value = userConfig.buttonLocation; app.refreshDemoMasks(); } else if (tgt === 'graph') { tp.classList.add('viewing-graph'); app.GraphController.restoreUi(); app.GraphController.draw(); requestAnimationFrame(() => requestAnimationFrame(() => { if (dom.topPanel && dom.topPanel.classList.contains('viewing-graph')) app.GraphController.draw(); })); } else if (tgt === 'stickers') { tp.classList.add('viewing-stickers'); app.renderStickers(); if (cm !== 'stickers' && dom.stickerSponsor && userConfig.animations) { dom.stickerSponsor.classList.remove('shimmer-once'); void dom.stickerSponsor.offsetWidth; dom.stickerSponsor.classList.add('shimmer-once'); } } else if (tgt === 'achievements') { tp.classList.add('viewing-achievements'); app.renderAchievements(); } else app.renderPanelContent(); app.renderScanOverlay(); }; if (inst) { app(); return; } if (runtime.isViewAnimating) { cel.classList.remove('bbgl-crt-out', 'bbgl-crt-in'); nel.classList.remove('bbgl-crt-out', 'bbgl-crt-in'); runtime.isViewAnimating = false; } runtime.isViewAnimating = true; if (!userConfig.animations) { app(); runtime.isViewAnimating = false; } else if (cm === 'settings') { app(); nel.classList.add('bbgl-crt-in'); setTimeout(() => { nel.classList.remove('bbgl-crt-in'); runtime.isViewAnimating = false; }, 300); } else if (tgt === 'settings') { cel.classList.add('bbgl-crt-out'); setTimeout(() => { cel.classList.remove('bbgl-crt-out'); app(); runtime.isViewAnimating = false; }, 280); } else if (tgt === 'stickers') { cel.classList.add('bbgl-crt-out'); setTimeout(() => { cel.classList.remove('bbgl-crt-out'); app(); runtime.isViewAnimating = false; }, 280); } else if (cm === 'stickers') { nel.classList.add('bbgl-crt-in'); app(); setTimeout(() => { nel.classList.remove('bbgl-crt-in'); runtime.isViewAnimating = false; }, 300); } else { cel.classList.add('bbgl-crt-out'); setTimeout(() => { cel.classList.remove('bbgl-crt-out'); nel.classList.add('bbgl-crt-in'); app(); setTimeout(() => { nel.classList.remove('bbgl-crt-in'); runtime.isViewAnimating = false; }, 300); }, 280); } }

function closePanel(e) { if (e) e.stopPropagation(); if (runtime.isClosing) return; const p = dom.panel, b = dom.gymTab; if (!p) return; runtime.isClosing = true; viewState.isOpen = false; viewState.isTall = false; viewState.subView = 'ledger'; viewState.activeViewLabel = null; viewState.achEnhPeriodMode = false; viewState.graphStats = undefined; viewState.graphMode = undefined; runtime.currentStickerPage = 0; viewState.currentStickerPage = 0; const _n = TimeManager.now(); viewState.calYear = _n.year; viewState.calMonth = _n.month; saveViewState(); const sp = dom.settingsView, tp = dom.topPanel, bp = dom.bottomPanel, wv = dom.welcomeView; if (sp) sp.classList.remove('active-view'); if (wv) wv.classList.remove('active-view'); if (tp) { tp.style.display = 'flex'; tp.classList.remove('viewing-graph', 'viewing-stickers', 'viewing-achievements'); } if (bp) bp.style.display = 'flex'; app.closeItemViewer(false); calendarState.year = viewState.calYear; calendarState.month = viewState.calMonth; calendarState.selectedData = null; calendarState.selectedLabel = null; app.renderPanelContent(); if (b) b.classList.remove('bbgl-tab-active'); updateTransformOrigin(); p.classList.remove('bbgl-animate-pop'); p.classList.remove('bbgl-tall'); const tt = dom.tallToggle; if (tt) tt.innerText = "+"; if (userConfig.animations) { p.classList.add('bbgl-animate-vanish'); setTimeout(() => { p.style.display = 'none'; p.classList.remove('bbgl-animate-vanish'); runtime.isClosing = false; app.handleLayout(); }, 300); } else { p.style.display = 'none'; runtime.isClosing = false; app.handleLayout(); } }

function toggleTall() { const p = dom.panel, b = dom.tallToggle; if (p.classList.contains('bbgl-mode-page')) return; p.classList.toggle('bbgl-tall'); const t = p.classList.contains('bbgl-tall'); b.innerText = t ? "–" : "+"; viewState.isTall = t; saveViewState(); const tp = dom.topPanel; if (!t) { if (tp.classList.contains('viewing-graph') || tp.classList.contains('viewing-stickers') || tp.classList.contains('viewing-achievements')) switchView('ledger'); } else { if (tp.classList.contains('viewing-graph')) { app.GraphController.draw(); setTimeout(app.GraphController.draw, 320); } } }

function toggleLedgerView() { switchView('ledger'); saveViewState(); }

function toggleGraphView() { switchView('graph'); saveViewState(); }

function toggleSettingsView(e) { if (e) e.stopPropagation(); const sp = dom.settingsView, tp = dom.topPanel, vp = dom.itemViewer; if (sp.classList.contains('active-view')) { let t = runtime.returnView || 'ledger'; if (t === 'viewer') { switchView('stickers'); viewState.subView = 'stickers'; if (viewState.activeItemId) setTimeout(() => { if (!runtime.stickerData.length) app.loadStickerData(); const i = runtime.stickerData.find(x => x.id === viewState.activeItemId); if (i) app.openItemViewer(i, false); }, 50); } else { switchView(t); viewState.subView = t; } } else { if (vp && vp.classList.contains('active')) runtime.returnView = 'viewer';else if (tp.classList.contains('viewing-graph')) runtime.returnView = 'graph';else if (tp.classList.contains('viewing-stickers')) runtime.returnView = 'stickers';else if (tp.classList.contains('viewing-achievements')) runtime.returnView = 'achievements';else runtime.returnView = 'ledger'; switchView('settings'); viewState.subView = 'settings'; } saveViewState(); }

function updateTransformOrigin() { const p = dom.panel, b = dom.gymTab; if (!p || !b) { runtime.transformOriginRetries = 0; return; } const pr = p.getBoundingClientRect(), br = b.getBoundingClientRect(); if (pr.width === 0 || pr.height === 0) { runtime.transformOriginRetries = (runtime.transformOriginRetries || 0) + 1; if (runtime.transformOriginRetries > 30) { runtime.transformOriginRetries = 0; return; } window.requestAnimationFrame(updateTransformOrigin); return; } runtime.transformOriginRetries = 0; const cx = br.left + br.width / 2, cy = br.top + br.height / 2; p.style.transformOrigin = `${cx - pr.left}px ${cy - pr.top}px`; }

app.cacheDOM = cacheDOM;
app.togglePanel = togglePanel;
app.restoreInternalState = restoreInternalState;
app.switchView = switchView;
app.closePanel = closePanel;
app.toggleTall = toggleTall;
app.toggleLedgerView = toggleLedgerView;
app.toggleGraphView = toggleGraphView;
app.toggleSettingsView = toggleSettingsView;
app.updateTransformOrigin = updateTransformOrigin;
export { cacheDOM, togglePanel, restoreInternalState, switchView, closePanel, toggleTall, toggleLedgerView, toggleGraphView, toggleSettingsView, updateTransformOrigin };

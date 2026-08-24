import { app } from '../app-context.js';
import { ICONS } from '../ui/icons.ts';
import {
  ACH_FMT, BACKFILL, BACKFILL_GROUP_KEYS, BACKFILL_GROUP_OF, BACKFILL_GROUPS,
  BASE_DOCS_URL, BBGL_ERROR_CODE, BS_STAT_ROWS, compareVersions, CONSTANTS, ECAN_LOG, ECSTASY_LOG, ENERGY_LOGS, ENERGY_PARAM,
  EX_OD_LOG, GAME, GYM_TIERS, HAPPY_LOGS, ITEM_GROUP_LABELS, ITEM_LOG_META, ITEM_LOGS, KEYS, LAYOUT, LSD_OD_LOG,
  MSG_CLIPBOARD_DENIED, MSG_KEY_FORMAT_INVALID, MSG_KEY_NETWORK_ERROR, MSG_SYNC_NETWORK_ERROR, MSG_SYNC_QUOTA,
  OD_LOGS, r2, SCRIPT_VERSION, STAT_ENHANCER_PARAM, STAT_HAPPY_PARAM, STAT_KEYS, STAT_LOGS, SYNC_FROM_BUFFER,
  TORN_KEY_ERROR_MAP, TRAIN_ENERGY_PARAM, TRAIN_LOGS, WIPE_BELOW_VERSION, XANAX_LOG, XANAX_OD_LOG, ZERO_BREAKDOWN,
  bbglError, tornKeyErrorText
} from '../core/constants.ts';
import { Log, Perf } from '../core/log.ts';
import {
  ALLOWED_CONFIG_KEYS, TAB_ID, calendarState, dom, graphState, historyCache, lastButtonLocation, layoutObservers,
  refreshClickLog, runtime, saveConfig, saveViewState, setHistoryCache, setLastButtonLocation, setTopCeiling, setViewState,
  topCeilingCache, topCeilingTs, userConfig, viewState
} from '../core/state.ts';
import { Formatter, TimeManager, getISOWeek, getWeekKey } from '../domain/time.ts';

const SCAN_PAUSE_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`;

const SCAN_PLAY_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;

let _scanOverlayTimer = null;

let _scanOverlayKey = null;

let _scanCancelConfirm = false;

function updateScanOverlayCount(n) { const el = document.querySelector('#bbgl-scan-count'); if (el) el.textContent = String(n); }

function currentScanState() { if (runtime.demoMode) return { key: null, ds: null }; const s = app.getActiveHistory(); const ds = s && s.meta && s.meta.backfill; if (!ds) return { key: null, ds: null }; const lockFresh = ds.lock && Date.now() - ds.lock < BACKFILL.LOCK_STALE_MS; let key = null; if (runtime.backfilling) key = _scanCancelConfirm ? 'confirm' : 'scanning';else if (lockFresh && ds.lockOwner !== TAB_ID) key = 'passenger';else if (ds.acknowledged === false) { if (ds.lastResult === 'complete') key = 'complete';else if (ds.stopReason === 'cap') key = 'cap';else if (ds.stopReason === 'paused') key = 'paused';else if (ds.stopReason === 'interrupted') key = 'interrupted';else key = 'error'; } return { key, ds }; }

function buildScanOverlayInner(key, ds) { const cancelX = `<div id="bbgl-scan-cancel">Cancel</div>`; switch (key) { case 'settings': return `<div class="bbgl-scan-title">Scan in Progress</div><div class="bbgl-scan-sub">Settings are locked while Big Black Backfill runs. Head back to the log to pause or check progress.</div>`; case 'scanning': return `${cancelX}<div class="bbgl-scan-title-row"><div class="bbgl-scan-title">Scanning&hellip;</div><div id="bbgl-scan-pause" class="bbgl-scan-iconbtn bbgl-scan-play bbgl-scan-title-icon" title="Pause">${SCAN_PAUSE_SVG}</div></div><div class="bbgl-scan-count-row"><span class="bbgl-scan-pulse"></span>Rows recovered so far: <span id="bbgl-scan-count" class="bbgl-scan-count">${ds && ds.rowsUsed || 0}</span></div><div class="bbgl-scan-sub">This only takes up to a few minutes. Please stay on this page until the scan completes.</div><div class="bbgl-scan-note">If you're on PC, you may continue playing in another tab, but do not close this one.</div>`; case 'confirm': return `<div class="bbgl-scan-title">Cancel this scan?</div><div class="bbgl-scan-sub">Canceling discards everything recovered during this scan. Your log since installation remains untouched.</div><div class="bbgl-scan-actions"><div id="bbgl-scan-confirm-yes" class="bbgl-scan-iconbtn bbgl-scan-yes" title="Yes, cancel">${ICONS.CHECK}</div><div id="bbgl-scan-confirm-no" class="bbgl-scan-iconbtn bbgl-scan-no" title="No, keep scanning">${ICONS.CLOSE}</div></div>`; case 'passenger': return `<div class="bbgl-scan-title">Scan Running in Another Tab</div><div class="bbgl-scan-sub">Big Black Backfill is currently active in another tab. Use that tab to pause or cancel the scan.</div>`; case 'paused': return `<div class="bbgl-scan-title-row"><div class="bbgl-scan-title">Paused</div><div id="bbgl-scan-resume" class="bbgl-scan-iconbtn bbgl-scan-play bbgl-scan-title-icon" title="Resume">${SCAN_PLAY_SVG}</div></div><div class="bbgl-scan-sub">You can resume now, or continue with what's been recovered so far.</div><div class="bbgl-scan-actions"><div id="bbgl-scan-proceed" class="bbgl-scan-textbtn bbgl-scan-primary">Continue with what's been recovered</div></div>`; case 'error': return `<div class="bbgl-scan-title-row"><div class="bbgl-scan-title">Scan Error</div><div id="bbgl-scan-resume" class="bbgl-scan-iconbtn bbgl-scan-play bbgl-scan-title-icon" title="Resume">${SCAN_PLAY_SVG}</div></div><div class="bbgl-scan-sub">A network or API error occurred. No progress was lost. Resume to keep going, or continue with what's been recovered so far.</div><div class="bbgl-scan-actions"><div id="bbgl-scan-proceed" class="bbgl-scan-textbtn bbgl-scan-primary">Continue with what's been recovered</div></div>`; case 'interrupted': return `<div class="bbgl-scan-title-row"><div class="bbgl-scan-title">Interrupted</div><div id="bbgl-scan-resume" class="bbgl-scan-iconbtn bbgl-scan-play bbgl-scan-title-icon" title="Resume">${SCAN_PLAY_SVG}</div></div><div class="bbgl-scan-sub">The tab or browser was closed before the scan finished. Your progress up to that point was saved. Resume to keep going, or continue with what's been recovered so far.</div><div class="bbgl-scan-actions"><div id="bbgl-scan-proceed" class="bbgl-scan-textbtn bbgl-scan-primary">Continue with what's been recovered</div></div>`; case 'cap': return `<div class="bbgl-scan-title">Daily Limit Reached</div><div class="bbgl-scan-sub">Torn's daily row cap has been reached. Resume from the Settings menu in 24h. Everything recovered so far is fully constructed, none of it is partial.</div><div class="bbgl-scan-actions"><div id="bbgl-scan-proceed" class="bbgl-scan-textbtn bbgl-scan-primary">Continue to Logs</div></div>`; case 'complete': return `<div class="bbgl-scan-title">Fully Backfilled!</div><div class="bbgl-scan-sub">Your training history has been fully reconstructed.</div><div class="bbgl-scan-note">Rewards and stickers only start counting from the day you began tracking, not from backfilled history.</div><div class="bbgl-scan-actions"><div id="bbgl-scan-ack" class="bbgl-scan-textbtn bbgl-scan-primary">Enter Logs</div></div>`; default: return ''; } }

function wireScanOverlay(el, key, ds) { const cancel = el.querySelector('#bbgl-scan-cancel'); if (cancel) cancel.onclick = () => { _scanCancelConfirm = true; _scanOverlayKey = null; renderScanOverlay(); }; const pause = el.querySelector('#bbgl-scan-pause'); if (pause) pause.onclick = () => { runtime.backfillAbort = 'pause'; const t = el.querySelector('.bbgl-scan-title'); if (t) t.textContent = 'Pausing…'; }; const yes = el.querySelector('#bbgl-scan-confirm-yes'); if (yes) yes.onclick = () => { runtime.backfillAbort = 'cancel'; _scanCancelConfirm = false; const t = el.querySelector('.bbgl-scan-title'); if (t) t.textContent = 'Discarding…'; }; const no = el.querySelector('#bbgl-scan-confirm-no'); if (no) no.onclick = () => { _scanCancelConfirm = false; _scanOverlayKey = null; renderScanOverlay(); }; const resume = el.querySelector('#bbgl-scan-resume'); if (resume) resume.onclick = () => { app.backfillLogs(document.getElementById('backfill-btn')); }; const proceed = el.querySelector('#bbgl-scan-proceed'); if (proceed) proceed.onclick = () => { app.proceedPartialBackfill(); }; const ack = el.querySelector('#bbgl-scan-ack'); if (ack) ack.onclick = () => { app.acknowledgeBackfill(); }; }

function renderScanOverlay() { const existing = document.getElementById('bbgl-scan-overlay'); const { key, ds } = currentScanState(); if (!key) { _scanCancelConfirm = false; _scanOverlayKey = null; if (_scanOverlayTimer) { clearInterval(_scanOverlayTimer); _scanOverlayTimer = null; } if (existing) existing.remove(); return; } if (key !== 'scanning' && key !== 'confirm') _scanCancelConfirm = false; const host = document.querySelector('#bbgl-content-wrapper'); if (!host) return; const inSettings = dom.settingsView && dom.settingsView.classList.contains('active-view'); const renderKey = inSettings ? 'settings' : key; if (existing && _scanOverlayKey === renderKey) return; _scanOverlayKey = renderKey; if (_scanOverlayTimer) { clearInterval(_scanOverlayTimer); _scanOverlayTimer = null; } const el = existing || document.createElement('div'); el.id = 'bbgl-scan-overlay'; el.innerHTML = buildScanOverlayInner(renderKey, ds); if (!existing) host.appendChild(el); wireScanOverlay(el, renderKey, ds); if (renderKey === 'passenger') { _scanOverlayTimer = setInterval(() => renderScanOverlay(), 3000); } }

app.SCAN_PAUSE_SVG = SCAN_PAUSE_SVG;
app.SCAN_PLAY_SVG = SCAN_PLAY_SVG;
app._scanOverlayTimer = _scanOverlayTimer;
app._scanOverlayKey = _scanOverlayKey;
app._scanCancelConfirm = _scanCancelConfirm;
app.updateScanOverlayCount = updateScanOverlayCount;
app.currentScanState = currentScanState;
app.buildScanOverlayInner = buildScanOverlayInner;
app.wireScanOverlay = wireScanOverlay;
app.renderScanOverlay = renderScanOverlay;
export { SCAN_PAUSE_SVG, SCAN_PLAY_SVG, _scanOverlayTimer, _scanOverlayKey, _scanCancelConfirm, updateScanOverlayCount, currentScanState, buildScanOverlayInner, wireScanOverlay, renderScanOverlay };

import { app } from '../app-context.js';
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


const _syncChannel = new BroadcastChannel('bbgl_sync');

let _xtabSyncTimer = null;

_syncChannel.onmessage = (event) => {
    if (event.data && event.data.from === TAB_ID) return;
    if (runtime.demoMode) return;
    if (_xtabSyncTimer) clearTimeout(_xtabSyncTimer);
    _xtabSyncTimer = setTimeout(async () => {
        _xtabSyncTimer = null;
        try {
            const loaded = await app.DBManager.loadHistory();
            app.DataController.hydrate(loaded);
            if (dom.panel && dom.panel.style.display !== 'none') app.renderPanelContent();
            // Keep this tab's scan mask in sync with whatever the scanning tab just persisted
            // (start / heartbeat / pause / cap / complete). Passenger tabs mask off this.
            app.renderScanOverlay();
            app.renderBackfillButton();
        } catch (e) {
            Log.warn('Cross-tab sync failed', e);
        }
    }, 200);
};
async function syncWithFeedback(mission, options = {}) {
    Perf.start('syncWithFeedback');
    const btn = dom.refreshBtn;
    if (btn) {
        btn.style.opacity = "0.4";
        if (!btn.dataset.originalText) btn.dataset.originalText = btn.innerText;
        btn.innerText = "Syncing...";
    }

    const result = await app.universalFetch(mission, { ...options, manualWars: mission !== 'TRAIN_SINGLE' });

    if (result.ok) {
        scheduleHeartbeat();
        if (btn) {
            btn.innerText = "Refreshed!";
            btn.style.color = "#43a047";
            btn.style.opacity = "1";
            if (btn.dataset.timerId) clearTimeout(btn.dataset.timerId);
            btn.dataset.timerId = setTimeout(() => {
                app.resetRefreshBtn(btn);
            }, 2000);
        }
    } else if (result.suppressed) {
        // A backfill is running and owns the daily row pool; quietly stand down, no error.
        app.resetRefreshBtn(btn);
    } else {
        bbglError("Sync Error: " + result.error);
        app.resetRefreshBtn(btn);
    }
    Perf.end('syncWithFeedback');
}


// Automatically checks for new training data every 30 minutes in the background.

function scheduleHeartbeat() {
    if (runtime.bgSyncId) clearTimeout(runtime.bgSyncId);
    const lastFull = localStorage.getItem(KEYS.LAST_SYNC);
    const elapsed = lastFull ? (Date.now() - parseInt(lastFull)) : Infinity;
    const delay = elapsed >= 1800000 ? 0 : (1800000 - elapsed);
    runtime.bgSyncId = setTimeout(async function bgSyncTick() {
        runtime.bgSyncId = null;
        await app.universalFetch('FULL_SYNC');
        scheduleHeartbeat();
    }, delay);
}


function startBackgroundSync() {
    scheduleHeartbeat();
}


// This makes sure your final gym training logs are saved even if you navigate away from the gym page.

async function checkExitSync() {
    const f = sessionStorage.getItem(KEYS.SESSION);
    if (f === 'true' && !window.location.href.includes('gym.php')) {
        sessionStorage.removeItem(KEYS.SESSION);
        await app.universalFetch('FULL_SYNC');
        scheduleHeartbeat();
    }
}


const GYM_STAT_LOGS = {
    str: '5300',
    def: '5301',
    spd: '5302',
    dex: '5303'
};

function syncSidebarState() { const a = window.location.hash.includes('gymlog'), ids = [app.SB_DESKTOP.id, app.SB_MOBILE.id, app.SB_FLYOUT.id]; const BBGL_ACTIVE = 'active___bbgl'; const probe = document.querySelector('[id^="nav-"][class*="active___"]'); if (probe && !ids.includes(probe.id)) { const real = Array.from(probe.classList).find(c => c.startsWith('active___') && c !== BBGL_ACTIVE); if (real) runtime._sidebarActiveCls = real; } const realActive = runtime._sidebarActiveCls; if (a) { ids.forEach(id => { const c = document.getElementById(id); if (!c) return; if (!c.classList.contains(BBGL_ACTIVE)) c.classList.add(BBGL_ACTIVE); if (realActive && !c.classList.contains(realActive)) c.classList.add(realActive); }); document.querySelectorAll('[id^="nav-"]').forEach(navEl => { if (ids.includes(navEl.id)) return; [navEl, ...navEl.querySelectorAll('[class*="active___"]')].forEach(el => { Array.from(el.classList).filter(cls => cls.startsWith('active___')).forEach(cls => el.classList.remove(cls)); }); }); } else { ids.forEach(id => { const c = document.getElementById(id); if (c) Array.from(c.classList).filter(cls => cls.startsWith('active___')).forEach(cls => c.classList.remove(cls)); }); } }

function getTopCeiling() { if (topCeilingCache !== null && Date.now() - topCeilingTs < 250) return topCeilingCache; let ceiling = 50; if (window.innerWidth >= 1000 || window.scrollY > 10) { setTopCeiling(ceiling, Date.now()); return ceiling; } const maxNavHeight = window.innerHeight * 0.4; for (const el of document.body.children) { if (el.id && el.id.startsWith('bbgl-')) continue; const style = window.getComputedStyle(el); if (style.position === 'fixed') { const rect = el.getBoundingClientRect(); if (rect.top < 10 && rect.bottom > ceiling && rect.bottom - rect.top < maxNavHeight) ceiling = Math.ceil(rect.bottom); } } setTopCeiling(ceiling, Date.now()); return ceiling; }

function _getLayoutWindows() { const out = new Set(); document.querySelectorAll('[class*="visible___"], [class*="opened___"]').forEach(w => { if (!w || w.id === 'bbgl-panel') return; if (w.id === 'notes_panel_button' || w.id === 'people_panel_button' || w.id === 'notes_settings_button') return; if ((w.offsetWidth || 0) < 120 || (w.offsetHeight || 0) < 120) return; out.add(w); }); return Array.from(out); }

function _syncLayoutResizeTargets(precomputedWindows) { if (!runtime.layoutResizeObserver) return; const prev = runtime._layoutResizeTargets || (runtime._layoutResizeTargets = new Set()); const next = new Set(); (precomputedWindows || _getLayoutWindows()).forEach(w => { next.add(w); if (!prev.has(w)) runtime.layoutResizeObserver.observe(w); }); prev.forEach(w => { if (!next.has(w)) { try { runtime.layoutResizeObserver.unobserve(w); } catch (_) {} prev.delete(w); } }); next.forEach(w => prev.add(w)); }

function syncChangelogNotif(active) { const ids = [app.SB_DESKTOP.id, app.SB_MOBILE.id, app.SB_FLYOUT.id]; ids.forEach(id => { const c = document.getElementById(id); if (!c) return; if (active) c.classList.add('bbgl-sb-notif');else c.classList.remove('bbgl-sb-notif'); }); }

function syncSiblingSelect(primaryId, siblingId, val) { if (!dom.panel) return; const sib = dom.panel.querySelector('#' + siblingId); if (sib && sib.value !== val) sib.value = val; }

function buildResyncBtn() { const idle = `<span class="bbgl-rs-idle"><span class="view-std">RESYNC</span><span class="view-exp">RESYNC LOG</span></span>`, syncing = `<span class="bbgl-rs-sync" style="display:none;"><span class="view-std">...</span><span class="view-exp">Syncing...</span></span>`, done = `<span class="bbgl-rs-done" style="display:none;">Resynced!</span>`; return `<button id="resync-btn" class="bbgl-tab-title-btn">${idle}${syncing}${done}</button>`; }

function buildSettingsFeaturesSection() { const bestGymGroup = app.buildToggle('set-bestgym-toggle', `<span data-tooltip-html="${app.TOOLTIPS.BEST_GYM}">BB Best Gym</span>`, 'bbgl-bestgym-lead') + app.buildToggle('set-bestgym-spec-toggle', `<span data-tooltip-html="${app.TOOLTIPS.BEST_GYM_SPEC}">Specialty Gyms</span>`, 'bbgl-subgroup-row') + app.buildToggle('set-bestgym-unpurch-toggle', `<span data-tooltip-html="${app.TOOLTIPS.BEST_GYM_UNPURCHASED}">Unpurchased Gyms</span>`, 'bbgl-subgroup-row bbgl-subgroup-row-last'); const backfillBtn = app.buildButton('backfill-btn', 'Big Black Backfill', 'purple', 'margin: 8px 10px 8px 10px; width: calc(100% - 20px); display: block;'); return app.buildSection('Big Black Features', bestGymGroup + app.buildToggle('set-rate-toggle', `<span data-tooltip-html="${app.TOOLTIPS.RATES}">Rate Displays</span>`) + app.buildToggle('set-anim-toggle', `<span data-tooltip-html="${app.TOOLTIPS.ANIM}">Animations</span>`) + app.buildRow(`<span data-tooltip-html="${app.TOOLTIPS.DRUG_TRACKER}">Drug Use Tracker</span>`, `<select id="set-drug-tracker" class="bbgl-native-select"><option value="xanax">Xanax</option><option value="lsd">LSD</option></select>`) + `<div class="bbgl-mask-host bbgl-demo-maskable" data-mask-text="Not available in demo mode">${backfillBtn}</div>`, '', buildResyncBtn()); }

function buildSettingsLogFormatSection() { return app.buildSection('Log Format', app.buildRow(`<span data-tooltip-html="${app.TOOLTIPS.LOC}">Log Access</span>`, `<select id="set-loc-select" class="bbgl-native-select"><option value="notes">Footer Tab</option><option value="sidebar">Sidebar</option><option value="both">Both</option></select>`) + app.buildRow(`<span data-tooltip-html="${app.TOOLTIPS.DAY_START}">Log Timezone</span>`, app.generateDayStartSelect('set-day-start', userConfig.dayStartMode)) + app.buildRow(`<span data-tooltip-html="${app.TOOLTIPS.WEEK_START}">Week Start</span>`, `<select id="set-week-start" class="bbgl-native-select"><option value="sun">Sun – Sat</option><option value="mon">Mon – Sun</option></select>`)); }

function buildSettingsApiSection() { const inputHTML = app.buildApiEntryField('set'); const topBtn = app.buildButton('create-api-btn', 'CREATE API KEY', '', `margin: 0 10px 0 10px; width: calc(100% - 20px); display: block; ${app.stackBtnStyle('top')}`); const stack = `<div class="bbgl-btn-grid" style="margin: 0 10px 10px 10px;">` + app.buildButton('clear-api-btn', 'CLEAR API KEY', 'red', 'border-radius: 0 0 0 5px;') + app.buildButton('updt-settings-btn', 'REGISTER API KEY', 'green', 'border-radius: 0 0 5px 0;') + `</div>`; return app.buildSection('API Access', `<div class="bbgl-mask-host bbgl-demo-maskable" data-mask-text="Not available in demo mode">${inputHTML}${topBtn}${stack}</div>`, 'margin-bottom: 5px;'); }

function buildSettingsDataSection() { const refreshBtn = app.buildButton('refresh-log-btn', 'REFRESH LOG', '', 'display: none;'); const grid = `<div class="bbgl-btn-grid" style="margin: 8px 10px 0 10px;">${app.buildButton('export-btn', 'EXPORT LOG', '', 'border-radius: 5px 0 0 0; border-bottom: none;')}${app.buildButton('import-btn', 'IMPORT LOG', '', 'border-radius: 0 5px 0 0; border-bottom: none;')}<input type="file" id="import-file" accept=".json,application/json" style="display:none"></div>`; const inner = refreshBtn + grid + app.buildButton('clear-btn', 'CLEAR LOG', 'red', 'margin: 0 10px 8px 10px; width: calc(100% - 20px); display: block; border-top-left-radius: 0; border-top-right-radius: 0;'); return app.buildSection('Data Management', `<div class="bbgl-mask-host bbgl-demo-maskable" data-mask-text="Not available in demo mode">${inner}</div>`); }

function buildSettingsInfoSection() { const authorCredit = `<div class="bbgl-settings-author-credit">By <a class="bbgl-author-link" href="https://www.torn.com/profiles.php?XID=3550896" target="_blank" rel="noopener noreferrer">BigBlackHawk</a></div>`; const guideBtn = app.buildButton('feature-guide-btn', 'FEATURE GUIDE', '', `margin: 8px 10px 0 10px; width: calc(100% - 20px); display: block; ${app.stackBtnStyle('top')}`); const stack = `<div style="margin: 0 10px 0 10px; display: flex; flex-direction: column;">` + app.buildButton('settings-changelog-btn', 'CHANGELOG', '', `width: 100%; ${app.stackBtnStyle('mid')}`) + app.buildButton('settings-privacy-btn', 'PRIVACY DISCLOSURE', '', `width: 100%; ${app.stackBtnStyle('mid')}`) + `</div>`; const demoBtn = app.buildButton('settings-demo-btn', runtime.demoMode ? 'EXIT DEMO' : 'DEMO MODE', 'purple', `margin: 0 10px 8px 10px; width: calc(100% - 20px); display: block; ${app.stackBtnStyle('bottom')}`); return app.buildSection('Information', authorCredit + guideBtn + `<div class="bbgl-mask-host bbgl-demo-maskable" data-mask-text="Not available in demo mode">${stack}</div>${demoBtn}`); }

function setResyncBtnState(btn, state) { const idle = btn.querySelector('.bbgl-rs-idle'), syncing = btn.querySelector('.bbgl-rs-sync'), done = btn.querySelector('.bbgl-rs-done'); if (idle) idle.style.display = state === 'idle' ? '' : 'none'; if (syncing) syncing.style.display = state === 'syncing' ? '' : 'none'; if (done) done.style.display = state === 'done' ? '' : 'none'; }

app._syncChannel = _syncChannel;
app._xtabSyncTimer = _xtabSyncTimer;
app.syncWithFeedback = syncWithFeedback;
app.scheduleHeartbeat = scheduleHeartbeat;
app.startBackgroundSync = startBackgroundSync;
app.checkExitSync = checkExitSync;
app.GYM_STAT_LOGS = GYM_STAT_LOGS;
app.syncSidebarState = syncSidebarState;
app.getTopCeiling = getTopCeiling;
app._getLayoutWindows = _getLayoutWindows;
app._syncLayoutResizeTargets = _syncLayoutResizeTargets;
app.syncChangelogNotif = syncChangelogNotif;
app.syncSiblingSelect = syncSiblingSelect;
app.buildResyncBtn = buildResyncBtn;
app.buildSettingsFeaturesSection = buildSettingsFeaturesSection;
app.buildSettingsLogFormatSection = buildSettingsLogFormatSection;
app.buildSettingsApiSection = buildSettingsApiSection;
app.buildSettingsDataSection = buildSettingsDataSection;
app.buildSettingsInfoSection = buildSettingsInfoSection;
app.setResyncBtnState = setResyncBtnState;
export { _syncChannel, _xtabSyncTimer, syncWithFeedback, scheduleHeartbeat, startBackgroundSync, checkExitSync, GYM_STAT_LOGS, syncSidebarState, getTopCeiling, _getLayoutWindows, _syncLayoutResizeTargets, syncChangelogNotif, syncSiblingSelect, buildResyncBtn, buildSettingsFeaturesSection, buildSettingsLogFormatSection, buildSettingsApiSection, buildSettingsDataSection, buildSettingsInfoSection, setResyncBtnState };

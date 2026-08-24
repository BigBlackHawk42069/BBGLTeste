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


function defaultBackfill() {
    return {
        targets: {},
        rowsUsed: 0,         // cumulative rows spent; resets on full completion or after a cap cooldown elapses
        cooldownUntil: 0,    // armed to now + COOLDOWN_MS at the moment the cap is hit
        lastResult: null,    // 'partial' | 'complete'
        stopReason: null,    // null | 'paused' | 'error' | 'interrupted' | 'cap' — why a partial stopped; drives masked-state copy
        completion: null,    // 'origin' | 'exhausted' (only meaningful once lastResult === 'complete')
        acknowledged: true,  // false while a masked stop-state (paused/error/cap/complete) awaits the user's dismissal
        lock: 0,             // heartbeat timestamp of the tab currently scanning; 0 = no scan running
        lockOwner: null      // TAB_ID of the scanning tab; lets any tab tell driver from passenger
    };
}


function normalizeBackfill(ds) {
    const d = defaultBackfill();
    if (ds && typeof ds === 'object') {
        if (ds.targets && typeof ds.targets === 'object') d.targets = ds.targets;
        // rowsUsed superseded the older rowsThisWindow; accept either on load.
        if (typeof ds.rowsUsed === 'number') d.rowsUsed = ds.rowsUsed;
        else if (typeof ds.rowsThisWindow === 'number') d.rowsUsed = ds.rowsThisWindow;
        if (typeof ds.cooldownUntil === 'number') d.cooldownUntil = ds.cooldownUntil;
        if (ds.lastResult === 'complete' || ds.lastResult === 'partial') d.lastResult = ds.lastResult;
        if (ds.stopReason === 'paused' || ds.stopReason === 'error' || ds.stopReason === 'interrupted' || ds.stopReason === 'cap') d.stopReason = ds.stopReason;
        if (ds.completion === 'origin' || ds.completion === 'exhausted') d.completion = ds.completion;
        if (typeof ds.acknowledged === 'boolean') d.acknowledged = ds.acknowledged;
        if (typeof ds.lock === 'number') d.lock = ds.lock;
        if (typeof ds.lockOwner === 'string') d.lockOwner = ds.lockOwner;
    }
    return d;
}


function sanitizeMeta(metaRaw) {
    const m = (metaRaw && typeof metaRaw === 'object') ? metaRaw : {};
    if (!m.baselineBreakdown) m.baselineBreakdown = {
        ...ZERO_BREAKDOWN
    };
    m.backfill = normalizeBackfill(m.backfill);
    const k = ['str', 'def', 'spd', 'dex'];
    k.forEach(key => {
        if (m.baselineBreakdown[key] !== undefined) m.baselineBreakdown[key] = parseFloat(m.baselineBreakdown[key]) || 0;
    });
    return m;
}


function sanitizeEntry(e) {
    if (e.type === 'item') {
        if (e.ts !== undefined) e.ts = parseInt(e.ts);
        if (e.energy !== undefined) e.energy = parseInt(e.energy);
        return;
    }
    if (e.ts !== undefined) e.ts = parseInt(e.ts);
    if (e.gain !== undefined) e.gain = parseFloat(e.gain);
    if (e.after !== undefined) e.after = parseFloat(e.after);
    if (e.cost !== undefined) e.cost = parseInt(e.cost);
    e.rate = (e.cost > 0) ? r2((e.gain / e.cost) * 150) : 0;
}


function sanitizeDayRecord(d) {
    if (d && Array.isArray(d.series)) d.series.forEach(sanitizeEntry);
    return d;
}


function sanitizeStorageRecord(s) {
    if (!s || typeof s !== 'object') return {
        meta: {
            baselineBreakdown: {
                ...ZERO_BREAKDOWN
            }
        },
        series: []
    };
    s.meta = sanitizeMeta(s.meta);
    if (!s.series || !Array.isArray(s.series)) s.series = [];
    s.series.forEach(sanitizeEntry);
    return s;
}


function validateImportSchema(j) {
    if (!j || typeof j !== 'object') return {
        ok: false,
        msg: "Invalid file format."
    };
    // Testing-phase reset lever (WIPE_BELOW_VERSION, 02-section-i-constants.js): once armed,
    // an export from before the cutoff can't be re-imported to resurrect pre-wipe data —
    // otherwise anyone with an old backup could bypass the forced reset entirely.
    if (WIPE_BELOW_VERSION !== '0.0.0') {
        const importedVer = (j.meta && j.meta.version) ? String(j.meta.version) : '';
        if (!importedVer || compareVersions(importedVer, WIPE_BELOW_VERSION) < 0) return {
            ok: false,
            msg: "This export is from before a required data reset and can no longer be imported. Please start tracking fresh."
        };
    }
    if (!j.storage || typeof j.storage !== 'object') return {
        ok: false,
        msg: "No training data found in file."
    };
    const s = j.storage;
    if (s.series && !Array.isArray(s.series)) return {
        ok: false,
        msg: "Training series is malformed (not an array)."
    };
    if (s.meta && s.meta.baselineBreakdown) {
        const keys = Object.keys(s.meta.baselineBreakdown);
        if (!keys.includes('str') && !keys.includes('def')) return {
            ok: false,
            msg: "Baseline stats are missing or invalid."
        };
    }
    return {
        ok: true
    };
}

app.defaultBackfill = defaultBackfill;
app.normalizeBackfill = normalizeBackfill;
app.sanitizeMeta = sanitizeMeta;
app.sanitizeEntry = sanitizeEntry;
app.sanitizeDayRecord = sanitizeDayRecord;
app.sanitizeStorageRecord = sanitizeStorageRecord;
app.validateImportSchema = validateImportSchema;
export { defaultBackfill, normalizeBackfill, sanitizeMeta, sanitizeEntry, sanitizeDayRecord, sanitizeStorageRecord, validateImportSchema };

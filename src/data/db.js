import { app } from '../app-context.js';
import { CUSTOM_STICKERS, PAGE_TITLES, cdnize } from '../ui/assets.ts';
import { ASSETS, ICONS } from '../ui/icons.ts';
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


const DBManager = {
    _db: null,
    _DB_NAME: 'bbgl_db',
    _META_STORE: 'meta',
    _DAYS_STORE: 'days',
    _META_KEY: 'meta',

    // This function sets up a private database on your browser to save your history.
    initDB() {
        return new Promise((resolve, reject) => {
            if (this._db) {
                resolve(this._db);
                return;
            }
            Perf.start('initDB');
            const req = indexedDB.open(this._DB_NAME, 2);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (db.objectStoreNames.contains('history')) db.deleteObjectStore('history');
                if (!db.objectStoreNames.contains(this._META_STORE)) db.createObjectStore(this._META_STORE);
                if (!db.objectStoreNames.contains(this._DAYS_STORE)) db.createObjectStore(this._DAYS_STORE);
            };
            req.onsuccess = (e) => {
                this._db = e.target.result;
                Perf.end('initDB');
                resolve(this._db);
            };
            req.onerror = (e) => {
                Perf.end('initDB');
                Log.error('IndexedDB open failed', e);
                reject(e);
            };
        });
    },

    async _ensureDb() {
        if (!this._db) {
            try {
                await this.initDB();
            } catch (e) {}
        }
        return this._db;
    },

    _readMeta() {
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(this._META_STORE, 'readonly');
            const req = tx.objectStore(this._META_STORE).get(this._META_KEY);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = (e) => {
                Log.error('IndexedDB read failed', e);
                reject(e);
            };
        });
    },

    _readAllDays() {
        return new Promise((resolve, reject) => {
            const out = [];
            const tx = this._db.transaction(this._DAYS_STORE, 'readonly');
            const req = tx.objectStore(this._DAYS_STORE).openCursor();
            req.onsuccess = (e) => {
                const cur = e.target.result;
                if (cur) {
                    out.push(cur.value);
                    cur.continue();
                } else resolve(out);
            };
            req.onerror = (e) => {
                Log.error('IndexedDB read failed', e);
                reject(e);
            };
        });
    },

    // Saves your gym data to your browser's private storage.
    _persist(meta, dayObjs, replaceAll) {
        return new Promise((resolve, reject) => {
            if (!this._db) {
                reject(new Error("Database not initialized"));
                return;
            }
            try {
                const tx = this._db.transaction([this._META_STORE, this._DAYS_STORE], 'readwrite');
                const dayStore = tx.objectStore(this._DAYS_STORE);
                if (replaceAll) dayStore.clear();
                tx.objectStore(this._META_STORE).put(meta || {}, this._META_KEY);
                (dayObjs || []).forEach(d => {
                    if (d && d.date) dayStore.put(d, d.date);
                });
                tx.oncomplete = () => {
                    // This tells other open tabs that your data has been updated.
                    app._syncChannel.postMessage({
                        type: 'update',
                        from: TAB_ID
                    });
                    resolve();
                };
                tx.onerror = (e) => {
                    const err = e.target.error;
                    Log.error('IndexedDB write failed', err);
                    if (err && err.name === 'QuotaExceededError') {
                        bbglError("⚠️ STORAGE ERROR: Browser quota exceeded.\n\nYour data could not be saved. Please export your history and then 'Clear Data' to free up space.");
                    }
                    reject(err);
                };
            } catch (e) {
                reject(e);
            }
        });
    },

    // Loads your complete gym history from your browser's private storage.
    async loadHistory() {
        await this._ensureDb();
        if (!this._db) return null;
        const [metaRaw, days] = await Promise.all([this._readMeta(), this._readAllDays()]);
        if (metaRaw === null && days.length === 0) return null;
        const meta = app.sanitizeMeta(metaRaw);
        days.forEach(app.sanitizeDayRecord);
        const logicalToday = Formatter.dateLogical();
        let today = null;
        const history = [];
        days.forEach(d => {
            if (d.date === logicalToday) today = d;
            else if ((d.series && d.series.length > 0) || (d.gains && d.gains.total > 0)) history.push(d);
        });
        history.sort((a, b) => a.date.localeCompare(b.date));
        if (!today) {
            const carry = history.length > 0 ? history[history.length - 1].endBreakdown : meta.baselineBreakdown;
            today = initializeDayObject(logicalToday, { ...(carry || ZERO_BREAKDOWN) });
        }
        return { meta, history, today };
    },

    // Saves your latest gym session to your browser.
    async saveDays(meta, dayObjs) {
        await this._ensureDb();
        return this._persist(meta, dayObjs, false);
    },

    // Packages your gym history for export.
    async getStorage() {
        await this._ensureDb();
        if (!this._db) return null;
        const [metaRaw, days] = await Promise.all([this._readMeta(), this._readAllDays()]);
        if (metaRaw === null && days.length === 0) return app.sanitizeStorageRecord(null);
        const series = [];
        days.forEach(d => {
            if (d && Array.isArray(d.series) && d.series.length > 0) {
                for (const e of d.series) series.push(e);
            } else if (d && d.gains && d.gains.total > 0) {
                const base = Formatter.parse(d.date);
                const ts = Math.floor(base.getTime() / 1000) + 43200;
                STAT_KEYS.forEach(stat => {
                    const gain = (d.gains && d.gains[stat]) || 0;
                    const cost = (d.eSpent && d.eSpent[stat]) || 0;
                    const after = (d.endBreakdown && d.endBreakdown[stat]) || 0;
                    if (gain > 0 || cost > 0) series.push({
                        ts,
                        stat,
                        gain,
                        cost,
                        after,
                        rate: cost > 0 ? r2((gain / cost) * 150) : 0,
                        synthetic: true
                    });
                });
            }
        });
        series.sort((a, b) => a.ts - b.ts);
        return app.sanitizeStorageRecord({ meta: metaRaw || {}, series });
    },

    // Restores your gym history from an imported backup file.
    async setStorage(data) {
        await this._ensureDb();
        if (!this._db) throw new Error("Database not initialized");
        const meta = (data && data.meta) || {};
        const series = (data && Array.isArray(data.series)) ? data.series : [];
        const rebuilt = app.DataController._rebuildFromSeries(series, meta.baselineBreakdown || ZERO_BREAKDOWN);
        return this._persist(meta, [...rebuilt.history, rebuilt.today], true);
    },

    // This function permanently deletes your gym history from your browser when you click 'Clear Data'.
    async clearStorage() {
        await this._ensureDb();
        return new Promise((resolve, reject) => {
            if (!this._db) {
                resolve();
                return;
            }
            const tx = this._db.transaction([this._META_STORE, this._DAYS_STORE], 'readwrite');
            const metaStore = tx.objectStore(this._META_STORE);
            metaStore.clear();
            // Re-seed rewardStartDate atomically with the wipe, in the same transaction, rather
            // than leaving meta empty until the next sync gets around to it. getInstallWeekKey()
            // treats a missing rewardStartDate as "no gating" (fail open, not fail closed) — so
            // any reward computation between a clear and the next normal sync (e.g. a Backfill
            // run from Settings right after clearing) would count pre-clear weeks as eligible
            // again. logStartDate is deliberately NOT seeded here, so the next sync still runs
            // its normal baseline-capture path (current battlestats -> baselineBreakdown).
            metaStore.put({ rewardStartDate: Math.floor(Date.now() / 1000) }, this._META_KEY);
            tx.objectStore(this._DAYS_STORE).clear();
            tx.oncomplete = () => {
                app._syncChannel.postMessage({
                    type: 'update',
                    from: TAB_ID
                });
                resolve();
            };
            tx.onerror = (e) => {
                Log.error('IndexedDB clear failed', e);
                reject(e);
            };
        });
    }
};

app.DBManager = DBManager;
export { DBManager };

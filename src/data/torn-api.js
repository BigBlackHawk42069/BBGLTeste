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

function resetRefreshBtn(btn) { if (!btn) return; if (btn.dataset.timerId) { clearTimeout(btn.dataset.timerId); delete btn.dataset.timerId; } btn.style.color = ""; btn.style.opacity = "1"; if (btn.dataset.originalText) { btn.innerText = btn.dataset.originalText; delete btn.dataset.originalText; } }

function checkRefreshCooldown(btn) { const now = Date.now(); while (refreshClickLog.length > 0 && now - refreshClickLog[0] > 60000) refreshClickLog.shift(); refreshClickLog.push(now); if (refreshClickLog.length <= 4) return false; btn.disabled = true; btn.style.opacity = '0.45'; btn.style.color = '#666'; if (!btn.dataset.originalText) btn.dataset.originalText = btn.innerText; let remaining = Math.ceil((60000 - (now - refreshClickLog[0])) / 1000); const updateTooltip = () => { btn.setAttribute('data-tooltip', app.TOOLTIPS.REFRESH_COOLDOWN(remaining)); }; updateTooltip(); const interval = setInterval(() => { remaining--; if (remaining <= 0) { clearInterval(interval); btn.disabled = false; btn.style.opacity = ''; btn.style.color = ''; btn.removeAttribute('data-tooltip'); if (btn.dataset.originalText) { btn.innerText = btn.dataset.originalText; delete btn.dataset.originalText; } refreshClickLog.length = 0; } else { updateTooltip(); } }, 1000); return true; }

function incrementApiCount(n) { runtime.apiCallTotal += n; const hud = dom.apiHud; if (hud) hud.innerHTML = `API Calls: ${runtime.apiCallTotal}`; }
async function universalFetch(mission, options = {}) {
    if (runtime.demoMode) return {
        success: false,
        demo: true
    };
    if (runtime.backfilling) return {
        ok: false,
        suppressed: true
    };
    const {
        specId = null,
        manualWars = false
    } = options;

    if (!userConfig.apiKey || userConfig.apiKey.length < 16) {
        return {
            ok: false,
            error: 'API Key is missing or too short.'
        };
    }

    const ts = Date.now();
    const meta = app.getActiveHistory().meta;
    const fromFor = key => {
        const fl = meta.syncFloor && meta.syncFloor[key];
        return fl ? `&from=${Math.max(0, fl - SYNC_FROM_BUFFER)}` : '';
    };
    let reqs = [];

    if (mission === 'TRAIN_SINGLE' && specId) {
        reqs.push({
            type: 'log',
            floorKey: 'trainEnergy',
            url: `https://api.torn.com/user/?selections=log&log=${specId},${ENERGY_PARAM}&key=${userConfig.apiKey}${fromFor('trainEnergy')}&timestamp=${ts}`
        });
    } else {
        reqs = [{
                type: 'battlestats',
                url: `https://api.torn.com/user/?selections=battlestats&key=${userConfig.apiKey}&timestamp=${ts}`
            },
            {
                type: 'log',
                floorKey: 'trainEnergy',
                url: `https://api.torn.com/user/?selections=log&log=${TRAIN_ENERGY_PARAM}&key=${userConfig.apiKey}${fromFor('trainEnergy')}&timestamp=${ts}`
            },
            {
                type: 'log',
                floorKey: 'statHappy',
                url: `https://api.torn.com/user/?selections=log&log=${STAT_HAPPY_PARAM}&key=${userConfig.apiKey}${fromFor('statHappy')}&timestamp=${ts}`
            }
        ];
    }

    incrementApiCount(reqs.length);

    // Wars runs in parallel with the main calls for FULL_SYNC — it has its own gate and
    // error handling so a failure cannot affect the main sync result.
    if (mission === 'FULL_SYNC') app.fetchWars(manualWars);

    try {
        // This safely performs the official Torn API request using your provided key.
        const res = await Promise.all(reqs.map(c => fetch(c.url).then(r => {
            if (!r.ok) {
                const se = new Error(`Torn returned an unexpected error (HTTP ${r.status}).`);
                se.isTornError = true;
                throw se;
            }
            return r.json();
        }).then(d => ({
            cfg: c,
            data: d
        }))));
        const errObj = res.find(r => r.data.error);
        if (errObj) {
            const te = new Error(tornKeyErrorText(errObj.data));
            te.isTornError = true;
            throw te;
        }

        let logs = {},
            bs = null;
        res.forEach(r => {
            if (r.data.log) logs = { ...logs, ...r.data.log };
            if (r.cfg.type === 'battlestats') bs = r.data;
        });

        const tsSec = Math.floor(ts / 1000);
        if (!meta.syncFloor) meta.syncFloor = {};
        reqs.forEach(c => {
            if (c.floorKey) meta.syncFloor[c.floorKey] = tsSec;
        });

        if (mission !== 'TRAIN_SINGLE') {
            localStorage.setItem(KEYS.LAST_SYNC, ts.toString());
        }

        // Stat enhancer check: if battlestats shows higher values than the last recorded
        // endBreakdown, stat-enhancing items were used since the last sync. Only then do we
        // fire the extra call — almost always a no-op.
        const _s = app.getActiveHistory();
        const needsEnhancers = mission === 'FULL_SYNC' && bs &&
            BS_STAT_ROWS.some(row => (bs[row.api] || 0) > (_s.today.endBreakdown[row.abbr] || 0));

        await app.DataController.processDataPayload(logs, bs);

        if (needsEnhancers) {
            try {
                incrementApiCount(1);
                const eRes = await fetch(
                    `https://api.torn.com/user/?selections=log&log=${STAT_ENHANCER_PARAM}&key=${userConfig.apiKey}${fromFor('statEnhancers')}&timestamp=${Date.now()}`
                );
                if (eRes.ok) {
                    const eData = await eRes.json();
                    if (!eData.error) {
                        meta.syncFloor.statEnhancers = tsSec;
                        await app.DataController.processDataPayload(eData.log || {}, null);
                    }
                }
            } catch (e) { Log.warn('Stat enhancer fetch failed', e); }
        }

        return {
            ok: true
        };

    } catch (e) {
        Log.error('Sync failed', e);
        const isQuota = e.name === 'QuotaExceededError' || (e.message && e.message.toLowerCase().includes('quota'));
        // Torn-tagged errors (bad HTTP status or an explicit error body) already carry a
        // tailored message via tornKeyErrorText — anything else here is a real fetch()-level
        // failure (offline, DNS, blocked, etc.), so it never leaks a raw browser exception
        // string like "Failed to fetch" to the user.
        const errorMsg = isQuota ? MSG_SYNC_QUOTA :
            e.isTornError ? e.message :
            MSG_SYNC_NETWORK_ERROR;
        return {
            ok: false,
            error: errorMsg
        };
    }
}


// This function updates the 'Refresh' button in the app while it's fetching your latest logs.


app.resetRefreshBtn = resetRefreshBtn;
app.checkRefreshCooldown = checkRefreshCooldown;
app.incrementApiCount = incrementApiCount;
app.universalFetch = universalFetch;
export { resetRefreshBtn, checkRefreshCooldown, incrementApiCount, universalFetch };

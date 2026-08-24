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
import { normalizeApiLogs } from '../domain/day.ts';



function backfillDayStart(ts) {
    return Math.floor(Formatter.parse(Formatter.dateLogical(ts * 1000)).getTime() / 1000);
}


// Seeds/repairs the two group frontiers (trainEnergy, statHappy). Any stored shape that is not

// exactly the two-group form (e.g. the older per-code frontiers) is reseeded to "now" so the

// scan restarts cleanly; already-stored rows are deduped on the way back, so a reseed is safe.

function ensureBackfillTargets(ds) {
    if (!ds.targets || typeof ds.targets !== 'object') ds.targets = {};
    const fr = ds.targets.frontiers;
    const validShape = fr && typeof fr === 'object' &&
        BACKFILL_GROUP_KEYS.every(g => fr[g] && typeof fr[g].cursor === 'number') &&
        Object.keys(fr).every(k => BACKFILL_GROUP_KEYS.includes(k));
    if (!validShape) {
        ds.targets.frontiers = {};
        const seed = Math.floor(Date.now() / 1000);
        BACKFILL_GROUP_KEYS.forEach(g => {
            ds.targets.frontiers[g] = { cursor: seed, complete: false };
        });
    }
    return ds.targets.frontiers;
}


function seriesEntryCode(e) {
    return e.type === 'item' ? String(e.logId) : app.GYM_STAT_LOGS[e.stat];
}


function computeBackfillFloor(stored, frontiers) {
    const existing = (typeof stored.meta.logStartDate === 'number') ? stored.meta.logStartDate : null;
    if (!stored.series.length) return existing;

    // Oldest stored timestamp per scan group (gym codes -> trainEnergy, item codes per group).
    const perGroupOldest = {};
    stored.series.forEach(e => {
        const code = seriesEntryCode(e);
        const g = code && BACKFILL_GROUP_OF[code];
        if (g && (perGroupOldest[g] === undefined || e.ts < perGroupOldest[g])) perGroupOldest[g] = e.ts;
    });

    // The shallowest still-incomplete group caps how far down we can trust: its oldest scanned
    // day is only partially covered, so the first trusted day is the one after it.
    let shallowPartialDayStart = null;
    Object.keys(frontiers || {}).forEach(g => {
        const fr = frontiers[g];
        if (fr && !fr.complete && perGroupOldest[g] !== undefined) {
            const dayStart = backfillDayStart(perGroupOldest[g]);
            if (shallowPartialDayStart === null || dayStart > shallowPartialDayStart) shallowPartialDayStart = dayStart;
        }
    });

    let newFloor;
    if (shallowPartialDayStart !== null) {
        newFloor = shallowPartialDayStart + 86400;
    } else {
        newFloor = backfillDayStart(stored.series[0].ts);
    }
    if (existing !== null) newFloor = Math.min(newFloor, existing);
    return newFloor;
}


// Lightweight progress checkpoint: persists ONLY the backfill state (frontiers, window budget,

// cooldown, heartbeat lock) to the meta store. No series merge, no day rebuild, no UI refresh —

// cheap enough to call on every heartbeat tick.

async function persistBackfillState(ds) {
    let meta;
    if (historyCache && historyCache.meta) {
        meta = historyCache.meta;
    } else {
        const stored = await app.DBManager.getStorage();
        meta = (stored && stored.meta) || { baselineBreakdown: { ...ZERO_BREAKDOWN } };
    }
    meta.backfill = ds;
    await app.DBManager.saveDays(meta, []);
}


// Merges a batch of freshly scanned rows into the stored series (dedup across sessions),

// recomputes the baseline and origin floor, and persists the rebuilt day objects + meta.

// Does NOT touch the in-memory cache or render — that is deferred to finalizeBackfill so the UI

// is only rebuilt once the scan stops. Returns the persisted storage record.

async function _persistBackfillSeries(ds, collected) {
    let stored = await app.DBManager.getStorage();
    if (!stored) stored = {
        meta: {
            baselineBreakdown: {
                ...ZERO_BREAKDOWN
            }
        },
        series: []
    };
    if (!Array.isArray(stored.series)) stored.series = [];

    if (collected && collected.length > 0) {
        const seenGym = new Set(stored.series.filter(e => e.type !== 'item').map(e => `${e.ts}_${e.stat}_${e.after}`));
        const itemKey = e => `${e.ts}_${e.logId}`;
        const seenItem = new Set(stored.series.filter(e => e.type === 'item').map(itemKey));
        collected.forEach(l => {
            if (l.type === 'item') {
                const key = itemKey(l);
                if (!seenItem.has(key)) {
                    seenItem.add(key);
                    const entry = {
                        ts: l.ts,
                        type: 'item',
                        id: l.id,
                        logId: l.logId
                    };
                    if (l.energy) entry.energy = l.energy;
                    if (l.energyLost != null) entry.energyLost = l.energyLost;
                    if (l.happyLost != null) entry.happyLost = l.happyLost;
                    if (l.happy) entry.happy = l.happy;
                    if (l.statKey) {
                        entry.statKey = l.statKey;
                        entry.statGain = l.statGain;
                    }
                    stored.series.push(entry);
                }
                return;
            }
            const after = r2(l.after);
            const key = `${l.ts}_${l.stat}_${after}`;
            if (!seenGym.has(key)) {
                seenGym.add(key);
                stored.series.push({
                    ts: l.ts,
                    stat: l.stat,
                    gain: r2(l.gain),
                    cost: l.cost,
                    after,
                    rate: l.cost > 0 ? r2((l.gain / l.cost) * 150) : 0
                });
            }
        });
        stored.series.sort((a, b) => a.ts - b.ts);

        const baseline = {
            ...((stored.meta && stored.meta.baselineBreakdown) || ZERO_BREAKDOWN)
        };
        STAT_KEYS.forEach(k => {
            const first = stored.series.find(e => e.stat === k);
            if (first) baseline[k] = r2(first.after - first.gain);
        });
        stored.meta.baselineBreakdown = baseline;

        stored.meta.logStartDate = computeBackfillFloor(stored, ds.targets.frontiers);
    }

    stored.meta.backfill = ds;
    await app.DBManager.setStorage(stored);
    return stored;
}


// Final save for a Deep Log Scan: persists any remaining rows, then rebuilds the in-memory

// history cache and invalidates derived caches so the UI reflects the freshly scanned history.

async function finalizeBackfill(ds, collected) {
    const stored = await _persistBackfillSeries(ds, collected);
    const rebuilt = app.DataController._rebuildFromSeries(stored.series || [], stored.meta.baselineBreakdown || ZERO_BREAKDOWN);
    setHistoryCache({
        meta: stored.meta,
        history: rebuilt.history,
        today: rebuilt.today
    });
    app.DataController.invalidate();
}


// Called when you dismiss the 'Scan Complete' confirmation after a Deep Log Scan.

async function acknowledgeBackfill() {
    if (runtime.demoMode || runtime.backfilling) return;
    const s = app.getActiveHistory();
    const ds = s.meta && s.meta.backfill;
    if (!ds || ds.lastResult !== 'complete' || ds.acknowledged !== false) return;
    ds.acknowledged = true;
    await finalizeBackfill(ds, []);
    window.dispatchEvent(new CustomEvent('bbgl:dataUpdated'));
    renderBackfillButton();
    app.renderScanOverlay();
}


// Called by 'Proceed to partial logs' on a paused/error/cap masked stop-state: the scanned rows

// are already flushed and live, so this just retires the mask. Persist + broadcast so every tab

// (and the next reload) agrees the mask is dismissed.

async function proceedPartialBackfill() {
    if (runtime.demoMode || runtime.backfilling) return;
    const s = app.getActiveHistory();
    const ds = s.meta && s.meta.backfill;
    if (!ds || ds.lastResult !== 'partial' || ds.acknowledged !== false) return;
    ds.acknowledged = true;
    try {
        await persistBackfillState(ds);
    } catch (e) {
        Log.warn('Backfill proceed save failed', e);
    }
    renderBackfillButton();
    app.renderScanOverlay();
}


// Cancel-discard: throw away the reconstructed pre-install history but keep everything tracked

// live since install. The install-time baseline is restored as (current battlestats − gains

// logged live since install), which is exact whether or not the user trained after installing.

// rowsUsed and cooldownUntil are deliberately preserved so a cancel-then-restart cannot dodge

// Torn's rolling budget. Frontiers are reseeded to "now" so a future scan re-reconstructs cleanly.

async function discardBackfillData(ds) {
    let stored = await app.DBManager.getStorage();
    if (!stored) stored = { meta: { baselineBreakdown: { ...ZERO_BREAKDOWN } }, series: [] };
    if (!Array.isArray(stored.series)) stored.series = [];
    if (!stored.meta) stored.meta = { baselineBreakdown: { ...ZERO_BREAKDOWN } };

    // Install cutoff (seconds): rewardStartDate is the fixed install anchor; fall back to
    // privacyAgreed, then to now (keeps nothing older — still safe, never over-keeps).
    let cutoff = (typeof stored.meta.rewardStartDate === 'number') ? stored.meta.rewardStartDate : null;
    if (cutoff === null) {
        const p = Date.parse(userConfig.privacyAgreed);
        cutoff = isNaN(p) ? Math.floor(Date.now() / 1000) : Math.floor(p / 1000);
    }

    // Keep only rows logged live since install; drop the reconstructed history (gym + item).
    stored.series = stored.series.filter(e => e.ts >= cutoff);

    // Restore the install-time baseline from live battlestats minus post-install live gains.
    let curStats = null;
    try {
        const res = await fetch(`https://api.torn.com/user/?selections=battlestats&key=${userConfig.apiKey}&timestamp=${Date.now()}`);
        app.incrementApiCount(1);
        const data = await res.json();
        if (!data.error) curStats = data;
    } catch (e) {
        Log.warn('Discard baseline battlestats fetch failed', e);
    }
    if (curStats) {
        const liveGain = { str: 0, def: 0, spd: 0, dex: 0 };
        stored.series.forEach(e => {
            if (e.type !== 'item' && liveGain[e.stat] !== undefined) liveGain[e.stat] += (e.gain || 0);
        });
        stored.meta.baselineBreakdown = {
            str: r2((curStats.strength || 0) - liveGain.str),
            def: r2((curStats.defense || 0) - liveGain.def),
            spd: r2((curStats.speed || 0) - liveGain.spd),
            dex: r2((curStats.dexterity || 0) - liveGain.dex)
        };
    }
    // else: keep the existing baseline (best effort) rather than zeroing real data.

    // Reseed both frontiers to "now" so a future scan restarts from scratch.
    ds.targets = {};
    ensureBackfillTargets(ds);

    // Undo backfill's backward push of the origin floor.
    stored.meta.logStartDate = cutoff;

    // Preserve anti-abuse budget; clear the masked flow.
    ds.lastResult = null;
    ds.stopReason = null;
    ds.completion = null;
    ds.acknowledged = true;
    ds.lock = 0;
    ds.lockOwner = null;
    stored.meta.backfill = ds;

    await app.DBManager.setStorage(stored);

    const rebuilt = app.DataController._rebuildFromSeries(stored.series || [], stored.meta.baselineBreakdown || ZERO_BREAKDOWN);
    setHistoryCache({ meta: stored.meta, history: rebuilt.history, today: rebuilt.today });
    app.DataController.invalidate();
}


// One backward log page for a group, with a changing &timestamp cache-buster. Torn's ~29s API

// cache is NOT keyed on `to`, so without this a rapid sequence of paged calls can return a stale

// (even empty) earlier response; the buster guarantees each page is fresh.

async function fetchBackfillPage(param, cursor) {
    const url = `https://api.torn.com/user/?selections=log&log=${param}&key=${userConfig.apiKey}&to=${Math.floor(cursor)}&timestamp=${Date.now()}`;
    app.incrementApiCount(1);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(resp.status);
    return resp.json();
}


// Deep Log Scan: uses your API key to page back through your full training history on Torn's

// servers. Only reads gym training logs and a short list of item logs (energy cans, Xanax, ODs, etc.)

// — never reads your messages, money, or any other personal information.

async function backfillLogs(btn) {
    if (runtime.demoMode) return;
    if (!userConfig.apiKey || userConfig.apiKey.length < 16) {
        alert('API Key is missing or too short.');
        return;
    }

    if (runtime.backfilling) return;

    const s = app.getActiveHistory();
    if (!s.meta.backfill) s.meta.backfill = app.defaultBackfill();
    const ds = s.meta.backfill;
    const now = Date.now();

    // Cap cooldown gate: armed only when a previous run hit the row cap. While it is live, block.
    // Once it elapses, every counted row has aged out of Torn's rolling 24h — clear the counter
    // and the cooldown so this run starts with a full budget.
    if (ds.cooldownUntil) {
        if (now < ds.cooldownUntil) {
            renderBackfillButton();
            app.renderScanOverlay();
            return;
        }
        ds.cooldownUntil = 0;
        ds.rowsUsed = 0;
    }

    // Cross-tab guard: if another tab is mid-scan its heartbeat lock is fresh in storage. Stand
    // down quietly rather than running two scans into the same store. Read the freshest copy.
    const freshStored = await app.DBManager.getStorage();
    const liveLock = freshStored && freshStored.meta && freshStored.meta.backfill && freshStored.meta.backfill.lock;
    if (liveLock && (Date.now() - liveLock) < BACKFILL.LOCK_STALE_MS) {
        renderBackfillButton();
        app.renderScanOverlay();
        return;
    }

    // Per-run budget is whatever is left of the cap; rowsUsed persists across resumes and cancels.
    const budget = Math.max(0, BACKFILL.SOFT_CAP - (ds.rowsUsed || 0));
    if (budget <= 0) {
        // Budget already spent (e.g. resumed right at the boundary): arm the cooldown and bail.
        ds.lastResult = 'partial';
        ds.stopReason = 'cap';
        ds.acknowledged = false;
        ds.cooldownUntil = Date.now() + BACKFILL.COOLDOWN_MS;
        await persistBackfillState(ds);
        renderBackfillButton();
        app.renderScanOverlay();
        return;
    }

    const frontiers = ensureBackfillTargets(ds);

    ds.lastResult = 'partial';
    ds.stopReason = null;
    ds.acknowledged = false;
    ds.lock = Date.now();
    ds.lockOwner = TAB_ID;
    runtime.backfillAbort = null;
    await persistBackfillState(ds);
    // Flip backfilling on and raise the mask BEFORE the (potentially slow) faction fetches, so the
    // Scanning overlay shows immediately rather than briefly resolving to the Error state. Set
    // after the persist so a persist failure can't strand backfilling=true with no loop running.
    runtime.backfilling = true;
    app.renderScanOverlay();

    // Build the faction membership timeline, then fetch ranked war history for each past
    // faction. Sequential: past faction wars depend on the history being stored first.
    await app.fetchFactionHistory();
    await app.fetchPastFactionWars();

    if (btn) {
        if (!btn.dataset.originalText) btn.dataset.originalText = btn.innerText;
        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.85';
        btn.innerText = 'Scanning... 0';
    }

    let sessionRows = 0;       // rows fetched this run (failsafe against HARD_CAP)
    let stoppedEarly = false;
    let capHit = false;        // budget reached this run
    let aborted = null;        // 'pause' | 'cancel' if the user stopped the scan
    let drainDay = null;       // once the cap is hit, only finish the current day
    let pending = [];          // rows not yet flushed to storage
    let lastHeartbeat = Date.now();

    const flush = async () => {
        ds.lock = Date.now();
        ds.lockOwner = TAB_ID;
        await _persistBackfillSeries(ds, pending);
        pending = [];
        lastHeartbeat = Date.now();
    };

    try {
        while (sessionRows < BACKFILL.HARD_CAP) {
            // User-initiated stop: pause keeps what has been scanned, cancel throws it away.
            // Checked first so a stop is honored before another page is fetched.
            if (runtime.backfillAbort) {
                aborted = runtime.backfillAbort;
                break;
            }
            // Pick the still-incomplete group with the deepest (highest) cursor, honoring the
            // drain boundary so we never start a day older than the one being finished.
            let pick = null;
            BACKFILL_GROUP_KEYS.forEach(g => {
                const fr = frontiers[g];
                if (!fr || fr.complete) return;
                if (drainDay !== null && fr.cursor < drainDay) return;
                if (pick === null || fr.cursor > frontiers[pick].cursor) pick = g;
            });
            if (pick === null) break;

            const fr = frontiers[pick];
            const param = BACKFILL_GROUPS[pick];

            let data;
            try {
                data = await fetchBackfillPage(param, fr.cursor);
            } catch (netErr) {
                Log.warn('Deep scan network error', netErr);
                stoppedEarly = true;
                break;
            }
            if (data.error) {
                if (data.error.code === 14 || data.error.code === 5) {
                    stoppedEarly = true;
                    break;
                }
                throw new Error(data.error.error);
            }

            let rowKeys = data.log ? Object.keys(data.log) : [];
            if (rowKeys.length === 0) {
                // An empty page only means "nothing retrievable past here" if it is real. Confirm
                // with one cache-busted retry before trusting it, so a stale/empty cache hit can't
                // falsely declare this group complete.
                await new Promise(r => setTimeout(r, BACKFILL.THROTTLE_MS));
                let confirm;
                try {
                    confirm = await fetchBackfillPage(param, fr.cursor);
                } catch (netErr) {
                    Log.warn('Deep scan confirm network error', netErr);
                    stoppedEarly = true;
                    break;
                }
                if (confirm.error) {
                    if (confirm.error.code === 14 || confirm.error.code === 5) {
                        stoppedEarly = true;
                        break;
                    }
                    throw new Error(confirm.error.error);
                }
                const cKeys = confirm.log ? Object.keys(confirm.log) : [];
                if (cKeys.length === 0) {
                    fr.complete = true;
                    continue;
                }
                data = confirm;
                rowKeys = cKeys;
            }

            pending.push(...normalizeApiLogs(data.log));
            sessionRows += rowKeys.length;
            ds.rowsUsed = (ds.rowsUsed || 0) + rowKeys.length;

            let oldestTs = fr.cursor;
            for (const k of rowKeys) {
                const t = data.log[k].timestamp;
                if (t < oldestTs) oldestTs = t;
            }
            fr.cursor = oldestTs - 1;

            // Display the cumulative rowsUsed (survives pause/resume), not sessionRows (a
            // this-run-only counter used purely for the HARD_CAP loop failsafe below) — otherwise
            // resuming a paused scan visually resets the count to 0 instead of picking up where
            // it left off.
            if (btn) btn.innerText = `Scanning... ${ds.rowsUsed}`;
            app.updateScanOverlayCount(ds.rowsUsed);

            // Budget reached: stop STARTING new days, drain the current one across both
            // groups so the persisted boundary is a fully complete day.
            if (drainDay === null && ds.rowsUsed >= BACKFILL.SOFT_CAP) {
                capHit = true;
                let maxCursor = -Infinity;
                BACKFILL_GROUP_KEYS.forEach(g => {
                    const f = frontiers[g];
                    if (f && !f.complete && f.cursor > maxCursor) maxCursor = f.cursor;
                });
                if (maxCursor > -Infinity) drainDay = backfillDayStart(maxCursor);
            }

            // Both checkpoints are real flushes: the count-based one bounds memory, the
            // time-based one bounds data-loss on interruption. Persisting the advanced cursor
            // without the rows that advanced it (the old heartbeat path) silently dropped any
            // rows still in `pending`, since resume picks up from the persisted cursor.
            if (pending.length >= BACKFILL.CHECKPOINT_ROWS || Date.now() - lastHeartbeat >= BACKFILL.HEARTBEAT_MS) {
                await flush();
            }

            if (sessionRows >= BACKFILL.HARD_CAP) {
                stoppedEarly = true;
                break;
            }
            await new Promise(r => setTimeout(r, BACKFILL.THROTTLE_MS));
        }
    } catch (e) {
        Log.error('Deep sync failed', e);
        stoppedEarly = true;
    }

    ds.lock = 0;
    ds.lockOwner = null;

    if (aborted === 'cancel') {
        // User discarded the scan: drop unflushed rows and wipe the backfilled history, keeping
        // only rowsUsed/cooldownUntil so a restart cannot dodge the rolling budget.
        pending = [];
        runtime.backfilling = false;
        runtime.backfillAbort = null;
        try {
            await discardBackfillData(ds);
        } catch (e) {
            Log.error('Backfill discard failed', e);
        }
        window.dispatchEvent(new CustomEvent('bbgl:dataUpdated'));
        renderBackfillButton();
        app.renderScanOverlay();
        return;
    }

    const allComplete = BACKFILL_GROUP_KEYS.every(g => frontiers[g] && frontiers[g].complete);
    if (allComplete && !stoppedEarly && !aborted) {
        ds.lastResult = 'complete';
        ds.stopReason = null;
        ds.acknowledged = false;
        ds.cooldownUntil = 0;
        ds.rowsUsed = 0;
    } else {
        ds.lastResult = 'partial';
        ds.acknowledged = false;
        if (aborted === 'pause') {
            // Manual pause: keep progress, no cooldown — Resume is immediately available.
            ds.stopReason = 'paused';
        } else if (capHit || (ds.rowsUsed || 0) >= BACKFILL.SOFT_CAP) {
            // Budget spent: arm the cooldown at the moment of the cap-hit.
            ds.stopReason = 'cap';
            ds.cooldownUntil = Date.now() + BACKFILL.COOLDOWN_MS;
        } else {
            // The scan's own code caught this (network/API failure), as opposed to the tab/browser
            // closing outright (see recoverInterruptedBackfill's 'interrupted' classification).
            ds.stopReason = 'error';
        }
    }

    try {
        await finalizeBackfill(ds, pending);
    } catch (e) {
        Log.error('Deep scan save failed', e);
    } finally {
        runtime.backfilling = false;
        runtime.backfillAbort = null;
    }

    // Classify a completed scan now that the deepest rows (the final batch) are merged and the
    // baseline reflects them: reaching ~10 across every stat means we hit the account's true
    // origin; otherwise we merely exhausted the logs Torn still retains.
    if (ds.lastResult === 'complete') {
        const baseline = (historyCache && historyCache.meta && historyCache.meta.baselineBreakdown) || ZERO_BREAKDOWN;
        const reachedOrigin = STAT_KEYS.every(k => (baseline[k] || 0) <= BACKFILL.ORIGIN_MAX_STAT);
        ds.completion = reachedOrigin ? 'origin' : 'exhausted';
        try {
            await persistBackfillState(ds);
        } catch (e) {
            Log.error('Backfill completion flag save failed', e);
        }
    }

    window.dispatchEvent(new CustomEvent('bbgl:dataUpdated'));
    renderBackfillButton();
    app.renderScanOverlay();
}


// Crash/refresh recovery: on boot, a backfill heartbeat lock that has gone stale means a scan was

// interrupted (tab/browser closed outright — the running code never reached its own catch). This

// is the ONLY place that can classify that case. Release the lock and surface the interactive

// Interrupted mask (resume / proceed). A still-fresh lock means another live tab owns the scan, so

// we leave it be. A cleanly completed-but-unacknowledged scan is left untouched.

async function recoverInterruptedBackfill() {
    if (runtime.demoMode || runtime.backfilling) return;
    const s = app.getActiveHistory();
    const ds = s.meta && s.meta.backfill;
    if (!ds || !ds.lock) return;
    if ((Date.now() - ds.lock) <= BACKFILL.LOCK_STALE_MS) return;
    ds.lock = 0;
    ds.lockOwner = null;
    if (ds.lastResult !== 'complete') {
        ds.lastResult = 'partial';
        // Preserve a cap stop (its cooldown is real); otherwise this lock only goes stale when the
        // tab/browser closed outright, distinct from an in-session network/API error (see the
        // 'error' branch in the live finalize path above).
        if (ds.stopReason !== 'cap') ds.stopReason = 'interrupted';
        ds.acknowledged = false;
    }
    try {
        await persistBackfillState(ds);
    } catch (e) {
        Log.warn('Backfill lock recovery save failed', e);
    }
}


/**
 *  [SECTION V] THE EXERCISE (Data Logic)
 *  ========================================================================
 *  Reps. Sets. Rest. Repeat. Shower.
 *  Raw inputs go in and warm, gooey data comes out.
 */


function buildBackfillChoiceModalHTML() { const intro = `<div style="padding:6px 4px 14px; color:#ccc; font-size:12px; line-height:1.6; text-align:center;">Start tracking now with no log history, or use Big Black Backfill to reconstruct your training history from Torn's logs. You can always get Big Black Backfilled later from the Settings.</div>`; const buttons = `<div style="display:flex; gap:0; margin:0 6px 2px;">${app.buildButton('bbgl-choice-fresh-btn', 'START EMPTY LOG', '', 'flex:1; border-radius:4px 0 0 4px; margin:0;')}${app.buildButton('bbgl-choice-backfill-btn', 'BIG BLACK BACKFILL', 'purple', 'flex:1; border-radius:0 4px 4px 0; margin:0;')}</div>`; return `<div class="bbgl-modal-overlay" id="bbgl-choice-modal"><div class="bbgl-modal-window"><div class="close-settings-btn bbgl-close-x" id="bbgl-choice-close" title="Close">${ICONS.CLOSE}</div>${app.buildSection('Start Tracking', intro + buttons, 'margin-bottom:8px;')}</div></div>`; }

function closeBackfillChoiceModal() { const m = document.getElementById('bbgl-choice-modal'); if (m && m.parentNode) m.parentNode.removeChild(m); }

function openBackfillChoiceModal() { if (runtime.demoMode) return; closeBackfillChoiceModal(); document.body.insertAdjacentHTML('beforeend', buildBackfillChoiceModalHTML()); const modal = document.getElementById('bbgl-choice-modal'); if (!modal) return; const close = () => { closeBackfillChoiceModal(); app.switchView('ledger'); }; modal.querySelector('#bbgl-choice-close').onclick = close; modal.onclick = e => { if (e.target === modal) close(); }; const fresh = modal.querySelector('#bbgl-choice-fresh-btn'); if (fresh) fresh.onclick = function () { this.blur(); close(); }; const bf = modal.querySelector('#bbgl-choice-backfill-btn'); if (bf) bf.onclick = function () { this.blur(); close(); backfillLogs(document.getElementById('backfill-btn')); }; }

let _backfillCountdownId = null;

function formatCountdown(ms) { const total = Math.max(0, Math.ceil(ms / 1000)); const h = Math.floor(total / 3600), m = Math.floor(total % 3600 / 60), s = total % 60; const pad = n => String(n).padStart(2, '0'); return `${pad(h)}:${pad(m)}:${pad(s)}`; }

function startBackfillFromSettings() { if (runtime.demoMode) return; app.switchView('ledger'); backfillLogs(document.getElementById('backfill-btn')); }

const BACKFILL_IDLE_LABEL = 'Big Black Backfill';

const BACKFILL_RESUME_LABEL = '<span class="view-std">Resume BB Backfill</span><span class="view-exp">Resume Big Black Backfill</span>';

const BACKFILL_CONFIRM_LABEL = 'Tap Again to Confirm';

let _backfillConfirmTimeout = null;

function armBackfillConfirm(btn, onConfirm) { if (_backfillConfirmTimeout) clearTimeout(_backfillConfirmTimeout); btn.innerHTML = BACKFILL_CONFIRM_LABEL; btn.onclick = function () { this.blur(); if (_backfillConfirmTimeout) { clearTimeout(_backfillConfirmTimeout); _backfillConfirmTimeout = null; } onConfirm(); }; _backfillConfirmTimeout = setTimeout(() => { _backfillConfirmTimeout = null; renderBackfillButton(); }, 4000); }

function renderBackfillButton() { const btn = document.getElementById('backfill-btn'); if (!btn) return; if (_backfillCountdownId) { clearInterval(_backfillCountdownId); _backfillCountdownId = null; } if (_backfillConfirmTimeout) { clearTimeout(_backfillConfirmTimeout); _backfillConfirmTimeout = null; } btn.disabled = false; btn.style.pointerEvents = ''; btn.style.opacity = ''; btn.style.color = ''; btn.removeAttribute('data-tooltip'); delete btn.dataset.originalText; btn.onclick = null; if (runtime.demoMode) return; const s = app.getActiveHistory(); const ds = s.meta && s.meta.backfill; if (runtime.backfilling || ds && ds.acknowledged === false) { btn.style.opacity = '0.6'; btn.style.pointerEvents = 'none'; btn.innerHTML = ds && ds.lastResult === 'partial' ? BACKFILL_RESUME_LABEL : BACKFILL_IDLE_LABEL; return; } if (ds && ds.lastResult === 'partial' && ds.cooldownUntil && Date.now() < ds.cooldownUntil) { btn.style.opacity = '0.6'; btn.disabled = true; btn.innerHTML = BACKFILL_RESUME_LABEL; const updateTooltip = () => { const remaining = ds.cooldownUntil - Date.now(); btn.setAttribute('data-tooltip', app.app.TOOLTIPS.BACKFILL_RESUME_COOLDOWN(formatCountdown(Math.max(0, remaining)))); }; updateTooltip(); _backfillCountdownId = setInterval(() => { if (Date.now() >= ds.cooldownUntil) { clearInterval(_backfillCountdownId); _backfillCountdownId = null; renderBackfillButton(); return; } updateTooltip(); }, 1000); return; } if (ds && ds.lastResult === 'partial') { btn.innerHTML = BACKFILL_RESUME_LABEL; btn.onclick = function () { this.blur(); armBackfillConfirm(btn, () => startBackfillFromSettings()); }; return; } if (ds && ds.lastResult === 'complete') { btn.style.color = '#69f0ae'; btn.innerHTML = 'Fully Backfilled!'; btn.setAttribute('data-tooltip', ds.completion === 'exhausted' ? app.app.TOOLTIPS.BACKFILL_COMPLETE_EXHAUSTED : app.app.TOOLTIPS.BACKFILL_COMPLETE_ORIGIN); btn.onclick = function () { this.blur(); armBackfillConfirm(btn, () => startBackfillFromSettings()); }; return; } btn.innerHTML = BACKFILL_IDLE_LABEL; btn.onclick = function () { this.blur(); armBackfillConfirm(btn, () => startBackfillFromSettings()); }; }

app.backfillDayStart = backfillDayStart;
app.ensureBackfillTargets = ensureBackfillTargets;
app.seriesEntryCode = seriesEntryCode;
app.computeBackfillFloor = computeBackfillFloor;
app.persistBackfillState = persistBackfillState;
app._persistBackfillSeries = _persistBackfillSeries;
app.finalizeBackfill = finalizeBackfill;
app.acknowledgeBackfill = acknowledgeBackfill;
app.proceedPartialBackfill = proceedPartialBackfill;
app.discardBackfillData = discardBackfillData;
app.fetchBackfillPage = fetchBackfillPage;
app.backfillLogs = backfillLogs;
app.recoverInterruptedBackfill = recoverInterruptedBackfill;
app.buildBackfillChoiceModalHTML = buildBackfillChoiceModalHTML;
app.closeBackfillChoiceModal = closeBackfillChoiceModal;
app.openBackfillChoiceModal = openBackfillChoiceModal;
app._backfillCountdownId = _backfillCountdownId;
app.formatCountdown = formatCountdown;
app.startBackfillFromSettings = startBackfillFromSettings;
app.BACKFILL_IDLE_LABEL = BACKFILL_IDLE_LABEL;
app.BACKFILL_RESUME_LABEL = BACKFILL_RESUME_LABEL;
app.BACKFILL_CONFIRM_LABEL = BACKFILL_CONFIRM_LABEL;
app._backfillConfirmTimeout = _backfillConfirmTimeout;
app.armBackfillConfirm = armBackfillConfirm;
app.renderBackfillButton = renderBackfillButton;
export { backfillDayStart, ensureBackfillTargets, seriesEntryCode, computeBackfillFloor, persistBackfillState, _persistBackfillSeries, finalizeBackfill, acknowledgeBackfill, proceedPartialBackfill, discardBackfillData, fetchBackfillPage, backfillLogs, recoverInterruptedBackfill, buildBackfillChoiceModalHTML, closeBackfillChoiceModal, openBackfillChoiceModal, _backfillCountdownId, formatCountdown, startBackfillFromSettings, BACKFILL_IDLE_LABEL, BACKFILL_RESUME_LABEL, BACKFILL_CONFIRM_LABEL, _backfillConfirmTimeout, armBackfillConfirm, renderBackfillButton };

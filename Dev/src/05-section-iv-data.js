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
                        _syncChannel.postMessage({
                            type: 'update',
                            from: _TAB_ID
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
            const meta = sanitizeMeta(metaRaw);
            days.forEach(sanitizeDayRecord);
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
            if (metaRaw === null && days.length === 0) return sanitizeStorageRecord(null);
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
            return sanitizeStorageRecord({ meta: metaRaw || {}, series });
        },

        // Restores your gym history from an imported backup file.
        async setStorage(data) {
            await this._ensureDb();
            if (!this._db) throw new Error("Database not initialized");
            const meta = (data && data.meta) || {};
            const series = (data && Array.isArray(data.series)) ? data.series : [];
            const rebuilt = DataController._rebuildFromSeries(series, meta.baselineBreakdown || ZERO_BREAKDOWN);
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
                    _syncChannel.postMessage({
                        type: 'update',
                        from: _TAB_ID
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

    const _syncChannel = new BroadcastChannel('bbgl_sync');
    let _xtabSyncTimer = null;
    _syncChannel.onmessage = (event) => {
        if (event.data && event.data.from === _TAB_ID) return;
        if (runtime.demoMode) return;
        if (_xtabSyncTimer) clearTimeout(_xtabSyncTimer);
        _xtabSyncTimer = setTimeout(async () => {
            _xtabSyncTimer = null;
            try {
                const loaded = await DBManager.loadHistory();
                DataController.hydrate(loaded);
                if (dom.panel && dom.panel.style.display !== 'none') renderPanelContent();
                // Keep this tab's scan mask in sync with whatever the scanning tab just persisted
                // (start / heartbeat / pause / cap / complete). Passenger tabs mask off this.
                renderScanOverlay();
                renderBackfillButton();
            } catch (e) {
                Log.warn('Cross-tab sync failed', e);
            }
        }, 200);
    };

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
            lockOwner: null      // _TAB_ID of the scanning tab; lets any tab tell driver from passenger
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

    async function fetchWars(manual) {
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
        const lastSync = parseInt(localStorage.getItem(KEYS.WARS_SYNC) || '0');
        if (!manual && (Date.now() - lastSync) < TWENTY_FOUR_HOURS) return;
        try {
            // user/?selections=faction is API v2-only (v1 returns error code 23), so the faction
            // ID has to come from the same v1 faction/rankedwars request via the "basic" selection.
            incrementApiCount(1);
            const res = await fetch(`https://api.torn.com/faction/?selections=rankedwars,basic&key=${userConfig.apiKey}`);
            if (!res.ok) return;
            const data = await res.json();
            if (data.error) return;
            const wars = data.rankedwars || {};
            // Resolve the player's current faction ID to tag each war with win/loss outcome.
            const myFactionId = data.ID || null;
            if (myFactionId) {
                Object.values(wars).forEach(w => {
                    if (!w || !w.war) return;
                    if (w.war.end && w.war.winner != null) {
                        w.outcome = w.war.winner === myFactionId ? 'won' : 'lost';
                    }
                    // Tag each war with the faction it belongs to for membership filtering.
                    w.factionId = myFactionId;
                });
            }
            localStorage.setItem(KEYS.WARS_DATA, JSON.stringify(wars));
            localStorage.setItem(KEYS.WARS_SYNC, Date.now().toString());
        } catch (e) {
            Log.error('Wars fetch failed', e);
        }
    }

    // Fetches log 6253 ("faction application accept receive") and stores a membership timeline.
    // Only called once at the start of backfill — historical data, not needed on every sync.
    async function fetchFactionHistory() {
        try {
            incrementApiCount(1);
            const res = await fetch(`https://api.torn.com/user/?selections=log&log=6253&key=${userConfig.apiKey}`);
            if (!res.ok) return;
            const data = await res.json();
            if (data.error) return;
            const joinEvents = Object.values(data.log || {})
                .filter(e => e && e.data && e.data.faction && e.timestamp)
                .sort((a, b) => a.timestamp - b.timestamp);
            const factionHistory = joinEvents.map((e, i) => ({
                factionId: e.data.faction,
                joinedAt: e.timestamp,
                leftAt: joinEvents[i + 1] ? joinEvents[i + 1].timestamp : null
            }));
            localStorage.setItem(KEYS.FACTION_HISTORY, JSON.stringify(factionHistory));
        } catch (e) {
            Log.warn('Faction history fetch failed', e);
        }
    }

    // Parses and returns the stored faction membership timeline, or null if absent/malformed.
    function getFactionHistory() {
        try {
            const raw = localStorage.getItem(KEYS.FACTION_HISTORY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    // Fetches ranked war history for each past faction in the membership timeline and merges
    // it into WARS_DATA. Called once per backfill — current faction is handled by fetchWars.
    async function fetchPastFactionWars() {
        const factionHistory = getFactionHistory();
        if (!factionHistory || !factionHistory.length) return;
        const pastFactions = factionHistory.filter(m => m.leftAt !== null);
        if (!pastFactions.length) return;
        let wars = {};
        try { const e = localStorage.getItem(KEYS.WARS_DATA); if (e) wars = JSON.parse(e); } catch (e) { /* start fresh */ }
        for (const membership of pastFactions) {
            try {
                incrementApiCount(1);
                const res = await fetch(`https://api.torn.com/faction/${membership.factionId}?selections=rankedwars&key=${userConfig.apiKey}`);
                if (!res.ok) continue;
                const data = await res.json();
                if (data.error) continue;
                Object.entries(data.rankedwars || {}).forEach(([id, w]) => {
                    if (!w || !w.war) return;
                    if (w.war.end && w.war.winner != null)
                        w.outcome = w.war.winner === membership.factionId ? 'won' : 'lost';
                    w.factionId = membership.factionId;
                    wars[id] = w;
                });
            } catch (e) {
                Log.warn('Past faction wars fetch failed for ' + membership.factionId, e);
            }
        }
        localStorage.setItem(KEYS.WARS_DATA, JSON.stringify(wars));
    }

    // Returns true if the user was a member of the given factionId when the war ended.
    // Unknown factionIds (not in history) are allowed through — they are factions joined
    // after backfill ran, so logStartDate already floors any pre-join wars for them.
    function wasInFactionDuringWar(factionHistory, factionId, warEnd) {
        if (!factionHistory) return true;
        const intervals = factionHistory.filter(m => m.factionId === factionId);
        if (!intervals.length) return true;
        return intervals.some(m => m.joinedAt <= warEnd && (m.leftAt === null || m.leftAt > warEnd));
    }

    // This is the ONLY function that connects to the internet with your API key.
    // It strictly contacts api.torn.com to fetch your Gym training logs (Log IDs 5300-5303), a
    // fixed short list of item-use logs (Xanax, energy cans, ODs, etc. — see ITEM_LOG_META), and current stats.
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
            manualWars = false,
            silent = false
        } = options;

        if (!userConfig.apiKey || userConfig.apiKey.length < 16) {
            return {
                ok: false,
                error: 'API Key is missing or too short.'
            };
        }

        const ts = Date.now();
        const meta = getActiveHistory().meta;
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
                    // `basic` rides along in the same request — v1 takes comma-separated
                    // selections and still bills it as one call — purely to learn the player's
                    // name for the titles page. Nothing else reads it.
                    url: `https://api.torn.com/user/?selections=battlestats,basic&key=${userConfig.apiKey}&timestamp=${ts}`
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
        if (mission === 'FULL_SYNC') fetchWars(manualWars);

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
            // Name and player_id come from the `basic` selection bundled into the battlestats call
            // above. player_id seeds the deterministic per-user sticker roulette (buildProgressionCache,
            // 06-section-v-logic.js) so placement is unique per account but identical across devices.
            if (bs && bs.name) meta.playerName = bs.name;
            if (bs && bs.player_id) meta.playerId = bs.player_id;

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
            const _s = getActiveHistory();
            const needsEnhancers = mission === 'FULL_SYNC' && bs &&
                BS_STAT_ROWS.some(row => (bs[row.api] || 0) > (_s.today.endBreakdown[row.abbr] || 0));

            await DataController.processDataPayload(logs, bs, { silent });

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
                            await DataController.processDataPayload(eData.log || {}, null, { silent });
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
    async function syncWithFeedback(mission, options = {}) {
        Perf.start('syncWithFeedback');
        const btn = dom.refreshBtn;
        if (btn) {
            btn.style.opacity = "0.4";
            if (!btn.dataset.originalText) btn.dataset.originalText = btn.innerText;
            btn.innerText = "Syncing...";
        }

        const result = await universalFetch(mission, { ...options, manualWars: mission !== 'TRAIN_SINGLE' });

        if (result.ok) {
            if (btn) {
                btn.innerText = "Refreshed!";
                btn.style.color = "#43a047";
                btn.style.opacity = "1";
                if (btn.dataset.timerId) clearTimeout(btn.dataset.timerId);
                btn.dataset.timerId = setTimeout(() => {
                    resetRefreshBtn(btn);
                }, 2000);
            }
        } else if (result.suppressed) {
            // A backfill is running and owns the daily row pool; quietly stand down, no error.
            resetRefreshBtn(btn);
        } else {
            bbglError("Sync Error: " + result.error);
            resetRefreshBtn(btn);
        }
        Perf.end('syncWithFeedback');
    }

    // Conditional heartbeat: fires at most once per 20 minutes, and only while there's actually
    // a reason to — the panel is open (any mode) or the gym page's exp bar is on screen — and
    // this tab is the one being looked at. No visible surface, no fetch; tabbing away or closing
    // the panel just lets it go quiet again on its own, no separate start/stop bookkeeping needed.
    function heartbeatTick() {
        if (document.visibilityState !== 'visible') return;
        const panelOpen = dom.panel && dom.panel.style.display !== 'none';
        const onGymPage = !!document.getElementById('bbgl-gym-level-container');
        if (!panelOpen && !onGymPage) return;
        const lastFull = localStorage.getItem(KEYS.LAST_SYNC);
        const elapsed = lastFull ? (Date.now() - parseInt(lastFull)) : Infinity;
        if (elapsed < 1200000) return; // 20 minutes
        universalFetch('FULL_SYNC', { silent: true });
    }

    function startBackgroundSync() {
        if (runtime.bgSyncId) clearInterval(runtime.bgSyncId);
        runtime.bgSyncId = setInterval(heartbeatTick, 60000);
    }

    // This makes sure your final gym training logs are saved even if you navigate away from the gym page.
    async function checkExitSync() {
        const f = sessionStorage.getItem(KEYS.SESSION);
        if (f === 'true' && !window.location.href.includes('gym.php')) {
            sessionStorage.removeItem(KEYS.SESSION);
            await universalFetch('FULL_SYNC');
        }
    }

    const GYM_STAT_LOGS = {
        str: '5300',
        def: '5301',
        spd: '5302',
        dex: '5303'
    };

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
        return e.type === 'item' ? String(e.logId) : GYM_STAT_LOGS[e.stat];
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
        if (_historyCache && _historyCache.meta) {
            meta = _historyCache.meta;
        } else {
            const stored = await DBManager.getStorage();
            meta = (stored && stored.meta) || { baselineBreakdown: { ...ZERO_BREAKDOWN } };
        }
        meta.backfill = ds;
        await DBManager.saveDays(meta, []);
    }

    // Merges a batch of freshly scanned rows into the stored series (dedup across sessions),
    // recomputes the baseline and origin floor, and persists the rebuilt day objects + meta.
    // Does NOT touch the in-memory cache or render — that is deferred to finalizeBackfill so the UI
    // is only rebuilt once the scan stops. Returns the persisted storage record.
    async function _persistBackfillSeries(ds, collected) {
        let stored = await DBManager.getStorage();
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
        await DBManager.setStorage(stored);
        return stored;
    }

    // Final save for a Deep Log Scan: persists any remaining rows, then rebuilds the in-memory
    // history cache and invalidates derived caches so the UI reflects the freshly scanned history.
    async function finalizeBackfill(ds, collected) {
        const stored = await _persistBackfillSeries(ds, collected);
        const rebuilt = DataController._rebuildFromSeries(stored.series || [], stored.meta.baselineBreakdown || ZERO_BREAKDOWN);
        _historyCache = {
            meta: stored.meta,
            history: rebuilt.history,
            today: rebuilt.today
        };
        DataController.invalidate();
    }

    // Called when you dismiss the 'Scan Complete' confirmation after a Deep Log Scan.
    async function acknowledgeBackfill() {
        if (runtime.demoMode || runtime.backfilling) return;
        const s = getActiveHistory();
        const ds = s.meta && s.meta.backfill;
        if (!ds || ds.lastResult !== 'complete' || ds.acknowledged !== false) return;
        ds.acknowledged = true;
        await finalizeBackfill(ds, []);
        window.dispatchEvent(new CustomEvent('bbgl:dataUpdated'));
        renderBackfillButton();
        renderScanOverlay();
    }

    // Called by 'Proceed to partial logs' on a paused/error/cap masked stop-state: the scanned rows
    // are already flushed and live, so this just retires the mask. Persist + broadcast so every tab
    // (and the next reload) agrees the mask is dismissed.
    async function proceedPartialBackfill() {
        if (runtime.demoMode || runtime.backfilling) return;
        const s = getActiveHistory();
        const ds = s.meta && s.meta.backfill;
        if (!ds || ds.lastResult !== 'partial' || ds.acknowledged !== false) return;
        ds.acknowledged = true;
        try {
            await persistBackfillState(ds);
        } catch (e) {
            Log.warn('Backfill proceed save failed', e);
        }
        renderBackfillButton();
        renderScanOverlay();
    }

    // Cancel-discard: throw away the reconstructed pre-install history but keep everything tracked
    // live since install. The install-time baseline is restored as (current battlestats − gains
    // logged live since install), which is exact whether or not the user trained after installing.
    // rowsUsed and cooldownUntil are deliberately preserved so a cancel-then-restart cannot dodge
    // Torn's rolling budget. Frontiers are reseeded to "now" so a future scan re-reconstructs cleanly.
    async function discardBackfillData(ds) {
        let stored = await DBManager.getStorage();
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
            incrementApiCount(1);
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

        await DBManager.setStorage(stored);

        const rebuilt = DataController._rebuildFromSeries(stored.series || [], stored.meta.baselineBreakdown || ZERO_BREAKDOWN);
        _historyCache = { meta: stored.meta, history: rebuilt.history, today: rebuilt.today };
        DataController.invalidate();
    }

    // One backward log page for a group, with a changing &timestamp cache-buster. Torn's ~29s API
    // cache is NOT keyed on `to`, so without this a rapid sequence of paged calls can return a stale
    // (even empty) earlier response; the buster guarantees each page is fresh.
    async function fetchBackfillPage(param, cursor) {
        const url = `https://api.torn.com/user/?selections=log&log=${param}&key=${userConfig.apiKey}&to=${Math.floor(cursor)}&timestamp=${Date.now()}`;
        incrementApiCount(1);
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

        const s = getActiveHistory();
        if (!s.meta.backfill) s.meta.backfill = defaultBackfill();
        const ds = s.meta.backfill;
        const now = Date.now();

        // Cap cooldown gate: armed only when a previous run hit the row cap. While it is live, block.
        // Once it elapses, every counted row has aged out of Torn's rolling 24h — clear the counter
        // and the cooldown so this run starts with a full budget.
        if (ds.cooldownUntil) {
            if (now < ds.cooldownUntil) {
                renderBackfillButton();
                renderScanOverlay();
                return;
            }
            ds.cooldownUntil = 0;
            ds.rowsUsed = 0;
        }

        // Cross-tab guard: if another tab is mid-scan its heartbeat lock is fresh in storage. Stand
        // down quietly rather than running two scans into the same store. Read the freshest copy.
        const freshStored = await DBManager.getStorage();
        const liveLock = freshStored && freshStored.meta && freshStored.meta.backfill && freshStored.meta.backfill.lock;
        if (liveLock && (Date.now() - liveLock) < BACKFILL.LOCK_STALE_MS) {
            renderBackfillButton();
            renderScanOverlay();
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
            renderScanOverlay();
            return;
        }

        const frontiers = ensureBackfillTargets(ds);

        ds.lastResult = 'partial';
        ds.stopReason = null;
        ds.acknowledged = false;
        ds.lock = Date.now();
        ds.lockOwner = _TAB_ID;
        runtime.backfillAbort = null;
        await persistBackfillState(ds);
        // Flip backfilling on and raise the mask BEFORE the (potentially slow) faction fetches, so the
        // Scanning overlay shows immediately rather than briefly resolving to the Error state. Set
        // after the persist so a persist failure can't strand backfilling=true with no loop running.
        runtime.backfilling = true;
        renderScanOverlay();

        // Build the faction membership timeline, then fetch ranked war history for each past
        // faction. Sequential: past faction wars depend on the history being stored first.
        await fetchFactionHistory();
        await fetchPastFactionWars();

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
            ds.lockOwner = _TAB_ID;
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
                updateScanOverlayCount(ds.rowsUsed);

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
            renderScanOverlay();
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
            const baseline = (_historyCache && _historyCache.meta && _historyCache.meta.baselineBreakdown) || ZERO_BREAKDOWN;
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
        renderScanOverlay();
    }

    // Crash/refresh recovery: on boot, a backfill heartbeat lock that has gone stale means a scan was
    // interrupted (tab/browser closed outright — the running code never reached its own catch). This
    // is the ONLY place that can classify that case. Release the lock and surface the interactive
    // Interrupted mask (resume / proceed). A still-fresh lock means another live tab owns the scan, so
    // we leave it be. A cleanly completed-but-unacknowledged scan is left untouched.
    async function recoverInterruptedBackfill() {
        if (runtime.demoMode || runtime.backfilling) return;
        const s = getActiveHistory();
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


    /**
     *  [SECTION II] THE SUPPLEMENTS (Utility Belt)
     *  ========================================================================
     *  Your pre-workout, Xanax, and Creatine all in one section.
     */

    // Compares two 'x.y.z'-style version strings numerically, segment by segment
    // (plain string comparison breaks on e.g. "0.9.9" vs "0.9.75"). Returns -1/0/1.
    function compareVersions(a, b) {
        const pa = String(a).split('.').map(Number);
        const pb = String(b).split('.').map(Number);
        const len = Math.max(pa.length, pb.length);
        for (let i = 0; i < len; i++) {
            const na = pa[i] || 0;
            const nb = pb[i] || 0;
            if (na !== nb) return na < nb ? -1 : 1;
        }
        return 0;
    }

    const ACH_FMT = {
        compact:   [[1e6, 2], [1e4, 1]],    // 1m+ = 2dp, 10k+ = 1dp
        gains:     [[1e12, 4], [1e9, 3]],   // 1t+ = 4dp,  1b+ = 3dp
        enhancers: [[1e6, 3], [1e5, 2]],    // 1m+ = 3dp, 100k+ = 2dp
        rewards:   []                        // always full locale
        // sexiest streaks + happy hopping reference ACH_FMT.compact directly
    };

    // Single source of truth for the k/m/b/t/q abbreviation ladder - shared by
    // Formatter.abbr/axis here and by GraphController._calculateNiceScale
    // (08-section-vii-graph.js), which needs the same tier magnitudes to decide
    // gridline spacing.
    const ABBR_TIERS = [
        [1e15, 'q'],
        [1e12, 't'],
        [1e9, 'b'],
        [1e6, 'm'],
        [1e3, 'k']
    ];

    const Formatter = {
        number(n, d = 0) {
            return (n === undefined || n === null) ? '0' : n.toLocaleString('en-US', {
                minimumFractionDigits: d,
                maximumFractionDigits: d
            });
        },
        abbr(n, d = 1, strip = false) {
            if (!n && n !== 0) return '0';
            const abs = Math.abs(n);
            if (abs < 1000) return Math.trunc(n).toString();
            for (const [mag, suffix] of ABBR_TIERS) {
                if (abs >= mag) {
                    let dec = typeof d === 'function' ? d(mag, abs) : d;
                    let s = (n / mag).toFixed(dec);
                    if (strip) s = parseFloat(s).toString();
                    return s + suffix; // always lowercase
                }
            }
            return Math.floor(n).toString();
        },
        rate(n, exp = false) {
            if (!n && n !== 0) return '0';
            if (n < 1000) return this.number(n, exp ? 2 : 1);
            if (exp) return this.number(Math.floor(n), 0);
            return this.abbr(n, 1);
        },
        achAbbr(n, tiers) {
            if (!tiers || !tiers.length) return this.number(n);
            const abs = Math.abs(n);
            for (const [mag, dec] of tiers) {
                if (abs >= mag) return this.abbr(n, dec);
            }
            return this.number(n);
        },
        achDual(val, expandedTiers = ACH_FMT.compact) {
            const std = this.achAbbr(val, ACH_FMT.compact);
            const exp = this.achAbbr(val, expandedTiers);
            return `<span class="view-std">${std}</span><span class="view-exp">${exp}</span>`;
        },
        ratePct(v) {
            if (Math.abs(v) < 1000) return this.number(v, 0);
            return this.abbr(v, 2, true); // strip=true; lowercase via abbr()
        },
        dual(val, r = false) {
            let std, exp;
            if (r) {
                std = this.rate(val, false);
                exp = this.rate(val, true);
            } else {
                std = Math.abs(val) > 9999 ? this.abbr(val) : this.number(val);
                exp = (Math.abs(val) >= 1e9) ? this.abbr(val, 4) : this.number(val);
            }
            return `<span class="view-std">${std}</span><span class="view-exp">${exp}</span>`;
        },
        axis(n, forceWhole = false) {
            if (n === 0) return '0';
            if (Math.abs(n) < 1000) return (Math.round(n * 10) / 10).toString();
            if (forceWhole) return this.abbr(n, 0, false, true);
            const abs = Math.abs(n);
            const tier = ABBR_TIERS.find(t => abs >= t[0]);
            if (tier && abs / tier[0] >= 100) {
                // 100+ units of the tier: a tenths decimal is more precision than a gridline
                // needs, but dropping it entirely can hide a real difference between ticks.
                // Round to the nearest half-unit instead - shows ".5" only when the value
                // actually falls there, whole otherwise (102m, 102.5m, 103m).
                const half = Math.round((n / tier[0]) * 2) / 2;
                return (Number.isInteger(half) ? half.toString() : half.toFixed(1)) + tier[1];
            }
            // Under 100 units of the tier (1.0k-99.9k, 1.0m-99.9m, ...), the tenths decimal
            // is the only precision available at that scale, so keep it.
            return this.abbr(n, 1, false, true);
        },
        parse(s) {
            if (!s) return new Date();
            return new Date(s.includes('T') ? s : s + 'T00:00:00Z');
        },
        dateISO(y, m, d) {
            return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        },
        dateLogical(ts = null) {
            const d = ts ? new Date(ts) : new Date();
            return this.dateISO(TimeManager.year(d), TimeManager.month(d), TimeManager.date(d));
        },
        datePretty(s) {
            if (!s || s.includes('Summary')) return s;
            const p = s.split('-');
            if (p.length !== 3) return s;
            const d = this.parse(s);
            return `${CONSTANTS.MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
        },
        dateMonthDay(s) {
            if (!s) return s;
            const p = s.split('-');
            if (p.length !== 3) return s;
            const d = this.parse(s);
            return `${CONSTANTS.MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}`;
        },
        dateFull(s) {
            if (!s || s.includes('Summary')) return s;
            const p = s.split('-');
            if (p.length !== 3) return s;
            const d = this.parse(s);
            return `${CONSTANTS.MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
        }
    };
    const TooltipController = {
        el: null,
        arrow: null,
        currentTarget: null,
        init() {
            if (this.el) return;
            this.el = document.createElement('div');
            this.el.id = 'bbgl-tooltip';
            this.arrow = document.createElement('div');
            this.arrow.id = 'bbgl-tooltip-arrow';
            this.el.appendChild(this.arrow);
            document.body.appendChild(this.el);
        },
        hide() {
            if (this.el) {
                this.el.style.display = 'none';
                this.currentTarget = null;
            }
        },
        show(html, rect, forceSide) {
            if (!this.el) this.init();
            this.el.innerHTML = html;
            this.el.appendChild(this.arrow);
            this.el.style.display = 'block';
            this.el.className = '';
            const ttRect = this.el.getBoundingClientRect(),
                pad = 12,
                view = {
                    w: window.innerWidth,
                    h: window.innerHeight
                };
            let side = 'top';
            const fitsTop = (rect.top - ttRect.height - pad >= 0),
                fitsBot = (rect.bottom + ttRect.height + pad <= view.h);
            if (forceSide) side = forceSide;
            else if (fitsTop) side = 'top';
            else if (fitsBot) side = 'bottom';
            else side = 'left';
            let x = 0,
                y = 0;
            if (side === 'top') {
                x = rect.left + (rect.width / 2) - (ttRect.width / 2);
                y = rect.top - ttRect.height - pad;
            } else if (side === 'bottom') {
                x = rect.left + (rect.width / 2) - (ttRect.width / 2);
                y = rect.bottom + pad;
            } else {
                x = rect.left - ttRect.width - pad;
                y = rect.top + (rect.height / 2) - (ttRect.height / 2);
            }
            if (x < 5) x = 5;
            if (x + ttRect.width > view.w - 5) x = view.w - ttRect.width - 5;
            if (y < 5) y = 5;
            if (y + ttRect.height > view.h - 5) y = view.h - ttRect.height - 5;
            this.el.style.left = x + 'px';
            this.el.style.top = y + 'px';
            this.el.classList.add('pos-' + side);
            this.arrow.style.marginLeft = '';
            this.arrow.style.marginTop = '';
        },
        resolve(target) {
            return target.closest('[data-tooltip], [data-tooltip-html]');
        },
        handleHover(e) {
            const t = this.resolve(e.target);
            if (!t) {
                if (this.currentTarget) this.hide();
                return;
            }
            if (this.currentTarget === t) return;
            this.currentTarget = t;
            const h = t.getAttribute('data-tooltip-html'),
                txt = t.getAttribute('data-tooltip');
            const side = t.getAttribute('data-tooltip-side') || undefined;
            const anchorSel = t.getAttribute('data-tooltip-anchor');
            let rect;
            if (anchorSel) {
                const anchor = t.closest('.bbgl-weekly-anchor')?.querySelector(anchorSel);
                if (anchor) {
                    const r = anchor.getBoundingClientRect();
                    const activeH = parseFloat(getComputedStyle(anchor).getPropertyValue('--bbgl-handle-active-h')) || 32;
                    rect = { left: r.left, width: r.width, bottom: r.bottom, top: r.bottom - activeH, height: activeH };
                } else {
                    rect = t.getBoundingClientRect();
                }
            } else {
                rect = t.getBoundingClientRect();
            }
            if (h) this.show(h, rect, side);
            else if (txt) this.show('<div style="text-align:center; color:#ddd;">' + txt + '</div>', t.getBoundingClientRect(), side);
            else this.hide();
        }
    };

    function resetRefreshBtn(btn) {
        if (!btn) return;
        if (btn.dataset.timerId) {
            clearTimeout(btn.dataset.timerId);
            delete btn.dataset.timerId;
        }
        btn.style.color = "";
        btn.style.opacity = "1";
        if (btn.dataset.originalText) {
            btn.innerText = btn.dataset.originalText;
            delete btn.dataset.originalText;
        }
    }

    function checkRefreshCooldown(btn) {
        const now = Date.now();
        while (_refreshClickLog.length > 0 && now - _refreshClickLog[0] > 60000) _refreshClickLog.shift();
        _refreshClickLog.push(now);
        if (_refreshClickLog.length <= 4) return false;
        btn.disabled = true;
        btn.style.opacity = '0.45';
        btn.style.color = '#666';
        if (!btn.dataset.originalText) btn.dataset.originalText = btn.innerText;
        let remaining = Math.ceil((60000 - (now - _refreshClickLog[0])) / 1000);
        const updateTooltip = () => {
            btn.setAttribute('data-tooltip', TOOLTIPS.REFRESH_COOLDOWN(remaining));
        };
        updateTooltip();
        const interval = setInterval(() => {
            remaining--;
            if (remaining <= 0) {
                clearInterval(interval);
                btn.disabled = false;
                btn.style.opacity = '';
                btn.style.color = '';
                btn.removeAttribute('data-tooltip');
                if (btn.dataset.originalText) {
                    btn.innerText = btn.dataset.originalText;
                    delete btn.dataset.originalText;
                }
                _refreshClickLog.length = 0;
            } else {
                updateTooltip();
            }
        }, 1000);
        return true;
    }

    function incrementApiCount(n) {
        runtime.apiCallTotal += n;
        // Self-sufficient lookup — doesn't rely on the panel ever having been opened. The dev
        // widget (and #bbgl-api-hud) is created unconditionally at boot, before this can first
        // fire, so this always finds it once and stays accurate from the first call on.
        if (!dom.apiHud) dom.apiHud = document.getElementById('bbgl-api-hud');
        if (dom.apiHud) dom.apiHud.innerHTML = `API Calls: ${runtime.apiCallTotal}`;
    }

    // ─── Error messaging ────────────────────────────────────────────────────
    // Single funnel for every user-facing error popup, so the joke code stays
    // consistent everywhere without being copy-pasted into each alert() call.
    const BBGL_ERROR_CODE = 'Error Code: 69420';
    function bbglError(msg) {
        alert(msg + `\n\n${BBGL_ERROR_CODE}`);
    }

    // Shared text for error situations that were previously duplicated verbatim
    // (or near-verbatim) across multiple call sites.
    const MSG_KEY_FORMAT_INVALID = "Invalid Format.\nA Torn API Key must be exactly 16 alphanumeric characters.";
    const MSG_CLIPBOARD_DENIED = "Clipboard access denied. Please paste manually.";
    const MSG_KEY_NETWORK_ERROR = "Network error while verifying your API key. Please try again.";
    const MSG_SYNC_NETWORK_ERROR = "Couldn't reach Torn's servers. Check your connection and try again.";
    const MSG_SYNC_QUOTA = "Sync failed because your browser ran out of local storage space. Close all open Torn tabs, clear your browser cache, and reload the page.";

    // Torn's own per-key error codes (data.error.code), mapped to plain-language
    // explanations of what's actually wrong and what to do about it, instead of
    // surfacing Torn's raw dev-facing error string. Falls back to that raw string
    // for any code not covered here, so nothing is ever silently swallowed.
    const TORN_KEY_ERROR_MAP = {
        2: "That key doesn't look valid — double-check you copied it correctly.",
        5: "Torn's API rate limit was hit. Wait a moment and try again.",
        8: "Torn has temporarily blocked API requests from your network. Wait a bit and try again.",
        10: "This key's owner is in federal jail, which disables their API key until release.",
        13: "This key's owner has been inactive too long and Torn has temporarily disabled it.",
        14: "Torn's daily API read limit has been reached for this key. Try again tomorrow.",
        16: "This key doesn't have the access level BBGL needs. Make sure it's a Custom key with Basic, Battle Stats, Log, and Faction access — not Public or Minimal.",
        18: "This key has been paused by its owner in Torn's API settings. Re-enable it there, or generate a new one."
    };
    function tornKeyErrorText(data) {
        const err = data && data.error;
        if (!err) return 'Torn rejected this key for an unknown reason.';
        return TORN_KEY_ERROR_MAP[err.code] || `Torn says: "${err.error}".`;
    }

    function saveViewState() {
        if (runtime.isSyncing) return;
        localStorage.setItem(KEYS.STATE, JSON.stringify(viewState));
    }

    function saveConfig() {
        const c = {};
        ALLOWED_CONFIG_KEYS.forEach(k => {
            if (userConfig[k] !== undefined) c[k] = userConfig[k];
        });
        localStorage.setItem(KEYS.CONFIG, JSON.stringify(c));
    }

    function getStickerState(id) {
        const states = (_historyCache && _historyCache.meta && _historyCache.meta.stickers) ? _historyCache.meta.stickers : {};
        return states[String(id)] || '--';
    }
    async function persistStickerCleared(id) {
        try {
            const stored = await DBManager.getStorage();
            if (!stored) return;
            if (!stored.meta) stored.meta = {};
            if (!stored.meta.stickers) stored.meta.stickers = {};
            const key = String(id);
            const cachedState = (_historyCache && _historyCache.meta && _historyCache.meta.stickers && _historyCache.meta.stickers[key]) || '--';
            const newState = cachedState[0] + '+';
            stored.meta.stickers[key] = newState;
            await DBManager.setStorage(stored);
            if (_historyCache) {
                if (!_historyCache.meta) _historyCache.meta = {};
                if (!_historyCache.meta.stickers) _historyCache.meta.stickers = {};
                _historyCache.meta.stickers[key] = newState;
            }
        } catch (e) {
            Log.warn('Failed to persist sticker cleared state', e);
        }
    }

    function getISOWeek(s) {
        const d = Formatter.parse(s),
            date = new Date(d.valueOf());
        date.setUTCDate(date.getUTCDate() + 3 - (date.getUTCDay() + 6) % 7);
        const w1 = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
        return 1 + Math.round(((date.getTime() - w1.getTime()) / 86400000 - 3 + (w1.getUTCDay() + 6) % 7) / 7);
    }

    // Classify a single day into a capsule tier purely by its own energy spent. Happy Jump bonus
    // capsules are a separate layer handled in computeWeekCapsules, not part of this.
    // Returns 'diamond' | 'gold' | 'green' | null (null = not capsule-worthy).
    function classifyDay(d) {
        const e = d.eSpent ? d.eSpent.total : 0;
        if (e >= 2000) return 'diamond';
        if (e >= 1500) return 'gold';
        if (e >= 1000) return 'green';
        return null;
    }

    // Overflow ranking — a higher tier overwrites a lower one. diamond > gold > green.
    const CAPSULE_RANK = { green: 1, gold: 2, diamond: 3 };

    // Capsule units a tier is worth when placed (diamond counts double).
    const TIER_UNITS = { green: 1, gold: 1, diamond: 2 };

    // Place one capsule unit of `color` into the 5-slot array.
    //  - Fill phase: drop into the leftmost empty slot (chronological append).
    //  - Overflow (no empty slots): overwrite the leftmost slot strictly lower in rank; a
    //    displaced higher tier (e.g. a gold bumped by a diamond) cascades down and re-seeks the
    //    next lower slot rather than vanishing — so the lowest tier always takes the loss.
    function placeCapsuleUnit(slots, color) {
        const empty = slots.indexOf(null);
        if (empty !== -1) { slots[empty] = color; return; }
        for (let i = 0; i < slots.length; i++) {
            if (CAPSULE_RANK[slots[i]] < CAPSULE_RANK[color]) {
                const displaced = slots[i];
                slots[i] = color;
                placeCapsuleUnit(slots, displaced); // cascade the bumped tier downward
                return;
            }
        }
        // nothing lower to overwrite (green overflow, or week already all-equal/higher) → dropped
    }

    // Build the 5 capsule slots for a week, chronologically.
    // Organic days: green/gold = 1 unit, diamond = 2 units (via classifyDay).
    // Happy Jumps layer on top of that: the week's 1st HJ day grants 2 units, its 2nd HJ day
    // grants 3 more (2+3=5 — two jumps alone complete a green week); a 3rd HJ that week doesn't
    // add units (the pool's already full) but upgrades every still-green HJ unit to gold. Each HJ
    // day's own organic tier is spent as upgrade credit on that jump's own units first (capped at
    // however many units that jump granted), so a naturally gold/diamond HJ day still gets credit
    // for its real performance instead of defaulting to green. A genuine HJ day's own eSpent is
    // always >= the window's 1000E (the window is a subset of the day's clicks), so it's never
    // classified below green here. Everything feeds the same rank-based overflow above, which is
    // insertion-order independent, so this composes correctly with unrelated diamond days elsewhere
    // in the week without any extra priority logic.
    function computeWeekCapsules(days, hjDaySet = null) {
        const slots = [null, null, null, null, null];
        const hjDays = hjDaySet ? days.filter(d => hjDaySet.has(d.date)) : [];
        const jumpGold = hjDays.length >= GAME.GOLD_WEEK_JUMPS;
        const JUMP_ALLOTMENT = [2, 3]; // units granted by the week's 1st and 2nd HJ day
        days.forEach(d => {
            const jumpIdx = hjDays.indexOf(d);
            if (jumpIdx === 0 || jumpIdx === 1) {
                const jumpUnits = JUMP_ALLOTMENT[jumpIdx];
                const naturalTier = classifyDay(d);
                const upgradeUnits = Math.min(TIER_UNITS[naturalTier] || 0, jumpUnits);
                for (let i = 0; i < upgradeUnits; i++) placeCapsuleUnit(slots, naturalTier);
                for (let i = 0; i < jumpUnits - upgradeUnits; i++) placeCapsuleUnit(slots, jumpGold ? 'gold' : 'green');
            } else {
                const tier = classifyDay(d);
                if (!tier) return;
                placeCapsuleUnit(slots, tier);
                if (tier === 'diamond') placeCapsuleUnit(slots, tier);
            }
        });
        return slots;
    }

    // Week completion, derived purely from the capsule slots (the single source of truth that
    // also feeds sticker awards and weekly bonus EXP):
    //   isCompleted — all 5 capsules filled (1 sticker, green weekly bonus)
    //   isGold      — all 5 are gold-or-diamond (2 stickers, gold weekly bonus)
    //   isDiamond   — all 5 are diamond (diamond weekly bonus / diamond-week stat)
    function computeWeekCompletion(days, hjDaySet = null) {
        const capsules = computeWeekCapsules(days, hjDaySet);
        const filled = capsules.filter(c => c !== null);
        const isCompleted = filled.length === capsules.length;
        const isGold = isCompleted && filled.every(c => c === 'gold' || c === 'diamond');
        const isDiamond = isCompleted && filled.every(c => c === 'diamond');
        return { capsules, isCompleted, isGold, isDiamond };
    }

    // ─── LEVELING MATH ENGINE ────────────────────────────────────────────────
    // Two straight-line ramps (0-25% of levels to 126 EXP, 25-80% to 250 EXP), then a power-3.5
    // curve from 80% to the level-99→100 step (400 EXP). Floor: 25 EXP | P0 Peak: 400 EXP.
    // Atrophy multipliers: ×1.75 (P1) and ×2.50 (P2).
    // Every atrophy tier caps at the same literal level 100, but starts somewhere different —
    // later tiers are genuinely longer climbs (more paid level-ups), not just costlier per level.
    const LEVEL_FLOOR = 25;
    const LEVEL_P0_MAX = 400;
    const LEVEL_ATRO_MULT = [1, 1.75, 2.50];
    const LEVEL_ATRO_START = [0, -1, -10];
    const LEVEL_CAP = 100;
    const LEVEL_STEP1_END = 0.25;
    const LEVEL_STEP1_VAL = 126;
    const LEVEL_STEP2_END = 0.80;
    const LEVEL_STEP2_VAL = 250;
    const LEVEL_TAIL_POWER = 3.50;

    // level here is the level being left (cost to advance level -> level+1).
    function computeLevelExpCost(level, atrophy) {
        const start = LEVEL_ATRO_START[atrophy];
        const t = (level - start) / (LEVEL_CAP - 1 - start);
        const val1 = (LEVEL_STEP1_VAL - LEVEL_FLOOR) / (LEVEL_P0_MAX - LEVEL_FLOOR);
        const val2 = (LEVEL_STEP2_VAL - LEVEL_FLOOR) / (LEVEL_P0_MAX - LEVEL_FLOOR);
        let frac;
        if (t <= LEVEL_STEP1_END) {
            frac = val1 * (t / LEVEL_STEP1_END);
        } else if (t <= LEVEL_STEP2_END) {
            frac = val1 + (val2 - val1) * ((t - LEVEL_STEP1_END) / (LEVEL_STEP2_END - LEVEL_STEP1_END));
        } else {
            const u = (t - LEVEL_STEP2_END) / (1 - LEVEL_STEP2_END);
            frac = val2 + (1 - val2) * Math.pow(u, LEVEL_TAIL_POWER);
        }
        const base = Math.round(LEVEL_FLOOR + (LEVEL_P0_MAX - LEVEL_FLOOR) * frac);
        return Math.round(base * LEVEL_ATRO_MULT[atrophy]);
    }

    // Pre-compute the total EXP required to finish each atrophy stage.
    const LEVEL_ATRO_BUDGETS = [0, 1, 2].map(a => {
        let s = 0;
        for (let lv = LEVEL_ATRO_START[a]; lv < LEVEL_CAP; lv++) s += computeLevelExpCost(lv, a);
        return s;
    });

    function calculateLevelProgress(totalExp) {
        let remaining = totalExp;
        let atrophy = 0;
        for (let a = 0; a < 3; a++) {
            const budget = LEVEL_ATRO_BUDGETS[a];
            if (remaining < budget) { atrophy = a; break; }
            if (remaining === budget && a < 2) return { atrophy: a, level: LEVEL_CAP, expInLevel: 0, expToNext: 0 };
            remaining -= budget;
            atrophy = a + 1;
        }
        if (atrophy >= 3) return { atrophy: 2, level: LEVEL_CAP, expInLevel: 0, expToNext: 0 };
        let level = LEVEL_ATRO_START[atrophy];
        for (let lv = LEVEL_ATRO_START[atrophy]; lv < LEVEL_CAP; lv++) {
            const cost = computeLevelExpCost(lv, atrophy);
            if (remaining < cost) { level = lv; break; }
            remaining -= cost;
            level = lv + 1;
        }
        const expInLevel = level < LEVEL_CAP ? remaining : 0;
        const expToNext = level < LEVEL_CAP ? computeLevelExpCost(level, atrophy) : 0;
        return { atrophy, level, expInLevel, expToNext };
    }

    // Level-band flavor titles: six bands per atrophy tier, walking a raw-clay-to-fired-brick
    // metaphor. Columns are [atrophy0, atrophy1, atrophy2] — same band, escalating intensity per
    // tier. Bands key off the raw level number directly: negative pre-zero levels (atrophy 1/2's
    // earlier start) just fall into band 1 via its <= comparison, and the level-69 easter egg
    // lands on the literal displayed "69" for every atrophy tier regardless of where it started.
    // Level 100 is the universal finish line, but only atrophy 2 gets "Fully Bricked" — atrophy
    // 0/1 auto-roll into the next tier, so they keep band 6's capstone title instead.
    //
    // `max` is inclusive and doubles as the bracket axis on the titles page (levelRankBrackets()
    // below reads widths straight off these numbers), so edit a max here and the axis re-draws
    // itself — no second list to keep in sync. Band 3 ends at 69 rather than 68 purely so the
    // axis reads 40-69 / 70-79; atrophyTitle() intercepts level 69 with the easter egg before any
    // band lookup happens, so the boundary itself has no effect on which title you actually get.
    const LEVEL_TITLE_BANDS = [
        { max: 19, titles: ['Dry Clay', 'Parched Clay', 'Cracked Clay'] },
        { max: 39, titles: ['Moistened Clay', 'Saturated Clay', 'Dripping Wet Clay'] },
        { max: 69, titles: ['Hand-Jerked Clay', 'Foot-Pumped Clay', 'Vacuum-Milked Clay'] },
        { max: 79, titles: ['Block-Molded Clay', 'Block-Pressed Clay', 'Block-Cut Clay'] },
        { max: 89, titles: ['Pit-Fired Clay', 'Scove-Fired Clay', 'Kiln-Fired Clay'] },
        { max: 99, titles: ['Half-Bricked', 'Mostly Bricked', 'Competently Bricked'] }
    ];
    const LEVEL_TITLE_EASTER_EGG_LEVEL = 69;
    const LEVEL_TITLE_EASTER_EGG = ['Nice ;)', 'Really Nice ;)', 'Super Nice ;)'];

    function atrophyTitle(atrophy, level) {
        if (atrophy >= 2 && level >= 100) return 'Fully Bricked';
        if (level === LEVEL_TITLE_EASTER_EGG_LEVEL) return LEVEL_TITLE_EASTER_EGG[atrophy] || LEVEL_TITLE_EASTER_EGG[0];
        const band = LEVEL_TITLE_BANDS.find(b => level <= b.max) || LEVEL_TITLE_BANDS[LEVEL_TITLE_BANDS.length - 1];
        return band.titles[atrophy] || band.titles[0];
    }

    // ─── Rank Hardening Finish ──────────────────────────────────────────────
    // The rank line's own progression, deliberately built as the OPPOSITE of the stat title's:
    // the title EMITS (outward glow, discrete phase jumps, animated rainbow at the top), the rank
    // REFLECTS (a stamped impression in a surface, continuous, no halo). They can therefore share
    // a tooltip without competing even when both are maxed.
    //
    // Two channels move independently, which is what keeps it from being a plain color ramp:
    //   • hardness  — strictly monotonic. The impression sharpens: the soft diffuse blur collapses,
    //                 the lit lip under each letter firms up, tracking tightens, opacity rises.
    //   • moisture/heat — NOT monotonic, because the band names aren't either (Dry -> Moistened ->
    //                 worked -> molded -> Fired -> Bricked). Clay is wettest in the MIDDLE. Gloss
    //                 rises early then burns off, and the hue warms toward the firing bands.
    // Lightness only ever climbs, so the "wet" stretch reads as sheen rather than going dark and
    // losing contrast against the plaque behind it.
    //
    // Stops are [progress 0-1, [r,g,b], softness]. Continuous in `level` rather than banded on
    // purpose: the finish is already warming before the word flips to "Pit-Fired", so the band
    // name reads as a label on a continuum instead of snapping in lockstep with the color.
    const RANK_HARDEN_STOPS = [
        [0.00, [154, 149, 141], 0.55], // raw and dusty — barely formed, softest impression
        [0.22, [168, 160, 150], 0.45], // moistened — sheen up, still takes a mushy stamp
        [0.45, [181, 166, 144], 0.30], // worked and molded — starting to hold an edge
        [0.68, [198, 154, 114], 0.16], // pit-fired — warming toward ember
        [0.86, [201, 143, 110], 0.07], // cooled back to matte brick
        [1.00, [212, 161, 132], 0.00]  // set hard, crisp permanent impression
    ];

    // Emits the inline custom properties the .bbgl-lvl-rank rule consumes. Computed in JS rather
    // than as CSS steps so the ramp is genuinely continuous (every level moves it) with no reliance
    // on color-mix(), and so the whole curve stays tunable from the one table above.
    function rankHardenCSS(atrophy, level) {
        const p = Math.max(0, Math.min(1, (level || 0) / LEVEL_CAP));
        let i = 0;
        while (i < RANK_HARDEN_STOPS.length - 2 && p > RANK_HARDEN_STOPS[i + 1][0]) i++;
        const a = RANK_HARDEN_STOPS[i], b = RANK_HARDEN_STOPS[i + 1];
        const t = b[0] === a[0] ? 0 : (p - a[0]) / (b[0] - a[0]);
        const mix = (x, y) => x + (y - x) * t;
        // Later atrophy tiers fire hotter: the arc resets each tier but its ceiling rises, mirroring
        // the escalation already baked into LEVEL_TITLE_BANDS (Pit- -> Scove- -> Kiln-Fired).
        const heat = Math.max(0, Math.min(2, atrophy || 0)) * p;
        const ch = (k, warm) => Math.max(0, Math.min(255, Math.round(mix(a[1][k], b[1][k]) + warm * heat)));
        const soft = mix(a[2], b[2]);
        const hard = 1 - (soft / RANK_HARDEN_STOPS[0][2]);
        return [
            `--rank-ink:rgb(${ch(0, 11)},${ch(1, 3)},${ch(2, -9)})`,
            `--rank-press:${(soft * 6.5).toFixed(2)}px`,
            `--rank-press-a:${(0.30 + soft * 0.50).toFixed(2)}`,
            `--rank-lip:${(hard * 0.17).toFixed(3)}`,
            `--rank-track:${(soft * 0.10).toFixed(3)}em`,
            `--rank-fade:${(0.74 + hard * 0.26).toFixed(2)}`
        ].join(';');
    }

    // The rank axis under the titles page's level bar: one bracket per band, sized by its true
    // share of the 0-LEVEL_CAP run so a 20-level band takes 20% and a 10-level band takes 10%.
    // Everything derives from LEVEL_TITLE_BANDS, so adding, removing or resizing a band re-draws
    // the axis with no other edits.
    //
    // A bracket reveals its name once you've reached it in the CURRENT atrophy tier and reads "?"
    // until then — the first is therefore always revealed, and every bracket re-hides on atrophy
    // since the whole tier's names change with it.
    function levelRankBrackets(atrophy, level) {
        const a = Math.max(0, Math.min(2, atrophy || 0));
        const out = [];
        let start = 0;
        LEVEL_TITLE_BANDS.forEach(band => {
            const span = band.max - start + 1;
            const unlocked = level >= start;
            out.push({
                start,
                end: band.max,
                span,
                widthPct: (span / LEVEL_CAP) * 100,
                unlocked,
                label: unlocked ? (band.titles[a] || band.titles[0]) : '?'
            });
            start = band.max + 1;
        });
        return out;
    }

    // ─── Stat Titles ────────────────────────────────────────────────────────
    // Second, independent title system appended after atrophyTitle() above (e.g. "Half-Bricked
    // Calloused Goon"). Does not reset with atrophy — each of the four battle stats runs its own
    // 11-phase word ladder, unlocked by E spent on THAT stat alone (day.eSpent[stat], never the
    // pooled total). Unlocked phases stay unlocked and the player picks which two fill the title:
    // one supplies the noun (Primary), one the adjective (Secondary). Any stat can fill either
    // slot, including the same stat/phase in both.

    // Per-stat cumulative-E thresholds, index = phase. Phase 0 is free (0E) so every stat always
    // has one selectable word — the grid is never empty and a title always composes. Increments
    // are backloaded: +10k, +12.5k, +15k, +17.5k, +20k, then +30k/35k/45k/55k/60k.
    const STAT_TITLE_THRESHOLDS = [0, 10000, 22500, 37500, 55000, 75000, 105000, 140000, 185000, 240000, 300000];

    // While the player has never made a manual pick, the displayed pair auto-follows their top two
    // stats. Phase bumps apply the moment they unlock, but WHICH stats hold the two slots may only
    // change this often — the simple replacement for the old checkpoint/stability-day debounce.
    const STAT_TITLE_AUTO_PAIR_COOLDOWN_MS = 72 * 3600 * 1000;

    // One evolving noun+adjective ladder per stat, indexed by phase (0-10). Undecided phases are
    // `null` — statTitleWord() clamps down to the highest defined phase at or below the one asked
    // for rather than ever rendering a null/undefined word, so the ladder can ship half-written.
    const STAT_TITLE_WORDS = {
        str: [
            { noun: 'Noodle', adj: 'Limp' },
            { noun: 'Fist', adj: 'Fisting' },
            { noun: 'Pounder', adj: 'Pounding' },
            { noun: 'Grinder', adj: 'Grinding' },
            { noun: 'Banger', adj: 'Banging' },
            { noun: 'Ripper', adj: 'Ripping' },
            { noun: 'Goon', adj: 'Goonish' },
            null, null, null, null
        ],
        def: [
            { noun: 'Softie', adj: 'Soft' },
            { noun: 'Blister', adj: 'Blistered' },
            { noun: 'Flesh', adj: 'Fleshy' },
            { noun: 'Callous', adj: 'Calloused' },
            { noun: 'Leather', adj: 'Leathery' },
            { noun: 'Firmness', adj: 'Firm' },
            { noun: 'Slab', adj: 'Rock-Hard' },
            // Boulder/Impenetrable pending — parked, not yet assigned a phase.
            null, null, null, null
        ],
        spd: [
            { noun: 'Blindman', adj: 'Blind' },
            { noun: 'Peeper', adj: 'Peeping' },
            { noun: 'Lurker', adj: 'Lurking' },
            { noun: 'Prowler', adj: 'Prowling' },
            { noun: 'Predator', adj: 'Predatory' },
            { noun: 'Longshot', adj: 'Longshot' },
            null, null, null, null, null
        ],
        dex: [
            { noun: 'Noise', adj: 'Noisy' },
            { noun: 'Silence', adj: 'Silent' },
            { noun: 'Creeper', adj: 'Creeping' },
            { noun: 'Squirmer', adj: 'Squirming' },
            { noun: 'Glaze', adj: 'Slippery' },
            { noun: 'Rascal', adj: 'Rascally' },
            { noun: 'Ambiguity', adj: 'Ambiguous' },
            null, null, null, null
        ]
    };

    // Highest phase index one stat's own cumulative E clears.
    function statTitlePhaseForE(statE) {
        for (let i = STAT_TITLE_THRESHOLDS.length - 1; i >= 0; i--) {
            if (statE >= STAT_TITLE_THRESHOLDS[i]) return i;
        }
        return 0;
    }

    // {str,def,spd,dex} of E spent -> {str,def,spd,dex} of highest unlocked phase.
    function statTitlePhases(eByStat) {
        const out = {};
        STAT_KEYS.forEach(k => {
            out[k] = statTitlePhaseForE((eByStat && eByStat[k]) || 0);
        });
        return out;
    }

    // Word lookup that never returns a null entry: clamps down to the highest DEFINED phase at or
    // below the requested one, and reports which phase actually supplied the word so the caller
    // can colour it by what it really is rather than what was asked for.
    function statTitleWord(stat, phase) {
        const ladder = STAT_TITLE_WORDS[stat];
        if (!ladder) return null;
        let p = Math.max(0, Math.min(phase | 0, ladder.length - 1));
        while (p > 0 && !ladder[p]) p--;
        return ladder[p] ? { noun: ladder[p].noun, adj: ladder[p].adj, phase: p } : null;
    }

    // Top 2 of the 4 battle stats by raw value, descending. Ties break on STAT_KEYS order
    // (str > def > spd > dex) so the result is always deterministic. STAT_KEYS is defined later
    // in 06-section-v-logic.js — safe to reference here since this only runs inside a function
    // body, well after the whole IIFE has finished its one top-to-bottom definition pass.
    function rankTopTwoStats(breakdown) {
        return [...STAT_KEYS]
            .sort((a, b) => (breakdown[b] || 0) - (breakdown[a] || 0))
            .slice(0, 2);
    }

    // selection = { primary: {stat, phase}, secondary: {stat, phase} }. Primary supplies the noun
    // (the identity — "Goon"), secondary the adjective modifying it ("Calloused"), so the phrase
    // reads "<secondary.adj> <primary.noun>". Both slots are free-choice from anything unlocked,
    // including the same stat and phase in both.
    function composeStatTitleParts(selection) {
        if (!selection || !selection.primary || !selection.secondary) return null;
        const noun = statTitleWord(selection.primary.stat, selection.primary.phase);
        const adj = statTitleWord(selection.secondary.stat, selection.secondary.phase);
        if (!noun || !adj) return null;
        return [{
            text: adj.adj,
            phase: adj.phase,
            stat: selection.secondary.stat
        }, {
            text: noun.noun,
            phase: noun.phase,
            stat: selection.primary.stat
        }];
    }

    // Plain text — clipboard, aria labels, anywhere markup would be wrong.
    function composeStatTitle(selection) {
        const parts = composeStatTitleParts(selection);
        return parts ? parts.map(p => p.text).join(' ') : '';
    }

    // Each word carries its OWN data-title-phase, so a dull Phase 1 adjective can sit next to an
    // iridescent Phase 10 noun — the finish progression in 04-section-iii-styles.js is per word,
    // not per title.
    function composeStatTitleHTML(selection) {
        const parts = composeStatTitleParts(selection);
        if (!parts) return '';
        return parts.map(p => `<span class="bbgl-title-word" data-title-phase="${p.phase}">${p.text}</span>`).join(' ');
    }

    // Clamp a stored slot to something real — known stat, phase inside the ladder and never past
    // what that stat has actually unlocked (guards hand-edited config and words being re-ordered
    // out from under a saved pick).
    function clampTitleSlot(slot, phases) {
        if (!slot || !STAT_TITLE_WORDS[slot.stat]) return null;
        const cap = phases ? (phases[slot.stat] || 0) : STAT_TITLE_THRESHOLDS.length - 1;
        return {
            stat: slot.stat,
            phase: Math.max(0, Math.min(slot.phase | 0, cap))
        };
    }

    function persistAutoTitlePair(pair, now) {
        if (runtime.demoMode) return;
        userConfig.titleAutoPair = { primary: pair[0], secondary: pair[1] };
        userConfig.titleAutoPairChangedAt = now;
        saveConfig();
    }

    // The selection actually displayed, given per-stat E and the current stat breakdown.
    //
    // Custom mode: the saved manual pick, clamped to what's unlocked. Earned mode: the top two
    // stats, each at its own highest unlocked phase — so a phase bump shows up the instant it
    // unlocks — except that WHICH stats hold the two slots may only change once per
    // STAT_TITLE_AUTO_PAIR_COOLDOWN_MS. That cooldown is the whole of the debounce now; the old
    // checkpoint + stability-day machinery is gone.
    //
    // The two are stored separately (titleCustom vs titleAutoPair) precisely so the switch is
    // non-destructive: flipping to Earned never overwrites the custom pick waiting behind it.
    function resolveStatTitleSelection(eByStat, breakdown) {
        const phases = statTitlePhases(eByStat);
        const custom = userConfig.titleCustom;
        const hasCustom = !!(custom && custom.primary && custom.secondary);
        if (userConfig.titleMode === 'custom' && hasCustom) {
            const primary = clampTitleSlot(custom.primary, phases);
            const secondary = clampTitleSlot(custom.secondary, phases);
            if (primary && secondary) return { primary, secondary, phases, mode: 'custom', hasCustom };
        }
        let pair = rankTopTwoStats(breakdown || {});
        const auto = userConfig.titleAutoPair;
        const prev = (auto && STAT_TITLE_WORDS[auto.primary] && STAT_TITLE_WORDS[auto.secondary])
            ? [auto.primary, auto.secondary]
            : null;
        // Before any battle stats have loaded, rankTopTwoStats() falls back to STAT_KEYS order.
        // Seeding (and stamping the 72h cooldown) off that would lock str/def in for three days on
        // every fresh install, so hold whatever is stored and don't persist until stats are real.
        const hasStats = STAT_KEYS.some(k => (breakdown && breakdown[k]) > 0);
        if (!hasStats) {
            if (prev) pair = prev;
        } else {
            const now = Date.now();
            if (!prev) {
                persistAutoTitlePair(pair, now);
            } else if (prev[0] !== pair[0] || prev[1] !== pair[1]) {
                if (now - (userConfig.titleAutoPairChangedAt || 0) < STAT_TITLE_AUTO_PAIR_COOLDOWN_MS) pair = prev;
                else persistAutoTitlePair(pair, now);
            }
        }
        return {
            primary: { stat: pair[0], phase: phases[pair[0]] },
            secondary: { stat: pair[1], phase: phases[pair[1]] },
            phases,
            mode: 'earned',
            hasCustom
        };
    }

    // role: 'primary' (noun slot), 'secondary' (adjective slot), or 'both'. Picking anything is
    // what flips the switch to Custom — you never have to set the mode first.
    function applyStatTitlePick(current, stat, phase, role) {
        const slot = { stat, phase };
        const next = {
            primary: role === 'secondary' ? current.primary : slot,
            secondary: role === 'primary' ? current.secondary : slot
        };
        userConfig.titleCustom = next;
        userConfig.titleMode = 'custom';
        saveConfig();
        return next;
    }

    // Earned/Custom switch. Zeroing the cooldown stamp on the way back to Earned lets it snap
    // straight to the real top two instead of sitting on a stale pair for up to 72h.
    function setStatTitleMode(mode) {
        userConfig.titleMode = mode === 'custom' ? 'custom' : 'earned';
        if (userConfig.titleMode === 'earned') userConfig.titleAutoPairChangedAt = 0;
        saveConfig();
    }

    // Real-time daily EXP for the leveling bar (NOT the weekly progress bar).
    // Scaling tiers: 0.175/E (0-1000), 0.20/E (1001-1500), 0.050/E (1501+) — diminishing returns
    // past Gold. Flat +100 bonus at 2,000E+ (Diamond) is the payoff for pushing all the way
    // through the Gold+ slump rather than stopping partway. HJ days: burst energy (≤1000E) earns
    // at 0.25/E; extra E above continues in normal scaling bands (including the Diamond bonus).
    const LEVEL_RATE_BASE = 0.175;
    const LEVEL_RATE_GREEN = 0.20;
    const LEVEL_RATE_GOLD = 0.050;
    const LEVEL_RATE_HJ_BURST = 0.25;
    const LEVEL_RATE_DIAMOND_BONUS = 100;
    function computeDailyLevelExp(eSpent, hasTrainLog, isHJ = false) {
        if (!hasTrainLog) return 0;
        const diamondBonus = eSpent >= 2000 ? LEVEL_RATE_DIAMOND_BONUS : 0;
        if (isHJ) {
            const hjE    = Math.min(eSpent, 1000);
            const extraE = Math.max(eSpent - 1000, 0);
            const hjBase = hjE * LEVEL_RATE_HJ_BURST;
            const t2     = Math.min(extraE, 500) * LEVEL_RATE_GREEN;
            const t3     = Math.max(extraE - 500, 0) * LEVEL_RATE_GOLD;
            return Math.round(hjBase + t2 + t3 + diamondBonus);
        }
        const t1 = Math.min(eSpent, 1000) * LEVEL_RATE_BASE;
        const t2 = Math.min(Math.max(eSpent - 1000, 0), 500) * LEVEL_RATE_GREEN;
        const t3 = Math.max(eSpent - 1500, 0) * LEVEL_RATE_GOLD;
        return Math.round(t1 + t2 + t3 + diamondBonus);
    }
    // ─────────────────────────────────────────────────────────────────────────

    function getWeekKey(dateStr) {
        const d = Formatter.parse(dateStr);
        const dayIdx = d.getUTCDay();
        const offset = userConfig.weekStartMode === 'mon' ? (dayIdx === 0 ? 6 : dayIdx - 1) : dayIdx;
        const weekStart = new Date(d.getTime() - offset * 86400000);
        return Formatter.dateISO(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate());
    }

    // Week-key of the install date (rewardStartDate). Stickers are eligible for weeks with key >=
    // this — week-precision, so a backfilled day earlier in the install week still counts toward
    // that week's sticker goal. Respects the user's day-start and week-start modes. Returns null if
    // unknown (no gating) — but init() self-heals privacyAgreed so this is rare.
    function getInstallWeekKey() {
        const rewardStartDate = getActiveHistory().meta.rewardStartDate;
        if (!rewardStartDate) return null;
        return getWeekKey(Formatter.dateLogical(rewardStartDate * 1000));
    }

    // Logical date-string of the install moment (rewardStartDate), day-precision. Gates EXP
    // specifically: unlike getInstallWeekKey()'s week-level sticker gate, a backfilled day earlier
    // in the install week earns 0 EXP — only days on/after the exact install moment count. This is
    // what keeps a Clear Log + Backfill from retroactively granting career EXP for reconstructed
    // pre-install history while still letting that same week's sticker goal be met.
    function getInstallDateKey() {
        const rewardStartDate = getActiveHistory().meta.rewardStartDate;
        if (!rewardStartDate) return null;
        return Formatter.dateLogical(rewardStartDate * 1000);
    }


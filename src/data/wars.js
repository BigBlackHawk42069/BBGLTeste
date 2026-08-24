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


async function fetchWars(manual) {
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const lastSync = parseInt(localStorage.getItem(KEYS.WARS_SYNC) || '0');
    if (!manual && (Date.now() - lastSync) < TWENTY_FOUR_HOURS) return;
    try {
        // user/?selections=faction is API v2-only (v1 returns error code 23), so the faction
        // ID has to come from the same v1 faction/rankedwars request via the "basic" selection.
        app.incrementApiCount(1);
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
        app.incrementApiCount(1);
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
            app.incrementApiCount(1);
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


let _warMarkerCache = { raw: false, cutoff: -1, map: {} };

function getWarMarkers() { const raw = localStorage.getItem(KEYS.WARS_DATA); const meta = app.getActiveHistory().meta; const cutoff = meta && meta.logStartDate ? meta.logStartDate : 0; if (raw === _warMarkerCache.raw && cutoff === _warMarkerCache.cutoff) return _warMarkerCache.map || {}; const factionHistory = getFactionHistory(); const map = {}; if (raw) { try { const wars = JSON.parse(raw); Object.values(wars).forEach(w => { if (!w || !w.war || !w.war.end) return; if (w.war.end < cutoff) return; if (!wasInFactionDuringWar(factionHistory, w.factionId, w.war.end)) return; if (w.war.start && w.war.start >= cutoff) { const ds = Formatter.dateLogical(w.war.start * 1000); (map[ds] = map[ds] || {}).warStart = true; } const ds = Formatter.dateLogical(w.war.end * 1000); const entry = map[ds] = map[ds] || {}; if (w.outcome === 'won') entry.warWon = true;else if (w.outcome === 'lost') entry.warLost = true;else entry.warEnd = true; }); } catch (e) {} } _warMarkerCache = { raw, cutoff, map }; return map; }

function renderCell(cont, y, m, d, g, rIdx, cIdx) { const ds = Formatter.dateISO(y, m, d), sl = app.DataController.getSlice('DAY', ds), isFlipped = cont.classList.contains('bbgl-row-archived'), cell = document.createElement('div'); cell.className = 'bbgl-day-cell' + (isFlipped ? ' is-archived' : '') + (g ? ' ghost-cell' : ''); cell.dataset.date = ds; let buildShine = null; cell.addEventListener('mouseenter', () => { if (userConfig.animations) { cell.classList.add('shimmer-active'); if (buildShine) buildShine(); } }); cell.addEventListener('mouseleave', () => { if (!cell.classList.contains('is-viewing')) cell.classList.remove('shimmer-active'); }); const isToday = ds === Formatter.dateLogical(); if (isFlipped && sl.meta.tier > 0) { let url = `url(${app.CAL_IMG_BASE}}cal-grid-grn.jpg)`; if (sl.meta.tier === 2) url = `url(${app.CAL_IMG_BASE}}cal-grid-gold.jpg)`;else if (sl.meta.tier === 3) url = `url(${app.CAL_IMG_BASE}}cal-grid-dmnd.jpg)`; cell.style.backgroundImage = url; cell.style.backgroundSize = "700% 600%"; cell.style.backgroundPosition = `${(cIdx * (100 / 6)).toFixed(4)}% ${(rIdx * (100 / 5)).toFixed(4)}%`; } if (!isFlipped && sl.meta.tier > 0) { const wrap = document.createElement('div'), img = document.createElement('img'); let tType = 'green', url = `${app.CAL_IMG_BASE}}rwrd-grn.png`; if (sl.meta.tier === 2) { tType = 'gold'; url = `${app.CAL_IMG_BASE}}rwrd-gold.png`; } else if (sl.meta.tier === 3) { tType = 'diamond'; url = `${app.CAL_IMG_BASE}}rwrd-dmnd.png`; } wrap.className = `jewel-wrapper jewel-type-${tType}`; img.className = 'jewel-asset'; img.src = url; wrap.appendChild(img); cell.appendChild(wrap); cell.classList.add('is-plate'); buildShine = () => { if (wrap.querySelector('.jewel-shine')) return; const sh = document.createElement('div'); sh.className = 'jewel-shine'; sh.style.maskImage = `url("${url}")`; sh.style.webkitMaskImage = `url("${url}")`; if (sl.meta.tier === 2) { wrap.appendChild(sh); } else { wrap.insertBefore(sh, img); const so = document.createElement('div'); so.className = 'jewel-shine-over'; so.style.setProperty('--jewel-mask', `url("${url}")`); wrap.appendChild(so); } }; } const ns = document.createElement('span'); ns.className = 'day-num'; ns.innerText = d; cell.appendChild(ns); if (isFlipped) { const wm = getWarMarkers()[ds]; const eventImgs = []; if ((sl.lsdODs || 0) > 0) eventImgs.push(app.CAL_IMG_BASE + 'lsd-od.png'); if ((sl.xanaxODs || 0) > 0) eventImgs.push(app.CAL_IMG_BASE + 'xan-od.png'); if ((sl.exODs || 0) > 0) eventImgs.push('PLACEHOLDER_EX_OD_URL'); if (wm && wm.warStart) eventImgs.push(app.CAL_IMG_BASE + 'war-strt.png'); if (wm && wm.warWon) eventImgs.push(app.CAL_IMG_BASE + 'war-win.png'); if (wm && wm.warLost) eventImgs.push(app.CAL_IMG_BASE + 'war-lost.png'); eventImgs.forEach((url, i) => { const ep = document.createElement('div'); ep.className = 'bbgl-event-post-it' + (eventImgs.length > 1 && i === eventImgs.length - 1 ? ' bbgl-event-post-it-top' : ''); ep.style.backgroundImage = `url('${url}')`; ep.style.setProperty('--ei', i); ep.style.setProperty('--stack-total', eventImgs.length); cell.appendChild(ep); }); } if (isFlipped && sl.meta.tier > 0) { const item = app.DataController.getStickerMap().get(ds); if (item) { const uid = Math.floor(new Date(Date.UTC(y, m, d)).getTime() / 86400000); const sw = document.createElement('div'), si = document.createElement('img'); sw.className = 'sticker-wrapper' + (sl.meta.tier === 3 ? ' sticker-tier-diamond' : ''); sw.style.setProperty('--rot',
    `${uid * 17 % 21 - 10}deg`); si.src = item.url; si.className = 'cell-sticker-deco'; sw.appendChild(si); cell.appendChild(sw); buildShine = () => { if (sw.querySelector('.sticker-shine')) return; const ss = document.createElement('div'); ss.className = 'sticker-shine'; ss.style.webkitMaskImage = `url("${item.url}")`; ss.style.maskImage = `url("${item.url}")`; let grad = `linear-gradient(115deg,rgba(0,200,150,0.55) 0%,rgba(0,255,180,0.65) 20%,rgba(0,255,255,0.7) 35%,rgba(255,255,255,0.75) 50%,rgba(255,0,255,0.85) 65%,rgba(0,150,255,0.9) 80%,rgba(0,200,150,0.85) 100%)`; if (sl.meta.tier === 2) grad = `linear-gradient(115deg,rgba(184,134,11,0.7) 0%,rgba(212,175,55,0.85) 11%,rgba(255,255,240,1.0) 13%,rgba(212,175,55,0.8) 15%,rgba(0,255,255,0.7) 35%,rgba(255,0,255,0.85) 65%,rgba(0,150,255,0.9) 80%,rgba(184,134,11,0.85) 100%)`;else if (sl.meta.tier === 3) grad = `linear-gradient(115deg,rgba(0,255,255,0.85) 0%,rgba(200,100,255,0.85) 5%,rgba(255,0,255,0.85) 10%,rgba(0,150,255,0.85) 15%,rgba(0,255,255,0.75) 35%,rgba(255,0,255,0.85) 65%,rgba(0,150,255,0.9) 80%,rgba(0,255,255,0.85) 85%,rgba(200,100,255,0.85) 90%,rgba(255,0,255,0.85) 95%,rgba(0,150,255,0.85) 100%)`; ss.style.backgroundImage = grad; ss.style.mixBlendMode = "overlay"; if (sl.meta.tier >= 2) ss.style.filter = "brightness(1.5)"; sw.appendChild(ss); }; if (app.DataController._cache.featuredDays && app.DataController._cache.featuredDays.has(ds) && !app.DataController.isStickerCleared(item.id)) { const pi = document.createElement('div'); pi.className = 'new-sticker-post-it'; pi.onclick = e => { e.stopPropagation(); cell.style.setProperty('overflow', 'visible', 'important'); cell.style.setProperty('z-index', '100', 'important'); pi.classList.add('post-it-rip'); app.DataController.markStickerCleared(item.id); setTimeout(() => { if (pi.parentNode) pi.remove(); cell.style.removeProperty('overflow'); cell.style.removeProperty('z-index'); cell.click(); }, 600); }; cell.appendChild(pi); } } } if (isToday) cell.id = `active-date-today`; cell._buildShine = buildShine; if (calendarState.selectedLabel === ds || !calendarState.selectedLabel && isToday) { cell.classList.add('is-viewing'); if (buildShine) buildShine(); } const h = app.getActiveHistory(); const tl = app.DataController.getTimeline(); const firstDate = tl.length > 0 ? tl[0].date : h ? h.today.date : null; const isInteractive = !sl.meta.isGap || firstDate && ds >= firstDate && ds <= Formatter.dateLogical(); if (isInteractive) cell.setAttribute('data-tooltip-html', app.generateRichTooltip(sl));else cell.setAttribute('data-tooltip', app.app.TOOLTIPS.CELL_DATE(ds)); cell.onclick = () => { if (isToday) app.closeHistory();else if (isInteractive) app.openHistory(sl, ds); }; cont.appendChild(cell); if (isInteractive && viewState.activeViewLabel === ds && calendarState.selectedLabel !== ds) runtime._pendingHistoryRestore = { sl, label: ds }; }

app.fetchWars = fetchWars;
app.fetchFactionHistory = fetchFactionHistory;
app.getFactionHistory = getFactionHistory;
app.fetchPastFactionWars = fetchPastFactionWars;
app.wasInFactionDuringWar = wasInFactionDuringWar;
app._warMarkerCache = _warMarkerCache;
app.getWarMarkers = getWarMarkers;
app.renderCell = renderCell;
export { fetchWars, fetchFactionHistory, getFactionHistory, fetchPastFactionWars, wasInFactionDuringWar, _warMarkerCache, getWarMarkers, renderCell };

import { app } from '../app-context.js';
import {
  KEYS
} from '../core/constants.ts';
import { Log } from '../core/log.ts';
import { userConfig } from '../core/state.ts';
import { Formatter } from '../domain/time.ts';


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

let _warMarkerCache = { raw: false, cutoff: -1, map: {} };

function getWarMarkers() {
    const raw = localStorage.getItem(KEYS.WARS_DATA);
    const meta = app.getActiveHistory().meta;
    const cutoff = meta && meta.logStartDate ? meta.logStartDate : 0;
    if (raw === _warMarkerCache.raw && cutoff === _warMarkerCache.cutoff) return _warMarkerCache.map || {};
    const factionHistory = getFactionHistory();
    const map = {};
    if (raw) {
        try {
            const wars = JSON.parse(raw);
            Object.values(wars).forEach(w => {
                if (!w || !w.war || !w.war.end) return;
                if (w.war.end < cutoff) return;
                if (!wasInFactionDuringWar(factionHistory, w.factionId, w.war.end)) return;
                if (w.war.start && w.war.start >= cutoff) {
                    const ds = Formatter.dateLogical(w.war.start * 1000);
                    (map[ds] = map[ds] || {}).warStart = true;
                }
                const ds = Formatter.dateLogical(w.war.end * 1000);
                const entry = map[ds] = map[ds] || {};
                if (w.outcome === 'won') entry.warWon = true;
                else if (w.outcome === 'lost') entry.warLost = true;
                else entry.warEnd = true;
            });
        } catch (e) {}
    }
    _warMarkerCache = { raw, cutoff, map };
    return map;
}

app.fetchWars = fetchWars;
app.fetchFactionHistory = fetchFactionHistory;
app.getFactionHistory = getFactionHistory;
app.fetchPastFactionWars = fetchPastFactionWars;
app.wasInFactionDuringWar = wasInFactionDuringWar;
app._warMarkerCache = _warMarkerCache;
app.getWarMarkers = getWarMarkers;
export { fetchWars, fetchFactionHistory, getFactionHistory, fetchPastFactionWars, wasInFactionDuringWar, _warMarkerCache, getWarMarkers };

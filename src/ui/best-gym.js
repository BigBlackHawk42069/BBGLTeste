import { app } from '../app-context.js';
import { CUSTOM_STICKERS, PAGE_TITLES, cdnize } from '../ui/assets.ts';
import { ASSETS, ICONS } from '../ui/icons.ts';
import { injectStyles } from '../ui/styles.ts';
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


const BestGymController = { _suppressed: {}, _reactItem(btn) { try { const key = Object.keys(btn).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')); let f = btn[key], depth = 0; while (f && depth < 16) { const pp = f.memoizedProps; if (pp && pp.item && pp.item.id != null && pp.item.status) return pp.item; f = f.return; depth++; } } catch (e) {} return null; }, scanGyms() { const root = document.getElementById('gymroot') || document; const result = { gyms: {}, active: null }; root.querySelectorAll("button[class*='gymButton']").forEach(btn => { const icon = btn.querySelector("[class*='gym-']"); if (!icon) return; const match = /gym-(\d+)/.exec(icon.getAttribute('class') || ''); if (!match) return; const id = parseInt(match[1], 10); if (!id || result.gyms[id]) return; const cls = ' ' + (btn.getAttribute('class') || '') + ' '; const locked = /\s(?:locked|inProgress)/i.test(cls); const active = /\sactive/i.test(cls); const item = this._reactItem(btn); const status = item ? item.status : null; const owned = status === 'active' || status === 'available'; result.gyms[id] = { id: id, btn: btn, locked: locked, active: active, status: status, owned: owned }; if (active) result.active = id; }); return result; }, bestGymFor(stat, scan) { const tiers = GYM_TIERS[stat]; if (!tiers) return null; const rankOf = id => { for (let i = 0; i < tiers.length; i++) { const g = tiers[i]; if (Array.isArray(g) ? g.indexOf(id) !== -1 : g === id) return i; } return -1; }; const allowSpec = userConfig.bestGymSpecialist; const allowUnpurchased = userConfig.bestGymUnpurchased; let bestId = null, bestRank = scan.active != null ? rankOf(scan.active) : -1; Object.keys(scan.gyms).forEach(key => { const gym = scan.gyms[key]; if (gym.locked) return; if (!allowSpec && gym.id >= 25) return; if (!allowUnpurchased && !gym.owned) return; const rank = rankOf(gym.id); if (rank > bestRank) { bestRank = rank; bestId = gym.id; } }); return bestId; }, swapToGym(gym) { try { gym.btn.click(); return true; } catch (e) { Log.warn('BestGym: gym switch failed', e); return false; } }, _statFromLabel(label) { if (label === 'Train strength') return 'str'; if (label === 'Train defense') return 'def'; if (label === 'Train speed') return 'spd'; if (label === 'Train dexterity') return 'dex'; return null; }, handleTrainClick(e) { if (!userConfig.bestGym) return false; const btn = e.target && e.target.closest ? e.target.closest('button') : null; if (!btn) return false; const stat = this._statFromLabel(btn.getAttribute('aria-label') || ''); if (!stat || this._suppressed[stat]) return false; const scan = this.scanGyms(); const best = this.bestGymFor(stat, scan); if (!best || best === scan.active) return false; const gym = scan.gyms[best]; if (!gym || !this.swapToGym(gym)) return false; e.preventDefault(); e.stopImmediatePropagation(); this._suppressed[stat] = true; return true; } };


/**
 *  [SECTION VI] THE GYM EQUIPMENT (UI Layer)
 *  ========================================================================
 *  Whether you use it for a day or you use it for ten years:
 *  You should still get a Tetanus Booster!
 */


const CAL_IMG_BASE = cdnize('https://raw.githubusercontent.com/BigBlackHawk42069/asdfaskijdnfawef/refs/heads/main/ScrptImgs/Calendar/');

function buildChartSVG(sl) { const stats = sl && sl.stats; const keys = ['str', 'def', 'spd', 'dex']; const colors = ['#4a6070', '#7a3d36', '#8a6530', '#486644']; const xs = [4, 9.5, 15, 20.5]; const maxH = 14, minH = 2; const vals = keys.map(k => stats && stats[k] ? stats[k].end : 0); const maxVal = Math.max(...vals); const hs = vals.map(v => maxVal > 0 ? Math.max(v / maxVal * maxH, minH) : maxH * 0.25); const lines = keys.map((k, i) => { return `<line x1="${xs[i]}" y1="20" x2="${xs[i]}" y2="${(20 - hs[i]).toFixed(2)}" stroke="${colors[i]}" stroke-width="5" stroke-linecap="round"/>`; }); const bgLines = keys.map((k, i) => `<line x1="${xs[i]}" y1="20" x2="${xs[i]}" y2="${(20 - hs[i]).toFixed(2)}" stroke="#000" stroke-width="7" stroke-linecap="round"/>`); return `<svg viewBox="0 0 24 24" fill="none">${bgLines.join('')}${lines.join('')}</svg>`; }

const CAP_W = 500, CAP_H = 100, CAP_N = 5;

const CAP_PAD_X = 8, CAP_PAD_Y = 18, CAP_GAP = 7;

const CAP_SLOT_W = (CAP_W - 2 * CAP_PAD_X - (CAP_N - 1) * CAP_GAP) / CAP_N;

const CAP_SLOT_H = CAP_H - 2 * CAP_PAD_Y;

const CAP_TERM_W = 10;

const CAP_BAR_DEFS = `<defs>` + `<pattern id="bbc-hatch" width="8" height="8" patternUnits="userSpaceOnUse">` + `<line x1="0" y1="8" x2="8" y2="0" stroke="#fff" stroke-opacity=".1" stroke-width="1"/>` + `<line x1="-2" y1="2" x2="2" y2="-2" stroke="#fff" stroke-opacity=".1" stroke-width="1"/>` + `<line x1="6" y1="10" x2="10" y2="6" stroke="#fff" stroke-opacity=".1" stroke-width="1"/>` + `</pattern>` + `<linearGradient id="bbc-housing" x1="0" y1="0" x2="0" y2="1">` + `<stop offset="0" stop-color="#202020"/><stop offset=".4" stop-color="#363636"/>` + `<stop offset=".5" stop-color="#404040"/><stop offset=".6" stop-color="#363636"/>` + `<stop offset="1" stop-color="#181818"/></linearGradient>` + `<linearGradient id="bbc-term" x1="0" y1="${CAP_PAD_Y}" x2="0" y2="${CAP_PAD_Y + CAP_SLOT_H}" gradientUnits="userSpaceOnUse">` + `<stop offset="0" stop-color="#1e1e1e"/><stop offset=".25" stop-color="#484848"/>` + `<stop offset=".5" stop-color="#606060"/><stop offset=".75" stop-color="#484848"/>` + `<stop offset="1" stop-color="#161616"/></linearGradient>` + `<linearGradient id="bbc-recess-shadow" x1="0" y1="0" x2="0" y2="1">` + `<stop offset="0" stop-color="#000" stop-opacity=".6"/><stop offset=".5" stop-color="#000" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>` + `<linearGradient id="bbc-recess-shine" x1="0" y1="0" x2="0" y2="1">` + `<stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".35"/></linearGradient>` + `<linearGradient id="bbc-gD" x1="0" y1="1" x2="1" y2="0">` + `<stop offset="0" stop-color="#004422"/><stop offset=".33" stop-color="#336611"/>` + `<stop offset=".66" stop-color="#006644"/><stop offset="1" stop-color="#2d5c00"/></linearGradient>` + `<linearGradient id="bbc-gL" x1="0" y1="1" x2="1" y2="0">` + `<stop offset="0" stop-color="#008844"/><stop offset=".33" stop-color="#66bb22"/>` + `<stop offset=".66" stop-color="#00cc88"/><stop offset="1" stop-color="#44aa00"/></linearGradient>` + `<linearGradient id="bbc-oD" x1="0" y1="1" x2="1" y2="0">` + `<stop offset="0" stop-color="#886600"/><stop offset=".33" stop-color="#aa7700"/>` + `<stop offset=".66" stop-color="#ddbb66"/><stop offset="1" stop-color="#774400"/></linearGradient>` + `<linearGradient id="bbc-oL" x1="0" y1="1" x2="1" y2="0">` + `<stop offset="0" stop-color="#ffcc00"/><stop offset=".33" stop-color="#ffdd44"/>` + `<stop offset=".66" stop-color="#fff8cc"/><stop offset="1" stop-color="#cc8800"/></linearGradient>` + `<linearGradient id="bbc-dD" x1="0" y1="1" x2="1" y2="0">` + `<stop offset="0" stop-color="#882299"/><stop offset=".33" stop-color="#3366aa"/>` + `<stop offset=".66" stop-color="#339966"/><stop offset="1" stop-color="#993366"/></linearGradient>` + `<linearGradient id="bbc-dL" x1="0" y1="1" x2="1" y2="0">` + `<stop offset="0" stop-color="#ee77ff"/><stop offset=".33" stop-color="#88bbff"/>` + `<stop offset=".66" stop-color="#77ffcc"/><stop offset="1" stop-color="#ff77cc"/></linearGradient>` + `<filter id="bbc-tube-glow" x="-20%" y="-30%" width="140%" height="160%" color-interpolation-filters="sRGB">` + `<feGaussianBlur stdDeviation="4" result="blur"/>` + `<feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>` + `</filter>` + `<linearGradient id="bbc-s" x1="0" y1="0" x2="0" y2="1">` + `<stop offset="0" stop-color="#1e1e1e"/><stop offset=".35" stop-color="#484848"/>` + `<stop offset=".5" stop-color="#686868"/><stop offset=".65" stop-color="#484848"/>` + `<stop offset="1" stop-color="#161616"/></linearGradient>` + `</defs>`;

const CAP_WIN_LEFT_PCT = [];

const CAP_WIN_DELAY_FWD_S = [];

const CAP_WIN_DELAY_BWD_S = [];

let CAP_WIN_WIDTH_PCT, CAP_WIN_TOP_PCT, CAP_WIN_HEIGHT_PCT;

(() => { const PASS_S = 0.6; const FORWARD_SPREAD_S = 1.2; const BACKWARD_SPREAD_S = 1.2; const PHASE1_END_S = FORWARD_SPREAD_S + PASS_S; for (let i = 0; i < CAP_N; i++) { const bx = CAP_PAD_X + i * (CAP_SLOT_W + CAP_GAP), gx = bx + CAP_TERM_W, gw = CAP_SLOT_W - 2 * CAP_TERM_W, winY = CAP_PAD_Y + 18, winH = CAP_SLOT_H - 18 * 2, fy = winY + 3, fh = winH - 3 * 2; CAP_WIN_LEFT_PCT.push(gx / CAP_W * 100); CAP_WIN_DELAY_FWD_S.push(gx / CAP_W * FORWARD_SPREAD_S); CAP_WIN_DELAY_BWD_S.push(PHASE1_END_S + (CAP_W - gx) / CAP_W * BACKWARD_SPREAD_S); CAP_WIN_WIDTH_PCT = gw / CAP_W * 100; CAP_WIN_TOP_PCT = fy / CAP_H * 100; CAP_WIN_HEIGHT_PCT = fh / CAP_H * 100; } })();

const _capBarCache = new Map();

function buildCapsuleBar(slots, lit, animated) { const cacheKey = slots.join(',') + '|' + lit + '|' + animated; const cached = _capBarCache.get(cacheKey); if (cached) return cached; const W = CAP_W, H = CAP_H, n = CAP_N; const padX = CAP_PAD_X, padY = CAP_PAD_Y, gap = CAP_GAP; const slotW = CAP_SLOT_W, slotH = CAP_SLOT_H; const termW = CAP_TERM_W; const colorKey = { green: 'g', gold: 'o', diamond: 'd', silver: 's' }; const f = v => v.toFixed(2); let out = `<rect width="${W}" height="${H}" fill="url(#bbc-housing)"/>`; let overlay = ''; for (let i = 0; i < n; i++) { const bx = padX + i * (slotW + gap); const by = padY; out += `<rect x="${f(bx)}" y="${by}" width="${f(slotW)}" height="${slotH}" fill="#000" fill-opacity=".5"/>`; out += `<rect x="${f(bx)}" y="${by}" width="${f(slotW)}" height="${slotH}" fill="url(#bbc-recess-shadow)"/>`; out += `<rect x="${f(bx)}" y="${by}" width="${f(slotW)}" height="3" fill="#000" fill-opacity=".6"/>`; out += `<rect x="${f(bx)}" y="${f(by + slotH - 1.5)}" width="${f(slotW)}" height="1.5" fill="#fff" fill-opacity=".15"/>`; const color = slots[i]; if (!color) continue; out += `<rect x="${f(bx)}" y="${by}" width="${termW}" height="${slotH}" fill="url(#bbc-term)"/>`; out += `<rect x="${f(bx)}" y="${by}" width="${termW}" height="${slotH}" fill="url(#bbc-hatch)"/>`; out += `<rect x="${f(bx + slotW - termW)}" y="${by}" width="${termW}" height="${slotH}" fill="url(#bbc-term)"/>`; out += `<rect x="${f(bx + slotW - termW)}" y="${by}" width="${termW}" height="${slotH}" fill="url(#bbc-hatch)"/>`; out += `<rect x="${f(bx)}" y="${by}" width="${f(slotW)}" height="2.5" fill="#000" fill-opacity=".4"/>`; const gx = bx + termW, gw = slotW - 2 * termW; const gy = by, gh = slotH; const railH = 18; const winY = gy + railH, winH = gh - railH * 2; const fillInset = 3; const fy = winY + fillInset, fh = winH - fillInset * 2; const fid = colorKey[color]; const fillId = fid === 's' ? 's' : fid + (lit ? 'L' : 'D'); out += `<rect x="${f(gx)}" y="${gy}" width="${f(gw)}" height="${railH}" fill="url(#bbc-term)"/>`; out += `<rect x="${f(gx)}" y="${gy}" width="${f(gw)}" height="${railH}" fill="url(#bbc-hatch)"/>`; out += `<rect x="${f(gx)}" y="${f(gy + gh - railH)}" width="${f(gw)}" height="${railH}" fill="url(#bbc-term)"/>`; out += `<rect x="${f(gx)}" y="${f(gy + gh - railH)}" width="${f(gw)}" height="${railH}" fill="url(#bbc-hatch)"/>`; if (lit && color !== 'silver') out += `<g filter="url(#bbc-tube-glow)">`; out += `<rect x="${f(gx)}" y="${fy}" width="${f(gw)}" height="${fh}" fill="url(#bbc-${fillId})"/>`; out += `<rect x="${f(gx)}" y="${fy}" width="${f(gw)}" height="${fh}" fill="url(#bbc-recess-shadow)" opacity="${lit ? 0.4 : 1}"/>`; out += `<rect x="${f(gx)}" y="${fy}" width="${f(gw)}" height="${fh}" fill="url(#bbc-recess-shine)"/>`; if (lit && color !== 'silver') out += `</g>`; if (animated && color !== 'silver') { overlay += `<div class="bbgl-cap-win" style="left:${CAP_WIN_LEFT_PCT[i].toFixed(2)}%;width:${CAP_WIN_WIDTH_PCT.toFixed(2)}%;top:${CAP_WIN_TOP_PCT.toFixed(2)}%;height:${CAP_WIN_HEIGHT_PCT.toFixed(2)}%">` + `<div class="bbgl-cap-sweep bbgl-cap-sweep-pass-fwd bbgl-cap-sweep-${color}" style="animation-delay:${CAP_WIN_DELAY_FWD_S[i].toFixed(3)}s"></div>` + `<div class="bbgl-cap-sweep bbgl-cap-sweep-pass-bwd bbgl-cap-sweep-${color}" style="animation-delay:${CAP_WIN_DELAY_BWD_S[i].toFixed(3)}s"></div>` + `</div>`; } } const svg = `<svg class="bbgl-cap-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${CAP_BAR_DEFS}${out}</svg>`; const html = overlay ? svg + `<div class="bbgl-cap-overlay">${overlay}</div>` : svg; _capBarCache.set(cacheKey, html); return html; }

function updateSummaryCharts() { const mBtn = document.getElementById('month-stats-btn'); const yBtn = document.getElementById('year-stats-btn'); if (!mBtn || !yBtn) return; const y = calendarState.year, m = calendarState.month; mBtn.innerHTML = buildChartSVG(app.DataController.getSlice('MONTH', CONSTANTS.MONTHS[m], y)); yBtn.innerHTML = buildChartSVG(app.DataController.getSlice('YEAR', String(y))); const aBtn = document.getElementById('all-time-btn'); if (aBtn) aBtn.innerHTML = buildChartSVG(app.DataController.getSlice('ALL', 'All-Time')); mBtn.setAttribute('data-tooltip-html', app.generateRichTooltip(app.DataController.getSlice('MONTH', CONSTANTS.MONTHS[m], y))); yBtn.setAttribute('data-tooltip-html', app.generateRichTooltip(app.DataController.getSlice('YEAR', String(y)))); if (aBtn) aBtn.setAttribute('data-tooltip-html', app.generateRichTooltip(app.DataController.getSlice('ALL', 'All-Time'))); const activeL = viewState.activeViewLabel; mBtn.classList.toggle('active', activeL === CONSTANTS.MONTHS[m]); yBtn.classList.toggle('active', activeL === String(y)); if (aBtn) aBtn.classList.toggle('active', activeL === 'All-Time'); }

function injectBestGymToggle() { const existing = document.getElementById('bbgl-bestgym'); if (existing) { dom.bestGym = existing; return; } if (!document.getElementById('gymroot')) return; const host = document.getElementById('top-page-links-list'); if (!host) return; const pill = document.createElement('div'); pill.id = 'bbgl-bestgym'; pill.className = 'bbgl-bestgym'; pill.innerHTML = `<label class="bbgl-switch bbgl-switch-purple"><input type="checkbox" id="bbgl-bestgym-input"><span class="slider"></span></label><svg class="bbgl-bestgym-logo" xmlns="http://www.w3.org/2000/svg" viewBox="60 20 280 215"><g transform="scale(1, 1.15)"><path fill="currentColor" d="${ICONS.LOGO_PATH}"></path></g></svg><span class="bbgl-bestgym-label" data-tooltip-html="${app.TOOLTIPS.BEST_GYM}">BB Best Gym</span>`; const cb = pill.querySelector('#bbgl-bestgym-input'); cb.checked = !!userConfig.bestGym; cb.onchange = () => setBestGym(cb.checked); host.appendChild(pill); dom.bestGym = pill; }

function setBestGym(v) { userConfig.bestGym = v; saveConfig(); const a = document.getElementById('set-bestgym-toggle'); if (a) a.checked = v; const b = document.getElementById('bbgl-bestgym-input'); if (b) b.checked = v; const sp = document.getElementById('set-bestgym-spec-toggle'); if (sp) { const row = sp.closest('.bbgl-setting-row'); if (row) row.classList.toggle('bbgl-row-disabled', !v); } const up = document.getElementById('set-bestgym-unpurch-toggle'); if (up) { const row = up.closest('.bbgl-setting-row'); if (row) row.classList.toggle('bbgl-row-disabled', !v); } }

app.BestGymController = BestGymController;
app.CAL_IMG_BASE = CAL_IMG_BASE;
app.buildChartSVG = buildChartSVG;
app.CAP_W = CAP_W;
app.CAP_PAD_X = CAP_PAD_X;
app.CAP_SLOT_W = CAP_SLOT_W;
app.CAP_SLOT_H = CAP_SLOT_H;
app.CAP_TERM_W = CAP_TERM_W;
app.CAP_BAR_DEFS = CAP_BAR_DEFS;
app.CAP_WIN_LEFT_PCT = CAP_WIN_LEFT_PCT;
app.CAP_WIN_DELAY_FWD_S = CAP_WIN_DELAY_FWD_S;
app.CAP_WIN_DELAY_BWD_S = CAP_WIN_DELAY_BWD_S;
app.CAP_WIN_WIDTH_PCT = CAP_WIN_WIDTH_PCT;
app._capBarCache = _capBarCache;
app.buildCapsuleBar = buildCapsuleBar;
app.updateSummaryCharts = updateSummaryCharts;
app.injectBestGymToggle = injectBestGymToggle;
app.setBestGym = setBestGym;
export { BestGymController, CAL_IMG_BASE, buildChartSVG, CAP_W, CAP_PAD_X, CAP_SLOT_W, CAP_SLOT_H, CAP_TERM_W, CAP_BAR_DEFS, CAP_WIN_LEFT_PCT, CAP_WIN_DELAY_FWD_S, CAP_WIN_DELAY_BWD_S, CAP_WIN_WIDTH_PCT, _capBarCache, buildCapsuleBar, updateSummaryCharts, injectBestGymToggle, setBestGym };

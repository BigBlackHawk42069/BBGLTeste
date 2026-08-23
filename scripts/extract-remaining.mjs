import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const legacyPath = join(root, 'src/legacy.js');
const src = readFileSync(legacyPath, 'utf8');

const bootMatch = src.match(/export function boot\(\) \{([\s\S]*)\n\}\n?$/);
if (!bootMatch) throw new Error('Could not find export function boot()');
const body = bootMatch[1];

const DROP_NAMES = new Set([
  'ITEM_LOG_META', 'TimeManager', 'rawState', 'rawConfig',
  'compareVersions', 'ACH_FMT', 'Formatter',
  'BBGL_ERROR_CODE', 'bbglError', 'MSG_KEY_FORMAT_INVALID', 'MSG_CLIPBOARD_DENIED',
  'MSG_KEY_NETWORK_ERROR', 'MSG_SYNC_NETWORK_ERROR', 'MSG_SYNC_QUOTA',
  'TORN_KEY_ERROR_MAP', 'tornKeyErrorText', 'saveViewState', 'saveConfig',
  'getISOWeek', 'classifyDay', 'CAPSULE_RANK', 'TIER_UNITS', 'placeCapsuleUnit',
  'computeWeekCapsules', 'computeWeekCompletion',
  'LEVEL_FLOOR', 'LEVEL_P0_MAX', 'LEVEL_ATRO_MULT', 'LEVEL_STEP1_END', 'LEVEL_STEP1_VAL',
  'LEVEL_STEP2_END', 'LEVEL_STEP2_VAL', 'LEVEL_TAIL_POWER',
  'computeLevelExpCost', 'LEVEL_ATRO_BUDGETS', 'calculateLevelProgress',
  'ATROPHY_TITLES', 'atrophyTitle', 'computeDailyLevelExp', 'getWeekKey',
  'STAT_KEYS', 'sumStats', 'findHappyJumps', 'normalizeApiLogs', 'initializeDayObject'
]);

function isWs(c) { return c === ' ' || c === '\t' || c === '\n' || c === '\r'; }

function skipString(s, i) {
  const q = s[i];
  i++;
  while (i < s.length) {
    if (s[i] === '\\') { i += 2; continue; }
    if (s[i] === q) return i + 1;
    i++;
  }
  return i;
}

function skipTemplate(s, i) {
  i++;
  while (i < s.length) {
    if (s[i] === '\\') { i += 2; continue; }
    if (s[i] === '`') return i + 1;
    if (s[i] === '$' && s[i + 1] === '{') {
      i = skipBalanced(s, i + 2, '{', '}');
      continue;
    }
    i++;
  }
  return i;
}

function skipBalanced(s, i, open, close) {
  let depth = 1;
  while (i < s.length && depth > 0) {
    const c = s[i];
    if (c === '"' || c === "'") { i = skipString(s, i); continue; }
    if (c === '`') { i = skipTemplate(s, i); continue; }
    if (c === '/' && s[i + 1] === '/') { i = s.indexOf('\n', i); if (i < 0) return s.length; continue; }
    if (c === '/' && s[i + 1] === '*') { i = s.indexOf('*/', i + 2); i = i < 0 ? s.length : i + 2; continue; }
    if (c === open) depth++;
    else if (c === close) depth--;
    i++;
  }
  return i;
}

function skipRegexOrSlash(s, i) {
  if (s[i] !== '/') return i + 1;
  if (s[i + 1] === '/') {
    const n = s.indexOf('\n', i + 2);
    return n < 0 ? s.length : n;
  }
  if (s[i + 1] === '*') {
    const n = s.indexOf('*/', i + 2);
    return n < 0 ? s.length : n + 2;
  }
  const prev = s.slice(0, i).trimEnd();
  const last = prev[prev.length - 1];
  const canRegex = !last || /[(\[{,;=:!?&|~^%<>]/.test(last) || /\b(?:return|case|throw|typeof|delete|void|in|of|new)$/.test(prev);
  if (!canRegex) return i + 1;
  i++;
  while (i < s.length) {
    if (s[i] === '\\') { i += 2; continue; }
    if (s[i] === '[') { i = skipBalanced(s, i + 1, '[', ']'); continue; }
    if (s[i] === '/') {
      i++;
      while (i < s.length && /[a-z]/i.test(s[i])) i++;
      return i;
    }
    i++;
  }
  return i;
}

function consumeStatement(s, start) {
  let i = start;
  while (i < s.length && isWs(s[i])) i++;
  if (i >= s.length) return { end: s.length, text: s.slice(start) };
  if (s.startsWith('//', i)) {
    const n = s.indexOf('\n', i);
    return { end: n < 0 ? s.length : n + 1, text: s.slice(start, n < 0 ? s.length : n + 1) };
  }
  if (s.startsWith('/*', i)) {
    const n = s.indexOf('*/', i + 2);
    const end = n < 0 ? s.length : n + 2;
    let j = end;
    if (s[j] === '\n') j++;
    return { end: j, text: s.slice(start, j) };
  }

  let depthParen = 0, depthBrace = 0, depthBracket = 0;
  let started = false;
  while (i < s.length) {
    const c = s[i];
    if (c === '"' || c === "'") { i = skipString(s, i); started = true; continue; }
    if (c === '`') { i = skipTemplate(s, i); started = true; continue; }
    if (c === '/') { i = skipRegexOrSlash(s, i); started = true; continue; }
    if (c === '(') { depthParen++; started = true; i++; continue; }
    if (c === ')') { depthParen--; i++; continue; }
    if (c === '{') { depthBrace++; started = true; i++; continue; }
    if (c === '}') {
      depthBrace--;
      i++;
      if (depthBrace === 0 && depthParen === 0 && depthBracket === 0) {
        let k = i;
        while (k < s.length && isWs(s[k])) k++;
        if (s.startsWith('else', k)) { i = k; continue; }
        if (s[k] === ';') { i = k + 1; break; }
        if (s.startsWith('function', start.trimStart ? undefined : 0)) { break; }
        const head = s.slice(start, start + 40).trim();
        if (/^(async\s+)?function\s/.test(head) || /^(const|let|var)\s/.test(head)) {
          if (s[k] === ';') i = k + 1;
          break;
        }
        if (s[k] === ';' || s[k] === '\n' || k >= s.length) {
          if (s[k] === ';') i = k + 1;
          break;
        }
      }
      continue;
    }
    if (c === '[') { depthBracket++; started = true; i++; continue; }
    if (c === ']') { depthBracket--; i++; continue; }
    if (c === ';' && depthParen === 0 && depthBrace === 0 && depthBracket === 0) {
      i++;
      break;
    }
    started = true;
    i++;
  }
  return { end: i, text: s.slice(start, i) };
}

function parseStatements(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    if (s.slice(i).trim() === '') break;
    const stmt = consumeStatement(s, i);
    out.push(stmt.text);
    if (stmt.end <= i) throw new Error('parser stuck at ' + i);
    i = stmt.end;
  }
  return out;
}

function declaredName(text) {
  const t = text.trim();
  let m = t.match(/^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/);
  if (m) return m[1];
  m = t.match(/^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)/);
  if (m) return m[1];
  return null;
}

function shouldDrop(text) {
  const t = text.trim();
  if (t === 'void isDevMode;' || t === 'void isDevMode') return true;
  if (t.startsWith('// Constants, shared state')) return true;
  const name = declaredName(text);
  if (name && DROP_NAMES.has(name)) return true;
  if (/^if\s*\(\s*rawState\s*\)/.test(t)) return true;
  if (/^if\s*\(\s*rawConfig\s*\)/.test(t)) return true;
  if (t.includes("localStorage.getItem(KEYS.DEMO) === '1'")) return true;
  if (t.includes("sessionStorage.getItem(KEYS.DEV_MODE) === 'true'")) return true;
  if (/^if\s*\(\s*!viewState\.calYear\s*\)/.test(t)) return true;
  return false;
}

function remap(text) {
  return text
    .replace(/_historyCache = ([^;]+);/g, 'setHistoryCache($1);')
    .replace(/_lastButtonLocation = ([^;]+);/g, 'setLastButtonLocation($1);')
    .replace(/_historyCache/g, 'historyCache')
    .replace(/_TAB_ID/g, 'TAB_ID')
    .replace(/_refreshClickLog/g, 'refreshClickLog')
    .replace(/_lastButtonLocation/g, 'lastButtonLocation')
    .replace(/_topCeilingCache = ([^;]+); _topCeilingTs = ([^;]+);/g, 'setTopCeiling($1, $2);')
    .replace(/_topCeilingCache = ([^;]+);/g, 'setTopCeiling($1, topCeilingTs);')
    .replace(/_topCeilingTs = ([^;]+);/g, 'setTopCeiling(topCeilingCache, $1);')
    .replace(/_topCeilingCache/g, 'topCeilingCache')
    .replace(/_topCeilingTs/g, 'topCeilingTs')
    .replace(/_layoutObservers/g, 'layoutObservers')
    .replace(/viewState = ns;/g, 'setViewState(ns);');
}

const FILE_OF = {
  DBManager: 'data/db.js',
  defaultBackfill: 'data/sanitize.js',
  normalizeBackfill: 'data/sanitize.js',
  sanitizeMeta: 'data/sanitize.js',
  sanitizeEntry: 'data/sanitize.js',
  sanitizeDayRecord: 'data/sanitize.js',
  sanitizeStorageRecord: 'data/sanitize.js',
  validateImportSchema: 'data/sanitize.js',
  exportData: 'data/import-export.js',
  importData: 'data/import-export.js',
  importDataFromWelcome: 'data/import-export.js',
  clearData: 'data/import-export.js',
  factoryReset: 'data/import-export.js',
  incrementApiCount: 'data/torn-api.js',
  resetRefreshBtn: 'data/torn-api.js',
  checkRefreshCooldown: 'data/torn-api.js',
  universalFetch: 'data/torn-api.js',
  _syncChannel: 'data/sync.js',
  _xtabSyncTimer: 'data/sync.js',
  syncWithFeedback: 'data/sync.js',
  startBackgroundSync: 'data/sync.js',
  checkExitSync: 'data/sync.js',
  scheduleHeartbeat: 'data/sync.js',
  DataController: 'domain/history.js',
  getActiveHistory: 'domain/history.js',
  getInstallWeekKey: 'domain/history.js',
  getInstallDateKey: 'domain/history.js',
  getStickerState: 'domain/history.js',
  persistStickerCleared: 'domain/history.js',
  generateDemoData: 'domain/demo.js',
  TooltipController: 'ui/tooltip.js',
  GraphController: 'ui/graph.js',
  BestGymController: 'ui/best-gym.js',
  cacheDOM: 'ui/panel.js',
  setupEventListeners: 'boot/events.js',
  init: 'boot/init.js',
  installDomHooks: 'boot/init.js',
  handleStorageEvent: 'boot/init.js'
};

function classifyName(name) {
  if (!name) return null;
  if (FILE_OF[name]) return FILE_OF[name];
  if (/^(sanitize|validateImport|defaultBackfill|normalizeBackfill)/.test(name)) return 'data/sanitize.js';
  if (/^(exportData|importData|clearData|factoryReset)/.test(name)) return 'data/import-export.js';
  if (/^(universalFetch|incrementApiCount|resetRefreshBtn|checkRefreshCooldown)/.test(name)) return 'data/torn-api.js';
  if (/sync|Heartbeat|ExitSync|_syncChannel|_xtabSync/i.test(name)) return 'data/sync.js';
  if (/backfill|Backfill|persistBackfill|finalizeBackfill|recoverInterrupted|proceedPartial|acknowledgeBackfill|BACKFILL_/i.test(name)) return 'data/backfill.js';
  if (/War|FactionHistory/i.test(name)) return 'data/wars.js';
  if (/^(DataController|getActiveHistory|getInstall|getStickerState|persistStickerCleared)$/.test(name)) return 'domain/history.js';
  if (/[Dd]emo/.test(name)) return 'domain/demo.js';
  if (/Ach|ach_|computeAchievements|gotoAchievements|resizeAch/.test(name)) return 'ui/achievements-view.js';
  if (/Tooltip/.test(name)) return 'ui/tooltip.js';
  if (/getDashboardHTML|getWelcomeHTML|getSettings|populateWelcome|^TOOLTIPS$/.test(name)) return 'ui/templates.js';
  if (/GraphController/.test(name)) return 'ui/graph.js';
  if (/[Ss]ticker|[Vv]iewer|animateViewer|openItem|closeItem|sponsor|Sponsor/.test(name)) return 'ui/stickers.js';
  if (/fetchDoc|[Pp]rivacy|[Cc]hangelog|[Ff]eatureGuide/.test(name)) return 'ui/docs.js';
  if (/[Ss]canOverlay|buildScan|wireScan|currentScan|^SCAN_/.test(name)) return 'ui/scan-overlay.js';
  if (/BestGym/.test(name)) return 'ui/best-gym.js';
  if (/inject|handleDomMutation|sidebar|SB_|footer|handleGymClick|onChangeLoc|onChangeDayStart|onChangeWeekStart|attachLayout|handleLayout|updateFooter|syncSidebar|syncChangelog|refreshInit|refreshDemo|markPanelResizing/.test(name)) return 'ui/torn-inject.js';
  if (/ledger|renderStats|buildSessionText|flashCopied/.test(name)) return 'ui/ledger.js';
  if (/[Cc]alendar|changeMonth|renderPanel|weekly|levelBar|updateLevel|updateCell|openHistory|closeHistory|calcAllTime|calcPeriod/.test(name)) return 'ui/calendar.js';
  if (/setupEventListeners/.test(name)) return 'boot/events.js';
  if (/^init$|installDomHooks|handleStorageEvent|checkViewRouting|renderPageMode/.test(name)) return 'boot/init.js';
  if (/togglePanel|closePanel|switchView|restoreInternal|toggleTall|toggleLedger|toggleGraph|toggleSticker|toggleAch|toggleSettings|updateTransformOrigin/.test(name)) return 'ui/panel.js';
  return null;
}

const SHARED_IMPORTS = `import { CUSTOM_STICKERS, PAGE_TITLES, cdnize } from '{{P}}ui/assets.ts';
import { ASSETS, ICONS } from '{{P}}ui/icons.ts';
import { injectStyles } from '{{P}}ui/styles.ts';
import {
  ACH_FMT, BACKFILL, BACKFILL_GROUP_KEYS, BACKFILL_GROUP_OF, BACKFILL_GROUPS,
  BASE_DOCS_URL, BBGL_ERROR_CODE, BS_STAT_ROWS, compareVersions, CONSTANTS, ECAN_LOG, ECSTASY_LOG, ENERGY_LOGS, ENERGY_PARAM,
  EX_OD_LOG, GAME, GYM_TIERS, HAPPY_LOGS, ITEM_GROUP_LABELS, ITEM_LOG_META, ITEM_LOGS, KEYS, LAYOUT, LSD_OD_LOG,
  MSG_CLIPBOARD_DENIED, MSG_KEY_FORMAT_INVALID, MSG_KEY_NETWORK_ERROR, MSG_SYNC_NETWORK_ERROR, MSG_SYNC_QUOTA,
  OD_LOGS, r2, SCRIPT_VERSION, STAT_ENHANCER_PARAM, STAT_HAPPY_PARAM, STAT_KEYS, STAT_LOGS, SYNC_FROM_BUFFER,
  TORN_KEY_ERROR_MAP, TRAIN_ENERGY_PARAM, TRAIN_LOGS, WIPE_BELOW_VERSION, XANAX_LOG, XANAX_OD_LOG, ZERO_BREAKDOWN,
  bbglError, tornKeyErrorText
} from '{{P}}core/constants.ts';
import { Log, Perf, isDevMode } from '{{P}}core/log.ts';
import {
  ALLOWED_CONFIG_KEYS, TAB_ID, calendarState, dom, graphState, historyCache, lastButtonLocation, layoutObservers,
  refreshClickLog, runtime, saveConfig, saveViewState, setHistoryCache, setLastButtonLocation, setTopCeiling, setViewState,
  topCeilingCache, topCeilingTs, userConfig, viewState
} from '{{P}}core/state.ts';
import { Formatter, TimeManager, getISOWeek, getWeekKey } from '{{P}}domain/time.ts';
import { classifyDay, computeWeekCapsules, computeWeekCompletion, placeCapsuleUnit } from '{{P}}domain/capsules.ts';
import { atrophyTitle, calculateLevelProgress, computeDailyLevelExp, computeLevelExpCost } from '{{P}}domain/leveling.ts';
import { findHappyJumps, initializeDayObject, normalizeApiLogs, sumStats } from '{{P}}domain/day.ts';
`;

function prefixFor(file) {
  return file.startsWith('boot/') || file.startsWith('data/') || file.startsWith('domain/') || file.startsWith('ui/') ? '../' : './';
}

function replaceCrossRefs(code, localNames, allNames) {
  const others = [...allNames].filter(n => !localNames.has(n));
  others.sort((a, b) => b.length - a.length);
  let out = '';
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    if (c === '"' || c === "'") {
      const n = skipString(code, i);
      out += code.slice(i, n);
      i = n;
      continue;
    }
    if (c === '`') {
      const n = skipTemplate(code, i);
      out += code.slice(i, n);
      i = n;
      continue;
    }
    if (c === '/' && code[i + 1] === '/') {
      const n = code.indexOf('\n', i);
      const end = n < 0 ? code.length : n;
      out += code.slice(i, end);
      i = end;
      continue;
    }
    if (c === '/' && code[i + 1] === '*') {
      const n = code.indexOf('*/', i + 2);
      const end = n < 0 ? code.length : n + 2;
      out += code.slice(i, end);
      i = end;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i + 1;
      while (j < code.length && /[\w$]/.test(code[j])) j++;
      const word = code.slice(i, j);
      const prev = i > 0 ? code[i - 1] : '';
      if (others.includes(word) && prev !== '.' && prev !== '"' && prev !== "'") {
        out += 'app.' + word;
      } else {
        out += word;
      }
      i = j;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

const statements = parseStatements(body);
const kept = [];
for (const stmt of statements) {
  if (shouldDrop(stmt)) continue;
  kept.push(remap(stmt));
}

const files = new Map();
let current = 'ui/panel.js';
const fileNames = new Map();
const allDeclNames = new Set();

for (const stmt of kept) {
  const name = declaredName(stmt);
  const classified = classifyName(name);
  if (classified) current = classified;
  if (!files.has(current)) files.set(current, []);
  files.get(current).push(stmt);
  if (name) {
    allDeclNames.add(name);
    if (!fileNames.has(current)) fileNames.set(current, new Set());
    fileNames.get(current).add(name);
  }
}

const isBootKick = t => /^\s*installDomHooks\(\)/.test(t) || /document\.readyState === 'loading'/.test(t);
for (const [file, stmts] of files) {
  files.set(file, stmts.filter(stmt => !isBootKick(stmt)));
}

writeFileSync(join(root, 'src/app-context.js'), 'export const app = {};\n');

const created = [];
for (const [file, stmts] of files) {
  if (!stmts.length) continue;
  const abs = join(root, 'src', file);
  mkdirSync(dirname(abs), { recursive: true });
  const p = prefixFor(file);
  const locals = fileNames.get(file) || new Set();
  let code = stmts.join('\n').replace(/^    /gm, '');
  code = replaceCrossRefs(code, locals, allDeclNames);
  const exports = [...locals];
  const header = `import { app } from '${p}app-context.js';\n` + SHARED_IMPORTS.replaceAll('{{P}}', p);
  const assign = exports.length
    ? `\n${exports.map(n => `app.${n} = ${n};`).join('\n')}\n` + `export { ${exports.join(', ')} };\n`
    : '';
  writeFileSync(abs, header + '\n' + code + '\n' + assign);
  created.push({ file, names: exports, bytes: code.length });
}

const moduleImports = created.map(({ file }, i) => {
  const id = `mod${i}`;
  return { id, file, spec: `../${file}` };
});

const bootTs = `${moduleImports.map(m => `import * as ${m.id} from '${m.spec}';`).join('\n')}
import { app } from '../app-context.js';

void ${moduleImports.map(m => m.id).join(', ')};

export function boot() {
  if (app.TooltipController) window.TooltipController = app.TooltipController;
  if (typeof app.installDomHooks === 'function') app.installDomHooks();
  if (typeof app.init === 'function') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', app.init);
    else app.init();
  }
}
`;

writeFileSync(join(root, 'src/boot/boot.ts'), bootTs);
writeFileSync(join(root, 'src/main.ts'), `import { boot } from './boot/boot.ts';

if (!window.__BBGL_LOADED__) {
  window.__BBGL_LOADED__ = true;
  boot();
}
`);

unlinkSync(legacyPath);

console.log('Extracted files:');
for (const c of created) console.log(`  ${c.file} (${c.names.length} exports, ${c.bytes} chars) ${c.names.slice(0, 8).join(', ')}`);
console.log('declarations', allDeclNames.size);

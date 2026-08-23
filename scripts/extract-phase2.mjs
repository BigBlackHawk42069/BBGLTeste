import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const legacyPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'src/legacy.js');
let src = readFileSync(legacyPath, 'utf8');

const imports = `import { CUSTOM_STICKERS, PAGE_TITLES, cdnize } from './ui/assets.ts';
import { ASSETS, ICONS } from './ui/icons.ts';
import { injectStyles } from './ui/styles.ts';
import {
  ACH_FMT, BACKFILL, BACKFILL_GROUP_KEYS, BACKFILL_GROUP_OF, BACKFILL_GROUPS,
  BASE_DOCS_URL, BBGL_ERROR_CODE, BS_STAT_ROWS, compareVersions, CONSTANTS, ECAN_LOG, ECSTASY_LOG, ENERGY_LOGS, ENERGY_PARAM,
  EX_OD_LOG, GAME, GYM_TIERS, HAPPY_LOGS, ITEM_GROUP_LABELS, ITEM_LOG_META, ITEM_LOGS, KEYS, LAYOUT, LSD_OD_LOG,
  MSG_CLIPBOARD_DENIED, MSG_KEY_FORMAT_INVALID, MSG_KEY_NETWORK_ERROR, MSG_SYNC_NETWORK_ERROR, MSG_SYNC_QUOTA,
  OD_LOGS, r2, SCRIPT_VERSION, STAT_ENHANCER_PARAM, STAT_HAPPY_PARAM, STAT_KEYS, STAT_LOGS, SYNC_FROM_BUFFER,
  TORN_KEY_ERROR_MAP, TRAIN_ENERGY_PARAM, TRAIN_LOGS, WIPE_BELOW_VERSION, XANAX_LOG, XANAX_OD_LOG, ZERO_BREAKDOWN,
  bbglError, tornKeyErrorText
} from './core/constants.ts';
import { Log, Perf, isDevMode } from './core/log.ts';
import {
  ALLOWED_CONFIG_KEYS, TAB_ID, calendarState, dom, graphState, historyCache, lastButtonLocation, layoutObservers,
  refreshClickLog, runtime, saveConfig, saveViewState, setHistoryCache, setLastButtonLocation, setTopCeiling, setViewState,
  topCeilingCache, topCeilingTs, userConfig, viewState
} from './core/state.ts';
import { Formatter, TimeManager, getISOWeek, getWeekKey } from './domain/time.ts';
import { classifyDay, computeWeekCapsules, computeWeekCompletion, placeCapsuleUnit } from './domain/capsules.ts';
import { atrophyTitle, calculateLevelProgress, computeDailyLevelExp, computeLevelExpCost } from './domain/leveling.ts';
import { findHappyJumps, initializeDayObject, normalizeApiLogs, sumStats } from './domain/day.ts';
`;

src = src.replace(/^import[\s\S]*?\n\nexport function boot\(\) \{/, `${imports}\nexport function boot() {`);

src = src.replace(
  /    function isDevMode\(\)[\s\S]*?if \(!viewState\.calYear\) \{ const _n = TimeManager\.now\(\); calendarState\.year = _n\.year; calendarState\.month = _n\.month; \}\n\n/,
  ''
);

src = src.replace(
  /    function compareVersions\(a, b\) \{[\s\S]*?const Formatter = \{[\s\S]*?dateFull\(s\) \{[\s\S]*?\}; \};\n/,
  ''
);

src = src.replace(
  /    const BBGL_ERROR_CODE = 'Error Code: 69420';\n    function bbglError\(msg\) \{ alert\(msg \+ `\\n\\n\$\{BBGL_ERROR_CODE\}`\); \}\n    const MSG_KEY_FORMAT_INVALID = [\s\S]*?function tornKeyErrorText\(data\) \{[\s\S]*?\}\n    function saveViewState\(\) \{[\s\S]*?\}\n    function saveConfig\(\) \{[\s\S]*?\}\n/,
  ''
);

src = src.replace(
  /    function getISOWeek\(s\) \{[\s\S]*?function getWeekKey\(dateStr\) \{[\s\S]*?\}\n/,
  ''
);

src = src.replace(/    const STAT_KEYS = \['str', 'def', 'spd', 'dex'\];\n/, '');
src = src.replace(/    function sumStats\(o\) \{[^}]+\} /, '');
src = src.replace(/    function findHappyJumps\(seriesArr\) \{[\s\S]*?return jumps; \} /, '');
src = src.replace(/    function normalizeApiLogs\(rawLogs\) \{[\s\S]*?\.sort\(\(a, b\) => a\.ts - b\.ts\); \} \n/, '');
src = src.replace(/    function initializeDayObject\(dateStr, baseBreakdown\) \{[\s\S]*?series: \[\] \}; \} \n/, '');

src = src.replace(/_historyCache = ([^;]+);/g, 'setHistoryCache($1);');
src = src.replace(/_lastButtonLocation = ([^;]+);/g, 'setLastButtonLocation($1);');
src = src.replace(/_historyCache/g, 'historyCache');
src = src.replace(/_TAB_ID/g, 'TAB_ID');
src = src.replace(/_refreshClickLog/g, 'refreshClickLog');
src = src.replace(/_lastButtonLocation/g, 'lastButtonLocation');
src = src.replace(/_topCeilingCache = ([^;]+); _topCeilingTs = ([^;]+);/g, 'setTopCeiling($1, $2);');
src = src.replace(/_topCeilingCache = ([^;]+);/g, 'setTopCeiling($1, topCeilingTs);');
src = src.replace(/_topCeilingCache/g, 'topCeilingCache');
src = src.replace(/_topCeilingTs = ([^;]+);/g, 'setTopCeiling(topCeilingCache, $1);');
src = src.replace(/_topCeilingTs/g, 'topCeilingTs');
src = src.replace(/_layoutObservers/g, 'layoutObservers');
src = src.replace(/viewState = ns;/g, 'setViewState(ns);');
src = src.replace(/viewState = \{ \.\.\.viewState, \.\.\.saved \};/g, 'setViewState({ ...viewState, ...saved });');

writeFileSync(legacyPath, src);
console.log('Phase 2 strip applied');

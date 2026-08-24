import type { ItemLogMeta, StatBreakdown, StatKey } from '../types.ts';

export const SCRIPT_VERSION = '0.9.91';
export const WIPE_BELOW_VERSION = '0.9.90';
export const BASE_DOCS_URL = 'https://raw.githubusercontent.com/BigBlackHawk42069/BigBlackGymLog/DevBranch/UserDocs/';

export const KEYS = {
  STATE: 'bbgl_view_state_v1',
  CONFIG: 'bbgl_config_v1',
  SESSION: 'bbgl_trained_flag',
  LAST_SYNC: 'bbgl_last_data_sync_v1',
  SESSION_CACHE: 'bbgl_session_cache_v1',
  DEMO: 'bbgl_demo_mode',
  SB_NOTIF: 'bbgl_sb_notif_seen',
  DEV_MODE: 'bbgl_dev_mode',
  CHANGELOG_VER: 'bbgl_changelog_seen_ver',
  CHANGELOG_NOTIF: 'bbgl_changelog_notif',
  WARS_SYNC: 'bbgl_wars_last_sync_v1',
  WARS_DATA: 'bbgl_wars_data_v1',
  FACTION_HISTORY: 'bbgl_faction_history_v1'
} as const;

export const CONSTANTS = {
  MONTHS: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  MONTHS_SHORT: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  COLORS: { STR: '#3264c6', DEF: '#dc3912', SPD: '#ff9900', DEX: '#109618', TOT: '#9d039d', GAINS: '#69f0ae' }
} as const;

export const GAME = {
  GOLD_WEEK_JUMPS: 3,
  HJ_WINDOW_SECONDS: 300,
  HJ_QUARTER_SECONDS: 900,
  STAT_MAP: { 5300: 'strength', 5301: 'defense', 5302: 'speed', 5303: 'dexterity' } as Record<number, string>
};

export const ITEM_LOG_META: Record<number, ItemLogMeta> = {
  8981: { label: 'Green Egg Used', group: 'energy', energy: true, short: 'Egg', achLabel: 'Green Eggs Used' },
  2290: { label: 'Xanax Taken', group: 'energy', energy: true, short: 'Xans' },
  2230: { label: 'LSD Taken', group: 'energy', energy: true, short: 'LSD' },
  2040: { label: 'Energy Can Used', group: 'energy', energy: true, short: 'Cans', achLabel: 'Energy Cans Used' },
  2190: { label: 'Hotel Coupon Used', group: 'energy', energy: true, short: 'FHC', achLabel: 'FHCs Used', achTipLabel: 'Feathery Hotel Coupons Used' },
  4900: { label: 'Points Refill Used', group: 'energy', energy: true, short: 'Refill', achLabel: 'Refills Used' },
  2120: { label: 'Parachute Used', group: 'stat', stat: true, achLabel: 'Parachutes Used' },
  2130: { label: 'Skateboard Used', group: 'stat', stat: true, achLabel: 'Skateboards Used' },
  2140: { label: 'Boxing Gloves Used', group: 'stat', stat: true },
  2150: { label: 'Dumbbells Used', group: 'stat', stat: true },
  2020: { label: 'Candy Used', group: 'happy', happy: true },
  2180: { label: 'Erotic DVD Used', group: 'happy', happy: true, achLabel: 'Erotic DVDs Used' },
  2210: { label: 'Ecstasy Taken', group: 'happy', happy: true },
  8983: { label: 'Yellow Egg Used', group: 'happy', happy: true, achLabel: 'Yellow Eggs Used' },
  2291: { label: 'Xanax OD', group: 'od', energyLost: true, short: 'Xan OD' },
  2231: { label: 'LSD OD', group: 'od', energyLost: true, short: 'LSD OD' },
  2211: { label: 'Ecstasy OD', group: 'od', happyLost: true, energyLost: true, short: 'Ex OD' }
};

export const ITEM_GROUP_LABELS = { energy: 'Energy Items', stat: 'Stat Items', happy: 'Happy Items', od: 'OD Items' } as const;

export const ITEM_LOGS = Object.keys(ITEM_LOG_META).map(Number);
const itemLogsByGroup = (g: ItemLogMeta['group']) => ITEM_LOGS.filter(id => ITEM_LOG_META[id].group === g);
export const TRAIN_LOGS = [5300, 5301, 5302, 5303];
export const ENERGY_LOGS = itemLogsByGroup('energy');
export const STAT_LOGS = itemLogsByGroup('stat');
export const HAPPY_LOGS = itemLogsByGroup('happy');
export const OD_LOGS = itemLogsByGroup('od');
export const TRAIN_ENERGY_PARAM = [...TRAIN_LOGS, ...ENERGY_LOGS].join(',');
export const STAT_HAPPY_PARAM = [...HAPPY_LOGS, ...OD_LOGS].join(',');
export const STAT_ENHANCER_PARAM = STAT_LOGS.join(',');
export const ENERGY_PARAM = ENERGY_LOGS.join(',');
export const BACKFILL_GROUPS = { trainEnergy: TRAIN_ENERGY_PARAM, statHappy: STAT_HAPPY_PARAM, statEnhancers: STAT_ENHANCER_PARAM };
export const BACKFILL_GROUP_KEYS = Object.keys(BACKFILL_GROUPS);
export const BACKFILL_GROUP_OF: Record<string, string> = {};
[...TRAIN_LOGS, ...ENERGY_LOGS].forEach(c => { BACKFILL_GROUP_OF[String(c)] = 'trainEnergy'; });
[...HAPPY_LOGS, ...OD_LOGS].forEach(c => { BACKFILL_GROUP_OF[String(c)] = 'statHappy'; });
STAT_LOGS.forEach(c => { BACKFILL_GROUP_OF[String(c)] = 'statEnhancers'; });

export const XANAX_LOG = 2290;
export const XANAX_OD_LOG = 2291;
export const LSD_OD_LOG = 2231;
export const EX_OD_LOG = 2211;
export const ECAN_LOG = 2040;
export const ECSTASY_LOG = 2210;
export const SYNC_FROM_BUFFER = 3 * 3600;
export const BACKFILL = {
  SOFT_CAP: 38000,
  HARD_CAP: 40000,
  COOLDOWN_MS: Math.round(24.1 * 3600 * 1000),
  THROTTLE_MS: 700,
  CHECKPOINT_ROWS: 2000,
  HEARTBEAT_MS: 15000,
  LOCK_STALE_MS: 45000,
  ORIGIN_MAX_STAT: 50
};
export const GYM_TIERS: Record<StatKey, Array<number | number[]>> = {
  str: [1, 2, 3, 4, [5, 6], 7, 8, 10, 9, [11, 12, 13], 14, [16, 17], [19, 20], 18, [22, 23], 21, 24, 26, 27, 31, 32],
  spd: [1, 2, [3, 4], [5, 6], 8, 9, [10, 11], 12, 13, 15, 14, 16, 17, [18, 20, 21], [19, 22], 23, 24, 26, 29, 31, 32],
  def: [1, 2, 3, 4, 5, 6, 7, [8, 9], [10, 13], 12, 11, [14, 15], 16, 18, [17, 19, 21], 20, [22, 23], 24, 25, 28, 31, 32],
  dex: [1, 2, 3, 5, 7, 6, 8, 9, 10, 11, 12, [13, 14], 15, 16, [17, 18], [21, 22], [19, 23], 20, 24, 25, 30, 31, 32]
};
export const BS_STAT_ROWS = [
  { api: 'strength', abbr: 'str' as const },
  { api: 'defense', abbr: 'def' as const },
  { api: 'speed', abbr: 'spd' as const },
  { api: 'dexterity', abbr: 'dex' as const }
];
export const LAYOUT = { LIFT_HEIGHT: 43, BASE_RIGHT: 5 };
export const STAT_KEYS: StatKey[] = ['str', 'def', 'spd', 'dex'];
export const ZERO_BREAKDOWN: StatBreakdown = Object.freeze({ str: 0, def: 0, spd: 0, dex: 0 });
export const r2 = (v: number) => Math.round(v * 100) / 100;

export const ACH_FMT = {
  compact: [[1e6, 2], [1e4, 1]] as Array<[number, number]>,
  gains: [[1e12, 4], [1e9, 3]] as Array<[number, number]>,
  enhancers: [[1e6, 3], [1e5, 2]] as Array<[number, number]>,
  rewards: [] as Array<[number, number]>
};

export const BBGL_ERROR_CODE = 'Error Code: 69420';
export const MSG_KEY_FORMAT_INVALID = 'Invalid Format.\nA Torn API Key must be exactly 16 alphanumeric characters.';
export const MSG_CLIPBOARD_DENIED = 'Clipboard access denied. Please paste manually.';
export const MSG_KEY_NETWORK_ERROR = 'Network error while verifying your API key. Please try again.';
export const MSG_SYNC_NETWORK_ERROR = "Couldn't reach Torn's servers. Check your connection and try again.";
export const MSG_SYNC_QUOTA = "Sync failed because your browser ran out of local storage space. Close all open Torn tabs, clear your browser cache, and reload the page.";
export const TORN_KEY_ERROR_MAP: Record<number, string> = {
  2: "That key doesn't look valid — double-check you copied it correctly.",
  5: "Torn's API rate limit was hit. Wait a moment and try again.",
  8: "Torn has temporarily blocked API requests from your network. Wait a bit and try again.",
  10: "This key's owner is in federal jail, which disables their API key until release.",
  13: "This key's owner has been inactive too long and Torn has temporarily disabled it.",
  14: "Torn's daily API read limit has been reached for this key. Try again tomorrow.",
  16: "This key doesn't have the access level BBGL needs. Make sure it's a Custom key with Basic, Battle Stats, Log, and Faction access — not Public or Minimal.",
  18: "This key has been paused by its owner in Torn's API settings. Re-enable it there, or generate a new one."
};

export function compareVersions(a: string, b: string): number {
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

export function bbglError(msg: string): void {
  alert(msg + `\n\n${BBGL_ERROR_CODE}`);
}

export function tornKeyErrorText(data: { error?: { code?: number; error?: string } } | null | undefined): string {
  const err = data && data.error;
  if (!err) return 'Torn rejected this key for an unknown reason.';
  return TORN_KEY_ERROR_MAP[err.code as number] || `Torn says: "${err.error}".`;
}

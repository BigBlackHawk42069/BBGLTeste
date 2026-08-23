# Domain Types

All shared shapes live in [`src/types.ts`](../../../src/types.ts). Sanitize, import, rebuild, and slice code are written against these names. If you add a field to a persisted record, update this file **and** [`sanitize.js`](../../../src/data/sanitize.js) in the same change.

## Battle stats

```ts
export type StatKey = 'str' | 'def' | 'spd' | 'dex';
export type StatBreakdown = Record<StatKey, number>;
```

Torn API uses full names (`strength`, `defense`, `speed`, `dexterity`). Internally everything is the four-letter key. `GAME.STAT_MAP` and `BS_STAT_ROWS` are the bridges:

| Torn log id | API field | `StatKey` |
|---|---|---|
| 5300 | strength | `str` |
| 5301 | defense | `def` |
| 5302 | speed | `spd` |
| 5303 | dexterity | `dex` |

`ZERO_BREAKDOWN` is a frozen `{ str:0, def:0, spd:0, dex:0 }`. Always spread it (`{ ...ZERO_BREAKDOWN }`) before mutating.

## Series entries

A day's `series` is a time-ordered mix of gym trains and item uses.

```ts
export interface GymEntry {
  type?: 'gym';          // omitted on some older/synthetic rows — treat missing as gym
  id?: string;           // Torn log key
  ts: number;            // unix seconds
  stat: StatKey;
  key?: string;          // full name ('strength', …)
  gain: number;
  cost: number;          // energy spent
  after: number;         // battlestat after this click
  rate?: number;         // gain / cost * 150
  synthetic?: boolean;   // invented from day aggregates when series was missing
}

export interface ItemEntry {
  type: 'item';
  id?: string;
  ts: number;
  logId: number;         // Torn item log id (2290 Xanax, 2210 ecstasy, …)
  energy?: number;
  energyLost?: number;
  happy?: number;
  happyLost?: number;
  statKey?: StatKey;     // parachute / skateboard / gloves / dumbbells
  statGain?: number;
  synthetic?: boolean;
}

export type SeriesEntry = GymEntry | ItemEntry;
```

`GymEntry.type` is optional because flattened / pre-extract rows sometimes omit it. `normalizeApiLogs` always writes `type: 'gym'`. Dedup keys:

- Gym: `` `${ts}_${stat}_${after}` ``
- Item: `` `item_${id}` `` (reconcile) or `` `${ts}_${logId}` `` (day itemLogIds / backfill)

## Day record

```ts
export interface DayRecord {
  date: string;                    // YYYY-MM-DD logical (UTC or local — see TimeManager)
  startTotal: number;
  endTotal: number;
  startBreakdown: StatBreakdown;
  endBreakdown: StatBreakdown;
  gains: StatBreakdown & { total: number };
  eSpent: StatBreakdown & { total: number };
  items: Record<string, number>;   // logId → count
  itemLogIds: string[];            // `${ts}_${logId}` dedup
  itemEnergy: number;
  itemHappy: number;
  itemEnergyLost?: number;
  itemHappyLost?: number;
  lastLogTimestamp: number;
  series: SeriesEntry[];
}
```

`initializeDayObject(dateStr, baseline)` copies the baseline into both start and end, zeros gains/eSpent, and empty series. Rebuild then walks the series and mutates end/gains.

## History + backfill meta

```ts
export interface BackfillState {
  acknowledged?: boolean;
  lastResult?: string;          // 'partial' | 'complete'
  stopReason?: string;          // 'paused' | 'error' | 'interrupted' | 'cap'
  completion?: string;          // 'origin' | 'exhausted'
  cooldownUntil?: number;
  lock?: number;                // heartbeat Date.now()
  lockOwner?: string;           // TAB_ID
  rowsUsed?: number;
  targets?: { frontiers?: Record<string, { cursor: number; complete: boolean }> };
}

export interface HistoryMeta {
  version?: string;
  baselineBreakdown?: StatBreakdown;
  logStartDate?: number;        // unix seconds — floor for display + sync
  rewardStartDate?: number;     // unix seconds — sticker / level gating
  syncFloor?: Record<string, number>; // per-group last successful sync
  stickers?: Record<string, string>;  // id → two-char '+'/'-' pairs
  backfill?: BackfillState;
}

export interface HistoryState {
  meta: HistoryMeta;
  history: DayRecord[];         // all days except logical today
  today: DayRecord;
}
```

Sticker state encoding: two characters, `[unlocked][cleared]`, each `+` or `-`. Example `'+-'` = unlocked, not cleared. See [History Engine](../domain/history-engine.md).

## Slices

`DataController.getSlice(mode, target, year?)` / `_hydrate` return a `Slice` — the unit the ledger, graph, and achievements consume.

```ts
export interface SliceStat {
  start: number;
  gain: number;
  end: number;
  cost: number;
  rate: number;
}

export interface Slice {
  label: string;
  resolution: string;           // 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'ALL'
  date: string;
  stats: Record<string, SliceStat>; // StatKey + 'total'
  meta: { tier: number; isGap: boolean; totalEnergy: number };
  _dailyList: DayRecord[];
  _weekStart?: string;
  _weekEnd?: string;
  items?: Record<string, number>;
  xanax?: number;
  // … OD / ecan rollups
}
```

`meta.tier`: `0` none, `1` green (1000E or happy-jump day), `2` gold (1500E), `3` diamond (2000E). Gap days (`isGap`) invent a slice from the previous day's end so the calendar still paints.

## Config and UI state

```ts
export interface UserConfig {
  apiKey: string;                         // 16 alphanumeric
  dayStartMode: 'utc' | 'local';
  weekStartMode: 'mon' | 'sun';
  animations: boolean;
  buttonLocation: 'both' | 'notes' | 'sidebar';
  ratesEnabled: boolean;
  bestGym: boolean;
  bestGymSpecialist: boolean;
  bestGymUnpurchased: boolean;
  drugTracker: string;                    // ledger drug column
  privacyAgreed: string;                  // ISO timestamp when agreed
}

export interface ViewState {
  expanded: boolean;
  isOpen: boolean;
  isTall: boolean;
  subView: string;                        // 'ledger' | 'graph' | 'stickers' | 'achievements' | 'settings' | 'welcome' | 'viewer'
  graphMode: string;
  calYear: number | null;
  calMonth: number | null;
  activeViewLabel: string | null;
  currentStickerPage: number;
  achPage: number;
  achEnhPeriodMode: boolean;
  graphStats?: string[];
  activeItemId?: number | null;
}
```

`ALLOWED_CONFIG_KEYS` is `Object.keys(userConfig)`. Import/export and `saveConfig` only persist those keys — extra JSON fields are dropped.

`RuntimeState` is the ephemeral bag (`demoMode`, `backfilling`, sticker viewer RAF, `careerLevelExp`, …). It is **not** written to disk except indirectly (`KEYS.DEMO`, session `KEYS.DEV_MODE`).

## Item log catalog

```ts
export interface ItemLogMeta {
  label: string;
  group: 'energy' | 'stat' | 'happy' | 'od';
  energy?: boolean;
  energyLost?: boolean;
  happy?: boolean;
  happyLost?: boolean;
  stat?: boolean;
  short?: string;
  achLabel?: string;
  achTipLabel?: string;
}
```

The live table is `ITEM_LOG_META` in `constants.ts`. Adding a Torn log id there automatically:

- includes it in `ENERGY_PARAM` / `STAT_HAPPY_PARAM` / `STAT_ENHANCER_PARAM`
- maps it into the correct backfill group via `BACKFILL_GROUP_OF`
- lets `normalizeApiLogs` emit an `ItemEntry`

Xanax energy is hardcoded to **250** (`XANAX_LOG = 2290`) regardless of the API `energy_increased` field.

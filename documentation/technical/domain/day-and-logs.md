# Day Records & API Normalization

Source: [`src/domain/day.ts`](../../../src/domain/day.ts).  
Tests: [`src/domain/day.test.ts`](../../../src/domain/day.test.ts).

## Creating a day

```ts
export function initializeDayObject(dateStr: string, baseBreakdown: StatBreakdown): DayRecord
```

Copies `baseBreakdown` into `startBreakdown` **and** `endBreakdown`, zeros `gains` / `eSpent` (including `.total`), empty `items` / `series`. `startTotal` / `endTotal` are the four-stat sums.

`sumStats(o)` is the same four-stat sum used after grind/snap.

## Torn log → series

```ts
export function normalizeApiLogs(rawLogs: Record<string, RawTornLog> | null | undefined): SeriesEntry[]
```

Torn returns `{ [logKey]: { log, timestamp, data } }`.

1. If `ITEM_LOG_META[l.log]` exists → `ItemEntry`:
   - Xanax (`2290`) energy is **always 250**
   - other energy items: `data.energy_increased`
   - ODs: `energy_decreased` / `happy_decreased`
   - happy items: `happy_increased`
   - stat items: first of `strength|defense|speed|dexterity_increased`
2. Else if `GAME.STAT_MAP[l.log]` (5300–5303) → `GymEntry` with `gain`, `after`, `cost` (`energy_used`), `rate = gain/cost*150`.
3. Unknown log ids are dropped.
4. Sort by `ts` ascending.

This is the only place raw Torn logs should be decoded. Backfill and `universalFetch` both funnel through it.

## Happy jumps

```ts
export function findHappyJumps(seriesArr): Array<{ date, ts, tsEnd, cost, stats }>
```

An ecstasy dose (`ECSTASY_LOG = 2210`) opens a window until the end of the current 15-minute quarter (`GAME.HJ_QUARTER_SECONDS = 900`). Gym clicks (`type !== 'item'` with `cost`) inside `[dose.ts, windowEnd)` are summed. If `cost >= 1000`, it is a jump.

`DataController.getHappyJumpData()` caches a `Set` of jump dates for capsule gold-week logic and `_hydrate` tier-1 painting.

## Implementing a change

- New consumable: add a row to `ITEM_LOG_META` (group + flags). Do not special-case ids in views.
- New gym log shape: extend `normalizeApiLogs` and the day tests.
- Do not apply logs directly to `historyCache` from a view — go through `DataController._applyLogToState` / `processDataPayload` so day rollover and IndexedDB stay consistent.

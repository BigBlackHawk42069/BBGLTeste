# History Engine

Sources:

- Pure rebuild/reconcile: [`src/domain/history-engine.ts`](../../../src/domain/history-engine.ts)
- Orchestrator: [`src/domain/history.js`](../../../src/domain/history.js) (`DataController`, `getActiveHistory`)
- Tests: [`src/domain/history.test.ts`](../../../src/domain/history.test.ts)

`history.js` imports CSS-free modules plus `CUSTOM_STICKERS` from `ui/assets.ts` (known layering leak). Tests import **`history-engine.ts` only** — do not import `history.js` from Node tests.

## Active history

```js
function getActiveHistory() {
  if (runtime.demoMode) {
    if (!runtime.demoHistory) runtime.demoHistory = app.generateDemoData();
    return runtime.demoHistory;
  }
  if (historyCache) return historyCache;
  return { meta: { baselineBreakdown: { ...ZERO_BREAKDOWN }, backfill: app.defaultBackfill() },
           history: [], today: initializeDayObject(Formatter.dateLogical(), { ...ZERO_BREAKDOWN }) };
}
```

Every reader (calendar, ledger, graph, achievements, backfill button) must use `app.getActiveHistory()`, never a stale local copy.

## DataController surface

| Method | Role |
|---|---|
| `hydrate(loaded)` | `setHistoryCache` + `invalidate` |
| `syncCache(stored)` | sanitize → rebuild from `stored.series` → cache |
| `invalidate` / `invalidateToday` | drop timeline/slice/rate/sticker caches; full also clears `runtime.stickerData` and `_achCache` |
| `getTimeline` / `getDateMap` | history + today, floored by `logStartDate` |
| `getSlice(mode, target, year)` | `DAY` / `MONTH` / `YEAR` / `ALL` / `CUSTOM` (week) |
| `_hydrate` | build `Slice` stats, items, tier |
| `getHistoricalRate` / `getOriginRate` | last known 150E rate at or before a date |
| `buildProgressionCache` | stickers + `runtime.careerLevelExp` |
| `getStickerMap` / `getUnlockedCount` / `getFeaturedDays` / `getCareerLevelExp` | cache accessors |
| `getHappyJumpData` | `{ hjDaySet }` |
| `isStickerCleared` / `markStickerCleared` | `meta.stickers` two-char codes |
| `processDataPayload(apiLogs, apiBattlestats)` | normalize → incremental or full reconcile → grind → persist → `bbgl:dataUpdated` |
| `_runDailyGrind` / `_applyLogToState` / `_snapToBattlestats` | append new logs after `lastLogTimestamp` |
| `_rebuildFromSeries` | wrapper around pure `rebuildFromSeries` + Perf |
| `_reconcileIncremental` | wrapper around `reconcileIncremental` |
| `_reconcileFull` | merge API window into stored series, rebuild everything |
| `flattenAllSeries` | days → series (synthesizes gym rows if a day has gains but no series) |
| `saveSmartHistory` | persist all days + invalidate |

## Rebuild (pure)

```ts
export function rebuildFromSeries(seriesArr: SeriesEntry[], baselineBreakdown: StatBreakdown)
```

Walks the series in timestamp order:

- New logical date → `initializeDayObject` seeded from the **running** breakdown (carry-forward).
- Item: increment `items[logId]`, energy/happy lost fields; push to `series` unless `synthetic`.
- Gym: add gain/cost, set `endBreakdown[stat] = after`, update `running[stat]`.
- After the walk: recompute `startTotal` / `endTotal`. Split `today` vs `history` using `Formatter.dateLogical()`.

This is how import, backfill finalize, and full reconcile reconstruct days. Changing it changes **every** user's visible history on next rebuild.

## Incremental reconcile (pure)

```ts
export function reconcileIncremental(s: HistoryState, cleanLogs: SeriesEntry[])
```

Used when a sync returns a time window that overlaps recent days:

1. `minApiTs` / `maxApiTs` from the payload.
2. Days with `date < earliestDay` are **prefix** (kept as-is).
3. Affected days donate series rows that fall outside the window or are not in the API set.
4. Merge kept + API entries, `rebuildFromSeries` from the prefix's last `endBreakdown` (or baseline).
5. Return `{ result: HistoryState, changedDays }` so `saveDays` can write only what changed.

Dedup key: item → `item_${id}`; gym → `${ts}_${stat}_${after}`.

If this throws, `processDataPayload` logs a warning and falls back to `_reconcileFull`.

## processDataPayload algorithm

```
normalizeApiLogs(apiLogs)
filter ts >= meta.logStartDate
if no remaining logs but we have history:
    optional _snapToBattlestats
    roll today if the logical date changed
    persist + bbgl:dataUpdated
    return
try incremental
  on success: grind (new logs only), roll today, persist changed days
else full reconcile from IndexedDB series
if !meta.logStartDate:
    capture baseline from battlestats, stamp logStartDate = rewardStartDate = now
grind remaining
roll today
saveSmartHistory
bbgl:dataUpdated
```

`_runDailyGrind` only applies logs with `ts > max(lastLogTimestamp, logStartDate)`. `_snapToBattlestats` overwrites today's `endBreakdown` from the API and back-computes `startBreakdown = api - today's gains` so the ledger matches Torn even if a click was missed.

## Sticker progression cache

`buildProgressionCache` (not pure — reads `runtime.demoMode` and `historyCache.meta.stickers`):

- Group timeline days by `getWeekKey`, skip current week and days before `rewardStartDate`.
- Accrue `computeDailyLevelExp` for career level.
- For each past week: `computeWeekCompletion` → featured count (0/1/2).
- Roulette days pick `CUSTOM_STICKERS[rouletteCounter * step % unlockedCount]`.
- Featured days take the next unused sticker ids.
- Rewrite `meta.stickers` as `unlocked+cleared` pairs for ids `1…CUSTOM_STICKERS.length`.

Demo mode forces sticker index `0` and `unlockedCount = 1`.

## Implementing a change

- Pure math/rebuild → `history-engine.ts` + `history.test.ts`.
- Persistence / events / sticker side effects → `history.js` via `app.DataController`.
- After mutating `historyCache`, call `DataController.invalidate()` (or `invalidateToday`) and persist through `DBManager.saveDays` / `saveSmartHistory`.
- Never write `historyCache = …` — use `setHistoryCache`.

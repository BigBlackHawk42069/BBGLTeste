# IndexedDB Persistence

Source: [`src/data/db.js`](../../../src/data/db.js) (`DBManager`).

## Schema (v2 — do not migrate casually)

```
indexedDB.open('bbgl_db', 2)
  store 'meta'   key 'meta'     → HistoryMeta
  store 'days'   key dateStr    → DayRecord
```

`onupgradeneeded` deletes the v1 `history` store if present, then creates `meta` and `days`. Bumping the version without an upgrade handler will brick existing DBs.

## API

| Method | Behavior |
|---|---|
| `initDB()` | Open v2, cache `this._db` |
| `loadHistory()` | Read meta + all days, `sanitizeMeta` / `sanitizeDayRecord`, split `today` vs `history`, invent empty today if missing |
| `saveDays(meta, dayObjs)` | `_persist(..., replaceAll=false)` — upsert listed days |
| `getStorage()` | Flatten all days to `{ meta, series }` (synthesizes gym rows for days that only have aggregates) |
| `setStorage(data)` | Rebuild days from `data.series`, `_persist(..., replaceAll=true)` |
| `clearStorage()` | Clear both stores; **re-seed `rewardStartDate = now`** in the same transaction |

`getStorage` / `setStorage` are the import/export and backfill merge surface. `loadHistory` is the boot surface.

## Why `clearStorage` reseeds `rewardStartDate`

`getInstallWeekKey()` treats a missing `rewardStartDate` as "no gating" (fail open). If you wipe and then immediately Backfill from Settings, pre-clear weeks would count as eligible sticker weeks. Reseeding in the same transaction closes that window. `logStartDate` is **not** seeded — the next `FULL_SYNC` still captures current battlestats as `baselineBreakdown`.

## Cross-tab

On successful persist or clear:

```js
app._syncChannel.postMessage({ type: 'update', from: TAB_ID });
```

See [Torn API & Sync](./torn-api-and-sync.md). Quota failures (`QuotaExceededError`) alert `MSG_SYNC_QUOTA` via `bbglError` and reject.

## Implementing a change

- New persisted field on a day → add it to `DayRecord`, write it in rebuild/grind, sanitize it, and accept it on import.
- New meta field → `sanitizeMeta` default + export allowlist (export currently **strips** `syncFloor` and moves stickers to `_s`).
- Never `indexedDB.deleteDatabase` from production code except inside `factoryReset` → `clearStorage`.
- `DBManager` is on `app.DBManager`. Do not call a bare `DBManager` from another file.

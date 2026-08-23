# Sanitize, Import & Export

Sources:

- [`src/data/sanitize.js`](../../../src/data/sanitize.js)
- [`src/data/import-export.js`](../../../src/data/import-export.js)

## Sanitize

All IndexedDB reads and imports pass through these. They mutate in place and coerce types (Torn/JSON often send numbers as strings).

| Function | Job |
|---|---|
| `defaultBackfill()` | Canonical backfill machine state (see [Backfill](./backfill.md)) |
| `normalizeBackfill(ds)` | Accepts legacy `rowsThisWindow` as `rowsUsed` |
| `sanitizeMeta(metaRaw)` | Ensures `baselineBreakdown` + `backfill`; `parseFloat` stats |
| `sanitizeEntry(e)` | `parseInt`/`parseFloat`; recomputes gym `rate` |
| `sanitizeDayRecord(d)` | Maps `sanitizeEntry` over `d.series` |
| `sanitizeStorageRecord(s)` | `{ meta, series: [] }` fallback |

## Import validation

```js
function validateImportSchema(j) {
  // 1. object
  // 2. if WIPE_BELOW_VERSION !== '0.0.0': j.meta.version >= cutoff
  // 3. j.storage is an object
  // 4. storage.series, if present, is an array
  // 5. baselineBreakdown, if present, has str or def
}
```

A pre-`0.9.90` export is rejected with a user-facing message. This is the second half of the wipe lever — `init()` factory-resets local data; this blocks resurrection via file.

## Export JSON schema (shipped)

`exportData()` writes a **human-readable** file, not a raw IDB dump.

```json
{
  "meta": {
    "version": "0.9.91",
    "exportedAt": "August 23rd, 2026 - 21:00 UTC",
    "itemTotals": { "Energy Items": { "Xanax Taken": 12 }, "…": {} },
    "rankedWars": [ { "id": "…", "start": 0, "end": 0, "winner": 0 } ]
  },
  "config": { "apiKey": "…", "dayStartMode": "utc", "…": "…" },
  "achievements": { },
  "storage": {
    "meta": { "baselineBreakdown": {}, "logStartDate": 0 },
    "series": [
      {
        "day": "August 22nd, 2026 - UTC/CDT",
        "entries": [
          { "at": "12:00:00 UTC / 07:00:00am CDT", "ts": 1, "stat": "str", "gain": 1.2, "cost": 5, "after": 100, "rate": 36 },
          { "Xanax Taken": 1712345678, "e": 250 }
        ]
      }
    ]
  },
  "_s": "{\"1\":\"+-\"}"
}
```

Notes:

- `storage.meta.stickers` and `storage.meta.syncFloor` are stripped from the nested meta; stickers travel in `_s` as a JSON string.
- Gym rows are pretty-printed onto fewer lines via regex after `JSON.stringify`.
- `rankedWars` is optional and only includes wars the user was in after `logStartDate`.
- If `getStorage().series.length` is shorter than the in-memory series, the user is warned before download (stale IDB).

`navigator.canShare` is used on narrow viewports so mobile can AirDrop/share the file.

## Import path

```
FileReader → JSON.parse → validateImportSchema
  → sanitizeStorageRecord
  → if series[0].day exists: flatten human entries back to SeriesEntry
      (item rows are `{ "Xanax Taken": ts, e? }` — mapped via ITEM_LOG_META labels)
  → restore stickers from meta.stickers or _s
  → DBManager.setStorage (rebuild days, replaceAll)
  → setHistoryCache from rebuild
  → merge j.config through ALLOWED_CONFIG_KEYS
  → stamp changelog notif if imported version ≠ SCRIPT_VERSION
  → invalidate + renderPanelContent
```

`importDataFromWelcome` additionally verifies a saved API key against Torn (`battlestats,log&log=5300`). Invalid keys are cleared and the welcome mask is refreshed.

## Clear vs factory reset

| | `clearData` | `factoryReset` |
|---|---|---|
| Confirm? | Yes (user) | No (called from wipe lever) |
| IndexedDB | `clearStorage` | `clearStorage` |
| localStorage | removes `bbgl_*` except `KEYS.CONFIG`, `KEYS.STATE`, `bbgl_initialized` | removes **all** `bbgl_*` |
| `userConfig` | kept | reset to defaults |
| UI | `renderPanelContent` + alert | sets `runtime.wasVersionWiped`, changelog notif |

Both invalidate `DataController` and `setHistoryCache(null)`.

## Implementing a change

- Changing the export shape requires a matching import flatten and a note in this doc. Old files must still import.
- Do not put the API key in `storage` — it lives in `config` only.
- Always go through `app.validateImportSchema` / `app.sanitizeStorageRecord` / `app.DBManager` / `app.DataController` from this file (bare names throw).

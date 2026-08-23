# Big Black Backfill

Source: [`src/data/backfill.js`](../../../src/data/backfill.js). Overlay UI: [`src/ui/scan-overlay.js`](../../../src/ui/scan-overlay.js).

Backfill pages **backward** through Torn log history to reconstruct days older than the 100-entry live window. It is the only writer that is allowed to move `logStartDate` earlier.

## Caps (do not change without a product decision)

```ts
export const BACKFILL = {
  SOFT_CAP: 38000,          // rows per 24.1h window
  HARD_CAP: 40000,
  COOLDOWN_MS: Math.round(24.1 * 3600 * 1000),
  THROTTLE_MS: 700,         // delay between pages
  CHECKPOINT_ROWS: 2000,    // persist series this often
  HEARTBEAT_MS: 15000,      // lock refresh
  LOCK_STALE_MS: 45000,     // other tabs treat lock older than this as dead
  ORIGIN_MAX_STAT: 50
};
```

Torn's rolling 24h log quota is why `SOFT_CAP` sits under 40k. Hitting the cap arms `cooldownUntil = now + COOLDOWN_MS` and sets `stopReason: 'cap'`. After the cooldown, `rowsUsed` resets.

## Groups and frontiers

Three independent cursors (`BACKFILL_GROUP_KEYS`):

| Group | Log param |
|---|---|
| `trainEnergy` | gym 5300–5303 + energy items |
| `statHappy` | happy + OD items |
| `statEnhancers` | parachute / skateboard / gloves / dumbbells |

`ds.targets.frontiers[group] = { cursor: unixSeconds, complete: boolean }`. `ensureBackfillTargets` reseeds any shape that is not exactly these three keys (legacy per-code frontiers) to "now" — already-stored rows are deduped on merge, so a reseed is safe.

Pages use `to=${cursor}` (Torn's "logs older than"). After a page, the cursor walks to the oldest timestamp in that page.

## Lock machine

Persisted on `meta.backfill`:

| Field | Meaning |
|---|---|
| `lock` | `Date.now()` heartbeat of the scanning tab |
| `lockOwner` | `TAB_ID` |
| `rowsUsed` | cumulative rows this quota window |
| `lastResult` | `partial` \| `complete` |
| `stopReason` | `paused` \| `error` \| `interrupted` \| `cap` \| null |
| `completion` | `origin` (hit `ORIGIN_MAX_STAT` / natural start) \| `exhausted` (API dry) |
| `acknowledged` | `false` while the overlay waits for user dismissal |
| `cooldownUntil` | ms timestamp |

Start path (`backfillLogs`):

1. Abort if demo, missing key, already `runtime.backfilling`.
2. If `cooldownUntil` is live → paint button/overlay and return. If elapsed → clear `rowsUsed`.
3. If another tab's `lock` is fresher than `LOCK_STALE_MS` → stand down (passenger).
4. Budget = `SOFT_CAP - rowsUsed`. Zero budget → arm cap cooldown.
5. Persist `lock`/`lockOwner`, set `runtime.backfilling = true`, show overlay **before** faction fetches.

Heartbeats (`HEARTBEAT_MS`) call `persistBackfillState` (meta only — cheap). Series merges (`_persistBackfillSeries`) run every `CHECKPOINT_ROWS` and on finalize. UI cache is **not** rebuilt until `finalizeBackfill` so the calendar does not thrash mid-scan.

`recoverInterruptedBackfill` on `init()`: if `lock` is stale and `lastResult === 'partial'` / `acknowledged === false`, the overlay returns so the user can resume or discard.

## Floor

`computeBackfillFloor` sets `meta.logStartDate` to the first **fully covered** day:

- Per-group oldest stored timestamp.
- The shallowest *incomplete* group's oldest day is only partially covered → floor is **the next day** (`dayStart + 86400`).
- Never raises an existing `logStartDate`.

Baseline is rewritten from the first gym row per stat: `after - gain`.

## Overlay + button

- `renderScanOverlay` / `wireScanOverlay` — pause, cancel (confirm), count, settings-locked copy.
- `renderBackfillButton` — idle / resume / countdown / tap-again-to-confirm (`armBackfillConfirm`, 4s).
- Choice modal (`openBackfillChoiceModal`) on first-run: START EMPTY LOG vs BIG BLACK BACKFILL.

`universalFetch` returns `{ suppressed: true }` while `runtime.backfilling` so heartbeat cannot steal the quota.

## Implementing a change

- Do not raise `SOFT_CAP` without checking Torn's current log window.
- Keep `THROTTLE_MS` so a resume cannot 429.
- Persist lock **before** flipping `runtime.backfilling` so a failed persist cannot strand the flag.
- Passenger tabs must only *read* overlay state from IDB, not start a second loop.

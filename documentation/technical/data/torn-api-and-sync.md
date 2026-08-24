# Torn API & Sync

Sources:

- [`src/torn/api.js`](../../../src/torn/api.js) — `universalFetch`
- [`src/data/sync.js`](../../../src/data/sync.js) — heartbeat, exit sync, BroadcastChannel, some settings HTML

## Key rules

- API key lives only in `userConfig.apiKey` (16 alphanumeric). Verified on save with `fetch('https://api.torn.com/user/?selections=battlestats,log&log=5300&key=…')`.
- **All Torn traffic is `fetch` to `https://api.torn.com/…`.** Docs stay on `GM_xmlhttpRequest`.
- Demo mode and an in-progress backfill suppress `universalFetch` (`{ demo: true }` / `{ suppressed: true }`).
- `incrementApiCount` updates the optional HUD (`#` / `dom.apiHud`).

## Missions

```js
await app.universalFetch(mission, { specId, manualWars })
```

### `FULL_SYNC` (default background / Resync / Refresh)

Parallel `fetch`:

1. `user/?selections=battlestats`
2. `user/?selections=log&log=${TRAIN_ENERGY_PARAM}` — gym 5300–5303 + energy items
3. `user/?selections=log&log=${STAT_HAPPY_PARAM}` — happy + OD items

Each log URL appends `&from=${syncFloor[group] - SYNC_FROM_BUFFER}` when a floor exists. `SYNC_FROM_BUFFER` is 3 hours so Torn clock skew cannot drop a click.

On success:

- Merge `log` objects, stamp `meta.syncFloor[group] = now`.
- `localStorage[KEYS.LAST_SYNC] = Date.now()`.
- `DataController.processDataPayload(logs, battlestats)`.
- If any battlestat is **higher** than `today.endBreakdown`, fire a fourth call for `STAT_ENHANCER_PARAM` (parachute / skateboard / gloves / dumbbells) and process those logs. Almost always a no-op.
- Kick `fetchWars(manualWars)` in parallel (failures never fail the sync).

### `TRAIN_SINGLE`

Used after a gym click (`handleGymClick`). One log request: `specId` (5300–5303) + `ENERGY_PARAM`. No battlestats, no `LAST_SYNC` stamp, no wars.

## Error mapping

Torn `{ error: { code, error } }` becomes `tornKeyErrorText` (`TORN_KEY_ERROR_MAP` in constants: 2, 5, 8, 10, 13, 14, 16, 18). HTTP failures and `Failed to fetch` become `MSG_SYNC_NETWORK_ERROR`. Quota → `MSG_SYNC_QUOTA`. Raw browser strings are never shown.

`syncWithFeedback` drives the Refresh button (Syncing… / Refreshed! / alert). Suppressed (backfill) resets the button silently.

## Heartbeat

```js
function scheduleHeartbeat() {
  // delay = max(0, 30min - time since KEYS.LAST_SYNC)
  setTimeout(async () => {
    await app.universalFetch('FULL_SYNC');
    scheduleHeartbeat();
  }, delay);
}
```

`startBackgroundSync()` is called from `init()` when not in demo.

## Gym-exit sync

Gym clicks set `sessionStorage[KEYS.SESSION] = 'true'`. `checkExitSync()` on init: if that flag is set **and** the URL is not `gym.php`, clear the flag and `FULL_SYNC` so the last trains are not lost when the user leaves the gym SPA page.

## Refresh cooldown

`checkRefreshCooldown(btn)`: more than 4 clicks in 60 seconds disables the button and shows `TOOLTIPS.REFRESH_COOLDOWN(seconds)`. Prevents users from burning Torn's log window.

## BroadcastChannel

```js
const _syncChannel = new BroadcastChannel('bbgl_sync');

_syncChannel.onmessage = (event) => {
  if (event.data?.from === TAB_ID) return;
  if (runtime.demoMode) return;
  // debounce 200ms → loadHistory → hydrate → render panel / scan / backfill button
};
```

`app._syncChannel` is the same instance `DBManager` posts to. `storage` events on `KEYS.LAST_SYNC` are synthesized as `{ from: 'storage_event' }` so older browsers without a channel still refresh.

## Layout helpers living in this file

`getTopCeiling`, `_getLayoutWindows`, `_syncLayoutResizeTargets`, `syncSidebarState`, `syncChangelogNotif`. Settings UI is Preact (`Settings.tsx`).

## Implementing a change

- New Torn selection: add a `reqs` entry with a `floorKey`, extend `BACKFILL_GROUPS` if backfill should scan it, and keep the URL shape (`selections=` + `key=` + optional `from=` + `timestamp=`).
- Do not cache the API key anywhere except `userConfig` / `KEYS.CONFIG`.
- Call `app.universalFetch` / `app.syncWithFeedback`, not a local `fetch` from a view, so demo/backfill suppression and error mapping stay in one place.

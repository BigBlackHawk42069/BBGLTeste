# Boot Sequence

Sources:

- [`src/main.ts`](../../../src/main.ts)
- [`src/boot/boot.ts`](../../../src/boot/boot.ts)
- [`src/boot/init.js`](../../../src/boot/init.js)

## Order of operations

```
IIFE
  import graph (side effects): every extracted module assigns app.*
  main.ts: if !__BBGL_LOADED__ → boot()
    installDomHooks()          // document-start: styles + prototype wrap
    DOMContentLoaded → init()
      injectStyles()
      changelog notif / WIPE_BELOW_VERSION factoryReset
      DBManager.initDB + loadHistory + hydrate
      GraphController.applyDefaultsIfNeeded
      recoverInterruptedBackfill + render buttons/overlay
      stamp bbgl_initialized if we already have history
      storage / hashchange / popstate / resize / bbgl:dataUpdated listeners
      MutationObserver → handleDomMutation
      attachLayoutObservers
      wrap history.pushState/replaceState (re-check nav)
      startBackgroundSync + checkExitSync   (not in demo)
      TooltipController.init + hover/touch/click
      handleDomMutation + checkViewRouting + handleLayout
      Log.boot()
```

`boot.ts` **must** import every module that assigns `app.*` before calling `init`. Adding a new extracted file without adding that import means `app.foo` is undefined at click time.

Current import list (order is dependency-friendly, not alphabetical):

`panel, tooltip, torn-api, history, db, sync, sanitize, wars, backfill, demo, achievements-view, ledger, import-export, best-gym, calendar, torn-inject, templates, docs, graph, stickers, init, scan-overlay, mount`

## init() details

- If `KEYS.CHANGELOG_VER` is missing, set it to `SCRIPT_VERSION` (no pip on first ever load). If it differs, set `KEYS.CHANGELOG_NOTIF = '1'`.
- Wipe: `compareVersions(_seenVer, WIPE_BELOW_VERSION) < 0` → `factoryReset()`.
- IndexedDB failure is non-fatal (`Log.warn`, continue empty) so Torn still works if IDB is blocked.
- `history.pushState` / `replaceState` are wrapped (`_bbglWrapped`) to re-run `handleDomMutation` at 150/600/1500ms after SPA navigations.

## Routing

`checkViewRouting`:

- Hash contains `gymlog` → page mode (`renderPageMode`), maybe open changelog after 400ms
- Else → tear down `#bbgl-page-container`, restore panel or reset selection

`renderPageMode` wipes Torn `.content-wrapper`, injects the native header + dashboard, `mountDashboard(p)`, `restoreInternalState`, `renderPanelContent`. Settings gear in the native header calls `toggleSettingsView`. Page demo-exit forwards `.click()` to `#bbgl-demo-exit`.

## Multi-tab view sync

`handleStorageEvent`:

| Key | Action |
|---|---|
| `KEYS.STATE` | `setViewState`, toggle panel/view/graph/stickers/calendar/tall/expanded to match. `runtime.isSyncing = true` so we do not echo. `notifyUi()` in `finally` so Preact chrome matches. |
| `KEYS.LAST_SYNC` | synthesize `_syncChannel.onmessage` |
| `KEYS.DEMO` | enter or click-exit demo |

## Events

View clicks live on the Preact tree. `init` additionally binds:

- capture-phase `click` on `#bbgl-gym-tab` → `togglePanel(true)`
- `BestGymController.handleTrainClick` then `handleGymClick`
- mousemove / touchstart-move-end for tooltips and scrub

## Implementing a change

- New module: create the file, `app.x = x` at the bottom, **import it in `boot.ts`**.
- New init-time listener: add it in `init()` so both panel and page mode get it.
- New hash route: extend `checkViewRouting` only if it is a first-class shell (today there is only `#gymlog`).
- Do not call `init()` yourself from a view. Do not leave a stray `else init();` at module scope (that was a real extract bug).

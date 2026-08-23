# Demo Mode

Source: [`src/domain/demo.js`](../../../src/domain/demo.js).

Demo mode lets a user click through calendar, ledger, graph, stickers, and achievements **without an API key and without touching IndexedDB**. `universalFetch` and `backfillLogs` no-op while `runtime.demoMode` is true. Settings sections marked `.bbgl-demo-maskable` grow an overlay (`refreshDemoMasks`).

## Flag

- Enter: `localStorage[KEYS.DEMO] = '1'`, `runtime.demoMode = true`, `runtime.demoHistory = null`, `setHistoryCache(null)`, `DataController.invalidate()`.
- `hydratePersistedState` re-enters on load if the key is still `'1'`.
- Other tabs see a `storage` event on `KEYS.DEMO` and call `enterDemo('external')` or click the demo-exit control.
- Exit: the `#bbgl-demo-exit` handler in `setupEventListeners` removes the key, reloads real history via `DBManager.loadHistory()`, optionally restarts background sync.

## Synthetic year

`generateDemoData()` builds 365 days ending at `Formatter.dateLogical()`:

- Seeded LCG (`_seed = 0x9e3779b9`) so the same session is stable once generated (cached on `runtime.demoHistory`).
- Gain model is a log/linear happy × gym-dots formula (`Simulation.A…E`) with jitter — **not** Torn's real formula.
- ~10% rest days; mixed weeks; some diamond / HJ days; the current week's first day is forced ≥2500E so the capsule bar always demos gold.
- `today` is an empty day carrying the last end-breakdown.
- `meta.logStartDate` is the oldest generated day.

`getActiveHistory` lazy-builds this once per demo session.

## Welcome HTML (mis-filed)

These builders are assigned on `app` from `demo.js` but are UI:

- `buildWelcomeIntroSection` — remote welcome copy + privacy button
- `buildWelcomeInitSection` — API key, timezone, week start, START TRACKING
- `buildWelcomeReturningSection` — import existing export

`getWelcomeHTML` in `templates.js` interpolates `app.buildWelcome*`. Do not call them as bare names.

## Implementing a change

- New feature that hits Torn or IndexedDB must early-return when `runtime.demoMode`.
- Do not persist `runtime.demoHistory`.
- If you change `generateDemoData` distribution, check weekly bars + sticker roulette still have something to show on first paint.

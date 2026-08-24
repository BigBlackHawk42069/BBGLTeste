# Technical Documentation Ledger

**Description:**
This document is the master registry for Big Black Gym Log (BBGL): a Tampermonkey userscript that injects a gym / battle-stat tracker into `torn.com`. It is for developers working in this repository. Its purpose is to track documentation of the TypeScript/esbuild source layout, runtime contracts, IndexedDB/localStorage schema, Torn API usage, domain math, the Preact app (`src/ui/preact`), and the Torn adapter (`src/torn`) so a new contributor can change the product without breaking existing installs.

**Product:** Big Black Gym Log `0.9.91`  
**Published artifact:** [`BigBlackGymLog.js`](../BigBlackGymLog.js) at repo root (single IIFE + userscript header).  
**Source of truth:** [`src/`](../src/) — Node is the build environment only. There is no HTTP server and no Prisma/ZenStack. The only runtime library is `preact`, bundled into the IIFE.

**Scope:** Ledger entries document **shipped** code only. Product reviews and implementation plans live outside this tree (for example Cursor plan files) and must not be registered here.

## 1. Documentation Standard & Syntax

To ensure consistency and accountability, all documentation tracking must adhere to the following syntax.

### Status Indicators

- **[ ]** = **Undocumented**: No documentation exists for this feature/component.
- **[P]** = **Partial**: Documentation exists but is incomplete (e.g., missing edge cases or API details).
- **[X]** = **Documented**: Comprehensive documentation exists and is current.
- **[!]** = **Outdated**: Documentation exists but the feature has changed, requiring updates.

### Workflow: Managing Updates

We do not use version tags. Instead, we track the specific reason a feature is outdated directly in the ledger.

1.  **Marking Outdated:** When a feature changes, change its status to `[!]` and add a sub-bullet explaining **why**.
    - _Example:_
      `[!] History Engine - (/documentation/technical/domain/history-engine.md)`
      `  - Incremental reconcile now drops synthetic gym rows`
2.  **Restoring Status:** Once the documentation is updated to reflect the changes, remove the sub-bullet and return the status to `[X]`.
    - _Example:_
      `[X] History Engine - (/documentation/technical/domain/history-engine.md)`

### Reference Format

When marking an item as **[X]**, **[P]**, or **[!]**, you must provide the link/path to the documentation file.

- _Format:_ [Status] Feature Name - (Link to Doc)
- _Example:_ [X] IndexedDB Persistence - (/documentation/technical/data/indexeddb.md)

---

## 2. Technical Modules & Architecture

### A. Core System Architecture

- **[X]** **System Overview & Layering** - (/documentation/technical/architecture.md)
  - [x] Tampermonkey IIFE artifact vs TypeScript source (`src/main.ts` → esbuild → `BigBlackGymLog.js`)
  - [x] Import rules (`core` → `domain` → `data` → `torn` / `ui` → `boot`; `ui/preact` must not import `torn/`)
  - [x] Late-bound `app` object (`src/app-context.js`) for cross-module calls
  - [x] Known extraction leftovers (mis-filed functions, blanket imports)
- **[X]** **Runtime Contracts** - (/documentation/technical/core/runtime-contracts.md)
  - [x] Userscript header (`@match`, `@grant GM_xmlhttpRequest`, `@run-at document-start`, update/download URLs)
  - [x] Load guard `window.__BBGL_LOADED__`
  - [x] Storage keys (`KEYS`) and IndexedDB `bbgl_db` v2
  - [x] `WIPE_BELOW_VERSION = '0.9.90'`
  - [x] `BroadcastChannel('bbgl_sync')` + `storage` events
  - [x] Torn API via `fetch('https://api.torn.com/...')`; docs via `GM_xmlhttpRequest`
  - [x] Remote `UserDocs/*.html` and CDN images (`cdnize()`)
  - [x] Custom event `bbgl:dataUpdated`
- **[X]** **Domain Types** - (/documentation/technical/core/types.md)
  - [x] `StatKey`, `StatBreakdown`, `GymEntry`, `ItemEntry`, `SeriesEntry`, `DayRecord`
  - [x] `HistoryMeta`, `HistoryState`, `BackfillState`, `Slice`
  - [x] `UserConfig`, `ViewState`, `RuntimeState`
- **[X]** **Shared State & Logging** - (/documentation/technical/core/state-and-logging.md)
  - [x] Mutable objects in `src/core/state.ts` (`runtime`, `userConfig`, `viewState`, caches)
  - [x] Setters for reassigned bindings (`setHistoryCache`, `setViewState`)
  - [x] `Log` / `Perf` (`src/core/log.ts`) — `log.ts` must not import `state.ts`

### B. Domain Engine

- **[X]** **Time & Formatting** - (/documentation/technical/domain/time.md)
  - [x] `TimeManager` (UTC vs local day start)
  - [x] `Formatter` (logical dates, dual std/exp display)
  - [x] `getWeekKey` / `getISOWeek`
- **[X]** **Capsule / Weekly Goal Math** - (/documentation/technical/domain/capsules.md)
  - [x] `classifyDay` (green 1000E / gold 1500E / diamond 2000E)
  - [x] `placeCapsuleUnit`, `computeWeekCapsules`, `computeWeekCompletion`
  - [x] Happy-jump allotment (`GAME.GOLD_WEEK_JUMPS`)
- **[X]** **Career Leveling** - (/documentation/technical/domain/leveling.md)
  - [x] `computeLevelExpCost`, `calculateLevelProgress`, `computeDailyLevelExp`
  - [x] Atrophy titles (`Wet Cement` → `Fully Bricked`)
- **[X]** **Day Records & API Normalization** - (/documentation/technical/domain/day-and-logs.md)
  - [x] `initializeDayObject`, `sumStats`, `findHappyJumps`
  - [x] `normalizeApiLogs` (gym 5300–5303 + `ITEM_LOG_META`)
- **[X]** **History Engine** - (/documentation/technical/domain/history-engine.md)
  - [x] `DataController` (hydrate, slices, rates, sticker cache, grind)
  - [x] Pure `rebuildFromSeries` / `reconcileIncremental` (`history-engine.ts`)
  - [x] Incremental vs full reconcile; `_snapToBattlestats`
- **[X]** **Demo Mode** - (/documentation/technical/domain/demo-mode.md)
  - [x] `generateDemoData` (365-day seeded simulation)
  - [x] `getActiveHistory` demo branch
  - [x] Welcome UI is Preact (`Welcome.tsx`); `demo.js` is data-only

### C. Persistence & Network

- **[X]** **IndexedDB Persistence** - (/documentation/technical/data/indexeddb.md)
  - [x] `DBManager` (`bbgl_db` v2, stores `meta` + `days`)
  - [x] Load / save / flatten series / clear (reseeds `rewardStartDate`)
- **[X]** **Sanitize, Import & Export** - (/documentation/technical/data/sanitize-and-import.md)
  - [x] `sanitizeMeta` / `sanitizeDayRecord` / `validateImportSchema`
  - [x] JSON export schema (human-readable series + `_s` stickers)
  - [x] `clearData` vs `factoryReset`
- **[X]** **Torn API & Sync** - (/documentation/technical/data/torn-api-and-sync.md)
  - `universalFetch` lives in `src/torn/api.js`
  - [x] `universalFetch` missions (`FULL_SYNC`, `TRAIN_SINGLE`)
  - [x] Heartbeat (30 min), gym-exit sync, refresh cooldown
  - [x] `BroadcastChannel('bbgl_sync')` passenger reload
- **[X]** **Big Black Backfill** - (/documentation/technical/data/backfill.md)
  - [x] Group frontiers, `SOFT_CAP` 38000, `THROTTLE_MS` 700
  - [x] Lock / heartbeat / checkpoint / cooldown machine
  - [x] Scan overlay + settings button states
- **[X]** **Ranked Wars & Faction History** - (/documentation/technical/data/wars.md)
  - [x] `fetchWars`, `fetchFactionHistory`, `getWarMarkers`
  - [x] Calendar cells are Preact (`Calendar.tsx`); `wars.js` keeps fetch + `getWarMarkers` only

### D. UI (Preact app + Torn adapter)

- **[X]** **Styles & Static Assets** - (/documentation/technical/ui/styles-and-assets.md)
  - [x] `injectStyles()` (`#bbgl-styles`, Google Fonts, CSS token substitution)
  - [x] `CUSTOM_STICKERS`, `ASSETS`, `ICONS`, `cdnize()`
- **[X]** **Panel Shell, Templates & Events** - (/documentation/technical/ui/panel-and-views.md)
  - [x] Preact Dashboard / Settings / Welcome / stickers / achievements; `setupEventListeners` removed
- **[X]** **Calendar, Ledger & Graph** - (/documentation/technical/ui/calendar-ledger-graph.md)
  - [x] Preact calendar + ledger + graph HUD; graph draw/scrub stay controllers
- **[X]** **Stickers, Achievements & Docs** - (/documentation/technical/ui/stickers-and-achievements.md)
  - [x] Stickerbook + achievement pages are Preact; RAF viewer and `handleAchCopy` stay controllers
- **[X]** **Torn Injection & Best Gym** - (/documentation/technical/ui/torn-inject-and-best-gym.md)
  - Adapter in `src/torn/` (`api.js`, `inject.js`, `best-gym.js`, `widgets/`)

### E. Boot & Local Development

- **[X]** **Boot Sequence** - (/documentation/technical/boot/boot-and-events.md)
  - [x] `main.ts` load guard → `boot()` → `installDomHooks` + `init`
  - [x] Hash routing (`#gymlog`), storage-event view sync
  - [x] `events.js` removed; view clicks are Preact
- **[X]** **Build, Tests & Tooling** - (/documentation/technical/development.md)
  - [x] Scripts: `npm run build`, `npm run dev`, `npm run typecheck`, `npm test`
  - [x] esbuild IIFE + `userscript.meta.js` banner + Preact JSX (`jsxImportSource: preact`)
  - [x] `node:test` coverage (capsules, leveling, day, rebuild/reconcile)

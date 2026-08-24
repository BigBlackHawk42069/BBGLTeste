# System Overview & Layering

Big Black Gym Log (BBGL) is a **browser userscript**, not a Node server. TypeScript and esbuild exist only so the source can be split into modules. The thing Torn users install is still one file:

```
https://raw.githubusercontent.com/BigBlackHawk42069/BigBlackGymLog/main/BigBlackGymLog.js
```

Tampermonkey updates from that raw URL. Changing the published path, converting the artifact to ESM, or moving it to `dist/` would break existing installs.

## What ships vs what you edit

| Path | Role |
|---|---|
| [`src/`](../../src/) | Editable source (TS + extracted JS) |
| [`esbuild.config.mjs`](../../esbuild.config.mjs) | Bundles `src/main.ts` to a browser IIFE |
| [`userscript.meta.js`](../../userscript.meta.js) | Tampermonkey header prepended as a banner |
| [`BigBlackGymLog.js`](../../BigBlackGymLog.js) | **Published artifact** — tracked in git |
| [`UserDocs/`](../../UserDocs/) | HTML fetched at runtime (not bundled) |

The only **runtime** npm package is `preact` (bundled into the IIFE). Dev-only: `typescript`, `esbuild`. Tests use Node's built-in `node:test`.

## Boot path

```
Tampermonkey injects BigBlackGymLog.js at document-start on https://www.torn.com/*
  → IIFE runs
  → src/main.ts load guard (window.__BBGL_LOADED__)
  → boot() side-effect-imports every extracted module (assigns app.*)
  → installDomHooks() patches Node.prototype to catch Torn sidebar/footer mounts
  → DOMContentLoaded → init()  (styles, IndexedDB, sync, listeners)
```

```ts
// src/main.ts
import { boot } from './boot/boot.ts';

if (!window.__BBGL_LOADED__) {
  window.__BBGL_LOADED__ = true;
  boot();
}
```

`boot()` itself does almost nothing except guarantee modules have registered on `app` first:

```ts
// src/boot/boot.ts
export function boot() {
  if (app.TooltipController) window.TooltipController = app.TooltipController;
  if (typeof app.installDomHooks === 'function') app.installDomHooks();
  if (typeof app.init === 'function') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', app.init);
    else app.init();
  }
}
```

## Layering

Shared mutables live in [`src/core/state.ts`](../../src/core/state.ts) and keep object identity so call sites do not need a store.

The **BBGL-owned panel** is a Preact tree in [`src/ui/preact/`](../../src/ui/preact/) (`mountDashboard` → `#bbgl-panel`). Settings, welcome, ledger, calendar, graph HUD, stickers, achievements, scan overlay, and modals are JSX. `saveViewState` / `saveConfig` call `pingUi()` so those views re-render. Frozen `Island` hosts remain only for the graph SVG and the sticker viewer pedestal (imperative draw / RAF). Do **not** call `render()` a second time on the panel.

Torn’s page is **not** a Preact tree. [`src/torn/`](../../src/torn/) finds mount nodes (sidebar, footer tab, Best Gym, gym level bar, `#gymlog` header) and `render()`s small widgets into them. `installDomHooks` / `MutationObserver` stay in the adapter.

```
core/     constants, state, log          → imports nothing above itself
domain/   time, capsules, leveling, day, history, demo
data/     db, sanitize, sync, backfill, wars, import-export
torn/     Torn DOM + api.torn.com adapter (may import core, domain, data, ui/preact widgets)
ui/       Preact app + leftover vanilla controllers (graph draw, sticker RAF)
boot/     events, init, boot             → may import everything
```

Intended import rules:

- `core/` imports nothing from `domain/`, `data/`, `ui/`, `torn/`, or `boot/`
- `domain/` may import `core/` only — no Preact, no HTML strings
- `data/` may import `core/` and `domain/` — no Preact, no HTML strings
- `torn/` may import `core/`, `domain/`, `data/`, and `ui/preact` widgets
- `ui/preact` must not import `torn/` (no Torn selectors in the log UI)
- `ui/` may import `core/`, `domain/`, and `data/`
- `boot/` may import everything
- Domain never imports UI. Data never imports UI. UI reacts to `bbgl:dataUpdated`

`DataController.processDataPayload` already dispatches that event after a successful sync.

## Data flow

```
Torn DOM / gym page
    → torn/ (hooks find mount nodes, universalFetch, Best Gym fiber walk)
        → render small Preact widgets (footer, Best Gym, gym level, #gymlog header)
        → api.torn.com
    → boot (hash routing, storage events)
        → ui/preact (Dashboard, Settings, Welcome, Ledger, Calendar, Graph HUD, stickers, achievements, modals)
            → domain (history, leveling, capsules)
                → core state (historyCache, userConfig, viewState)
        → data (DBManager, backfill, wars)
            → IndexedDB bbgl_db + localStorage
        → domain ──bbgl:dataUpdated──→ ui (notifyUi / renderPanelContent)
```

## The `app` object

Extracted JS modules cannot always import each other without cycles (`DataController` needs `DBManager`, `DBManager` needs `DataController._rebuildFromSeries`). The repo uses a late-bound bag:

```js
// src/app-context.js
export const app = {};
```

Each extracted file assigns its public surface at the bottom:

```js
app.DBManager = DBManager;
app.DataController = DataController;
app.universalFetch = universalFetch;
```

Call sites in **other** files must use `app.Name`. Same-file calls stay bare. Missing `app.` prefixes are `ReferenceError`s at runtime because the names are no longer in one IIFE closure.

`window.TooltipController` is the one deliberate global leak: touch/scrub code and demo-exit hide the tooltip through it.

## File map (shipped)

```
src/
  main.ts                 load guard
  types.ts                StatKey, DayRecord, HistoryState, Slice, …
  gm.d.ts                 GM_xmlhttpRequest + window.__BBGL_LOADED__
  app-context.js          late-bound app = {}
  core/
    constants.ts          SCRIPT_VERSION, KEYS, GAME, ITEM_LOG_META, BACKFILL, GYM_TIERS
    state.ts              runtime, userConfig, viewState, historyCache, setters
    log.ts                Log, Perf
  domain/
    time.ts               TimeManager, Formatter, getWeekKey
    capsules.ts           classifyDay, computeWeekCapsules
    leveling.ts           career XP / atrophy
    day.ts                initializeDayObject, normalizeApiLogs, findHappyJumps
    history-engine.ts     pure rebuildFromSeries / reconcileIncremental
    history.js            DataController + getActiveHistory
    demo.js               generateDemoData (welcome UI is Preact)
  data/
    db.js                 DBManager
    sanitize.js           sanitize* / validateImportSchema
    sync.js               heartbeat, exit sync, BroadcastChannel
    backfill.js           scan lock / checkpoint / cap
    wars.js               ranked wars + getWarMarkers
    import-export.js      export / import / clear / factoryReset
  torn/
    api.js                universalFetch
    inject.js             observers, sidebar/footer inject, layout
    best-gym.js           gym fiber walk + capsule SVG generators
    widgets/              FooterTab, BestGym, GymLevelBar, PageHeader
  ui/
    styles.css + styles.ts
    assets.ts / icons.ts
    preact/               Dashboard, Settings, Welcome, Ledger, Calendar, Graph, Modals
    templates.js, panel.js, tooltip.js
    calendar.js, ledger.js, graph.js   (orchestration + graph draw/scrub)
    stickers.js, achievements-view.js  (RAF viewer, computeAchievements, copy)
    docs.js, scan-overlay.js
  boot/
    boot.ts, init.js
```

## Known extraction leftovers (shipped, do not "fix" silently)

The mechanical extract from the old single IIFE left some functions in the wrong folder. Behavior is correct; file names are not:

| Lives in | Actually is | Call through |
|---|---|---|
| `src/torn/best-gym.js` `CAL_IMG_BASE`, `CAP_*`, `buildCapsuleBar` | Calendar capsule SVG | `app.buildCapsuleBar` |
| `src/ui/achievements-view.js` `computeAchievements` | Domain achievement rollup | `app.computeAchievements` |
| `src/domain/history.js` imports `CUSTOM_STICKERS` from `ui/assets.ts` | Domain → UI leak (sticker catalog) | keep until stickers move to `core/` |

Most extracted `.js` files still carry a **blanket import header** (all constants, all domain math, often unused `ASSETS`/`ICONS`). That is leftover extract glue, not an API. `tsc` typechecks **`.ts` / `.d.ts` only** (`tsconfig.json` `include`); extracted JS is `allowJs` with `checkJs: false`.

When you add a new cross-file function:

1. Define it in the correct layer.
2. Assign `app.myFn = myFn` at the bottom of that file.
3. Call `app.myFn(...)` from every other file (including template interpolations: `` `${app.myFn()}` ``).
4. Do not assign to imported `let`/`const` bindings (`layoutObservers = []` is illegal in ESM — mutate `layoutObservers.length = 0` instead).

## What we will not do

- No Node HTTP server or backend
- No React/Vue. **Preact** is the one allowed UI runtime (BBGL screens + Torn widgets; bundled into the IIFE)
- No additional runtime packages without an explicit decision
- No storage-key or IndexedDB schema migration unless you also bump `WIPE_BELOW_VERSION` and accept wiping users
- No bundling `UserDocs` or sticker/calendar CDN images
- Edit `src/` and rebuild. Do not paste the built `BigBlackGymLog.js` back over source.

See [Runtime Contracts](./core/runtime-contracts.md) before changing anything that existing installs persist or update from.

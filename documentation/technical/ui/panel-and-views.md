# Panel Shell, Templates & Events

Sources:

- [`src/ui/preact/Dashboard.tsx`](../../../src/ui/preact/Dashboard.tsx) — header, toolbar, view classes, week labels
- [`src/ui/preact/Island.tsx`](../../../src/ui/preact/Island.tsx) — frozen hosts vanilla may write into
- [`src/ui/preact/chrome.ts`](../../../src/ui/preact/chrome.ts) — header / pop / copy / demo-exit handlers
- [`src/ui/preact/store.ts`](../../../src/ui/preact/store.ts) — `notifyUi` / `useUiTick` (wired from `saveViewState` / `saveConfig`)
- [`src/ui/preact/mount.tsx`](../../../src/ui/preact/mount.tsx) — `mountDashboard(panel)` then `setupEventListeners`
- [`src/ui/templates.js`](../../../src/ui/templates.js) — `getSettingsHTML`, `getWelcomeHTML`, `TOOLTIPS`, `buildEmptyLevelTrackSVG`
- [`src/ui/panel.js`](../../../src/ui/panel.js) — open/close, `switchView`, DOM cache
- [`src/ui/tooltip.js`](../../../src/ui/tooltip.js) — `TooltipController`
- [`src/boot/events.js`](../../../src/boot/events.js) — island listeners only (calendar, settings form, stickers, graph, achievements)

## Two shells, one mount

| Mode | How you get there | Root |
|---|---|---|
| Panel | Footer `#bbgl-gym-tab` or sidebar Gym Log | `#bbgl-panel` over Torn chrome |
| Page | `#gymlog` hash (`/calendar.php#gymlog`) | `#bbgl-page-container` inside Torn `.content-wrapper` |

Both call `mountDashboard(panel)` (Preact `Dashboard` into `#bbgl-panel`) then **the same** `setupEventListeners(root)`. Do not fork listeners per mode. Do not call `render()` again on the panel (that remounts and wipes islands). Chrome re-renders via `notifyUi` / `useUiTick`. Page mode adds `bbgl-mode-page` and a native-looking header (`renderPageMode`).

`checkViewRouting` (hashchange / popstate) toggles `document.body.bbgl-page-mode-active` and `document.title = "Gym Log | TORN"`.

## Views (`viewState.subView`)

`switchView(name)` adds/removes `active-view` / `viewing-*` classes on `dom.topPanel`:

- `ledger` — default stat table
- `graph` — `GraphController.draw`
- `stickers` / `viewer` — stickerbook + item viewer
- `achievements` — 6 pages (forces tall in panel mode)
- `settings` / `welcome` — full-panel overlays

`togglePanel`, `closePanel`, `toggleTall`, `toggleLedgerView`, `toggleGraphView`, `toggleSettingsView` all persist via `saveViewState` unless `runtime.isSyncing`.

`cacheDOM(root)` fills `dom.panel`, `dom.topPanel`, ledger/graph/sticker nodes, refresh button, etc. Call it at the start of `setupEventListeners`.

## Templates

`Dashboard` (Preact) owns header, toolbar toggles, tall/pop/demo/copy, `viewing-*` / `active-view` classes, overlay hide of top/bottom, and week-row labels. Vanilla **islands** (never reconcile after first paint) hold ledger, calendar cells, graph SVG/HUD, sticker grid, achievements pages, month/year chrome, level bar guts, item viewer, and settings/welcome inner HTML. Settings inner HTML still comes from `getSettingsHTML()`. Welcome inner is filled by `switchView`. `getDashboardHTML()` remains as the old string builder and is not used for mount.

Wrapper islands use `contents` (`display: contents`) so they do not insert an extra flex box in front of `#bbgl-graph-container`, `#bbgl-item-viewer`, or the settings scroll area.

Welcome and settings **compose sections from other files**:

```js
// templates.js
`${app.buildWelcomeIntroSection()}${app.buildWelcomeInitSection()}${app.buildWelcomeReturningSection()}`
`${app.buildSettingsFeaturesSection()}…${app.buildSettingsInfoSection()}`
```

`TOOLTIPS` is a map of strings / HTML / functions (`REFRESH_COOLDOWN(n)`). Other files must use `app.TOOLTIPS`.

## Tooltips

`TooltipController.init / handleHover / resolve / show / hide`. `data-tooltip` (plain) vs `data-tooltip-html`. Touch: 400ms press-and-scrub on the panel (`window._bbglScrubbing`) so day cells still shimmer. Exposed as `window.TooltipController` for demo-exit hide.

## Event map (what to hook)

Header / toolbar / demo / pop / tall / session-copy clicks are Preact (`chrome.ts` + `Dashboard`). `setupEventListeners` binds **island** controls only:

- All-time, month, year crown buttons
- Ledger per-stat column copy (`#bbgl-ledger-view`)
- Sticker pagination + swipe
- Calendar month/year dropdowns + swipe
- Settings form (including `.close-settings-btn`)
- Backfill button is (re)bound by `renderBackfillButton`
- Achievements copy + enhancer period switch + swipe
- `GraphController.setupControls()`, `setupStickerGrid()`, `refreshInitLock`

API key verify from settings uses the same Torn `battlestats,log&log=5300` probe as welcome import.

## Implementing a change

- New chrome control: add it in `Dashboard.tsx` and persist through `userConfig` / `viewState` (`saveViewState` re-renders Preact).
- New island / settings control: add markup in `Dashboard` (inside `Island`) or a `buildSettings*` section, bind in `setupEventListeners`.
- New view: add a host in `Dashboard` (island if vanilla fills it), a `switchView` branch, and a `storage`-event case in `handleStorageEvent` (it already syncs `subView`, graph, stickers, calendar, tall/expanded).
- Keep `setupEventListeners(root)` as one function so page mode and panel mode cannot drift.

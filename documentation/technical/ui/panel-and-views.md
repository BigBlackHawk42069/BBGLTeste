# Panel Shell, Templates & Events

Sources:

- [`src/ui/preact/Dashboard.tsx`](../../../src/ui/preact/Dashboard.tsx) — shell, ledger/calendar/graph HUD, stickers, achievements, settings, welcome, scan overlay
- [`src/ui/preact/views/`](../../../src/ui/preact/views/) — `Ledger.tsx`, `Calendar.tsx`, `Graph.tsx`, `Stickers.tsx`, `Achievements.tsx`
- [`src/ui/preact/Settings.tsx`](../../../src/ui/preact/Settings.tsx) / [`Welcome.tsx`](../../../src/ui/preact/Welcome.tsx) / [`Modals.tsx`](../../../src/ui/preact/Modals.tsx)
- [`src/ui/preact/Island.tsx`](../../../src/ui/preact/Island.tsx) — frozen hosts for graph SVG + sticker viewer pedestal
- [`src/ui/preact/chrome.ts`](../../../src/ui/preact/chrome.ts) — header / pop / copy / demo-exit handlers
- [`src/ui/preact/store.ts`](../../../src/ui/preact/store.ts) — `notifyUi` / `useUiTick`
- [`src/ui/preact/mount.tsx`](../../../src/ui/preact/mount.tsx) — `mountDashboard(panel)` then `cacheDOM`
- [`src/ui/templates.js`](../../../src/ui/templates.js) — `TOOLTIPS`, `buildEmptyLevelTrackSVG`
- [`src/ui/panel.js`](../../../src/ui/panel.js) — open/close, `switchView`, DOM cache
- [`src/ui/tooltip.js`](../../../src/ui/tooltip.js) — `TooltipController`

## Two shells, one mount

| Mode | How you get there | Root |
|---|---|---|
| Panel | Footer `#bbgl-gym-tab` or sidebar Gym Log | `#bbgl-panel` over Torn chrome |
| Page | `#gymlog` hash (`/calendar.php#gymlog`) | `#bbgl-page-container` inside Torn `.content-wrapper` |

Both call `mountDashboard(panel)` (Preact `Dashboard` into `#bbgl-panel`). Do not call `render()` again on the panel (that remounts and wipes islands). Chrome re-renders via `notifyUi` / `useUiTick`. Page mode adds `bbgl-mode-page` and a native-looking header (`renderPageMode` → `mountPageHeader`).

`checkViewRouting` (hashchange / popstate) toggles `document.body.bbgl-page-mode-active` and `document.title = "Gym Log | TORN"`.

## Views (`viewState.subView`)

`switchView(name)` adds/removes `active-view` / `viewing-*` classes on `dom.topPanel`:

- `ledger` — default stat table
- `graph` — `GraphController.draw`
- `stickers` / `viewer` — stickerbook + item viewer
- `achievements` — 6 pages (forces tall in panel mode)
- `settings` / `welcome` — full-panel overlays

`togglePanel`, `closePanel`, `toggleTall`, `toggleLedgerView`, `toggleGraphView`, `toggleSettingsView` all persist via `saveViewState` unless `runtime.isSyncing`.

`cacheDOM(root)` fills `dom.panel`, `dom.topPanel`, ledger/graph/sticker/viewer nodes, refresh button, etc. `Dashboard` re-runs it after each paint so `switchView` and the RAF viewer keep live refs.

## Templates

`Dashboard` (Preact) owns header, toolbar toggles, tall/pop/demo/copy, `viewing-*` / `active-view` classes, overlay hide of top/bottom, week-row labels, settings, welcome, ledger, calendar, stickers, and achievements. Frozen **islands** remain for the graph SVG and the sticker viewer pedestal only.

`TOOLTIPS` is a map of strings / HTML / functions (`REFRESH_COOLDOWN(n)`). Other files must use `app.TOOLTIPS`.

## Tooltips

`TooltipController.init / handleHover / resolve / show / hide`. `data-tooltip` (plain) vs `data-tooltip-html`. Touch: 400ms press-and-scrub on the panel (`window._bbglScrubbing`) so day cells still shimmer. Exposed as `window.TooltipController` for demo-exit hide.

## Event map (what to hook)

Header / toolbar / demo / pop / tall / session-copy clicks are Preact (`chrome.ts` + `Dashboard`). Sticker nav/swipe and achievement copy/swipe/nav are Preact. `GraphController.setupControls()` and `refreshInitLock` run from the Dashboard `useEffect`.

API key verify from settings uses the same Torn `battlestats,log&log=5300` probe as welcome import.

## Implementing a change

- New chrome control: add it in `Dashboard.tsx` and persist through `userConfig` / `viewState` (`saveViewState` re-renders Preact).
- New settings control: add it in `Settings.tsx`.
- New view: add a host in `Dashboard`, a `switchView` branch, and a `storage`-event case in `handleStorageEvent` (it already syncs `subView`, graph, stickers, calendar, tall/expanded).
- Keep page mode and panel mode on the same `Dashboard` tree so they cannot drift.

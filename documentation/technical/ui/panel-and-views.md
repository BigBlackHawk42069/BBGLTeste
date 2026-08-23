# Panel Shell, Templates & Events

Sources:

- [`src/ui/templates.js`](../../../src/ui/templates.js) — `getDashboardHTML`, `getWelcomeHTML`, `getSettingsHTML`, `TOOLTIPS`
- [`src/ui/panel.js`](../../../src/ui/panel.js) — open/close, `switchView`, DOM cache
- [`src/ui/tooltip.js`](../../../src/ui/tooltip.js) — `TooltipController`
- [`src/boot/events.js`](../../../src/boot/events.js) — `setupEventListeners(root)`

## Two shells, one mount

| Mode | How you get there | Root |
|---|---|---|
| Panel | Footer `#bbgl-gym-tab` or sidebar Gym Log | `#bbgl-panel` over Torn chrome |
| Page | `#gymlog` hash (`/calendar.php#gymlog`) | `#bbgl-page-container` inside Torn `.content-wrapper` |

Both inject `getDashboardHTML()` and call **the same** `setupEventListeners(root)`. Do not fork listeners per mode. Page mode adds `bbgl-mode-page` and a native-looking header (`renderPageMode`).

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

`getDashboardHTML()` is one HTML string: header, calendar chrome, weekly bars, level bar, toolbar toggles, ledger/graph/achievements/sticker hosts, settings + welcome hosts.

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

`setupEventListeners` is the only place new toolbar/settings clicks should be bound. Already wired:

- Header close / settings / popout / demo exit
- All-time, month, year crown buttons
- Ledger copy (session + per-stat column)
- Graph / achievements / sticker toggles + sticker pagination
- Calendar month/year dropdowns + swipe
- Settings: animations, rates, drug tracker, Best Gym, location, day/week start, API verify/clear/create, refresh/resync, export/import/clear, privacy/changelog/demo/feature-guide
- Backfill button is (re)bound by `renderBackfillButton`
- Achievements copy + enhancer period switch + swipe

API key verify from settings uses the same Torn `battlestats,log&log=5300` probe as welcome import.

## Implementing a change

- New control: add markup in `getDashboardHTML` or a `buildSettings*` section, bind in `setupEventListeners`, persist through `userConfig` / `viewState`.
- New view: add a host in the dashboard HTML, a `switchView` branch, and a `storage`-event case in `handleStorageEvent` (it already syncs `subView`, graph, stickers, calendar, tall/expanded).
- Keep `setupEventListeners(root)` as one function so page mode and panel mode cannot drift.

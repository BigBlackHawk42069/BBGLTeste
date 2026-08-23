# Torn Injection & Best Gym

Sources:

- [`src/ui/torn-inject.js`](../../../src/ui/torn-inject.js) — sidebar, footer tab, layout shove, gym click, settings widgets
- [`src/boot/init.js`](../../../src/boot/init.js) — `installDomHooks`
- [`src/ui/best-gym.js`](../../../src/ui/best-gym.js) — `BestGymController`, capsule SVG constants

This is the riskiest UI. It walks Torn's hashed class names (`area-mobile___sx8BQ`, `opened___`, …) and patches `Node.prototype` at `document-start`. Class hashes **will** change when Torn deploys; hooks must fail closed (try/catch, `maybeUninstall`).

## document-start hooks

`installDomHooks` (must run before Torn paints the nav):

1. `injectStyles()` so the footer tab is not unstyled
2. Wrap `Node.prototype.insertBefore` / `appendChild`
3. When a node with `id === 'nav-gym'` appears → `injectSidebarButton(SB_MOBILE)` + `injectSidebarButton(SB_DESKTOP)`
4. When `id === 'notes_panel_button'` appears → `injectFooterButton`
5. Uninstall the prototype wrap once both needed targets exist, on `load` + 1s, or on `DOMContentLoaded` + 3s fallback

`userConfig.buttonLocation`: `'sidebar'` | `'notes'` | `'both'` decides which targets are required (`needsNavGym` / `needsNotesBtn`).

## Sidebar configs

Three mounts, all assigned on `app` (they were originally one `const` line — only `SB_DESKTOP` was exported until `SB_MOBILE` / `SB_FLYOUT` were added explicitly):

```js
SB_DESKTOP  // desktop sidebar under Gym
SB_MOBILE   // #nav-gym[class*="area-mobile"]
SB_FLYOUT   // #fly-out-panel [id="nav-gym"]
```

Each has `{ target, container, link, row, id }`. Injected nodes use those Torn class names plus `id` (`nav-gym-log-mobile`, …) and a gym-log SVG. Click → `preventDefault` + `togglePanel` or navigate to `/calendar.php#gymlog`.

`bbgl-sb-notif` is the purple pip for new install or changelog (`KEYS.CHANGELOG_NOTIF`). `syncChangelogNotif` / `syncSidebarState` keep the Torn `active___*` class on our items when `#gymlog` is open.

## Footer tab

`injectFooterButton` inserts `#bbgl-gym-tab` next to Torn's notes/people buttons. `handleLayout` positions `#bbgl-panel` against:

- `getTopCeiling()` — bottom of Torn's fixed header (cached 250ms)
- open notes / people / settings / chat windows (`opened___`)
- `LAYOUT.LIFT_HEIGHT` / `BASE_RIGHT`

`attachLayoutObservers` uses `ResizeObserver` + class MutationObservers. Clear via `layoutObservers.length = 0` (do not reassign the imported array).

`handleDomMutation` (RAF-coalesced MutationObserver on `document.body`) re-injects if Torn re-renders the nav, and re-runs Best Gym / level bar on gym.php.

## Gym clicks

`handleGymClick` + `BestGymController.handleTrainClick` (capture-phase click on `document`):

1. Best Gym may rewrite the train target (fiber walk of Torn's gym buttons + `GYM_TIERS`)
2. `sessionStorage[KEYS.SESSION] = 'true'`
3. `universalFetch('TRAIN_SINGLE', { specId })` for that stat's log id (`GYM_STAT_LOGS`)

`GYM_TIERS` in constants is the specialist/unpurchased gym unlock ladder per stat (ids and id-groups). Toggles: `userConfig.bestGym`, `bestGymSpecialist`, `bestGymUnpurchased`.

## Best Gym + capsule SVG

`BestGymController` observes gym.php, computes the next recommended gym from current battlestats vs `GYM_TIERS`, and injects a toggle (`injectBestGymToggle` / `setBestGym`).

The same file owns calendar capsule SVG geometry (`CAP_W`, `CAP_SLOT_*`, `CAP_BAR_DEFS`, `buildCapsuleBar`, `_capBarCache`) and `CAL_IMG_BASE` (CDN prefix for flipped day-cell textures). `updateSummaryCharts` / `buildChartSVG` are the tiny week-summary sparklines.

## Settings widgets (also in this file)

`buildSection`, `buildRow`, `buildToggle`, `buildButton`, `stackBtnStyle`, `buildApiEntryField`, `generateDayStartSelect`, `onChangeLoc`, `onChangeDayStart`, `onChangeWeekStart`, `refreshInitMask`, `refreshInitLock`. Settings HTML in `sync.js` calls these via `app.build*`.

Changing day/week start invalidates history caches and re-renders — timestamps stay unix, logical dates move.

## Implementing a change

- Torn class hash broke inject? Update the `___XXXXX` suffixes in `SB_*` only after confirming on live Torn. Keep the `id` selectors (`#nav-gym`, `#notes_panel_button`) — those have been more stable.
- Never leave the `Node.prototype` wrap installed after hooks fire (memory + other scripts).
- New sidebar location: add a config object, assign `app.SB_*`, include its `id` in `syncSidebarState`'s list.
- Best Gym math: edit `GYM_TIERS` / `BestGymController`, not the calendar capsule helpers in the same file.

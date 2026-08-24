# Calendar, Ledger & Graph

Sources:

- [`src/ui/preact/views/Calendar.tsx`](../../../src/ui/preact/views/Calendar.tsx) — month grid, day cells, weekly bars, month header
- [`src/ui/preact/views/Ledger.tsx`](../../../src/ui/preact/views/Ledger.tsx) — ledger columns, date/summary/item counters
- [`src/ui/preact/views/Graph.tsx`](../../../src/ui/preact/views/Graph.tsx) — HUD pills; SVG host stays an Island
- [`src/ui/calendar.js`](../../../src/ui/calendar.js) — `renderPanelContent` orchestration, level-bar animation, `openHistory`
- [`src/data/wars.js`](../../../src/data/wars.js) — `getWarMarkers` only
- [`src/torn/best-gym.js`](../../../src/torn/best-gym.js) — `buildCapsuleBar`, `CAL_IMG_BASE`, `CAP_*`
- [`src/ui/ledger.js`](../../../src/ui/ledger.js) — `renderStats` (sets `runtime.currentStats` + `notifyUi`), `buildSessionText`
- [`src/ui/graph.js`](../../../src/ui/graph.js) — `GraphController` draw / scrub

All of these **read** `app.getActiveHistory()` / `app.DataController.getSlice` and **listen** to `bbgl:dataUpdated`. They do not write series.

## Calendar

`Calendar.tsx` paints the visible month; `renderPanelContent()` notifies UI and runs side effects (pending restore, graph/sticker/achievements, level bar):

- Weekday header respects `weekStartMode` (`WeekRow`)
- Ghost cells for adjacent months
- Each day: Preact `DayCell` → slice tier, archived-row flip, sticker deco, war markers, shimmer
- Weekly row: `computeWeekCompletion` → `app.buildCapsuleBar` (five-slot SVG)
- Selection: `openHistory` / `closeHistory` / `updateCellSelection` set `calendarState.selectedData` + `viewState.activeViewLabel` and refresh ledger or graph
- `calcAllTimeStats` / `calcPeriodStats('month'|'year')` build `ALL` / `MONTH` / `YEAR` slices
- `changeMonth` + dropdowns persist `calYear` / `calMonth` on `viewState`

### Level bar

`updateLevelBar` / `snapLevelBar` / `runAtrophyAnimation` / `getLiveLevelExp` / `getLevelBars` / `renderLevelBar` / `injectGymLevelBar`:

- Career XP = cached `runtime.careerLevelExp` + **today's** `computeDailyLevelExp` (so the bar moves live)
- `calculateLevelProgress` → fill % and atrophy title
- On gym.php a compact bar is injected into Torn's gym header when Best Gym / level UI is enabled

## Ledger

`renderStats(dayOrSlice, label)` fills four stat columns + totals (start / gain / end / energy / rate). Dual `.view-std` / `.view-exp` via `Formatter.dual`. Drug-tracker column follows `userConfig.drugTracker`.

`buildSessionText(slice, stats, keys)` is the clipboard payload (BBGL session block). `flashCopied` pulses the copied column.

Rates hide when `userConfig.ratesEnabled` is false (`bbgl-no-rates` on the panel).

## Graph

`GraphController`:

| Method | Role |
|---|---|
| `draw` | SVG line chart for `calendarState.selectedData` or today |
| `restoreUi` | sync mode/stat chips from `graphState` |
| `setupControls` | bind mode + stat toggles |
| `applyDefaultsIfNeeded` | first boot: `['str','spd']` / `'values'` |

Modes: `values` (absolute end stats), `rates` (150E rate), legacy `gains` is coerced to `values` on hydrate. Drag-scrub + locked-stat live in `graphState.handlers`.

`draw` is scheduled on view switch, resize (popout animation 320ms), and `bbgl:dataUpdated`.

## Implementing a change

- New calendar decoration: add it in `renderCell` and a `Slice` / `getWarMarkers` field — do not query Torn from the cell renderer.
- New ledger row: compute on the `Slice` in `_hydrate` so graph/achievements can reuse it.
- Graph colors: `CONSTANTS.COLORS` (`STR/DEF/SPD/DEX/TOT/GAINS`).

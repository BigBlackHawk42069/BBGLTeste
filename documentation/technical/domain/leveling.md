# Career Leveling

Source: [`src/domain/leveling.ts`](../../../src/domain/leveling.ts).  
Tests: [`src/domain/leveling.test.ts`](../../../src/domain/leveling.test.ts).

Career level is a BBGL-only progression (not Torn's gym level). It drives the header level bar and locks achievement pages until level 100.

## Daily XP

```ts
export function computeDailyLevelExp(eSpent: number, hasTrainLog: boolean, isHJ = false): number
```

No gym train that day → `0`. Otherwise a piecewise energy curve, plus `+50` if `eSpent >= 2000`:

**Normal day**

| Energy band | Weight |
|---|---|
| first 1000 | × 0.20 |
| next 500 (1000–1500) | × 0.25 |
| remainder above 1500 | × 0.30 |

**Happy-jump day** (`isHJ`)

| Energy band | Weight |
|---|---|
| first 1000 (capped HJ window) | × 0.30 |
| next 500 extra | × 0.25 |
| remainder extra | × 0.30 |

Result is `Math.round(...)`. `DataController.buildProgressionCache` sums this across days **after** `rewardStartDate` (install day). Demo mode does not accumulate career XP (`unlockedCount` stays 1).

## Level cost curve

Levels 1–99, three **atrophy** passes (`0`, `1`, `2`). Each pass multiplies the base cost:

```ts
export const LEVEL_ATRO_MULT = [1, 1.75, 3.00];
```

Base cost at atrophy 0 interpolates from `LEVEL_FLOOR` (30) to `LEVEL_P0_MAX` (400) along a three-segment curve (linear to 50%, linear to 70%, then `u^4.50` tail). `computeLevelExpCost(level, atrophy)` returns the integer cost to leave that level.

`LEVEL_ATRO_BUDGETS[a]` is the sum of costs for levels 1–99 at atrophy `a`.

## Progress

```ts
export function calculateLevelProgress(totalExp: number): LevelProgress {
  // walk atrophy budgets, then walk levels 1–99 inside the current atrophy
  return { atrophy, level, expInLevel, expToNext };
}
```

Hitting exactly a budget with atrophy still remaining returns `{ level: 100, expToNext: 0 }` for that atrophy (the "ding" before the next brick pass). Spending past atrophy 2 level 100 is clamped: `{ atrophy: 2, level: 100, expInLevel: 0, expToNext: 0 }`.

## Titles

```ts
export const ATROPHY_TITLES = ['Wet Cement', 'Partly Bricked', 'Half Bricked'];

export function atrophyTitle(atrophy: number, level: number): string {
  if (atrophy >= 2 && level >= 100) return 'Fully Bricked';
  return ATROPHY_TITLES[atrophy] || ATROPHY_TITLES[0];
}
```

## UI consumers

- `updateLevelBar` / `getLiveLevelExp` / `renderLevelBar` (`torn-inject.js` + `calendar.js`) read `runtime.careerLevelExp` plus **today's** live XP so the bar moves during the current day.
- `achBuildPageLocked` hides later achievement pages until `level >= 100`.

When changing the curve, update `leveling.test.ts` first — the UI only displays what these functions return.

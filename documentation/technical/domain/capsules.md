# Capsule / Weekly Goal Math

Source: [`src/domain/capsules.ts`](../../../src/domain/capsules.ts).  
Tests: [`src/domain/capsules.test.ts`](../../../src/domain/capsules.test.ts).

This is the "pans / jewels / bars" system from the README. Five slots per week. Filling them unlocks stickers; gold/diamond completion unlocks extras.

## Day tiers

Energy is `day.eSpent.total` (sum of gym energy, not item energy).

```ts
export function classifyDay(d: Pick<DayRecord, 'eSpent'>): DayTier | null {
  const e = d.eSpent ? d.eSpent.total : 0;
  if (e >= 2000) return 'diamond';
  if (e >= 1500) return 'gold';
  if (e >= 1000) return 'green';
  return null;
}
```

| Tier | Energy | Product meaning |
|---|---|---|
| green | ≥ 1000 | 2 Xanax + natural energy in 24h |
| gold | ≥ 1500 | + daily refill |
| diamond | ≥ 2000 | overflow / heavy day |

Below 1000E the day is not sticker-worthy (`null`). `_hydrate` still paints tier `1` if the day is a happy-jump day even under 1000E.

## Placing units into five slots

```ts
export const TIER_UNITS = { green: 1, gold: 1, diamond: 2 };
```

`placeCapsuleUnit(slots, color)`:

1. Fill the first empty slot.
2. Else upgrade the first slot whose rank is lower (green < gold < diamond), and **re-place** the evicted color (it may fill another empty or upgrade further).
3. Else the new unit is discarded (week already maxed at equal-or-better colors).

A diamond day therefore tries to place **two** diamond units.

## Happy-jump allotment

Ecstasy (log `2210`) plus ≥1000E of gym clicks inside the remaining quarter-hour window is a happy jump (`findHappyJumps`). Weeks with `hjDays.length >= GAME.GOLD_WEEK_JUMPS` (3) treat jump filler units as gold instead of green.

The first two HJ days in the week get a fixed allotment `[2, 3]` units. Natural tier units from that day count toward the allotment; the rest are filler green/gold.

```ts
export function computeWeekCapsules(days, hjDaySet = null): Array<DayTier | null> {
  const slots = [null, null, null, null, null];
  // … HJ upgrade path vs normal classifyDay + extra diamond unit
  return slots;
}
```

## Completion flags

```ts
export function computeWeekCompletion(days, hjDaySet = null) {
  const capsules = computeWeekCapsules(days, hjDaySet);
  const filled = capsules.filter(c => c !== null);
  const isCompleted = filled.length === capsules.length;           // 5/5
  const isGold = isCompleted && filled.every(c => c === 'gold' || c === 'diamond');
  const isDiamond = isCompleted && filled.every(c => c === 'diamond');
  return { capsules, isCompleted, isGold, isDiamond };
}
```

`DataController.buildProgressionCache` uses this:

- completed (green) week → **1** new sticker + 1 featured day
- gold week → **2** new stickers + 2 featured days
- incomplete → roulette only, no new unlocks

## Implementing a change

These functions are pure and have `node:test` coverage. Change the math here, update the tests, then visually check the weekly bar SVG (`app.buildCapsuleBar` in `best-gym.js`) — it reads the same slot array. Do not duplicate thresholds (1000/1500/2000) in UI; call `classifyDay` / `computeWeekCompletion`.

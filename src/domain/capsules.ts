import { GAME } from '../core/constants.ts';
import type { DayRecord, DayTier } from '../types.ts';

export function classifyDay(d: Pick<DayRecord, 'eSpent'>): DayTier | null {
  const e = d.eSpent ? d.eSpent.total : 0;
  if (e >= 2000) return 'diamond';
  if (e >= 1500) return 'gold';
  if (e >= 1000) return 'green';
  return null;
}

export const CAPSULE_RANK: Record<DayTier, number> = { green: 1, gold: 2, diamond: 3 };
export const TIER_UNITS: Record<DayTier, number> = { green: 1, gold: 1, diamond: 2 };

export function placeCapsuleUnit(slots: Array<DayTier | null>, color: DayTier): void {
  const empty = slots.indexOf(null);
  if (empty !== -1) {
    slots[empty] = color;
    return;
  }
  for (let i = 0; i < slots.length; i++) {
    const current = slots[i];
    if (current && CAPSULE_RANK[current] < CAPSULE_RANK[color]) {
      slots[i] = color;
      placeCapsuleUnit(slots, current);
      return;
    }
  }
}

export function computeWeekCapsules(days: DayRecord[], hjDaySet: Set<string> | null = null): Array<DayTier | null> {
  const slots: Array<DayTier | null> = [null, null, null, null, null];
  const hjDays = hjDaySet ? days.filter(d => hjDaySet.has(d.date)) : [];
  const jumpGold = hjDays.length >= GAME.GOLD_WEEK_JUMPS;
  const JUMP_ALLOTMENT = [2, 3];
  days.forEach(d => {
    const jumpIdx = hjDays.indexOf(d);
    if (jumpIdx === 0 || jumpIdx === 1) {
      const jumpUnits = JUMP_ALLOTMENT[jumpIdx];
      const naturalTier = classifyDay(d);
      const upgradeUnits = Math.min(TIER_UNITS[naturalTier as DayTier] || 0, jumpUnits);
      for (let i = 0; i < upgradeUnits; i++) placeCapsuleUnit(slots, naturalTier as DayTier);
      for (let i = 0; i < jumpUnits - upgradeUnits; i++) placeCapsuleUnit(slots, jumpGold ? 'gold' : 'green');
    } else {
      const tier = classifyDay(d);
      if (!tier) return;
      placeCapsuleUnit(slots, tier);
      if (tier === 'diamond') placeCapsuleUnit(slots, tier);
    }
  });
  return slots;
}

export function computeWeekCompletion(days: DayRecord[], hjDaySet: Set<string> | null = null) {
  const capsules = computeWeekCapsules(days, hjDaySet);
  const filled = capsules.filter((c): c is DayTier => c !== null);
  const isCompleted = filled.length === capsules.length;
  const isGold = isCompleted && filled.every(c => c === 'gold' || c === 'diamond');
  const isDiamond = isCompleted && filled.every(c => c === 'diamond');
  return { capsules, isCompleted, isGold, isDiamond };
}

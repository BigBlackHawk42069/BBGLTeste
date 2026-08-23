import type { LevelProgress } from '../types.ts';

export const LEVEL_FLOOR = 30;
export const LEVEL_P0_MAX = 400;
export const LEVEL_ATRO_MULT = [1, 1.75, 3.00];
export const LEVEL_STEP1_END = 0.50;
export const LEVEL_STEP1_VAL = 182;
export const LEVEL_STEP2_END = 0.70;
export const LEVEL_STEP2_VAL = 289;
export const LEVEL_TAIL_POWER = 4.50;

export function computeLevelExpCost(level: number, atrophy: number): number {
  const t = (level - 1) / 98;
  const val1 = (LEVEL_STEP1_VAL - LEVEL_FLOOR) / (LEVEL_P0_MAX - LEVEL_FLOOR);
  const val2 = (LEVEL_STEP2_VAL - LEVEL_FLOOR) / (LEVEL_P0_MAX - LEVEL_FLOOR);
  let frac: number;
  if (t <= LEVEL_STEP1_END) {
    frac = val1 * (t / LEVEL_STEP1_END);
  } else if (t <= LEVEL_STEP2_END) {
    frac = val1 + (val2 - val1) * ((t - LEVEL_STEP1_END) / (LEVEL_STEP2_END - LEVEL_STEP1_END));
  } else {
    const u = (t - LEVEL_STEP2_END) / (1 - LEVEL_STEP2_END);
    frac = val2 + (1 - val2) * Math.pow(u, LEVEL_TAIL_POWER);
  }
  const base = Math.round(LEVEL_FLOOR + (LEVEL_P0_MAX - LEVEL_FLOOR) * frac);
  return Math.round(base * LEVEL_ATRO_MULT[atrophy]);
}

export const LEVEL_ATRO_BUDGETS = [0, 1, 2].map(a => {
  let s = 0;
  for (let lv = 1; lv <= 99; lv++) s += computeLevelExpCost(lv, a);
  return s;
});

export function calculateLevelProgress(totalExp: number): LevelProgress {
  let remaining = totalExp;
  let atrophy = 0;
  for (let a = 0; a < 3; a++) {
    const budget = LEVEL_ATRO_BUDGETS[a];
    if (remaining < budget) {
      atrophy = a;
      break;
    }
    if (remaining === budget && a < 2) return { atrophy: a, level: 100, expInLevel: 0, expToNext: 0 };
    remaining -= budget;
    atrophy = a + 1;
  }
  if (atrophy >= 3) return { atrophy: 2, level: 100, expInLevel: 0, expToNext: 0 };
  let level = 1;
  for (let lv = 1; lv <= 99; lv++) {
    const cost = computeLevelExpCost(lv, atrophy);
    if (remaining < cost) {
      level = lv;
      break;
    }
    remaining -= cost;
    level = lv + 1;
  }
  const expInLevel = level <= 99 ? remaining : 0;
  const expToNext = level <= 99 ? computeLevelExpCost(level, atrophy) : 0;
  return { atrophy, level, expInLevel, expToNext };
}

export const ATROPHY_TITLES = ['Wet Cement', 'Partly Bricked', 'Half Bricked'];

export function atrophyTitle(atrophy: number, level: number): string {
  if (atrophy >= 2 && level >= 100) return 'Fully Bricked';
  return ATROPHY_TITLES[atrophy] || ATROPHY_TITLES[0];
}

export function computeDailyLevelExp(eSpent: number, hasTrainLog: boolean, isHJ = false): number {
  if (!hasTrainLog) return 0;
  if (isHJ) {
    const hjE = Math.min(eSpent, 1000);
    const extraE = Math.max(eSpent - 1000, 0);
    const hjBase = hjE * 0.30;
    const t2 = Math.min(extraE, 500) * 0.25;
    const t3 = Math.max(extraE - 500, 0) * 0.30;
    const diamond = eSpent >= 2000 ? 50 : 0;
    return Math.round(hjBase + t2 + t3 + diamond);
  }
  const t1 = Math.min(eSpent, 1000) * 0.20;
  const t2 = Math.min(Math.max(eSpent - 1000, 0), 500) * 0.25;
  const t3 = Math.max(eSpent - 1500, 0) * 0.30;
  const diamond = eSpent >= 2000 ? 50 : 0;
  return Math.round(t1 + t2 + t3 + diamond);
}

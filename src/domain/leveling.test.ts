import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  atrophyTitle,
  calculateLevelProgress,
  computeDailyLevelExp,
  computeLevelExpCost,
  LEVEL_ATRO_BUDGETS
} from './leveling.ts';

describe('computeLevelExpCost', () => {
  it('starts at the floor for level 1 atrophy 0', () => {
    assert.equal(computeLevelExpCost(1, 0), 30);
  });
  it('scales by atrophy multipliers', () => {
    const base = computeLevelExpCost(10, 0);
    assert.equal(computeLevelExpCost(10, 1), Math.round(base * 1.75));
    assert.equal(computeLevelExpCost(10, 2), Math.round(base * 3));
  });
});

describe('calculateLevelProgress', () => {
  it('starts at level 1 with no exp', () => {
    const p = calculateLevelProgress(0);
    assert.equal(p.atrophy, 0);
    assert.equal(p.level, 1);
    assert.equal(p.expInLevel, 0);
    assert.equal(p.expToNext, computeLevelExpCost(1, 0));
  });
  it('returns maxed progress after the last atrophy budget', () => {
    const total = LEVEL_ATRO_BUDGETS[0] + LEVEL_ATRO_BUDGETS[1] + LEVEL_ATRO_BUDGETS[2];
    const p = calculateLevelProgress(total);
    assert.equal(p.level, 100);
    assert.equal(p.atrophy, 2);
    assert.equal(p.expToNext, 0);
  });
});

describe('computeDailyLevelExp', () => {
  it('returns 0 when there is no train log', () => {
    assert.equal(computeDailyLevelExp(1500, false), 0);
  });
  it('applies the standard 1000/500/rest energy curve', () => {
    assert.equal(computeDailyLevelExp(1000, true), 200);
    assert.equal(computeDailyLevelExp(1500, true), 325);
    assert.equal(computeDailyLevelExp(2000, true), 525);
  });
  it('uses the happy-jump curve when flagged', () => {
    assert.equal(computeDailyLevelExp(1000, true, true), 300);
  });
});

describe('atrophyTitle', () => {
  it('returns Fully Bricked at atrophy 2 level 100', () => {
    assert.equal(atrophyTitle(2, 100), 'Fully Bricked');
  });
  it('returns Wet Cement at atrophy 0', () => {
    assert.equal(atrophyTitle(0, 1), 'Wet Cement');
  });
});

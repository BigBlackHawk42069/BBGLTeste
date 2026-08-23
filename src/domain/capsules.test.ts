import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyDay, computeWeekCapsules, computeWeekCompletion } from './capsules.ts';
import { initializeDayObject } from './day.ts';
import { ZERO_BREAKDOWN } from '../core/constants.ts';
import type { DayRecord } from '../types.ts';

function day(date: string, energy: number): DayRecord {
  const d = initializeDayObject(date, { ...ZERO_BREAKDOWN });
  d.eSpent.total = energy;
  return d;
}

describe('classifyDay', () => {
  it('returns null below 1000E', () => {
    assert.equal(classifyDay(day('2026-01-01', 999)), null);
  });
  it('returns green at 1000E', () => {
    assert.equal(classifyDay(day('2026-01-01', 1000)), 'green');
  });
  it('returns gold at 1500E', () => {
    assert.equal(classifyDay(day('2026-01-01', 1500)), 'gold');
  });
  it('returns diamond at 2000E', () => {
    assert.equal(classifyDay(day('2026-01-01', 2000)), 'diamond');
  });
});

describe('computeWeekCapsules', () => {
  it('fills five green slots from five green days', () => {
    const days = [1, 2, 3, 4, 5].map(n => day(`2026-01-0${n}`, 1000));
    assert.deepEqual(computeWeekCapsules(days), ['green', 'green', 'green', 'green', 'green']);
  });
  it('upgrades a slot when a gold day arrives after greens', () => {
    const days = [
      day('2026-01-01', 1000),
      day('2026-01-02', 1000),
      day('2026-01-03', 1000),
      day('2026-01-04', 1000),
      day('2026-01-05', 1000),
      day('2026-01-06', 1500)
    ];
    const slots = computeWeekCapsules(days);
    assert.ok(slots.includes('gold'));
    assert.equal(slots.filter(Boolean).length, 5);
  });
});

describe('computeWeekCompletion', () => {
  it('marks a week complete and gold when every slot is gold or better', () => {
    const days = [1, 2, 3, 4, 5].map(n => day(`2026-01-0${n}`, 1500));
    const result = computeWeekCompletion(days);
    assert.equal(result.isCompleted, true);
    assert.equal(result.isGold, true);
    assert.equal(result.isDiamond, false);
  });
});

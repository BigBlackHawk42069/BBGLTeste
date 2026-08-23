import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { initializeDayObject, normalizeApiLogs, sumStats } from './day.ts';
import { ZERO_BREAKDOWN } from '../core/constants.ts';

describe('initializeDayObject', () => {
  it('copies the baseline into start and end breakdowns', () => {
    const d = initializeDayObject('2026-01-15', { str: 10, def: 20, spd: 30, dex: 40 });
    assert.equal(d.date, '2026-01-15');
    assert.equal(d.startTotal, 100);
    assert.equal(d.endTotal, 100);
    assert.deepEqual(d.gains, { total: 0, ...ZERO_BREAKDOWN });
    assert.deepEqual(d.series, []);
  });
});

describe('sumStats', () => {
  it('sums the four battle stats', () => {
    assert.equal(sumStats({ str: 1, def: 2, spd: 3, dex: 4 }), 10);
  });
});

describe('normalizeApiLogs', () => {
  it('returns an empty array for empty input', () => {
    assert.deepEqual(normalizeApiLogs({}), []);
    assert.deepEqual(normalizeApiLogs(null), []);
  });
  it('maps a strength train log and an item log', () => {
    const logs = normalizeApiLogs({
      a: {
        log: 5300,
        timestamp: 100,
        data: { strength_increased: '12.34', strength_after: '100.5', energy_used: '5' }
      },
      b: {
        log: 2290,
        timestamp: 90,
        data: { energy_increased: '250' }
      }
    });
    assert.equal(logs.length, 2);
    assert.equal(logs[0].type, 'item');
    assert.equal(logs[0].ts, 90);
    if (logs[0].type === 'item') assert.equal(logs[0].energy, 250);
    assert.equal(logs[1].type, 'gym');
    if (logs[1].type === 'gym' || !logs[1].type) {
      assert.equal(logs[1].stat, 'str');
      assert.equal(logs[1].gain, 12.34);
      assert.equal(logs[1].after, 100.5);
      assert.equal(logs[1].cost, 5);
    }
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rebuildFromSeries, reconcileIncremental } from './history-engine.ts';
import { ZERO_BREAKDOWN } from '../core/constants.ts';
import type { GymEntry, ItemEntry } from '../types.ts';

function gym(partial: Partial<GymEntry> & Pick<GymEntry, 'ts' | 'stat' | 'gain' | 'after' | 'cost'>): GymEntry {
  return {
    type: 'gym',
    rate: partial.cost > 0 ? Math.round(partial.gain / partial.cost * 150 * 100) / 100 : 0,
    ...partial
  };
}

describe('rebuildFromSeries', () => {
  it('rebuilds daily history and keeps today as the logical date', () => {
    const today = new Date();
    const todayTs = Math.floor(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 12) / 1000);
    const yesterday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1, 12));
    const yTs = Math.floor(yesterday.getTime() / 1000);
    const series = [
      gym({ ts: yTs, stat: 'str', gain: 10, after: 110, cost: 5 }),
      gym({ ts: todayTs, stat: 'def', gain: 4, after: 24, cost: 5 })
    ];
    const rebuilt = rebuildFromSeries(series, { str: 100, def: 20, spd: 0, dex: 0 });
    assert.equal(rebuilt.history.length, 1);
    assert.equal(rebuilt.history[0].gains.str, 10);
    assert.equal(rebuilt.history[0].endBreakdown.str, 110);
    assert.equal(rebuilt.today.gains.def, 4);
    assert.equal(rebuilt.today.endBreakdown.def, 24);
    assert.equal(rebuilt.today.startBreakdown.str, 110);
  });

  it('counts item uses without changing battle stats', () => {
    const today = new Date();
    const ts = Math.floor(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 12) / 1000);
    const item: ItemEntry = { type: 'item', ts, logId: 2290, energy: 250 };
    const rebuilt = rebuildFromSeries([item], { ...ZERO_BREAKDOWN });
    assert.equal(rebuilt.today.items[2290], 1);
    assert.equal(rebuilt.today.gains.total, 0);
  });
});

describe('reconcileIncremental', () => {
  it('replaces overlapping gym entries and keeps earlier days', () => {
    const today = new Date();
    const todayTs = Math.floor(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 14) / 1000);
    const yDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));
    const yKey = `${yDate.getUTCFullYear()}-${String(yDate.getUTCMonth() + 1).padStart(2, '0')}-${String(yDate.getUTCDate()).padStart(2, '0')}`;
    const yTs = Math.floor(yDate.getTime() / 1000) + 12 * 3600;
    const prefixDay = {
      date: yKey,
      startBreakdown: { str: 100, def: 0, spd: 0, dex: 0 },
      endBreakdown: { str: 110, def: 0, spd: 0, dex: 0 },
      gains: { total: 10, str: 10, def: 0, spd: 0, dex: 0 },
      eSpent: { total: 5, str: 5, def: 0, spd: 0, dex: 0 },
      series: [gym({ ts: yTs, stat: 'str' as const, gain: 10, after: 110, cost: 5 })],
      items: {},
      itemLogIds: [],
      itemEnergy: 0,
      itemHappy: 0,
      lastLogTimestamp: yTs,
      startTotal: 100,
      endTotal: 110
    };
    const todayKey = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
    const oldToday = {
      date: todayKey,
      startBreakdown: { str: 110, def: 0, spd: 0, dex: 0 },
      endBreakdown: { str: 115, def: 0, spd: 0, dex: 0 },
      gains: { total: 5, str: 5, def: 0, spd: 0, dex: 0 },
      eSpent: { total: 5, str: 5, def: 0, spd: 0, dex: 0 },
      series: [gym({ ts: todayTs, stat: 'str' as const, gain: 5, after: 115, cost: 5 })],
      items: {},
      itemLogIds: [],
      itemEnergy: 0,
      itemHappy: 0,
      lastLogTimestamp: todayTs,
      startTotal: 110,
      endTotal: 115
    };
    const state = {
      meta: { baselineBreakdown: { str: 100, def: 0, spd: 0, dex: 0 } },
      history: [prefixDay],
      today: oldToday
    };
    const incoming = [
      gym({ ts: todayTs, stat: 'str', gain: 5, after: 115, cost: 5 }),
      gym({ ts: todayTs + 60, stat: 'str', gain: 8, after: 123, cost: 5 })
    ];
    const inc = reconcileIncremental(state, incoming);
    assert.equal(inc.result.history.length, 1);
    assert.equal(inc.result.history[0].date, yKey);
    assert.equal(inc.result.history[0].gains.str, 10);
    assert.equal(inc.result.today.gains.str, 13);
    assert.equal(inc.result.today.endBreakdown.str, 123);
  });
});

import {
  ECSTASY_LOG,
  GAME,
  ITEM_LOG_META,
  STAT_KEYS,
  XANAX_LOG,
  ZERO_BREAKDOWN,
  r2
} from '../core/constants.ts';
import { Formatter } from './time.ts';
import type { DayRecord, ItemEntry, SeriesEntry, StatBreakdown, StatKey } from '../types.ts';

export function sumStats(o: Partial<StatBreakdown>): number {
  return (o.str || 0) + (o.def || 0) + (o.spd || 0) + (o.dex || 0);
}

export function initializeDayObject(dateStr: string, baseBreakdown: StatBreakdown): DayRecord {
  const b = { ...baseBreakdown };
  return {
    date: dateStr,
    startTotal: b.str + b.def + b.spd + b.dex,
    endTotal: b.str + b.def + b.spd + b.dex,
    startBreakdown: { ...b },
    endBreakdown: { ...b },
    gains: { total: 0, ...ZERO_BREAKDOWN },
    eSpent: { total: 0, ...ZERO_BREAKDOWN },
    items: {},
    itemLogIds: [],
    itemEnergy: 0,
    itemHappy: 0,
    lastLogTimestamp: 0,
    series: []
  };
}

export function findHappyJumps(seriesArr: SeriesEntry[] | null | undefined) {
  const doses = (seriesArr || []).filter(e => e.type === 'item' && e.logId === ECSTASY_LOG) as ItemEntry[];
  if (doses.length === 0) return [];
  const clicks = (seriesArr || []).filter(e => e.type !== 'item' && 'ts' in e && (e as { cost?: number }).cost);
  const jumps: Array<{ date: string; ts: number; tsEnd: number; cost: number; stats: StatBreakdown }> = [];
  doses.forEach(dose => {
    const windowEnd = dose.ts + (GAME.HJ_QUARTER_SECONDS - dose.ts % GAME.HJ_QUARTER_SECONDS);
    let cost = 0;
    let tsEnd = dose.ts;
    const stats: StatBreakdown = { str: 0, def: 0, spd: 0, dex: 0 };
    clicks.forEach(c => {
      const click = c as { ts: number; cost: number; stat: StatKey; gain?: number };
      if (click.ts < dose.ts || click.ts >= windowEnd) return;
      cost += click.cost;
      stats[click.stat] = (stats[click.stat] || 0) + (click.gain || 0);
      if (click.ts > tsEnd) tsEnd = click.ts;
    });
    if (cost >= 1000) jumps.push({ date: Formatter.dateLogical(dose.ts * 1000), ts: dose.ts, tsEnd, cost, stats });
  });
  return jumps;
}

interface RawTornLog {
  log: number;
  timestamp: number;
  data?: Record<string, string | number | undefined>;
}

export function normalizeApiLogs(rawLogs: Record<string, RawTornLog> | null | undefined): SeriesEntry[] {
  if (!rawLogs || Object.keys(rawLogs).length === 0) return [];
  const entries: SeriesEntry[] = [];
  Object.keys(rawLogs).forEach(k => {
    const l = rawLogs[k];
    const meta = ITEM_LOG_META[l.log];
    if (meta) {
      const e: ItemEntry = { type: 'item', id: k, ts: l.timestamp, logId: l.log };
      const d = l.data || {};
      if (meta.energy) e.energy = l.log === XANAX_LOG ? 250 : parseInt(String(d.energy_increased || 0), 10);
      if (meta.energyLost) e.energyLost = parseInt(String(d.energy_decreased ?? 0), 10);
      if (meta.happyLost) e.happyLost = parseInt(String(d.happy_decreased ?? 0), 10);
      if (meta.happy) e.happy = parseInt(String(d.happy_increased || 0), 10);
      if (meta.stat) {
        const sn = ['strength', 'defense', 'speed', 'dexterity'].find(s => d[`${s}_increased`] != null);
        if (sn) {
          e.statKey = sn === 'strength' ? 'str' : sn === 'defense' ? 'def' : sn === 'speed' ? 'spd' : 'dex';
          e.statGain = r2(parseFloat(String(d[`${sn}_increased`] || 0)));
        }
      }
      entries.push(e);
      return;
    }
    const sn = GAME.STAT_MAP[l.log];
    if (!sn) return;
    const ab: StatKey = sn === 'strength' ? 'str' : sn === 'defense' ? 'def' : sn === 'speed' ? 'spd' : 'dex';
    const d = l.data || {};
    const gain = r2(parseFloat(String(d[`${sn}_increased`] || 0)));
    const cost = parseInt(String(d.energy_used || 0), 10);
    entries.push({
      type: 'gym',
      id: k,
      ts: l.timestamp,
      stat: ab,
      key: sn,
      gain,
      after: r2(parseFloat(String(d[`${sn}_after`] || 0))),
      cost,
      rate: cost > 0 ? r2(gain / cost * 150) : 0
    });
  });
  return entries.sort((a, b) => a.ts - b.ts);
}

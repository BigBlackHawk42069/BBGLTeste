import { ECAN_LOG, ZERO_BREAKDOWN, r2 } from '../core/constants.ts';
import { Formatter } from './time.ts';
import { initializeDayObject, sumStats } from './day.ts';
import type { DayRecord, HistoryMeta, HistoryState, SeriesEntry, StatBreakdown } from '../types.ts';

export function rebuildFromSeries(seriesArr: SeriesEntry[], baselineBreakdown: StatBreakdown) {
  const days: Record<string, DayRecord> = {};
  const running = { ...baselineBreakdown };
  seriesArr.forEach(e => {
    const dateKey = Formatter.dateLogical(e.ts * 1000);
    if (!days[dateKey]) days[dateKey] = initializeDayObject(dateKey, { ...running });
    if (e.type === 'item') {
      if (!days[dateKey].items) days[dateKey].items = {};
      if (!days[dateKey].itemLogIds) days[dateKey].itemLogIds = [];
      const itemKey = `${e.ts}_${e.logId}`;
      if (!days[dateKey].itemLogIds.includes(itemKey)) {
        days[dateKey].itemLogIds.push(itemKey);
        days[dateKey].items[e.logId] = (days[dateKey].items[e.logId] || 0) + 1;
        if (e.logId === ECAN_LOG && e.energy) days[dateKey].itemEnergy = (days[dateKey].itemEnergy || 0) + e.energy;
        if (e.energyLost != null) days[dateKey].itemEnergyLost = (days[dateKey].itemEnergyLost || 0) + e.energyLost;
        if (e.happyLost != null) days[dateKey].itemHappyLost = (days[dateKey].itemHappyLost || 0) + e.happyLost;
        if (e.happy) days[dateKey].itemHappy = (days[dateKey].itemHappy || 0) + e.happy;
      }
      if (!e.synthetic) days[dateKey].series.push(e);
    } else {
      days[dateKey].gains[e.stat] += e.gain;
      days[dateKey].gains.total += e.gain;
      days[dateKey].eSpent[e.stat] += e.cost;
      days[dateKey].eSpent.total += e.cost;
      days[dateKey].endBreakdown[e.stat] = e.after;
      if (e.ts > days[dateKey].lastLogTimestamp) days[dateKey].lastLogTimestamp = e.ts;
      if (!e.synthetic) days[dateKey].series.push(e);
      running[e.stat] = e.after;
    }
  });
  Object.values(days).forEach(day => {
    day.endTotal = sumStats(day.endBreakdown);
    day.startTotal = sumStats(day.startBreakdown);
  });
  const logicalToday = Formatter.dateLogical();
  const sortedKeys = Object.keys(days).sort();
  const todayObj = days[logicalToday] || initializeDayObject(logicalToday, { ...running });
  const history = sortedKeys.filter(k => k !== logicalToday).map(k => days[k]);
  return { history, today: todayObj };
}

export function reconcileIncremental(s: HistoryState, cleanLogs: SeriesEntry[]) {
  const minApiTs = cleanLogs[0].ts;
  const maxApiTs = cleanLogs[cleanLogs.length - 1].ts;
  const apiEntries = cleanLogs.map(l => {
    if (l.type === 'item') return { ...l };
    return { type: 'gym' as const, id: l.id, ts: l.ts, stat: l.stat, gain: r2(l.gain), cost: l.cost, after: r2(l.after) };
  });
  const getSetKey = (e: SeriesEntry) => e.type === 'item' ? `item_${e.id}` : `${e.ts}_${e.stat}_${e.after}`;
  const apiTsStatSet = new Set(apiEntries.map(getSetKey));
  const earliestDay = Formatter.dateLogical(minApiTs * 1000);
  const allDays = [...(s.history || [])];
  if (s.today) allDays.push(s.today);
  const prefix: DayRecord[] = [];
  const affected: DayRecord[] = [];
  allDays.forEach(d => {
    (d.date < earliestDay ? prefix : affected).push(d);
  });
  const keptAffected: SeriesEntry[] = [];
  affected.forEach(d => {
    if (Array.isArray(d.series)) {
      d.series.forEach(e => {
        if (e.ts < minApiTs || e.ts > maxApiTs || !apiTsStatSet.has(getSetKey(e))) keptAffected.push(e);
      });
    }
  });
  const mergedAffected = [...keptAffected, ...apiEntries].sort((a, b) => a.ts - b.ts);
  const seed = prefix.length ? prefix[prefix.length - 1].endBreakdown : s.meta && s.meta.baselineBreakdown || ZERO_BREAKDOWN;
  const rebuilt = rebuildFromSeries(mergedAffected, seed);
  return {
    result: { meta: { ...s.meta } as HistoryMeta, history: [...prefix, ...rebuilt.history], today: rebuilt.today },
    changedDays: [...rebuilt.history, rebuilt.today]
  };
}

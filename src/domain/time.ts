import { ACH_FMT, CONSTANTS } from '../core/constants.ts';
import { userConfig } from '../core/state.ts';

export const TimeManager = {
  useLocal() { return userConfig.dayStartMode === 'local'; },
  year(d: Date) { return this.useLocal() ? d.getFullYear() : d.getUTCFullYear(); },
  month(d: Date) { return this.useLocal() ? d.getMonth() : d.getUTCMonth(); },
  date(d: Date) { return this.useLocal() ? d.getDate() : d.getUTCDate(); },
  hours(d: Date) { return this.useLocal() ? d.getHours() : d.getUTCHours(); },
  minutes(d: Date) { return this.useLocal() ? d.getMinutes() : d.getUTCMinutes(); },
  now() {
    const d = new Date();
    return { year: this.year(d), month: this.month(d), date: this.date(d) };
  },
  dayStartTs(dateStr: string) {
    const [y, m, d] = dateStr.split('-');
    return this.useLocal() ? new Date(+y, +m - 1, +d).getTime() : Formatter.parse(dateStr).getTime();
  }
};

type AbbrDec = number | ((mag: number, abs: number) => number);

export const Formatter = {
  number(n: number | null | undefined, d = 0) {
    return n === undefined || n === null ? '0' : n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  },
  abbr(n: number, d: AbbrDec = 1, strip = false) {
    if (!n && n !== 0) return '0';
    const abs = Math.abs(n);
    if (abs < 1000) return Math.trunc(n).toString();
    const tiers: Array<[number, string]> = [[1e15, 'q'], [1e12, 't'], [1e9, 'b'], [1e6, 'm'], [1e3, 'k']];
    for (const [mag, suffix] of tiers) {
      if (abs >= mag) {
        const dec = typeof d === 'function' ? d(mag, abs) : d;
        let s = (n / mag).toFixed(dec);
        if (strip) s = parseFloat(s).toString();
        return s + suffix;
      }
    }
    return Math.floor(n).toString();
  },
  rate(n: number, exp = false) {
    if (!n && n !== 0) return '0';
    if (n < 1000) return this.number(n, exp ? 2 : 1);
    if (exp) return this.number(Math.floor(n), 0);
    return this.abbr(n, 1);
  },
  achAbbr(n: number, tiers?: Array<[number, number]>) {
    if (!tiers || !tiers.length) return this.number(n);
    const abs = Math.abs(n);
    for (const [mag, dec] of tiers) {
      if (abs >= mag) return this.abbr(n, dec);
    }
    return this.number(n);
  },
  achDual(val: number, expandedTiers = ACH_FMT.compact) {
    const std = this.achAbbr(val, ACH_FMT.compact);
    const exp = this.achAbbr(val, expandedTiers);
    return `<span class="view-std">${std}</span><span class="view-exp">${exp}</span>`;
  },
  ratePct(v: number) {
    if (Math.abs(v) < 1000) return this.number(v, 0);
    return this.abbr(v, 2, true);
  },
  dual(val: number, r = false) {
    let std: string;
    let exp: string;
    if (r) {
      std = this.rate(val, false);
      exp = this.rate(val, true);
    } else {
      std = Math.abs(val) > 9999 ? this.abbr(val) : this.number(val);
      exp = Math.abs(val) >= 1e9 ? this.abbr(val, 4) : this.number(val);
    }
    return `<span class="view-std">${std}</span><span class="view-exp">${exp}</span>`;
  },
  axis(n: number) {
    if (n === 0) return '0';
    if (Math.abs(n) < 1000) return (Math.round(n * 10) / 10).toString();
    return this.abbr(n, 1, false);
  },
  parse(s?: string) {
    if (!s) return new Date();
    return new Date(s.includes('T') ? s : s + 'T00:00:00Z');
  },
  dateISO(y: number, m: number, d: number) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  },
  dateLogical(ts: number | null = null) {
    const d = ts ? new Date(ts) : new Date();
    return this.dateISO(TimeManager.year(d), TimeManager.month(d), TimeManager.date(d));
  },
  datePretty(s: string) {
    if (!s || s.includes('Summary')) return s;
    const p = s.split('-');
    if (p.length !== 3) return s;
    const d = this.parse(s);
    return `${CONSTANTS.MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  },
  dateMonthDay(s: string) {
    if (!s) return s;
    const p = s.split('-');
    if (p.length !== 3) return s;
    const d = this.parse(s);
    return `${CONSTANTS.MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}`;
  },
  dateFull(s: string) {
    if (!s || s.includes('Summary')) return s;
    const p = s.split('-');
    if (p.length !== 3) return s;
    const d = this.parse(s);
    return `${CONSTANTS.MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  }
};

export function getISOWeek(s: string): number {
  const d = Formatter.parse(s);
  const date = new Date(d.valueOf());
  date.setUTCDate(date.getUTCDate() + 3 - (date.getUTCDay() + 6) % 7);
  const w1 = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((date.getTime() - w1.getTime()) / 86400000 - 3 + (w1.getUTCDay() + 6) % 7) / 7);
}

export function getWeekKey(dateStr: string): string {
  const d = Formatter.parse(dateStr);
  const dayIdx = d.getUTCDay();
  const offset = userConfig.weekStartMode === 'mon' ? dayIdx === 0 ? 6 : dayIdx - 1 : dayIdx;
  const weekStart = new Date(d.getTime() - offset * 86400000);
  return Formatter.dateISO(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate());
}

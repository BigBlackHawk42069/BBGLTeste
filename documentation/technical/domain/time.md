# Time & Formatting

Source: [`src/domain/time.ts`](../../../src/domain/time.ts).

BBGL has two clocks. Mixing them is the most common way to create "missing today" or off-by-one week bugs.

## Day start: UTC vs local

`userConfig.dayStartMode` is `'utc'` (Torn City Time / TCT) or `'local'`.

```ts
export const TimeManager = {
  useLocal() { return userConfig.dayStartMode === 'local'; },
  year(d) { return this.useLocal() ? d.getFullYear() : d.getUTCFullYear(); },
  month(d) { return this.useLocal() ? d.getMonth() : d.getUTCMonth(); },
  date(d) { return this.useLocal() ? d.getDate() : d.getUTCDate(); },
  // …
};
```

`Formatter.dateLogical(ts?)` is **the** day key used for `DayRecord.date`, calendar cells, and "is this still today?":

```ts
dateLogical(ts: number | null = null) {
  const d = ts ? new Date(ts) : new Date();
  return this.dateISO(TimeManager.year(d), TimeManager.month(d), TimeManager.date(d));
}
```

`Formatter.parse(s)` always parses `YYYY-MM-DD` as **UTC midnight** (`s + 'T00:00:00Z'`). Pretty printers (`datePretty`, `dateFull`) therefore use `getUTC*`. That is intentional: the stored key is timezone-adjusted, the display of that key is UTC-stable.

When the user flips timezone in settings (`onChangeDayStart`), history must be treated as the same unix timestamps under a new logical date. Callers that rebuild days from series (`rebuildFromSeries`) automatically re-bucket.

## Week start

```ts
export function getWeekKey(dateStr: string): string {
  const d = Formatter.parse(dateStr);
  const dayIdx = d.getUTCDay();
  const offset = userConfig.weekStartMode === 'mon'
    ? (dayIdx === 0 ? 6 : dayIdx - 1)
    : dayIdx;
  const weekStart = new Date(d.getTime() - offset * 86400000);
  return Formatter.dateISO(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate());
}
```

Sticker progression and weekly capsule bars group by this key. Changing `weekStartMode` reshuffles completed weeks — `DataController.invalidate()` after the setting change is required.

`getISOWeek` is the ISO-8601 week number (Monday-based, used for labels, not for capsule grouping).

## Display dualism

The UI has compact (`.view-std`) and expanded (`.view-exp`) number formats. CSS toggles which one is visible when the panel is tall / page mode.

```ts
Formatter.dual(val, isRate)
Formatter.achDual(val, expandedTiers)
Formatter.abbr / rate / achAbbr / axis
```

`ACH_FMT` in constants chooses decimal places by magnitude (compact vs gains vs enhancers). Do not invent a third number format in a view — go through `Formatter` so ledger, graph, and achievements stay consistent.

## Implementing a change

- Need "today"? `Formatter.dateLogical()` — never `new Date().toISOString().slice(0, 10)` (that is always UTC).
- Need a unix second from a day key? `TimeManager.dayStartTs(dateStr)` or `Formatter.parse(dateStr).getTime() / 1000`.
- Tests that assert "today" must construct timestamps with `Date.UTC` matching `dateLogical` under the test's `dayStartMode` (default UTC).

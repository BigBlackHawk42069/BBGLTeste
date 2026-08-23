# Ranked Wars & Faction History

Source: [`src/data/wars.js`](../../../src/data/wars.js).

War markers paint on calendar cells (start / win / loss). They are **not** stored in IndexedDB — only `localStorage`.

## Keys

- `KEYS.WARS_DATA` — `{ [warId]: { war: { start, end, winner }, outcome, factionId } }`
- `KEYS.WARS_SYNC` — last successful current-faction fetch (ms)
- `KEYS.FACTION_HISTORY` — `[{ factionId, joinedAt, leftAt }]` from log `6253`

## Fetches (all `fetch` + API key)

| Function | When | Endpoint |
|---|---|---|
| `fetchWars(manual)` | Every `FULL_SYNC` (skipped if last sync &lt; 24h unless `manual`) | `faction/?selections=rankedwars,basic` |
| `fetchFactionHistory` | Start of backfill only | `user/?selections=log&log=6253` |
| `fetchPastFactionWars` | Start of backfill only | `faction/{id}?selections=rankedwars` per past faction |

`user/?selections=faction` is API v2-only (v1 error 23). Current faction id therefore comes from the `basic` selection on the same v1 rankedwars request (`data.ID`).

Outcome: `w.war.winner === myFactionId ? 'won' : 'lost'`. Each war is tagged `factionId` so membership filtering works after faction hops.

## Membership filter

```js
function wasInFactionDuringWar(factionHistory, factionId, warEnd) {
  if (!factionHistory) return true;          // fail open
  const intervals = factionHistory.filter(m => m.factionId === factionId);
  if (!intervals.length) return true;        // joined after backfill ran
  return intervals.some(m => m.joinedAt <= warEnd && (m.leftAt === null || m.leftAt > warEnd));
}
```

`getWarMarkers()` builds `{ [dateLogical]: { warStart, warWon, warLost, warEnd } }` for wars with `war.end >= logStartDate`. Cached on `{ raw, cutoff, map }`.

## `renderCell` (mis-filed)

The calendar day-cell renderer (`renderCell(cont, y, m, d, …)`) currently lives at the bottom of `wars.js` because the extractor classified it with war markers. It:

- Asks `DataController.getSlice('DAY', date)`
- Paints archived-row background from `app.CAL_IMG_BASE` + tier
- Places a sticker deco + shine mask
- Attaches war marker classes from `getWarMarkers()`

Call `app.renderCell`. When this is moved to `ui/calendar.js`, update this ledger entry.

## Implementing a change

- Failures must stay isolated (`fetchWars` swallows errors) so a faction API blip cannot fail gym sync.
- Do not put war JSON in IndexedDB — export already embeds a slim `rankedWars` list from `KEYS.WARS_DATA`.

# Stickers, Achievements & Docs

Sources:

- [`src/ui/preact/views/Stickers.tsx`](../../../src/ui/preact/views/Stickers.tsx) — grid, sponsor page, dots, nav, title, item-viewer chrome
- [`src/ui/stickers.js`](../../../src/ui/stickers.js) — `loadStickerData`, RAF viewer, page-change ghosts, dropdowns
- [`src/ui/preact/views/Achievements.tsx`](../../../src/ui/preact/views/Achievements.tsx) — six pages from `computeAchievements` props
- [`src/ui/achievements-view.js`](../../../src/ui/achievements-view.js) — `computeAchievements`, copy, formatters, page-turn CRT
- [`src/ui/docs.js`](../../../src/ui/docs.js)
- [`src/ui/scan-overlay.js`](../../../src/ui/scan-overlay.js)

## Stickerbook

`loadStickerData` builds `runtime.stickerData` from `CUSTOM_STICKERS` + `DataController.getUnlockedCount()`. Preact owns the grid, sponsorship page (`page === -1`), coming-soon pages (`page >= 2`), pagination dots, and title (`PAGE_TITLES`).

`openItemViewer` / `animateViewer` / `closeItemViewer` are the 3D-ish spin viewer (`runtime.viewerLoopId`). The rotating pedestal is an `Island` so RAF can write transforms without Preact wiping them. `viewState.activeItemId` is synced across tabs.

`toggleStickerView` / `changeStickerPage` persist `currentStickerPage`. Slide ghosts stay in `changeStickerPage` when `userConfig.animations` is on. `renderStickers` is `notifyUi`.

## Achievements

`computeAchievements(historyState)` walks every day and returns lifetime energy/gains, green/gold/diamond day & week counts, streaks, per-stat bests (train/day/week/month), happy jumps, item totals. Cached on `runtime._achCache` until `DataController.invalidate`.

Six pages (`runtime._achPage` / `viewState.achPage`), rendered as JSX:

| Page | Content |
|---|---|
| 0 | Per-stat bests |
| 1 | Streaks |
| 2 | Endocrine enhancers (`computeEnhancersForPeriod`) — lifetime vs selected slice (`viewState.achEnhPeriodMode`) |
| 3 | Happy jumps + OD / energy items |
| 4 | Rewards reaped |
| 5 | Locked until career level 100 |

`handleAchCopy` writes a `👑BBGL Achievements` clipboard block from `data-ach-key` / `data-clip`. CRT in/out is `runtime._achCrt` when `userConfig.animations`. Nav, dots, swipe, enhancer switch, and copy clicks live on `AchievementsView`.

`exportData` still calls `app.computeAchievements` for the JSON `achievements` key.

## Remote docs

```js
function fetchDoc(name) {
  if (app.docCache[name]) return Promise.resolve(app.docCache[name]);
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: 'GET',
      url: BASE_DOCS_URL + name + '.html?_=' + Date.now(),
      onload(res) { /* cache + resolve */ },
      onerror() { reject(new Error('Doc fetch network error')); }
    });
  });
}
```

Repo files (not bundled): `UserDocs/privacy.html`, `privacy-tech.html`, `changelog.html`, `welcome.html`. Feature guide uses the same helper.

Modals: `openPrivacyModal` / `openChangelogModal` / `openFeatureGuideModal`. First-run welcome gates START TRACKING on the privacy checkbox (`userConfig.privacyAgreed = new Date().toISOString()`).

`docCache` lives on `app` (assigned from `torn/inject.js`).

## Scan overlay

`renderScanOverlay` notifies Preact (`ScanOverlay.tsx`) from `meta.backfill` + `runtime.backfilling`. Pause/cancel buttons set `runtime.backfillAbort`. See [Backfill](../data/backfill.md).

## Implementing a change

- New sticker art: `CUSTOM_STICKERS` only — progression math is already generic over `.length`.
- New achievement row: add it in `computeAchievements` **and** the matching page in `Achievements.tsx`, plus a `data-ach-key` / `data-clip` so copy keeps working.
- New UserDoc: add the HTML under `UserDocs/`, fetch via `fetchDoc('filename-without-html')`. Do not inline the article in JS.

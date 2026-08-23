# Stickers, Achievements & Docs

Sources:

- [`src/ui/stickers.js`](../../../src/ui/stickers.js)
- [`src/ui/achievements-view.js`](../../../src/ui/achievements-view.js) — includes `computeAchievements` (domain logic)
- [`src/ui/docs.js`](../../../src/ui/docs.js)
- [`src/ui/scan-overlay.js`](../../../src/ui/scan-overlay.js)

## Stickerbook

`loadStickerData` builds `runtime.stickerData` from `CUSTOM_STICKERS` + `DataController.getStickerMap` / `getUnlockedCount` / `isStickerCleared`.

`renderStickers`:

- Page `-1` is the sponsorship page (`renderSponsorshipPage`)
- Pages `0…` show 10 stickers; titles from `PAGE_TITLES`
- Locked stickers stay silhouetted; unlocked get the CDN art; cleared (`'+'`) get a persistent mark via `markStickerCleared` → IDB `meta.stickers`

`openItemViewer` / `animateViewer` / `closeItemViewer` are the 3D-ish spin viewer (`runtime.viewerLoopId`). `viewState.activeItemId` is synced across tabs.

`toggleStickerView` / `changeStickerPage` persist `currentStickerPage`.

## Achievements

`computeAchievements(historyState)` walks every day and returns lifetime energy/gains, green/gold/diamond day & week counts, streaks, per-stat bests (train/day/week/month), happy jumps, item totals. Cached on `runtime._achCache` until `DataController.invalidate`.

Six pages (`runtime._achPage` / `viewState.achPage`):

| Page | Builder |
|---|---|
| 0 | Per-stat bests |
| 1 | Streaks |
| 2 | Happy jumps + OD / energy items |
| 3–4 | Locked until career level 100 (`achBuildPageLocked`) |
| overview | Endocrine enhancers (`computeEnhancersForPeriod`) — lifetime vs selected slice (`viewState.achEnhPeriodMode`) |

`handleAchCopy` writes a `👑BBGL Achievements` clipboard block. CRT in/out animation when `userConfig.animations`.

This file is UI, but `exportData` calls `app.computeAchievements` for the JSON `achievements` key. If you extract a `domain/achievements.ts`, keep that `app.` assignment.

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

`docCache` lives on `app` (assigned from `torn-inject.js`).

## Scan overlay

`renderScanOverlay` reads `meta.backfill` + `runtime.backfilling` and mounts a full-panel mask (scanning / paused / cap / error / complete / settings-locked). Pause/cancel buttons set `runtime.backfillAbort`. See [Backfill](../data/backfill.md).

## Implementing a change

- New sticker art: `CUSTOM_STICKERS` only — progression math is already generic over `.length`.
- New achievement row: add it in `computeAchievements` **and** the page builder, plus a `data-ach-key` / `data-clip` so copy keeps working.
- New UserDoc: add the HTML under `UserDocs/`, fetch via `fetchDoc('filename-without-html')`. Do not inline the article in JS.

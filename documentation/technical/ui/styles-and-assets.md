# Styles & Static Assets

Sources:

- [`src/ui/styles.css`](../../../src/ui/styles.css) — ~1,450 lines of panel / calendar / ledger / graph / sticker CSS
- [`src/ui/styles.ts`](../../../src/ui/styles.ts) — `injectStyles()`
- [`src/ui/assets.ts`](../../../src/ui/assets.ts) — `CUSTOM_STICKERS`, `PAGE_TITLES`, `cdnize`
- [`src/ui/icons.ts`](../../../src/ui/icons.ts) — SVG strings + background image URLs

## injectStyles

Called from `installDomHooks` (document-start) and `init()`. Idempotent: bails if `#bbgl-styles` exists.

1. Preconnect `fonts.gstatic.com` (`#bbgl-fonts-pre`)
2. Stylesheet `#bbgl-fonts` — Aldrich, Barlow Condensed, Fjalla One, Inconsolata, Roboto Mono, VT323
3. `<style id="bbgl-styles">` with CSS after token substitution

Tokens (split/join, not `replaceAll`, so the bundle stays ES2020):

| Token | Value |
|---|---|
| `__ASSETS_GLASS_OVERLAY__` | `ASSETS.GLASS_OVERLAY` |
| `__ASSETS_STICKER_BG__` | `ASSETS.STICKER_BG` |
| `__ASSETS_HEADER_IMG__` | `ASSETS.HEADER_IMG` |
| `__ASSETS_NEW_STICKER_FRAME__` | `ASSETS.NEW_STICKER_FRAME` |
| `__CROWN_BADGE_URL__` | crown PNG for all-time button |

esbuild loads `.css` as text (`loader: { '.css': 'text' }`). `src/css.d.ts` types the default export.

## CDN images

```ts
export function cdnize(u: string): string {
  return u.replace(
    /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/(?:refs\/heads\/)?([^/]+)\//,
    'https://cdn.jsdelivr.net/gh/$1/$2@$3/'
  );
}
```

Sticker URLs are stored base64-encoded in source (`atob`) then `cdnize`d at module load. **Do not bundle the PNGs.** `CUSTOM_STICKERS` is 20 items (gym set 1–10, casino set 11–20). `DataController.buildProgressionCache` indexes this array.

`PAGE_TITLES` are the five stickerbook chapter titles (`Sweat Equity`, `Casino Collection`, …).

## Icons

`ICONS` is a map of inline SVG (logo path, close, check, paste, popout/compress, minimize). Keep them as strings — the DOM templates interpolate `${ICONS.CLOSE}` etc. `ASSETS` holds full URL backgrounds.

## Implementing a change

- New visual: add a class to `styles.css`, not a `<style>` in a view.
- New sticker: append to `CUSTOM_STICKERS` with a jsDelivr-safe GitHub raw URL (encoded). Unlock math uses `CUSTOM_STICKERS.length`.
- Domain code that needs the catalog currently imports `ui/assets.ts` (`history.js`). Prefer moving the catalog to `core/` if you touch that file for another reason.

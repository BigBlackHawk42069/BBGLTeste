# Runtime Contracts

These must survive every change, or existing Tampermonkey installs lose updates or data. They are the public surface of `0.9.91`.

## Userscript header

Source: [`userscript.meta.js`](../../../userscript.meta.js). esbuild prepends it verbatim as the JS banner. Version in the header must stay in lockstep with `SCRIPT_VERSION` in [`src/core/constants.ts`](../../../src/core/constants.ts) and `package.json`.

| Directive | Value | Why it cannot change casually |
|---|---|---|
| `@match` | `https://www.torn.com/*` | Script only runs on Torn |
| `@grant` | `GM_xmlhttpRequest` | Docs fetch (GitHub raw) is not same-origin |
| `@connect` | `raw.githubusercontent.com`, `cdn.jsdelivr.net` | Tampermonkey CSP allowlist for docs + CDN |
| `@run-at` | `document-start` | `installDomHooks` must patch `insertBefore`/`appendChild` before Torn mounts sidebar |
| `@updateURL` / `@downloadURL` | `…/main/BigBlackGymLog.js` | Existing installs poll this exact URL |

The published filename and GitHub path **are** the update channel. Do not emit to `dist/`.

## Load guard

```ts
if (!window.__BBGL_LOADED__) {
  window.__BBGL_LOADED__ = true;
  boot();
}
```

Torn can evaluate the script more than once (SPA navigations, Tampermonkey re-inject). The guard makes `boot()` idempotent. Declared on `Window` in [`src/gm.d.ts`](../../../src/gm.d.ts).

## Storage keys

All keys are in `KEYS` (`src/core/constants.ts`). **Do not rename them** — users' browsers already have these strings.

```ts
export const KEYS = {
  STATE: 'bbgl_view_state_v1',
  CONFIG: 'bbgl_config_v1',
  SESSION: 'bbgl_trained_flag',
  LAST_SYNC: 'bbgl_last_data_sync_v1',
  SESSION_CACHE: 'bbgl_session_cache_v1',
  DEMO: 'bbgl_demo_mode',
  SB_NOTIF: 'bbgl_sb_notif_seen',
  DEV_MODE: 'bbgl_dev_mode',
  CHANGELOG_VER: 'bbgl_changelog_seen_ver',
  CHANGELOG_NOTIF: 'bbgl_changelog_notif',
  WARS_SYNC: 'bbgl_wars_last_sync_v1',
  WARS_DATA: 'bbgl_wars_data_v1',
  FACTION_HISTORY: 'bbgl_faction_history_v1'
} as const;
```

Also used as bare strings in a few places (do not invent new ones without adding them here):

- `bbgl_initialized` — onboarding complete
- `bbgl_dev_onboarding` — session flag so a wipe/reload does not re-stamp initialized

`KEYS.CONFIG` is a JSON blob of `UserConfig` (`apiKey`, day/week start, feature toggles). `KEYS.STATE` is `ViewState` (open/expanded/subView/calendar/graph). `KEYS.DEMO === '1'` turns on demo mode across tabs.

## IndexedDB

- Database name: `bbgl_db`
- Version: **2**
- Stores: `meta` (key `'meta'`) and `days` (key = `YYYY-MM-DD`)
- Upgrade path deletes the old v1 `history` object store if present

See [IndexedDB Persistence](../data/indexeddb.md). Changing the name or dropping a store without a migration **wipes every user's log**.

## Forced wipe lever

```ts
export const WIPE_BELOW_VERSION = '0.9.90';
```

On `init()`, if the last-seen changelog version is below this cutoff, `factoryReset()` runs. `validateImportSchema` also rejects exports whose `meta.version` is below the cutoff, so an old backup cannot resurrect pre-wipe data.

To retire the lever, set it to `'0.0.0'` (the sanitize code treats that as disarmed). Do not lower it after users have been wiped.

## Cross-tab sync

Two channels, both required:

1. **`BroadcastChannel('bbgl_sync')`** — `DBManager._persist` / `clearStorage` post `{ type: 'update', from: TAB_ID }`. Other tabs debounce 200ms, `loadHistory()`, hydrate, re-render panel + scan overlay + backfill button. The sender ignores its own `TAB_ID`. Demo mode ignores the channel.
2. **`window` `storage` events** — `handleStorageEvent` in `src/boot/init.js` mirrors `KEYS.STATE` (panel open/view), `KEYS.LAST_SYNC` (treat as a channel ping), and `KEYS.DEMO` (enter/exit demo from another tab).

`TAB_ID` is `Math.random().toString(36).slice(2)` per page load (`state.ts`). Backfill locks store `lockOwner: TAB_ID`.

## Network split (hard rule)

| Traffic | Transport | Why |
|---|---|---|
| Torn logs / battlestats / faction / ranked wars | `fetch('https://api.torn.com/...')` | Same-origin-enough for Torn; API key is the user's |
| Privacy / changelog / welcome / feature-guide HTML | `GM_xmlhttpRequest` + `BASE_DOCS_URL` | GitHub raw is cross-origin; needs the Tampermonkey grant |

```ts
export const BASE_DOCS_URL =
  'https://raw.githubusercontent.com/BigBlackHawk42069/BigBlackGymLog/DevBranch/UserDocs/';
```

`UserDocs/*.html` stay **remote**. Do not bundle them. Sticker and calendar images stay on jsDelivr via `cdnize()` — see [Styles & Assets](../ui/styles-and-assets.md).

Never send the API key to GitHub. Never fetch Torn through `GM_xmlhttpRequest`.

## Custom events

`DataController.processDataPayload` ends successful paths with:

```js
window.dispatchEvent(new CustomEvent('bbgl:dataUpdated'));
```

`init()` listens and, if the panel is visible, calls `renderPanelContent()`, `updateLevelBar()`, `renderBackfillButton()`, `renderScanOverlay()`. New views that read history should subscribe to this event rather than importing `DataController` into a cycle.

## Rate convention

Gym `rate` is **gain per 150 energy**, not per 1E:

```ts
rate: cost > 0 ? r2(gain / cost * 150) : 0
```

`r2` is `Math.round(v * 100) / 100`. All rebuild / sanitize / export paths must keep this formula or graphs and Best Gym drift.

## Version strings that must stay aligned

1. `SCRIPT_VERSION` in `src/core/constants.ts` (`'0.9.91'`)
2. `"version"` in `package.json`
3. `@version` in `userscript.meta.js`

Mismatch means changelog notifs fire forever, or Tampermonkey shows a different version than the UI.

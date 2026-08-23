# Shared State & Logging

## Why a bag of mutables

The old script was one IIFE. Every function closed over the same objects. The refactor **did not** introduce a store. [`src/core/state.ts`](../../../src/core/state.ts) exports those objects with the **same identity** so `userConfig.apiKey = v` still works from any module.

`core/` must not import `domain/`, `data/`, `ui/`, or `boot/`. `log.ts` must not import `state.ts` (that cycle was already rejected once). Dev-mode is injected the other way:

```ts
setDevChecker(() => runtime.devMode);
```

## Objects

| Export | Kind | Persist? | Notes |
|---|---|---|---|
| `runtime` | `RuntimeState` object | no (flags via other keys) | demo, backfill, sticker RAF, `careerLevelExp` |
| `userConfig` | `UserConfig` object | `KEYS.CONFIG` | mutate fields in place; `saveConfig()` |
| `viewState` | `let` | `KEYS.STATE` | **reassign via `setViewState`** |
| `calendarState` | object | derived from viewState | year/month/selection |
| `graphState` | object | `viewState.graphMode` / `graphStats` | active stats, drag handlers |
| `historyCache` | `let` | IndexedDB | **reassign via `setHistoryCache`** |
| `dom` | object | no | cached element refs |
| `TAB_ID` | const string | no | per-tab id for BroadcastChannel + backfill lock |
| `refreshClickLog` | number[] | no | last 4 refresh clicks (60s window) |
| `layoutObservers` | array | no | MutationObservers — **do not reassign** (`length = 0`) |
| `lastButtonLocation` | `let` | no | `setLastButtonLocation` |
| `topCeilingCache` / `topCeilingTs` | `let` | no | `setTopCeiling` |

### Why setters exist

ESM imported bindings are live but **not assignable** from the importer:

```ts
export let historyCache: HistoryState | null = null;
export function setHistoryCache(next: HistoryState | null): void {
  historyCache = next;
}
```

`DataController.hydrate` / `processDataPayload` call `setHistoryCache`. Writing `_historyCache = x` or `historyCache = x` from another file throws.

`layoutObservers` is a `const` array. `attachLayoutObservers` must do `layoutObservers.length = 0`, not `layoutObservers = []`.

## Hydration at module load

`hydratePersistedState()` runs as a side effect of importing `state.ts` (which every extracted file does). It is safe in Node tests because `browserStorage` swallows missing `localStorage`:

```ts
function browserStorage(kind: 'localStorage' | 'sessionStorage'): Storage | null {
  try {
    const store = (globalThis as unknown as Record<string, Storage | undefined>)[kind];
    return store || null;
  } catch {
    return null;
  }
}
```

Load rules:

- `KEYS.STATE` → merge into `viewState`; map legacy `graphMode === 'gains'` to `'values'`
- `KEYS.CONFIG` → copy only `ALLOWED_CONFIG_KEYS`
- `KEYS.DEMO === '1'` → `runtime.demoMode = true`
- session `KEYS.DEV_MODE === 'true'` → `runtime.devMode = true`
- If no `calYear`, seed calendar from `dayStartMode`

`saveViewState()` no-ops while `runtime.isSyncing` so a storage-event apply does not echo back and fight the other tab.

`saveConfig()` writes a **partial** object (only defined allowed keys) so a half-initialized config cannot wipe the API key with `undefined`.

## Logging

[`src/core/log.ts`](../../../src/core/log.ts):

```ts
Log.boot();   // once: "BBGL v0.9.91 booted"
Log.info / warn / error
Log.debug     // suppressed unless runtime.devMode
Log.group     // collapsed group in dev only

Perf.start('init') / Perf.end('init')
Perf.wrap('computeAchievements', () => …)
Perf.wrapAsync('name', async () => …)
```

Marks use `performance.mark('bbgl:' + name)`. They are no-ops when not in dev mode, so production Torn pages stay quiet.

Turn on dev: `sessionStorage.setItem('bbgl_dev_mode', 'true')` then reload. Optional `window.initDevTools` is called from `init()` if present (not shipped in this repo).

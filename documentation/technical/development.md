# Build, Tests & Tooling

This is a **userscript package**, not a Next/Node app. There is no `.env`, no Docker, no `/api/health`.

## Scripts

From [`package.json`](../../package.json):

| Command | What it does |
|---|---|
| `npm run build` | `node esbuild.config.mjs` → overwrite repo-root `BigBlackGymLog.js` |
| `npm run dev` | same config with `--watch` (reload Tampermonkey / Violentmonkey from the file) |
| `npm run typecheck` | `tsc --noEmit` on `src/**/*.ts`, `src/**/*.tsx`, and `src/**/*.d.ts` (extracted `.js` is **not** typechecked) |
| `npm test` | `node --test --experimental-strip-types` on `src/**/*.test.ts` |

Runtime (bundled into the IIFE): `preact`. DevDependencies: `typescript`, `esbuild`. Do not add another runtime package without an explicit decision. Do not add a test runner — `node:test` is enough.

## esbuild

[`esbuild.config.mjs`](../../esbuild.config.mjs):

```js
{
  entryPoints: ['src/main.ts'],
  outfile: 'BigBlackGymLog.js',   // repo root, not dist/
  bundle: true,
  format: 'iife',
  target: 'es2020',
  platform: 'browser',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  banner: { js: contents of userscript.meta.js + newline },
  loader: { '.css': 'text', '.html': 'text' },
  legalComments: 'none'
}
```

`tsconfig.json`: `strict: true`, `lib: ["ES2020", "DOM"]`, `module: "ESNext"`, `noEmit: true`, `allowImportingTsExtensions: true`. **Do not** add Node `lib` to `src/` (the bundle runs in Torn's page). Tests may import `node:test` / `node:assert` — they are excluded from `tsc` via `src/**/*.test.ts`.

After you change source: `npm run build` and load the new `BigBlackGymLog.js` in Tampermonkey. GitHub raw updates only happen after this file is committed to `main`.

## Tests (shipped)

| File | Covers |
|---|---|
| `src/domain/capsules.test.ts` | `classifyDay`, `computeWeekCapsules`, `computeWeekCompletion` |
| `src/domain/leveling.test.ts` | XP cost, progress, daily XP, titles |
| `src/domain/day.test.ts` | `initializeDayObject`, `sumStats`, `normalizeApiLogs` |
| `src/domain/history.test.ts` | `rebuildFromSeries`, `reconcileIncremental` |

These are the units that can run without Torn, IndexedDB, or CSS. Do **not** import `history.js` or any file that imports `styles.ts` from a test (Node cannot load `.css`).

When you change a pure function, add/adjust a test in the matching file. When you change extracted JS, rely on `npm run build` + a Tampermonkey pass (the plan forbids browser automation against live Torn).

## Local Tampermonkey loop

1. `npm run dev`
2. Point Tampermonkey at the local `BigBlackGymLog.js` (file URL or Violentmonkey local)
3. Exercise the surface you touched: footer tab, sidebar, panel, `#gymlog`, demo, Resync, Backfill overlay, import/export, two tabs

There is no headless Torn login in this repo.

## `.gitignore`

Ignores `node_modules`, `/Dev`, editor metadata. **`BigBlackGymLog.js` is tracked** on purpose (update URL).

## Version bump checklist

1. `SCRIPT_VERSION` in `src/core/constants.ts`
2. `package.json` `"version"`
3. `@version` in `userscript.meta.js`
4. `npm test && npm run typecheck && npm run build`
5. Tampermonkey smoke on torn.com
6. Commit the rebuilt `BigBlackGymLog.js` with the source

If the change is a breaking data format, also decide whether to raise `WIPE_BELOW_VERSION` (wipes every install below that version **and** rejects older exports).

## Implementing a change (quick map)

| You want to… | Start here |
|---|---|
| Change green/gold thresholds or weekly pans | `domain/capsules.ts` + tests |
| Change career XP | `domain/leveling.ts` + tests |
| Decode a new Torn item log | `ITEM_LOG_META` in `constants.ts` + `day.test.ts` |
| Change how days are rebuilt | `domain/history-engine.ts` + tests |
| Persist a new field | `types.ts` + `sanitize.js` + `db.js` |
| Call Torn | `universalFetch` only |
| Add a settings row | `buildSettings*` in `sync.js` + bind in `events.js` |
| Add a toolbar view | `templates.js` + `panel.js` `switchView` + `events.js` + `handleStorageEvent` |
| Fix sidebar inject | `torn-inject.js` `SB_*` + `installDomHooks` |
| Cross-file call | `app.fn = fn` + `app.fn()` from others |

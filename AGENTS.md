# AGENTS.md

This file provides guidance to any coding agent (Claude Code, Codex, or similar) when working with code in this repository.

## Build System

There is no npm or package manager. Builds are driven by three batch files in `Dev/`, each bound to a VS Code task/keybinding:

- **Dev build** (`Dev/dev-build.bat`, Ctrl+Shift+D) — concatenates `Dev/src/` into `Dev/BBGLDev.js` (readable, unminified, devtools included). Use this for all active development.
- **Release-dev build** (`Dev/release-build.bat`, Ctrl+Shift+B) — minifies `Dev/src/` into `Dev/BBGLRelease.js` (devtools stripped), stamped with a DevBranch update/download URL. Lets the minified/release-shaped build be installed and tested locally before merging to main.
- **Full release build** (`Dev/full-release-build.bat`, Ctrl+Shift+F) — minifies `Dev/src/` into `BigBlackGymLog.js` at the repo root (devtools stripped), stamped with the main-branch update/download URL. This is the file that ships in the main branch. Run this only when merging a tested release to main.

All three call external PowerShell scripts (`Build Tools/BBGL/`), which in turn call the shared `Build Tools/build-root.js` for the two minified builds (`node build-root.js --url <script-url> --out <path>`). Source files are numbered and concatenated in filename order — the order matters.

There is a single header template, `Dev/src/00-header.js` (excluded from body concatenation like any `00-*.js` file), shared by all three builds. It contains two placeholders that every build script substitutes fresh — never preserved from a prior output file:
- `__SCRIPT_VERSION__` — read live out of `SCRIPT_VERSION` in `01-iife-open.js` via regex, so bumping that one constant updates the version everywhere (console boot badge, changelog-seen comparison, and the Tampermonkey header) with a single edit.
- `__SCRIPT_URL__` — the update/download URL, passed in per build (DevBranch location of `BBGLDev.js`/`BBGLRelease.js` for the first two builds, the main-branch location of `BigBlackGymLog.js` for the full release build). This is the only thing that differs between the three outputs' headers.

**When editing source**: always edit files under `Dev/src/`. `BigBlackGymLog.js`, `Dev/BBGLDev.js`, and `Dev/BBGLRelease.js` are build outputs, not sources. Changes to build outputs will be overwritten on the next build.

There are no tests and no linter.

## Architecture

BBGL is a Tampermonkey userscript that runs on `torn.com`. The entire codebase is a single IIFE (`Dev/src/01-iife-open.js` → `Dev/src/99-iife-close.js`) with a guard against double-loading (`window.__BBGL_LOADED__`).

### Source File Sections

Each file maps to a named section:

| File | Section | Contents |
|---|---|---|
| `00-header.js` | Userscript header | `@match`, `@grant`, metadata |
| `01-iife-open.js` | Boot | `Log`, `Perf`, IIFE wrapper |
| `02-section-i-constants.js` | Constants & State | `KEYS`, `GAME`, `CONSTANTS`, `userConfig`, `viewState`, `runtime`, item log metadata |
| `03-section-ii-utils.js` | Utilities | `Formatter`, `TimeManager`, `TooltipController`, `saveConfig`, `saveViewState`, week/date helpers |
| `04-section-iii-styles.js` | Styles | All CSS injected as a JS string at runtime; also SVG icons and image assets |
| `05-section-iv-data.js` | Data Storage & Network | `DBManager` (IndexedDB), backfill engine, `universalFetch`, API normalization |
| `06-section-v-logic.js` | Data Logic | `DataController`, `achFmtGain`, achievement builders, export/import, `clearData`, `factoryReset` |
| `07-section-vi-ui.js` | UI | Calendar rendering, weekly track bars, level bar, settings, privacy/changelog modals, sidebar injection |
| `08-section-vii-graph.js` | Graph | `GraphController` — SVG stat graph |
| `09-section-viii-stickers.js` | Sticker Engine | Sticker book rendering and unlock logic |
| `10-section-ix-init.js` | Init & Events | `handleGymClick`, `openHistory`, `updateCellSelection`, panel mode switching, boot sequence |
| `11-section-x-devtools.js` | Dev Tools | Dev-mode toggle button, dev widget (API counter, XP/level triggers, factory reset), lightweight console overlay, `window.BBGL`, `window.devmode` — see Dev Tools below |

### Key Singletons

- **`DataController`** — the central data cache. Holds a computed `timeline` (array of day objects), `slices` (aggregated views), sticker map, etc. Call `DataController.invalidate()` after any data change. `invalidateToday()` is a lighter version for changes that only affect the current day.
- **`DBManager`** — IndexedDB wrapper. Stores `meta` (history metadata, stickers, backfill state) and `days` (per-day training records) in two object stores.
- **`Formatter`** — number/date formatting. `Formatter.abbr()` is the core abbreviation engine (supports k/m/b/t/q). `Formatter.achGain()` is the achievement-page formatter (abbreviates 1k+). `Formatter.gain()` abbreviates 1m+ (used on the Endocrine Enhancers page).
- **`GraphController`** — SVG graph, self-contained.
- **`runtime`** — ephemeral in-memory state object (not persisted). Holds `demoMode`, `careerLevelExp`, `stickerSlots`, active caches, etc.
- **`userConfig`** — persisted to `localStorage` under `KEYS.CONFIG`. Includes `privacyAgreed` (ISO timestamp), which doubles as the reward gating cutoff date (see below).
- **`viewState`** — persisted to `localStorage` under `KEYS.STATE`. UI navigation state.

### Panel Modes

The `#bbgl-panel` element has three mutually exclusive states:

- **Compact** (default) — `bbgl-compact` class
- **Expanded** — `bbgl-expanded` class
- **Page** — `bbgl-mode-page` class

The three mode classes are mutually exclusive and applied at panel creation, so a panel always carries exactly one. CSS scoping for compact-only rules uses `#bbgl-panel.bbgl-compact`; compact/expanded/page rules for a given component all sit at equal specificity, differentiated only by the mode class.

### Data Flow

```
Torn API → universalFetch → normalizeApiLogs → DataController.sync()
                                                      ↓
                                               DBManager (IndexedDB)
                                                      ↓
                                           DataController._cache
                                          (timeline, slices, stickers)
                                                      ↓
                                              UI render functions
```

All localStorage keys are namespaced under `bbgl_` and defined in the `KEYS` constant. IndexedDB is used for training history (too large for localStorage).

### Reward Gating

`meta.rewardStartDate` (Unix seconds, stored in DB meta) is the single source of truth for when reward eligibility begins. It's stamped to "now" exactly once, the first time `logStartDate` is unset — i.e. on the first sync after a fresh install *or* after Clear Data/Factory Reset. `getInstallWeekKey()` converts it to a week key; both sticker awards and `careerLevelExp` are gated to weeks on or after this key.

`rewardStartDate` is deliberately decoupled from `userConfig.privacyAgreed`: `privacyAgreed` survives Clear Data (so the privacy modal doesn't re-trigger), but `rewardStartDate` does not — it resets on every clear so a cleared-and-reconstructed log can't re-farm rewards for days it was already credited for. `logStartDate` (also in DB meta) tracks the oldest reconstructed log entry and *can* be pushed earlier by Backfill — `rewardStartDate` never moves, backfilled pre-reward-date days display normally but are not reward-eligible. `getInstallWeekKey()` falls back to `null` (no gating) only if `rewardStartDate` is missing — `importData()`'s self-healing of `privacyAgreed` (06-section-v-logic.js, not `init()`) makes an undefined `privacyAgreed` rare in practice, but does not itself set `rewardStartDate`.

### CSS

All styles are injected at runtime as a single string from `04-section-iii-styles.js`. There are no external stylesheets. Styles use the `#bbgl-panel` root for scoping. The `bbgl-no-animations` class on `#bbgl-panel` disables all CSS animations when the user has animations turned off.

### Backfill Engine

The backfill system (`05-section-iv-data.js`) walks Torn's item/gym logs backwards in batches to reconstruct historical training data. It maintains per-group frontiers and a `logStartDate` floor. `computeBackfillFloor()` always pushes `logStartDate` earlier (never later). Backfill state survives interruption via a heartbeat lock in DB meta.

### Dev Tools

All dev-only tooling lives in `Dev/src/11-section-x-devtools.js` and nowhere else. `build-root.js` (the release builder) drops this file entirely via its `DEVTOOLS_FILES` set — it never reaches `BigBlackGymLog.js`. `Dev/dev-build.bat` is a blind concat and needs no special-casing, so the file ships normally in `Dev/BBGLDev.js`.

The only production-code contact point is a single guarded call in `init()` (`10-section-ix-init.js`): `if (typeof window.initDevTools === 'function') window.initDevTools();`. In the release build that guard just short-circuits.

`Perf`, `Log.debug`/`Log.group`, and `isDevMode()`/`runtime.devMode` are deliberately **not** part of this split — they're inert no-ops when `devMode` is off, and their call sites are threaded through too many production hot paths (graph draw, panel render, sync, etc.) to be worth stripping for negligible size savings. They ship in both builds.

## Comment & Documentation Policy

Source comments exist for developer sanity, with one exception: `05-section-iv-data.js` is the sole **user-facing** section. Its notes exist purely so a non-programmer can read the source and verify the project's claims about how their Torn API key and training log data are handled. Keep those notes short, in plain language, and scoped only to API key handling, what's fetched/sent over the network, and where/how log data is stored or deleted — everything else in that file is ordinary internal commentary and follows the general rule below.

Everywhere else, comments should stay terse: no restating what the code already says, no "was X, now Y" change history, no speculative "intended for" / "plan is to" language describing unconfirmed future work, and no embedded multi-line code examples (a one-line structural shape like `{ id, date, value }` is fine; a duplicated code block is not). Keep a comment only when it encodes something the code can't say for itself — a hidden constraint, an invariant, an ordering dependency, or the reason a rejected alternative didn't work.

`04-section-iii-styles.js` (Styles) has nothing security-relevant in it, so it doesn't serve the transparency purpose the Data section exists for — in source, its comments just follow the general terse-dev-comment rule above like any other file. The **shipped release build** is held to a stricter standard, though: no prose at all should reach `Dev/BBGLRelease.js` / `BigBlackGymLog.js` for this file. The only things that belong in the built output's `CSS_STYLES` template literal are the CSS rules themselves and the purely decorative ASCII (the head art, the shaft's `/*---*/` fill, and the balls art at the bottom) — plus the file's own `[SECTION III]` banner, same as every other section's banner. Today nothing in `build-root.js` actually enforces this distinction (it preserves every comment in this file verbatim, decorative or not) — so until that's built, the practical way to guarantee the release output is clean is to keep the source itself free of prose here, or add real strip logic to `build-root.js`. Whichever path is taken, don't assume this is already handled.

**Build-time mechanics** (`build-root.js`): `04-section-iii-styles.js` and `05-section-iv-data.js` are both in `VERBATIM_FILES` — emitted whole into both minified builds (`Dev/BBGLRelease.js` and the root `BigBlackGymLog.js`), never comment-stripped. Every other section's comments are stripped by the collapse-to-one-line pass, except each file's `[SECTION ...]` banner, which `isSectionHeader()` preserves everywhere regardless. Because Styles and Data ship verbatim, their comment content directly affects shipped file size — keep that in mind before adding anything to either one.

# Big Black Gym Log - Testing Phase Changelog

Version 0.9.92 - Pending

### New Features:
- **Level-Band Title System**: Replaced the single flat flavor title per Atrophy tier with a six-band system that changes the title as you climb through each tier instead of staying static for the whole run. Titles follow a raw-clay-to-fired-brick metaphor (Dry Clay → Moistened Clay → Hand-Jerked Clay → Block-Molded Clay → Pit-Fired Clay → the tier's capstone title), escalating in wording intensity per Atrophy tier, with a fixed easter-egg title at Level 69 on every tier. Only reaching Level 100 on the final Atrophy tier (A2) shows "Fully Bricked" — A0/A1 auto-roll into the next tier and keep their own capstone title instead.
- **Stat-Based Flavor Title**: Added a second flavor title, appended right after the Level-Band Title, based on whichever two battle stats currently rank highest for you. It progresses completely independently of Atrophy on its own cumulative-energy-spent track — 11 escalating stages, each with its own visual finish (starting dull, building all the way to a shiny, glowing, iridescent finish at the top). To keep it from flickering back and forth when two stats are close in value, it only re-checks which stats are leading at fixed energy checkpoints, and only switches once the new pairing has genuinely held steady for a full week.

### Improvements:
- **Leveling Curve Retune**: Retuned the per-level EXP cost curve (floor, peak, breakpoint percentages/values, and tail-curve steepness) and the daily EXP earn-rate tiers based on live feedback, replacing the placeholder values shipped in 0.9.90. The Gold+ earn rate (1,500E+) now diminishes sharply, offset by a flat +100 EXP bonus for actually reaching Diamond (2,000E+) — a risk/reward tradeoff where pushing past Gold only pays off if you go all the way. Also adjusted the Happy Jump burst rate.
- **Per-Atrophy Level Range**: Reworked the leveling engine so every Atrophy tier now caps at the same Level 100, but starts at a different point (A0 at Level 0, A1 at Level -1, A2 at Level -10) — later Atrophy tiers are genuinely longer climbs (more paid level-ups) on top of their existing per-level cost multiplier, not just costlier per level.
- **Graph Y-Axis Precision Refinements**: Reworked y-axis gridline label formatting across all graph modes (Values, Gains, Rates). Abbreviated labels (k/m/b/t/q) now drop their decimal once a value reaches 100+ units of its tier (e.g. `102m` instead of `102.3m`), falling back to an exact half-unit (`102.5m`) only when whole-unit gridline spacing would otherwise leave just 2 labels on the axis. A step-aware pass also strips the decimal from an axis's entire label set whenever none of them actually land on a non-whole value (e.g. `82m, 84m, 86m` instead of `82.0m, 84.0m, 86.0m`), rather than relying on the magnitude rule alone. Also tightened the "extra headroom" gridline threshold from 5% to 1% of the axis range, so a padding gridline above the plotted line's peak only appears when the peak is genuinely close to the top of the chart instead of triggering on ordinary near-round numbers. Additionally, the Rates-mode tooltip now drops decimal places on its Rate and Growth values once they exceed 99.

--------------------------------------------------

Version 0.9.91 - Pending

### Bug Fixes:
- **Fly-Out Sidebar Button Styling**: Fixed the Gym Log sidebar button rendering unstyled (missing background pill, wrong link classes) on PC. Torn's new "Fly-Out Sidebar" account setting changes the desktop sidebar's underlying CSS class names even while actually browsing on PC — where the flyout itself never renders — and the button's live style-copy logic wasn't accounting for the new class shape, including a container class and row class it was silently dropping.
- **War Win/Loss Post-Its Not Appearing**: Fixed ranked-war win/loss markers never appearing on the calendar. The faction-ID lookup used to tag war outcomes was calling `user/?selections=faction`, which is an API v2-only selection and always errors out under v1, silently failing the lookup every time. Reverted to resolving the faction ID from the same `faction/?selections=rankedwars,basic` request already used to fetch the wars themselves. Requires generating a new API key via the updated Create API Key flow to pick up the added "basic" permission.
- **Expanded Panel Ledger Squeeze on Mobile**: Fixed the ledger area visually compressing whenever the expanded panel's height got constrained (e.g. a short mobile viewport forcing `max-height` to clamp below the panel's normal height). The ledger's height was a percentage of the panel's own height, so it shrank right along with it even though `flex-shrink` was already 0 — percentage flex-basis isn't protected by that the way a fixed value is. It's now a fixed pixel height that holds steady regardless of clamping, so the scrollable calendar/grid area beneath it absorbs the height reduction instead, since it already scrolls and the ledger doesn't.

### Improvements:
- **Fly-Out Sidebar Support**: Added the Gym Log button to Torn's new mobile Fly-Out Sidebar, alongside its existing placement in the desktop sidebar and footer tab.
- **Calendar Header CSS Cleanup**: Reworked padding and alignment handling across the calendar header (month/year/all-time summary rows, title stack, header wrapper) to remove several stacked/duplicated padding values and brute-forced positioning offsets left over from earlier layout passes, improving alignment consistency across panel widths and modes.
- **Footer Tab Tap Tooltip Suppression**: Suppressed the Big Black Gym Log tooltip from appearing when tapping (rather than hovering) the footer tab on mobile. It's now hover-only, matching desktop behavior, since tapping the footer tab already performs an immediate action (opening the panel) and didn't need the tap-to-show tooltip treatment used elsewhere.
- **Toolbar & Footer Tab Mobile Tooltip Behavior**: Reworked touch tooltip handling for the ledger/graph/achievements/stickers toolbar and the footer tab. Tap-and-hold on the toolbar now previews the tooltip like a real hover (via the existing panel-wide scrub system) and releases cleanly without also triggering the view switch; a quick tap still switches views but now also shows the tooltip briefly (500ms auto-dismiss) instead of leaving it open indefinitely. The footer tab was excluded from tap-triggered tooltips entirely, since tapping it performs an immediate action (opening the panel) and doesn't need one.

--------------------------------------------------

Version 0.9.90 - Pending

### New Features:
- **RPG Leveling System**: Introduced the career leveling system built on top of the existing weekly-points foundation. Daily training now accumulates career EXP (tiered by E spent, with a Happy Jump bonus) into a 1–99 per-level cost curve, gated across three Atrophy tiers (A0/A1/A2) with independent floor/ceiling values and per-tier multipliers. The cost curve itself (piecewise linear ramp into a power-curve tail) is fully locked in and pending live user feedback before final tuning. Added level-up animations to the level bar; Atrophy-tier transition animations are in progress.
- **Level 100 Locked Achievements Page**: Added a 6th page to the achievements panel, gated behind reaching Level 100 (the first Atrophy tier). Displays a locked placeholder for anyone below that level.
- **Dynamic Summary Bar-Graph Buttons**: Replaced the static All-Time/Yearly/Monthly summary buttons with dynamic bar-graph icon buttons.
- **Expanded Item Tracking & Calendar Events**: Expanded training item tracking to include Overdoses (ODs), and added war status/events directly to the calendar so events affecting training are visible at a glance. Requires a broader API key scope to capture the additional data — existing users can update this via the existing Create API Key flow in settings.
- **Big Black Backfill Onboarding Overhaul**: Rewrote the entire Backfill onboarding and scan-status experience end to end. The Start Tracking modal now frames the fresh-log vs. Backfill choice in plainer terms ("START EMPTY LOG" replaces "START LOG FRESH"). The scan overlay's masked states were rewritten with reason-specific copy for every stop condition, splitting the previous single "Scan Interrupted" catch-all into a distinct `interrupted` stopReason (tab/browser closed mid-scan) versus `error` (in-session network/API failure), alongside dedicated Paused, Daily Limit Reached, and Fully Backfilled states with an italicized reward-gating note. The scanning state gained an inline pause control next to the title, a pulsing "rows recovered" indicator instead of a bare ticking number, a Fjalla One title font matching the rest of the panel's branding, and a repositioned Cancel button. The Settings menu's Big Black Backfill button no longer abbreviates to "BB Backfill" in compact mode (aside from the Resume state, which still needs the shorter form), requires a tap-to-confirm gate before starting or resuming a scan, surfaces its daily-cap cooldown via a hover/tap tooltip instead of a live per-second countdown on the button face, and gains a permanent green "Fully Backfilled!" state that persists until the log is cleared.

### Bug Fixes:
- **Native Torn Button Conflict**: Fixed a site-wide button misshaping issue caused by BBGL's custom button styles being applied globally to Torn's native `.torn-btn` class. All BBGL-generated buttons have been migrated to a private `.bbgl-btn` class family (`.bbgl-btn`, `.bbgl-btn-green`, `.bbgl-btn-red`, `.bbgl-btn-purple`), keeping button appearance identical while fully isolating BBGL's styles from Torn's UI on every page.
- **Premature Sticker Unlock**: Fixed a bug where stickers were appearing in the stickerbook as soon as the weekly bar filled up mid-week. The sticker award logic now only processes fully completed past weeks, so stickers are never unlocked for the current active week regardless of bar fill state — they appear correctly once the week ends and is archived.
- **Automatic Log Sync Speed**: Improved automatic log syncing so training done on another device reflects more quickly.
- **Backfill Interruption Data Loss**: Fixed a bug where an interrupted Backfill run could silently lose log data without any visible indication to the user.
- **Sidebar Active-State on Gym Log Page**: Fixed a bug where the Gym Log sidebar button wouldn't show its active/highlighted state while already viewing the gym log page.
- **Incomplete Clear Data Reset**: Fixed a bug where clearing the log left certain pieces of data behind, which could distort future data going forward.
- **Achievements Page Settings Return**: Fixed a bug where closing Settings while viewing the Achievements page dropped you back on the ledger/calendar instead of returning to Achievements, unlike Graph and Stickerbook which already remembered their place.

### Improvements:
- **Weekly Progress Bar Redesign**: Replaced the solid weekly progress bar fill with individual daily capsules for clearer at-a-glance discoverability. Summary buttons were redesigned as visual bar-graph icons and now also appear as flags directly on the weekly progress bar, indicating when a weekly summary is available.
- **Simplified Disclosures**: Streamlined the onboarding privacy/consent disclosures for a more frictionless experience. Added a separate Technical Disclosure with the full detailed breakdown for users who want it.
- **Settings Menu Reorganization**: Reorganized and simplified the settings menu layout.
- **RESYNC Button**: Moved the log refresh action out of its previous location into a dedicated RESYNC button at the top of the settings menu for quicker access.
- **Achievements Page Tooltip Refinement**: Rewrote tooltips across the Endocrine Enhancers and Happy Hopping achievement pages — corrected item pluralization, refined the wording and formatting, and made expanded mode show additional category detail not shown in compact/page mode.
- **Endocrine Enhancers Period Toggle**: Added an All-Time / Selected switch to the Endocrine Enhancers achievements page, letting users choose between lifetime totals and the period currently selected on the calendar.
- **Performance Optimizations**: Additional performance passes to keep the script lightweight.
- **Demo Mode Bar Repositioning**: Moved the purple Demo Mode bar from the bottom of the calendar header to the top, clearing room for the new EXP/level bar now anchored to the header's bottom edge. In panel mode, the bar now stays pinned to the bottom edge of the top panel as you scroll or toggle tall mode instead of scrolling out of view.

--------------------------------------------------

Version 0.9.75 - 2026-06-05

### New Features:
- **BB Backfill**: A powerful historical reconstruction engine that allows you to walk back and synchronize your training history, reaching all the way to the creation of your account. By intelligently scanning and parsing your training logs in reverse, it bridges missing data gaps to construct a complete, seamless lifetime record of your progression at your own pace.
- **BB Best Gym**: Added an optional feature (on by default) that automatically switches to the best gym for the specific stat you're training, preventing accidental training at suboptimal gyms. Pressing a train button while a better gym is available opens Torn's gym change for that gym so you can confirm or cancel it — it never trains or switches without you. Once it has offered a swap for a stat, it stays out of the way for that stat until the page reloads, so you can keep training your current gym freely. Toggle it from the floating switch at the top of the gym page (beside the City and Tutorial buttons) or from the settings menu, with an optional sub-setting to exclude specialist gyms.
- **Diamond Days**: Added a brand new achievement tier for reaching 2000E+ training days, complete with new jewel visuals, weekly bar progress segments, hover animations for stickers and jewels, and enhanced bonuses for reaching this training goal. Diamond days award more points toward weekly progress, allowing standard and premium rewards to be achieved more easily. Points from all tiers contribute to an arbitrary leveling system in development to enhance long-term motivation and progression.
- **Achievements Page Overhaul** (in progress): Removed the expended energy category from the achievements page to include other more interesting statistics — including happy jump gains records and Diamond Day tracking, providing better insight into training patterns and special achievements.
- **Feature Guide** (in progress): Added a new feature guide offering transparency and support for the many features this script provides, making the extensive functionality more accessible to new and existing users.
- **Full Training Item Tracking**: Stat enhancers, energy items, and happy items used during training are now fully tracked in your logs, providing deeper insights and more training metrics.
- **Dynamic Item Counter**: View your daily, weekly, monthly, and yearly item usage in real-time with a context-aware counter that dynamically displays relevant items when appropriate.

### Bug Fixes:
- **Graph Tooltip Month Label (Monthly View)**: Fixed a bug where hovering over the monthly graph after navigating the calendar grid to a different month would display the grid's current month in the tooltip instead of the month the graph data belongs to. The tooltip now reads the month and year from values frozen at draw time (`selectedMonth`/`selectedYear` on the `dat` object returned by `_transformData`) rather than from the live `calendarState.month`/`calendarState.year`, which change whenever the user navigates the grid. This also covers the latent cross-year variant of the same bug.
- **Gold Week Sticker Award**: Fixed an issue where some gold weeks were not properly awarding 2 stickers instead of 1.
- **Sidebar Notification State**: Fixed an issue where the sidebar icon for the Gym Log would sometimes light up green when other pages received notifications, causing false positives.
- **TornPDA Update Flag**: Fixed an issue that prevented the update notification flag from appearing immediately after updating and refreshing on TornPDA.

### Improvements:
- **Performance Optimization**: The script has been comprehensively refactored to optimize performance across multiple open tabs and lower the resources consumed while the gym log panel isn't actively opened.
- **Dedicated Page Mode URL**: Page mode now navigates to a dedicated calendar URL (`calendar.php#gymlog`) rather than appending a hash to the current page. This prevents other scripts from throwing console errors when the DOM is manipulated, providing a cleaner and more stable environment.
- **Weekly Progress Bar Overhaul**: Completely overhauled the weekly progress bar system visually and functionally. The system now translates training into "points" (200 green / 300 gold / 500 diamond per day) for the future leveling system, making room for new diamond-tier bar segments. Gold and green fills are now anchored left and right for clearer visual hierarchy.
- **RPG Leveling Foundation & Balancing**: Reworked the weekly points system to establish the foundation for a training-integrated RPG leveling system. Points gained from happy jumping and daily goals have been re-evaluated and delicately balanced to foster a graceful progression scale that motivates and rewards consistent training efforts.
- **Achievements Copy/Paste Output**: Reworked the copy/paste output on the achievements page for both individual stats and full category copies. Category headers are now spaced and framed with em-dashes, multi-line stats are separated by blank lines while single-line stats stay grouped, and row labels are aligned with the on-screen UI for cleaner sharing on Discord and forums.
- **Expanded Date Tracking on Achievements**: Added date tracking to more achievements — the Best Training Streak, Best Green Streak, and Best Gold Streak rows now display their date ranges under the stat in expanded panel and page mode, matching the date styling used elsewhere on the achievements page.
- **Tap-and-Hold Parity with Desktop Hover**: Extended the mobile tap-and-hold interaction to fully imitate desktop "hover" behavior across the script, so tooltips, scrubbing, and other hover-driven affordances behave identically on touch devices — no functionality is lost between the two platforms.
- **Settings Configuration Reorganization**: Regrouped the settings menu into clearer, purpose-named sections — Big Black Features, Log Format, API Access, Data Management, and Information — for quicker navigation. Made the DEMO MODE button dynamic to function as an EXIT DEMO button while demo mode is active, enhancing navigation clarity and reducing user confusion.
- **Sidebar Branding Update**: Changed the SVG icon for the Gym Log from a flexing arm to a Crown, improving visual branding consistency across the application.
- **Happy Item Achievements & Insights**: Updated the achievements page to track happy item usage and added a summary of total happy gained from each item on the Happy Hopping page.
- **Expanded Copy-to-Clipboard**: Enhanced ledger copy functionality to allow copying a single stat by clicking or tapping its label. Expanded this feature to the Greatest Gains page, allowing individual stat columns to be copied to the clipboard for more dynamic stat sharing and recording.
- **General UI Refinements**: Various minor improvements across the interface for enhanced usability and visual polish.

--------------------------------------------------

Version 0.9.50 - 2026-05-13
### New Features:
- **Achievements Dashboard**: Introduced a dedicated achievements page that tracks and visualizes long-term training milestones and statistics for higher training satisfaction. It monitors record-breaking gains (per-click, daily, weekly, and monthly), total energy expenditure, and consistency streaks (active days, green goals, and gold goals). The dashboard also provides a summary of 'Rewards Reaped,' including total happy jumps and stickers unlocked, all displayed in a premium, tabular-aligned numeric interface.

### Bug Fixes:
- **Sidebar button and Notes/People/Settings panel interaction**: Repaired the sidebar Gym Log button and future-proofed both its injection and the panel/chat shove logic by anchoring everything to stable native identifiers (`#nav-gym`, `#chatRoot`, `#notes_panel_button`, `#people_panel_button`, `#notes_settings_button`, and the `channel_panel_button:CHANNEL-ID` pattern) instead of Torn's brittle, frequently rotating CSS class name hashes. The sidebar button now reads live container/row/link/icon classes from existing sibling nav elements at injection time, so styling stays in sync with whatever Torn currently uses. The shove math was reworked so the BBGL panel coexists cleanly with native Notes, People, and Settings panels: each chat panel is individually shifted via its `right` position (composes with Torn's own per-panel transform) while native panels stay in their Torn-managed slots, eliminating the overlap, off-slot stacking, and disappearance bugs that the previous parent-transform approach caused. Active-state class handling was also generalized so navigating away from the gym log correctly clears the active highlight on every nav item, not just the container.
- **Graph layout and scaling**: Fixed unstable graph rendering when opening the graph view—including the plot shifting right with a false left gutter, extreme text scaling, blank charts, and x-axis labels falling off-screen. Sizing now uses layout dimensions (`clientWidth` / `clientHeight`) so the SVG `viewBox` stays correct while the CRT-style open animation runs (bounding-rect reads were picking up transform scale and corrupting measurements). Y-axis margin is guarded against occasional inflated `getBBox()` results from font or layout timing by capping against a deterministic label-width estimate, so the inner plot stays aligned reliably across opens.

### Improvements:
- **Happy Jump Weekly Progress**: Users who train in short high-energy bursts ("happy jumpers") can now complete and gold their weekly bar without needing 5 standard training days. The happy jump detection window has been extended to 10 minutes (from 5). A happy jump day now fills 50% of the weekly bar instead of 20%—meaning 2 happy jumps in a week completes the bar and unlocks a sticker. If a happy jump day also reaches the 1500E gold threshold, its bar segment turns gold. A week with 3 or more happy jumps (green or gold) is automatically treated as a gold week, unlocking 2 stickers—while individual day cells remain their earned color. Detection is real-time and updates the bar live as training is logged.
- **Fluid responsive layout**: Reworked styling across the entire injected UI away from a hard split between "mobile" and "desktop" rules toward a fluid scaling system (container queries, shared custom properties, and clamp-based spacing and typography). Page mode, docked/expanded panel, ledger, graph, achievements, stickers, and shared chrome now scale on a continuum so layout stays consistent across viewport sizes and devices, with fewer brittle `@media` overrides and a leaner, easier-to-maintain stylesheet.
- **Early injection for navigation controls**: Changed how the Gym Log sidebar button and footer tab are mounted so they are inserted as soon as the userscript runs, before the host page finishes painting. That removes the visible "pop-in" where controls appeared a beat late and looked glitchy or unfinished.
- **Footer tab icon alignment**: Centered the Gym Log SVG in the notes footer tab by clearing the header logo’s right margin when that markup is reused in the tab (flex centering had been offset by the extra margin).
- **Overall script efficiency**: Reduced redundant work in hot paths (rendering, panel updates, and graph redraws) and tightened DOM/CSS patterns so the script's footprint on the page stays negligible in normal use—no perceptible slowdown while browsing Torn.
- **Developer Console Polish**: Added a branded `BBGL` console badge, a read-only `window.BBGL` debug surface (`BBGL.help()`, `BBGL.state()`, `BBGL.config()` with API-key redaction, etc.) for cleaner bug reports, User Timing performance marks visible in DevTools when dev mode is on.
- **Graph UI / y-axis range**: Further improved the graph UI by allowing tighter y-axis value ranges so the plotted lines use more vertical resolution and read as steeper slopes, addressing feedback from Wulfie.

--------------------------------------------------

Version 0.9.21 - 2026-05-05

### New Features:
- **Graph Projection Overhaul**: Re-engineered the graphing engine from a point-based coordinate model to a sectional, day-bucketed rendering system to more clearly display the start and end of buckets in each view. This includes a dynamic "All-Time" view that automatically cycles through tiers to show the entire history—from the log's origin to the current point—remaining visible and legible for up to 16 years of data.


### Bug Fixes:
- **High-Frequency Train Logging**: Fixed an error where clicking the train button multiple times within a single second caused only one entry to be recognized. The unique key now includes the "after" stat value to ensure rapid clicks are recorded distinctly (discovered by Svegarn).

### Improvements:
- **Prettier Session Sharing**: Redesigned the "Copy Session Data" output for a cleaner, vertical layout optimized for sharing on Discord and forums. Includes a new Crown header, categorized stat lines with emojis, and a dedicated status message for no-energy days.
- **Storage Optimization (Thin Cache)**: Redesigned the `sessionStorage` architecture to use a lightweight "thin cache" that strips out heavy `series` arrays. This significantly reduces the storage footprint and mitigates `QuotaExceededError` risks.
- **Redundant Data Removal**: Removed static `rate` fields from stored log entries in favor of dynamic on-the-fly calculations, further shrinking the overall database footprint.
- **Data Persistence Reliability**: Hardened the IndexedDB read guards to ensure log history is always reconciled against the database, preventing "blank calendar" rendering issues on page refresh.
- **Enhanced Rate Continuity**: Applied the mathematical bridging logic from the daily ledger to all period views (Week, Month, Year). Starting rates now anchor to the previous period's final value, ensuring seamless continuity across all time scales.
- **Optimized Log Export**: Refined the export log structure to significantly reduce file size while improving human legibility. Features include a semi-minified entry layout, day-bucketing, and clear timezone-aware sub-headers.
- **Toolbar Visibility Enhancement**: Improved view-toggle button visibility across all backgrounds, specifically addressing feedback from Svegarn regarding the bright Stickerbook page. Icons now use a persistent white color with smart opacity for inactive states and a dynamic scale-and-glow effect to clearly indicate the active view.


--------

Version 0.9.10 - 2026-04-25

### New Features:
- **Changelog System**: Implemented a one-time pop-up modal and sidebar notification system to alert users of script updates and new features.
- **Sponsorship Sticker Page**: Added a new "Sponsorship" page to the left of the existing sticker book. Accessible via a custom Gold and Shiny navigation arrow, the page features large jagged-edge slots for future faction sponsorships.

### Bug Fixes:
- **Ledger Rate Discrepancy**: Fixed issue where starting rates for a new day did not match the ending rates of the previous day. Switched to last-entry point rates for display to ensure mathematical continuity.
- **Image Asset Migration**: Hosted all image assets on a new platform to resolve rendering and access issues for users in specific regions (UK/International), including DonCorleone and ApexJP.
- **Expanded Panel UI**: Repaired the SVG for the expanded panel view toggle; the arrow inversion and compaction icons are now correctly visible and functional.
- **Critical Data Merge**: Fixed a critical bug that caused errors or data corruption when merging an old log export with a new one if a gap existed in the log history.

### Improvements:
- **UI/UX Layout Refinement**: Tweaked various UI elements to provide a cleaner, more professional layout across both mobile and desktop viewports.
- **Demo Mode Clarity**: Enhanced the "Exit Demo Mode" interface with clearer instructions and visual cues to ensure users can easily return to their real data (as per Svegarn's recommendation).
- **Page Mode Intelligence**: Added a context-aware tooltip to the log footer icon that indicates the panel version is disabled while viewing the log in full-page mode (as per Svegarn's recommendation).
- **Mobile Tooltip Scrubbing**: Re-engineered calendar tooltips for mobile devices. Users can now tap-and-hold a specific day to view battlestat snapshots and "scrub" (slide finger) to view other days. This mimics desktop hover functionality without obstructing the view (as per LatinoBull's recommendation).
- **Data Integrity Guardrails**: Hardened the import and export functions with robust IndexedDB connection handling. Added automatic database re-initialization, proactive integrity checks to prevent silent data loss, and clearer, actionable error messages to guide users through storage issues.
- **Enhanced Error Messaging**: Updated error codes to provide more clarity to users during malfunction. (Recognized the necessity due to Wulfie being a Boomer)

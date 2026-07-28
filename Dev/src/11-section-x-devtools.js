
/**
 *  [SECTION X] DEV TOOLS
 *  ========================================================================
 *  Everything in this file is dev-only. release-build.ps1 (via build-root.js's
 *  DEVTOOLS_FILES set) drops this entire file when producing BigBlackGymLog.js —
 *  it only ever ships in the dev build. The single point of contact with
 *  production code is the guarded `initDevTools()` call in init() (10-section-ix-init.js).
 */
(function() {
    const btnStyle = 'background:#444;color:#fff;border:1px solid #666;padding:6px 12px;border-radius:4px;cursor:pointer;font-family:sans-serif;font-size:12px;';
    const inputStyle = 'width:56px;background:#333;color:#fff;border:1px solid #666;border-radius:4px;padding:5px 6px;font-family:sans-serif;font-size:12px;';

    let widgetEl = null;
    let toggleBtn = null;

    function setDevMode(on) {
        runtime.devMode = !!on;
        sessionStorage.setItem(KEYS.DEV_MODE, String(runtime.devMode));
        renderDevToggleUI();
        Log.info(`Developer mode ${runtime.devMode ? 'ENABLED' : 'DISABLED'}`);
    }

    function renderDevToggleUI() {
        if (widgetEl) widgetEl.style.display = runtime.devMode ? 'flex' : 'none';
        if (toggleBtn) toggleBtn.style.background = runtime.devMode ? '#6a1b9a' : '#444';
    }

    function buildDevSection(title, children) {
        const section = document.createElement('div');
        section.style.cssText = 'display:flex;flex-direction:column;gap:6px;border-top:1px solid #444;padding-top:8px;';
        const label = document.createElement('div');
        label.textContent = title;
        label.style.cssText = 'color:#999;font-family:sans-serif;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;';
        section.appendChild(label);
        children.forEach(c => section.appendChild(c));
        return section;
    }

    function buildDevButton(text, onClick, extraStyle) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.style.cssText = btnStyle + (extraStyle || '');
        btn.onclick = onClick;
        return btn;
    }

    // ─── API Counter section ───────────────────────────────────────────────
    function buildApiCounterSection() {
        const hud = document.createElement('div');
        hud.id = 'bbgl-api-hud';
        hud.style.cssText = 'color:#fff;font-family:sans-serif;font-size:12px;text-align:center;';
        hud.innerHTML = `API Calls: ${runtime.apiCallTotal}`;
        return buildDevSection('API', [hud]);
    }

    // ─── Triggers section (XP/level testing) ───────────────────────────────
    function buildTriggersSection() {
        const trainRow = document.createElement('div');
        trainRow.style.cssText = 'display:flex;gap:6px;';
        const trainInput = document.createElement('input');
        trainInput.type = 'number';
        trainInput.min = '10';
        trainInput.max = '1500';
        trainInput.step = '10';
        trainInput.value = '150';
        trainInput.style.cssText = inputStyle;
        const trainBtn = buildDevButton('Train (E)', () => {
            let e = parseInt(trainInput.value, 10);
            if (!Number.isFinite(e)) e = 150;
            e = Math.min(1500, Math.max(10, Math.round(e / 10) * 10));
            trainInput.value = e;
            const { hjDaySet } = DataController.getHappyJumpData();
            const isHJ = hjDaySet.has(Formatter.dateLogical());
            const gain = computeDailyLevelExp(e, true, isHJ);
            runtime.careerLevelExp = (runtime.careerLevelExp || 0) + gain;
            window.dispatchEvent(new CustomEvent('bbgl:dataUpdated'));
        }, 'flex:1;');
        trainRow.appendChild(trainInput);
        trainRow.appendChild(trainBtn);

        const dayTierRow = document.createElement('div');
        dayTierRow.style.cssText = 'display:flex;gap:4px;';
        [
            ['Happy Jump', () => computeDailyLevelExp(1000, true, true)],
            ['Green Day', () => computeDailyLevelExp(1000, true, false)],
            ['Gold Day', () => computeDailyLevelExp(1500, true, false)],
            ['Diamond Day', () => computeDailyLevelExp(2000, true, false)]
        ].forEach(([label, computeGain]) => {
            dayTierRow.appendChild(buildDevButton(label, () => {
                runtime.careerLevelExp = (runtime.careerLevelExp || 0) + computeGain();
                window.dispatchEvent(new CustomEvent('bbgl:dataUpdated'));
            }, 'flex:1;padding:6px 4px;font-size:11px;'));
        });

        const lvlUpBtn = buildDevButton('Level Up', () => {
            const cur = typeof getLiveLevelExp === 'function' ? getLiveLevelExp() : runtime.careerLevelExp || 0;
            const prog = typeof calculateLevelProgress === 'function' ? calculateLevelProgress(cur) : { expToNext: 500, expInLevel: 0 };
            const needed = Math.max(1, prog.expToNext - prog.expInLevel);
            runtime.careerLevelExp = (runtime.careerLevelExp || 0) + needed;
            window.dispatchEvent(new CustomEvent('bbgl:dataUpdated'));
        });

        // Complete Atrophy: fills whichever atrophy tier the bar is CURRENTLY SHOWING to
        // Level 100 / max exp for that tier. getLiveLevelExp() (what the bar displays) =
        // runtime.careerLevelExp + today's real synced-log exp. That real leftover doesn't
        // go away just because we rewrite careerLevelExp, so net it out here so the
        // DISPLAYED total lands exactly at Level 100, not just the artificial half.
        const atroBtn = buildDevButton('Complete Atrophy', () => {
            const displayed = typeof getLiveLevelExp === 'function' ? getLiveLevelExp() : (runtime.careerLevelExp || 0);
            const todayReal = displayed - (runtime.careerLevelExp || 0);
            const { atrophy } = calculateLevelProgress(displayed);
            let base = 0;
            for (let a = 0; a < atrophy; a++) base += LEVEL_ATRO_BUDGETS[a];
            const target = base + LEVEL_ATRO_BUDGETS[atrophy];
            runtime.careerLevelExp = Math.max(0, target - todayReal);
            // Snap instantly instead of running the per-level-up animation queue — that's
            // built for one level at a time and crawls through ~90 levels on a full jump.
            const newTotal = typeof getLiveLevelExp === 'function' ? getLiveLevelExp() : runtime.careerLevelExp;
            runtime._lastLevelExp = newTotal;
            if (typeof getLevelBars === 'function' && typeof renderLevelBar === 'function') {
                getLevelBars().forEach(b => renderLevelBar(b, newTotal));
            }
            window.dispatchEvent(new CustomEvent('bbgl:dataUpdated'));
        });

        return buildDevSection('Triggers', [trainRow, dayTierRow, lvlUpBtn, atroBtn]);
    }

    // ─── Rank Preview section (atrophy/level-band testing) ─────────────────
    // Overrides just the atrophyTitle() text lookup in renderLevelBar() (07-section-vi-ui.js) so
    // every atrophy/level-band combination can be previewed without real EXP. Gated behind
    // runtime.devMode at the read site, and this whole file is stripped from release builds.
    function buildRankPreviewSection() {
        const rowStyle = 'display:flex;gap:6px;';
        const selectStyle = 'flex:1;background:#333;color:#fff;border:1px solid #666;border-radius:4px;padding:5px 6px;font-family:sans-serif;font-size:12px;';

        const atrophySelect = document.createElement('select');
        atrophySelect.style.cssText = selectStyle;
        [0, 1, 2].forEach(a => {
            const opt = document.createElement('option');
            opt.value = String(a);
            opt.textContent = `Atrophy ${a}`;
            atrophySelect.appendChild(opt);
        });

        const levelInput = document.createElement('input');
        levelInput.type = 'number';
        levelInput.min = '-10';
        levelInput.max = '100';
        levelInput.step = '1';
        levelInput.value = '0';
        levelInput.style.cssText = inputStyle;

        function applyOverride() {
            let lvl = parseInt(levelInput.value, 10);
            if (!Number.isFinite(lvl)) lvl = 0;
            lvl = Math.min(100, Math.max(-10, lvl));
            levelInput.value = lvl;
            runtime._devRankOverride = { atrophy: parseInt(atrophySelect.value, 10), level: lvl };
            const total = typeof getLiveLevelExp === 'function' ? getLiveLevelExp() : 0;
            if (typeof getLevelBars === 'function' && typeof renderLevelBar === 'function') {
                getLevelBars().forEach(b => renderLevelBar(b, total));
            }
        }
        atrophySelect.addEventListener('change', applyOverride);
        levelInput.addEventListener('change', applyOverride);

        const row = document.createElement('div');
        row.style.cssText = rowStyle;
        row.appendChild(atrophySelect);
        row.appendChild(levelInput);

        const clearBtn = buildDevButton('Clear Override', () => {
            runtime._devRankOverride = null;
            const total = typeof getLiveLevelExp === 'function' ? getLiveLevelExp() : 0;
            if (typeof getLevelBars === 'function' && typeof renderLevelBar === 'function') {
                getLevelBars().forEach(b => renderLevelBar(b, total));
            }
        });

        return buildDevSection('Rank Preview', [row, clearBtn]);
    }

    // ─── Title Preview section (stat-title slot testing) ───────────────────
    // Overrides getLiveStatTitleSelection() (07-section-vi-ui.js) so any stat/phase can be dropped
    // into either slot without the E spend that would really unlock it. Each slot picks its own
    // phase now, matching the real system — that's the only way to preview a mismatched pair like
    // a Phase 1 adjective on a Phase 10 noun. Gated behind runtime.devMode at the read site, and
    // this whole file is stripped from release builds, so this can never affect a real user.
    function buildTitlePreviewSection() {
        const rowStyle = 'display:flex;gap:6px;';
        const selectStyle = 'flex:1;background:#333;color:#fff;border:1px solid #666;border-radius:4px;padding:5px 6px;font-family:sans-serif;font-size:12px;';

        function buildSelect(options) {
            const sel = document.createElement('select');
            sel.style.cssText = selectStyle;
            options.forEach(([value, label]) => {
                const opt = document.createElement('option');
                opt.value = value;
                opt.textContent = label;
                sel.appendChild(opt);
            });
            return sel;
        }

        const phaseOptions = STAT_TITLE_THRESHOLDS.map((_, i) => [String(i), `Phase ${i}`]);
        const primarySelect = buildSelect(STAT_KEYS.map(k => [k, achStatFull(k)]));
        const primaryPhase = buildSelect(phaseOptions);
        const secondarySelect = buildSelect(STAT_KEYS.map(k => [k, achStatFull(k)]));
        const secondaryPhase = buildSelect(phaseOptions);
        secondarySelect.selectedIndex = 1; // default to a stat different from primary

        function refreshTitleUI() {
            if (typeof refreshStatTitleUI === 'function') refreshStatTitleUI();
        }

        function applyOverride() {
            runtime._devTitleOverride = {
                primary: { stat: primarySelect.value, phase: parseInt(primaryPhase.value, 10) },
                secondary: { stat: secondarySelect.value, phase: parseInt(secondaryPhase.value, 10) }
            };
            refreshTitleUI();
        }
        [primarySelect, primaryPhase, secondarySelect, secondaryPhase].forEach(sel => sel.addEventListener('change', applyOverride));

        // One row per slot: which stat, and which phase of that stat's ladder.
        const primaryRow = document.createElement('div');
        primaryRow.style.cssText = rowStyle;
        primaryRow.appendChild(primarySelect);
        primaryRow.appendChild(primaryPhase);

        const secondaryRow = document.createElement('div');
        secondaryRow.style.cssText = rowStyle;
        secondaryRow.appendChild(secondarySelect);
        secondaryRow.appendChild(secondaryPhase);

        const clearBtn = buildDevButton('Clear Override', () => {
            runtime._devTitleOverride = null;
            refreshTitleUI();
        });

        return buildDevSection('Title Preview', [primaryRow, secondaryRow, clearBtn]);
    }

    // ─── Onboarding section ─────────────────────────────────────────────────
    function buildOnboardingSection() {
        const togglePrivacyBtn = buildDevButton('Toggle Onboarding Mode', () => {
            const isTestMode = sessionStorage.getItem('bbgl_dev_onboarding') === '1';
            if (!isTestMode) {
                sessionStorage.setItem('bbgl_dev_onboarding', '1');
                userConfig.privacyAgreed = '';
                localStorage.removeItem('bbgl_initialized');
                Log.info('Onboarding Test Mode ENABLED. Reloading...');
            } else {
                sessionStorage.removeItem('bbgl_dev_onboarding');
                userConfig.privacyAgreed = new Date().toISOString();
                localStorage.setItem('bbgl_initialized', '1');
                Log.info('Onboarding Test Mode DISABLED. Reloading...');
            }
            if (typeof saveConfig === 'function') saveConfig();
            window.location.reload();
        }, 'background:#1a5a5a;border-color:#388;');
        return buildDevSection('Onboarding', [togglePrivacyBtn]);
    }

    // ─── Sidebar section ────────────────────────────────────────────────────
    function buildSidebarSection() {
        const notifBtn = buildDevButton('Toggle Sidebar Notif', () => {
            const ids = [SB_DESKTOP.id, SB_MOBILE.id, SB_FLYOUT.id];
            const anyActive = ids.some(id => {
                const el = document.getElementById(id);
                return el && el.classList.contains('bbgl-sb-notif');
            });
            syncChangelogNotif(!anyActive);
        });
        return buildDevSection('Sidebar', [notifBtn]);
    }

    // ─── Reset section ──────────────────────────────────────────────────────
    function buildResetSection() {
        const factoryResetBtn = buildDevButton('DEV: FACTORY RESET', () => {
            devFactoryReset();
        }, 'background:#5a1a1a;border-color:#833;');
        return buildDevSection('Reset', [factoryResetBtn]);
    }

    async function devFactoryReset() {
        if (confirm("⚠️ DEV FACTORY RESET ⚠️\n\nThis will completely wipe ALL data, settings, API keys, and cache. The script will emulate a completely fresh install.\n\nProceed?")) {
            await DBManager.clearStorage();
            localStorage.clear();
            const devMode = sessionStorage.getItem(KEYS.DEV_MODE);
            sessionStorage.clear();
            if (devMode) sessionStorage.setItem(KEYS.DEV_MODE, devMode);
            window.location.reload();
        }
    }

    // ─── Console overlay ────────────────────────────────────────────────────
    const _bbglRedactConfig = () => {
        const c = { ...userConfig };
        if (c.apiKey) c.apiKey = c.apiKey.length >= 4 ? '***' + c.apiKey.slice(-4) : '***';
        return c;
    };

    function getBBGLState() {
        return {
            view: { ...viewState },
            calendar: { ...calendarState },
            runtime: {
                devMode: runtime.devMode,
                demoMode: runtime.demoMode,
                isSyncing: runtime.isSyncing,
                apiCallTotal: runtime.apiCallTotal,
                domObsArmed: runtime._domObsArmed === true
            }
        };
    }
    function getBBGLConfig() {
        return _bbglRedactConfig();
    }
    function getBBGLHistory() {
        const h = getActiveHistory();
        return h ? {
            meta: h.meta,
            today: h.today,
            historyCount: (h.history || []).length,
            firstDate: (h.history && h.history[0]) ? h.history[0].date : null,
            lastDate: (h.history && h.history.length) ? h.history[h.history.length - 1].date : null
        } : null;
    }
    function getBBGLCachePeek() {
        return {
            timeline: !!DataController._cache.timeline,
            slices: Object.keys(DataController._cache.slices || {}).length,
            dateMap: !!DataController._cache.dateMap,
            rateArr: !!DataController._cache.rateArr,
            stickerMap: !!DataController._cache.stickerMap,
            unlockedCount: DataController._cache.unlockedCount
        };
    }

    const BBGL_COMMANDS = [
        { label: 'State', command: 'BBGL.state()', description: 'View / calendar / runtime snapshot', run: getBBGLState },
        { label: 'Config', command: 'BBGL.config()', description: 'User config (API key redacted)', run: getBBGLConfig },
        { label: 'History', command: 'BBGL.history()', description: 'Active history meta + count + date range', run: getBBGLHistory },
        { label: 'Cache Peek', command: 'BBGL.cache.peek()', description: 'Which derived caches are populated', run: getBBGLCachePeek },
        { label: 'Help', command: 'BBGL.help()', description: 'This table', run: () => BBGL_COMMANDS.map(({ command, description }) => ({ command, description })) }
    ];

    window.BBGL = Object.freeze({
        version: SCRIPT_VERSION,
        state: getBBGLState,
        config: getBBGLConfig,
        history: getBBGLHistory,
        cache: Object.freeze({ peek: getBBGLCachePeek }),
        help: () => {
            console.table(BBGL_COMMANDS.map(({ command, description }) => ({ command, description }))
                .concat([{ command: 'devmode("on"|"off")', description: 'Toggle dev mode (enables Perf marks + dev UI)' }]));
        }
    });

    window.devmode = (val) => setDevMode(val === 'on' || val === true);

    let consoleOverlay = null;
    let consoleOutput = null;

    function buildConsoleOverlay() {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:100px;left:220px;background:#1a1a1a;border:1px solid #555;padding:10px;z-index:999999;border-radius:6px;display:none;flex-direction:column;gap:8px;box-shadow:0 4px 12px rgba(0,0,0,0.5);width:280px;';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = 'position:absolute;top:4px;right:4px;background:transparent;color:#aaa;border:none;cursor:pointer;font-size:12px;line-height:1;padding:2px 4px;';
        closeBtn.onclick = () => { overlay.style.display = 'none'; };
        overlay.appendChild(closeBtn);

        const title = document.createElement('div');
        title.textContent = 'BBGL Console';
        title.style.cssText = 'color:#fff;font-family:sans-serif;font-size:12px;font-weight:bold;text-align:center;margin-bottom:4px;';
        overlay.appendChild(title);

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;';
        BBGL_COMMANDS.forEach(cmd => {
            btnRow.appendChild(buildDevButton(cmd.label, () => {
                let result;
                try {
                    result = cmd.run();
                } catch (e) {
                    result = { error: String(e) };
                }
                consoleOutput.textContent = JSON.stringify(result, null, 2);
            }, 'flex:1 1 auto;font-size:11px;padding:6px 4px;'));
        });
        overlay.appendChild(btnRow);

        consoleOutput = document.createElement('pre');
        consoleOutput.style.cssText = 'color:#0f0;background:#000;border:1px solid #444;border-radius:4px;padding:6px;font-family:monospace;font-size:11px;max-height:240px;overflow:auto;margin:0;white-space:pre-wrap;word-break:break-all;';
        consoleOutput.textContent = '(click a command)';
        overlay.appendChild(consoleOutput);

        document.body.appendChild(overlay);
        return overlay;
    }

    // ─── Widget assembly ────────────────────────────────────────────────────
    function buildWidget() {
        const w = document.createElement('div');
        w.style.cssText = 'position:fixed;top:100px;left:20px;background:#222;border:1px solid #555;padding:10px;z-index:999999;border-radius:6px;display:none;flex-direction:column;gap:8px;box-shadow:0 4px 12px rgba(0,0,0,0.5);width:180px;';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.title = 'Turn off dev mode';
        closeBtn.style.cssText = 'position:absolute;top:4px;right:4px;background:transparent;color:#aaa;border:none;cursor:pointer;font-size:12px;line-height:1;padding:2px 4px;';
        closeBtn.onclick = () => setDevMode(false);
        w.appendChild(closeBtn);

        const title = document.createElement('div');
        title.textContent = 'BBGL Dev';
        title.style.cssText = 'color:#fff;font-family:sans-serif;font-size:12px;font-weight:bold;text-align:center;margin-bottom:2px;';
        w.appendChild(title);

        w.appendChild(buildApiCounterSection());
        w.appendChild(buildTriggersSection());
        w.appendChild(buildRankPreviewSection());
        w.appendChild(buildTitlePreviewSection());
        w.appendChild(buildOnboardingSection());
        w.appendChild(buildSidebarSection());
        w.appendChild(buildResetSection());

        consoleOverlay = buildConsoleOverlay();
        const consoleBtn = buildDevButton('Console', () => {
            consoleOverlay.style.display = consoleOverlay.style.display === 'none' ? 'flex' : 'none';
        }, 'margin-top:4px;');
        w.appendChild(consoleBtn);

        document.body.appendChild(w);
        return w;
    }

    function buildToggleButton() {
        const btn = document.createElement('button');
        btn.textContent = 'DEV';
        btn.title = 'Toggle BBGL dev mode';
        btn.style.cssText = 'position:fixed;top:8px;left:8px;background:#444;color:#fff;border:1px solid #666;padding:4px 8px;border-radius:4px;cursor:pointer;font-family:sans-serif;font-size:11px;font-weight:bold;z-index:999999;';
        btn.onclick = () => setDevMode(!runtime.devMode);
        document.body.appendChild(btn);
        return btn;
    }

    window.initDevTools = function initDevTools() {
        toggleBtn = buildToggleButton();
        widgetEl = buildWidget();
        renderDevToggleUI();
    };
})();

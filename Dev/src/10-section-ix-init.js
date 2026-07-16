    /**
     *  [SECTION IX] THE MOTIVATION (Init & Event Handling)
     *  ========================================================================
     *  A clean, pure, and sober reason to keep it all going.
     *  Like church, but without the Priest.
     */

    function handleGymClick(e) {
        const b = e.target.closest('button');
        if (!b) return;
        const l = b.getAttribute('aria-label');
        if (!l) return;
        let id = null;
        if (l === 'Train strength') id = 5300;
        else if (l === 'Train defense') id = 5301;
        else if (l === 'Train speed') id = 5302;
        else if (l === 'Train dexterity') id = 5303;
        if (id) {
            sessionStorage.setItem(KEYS.SESSION, 'true');
            if (!runtime.trainDebouncers) runtime.trainDebouncers = {};
            if (runtime.trainDebouncers[id]) clearTimeout(runtime.trainDebouncers[id]);
            runtime.trainDebouncers[id] = setTimeout(() => {
                universalFetch('TRAIN_SINGLE', {
                    specId: id
                });
                runtime.trainDebouncers[id] = null;
            }, 1000);
        }
    }

    function setBestGym(v) {
        userConfig.bestGym = v;
        saveConfig();
        const a = document.getElementById('set-bestgym-toggle');
        if (a) a.checked = v;
        const b = document.getElementById('bbgl-bestgym-input');
        if (b) b.checked = v;
        const sp = document.getElementById('set-bestgym-spec-toggle');
        if (sp) {
            const row = sp.closest('.bbgl-setting-row');
            if (row) row.classList.toggle('bbgl-row-disabled', !v);
        }
        const up = document.getElementById('set-bestgym-unpurch-toggle');
        if (up) {
            const row = up.closest('.bbgl-setting-row');
            if (row) row.classList.toggle('bbgl-row-disabled', !v);
        }
    }

    function updateCellSelection(newLabel) {
        const c = dom.calContainer;
        if (!c) return;
        c.querySelectorAll('.bbgl-day-cell.is-viewing').forEach(el => {
            el.classList.remove('is-viewing');
            if (!el.matches(':hover')) el.classList.remove('shimmer-active');
        });
        c.querySelectorAll('.bbgl-weekly-track.is-viewing').forEach(el => el.classList.remove('is-viewing'));
        if (!newLabel) {
            const today = document.getElementById('active-date-today');
            if (today) {
                today.classList.add('is-viewing');
                if (today._buildShine) today._buildShine();
            }
            return;
        }
        const dC = c.querySelector(`.bbgl-day-cell[data-date="${newLabel}"]`);
        if (dC) {
            dC.classList.add('is-viewing');
            if (userConfig.animations && !dC.classList.contains('shimmer-active')) dC.classList.add('shimmer-active');
            if (dC._buildShine) dC._buildShine();
            return;
        }
        const track = c.querySelector(`.bbgl-weekly-track[data-label="${newLabel}"]`);
        if (track) track.classList.add('is-viewing');
    }

    function openHistory(d, l) {
        if (runtime.isViewAnimating) {
            dom.ledgerView.classList.remove('bbgl-crt-out', 'bbgl-crt-in');
            runtime.isViewAnimating = false;
        }
        viewState.activeViewLabel = l;
        saveViewState();
        if (calendarState.selectedLabel === l && !dom.topPanel.classList.contains('viewing-graph')) return;
        runtime.isViewAnimating = true;
        calendarState.selectedData = d;
        calendarState.selectedLabel = l;
        const mBtn = document.getElementById('month-stats-btn');
        const yBtn = document.getElementById('year-stats-btn');
        const aBtn = document.getElementById('all-time-btn');
        if (mBtn) mBtn.classList.toggle('active', l === CONSTANTS.MONTHS[calendarState.month]);
        if (yBtn) yBtn.classList.toggle('active', l === String(calendarState.year));
        if (aBtn) aBtn.classList.toggle('active', l === 'All-Time');
        closeItemViewer();
        updateCellSelection(l);
        const tp = dom.topPanel;
        if (tp.classList.contains('viewing-stickers')) {
            switchView('ledger');
            setTimeout(() => {
                renderStats(d, l);
            }, 300);
            return;
        }
        if (tp.classList.contains('viewing-graph')) {
            GraphController.draw();
            const de = dom.dateLabel;
            if (de) de.innerText = Formatter.datePretty(l) || l;
            runtime.isViewAnimating = false;
        } else {
            if (viewState.achEnhPeriodMode && tp.classList.contains('viewing-achievements')) {
                achRefreshPageDom();
                runtime.isViewAnimating = false;
                return;
            }
            const el = dom.ledgerView;
            if (userConfig.animations) {
                el.classList.add('bbgl-crt-out');
                setTimeout(() => {
                    el.classList.remove('bbgl-crt-out');
                    renderStats(d, l);
                    el.classList.add('bbgl-crt-in');
                    setTimeout(() => {
                        el.classList.remove('bbgl-crt-in');
                        runtime.isViewAnimating = false;
                    }, 300);
                }, 280);
            } else {
                renderStats(d, l);
                runtime.isViewAnimating = false;
            }
        }
    }

    function closeHistory(e) {
        if (e) e.stopPropagation();
        if (!calendarState.selectedData) return;
        if (runtime.isViewAnimating) {
            dom.ledgerView.classList.remove('bbgl-crt-out', 'bbgl-crt-in');
            runtime.isViewAnimating = false;
        }
        viewState.activeViewLabel = null;
        saveViewState();
        runtime.isViewAnimating = true;
        calendarState.selectedData = null;
        calendarState.selectedLabel = null;
        updateCellSelection(null);
        const tp = dom.topPanel,
            ts = Formatter.dateLogical();
        if (tp.classList.contains('viewing-graph')) {
            GraphController.draw();
            const de = dom.dateLabel;
            if (de) de.innerText = Formatter.datePretty(ts) || ts;
            runtime.isViewAnimating = false;
        } else if (tp.classList.contains('viewing-stickers')) runtime.isViewAnimating = false;
        else {
            const el = dom.ledgerView;
            if (userConfig.animations) {
                el.classList.add('bbgl-crt-out');
                setTimeout(() => {
                    el.classList.remove('bbgl-crt-out');
                    renderStats(getActiveHistory().today, ts);
                    el.classList.add('bbgl-crt-in');
                    setTimeout(() => {
                        el.classList.remove('bbgl-crt-in');
                        runtime.isViewAnimating = false;
                    }, 300);
                }, 280);
            } else {
                renderStats(getActiveHistory().today, ts);
                runtime.isViewAnimating = false;
            }
        }
    }

    function changeMonth(d) {
        const c = dom.calContainer;
        if (!c) return;
        let m = calendarState.month + d,
            y = calendarState.year;
        if (m > 11) {
            m = 0;
            y++;
        }
        if (m < 0) {
            m = 11;
            y--;
        }
        if (!userConfig.animations) {
            calendarState.month = m;
            calendarState.year = y;
            viewState.calYear = y;
            viewState.calMonth = m;
            saveViewState();
            renderPanelContent();
            return;
        }
        c.parentElement.querySelectorAll('.bbgl-cal-ghost').forEach(g => g.remove());
        const ghost = c.cloneNode(true);
        ghost.className += ' bbgl-cal-ghost';
        ghost.style.animation = d > 0 ? 'bbgl-slide-out-l 0.3s ease forwards' : 'bbgl-slide-out-r 0.3s ease forwards';
        c.parentElement.appendChild(ghost);
        const removeGhost = () => {
            if (ghost.parentElement) ghost.remove();
        };
        ghost.addEventListener('animationend', removeGhost, {
            once: true
        });
        const ghostTimer = setTimeout(removeGhost, 400);
        ghost.addEventListener('animationend', () => clearTimeout(ghostTimer), {
            once: true
        });
        calendarState.month = m;
        calendarState.year = y;
        viewState.calYear = y;
        viewState.calMonth = m;
        saveViewState();
        c.style.willChange = 'transform';
        renderPanelContent();
        c.style.animation = d > 0 ? 'bbgl-slide-in-r 0.3s ease forwards' : 'bbgl-slide-in-l 0.3s ease forwards';
        c.addEventListener('animationend', () => {
            c.style.animation = '';
            c.style.willChange = 'auto';
        }, {
            once: true
        });
    }

    function changeStickerPage(d) {
        if (!userConfig.animations) {
            viewState.currentStickerPage += d;
            runtime.currentStickerPage = viewState.currentStickerPage;
            saveViewState();
            renderStickers();
            return;
        }
        const oldActive = (runtime.currentStickerPage === -1) ? document.getElementById('bbgl-sponsor-grid') : dom.stickerGrid,
            bg = dom.stickerGridBg;
        if (oldActive) {
            const ghost = oldActive.cloneNode(true);
            ghost.style.pointerEvents = 'none';
            ghost.style.position = 'absolute';
            ghost.style.top = '0';
            ghost.style.left = '0';
            ghost.style.width = '100%';
            ghost.style.animation = d > 0 ? 'bbgl-slide-out-l 0.3s ease forwards' : 'bbgl-slide-out-r 0.3s ease forwards';
            oldActive.parentElement.appendChild(ghost);
            const removeGhost = () => {
                if (ghost.parentElement) ghost.remove();
            };
            ghost.addEventListener('animationend', removeGhost, {
                once: true
            });
            const ghostTimer = setTimeout(removeGhost, 400);
            ghost.addEventListener('animationend', () => clearTimeout(ghostTimer), {
                once: true
            });
        }
        if (bg) {
            const bgGhost = bg.cloneNode(true);
            bgGhost.style.pointerEvents = 'none';
            bgGhost.style.position = 'absolute';
            bgGhost.style.top = '0';
            bgGhost.style.left = '0';
            bgGhost.style.width = '100%';
            bgGhost.style.animation = d > 0 ? 'bbgl-slide-out-l 0.3s ease forwards' : 'bbgl-slide-out-r 0.3s ease forwards';
            bg.parentElement.appendChild(bgGhost);
            const removeBgGhost = () => {
                if (bgGhost.parentElement) bgGhost.remove();
            };
            bgGhost.addEventListener('animationend', removeBgGhost, {
                once: true
            });
            const bgGhostTimer = setTimeout(removeBgGhost, 400);
            bgGhost.addEventListener('animationend', () => clearTimeout(bgGhostTimer), {
                once: true
            });
        }
        viewState.currentStickerPage += d;
        runtime.currentStickerPage = viewState.currentStickerPage;
        saveViewState();
        renderStickers();
        const newActive = (runtime.currentStickerPage === -1) ? document.getElementById('bbgl-sponsor-grid') : dom.stickerGrid;
        if (newActive) {
            newActive.style.animation = d > 0 ? 'bbgl-slide-in-r 0.3s ease forwards' : 'bbgl-slide-in-l 0.3s ease forwards';
            newActive.addEventListener('animationend', () => newActive.style.animation = '', {
                once: true
            });
        }
        if (bg) {
            bg.style.animation = d > 0 ? 'bbgl-slide-in-r 0.3s ease forwards' : 'bbgl-slide-in-l 0.3s ease forwards';
            bg.addEventListener('animationend', () => bg.style.animation = '', {
                once: true
            });
        }
    }

    function closeDropdown(d) {
        d.classList.remove('show');
        d.style.position = '';
        d.style.top = '';
        d.style.left = '';
        d.style.zIndex = '';
    }

    function openDropdown(d, trigger) {
        // #bbgl-panel sets container-type, and intermediate ancestors use
        // transform — any of these makes itself the containing block for a
        // position:fixed child, so viewport coords don't apply. Park the menu
        // at 0,0 to discover the containing block's origin, then offset the
        // trigger's viewport rect into that coordinate space.
        d.style.position = 'fixed';
        d.style.top = '0px';
        d.style.left = '0px';
        d.style.zIndex = '9999999';
        d.classList.add('show');
        const origin = d.getBoundingClientRect();
        const r = trigger.getBoundingClientRect();
        d.style.top = (r.bottom - origin.top + 2) + 'px';
        d.style.left = (r.left - origin.left) + 'px';
    }

    function toggleMonthDropdown() {
        const d = dom.monthDropdown;
        closeDropdown(dom.yearDropdown);
        d.innerHTML = '';
        CONSTANTS.MONTHS_SHORT.forEach((m, i) => {
            const x = document.createElement('div');
            x.className = `drop-item ${i === calendarState.month ? 'active' : ''}`;
            x.textContent = m;
            x.onclick = () => {
                calendarState.month = i;
                d.querySelectorAll('.drop-item').forEach(el => el.classList.remove('active'));
                x.classList.add('active');
                closeDropdown(d);
                renderPanelContent();
            };
            d.appendChild(x);
        });
        if (d.classList.contains('show')) closeDropdown(d);
        else openDropdown(d, dom.monthTrigger);
    }

    function toggleYearDropdown() {
        const d = dom.yearDropdown;
        closeDropdown(dom.monthDropdown);
        d.innerHTML = '';
        const s = getActiveHistory(),
            ys = new Set();
        s.history.forEach(z => ys.add(parseInt(z.date.split('-')[0])));
        if (s.today.date) ys.add(parseInt(s.today.date.split('-')[0]));
        Array.from(ys).sort().reverse().forEach(y => {
            const x = document.createElement('div');
            x.className = `drop-item ${y === calendarState.year ? 'active' : ''}`;
            x.textContent = y;
            x.onclick = () => {
                calendarState.year = y;
                d.querySelectorAll('.drop-item').forEach(el => el.classList.remove('active'));
                x.classList.add('active');
                closeDropdown(d);
                renderPanelContent();
            };
            d.appendChild(x);
        });
        if (d.classList.contains('show')) closeDropdown(d);
        else openDropdown(d, dom.yearTrigger);
    }

    function calcAllTimeStats() {
        const sl = DataController.getSlice('ALL', 'All-Time');
        openHistory(sl, 'All-Time');
    }

    function calcPeriodStats(t) {
        const lbl = (t === 'month') ? CONSTANTS.MONTHS[calendarState.month] : String(calendarState.year),
            m = (t === 'month') ? 'MONTH' : 'YEAR',
            sl = DataController.getSlice(m, lbl, calendarState.year);
        openHistory(sl, lbl);
    }

    function checkViewRouting() {
        const pm = window.location.hash.includes('gymlog');
        syncSidebarState();
        if (pm) {
            document.title = "Gym Log | TORN";
            document.body.classList.add('bbgl-page-mode-active');
            renderPageMode();
            if (localStorage.getItem(KEYS.CHANGELOG_NOTIF) === '1') {
                localStorage.setItem(KEYS.CHANGELOG_VER, SCRIPT_VERSION);
                localStorage.removeItem(KEYS.CHANGELOG_NOTIF);
                syncChangelogNotif(false);
                setTimeout(() => openChangelogModal(), 400);
            }
        } else {
            document.body.classList.remove('bbgl-page-mode-active');
            const cw = document.querySelector('.content-wrapper'),
                pc = document.getElementById('bbgl-page-container');
            if (cw && pc) pc.remove();
            if (viewState.isOpen) {
                const lp = dom.panel;
                if (lp && lp.classList.contains('bbgl-mode-page')) {
                    lp.remove();
                    dom.panel = null;
                }
                togglePanel(false);
            } else {
                viewState.subView = 'ledger';
                viewState.activeItemId = null;
                viewState.activeViewLabel = null;
                viewState.isTall = false;
                calendarState.selectedData = null;
                calendarState.selectedLabel = null;
            }
        }
        updateFooterTooltip();
    }

    function renderPageMode() {
        const H = `<div class="bbgl-native-header"><div class="bbgl-native-title"><span style="margin-left:8px;">Big Black Gym Log</span></div><div class="bbgl-native-links"><div id="bbgl-page-demo-exit" class="bbgl-native-link" style="display:${runtime.demoMode ? 'flex' : 'none'};"><span class="bbgl-demo-x-label">Demo</span>${ICONS.CLOSE}</div><div id="bbgl-page-settings" class="bbgl-native-link"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L3.16 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.58 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.08-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>Settings</div></div></div>`,
            cw = document.querySelector('.content-wrapper');
        if (!cw) return;
        window.scrollTo(0, 0);
        const pp = dom.panel;
        if (pp && !pp.classList.contains('bbgl-mode-page')) {
            pp.remove();
            dom.panel = null;
        }
        if (document.getElementById('bbgl-page-container')) return;
        cw.innerHTML = '';
        const pc = document.createElement('div');
        pc.id = 'bbgl-page-container';
        pc.innerHTML = H;
        const sb = pc.querySelector('#bbgl-page-settings');
        if (sb) sb.onclick = toggleSettingsView;
        const p = document.createElement('div');
        p.id = 'bbgl-panel';
        p.className = 'bbgl-mode-page';
        p.innerHTML = getDashboardHTML();
        pc.appendChild(p);
        cw.appendChild(pc);
        setupEventListeners(p);
        const pdeb = pc.querySelector('#bbgl-page-demo-exit');
        const demoBar = p.querySelector('#bbgl-demo-exit');
        if (pdeb && demoBar) pdeb.onclick = (e) => {
            e.stopPropagation();
            demoBar.onclick(e);
        };
        restoreInternalState();
        renderPanelContent();
        if (dom.topPanel.classList.contains('viewing-graph')) setTimeout(GraphController.draw, 100);
    }

    function togglePanel(click = false) {
        if (window.location.hash.includes('gymlog')) return;
        let p = document.getElementById('bbgl-panel');
        const b = dom.gymTab;
        if (click && p && p.style.display !== 'none') {
            closePanel();
            return;
        }
        if (!p) {
            p = document.createElement('div');
            p.id = 'bbgl-panel';
            if (viewState.expanded) p.classList.add('bbgl-expanded');
            else p.classList.add('bbgl-compact');
            if (viewState.isTall) p.classList.add('bbgl-tall');
            p.innerHTML = getDashboardHTML();
            document.body.appendChild(p);
            setupEventListeners(p);
        }
        if (p.style.display === 'none' || !p.style.display) {
            restoreInternalState();
            p.style.opacity = '0';
            p.style.display = 'flex';
            handleLayout();
            void p.offsetWidth;
            updateTransformOrigin();
            if (b) b.classList.add('bbgl-tab-active');
            p.classList.remove('bbgl-animate-vanish', 'bbgl-animate-pop');
            if (userConfig.animations) {
                void p.offsetWidth;
                p.classList.add('bbgl-animate-pop');
            }
            p.style.opacity = '';
            if (click) {
                viewState.isOpen = true;
                saveViewState();
            }
        } else if (click) closePanel();
    }

    function restoreInternalState() {
        const mp = dom.panel;
        if (viewState.calYear && viewState.calMonth !== undefined && viewState.calMonth !== null) {
            calendarState.year = viewState.calYear;
            calendarState.month = viewState.calMonth;
        }
        if (viewState.currentStickerPage !== undefined) runtime.currentStickerPage = viewState.currentStickerPage;
        GraphController.applyDefaultsIfNeeded();
        if (viewState.graphMode) graphState.mode = (viewState.graphMode === 'gains' ? 'values' : viewState.graphMode) || 'values';
        if (viewState.graphStats) graphState.activeStats = viewState.graphStats;
        GraphController.restoreUi();
        if (viewState.activeViewLabel) {
            const s = getActiveHistory();
            let td = null;
            if (/^\d{4}-\d{2}-\d{2}$/.test(viewState.activeViewLabel)) {
                td = s.history.find(d => d.date === viewState.activeViewLabel);
                if (!td && s.today.date === viewState.activeViewLabel) td = s.today;
                if (td) {
                    calendarState.selectedData = td;
                    calendarState.selectedLabel = viewState.activeViewLabel;
                    renderStats(td, viewState.activeViewLabel);
                }
            } else {
                const mn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                if (mn.includes(viewState.activeViewLabel)) calcPeriodStats('month');
                else if (/^\d{4}$/.test(viewState.activeViewLabel)) calcPeriodStats('year');
                else if (viewState.activeViewLabel === 'All-Time') calcAllTimeStats();
            }
        }
        renderPanelContent();
        const et = () => {
            if (mp && !mp.classList.contains('bbgl-mode-page') && !mp.classList.contains('bbgl-tall')) {
                mp.classList.add('bbgl-tall');
                const t = dom.tallToggle;
                if (t) t.innerText = "–";
                viewState.isTall = true;
                saveViewState();
            }
        };
        const _hasData = _historyCache && (_historyCache.history.length > 0 || (_historyCache.meta && _historyCache.meta.logStartDate));
        if (viewState.subView === 'settings') switchView('settings', true);
        else if (viewState.subView === 'welcome' || (!runtime.demoMode && !_hasData && !localStorage.getItem('bbgl_initialized'))) switchView('welcome', true);
        else if (viewState.subView === 'graph') {
            et();
            switchView('graph', true);
            setTimeout(() => window.requestAnimationFrame(() => GraphController.draw()), 350);
        } else if (viewState.subView === 'stickers') {
            et();
            if (!runtime.stickerData || runtime.stickerData.length === 0) loadStickerData();
            let ti = Number(viewState.activeItemId);
            if (!ti || ti < 1) {
                ti = 1;
                viewState.activeItemId = 1;
                saveViewState();
            }
            switchView('stickers', true);
            const i = runtime.stickerData.find(x => x.id === ti);
            if (i) {
                const bp = dom.bottomPanel;
                if (bp) bp.style.setProperty('display', 'none', 'important');
                setTimeout(() => openItemViewer(i, false), 50);
            }
        } else if (viewState.subView === 'achievements') {
            et();
            switchView('achievements', true);
        } else switchView('ledger', true);
    }

    function switchView(tgt, inst = false) {
        const tp = dom.topPanel,
            bp = dom.bottomPanel,
            sp = dom.settingsView,
            vp = dom.itemViewer,
            wv = dom.welcomeView;
        let cm = 'ledger';
        if (wv && wv.classList.contains('active-view')) cm = 'welcome';
        else if (sp.classList.contains('active-view')) cm = 'settings';
        else if (tp.classList.contains('viewing-graph')) cm = 'graph';
        else if (tp.classList.contains('viewing-stickers')) cm = 'stickers';
        else if (tp.classList.contains('viewing-achievements')) cm = 'achievements';
        if (cm === tgt && !inst) return;
        if (cm === 'stickers' && tgt !== 'stickers' && !inst) {
            runtime.currentStickerPage = 0;
            viewState.currentStickerPage = 0;
        }
        viewState.subView = tgt;
        saveViewState();
        runtime.currentOpenedItemId = null;
        if (runtime.viewerLoopId) {
            cancelAnimationFrame(runtime.viewerLoopId);
            runtime.viewerLoopId = null;
        }
        const gel = (m) => {
                if (m === 'settings') return sp;
                if (m === 'welcome') return wv;
                if (m === 'graph') return dom.graphContainer;
                if (m === 'stickers') return dom.stickerContainer;
                if (m === 'achievements') return dom.achievementsContainer;
                return dom.ledgerView;
            },
            cel = gel(cm),
            nel = gel(tgt);
        const app = () => {
            tp.classList.remove('viewing-graph', 'viewing-stickers', 'viewing-achievements');
            sp.classList.remove('active-view');
            if (wv) wv.classList.remove('active-view');
            tp.style.display = 'flex';
            if (!(tgt === 'stickers' && viewState.activeItemId)) {
                bp.style.removeProperty('display');
                if (getComputedStyle(bp).display === 'none') bp.style.display = 'flex';
                vp.classList.remove('active');
                vp.style.setProperty('display', 'none', 'important');
            }
            if (tgt === 'welcome') {
                if (wv) {
                    wv.innerHTML = getWelcomeHTML();
                    populateWelcomeContent(wv);
                    wv.classList.add('active-view');
                    const cwb = wv.querySelector('.close-settings-btn');
                    if (cwb) cwb.onclick = (e) => {
                        if (e) e.stopPropagation();
                        switchView('ledger');
                    };
                    const iak = wv.querySelector('#init-api-key');
                    if (iak) iak.value = userConfig.apiKey || '';
                    const iwp = wv.querySelector('#init-api-paste');
                    if (iwp && iak) iwp.onclick = async () => {
                        try {
                            const t = await navigator.clipboard.readText();
                            if (t) iak.value = t.trim();
                        } catch (e) {
                            alert("Clipboard access denied. Please paste manually.");
                        }
                    };
                    const ilocSel = wv.querySelector('#init-loc-select');
                    if (ilocSel) {
                        ilocSel.value = userConfig.buttonLocation;
                        ilocSel.onchange = () => onChangeLoc(ilocSel.value);
                    }
                    const idaySel = wv.querySelector('#init-day-start');
                    if (idaySel) {
                        idaySel.value = userConfig.dayStartMode;
                        idaySel.onchange = () => onChangeDayStart(idaySel.value);
                    }
                    const iweekSel = wv.querySelector('#init-week-start');
                    if (iweekSel) {
                        iweekSel.value = userConfig.weekStartMode;
                        iweekSel.onchange = () => onChangeWeekStart(iweekSel.value);
                    }
                    const ipb = wv.querySelector('#init-privacy-btn');
                    if (ipb) ipb.onclick = function() {
                        this.blur();
                        openPrivacyModal();
                    };
                    const isb = wv.querySelector('#init-start-btn');
                    if (isb && iak) isb.onclick = async function() {
                        this.blur();
                        const v = iak.value.trim();
                        if (!/^[a-zA-Z0-9]{16}$/.test(v)) {
                            alert("Invalid Format.\nA Torn API Key must be exactly 16 alphanumeric characters.");
                            return;
                        }
                        isb.style.color = '#69f0ae';
                        isb.innerText = 'VERIFYING...';
                        isb.disabled = true;
                        try {
                            const res = await fetch(`https://api.torn.com/user/?selections=battlestats,log&log=5300&key=${v}`),
                                data = await res.json();
                            if (data.error) {
                                alert(`Key Verification Failed: ${data.error.error}\n\nPlease generate a key properly configured with 'battlestats' and 'log' access.`);
                                isb.style.color = '';
                                isb.innerText = 'START TRACKING';
                                isb.disabled = false;
                                return;
                            }
                            userConfig.apiKey = v;
                            saveConfig();
                            localStorage.setItem('bbgl_initialized', '1');
                            refreshInitLock();
                            calendarState.selectedData = null;
                            calendarState.selectedLabel = Formatter.dateLogical();
                            viewState.activeViewLabel = null;
                            switchView('ledger');
                            syncWithFeedback('FULL_SYNC');
                            // Offer the fresh-vs-backfill choice over the (now empty) ledger.
                            // Dismissing the modal simply leaves them on the fresh log.
                            openBackfillChoiceModal();
                        } catch (e) {
                            alert("Network error during verification.");
                            isb.style.color = '';
                            isb.innerText = 'START TRACKING';
                            isb.disabled = false;
                        }
                    };
                    const cb = wv.querySelector('#init-create-api-btn');
                    if (cb) cb.onclick = function() {
                        this.blur();
                        window.open('https://www.torn.com/preferences.php#tab=api?step=addNewKey&user=battlestats,log&faction=rankedwars&logIds=54,50,52,23,80,6&title=BigBlackGymLog', '_blank');
                    };
                    const rib = wv.querySelector('#init-returning-import-btn'),
                        rif = wv.querySelector('#init-import-file');
                    if (rib && rif) rib.onclick = function() {
                        this.blur();
                        rif.click();
                    };
                    if (rif) rif.onchange = (e) => {
                        const f = e.target.files[0];
                        if (f) importDataFromWelcome(f);
                    };
                    refreshInitMask(wv);
                }
                tp.style.display = 'none';
                bp.style.display = 'none';
            } else if (tgt === 'settings') {
                sp.classList.add('active-view');
                tp.style.display = 'none';
                bp.style.display = 'none';
                const ki = document.getElementById('set-api-key');
                if (ki) ki.value = userConfig.apiKey || '';
                const at = document.getElementById('set-anim-toggle');
                if (at) at.checked = userConfig.animations;
                const rt = document.getElementById('set-rate-toggle');
                if (rt) rt.checked = userConfig.ratesEnabled;
                const ls = document.getElementById('set-loc-select');
                if (ls) ls.value = userConfig.buttonLocation;
                refreshDemoMasks();
            } else if (tgt === 'graph') {
                tp.classList.add('viewing-graph');
                GraphController.restoreUi();
                GraphController.draw();
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    if (dom.topPanel && dom.topPanel.classList.contains('viewing-graph')) GraphController.draw();
                }));
            } else if (tgt === 'stickers') {
                tp.classList.add('viewing-stickers');
                renderStickers();
                if (cm !== 'stickers' && dom.stickerSponsor && userConfig.animations) {
                    dom.stickerSponsor.classList.remove('shimmer-once');
                    void dom.stickerSponsor.offsetWidth;
                    dom.stickerSponsor.classList.add('shimmer-once');
                }
            } else if (tgt === 'achievements') {
                tp.classList.add('viewing-achievements');
                renderAchievements();
            } else renderPanelContent();
            // Re-apply the scan mask for the newly active view (settings gets the "unavailable"
            // variant; other views get the full scan state machine).
            renderScanOverlay();
        };
        if (inst) {
            app();
            return;
        }
        if (runtime.isViewAnimating) {
            cel.classList.remove('bbgl-crt-out', 'bbgl-crt-in');
            nel.classList.remove('bbgl-crt-out', 'bbgl-crt-in');
            runtime.isViewAnimating = false;
        }
        runtime.isViewAnimating = true;
        if (!userConfig.animations) {
            app();
            runtime.isViewAnimating = false;
        } else if (cm === 'settings') {
            app();
            nel.classList.add('bbgl-crt-in');
            setTimeout(() => {
                nel.classList.remove('bbgl-crt-in');
                runtime.isViewAnimating = false;
            }, 300);
        } else if (tgt === 'settings') {
            cel.classList.add('bbgl-crt-out');
            setTimeout(() => {
                cel.classList.remove('bbgl-crt-out');
                app();
                runtime.isViewAnimating = false;
            }, 280);
        } else if (tgt === 'stickers') {
            cel.classList.add('bbgl-crt-out');
            setTimeout(() => {
                cel.classList.remove('bbgl-crt-out');
                app();
                runtime.isViewAnimating = false;
            }, 280);
        } else if (cm === 'stickers') {
            nel.classList.add('bbgl-crt-in');
            app();
            setTimeout(() => {
                nel.classList.remove('bbgl-crt-in');
                runtime.isViewAnimating = false;
            }, 300);
        } else {
            cel.classList.add('bbgl-crt-out');
            setTimeout(() => {
                cel.classList.remove('bbgl-crt-out');
                nel.classList.add('bbgl-crt-in');
                app();
                setTimeout(() => {
                    nel.classList.remove('bbgl-crt-in');
                    runtime.isViewAnimating = false;
                }, 300);
            }, 280);
        }
    }

    function closePanel(e) {
        if (e) e.stopPropagation();
        if (runtime.isClosing) return;
        const p = dom.panel,
            b = dom.gymTab;
        if (!p) return;
        runtime.isClosing = true;
        viewState.isOpen = false;
        viewState.isTall = false;
        viewState.subView = 'ledger';
        viewState.activeViewLabel = null;
        viewState.achEnhPeriodMode = false;
        viewState.graphStats = undefined;
        viewState.graphMode = undefined;
        runtime.currentStickerPage = 0;
        viewState.currentStickerPage = 0;
        const _n = TimeManager.now();
        viewState.calYear = _n.year;
        viewState.calMonth = _n.month;
        saveViewState();
        const sp = dom.settingsView,
            tp = dom.topPanel,
            bp = dom.bottomPanel,
            wv = dom.welcomeView;
        if (sp) sp.classList.remove('active-view');
        if (wv) wv.classList.remove('active-view');
        if (tp) {
            tp.style.display = 'flex';
            tp.classList.remove('viewing-graph', 'viewing-stickers', 'viewing-achievements');
        }
        if (bp) bp.style.display = 'flex';
        closeItemViewer(false);
        calendarState.year = viewState.calYear;
        calendarState.month = viewState.calMonth;
        calendarState.selectedData = null;
        calendarState.selectedLabel = null;
        renderPanelContent();
        if (b) b.classList.remove('bbgl-tab-active');
        updateTransformOrigin();
        p.classList.remove('bbgl-animate-pop');
        p.classList.remove('bbgl-tall');
        const tt = dom.tallToggle;
        if (tt) tt.innerText = "+";
        if (userConfig.animations) {
            p.classList.add('bbgl-animate-vanish');
            setTimeout(() => {
                p.style.display = 'none';
                p.classList.remove('bbgl-animate-vanish');
                runtime.isClosing = false;
                handleLayout();
            }, 300);
        } else {
            p.style.display = 'none';
            runtime.isClosing = false;
            handleLayout();
        }
    }

    function toggleTall() {
        const p = dom.panel,
            b = dom.tallToggle;
        if (p.classList.contains('bbgl-mode-page')) return;
        p.classList.toggle('bbgl-tall');
        const t = p.classList.contains('bbgl-tall');
        b.innerText = t ? "–" : "+";
        viewState.isTall = t;
        saveViewState();
        const tp = dom.topPanel;
        if (!t) {
            if (tp.classList.contains('viewing-graph') || tp.classList.contains('viewing-stickers') || tp.classList.contains('viewing-achievements')) switchView('ledger');
        } else {
            if (tp.classList.contains('viewing-graph')) {
                GraphController.draw();
                setTimeout(GraphController.draw, 320);
            }
        }
    }

    function toggleLedgerView() {
        switchView('ledger');
        saveViewState();
    }

    function toggleGraphView() {
        switchView('graph');
        saveViewState();
    }

    function toggleStickerView() {
        const mp = dom.panel,
            tb = dom.tallToggle;
        if (!viewState.isTall && !mp.classList.contains('bbgl-mode-page')) {
            viewState.isTall = true;
            if (mp) mp.classList.add('bbgl-tall');
            if (tb) tb.innerText = "–";
        }
        viewState.activeItemId = 1;
        switchView('stickers');
        setTimeout(() => {
            if (!runtime.stickerData.length) loadStickerData();
            const i = runtime.stickerData.find(x => x.id === (viewState.activeItemId || 1));
            if (i) openItemViewer(i, true);
        }, 400);
        saveViewState();
    }

    function toggleAchievementsView() {
        const mp = dom.panel,
            tb = dom.tallToggle;
        if (!viewState.isTall && !mp.classList.contains('bbgl-mode-page')) {
            viewState.isTall = true;
            if (mp) mp.classList.add('bbgl-tall');
            if (tb) tb.innerText = "–";
        }
        switchView('achievements');
        saveViewState();
    }

    function toggleSettingsView(e) {
        if (e) e.stopPropagation();
        const sp = dom.settingsView,
            tp = dom.topPanel,
            vp = dom.itemViewer;
        if (sp.classList.contains('active-view')) {
            let t = runtime.returnView || 'ledger';
            if (t === 'viewer') {
                switchView('stickers');
                viewState.subView = 'stickers';
                if (viewState.activeItemId) setTimeout(() => {
                    if (!runtime.stickerData.length) loadStickerData();
                    const i = runtime.stickerData.find(x => x.id === viewState.activeItemId);
                    if (i) openItemViewer(i, false);
                }, 50);
            } else {
                switchView(t);
                viewState.subView = t;
            }
        } else {
            if (vp && vp.classList.contains('active')) runtime.returnView = 'viewer';
            else if (tp.classList.contains('viewing-graph')) runtime.returnView = 'graph';
            else if (tp.classList.contains('viewing-stickers')) runtime.returnView = 'stickers';
            else if (tp.classList.contains('viewing-achievements')) runtime.returnView = 'achievements';
            else runtime.returnView = 'ledger';
            switchView('settings');
            viewState.subView = 'settings';
        }
        saveViewState();
    }

    function updateTransformOrigin() {
        const p = dom.panel,
            b = dom.gymTab;
        if (!p || !b) {
            runtime.transformOriginRetries = 0;
            return;
        }
        const pr = p.getBoundingClientRect(),
            br = b.getBoundingClientRect();
        if (pr.width === 0 || pr.height === 0) {
            runtime.transformOriginRetries = (runtime.transformOriginRetries || 0) + 1;
            if (runtime.transformOriginRetries > 30) {
                runtime.transformOriginRetries = 0;
                return;
            }
            window.requestAnimationFrame(updateTransformOrigin);
            return;
        }
        runtime.transformOriginRetries = 0;
        const cx = br.left + (br.width / 2),
            cy = br.top + (br.height / 2);
        p.style.transformOrigin = `${cx - pr.left}px ${cy - pr.top}px`;
    }

    let _backfillCountdownId = null;

    function formatCountdown(ms) {
        const total = Math.max(0, Math.ceil(ms / 1000));
        const h = Math.floor(total / 3600),
            m = Math.floor((total % 3600) / 60),
            s = total % 60;
        const pad = n => String(n).padStart(2, '0');
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }

    /* ============================ Big Black Backfill scan overlay ============================
       A full-panel mask (#bbgl-scan-overlay) driven entirely off the persisted backfill state
       (ds) plus runtime.backfilling. renderScanOverlay() is the single source of truth — the
       overlay analog of renderBackfillButton() — and is idempotent so it can be called freely
       from render/lifecycle paths without tearing down the live counter or handlers. */
    const SCAN_PAUSE_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`;
    const SCAN_PLAY_SVG  = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
    let _scanOverlayTimer = null;   // cap countdown OR passenger-staleness poll
    let _scanOverlayKey = null;     // last rendered visual key; guards idempotent rebuilds
    let _scanCancelConfirm = false; // transient: Cancel clicked, awaiting yes/no

    function updateScanOverlayCount(n) {
        const el = document.querySelector('#bbgl-scan-count');
        if (el) el.textContent = String(n);
    }

    // Resolve the current visual state from persisted ds + this tab's role. Returns {key, ds}.
    function currentScanState() {
        if (runtime.demoMode) return { key: null, ds: null };
        const s = getActiveHistory();
        const ds = s && s.meta && s.meta.backfill;
        if (!ds) return { key: null, ds: null };
        const lockFresh = ds.lock && (Date.now() - ds.lock) < BACKFILL.LOCK_STALE_MS;
        let key = null;
        if (runtime.backfilling) key = _scanCancelConfirm ? 'confirm' : 'scanning';
        else if (lockFresh && ds.lockOwner !== _TAB_ID) key = 'passenger';   // another tab drives
        else if (ds.acknowledged === false) {
            if (ds.lastResult === 'complete') key = 'complete';
            else if (ds.stopReason === 'cap') key = 'cap';
            else if (ds.stopReason === 'paused') key = 'paused';
            else key = 'error';
        }
        return { key, ds };
    }

    function updateScanCapCountdown(ds) {
        const el = document.querySelector('#bbgl-scan-cap-timer');
        if (!el) return;
        const remaining = (ds.cooldownUntil || 0) - Date.now();
        el.textContent = formatCountdown(remaining);
        if (remaining <= 0 && _scanOverlayTimer) {
            clearInterval(_scanOverlayTimer);
            _scanOverlayTimer = null;
        }
    }

    // Placeholder copy — final wording authored separately. Each state returns overlay inner HTML.
    function buildScanOverlayInner(key, ds) {
        const cancelX = `<div id="bbgl-scan-cancel">Cancel</div>`;
        switch (key) {
            case 'settings':
                return `<div class="bbgl-scan-title">Scan in Progress</div><div class="bbgl-scan-sub">Settings are unavailable while a backfill is running. Return to the log to manage the scan.</div>`;
            case 'scanning':
                return `${cancelX}<div class="bbgl-scan-title">Scanning&hellip; <span id="bbgl-scan-count" class="bbgl-scan-count">0</span></div><div class="bbgl-scan-sub">Reconstructing your training history. You can keep playing &mdash; just don't close this tab until the scan finishes.</div><div class="bbgl-scan-actions"><div id="bbgl-scan-pause" class="bbgl-scan-iconbtn bbgl-scan-play" title="Pause">${SCAN_PAUSE_SVG}</div></div>`;
            case 'confirm':
                return `<div class="bbgl-scan-title">Discard backfill progress?</div><div class="bbgl-scan-sub">This discards all backfilled history and starts your log fresh from installation. Your tracking since install is kept.</div><div class="bbgl-scan-actions"><div id="bbgl-scan-confirm-yes" class="bbgl-scan-iconbtn bbgl-scan-yes" title="Yes, discard">${ICONS.CHECK}</div><div id="bbgl-scan-confirm-no" class="bbgl-scan-iconbtn bbgl-scan-no" title="No, keep scanning">${ICONS.CLOSE}</div></div>`;
            case 'passenger':
                return `<div class="bbgl-scan-title">Scanning&hellip;</div><div class="bbgl-scan-sub">A backfill is running in another tab. Switch to that tab to pause or cancel it.</div>`;
            case 'paused':
                return `<div class="bbgl-scan-title">Scan Paused</div><div class="bbgl-scan-sub">Your logs are partially filled. Continue now and resume the backfill anytime from the Settings menu.</div><div class="bbgl-scan-actions"><div id="bbgl-scan-resume" class="bbgl-scan-iconbtn bbgl-scan-play" title="Resume">${SCAN_PLAY_SVG}</div><div id="bbgl-scan-proceed" class="bbgl-scan-textbtn bbgl-scan-primary">Proceed to partial logs</div></div>`;
            case 'error':
                return `<div class="bbgl-scan-title">Scan Interrupted</div><div class="bbgl-scan-sub">The backfill stopped before finishing. Resume to keep going, or proceed with what's been filled so far.</div><div class="bbgl-scan-actions"><div id="bbgl-scan-resume" class="bbgl-scan-iconbtn bbgl-scan-play" title="Resume">${SCAN_PLAY_SVG}</div><div id="bbgl-scan-proceed" class="bbgl-scan-textbtn bbgl-scan-primary">Proceed to partial logs</div></div>`;
            case 'cap':
                return `<div class="bbgl-scan-title">Daily Row Limit Reached</div><div class="bbgl-scan-sub">Torn limits how much history can be pulled per day. You can resume in <span id="bbgl-scan-cap-timer">--:--:--</span> from the Settings menu.</div><div class="bbgl-scan-actions"><div id="bbgl-scan-proceed" class="bbgl-scan-textbtn bbgl-scan-primary">Proceed to partial logs</div></div>`;
            case 'complete': {
                const sub = ds && ds.completion === 'exhausted'
                    ? "We've pulled back as far as Torn still keeps your logs. Your history is ready."
                    : "Your full training history has been reconstructed. Welcome to the log.";
                return `<div class="bbgl-scan-title">Backfill Complete!</div><div class="bbgl-scan-sub">${sub}</div><div class="bbgl-scan-actions"><div id="bbgl-scan-ack" class="bbgl-scan-textbtn bbgl-scan-primary">Enter Logs</div></div>`;
            }
            default:
                return '';
        }
    }

    function wireScanOverlay(el, key, ds) {
        const cancel = el.querySelector('#bbgl-scan-cancel');
        if (cancel) cancel.onclick = () => { _scanCancelConfirm = true; _scanOverlayKey = null; renderScanOverlay(); };
        const pause = el.querySelector('#bbgl-scan-pause');
        if (pause) pause.onclick = () => {
            runtime.backfillAbort = 'pause';
            const t = el.querySelector('.bbgl-scan-title');
            if (t) t.textContent = 'Pausing…';
        };
        const yes = el.querySelector('#bbgl-scan-confirm-yes');
        if (yes) yes.onclick = () => {
            runtime.backfillAbort = 'cancel';
            _scanCancelConfirm = false;
            const t = el.querySelector('.bbgl-scan-title');
            if (t) t.textContent = 'Discarding…';
        };
        const no = el.querySelector('#bbgl-scan-confirm-no');
        if (no) no.onclick = () => { _scanCancelConfirm = false; _scanOverlayKey = null; renderScanOverlay(); };
        const resume = el.querySelector('#bbgl-scan-resume');
        if (resume) resume.onclick = () => { backfillLogs(document.getElementById('backfill-btn')); };
        const proceed = el.querySelector('#bbgl-scan-proceed');
        if (proceed) proceed.onclick = () => { proceedPartialBackfill(); };
        const ack = el.querySelector('#bbgl-scan-ack');
        if (ack) ack.onclick = () => { acknowledgeBackfill(); };
    }

    function renderScanOverlay() {
        const existing = document.getElementById('bbgl-scan-overlay');
        const { key, ds } = currentScanState();

        if (!key) {
            _scanCancelConfirm = false;
            _scanOverlayKey = null;
            if (_scanOverlayTimer) { clearInterval(_scanOverlayTimer); _scanOverlayTimer = null; }
            if (existing) existing.remove();
            return;
        }

        // The cancel-confirm sub-state only exists during an active scan; clear it on any other
        // state so it can never leak into the next scan's first render.
        if (key !== 'scanning' && key !== 'confirm') _scanCancelConfirm = false;

        const host = document.querySelector('#bbgl-content-wrapper');
        if (!host) return;

        // In the settings view, show a distinct "unavailable" mask with no scan controls.
        const inSettings = dom.settingsView && dom.settingsView.classList.contains('active-view');
        const renderKey = inSettings ? 'settings' : key;

        // Idempotent: skip a rebuild when the visual state is unchanged so the live counter and
        // handlers survive (renderScanOverlay is called from hot render paths).
        if (existing && _scanOverlayKey === renderKey) return;
        _scanOverlayKey = renderKey;
        if (_scanOverlayTimer) { clearInterval(_scanOverlayTimer); _scanOverlayTimer = null; }

        const el = existing || document.createElement('div');
        el.id = 'bbgl-scan-overlay';
        el.innerHTML = buildScanOverlayInner(renderKey, ds);
        if (!existing) host.appendChild(el);
        wireScanOverlay(el, renderKey, ds);

        if (renderKey === 'cap') {
            updateScanCapCountdown(ds);
            _scanOverlayTimer = setInterval(() => updateScanCapCountdown(ds), 1000);
        } else if (renderKey === 'passenger') {
            // No broadcast fires if the driver tab dies; poll so we can promote to the Error mask
            // once its lock goes stale.
            _scanOverlayTimer = setInterval(() => renderScanOverlay(), 3000);
        }
    }

    // Route the Settings "BB Backfill" button into the masked scan: switch to the log (so the
    // overlay's pause/cancel controls are visible, not the settings "unavailable" variant), then
    // start or resume the scan. No modal — the disclosure now lives in the privacy doc.
    function startBackfillFromSettings() {
        if (runtime.demoMode) return;
        switchView('ledger');
        backfillLogs(document.getElementById('backfill-btn'));
    }

    // The full scan state machine now lives in the masked overlay (renderScanOverlay). This just
    // reflects backfill state onto the Settings button and wires its click:
    //  - scanning / masked stop-state (unacknowledged): inert; the overlay owns the UI.
    //  - cooling down after a cap (acknowledged): inert with a live "resume available in" countdown.
    //  - partial + resumable, or fresh/complete: clickable, routes into the masked scan.
    function renderBackfillButton() {
        const btn = document.getElementById('backfill-btn');
        if (!btn) return;
        if (_backfillCountdownId) {
            clearInterval(_backfillCountdownId);
            _backfillCountdownId = null;
        }

        // Reset to a clean baseline before applying the active state.
        btn.style.pointerEvents = '';
        btn.style.opacity = '';
        btn.style.color = '';
        btn.removeAttribute('data-tooltip');
        delete btn.dataset.originalText;
        btn.onclick = null;

        if (runtime.demoMode) return;

        const idleLabel = '<span class="view-std">BB Backfill</span><span class="view-exp">Big Black Backfill</span>';

        // Scan running, or a masked stop-state awaiting acknowledgement: the overlay covers the panel
        // (including this button), so keep it inert.
        const s = getActiveHistory();
        const ds = s.meta && s.meta.backfill;
        if (runtime.backfilling || (ds && ds.acknowledged === false)) {
            btn.style.opacity = '0.6';
            btn.style.pointerEvents = 'none';
            btn.innerHTML = idleLabel;
            return;
        }

        // Acknowledged cap: still cooling down. Inert with a live countdown until resume unlocks.
        if (ds && ds.lastResult === 'partial' && ds.cooldownUntil && Date.now() < ds.cooldownUntil) {
            btn.style.opacity = '0.6';
            btn.style.pointerEvents = 'none';
            const render = () => {
                const remaining = ds.cooldownUntil - Date.now();
                if (remaining <= 0) {
                    renderBackfillButton();
                    return;
                }
                btn.innerHTML = `Resume available in ${formatCountdown(remaining)}`;
            };
            render();
            _backfillCountdownId = setInterval(render, 1000);
            return;
        }

        // Partial and resumable now (acknowledged pause/error, or cap cooldown elapsed).
        if (ds && ds.lastResult === 'partial') {
            btn.innerHTML = '<span class="view-std">Resume Backfill</span><span class="view-exp">Resume Big Black Backfill</span>';
            btn.onclick = function() {
                this.blur();
                startBackfillFromSettings();
            };
            return;
        }

        // Fresh, or completed-and-acknowledged: start a new scan.
        btn.innerHTML = idleLabel;
        btn.onclick = function() {
            this.blur();
            startBackfillFromSettings();
        };
    }

    // Idle/syncing/done are separate spans inside the button (see buildResyncBtn) rather than a
    // literal text swap, since the idle label itself has to keep responding to compact/expanded
    // mode via CSS (view-std/view-exp) even while this function is driving it.
    function setResyncBtnState(btn, state) {
        const idle = btn.querySelector('.bbgl-rs-idle'),
            syncing = btn.querySelector('.bbgl-rs-sync'),
            done = btn.querySelector('.bbgl-rs-done');
        if (idle) idle.style.display = state === 'idle' ? '' : 'none';
        if (syncing) syncing.style.display = state === 'syncing' ? '' : 'none';
        if (done) done.style.display = state === 'done' ? '' : 'none';
    }

    function setupEventListeners(root) {
        cacheDOM(root);
        const get = (id) => root.querySelector('#' + id);
        const hb = get('bbgl-header-bar');
        if (hb) hb.onclick = (e) => {
            if (e.target.closest('.bbgl-custom-icon') || e.target.closest('#bbgl-demo-exit-btn') || e.target.closest('#bbgl-pop-btn') || e.target.closest('#bbgl-demo-exit')) return;
            closePanel();
        };
        const atBtn = get('all-time-btn');
        if (atBtn) atBtn.onclick = (e) => {
            e.stopPropagation();
            calcAllTimeStats();
        };
        const cb = get('bbgl-close-btn');
        if (cb) cb.onclick = () => closePanel();
        const sb = get('bbgl-settings-btn');
        if (sb) sb.onclick = toggleSettingsView;
        const csb = root.querySelector('#bbgl-settings-view .close-settings-btn');
        if (csb) csb.onclick = toggleSettingsView;
        const debBtn = get('bbgl-demo-exit-btn'),
            deb = get('bbgl-demo-exit');
        if (deb) deb.onclick = (e) => {
            e.stopPropagation();
            localStorage.removeItem(KEYS.DEMO);
            runtime.demoMode = false;
            runtime.demoHistory = null;
            runtime.stickerData = [];
            _historyCache = null;
            DataController.invalidate();
            DBManager.loadHistory().then(loaded => {
                DataController.hydrate(loaded);
                if (userConfig.apiKey) {
                    startBackgroundSync();
                }
            }).catch(e => {
                if (userConfig.apiKey) {
                    startBackgroundSync();
                }
            }).finally(() => snapLevelBar());
            calendarState.selectedData = null;
            calendarState.selectedLabel = Formatter.dateLogical();
            viewState.activeViewLabel = null;
            deb.style.display = 'none';
            if (debBtn) debBtn.style.display = 'none';
            const pdeb = document.getElementById('bbgl-page-demo-exit');
            if (pdeb) pdeb.style.display = 'none';
            if (window.TooltipController) window.TooltipController.hide();
            refreshInitLock();
            refreshDemoMasks();
            if (runtime.realReturnView) {
                runtime.returnView = runtime.realReturnView;
                runtime.realReturnView = null;
            }
            const isInit = !!localStorage.getItem('bbgl_initialized');
            if (isInit) {
                switchView('settings');
            } else {
                switchView('welcome', true);
                openPrivacyModal();
            }
        };
        if (debBtn) debBtn.onclick = deb ? deb.onclick : null;
        const pb = get('bbgl-pop-btn');
        if (pb) pb.onclick = (e) => {
            e.stopPropagation();
            if (dom.panel.classList.contains('bbgl-mode-page')) return;
            const p = dom.panel;
            const animate = userConfig.animations && !p.classList.contains('bbgl-no-animations');
            if (animate) markPanelResizing(p); // suppresses backdrop-filter for the width/height transition
            viewState.expanded = !viewState.expanded;
            if (viewState.expanded) {
                p.classList.add('bbgl-expanded');
                p.classList.remove('bbgl-compact');
                pb.innerHTML = ICONS.COMPRESS;
            } else {
                p.classList.remove('bbgl-expanded');
                p.classList.add('bbgl-compact');
                pb.innerHTML = ICONS.POPOUT;
            }
            saveViewState();
            handleLayout();
            renderPanelContent();
            if (dom.topPanel.classList.contains('viewing-graph')) {
                GraphController.draw();
                setTimeout(GraphController.draw, 320);
            }
            if (dom.topPanel.classList.contains('viewing-achievements')) {
                setTimeout(resizeAchLockedPage, 320);
            }
        };
        const tt = get('bbgl-tall-toggle');
        if (tt) tt.onclick = toggleTall;
        const lt = get('bbgl-ledger-toggle');
        if (lt) lt.onclick = toggleLedgerView;
        const cpb = dom.copyBtn;
        if (cpb) cpb.onclick = (e) => {
            e.stopPropagation();
            const cs = runtime.currentStats;
            if (!cs) return;
            const { sl, s } = cs;
            const txt = buildSessionText(sl, s, ['str', 'def', 'spd', 'dex']);
            navigator.clipboard.writeText(txt).then(() => {
                // Flash all four stat columns on the ledger.
                const cols = dom.ledgerView ? Array.from(dom.ledgerView.querySelectorAll('.stat-column')) : [];
                if (cols.length) flashCopied(cols);
                // Also animate the copy button itself.
                const oH = cpb.innerHTML, oC = cpb.style.color;
                cpb.innerHTML = ICONS.CHECK;
                cpb.style.color = '#69f0ae';
                cpb.style.opacity = '1';
                setTimeout(() => {
                    cpb.innerHTML = oH;
                    cpb.style.color = oC;
                    cpb.style.opacity = '';
                }, 1000);
            });
        };

        // Delegated click on the ledger view: clicking a stat label copies that stat's data.
        if (dom.ledgerView) {
            dom.ledgerView.addEventListener('click', (e) => {
                const label = e.target.closest('.bbgl-copy-label');
                if (!label) return;
                const col = label.closest('.stat-column');
                if (!col) return;
                const k = col.getAttribute('data-copy-stat');
                if (!k) return;
                const cs = runtime.currentStats;
                if (!cs) return;
                const { sl, s } = cs;
                if (!s[k]) return;
                const txt = buildSessionText(sl, s, [k]);
                navigator.clipboard.writeText(txt).then(() => flashCopied(col));
            });
        }
        const gt = get('bbgl-graph-toggle');
        if (gt) gt.onclick = toggleGraphView;
        const act = get('bbgl-achievements-toggle');
        if (act) act.onclick = toggleAchievementsView;
        const st = get('bbgl-sticker-toggle');
        if (st) st.onclick = toggleStickerView;
        const sp = get('sticker-prev-btn'),
            sn = get('sticker-next-btn'),
            ssp = get('sticker-sponsor-btn');
        if (sp) sp.onclick = (e) => {
            e.stopPropagation();
            if (runtime.currentStickerPage > 0) changeStickerPage(-1);
        };
        if (sn) sn.onclick = (e) => {
            e.stopPropagation();
            if (runtime.currentStickerPage < Math.ceil((runtime.stickerData.length || 0) / 10) - 1) changeStickerPage(1);
        };
        if (ssp) ssp.onclick = (e) => {
            e.stopPropagation();
            if (ssp.classList.contains('disabled')) return;
            if (runtime.currentStickerPage === 0) changeStickerPage(-1);
        };
        const pm = get('prev-month-btn');
        if (pm) pm.onclick = () => changeMonth(-1);
        const nm = get('next-month-btn');
        if (nm) nm.onclick = () => changeMonth(1);
        const mt = get('month-trigger');
        if (mt) mt.onclick = (e) => {
            e.stopPropagation();
            toggleMonthDropdown();
        };
        const yt = get('year-trigger');
        if (yt) yt.onclick = (e) => {
            e.stopPropagation();
            toggleYearDropdown();
        };
        const ms = get('month-stats-btn');
        if (ms) ms.onclick = (e) => {
            e.stopPropagation();
            calcPeriodStats('month');
        };
        const ys = get('year-stats-btn');
        if (ys) ys.onclick = (e) => {
            e.stopPropagation();
            calcPeriodStats('year');
        };
        const at = get('set-anim-toggle');
        if (at) {
            at.checked = userConfig.animations;
            at.onchange = () => {
                userConfig.animations = at.checked;
                saveConfig();
                if (dom.panel) dom.panel.classList.toggle('bbgl-no-animations', !userConfig.animations);
                renderPanelContent();
            };
        }
        const rt = get('set-rate-toggle');
        if (rt) {
            rt.checked = userConfig.ratesEnabled;
            rt.onchange = () => {
                userConfig.ratesEnabled = rt.checked;
                saveConfig();
                if (dom.panel) dom.panel.classList.toggle('bbgl-no-rates', !userConfig.ratesEnabled);
                if (!userConfig.ratesEnabled && graphState.mode === 'rates') {
                    graphState.mode = 'values';
                    viewState.graphMode = 'values';
                    saveViewState();
                }
                const tp = dom.topPanel;
                if (tp && tp.classList.contains('viewing-graph')) {
                    GraphController.restoreUi();
                    GraphController.draw();
                } else {
                    const sd = calendarState.selectedData;
                    renderStats(sd || getActiveHistory().today, calendarState.selectedLabel || Formatter.dateLogical());
                }
            };
        }
        const dtk = get('set-drug-tracker');
        if (dtk) {
            dtk.value = userConfig.drugTracker || 'xanax';
            dtk.onchange = () => {
                userConfig.drugTracker = dtk.value;
                saveConfig();
                const tp = dom.topPanel;
                if (!tp || !tp.classList.contains('viewing-graph')) {
                    const sd = calendarState.selectedData;
                    renderStats(sd || getActiveHistory().today, calendarState.selectedLabel || Formatter.dateLogical());
                }
            };
        }
        const agt = get('set-bestgym-toggle');
        if (agt) {
            agt.checked = userConfig.bestGym;
            agt.onchange = () => setBestGym(agt.checked);
        }
        const ags = get('set-bestgym-spec-toggle');
        if (ags) {
            ags.checked = userConfig.bestGymSpecialist;
            const agsRow = ags.closest('.bbgl-setting-row');
            if (agsRow) agsRow.classList.toggle('bbgl-row-disabled', !userConfig.bestGym);
            ags.onchange = () => {
                userConfig.bestGymSpecialist = ags.checked;
                saveConfig();
            };
        }
        const agu = get('set-bestgym-unpurch-toggle');
        if (agu) {
            agu.checked = userConfig.bestGymUnpurchased;
            const aguRow = agu.closest('.bbgl-setting-row');
            if (aguRow) aguRow.classList.toggle('bbgl-row-disabled', !userConfig.bestGym);
            agu.onchange = () => {
                userConfig.bestGymUnpurchased = agu.checked;
                saveConfig();
            };
        }
        const ls = get('set-loc-select');
        if (ls) {
            ls.value = userConfig.buttonLocation;
            ls.onchange = () => onChangeLoc(ls.value);
        }
        const ds = get('set-day-start');
        if (ds) {
            ds.value = userConfig.dayStartMode;
            ds.onchange = () => onChangeDayStart(ds.value);
        }
        const ws = get('set-week-start');
        if (ws) {
            ws.value = userConfig.weekStartMode;
            ws.onchange = () => onChangeWeekStart(ws.value);
        }
        const ai = get('set-api-key'),
            ap = get('set-api-paste');
        if (ap && ai) ap.onclick = async () => {
            try {
                const t = await navigator.clipboard.readText();
                if (t) ai.value = t.trim();
            } catch (e) {
                alert("Clipboard access denied. Please paste manually.");
            }
        };
        const ub = get('updt-settings-btn');
        if (ub && ai) ub.onclick = async function() {
            this.blur();
            const v = ai.value.trim();
            if (!/^[a-zA-Z0-9]{16}$/.test(v)) {
                alert("Invalid Format.\nA Torn API Key must be exactly 16 alphanumeric characters.");
                return;
            }
            const ot = ub.innerText;
            ub.innerText = "VERIFYING...";
            try {
                const res = await fetch(`https://api.torn.com/user/?selections=battlestats,log&log=5300&key=${v}`),
                    data = await res.json();
                if (data.error) {
                    alert(`Key Verification Failed: ${data.error.error}\n\nPlease generate a key properly configured with 'battlestats' and 'log' access.`);
                    ub.innerText = ot;
                    return;
                }
                userConfig.apiKey = v;
                saveConfig();
                ub.style.transition = "all 0.2s";
                ub.style.color = "#69f0ae";
                ub.style.borderColor = "#69f0ae";
                ub.innerText = "KEY SAVED";
                if (ub.dataset.timer) clearTimeout(ub.dataset.timer);
                ub.dataset.timer = setTimeout(() => {
                    ub.style.color = "";
                    ub.style.borderColor = "";
                    ub.innerText = ot;
                }, 2000);
            } catch (e) {
                alert("Network error during verification.");
                ub.innerText = ot;
            }
        };
        const cab = get('clear-api-btn');
        if (cab && ai) cab.onclick = function() {
            this.blur();
            userConfig.apiKey = '';
            saveConfig();
            ai.value = '';
            localStorage.removeItem(KEYS.LAST_SYNC);
            sessionStorage.removeItem(KEYS.SESSION_CACHE);
            sessionStorage.removeItem(KEYS.SESSION);
            const ot = cab.innerText;
            cab.innerText = "WIPED";
            setTimeout(() => {
                cab.innerText = ot;
            }, 2000);
        };
        const crb = get('create-api-btn');
        if (crb) crb.onclick = function() {
            this.blur();
            window.open('https://www.torn.com/preferences.php#tab=api?step=addNewKey&user=battlestats,log&faction=rankedwars&logIds=54,50,52,23,80,6&title=BigBlackGymLog', '_blank');
        };
        const rb = get('refresh-log-btn');
        if (rb) rb.onclick = function() {
            this.blur();
            if (checkRefreshCooldown(this)) return;
            syncWithFeedback('FULL_SYNC');
        };
        const rsb = get('resync-btn');
        if (rsb) rsb.onclick = async function() {
            this.blur();
            setResyncBtnState(rsb, 'syncing');
            await syncWithFeedback('FULL_SYNC');
            setResyncBtnState(rsb, 'done');
            if (rsb.dataset.timerId) clearTimeout(rsb.dataset.timerId);
            rsb.dataset.timerId = setTimeout(() => setResyncBtnState(rsb, 'idle'), 2000);
        };
        const eb = get('export-btn');
        if (eb) eb.onclick = function() {
            this.blur();
            exportData();
        };
        const ib = get('import-btn');
        if (ib) ib.onclick = function() {
            this.blur();
            get('import-file').click();
        };
        const iF = get('import-file');
        if (iF) iF.onchange = (e) => importData(e.target.files[0]);
        // The backfill button's click behavior is state-dependent (open modal / resume / acknowledge),
        // so renderBackfillButton owns wiring its onclick for the current state.
        renderBackfillButton();
        renderScanOverlay();
        const clb = get('clear-btn');
        if (clb) clb.onclick = function() {
            this.blur();
            clearData();
        };
        const pdb = get('settings-privacy-btn');
        if (pdb) pdb.onclick = function() {
            this.blur();
            openPrivacyModal();
        };
        const cl = get('settings-changelog-btn');
        if (cl) cl.onclick = function() {
            this.blur();
            openChangelogModal();
        };
        const sdemo = get('settings-demo-btn');
        if (sdemo) sdemo.onclick = function() {
            this.blur();
            if (runtime.demoMode) {
                const deb = document.getElementById('bbgl-demo-exit');
                if (deb) deb.click();
            } else {
                enterDemoFromSettings();
            }
        };
        const fgb = get('feature-guide-btn');
        if (fgb) fgb.onclick = function() {
            this.blur();
            openFeatureGuideModal();
        };
        const sa = get('swipe-area');
        if (sa) {
            let _sX = 0,
                _sY = 0;
            sa.addEventListener('touchstart', (e) => {
                _sX = e.touches[0].clientX;
                _sY = e.touches[0].clientY;
            }, {
                passive: true
            });
            sa.addEventListener('touchend', (e) => {
                if (window._bbglScrubbing) return;
                const dx = e.changedTouches[0].clientX - _sX,
                    dy = e.changedTouches[0].clientY - _sY;
                if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) changeMonth(dx < 0 ? 1 : -1);
            }, {
                passive: true
            });
        }
        const sgSwipe = get('bbgl-sticker-container');
        if (sgSwipe) {
            let _sgX = 0,
                _sgY = 0;
            sgSwipe.addEventListener('touchstart', (e) => {
                _sgX = e.touches[0].clientX;
                _sgY = e.touches[0].clientY;
            }, {
                passive: true
            });
            sgSwipe.addEventListener('touchend', (e) => {
                if (window._bbglScrubbing) return;
                const dx = e.changedTouches[0].clientX - _sgX,
                    dy = e.changedTouches[0].clientY - _sgY;
                if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                    const dir = dx < 0 ? 1 : -1,
                        maxP = Math.ceil((runtime.stickerData.length || 0) / 10) - 1;
                    if ((dir < 0 && runtime.currentStickerPage > -1) || (dir > 0 && runtime.currentStickerPage < maxP)) changeStickerPage(dir);
                }
            }, {
                passive: true
            });
        }
        GraphController.setupControls();
        setupStickerGrid();
        refreshInitLock();
        const achPrev = get('bbgl-achievements-container') ? root.querySelector('.bbgl-ach-prev') : null;
        const achNext = get('bbgl-achievements-container') ? root.querySelector('.bbgl-ach-next') : null;
        if (achPrev) achPrev.onclick = (e) => {
            e.stopPropagation();
            gotoAchievementsPage(-1);
        };
        if (achNext) achNext.onclick = (e) => {
            e.stopPropagation();
            gotoAchievementsPage(1);
        };
        const achContainer = get('bbgl-achievements-container');
        if (achContainer) {
            let _achX = 0,
                _achY = 0;
            achContainer.addEventListener('touchstart', (e) => {
                _achX = e.touches[0].clientX;
                _achY = e.touches[0].clientY;
            }, {
                passive: true
            });
            achContainer.addEventListener('touchend', (e) => {
                if (window._bbglScrubbing) return;
                const dx = e.changedTouches[0].clientX - _achX,
                    dy = e.changedTouches[0].clientY - _achY;
                if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                    gotoAchievementsPage(dx < 0 ? 1 : -1);
                }
            }, {
                passive: true
            });
            achContainer.addEventListener('click', (e) => {
                const swOpt = e.target.closest('.bbgl-enh-sw-opt');
                if (swOpt) {
                    const toSelected = swOpt.dataset.mode === 'selected';
                    if (toSelected !== !!viewState.achEnhPeriodMode) {
                        viewState.achEnhPeriodMode = toSelected;
                        saveViewState();
                        achRefreshPageDom();
                    }
                    return;
                }
                const colHeader = e.target.closest('.bbgl-ach-col-copy');
                if (colHeader) {
                    handleAchCopy(colHeader);
                    return;
                }
                const statCell = e.target.closest('.bbgl-ach-stat-cell');
                if (statCell) {
                    handleAchCopy(statCell);
                    return;
                }
                const group = e.target.closest('.bbgl-ach-hh-group');
                if (group) {
                    handleAchCopy(group);
                    return;
                }
                const row = e.target.closest('.bbgl-ach-section-title, .bbgl-ach-subsection-title, .bbgl-ach-row');
                if (row) handleAchCopy(row);
            });
        }
    }

    function handleStorageEvent(e) {
        if (e.key === KEYS.STATE) {
            try {
                const ns = JSON.parse(e.newValue);
                if (!ns) return;
                runtime.isSyncing = true;
                const openC = ns.isOpen !== viewState.isOpen,
                    viewC = ns.subView !== viewState.subView,
                    expandedC = ns.expanded !== viewState.expanded,
                    tallC = ns.isTall !== viewState.isTall,
                    stickerPC = ns.currentStickerPage !== viewState.currentStickerPage,
                    labelC = ns.activeViewLabel !== viewState.activeViewLabel,
                    calC = (ns.calMonth !== viewState.calMonth || ns.calYear !== viewState.calYear),
                    itemC = ns.activeItemId !== viewState.activeItemId,
                    gMC = ns.graphMode !== viewState.graphMode,
                    gSC = JSON.stringify(ns.graphStats) !== JSON.stringify(viewState.graphStats);
                viewState = ns;
                const p = dom.panel;
                if (!p) {
                    runtime.isSyncing = false;
                    return;
                }
                if (!openC && !viewC && !expandedC && !tallC && !stickerPC && !labelC && !calC && !itemC && !gMC && !gSC) {
                    runtime.isSyncing = false;
                    return;
                }
                if (!p.classList.contains('bbgl-mode-page') && openC) {
                    if (ns.isOpen && p.style.display === 'none') togglePanel(false);
                    else if (!ns.isOpen && p.style.display !== 'none') closePanel(null);
                }
                if (viewC) switchView(ns.subView);
                if (stickerPC) {
                    runtime.currentStickerPage = ns.currentStickerPage || 0;
                    if (ns.subView === 'stickers') renderStickers();
                }
                if (gMC || gSC) {
                    if (ns.graphMode) graphState.mode = (ns.graphMode === 'gains' ? 'values' : ns.graphMode) || 'values';
                    if (ns.graphStats) graphState.activeStats = ns.graphStats;
                    GraphController.restoreUi();
                    if (ns.subView === 'graph') window.requestAnimationFrame(GraphController.draw);
                }
                if (labelC) {
                    if (ns.activeViewLabel) {
                        const s = getActiveHistory();
                        let td = null;
                        if (/^\d{4}-\d{2}-\d{2}$/.test(ns.activeViewLabel)) {
                            td = s.history.find(d => d.date === ns.activeViewLabel);
                            if (!td && s.today.date === ns.activeViewLabel) td = s.today;
                            if (td) {
                                calendarState.selectedData = td;
                                calendarState.selectedLabel = ns.activeViewLabel;
                                if (ns.subView === 'graph') {
                                    GraphController.draw();
                                    const de = dom.dateLabel;
                                    if (de) de.innerText = Formatter.datePretty(ns.activeViewLabel);
                                } else renderStats(td, ns.activeViewLabel);
                            }
                        } else {
                            calendarState.selectedLabel = ns.activeViewLabel;
                            const type = ns.activeViewLabel === 'All-Time' ? 'ALL' : (/^\d{4}$/.test(ns.activeViewLabel) ? 'YEAR' : 'MONTH'),
                                sl = DataController.getSlice(type, ns.activeViewLabel, calendarState.year);
                            calendarState.selectedData = sl;
                            if (ns.subView === 'graph') GraphController.draw();
                            else renderStats(sl, ns.activeViewLabel);
                        }
                    } else {
                        calendarState.selectedData = null;
                        calendarState.selectedLabel = null;
                        const ts = Formatter.dateLogical();
                        if (ns.subView === 'graph') {
                            GraphController.draw();
                            const de = dom.dateLabel;
                            if (de) de.innerText = Formatter.datePretty(ts);
                        } else renderStats(getActiveHistory().today, ts);
                    }
                    renderPanelContent();
                } else if (calC) {
                    if (ns.calYear) calendarState.year = ns.calYear;
                    if (ns.calMonth !== undefined && ns.calMonth !== null) calendarState.month = ns.calMonth;
                    renderPanelContent();
                }
                if (!p.classList.contains('bbgl-mode-page')) {
                    if (expandedC) {
                        if (ns.expanded) { p.classList.add('bbgl-expanded'); p.classList.remove('bbgl-compact'); }
                        else { p.classList.remove('bbgl-expanded'); p.classList.add('bbgl-compact'); }
                        const pb = dom.popBtn;
                        if (pb) pb.innerHTML = ns.expanded ? ICONS.COMPRESS : ICONS.POPOUT;
                    }
                    if (tallC) {
                        if (ns.isTall) p.classList.add('bbgl-tall');
                        else p.classList.remove('bbgl-tall');
                        const tb = dom.tallToggle;
                        if (tb) tb.innerText = ns.isTall ? "–" : "+";
                    }
                    if (expandedC || tallC) handleLayout();
                }
                if (ns.subView === 'stickers' || ns.subView === 'viewer') {
                    const ti = ns.activeItemId ? Number(ns.activeItemId) : null;
                    if (ti && ti !== runtime.currentOpenedItemId) {
                        if (!runtime.stickerData.length) loadStickerData();
                        const i = runtime.stickerData.find(x => x.id === ti);
                        if (i) {
                            const delay = (viewC && userConfig.animations) ? 400 : 0;
                            if (delay) setTimeout(() => openItemViewer(i, false), delay);
                            else openItemViewer(i, false);
                        }
                    } else if (!ti && runtime.currentOpenedItemId !== null) closeItemViewer(false);
                }
            } catch (err) {
                Log.warn('Sync error', err);
            } finally {
                runtime.isSyncing = false;
            }
        } else if (e.key === KEYS.LAST_SYNC) _syncChannel.onmessage({
            data: {
                from: 'storage_event'
            }
        });
        else if (e.key === KEYS.DEMO) {
            if (e.newValue === '1') {
                if (!runtime.demoMode) enterDemo('external');
            } else if (runtime.demoMode) {
                const deb = dom.panel ? dom.panel.querySelector('#bbgl-demo-exit') : null;
                if (deb) deb.click();
            }
        }
    }
    async function init() {
        Perf.start('init');
        injectStyles();
        const _seenVer = localStorage.getItem(KEYS.CHANGELOG_VER);
        if (SCRIPT_VERSION && typeof SCRIPT_VERSION === 'string') {
            if (!_seenVer) {
                localStorage.setItem(KEYS.CHANGELOG_VER, SCRIPT_VERSION);
            } else if (_seenVer !== SCRIPT_VERSION) {
                localStorage.setItem(KEYS.CHANGELOG_NOTIF, '1');
            }
        }
        if (!runtime.demoMode) {
            // Testing-phase reset lever (see WIPE_BELOW_VERSION in 02-section-i-constants.js).
            // Fresh installs (_seenVer null) are never wiped — there's nothing to wipe yet.
            if (_seenVer && compareVersions(_seenVer, WIPE_BELOW_VERSION) < 0) {
                await factoryReset();
            }
            // Self-heal the install date: if privacyAgreed is missing or unparseable (e.g. corrupted
            // by an older export/import round-trip), stamp it to now. This only governs when reward
            // (sticker/XP) gating begins — it never touches log data.
            if (!userConfig.privacyAgreed || isNaN(Date.parse(userConfig.privacyAgreed))) {
                userConfig.privacyAgreed = new Date().toISOString();
                saveConfig();
            }
            try {
                await DBManager.initDB();
                // Fast boot: load pre-built day objects directly (no series flatten, no
                // _rebuildFromSeries, no session serialization) so every page navigation stays
                // light regardless of how large the backfilled history is.
                const loaded = await DBManager.loadHistory();
                DataController.hydrate(loaded);
                GraphController.applyDefaultsIfNeeded();
                // If a previous scan was interrupted (crash/refresh/close), its heartbeat lock is now
                // stale; release it so the Resume button works again without a 24h lockout.
                await recoverInterruptedBackfill();
                renderBackfillButton();
                renderScanOverlay();
                if (loaded && ((_historyCache.history.length > 0) || (_historyCache.meta && _historyCache.meta.logStartDate)) && !localStorage.getItem('bbgl_initialized')) localStorage.setItem('bbgl_initialized', '1');
            } catch (e) {
                Log.warn('IndexedDB boot failed, continuing with empty state', e);
            }
        }
        window.addEventListener('storage', handleStorageEvent);
        window.addEventListener('hashchange', checkViewRouting);
        window.addEventListener('popstate', checkViewRouting);
        window.addEventListener('resize', () => {
            _topCeilingCache = null;
        });
        window.addEventListener('bbgl:dataUpdated', () => {
            // renderPanelContent() rebuilds the whole visible month's DOM (day cells, weekly
            // capsule bars, stickers) — real work with zero benefit if the panel isn't even on
            // screen (e.g. the 30-minute background sync heartbeat firing while collapsed/closed).
            // Mirrors the same guard the cross-tab sync handler already uses.
            if (dom.panel && dom.panel.style.display !== 'none') renderPanelContent();
            updateLevelBar();
            renderBackfillButton();
            renderScanOverlay();
        });
        updateLevelBar(); // initialize _lastLevelExp before first interaction
        let _domRaf = null;
        const domObs = new MutationObserver(function onDomMutationBatch() {
            if (_domRaf) return;
            _domRaf = requestAnimationFrame(function onDomMutationFrame() {
                _domRaf = null;
                handleDomMutation();
            });
        });
        runtime.domObs = domObs;
        runtime._domGuards = [];
        runtime._domObsArmed = true;
        domObs.observe(document.body, {
            childList: true,
            subtree: true
        });
        attachLayoutObservers();
        // SPA-navigation safety net for the footer tab. Torn travels (and some other in-app nav)
        // via history.pushState — no hashchange, no popstate, no full reload — and during the
        // transition it rebuilds whole regions of the chat/footer, removing our injected tab. The
        // narrow guard observers settleDomObs() leaves behind don't catch a wholesale parent
        // replacement, so the tab is never re-inserted (the "suppressed while flying" symptom).
        // Re-run the existing placement pass a few times across the transition window so the tab
        // re-anchors against the rebuilt notes button. This deliberately touches no observer or
        // injection internals — it just calls handleDomMutation (which the observer already invokes
        // constantly) on a short, bounded schedule, and only on an actual navigation. Each call
        // fast-paths out when nothing has changed, so steady state stays lightweight.
        const _bbglRecheckNav = () => {
            [150, 600, 1500].forEach(ms => setTimeout(() => {
                try { handleDomMutation(); } catch (e) {}
            }, ms));
        };
        ['pushState', 'replaceState'].forEach(name => {
            const orig = history[name];
            if (typeof orig !== 'function' || orig._bbglWrapped) return;
            const wrapped = function() {
                const r = orig.apply(this, arguments);
                _bbglRecheckNav();
                return r;
            };
            wrapped._bbglWrapped = true;
            history[name] = wrapped;
        });
        calendarState.selectedLabel = Formatter.dateLogical();
        if (typeof window.initDevTools === 'function') window.initDevTools();
        if (!runtime.demoMode) {
            startBackgroundSync();
            checkExitSync();
        }
        TooltipController.init();
        let tRaf = null,
            tSup = 0;
        const _onMouseMove = (e) => {
            if (tRaf || Date.now() < tSup) return;
            tRaf = requestAnimationFrame(() => {
                TooltipController.handleHover(e);
                tRaf = null;
            });
        };
        let _mouseMoveBound = true;
        document.addEventListener('mousemove', _onMouseMove);
        let _tX = 0,
            _tY = 0,
            _tTimer = null,
            _scrubMode = false,
            _scrubMoveBound = null;
        const _onScrubMove = (e) => {
            if (!_scrubMode) return;
            if (e.cancelable) e.preventDefault();
            const touch = e.touches[0];
            const el = document.elementFromPoint(touch.clientX, touch.clientY);
            const t = TooltipController.resolve(el);
            const _sh = t ? t.getAttribute('data-tooltip-html') : null,
                _st = t ? t.getAttribute('data-tooltip') : null;
            if (t && (_sh || _st)) {
                if (TooltipController.currentTarget !== t) {
                    if (TooltipController.currentTarget) {
                        TooltipController.currentTarget.classList.remove('is-scrub-hovered');
                        if (TooltipController.currentTarget.classList.contains('bbgl-day-cell') && !TooltipController.currentTarget.classList.contains('is-viewing')) TooltipController.currentTarget.classList.remove('shimmer-active');
                    }
                    TooltipController.currentTarget = t;
                    t.classList.add('is-scrub-hovered');
                    if (t.classList.contains('bbgl-day-cell') && userConfig.animations) {
                        t.classList.add('shimmer-active');
                        if (t._buildShine) t._buildShine();
                    }
                    TooltipController.show(_sh || '<div style="text-align:center; color:#ddd;">' + _st + '</div>', t.getBoundingClientRect());
                }
            } else {
                if (TooltipController.currentTarget) {
                    TooltipController.currentTarget.classList.remove('is-scrub-hovered');
                    if (TooltipController.currentTarget.classList.contains('bbgl-day-cell') && !TooltipController.currentTarget.classList.contains('is-viewing')) TooltipController.currentTarget.classList.remove('shimmer-active');
                    TooltipController.hide();
                }
            }
        };
        const _enterScrub = () => {
            if (_scrubMoveBound) return;
            _scrubMoveBound = _onScrubMove;
            document.addEventListener('touchmove', _scrubMoveBound, {
                passive: false
            });
        };
        const _exitScrub = () => {
            if (!_scrubMoveBound) return;
            document.removeEventListener('touchmove', _scrubMoveBound, {
                passive: false
            });
            _scrubMoveBound = null;
        };
        document.addEventListener('touchstart', (e) => {
            if (!document.body.classList.contains('is-touch-device')) {
                document.body.classList.add('is-touch-device');
                if (_mouseMoveBound) {
                    document.removeEventListener('mousemove', _onMouseMove);
                    _mouseMoveBound = false;
                }
            }
            _tX = e.touches[0].clientX;
            _tY = e.touches[0].clientY;
            _scrubMode = false;
            window._bbglScrubbing = false;
            const t = TooltipController.resolve(e.target);
            const _panel = dom.panel || document.getElementById('bbgl-page-container');
            if (_panel && _panel.contains(e.target)) {
                _tTimer = setTimeout(() => {
                    _scrubMode = true;
                    window._bbglScrubbing = true;
                    _enterScrub();
                    if (t) {
                        TooltipController.currentTarget = t;
                        t.classList.add('is-scrub-hovered');
                        if (t.classList.contains('bbgl-day-cell') && userConfig.animations) {
                            t.classList.add('shimmer-active');
                            if (t._buildShine) t._buildShine();
                        }
                        const _th = t.getAttribute('data-tooltip-html'),
                            _tt = t.getAttribute('data-tooltip');
                        if (_th || _tt) TooltipController.show(_th || '<div style="text-align:center; color:#ddd;">' + _tt + '</div>', t.getBoundingClientRect());
                    }
                }, 400);
            }
        }, {
            passive: true
        });
        document.addEventListener('touchmove', (e) => {
            if (_scrubMode) return;
            if (_tTimer) {
                const dx = e.touches[0].clientX - _tX,
                    dy = e.touches[0].clientY - _tY;
                if (Math.sqrt(dx * dx + dy * dy) > 10) {
                    clearTimeout(_tTimer);
                    _tTimer = null;
                }
            }
        }, {
            passive: true
        });
        document.addEventListener('touchend', (e) => {
            if (_tTimer) {
                clearTimeout(_tTimer);
                _tTimer = null;
            }
            if (_scrubMode) {
                if (e.cancelable) e.preventDefault();
                if (TooltipController.currentTarget) {
                    TooltipController.currentTarget.classList.remove('is-scrub-hovered');
                    if (TooltipController.currentTarget.classList.contains('bbgl-day-cell') && !TooltipController.currentTarget.classList.contains('is-viewing')) TooltipController.currentTarget.classList.remove('shimmer-active');
                    TooltipController.hide();
                }
                _scrubMode = false;
                window._bbglScrubbing = false;
                _exitScrub();
                tSup = Date.now() + 500;
                return;
            }
            _exitScrub();
            const dx = e.changedTouches[0].clientX - _tX,
                dy = e.changedTouches[0].clientY - _tY;
            if (Math.sqrt(dx * dx + dy * dy) > 10) {
                if (TooltipController.currentTarget) TooltipController.hide();
                tSup = Date.now() + 500;
                return;
            }
            const t = TooltipController.resolve(e.target);
            if (t) {
                const h = t.getAttribute('data-tooltip-html'),
                    txt = t.getAttribute('data-tooltip');
                if (h) {
                    if (TooltipController.currentTarget === t) TooltipController.hide();
                } else if (txt) {
                    if (TooltipController.currentTarget === t) TooltipController.hide();
                    else {
                        TooltipController.currentTarget = t;
                        TooltipController.show('<div style="text-align:center; color:#ddd;">' + txt + '</div>', t.getBoundingClientRect());
                    }
                }
            } else if (TooltipController.currentTarget) TooltipController.hide();
            tSup = Date.now() + 500;
        }, {
            passive: false
        });
        document.addEventListener('click', function(e) {
            if (e.target.closest('#bbgl-gym-tab')) {
                e.preventDefault();
                e.stopPropagation();
                togglePanel(true);
                return;
            }
            if (BestGymController.handleTrainClick(e)) return;
            handleGymClick(e);
        }, true);
        handleDomMutation();
        if (localStorage.getItem(KEYS.CHANGELOG_NOTIF) === '1') syncChangelogNotif(true);
        checkViewRouting();
        if (!window.location.hash.includes('gymlog')) handleLayout();
        Log.boot();
        Perf.end('init');
    }

    function installDomHooks() {
        injectStyles();
        const _oI = Node.prototype.insertBefore,
            _oA = Node.prototype.appendChild;
        let _hA = true,
            _navGymDone = false,
            _notesBtnDone = false,
            _uninstallTimer = null,
            _loadHandler = null;
        const needsNavGym = () => userConfig.buttonLocation === 'sidebar' || userConfig.buttonLocation === 'both';
        const needsNotesBtn = () => userConfig.buttonLocation === 'notes' || userConfig.buttonLocation === 'both';

        function forceUninstall() {
            if (!_hA) return;
            Node.prototype.insertBefore = _oI;
            Node.prototype.appendChild = _oA;
            _hA = false;
            if (_uninstallTimer) {
                clearTimeout(_uninstallTimer);
                _uninstallTimer = null;
            }
            if (_loadHandler) {
                window.removeEventListener('load', _loadHandler);
                _loadHandler = null;
            }
        }

        function maybeUninstall() {
            const navOk = !needsNavGym() || _navGymDone;
            const notesOk = !needsNotesBtn() || _notesBtnDone;
            if (navOk && notesOk) forceUninstall();
        }

        function handleNavGym() {
            if (_navGymDone) return;
            _navGymDone = true;
            if (needsNavGym()) Promise.resolve().then(() => {
                if (!document.getElementById(SB_MOBILE.id)) injectSidebarButton(SB_MOBILE, true);
                if (!document.getElementById(SB_DESKTOP.id)) injectSidebarButton(SB_DESKTOP, false);
            });
            maybeUninstall();
        }

        function handleNotesBtn(el) {
            if (_notesBtnDone) return;
            _notesBtnDone = true;
            if (needsNotesBtn()) Promise.resolve().then(() => injectFooterButton(el));
            maybeUninstall();
        }

        function check(n) {
            if (!_hA || !n || n.nodeType !== 1) return;
            try {
                const wantNav = needsNavGym() && !_navGymDone,
                    wantNotes = needsNotesBtn() && !_notesBtnDone;
                if (!wantNav && !wantNotes) return;
                if (wantNav && n.id === 'nav-gym') handleNavGym();
                if (wantNotes && n.id === 'notes_panel_button') handleNotesBtn(n);
                if (!n.firstElementChild) return;
                const stillWantNav = needsNavGym() && !_navGymDone,
                    stillWantNotes = needsNotesBtn() && !_notesBtnDone;
                if (!stillWantNav && !stillWantNotes) return;
                if (n.id && !n.id.startsWith('nav-') && n.id !== 'sidebar') return;
                const sel = (stillWantNav && stillWantNotes) ? '#nav-gym, #notes_panel_button' : stillWantNav ? '#nav-gym' : '#notes_panel_button';
                const hit = n.querySelector(sel);
                if (!hit) return;
                if (hit.id === 'nav-gym') handleNavGym();
                else if (hit.id === 'notes_panel_button') handleNotesBtn(hit);
            } catch (e) {}
        }
        Node.prototype.insertBefore = function(n, r) {
            const res = _oI.call(this, n, r);
            check(n);
            return res;
        };
        Node.prototype.appendChild = function(n) {
            const res = _oA.call(this, n);
            check(n);
            return res;
        };
        const startCountdown = () => {
            if (_uninstallTimer) return;
            _uninstallTimer = setTimeout(forceUninstall, 1000);
        };
        if (document.readyState === 'complete') startCountdown();
        else {
            _loadHandler = () => startCountdown();
            window.addEventListener('load', _loadHandler, {
                once: true
            });
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    setTimeout(() => {
                        if (_hA) forceUninstall();
                    }, 3000);
                }, {
                    once: true
                });
            } else {
                setTimeout(() => {
                    if (_hA) forceUninstall();
                }, 3000);
            }
        }
    }
    installDomHooks();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

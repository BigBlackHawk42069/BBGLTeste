import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { app } from '../../../app-context.js';
import { CONSTANTS } from '../../../core/constants.ts';
import { calendarState, runtime, userConfig, viewState } from '../../../core/state.ts';
import { computeWeekCompletion } from '../../../domain/capsules.ts';
import { Formatter, getISOWeek, getWeekKey } from '../../../domain/time.ts';
import { TOOLTIPS } from '../../templates.js';
import { Raw } from '../html.tsx';
import { useUiTick } from '../store.ts';

type CalCell = { y: number; m: number; d: number; g: boolean };

function buildCells(y: number, m: number): CalCell[] {
  const f = new Date(y, m, 1);
  let start = f.getDay();
  if (userConfig.weekStartMode === 'mon') start = start === 0 ? 6 : start - 1;
  const dim = new Date(y, m + 1, 0).getDate();
  const dipm = new Date(y, m, 0).getDate();
  let pm = m - 1, py = y;
  if (pm < 0) { pm = 11; py--; }
  const cells: CalCell[] = [];
  for (let i = 0; i < start; i++) cells.push({ y: py, m: pm, d: dipm - start + i + 1, g: true });
  for (let d = 1; d <= dim; d++) cells.push({ y, m, d, g: false });
  const rem = 7 - cells.length % 7;
  if (rem < 7 && rem > 0) {
    let nm = m + 1, ny = y;
    if (nm > 11) { nm = 0; ny++; }
    for (let i = 1; i <= rem; i++) cells.push({ y: ny, m: nm, d: i, g: true });
  }
  return cells;
}

function jewelUrls(tier: number): { type: string; url: string } {
  let tType = 'green';
  let url = `${app.CAL_IMG_BASE}}rwrd-grn.png`;
  if (tier === 2) { tType = 'gold'; url = `${app.CAL_IMG_BASE}}rwrd-gold.png`; }
  else if (tier === 3) { tType = 'diamond'; url = `${app.CAL_IMG_BASE}}rwrd-dmnd.png`; }
  return { type: tType, url };
}

function DayCell(props: { z: CalCell; rIdx: number; cIdx: number; archived: boolean }) {
  const { z, rIdx, cIdx, archived } = props;
  const ds = Formatter.dateISO(z.y, z.m, z.d);
  const sl = app.DataController.getSlice('DAY', ds);
  const cellRef = useRef<HTMLDivElement>(null);
  const [shineOn, setShineOn] = useState(false);
  const isToday = ds === Formatter.dateLogical();
  const isViewing = calendarState.selectedLabel === ds || (!calendarState.selectedLabel && isToday);
  const h = app.getActiveHistory();
  const tl = app.DataController.getTimeline();
  const firstDate = tl.length > 0 ? tl[0].date : h ? h.today.date : null;
  const isInteractive = !sl.meta.isGap || (firstDate && ds >= firstDate && ds <= Formatter.dateLogical());

  const sticker = archived && sl.meta.tier > 0 ? app.DataController.getStickerMap().get(ds) : null;
  const featured = !!(sticker && app.DataController._cache.featuredDays && app.DataController._cache.featuredDays.has(ds) && !app.DataController.isStickerCleared(sticker.id));

  function buildShine(el: HTMLDivElement | null) {
    if (!el) return;
    if (archived && sticker) {
      if (el.querySelector('.sticker-shine')) return;
      const sw = el.querySelector('.sticker-wrapper');
      if (!sw) return;
      const ss = document.createElement('div');
      ss.className = 'sticker-shine';
      ss.style.webkitMaskImage = `url("${sticker.url}")`;
      ss.style.maskImage = `url("${sticker.url}")`;
      let grad = `linear-gradient(115deg,rgba(0,200,150,0.55) 0%,rgba(0,255,180,0.65) 20%,rgba(0,255,255,0.7) 35%,rgba(255,255,240,0.75) 50%,rgba(255,0,255,0.85) 65%,rgba(0,150,255,0.9) 80%,rgba(0,200,150,0.85) 100%)`;
      if (sl.meta.tier === 2) grad = `linear-gradient(115deg,rgba(184,134,11,0.7) 0%,rgba(212,175,55,0.85) 11%,rgba(255,255,240,1.0) 13%,rgba(212,175,55,0.8) 15%,rgba(0,255,255,0.7) 35%,rgba(255,0,255,0.85) 65%,rgba(0,150,255,0.9) 80%,rgba(184,134,11,0.85) 100%)`;
      else if (sl.meta.tier === 3) grad = `linear-gradient(115deg,rgba(0,255,255,0.85) 0%,rgba(200,100,255,0.85) 5%,rgba(255,0,255,0.85) 10%,rgba(0,150,255,0.85) 15%,rgba(0,255,255,0.75) 35%,rgba(255,0,255,0.85) 65%,rgba(0,150,255,0.9) 80%,rgba(0,255,255,0.85) 85%,rgba(200,100,255,0.85) 90%,rgba(255,0,255,0.85) 95%,rgba(0,150,255,0.85) 100%)`;
      ss.style.backgroundImage = grad;
      ss.style.mixBlendMode = 'overlay';
      if (sl.meta.tier >= 2) ss.style.filter = 'brightness(1.5)';
      sw.appendChild(ss);
      return;
    }
    if (!archived && sl.meta.tier > 0) {
      const wrap = el.querySelector('.jewel-wrapper');
      if (!wrap || wrap.querySelector('.jewel-shine')) return;
      const { url } = jewelUrls(sl.meta.tier);
      const img = wrap.querySelector('.jewel-asset');
      const sh = document.createElement('div');
      sh.className = 'jewel-shine';
      sh.style.maskImage = `url("${url}")`;
      sh.style.webkitMaskImage = `url("${url}")`;
      if (sl.meta.tier === 2) wrap.appendChild(sh);
      else {
        if (img) wrap.insertBefore(sh, img);
        else wrap.appendChild(sh);
        const so = document.createElement('div');
        so.className = 'jewel-shine-over';
        so.style.setProperty('--jewel-mask', `url("${url}")`);
        wrap.appendChild(so);
      }
    }
  }

  useEffect(() => {
    const el = cellRef.current;
    if (!el) return;
    (el as HTMLDivElement & { _buildShine?: () => void })._buildShine = () => buildShine(el);
    if (isViewing || shineOn) buildShine(el);
  });

  const cls = [
    'bbgl-day-cell',
    archived ? 'is-archived' : '',
    z.g ? 'ghost-cell' : '',
    !archived && sl.meta.tier > 0 ? 'is-plate' : '',
    isViewing ? 'is-viewing' : '',
    (isViewing || shineOn) && userConfig.animations ? 'shimmer-active' : ''
  ].filter(Boolean).join(' ');

  const style: Record<string, string> = {};
  if (archived && sl.meta.tier > 0) {
    let url = `url(${app.CAL_IMG_BASE}}cal-grid-grn.jpg)`;
    if (sl.meta.tier === 2) url = `url(${app.CAL_IMG_BASE}}cal-grid-gold.jpg)`;
    else if (sl.meta.tier === 3) url = `url(${app.CAL_IMG_BASE}}cal-grid-dmnd.jpg)`;
    style.backgroundImage = url;
    style.backgroundSize = '700% 600%';
    style.backgroundPosition = `${(cIdx * (100 / 6)).toFixed(4)}% ${(rIdx * (100 / 5)).toFixed(4)}%`;
  }

  const eventImgs: string[] = [];
  if (archived) {
    const wm = app.getWarMarkers()[ds];
    if ((sl.lsdODs || 0) > 0) eventImgs.push(app.CAL_IMG_BASE + 'lsd-od.png');
    if ((sl.xanaxODs || 0) > 0) eventImgs.push(app.CAL_IMG_BASE + 'xan-od.png');
    if ((sl.exODs || 0) > 0) eventImgs.push('PLACEHOLDER_EX_OD_URL');
    if (wm && wm.warStart) eventImgs.push(app.CAL_IMG_BASE + 'war-strt.png');
    if (wm && wm.warWon) eventImgs.push(app.CAL_IMG_BASE + 'war-win.png');
    if (wm && wm.warLost) eventImgs.push(app.CAL_IMG_BASE + 'war-lost.png');
  }

  const uid = Math.floor(new Date(Date.UTC(z.y, z.m, z.d)).getTime() / 86400000);
  const tipHtml = isInteractive ? app.generateRichTooltip(sl) : undefined;
  const tipPlain = isInteractive ? undefined : TOOLTIPS.CELL_DATE(ds);

  if (isInteractive && viewState.activeViewLabel === ds && calendarState.selectedLabel !== ds) {
    runtime._pendingHistoryRestore = { sl, label: ds };
  }

  return (
    <div
      ref={cellRef}
      id={isToday ? 'active-date-today' : undefined}
      class={cls}
      data-date={ds}
      style={style}
      data-tooltip-html={tipHtml}
      data-tooltip={tipPlain}
      onMouseEnter={() => {
        if (userConfig.animations) {
          setShineOn(true);
          buildShine(cellRef.current);
        }
      }}
      onMouseLeave={() => {
        if (!isViewing) setShineOn(false);
      }}
      onClick={() => {
        if (isToday) app.closeHistory();
        else if (isInteractive) app.openHistory(sl, ds);
      }}
    >
      {!archived && sl.meta.tier > 0 && (() => {
        const j = jewelUrls(sl.meta.tier);
        return (
          <div class={`jewel-wrapper jewel-type-${j.type}`}>
            <img class="jewel-asset" src={j.url} />
          </div>
        );
      })()}
      <span class="day-num">{z.d}</span>
      {eventImgs.map((url, i) => (
        <div
          key={url + i}
          class={'bbgl-event-post-it' + (eventImgs.length > 1 && i === eventImgs.length - 1 ? ' bbgl-event-post-it-top' : '')}
          style={{ backgroundImage: `url('${url}')`, ['--ei' as string]: i, ['--stack-total' as string]: eventImgs.length }}
        />
      ))}
      {sticker && (
        <div
          class={'sticker-wrapper' + (sl.meta.tier === 3 ? ' sticker-tier-diamond' : '')}
          style={{ ['--rot' as string]: `${uid * 17 % 21 - 10}deg` }}
        >
          <img src={sticker.url} class="cell-sticker-deco" />
        </div>
      )}
      {featured && sticker && (
        <div
          class="new-sticker-post-it"
          onClick={e => {
            e.stopPropagation();
            const cell = cellRef.current;
            const pi = e.currentTarget as HTMLDivElement;
            if (cell) {
              cell.style.setProperty('overflow', 'visible', 'important');
              cell.style.setProperty('z-index', '100', 'important');
            }
            pi.classList.add('post-it-rip');
            app.DataController.markStickerCleared(sticker.id);
            setTimeout(() => {
              if (pi.parentNode) pi.remove();
              if (cell) {
                cell.style.removeProperty('overflow');
                cell.style.removeProperty('z-index');
                cell.click();
              }
            }, 600);
          }}
        />
      )}
    </div>
  );
}

function WeeklyBar(props: { batch: { date: string; data: any }[] }) {
  const sl = app.DataController.getSlice('CUSTOM', props.batch.map(w => w.data).filter(Boolean));
  sl.label = `Week ${getISOWeek(props.batch[0].date)}`;
  sl._weekStart = props.batch[0].date;
  sl._weekEnd = props.batch[props.batch.length - 1].date;
  if (!sl._dailyList || sl._dailyList.length === 0) return null;
  const { hjDaySet } = app.DataController.getHappyJumpData();
  const _wk = getWeekKey(sl._dailyList[0].date);
  const installWeekKey = runtime.demoMode ? null : app.getInstallWeekKey();
  const viewing = calendarState.selectedLabel === sl.label;
  if (viewState.activeViewLabel === sl.label && calendarState.selectedLabel !== sl.label) {
    runtime._pendingHistoryRestore = { sl, label: sl.label };
  }
  const preInstall = !!(installWeekKey && _wk < installWeekKey);
  const { capsules, isCompleted } = preInstall
    ? { capsules: ['silver', 'silver', 'silver', 'silver', 'silver'], isCompleted: false }
    : computeWeekCompletion(sl._dailyList, hjDaySet);
  const barHtml = app.buildCapsuleBar(capsules, preInstall ? false : isCompleted, !preInstall && isCompleted && userConfig.animations);
  const tip = app.generateRichTooltip(sl);
  return (
    <div class="bbgl-weekly-anchor">
      <div
        class={'bbgl-weekly-track' + (isCompleted && !preInstall ? ' track-polished' : '') + (viewing ? ' is-viewing' : '')}
        data-label={sl.label}
        data-tooltip-html={tip}
        data-tooltip-anchor=".bbgl-bar-handle"
        onClick={e => { e.stopPropagation(); app.openHistory(sl, sl.label); }}
        dangerouslySetInnerHTML={{ __html: barHtml }}
      />
      <div
        class="bbgl-bar-handle"
        data-pos="start"
        data-tooltip-html={tip}
        data-tooltip-anchor=".bbgl-bar-handle"
        onClick={e => { e.stopPropagation(); app.openHistory(sl, sl.label); }}
        onMouseEnter={e => (e.currentTarget.parentElement?.querySelector('.bbgl-weekly-track') as HTMLElement | null)?.classList.add('is-scrub-hovered')}
        onMouseLeave={e => (e.currentTarget.parentElement?.querySelector('.bbgl-weekly-track') as HTMLElement | null)?.classList.remove('is-scrub-hovered')}
      >
        <Raw html={app.buildChartSVG(sl)} />
      </div>
    </div>
  );
}

export function MonthHeader() {
  useUiTick();
  const [open, setOpen] = useState<null | 'month' | 'year'>(null);
  const monthDrop = useRef<HTMLDivElement>(null);
  const yearDrop = useRef<HTMLDivElement>(null);
  const monthTrig = useRef<HTMLDivElement>(null);
  const yearTrig = useRef<HTMLDivElement>(null);
  const y = calendarState.year;
  const m = calendarState.month;
  const monthSlice = app.DataController.getSlice('MONTH', CONSTANTS.MONTHS[m], y);
  const yearSlice = app.DataController.getSlice('YEAR', String(y));
  const allSlice = app.DataController.getSlice('ALL', 'All-Time');
  const activeL = viewState.activeViewLabel;

  useEffect(() => {
    if (!open) return;
    const d = open === 'month' ? monthDrop.current : yearDrop.current;
    const t = open === 'month' ? monthTrig.current : yearTrig.current;
    if (d && t && typeof app.openDropdown === 'function') app.openDropdown(d, t);
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (d && d.contains(target)) return;
      if (t && t.contains(target)) return;
      setOpen(null);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [open]);

  const years = (() => {
    const s = app.getActiveHistory();
    const ys = new Set<number>();
    (s.history || []).forEach((z: { date: string }) => ys.add(parseInt(z.date.split('-')[0], 10)));
    if (s.today && s.today.date) ys.add(parseInt(s.today.date.split('-')[0], 10));
    return Array.from(ys).sort((a, b) => b - a);
  })();

  return (
    <div class="bbgl-header-wrapper">
      <div class="bbgl-month-header">
        <div class="title-group">
          <div class="title-stack">
            <div class="header-row header-row--alltime">
              <div
                class={'stats-btn' + (activeL === 'All-Time' ? ' active' : '')}
                id="all-time-btn"
                data-tooltip-html={app.generateRichTooltip(allSlice)}
                onClick={e => { e.stopPropagation(); app.calcAllTimeStats(); }}
              >
                <Raw html={app.buildChartSVG(allSlice)} />
              </div>
              <div class="header-trigger" id="all-time-trigger">∞</div>
            </div>
            <div class="header-row header-row--year">
              <div
                class={'stats-btn' + (activeL === String(y) ? ' active' : '')}
                id="year-stats-btn"
                data-tooltip-html={app.generateRichTooltip(yearSlice)}
                onClick={e => { e.stopPropagation(); app.calcPeriodStats('year'); }}
              >
                <Raw html={app.buildChartSVG(yearSlice)} />
              </div>
              <div
                ref={yearTrig}
                class="header-trigger"
                id="year-trigger"
                onClick={e => { e.stopPropagation(); setOpen(open === 'year' ? null : 'year'); }}
              >{y}</div>
              <div ref={yearDrop} id="bbgl-year-dropdown" class={'bbgl-dropdown-menu' + (open === 'year' ? ' show' : '')}>
                {years.map(yr => (
                  <div
                    key={yr}
                    class={'drop-item' + (yr === y ? ' active' : '')}
                    onClick={() => {
                      calendarState.year = yr;
                      setOpen(null);
                      app.renderPanelContent();
                    }}
                  >{yr}</div>
                ))}
              </div>
            </div>
            <div class="header-row header-row--month">
              <div
                class={'stats-btn' + (activeL === CONSTANTS.MONTHS[m] ? ' active' : '')}
                id="month-stats-btn"
                data-tooltip-html={app.generateRichTooltip(monthSlice)}
                onClick={e => { e.stopPropagation(); app.calcPeriodStats('month'); }}
              >
                <Raw html={app.buildChartSVG(monthSlice)} />
              </div>
              <div
                ref={monthTrig}
                class="header-trigger"
                id="month-trigger"
                onClick={e => { e.stopPropagation(); setOpen(open === 'month' ? null : 'month'); }}
              >{CONSTANTS.MONTHS[m]}</div>
              <div ref={monthDrop} id="bbgl-month-dropdown" class={'bbgl-dropdown-menu' + (open === 'month' ? ' show' : '')}>
                {CONSTANTS.MONTHS_SHORT.map((label, i) => (
                  <div
                    key={label}
                    class={'drop-item' + (i === m ? ' active' : '')}
                    onClick={() => {
                      calendarState.month = i;
                      setOpen(null);
                      app.renderPanelContent();
                    }}
                  >{label}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <button type="button" class="arrow-btn" id="prev-month-btn" onClick={() => app.changeMonth(-1)}>❮</button>
        <button type="button" class="arrow-btn" id="next-month-btn" onClick={() => app.changeMonth(1)}>❯</button>
      </div>
    </div>
  );
}

export function CalendarGrid() {
  useUiTick();
  const y = calendarState.year;
  const m = calendarState.month;
  const cells = buildCells(y, m);
  calendarState.visibleCells = cells.map(z => Formatter.dateISO(z.y, z.m, z.d));
  const todayStr = Formatter.dateLogical();
  const rows: CalCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  useEffect(() => {
    const c = document.getElementById('bbgl-cal-container');
    if (!c) return;
    c.style.setProperty('--total-rows', '6');
    c.style.setProperty('--bg-url', `url(${app.CAL_IMG_BASE}cal-grid-futr.jpg)`);
  }, [y, m]);

  return (
    <div
      id="bbgl-cal-container"
      class="bbgl-cal-container"
      style={{ ['--total-rows' as string]: 6, ['--bg-url' as string]: `url(${app.CAL_IMG_BASE}cal-grid-futr.jpg)` }}
    >
      {rows.map((batch, ridx) => {
        const last = batch[6];
        const weekEndStr = Formatter.dateISO(last.y, last.m, last.d);
        const isArch = weekEndStr < todayStr;
        const wdb = batch.map(i => ({ date: Formatter.dateISO(i.y, i.m, i.d), data: app.DataController.getDateMap()[Formatter.dateISO(i.y, i.m, i.d)] || null }));
        return (
          <div key={ridx}>
            <div
              class={'bbgl-row-slice' + (isArch ? ' bbgl-row-archived' : '')}
              style={{
                ['--row-idx' as string]: ridx,
                ...(isArch ? { ['--bg-url' as string]: `url(${app.CAL_IMG_BASE}cal-grid-past.jpg)` } : {})
              }}
            >
              {batch.map((z, cIdx) => (
                <DayCell key={Formatter.dateISO(z.y, z.m, z.d)} z={z} rIdx={ridx} cIdx={cIdx} archived={isArch} />
              ))}
            </div>
            <WeeklyBar batch={wdb} />
          </div>
        );
      })}
    </div>
  );
}

export function WeekRow() {
  useUiTick();
  const weekDays = userConfig.weekStartMode === 'mon'
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return (
    <div class="bbgl-week-row">
      {weekDays.map(d => <span key={d}>{d}</span>)}
    </div>
  );
}

export function CalendarSwipe(props: { children: ComponentChildren }) {
  const start = useRef({ x: 0, y: 0 });
  return (
    <div
      class="calendar-wrapper"
      id="swipe-area"
      onTouchStart={e => { start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={e => {
        if ((window as Window & { _bbglScrubbing?: boolean })._bbglScrubbing) return;
        const dx = e.changedTouches[0].clientX - start.current.x;
        const dy = e.changedTouches[0].clientY - start.current.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) app.changeMonth(dx < 0 ? 1 : -1);
      }}
    >
      {props.children}
    </div>
  );
}

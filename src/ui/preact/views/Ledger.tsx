import { ACH_FMT, ECAN_LOG, ITEM_LOG_META, XANAX_LOG } from '../../../core/constants.ts';
import { calendarState, dom, runtime, userConfig } from '../../../core/state.ts';
import { Formatter } from '../../../domain/time.ts';
import { app } from '../../../app-context.js';
import { Raw } from '../html.tsx';
import { useUiTick } from '../store.ts';

const LABELS: Record<string, string> = {
  STR: 'Strength', DEF: 'Defense', SPD: 'Speed', DEX: 'Dexterity', TOT: 'Total'
};

function fmtR(n: number): string {
  if (!n && n !== 0) return '0';
  const a = Math.abs(n);
  if (a >= 1e15) return (n / 1e15).toFixed(4) + 'q';
  if (a >= 1e12) return (n / 1e12).toFixed(4) + 't';
  if (a >= 1e9) return (n / 1e9).toFixed(4) + 'b';
  if (a >= 100) return Math.round(n).toLocaleString('en-US');
  return n.toFixed(1);
}

function mkTip(r1: number, r2: number, pct: number, sg: string): string {
  return `<div style='text-align:center;line-height:1.6'><div style='margin-bottom:0px'>Growth Rate</div><div style='font-size:0.85em;opacity:0.35;margin-bottom:3px'>(Gains/150E)</div><div>${fmtR(r1)} \u2192 ${fmtR(r2)}</div><div style='font-size:0.85em;color:#aaa'>${sg}${Math.round(pct)}%</div></div>`;
}

function nameOf(c: number): string {
  if (c === 2290) return 'Xanax';
  if (c === 2230) return 'LSD';
  if (c === 2040) return 'Cans';
  if (c === 2190) return 'FHC';
  if (c === 8981) return 'Eggs';
  return (ITEM_LOG_META[c] && ITEM_LOG_META[c].short) || `#${c}`;
}

function shortOf(code: number): string {
  return (ITEM_LOG_META[code] && ITEM_LOG_META[code].short) || `#${code}`;
}

function ItemCounters(props: { sl: any }) {
  const sl = props.sl;
  const items = sl.items || {};
  const isDay = sl.resolution === 'DAY';
  const isAll = sl.resolution === 'ALL';
  const cnt = (code: number) => items[code] || 0;
  const drugCode = userConfig.drugTracker === 'lsd' ? 2230 : XANAX_LOG;
  const secondaryCode = userConfig.drugTracker === 'lsd' ? XANAX_LOG : 2230;
  let drugSub = '';
  if (!isDay) {
    const days = app.DataController.periodCalendarDays(sl);
    const drugAvg = days > 0 ? cnt(drugCode) / days : 0;
    drugSub = sl.resolution === 'ALL' ? '' : `<span class="bbgl-ic-sub">(${drugAvg.toFixed(2)})</span>`;
  }
  const drugTip = `<div style="text-align:center">${nameOf(drugCode)} Taken` + (!isDay && !isAll ? `<br><span class="tt-sub">(Avg/Day)</span>` : ``) + `</div>`;
  const parts: string[] = [];
  parts.push(`<span class="bbgl-ic" data-tooltip-html='${drugTip}'>${shortOf(drugCode)}: ${cnt(drugCode)}${drugSub}</span>`);
  [ECAN_LOG, 2190, secondaryCode, 8981].forEach(code => {
    const c = cnt(code);
    if (c <= 0) return;
    const sub = code === ECAN_LOG && sl.resolution !== 'ALL' ? `<span class="bbgl-ic-sub">(+${Math.round(sl.ecanEnergy || 0)})</span>` : '';
    const dynTip = code === ECAN_LOG
      ? `<div style="text-align:center">Cans Used` + (!isAll ? `<br><span class="tt-sub">(Energy Gained)</span>` : ``) + `</div>`
      : `<div style="text-align:center">${nameOf(code)} Used</div>`;
    parts.push(`<span class="bbgl-ic bbgl-ic-dyn" data-tooltip-html='${dynTip}'>${shortOf(code)}: ${c}${sub}</span>`);
  });
  const refills = cnt(4900);
  const refillVal = isDay ? (refills > 0 ? `<span class="bbgl-ic-yes">✓</span>` : `<span class="bbgl-ic-no">✗</span>`) : `${refills}`;
  parts.push(`<span class="bbgl-ic" data-tooltip-html='<div style="text-align:center">Refills Used</div>'>Refill: ${refillVal}</span>`);
  return <div id="bbgl-item-counters" dangerouslySetInnerHTML={{ __html: parts.join('') }} />;
}

function DateLabel(props: { sl: any }) {
  const sl = props.sl;
  const isExp = !!(dom.panel && (dom.panel.classList.contains('bbgl-expanded') || dom.panel.classList.contains('bbgl-mode-page')));
  let l = '';
  if (sl.resolution === 'WEEK') {
    const start = sl._weekStart || (sl._dailyList && sl._dailyList.length > 0 ? sl._dailyList[0].date : null) || sl.date;
    const end = sl._weekEnd || (sl._dailyList && sl._dailyList.length > 0 ? sl._dailyList[sl._dailyList.length - 1].date : null) || sl.date;
    l = `Week of ${Formatter.dateMonthDay(start)}<span class="view-exp"> - ${Formatter.dateMonthDay(end)}</span>`;
  } else {
    l = isExp ? Formatter.dateFull(sl.label) : Formatter.datePretty(sl.label);
    if (!l) l = sl.label;
    if (sl.resolution === 'MONTH') {
      l = sl.label + ' ' + calendarState.year;
    } else if (sl.resolution !== 'DAY' && sl._dailyList && sl._dailyList.length > 0 && sl.resolution !== 'ALL') {
      const endLabel = Formatter.dateMonthDay(sl._dailyList[sl._dailyList.length - 1].date);
      l += `<span class="view-exp"> (${Formatter.dateMonthDay(sl._dailyList[0].date)} - ${endLabel})</span>`;
    }
  }
  return <div class="ui-floating-label" id="bbgl-date-label" dangerouslySetInnerHTML={{ __html: l }} />;
}

function StatColumn(props: {
  lc: string;
  k: string;
  cl: string;
  sl: any;
  s: any;
  isP: boolean;
  isCurrentPeriod: boolean;
}) {
  const { lc, k, cl, sl, s, isP, isCurrentPeriod } = props;
  const d = s[k];
  const ft = LABELS[lc] || lc;
  let rh: string | ReturnType<typeof Raw> = '';
  let rt = '';
  if (isP && k !== 'total') {
    let th = `<span style="opacity:0.3">--</span>`;
    if (userConfig.ratesEnabled && sl._dailyList && sl._dailyList.length > 0) {
      const _fpd = new Date(sl._dailyList[0].date + 'T00:00:00Z');
      _fpd.setUTCDate(_fpd.getUTCDate() - 1);
      const r1 = app.DataController.getHistoricalRate(_fpd.toISOString().slice(0, 10), k);
      const r2 = app.DataController._hydrate(sl._dailyList[sl._dailyList.length - 1], [], '', 'DAY').stats[k].rate;
      const del = r2 - r1;
      const sg = del >= 0 ? '+' : '';
      const pct = r1 > 0 ? (r2 - r1) / r1 * 100 : 0;
      th = `<div class="rates-group" style="display:flex;flex-direction:column;align-items:center;line-height:1.1"><span>${sg}${Formatter.achAbbr(del, ACH_FMT.compact)}</span><span class="view-exp rate-pct" style="font-size:0.8em;opacity:0.7;margin-top:2px;margin-bottom:-2px;">(${sg}${Formatter.ratePct(pct)}%)</span></div>`;
      rt = mkTip(r1, r2, pct, sg);
    }
    rh = userConfig.ratesEnabled ? th : '';
  } else if (userConfig.ratesEnabled && k !== 'total') {
    const _pd = new Date(sl.date + 'T00:00:00Z');
    _pd.setUTCDate(_pd.getUTCDate() - 1);
    const r1 = app.DataController.getHistoricalRate(_pd.toISOString().slice(0, 10), k);
    const r2 = d.rate;
    const del = r2 - r1;
    const sg = del >= 0 ? '+' : '';
    const pct = r1 > 0 ? del / r1 * 100 : 0;
    rh = Formatter.dual(d.rate, true);
    rt = mkTip(r1, r2, pct, sg);
  } else {
    rh = userConfig.ratesEnabled ? Formatter.dual(d.rate, true) : '';
    rt = 'Growth Rate (Gains / 150E)';
  }

  function onCopy(e: Event) {
    const col = (e.currentTarget as HTMLElement).closest('.stat-column') as HTMLElement | null;
    if (!col || !s[k]) return;
    const txt = app.buildSessionText(sl, s, [k]);
    navigator.clipboard.writeText(txt).then(() => app.flashCopied(col));
  }

  return (
    <div class="stat-column" data-copy-stat={k}>
      <div class="col-header cell-stack">
        <div class={`l-top c-label ${cl} bbgl-copy-label`} data-tooltip={`Click to copy ${ft} data`} style={{ cursor: 'pointer' }} onClick={onCopy}>
          <span class="view-std">{lc}</span>
          <span class="view-exp">{ft}</span>
        </div>
        <div class="l-bot" data-tooltip={isP ? `Energy Used on ${ft}` : 'Energy Used'}>{Formatter.dual(d.cost)} E</div>
      </div>
      <div class="bbgl-spacer" />
      <div class="col-data-block cell-stack c-gain">
        <div class="l-top" data-tooltip={`${ft} Gained`}>+{Formatter.dual(d.gain)}</div>
        <div class="l-bot" data-tooltip={rt}>{typeof rh === 'string' && rh.includes('<') ? <Raw html={rh} /> : rh}</div>
      </div>
      <div class="bbgl-spacer" />
      <div class="col-data-block cell-stack c-total">
        <div class="l-top" data-tooltip={`${isCurrentPeriod ? 'Current' : 'Ending'} ${ft}`}>{Formatter.dual(d.end)}</div>
        <div class="l-bot" data-tooltip={`Starting ${ft}`}>{Formatter.dual(d.start)}</div>
      </div>
    </div>
  );
}

export function LedgerChrome() {
  useUiTick();
  const current = runtime.currentStats as { sl?: any; s?: any } | null;
  let sl = current && current.sl;
  if (!sl) {
    sl = calendarState.selectedData || (typeof app.getActiveHistory === 'function' ? app.getActiveHistory().today : null);
  }
  if (sl && !sl.stats && typeof app.DataController?._hydrate === 'function') {
    sl = app.DataController._hydrate(sl, [], sl.label || calendarState.selectedLabel, 'DAY');
  }
  if (!sl || !sl.stats) {
    return (
      <>
        <div id="bbgl-item-counters" />
        <div class="ui-floating-label" id="bbgl-date-label">LOADING...</div>
        <div class="ui-floating-summary" id="bbgl-summary-label" />
        <div id="bbgl-ledger-view" class="ledger-content" />
      </>
    );
  }
  const s = sl.stats;
  runtime.currentStats = { sl, s };
  const isP = sl.resolution !== 'DAY';
  const todayStr = Formatter.dateLogical();
  const slLastDate = sl._dailyList && sl._dailyList.length > 0 ? sl._dailyList[sl._dailyList.length - 1].date : sl.date;
  const isCurrentPeriod = sl.resolution === 'ALL' || slLastDate >= todayStr;
  return (
    <>
      <ItemCounters sl={sl} />
      <DateLabel sl={sl} />
      <div class="ui-floating-summary" id="bbgl-summary-label">
        Total E: {Formatter.dual(s.total.cost)} <span style={{ opacity: 0.3, margin: '0 6px' }}>|</span> Total Gains: {Formatter.dual(s.total.gain)}
      </div>
      <div id="bbgl-ledger-view" class="ledger-content">
        <StatColumn lc="STR" k="str" cl="t-str" sl={sl} s={s} isP={isP} isCurrentPeriod={isCurrentPeriod} />
        <StatColumn lc="DEF" k="def" cl="t-def" sl={sl} s={s} isP={isP} isCurrentPeriod={isCurrentPeriod} />
        <StatColumn lc="SPD" k="spd" cl="t-spd" sl={sl} s={s} isP={isP} isCurrentPeriod={isCurrentPeriod} />
        <StatColumn lc="DEX" k="dex" cl="t-dex" sl={sl} s={s} isP={isP} isCurrentPeriod={isCurrentPeriod} />
      </div>
    </>
  );
}

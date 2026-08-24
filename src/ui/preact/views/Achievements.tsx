import { useEffect, useRef } from 'preact/hooks';
import { app } from '../../../app-context.js';
import {
  ACH_FMT, EX_OD_LOG, HAPPY_LOGS, ITEM_LOG_META,
  LSD_OD_LOG, XANAX_OD_LOG
} from '../../../core/constants.ts';
import { CUSTOM_STICKERS } from '../../assets.ts';
import { calendarState, runtime, saveViewState, viewState } from '../../../core/state.ts';
import { Formatter } from '../../../domain/time.ts';
import { Raw } from '../html.tsx';
import { useUiTick } from '../store.ts';

type AchData = any;
type AchRowData = {
  label: string;
  key?: string;
  sub?: string;
  statClass?: string;
  tip?: string;
  clipDate?: string;
  dualHtml?: string;
  display?: string;
  rawVal?: string;
};

const STATS = ['str', 'def', 'spd', 'dex'] as const;
const STAT_LABEL = { str: 'Strength', def: 'Defense', spd: 'Speed', dex: 'Dexterity' };
const COPY_TIP = 'Click any stat or row to copy its data, or click this title to copy the entire section to your clipboard.';

function ensureAchievements() {
  if (!runtime._achCache && typeof app.computeAchievements === 'function') {
    runtime._achCache = app.computeAchievements(app.getActiveHistory());
    runtime._achPage = viewState.achPage || 0;
  }
  return runtime._achCache as AchData;
}

function NullVal() {
  return <span class="ach-null">—</span>;
}

function AchRow(r: AchRowData) {
  const isFx = !!(r.statClass && r.statClass.startsWith('ach-fx-'));
  const valCls = isFx && r.statClass ? ' ' + r.statClass : '';
  const subCls = !isFx && r.statClass ? ' ' + r.statClass : '';
  const val = r.dualHtml
    ? <Raw html={r.dualHtml} />
    : (r.display === '—' || r.display === '\u2014')
      ? <NullVal />
      : r.display;
  return (
    <div
      class="bbgl-ach-row"
      data-tooltip={r.tip || undefined}
      data-ach-key={r.key || ''}
      data-clip={`${r.label}: ${r.rawVal}`}
      data-clip-date={r.clipDate || ''}
    >
      <div class="ach-row-main">
        <div class="ach-k-stack">
          <span class="ach-k">{r.label}:</span>
          {r.clipDate ? <div class="ach-date">{r.clipDate}</div> : null}
        </div>
        <div class="ach-v-wrap">
          {r.sub ? <span class={'ach-sub' + subCls}>{r.sub}</span> : null}
          <span class={'ach-value' + valCls}>{val}</span>
        </div>
      </div>
    </div>
  );
}

function splitCols<T>(rows: T[], colCount: number): T[][] {
  const rpc = rows.length ? Math.ceil(rows.length / colCount) : 0;
  return Array.from({ length: colCount }, (_, ci) => {
    const chunk: T[] = [];
    for (let r = 0; r < rpc; r++) {
      const i = ci * rpc + r;
      if (i < rows.length) chunk.push(rows[i]);
    }
    return chunk;
  });
}

function AchSection(props: { title: string; sectionKey: string; rows: AchRowData[]; colCount?: number; clipAll?: string }) {
  const cols = splitCols(props.rows, props.colCount || 4);
  const clipAll = props.clipAll || props.rows.map(r => r.clipDate ? `${r.label}: ${r.rawVal} (${r.clipDate})` : `${r.label}: ${r.rawVal}`).join('\n');
  const colCount = props.colCount || 4;
  return (
    <div class="bbgl-ach-section">
      <div class="bbgl-ach-title-row">
        <span
          class="bbgl-ach-section-title"
          data-ach-section={props.sectionKey}
          data-clip-section={clipAll}
          data-clip-title={props.title}
          data-tooltip={COPY_TIP}
        >{props.title}</span>
      </div>
      <div class="bbgl-ach-cols" style={colCount !== 4 ? { gridTemplateColumns: `repeat(${colCount},minmax(0,1fr))` } : undefined}>
        {cols.map((chunk, i) => (
          <div key={i} class="bbgl-ach-col">{chunk.map(r => <AchRow key={r.key || r.label} {...r} />)}</div>
        ))}
      </div>
    </div>
  );
}

function Page0(d: AchData) {
  const ps = d.perStatBest || { bestTrain: {}, bestDay: {}, bestWeek: {}, bestMonth: {} };
  const rows = [
    { key: 'best-train', short: 'Single Train', long: 'Highest Single Train', tip: 'Highest gains achieved from a single click, per individual stat.', recs: ps.bestTrain, getDate: (r: any) => app.achFmtDate(r.date), getTime: (r: any) => r.ts ? app.achFmtTimeHMS(r.ts) : '' },
    { key: 'best-day', short: 'Best Day', long: 'Best Training Day', tip: 'Highest gains achieved in a single calendar day, per individual stat.', recs: ps.bestDay, getDate: (r: any) => app.achFmtDate(r.date) },
    { key: 'best-week', short: 'Best Week', long: 'Best Training Week', tip: 'Highest gains achieved in a single calendar week, per individual stat.', recs: ps.bestWeek, getDate: (r: any) => app.achFmtWeekShort(r.weekOf) },
    { key: 'best-month', short: 'Best Month', long: 'Best Month', tip: 'Highest gains achieved in a single calendar month, per individual stat.', recs: ps.bestMonth, getDate: (r: any) => app.achFmtMonthLong(r.rawMonth) }
  ];
  return (
    <div class="bbgl-ach-section bbgl-ach-section-page0">
      <div class="bbgl-ach-grid-header">
        <div class="ach-grid-label-area">
          <span class="bbgl-ach-section-title" data-ach-section="greatest-gains" data-clip-title="Greatest Gains" data-tooltip={COPY_TIP}>Greatest Gains</span>
        </div>
        {STATS.map(sk => (
          <div key={sk} class={`ach-stat-header ach-stat-${sk} bbgl-ach-col-copy`} data-stat={sk} data-tooltip={`Click to copy ${STAT_LABEL[sk]} column`} style={{ cursor: 'pointer' }}>{STAT_LABEL[sk]}</div>
        ))}
      </div>
      {rows.map(r => (
        <div key={r.key} class="bbgl-ach-row bbgl-ach-row-multi" data-ach-key={r.key} data-tooltip={r.tip}>
          <div class="ach-grid-label-area">
            <div class="ach-k">
              <span class="ach-title-short">{r.short}</span>
              <span class="ach-title-long">{r.long}</span>
            </div>
          </div>
          {STATS.map(sk => {
            const rec = r.recs ? r.recs[sk] : null;
            return (
              <div key={sk} class="bbgl-ach-stat-cell" data-ach-key={r.key} data-stat={sk}>
                <span class="ach-value">{rec ? <Raw html={'+' + Formatter.dual(rec.value)} /> : <NullVal />}</span>
                {rec ? <div class="ach-date">{r.getDate(rec)}</div> : null}
                {rec && r.getTime ? <div class="ach-time">{r.getTime(rec)}</div> : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Page1(d: AchData) {
  const rows = [
    { key: 'training-streak', short: 'Best Streak', long: 'Best Training Streak', tip: 'Total stats gained during your longest consecutive training streak.', len: d.longestStreak, start: d.longestStreakStart, end: d.longestStreakEnd, gains: d.longestStreakGains },
    { key: 'green-streak', short: 'Best Green', long: 'Best Green Streak', tip: 'Total stats gained during your longest streak of achieving at least Green (1,000E+).', len: d.longestGoalStreak, start: d.longestGoalStreakStart, end: d.longestGoalStreakEnd, gains: d.longestGoalStreakGains },
    { key: 'gold-streak', short: 'Best Gold', long: 'Best Gold Streak', tip: 'Total stats gained during your longest streak of achieving at least Gold (1,500E+).', len: d.longestGoldStreak, start: d.longestGoldStreakStart, end: d.longestGoldStreakEnd, gains: d.longestGoldStreakGains },
    { key: 'diamond-streak', short: 'Best Diamond', long: 'Best Diamond Streak', tip: 'Total stats gained during your longest streak of achieving Diamond (2,000E+).', len: d.longestDiamondStreak, start: d.longestDiamondStreakStart, end: d.longestDiamondStreakEnd, gains: d.longestDiamondStreakGains }
  ];
  const consVal = d.trainingRestRatio || '—';
  const consDaysLong = '(' + (d.trainingDays || 0) + '/' + (d.calDays || 0) + ' Days)';
  return (
    <div class="bbgl-ach-section bbgl-ach-section-page0 bbgl-ach-section-page1">
      <div class="bbgl-ach-grid-header">
        <div class="ach-grid-label-area">
          <span class="bbgl-ach-section-title" data-ach-section="sexiest-streaks" data-clip-title="Sexiest Streaks" data-tooltip={COPY_TIP}>SEXIEST STREAKS</span>
        </div>
        {STATS.map(sk => <div key={sk} class={`ach-stat-header ach-stat-${sk}`}>{STAT_LABEL[sk]}</div>)}
        <div class="ach-stat-header ach-stat-tot">Total</div>
      </div>
      {rows.map(r => {
        const present = r.gains ? STATS.filter(sk => (r.gains[sk] || 0) > 0) : [];
        const total = present.reduce((a, sk) => a + (r.gains[sk] || 0), 0);
        const dateText = r.start && r.end ? app.achFmtStreakRange(r.start, r.end) : '—';
        return (
          <div key={r.key} class="bbgl-ach-row bbgl-ach-row-multi" data-ach-key={r.key} data-tooltip={r.tip}>
            <div class="ach-grid-label-area">
              <div class="ach-k">
                <span class="ach-title-short">{r.short}</span>
                <span class="ach-title-long">{r.long}</span>
                {r.len ? <span class="ach-streak-days ach-streak-days-inline"> · {r.len}d</span> : null}
                {r.start && r.end ? <span class="bbgl-ach-streak-date-inline">&nbsp;&nbsp;{dateText}</span> : null}
              </div>
            </div>
            {STATS.map(sk => {
              const v = r.gains && r.gains[sk] || 0;
              return (
                <div key={sk} class="bbgl-ach-stat-cell" data-ach-key={r.key} data-stat={sk}>
                  <span class="ach-value">{v > 0 ? '+' + app.achFmtGain(v) : <NullVal />}</span>
                </div>
              );
            })}
            <div class="bbgl-ach-stat-cell bbgl-ach-stat-cell-total" data-ach-key={r.key} data-stat="total">
              <span class="ach-value ach-stat-tot">{total > 0 ? '+' + app.achFmtGain(total) : <NullVal />}</span>
            </div>
            <div class="ach-date ach-streak-date">
              <span class="ach-streak-days">{r.len ? r.len + 'd' : '—'}</span>
              <span class="ach-streak-sep">•</span>
              <span class="ach-streak-daterange">{dateText}</span>
            </div>
          </div>
        );
      })}
      <div class="bbgl-ach-row bbgl-ach-row-multi bbgl-ach-consistency-row" data-ach-key="consistency" data-tooltip="Your lifetime ratio of active training days versus total calendar days.">
        <div class="bbgl-ach-consistency-text">
          Training Consistency: <span class="ach-cons-val">{consVal}</span> <span class="ach-cons-days">{consDaysLong}</span>
        </div>
      </div>
    </div>
  );
}

function PageOverview(d: AchData) {
  const enh = d.statEnhByStat || {};
  const enrg = d.energyItemTotals || {};
  const od = d.odItemTotals || {};
  const STAT_ABBR = { str: 'Str', def: 'Def', spd: 'Spd', dex: 'Dex' };
  const isExpanded = typeof app.achIsExpandedMode === 'function' ? app.achIsExpandedMode() : false;
  const STAT_ENH_MAP: Record<number, 'str' | 'def' | 'spd' | 'dex'> = { 2150: 'str', 2130: 'spd', 2140: 'def', 2120: 'dex' };
  const LEFT_COL = [2150, 2130, 2290, 2040, 4900];
  const RIGHT_COL = [2140, 2120, 2230, 2190, 8981];
  const OD_AFTER: Record<number, number> = { 2290: XANAX_OD_LOG, 2230: LSD_OD_LOG };
  const isPeriod = !!viewState.achEnhPeriodMode;

  function EnhRow({ id }: { id: number }) {
    const meta = ITEM_LOG_META[id];
    const label = meta.achLabel || meta.label;
    const tipLabel = meta.achTipLabel || label;
    const sk = STAT_ENH_MAP[id];
    let countNode, gainedNode, clipVal, tip;
    if (sk) {
      const rec = enh[sk] || { count: 0, gain: 0 };
      countNode = rec.count > 0 ? Formatter.number(rec.count) : <NullVal />;
      const gainNum = rec.gain > 0 ? '+' + Formatter.achAbbr(rec.gain, ACH_FMT.enhancers) : null;
      gainedNode = <>{gainNum || <NullVal />} <span class={`ach-stat-${sk}`}>{STAT_ABBR[sk]}</span></>;
      clipVal = `${label}: ${rec.count} (+${Formatter.achAbbr(rec.gain, ACH_FMT.enhancers)} ${STAT_ABBR[sk]})`;
      tip = isExpanded ? `Amount of ${tipLabel} · ${app.achStatFull(sk)} Gained` : `Amount of ${tipLabel}`;
    } else {
      const rec = enrg[id] || { count: 0, energy: 0 };
      countNode = rec.count > 0 ? Formatter.number(rec.count) : <NullVal />;
      const gainNum = rec.energy > 0 ? '+' + Formatter.achAbbr(rec.energy, ACH_FMT.enhancers) : null;
      gainedNode = <>{gainNum || <NullVal />} <span class="ach-enh-e-label">E</span></>;
      clipVal = `${label}: ${rec.count} (+${Formatter.achAbbr(rec.energy, ACH_FMT.enhancers)} Energy)`;
      tip = isExpanded ? `Amount of ${tipLabel} · Energy Gained` : `Amount of ${tipLabel}`;
    }
    const odId = OD_AFTER[id];
    const odRec = odId ? od[odId] : null;
    return (
      <>
        <div class="bbgl-ach-row bbgl-ach-enh-row" data-tooltip={tip} data-ach-key={`enh-${id}`} data-clip={clipVal}>
          <div class="ach-row-main">
            <div class="ach-k-stack"><span class="ach-k"><span class="ach-title-long">{label}:</span><span class="ach-title-short">{label}:</span></span></div>
            <div class="ach-v-wrap">
              <span class="ach-value">{countNode}</span>
              <span class="ach-value ach-enh-gained">{gainedNode}</span>
            </div>
          </div>
        </div>
        {odId && odRec && odRec.count > 0 ? <OdSubRow odId={odId} rec={odRec} isExpanded={isExpanded} /> : null}
      </>
    );
  }

  const clipAll = [...LEFT_COL, ...RIGHT_COL].map(id => {
    const meta = ITEM_LOG_META[id];
    const label = meta.achLabel || meta.label;
    const sk = STAT_ENH_MAP[id];
    if (sk) {
      const rec = enh[sk] || { count: 0, gain: 0 };
      return `${label}: ${rec.count} (+${Formatter.achAbbr(rec.gain, ACH_FMT.enhancers)} ${STAT_ABBR[sk]})`;
    }
    const rec = enrg[id] || { count: 0, energy: 0 };
    return `${label}: ${rec.count} (+${Formatter.achAbbr(rec.energy, ACH_FMT.enhancers)} Energy)`;
  }).join('\n');

  return (
    <div class="bbgl-ach-section bbgl-ach-section-energy">
      <div class="bbgl-ach-title-row">
        <span class="bbgl-ach-section-title" data-ach-section="endocrine-enhancers" data-clip-section={clipAll} data-clip-title="Endocrine Enhancers" data-tooltip="Click any row to copy its data, or click this title to copy the entire section to your clipboard.">ENDOCRINE ENHANCERS</span>
        <div
          class="bbgl-enh-mode-switch"
          data-tooltip-html="<b>Changes the data scope displayed on this page.</b><br><i><b>All-Time</b> shows totals across your entire log history. <b>Selected</b> shows data for the selected period on the calendar.</i>"
          data-tooltip-side="left"
        >
          <span class={'bbgl-enh-sw-opt' + (isPeriod ? '' : ' active')} data-mode="alltime">All-Time</span>
          <span class={'bbgl-enh-sw-opt' + (isPeriod ? ' active' : '')} data-mode="selected">Selected</span>
        </div>
      </div>
      <div class="bbgl-ach-cols" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
        <div class="bbgl-ach-col">{LEFT_COL.map(id => <EnhRow key={id} id={id} />)}</div>
        <div class="bbgl-ach-col">{RIGHT_COL.map(rid => <EnhRow key={rid} id={rid} />)}</div>
      </div>
    </div>
  );
}

function OdSubRow(props: { odId: number; rec: any; isExpanded: boolean }) {
  const meta = ITEM_LOG_META[props.odId];
  const rec = props.rec || { count: 0, energyLost: 0 };
  const countNode = rec.count > 0 ? Formatter.number(rec.count) : <NullVal />;
  const lostNum = rec.energyLost > 0 ? '-' + Formatter.number(rec.energyLost) : null;
  const odLabel = app.achOdLabel(meta.label);
  const tip = props.isExpanded ? `Amount of ${odLabel} · Energy Lost` : `Amount of ${odLabel}`;
  const clipVal = `${meta.label}: ${rec.count} (-${Formatter.number(rec.energyLost)} Energy Lost)`;
  return (
    <div class="bbgl-ach-row bbgl-ach-enh-row bbgl-ach-od-row bbgl-subgroup-row bbgl-subgroup-row-last" data-tooltip={tip} data-ach-key={`enh-${props.odId}`} data-clip={clipVal}>
      <div class="ach-row-main">
        <div class="ach-k-stack"><span class="ach-k"><span class="ach-title-long">ODs:</span><span class="ach-title-short">ODs:</span></span></div>
        <div class="ach-v-wrap">
          <span class="ach-value">{countNode}</span>
          <span class="ach-value ach-enh-gained ach-enh-od">{lostNum || <NullVal />} <span class="ach-enh-e-label">E</span></span>
        </div>
      </div>
    </div>
  );
}

function PageHappy(d: AchData) {
  const STAT_ABBR = { str: 'STR', def: 'DEF', spd: 'SPD', dex: 'DEX' };
  const STAT_FULL = { str: 'Strength', def: 'Defense', spd: 'Speed', dex: 'Dexterity' };
  const isExpanded = typeof app.achIsExpandedMode === 'function' ? app.achIsExpandedMode() : false;
  const rec = d.bestHappyJump && d.bestHappyJump.total;
  const hjCount = d.happyJumps || 0;
  const trained = rec && rec.stats ? STATS.filter(sk => (rec.stats[sk] || 0) > 0) : [];
  const clipParts = trained.map(sk => STAT_ABBR[sk] + ': +' + app.achFmtGain(rec.stats[sk]));
  if (rec) clipParts.push('Total: +' + app.achFmtGain(rec.value));
  const dateStr = rec ? app.achFmtDate(rec.date) : '';
  const timeStr = rec ? app.achFmtTimeHM(rec.ts) + ' – ' + app.achFmtTimeHM(rec.tsEnd || rec.ts) + ' ' + app.achTimeZoneSuffix() : '';
  const timeStrClip = rec ? app.achFmtTimeHMClip(rec.ts) + ' – ' + app.achFmtTimeHMClip(rec.tsEnd || rec.ts) + ' TCT' : '';
  const bestClip = rec && rec.stats
    ? `Best Happy Jump (${dateStr}, ${timeStrClip}): ${clipParts.join(' | ')}`
    : '';

  const hhOrder: Record<number, number> = { 2180: 1, 2210: 2, 2020: 3, 8983: 4 };
  const helpers = HAPPY_LOGS.map(id => {
    const recH = (d.happyItemTotals && d.happyItemTotals[id]) || { count: 0, happy: 0 };
    const meta = ITEM_LOG_META[id];
    return { id, label: meta.achLabel || meta.label, short: meta.short || meta.label, count: recH.count, happy: recH.happy };
  }).filter(h => h.count > 0).sort((a, b) => (hhOrder[a.id] || 99) - (hhOrder[b.id] || 99));
  const clipHelpers = helpers.map(h => `${h.label}: ${h.count} (${Formatter.number(h.happy)} Happy)`).join('\n');
  let clipAll = `Happy Jumps Performed: ${hjCount}\nBest Happy Jump: ${rec && rec.stats ? clipParts.join(' | ') : '—'}`;
  if (helpers.length) clipAll += '\n\n— Happy Helpers —\n' + clipHelpers;
  const helperCols = splitCols(helpers, 2);

  return (
    <div class="bbgl-ach-section bbgl-ach-section-hh">
      <div class="bbgl-ach-title-row">
        <span class="bbgl-ach-section-title" data-ach-section="happy-hopping" data-clip-section={clipAll} data-clip-title="Happy Hopping" data-tooltip={COPY_TIP}>HAPPY HOPPING</span>
      </div>
      <div class="bbgl-ach-hh-group" data-ach-key="happy-jumps-group">
        <div
          class="bbgl-ach-row"
          data-tooltip-html="Total number of Happy Jumps performed.<br><i>HJ = 1000E+ spent within 15m of using Ecstasy</i>"
          data-ach-key="hj-count"
          data-clip={`Happy Jumps Performed: ${hjCount}`}
        >
          <div class="ach-row-main">
            <div class="ach-k-stack"><span class="ach-k"><span class="ach-title-long">Happy Jumps Performed</span><span class="ach-title-short">Happy Jumps</span>:</span></div>
            <div class="ach-v-wrap"><span class="ach-value">{String(hjCount)}</span></div>
          </div>
        </div>
        {rec && rec.stats ? (
          <div class="bbgl-ach-hh-best-row" data-tooltip="The single Happy Jump that yielded the highest combined stat gain." data-ach-key="best-hj" data-clip={bestClip} data-clip-date={`${dateStr}  ${timeStrClip}`}>
            <div class="bbgl-ach-hh-label">
              <span class="ach-k"><span class="ach-title-long">Best Happy Jump</span><span class="ach-title-short">Best Jump</span></span>
              <div class="bbgl-ach-hh-date-line">{dateStr}<span class="bbgl-ach-hh-time"> &nbsp; {timeStr}</span></div>
            </div>
            <div class="bbgl-ach-hh-cells">
              {trained.map(sk => (
                <div key={sk} class="bbgl-ach-hh-cell bbgl-ach-hh-cell-stat bbgl-ach-stat-cell" data-ach-key="best-hj" data-stat={sk} data-tooltip={`Total ${STAT_FULL[sk]} gained during this jump.`}>
                  <span class="bbgl-ach-hh-val">+{app.achFmtGain(rec.stats[sk])}</span>
                  <span class={`bbgl-ach-hh-tag ach-stat-${sk}`}>{STAT_ABBR[sk]}</span>
                </div>
              ))}
              <div class="bbgl-ach-hh-cell bbgl-ach-hh-cell-total bbgl-ach-stat-cell" data-ach-key="best-hj" data-stat="total" data-tooltip="Total overall stats gained during this jump.">
                <span class="bbgl-ach-hh-tag ach-stat-tot">Total</span>
                <span class="bbgl-ach-hh-val">+{app.achFmtGain(rec.value)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div class="bbgl-ach-hh-best-row" data-tooltip="The single Happy Jump that yielded the highest combined stat gain." data-ach-key="best-hj">
            <div class="bbgl-ach-hh-label">
              <span class="ach-k"><span class="ach-title-long">Best Happy Jump</span><span class="ach-title-short">Best Jump</span></span>
              <div class="bbgl-ach-hh-date-line"><span class="ach-null">No jumps recorded yet</span></div>
            </div>
            <div class="bbgl-ach-hh-cells">
              <div class="bbgl-ach-hh-cell bbgl-ach-hh-cell-total">
                <span class="bbgl-ach-hh-tag ach-stat-tot">Total</span>
                <span class="bbgl-ach-hh-val"><NullVal /></span>
              </div>
            </div>
          </div>
        )}
      </div>
      {helpers.length ? (
        <div class="bbgl-ach-cols" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))', paddingTop: 1, paddingBottom: 0 }}>
          {helperCols.map((chunk, i) => (
            <div key={i} class="bbgl-ach-col">
              {chunk.map(h => {
                const tip = isExpanded ? `Amount of ${h.label} · Happy Gained` : `Amount of ${h.label}`;
                const clipVal = `${h.label}: ${h.count} (${Formatter.number(h.happy)} Happy)`;
                const exRec = h.id === 2210 && d.odItemTotals && d.odItemTotals[EX_OD_LOG] && d.odItemTotals[EX_OD_LOG].count > 0 ? d.odItemTotals[EX_OD_LOG] : null;
                return (
                  <>
                    <div class="bbgl-ach-row" data-tooltip={tip} data-ach-key={`happy-helper-${h.id}`} data-clip={clipVal}>
                      <div class="ach-row-main">
                        <div class="ach-k-stack"><span class="ach-k"><span class="ach-title-long">{h.label}</span><span class="ach-title-short">{h.short}</span>:</span></div>
                        <div class="ach-v-wrap">
                          <span class="ach-value">{Formatter.number(h.count)}</span>
                          <span class="ach-value ach-happy-col">+{app.achFmtGain(h.happy)} <span class="ach-happy-word">H</span></span>
                        </div>
                      </div>
                    </div>
                    {exRec ? (
                      <div
                        class="bbgl-ach-row bbgl-ach-od-row bbgl-subgroup-row bbgl-subgroup-row-last"
                        data-tooltip={isExpanded ? `Amount of ${app.achOdLabel(ITEM_LOG_META[EX_OD_LOG].label)} · Happy / Energy Lost` : `Amount of ${app.achOdLabel(ITEM_LOG_META[EX_OD_LOG].label)}`}
                        data-ach-key={`happy-od-${EX_OD_LOG}`}
                        data-clip={`${ITEM_LOG_META[EX_OD_LOG].label}: ${exRec.count} (-${Formatter.number(exRec.happyLost)} H, -${Formatter.number(exRec.energyLost)} E)`}
                      >
                        <div class="ach-row-main" style={{ alignItems: 'flex-start' }}>
                          <div class="ach-k-stack"><span class="ach-k"><span class="ach-title-long">ODs:</span><span class="ach-title-short">ODs:</span></span></div>
                          <div class="ach-v-wrap" style={{ alignItems: 'flex-start' }}>
                            <span class="ach-value" style={{ paddingTop: 1 }}>{Formatter.number(exRec.count)}</span>
                            <span class="ach-value ach-happy-col ach-enh-od">
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, lineHeight: 1.2 }}>
                                <div>{exRec.happyLost > 0 ? '-' + Formatter.number(exRec.happyLost) : <NullVal />} <span class="ach-happy-word ach-od-happy-word">H</span></div>
                                <div>{exRec.energyLost > 0 ? '-' + Formatter.number(exRec.energyLost) : <NullVal />} <span class="ach-enh-e-label" style={{ color: '#c06060' }}>E</span></div>
                              </div>
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PageRewards(d: AchData) {
  const rows: AchRowData[] = [
    { label: 'Green Days', key: 'green-days', display: String(d.greenDays || 0), rawVal: String(d.greenDays || 0), statClass: 'ach-fx-green', tip: 'Total days where the minimum daily goal (Green: 1,000E+) was achieved.' },
    { label: 'Gold Days', key: 'gold-days', display: String(d.goldDays || 0), rawVal: String(d.goldDays || 0), statClass: 'ach-fx-gold', tip: 'Total days where the elite daily goal (Gold: 1,500E+) was achieved.' },
    { label: 'Diamond Days', key: 'diamond-days', display: String(d.diamondDays || 0), rawVal: String(d.diamondDays || 0), statClass: 'ach-fx-diamond', tip: 'Total days where the ultimate daily goal (Diamond: 2,000E+) was achieved.' },
    { label: 'Stickers Unlocked', key: 'stickers', display: (d.stickersUnlocked || 0) + '/' + CUSTOM_STICKERS.length, rawVal: (d.stickersUnlocked || 0) + '/' + CUSTOM_STICKERS.length, statClass: 'ach-fx-holo', tip: 'Total unique milestone stickers earned through consistent training.' },
    { label: 'Green Weeks', key: 'green-weeks', display: String(d.greenWeeks || 0), rawVal: String(d.greenWeeks || 0), statClass: 'ach-fx-green', tip: 'Total weeks where the minimum weekly training goal was met.' },
    { label: 'Gold Weeks', key: 'gold-weeks', display: String(d.goldWeeks || 0), rawVal: String(d.goldWeeks || 0), statClass: 'ach-fx-gold', tip: 'Total weeks where the elite weekly training goal was met.' },
    { label: 'Diamond Weeks', key: 'diamond-weeks', display: String(d.diamondWeeks || 0), rawVal: String(d.diamondWeeks || 0), statClass: 'ach-fx-diamond', tip: 'Total weeks where the ultimate weekly training goal was met.' }
  ];
  return <AchSection title="Rewards Reaped" sectionKey="rewards-reaped" rows={rows} colCount={2} />;
}

function PageLocked() {
  return (
    <div class="bbgl-ach-locked">
      <div class="bbgl-ach-locked-icon">{'\u{1F512}'}</div>
      <div class="bbgl-ach-locked-text">Reach Level 100 to unlock this page!</div>
    </div>
  );
}

function AchPage(props: { page: number; d: AchData }) {
  if (props.page === 0) return Page0(props.d);
  if (props.page === 1) return Page1(props.d);
  if (props.page === 2) {
    const overviewD = viewState.achEnhPeriodMode
      ? app.computeEnhancersForPeriod(calendarState.selectedData || app.DataController.getSlice('DAY', Formatter.dateLogical()))
      : props.d;
    return PageOverview(overviewD);
  }
  if (props.page === 3) return PageHappy(props.d);
  if (props.page === 5) return <PageLocked />;
  return PageRewards(props.d);
}

function onAchClick(e: Event) {
  const t = e.target as HTMLElement;
  const swOpt = t.closest('.bbgl-enh-sw-opt') as HTMLElement | null;
  if (swOpt) {
    const toSelected = swOpt.dataset.mode === 'selected';
    if (toSelected !== !!viewState.achEnhPeriodMode) {
      viewState.achEnhPeriodMode = toSelected;
      saveViewState();
      if (typeof app.achRefreshPageDom === 'function') app.achRefreshPageDom();
    }
    return;
  }
  const colHeader = t.closest('.bbgl-ach-col-copy');
  if (colHeader) { app.handleAchCopy(colHeader); return; }
  const statCell = t.closest('.bbgl-ach-stat-cell');
  if (statCell) { app.handleAchCopy(statCell); return; }
  const group = t.closest('.bbgl-ach-hh-group');
  if (group) { app.handleAchCopy(group); return; }
  const row = t.closest('.bbgl-ach-section-title, .bbgl-ach-subsection-title, .bbgl-ach-row');
  if (row) app.handleAchCopy(row);
}

export function AchievementsView() {
  useUiTick();
  const d = ensureAchievements();
  const page = typeof runtime._achPage === 'number' ? runtime._achPage : (viewState.achPage || 0);
  const swipe = useRef({ x: 0, y: 0 });
  const crt = (runtime as { _achCrt?: string })._achCrt || '';

  useEffect(() => {
    if (page === 5 && typeof app.resizeAchLockedPage === 'function') app.resizeAchLockedPage();
  });

  if (!d) {
    return (
      <>
        <div id="bbgl-achievements-container" class="ledger-content">
          <div class="bbgl-ach-scroll"><div id="bbgl-ach-pages" /></div>
        </div>
        <div id="bbgl-ach-footer" class="bbgl-ach-footer" />
      </>
    );
  }

  return (
    <>
      <div
        id="bbgl-achievements-container"
        class="ledger-content"
        onClick={onAchClick}
        onTouchStart={e => { swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={e => {
          if ((window as Window & { _bbglScrubbing?: boolean })._bbglScrubbing) return;
          const dx = e.changedTouches[0].clientX - swipe.current.x;
          const dy = e.changedTouches[0].clientY - swipe.current.y;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) app.gotoAchievementsPage(dx < 0 ? 1 : -1);
        }}
      >
        <div class="bbgl-ach-scroll">
          <div id="bbgl-ach-pages" class={crt || undefined}>
            <AchPage page={page} d={d} />
          </div>
        </div>
      </div>
      <div id="bbgl-ach-footer" class="bbgl-ach-footer">
        <div class="bbgl-ach-footer-side bbgl-ach-footer-left">
          <button type="button" class="bbgl-ach-nav bbgl-ach-prev" aria-label="Previous achievements page" onClick={e => { e.stopPropagation(); app.gotoAchievementsPage(-1); }}>{'\u276e'}</button>
        </div>
        <div id="bbgl-ach-pageindicator">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} class={'pg-dot' + (i === page ? ' active' : '')} onClick={() => { if (i !== page) app.gotoAchievementsPage(i - page); }} />
          ))}
        </div>
        <div class="bbgl-ach-footer-side bbgl-ach-footer-right">
          <button type="button" class="bbgl-ach-nav bbgl-ach-next" aria-label="Next achievements page" onClick={e => { e.stopPropagation(); app.gotoAchievementsPage(1); }}>{'\u276f'}</button>
        </div>
      </div>
    </>
  );
}

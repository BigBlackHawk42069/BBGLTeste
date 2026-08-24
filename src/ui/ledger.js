import { app } from '../app-context.js';
import { ACH_FMT } from '../core/constants.ts';
import { runtime } from '../core/state.ts';
import { Formatter } from '../domain/time.ts';

function buildSessionText(sl, s, keys) {
  const statEmoji = { str: '💪', def: '🛡️', spd: '🎯', dex: '🤺' };
  const statNames = { str: 'Strength', def: 'Defense', spd: 'Speed', dex: 'Dexterity' };
  let ds = '';
  if (sl._dailyList && sl._dailyList.length > 1) ds = `${Formatter.dateFull(sl._dailyList[0].date)} - ${Formatter.dateFull(sl._dailyList[sl._dailyList.length - 1].date)}`;
  else ds = Formatter.dateFull(sl.date);
  const isSingle = keys.length === 1;
  const eCost = isSingle ? s[keys[0]].cost : s.total.cost;
  const eTxt = eCost > 0 ? `⚡${Formatter.number(eCost)} E` : '🛌 I was a lazy POS.';
  const statLines = keys.filter(k => s[k].gain > 0 || s[k].cost > 0).map(k => `${statEmoji[k]}${statNames[k]}: +${Formatter.achAbbr(s[k].gain, ACH_FMT.gains)} (${Formatter.achAbbr(s[k].start, ACH_FMT.gains)} \u2192 ${Formatter.achAbbr(s[k].end, ACH_FMT.gains)})`);
  return ['👑BBGymLog', `${ds} |${eTxt}`, ...statLines].join('\n');
}

function flashCopied(flashEl) {
  const _flashEls = Array.isArray(flashEl) ? flashEl : [flashEl];
  const _states = _flashEls.map(e => {
    const kids = Array.from(e.children);
    const visStates = kids.map(c => c.style.visibility);
    kids.forEach(c => { c.style.visibility = 'hidden'; });
    const prevPos = e.style.position;
    const cs = window.getComputedStyle(e);
    if (cs.position === 'static') e.style.position = 'relative';
    const overlay = document.createElement('span');
    overlay.className = 'bbgl-ach-copied-flash';
    overlay.textContent = 'Copied!';
    e.appendChild(overlay);
    return { e, kids, visStates, prevPos, overlay };
  });
  setTimeout(() => _states.forEach(s => {
    if (s.overlay && s.overlay.parentNode) s.overlay.parentNode.removeChild(s.overlay);
    s.kids.forEach((c, i) => { c.style.visibility = s.visStates[i]; });
    s.e.style.position = s.prevPos;
  }), 1000);
}

function renderStats(sl, rawLbl) {
  if (!sl) return;
  if (!sl.stats) sl = app.DataController._hydrate(sl, [], rawLbl, 'DAY');
  runtime.currentStats = { sl, s: sl.stats };
  if (typeof app.notifyUi === 'function') app.notifyUi();
}

app.buildSessionText = buildSessionText;
app.flashCopied = flashCopied;
app.renderStats = renderStats;
export { buildSessionText, flashCopied, renderStats };

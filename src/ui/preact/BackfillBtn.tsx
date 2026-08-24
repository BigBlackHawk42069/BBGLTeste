import { useEffect, useState } from 'preact/hooks';
import { app } from '../../app-context.js';
import { runtime } from '../../core/state.ts';
import { TOOLTIPS } from '../templates.js';
import { Btn } from './form.tsx';
import { Raw } from './html.tsx';
import { useUiTick } from './store.ts';

const IDLE = 'Big Black Backfill';
const RESUME = '<span class="view-std">Resume BB Backfill</span><span class="view-exp">Resume Big Black Backfill</span>';
const CONFIRM = 'Tap Again to Confirm';

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor(total % 3600 / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function BackfillBtn() {
  useUiTick();
  const [confirm, setConfirm] = useState(false);
  const [now, setNow] = useState(Date.now());

  const s = typeof app.getActiveHistory === 'function' ? app.getActiveHistory() : null;
  const ds = s && s.meta && s.meta.backfill;
  const cooling = !!(ds && ds.lastResult === 'partial' && ds.cooldownUntil && Date.now() < ds.cooldownUntil);

  useEffect(() => {
    if (!cooling) return;
    const id = setInterval(() => {
      if (Date.now() >= ds.cooldownUntil) {
        clearInterval(id);
        if (app.notifyUi) app.notifyUi();
        return;
      }
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [cooling, ds && ds.cooldownUntil]);

  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(false), 4000);
    return () => clearTimeout(t);
  }, [confirm]);

  if (runtime.demoMode) {
    return (
      <Btn id="backfill-btn" modifier="purple" style={{ margin: '8px 10px', width: 'calc(100% - 20px)', display: 'block' }}>
        {IDLE}
      </Btn>
    );
  }

  const busy = runtime.backfilling || (ds && ds.acknowledged === false);
  const complete = ds && ds.lastResult === 'complete';
  const partial = ds && ds.lastResult === 'partial';
  const label = confirm ? CONFIRM : complete ? 'Fully Backfilled!' : (partial ? RESUME : IDLE);
  const disabled = !!(busy || cooling);
  let tip: string | undefined;
  if (cooling) tip = TOOLTIPS.BACKFILL_RESUME_COOLDOWN(formatCountdown(Math.max(0, ds.cooldownUntil - now)));
  else if (complete) tip = ds.completion === 'exhausted' ? TOOLTIPS.BACKFILL_COMPLETE_EXHAUSTED : TOOLTIPS.BACKFILL_COMPLETE_ORIGIN;

  return (
    <Btn
      id="backfill-btn"
      modifier="purple"
      disabled={disabled}
      style={{
        margin: '8px 10px',
        width: 'calc(100% - 20px)',
        display: 'block',
        opacity: disabled ? 0.6 : undefined,
        pointerEvents: disabled ? 'none' : undefined,
        color: complete ? '#69f0ae' : undefined
      }}
      onClick={e => {
        (e.currentTarget as HTMLButtonElement).blur();
        if (disabled) return;
        if (!confirm) { setConfirm(true); return; }
        setConfirm(false);
        app.startBackfillFromSettings();
      }}
    >
      <span data-tooltip={tip}>{label.includes('<') ? <Raw html={label} /> : label}</span>
    </Btn>
  );
}

import { useEffect, useState } from 'preact/hooks';
import { app } from '../../app-context.js';
import { BACKFILL } from '../../core/constants.ts';
import { dom, runtime, TAB_ID, viewState } from '../../core/state.ts';
import { ICONS } from '../icons.ts';
import { Raw } from './html.tsx';
import { useUiTick } from './store.ts';

const SCAN_PAUSE_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`;
const SCAN_PLAY_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;

function currentScanState() {
  if (runtime.demoMode) return { key: null as string | null, ds: null as any };
  const s = typeof app.getActiveHistory === 'function' ? app.getActiveHistory() : null;
  const ds = s && s.meta && s.meta.backfill;
  if (!ds) return { key: null as string | null, ds: null as any };
  const lockFresh = ds.lock && Date.now() - ds.lock < BACKFILL.LOCK_STALE_MS;
  let key: string | null = null;
  if (runtime.backfilling) key = runtime._scanCancelConfirm ? 'confirm' : 'scanning';
  else if (lockFresh && ds.lockOwner !== TAB_ID) key = 'passenger';
  else if (ds.acknowledged === false) {
    if (ds.lastResult === 'complete') key = 'complete';
    else if (ds.stopReason === 'cap') key = 'cap';
    else if (ds.stopReason === 'paused') key = 'paused';
    else if (ds.stopReason === 'interrupted') key = 'interrupted';
    else key = 'error';
  }
  return { key, ds };
}

export function ScanOverlay() {
  useUiTick();
  const [, setTick] = useState(0);
  const { key, ds } = currentScanState();
  const inSettings = viewState.subView === 'settings' || !!(dom.settingsView && dom.settingsView.classList.contains('active-view'));
  const renderKey = !key ? null : (inSettings ? 'settings' : key);

  useEffect(() => {
    if (renderKey !== 'passenger') return;
    const id = setInterval(() => setTick(n => n + 1), 3000);
    return () => clearInterval(id);
  }, [renderKey]);

  if (!renderKey) return null;

  return (
    <div id="bbgl-scan-overlay">
      {renderKey === 'settings' && (
        <>
          <div class="bbgl-scan-title">Scan in Progress</div>
          <div class="bbgl-scan-sub">Settings are locked while Big Black Backfill runs. Head back to the log to pause or check progress.</div>
        </>
      )}
      {renderKey === 'scanning' && (
        <>
          <div id="bbgl-scan-cancel" onClick={() => { runtime._scanCancelConfirm = true; if (app.notifyUi) app.notifyUi(); }}>Cancel</div>
          <div class="bbgl-scan-title-row">
            <div class="bbgl-scan-title">Scanning&hellip;</div>
            <div id="bbgl-scan-pause" class="bbgl-scan-iconbtn bbgl-scan-play bbgl-scan-title-icon" title="Pause" onClick={e => {
              runtime.backfillAbort = 'pause';
              const t = (e.currentTarget as HTMLElement).parentElement?.querySelector('.bbgl-scan-title');
              if (t) t.textContent = 'Pausing…';
            }}>
              <Raw html={SCAN_PAUSE_SVG} />
            </div>
          </div>
          <div class="bbgl-scan-count-row">
            <span class="bbgl-scan-pulse" />
            Rows recovered so far: <span id="bbgl-scan-count" class="bbgl-scan-count">{ds && ds.rowsUsed || 0}</span>
          </div>
          <div class="bbgl-scan-sub">This only takes up to a few minutes. Please stay on this page until the scan completes.</div>
          <div class="bbgl-scan-note">If you're on PC, you may continue playing in another tab, but do not close this one.</div>
        </>
      )}
      {renderKey === 'confirm' && (
        <>
          <div class="bbgl-scan-title">Cancel this scan?</div>
          <div class="bbgl-scan-sub">Canceling discards everything recovered during this scan. Your log since installation remains untouched.</div>
          <div class="bbgl-scan-actions">
            <div id="bbgl-scan-confirm-yes" class="bbgl-scan-iconbtn bbgl-scan-yes" title="Yes, cancel" onClick={e => {
              runtime.backfillAbort = 'cancel';
              runtime._scanCancelConfirm = false;
              const t = (e.currentTarget as HTMLElement).closest('#bbgl-scan-overlay')?.querySelector('.bbgl-scan-title');
              if (t) t.textContent = 'Discarding…';
            }}>
              <Raw html={ICONS.CHECK} />
            </div>
            <div id="bbgl-scan-confirm-no" class="bbgl-scan-iconbtn bbgl-scan-no" title="No, keep scanning" onClick={() => {
              runtime._scanCancelConfirm = false;
              if (app.notifyUi) app.notifyUi();
            }}>
              <Raw html={ICONS.CLOSE} />
            </div>
          </div>
        </>
      )}
      {renderKey === 'passenger' && (
        <>
          <div class="bbgl-scan-title">Scan Running in Another Tab</div>
          <div class="bbgl-scan-sub">Big Black Backfill is currently active in another tab. Use that tab to pause or cancel the scan.</div>
        </>
      )}
      {(renderKey === 'paused' || renderKey === 'error' || renderKey === 'interrupted') && (
        <>
          <div class="bbgl-scan-title-row">
            <div class="bbgl-scan-title">{renderKey === 'paused' ? 'Paused' : renderKey === 'error' ? 'Scan Error' : 'Interrupted'}</div>
            <div id="bbgl-scan-resume" class="bbgl-scan-iconbtn bbgl-scan-play bbgl-scan-title-icon" title="Resume" onClick={() => app.backfillLogs(document.getElementById('backfill-btn'))}>
              <Raw html={SCAN_PLAY_SVG} />
            </div>
          </div>
          <div class="bbgl-scan-sub">
            {renderKey === 'paused' && 'You can resume now, or continue with what\'s been recovered so far.'}
            {renderKey === 'error' && 'A network or API error occurred. No progress was lost. Resume to keep going, or continue with what\'s been recovered so far.'}
            {renderKey === 'interrupted' && 'The tab or browser was closed before the scan finished. Your progress up to that point was saved. Resume to keep going, or continue with what\'s been recovered so far.'}
          </div>
          <div class="bbgl-scan-actions">
            <div id="bbgl-scan-proceed" class="bbgl-scan-textbtn bbgl-scan-primary" onClick={() => app.proceedPartialBackfill()}>Continue with what's been recovered</div>
          </div>
        </>
      )}
      {renderKey === 'cap' && (
        <>
          <div class="bbgl-scan-title">Daily Limit Reached</div>
          <div class="bbgl-scan-sub">Torn's daily row cap has been reached. Resume from the Settings menu in 24h. Everything recovered so far is fully constructed, none of it is partial.</div>
          <div class="bbgl-scan-actions">
            <div id="bbgl-scan-proceed" class="bbgl-scan-textbtn bbgl-scan-primary" onClick={() => app.proceedPartialBackfill()}>Continue to Logs</div>
          </div>
        </>
      )}
      {renderKey === 'complete' && (
        <>
          <div class="bbgl-scan-title">Fully Backfilled!</div>
          <div class="bbgl-scan-sub">Your training history has been fully reconstructed.</div>
          <div class="bbgl-scan-note">Rewards and stickers only start counting from the day you began tracking, not from backfilled history.</div>
          <div class="bbgl-scan-actions">
            <div id="bbgl-scan-ack" class="bbgl-scan-textbtn bbgl-scan-primary" onClick={() => app.acknowledgeBackfill()}>Enter Logs</div>
          </div>
        </>
      )}
    </div>
  );
}

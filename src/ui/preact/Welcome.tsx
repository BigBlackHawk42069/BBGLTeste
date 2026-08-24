import { useEffect, useRef, useState } from 'preact/hooks';
import { app } from '../../app-context.js';
import {
  MSG_KEY_FORMAT_INVALID, MSG_KEY_NETWORK_ERROR,
  bbglError, tornKeyErrorText
} from '../../core/constants.ts';
import { calendarState, runtime, saveConfig, userConfig, viewState } from '../../core/state.ts';
import { Formatter } from '../../domain/time.ts';
import { ICONS } from '../icons.ts';
import { TOOLTIPS } from '../templates.js';
import { ApiField, Btn, CREATE_API_URL, Row, Section } from './form.tsx';
import { Raw } from './html.tsx';

export function Welcome() {
  const apiRef = useRef<HTMLInputElement | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [introHtml, setIntroHtml] = useState(app.DOC_LOADING_HTML || '');
  const [returningHtml, setReturningHtml] = useState(app.DOC_LOADING_HTML || '');
  const [startLabel, setStartLabel] = useState('START TRACKING');
  const [startBusy, setStartBusy] = useState(false);
  const canClose = !!localStorage.getItem('bbgl_initialized') || runtime.demoMode;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await app.fetchDoc('welcome');
        const parts = String(raw).split('<!--RETURNING-->');
        if (cancelled) return;
        setIntroHtml(parts[0] || app.DOC_ERROR_HTML);
        setReturningHtml(parts[1] || app.DOC_ERROR_HTML);
      } catch {
        if (!cancelled) {
          setIntroHtml(app.DOC_ERROR_HTML);
          setReturningHtml(app.DOC_ERROR_HTML);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (hostRef.current && typeof app.refreshInitMask === 'function') app.refreshInitMask(hostRef.current);
  });

  async function onStart(e: Event) {
    const btn = e.currentTarget as HTMLButtonElement;
    btn.blur();
    const v = (apiRef.current?.value || '').trim();
    if (!/^[a-zA-Z0-9]{16}$/.test(v)) {
      bbglError(MSG_KEY_FORMAT_INVALID);
      return;
    }
    setStartBusy(true);
    setStartLabel('VERIFYING...');
    try {
      const res = await fetch(`https://api.torn.com/user/?selections=battlestats,log&log=5300&key=${v}`);
      const data = await res.json();
      if (data.error) {
        bbglError(`Key Verification Failed: ${tornKeyErrorText(data)}`);
        setStartBusy(false);
        setStartLabel('START TRACKING');
        return;
      }
      userConfig.apiKey = v;
      saveConfig();
      localStorage.setItem('bbgl_initialized', '1');
      app.refreshInitLock();
      calendarState.selectedData = null;
      calendarState.selectedLabel = Formatter.dateLogical();
      viewState.activeViewLabel = null;
      app.syncWithFeedback('FULL_SYNC');
      app.openBackfillChoiceModal();
    } catch {
      bbglError(MSG_KEY_NETWORK_ERROR);
      setStartBusy(false);
      setStartLabel('START TRACKING');
    }
  }

  return (
    <div ref={hostRef}>
      {canClose ? (
        <div class="close-settings-btn bbgl-close-x" title="Close" onClick={e => { e.stopPropagation(); app.switchView('ledger'); }}>
          <Raw html={ICONS.CLOSE} />
        </div>
      ) : null}
      <div class="bbgl-settings-scroll-area">
        <div class="bbgl-prefs-tab-title" style={{ borderRadius: '5px 5px 0 0', marginTop: 0 }}>
          <span>Welcome to Big Black Gym Log</span>
        </div>
        <div class="bbgl-settings-body" style={{ marginBottom: 5 }}>
          <div id="bbgl-welcome-intro-text" dangerouslySetInnerHTML={{ __html: introHtml }} />
          <Btn id="init-privacy-btn" style={{ margin: '0 10px 8px 10px', width: 'calc(100% - 20px)', display: 'block' }} onClick={e => { (e.currentTarget as HTMLButtonElement).blur(); app.openPrivacyModal(); }}>PRIVACY DISCLOSURE</Btn>
        </div>

        <Section title="Initialization Settings" bodyStyle={{ marginBottom: 5 }}>
          <div id="init-section-masked-body" class="bbgl-mask-host" data-mask-text="Please agree to the privacy disclosure first.">
            <ApiField prefix="init" inputRef={apiRef} defaultValue={userConfig.apiKey || ''} style={{ margin: '8px 10px' }} />
            <Btn id="init-create-api-btn" style={{ margin: '0 10px 8px 10px', width: 'calc(100% - 20px)', display: 'block' }} onClick={e => { (e.currentTarget as HTMLButtonElement).blur(); window.open(CREATE_API_URL, '_blank'); }}>CREATE API KEY</Btn>
            <Row label={<span data-tooltip-html={TOOLTIPS.DAY_START}>Log Timezone</span>}>
              <select id="init-day-start" class="bbgl-native-select" value={userConfig.dayStartMode} onChange={e => app.onChangeDayStart((e.target as HTMLSelectElement).value)}>
                <option value="utc">Torn Time (UTC)</option>
                <option value="local">Local Time</option>
              </select>
            </Row>
            <Row label={<span data-tooltip-html={TOOLTIPS.WEEK_START}>Week Start</span>}>
              <select id="init-week-start" class="bbgl-native-select" value={userConfig.weekStartMode} onChange={e => app.onChangeWeekStart((e.target as HTMLSelectElement).value)}>
                <option value="sun">Sun – Sat</option>
                <option value="mon">Mon – Sun</option>
              </select>
            </Row>
            <Btn id="init-start-btn" modifier="green" disabled={startBusy} style={{ margin: '8px 10px', width: 'calc(100% - 20px)', display: 'block', color: startBusy ? '#69f0ae' : undefined }} onClick={onStart}>{startLabel}</Btn>
          </div>
        </Section>

        <Section title="Returning User" bodyStyle={{ marginBottom: 5 }}>
          <div id="bbgl-welcome-returning-text" dangerouslySetInnerHTML={{ __html: returningHtml }} />
          <Btn id="init-returning-import-btn" style={{ margin: '0 10px 8px 10px', width: 'calc(100% - 20px)', display: 'block' }} onClick={e => { (e.currentTarget as HTMLButtonElement).blur(); importRef.current?.click(); }}>IMPORT LOG</Btn>
          <input id="init-import-file" ref={el => { importRef.current = el; }} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={e => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) app.importDataFromWelcome(f); }} />
        </Section>
      </div>
    </div>
  );
}

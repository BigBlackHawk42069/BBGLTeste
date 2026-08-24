import { useEffect, useRef, useState } from 'preact/hooks';
import { app } from '../../app-context.js';
import {
  KEYS, MSG_KEY_FORMAT_INVALID, MSG_KEY_NETWORK_ERROR,
  bbglError, tornKeyErrorText
} from '../../core/constants.ts';
import { dom, graphState, runtime, saveConfig, saveViewState, userConfig, viewState } from '../../core/state.ts';
import { calendarState } from '../../core/state.ts';
import { Formatter } from '../../domain/time.ts';
import { ICONS } from '../icons.ts';
import { TOOLTIPS } from '../templates.js';
import { BackfillBtn } from './BackfillBtn.tsx';
import { ApiField, Btn, CREATE_API_URL, Row, Section, STACK, Toggle } from './form.tsx';
import { Raw } from './html.tsx';

export function Settings() {
  const apiRef = useRef<HTMLInputElement | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);
  const [verifyLabel, setVerifyLabel] = useState('REGISTER API KEY');
  const [clearLabel, setClearLabel] = useState('CLEAR API KEY');
  const [resync, setResync] = useState<'idle' | 'syncing' | 'done'>('idle');

  useEffect(() => {
    if (apiRef.current) apiRef.current.value = userConfig.apiKey || '';
    if (typeof app.refreshDemoMasks === 'function') app.refreshDemoMasks();
    if (typeof app.refreshInitLock === 'function') app.refreshInitLock();
  });

  function onAnim(checked: boolean) {
    userConfig.animations = checked;
    saveConfig();
    if (dom.panel) dom.panel.classList.toggle('bbgl-no-animations', !userConfig.animations);
    app.renderPanelContent();
  }

  function onRates(checked: boolean) {
    userConfig.ratesEnabled = checked;
    saveConfig();
    if (dom.panel) dom.panel.classList.toggle('bbgl-no-rates', !userConfig.ratesEnabled);
    if (!userConfig.ratesEnabled && graphState.mode === 'rates') {
      graphState.mode = 'values';
      viewState.graphMode = 'values';
      saveViewState();
    }
    const tp = dom.topPanel;
    if (tp && tp.classList.contains('viewing-graph')) {
      app.GraphController.restoreUi();
      app.GraphController.draw();
    } else {
      const sd = calendarState.selectedData;
      app.renderStats(sd || app.getActiveHistory().today, calendarState.selectedLabel || Formatter.dateLogical());
    }
  }

  function onDrug(value: string) {
    userConfig.drugTracker = value;
    saveConfig();
    const tp = dom.topPanel;
    if (!tp || !tp.classList.contains('viewing-graph')) {
      const sd = calendarState.selectedData;
      app.renderStats(sd || app.getActiveHistory().today, calendarState.selectedLabel || Formatter.dateLogical());
    }
  }

  async function onRegister() {
    const el = apiRef.current;
    if (!el) return;
    const v = el.value.trim();
    if (!/^[a-zA-Z0-9]{16}$/.test(v)) {
      bbglError(MSG_KEY_FORMAT_INVALID);
      return;
    }
    const ot = verifyLabel;
    setVerifyLabel('VERIFYING...');
    try {
      const res = await fetch(`https://api.torn.com/user/?selections=battlestats,log&log=5300&key=${v}`);
      const data = await res.json();
      if (data.error) {
        bbglError(`Key Verification Failed: ${tornKeyErrorText(data)}`);
        setVerifyLabel(ot);
        return;
      }
      userConfig.apiKey = v;
      saveConfig();
      setVerifyLabel('KEY SAVED');
      setTimeout(() => setVerifyLabel(ot), 2000);
    } catch {
      bbglError(MSG_KEY_NETWORK_ERROR);
      setVerifyLabel(ot);
    }
  }

  function onClearKey() {
    userConfig.apiKey = '';
    saveConfig();
    if (apiRef.current) apiRef.current.value = '';
    localStorage.removeItem(KEYS.LAST_SYNC);
    sessionStorage.removeItem(KEYS.SESSION_CACHE);
    sessionStorage.removeItem(KEYS.SESSION);
    setClearLabel('WIPED');
    setTimeout(() => setClearLabel('CLEAR API KEY'), 2000);
  }

  async function onResync(e: Event) {
    const btn = e.currentTarget as HTMLButtonElement;
    btn.blur();
    setResync('syncing');
    await app.syncWithFeedback('FULL_SYNC');
    setResync('done');
    setTimeout(() => setResync('idle'), 2000);
  }

  return (
    <>
      <div class="close-settings-btn" title="Close Settings" onClick={e => app.toggleSettingsView(e)}>
        <Raw html={ICONS.CHECK} />
      </div>
      <div class="bbgl-settings-scroll-area">
        <Section
          title="Big Black Features"
          extra={
            <button id="resync-btn" type="button" class="bbgl-tab-title-btn" onClick={onResync}>
              <span class="bbgl-rs-idle" style={{ display: resync === 'idle' ? '' : 'none' }}>
                <span class="view-std">RESYNC</span>
                <span class="view-exp">RESYNC LOG</span>
              </span>
              <span class="bbgl-rs-sync" style={{ display: resync === 'syncing' ? '' : 'none' }}>
                <span class="view-std">...</span>
                <span class="view-exp">Syncing...</span>
              </span>
              <span class="bbgl-rs-done" style={{ display: resync === 'done' ? '' : 'none' }}>Resynced!</span>
            </button>
          }
        >
          <Toggle id="set-bestgym-toggle" checked={!!userConfig.bestGym} label="BB Best Gym" tip={TOOLTIPS.BEST_GYM} extraClass="bbgl-bestgym-lead" onChange={v => app.setBestGym(v)} />
          <Toggle id="set-bestgym-spec-toggle" checked={!!userConfig.bestGymSpecialist} label="Specialty Gyms" tip={TOOLTIPS.BEST_GYM_SPEC} extraClass={`bbgl-subgroup-row${!userConfig.bestGym ? ' bbgl-row-disabled' : ''}`} onChange={v => { userConfig.bestGymSpecialist = v; saveConfig(); }} />
          <Toggle id="set-bestgym-unpurch-toggle" checked={!!userConfig.bestGymUnpurchased} label="Unpurchased Gyms" tip={TOOLTIPS.BEST_GYM_UNPURCHASED} extraClass={`bbgl-subgroup-row bbgl-subgroup-row-last${!userConfig.bestGym ? ' bbgl-row-disabled' : ''}`} onChange={v => { userConfig.bestGymUnpurchased = v; saveConfig(); }} />
          <Toggle id="set-rate-toggle" checked={!!userConfig.ratesEnabled} label="Rate Displays" tip={TOOLTIPS.RATES} onChange={onRates} />
          <Toggle id="set-anim-toggle" checked={!!userConfig.animations} label="Animations" tip={TOOLTIPS.ANIM} onChange={onAnim} />
          <Row label={<span data-tooltip-html={TOOLTIPS.DRUG_TRACKER}>Drug Use Tracker</span>}>
            <select id="set-drug-tracker" class="bbgl-native-select" value={userConfig.drugTracker || 'xanax'} onChange={e => onDrug((e.target as HTMLSelectElement).value)}>
              <option value="xanax">Xanax</option>
              <option value="lsd">LSD</option>
            </select>
          </Row>
          <div class="bbgl-mask-host bbgl-demo-maskable" data-mask-text="Not available in demo mode">
            <BackfillBtn />
          </div>
        </Section>

        <Section title="Log Format">
          <Row label={<span data-tooltip-html={TOOLTIPS.LOC}>Log Access</span>}>
            <select id="set-loc-select" class="bbgl-native-select" value={userConfig.buttonLocation} onChange={e => app.onChangeLoc((e.target as HTMLSelectElement).value)}>
              <option value="notes">Footer Tab</option>
              <option value="sidebar">Sidebar</option>
              <option value="both">Both</option>
            </select>
          </Row>
          <Row label={<span data-tooltip-html={TOOLTIPS.DAY_START}>Log Timezone</span>}>
            <select id="set-day-start" class="bbgl-native-select" value={userConfig.dayStartMode} onChange={e => app.onChangeDayStart((e.target as HTMLSelectElement).value)}>
              <option value="utc">Torn Time (UTC)</option>
              <option value="local">Local Time</option>
            </select>
          </Row>
          <Row label={<span data-tooltip-html={TOOLTIPS.WEEK_START}>Week Start</span>}>
            <select id="set-week-start" class="bbgl-native-select" value={userConfig.weekStartMode} onChange={e => app.onChangeWeekStart((e.target as HTMLSelectElement).value)}>
              <option value="sun">Sun – Sat</option>
              <option value="mon">Mon – Sun</option>
            </select>
          </Row>
        </Section>

        <Section title="Data Management">
          <div class="bbgl-mask-host bbgl-demo-maskable" data-mask-text="Not available in demo mode">
            <Btn id="refresh-log-btn" style={{ display: 'none' }} onClick={e => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.blur();
              if (app.checkRefreshCooldown(btn)) return;
              app.syncWithFeedback('FULL_SYNC');
            }}>REFRESH LOG</Btn>
            <div class="bbgl-btn-grid" style={{ margin: '8px 10px 0 10px' }}>
              <Btn id="export-btn" style={{ borderRadius: '5px 0 0 0', borderBottom: 'none' }} onClick={e => { (e.currentTarget as HTMLButtonElement).blur(); app.exportData(); }}>EXPORT LOG</Btn>
              <Btn id="import-btn" style={{ borderRadius: '0 5px 0 0', borderBottom: 'none' }} onClick={e => { (e.currentTarget as HTMLButtonElement).blur(); importRef.current?.click(); }}>IMPORT LOG</Btn>
              <input id="import-file" ref={el => { importRef.current = el; }} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={e => app.importData((e.target as HTMLInputElement).files?.[0])} />
            </div>
            <Btn id="clear-btn" modifier="red" style={{ margin: '0 10px 8px 10px', width: 'calc(100% - 20px)', display: 'block', borderTopLeftRadius: 0, borderTopRightRadius: 0 }} onClick={e => { (e.currentTarget as HTMLButtonElement).blur(); app.clearData(); }}>CLEAR LOG</Btn>
          </div>
        </Section>

        <Section title="API Access" bodyStyle={{ marginBottom: 5 }}>
          <div class="bbgl-mask-host bbgl-demo-maskable" data-mask-text="Not available in demo mode">
            <ApiField prefix="set" inputRef={apiRef} defaultValue={userConfig.apiKey || ''} />
            <Btn id="create-api-btn" style={{ margin: '0 10px', width: 'calc(100% - 20px)', display: 'block', ...STACK.top }} onClick={e => { (e.currentTarget as HTMLButtonElement).blur(); window.open(CREATE_API_URL, '_blank'); }}>CREATE API KEY</Btn>
            <div class="bbgl-btn-grid" style={{ margin: '0 10px 10px 10px' }}>
              <Btn id="clear-api-btn" modifier="red" style={{ borderRadius: '0 0 0 5px' }} onClick={e => { (e.currentTarget as HTMLButtonElement).blur(); onClearKey(); }}>{clearLabel}</Btn>
              <Btn id="updt-settings-btn" modifier="green" style={{ borderRadius: '0 0 5px 0' }} onClick={e => { (e.currentTarget as HTMLButtonElement).blur(); onRegister(); }}>{verifyLabel}</Btn>
            </div>
          </div>
        </Section>

        <Section title="Information">
          <div class="bbgl-settings-author-credit">
            By <a class="bbgl-author-link" href="https://www.torn.com/profiles.php?XID=3550896" target="_blank" rel="noopener noreferrer">BigBlackHawk</a>
          </div>
          <Btn id="feature-guide-btn" style={{ margin: '8px 10px 0 10px', width: 'calc(100% - 20px)', display: 'block', ...STACK.top }} onClick={e => { (e.currentTarget as HTMLButtonElement).blur(); app.openFeatureGuideModal(); }}>FEATURE GUIDE</Btn>
          <div class="bbgl-mask-host bbgl-demo-maskable" data-mask-text="Not available in demo mode" style={{ margin: '0 10px', display: 'flex', flexDirection: 'column' }}>
            <Btn id="settings-changelog-btn" style={{ width: '100%', ...STACK.mid }} onClick={e => { (e.currentTarget as HTMLButtonElement).blur(); app.openChangelogModal(); }}>CHANGELOG</Btn>
            <Btn id="settings-privacy-btn" style={{ width: '100%', ...STACK.mid }} onClick={e => { (e.currentTarget as HTMLButtonElement).blur(); app.openPrivacyModal(); }}>PRIVACY DISCLOSURE</Btn>
          </div>
          <Btn
            id="settings-demo-btn"
            modifier="purple"
            style={{ margin: '0 10px 8px 10px', width: 'calc(100% - 20px)', display: 'block', ...STACK.bottom }}
            onClick={e => {
              (e.currentTarget as HTMLButtonElement).blur();
              if (runtime.demoMode) {
                const deb = document.getElementById('bbgl-demo-exit');
                if (deb) deb.click();
              } else app.enterDemoFromSettings();
            }}
          >
            {runtime.demoMode ? 'EXIT DEMO' : 'DEMO MODE'}
          </Btn>
        </Section>
      </div>
    </>
  );
}

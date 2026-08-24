import { render } from 'preact';
import type { ComponentChildren, VNode } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { app } from '../../app-context.js';
import { KEYS, SCRIPT_VERSION } from '../../core/constants.ts';
import { dom, runtime, saveConfig, userConfig } from '../../core/state.ts';
import { ICONS } from '../icons.ts';
import { TOOLTIPS } from '../templates.js';
import { Btn, Section } from './form.tsx';
import { Raw } from './html.tsx';

const LOADING = '<div style="padding:20px; text-align:center; color:#888;">Loading...</div>';
const ERROR = '<div style="padding:20px; text-align:center; color:#888;">Could not load document. Check your connection.</div>';

function ModalShell(props: {
  id: string;
  title: string;
  onClose: () => void;
  children?: ComponentChildren;
  footer?: ComponentChildren;
}) {
  return (
    <div class="bbgl-modal-overlay" id={props.id} onClick={e => { if (e.target === e.currentTarget) props.onClose(); }}>
      <div class="bbgl-modal-window">
        <div class="close-settings-btn bbgl-close-x" title="Close" onClick={props.onClose}>
          <Raw html={ICONS.CLOSE} />
        </div>
        <Section title={props.title} bodyStyle={{ marginBottom: 8 }}>{props.children}</Section>
        {props.footer}
      </div>
    </div>
  );
}

function DocBox(props: { name: string; id: string }) {
  const [html, setHtml] = useState(LOADING);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await app.fetchDoc(props.name);
        if (!cancelled) setHtml(raw);
      } catch {
        if (!cancelled) setHtml(ERROR);
      }
    })();
    return () => { cancelled = true; };
  }, [props.name]);

  useEffect(() => {
    const el = document.getElementById(props.id);
    if (!el) return;
    el.querySelectorAll('[data-bbgl-doc]').forEach(link => {
      (link as HTMLElement).style.cursor = 'pointer';
      (link as HTMLElement).onclick = async e => {
        e.preventDefault();
        const name = link.getAttribute('data-bbgl-doc');
        if (!name) return;
        setHtml(LOADING);
        try { setHtml(await app.fetchDoc(name)); } catch { setHtml(ERROR); }
      };
    });
  }, [html, props.id]);

  return (
    <div class="bbgl-modal-scrollbox" style={{ maxHeight: 'calc(68vh - 80px)', minHeight: 300 }}>
      <div id={props.id} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function PrivacyModal(props: { onClose: () => void }) {
  const reviewMode = !!userConfig.privacyAgreed;
  const [acked, setAcked] = useState(false);
  return (
    <ModalShell id="bbgl-privacy-modal" title="Big Black Dicslosure" onClose={props.onClose} footer={reviewMode ? null : (
      <div style={{ display: 'flex', margin: '0 10px 4px 10px' }}>
        <Btn id="bbgl-privacy-demo-btn" modifier="purple" style={{ flex: 2, borderRadius: '4px 0 0 4px', margin: 0 }} onClick={e => { (e.currentTarget as HTMLButtonElement).blur(); app.enterDemo('privacy'); props.onClose(); }}>DEMO</Btn>
        <span class="bbgl-agree-wrap" style={{ flex: 1, display: 'flex' }} data-tooltip={acked ? undefined : TOOLTIPS.AGREE_GATE}>
          <Btn
            id="bbgl-privacy-agree-btn"
            modifier="green"
            disabled={!acked}
            style={{ flex: 1, borderRadius: '0 4px 4px 0', margin: 0 }}
            onClick={e => {
              if (!acked) return;
              (e.currentTarget as HTMLButtonElement).blur();
              userConfig.privacyAgreed = new Date().toISOString();
              saveConfig();
              if (!runtime.wasVersionWiped) localStorage.setItem(KEYS.CHANGELOG_VER, SCRIPT_VERSION);
              props.onClose();
              app.refreshInitLock();
              const wv = dom.welcomeView;
              if (wv && wv.classList.contains('active-view')) app.refreshInitMask(wv);
            }}
          >AGREE</Btn>
        </span>
      </div>
    )}>
      <DocBox name="privacy" id="bbgl-privacy-disc" />
      <div class="bbgl-ack-row" style={{ margin: '0 10px 8px 10px' }}>
        {reviewMode ? (
          <>
            <span class="bbgl-ack-check bbgl-ack-agreed"><Raw html={ICONS.CHECK} /></span>
            <span class="bbgl-ack-agreed-label">I have read and agree to this disclosure.</span>
          </>
        ) : (
          <>
            <input id="bbgl-privacy-ack" type="checkbox" checked={acked} onChange={e => setAcked((e.target as HTMLInputElement).checked)} />
            <label for="bbgl-privacy-ack">I have read and agree to this disclosure.</label>
          </>
        )}
      </div>
    </ModalShell>
  );
}

function ChangelogModal(props: { onClose: () => void }) {
  return (
    <ModalShell id="bbgl-changelog-modal" title="BBGL Test Phase Changelog" onClose={props.onClose}>
      <div class="bbgl-modal-scrollbox" style={{ maxHeight: 'calc(68vh - 80px)', minHeight: 300 }}>
        <div id="bbgl-changelog-content" style={{ fontFamily: 'Arial, sans-serif', fontSize: 12, color: '#ccc', lineHeight: 1.7 }}>
          <DocBox name="changelog" id="bbgl-changelog-inner" />
        </div>
      </div>
    </ModalShell>
  );
}

function FeatureGuideModal(props: { onClose: () => void }) {
  return (
    <ModalShell id="bbgl-feature-guide-modal" title="Feature Guide" onClose={props.onClose}>
      <div class="bbgl-modal-scrollbox" style={{ maxHeight: 'calc(68vh - 80px)', minHeight: 300 }}>
        <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Cumming Soon...</div>
      </div>
    </ModalShell>
  );
}

function mount(node: VNode, id: string): void {
  closeById(id);
  const host = document.createElement('div');
  host.id = `${id}-host`;
  document.body.appendChild(host);
  render(node, host);
}

function closeById(id: string): void {
  const host = document.getElementById(`${id}-host`);
  if (host) {
    render(null, host);
    host.remove();
  }
  const legacy = document.getElementById(id);
  if (legacy && legacy.parentNode) legacy.parentNode.removeChild(legacy);
}

export function openPrivacyModal(): void {
  mount(<PrivacyModal onClose={() => closeById('bbgl-privacy-modal')} />, 'bbgl-privacy-modal');
}

export function closePrivacyModal(): void {
  closeById('bbgl-privacy-modal');
}

export function openChangelogModal(): void {
  localStorage.setItem(KEYS.CHANGELOG_VER, SCRIPT_VERSION);
  localStorage.removeItem(KEYS.CHANGELOG_NOTIF);
  if (typeof app.syncChangelogNotif === 'function') app.syncChangelogNotif(false);
  mount(<ChangelogModal onClose={() => closeById('bbgl-changelog-modal')} />, 'bbgl-changelog-modal');
}

export function closeChangelogModal(): void {
  closeById('bbgl-changelog-modal');
}

export function openFeatureGuideModal(): void {
  mount(<FeatureGuideModal onClose={() => closeById('bbgl-feature-guide-modal')} />, 'bbgl-feature-guide-modal');
}

export function closeFeatureGuideModal(): void {
  closeById('bbgl-feature-guide-modal');
}

function BackfillChoiceModal(props: { onClose: () => void }) {
  const close = () => {
    props.onClose();
    app.switchView('ledger');
  };
  return (
    <ModalShell id="bbgl-choice-modal" title="Start Tracking" onClose={close}>
      <div style={{ padding: '6px 4px 14px', color: '#ccc', fontSize: 12, lineHeight: 1.6, textAlign: 'center' }}>
        Start tracking now with no log history, or use Big Black Backfill to reconstruct your training history from Torn's logs. You can always get Big Black Backfilled later from the Settings.
      </div>
      <div style={{ display: 'flex', gap: 0, margin: '0 6px 2px' }}>
        <Btn id="bbgl-choice-fresh-btn" style={{ flex: 1, borderRadius: '4px 0 0 4px', margin: 0 }} onClick={e => { (e.currentTarget as HTMLButtonElement).blur(); close(); }}>START EMPTY LOG</Btn>
        <Btn id="bbgl-choice-backfill-btn" modifier="purple" style={{ flex: 1, borderRadius: '0 4px 4px 0', margin: 0 }} onClick={e => {
          (e.currentTarget as HTMLButtonElement).blur();
          close();
          app.backfillLogs(document.getElementById('backfill-btn'));
        }}>BIG BLACK BACKFILL</Btn>
      </div>
    </ModalShell>
  );
}

app.openBackfillChoiceModal = openBackfillChoiceModal;
app.closeBackfillChoiceModal = closeBackfillChoiceModal;

export function openBackfillChoiceModal(): void {
  if (runtime.demoMode) return;
  mount(<BackfillChoiceModal onClose={() => closeById('bbgl-choice-modal')} />, 'bbgl-choice-modal');
}

export function closeBackfillChoiceModal(): void {
  closeById('bbgl-choice-modal');
}

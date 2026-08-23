import { app } from '../app-context.js';
import { CUSTOM_STICKERS, PAGE_TITLES, cdnize } from '../ui/assets.ts';
import { ASSETS, ICONS } from '../ui/icons.ts';
import { injectStyles } from '../ui/styles.ts';
import {
  ACH_FMT, BACKFILL, BACKFILL_GROUP_KEYS, BACKFILL_GROUP_OF, BACKFILL_GROUPS,
  BASE_DOCS_URL, BBGL_ERROR_CODE, BS_STAT_ROWS, compareVersions, CONSTANTS, ECAN_LOG, ECSTASY_LOG, ENERGY_LOGS, ENERGY_PARAM,
  EX_OD_LOG, GAME, GYM_TIERS, HAPPY_LOGS, ITEM_GROUP_LABELS, ITEM_LOG_META, ITEM_LOGS, KEYS, LAYOUT, LSD_OD_LOG,
  MSG_CLIPBOARD_DENIED, MSG_KEY_FORMAT_INVALID, MSG_KEY_NETWORK_ERROR, MSG_SYNC_NETWORK_ERROR, MSG_SYNC_QUOTA,
  OD_LOGS, r2, SCRIPT_VERSION, STAT_ENHANCER_PARAM, STAT_HAPPY_PARAM, STAT_KEYS, STAT_LOGS, SYNC_FROM_BUFFER,
  TORN_KEY_ERROR_MAP, TRAIN_ENERGY_PARAM, TRAIN_LOGS, WIPE_BELOW_VERSION, XANAX_LOG, XANAX_OD_LOG, ZERO_BREAKDOWN,
  bbglError, tornKeyErrorText
} from '../core/constants.ts';
import { Log, Perf, isDevMode } from '../core/log.ts';
import {
  ALLOWED_CONFIG_KEYS, TAB_ID, calendarState, dom, graphState, historyCache, lastButtonLocation, layoutObservers,
  refreshClickLog, runtime, saveConfig, saveViewState, setHistoryCache, setLastButtonLocation, setTopCeiling, setViewState,
  topCeilingCache, topCeilingTs, userConfig, viewState
} from '../core/state.ts';
import { Formatter, TimeManager, getISOWeek, getWeekKey } from '../domain/time.ts';
import { classifyDay, computeWeekCapsules, computeWeekCompletion, placeCapsuleUnit } from '../domain/capsules.ts';
import { atrophyTitle, calculateLevelProgress, computeDailyLevelExp, computeLevelExpCost } from '../domain/leveling.ts';
import { findHappyJumps, initializeDayObject, normalizeApiLogs, sumStats } from '../domain/day.ts';


function fetchDoc(name) { if (app.docCache[name]) return Promise.resolve(app.docCache[name]); return new Promise((resolve, reject) => { GM_xmlhttpRequest({ method: 'GET', url: BASE_DOCS_URL + name + '.html?_=' + Date.now(), onload(res) { if (res.status >= 200 && res.status < 300) { app.docCache[name] = res.responseText; resolve(res.responseText); } else { reject(new Error(`Doc fetch failed: ${res.status}`)); } }, onerror() { reject(new Error('Doc fetch network error')); } }); }); }

const DOC_LOADING_HTML = `<div style="padding:20px; text-align:center; color:#888;">Loading...</div>`;

const DOC_ERROR_HTML = `<div style="padding:20px; text-align:center; color:#888;">Could not load document. Check your connection.</div>`;

const PRIVACY_TEXT = { AGREE_LABEL: "I have read and agree to this disclosure." };

function buildPrivacyModalHTML(reviewMode) { const scrollbox = `<div class="bbgl-modal-scrollbox" style="max-height:calc(68vh - 80px); min-height:300px;"><div id="bbgl-privacy-disc">${DOC_LOADING_HTML}</div></div>`; const ctrl = reviewMode ? `<span class="bbgl-ack-check bbgl-ack-agreed">${ICONS.CHECK}</span>` : `<input type="checkbox" id="bbgl-privacy-ack">`; const label = reviewMode ? `<span class="bbgl-ack-agreed-label">${PRIVACY_TEXT.AGREE_LABEL}</span>` : `<label for="bbgl-privacy-ack">${PRIVACY_TEXT.AGREE_LABEL}</label>`; const ackRow = `<div class="bbgl-ack-row" style="margin:0 10px 8px 10px;">${ctrl}${label}</div>`; const footer = reviewMode ? '' : `<div style="display:flex; margin:0 10px 4px 10px;">${app.buildButton('bbgl-privacy-demo-btn', 'DEMO', 'purple', 'flex:2; border-radius:4px 0 0 4px; margin:0;')}<span class="bbgl-agree-wrap" style="flex:1; display:flex;" data-tooltip="${app.TOOLTIPS.AGREE_GATE}">${app.buildButton('bbgl-privacy-agree-btn', 'AGREE', 'green', 'flex:1; border-radius:0 4px 4px 0; margin:0;')}</span></div>`; const discSection = app.buildSection('Big Black Dicslosure', `${scrollbox}${ackRow}`, 'margin-bottom:8px;'); return `<div class="bbgl-modal-overlay" id="bbgl-privacy-modal"><div class="bbgl-modal-window"><div class="close-settings-btn bbgl-close-x" id="bbgl-privacy-close" title="Close">${ICONS.CLOSE}</div>${discSection}${footer}</div></div>`; }

function closePrivacyModal() { const m = document.getElementById('bbgl-privacy-modal'); if (m && m.parentNode) m.parentNode.removeChild(m); }

function buildChangelogModalHTML() { const changelogSection = app.buildSection('BBGL Test Phase Changelog', `<div class="bbgl-modal-scrollbox" style="max-height:calc(68vh - 80px); min-height:300px;"><div id="bbgl-changelog-content" style="font-family:Arial,sans-serif; font-size:12px; color:#ccc; line-height:1.7;">${DOC_LOADING_HTML}</div></div>`, 'margin-bottom:8px;'); return `<div class="bbgl-modal-overlay" id="bbgl-changelog-modal"><div class="bbgl-modal-window"><div class="close-settings-btn bbgl-close-x" id="bbgl-changelog-close" title="Close">${ICONS.CLOSE}</div>${changelogSection}</div></div>`; }

function closeChangelogModal() { const m = document.getElementById('bbgl-changelog-modal'); if (m && m.parentNode) m.parentNode.removeChild(m); }

async function openChangelogModal() { closeChangelogModal(); document.body.insertAdjacentHTML('beforeend', buildChangelogModalHTML()); const modal = document.getElementById('bbgl-changelog-modal'); if (!modal) return; localStorage.setItem(KEYS.CHANGELOG_VER, SCRIPT_VERSION); localStorage.removeItem(KEYS.CHANGELOG_NOTIF); app.syncChangelogNotif(false); modal.querySelector('#bbgl-changelog-close').onclick = () => closeChangelogModal(); modal.onclick = e => { if (e.target === modal) closeChangelogModal(); }; try { const changelogHTML = await fetchDoc('changelog'); const inner = modal.querySelector('#bbgl-changelog-content'); if (inner) inner.innerHTML = changelogHTML; } catch (e) { const inner = modal.querySelector('#bbgl-changelog-content'); if (inner) inner.innerHTML = DOC_ERROR_HTML; } }

function buildFeatureGuideModalHTML() { const guideSection = app.buildSection('Feature Guide', `<div class="bbgl-modal-scrollbox" style="max-height:calc(68vh - 80px); min-height:300px;"><div style="padding:20px; text-align:center; color:#888;">Cumming Soon...</div></div>`, 'margin-bottom:8px;'); return `<div class="bbgl-modal-overlay" id="bbgl-feature-guide-modal"><div class="bbgl-modal-window"><div class="close-settings-btn bbgl-close-x" id="bbgl-feature-guide-close" title="Close">${ICONS.CLOSE}</div>${guideSection}</div></div>`; }

function closeFeatureGuideModal() { const m = document.getElementById('bbgl-feature-guide-modal'); if (m && m.parentNode) m.parentNode.removeChild(m); }

function openFeatureGuideModal() { closeFeatureGuideModal(); document.body.insertAdjacentHTML('beforeend', buildFeatureGuideModalHTML()); const modal = document.getElementById('bbgl-feature-guide-modal'); if (!modal) return; modal.querySelector('#bbgl-feature-guide-close').onclick = () => closeFeatureGuideModal(); modal.onclick = e => { if (e.target === modal) closeFeatureGuideModal(); }; }

async function openPrivacyModal() { closePrivacyModal(); const reviewMode = !!userConfig.privacyAgreed, host = document.body; host.insertAdjacentHTML('beforeend', buildPrivacyModalHTML(reviewMode)); const modal = document.getElementById('bbgl-privacy-modal'); if (!modal) return; modal.querySelector('#bbgl-privacy-close').onclick = () => closePrivacyModal(); modal.onclick = e => { if (e.target === modal) closePrivacyModal(); }; if (!reviewMode) { const agreeBtn = modal.querySelector('#bbgl-privacy-agree-btn'), agreeWrap = modal.querySelector('.bbgl-agree-wrap'), ackBox = modal.querySelector('#bbgl-privacy-ack'); agreeBtn.classList.add('bbgl-btn-disabled'); const refreshAgreeState = () => { if (ackBox.checked) { agreeBtn.classList.remove('bbgl-btn-disabled'); if (agreeWrap) agreeWrap.removeAttribute('data-tooltip'); } else { agreeBtn.classList.add('bbgl-btn-disabled'); if (agreeWrap) agreeWrap.setAttribute('data-tooltip', app.TOOLTIPS.AGREE_GATE); } }; ackBox.onchange = refreshAgreeState; refreshAgreeState(); modal.querySelector('#bbgl-privacy-demo-btn').onclick = function () { this.blur(); app.enterDemo('privacy'); closePrivacyModal(); }; agreeBtn.onclick = function () { if (agreeBtn.classList.contains('bbgl-btn-disabled')) return; this.blur(); userConfig.privacyAgreed = new Date().toISOString(); saveConfig(); if (!runtime.wasVersionWiped) { localStorage.setItem(KEYS.CHANGELOG_VER, SCRIPT_VERSION); } closePrivacyModal(); app.refreshInitLock(); const wv = dom.welcomeView; if (wv && wv.classList.contains('active-view')) app.refreshInitMask(wv); }; } const disc = modal.querySelector('#bbgl-privacy-disc'); const wireDocSwap = container => { if (!container) return; container.querySelectorAll('[data-bbgl-doc]').forEach(link => { link.style.cursor = 'pointer'; link.onclick = async e => { e.preventDefault(); const name = link.getAttribute('data-bbgl-doc'); if (!name) return; container.innerHTML = DOC_LOADING_HTML; try { container.innerHTML = await fetchDoc(name); } catch (err) { container.innerHTML = DOC_ERROR_HTML; } wireDocSwap(container); }; }); }; try { const disclosureHTML = await fetchDoc('privacy'); if (disc) { disc.innerHTML = disclosureHTML; wireDocSwap(disc); } } catch (e) { if (disc) disc.innerHTML = DOC_ERROR_HTML; } }

app.fetchDoc = fetchDoc;
app.DOC_LOADING_HTML = DOC_LOADING_HTML;
app.DOC_ERROR_HTML = DOC_ERROR_HTML;
app.PRIVACY_TEXT = PRIVACY_TEXT;
app.buildPrivacyModalHTML = buildPrivacyModalHTML;
app.closePrivacyModal = closePrivacyModal;
app.buildChangelogModalHTML = buildChangelogModalHTML;
app.closeChangelogModal = closeChangelogModal;
app.openChangelogModal = openChangelogModal;
app.buildFeatureGuideModalHTML = buildFeatureGuideModalHTML;
app.closeFeatureGuideModal = closeFeatureGuideModal;
app.openFeatureGuideModal = openFeatureGuideModal;
app.openPrivacyModal = openPrivacyModal;
export { fetchDoc, DOC_LOADING_HTML, DOC_ERROR_HTML, PRIVACY_TEXT, buildPrivacyModalHTML, closePrivacyModal, buildChangelogModalHTML, closeChangelogModal, openChangelogModal, buildFeatureGuideModalHTML, closeFeatureGuideModal, openFeatureGuideModal, openPrivacyModal };

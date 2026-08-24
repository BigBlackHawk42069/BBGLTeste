import { app } from '../app-context.js';
import { BASE_DOCS_URL } from '../core/constants.ts';
import {
  closeChangelogModal,
  closeFeatureGuideModal,
  closePrivacyModal,
  openChangelogModal,
  openFeatureGuideModal,
  openPrivacyModal
} from './preact/Modals.tsx';

if (!app.docCache) app.docCache = {};

function fetchDoc(name) {
  if (app.docCache[name]) return Promise.resolve(app.docCache[name]);
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: 'GET',
      url: BASE_DOCS_URL + name + '.html?_=' + Date.now(),
      onload(res) {
        if (res.status >= 200 && res.status < 300) {
          app.docCache[name] = res.responseText;
          resolve(res.responseText);
        } else {
          reject(new Error(`Doc fetch failed: ${res.status}`));
        }
      },
      onerror() { reject(new Error('Doc fetch network error')); }
    });
  });
}

const DOC_LOADING_HTML = `<div style="padding:20px; text-align:center; color:#888;">Loading...</div>`;
const DOC_ERROR_HTML = `<div style="padding:20px; text-align:center; color:#888;">Could not load document. Check your connection.</div>`;
const PRIVACY_TEXT = { AGREE_LABEL: 'I have read and agree to this disclosure.' };

app.fetchDoc = fetchDoc;
app.DOC_LOADING_HTML = DOC_LOADING_HTML;
app.DOC_ERROR_HTML = DOC_ERROR_HTML;
app.PRIVACY_TEXT = PRIVACY_TEXT;
app.closePrivacyModal = closePrivacyModal;
app.closeChangelogModal = closeChangelogModal;
app.closeFeatureGuideModal = closeFeatureGuideModal;
app.openChangelogModal = openChangelogModal;
app.openFeatureGuideModal = openFeatureGuideModal;
app.openPrivacyModal = openPrivacyModal;

export {
  fetchDoc, DOC_LOADING_HTML, DOC_ERROR_HTML, PRIVACY_TEXT,
  closePrivacyModal, closeChangelogModal, openChangelogModal,
  closeFeatureGuideModal, openFeatureGuideModal, openPrivacyModal
};

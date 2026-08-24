import { app } from '../app-context.js';

function updateScanOverlayCount(n) {
  const el = document.querySelector('#bbgl-scan-count');
  if (el) el.textContent = String(n);
}

function renderScanOverlay() {
  if (typeof app.notifyUi === 'function') app.notifyUi();
}

app.updateScanOverlayCount = updateScanOverlayCount;
app.renderScanOverlay = renderScanOverlay;
export { updateScanOverlayCount, renderScanOverlay };

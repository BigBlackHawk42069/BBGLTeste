import { app } from '../app-context.js';
import { CUSTOM_STICKERS } from '../ui/assets.ts';
import { dom, runtime, saveViewState, userConfig, viewState } from '../core/state.ts';

function loadStickerData() {
  const unlocked = runtime.demoMode ? 1 : app.DataController.getUnlockedCount() || 1;
  const it = [];
  for (let i = 1; i <= 50; i++) {
    const c = CUSTOM_STICKERS.find(s => s.id === i);
    if (c) it.push({ type: 'image', ...c, unlocked: i <= unlocked });
    else it.push(null);
  }
  runtime.stickerData = it;
}

function renderStickers() {
  if (!runtime.stickerData.length) loadStickerData();
  if (typeof app.notifyUi === 'function') app.notifyUi();
}

function animateViewer(ts) {
  if (document.hidden || runtime.currentOpenedItemId === null || viewState.subView !== 'stickers' && viewState.subView !== 'viewer' && runtime.currentOpenedItemId === null) {
    if (runtime.viewerLoopId) cancelAnimationFrame(runtime.viewerLoopId);
    runtime.viewerLoopId = null;
    return;
  }
  if (!runtime.lastFrameTime) runtime.lastFrameTime = ts;
  const el = ts - runtime.lastFrameTime;
  if (el > 17) {
    runtime.lastFrameTime = ts - el % 17;
    const ped = dom.viPedestal || document.getElementById('vi-pedestal-wrapper');
    const obj = dom.viObj || document.getElementById('vi-obj-target');
    if (ped && obj) {
      runtime.viewerRotation += runtime.viewerSpeed;
      ped.style.transform = `rotateY(${runtime.viewerRotation}deg) translateZ(0)`;
      if (obj.classList.contains('is-image')) {
        const rad = runtime.viewerRotation * Math.PI / 180;
        const br = (0.7 + Math.sin(rad) * 0.3).toFixed(2);
        const isF = Math.cos(rad) > -0.2 ? 1 : 0;
        obj.style.setProperty('--sheen-pos', runtime.viewerRotation * 2.5 + '% 0%');
        obj.style.setProperty('--back-brightness', br);
        obj.style.setProperty('--sheen-opacity', isF);
      }
    }
  }
  runtime.viewerLoopId = requestAnimationFrame(animateViewer);
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && runtime.currentOpenedItemId !== null) {
    if (runtime.viewerLoopId) cancelAnimationFrame(runtime.viewerLoopId);
    animateViewer();
  }
});

function applyViewerArt(it) {
  const ob = document.getElementById('vi-obj-target');
  const nm = document.getElementById('vi-name-target');
  if (nm) nm.innerText = it.name;
  if (!ob) return;
  const lf = ob.querySelector('.layer-front');
  const lb = ob.querySelector('.layer-back');
  if (it.type === 'image') {
    ob.classList.add('is-image');
    ob.style.setProperty('--bg-mask', `url('${it.url}')`);
    if (lf) lf.style.backgroundImage = `url('${it.url}')`;
    if (lb) {
      lb.style.webkitMaskImage = `url('${it.url}')`;
      lb.style.maskImage = `url('${it.url}')`;
    }
  }
}

function bindViewerSpeed() {
  const st = document.querySelector('.viewer-stage');
  if (!st) return;
  const spdUp = () => { runtime.viewerSpeed = 3; };
  const spdDn = () => { runtime.viewerSpeed = 0.3; };
  st.onmousedown = spdUp;
  st.ontouchstart = spdUp;
  st.onmouseup = spdDn;
  st.onmouseleave = spdDn;
  st.ontouchend = spdDn;
  st.ontouchcancel = spdDn;
}

function openItemViewer(it, sv = true) {
  if (runtime.currentOpenedItemId === it.id) return;
  if (sv) {
    viewState.activeItemId = it.id;
    saveViewState();
  }
  if (app.TooltipController) app.TooltipController.hide();
  runtime.currentOpenedItemId = it.id;
  const v = document.getElementById('bbgl-item-viewer');
  const bp = dom.bottomPanel;
  if (bp) bp.style.setProperty('display', 'none', 'important');
  if (v) {
    v.classList.add('active');
    v.style.setProperty('display', 'flex', 'important');
  }
  const ped = document.getElementById('vi-pedestal-wrapper');
  if (ped) dom.viPedestal = ped;
  const ob = document.getElementById('vi-obj-target');
  if (ob) dom.viObj = ob;
  applyViewerArt(it);
  runtime.viewerRotation = 0;
  runtime.viewerSpeed = 0.3;
  if (runtime.viewerLoopId) cancelAnimationFrame(runtime.viewerLoopId);
  requestAnimationFrame(animateViewer);
  bindViewerSpeed();
  if (typeof app.notifyUi === 'function') app.notifyUi();
}

function closeItemViewer(sv = true) {
  if (sv) {
    viewState.activeItemId = null;
    saveViewState();
  }
  runtime.currentOpenedItemId = null;
  if (runtime.viewerLoopId) {
    cancelAnimationFrame(runtime.viewerLoopId);
    runtime.viewerLoopId = null;
  }
  const v = document.getElementById('bbgl-item-viewer');
  const bp = dom.bottomPanel;
  if (v) {
    v.classList.remove('active');
    v.style.setProperty('display', 'none', 'important');
  }
  if (bp) {
    bp.style.removeProperty('display');
    if (getComputedStyle(bp).display === 'none') bp.style.display = 'flex';
  }
  if (typeof app.notifyUi === 'function') app.notifyUi();
}

let _sponsorBurstPoints = null;

function getSponsorBurstPoints() {
  if (_sponsorBurstPoints) return _sponsorBurstPoints;
  const pts = [];
  for (let i = 0; i < 20; i++) {
    const angle = (i * 18 - 90) * Math.PI / 180;
    const r = i % 2 === 0 ? 48 : 36;
    const x = (50 + r * Math.cos(angle)).toFixed(2);
    const y = (50 + r * Math.sin(angle)).toFixed(2);
    pts.push(`${x},${y}`);
  }
  _sponsorBurstPoints = pts.join(' ');
  return _sponsorBurstPoints;
}

function changeStickerPage(d) {
  const apply = () => {
    viewState.currentStickerPage += d;
    runtime.currentStickerPage = viewState.currentStickerPage;
    saveViewState();
    renderStickers();
  };
  if (!userConfig.animations) {
    apply();
    return;
  }
  const oldActive = runtime.currentStickerPage === -1
    ? document.getElementById('bbgl-sponsor-grid')
    : document.getElementById('bbgl-sticker-grid');
  const bg = document.getElementById('bbgl-sticker-bg');
  if (oldActive) {
    const ghost = oldActive.cloneNode(true);
    ghost.style.pointerEvents = 'none';
    ghost.style.position = 'absolute';
    ghost.style.top = '0';
    ghost.style.left = '0';
    ghost.style.width = '100%';
    ghost.style.animation = d > 0 ? 'bbgl-slide-out-l 0.3s ease forwards' : 'bbgl-slide-out-r 0.3s ease forwards';
    oldActive.parentElement.appendChild(ghost);
    const removeGhost = () => { if (ghost.parentElement) ghost.remove(); };
    ghost.addEventListener('animationend', removeGhost, { once: true });
    const ghostTimer = setTimeout(removeGhost, 400);
    ghost.addEventListener('animationend', () => clearTimeout(ghostTimer), { once: true });
  }
  if (bg) {
    const bgGhost = bg.cloneNode(true);
    bgGhost.style.pointerEvents = 'none';
    bgGhost.style.position = 'absolute';
    bgGhost.style.top = '0';
    bgGhost.style.left = '0';
    bgGhost.style.width = '100%';
    bgGhost.style.animation = d > 0 ? 'bbgl-slide-out-l 0.3s ease forwards' : 'bbgl-slide-out-r 0.3s ease forwards';
    bg.parentElement.appendChild(bgGhost);
    const removeBgGhost = () => { if (bgGhost.parentElement) bgGhost.remove(); };
    bgGhost.addEventListener('animationend', removeBgGhost, { once: true });
    const bgGhostTimer = setTimeout(removeBgGhost, 400);
    bgGhost.addEventListener('animationend', () => clearTimeout(bgGhostTimer), { once: true });
  }
  apply();
  const newActive = runtime.currentStickerPage === -1
    ? document.getElementById('bbgl-sponsor-grid')
    : document.getElementById('bbgl-sticker-grid');
  if (newActive) {
    newActive.style.animation = d > 0 ? 'bbgl-slide-in-r 0.3s ease forwards' : 'bbgl-slide-in-l 0.3s ease forwards';
    newActive.addEventListener('animationend', () => { newActive.style.animation = ''; }, { once: true });
  }
  if (bg) {
    bg.style.animation = d > 0 ? 'bbgl-slide-in-r 0.3s ease forwards' : 'bbgl-slide-in-l 0.3s ease forwards';
    bg.addEventListener('animationend', () => { bg.style.animation = ''; }, { once: true });
  }
}

function closeDropdown(d) {
  d.classList.remove('show');
  d.style.position = '';
  d.style.top = '';
  d.style.left = '';
  d.style.zIndex = '';
}

function openDropdown(d, trigger) {
  d.style.position = 'fixed';
  d.style.top = '0px';
  d.style.left = '0px';
  d.style.zIndex = '9999999';
  d.classList.add('show');
  const origin = d.getBoundingClientRect();
  const r = trigger.getBoundingClientRect();
  d.style.top = r.bottom - origin.top + 2 + 'px';
  d.style.left = r.left - origin.left + 'px';
}

function toggleStickerView() {
  const mp = dom.panel, tb = dom.tallToggle;
  if (!viewState.isTall && mp && !mp.classList.contains('bbgl-mode-page')) {
    viewState.isTall = true;
    mp.classList.add('bbgl-tall');
    if (tb) tb.innerText = '–';
  }
  viewState.activeItemId = 1;
  app.switchView('stickers');
  setTimeout(() => {
    if (!runtime.stickerData.length) loadStickerData();
    const i = runtime.stickerData.find(x => x && x.id === (viewState.activeItemId || 1));
    if (i) openItemViewer(i, true);
  }, 400);
  saveViewState();
}

app.loadStickerData = loadStickerData;
app.renderStickers = renderStickers;
app.animateViewer = animateViewer;
app.openItemViewer = openItemViewer;
app.closeItemViewer = closeItemViewer;
app.getSponsorBurstPoints = getSponsorBurstPoints;
app.changeStickerPage = changeStickerPage;
app.closeDropdown = closeDropdown;
app.openDropdown = openDropdown;
app.toggleStickerView = toggleStickerView;
export {
  loadStickerData, renderStickers, animateViewer, openItemViewer, closeItemViewer,
  getSponsorBurstPoints, changeStickerPage, closeDropdown, openDropdown, toggleStickerView
};

import { useEffect, useRef } from 'preact/hooks';
import { app } from '../../../app-context.js';
import { runtime, saveViewState, viewState } from '../../../core/state.ts';
import { PAGE_TITLES } from '../../assets.ts';
import { TOOLTIPS } from '../../templates.js';
import { Island } from '../Island.tsx';
import { Raw } from '../html.tsx';
import { useUiTick } from '../store.ts';

type StickerItem = {
  id: number;
  name: string;
  url: string;
  type?: string;
  unlocked?: boolean;
} | null;

function ensureStickers() {
  if (!runtime.stickerData.length && typeof app.loadStickerData === 'function') app.loadStickerData();
}

function pageCount() {
  return Math.ceil((runtime.stickerData.length || 0) / 10);
}

function goPage(page: number) {
  runtime.currentStickerPage = page;
  viewState.currentStickerPage = page;
  saveViewState();
  if (typeof app.renderStickers === 'function') app.renderStickers();
}

function onNav(dir: number) {
  if (dir < 0 && runtime.currentStickerPage <= -1) return;
  if (dir > 0 && runtime.currentStickerPage >= pageCount() - 1) return;
  if (typeof app.changeStickerPage === 'function') app.changeStickerPage(dir);
}

export function StickerTitle() {
  useUiTick();
  ensureStickers();
  const page = runtime.currentStickerPage;
  const title = page === -1 ? 'Sponsorship' : (PAGE_TITLES[page] || '');
  return <div id="bbgl-sticker-title">{title}</div>;
}

export function StickersView() {
  useUiTick();
  ensureStickers();
  const page = runtime.currentStickerPage;
  const pages = pageCount();
  const start = Math.max(0, page) * 10;
  const items = (runtime.stickerData as StickerItem[]).slice(start, start + 10);
  const comingSoon = page >= 2;
  const sponsor = page === -1;
  const swipe = useRef({ x: 0, y: 0 });
  const pts = typeof app.getSponsorBurstPoints === 'function' ? app.getSponsorBurstPoints() : '';

  return (
    <>
    <div id="bbgl-sticker-bg" />
    <div
      id="bbgl-sticker-container"
      onTouchStart={e => { swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={e => {
        if ((window as Window & { _bbglScrubbing?: boolean })._bbglScrubbing) return;
        const dx = e.changedTouches[0].clientX - swipe.current.x;
        const dy = e.changedTouches[0].clientY - swipe.current.y;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          const dir = dx < 0 ? 1 : -1;
          if ((dir < 0 && page > -1) || (dir > 0 && page < pages - 1)) onNav(dir);
        }
      }}
    >
      <div
        id="sticker-sponsor-btn"
        class={'sticker-nav-btn' + (page === 0 ? '' : ' disabled')}
        onClick={e => { e.stopPropagation(); if (page === 0) onNav(-1); }}
      >❮</div>
      <div
        id="sticker-prev-btn"
        class={'sticker-nav-btn' + (page <= 0 ? ' disabled' : '')}
        onClick={e => { e.stopPropagation(); if (page > 0) onNav(-1); }}
      >❮</div>
      <div
        id="sticker-next-btn"
        class={'sticker-nav-btn' + (page >= pages - 1 ? ' disabled' : '')}
        onClick={e => { e.stopPropagation(); if (page < pages - 1) onNav(1); }}
      >❯</div>

      <div id="bbgl-sponsor-grid" style={{ display: sponsor ? 'grid' : 'none' }}>
        {[0, 1, 2].map(i => (
          <div key={i} class="sticker-slot sticker-slot-sponsor active-slot locked">
            <svg class="sponsor-sticker-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <polygon points={pts} fill="#ffffff" />
            </svg>
            <span class="sponsor-sticker-label">
              <Raw html={i === 0 ? 'Corleone Faction<br>Sticker Here ;)' : 'Your Faction<br>Sticker Here'} />
            </span>
          </div>
        ))}
      </div>

      <div id="bbgl-sticker-grid" style={{ display: sponsor ? 'none' : '' }}>
        {comingSoon ? null : items.map((it, i) => {
          if (!it) return <div key={i} class="sticker-slot" />;
          const unlocked = !!it.unlocked;
          return (
            <div
              key={it.id}
              class={'sticker-slot active-slot has-item' + (unlocked ? '' : ' locked')}
              data-tooltip={unlocked ? it.name : TOOLTIPS.LOCKED}
              onClick={unlocked ? () => app.openItemViewer(it) : undefined}
            >
              <img class="sticker-img" src={it.url} alt="" />
            </div>
          );
        })}
        {comingSoon ? <div id="bbgl-coming-soon" class="bbgl-coming-soon"><Raw html="Cumming<br>Soon..." /></div> : null}
      </div>

      <div id="bbgl-sticker-pagination">
        <div
          class={'pg-dot pg-dot-sponsor' + (sponsor ? ' active' : '')}
          onClick={() => goPage(-1)}
        />
        {Array.from({ length: pages }, (_, i) => (
          <div
            key={i}
            class={'pg-dot' + (i === page ? ' active' : '')}
            onClick={() => goPage(i)}
          />
        ))}
      </div>
    </div>
    </>
  );
}

export function ItemViewer() {
  useUiTick();
  const id = viewState.activeItemId || runtime.currentOpenedItemId;
  const item = (runtime.stickerData as StickerItem[]).find(x => x && x.id === id) || null;
  const open = !!(item && (viewState.subView === 'stickers' || viewState.subView === 'viewer' || runtime.currentOpenedItemId === item.id));

  useEffect(() => {
    const panel = document.getElementById('bbgl-panel');
    if (panel && typeof app.cacheDOM === 'function') app.cacheDOM(panel);
  });

  return (
    <div id="bbgl-item-viewer" class={open ? 'active' : undefined}>
      <div class="viewer-window">
        <div class="viewer-stage">
          <Island>
            <div class="viewer-pedestal" id="vi-pedestal-wrapper">
              <div class="viewer-obj" id="vi-obj-target">
                <div class="layer-front" />
                <div class="layer-back" />
              </div>
            </div>
          </Island>
        </div>
      </div>
      <div class="viewer-info-overlay">
        <div class="vi-name" id="vi-name-target">{item ? item.name : 'Item Name'}</div>
      </div>
    </div>
  );
}

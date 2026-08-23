import css from './styles.css';
import { ASSETS, CROWN_BADGE_URL } from './icons.ts';

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Aldrich&family=Barlow+Condensed:wght@400;500;700&family=Fjalla+One&family=Inconsolata:wght@400;500;600;700&family=Roboto+Mono:wght@400;500;700&family=VT323&display=swap';

function resolveCss(): string {
  const subs: Array<[string, string]> = [
    ['__ASSETS_GLASS_OVERLAY__', ASSETS.GLASS_OVERLAY],
    ['__ASSETS_STICKER_BG__', ASSETS.STICKER_BG],
    ['__ASSETS_HEADER_IMG__', ASSETS.HEADER_IMG],
    ['__ASSETS_NEW_STICKER_FRAME__', ASSETS.NEW_STICKER_FRAME],
    ['__CROWN_BADGE_URL__', CROWN_BADGE_URL]
  ];
  return subs.reduce((out, [token, value]) => out.split(token).join(value), css);
}

export function injectStyles(): void {
  if (document.getElementById('bbgl-styles')) return;
  const root = document.head || document.documentElement;
  if (!document.getElementById('bbgl-fonts')) {
    const pre = document.createElement('link');
    pre.id = 'bbgl-fonts-pre';
    pre.rel = 'preconnect';
    pre.href = 'https://fonts.gstatic.com';
    pre.crossOrigin = 'anonymous';
    root.appendChild(pre);
    const link = document.createElement('link');
    link.id = 'bbgl-fonts';
    link.rel = 'stylesheet';
    link.href = FONT_HREF;
    root.appendChild(link);
  }
  const style = document.createElement('style');
  style.id = 'bbgl-styles';
  style.textContent = resolveCss();
  root.appendChild(style);
}

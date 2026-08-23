import { boot } from './boot/boot.ts';

if (!window.__BBGL_LOADED__) {
  window.__BBGL_LOADED__ = true;
  boot();
}

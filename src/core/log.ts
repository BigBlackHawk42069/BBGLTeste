import { SCRIPT_VERSION } from './constants.ts';

let _isDev: () => boolean = () => false;

export function setDevChecker(fn: () => boolean): void {
  _isDev = fn;
}

export function isDevMode(): boolean {
  return _isDev();
}

const badge = ['%c BBGL %c', 'background:#6a1b9a;color:#fff;font-weight:700;border-radius:3px 0 0 3px;padding:2px 6px;', 'color:#999;'];

export const Log = {
  _bootShown: false,
  boot() {
    if (this._bootShown) return;
    this._bootShown = true;
    console.log(...badge, `v${SCRIPT_VERSION} booted`);
  },
  info(...a: unknown[]) { console.log(...badge, ...a); },
  warn(...a: unknown[]) { console.warn(...badge, ...a); },
  error(...a: unknown[]) { console.error(...badge, ...a); },
  debug(...a: unknown[]) {
    if (!_isDev()) return;
    console.log(...badge, '[debug]', ...a);
  },
  group(label: string, fn: () => void) {
    if (!_isDev()) { fn(); return; }
    console.groupCollapsed(...badge, label);
    try { fn(); } finally { console.groupEnd(); }
  }
};

export const Perf = {
  mark(n: string) {
    if (!_isDev()) return;
    try { performance.mark('bbgl:' + n); } catch { /* ignore */ }
  },
  start(n: string) { this.mark(n + ':start'); },
  end(n: string) {
    if (!_isDev()) return;
    try {
      performance.mark('bbgl:' + n + ':end');
      performance.measure('bbgl:' + n, 'bbgl:' + n + ':start', 'bbgl:' + n + ':end');
    } catch { /* ignore */ }
  },
  async wrapAsync<T>(n: string, fn: () => Promise<T>): Promise<T> {
    this.start(n);
    try { return await fn(); } finally { this.end(n); }
  },
  wrap<T>(n: string, fn: () => T): T {
    this.start(n);
    try { return fn(); } finally { this.end(n); }
  }
};

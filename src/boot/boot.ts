import '../ui/panel.js';
import '../ui/tooltip.js';
import '../data/torn-api.js';
import '../domain/history.js';
import '../data/db.js';
import '../data/sync.js';
import '../data/sanitize.js';
import '../data/wars.js';
import '../data/backfill.js';
import '../domain/demo.js';
import '../ui/achievements-view.js';
import '../ui/ledger.js';
import '../data/import-export.js';
import '../ui/best-gym.js';
import '../ui/calendar.js';
import '../ui/torn-inject.js';
import '../ui/templates.js';
import '../ui/docs.js';
import '../ui/graph.js';
import '../ui/stickers.js';
import '../boot/init.js';
import '../ui/scan-overlay.js';
import '../boot/events.js';
import '../ui/preact/mount.tsx';
import { app } from '../app-context.js';

export function boot() {
  if (app.TooltipController) window.TooltipController = app.TooltipController;
  if (typeof app.installDomHooks === 'function') app.installDomHooks();
  if (typeof app.init === 'function') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', app.init);
    else app.init();
  }
}

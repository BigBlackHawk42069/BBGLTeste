import { render } from 'preact';
import { app } from '../../app-context.js';
import { Dashboard } from './Dashboard.tsx';

export function mountDashboard(panel: HTMLElement): void {
  render(<Dashboard />, panel);
  if (typeof app.cacheDOM === 'function') app.cacheDOM(panel);
}

export function unmountDashboard(panel: HTMLElement): void {
  render(null, panel);
}

app.mountDashboard = mountDashboard;
app.unmountDashboard = unmountDashboard;

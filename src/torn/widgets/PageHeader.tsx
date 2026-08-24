import { render } from 'preact';
import { app } from '../../app-context.js';
import { runtime } from '../../core/state.ts';
import { ICONS } from '../../ui/icons.ts';
import { Raw } from '../../ui/preact/html.tsx';

export function PageHeader() {
  return (
    <div class="bbgl-native-header">
      <div class="bbgl-native-title">
        <span style={{ marginLeft: 8 }}>Big Black Gym Log</span>
      </div>
      <div class="bbgl-native-links">
        <div
          id="bbgl-page-demo-exit"
          class="bbgl-native-link"
          style={{ display: runtime.demoMode ? 'flex' : 'none' }}
          onClick={e => {
            e.stopPropagation();
            const demoBar = document.getElementById('bbgl-demo-exit');
            if (demoBar) demoBar.click();
          }}
        >
          <span class="bbgl-demo-x-label">Demo</span>
          <Raw html={ICONS.CLOSE} />
        </div>
        <div id="bbgl-page-settings" class="bbgl-native-link" onClick={e => app.toggleSettingsView(e)}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L3.16 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.58 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.08-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
          </svg>
          Settings
        </div>
      </div>
    </div>
  );
}

export function mountPageHeader(host: HTMLElement): void {
  const mount = document.createElement('div');
  mount.id = 'bbgl-page-header-host';
  host.insertBefore(mount, host.firstChild);
  render(<PageHeader />, mount);
}

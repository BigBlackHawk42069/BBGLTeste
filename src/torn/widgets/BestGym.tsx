import { render } from 'preact';
import { app } from '../../app-context.js';
import { userConfig } from '../../core/state.ts';
import { ICONS } from '../../ui/icons.ts';
import { TOOLTIPS } from '../../ui/templates.js';

export function BestGymPill() {
  return (
    <>
      <label class="bbgl-switch bbgl-switch-purple">
        <input
          type="checkbox"
          id="bbgl-bestgym-input"
          checked={!!userConfig.bestGym}
          onChange={e => app.setBestGym((e.target as HTMLInputElement).checked)}
        />
        <span class="slider" />
      </label>
      <svg class="bbgl-bestgym-logo" xmlns="http://www.w3.org/2000/svg" viewBox="60 20 280 215">
        <g transform="scale(1, 1.15)">
          <path fill="currentColor" d={ICONS.LOGO_PATH} />
        </g>
      </svg>
      <span class="bbgl-bestgym-label" data-tooltip-html={TOOLTIPS.BEST_GYM}>BB Best Gym</span>
    </>
  );
}

export function mountBestGym(pill: HTMLElement): void {
  pill.className = 'bbgl-bestgym';
  render(<BestGymPill />, pill);
}

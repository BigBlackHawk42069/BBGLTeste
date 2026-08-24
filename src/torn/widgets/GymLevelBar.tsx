import { render } from 'preact';
import { buildEmptyLevelTrackSVG } from '../../ui/templates.js';

export function GymLevelBar() {
  return (
    <>
      <div id="bbgl-gym-level-num" />
      <div id="bbgl-gym-level-track">
        <div dangerouslySetInnerHTML={{ __html: buildEmptyLevelTrackSVG() }} />
        <div id="bbgl-gym-level-fill" />
      </div>
    </>
  );
}

export function mountGymLevelBar(container: HTMLElement): void {
  render(<GymLevelBar />, container);
}

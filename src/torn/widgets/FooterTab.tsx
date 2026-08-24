import { render } from 'preact';
import { ICONS } from '../../ui/icons.ts';
import { Raw } from '../../ui/preact/html.tsx';

export function FooterTabIcon() {
  return <Raw html={ICONS.LOGO} />;
}

export function mountFooterTab(button: HTMLElement): void {
  const btn = button as HTMLButtonElement;
  btn.type = 'button';
  btn.setAttribute('data-tooltip', 'Big Black Gym Log');
  render(<FooterTabIcon />, btn);
}

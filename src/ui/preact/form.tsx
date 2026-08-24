import type { ComponentChildren, JSX } from 'preact';
import { MSG_CLIPBOARD_DENIED, bbglError } from '../../core/constants.ts';
import { ICONS } from '../icons.ts';
import { TOOLTIPS } from '../templates.js';
import { Raw } from './html.tsx';

export function Section(props: {
  title: string;
  extra?: ComponentChildren;
  bodyStyle?: JSX.CSSProperties;
  titleStyle?: JSX.CSSProperties;
  children?: ComponentChildren;
}) {
  return (
    <>
      <div class="bbgl-prefs-tab-title" style={props.titleStyle}>
        <span>{props.title}</span>
        {props.extra}
      </div>
      <div class="bbgl-settings-body" style={props.bodyStyle}>{props.children}</div>
    </>
  );
}

export function Row(props: {
  label: ComponentChildren;
  extraClass?: string;
  children?: ComponentChildren;
}) {
  return (
    <div class={`bbgl-setting-row${props.extraClass ? ` ${props.extraClass}` : ''}`}>
      {props.label}
      {props.children}
    </div>
  );
}

export function Toggle(props: {
  id: string;
  checked: boolean;
  label: string;
  tip?: string;
  extraClass?: string;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Row
      extraClass={props.extraClass}
      label={<span data-tooltip-html={props.tip}>{props.label}</span>}
    >
      <label class="bbgl-switch">
        <input
          id={props.id}
          type="checkbox"
          checked={props.checked}
          disabled={props.disabled}
          onChange={e => props.onChange((e.target as HTMLInputElement).checked)}
        />
        <span class="slider" />
      </label>
    </Row>
  );
}

export function Btn(props: {
  id: string;
  modifier?: string;
  style?: JSX.CSSProperties;
  disabled?: boolean;
  onClick?: (e: JSX.TargetedEvent<HTMLButtonElement>) => void;
  children: ComponentChildren;
}) {
  const cls = ['bbgl-btn', props.modifier ? `bbgl-btn-${props.modifier}` : ''].filter(Boolean).join(' ');
  return (
    <button
      id={props.id}
      type="button"
      class={cls}
      style={props.style}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

export function ApiField(props: {
  prefix: string;
  inputRef: { current: HTMLInputElement | null };
  defaultValue?: string;
  style?: JSX.CSSProperties;
}) {
  return (
    <div class="bbgl-api-container" style={props.style}>
      <div
        id={`${props.prefix}-api-paste`}
        class="bbgl-paste-icon"
        data-tooltip={TOOLTIPS.PASTE_CLIPBOARD}
        onClick={async () => {
          try {
            const t = await navigator.clipboard.readText();
            if (t && props.inputRef.current) props.inputRef.current.value = t.trim();
          } catch {
            bbglError(MSG_CLIPBOARD_DENIED);
          }
        }}
      >
        <Raw html={ICONS.PASTE} />
      </div>
      <input
        id={`${props.prefix}-api-key`}
        ref={el => { props.inputRef.current = el; }}
        type="text"
        name="bbgl_api_key"
        autocomplete="off"
        class="bbgl-native-input"
        placeholder="Enter Full or Custom API Key..."
        defaultValue={props.defaultValue || ''}
      />
    </div>
  );
}

export const STACK = {
  top: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottom: 'none' } as JSX.CSSProperties,
  mid: { borderRadius: 0, borderBottom: 'none' } as JSX.CSSProperties,
  bottom: { borderTopLeftRadius: 0, borderTopRightRadius: 0 } as JSX.CSSProperties
};

export const CREATE_API_URL = 'https://www.torn.com/preferences.php#tab=api?step=addNewKey&user=basic,battlestats,log&faction=rankedwars&logIds=54,50,23,6,52,56,3&title=BigBlackGymLog';

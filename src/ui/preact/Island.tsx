import { memo } from 'preact/compat';
import type { ComponentChildren } from 'preact';

function IslandInner(props: {
  id?: string;
  class?: string;
  html?: string;
  /** Skip generating a layout box so flex/grid CSS on the real host still applies. */
  contents?: boolean;
  children?: ComponentChildren;
}) {
  const style = props.contents ? { display: 'contents' } : undefined;
  if (props.html !== undefined) {
    return <div id={props.id} class={props.class} style={style} dangerouslySetInnerHTML={{ __html: props.html }} />;
  }
  return <div id={props.id} class={props.class} style={style}>{props.children}</div>;
}

/** Never reconciles after first paint. Vanilla renderers may write into these nodes. */
export const Island = memo(IslandInner, () => true);

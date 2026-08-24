import { useEffect, useState } from 'preact/hooks';
import { app } from '../../app-context.js';
import { setUiNotifier } from '../../core/state.ts';

type Listener = () => void;
const listeners = new Set<Listener>();

export function notifyUi(): void {
  listeners.forEach(fn => fn());
}

export function subscribeUi(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function useUiTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => subscribeUi(() => setTick(n => n + 1)), []);
  return tick;
}

setUiNotifier(notifyUi);
app.notifyUi = notifyUi;

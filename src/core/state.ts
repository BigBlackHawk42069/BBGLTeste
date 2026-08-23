import type { CalendarState, GraphState, HistoryState, RuntimeState, UserConfig, ViewState } from '../types.ts';
import { KEYS } from './constants.ts';
import { Log, setDevChecker } from './log.ts';

export const runtime: RuntimeState = {
  isClosing: false,
  isViewAnimating: false,
  isSyncing: false,
  backfilling: false,
  backfillAbort: null,
  apiCallTotal: 0,
  resizeObserver: null,
  stickerSlots: [],
  stickerData: [],
  currentStickerPage: 0,
  viewerLoopId: null,
  viewerRotation: 0,
  viewerSpeed: 0.3,
  currentOpenedItemId: null,
  lastFrameTime: 0,
  returnView: null,
  layoutRafId: null,
  currentStats: null,
  demoMode: false,
  demoHistory: null,
  demoEnteredFrom: null,
  devMode: false,
  _achCache: null,
  _achPage: 0,
  wasVersionWiped: false,
  careerLevelExp: 0
};

setDevChecker(() => runtime.devMode);

export const TAB_ID = Math.random().toString(36).slice(2);
export let historyCache: HistoryState | null = null;
export function setHistoryCache(next: HistoryState | null): void {
  historyCache = next;
}

export const refreshClickLog: number[] = [];
export const dom: Record<string, any> = {};
export let lastButtonLocation: string | null = null;
export function setLastButtonLocation(v: string | null): void { lastButtonLocation = v; }
export let topCeilingCache: number | null = null;
export let topCeilingTs = 0;
export function setTopCeiling(cache: number | null, ts: number): void {
  topCeilingCache = cache;
  topCeilingTs = ts;
}
export const layoutObservers: unknown[] = [];

export const graphState: GraphState = {
  activeStats: ['str', 'spd'],
  mode: 'values',
  isDragging: false,
  lockedStat: null,
  handlers: { scrub: null, start: null, end: null }
};

export let viewState: ViewState = {
  expanded: false,
  isOpen: false,
  isTall: false,
  subView: 'ledger',
  graphMode: 'values',
  calYear: null,
  calMonth: null,
  activeViewLabel: null,
  currentStickerPage: 0,
  achPage: 0,
  achEnhPeriodMode: false
};

export function setViewState(next: ViewState): void {
  viewState = next;
}

export const calendarState: CalendarState = {
  year: new Date().getUTCFullYear(),
  month: new Date().getUTCMonth(),
  visibleCells: [],
  selectedLabel: null,
  selectedData: null
};

export const userConfig: UserConfig = {
  apiKey: '',
  dayStartMode: 'utc',
  weekStartMode: 'mon',
  animations: true,
  buttonLocation: 'both',
  ratesEnabled: true,
  bestGym: true,
  bestGymSpecialist: true,
  bestGymUnpurchased: true,
  drugTracker: 'xanax',
  privacyAgreed: ''
};

export const ALLOWED_CONFIG_KEYS = Object.keys(userConfig) as Array<keyof UserConfig>;

function browserStorage(kind: 'localStorage' | 'sessionStorage'): Storage | null {
  try {
    const store = (globalThis as unknown as Record<string, Storage | undefined>)[kind];
    return store || null;
  } catch {
    return null;
  }
}

export function saveViewState(): void {
  if (runtime.isSyncing) return;
  browserStorage('localStorage')?.setItem(KEYS.STATE, JSON.stringify(viewState));
}

export function saveConfig(): void {
  const c: Partial<UserConfig> = {};
  ALLOWED_CONFIG_KEYS.forEach(k => {
    if (userConfig[k] !== undefined) (c as Record<string, unknown>)[k] = userConfig[k];
  });
  browserStorage('localStorage')?.setItem(KEYS.CONFIG, JSON.stringify(c));
}

export function hydratePersistedState(): void {
  const local = browserStorage('localStorage');
  const session = browserStorage('sessionStorage');
  const rawState = local?.getItem(KEYS.STATE) ?? null;
  if (rawState) {
    try {
      const saved = JSON.parse(rawState);
      viewState = { ...viewState, ...saved };
      graphState.mode = (viewState.graphMode === 'gains' ? 'values' : viewState.graphMode) || 'values';
      graphState.activeStats = viewState.graphStats || ['str', 'spd'];
      if (viewState.calYear) calendarState.year = viewState.calYear;
      if (viewState.calMonth !== null && viewState.calMonth !== undefined) calendarState.month = viewState.calMonth;
    } catch (e) {
      Log.warn('State load error', e);
    }
  }
  const rawConfig = local?.getItem(KEYS.CONFIG) ?? null;
  if (rawConfig) {
    try {
      const parsed = JSON.parse(rawConfig);
      ALLOWED_CONFIG_KEYS.forEach(k => {
        if (parsed[k] !== undefined) (userConfig as unknown as Record<string, unknown>)[k] = parsed[k];
      });
    } catch { /* ignore */ }
  }
  if (local?.getItem(KEYS.DEMO) === '1') runtime.demoMode = true;
  if (session?.getItem(KEYS.DEV_MODE) === 'true') runtime.devMode = true;
  if (!viewState.calYear) {
    const d = new Date();
    const local = userConfig.dayStartMode === 'local';
    calendarState.year = local ? d.getFullYear() : d.getUTCFullYear();
    calendarState.month = local ? d.getMonth() : d.getUTCMonth();
  }
}

hydratePersistedState();

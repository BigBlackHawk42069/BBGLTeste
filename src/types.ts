export type StatKey = 'str' | 'def' | 'spd' | 'dex';

export type StatBreakdown = Record<StatKey, number>;

export type DayTier = 'green' | 'gold' | 'diamond';

export type CapsuleColor = DayTier | 'silver';

export interface GymEntry {
  type?: 'gym';
  id?: string;
  ts: number;
  stat: StatKey;
  key?: string;
  gain: number;
  cost: number;
  after: number;
  rate?: number;
  synthetic?: boolean;
}

export interface ItemEntry {
  type: 'item';
  id?: string;
  ts: number;
  logId: number;
  energy?: number;
  energyLost?: number;
  happy?: number;
  happyLost?: number;
  statKey?: StatKey;
  statGain?: number;
  synthetic?: boolean;
}

export type SeriesEntry = GymEntry | ItemEntry;

export interface DayRecord {
  date: string;
  startTotal: number;
  endTotal: number;
  startBreakdown: StatBreakdown;
  endBreakdown: StatBreakdown;
  gains: StatBreakdown & { total: number };
  eSpent: StatBreakdown & { total: number };
  items: Record<string, number>;
  itemLogIds: string[];
  itemEnergy: number;
  itemHappy: number;
  itemEnergyLost?: number;
  itemHappyLost?: number;
  lastLogTimestamp: number;
  series: SeriesEntry[];
}

export interface BackfillState {
  acknowledged?: boolean;
  lastResult?: string;
  stopReason?: string;
  completion?: string;
  cooldownUntil?: number;
  lock?: number;
  lockOwner?: string;
  rowsUsed?: number;
  targets?: { frontiers?: Record<string, number> };
}

export interface HistoryMeta {
  version?: string;
  baselineBreakdown?: StatBreakdown;
  logStartDate?: number;
  rewardStartDate?: number;
  syncFloor?: Record<string, number>;
  stickers?: Record<string, string>;
  backfill?: BackfillState;
}

export interface HistoryState {
  meta: HistoryMeta;
  history: DayRecord[];
  today: DayRecord;
}

export interface UserConfig {
  apiKey: string;
  dayStartMode: 'utc' | 'local';
  weekStartMode: 'mon' | 'sun';
  animations: boolean;
  buttonLocation: 'both' | 'notes' | 'sidebar';
  ratesEnabled: boolean;
  bestGym: boolean;
  bestGymSpecialist: boolean;
  bestGymUnpurchased: boolean;
  drugTracker: string;
  privacyAgreed: string;
}

export interface ViewState {
  expanded: boolean;
  isOpen: boolean;
  isTall: boolean;
  subView: string;
  graphMode: string;
  calYear: number | null;
  calMonth: number | null;
  activeViewLabel: string | null;
  currentStickerPage: number;
  achPage: number;
  achEnhPeriodMode: boolean;
  graphStats?: string[];
  activeItemId?: number | null;
}

export interface CalendarState {
  year: number;
  month: number;
  visibleCells: unknown[];
  selectedLabel: string | null;
  selectedData: unknown;
}

export interface GraphState {
  activeStats: string[];
  mode: string;
  isDragging: boolean;
  lockedStat: string | null;
  handlers: { scrub: unknown; start: unknown; end: unknown };
}

export interface RuntimeState {
  isClosing: boolean;
  isViewAnimating: boolean;
  isSyncing: boolean;
  backfilling: boolean;
  backfillAbort: string | null;
  apiCallTotal: number;
  resizeObserver: ResizeObserver | null;
  stickerSlots: HTMLElement[];
  stickerData: unknown[];
  currentStickerPage: number;
  viewerLoopId: number | null;
  viewerRotation: number;
  viewerSpeed: number;
  currentOpenedItemId: number | null;
  lastFrameTime: number;
  returnView: string | null;
  layoutRafId: number | null;
  currentStats: unknown;
  demoMode: boolean;
  demoHistory: HistoryState | null;
  demoEnteredFrom: string | null;
  devMode: boolean;
  _achCache: unknown;
  _achPage: number;
  wasVersionWiped: boolean;
  careerLevelExp: number;
  [key: string]: unknown;
}

export interface SliceStat {
  start: number;
  gain: number;
  end: number;
  cost: number;
  rate: number;
}

export interface Slice {
  label: string;
  resolution: string;
  date: string;
  stats: Record<string, SliceStat>;
  meta: { tier: number; isGap: boolean; totalEnergy: number };
  _dailyList: DayRecord[];
  _weekStart?: string;
  _weekEnd?: string;
  items?: Record<string, number>;
  xanax?: number;
  xanaxODs?: number;
  lsdODs?: number;
  exODs?: number;
  odEnergyLost?: number;
  exHappyLost?: number;
  ecans?: number;
  ecanEnergy?: number;
  dayCount?: number;
}

export interface LevelProgress {
  atrophy: number;
  level: number;
  expInLevel: number;
  expToNext: number;
}

export interface ItemLogMeta {
  label: string;
  group: 'energy' | 'stat' | 'happy' | 'od';
  energy?: boolean;
  energyLost?: boolean;
  happy?: boolean;
  happyLost?: boolean;
  stat?: boolean;
  short?: string;
  achLabel?: string;
  achTipLabel?: string;
}

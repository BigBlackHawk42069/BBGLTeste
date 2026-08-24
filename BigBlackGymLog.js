// ==UserScript==
// @name         Big Black Gym Log Teste
// @namespace    http://tampermonkey.net/
// @version      0.9.91
// @description  A high-fidelity, gamified stat tracker built to integrate seamlessly with Torn's native UI.
// @author       BigBlackHawk [3550896]
// @match        https://www.torn.com/*
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @connect      cdn.jsdelivr.net
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/BigBlackHawk42069/BigBlackGymLog/main/BigBlackGymLog.js
// @downloadURL  https://raw.githubusercontent.com/BigBlackHawk42069/BigBlackGymLog/main/BigBlackGymLog.js
// ==/UserScript==

"use strict";
(() => {
  // src/app-context.js
  var app = {};

  // src/core/constants.ts
  var SCRIPT_VERSION = "0.9.91";
  var WIPE_BELOW_VERSION = "0.9.90";
  var BASE_DOCS_URL = "https://raw.githubusercontent.com/BigBlackHawk42069/BigBlackGymLog/DevBranch/UserDocs/";
  var KEYS = {
    STATE: "bbgl_view_state_v1",
    CONFIG: "bbgl_config_v1",
    SESSION: "bbgl_trained_flag",
    LAST_SYNC: "bbgl_last_data_sync_v1",
    SESSION_CACHE: "bbgl_session_cache_v1",
    DEMO: "bbgl_demo_mode",
    SB_NOTIF: "bbgl_sb_notif_seen",
    DEV_MODE: "bbgl_dev_mode",
    CHANGELOG_VER: "bbgl_changelog_seen_ver",
    CHANGELOG_NOTIF: "bbgl_changelog_notif",
    WARS_SYNC: "bbgl_wars_last_sync_v1",
    WARS_DATA: "bbgl_wars_data_v1",
    FACTION_HISTORY: "bbgl_faction_history_v1"
  };
  var CONSTANTS = {
    MONTHS: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    MONTHS_SHORT: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    COLORS: { STR: "#3264c6", DEF: "#dc3912", SPD: "#ff9900", DEX: "#109618", TOT: "#9d039d", GAINS: "#69f0ae" }
  };
  var GAME = {
    GOLD_WEEK_JUMPS: 3,
    HJ_WINDOW_SECONDS: 300,
    HJ_QUARTER_SECONDS: 900,
    STAT_MAP: { 5300: "strength", 5301: "defense", 5302: "speed", 5303: "dexterity" }
  };
  var ITEM_LOG_META = {
    8981: { label: "Green Egg Used", group: "energy", energy: true, short: "Egg", achLabel: "Green Eggs Used" },
    2290: { label: "Xanax Taken", group: "energy", energy: true, short: "Xans" },
    2230: { label: "LSD Taken", group: "energy", energy: true, short: "LSD" },
    2040: { label: "Energy Can Used", group: "energy", energy: true, short: "Cans", achLabel: "Energy Cans Used" },
    2190: { label: "Hotel Coupon Used", group: "energy", energy: true, short: "FHC", achLabel: "FHCs Used", achTipLabel: "Feathery Hotel Coupons Used" },
    4900: { label: "Points Refill Used", group: "energy", energy: true, short: "Refill", achLabel: "Refills Used" },
    2120: { label: "Parachute Used", group: "stat", stat: true, achLabel: "Parachutes Used" },
    2130: { label: "Skateboard Used", group: "stat", stat: true, achLabel: "Skateboards Used" },
    2140: { label: "Boxing Gloves Used", group: "stat", stat: true },
    2150: { label: "Dumbbells Used", group: "stat", stat: true },
    2020: { label: "Candy Used", group: "happy", happy: true },
    2180: { label: "Erotic DVD Used", group: "happy", happy: true, achLabel: "Erotic DVDs Used" },
    2210: { label: "Ecstasy Taken", group: "happy", happy: true },
    8983: { label: "Yellow Egg Used", group: "happy", happy: true, achLabel: "Yellow Eggs Used" },
    2291: { label: "Xanax OD", group: "od", energyLost: true, short: "Xan OD" },
    2231: { label: "LSD OD", group: "od", energyLost: true, short: "LSD OD" },
    2211: { label: "Ecstasy OD", group: "od", happyLost: true, energyLost: true, short: "Ex OD" }
  };
  var ITEM_GROUP_LABELS = { energy: "Energy Items", stat: "Stat Items", happy: "Happy Items", od: "OD Items" };
  var ITEM_LOGS = Object.keys(ITEM_LOG_META).map(Number);
  var itemLogsByGroup = (g4) => ITEM_LOGS.filter((id) => ITEM_LOG_META[id].group === g4);
  var TRAIN_LOGS = [5300, 5301, 5302, 5303];
  var ENERGY_LOGS = itemLogsByGroup("energy");
  var STAT_LOGS = itemLogsByGroup("stat");
  var HAPPY_LOGS = itemLogsByGroup("happy");
  var OD_LOGS = itemLogsByGroup("od");
  var TRAIN_ENERGY_PARAM = [...TRAIN_LOGS, ...ENERGY_LOGS].join(",");
  var STAT_HAPPY_PARAM = [...HAPPY_LOGS, ...OD_LOGS].join(",");
  var STAT_ENHANCER_PARAM = STAT_LOGS.join(",");
  var ENERGY_PARAM = ENERGY_LOGS.join(",");
  var BACKFILL_GROUPS = { trainEnergy: TRAIN_ENERGY_PARAM, statHappy: STAT_HAPPY_PARAM, statEnhancers: STAT_ENHANCER_PARAM };
  var BACKFILL_GROUP_KEYS = Object.keys(BACKFILL_GROUPS);
  var BACKFILL_GROUP_OF = {};
  [...TRAIN_LOGS, ...ENERGY_LOGS].forEach((c3) => {
    BACKFILL_GROUP_OF[String(c3)] = "trainEnergy";
  });
  [...HAPPY_LOGS, ...OD_LOGS].forEach((c3) => {
    BACKFILL_GROUP_OF[String(c3)] = "statHappy";
  });
  STAT_LOGS.forEach((c3) => {
    BACKFILL_GROUP_OF[String(c3)] = "statEnhancers";
  });
  var XANAX_LOG = 2290;
  var XANAX_OD_LOG = 2291;
  var LSD_OD_LOG = 2231;
  var EX_OD_LOG = 2211;
  var ECAN_LOG = 2040;
  var ECSTASY_LOG = 2210;
  var SYNC_FROM_BUFFER = 3 * 3600;
  var BACKFILL = {
    SOFT_CAP: 38e3,
    HARD_CAP: 4e4,
    COOLDOWN_MS: Math.round(24.1 * 3600 * 1e3),
    THROTTLE_MS: 700,
    CHECKPOINT_ROWS: 2e3,
    HEARTBEAT_MS: 15e3,
    LOCK_STALE_MS: 45e3,
    ORIGIN_MAX_STAT: 50
  };
  var GYM_TIERS = {
    str: [1, 2, 3, 4, [5, 6], 7, 8, 10, 9, [11, 12, 13], 14, [16, 17], [19, 20], 18, [22, 23], 21, 24, 26, 27, 31, 32],
    spd: [1, 2, [3, 4], [5, 6], 8, 9, [10, 11], 12, 13, 15, 14, 16, 17, [18, 20, 21], [19, 22], 23, 24, 26, 29, 31, 32],
    def: [1, 2, 3, 4, 5, 6, 7, [8, 9], [10, 13], 12, 11, [14, 15], 16, 18, [17, 19, 21], 20, [22, 23], 24, 25, 28, 31, 32],
    dex: [1, 2, 3, 5, 7, 6, 8, 9, 10, 11, 12, [13, 14], 15, 16, [17, 18], [21, 22], [19, 23], 20, 24, 25, 30, 31, 32]
  };
  var BS_STAT_ROWS = [
    { api: "strength", abbr: "str" },
    { api: "defense", abbr: "def" },
    { api: "speed", abbr: "spd" },
    { api: "dexterity", abbr: "dex" }
  ];
  var LAYOUT = { LIFT_HEIGHT: 43, BASE_RIGHT: 5 };
  var STAT_KEYS = ["str", "def", "spd", "dex"];
  var ZERO_BREAKDOWN = Object.freeze({ str: 0, def: 0, spd: 0, dex: 0 });
  var r2 = (v3) => Math.round(v3 * 100) / 100;
  var ACH_FMT = {
    compact: [[1e6, 2], [1e4, 1]],
    gains: [[1e12, 4], [1e9, 3]],
    enhancers: [[1e6, 3], [1e5, 2]],
    rewards: []
  };
  var BBGL_ERROR_CODE = "Error Code: 69420";
  var MSG_KEY_FORMAT_INVALID = "Invalid Format.\nA Torn API Key must be exactly 16 alphanumeric characters.";
  var MSG_CLIPBOARD_DENIED = "Clipboard access denied. Please paste manually.";
  var MSG_KEY_NETWORK_ERROR = "Network error while verifying your API key. Please try again.";
  var MSG_SYNC_NETWORK_ERROR = "Couldn't reach Torn's servers. Check your connection and try again.";
  var MSG_SYNC_QUOTA = "Sync failed because your browser ran out of local storage space. Close all open Torn tabs, clear your browser cache, and reload the page.";
  var TORN_KEY_ERROR_MAP = {
    2: "That key doesn't look valid \u2014 double-check you copied it correctly.",
    5: "Torn's API rate limit was hit. Wait a moment and try again.",
    8: "Torn has temporarily blocked API requests from your network. Wait a bit and try again.",
    10: "This key's owner is in federal jail, which disables their API key until release.",
    13: "This key's owner has been inactive too long and Torn has temporarily disabled it.",
    14: "Torn's daily API read limit has been reached for this key. Try again tomorrow.",
    16: "This key doesn't have the access level BBGL needs. Make sure it's a Custom key with Basic, Battle Stats, Log, and Faction access \u2014 not Public or Minimal.",
    18: "This key has been paused by its owner in Torn's API settings. Re-enable it there, or generate a new one."
  };
  function compareVersions(a3, b2) {
    const pa = String(a3).split(".").map(Number);
    const pb = String(b2).split(".").map(Number);
    const len = Math.max(pa.length, pb.length);
    for (let i3 = 0; i3 < len; i3++) {
      const na = pa[i3] || 0;
      const nb = pb[i3] || 0;
      if (na !== nb) return na < nb ? -1 : 1;
    }
    return 0;
  }
  function bbglError(msg) {
    alert(msg + `

${BBGL_ERROR_CODE}`);
  }
  function tornKeyErrorText(data) {
    const err = data && data.error;
    if (!err) return "Torn rejected this key for an unknown reason.";
    return TORN_KEY_ERROR_MAP[err.code] || `Torn says: "${err.error}".`;
  }

  // src/core/log.ts
  var _isDev = () => false;
  function setDevChecker(fn2) {
    _isDev = fn2;
  }
  var badge = ["%c BBGL %c", "background:#6a1b9a;color:#fff;font-weight:700;border-radius:3px 0 0 3px;padding:2px 6px;", "color:#999;"];
  var Log = {
    _bootShown: false,
    boot() {
      if (this._bootShown) return;
      this._bootShown = true;
      console.log(...badge, `v${SCRIPT_VERSION} booted`);
    },
    info(...a3) {
      console.log(...badge, ...a3);
    },
    warn(...a3) {
      console.warn(...badge, ...a3);
    },
    error(...a3) {
      console.error(...badge, ...a3);
    },
    debug(...a3) {
      if (!_isDev()) return;
      console.log(...badge, "[debug]", ...a3);
    },
    group(label, fn2) {
      if (!_isDev()) {
        fn2();
        return;
      }
      console.groupCollapsed(...badge, label);
      try {
        fn2();
      } finally {
        console.groupEnd();
      }
    }
  };
  var Perf = {
    mark(n2) {
      if (!_isDev()) return;
      try {
        performance.mark("bbgl:" + n2);
      } catch {
      }
    },
    start(n2) {
      this.mark(n2 + ":start");
    },
    end(n2) {
      if (!_isDev()) return;
      try {
        performance.mark("bbgl:" + n2 + ":end");
        performance.measure("bbgl:" + n2, "bbgl:" + n2 + ":start", "bbgl:" + n2 + ":end");
      } catch {
      }
    },
    async wrapAsync(n2, fn2) {
      this.start(n2);
      try {
        return await fn2();
      } finally {
        this.end(n2);
      }
    },
    wrap(n2, fn2) {
      this.start(n2);
      try {
        return fn2();
      } finally {
        this.end(n2);
      }
    }
  };

  // src/core/state.ts
  var runtime = {
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
  var TAB_ID = Math.random().toString(36).slice(2);
  var historyCache = null;
  function setHistoryCache(next) {
    historyCache = next;
  }
  var refreshClickLog = [];
  var dom = {};
  var lastButtonLocation = null;
  function setLastButtonLocation(v3) {
    lastButtonLocation = v3;
  }
  var topCeilingCache = null;
  var topCeilingTs = 0;
  function setTopCeiling(cache, ts) {
    topCeilingCache = cache;
    topCeilingTs = ts;
  }
  var layoutObservers = [];
  var graphState = {
    activeStats: ["str", "spd"],
    mode: "values",
    isDragging: false,
    lockedStat: null,
    handlers: { scrub: null, start: null, end: null }
  };
  var viewState = {
    expanded: false,
    isOpen: false,
    isTall: false,
    subView: "ledger",
    graphMode: "values",
    calYear: null,
    calMonth: null,
    activeViewLabel: null,
    currentStickerPage: 0,
    achPage: 0,
    achEnhPeriodMode: false
  };
  function setViewState(next) {
    viewState = next;
  }
  var calendarState = {
    year: (/* @__PURE__ */ new Date()).getUTCFullYear(),
    month: (/* @__PURE__ */ new Date()).getUTCMonth(),
    visibleCells: [],
    selectedLabel: null,
    selectedData: null
  };
  var userConfig = {
    apiKey: "",
    dayStartMode: "utc",
    weekStartMode: "mon",
    animations: true,
    buttonLocation: "both",
    ratesEnabled: true,
    bestGym: true,
    bestGymSpecialist: true,
    bestGymUnpurchased: true,
    drugTracker: "xanax",
    privacyAgreed: ""
  };
  var ALLOWED_CONFIG_KEYS = Object.keys(userConfig);
  var uiNotifier = null;
  function setUiNotifier(fn2) {
    uiNotifier = fn2;
  }
  function pingUi() {
    if (uiNotifier) uiNotifier();
  }
  function browserStorage(kind) {
    try {
      const store = globalThis[kind];
      return store || null;
    } catch {
      return null;
    }
  }
  function saveViewState() {
    if (!runtime.isSyncing) {
      browserStorage("localStorage")?.setItem(KEYS.STATE, JSON.stringify(viewState));
    }
    pingUi();
  }
  function saveConfig() {
    const c3 = {};
    ALLOWED_CONFIG_KEYS.forEach((k3) => {
      if (userConfig[k3] !== void 0) c3[k3] = userConfig[k3];
    });
    browserStorage("localStorage")?.setItem(KEYS.CONFIG, JSON.stringify(c3));
    pingUi();
  }
  function hydratePersistedState() {
    const local = browserStorage("localStorage");
    const session = browserStorage("sessionStorage");
    const rawState = local?.getItem(KEYS.STATE) ?? null;
    if (rawState) {
      try {
        const saved = JSON.parse(rawState);
        viewState = { ...viewState, ...saved };
        graphState.mode = (viewState.graphMode === "gains" ? "values" : viewState.graphMode) || "values";
        graphState.activeStats = viewState.graphStats || ["str", "spd"];
        if (viewState.calYear) calendarState.year = viewState.calYear;
        if (viewState.calMonth !== null && viewState.calMonth !== void 0) calendarState.month = viewState.calMonth;
      } catch (e3) {
        Log.warn("State load error", e3);
      }
    }
    const rawConfig = local?.getItem(KEYS.CONFIG) ?? null;
    if (rawConfig) {
      try {
        const parsed = JSON.parse(rawConfig);
        ALLOWED_CONFIG_KEYS.forEach((k3) => {
          if (parsed[k3] !== void 0) userConfig[k3] = parsed[k3];
        });
      } catch {
      }
    }
    if (local?.getItem(KEYS.DEMO) === "1") runtime.demoMode = true;
    if (session?.getItem(KEYS.DEV_MODE) === "true") runtime.devMode = true;
    if (!viewState.calYear) {
      const d3 = /* @__PURE__ */ new Date();
      const local2 = userConfig.dayStartMode === "local";
      calendarState.year = local2 ? d3.getFullYear() : d3.getUTCFullYear();
      calendarState.month = local2 ? d3.getMonth() : d3.getUTCMonth();
    }
  }
  hydratePersistedState();

  // src/domain/time.ts
  var TimeManager = {
    useLocal() {
      return userConfig.dayStartMode === "local";
    },
    year(d3) {
      return this.useLocal() ? d3.getFullYear() : d3.getUTCFullYear();
    },
    month(d3) {
      return this.useLocal() ? d3.getMonth() : d3.getUTCMonth();
    },
    date(d3) {
      return this.useLocal() ? d3.getDate() : d3.getUTCDate();
    },
    hours(d3) {
      return this.useLocal() ? d3.getHours() : d3.getUTCHours();
    },
    minutes(d3) {
      return this.useLocal() ? d3.getMinutes() : d3.getUTCMinutes();
    },
    now() {
      const d3 = /* @__PURE__ */ new Date();
      return { year: this.year(d3), month: this.month(d3), date: this.date(d3) };
    },
    dayStartTs(dateStr) {
      const [y3, m3, d3] = dateStr.split("-");
      return this.useLocal() ? new Date(+y3, +m3 - 1, +d3).getTime() : Formatter.parse(dateStr).getTime();
    }
  };
  var Formatter = {
    number(n2, d3 = 0) {
      return n2 === void 0 || n2 === null ? "0" : n2.toLocaleString("en-US", { minimumFractionDigits: d3, maximumFractionDigits: d3 });
    },
    abbr(n2, d3 = 1, strip = false) {
      if (!n2 && n2 !== 0) return "0";
      const abs = Math.abs(n2);
      if (abs < 1e3) return Math.trunc(n2).toString();
      const tiers = [[1e15, "q"], [1e12, "t"], [1e9, "b"], [1e6, "m"], [1e3, "k"]];
      for (const [mag, suffix] of tiers) {
        if (abs >= mag) {
          const dec = typeof d3 === "function" ? d3(mag, abs) : d3;
          let s3 = (n2 / mag).toFixed(dec);
          if (strip) s3 = parseFloat(s3).toString();
          return s3 + suffix;
        }
      }
      return Math.floor(n2).toString();
    },
    rate(n2, exp = false) {
      if (!n2 && n2 !== 0) return "0";
      if (n2 < 1e3) return this.number(n2, exp ? 2 : 1);
      if (exp) return this.number(Math.floor(n2), 0);
      return this.abbr(n2, 1);
    },
    achAbbr(n2, tiers) {
      if (!tiers || !tiers.length) return this.number(n2);
      const abs = Math.abs(n2);
      for (const [mag, dec] of tiers) {
        if (abs >= mag) return this.abbr(n2, dec);
      }
      return this.number(n2);
    },
    achDual(val, expandedTiers = ACH_FMT.compact) {
      const std = this.achAbbr(val, ACH_FMT.compact);
      const exp = this.achAbbr(val, expandedTiers);
      return `<span class="view-std">${std}</span><span class="view-exp">${exp}</span>`;
    },
    ratePct(v3) {
      if (Math.abs(v3) < 1e3) return this.number(v3, 0);
      return this.abbr(v3, 2, true);
    },
    dual(val, r4 = false) {
      let std;
      let exp;
      if (r4) {
        std = this.rate(val, false);
        exp = this.rate(val, true);
      } else {
        std = Math.abs(val) > 9999 ? this.abbr(val) : this.number(val);
        exp = Math.abs(val) >= 1e9 ? this.abbr(val, 4) : this.number(val);
      }
      return `<span class="view-std">${std}</span><span class="view-exp">${exp}</span>`;
    },
    axis(n2) {
      if (n2 === 0) return "0";
      if (Math.abs(n2) < 1e3) return (Math.round(n2 * 10) / 10).toString();
      return this.abbr(n2, 1, false);
    },
    parse(s3) {
      if (!s3) return /* @__PURE__ */ new Date();
      return new Date(s3.includes("T") ? s3 : s3 + "T00:00:00Z");
    },
    dateISO(y3, m3, d3) {
      return `${y3}-${String(m3 + 1).padStart(2, "0")}-${String(d3).padStart(2, "0")}`;
    },
    dateLogical(ts = null) {
      const d3 = ts ? new Date(ts) : /* @__PURE__ */ new Date();
      return this.dateISO(TimeManager.year(d3), TimeManager.month(d3), TimeManager.date(d3));
    },
    datePretty(s3) {
      if (!s3 || s3.includes("Summary")) return s3;
      const p3 = s3.split("-");
      if (p3.length !== 3) return s3;
      const d3 = this.parse(s3);
      return `${CONSTANTS.MONTHS_SHORT[d3.getUTCMonth()]} ${d3.getUTCDate()}, ${d3.getUTCFullYear()}`;
    },
    dateMonthDay(s3) {
      if (!s3) return s3;
      const p3 = s3.split("-");
      if (p3.length !== 3) return s3;
      const d3 = this.parse(s3);
      return `${CONSTANTS.MONTHS_SHORT[d3.getUTCMonth()]} ${d3.getUTCDate()}`;
    },
    dateFull(s3) {
      if (!s3 || s3.includes("Summary")) return s3;
      const p3 = s3.split("-");
      if (p3.length !== 3) return s3;
      const d3 = this.parse(s3);
      return `${CONSTANTS.MONTHS[d3.getUTCMonth()]} ${d3.getUTCDate()}, ${d3.getUTCFullYear()}`;
    }
  };
  function getISOWeek(s3) {
    const d3 = Formatter.parse(s3);
    const date = new Date(d3.valueOf());
    date.setUTCDate(date.getUTCDate() + 3 - (date.getUTCDay() + 6) % 7);
    const w1 = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
    return 1 + Math.round(((date.getTime() - w1.getTime()) / 864e5 - 3 + (w1.getUTCDay() + 6) % 7) / 7);
  }
  function getWeekKey(dateStr) {
    const d3 = Formatter.parse(dateStr);
    const dayIdx = d3.getUTCDay();
    const offset = userConfig.weekStartMode === "mon" ? dayIdx === 0 ? 6 : dayIdx - 1 : dayIdx;
    const weekStart = new Date(d3.getTime() - offset * 864e5);
    return Formatter.dateISO(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate());
  }

  // src/ui/panel.js
  function cacheDOM(root) {
    if (!root) return;
    dom.panel = root.id === "bbgl-panel" ? root : root.querySelector("#bbgl-panel") || root;
    if (!userConfig.animations) dom.panel.classList.add("bbgl-no-animations");
    if (!userConfig.ratesEnabled) dom.panel.classList.add("bbgl-no-rates");
    dom.topPanel = root.querySelector("#bbgl-top-panel");
    dom.bottomPanel = root.querySelector("#bbgl-bottom-panel");
    dom.settingsView = root.querySelector("#bbgl-settings-view");
    dom.welcomeView = root.querySelector("#bbgl-welcome-view");
    dom.itemViewer = root.querySelector("#bbgl-item-viewer");
    dom.dateLabel = root.querySelector("#bbgl-date-label");
    dom.summaryLabel = root.querySelector("#bbgl-summary-label");
    dom.ledgerView = root.querySelector("#bbgl-ledger-view");
    dom.graphContainer = root.querySelector("#bbgl-graph-container");
    dom.graphSvg = root.querySelector("#bbgl-graph-svg");
    dom.calContainer = root.querySelector("#bbgl-cal-container");
    dom.tallToggle = root.querySelector("#bbgl-tall-toggle");
    dom.copyBtn = root.querySelector("#bbgl-copy-btn");
    dom.itemCounters = root.querySelector("#bbgl-item-counters");
    dom.popBtn = root.querySelector("#bbgl-pop-btn");
    dom.monthTrigger = root.querySelector("#month-trigger");
    dom.yearTrigger = root.querySelector("#year-trigger");
    dom.monthDropdown = root.querySelector("#bbgl-month-dropdown");
    dom.yearDropdown = root.querySelector("#bbgl-year-dropdown");
    dom.achievementsContainer = root.querySelector("#bbgl-achievements-container");
    dom.achievementsToggle = root.querySelector("#bbgl-achievements-toggle");
    dom.stickerGrid = root.querySelector("#bbgl-sticker-grid");
    dom.stickerPagination = root.querySelector("#bbgl-sticker-pagination");
    dom.stickerTitle = root.querySelector("#bbgl-sticker-title");
    dom.stickerPrev = root.querySelector("#sticker-prev-btn");
    dom.stickerNext = root.querySelector("#sticker-next-btn");
    dom.stickerSponsor = root.querySelector("#sticker-sponsor-btn");
    dom.stickerContainer = root.querySelector("#bbgl-sticker-container");
    dom.stickerBg = root.querySelector("#bbgl-sticker-bg");
    dom.viPedestal = root.querySelector("#vi-pedestal-wrapper");
    dom.viObj = root.querySelector("#vi-obj-target");
    dom.viName = root.querySelector("#vi-name-target");
    dom.refreshBtn = root.querySelector("#refresh-log-btn");
    dom.contentWrapper = root.querySelector("#bbgl-content-wrapper");
    if (!dom.apiHud) dom.apiHud = document.getElementById("bbgl-api-hud");
    if (!dom.gymTab) dom.gymTab = document.getElementById("bbgl-gym-tab");
  }
  function togglePanel(click = false) {
    if (window.location.hash.includes("gymlog")) return;
    let p3 = document.getElementById("bbgl-panel");
    const b2 = dom.gymTab;
    if (click && p3 && p3.style.display !== "none") {
      closePanel();
      return;
    }
    if (!p3) {
      p3 = document.createElement("div");
      p3.id = "bbgl-panel";
      if (viewState.expanded) p3.classList.add("bbgl-expanded");
      else p3.classList.add("bbgl-compact");
      if (viewState.isTall) p3.classList.add("bbgl-tall");
      document.body.appendChild(p3);
      app.mountDashboard(p3);
    }
    if (p3.style.display === "none" || !p3.style.display) {
      restoreInternalState();
      p3.style.opacity = "0";
      p3.style.display = "flex";
      app.handleLayout();
      void p3.offsetWidth;
      updateTransformOrigin();
      if (b2) b2.classList.add("bbgl-tab-active");
      p3.classList.remove("bbgl-animate-vanish", "bbgl-animate-pop");
      if (userConfig.animations) {
        void p3.offsetWidth;
        p3.classList.add("bbgl-animate-pop");
      }
      p3.style.opacity = "";
      if (click) {
        viewState.isOpen = true;
        saveViewState();
      }
    } else if (click) closePanel();
  }
  function restoreInternalState() {
    const mp = dom.panel;
    if (viewState.calYear && viewState.calMonth !== void 0 && viewState.calMonth !== null) {
      calendarState.year = viewState.calYear;
      calendarState.month = viewState.calMonth;
    }
    if (viewState.currentStickerPage !== void 0) runtime.currentStickerPage = viewState.currentStickerPage;
    app.GraphController.applyDefaultsIfNeeded();
    if (viewState.graphMode) graphState.mode = (viewState.graphMode === "gains" ? "values" : viewState.graphMode) || "values";
    if (viewState.graphStats) graphState.activeStats = viewState.graphStats;
    app.GraphController.restoreUi();
    if (viewState.activeViewLabel) {
      const s3 = app.getActiveHistory();
      let td = null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(viewState.activeViewLabel)) {
        td = s3.history.find((d3) => d3.date === viewState.activeViewLabel);
        if (!td && s3.today.date === viewState.activeViewLabel) td = s3.today;
        if (td) {
          calendarState.selectedData = td;
          calendarState.selectedLabel = viewState.activeViewLabel;
          app.renderStats(td, viewState.activeViewLabel);
        }
      } else {
        const mn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        if (mn.includes(viewState.activeViewLabel)) app.calcPeriodStats("month");
        else if (/^\d{4}$/.test(viewState.activeViewLabel)) app.calcPeriodStats("year");
        else if (viewState.activeViewLabel === "All-Time") app.calcAllTimeStats();
      }
    }
    app.renderPanelContent();
    const et = () => {
      if (mp && !mp.classList.contains("bbgl-mode-page") && !mp.classList.contains("bbgl-tall")) {
        mp.classList.add("bbgl-tall");
        const t3 = dom.tallToggle;
        if (t3) t3.innerText = "\u2013";
        viewState.isTall = true;
        saveViewState();
      }
    };
    const _hasData = historyCache && (historyCache.history.length > 0 || historyCache.meta && historyCache.meta.logStartDate);
    if (viewState.subView === "settings") switchView("settings", true);
    else if (viewState.subView === "welcome" || !runtime.demoMode && !_hasData && !localStorage.getItem("bbgl_initialized")) switchView("welcome", true);
    else if (viewState.subView === "graph") {
      et();
      switchView("graph", true);
      setTimeout(() => window.requestAnimationFrame(() => app.GraphController.draw()), 350);
    } else if (viewState.subView === "stickers") {
      et();
      if (!runtime.stickerData || runtime.stickerData.length === 0) app.loadStickerData();
      let ti = Number(viewState.activeItemId);
      if (!ti || ti < 1) {
        ti = 1;
        viewState.activeItemId = 1;
        saveViewState();
      }
      switchView("stickers", true);
      const i3 = runtime.stickerData.find((x3) => x3.id === ti);
      if (i3) {
        const bp = dom.bottomPanel;
        if (bp) bp.style.setProperty("display", "none", "important");
        setTimeout(() => app.openItemViewer(i3, false), 50);
      }
    } else if (viewState.subView === "achievements") {
      et();
      switchView("achievements", true);
    } else switchView("ledger", true);
  }
  function switchView(tgt, inst = false) {
    const tp = dom.topPanel, bp = dom.bottomPanel, sp = dom.settingsView, vp = dom.itemViewer, wv = dom.welcomeView;
    let cm = "ledger";
    if (wv && wv.classList.contains("active-view")) cm = "welcome";
    else if (sp.classList.contains("active-view")) cm = "settings";
    else if (tp.classList.contains("viewing-graph")) cm = "graph";
    else if (tp.classList.contains("viewing-stickers")) cm = "stickers";
    else if (tp.classList.contains("viewing-achievements")) cm = "achievements";
    if (cm === tgt && !inst) return;
    if (cm === "stickers" && tgt !== "stickers" && !inst) {
      runtime.currentStickerPage = 0;
      viewState.currentStickerPage = 0;
    }
    viewState.subView = tgt;
    saveViewState();
    runtime.currentOpenedItemId = null;
    if (runtime.viewerLoopId) {
      cancelAnimationFrame(runtime.viewerLoopId);
      runtime.viewerLoopId = null;
    }
    const gel = (m3) => {
      if (m3 === "settings") return sp;
      if (m3 === "welcome") return wv;
      if (m3 === "graph") return dom.graphContainer;
      if (m3 === "stickers") return dom.stickerContainer;
      if (m3 === "achievements") return dom.achievementsContainer;
      return dom.ledgerView;
    };
    const cel = gel(cm), nel = gel(tgt);
    const applyView = () => {
      tp.classList.remove("viewing-graph", "viewing-stickers", "viewing-achievements");
      sp.classList.remove("active-view");
      if (wv) wv.classList.remove("active-view");
      tp.style.display = "flex";
      if (!(tgt === "stickers" && viewState.activeItemId)) {
        bp.style.removeProperty("display");
        if (getComputedStyle(bp).display === "none") bp.style.display = "flex";
        vp.classList.remove("active");
        vp.style.setProperty("display", "none", "important");
      }
      if (tgt === "welcome") {
        if (wv) {
          wv.classList.add("active-view");
          if (typeof app.refreshInitMask === "function") app.refreshInitMask(wv);
        }
        tp.style.display = "none";
        bp.style.display = "none";
      } else if (tgt === "settings") {
        sp.classList.add("active-view");
        tp.style.display = "none";
        bp.style.display = "none";
        if (typeof app.refreshDemoMasks === "function") app.refreshDemoMasks();
      } else if (tgt === "graph") {
        tp.classList.add("viewing-graph");
        app.GraphController.restoreUi();
        app.GraphController.draw();
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (dom.topPanel && dom.topPanel.classList.contains("viewing-graph")) app.GraphController.draw();
        }));
      } else if (tgt === "stickers") {
        tp.classList.add("viewing-stickers");
        app.renderStickers();
        if (cm !== "stickers" && dom.stickerSponsor && userConfig.animations) {
          dom.stickerSponsor.classList.remove("shimmer-once");
          void dom.stickerSponsor.offsetWidth;
          dom.stickerSponsor.classList.add("shimmer-once");
        }
      } else if (tgt === "achievements") {
        tp.classList.add("viewing-achievements");
        app.renderAchievements();
      } else app.renderPanelContent();
      app.renderScanOverlay();
    };
    if (inst) {
      applyView();
      return;
    }
    if (runtime.isViewAnimating) {
      cel.classList.remove("bbgl-crt-out", "bbgl-crt-in");
      nel.classList.remove("bbgl-crt-out", "bbgl-crt-in");
      runtime.isViewAnimating = false;
    }
    runtime.isViewAnimating = true;
    if (!userConfig.animations) {
      applyView();
      runtime.isViewAnimating = false;
    } else if (cm === "settings") {
      applyView();
      nel.classList.add("bbgl-crt-in");
      setTimeout(() => {
        nel.classList.remove("bbgl-crt-in");
        runtime.isViewAnimating = false;
      }, 300);
    } else if (tgt === "settings") {
      cel.classList.add("bbgl-crt-out");
      setTimeout(() => {
        cel.classList.remove("bbgl-crt-out");
        applyView();
        runtime.isViewAnimating = false;
      }, 280);
    } else if (tgt === "stickers") {
      cel.classList.add("bbgl-crt-out");
      setTimeout(() => {
        cel.classList.remove("bbgl-crt-out");
        applyView();
        runtime.isViewAnimating = false;
      }, 280);
    } else if (cm === "stickers") {
      nel.classList.add("bbgl-crt-in");
      applyView();
      setTimeout(() => {
        nel.classList.remove("bbgl-crt-in");
        runtime.isViewAnimating = false;
      }, 300);
    } else {
      cel.classList.add("bbgl-crt-out");
      setTimeout(() => {
        cel.classList.remove("bbgl-crt-out");
        nel.classList.add("bbgl-crt-in");
        applyView();
        setTimeout(() => {
          nel.classList.remove("bbgl-crt-in");
          runtime.isViewAnimating = false;
        }, 300);
      }, 280);
    }
  }
  function closePanel(e3) {
    if (e3) e3.stopPropagation();
    if (runtime.isClosing) return;
    const p3 = dom.panel, b2 = dom.gymTab;
    if (!p3) return;
    runtime.isClosing = true;
    viewState.isOpen = false;
    viewState.isTall = false;
    viewState.subView = "ledger";
    viewState.activeViewLabel = null;
    viewState.achEnhPeriodMode = false;
    viewState.graphStats = void 0;
    viewState.graphMode = void 0;
    runtime.currentStickerPage = 0;
    viewState.currentStickerPage = 0;
    const _n = TimeManager.now();
    viewState.calYear = _n.year;
    viewState.calMonth = _n.month;
    saveViewState();
    const sp = dom.settingsView, tp = dom.topPanel, bp = dom.bottomPanel, wv = dom.welcomeView;
    if (sp) sp.classList.remove("active-view");
    if (wv) wv.classList.remove("active-view");
    if (tp) {
      tp.style.display = "flex";
      tp.classList.remove("viewing-graph", "viewing-stickers", "viewing-achievements");
    }
    if (bp) bp.style.display = "flex";
    app.closeItemViewer(false);
    calendarState.year = viewState.calYear;
    calendarState.month = viewState.calMonth;
    calendarState.selectedData = null;
    calendarState.selectedLabel = null;
    app.renderPanelContent();
    if (b2) b2.classList.remove("bbgl-tab-active");
    updateTransformOrigin();
    p3.classList.remove("bbgl-animate-pop");
    p3.classList.remove("bbgl-tall");
    const tt = dom.tallToggle;
    if (tt) tt.innerText = "+";
    if (userConfig.animations) {
      p3.classList.add("bbgl-animate-vanish");
      setTimeout(() => {
        p3.style.display = "none";
        p3.classList.remove("bbgl-animate-vanish");
        runtime.isClosing = false;
        app.handleLayout();
      }, 300);
    } else {
      p3.style.display = "none";
      runtime.isClosing = false;
      app.handleLayout();
    }
  }
  function toggleTall() {
    const p3 = dom.panel, b2 = dom.tallToggle;
    if (p3.classList.contains("bbgl-mode-page")) return;
    p3.classList.toggle("bbgl-tall");
    const t3 = p3.classList.contains("bbgl-tall");
    b2.innerText = t3 ? "\u2013" : "+";
    viewState.isTall = t3;
    saveViewState();
    const tp = dom.topPanel;
    if (!t3) {
      if (tp.classList.contains("viewing-graph") || tp.classList.contains("viewing-stickers") || tp.classList.contains("viewing-achievements")) switchView("ledger");
    } else {
      if (tp.classList.contains("viewing-graph")) {
        app.GraphController.draw();
        setTimeout(app.GraphController.draw, 320);
      }
    }
  }
  function toggleLedgerView() {
    switchView("ledger");
    saveViewState();
  }
  function toggleGraphView() {
    switchView("graph");
    saveViewState();
  }
  function toggleSettingsView(e3) {
    if (e3) e3.stopPropagation();
    const sp = dom.settingsView, tp = dom.topPanel, vp = dom.itemViewer;
    if (sp.classList.contains("active-view")) {
      let t3 = runtime.returnView || "ledger";
      if (t3 === "viewer") {
        switchView("stickers");
        viewState.subView = "stickers";
        if (viewState.activeItemId) setTimeout(() => {
          if (!runtime.stickerData.length) app.loadStickerData();
          const i3 = runtime.stickerData.find((x3) => x3.id === viewState.activeItemId);
          if (i3) app.openItemViewer(i3, false);
        }, 50);
      } else {
        switchView(t3);
        viewState.subView = t3;
      }
    } else {
      if (vp && vp.classList.contains("active")) runtime.returnView = "viewer";
      else if (tp.classList.contains("viewing-graph")) runtime.returnView = "graph";
      else if (tp.classList.contains("viewing-stickers")) runtime.returnView = "stickers";
      else if (tp.classList.contains("viewing-achievements")) runtime.returnView = "achievements";
      else runtime.returnView = "ledger";
      switchView("settings");
      viewState.subView = "settings";
    }
    saveViewState();
  }
  function updateTransformOrigin() {
    const p3 = dom.panel, b2 = dom.gymTab;
    if (!p3 || !b2) {
      runtime.transformOriginRetries = 0;
      return;
    }
    const pr = p3.getBoundingClientRect(), br = b2.getBoundingClientRect();
    if (pr.width === 0 || pr.height === 0) {
      runtime.transformOriginRetries = (runtime.transformOriginRetries || 0) + 1;
      if (runtime.transformOriginRetries > 30) {
        runtime.transformOriginRetries = 0;
        return;
      }
      window.requestAnimationFrame(updateTransformOrigin);
      return;
    }
    runtime.transformOriginRetries = 0;
    const cx = br.left + br.width / 2, cy = br.top + br.height / 2;
    p3.style.transformOrigin = `${cx - pr.left}px ${cy - pr.top}px`;
  }
  app.cacheDOM = cacheDOM;
  app.togglePanel = togglePanel;
  app.restoreInternalState = restoreInternalState;
  app.switchView = switchView;
  app.closePanel = closePanel;
  app.toggleTall = toggleTall;
  app.toggleLedgerView = toggleLedgerView;
  app.toggleGraphView = toggleGraphView;
  app.toggleSettingsView = toggleSettingsView;
  app.updateTransformOrigin = updateTransformOrigin;

  // src/ui/tooltip.js
  var TooltipController = { el: null, arrow: null, currentTarget: null, init() {
    if (this.el) return;
    this.el = document.createElement("div");
    this.el.id = "bbgl-tooltip";
    this.arrow = document.createElement("div");
    this.arrow.id = "bbgl-tooltip-arrow";
    this.el.appendChild(this.arrow);
    document.body.appendChild(this.el);
  }, hide() {
    if (this.el) {
      this.el.style.display = "none";
      this.currentTarget = null;
    }
  }, show(html, rect, forceSide) {
    if (!this.el) this.init();
    this.el.innerHTML = html;
    this.el.appendChild(this.arrow);
    this.el.style.display = "block";
    this.el.className = "";
    const ttRect = this.el.getBoundingClientRect(), pad = 12, view = { w: window.innerWidth, h: window.innerHeight };
    let side = "top";
    const fitsTop = rect.top - ttRect.height - pad >= 0, fitsBot = rect.bottom + ttRect.height + pad <= view.h;
    if (forceSide) side = forceSide;
    else if (fitsTop) side = "top";
    else if (fitsBot) side = "bottom";
    else side = "left";
    let x3 = 0, y3 = 0;
    if (side === "top") {
      x3 = rect.left + rect.width / 2 - ttRect.width / 2;
      y3 = rect.top - ttRect.height - pad;
    } else if (side === "bottom") {
      x3 = rect.left + rect.width / 2 - ttRect.width / 2;
      y3 = rect.bottom + pad;
    } else {
      x3 = rect.left - ttRect.width - pad;
      y3 = rect.top + rect.height / 2 - ttRect.height / 2;
    }
    if (x3 < 5) x3 = 5;
    if (x3 + ttRect.width > view.w - 5) x3 = view.w - ttRect.width - 5;
    if (y3 < 5) y3 = 5;
    if (y3 + ttRect.height > view.h - 5) y3 = view.h - ttRect.height - 5;
    this.el.style.left = x3 + "px";
    this.el.style.top = y3 + "px";
    this.el.classList.add("pos-" + side);
    this.arrow.style.marginLeft = "";
    this.arrow.style.marginTop = "";
  }, resolve(target) {
    return target.closest("[data-tooltip], [data-tooltip-html]");
  }, handleHover(e3) {
    const t3 = this.resolve(e3.target);
    if (!t3) {
      if (this.currentTarget) this.hide();
      return;
    }
    if (this.currentTarget === t3) return;
    this.currentTarget = t3;
    const h3 = t3.getAttribute("data-tooltip-html"), txt = t3.getAttribute("data-tooltip");
    const side = t3.getAttribute("data-tooltip-side") || void 0;
    const anchorSel = t3.getAttribute("data-tooltip-anchor");
    let rect;
    if (anchorSel) {
      const anchor = t3.closest(".bbgl-weekly-anchor")?.querySelector(anchorSel);
      if (anchor) {
        const r4 = anchor.getBoundingClientRect();
        const activeH = parseFloat(getComputedStyle(anchor).getPropertyValue("--bbgl-handle-active-h")) || 32;
        rect = { left: r4.left, width: r4.width, bottom: r4.bottom, top: r4.bottom - activeH, height: activeH };
      } else {
        rect = t3.getBoundingClientRect();
      }
    } else {
      rect = t3.getBoundingClientRect();
    }
    if (h3) this.show(h3, rect, side);
    else if (txt) this.show('<div style="text-align:center; color:#ddd;">' + txt + "</div>", t3.getBoundingClientRect(), side);
    else this.hide();
  } };
  function generateRichTooltip(sl) {
    const f4 = Formatter.abbr, fg = (n2) => (n2 > 0 ? "+" : "") + f4(n2), s3 = sl.stats;
    const MOS = CONSTANTS.MONTHS_SHORT;
    let lbl;
    if (sl.resolution === "DAY") {
      const d3 = Formatter.parse(sl.date);
      lbl = `${MOS[d3.getUTCMonth()]} ${d3.getUTCDate()} \u2022 ${d3.getUTCFullYear()}`;
    } else if (sl.resolution === "WEEK") {
      if (sl._weekStart && sl._weekEnd) {
        const dS = Formatter.parse(sl._weekStart);
        lbl = `Week of ${MOS[dS.getUTCMonth()]} ${dS.getUTCDate()} \u2022 ${dS.getUTCFullYear()}`;
      } else {
        lbl = sl.label || Formatter.datePretty(sl.date);
      }
    } else if (sl.resolution === "MONTH") {
      const mIdx = CONSTANTS.MONTHS.indexOf(sl.label);
      const year = sl._dailyList && sl._dailyList.length > 0 ? sl._dailyList[0].date.slice(0, 4) : sl.date ? sl.date.slice(0, 4) : String(calendarState.year);
      lbl = `${mIdx >= 0 ? MOS[mIdx] : sl.label} \u2022 ${year}`;
    } else if (sl.resolution === "YEAR") {
      const days = sl._dailyList ? sl._dailyList.filter((d3) => d3.eSpent && d3.eSpent.total > 0).length : 0;
      lbl = `${days} Day${days !== 1 ? "s" : ""} \u2022 ${sl.label}`;
    } else {
      lbl = Formatter.datePretty(sl.label || sl.date);
    }
    let h3 = `<div class="tt-header">${lbl}</div><div class="tt-energy" style="margin-bottom:6px; padding-bottom:4px; border-bottom:1px solid #555;">Energy: ${Formatter.number(s3.total.cost)}</div><div style="display:grid; grid-template-columns: 28px 1fr 1fr 1fr; column-gap:10px; row-gap:2px; font-family:'Arial', sans-serif; font-size:11px;">`;
    const hs = "color:#666; font-size:9px; text-align:right; margin-bottom:2px;";
    h3 += `<div style="grid-column:2; ${hs}">Start</div><div style="grid-column:3; ${hs}">Gain</div><div style="grid-column:4; ${hs}">End</div>`;
    const r4 = (n2, c3, o3, t3 = false) => {
      const st = t3 ? "border-top:1px solid #444; padding-top:4px; margin-top:2px;" : "";
      return `<div style="color:${c3}; font-weight:700; ${st}">${n2}</div><div style="text-align:right; color:#888; ${st}">${f4(o3.start)}</div><div style="text-align:right; color:${CONSTANTS.COLORS.GAINS}; font-weight:700; ${st}">${fg(o3.gain)}</div><div style="text-align:right; color:#fff; font-weight:700; ${st}">${f4(o3.end)}</div>`;
    };
    h3 += r4("STR", CONSTANTS.COLORS.STR, s3.str) + r4("DEF", CONSTANTS.COLORS.DEF, s3.def) + r4("SPD", CONSTANTS.COLORS.SPD, s3.spd) + r4("DEX", CONSTANTS.COLORS.DEX, s3.dex) + r4("TOT", CONSTANTS.COLORS.TOT, s3.total, true);
    return h3 + `</div>`;
  }
  function updateFooterTooltip() {
    const b2 = document.getElementById("bbgl-gym-tab");
    if (!b2) return;
    const isP = document.body.classList.contains("bbgl-page-mode-active");
    const txt = isP ? "Disabled while viewing the log in Page View" : "Big Black Gym Log";
    if (b2.getAttribute("data-tooltip") !== txt) b2.setAttribute("data-tooltip", txt);
  }
  app.TooltipController = TooltipController;
  app.generateRichTooltip = generateRichTooltip;
  app.updateFooterTooltip = updateFooterTooltip;

  // src/torn/api.js
  function resetRefreshBtn(btn) {
    if (!btn) return;
    if (btn.dataset.timerId) {
      clearTimeout(btn.dataset.timerId);
      delete btn.dataset.timerId;
    }
    btn.style.color = "";
    btn.style.opacity = "1";
    if (btn.dataset.originalText) {
      btn.innerText = btn.dataset.originalText;
      delete btn.dataset.originalText;
    }
  }
  function checkRefreshCooldown(btn) {
    const now = Date.now();
    while (refreshClickLog.length > 0 && now - refreshClickLog[0] > 6e4) refreshClickLog.shift();
    refreshClickLog.push(now);
    if (refreshClickLog.length <= 4) return false;
    btn.disabled = true;
    btn.style.opacity = "0.45";
    btn.style.color = "#666";
    if (!btn.dataset.originalText) btn.dataset.originalText = btn.innerText;
    let remaining = Math.ceil((6e4 - (now - refreshClickLog[0])) / 1e3);
    const updateTooltip = () => {
      btn.setAttribute("data-tooltip", app.TOOLTIPS.REFRESH_COOLDOWN(remaining));
    };
    updateTooltip();
    const interval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(interval);
        btn.disabled = false;
        btn.style.opacity = "";
        btn.style.color = "";
        btn.removeAttribute("data-tooltip");
        if (btn.dataset.originalText) {
          btn.innerText = btn.dataset.originalText;
          delete btn.dataset.originalText;
        }
        refreshClickLog.length = 0;
      } else {
        updateTooltip();
      }
    }, 1e3);
    return true;
  }
  function incrementApiCount(n2) {
    runtime.apiCallTotal += n2;
    const hud = dom.apiHud;
    if (hud) hud.innerHTML = `API Calls: ${runtime.apiCallTotal}`;
  }
  async function universalFetch(mission, options = {}) {
    if (runtime.demoMode) return {
      success: false,
      demo: true
    };
    if (runtime.backfilling) return {
      ok: false,
      suppressed: true
    };
    const {
      specId = null,
      manualWars = false
    } = options;
    if (!userConfig.apiKey || userConfig.apiKey.length < 16) {
      return {
        ok: false,
        error: "API Key is missing or too short."
      };
    }
    const ts = Date.now();
    const meta = app.getActiveHistory().meta;
    const fromFor = (key) => {
      const fl = meta.syncFloor && meta.syncFloor[key];
      return fl ? `&from=${Math.max(0, fl - SYNC_FROM_BUFFER)}` : "";
    };
    let reqs = [];
    if (mission === "TRAIN_SINGLE" && specId) {
      reqs.push({
        type: "log",
        floorKey: "trainEnergy",
        url: `https://api.torn.com/user/?selections=log&log=${specId},${ENERGY_PARAM}&key=${userConfig.apiKey}${fromFor("trainEnergy")}&timestamp=${ts}`
      });
    } else {
      reqs = [
        {
          type: "battlestats",
          url: `https://api.torn.com/user/?selections=battlestats&key=${userConfig.apiKey}&timestamp=${ts}`
        },
        {
          type: "log",
          floorKey: "trainEnergy",
          url: `https://api.torn.com/user/?selections=log&log=${TRAIN_ENERGY_PARAM}&key=${userConfig.apiKey}${fromFor("trainEnergy")}&timestamp=${ts}`
        },
        {
          type: "log",
          floorKey: "statHappy",
          url: `https://api.torn.com/user/?selections=log&log=${STAT_HAPPY_PARAM}&key=${userConfig.apiKey}${fromFor("statHappy")}&timestamp=${ts}`
        }
      ];
    }
    incrementApiCount(reqs.length);
    if (mission === "FULL_SYNC") app.fetchWars(manualWars);
    try {
      const res = await Promise.all(reqs.map((c3) => fetch(c3.url).then((r4) => {
        if (!r4.ok) {
          const se = new Error(`Torn returned an unexpected error (HTTP ${r4.status}).`);
          se.isTornError = true;
          throw se;
        }
        return r4.json();
      }).then((d3) => ({
        cfg: c3,
        data: d3
      }))));
      const errObj = res.find((r4) => r4.data.error);
      if (errObj) {
        const te = new Error(tornKeyErrorText(errObj.data));
        te.isTornError = true;
        throw te;
      }
      let logs = {}, bs = null;
      res.forEach((r4) => {
        if (r4.data.log) logs = { ...logs, ...r4.data.log };
        if (r4.cfg.type === "battlestats") bs = r4.data;
      });
      const tsSec = Math.floor(ts / 1e3);
      if (!meta.syncFloor) meta.syncFloor = {};
      reqs.forEach((c3) => {
        if (c3.floorKey) meta.syncFloor[c3.floorKey] = tsSec;
      });
      if (mission !== "TRAIN_SINGLE") {
        localStorage.setItem(KEYS.LAST_SYNC, ts.toString());
      }
      const _s = app.getActiveHistory();
      const needsEnhancers = mission === "FULL_SYNC" && bs && BS_STAT_ROWS.some((row) => (bs[row.api] || 0) > (_s.today.endBreakdown[row.abbr] || 0));
      await app.DataController.processDataPayload(logs, bs);
      if (needsEnhancers) {
        try {
          incrementApiCount(1);
          const eRes = await fetch(
            `https://api.torn.com/user/?selections=log&log=${STAT_ENHANCER_PARAM}&key=${userConfig.apiKey}${fromFor("statEnhancers")}&timestamp=${Date.now()}`
          );
          if (eRes.ok) {
            const eData = await eRes.json();
            if (!eData.error) {
              meta.syncFloor.statEnhancers = tsSec;
              await app.DataController.processDataPayload(eData.log || {}, null);
            }
          }
        } catch (e3) {
          Log.warn("Stat enhancer fetch failed", e3);
        }
      }
      return {
        ok: true
      };
    } catch (e3) {
      Log.error("Sync failed", e3);
      const isQuota = e3.name === "QuotaExceededError" || e3.message && e3.message.toLowerCase().includes("quota");
      const errorMsg = isQuota ? MSG_SYNC_QUOTA : e3.isTornError ? e3.message : MSG_SYNC_NETWORK_ERROR;
      return {
        ok: false,
        error: errorMsg
      };
    }
  }
  app.resetRefreshBtn = resetRefreshBtn;
  app.checkRefreshCooldown = checkRefreshCooldown;
  app.incrementApiCount = incrementApiCount;
  app.universalFetch = universalFetch;

  // src/ui/assets.ts
  function cdnize(u4) {
    return u4.replace(
      /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/(?:refs\/heads\/)?([^/]+)\//,
      "https://cdn.jsdelivr.net/gh/$1/$2@$3/"
    );
  }
  var decode = (s3) => atob(s3);
  var CUSTOM_STICKERS = [
    { id: 1, name: "Just Checking the Mirror", url: decode("aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9HeW0vanN0LWNoay1taXJyci5wbmc=") },
    { id: 2, name: "Up, Down, Repeat", url: decode("aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9HeW0vdXAtZG4tcnB0LnBuZw==") },
    { id: 3, name: "Flat Bench Therapy", url: decode("aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9HeW0vZmx0LWJuY2gtdGhycHkucG5n") },
    { id: 4, name: "Bring Home the Feed", url: decode("aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9HeW0vYnJuZy1obS1mZWVkLnBuZw==") },
    { id: 5, name: "Never Skip Leg Day", url: decode("aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9HeW0vbnZyLXNrcC1sZWcucG5n") },
    { id: 6, name: "Tire Rotation", url: decode("aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9HeW0vdGlyZS1yb3RuLnBuZw==") },
    { id: 7, name: "Back End Engagement", url: decode("aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9HeW0vYmNrLWVuZC1lbmdtdC5wbmc=") },
    { id: 8, name: "The Upside of Exercise", url: decode("aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9HeW0vdXBzZC1leHJjc2UucG5n") },
    { id: 9, name: "Shellshock Stretches", url: decode("aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9HeW0vc2hsc2hrLXN0cmNoLnBuZw==") },
    { id: 10, name: "Certified Cardio", url: decode("aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9HeW0vY3J0ZmQtY3JkaW8ucG5n") },
    { id: 11, name: "Just One More Spin", url: decode("aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9DYXNpbm8vanN0LW9uZS1zcG4ucG5n") },
    { id: 12, name: "Bingo! I Think...", url: decode("aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9DYXNpbm8vYmluZ28taS10aG5rLnBuZw==") },
    { id: 13, name: "Lucky Shot", url: decode("aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9DYXNpbm8vbGNreS1zaHQucG5n") },
    { id: 14, name: "Holy Craps", url: decode("aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9DYXNpbm8vaG9seS1jcnBzLnBuZw==") },
    { id: 15, name: "Tilted in My Favor", url: decode("aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9DYXNpbm8vdGx0ZC1teS1mdnIucG5n") },
    { id: 16, name: "Choose Wisely", url: decode("aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9DYXNpbm8vY2hzZS13c2x5LnBuZw==") },
    { id: 17, name: "Hit Me", url: decode("aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9DYXNpbm8vaGl0LW1lLnBuZw==") },
    { id: 18, name: "Dead Men's Hand", url: decode("aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9DYXNpbm8vZGVhZC1tZW5zLnBuZw==") },
    { id: 19, name: "Trigger Warning", url: decode("aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9DYXNpbm8vdHJnci13cm5nLnBuZw==") },
    { id: 20, name: "Leslie's Sick Day", url: decode("aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9DYXNpbm8vbHNscy1zY2stZHkucG5n") }
  ];
  CUSTOM_STICKERS.forEach((s3) => {
    s3.url = cdnize(s3.url);
  });
  var PAGE_TITLES = [
    "Sweat Equity",
    "Casino Collection",
    "Frequent Felon Passport",
    "Memories of Misdemeanors",
    "Postcards from the Frontline"
  ];

  // src/domain/capsules.ts
  function classifyDay(d3) {
    const e3 = d3.eSpent ? d3.eSpent.total : 0;
    if (e3 >= 2e3) return "diamond";
    if (e3 >= 1500) return "gold";
    if (e3 >= 1e3) return "green";
    return null;
  }
  var CAPSULE_RANK = { green: 1, gold: 2, diamond: 3 };
  var TIER_UNITS = { green: 1, gold: 1, diamond: 2 };
  function placeCapsuleUnit(slots, color) {
    const empty = slots.indexOf(null);
    if (empty !== -1) {
      slots[empty] = color;
      return;
    }
    for (let i3 = 0; i3 < slots.length; i3++) {
      const current = slots[i3];
      if (current && CAPSULE_RANK[current] < CAPSULE_RANK[color]) {
        slots[i3] = color;
        placeCapsuleUnit(slots, current);
        return;
      }
    }
  }
  function computeWeekCapsules(days, hjDaySet = null) {
    const slots = [null, null, null, null, null];
    const hjDays = hjDaySet ? days.filter((d3) => hjDaySet.has(d3.date)) : [];
    const jumpGold = hjDays.length >= GAME.GOLD_WEEK_JUMPS;
    const JUMP_ALLOTMENT = [2, 3];
    days.forEach((d3) => {
      const jumpIdx = hjDays.indexOf(d3);
      if (jumpIdx === 0 || jumpIdx === 1) {
        const jumpUnits = JUMP_ALLOTMENT[jumpIdx];
        const naturalTier = classifyDay(d3);
        const upgradeUnits = Math.min(TIER_UNITS[naturalTier] || 0, jumpUnits);
        for (let i3 = 0; i3 < upgradeUnits; i3++) placeCapsuleUnit(slots, naturalTier);
        for (let i3 = 0; i3 < jumpUnits - upgradeUnits; i3++) placeCapsuleUnit(slots, jumpGold ? "gold" : "green");
      } else {
        const tier = classifyDay(d3);
        if (!tier) return;
        placeCapsuleUnit(slots, tier);
        if (tier === "diamond") placeCapsuleUnit(slots, tier);
      }
    });
    return slots;
  }
  function computeWeekCompletion(days, hjDaySet = null) {
    const capsules = computeWeekCapsules(days, hjDaySet);
    const filled = capsules.filter((c3) => c3 !== null);
    const isCompleted = filled.length === capsules.length;
    const isGold = isCompleted && filled.every((c3) => c3 === "gold" || c3 === "diamond");
    const isDiamond = isCompleted && filled.every((c3) => c3 === "diamond");
    return { capsules, isCompleted, isGold, isDiamond };
  }

  // src/domain/leveling.ts
  var LEVEL_FLOOR = 30;
  var LEVEL_P0_MAX = 400;
  var LEVEL_ATRO_MULT = [1, 1.75, 3];
  var LEVEL_STEP1_END = 0.5;
  var LEVEL_STEP1_VAL = 182;
  var LEVEL_STEP2_END = 0.7;
  var LEVEL_STEP2_VAL = 289;
  var LEVEL_TAIL_POWER = 4.5;
  function computeLevelExpCost(level, atrophy) {
    const t3 = (level - 1) / 98;
    const val1 = (LEVEL_STEP1_VAL - LEVEL_FLOOR) / (LEVEL_P0_MAX - LEVEL_FLOOR);
    const val2 = (LEVEL_STEP2_VAL - LEVEL_FLOOR) / (LEVEL_P0_MAX - LEVEL_FLOOR);
    let frac;
    if (t3 <= LEVEL_STEP1_END) {
      frac = val1 * (t3 / LEVEL_STEP1_END);
    } else if (t3 <= LEVEL_STEP2_END) {
      frac = val1 + (val2 - val1) * ((t3 - LEVEL_STEP1_END) / (LEVEL_STEP2_END - LEVEL_STEP1_END));
    } else {
      const u4 = (t3 - LEVEL_STEP2_END) / (1 - LEVEL_STEP2_END);
      frac = val2 + (1 - val2) * Math.pow(u4, LEVEL_TAIL_POWER);
    }
    const base = Math.round(LEVEL_FLOOR + (LEVEL_P0_MAX - LEVEL_FLOOR) * frac);
    return Math.round(base * LEVEL_ATRO_MULT[atrophy]);
  }
  var LEVEL_ATRO_BUDGETS = [0, 1, 2].map((a3) => {
    let s3 = 0;
    for (let lv = 1; lv <= 99; lv++) s3 += computeLevelExpCost(lv, a3);
    return s3;
  });
  function calculateLevelProgress(totalExp) {
    let remaining = totalExp;
    let atrophy = 0;
    for (let a3 = 0; a3 < 3; a3++) {
      const budget = LEVEL_ATRO_BUDGETS[a3];
      if (remaining < budget) {
        atrophy = a3;
        break;
      }
      if (remaining === budget && a3 < 2) return { atrophy: a3, level: 100, expInLevel: 0, expToNext: 0 };
      remaining -= budget;
      atrophy = a3 + 1;
    }
    if (atrophy >= 3) return { atrophy: 2, level: 100, expInLevel: 0, expToNext: 0 };
    let level = 1;
    for (let lv = 1; lv <= 99; lv++) {
      const cost = computeLevelExpCost(lv, atrophy);
      if (remaining < cost) {
        level = lv;
        break;
      }
      remaining -= cost;
      level = lv + 1;
    }
    const expInLevel = level <= 99 ? remaining : 0;
    const expToNext = level <= 99 ? computeLevelExpCost(level, atrophy) : 0;
    return { atrophy, level, expInLevel, expToNext };
  }
  var ATROPHY_TITLES = ["Wet Cement", "Partly Bricked", "Half Bricked"];
  function atrophyTitle(atrophy, level) {
    if (atrophy >= 2 && level >= 100) return "Fully Bricked";
    return ATROPHY_TITLES[atrophy] || ATROPHY_TITLES[0];
  }
  function computeDailyLevelExp(eSpent, hasTrainLog, isHJ = false) {
    if (!hasTrainLog) return 0;
    if (isHJ) {
      const hjE = Math.min(eSpent, 1e3);
      const extraE = Math.max(eSpent - 1e3, 0);
      const hjBase = hjE * 0.3;
      const t23 = Math.min(extraE, 500) * 0.25;
      const t32 = Math.max(extraE - 500, 0) * 0.3;
      const diamond2 = eSpent >= 2e3 ? 50 : 0;
      return Math.round(hjBase + t23 + t32 + diamond2);
    }
    const t1 = Math.min(eSpent, 1e3) * 0.2;
    const t22 = Math.min(Math.max(eSpent - 1e3, 0), 500) * 0.25;
    const t3 = Math.max(eSpent - 1500, 0) * 0.3;
    const diamond = eSpent >= 2e3 ? 50 : 0;
    return Math.round(t1 + t22 + t3 + diamond);
  }

  // src/domain/day.ts
  function sumStats2(o3) {
    return (o3.str || 0) + (o3.def || 0) + (o3.spd || 0) + (o3.dex || 0);
  }
  function initializeDayObject(dateStr, baseBreakdown) {
    const b2 = { ...baseBreakdown };
    return {
      date: dateStr,
      startTotal: b2.str + b2.def + b2.spd + b2.dex,
      endTotal: b2.str + b2.def + b2.spd + b2.dex,
      startBreakdown: { ...b2 },
      endBreakdown: { ...b2 },
      gains: { total: 0, ...ZERO_BREAKDOWN },
      eSpent: { total: 0, ...ZERO_BREAKDOWN },
      items: {},
      itemLogIds: [],
      itemEnergy: 0,
      itemHappy: 0,
      lastLogTimestamp: 0,
      series: []
    };
  }
  function findHappyJumps2(seriesArr) {
    const doses = (seriesArr || []).filter((e3) => e3.type === "item" && e3.logId === ECSTASY_LOG);
    if (doses.length === 0) return [];
    const clicks = (seriesArr || []).filter((e3) => e3.type !== "item" && "ts" in e3 && e3.cost);
    const jumps = [];
    doses.forEach((dose) => {
      const windowEnd = dose.ts + (GAME.HJ_QUARTER_SECONDS - dose.ts % GAME.HJ_QUARTER_SECONDS);
      let cost = 0;
      let tsEnd = dose.ts;
      const stats = { str: 0, def: 0, spd: 0, dex: 0 };
      clicks.forEach((c3) => {
        const click = c3;
        if (click.ts < dose.ts || click.ts >= windowEnd) return;
        cost += click.cost;
        stats[click.stat] = (stats[click.stat] || 0) + (click.gain || 0);
        if (click.ts > tsEnd) tsEnd = click.ts;
      });
      if (cost >= 1e3) jumps.push({ date: Formatter.dateLogical(dose.ts * 1e3), ts: dose.ts, tsEnd, cost, stats });
    });
    return jumps;
  }
  function normalizeApiLogs(rawLogs) {
    if (!rawLogs || Object.keys(rawLogs).length === 0) return [];
    const entries = [];
    Object.keys(rawLogs).forEach((k3) => {
      const l3 = rawLogs[k3];
      const meta = ITEM_LOG_META[l3.log];
      if (meta) {
        const e3 = { type: "item", id: k3, ts: l3.timestamp, logId: l3.log };
        const d4 = l3.data || {};
        if (meta.energy) e3.energy = l3.log === XANAX_LOG ? 250 : parseInt(String(d4.energy_increased || 0), 10);
        if (meta.energyLost) e3.energyLost = parseInt(String(d4.energy_decreased ?? 0), 10);
        if (meta.happyLost) e3.happyLost = parseInt(String(d4.happy_decreased ?? 0), 10);
        if (meta.happy) e3.happy = parseInt(String(d4.happy_increased || 0), 10);
        if (meta.stat) {
          const sn2 = ["strength", "defense", "speed", "dexterity"].find((s3) => d4[`${s3}_increased`] != null);
          if (sn2) {
            e3.statKey = sn2 === "strength" ? "str" : sn2 === "defense" ? "def" : sn2 === "speed" ? "spd" : "dex";
            e3.statGain = r2(parseFloat(String(d4[`${sn2}_increased`] || 0)));
          }
        }
        entries.push(e3);
        return;
      }
      const sn = GAME.STAT_MAP[l3.log];
      if (!sn) return;
      const ab = sn === "strength" ? "str" : sn === "defense" ? "def" : sn === "speed" ? "spd" : "dex";
      const d3 = l3.data || {};
      const gain = r2(parseFloat(String(d3[`${sn}_increased`] || 0)));
      const cost = parseInt(String(d3.energy_used || 0), 10);
      entries.push({
        type: "gym",
        id: k3,
        ts: l3.timestamp,
        stat: ab,
        key: sn,
        gain,
        after: r2(parseFloat(String(d3[`${sn}_after`] || 0))),
        cost,
        rate: cost > 0 ? r2(gain / cost * 150) : 0
      });
    });
    return entries.sort((a3, b2) => a3.ts - b2.ts);
  }

  // src/domain/history-engine.ts
  function rebuildFromSeries(seriesArr, baselineBreakdown) {
    const days = {};
    const running = { ...baselineBreakdown };
    seriesArr.forEach((e3) => {
      const dateKey = Formatter.dateLogical(e3.ts * 1e3);
      if (!days[dateKey]) days[dateKey] = initializeDayObject(dateKey, { ...running });
      if (e3.type === "item") {
        if (!days[dateKey].items) days[dateKey].items = {};
        if (!days[dateKey].itemLogIds) days[dateKey].itemLogIds = [];
        const itemKey = `${e3.ts}_${e3.logId}`;
        if (!days[dateKey].itemLogIds.includes(itemKey)) {
          days[dateKey].itemLogIds.push(itemKey);
          days[dateKey].items[e3.logId] = (days[dateKey].items[e3.logId] || 0) + 1;
          if (e3.logId === ECAN_LOG && e3.energy) days[dateKey].itemEnergy = (days[dateKey].itemEnergy || 0) + e3.energy;
          if (e3.energyLost != null) days[dateKey].itemEnergyLost = (days[dateKey].itemEnergyLost || 0) + e3.energyLost;
          if (e3.happyLost != null) days[dateKey].itemHappyLost = (days[dateKey].itemHappyLost || 0) + e3.happyLost;
          if (e3.happy) days[dateKey].itemHappy = (days[dateKey].itemHappy || 0) + e3.happy;
        }
        if (!e3.synthetic) days[dateKey].series.push(e3);
      } else {
        days[dateKey].gains[e3.stat] += e3.gain;
        days[dateKey].gains.total += e3.gain;
        days[dateKey].eSpent[e3.stat] += e3.cost;
        days[dateKey].eSpent.total += e3.cost;
        days[dateKey].endBreakdown[e3.stat] = e3.after;
        if (e3.ts > days[dateKey].lastLogTimestamp) days[dateKey].lastLogTimestamp = e3.ts;
        if (!e3.synthetic) days[dateKey].series.push(e3);
        running[e3.stat] = e3.after;
      }
    });
    Object.values(days).forEach((day) => {
      day.endTotal = sumStats2(day.endBreakdown);
      day.startTotal = sumStats2(day.startBreakdown);
    });
    const logicalToday = Formatter.dateLogical();
    const sortedKeys = Object.keys(days).sort();
    const todayObj = days[logicalToday] || initializeDayObject(logicalToday, { ...running });
    const history2 = sortedKeys.filter((k3) => k3 !== logicalToday).map((k3) => days[k3]);
    return { history: history2, today: todayObj };
  }
  function reconcileIncremental(s3, cleanLogs) {
    const minApiTs = cleanLogs[0].ts;
    const maxApiTs = cleanLogs[cleanLogs.length - 1].ts;
    const apiEntries = cleanLogs.map((l3) => {
      if (l3.type === "item") return { ...l3 };
      return { type: "gym", id: l3.id, ts: l3.ts, stat: l3.stat, gain: r2(l3.gain), cost: l3.cost, after: r2(l3.after) };
    });
    const getSetKey = (e3) => e3.type === "item" ? `item_${e3.id}` : `${e3.ts}_${e3.stat}_${e3.after}`;
    const apiTsStatSet = new Set(apiEntries.map(getSetKey));
    const earliestDay = Formatter.dateLogical(minApiTs * 1e3);
    const allDays = [...s3.history || []];
    if (s3.today) allDays.push(s3.today);
    const prefix = [];
    const affected = [];
    allDays.forEach((d3) => {
      (d3.date < earliestDay ? prefix : affected).push(d3);
    });
    const keptAffected = [];
    affected.forEach((d3) => {
      if (Array.isArray(d3.series)) {
        d3.series.forEach((e3) => {
          if (e3.ts < minApiTs || e3.ts > maxApiTs || !apiTsStatSet.has(getSetKey(e3))) keptAffected.push(e3);
        });
      }
    });
    const mergedAffected = [...keptAffected, ...apiEntries].sort((a3, b2) => a3.ts - b2.ts);
    const seed = prefix.length ? prefix[prefix.length - 1].endBreakdown : s3.meta && s3.meta.baselineBreakdown || ZERO_BREAKDOWN;
    const rebuilt = rebuildFromSeries(mergedAffected, seed);
    return {
      result: { meta: { ...s3.meta }, history: [...prefix, ...rebuilt.history], today: rebuilt.today },
      changedDays: [...rebuilt.history, rebuilt.today]
    };
  }

  // src/domain/history.js
  function getStickerState(id) {
    const states = historyCache && historyCache.meta && historyCache.meta.stickers ? historyCache.meta.stickers : {};
    return states[String(id)] || "--";
  }
  async function persistStickerCleared(id) {
    try {
      const stored = await app.DBManager.getStorage();
      if (!stored) return;
      if (!stored.meta) stored.meta = {};
      if (!stored.meta.stickers) stored.meta.stickers = {};
      const key = String(id);
      const cachedState = historyCache && historyCache.meta && historyCache.meta.stickers && historyCache.meta.stickers[key] || "--";
      const newState = cachedState[0] + "+";
      stored.meta.stickers[key] = newState;
      await app.DBManager.setStorage(stored);
      if (historyCache) {
        if (!historyCache.meta) historyCache.meta = {};
        if (!historyCache.meta.stickers) historyCache.meta.stickers = {};
        historyCache.meta.stickers[key] = newState;
      }
    } catch (e3) {
      Log.warn("Failed to persist sticker cleared state", e3);
    }
  }
  function getInstallWeekKey() {
    const rewardStartDate = getActiveHistory().meta.rewardStartDate;
    if (!rewardStartDate) return null;
    return getWeekKey(Formatter.dateLogical(rewardStartDate * 1e3));
  }
  function getInstallDateKey() {
    const rewardStartDate = getActiveHistory().meta.rewardStartDate;
    if (!rewardStartDate) return null;
    return Formatter.dateLogical(rewardStartDate * 1e3);
  }
  var DataController = {
    _cache: { timeline: null, slices: {}, dateMap: null, rateArr: null, stickerMap: null, unlockedCount: null, featuredDays: null, hjData: null },
    invalidate() {
      this._cache.timeline = null;
      this._cache.slices = {};
      this._cache.dateMap = null;
      this._cache.rateArr = null;
      this._cache.stickerMap = null;
      this._cache.unlockedCount = null;
      this._cache.featuredDays = null;
      this._cache.hjData = null;
      runtime.stickerData = [];
      runtime._achCache = null;
    },
    invalidateToday() {
      this._cache.timeline = null;
      this._cache.dateMap = null;
      this._cache.slices = {};
    },
    hydrate(loaded) {
      setHistoryCache(loaded || null);
      this.invalidate();
    },
    syncCache(stored) {
      Perf.start("syncCache");
      if (stored) {
        const clean = app.sanitizeStorageRecord(stored);
        const rebuilt = this._rebuildFromSeries(clean.series || [], clean.meta && clean.meta.baselineBreakdown || ZERO_BREAKDOWN);
        setHistoryCache({ meta: clean.meta || {}, history: rebuilt.history, today: rebuilt.today });
      } else {
        setHistoryCache(null);
      }
      this.invalidate();
      Perf.end("syncCache");
    },
    isStickerCleared(id) {
      if (runtime.demoMode) return id === 1;
      return getStickerState(id)[1] === "+";
    },
    markStickerCleared(id) {
      if (runtime.demoMode) return;
      persistStickerCleared(id);
    },
    getHappyJumpData() {
      if (this._cache.hjData) return this._cache.hjData;
      const hjDaySet = /* @__PURE__ */ new Set();
      this.getTimeline().forEach((day) => {
        findHappyJumps2(day.series).forEach((jump) => hjDaySet.add(jump.date));
      });
      this._cache.hjData = { hjDaySet };
      return this._cache.hjData;
    },
    buildProgressionCache() {
      if (this._cache.stickerMap) return;
      const today = Formatter.dateLogical();
      const todayWeekKey = getWeekKey(today);
      const weekMap = {};
      this.getTimeline().forEach((day) => {
        if (day.date >= today) return;
        const wk = getWeekKey(day.date);
        if (!weekMap[wk]) weekMap[wk] = [];
        weekMap[wk].push(day);
      });
      const { hjDaySet } = this.getHappyJumpData();
      const stickerMap = /* @__PURE__ */ new Map();
      const featuredSet = /* @__PURE__ */ new Set();
      let unlockedCount = 1;
      let rouletteCounter = 0;
      let careerLevelExp = 0;
      const installWeekKey = runtime.demoMode ? null : getInstallWeekKey();
      const installDateKey = runtime.demoMode ? null : getInstallDateKey();
      const rewardStartTs = runtime.demoMode ? null : getActiveHistory().meta && getActiveHistory().meta.rewardStartDate || null;
      Object.keys(weekMap).sort().forEach((wk) => {
        if (installWeekKey && wk < installWeekKey) return;
        const days = weekMap[wk].sort((a3, b2) => a3.date.localeCompare(b2.date));
        if (!runtime.demoMode) {
          days.forEach((day) => {
            if (installDateKey && day.date < installDateKey) return;
            let daySeries = day.series || [];
            if (installDateKey && day.date === installDateKey && rewardStartTs) {
              daySeries = daySeries.filter((s3) => s3.ts >= rewardStartTs);
            }
            const e3 = daySeries.filter((s3) => s3.type === "gym").reduce((sum, s3) => sum + (s3.cost || 0), 0);
            const hasTrainLog = daySeries.some((s3) => s3.type === "gym");
            const isHJ = daySeries === day.series ? hjDaySet.has(day.date) : findHappyJumps2(daySeries).length > 0;
            careerLevelExp += computeDailyLevelExp(e3, hasTrainLog, isHJ);
          });
        }
        if (wk >= todayWeekKey) return;
        const stickerworthyDays = days.filter((d3) => d3.eSpent && d3.eSpent.total >= 1e3);
        if (!stickerworthyDays.length) return;
        const { isCompleted, isGold, isDiamond } = computeWeekCompletion(days, hjDaySet);
        const numFeatured = isGold ? 2 : isCompleted ? 1 : 0;
        const splitIdx = Math.max(0, stickerworthyDays.length - numFeatured);
        const rouletteDays = stickerworthyDays.slice(0, splitIdx);
        const featuredDays = stickerworthyDays.slice(splitIdx);
        const rouletteStep = unlockedCount <= 20 && unlockedCount !== 11 ? 11 : 9;
        rouletteDays.forEach((day) => {
          const rawIdx = rouletteCounter * rouletteStep % unlockedCount;
          const idx = runtime.demoMode ? 0 : rawIdx;
          stickerMap.set(day.date, CUSTOM_STICKERS[idx]);
          rouletteCounter++;
        });
        featuredDays.forEach((day, i3) => {
          const newIdx = unlockedCount + i3;
          if (newIdx < CUSTOM_STICKERS.length) {
            const idx = runtime.demoMode ? 0 : newIdx;
            stickerMap.set(day.date, CUSTOM_STICKERS[idx]);
            featuredSet.add(day.date);
          } else {
            const rawIdx = rouletteCounter * rouletteStep % unlockedCount;
            const idx = runtime.demoMode ? 0 : rawIdx;
            stickerMap.set(day.date, CUSTOM_STICKERS[idx]);
            rouletteCounter++;
          }
        });
        unlockedCount = Math.min(unlockedCount + numFeatured, CUSTOM_STICKERS.length);
      });
      if (runtime.demoMode) unlockedCount = 1;
      this._cache.stickerMap = stickerMap;
      this._cache.featuredDays = featuredSet;
      this._cache.unlockedCount = unlockedCount;
      runtime.careerLevelExp = careerLevelExp;
      if (!runtime.demoMode) {
        const existingStates = historyCache && historyCache.meta && historyCache.meta.stickers ? historyCache.meta.stickers : {};
        const freshStates = {};
        for (let i3 = 1; i3 <= CUSTOM_STICKERS.length; i3++) {
          const key = String(i3);
          const wasClear = (existingStates[key] || "--")[1] === "+";
          freshStates[key] = (i3 <= unlockedCount ? "+" : "-") + (wasClear ? "+" : "-");
        }
        if (historyCache) {
          if (!historyCache.meta) historyCache.meta = {};
          historyCache.meta.stickers = freshStates;
        }
      }
    },
    getStickerMap() {
      this.buildProgressionCache();
      return this._cache.stickerMap;
    },
    getCareerLevelExp() {
      this.buildProgressionCache();
      return runtime.careerLevelExp || 0;
    },
    getUnlockedCount() {
      this.buildProgressionCache();
      return this._cache.unlockedCount || 0;
    },
    getFeaturedDays() {
      this.buildProgressionCache();
      return this._cache.featuredDays;
    },
    getTimeline() {
      if (this._cache.timeline) return this._cache.timeline;
      const s3 = getActiveHistory();
      let t3 = [...s3.history || []];
      if (s3.today && (s3.today.date || s3.today.startTotal > 0)) {
        t3 = t3.filter((d3) => d3.date !== s3.today.date);
        t3.push(s3.today);
      }
      t3.sort((a3, b2) => a3.date.localeCompare(b2.date));
      if (s3.meta && s3.meta.logStartDate) {
        const floor = Formatter.dateLogical(s3.meta.logStartDate * 1e3);
        t3 = t3.filter((d3) => d3.date >= floor);
      }
      this._cache.timeline = t3;
      return t3;
    },
    getDateMap() {
      if (this._cache.dateMap) return this._cache.dateMap;
      const t3 = this.getTimeline(), m3 = {};
      t3.forEach((d3) => {
        m3[d3.date] = d3;
      });
      this._cache.dateMap = m3;
      return m3;
    },
    periodCalendarDays(sl) {
      if (!sl || sl.resolution === "DAY") return 1;
      const DAY = 864e5, today = Formatter.dateLogical();
      const span = (startStr, endStr) => {
        const end = endStr > today ? today : endStr;
        if (!startStr || !end) return 1;
        return Math.max(1, Math.round((Formatter.parse(end).getTime() - Formatter.parse(startStr).getTime()) / DAY) + 1);
      };
      const dl = sl._dailyList || [];
      if (sl.resolution === "WEEK") {
        const s3 = sl._weekStart || dl[0] && dl[0].date, e3 = sl._weekEnd || (dl.length ? dl[dl.length - 1].date : null);
        return s3 && e3 ? span(s3, e3) : dl.length || 1;
      }
      if (!dl.length) return 1;
      if (sl.resolution === "MONTH") {
        const p3 = dl[0].date.slice(0, 7), y3 = +p3.slice(0, 4), mo = +p3.slice(5, 7);
        const dim = new Date(y3, mo, 0).getDate();
        return span(`${p3}-01`, `${p3}-${String(dim).padStart(2, "0")}`);
      }
      if (sl.resolution === "YEAR") {
        const y3 = dl[0].date.slice(0, 4);
        return span(`${y3}-01-01`, `${y3}-12-31`);
      }
      const tl = this.getTimeline();
      return tl.length ? span(tl[0].date, today) : dl.length || 1;
    },
    _buildRateCache() {
      const h3 = getActiveHistory();
      const allDays = [...h3.history || []].sort((a3, b2) => a3.date.localeCompare(b2.date));
      const running = { str: null, def: null, spd: null, dex: null };
      const arr = [];
      const derived = {};
      let floorDate = null;
      if (h3.meta && h3.meta.logStartDate) {
        floorDate = Formatter.dateLogical(h3.meta.logStartDate * 1e3);
      }
      allDays.forEach((day) => {
        if (day.series && day.series.length > 0) {
          day.series.forEach((e3) => {
            if (e3.cost > 0) {
              running[e3.stat] = e3.rate;
              if (!derived[e3.stat] && (!floorDate || day.date >= floorDate)) {
                derived[e3.stat] = e3.rate;
              }
            }
          });
        } else {
          STAT_KEYS.forEach((k3) => {
            const cost = day.eSpent && day.eSpent[k3] || 0;
            const gain = day.gains ? day.gains[k3] || 0 : 0;
            if (cost > 0) {
              running[k3] = gain / cost * 150;
              if (!derived[k3] && (!floorDate || day.date >= floorDate)) {
                derived[k3] = gain / cost * 150;
              }
            }
          });
        }
        arr.push({ date: day.date, rates: { ...running } });
      });
      this._cache.rateArr = arr;
      this._cache.originRates = derived;
    },
    getHistoricalRate(dateStr, stat) {
      if (!this._cache.rateArr) this._buildRateCache();
      const arr = this._cache.rateArr, or = this._cache.originRates;
      let lo = 0, hi = arr.length - 1, best = -1;
      while (lo <= hi) {
        const mid = lo + hi >> 1;
        if (arr[mid].date <= dateStr) {
          best = mid;
          lo = mid + 1;
        } else hi = mid - 1;
      }
      if (best === -1) return or[stat] || 0;
      const rate = arr[best].rates[stat];
      return rate !== null ? rate : or[stat] || 0;
    },
    getOriginRate(stat) {
      if (!this._cache.rateArr) this._buildRateCache();
      return this._cache.originRates && this._cache.originRates[stat] || 0;
    },
    getSlice(mode, target, year = null) {
      let k3 = `${mode}_${target}`;
      if (mode === "CUSTOM") k3 = `CUSTOM_${target.map((d3) => d3.date).join("_")}`;
      if (mode === "MONTH") k3 = `MONTH_${year}_${target}`;
      if (this._cache.slices[k3]) return this._cache.slices[k3];
      let raw = null, res = mode, list = [];
      if (mode === "DAY") raw = this.getDateMap()[target];
      else if (mode === "MONTH") {
        const idx = CONSTANTS.MONTHS.indexOf(target);
        if (idx > -1) {
          const p3 = `${year}-${String(idx + 1).padStart(2, "0")}`;
          list = this.getTimeline().filter((d3) => d3.date.startsWith(p3));
        }
      } else if (mode === "YEAR") list = this.getTimeline().filter((d3) => d3.date.startsWith(target));
      else if (mode === "ALL") {
        list = this.getTimeline();
        res = "ALL";
      } else if (mode === "CUSTOM") {
        list = target;
        res = "WEEK";
      }
      const sl = this._hydrate(raw, list, target, res);
      this._cache.slices[k3] = sl;
      return sl;
    },
    _getLastEntryRate(day, stat, totalGain, totalCost) {
      if (day.series && day.series.length > 0) {
        for (let i3 = day.series.length - 1; i3 >= 0; i3--) {
          const entry = day.series[i3];
          if (entry.stat === stat && entry.cost > 0) {
            return entry.rate != null ? entry.rate : r2(entry.gain / entry.cost * 150);
          }
        }
      }
      return r2(totalGain / totalCost * 150);
    },
    _hydrate(sDay, dList, lbl, res) {
      const r4 = { label: lbl, resolution: res, date: sDay ? sDay.date : dList[0] ? dList[0].date : lbl, stats: {}, meta: {
        tier: 0,
        isGap: false,
        totalEnergy: 0
      }, _dailyList: dList || [] };
      const ge = (d3, k3) => !d3 || !d3.eSpent ? 0 : d3.eSpent[k3] || 0;
      const gg = (d3, k3) => d3 && d3.gains ? d3.gains[k3] || 0 : 0;
      const gend = (d3, k3) => d3 && (d3.endBreakdown || d3.end) ? (d3.endBreakdown || d3.end)[k3] || 0 : 0;
      const gst = (d3, k3) => d3 && (d3.startBreakdown || d3.start) ? (d3.startBreakdown || d3.start)[k3] || 0 : 0;
      const keys = [...STAT_KEYS, "total"];
      if (sDay) {
        keys.forEach((k3) => {
          const e4 = ge(sDay, k3), g4 = gg(sDay, k3);
          let s3 = gst(sDay, k3), end = gend(sDay, k3);
          if (k3 === "total") {
            if (!s3) s3 = STAT_KEYS.reduce((a3, x3) => a3 + gst(sDay, x3), 0);
            if (!end) end = STAT_KEYS.reduce((a3, x3) => a3 + gend(sDay, x3), 0);
          }
          r4.stats[k3] = { start: s3, gain: g4, end, cost: e4, rate: e4 > 0 ? this._getLastEntryRate(sDay, k3, g4, e4) : k3 !== "total" ? this.getHistoricalRate(sDay.date, k3) : 0 };
        });
        r4.meta.totalEnergy = r4.stats.total.cost;
      } else if (dList.length > 0) {
        const srt = [...dList].sort((a3, b2) => a3.date.localeCompare(b2.date)), f4 = srt[0], l3 = srt[srt.length - 1];
        keys.forEach((k3) => {
          let tc = 0, tg = 0;
          srt.forEach((d3) => {
            tc += ge(d3, k3);
            tg += gg(d3, k3);
          });
          let s3 = gst(f4, k3), end = gend(l3, k3);
          if (k3 === "total") {
            if (!s3) s3 = STAT_KEYS.reduce((a3, x3) => a3 + gst(f4, x3), 0);
            if (!end) end = STAT_KEYS.reduce((a3, x3) => a3 + gend(l3, x3), 0);
          }
          r4.stats[k3] = { start: s3, gain: tg, end, cost: tc, rate: tc > 0 ? r2(tg / tc * 150) : 0 };
        });
        r4.meta.totalEnergy = r4.stats.total.cost;
      } else {
        r4.meta.isGap = true;
        const pastEnd = { ...[...this.getTimeline()].reverse().find((d3) => d3.date < r4.date)?.endBreakdown || getActiveHistory().meta.baselineBreakdown || {} };
        pastEnd.total = STAT_KEYS.reduce((a3, x3) => a3 + (pastEnd[x3] || 0), 0);
        keys.forEach((k3) => {
          r4.stats[k3] = { start: pastEnd[k3] || 0, gain: 0, end: pastEnd[k3] || 0, cost: 0, rate: k3 !== "total" ? this.getHistoricalRate(r4.date, k3) : 0 };
        });
      }
      keys.forEach((k3) => {
        if (r4.stats[k3]) r4.stats[k3].gain = Math.max(0, r2(r4.stats[k3].end - r4.stats[k3].start));
      });
      const e3 = r4.meta.totalEnergy;
      let hjDaySet;
      if (this.getHappyJumpData) {
        const hjData = this.getHappyJumpData();
        hjDaySet = hjData.hjDaySet;
      } else {
        hjDaySet = /* @__PURE__ */ new Set();
      }
      const isHJ = r4.date && hjDaySet.has(r4.date);
      if (e3 >= 2e3) r4.meta.tier = 3;
      else if (e3 >= 1500) r4.meta.tier = 2;
      else if (e3 >= 1e3 || isHJ) r4.meta.tier = 1;
      else r4.meta.tier = 0;
      const itemDays = sDay ? [sDay] : dList || [];
      const items = {};
      let itemEnergy = 0;
      let odEnergyLost = 0;
      let odHappyLost = 0;
      itemDays.forEach((d3) => {
        if (d3 && d3.items) Object.keys(d3.items).forEach((id) => {
          items[id] = (items[id] || 0) + d3.items[id];
        });
        (d3 && d3.series || []).forEach((e4) => {
          if (e4.type !== "item") return;
          if (e4.logId === ECAN_LOG && e4.energy) itemEnergy += e4.energy;
          if (e4.energyLost != null) odEnergyLost += e4.energyLost;
          if (e4.happyLost != null) odHappyLost += e4.happyLost;
        });
      });
      r4.items = items;
      r4.xanax = items[XANAX_LOG] || 0;
      r4.xanaxODs = items[XANAX_OD_LOG] || 0;
      r4.lsdODs = items[LSD_OD_LOG] || 0;
      r4.exODs = items[EX_OD_LOG] || 0;
      r4.odEnergyLost = odEnergyLost;
      r4.exHappyLost = odHappyLost;
      r4.ecans = items[ECAN_LOG] || 0;
      r4.ecanEnergy = itemEnergy;
      r4.dayCount = sDay ? 1 : dList ? dList.length : 0;
      return r4;
    },
    async processDataPayload(apiLogs, apiBattlestats) {
      Perf.start("processDataPayload");
      let s3 = getActiveHistory();
      const fullApiLogs = normalizeApiLogs(apiLogs);
      let cleanLogs = fullApiLogs;
      if (s3.meta.logStartDate) {
        cleanLogs = cleanLogs.filter((l3) => l3.ts >= s3.meta.logStartDate);
        if (cleanLogs.length === 0 && historyCache) {
          const changedToday = apiBattlestats ? this._snapToBattlestats(apiBattlestats, s3) : false;
          const logicalToday2 = Formatter.dateLogical();
          if (s3.today.date !== logicalToday2) {
            const changedDays = [];
            if (s3.today.series && s3.today.series.length > 0 || s3.today.gains && s3.today.gains.total > 0) {
              s3.history.push(s3.today);
              changedDays.push(s3.today);
            }
            s3.today = initializeDayObject(logicalToday2, s3.today.endBreakdown);
            changedDays.push(s3.today);
            setHistoryCache(s3);
            this.invalidate();
            await app.DBManager.saveDays(s3.meta, changedDays);
          } else if (changedToday) {
            setHistoryCache(s3);
            this.invalidateToday();
            await app.DBManager.saveDays(s3.meta, [s3.today]);
          }
          window.dispatchEvent(new CustomEvent("bbgl:dataUpdated"));
          Perf.end("processDataPayload");
          return "SUCCESS";
        }
        let inc = null;
        try {
          inc = this._reconcileIncremental(s3, cleanLogs);
        } catch (e3) {
          Log.warn("Incremental reconcile failed; falling back to full rebuild", e3);
          inc = null;
        }
        if (inc) {
          setHistoryCache(inc.result);
          s3 = getActiveHistory();
          this._runDailyGrind([], apiBattlestats, s3);
          const changedDays = inc.changedDays.slice();
          const logicalToday2 = Formatter.dateLogical();
          let rolled = false;
          if (s3.today.date !== logicalToday2) {
            if (s3.today.series && s3.today.series.length > 0 || s3.today.gains && s3.today.gains.total > 0) s3.history.push(s3.today);
            s3.today = initializeDayObject(
              logicalToday2,
              s3.today.endBreakdown
            );
            rolled = true;
          }
          setHistoryCache(s3);
          this.invalidate();
          if (rolled) {
            const all = [...s3.history || []];
            if (s3.today) all.push(s3.today);
            await app.DBManager.saveDays(s3.meta, all);
          } else {
            if (!changedDays.includes(s3.today)) changedDays.push(s3.today);
            await app.DBManager.saveDays(s3.meta, changedDays);
          }
          window.dispatchEvent(new CustomEvent("bbgl:dataUpdated"));
          Perf.end("processDataPayload");
          return "SUCCESS";
        }
        try {
          setHistoryCache(await this._reconcileFull(s3, cleanLogs));
        } catch (e3) {
          Log.warn("Reconciliation error", e3);
        }
        s3 = getActiveHistory();
      }
      if (!s3.meta.logStartDate) {
        if (apiBattlestats) {
          s3.meta.baselineBreakdown = { str: apiBattlestats.strength || 0, def: apiBattlestats.defense || 0, spd: apiBattlestats.speed || 0, dex: apiBattlestats.dexterity || 0 };
        }
        const nowTs = Math.floor(Date.now() / 1e3);
        s3.meta.logStartDate = nowTs;
        s3.meta.rewardStartDate = nowTs;
        cleanLogs = cleanLogs.filter((l3) => l3.ts >= s3.meta.logStartDate);
        s3.today = initializeDayObject(Formatter.dateLogical(), { ...s3.meta.baselineBreakdown });
      }
      this._runDailyGrind(cleanLogs, apiBattlestats, s3);
      const logicalToday = Formatter.dateLogical();
      if (s3.today.date !== logicalToday) {
        if (s3.today.series && s3.today.series.length > 0 || s3.today.gains && s3.today.gains.total > 0) s3.history.push(s3.today);
        s3.today = initializeDayObject(logicalToday, s3.today.endBreakdown);
      }
      this.saveSmartHistory(s3);
      window.dispatchEvent(new CustomEvent("bbgl:dataUpdated"));
      Perf.end("processDataPayload");
      return "SUCCESS";
    },
    saveSmartHistory(d3) {
      const allDays = [...d3.history || []];
      if (d3.today) allDays.push(d3.today);
      app.DBManager.saveDays(d3.meta, allDays);
      setHistoryCache(d3);
      this.invalidate();
    },
    flattenAllSeries() {
      const s3 = getActiveHistory();
      const all = [];
      const days = [...s3.history || []];
      if (s3.today) days.push(s3.today);
      days.forEach((day) => {
        if (day.series && day.series.length > 0) {
          day.series.forEach((e3) => all.push(e3));
        } else {
          const base = Formatter.parse(day.date);
          const ts = Math.floor(base.getTime() / 1e3) + 43200;
          STAT_KEYS.forEach((stat) => {
            const gain = day.gains && day.gains[stat] || 0;
            const cost = day.eSpent && day.eSpent[stat] || 0;
            const after = day.endBreakdown && day.endBreakdown[stat] || 0;
            if (gain > 0 || cost > 0) all.push({ ts, stat, gain, cost, after, rate: cost > 0 ? r2(gain / cost * 150) : 0, synthetic: true });
          });
        }
      });
      return all.sort((a3, b2) => a3.ts - b2.ts);
    },
    _runDailyGrind(logs, bs, s3) {
      const allDays = [...s3.history || [], s3.today];
      const globalLastTs = allDays.reduce((max, day) => Math.max(max, day.lastLogTimestamp || 0), 0);
      const lastTs = Math.max(globalLastTs, s3.meta.logStartDate || 0);
      const validLogs = logs.filter((l3) => l3.ts > lastTs);
      validLogs.forEach((l3) => this._applyLogToState(l3, s3));
      if (bs) this._snapToBattlestats(bs, s3);
    },
    _applyLogToState(l3, s3) {
      const logDate = Formatter.dateLogical(l3.ts * 1e3);
      if (s3.today.date !== logDate) {
        if (s3.today.series && s3.today.series.length > 0) s3.history.push(s3.today);
        s3.today = initializeDayObject(logDate, s3.today.endBreakdown);
      }
      if (l3.type === "item") {
        if (!s3.today.items) s3.today.items = {};
        if (!s3.today.itemLogIds) s3.today.itemLogIds = [];
        const itemKey = `${l3.ts}_${l3.logId}`;
        if (!s3.today.itemLogIds.includes(itemKey)) {
          s3.today.itemLogIds.push(itemKey);
          s3.today.items[l3.logId] = (s3.today.items[l3.logId] || 0) + 1;
          if (l3.logId === ECAN_LOG && l3.energy) s3.today.itemEnergy = (s3.today.itemEnergy || 0) + l3.energy;
          if (l3.energyLost != null) s3.today.itemEnergyLost = (s3.today.itemEnergyLost || 0) + l3.energyLost;
          if (l3.happyLost != null) s3.today.itemHappyLost = (s3.today.itemHappyLost || 0) + l3.happyLost;
          if (l3.happy) s3.today.itemHappy = (s3.today.itemHappy || 0) + l3.happy;
        }
        const entry = { type: "item", id: l3.id, ts: l3.ts, logId: l3.logId };
        if (l3.energy) entry.energy = l3.energy;
        if (l3.energyLost != null) entry.energyLost = l3.energyLost;
        if (l3.happyLost != null) entry.happyLost = l3.happyLost;
        if (l3.happy) entry.happy = l3.happy;
        if (l3.statKey) {
          entry.statKey = l3.statKey;
          entry.statGain = l3.statGain;
        }
        s3.today.series.push(entry);
      } else {
        s3.today.gains[l3.stat] += l3.gain;
        s3.today.gains.total += l3.gain;
        s3.today.eSpent[l3.stat] += l3.cost;
        s3.today.eSpent.total += l3.cost;
        s3.today.endBreakdown[l3.stat] = l3.after;
        if (l3.ts > s3.today.lastLogTimestamp) s3.today.lastLogTimestamp = l3.ts;
        s3.today.series.push({ type: "gym", id: l3.id, ts: l3.ts, stat: l3.stat, gain: l3.gain, cost: l3.cost, after: l3.after, rate: l3.cost > 0 ? r2(l3.gain / l3.cost * 150) : 0 });
        s3.today.endTotal = sumStats2(s3.today.endBreakdown);
      }
    },
    _snapToBattlestats(bs, s3) {
      let upd = false;
      BS_STAT_ROWS.forEach((i3) => {
        const apiVal = bs[i3.api];
        if (apiVal === void 0) return;
        const localVal = s3.today.endBreakdown[i3.abbr] || 0;
        const lg = s3.today.gains[i3.abbr] || 0;
        if (localVal !== apiVal) {
          s3.today.endBreakdown[i3.abbr] = apiVal;
          s3.today.startBreakdown[i3.abbr] = apiVal - lg;
          upd = true;
        }
      });
      if (upd) {
        s3.today.endTotal = sumStats2(s3.today.endBreakdown);
        s3.today.startTotal = sumStats2(s3.today.startBreakdown);
      }
      return upd;
    },
    _rebuildFromSeries(seriesArr, baselineBreakdown) {
      Perf.start("_rebuildFromSeries");
      const rebuilt = rebuildFromSeries(seriesArr, baselineBreakdown);
      Perf.end("_rebuildFromSeries");
      return rebuilt;
    },
    async _reconcileFull(s3, cleanLogs) {
      const stored = await app.DBManager.getStorage();
      if (!stored) return { meta: s3.meta, history: s3.history, today: s3.today };
      if (stored.series && cleanLogs.length > 0) {
        const minApiTs = cleanLogs[0].ts;
        const maxApiTs = cleanLogs[cleanLogs.length - 1].ts;
        const apiEntries = cleanLogs.map((l3) => {
          if (l3.type === "item") return { ...l3 };
          return { type: "gym", id: l3.id, ts: l3.ts, stat: l3.stat, gain: r2(l3.gain), cost: l3.cost, after: r2(l3.after) };
        });
        const getSetKey = (e3) => e3.type === "item" ? `item_${e3.id}` : `${e3.ts}_${e3.stat}_${e3.after}`;
        const apiTsStatSet = new Set(apiEntries.map(getSetKey));
        const kept = stored.series.filter((e3) => e3.ts < minApiTs || e3.ts > maxApiTs || !apiTsStatSet.has(getSetKey(e3)));
        stored.series = [...kept, ...apiEntries].sort((a3, b2) => a3.ts - b2.ts);
      }
      stored.meta = { ...stored.meta, logStartDate: s3.meta.logStartDate, syncFloor: s3.meta.syncFloor || stored.meta.syncFloor, stickers: stored.meta.stickers || s3.meta.stickers || {} };
      const rebuilt = this._rebuildFromSeries(stored.series || [], stored.meta.baselineBreakdown || ZERO_BREAKDOWN);
      return { meta: stored.meta, history: rebuilt.history, today: rebuilt.today };
    },
    _reconcileIncremental(s3, cleanLogs) {
      return reconcileIncremental(s3, cleanLogs);
    }
  };
  function getActiveHistory() {
    if (runtime.demoMode) {
      if (!runtime.demoHistory) runtime.demoHistory = app.generateDemoData();
      return runtime.demoHistory;
    }
    if (historyCache) return historyCache;
    return { meta: { baselineBreakdown: { ...ZERO_BREAKDOWN }, backfill: app.defaultBackfill() }, history: [], today: initializeDayObject(Formatter.dateLogical(), { ...ZERO_BREAKDOWN }) };
  }
  app.getStickerState = getStickerState;
  app.persistStickerCleared = persistStickerCleared;
  app.getInstallWeekKey = getInstallWeekKey;
  app.getInstallDateKey = getInstallDateKey;
  app.DataController = DataController;
  app.getActiveHistory = getActiveHistory;

  // src/data/db.js
  var DBManager = {
    _db: null,
    _DB_NAME: "bbgl_db",
    _META_STORE: "meta",
    _DAYS_STORE: "days",
    _META_KEY: "meta",
    // This function sets up a private database on your browser to save your history.
    initDB() {
      return new Promise((resolve, reject) => {
        if (this._db) {
          resolve(this._db);
          return;
        }
        Perf.start("initDB");
        const req = indexedDB.open(this._DB_NAME, 2);
        req.onupgradeneeded = (e3) => {
          const db = e3.target.result;
          if (db.objectStoreNames.contains("history")) db.deleteObjectStore("history");
          if (!db.objectStoreNames.contains(this._META_STORE)) db.createObjectStore(this._META_STORE);
          if (!db.objectStoreNames.contains(this._DAYS_STORE)) db.createObjectStore(this._DAYS_STORE);
        };
        req.onsuccess = (e3) => {
          this._db = e3.target.result;
          Perf.end("initDB");
          resolve(this._db);
        };
        req.onerror = (e3) => {
          Perf.end("initDB");
          Log.error("IndexedDB open failed", e3);
          reject(e3);
        };
      });
    },
    async _ensureDb() {
      if (!this._db) {
        try {
          await this.initDB();
        } catch (e3) {
        }
      }
      return this._db;
    },
    _readMeta() {
      return new Promise((resolve, reject) => {
        const tx = this._db.transaction(this._META_STORE, "readonly");
        const req = tx.objectStore(this._META_STORE).get(this._META_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = (e3) => {
          Log.error("IndexedDB read failed", e3);
          reject(e3);
        };
      });
    },
    _readAllDays() {
      return new Promise((resolve, reject) => {
        const out = [];
        const tx = this._db.transaction(this._DAYS_STORE, "readonly");
        const req = tx.objectStore(this._DAYS_STORE).openCursor();
        req.onsuccess = (e3) => {
          const cur = e3.target.result;
          if (cur) {
            out.push(cur.value);
            cur.continue();
          } else resolve(out);
        };
        req.onerror = (e3) => {
          Log.error("IndexedDB read failed", e3);
          reject(e3);
        };
      });
    },
    // Saves your gym data to your browser's private storage.
    _persist(meta, dayObjs, replaceAll) {
      return new Promise((resolve, reject) => {
        if (!this._db) {
          reject(new Error("Database not initialized"));
          return;
        }
        try {
          const tx = this._db.transaction([this._META_STORE, this._DAYS_STORE], "readwrite");
          const dayStore = tx.objectStore(this._DAYS_STORE);
          if (replaceAll) dayStore.clear();
          tx.objectStore(this._META_STORE).put(meta || {}, this._META_KEY);
          (dayObjs || []).forEach((d3) => {
            if (d3 && d3.date) dayStore.put(d3, d3.date);
          });
          tx.oncomplete = () => {
            app._syncChannel.postMessage({
              type: "update",
              from: TAB_ID
            });
            resolve();
          };
          tx.onerror = (e3) => {
            const err = e3.target.error;
            Log.error("IndexedDB write failed", err);
            if (err && err.name === "QuotaExceededError") {
              bbglError("\u26A0\uFE0F STORAGE ERROR: Browser quota exceeded.\n\nYour data could not be saved. Please export your history and then 'Clear Data' to free up space.");
            }
            reject(err);
          };
        } catch (e3) {
          reject(e3);
        }
      });
    },
    // Loads your complete gym history from your browser's private storage.
    async loadHistory() {
      await this._ensureDb();
      if (!this._db) return null;
      const [metaRaw, days] = await Promise.all([this._readMeta(), this._readAllDays()]);
      if (metaRaw === null && days.length === 0) return null;
      const meta = app.sanitizeMeta(metaRaw);
      days.forEach(app.sanitizeDayRecord);
      const logicalToday = Formatter.dateLogical();
      let today = null;
      const history2 = [];
      days.forEach((d3) => {
        if (d3.date === logicalToday) today = d3;
        else if (d3.series && d3.series.length > 0 || d3.gains && d3.gains.total > 0) history2.push(d3);
      });
      history2.sort((a3, b2) => a3.date.localeCompare(b2.date));
      if (!today) {
        const carry = history2.length > 0 ? history2[history2.length - 1].endBreakdown : meta.baselineBreakdown;
        today = initializeDayObject(logicalToday, { ...carry || ZERO_BREAKDOWN });
      }
      return { meta, history: history2, today };
    },
    // Saves your latest gym session to your browser.
    async saveDays(meta, dayObjs) {
      await this._ensureDb();
      return this._persist(meta, dayObjs, false);
    },
    // Packages your gym history for export.
    async getStorage() {
      await this._ensureDb();
      if (!this._db) return null;
      const [metaRaw, days] = await Promise.all([this._readMeta(), this._readAllDays()]);
      if (metaRaw === null && days.length === 0) return app.sanitizeStorageRecord(null);
      const series = [];
      days.forEach((d3) => {
        if (d3 && Array.isArray(d3.series) && d3.series.length > 0) {
          for (const e3 of d3.series) series.push(e3);
        } else if (d3 && d3.gains && d3.gains.total > 0) {
          const base = Formatter.parse(d3.date);
          const ts = Math.floor(base.getTime() / 1e3) + 43200;
          STAT_KEYS.forEach((stat) => {
            const gain = d3.gains && d3.gains[stat] || 0;
            const cost = d3.eSpent && d3.eSpent[stat] || 0;
            const after = d3.endBreakdown && d3.endBreakdown[stat] || 0;
            if (gain > 0 || cost > 0) series.push({
              ts,
              stat,
              gain,
              cost,
              after,
              rate: cost > 0 ? r2(gain / cost * 150) : 0,
              synthetic: true
            });
          });
        }
      });
      series.sort((a3, b2) => a3.ts - b2.ts);
      return app.sanitizeStorageRecord({ meta: metaRaw || {}, series });
    },
    // Restores your gym history from an imported backup file.
    async setStorage(data) {
      await this._ensureDb();
      if (!this._db) throw new Error("Database not initialized");
      const meta = data && data.meta || {};
      const series = data && Array.isArray(data.series) ? data.series : [];
      const rebuilt = app.DataController._rebuildFromSeries(series, meta.baselineBreakdown || ZERO_BREAKDOWN);
      return this._persist(meta, [...rebuilt.history, rebuilt.today], true);
    },
    // This function permanently deletes your gym history from your browser when you click 'Clear Data'.
    async clearStorage() {
      await this._ensureDb();
      return new Promise((resolve, reject) => {
        if (!this._db) {
          resolve();
          return;
        }
        const tx = this._db.transaction([this._META_STORE, this._DAYS_STORE], "readwrite");
        const metaStore = tx.objectStore(this._META_STORE);
        metaStore.clear();
        metaStore.put({ rewardStartDate: Math.floor(Date.now() / 1e3) }, this._META_KEY);
        tx.objectStore(this._DAYS_STORE).clear();
        tx.oncomplete = () => {
          app._syncChannel.postMessage({
            type: "update",
            from: TAB_ID
          });
          resolve();
        };
        tx.onerror = (e3) => {
          Log.error("IndexedDB clear failed", e3);
          reject(e3);
        };
      });
    }
  };
  app.DBManager = DBManager;

  // src/data/sync.js
  var _syncChannel = new BroadcastChannel("bbgl_sync");
  var _xtabSyncTimer = null;
  _syncChannel.onmessage = (event) => {
    if (event.data && event.data.from === TAB_ID) return;
    if (runtime.demoMode) return;
    if (_xtabSyncTimer) clearTimeout(_xtabSyncTimer);
    _xtabSyncTimer = setTimeout(async () => {
      _xtabSyncTimer = null;
      try {
        const loaded = await app.DBManager.loadHistory();
        app.DataController.hydrate(loaded);
        if (dom.panel && dom.panel.style.display !== "none") app.renderPanelContent();
        app.renderScanOverlay();
        app.renderBackfillButton();
      } catch (e3) {
        Log.warn("Cross-tab sync failed", e3);
      }
    }, 200);
  };
  async function syncWithFeedback(mission, options = {}) {
    Perf.start("syncWithFeedback");
    const btn = dom.refreshBtn;
    if (btn) {
      btn.style.opacity = "0.4";
      if (!btn.dataset.originalText) btn.dataset.originalText = btn.innerText;
      btn.innerText = "Syncing...";
    }
    const result = await app.universalFetch(mission, { ...options, manualWars: mission !== "TRAIN_SINGLE" });
    if (result.ok) {
      scheduleHeartbeat();
      if (btn) {
        btn.innerText = "Refreshed!";
        btn.style.color = "#43a047";
        btn.style.opacity = "1";
        if (btn.dataset.timerId) clearTimeout(btn.dataset.timerId);
        btn.dataset.timerId = setTimeout(() => {
          app.resetRefreshBtn(btn);
        }, 2e3);
      }
    } else if (result.suppressed) {
      app.resetRefreshBtn(btn);
    } else {
      bbglError("Sync Error: " + result.error);
      app.resetRefreshBtn(btn);
    }
    Perf.end("syncWithFeedback");
  }
  function scheduleHeartbeat() {
    if (runtime.bgSyncId) clearTimeout(runtime.bgSyncId);
    const lastFull = localStorage.getItem(KEYS.LAST_SYNC);
    const elapsed = lastFull ? Date.now() - parseInt(lastFull) : Infinity;
    const delay = elapsed >= 18e5 ? 0 : 18e5 - elapsed;
    runtime.bgSyncId = setTimeout(async function bgSyncTick() {
      runtime.bgSyncId = null;
      await app.universalFetch("FULL_SYNC");
      scheduleHeartbeat();
    }, delay);
  }
  function startBackgroundSync() {
    scheduleHeartbeat();
  }
  async function checkExitSync() {
    const f4 = sessionStorage.getItem(KEYS.SESSION);
    if (f4 === "true" && !window.location.href.includes("gym.php")) {
      sessionStorage.removeItem(KEYS.SESSION);
      await app.universalFetch("FULL_SYNC");
      scheduleHeartbeat();
    }
  }
  var GYM_STAT_LOGS = {
    str: "5300",
    def: "5301",
    spd: "5302",
    dex: "5303"
  };
  function syncSidebarState() {
    const a3 = window.location.hash.includes("gymlog"), ids = [app.SB_DESKTOP.id, app.SB_MOBILE.id, app.SB_FLYOUT.id];
    const BBGL_ACTIVE = "active___bbgl";
    const probe = document.querySelector('[id^="nav-"][class*="active___"]');
    if (probe && !ids.includes(probe.id)) {
      const real = Array.from(probe.classList).find((c3) => c3.startsWith("active___") && c3 !== BBGL_ACTIVE);
      if (real) runtime._sidebarActiveCls = real;
    }
    const realActive = runtime._sidebarActiveCls;
    if (a3) {
      ids.forEach((id) => {
        const c3 = document.getElementById(id);
        if (!c3) return;
        if (!c3.classList.contains(BBGL_ACTIVE)) c3.classList.add(BBGL_ACTIVE);
        if (realActive && !c3.classList.contains(realActive)) c3.classList.add(realActive);
      });
      document.querySelectorAll('[id^="nav-"]').forEach((navEl) => {
        if (ids.includes(navEl.id)) return;
        [navEl, ...navEl.querySelectorAll('[class*="active___"]')].forEach((el) => {
          Array.from(el.classList).filter((cls) => cls.startsWith("active___")).forEach((cls) => el.classList.remove(cls));
        });
      });
    } else {
      ids.forEach((id) => {
        const c3 = document.getElementById(id);
        if (c3) Array.from(c3.classList).filter((cls) => cls.startsWith("active___")).forEach((cls) => c3.classList.remove(cls));
      });
    }
  }
  function getTopCeiling() {
    if (topCeilingCache !== null && Date.now() - topCeilingTs < 250) return topCeilingCache;
    let ceiling = 50;
    if (window.innerWidth >= 1e3 || window.scrollY > 10) {
      setTopCeiling(ceiling, Date.now());
      return ceiling;
    }
    const maxNavHeight = window.innerHeight * 0.4;
    for (const el of document.body.children) {
      if (el.id && el.id.startsWith("bbgl-")) continue;
      const style = window.getComputedStyle(el);
      if (style.position === "fixed") {
        const rect = el.getBoundingClientRect();
        if (rect.top < 10 && rect.bottom > ceiling && rect.bottom - rect.top < maxNavHeight) ceiling = Math.ceil(rect.bottom);
      }
    }
    setTopCeiling(ceiling, Date.now());
    return ceiling;
  }
  function _getLayoutWindows() {
    const out = /* @__PURE__ */ new Set();
    document.querySelectorAll('[class*="visible___"], [class*="opened___"]').forEach((w3) => {
      if (!w3 || w3.id === "bbgl-panel") return;
      if (w3.id === "notes_panel_button" || w3.id === "people_panel_button" || w3.id === "notes_settings_button") return;
      if ((w3.offsetWidth || 0) < 120 || (w3.offsetHeight || 0) < 120) return;
      out.add(w3);
    });
    return Array.from(out);
  }
  function _syncLayoutResizeTargets(precomputedWindows) {
    if (!runtime.layoutResizeObserver) return;
    const prev = runtime._layoutResizeTargets || (runtime._layoutResizeTargets = /* @__PURE__ */ new Set());
    const next = /* @__PURE__ */ new Set();
    (precomputedWindows || _getLayoutWindows()).forEach((w3) => {
      next.add(w3);
      if (!prev.has(w3)) runtime.layoutResizeObserver.observe(w3);
    });
    prev.forEach((w3) => {
      if (!next.has(w3)) {
        try {
          runtime.layoutResizeObserver.unobserve(w3);
        } catch (_3) {
        }
        prev.delete(w3);
      }
    });
    next.forEach((w3) => prev.add(w3));
  }
  function syncChangelogNotif(active) {
    const ids = [app.SB_DESKTOP.id, app.SB_MOBILE.id, app.SB_FLYOUT.id];
    ids.forEach((id) => {
      const c3 = document.getElementById(id);
      if (!c3) return;
      if (active) c3.classList.add("bbgl-sb-notif");
      else c3.classList.remove("bbgl-sb-notif");
    });
  }
  function syncSiblingSelect(primaryId, siblingId, val) {
    if (!dom.panel) return;
    const sib = dom.panel.querySelector("#" + siblingId);
    if (sib && sib.value !== val) sib.value = val;
  }
  app._syncChannel = _syncChannel;
  app._xtabSyncTimer = _xtabSyncTimer;
  app.syncWithFeedback = syncWithFeedback;
  app.scheduleHeartbeat = scheduleHeartbeat;
  app.startBackgroundSync = startBackgroundSync;
  app.checkExitSync = checkExitSync;
  app.GYM_STAT_LOGS = GYM_STAT_LOGS;
  app.syncSidebarState = syncSidebarState;
  app.getTopCeiling = getTopCeiling;
  app._getLayoutWindows = _getLayoutWindows;
  app._syncLayoutResizeTargets = _syncLayoutResizeTargets;
  app.syncChangelogNotif = syncChangelogNotif;
  app.syncSiblingSelect = syncSiblingSelect;

  // src/data/sanitize.js
  function defaultBackfill() {
    return {
      targets: {},
      rowsUsed: 0,
      // cumulative rows spent; resets on full completion or after a cap cooldown elapses
      cooldownUntil: 0,
      // armed to now + COOLDOWN_MS at the moment the cap is hit
      lastResult: null,
      // 'partial' | 'complete'
      stopReason: null,
      // null | 'paused' | 'error' | 'interrupted' | 'cap' — why a partial stopped; drives masked-state copy
      completion: null,
      // 'origin' | 'exhausted' (only meaningful once lastResult === 'complete')
      acknowledged: true,
      // false while a masked stop-state (paused/error/cap/complete) awaits the user's dismissal
      lock: 0,
      // heartbeat timestamp of the tab currently scanning; 0 = no scan running
      lockOwner: null
      // TAB_ID of the scanning tab; lets any tab tell driver from passenger
    };
  }
  function normalizeBackfill(ds) {
    const d3 = defaultBackfill();
    if (ds && typeof ds === "object") {
      if (ds.targets && typeof ds.targets === "object") d3.targets = ds.targets;
      if (typeof ds.rowsUsed === "number") d3.rowsUsed = ds.rowsUsed;
      else if (typeof ds.rowsThisWindow === "number") d3.rowsUsed = ds.rowsThisWindow;
      if (typeof ds.cooldownUntil === "number") d3.cooldownUntil = ds.cooldownUntil;
      if (ds.lastResult === "complete" || ds.lastResult === "partial") d3.lastResult = ds.lastResult;
      if (ds.stopReason === "paused" || ds.stopReason === "error" || ds.stopReason === "interrupted" || ds.stopReason === "cap") d3.stopReason = ds.stopReason;
      if (ds.completion === "origin" || ds.completion === "exhausted") d3.completion = ds.completion;
      if (typeof ds.acknowledged === "boolean") d3.acknowledged = ds.acknowledged;
      if (typeof ds.lock === "number") d3.lock = ds.lock;
      if (typeof ds.lockOwner === "string") d3.lockOwner = ds.lockOwner;
    }
    return d3;
  }
  function sanitizeMeta(metaRaw) {
    const m3 = metaRaw && typeof metaRaw === "object" ? metaRaw : {};
    if (!m3.baselineBreakdown) m3.baselineBreakdown = {
      ...ZERO_BREAKDOWN
    };
    m3.backfill = normalizeBackfill(m3.backfill);
    const k3 = ["str", "def", "spd", "dex"];
    k3.forEach((key) => {
      if (m3.baselineBreakdown[key] !== void 0) m3.baselineBreakdown[key] = parseFloat(m3.baselineBreakdown[key]) || 0;
    });
    return m3;
  }
  function sanitizeEntry(e3) {
    if (e3.type === "item") {
      if (e3.ts !== void 0) e3.ts = parseInt(e3.ts);
      if (e3.energy !== void 0) e3.energy = parseInt(e3.energy);
      return;
    }
    if (e3.ts !== void 0) e3.ts = parseInt(e3.ts);
    if (e3.gain !== void 0) e3.gain = parseFloat(e3.gain);
    if (e3.after !== void 0) e3.after = parseFloat(e3.after);
    if (e3.cost !== void 0) e3.cost = parseInt(e3.cost);
    e3.rate = e3.cost > 0 ? r2(e3.gain / e3.cost * 150) : 0;
  }
  function sanitizeDayRecord(d3) {
    if (d3 && Array.isArray(d3.series)) d3.series.forEach(sanitizeEntry);
    return d3;
  }
  function sanitizeStorageRecord(s3) {
    if (!s3 || typeof s3 !== "object") return {
      meta: {
        baselineBreakdown: {
          ...ZERO_BREAKDOWN
        }
      },
      series: []
    };
    s3.meta = sanitizeMeta(s3.meta);
    if (!s3.series || !Array.isArray(s3.series)) s3.series = [];
    s3.series.forEach(sanitizeEntry);
    return s3;
  }
  function validateImportSchema(j4) {
    if (!j4 || typeof j4 !== "object") return {
      ok: false,
      msg: "Invalid file format."
    };
    if (WIPE_BELOW_VERSION !== "0.0.0") {
      const importedVer = j4.meta && j4.meta.version ? String(j4.meta.version) : "";
      if (!importedVer || compareVersions(importedVer, WIPE_BELOW_VERSION) < 0) return {
        ok: false,
        msg: "This export is from before a required data reset and can no longer be imported. Please start tracking fresh."
      };
    }
    if (!j4.storage || typeof j4.storage !== "object") return {
      ok: false,
      msg: "No training data found in file."
    };
    const s3 = j4.storage;
    if (s3.series && !Array.isArray(s3.series)) return {
      ok: false,
      msg: "Training series is malformed (not an array)."
    };
    if (s3.meta && s3.meta.baselineBreakdown) {
      const keys = Object.keys(s3.meta.baselineBreakdown);
      if (!keys.includes("str") && !keys.includes("def")) return {
        ok: false,
        msg: "Baseline stats are missing or invalid."
      };
    }
    return {
      ok: true
    };
  }
  app.defaultBackfill = defaultBackfill;
  app.normalizeBackfill = normalizeBackfill;
  app.sanitizeMeta = sanitizeMeta;
  app.sanitizeEntry = sanitizeEntry;
  app.sanitizeDayRecord = sanitizeDayRecord;
  app.sanitizeStorageRecord = sanitizeStorageRecord;
  app.validateImportSchema = validateImportSchema;

  // src/data/wars.js
  async function fetchWars(manual) {
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1e3;
    const lastSync = parseInt(localStorage.getItem(KEYS.WARS_SYNC) || "0");
    if (!manual && Date.now() - lastSync < TWENTY_FOUR_HOURS) return;
    try {
      app.incrementApiCount(1);
      const res = await fetch(`https://api.torn.com/faction/?selections=rankedwars,basic&key=${userConfig.apiKey}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.error) return;
      const wars = data.rankedwars || {};
      const myFactionId = data.ID || null;
      if (myFactionId) {
        Object.values(wars).forEach((w3) => {
          if (!w3 || !w3.war) return;
          if (w3.war.end && w3.war.winner != null) {
            w3.outcome = w3.war.winner === myFactionId ? "won" : "lost";
          }
          w3.factionId = myFactionId;
        });
      }
      localStorage.setItem(KEYS.WARS_DATA, JSON.stringify(wars));
      localStorage.setItem(KEYS.WARS_SYNC, Date.now().toString());
    } catch (e3) {
      Log.error("Wars fetch failed", e3);
    }
  }
  async function fetchFactionHistory() {
    try {
      app.incrementApiCount(1);
      const res = await fetch(`https://api.torn.com/user/?selections=log&log=6253&key=${userConfig.apiKey}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.error) return;
      const joinEvents = Object.values(data.log || {}).filter((e3) => e3 && e3.data && e3.data.faction && e3.timestamp).sort((a3, b2) => a3.timestamp - b2.timestamp);
      const factionHistory = joinEvents.map((e3, i3) => ({
        factionId: e3.data.faction,
        joinedAt: e3.timestamp,
        leftAt: joinEvents[i3 + 1] ? joinEvents[i3 + 1].timestamp : null
      }));
      localStorage.setItem(KEYS.FACTION_HISTORY, JSON.stringify(factionHistory));
    } catch (e3) {
      Log.warn("Faction history fetch failed", e3);
    }
  }
  function getFactionHistory() {
    try {
      const raw = localStorage.getItem(KEYS.FACTION_HISTORY);
      return raw ? JSON.parse(raw) : null;
    } catch (e3) {
      return null;
    }
  }
  async function fetchPastFactionWars() {
    const factionHistory = getFactionHistory();
    if (!factionHistory || !factionHistory.length) return;
    const pastFactions = factionHistory.filter((m3) => m3.leftAt !== null);
    if (!pastFactions.length) return;
    let wars = {};
    try {
      const e3 = localStorage.getItem(KEYS.WARS_DATA);
      if (e3) wars = JSON.parse(e3);
    } catch (e3) {
    }
    for (const membership of pastFactions) {
      try {
        app.incrementApiCount(1);
        const res = await fetch(`https://api.torn.com/faction/${membership.factionId}?selections=rankedwars&key=${userConfig.apiKey}`);
        if (!res.ok) continue;
        const data = await res.json();
        if (data.error) continue;
        Object.entries(data.rankedwars || {}).forEach(([id, w3]) => {
          if (!w3 || !w3.war) return;
          if (w3.war.end && w3.war.winner != null)
            w3.outcome = w3.war.winner === membership.factionId ? "won" : "lost";
          w3.factionId = membership.factionId;
          wars[id] = w3;
        });
      } catch (e3) {
        Log.warn("Past faction wars fetch failed for " + membership.factionId, e3);
      }
    }
    localStorage.setItem(KEYS.WARS_DATA, JSON.stringify(wars));
  }
  function wasInFactionDuringWar(factionHistory, factionId, warEnd) {
    if (!factionHistory) return true;
    const intervals = factionHistory.filter((m3) => m3.factionId === factionId);
    if (!intervals.length) return true;
    return intervals.some((m3) => m3.joinedAt <= warEnd && (m3.leftAt === null || m3.leftAt > warEnd));
  }
  var _warMarkerCache = { raw: false, cutoff: -1, map: {} };
  function getWarMarkers() {
    const raw = localStorage.getItem(KEYS.WARS_DATA);
    const meta = app.getActiveHistory().meta;
    const cutoff = meta && meta.logStartDate ? meta.logStartDate : 0;
    if (raw === _warMarkerCache.raw && cutoff === _warMarkerCache.cutoff) return _warMarkerCache.map || {};
    const factionHistory = getFactionHistory();
    const map = {};
    if (raw) {
      try {
        const wars = JSON.parse(raw);
        Object.values(wars).forEach((w3) => {
          if (!w3 || !w3.war || !w3.war.end) return;
          if (w3.war.end < cutoff) return;
          if (!wasInFactionDuringWar(factionHistory, w3.factionId, w3.war.end)) return;
          if (w3.war.start && w3.war.start >= cutoff) {
            const ds2 = Formatter.dateLogical(w3.war.start * 1e3);
            (map[ds2] = map[ds2] || {}).warStart = true;
          }
          const ds = Formatter.dateLogical(w3.war.end * 1e3);
          const entry = map[ds] = map[ds] || {};
          if (w3.outcome === "won") entry.warWon = true;
          else if (w3.outcome === "lost") entry.warLost = true;
          else entry.warEnd = true;
        });
      } catch (e3) {
      }
    }
    _warMarkerCache = { raw, cutoff, map };
    return map;
  }
  app.fetchWars = fetchWars;
  app.fetchFactionHistory = fetchFactionHistory;
  app.getFactionHistory = getFactionHistory;
  app.fetchPastFactionWars = fetchPastFactionWars;
  app.wasInFactionDuringWar = wasInFactionDuringWar;
  app._warMarkerCache = _warMarkerCache;
  app.getWarMarkers = getWarMarkers;

  // src/ui/icons.ts
  var ASSETS = {
    HEADER_IMG: cdnize("https://raw.githubusercontent.com/BigBlackHawk42069/asdfaskijdnfawef/refs/heads/main/ScrptImgs/Calendar/cal-hdr.jpg"),
    GLASS_OVERLAY: cdnize("https://raw.githubusercontent.com/BigBlackHawk42069/asdfaskijdnfawef/refs/heads/main/ScrptImgs/Calendar/glass-ovly.jpg"),
    STICKER_BG: cdnize("https://raw.githubusercontent.com/BigBlackHawk42069/asdfaskijdnfawef/refs/heads/main/ScrptImgs/Stickerbook/stkr-bckgr.png"),
    NEW_STICKER_FRAME: cdnize("https://raw.githubusercontent.com/BigBlackHawk42069/asdfaskijdnfawef/refs/heads/main/ScrptImgs/Calendar/new-stkr.png"),
    GRADIENT: `<defs><linearGradient id="bbgl_silver_grad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#d9d9d9;stop-opacity:1" /><stop offset="100%" style="stop-color:#999999;stop-opacity:1" /></linearGradient></defs>`
  };
  var ICONS = {
    LOGO_PATH: `M193.636 22.044 C 182.529 27.985,180.338 45.621,189.593 54.592 C 193.384 58.266,193.325 58.939,188.176 70.810 C 163.707 127.227,143.908 132.713,103.872 94.170 C 97.232 87.778,97.187 87.704,98.234 84.744 C 102.964 71.365,85.668 57.225,74.917 65.683 C 65.274 73.267,71.102 91.707,83.674 93.393 C 86.535 93.777,87.611 94.407,88.243 96.069 C 89.543 99.488,100.349 139.625,104.966 158.182 C 107.267 167.432,109.322 175.494,109.532 176.099 C 109.800 176.869,111.627 176.423,115.639 174.608 C 154.845 156.875,247.090 156.878,286.205 174.613 C 293.432 177.890,291.721 180.896,299.107 151.950 C 311.947 101.626,314.454 93.636,317.401 93.636 C 326.599 93.636,334.579 79.275,330.342 70.347 C 322.578 53.985,297.084 68.675,303.582 85.767 C 305.874 91.794,271.086 117.463,258.740 118.855 C 242.368 120.700,226.759 103.733,212.306 68.380 L 208.113 58.124 211.323 55.097 C 226.571 40.716,211.474 12.503,193.636 22.044 M138.379 65.055 C 132.851 68.927,132.526 85.309,137.973 85.475 C 138.338 85.486,139.582 86.223,140.738 87.112 L 142.839 88.729 139.512 98.673 C 137.682 104.142,135.612 109.726,134.911 111.082 C 133.185 114.418,133.200 114.456,136.789 115.955 C 146.318 119.937,155.721 116.589,165.869 105.601 L 168.556 102.692 162.196 96.119 C 152.170 85.755,152.287 85.936,154.000 83.490 C 160.757 73.843,147.749 58.492,138.379 65.055 M254.135 66.447 C 249.029 70.930,247.780 79.527,251.606 83.864 C 253.281 85.763,253.294 85.744,242.310 97.108 L 235.000 104.671 239.263 108.569 C 247.293 115.913,255.483 117.954,264.959 114.973 C 271.221 113.003,271.405 112.722,269.230 108.440 C 267.406 104.849,262.723 90.706,262.733 88.817 C 262.736 88.218,263.983 87.019,265.504 86.154 C 267.186 85.196,268.997 82.935,270.127 80.379 C 275.243 68.813,263.295 58.404,254.135 66.447 M190.909 167.921 C 145.964 169.201,105.455 180.299,105.455 191.333 C 105.455 199.464,110.615 201.124,121.309 196.434 C 161.535 178.793,239.237 178.622,279.896 196.086 C 290.951 200.834,296.364 199.296,296.364 191.407 C 296.364 181.127,258.823 169.956,219.545 168.547 C 212.545 168.296,204.773 168.009,202.273 167.909 C 199.773 167.809,194.659 167.815,190.909 167.921`,
    get LOGO() {
      return `<svg id="bbgl-header-icon" xmlns="http://www.w3.org/2000/svg" viewBox="60 20 280 215" width="28" height="28" style="margin-right: 4px;">${ASSETS.GRADIENT}<g transform="scale(1, 1.15)"><path fill="url(#bbgl_silver_grad)" d="${this.LOGO_PATH}"></path></g></svg>`;
    },
    CLIPBOARD: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="100%" height="100%">${ASSETS.GRADIENT}<path fill="url(#bbgl_silver_grad)" d="M17,2.25V18H2V2.25H5.5l-2,2.106V16.5h12V4.356L13.543,2.25H17Zm-2.734,3L11.781,2.573V2.266A2.266,2.266,0,0,0,7.25,2.25v.323L4.777,5.25ZM9.5,1.5a.75.75,0,1,1-.75.75A.75.75,0,0,1,9.5,1.5ZM5.75,12.75h7.5v.75H5.75Zm0-.75h7.5v-.75H5.75Zm0-1.5h7.5V9.75H5.75Zm0-1.5h7.5V8.25H5.75Z"></path></svg>`,
    MINIMIZE: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" class="bbgl-native-icon" aria-label="Minimize">${ASSETS.GRADIENT}<rect fill="url(#bbgl_silver_grad)" x="0" y="21" width="24" height="3"></rect></svg>`,
    POPOUT: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="24" height="24" class="bbgl-native-icon">${ASSETS.GRADIENT}<path fill="url(#bbgl_silver_grad)" d="M12,12H6V6h6ZM4.5,6.621V4.5H6.621L4.061,1.939,6,0H0V6L1.939,4.061ZM6.621,13.5H4.5V11.379L1.939,13.94,0,12v6H6L4.061,16.06ZM13.5,11.379V13.5H11.379l2.561,2.56L12,18h6V12l-1.94,1.94L13.5,11.379ZM12,0l1.94,1.939L11.379,4.5H13.5V6.621l2.56-2.561L18,6V0Z"></path></svg>`,
    COMPRESS: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="24" height="24" class="bbgl-native-icon">${ASSETS.GRADIENT}<g transform="translate(1290 304)"><path fill="url(#bbgl_silver_grad)" d="M-1277-291h6l-1.939,1.939,1.561,1.561-2.121,2.12-1.561-1.561L-1277-285Zm-9.94,4.06-1.561,1.561-2.12-2.12,1.561-1.561L-1291-291h6v6ZM-1284-292v-6h6v6Zm7-7v-6l1.939,1.94,1.561-1.561,2.121,2.121-1.561,1.561L-1271-299Zm-14,0,1.939-1.939-1.561-1.561,2.12-2.121,1.561,1.561L-1285-305v6Z"></path></g></svg>`,
    CHART: `<svg viewBox="0 0 24 24" fill="none"><line x1="4" y1="21.5" x2="4" y2="10.5" stroke="#536e8c" stroke-width="5" stroke-linecap="round"/><line x1="9.5" y1="21.5" x2="9.5" y2="2.5" stroke="#a64d42" stroke-width="5" stroke-linecap="round"/><line x1="15" y1="21.5" x2="15" y2="8" stroke="#b88645" stroke-width="5" stroke-linecap="round"/><line x1="20.5" y1="21.5" x2="20.5" y2="13.5" stroke="#547d51" stroke-width="5" stroke-linecap="round"/></svg>`,
    LEDGER: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="2" width="18" height="20" rx="2" fill="none"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="16" x2="17" y2="16"/></svg>`,
    GRAPH: `<svg viewBox="0 0 24 24"><path d="M3,12 L7,16 L13,6 L18,14 L22,8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    STICKERBOOK: `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.5" fill="none"/><circle cx="12" cy="5.5" r="3.5" fill="none"/><circle cx="18" cy="10" r="3.5" fill="none"/><circle cx="16" cy="17" r="3.5" fill="none"/><circle cx="8" cy="17" r="3.5" fill="none"/><circle cx="6" cy="10" r="3.5" fill="none"/></svg>`,
    ACHIEVEMENTS: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" fill="none"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" fill="none"></path><path d="M4 22h16" fill="none"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" fill="none"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" fill="none"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" fill="none"></path></svg>`,
    PASTE: `<svg viewBox="0 0 24 24"><path d="M19,20H5V4H7V7H17V4H19M12,2A1,1 0 0,1 13,3A1,1 0 0,1 12,4A1,1 0 0,1 11,3A1,1 0 0,1 12,2M19,2H14.82C14.4,0.84 13.3,0 12,0C10.7,0 9.6,0.84 9.18,2H5A2,2 0 0,0 3,4V20A2,2 0 0,0 5,22H19A2,2 0 0,0 21,20V4A2,2 0 0,0 19,2Z"/></svg>`,
    CHECK: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17 4 12" fill="none"/></svg>`,
    CLOSE: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
  };
  var EXP_CROWN_PATH = "M193.636 22.044 C 182.529 27.985,180.338 45.621,189.593 54.592 C 193.384 58.266,193.325 58.939,188.176 70.810 C 163.707 127.227,143.908 132.713,103.872 94.170 C 97.232 87.778,97.187 87.704,98.234 84.744 C 102.964 71.365,85.668 57.225,74.917 65.683 C 65.274 73.267,71.102 91.707,83.674 93.393 C 86.535 93.777,87.611 94.407,88.243 96.069 C 89.543 99.488,100.349 139.625,104.966 158.182 C 107.267 167.432,109.322 175.494,109.532 176.099 C 109.800 176.869,111.627 176.423,115.639 174.608 L 286.205 174.613 C 293.432 177.890,291.721 180.896,299.107 151.950 C 311.947 101.626,314.454 93.636,317.401 93.636 C 326.599 93.636,334.579 79.275,330.342 70.347 C 322.578 53.985,297.084 68.675,303.582 85.767 C 305.874 91.794,271.086 117.463,258.740 118.855 C 242.368 120.700,226.759 103.733,212.306 68.380 L 208.113 58.124 211.323 55.097 C 226.571 40.716,211.474 12.503,193.636 22.044 M138.379 65.055 C 132.851 68.927,132.526 85.309,137.973 85.475 C 138.338 85.486,139.582 86.223,140.738 87.112 L 142.839 88.729 139.512 98.673 C 137.682 104.142,135.612 109.726,134.911 111.082 C 133.185 114.418,133.200 114.456,136.789 115.955 C 146.318 119.937,155.721 116.589,165.869 105.601 L 168.556 102.692 162.196 96.119 C 152.170 85.755,152.287 85.936,154.000 83.490 C 160.757 73.843,147.749 58.492,138.379 65.055 M254.135 66.447 C 249.029 70.930,247.780 79.527,251.606 83.864 C 253.281 85.763,253.294 85.744,242.310 97.108 L 235.000 104.671 239.263 108.569 C 247.293 115.913,255.483 117.954,264.959 114.973 C 271.221 113.003,271.405 112.722,269.230 108.440 C 267.406 104.849,262.723 90.706,262.733 88.817 C 262.736 88.218,263.983 87.019,265.504 86.154 C 267.186 85.196,268.997 82.935,270.127 80.379 C 275.243 68.813,263.295 58.404,254.135 66.447";
  var CROWN_BADGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="60 20 280 154.6" preserveAspectRatio="none">${ASSETS.GRADIENT}<g><path fill="url(#bbgl_silver_grad)" d="${EXP_CROWN_PATH}"></path></g></svg>`;
  var CROWN_BADGE_URL = `data:image/svg+xml,${encodeURIComponent(CROWN_BADGE_SVG)}`;

  // src/data/backfill.js
  function backfillDayStart(ts) {
    return Math.floor(Formatter.parse(Formatter.dateLogical(ts * 1e3)).getTime() / 1e3);
  }
  function ensureBackfillTargets(ds) {
    if (!ds.targets || typeof ds.targets !== "object") ds.targets = {};
    const fr = ds.targets.frontiers;
    const validShape = fr && typeof fr === "object" && BACKFILL_GROUP_KEYS.every((g4) => fr[g4] && typeof fr[g4].cursor === "number") && Object.keys(fr).every((k3) => BACKFILL_GROUP_KEYS.includes(k3));
    if (!validShape) {
      ds.targets.frontiers = {};
      const seed = Math.floor(Date.now() / 1e3);
      BACKFILL_GROUP_KEYS.forEach((g4) => {
        ds.targets.frontiers[g4] = { cursor: seed, complete: false };
      });
    }
    return ds.targets.frontiers;
  }
  function seriesEntryCode(e3) {
    return e3.type === "item" ? String(e3.logId) : app.GYM_STAT_LOGS[e3.stat];
  }
  function computeBackfillFloor(stored, frontiers) {
    const existing = typeof stored.meta.logStartDate === "number" ? stored.meta.logStartDate : null;
    if (!stored.series.length) return existing;
    const perGroupOldest = {};
    stored.series.forEach((e3) => {
      const code = seriesEntryCode(e3);
      const g4 = code && BACKFILL_GROUP_OF[code];
      if (g4 && (perGroupOldest[g4] === void 0 || e3.ts < perGroupOldest[g4])) perGroupOldest[g4] = e3.ts;
    });
    let shallowPartialDayStart = null;
    Object.keys(frontiers || {}).forEach((g4) => {
      const fr = frontiers[g4];
      if (fr && !fr.complete && perGroupOldest[g4] !== void 0) {
        const dayStart = backfillDayStart(perGroupOldest[g4]);
        if (shallowPartialDayStart === null || dayStart > shallowPartialDayStart) shallowPartialDayStart = dayStart;
      }
    });
    let newFloor;
    if (shallowPartialDayStart !== null) {
      newFloor = shallowPartialDayStart + 86400;
    } else {
      newFloor = backfillDayStart(stored.series[0].ts);
    }
    if (existing !== null) newFloor = Math.min(newFloor, existing);
    return newFloor;
  }
  async function persistBackfillState(ds) {
    let meta;
    if (historyCache && historyCache.meta) {
      meta = historyCache.meta;
    } else {
      const stored = await app.DBManager.getStorage();
      meta = stored && stored.meta || { baselineBreakdown: { ...ZERO_BREAKDOWN } };
    }
    meta.backfill = ds;
    await app.DBManager.saveDays(meta, []);
  }
  async function _persistBackfillSeries(ds, collected) {
    let stored = await app.DBManager.getStorage();
    if (!stored) stored = {
      meta: {
        baselineBreakdown: {
          ...ZERO_BREAKDOWN
        }
      },
      series: []
    };
    if (!Array.isArray(stored.series)) stored.series = [];
    if (collected && collected.length > 0) {
      const seenGym = new Set(stored.series.filter((e3) => e3.type !== "item").map((e3) => `${e3.ts}_${e3.stat}_${e3.after}`));
      const itemKey = (e3) => `${e3.ts}_${e3.logId}`;
      const seenItem = new Set(stored.series.filter((e3) => e3.type === "item").map(itemKey));
      collected.forEach((l3) => {
        if (l3.type === "item") {
          const key2 = itemKey(l3);
          if (!seenItem.has(key2)) {
            seenItem.add(key2);
            const entry = {
              ts: l3.ts,
              type: "item",
              id: l3.id,
              logId: l3.logId
            };
            if (l3.energy) entry.energy = l3.energy;
            if (l3.energyLost != null) entry.energyLost = l3.energyLost;
            if (l3.happyLost != null) entry.happyLost = l3.happyLost;
            if (l3.happy) entry.happy = l3.happy;
            if (l3.statKey) {
              entry.statKey = l3.statKey;
              entry.statGain = l3.statGain;
            }
            stored.series.push(entry);
          }
          return;
        }
        const after = r2(l3.after);
        const key = `${l3.ts}_${l3.stat}_${after}`;
        if (!seenGym.has(key)) {
          seenGym.add(key);
          stored.series.push({
            ts: l3.ts,
            stat: l3.stat,
            gain: r2(l3.gain),
            cost: l3.cost,
            after,
            rate: l3.cost > 0 ? r2(l3.gain / l3.cost * 150) : 0
          });
        }
      });
      stored.series.sort((a3, b2) => a3.ts - b2.ts);
      const baseline = {
        ...stored.meta && stored.meta.baselineBreakdown || ZERO_BREAKDOWN
      };
      STAT_KEYS.forEach((k3) => {
        const first = stored.series.find((e3) => e3.stat === k3);
        if (first) baseline[k3] = r2(first.after - first.gain);
      });
      stored.meta.baselineBreakdown = baseline;
      stored.meta.logStartDate = computeBackfillFloor(stored, ds.targets.frontiers);
    }
    stored.meta.backfill = ds;
    await app.DBManager.setStorage(stored);
    return stored;
  }
  async function finalizeBackfill(ds, collected) {
    const stored = await _persistBackfillSeries(ds, collected);
    const rebuilt = app.DataController._rebuildFromSeries(stored.series || [], stored.meta.baselineBreakdown || ZERO_BREAKDOWN);
    setHistoryCache({
      meta: stored.meta,
      history: rebuilt.history,
      today: rebuilt.today
    });
    app.DataController.invalidate();
  }
  async function acknowledgeBackfill() {
    if (runtime.demoMode || runtime.backfilling) return;
    const s3 = app.getActiveHistory();
    const ds = s3.meta && s3.meta.backfill;
    if (!ds || ds.lastResult !== "complete" || ds.acknowledged !== false) return;
    ds.acknowledged = true;
    await finalizeBackfill(ds, []);
    window.dispatchEvent(new CustomEvent("bbgl:dataUpdated"));
    renderBackfillButton();
    app.renderScanOverlay();
  }
  async function proceedPartialBackfill() {
    if (runtime.demoMode || runtime.backfilling) return;
    const s3 = app.getActiveHistory();
    const ds = s3.meta && s3.meta.backfill;
    if (!ds || ds.lastResult !== "partial" || ds.acknowledged !== false) return;
    ds.acknowledged = true;
    try {
      await persistBackfillState(ds);
    } catch (e3) {
      Log.warn("Backfill proceed save failed", e3);
    }
    renderBackfillButton();
    app.renderScanOverlay();
  }
  async function discardBackfillData(ds) {
    let stored = await app.DBManager.getStorage();
    if (!stored) stored = { meta: { baselineBreakdown: { ...ZERO_BREAKDOWN } }, series: [] };
    if (!Array.isArray(stored.series)) stored.series = [];
    if (!stored.meta) stored.meta = { baselineBreakdown: { ...ZERO_BREAKDOWN } };
    let cutoff = typeof stored.meta.rewardStartDate === "number" ? stored.meta.rewardStartDate : null;
    if (cutoff === null) {
      const p3 = Date.parse(userConfig.privacyAgreed);
      cutoff = isNaN(p3) ? Math.floor(Date.now() / 1e3) : Math.floor(p3 / 1e3);
    }
    stored.series = stored.series.filter((e3) => e3.ts >= cutoff);
    let curStats = null;
    try {
      const res = await fetch(`https://api.torn.com/user/?selections=battlestats&key=${userConfig.apiKey}&timestamp=${Date.now()}`);
      app.incrementApiCount(1);
      const data = await res.json();
      if (!data.error) curStats = data;
    } catch (e3) {
      Log.warn("Discard baseline battlestats fetch failed", e3);
    }
    if (curStats) {
      const liveGain = { str: 0, def: 0, spd: 0, dex: 0 };
      stored.series.forEach((e3) => {
        if (e3.type !== "item" && liveGain[e3.stat] !== void 0) liveGain[e3.stat] += e3.gain || 0;
      });
      stored.meta.baselineBreakdown = {
        str: r2((curStats.strength || 0) - liveGain.str),
        def: r2((curStats.defense || 0) - liveGain.def),
        spd: r2((curStats.speed || 0) - liveGain.spd),
        dex: r2((curStats.dexterity || 0) - liveGain.dex)
      };
    }
    ds.targets = {};
    ensureBackfillTargets(ds);
    stored.meta.logStartDate = cutoff;
    ds.lastResult = null;
    ds.stopReason = null;
    ds.completion = null;
    ds.acknowledged = true;
    ds.lock = 0;
    ds.lockOwner = null;
    stored.meta.backfill = ds;
    await app.DBManager.setStorage(stored);
    const rebuilt = app.DataController._rebuildFromSeries(stored.series || [], stored.meta.baselineBreakdown || ZERO_BREAKDOWN);
    setHistoryCache({ meta: stored.meta, history: rebuilt.history, today: rebuilt.today });
    app.DataController.invalidate();
  }
  async function fetchBackfillPage(param, cursor) {
    const url = `https://api.torn.com/user/?selections=log&log=${param}&key=${userConfig.apiKey}&to=${Math.floor(cursor)}&timestamp=${Date.now()}`;
    app.incrementApiCount(1);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(resp.status);
    return resp.json();
  }
  async function backfillLogs(btn) {
    if (runtime.demoMode) return;
    if (!userConfig.apiKey || userConfig.apiKey.length < 16) {
      alert("API Key is missing or too short.");
      return;
    }
    if (runtime.backfilling) return;
    const s3 = app.getActiveHistory();
    if (!s3.meta.backfill) s3.meta.backfill = app.defaultBackfill();
    const ds = s3.meta.backfill;
    const now = Date.now();
    if (ds.cooldownUntil) {
      if (now < ds.cooldownUntil) {
        renderBackfillButton();
        app.renderScanOverlay();
        return;
      }
      ds.cooldownUntil = 0;
      ds.rowsUsed = 0;
    }
    const freshStored = await app.DBManager.getStorage();
    const liveLock = freshStored && freshStored.meta && freshStored.meta.backfill && freshStored.meta.backfill.lock;
    if (liveLock && Date.now() - liveLock < BACKFILL.LOCK_STALE_MS) {
      renderBackfillButton();
      app.renderScanOverlay();
      return;
    }
    const budget = Math.max(0, BACKFILL.SOFT_CAP - (ds.rowsUsed || 0));
    if (budget <= 0) {
      ds.lastResult = "partial";
      ds.stopReason = "cap";
      ds.acknowledged = false;
      ds.cooldownUntil = Date.now() + BACKFILL.COOLDOWN_MS;
      await persistBackfillState(ds);
      renderBackfillButton();
      app.renderScanOverlay();
      return;
    }
    const frontiers = ensureBackfillTargets(ds);
    ds.lastResult = "partial";
    ds.stopReason = null;
    ds.acknowledged = false;
    ds.lock = Date.now();
    ds.lockOwner = TAB_ID;
    runtime.backfillAbort = null;
    await persistBackfillState(ds);
    runtime.backfilling = true;
    app.renderScanOverlay();
    await app.fetchFactionHistory();
    await app.fetchPastFactionWars();
    if (btn) {
      if (!btn.dataset.originalText) btn.dataset.originalText = btn.innerText;
      btn.style.pointerEvents = "none";
      btn.style.opacity = "0.85";
      btn.innerText = "Scanning... 0";
    }
    let sessionRows = 0;
    let stoppedEarly = false;
    let capHit = false;
    let aborted = null;
    let drainDay = null;
    let pending = [];
    let lastHeartbeat = Date.now();
    const flush = async () => {
      ds.lock = Date.now();
      ds.lockOwner = TAB_ID;
      await _persistBackfillSeries(ds, pending);
      pending = [];
      lastHeartbeat = Date.now();
    };
    try {
      while (sessionRows < BACKFILL.HARD_CAP) {
        if (runtime.backfillAbort) {
          aborted = runtime.backfillAbort;
          break;
        }
        let pick = null;
        BACKFILL_GROUP_KEYS.forEach((g4) => {
          const fr2 = frontiers[g4];
          if (!fr2 || fr2.complete) return;
          if (drainDay !== null && fr2.cursor < drainDay) return;
          if (pick === null || fr2.cursor > frontiers[pick].cursor) pick = g4;
        });
        if (pick === null) break;
        const fr = frontiers[pick];
        const param = BACKFILL_GROUPS[pick];
        let data;
        try {
          data = await fetchBackfillPage(param, fr.cursor);
        } catch (netErr) {
          Log.warn("Deep scan network error", netErr);
          stoppedEarly = true;
          break;
        }
        if (data.error) {
          if (data.error.code === 14 || data.error.code === 5) {
            stoppedEarly = true;
            break;
          }
          throw new Error(data.error.error);
        }
        let rowKeys = data.log ? Object.keys(data.log) : [];
        if (rowKeys.length === 0) {
          await new Promise((r4) => setTimeout(r4, BACKFILL.THROTTLE_MS));
          let confirm2;
          try {
            confirm2 = await fetchBackfillPage(param, fr.cursor);
          } catch (netErr) {
            Log.warn("Deep scan confirm network error", netErr);
            stoppedEarly = true;
            break;
          }
          if (confirm2.error) {
            if (confirm2.error.code === 14 || confirm2.error.code === 5) {
              stoppedEarly = true;
              break;
            }
            throw new Error(confirm2.error.error);
          }
          const cKeys = confirm2.log ? Object.keys(confirm2.log) : [];
          if (cKeys.length === 0) {
            fr.complete = true;
            continue;
          }
          data = confirm2;
          rowKeys = cKeys;
        }
        pending.push(...normalizeApiLogs(data.log));
        sessionRows += rowKeys.length;
        ds.rowsUsed = (ds.rowsUsed || 0) + rowKeys.length;
        let oldestTs = fr.cursor;
        for (const k3 of rowKeys) {
          const t3 = data.log[k3].timestamp;
          if (t3 < oldestTs) oldestTs = t3;
        }
        fr.cursor = oldestTs - 1;
        if (btn) btn.innerText = `Scanning... ${ds.rowsUsed}`;
        app.updateScanOverlayCount(ds.rowsUsed);
        if (drainDay === null && ds.rowsUsed >= BACKFILL.SOFT_CAP) {
          capHit = true;
          let maxCursor = -Infinity;
          BACKFILL_GROUP_KEYS.forEach((g4) => {
            const f4 = frontiers[g4];
            if (f4 && !f4.complete && f4.cursor > maxCursor) maxCursor = f4.cursor;
          });
          if (maxCursor > -Infinity) drainDay = backfillDayStart(maxCursor);
        }
        if (pending.length >= BACKFILL.CHECKPOINT_ROWS || Date.now() - lastHeartbeat >= BACKFILL.HEARTBEAT_MS) {
          await flush();
        }
        if (sessionRows >= BACKFILL.HARD_CAP) {
          stoppedEarly = true;
          break;
        }
        await new Promise((r4) => setTimeout(r4, BACKFILL.THROTTLE_MS));
      }
    } catch (e3) {
      Log.error("Deep sync failed", e3);
      stoppedEarly = true;
    }
    ds.lock = 0;
    ds.lockOwner = null;
    if (aborted === "cancel") {
      pending = [];
      runtime.backfilling = false;
      runtime.backfillAbort = null;
      try {
        await discardBackfillData(ds);
      } catch (e3) {
        Log.error("Backfill discard failed", e3);
      }
      window.dispatchEvent(new CustomEvent("bbgl:dataUpdated"));
      renderBackfillButton();
      app.renderScanOverlay();
      return;
    }
    const allComplete = BACKFILL_GROUP_KEYS.every((g4) => frontiers[g4] && frontiers[g4].complete);
    if (allComplete && !stoppedEarly && !aborted) {
      ds.lastResult = "complete";
      ds.stopReason = null;
      ds.acknowledged = false;
      ds.cooldownUntil = 0;
      ds.rowsUsed = 0;
    } else {
      ds.lastResult = "partial";
      ds.acknowledged = false;
      if (aborted === "pause") {
        ds.stopReason = "paused";
      } else if (capHit || (ds.rowsUsed || 0) >= BACKFILL.SOFT_CAP) {
        ds.stopReason = "cap";
        ds.cooldownUntil = Date.now() + BACKFILL.COOLDOWN_MS;
      } else {
        ds.stopReason = "error";
      }
    }
    try {
      await finalizeBackfill(ds, pending);
    } catch (e3) {
      Log.error("Deep scan save failed", e3);
    } finally {
      runtime.backfilling = false;
      runtime.backfillAbort = null;
    }
    if (ds.lastResult === "complete") {
      const baseline = historyCache && historyCache.meta && historyCache.meta.baselineBreakdown || ZERO_BREAKDOWN;
      const reachedOrigin = STAT_KEYS.every((k3) => (baseline[k3] || 0) <= BACKFILL.ORIGIN_MAX_STAT);
      ds.completion = reachedOrigin ? "origin" : "exhausted";
      try {
        await persistBackfillState(ds);
      } catch (e3) {
        Log.error("Backfill completion flag save failed", e3);
      }
    }
    window.dispatchEvent(new CustomEvent("bbgl:dataUpdated"));
    renderBackfillButton();
    app.renderScanOverlay();
  }
  async function recoverInterruptedBackfill() {
    if (runtime.demoMode || runtime.backfilling) return;
    const s3 = app.getActiveHistory();
    const ds = s3.meta && s3.meta.backfill;
    if (!ds || !ds.lock) return;
    if (Date.now() - ds.lock <= BACKFILL.LOCK_STALE_MS) return;
    ds.lock = 0;
    ds.lockOwner = null;
    if (ds.lastResult !== "complete") {
      ds.lastResult = "partial";
      if (ds.stopReason !== "cap") ds.stopReason = "interrupted";
      ds.acknowledged = false;
    }
    try {
      await persistBackfillState(ds);
    } catch (e3) {
      Log.warn("Backfill lock recovery save failed", e3);
    }
  }
  function buildBackfillChoiceModalHTML() {
    return "";
  }
  function closeBackfillChoiceModal() {
    if (typeof app.closeBackfillChoiceModal === "function" && app.closeBackfillChoiceModal !== closeBackfillChoiceModal) {
      app.closeBackfillChoiceModal();
      return;
    }
    const host = document.getElementById("bbgl-choice-modal-host");
    if (host && host.parentNode) host.parentNode.removeChild(host);
    const m3 = document.getElementById("bbgl-choice-modal");
    if (m3 && m3.parentNode) m3.parentNode.removeChild(m3);
  }
  function openBackfillChoiceModal() {
    if (runtime.demoMode) return;
    if (typeof app.openBackfillChoiceModal === "function" && app.openBackfillChoiceModal !== openBackfillChoiceModal) {
      app.openBackfillChoiceModal();
      return;
    }
  }
  var _backfillCountdownId = null;
  function formatCountdown(ms) {
    const total = Math.max(0, Math.ceil(ms / 1e3));
    const h3 = Math.floor(total / 3600), m3 = Math.floor(total % 3600 / 60), s3 = total % 60;
    const pad = (n2) => String(n2).padStart(2, "0");
    return `${pad(h3)}:${pad(m3)}:${pad(s3)}`;
  }
  function startBackfillFromSettings() {
    if (runtime.demoMode) return;
    app.switchView("ledger");
    backfillLogs(document.getElementById("backfill-btn"));
  }
  var BACKFILL_IDLE_LABEL = "Big Black Backfill";
  var BACKFILL_RESUME_LABEL = '<span class="view-std">Resume BB Backfill</span><span class="view-exp">Resume Big Black Backfill</span>';
  var BACKFILL_CONFIRM_LABEL = "Tap Again to Confirm";
  var _backfillConfirmTimeout = null;
  function armBackfillConfirm(btn, onConfirm) {
    if (_backfillConfirmTimeout) clearTimeout(_backfillConfirmTimeout);
    btn.innerHTML = BACKFILL_CONFIRM_LABEL;
    btn.onclick = function() {
      this.blur();
      if (_backfillConfirmTimeout) {
        clearTimeout(_backfillConfirmTimeout);
        _backfillConfirmTimeout = null;
      }
      onConfirm();
    };
    _backfillConfirmTimeout = setTimeout(() => {
      _backfillConfirmTimeout = null;
      renderBackfillButton();
    }, 4e3);
  }
  function renderBackfillButton() {
    if (typeof app.notifyUi === "function") app.notifyUi();
  }
  app.backfillDayStart = backfillDayStart;
  app.ensureBackfillTargets = ensureBackfillTargets;
  app.seriesEntryCode = seriesEntryCode;
  app.computeBackfillFloor = computeBackfillFloor;
  app.persistBackfillState = persistBackfillState;
  app._persistBackfillSeries = _persistBackfillSeries;
  app.finalizeBackfill = finalizeBackfill;
  app.acknowledgeBackfill = acknowledgeBackfill;
  app.proceedPartialBackfill = proceedPartialBackfill;
  app.discardBackfillData = discardBackfillData;
  app.fetchBackfillPage = fetchBackfillPage;
  app.backfillLogs = backfillLogs;
  app.recoverInterruptedBackfill = recoverInterruptedBackfill;
  app.buildBackfillChoiceModalHTML = buildBackfillChoiceModalHTML;
  app.closeBackfillChoiceModal = closeBackfillChoiceModal;
  app.openBackfillChoiceModal = openBackfillChoiceModal;
  app._backfillCountdownId = _backfillCountdownId;
  app.formatCountdown = formatCountdown;
  app.startBackfillFromSettings = startBackfillFromSettings;
  app.BACKFILL_IDLE_LABEL = BACKFILL_IDLE_LABEL;
  app.BACKFILL_RESUME_LABEL = BACKFILL_RESUME_LABEL;
  app.BACKFILL_CONFIRM_LABEL = BACKFILL_CONFIRM_LABEL;
  app._backfillConfirmTimeout = _backfillConfirmTimeout;
  app.armBackfillConfirm = armBackfillConfirm;
  app.renderBackfillButton = renderBackfillButton;

  // src/domain/demo.js
  function generateDemoData() {
    let _seed = 2654435769;
    function rand() {
      _seed += 1831565813;
      let t3 = _seed;
      t3 = Math.imul(t3 ^ t3 >>> 15, t3 | 1);
      t3 ^= t3 + Math.imul(t3 ^ t3 >>> 7, t3 | 61);
      return ((t3 ^ t3 >>> 14) >>> 0) / 4294967296;
    }
    function randInt(lo, hi) {
      return lo + Math.floor(rand() * (hi - lo + 1));
    }
    const today = Formatter.dateLogical();
    const todayMs = Formatter.parse(today).getTime();
    const DAY_MS = 864e5;
    const NUM_DAYS = 365;
    const Simulation = { A: 3480061091e-16, B: 250, C: 3091619094e-15, D: 682775184551527e-19, E: -0.0301431777 };
    const DEMO_GYM_DOTS = 9;
    const DEMO_HAPPY = 4950;
    const DEMO_MODIFIERS = 2.5;
    const DEMO_E_PER_TRAIN = 5;
    const DEMO_FORMULA_E_BASE = 10;
    function simulationGain(statTotal) {
      const happyFactor = DEMO_HAPPY + Simulation.B;
      const base = (Simulation.A * Math.log(happyFactor) + Simulation.C) * statTotal + Simulation.D * happyFactor + Simulation.E;
      const perStandardTrain = base * DEMO_GYM_DOTS * DEMO_MODIFIERS;
      const perTrain = perStandardTrain * (DEMO_E_PER_TRAIN / DEMO_FORMULA_E_BASE);
      return Math.max(0, perTrain);
    }
    const statKeys = ["str", "def", "spd", "dex"];
    const dates = [];
    for (let i3 = NUM_DAYS - 1; i3 >= 0; i3--) {
      const ms = todayMs - i3 * DAY_MS;
      const d3 = new Date(ms);
      dates.push(Formatter.dateISO(d3.getUTCFullYear(), d3.getUTCMonth(), d3.getUTCDate()));
    }
    const baseline = {};
    statKeys.forEach((k3) => {
      baseline[k3] = 15e3 + randInt(0, 1e4);
    });
    const weekStartOffset = userConfig.weekStartMode === "mon" ? 1 : 0;
    const todayDate = new Date(todayMs);
    const todayDow = todayDate.getUTCDay();
    const daysFromWeekStart = (todayDow - weekStartOffset + 7) % 7;
    const weekDay0Str = dates[NUM_DAYS - 1 - daysFromWeekStart] || null;
    const weekDay1Str = daysFromWeekStart >= 1 ? dates[NUM_DAYS - daysFromWeekStart] : null;
    const running = { ...baseline };
    const history2 = [];
    let mixedWeek = 0;
    dates.forEach((dateStr, idx) => {
      const roll = rand();
      if (roll < 0.1) return;
      if (mixedWeek === 0 && rand() < 0.08) mixedWeek = 7;
      let eTotalRaw;
      if (mixedWeek > 0) {
        mixedWeek--;
        const subRoll = rand();
        if (subRoll < 0.25) {
          eTotalRaw = randInt(200, 260) * 10;
        } else if (subRoll < 0.55) {
          eTotalRaw = randInt(150, 190) * 10;
        } else if (subRoll < 0.85) {
          eTotalRaw = randInt(100, 149) * 10;
        } else {
          eTotalRaw = randInt(50, 99) * 10;
        }
      } else if (roll < 0.15) {
        eTotalRaw = randInt(70, 99) * 10;
      } else {
        eTotalRaw = randInt(100, 160) * 10;
      }
      if (dateStr === weekDay0Str) eTotalRaw = Math.max(eTotalRaw, 2500);
      else if (dateStr === weekDay1Str && eTotalRaw < 2e3) eTotalRaw = Math.min(Math.max(eTotalRaw, 1e3), 1499);
      else if (rand() < 0.05) eTotalRaw = Math.max(eTotalRaw, 2500);
      const hjRoll = rand();
      const isDiamondHJDay = hjRoll < 0.05;
      const isHJDay = isDiamondHJDay || hjRoll < 0.18;
      if (isDiamondHJDay && eTotalRaw < 1800) eTotalRaw = randInt(180, 220) * 10;
      else if (isHJDay && eTotalRaw < 1e3) eTotalRaw = randInt(100, 170) * 10;
      const hjWindowStart = isHJDay ? randInt(36e3, 36e3 + 28800 - GAME.HJ_WINDOW_SECONDS) : null;
      const eTotal = eTotalRaw;
      const numStats = randInt(1, 4);
      const chosenStats = [...statKeys].sort(() => rand() - 0.5).slice(0, numStats);
      const ePerStat = {};
      let eRemain = eTotal;
      chosenStats.forEach((k3, i3) => {
        const share = i3 === chosenStats.length - 1 ? eRemain : Math.round((rand() * 0.4 + 0.1) * eTotal / numStats) * 10 || 10;
        ePerStat[k3] = Math.max(10, Math.min(share, eRemain));
        eRemain -= ePerStat[k3];
      });
      if (eRemain > 0 && chosenStats.length) ePerStat[chosenStats[0]] += eRemain;
      const startBreakdown = { ...running };
      const eSpent = { total: eTotal, ...ZERO_BREAKDOWN };
      const gains = { total: 0, ...ZERO_BREAKDOWN };
      const series = [];
      const dayStartSec = Math.floor(Formatter.parse(dateStr).getTime() / 1e3);
      chosenStats.forEach((k3) => {
        const cost = ePerStat[k3] || 0;
        if (!cost) return;
        const trainsForStat = Math.floor(cost / DEMO_E_PER_TRAIN);
        let statGainAccum = 0;
        for (let t3 = 0; t3 < trainsForStat; t3++) {
          const raw = simulationGain(running[k3]);
          const jittered = raw * (0.97 + rand() * 0.06);
          running[k3] += jittered;
          statGainAccum += jittered;
          const ts = hjWindowStart !== null ? dayStartSec + hjWindowStart + Math.floor(rand() * GAME.HJ_WINDOW_SECONDS) : dayStartSec + 36e3 + Math.floor((t3 + rand()) * (28800 / Math.max(1, trainsForStat)));
          series.push({ ts, stat: k3, gain: Math.round(jittered), cost: DEMO_E_PER_TRAIN, after: Math.round(running[k3]), rate: r2(Math.round(jittered) / DEMO_E_PER_TRAIN * 150), synthetic: true });
        }
        eSpent[k3] = cost;
        const roundedStatGain = Math.round(statGainAccum);
        gains[k3] = roundedStatGain;
        gains.total += roundedStatGain;
      });
      eSpent.total = eSpent.str + eSpent.def + eSpent.spd + eSpent.dex;
      const endBreakdown = { ...running };
      const day = initializeDayObject(
        dateStr,
        startBreakdown
      );
      day.gains = gains;
      day.eSpent = eSpent;
      day.endBreakdown = endBreakdown;
      day.endTotal = endBreakdown.str + endBreakdown.def + endBreakdown.spd + endBreakdown.dex;
      day.series = series;
      day.lastLogTimestamp = series.length ? series[series.length - 1].ts : 0;
      history2.push(day);
    });
    const lastHistDay = history2.length ? history2[history2.length - 1] : null;
    const todayStart = lastHistDay ? { ...lastHistDay.endBreakdown } : { ...running };
    const todayObj = initializeDayObject(today, todayStart);
    const oldestDate = history2.length ? history2[0].date : today;
    const logStartDate = Math.floor(Formatter.parse(oldestDate).getTime() / 1e3);
    const lastRates = {};
    statKeys.forEach((k3) => {
      const perFiveE = simulationGain(running[k3]);
      lastRates[k3] = perFiveE * (DEMO_FORMULA_E_BASE / DEMO_E_PER_TRAIN);
    });
    const meta = { baselineBreakdown: { ...baseline }, logStartDate };
    return { meta, history: history2, today: todayObj };
  }
  function refreshDemoMasks() {
    if (!dom.settingsView) return;
    dom.settingsView.querySelectorAll(".bbgl-demo-maskable").forEach((el) => {
      el.classList.toggle("bbgl-mask-active", !!runtime.demoMode);
    });
    const sdemo = dom.settingsView.querySelector("#settings-demo-btn");
    if (sdemo) sdemo.innerText = runtime.demoMode ? "EXIT DEMO" : "DEMO MODE";
  }
  function enterDemo(source) {
    if (source === "settings" || source === "privacy") {
      runtime.realReturnView = runtime.returnView;
    }
    localStorage.setItem(KEYS.DEMO, "1");
    runtime.demoMode = true;
    runtime.demoHistory = null;
    runtime.stickerData = [];
    setHistoryCache(null);
    app.DataController.invalidate();
    calendarState.selectedData = null;
    calendarState.selectedLabel = Formatter.dateLogical();
    viewState.activeViewLabel = null;
    const deb = dom.panel ? dom.panel.querySelector("#bbgl-demo-exit") : null;
    if (deb) deb.style.display = "flex";
    const debBtn = dom.panel ? dom.panel.querySelector("#bbgl-demo-exit-btn") : null;
    if (debBtn) debBtn.style.display = "flex";
    const pdeb = document.getElementById("bbgl-page-demo-exit");
    if (pdeb) pdeb.style.display = "flex";
    app.refreshInitLock();
    refreshDemoMasks();
    app.snapLevelBar();
    app.switchView("ledger");
  }
  function enterDemoFromSettings() {
    enterDemo("settings");
  }
  app.generateDemoData = generateDemoData;
  app.refreshDemoMasks = refreshDemoMasks;
  app.enterDemo = enterDemo;
  app.enterDemoFromSettings = enterDemoFromSettings;

  // src/ui/achievements-view.js
  function computeAchievements(s3) {
    const { hjDaySet } = app.DataController.getHappyJumpData();
    const allDays = [...s3.history || []];
    if (s3.today && s3.today.date) {
      const filtered = allDays.filter((d3) => d3.date !== s3.today.date);
      filtered.push(s3.today);
      allDays.splice(0, allDays.length, ...filtered);
    }
    allDays.sort((a3, b2) => a3.date.localeCompare(b2.date));
    if (!allDays.length) return null;
    const GREEN = 1e3, GOLD = 1500, DIAMOND = 2e3;
    let greenDays = 0, goldDays = 0, diamondDays = 0, trainingDays = 0, lifetimeEnergy = 0, lifetimeGains = 0;
    let maxEDay = { value: 0, date: null }, maxGainsDay = { value: 0, date: null }, maxClick = { value: 0, date: null, stat: null }, maxStatGainDay = { value: 0, date: null, stat: null };
    const bestTrainByStat = { str: null, def: null, spd: null, dex: null }, bestDayByStat = { str: null, def: null, spd: null, dex: null }, bestWeekByStat = { str: null, def: null, spd: null, dex: null }, bestMonthByStat = { str: null, def: null, spd: null, dex: null };
    const bestHJByStat = { str: null, def: null, spd: null, dex: null, total: null };
    const happyItemTotals = {};
    HAPPY_LOGS.forEach((id) => {
      happyItemTotals[id] = { count: 0, happy: 0 };
    });
    const energyItemTotals = {};
    ENERGY_LOGS.forEach((id) => {
      energyItemTotals[id] = { count: 0, energy: 0 };
    });
    const odItemTotals = {};
    OD_LOGS.forEach((id) => {
      odItemTotals[id] = { count: 0, energyLost: 0, happyLost: 0 };
    });
    const statEnhByStat = { str: { count: 0, gain: 0 }, def: { count: 0, gain: 0 }, spd: { count: 0, gain: 0 }, dex: { count: 0, gain: 0 } };
    const weekE = {}, weekG = {}, monthE = {}, monthG = {}, weekDayMap = {}, weekStatG = {}, monthStatG = {};
    allDays.forEach((day) => {
      const e3 = day.eSpent && day.eSpent.total || 0, g4 = day.gains && day.gains.total || 0;
      lifetimeEnergy += e3;
      lifetimeGains += g4;
      if (e3 >= GOLD) {
        goldDays++;
        trainingDays++;
      } else if (e3 >= GREEN) {
        greenDays++;
        trainingDays++;
      } else if (e3 > 0) {
        trainingDays++;
      }
      if (e3 >= DIAMOND) diamondDays++;
      if (e3 > maxEDay.value) maxEDay = { value: e3, date: day.date };
      if (g4 > maxGainsDay.value) maxGainsDay = { value: g4, date: day.date };
      (day.series || []).forEach((entry) => {
        if ((entry.gain || 0) > maxClick.value) maxClick = { value: entry.gain, date: day.date, stat: entry.stat, ts: entry.ts, cost: entry.cost };
        const _esk = entry.stat;
        if ((entry.gain || 0) > 0 && bestTrainByStat[_esk] !== void 0) {
          const _cur = bestTrainByStat[_esk];
          if (!_cur || entry.gain > _cur.value) bestTrainByStat[_esk] = { value: entry.gain, date: day.date, ts: entry.ts, cost: entry.cost };
        }
      });
      const wk = getWeekKey(day.date), mk = day.date.slice(0, 7);
      weekE[wk] = (weekE[wk] || 0) + e3;
      weekG[wk] = (weekG[wk] || 0) + g4;
      monthE[mk] = (monthE[mk] || 0) + e3;
      monthG[mk] = (monthG[mk] || 0) + g4;
      if (!weekDayMap[wk]) weekDayMap[wk] = [];
      weekDayMap[wk].push(day);
      ["str", "def", "spd", "dex"].forEach((sk) => {
        const sg = day.gains && day.gains[sk] || 0;
        if (!sg) return;
        if (sg > maxStatGainDay.value) maxStatGainDay = { value: sg, date: day.date, stat: sk };
        {
          const _cur = bestDayByStat[sk];
          if (!_cur || sg > _cur.value) bestDayByStat[sk] = { value: sg, date: day.date };
        }
        const wsk = sk + "\0" + wk, msk = sk + "\0" + mk;
        weekStatG[wsk] = (weekStatG[wsk] || 0) + sg;
        monthStatG[msk] = (monthStatG[msk] || 0) + sg;
      });
      if (day.items) {
        HAPPY_LOGS.forEach((id) => {
          const qty = day.items[id] || 0;
          if (qty > 0) happyItemTotals[id].count += qty;
        });
        ENERGY_LOGS.forEach((id) => {
          const qty = day.items[id] || 0;
          if (qty > 0) energyItemTotals[id].count += qty;
        });
        OD_LOGS.forEach((id) => {
          const qty = day.items[id] || 0;
          if (qty > 0) odItemTotals[id].count += qty;
        });
      }
      (day.series || []).forEach((e4) => {
        if (e4.type === "item" && e4.happy && happyItemTotals[e4.logId]) {
          happyItemTotals[e4.logId].happy += e4.happy;
        }
        if (e4.type === "item" && e4.energy && energyItemTotals[e4.logId]) {
          energyItemTotals[e4.logId].energy += e4.energy;
        }
        if (e4.type === "item" && e4.energyLost != null && odItemTotals[e4.logId]) {
          odItemTotals[e4.logId].energyLost += e4.energyLost;
        }
        if (e4.type === "item" && e4.happyLost != null && odItemTotals[e4.logId]) {
          odItemTotals[e4.logId].happyLost += e4.happyLost;
        }
        if (e4.type === "item" && e4.statKey && statEnhByStat[e4.statKey]) {
          statEnhByStat[e4.statKey].count++;
          statEnhByStat[e4.statKey].gain = Math.round((statEnhByStat[e4.statKey].gain + (e4.statGain || 0)) * 100) / 100;
        }
      });
    });
    const maxOf = (obj, key) => Object.entries(obj).reduce((best, [k3, v3]) => v3 > best.value ? { [key]: k3, value: v3 } : best, { value: 0, [key]: null });
    const maxStatOf = (obj, key) => Object.entries(obj).reduce((best, [k3, v3]) => {
      const sep = k3.indexOf("\0");
      return v3 > best.value ? { value: v3, stat: k3.slice(0, sep), [key]: k3.slice(sep + 1) } : best;
    }, { value: 0, stat: null, [key]: null });
    const bestStatWk = maxStatOf(weekStatG, "weekOf"), bestStatMn = maxStatOf(monthStatG, "rawMonth");
    Object.entries(weekStatG).forEach(([k3, v3]) => {
      const _sep = k3.indexOf("\0");
      const _sk = k3.slice(0, _sep), _wk = k3.slice(_sep + 1);
      const _cur = bestWeekByStat[_sk];
      if (!_cur || v3 > _cur.value) bestWeekByStat[_sk] = { value: v3, weekOf: _wk };
    });
    Object.entries(monthStatG).forEach(([k3, v3]) => {
      const _sep = k3.indexOf("\0");
      const _sk = k3.slice(0, _sep), _mk = k3.slice(_sep + 1);
      const _cur = bestMonthByStat[_sk];
      if (!_cur || v3 > _cur.value) bestMonthByStat[_sk] = { value: v3, rawMonth: _mk };
    });
    const fmtMonth = (mk) => mk ? `${CONSTANTS.MONTHS[parseInt(mk.slice(5)) - 1]} ${mk.slice(0, 4)}` : null;
    let greenWeeks = 0, goldWeeks = 0, diamondWeeks = 0;
    const todayStr = Formatter.dateLogical(), currentWk = getWeekKey(todayStr);
    Object.keys(weekDayMap).sort().forEach((wk) => {
      if (wk < currentWk) {
        const wc = computeWeekCompletion(weekDayMap[wk], hjDaySet);
        if (wc.isGold) goldWeeks++;
        else if (wc.isCompleted) greenWeeks++;
        if (wc.isDiamond) diamondWeeks++;
      }
    });
    const _zg = () => ({ str: 0, def: 0, spd: 0, dex: 0 });
    let longestStreak = 0, longestStreakStart = null, longestStreakEnd = null, longestStreakGains = _zg();
    let longestGoalStreak = 0, longestGoalStreakStart = null, longestGoalStreakEnd = null, longestGoalStreakGains = _zg();
    let longestGoldStreak = 0, longestGoldStreakStart = null, longestGoldStreakEnd = null, longestGoldStreakGains = _zg();
    let longestDiamondStreak = 0, longestDiamondStreakStart = null, longestDiamondStreakEnd = null, longestDiamondStreakGains = _zg();
    let sT = 0, sTStart = null, sTGains = _zg(), sG = 0, sGStart = null, sGGains = _zg(), sGo = 0, sGoStart = null, sGoGains = _zg(), sDi = 0, sDiStart = null, sDiGains = _zg(), prevDate = null;
    allDays.forEach((day) => {
      const e3 = day.eSpent && day.eSpent.total || 0;
      const g4 = day.gains || {};
      const consecutive = prevDate && (/* @__PURE__ */ new Date(day.date + "T00:00:00Z") - /* @__PURE__ */ new Date(prevDate + "T00:00:00Z")) / 864e5 === 1;
      if (e3 > 0) {
        if (consecutive && sT > 0) {
          sT++;
          ["str", "def", "spd", "dex"].forEach((k3) => {
            sTGains[k3] += g4[k3] || 0;
          });
        } else {
          sT = 1;
          sTStart = day.date;
          sTGains = { str: g4.str || 0, def: g4.def || 0, spd: g4.spd || 0, dex: g4.dex || 0 };
        }
        if (sT > longestStreak) {
          longestStreak = sT;
          longestStreakStart = sTStart;
          longestStreakEnd = day.date;
          longestStreakGains = { ...sTGains };
        }
      } else {
        sT = 0;
        sTStart = null;
        sTGains = _zg();
      }
      if (e3 >= GREEN) {
        if (consecutive && sG > 0) {
          sG++;
          ["str", "def", "spd", "dex"].forEach((k3) => {
            sGGains[k3] += g4[k3] || 0;
          });
        } else {
          sG = 1;
          sGStart = day.date;
          sGGains = { str: g4.str || 0, def: g4.def || 0, spd: g4.spd || 0, dex: g4.dex || 0 };
        }
        if (sG > longestGoalStreak) {
          longestGoalStreak = sG;
          longestGoalStreakStart = sGStart;
          longestGoalStreakEnd = day.date;
          longestGoalStreakGains = { ...sGGains };
        }
      } else {
        sG = 0;
        sGStart = null;
        sGGains = _zg();
      }
      if (e3 >= GOLD) {
        if (consecutive && sGo > 0) {
          sGo++;
          ["str", "def", "spd", "dex"].forEach((k3) => {
            sGoGains[k3] += g4[k3] || 0;
          });
        } else {
          sGo = 1;
          sGoStart = day.date;
          sGoGains = { str: g4.str || 0, def: g4.def || 0, spd: g4.spd || 0, dex: g4.dex || 0 };
        }
        if (sGo > longestGoldStreak) {
          longestGoldStreak = sGo;
          longestGoldStreakStart = sGoStart;
          longestGoldStreakEnd = day.date;
          longestGoldStreakGains = { ...sGoGains };
        }
      } else {
        sGo = 0;
        sGoStart = null;
        sGoGains = _zg();
      }
      if (e3 >= 2e3) {
        if (consecutive && sDi > 0) {
          sDi++;
          ["str", "def", "spd", "dex"].forEach((k3) => {
            sDiGains[k3] += g4[k3] || 0;
          });
        } else {
          sDi = 1;
          sDiStart = day.date;
          sDiGains = { str: g4.str || 0, def: g4.def || 0, spd: g4.spd || 0, dex: g4.dex || 0 };
        }
        if (sDi > longestDiamondStreak) {
          longestDiamondStreak = sDi;
          longestDiamondStreakStart = sDiStart;
          longestDiamondStreakEnd = day.date;
          longestDiamondStreakGains = { ...sDiGains };
        }
      } else {
        sDi = 0;
        sDiStart = null;
        sDiGains = _zg();
      }
      prevDate = day.date;
    });
    let happyJumps = 0;
    const hjWeek = {}, hjMonth = {};
    const registerJump = (jump) => {
      const wk = getWeekKey(jump.date), mk = jump.date.slice(0, 7);
      happyJumps++;
      hjWeek[wk] = (hjWeek[wk] || 0) + 1;
      hjMonth[mk] = (hjMonth[mk] || 0) + 1;
      const tot = sumStats(jump.stats);
      ["str", "def", "spd", "dex"].forEach((sk) => {
        const sv = jump.stats[sk] || 0;
        if (sv > 0 && (!bestHJByStat[sk] || sv > bestHJByStat[sk].value)) bestHJByStat[sk] = { value: sv, date: jump.date, ts: jump.ts, cost: jump.cost };
      });
      if (tot > 0 && (!bestHJByStat.total || tot > bestHJByStat.total.value)) bestHJByStat.total = { value: tot, date: jump.date, ts: jump.ts, tsEnd: jump.tsEnd, cost: jump.cost, stats: { ...jump.stats } };
    };
    allDays.forEach((day) => findHappyJumps(day.series).forEach(registerJump));
    const hjWeekBest = maxOf(hjWeek, "weekOf"), hjMonthBest = maxOf(hjMonth, "month");
    const calDays = Math.round((/* @__PURE__ */ new Date(allDays[allDays.length - 1].date + "T00:00:00Z") - /* @__PURE__ */ new Date(allDays[0].date + "T00:00:00Z")) / 864e5) + 1;
    const mxWkE = maxOf(weekE, "weekOf"), mxWkG = maxOf(weekG, "weekOf"), mxMnE = maxOf(monthE, "month"), mxMnG = maxOf(
      monthG,
      "month"
    );
    const stickersUnlocked = app.DataController.getUnlockedCount();
    const lastDay = allDays[allDays.length - 1];
    const curBD = lastDay && lastDay.endBreakdown ? lastDay.endBreakdown : null;
    const currentStats = curBD ? { str: curBD.str || 0, def: curBD.def || 0, spd: curBD.spd || 0, dex: curBD.dex || 0, total: (curBD.str || 0) + (curBD.def || 0) + (curBD.spd || 0) + (curBD.dex || 0) } : null;
    return { baseline: s3.meta && s3.meta.baselineBreakdown ? { ...s3.meta.baselineBreakdown } : null, currentStats, lifetimeEnergy, lifetimeGains, logStartDate: s3.meta && s3.meta.logStartDate || null, greenDays, goldDays, diamondDays, trainingDays, calDays, greenWeeks, goldWeeks, diamondWeeks, stickersUnlocked, trainingRestRatio: calDays > 0 ? (trainingDays / calDays * 100).toFixed(1) + "%" : "N/A", longestStreak, longestStreakStart, longestStreakEnd, longestStreakGains, longestGoalStreak, longestGoalStreakStart, longestGoalStreakEnd, longestGoalStreakGains, longestGoldStreak, longestGoldStreakStart, longestGoldStreakEnd, longestGoldStreakGains, happyJumps, happyJumpsWeekBest: hjWeekBest.weekOf ? hjWeekBest : null, happyJumpsMonthBest: hjMonthBest.month ? { value: hjMonthBest.value, month: fmtMonth(hjMonthBest.month) } : null, mostEInOneDay: maxEDay.date ? maxEDay : null, mostEInOneWeek: mxWkE.weekOf ? mxWkE : null, mostEInOneMonth: mxMnE.month ? { value: mxMnE.value, month: fmtMonth(mxMnE.month), rawMonth: mxMnE.month } : null, highestGainPerClick: maxClick.date ? maxClick : null, highestGainsInOneDay: maxGainsDay.date ? maxGainsDay : null, highestStatGainDay: maxStatGainDay.date ? maxStatGainDay : null, highestGainsInOneWeek: mxWkG.weekOf ? mxWkG : null, highestGainsInOneMonth: mxMnG.month ? { value: mxMnG.value, month: fmtMonth(mxMnG.month) } : null, highestStatGainWeek: bestStatWk.weekOf ? bestStatWk : null, highestStatGainMonth: bestStatMn.rawMonth ? { value: bestStatMn.value, month: fmtMonth(bestStatMn.rawMonth), rawMonth: bestStatMn.rawMonth, stat: bestStatMn.stat } : null, perStatBest: { bestTrain: bestTrainByStat, bestDay: bestDayByStat, bestWeek: bestWeekByStat, bestMonth: bestMonthByStat }, bestHappyJump: bestHJByStat, longestDiamondStreak, longestDiamondStreakStart, longestDiamondStreakEnd, longestDiamondStreakGains, happyItemTotals, energyItemTotals, odItemTotals, statEnhByStat };
  }
  var _achLockedResizeObserver = null;
  var _achLockedStabilizeToken = 0;
  function resizeAchLockedPage() {
    const container = document.getElementById("bbgl-ach-pages");
    const footer = document.getElementById("bbgl-ach-footer");
    if (!container || !footer) return;
    if (!_achLockedResizeObserver && typeof ResizeObserver === "function") {
      _achLockedResizeObserver = new ResizeObserver(() => resizeAchLockedPage());
    }
    if (_achLockedResizeObserver) {
      _achLockedResizeObserver.observe(container);
      _achLockedResizeObserver.observe(footer);
    }
    const token = ++_achLockedStabilizeToken;
    let lastGap = null;
    const tick = () => {
      if (token !== _achLockedStabilizeToken) return;
      const c3 = document.getElementById("bbgl-ach-pages");
      const f4 = document.getElementById("bbgl-ach-footer");
      const lockedEl = c3 && c3.querySelector(".bbgl-ach-locked");
      if (!c3 || !f4 || !lockedEl) return;
      const gap = f4.getBoundingClientRect().top - c3.getBoundingClientRect().top;
      if (gap >= 40 && lastGap !== null && Math.abs(gap - lastGap) < 0.5) {
        lockedEl.style.height = gap + "px";
        lockedEl.style.setProperty("--ach-gap", gap + "px");
        return;
      }
      lastGap = gap;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  function achRefreshPageDom() {
    if (typeof app.notifyUi === "function") app.notifyUi();
    resizeAchLockedPage();
  }
  function renderAchievements() {
    const s3 = app.getActiveHistory();
    if (!runtime._achCache) {
      runtime._achCache = Perf.wrap("computeAchievements", () => computeAchievements(s3));
      runtime._achPage = viewState.achPage || 0;
    }
    if (!runtime._achCache) return;
    if (typeof app.notifyUi === "function") app.notifyUi();
  }
  function updateAchPageIndicator() {
    if (typeof app.notifyUi === "function") app.notifyUi();
  }
  function gotoAchievementsPage(dir) {
    if (runtime._achAnimating) return;
    if (!runtime._achCache) return;
    const newPage = runtime._achPage + dir;
    if (newPage < 0 || newPage > 5) return;
    const apply = () => {
      runtime._achPage = newPage;
      viewState.achPage = newPage;
      saveViewState();
      if (typeof app.notifyUi === "function") app.notifyUi();
    };
    if (userConfig.animations) {
      runtime._achAnimating = true;
      runtime._achCrt = "bbgl-crt-out";
      if (typeof app.notifyUi === "function") app.notifyUi();
      setTimeout(() => {
        apply();
        runtime._achCrt = "bbgl-crt-in";
        if (typeof app.notifyUi === "function") app.notifyUi();
        setTimeout(() => {
          runtime._achCrt = "";
          runtime._achAnimating = false;
          if (typeof app.notifyUi === "function") app.notifyUi();
        }, 300);
      }, 280);
    } else {
      apply();
    }
  }
  function achLedgerClip(n2) {
    if (n2 === null || n2 === void 0 || typeof n2 === "number" && Number.isNaN(n2)) return "\u2014";
    return Formatter.achAbbr(n2, ACH_FMT.gains);
  }
  function achFmtVal(n2) {
    if (n2 === null || n2 === void 0) return "\u2014";
    if (typeof n2 === "number") return achLedgerClip(n2);
    return String(n2);
  }
  function achFmtDate(dateStr) {
    if (!dateStr) return "";
    return Formatter.datePretty(dateStr) || dateStr;
  }
  function achFmtWeekRange(weekOf) {
    if (!weekOf) return "";
    const d3 = Formatter.parse(weekOf);
    const end = new Date(d3.getTime() + 6 * 864e5);
    return `${Formatter.dateMonthDay(weekOf)} \u2013 ${Formatter.dateMonthDay(Formatter.dateISO(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))}, ${end.getUTCFullYear()}`;
  }
  function achFmtStreakRange(start, end) {
    if (!start || !end) return "";
    const s3 = achFmtDate(start), e3 = achFmtDate(end);
    const sy = start.slice(0, 4), ey = end.slice(0, 4);
    return (sy === ey ? s3.replace(/,?\s*\d{4}$/, "") : s3) + " \u2013 " + e3;
  }
  function achEsc(s3) {
    return String(s3).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  }
  function achFmtWeekShort(weekOf) {
    if (!weekOf) return "";
    return Formatter.datePretty(weekOf);
  }
  function achFmtMonthLong(rawMonth) {
    if (!rawMonth) return "";
    return `${CONSTANTS.MONTHS[parseInt(rawMonth.slice(5)) - 1]}, ${rawMonth.slice(0, 4)}`;
  }
  function achFmtTimeTCT(ts) {
    const d3 = new Date(ts * 1e3);
    return String(d3.getUTCHours()).padStart(2, "0") + ":" + String(d3.getUTCMinutes()).padStart(2, "0") + ":" + String(d3.getUTCSeconds()).padStart(2, "0") + " TCT";
  }
  var _achTzLocalCache = null;
  function achTimeZoneSuffix() {
    if (!TimeManager.useLocal()) return "TCT";
    if (_achTzLocalCache) return _achTzLocalCache;
    try {
      const parts = new Intl.DateTimeFormat(void 0, { timeZoneName: "short" }).formatToParts(/* @__PURE__ */ new Date());
      const tz = parts.find((p3) => p3.type === "timeZoneName");
      _achTzLocalCache = tz && tz.value ? tz.value : "Local";
    } catch (e3) {
      _achTzLocalCache = "Local";
    }
    return _achTzLocalCache;
  }
  function achFmtTimeHMClip(ts) {
    const d3 = new Date(ts * 1e3);
    return String(d3.getUTCHours()).padStart(2, "0") + ":" + String(d3.getUTCMinutes()).padStart(2, "0");
  }
  function achFmtTimeHMS(ts) {
    const d3 = new Date(ts * 1e3);
    const h3 = TimeManager.useLocal() ? d3.getHours() : d3.getUTCHours();
    const m3 = TimeManager.useLocal() ? d3.getMinutes() : d3.getUTCMinutes();
    const s3 = TimeManager.useLocal() ? d3.getSeconds() : d3.getUTCSeconds();
    return String(h3).padStart(2, "0") + ":" + String(m3).padStart(2, "0") + ":" + String(s3).padStart(2, "0") + " " + achTimeZoneSuffix();
  }
  function achBuildPageLocked() {
    return "";
  }
  function achBuildPage0(d3) {
    const ps = d3.perStatBest || { bestTrain: {}, bestDay: {}, bestWeek: {}, bestMonth: {} };
    const STATS2 = ["str", "def", "spd", "dex"];
    const STAT_LABEL2 = { str: "Strength", def: "Defense", spd: "Speed", dex: "Dexterity" };
    const rows = [{ key: "best-train", short: "Single Train", long: "Highest Single Train", tip: "Highest gains achieved from a single click, per individual stat.", recs: ps.bestTrain, getDate: (r4) => achFmtDate(r4.date), getTime: (r4) => r4.ts ? achFmtTimeHMS(r4.ts) : "" }, { key: "best-day", short: "Best Day", long: "Best Training Day", tip: "Highest gains achieved in a single calendar day, per individual stat.", recs: ps.bestDay, getDate: (r4) => achFmtDate(r4.date) }, { key: "best-week", short: "Best Week", long: "Best Training Week", tip: "Highest gains achieved in a single calendar week, per individual stat.", recs: ps.bestWeek, getDate: (r4) => achFmtWeekShort(r4.weekOf) }, { key: "best-month", short: "Best Month", long: "Best Month", tip: "Highest gains achieved in a single calendar month, per individual stat.", recs: ps.bestMonth, getDate: (r4) => achFmtMonthLong(r4.rawMonth) }];
    const headerStats = STATS2.map((sk) => `<div class="ach-stat-header ach-stat-${sk} bbgl-ach-col-copy" data-stat="${sk}" data-tooltip="Click to copy ${STAT_LABEL2[sk]} column" style="cursor:pointer">${STAT_LABEL2[sk]}</div>`).join("");
    const header = `<div class="bbgl-ach-grid-header"><div class="ach-grid-label-area"><span class="bbgl-ach-section-title" data-ach-section="greatest-gains" data-clip-title="Greatest Gains" data-tooltip="Click any stat or row to copy its data, or click this title to copy the entire section to your clipboard.">Greatest Gains</span></div>${headerStats}</div>`;
    const rowsHTML = rows.map((r4) => {
      const labelArea = `<div class="ach-grid-label-area"><div class="ach-k"><span class="ach-title-short">${achEsc(r4.short)}</span><span class="ach-title-long">${achEsc(r4.long)}</span></div></div>`;
      const cells = STATS2.map((sk) => {
        const rec = r4.recs ? r4.recs[sk] : null;
        const valHTML = rec ? "+" + Formatter.dual(rec.value) : '<span class="ach-null">\u2014</span>';
        const dateHTML = rec ? `<div class="ach-date">${achEsc(r4.getDate(rec))}</div>` : "";
        const timeHTML = rec && r4.getTime ? `<div class="ach-time">${achEsc(r4.getTime(rec))}</div>` : "";
        return `<div class="bbgl-ach-stat-cell" data-ach-key="${achEsc(r4.key)}" data-stat="${sk}"><span class="ach-value">${valHTML}</span>${dateHTML}${timeHTML}</div>`;
      }).join("");
      const tipAttr = r4.tip ? ` data-tooltip="${achEsc(r4.tip)}"` : "";
      return `<div class="bbgl-ach-row bbgl-ach-row-multi" data-ach-key="${achEsc(r4.key)}"${tipAttr}>${labelArea}${cells}</div>`;
    }).join("");
    return `<div class="bbgl-ach-section bbgl-ach-section-page0">${header}${rowsHTML}</div>`;
  }
  function achBuildPage1(d3) {
    const STATS2 = ["str", "def", "spd", "dex"];
    const STAT_LABEL2 = { str: "Strength", def: "Defense", spd: "Speed", dex: "Dexterity" };
    const rows = [{ key: "training-streak", short: "Best Streak", long: "Best Training Streak", tip: "Total stats gained during your longest consecutive training streak.", len: d3.longestStreak, start: d3.longestStreakStart, end: d3.longestStreakEnd, gains: d3.longestStreakGains }, { key: "green-streak", short: "Best Green", long: "Best Green Streak", tip: "Total stats gained during your longest streak of achieving at least Green (1,000E+).", len: d3.longestGoalStreak, start: d3.longestGoalStreakStart, end: d3.longestGoalStreakEnd, gains: d3.longestGoalStreakGains }, { key: "gold-streak", short: "Best Gold", long: "Best Gold Streak", tip: "Total stats gained during your longest streak of achieving at least Gold (1,500E+).", len: d3.longestGoldStreak, start: d3.longestGoldStreakStart, end: d3.longestGoldStreakEnd, gains: d3.longestGoldStreakGains }, { key: "diamond-streak", short: "Best Diamond", long: "Best Diamond Streak", tip: "Total stats gained during your longest streak of achieving Diamond (2,000E+).", len: d3.longestDiamondStreak, start: d3.longestDiamondStreakStart, end: d3.longestDiamondStreakEnd, gains: d3.longestDiamondStreakGains }];
    const headerStats = STATS2.map((sk) => `<div class="ach-stat-header ach-stat-${sk}">${STAT_LABEL2[sk]}</div>`).join("") + `<div class="ach-stat-header ach-stat-tot">Total</div>`;
    const header = `<div class="bbgl-ach-grid-header"><div class="ach-grid-label-area"><span class="bbgl-ach-section-title" data-ach-section="sexiest-streaks" data-clip-title="Sexiest Streaks" data-tooltip="Click any stat or row to copy its data, or click this title to copy the entire section to your clipboard.">SEXIEST STREAKS</span></div>${headerStats}</div>`;
    const rowsHTML = rows.map((r4) => {
      const dayBit = `<span class="ach-streak-days">${r4.len ? r4.len + "d" : "\u2014"}</span>`;
      const presentStats = r4.gains ? STATS2.filter((sk) => (r4.gains[sk] || 0) > 0) : [];
      const total = presentStats.reduce((a3, sk) => a3 + (r4.gains[sk] || 0), 0);
      const dateText = r4.start && r4.end ? achEsc(achFmtStreakRange(r4.start, r4.end)) : "\u2014";
      const dateHTML = `<div class="ach-date ach-streak-date">${dayBit}<span class="ach-streak-sep">\u2022</span><span class="ach-streak-daterange">${dateText}</span></div>`;
      const totalText = total > 0 ? "+" + achFmtGain(total) : '<span class="ach-null">\u2014</span>';
      const inlineDays = r4.len ? `<span class="ach-streak-days ach-streak-days-inline"> \xB7 ${r4.len}d</span>` : "";
      const inlineDate = r4.start && r4.end ? `<span class="bbgl-ach-streak-date-inline">&nbsp;&nbsp;${dateText}</span>` : "";
      const labelArea = `<div class="ach-grid-label-area"><div class="ach-k"><span class="ach-title-short">${achEsc(r4.short)}</span><span class="ach-title-long">${achEsc(r4.long)}</span>${inlineDays}${inlineDate}</div></div>`;
      const cells = STATS2.map((sk) => {
        const v3 = r4.gains && r4.gains[sk] || 0;
        const valHTML = v3 > 0 ? "+" + achEsc(achFmtGain(v3)) : '<span class="ach-null">\u2014</span>';
        return `<div class="bbgl-ach-stat-cell" data-ach-key="${r4.key}" data-stat="${sk}"><span class="ach-value">${valHTML}</span></div>`;
      }).join("");
      const totalCell = `<div class="bbgl-ach-stat-cell bbgl-ach-stat-cell-total" data-ach-key="${r4.key}" data-stat="total"><span class="ach-value ach-stat-tot">${totalText}</span></div>`;
      const tipAttr = r4.tip ? ` data-tooltip="${achEsc(r4.tip)}"` : "";
      return `<div class="bbgl-ach-row bbgl-ach-row-multi" data-ach-key="${r4.key}"${tipAttr}>${labelArea}${cells}${totalCell}${dateHTML}</div>`;
    }).join("");
    const consVal = d3.trainingRestRatio || "\u2014";
    const consDaysShort = "";
    const consDaysLong = "(" + (d3.trainingDays || 0) + "/" + (d3.calDays || 0) + " Days)";
    const consRow = `<div class="bbgl-ach-row bbgl-ach-row-multi bbgl-ach-consistency-row" data-ach-key="consistency" data-tooltip="Your lifetime ratio of active training days versus total calendar days."><div class="bbgl-ach-consistency-text">Training Consistency: <span class="ach-cons-val">${achEsc(consVal)}</span> <span class="ach-cons-days">${achEsc(consDaysLong)}</span></div></div>`;
    return `<div class="bbgl-ach-section bbgl-ach-section-page0 bbgl-ach-section-page1">${header}${rowsHTML}${consRow}</div>`;
  }
  function achFmtTimeHM(ts) {
    const d3 = new Date(ts * 1e3);
    const h3 = TimeManager.useLocal() ? d3.getHours() : d3.getUTCHours();
    const m3 = TimeManager.useLocal() ? d3.getMinutes() : d3.getUTCMinutes();
    return String(h3).padStart(2, "0") + ":" + String(m3).padStart(2, "0");
  }
  function achBuildPage2(d3) {
    const STAT_ABBR = { str: "STR", def: "DEF", spd: "SPD", dex: "DEX" };
    const STAT_FULL = { str: "Strength", def: "Defense", spd: "Speed", dex: "Dexterity" };
    const STATS2 = ["str", "def", "spd", "dex"];
    const isExpanded = achIsExpandedMode();
    const countRow = (label, shortLabel, count, key, tip, tipIsHtml) => {
      const clipVal = String(count);
      const tipAttr = tipIsHtml ? `data-tooltip-html="${tip}"` : `data-tooltip="${achEsc(tip)}"`;
      return `<div class="bbgl-ach-row" ${tipAttr} data-ach-key="${key}" data-clip="${achEsc(label + ": " + clipVal)}"><div class="ach-row-main"><div class="ach-k-stack"><span class="ach-k"><span class="ach-title-long">${achEsc(label)}</span><span class="ach-title-short">${achEsc(shortLabel)}</span>:</span></div><div class="ach-v-wrap"><span class="ach-value">${achEsc(clipVal)}</span></div></div></div>`;
    };
    const bestRow = (longLabel, shortLabel, rec, key, tip) => {
      if (!rec || !rec.stats) {
        return `<div class="bbgl-ach-hh-best-row" data-tooltip="${achEsc(tip)}" data-ach-key="${key}"><div class="bbgl-ach-hh-label"><span class="ach-k"><span class="ach-title-long">${achEsc(longLabel)}</span><span class="ach-title-short">${achEsc(shortLabel)}</span></span><div class="bbgl-ach-hh-date-line"><span class="ach-null">No jumps recorded yet</span></div></div><div class="bbgl-ach-hh-cells"><div class="bbgl-ach-hh-cell bbgl-ach-hh-cell-total"><span class="bbgl-ach-hh-tag ach-stat-tot">Total</span><span class="bbgl-ach-hh-val"><span class="ach-null">\u2014</span></span></div></div></div>`;
      }
      const dateStr = achFmtDate(rec.date);
      const timeStr = achFmtTimeHM(rec.ts) + " \u2013 " + achFmtTimeHM(rec.tsEnd || rec.ts) + " " + achTimeZoneSuffix();
      const timeStrClip = achFmtTimeHMClip(rec.ts) + " \u2013 " + achFmtTimeHMClip(rec.tsEnd || rec.ts) + " TCT";
      const trained = STATS2.filter((sk) => (rec.stats[sk] || 0) > 0);
      const statCells = trained.map((sk) => `<div class="bbgl-ach-hh-cell bbgl-ach-hh-cell-stat bbgl-ach-stat-cell" data-ach-key="${key}" data-stat="${sk}" data-tooltip="Total ${achEsc(STAT_FULL[sk])} gained during this jump."><span class="bbgl-ach-hh-val">+${achEsc(achFmtGain(rec.stats[sk]))}</span><span class="bbgl-ach-hh-tag ach-stat-${sk}">${STAT_ABBR[sk]}</span></div>`).join("");
      const totalCell = `<div class="bbgl-ach-hh-cell bbgl-ach-hh-cell-total bbgl-ach-stat-cell" data-ach-key="${key}" data-stat="total" data-tooltip="Total overall stats gained during this jump."><span class="bbgl-ach-hh-tag ach-stat-tot">Total</span><span class="bbgl-ach-hh-val">+${achEsc(achFmtGain(rec.value))}</span></div>`;
      const clipParts = trained.map((sk) => STAT_ABBR[sk] + ": +" + achFmtGain(rec.stats[sk]));
      clipParts.push("Total: +" + achFmtGain(rec.value));
      return `<div class="bbgl-ach-hh-best-row" data-tooltip="${achEsc(tip)}" data-ach-key="${key}" data-clip="${achEsc(longLabel + " (" + dateStr + ", " + timeStrClip + "): " + clipParts.join(" | "))}" data-clip-date="${achEsc(dateStr + "  " + timeStrClip)}"><div class="bbgl-ach-hh-label"><span class="ach-k"><span class="ach-title-long">${achEsc(longLabel)}</span><span class="ach-title-short">${achEsc(shortLabel)}</span></span><div class="bbgl-ach-hh-date-line">${achEsc(dateStr)}<span class="bbgl-ach-hh-time"> &nbsp; ${achEsc(timeStr)}</span></div></div><div class="bbgl-ach-hh-cells">${statCells}${totalCell}</div></div>`;
    };
    const hjCount = countRow("Happy Jumps Performed", "Happy Jumps", d3.happyJumps || 0, "hj-count", "Total number of Happy Jumps performed.<br><i>HJ = 1000E+ spent within 15m of using Ecstasy</i>", true);
    const hjBest = bestRow("Best Happy Jump", "Best Jump", d3.bestHappyJump && d3.bestHappyJump.total, "best-hj", "The single Happy Jump that yielded the highest combined stat gain.");
    const rowsHTML = `<div class="bbgl-ach-hh-group" data-ach-key="happy-jumps-group">${hjCount}${hjBest}</div>`;
    let clipAll = `Happy Jumps Performed: ${d3.happyJumps || 0}
Best Happy Jump: ${d3.bestHappyJump && d3.bestHappyJump.total ? (() => {
      const rec = d3.bestHappyJump.total;
      const trained = STATS2.filter((sk) => (rec.stats[sk] || 0) > 0);
      const parts = trained.map((sk) => STAT_ABBR[sk] + ": +" + achFmtGain(rec.stats[sk]));
      parts.push("Total: +" + achFmtGain(rec.value));
      return parts.join(" | ");
    })() : "\u2014"}`;
    let helpersHTML = "";
    if (d3.happyItemTotals) {
      const hhOrder = { 2180: 1, 2210: 2, 2020: 3, 8983: 4 };
      const helpers = HAPPY_LOGS.map((id) => {
        const rec = d3.happyItemTotals[id] || { count: 0, happy: 0 };
        const meta = ITEM_LOG_META[id];
        return { id, label: meta.achLabel || meta.label, short: meta.short || meta.label, count: rec.count, happy: rec.happy };
      }).filter((h3) => h3.count > 0).sort((a3, b2) => (hhOrder[a3.id] || 99) - (hhOrder[b2.id] || 99));
      if (helpers.length > 0) {
        const helperRow = (h3) => {
          const tip = isExpanded ? `Amount of ${h3.label} \xB7 Happy Gained` : `Amount of ${h3.label}`;
          const clipVal = `${h3.label}: ${h3.count} (${Formatter.number(h3.happy)} Happy)`;
          let html = `<div class="bbgl-ach-row" data-tooltip="${achEsc(tip)}" data-ach-key="happy-helper-${h3.id}" data-clip="${achEsc(clipVal)}"><div class="ach-row-main"><div class="ach-k-stack"><span class="ach-k"><span class="ach-title-long">${achEsc(h3.label)}</span><span class="ach-title-short">${achEsc(h3.short)}</span>:</span></div><div class="ach-v-wrap"><span class="ach-value">${Formatter.number(h3.count)}</span><span class="ach-value ach-happy-col">+${achEsc(achFmtGain(h3.happy))} <span class="ach-happy-word">H</span></span></div></div></div>`;
          if (h3.id === 2210 && d3.odItemTotals && d3.odItemTotals[EX_OD_LOG] && d3.odItemTotals[EX_OD_LOG].count > 0) {
            const exRec = d3.odItemTotals[EX_OD_LOG];
            const countHtml = achEsc(Formatter.number(exRec.count));
            const lostNum = exRec.happyLost > 0 ? `-${achEsc(Formatter.number(exRec.happyLost))}` : '<span class="ach-null">\u2014</span>';
            const eLostNum = exRec.energyLost > 0 ? `-${achEsc(Formatter.number(exRec.energyLost))}` : '<span class="ach-null">\u2014</span>';
            const gainedHtml = `<div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px; line-height:1.2;">
                    <div>${lostNum} <span class="ach-happy-word ach-od-happy-word">H</span></div>
                    <div>${eLostNum} <span class="ach-enh-e-label" style="color:#c06060;">E</span></div>
                </div>`;
            const exOdLabel = achOdLabel(ITEM_LOG_META[EX_OD_LOG].label);
            const exTip = isExpanded ? `Amount of ${exOdLabel} \xB7 Happy / Energy Lost` : `Amount of ${exOdLabel}`;
            const exClip = `${ITEM_LOG_META[EX_OD_LOG].label}: ${exRec.count} (-${Formatter.number(exRec.happyLost)} H, -${Formatter.number(exRec.energyLost)} E)`;
            html += `<div class="bbgl-ach-row bbgl-ach-od-row bbgl-subgroup-row bbgl-subgroup-row-last" data-tooltip="${achEsc(exTip)}" data-ach-key="happy-od-${EX_OD_LOG}" data-clip="${achEsc(exClip)}"><div class="ach-row-main" style="align-items:flex-start;"><div class="ach-k-stack"><span class="ach-k"><span class="ach-title-long">ODs:</span><span class="ach-title-short">ODs:</span></span></div><div class="ach-v-wrap" style="align-items:flex-start;"><span class="ach-value" style="padding-top:1px;">${countHtml}</span><span class="ach-value ach-happy-col ach-enh-od">${gainedHtml}</span></div></div></div>`;
          }
          return html;
        };
        const colCount = 2;
        const rpc = Math.ceil(helpers.length / colCount);
        const cols = [];
        for (let i3 = 0; i3 < colCount; i3++) {
          const start = i3 * rpc;
          const chunk = helpers.slice(start, start + rpc);
          if (chunk.length) {
            cols.push(`<div class="bbgl-ach-col">${chunk.map(helperRow).join("")}</div>`);
          }
        }
        const clipHelpers = helpers.map((h3) => `${h3.label}: ${h3.count} (${Formatter.number(h3.happy)} Happy)`).join("\n");
        clipAll += "\n\n\u2014 Happy Helpers \u2014\n" + clipHelpers;
        helpersHTML = `<div class="bbgl-ach-cols" style="grid-template-columns:repeat(${colCount},minmax(0,1fr)); padding-top:1px; padding-bottom:0;">${cols.join("")}</div>`;
      }
    }
    return `<div class="bbgl-ach-section bbgl-ach-section-hh"><div class="bbgl-ach-title-row"><span class="bbgl-ach-section-title" data-ach-section="happy-hopping" data-clip-section="${achEsc(clipAll)}" data-clip-title="Happy Hopping" data-tooltip="Click any stat or row to copy its data, or click this title to copy the entire section to your clipboard.">HAPPY HOPPING</span></div>${rowsHTML}${helpersHTML}</div>`;
  }
  function computeEnhancersForPeriod(sl) {
    const energyItemTotals = {};
    ENERGY_LOGS.forEach((id) => {
      energyItemTotals[id] = { count: 0, energy: 0 };
    });
    const odItemTotals = {};
    OD_LOGS.forEach((id) => {
      odItemTotals[id] = { count: 0, energyLost: 0, happyLost: 0 };
    });
    const statEnhByStat = { str: { count: 0, gain: 0 }, def: { count: 0, gain: 0 }, spd: { count: 0, gain: 0 }, dex: { count: 0, gain: 0 } };
    const days = sl._dailyList && sl._dailyList.length > 0 ? sl._dailyList : sl.date ? [app.DataController.getDateMap()[sl.date]] : [];
    days.forEach((day) => {
      if (!day) return;
      if (day.items) {
        ENERGY_LOGS.forEach((id) => {
          const qty = day.items[id] || 0;
          if (qty > 0) energyItemTotals[id].count += qty;
        });
        OD_LOGS.forEach((id) => {
          const qty = day.items[id] || 0;
          if (qty > 0) odItemTotals[id].count += qty;
        });
      }
      (day.series || []).forEach((e3) => {
        if (e3.type === "item" && e3.energy && energyItemTotals[e3.logId]) energyItemTotals[e3.logId].energy += e3.energy;
        if (e3.type === "item" && e3.energyLost != null && odItemTotals[e3.logId]) odItemTotals[e3.logId].energyLost += e3.energyLost;
        if (e3.type === "item" && e3.happyLost != null && odItemTotals[e3.logId]) odItemTotals[e3.logId].happyLost += e3.happyLost;
        if (e3.type === "item" && e3.statKey && statEnhByStat[e3.statKey]) {
          statEnhByStat[e3.statKey].count++;
          statEnhByStat[e3.statKey].gain = Math.round((statEnhByStat[e3.statKey].gain + (e3.statGain || 0)) * 100) / 100;
        }
      });
    });
    return { energyItemTotals, odItemTotals, statEnhByStat };
  }
  function achBuildPageOverview(d3) {
    const NULL = '<span class="ach-null">\u2014</span>';
    const enh = d3.statEnhByStat || {};
    const enrg = d3.energyItemTotals || {};
    const od = d3.odItemTotals || {};
    const STAT_ABBR = { str: "Str", def: "Def", spd: "Spd", dex: "Dex" };
    const isExpanded = achIsExpandedMode();
    const STAT_ENH_MAP = { 2150: "str", 2130: "spd", 2140: "def", 2120: "dex" };
    const LEFT_COL = [2150, 2130, 2290, 2040, 4900];
    const RIGHT_COL = [2140, 2120, 2230, 2190, 8981];
    const OD_AFTER = { 2290: XANAX_OD_LOG, 2230: LSD_OD_LOG };
    const buildRow = (id) => {
      const meta = ITEM_LOG_META[id];
      const label = meta.achLabel || meta.label;
      const tipLabel = meta.achTipLabel || label;
      const sk = STAT_ENH_MAP[id];
      let countHtml, gainedHtml, clipVal, tip;
      if (sk) {
        const rec = enh[sk] || { count: 0, gain: 0 };
        countHtml = rec.count > 0 ? achEsc(Formatter.number(rec.count)) : NULL;
        const gainNum = rec.gain > 0 ? `+${achEsc(Formatter.achAbbr(rec.gain, ACH_FMT.enhancers))}` : NULL;
        gainedHtml = `${gainNum} <span class="ach-stat-${sk}">${STAT_ABBR[sk]}</span>`;
        clipVal = `${label}: ${rec.count} (+${Formatter.achAbbr(rec.gain, ACH_FMT.enhancers)} ${STAT_ABBR[sk]})`;
        tip = isExpanded ? `Amount of ${tipLabel} \xB7 ${achStatFull(sk)} Gained` : `Amount of ${tipLabel}`;
      } else {
        const rec = enrg[id] || { count: 0, energy: 0 };
        countHtml = rec.count > 0 ? achEsc(Formatter.number(rec.count)) : NULL;
        const gainNum = rec.energy > 0 ? `+${achEsc(Formatter.achAbbr(rec.energy, ACH_FMT.enhancers))}` : NULL;
        gainedHtml = `${gainNum} <span class="ach-enh-e-label">E</span>`;
        clipVal = `${label}: ${rec.count} (+${Formatter.achAbbr(rec.energy, ACH_FMT.enhancers)} Energy)`;
        tip = isExpanded ? `Amount of ${tipLabel} \xB7 Energy Gained` : `Amount of ${tipLabel}`;
      }
      const key = `enh-${id}`;
      return `<div class="bbgl-ach-row bbgl-ach-enh-row" data-tooltip="${achEsc(tip)}" data-ach-key="${key}" data-clip="${achEsc(clipVal)}"><div class="ach-row-main"><div class="ach-k-stack"><span class="ach-k"><span class="ach-title-long">${achEsc(label)}:</span><span class="ach-title-short">${achEsc(label)}:</span></span></div><div class="ach-v-wrap"><span class="ach-value">${countHtml}</span><span class="ach-value ach-enh-gained">${gainedHtml}</span></div></div></div>`;
    };
    const buildODSubRow = (odId) => {
      const meta = ITEM_LOG_META[odId];
      const rec = od[odId] || { count: 0, energyLost: 0 };
      const countHtml = rec.count > 0 ? achEsc(Formatter.number(rec.count)) : NULL;
      const lostNum = rec.energyLost > 0 ? `-${achEsc(Formatter.number(rec.energyLost))}` : NULL;
      const gainedHtml = `${lostNum} <span class="ach-enh-e-label">E</span>`;
      const odLabel = achOdLabel(meta.label);
      const tip = isExpanded ? `Amount of ${odLabel} \xB7 Energy Lost` : `Amount of ${odLabel}`;
      const clipVal = `${meta.label}: ${rec.count} (-${Formatter.number(rec.energyLost)} Energy Lost)`;
      const key = `enh-${odId}`;
      return `<div class="bbgl-ach-row bbgl-ach-enh-row bbgl-ach-od-row bbgl-subgroup-row bbgl-subgroup-row-last" data-tooltip="${achEsc(tip)}" data-ach-key="${key}" data-clip="${achEsc(clipVal)}"><div class="ach-row-main"><div class="ach-k-stack"><span class="ach-k"><span class="ach-title-long">ODs:</span><span class="ach-title-short">ODs:</span></span></div><div class="ach-v-wrap"><span class="ach-value">${countHtml}</span><span class="ach-value ach-enh-gained ach-enh-od">${gainedHtml}</span></div></div></div>`;
    };
    const buildColHTML = (col) => col.map((id) => {
      let html = buildRow(id);
      const odId = OD_AFTER[id];
      if (odId && od[odId] && od[odId].count > 0) html += buildODSubRow(odId);
      return html;
    }).join("");
    const leftHTML = buildColHTML(LEFT_COL);
    const rightHTML = buildColHTML(RIGHT_COL);
    const clipAll = [...LEFT_COL, ...RIGHT_COL].map((id) => {
      const meta = ITEM_LOG_META[id];
      const label = meta.achLabel || meta.label;
      const sk = STAT_ENH_MAP[id];
      if (sk) {
        const rec2 = enh[sk] || { count: 0, gain: 0 };
        return `${label}: ${rec2.count} (+${Formatter.achAbbr(rec2.gain, ACH_FMT.enhancers)} ${STAT_ABBR[sk]})`;
      }
      const rec = enrg[id] || { count: 0, energy: 0 };
      return `${label}: ${rec.count} (+${Formatter.achAbbr(rec.energy, ACH_FMT.enhancers)} Energy)`;
    }).join("\n");
    const cols = `<div class="bbgl-ach-col">${leftHTML}</div><div class="bbgl-ach-col">${rightHTML}</div>`;
    const isPeriod = !!viewState.achEnhPeriodMode;
    const switchHTML = `<div class="bbgl-enh-mode-switch" data-tooltip-html="<b>Changes the data scope displayed on this page.</b><br><i><b>All-Time</b> shows totals across your entire log history. <b>Selected</b> shows data for the selected period on the calendar.</i>" data-tooltip-side="left"><span class="bbgl-enh-sw-opt${isPeriod ? "" : " active"}" data-mode="alltime">All-Time</span><span class="bbgl-enh-sw-opt${isPeriod ? " active" : ""}" data-mode="selected">Selected</span></div>`;
    return `<div class="bbgl-ach-section bbgl-ach-section-energy"><div class="bbgl-ach-title-row"><span class="bbgl-ach-section-title" data-ach-section="endocrine-enhancers" data-clip-section="${achEsc(clipAll)}" data-clip-title="Endocrine Enhancers" data-tooltip="Click any row to copy its data, or click this title to copy the entire section to your clipboard.">ENDOCRINE ENHANCERS</span>${switchHTML}</div><div class="bbgl-ach-cols" style="grid-template-columns:repeat(2,minmax(0,1fr));">${cols}</div></div>`;
  }
  function buildAchievementsPage(pageIdx, d3) {
    const mk = (label, value, opts = {}) => {
      const base = { label, key: opts.key || "", sub: opts.sub || "", statClass: opts.statClass || "", tip: opts.tip || "", clipDate: opts.clipDate || "" };
      if ("dualHtml" in opts) return { ...base, dualHtml: opts.dualHtml, display: opts.display !== void 0 ? opts.display : "", rawVal: opts.rawVal !== void 0 ? opts.rawVal : opts.dualHtml && typeof value === "number" ? achLedgerClip(value) : "\u2014" };
      if (opts.display !== void 0 || opts.rawVal !== void 0 || value === null || value === void 0 || typeof value !== "number") {
        const display = opts.display !== void 0 ? opts.display : achFmtVal(value);
        const rawVal = opts.rawVal !== void 0 ? opts.rawVal : opts.display !== void 0 ? String(opts.display).replace(/<[^>]+>/g, "") : value !== null && value !== void 0 ? achFmtVal(value) : "\u2014";
        return { ...base, dualHtml: "", display, rawVal };
      }
      return { ...base, dualHtml: Formatter.achDual(value, ACH_FMT.gains), display: "", rawVal: opts.rawVal !== void 0 ? opts.rawVal : achLedgerClip(value) };
    };
    const mkRec = (label, rec, getDate, tip, suffix, key = "") => {
      const dt = rec ? getDate(rec) : "";
      const v3 = rec ? rec.value : null;
      const o3 = { key, statClass: rec && rec.stat ? "ach-stat-" + rec.stat : "", sub: rec && rec.stat ? rec.stat.toUpperCase() : "", tip, clipDate: dt };
      if (suffix) return rec ? mk(label, v3, { ...o3, dualHtml: Formatter.achDual(v3, ACH_FMT.gains) + " E", rawVal: achLedgerClip(v3) + " E" }) : mk(label, null, { ...o3, display: "\u2014", rawVal: "\u2014" });
      return mk(label, v3, o3);
    };
    const achUnit = (n2, sing, plur) => n2 ? n2 + '<span class="ach-unit"> ' + (n2 === 1 ? sing : plur) + "</span>" : "\u2014";
    if (pageIdx === 0) {
      return achBuildPage0(d3);
    } else if (pageIdx === 1) {
      return achBuildPage1(d3);
    } else if (pageIdx === 2) {
      const overviewD = viewState.achEnhPeriodMode ? computeEnhancersForPeriod(calendarState.selectedData || app.DataController.getSlice("DAY", Formatter.dateLogical())) : d3;
      return achBuildPageOverview(overviewD);
    } else if (pageIdx === 3) {
      return achBuildPage2(d3);
    } else if (pageIdx === 5) {
      return achBuildPageLocked();
    } else {
      const consistRows = [mk("Best Training Streak", d3.longestStreak, { key: "training-streak", dualHtml: achUnit(d3.longestStreak, "Day", "Days"), rawVal: d3.longestStreak ? d3.longestStreak + (d3.longestStreak === 1 ? " Day" : " Days") : "\u2014", clipDate: achFmtStreakRange(d3.longestStreakStart, d3.longestStreakEnd), tip: "Longest streak of active training days" }), mk("Best Green Streak", d3.longestGoalStreak, { key: "green-streak", dualHtml: achUnit(d3.longestGoalStreak, "Day", "Days"), rawVal: d3.longestGoalStreak ? d3.longestGoalStreak + (d3.longestGoalStreak === 1 ? " Day" : " Days") : "\u2014", clipDate: achFmtStreakRange(d3.longestGoalStreakStart, d3.longestGoalStreakEnd), tip: "Longest streak of achieving at least Green (1000E+)" }), mk("Best Gold Streak", d3.longestGoldStreak, { key: "gold-streak", dualHtml: achUnit(d3.longestGoldStreak, "Day", "Days"), rawVal: d3.longestGoldStreak ? d3.longestGoldStreak + (d3.longestGoldStreak === 1 ? " Day" : " Days") : "\u2014", clipDate: achFmtStreakRange(d3.longestGoldStreakStart, d3.longestGoldStreakEnd), tip: "Longest streak of achieving Gold (1500E+)" }), mk("Consistency Rate", null, { key: "consistency", display: d3.trainingRestRatio || "\u2014", rawVal: d3.trainingRestRatio || "\u2014", tip: "Lifetime ratio of rest days to training days" }), mk("Happy Jumps", d3.happyJumps, { key: "happy-jumps", display: String(d3.happyJumps || 0), rawVal: String(d3.happyJumps || 0), tip: "Total Happy Jumps performed" })];
      const rewardRows = [mk("Green Days", d3.greenDays, { key: "green-days", display: String(d3.greenDays || 0), rawVal: String(d3.greenDays || 0), statClass: "ach-fx-green", tip: "Total days where the minimum daily goal (Green: 1,000E+) was achieved." }), mk("Gold Days", d3.goldDays, { key: "gold-days", display: String(d3.goldDays || 0), rawVal: String(d3.goldDays || 0), statClass: "ach-fx-gold", tip: "Total days where the elite daily goal (Gold: 1,500E+) was achieved." }), mk("Diamond Days", d3.diamondDays, { key: "diamond-days", display: String(d3.diamondDays || 0), rawVal: String(d3.diamondDays || 0), statClass: "ach-fx-diamond", tip: "Total days where the ultimate daily goal (Diamond: 2,000E+) was achieved." }), mk("Stickers Unlocked", d3.stickersUnlocked, { key: "stickers", display: (d3.stickersUnlocked || 0) + "/" + CUSTOM_STICKERS.length, rawVal: (d3.stickersUnlocked || 0) + "/" + CUSTOM_STICKERS.length, statClass: "ach-fx-holo", tip: "Total unique milestone stickers earned through consistent training." }), mk("Green Weeks", d3.greenWeeks, { key: "green-weeks", display: String(d3.greenWeeks || 0), rawVal: String(d3.greenWeeks || 0), statClass: "ach-fx-green", tip: "Total weeks where the minimum weekly training goal was met." }), mk("Gold Weeks", d3.goldWeeks, {
        key: "gold-weeks",
        display: String(d3.goldWeeks || 0),
        rawVal: String(d3.goldWeeks || 0),
        statClass: "ach-fx-gold",
        tip: "Total weeks where the elite weekly training goal was met."
      }), mk("Diamond Weeks", d3.diamondWeeks, { key: "diamond-weeks", display: String(d3.diamondWeeks || 0), rawVal: String(d3.diamondWeeks || 0), statClass: "ach-fx-diamond", tip: "Total weeks where the ultimate weekly training goal was met." })];
      void consistRows;
      return achBuildSection("Rewards Reaped", rewardRows, "rewards-reaped", 2);
    }
  }
  var achFmtGain = (v3) => Formatter.achAbbr(v3, ACH_FMT.compact);
  function achStatAbbr(s3) {
    return s3 ? s3.charAt(0).toUpperCase() + s3.slice(1) : "";
  }
  function achStatFull(s3) {
    return { str: "Strength", def: "Defense", spd: "Speed", dex: "Dexterity" }[s3] || s3;
  }
  function achIsExpandedMode() {
    const p3 = document.getElementById("bbgl-panel");
    return !!(p3 && p3.classList.contains("bbgl-expanded"));
  }
  function achOdLabel(label) {
    return label.replace(/ OD$/, " Overdoses");
  }
  function achFmtGainsLine(g4) {
    const ORDER = ["str", "def", "spd", "dex"];
    return ORDER.filter((k3) => g4 && g4[k3] > 0).map((k3) => "+" + achFmtGain(g4[k3]) + " " + achStatAbbr(k3)).join(" | ");
  }
  function achFmtTs(ts) {
    const d3 = new Date(ts * 1e3);
    const datePart = Formatter.datePretty(Formatter.dateISO(d3.getUTCFullYear(), d3.getUTCMonth(), d3.getUTCDate()));
    return datePart + "  " + String(d3.getUTCHours()).padStart(2, "0") + ":" + String(d3.getUTCMinutes()).padStart(2, "0") + ":" + String(d3.getUTCSeconds()).padStart(2, "0");
  }
  function achGetDay(date) {
    const s3 = app.getActiveHistory();
    const all = [...s3.history || []];
    if (s3.today && s3.today.date) {
      const i3 = all.findIndex((d3) => d3.date === s3.today.date);
      if (i3 >= 0) all[i3] = s3.today;
      else all.push(s3.today);
    }
    return all.find((d3) => d3.date === date) || null;
  }
  function achGetTrainBA(rec) {
    const day = achGetDay(rec.date);
    if (!day) return null;
    const series = [...day.series || []].sort((a3, b2) => a3.ts - b2.ts);
    let before = day.startBreakdown && day.startBreakdown[rec.stat] || 0;
    for (const e3 of series) {
      if (e3.ts === rec.ts && e3.stat === rec.stat) return { before, after: before + rec.value };
      if (e3.stat === rec.stat) before += e3.gain || 0;
    }
    return null;
  }
  function achGetDayBA(rec) {
    const day = achGetDay(rec.date);
    if (!day) return null;
    return { before: day.startBreakdown && day.startBreakdown[rec.stat] || 0, after: day.endBreakdown && day.endBreakdown[rec.stat] || 0 };
  }
  function achGetMonthBA(rawMonth, stat) {
    const s3 = app.getActiveHistory();
    const all = [...s3.history || []];
    if (s3.today && s3.today.date) {
      const i3 = all.findIndex((d3) => d3.date === s3.today.date);
      if (i3 >= 0) all[i3] = s3.today;
      else all.push(s3.today);
    }
    const days = all.filter((d3) => d3.date.slice(0, 7) === rawMonth && (d3.gains && d3.gains[stat] || 0) > 0).sort((a3, b2) => a3.date.localeCompare(b2.date));
    if (!days.length) return null;
    return { before: days[0].startBreakdown && days[0].startBreakdown[stat] || 0, after: days[days.length - 1].endBreakdown && days[days.length - 1].endBreakdown[stat] || 0 };
  }
  function achGetWeekBA(weekOf, stat) {
    const s3 = app.getActiveHistory();
    const all = [...s3.history || []];
    if (s3.today && s3.today.date) {
      const i3 = all.findIndex((d3) => d3.date === s3.today.date);
      if (i3 >= 0) all[i3] = s3.today;
      else all.push(s3.today);
    }
    const startD = /* @__PURE__ */ new Date(weekOf + "T00:00:00Z");
    const endD = new Date(startD);
    endD.setUTCDate(endD.getUTCDate() + 6);
    const endStr = Formatter.dateISO(endD.getUTCFullYear(), endD.getUTCMonth(), endD.getUTCDate());
    const days = all.filter((d3) => d3.date >= weekOf && d3.date <= endStr && (d3.gains && d3.gains[stat] || 0) > 0).sort((a3, b2) => a3.date.localeCompare(b2.date));
    if (!days.length) return null;
    return { before: days[0].startBreakdown && days[0].startBreakdown[stat] || 0, after: days[days.length - 1].endBreakdown && days[days.length - 1].endBreakdown[stat] || 0 };
  }
  function achFmtBA(ba) {
    return ba ? Formatter.number(ba.before) + " \u2192 " + Formatter.number(ba.after) : null;
  }
  function achFmtWeekCopy(weekOf) {
    const we = /* @__PURE__ */ new Date(weekOf + "T00:00:00Z");
    we.setUTCDate(we.getUTCDate() + 6);
    const endStr = Formatter.dateISO(we.getUTCFullYear(), we.getUTCMonth(), we.getUTCDate());
    return Formatter.datePretty(weekOf) + " \u2013 " + Formatter.datePretty(endStr);
  }
  function achClipSection(H3, title, blocks) {
    const NL = "\n";
    let s3 = H3 + NL + NL + "\u2014 " + title + " \u2014" + NL;
    blocks.forEach((b2, i3) => {
      if (i3) s3 += blocks[i3 - 1].includes(NL) || b2.includes(NL) ? NL + NL : NL;
      s3 += b2;
    });
    return s3;
  }
  function achFmtStatBlock(key, rec, stat, indent) {
    if (!rec) return null;
    const STAT_FULL = { str: "Strength", def: "Defense", spd: "Speed", dex: "Dexterity" };
    let ba = null;
    if (key === "best-train") ba = achGetTrainBA({ value: rec.value, date: rec.date, ts: rec.ts, stat });
    else if (key === "best-day") ba = achGetDayBA({ date: rec.date, stat });
    else if (key === "best-week") ba = achGetWeekBA(rec.weekOf, stat);
    else if (key === "best-month") ba = achGetMonthBA(rec.rawMonth, stat);
    const baStr = ba ? achFmtBA(ba) : null;
    let dateStr = "";
    if (key === "best-train") dateStr = achFmtTs(rec.ts);
    else if (key === "best-day") dateStr = Formatter.datePretty(rec.date);
    else if (key === "best-week") dateStr = Formatter.datePretty(rec.weekOf);
    else if (key === "best-month") dateStr = achFmtMonthLong(rec.rawMonth);
    const line1 = indent + "+" + Formatter.number(rec.value) + " " + STAT_FULL[stat] + (baStr ? " | " + baStr : "");
    const line2 = indent + "  " + dateStr;
    return line1 + "\n" + line2;
  }
  function handleAchCopy(el) {
    if (el.closest && el.closest(".bbgl-ach-section-energy")) {
      const row = el.closest(".bbgl-ach-enh-row");
      const title = el.closest(".bbgl-ach-section-title");
      if (title) {
        const clip = title.getAttribute("data-clip-section");
        const clipTitle = title.getAttribute("data-clip-title") || "Endocrine Enhancers";
        if (clip) {
          const txt2 = "\u{1F451}BBGL Achievements\n\n\u2014 " + clipTitle + " \u2014\n" + clip;
          const cols = el.closest(".bbgl-ach-section-energy").querySelector(".bbgl-ach-cols");
          navigator.clipboard.writeText(txt2).then(() => app.flashCopied(cols || el.closest(".bbgl-ach-section-energy")));
        }
        return;
      }
      if (row) {
        const clip = row.getAttribute("data-clip");
        if (clip) {
          navigator.clipboard.writeText(clip).then(() => app.flashCopied(row));
        }
      }
      return;
    }
    const H3 = "\u{1F451}BBGL Achievements", cache = runtime._achCache;
    let txt = "", flashEl = null;
    const NL = "\n", I2 = "  ";
    const PS_MAP = { "best-train": "bestTrain", "best-day": "bestDay", "best-week": "bestWeek", "best-month": "bestMonth" };
    const TITLE_MAP = { "best-train": "Highest Gains in a Single Train", "best-day": "Highest Gains in a Single Day", "best-week": "Highest Gains in a Single Week", "best-month": "Highest Gains in a Single Month" };
    if (el.classList.contains("bbgl-ach-col-copy")) {
      const sk = el.getAttribute("data-stat");
      const r4 = cache;
      const PS_MAP_L = { "best-train": "bestTrain", "best-day": "bestDay", "best-week": "bestWeek", "best-month": "bestMonth" };
      const TITLE_MAP_L = { "best-train": "Best Train", "best-day": "Best Day", "best-week": "Best Week", "best-month": "Best Month" };
      if (sk && r4 && r4.perStatBest) {
        const lines = ["best-train", "best-day", "best-week", "best-month"].map((mkey) => {
          const rec = (r4.perStatBest[PS_MAP_L[mkey]] || {})[sk];
          return achFmtStatBlock(mkey, rec, sk, "  ");
        }).filter(Boolean);
        if (lines.length) {
          txt = "\u{1F451}BBGL Achievements\nGreatest Gains \u2014 " + achStatFull(sk) + ":\n" + lines.join(NL);
          const _sec = el.closest(".bbgl-ach-section");
          const _cells = _sec ? Array.from(_sec.querySelectorAll(`.bbgl-ach-stat-cell[data-stat="${sk}"]`)).filter((c3) => !c3.querySelector(".ach-null")) : [];
          flashEl = _cells.length ? _cells : el;
        }
      }
    } else if (el.classList.contains("bbgl-ach-stat-cell")) {
      const key = el.getAttribute("data-ach-key");
      const stat = el.getAttribute("data-stat");
      const recs = cache && cache.perStatBest && PS_MAP[key] ? cache.perStatBest[PS_MAP[key]] : null;
      const rec = recs && stat ? recs[stat] : null;
      const block = achFmtStatBlock(key, rec, stat, "");
      if (block && TITLE_MAP[key]) {
        txt = H3 + NL + TITLE_MAP[key] + ":" + NL + block;
        flashEl = el;
      } else if (cache && /^(training|green|gold|diamond)-streak$/.test(key)) {
        const SK = { "training-streak": ["Best Training Streak", cache.longestStreak, cache.longestStreakGains, cache.longestStreakStart, cache.longestStreakEnd], "green-streak": ["Best Green Streak", cache.longestGoalStreak, cache.longestGoalStreakGains, cache.longestGoalStreakStart, cache.longestGoalStreakEnd], "gold-streak": ["Best Gold Streak", cache.longestGoldStreak, cache.longestGoldStreakGains, cache.longestGoldStreakStart, cache.longestGoldStreakEnd], "diamond-streak": ["Best Diamond Streak", cache.longestDiamondStreak, cache.longestDiamondStreakGains, cache.longestDiamondStreakStart, cache.longestDiamondStreakEnd] };
        const SF = { str: "Strength", def: "Defense", spd: "Speed", dex: "Dexterity", total: "Total" };
        const ent = SK[key];
        if (ent && ent[2]) {
          const label = ent[0], g4 = ent[2], st = ent[3], en2 = ent[4];
          const v3 = stat === "total" ? ["str", "def", "spd", "dex"].reduce((a3, k3) => a3 + (g4[k3] || 0), 0) : g4[stat] || 0;
          txt = H3 + NL + label + " \u2014 " + SF[stat] + ":" + NL + "+" + Formatter.number(v3) + " " + SF[stat] + (st && en2 ? NL + I2 + Formatter.datePretty(st) + " \u2013 " + Formatter.datePretty(en2) : "");
          flashEl = el;
        }
      } else if (key === "best-hj") {
        const rec2 = cache && cache.bestHappyJump && cache.bestHappyJump.total;
        const label = "Best Happy Jump";
        const HHSF = { str: "Strength", def: "Defense", spd: "Speed", dex: "Dexterity", total: "Total" };
        if (rec2 && rec2.stats) {
          const v3 = stat === "total" ? rec2.value : rec2.stats[stat] || 0;
          txt = H3 + NL + label + " \u2014 " + HHSF[stat] + ": +" + achFmtGain(v3);
          flashEl = el;
        }
      }
    } else if (el.classList.contains("bbgl-ach-hh-group")) {
      const gKey = el.getAttribute("data-ach-key"), r4 = cache;
      const GABR = { str: "STR", def: "DEF", spd: "SPD", dex: "DEX" };
      const GSTS = [
        "str",
        "def",
        "spd",
        "dex"
      ];
      const fmtJ = (rec) => {
        if (!rec || !rec.stats) return "\u2014";
        const tr = GSTS.filter((sk) => (rec.stats[sk] || 0) > 0);
        const pts = tr.map((sk) => GABR[sk] + ": +" + achFmtGain(rec.stats[sk]));
        pts.push("Total: +" + achFmtGain(rec.value));
        return pts.join(" | ");
      };
      if (gKey === "happy-jumps-group") {
        txt = H3 + NL + "Happy Jumps Performed: " + (r4.happyJumps || 0) + NL + "Best Happy Jump: " + fmtJ(r4.bestHappyJump && r4.bestHappyJump.total);
        flashEl = Array.from(el.children);
      }
    } else if (el.classList.contains("bbgl-ach-section-title") || el.classList.contains("bbgl-ach-subsection-title")) {
      const sec = el.getAttribute("data-ach-section"), r4 = cache, title = el.getAttribute("data-clip-title") || "";
      const gain = (label, rec, getBA, getDate) => {
        if (!rec) return label + ": \u2014";
        const ba = getBA(rec), baStr = achFmtBA(ba);
        const line1 = label + ": +" + Formatter.number(rec.value) + " " + achStatFull(rec.stat) + (baStr ? " | " + baStr : "");
        return line1 + NL + I2 + getDate(rec);
      };
      const eRow = (label, rec, getDate) => !rec ? label + ": \u2014" : label + ": " + Formatter.number(rec.value) + " E" + NL + I2 + getDate(rec);
      const streak = (label, len, gains, start, end) => {
        if (!len) return label + ": \u2014";
        const gLine = gains ? achFmtGainsLine(gains) : "";
        const tot = gains ? (gains.str || 0) + (gains.def || 0) + (gains.spd || 0) + (gains.dex || 0) : 0;
        let s3 = label + ": " + len + (len === 1 ? " Day" : " Days") + NL;
        if (gLine) s3 += I2 + "Gains: " + gLine + NL;
        if (tot) s3 += I2 + "Total Gains: +" + Formatter.number(tot) + NL;
        if (start && end) s3 += I2 + Formatter.datePretty(start) + " \u2013 " + Formatter.datePretty(end);
        return s3;
      };
      let blocks;
      if (sec === "greatest-gains") {
        const buildMulti = (label, mkey) => {
          const mRecs = r4 && r4.perStatBest ? r4.perStatBest[PS_MAP[mkey]] : null;
          if (!mRecs) return label + ": \u2014";
          const mLines = ["str", "def", "spd", "dex"].map((sk) => achFmtStatBlock(mkey, mRecs[sk], sk, I2)).filter(Boolean);
          if (!mLines.length) return label + ": \u2014";
          return label + ":" + NL + mLines.join(NL);
        };
        blocks = [buildMulti("Best Train", "best-train"), buildMulti("Best Day", "best-day"), buildMulti("Best Week", "best-week"), buildMulti("Best Month", "best-month")];
      } else if (sec === "expended-energy") blocks = [eRow("Best Day", r4.mostEInOneDay, (rec) => Formatter.datePretty(rec.date)), eRow("Best Week", r4.mostEInOneWeek, (rec) => achFmtWeekCopy(rec.weekOf)), eRow("Best Month", r4.mostEInOneMonth, (rec) => rec.month)];
      else if (sec === "consistency-kept") blocks = [streak("Best Training Streak", r4.longestStreak, r4.longestStreakGains, r4.longestStreakStart, r4.longestStreakEnd), streak("Best Green Streak", r4.longestGoalStreak, r4.longestGoalStreakGains, r4.longestGoalStreakStart, r4.longestGoalStreakEnd), streak("Best Gold Streak", r4.longestGoldStreak, r4.longestGoldStreakGains, r4.longestGoldStreakStart, r4.longestGoldStreakEnd), "Consistency: " + (r4.trainingRestRatio || "\u2014") + " | " + (r4.trainingDays || 0) + "/" + (r4.calDays || 0) + " Days Trained", "Happy Jumps: " + (r4.happyJumps || 0)];
      else if (sec === "sexiest-streaks") blocks = [streak("Best Training Streak", r4.longestStreak, r4.longestStreakGains, r4.longestStreakStart, r4.longestStreakEnd), streak("Best Green Streak", r4.longestGoalStreak, r4.longestGoalStreakGains, r4.longestGoalStreakStart, r4.longestGoalStreakEnd), streak("Best Gold Streak", r4.longestGoldStreak, r4.longestGoldStreakGains, r4.longestGoldStreakStart, r4.longestGoldStreakEnd), streak("Best Diamond Streak", r4.longestDiamondStreak, r4.longestDiamondStreakGains, r4.longestDiamondStreakStart, r4.longestDiamondStreakEnd), "Consistency: " + (r4.trainingRestRatio || "\u2014") + " | " + (r4.trainingDays || 0) + "/" + (r4.calDays || 0) + " Calendar Days Trained"];
      else if (sec === "rewards-reaped") blocks = ["Green Days: " + (r4.greenDays || 0), "Green Weeks: " + (r4.greenWeeks || 0), "Gold Days: " + (r4.goldDays || 0), "Gold Weeks: " + (r4.goldWeeks || 0), "Diamond Days: " + (r4.diamondDays || 0), "Diamond Weeks: " + (r4.diamondWeeks || 0), "Stickers Unlocked: " + (r4.stickersUnlocked || 0) + "/" + CUSTOM_STICKERS.length];
      if (blocks) {
        txt = achClipSection(
          H3,
          title,
          blocks
        );
        const _sec = el.closest(".bbgl-ach-section");
        if (sec === "greatest-gains") {
          const _rows = _sec ? Array.from(_sec.querySelectorAll(".bbgl-ach-row-multi")) : [];
          flashEl = _rows.length ? _rows : el;
        } else if (sec === "sexiest-streaks") {
          const arr = _sec ? Array.from(_sec.querySelectorAll(".bbgl-ach-row-multi")) : [];
          flashEl = arr.length ? arr : el;
        } else if (sec === "rewards-reaped") {
          const _rows = _sec ? Array.from(_sec.querySelectorAll(".bbgl-ach-row")) : [];
          flashEl = _rows.length ? _rows : el;
        } else {
          flashEl = el;
        }
      } else if (el.hasAttribute("data-clip-section")) {
        txt = H3 + NL + NL + "\u2014 " + title + " \u2014" + NL + el.getAttribute("data-clip-section");
        if (sec === "happy-helpers") {
          const _sec = el.closest(".bbgl-ach-section");
          const _rows = _sec ? Array.from(_sec.querySelectorAll(".bbgl-ach-cols .bbgl-ach-row")) : [];
          flashEl = _rows.length ? _rows : el;
        } else if (sec === "happy-hopping") {
          const _sec = el.closest(".bbgl-ach-section");
          const _groups = _sec ? Array.from(_sec.querySelectorAll(".bbgl-ach-hh-group")) : [];
          const _helpers = _sec ? Array.from(_sec.querySelectorAll(".bbgl-ach-cols .bbgl-ach-row")) : [];
          const _rows = [..._groups, ..._helpers];
          flashEl = _rows.length ? _rows : el;
        } else {
          const _sec = el.closest(".bbgl-ach-section");
          flashEl = _sec ? Array.from(_sec.querySelectorAll(".bbgl-ach-row, .bbgl-ach-hh-group")) : el;
        }
      }
    } else {
      const key = el.getAttribute("data-ach-key"), r4 = cache;
      const PS_MAP2 = { "best-train": "bestTrain", "best-day": "bestDay", "best-week": "bestWeek", "best-month": "bestMonth" };
      const TITLE_MAP2 = { "best-train": "Highest Gains in a Single Train", "best-day": "Highest Gains in a Single Day", "best-week": "Highest Gains in a Single Week", "best-month": "Highest Gains in a Single Month" };
      if (key === "best-train" || key === "best-day" || key === "best-week" || key === "best-month") {
        const mRecs = r4 && r4.perStatBest ? r4.perStatBest[PS_MAP2[key]] : null;
        const mTitle = TITLE_MAP2[key];
        if (mRecs && mTitle) {
          const mLines = ["str", "def", "spd", "dex"].map((sk) => achFmtStatBlock(key, mRecs[sk], sk, I2)).filter(Boolean);
          txt = H3 + NL + mTitle + ":" + (mLines.length ? NL + mLines.join(NL) : NL + "\u2014");
        }
      } else if (key === "most-e-day" && r4.mostEInOneDay) {
        const rec = r4.mostEInOneDay;
        txt = H3 + NL + "Most Energy Used Training in a Single Day:" + NL + Formatter.number(rec.value) + " E" + NL + I2 + Formatter.datePretty(rec.date);
      } else if (key === "most-e-week" && r4.mostEInOneWeek) {
        const rec = r4.mostEInOneWeek;
        txt = H3 + NL + "Most Energy Used Training in a Single Week:" + NL + Formatter.number(rec.value) + " E" + NL + I2 + achFmtWeekCopy(rec.weekOf);
      } else if (key === "most-e-month" && r4.mostEInOneMonth) {
        const rec = r4.mostEInOneMonth;
        txt = H3 + NL + "Most Energy Used Training in a Single Month:" + NL + Formatter.number(rec.value) + " E" + NL + I2 + rec.month;
      } else if (key === "training-streak" || key === "green-streak" || key === "gold-streak" || key === "diamond-streak") {
        const SK = { "training-streak": ["Longest Training Streak", r4.longestStreak, r4.longestStreakGains, r4.longestStreakStart, r4.longestStreakEnd], "green-streak": ["Longest Green Streak (1,000 E+)", r4.longestGoalStreak, r4.longestGoalStreakGains, r4.longestGoalStreakStart, r4.longestGoalStreakEnd], "gold-streak": ["Longest Gold Streak (1,500 E+)", r4.longestGoldStreak, r4.longestGoldStreakGains, r4.longestGoldStreakStart, r4.longestGoldStreakEnd], "diamond-streak": ["Longest Diamond Streak (2,000 E+)", r4.longestDiamondStreak, r4.longestDiamondStreakGains, r4.longestDiamondStreakStart, r4.longestDiamondStreakEnd] }[key];
        const label = SK[0], len = SK[1] || 0, gains = SK[2], st = SK[3], en2 = SK[4];
        const gLine = gains ? achFmtGainsLine(gains) : "";
        const tot = gains ? (gains.str || 0) + (gains.def || 0) + (gains.spd || 0) + (gains.dex || 0) : 0;
        txt = H3 + NL + label + ": " + len + (len === 1 ? " Day" : " Days");
        if (gLine) txt += NL + "Gains: " + gLine;
        if (tot) txt += NL + "Total Gains: +" + Formatter.number(tot);
        if (st && en2) txt += NL + I2 + Formatter.datePretty(st) + " \u2013 " + Formatter.datePretty(en2);
      } else if (key === "consistency") {
        txt = H3 + NL + "Training Consistency: " + (r4.trainingRestRatio || "\u2014") + NL + (r4.trainingDays || 0) + "/" + (r4.calDays || 0) + " Days Trained";
      } else if (key === "happy-jumps") {
        txt = H3 + NL + "Happy Jumps: " + (r4.happyJumps || 0);
      } else if (key === "green-days") {
        txt = H3 + NL + "Green Days: " + (r4.greenDays || 0);
      } else if (key === "green-weeks") {
        txt = H3 + NL + "Green Weeks: " + (r4.greenWeeks || 0);
      } else if (key === "gold-days") {
        txt = H3 + NL + "Gold Days: " + (r4.goldDays || 0);
      } else if (key === "gold-weeks") {
        txt = H3 + NL + "Gold Weeks: " + (r4.goldWeeks || 0);
      } else if (key === "diamond-days") {
        txt = H3 + NL + "Diamond Days: " + (r4.diamondDays || 0);
      } else if (key === "diamond-weeks") {
        txt = H3 + NL + "Diamond Weeks: " + (r4.diamondWeeks || 0);
      } else if (key === "stickers") {
        txt = H3 + NL + "Stickers Unlocked: " + (r4.stickersUnlocked || 0) + "/" + CUSTOM_STICKERS.length;
      } else {
        const clip = el.getAttribute("data-clip") || "", clipDate = el.getAttribute("data-clip-date") || "";
        txt = H3 + NL + NL + (clipDate ? clipDate + ":" + NL : "") + clip;
      }
      flashEl = el;
    }
    if (!txt || !flashEl || Array.isArray(flashEl) && !flashEl.length) return;
    navigator.clipboard.writeText(txt).then(() => app.flashCopied(flashEl));
  }
  function toggleAchievementsView() {
    const mp = dom.panel, tb = dom.tallToggle;
    if (!viewState.isTall && !mp.classList.contains("bbgl-mode-page")) {
      viewState.isTall = true;
      if (mp) mp.classList.add("bbgl-tall");
      if (tb) tb.innerText = "\u2013";
    }
    app.switchView("achievements");
    saveViewState();
  }
  app.computeAchievements = computeAchievements;
  app._achLockedResizeObserver = _achLockedResizeObserver;
  app._achLockedStabilizeToken = _achLockedStabilizeToken;
  app.resizeAchLockedPage = resizeAchLockedPage;
  app.achRefreshPageDom = achRefreshPageDom;
  app.renderAchievements = renderAchievements;
  app.updateAchPageIndicator = updateAchPageIndicator;
  app.gotoAchievementsPage = gotoAchievementsPage;
  app.achLedgerClip = achLedgerClip;
  app.achFmtVal = achFmtVal;
  app.achFmtDate = achFmtDate;
  app.achFmtWeekRange = achFmtWeekRange;
  app.achFmtStreakRange = achFmtStreakRange;
  app.achEsc = achEsc;
  app.achFmtWeekShort = achFmtWeekShort;
  app.achFmtMonthLong = achFmtMonthLong;
  app.achFmtTimeTCT = achFmtTimeTCT;
  app._achTzLocalCache = _achTzLocalCache;
  app.achTimeZoneSuffix = achTimeZoneSuffix;
  app.achFmtTimeHMClip = achFmtTimeHMClip;
  app.achFmtTimeHMS = achFmtTimeHMS;
  app.achBuildPage0 = achBuildPage0;
  app.achBuildPage1 = achBuildPage1;
  app.achFmtTimeHM = achFmtTimeHM;
  app.achBuildPage2 = achBuildPage2;
  app.computeEnhancersForPeriod = computeEnhancersForPeriod;
  app.achBuildPageOverview = achBuildPageOverview;
  app.buildAchievementsPage = buildAchievementsPage;
  app.achFmtGain = achFmtGain;
  app.achStatAbbr = achStatAbbr;
  app.achStatFull = achStatFull;
  app.achIsExpandedMode = achIsExpandedMode;
  app.achOdLabel = achOdLabel;
  app.achFmtGainsLine = achFmtGainsLine;
  app.achFmtTs = achFmtTs;
  app.achGetDay = achGetDay;
  app.achGetTrainBA = achGetTrainBA;
  app.achGetDayBA = achGetDayBA;
  app.achGetMonthBA = achGetMonthBA;
  app.achGetWeekBA = achGetWeekBA;
  app.achFmtBA = achFmtBA;
  app.achFmtWeekCopy = achFmtWeekCopy;
  app.achClipSection = achClipSection;
  app.achFmtStatBlock = achFmtStatBlock;
  app.handleAchCopy = handleAchCopy;
  app.toggleAchievementsView = toggleAchievementsView;

  // src/ui/ledger.js
  function buildSessionText(sl, s3, keys) {
    const statEmoji = { str: "\u{1F4AA}", def: "\u{1F6E1}\uFE0F", spd: "\u{1F3AF}", dex: "\u{1F93A}" };
    const statNames = { str: "Strength", def: "Defense", spd: "Speed", dex: "Dexterity" };
    let ds = "";
    if (sl._dailyList && sl._dailyList.length > 1) ds = `${Formatter.dateFull(sl._dailyList[0].date)} - ${Formatter.dateFull(sl._dailyList[sl._dailyList.length - 1].date)}`;
    else ds = Formatter.dateFull(sl.date);
    const isSingle = keys.length === 1;
    const eCost = isSingle ? s3[keys[0]].cost : s3.total.cost;
    const eTxt = eCost > 0 ? `\u26A1${Formatter.number(eCost)} E` : "\u{1F6CC} I was a lazy POS.";
    const statLines = keys.filter((k3) => s3[k3].gain > 0 || s3[k3].cost > 0).map((k3) => `${statEmoji[k3]}${statNames[k3]}: +${Formatter.achAbbr(s3[k3].gain, ACH_FMT.gains)} (${Formatter.achAbbr(s3[k3].start, ACH_FMT.gains)} \u2192 ${Formatter.achAbbr(s3[k3].end, ACH_FMT.gains)})`);
    return ["\u{1F451}BBGymLog", `${ds} |${eTxt}`, ...statLines].join("\n");
  }
  function flashCopied(flashEl) {
    const _flashEls = Array.isArray(flashEl) ? flashEl : [flashEl];
    const _states = _flashEls.map((e3) => {
      const kids = Array.from(e3.children);
      const visStates = kids.map((c3) => c3.style.visibility);
      kids.forEach((c3) => {
        c3.style.visibility = "hidden";
      });
      const prevPos = e3.style.position;
      const cs = window.getComputedStyle(e3);
      if (cs.position === "static") e3.style.position = "relative";
      const overlay = document.createElement("span");
      overlay.className = "bbgl-ach-copied-flash";
      overlay.textContent = "Copied!";
      e3.appendChild(overlay);
      return { e: e3, kids, visStates, prevPos, overlay };
    });
    setTimeout(() => _states.forEach((s3) => {
      if (s3.overlay && s3.overlay.parentNode) s3.overlay.parentNode.removeChild(s3.overlay);
      s3.kids.forEach((c3, i3) => {
        c3.style.visibility = s3.visStates[i3];
      });
      s3.e.style.position = s3.prevPos;
    }), 1e3);
  }
  function renderStats(sl, rawLbl) {
    if (!sl) return;
    if (!sl.stats) sl = app.DataController._hydrate(sl, [], rawLbl, "DAY");
    runtime.currentStats = { sl, s: sl.stats };
    if (typeof app.notifyUi === "function") app.notifyUi();
  }
  app.buildSessionText = buildSessionText;
  app.flashCopied = flashCopied;
  app.renderStats = renderStats;

  // src/data/import-export.js
  async function exportData() {
    let s3;
    try {
      s3 = await app.DBManager.getStorage();
      if (!s3) {
        bbglError("Export Error: Local database is inaccessible or empty. Cannot export data.\n\nRecommendation: Please refresh the page and try again. If you are using Private Browsing or have strict storage limits enabled, you may need to disable them for Torn.com to allow the Gym Log to save and export data.");
        return;
      }
    } catch (e3) {
      bbglError("Export Error: " + (e3.message || "Failed to read local database.") + "\n\nRecommendation: Please refresh the page. Ensure your browser is not blocking local storage for Torn.com.");
      return;
    }
    const active = app.getActiveHistory();
    let activeCount = 0;
    [...active.history || [], active.today].filter(Boolean).forEach((d3) => {
      if (d3.series) activeCount += d3.series.length;
    });
    if (s3.series && s3.series.length < activeCount) {
      if (!confirm(`\u26A0\uFE0F EXPORT WARNING \u26A0\uFE0F

The exported file will be missing some recent logs visible on your screen due to a database error.

Recommendation: Cancel this export and refresh the browser to reset the connection, then try again.

Download incomplete file anyway?`)) {
        return;
      }
    }
    const now = /* @__PURE__ */ new Date();
    const month = CONSTANTS.MONTHS[TimeManager.month(now)];
    const day = TimeManager.date(now);
    const year = TimeManager.year(now);
    const filename = `BBGymLogData - ${month} ${day}_${year}.json`;
    app.DataController.buildProgressionCache();
    if (historyCache && historyCache.meta && historyCache.meta.stickers) {
      if (!s3.meta) s3.meta = {};
      s3.meta.stickers = historyCache.meta.stickers;
    }
    const use24h = !new Intl.DateTimeFormat(navigator.language, { hour: "numeric" }).format(/* @__PURE__ */ new Date(0)).match(/AM|PM/i);
    const ordinal = (n2) => {
      const sfx = ["th", "st", "nd", "rd"], v3 = n2 % 100;
      return n2 + (sfx[(v3 - 20) % 10] || sfx[v3] || sfx[0]);
    };
    const fmtReadable = (d3) => `${CONSTANTS.MONTHS[d3.getUTCMonth()]} ${ordinal(d3.getUTCDate())}, ${d3.getUTCFullYear()} - ${String(d3.getUTCHours()).padStart(2, "0")}:${String(d3.getUTCMinutes()).padStart(2, "0")} UTC`;
    const tzName = (() => {
      try {
        return new Intl.DateTimeFormat("en", { timeZoneName: "short" }).formatToParts(now).find((p3) => p3.type === "timeZoneName").value;
      } catch (e3) {
        return "";
      }
    })();
    const fmtTs = (ts) => {
      const d3 = new Date(ts * 1e3);
      const utcStr = `${String(d3.getUTCHours()).padStart(2, "0")}:${String(d3.getUTCMinutes()).padStart(2, "0")}:${String(d3.getUTCSeconds()).padStart(2, "0")} UTC`;
      const lH = d3.getHours(), lM = String(d3.getMinutes()).padStart(2, "0"), lS = String(d3.getSeconds()).padStart(2, "0");
      const localStr = use24h ? `${String(lH).padStart(2, "0")}:${lM}:${lS}` : `${lH % 12 || 12}:${lM}:${lS}${lH >= 12 ? "pm" : "am"}`;
      return `${utcStr} / ${localStr}${tzName ? ` ${tzName}` : ""}`;
    };
    const exportStorage = JSON.parse(JSON.stringify(s3));
    const itemTotals = {};
    Object.keys(ITEM_LOG_META).forEach((id) => {
      const m3 = ITEM_LOG_META[id];
      const g4 = ITEM_GROUP_LABELS[m3.group] || "Other Items";
      if (!itemTotals[g4]) itemTotals[g4] = {};
      itemTotals[g4][m3.label] = 0;
    });
    (exportStorage.series || []).forEach((e3) => {
      if (typeof e3.gain === "number") e3.gain = r2(e3.gain);
      if (typeof e3.after === "number") e3.after = r2(e3.after);
      if (e3.type === "item" && ITEM_LOG_META[e3.logId]) {
        const m3 = ITEM_LOG_META[e3.logId];
        itemTotals[ITEM_GROUP_LABELS[m3.group] || "Other Items"][m3.label]++;
      }
    });
    const getUtcDay = (ts) => {
      const d3 = new Date(ts * 1e3);
      return { label: `${CONSTANTS.MONTHS[d3.getUTCMonth()]} ${ordinal(d3.getUTCDate())}, ${d3.getUTCFullYear()}`, key: `${d3.getUTCFullYear()}-${d3.getUTCMonth()}-${d3.getUTCDate()}` };
    };
    const getLocalDay = (ts) => {
      const d3 = new Date(ts * 1e3);
      return { label: `${CONSTANTS.MONTHS[d3.getMonth()]} ${ordinal(d3.getDate())}, ${d3.getFullYear()}`, key: `${d3.getFullYear()}-${d3.getMonth()}-${d3.getDate()}` };
    };
    const log = [];
    let curDayObj = null, prevLocalKey = null;
    [...exportStorage.series || []].reverse().forEach((e3) => {
      const utc = getUtcDay(e3.ts), local = getLocalDay(e3.ts);
      if (!curDayObj || utc.key !== curDayObj._k) {
        curDayObj = { day: `${utc.label} - UTC`, _k: utc.key, _lk: /* @__PURE__ */ new Set(), entries: [] };
        log.push(curDayObj);
        prevLocalKey = null;
      }
      if (prevLocalKey !== null && local.key !== prevLocalKey) curDayObj.entries.push(`\u2500\u2500 ${local.label} (${tzName}) \u2500\u2500`);
      else if (prevLocalKey === null && utc.key !== local.key) curDayObj.entries.push(`\u2500\u2500 ${local.label} (${tzName}) \u2500\u2500`);
      if (e3.type === "item") {
        const label = ITEM_LOG_META[e3.logId] && ITEM_LOG_META[e3.logId].label || `Item ${e3.logId}`;
        const entry = { [label]: e3.ts };
        if (e3.energy) entry.e = e3.energy;
        if (e3.energyLost != null) entry.eLost = e3.energyLost;
        if (e3.happy) entry.happy = e3.happy;
        if (e3.statKey) {
          entry.stat = e3.statKey;
          entry.gain = e3.statGain;
        }
        curDayObj.entries.push(entry);
      } else {
        curDayObj.entries.push({
          at: fmtTs(e3.ts),
          ts: e3.ts,
          stat: e3.stat,
          gain: r2(e3.gain),
          cost: e3.cost,
          after: r2(e3.after),
          ...e3.rate !== void 0 ? { rate: e3.rate } : {}
        });
      }
      curDayObj._lk.add(local.key);
      prevLocalKey = local.key;
    });
    log.forEach((d3) => {
      if (d3._lk && d3._lk.size === 1 && [...d3._lk][0] === d3._k) d3.day = d3.day.replace(" - UTC", ` - UTC/${tzName}`);
      delete d3._k;
      delete d3._lk;
    });
    exportStorage.series = log;
    const achievements = app.computeAchievements(app.getActiveHistory());
    const cleanCfg = {};
    ALLOWED_CONFIG_KEYS.forEach((k3) => {
      if (userConfig[k3] !== void 0) {
        cleanCfg[k3] = userConfig[k3];
      }
    });
    const stickers = exportStorage?.meta?.stickers;
    if (exportStorage.meta) delete exportStorage.meta.stickers;
    if (exportStorage.meta) delete exportStorage.meta.syncFloor;
    let rankedWars;
    try {
      const warsRaw = localStorage.getItem(KEYS.WARS_DATA);
      if (warsRaw) {
        const wars = JSON.parse(warsRaw);
        const logCutoff = exportStorage.meta && exportStorage.meta.logStartDate ? exportStorage.meta.logStartDate : 0;
        const factionHistory = app.getFactionHistory();
        rankedWars = Object.entries(wars).filter(([, w3]) => w3.war && w3.war.end && w3.war.end >= logCutoff && app.wasInFactionDuringWar(factionHistory, w3.factionId, w3.war.end)).map(([id, w3]) => ({ id, start: w3.war && w3.war.start, end: w3.war && w3.war.end, winner: w3.war && w3.war.winner }));
      }
    } catch (e3) {
    }
    let content = JSON.stringify({ meta: { version: SCRIPT_VERSION, exportedAt: fmtReadable(now), itemTotals, ...rankedWars ? { rankedWars } : {} }, config: cleanCfg, achievements, storage: exportStorage, _s: stickers ? JSON.stringify(stickers) : void 0 }, null, 2);
    content = content.replace(/\{\n(\s+)"at": ("[^"]*"),\n\s+"ts": (\d+),\n\s+"stat": ("[^"]*"),\n\s+"gain": ([\d.]+),\n\s+"cost": (\d+),\n\s+"after": ([\d.]+)(?:,\n\s+"rate": ([\d.]+))?\n\s+\}/g, (m3, sp, la, ts, st, g4, co, a4, r4) => {
      let o3 = '{"at": ' + la + ', "ts": ' + ts + ",\n" + sp + '"stat": ' + st + ",\n" + sp + '"gain": ' + g4 + ', "cost": ' + co + ",\n" + sp + '"after": ' + a4;
      if (r4) o3 += ', "rate": ' + r4;
      return o3 + "}";
    });
    const itemLineLabels = Object.values(ITEM_LOG_META).map((m3) => m3.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    content = content.replace(new RegExp('\\{\\n\\s+"(' + itemLineLabels + ')":[^}]*\\}', "g"), (m3) => m3.replace(/\s*\n\s*/g, " "));
    content = content.replace(/\},(\ *\n\ +)\{"at":/g, '},\n$1{"at":');
    content = content.replace(/\},(\ *\n([ ]+))"\u2500/g, '},\n\n$2"\u2500');
    content = content.replace(/\u2500",(\ *\n([ ]+))\{"at":/g, '\u2500",\n\n$2{"at":');
    content = content.replace(/"meta": \{\n\s+"version": "([^"]+)",\n\s+"exportedAt": "([^"]+)"\n\s+\}/, '"meta": {"version": "$1", "exportedAt": "$2"}');
    content = content.replace(/"config": \{([\s\S]*?)\n\s+\}(?=,\n\s+"achievements")/, (m3, inner) => '"config": {' + inner.replace(/\n\s+/g, " ").trimStart() + "}");
    try {
      const f4 = new File([content], filename, { type: "text/plain" });
      if (navigator.canShare && navigator.canShare({ files: [f4] }) && window.innerWidth <= 800) {
        await navigator.share({ title: filename, files: [f4] });
        return;
      }
    } catch (e3) {
    }
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a3 = document.createElement("a");
    a3.style.display = "none";
    a3.href = url;
    a3.download = filename;
    document.body.appendChild(a3);
    a3.click();
    setTimeout(() => {
      document.body.removeChild(a3);
      URL.revokeObjectURL(url);
    }, 3e3);
  }
  function importData(f4, onDone, opts = {}) {
    if (!f4) {
      if (onDone) onDone(false);
      return;
    }
    const silent = !!opts.silent;
    const r4 = new FileReader();
    r4.onload = async (e3) => {
      let ok = false;
      try {
        const j4 = JSON.parse(e3.target.result);
        const val = app.validateImportSchema(j4);
        if (!val.ok) {
          if (!silent) bbglError(`Import Failed: ${val.msg}`);
          if (onDone) onDone(false);
          return;
        }
        if (j4.storage) {
          j4.storage = app.sanitizeStorageRecord(j4.storage);
          if (j4.storage.series && j4.storage.series.length && j4.storage.series[0] && j4.storage.series[0].day) {
            const labelToItem = {};
            Object.keys(ITEM_LOG_META).forEach((id) => {
              labelToItem[ITEM_LOG_META[id].label] = { logId: Number(id), energy: !!ITEM_LOG_META[id].energy };
            });
            j4.storage.series = j4.storage.series.flatMap((d3) => (d3.entries || []).filter((e4) => typeof e4 === "object" && e4 !== null)).reverse();
            j4.storage.series = j4.storage.series.map((e4) => {
              if (e4 && e4.ts === void 0 && e4.stat === void 0) {
                const k3 = Object.keys(e4).find((key) => key !== "e" && labelToItem[key]);
                if (k3) {
                  const m3 = labelToItem[k3];
                  const out = { type: "item", logId: m3.logId, ts: e4[k3] };
                  if (e4.e !== void 0) out.energy = e4.e;
                  return out;
                }
              }
              delete e4.at;
              delete e4.loggedAt;
              return e4;
            });
          }
          const importedMeta = j4.storage.meta || {};
          let stickers = importedMeta.stickers || j4._s;
          if (typeof stickers === "string") {
            try {
              stickers = JSON.parse(stickers);
            } catch (e4) {
            }
          }
          if (!stickers) stickers = {};
          j4.storage.meta.stickers = stickers;
          await app.DBManager.setStorage(j4.storage);
          const rebuilt = app.DataController._rebuildFromSeries(j4.storage.series || [], j4.storage.meta && j4.storage.meta.baselineBreakdown || ZERO_BREAKDOWN);
          setHistoryCache({ meta: { ...importedMeta, stickers }, history: rebuilt.history, today: rebuilt.today });
          if (j4.config && typeof j4.config === "object") {
            ALLOWED_CONFIG_KEYS.forEach((k3) => {
              if (j4.config[k3] !== void 0) userConfig[k3] = j4.config[k3];
            });
            if (!userConfig.privacyAgreed || isNaN(Date.parse(userConfig.privacyAgreed))) {
              userConfig.privacyAgreed = (/* @__PURE__ */ new Date()).toISOString();
            }
            saveConfig();
          }
          try {
            const importedVer = j4 && j4.meta && j4.meta.version ? String(j4.meta.version) : "";
            const curSeen = localStorage.getItem(KEYS.CHANGELOG_VER);
            if (!curSeen) {
              if (importedVer) localStorage.setItem(KEYS.CHANGELOG_VER, importedVer);
              else if (SCRIPT_VERSION) localStorage.setItem(KEYS.CHANGELOG_VER, SCRIPT_VERSION);
            }
            const seenNow = localStorage.getItem(KEYS.CHANGELOG_VER);
            if (SCRIPT_VERSION && seenNow && seenNow !== SCRIPT_VERSION) {
              localStorage.setItem(KEYS.CHANGELOG_NOTIF, "1");
              app.syncChangelogNotif(true);
            }
          } catch (e4) {
          }
          app.DataController.invalidate();
          calendarState.selectedData = null;
          calendarState.selectedLabel = null;
          viewState.activeViewLabel = null;
          ok = true;
          if (!silent) app.renderPanelContent();
          if (!silent) alert("Training Data Imported Successfully.");
        } else if (!silent) bbglError("Error: No valid training data found.");
      } catch (err) {
        if (!silent) bbglError("Error importing file: " + (err.message === "Database not initialized" ? "Database not initialized.\n\nRecommendation: Refresh the page and ensure your browser is not blocking local storage for Torn.com." : "Invalid JSON format."));
      }
      const inp = document.getElementById("import-file");
      if (inp) inp.value = "";
      const inp2 = document.getElementById("init-import-file");
      if (inp2) inp2.value = "";
      if (onDone) onDone(ok);
    };
    r4.readAsText(f4);
  }
  function importDataFromWelcome(f4) {
    importData(f4, async (success) => {
      if (!success) return;
      app.refreshInitLock();
      if (!userConfig.apiKey) {
        app.renderPanelContent();
        const wv = dom.welcomeView;
        if (wv && wv.classList.contains("active-view")) app.refreshInitMask(wv);
        return;
      }
      try {
        const res = await fetch(`https://api.torn.com/user/?selections=battlestats,log&log=5300&key=${userConfig.apiKey}`);
        const data = await res.json();
        if (data.error) {
          bbglError(`Saved API key is no longer valid: ${tornKeyErrorText(data)}

Please enter a new key to continue.`);
          userConfig.apiKey = "";
          saveConfig();
          app.refreshInitLock();
          app.renderPanelContent();
          const wv = dom.welcomeView;
          if (wv && wv.classList.contains("active-view")) {
            app.refreshInitMask(wv);
            const iak = wv.querySelector("#init-api-key");
            if (iak) iak.value = "";
          }
          return;
        }
        localStorage.setItem("bbgl_initialized", "1");
        app.refreshInitLock();
        calendarState.selectedData = null;
        calendarState.selectedLabel = Formatter.dateLogical();
        viewState.activeViewLabel = null;
        app.switchView("ledger");
        app.syncWithFeedback("FULL_SYNC");
      } catch (e3) {
        bbglError(MSG_KEY_NETWORK_ERROR);
        app.renderPanelContent();
        const wv = dom.welcomeView;
        if (wv && wv.classList.contains("active-view")) app.refreshInitMask(wv);
      }
    }, { silent: true });
  }
  async function clearData() {
    if (confirm("\u26A0\uFE0F CLEAR LOG HISTORY? \u26A0\uFE0F\n\nThis will permanently delete your training data.\n\nUse 'Export Log' before proceeding to preserve it.")) {
      await app.DBManager.clearStorage();
      const keep = [KEYS.CONFIG, KEYS.STATE, "bbgl_initialized"];
      for (let i3 = localStorage.length - 1; i3 >= 0; i3--) {
        const k3 = localStorage.key(i3);
        if (k3 && k3.startsWith("bbgl_") && k3 !== KEYS.STORAGE && !keep.includes(k3)) localStorage.removeItem(k3);
      }
      sessionStorage.removeItem(KEYS.SESSION);
      sessionStorage.removeItem(KEYS.SESSION_CACHE);
      app.DataController.invalidate();
      setHistoryCache(null);
      calendarState.selectedData = null;
      calendarState.selectedLabel = null;
      viewState.activeViewLabel = null;
      runtime.apiCallTotal = 0;
      runtime.stickerSlots = [];
      runtime.careerLevelExp = 0;
      runtime._lastLevelExp = void 0;
      runtime._targetLevelExp = void 0;
      runtime._isAnimatingLevel = false;
      app.renderPanelContent();
      alert("History cleared.");
    }
  }
  async function factoryReset() {
    await app.DBManager.clearStorage();
    for (let i3 = localStorage.length - 1; i3 >= 0; i3--) {
      const k3 = localStorage.key(i3);
      if (k3 && k3.startsWith("bbgl_")) localStorage.removeItem(k3);
    }
    sessionStorage.removeItem(KEYS.SESSION);
    sessionStorage.removeItem(KEYS.SESSION_CACHE);
    app.DataController.invalidate();
    setHistoryCache(null);
    calendarState.selectedData = null;
    calendarState.selectedLabel = null;
    viewState.activeViewLabel = null;
    runtime.apiCallTotal = 0;
    runtime.stickerSlots = [];
    runtime.currentStats = null;
    runtime._achPage = 0;
    const _fresh = { apiKey: "", dayStartMode: "utc", weekStartMode: "mon", animations: true, buttonLocation: "both", ratesEnabled: true, bestGym: true, bestGymSpecialist: true, bestGymUnpurchased: true, drugTracker: "xanax", privacyAgreed: "" };
    ALLOWED_CONFIG_KEYS.forEach((k3) => {
      userConfig[k3] = _fresh[k3] !== void 0 ? _fresh[k3] : userConfig[k3];
    });
    saveConfig();
    localStorage.setItem(KEYS.CHANGELOG_NOTIF, "1");
    runtime.wasVersionWiped = true;
  }
  app.exportData = exportData;
  app.importData = importData;
  app.importDataFromWelcome = importDataFromWelcome;
  app.clearData = clearData;
  app.factoryReset = factoryReset;

  // node_modules/preact/dist/preact.module.js
  var n;
  var l;
  var u;
  var t;
  var i;
  var r;
  var o;
  var e;
  var f;
  var c;
  var a;
  var s;
  var h;
  var p;
  var v;
  var y;
  var d = {};
  var w = [];
  var _ = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i;
  var g = Array.isArray;
  function m(n2, l3) {
    for (var u4 in l3) n2[u4] = l3[u4];
    return n2;
  }
  function b(n2) {
    n2 && n2.parentNode && n2.parentNode.removeChild(n2);
  }
  function k(l3, u4, t3) {
    var i3, r4, o3, e3 = {};
    for (o3 in u4) "key" == o3 ? i3 = u4[o3] : "ref" == o3 ? r4 = u4[o3] : e3[o3] = u4[o3];
    if (arguments.length > 2 && (e3.children = arguments.length > 3 ? n.call(arguments, 2) : t3), "function" == typeof l3 && null != l3.defaultProps) for (o3 in l3.defaultProps) void 0 === e3[o3] && (e3[o3] = l3.defaultProps[o3]);
    return x(l3, e3, i3, r4, null);
  }
  function x(n2, t3, i3, r4, o3) {
    var e3 = { type: n2, props: t3, key: i3, ref: r4, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: void 0, __v: null == o3 ? ++u : o3, __i: -1, __u: 0 };
    return null == o3 && null != l.vnode && l.vnode(e3), e3;
  }
  function S(n2) {
    return n2.children;
  }
  function C(n2, l3) {
    this.props = n2, this.context = l3;
  }
  function $(n2, l3) {
    if (null == l3) return n2.__ ? $(n2.__, n2.__i + 1) : null;
    for (var u4; l3 < n2.__k.length; l3++) if (null != (u4 = n2.__k[l3]) && null != u4.__e) return u4.__e;
    return "function" == typeof n2.type ? $(n2) : null;
  }
  function I(n2) {
    if (n2.__P && n2.__d) {
      var u4 = n2.__v, t3 = u4.__e, i3 = [], r4 = [], o3 = m({}, u4);
      o3.__v = u4.__v + 1, l.vnode && l.vnode(o3), q(n2.__P, o3, u4, n2.__n, n2.__P.namespaceURI, 32 & u4.__u ? [t3] : null, i3, null == t3 ? $(u4) : t3, !!(32 & u4.__u), r4), o3.__v = u4.__v, o3.__.__k[o3.__i] = o3, D(i3, o3, r4), u4.__e = u4.__ = null, o3.__e != t3 && P(o3);
    }
  }
  function P(n2) {
    if (null != (n2 = n2.__) && null != n2.__c) return n2.__e = n2.__c.base = null, n2.__k.some(function(l3) {
      if (null != l3 && null != l3.__e) return n2.__e = n2.__c.base = l3.__e;
    }), P(n2);
  }
  function A(n2) {
    (!n2.__d && (n2.__d = true) && i.push(n2) && !H.__r++ || r != l.debounceRendering) && ((r = l.debounceRendering) || o)(H);
  }
  function H() {
    try {
      for (var n2, l3 = 1; i.length; ) i.length > l3 && i.sort(e), n2 = i.shift(), l3 = i.length, I(n2);
    } finally {
      i.length = H.__r = 0;
    }
  }
  function L(n2, l3, u4, t3, i3, r4, o3, e3, f4, c3, a3) {
    var s3, h3, p3, v3, y3, _3, g4 = t3 && t3.__k || w, m3 = l3.length;
    for (f4 = T(u4, l3, g4, f4, m3), s3 = 0; s3 < m3; s3++) null != (p3 = u4.__k[s3]) && (h3 = -1 != p3.__i && g4[p3.__i] || d, p3.__i = s3, _3 = q(n2, p3, h3, i3, r4, o3, e3, f4, c3, a3), v3 = p3.__e, p3.ref && h3.ref != p3.ref && (h3.ref && J(h3.ref, null, p3), a3.push(p3.ref, p3.__c || v3, p3)), null == y3 && null != v3 && (y3 = v3), 4 & p3.__u ? (f4 = j(p3, f4, n2), h3.__e && (h3.__e = null)) : "function" == typeof p3.type && void 0 !== _3 ? f4 = _3 : v3 && (f4 = v3.nextSibling), p3.__u &= -7);
    return u4.__e = y3, f4;
  }
  function T(n2, l3, u4, t3, i3) {
    var r4, o3, e3, f4, c3, a3 = u4.length, s3 = a3, h3 = 0;
    for (n2.__k = new Array(i3), r4 = 0; r4 < i3; r4++) null != (o3 = l3[r4]) && "boolean" != typeof o3 && "function" != typeof o3 ? ("string" == typeof o3 || "number" == typeof o3 || "bigint" == typeof o3 || o3.constructor == String ? o3 = n2.__k[r4] = x(null, o3, null, null, null) : g(o3) ? o3 = n2.__k[r4] = x(S, { children: o3 }, null, null, null) : void 0 === o3.constructor && o3.__b > 0 ? o3 = n2.__k[r4] = x(o3.type, o3.props, o3.key, o3.ref ? o3.ref : null, o3.__v) : n2.__k[r4] = o3, f4 = r4 + h3, o3.__ = n2, o3.__b = n2.__b + 1, e3 = null, -1 != (c3 = o3.__i = O(o3, u4, f4, s3)) && (s3--, (e3 = u4[c3]) && (e3.__u |= 2)), null == e3 || null == e3.__v ? (-1 == c3 && (i3 > a3 ? h3-- : i3 < a3 && h3++), "function" != typeof o3.type && (o3.__u |= 4)) : c3 != f4 && (c3 == f4 - 1 ? h3-- : c3 == f4 + 1 ? h3++ : (c3 > f4 ? h3-- : h3++, o3.__u |= 4))) : n2.__k[r4] = null;
    if (s3) for (r4 = 0; r4 < a3; r4++) null != (e3 = u4[r4]) && 0 == (2 & e3.__u) && (e3.__e == t3 && (t3 = $(e3)), K(e3, e3));
    return t3;
  }
  function j(n2, l3, u4) {
    var t3, i3;
    if ("function" == typeof n2.type) {
      for (t3 = n2.__k, i3 = 0; t3 && i3 < t3.length; i3++) t3[i3] && (t3[i3].__ = n2, l3 = j(t3[i3], l3, u4));
      return l3;
    }
    n2.__e != l3 && (l3 && n2.type && !l3.parentNode && (l3 = $(n2)), l3 = u4.insertBefore(n2.__e, l3 || null));
    do {
      l3 = l3 && l3.nextSibling;
    } while (null != l3 && 8 == l3.nodeType);
    return l3;
  }
  function F(n2, l3) {
    return l3 = l3 || [], null == n2 || "boolean" == typeof n2 || (g(n2) ? n2.some(function(n3) {
      F(n3, l3);
    }) : l3.push(n2)), l3;
  }
  function O(n2, l3, u4, t3) {
    var i3, r4, o3, e3 = n2.key, f4 = n2.type, c3 = l3[u4], a3 = null != c3 && 0 == (2 & c3.__u);
    if (null === c3 && null == e3 || a3 && e3 == c3.key && f4 == c3.type) return u4;
    if (t3 > (a3 ? 1 : 0)) {
      for (i3 = u4 - 1, r4 = u4 + 1; i3 >= 0 || r4 < l3.length; ) if (null != (c3 = l3[o3 = i3 >= 0 ? i3-- : r4++]) && 0 == (2 & c3.__u) && e3 == c3.key && f4 == c3.type) return o3;
    }
    return -1;
  }
  function z(n2, l3, u4) {
    "-" == l3[0] ? n2.setProperty(l3, null == u4 ? "" : u4) : n2[l3] = null == u4 ? "" : "number" != typeof u4 || _.test(l3) ? u4 : u4 + "px";
  }
  function N(n2, l3, u4, t3, i3) {
    var r4, o3;
    n: if ("style" == l3) if ("string" == typeof u4) n2.style.cssText = u4;
    else {
      if ("string" == typeof t3 && (n2.style.cssText = t3 = ""), t3) for (l3 in t3) u4 && l3 in u4 || z(n2.style, l3, "");
      if (u4) for (l3 in u4) t3 && u4[l3] == t3[l3] || z(n2.style, l3, u4[l3]);
    }
    else if ("o" == l3[0] && "n" == l3[1]) r4 = l3 != (l3 = l3.replace(s, "$1")), o3 = l3.toLowerCase(), l3 = o3 in n2 || "onFocusOut" == l3 || "onFocusIn" == l3 ? o3.slice(2) : l3.slice(2), n2.l || (n2.l = {}), n2.l[l3 + r4] = u4, u4 ? t3 ? u4[a] = t3[a] : (u4[a] = h, n2.addEventListener(l3, r4 ? v : p, r4)) : n2.removeEventListener(l3, r4 ? v : p, r4);
    else {
      if ("http://www.w3.org/2000/svg" == i3) l3 = l3.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
      else if ("width" != l3 && "height" != l3 && "href" != l3 && "list" != l3 && "form" != l3 && "tabIndex" != l3 && "download" != l3 && "rowSpan" != l3 && "colSpan" != l3 && "role" != l3 && "popover" != l3 && l3 in n2) try {
        n2[l3] = null == u4 ? "" : u4;
        break n;
      } catch (n3) {
      }
      "function" == typeof u4 || (null == u4 || false === u4 && "-" != l3[4] ? n2.removeAttribute(l3) : n2.setAttribute(l3, "popover" == l3 && 1 == u4 ? "" : u4));
    }
  }
  function V(n2) {
    return function(u4) {
      if (this.l) {
        var t3 = this.l[u4.type + n2];
        if (null == u4[c]) u4[c] = h++;
        else if (u4[c] < t3[a]) return;
        return t3(l.event ? l.event(u4) : u4);
      }
    };
  }
  function q(n2, u4, t3, i3, r4, o3, e3, f4, c3, a3) {
    var s3, h3, p3, v3, y3, d3, _3, k3, x3, M3, I2, P4, A4, H3, T4, j4, F3 = u4.type;
    if (void 0 !== u4.constructor) return null;
    128 & t3.__u && (c3 = !!(32 & t3.__u), o3 = [f4 = u4.__e = t3.__e]), (s3 = l.__b) && s3(u4);
    n: if ("function" == typeof F3) {
      h3 = e3.length;
      try {
        if (x3 = u4.props, M3 = F3.prototype && F3.prototype.render, I2 = (s3 = F3.contextType) && i3[s3.__c], P4 = s3 ? I2 ? I2.props.value : s3.__ : i3, t3.__c ? k3 = (p3 = u4.__c = t3.__c).__ = p3.__E : (M3 ? u4.__c = p3 = new F3(x3, P4) : (u4.__c = p3 = new C(x3, P4), p3.constructor = F3, p3.render = Q), I2 && I2.sub(p3), p3.state || (p3.state = {}), p3.__n = i3, v3 = p3.__d = true, p3.__h = [], p3._sb = []), M3 && null == p3.__s && (p3.__s = p3.state), M3 && null != F3.getDerivedStateFromProps && (p3.__s == p3.state && (p3.__s = m({}, p3.__s)), m(p3.__s, F3.getDerivedStateFromProps(x3, p3.__s))), y3 = p3.props, d3 = p3.state, p3.__v = u4, v3) M3 && null == F3.getDerivedStateFromProps && null != p3.componentWillMount && p3.componentWillMount(), M3 && null != p3.componentDidMount && p3.__h.push(p3.componentDidMount);
        else {
          if (M3 && null == F3.getDerivedStateFromProps && x3 !== y3 && null != p3.componentWillReceiveProps && p3.componentWillReceiveProps(x3, P4), u4.__v == t3.__v || !p3.__e && null != p3.shouldComponentUpdate && false === p3.shouldComponentUpdate(x3, p3.__s, P4)) {
            u4.__v != t3.__v && (p3.props = x3, p3.state = p3.__s, p3.__d = false), u4.__e = t3.__e, u4.__k = t3.__k, u4.__k.some(function(n3) {
              n3 && (n3.__ = u4);
            }), w.push.apply(p3.__h, p3._sb), p3._sb = [], p3.__h.length && e3.push(p3), f4 = $(t3);
            break n;
          }
          null != p3.componentWillUpdate && p3.componentWillUpdate(x3, p3.__s, P4), M3 && null != p3.componentDidUpdate && p3.__h.push(function() {
            p3.componentDidUpdate(y3, d3, _3);
          });
        }
        if (p3.context = P4, p3.props = x3, p3.__P = n2, p3.__e = false, A4 = l.__r, H3 = 0, M3) p3.state = p3.__s, p3.__d = false, A4 && A4(u4), s3 = p3.render(p3.props, p3.state, p3.context), w.push.apply(p3.__h, p3._sb), p3._sb = [];
        else do {
          p3.__d = false, A4 && A4(u4), s3 = p3.render(p3.props, p3.state, p3.context), p3.state = p3.__s;
        } while (p3.__d && ++H3 < 25);
        p3.state = p3.__s, null != p3.getChildContext && (i3 = m(m({}, i3), p3.getChildContext())), M3 && !v3 && null != p3.getSnapshotBeforeUpdate && (_3 = p3.getSnapshotBeforeUpdate(y3, d3)), T4 = null != s3 && s3.type === S && null == s3.key ? E(s3.props.children) : s3, f4 = L(n2, g(T4) ? T4 : [T4], u4, t3, i3, r4, o3, e3, f4, c3, a3), p3.base = u4.__e, u4.__u &= -161, p3.__h.length && e3.push(p3), k3 && (p3.__E = p3.__ = null);
      } catch (n3) {
        if (e3.length = h3, u4.__v = null, c3 || null != o3) {
          if (n3.then) {
            for (u4.__u |= c3 ? 160 : 128; f4 && 8 == f4.nodeType && f4.nextSibling; ) f4 = f4.nextSibling;
            null != o3 && (o3[o3.indexOf(f4)] = null), u4.__e = f4;
          } else if (null != o3) for (j4 = o3.length; j4--; ) b(o3[j4]);
        } else u4.__e = t3.__e;
        null == u4.__k && (u4.__k = t3.__k || []), n3.then || B(u4), l.__e(n3, u4, t3);
      }
    } else null == o3 && u4.__v == t3.__v ? (u4.__k = t3.__k, u4.__e = t3.__e) : f4 = u4.__e = G(t3.__e, u4, t3, i3, r4, o3, e3, c3, a3);
    return (s3 = l.diffed) && s3(u4), 128 & u4.__u ? void 0 : f4;
  }
  function B(n2) {
    n2 && (n2.__c && (n2.__c.__e = true), n2.__k && n2.__k.some(B));
  }
  function D(n2, u4, t3) {
    for (var i3 = 0; i3 < t3.length; i3++) J(t3[i3], t3[++i3], t3[++i3]);
    l.__c && l.__c(u4, n2), n2.some(function(u5) {
      try {
        n2 = u5.__h, u5.__h = [], n2.some(function(n3) {
          n3.call(u5);
        });
      } catch (n3) {
        l.__e(n3, u5.__v);
      }
    });
  }
  function E(n2) {
    return "object" != typeof n2 || null == n2 || n2.__b > 0 ? n2 : g(n2) ? n2.map(E) : void 0 !== n2.constructor ? null : m({}, n2);
  }
  function G(u4, t3, i3, r4, o3, e3, f4, c3, a3) {
    var s3, h3, p3, v3, y3, w3, _3, m3 = i3.props || d, k3 = t3.props, x3 = t3.type;
    if ("svg" == x3 ? o3 = "http://www.w3.org/2000/svg" : "math" == x3 ? o3 = "http://www.w3.org/1998/Math/MathML" : o3 || (o3 = "http://www.w3.org/1999/xhtml"), null != e3) {
      for (s3 = 0; s3 < e3.length; s3++) if ((y3 = e3[s3]) && "setAttribute" in y3 == !!x3 && (x3 ? y3.localName == x3 : 3 == y3.nodeType)) {
        u4 = y3, e3[s3] = null;
        break;
      }
    }
    if (null == u4) {
      if (null == x3) return document.createTextNode(k3);
      u4 = document.createElementNS(o3, x3, k3.is && k3), c3 && (l.__m && l.__m(t3, e3), c3 = false), e3 = null;
    }
    if (null == x3) m3 === k3 || c3 && u4.data == k3 || (u4.data = k3);
    else {
      if (e3 = "textarea" == x3 && null != k3.defaultValue ? null : e3 && n.call(u4.childNodes), !c3 && null != e3) for (m3 = {}, s3 = 0; s3 < u4.attributes.length; s3++) m3[(y3 = u4.attributes[s3]).name] = y3.value;
      for (s3 in m3) y3 = m3[s3], "dangerouslySetInnerHTML" == s3 ? p3 = y3 : "children" == s3 || s3 in k3 || "value" == s3 && "defaultValue" in k3 || "checked" == s3 && "defaultChecked" in k3 || N(u4, s3, null, y3, o3);
      for (s3 in k3) y3 = k3[s3], "children" == s3 ? v3 = y3 : "dangerouslySetInnerHTML" == s3 ? h3 = y3 : "value" == s3 ? w3 = y3 : "checked" == s3 ? _3 = y3 : c3 && "function" != typeof y3 || m3[s3] === y3 || N(u4, s3, y3, m3[s3], o3);
      if (h3) c3 || p3 && (h3.__html == p3.__html || h3.__html == u4.innerHTML) || (u4.innerHTML = h3.__html), t3.__k = [];
      else if (p3 && (u4.innerHTML = ""), L("template" == t3.type ? u4.content : u4, g(v3) ? v3 : [v3], t3, i3, r4, "foreignObject" == x3 ? "http://www.w3.org/1999/xhtml" : o3, e3, f4, e3 ? e3[0] : i3.__k && $(i3, 0), c3, a3), null != e3) for (s3 = e3.length; s3--; ) b(e3[s3]);
      c3 && "textarea" != x3 || (s3 = "value", "progress" == x3 && null == w3 ? u4.removeAttribute("value") : null != w3 && (w3 !== u4[s3] || "progress" == x3 && !w3 || "option" == x3 && w3 != m3[s3]) && N(u4, s3, w3, m3[s3], o3), s3 = "checked", null != _3 && _3 != u4[s3] && N(u4, s3, _3, m3[s3], o3));
    }
    return u4;
  }
  function J(n2, u4, t3) {
    try {
      if ("function" == typeof n2) {
        var i3 = "function" == typeof n2.__u;
        i3 && n2.__u(), i3 && null == u4 || (n2.__u = n2(u4));
      } else n2.current = u4;
    } catch (n3) {
      l.__e(n3, t3);
    }
  }
  function K(n2, u4, t3) {
    var i3, r4;
    if (l.unmount && l.unmount(n2), (i3 = n2.ref) && (i3.current && i3.current != n2.__e || J(i3, null, u4)), null != (i3 = n2.__c)) {
      if (i3.componentWillUnmount) try {
        i3.componentWillUnmount();
      } catch (n3) {
        l.__e(n3, u4);
      }
      i3.base = i3.__P = i3.__n = null;
    }
    if (i3 = n2.__k) for (r4 = 0; r4 < i3.length; r4++) i3[r4] && K(i3[r4], u4, t3 || "function" != typeof n2.type);
    t3 || b(n2.__e), n2.__c = n2.__ = n2.__e = void 0;
  }
  function Q(n2, l3, u4) {
    return this.constructor(n2, u4);
  }
  function R(u4, t3, i3) {
    var r4, o3, e3, f4;
    t3 == document && (t3 = document.documentElement), l.__ && l.__(u4, t3), o3 = (r4 = "function" == typeof i3) ? null : i3 && i3.__k || t3.__k, e3 = [], f4 = [], q(t3, u4 = (!r4 && i3 || t3).__k = k(S, null, [u4]), o3 || d, d, t3.namespaceURI, !r4 && i3 ? [i3] : o3 ? null : t3.firstChild ? n.call(t3.childNodes) : null, e3, !r4 && i3 ? i3 : o3 ? o3.__e : t3.firstChild, r4, f4), D(e3, u4, f4), u4.props.children = null;
  }
  n = w.slice, l = { __e: function(n2, l3, u4, t3) {
    for (var i3, r4, o3; l3 = l3.__; ) if ((i3 = l3.__c) && !i3.__) try {
      if ((r4 = i3.constructor) && null != r4.getDerivedStateFromError && (i3.setState(r4.getDerivedStateFromError(n2)), o3 = i3.__d), null != i3.componentDidCatch && (i3.componentDidCatch(n2, t3 || {}), o3 = i3.__d), o3) return i3.__E = i3;
    } catch (l4) {
      n2 = l4;
    }
    throw n2;
  } }, u = 0, t = function(n2) {
    return null != n2 && void 0 === n2.constructor;
  }, C.prototype.setState = function(n2, l3) {
    var u4;
    u4 = null != this.__s && this.__s != this.state ? this.__s : this.__s = m({}, this.state), "function" == typeof n2 && (n2 = n2(m({}, u4), this.props)), n2 && m(u4, n2), null != n2 && this.__v && (l3 && this._sb.push(l3), A(this));
  }, C.prototype.forceUpdate = function(n2) {
    this.__v && (this.__e = true, n2 && this.__h.push(n2), A(this));
  }, C.prototype.render = S, i = [], o = "function" == typeof Promise ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout, e = function(n2, l3) {
    return n2.__v.__b - l3.__v.__b;
  }, H.__r = 0, f = Math.random().toString(8), c = "__d" + f, a = "__a" + f, s = /(PointerCapture)$|Capture$/i, h = 0, p = V(false), v = V(true), y = 0;

  // src/ui/templates.js
  var TOOLTIPS = { ANIM: "<b>Toggle UI transitions and cosmetic effects</b><br><i>Disable to prioritize performance on slower devices.</i>", RATES: "<b>Display growth rate and efficiency metrics</b><br><i>Turn off for a minimalist view focused strictly on totals.</i>", DRUG_TRACKER: "<b>Choose the primary training drug that appears on the ledger.</b><br><i>People on SSL path may want to track LSD instead of Xanax usage.</i>", LOC: "<b>Choose where the Gym Log icon appears in your Torn UI</b><br><i>Select Sidebar if the Footer Tab is hidden or if you are using Chat 2.0.</i>", DAY_START: "<b>Anchor logs to UTC or your system clock</b><br><i>Syncs your ongoing training sessions with your real-world schedule.</i>", WEEK_START: "<b>Change your preferred starting day for the week</b><br><i>Adjusts the calendar layout and weekly performance metrics.</i>", BEST_GYM: "<b>Always train at your best unlocked gym</b><br><i>Pressing train switches you to the highest-tier gym for that stat.</i>", BEST_GYM_SPEC: "<b>Allow switching to specialist gyms</b><br><i>When off, auto-switch only considers standard gyms.</i>", BEST_GYM_UNPURCHASED: "<b>Allow switching to unpurchased gyms</b><br><i>When off, auto-switch only considers gyms you have already bought.</i>", API: "Custom API key required.<br><br><i>This script strictly requests 'battlestats' and 'log' data. Click the Create API Key button below to securely generate a key for this script. For maximum safety, you can edit this newly created key in your Torn API Settings to restrict its log access specifically to the 'Gym' category.<br><br>Your key is stored locally on your device only and is sent exclusively to api.torn.com.</i>", PASTE_CLIPBOARD: "Paste from Clipboard", AGREE_GATE: "Check the box to confirm you've read the disclosure", LOCKED: "Locked", LEDGER_VIEW: "Ledger", GRAPH_VIEW: "Graph", STICKERBOOK: "Stickerbook", ACHIEVEMENTS: "Achievements", COPY_SESSION: "Copy Session Data", ALL_TIME_SUMMARY: "All-Time Summary", YEARLY_SUMMARY: "Yearly Summary", MONTHLY_SUMMARY: "Monthly Summary", DEMO_EXIT: "Exit Demo Mode", DEMO_EXIT_HTML: "Exit Demo Mode<i>Stats shown here are for previewing the functions of the script only \u2014 they do not reflect realistic Torn growth.</i>", REFRESH_COOLDOWN: (remaining) => `Please wait ${remaining}s before refreshing the log again`, BACKFILL_RESUME_COOLDOWN: (t3) => `Torn's daily row cap has been reached. Resume available in ${t3}.`, BACKFILL_COMPLETE_ORIGIN: "Your full training history was reconstructed back to the very beginning.", BACKFILL_COMPLETE_EXHAUSTED: "Scan reached the end of the logs Torn still retains. Any older history is no longer available from Torn's servers.", CELL_DATE: (ds) => `Date: ${ds}` };
  function buildEmptyLevelTrackSVG() {
    const W3 = 500, H3 = 100;
    const padX = 8, padY = 18;
    const slotW = W3 - 2 * padX;
    const slotH = H3 - 2 * padY;
    const defs = `<defs><linearGradient id="lvl-housing" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#202020"/><stop offset=".4" stop-color="#363636"/><stop offset=".5" stop-color="#404040"/><stop offset=".6" stop-color="#363636"/><stop offset="1" stop-color="#181818"/></linearGradient><linearGradient id="lvl-recess-shadow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".6"/><stop offset=".5" stop-color="#000" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient><linearGradient id="lvl-recess-shine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".35"/></linearGradient></defs>`;
    const f4 = (v3) => v3.toFixed(2);
    let out = `<rect width="${W3}" height="${H3}" fill="url(#lvl-housing)"/>`;
    const bx = padX, by = padY;
    out += `<rect x="${f4(bx)}" y="${by}" width="${f4(slotW)}" height="${slotH}" fill="#000" fill-opacity=".5"/>`;
    out += `<rect x="${f4(bx)}" y="${by}" width="${f4(slotW)}" height="${slotH}" fill="url(#lvl-recess-shadow)"/>`;
    out += `<rect x="${f4(bx)}" y="${by}" width="${f4(slotW)}" height="3" fill="#000" fill-opacity=".6"/>`;
    out += `<rect x="${f4(bx)}" y="${f4(by + slotH - 1.5)}" width="${f4(slotW)}" height="1.5" fill="#fff" fill-opacity=".15"/>`;
    return `<svg class="bbgl-level-svg" viewBox="0 0 ${W3} ${H3}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:1;display:block;">${defs}${out}</svg>`;
  }
  app.TOOLTIPS = TOOLTIPS;
  app.buildEmptyLevelTrackSVG = buildEmptyLevelTrackSVG;

  // node_modules/preact/jsx-runtime/dist/jsxRuntime.module.js
  var f2 = 0;
  function u2(e3, t3, n2, o3, i3, u4) {
    t3 || (t3 = {});
    var a3, c3, p3 = t3;
    if ("ref" in p3) for (c3 in p3 = {}, t3) "ref" == c3 ? a3 = t3[c3] : p3[c3] = t3[c3];
    var l3 = { type: e3, props: p3, key: n2, ref: a3, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: void 0, __v: --f2, __i: -1, __u: 0, __source: i3, __self: u4 };
    if ("function" == typeof e3 && (a3 = e3.defaultProps)) for (c3 in a3) void 0 === p3[c3] && (p3[c3] = a3[c3]);
    return l.vnode && l.vnode(l3), l3;
  }

  // src/torn/widgets/BestGym.tsx
  function BestGymPill() {
    return /* @__PURE__ */ u2(S, { children: [
      /* @__PURE__ */ u2("label", { class: "bbgl-switch bbgl-switch-purple", children: [
        /* @__PURE__ */ u2(
          "input",
          {
            type: "checkbox",
            id: "bbgl-bestgym-input",
            checked: !!userConfig.bestGym,
            onChange: (e3) => app.setBestGym(e3.target.checked)
          }
        ),
        /* @__PURE__ */ u2("span", { class: "slider" })
      ] }),
      /* @__PURE__ */ u2("svg", { class: "bbgl-bestgym-logo", xmlns: "http://www.w3.org/2000/svg", viewBox: "60 20 280 215", children: /* @__PURE__ */ u2("g", { transform: "scale(1, 1.15)", children: /* @__PURE__ */ u2("path", { fill: "currentColor", d: ICONS.LOGO_PATH }) }) }),
      /* @__PURE__ */ u2("span", { class: "bbgl-bestgym-label", "data-tooltip-html": TOOLTIPS.BEST_GYM, children: "BB Best Gym" })
    ] });
  }
  function mountBestGym(pill) {
    pill.className = "bbgl-bestgym";
    R(/* @__PURE__ */ u2(BestGymPill, {}), pill);
  }

  // src/torn/best-gym.js
  var BestGymController = { _suppressed: {}, _reactItem(btn) {
    try {
      const key = Object.keys(btn).find((k3) => k3.startsWith("__reactFiber$") || k3.startsWith("__reactInternalInstance$"));
      let f4 = btn[key], depth = 0;
      while (f4 && depth < 16) {
        const pp = f4.memoizedProps;
        if (pp && pp.item && pp.item.id != null && pp.item.status) return pp.item;
        f4 = f4.return;
        depth++;
      }
    } catch (e3) {
    }
    return null;
  }, scanGyms() {
    const root = document.getElementById("gymroot") || document;
    const result = { gyms: {}, active: null };
    root.querySelectorAll("button[class*='gymButton']").forEach((btn) => {
      const icon = btn.querySelector("[class*='gym-']");
      if (!icon) return;
      const match = /gym-(\d+)/.exec(icon.getAttribute("class") || "");
      if (!match) return;
      const id = parseInt(match[1], 10);
      if (!id || result.gyms[id]) return;
      const cls = " " + (btn.getAttribute("class") || "") + " ";
      const locked = /\s(?:locked|inProgress)/i.test(cls);
      const active = /\sactive/i.test(cls);
      const item = this._reactItem(btn);
      const status = item ? item.status : null;
      const owned = status === "active" || status === "available";
      result.gyms[id] = { id, btn, locked, active, status, owned };
      if (active) result.active = id;
    });
    return result;
  }, bestGymFor(stat, scan) {
    const tiers = GYM_TIERS[stat];
    if (!tiers) return null;
    const rankOf = (id) => {
      for (let i3 = 0; i3 < tiers.length; i3++) {
        const g4 = tiers[i3];
        if (Array.isArray(g4) ? g4.indexOf(id) !== -1 : g4 === id) return i3;
      }
      return -1;
    };
    const allowSpec = userConfig.bestGymSpecialist;
    const allowUnpurchased = userConfig.bestGymUnpurchased;
    let bestId = null, bestRank = scan.active != null ? rankOf(scan.active) : -1;
    Object.keys(scan.gyms).forEach((key) => {
      const gym = scan.gyms[key];
      if (gym.locked) return;
      if (!allowSpec && gym.id >= 25) return;
      if (!allowUnpurchased && !gym.owned) return;
      const rank = rankOf(gym.id);
      if (rank > bestRank) {
        bestRank = rank;
        bestId = gym.id;
      }
    });
    return bestId;
  }, swapToGym(gym) {
    try {
      gym.btn.click();
      return true;
    } catch (e3) {
      Log.warn("BestGym: gym switch failed", e3);
      return false;
    }
  }, _statFromLabel(label) {
    if (label === "Train strength") return "str";
    if (label === "Train defense") return "def";
    if (label === "Train speed") return "spd";
    if (label === "Train dexterity") return "dex";
    return null;
  }, handleTrainClick(e3) {
    if (!userConfig.bestGym) return false;
    const btn = e3.target && e3.target.closest ? e3.target.closest("button") : null;
    if (!btn) return false;
    const stat = this._statFromLabel(btn.getAttribute("aria-label") || "");
    if (!stat || this._suppressed[stat]) return false;
    const scan = this.scanGyms();
    const best = this.bestGymFor(stat, scan);
    if (!best || best === scan.active) return false;
    const gym = scan.gyms[best];
    if (!gym || !this.swapToGym(gym)) return false;
    e3.preventDefault();
    e3.stopImmediatePropagation();
    this._suppressed[stat] = true;
    return true;
  } };
  var CAL_IMG_BASE = cdnize("https://raw.githubusercontent.com/BigBlackHawk42069/asdfaskijdnfawef/refs/heads/main/ScrptImgs/Calendar/");
  function buildChartSVG(sl) {
    const stats = sl && sl.stats;
    const keys = ["str", "def", "spd", "dex"];
    const colors = ["#4a6070", "#7a3d36", "#8a6530", "#486644"];
    const xs = [4, 9.5, 15, 20.5];
    const maxH = 14, minH = 2;
    const vals = keys.map((k3) => stats && stats[k3] ? stats[k3].end : 0);
    const maxVal = Math.max(...vals);
    const hs = vals.map((v3) => maxVal > 0 ? Math.max(v3 / maxVal * maxH, minH) : maxH * 0.25);
    const lines = keys.map((k3, i3) => {
      return `<line x1="${xs[i3]}" y1="20" x2="${xs[i3]}" y2="${(20 - hs[i3]).toFixed(2)}" stroke="${colors[i3]}" stroke-width="5" stroke-linecap="round"/>`;
    });
    const bgLines = keys.map((k3, i3) => `<line x1="${xs[i3]}" y1="20" x2="${xs[i3]}" y2="${(20 - hs[i3]).toFixed(2)}" stroke="#000" stroke-width="7" stroke-linecap="round"/>`);
    return `<svg viewBox="0 0 24 24" fill="none">${bgLines.join("")}${lines.join("")}</svg>`;
  }
  var CAP_W = 500;
  var CAP_H = 100;
  var CAP_N = 5;
  var CAP_PAD_X = 8;
  var CAP_PAD_Y = 18;
  var CAP_GAP = 7;
  var CAP_SLOT_W = (CAP_W - 2 * CAP_PAD_X - (CAP_N - 1) * CAP_GAP) / CAP_N;
  var CAP_SLOT_H = CAP_H - 2 * CAP_PAD_Y;
  var CAP_TERM_W = 10;
  var CAP_BAR_DEFS = `<defs><pattern id="bbc-hatch" width="8" height="8" patternUnits="userSpaceOnUse"><line x1="0" y1="8" x2="8" y2="0" stroke="#fff" stroke-opacity=".1" stroke-width="1"/><line x1="-2" y1="2" x2="2" y2="-2" stroke="#fff" stroke-opacity=".1" stroke-width="1"/><line x1="6" y1="10" x2="10" y2="6" stroke="#fff" stroke-opacity=".1" stroke-width="1"/></pattern><linearGradient id="bbc-housing" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#202020"/><stop offset=".4" stop-color="#363636"/><stop offset=".5" stop-color="#404040"/><stop offset=".6" stop-color="#363636"/><stop offset="1" stop-color="#181818"/></linearGradient><linearGradient id="bbc-term" x1="0" y1="${CAP_PAD_Y}" x2="0" y2="${CAP_PAD_Y + CAP_SLOT_H}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#1e1e1e"/><stop offset=".25" stop-color="#484848"/><stop offset=".5" stop-color="#606060"/><stop offset=".75" stop-color="#484848"/><stop offset="1" stop-color="#161616"/></linearGradient><linearGradient id="bbc-recess-shadow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".6"/><stop offset=".5" stop-color="#000" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient><linearGradient id="bbc-recess-shine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".35"/></linearGradient><linearGradient id="bbc-gD" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#004422"/><stop offset=".33" stop-color="#336611"/><stop offset=".66" stop-color="#006644"/><stop offset="1" stop-color="#2d5c00"/></linearGradient><linearGradient id="bbc-gL" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#008844"/><stop offset=".33" stop-color="#66bb22"/><stop offset=".66" stop-color="#00cc88"/><stop offset="1" stop-color="#44aa00"/></linearGradient><linearGradient id="bbc-oD" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#886600"/><stop offset=".33" stop-color="#aa7700"/><stop offset=".66" stop-color="#ddbb66"/><stop offset="1" stop-color="#774400"/></linearGradient><linearGradient id="bbc-oL" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#ffcc00"/><stop offset=".33" stop-color="#ffdd44"/><stop offset=".66" stop-color="#fff8cc"/><stop offset="1" stop-color="#cc8800"/></linearGradient><linearGradient id="bbc-dD" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#882299"/><stop offset=".33" stop-color="#3366aa"/><stop offset=".66" stop-color="#339966"/><stop offset="1" stop-color="#993366"/></linearGradient><linearGradient id="bbc-dL" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#ee77ff"/><stop offset=".33" stop-color="#88bbff"/><stop offset=".66" stop-color="#77ffcc"/><stop offset="1" stop-color="#ff77cc"/></linearGradient><filter id="bbc-tube-glow" x="-20%" y="-30%" width="140%" height="160%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><linearGradient id="bbc-s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e1e1e"/><stop offset=".35" stop-color="#484848"/><stop offset=".5" stop-color="#686868"/><stop offset=".65" stop-color="#484848"/><stop offset="1" stop-color="#161616"/></linearGradient></defs>`;
  var CAP_WIN_LEFT_PCT = [];
  var CAP_WIN_DELAY_FWD_S = [];
  var CAP_WIN_DELAY_BWD_S = [];
  var CAP_WIN_WIDTH_PCT;
  var CAP_WIN_TOP_PCT;
  var CAP_WIN_HEIGHT_PCT;
  (() => {
    const PASS_S = 0.6;
    const FORWARD_SPREAD_S = 1.2;
    const BACKWARD_SPREAD_S = 1.2;
    const PHASE1_END_S = FORWARD_SPREAD_S + PASS_S;
    for (let i3 = 0; i3 < CAP_N; i3++) {
      const bx = CAP_PAD_X + i3 * (CAP_SLOT_W + CAP_GAP), gx = bx + CAP_TERM_W, gw = CAP_SLOT_W - 2 * CAP_TERM_W, winY = CAP_PAD_Y + 18, winH = CAP_SLOT_H - 18 * 2, fy = winY + 3, fh = winH - 3 * 2;
      CAP_WIN_LEFT_PCT.push(gx / CAP_W * 100);
      CAP_WIN_DELAY_FWD_S.push(gx / CAP_W * FORWARD_SPREAD_S);
      CAP_WIN_DELAY_BWD_S.push(PHASE1_END_S + (CAP_W - gx) / CAP_W * BACKWARD_SPREAD_S);
      CAP_WIN_WIDTH_PCT = gw / CAP_W * 100;
      CAP_WIN_TOP_PCT = fy / CAP_H * 100;
      CAP_WIN_HEIGHT_PCT = fh / CAP_H * 100;
    }
  })();
  var _capBarCache = /* @__PURE__ */ new Map();
  function buildCapsuleBar(slots, lit, animated) {
    const cacheKey = slots.join(",") + "|" + lit + "|" + animated;
    const cached = _capBarCache.get(cacheKey);
    if (cached) return cached;
    const W3 = CAP_W, H3 = CAP_H, n2 = CAP_N;
    const padX = CAP_PAD_X, padY = CAP_PAD_Y, gap = CAP_GAP;
    const slotW = CAP_SLOT_W, slotH = CAP_SLOT_H;
    const termW = CAP_TERM_W;
    const colorKey = { green: "g", gold: "o", diamond: "d", silver: "s" };
    const f4 = (v3) => v3.toFixed(2);
    let out = `<rect width="${W3}" height="${H3}" fill="url(#bbc-housing)"/>`;
    let overlay = "";
    for (let i3 = 0; i3 < n2; i3++) {
      const bx = padX + i3 * (slotW + gap);
      const by = padY;
      out += `<rect x="${f4(bx)}" y="${by}" width="${f4(slotW)}" height="${slotH}" fill="#000" fill-opacity=".5"/>`;
      out += `<rect x="${f4(bx)}" y="${by}" width="${f4(slotW)}" height="${slotH}" fill="url(#bbc-recess-shadow)"/>`;
      out += `<rect x="${f4(bx)}" y="${by}" width="${f4(slotW)}" height="3" fill="#000" fill-opacity=".6"/>`;
      out += `<rect x="${f4(bx)}" y="${f4(by + slotH - 1.5)}" width="${f4(slotW)}" height="1.5" fill="#fff" fill-opacity=".15"/>`;
      const color = slots[i3];
      if (!color) continue;
      out += `<rect x="${f4(bx)}" y="${by}" width="${termW}" height="${slotH}" fill="url(#bbc-term)"/>`;
      out += `<rect x="${f4(bx)}" y="${by}" width="${termW}" height="${slotH}" fill="url(#bbc-hatch)"/>`;
      out += `<rect x="${f4(bx + slotW - termW)}" y="${by}" width="${termW}" height="${slotH}" fill="url(#bbc-term)"/>`;
      out += `<rect x="${f4(bx + slotW - termW)}" y="${by}" width="${termW}" height="${slotH}" fill="url(#bbc-hatch)"/>`;
      out += `<rect x="${f4(bx)}" y="${by}" width="${f4(slotW)}" height="2.5" fill="#000" fill-opacity=".4"/>`;
      const gx = bx + termW, gw = slotW - 2 * termW;
      const gy = by, gh = slotH;
      const railH = 18;
      const winY = gy + railH, winH = gh - railH * 2;
      const fillInset = 3;
      const fy = winY + fillInset, fh = winH - fillInset * 2;
      const fid = colorKey[color];
      const fillId = fid === "s" ? "s" : fid + (lit ? "L" : "D");
      out += `<rect x="${f4(gx)}" y="${gy}" width="${f4(gw)}" height="${railH}" fill="url(#bbc-term)"/>`;
      out += `<rect x="${f4(gx)}" y="${gy}" width="${f4(gw)}" height="${railH}" fill="url(#bbc-hatch)"/>`;
      out += `<rect x="${f4(gx)}" y="${f4(gy + gh - railH)}" width="${f4(gw)}" height="${railH}" fill="url(#bbc-term)"/>`;
      out += `<rect x="${f4(gx)}" y="${f4(gy + gh - railH)}" width="${f4(gw)}" height="${railH}" fill="url(#bbc-hatch)"/>`;
      if (lit && color !== "silver") out += `<g filter="url(#bbc-tube-glow)">`;
      out += `<rect x="${f4(gx)}" y="${fy}" width="${f4(gw)}" height="${fh}" fill="url(#bbc-${fillId})"/>`;
      out += `<rect x="${f4(gx)}" y="${fy}" width="${f4(gw)}" height="${fh}" fill="url(#bbc-recess-shadow)" opacity="${lit ? 0.4 : 1}"/>`;
      out += `<rect x="${f4(gx)}" y="${fy}" width="${f4(gw)}" height="${fh}" fill="url(#bbc-recess-shine)"/>`;
      if (lit && color !== "silver") out += `</g>`;
      if (animated && color !== "silver") {
        overlay += `<div class="bbgl-cap-win" style="left:${CAP_WIN_LEFT_PCT[i3].toFixed(2)}%;width:${CAP_WIN_WIDTH_PCT.toFixed(2)}%;top:${CAP_WIN_TOP_PCT.toFixed(2)}%;height:${CAP_WIN_HEIGHT_PCT.toFixed(2)}%"><div class="bbgl-cap-sweep bbgl-cap-sweep-pass-fwd bbgl-cap-sweep-${color}" style="animation-delay:${CAP_WIN_DELAY_FWD_S[i3].toFixed(3)}s"></div><div class="bbgl-cap-sweep bbgl-cap-sweep-pass-bwd bbgl-cap-sweep-${color}" style="animation-delay:${CAP_WIN_DELAY_BWD_S[i3].toFixed(3)}s"></div></div>`;
      }
    }
    const svg = `<svg class="bbgl-cap-svg" viewBox="0 0 ${W3} ${H3}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${CAP_BAR_DEFS}${out}</svg>`;
    const html = overlay ? svg + `<div class="bbgl-cap-overlay">${overlay}</div>` : svg;
    _capBarCache.set(cacheKey, html);
    return html;
  }
  function updateSummaryCharts() {
    if (typeof app.notifyUi === "function") app.notifyUi();
  }
  function injectBestGymToggle() {
    const existing = document.getElementById("bbgl-bestgym");
    if (existing) {
      dom.bestGym = existing;
      return;
    }
    if (!document.getElementById("gymroot")) return;
    const host = document.getElementById("top-page-links-list");
    if (!host) return;
    const pill = document.createElement("div");
    pill.id = "bbgl-bestgym";
    host.appendChild(pill);
    mountBestGym(pill);
    dom.bestGym = pill;
  }
  function setBestGym(v3) {
    userConfig.bestGym = v3;
    saveConfig();
    const a3 = document.getElementById("set-bestgym-toggle");
    if (a3) a3.checked = v3;
    const b2 = document.getElementById("bbgl-bestgym-input");
    if (b2) b2.checked = v3;
    const sp = document.getElementById("set-bestgym-spec-toggle");
    if (sp) {
      const row = sp.closest(".bbgl-setting-row");
      if (row) row.classList.toggle("bbgl-row-disabled", !v3);
    }
    const up = document.getElementById("set-bestgym-unpurch-toggle");
    if (up) {
      const row = up.closest(".bbgl-setting-row");
      if (row) row.classList.toggle("bbgl-row-disabled", !v3);
    }
  }
  app.BestGymController = BestGymController;
  app.CAL_IMG_BASE = CAL_IMG_BASE;
  app.buildChartSVG = buildChartSVG;
  app.CAP_W = CAP_W;
  app.CAP_PAD_X = CAP_PAD_X;
  app.CAP_SLOT_W = CAP_SLOT_W;
  app.CAP_SLOT_H = CAP_SLOT_H;
  app.CAP_TERM_W = CAP_TERM_W;
  app.CAP_BAR_DEFS = CAP_BAR_DEFS;
  app.CAP_WIN_LEFT_PCT = CAP_WIN_LEFT_PCT;
  app.CAP_WIN_DELAY_FWD_S = CAP_WIN_DELAY_FWD_S;
  app.CAP_WIN_DELAY_BWD_S = CAP_WIN_DELAY_BWD_S;
  app.CAP_WIN_WIDTH_PCT = CAP_WIN_WIDTH_PCT;
  app._capBarCache = _capBarCache;
  app.buildCapsuleBar = buildCapsuleBar;
  app.updateSummaryCharts = updateSummaryCharts;
  app.injectBestGymToggle = injectBestGymToggle;
  app.setBestGym = setBestGym;

  // src/ui/calendar.js
  function renderPanelContent() {
    const s3 = app.getActiveHistory(), dm = app.DataController.getDateMap(), tk = Formatter.dateLogical();
    if ((s3.today.startTotal > 0 || s3.today.date) && !dm[tk]) dm[tk] = s3.today;
    Perf.start("renderPanel");
    if (typeof app.notifyUi === "function") app.notifyUi();
    if (runtime._pendingHistoryRestore) {
      const { sl, label } = runtime._pendingHistoryRestore;
      runtime._pendingHistoryRestore = null;
      openHistory(sl, label);
    }
    const tp = dom.topPanel;
    if (tp) {
      if (tp.classList.contains("viewing-graph")) app.GraphController.draw();
      else if (tp.classList.contains("viewing-stickers")) app.renderStickers();
      else if (tp.classList.contains("viewing-achievements")) app.renderAchievements();
    }
    if (!calendarState.selectedData) app.renderStats(app.DataController.getSlice("DAY", Formatter.dateLogical()), Formatter.dateLogical());
    else app.renderStats(calendarState.selectedData, calendarState.selectedLabel);
    Perf.end("renderPanel");
    updateLevelBar();
  }
  function updateLevelBar() {
    const totalExp = app.getLiveLevelExp();
    if (runtime._lastLevelExp === void 0) {
      runtime._lastLevelExp = totalExp;
      const bars2 = app.getLevelBars();
      bars2.forEach((b2) => app.renderLevelBar(b2, totalExp));
      return;
    }
    const bars = app.getLevelBars();
    if (!bars.length) return;
    if (totalExp !== runtime._lastLevelExp) {
      runtime._targetLevelExp = totalExp;
      if (!runtime._isAnimatingLevel) {
        runLevelAnimationQueue();
      }
    } else if (!runtime._isAnimatingLevel) {
      bars.forEach((b2) => {
        if (!b2.fill.style.width) app.renderLevelBar(b2, runtime._lastLevelExp);
      });
    }
    async function runLevelAnimationQueue() {
      runtime._isAnimatingLevel = true;
      const BASE_SPEED_MS = 1e3;
      let forcedNextTier = null;
      while (runtime._lastLevelExp < runtime._targetLevelExp) {
        const currentProg = forcedNextTier !== null ? { atrophy: forcedNextTier, level: 1, expInLevel: 0, expToNext: computeLevelExpCost(1, forcedNextTier) } : calculateLevelProgress(runtime._lastLevelExp);
        forcedNextTier = null;
        const targetProg = calculateLevelProgress(runtime._targetLevelExp);
        const currentRank = currentProg.atrophy * 100 + currentProg.level;
        const targetRank = targetProg.atrophy * 100 + targetProg.level;
        if (currentRank < targetRank && currentProg.level >= 100 && currentProg.atrophy < 2) {
          await runAtrophyAnimation(currentProg.atrophy, bars);
          forcedNextTier = currentProg.atrophy + 1;
        } else if (currentRank < targetRank) {
          const expNeededToFill = currentProg.expToNext - currentProg.expInLevel;
          const currentPct = parseFloat(bars[0].fill.style.width) || 0;
          const durationMs = Math.max(150, (100 - currentPct) / 100 * BASE_SPEED_MS);
          bars.forEach((b2) => {
            b2.fill.style.transitionDuration = durationMs + "ms";
            b2.fill.style.width = "96.8%";
            b2.fill.classList.add("level-full");
          });
          await new Promise((r4) => setTimeout(r4, durationMs + 50));
          bars.forEach((b2) => b2.container.classList.add("bbgl-level-up-flash"));
          await new Promise((r4) => setTimeout(r4, 200));
          const nextLevel = currentProg.level + 1;
          bars.forEach((b2) => {
            b2.num.innerHTML = '<span class="bbgl-lv-prefix">Lv </span>' + nextLevel;
          });
          await new Promise((r4) => setTimeout(r4, 650));
          bars.forEach((b2) => b2.container.classList.remove("bbgl-level-up-flash"));
          runtime._lastLevelExp += expNeededToFill;
          if (nextLevel >= 100 && currentProg.atrophy < 2) {
            await runAtrophyAnimation(currentProg.atrophy, bars);
            forcedNextTier = currentProg.atrophy + 1;
          } else {
            bars.forEach((b2) => {
              b2.fill.style.transition = "none";
              b2.fill.style.width = "0%";
              b2.fill.classList.remove("level-full");
              void b2.fill.offsetWidth;
              b2.fill.style.transition = "";
            });
          }
        } else {
          runtime._lastLevelExp = runtime._targetLevelExp;
          const currentPct = parseFloat(bars[0].fill.style.width) || 0;
          const { level, expInLevel, expToNext } = calculateLevelProgress(runtime._lastLevelExp);
          const targetPct = expToNext > 0 ? Math.min(100, expInLevel / expToNext * 100) : level >= 100 ? 100 : 0;
          const durationMs = Math.max(150, Math.abs(targetPct - currentPct) / 100 * BASE_SPEED_MS);
          bars.forEach((b2) => {
            b2.fill.style.transitionDuration = durationMs + "ms";
            app.renderLevelBar(b2, runtime._lastLevelExp);
          });
          await new Promise((r4) => setTimeout(r4, durationMs + 50));
        }
      }
      bars.forEach((b2) => {
        b2.fill.style.transitionDuration = "";
      });
      runtime._lastLevelExp = runtime._targetLevelExp;
      runtime._isAnimatingLevel = false;
    }
  }
  function snapLevelBar() {
    const totalExp = app.getLiveLevelExp();
    runtime._lastLevelExp = totalExp;
    runtime._targetLevelExp = totalExp;
    runtime._isAnimatingLevel = false;
    app.getLevelBars().forEach((b2) => {
      b2.fill.style.transition = "none";
      b2.container.classList.remove("bbgl-level-up-flash");
      app.renderLevelBar(b2, totalExp);
      void b2.fill.offsetWidth;
      b2.fill.style.transition = "";
    });
  }
  async function runAtrophyAnimation(fromAtrophy, bars) {
    const toAtrophy = fromAtrophy + 1;
    if (!userConfig.animations) {
      bars.forEach((b2) => {
        b2.container.dataset.atrophy = toAtrophy;
        b2.container.dataset.level = 1;
        b2.num.textContent = "Lv 1";
        b2.fill.style.transition = "none";
        b2.fill.style.width = "0%";
        b2.fill.classList.remove("level-full");
        void b2.fill.offsetWidth;
        b2.fill.style.transition = "";
      });
      if (dom.panel) {
        dom.panel.dataset.atrophy = toAtrophy;
        dom.panel.dataset.level = 1;
      }
      return;
    }
    const TUCK_MS = 350;
    const RISE_MS = 900;
    const FLASH_MS = 700;
    bars.forEach((b2) => b2.container.classList.add("bbgl-crown-tuck"));
    await new Promise((r4) => setTimeout(r4, TUCK_MS));
    bars.forEach((b2) => {
      b2.container.classList.remove("bbgl-crown-tuck");
      b2.container.dataset.atrophy = toAtrophy;
      b2.container.classList.add("bbgl-crown-rise");
    });
    if (dom.panel) dom.panel.dataset.atrophy = toAtrophy;
    await new Promise((r4) => setTimeout(r4, RISE_MS));
    bars.forEach((b2) => b2.container.classList.add("bbgl-atrophied-flash"));
    await new Promise((r4) => setTimeout(r4, FLASH_MS));
    bars.forEach((b2) => {
      b2.container.classList.remove("bbgl-crown-rise", "bbgl-atrophied-flash");
      b2.container.dataset.level = 1;
      b2.num.textContent = "Lv 1";
      b2.fill.style.transition = "none";
      b2.fill.style.width = "0%";
      b2.fill.classList.remove("level-full");
      void b2.fill.offsetWidth;
      b2.fill.style.transition = "";
    });
    if (dom.panel) dom.panel.dataset.level = 1;
  }
  function updateCellSelection(newLabel) {
    const c3 = dom.calContainer;
    if (!c3) return;
    c3.querySelectorAll(".bbgl-day-cell.is-viewing").forEach((el) => {
      el.classList.remove("is-viewing");
      if (!el.matches(":hover")) el.classList.remove("shimmer-active");
    });
    c3.querySelectorAll(".bbgl-weekly-track.is-viewing").forEach((el) => el.classList.remove("is-viewing"));
    if (!newLabel) {
      const today = document.getElementById("active-date-today");
      if (today) {
        today.classList.add("is-viewing");
        if (today._buildShine) today._buildShine();
      }
      return;
    }
    const dC = c3.querySelector(`.bbgl-day-cell[data-date="${newLabel}"]`);
    if (dC) {
      dC.classList.add("is-viewing");
      if (userConfig.animations && !dC.classList.contains("shimmer-active")) dC.classList.add("shimmer-active");
      if (dC._buildShine) dC._buildShine();
      return;
    }
    const track = c3.querySelector(`.bbgl-weekly-track[data-label="${newLabel}"]`);
    if (track) track.classList.add("is-viewing");
  }
  function openHistory(d3, l3) {
    if (runtime.isViewAnimating) {
      dom.ledgerView.classList.remove("bbgl-crt-out", "bbgl-crt-in");
      runtime.isViewAnimating = false;
    }
    viewState.activeViewLabel = l3;
    saveViewState();
    if (calendarState.selectedLabel === l3 && !dom.topPanel.classList.contains("viewing-graph")) return;
    runtime.isViewAnimating = true;
    calendarState.selectedData = d3;
    calendarState.selectedLabel = l3;
    const mBtn = document.getElementById("month-stats-btn");
    const yBtn = document.getElementById("year-stats-btn");
    const aBtn = document.getElementById("all-time-btn");
    if (mBtn) mBtn.classList.toggle("active", l3 === CONSTANTS.MONTHS[calendarState.month]);
    if (yBtn) yBtn.classList.toggle("active", l3 === String(calendarState.year));
    if (aBtn) aBtn.classList.toggle("active", l3 === "All-Time");
    app.closeItemViewer();
    updateCellSelection(l3);
    const tp = dom.topPanel;
    if (tp.classList.contains("viewing-stickers")) {
      app.switchView("ledger");
      setTimeout(() => {
        app.renderStats(d3, l3);
      }, 300);
      return;
    }
    if (tp.classList.contains("viewing-graph")) {
      app.GraphController.draw();
      const de = dom.dateLabel;
      if (de) de.innerText = Formatter.datePretty(l3) || l3;
      runtime.isViewAnimating = false;
    } else {
      if (viewState.achEnhPeriodMode && tp.classList.contains("viewing-achievements")) {
        app.achRefreshPageDom();
        runtime.isViewAnimating = false;
        return;
      }
      const el = dom.ledgerView;
      if (userConfig.animations) {
        el.classList.add("bbgl-crt-out");
        setTimeout(() => {
          el.classList.remove("bbgl-crt-out");
          app.renderStats(d3, l3);
          el.classList.add("bbgl-crt-in");
          setTimeout(() => {
            el.classList.remove("bbgl-crt-in");
            runtime.isViewAnimating = false;
          }, 300);
        }, 280);
      } else {
        app.renderStats(d3, l3);
        runtime.isViewAnimating = false;
      }
    }
  }
  function closeHistory(e3) {
    if (e3) e3.stopPropagation();
    if (!calendarState.selectedData) return;
    if (runtime.isViewAnimating) {
      dom.ledgerView.classList.remove("bbgl-crt-out", "bbgl-crt-in");
      runtime.isViewAnimating = false;
    }
    viewState.activeViewLabel = null;
    saveViewState();
    runtime.isViewAnimating = true;
    calendarState.selectedData = null;
    calendarState.selectedLabel = null;
    updateCellSelection(null);
    const tp = dom.topPanel, ts = Formatter.dateLogical();
    if (tp.classList.contains("viewing-graph")) {
      app.GraphController.draw();
      const de = dom.dateLabel;
      if (de) de.innerText = Formatter.datePretty(ts) || ts;
      runtime.isViewAnimating = false;
    } else if (tp.classList.contains("viewing-stickers")) runtime.isViewAnimating = false;
    else {
      const el = dom.ledgerView;
      if (userConfig.animations) {
        el.classList.add("bbgl-crt-out");
        setTimeout(() => {
          el.classList.remove("bbgl-crt-out");
          app.renderStats(app.getActiveHistory().today, ts);
          el.classList.add("bbgl-crt-in");
          setTimeout(() => {
            el.classList.remove("bbgl-crt-in");
            runtime.isViewAnimating = false;
          }, 300);
        }, 280);
      } else {
        app.renderStats(app.getActiveHistory().today, ts);
        runtime.isViewAnimating = false;
      }
    }
  }
  function changeMonth(d3) {
    const c3 = dom.calContainer;
    if (!c3) return;
    let m3 = calendarState.month + d3, y3 = calendarState.year;
    if (m3 > 11) {
      m3 = 0;
      y3++;
    }
    if (m3 < 0) {
      m3 = 11;
      y3--;
    }
    if (!userConfig.animations) {
      calendarState.month = m3;
      calendarState.year = y3;
      viewState.calYear = y3;
      viewState.calMonth = m3;
      saveViewState();
      renderPanelContent();
      return;
    }
    c3.parentElement.querySelectorAll(".bbgl-cal-ghost").forEach((g4) => g4.remove());
    const ghost = c3.cloneNode(true);
    ghost.className += " bbgl-cal-ghost";
    ghost.style.animation = d3 > 0 ? "bbgl-slide-out-l 0.3s ease forwards" : "bbgl-slide-out-r 0.3s ease forwards";
    c3.parentElement.appendChild(ghost);
    const removeGhost = () => {
      if (ghost.parentElement) ghost.remove();
    };
    ghost.addEventListener("animationend", removeGhost, { once: true });
    const ghostTimer = setTimeout(removeGhost, 400);
    ghost.addEventListener("animationend", () => clearTimeout(ghostTimer), { once: true });
    calendarState.month = m3;
    calendarState.year = y3;
    viewState.calYear = y3;
    viewState.calMonth = m3;
    saveViewState();
    c3.style.willChange = "transform";
    renderPanelContent();
    c3.style.animation = d3 > 0 ? "bbgl-slide-in-r 0.3s ease forwards" : "bbgl-slide-in-l 0.3s ease forwards";
    c3.addEventListener("animationend", () => {
      c3.style.animation = "";
      c3.style.willChange = "auto";
    }, { once: true });
  }
  function calcAllTimeStats() {
    const sl = app.DataController.getSlice("ALL", "All-Time");
    openHistory(sl, "All-Time");
  }
  function calcPeriodStats(t3) {
    const lbl = t3 === "month" ? CONSTANTS.MONTHS[calendarState.month] : String(calendarState.year), m3 = t3 === "month" ? "MONTH" : "YEAR", sl = app.DataController.getSlice(m3, lbl, calendarState.year);
    openHistory(sl, lbl);
  }
  app.renderPanelContent = renderPanelContent;
  app.updateLevelBar = updateLevelBar;
  app.snapLevelBar = snapLevelBar;
  app.runAtrophyAnimation = runAtrophyAnimation;
  app.updateCellSelection = updateCellSelection;
  app.openHistory = openHistory;
  app.closeHistory = closeHistory;
  app.changeMonth = changeMonth;
  app.calcAllTimeStats = calcAllTimeStats;
  app.calcPeriodStats = calcPeriodStats;

  // src/ui/preact/html.tsx
  function Raw({ html }) {
    return /* @__PURE__ */ u2("span", { style: { display: "contents" }, dangerouslySetInnerHTML: { __html: html } });
  }

  // src/torn/widgets/FooterTab.tsx
  function FooterTabIcon() {
    return /* @__PURE__ */ u2(Raw, { html: ICONS.LOGO });
  }
  function mountFooterTab(button) {
    const btn = button;
    btn.type = "button";
    btn.setAttribute("data-tooltip", "Big Black Gym Log");
    R(/* @__PURE__ */ u2(FooterTabIcon, {}), btn);
  }

  // src/torn/widgets/GymLevelBar.tsx
  function GymLevelBar() {
    return /* @__PURE__ */ u2(S, { children: [
      /* @__PURE__ */ u2("div", { id: "bbgl-gym-level-num" }),
      /* @__PURE__ */ u2("div", { id: "bbgl-gym-level-track", children: [
        /* @__PURE__ */ u2("div", { dangerouslySetInnerHTML: { __html: buildEmptyLevelTrackSVG() } }),
        /* @__PURE__ */ u2("div", { id: "bbgl-gym-level-fill" })
      ] })
    ] });
  }
  function mountGymLevelBar(container) {
    R(/* @__PURE__ */ u2(GymLevelBar, {}), container);
  }

  // src/torn/inject.js
  function injectWeeklyBar() {
  }
  function getLiveLevelExp() {
    let totalExp = app.DataController.getCareerLevelExp();
    if (!runtime.demoMode) {
      const h3 = app.getActiveHistory();
      if (h3 && h3.today) {
        const today = Formatter.dateLogical();
        const installDateKey = app.getInstallDateKey();
        const rewardStartTs = h3.meta && h3.meta.rewardStartDate || null;
        let todaySeries = h3.today.series || [];
        if (installDateKey && today === installDateKey && rewardStartTs) {
          todaySeries = todaySeries.filter((s3) => s3.ts >= rewardStartTs);
        }
        const todayE = todaySeries === h3.today.series && h3.today.eSpent ? h3.today.eSpent.total || 0 : todaySeries.filter((s3) => s3.type === "gym").reduce((sum, s3) => sum + (s3.cost || 0), 0);
        const hasTrainLog = todaySeries.some((s3) => s3.type === "gym");
        const { hjDaySet } = app.DataController.getHappyJumpData();
        const isHJ = todaySeries === h3.today.series ? hjDaySet.has(today) : findHappyJumps2(todaySeries).length > 0;
        totalExp += computeDailyLevelExp(todayE, hasTrainLog, isHJ);
      }
    }
    return totalExp;
  }
  function getLevelBars() {
    return [["bbgl-level-num", "bbgl-level-fill", "bbgl-level-container"], ["bbgl-gym-level-num", "bbgl-gym-level-fill", "bbgl-gym-level-container"]].map(([n2, f4, c3]) => ({ num: document.getElementById(n2), fill: document.getElementById(f4), container: document.getElementById(c3) })).filter((b2) => b2.num && b2.fill && b2.container);
  }
  function renderLevelBar(bar, expVal) {
    const { atrophy, level, expInLevel, expToNext } = calculateLevelProgress(expVal);
    const pct = expToNext > 0 ? Math.min(100, expInLevel / expToNext * 100) : level >= 100 ? 100 : 0;
    bar.num.innerHTML = '<span class="bbgl-lv-prefix">Lv </span>' + level;
    bar.fill.style.width = (pct / 100 * 96.8).toFixed(2) + "%";
    bar.fill.classList.toggle("level-full", pct >= 99.9);
    if (dom.panel) {
      dom.panel.dataset.atrophy = atrophy;
      dom.panel.dataset.level = level;
    }
    bar.container.dataset.atrophy = atrophy;
    bar.container.dataset.level = level;
    const lvLine = level >= 100 ? "Level 100  \u2022  Max Level" : `Level ${level}  \u2022  ${Math.round(pct)}%`;
    bar.container.setAttribute("data-tooltip", `${lvLine}<br><i class="bbgl-lvl-tip-title">${atrophyTitle(atrophy, level)}</i>`);
  }
  function handleDomMutation() {
    injectGymLevelBar();
    if (!dom.bestGym || !dom.bestGym.isConnected) app.injectBestGymToggle();
    const loc = userConfig.buttonLocation, showFooter = loc === "notes" || loc === "both", showSidebar = loc === "sidebar" || loc === "both";
    if (loc !== lastButtonLocation && !runtime._domObsArmed) rearmDomObs();
    if (loc === lastButtonLocation) {
      const gtCached = dom.gymTab && dom.gymTab.isConnected ? dom.gymTab : null;
      const sbDCached = dom.sbDesktop && dom.sbDesktop.isConnected ? dom.sbDesktop : null;
      const sbMCached = dom.sbMobile && dom.sbMobile.isConnected ? dom.sbMobile : null;
      const footerOk = !showFooter || !!gtCached;
      const sidebarOk = !showSidebar || !!sbDCached;
      if (footerOk && sidebarOk) {
        if (!gtCached) dom.gymTab = null;
        if (!sbDCached) dom.sbDesktop = null;
        if (!sbMCached) dom.sbMobile = null;
        if (showFooter && gtCached && dom.notesBtn && dom.notesBtn.isConnected && gtCached.nextSibling !== dom.notesBtn) {
          dom.notesBtn.parentNode.insertBefore(gtCached, dom.notesBtn);
        }
        if (showSidebar) {
          app.syncSidebarState();
          if (!dom.sbMobile || !dom.sbMobile.isConnected) {
            const mt2 = document.querySelector(SB_MOBILE.target);
            if (mt2) {
              injectSidebarButton(SB_MOBILE, true);
              dom.sbMobile = document.getElementById(SB_MOBILE.id);
            }
          }
          if (!dom.sbFlyout || !dom.sbFlyout.isConnected) {
            const ft2 = document.querySelector(SB_FLYOUT.target);
            if (ft2) {
              injectSidebarButton(SB_FLYOUT, true);
              dom.sbFlyout = document.getElementById(SB_FLYOUT.id);
            }
          }
        }
        settleDomObs();
        return;
      }
    }
    Perf.start("handleDomMutation");
    const _prevNotesBtn = dom.notesBtn, _prevPeopBtn = dom.peopleBtn, _prevSettBtn = dom.settingsBtn, _prevChatRoot = dom.chatRoot;
    if (!dom.notesBtn || !dom.notesBtn.isConnected) dom.notesBtn = document.getElementById("notes_panel_button");
    if (!dom.peopleBtn || !dom.peopleBtn.isConnected) dom.peopleBtn = document.getElementById("people_panel_button");
    if (!dom.settingsBtn || !dom.settingsBtn.isConnected) dom.settingsBtn = document.getElementById("notes_settings_button");
    if (!dom.chatRoot || !dom.chatRoot.isConnected) dom.chatRoot = _bbglGetChatRoot();
    if (dom.notesBtn !== _prevNotesBtn || dom.peopleBtn !== _prevPeopBtn || dom.settingsBtn !== _prevSettBtn || dom.chatRoot !== _prevChatRoot) attachLayoutObservers();
    if (!dom.gymTab || !dom.gymTab.isConnected) dom.gymTab = document.getElementById("bbgl-gym-tab");
    const mb = dom.gymTab;
    if (!dom.sbDesktop || !dom.sbDesktop.isConnected) dom.sbDesktop = document.getElementById(SB_DESKTOP.id);
    if (!dom.sbMobile || !dom.sbMobile.isConnected) dom.sbMobile = document.getElementById(SB_MOBILE.id);
    if (!dom.sbFlyout || !dom.sbFlyout.isConnected) dom.sbFlyout = document.getElementById(SB_FLYOUT.id);
    if (showSidebar && (!dom.sbDesktop || !dom.sbMobile)) {
      if (!dom.sbDesktopTarget || !dom.sbDesktopTarget.isConnected) dom.sbDesktopTarget = document.querySelector(SB_DESKTOP.target);
      if (!dom.sbMobileTarget || !dom.sbMobileTarget.isConnected) dom.sbMobileTarget = document.querySelector(SB_MOBILE.target);
    }
    if (showSidebar && !dom.sbFlyout) {
      if (!dom.sbFlyoutTarget || !dom.sbFlyoutTarget.isConnected) dom.sbFlyoutTarget = document.querySelector(SB_FLYOUT.target);
    }
    const nb = dom.notesBtn;
    if (showFooter && nb && !mb) {
      injectFooterButton(nb);
      dom.gymTab = document.getElementById("bbgl-gym-tab");
    } else if (showFooter && nb && mb && mb.nextSibling !== nb) {
      nb.parentNode.insertBefore(mb, nb);
    } else if (!showFooter && mb) {
      mb.remove();
      dom.gymTab = null;
    }
    const dt = dom.sbDesktopTarget, mt = dom.sbMobileTarget, ft = dom.sbFlyoutTarget;
    if (showSidebar) {
      if (dt && !dom.sbDesktop) {
        injectSidebarButton(SB_DESKTOP, false);
        dom.sbDesktop = document.getElementById(SB_DESKTOP.id);
      }
      if (mt && !dom.sbMobile) {
        injectSidebarButton(SB_MOBILE, true);
        dom.sbMobile = document.getElementById(SB_MOBILE.id);
      }
      if (ft && !dom.sbFlyout) {
        injectSidebarButton(SB_FLYOUT, true);
        dom.sbFlyout = document.getElementById(SB_FLYOUT.id);
      }
    } else {
      const dEl = dom.sbDesktop, mEl = dom.sbMobile, fEl = dom.sbFlyout;
      if (dEl) {
        const sl = dEl.closest(".swiper-slide");
        sl ? sl.remove() : dEl.remove();
        dom.sbDesktop = null;
      }
      if (mEl) {
        const sl = mEl.closest(".swiper-slide");
        sl ? sl.remove() : mEl.remove();
        dom.sbMobile = null;
      }
      if (fEl) {
        fEl.remove();
        dom.sbFlyout = null;
      }
    }
    setLastButtonLocation(loc);
    if (showSidebar) app.syncSidebarState();
    settleDomObs();
    Perf.end("handleDomMutation");
  }
  function settleDomObs() {
    const loc = userConfig.buttonLocation, showFooter = loc === "notes" || loc === "both", showSb = loc === "sidebar" || loc === "both";
    const footerOk = !showFooter || dom.gymTab && dom.gymTab.isConnected;
    const sidebarOk = !showSb || dom.sbDesktop && dom.sbDesktop.isConnected;
    if (!footerOk || !sidebarOk) return;
    if (!runtime.domObs || !runtime._domObsArmed) return;
    runtime.domObs.disconnect();
    runtime._domObsArmed = false;
    const guard = (parent) => {
      if (!parent) return;
      const o3 = new MutationObserver(() => {
        if (!runtime._domObsArmed) rearmDomObs();
      });
      o3.observe(parent, { childList: true });
      runtime._domGuards.push(o3);
    };
    const seen = /* @__PURE__ */ new Set();
    [dom.gymTab && dom.gymTab.parentNode, dom.sbDesktop && dom.sbDesktop.parentNode, dom.sbMobile && dom.sbMobile.parentNode, dom.sbFlyout && dom.sbFlyout.parentNode].forEach((p3) => {
      if (p3 && !seen.has(p3)) {
        seen.add(p3);
        guard(p3);
      }
    });
  }
  function rearmDomObs() {
    if (!runtime.domObs || runtime._domObsArmed) return;
    runtime._domGuards.forEach((o3) => o3.disconnect());
    runtime._domGuards = [];
    runtime.domObs.observe(document.body, { childList: true, subtree: true });
    runtime._domObsArmed = true;
    if (runtime._domRearmRaf) return;
    runtime._domRearmRaf = requestAnimationFrame(() => {
      runtime._domRearmRaf = null;
      handleDomMutation();
    });
  }
  var SB_DESKTOP = { target: '#nav-gym[class*="area-desktop"]', container: "area-desktop___vZLI8", link: "desktopLink___SG2RU", row: "area-row___iBD8N", id: "nav-gym-log-desktop" };
  var SB_MOBILE = { target: '#nav-gym[class*="area-mobile"]:not(#fly-out-panel *)', container: "area-mobile___sx8BQ", link: "mobileLink___xTgRa sidebarMobileLink", row: "area-row___iBD8N", slide: "swiper-slide slide___se7hj", id: "nav-gym-log-mobile" };
  var SB_FLYOUT = { target: '#fly-out-panel [id="nav-gym"]', container: "area-mobile___AK1cR notList___jrp60", link: "link___tg6eQ mobileLink___NbSV4", row: "areaRow___Eheay", id: "nav-gym-log-flyout" };
  var GYM_LOG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" stroke="transparent" stroke-width="0" width="18" height="18" viewBox="60 20 280 215"><g transform="scale(1, 1.15)"><path d="${ICONS.LOGO_PATH}"></path></g></svg>`;
  function handleLayout() {
    const p3 = dom.panel, tb = dom.gymTab, isPanelOpen = p3 && p3.style.display !== "none";
    if (!p3 || p3.classList.contains("bbgl-mode-page")) {
      if (tb) tb.classList.toggle("bbgl-tab-active", !!isPanelOpen);
      return;
    }
    const peopBtn = dom.peopleBtn && dom.peopleBtn.isConnected ? dom.peopleBtn : dom.peopleBtn = document.getElementById("people_panel_button");
    const settBtn = dom.settingsBtn && dom.settingsBtn.isConnected ? dom.settingsBtn : dom.settingsBtn = document.getElementById("notes_settings_button");
    const noteBtn = dom.notesBtn && dom.notesBtn.isConnected ? dom.notesBtn : dom.notesBtn = document.getElementById("notes_panel_button");
    const chatRoot = dom.chatRoot && dom.chatRoot.isConnected ? dom.chatRoot : dom.chatRoot = _bbglGetChatRoot();
    const isOpen = (b2) => b2 && b2.className.includes("opened___");
    const peopOpen = isOpen(peopBtn), settOpen = isOpen(settBtn), notesOpen = isOpen(noteBtn);
    const innerW = window.innerWidth;
    const topCeiling = app.getTopCeiling();
    const visWins = app._getLayoutWindows();
    app._syncLayoutResizeTargets(visWins);
    let isNotesExpanded = false;
    let maxNonChatWidth = 0;
    const winInfo = [];
    const shoveTargets = _bbglGetChatShoveTargets();
    visWins.forEach((w3) => {
      const inChat = _bbglIsChatWindow(w3, shoveTargets);
      const rect = w3.getBoundingClientRect();
      const dist = innerW - rect.right;
      if (notesOpen && !inChat) maxNonChatWidth = Math.max(maxNonChatWidth, w3.offsetWidth || 0);
      winInfo.push({ w: w3, rect, dist, inChat });
    });
    if (notesOpen) isNotesExpanded = maxNonChatWidth > 500 || innerW <= 620 && maxNonChatWidth > innerW * 0.75;
    let off = LAYOUT.BASE_RIGHT;
    if (peopOpen) off += 303;
    if (settOpen) off += 303;
    if (notesOpen) off += isNotesExpanded ? 582 : 303;
    let pRight, pOpacity, pPointer;
    if (innerW - off < 40) {
      pRight = `${innerW + 50}px`;
      pOpacity = "0";
      pPointer = "none";
    } else {
      const panelWidth = viewState.expanded ? 576 : 300;
      if (off <= LAYOUT.BASE_RIGHT) {
        const maxOff = innerW - panelWidth - 0;
        if (off > maxOff) off = Math.max(0, maxOff);
      }
      pRight = `${off}px`;
      pOpacity = "1";
      pPointer = "auto";
    }
    const totalShift = viewState.expanded ? 581 : 305;
    if (tb) tb.classList.toggle("bbgl-tab-active", !!isPanelOpen);
    p3.style.setProperty("max-height", `calc(100vh - ${topCeiling}px)`, "important");
    p3.style.right = pRight;
    p3.style.opacity = pOpacity;
    p3.style.pointerEvents = pPointer;
    const _staleParent = shoveTargets[0] && shoveTargets[0].parentElement || null;
    if (_staleParent && _staleParent.style.transform) _staleParent.style.transform = "";
    shoveTargets.forEach((t3) => {
      t3.style.right = isPanelOpen ? `${totalShift}px` : "";
      const _tr = t3.style.transition || "";
      if (!_tr.includes("right")) t3.style.transition = _tr ? _tr + ", right 0.2s ease-out" : "right 0.2s ease-out";
    });
    winInfo.forEach(({ w: w3, inChat }) => {
      if (!inChat) {
        w3.style.transform = "";
        return;
      }
    });
  }
  function markPanelResizing(p3) {
    if (!p3) return;
    if (p3._bbglResizingCancel) p3._bbglResizingCancel();
    p3.classList.add("bbgl-resizing");
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      p3.removeEventListener("transitionend", onEnd);
      clearTimeout(timer);
      p3.classList.remove("bbgl-resizing");
      p3._bbglResizingCancel = null;
    };
    const onEnd = (ev) => {
      if (ev.target === p3 && (ev.propertyName === "width" || ev.propertyName === "height")) finish();
    };
    p3.addEventListener("transitionend", onEnd);
    const timer = setTimeout(finish, 350);
    p3._bbglResizingCancel = finish;
  }
  function _bbglGetChatRoot() {
    return document.getElementById("chatRoot");
  }
  function _bbglGetChatShoveTargets() {
    const targets = [];
    document.querySelectorAll('[id^="channel_panel_button:"]').forEach((b2) => {
      const id = b2.id.slice("channel_panel_button:".length);
      if (!id) return;
      const box = document.getElementById(id);
      if (!box) return;
      const wrap = box.closest('[class*="item___"]');
      if (wrap && !targets.includes(wrap)) targets.push(wrap);
    });
    return targets;
  }
  function _bbglIsChatWindow(w3, shoveTargets) {
    if (!w3) return false;
    if (shoveTargets && shoveTargets.some((t3) => t3 === w3 || t3.contains(w3) || w3.contains(t3))) return true;
    const cls = w3.className || "";
    return typeof cls === "string" && cls.toLowerCase().includes("chat");
  }
  function attachLayoutObservers() {
    layoutObservers.forEach((o3) => {
      if (o3.disconnect) o3.disconnect();
    });
    layoutObservers.length = 0;
    const onLayoutChange = function onLayoutChange2() {
      if (runtime.layoutRafId) return;
      runtime.layoutRafId = requestAnimationFrame(function onLayoutFrame() {
        runtime.layoutRafId = null;
        app._syncLayoutResizeTargets();
        handleLayout();
        clearTimeout(runtime._layoutResyncTimer);
        runtime._layoutResyncTimer = setTimeout(function() {
          runtime._layoutResyncTimer = null;
          app._syncLayoutResizeTargets();
        }, 350);
      });
    };
    if (!runtime.layoutResizeObserver) {
      runtime.layoutResizeObserver = new ResizeObserver(onLayoutChange);
    }
    if (!runtime._layoutWinResizeArmed) {
      runtime._layoutWinResizeArmed = true;
      window.addEventListener("resize", onLayoutChange, { passive: true });
    }
    const watchClass = (el) => {
      if (!el) return;
      const o3 = new MutationObserver(onLayoutChange);
      o3.observe(el, { attributes: true, attributeFilter: ["class"] });
      layoutObservers.push(o3);
    };
    const watchChatRoot = (el) => {
      if (!el) return;
      const o3 = new MutationObserver(onLayoutChange);
      o3.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
      layoutObservers.push(o3);
    };
    const watchLayoutLifecycle = () => {
      const o3 = new MutationObserver((muts) => {
        for (const m3 of muts) {
          if (m3.type !== "childList") continue;
          const nodes = [];
          if (m3.addedNodes && m3.addedNodes.length) nodes.push(...m3.addedNodes);
          if (m3.removedNodes && m3.removedNodes.length) nodes.push(...m3.removedNodes);
          for (const n2 of nodes) {
            const el = n2 && n2.nodeType === 1 ? n2 : null;
            if (!el) continue;
            const cn = el.className || "";
            if (typeof cn === "string" && (cn.includes("visible___") || cn.includes("opened___")) || el.querySelector && el.querySelector('[class*="visible___"], [class*="opened___"]')) {
              onLayoutChange();
              return;
            }
          }
        }
      });
      o3.observe(document.body, { childList: true, subtree: true });
      layoutObservers.push(o3);
    };
    dom.notesBtn = document.getElementById("notes_panel_button");
    dom.peopleBtn = document.getElementById("people_panel_button");
    dom.settingsBtn = document.getElementById("notes_settings_button");
    dom.chatRoot = _bbglGetChatRoot();
    watchClass(dom.notesBtn);
    watchClass(dom.peopleBtn);
    watchClass(dom.settingsBtn);
    watchChatRoot(dom.chatRoot);
    watchLayoutLifecycle();
    onLayoutChange();
  }
  function injectGymLevelBar() {
    const gymRoot = document.getElementById("gymroot");
    if (!gymRoot) return;
    if (document.getElementById("bbgl-gym-level-container")) return;
    for (const p3 of gymRoot.querySelectorAll("p")) {
      if (p3.textContent.trim() === "What would you like to train today?") {
        (p3.parentElement?.parentElement ?? p3).remove();
        break;
      }
    }
    const container = document.createElement("div");
    container.id = "bbgl-gym-level-container";
    gymRoot.prepend(container);
    mountGymLevelBar(container);
    app.DataController.buildProgressionCache();
    const num = document.getElementById("bbgl-gym-level-num");
    const fill = document.getElementById("bbgl-gym-level-fill");
    if (num && fill) renderLevelBar({ num, fill, container }, getLiveLevelExp());
  }
  function injectFooterButton(notesBtnEl) {
    if (!notesBtnEl || !notesBtnEl.parentNode) return;
    if (document.getElementById("bbgl-gym-tab")) return;
    const b2 = document.createElement("button");
    b2.id = "bbgl-gym-tab";
    notesBtnEl.parentNode.insertBefore(b2, notesBtnEl);
    mountFooterTab(b2);
    dom.gymTab = b2;
    app.updateFooterTooltip();
  }
  function injectSidebarButton(cfg, mob) {
    if (document.getElementById(cfg.id)) return;
    const c3 = document.createElement("div");
    c3.className = cfg.container;
    c3.id = cfg.id;
    const r4 = document.createElement("div");
    r4.className = cfg.row;
    const l3 = document.createElement("a");
    l3.href = "/calendar.php#gymlog";
    l3.className = cfg.link;
    l3.innerHTML = `<span class="svgIconWrap___AMIqR"><span class="defaultIcon___iiNis mobile___paLva">${GYM_LOG_ICON}</span></span>${mob ? "<span>Gym Log</span>" : '<span class="linkName___FoKha">Gym Log</span>'}`;
    const _isNewInstall = !localStorage.getItem("bbgl_initialized") && !localStorage.getItem(KEYS.SB_NOTIF);
    const _hasChangelogNotif = localStorage.getItem(KEYS.CHANGELOG_NOTIF) === "1";
    if (_isNewInstall || _hasChangelogNotif) c3.classList.add("bbgl-sb-notif");
    l3.addEventListener("click", (e3) => {
      e3.preventDefault();
      const hadNotif = c3.classList.contains("bbgl-sb-notif");
      const _liveIsNewInstall = !localStorage.getItem("bbgl_initialized") && !localStorage.getItem(KEYS.SB_NOTIF);
      const _liveHasChangelogNotif = localStorage.getItem(KEYS.CHANGELOG_NOTIF) === "1";
      if (hadNotif) {
        if (_liveIsNewInstall) localStorage.setItem(KEYS.SB_NOTIF, "1");
        if (_liveHasChangelogNotif) app.syncChangelogNotif(false);
      }
      if (window.location.pathname !== "/calendar.php" || window.location.hash !== "#gymlog") {
        window.location.href = "/calendar.php#gymlog";
      } else {
        if (hadNotif && _liveHasChangelogNotif) {
          localStorage.setItem(KEYS.CHANGELOG_VER, SCRIPT_VERSION);
          localStorage.removeItem(KEYS.CHANGELOG_NOTIF);
          setTimeout(() => app.openChangelogModal(), 400);
        }
      }
    });
    r4.appendChild(l3);
    c3.appendChild(r4);
    document.querySelectorAll(cfg.target).forEach((n2) => {
      const _liveContainer = Array.from(n2.classList).filter((cl) => !cl.startsWith("active___")).join(" ");
      if (_liveContainer) {
        const hasNotif = c3.classList.contains("bbgl-sb-notif");
        c3.className = _liveContainer;
        if (hasNotif) c3.classList.add("bbgl-sb-notif");
      }
      const _liveRow = n2.querySelector('[class*="area-row"], [class*="areaRow"]') || n2.firstElementChild;
      if (_liveRow) r4.className = _liveRow.className;
      const _scopedSiblings = n2.parentNode ? Array.from(n2.parentNode.children).filter((el) => el !== n2 && el.id && el.id.startsWith("nav-") && el.id !== cfg.id && el.querySelector("a")) : [];
      const _siblingSelector = mob ? '[id^="nav-"][class*="area-mobile"]' : '[id^="nav-"][class*="area-desktop"]';
      const _allSiblings = _scopedSiblings.length ? _scopedSiblings : Array.from(document.querySelectorAll(_siblingSelector)).filter((el) => el !== n2 && el.id !== cfg.id && el.querySelector("a"));
      const _inactiveSibling = _allSiblings.find((el) => !Array.from(el.classList).some((cls) => cls.startsWith("active___")));
      const _siblingSection = _inactiveSibling || _allSiblings[0];
      const _extractClass = (cn, prefixes) => (cn || "").split(/\s+/).filter((x3) => x3 && prefixes.some((p4) => x3.startsWith(p4))).join(" ");
      const _neutralLink = _siblingSection ? _siblingSection.querySelector("a") : null;
      if (_neutralLink) {
        l3.className = _extractClass(_neutralLink.className, ["link___", "desktopLink", "mobileLink", "sidebarMobileLink"]);
        const _sw = _neutralLink.querySelector('[class*="svgIconWrap"]');
        const _di = _neutralLink.querySelector('[class*="defaultIcon"]');
        const _ln = _neutralLink.querySelector('[class*="linkName"]');
        const _liveSvgWrap = _sw ? _extractClass(_sw.className, ["svgIconWrap"]) : "svgIconWrap___AMIqR";
        const _liveDefIcon = _di ? _extractClass(_di.className, ["defaultIcon", "mobile"]) : "defaultIcon___iiNis mobile___paLva";
        const _liveLinkName = _ln ? _extractClass(_ln.className, ["linkName"]) : "linkName___FoKha";
        l3.innerHTML = `<span class="${_liveSvgWrap}"><span class="${_liveDefIcon}">${GYM_LOG_ICON}</span></span>${_ln ? `<span class="${_liveLinkName}">Gym Log</span>` : "<span>Gym Log</span>"}`;
      }
      const p3 = n2.closest(".swiper-slide");
      if (p3) {
        const s3 = document.createElement("div");
        s3.className = cfg.slide || "swiper-slide slide___se7hj";
        s3.style.width = n2.parentNode.style.width || "43.375px";
        s3.appendChild(c3);
        const _wr = n2.parentNode.parentNode;
        if (_wr) {
          _wr.insertBefore(s3, n2.parentNode.nextSibling);
          _wr.classList.add("bbgl-swiper-wr");
          if (_wr.parentNode) _wr.parentNode.classList.add("bbgl-swiper-cont");
          if (!n2.parentNode.style.width) {
            let _woTimer = null;
            const _wo = new MutationObserver(() => {
              if (n2.parentNode.style.width) {
                s3.style.width = n2.parentNode.style.width;
                _wo.disconnect();
                if (_woTimer) {
                  clearTimeout(_woTimer);
                  _woTimer = null;
                }
              }
            });
            _wo.observe(n2.parentNode, { attributes: true, attributeFilter: ["style"] });
            _woTimer = setTimeout(() => {
              _wo.disconnect();
              _woTimer = null;
            }, 5e3);
          }
        }
      } else {
        n2.parentNode.insertBefore(c3, n2.nextSibling);
      }
    });
    app.syncSidebarState();
  }
  function onChangeLoc(val) {
    userConfig.buttonLocation = val;
    saveConfig();
    handleDomMutation();
    app.syncSiblingSelect("set-loc-select", "init-loc-select", val);
    app.syncSiblingSelect("init-loc-select", "set-loc-select", val);
  }
  function resetSelectionState() {
    calendarState.selectedData = null;
    calendarState.selectedLabel = null;
    viewState.activeViewLabel = null;
    runtime.stickerData = [];
  }
  function onChangeDayStart(val) {
    userConfig.dayStartMode = val;
    saveConfig();
    const s3 = app.getActiveHistory(), baseline = s3.meta.baselineBreakdown || ZERO_BREAKDOWN, series = app.DataController.flattenAllSeries();
    if (series.length > 0) {
      const rebuilt = app.DataController._rebuildFromSeries(series, baseline);
      s3.history = rebuilt.history;
      s3.today = rebuilt.today;
      app.DataController.saveSmartHistory(s3);
    } else app.DataController.invalidate();
    resetSelectionState();
    app.renderPanelContent();
    const tp = dom.topPanel;
    if (tp && tp.classList.contains("viewing-graph")) app.GraphController.draw();
    app.syncSiblingSelect("set-day-start", "init-day-start", val);
    app.syncSiblingSelect("init-day-start", "set-day-start", val);
  }
  function onChangeWeekStart(val) {
    userConfig.weekStartMode = val;
    saveConfig();
    app.DataController.invalidate();
    resetSelectionState();
    app.renderPanelContent();
    const tp = dom.topPanel;
    if (tp && tp.classList.contains("viewing-graph")) app.GraphController.draw();
    app.syncSiblingSelect("set-week-start", "init-week-start", val);
    app.syncSiblingSelect("init-week-start", "set-week-start", val);
  }
  var docCache = {};
  function refreshInitMask(wv) {
    const root = wv || dom.welcomeView;
    if (!root) return;
    const body = root.querySelector("#init-section-masked-body");
    if (!body) return;
    if (userConfig.privacyAgreed) body.classList.remove("bbgl-mask-active");
    else body.classList.add("bbgl-mask-active");
    refreshInitLock();
  }
  function refreshInitLock() {
    if (!dom.panel) return;
    const isInit = !!localStorage.getItem("bbgl_initialized");
    const lock = !isInit && !runtime.demoMode;
    dom.panel.classList.toggle("bbgl-init-locked", lock);
    const pc = document.getElementById("bbgl-page-container");
    if (pc) pc.classList.toggle("bbgl-init-locked", lock);
  }
  function handleGymClick(e3) {
    const b2 = e3.target.closest("button");
    if (!b2) return;
    const l3 = b2.getAttribute("aria-label");
    if (!l3) return;
    let id = null;
    if (l3 === "Train strength") id = 5300;
    else if (l3 === "Train defense") id = 5301;
    else if (l3 === "Train speed") id = 5302;
    else if (l3 === "Train dexterity") id = 5303;
    if (id) {
      sessionStorage.setItem(KEYS.SESSION, "true");
      if (!runtime.trainDebouncers) runtime.trainDebouncers = {};
      if (runtime.trainDebouncers[id]) clearTimeout(runtime.trainDebouncers[id]);
      runtime.trainDebouncers[id] = setTimeout(() => {
        app.universalFetch("TRAIN_SINGLE", { specId: id });
        runtime.trainDebouncers[id] = null;
      }, 1e3);
    }
  }
  app.injectWeeklyBar = injectWeeklyBar;
  app.getLiveLevelExp = getLiveLevelExp;
  app.getLevelBars = getLevelBars;
  app.renderLevelBar = renderLevelBar;
  app.handleDomMutation = handleDomMutation;
  app.settleDomObs = settleDomObs;
  app.rearmDomObs = rearmDomObs;
  app.SB_DESKTOP = SB_DESKTOP;
  app.SB_MOBILE = SB_MOBILE;
  app.SB_FLYOUT = SB_FLYOUT;
  app.handleLayout = handleLayout;
  app.markPanelResizing = markPanelResizing;
  app._bbglGetChatRoot = _bbglGetChatRoot;
  app._bbglGetChatShoveTargets = _bbglGetChatShoveTargets;
  app._bbglIsChatWindow = _bbglIsChatWindow;
  app.attachLayoutObservers = attachLayoutObservers;
  app.injectGymLevelBar = injectGymLevelBar;
  app.injectFooterButton = injectFooterButton;
  app.injectSidebarButton = injectSidebarButton;
  app.onChangeLoc = onChangeLoc;
  app.resetSelectionState = resetSelectionState;
  app.onChangeDayStart = onChangeDayStart;
  app.onChangeWeekStart = onChangeWeekStart;
  app.docCache = docCache;
  app.refreshInitMask = refreshInitMask;
  app.refreshInitLock = refreshInitLock;
  app.handleGymClick = handleGymClick;

  // node_modules/preact/hooks/dist/hooks.module.js
  var t2;
  var r3;
  var u3;
  var i2;
  var o2 = 0;
  var f3 = [];
  var c2 = l;
  var e2 = c2.__b;
  var a2 = c2.__r;
  var v2 = c2.diffed;
  var l2 = c2.__c;
  var m2 = c2.unmount;
  var p2 = c2.__;
  function s2(n2, t3) {
    c2.__h && c2.__h(r3, n2, o2 || t3), o2 = 0;
    var u4 = r3.__H || (r3.__H = { __: [], __h: [] });
    return n2 >= u4.__.length && u4.__.push({}), u4.__[n2];
  }
  function d2(n2) {
    return o2 = 1, y2(D2, n2);
  }
  function y2(n2, u4, i3) {
    var o3 = s2(t2++, 2);
    if (o3.t = n2, !o3.__c && (o3.__ = [i3 ? i3(u4) : D2(void 0, u4), function(n3) {
      var t3 = o3.__N ? o3.__N[0] : o3.__[0], r4 = o3.t(t3, n3);
      t3 !== r4 && (o3.__N = [r4, o3.__[1]], o3.__c.setState({}));
    }], o3.__c = r3, !r3.__f)) {
      var f4 = function(n3, t3, r4) {
        if (!o3.__c.__H) return true;
        var u5 = false, i4 = o3.__c.props !== n3;
        if (o3.__c.__H.__.some(function(n4) {
          if (n4.__N) {
            u5 = true;
            var t4 = n4.__[0];
            n4.__ = n4.__N, n4.__N = void 0, t4 !== n4.__[0] && (i4 = true);
          }
        }), c3) {
          var f5 = c3.call(this, n3, t3, r4);
          return u5 ? f5 || i4 : f5;
        }
        return !u5 || i4;
      };
      r3.__f = true;
      var c3 = r3.shouldComponentUpdate, e3 = r3.componentWillUpdate;
      r3.componentWillUpdate = function(n3, t3, r4) {
        if (this.__e) {
          var u5 = c3;
          c3 = void 0, f4(n3, t3, r4), c3 = u5;
        }
        e3 && e3.call(this, n3, t3, r4);
      }, r3.shouldComponentUpdate = f4;
    }
    return o3.__N || o3.__;
  }
  function h2(n2, u4) {
    var i3 = s2(t2++, 3);
    !c2.__s && C2(i3.__H, u4) && (i3.__ = n2, i3.u = u4, r3.__H.__h.push(i3));
  }
  function A2(n2) {
    return o2 = 5, T2(function() {
      return { current: n2 };
    }, []);
  }
  function T2(n2, r4) {
    var u4 = s2(t2++, 7);
    return C2(u4.__H, r4) && (u4.__ = n2(), u4.__H = r4, u4.__h = n2), u4.__;
  }
  function j2() {
    for (var n2; n2 = f3.shift(); ) {
      var t3 = n2.__H;
      if (n2.__P && t3) try {
        t3.__h.some(z2), t3.__h.some(B2), t3.__h = [];
      } catch (r4) {
        t3.__h = [], c2.__e(r4, n2.__v);
      }
    }
  }
  c2.__b = function(n2) {
    r3 = null, e2 && e2(n2);
  }, c2.__ = function(n2, t3) {
    n2 && t3.__k && t3.__k.__m && (n2.__m = t3.__k.__m), p2 && p2(n2, t3);
  }, c2.__r = function(n2) {
    a2 && a2(n2), t2 = 0;
    var i3 = (r3 = n2.__c).__H;
    i3 && (u3 === r3 ? (i3.__h = [], r3.__h = [], i3.__.some(function(n3) {
      n3.__N && (n3.__ = n3.__N), n3.u = n3.__N = void 0;
    })) : (i3.__h.some(z2), i3.__h.some(B2), i3.__h = [], t2 = 0)), u3 = r3;
  }, c2.diffed = function(n2) {
    v2 && v2(n2);
    var t3 = n2.__c;
    t3 && t3.__H && (t3.__H.__h.length && (1 !== f3.push(t3) && i2 === c2.requestAnimationFrame || ((i2 = c2.requestAnimationFrame) || w2)(j2)), t3.__H.__.some(function(n3) {
      n3.u && (n3.__H = n3.u, n3.u = void 0);
    })), u3 = r3 = null;
  }, c2.__c = function(n2, t3) {
    t3.some(function(n3) {
      try {
        n3.__h.some(z2), n3.__h = n3.__h.filter(function(n4) {
          return !n4.__ || B2(n4);
        });
      } catch (r4) {
        t3.some(function(n4) {
          n4.__h && (n4.__h = []);
        }), t3 = [], c2.__e(r4, n3.__v);
      }
    }), l2 && l2(n2, t3);
  }, c2.unmount = function(n2) {
    m2 && m2(n2);
    var t3, r4 = n2.__c;
    r4 && r4.__H && (r4.__H.__.some(function(n3) {
      try {
        z2(n3);
      } catch (n4) {
        t3 = n4;
      }
    }), r4.__H = void 0, t3 && c2.__e(t3, r4.__v));
  };
  var k2 = "function" == typeof requestAnimationFrame;
  function w2(n2) {
    var t3, r4 = function() {
      clearTimeout(u4), k2 && cancelAnimationFrame(t3), setTimeout(n2);
    }, u4 = setTimeout(r4, 35);
    k2 && (t3 = requestAnimationFrame(r4));
  }
  function z2(n2) {
    var t3 = r3, u4 = n2.__c;
    "function" == typeof u4 && (n2.__c = void 0, u4()), r3 = t3;
  }
  function B2(n2) {
    var t3 = r3;
    n2.__c = n2.__(), r3 = t3;
  }
  function C2(n2, t3) {
    return !n2 || n2.length !== t3.length || t3.some(function(t4, r4) {
      return t4 !== n2[r4];
    });
  }
  function D2(n2, t3) {
    return "function" == typeof t3 ? t3(n2) : t3;
  }

  // src/ui/preact/form.tsx
  function Section(props) {
    return /* @__PURE__ */ u2(S, { children: [
      /* @__PURE__ */ u2("div", { class: "bbgl-prefs-tab-title", style: props.titleStyle, children: [
        /* @__PURE__ */ u2("span", { children: props.title }),
        props.extra
      ] }),
      /* @__PURE__ */ u2("div", { class: "bbgl-settings-body", style: props.bodyStyle, children: props.children })
    ] });
  }
  function Row(props) {
    return /* @__PURE__ */ u2("div", { class: `bbgl-setting-row${props.extraClass ? ` ${props.extraClass}` : ""}`, children: [
      props.label,
      props.children
    ] });
  }
  function Toggle(props) {
    return /* @__PURE__ */ u2(
      Row,
      {
        extraClass: props.extraClass,
        label: /* @__PURE__ */ u2("span", { "data-tooltip-html": props.tip, children: props.label }),
        children: /* @__PURE__ */ u2("label", { class: "bbgl-switch", children: [
          /* @__PURE__ */ u2(
            "input",
            {
              id: props.id,
              type: "checkbox",
              checked: props.checked,
              disabled: props.disabled,
              onChange: (e3) => props.onChange(e3.target.checked)
            }
          ),
          /* @__PURE__ */ u2("span", { class: "slider" })
        ] })
      }
    );
  }
  function Btn(props) {
    const cls = ["bbgl-btn", props.modifier ? `bbgl-btn-${props.modifier}` : ""].filter(Boolean).join(" ");
    return /* @__PURE__ */ u2(
      "button",
      {
        id: props.id,
        type: "button",
        class: cls,
        style: props.style,
        disabled: props.disabled,
        onClick: props.onClick,
        children: props.children
      }
    );
  }
  function ApiField(props) {
    return /* @__PURE__ */ u2("div", { class: "bbgl-api-container", style: props.style, children: [
      /* @__PURE__ */ u2(
        "div",
        {
          id: `${props.prefix}-api-paste`,
          class: "bbgl-paste-icon",
          "data-tooltip": TOOLTIPS.PASTE_CLIPBOARD,
          onClick: async () => {
            try {
              const t3 = await navigator.clipboard.readText();
              if (t3 && props.inputRef.current) props.inputRef.current.value = t3.trim();
            } catch {
              bbglError(MSG_CLIPBOARD_DENIED);
            }
          },
          children: /* @__PURE__ */ u2(Raw, { html: ICONS.PASTE })
        }
      ),
      /* @__PURE__ */ u2(
        "input",
        {
          id: `${props.prefix}-api-key`,
          ref: (el) => {
            props.inputRef.current = el;
          },
          type: "text",
          name: "bbgl_api_key",
          autocomplete: "off",
          class: "bbgl-native-input",
          placeholder: "Enter Full or Custom API Key...",
          defaultValue: props.defaultValue || ""
        }
      )
    ] });
  }
  var STACK = {
    top: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottom: "none" },
    mid: { borderRadius: 0, borderBottom: "none" },
    bottom: { borderTopLeftRadius: 0, borderTopRightRadius: 0 }
  };
  var CREATE_API_URL = "https://www.torn.com/preferences.php#tab=api?step=addNewKey&user=basic,battlestats,log&faction=rankedwars&logIds=54,50,23,6,52,56,3&title=BigBlackGymLog";

  // src/ui/preact/Modals.tsx
  var LOADING = '<div style="padding:20px; text-align:center; color:#888;">Loading...</div>';
  var ERROR = '<div style="padding:20px; text-align:center; color:#888;">Could not load document. Check your connection.</div>';
  function ModalShell(props) {
    return /* @__PURE__ */ u2("div", { class: "bbgl-modal-overlay", id: props.id, onClick: (e3) => {
      if (e3.target === e3.currentTarget) props.onClose();
    }, children: /* @__PURE__ */ u2("div", { class: "bbgl-modal-window", children: [
      /* @__PURE__ */ u2("div", { class: "close-settings-btn bbgl-close-x", title: "Close", onClick: props.onClose, children: /* @__PURE__ */ u2(Raw, { html: ICONS.CLOSE }) }),
      /* @__PURE__ */ u2(Section, { title: props.title, bodyStyle: { marginBottom: 8 }, children: props.children }),
      props.footer
    ] }) });
  }
  function DocBox(props) {
    const [html, setHtml] = d2(LOADING);
    h2(() => {
      let cancelled = false;
      (async () => {
        try {
          const raw = await app.fetchDoc(props.name);
          if (!cancelled) setHtml(raw);
        } catch {
          if (!cancelled) setHtml(ERROR);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [props.name]);
    h2(() => {
      const el = document.getElementById(props.id);
      if (!el) return;
      el.querySelectorAll("[data-bbgl-doc]").forEach((link) => {
        link.style.cursor = "pointer";
        link.onclick = async (e3) => {
          e3.preventDefault();
          const name = link.getAttribute("data-bbgl-doc");
          if (!name) return;
          setHtml(LOADING);
          try {
            setHtml(await app.fetchDoc(name));
          } catch {
            setHtml(ERROR);
          }
        };
      });
    }, [html, props.id]);
    return /* @__PURE__ */ u2("div", { class: "bbgl-modal-scrollbox", style: { maxHeight: "calc(68vh - 80px)", minHeight: 300 }, children: /* @__PURE__ */ u2("div", { id: props.id, dangerouslySetInnerHTML: { __html: html } }) });
  }
  function PrivacyModal(props) {
    const reviewMode = !!userConfig.privacyAgreed;
    const [acked, setAcked] = d2(false);
    return /* @__PURE__ */ u2(ModalShell, { id: "bbgl-privacy-modal", title: "Big Black Dicslosure", onClose: props.onClose, footer: reviewMode ? null : /* @__PURE__ */ u2("div", { style: { display: "flex", margin: "0 10px 4px 10px" }, children: [
      /* @__PURE__ */ u2(Btn, { id: "bbgl-privacy-demo-btn", modifier: "purple", style: { flex: 2, borderRadius: "4px 0 0 4px", margin: 0 }, onClick: (e3) => {
        e3.currentTarget.blur();
        app.enterDemo("privacy");
        props.onClose();
      }, children: "DEMO" }),
      /* @__PURE__ */ u2("span", { class: "bbgl-agree-wrap", style: { flex: 1, display: "flex" }, "data-tooltip": acked ? void 0 : TOOLTIPS.AGREE_GATE, children: /* @__PURE__ */ u2(
        Btn,
        {
          id: "bbgl-privacy-agree-btn",
          modifier: "green",
          disabled: !acked,
          style: { flex: 1, borderRadius: "0 4px 4px 0", margin: 0 },
          onClick: (e3) => {
            if (!acked) return;
            e3.currentTarget.blur();
            userConfig.privacyAgreed = (/* @__PURE__ */ new Date()).toISOString();
            saveConfig();
            if (!runtime.wasVersionWiped) localStorage.setItem(KEYS.CHANGELOG_VER, SCRIPT_VERSION);
            props.onClose();
            app.refreshInitLock();
            const wv = dom.welcomeView;
            if (wv && wv.classList.contains("active-view")) app.refreshInitMask(wv);
          },
          children: "AGREE"
        }
      ) })
    ] }), children: [
      /* @__PURE__ */ u2(DocBox, { name: "privacy", id: "bbgl-privacy-disc" }),
      /* @__PURE__ */ u2("div", { class: "bbgl-ack-row", style: { margin: "0 10px 8px 10px" }, children: reviewMode ? /* @__PURE__ */ u2(S, { children: [
        /* @__PURE__ */ u2("span", { class: "bbgl-ack-check bbgl-ack-agreed", children: /* @__PURE__ */ u2(Raw, { html: ICONS.CHECK }) }),
        /* @__PURE__ */ u2("span", { class: "bbgl-ack-agreed-label", children: "I have read and agree to this disclosure." })
      ] }) : /* @__PURE__ */ u2(S, { children: [
        /* @__PURE__ */ u2("input", { id: "bbgl-privacy-ack", type: "checkbox", checked: acked, onChange: (e3) => setAcked(e3.target.checked) }),
        /* @__PURE__ */ u2("label", { for: "bbgl-privacy-ack", children: "I have read and agree to this disclosure." })
      ] }) })
    ] });
  }
  function ChangelogModal(props) {
    return /* @__PURE__ */ u2(ModalShell, { id: "bbgl-changelog-modal", title: "BBGL Test Phase Changelog", onClose: props.onClose, children: /* @__PURE__ */ u2("div", { class: "bbgl-modal-scrollbox", style: { maxHeight: "calc(68vh - 80px)", minHeight: 300 }, children: /* @__PURE__ */ u2("div", { id: "bbgl-changelog-content", style: { fontFamily: "Arial, sans-serif", fontSize: 12, color: "#ccc", lineHeight: 1.7 }, children: /* @__PURE__ */ u2(DocBox, { name: "changelog", id: "bbgl-changelog-inner" }) }) }) });
  }
  function FeatureGuideModal(props) {
    return /* @__PURE__ */ u2(ModalShell, { id: "bbgl-feature-guide-modal", title: "Feature Guide", onClose: props.onClose, children: /* @__PURE__ */ u2("div", { class: "bbgl-modal-scrollbox", style: { maxHeight: "calc(68vh - 80px)", minHeight: 300 }, children: /* @__PURE__ */ u2("div", { style: { padding: 20, textAlign: "center", color: "#888" }, children: "Cumming Soon..." }) }) });
  }
  function mount(node, id) {
    closeById(id);
    const host = document.createElement("div");
    host.id = `${id}-host`;
    document.body.appendChild(host);
    R(node, host);
  }
  function closeById(id) {
    const host = document.getElementById(`${id}-host`);
    if (host) {
      R(null, host);
      host.remove();
    }
    const legacy = document.getElementById(id);
    if (legacy && legacy.parentNode) legacy.parentNode.removeChild(legacy);
  }
  function openPrivacyModal() {
    mount(/* @__PURE__ */ u2(PrivacyModal, { onClose: () => closeById("bbgl-privacy-modal") }), "bbgl-privacy-modal");
  }
  function closePrivacyModal() {
    closeById("bbgl-privacy-modal");
  }
  function openChangelogModal() {
    localStorage.setItem(KEYS.CHANGELOG_VER, SCRIPT_VERSION);
    localStorage.removeItem(KEYS.CHANGELOG_NOTIF);
    if (typeof app.syncChangelogNotif === "function") app.syncChangelogNotif(false);
    mount(/* @__PURE__ */ u2(ChangelogModal, { onClose: () => closeById("bbgl-changelog-modal") }), "bbgl-changelog-modal");
  }
  function closeChangelogModal() {
    closeById("bbgl-changelog-modal");
  }
  function openFeatureGuideModal() {
    mount(/* @__PURE__ */ u2(FeatureGuideModal, { onClose: () => closeById("bbgl-feature-guide-modal") }), "bbgl-feature-guide-modal");
  }
  function closeFeatureGuideModal() {
    closeById("bbgl-feature-guide-modal");
  }
  function BackfillChoiceModal(props) {
    const close = () => {
      props.onClose();
      app.switchView("ledger");
    };
    return /* @__PURE__ */ u2(ModalShell, { id: "bbgl-choice-modal", title: "Start Tracking", onClose: close, children: [
      /* @__PURE__ */ u2("div", { style: { padding: "6px 4px 14px", color: "#ccc", fontSize: 12, lineHeight: 1.6, textAlign: "center" }, children: "Start tracking now with no log history, or use Big Black Backfill to reconstruct your training history from Torn's logs. You can always get Big Black Backfilled later from the Settings." }),
      /* @__PURE__ */ u2("div", { style: { display: "flex", gap: 0, margin: "0 6px 2px" }, children: [
        /* @__PURE__ */ u2(Btn, { id: "bbgl-choice-fresh-btn", style: { flex: 1, borderRadius: "4px 0 0 4px", margin: 0 }, onClick: (e3) => {
          e3.currentTarget.blur();
          close();
        }, children: "START EMPTY LOG" }),
        /* @__PURE__ */ u2(Btn, { id: "bbgl-choice-backfill-btn", modifier: "purple", style: { flex: 1, borderRadius: "0 4px 4px 0", margin: 0 }, onClick: (e3) => {
          e3.currentTarget.blur();
          close();
          app.backfillLogs(document.getElementById("backfill-btn"));
        }, children: "BIG BLACK BACKFILL" })
      ] })
    ] });
  }
  app.openBackfillChoiceModal = openBackfillChoiceModal2;
  app.closeBackfillChoiceModal = closeBackfillChoiceModal2;
  function openBackfillChoiceModal2() {
    if (runtime.demoMode) return;
    mount(/* @__PURE__ */ u2(BackfillChoiceModal, { onClose: () => closeById("bbgl-choice-modal") }), "bbgl-choice-modal");
  }
  function closeBackfillChoiceModal2() {
    closeById("bbgl-choice-modal");
  }

  // src/ui/docs.js
  if (!app.docCache) app.docCache = {};
  function fetchDoc(name) {
    if (app.docCache[name]) return Promise.resolve(app.docCache[name]);
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: BASE_DOCS_URL + name + ".html?_=" + Date.now(),
        onload(res) {
          if (res.status >= 200 && res.status < 300) {
            app.docCache[name] = res.responseText;
            resolve(res.responseText);
          } else {
            reject(new Error(`Doc fetch failed: ${res.status}`));
          }
        },
        onerror() {
          reject(new Error("Doc fetch network error"));
        }
      });
    });
  }
  var DOC_LOADING_HTML = `<div style="padding:20px; text-align:center; color:#888;">Loading...</div>`;
  var DOC_ERROR_HTML = `<div style="padding:20px; text-align:center; color:#888;">Could not load document. Check your connection.</div>`;
  var PRIVACY_TEXT = { AGREE_LABEL: "I have read and agree to this disclosure." };
  app.fetchDoc = fetchDoc;
  app.DOC_LOADING_HTML = DOC_LOADING_HTML;
  app.DOC_ERROR_HTML = DOC_ERROR_HTML;
  app.PRIVACY_TEXT = PRIVACY_TEXT;
  app.closePrivacyModal = closePrivacyModal;
  app.closeChangelogModal = closeChangelogModal;
  app.closeFeatureGuideModal = closeFeatureGuideModal;
  app.openChangelogModal = openChangelogModal;
  app.openFeatureGuideModal = openFeatureGuideModal;
  app.openPrivacyModal = openPrivacyModal;

  // src/ui/graph.js
  var GraphController = { _transformData({ selectedData, selectedLabel, year, graphMode }) {
    const isToday = !selectedData, lbl = selectedLabel || "";
    let vt = "DAY", sl = null;
    if (isToday) {
      sl = app.DataController.getSlice("DAY", Formatter.dateLogical());
      vt = "DAY";
    } else if (lbl === "All-Time") {
      sl = app.DataController.getSlice("ALL", "All-Time");
      vt = "ALL";
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(lbl)) {
      sl = app.DataController.getSlice("DAY", lbl);
      vt = "DAY";
    } else if (/^\d{4}$/.test(lbl)) {
      sl = app.DataController.getSlice("YEAR", lbl);
      vt = "YEAR";
    } else if (CONSTANTS.MONTHS.includes(lbl)) {
      sl = app.DataController.getSlice("MONTH", lbl, year);
      vt = "MONTH";
    } else {
      sl = selectedData;
      vt = "WEEK";
    }
    if (!sl) return { labels: [], trends: { str: [], def: [], spd: [], dex: [], total: [] }, viewType: vt, xParams: { min: 0, max: 0 } };
    const isR = graphMode === "rates", labs = [], tr = { str: [], def: [], spd: [], dex: [], total: [] }, xp = { min: 0, max: 0 }, st = STAT_KEYS, tl = app.DataController.getTimeline(), h3 = app.getActiveHistory();
    let sr = { ...ZERO_BREAKDOWN, total: 0 }, startTs = 0;
    if (vt === "DAY") {
      const _p = sl.date.split("-");
      startTs = TimeManager.dayStartTs(sl.date);
    } else if (vt === "MONTH") {
      startTs = new Date(Date.UTC(year, CONSTANTS.MONTHS.indexOf(lbl), 1)).getTime();
    } else if (vt === "YEAR") {
      startTs = new Date(Date.UTC(parseInt(lbl), 0, 1)).getTime();
    } else if (vt === "ALL" && sl._dailyList.length > 0) {
      startTs = Formatter.parse(sl._dailyList[0].date).getTime();
    } else if (sl._dailyList.length > 0) {
      startTs = Formatter.parse(sl._dailyList[0].date).getTime();
    }
    const _histCut = sl.date || sl._dailyList?.[0]?.date || "";
    const hist = tl.filter((d3) => _histCut ? d3.date < _histCut : (/* @__PURE__ */ new Date(d3.date + "T00:00:00Z")).getTime() < startTs).reverse();
    if (_histCut) {
      const _prevDate = /* @__PURE__ */ new Date(_histCut + "T00:00:00Z");
      _prevDate.setUTCDate(_prevDate.getUTCDate() - 1);
      const _prevDateStr = _prevDate.toISOString().slice(0, 10);
      st.forEach((s3) => {
        sr[s3] = app.DataController.getHistoricalRate(_prevDateStr, s3);
      });
    } else {
      st.forEach((s3) => {
        sr[s3] = app.DataController.getOriginRate(s3);
      });
    }
    sr.total = st.reduce((a3, b2) => a3 + (sr[b2] || 0), 0);
    const globalBaseline = h3.meta && h3.meta.baselineBreakdown || { ...ZERO_BREAKDOWN };
    const _hv = (o3) => o3 && (o3.str || o3.def || o3.spd || o3.dex);
    const _updRates = (d3, base) => {
      let ur = { ...base };
      const ser = d3 && d3.series || [];
      st.forEach((s3) => {
        for (let j4 = ser.length - 1; j4 >= 0; j4--) {
          const e3 = ser[j4];
          if (e3.stat === s3 && e3.cost > 0) {
            ur[s3] = e3.rate;
            break;
          }
        }
      });
      ur.total = st.reduce((a3, s3) => a3 + (ur[s3] || 0), 0);
      return ur;
    };
    const _snapAt = (cutoffMs, d3, baseVals, baseRates) => {
      let vals = { ...baseVals }, rates = { ...baseRates };
      if (d3) {
        const ser = d3.series || [];
        const dStart = d3.startBreakdown || d3.start;
        if (_hv(dStart)) vals = { ...dStart };
        ser.filter((e3) => e3.ts * 1e3 <= cutoffMs).forEach((e3) => {
          vals[e3.stat] = e3.after;
        });
        st.forEach((s3) => {
          for (let i3 = ser.length - 1; i3 >= 0; i3--) {
            const e3 = ser[i3];
            if (e3.stat === s3 && e3.cost > 0 && e3.ts * 1e3 <= cutoffMs) {
              rates[s3] = e3.rate;
              break;
            }
          }
        });
        rates.total = st.reduce((a3, s3) => a3 + (rates[s3] || 0), 0);
      }
      return { vals, rates };
    };
    if (vt === "DAY") {
      const raw = app.DataController.getDateMap()[sl.date], start = startTs;
      xp.min = start;
      xp.max = start + 864e5;
      for (let i3 = 0; i3 <= 24; i3 += 2) labs.push(`${i3}:00`);
      if (raw && raw.series) st.forEach((s3) => {
        if (sr[s3] === 0) {
          const fLog = raw.series.find((l3) => l3.stat === s3);
          if (fLog && fLog.cost > 0) sr[s3] = fLog.rate;
        }
      });
      const ser = raw && raw.series ? raw.series : [];
      const sSt = raw && (raw.startBreakdown || raw.start) ? raw.startBreakdown || raw.start : hist[0] && (hist[0].endBreakdown || hist[0].end) ? hist[0].endBreakdown || hist[0].end : globalBaseline;
      const getSt = (ts) => {
        let r4 = { ...sSt };
        ser.filter((s3) => s3.ts * 1e3 <= ts).forEach((s3) => {
          r4[s3.stat] = s3.after;
        });
        return r4;
      };
      const getRt = (tsS, tsE) => {
        const rel = ser.filter((s3) => s3.ts * 1e3 > tsS && s3.ts * 1e3 <= tsE);
        if (rel.length === 0) return null;
        let et = 0, g4 = { ...ZERO_BREAKDOWN, total: 0 }, cs = { ...ZERO_BREAKDOWN };
        rel.forEach((s3) => {
          et += s3.cost;
          g4[s3.stat] += s3.gain;
          g4.total += s3.gain;
          cs[s3.stat] += s3.cost;
        });
        return { str: cs.str > 0 ? g4.str / cs.str * 150 : 0, def: cs.def > 0 ? g4.def / cs.def * 150 : 0, spd: cs.spd > 0 ? g4.spd / cs.spd * 150 : 0, dex: cs.dex > 0 ? g4.dex / cs.dex * 150 : 0, total: et > 0 ? g4.total / et * 150 : 0 };
      };
      let lr = { ...sr }, now = Date.now();
      const BKT = 15 * 60 * 1e3;
      const sBkts = [];
      if (ser.length > 0) {
        const sorted = ser.filter((s3) => {
          const t3 = s3.ts * 1e3;
          return t3 >= start && t3 <= start + 864e5;
        }).sort((a3, b2) => a3.ts - b2.ts);
        let gS = -1, gL = -1;
        sorted.forEach((s3) => {
          const t3 = s3.ts * 1e3;
          if (gS < 0 || t3 - gS > BKT) {
            if (gL >= 0) sBkts.push(gL);
            gS = t3;
            gL = t3;
          } else {
            gL = t3;
          }
        });
        if (gL >= 0) sBkts.push(gL);
      }
      const used = /* @__PURE__ */ new Set(), pts = [];
      for (let i3 = 0; i3 <= 24; i3 += 2) {
        const tick = start + i3 * 3600 * 1e3;
        if (isToday && tick > now) break;
        const nb = sBkts.find((b2) => !used.has(b2) && Math.abs(b2 - tick) <= BKT);
        if (nb !== void 0) {
          used.add(nb);
          pts.push(nb);
        } else {
          pts.push(tick);
        }
      }
      sBkts.forEach((b2) => {
        if (!used.has(b2)) pts.push(b2);
      });
      if (isToday) pts.push(now);
      pts.sort((a3, b2) => a3 - b2);
      pts.forEach((pt) => {
        if (isR) {
          const rt = getRt(pt - BKT, pt);
          if (rt) {
            st.forEach((s3) => {
              if (rt[s3] > 0) lr[s3] = rt[s3];
            });
            lr.total = st.reduce((a3, s3) => a3 + (lr[s3] || 0), 0);
          }
          st.forEach((s3) => tr[s3].push({ x: pt, y: lr[s3] }));
          tr.total.push({ x: pt, y: lr.total });
        } else {
          const sn = getSt(pt);
          st.forEach((s3) => tr[s3].push({ x: pt, y: sn[s3] || 0 }));
          tr.total.push({ x: pt, y: (sn.str || 0) + (sn.def || 0) + (sn.spd || 0) + (sn.dex || 0) });
        }
      });
    } else if (vt === "MONTH" || vt === "WEEK") {
      const dl = sl._dailyList.sort((a3, b2) => a3.date.localeCompare(b2.date));
      const byDate = {};
      dl.forEach((d3) => byDate[d3.date] = d3);
      let runningRates = { ...sr };
      let curVals = { ...globalBaseline };
      const _prePeriodDay = hist.find((d3) => {
        const e3 = d3.endBreakdown || d3.end;
        return _hv(e3);
      });
      if (_prePeriodDay) curVals = { ..._prePeriodDay.endBreakdown || _prePeriodDay.end };
      else if (dl.length > 0) {
        const f4 = dl[0].startBreakdown || dl[0].start;
        if (_hv(f4)) curVals = { ...f4 };
      }
      const todayStr = Formatter.dateLogical();
      const nowMs = Date.now();
      const _push = (x3, vals, rates) => {
        st.forEach((s3) => tr[s3].push({ x: x3, y: isR ? rates[s3] : vals[s3] || 0 }));
        tr.total.push({ x: x3, y: isR ? rates.total : (vals.str || 0) + (vals.def || 0) + (vals.spd || 0) + (vals.dex || 0) });
      };
      if (vt === "WEEK") {
        xp.min = 0;
        xp.max = 7;
        const fdStr = dl[0] ? dl[0].date : todayStr;
        const fd = Formatter.parse(fdStr);
        const dayIdx = fd.getUTCDay();
        const weekOffset = userConfig.weekStartMode === "mon" ? dayIdx === 0 ? 6 : dayIdx - 1 : dayIdx;
        const weekStart = new Date(fd);
        weekStart.setUTCDate(fd.getUTCDate() - weekOffset);
        for (let i3 = 0; i3 < 7; i3++) {
          const d3 = new Date(weekStart);
          d3.setUTCDate(weekStart.getUTCDate() + i3);
          labs.push(Formatter.dateISO(d3.getUTCFullYear(), d3.getUTCMonth(), d3.getUTCDate()));
        }
        let _wkHasData = hist.length > 0;
        for (let i3 = 0; i3 < 7; i3++) {
          const dateStr = labs[i3];
          const d3 = byDate[dateStr];
          const dayStart = TimeManager.dayStartTs(dateStr);
          if (dayStart > nowMs) break;
          if (!d3 && !_wkHasData && dateStr !== todayStr) continue;
          if (d3) _wkHasData = true;
          const middayTs = dayStart + 12 * 3600 * 1e3;
          _push(i3, curVals, runningRates);
          if (middayTs <= nowMs) {
            const m3 = _snapAt(middayTs, d3, curVals, runningRates);
            _push(i3 + 0.5, m3.vals, m3.rates);
          }
          if (d3) {
            if (dateStr === todayStr) {
              const live = _snapAt(nowMs, d3, curVals, runningRates);
              curVals = live.vals;
              runningRates = live.rates;
              const liveX = i3 + Math.min((nowMs - dayStart) / 864e5, 1);
              _push(liveX, live.vals, live.rates);
            } else {
              const end = d3.endBreakdown || d3.end;
              if (_hv(end)) curVals = { ...end };
              runningRates = _updRates(d3, runningRates);
            }
          }
        }
        if (labs[6] < todayStr) _push(7, curVals, runningRates);
      } else {
        const yForMonth = year || (/* @__PURE__ */ new Date()).getUTCFullYear();
        const mIdx = CONSTANTS.MONTHS.indexOf(lbl);
        const dim = new Date(yForMonth, mIdx + 1, 0).getDate();
        xp.min = 1;
        xp.max = dim + 1;
        for (let i3 = 1; i3 <= dim; i3++) labs.push(String(i3));
        let _mHasData = hist.length > 0;
        for (let dayNum = 1; dayNum <= dim; dayNum++) {
          const dateStr = Formatter.dateISO(yForMonth, mIdx, dayNum);
          if (dateStr > todayStr) break;
          const d3 = byDate[dateStr];
          if (!d3 && !_mHasData && dateStr !== todayStr) continue;
          if (d3) _mHasData = true;
          _push(dayNum, curVals, runningRates);
          if (dateStr === todayStr) {
            if (!isR) {
              const startV = d3 && (d3.startBreakdown || d3.start);
              if (_hv(startV)) curVals = { ...startV };
            }
            const _dayStart = TimeManager.dayStartTs(dateStr);
            const _frac = Math.min((nowMs - _dayStart) / 864e5, 1);
            const live = _snapAt(nowMs, d3, curVals, runningRates);
            if (_frac > 5e-3) _push(dayNum + _frac, live.vals, live.rates);
            curVals = live.vals;
            runningRates = live.rates;
          } else if (d3) {
            if (isR) runningRates = _updRates(d3, runningRates);
            else {
              const end = d3.endBreakdown || d3.end;
              if (_hv(end)) curVals = { ...end };
            }
          }
        }
        if (Formatter.dateISO(yForMonth, mIdx, dim) < todayStr) _push(dim + 1, curVals, runningRates);
      }
    } else if (vt === "YEAR") {
      labs.push(...CONSTANTS.MONTHS_SHORT);
      const yInt = parseInt(lbl), now = /* @__PURE__ */ new Date(), isCur = yInt === TimeManager.year(now), curM = TimeManager.month(now);
      xp.min = 0;
      xp.max = 12;
      const dl = sl._dailyList.sort((a3, b2) => a3.date.localeCompare(b2.date));
      let baseline = { ...globalBaseline };
      const _preYearDay = hist.find((d3) => {
        const e3 = d3.endBreakdown || d3.end;
        return _hv(e3);
      });
      if (_preYearDay) baseline = { ..._preYearDay.endBreakdown || _preYearDay.end };
      else if (dl.length > 0) {
        const f4 = dl[0].startBreakdown || dl[0].start;
        if (_hv(f4)) baseline = { ...f4 };
      }
      const getStatsAsOf = (dateStr) => {
        const prev = dl.filter((d3) => d3.date < dateStr);
        if (prev.length > 0) {
          const l3 = prev[prev.length - 1];
          return l3.endBreakdown || l3.end || baseline;
        }
        return baseline;
      };
      const getRateAsOf = (dateStr) => {
        const allSer = dl.filter((d3) => d3.date < dateStr).flatMap((d3) => d3.series || []);
        let r4 = { ...sr };
        st.forEach((s3) => {
          for (let j4 = allSer.length - 1; j4 >= 0; j4--) {
            const e3 = allSer[j4];
            if (e3.stat === s3 && e3.cost > 0) {
              r4[s3] = e3.rate;
              break;
            }
          }
        });
        r4.total = st.reduce((a3, s3) => a3 + (r4[s3] || 0), 0);
        return r4;
      };
      const _pushAsOf = (x3, dateStr) => {
        if (isR) {
          const r4 = getRateAsOf(dateStr);
          st.forEach((s3) => tr[s3].push({ x: x3, y: r4[s3] }));
          tr.total.push({ x: x3, y: r4.total });
        } else {
          const v3 = getStatsAsOf(dateStr);
          st.forEach((s3) => tr[s3].push({ x: x3, y: v3[s3] || 0 }));
          tr.total.push({ x: x3, y: (v3.str || 0) + (v3.def || 0) + (v3.spd || 0) + (v3.dex || 0) });
        }
      };
      const firstLogDate = dl.length > 0 ? Formatter.parse(dl[0].date) : null;
      const firstLogMonth = firstLogDate ? firstLogDate.getUTCMonth() : 12;
      const firstLogDay = firstLogDate ? firstLogDate.getUTCDate() : 1;
      const skipFirstStart = firstLogDay > 15;
      const limit = isCur ? curM : 11;
      for (let i3 = firstLogMonth; i3 <= limit; i3++) {
        if (!(i3 === firstLogMonth && skipFirstStart)) _pushAsOf(i3, Formatter.dateISO(yInt, i3, 1));
        const mid15 = new Date(Date.UTC(yInt, i3, 15));
        if (!isCur || mid15.getTime() <= now.getTime()) _pushAsOf(i3 + 0.5, Formatter.dateISO(yInt, i3, 15));
      }
      if (isCur) {
        const curDay = TimeManager.date(now);
        const dim = new Date(yInt, curM + 1, 0).getDate();
        const nowX = curM + (curDay - 1) / dim;
        const isDup = Math.abs(nowX - curM) < 5e-3 || Math.abs(nowX - (curM + 0.5)) < 5e-3;
        if (!isDup) {
          if (isR) {
            let liveRates = { ...sr };
            const allSer = dl.flatMap((d3) => d3.series || []);
            st.forEach((s3) => {
              for (let j4 = allSer.length - 1; j4 >= 0; j4--) {
                const e3 = allSer[j4];
                if (e3.stat === s3 && e3.cost > 0) {
                  liveRates[s3] = e3.rate;
                  break;
                }
              }
            });
            liveRates.total = st.reduce((a3, s3) => a3 + (liveRates[s3] || 0), 0);
            st.forEach((s3) => tr[s3].push({ x: nowX, y: liveRates[s3] }));
            tr.total.push({ x: nowX, y: liveRates.total });
          } else {
            const todayRaw = app.DataController.getDateMap()[Formatter.dateLogical()];
            let liveVals;
            if (todayRaw) {
              const ser = todayRaw.series || [];
              const base = todayRaw.startBreakdown || todayRaw.start || getStatsAsOf(Formatter.dateLogical());
              liveVals = { ...base };
              ser.filter((e3) => e3.ts * 1e3 <= now.getTime()).forEach((e3) => {
                liveVals[e3.stat] = e3.after;
              });
            } else {
              liveVals = getStatsAsOf(Formatter.dateLogical());
              if (dl.length > 0) {
                const last = dl[dl.length - 1];
                const e3 = last.endBreakdown || last.end;
                if (_hv(e3)) liveVals = { ...e3 };
              }
            }
            st.forEach((s3) => tr[s3].push({ x: nowX, y: liveVals[s3] || 0 }));
            tr.total.push({ x: nowX, y: (liveVals.str || 0) + (liveVals.def || 0) + (liveVals.spd || 0) + (liveVals.dex || 0) });
          }
        }
      } else {
        const _yearEndStr = Formatter.dateISO(yInt + 1, 0, 1);
        if (isR) {
          const r4 = getRateAsOf(_yearEndStr);
          st.forEach((s3) => tr[s3].push({ x: 12, y: r4[s3] }));
          tr.total.push({ x: 12, y: r4.total });
        } else {
          const v3 = getStatsAsOf(_yearEndStr);
          st.forEach((s3) => tr[s3].push({ x: 12, y: v3[s3] || 0 }));
          tr.total.push({ x: 12, y: (v3.str || 0) + (v3.def || 0) + (v3.spd || 0) + (v3.dex || 0) });
        }
      }
    } else if (vt === "ALL") {
      const dl = sl._dailyList.sort((a3, b2) => a3.date.localeCompare(b2.date));
      if (dl.length === 0) return { labels: [], trends: tr, viewType: "ALL_TIME", xParams: { min: 0, max: 0 } };
      const now = /* @__PURE__ */ new Date();
      const firstDate = Formatter.parse(dl[0].date);
      const daysElapsed = Math.floor((now.getTime() - firstDate.getTime()) / 864e5);
      if (daysElapsed <= 29) {
        vt = "ALL_TIME";
        xp.min = 0;
        const byDate = {};
        dl.forEach((d3) => byDate[d3.date] = d3);
        const todayStr = Formatter.dateLogical();
        const nowMs = Date.now();
        const ci = 1;
        const tier = "Day-1";
        let runningRates = { ...sr };
        let curVals = { ...globalBaseline };
        if (dl.length > 0) {
          const f4 = dl[0].startBreakdown || dl[0].start;
          if (_hv(f4)) curVals = { ...f4 };
        }
        const _push = (x3, vals, rates) => {
          st.forEach((s3) => tr[s3].push({ x: x3, y: isR ? rates[s3] : vals[s3] || 0 }));
          tr.total.push({ x: x3, y: isR ? rates.total : (vals.str || 0) + (vals.def || 0) + (vals.spd || 0) + (vals.dex || 0) });
        };
        const actualDates = [];
        let lastX = 0;
        for (let i3 = 0; i3 <= daysElapsed; i3++) {
          const dateObj = new Date(firstDate);
          dateObj.setUTCDate(firstDate.getUTCDate() + i3);
          const dateStr = Formatter.dateISO(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate());
          const d3 = byDate[dateStr];
          const isToday2 = dateStr === todayStr;
          if (i3 % ci === 0) {
            const x3 = i3 / ci;
            lastX = x3;
            actualDates.push(dateStr);
            _push(
              x3,
              curVals,
              runningRates
            );
            if (isToday2) {
              if (!isR && d3) {
                const startV = d3.startBreakdown || d3.start;
                if (_hv(startV)) curVals = { ...startV };
              }
              const _dayStart = TimeManager.dayStartTs(dateStr);
              const _frac = Math.min((nowMs - _dayStart) / 864e5, 1);
              const live = _snapAt(nowMs, d3, curVals, runningRates);
              const liveX = (i3 + _frac) / ci;
              if (_frac > 5e-3) _push(liveX, live.vals, live.rates);
              lastX = liveX;
            } else if (d3) {
              if (isR) runningRates = _updRates(d3, runningRates);
              else {
                const end = d3.endBreakdown || d3.end;
                if (_hv(end)) curVals = { ...end };
              }
            }
          } else {
            if (isToday2) {
              const _dayStart = TimeManager.dayStartTs(dateStr);
              const _frac = Math.min((nowMs - _dayStart) / 864e5, 1);
              const live = _snapAt(nowMs, d3, curVals, runningRates);
              const liveX = (i3 + _frac) / ci;
              _push(liveX, live.vals, live.rates);
              lastX = liveX;
            } else if (d3) {
              if (isR) runningRates = _updRates(d3, runningRates);
              else {
                const end = d3.endBreakdown || d3.end;
                if (_hv(end)) curVals = { ...end };
              }
            }
          }
        }
        xp.max = lastX;
        const labelMeta = [];
        const secWidth = 1;
        const totalSections = Math.ceil(xp.max / secWidth);
        for (let k3 = 0; k3 < totalSections; k3++) {
          const left = Math.max(k3 * secWidth, xp.min);
          const right = Math.min((k3 + 1) * secWidth, xp.max);
          if (right <= left) continue;
          const sectionRatio = (right - left) / secWidth;
          const cx = (left + right) / 2;
          if (k3 === 0 && sectionRatio < 0.5) continue;
          const dObj = new Date(firstDate);
          dObj.setUTCDate(firstDate.getUTCDate() + k3 * ci);
          labelMeta.push({ text: String(dObj.getUTCDate()), x: cx });
        }
        return { labels: [], trends: tr, viewType: vt, xParams: xp, anchorDate: firstDate, actualDates, tier, labelMeta };
      } else {
        vt = "ALL_TIME";
        const byDate = {};
        dl.forEach((d3) => byDate[d3.date] = d3);
        const todayStr = Formatter.dateLogical();
        const nowMs = Date.now();
        const originY = firstDate.getUTCFullYear();
        const originM = firstDate.getUTCMonth();
        const originD = firstDate.getUTCDate();
        const nowY = now.getUTCFullYear();
        const nowM = now.getUTCMonth();
        const monthsElapsed = (nowY - originY) * 12 + (nowM - originM);
        let tier, secWidth;
        if (daysElapsed < 60) {
          tier = "Mo-1-2d";
          secWidth = 1;
        } else if (monthsElapsed < 6) {
          tier = "Mo-1-Wk";
          secWidth = 1;
        } else if (monthsElapsed < 12) {
          tier = "Mo-1-Bi";
          secWidth = 1;
        } else if (monthsElapsed < 30) {
          tier = "Yr-Mo";
          secWidth = 12;
        } else if (monthsElapsed < 60) {
          tier = "Yr-Bi";
          secWidth = 12;
        } else {
          tier = "Yr-Semi";
          secWidth = 12;
        }
        let runningRates = { ...sr };
        let curVals = { ...globalBaseline };
        if (dl.length > 0) {
          const f4 = dl[0].startBreakdown || dl[0].start;
          if (_hv(f4)) curVals = { ...f4 };
        }
        const dateToX = (dObj) => {
          const y3 = dObj.getUTCFullYear();
          const m3 = dObj.getUTCMonth();
          const d3 = dObj.getUTCDate();
          const dim = new Date(Date.UTC(y3, m3 + 1, 0)).getUTCDate();
          return (y3 - originY) * 12 + (m3 - originM) + (d3 - 1) / dim;
        };
        const dimOrigin = new Date(Date.UTC(originY, originM + 1, 0)).getUTCDate();
        const originX = (originD - 1) / dimOrigin;
        xp.min = originX;
        const advanceState = (fromIso, toIso) => {
          const logs = dl.filter((d3) => d3.date > fromIso && d3.date <= toIso);
          logs.forEach((d3) => {
            if (isR) runningRates = _updRates(d3, runningRates);
            else {
              const end = d3.endBreakdown || d3.end;
              if (_hv(end)) curVals = { ...end };
            }
          });
        };
        const _push = (x3, vals, rates) => {
          st.forEach((s3) => tr[s3].push({ x: x3, y: isR ? rates[s3] : vals[s3] || 0 }));
          tr.total.push({ x: x3, y: isR ? rates.total : (vals.str || 0) + (vals.def || 0) + (vals.spd || 0) + (vals.dex || 0) });
        };
        const actualDates = [];
        const originIso = Formatter.dateISO(originY, originM, originD);
        actualDates.push(originIso);
        _push(originX, curVals, runningRates);
        const originLog = byDate[originIso];
        if (originLog && originIso !== todayStr) {
          if (isR) runningRates = _updRates(originLog, runningRates);
          else {
            const end = originLog.endBreakdown || originLog.end;
            if (_hv(end)) curVals = { ...end };
          }
        }
        const scheduled = [];
        let tParts = tier.split("-");
        if (tParts[0] === "Mo") {
          let m3 = originM, y3 = originY;
          while (true) {
            let pushDays = [];
            if (tier === "Mo-1-2d") {
              const dim = new Date(Date.UTC(y3, m3 + 1, 0)).getUTCDate();
              for (let i3 = 1; i3 <= dim; i3 += 2) pushDays.push(i3);
            } else if (tier === "Mo-1-Wk") pushDays = [1, 8, 15, 22];
            else if (tier === "Mo-1-Bi") pushDays = [1, 15];
            else pushDays = [1];
            let stop = false;
            pushDays.forEach((day) => {
              const d3 = new Date(Date.UTC(y3, m3, day));
              if (d3 > now) {
                stop = true;
              } else {
                if (d3.getTime() > firstDate.getTime()) scheduled.push({ date: d3, iso: Formatter.dateISO(y3, m3, day) });
              }
            });
            if (stop) break;
            m3++;
            if (m3 > 11) {
              m3 = 0;
              y3++;
            }
          }
        } else {
          let targetMonths = tier === "Yr-Mo" ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] : tier === "Yr-Bi" ? [0, 2, 4, 6, 8, 10] : [0, 6];
          for (let y3 = originY; y3 <= nowY; y3++) {
            targetMonths.forEach((monthIdx) => {
              const d3 = new Date(Date.UTC(y3, monthIdx, 1));
              if (d3 > now) return;
              if (d3.getTime() > firstDate.getTime()) scheduled.push({ date: d3, iso: Formatter.dateISO(
                y3,
                monthIdx,
                1
              ) });
            });
          }
        }
        let prevIso = originIso;
        scheduled.forEach((sd) => {
          advanceState(prevIso, sd.iso);
          actualDates.push(sd.iso);
          _push(dateToX(sd.date), curVals, runningRates);
          const sdLog = byDate[sd.iso];
          if (sdLog && sd.iso !== todayStr) {
            if (isR) runningRates = _updRates(sdLog, runningRates);
            else {
              const end = sdLog.endBreakdown || sdLog.end;
              if (_hv(end)) curVals = { ...end };
            }
          }
          prevIso = sd.iso;
        });
        if (todayStr > prevIso) advanceState(prevIso, todayStr);
        const todayD = byDate[todayStr];
        if (!isR && todayD) {
          const startV = todayD.startBreakdown || todayD.start;
          if (_hv(startV)) curVals = { ...startV };
        }
        const liveSnap = _snapAt(nowMs, todayD, curVals, runningRates);
        const todayDate = Formatter.parse(todayStr);
        const todayDay = todayDate.getUTCDate();
        const todayDim = new Date(Date.UTC(nowY, nowM + 1, 0)).getUTCDate();
        const todayDayStart = TimeManager.dayStartTs(todayStr);
        const intradayFrac = Math.min((nowMs - todayDayStart) / 864e5, 1);
        const liveX = (nowY - originY) * 12 + (nowM - originM) + (todayDay - 1 + intradayFrac) / todayDim;
        const lastDotX = tr.str.length > 0 ? tr.str[tr.str.length - 1].x : -1;
        if (liveX > lastDotX + 1e-3) {
          actualDates.push(todayStr);
          _push(liveX, liveSnap.vals, liveSnap.rates);
        }
        xp.max = Math.max(liveX, originX + 1e-3);
        const labelMeta = [];
        if (tier.startsWith("Yr")) {
          const totalSections = Math.ceil((xp.max + originM) / 12);
          for (let k3 = 0; k3 < totalSections; k3++) {
            const left = Math.max(k3 * 12 - originM, xp.min);
            const right = Math.min((k3 + 1) * 12 - originM, xp.max);
            if (right <= left) continue;
            const sectionRatio = (right - left) / 12;
            const cx = (left + right) / 2;
            if (k3 === 0 && sectionRatio < 0.5) continue;
            labelMeta.push({ text: String(originY + k3), x: cx });
          }
        } else {
          const totalSections = Math.ceil(xp.max / secWidth);
          let isFirstLabel = true;
          for (let k3 = 0; k3 < totalSections; k3++) {
            const left = Math.max(k3 * secWidth, xp.min);
            const right = Math.min((k3 + 1) * secWidth, xp.max);
            if (right <= left) continue;
            const sectionRatio = (right - left) / secWidth;
            const cx = (left + right) / 2;
            const monthsFromOrigin = Math.floor(left);
            const totalM = originM + monthsFromOrigin;
            const m3 = (totalM % 12 + 12) % 12;
            const currentY = originY + Math.floor(totalM / 12);
            if (k3 === 0 && sectionRatio < 0.5) continue;
            let text = CONSTANTS.MONTHS_SHORT[m3];
            if (isFirstLabel || m3 === 0) {
              text += ` '${String(currentY).slice(-2)}`;
            }
            isFirstLabel = false;
            labelMeta.push({ text, x: cx });
          }
        }
        return { labels: labs, trends: tr, viewType: vt, xParams: xp, anchorDate: firstDate, actualDates, tier, labelMeta };
      }
    }
    return { labels: labs, trends: tr, viewType: vt, xParams: xp, selectedMonth: vt === "MONTH" ? CONSTANTS.MONTHS.indexOf(lbl) : null, selectedYear: vt === "MONTH" ? year || (/* @__PURE__ */ new Date()).getUTCFullYear() : null };
  }, _graphTooltipHeader(vt, p3, i3, arr, dat) {
    const hhmm = (d3) => `${String(TimeManager.hours(d3)).padStart(2, "0")}:${String(TimeManager.minutes(d3)).padStart(2, "0")}`;
    const viewingToday = vt === "DAY" && (!calendarState.selectedLabel || calendarState.selectedLabel === Formatter.dateLogical());
    const isLive = i3 === arr.length - 1 && (viewingToday || vt !== "DAY" && p3.x % 1 !== 0);
    const isArchivedEnd = i3 === arr.length - 1 && !isLive;
    if (isLive) return `Today \u2022 ${hhmm(/* @__PURE__ */ new Date())}`;
    if (isArchivedEnd) return "End of Period";
    if (vt === "DAY") {
      const z3 = new Date(p3.x);
      if (viewingToday) return `Today \u2022 ${hhmm(z3)}`;
      return `${CONSTANTS.MONTHS_SHORT[TimeManager.month(z3)]} ${String(TimeManager.date(z3)).padStart(2, "0")} \u2022 ${hhmm(z3)}`;
    }
    if (vt === "WEEK") {
      const ds = dat.labels[Math.floor(p3.x)];
      if (!ds) return "End of Period";
      const d3 = Formatter.parse(ds);
      const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d3.getUTCDay()];
      return `${CONSTANTS.MONTHS_SHORT[d3.getUTCMonth()]} ${d3.getUTCDate()} \u2022 ${dow}`;
    }
    if (vt === "MONTH") {
      const z3 = Math.floor(p3.x);
      const mIdx = dat.selectedMonth != null ? dat.selectedMonth : calendarState.month, year = dat.selectedYear != null ? dat.selectedYear : calendarState.year || (/* @__PURE__ */ new Date()).getUTCFullYear();
      return `${CONSTANTS.MONTHS_SHORT[mIdx]} ${z3} \u2022 ${year}`;
    }
    if (vt === "ALL_TIME") {
      if (dat.actualDates && dat.actualDates[i3]) {
        const dd = Formatter.parse(dat.actualDates[i3]);
        return `${CONSTANTS.MONTHS_SHORT[dd.getUTCMonth()]} ${dd.getUTCDate()} \u2022 ${dd.getUTCFullYear()}`;
      }
      return "Tooltip";
    }
    if (vt === "YEAR") {
      const mIdx = Math.floor(p3.x);
      const mName = CONSTANTS.MONTHS[mIdx] || "December";
      const year = calendarState.year || (/* @__PURE__ */ new Date()).getUTCFullYear();
      return `${mName} \u2022 ${year}`;
    }
    return "Tooltip";
  }, draw() {
    Perf.start("graphDraw");
    if (document.hidden) {
      runtime.graphDirty = true;
      Perf.end("graphDraw");
      return;
    }
    const svg = dom.graphSvg, cont = dom.graphContainer;
    if (!svg || !cont) {
      Perf.end("graphDraw");
      return;
    }
    const dat = GraphController._transformData({
      selectedData: calendarState.selectedData,
      selectedLabel: calendarState.selectedLabel,
      year: calendarState.year,
      graphMode: graphState.mode
    }), tr = dat.trends, lbls = dat.labels, vt = dat.viewType, xp = dat.xParams;
    svg.textContent = "";
    svg.setAttribute("preserveAspectRatio", "none");
    void cont.offsetHeight;
    const _cStyle = window.getComputedStyle(cont);
    const _padH = (parseFloat(_cStyle.paddingLeft) || 0) + (parseFloat(_cStyle.paddingRight) || 0);
    const _padV = (parseFloat(_cStyle.paddingTop) || 0) + (parseFloat(_cStyle.paddingBottom) || 0);
    let w3 = Math.round(cont.clientWidth - _padH);
    if (!(w3 > 0)) w3 = svg.clientWidth || cont.clientWidth;
    const _hudEl = cont.querySelector(".g-hud");
    const _hudH = _hudEl ? Math.ceil(_hudEl.getBoundingClientRect().height) : 28;
    let h3 = (cont.clientHeight > _hudH + _padV ? cont.clientHeight - _hudH - _padV : 0) || svg.clientHeight;
    if (w3 <= 0 || h3 <= 0) {
      Perf.end("graphDraw");
      requestAnimationFrame(() => GraphController.draw());
      return;
    }
    const cmp = w3 < 300;
    const expandedPanel = !!cont.closest("#bbgl-panel.bbgl-expanded:not(.bbgl-mode-page)");
    const isPageMode = !!cont.closest("#bbgl-panel.bbgl-mode-page");
    svg.setAttribute("viewBox", `0 0 ${w3} ${h3}`);
    let _yMin = Infinity, _yMax = -Infinity, _yHas = false;
    graphState.activeStats.forEach((s3) => {
      if (tr[s3] && tr[s3].length > 0) {
        _yHas = true;
        tr[s3].forEach((p3) => {
          if (!isFinite(p3.y)) return;
          if (p3.y < _yMin) _yMin = p3.y;
          if (p3.y > _yMax) _yMax = p3.y;
        });
      }
    });
    if (!_yHas || _yMin === Infinity) {
      _yMin = 0;
      STAT_KEYS.forEach((s3) => {
        if (tr[s3] && tr[s3].length > 0) tr[s3].forEach((p3) => {
          if (isFinite(p3.y) && p3.y > _yMax) _yMax = p3.y;
        });
      });
    }
    if (_yMax === -Infinity) {
      _yMin = 0;
      _yMax = 10;
    }
    let sc = GraphController._calculateNiceScale(_yMin, _yMax), fMin = sc.min, fMax = sc.max, step = sc.step, steps = Math.round((fMax - fMin) / step);
    const pL = [];
    for (let i3 = 0; i3 <= steps; i3++) pL.push(Formatter.axis(fMin + i3 * step));
    const _yMaxStr = pL.reduce((a3, b2) => b2.length > a3.length ? b2 : a3, pL[0] || "10");
    const _yMT = document.createElementNS("http://www.w3.org/2000/svg", "text");
    _yMT.setAttribute("class", "g-text y-label");
    _yMT.style.cssText = "visibility:hidden;pointer-events:none;";
    svg.appendChild(_yMT);
    _yMT.textContent = _yMaxStr;
    const _yFontPx = parseFloat(window.getComputedStyle(_yMT).fontSize) || (expandedPanel || cont.closest(".bbgl-mode-page") ? 11 : cmp ? 9 : 11);
    let _yLW = Math.ceil(_yMaxStr.length * _yFontPx * 0.4);
    const _yCap = Math.max(20, Math.floor(w3 * 0.28) - 5);
    if (_yLW > _yCap) _yLW = _yCap;
    svg.removeChild(_yMT);
    let xLabDrop;
    if (cmp) {
      xLabDrop = 8 + 1;
    } else if (expandedPanel) {
      xLabDrop = 9 + 1;
    } else if (isPageMode) {
      const _xLabT = document.createElementNS("http://www.w3.org/2000/svg", "text");
      _xLabT.setAttribute("class", "g-text x-label");
      _xLabT.style.cssText = "visibility:hidden;pointer-events:none;";
      svg.appendChild(_xLabT);
      const _xLabFontPx = parseFloat(window.getComputedStyle(_xLabT).fontSize) || 10;
      svg.removeChild(_xLabT);
      xLabDrop = 6 + (_xLabFontPx - 8) * 2.5 + 1;
    } else {
      xLabDrop = 11 + 1;
    }
    const _topMar = isPageMode ? 6 : expandedPanel ? 8 : 6;
    let mar = { top: _topMar, bottom: Math.max(2, xLabDrop - 3), left: _yLW + 7, right: 5 };
    const cw = w3 - mar.left - mar.right, ch = h3 - mar.top - mar.bottom;
    if (cw <= 0 || ch <= 0) {
      Perf.end("graphDraw");
      return;
    }
    const bottomAxisGap = expandedPanel ? 2 : isPageMode ? 1 : 0;
    const chPlot = Math.max(16, ch - bottomAxisGap);
    const g4 = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g4.setAttribute("transform", `translate(${mar.left}, ${mar.top})`);
    let fr = fMax - fMin;
    if (fr <= 0) {
      fMax = fMin + 10;
      fr = 10;
    }
    for (let i3 = 0; i3 <= steps; i3++) {
      const v3 = fMin + i3 * step, y3 = chPlot - (v3 - fMin) / fr * chPlot;
      if (isNaN(y3)) continue;
      const l3 = document.createElementNS("http://www.w3.org/2000/svg", "line");
      l3.setAttribute("x1", 0);
      l3.setAttribute("x2", cw);
      l3.setAttribute("y1", y3);
      l3.setAttribute("y2", y3);
      l3.setAttribute("class", "g-axis");
      g4.appendChild(l3);
      const t3 = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t3.setAttribute("x", -6);
      t3.setAttribute("y", expandedPanel ? y3 - 1 : y3 + 3);
      t3.setAttribute("class", "g-text y-label");
      t3.textContent = Formatter.axis(v3);
      g4.appendChild(t3);
    }
    const gx = (v3) => {
      const r4 = xp.max - xp.min;
      return r4 === 0 ? 0 : (v3 - xp.min) / r4 * cw;
    }, gy = (v3) => chPlot - (v3 - fMin) / fr * chPlot;
    (function _drawTicks() {
      const _addTick = (tx) => {
        const tk = document.createElementNS("http://www.w3.org/2000/svg", "line");
        tk.setAttribute("x1", tx);
        tk.setAttribute("x2", tx);
        tk.setAttribute("y1", chPlot);
        tk.setAttribute("y2", chPlot - 5);
        tk.setAttribute(
          "class",
          "g-axis"
        );
        g4.appendChild(tk);
      };
      if (vt === "DAY") {
        for (let i3 = 0; i3 <= 12; i3++) _addTick(gx(xp.min + i3 * 72e5));
      } else if (vt === "ALL_TIME") {
        if (dat.tier && dat.tier.startsWith("Mo")) {
          const sw = 1;
          for (let n2 = Math.ceil(xp.min / sw); n2 * sw <= xp.max + 1e-3; n2++) _addTick(gx(n2 * sw));
        } else if (dat.tier && dat.tier.startsWith("Yr")) {
          const oM = dat.anchorDate ? dat.anchorDate.getUTCMonth() : 0;
          for (let k3 = 1; k3 * 12 - oM <= xp.max + 1e-3; k3++) _addTick(gx(k3 * 12 - oM));
        } else {
          const r4 = xp.max - xp.min;
          for (let i3 = 0; i3 <= r4; i3++) _addTick(gx(xp.min + i3));
        }
      } else {
        const r4 = xp.max - xp.min;
        for (let i3 = 0; i3 <= r4; i3++) _addTick(gx(xp.min + i3));
      }
    })();
    const shouldSkipLbls = cmp && lbls.length >= 6 && !isPageMode;
    const _xr = xp.max - xp.min;
    let _monthPageXFs = null;
    if (vt === "MONTH" && isPageMode && _xr > 0) {
      const _slotPx = cw / _xr;
      _monthPageXFs = Math.round(Math.max(7.25, Math.min(11, _slotPx / 1.35)) * 10) / 10;
    }
    lbls.forEach((l3, i3) => {
      let v3 = 0;
      if (vt === "DAY") v3 = xp.min + i3 * 72e5 + 36e5;
      else if (vt === "YEAR") v3 = i3 + 0.5;
      else if (vt === "MONTH") v3 = i3 + 1.5;
      else if (vt === "WEEK") v3 = i3 + 0.5;
      else if (vt === "ALL_TIME") v3 = i3;
      if (v3 > xp.max) return;
      const x3 = gx(v3);
      if ((vt === "MONTH" || vt === "ALL_TIME") && shouldSkipLbls && i3 % 2 !== 0) return;
      if (vt === "YEAR" && shouldSkipLbls && i3 % 2 === 0) return;
      const t3 = document.createElementNS("http://www.w3.org/2000/svg", "text");
      const yp = chPlot + xLabDrop + 3;
      t3.setAttribute("x", x3);
      t3.setAttribute("y", yp);
      t3.setAttribute("class", "g-text x-label");
      let txt = l3;
      if (vt === "DAY" && cmp) txt = l3.replace(":00", "");
      if (vt === "WEEK") {
        const d3 = Formatter.parse(l3);
        const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const fullDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        txt = cmp ? shortDays[d3.getUTCDay()] : fullDays[d3.getUTCDay()];
      }
      if (vt === "ALL_TIME" && cmp && typeof l3 === "string" && l3.indexOf(" ") !== -1) {
        txt = l3.split(" ")[1];
      }
      t3.textContent = txt;
      t3.setAttribute("text-anchor", "middle");
      if (_monthPageXFs != null && vt === "MONTH") {
        t3.style.fontSize = _monthPageXFs + "px";
        if (_monthPageXFs < 9.5) t3.style.letterSpacing = "0px";
      }
      g4.appendChild(t3);
    });
    if (vt === "ALL_TIME" && dat.labelMeta) {
      const shouldSkipMeta = cmp && dat.labelMeta.length >= 6 && !isPageMode;
      dat.labelMeta.forEach((meta, i3) => {
        if (shouldSkipMeta && i3 % 2 !== 0) return;
        if (meta.x < xp.min || meta.x > xp.max) return;
        const lx = gx(meta.x);
        const lyp = chPlot + xLabDrop + 3;
        const lt = document.createElementNS("http://www.w3.org/2000/svg", "text");
        lt.setAttribute("x", lx);
        lt.setAttribute("y", lyp);
        lt.setAttribute("class", "g-text x-label");
        lt.setAttribute("text-anchor", "middle");
        let txt = meta.text;
        if (cmp && typeof txt === "string" && txt.indexOf(" ") !== -1) {
          txt = txt.split(" ")[0];
        }
        lt.textContent = txt;
        g4.appendChild(lt);
      });
    }
    graphState.activeStats.forEach((s3) => {
      if (!tr[s3] || tr[s3].length === 0) return;
      const arr = tr[s3], sty = arr[0].y, col = s3 === "total" ? CONSTANTS.COLORS.TOT : CONSTANTS.COLORS[s3.toUpperCase()] || "#ffffff";
      let str = sty;
      const vs = arr.find((p4) => p4.y > 0);
      if (vs) str = vs.y;
      let d3 = "", _ps = false;
      arr.forEach((p4) => {
        const x3 = gx(p4.x), y3 = gy(p4.y);
        if (!isFinite(x3) || !isFinite(y3)) {
          _ps = false;
          return;
        }
        if (!_ps) {
          d3 += `M ${x3} ${y3}`;
          _ps = true;
        } else d3 += ` L ${x3} ${y3}`;
      });
      const p3 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p3.setAttribute("d", d3);
      p3.setAttribute("stroke", col);
      p3.setAttribute("class", "g-path");
      p3.setAttribute("vector-effect", "non-scaling-stroke");
      g4.appendChild(p3);
      const dns = vt !== "YEAR" && arr.length > 50;
      arr.forEach((p4, i3) => {
        const x3 = gx(p4.x), y3 = gy(p4.y), grp = document.createElementNS("http://www.w3.org/2000/svg", "g");
        grp.setAttribute("class", "g-point-group");
        grp.setAttribute("data-stat", s3);
        grp.setAttribute("data-cx", x3);
        grp.setAttribute("data-cy", y3);
        const hit = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        hit.setAttribute("cx", x3);
        hit.setAttribute("cy", y3);
        hit.setAttribute("r", 8);
        hit.setAttribute("fill", "transparent");
        grp.appendChild(hit);
        if (!dns || i3 === arr.length - 1) {
          const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          dot.setAttribute("cx", x3);
          dot.setAttribute("cy", y3);
          dot.setAttribute("r", 4);
          dot.setAttribute("fill", col);
          dot.setAttribute("class", "g-point-visual");
          grp.appendChild(dot);
        }
        let stt = s3 === "str" ? "STRENGTH" : s3 === "def" ? "DEFENSE" : s3 === "spd" ? "SPEED" : s3 === "dex" ? "DEXTERITY" : "TOTAL STATS", body = "";
        const tl = GraphController._graphTooltipHeader(vt, p4, i3, arr, dat);
        let prevVal = sty;
        if (vt === "YEAR") {
          if (i3 === 0) prevVal = p4.y;
          else prevVal = arr[i3 - 1].y;
        } else prevVal = sty;
        if (graphState.mode === "rates") {
          const cr = p4.y, dl = cr - str, sg = dl >= 0 ? "+" : "", pc = str > 0 ? dl / str * 100 : 0;
          body = `<div class="tt-row"><span class="tt-label">Rate</span> <span class="tt-total">${cr.toLocaleString(void 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div><div class="tt-row"><span class="tt-label">Growth</span> <span style="color:${dl >= 0 ? CONSTANTS.COLORS.GAINS : "#ff5252"}; font-weight:bold;">${sg}${dl.toFixed(2)} <span style="font-size:10px; opacity:0.8;">(${sg}${pc.toFixed(1)}%)</span></span></div>`;
        } else if (graphState.mode === "gains") body = `<div class="tt-row"><span class="tt-label">Gained</span> <span class="tt-val">+${Formatter.dual(p4.y)}</span></div>`;
        else {
          const cv = p4.y, gv = vt === "YEAR" && i3 === 0 ? 0 : cv - prevVal, gs = gv >= 0 ? "+" : "";
          body = `<div class="tt-row"><span class="tt-label">Total</span> <span class="tt-total">${Formatter.number(cv)}</span></div><div class="tt-row"><span class="tt-label">Gains</span> <span class="tt-val">${gs}${Formatter.number(gv)}</span></div>`;
        }
        grp.setAttribute("data-tooltip-html", `<div class="tt-header" style="border:none; margin-bottom:0; padding-bottom:0;">${tl}</div><div style="text-align:center; font-weight:bold; font-size:10px; color:${col}; margin-bottom:4px; letter-spacing:1px;">${stt}</div><div style="border-bottom:1px solid rgba(255,255,240,0.15); margin-bottom:5px;"></div>${body}`);
        g4.appendChild(grp);
      });
    });
    svg.appendChild(g4);
    GraphController._setupScrubbing(cont, svg, mar);
    Perf.end("graphDraw");
  }, _calculateNiceScale(min, max) {
    if (min === max) return min === 0 ? { min: 0, max: 10, step: 5 } : { min: Math.floor(min * 0.9), max: Math.ceil(max * 1.1), step: (Math.ceil(max * 1.1) - Math.floor(min * 0.9)) / 2 };
    let r4 = max - min, rs = r4 / 4, exp = Math.floor(Math.log10(rs)), base = Math.pow(10, exp), frac = rs / base;
    let nf = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10, step = nf * base;
    const _aM = Math.max(Math.abs(min), Math.abs(max)), _mD = _aM >= 1e12 ? 1e12 : _aM >= 1e9 ? 1e9 : _aM >= 1e6 ? 1e6 : _aM >= 1e3 ? 1e3 : 1;
    if (step < 0.1 * _mD) step = 0.1 * _mD;
    let gMin = Math.floor(min / step) * step, gMax = Math.ceil(max / step) * step;
    if (Math.round((gMax - gMin) / step) + 1 > 5) {
      nf = nf === 1 ? 2 : nf === 2 ? 5 : nf === 5 ? 10 : 2;
      if (nf === 2 && step / base === 10) base *= 10;
      step = nf * base;
      gMin = Math.floor(min / step) * step;
      gMax = Math.ceil(max / step) * step;
    }
    if (gMax - max < (gMax - gMin) * 0.05) gMax += step;
    return { min: Math.max(0, gMin), max: gMax, step };
  }, _setupScrubbing(c3, s3, m3) {
    if (graphState.handlers.scrub) {
      c3.removeEventListener("mousemove", graphState.handlers.scrub);
      c3.removeEventListener("touchmove", graphState.handlers.scrub);
      c3.removeEventListener("mousedown", graphState.handlers.start);
      c3.removeEventListener("touchstart", graphState.handlers.start);
      window.removeEventListener("mouseup", graphState.handlers.end);
      window.removeEventListener("touchend", graphState.handlers.end);
      c3.removeEventListener("mouseleave", graphState.handlers.end);
    }
    const gp = (e3) => {
      const r4 = s3.getBoundingClientRect(), vb = s3.viewBox.baseVal, sx = vb.width / r4.width, sy = vb.height / r4.height;
      let cx = e3.clientX, cy = e3.clientY;
      if (e3.type.includes("touch") && e3.touches.length > 0) {
        cx = e3.touches[0].clientX;
        cy = e3.touches[0].clientY;
      }
      return { x: (cx - r4.left) * sx - m3.left, y: (cy - r4.top) * sy - m3.top };
    };
    const f4 = (x3, y3, st = null) => {
      const sl = st ? `.g-point-group[data-stat="${st}"]` : ".g-point-group", grs = c3.querySelectorAll(sl);
      let min = Infinity, cl = null;
      grs.forEach((g4) => {
        const gx = parseFloat(g4.getAttribute("data-cx")), gy = parseFloat(g4.getAttribute("data-cy")), d3 = Math.sqrt(Math.pow(gx - x3, 2) + (st ? 0 : Math.pow(gy - y3, 2)));
        if (d3 < min) {
          min = d3;
          cl = g4;
        }
      });
      return { g: cl, d: min };
    };
    const uh = (g4) => {
      c3.querySelectorAll(".g-point-group.active").forEach((z3) => z3.classList.remove("active"));
      g4.classList.add("active");
      app.TooltipController.show(g4.getAttribute("data-tooltip-html"), g4.getBoundingClientRect());
    };
    const ch = () => {
      c3.querySelectorAll(".g-point-group.active").forEach((z3) => z3.classList.remove("active"));
      app.TooltipController.hide();
    };
    const os = (e3) => {
      if (e3.type === "touchstart" && e3.target.closest(".g-hud")) return;
      if (e3.type === "touchstart") e3.preventDefault();
      const p3 = gp(e3), cl = f4(p3.x, p3.y);
      if (cl.g && cl.d < 15) {
        graphState.isDragging = true;
        graphState.lockedStat = cl.g.getAttribute("data-stat");
        uh(cl.g);
      }
    };
    const om = (e3) => {
      if (e3.type === "touchmove") e3.preventDefault();
      const p3 = gp(e3);
      if (graphState.isDragging && graphState.lockedStat) {
        const m4 = f4(p3.x, p3.y, graphState.lockedStat);
        if (m4.g) uh(m4.g);
      } else {
        const cl = f4(p3.x, p3.y);
        if (cl.g && cl.d < 30) uh(cl.g);
        else ch();
      }
    };
    const oe = () => {
      graphState.isDragging = false;
      graphState.lockedStat = null;
    };
    graphState.handlers = { start: os, scrub: om, end: oe };
    c3.addEventListener("mousedown", os);
    c3.addEventListener("mousemove", om);
    window.addEventListener("mouseup", oe);
    c3.addEventListener(
      "touchstart",
      os,
      { passive: false }
    );
    c3.addEventListener("touchmove", om, { passive: false });
    window.addEventListener("touchend", oe);
    c3.addEventListener("mouseleave", ch);
  }, setupControls() {
    if (runtime.resizeObserver) runtime.resizeObserver.disconnect();
    runtime.resizeObserver = new ResizeObserver(() => {
      if (dom.topPanel && (dom.topPanel.classList.contains("viewing-graph") || viewState.subView === "graph")) window.requestAnimationFrame(GraphController.draw);
    });
    if (dom.graphContainer) runtime.resizeObserver.observe(dom.graphContainer);
  }, restoreUi() {
    if (typeof app.notifyUi === "function") app.notifyUi();
  }, applyDefaultsIfNeeded() {
    if (viewState.graphStats) return;
    if (historyCache) {
      let lastTrainedWeekStart = null;
      const statsTrainedInThatWeek = /* @__PURE__ */ new Set();
      const daysToCheck = [...historyCache.history || []];
      if (historyCache.today) daysToCheck.push(historyCache.today);
      for (let i3 = daysToCheck.length - 1; i3 >= 0; i3--) {
        const day = daysToCheck[i3];
        const eSpent = day.eSpent || {};
        if (!(eSpent.total > 0)) continue;
        const dayWeekStart = getWeekKey(day.date);
        if (!lastTrainedWeekStart) lastTrainedWeekStart = dayWeekStart;
        if (dayWeekStart === lastTrainedWeekStart) {
          if (eSpent.str > 0) statsTrainedInThatWeek.add("str");
          if (eSpent.def > 0) statsTrainedInThatWeek.add("def");
          if (eSpent.spd > 0) statsTrainedInThatWeek.add("spd");
          if (eSpent.dex > 0) statsTrainedInThatWeek.add("dex");
        } else break;
      }
      if (statsTrainedInThatWeek.size > 0) graphState.activeStats = Array.from(statsTrainedInThatWeek);
    }
    viewState.graphStats = graphState.activeStats;
    graphState.mode = "values";
    viewState.graphMode = "gains";
    saveViewState();
  } };
  app.GraphController = GraphController;

  // src/ui/stickers.js
  function loadStickerData() {
    const unlocked = runtime.demoMode ? 1 : app.DataController.getUnlockedCount() || 1;
    const it = [];
    for (let i3 = 1; i3 <= 50; i3++) {
      const c3 = CUSTOM_STICKERS.find((s3) => s3.id === i3);
      if (c3) it.push({ type: "image", ...c3, unlocked: i3 <= unlocked });
      else it.push(null);
    }
    runtime.stickerData = it;
  }
  function renderStickers() {
    if (!runtime.stickerData.length) loadStickerData();
    if (typeof app.notifyUi === "function") app.notifyUi();
  }
  function animateViewer(ts) {
    if (document.hidden || runtime.currentOpenedItemId === null || viewState.subView !== "stickers" && viewState.subView !== "viewer" && runtime.currentOpenedItemId === null) {
      if (runtime.viewerLoopId) cancelAnimationFrame(runtime.viewerLoopId);
      runtime.viewerLoopId = null;
      return;
    }
    if (!runtime.lastFrameTime) runtime.lastFrameTime = ts;
    const el = ts - runtime.lastFrameTime;
    if (el > 17) {
      runtime.lastFrameTime = ts - el % 17;
      const ped = dom.viPedestal || document.getElementById("vi-pedestal-wrapper");
      const obj = dom.viObj || document.getElementById("vi-obj-target");
      if (ped && obj) {
        runtime.viewerRotation += runtime.viewerSpeed;
        ped.style.transform = `rotateY(${runtime.viewerRotation}deg) translateZ(0)`;
        if (obj.classList.contains("is-image")) {
          const rad = runtime.viewerRotation * Math.PI / 180;
          const br = (0.7 + Math.sin(rad) * 0.3).toFixed(2);
          const isF = Math.cos(rad) > -0.2 ? 1 : 0;
          obj.style.setProperty("--sheen-pos", runtime.viewerRotation * 2.5 + "% 0%");
          obj.style.setProperty("--back-brightness", br);
          obj.style.setProperty("--sheen-opacity", isF);
        }
      }
    }
    runtime.viewerLoopId = requestAnimationFrame(animateViewer);
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && runtime.currentOpenedItemId !== null) {
      if (runtime.viewerLoopId) cancelAnimationFrame(runtime.viewerLoopId);
      animateViewer();
    }
  });
  function applyViewerArt(it) {
    const ob = document.getElementById("vi-obj-target");
    const nm = document.getElementById("vi-name-target");
    if (nm) nm.innerText = it.name;
    if (!ob) return;
    const lf = ob.querySelector(".layer-front");
    const lb = ob.querySelector(".layer-back");
    if (it.type === "image") {
      ob.classList.add("is-image");
      ob.style.setProperty("--bg-mask", `url('${it.url}')`);
      if (lf) lf.style.backgroundImage = `url('${it.url}')`;
      if (lb) {
        lb.style.webkitMaskImage = `url('${it.url}')`;
        lb.style.maskImage = `url('${it.url}')`;
      }
    }
  }
  function bindViewerSpeed() {
    const st = document.querySelector(".viewer-stage");
    if (!st) return;
    const spdUp = () => {
      runtime.viewerSpeed = 3;
    };
    const spdDn = () => {
      runtime.viewerSpeed = 0.3;
    };
    st.onmousedown = spdUp;
    st.ontouchstart = spdUp;
    st.onmouseup = spdDn;
    st.onmouseleave = spdDn;
    st.ontouchend = spdDn;
    st.ontouchcancel = spdDn;
  }
  function openItemViewer(it, sv = true) {
    if (runtime.currentOpenedItemId === it.id) return;
    if (sv) {
      viewState.activeItemId = it.id;
      saveViewState();
    }
    if (app.TooltipController) app.TooltipController.hide();
    runtime.currentOpenedItemId = it.id;
    const v3 = document.getElementById("bbgl-item-viewer");
    const bp = dom.bottomPanel;
    if (bp) bp.style.setProperty("display", "none", "important");
    if (v3) {
      v3.classList.add("active");
      v3.style.setProperty("display", "flex", "important");
    }
    const ped = document.getElementById("vi-pedestal-wrapper");
    if (ped) dom.viPedestal = ped;
    const ob = document.getElementById("vi-obj-target");
    if (ob) dom.viObj = ob;
    applyViewerArt(it);
    runtime.viewerRotation = 0;
    runtime.viewerSpeed = 0.3;
    if (runtime.viewerLoopId) cancelAnimationFrame(runtime.viewerLoopId);
    requestAnimationFrame(animateViewer);
    bindViewerSpeed();
    if (typeof app.notifyUi === "function") app.notifyUi();
  }
  function closeItemViewer(sv = true) {
    if (sv) {
      viewState.activeItemId = null;
      saveViewState();
    }
    runtime.currentOpenedItemId = null;
    if (runtime.viewerLoopId) {
      cancelAnimationFrame(runtime.viewerLoopId);
      runtime.viewerLoopId = null;
    }
    const v3 = document.getElementById("bbgl-item-viewer");
    const bp = dom.bottomPanel;
    if (v3) {
      v3.classList.remove("active");
      v3.style.setProperty("display", "none", "important");
    }
    if (bp) {
      bp.style.removeProperty("display");
      if (getComputedStyle(bp).display === "none") bp.style.display = "flex";
    }
    if (typeof app.notifyUi === "function") app.notifyUi();
  }
  var _sponsorBurstPoints = null;
  function getSponsorBurstPoints() {
    if (_sponsorBurstPoints) return _sponsorBurstPoints;
    const pts = [];
    for (let i3 = 0; i3 < 20; i3++) {
      const angle = (i3 * 18 - 90) * Math.PI / 180;
      const r4 = i3 % 2 === 0 ? 48 : 36;
      const x3 = (50 + r4 * Math.cos(angle)).toFixed(2);
      const y3 = (50 + r4 * Math.sin(angle)).toFixed(2);
      pts.push(`${x3},${y3}`);
    }
    _sponsorBurstPoints = pts.join(" ");
    return _sponsorBurstPoints;
  }
  function changeStickerPage(d3) {
    const apply = () => {
      viewState.currentStickerPage += d3;
      runtime.currentStickerPage = viewState.currentStickerPage;
      saveViewState();
      renderStickers();
    };
    if (!userConfig.animations) {
      apply();
      return;
    }
    const oldActive = runtime.currentStickerPage === -1 ? document.getElementById("bbgl-sponsor-grid") : document.getElementById("bbgl-sticker-grid");
    const bg = document.getElementById("bbgl-sticker-bg");
    if (oldActive) {
      const ghost = oldActive.cloneNode(true);
      ghost.style.pointerEvents = "none";
      ghost.style.position = "absolute";
      ghost.style.top = "0";
      ghost.style.left = "0";
      ghost.style.width = "100%";
      ghost.style.animation = d3 > 0 ? "bbgl-slide-out-l 0.3s ease forwards" : "bbgl-slide-out-r 0.3s ease forwards";
      oldActive.parentElement.appendChild(ghost);
      const removeGhost = () => {
        if (ghost.parentElement) ghost.remove();
      };
      ghost.addEventListener("animationend", removeGhost, { once: true });
      const ghostTimer = setTimeout(removeGhost, 400);
      ghost.addEventListener("animationend", () => clearTimeout(ghostTimer), { once: true });
    }
    if (bg) {
      const bgGhost = bg.cloneNode(true);
      bgGhost.style.pointerEvents = "none";
      bgGhost.style.position = "absolute";
      bgGhost.style.top = "0";
      bgGhost.style.left = "0";
      bgGhost.style.width = "100%";
      bgGhost.style.animation = d3 > 0 ? "bbgl-slide-out-l 0.3s ease forwards" : "bbgl-slide-out-r 0.3s ease forwards";
      bg.parentElement.appendChild(bgGhost);
      const removeBgGhost = () => {
        if (bgGhost.parentElement) bgGhost.remove();
      };
      bgGhost.addEventListener("animationend", removeBgGhost, { once: true });
      const bgGhostTimer = setTimeout(removeBgGhost, 400);
      bgGhost.addEventListener("animationend", () => clearTimeout(bgGhostTimer), { once: true });
    }
    apply();
    const newActive = runtime.currentStickerPage === -1 ? document.getElementById("bbgl-sponsor-grid") : document.getElementById("bbgl-sticker-grid");
    if (newActive) {
      newActive.style.animation = d3 > 0 ? "bbgl-slide-in-r 0.3s ease forwards" : "bbgl-slide-in-l 0.3s ease forwards";
      newActive.addEventListener("animationend", () => {
        newActive.style.animation = "";
      }, { once: true });
    }
    if (bg) {
      bg.style.animation = d3 > 0 ? "bbgl-slide-in-r 0.3s ease forwards" : "bbgl-slide-in-l 0.3s ease forwards";
      bg.addEventListener("animationend", () => {
        bg.style.animation = "";
      }, { once: true });
    }
  }
  function closeDropdown(d3) {
    d3.classList.remove("show");
    d3.style.position = "";
    d3.style.top = "";
    d3.style.left = "";
    d3.style.zIndex = "";
  }
  function openDropdown(d3, trigger) {
    d3.style.position = "fixed";
    d3.style.top = "0px";
    d3.style.left = "0px";
    d3.style.zIndex = "9999999";
    d3.classList.add("show");
    const origin = d3.getBoundingClientRect();
    const r4 = trigger.getBoundingClientRect();
    d3.style.top = r4.bottom - origin.top + 2 + "px";
    d3.style.left = r4.left - origin.left + "px";
  }
  function toggleStickerView() {
    const mp = dom.panel, tb = dom.tallToggle;
    if (!viewState.isTall && mp && !mp.classList.contains("bbgl-mode-page")) {
      viewState.isTall = true;
      mp.classList.add("bbgl-tall");
      if (tb) tb.innerText = "\u2013";
    }
    viewState.activeItemId = 1;
    app.switchView("stickers");
    setTimeout(() => {
      if (!runtime.stickerData.length) loadStickerData();
      const i3 = runtime.stickerData.find((x3) => x3 && x3.id === (viewState.activeItemId || 1));
      if (i3) openItemViewer(i3, true);
    }, 400);
    saveViewState();
  }
  app.loadStickerData = loadStickerData;
  app.renderStickers = renderStickers;
  app.animateViewer = animateViewer;
  app.openItemViewer = openItemViewer;
  app.closeItemViewer = closeItemViewer;
  app.getSponsorBurstPoints = getSponsorBurstPoints;
  app.changeStickerPage = changeStickerPage;
  app.closeDropdown = closeDropdown;
  app.openDropdown = openDropdown;
  app.toggleStickerView = toggleStickerView;

  // src/ui/styles.css
  var styles_default = `
                                                /*============================    ============================*/
                                          /*==================================    ==================================*/
                                      /*======================================    ======================================*/
                                  /*==========================================    ==========================================*/
                                /*============================================================================================*/
                            /*====================================================================================================*/
                         /*==========================================================================================================*/
                      /*================================================================================================================*/
                    /*====================================================================================================================*/
                  /*========================================================================================================================*/
                /*============================================================================================================================*/
               /*==============================================================================================================================*/
              /*================================================================================================================================*/
             /*==================================================================================================================================*/
            /*====================================================================================================================================*/
            /*====================================================================================================================================*/
            /*====================================================================================================================================*/
            /*====================================================================================================================================*/
                    .bbgl-prefs-tab-title { background-image: linear-gradient(rgb(85, 85, 85) 0%, rgb(51, 51, 51) 100%); color: #fff;/*---*/
                    font-family: Arial, sans-serif; font-size: 12px; font-weight: 700; line-height: 30px; padding-left: 10px;/*-----------*/
                    border: 1px solid #111; border-bottom: 1px solid #000; box-shadow: inset 0 1px 0 rgba(255, 255, 255, .1), 0 1px 0 #444;
                    border-radius: 5px 5px 0 0; width: 100%; box-sizing: border-box; margin: 0; z-index: 2; position: relative;/*---------*/
                    display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-right: 46px; }/*----------------*/
                    .bbgl-prefs-tab-title:first-child { margin-top: 0; } .bbgl-tab-title-btn { flex: 0 0 auto; margin: 0; width: 84px;/*--*/
                    height: 18px; line-height: 16px; padding: 0; text-align: center; font-size: 10px; border-radius: 3px;/*---------------*/
                    background-image: linear-gradient(rgb(17, 17, 17) 0%, rgb(85, 85, 85) 25%, rgb(51, 51, 51) 60%, rgb(51, 51, 51) 78%, rgb(17, 17, 17) 100%);
                    color: #eee; font-family: Arial, sans-serif; font-weight: 700; letter-spacing: .3px; text-transform: uppercase;/*-----*/
                    border: 1px solid #111; cursor: pointer; box-sizing: border-box; } .bbgl-tab-title-btn:hover {/*----------------------*/
                    background-image: linear-gradient(rgb(51, 51, 51) 0%, rgb(119, 119, 119) 25%, rgb(51, 51, 51) 59%, rgb(102, 102, 102) 78%, rgb(51, 51, 51) 100%);
                    color: #fff; } .bbgl-tab-title-btn .bbgl-rs-done { color: #43a047; }/*------------------------------------------------*/
                    /* Expanded/page show the longer "RESYNC LOG"/"Syncing..." labels, which don't fit the compact-mode width with comfortable padding \u2014 widen the button rather than let its text crowd the edges. */ .bbgl-expanded .bbgl-tab-title-btn, .bbgl-mode-page .bbgl-tab-title-btn { width: 112px; } .bbgl-btn {
                    background-image: linear-gradient(rgb(17, 17, 17) 0%, rgb(85, 85, 85) 25%, rgb(51, 51, 51) 60%, rgb(51, 51, 51) 78%, rgb(17, 17, 17) 100%);
                    color: #eee; font-family: "Fjalla One", Arial, serif; font-size: 14px; font-weight: 400; line-height: 34px; padding: 0;
                    border: 1px solid #111; border-radius: 5px; width: 100%; height: 34px; cursor: pointer; text-align: center;/*---------*/
                    text-transform: uppercase; box-sizing: border-box; display: block; transition: none; } .bbgl-btn:hover {/*------------*/
                    background-image: linear-gradient(rgb(51, 51, 51) 0%, rgb(119, 119, 119) 25%, rgb(51, 51, 51) 59%, rgb(102, 102, 102) 78%, rgb(51, 51, 51) 100%);
                    color: #fff; } .bbgl-btn:active { background-image: linear-gradient(#000 0%, #333 100%); color: #ddd;/*---------------*/
                    box-shadow: rgba(255, 255, 255, .07) 0 -1px 0 0 inset; border-color: #ddd; } /* Color-variant buttons share one gradient template; each variant only supplies its palette. --btn-c1/c2/c3 = edge/highlight/body, *h = hover palette, --btn-ca = active top stop. */ .bbgl-btn-green {/*------*/
                    --btn-c1: #0e1806; --btn-c2: #3e5e22; --btn-c3: #2b4216; --btn-c1h: #1a2e0b; --btn-c2h: #4f782b; --btn-c3h: #3a591e;
                    --btn-ca: #080f03; } .bbgl-btn-red { --btn-c1: #200505; --btn-c2: #701a1a; --btn-c3: #4f0e0e; --btn-c1h: #360808;/*---*/
                    --btn-c2h: #942222; --btn-c3h: #6e1313; --btn-ca: #140303; } .bbgl-btn-purple { --btn-c1: #1a0529; --btn-c2: #6a1b9a;
                    --btn-c3: #4a1070; --btn-c1h: #2a0840; --btn-c2h: #8e24aa; --btn-c3h: #6a1b9a; --btn-ca: #0f0318; }/*-----------------*/
                    .bbgl-btn-green, .bbgl-btn-red, .bbgl-btn-purple {/*------------------------------------------------------------------*/
                    background-image: linear-gradient(var(--btn-c1) 0%, var(--btn-c2) 25%, var(--btn-c3) 60%, var(--btn-c3) 78%, var(--btn-c1) 100%) !important;
                    border-color: var(--btn-c1) !important; } .bbgl-btn-green:hover, .bbgl-btn-red:hover, .bbgl-btn-purple:hover {/*------*/
                    background-image: linear-gradient(var(--btn-c1h) 0%, var(--btn-c2h) 25%, var(--btn-c3h) 60%, var(--btn-c3h) 78%, var(--btn-c1h) 100%) !important;
                    } .bbgl-btn-green:active, .bbgl-btn-red:active, .bbgl-btn-purple:active {/*-------------------------------------------*/
                    background-image: linear-gradient(var(--btn-ca) 0%, var(--btn-c3) 100%) !important; border-color: #555 !important; }
                    .bbgl-settings-body { background-color: #333; border: 1px solid #111; border-top: none; border-radius: 0 0 5px 5px;/*-*/
                    padding: 4px 0; margin-bottom: 5px; display: flex; flex-direction: column;/*------------------------------------------*/
                    box-shadow: inset 0 3px 5px rgba(0, 0, 0, .2); } .bbgl-setting-row { display: flex; justify-content: space-between;/*-*/
                    align-items: center; padding: 8px 10px; background: 0 0; border-bottom: 1px solid #1a1a1a; box-shadow: 0 1px 0 #484848;
                    font-family: Arial, sans-serif; font-size: 13px; color: #ddd; } .bbgl-setting-row:last-child { border-bottom: none;/*-*/
                    box-shadow: none; } .bbgl-api-container { position: relative; width: 100%; margin-bottom: 8px; } .bbgl-native-input {
                    width: 100%; background: #333; border: 1px solid #555; color: #fff; padding: 8px 30px;/*------------------------------*/
                    font-family: 'Roboto Mono', monospace; font-size: 12px; border-radius: 4px; box-sizing: border-box; } .bbgl-paste-icon {
                    position: absolute; left: 4px; top: 50%; transform: translateY(-50%); cursor: pointer; width: 22px; height: 22px;/*---*/
                    display: flex; align-items: center; justify-content: center; user-select: none; z-index: 15; } .bbgl-paste-icon svg {
                    fill: #888; transition: fill .2s; width: 14px; height: 14px; } .bbgl-paste-icon:hover svg { fill: #fff; }/*-----------*/
                    .bbgl-expanded .bbgl-paste-icon { width: 26px; height: 26px; } .bbgl-expanded .bbgl-paste-icon svg { width: 17px;/*---*/
                    height: 17px; } .bbgl-native-select { background: #333; color: #fff; border: 1px solid #555; padding: 4px 8px;/*------*/
                    border-radius: 4px; font-size: 12px; cursor: pointer; } .bbgl-switch { position: relative; display: inline-block;/*---*/
                    width: 34px; height: 18px; } .bbgl-switch input { opacity: 0; width: 0; height: 0; } .slider { position: absolute;/*--*/
                    cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #444; transition: .4s; border-radius: 34px; }
                    .slider:before { position: absolute; content: ""; height: 12px; width: 12px; left: 3px; bottom: 3px;/*----------------*/
                    background-color: #fff; transition: .4s; border-radius: 50%; } input:checked + .slider {/*----------------------------*/
                    background-color: \${CONSTANTS.COLORS.GAINS}; } input:checked + .slider:before { transform: translateX(16px); } .bbgl-switch-purple {
                    transform: scale(.85); }/*--------------------------------------------------------------------------------------------*/
                    .bbgl-switch-purple input:checked + .slider, #bbgl-settings-view .bbgl-switch input:checked + .slider {/*-------------*/
                    background-color: #6a1b9a; box-shadow: 0 0 5px rgba(106, 27, 154, .6); } .bbgl-bestgym { float: right; display: flex;
                    align-items: center; gap: 5px; height: 24px; line-height: 24px; color: #999; margin-right: 8px; } .bbgl-bestgym-logo {
                    width: 20px; height: 20px; flex-shrink: 0; } .bbgl-bestgym-label { white-space: nowrap; position: relative; top: 1px; }
                    .bbgl-subsetting { padding-left: 26px; } .bbgl-row-disabled { opacity: .45; pointer-events: none; } .bbgl-bestgym-lead {
                    border-bottom: 1px solid rgba(255, 255, 255, .06); box-shadow: none; } .bbgl-subgroup-row { position: relative;/*-----*/
                    padding-left: 24px; } .bbgl-subgroup-row::before { content: ''; position: absolute; left: 10px; top: 0; bottom: 0;/*--*/
                    width: 2px; background: #555; } .bbgl-subgroup-row:not(.bbgl-subgroup-row-last) { border-bottom: none; box-shadow: none;
                    } .bbgl-subgroup-row:not(.bbgl-subgroup-row-last)::after { content: ''; position: absolute; left: 10px; right: 0;/*---*/
                    bottom: 0; height: 1px; background: rgba(255, 255, 255, .06); } .bbgl-btn-grid { display: flex; gap: 0;/*-------------*/
                    margin-bottom: 0; } .bbgl-btn-grid .bbgl-btn { flex: 1; } .bbgl-btn-grid .bbgl-btn:first-of-type {/*------------------*/
                    border-top-right-radius: 0; border-bottom-right-radius: 0; border-bottom-left-radius: 0; border-right: none; }/*------*/
                    .bbgl-btn-grid .bbgl-btn:last-of-type { border-top-left-radius: 0; border-bottom-left-radius: 0;/*--------------------*/
                    border-bottom-right-radius: 0; } .close-settings-btn { position: absolute; background: transparent; border: none;/*---*/
                    color: rgba(80, 200, 120, .7); cursor: pointer; z-index: 200; transition: all .2s; user-select: none; top: 12px;/*----*/
                    right: 12px; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; padding: 0; }/*--*/
                    .close-settings-btn svg { width: 100%; height: 100%; filter: drop-shadow(0 2px 3px rgba(0, 0, 0, .5));/*--------------*/
                    transition: all .2s; } .close-settings-btn:hover { color: #69f0ae; transform: scale(1.1);/*---------------------------*/
                    filter: drop-shadow(0 0 6px rgba(105, 240, 174, .4)); } .bbgl-close-x { color: rgba(220, 80, 80, .7) !important; }/*--*/
                    .bbgl-close-x:hover { color: #ff6b6b !important; filter: drop-shadow(0 0 6px rgba(255, 100, 100, .4)) !important; }/*-*/
                    .bbgl-close-purple { color: rgba(171, 71, 188, .7) !important; } .bbgl-close-purple:hover { color: #ce93d8 !important;
                    filter: drop-shadow(0 0 6px rgba(171, 71, 188, .4)) !important; } .bbgl-expanded .close-settings-btn { top: 12px;/*---*/
                    right: 16px; width: 25px; height: 25px; } .bbgl-settings-body .bbgl-api-container { margin: 8px 10px; width: auto; }
                    .bbgl-settings-body .bbgl-btn-grid { margin: 8px 10px 0; }/*----------------------------------------------------------*/
                    [class*="area-desktop___"][class*="active___"] [class*="defaultIcon___"] svg, [class*="area-mobile___"][class*="active___"] [class*="defaultIcon___"] svg {
                    fill: #fff; stroke: #fff; filter: drop-shadow(0 0 4px rgba(255, 255, 255, .55)); }/*----------------------------------*/
                    .bbgl-sb-notif [class*="desktopLink___"], .bbgl-sb-notif [class*="mobileLink___"] {/*---------------------------------*/
                    background: linear-gradient(to right, rgba(171, 71, 188, .28), rgba(171, 71, 188, .12)) !important; }/*---------------*/
                    .bbgl-sb-notif [class*="defaultIcon___"] svg { fill: #d896e0 !important; stroke: #d896e0 !important;/*----------------*/
                    filter: drop-shadow(0 0 3px rgba(216, 150, 224, .6)) brightness(1.15) !important; }/*---------------------------------*/
                    .bbgl-sb-notif [class*="mobileLink___"] > span:not([class]) { color: #d896e0 !important; } .bbgl-swiper-wr {/*--------*/
                    overflow: visible !important; width: max-content !important; } .bbgl-swiper-cont { overflow: visible !important; }/*--*/
                    #bbgl-page-container { display: flex; flex-direction: column; width: 100%; min-height: calc(100vh - 60px); height: auto;
                    padding: 8px 0; box-sizing: border-box; container-type: inline-size; container-name: bbgl-page; } .bbgl-native-header {
                    display: flex; align-items: center; justify-content: space-between; padding: 0 0 8px; margin-bottom: 15px;/*----------*/
                    border-bottom: 1px solid #444; flex: 0 0 auto; position: relative; } .bbgl-native-header::after { content: "";/*------*/
                    position: absolute; bottom: -1px; left: 0; width: 100%; height: 1px;/*------------------------------------------------*/
                    background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, .3) 50%, transparent 100%); }/*----------------*/
                    .bbgl-native-title { font-family: Arial; font-weight: 700; font-size: 22px; color: #999; text-transform: capitalize;
                    letter-spacing: .1px; display: flex; align-items: center; gap: 10px; margin-left: -7px; padding-left: 0; }/*----------*/
                    .bbgl-native-links { display: flex; gap: 15px; font-size: 18px; color: #999; font-weight: 700; } .bbgl-native-link {
                    display: flex; align-items: center; gap: 5px; cursor: pointer; transition: color .2s; } .bbgl-native-link:hover {/*---*/
                    color: #ccc; } .bbgl-native-link svg { width: 20px; height: 20px; fill: currentColor; }/*-----------------------------*/
                    body.bbgl-page-mode-active #bbgl-page-container .bbgl-native-title {/*------------------------------------------------*/
                    font-size: clamp(21px, calc(21px + 1px * (100cqw - 280px) / 440px), 22px) !important; }/*-----------------------------*/
                    body.bbgl-page-mode-active #bbgl-page-container #bbgl-page-demo-exit .bbgl-demo-x-label {/*---------------------------*/
                    font-size: clamp(16px, calc(16px + 2px * (100cqw - 280px) / 440px), 18px) !important; }/*-----------------------------*/
                    body.bbgl-page-mode-active #bbgl-page-container #bbgl-page-demo-exit svg {/*------------------------------------------*/
                    width: clamp(20px, calc(24px - 4px * (100cqw - 280px) / 440px), 24px) !important;/*-----------------------------------*/
                    height: clamp(20px, calc(24px - 4px * (100cqw - 280px) / 440px), 24px) !important; } #bbgl-panel { --bbgl-f-label: 10px;
                    --bbgl-f-top: 10px; --bbgl-f-bot: 9px; --bbgl-f-top-mb: 1px; --bbgl-bot-minh: 12px; --bbgl-col-gap: 8px;/*------------*/
                    --bbgl-gx: clamp(7px, calc(7px + 5px * var(--bbgl-dock-t, 0)), 12px); --bbgl-label-case: uppercase;/*-----------------*/
                    --bbgl-viewer-title-top-shift: 3px; container-type: inline-size; container-name: bbgl-panel;/*------------------------*/
                    -webkit-text-size-adjust: 100%; text-size-adjust: 100%; position: fixed; bottom: \${LAYOUT.LIFT_HEIGHT}px; right: 10px;/*------*/
                    z-index: 999989; font-family: Arial, sans-serif; display: none; flex-direction: column; background: #2a2a2a;/*--------*/
                    border: 1px solid #444; border-radius: 5px; box-shadow: 0 -2px 4px rgba(0, 0, 0, .35); width: 300px; height: 438.5px;
                    max-height: calc(100vh - 50px) !important; overflow-y: auto; overflow-x: hidden;/*------------------------------------*/
                    transition: width .3s cubic-bezier(.25, 1, .5, 1), height .3s cubic-bezier(.25, 1, .5, 1); } #bbgl-panel.bbgl-expanded {
                    --bbgl-f-label: clamp(12px, calc(12px + 1.5px * var(--bbgl-dock-t)), 13.5px);/*---------------------------------------*/
                    --bbgl-f-top: clamp(12px, calc(12px + 1.5px * var(--bbgl-dock-t)), 13.5px);/*-----------------------------------------*/
                    --bbgl-f-bot: clamp(10px, calc(10px + 1.5px * var(--bbgl-dock-t)), 11.5px); --bbgl-f-top-mb: 3px; --bbgl-bot-minh: 14px;
                    --bbgl-label-case: none; width: min(576px, calc(100vw - 20px)); height: 633px;/*--------------------------------------*/
                    max-height: calc(100vh - 50px) !important; overflow-y: auto; overflow-x: hidden; } #bbgl-panel.bbgl-tall {/*----------*/
                    --bbgl-f-label: 11px; --bbgl-f-top: 11px; --bbgl-f-bot: 10px; --bbgl-col-gap: 13px; }/*-------------------------------*/
                    #bbgl-panel.bbgl-tall.bbgl-expanded { --bbgl-f-label: clamp(13px, calc(13px + 1.5px * var(--bbgl-dock-t)), 14.5px);/*-*/
                    --bbgl-f-top: clamp(13px, calc(13px + 1.5px * var(--bbgl-dock-t)), 14.5px);/*-----------------------------------------*/
                    --bbgl-f-bot: clamp(11px, calc(11px + 1.5px * var(--bbgl-dock-t)), 12.5px); } #bbgl-panel.bbgl-mode-page {/*----------*/
                    position: relative !important; top: 0 !important; left: 0 !important; right: auto !important; bottom: auto;/*---------*/
                    width: 100% !important; flex: none; max-width: none; height: auto !important; max-height: none !important;/*----------*/
                    border: 1px solid #444; border-radius: 5px; box-shadow: 0 10px 30px rgba(0, 0, 0, .5); box-sizing: border-box;/*------*/
                    background: #2a2a2a; display: flex !important; flex-direction: column; gap: 0; z-index: 1 !important;/*---------------*/
                    overflow-x: hidden !important; overflow-y: visible !important; --bbgl-label-case: none !important;/*------------------*/
                    --bbgl-page-t: clamp(0, calc((100cqi - 300px) / 370px), 1);/*---------------------------------------------------------*/
                    --bbgl-f-label: clamp(10.75px, calc(10.75px + 5.25px * var(--bbgl-page-t)), 16px);/*----------------------------------*/
                    --bbgl-f-top: clamp(10.75px, calc(10.75px + 6.25px * var(--bbgl-page-t)), 17px);/*------------------------------------*/
                    --bbgl-f-bot: clamp(9px, calc(9px + 5px * var(--bbgl-page-t)), 14px);/*-----------------------------------------------*/
                    --bbgl-f-top-mb: clamp(2px, calc(2px + 2px * var(--bbgl-page-t)), 4px);/*---------------------------------------------*/
                    --bbgl-bot-minh: clamp(12px, calc(12px + 4px * var(--bbgl-page-t)), 16px);/*------------------------------------------*/
                    --bbgl-col-gap: clamp(6px, calc(6px + 20px * var(--bbgl-page-t)), 26px); }/*------------------------------------------*/
                    #bbgl-panel.bbgl-mode-page .bbgl-weekly-anchor {/*--------------------------------------------------------------------*/
                    --bbgl-track-h: clamp(12px, calc(12px + 3px * var(--bbgl-page-t)), 15px); height: var(--bbgl-track-h); }/*------------*/
                    #bbgl-panel.bbgl-mode-page .bbgl-weekly-track { height: var(--bbgl-track-h); } .bbgl-mode-page .bbgl-header {/*-------*/
                    display: none !important; } .bbgl-mode-page #bbgl-content-wrapper { display: contents !important; }/*-----------------*/
                    #bbgl-panel.bbgl-mode-page #bbgl-top-panel { flex: 0 0 clamp(180px, calc(180px + 90px * var(--bbgl-page-t)), 270px);
                    height: clamp(180px, calc(180px + 90px * var(--bbgl-page-t)), 270px); width: 100%; margin-bottom: 0; border: none;/*--*/
                    border-bottom: 1px solid #444; border-radius: 0; display: flex; flex-direction: column;/*-----------------------------*/
                    padding-top: clamp(2px, calc(2px + 18px * var(--bbgl-page-t)), 20px) !important; overflow: hidden !important;/*-------*/
                    box-shadow: inset 0 0 40px rgba(0, 0, 0, .95); } #bbgl-panel.bbgl-mode-page .bbgl-header-wrapper {/*------------------*/
                    flex: 0 0 clamp(108px, calc(108px + 89px * var(--bbgl-page-t)), 197px); }/*-------------------------------------------*/
                    #bbgl-panel.bbgl-mode-page .bbgl-month-header { padding-left: clamp(14px, calc(14px + 3px * var(--bbgl-page-t)), 17px);
                    padding-right: clamp(16px, calc(16px + 16px * var(--bbgl-page-t)), 32px);/*-------------------------------------------*/
                    gap: clamp(8px, calc(8px + 8px * var(--bbgl-page-t)), 16px);/*--------------------------------------------------------*/
                    margin-bottom: clamp(4px, calc(4px + 4px * var(--bbgl-page-t)), 8px);/*-----------------------------------------------*/
                    padding-bottom: clamp(3px, calc(3px + 3px * var(--bbgl-page-t)), 6px); } .bbgl-mode-page #bbgl-bottom-panel {/*-------*/
                    flex: none !important; width: 100%; border: none; border-radius: 0; background: 0 0; min-height: 0; display: flex;/*--*/
                    flex-direction: column; height: auto; overflow: visible !important; } .bbgl-mode-page #bbgl-settings-view { flex: none;
                    height: auto; } .bbgl-mode-page .bbgl-settings-scroll-area { overflow-y: visible; height: auto; flex: none; }/*-------*/
                    .bbgl-mode-page:has(#bbgl-settings-view.active-view) { flex: none; }/*------------------------------------------------*/
                    .bbgl-mode-page:has(#bbgl-settings-view.active-view) #bbgl-bottom-panel { flex: none; }/*-----------------------------*/
                    #bbgl-panel.bbgl-mode-page .bbgl-grid-container { height: auto; flex: none;/*-----------------------------------------*/
                    padding: 0 clamp(2px, calc(2px + 2px * var(--bbgl-page-t)), 4px) clamp(1px, calc(1px + 3px * var(--bbgl-page-t)), 4px) clamp(2px, calc(2px + 2px * var(--bbgl-page-t)), 4px);
                    overflow: visible !important; } .bbgl-mode-page .calendar-wrapper { height: auto !important; flex: none !important;/*-*/
                    overflow: hidden !important; } .bbgl-mode-page .bbgl-cal-container { height: auto; display: flex;/*-------------------*/
                    flex-direction: column; } .bbgl-mode-page .bbgl-row-slice { flex: none; width: 100%; } .bbgl-mode-page .bbgl-day-cell {
                    aspect-ratio: 1/1; height: auto; width: 100% !important; }/*----------------------------------------------------------*/
                    #bbgl-panel.bbgl-mode-page .ledger-content:not(#bbgl-achievements-container) { height: auto;/*------------------------*/
                    overflow: visible !important; align-content: flex-start; grid-template-rows: 1fr;/*-----------------------------------*/
                    padding-top: clamp(26px, calc(32px - 6px * var(--bbgl-page-t)), 32px) !important;/*-----------------------------------*/
                    padding-bottom: clamp(0px, calc(0px + 15px * var(--bbgl-page-t)), 15px); padding-left: 4px !important;/*--------------*/
                    padding-right: 4px !important; } #bbgl-panel.bbgl-mode-page #bbgl-achievements-container {/*--------------------------*/
                    --bbgl-ach-inset-x: clamp(6px, calc(6px + 4px * var(--bbgl-page-t)), 24px); --bbgl-ach-container-pt: 0;/*-------------*/
                    --bbgl-ach-scroll-pt: clamp(2px, calc(4px - 1px * var(--bbgl-page-t)), 5px);/*----------------------------------------*/
                    --bbgl-ach-scroll-pb: clamp(0px, calc(2px - .5px * var(--bbgl-page-t)), 2px);/*---------------------------------------*/
                    padding-top: var(--bbgl-ach-container-pt) !important; padding-left: var(--bbgl-ach-inset-x) !important;/*-------------*/
                    padding-right: var(--bbgl-ach-inset-x) !important; }/*----------------------------------------------------------------*/
                    #bbgl-panel.bbgl-mode-page #bbgl-ach-footer, #bbgl-panel.bbgl-mode-page .bbgl-ach-footer {/*--------------------------*/
                    --bbgl-ach-footer-gap: clamp(4px, calc(4px + 2px * var(--bbgl-page-t)), 6px);/*---------------------------------------*/
                    --bbgl-ach-dot-gap: clamp(4px, calc(4px + 2px * var(--bbgl-page-t)), 6px);/*------------------------------------------*/
                    --bbgl-ach-dot-w: clamp(5px, calc(5px + 1px * var(--bbgl-page-t)), 6px);/*--------------------------------------------*/
                    --bbgl-ach-nav-fs: clamp(7px, calc(1.45 * var(--bbgl-ach-dot-w)), 11px); --bbgl-ach-nav-py: 0;/*----------------------*/
                    --bbgl-ach-nav-px: clamp(2px, calc(2px + 3px * var(--bbgl-page-t)), 8px);/*-------------------------------------------*/
                    padding: clamp(0px, calc(1px + 1px * var(--bbgl-page-t)), 2px) clamp(6px, calc(6px + 4px * var(--bbgl-page-t)), 24px) 0;
                    } #bbgl-panel.bbgl-mode-page .bbgl-ach-scroll { padding-top: clamp(18px, calc(18px + 1px * var(--bbgl-page-t)), 19px); }
                    #bbgl-panel.bbgl-mode-page #bbgl-ach-pageindicator .pg-dot { width: var(--bbgl-ach-dot-w);/*--------------------------*/
                    height: var(--bbgl-ach-dot-w); }/*------------------------------------------------------------------------------------*/
                    #bbgl-panel.bbgl-mode-page #bbgl-ach-pageindicator, #bbgl-panel.bbgl-mode-page .bbgl-ach-nav {/*----------------------*/
                    transform: translateY(calc(-2px * var(--bbgl-page-t, 0))); }/*--------------------------------------------------------*/
                    #bbgl-panel.bbgl-mode-page .col-header, #bbgl-panel.bbgl-mode-page .col-data-block {/*--------------------------------*/
                    margin-bottom: calc(8px * (1 - var(--bbgl-page-t))); } #bbgl-panel.bbgl-mode-page .day-num {/*------------------------*/
                    --day-num-size: clamp(22px, calc(22px + 14px * var(--bbgl-page-t)), 36px);/*------------------------------------------*/
                    top: clamp(2px, calc(2px + 4px * var(--bbgl-page-t)), 6px); left: clamp(2px, calc(2px + 4px * var(--bbgl-page-t)), 6px);
                    font-size: clamp(10px, calc(10px + 8px * var(--bbgl-page-t)), 18px); }/*----------------------------------------------*/
                    #bbgl-panel.bbgl-mode-page .bbgl-day-cell.is-viewing .day-num {/*-----------------------------------------------------*/
                    --day-num-size: clamp(26px, calc(26px + 14px * var(--bbgl-page-t)), 40px);/*------------------------------------------*/
                    font-size: clamp(14px, calc(14px + 10px * var(--bbgl-page-t)), 24px) !important; }/*----------------------------------*/
                    #bbgl-panel.bbgl-mode-page .ui-floating-label, #bbgl-panel.bbgl-mode-page .ui-floating-summary {/*--------------------*/
                    font-size: clamp(9px, calc(9px + 6px * var(--bbgl-page-t)), 15px);/*--------------------------------------------------*/
                    bottom: clamp(4px, calc(4px + 2px * var(--bbgl-page-t)), 6px); } #bbgl-panel.bbgl-mode-page #bbgl-graph-container {/*-*/
                    padding-top: clamp(12px, calc(19px - 7px * var(--bbgl-page-t)), 19px);/*----------------------------------------------*/
                    padding-bottom: clamp(2px, calc(2px + 2px * var(--bbgl-page-t)), 5px);/*----------------------------------------------*/
                    padding-left: clamp(4px, calc(4px + 5px * var(--bbgl-page-t)), 10px);/*-----------------------------------------------*/
                    padding-right: clamp(4px, calc(4px + 5px * var(--bbgl-page-t)), 10px); } @container bbgl-panel (max-width:499px) {/*--*/
                    #bbgl-panel.bbgl-mode-page .bbgl-header-wrapper, #bbgl-panel.bbgl-mode-page #bbgl-graph-container, #bbgl-panel.bbgl-mode-page #bbgl-cal-container {
                    will-change: transform; } }/*-----------------------------------------------------------------------------------------*/
                    .bbgl-mode-page #bbgl-close-btn, .bbgl-mode-page #bbgl-pop-btn, .bbgl-mode-page #bbgl-tall-toggle {/*-----------------*/
                    display: none !important; }/*-----------------------------------------------------------------------------------------*/
                    .bbgl-mode-page #bbgl-ledger-toggle, .bbgl-mode-page #bbgl-graph-toggle, .bbgl-mode-page #bbgl-achievements-toggle, .bbgl-mode-page #bbgl-sticker-toggle, .bbgl-mode-page #bbgl-copy-btn {
                    opacity: 1 !important; pointer-events: auto !important; } .bbgl-mode-page #bbgl-ledger-toggle { left: 10px !important; }
                    .bbgl-mode-page #bbgl-graph-toggle { left: clamp(34px, calc(34px + 6px * var(--bbgl-page-t)), 40px) !important; }/*---*/
                    .bbgl-mode-page #bbgl-achievements-toggle { left: clamp(58px, calc(58px + 12px * var(--bbgl-page-t)), 70px) !important;
                    } .bbgl-mode-page #bbgl-sticker-toggle { left: clamp(82px, calc(82px + 18px * var(--bbgl-page-t)), 100px) !important; }
                    body.bbgl-page-mode-active { overflow-x: hidden !important; }/*-------------------------------------------------------*/
                    body.bbgl-page-mode-active #graph, body.bbgl-page-mode-active .tt-container.tt-theme-background.collapsible {/*-------*/
                    display: none !important; } #bbgl-gym-tab { background-image: linear-gradient(180deg, #00698c, #003040) !important;/*-*/
                    color: #fff !important; border: .1px solid #002431 !important; border-bottom: none !important;/*----------------------*/
                    border-radius: 5px 5px 0 0 !important;/*------------------------------------------------------------------------------*/
                    box-shadow: rgba(255, 255, 255, .25) 0 0 4px 0 inset, rgba(0, 0, 0, .5) 0 -2px 4px 0 !important; width: 38px !important;
                    height: 38px !important; min-width: 38px !important; max-width: 38px !important; flex: 0 0 38px !important;/*---------*/
                    box-sizing: border-box !important; display: flex !important; align-items: center !important;/*------------------------*/
                    justify-content: center !important; margin: 0 -1px 0 -.4px !important; padding: 0 !important;/*-----------------------*/
                    cursor: pointer !important; position: relative !important; z-index: -10 !important; transform: none !important;/*-----*/
                    pointer-events: auto !important; } #bbgl-gym-tab svg { margin: 0 !important; display: block;/*------------------------*/
                    transition: filter .2s ease; filter: drop-shadow(rgba(0, 0, 0, .8) 0 0 2px); } #bbgl-gym-tab:hover {/*----------------*/
                    background-image: linear-gradient(#0099cc, #004d66) !important; }/*---------------------------------------------------*/
                    #bbgl-gym-tab:hover svg, #bbgl-gym-tab.bbgl-tab-active svg {/*--------------------------------------------------------*/
                    filter: brightness(1.1) drop-shadow(rgba(0, 0, 0, .8) 0 0 2px); } #bbgl-gym-tab.bbgl-tab-active {/*-------------------*/
                    background-image: linear-gradient(to bottom, #001F2B 0%, #003E53 100%) !important;/*----------------------------------*/
                    box-shadow: inset 0 1px 0 0 #1a353f, rgba(0, 0, 0, .5) 0 -2px 4px 0 !important; border: none !important;/*------------*/
                    padding: 1px 1px 0 !important; } #bbgl-gym-tab.bbgl-tab-active:hover {/*----------------------------------------------*/
                    background-image: linear-gradient(180deg, #003040, #00698c) !important; } .bbgl-animate-pop {/*-----------------------*/
                    animation: bbgl-genie-pop .3s cubic-bezier(.2, 1, .3, 1) forwards; } .bbgl-animate-vanish {/*-------------------------*/
                    animation: bbgl-genie-vanish .2s ease-in forwards; pointer-events: none; } @keyframes bbgl-genie-pop { 0% {/*---------*/
                    transform: scale(0); opacity: 0 } 100% { transform: scale(1); opacity: 1 } } @keyframes bbgl-genie-vanish { 0% {/*----*/
                    transform: scale(1); opacity: 1 } 100% { transform: scale(0); opacity: 0 } } .bbgl-header {/*-------------------------*/
                    background-image: linear-gradient(#00698c, #003040); color: #fff; font-family: Arial, sans-serif; font-size: 12px;/*--*/
                    font-weight: 700; padding: 0 8px; border-bottom: 1px solid #000; border-radius: 5px 5px 0 0;/*------------------------*/
                    box-shadow: rgba(255, 255, 255, .25) 0 0 4px 0 inset, rgba(0, 0, 0, .5) 0 -2px 4px 0; width: 100%; height: 38px;/*----*/
                    display: flex; align-items: center; justify-content: space-between; box-sizing: border-box; cursor: pointer;/*--------*/
                    position: relative; z-index: 50; user-select: none; } .bbgl-header:hover {/*------------------------------------------*/
                    background-image: linear-gradient(#0099cc, #004d66); } #bbgl-header-icon { transition: filter .2s;/*------------------*/
                    filter: drop-shadow(rgba(0, 0, 0, .25) 0 0 2px); } .bbgl-header:hover #bbgl-header-icon {/*---------------------------*/
                    filter: brightness(1.1) drop-shadow(rgba(0, 0, 0, .25) 0 0 2px); } .bbgl-header-left { display: flex;/*---------------*/
                    align-items: center; pointer-events: none; } .bbgl-header-text { margin-left: 2px; font-weight: 700; }/*--------------*/
                    .bbgl-short-title { display: inline; } .bbgl-long-title { display: none; } .bbgl-expanded .bbgl-short-title {/*-------*/
                    display: none; } .bbgl-expanded .bbgl-long-title { display: inline; } .bbgl-header-right { display: flex;/*-----------*/
                    align-items: center; } .bbgl-custom-icon { font-size: 22px; color: #c0c0c0; cursor: pointer; margin: 0 6px;/*---------*/
                    font-weight: 700; transition: color .2s; display: inline-flex; align-items: center; justify-content: center;/*--------*/
                    width: 26px; height: 26px; } .bbgl-custom-icon:hover { color: #fff; } #bbgl-close-btn { margin-left: 12px;/*----------*/
                    margin-right: 16px; position: relative; top: -.5px; left: -.5px; } #bbgl-pop-btn { margin-left: 0; position: relative;
                    top: .5px; left: .5px; } #bbgl-pop-btn svg { pointer-events: bounding-box; } .bbgl-native-icon { cursor: pointer;/*---*/
                    opacity: 1; transition: filter .2s; filter: drop-shadow(rgba(0, 0, 0, .25) 0 0 2px); } .bbgl-native-icon:hover {/*----*/
                    filter: brightness(1.1) drop-shadow(rgba(0, 0, 0, .25) 0 0 2px); } #bbgl-tooltip { position: fixed;/*-----------------*/
                    background-color: #464646; color: #ddd; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.5;/*----------*/
                    padding: 6px 8px; border-radius: 5px; box-shadow: none; filter: drop-shadow(0 0 1px rgba(0, 0, 0, .5));/*-------------*/
                    z-index: 1000000; pointer-events: none; display: none; white-space: normal; height: auto; width: -moz-fit-content;/*--*/
                    width: fit-content; max-width: 280px; } #bbgl-tooltip strong { color: #fff; font-weight: 700; } #bbgl-tooltip i {/*---*/
                    display: block; margin-top: 4px; color: #bbb; font-style: italic; font-size: 11px; font-weight: 400; }/*--------------*/
                    #bbgl-tooltip i.bbgl-lvl-tip-title { font-size: 13px; } .tt-header { color: #999; font-weight: 700;/*-----------------*/
                    border-bottom: 1px solid #555; padding-bottom: 4px; margin-bottom: 6px; text-align: center; font-size: 11px;/*--------*/
                    letter-spacing: .5px; } .tt-energy { text-align: center; margin-bottom: 6px; color: #ddd; font-size: 11px;/*----------*/
                    font-weight: 700; } .tt-row { display: flex; justify-content: space-between; align-items: center; gap: 15px;/*--------*/
                    font-size: 11px; margin-bottom: 2px; } .tt-label { color: #ccc; } .tt-val { color: \${CONSTANTS.COLORS.GAINS}; font-weight: 700; }
                    .tt-total { color: #fff; font-weight: 700; } .tt-sub { font-size: 10px; color: #999; } #bbgl-tooltip-arrow {/*--------*/
                    position: absolute; width: 0; height: 0; border: 10px solid transparent; pointer-events: none; z-index: 1000001; }/*--*/
                    #bbgl-tooltip.pos-top #bbgl-tooltip-arrow { border-top-color: #444; bottom: -20px; left: 50%; margin-left: -10px; }/*-*/
                    #bbgl-tooltip.pos-bottom #bbgl-tooltip-arrow { border-bottom-color: #444; top: -20px; left: 50%; margin-left: -10px; }
                    #bbgl-tooltip.pos-left #bbgl-tooltip-arrow { border-left-color: #444; right: -20px; top: 50%; margin-top: -10px; }/*--*/
                    #bbgl-tooltip.pos-right #bbgl-tooltip-arrow { border-right-color: #444; left: -20px; top: 50%; margin-top: -10px; }/*-*/
                    #bbgl-demo-exit { background-color: #4a1070;/*------------------------------------------------------------------------*/
                    background-image: linear-gradient(180deg, #1a0529 0%, #6a1b9a 25%, #4a1070 60%, #4a1070 78%, #1a0529 100%); color: #fff;
                    font-family: "Fjalla One", Arial, sans-serif; font-size: 10px; font-weight: 400; letter-spacing: 1.5px;/*-------------*/
                    text-align: center; padding: 4px 0; cursor: pointer; display: flex; align-items: center; justify-content: center;/*---*/
                    box-shadow: inset 0 1px 0 rgba(255, 255, 255, .12), inset 0 -1px 0 rgba(0, 0, 0, .6); user-select: none; flex-shrink: 0;
                    transition: background-image .2s; border-top: 1px solid #1a0529; border-bottom: 1px solid #111; width: 100%;/*--------*/
                    border-radius: 0; } #bbgl-demo-exit:hover {/*-------------------------------------------------------------------------*/
                    background-image: linear-gradient(180deg, #2a0840 0%, #8e24aa 25%, #6a1b9a 60%, #6a1b9a 78%, #2a0840 100%); }/*-------*/
                    /* Panel mode only: #bbgl-bottom-panel is the scroll container here (see its overflow-y:auto rule below), and #bbgl-demo-exit is its first child, so sticking it to the top of that box keeps it pinned at the boundary with #bbgl-top-panel as the calendar scrolls underneath \u2014 instead of scrolling away with the rest of the header/grid content. In tall mode #bbgl-top-panel's existing negative margin-bottom (z-index:25) overlaps this bar, producing the "hanging off the top panel" look for free. Page mode leaves it static (its #bbgl-bottom-panel doesn't scroll internally there). */ #bbgl-panel:not(.bbgl-mode-page) #bbgl-demo-exit { position: sticky; top: 0; z-index: 22; }/*---------*/
                    #bbgl-demo-exit:active { background-image: linear-gradient(0deg, #8e24aa 0%, #6a1b9a 100%); } .bbgl-demo-x-label {/*--*/
                    display: none; font-size: 12px; font-weight: 700; letter-spacing: 1px; margin-right: 4px; }/*-------------------------*/
                    .bbgl-expanded .bbgl-demo-x-label { display: inline; } #bbgl-page-demo-exit { color: #ab47bc !important; }/*----------*/
                    #bbgl-page-demo-exit:hover { color: #ce93d8 !important; filter: drop-shadow(0 0 4px rgba(171, 71, 188, .3)) !important;
                    } #bbgl-page-demo-exit .bbgl-demo-x-label { display: inline !important; font-size: 18px; } #bbgl-demo-exit-btn {/*----*/
                    position: relative !important; top: auto !important; right: auto !important; } .bbgl-expanded #bbgl-demo-exit-btn {/*-*/
                    width: auto !important; padding: 0 4px; gap: 4px; } #bbgl-content-wrapper { flex: 1; flex-shrink: 0;/*----------------*/
                    background-color: #333; border: .1px solid #444; border-top: none; border-radius: 0 0 5px 5px; display: flex;/*-------*/
                    flex-direction: column; overflow: hidden; position: relative; } #bbgl-top-panel { flex: 0 0 30%; box-sizing: border-box;
                    background-color: #2b2b2b; box-shadow: inset 0 0 40px rgba(0, 0, 0, .95); border-bottom: 1px solid #111;/*------------*/
                    position: relative; overflow: hidden; display: flex; flex-direction: column; padding-top: 2px; padding-bottom: 8px;/*-*/
                    transition: flex-basis .3s, margin-bottom .3s, padding-top .3s; z-index: 25; } .bbgl-tall #bbgl-top-panel {/*---------*/
                    flex: 0 0 40%; margin-bottom: -13.41%; z-index: 25;/*-----------------------------------------------------------------*/
                    box-shadow: 0 5px 15px rgba(0, 0, 0, .5), inset 0 0 40px rgba(0, 0, 0, .95); border-bottom: 1px solid #333;/*---------*/
                    padding-top: 18px; } #bbgl-panel.bbgl-tall.bbgl-compact .ledger-content { padding-top: 8px !important; }/*------------*/
                    .bbgl-expanded #bbgl-top-panel { flex: 0 0 177px; } .bbgl-expanded.bbgl-tall #bbgl-top-panel { flex: 0 0 241px;/*-----*/
                    margin-bottom: -66px; padding-top: 20px; }/*--------------------------------------------------------------------------*/
                    #bbgl-tall-toggle, #bbgl-ledger-toggle, #bbgl-graph-toggle, #bbgl-achievements-toggle, #bbgl-sticker-toggle, #bbgl-copy-btn {
                    position: absolute; color: rgba(255, 255, 255, .55); cursor: pointer; z-index: 60; user-select: none;/*---------------*/
                    transition: all .2s; line-height: 1; display: flex; align-items: center; justify-content: center; }/*-----------------*/
                    #bbgl-tall-toggle:hover, #bbgl-ledger-toggle:hover, #bbgl-graph-toggle:hover, #bbgl-achievements-toggle:hover, #bbgl-sticker-toggle:hover, #bbgl-copy-btn:hover {
                    color: rgba(255, 255, 255, 1); } #bbgl-tall-toggle { top: 3px; left: 3px; font-size: 15px; font-weight: 700;/*--------*/
                    width: 19px; height: 19px; }/*----------------------------------------------------------------------------------------*/
                    #bbgl-ledger-toggle, #bbgl-graph-toggle, #bbgl-achievements-toggle, #bbgl-sticker-toggle, #bbgl-copy-btn { top: 5.5px;
                    z-index: 59; opacity: 0; pointer-events: none;/*----------------------------------------------------------------------*/
                    transition: opacity .3s cubic-bezier(.25, .8, .25, 1), color .15s, filter .15s, transform .15s; }/*-------------------*/
                    #bbgl-ledger-toggle svg, #bbgl-graph-toggle svg, #bbgl-achievements-toggle svg, #bbgl-sticker-toggle svg, #bbgl-copy-btn svg {
                    fill: currentColor; } #bbgl-graph-toggle, #bbgl-graph-toggle svg, #bbgl-sticker-toggle, #bbgl-sticker-toggle svg {/*--*/
                    width: 14px; height: 14px; }/*----------------------------------------------------------------------------------------*/
                    #bbgl-ledger-toggle, #bbgl-ledger-toggle svg, #bbgl-achievements-toggle, #bbgl-achievements-toggle svg, #bbgl-copy-btn, #bbgl-copy-btn svg {
                    width: 13.5px; height: 13.5px; }/*------------------------------------------------------------------------------------*/
                    .viewing-graph #bbgl-graph-toggle, .viewing-achievements #bbgl-achievements-toggle, .viewing-stickers #bbgl-sticker-toggle {
                    color: #fff !important; filter: drop-shadow(0 0 5px rgba(255, 255, 255, .7)); transform: scale(1.15); }/*-------------*/
                    #bbgl-top-panel:not(.viewing-graph):not(.viewing-stickers):not(.viewing-achievements) #bbgl-ledger-toggle {/*---------*/
                    color: #fff !important; filter: drop-shadow(0 0 5px rgba(255, 255, 255, .7)); transform: scale(1.15); }/*-------------*/
                    .bbgl-tall #bbgl-ledger-toggle { left: 32px; opacity: 1; pointer-events: auto; } .bbgl-tall #bbgl-graph-toggle {/*----*/
                    left: 57px; opacity: 1; pointer-events: auto; } .bbgl-tall #bbgl-achievements-toggle { left: 82px; opacity: 1;/*------*/
                    pointer-events: auto; } .bbgl-tall #bbgl-sticker-toggle { left: 107px; opacity: 1; pointer-events: auto; }/*----------*/
                    .bbgl-tall #bbgl-copy-btn { right: 8px; opacity: 1; pointer-events: auto; transform: scale(1.15); }/*-----------------*/
                    .bbgl-expanded #bbgl-tall-toggle { top: 3px; left: 3px; font-size: 15px; width: 19px; height: 19px; }/*---------------*/
                    .bbgl-expanded.bbgl-tall #bbgl-ledger-toggle { width: 15.5px; height: 15.5px; left: 32px; }/*-------------------------*/
                    .bbgl-expanded.bbgl-tall #bbgl-graph-toggle { width: 16px; height: 15px;/*--------------------------------------------*/
                    left: clamp(56px, calc(56px + 4px * var(--bbgl-dock-t)), 60px); } .bbgl-expanded.bbgl-tall #bbgl-achievements-toggle {
                    width: 15.5px; height: 15.5px; left: clamp(80px, calc(80px + 8px * var(--bbgl-dock-t)), 88px); }/*--------------------*/
                    .bbgl-expanded.bbgl-tall #bbgl-sticker-toggle { width: 16px; height: 15px;/*------------------------------------------*/
                    left: clamp(104px, calc(104px + 12px * var(--bbgl-dock-t)), 116px); } .bbgl-expanded.bbgl-tall #bbgl-copy-btn {/*-----*/
                    width: 15.5px; height: 15.5px; right: 10px; }/*-----------------------------------------------------------------------*/
                    #bbgl-panel.bbgl-mode-page #bbgl-ledger-toggle, #bbgl-panel.bbgl-mode-page #bbgl-graph-toggle, #bbgl-panel.bbgl-mode-page #bbgl-achievements-toggle, #bbgl-panel.bbgl-mode-page #bbgl-sticker-toggle, #bbgl-panel.bbgl-mode-page #bbgl-copy-btn {
                    width: clamp(14.5px, calc(14.5px + 3.5px * var(--bbgl-page-t)), 18px);/*----------------------------------------------*/
                    height: clamp(14.5px, calc(14.5px + 3.5px * var(--bbgl-page-t)), 18px);/*---------------------------------------------*/
                    top: clamp(4.5px, calc(4.5px + 5.5px * var(--bbgl-page-t)), 10px); } #bbgl-panel.bbgl-mode-page #bbgl-ledger-toggle {
                    left: 32px; } #bbgl-panel.bbgl-mode-page #bbgl-graph-toggle { left: 62px; }/*-----------------------------------------*/
                    #bbgl-panel.bbgl-mode-page #bbgl-achievements-toggle { left: 92px; } #bbgl-panel.bbgl-mode-page #bbgl-sticker-toggle {
                    left: 122px; } #bbgl-panel.bbgl-mode-page #bbgl-copy-btn { right: 12px; }/*-------------------------------------------*/
                    .bbgl-expanded #bbgl-ledger-toggle svg, .bbgl-expanded #bbgl-graph-toggle svg, .bbgl-expanded #bbgl-achievements-toggle svg, .bbgl-expanded #bbgl-sticker-toggle svg, .bbgl-expanded #bbgl-copy-btn svg, .bbgl-mode-page #bbgl-ledger-toggle svg, .bbgl-mode-page #bbgl-graph-toggle svg, .bbgl-mode-page #bbgl-achievements-toggle svg, .bbgl-mode-page #bbgl-sticker-toggle svg, .bbgl-mode-page #bbgl-copy-btn svg {
                    width: 100% !important; height: 100% !important; } #bbgl-top-panel::after { content: ""; position: absolute; top: 0;
                    left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10;/*----------------------------------------------*/
                    box-shadow: inset 1px 1px 1px rgba(255, 255, 255, .2), inset -1px -1px 2px rgba(0, 0, 0, .6);/*-----------------------*/
                    background: radial-gradient(circle at center, rgba(0, 0, 0, 0) 20%, rgba(0, 0, 0, .5) 100%), repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, .1) 2px, rgba(0, 0, 0, .1) 4px);
                    } .glass-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%;/*----------------------------------*/
                    background-image: url('__ASSETS_GLASS_OVERLAY__'); background-size: 100% 100%; background-position: center; opacity: .5;/*-------*/
                    pointer-events: none; mix-blend-mode: screen; z-index: 11; border-radius: inherit; }/*--------------------------------*/
                    .ui-floating-label, .ui-floating-summary { position: absolute; bottom: 3px; font-size: 10px; font-weight: 400;/*------*/
                    pointer-events: none; z-index: 50; transition: font-size .3s; } .ui-floating-label { left: 8px;/*---------------------*/
                    color: rgba(255, 255, 255, .4); letter-spacing: .5px; } .ui-floating-summary { right: 8px;/*--------------------------*/
                    color: rgba(255, 255, 255, .4); letter-spacing: .3px; text-align: right; }/*------------------------------------------*/
                    .bbgl-expanded .ui-floating-label, .bbgl-expanded .ui-floating-summary { bottom: 4px; }/*-----------------------------*/
                    .viewing-graph .ui-floating-label, .viewing-graph .ui-floating-summary, .viewing-achievements .ui-floating-label, .viewing-achievements .ui-floating-summary {
                    opacity: 0; } .viewing-stickers .ui-floating-label, .viewing-stickers .ui-floating-summary { display: none; }/*-------*/
                    #bbgl-top-panel.viewing-stickers { box-shadow: none !important; border-bottom: none !important;/*---------------------*/
                    background-color: transparent; padding-bottom: 2px; }/*---------------------------------------------------------------*/
                    #bbgl-top-panel.viewing-stickers::after, #bbgl-top-panel.viewing-stickers .glass-overlay { display: none !important; }
                    #bbgl-top-panel.viewing-achievements { border-bottom: none !important; } #bbgl-top-panel.viewing-achievements::after {
                    box-shadow: inset 1px 1px 1px rgba(255, 255, 255, .2) !important; } .ledger-content { position: relative; flex: 1;/*--*/
                    overflow-y: auto; overflow-x: hidden; padding: 4px 2px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 0;
                    transition: opacity .3s; transform-origin: center; }/*----------------------------------------------------------------*/
                    .viewing-graph #bbgl-ledger-view, .viewing-stickers #bbgl-ledger-view, .viewing-achievements #bbgl-ledger-view {/*----*/
                    display: none !important; } .bbgl-expanded .ledger-content { grid-template-columns: repeat(4, 1fr);/*-----------------*/
                    grid-template-rows: minmax(0, 1fr); padding-top: 6px; padding-bottom: 14px; }/*---------------------------------------*/
                    #bbgl-panel.bbgl-tall.bbgl-expanded .ledger-content { padding-top: 12px; }/*------------------------------------------*/
                    /* Achievements diverges from the ledger's top padding, landing at a flat 3px top in both modes, and gets +5px of side padding on top of the inherited 2px (both modes). */ #bbgl-panel.bbgl-tall.bbgl-expanded #bbgl-achievements-container { padding-top: 3px; }/*--------------*/
                    #bbgl-panel.bbgl-tall.bbgl-compact #bbgl-achievements-container { padding-top: 3px !important; }/*--------------------*/
                    #bbgl-achievements-container { padding-left: 7px; padding-right: 7px; } .stat-column { display: flex;/*---------------*/
                    flex-direction: column; align-items: center; justify-content: flex-start; height: 100%;/*-----------------------------*/
                    border-right: 1px solid rgba(255, 255, 255, .05); padding: 0 2px; min-height: 0; --bbgl-f-top-mb: 0; --bbgl-bot-minh: 0;
                    } .stat-column:last-child { border-right: none; } .stat-column .cell-stack { gap: clamp(0px, 1px + .12cqb, 3px); }/*--*/
                    .stat-column .l-bot { align-items: flex-start; } .col-header, .col-data-block { margin-bottom: 0; flex-shrink: 0;/*---*/
                    text-align: center; width: 100%; display: flex; flex-direction: column; align-items: center; } .bbgl-spacer {/*-------*/
                    flex: 1 1 var(--bbgl-col-gap); max-height: var(--bbgl-col-gap); min-height: 0; width: 100%;/*-------------------------*/
                    transition: max-height .3s, flex-basis .3s; } .cell-stack { display: flex; flex-direction: column; align-items: center;
                    justify-content: flex-start; line-height: 1.2; } .view-std { display: inline; } .view-exp { display: none; }/*--------*/
                    .bbgl-expanded .view-std, .bbgl-mode-page .view-std { display: none; }/*----------------------------------------------*/
                    .bbgl-expanded .view-exp, .bbgl-mode-page .view-exp { display: inline; }/*--------------------------------------------*/
                    .bbgl-expanded .rates-group, .bbgl-mode-page .rates-group { margin-top: 2px; margin-bottom: -2px; }/*-----------------*/
                    @media (max-width: 375px) { .ui-floating-label .view-exp, .ui-floating-summary .view-exp { display: none !important; }
                    .ui-floating-label .view-std, .ui-floating-summary .view-std { display: inline !important; } }/*----------------------*/
                    @media (max-width: 450px) { #bbgl-item-counters .bbgl-ic-dyn { display: none !important; } } .rate-pct {/*------------*/
                    display: none !important; } .bbgl-mode-page .rate-pct, .bbgl-expanded.bbgl-tall .rate-pct { display: inline !important;
                    } .l-top { font-size: var(--bbgl-f-top); font-weight: 550; color: #ddd; margin-bottom: var(--bbgl-f-top-mb);/*--------*/
                    display: flex; align-items: center; justify-content: center; white-space: nowrap; letter-spacing: -.5px;/*------------*/
                    transition: font-size .3s; } .l-bot { font-size: var(--bbgl-f-bot); color: #ddd; min-height: var(--bbgl-bot-minh);/*--*/
                    height: auto; display: flex; align-items: center; justify-content: center; white-space: nowrap;/*---------------------*/
                    transition: font-size .3s; } .c-label { font-weight: 700; font-family: 'Arial', sans-serif;/*-------------------------*/
                    font-size: var(--bbgl-f-label); text-transform: var(--bbgl-label-case); letter-spacing: 0; transition: font-size .3s; }
                    .c-gain .l-top { color: \${CONSTANTS.COLORS.GAINS}; font-weight: 550; } .c-gain .l-bot { color: #bbb; font-style: normal; }/*------*/
                    .c-total .l-top { color: #fff; } .c-total .l-bot { color: #bbb; } .t-str { color: \${CONSTANTS.COLORS.STR}; } .t-def {/*---------*/
                    color: \${CONSTANTS.COLORS.DEF}; } .t-spd { color: \${CONSTANTS.COLORS.SPD}; } .t-dex { color: \${CONSTANTS.COLORS.DEX}; } .t-tot { color: \${CONSTANTS.COLORS.TOT};
                    } #bbgl-graph-container, #bbgl-achievements-container { display: none; flex: 1; flex-direction: column;/*-------------*/
                    position: relative; z-index: 20; }/*----------------------------------------------------------------------------------*/
                    .viewing-graph #bbgl-graph-container, .viewing-achievements #bbgl-achievements-container { display: flex; }/*---------*/
                    .viewing-graph #bbgl-graph-container {/*------------------------------------------------------------------------------*/
                    padding: 3px calc(var(--bbgl-gx, 10px) - 2px) 1px calc(var(--bbgl-gx, 10px) - 2px); z-index: 40;/*--------------------*/
                    transform-origin: center; touch-action: none; cursor: crosshair; min-height: 0; overflow: visible; }/*----------------*/
                    .viewing-achievements #bbgl-achievements-container.ledger-content { grid-template-columns: unset;/*-------------------*/
                    grid-template-rows: unset !important; gap: 0; min-height: 0 !important; overflow: hidden !important;/*----------------*/
                    display: flex !important; flex-direction: column !important; flex: 1 !important; } .g-hud { display: flex;/*----------*/
                    flex-direction: row; flex-wrap: nowrap; justify-content: space-between; align-items: center; margin-bottom: 2px;/*----*/
                    z-index: 60; position: relative; min-width: 0; width: 100%; box-sizing: border-box; } .g-toggles { display: flex;/*---*/
                    flex-direction: row; flex-wrap: nowrap; gap: 2px; align-items: center; min-width: 0; flex: 0 1 auto; } .g-pill {/*----*/
                    display: inline-flex; align-items: center; justify-content: center; font-size: 8.5px; padding: .5px 5px;/*------------*/
                    border: 1px solid #444; border-radius: 3px; color: #666; cursor: pointer; text-transform: uppercase; font-weight: 700;
                    align-self: center; background: #1a1a1a; transition: color .2s, background .2s, border-color .2s; user-select: none;
                    white-space: nowrap; line-height: 1; vertical-align: middle; } .g-pill:hover { color: #ccc; border-color: #666; }/*---*/
                    .g-pill.active { color: var(--pill-c, #fff); background: var(--pill-bg, #333); border-color: var(--pill-c, #888); }/*-*/
                    .g-pill.p-str { --pill-c: \${CONSTANTS.COLORS.STR}; --pill-bg: rgba(50, 100, 198, .1); } .g-pill.p-def { --pill-c: \${CONSTANTS.COLORS.DEF};
                    --pill-bg: rgba(220, 57, 18, .1); } .g-pill.p-spd { --pill-c: \${CONSTANTS.COLORS.SPD}; --pill-bg: rgba(255, 153, 0, .1); }/*---*/
                    .g-pill.p-dex { --pill-c: \${CONSTANTS.COLORS.DEX}; --pill-bg: rgba(16, 150, 24, .1); } .g-pill.p-tot { --pill-c: \${CONSTANTS.COLORS.TOT};
                    --pill-bg: rgba(255, 255, 255, .1); } #bbgl-panel.bbgl-compact .g-hud { margin-top: 1px; }/*--------------------------*/
                    #bbgl-panel.bbgl-compact #bbgl-graph-container .g-pill { font-size: 8px; padding: 2px 5px; line-height: 1;/*----------*/
                    display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; } #bbgl-graph-svg {/*-----*/
                    width: 100%; flex: 1; min-height: 0; overflow: visible; pointer-events: none; display: block; } .g-axis {/*-----------*/
                    stroke: rgba(255, 255, 255, .1); stroke-width: 1; } .g-path { fill: none; stroke-width: 2;/*--------------------------*/
                    vector-effect: non-scaling-stroke; stroke-linecap: round; transition: d .3s ease; } .g-text {/*-----------------------*/
                    fill: rgba(255, 255, 255, .4); font-size: 9px; font-family: 'Roboto Mono', monospace; user-select: none; }/*----------*/
                    .g-text.x-label { text-anchor: middle; font-family: 'Fjalla One', sans-serif; font-size: 11px; letter-spacing: .5px; }
                    #bbgl-panel.bbgl-compact .g-text.x-label { font-size: 10px; } .g-text.y-label { text-anchor: end;/*-------------------*/
                    font-family: 'Barlow Condensed', 'Arial Narrow', 'Nimbus Sans Narrow', Tahoma, sans-serif; font-weight: 500;/*--------*/
                    letter-spacing: .005em; } .g-point-group .g-point-visual { opacity: 0; transition: opacity .1s; stroke-width: 1.5;/*--*/
                    pointer-events: none; } .g-point-group.active .g-point-visual { opacity: 1; } #bbgl-sticker-bg { position: absolute;
                    top: 0; left: 0; width: 100%; height: 100%; background-image: url('__ASSETS_STICKER_BG__'); background-size: cover;/*--------*/
                    background-position: center; z-index: 5; opacity: 0; transition: opacity .3s; pointer-events: none; }/*---------------*/
                    .viewing-stickers #bbgl-sticker-bg { opacity: .9; } #bbgl-sticker-container { display: none; flex: 1;/*---------------*/
                    flex-direction: column; position: relative; padding: 4px; z-index: 40; transform-origin: center; overflow: hidden;/*--*/
                    justify-content: flex-start; } .sticker-nav-btn { position: absolute; top: 50%; transform: translateY(-60%);/*--------*/
                    width: 20px; height: 25px; background: 0 0; color: #fff; display: flex; align-items: center; justify-content: center;
                    cursor: pointer; z-index: 90; font-size: 24px; font-weight: 700; transition: transform .2s, text-shadow .2s;/*--------*/
                    user-select: none; line-height: 1; text-shadow: 0 1px 3px #000; } @media (hover: hover) { .sticker-nav-btn:hover {/*--*/
                    color: #fff; transform: translateY(-50%) scale(1.3); text-shadow: 0 0 8px rgba(255, 255, 255, .8); filter: none; } }
                    .sticker-nav-btn:active { color: #fff; transform: translateY(-50%) scale(1.3);/*--------------------------------------*/
                    text-shadow: 0 0 8px rgba(255, 255, 255, .8); filter: none; } .sticker-nav-btn.disabled { opacity: 0;/*---------------*/
                    pointer-events: none; } #sticker-prev-btn { left: 0; border-radius: 0 5px 5px 0; } #sticker-next-btn { right: 0;/*----*/
                    border-radius: 5px 0 0 5px; } .viewing-stickers #bbgl-sticker-container { display: flex; } #bbgl-sticker-grid {/*-----*/
                    position: relative; display: grid; grid-template-columns: repeat(5, 1fr); grid-template-rows: auto auto; width: 100%;
                    flex: 1; align-content: start; padding-top: 0; row-gap: 0; } .sticker-slot { display: flex; align-items: center;/*----*/
                    justify-content: center; position: relative; overflow: visible; padding: 0; height: 64px; visibility: hidden; }/*-----*/
                    .sticker-slot.active-slot { visibility: visible; } #bbgl-panel.bbgl-mode-page .sticker-slot {/*-----------------------*/
                    height: clamp(65px, calc(65px + 40px * var(--bbgl-page-t)), 105px); } #bbgl-panel.bbgl-mode-page #bbgl-sticker-grid {
                    row-gap: clamp(10px, calc(10px + 6px * var(--bbgl-page-t)), 16px);/*--------------------------------------------------*/
                    padding-top: clamp(5px, calc(5px + 9px * (1 - var(--bbgl-page-t))), 14px);/*------------------------------------------*/
                    column-gap: clamp(1px, calc(35px - 5.3cqi - 7px * (1 - var(--bbgl-page-t))), 22px); } .sticker-slot.has-item:hover {
                    cursor: pointer; z-index: 45; } .sticker-img { height: 80%; width: auto; max-width: 140%; object-fit: contain;/*------*/
                    pointer-events: none; user-select: none; -webkit-user-drag: none; transition: transform .2s, filter 0s;/*-------------*/
                    filter: drop-shadow(0 -.5px 0 rgba(0, 0, 0, .3)) drop-shadow(0 .5px 0 rgba(255, 255, 255, .4)); }/*-------------------*/
                    .sticker-slot.locked .sticker-img {/*---------------------------------------------------------------------------------*/
                    filter: brightness(0) invert(1) drop-shadow(0 -.5px 0 rgba(0, 0, 0, .2)) drop-shadow(0 .5px 0 rgba(255, 255, 255, .2));
                    opacity: .9; } .bbgl-expanded .sticker-img, .bbgl-mode-page .sticker-img { height: 100%; max-width: 100%; }/*---------*/
                    .bbgl-expanded .sticker-slot.locked .sticker-img, .bbgl-mode-page .sticker-slot.locked .sticker-img { height: 90%;/*--*/
                    width: 100%; } #bbgl-sticker-pagination { position: absolute; bottom: 4px; width: 100%; left: 0; display: flex;/*-----*/
                    align-items: center; justify-content: center; gap: 6px; height: 12px; z-index: 100; } .pg-dot { width: 6px; height: 6px;
                    border-radius: 50%; background: rgba(255, 255, 255, .25); cursor: pointer; transition: all .2s; } .pg-dot.active {/*--*/
                    background: #fff; transform: scale(1.2); box-shadow: 0 0 5px rgba(255, 255, 255, .5); } #bbgl-sticker-title {/*-------*/
                    display: none; position: absolute; top: 7px; right: 10px; font-size: 12px; color: #333;/*-----------------------------*/
                    font-family: 'Fjalla One', sans-serif; letter-spacing: .2px; z-index: 99; pointer-events: none;/*---------------------*/
                    mix-blend-mode: multiply; text-align: right; } .viewing-stickers #bbgl-sticker-title { display: block; }/*------------*/
                    .bbgl-expanded #bbgl-sticker-title { font-size: clamp(13px, calc(13px + 2px * var(--bbgl-dock-t, 0)), 15px); top: 8px;
                    right: 20px; } #bbgl-panel.bbgl-mode-page #bbgl-sticker-title {/*-----------------------------------------------------*/
                    font-size: clamp(12px, calc(12px + 8px * var(--bbgl-page-t)), 20px);/*------------------------------------------------*/
                    top: clamp(9px, calc(9px + 1px * var(--bbgl-page-t)), 10px);/*--------------------------------------------------------*/
                    right: clamp(8px, calc(8px + 14px * var(--bbgl-page-t)), 22px); } .copy-hist-btn { position: absolute; top: 4px;/*----*/
                    right: 5px; width: 14.5px; height: 14.5px; cursor: pointer; z-index: 90; transition: all .2s; user-select: none;/*----*/
                    opacity: .6; display: none; align-items: center; justify-content: center; }/*-----------------------------------------*/
                    .bbgl-tall .copy-hist-btn, .bbgl-mode-page .copy-hist-btn { display: flex; } .copy-hist-btn svg {/*-------------------*/
                    width: 100% !important; height: 100% !important; margin: 0 !important; transition: all .2s; } .copy-hist-btn:hover {
                    opacity: 1; transform: scale(1.27); filter: drop-shadow(0 0 5px rgba(255, 255, 255, .4)); }/*-------------------------*/
                    .viewing-stickers .copy-hist-btn { display: none !important; }/*------------------------------------------------------*/
                    /* Copy session + item counters are ledger-only: hide on every non-ledger view. */ .viewing-graph .copy-hist-btn, .viewing-achievements .copy-hist-btn { display: none !important; }/*---*/
                    #bbgl-item-counters { position: absolute; top: 5.5px; right: 10%; display: none; gap: 10px; align-items: center;/*----*/
                    z-index: 60; white-space: nowrap; font-size: 10px; font-weight: 500; color: #bbb;/*-----------------------------------*/
                    font-family: 'Barlow Condensed', 'Arial Narrow', 'Nimbus Sans Narrow', Tahoma, sans-serif;/*--------------------------*/
                    font-variant-numeric: tabular-nums; height: 14px; pointer-events: auto; }/*-------------------------------------------*/
                    .bbgl-tall #bbgl-item-counters, .bbgl-mode-page #bbgl-item-counters { display: flex; }/*------------------------------*/
                    .viewing-graph #bbgl-item-counters, .viewing-achievements #bbgl-item-counters, .viewing-stickers #bbgl-item-counters {
                    display: none !important; } .bbgl-expanded #bbgl-item-counters {/*----------------------------------------------------*/
                    font-size: clamp(11px, calc(11px + 1px * var(--bbgl-dock-t)), 12px); top: 6px; right: 38px;/*-------------------------*/
                    gap: clamp(4px, calc(4px + 10px * var(--bbgl-dock-t)), 14px); } #bbgl-panel.bbgl-mode-page #bbgl-item-counters {/*----*/
                    font-size: clamp(8.5px, calc(8.5px + 5.5px * var(--bbgl-page-t)), 14px);/*--------------------------------------------*/
                    gap: clamp(4px, calc(4px + 10px * var(--bbgl-page-t)), 14px);/*-------------------------------------------------------*/
                    right: clamp(38px, calc(38px + 4px * var(--bbgl-page-t)), 42px);/*----------------------------------------------------*/
                    top: clamp(6px, calc(6px + 4px * var(--bbgl-page-t)), 10px);/*--------------------------------------------------------*/
                    height: clamp(16px, calc(16px + 2px * var(--bbgl-page-t)), 18px); } #bbgl-item-counters .bbgl-ic { display: inline-flex;
                    align-items: baseline; gap: 3px; } #bbgl-item-counters .bbgl-ic-dyn { display: none; }/*------------------------------*/
                    .bbgl-expanded #bbgl-item-counters .bbgl-ic-dyn, #bbgl-panel.bbgl-mode-page #bbgl-item-counters .bbgl-ic-dyn {/*------*/
                    display: inline-flex; } #bbgl-item-counters .bbgl-ic-yes { color: #43a047; font-weight: 700; }/*----------------------*/
                    #bbgl-item-counters .bbgl-ic-no { color: #e53935; font-weight: 700; } #bbgl-item-counters .bbgl-ic-sub {/*------------*/
                    font-size: .82em; opacity: .6; font-weight: 500; } #bbgl-panel.bbgl-mode-page .copy-hist-btn {/*----------------------*/
                    width: clamp(16px, calc(16px + 2px * var(--bbgl-page-t)), 18px);/*----------------------------------------------------*/
                    height: clamp(16px, calc(16px + 2px * var(--bbgl-page-t)), 18px);/*---------------------------------------------------*/
                    top: clamp(6px, calc(6px + 4px * var(--bbgl-page-t)), 10px); } #bbgl-panel.bbgl-mode-page #bbgl-graph-container .g-hud {
                    margin-top: clamp(2px, calc(3px - 1px * var(--bbgl-page-t)), 3px);/*--------------------------------------------------*/
                    margin-bottom: clamp(2px, calc(2px + 1px * var(--bbgl-page-t)), 3px); }/*---------------------------------------------*/
                    #bbgl-panel.bbgl-mode-page #bbgl-graph-container .g-pill {/*----------------------------------------------------------*/
                    font-size: clamp(8.8px, calc(8.8px + 1.2px * var(--bbgl-page-t)), 10px);/*--------------------------------------------*/
                    padding: clamp(.5px, calc(.5px + 1px * var(--bbgl-page-t)), 1.5px) clamp(3px, calc(3px + 5px * var(--bbgl-page-t)), 8px);
                    line-height: calc(1.18 + .26 * (1 - var(--bbgl-page-t))); }/*---------------------------------------------------------*/
                    #bbgl-panel.bbgl-mode-page #bbgl-graph-container .g-toggles {/*-------------------------------------------------------*/
                    gap: clamp(4px, calc(4px + 2px * var(--bbgl-page-t)), 6px); align-items: center; }/*----------------------------------*/
                    #bbgl-panel.bbgl-mode-page #bbgl-graph-container .g-text {/*----------------------------------------------------------*/
                    font-size: clamp(10px, calc(10px + 1px * var(--bbgl-page-t)), 11px); }/*----------------------------------------------*/
                    #bbgl-panel.bbgl-mode-page #bbgl-graph-container .g-text.x-label {/*--------------------------------------------------*/
                    font-size: clamp(8px, calc(8px + 2px * var(--bbgl-page-t)), 10px); }/*------------------------------------------------*/
                    #bbgl-panel.bbgl-mode-page #bbgl-sticker-pagination { bottom: -2px;/*-------------------------------------------------*/
                    gap: clamp(4px, calc(4px + 2px * var(--bbgl-page-t)), 6px); } #bbgl-panel.bbgl-mode-page .pg-dot {/*------------------*/
                    width: clamp(5px, calc(5px + 1px * var(--bbgl-page-t)), 6px);/*-------------------------------------------------------*/
                    height: clamp(5px, calc(5px + 1px * var(--bbgl-page-t)), 6px); } #bbgl-panel.bbgl-mode-page .sticker-nav-btn {/*------*/
                    font-size: clamp(24px, calc(24px + 8px * var(--bbgl-page-t)), 32px);/*------------------------------------------------*/
                    width: clamp(22px, calc(22px + 18px * var(--bbgl-page-t)), 40px);/*---------------------------------------------------*/
                    height: clamp(26px, calc(26px + 6px * var(--bbgl-page-t)), 32px);/*---------------------------------------------------*/
                    margin-top: clamp(0px, calc(4px * (1 - var(--bbgl-page-t))), 4px); } #bbgl-panel.bbgl-mode-page #sticker-prev-btn {/*-*/
                    left: clamp(0px, calc(6px * var(--bbgl-page-t)), 6px); } #bbgl-panel.bbgl-mode-page #sticker-next-btn {/*-------------*/
                    right: clamp(0px, calc(6px * var(--bbgl-page-t)), 6px); } #bbgl-item-viewer { display: none; flex: 1; width: 100%;/*--*/
                    height: 100%; background: radial-gradient(circle at center, #2e2e2e 0%, #1a1a1a 100%); flex-direction: column;/*------*/
                    align-items: center; justify-content: center; position: relative; border-top: 1px solid #444; overflow: hidden; }/*---*/
                    #bbgl-item-viewer.active { display: flex; } .viewer-window { width: 95%; height: 100%; display: flex;/*---------------*/
                    align-items: center; justify-content: center; position: relative; } .viewer-stage { width: 100%; height: 100%;/*------*/
                    perspective: 400px; perspective-origin: center 50px; cursor: grab; } .viewer-stage:active { cursor: grabbing; }/*-----*/
                    .viewer-pedestal { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;/*----------*/
                    transform-style: preserve-3d; } .viewer-obj { width: 100%; height: 100%; display: flex; align-items: center;/*--------*/
                    justify-content: center; transform-style: preserve-3d; transform-origin: center 75%;/*--------------------------------*/
                    transform: rotateX(8deg) scale(.85) translateY(8px); } .bbgl-expanded:not(.bbgl-mode-page) .viewer-obj {/*------------*/
                    transform: rotateX(5deg) scale(clamp(.75, calc(.83 - .08 * var(--bbgl-dock-t)), .83)) translateY(-15px); }/*----------*/
                    .viewer-obj img { width: 100%; height: 100%; object-fit: contain; } .layer-front { position: absolute; z-index: 2;/*--*/
                    width: 100%; height: 100%; background-size: contain; background-repeat: no-repeat; background-position: center;/*-----*/
                    backface-visibility: hidden; -webkit-backface-visibility: hidden; } .layer-back { position: absolute; z-index: 1;/*---*/
                    width: 100%; height: 100%; backface-visibility: hidden; -webkit-backface-visibility: hidden; background: #eee;/*------*/
                    background-image: linear-gradient(to bottom, rgba(255, 255, 255, .8) 0%, rgba(200, 200, 200, 1) 100%);/*--------------*/
                    transform: rotateY(180deg) scaleX(-1) translateZ(-1px); -webkit-mask-size: contain; mask-size: contain;/*-------------*/
                    -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center;/*-------*/
                    pointer-events: none; filter: brightness(var(--back-brightness, 1)); } .viewer-obj.is-image .layer-front::after {/*---*/
                    content: ""; position: absolute; inset: 0; -webkit-mask-image: var(--bg-mask); mask-image: var(--bg-mask);/*----------*/
                    -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;/*-------------*/
                    -webkit-mask-position: center; mask-position: center;/*---------------------------------------------------------------*/
                    background: linear-gradient(115deg, transparent 25%, rgba(0, 255, 255, .4) 40%, rgba(255, 255, 255, .5) 50%, rgba(255, 0, 255, .4) 60%, transparent 75%);
                    background-size: 250% 100%; background-position: var(--sheen-pos, 0% 0%); mix-blend-mode: overlay;/*------------------*/
                    opacity: var(--sheen-opacity, 1); pointer-events: none; transition: opacity .1s; } .viewer-info-overlay {/*-----------*/
                    position: absolute; top: calc(50px - var(--bbgl-viewer-title-top-shift)); left: 10px; text-align: left;/*-------------*/
                    pointer-events: none; z-index: 50; } .vi-name { font-size: 11px; color: #fff; font-weight: 700; text-transform: none; }
                    .bbgl-expanded .viewer-info-overlay { top: calc(75px - var(--bbgl-viewer-title-top-shift)); left: 15px; }/*-----------*/
                    #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) .viewer-info-overlay {/*-----------------------------------------------*/
                    top: calc(43.05px + 31.57px * var(--bbgl-dock-t) - var(--bbgl-viewer-title-top-shift)) !important;/*------------------*/
                    left: clamp(10px, calc(10px + 5px * var(--bbgl-dock-t)), 15px) !important; } .bbgl-expanded .vi-name {/*--------------*/
                    font-size: clamp(14px, calc(14px + 1px * var(--bbgl-dock-t)), 15px); } .vi-count { font-size: 9px; color: #aaa;/*-----*/
                    margin-bottom: 2px; } #btn-close-viewer { position: absolute; top: 5px; right: 5px; background: 0 0;/*----------------*/
                    border: 1px solid #555; color: #888; font-size: 10px; padding: 2px 6px; cursor: pointer; border-radius: 3px;/*--------*/
                    pointer-events: auto; transition: all .2s; } #btn-close-viewer:hover { border-color: #fff; color: #fff;/*-------------*/
                    background: #333; } #bbgl-panel.bbgl-mode-page #bbgl-item-viewer { aspect-ratio: auto; }/*----------------------------*/
                    .bbgl-mode-page #bbgl-item-viewer.active { display: flex !important; width: 100% !important;/*------------------------*/
                    height: calc(100vh - 420px + 60px * var(--bbgl-page-t));/*------------------------------------------------------------*/
                    min-height: clamp(300px, calc(300px + 200px * var(--bbgl-page-t)), 500px); border: none; border-radius: 0 0 5px 5px;
                    box-sizing: border-box; flex: none !important; } #bbgl-page-container .bbgl-mode-page:has(#bbgl-item-viewer.active) {
                    flex: none; } .bbgl-mode-page .viewer-info-overlay {/*----------------------------------------------------------------*/
                    top: clamp(calc(10px - var(--bbgl-viewer-title-top-shift)), calc(10px + 6px * var(--bbgl-page-t) - var(--bbgl-viewer-title-top-shift)), calc(16px - var(--bbgl-viewer-title-top-shift))) !important;
                    left: clamp(10px, calc(10px + 5px * var(--bbgl-page-t)), 15px) !important; } .bbgl-mode-page .vi-name {/*-------------*/
                    font-size: clamp(14px, calc(14px + 2px * var(--bbgl-page-t)), 16px) !important; } .bbgl-mode-page .vi-count {/*-------*/
                    font-size: clamp(8px, calc(8px + 1px * var(--bbgl-page-t)), 9px); } .bbgl-mode-page #btn-close-viewer {/*-------------*/
                    font-size: clamp(9px, calc(9px + 1px * var(--bbgl-page-t)), 10px);/*--------------------------------------------------*/
                    padding: 2px clamp(5px, calc(5px + 1px * var(--bbgl-page-t)), 6px);/*-------------------------------------------------*/
                    top: clamp(4px, calc(4px + 1px * var(--bbgl-page-t)), 5px) !important;/*----------------------------------------------*/
                    right: clamp(4px, calc(4px + 1px * var(--bbgl-page-t)), 5px) !important; }/*------------------------------------------*/
                    .bbgl-mode-page .viewer-window, .bbgl-mode-page .viewer-stage, .bbgl-mode-page .viewer-pedestal {/*-------------------*/
                    width: clamp(85%, calc(85% + 7% * var(--bbgl-page-t)), 92%) !important;/*---------------------------------------------*/
                    height: clamp(85%, calc(85% + 7% * var(--bbgl-page-t)), 92%); } .bbgl-mode-page .viewer-obj {/*-----------------------*/
                    transform: rotateX(5deg) scale(calc(1.22 + .33 * (1 - var(--bbgl-page-t)))) translateY(clamp(20px, calc(20px + 5px * (1 - var(--bbgl-page-t))), 25px)) translateX(clamp(10px, calc(10px + 10px * var(--bbgl-page-t)), 20px)) !important;
                    } .bbgl-mode-page #bbgl-sticker-pagination { bottom: -2px !important; padding-bottom: 0; } #bbgl-bottom-panel { flex: 1;
                    display: flex; flex-direction: column; padding: 0; box-sizing: border-box; overflow: hidden; } .bbgl-header-wrapper {
                    position: relative; padding: 0 0 2px 0; margin-bottom: 0; border-bottom: none; flex: 0 0 95px; overflow: visible;/*---*/
                    z-index: 20; display: flex; flex-direction: column; justify-content: flex-end;/*--------------------------------------*/
                    transition: flex .3s cubic-bezier(.25, 1, .5, 1); } .bbgl-header-wrapper::before { content: ""; position: absolute;/*-*/
                    top: 0; left: 0; right: 0; bottom: 0; width: auto; height: auto; background-image: url('__ASSETS_HEADER_IMG__');/*-----------*/
                    background-size: 100% 100%; background-position: center; opacity: 0.85; z-index: -1; pointer-events: none;/*----------*/
                    border-radius: 3px 3px 0 0; clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }/*-----------------------------------*/
                    #bbgl-panel.bbgl-expanded .bbgl-header-wrapper { flex: 0 0 130px; } .bbgl-month-header { display: flex;/*-------------*/
                    justify-content: space-between; align-items: center; padding: 4px 8px 0 12px; gap: 8px; position: relative;/*---------*/
                    margin-bottom: 4px; transition: margin-bottom .3s ease; } #bbgl-panel.bbgl-expanded .bbgl-month-header {/*------------*/
                    gap: clamp(6px, calc(6px + 6px * var(--bbgl-dock-t)), 12px); margin-bottom: 12px; } .arrow-btn { background: 0 0;/*---*/
                    border: none; color: #fff; font-size: 18px; cursor: pointer; padding: 0 5px; font-weight: 700; user-select: none;/*---*/
                    line-height: 1; text-shadow: 0 1px 3px #000; align-self: flex-end; margin-bottom: 4px;/*------------------------------*/
                    transition: transform .2s, text-shadow .2s; } @media (hover: hover) { .arrow-btn:hover { color: #fff;/*---------------*/
                    transform: scale(1.3); text-shadow: 0 0 8px rgba(255, 255, 255, .8); } } .arrow-btn:active { color: #fff;/*-----------*/
                    transform: scale(1.3); text-shadow: 0 0 8px rgba(255, 255, 255, .8); } .title-group { flex-grow: 1; text-align: left;
                    padding-left: 0; transform: translateX(0px); display: flex; flex-direction: column; justify-content: flex-start;/*----*/
                    align-items: flex-start; gap: 3px; /* transform makes this a stacking-context root, so the dropdown's z-index is scoped here. */ position: relative; }/*--------------------------------------------*/
                    /* Only lift .title-group above #bbgl-level-container (z-index:10) while a dropdown is actually open, so the menu paints over the exp bar \u2014 the rest of the time it stays at its normal stacking position. Elevating it unconditionally (the old approach) made its whole box win any overlap with the level bar's crown/diamond badge beneath it, across the entire header row width, which is more than this ever actually needs. */ .title-group:has(.bbgl-dropdown-menu.show) { z-index: 30; } /* gap is the single source of row-to-row spacing, shared across modes by default so every row-pair gap matches. Only override it (paired with a compensating margin-top so the bottom row doesn't move) when a mode genuinely needs a different value \u2014 see .bbgl-compact below. */ .title-stack {/*----------*/
                    display: flex; flex-direction: column; align-items: flex-start; gap: 3px; } #bbgl-panel.bbgl-expanded .title-stack {
                    margin-top: -4px; } #bbgl-panel.bbgl-expanded .title-group { gap: 6px; } #bbgl-panel.bbgl-compact .title-group {/*----*/
                    gap: 1px; } /* Gap reduced 1px (3px -> 2px) for both row-pairs; margin-top pushes the whole stack down by 2px (1px per shrunk gap, compounding down to the bottom row) so the month row \u2014 the last one \u2014 stays exactly where it was before this change. */ #bbgl-panel.bbgl-compact .title-stack { gap: 2px; margin-top: 2px; }/*--------------------*/
                    /* Gap now fluid: 7px at min panel width -> 15px at max (was a flat 11px, which is why it looked unchanged at max size). margin-top compensates 2px per px of gap growth (both gaps, compounding down to the bottom row) against the true 3px original gap, so month stays anchored across the whole width range, not just at the two ends. NOTE: the original -8px/-12px bounds here were already a dead clamp (backwards min/max order == always evaluates to -8px flat) predating this change \u2014 left as-is, just accounted for correctly. */ #bbgl-panel.bbgl-mode-page .title-stack { gap: clamp(7px, calc(7px + 8px * var(--bbgl-page-t)), 15px);
                    margin-top: clamp(-32px, calc(-16px - 16px * var(--bbgl-page-t)), -16px); } #bbgl-panel.bbgl-mode-page .title-group {
                    gap: clamp(6px, calc(8px - 2px * var(--bbgl-page-t)), 8px); } /* NOTE: #all-time-btn only ever carries class="stats-btn" \u2014 a former .all-time-btn class rule set here never matched anything and was removed. Sizing/hover for the all-time icon comes entirely from the shared .stats-btn rules below. */ /* Row height is pinned to the icon's own height (identical in every row), NOT the label's \u2014 labels vary wildly in size (9px-34px) and would otherwise make row height, and thus the gap between icons, inconsistent per row. The icon therefore always exactly fills its row; a label taller than the row overflows upward, which is harmless. align-items:flex-end (not center) because .stats-btn's SVG is only 78% of its own box and bottom-aligned within it \u2014 the box's visual bottom matches its box-bottom exactly, but its visual top doesn't, so bottom-alignment is what actually lines up the visible icon and label; centering the boxes would not center the visible content. .stats-btn / .header-trigger both add the same hardcoded -6px settled offset so they move together. --trigger-lift / --btn-lift: live per-element tuning knobs (delta from the settled -6px baseline), default 0 = no change. --btn-hover-adjust: per-row hover-jump correction. */ .header-row {/*-------*/
                    display: flex; align-items: flex-end; gap: 2px; position: relative; height: 16px; --trigger-lift: 0px; --btn-lift: 0px;
                    --btn-hover-adjust: 0px; } #bbgl-panel.bbgl-expanded .header-row { gap: 6px;/*----------------------------------------*/
                    height: clamp(20px, calc(20px + 7px * var(--bbgl-dock-t)), 27px); --btn-lift: -4px; }/*-------------------------------*/
                    #bbgl-panel.bbgl-expanded .header-row--month { --btn-lift: -1px; } #bbgl-panel.bbgl-mode-page .header-row {/*---------*/
                    gap: clamp(3px, calc(3px + 3px * var(--bbgl-page-t)), 6px);/*---------------------------------------------------------*/
                    height: clamp(21px, calc(21px + 10px * var(--bbgl-page-t)), 31px); } /* Row-to-row spacing comes ONLY from .title-stack's gap above \u2014 every row is a fixed, identical height (icon-sized), so the gap between any two adjacent rows is guaranteed equal in every panel mode, both mathematically and visually. */ .header-row--year {/*-----------*/
                    --btn-hover-adjust: 1px; --trigger-lift: -4px; } /* Year label is bottom-aligned like month/all-time (align-items:flex-end on .header-row, inherited \u2014 no per-element override needed), so its position stays pinned to the row's bottom edge regardless of the row's own height. Previously this was align-self:center, which made the label's position depend on the row's total height \u2014 fine at a fixed height, but it drifted as the row's fluid height clamp (expanded mode) changed with panel width. flex-end sidesteps that entirely. */ /* #all-time-trigger's font is by far the largest of the three (20-34px vs 9-29px), so line-height:1's descent reservation is proportionally biggest here \u2014 nudge the label down to compensate. Starting estimate, not measured against a live render; adjust as needed. */ .header-row--alltime {/*-----------*/
                    --trigger-lift: 3px; } .stats-btn { display: flex; align-items: flex-end; justify-content: center; pointer-events: none;
                    opacity: .95; transition: all .2s; align-self: flex-end; transform-origin: center bottom;/*---------------------------*/
                    transform: translate(-5px, calc(-6px + var(--btn-lift, 0px))); } /* Hover jump is a per-mode absolute (not a delta from rest): page -4px, expanded -6px, compact -7px; --btn-hover-adjust (set per-row, e.g. .header-row--year) shifts it +1px shallower. */ .stats-btn:hover, .stats-btn.active {
                    opacity: 1; transform: translate(-5px, calc(var(--btn-hover-jump, -6px) + var(--btn-hover-adjust, 0px))) scale(1.15);
                    filter: drop-shadow(0 0 6px rgba(216, 150, 224, 0.9)) drop-shadow(0 0 2px rgba(171, 71, 188, 1)); }/*-----------------*/
                    #bbgl-panel.bbgl-compact .header-row { --btn-hover-jump: -7px; --btn-lift: -2.5px; }/*--------------------------------*/
                    #bbgl-panel.bbgl-compact .header-row--month { --btn-lift: -1.5px; } #bbgl-panel.bbgl-compact .header-row--year {/*----*/
                    --trigger-lift: -3px; } #bbgl-panel.bbgl-mode-page .header-row { --btn-hover-jump: -4px; } .stats-btn svg { width: 100%;
                    height: 100%; pointer-events: auto; cursor: pointer; } .header-trigger {/*--------------------------------------------*/
                    font-family: 'Fjalla One', 'Arial Narrow', sans-serif; font-weight: 400; color: #fff; cursor: pointer;/*--------------*/
                    text-transform: capitalize; user-select: none; text-shadow: 0 2px 4px #000; transition: font-size .3s; line-height: 1;
                    transform: translateY(calc(-6px + var(--trigger-lift, 0px))); } .header-trigger:hover { opacity: .8; }/*--------------*/
                    .header-trigger::after { content: '\u25BC'; font-size: 8px; opacity: .5; margin-left: 3px; vertical-align: middle;/*-------*/
                    position: relative; top: -1px; } .header-trigger.disabled { cursor: default; pointer-events: none; }/*----------------*/
                    .header-trigger.disabled::after { display: none; } #year-trigger { font-size: 9px; } #month-trigger { font-size: 14px; }
                    #all-time-trigger { font-size: 20px; } #all-time-trigger::after { display: none; }/*----------------------------------*/
                    #year-stats-btn, #month-stats-btn, #all-time-btn { width: 15px; height: 14px; }/*-------------------------------------*/
                    #bbgl-panel.bbgl-mode-page #year-trigger { font-size: clamp(12px, calc(12px + 7px * var(--bbgl-page-t)), 19px); }/*---*/
                    #bbgl-panel.bbgl-mode-page #month-trigger { font-size: clamp(18px, calc(18px + 11px * var(--bbgl-page-t)), 29px); }/*-*/
                    #bbgl-panel.bbgl-mode-page #all-time-trigger { font-size: clamp(24px, calc(24px + 10px * var(--bbgl-page-t)), 34px); }
                    #bbgl-panel.bbgl-mode-page #year-stats-btn, #bbgl-panel.bbgl-mode-page #month-stats-btn, #bbgl-panel.bbgl-mode-page #all-time-btn {
                    width: clamp(20px, calc(20px + 10px * var(--bbgl-page-t)), 30px);/*---------------------------------------------------*/
                    height: clamp(21px, calc(21px + 10px * var(--bbgl-page-t)), 31px); } #bbgl-panel.bbgl-mode-page .arrow-btn {/*--------*/
                    font-size: clamp(16px, calc(16px + 12px * var(--bbgl-page-t)), 28px);/*-----------------------------------------------*/
                    margin-bottom: clamp(4px, calc(4px + 2px * var(--bbgl-page-t)), 6px); }/*---------------------------------------------*/
                    #bbgl-panel.bbgl-mode-page .header-trigger::after { font-size: clamp(10px, calc(10px + 2px * var(--bbgl-page-t)), 12px);
                    } .bbgl-dropdown-menu { position: absolute; top: 100%; left: 0; background: #222; border: 1px solid #444;/*-----------*/
                    border-radius: 4px; box-shadow: 0 4px 15px rgba(0, 0, 0, .95); z-index: 100; display: none; padding: 4px; gap: 2px; }
                    .bbgl-dropdown-menu.show { display: grid; } #bbgl-month-dropdown { grid-template-columns: repeat(3, 1fr);/*-----------*/
                    min-width: 140px; } #bbgl-year-dropdown { display: none; flex: 1; flex-direction: column; width: max-content;/*-------*/
                    min-width: 60px; } #bbgl-year-dropdown.show { display: flex; } .drop-item { padding: 8px 12px; font-size: 11px;/*-----*/
                    color: #999; cursor: pointer; text-align: center; border-radius: 3px; } #bbgl-panel.bbgl-expanded .drop-item {/*------*/
                    font-size: clamp(11px, calc(11px + 2px * var(--bbgl-dock-t)), 13px); } .drop-item:hover { background: #333; color: #fff;
                    } .drop-item.active { background: #7b2fbe; color: #fff; } .bbgl-grid-container { flex: 1; display: flex;/*------------*/
                    flex-direction: column; padding: 0 2px; overflow: hidden; min-height: 0; position: relative; z-index: 1;/*------------*/
                    transition: padding .3s ease; } .bbgl-week-row { display: grid; grid-template-columns: repeat(7, 1fr);/*--------------*/
                    text-align: center; color: #888; font-size: 10px; margin-bottom: 0;/*-------------------------------------------------*/
                    font-family: 'Fjalla One', 'Arial Narrow', sans-serif; padding-top: 1px; border-top: none; flex: 0 0 auto; }/*--------*/
                    #bbgl-panel.bbgl-expanded .bbgl-week-row { font-size: clamp(11px, calc(11px + 2px * var(--bbgl-dock-t)), 13px);/*-----*/
                    padding-top: 5px; margin-bottom: 2px; } #bbgl-panel.bbgl-mode-page .bbgl-week-row {/*---------------------------------*/
                    font-size: clamp(11px, calc(11px + 4px * var(--bbgl-page-t)), 15px);/*------------------------------------------------*/
                    padding-top: clamp(3px, calc(3px + 5px * var(--bbgl-page-t)), 8px);/*-------------------------------------------------*/
                    margin-bottom: clamp(2px, calc(2px + 2px * var(--bbgl-page-t)), 4px); } .bbgl-week-row span {/*-----------------------*/
                    border-right: 1px solid rgba(255, 255, 255, .05); } .bbgl-week-row span:last-child { border-right: none; }/*----------*/
                    .calendar-wrapper { flex: 1; display: flex; flex-direction: column; overflow-y: auto; overflow-x: hidden;/*-----------*/
                    position: relative; background: #333; } .bbgl-cal-container { display: flex; flex-direction: column; width: 100%;/*---*/
                    touch-action: pan-y; border-top: 1px solid rgba(255, 255, 255, .05); border-left: 1px solid rgba(255, 255, 255, .05); }
                    .bbgl-row-slice { display: flex; width: 100%; background-image: var(--bg-url);/*--------------------------------------*/
                    background-size: 100% calc(100% * var(--total-rows));/*---------------------------------------------------------------*/
                    background-position: center calc(var(--row-idx) * 100% / (var(--total-rows) - 1)); background-repeat: no-repeat; }/*--*/
                    .bbgl-day-cell { flex: 1; aspect-ratio: 1/1; display: block; position: relative; cursor: pointer; background: 0 0;/*--*/
                    box-shadow: none; border-bottom: 1px solid rgba(255, 255, 255, .05); border-right: 1px solid rgba(255, 255, 255, .05);
                    transition: transform .1s; overflow: hidden; user-select: none; -webkit-user-select: none; } .bbgl-day-cell.empty {/*-*/
                    background: 0 0; box-shadow: none; cursor: default; pointer-events: none; } /* Event post-it notes \u2014 War and OD visual indicators on calendar cells. */ .bbgl-event-post-it {/*--*/
                    position: absolute; top: calc(4% - max(0, var(--stack-total, 1) - 1) * 6% + var(--ei, 0) * 9%); left: 4%; width: 92%;
                    height: 92%; background: no-repeat center / contain; z-index: 17; filter: drop-shadow(-2px 4px 5px rgba(0, 0, 0, .4));
                    transform-origin: top right; transition: transform .35s ease-out, top .35s ease-out; pointer-events: none;/*----------*/
                    transform: rotate(calc(-4deg + var(--ei, 0) * -3deg)); }/*------------------------------------------------------------*/
                    /* Sticker awarded that day (cleared or not): the whole stack peels together. Staggered so the topmost note (the one covering everything) leaves with zero delay the moment you hover, while notes further down follow in sequence behind it. */ body:not(.is-touch-device) .bbgl-day-cell:not(.empty):has(.sticker-wrapper):hover .bbgl-event-post-it, .bbgl-day-cell.is-scrub-hovered:has(.sticker-wrapper) .bbgl-event-post-it, .bbgl-day-cell.is-viewing:has(.sticker-wrapper) .bbgl-event-post-it {
                    transform: translateX(110%) translateY(-20%) rotate(20deg); transition: transform .25s ease-in;/*---------------------*/
                    transition-delay: calc(((var(--stack-total, 1) - 1) - var(--ei, 0)) * 0.15s); }/*-------------------------------------*/
                    /* No sticker awarded that day: only the note actually blocking the stack (marked .bbgl-event-post-it-top, only ever added when there's more than one note) peels away, revealing whatever's fanned out underneath. A lone post-it with no sticker underneath never moves. */ body:not(.is-touch-device) .bbgl-day-cell:not(.empty):not(:has(.sticker-wrapper)):hover .bbgl-event-post-it-top, .bbgl-day-cell.is-scrub-hovered:not(:has(.sticker-wrapper)) .bbgl-event-post-it-top, .bbgl-day-cell.is-viewing:not(:has(.sticker-wrapper)) .bbgl-event-post-it-top {
                    transform: translateX(110%) translateY(-20%) rotate(20deg); transition: transform .25s ease-in; }/*-------------------*/
                    .bbgl-day-cell.is-plate { z-index: 2; border-bottom: 1px solid rgba(0, 0, 0, .4);/*-----------------------------------*/
                    border-right: 1px solid rgba(0, 0, 0, .4); } .bbgl-day-cell.ghost-cell .jewel-wrapper { opacity: .6; } .jewel-wrapper {
                    position: absolute; top: 50%; left: 53%; width: 80%; height: 78%; transform: translate(-50%, -50%);/*-----------------*/
                    pointer-events: none; z-index: 10; filter: drop-shadow(0 3px 2px rgba(0, 0, 0, .5)); } .jewel-asset { width: 100%;/*--*/
                    height: 100%; object-fit: contain; position: absolute; top: 0; left: 0; } .jewel-shine { position: absolute; inset: 0;
                    pointer-events: none; -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat;/*---------------*/
                    mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; } @keyframes gold-roll { 0% {/*---------*/
                    background-position: 200% 0%; opacity: 0 } 15% { opacity: 1 } 100% { background-position: 50% 0%; opacity: 1 } }/*----*/
                    .jewel-type-gold .jewel-asset { transform: rotate(90deg) scale(1.25) translateZ(0); backface-visibility: hidden;/*----*/
                    -webkit-backface-visibility: hidden; } .jewel-type-gold .jewel-shine { transform: scale(1.2); filter: brightness(1.2);
                    background: linear-gradient(135deg, transparent 25%, rgba(255, 240, 180, 1) 45%, rgba(255, 255, 255, 1.0) 50%, rgba(255, 240, 180, 1) 55%, transparent 75%);
                    background-size: 200% auto; mix-blend-mode: soft-light; opacity: 0; transition: opacity .2s; }/*----------------------*/
                    .jewel-type-green .jewel-asset { transform: scale(1.23) translateZ(0); backface-visibility: hidden;/*-----------------*/
                    -webkit-backface-visibility: hidden; }/*------------------------------------------------------------------------------*/
                    /* Green and diamond jewels share the same shine gradients; only the transforms differ per type. */ .jewel-type-green .jewel-shine, .jewel-type-diamond .jewel-shine {/*---------------------------------*/
                    background: linear-gradient(120deg, transparent 10%, rgba(0, 220, 110, .4) 28%, rgba(180, 255, 210, .95) 40%, rgba(255, 255, 255, 1.0) 50%, rgba(180, 255, 210, .95) 60%, rgba(0, 220, 110, .4) 72%, transparent 90%);
                    background-size: 300% auto; mix-blend-mode: screen; opacity: 0; }/*---------------------------------------------------*/
                    .jewel-type-green .jewel-shine-over, .jewel-type-diamond .jewel-shine-over { position: absolute; z-index: 3;/*--------*/
                    width: 100%; height: 100%;/*------------------------------------------------------------------------------------------*/
                    background: linear-gradient(120deg, transparent 0%, rgba(120, 255, 180, .5) 41%, rgba(255, 255, 255, .7) 50%, rgba(120, 255, 180, .5) 59%, transparent 100%);
                    background-size: 300% auto; mix-blend-mode: soft-light; opacity: 0; -webkit-mask-image: var(--jewel-mask);/*----------*/
                    mask-image: var(--jewel-mask); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat;/*------*/
                    mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; } .jewel-type-green .jewel-shine {/*----*/
                    transform: scale(1.18); } .jewel-type-green .jewel-shine-over { transform: scale(1.23); }/*---------------------------*/
                    .jewel-type-diamond .jewel-asset { transform-origin: bottom left;/*---------------------------------------------------*/
                    transform: translate(-6%, 6%) scale(1.08, 1.06) translateZ(0); backface-visibility: hidden;/*-------------------------*/
                    -webkit-backface-visibility: hidden; } .jewel-type-diamond .jewel-shine, .jewel-type-diamond .jewel-shine-over {/*----*/
                    transform-origin: bottom left; transform: translate(-3%, 3%) scale(1.02, 1.00); } @keyframes green-flash { 0% {/*-----*/
                    background-position: 250% 0%; opacity: 0 } 20% { opacity: .9 } 100% { background-position: 50% 0%; opacity: .75 } }/*-*/
                    @keyframes green-flash-over { 0% { background-position: 250% 0%; opacity: 0 } 20% { opacity: .72 } 100% {/*-----------*/
                    background-position: 50% 0%; opacity: .95 } } .sticker-wrapper { position: absolute; top: 50%; left: 50%; width: 80%;
                    height: 80%; transform: translate(-50%, -50%) rotate(var(--rot, 0deg)); pointer-events: none; z-index: 15;/*----------*/
                    filter: drop-shadow(0 2px 3px rgba(0, 0, 0, .5)); } .cell-sticker-deco { width: 100%; height: 100%; object-fit: contain;
                    filter: brightness(.9) sepia(.2) contrast(1.1); transition: transform .2s; } .new-sticker-post-it { position: absolute;
                    top: 4%; left: 4%; width: 92%; height: 92%; background: url('__ASSETS_NEW_STICKER_FRAME__') no-repeat center / contain; z-index: 20;
                    filter: drop-shadow(-2px 4px 5px rgba(0, 0, 0, .4)); transform-origin: top right;/*-----------------------------------*/
                    transition: transform .6s cubic-bezier(.5, 0, 1, 1); cursor: pointer; transform: rotate(-5deg); } .post-it-rip {/*----*/
                    transform: translateX(250%) translateY(-80%) rotate(75deg) scale(1.3) !important; pointer-events: none; }/*-----------*/
                    .sticker-shine { position: absolute; inset: 0;/*----------------------------------------------------------------------*/
                    background: linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(200, 250, 255, .001) 30%, rgba(255, 255, 255, .01) 50%, rgba(255, 200, 220, .001) 70%, rgba(255, 255, 255, 0) 100%);
                    background-size: 400% 400%; background-position: var(--bg-x, 50%) var(--bg-y, 50%); mix-blend-mode: overlay; opacity: 0;
                    border-radius: 4px; -webkit-mask-mode: alpha; mask-mode: alpha; -webkit-mask-size: contain; mask-size: contain;/*-----*/
                    -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; }/*-----*/
                    @keyframes bbgl-auto-shimmer { 0% { opacity: .85; background-position: 0% 0% } 100% { opacity: .85;/*-----------------*/
                    background-position: 100% 100% } } @keyframes bbgl-slide-in-l { from { transform: translateX(-100%) } to {/*----------*/
                    transform: translateX(0) } } @keyframes bbgl-slide-in-r { from { transform: translateX(100%) } to {/*-----------------*/
                    transform: translateX(0) } } @keyframes bbgl-slide-out-l { from { transform: translateX(0) } to {/*-------------------*/
                    transform: translateX(-100%) } } @keyframes bbgl-slide-out-r { from { transform: translateX(0) } to {/*---------------*/
                    transform: translateX(100%) } } .bbgl-cal-ghost { position: absolute; top: 0; left: 0; width: 100%;/*-----------------*/
                    pointer-events: none; z-index: 10; } .bbgl-day-cell:is(.shimmer-active, .is-viewing) .jewel-type-gold .jewel-shine {
                    opacity: 1; animation: gold-roll 1.2s cubic-bezier(.3, 0, .55, 1) 1 forwards; }/*-------------------------------------*/
                    .bbgl-day-cell:is(.shimmer-active, .is-viewing) :is(.jewel-type-green, .jewel-type-diamond) .jewel-shine { opacity: 1;
                    animation: green-flash 1.7s ease-out 1 forwards; }/*------------------------------------------------------------------*/
                    .bbgl-day-cell:is(.shimmer-active, .is-viewing) :is(.jewel-type-green, .jewel-type-diamond) .jewel-shine-over {/*-----*/
                    opacity: 1; animation: green-flash-over 1.7s ease-out 1 forwards; }/*-------------------------------------------------*/
                    .bbgl-day-cell:is(.shimmer-active, .is-viewing) .sticker-shine {/*----------------------------------------------------*/
                    animation: bbgl-auto-shimmer 2.4s cubic-bezier(.3, 0, .55, 1) 2 alternate forwards; opacity: 1; } .day-num {/*--------*/
                    --day-num-size: 18px; position: absolute; top: 3px; left: 2px; font-size: 10px; width: var(--day-num-size);/*---------*/
                    height: var(--day-num-size); color: #fff; font-weight: 400; font-family: 'Fjalla One', 'Arial', sans-serif;/*---------*/
                    pointer-events: none; display: flex; align-items: center; justify-content: center; border-radius: 50%;/*--------------*/
                    transition: all .2s; z-index: 20; } .bbgl-day-cell.ghost-cell .day-num { color: #999; }/*-----------------------------*/
                    body:not(.is-touch-device) .bbgl-day-cell:not(.empty):not(.is-viewing):hover .day-num, .bbgl-day-cell:not(.empty):not(.is-viewing).is-scrub-hovered .day-num {
                    color: #fff; background: #555; transform: scale(1); } .bbgl-day-cell.is-viewing .day-num { color: #fff;/*-------------*/
                    background: #888; transform: none; z-index: 50; font-size: 12px !important; } .bbgl-weekly-anchor { width: 100%;/*----*/
                    height: 15px; position: relative; z-index: 20; --bbgl-tab-w: 44px; --bbgl-track-h: 15px; }/*--------------------------*/
                    #bbgl-panel.bbgl-compact .bbgl-weekly-anchor { height: 12px; --bbgl-tab-w: 28px; --bbgl-track-h: 12px; }/*------------*/
                    #bbgl-panel.bbgl-expanded .bbgl-weekly-anchor { --bbgl-tab-w: clamp(32px, calc(32px + 12px * var(--bbgl-dock-t)), 44px);
                    } #bbgl-panel.bbgl-mode-page .bbgl-weekly-anchor {/*------------------------------------------------------------------*/
                    --bbgl-tab-w: clamp(32px, calc(32px + 12px * var(--bbgl-page-t)), 44px); } .bbgl-weekly-track { position: absolute;/*-*/
                    bottom: 0; left: var(--bbgl-tab-w); width: calc(100% - var(--bbgl-tab-w)); height: 15px; display: flex; cursor: pointer;
                    border-radius: 0 4px 4px 0; overflow: hidden; pointer-events: auto;/*-------------------------------------------------*/
                    background: repeating-linear-gradient(90deg, transparent 0, transparent 1px, rgba(255, 255, 255, .03) 1px, rgba(255, 255, 255, .03) 2px), linear-gradient(180deg, #1a1a1a 0%, #2a2a2a 100%);
                    box-shadow: inset 0 2px 5px rgba(0, 0, 0, .8), inset 0 -1px 0 rgba(255, 255, 255, .05); }/*---------------------------*/
                    #bbgl-panel.bbgl-compact .bbgl-weekly-track { height: 12px; } .bbgl-weekly-track.is-viewing {/*-----------------------*/
                    box-shadow: 0 0 5px rgba(255, 255, 255, .3), inset 0 2px 5px rgba(0, 0, 0, .8); } .bbgl-weekly-track.track-polished {
                    box-shadow: 0 1px 3px rgba(0, 0, 0, .5); }/*--------------------------------------------------------------------------*/
                    #bbgl-panel.bbgl-no-animations .bbgl-day-cell.is-viewing :is(.jewel-type-gold .jewel-shine, .jewel-type-green .jewel-shine, .jewel-type-green .jewel-shine-over, .jewel-type-diamond .jewel-shine, .jewel-type-diamond .jewel-shine-over, .sticker-shine) {
                    animation: none !important; opacity: 0 !important; } /* Weekly-bar capsule sweep \u2014 was per-capsule SMIL (<animateTransform>/<animate>) inside the SVG, then a shared CSS animation on an SVG shape. Neither got a real GPU compositor layer (inline SVG shapes don't reliably get one for transform/opacity, especially combined with clip-path), so both still forced real per-frame repainting. This is now a plain HTML overlay instead: each lit capsule's fill window gets a small position:absolute, overflow:hidden div (bbgl-cap-win) placed over the SVG via percentages of the shared track (the SVG's viewBox scales the same way, so they stay aligned at any panel size), containing the animated gradient band (bbgl-cap-sweep). overflow:hidden is a reliably GPU-composited clip, unlike SVG clip-path, so the animation itself is now genuinely compositor-only. */ .bbgl-cap-overlay { position: absolute; inset: 0;
                    pointer-events: none; } .bbgl-cap-win { position: absolute; overflow: hidden; } .bbgl-cap-sweep { position: absolute;
                    inset: 0; opacity: 0; }/*---------------------------------------------------------------------------------------------*/
                    /* Only animate while the row is actually being looked at \u2014 hovered, the currently-viewed week, or touch-scrubbed. At rest the sweep is an inert, non-animating opacity:0 div (near-zero cost); this cuts the number of simultaneously-animating sweeps from "every completed week on screen" down to "at most the one row the mouse is on". */ .bbgl-weekly-track:hover .bbgl-cap-sweep, .bbgl-weekly-track.is-viewing .bbgl-cap-sweep, .bbgl-weekly-track.is-scrub-hovered .bbgl-cap-sweep {
                    will-change: transform, opacity; }/*----------------------------------------------------------------------------------*/
                    /* Two one-way local passes per capsule (see CAP_WIN_DELAY_FWD_S/BWD_S in buildCapsuleBar) instead of one capsule-local bounce \u2014 that's what makes the whole bar read as one band traveling to the far end and back, rather than each capsule bouncing on its own. */ .bbgl-weekly-track:hover .bbgl-cap-sweep-pass-fwd, .bbgl-weekly-track.is-viewing .bbgl-cap-sweep-pass-fwd, .bbgl-weekly-track.is-scrub-hovered .bbgl-cap-sweep-pass-fwd {
                    animation: bbgl-cap-sweep-move-fwd-kf 4s cubic-bezier(.3, 0, .7, 1) infinite, bbgl-cap-sweep-fade-pass-kf 4s linear infinite;
                    }/*-------------------------------------------------------------------------------------------------------------------*/
                    .bbgl-weekly-track:hover .bbgl-cap-sweep-pass-bwd, .bbgl-weekly-track.is-viewing .bbgl-cap-sweep-pass-bwd, .bbgl-weekly-track.is-scrub-hovered .bbgl-cap-sweep-pass-bwd {
                    animation: bbgl-cap-sweep-move-bwd-kf 4s cubic-bezier(.3, 0, .7, 1) infinite, bbgl-cap-sweep-fade-pass-kf 4s linear infinite;
                    } /* Wide pure-white plateau at the core (not just a point) flanked by near-white, fading through the tier's own hue at the edges \u2014 a bigger, bolder flash. Still a static background, so only transform/opacity animate and the compositor-only behavior from earlier is unaffected. */ .bbgl-cap-sweep-green {/*--------------------------------------------------------------------------*/
                    background: linear-gradient(90deg, rgba(68, 255, 0, 0) 0%, rgba(120, 255, 60, .95) 15%, rgba(210, 255, 190, 1) 35%, rgba(255, 255, 255, 1) 45%, rgba(255, 255, 255, 1) 55%, rgba(210, 255, 190, 1) 65%, rgba(120, 255, 60, .95) 85%, rgba(68, 255, 0, 0) 100%);
                    } .bbgl-cap-sweep-gold {/*--------------------------------------------------------------------------------------------*/
                    background: linear-gradient(90deg, rgba(255, 170, 0, 0) 0%, rgba(255, 210, 80, .95) 15%, rgba(255, 252, 230, 1) 35%, rgba(255, 255, 255, 1) 45%, rgba(255, 255, 255, 1) 55%, rgba(255, 252, 230, 1) 65%, rgba(255, 210, 80, .95) 85%, rgba(255, 170, 0, 0) 100%);
                    } .bbgl-cap-sweep-diamond {/*-----------------------------------------------------------------------------------------*/
                    background: linear-gradient(90deg, rgba(170, 68, 255, 0) 0%, rgba(215, 160, 255, .95) 15%, rgba(245, 245, 255, 1) 35%, rgba(255, 255, 255, 1) 45%, rgba(255, 255, 255, 1) 55%, rgba(225, 245, 255, 1) 65%, rgba(160, 215, 255, .95) 85%, rgba(68, 170, 255, 0) 100%);
                    } /* One-way local pass, left-to-right \u2014 this is the "outbound" leg. Each capsule's own copy is delayed by CAP_WIN_DELAY_FWD_S so the whole row of capsules lights up in left-to-right order, like a single band traveling the length of the bar rather than each capsule bouncing independently. */ @keyframes bbgl-cap-sweep-move-fwd-kf { 0% { transform: translateX(-100%) } 15%, 100% {/*----------*/
                    transform: translateX(100%) } } /* The "return" leg \u2014 same shape, opposite direction. Delayed per-capsule by CAP_WIN_DELAY_BWD_S, which runs in REVERSE order (rightmost capsule first) and only starts once every capsule's forward pass has finished, so the band appears to arrive at the right end, then travel all the way back. */ @keyframes bbgl-cap-sweep-move-bwd-kf { 0% {/*-----------------------*/
                    transform: translateX(100%) } 15%, 100% { transform: translateX(-100%) } }/*------------------------------------------*/
                    /* Shared fade shape for both legs \u2014 fade in, a real sustained plateau at full brightness (not just a fleeting peak), fade out, then invisible for the rest of that leg's own idle stretch. */ @keyframes bbgl-cap-sweep-fade-pass-kf { 0%, 15%, 100% { opacity: 0 } 3.75%, 11.25% { opacity: 1 } }
                    #bbgl-panel.bbgl-no-animations .bbgl-cap-sweep { animation: none; opacity: 0; }/*-------------------------------------*/
                    #bbgl-panel.bbgl-no-rates .g-pill[data-val="rates"] { display: none; }/*----------------------------------------------*/
                    #bbgl-panel.bbgl-no-rates .c-gain.cell-stack, #bbgl-panel.bbgl-no-rates .c-gain { justify-content: center; }/*--------*/
                    #bbgl-panel.bbgl-no-rates .c-gain .l-bot { min-height: 0; } .bbgl-cap-svg { display: block; width: 100%; height: 100%; }
                    /* \u2500\u2500\u2500 Weekly Bar Handle \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */ .bbgl-bar-handle { position: absolute; bottom: 0; left: 0; width: var(--bbgl-tab-w); height: 24px;/*-*/
                    z-index: 110; pointer-events: auto; cursor: pointer; border-radius: 5px 5px 0 0; box-sizing: border-box;/*------------*/
                    padding: 3px 5px 3px; background-color: #202020;/*--------------------------------------------------------------------*/
                    background-image: linear-gradient(180deg, #202020 0%, #363636 40%, #404040 50%, #363636 60%, #181818 100%);/*---------*/
                    background-size: 100% var(--bbgl-track-h); background-position: bottom center; background-repeat: no-repeat;/*--------*/
                    /* 3D edge highlights on raised tab \u2014 no right-edge shadow to avoid junction seam */ box-shadow: inset 0 1px 0 rgba(255,255,255,.22), inset 1px 0 0 rgba(255,255,255,.14);/*--------------*/
                    transition: height .2s cubic-bezier(.18, .89, .32, 1.28), box-shadow .15s ease; } .bbgl-bar-handle svg { display: block;
                    width: 100%; height: 100%; overflow: hidden; } /* Compact: shorter tab */ #bbgl-panel.bbgl-compact .bbgl-bar-handle {/*---------*/
                    height: 20px; padding: 2px 4px 2px; } /* Expanded: clamp height with panel width */ #bbgl-panel.bbgl-expanded .bbgl-bar-handle {/*-----------------*/
                    height: clamp(20px, calc(20px + 4px * var(--bbgl-dock-t)), 24px); }/*-------------------------------------------------*/
                    /* Page mode: clamp height with --bbgl-page-t */ #bbgl-panel.bbgl-mode-page .bbgl-bar-handle {/*------------------------------------------------------*/
                    height: clamp(22px, calc(22px + 4px * var(--bbgl-page-t)), 26px); }/*-------------------------------------------------*/
                    body:not(.is-touch-device) .bbgl-weekly-track:hover ~ .bbgl-bar-handle, .bbgl-weekly-track.is-scrub-hovered ~ .bbgl-bar-handle, .bbgl-weekly-track.is-viewing ~ .bbgl-bar-handle, body:not(.is-touch-device) .bbgl-bar-handle:hover {
                    height: 32px; --bbgl-handle-active-h: 32px;/*-------------------------------------------------------------------------*/
                    box-shadow: inset 0 1px 0 rgba(255,255,255,.38), inset 1px 0 0 rgba(255,255,255,.25); }/*-----------------------------*/
                    body:not(.is-touch-device) .bbgl-weekly-track:hover ~ .bbgl-bar-handle::before, .bbgl-weekly-track.is-scrub-hovered ~ .bbgl-bar-handle::before, .bbgl-weekly-track.is-viewing ~ .bbgl-bar-handle::before, body:not(.is-touch-device) .bbgl-bar-handle:hover::before {
                    opacity: 1; } .bbgl-bar-handle::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 100%;/*--*/
                    border-radius: 5px 5px 0 0; background: radial-gradient(circle at top left, rgba(255,255,255,.25) 0%, transparent 70%);
                    box-shadow: none; opacity: 0; pointer-events: none; transition: opacity .15s ease; }/*--------------------------------*/
                    /* Left-edge glow on the track bleeds from the tab on hover \u2014 both sides light up together */ body:not(.is-touch-device) .bbgl-weekly-track:hover, .bbgl-weekly-track.is-scrub-hovered, .bbgl-weekly-track.is-viewing {
                    background: linear-gradient(90deg, rgba(255,255,255,.08) 0%, transparent 12%), repeating-linear-gradient(90deg, transparent 0, transparent 1px, rgba(255, 255, 255, .03) 1px, rgba(255, 255, 255, .03) 2px), linear-gradient(180deg, #1a1a1a 0%, #2a2a2a 100%);
                    }/*-------------------------------------------------------------------------------------------------------------------*/
                    body:not(.is-touch-device) #bbgl-panel.bbgl-compact .bbgl-weekly-track:hover ~ .bbgl-bar-handle, #bbgl-panel.bbgl-compact .bbgl-weekly-track.is-scrub-hovered ~ .bbgl-bar-handle, #bbgl-panel.bbgl-compact .bbgl-weekly-track.is-viewing ~ .bbgl-bar-handle, body:not(.is-touch-device) #bbgl-panel.bbgl-compact .bbgl-bar-handle:hover {
                    height: 26px; --bbgl-handle-active-h: 26px; }/*-----------------------------------------------------------------------*/
                    body:not(.is-touch-device) #bbgl-panel.bbgl-expanded .bbgl-weekly-track:hover ~ .bbgl-bar-handle, #bbgl-panel.bbgl-expanded .bbgl-weekly-track.is-scrub-hovered ~ .bbgl-bar-handle, #bbgl-panel.bbgl-expanded .bbgl-weekly-track.is-viewing ~ .bbgl-bar-handle, body:not(.is-touch-device) #bbgl-panel.bbgl-expanded .bbgl-bar-handle:hover {
                    height: clamp(26px, calc(26px + 6px * var(--bbgl-dock-t)), 32px);/*---------------------------------------------------*/
                    --bbgl-handle-active-h: clamp(26px, calc(26px + 6px * var(--bbgl-dock-t)), 32px); }/*---------------------------------*/
                    body:not(.is-touch-device) #bbgl-panel.bbgl-mode-page .bbgl-weekly-track:hover ~ .bbgl-bar-handle, #bbgl-panel.bbgl-mode-page .bbgl-weekly-track.is-scrub-hovered ~ .bbgl-bar-handle, #bbgl-panel.bbgl-mode-page .bbgl-weekly-track.is-viewing ~ .bbgl-bar-handle, body:not(.is-touch-device) #bbgl-panel.bbgl-mode-page .bbgl-bar-handle:hover {
                    height: clamp(30px, calc(30px + 6px * var(--bbgl-page-t)), 36px);/*---------------------------------------------------*/
                    --bbgl-handle-active-h: clamp(30px, calc(30px + 6px * var(--bbgl-page-t)), 36px); }/*---------------------------------*/
                    #bbgl-panel.bbgl-no-animations .bbgl-bar-handle { transition: none; } /* \u2500\u2500\u2500 Level EXP Bar \u2014 Structural \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */ #bbgl-level-container {/*------*/
                    position: absolute; bottom: 0; left: 0; right: 0; height: 18px; /* Track height for this mode, shared by the flag-clip cut line and the A2 diamond's bottom anchor so they stay in sync. Overridden per mode. */ --bbgl-track-h: 9px; display: flex;
                    flex-direction: column; align-items: center; justify-content: flex-end; pointer-events: none; z-index: 10; }/*--------*/
                    /* Sibling of #bbgl-level-container, painted behind it, holding the housing SVG. Never clipped. */ #bbgl-level-bg { position: absolute; bottom: 0; left: 0; right: 0; height: 9px; pointer-events: none; }
                    /* Wraps the tucking badge \u2014 both the text flag (#bbgl-level-num) and, for A2, the diamond crown (::before). A normal, non-transformed flex item whose bottom edge sits at the top of the bar (track height above the container bottom). The NEGATIVE clip bottom-inset pushes the cut line DOWN from there to about halfway into the bar, so the badge rests fully visible on top of the bar and only gets sliced once it has tucked down past the midpoint. Left/right insets are opened up (-9999px) so the wide diamond isn't clipped on its sides \u2014 only the bottom cut matters. Because this wrapper never transforms, that cut line is screen-fixed: the badge translateY()s through it during the crown-tuck/rise animation, instead of the clip boundary sliding along with the badge (which is what happens if the clip is on the transformed badge itself). */ #bbgl-level-flag-clip { position: relative; z-index: 3; flex-shrink: 0;/*----------------------------*/
                    clip-path: inset(-9999px -9999px calc(var(--bbgl-track-h) * -0.5) -9999px); /* #bbgl-level-container (panel version) is pointer-events:none since it's an absolute overlay that shouldn't block calendar clicks underneath it \u2014 re-enable it here so the level tooltip is still hoverable/tappable. */ pointer-events: auto; }
                    /* Single shared rule for every atrophy-tier badge graphic (A0 crown, A2 diamond, ...) instead of setting pointer-events on each tier's own ::before block individually \u2014 whichever one is actually generated (content: '' set by its own [data-atrophy="N"]-scoped rule) picks this up. */ #bbgl-level-flag-clip::before, #bbgl-gym-level-container::before { pointer-events: auto; }/*---------*/
                    #bbgl-level-num { font-family: 'Aldrich', 'Fjalla One', 'Arial Narrow', sans-serif; font-size: clamp(7px, 1.8cqi, 10px);
                    font-weight: 700; letter-spacing: 0.5px; line-height: 1; white-space: nowrap; position: relative; display: block;/*---*/
                    transform-origin: bottom center; }/*----------------------------------------------------------------------------------*/
                    #bbgl-panel.bbgl-compact #bbgl-level-num .bbgl-lv-prefix, #bbgl-gym-level-num .bbgl-lv-prefix { display: none; }/*----*/
                    #bbgl-level-track, #bbgl-gym-level-track { position: relative; z-index: 2; width: 100%; height: 9px; flex-shrink: 0;
                    border-radius: 0; overflow: hidden; background: none; box-shadow: none; pointer-events: auto; }/*---------------------*/
                    #bbgl-level-fill, #bbgl-gym-level-fill { position: absolute; top: 18%; left: 1.6%; height: 64%; width: 0%; z-index: 2;
                    border-radius: 0; transition: width .8s cubic-bezier(.25, 1, .5, 1); will-change: width; }/*--------------------------*/
                    @keyframes bbgl-lvl-flash-dmnd { 0% { filter: brightness(1) drop-shadow(0 0 0 rgba(255,255,255,0));/*-----------------*/
                    transform: translateX(-50%) scale(1); } 20% { filter: brightness(1.4) drop-shadow(0 0 8px rgba(255,255,255,0.4));/*---*/
                    transform: translateX(-50%) scale(1.15); } 100% { filter: brightness(1) drop-shadow(0 0 0 rgba(255,255,255,0));/*-----*/
                    transform: translateX(-50%) scale(1); } } @keyframes bbgl-lvl-flash-text { 0% { transform: scale(1); } 20% {/*--------*/
                    color: #ffffff; text-shadow: 0 0 10px #ffffff, 0 0 20px #ffffff, 0 0 30px #ffffff, 0 0 40px #66ff33, 0 0 60px #66ff33;
                    transform: scale(1.4); } 100% { transform: scale(1); } } @keyframes bbgl-lvl-flash-bar { 0% { filter: brightness(1); }
                    20% { filter: brightness(1.8); } 100% { filter: brightness(1); } } @keyframes bbgl-lvl-flash-track { 0% { filter: none;
                    } 20% {/*-------------------------------------------------------------------------------------------------------------*/
                    filter: brightness(1.3) drop-shadow(0 0 10px rgba(217, 160, 255, 1)) drop-shadow(0 0 22px rgba(180, 100, 255, 0.6)); }
                    100% { filter: none; } } @keyframes bbgl-lvl-flash-track-a0 { 0% { filter: none; } 20% {/*----------------------------*/
                    filter: brightness(1.3) drop-shadow(0 0 10px rgba(100, 255, 60, 1)) drop-shadow(0 0 22px rgba(60, 200, 20, 0.6)); }/*-*/
                    100% { filter: none; } } @keyframes bbgl-lvl-flash-track-a0-white { 0% { filter: none; } 20% {/*----------------------*/
                    filter: brightness(1.5) drop-shadow(0 0 12px rgba(255, 255, 255, 1)) drop-shadow(0 0 24px rgba(255, 255, 255, 0.8)); }
                    100% { filter: none; } } @keyframes bbgl-lvl-flash-text-white { 0% { transform: scale(1); } 20% { color: #ffffff;/*---*/
                    text-shadow: 0 0 10px #ffffff, 0 0 20px #ffffff, 0 0 30px #ffffff, 0 0 40px #cccccc, 0 0 60px #cccccc;/*--------------*/
                    transform: scale(1.4); } 100% { transform: scale(1); } }/*------------------------------------------------------------*/
                    /* \u2500\u2500\u2500 Atrophy Tier-Complete Sequence \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Crown tucks away (mole-in-hole pop), the next tier's crown rises into place (podium reveal + spotlight), then "Atrophied!" flashes. */ /* No opacity fade here on purpose \u2014 the container's clip-path (see #bbgl-level-container) gives a hard cutoff at the bottom of the exp bar as the flag translates past it, so it reads as sliding behind an edge rather than fading out. */ @keyframes bbgl-crown-tuck-kf { 0% { transform: translateX(-50%) translateY(0); }/*-*/
                    35% { transform: translateX(-50%) translateY(-16%); } 100% { transform: translateX(-50%) translateY(130%); } }/*------*/
                    @keyframes bbgl-crown-rise-kf { 0% { transform: translateX(-50%) translateY(130%);/*----------------------------------*/
                    filter: brightness(1) drop-shadow(0 0 0 rgba(255,255,255,0)); } 70% { transform: translateX(-50%) translateY(-8%);/*--*/
                    filter: brightness(1.7) drop-shadow(0 0 14px rgba(255,255,255,0.7)); } 100% { transform: translateX(-50%) translateY(0);
                    filter: brightness(1) drop-shadow(0 0 0 rgba(255,255,255,0)); } } /* Same tuck/rise motion, for the current text-badge flags (A0/A1) which are real DOM elements (not the ::before image slot), so no translateX(-50%) centering hack is needed \u2014 they're already centered via flexbox. */ @keyframes bbgl-flag-tuck-kf { 0% {
                    transform: translateY(0); } 35% { transform: translateY(-16%); } 100% { transform: translateY(130%); } }/*------------*/
                    @keyframes bbgl-flag-rise-kf { 0% { transform: translateY(130%);/*----------------------------------------------------*/
                    filter: brightness(1) drop-shadow(0 0 0 rgba(255,255,255,0)); } 70% { transform: translateY(-8%);/*-------------------*/
                    filter: brightness(1.7) drop-shadow(0 0 14px rgba(255,255,255,0.7)); } 100% { transform: translateY(0);/*-------------*/
                    filter: brightness(1) drop-shadow(0 0 0 rgba(255,255,255,0)); } } @keyframes bbgl-atrophied-flash-kf { 0% { opacity: 0;
                    transform: translateX(-50%) scale(0.6); } 30% { opacity: 1; transform: translateX(-50%) scale(1.15); } 55% { opacity: 1;
                    transform: translateX(-50%) scale(1); } 85% { opacity: 1; } 100% { opacity: 0; transform: translateX(-50%) scale(1); } }
                    /* The container (flag + track + fill) sits at z-index:10, above .bbgl-grid-container (auto/0), so it always paints in front of the calendar. To let the flag actually dip *behind* the calendar rather than just sliding down over it, drop the whole container below the grid for the middle of the tuck/rise motion, then restore it once the flag is settled (or mid-reveal for the rise) so the bar and the "Atrophied!" flash still read in front as normal. */ @keyframes bbgl-tier-tuck-z-kf { 0% { z-index: 10; } 35% { z-index: 10; } 36% { z-index: 0; } 100% {
                    z-index: 0; } } @keyframes bbgl-tier-rise-z-kf { 0% { z-index: 0; } 69% { z-index: 0; } 70% { z-index: 10; } 100% {/*-*/
                    z-index: 10; } } .bbgl-crown-tuck { animation: bbgl-tier-tuck-z-kf 0.35s steps(1, end) forwards; } .bbgl-crown-rise {
                    animation: bbgl-tier-rise-z-kf 0.9s steps(1, end) forwards; }/*-------------------------------------------------------*/
                    /* Diamond tuck/rise. The tuck class is on the container; gym's diamond is the container's own ::before, main panel's is the flag-clip wrapper's ::before, so both are targeted. */ .bbgl-crown-tuck::before, .bbgl-crown-tuck #bbgl-level-flag-clip::before {/*-------------------------*/
                    animation: bbgl-crown-tuck-kf 0.35s ease-in-out forwards; }/*---------------------------------------------------------*/
                    .bbgl-crown-rise::before, .bbgl-crown-rise #bbgl-level-flag-clip::before {/*------------------------------------------*/
                    animation: bbgl-crown-rise-kf 0.9s ease-out forwards; }/*-------------------------------------------------------------*/
                    .bbgl-crown-tuck #bbgl-level-num, .bbgl-crown-tuck #bbgl-gym-level-num {/*--------------------------------------------*/
                    animation: bbgl-flag-tuck-kf 0.35s ease-in-out forwards; }/*----------------------------------------------------------*/
                    .bbgl-crown-rise #bbgl-level-num, .bbgl-crown-rise #bbgl-gym-level-num {/*--------------------------------------------*/
                    animation: bbgl-flag-rise-kf 0.9s ease-out forwards; } .bbgl-atrophied-flash::after { content: 'Atrophied!';/*--------*/
                    position: absolute; bottom: calc(100% + 4px); left: 50%; white-space: nowrap; pointer-events: none; z-index: 4;/*-----*/
                    font-family: 'Fjalla One', 'Arial Narrow', sans-serif; font-weight: 800;/*--------------------------------------------*/
                    font-size: clamp(11px, calc(11px + 5px * var(--bbgl-dock-t, 0)), 16px); letter-spacing: 0.5px; color: #fff;/*---------*/
                    text-shadow: 0 0 6px #ffee66, 0 0 14px #ffcc00, 0 0 24px #ff8800;/*---------------------------------------------------*/
                    animation: bbgl-atrophied-flash-kf 0.7s ease-out forwards; }/*--------------------------------------------------------*/
                    .bbgl-level-up-flash::before, .bbgl-level-up-flash #bbgl-level-flag-clip::before {/*----------------------------------*/
                    animation: bbgl-lvl-flash-dmnd 0.8s ease-out; } .bbgl-level-up-flash #bbgl-level-num {/*------------------------------*/
                    animation: bbgl-lvl-flash-text 0.8s ease-out; } .bbgl-level-up-flash #bbgl-level-fill {/*-----------------------------*/
                    animation: bbgl-lvl-flash-bar 0.8s ease-out; }/*----------------------------------------------------------------------*/
                    .bbgl-level-up-flash #bbgl-level-track, .bbgl-level-up-flash #bbgl-gym-level-track {/*--------------------------------*/
                    animation: bbgl-lvl-flash-track 0.8s ease-out; } #bbgl-panel.bbgl-expanded #bbgl-level-container { height: 22px;/*----*/
                    --bbgl-track-h: 14px; } #bbgl-panel.bbgl-expanded #bbgl-level-bg, #bbgl-panel.bbgl-expanded #bbgl-level-track {/*-----*/
                    height: 14px; } #bbgl-panel.bbgl-expanded #bbgl-level-num {/*---------------------------------------------------------*/
                    font-size: clamp(9px, calc(9px + 2px * var(--bbgl-dock-t)), 11px); } #bbgl-panel.bbgl-mode-page #bbgl-level-container {
                    height: clamp(18px, calc(18px + 8px * var(--bbgl-page-t)), 26px);/*---------------------------------------------------*/
                    --bbgl-track-h: clamp(8px, calc(8px + 6px * var(--bbgl-page-t)), 14px); }/*-------------------------------------------*/
                    #bbgl-panel.bbgl-mode-page #bbgl-level-bg, #bbgl-panel.bbgl-mode-page #bbgl-level-track {/*---------------------------*/
                    height: clamp(8px, calc(8px + 6px * var(--bbgl-page-t)), 14px); } #bbgl-panel.bbgl-mode-page #bbgl-level-num {/*------*/
                    font-size: clamp(6px, calc(6px + 6px * var(--bbgl-page-t)), 12px); } /* \u2500\u2500\u2500 Gym Page Level Bar \u2014 Structural \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */ #bbgl-gym-level-container {/*---*/
                    position: relative; width: 100%; margin-top: 24px; margin-bottom: -4px; --bbgl-track-h: 9px; display: flex;/*---------*/
                    flex-direction: column; align-items: center; container-type: inline-size; clip-path: inset(-9999px 0 0 0); }/*--------*/
                    #bbgl-gym-level-num { font-family: 'Aldrich', 'Fjalla One', 'Arial Narrow', sans-serif;/*-----------------------------*/
                    font-size: clamp(6.5px, 1.0cqi, 8.5px); font-weight: 700; letter-spacing: 0.5px; line-height: 1; white-space: nowrap;
                    position: relative; z-index: 3; } .bbgl-level-up-flash #bbgl-gym-level-num {/*----------------------------------------*/
                    animation: bbgl-lvl-flash-text 0.8s ease-out; } .bbgl-level-up-flash #bbgl-gym-level-fill {/*-------------------------*/
                    animation: bbgl-lvl-flash-bar 0.8s ease-out; } /* \u2500\u2500\u2500 Level Bar \u2014 A1 flag: structure \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 --f-bdr (border), --f-bg-top/--f-bg (background gradient), --f-hi (inner highlight) are supplied by the A1 palette below. */ #bbgl-panel[data-atrophy="1"] #bbgl-level-num {/*-----*/
                    --f-r: clamp(5px, calc(5px + 3px * var(--bbgl-dock-t, 0)), 8px);/*----------------------------------------------------*/
                    padding: 3px clamp(8px, calc(8px + 6px * var(--bbgl-dock-t, 0)), 14px); border-top: 1px solid var(--f-bdr);/*---------*/
                    border-left: none; border-right: none; border-bottom: none; border-radius: 5px 5px 0 0;/*-----------------------------*/
                    background: linear-gradient(180deg, var(--f-bg-top) 0%, var(--f-bg) 100%); backdrop-filter: blur(4px);/*--------------*/
                    -webkit-backdrop-filter: blur(4px); box-shadow: inset 0 1px 1px var(--f-hi), 0 -1px 3px rgba(0, 0, 0, 0.4);/*---------*/
                    margin-bottom: -1px; z-index: 1; } #bbgl-gym-level-container[data-atrophy="1"] #bbgl-gym-level-num {/*----------------*/
                    --f-r: clamp(5px, 1.3cqi, 8px); padding: 3px clamp(8px, 2cqi, 14px); border-top: 1px solid var(--f-bdr);/*------------*/
                    border-left: none; border-right: none; border-bottom: none; border-radius: 5px 5px 0 0;/*-----------------------------*/
                    background: linear-gradient(180deg, var(--f-bg-top) 0%, var(--f-bg) 100%); backdrop-filter: blur(4px);/*--------------*/
                    -webkit-backdrop-filter: blur(4px); box-shadow: inset 0 1px 1px var(--f-hi), 0 -1px 3px rgba(0, 0, 0, 0.4);/*---------*/
                    margin-bottom: -1px; z-index: 1; }/*----------------------------------------------------------------------------------*/
                    /* Rounded corner flares at the flag's feet (A1). */ #bbgl-panel[data-atrophy="1"] #bbgl-level-num::before, #bbgl-gym-level-container[data-atrophy="1"] #bbgl-gym-level-num::before {
                    content: ''; position: absolute; bottom: 0; left: calc(-1 * var(--f-r) + 1px); right: calc(-1 * var(--f-r) + 1px);/*--*/
                    height: var(--f-r); z-index: -1; pointer-events: none; --f-r-in: calc(var(--f-r) - 1px);/*----------------------------*/
                    background: radial-gradient(circle at 0 0, transparent var(--f-r-in), var(--f-bdr) var(--f-r-in), var(--f-bdr) var(--f-r), var(--f-bg) var(--f-r)) left bottom / var(--f-r) var(--f-r) no-repeat, radial-gradient(circle at 100% 0, transparent var(--f-r-in), var(--f-bdr) var(--f-r-in), var(--f-bdr) var(--f-r), var(--f-bg) var(--f-r)) right bottom / var(--f-r) var(--f-r) no-repeat;
                    } /* \u2500\u2500\u2500 Level Bar \u2014 A0: Crown badge (script logo) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Same icon-badge treatment as A2's diamond: the crown sits behind the bar via a ::before background-image, "Lv X" floats above it as plain text (no flag box). */ #bbgl-panel[data-atrophy="0"] #bbgl-level-container { --crwn-s: clamp(30px, 8cqi, 38px); }/*-------*/
                    #bbgl-gym-level-container[data-atrophy="0"] { --crwn-s: clamp(30px, 7.5cqi, 34px); }/*--------------------------------*/
                    #bbgl-panel[data-atrophy="0"].bbgl-expanded #bbgl-level-container {/*-------------------------------------------------*/
                    --crwn-s: clamp(42px, calc(42px + 10px * var(--bbgl-dock-t)), 52px); }/*----------------------------------------------*/
                    #bbgl-panel[data-atrophy="0"].bbgl-mode-page #bbgl-level-container {/*------------------------------------------------*/
                    --crwn-s: calc(clamp(30px, 8cqi, 38px) + 18px * var(--bbgl-page-t)); }/*----------------------------------------------*/
                    /* Main panel crown \u2014 lives on the flag-clip wrapper. The wrapper's own bottom edge already sits at the top of the bar (see the flag-clip comment above), so bottom:0 here lands the crown's bottom edge flush with the top of the track \u2014 no overlap into the bar. */ #bbgl-panel[data-atrophy="0"] #bbgl-level-flag-clip::before { content: ''; position: absolute;/*-----*/
                    bottom: 0; left: 50%; transform-origin: 50% 100%; transform: translateX(-50%); width: calc(var(--crwn-s) * 1.3);/*----*/
                    height: calc(var(--crwn-s) * 0.85 + 1px); background: url("__CROWN_BADGE_URL__") center bottom / 100% 100% no-repeat;/*----*/
                    z-index: -1; } /* Gym page crown \u2014 old structure (no flag-clip wrapper): the container's own bottom edge is the bottom of the track, so the top of the track sits --bbgl-track-h above it. Same flush, no-overlap placement as the main panel version. */ #bbgl-gym-level-container[data-atrophy="0"]::before { content: ''; position: absolute;
                    bottom: var(--bbgl-track-h); left: 50%; transform-origin: 50% 100%; transform: translateX(-50%);/*--------------------*/
                    width: calc(var(--crwn-s) * 1.3); height: calc(var(--crwn-s) * 0.85 + 1px);/*-----------------------------------------*/
                    background: url("__CROWN_BADGE_URL__") center bottom / 100% 100% no-repeat; z-index: 1; }/*--------------------------------*/
                    #bbgl-panel[data-atrophy="0"] #bbgl-level-num, #bbgl-gym-level-container[data-atrophy="0"] #bbgl-gym-level-num {/*----*/
                    color: #f0f0f0; text-shadow: 0 0 1px #000, 0 0 2px #000, 0 0 3px rgba(0,0,0,0.8); margin-bottom: 1px;/*---------------*/
                    transform: scaleX(1.15); } #bbgl-panel[data-atrophy="0"].bbgl-expanded #bbgl-level-num { margin-bottom: 2px; }/*------*/
                    #bbgl-panel[data-atrophy="0"].bbgl-mode-page #bbgl-level-num {/*------------------------------------------------------*/
                    margin-bottom: clamp(1px, calc(1px + 1px * var(--bbgl-page-t)), 2px); }/*---------------------------------------------*/
                    /* \u2500\u2500\u2500 Level Bar \u2014 A1: Green palette \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */ #bbgl-panel[data-atrophy="1"] #bbgl-level-num, #bbgl-gym-level-container[data-atrophy="1"] #bbgl-gym-level-num {
                    color: #b3ffb3; text-shadow: 0 0 2px #33cc00, 0 0 6px #199900, 0 0 12px #199900; --f-bdr: rgba(30, 80, 10, 0.7);/*----*/
                    --f-bg-top: rgba(20, 60, 5, 0.75); --f-bg: rgba(5, 20, 0, 0.9); --f-hi: rgba(150, 255, 100, 0.15); }/*----------------*/
                    #bbgl-panel[data-atrophy="0"] #bbgl-level-track, #bbgl-gym-level-container[data-atrophy="0"] #bbgl-gym-level-track {
                    backdrop-filter: none; -webkit-backdrop-filter: none; } /* Suppress backdrop-filter while the compact<->expanded resize is animating: blurring what's behind this element has to be resampled every frame the panel's layer changes, which is one of the more GPU-expensive things to animate. Restored once settled. */ #bbgl-panel.bbgl-resizing #bbgl-level-num {
                    backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }/*---------------------------------------*/
                    #bbgl-panel[data-atrophy="0"] #bbgl-level-fill, #bbgl-gym-level-container[data-atrophy="0"] #bbgl-gym-level-fill {/*--*/
                    background: linear-gradient(180deg, #404040 0%, #808080 22%, #a8a8a8 38%, #c0c0c0 48%, #b0b0b0 52%, #888888 70%, #484848 100% );
                    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 -1px 0 rgba(0, 0, 0, 0.3); }/*----------------------------*/
                    #bbgl-panel[data-atrophy="1"] .bbgl-level-up-flash #bbgl-level-track, #bbgl-gym-level-container[data-atrophy="1"].bbgl-level-up-flash #bbgl-gym-level-track {
                    animation: bbgl-lvl-flash-track-a0 0.8s ease-out; }/*-----------------------------------------------------------------*/
                    #bbgl-panel[data-atrophy="0"] .bbgl-level-up-flash #bbgl-level-track, #bbgl-gym-level-container[data-atrophy="0"].bbgl-level-up-flash #bbgl-gym-level-track {
                    animation: bbgl-lvl-flash-track-a0-white 0.8s ease-out; }/*-----------------------------------------------------------*/
                    #bbgl-panel[data-atrophy="0"] .bbgl-level-up-flash #bbgl-level-num, #bbgl-gym-level-container[data-atrophy="0"].bbgl-level-up-flash #bbgl-gym-level-num {
                    animation: bbgl-lvl-flash-text-white 0.8s ease-out; }/*---------------------------------------------------------------*/
                    /* \u2500\u2500\u2500 Level Bar \u2014 A1: Green \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */ #bbgl-panel[data-atrophy="1"] #bbgl-level-fill, #bbgl-gym-level-container[data-atrophy="1"] #bbgl-gym-level-fill {
                    background: linear-gradient(180deg, #003322 0%, #008844 25%, #66bb22 40%, #ccffcc 50%, #00cc88 62%, #44aa00 78%, #001a0d 100% );
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.3); }/*----------------------------------*/
                    /* \u2500\u2500\u2500 Level Bar \u2014 A2: Diamond \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */ #bbgl-panel[data-atrophy="2"] #bbgl-level-container { --dmnd-s: clamp(60px, 16cqi, 76px);/*----------*/
                    --dmnd-b: calc(var(--dmnd-s) * -0.25); } #bbgl-gym-level-container[data-atrophy="2"] {/*------------------------------*/
                    --dmnd-s: clamp(76px, 12cqi, 90px); --dmnd-b: calc(var(--dmnd-s) * -0.25); }/*----------------------------------------*/
                    #bbgl-panel[data-atrophy="2"].bbgl-expanded #bbgl-level-container {/*-------------------------------------------------*/
                    --dmnd-s: clamp(70px, calc(70px + 18px * var(--bbgl-dock-t)), 88px); --dmnd-b: calc(var(--dmnd-s) * -0.23); }/*-------*/
                    #bbgl-panel[data-atrophy="2"].bbgl-mode-page #bbgl-level-container {/*------------------------------------------------*/
                    --dmnd-s: calc(clamp(60px, 16cqi, 76px) + 28px * var(--bbgl-page-t));/*-----------------------------------------------*/
                    --dmnd-b: calc(var(--dmnd-s) * (-0.25 + 0.02 * var(--bbgl-page-t))); }/*----------------------------------------------*/
                    /* A2 badge slot \u2014 main panel. Lives on the flag-clip wrapper so it shares the wrapper's screen-fixed cut line and tucks behind the bar like the text flag. Its offset parent (the wrapper) sits --bbgl-track-h above the container bottom, so the bottom anchor subtracts that to land the badge at the same spot the old container-relative anchor did. No self-clip \u2014 the wrapper does the clipping. z-index:-1 keeps the number text in front. No background image set \u2014 the diamond placeholder was pulled pending a replacement A2 tier asset; set the background property here once one exists. */ #bbgl-panel[data-atrophy="2"] #bbgl-level-flag-clip::before { content: ''; position: absolute;/*-----*/
                    bottom: calc(var(--dmnd-b) - var(--bbgl-track-h)); left: 50%; transform-origin: 50% calc(100% + var(--dmnd-b));/*-----*/
                    transform: translateX(-50%); width: var(--dmnd-s); height: var(--dmnd-s); z-index: -1; }/*----------------------------*/
                    /* A2 badge slot \u2014 gym page, old structure (no flag-clip wrapper), keeps its own self-clip. No background image set; see main panel slot above. */ #bbgl-gym-level-container[data-atrophy="2"]::before { content: ''; position: absolute;/*-------------*/
                    bottom: var(--dmnd-b); left: 50%; transform-origin: 50% calc(100% + var(--dmnd-b)); transform: translateX(-50%);/*----*/
                    width: var(--dmnd-s); height: var(--dmnd-s); clip-path: inset(0 0 calc(var(--dmnd-b) * -1 + 2px) 0); z-index: 1;/*----*/
                    pointer-events: none; }/*---------------------------------------------------------------------------------------------*/
                    #bbgl-panel[data-atrophy="2"] #bbgl-level-num, #bbgl-gym-level-container[data-atrophy="2"] #bbgl-gym-level-num {/*----*/
                    color: #b3ffb3; text-shadow: 0 0 2px #33cc00, 0 0 6px #199900, 0 0 12px #199900; margin-bottom: 7px; }/*--------------*/
                    #bbgl-panel[data-atrophy="2"].bbgl-expanded #bbgl-level-num { margin-bottom: 10px; }/*--------------------------------*/
                    #bbgl-panel[data-atrophy="2"].bbgl-mode-page #bbgl-level-num {/*------------------------------------------------------*/
                    margin-bottom: clamp(7px, calc(7px + 2px * var(--bbgl-page-t)), 9px); }/*---------------------------------------------*/
                    #bbgl-panel[data-atrophy="2"] #bbgl-level-fill, #bbgl-gym-level-container[data-atrophy="2"] #bbgl-gym-level-fill {/*--*/
                    background: linear-gradient(180deg, #442200 0%, #cc8800 25%, #ffcc00 40%, #fffff0 50%, #ffdd44 62%, #cc8800 78%, #221100 100% );
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.3); }/*----------------------------------*/
                    #bbgl-panel[data-atrophy="2"] #bbgl-level-fill.level-full, #bbgl-gym-level-container[data-atrophy="2"] #bbgl-gym-level-fill.level-full {
                    background: linear-gradient(180deg, #552200 0%, #dd9900 25%, #ffdd00 40%, #ffffff 50%, #ffee66 62%, #dd9900 78%, #221100 100% );
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3); }/*----------------------------------*/
                    #bbgl-panel[data-atrophy="2"][data-level="100"] #bbgl-level-fill.level-full, #bbgl-gym-level-container[data-atrophy="2"][data-level="100"] #bbgl-gym-level-fill.level-full {
                    background: linear-gradient(180deg, #220033 0%, #882299 25%, #ee77ff 40%, #eeeeff 50%, #88bbff 62%, #77ffcc 78%, #001122 100% );
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.3); }/*---------------------------------*/
                    /* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */ /* \u2500\u2500\u2500 Endocrine Enhancers Page \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */ .bbgl-ach-section-energy .bbgl-ach-section-title { border-bottom: none; }/*---------*/
                    .bbgl-enh-mode-switch { position: absolute; right: 2px; top: 50%; transform: translateY(-50%); display: flex;/*-------*/
                    align-items: center; gap: 0; z-index: 3; } .bbgl-enh-sw-opt { font-family: var(--bbgl-ach-font); font-size: 8px;/*----*/
                    font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #bbb; padding: 1px 5px; cursor: pointer;/*-*/
                    user-select: none; border: 1px solid #6a6a6a; line-height: 1.4; transition: background .15s; white-space: nowrap; }/*-*/
                    .bbgl-enh-sw-opt:first-child { border-radius: 3px 0 0 3px; border-right: none; } .bbgl-enh-sw-opt:last-child {/*------*/
                    border-radius: 0 3px 3px 0; } .bbgl-enh-sw-opt.active, body:not(.is-touch-device) .bbgl-enh-sw-opt:not(.active):hover {
                    background: rgba(255, 255, 255, 0.13); }/*----------------------------------------------------------------------------*/
                    body:not(.is-touch-device) .bbgl-ach-section-energy .bbgl-ach-title-row:has(.bbgl-enh-sw-opt:hover) .bbgl-ach-section-title {
                    color: #9a9a9a; } #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) .bbgl-enh-sw-opt {/*---------------------------------*/
                    font-size: clamp(8px, calc(8px + 1px * var(--bbgl-dock-t)), 9px); padding: 2px 7px; }/*-------------------------------*/
                    #bbgl-panel.bbgl-mode-page .bbgl-enh-sw-opt { font-size: clamp(6px, calc(6px + 4px * var(--bbgl-page-t)), 10px);/*----*/
                    padding: 2px 7px; } .bbgl-ach-section-energy .bbgl-ach-row { padding: var(--bbgl-ach-row-pad-v, 4px) 2px;/*-----------*/
                    border-bottom: 1px solid rgba(255, 255, 255, .05); } .bbgl-ach-section-energy .bbgl-ach-row:last-of-type {/*----------*/
                    border-bottom: none; } .ach-enh-e-label { color: #69f0ae; font-weight: 600; }/*---------------------------------------*/
                    /* Shared stat colors \u2014 single source for every achievement context (enhancer gains, row subscripts, grid headers, HH tags). */ .ach-enh-gained .ach-stat-str, .bbgl-ach-row .ach-sub.ach-stat-str, .ach-stat-header.ach-stat-str, .bbgl-ach-hh-tag.ach-stat-str {
                    color: #3264c6; }/*---------------------------------------------------------------------------------------------------*/
                    .ach-enh-gained .ach-stat-def, .bbgl-ach-row .ach-sub.ach-stat-def, .ach-stat-header.ach-stat-def, .bbgl-ach-hh-tag.ach-stat-def {
                    color: #dc3912; }/*---------------------------------------------------------------------------------------------------*/
                    .ach-enh-gained .ach-stat-spd, .bbgl-ach-row .ach-sub.ach-stat-spd, .ach-stat-header.ach-stat-spd, .bbgl-ach-hh-tag.ach-stat-spd {
                    color: #ff9900; }/*---------------------------------------------------------------------------------------------------*/
                    .ach-enh-gained .ach-stat-dex, .bbgl-ach-row .ach-sub.ach-stat-dex, .ach-stat-header.ach-stat-dex, .bbgl-ach-hh-tag.ach-stat-dex {
                    color: #109618; }/*---------------------------------------------------------------------------------------------------*/
                    .bbgl-ach-row .ach-sub.ach-stat-tot, .ach-stat-header.ach-stat-tot, .bbgl-ach-stat-cell .ach-value.ach-stat-tot {/*---*/
                    color: #9d039d; } /* HH total tag is deliberately neutral, not stat-purple. */ .bbgl-ach-hh-tag.ach-stat-tot { color: #999; }/*-----------------------------------*/
                    .bbgl-ach-row.bbgl-ach-od-row .ach-k, .bbgl-ach-row.bbgl-ach-od-row .ach-value { color: #aaa; }/*---------------------*/
                    .bbgl-ach-row.bbgl-ach-od-row .ach-value.ach-enh-od .ach-enh-e-label { color: #c06060; }/*----------------------------*/
                    /* OD sub-rows: indent the label past the subgroup connector line. The energy-section row padding shorthand (above) outranks the generic .bbgl-subgroup-row padding-left, so restore the indent at higher specificity. */ .bbgl-ach-section-energy .bbgl-ach-row.bbgl-ach-od-row, .bbgl-ach-section-hh .bbgl-ach-row.bbgl-ach-od-row {
                    padding-left: 24px; } .ach-happy-word { color: #f5c518; font-weight: 600; } .ach-od-happy-word { color: #c06060; }/*--*/
                    /* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */ .bbgl-ach-row.is-scrub-hovered { background: rgba(255, 255, 255, .04); }/*---------------------------*/
                    .sticker-slot.has-item.is-scrub-hovered { z-index: 45; } #bbgl-settings-view, #bbgl-welcome-view { background: #222;
                    color: #ddd; display: none; flex-direction: column; height: 100%; position: relative; overflow: hidden !important;/*--*/
                    padding: 0; } #bbgl-settings-view.active-view, #bbgl-welcome-view.active-view { display: flex; } .bbgl-author-block {
                    margin: 8px 10px 10px; padding: 8px 10px; background: #2a2a2a; border: 1px solid #3a3a3a; border-radius: 4px;/*-------*/
                    font-family: Arial, sans-serif; font-size: 12px; color: #aaa; line-height: 1.6; } .bbgl-author-block strong {/*-------*/
                    color: #ddd; display: block; margin-bottom: 4px; font-size: 13px; } /* CSP-safe author link (replaces inline onmouseover/onmouseout handlers). */ .bbgl-author-link { color: #69f0ae;
                    text-decoration: none; border-bottom: 1px dotted rgba(105, 240, 174, 0.4); transition: border-color .2s; }/*----------*/
                    .bbgl-author-link:hover { border-bottom-color: #69f0ae; } .bbgl-settings-author-credit { margin: 8px 10px 0 10px;/*---*/
                    font-family: Arial, sans-serif; font-size: 11px; color: #888; text-align: center; } .bbgl-settings-scroll-area {/*----*/
                    flex: 1; overflow-y: auto; overflow-x: hidden; padding: 8px; width: 100%; box-sizing: border-box; }/*-----------------*/
                    /* Hidden-scrollbar scroll areas \u2014 single source for the pattern. */ .ledger-content, .calendar-wrapper, .bbgl-settings-scroll-area, .bbgl-modal-window, .bbgl-ach-scroll, #bbgl-panel:not(.bbgl-mode-page) #bbgl-bottom-panel {
                    -ms-overflow-style: none; scrollbar-width: none; }/*------------------------------------------------------------------*/
                    .ledger-content::-webkit-scrollbar, .calendar-wrapper::-webkit-scrollbar, .bbgl-settings-scroll-area::-webkit-scrollbar, .bbgl-modal-window::-webkit-scrollbar, .bbgl-ach-scroll::-webkit-scrollbar {
                    display: none; } .bbgl-mask-host { position: relative; } .bbgl-mask-active::after { content: attr(data-mask-text);/*--*/
                    position: absolute; inset: 0; background: rgba(0, 0, 0, .65); color: #ddd; font-family: Arial, sans-serif;/*----------*/
                    font-size: 12px; font-weight: 700; text-align: center; display: flex; align-items: center; justify-content: center;/*-*/
                    padding: 0 20px; box-sizing: border-box; z-index: 50; pointer-events: all; border-radius: 0 0 5px 5px; }/*------------*/
                    .bbgl-init-locked #bbgl-settings-btn, .bbgl-init-locked #bbgl-page-settings { display: none !important; }/*-----------*/
                    /* Full-panel Big Black Backfill scan mask. Anchored to #bbgl-content-wrapper (position:relative), so it covers the top + bottom panels and the settings/ welcome views while leaving the header (settings/close) reachable. */ #bbgl-scan-overlay { position: absolute; inset: 0; z-index: 60; display: flex; flex-direction: column;
                    align-items: center; justify-content: center; gap: 14px; padding: 26px 24px; box-sizing: border-box;/*----------------*/
                    background: rgba(10, 10, 12, .88); color: #ddd; font-family: Arial, sans-serif; text-align: center;/*-----------------*/
                    border-radius: 0 0 5px 5px; } #bbgl-scan-overlay .bbgl-scan-title { font-family: "Fjalla One", Arial, sans-serif;/*---*/
                    font-size: 19px; font-weight: 400; color: #fff; letter-spacing: .4px; } #bbgl-scan-overlay .bbgl-scan-title-row {/*---*/
                    display: flex; align-items: center; justify-content: center; gap: 10px; } #bbgl-scan-overlay .bbgl-scan-title-icon {
                    width: 26px; height: 26px; } #bbgl-scan-overlay .bbgl-scan-title-icon svg { width: 13px; height: 13px; }/*------------*/
                    #bbgl-scan-overlay .bbgl-scan-sub { font-size: 12px; line-height: 1.6; color: #b6b6b6; max-width: 300px; }/*----------*/
                    #bbgl-scan-overlay .bbgl-scan-note { font-size: 11px; font-style: italic; color: #888; max-width: 300px;/*------------*/
                    line-height: 1.5; } #bbgl-scan-overlay .bbgl-scan-count-row { display: flex; align-items: center;/*-------------------*/
                    justify-content: center; gap: 8px; font-size: 12px; color: #ccc; } #bbgl-scan-overlay .bbgl-scan-count { color: #b388ff;
                    font-variant-numeric: tabular-nums; } .bbgl-scan-pulse { width: 8px; height: 8px; border-radius: 50%;/*---------------*/
                    background: #b388ff; flex: 0 0 auto; animation: bbgl-scan-pulse-anim 1.4s ease-in-out infinite; }/*-------------------*/
                    @keyframes bbgl-scan-pulse-anim { 0%, 100% { opacity: .35; transform: scale(.8); } 50% { opacity: 1;/*----------------*/
                    transform: scale(1.15); } } #bbgl-panel.bbgl-no-animations .bbgl-scan-pulse { animation: none; opacity: 1; }/*--------*/
                    #bbgl-scan-cancel { position: absolute; top: 22px; right: 16px; font-size: 11px; font-weight: 700; color: #ff5252;/*--*/
                    cursor: pointer; padding: 4px 9px; border-radius: 4px; text-transform: uppercase; letter-spacing: .5px; }/*-----------*/
                    #bbgl-scan-cancel:hover { background: rgba(255, 82, 82, .16); } #bbgl-scan-overlay .bbgl-scan-actions { display: flex;
                    gap: 18px; align-items: center; justify-content: center; margin-top: 2px; } .bbgl-scan-textbtn { cursor: pointer;/*---*/
                    font-size: 13px; font-weight: 700; color: #dcdcdc; padding: 7px 12px; border-radius: 4px; } .bbgl-scan-textbtn:hover {
                    background: rgba(255, 255, 255, .1); color: #fff; } .bbgl-scan-textbtn.bbgl-scan-primary { color: #b388ff; }/*--------*/
                    .bbgl-scan-textbtn.bbgl-scan-primary:hover { background: rgba(179, 136, 255, .16); } .bbgl-scan-iconbtn {/*-----------*/
                    display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%;/*--*/
                    cursor: pointer; } .bbgl-scan-iconbtn svg { width: 18px; height: 18px; } .bbgl-scan-iconbtn.bbgl-scan-yes {/*---------*/
                    color: #69f0ae; } .bbgl-scan-iconbtn.bbgl-scan-yes:hover { background: rgba(105, 240, 174, .16); }/*------------------*/
                    .bbgl-scan-iconbtn.bbgl-scan-no { color: #ff5252; } .bbgl-scan-iconbtn.bbgl-scan-no:hover {/*-------------------------*/
                    background: rgba(255, 82, 82, .16); } .bbgl-scan-iconbtn.bbgl-scan-play { color: #b388ff; }/*-------------------------*/
                    .bbgl-scan-iconbtn.bbgl-scan-play:hover { background: rgba(179, 136, 255, .16); } .bbgl-ack-check {/*-----------------*/
                    display: inline-flex; width: 14px; height: 14px; color: #69f0ae; flex: 0 0 auto; margin-top: 2px; }/*-----------------*/
                    .bbgl-ack-check svg { width: 100%; height: 100%; } .bbgl-modal-overlay { position: fixed; inset: 0; z-index: 9999999;
                    display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, .7); backdrop-filter: blur(2px);
                    -webkit-backdrop-filter: blur(2px); padding: 20px; box-sizing: border-box; overflow-y: auto; } .bbgl-modal-window {/*-*/
                    background: #2a2a2a; border: 1px solid #444; border-radius: 5px; width: min(560px, 92vw); max-height: 90vh;/*---------*/
                    overflow-y: auto; overflow-x: hidden; position: relative; padding: 8px; box-shadow: 0 10px 30px rgba(0, 0, 0, .6);/*--*/
                    box-sizing: border-box; } .bbgl-modal-scrollbox { max-height: 240px; overflow-y: auto; overflow-x: hidden;/*----------*/
                    border: 1px solid #1a1a1a; background: #2a2a2a; border-radius: 4px; padding: 8px 10px; margin: 8px 10px;/*------------*/
                    font-family: Arial, sans-serif; font-size: 12px; color: #ccc; line-height: 1.5; scrollbar-width: thin;/*--------------*/
                    scrollbar-color: #555 #2a2a2a; } .bbgl-modal-scrollbox::-webkit-scrollbar { display: block; width: 4px; }/*-----------*/
                    .bbgl-modal-scrollbox::-webkit-scrollbar-thumb { background: #555; border-radius: 4px; } .bbgl-modal-scrollbox strong {
                    color: #ddd; font-size: 12px; font-weight: 700; } .bbgl-modal-scrollbox > strong { display: block; margin-top: 6px;/*-*/
                    margin-bottom: 2px; } .bbgl-modal-scrollbox > strong:first-child { margin-top: 0; } .bbgl-modal-scrollbox p {/*-------*/
                    margin: 0 0 8px 0; } .bbgl-modal-scrollbox p:last-child { margin-bottom: 0; } .bbgl-ack-row { display: flex; gap: 8px;
                    align-items: center; padding: 4px 0; color: #ccc; } .bbgl-ack-row input[type="checkbox"] { flex: 0 0 auto;/*----------*/
                    cursor: pointer; } .bbgl-ack-row label { cursor: pointer; flex: 1; } .bbgl-btn.bbgl-btn-disabled { filter: grayscale(1);
                    opacity: .5; pointer-events: none; } .bbgl-agree-wrap { flex: 1; display: block; } .bbgl-agree-wrap .bbgl-btn {/*-----*/
                    width: 100%; } @keyframes bbgl-crt-out { 0% { transform: scale(1); opacity: 1; filter: brightness(1) } 40% {/*--------*/
                    transform: scale(1, .005); opacity: 1; filter: brightness(3) } 100% { transform: scale(0, 0); opacity: 0;/*-----------*/
                    filter: brightness(0) } } @keyframes bbgl-crt-in { 0% { transform: scale(0, 0); opacity: 0; filter: brightness(0) }/*-*/
                    60% { transform: scale(1, .005); opacity: 1; filter: brightness(3) } 100% { transform: scale(1); opacity: 1;/*--------*/
                    filter: brightness(1) } } .bbgl-crt-out { animation: bbgl-crt-out .3s ease-in forwards; transform-origin: center;/*---*/
                    pointer-events: none; } .bbgl-crt-in { animation: bbgl-crt-in .3s ease-out forwards; transform-origin: center; }/*----*/
                    [data-tooltip] { cursor: default; } .bbgl-day-cell.ghost-cell::after { content: ""; display: block; }/*---------------*/
                    .bbgl-day-cell.is-archived .day-num { text-shadow: 0 1px 4px rgba(0, 0, 0, 1), 0 0 2px rgba(0, 0, 0, 1); z-index: 20; }
                    @media (max-width: 800px) { .bbgl-paste-icon { display: none !important; } .bbgl-native-input {/*---------------------*/
                    padding-left: 10px !important; } } @media (max-width: 620px) { .sticker-nav-btn:hover {/*-----------------------------*/
                    transform: translateY(-60%) !important; text-shadow: 0 1px 3px #000 !important; } .arrow-btn:hover {/*----------------*/
                    transform: none !important; text-shadow: 0 1px 3px #000 !important; } .sticker-nav-btn:active {/*---------------------*/
                    transform: translateY(-50%) scale(1.3) !important; text-shadow: 0 0 8px rgba(255, 255, 255, .8) !important; }/*-------*/
                    .arrow-btn:active { transform: scale(1.3) !important; text-shadow: 0 0 8px rgba(255, 255, 255, .8) !important; }/*----*/
                    #bbgl-panel:not(.bbgl-expanded) { max-height: none !important; }/*----------------------------------------------------*/
                    /* NOTE: expanded graph .g-pill/.g-toggles/.g-hud/.g-text rules formerly here were dead \u2014 overridden at every width <=620px by the later same-specificity fluid rules (see "fluid scaling to replace hard 620px breakpoint" block below). Removed. The .g-text.x-label override below is kept: the fluid .g-text floors at 10px, so x-label still needs its own smaller, now-fluid size. */ #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #bbgl-graph-container .g-text.x-label {/*-------------*/
                    font-size: clamp(8px, calc(8px + 1px * var(--bbgl-dock-t, 0)), 9px); }/*----------------------------------------------*/
                    #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #bbgl-ledger-toggle, #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #bbgl-achievements-toggle, #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #bbgl-copy-btn {
                    width: 15.5px !important; height: 15.5px !important; }/*--------------------------------------------------------------*/
                    #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #bbgl-graph-toggle, #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #bbgl-sticker-toggle {
                    width: 16px !important; height: 16px; } } #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) .bbgl-header-wrapper {/*-----*/
                    flex: 0 0 clamp(140px, calc(140px + 23px * var(--bbgl-dock-t, 0)), 163px); }/*----------------------------------------*/
                    #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) .bbgl-header-wrapper::before { border-radius: 5px 5px 0 0; }/*---------*/
                    #bbgl-panel:not(.bbgl-mode-page) { --bbgl-dock-t: clamp(0, calc((100cqi - 300px) / 276px), 1); }/*--------------------*/
                    #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) { --bbgl-col-gap: 18px;/*----------------------------------------------*/
                    --bbgl-f-top-mb: clamp(3px, calc(3px + 3px * (1 - var(--bbgl-dock-t, 0))), 6px); }/*----------------------------------*/
                    #bbgl-panel.bbgl-expanded.bbgl-tall:not(.bbgl-mode-page) { --bbgl-col-gap: 24px; }/*----------------------------------*/
                    #bbgl-panel:not(.bbgl-mode-page) #bbgl-bottom-panel { overflow-y: auto; overflow-x: hidden; }/*-----------------------*/
                    #bbgl-panel:not(.bbgl-mode-page) .bbgl-grid-container { padding: 0; overflow: visible !important; height: auto;/*-----*/
                    flex: none; } #bbgl-panel:not(.bbgl-mode-page) .calendar-wrapper { overflow: visible !important; height: auto;/*------*/
                    flex: none; } #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) .bbgl-month-header { padding-left: 12px;/*---------------*/
                    padding-right: clamp(10px, calc(10px + 6px * var(--bbgl-dock-t)), 16px); }/*------------------------------------------*/
                    #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) .day-num {/*-----------------------------------------------------------*/
                    --day-num-size: clamp(20px, calc(20px + 10px * var(--bbgl-dock-t)), 30px);/*------------------------------------------*/
                    font-size: clamp(11px, calc(11px + 5px * var(--bbgl-dock-t)), 16px) !important;/*-------------------------------------*/
                    top: clamp(3px, calc(3px + 3px * var(--bbgl-dock-t)), 6px) !important;/*----------------------------------------------*/
                    left: clamp(3px, calc(3px + 3px * var(--bbgl-dock-t)), 6px) !important; }/*-------------------------------------------*/
                    #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) .bbgl-day-cell.is-viewing .day-num {/*---------------------------------*/
                    --day-num-size: clamp(22px, calc(22px + 11px * var(--bbgl-dock-t)), 33px);/*------------------------------------------*/
                    font-size: clamp(15px, calc(15px + 7px * var(--bbgl-dock-t)), 22px); }/*----------------------------------------------*/
                    #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #bbgl-ledger-toggle, #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #bbgl-achievements-toggle, #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #bbgl-copy-btn, #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #bbgl-ledger-toggle svg, #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #bbgl-achievements-toggle svg, #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #bbgl-copy-btn svg {
                    width: 15.5px !important; height: 15.5px; }/*-------------------------------------------------------------------------*/
                    #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #bbgl-graph-toggle, #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #bbgl-sticker-toggle, #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #bbgl-graph-toggle svg, #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #bbgl-sticker-toggle svg {
                    width: 16px !important; height: 16px !important; } #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #bbgl-ledger-toggle {
                    left: 32px !important; } #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #bbgl-graph-toggle {/*------------------------*/
                    left: clamp(56px, calc(56px + 4px * var(--bbgl-dock-t)), 60px) !important; }/*----------------------------------------*/
                    #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #bbgl-achievements-toggle {/*------------------------------------------*/
                    left: clamp(80px, calc(80px + 8px * var(--bbgl-dock-t)), 88px) !important; }/*----------------------------------------*/
                    #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #bbgl-sticker-toggle {/*-----------------------------------------------*/
                    left: clamp(104px, calc(104px + 12px * var(--bbgl-dock-t)), 116px) !important; }/*------------------------------------*/
                    #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) .arrow-btn {/*---------------------------------------------------------*/
                    font-size: clamp(18px, calc(18px + 3px * var(--bbgl-dock-t)), 21px); }/*----------------------------------------------*/
                    #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #year-trigger {/*------------------------------------------------------*/
                    font-size: clamp(13px, calc(13px + 2px * var(--bbgl-dock-t)), 15px); }/*----------------------------------------------*/
                    #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #month-trigger {/*-----------------------------------------------------*/
                    font-size: clamp(20px, calc(20px + 3px * var(--bbgl-dock-t)), 23px); }/*----------------------------------------------*/
                    #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #all-time-trigger {/*--------------------------------------------------*/
                    font-size: clamp(28px, calc(28px + 4px * var(--bbgl-dock-t)), 32px); }/*----------------------------------------------*/
                    #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) .ui-floating-label, #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) .ui-floating-summary {
                    font-size: clamp(10px, calc(10px + 2px * var(--bbgl-dock-t)), 12px); }/*----------------------------------------------*/
                    #bbgl-panel.bbgl-compact .ui-floating-label, #bbgl-panel.bbgl-compact .ui-floating-summary { font-size: 10px !important;
                    }/*-------------------------------------------------------------------------------------------------------------------*/
                    #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #year-stats-btn, #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #month-stats-btn, #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #all-time-btn {
                    width: clamp(17px, calc(17px + 7px * var(--bbgl-dock-t)), 24px) !important;/*-----------------------------------------*/
                    height: clamp(18px, calc(18px + 7px * var(--bbgl-dock-t)), 25px); }/*-------------------------------------------------*/
                    /* Expanded panel graph view: fluid scaling to replace hard 620px breakpoint ---------------------*/ #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #bbgl-graph-container .g-pill {/*---------------------*/
                    font-size: clamp(8.45px, calc(8.45px + 1.55px * var(--bbgl-dock-t)), 10px);/*-----------------------------------------*/
                    padding: clamp(.5px, calc(.5px + 1px * var(--bbgl-dock-t)), 1.5px) clamp(5px, calc(5px + 3px * var(--bbgl-dock-t)), 8px);
                    line-height: 1; display: inline-flex !important; align-items: center; justify-content: center; box-sizing: border-box; }
                    #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #bbgl-graph-container .g-toggles {/*-----------------------------------*/
                    gap: clamp(4px, calc(4px + 2px * var(--bbgl-dock-t)), 6px); align-items: center; }/*----------------------------------*/
                    #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #bbgl-graph-container .g-hud {/*---------------------------------------*/
                    margin-bottom: clamp(4px, calc(4px + 2px * var(--bbgl-dock-t)), 6px); }/*---------------------------------------------*/
                    #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #bbgl-graph-container .g-text {/*--------------------------------------*/
                    font-size: clamp(10px, calc(10px + 1px * var(--bbgl-dock-t)), 11px); }/*----------------------------------------------*/
                    #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #bbgl-graph-container {/*----------------------------------------------*/
                    padding: clamp(5px, calc(5px + 4px * var(--bbgl-dock-t)), 9px) calc(var(--bbgl-gx, 10px) - 2px) clamp(4px, calc(4px + 3px * var(--bbgl-dock-t)), 7px) calc(var(--bbgl-gx, 10px) - 2px);
                    } /* Expanded panel sticker grid: fluid sticker slot sizing to keep proportions --------------------*/ /* Switch to size containment on expanded panel only so cqi/cqb can read both axes. --------------*/ #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) { container-type: size; }/*--------*/
                    /* Achievements page font-size levers \u2014 one definition per tier, referenced by every consumer below via var(). Change a size here, not at each call site. Shared by expanded and page mode: falls back from --bbgl-dock-t (expanded/ compact width ratio) to --bbgl-page-t (page mode's own width ratio) so both modes scale identically off the same formulas. */ #bbgl-panel:is(.bbgl-expanded, .bbgl-mode-page) {/*--------------------------------------------------*/
                    --bbgl-ach-fs-icon: clamp(27px, calc(27px + 13px * var(--bbgl-dock-t, var(--bbgl-page-t, 0))), 40px);/*---------------*/
                    --bbgl-ach-fs-message: clamp(12px, calc(12px + 2px * var(--bbgl-dock-t, var(--bbgl-page-t, 0))), 14px);/*-------------*/
                    --bbgl-ach-fs-subtitle: 9px;/*----------------------------------------------------------------------------------------*/
                    --bbgl-ach-fs-row: clamp(10px, calc(10px + 1px * var(--bbgl-dock-t, var(--bbgl-page-t, 0))), 11px);/*-----------------*/
                    --bbgl-ach-fs-label: clamp(8px, calc(8px + 1px * var(--bbgl-dock-t, var(--bbgl-page-t, 0))), 9px);/*------------------*/
                    --bbgl-ach-fs-date: clamp(9px, calc(9px + 1px * var(--bbgl-dock-t, var(--bbgl-page-t, 0))), 10px);/*------------------*/
                    --bbgl-ach-fs-time: clamp(8px, calc(8px + .5px * var(--bbgl-dock-t, var(--bbgl-page-t, 0))), 8.5px);/*----------------*/
                    --bbgl-ach-fs-hint: clamp(6.5px, calc(6.5px + 1px * var(--bbgl-dock-t, var(--bbgl-page-t, 0))), 7.5px);/*-------------*/
                    --bbgl-ach-fs-tag: clamp(7px, calc(7px + 1px * var(--bbgl-dock-t, var(--bbgl-page-t, 0))), 8px); }/*------------------*/
                    /* Page mode gets a wider min/max spread than expanded on the same font tiers, since its width range is bigger and the 1px expanded swing reads as static. */ #bbgl-panel.bbgl-mode-page {/*-----------------------------------------------------------------------*/
                    --bbgl-ach-fs-icon: clamp(25px, calc(25px + 17px * var(--bbgl-page-t, 0)), 42px);/*-----------------------------------*/
                    --bbgl-ach-fs-message: clamp(10px, calc(10px + 6px * var(--bbgl-page-t, 0)), 16px);/*---------------------------------*/
                    --bbgl-ach-fs-subtitle: clamp(8px, calc(8px + 4px * var(--bbgl-page-t, 0)), 12px);/*----------------------------------*/
                    --bbgl-ach-fs-row: clamp(9px, calc(9px + 4px * var(--bbgl-page-t, 0)), 13px);/*---------------------------------------*/
                    --bbgl-ach-fs-label: clamp(7px, calc(7px + 4px * var(--bbgl-page-t, 0)), 11px);/*-------------------------------------*/
                    --bbgl-ach-fs-date: clamp(7px, calc(7px + 5px * var(--bbgl-page-t, 0)), 12px);/*--------------------------------------*/
                    --bbgl-ach-fs-time: clamp(6px, calc(6px + 4.5px * var(--bbgl-page-t, 0)), 10.5px);/*----------------------------------*/
                    --bbgl-ach-fs-hint: clamp(4.5px, calc(4.5px + 5px * var(--bbgl-page-t, 0)), 9.5px);/*---------------------------------*/
                    --bbgl-ach-fs-tag: clamp(5px, calc(5px + 5px * var(--bbgl-page-t, 0)), 10px); }/*-------------------------------------*/
                    #bbgl-panel:not(.bbgl-mode-page) #bbgl-top-panel.viewing-achievements #bbgl-achievements-container { min-height: 0;/*-*/
                    flex: 1; overflow: hidden !important; }/*-----------------------------------------------------------------------------*/
                    #bbgl-panel:not(.bbgl-mode-page) #bbgl-top-panel.viewing-achievements #bbgl-achievements-container .bbgl-ach-scroll {
                    flex: 1 1 auto; min-height: 0; overflow: hidden !important; overflow-x: hidden; }/*-----------------------------------*/
                    #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) .sticker-slot { height: 88px; }/*--------------------------------------*/
                    #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) .sticker-slot-sponsor {/*----------------------------------------------*/
                    height: min(clamp(110px, calc(110px + 27px * var(--bbgl-dock-t)), 137px), clamp(110px, calc(90px + 7.4cqb), 137px));
                    max-width: clamp(120px, calc(120px + 32px * var(--bbgl-dock-t)), 152px); }/*------------------------------------------*/
                    #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #bbgl-sticker-grid {/*-------------------------------------------------*/
                    column-gap: clamp(1px, calc(1px + 4px * var(--bbgl-dock-t)), 5px);/*--------------------------------------------------*/
                    row-gap: clamp(0px, calc(3px * var(--bbgl-dock-t)), 3px); align-content: center; }/*----------------------------------*/
                    #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) .sticker-nav-btn {/*---------------------------------------------------*/
                    font-size: clamp(20px, calc(20px + 12px * var(--bbgl-dock-t)), 32px);/*-----------------------------------------------*/
                    width: clamp(24px, calc(24px + 16px * var(--bbgl-dock-t)), 40px) !important; } .bbgl-coming-soon { position: absolute;
                    top: 50%; left: 50%; transform: translate(-50%, -50%); color: rgba(255, 255, 255, .7); font-size: 24px;/*-------------*/
                    font-weight: bold; letter-spacing: 2px; z-index: 10; pointer-events: none;/*------------------------------------------*/
                    text-shadow: 0 0 10px rgba(255, 255, 255, .2); text-align: center; line-height: 1.2; } @keyframes bbgl-gold-glow-once {
                    0% { text-shadow: 0 0 0 rgba(255, 215, 0, 0), 0 1px 3px rgba(0, 0, 0, .85); } 100% {/*--------------------------------*/
                    text-shadow: 0 0 18px rgba(255, 235, 120, 1), 0 0 32px rgba(255, 215, 0, .9), 0 0 50px rgba(255, 200, 0, .55), 0 1px 3px rgba(0, 0, 0, .85);
                    } } #sticker-sponsor-btn { left: 0; border-radius: 0 5px 5px 0;/*-----------------------------------------------------*/
                    background: linear-gradient(135deg, #b8860b 0%, #ffd700 40%, #fffacd 50%, #ffd700 60%, #b8860b 100%);/*---------------*/
                    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent;/*-----*/
                    text-shadow: 0 0 12px rgba(255, 215, 0, .6), 0 0 0 rgba(255, 255, 255, 0), 0 1px 3px rgba(0, 0, 0, .85); }/*----------*/
                    @media (hover: hover) { #sticker-sponsor-btn:hover {/*----------------------------------------------------------------*/
                    text-shadow: 0 0 18px rgba(255, 235, 120, 1), 0 0 24px rgba(255, 255, 255, .8), 0 1px 3px rgba(0, 0, 0, .85); } }/*---*/
                    #sticker-sponsor-btn:active {/*---------------------------------------------------------------------------------------*/
                    text-shadow: 0 0 18px rgba(255, 235, 120, 1), 0 0 24px rgba(255, 255, 255, .8), 0 1px 3px rgba(0, 0, 0, .85); }/*-----*/
                    #sticker-sponsor-btn.shimmer-once { animation: bbgl-gold-glow-once 2s ease-in-out forwards; }/*-----------------------*/
                    #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #sticker-sponsor-btn { left: 0 !important; }/*-------------------------*/
                    #bbgl-panel.bbgl-mode-page #sticker-sponsor-btn { left: clamp(0px, calc(6px * (1 - var(--bbgl-page-t))), 6px); }/*----*/
                    #bbgl-sponsor-grid { position: relative; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: 1fr;
                    width: 100%; flex: 1; align-content: center; align-items: center; justify-items: center; padding: 0; gap: 0;/*--------*/
                    margin: 0 -6px; } #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) #bbgl-sponsor-grid { gap: 0; padding: 0;/*-----------*/
                    margin: 0 -10px; } #bbgl-panel.bbgl-mode-page #bbgl-sponsor-grid { gap: 0; padding: 0;/*------------------------------*/
                    margin: 0 clamp(-10px, calc(-10px + 7px * var(--bbgl-page-t)), -3px) 0; } .sticker-slot-sponsor { height: 106px;/*----*/
                    width: 100%; max-width: 116px; position: relative; display: flex; align-items: center; justify-content: center;/*-----*/
                    overflow: visible; } #bbgl-panel.bbgl-mode-page .sticker-slot-sponsor {/*---------------------------------------------*/
                    height: clamp(104px, calc(104px + 68px * var(--bbgl-page-t)), 172px);/*-----------------------------------------------*/
                    max-width: clamp(114px, calc(114px + 78px * var(--bbgl-page-t)), 192px); }/*------------------------------------------*/
                    #bbgl-panel.bbgl-expanded:not(.bbgl-mode-page) .sticker-slot-sponsor { height: 137px; max-width: 152px; }/*-----------*/
                    .sponsor-sticker-svg { width: 90%; height: 90%;/*---------------------------------------------------------------------*/
                    filter: drop-shadow(0 -.5px 0 rgba(0, 0, 0, .2)) drop-shadow(0 .5px 0 rgba(255, 255, 255, .2)); opacity: .9; }/*------*/
                    .sponsor-sticker-label { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);/*-----------------*/
                    font-family: 'Fjalla One', sans-serif; font-size: 11px; color: #666; text-align: center; line-height: 1.3;/*----------*/
                    pointer-events: none; z-index: 5; letter-spacing: .3px; text-shadow: 0 1px 1px rgba(255, 255, 255, .4); }/*-----------*/
                    .bbgl-expanded .sponsor-sticker-label { font-size: clamp(9px, calc(9px + 2px * var(--bbgl-dock-t, 0)), 11px); }/*-----*/
                    #bbgl-panel.bbgl-mode-page .sponsor-sticker-label { font-size: clamp(8px, calc(8px + 5px * var(--bbgl-page-t)), 13px); }
                    .pg-dot.pg-dot-sponsor.active { background: linear-gradient(135deg, #b8860b, #ffd700, #fffacd, #ffd700, #b8860b);/*---*/
                    box-shadow: 0 0 6px rgba(255, 215, 0, .85); transform: scale(1.3); } .bbgl-ach-scroll { display: flex;/*--------------*/
                    flex-direction: column; flex: 1 1 auto; min-height: 0; overflow: hidden; overflow-x: hidden; box-sizing: border-box; }
                    #bbgl-achievements-container { position: relative; min-height: 0; overflow: hidden; container-type: inline-size;/*----*/
                    container-name: bbgl-ach-root;/*--------------------------------------------------------------------------------------*/
                    --bbgl-ach-font: 'Barlow Condensed', 'Arial Narrow', 'Nimbus Sans Narrow', Tahoma, sans-serif;/*----------------------*/
                    --bbgl-ach-val-font: 'Inconsolata', monospace; --bbgl-ach-inset-x: clamp(2px, 1.1cqi, 12px);/*------------------------*/
                    --bbgl-ach-scroll-pt: clamp(2px, .5cqi, 9px); --bbgl-ach-scroll-pb: clamp(0px, .08cqi, 2px);/*------------------------*/
                    --bbgl-ach-row-pad-v: clamp(1px, 1.4cqi, 3px); } #bbgl-ach-pages { position: relative; container-type: inline-size;/*-*/
                    container-name: bbgl-ach; width: 100%; box-sizing: border-box; flex: 1; min-height: 0; overflow: hidden; }/*----------*/
                    #bbgl-ach-footer, .bbgl-ach-footer { --bbgl-ach-footer-gap: 6px; --bbgl-ach-dot-gap: 6px;/*---------------------------*/
                    /* stickerbook #bbgl-sticker-pagination uses the same 6px by convention, not a shared variable --------*/ --bbgl-ach-dot-w: 6px; --bbgl-ach-nav-fs: clamp(7px, calc(1.45 * var(--bbgl-ach-dot-w)), 11px);/*----*/
                    --bbgl-ach-nav-py: 0; --bbgl-ach-nav-px: clamp(2px, calc(2px + 8px * var(--bbgl-dock-t, 0)), 10px); position: absolute;
                    bottom: 5px; left: 0; width: 100%; z-index: 21; flex-shrink: 0; display: none; grid-template-columns: 1fr auto 1fr;/*-*/
                    align-items: center; column-gap: var(--bbgl-ach-footer-gap); min-height: 0; padding: 1px 2px 2px;/*-------------------*/
                    box-sizing: border-box; }/*-------------------------------------------------------------------------------------------*/
                    #bbgl-top-panel.viewing-achievements #bbgl-ach-footer, #bbgl-top-panel.viewing-achievements .bbgl-ach-footer {/*------*/
                    display: grid; } #bbgl-panel.bbgl-compact #bbgl-ach-footer { padding-bottom: 0px; } .bbgl-ach-footer-side {/*---------*/
                    display: flex; align-items: center; min-width: 0; } .bbgl-ach-footer-left { justify-content: flex-end; }/*------------*/
                    .bbgl-ach-footer-right { justify-content: flex-start; } .bbgl-ach-nav { position: relative; top: auto; transform: none;
                    font-size: var(--bbgl-ach-nav-fs); color: #888; cursor: pointer; z-index: 20; user-select: none;/*--------------------*/
                    padding: var(--bbgl-ach-nav-py) var(--bbgl-ach-nav-px); margin: 0; transition: color .2s;/*---------------------------*/
                    font-family: 'Arial', sans-serif; display: inline-flex; align-items: center; justify-content: center;/*---------------*/
                    background: transparent; border: none; line-height: 1; -webkit-appearance: none; appearance: none; }/*----------------*/
                    body:not(.is-touch-device) .bbgl-ach-nav:hover { color: #fff; text-shadow: 0 0 3px #fff; } .bbgl-ach-section {/*------*/
                    margin-bottom: 0; width: 100%; box-sizing: border-box; overflow: visible; }/*-----------------------------------------*/
                    .bbgl-ach-cols, .bbgl-ach-col, .bbgl-ach-row, .ach-v-wrap, .bbgl-ach-row .ach-value { overflow: visible; }/*----------*/
                    /* height is set inline by achRefreshPageDom() to the real, measured distance between #bbgl-ach-pages' top (already clear of the SVG toggle row) and #bbgl-ach-footer's top (the page-dot/nav bar), so this centers within the actual visible gap in every panel mode instead of guessing box-model math against the grid layout under #bbgl-achievements-container. */ .bbgl-ach-locked { position: absolute; top: 0; left: 0; right: 0; min-height: 60px; display: flex;/*-*/
                    flex-direction: column; align-items: center; justify-content: center; gap: 8px; text-align: center;/*-----------------*/
                    box-sizing: border-box; /* Nudge on top of the measured centering above; magnitude differs per mode. */ transform: translateY(-4px); } #bbgl-panel.bbgl-compact .bbgl-ach-locked {/*-*/
                    transform: translateY(2px); } /* --ach-gap is stamped by resizeAchLockedPage() (06-section-v-logic.js) to the real measured height of the visible area, so this scales off the container's actual live height rather than the width-only --bbgl-page-t breakpoint. */ #bbgl-panel.bbgl-mode-page .bbgl-ach-locked {/*------------------------*/
                    transform: translateY(clamp(-2.5px, calc(0px - var(--ach-gap, 300px) * 0.012), 0px)); } .bbgl-ach-locked-icon {/*-----*/
                    font-size: var(--bbgl-ach-fs-icon); opacity: .55; filter: grayscale(1); } .bbgl-ach-locked-text {/*-------------------*/
                    font-size: var(--bbgl-ach-fs-message); font-weight: 600; color: rgba(255, 255, 255, .75); letter-spacing: .02em;/*----*/
                    max-width: 26ch; } .bbgl-ach-title-row { position: relative; width: 100%; box-sizing: border-box; display: flex;/*----*/
                    align-items: center; border-bottom: 1px solid rgba(255, 255, 255, .12); padding: 2px 2px 1px 2px; }/*-----------------*/
                    .bbgl-ach-title-row .bbgl-ach-section-title { width: auto; border-bottom: none; padding: 0; } .bbgl-ach-section-title {
                    cursor: pointer; position: relative; z-index: 2; width: 100%; box-sizing: border-box; background: 0 0; box-shadow: none;
                    border-radius: 0; margin: 0; padding: 2px; color: #9a9a9a; font-family: var(--bbgl-ach-font);/*-----------------------*/
                    font-size: var(--bbgl-ach-fs-row); font-weight: 700; letter-spacing: .10em; text-transform: uppercase;/*--------------*/
                    line-height: 1.25; border-bottom: 1px solid rgba(255, 255, 255, .12); transition: color .15s; }/*---------------------*/
                    .bbgl-ach-subsection-title { cursor: pointer; position: relative; z-index: 2; width: 100%; box-sizing: border-box;/*--*/
                    background: 0 0; border: none; box-shadow: none; border-radius: 0; margin: 0; padding: 0px 2px 0px 2px; color: #888;
                    font-family: var(--bbgl-ach-font); font-size: var(--bbgl-ach-fs-subtitle); font-weight: 600; letter-spacing: .08em;/*-*/
                    text-transform: uppercase; line-height: 1.2; transition: color .15s; }/*----------------------------------------------*/
                    body:not(.is-touch-device) .bbgl-ach-section-title:hover, body:not(.is-touch-device) .bbgl-ach-subsection-title:hover {
                    color: #c8c8c8; } .bbgl-ach-cols { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));/*-----------------*/
                    column-gap: clamp(8px, calc(8px + 10px * var(--bbgl-dock-t, 0)), 18px); row-gap: 0; align-items: start; width: 100%;
                    box-sizing: border-box; padding: 0px 0 2px; } @container bbgl-ach (max-width:360px) { .bbgl-ach-cols {/*--------------*/
                    grid-template-columns: repeat(2, minmax(0, 1fr)); } } .bbgl-ach-col { display: flex; flex-direction: column; gap: 0;
                    min-width: 0; text-align: left; } .bbgl-ach-dual { width: 100%; box-sizing: border-box; display: flex;/*--------------*/
                    flex-direction: column; } .bbgl-ach-dual-headers { display: grid; grid-template-columns: 1fr 1fr;/*-------------------*/
                    column-gap: clamp(8px, calc(8px + 10px * var(--bbgl-dock-t, 0)), 18px);/*---------------------------------------------*/
                    border-bottom: 1px solid rgba(255, 255, 255, .12); width: 100%; box-sizing: border-box; }/*---------------------------*/
                    .bbgl-ach-dual .bbgl-ach-section-title { border-bottom: none; padding-bottom: 4px; } .bbgl-ach-dual-body {/*----------*/
                    display: grid; grid-template-columns: 1fr 1fr; column-gap: clamp(8px, calc(8px + 10px * var(--bbgl-dock-t, 0)), 18px);
                    align-items: start; width: 100%; box-sizing: border-box; padding: 0px 0 2px; } .bbgl-ach-col-half { display: flex;/*--*/
                    flex-direction: column; gap: 0; min-width: 0; } #bbgl-panel.bbgl-compact {/*------------------------------------------*/
                    --bbgl-ach-fs-row-compact: clamp(9px, 1.7cqi, 11px); } .bbgl-ach-row { display: flex; flex-direction: column;/*-------*/
                    align-items: stretch; padding: var(--bbgl-ach-row-pad-v, 4px) 2px; margin: 0; border: none; box-shadow: none;/*-------*/
                    background: 0 0; cursor: pointer; position: relative;/*---------------------------------------------------------------*/
                    font-size: var(--bbgl-ach-fs-row-compact, clamp(11px, 2.05cqi, 12px)); line-height: 1.4; }/*--------------------------*/
                    #bbgl-panel:is(.bbgl-expanded, .bbgl-mode-page) .bbgl-ach-row { font-size: var(--bbgl-ach-fs-row); color: #ccc;/*-----*/
                    transition: background-color .12s; border-bottom: 1px solid rgba(255, 255, 255, .04); }/*-----------------------------*/
                    body:not(.is-touch-device) .bbgl-ach-row:hover { background: rgba(255, 255, 255, .04); } .ach-row-main { display: flex;
                    align-items: center; justify-content: space-between; gap: 6px; width: 100%; } .ach-k-stack { display: flex;/*---------*/
                    flex-direction: column; align-items: flex-start; flex: 1; min-width: 0; } .bbgl-ach-row .ach-k { font-weight: 500;/*--*/
                    color: #bbb; font-family: var(--bbgl-ach-font); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;/*-----*/
                    width: 100%; } .ach-v-wrap { display: flex; align-items: flex-end; gap: 3px; flex-shrink: 0; justify-content: flex-end;
                    } .ach-sub { font-size: var(--bbgl-ach-fs-hint); font-weight: 600; color: #222; letter-spacing: .3px;/*---------------*/
                    text-shadow: 0 1px 0 rgba(255, 255, 255, .05); line-height: 1.1; margin-bottom: 1px; } .bbgl-ach-row .ach-value {/*---*/
                    font-weight: 500; color: #eaeaea; text-align: right; white-space: nowrap; font-family: var(--bbgl-ach-val-font);/*----*/
                    font-variant-numeric: tabular-nums; display: inline-flex; align-items: center; justify-content: flex-end;/*-----------*/
                    flex-wrap: nowrap; gap: 4px; padding-right: 12px; }/*-----------------------------------------------------------------*/
                    .bbgl-ach-row .ach-value .view-std, .bbgl-ach-row .ach-value .view-exp { font-weight: 550; } .ach-null { color: #444; }
                    .ach-unit { display: none; } .bbgl-ach-row .ach-value.ach-happy-col { display: none; color: #eaeaea; }/*--------------*/
                    #bbgl-panel:is(.bbgl-expanded, .bbgl-mode-page) .bbgl-ach-row .ach-value.ach-happy-col { display: inline-flex;/*------*/
                    min-width: clamp(4.5em, calc(4.5em + 1em * var(--bbgl-dock-t, 0)), 5.5em); } .bbgl-ach-row .ach-value.ach-enh-gained {
                    display: none; } #bbgl-panel:is(.bbgl-expanded, .bbgl-mode-page) .bbgl-ach-row .ach-value.ach-enh-gained {/*----------*/
                    display: inline-flex; min-width: clamp(4.5em, calc(4.5em + 1em * var(--bbgl-dock-t, 0)), 5.5em); }/*------------------*/
                    /* OD sub-rows are detail-only: hidden in the compact panel, shown in expanded panel and page mode. */ .bbgl-ach-od-row { display: none; } #bbgl-panel:is(.bbgl-expanded, .bbgl-mode-page) .bbgl-ach-od-row {
                    display: flex; } #bbgl-panel:is(.bbgl-expanded, .bbgl-mode-page) .ach-unit { display: inline; } .ach-date {/*---------*/
                    display: none; font-size: var(--bbgl-ach-fs-date); font-weight: 500; color: #999; font-family: var(--bbgl-ach-font);
                    text-align: left; margin-left: 6px; line-height: 1; letter-spacing: .01em; }/*----------------------------------------*/
                    #bbgl-panel:is(.bbgl-expanded, .bbgl-mode-page) .ach-date { display: block; } .ach-fx-green {/*-----------------------*/
                    background: linear-gradient(135deg, #2e7d32, #66bb6a, #81c784, #66bb6a, #2e7d32); background-size: 200% 100%;/*-------*/
                    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;/*-------------------------*/
                    animation: bbgl-ach-shimmer 4s linear 1, bbgl-ach-glow-green 4s ease-out 1 forwards; } .ach-fx-gold {/*---------------*/
                    background: linear-gradient(135deg, #b8860b, #ffd700, #fffacd, #ffd700, #b8860b); background-size: 200% 100%;/*-------*/
                    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;/*-------------------------*/
                    animation: bbgl-ach-shimmer 4s linear 1, bbgl-ach-glow-gold 4s ease-out 1 forwards; } .ach-fx-holo {/*----------------*/
                    background: linear-gradient(90deg, #00e5ff, #d500f9, #2979ff, #00e5ff); background-size: 200% 100%;/*-----------------*/
                    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;/*-------------------------*/
                    animation: bbgl-ach-shimmer 4s linear 1; } .ach-fx-diamond {/*--------------------------------------------------------*/
                    background: linear-gradient(110deg, #ffffff 0%, #ffb8d9 15%, #fff0c2 30%, #b8ffd9 45%, #b8e0ff 60%, #d9b8ff 75%, #ffb8e6 90%, #ffffff 100%);
                    background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
                    animation: bbgl-ach-shimmer 4s linear 1, bbgl-ach-glow-diamond 4s ease-out 1 forwards; }/*----------------------------*/
                    @keyframes bbgl-ach-glow-diamond { 0% { filter: drop-shadow(0 1px 1px rgba(0, 0, 0, .8)); } 100% {/*------------------*/
                    filter: drop-shadow(0 0 4px rgba(255, 255, 255, .9)) drop-shadow(0 0 8px rgba(255, 180, 220, .7)) drop-shadow(0 0 12px rgba(180, 220, 255, .6)) drop-shadow(0 1px 1px rgba(0, 0, 0, .8));
                    } } @keyframes bbgl-ach-shimmer { 0% { background-position: 200% 0; } 100% { background-position: 0 0; } }/*----------*/
                    @keyframes bbgl-ach-glow-gold { 0% { text-shadow: 0 0 0 rgba(255, 215, 0, 0), 0 1px 2px rgba(0, 0, 0, .8); } 100% {/*-*/
                    text-shadow: 0 0 12px rgba(255, 215, 0, .6), 0 0 20px rgba(255, 215, 0, .3), 0 1px 2px rgba(0, 0, 0, .8); } }/*-------*/
                    @keyframes bbgl-ach-glow-green { 0% { text-shadow: 0 0 0 rgba(46, 125, 50, 0), 0 1px 2px rgba(0, 0, 0, .8); } 100% {
                    text-shadow: 0 0 12px rgba(102, 187, 106, .6), 0 0 20px rgba(46, 125, 50, .3), 0 1px 2px rgba(0, 0, 0, .8); } }/*-----*/
                    #bbgl-panel.bbgl-no-animations :is(.ach-fx-green, .ach-fx-gold, .ach-fx-holo, .ach-fx-diamond) { animation: none; }/*-*/
                    #bbgl-ach-pageindicator { display: flex; justify-content: center; align-items: center; justify-self: center;/*--------*/
                    gap: var(--bbgl-ach-dot-gap); padding: 0; flex-shrink: 0; } #bbgl-ach-pageindicator .pg-dot {/*-----------------------*/
                    width: var(--bbgl-ach-dot-w); height: var(--bbgl-ach-dot-w); } #bbgl-ach-pageindicator .pg-dot.active {/*-------------*/
                    transform: scale(1.2); box-shadow: 0 0 clamp(3px, calc(3px + 5px * var(--bbgl-dock-t, 0)), 8px) rgba(255, 255, 255, .5);
                    } .bbgl-ach-section-page0 { width: 100%; box-sizing: border-box; }/*--------------------------------------------------*/
                    .bbgl-ach-section-page0 .bbgl-ach-grid-header, .bbgl-ach-section-page0 .bbgl-ach-row-multi { display: grid;/*---------*/
                    grid-template-columns: minmax(0, 20%) repeat(4, minmax(0, 1fr));/*----------------------------------------------------*/
                    column-gap: clamp(4px, calc(4px + 6px * var(--bbgl-dock-t, 0)), 10px); align-items: start; width: 100%;/*-------------*/
                    box-sizing: border-box; } .bbgl-ach-section-page0 .bbgl-ach-grid-header {/*-------------------------------------------*/
                    border-bottom: 1px solid rgba(255, 255, 255, .12); padding: 2px 2px 2px; align-items: end; }/*------------------------*/
                    .bbgl-ach-section-page0 .bbgl-ach-row-multi { padding: var(--bbgl-ach-row-pad-v, 4px) 2px;/*--------------------------*/
                    border-bottom: 1px solid rgba(255, 255, 255, .04); cursor: pointer; }/*-----------------------------------------------*/
                    .bbgl-ach-section-page0 .bbgl-ach-row-multi:last-child { border-bottom: none; } .ach-grid-label-area { display: flex;
                    flex-direction: column; align-items: flex-start; min-width: 0; text-align: left; }/*----------------------------------*/
                    .bbgl-ach-section-page0 .ach-grid-label-area .ach-k { font-weight: 500; color: #bbb; font-family: var(--bbgl-ach-font);
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; line-height: 1.25; }/*-------------------*/
                    .bbgl-ach-section-page0 .bbgl-ach-grid-header .ach-grid-label-area { display: grid;/*---------------------------------*/
                    grid-template-columns: auto minmax(0, 1fr); column-gap: 6px; align-items: center; }/*---------------------------------*/
                    .bbgl-ach-section-page0 .bbgl-ach-grid-header .bbgl-ach-section-title { border-bottom: none; padding: 0;/*------------*/
                    background: transparent; display: inline-block; cursor: pointer; line-height: 1.15; white-space: normal;/*------------*/
                    word-break: normal; }/*-----------------------------------------------------------------------------------------------*/
                    #bbgl-panel:is(.bbgl-expanded, .bbgl-mode-page) .bbgl-ach-section-page0 .bbgl-ach-grid-header .bbgl-ach-section-title {
                    white-space: nowrap; }/*----------------------------------------------------------------------------------------------*/
                    #bbgl-panel:is(.bbgl-expanded, .bbgl-mode-page) .bbgl-ach-section-page0 .bbgl-ach-grid-header .bbgl-ach-section-hint {
                    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-top: 0;/*---------*/
                    min-width: 0; white-space: normal; word-break: normal; overflow-wrap: normal; align-self: center;/*-------------------*/
                    font-size: clamp(5.5px, calc(5.5px + 1px * var(--bbgl-dock-t, 0)), 6.5px); line-height: 1.1;/*------------------------*/
                    max-height: calc(1.1em * 2 + 1px); } .bbgl-ach-section-hint { display: none; font-family: var(--bbgl-ach-font);/*-----*/
                    font-size: var(--bbgl-ach-fs-hint); color: #666; letter-spacing: .02em; line-height: 1.15; margin-top: 1px;/*---------*/
                    font-weight: 400; text-transform: none; } #bbgl-panel:is(.bbgl-expanded, .bbgl-mode-page) .bbgl-ach-section-hint {/*--*/
                    display: block; } .ach-paren { display: none; font-family: var(--bbgl-ach-font); font-size: var(--bbgl-ach-fs-hint);
                    color: #777; font-weight: 400; line-height: 1.15; margin-top: 1px; letter-spacing: .01em; }/*-------------------------*/
                    #bbgl-panel:is(.bbgl-expanded, .bbgl-mode-page) .ach-paren { display: block; } .ach-stat-header {/*-------------------*/
                    font-family: var(--bbgl-ach-font); font-size: var(--bbgl-ach-fs-label); font-weight: 700; letter-spacing: .04em;/*----*/
                    text-align: center; line-height: 1.2; } .bbgl-ach-stat-cell { display: flex; flex-direction: column;/*----------------*/
                    align-items: center; justify-content: center; width: 100%; min-width: 0; cursor: pointer; padding: 1px 2px;/*---------*/
                    border-radius: 2px; transition: background-color .12s; } body:not(.is-touch-device) .bbgl-ach-stat-cell:hover {/*-----*/
                    background: rgba(255, 255, 255, .06); } .bbgl-ach-stat-cell .ach-value { font-weight: 500; color: #eaeaea;/*----------*/
                    text-align: center; white-space: nowrap; width: 100%; font-family: var(--bbgl-ach-val-font);/*------------------------*/
                    font-variant-numeric: tabular-nums; line-height: 1.2; display: inline-flex; justify-content: center;/*----------------*/
                    align-items: baseline; gap: 2px; padding: 0; } .bbgl-ach-stat-cell .ach-date { display: none;/*-----------------------*/
                    font-family: var(--bbgl-ach-font); font-size: var(--bbgl-ach-fs-date); color: #999; text-align: center; margin: 1px 0 0;
                    line-height: 1.15; font-weight: 500; letter-spacing: .01em; } .bbgl-ach-stat-cell .ach-time { display: none;/*--------*/
                    font-family: var(--bbgl-ach-val-font); font-size: var(--bbgl-ach-fs-time); color: #888; text-align: center; margin: 0;
                    line-height: 1.15; font-variant-numeric: tabular-nums; }/*------------------------------------------------------------*/
                    #bbgl-panel:is(.bbgl-expanded, .bbgl-mode-page) .bbgl-ach-stat-cell :is(.ach-date, .ach-time) { display: block; }/*---*/
                    .ach-streak-days { color: #bbb; font-weight: 500; font-family: var(--bbgl-ach-val-font);/*----------------------------*/
                    font-variant-numeric: tabular-nums; } .ach-streak-sep { color: #666; margin: 0 2px; font-weight: 500; }/*-------------*/
                    #bbgl-panel.bbgl-compact .bbgl-ach-section-page0 .bbgl-ach-grid-header, #bbgl-panel.bbgl-compact .bbgl-ach-section-page0 .bbgl-ach-row-multi {
                    grid-template-columns: minmax(0, 28%) repeat(4, minmax(0, 1fr)); } #bbgl-panel.bbgl-compact .bbgl-ach-section-title {
                    font-size: clamp(10px, 2cqi, 12px); } #bbgl-panel.bbgl-compact .bbgl-ach-subsection-title {/*-------------------------*/
                    font-size: clamp(9px, 1.6cqi, 10px); } /* The -2px expanded-only font reduction below touched several base/unscoped rules that compact also reads (no dedicated compact override existed for them). These restore compact's original sizes so the reduction is expanded-only. */ #bbgl-panel.bbgl-compact .bbgl-ach-locked-icon {/*------------*/
                    font-size: 28px; } #bbgl-panel.bbgl-compact .bbgl-ach-locked-text { font-size: 13px; }/*------------------------------*/
                    #bbgl-panel.bbgl-compact .ach-sub { font-size: 7.5px; } #bbgl-panel.bbgl-compact .ach-stat-header { font-size: 9px; }
                    #bbgl-panel.bbgl-compact .bbgl-ach-consistency-row .bbgl-ach-consistency-text { font-size: 10px; }/*------------------*/
                    #bbgl-panel.bbgl-compact .bbgl-ach-section-hh .bbgl-ach-row { font-size: var(--bbgl-ach-fs-row-compact) !important; }
                    #bbgl-panel.bbgl-compact .bbgl-ach-hh-best-row { font-size: var(--bbgl-ach-fs-row-compact); }/*-----------------------*/
                    #bbgl-panel.bbgl-compact .bbgl-ach-hh-val { font-size: 11px; } #bbgl-panel.bbgl-compact .bbgl-ach-hh-tag {/*----------*/
                    font-size: 8px; } #bbgl-panel.bbgl-compact .bbgl-ach-hh-date-line { font-size: 10px; }/*------------------------------*/
                    .bbgl-ach-section-page1 .ach-streak-date { grid-column: 1; text-align: left; margin: 0; padding-left: 15%;/*----------*/
                    padding-right: 4px; line-height: 1.15; white-space: nowrap; overflow: visible; } .ach-streak-days-inline {/*----------*/
                    display: inline; } #bbgl-panel:is(.bbgl-expanded, .bbgl-mode-page) .ach-streak-days-inline { display: none; }/*-------*/
                    .bbgl-ach-section-page1 .bbgl-ach-grid-header, .bbgl-ach-section-page1 .bbgl-ach-row-multi {/*------------------------*/
                    grid-template-columns: minmax(0, 28%) repeat(5, minmax(0, 1fr)); }/*--------------------------------------------------*/
                    .bbgl-ach-section-page1 .bbgl-ach-stat-cell-total .ach-value { color: #ffffff !important; }/*-------------------------*/
                    .bbgl-ach-section-page1 .bbgl-ach-stat-cell:not(.bbgl-ach-stat-cell-total) .ach-value { color: #cccccc; }/*-----------*/
                    .bbgl-ach-streak-date-inline { display: inline; color: #888; font-family: var(--bbgl-ach-val-font); font-weight: 500;
                    font-variant-numeric: tabular-nums; } #bbgl-panel:is(.bbgl-expanded, .bbgl-mode-page) .bbgl-ach-streak-date-inline {
                    display: none; }/*----------------------------------------------------------------------------------------------------*/
                    #bbgl-panel.bbgl-compact .bbgl-ach-section-page1 .bbgl-ach-grid-header, #bbgl-panel.bbgl-compact .bbgl-ach-section-page1 .bbgl-ach-row-multi {
                    grid-template-columns: minmax(0, 1fr) repeat(4, 0fr) auto; }/*--------------------------------------------------------*/
                    #bbgl-panel.bbgl-compact .bbgl-ach-section-page1 .bbgl-ach-stat-cell:not(.bbgl-ach-stat-cell-total), #bbgl-panel.bbgl-compact .bbgl-ach-section-page1 .ach-stat-header:not(.ach-stat-tot) {
                    display: none; } #bbgl-panel.bbgl-compact .bbgl-ach-section-page1 .bbgl-ach-stat-cell-total .ach-value {/*------------*/
                    text-align: right; justify-content: flex-end; } .bbgl-ach-consistency-row { cursor: pointer; }/*----------------------*/
                    body:not(.is-touch-device) .bbgl-ach-consistency-row:hover { background: transparent; }/*-----------------------------*/
                    .bbgl-ach-consistency-row .bbgl-ach-consistency-text { grid-column: 1 / -1; justify-self: end; text-align: right;/*---*/
                    padding: 1px 6px; border-radius: 4px; transition: background-color .12s; font-family: var(--bbgl-ach-font);/*---------*/
                    font-size: var(--bbgl-ach-fs-row); color: #bbb; font-weight: 500; letter-spacing: .02em; white-space: nowrap;/*-------*/
                    overflow: hidden; text-overflow: ellipsis; }/*------------------------------------------------------------------------*/
                    body:not(.is-touch-device) .bbgl-ach-consistency-row .bbgl-ach-consistency-text:hover {/*-----------------------------*/
                    background: rgba(255, 255, 255, .06); } .bbgl-ach-consistency-row .ach-cons-val { color: #eaeaea;/*-------------------*/
                    font-family: var(--bbgl-ach-val-font); font-variant-numeric: tabular-nums; font-weight: 600; }/*----------------------*/
                    .bbgl-ach-consistency-row .ach-cons-days { color: #888; font-family: var(--bbgl-ach-val-font);/*----------------------*/
                    font-variant-numeric: tabular-nums; } #bbgl-panel:is(.bbgl-expanded, .bbgl-mode-page) .bbgl-ach-section-page0 .ach-k {
                    white-space: normal; overflow: visible; text-overflow: clip; line-height: 1.2; } .ach-streak-daterange { color: inherit;
                    } .ach-title-long { display: none; } .ach-title-short { display: inline; }/*------------------------------------------*/
                    #bbgl-panel:is(.bbgl-expanded, .bbgl-mode-page) .ach-title-short { display: none; }/*---------------------------------*/
                    #bbgl-panel:is(.bbgl-expanded, .bbgl-mode-page) .ach-title-long { display: inline; } .ach-cons-days { display: none; }
                    #bbgl-panel:is(.bbgl-expanded, .bbgl-mode-page) .ach-cons-days { display: inline; } .bbgl-ach-section-hh { width: 100%;
                    box-sizing: border-box; } .bbgl-ach-section-hh .bbgl-ach-row { padding: var(--bbgl-ach-row-pad-v, 4px) 2px;/*---------*/
                    border-bottom: 1px solid rgba(255, 255, 255, .05); font-size: var(--bbgl-ach-fs-row) !important; }/*------------------*/
                    .bbgl-ach-hh-best-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%;/*--*/
                    box-sizing: border-box; padding: var(--bbgl-ach-row-pad-v, 4px) 2px; border-bottom: 1px solid rgba(255, 255, 255, .05);
                    font-family: var(--bbgl-ach-font); font-size: var(--bbgl-ach-fs-row); color: #ccc; line-height: 1.4; }/*--------------*/
                    .bbgl-ach-hh-group .bbgl-ach-row:last-of-type, .bbgl-ach-hh-best-row:last-of-type { border-bottom: none; }/*----------*/
                    body:not(.is-touch-device) .bbgl-ach-hh-best-row:hover { background: rgba(255, 255, 255, .04); } .bbgl-ach-hh-group {
                    cursor: pointer; display: flex; flex-direction: column; width: 100%; border-bottom: 1px solid rgba(255, 255, 255, .05);
                    } .bbgl-ach-hh-group:last-of-type { border-bottom: none; } body:not(.is-touch-device) .bbgl-ach-hh-group:hover {/*----*/
                    background: rgba(255, 255, 255, .04); } .bbgl-ach-hh-group .bbgl-ach-row, .bbgl-ach-hh-group .bbgl-ach-hh-best-row {
                    background: transparent; cursor: inherit; } .bbgl-ach-hh-group .bbgl-ach-hh-best-row { border-bottom: none; }/*-------*/
                    .bbgl-ach-hh-label { display: flex; flex-direction: row; align-items: center;/*---------------------------------------*/
                    gap: clamp(6px, calc(6px + 4px * var(--bbgl-dock-t, 0)), 10px); min-width: 0; flex: 1; }/*----------------------------*/
                    #bbgl-panel:is(.bbgl-expanded, .bbgl-mode-page) .bbgl-ach-hh-label { flex-direction: column; align-items: flex-start;
                    gap: 0; } .bbgl-ach-hh-label .ach-k { font-weight: 500; color: #bbb; } .bbgl-ach-hh-label .ach-date {/*---------------*/
                    font-family: var(--bbgl-ach-val-font); color: #888; line-height: 1.2; margin-top: 1px;/*------------------------------*/
                    font-variant-numeric: tabular-nums; } /* kept for compat */ .bbgl-ach-hh-cells { display: flex;/*--------------------------*/
                    gap: clamp(8px, calc(8px + 6px * var(--bbgl-dock-t, 0)), 14px); align-items: center; flex-shrink: 0; }/*--------------*/
                    #bbgl-panel:is(.bbgl-expanded, .bbgl-mode-page) .bbgl-ach-hh-cells { align-items: flex-end; } .bbgl-ach-hh-cell {/*---*/
                    display: flex; flex-direction: column; align-items: center; min-width: 32px; } .bbgl-ach-hh-val {/*-------------------*/
                    font-family: var(--bbgl-ach-val-font); font-variant-numeric: tabular-nums; color: #eaeaea; font-weight: 500;/*--------*/
                    font-size: var(--bbgl-ach-fs-row); white-space: nowrap; line-height: 1.15; } .bbgl-ach-hh-tag {/*---------------------*/
                    font-family: var(--bbgl-ach-font); font-size: var(--bbgl-ach-fs-tag); font-weight: 700; letter-spacing: .04em;/*------*/
                    text-transform: uppercase; line-height: 1.2; margin-top: 1px; } .bbgl-ach-hh-date-line {/*----------------------------*/
                    font-family: var(--bbgl-ach-val-font); color: #888; line-height: 1.2; font-variant-numeric: tabular-nums;/*-----------*/
                    font-size: var(--bbgl-ach-fs-time); } #bbgl-panel:is(.bbgl-expanded, .bbgl-mode-page) .bbgl-ach-hh-date-line {/*------*/
                    margin-top: 1px; } .bbgl-ach-hh-cell-total { flex-direction: row; align-items: baseline; gap: 4px; }/*----------------*/
                    #bbgl-panel:is(.bbgl-expanded, .bbgl-mode-page) .bbgl-ach-hh-cell-total { flex-direction: column; align-items: center;
                    gap: 0; } #bbgl-panel:is(.bbgl-expanded, .bbgl-mode-page) .bbgl-ach-hh-cell-total .bbgl-ach-hh-tag { order: 1; }/*----*/
                    .bbgl-ach-hh-time { display: none; } #bbgl-panel:is(.bbgl-expanded, .bbgl-mode-page) .bbgl-ach-hh-time {/*------------*/
                    display: inline; } .bbgl-ach-hh-cell-stat { display: none; }/*--------------------------------------------------------*/
                    #bbgl-panel:is(.bbgl-expanded, .bbgl-mode-page) .bbgl-ach-hh-cell-stat { display: flex; } .bbgl-ach-copied-flash {/*--*/
                    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #69f0ae;/*----------*/
                    font-weight: 600; font-family: var(--bbgl-ach-val-font); letter-spacing: .04em; pointer-events: none; z-index: 5; }/*-*/
                         /*==========================*/                                                    /*==========================*/
                  /*========================================*/                                      /*========================================*/
              /*================================================*/                             /*================================================*/
           /*======================================================*/                       /*======================================================*/
        /*============================================================*/                 /*============================================================*/
      /*================================================================*/             /*================================================================*/
    /*====================================================================*/         /*====================================================================*/
   /*======================================================================*/       /*======================================================================*/
  /*========================================================================*/     /*========================================================================*/
 /*==========================================================================*/   /*==========================================================================*/
/*============================================================================*/ /*============================================================================*/
/*============================================================================*/ /*============================================================================*/
/*============================================================================*/ /*============================================================================*/
/*============================================================================*/ /*============================================================================*/
/*============================================================================*/ /*============================================================================*/
 /*==========================================================================*/   /*==========================================================================*/
  /*========================================================================*/     /*========================================================================*/
   /*======================================================================*/       /*======================================================================*/
    /*====================================================================*/         /*====================================================================*/
      /*================================================================*/             /*================================================================*/
        /*============================================================*/                 /*============================================================*/
           /*======================================================*/                       /*======================================================*/
              /*================================================*/                             /*================================================*/
                  /*========================================*/                                     /*========================================*/
                         /*==========================*/                                                   /*==========================*/                         
`;

  // src/ui/styles.ts
  var FONT_HREF = "https://fonts.googleapis.com/css2?family=Aldrich&family=Barlow+Condensed:wght@400;500;700&family=Fjalla+One&family=Inconsolata:wght@400;500;600;700&family=Roboto+Mono:wght@400;500;700&family=VT323&display=swap";
  function resolveCss() {
    const subs = [
      ["__ASSETS_GLASS_OVERLAY__", ASSETS.GLASS_OVERLAY],
      ["__ASSETS_STICKER_BG__", ASSETS.STICKER_BG],
      ["__ASSETS_HEADER_IMG__", ASSETS.HEADER_IMG],
      ["__ASSETS_NEW_STICKER_FRAME__", ASSETS.NEW_STICKER_FRAME],
      ["__CROWN_BADGE_URL__", CROWN_BADGE_URL]
    ];
    return subs.reduce((out, [token, value]) => out.split(token).join(value), styles_default);
  }
  function injectStyles() {
    if (document.getElementById("bbgl-styles")) return;
    const root = document.head || document.documentElement;
    if (!document.getElementById("bbgl-fonts")) {
      const pre = document.createElement("link");
      pre.id = "bbgl-fonts-pre";
      pre.rel = "preconnect";
      pre.href = "https://fonts.gstatic.com";
      pre.crossOrigin = "anonymous";
      root.appendChild(pre);
      const link = document.createElement("link");
      link.id = "bbgl-fonts";
      link.rel = "stylesheet";
      link.href = FONT_HREF;
      root.appendChild(link);
    }
    const style = document.createElement("style");
    style.id = "bbgl-styles";
    style.textContent = resolveCss();
    root.appendChild(style);
  }

  // src/torn/widgets/PageHeader.tsx
  function PageHeader() {
    return /* @__PURE__ */ u2("div", { class: "bbgl-native-header", children: [
      /* @__PURE__ */ u2("div", { class: "bbgl-native-title", children: /* @__PURE__ */ u2("span", { style: { marginLeft: 8 }, children: "Big Black Gym Log" }) }),
      /* @__PURE__ */ u2("div", { class: "bbgl-native-links", children: [
        /* @__PURE__ */ u2(
          "div",
          {
            id: "bbgl-page-demo-exit",
            class: "bbgl-native-link",
            style: { display: runtime.demoMode ? "flex" : "none" },
            onClick: (e3) => {
              e3.stopPropagation();
              const demoBar = document.getElementById("bbgl-demo-exit");
              if (demoBar) demoBar.click();
            },
            children: [
              /* @__PURE__ */ u2("span", { class: "bbgl-demo-x-label", children: "Demo" }),
              /* @__PURE__ */ u2(Raw, { html: ICONS.CLOSE })
            ]
          }
        ),
        /* @__PURE__ */ u2("div", { id: "bbgl-page-settings", class: "bbgl-native-link", onClick: (e3) => app.toggleSettingsView(e3), children: [
          /* @__PURE__ */ u2("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", children: /* @__PURE__ */ u2("path", { d: "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L3.16 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.58 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.08-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" }) }),
          "Settings"
        ] })
      ] })
    ] });
  }
  function mountPageHeader(host) {
    const mount2 = document.createElement("div");
    mount2.id = "bbgl-page-header-host";
    host.insertBefore(mount2, host.firstChild);
    R(/* @__PURE__ */ u2(PageHeader, {}), mount2);
  }

  // src/boot/init.js
  function checkViewRouting() {
    const pm = window.location.hash.includes("gymlog");
    app.syncSidebarState();
    if (pm) {
      document.title = "Gym Log | TORN";
      document.body.classList.add("bbgl-page-mode-active");
      renderPageMode();
      if (localStorage.getItem(KEYS.CHANGELOG_NOTIF) === "1") {
        localStorage.setItem(KEYS.CHANGELOG_VER, SCRIPT_VERSION);
        localStorage.removeItem(KEYS.CHANGELOG_NOTIF);
        app.syncChangelogNotif(false);
        setTimeout(() => app.openChangelogModal(), 400);
      }
    } else {
      document.body.classList.remove("bbgl-page-mode-active");
      const cw = document.querySelector(".content-wrapper"), pc = document.getElementById("bbgl-page-container");
      if (cw && pc) pc.remove();
      if (viewState.isOpen) {
        const lp = dom.panel;
        if (lp && lp.classList.contains("bbgl-mode-page")) {
          lp.remove();
          dom.panel = null;
        }
        app.togglePanel(false);
      } else {
        viewState.subView = "ledger";
        viewState.activeItemId = null;
        viewState.activeViewLabel = null;
        viewState.isTall = false;
        calendarState.selectedData = null;
        calendarState.selectedLabel = null;
      }
    }
    app.updateFooterTooltip();
  }
  function renderPageMode() {
    const cw = document.querySelector(".content-wrapper");
    if (!cw) return;
    window.scrollTo(0, 0);
    const pp = dom.panel;
    if (pp && !pp.classList.contains("bbgl-mode-page")) {
      pp.remove();
      dom.panel = null;
    }
    if (document.getElementById("bbgl-page-container")) return;
    cw.innerHTML = "";
    const pc = document.createElement("div");
    pc.id = "bbgl-page-container";
    cw.appendChild(pc);
    mountPageHeader(pc);
    const p3 = document.createElement("div");
    p3.id = "bbgl-panel";
    p3.className = "bbgl-mode-page";
    pc.appendChild(p3);
    app.mountDashboard(p3);
    app.restoreInternalState();
    app.renderPanelContent();
    if (dom.topPanel && dom.topPanel.classList.contains("viewing-graph")) setTimeout(app.GraphController.draw, 100);
  }
  function handleStorageEvent(e3) {
    if (e3.key === KEYS.STATE) {
      try {
        const ns = JSON.parse(e3.newValue);
        if (!ns) return;
        runtime.isSyncing = true;
        const openC = ns.isOpen !== viewState.isOpen, viewC = ns.subView !== viewState.subView, expandedC = ns.expanded !== viewState.expanded, tallC = ns.isTall !== viewState.isTall, stickerPC = ns.currentStickerPage !== viewState.currentStickerPage, labelC = ns.activeViewLabel !== viewState.activeViewLabel, calC = ns.calMonth !== viewState.calMonth || ns.calYear !== viewState.calYear, itemC = ns.activeItemId !== viewState.activeItemId, gMC = ns.graphMode !== viewState.graphMode, gSC = JSON.stringify(ns.graphStats) !== JSON.stringify(viewState.graphStats);
        setViewState(ns);
        const p3 = dom.panel;
        if (!p3) {
          runtime.isSyncing = false;
          return;
        }
        if (!openC && !viewC && !expandedC && !tallC && !stickerPC && !labelC && !calC && !itemC && !gMC && !gSC) {
          runtime.isSyncing = false;
          return;
        }
        if (!p3.classList.contains("bbgl-mode-page") && openC) {
          if (ns.isOpen && p3.style.display === "none") app.togglePanel(false);
          else if (!ns.isOpen && p3.style.display !== "none") app.closePanel(null);
        }
        if (viewC) app.switchView(ns.subView);
        if (stickerPC) {
          runtime.currentStickerPage = ns.currentStickerPage || 0;
          if (ns.subView === "stickers") app.renderStickers();
        }
        if (gMC || gSC) {
          if (ns.graphMode) graphState.mode = (ns.graphMode === "gains" ? "values" : ns.graphMode) || "values";
          if (ns.graphStats) graphState.activeStats = ns.graphStats;
          app.GraphController.restoreUi();
          if (ns.subView === "graph") window.requestAnimationFrame(app.GraphController.draw);
        }
        if (labelC) {
          if (ns.activeViewLabel) {
            const s3 = app.getActiveHistory();
            let td = null;
            if (/^\d{4}-\d{2}-\d{2}$/.test(ns.activeViewLabel)) {
              td = s3.history.find((d3) => d3.date === ns.activeViewLabel);
              if (!td && s3.today.date === ns.activeViewLabel) td = s3.today;
              if (td) {
                calendarState.selectedData = td;
                calendarState.selectedLabel = ns.activeViewLabel;
                if (ns.subView === "graph") {
                  app.GraphController.draw();
                  const de = dom.dateLabel;
                  if (de) de.innerText = Formatter.datePretty(ns.activeViewLabel);
                } else app.renderStats(td, ns.activeViewLabel);
              }
            } else {
              calendarState.selectedLabel = ns.activeViewLabel;
              const type = ns.activeViewLabel === "All-Time" ? "ALL" : /^\d{4}$/.test(ns.activeViewLabel) ? "YEAR" : "MONTH", sl = app.DataController.getSlice(type, ns.activeViewLabel, calendarState.year);
              calendarState.selectedData = sl;
              if (ns.subView === "graph") app.GraphController.draw();
              else app.renderStats(sl, ns.activeViewLabel);
            }
          } else {
            calendarState.selectedData = null;
            calendarState.selectedLabel = null;
            const ts = Formatter.dateLogical();
            if (ns.subView === "graph") {
              app.GraphController.draw();
              const de = dom.dateLabel;
              if (de) de.innerText = Formatter.datePretty(ts);
            } else app.renderStats(app.getActiveHistory().today, ts);
          }
          app.renderPanelContent();
        } else if (calC) {
          if (ns.calYear) calendarState.year = ns.calYear;
          if (ns.calMonth !== void 0 && ns.calMonth !== null) calendarState.month = ns.calMonth;
          app.renderPanelContent();
        }
        if (!p3.classList.contains("bbgl-mode-page")) {
          if (expandedC) {
            if (ns.expanded) {
              p3.classList.add("bbgl-expanded");
              p3.classList.remove("bbgl-compact");
            } else {
              p3.classList.remove("bbgl-expanded");
              p3.classList.add("bbgl-compact");
            }
            const pb = dom.popBtn;
            if (pb) pb.innerHTML = ns.expanded ? ICONS.COMPRESS : ICONS.POPOUT;
          }
          if (tallC) {
            if (ns.isTall) p3.classList.add("bbgl-tall");
            else p3.classList.remove("bbgl-tall");
            const tb = dom.tallToggle;
            if (tb) tb.innerText = ns.isTall ? "\u2013" : "+";
          }
          if (expandedC || tallC) app.handleLayout();
        }
        if (ns.subView === "stickers" || ns.subView === "viewer") {
          const ti = ns.activeItemId ? Number(ns.activeItemId) : null;
          if (ti && ti !== runtime.currentOpenedItemId) {
            if (!runtime.stickerData.length) app.loadStickerData();
            const i3 = runtime.stickerData.find((x3) => x3.id === ti);
            if (i3) {
              const delay = viewC && userConfig.animations ? 400 : 0;
              if (delay) setTimeout(() => app.openItemViewer(i3, false), delay);
              else app.openItemViewer(i3, false);
            }
          } else if (!ti && runtime.currentOpenedItemId !== null) app.closeItemViewer(false);
        }
      } catch (err) {
        Log.warn("Sync error", err);
      } finally {
        runtime.isSyncing = false;
        if (typeof app.notifyUi === "function") app.notifyUi();
      }
    } else if (e3.key === KEYS.LAST_SYNC) app._syncChannel.onmessage({ data: { from: "storage_event" } });
    else if (e3.key === KEYS.DEMO) {
      if (e3.newValue === "1") {
        if (!runtime.demoMode) app.enterDemo("external");
      } else if (runtime.demoMode) {
        const deb = dom.panel ? dom.panel.querySelector("#bbgl-demo-exit") : null;
        if (deb) deb.click();
      }
    }
  }
  async function init() {
    Perf.start("init");
    injectStyles();
    const _seenVer = localStorage.getItem(KEYS.CHANGELOG_VER);
    if (SCRIPT_VERSION && typeof SCRIPT_VERSION === "string") {
      if (!_seenVer) {
        localStorage.setItem(KEYS.CHANGELOG_VER, SCRIPT_VERSION);
      } else if (_seenVer !== SCRIPT_VERSION) {
        localStorage.setItem(KEYS.CHANGELOG_NOTIF, "1");
      }
    }
    if (!runtime.demoMode) {
      if (_seenVer && compareVersions(_seenVer, WIPE_BELOW_VERSION) < 0) {
        await app.factoryReset();
      }
      try {
        await app.DBManager.initDB();
        const loaded = await app.DBManager.loadHistory();
        app.DataController.hydrate(loaded);
        app.GraphController.applyDefaultsIfNeeded();
        await app.recoverInterruptedBackfill();
        app.renderBackfillButton();
        app.renderScanOverlay();
        if (loaded && (historyCache.history.length > 0 || historyCache.meta && historyCache.meta.logStartDate) && !localStorage.getItem("bbgl_initialized") && !sessionStorage.getItem("bbgl_dev_onboarding")) localStorage.setItem("bbgl_initialized", "1");
      } catch (e3) {
        Log.warn("IndexedDB boot failed, continuing with empty state", e3);
      }
    }
    window.addEventListener("storage", handleStorageEvent);
    window.addEventListener("hashchange", checkViewRouting);
    window.addEventListener("popstate", checkViewRouting);
    window.addEventListener("resize", () => {
      setTopCeiling(null, topCeilingTs);
    });
    window.addEventListener("bbgl:dataUpdated", () => {
      if (dom.panel && dom.panel.style.display !== "none") app.renderPanelContent();
      app.updateLevelBar();
      app.renderBackfillButton();
      app.renderScanOverlay();
    });
    app.updateLevelBar();
    let _domRaf = null;
    const domObs = new MutationObserver(function onDomMutationBatch() {
      if (_domRaf) return;
      _domRaf = requestAnimationFrame(function onDomMutationFrame() {
        _domRaf = null;
        app.handleDomMutation();
      });
    });
    runtime.domObs = domObs;
    runtime._domGuards = [];
    runtime._domObsArmed = true;
    domObs.observe(document.body, { childList: true, subtree: true });
    app.attachLayoutObservers();
    const _bbglRecheckNav = () => {
      [150, 600, 1500].forEach((ms) => setTimeout(() => {
        try {
          app.handleDomMutation();
        } catch (e3) {
        }
      }, ms));
    };
    ["pushState", "replaceState"].forEach((name) => {
      const orig = history[name];
      if (typeof orig !== "function" || orig._bbglWrapped) return;
      const wrapped = function() {
        const r4 = orig.apply(this, arguments);
        _bbglRecheckNav();
        return r4;
      };
      wrapped._bbglWrapped = true;
      history[name] = wrapped;
    });
    calendarState.selectedLabel = Formatter.dateLogical();
    if (typeof window.initDevTools === "function") window.initDevTools();
    if (!runtime.demoMode) {
      app.startBackgroundSync();
      app.checkExitSync();
    }
    app.TooltipController.init();
    let tRaf = null, tSup = 0;
    const _onMouseMove = (e3) => {
      if (tRaf || Date.now() < tSup) return;
      tRaf = requestAnimationFrame(() => {
        app.TooltipController.handleHover(e3);
        tRaf = null;
      });
    };
    let _mouseMoveBound = true;
    document.addEventListener("mousemove", _onMouseMove);
    let _tX = 0, _tY = 0, _tTimer = null, _scrubMode = false, _scrubMoveBound = null, _toolbarTipTimer = null;
    const _TOOLBAR_TOGGLE_IDS = /* @__PURE__ */ new Set(["bbgl-ledger-toggle", "bbgl-graph-toggle", "bbgl-achievements-toggle", "bbgl-sticker-toggle"]);
    const _onScrubMove = (e3) => {
      if (!_scrubMode) return;
      if (e3.cancelable) e3.preventDefault();
      const touch = e3.touches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const t3 = app.TooltipController.resolve(el);
      const _sh = t3 ? t3.getAttribute("data-tooltip-html") : null, _st = t3 ? t3.getAttribute("data-tooltip") : null;
      if (t3 && (_sh || _st)) {
        if (app.TooltipController.currentTarget !== t3) {
          if (app.TooltipController.currentTarget) {
            app.TooltipController.currentTarget.classList.remove("is-scrub-hovered");
            if (app.TooltipController.currentTarget.classList.contains("bbgl-day-cell") && !app.TooltipController.currentTarget.classList.contains("is-viewing")) app.TooltipController.currentTarget.classList.remove("shimmer-active");
          }
          app.TooltipController.currentTarget = t3;
          t3.classList.add("is-scrub-hovered");
          if (t3.classList.contains("bbgl-day-cell") && userConfig.animations) {
            t3.classList.add("shimmer-active");
            if (t3._buildShine) t3._buildShine();
          }
          app.TooltipController.show(_sh || '<div style="text-align:center; color:#ddd;">' + _st + "</div>", t3.getBoundingClientRect());
        }
      } else {
        if (app.TooltipController.currentTarget) {
          app.TooltipController.currentTarget.classList.remove("is-scrub-hovered");
          if (app.TooltipController.currentTarget.classList.contains("bbgl-day-cell") && !app.TooltipController.currentTarget.classList.contains("is-viewing")) app.TooltipController.currentTarget.classList.remove("shimmer-active");
          app.TooltipController.hide();
        }
      }
    };
    const _enterScrub = () => {
      if (_scrubMoveBound) return;
      _scrubMoveBound = _onScrubMove;
      document.addEventListener("touchmove", _scrubMoveBound, { passive: false });
    };
    const _exitScrub = () => {
      if (!_scrubMoveBound) return;
      document.removeEventListener("touchmove", _scrubMoveBound, { passive: false });
      _scrubMoveBound = null;
    };
    document.addEventListener(
      "touchstart",
      (e3) => {
        if (!document.body.classList.contains("is-touch-device")) {
          document.body.classList.add("is-touch-device");
          if (_mouseMoveBound) {
            document.removeEventListener("mousemove", _onMouseMove);
            _mouseMoveBound = false;
          }
        }
        _tX = e3.touches[0].clientX;
        _tY = e3.touches[0].clientY;
        _scrubMode = false;
        window._bbglScrubbing = false;
        const t3 = app.TooltipController.resolve(e3.target);
        const _panel = dom.panel || document.getElementById("bbgl-page-container");
        if (_panel && _panel.contains(e3.target)) {
          _tTimer = setTimeout(() => {
            _scrubMode = true;
            window._bbglScrubbing = true;
            _enterScrub();
            if (t3) {
              app.TooltipController.currentTarget = t3;
              t3.classList.add("is-scrub-hovered");
              if (t3.classList.contains("bbgl-day-cell") && userConfig.animations) {
                t3.classList.add("shimmer-active");
                if (t3._buildShine) t3._buildShine();
              }
              const _th = t3.getAttribute("data-tooltip-html"), _tt = t3.getAttribute("data-tooltip");
              if (_th || _tt) app.TooltipController.show(_th || '<div style="text-align:center; color:#ddd;">' + _tt + "</div>", t3.getBoundingClientRect());
            }
          }, 400);
        }
      },
      { passive: true }
    );
    document.addEventListener("touchmove", (e3) => {
      if (_scrubMode) return;
      if (_tTimer) {
        const dx = e3.touches[0].clientX - _tX, dy = e3.touches[0].clientY - _tY;
        if (Math.sqrt(dx * dx + dy * dy) > 10) {
          clearTimeout(_tTimer);
          _tTimer = null;
        }
      }
    }, { passive: true });
    document.addEventListener("touchend", (e3) => {
      if (_tTimer) {
        clearTimeout(_tTimer);
        _tTimer = null;
      }
      if (_scrubMode) {
        if (e3.cancelable) e3.preventDefault();
        if (app.TooltipController.currentTarget) {
          app.TooltipController.currentTarget.classList.remove("is-scrub-hovered");
          if (app.TooltipController.currentTarget.classList.contains("bbgl-day-cell") && !app.TooltipController.currentTarget.classList.contains("is-viewing")) app.TooltipController.currentTarget.classList.remove("shimmer-active");
          app.TooltipController.hide();
        }
        _scrubMode = false;
        window._bbglScrubbing = false;
        _exitScrub();
        tSup = Date.now() + 500;
        return;
      }
      _exitScrub();
      const dx = e3.changedTouches[0].clientX - _tX, dy = e3.changedTouches[0].clientY - _tY;
      if (Math.sqrt(dx * dx + dy * dy) > 10) {
        if (app.TooltipController.currentTarget) app.TooltipController.hide();
        tSup = Date.now() + 500;
        return;
      }
      const t3 = app.TooltipController.resolve(e3.target);
      if (t3 && (_TOOLBAR_TOGGLE_IDS.has(t3.id) || t3.id === "bbgl-gym-tab" && document.body.classList.contains("bbgl-page-mode-active"))) {
        if (_toolbarTipTimer) {
          clearTimeout(_toolbarTipTimer);
          _toolbarTipTimer = null;
        }
        const txt = t3.getAttribute("data-tooltip"), h3 = t3.getAttribute("data-tooltip-html");
        if (h3 || txt) {
          app.TooltipController.currentTarget = t3;
          app.TooltipController.show(h3 || '<div style="text-align:center; color:#ddd;">' + txt + "</div>", t3.getBoundingClientRect());
          _toolbarTipTimer = setTimeout(() => {
            _toolbarTipTimer = null;
            if (app.TooltipController.currentTarget === t3) app.TooltipController.hide();
          }, 500);
        }
      } else if (t3 && t3.id !== "bbgl-gym-tab") {
        const h3 = t3.getAttribute("data-tooltip-html"), txt = t3.getAttribute("data-tooltip");
        if (h3) {
          if (app.TooltipController.currentTarget === t3) app.TooltipController.hide();
        } else if (txt) {
          if (app.TooltipController.currentTarget === t3) app.TooltipController.hide();
          else {
            app.TooltipController.currentTarget = t3;
            app.TooltipController.show('<div style="text-align:center; color:#ddd;">' + txt + "</div>", t3.getBoundingClientRect());
          }
        }
      } else if (app.TooltipController.currentTarget) app.TooltipController.hide();
      tSup = Date.now() + 500;
    }, { passive: false });
    document.addEventListener("click", function(e3) {
      if (e3.target.closest("#bbgl-gym-tab")) {
        e3.preventDefault();
        e3.stopPropagation();
        app.togglePanel(true);
        return;
      }
      if (app.BestGymController.handleTrainClick(e3)) return;
      app.handleGymClick(e3);
    }, true);
    app.handleDomMutation();
    if (localStorage.getItem(KEYS.CHANGELOG_NOTIF) === "1") app.syncChangelogNotif(true);
    checkViewRouting();
    if (!window.location.hash.includes("gymlog")) app.handleLayout();
    Log.boot();
    Perf.end("init");
  }
  function installDomHooks() {
    injectStyles();
    const _oI = Node.prototype.insertBefore, _oA = Node.prototype.appendChild;
    let _hA = true, _navGymDone = false, _notesBtnDone = false, _uninstallTimer = null, _loadHandler = null;
    const needsNavGym = () => userConfig.buttonLocation === "sidebar" || userConfig.buttonLocation === "both";
    const needsNotesBtn = () => userConfig.buttonLocation === "notes" || userConfig.buttonLocation === "both";
    function forceUninstall() {
      if (!_hA) return;
      Node.prototype.insertBefore = _oI;
      Node.prototype.appendChild = _oA;
      _hA = false;
      if (_uninstallTimer) {
        clearTimeout(_uninstallTimer);
        _uninstallTimer = null;
      }
      if (_loadHandler) {
        window.removeEventListener("load", _loadHandler);
        _loadHandler = null;
      }
    }
    function maybeUninstall() {
      const navOk = !needsNavGym() || _navGymDone;
      const notesOk = !needsNotesBtn() || _notesBtnDone;
      if (navOk && notesOk) forceUninstall();
    }
    function handleNavGym() {
      if (_navGymDone) return;
      _navGymDone = true;
      if (needsNavGym()) Promise.resolve().then(() => {
        if (!document.getElementById(app.SB_MOBILE.id)) app.injectSidebarButton(app.SB_MOBILE, true);
        if (!document.getElementById(app.SB_DESKTOP.id)) app.injectSidebarButton(app.SB_DESKTOP, false);
      });
      maybeUninstall();
    }
    function handleNotesBtn(el) {
      if (_notesBtnDone) return;
      _notesBtnDone = true;
      if (needsNotesBtn()) Promise.resolve().then(() => app.injectFooterButton(el));
      maybeUninstall();
    }
    function check(n2) {
      if (!_hA || !n2 || n2.nodeType !== 1) return;
      try {
        const wantNav = needsNavGym() && !_navGymDone, wantNotes = needsNotesBtn() && !_notesBtnDone;
        if (!wantNav && !wantNotes) return;
        if (wantNav && n2.id === "nav-gym") handleNavGym();
        if (wantNotes && n2.id === "notes_panel_button") handleNotesBtn(n2);
        if (!n2.firstElementChild) return;
        const stillWantNav = needsNavGym() && !_navGymDone, stillWantNotes = needsNotesBtn() && !_notesBtnDone;
        if (!stillWantNav && !stillWantNotes) return;
        if (n2.id && !n2.id.startsWith("nav-") && n2.id !== "sidebar") return;
        const sel = stillWantNav && stillWantNotes ? "#nav-gym, #notes_panel_button" : stillWantNav ? "#nav-gym" : "#notes_panel_button";
        const hit = n2.querySelector(sel);
        if (!hit) return;
        if (hit.id === "nav-gym") handleNavGym();
        else if (hit.id === "notes_panel_button") handleNotesBtn(hit);
      } catch (e3) {
      }
    }
    Node.prototype.insertBefore = function(n2, r4) {
      const res = _oI.call(this, n2, r4);
      check(n2);
      return res;
    };
    Node.prototype.appendChild = function(n2) {
      const res = _oA.call(this, n2);
      check(n2);
      return res;
    };
    const startCountdown = () => {
      if (_uninstallTimer) return;
      _uninstallTimer = setTimeout(forceUninstall, 1e3);
    };
    if (document.readyState === "complete") startCountdown();
    else {
      _loadHandler = () => startCountdown();
      window.addEventListener("load", _loadHandler, { once: true });
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
          setTimeout(() => {
            if (_hA) forceUninstall();
          }, 3e3);
        }, { once: true });
      } else {
        setTimeout(() => {
          if (_hA) forceUninstall();
        }, 3e3);
      }
    }
  }
  app.checkViewRouting = checkViewRouting;
  app.renderPageMode = renderPageMode;
  app.handleStorageEvent = handleStorageEvent;
  app.init = init;
  app.installDomHooks = installDomHooks;

  // src/ui/scan-overlay.js
  function updateScanOverlayCount(n2) {
    const el = document.querySelector("#bbgl-scan-count");
    if (el) el.textContent = String(n2);
  }
  function renderScanOverlay() {
    if (typeof app.notifyUi === "function") app.notifyUi();
  }
  app.updateScanOverlayCount = updateScanOverlayCount;
  app.renderScanOverlay = renderScanOverlay;

  // src/ui/preact/store.ts
  var listeners = /* @__PURE__ */ new Set();
  function notifyUi() {
    listeners.forEach((fn2) => fn2());
  }
  function subscribeUi(fn2) {
    listeners.add(fn2);
    return () => {
      listeners.delete(fn2);
    };
  }
  function useUiTick() {
    const [tick, setTick] = d2(0);
    h2(() => subscribeUi(() => setTick((n2) => n2 + 1)), []);
    return tick;
  }
  setUiNotifier(notifyUi);
  app.notifyUi = notifyUi;

  // src/ui/preact/BackfillBtn.tsx
  var IDLE = "Big Black Backfill";
  var RESUME = '<span class="view-std">Resume BB Backfill</span><span class="view-exp">Resume Big Black Backfill</span>';
  var CONFIRM = "Tap Again to Confirm";
  function formatCountdown2(ms) {
    const total = Math.max(0, Math.ceil(ms / 1e3));
    const h3 = Math.floor(total / 3600);
    const m3 = Math.floor(total % 3600 / 60);
    const s3 = total % 60;
    const pad = (n2) => String(n2).padStart(2, "0");
    return `${pad(h3)}:${pad(m3)}:${pad(s3)}`;
  }
  function BackfillBtn() {
    useUiTick();
    const [confirm2, setConfirm] = d2(false);
    const [now, setNow] = d2(Date.now());
    const s3 = typeof app.getActiveHistory === "function" ? app.getActiveHistory() : null;
    const ds = s3 && s3.meta && s3.meta.backfill;
    const cooling = !!(ds && ds.lastResult === "partial" && ds.cooldownUntil && Date.now() < ds.cooldownUntil);
    h2(() => {
      if (!cooling) return;
      const id = setInterval(() => {
        if (Date.now() >= ds.cooldownUntil) {
          clearInterval(id);
          if (app.notifyUi) app.notifyUi();
          return;
        }
        setNow(Date.now());
      }, 1e3);
      return () => clearInterval(id);
    }, [cooling, ds && ds.cooldownUntil]);
    h2(() => {
      if (!confirm2) return;
      const t3 = setTimeout(() => setConfirm(false), 4e3);
      return () => clearTimeout(t3);
    }, [confirm2]);
    if (runtime.demoMode) {
      return /* @__PURE__ */ u2(Btn, { id: "backfill-btn", modifier: "purple", style: { margin: "8px 10px", width: "calc(100% - 20px)", display: "block" }, children: IDLE });
    }
    const busy = runtime.backfilling || ds && ds.acknowledged === false;
    const complete = ds && ds.lastResult === "complete";
    const partial = ds && ds.lastResult === "partial";
    const label = confirm2 ? CONFIRM : complete ? "Fully Backfilled!" : partial ? RESUME : IDLE;
    const disabled = !!(busy || cooling);
    let tip;
    if (cooling) tip = TOOLTIPS.BACKFILL_RESUME_COOLDOWN(formatCountdown2(Math.max(0, ds.cooldownUntil - now)));
    else if (complete) tip = ds.completion === "exhausted" ? TOOLTIPS.BACKFILL_COMPLETE_EXHAUSTED : TOOLTIPS.BACKFILL_COMPLETE_ORIGIN;
    return /* @__PURE__ */ u2(
      Btn,
      {
        id: "backfill-btn",
        modifier: "purple",
        disabled,
        style: {
          margin: "8px 10px",
          width: "calc(100% - 20px)",
          display: "block",
          opacity: disabled ? 0.6 : void 0,
          pointerEvents: disabled ? "none" : void 0,
          color: complete ? "#69f0ae" : void 0
        },
        onClick: (e3) => {
          e3.currentTarget.blur();
          if (disabled) return;
          if (!confirm2) {
            setConfirm(true);
            return;
          }
          setConfirm(false);
          app.startBackfillFromSettings();
        },
        children: /* @__PURE__ */ u2("span", { "data-tooltip": tip, children: label.includes("<") ? /* @__PURE__ */ u2(Raw, { html: label }) : label })
      }
    );
  }

  // src/ui/preact/Settings.tsx
  function Settings() {
    const apiRef = A2(null);
    const importRef = A2(null);
    const [verifyLabel, setVerifyLabel] = d2("REGISTER API KEY");
    const [clearLabel, setClearLabel] = d2("CLEAR API KEY");
    const [resync, setResync] = d2("idle");
    h2(() => {
      if (apiRef.current) apiRef.current.value = userConfig.apiKey || "";
      if (typeof app.refreshDemoMasks === "function") app.refreshDemoMasks();
      if (typeof app.refreshInitLock === "function") app.refreshInitLock();
    });
    function onAnim(checked) {
      userConfig.animations = checked;
      saveConfig();
      if (dom.panel) dom.panel.classList.toggle("bbgl-no-animations", !userConfig.animations);
      app.renderPanelContent();
    }
    function onRates(checked) {
      userConfig.ratesEnabled = checked;
      saveConfig();
      if (dom.panel) dom.panel.classList.toggle("bbgl-no-rates", !userConfig.ratesEnabled);
      if (!userConfig.ratesEnabled && graphState.mode === "rates") {
        graphState.mode = "values";
        viewState.graphMode = "values";
        saveViewState();
      }
      const tp = dom.topPanel;
      if (tp && tp.classList.contains("viewing-graph")) {
        app.GraphController.restoreUi();
        app.GraphController.draw();
      } else {
        const sd = calendarState.selectedData;
        app.renderStats(sd || app.getActiveHistory().today, calendarState.selectedLabel || Formatter.dateLogical());
      }
    }
    function onDrug(value) {
      userConfig.drugTracker = value;
      saveConfig();
      const tp = dom.topPanel;
      if (!tp || !tp.classList.contains("viewing-graph")) {
        const sd = calendarState.selectedData;
        app.renderStats(sd || app.getActiveHistory().today, calendarState.selectedLabel || Formatter.dateLogical());
      }
    }
    async function onRegister() {
      const el = apiRef.current;
      if (!el) return;
      const v3 = el.value.trim();
      if (!/^[a-zA-Z0-9]{16}$/.test(v3)) {
        bbglError(MSG_KEY_FORMAT_INVALID);
        return;
      }
      const ot = verifyLabel;
      setVerifyLabel("VERIFYING...");
      try {
        const res = await fetch(`https://api.torn.com/user/?selections=battlestats,log&log=5300&key=${v3}`);
        const data = await res.json();
        if (data.error) {
          bbglError(`Key Verification Failed: ${tornKeyErrorText(data)}`);
          setVerifyLabel(ot);
          return;
        }
        userConfig.apiKey = v3;
        saveConfig();
        setVerifyLabel("KEY SAVED");
        setTimeout(() => setVerifyLabel(ot), 2e3);
      } catch {
        bbglError(MSG_KEY_NETWORK_ERROR);
        setVerifyLabel(ot);
      }
    }
    function onClearKey() {
      userConfig.apiKey = "";
      saveConfig();
      if (apiRef.current) apiRef.current.value = "";
      localStorage.removeItem(KEYS.LAST_SYNC);
      sessionStorage.removeItem(KEYS.SESSION_CACHE);
      sessionStorage.removeItem(KEYS.SESSION);
      setClearLabel("WIPED");
      setTimeout(() => setClearLabel("CLEAR API KEY"), 2e3);
    }
    async function onResync(e3) {
      const btn = e3.currentTarget;
      btn.blur();
      setResync("syncing");
      await app.syncWithFeedback("FULL_SYNC");
      setResync("done");
      setTimeout(() => setResync("idle"), 2e3);
    }
    return /* @__PURE__ */ u2(S, { children: [
      /* @__PURE__ */ u2("div", { class: "close-settings-btn", title: "Close Settings", onClick: (e3) => app.toggleSettingsView(e3), children: /* @__PURE__ */ u2(Raw, { html: ICONS.CHECK }) }),
      /* @__PURE__ */ u2("div", { class: "bbgl-settings-scroll-area", children: [
        /* @__PURE__ */ u2(
          Section,
          {
            title: "Big Black Features",
            extra: /* @__PURE__ */ u2("button", { id: "resync-btn", type: "button", class: "bbgl-tab-title-btn", onClick: onResync, children: [
              /* @__PURE__ */ u2("span", { class: "bbgl-rs-idle", style: { display: resync === "idle" ? "" : "none" }, children: [
                /* @__PURE__ */ u2("span", { class: "view-std", children: "RESYNC" }),
                /* @__PURE__ */ u2("span", { class: "view-exp", children: "RESYNC LOG" })
              ] }),
              /* @__PURE__ */ u2("span", { class: "bbgl-rs-sync", style: { display: resync === "syncing" ? "" : "none" }, children: [
                /* @__PURE__ */ u2("span", { class: "view-std", children: "..." }),
                /* @__PURE__ */ u2("span", { class: "view-exp", children: "Syncing..." })
              ] }),
              /* @__PURE__ */ u2("span", { class: "bbgl-rs-done", style: { display: resync === "done" ? "" : "none" }, children: "Resynced!" })
            ] }),
            children: [
              /* @__PURE__ */ u2(Toggle, { id: "set-bestgym-toggle", checked: !!userConfig.bestGym, label: "BB Best Gym", tip: TOOLTIPS.BEST_GYM, extraClass: "bbgl-bestgym-lead", onChange: (v3) => app.setBestGym(v3) }),
              /* @__PURE__ */ u2(Toggle, { id: "set-bestgym-spec-toggle", checked: !!userConfig.bestGymSpecialist, label: "Specialty Gyms", tip: TOOLTIPS.BEST_GYM_SPEC, extraClass: `bbgl-subgroup-row${!userConfig.bestGym ? " bbgl-row-disabled" : ""}`, onChange: (v3) => {
                userConfig.bestGymSpecialist = v3;
                saveConfig();
              } }),
              /* @__PURE__ */ u2(Toggle, { id: "set-bestgym-unpurch-toggle", checked: !!userConfig.bestGymUnpurchased, label: "Unpurchased Gyms", tip: TOOLTIPS.BEST_GYM_UNPURCHASED, extraClass: `bbgl-subgroup-row bbgl-subgroup-row-last${!userConfig.bestGym ? " bbgl-row-disabled" : ""}`, onChange: (v3) => {
                userConfig.bestGymUnpurchased = v3;
                saveConfig();
              } }),
              /* @__PURE__ */ u2(Toggle, { id: "set-rate-toggle", checked: !!userConfig.ratesEnabled, label: "Rate Displays", tip: TOOLTIPS.RATES, onChange: onRates }),
              /* @__PURE__ */ u2(Toggle, { id: "set-anim-toggle", checked: !!userConfig.animations, label: "Animations", tip: TOOLTIPS.ANIM, onChange: onAnim }),
              /* @__PURE__ */ u2(Row, { label: /* @__PURE__ */ u2("span", { "data-tooltip-html": TOOLTIPS.DRUG_TRACKER, children: "Drug Use Tracker" }), children: /* @__PURE__ */ u2("select", { id: "set-drug-tracker", class: "bbgl-native-select", value: userConfig.drugTracker || "xanax", onChange: (e3) => onDrug(e3.target.value), children: [
                /* @__PURE__ */ u2("option", { value: "xanax", children: "Xanax" }),
                /* @__PURE__ */ u2("option", { value: "lsd", children: "LSD" })
              ] }) }),
              /* @__PURE__ */ u2("div", { class: "bbgl-mask-host bbgl-demo-maskable", "data-mask-text": "Not available in demo mode", children: /* @__PURE__ */ u2(BackfillBtn, {}) })
            ]
          }
        ),
        /* @__PURE__ */ u2(Section, { title: "Log Format", children: [
          /* @__PURE__ */ u2(Row, { label: /* @__PURE__ */ u2("span", { "data-tooltip-html": TOOLTIPS.LOC, children: "Log Access" }), children: /* @__PURE__ */ u2("select", { id: "set-loc-select", class: "bbgl-native-select", value: userConfig.buttonLocation, onChange: (e3) => app.onChangeLoc(e3.target.value), children: [
            /* @__PURE__ */ u2("option", { value: "notes", children: "Footer Tab" }),
            /* @__PURE__ */ u2("option", { value: "sidebar", children: "Sidebar" }),
            /* @__PURE__ */ u2("option", { value: "both", children: "Both" })
          ] }) }),
          /* @__PURE__ */ u2(Row, { label: /* @__PURE__ */ u2("span", { "data-tooltip-html": TOOLTIPS.DAY_START, children: "Log Timezone" }), children: /* @__PURE__ */ u2("select", { id: "set-day-start", class: "bbgl-native-select", value: userConfig.dayStartMode, onChange: (e3) => app.onChangeDayStart(e3.target.value), children: [
            /* @__PURE__ */ u2("option", { value: "utc", children: "Torn Time (UTC)" }),
            /* @__PURE__ */ u2("option", { value: "local", children: "Local Time" })
          ] }) }),
          /* @__PURE__ */ u2(Row, { label: /* @__PURE__ */ u2("span", { "data-tooltip-html": TOOLTIPS.WEEK_START, children: "Week Start" }), children: /* @__PURE__ */ u2("select", { id: "set-week-start", class: "bbgl-native-select", value: userConfig.weekStartMode, onChange: (e3) => app.onChangeWeekStart(e3.target.value), children: [
            /* @__PURE__ */ u2("option", { value: "sun", children: "Sun \u2013 Sat" }),
            /* @__PURE__ */ u2("option", { value: "mon", children: "Mon \u2013 Sun" })
          ] }) })
        ] }),
        /* @__PURE__ */ u2(Section, { title: "Data Management", children: /* @__PURE__ */ u2("div", { class: "bbgl-mask-host bbgl-demo-maskable", "data-mask-text": "Not available in demo mode", children: [
          /* @__PURE__ */ u2(Btn, { id: "refresh-log-btn", style: { display: "none" }, onClick: (e3) => {
            const btn = e3.currentTarget;
            btn.blur();
            if (app.checkRefreshCooldown(btn)) return;
            app.syncWithFeedback("FULL_SYNC");
          }, children: "REFRESH LOG" }),
          /* @__PURE__ */ u2("div", { class: "bbgl-btn-grid", style: { margin: "8px 10px 0 10px" }, children: [
            /* @__PURE__ */ u2(Btn, { id: "export-btn", style: { borderRadius: "5px 0 0 0", borderBottom: "none" }, onClick: (e3) => {
              e3.currentTarget.blur();
              app.exportData();
            }, children: "EXPORT LOG" }),
            /* @__PURE__ */ u2(Btn, { id: "import-btn", style: { borderRadius: "0 5px 0 0", borderBottom: "none" }, onClick: (e3) => {
              e3.currentTarget.blur();
              importRef.current?.click();
            }, children: "IMPORT LOG" }),
            /* @__PURE__ */ u2("input", { id: "import-file", ref: (el) => {
              importRef.current = el;
            }, type: "file", accept: ".json,application/json", style: { display: "none" }, onChange: (e3) => app.importData(e3.target.files?.[0]) })
          ] }),
          /* @__PURE__ */ u2(Btn, { id: "clear-btn", modifier: "red", style: { margin: "0 10px 8px 10px", width: "calc(100% - 20px)", display: "block", borderTopLeftRadius: 0, borderTopRightRadius: 0 }, onClick: (e3) => {
            e3.currentTarget.blur();
            app.clearData();
          }, children: "CLEAR LOG" })
        ] }) }),
        /* @__PURE__ */ u2(Section, { title: "API Access", bodyStyle: { marginBottom: 5 }, children: /* @__PURE__ */ u2("div", { class: "bbgl-mask-host bbgl-demo-maskable", "data-mask-text": "Not available in demo mode", children: [
          /* @__PURE__ */ u2(ApiField, { prefix: "set", inputRef: apiRef, defaultValue: userConfig.apiKey || "" }),
          /* @__PURE__ */ u2(Btn, { id: "create-api-btn", style: { margin: "0 10px", width: "calc(100% - 20px)", display: "block", ...STACK.top }, onClick: (e3) => {
            e3.currentTarget.blur();
            window.open(CREATE_API_URL, "_blank");
          }, children: "CREATE API KEY" }),
          /* @__PURE__ */ u2("div", { class: "bbgl-btn-grid", style: { margin: "0 10px 10px 10px" }, children: [
            /* @__PURE__ */ u2(Btn, { id: "clear-api-btn", modifier: "red", style: { borderRadius: "0 0 0 5px" }, onClick: (e3) => {
              e3.currentTarget.blur();
              onClearKey();
            }, children: clearLabel }),
            /* @__PURE__ */ u2(Btn, { id: "updt-settings-btn", modifier: "green", style: { borderRadius: "0 0 5px 0" }, onClick: (e3) => {
              e3.currentTarget.blur();
              onRegister();
            }, children: verifyLabel })
          ] })
        ] }) }),
        /* @__PURE__ */ u2(Section, { title: "Information", children: [
          /* @__PURE__ */ u2("div", { class: "bbgl-settings-author-credit", children: [
            "By ",
            /* @__PURE__ */ u2("a", { class: "bbgl-author-link", href: "https://www.torn.com/profiles.php?XID=3550896", target: "_blank", rel: "noopener noreferrer", children: "BigBlackHawk" })
          ] }),
          /* @__PURE__ */ u2(Btn, { id: "feature-guide-btn", style: { margin: "8px 10px 0 10px", width: "calc(100% - 20px)", display: "block", ...STACK.top }, onClick: (e3) => {
            e3.currentTarget.blur();
            app.openFeatureGuideModal();
          }, children: "FEATURE GUIDE" }),
          /* @__PURE__ */ u2("div", { class: "bbgl-mask-host bbgl-demo-maskable", "data-mask-text": "Not available in demo mode", style: { margin: "0 10px", display: "flex", flexDirection: "column" }, children: [
            /* @__PURE__ */ u2(Btn, { id: "settings-changelog-btn", style: { width: "100%", ...STACK.mid }, onClick: (e3) => {
              e3.currentTarget.blur();
              app.openChangelogModal();
            }, children: "CHANGELOG" }),
            /* @__PURE__ */ u2(Btn, { id: "settings-privacy-btn", style: { width: "100%", ...STACK.mid }, onClick: (e3) => {
              e3.currentTarget.blur();
              app.openPrivacyModal();
            }, children: "PRIVACY DISCLOSURE" })
          ] }),
          /* @__PURE__ */ u2(
            Btn,
            {
              id: "settings-demo-btn",
              modifier: "purple",
              style: { margin: "0 10px 8px 10px", width: "calc(100% - 20px)", display: "block", ...STACK.bottom },
              onClick: (e3) => {
                e3.currentTarget.blur();
                if (runtime.demoMode) {
                  const deb = document.getElementById("bbgl-demo-exit");
                  if (deb) deb.click();
                } else app.enterDemoFromSettings();
              },
              children: runtime.demoMode ? "EXIT DEMO" : "DEMO MODE"
            }
          )
        ] })
      ] })
    ] });
  }

  // src/ui/preact/Welcome.tsx
  function Welcome() {
    const apiRef = A2(null);
    const importRef = A2(null);
    const hostRef = A2(null);
    const [introHtml, setIntroHtml] = d2(app.DOC_LOADING_HTML || "");
    const [returningHtml, setReturningHtml] = d2(app.DOC_LOADING_HTML || "");
    const [startLabel, setStartLabel] = d2("START TRACKING");
    const [startBusy, setStartBusy] = d2(false);
    const canClose = !!localStorage.getItem("bbgl_initialized") || runtime.demoMode;
    h2(() => {
      let cancelled = false;
      (async () => {
        try {
          const raw = await app.fetchDoc("welcome");
          const parts = String(raw).split("<!--RETURNING-->");
          if (cancelled) return;
          setIntroHtml(parts[0] || app.DOC_ERROR_HTML);
          setReturningHtml(parts[1] || app.DOC_ERROR_HTML);
        } catch {
          if (!cancelled) {
            setIntroHtml(app.DOC_ERROR_HTML);
            setReturningHtml(app.DOC_ERROR_HTML);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []);
    h2(() => {
      if (hostRef.current && typeof app.refreshInitMask === "function") app.refreshInitMask(hostRef.current);
    });
    async function onStart(e3) {
      const btn = e3.currentTarget;
      btn.blur();
      const v3 = (apiRef.current?.value || "").trim();
      if (!/^[a-zA-Z0-9]{16}$/.test(v3)) {
        bbglError(MSG_KEY_FORMAT_INVALID);
        return;
      }
      setStartBusy(true);
      setStartLabel("VERIFYING...");
      try {
        const res = await fetch(`https://api.torn.com/user/?selections=battlestats,log&log=5300&key=${v3}`);
        const data = await res.json();
        if (data.error) {
          bbglError(`Key Verification Failed: ${tornKeyErrorText(data)}`);
          setStartBusy(false);
          setStartLabel("START TRACKING");
          return;
        }
        userConfig.apiKey = v3;
        saveConfig();
        localStorage.setItem("bbgl_initialized", "1");
        app.refreshInitLock();
        calendarState.selectedData = null;
        calendarState.selectedLabel = Formatter.dateLogical();
        viewState.activeViewLabel = null;
        app.syncWithFeedback("FULL_SYNC");
        app.openBackfillChoiceModal();
      } catch {
        bbglError(MSG_KEY_NETWORK_ERROR);
        setStartBusy(false);
        setStartLabel("START TRACKING");
      }
    }
    return /* @__PURE__ */ u2("div", { ref: hostRef, children: [
      canClose ? /* @__PURE__ */ u2("div", { class: "close-settings-btn bbgl-close-x", title: "Close", onClick: (e3) => {
        e3.stopPropagation();
        app.switchView("ledger");
      }, children: /* @__PURE__ */ u2(Raw, { html: ICONS.CLOSE }) }) : null,
      /* @__PURE__ */ u2("div", { class: "bbgl-settings-scroll-area", children: [
        /* @__PURE__ */ u2("div", { class: "bbgl-prefs-tab-title", style: { borderRadius: "5px 5px 0 0", marginTop: 0 }, children: /* @__PURE__ */ u2("span", { children: "Welcome to Big Black Gym Log" }) }),
        /* @__PURE__ */ u2("div", { class: "bbgl-settings-body", style: { marginBottom: 5 }, children: [
          /* @__PURE__ */ u2("div", { id: "bbgl-welcome-intro-text", dangerouslySetInnerHTML: { __html: introHtml } }),
          /* @__PURE__ */ u2(Btn, { id: "init-privacy-btn", style: { margin: "0 10px 8px 10px", width: "calc(100% - 20px)", display: "block" }, onClick: (e3) => {
            e3.currentTarget.blur();
            app.openPrivacyModal();
          }, children: "PRIVACY DISCLOSURE" })
        ] }),
        /* @__PURE__ */ u2(Section, { title: "Initialization Settings", bodyStyle: { marginBottom: 5 }, children: /* @__PURE__ */ u2("div", { id: "init-section-masked-body", class: "bbgl-mask-host", "data-mask-text": "Please agree to the privacy disclosure first.", children: [
          /* @__PURE__ */ u2(ApiField, { prefix: "init", inputRef: apiRef, defaultValue: userConfig.apiKey || "", style: { margin: "8px 10px" } }),
          /* @__PURE__ */ u2(Btn, { id: "init-create-api-btn", style: { margin: "0 10px 8px 10px", width: "calc(100% - 20px)", display: "block" }, onClick: (e3) => {
            e3.currentTarget.blur();
            window.open(CREATE_API_URL, "_blank");
          }, children: "CREATE API KEY" }),
          /* @__PURE__ */ u2(Row, { label: /* @__PURE__ */ u2("span", { "data-tooltip-html": TOOLTIPS.DAY_START, children: "Log Timezone" }), children: /* @__PURE__ */ u2("select", { id: "init-day-start", class: "bbgl-native-select", value: userConfig.dayStartMode, onChange: (e3) => app.onChangeDayStart(e3.target.value), children: [
            /* @__PURE__ */ u2("option", { value: "utc", children: "Torn Time (UTC)" }),
            /* @__PURE__ */ u2("option", { value: "local", children: "Local Time" })
          ] }) }),
          /* @__PURE__ */ u2(Row, { label: /* @__PURE__ */ u2("span", { "data-tooltip-html": TOOLTIPS.WEEK_START, children: "Week Start" }), children: /* @__PURE__ */ u2("select", { id: "init-week-start", class: "bbgl-native-select", value: userConfig.weekStartMode, onChange: (e3) => app.onChangeWeekStart(e3.target.value), children: [
            /* @__PURE__ */ u2("option", { value: "sun", children: "Sun \u2013 Sat" }),
            /* @__PURE__ */ u2("option", { value: "mon", children: "Mon \u2013 Sun" })
          ] }) }),
          /* @__PURE__ */ u2(Btn, { id: "init-start-btn", modifier: "green", disabled: startBusy, style: { margin: "8px 10px", width: "calc(100% - 20px)", display: "block", color: startBusy ? "#69f0ae" : void 0 }, onClick: onStart, children: startLabel })
        ] }) }),
        /* @__PURE__ */ u2(Section, { title: "Returning User", bodyStyle: { marginBottom: 5 }, children: [
          /* @__PURE__ */ u2("div", { id: "bbgl-welcome-returning-text", dangerouslySetInnerHTML: { __html: returningHtml } }),
          /* @__PURE__ */ u2(Btn, { id: "init-returning-import-btn", style: { margin: "0 10px 8px 10px", width: "calc(100% - 20px)", display: "block" }, onClick: (e3) => {
            e3.currentTarget.blur();
            importRef.current?.click();
          }, children: "IMPORT LOG" }),
          /* @__PURE__ */ u2("input", { id: "init-import-file", ref: (el) => {
            importRef.current = el;
          }, type: "file", accept: ".json,application/json", style: { display: "none" }, onChange: (e3) => {
            const f4 = e3.target.files?.[0];
            if (f4) app.importDataFromWelcome(f4);
          } })
        ] })
      ] })
    ] });
  }

  // src/ui/preact/chrome.ts
  function onHeaderClick(e3) {
    const t3 = e3.target;
    if (!t3) return;
    if (t3.closest(".bbgl-custom-icon") || t3.closest("#bbgl-demo-exit-btn") || t3.closest("#bbgl-pop-btn") || t3.closest("#bbgl-demo-exit")) return;
    app.closePanel();
  }
  function onPopoutClick(e3) {
    e3.stopPropagation();
    if (!dom.panel || dom.panel.classList.contains("bbgl-mode-page")) return;
    const p3 = dom.panel;
    const animate = userConfig.animations && !p3.classList.contains("bbgl-no-animations");
    if (animate) app.markPanelResizing(p3);
    viewState.expanded = !viewState.expanded;
    if (viewState.expanded) {
      p3.classList.add("bbgl-expanded");
      p3.classList.remove("bbgl-compact");
    } else {
      p3.classList.remove("bbgl-expanded");
      p3.classList.add("bbgl-compact");
    }
    saveViewState();
    app.handleLayout();
    app.renderPanelContent();
    if (dom.topPanel && dom.topPanel.classList.contains("viewing-graph")) {
      app.GraphController.draw();
      setTimeout(app.GraphController.draw, 320);
    }
    if (dom.topPanel && dom.topPanel.classList.contains("viewing-achievements")) {
      setTimeout(app.resizeAchLockedPage, 320);
    }
  }
  function onCopySession(e3) {
    e3.stopPropagation();
    const cs = runtime.currentStats;
    if (!cs) return;
    const { sl, s: s3 } = cs;
    const txt = app.buildSessionText(sl, s3, ["str", "def", "spd", "dex"]);
    const cpb = dom.panel?.querySelector("#bbgl-copy-btn") || dom.copyBtn;
    navigator.clipboard.writeText(txt).then(() => {
      const cols = dom.ledgerView ? Array.from(dom.ledgerView.querySelectorAll(".stat-column")) : [];
      if (cols.length) app.flashCopied(cols);
      if (!cpb) return;
      const oH = cpb.innerHTML, oC = cpb.style.color;
      cpb.innerHTML = ICONS.CHECK;
      cpb.style.color = "#69f0ae";
      cpb.style.opacity = "1";
      setTimeout(() => {
        cpb.innerHTML = oH;
        cpb.style.color = oC;
        cpb.style.opacity = "";
      }, 1e3);
    });
  }
  function onDemoExit(e3) {
    e3.stopPropagation();
    localStorage.removeItem(KEYS.DEMO);
    runtime.demoMode = false;
    runtime.demoHistory = null;
    runtime.stickerData = [];
    setHistoryCache(null);
    app.DataController.invalidate();
    app.DBManager.loadHistory().then((loaded) => {
      app.DataController.hydrate(loaded);
      if (userConfig.apiKey) app.startBackgroundSync();
    }).catch(() => {
      if (userConfig.apiKey) app.startBackgroundSync();
    }).finally(() => app.snapLevelBar());
    calendarState.selectedData = null;
    calendarState.selectedLabel = Formatter.dateLogical();
    viewState.activeViewLabel = null;
    const tip = window.TooltipController;
    if (tip) tip.hide();
    app.refreshInitLock();
    app.refreshDemoMasks();
    if (typeof runtime.realReturnView === "string") {
      runtime.returnView = runtime.realReturnView;
      runtime.realReturnView = null;
    }
    const pdeb = document.getElementById("bbgl-page-demo-exit");
    if (pdeb) pdeb.style.display = "none";
    const isInit = !!localStorage.getItem("bbgl_initialized");
    if (isInit) app.switchView("settings");
    else {
      app.switchView("welcome", true);
      app.openPrivacyModal();
    }
    saveConfig();
  }

  // src/ui/preact/views/Calendar.tsx
  function buildCells(y3, m3) {
    const f4 = new Date(y3, m3, 1);
    let start = f4.getDay();
    if (userConfig.weekStartMode === "mon") start = start === 0 ? 6 : start - 1;
    const dim = new Date(y3, m3 + 1, 0).getDate();
    const dipm = new Date(y3, m3, 0).getDate();
    let pm = m3 - 1, py = y3;
    if (pm < 0) {
      pm = 11;
      py--;
    }
    const cells = [];
    for (let i3 = 0; i3 < start; i3++) cells.push({ y: py, m: pm, d: dipm - start + i3 + 1, g: true });
    for (let d3 = 1; d3 <= dim; d3++) cells.push({ y: y3, m: m3, d: d3, g: false });
    const rem = 7 - cells.length % 7;
    if (rem < 7 && rem > 0) {
      let nm = m3 + 1, ny = y3;
      if (nm > 11) {
        nm = 0;
        ny++;
      }
      for (let i3 = 1; i3 <= rem; i3++) cells.push({ y: ny, m: nm, d: i3, g: true });
    }
    return cells;
  }
  function jewelUrls(tier) {
    let tType = "green";
    let url = `${app.CAL_IMG_BASE}}rwrd-grn.png`;
    if (tier === 2) {
      tType = "gold";
      url = `${app.CAL_IMG_BASE}}rwrd-gold.png`;
    } else if (tier === 3) {
      tType = "diamond";
      url = `${app.CAL_IMG_BASE}}rwrd-dmnd.png`;
    }
    return { type: tType, url };
  }
  function DayCell(props) {
    const { z: z3, rIdx, cIdx, archived } = props;
    const ds = Formatter.dateISO(z3.y, z3.m, z3.d);
    const sl = app.DataController.getSlice("DAY", ds);
    const cellRef = A2(null);
    const [shineOn, setShineOn] = d2(false);
    const isToday = ds === Formatter.dateLogical();
    const isViewing = calendarState.selectedLabel === ds || !calendarState.selectedLabel && isToday;
    const h3 = app.getActiveHistory();
    const tl = app.DataController.getTimeline();
    const firstDate = tl.length > 0 ? tl[0].date : h3 ? h3.today.date : null;
    const isInteractive = !sl.meta.isGap || firstDate && ds >= firstDate && ds <= Formatter.dateLogical();
    const sticker = archived && sl.meta.tier > 0 ? app.DataController.getStickerMap().get(ds) : null;
    const featured = !!(sticker && app.DataController._cache.featuredDays && app.DataController._cache.featuredDays.has(ds) && !app.DataController.isStickerCleared(sticker.id));
    function buildShine(el) {
      if (!el) return;
      if (archived && sticker) {
        if (el.querySelector(".sticker-shine")) return;
        const sw = el.querySelector(".sticker-wrapper");
        if (!sw) return;
        const ss = document.createElement("div");
        ss.className = "sticker-shine";
        ss.style.webkitMaskImage = `url("${sticker.url}")`;
        ss.style.maskImage = `url("${sticker.url}")`;
        let grad = `linear-gradient(115deg,rgba(0,200,150,0.55) 0%,rgba(0,255,180,0.65) 20%,rgba(0,255,255,0.7) 35%,rgba(255,255,240,0.75) 50%,rgba(255,0,255,0.85) 65%,rgba(0,150,255,0.9) 80%,rgba(0,200,150,0.85) 100%)`;
        if (sl.meta.tier === 2) grad = `linear-gradient(115deg,rgba(184,134,11,0.7) 0%,rgba(212,175,55,0.85) 11%,rgba(255,255,240,1.0) 13%,rgba(212,175,55,0.8) 15%,rgba(0,255,255,0.7) 35%,rgba(255,0,255,0.85) 65%,rgba(0,150,255,0.9) 80%,rgba(184,134,11,0.85) 100%)`;
        else if (sl.meta.tier === 3) grad = `linear-gradient(115deg,rgba(0,255,255,0.85) 0%,rgba(200,100,255,0.85) 5%,rgba(255,0,255,0.85) 10%,rgba(0,150,255,0.85) 15%,rgba(0,255,255,0.75) 35%,rgba(255,0,255,0.85) 65%,rgba(0,150,255,0.9) 80%,rgba(0,255,255,0.85) 85%,rgba(200,100,255,0.85) 90%,rgba(255,0,255,0.85) 95%,rgba(0,150,255,0.85) 100%)`;
        ss.style.backgroundImage = grad;
        ss.style.mixBlendMode = "overlay";
        if (sl.meta.tier >= 2) ss.style.filter = "brightness(1.5)";
        sw.appendChild(ss);
        return;
      }
      if (!archived && sl.meta.tier > 0) {
        const wrap = el.querySelector(".jewel-wrapper");
        if (!wrap || wrap.querySelector(".jewel-shine")) return;
        const { url } = jewelUrls(sl.meta.tier);
        const img = wrap.querySelector(".jewel-asset");
        const sh = document.createElement("div");
        sh.className = "jewel-shine";
        sh.style.maskImage = `url("${url}")`;
        sh.style.webkitMaskImage = `url("${url}")`;
        if (sl.meta.tier === 2) wrap.appendChild(sh);
        else {
          if (img) wrap.insertBefore(sh, img);
          else wrap.appendChild(sh);
          const so = document.createElement("div");
          so.className = "jewel-shine-over";
          so.style.setProperty("--jewel-mask", `url("${url}")`);
          wrap.appendChild(so);
        }
      }
    }
    h2(() => {
      const el = cellRef.current;
      if (!el) return;
      el._buildShine = () => buildShine(el);
      if (isViewing || shineOn) buildShine(el);
    });
    const cls = [
      "bbgl-day-cell",
      archived ? "is-archived" : "",
      z3.g ? "ghost-cell" : "",
      !archived && sl.meta.tier > 0 ? "is-plate" : "",
      isViewing ? "is-viewing" : "",
      (isViewing || shineOn) && userConfig.animations ? "shimmer-active" : ""
    ].filter(Boolean).join(" ");
    const style = {};
    if (archived && sl.meta.tier > 0) {
      let url = `url(${app.CAL_IMG_BASE}}cal-grid-grn.jpg)`;
      if (sl.meta.tier === 2) url = `url(${app.CAL_IMG_BASE}}cal-grid-gold.jpg)`;
      else if (sl.meta.tier === 3) url = `url(${app.CAL_IMG_BASE}}cal-grid-dmnd.jpg)`;
      style.backgroundImage = url;
      style.backgroundSize = "700% 600%";
      style.backgroundPosition = `${(cIdx * (100 / 6)).toFixed(4)}% ${(rIdx * (100 / 5)).toFixed(4)}%`;
    }
    const eventImgs = [];
    if (archived) {
      const wm = app.getWarMarkers()[ds];
      if ((sl.lsdODs || 0) > 0) eventImgs.push(app.CAL_IMG_BASE + "lsd-od.png");
      if ((sl.xanaxODs || 0) > 0) eventImgs.push(app.CAL_IMG_BASE + "xan-od.png");
      if ((sl.exODs || 0) > 0) eventImgs.push("PLACEHOLDER_EX_OD_URL");
      if (wm && wm.warStart) eventImgs.push(app.CAL_IMG_BASE + "war-strt.png");
      if (wm && wm.warWon) eventImgs.push(app.CAL_IMG_BASE + "war-win.png");
      if (wm && wm.warLost) eventImgs.push(app.CAL_IMG_BASE + "war-lost.png");
    }
    const uid = Math.floor(new Date(Date.UTC(z3.y, z3.m, z3.d)).getTime() / 864e5);
    const tipHtml = isInteractive ? app.generateRichTooltip(sl) : void 0;
    const tipPlain = isInteractive ? void 0 : TOOLTIPS.CELL_DATE(ds);
    if (isInteractive && viewState.activeViewLabel === ds && calendarState.selectedLabel !== ds) {
      runtime._pendingHistoryRestore = { sl, label: ds };
    }
    return /* @__PURE__ */ u2(
      "div",
      {
        ref: cellRef,
        id: isToday ? "active-date-today" : void 0,
        class: cls,
        "data-date": ds,
        style,
        "data-tooltip-html": tipHtml,
        "data-tooltip": tipPlain,
        onMouseEnter: () => {
          if (userConfig.animations) {
            setShineOn(true);
            buildShine(cellRef.current);
          }
        },
        onMouseLeave: () => {
          if (!isViewing) setShineOn(false);
        },
        onClick: () => {
          if (isToday) app.closeHistory();
          else if (isInteractive) app.openHistory(sl, ds);
        },
        children: [
          !archived && sl.meta.tier > 0 && (() => {
            const j4 = jewelUrls(sl.meta.tier);
            return /* @__PURE__ */ u2("div", { class: `jewel-wrapper jewel-type-${j4.type}`, children: /* @__PURE__ */ u2("img", { class: "jewel-asset", src: j4.url }) });
          })(),
          /* @__PURE__ */ u2("span", { class: "day-num", children: z3.d }),
          eventImgs.map((url, i3) => /* @__PURE__ */ u2(
            "div",
            {
              class: "bbgl-event-post-it" + (eventImgs.length > 1 && i3 === eventImgs.length - 1 ? " bbgl-event-post-it-top" : ""),
              style: { backgroundImage: `url('${url}')`, ["--ei"]: i3, ["--stack-total"]: eventImgs.length }
            },
            url + i3
          )),
          sticker && /* @__PURE__ */ u2(
            "div",
            {
              class: "sticker-wrapper" + (sl.meta.tier === 3 ? " sticker-tier-diamond" : ""),
              style: { ["--rot"]: `${uid * 17 % 21 - 10}deg` },
              children: /* @__PURE__ */ u2("img", { src: sticker.url, class: "cell-sticker-deco" })
            }
          ),
          featured && sticker && /* @__PURE__ */ u2(
            "div",
            {
              class: "new-sticker-post-it",
              onClick: (e3) => {
                e3.stopPropagation();
                const cell = cellRef.current;
                const pi = e3.currentTarget;
                if (cell) {
                  cell.style.setProperty("overflow", "visible", "important");
                  cell.style.setProperty("z-index", "100", "important");
                }
                pi.classList.add("post-it-rip");
                app.DataController.markStickerCleared(sticker.id);
                setTimeout(() => {
                  if (pi.parentNode) pi.remove();
                  if (cell) {
                    cell.style.removeProperty("overflow");
                    cell.style.removeProperty("z-index");
                    cell.click();
                  }
                }, 600);
              }
            }
          )
        ]
      }
    );
  }
  function WeeklyBar(props) {
    const sl = app.DataController.getSlice("CUSTOM", props.batch.map((w3) => w3.data).filter(Boolean));
    sl.label = `Week ${getISOWeek(props.batch[0].date)}`;
    sl._weekStart = props.batch[0].date;
    sl._weekEnd = props.batch[props.batch.length - 1].date;
    if (!sl._dailyList || sl._dailyList.length === 0) return null;
    const { hjDaySet } = app.DataController.getHappyJumpData();
    const _wk = getWeekKey(sl._dailyList[0].date);
    const installWeekKey = runtime.demoMode ? null : app.getInstallWeekKey();
    const viewing = calendarState.selectedLabel === sl.label;
    if (viewState.activeViewLabel === sl.label && calendarState.selectedLabel !== sl.label) {
      runtime._pendingHistoryRestore = { sl, label: sl.label };
    }
    const preInstall = !!(installWeekKey && _wk < installWeekKey);
    const { capsules, isCompleted } = preInstall ? { capsules: ["silver", "silver", "silver", "silver", "silver"], isCompleted: false } : computeWeekCompletion(sl._dailyList, hjDaySet);
    const barHtml = app.buildCapsuleBar(capsules, preInstall ? false : isCompleted, !preInstall && isCompleted && userConfig.animations);
    const tip = app.generateRichTooltip(sl);
    return /* @__PURE__ */ u2("div", { class: "bbgl-weekly-anchor", children: [
      /* @__PURE__ */ u2(
        "div",
        {
          class: "bbgl-weekly-track" + (isCompleted && !preInstall ? " track-polished" : "") + (viewing ? " is-viewing" : ""),
          "data-label": sl.label,
          "data-tooltip-html": tip,
          "data-tooltip-anchor": ".bbgl-bar-handle",
          onClick: (e3) => {
            e3.stopPropagation();
            app.openHistory(sl, sl.label);
          },
          dangerouslySetInnerHTML: { __html: barHtml }
        }
      ),
      /* @__PURE__ */ u2(
        "div",
        {
          class: "bbgl-bar-handle",
          "data-pos": "start",
          "data-tooltip-html": tip,
          "data-tooltip-anchor": ".bbgl-bar-handle",
          onClick: (e3) => {
            e3.stopPropagation();
            app.openHistory(sl, sl.label);
          },
          onMouseEnter: (e3) => e3.currentTarget.parentElement?.querySelector(".bbgl-weekly-track")?.classList.add("is-scrub-hovered"),
          onMouseLeave: (e3) => e3.currentTarget.parentElement?.querySelector(".bbgl-weekly-track")?.classList.remove("is-scrub-hovered"),
          children: /* @__PURE__ */ u2(Raw, { html: app.buildChartSVG(sl) })
        }
      )
    ] });
  }
  function MonthHeader() {
    useUiTick();
    const [open, setOpen] = d2(null);
    const monthDrop = A2(null);
    const yearDrop = A2(null);
    const monthTrig = A2(null);
    const yearTrig = A2(null);
    const y3 = calendarState.year;
    const m3 = calendarState.month;
    const monthSlice = app.DataController.getSlice("MONTH", CONSTANTS.MONTHS[m3], y3);
    const yearSlice = app.DataController.getSlice("YEAR", String(y3));
    const allSlice = app.DataController.getSlice("ALL", "All-Time");
    const activeL = viewState.activeViewLabel;
    h2(() => {
      if (!open) return;
      const d3 = open === "month" ? monthDrop.current : yearDrop.current;
      const t3 = open === "month" ? monthTrig.current : yearTrig.current;
      if (d3 && t3 && typeof app.openDropdown === "function") app.openDropdown(d3, t3);
      const onDoc = (e3) => {
        const target = e3.target;
        if (d3 && d3.contains(target)) return;
        if (t3 && t3.contains(target)) return;
        setOpen(null);
      };
      document.addEventListener("click", onDoc);
      return () => document.removeEventListener("click", onDoc);
    }, [open]);
    const years = (() => {
      const s3 = app.getActiveHistory();
      const ys = /* @__PURE__ */ new Set();
      (s3.history || []).forEach((z3) => ys.add(parseInt(z3.date.split("-")[0], 10)));
      if (s3.today && s3.today.date) ys.add(parseInt(s3.today.date.split("-")[0], 10));
      return Array.from(ys).sort((a3, b2) => b2 - a3);
    })();
    return /* @__PURE__ */ u2("div", { class: "bbgl-header-wrapper", children: /* @__PURE__ */ u2("div", { class: "bbgl-month-header", children: [
      /* @__PURE__ */ u2("div", { class: "title-group", children: /* @__PURE__ */ u2("div", { class: "title-stack", children: [
        /* @__PURE__ */ u2("div", { class: "header-row header-row--alltime", children: [
          /* @__PURE__ */ u2(
            "div",
            {
              class: "stats-btn" + (activeL === "All-Time" ? " active" : ""),
              id: "all-time-btn",
              "data-tooltip-html": app.generateRichTooltip(allSlice),
              onClick: (e3) => {
                e3.stopPropagation();
                app.calcAllTimeStats();
              },
              children: /* @__PURE__ */ u2(Raw, { html: app.buildChartSVG(allSlice) })
            }
          ),
          /* @__PURE__ */ u2("div", { class: "header-trigger", id: "all-time-trigger", children: "\u221E" })
        ] }),
        /* @__PURE__ */ u2("div", { class: "header-row header-row--year", children: [
          /* @__PURE__ */ u2(
            "div",
            {
              class: "stats-btn" + (activeL === String(y3) ? " active" : ""),
              id: "year-stats-btn",
              "data-tooltip-html": app.generateRichTooltip(yearSlice),
              onClick: (e3) => {
                e3.stopPropagation();
                app.calcPeriodStats("year");
              },
              children: /* @__PURE__ */ u2(Raw, { html: app.buildChartSVG(yearSlice) })
            }
          ),
          /* @__PURE__ */ u2(
            "div",
            {
              ref: yearTrig,
              class: "header-trigger",
              id: "year-trigger",
              onClick: (e3) => {
                e3.stopPropagation();
                setOpen(open === "year" ? null : "year");
              },
              children: y3
            }
          ),
          /* @__PURE__ */ u2("div", { ref: yearDrop, id: "bbgl-year-dropdown", class: "bbgl-dropdown-menu" + (open === "year" ? " show" : ""), children: years.map((yr) => /* @__PURE__ */ u2(
            "div",
            {
              class: "drop-item" + (yr === y3 ? " active" : ""),
              onClick: () => {
                calendarState.year = yr;
                setOpen(null);
                app.renderPanelContent();
              },
              children: yr
            },
            yr
          )) })
        ] }),
        /* @__PURE__ */ u2("div", { class: "header-row header-row--month", children: [
          /* @__PURE__ */ u2(
            "div",
            {
              class: "stats-btn" + (activeL === CONSTANTS.MONTHS[m3] ? " active" : ""),
              id: "month-stats-btn",
              "data-tooltip-html": app.generateRichTooltip(monthSlice),
              onClick: (e3) => {
                e3.stopPropagation();
                app.calcPeriodStats("month");
              },
              children: /* @__PURE__ */ u2(Raw, { html: app.buildChartSVG(monthSlice) })
            }
          ),
          /* @__PURE__ */ u2(
            "div",
            {
              ref: monthTrig,
              class: "header-trigger",
              id: "month-trigger",
              onClick: (e3) => {
                e3.stopPropagation();
                setOpen(open === "month" ? null : "month");
              },
              children: CONSTANTS.MONTHS[m3]
            }
          ),
          /* @__PURE__ */ u2("div", { ref: monthDrop, id: "bbgl-month-dropdown", class: "bbgl-dropdown-menu" + (open === "month" ? " show" : ""), children: CONSTANTS.MONTHS_SHORT.map((label, i3) => /* @__PURE__ */ u2(
            "div",
            {
              class: "drop-item" + (i3 === m3 ? " active" : ""),
              onClick: () => {
                calendarState.month = i3;
                setOpen(null);
                app.renderPanelContent();
              },
              children: label
            },
            label
          )) })
        ] })
      ] }) }),
      /* @__PURE__ */ u2("button", { type: "button", class: "arrow-btn", id: "prev-month-btn", onClick: () => app.changeMonth(-1), children: "\u276E" }),
      /* @__PURE__ */ u2("button", { type: "button", class: "arrow-btn", id: "next-month-btn", onClick: () => app.changeMonth(1), children: "\u276F" })
    ] }) });
  }
  function CalendarGrid() {
    useUiTick();
    const y3 = calendarState.year;
    const m3 = calendarState.month;
    const cells = buildCells(y3, m3);
    calendarState.visibleCells = cells.map((z3) => Formatter.dateISO(z3.y, z3.m, z3.d));
    const todayStr = Formatter.dateLogical();
    const rows = [];
    for (let i3 = 0; i3 < cells.length; i3 += 7) rows.push(cells.slice(i3, i3 + 7));
    h2(() => {
      const c3 = document.getElementById("bbgl-cal-container");
      if (!c3) return;
      c3.style.setProperty("--total-rows", "6");
      c3.style.setProperty("--bg-url", `url(${app.CAL_IMG_BASE}cal-grid-futr.jpg)`);
    }, [y3, m3]);
    return /* @__PURE__ */ u2(
      "div",
      {
        id: "bbgl-cal-container",
        class: "bbgl-cal-container",
        style: { ["--total-rows"]: 6, ["--bg-url"]: `url(${app.CAL_IMG_BASE}cal-grid-futr.jpg)` },
        children: rows.map((batch, ridx) => {
          const last = batch[6];
          const weekEndStr = Formatter.dateISO(last.y, last.m, last.d);
          const isArch = weekEndStr < todayStr;
          const wdb = batch.map((i3) => ({ date: Formatter.dateISO(i3.y, i3.m, i3.d), data: app.DataController.getDateMap()[Formatter.dateISO(i3.y, i3.m, i3.d)] || null }));
          return /* @__PURE__ */ u2("div", { children: [
            /* @__PURE__ */ u2(
              "div",
              {
                class: "bbgl-row-slice" + (isArch ? " bbgl-row-archived" : ""),
                style: {
                  ["--row-idx"]: ridx,
                  ...isArch ? { ["--bg-url"]: `url(${app.CAL_IMG_BASE}cal-grid-past.jpg)` } : {}
                },
                children: batch.map((z3, cIdx) => /* @__PURE__ */ u2(DayCell, { z: z3, rIdx: ridx, cIdx, archived: isArch }, Formatter.dateISO(z3.y, z3.m, z3.d)))
              }
            ),
            /* @__PURE__ */ u2(WeeklyBar, { batch: wdb })
          ] }, ridx);
        })
      }
    );
  }
  function WeekRow() {
    useUiTick();
    const weekDays = userConfig.weekStartMode === "mon" ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return /* @__PURE__ */ u2("div", { class: "bbgl-week-row", children: weekDays.map((d3) => /* @__PURE__ */ u2("span", { children: d3 }, d3)) });
  }
  function CalendarSwipe(props) {
    const start = A2({ x: 0, y: 0 });
    return /* @__PURE__ */ u2(
      "div",
      {
        class: "calendar-wrapper",
        id: "swipe-area",
        onTouchStart: (e3) => {
          start.current = { x: e3.touches[0].clientX, y: e3.touches[0].clientY };
        },
        onTouchEnd: (e3) => {
          if (window._bbglScrubbing) return;
          const dx = e3.changedTouches[0].clientX - start.current.x;
          const dy = e3.changedTouches[0].clientY - start.current.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) app.changeMonth(dx < 0 ? 1 : -1);
        },
        children: props.children
      }
    );
  }

  // node_modules/preact/compat/dist/compat.module.js
  function g3(n2, t3) {
    for (var e3 in t3) n2[e3] = t3[e3];
    return n2;
  }
  function E2(n2, t3) {
    for (var e3 in n2) if ("__source" !== e3 && !(e3 in t3)) return true;
    for (var r4 in t3) if ("__source" !== r4 && n2[r4] !== t3[r4]) return true;
    return false;
  }
  function M2(n2, t3) {
    this.props = n2, this.context = t3;
  }
  function N2(n2, e3) {
    function r4(n3) {
      var t3 = this.props.ref;
      return t3 != n3.ref && t3 && ("function" == typeof t3 ? t3(null) : t3.current = null), e3 ? !e3(this.props, n3) || t3 != n3.ref : E2(this.props, n3);
    }
    function u4(e4) {
      return this.shouldComponentUpdate = r4, k(n2, e4);
    }
    return u4.displayName = "Memo(" + (n2.displayName || n2.name) + ")", u4.__f = u4.prototype.isReactComponent = true, u4.type = n2, u4;
  }
  (M2.prototype = new C()).isPureReactComponent = true, M2.prototype.shouldComponentUpdate = function(n2, t3) {
    return E2(this.props, n2) || E2(this.state, t3);
  };
  var T3 = l.__b;
  l.__b = function(n2) {
    n2.type && n2.type.__f && n2.ref && (n2.props.ref = n2.ref, n2.ref = null), T3 && T3(n2);
  };
  var A3 = "undefined" != typeof Symbol && Symbol.for && /* @__PURE__ */ Symbol.for("react.forward_ref") || 3911;
  var O2 = l.__e;
  l.__e = function(n2, t3, e3, r4) {
    if (n2.then) {
      for (var u4, o3 = t3; o3 = o3.__; ) if ((u4 = o3.__c) && u4.__c) return null == t3.__e && (t3.__e = e3.__e, t3.__k = e3.__k || []), u4.__c(n2, t3);
    }
    O2(n2, t3, e3, r4);
  };
  var U2 = l.unmount;
  function V2(n2, t3, e3) {
    return n2 && (n2.__c && n2.__c.__H && (n2.__c.__H.__.forEach(function(n3) {
      "function" == typeof n3.__c && n3.__c();
    }), n2.__c.__H = null), null != (n2 = g3({}, n2)).__c && (n2.__c.__P === e3 && (n2.__c.__P = t3), n2.__c.__e = true, n2.__c = null), n2.__k = n2.__k && n2.__k.map(function(n3) {
      return V2(n3, t3, e3);
    })), n2;
  }
  function W2(n2, t3, e3) {
    return n2 && e3 && (n2.__v = null, n2.__k = n2.__k && n2.__k.map(function(n3) {
      return W2(n3, t3, e3);
    }), n2.__c && n2.__c.__P === t3 && (n2.__e && e3.appendChild(n2.__e), n2.__c.__e = true, n2.__c.__P = e3)), n2;
  }
  function P3() {
    this.__u = 0, this.o = null, this.__b = null;
  }
  function j3(n2) {
    var t3 = n2.__ && n2.__.__c;
    return t3 && t3.__a && t3.__a(n2);
  }
  function B3() {
    this.i = null, this.l = null;
  }
  l.unmount = function(n2) {
    var t3 = n2.__c;
    t3 && (t3.__z = true), t3 && t3.__R && t3.__R(), t3 && 32 & n2.__u && (n2.type = null), U2 && U2(n2);
  }, (P3.prototype = new C()).__c = function(n2, t3) {
    var e3 = t3.__c, r4 = this;
    null == r4.o && (r4.o = []), r4.o.push(e3);
    var u4 = j3(r4.__v), o3 = false, i3 = function() {
      o3 || r4.__z || (o3 = true, e3.__R = null, u4 ? u4(f4) : f4());
    };
    e3.__R = i3;
    var l3 = e3.__P;
    e3.__P = null;
    var f4 = function() {
      if (!--r4.__u) {
        if (r4.state.__a) {
          var n3 = r4.state.__a;
          r4.__v.__k[0] = W2(n3, n3.__c.__P, n3.__c.__O);
        }
        var t4;
        for (r4.setState({ __a: r4.__b = null }); t4 = r4.o.pop(); ) t4.__P = l3, t4.forceUpdate();
      }
    };
    r4.__u++ || 32 & t3.__u || r4.setState({ __a: r4.__b = r4.__v.__k[0] }), n2.then(i3, i3);
  }, P3.prototype.componentWillUnmount = function() {
    this.o = [];
  }, P3.prototype.render = function(n2, e3) {
    if (this.__b) {
      if (this.__v.__k) {
        var r4 = document.createElement("div"), o3 = this.__v.__k[0].__c;
        this.__v.__k[0] = V2(this.__b, r4, o3.__O = o3.__P);
      }
      this.__b = null;
    }
    var i3 = e3.__a && k(S, null, n2.fallback);
    return i3 && (i3.__u &= -33), [k(S, null, e3.__a ? null : n2.children), i3];
  };
  var H2 = function(n2, t3, e3) {
    if (++e3[1] === e3[0] && n2.l.delete(t3), n2.props.revealOrder && ("t" !== n2.props.revealOrder[0] || !n2.l.size)) for (e3 = n2.i; e3; ) {
      for (; e3.length > 3; ) e3.pop()();
      if (e3[1] < e3[0]) break;
      n2.i = e3 = e3[2];
    }
  };
  (B3.prototype = new C()).__a = function(n2) {
    var t3 = this, e3 = j3(t3.__v), r4 = t3.l.get(n2);
    return r4[0]++, function(u4) {
      var o3 = function() {
        t3.props.revealOrder ? (r4.push(u4), H2(t3, n2, r4)) : u4();
      };
      e3 ? e3(o3) : o3();
    };
  }, B3.prototype.render = function(n2) {
    this.i = null, this.l = /* @__PURE__ */ new Map();
    var t3 = F(n2.children);
    n2.revealOrder && "b" === n2.revealOrder[0] && t3.reverse();
    for (var e3 = t3.length; e3--; ) this.l.set(t3[e3], this.i = [1, 0, this.i]);
    return n2.children;
  }, B3.prototype.componentDidUpdate = B3.prototype.componentDidMount = function() {
    var n2 = this;
    this.l.forEach(function(t3, e3) {
      H2(n2, e3, t3);
    });
  };
  var q3 = "undefined" != typeof Symbol && Symbol.for && /* @__PURE__ */ Symbol.for("react.element") || 60103;
  var G2 = /^(?:accent|alignment|arabic|baseline|cap|clip(?!PathU)|color|dominant|fill|flood|font|glyph(?!R)|horiz|image(!S)|letter|lighting|marker(?!H|W|U)|overline|paint|pointer|shape|stop|strikethrough|stroke|text(?!L)|transform|underline|unicode|units|v|vector|vert|word|writing|x(?!C))[A-Z]/;
  var J2 = /^on(Ani|Tra|Tou|BeforeInp|Compo)/;
  var K2 = /[A-Z0-9]/g;
  var Q2 = "undefined" != typeof document;
  var X2 = function(n2) {
    return ("undefined" != typeof Symbol && "symbol" == typeof /* @__PURE__ */ Symbol() ? /fil|che|rad/ : /fil|che|ra/).test(n2);
  };
  C.prototype.isReactComponent = true, ["componentWillMount", "componentWillReceiveProps", "componentWillUpdate"].forEach(function(t3) {
    Object.defineProperty(C.prototype, t3, { configurable: true, get: function() {
      return this["UNSAFE_" + t3];
    }, set: function(n2) {
      Object.defineProperty(this, t3, { configurable: true, writable: true, value: n2 });
    } });
  });
  var en = l.event;
  l.event = function(n2) {
    return en && (n2 = en(n2)), n2.persist = function() {
    }, n2.isPropagationStopped = function() {
      return this.cancelBubble;
    }, n2.isDefaultPrevented = function() {
      return this.defaultPrevented;
    }, n2.nativeEvent = n2;
  };
  var rn;
  var un = { configurable: true, get: function() {
    return this.class;
  } };
  var on = l.vnode;
  l.vnode = function(n2) {
    "string" == typeof n2.type && (function(n3) {
      var t3 = n3.props, e3 = n3.type, u4 = {}, o3 = -1 == e3.indexOf("-");
      for (var i3 in t3) {
        var l3 = t3[i3];
        if (!("value" === i3 && "defaultValue" in t3 && null == l3 || Q2 && "children" === i3 && "noscript" === e3 || "class" === i3 || "className" === i3)) {
          var f4 = i3.toLowerCase();
          "defaultValue" === i3 && "value" in t3 && null == t3.value ? i3 = "value" : "download" === i3 && true === l3 ? l3 = "" : "translate" === f4 && "no" === l3 ? l3 = false : "o" === f4[0] && "n" === f4[1] ? "ondoubleclick" === f4 ? i3 = "ondblclick" : "onchange" !== f4 || "input" !== e3 && "textarea" !== e3 || X2(t3.type) ? "onfocus" === f4 ? i3 = "onfocusin" : "onblur" === f4 ? i3 = "onfocusout" : J2.test(i3) && (i3 = f4) : f4 = i3 = "oninput" : o3 && G2.test(i3) ? i3 = i3.replace(K2, "-$&").toLowerCase() : null === l3 && (l3 = void 0), "oninput" === f4 && u4[i3 = f4] && (i3 = "oninputCapture"), u4[i3] = l3;
        }
      }
      "select" == e3 && (u4.multiple && Array.isArray(u4.value) && (u4.value = F(t3.children).forEach(function(n4) {
        n4.props.selected = -1 != u4.value.indexOf(n4.props.value);
      })), null != u4.defaultValue && (u4.value = F(t3.children).forEach(function(n4) {
        n4.props.selected = u4.multiple ? -1 != u4.defaultValue.indexOf(n4.props.value) : u4.defaultValue == n4.props.value;
      }))), t3.class && !t3.className ? (u4.class = t3.class, Object.defineProperty(u4, "className", un)) : t3.className && (u4.class = u4.className = t3.className), n3.props = u4;
    })(n2), n2.$$typeof = q3, on && on(n2);
  };
  var ln = l.__r;
  l.__r = function(n2) {
    ln && ln(n2), rn = n2.__c;
  };
  var fn = l.diffed;
  l.diffed = function(n2) {
    fn && fn(n2);
    var t3 = n2.props, e3 = n2.__e;
    null != e3 && "textarea" === n2.type && "value" in t3 && t3.value !== e3.value && (e3.value = null == t3.value ? "" : t3.value), rn = null;
  };

  // src/ui/preact/Island.tsx
  function IslandInner(props) {
    const style = props.contents ? { display: "contents" } : void 0;
    if (props.html !== void 0) {
      return /* @__PURE__ */ u2("div", { id: props.id, class: props.class, style, dangerouslySetInnerHTML: { __html: props.html } });
    }
    return /* @__PURE__ */ u2("div", { id: props.id, class: props.class, style, children: props.children });
  }
  var Island = N2(IslandInner, () => true);

  // src/ui/preact/views/Graph.tsx
  function onMode(v3) {
    graphState.mode = v3;
    viewState.graphMode = v3;
    saveViewState();
    app.GraphController.draw();
  }
  function onStat(v3) {
    if (graphState.activeStats.includes(v3)) {
      graphState.activeStats = graphState.activeStats.filter((s3) => s3 !== v3);
    } else {
      graphState.activeStats.push(v3);
    }
    viewState.graphStats = graphState.activeStats;
    saveViewState();
    app.GraphController.draw();
  }
  function GraphHud() {
    useUiTick();
    const mode = graphState.mode;
    const stats = graphState.activeStats || [];
    return /* @__PURE__ */ u2("div", { class: "g-hud", children: [
      /* @__PURE__ */ u2("div", { class: "g-toggles", children: [
        /* @__PURE__ */ u2("div", { class: "g-pill" + (mode === "values" ? " active" : ""), "data-type": "mode", "data-val": "values", onClick: (e3) => {
          e3.stopPropagation();
          onMode("values");
        }, children: "Gains" }),
        /* @__PURE__ */ u2("div", { class: "g-pill" + (mode === "rates" ? " active" : ""), "data-type": "mode", "data-val": "rates", onClick: (e3) => {
          e3.stopPropagation();
          onMode("rates");
        }, children: "Rates" })
      ] }),
      /* @__PURE__ */ u2("div", { class: "g-toggles", children: [
        /* @__PURE__ */ u2("div", { class: "g-pill p-str" + (stats.includes("str") ? " active" : ""), "data-type": "stat", "data-val": "str", onClick: (e3) => {
          e3.stopPropagation();
          onStat("str");
        }, children: "STR" }),
        /* @__PURE__ */ u2("div", { class: "g-pill p-def" + (stats.includes("def") ? " active" : ""), "data-type": "stat", "data-val": "def", onClick: (e3) => {
          e3.stopPropagation();
          onStat("def");
        }, children: "DEF" }),
        /* @__PURE__ */ u2("div", { class: "g-pill p-spd" + (stats.includes("spd") ? " active" : ""), "data-type": "stat", "data-val": "spd", onClick: (e3) => {
          e3.stopPropagation();
          onStat("spd");
        }, children: "SPD" }),
        /* @__PURE__ */ u2("div", { class: "g-pill p-dex" + (stats.includes("dex") ? " active" : ""), "data-type": "stat", "data-val": "dex", onClick: (e3) => {
          e3.stopPropagation();
          onStat("dex");
        }, children: "DEX" }),
        /* @__PURE__ */ u2("div", { class: "g-pill p-tot" + (stats.includes("total") ? " active" : ""), "data-type": "stat", "data-val": "total", onClick: (e3) => {
          e3.stopPropagation();
          onStat("total");
        }, children: "TOT" })
      ] })
    ] });
  }
  function GraphView() {
    useUiTick();
    h2(() => {
      dom.graphContainer = document.getElementById("bbgl-graph-container");
      if (app.GraphController && typeof app.GraphController.setupControls === "function") {
        app.GraphController.setupControls();
      }
    }, []);
    h2(() => {
      dom.graphContainer = document.getElementById("bbgl-graph-container");
      dom.graphSvg = document.getElementById("bbgl-graph-svg");
      if (viewState.subView === "graph" && app.GraphController) {
        app.GraphController.draw();
      }
    });
    return /* @__PURE__ */ u2("div", { id: "bbgl-graph-container", children: [
      /* @__PURE__ */ u2(GraphHud, {}),
      /* @__PURE__ */ u2(Island, { children: /* @__PURE__ */ u2("svg", { id: "bbgl-graph-svg" }) })
    ] });
  }

  // src/ui/preact/views/Ledger.tsx
  var LABELS = {
    STR: "Strength",
    DEF: "Defense",
    SPD: "Speed",
    DEX: "Dexterity",
    TOT: "Total"
  };
  function fmtR(n2) {
    if (!n2 && n2 !== 0) return "0";
    const a3 = Math.abs(n2);
    if (a3 >= 1e15) return (n2 / 1e15).toFixed(4) + "q";
    if (a3 >= 1e12) return (n2 / 1e12).toFixed(4) + "t";
    if (a3 >= 1e9) return (n2 / 1e9).toFixed(4) + "b";
    if (a3 >= 100) return Math.round(n2).toLocaleString("en-US");
    return n2.toFixed(1);
  }
  function mkTip(r1, r22, pct, sg) {
    return `<div style='text-align:center;line-height:1.6'><div style='margin-bottom:0px'>Growth Rate</div><div style='font-size:0.85em;opacity:0.35;margin-bottom:3px'>(Gains/150E)</div><div>${fmtR(r1)} \u2192 ${fmtR(r22)}</div><div style='font-size:0.85em;color:#aaa'>${sg}${Math.round(pct)}%</div></div>`;
  }
  function nameOf(c3) {
    if (c3 === 2290) return "Xanax";
    if (c3 === 2230) return "LSD";
    if (c3 === 2040) return "Cans";
    if (c3 === 2190) return "FHC";
    if (c3 === 8981) return "Eggs";
    return ITEM_LOG_META[c3] && ITEM_LOG_META[c3].short || `#${c3}`;
  }
  function shortOf(code) {
    return ITEM_LOG_META[code] && ITEM_LOG_META[code].short || `#${code}`;
  }
  function ItemCounters(props) {
    const sl = props.sl;
    const items = sl.items || {};
    const isDay = sl.resolution === "DAY";
    const isAll = sl.resolution === "ALL";
    const cnt = (code) => items[code] || 0;
    const drugCode = userConfig.drugTracker === "lsd" ? 2230 : XANAX_LOG;
    const secondaryCode = userConfig.drugTracker === "lsd" ? XANAX_LOG : 2230;
    let drugSub = "";
    if (!isDay) {
      const days = app.DataController.periodCalendarDays(sl);
      const drugAvg = days > 0 ? cnt(drugCode) / days : 0;
      drugSub = sl.resolution === "ALL" ? "" : `<span class="bbgl-ic-sub">(${drugAvg.toFixed(2)})</span>`;
    }
    const drugTip = `<div style="text-align:center">${nameOf(drugCode)} Taken` + (!isDay && !isAll ? `<br><span class="tt-sub">(Avg/Day)</span>` : ``) + `</div>`;
    const parts = [];
    parts.push(`<span class="bbgl-ic" data-tooltip-html='${drugTip}'>${shortOf(drugCode)}: ${cnt(drugCode)}${drugSub}</span>`);
    [ECAN_LOG, 2190, secondaryCode, 8981].forEach((code) => {
      const c3 = cnt(code);
      if (c3 <= 0) return;
      const sub = code === ECAN_LOG && sl.resolution !== "ALL" ? `<span class="bbgl-ic-sub">(+${Math.round(sl.ecanEnergy || 0)})</span>` : "";
      const dynTip = code === ECAN_LOG ? `<div style="text-align:center">Cans Used` + (!isAll ? `<br><span class="tt-sub">(Energy Gained)</span>` : ``) + `</div>` : `<div style="text-align:center">${nameOf(code)} Used</div>`;
      parts.push(`<span class="bbgl-ic bbgl-ic-dyn" data-tooltip-html='${dynTip}'>${shortOf(code)}: ${c3}${sub}</span>`);
    });
    const refills = cnt(4900);
    const refillVal = isDay ? refills > 0 ? `<span class="bbgl-ic-yes">\u2713</span>` : `<span class="bbgl-ic-no">\u2717</span>` : `${refills}`;
    parts.push(`<span class="bbgl-ic" data-tooltip-html='<div style="text-align:center">Refills Used</div>'>Refill: ${refillVal}</span>`);
    return /* @__PURE__ */ u2("div", { id: "bbgl-item-counters", dangerouslySetInnerHTML: { __html: parts.join("") } });
  }
  function DateLabel(props) {
    const sl = props.sl;
    const isExp = !!(dom.panel && (dom.panel.classList.contains("bbgl-expanded") || dom.panel.classList.contains("bbgl-mode-page")));
    let l3 = "";
    if (sl.resolution === "WEEK") {
      const start = sl._weekStart || (sl._dailyList && sl._dailyList.length > 0 ? sl._dailyList[0].date : null) || sl.date;
      const end = sl._weekEnd || (sl._dailyList && sl._dailyList.length > 0 ? sl._dailyList[sl._dailyList.length - 1].date : null) || sl.date;
      l3 = `Week of ${Formatter.dateMonthDay(start)}<span class="view-exp"> - ${Formatter.dateMonthDay(end)}</span>`;
    } else {
      l3 = isExp ? Formatter.dateFull(sl.label) : Formatter.datePretty(sl.label);
      if (!l3) l3 = sl.label;
      if (sl.resolution === "MONTH") {
        l3 = sl.label + " " + calendarState.year;
      } else if (sl.resolution !== "DAY" && sl._dailyList && sl._dailyList.length > 0 && sl.resolution !== "ALL") {
        const endLabel = Formatter.dateMonthDay(sl._dailyList[sl._dailyList.length - 1].date);
        l3 += `<span class="view-exp"> (${Formatter.dateMonthDay(sl._dailyList[0].date)} - ${endLabel})</span>`;
      }
    }
    return /* @__PURE__ */ u2("div", { class: "ui-floating-label", id: "bbgl-date-label", dangerouslySetInnerHTML: { __html: l3 } });
  }
  function StatColumn(props) {
    const { lc, k: k3, cl, sl, s: s3, isP, isCurrentPeriod } = props;
    const d3 = s3[k3];
    const ft = LABELS[lc] || lc;
    let rh = "";
    let rt = "";
    if (isP && k3 !== "total") {
      let th = `<span style="opacity:0.3">--</span>`;
      if (userConfig.ratesEnabled && sl._dailyList && sl._dailyList.length > 0) {
        const _fpd = /* @__PURE__ */ new Date(sl._dailyList[0].date + "T00:00:00Z");
        _fpd.setUTCDate(_fpd.getUTCDate() - 1);
        const r1 = app.DataController.getHistoricalRate(_fpd.toISOString().slice(0, 10), k3);
        const r22 = app.DataController._hydrate(sl._dailyList[sl._dailyList.length - 1], [], "", "DAY").stats[k3].rate;
        const del = r22 - r1;
        const sg = del >= 0 ? "+" : "";
        const pct = r1 > 0 ? (r22 - r1) / r1 * 100 : 0;
        th = `<div class="rates-group" style="display:flex;flex-direction:column;align-items:center;line-height:1.1"><span>${sg}${Formatter.achAbbr(del, ACH_FMT.compact)}</span><span class="view-exp rate-pct" style="font-size:0.8em;opacity:0.7;margin-top:2px;margin-bottom:-2px;">(${sg}${Formatter.ratePct(pct)}%)</span></div>`;
        rt = mkTip(r1, r22, pct, sg);
      }
      rh = userConfig.ratesEnabled ? th : "";
    } else if (userConfig.ratesEnabled && k3 !== "total") {
      const _pd = /* @__PURE__ */ new Date(sl.date + "T00:00:00Z");
      _pd.setUTCDate(_pd.getUTCDate() - 1);
      const r1 = app.DataController.getHistoricalRate(_pd.toISOString().slice(0, 10), k3);
      const r22 = d3.rate;
      const del = r22 - r1;
      const sg = del >= 0 ? "+" : "";
      const pct = r1 > 0 ? del / r1 * 100 : 0;
      rh = Formatter.dual(d3.rate, true);
      rt = mkTip(r1, r22, pct, sg);
    } else {
      rh = userConfig.ratesEnabled ? Formatter.dual(d3.rate, true) : "";
      rt = "Growth Rate (Gains / 150E)";
    }
    function onCopy(e3) {
      const col = e3.currentTarget.closest(".stat-column");
      if (!col || !s3[k3]) return;
      const txt = app.buildSessionText(sl, s3, [k3]);
      navigator.clipboard.writeText(txt).then(() => app.flashCopied(col));
    }
    return /* @__PURE__ */ u2("div", { class: "stat-column", "data-copy-stat": k3, children: [
      /* @__PURE__ */ u2("div", { class: "col-header cell-stack", children: [
        /* @__PURE__ */ u2("div", { class: `l-top c-label ${cl} bbgl-copy-label`, "data-tooltip": `Click to copy ${ft} data`, style: { cursor: "pointer" }, onClick: onCopy, children: [
          /* @__PURE__ */ u2("span", { class: "view-std", children: lc }),
          /* @__PURE__ */ u2("span", { class: "view-exp", children: ft })
        ] }),
        /* @__PURE__ */ u2("div", { class: "l-bot", "data-tooltip": isP ? `Energy Used on ${ft}` : "Energy Used", children: [
          Formatter.dual(d3.cost),
          " E"
        ] })
      ] }),
      /* @__PURE__ */ u2("div", { class: "bbgl-spacer" }),
      /* @__PURE__ */ u2("div", { class: "col-data-block cell-stack c-gain", children: [
        /* @__PURE__ */ u2("div", { class: "l-top", "data-tooltip": `${ft} Gained`, children: [
          "+",
          Formatter.dual(d3.gain)
        ] }),
        /* @__PURE__ */ u2("div", { class: "l-bot", "data-tooltip": rt, children: typeof rh === "string" && rh.includes("<") ? /* @__PURE__ */ u2(Raw, { html: rh }) : rh })
      ] }),
      /* @__PURE__ */ u2("div", { class: "bbgl-spacer" }),
      /* @__PURE__ */ u2("div", { class: "col-data-block cell-stack c-total", children: [
        /* @__PURE__ */ u2("div", { class: "l-top", "data-tooltip": `${isCurrentPeriod ? "Current" : "Ending"} ${ft}`, children: Formatter.dual(d3.end) }),
        /* @__PURE__ */ u2("div", { class: "l-bot", "data-tooltip": `Starting ${ft}`, children: Formatter.dual(d3.start) })
      ] })
    ] });
  }
  function LedgerChrome() {
    useUiTick();
    const current = runtime.currentStats;
    let sl = current && current.sl;
    if (!sl) {
      sl = calendarState.selectedData || (typeof app.getActiveHistory === "function" ? app.getActiveHistory().today : null);
    }
    if (sl && !sl.stats && typeof app.DataController?._hydrate === "function") {
      sl = app.DataController._hydrate(sl, [], sl.label || calendarState.selectedLabel, "DAY");
    }
    if (!sl || !sl.stats) {
      return /* @__PURE__ */ u2(S, { children: [
        /* @__PURE__ */ u2("div", { id: "bbgl-item-counters" }),
        /* @__PURE__ */ u2("div", { class: "ui-floating-label", id: "bbgl-date-label", children: "LOADING..." }),
        /* @__PURE__ */ u2("div", { class: "ui-floating-summary", id: "bbgl-summary-label" }),
        /* @__PURE__ */ u2("div", { id: "bbgl-ledger-view", class: "ledger-content" })
      ] });
    }
    const s3 = sl.stats;
    runtime.currentStats = { sl, s: s3 };
    const isP = sl.resolution !== "DAY";
    const todayStr = Formatter.dateLogical();
    const slLastDate = sl._dailyList && sl._dailyList.length > 0 ? sl._dailyList[sl._dailyList.length - 1].date : sl.date;
    const isCurrentPeriod = sl.resolution === "ALL" || slLastDate >= todayStr;
    return /* @__PURE__ */ u2(S, { children: [
      /* @__PURE__ */ u2(ItemCounters, { sl }),
      /* @__PURE__ */ u2(DateLabel, { sl }),
      /* @__PURE__ */ u2("div", { class: "ui-floating-summary", id: "bbgl-summary-label", children: [
        "Total E: ",
        Formatter.dual(s3.total.cost),
        " ",
        /* @__PURE__ */ u2("span", { style: { opacity: 0.3, margin: "0 6px" }, children: "|" }),
        " Total Gains: ",
        Formatter.dual(s3.total.gain)
      ] }),
      /* @__PURE__ */ u2("div", { id: "bbgl-ledger-view", class: "ledger-content", children: [
        /* @__PURE__ */ u2(StatColumn, { lc: "STR", k: "str", cl: "t-str", sl, s: s3, isP, isCurrentPeriod }),
        /* @__PURE__ */ u2(StatColumn, { lc: "DEF", k: "def", cl: "t-def", sl, s: s3, isP, isCurrentPeriod }),
        /* @__PURE__ */ u2(StatColumn, { lc: "SPD", k: "spd", cl: "t-spd", sl, s: s3, isP, isCurrentPeriod }),
        /* @__PURE__ */ u2(StatColumn, { lc: "DEX", k: "dex", cl: "t-dex", sl, s: s3, isP, isCurrentPeriod })
      ] })
    ] });
  }

  // src/ui/preact/views/Achievements.tsx
  var STATS = ["str", "def", "spd", "dex"];
  var STAT_LABEL = { str: "Strength", def: "Defense", spd: "Speed", dex: "Dexterity" };
  var COPY_TIP = "Click any stat or row to copy its data, or click this title to copy the entire section to your clipboard.";
  function ensureAchievements() {
    if (!runtime._achCache && typeof app.computeAchievements === "function") {
      runtime._achCache = app.computeAchievements(app.getActiveHistory());
      runtime._achPage = viewState.achPage || 0;
    }
    return runtime._achCache;
  }
  function NullVal() {
    return /* @__PURE__ */ u2("span", { class: "ach-null", children: "\u2014" });
  }
  function AchRow(r4) {
    const isFx = !!(r4.statClass && r4.statClass.startsWith("ach-fx-"));
    const valCls = isFx && r4.statClass ? " " + r4.statClass : "";
    const subCls = !isFx && r4.statClass ? " " + r4.statClass : "";
    const val = r4.dualHtml ? /* @__PURE__ */ u2(Raw, { html: r4.dualHtml }) : r4.display === "\u2014" || r4.display === "\u2014" ? /* @__PURE__ */ u2(NullVal, {}) : r4.display;
    return /* @__PURE__ */ u2(
      "div",
      {
        class: "bbgl-ach-row",
        "data-tooltip": r4.tip || void 0,
        "data-ach-key": r4.key || "",
        "data-clip": `${r4.label}: ${r4.rawVal}`,
        "data-clip-date": r4.clipDate || "",
        children: /* @__PURE__ */ u2("div", { class: "ach-row-main", children: [
          /* @__PURE__ */ u2("div", { class: "ach-k-stack", children: [
            /* @__PURE__ */ u2("span", { class: "ach-k", children: [
              r4.label,
              ":"
            ] }),
            r4.clipDate ? /* @__PURE__ */ u2("div", { class: "ach-date", children: r4.clipDate }) : null
          ] }),
          /* @__PURE__ */ u2("div", { class: "ach-v-wrap", children: [
            r4.sub ? /* @__PURE__ */ u2("span", { class: "ach-sub" + subCls, children: r4.sub }) : null,
            /* @__PURE__ */ u2("span", { class: "ach-value" + valCls, children: val })
          ] })
        ] })
      }
    );
  }
  function splitCols(rows, colCount) {
    const rpc = rows.length ? Math.ceil(rows.length / colCount) : 0;
    return Array.from({ length: colCount }, (_3, ci) => {
      const chunk = [];
      for (let r4 = 0; r4 < rpc; r4++) {
        const i3 = ci * rpc + r4;
        if (i3 < rows.length) chunk.push(rows[i3]);
      }
      return chunk;
    });
  }
  function AchSection(props) {
    const cols = splitCols(props.rows, props.colCount || 4);
    const clipAll = props.clipAll || props.rows.map((r4) => r4.clipDate ? `${r4.label}: ${r4.rawVal} (${r4.clipDate})` : `${r4.label}: ${r4.rawVal}`).join("\n");
    const colCount = props.colCount || 4;
    return /* @__PURE__ */ u2("div", { class: "bbgl-ach-section", children: [
      /* @__PURE__ */ u2("div", { class: "bbgl-ach-title-row", children: /* @__PURE__ */ u2(
        "span",
        {
          class: "bbgl-ach-section-title",
          "data-ach-section": props.sectionKey,
          "data-clip-section": clipAll,
          "data-clip-title": props.title,
          "data-tooltip": COPY_TIP,
          children: props.title
        }
      ) }),
      /* @__PURE__ */ u2("div", { class: "bbgl-ach-cols", style: colCount !== 4 ? { gridTemplateColumns: `repeat(${colCount},minmax(0,1fr))` } : void 0, children: cols.map((chunk, i3) => /* @__PURE__ */ u2("div", { class: "bbgl-ach-col", children: chunk.map((r4) => /* @__PURE__ */ u2(AchRow, { ...r4 }, r4.key || r4.label)) }, i3)) })
    ] });
  }
  function Page0(d3) {
    const ps = d3.perStatBest || { bestTrain: {}, bestDay: {}, bestWeek: {}, bestMonth: {} };
    const rows = [
      { key: "best-train", short: "Single Train", long: "Highest Single Train", tip: "Highest gains achieved from a single click, per individual stat.", recs: ps.bestTrain, getDate: (r4) => app.achFmtDate(r4.date), getTime: (r4) => r4.ts ? app.achFmtTimeHMS(r4.ts) : "" },
      { key: "best-day", short: "Best Day", long: "Best Training Day", tip: "Highest gains achieved in a single calendar day, per individual stat.", recs: ps.bestDay, getDate: (r4) => app.achFmtDate(r4.date) },
      { key: "best-week", short: "Best Week", long: "Best Training Week", tip: "Highest gains achieved in a single calendar week, per individual stat.", recs: ps.bestWeek, getDate: (r4) => app.achFmtWeekShort(r4.weekOf) },
      { key: "best-month", short: "Best Month", long: "Best Month", tip: "Highest gains achieved in a single calendar month, per individual stat.", recs: ps.bestMonth, getDate: (r4) => app.achFmtMonthLong(r4.rawMonth) }
    ];
    return /* @__PURE__ */ u2("div", { class: "bbgl-ach-section bbgl-ach-section-page0", children: [
      /* @__PURE__ */ u2("div", { class: "bbgl-ach-grid-header", children: [
        /* @__PURE__ */ u2("div", { class: "ach-grid-label-area", children: /* @__PURE__ */ u2("span", { class: "bbgl-ach-section-title", "data-ach-section": "greatest-gains", "data-clip-title": "Greatest Gains", "data-tooltip": COPY_TIP, children: "Greatest Gains" }) }),
        STATS.map((sk) => /* @__PURE__ */ u2("div", { class: `ach-stat-header ach-stat-${sk} bbgl-ach-col-copy`, "data-stat": sk, "data-tooltip": `Click to copy ${STAT_LABEL[sk]} column`, style: { cursor: "pointer" }, children: STAT_LABEL[sk] }, sk))
      ] }),
      rows.map((r4) => /* @__PURE__ */ u2("div", { class: "bbgl-ach-row bbgl-ach-row-multi", "data-ach-key": r4.key, "data-tooltip": r4.tip, children: [
        /* @__PURE__ */ u2("div", { class: "ach-grid-label-area", children: /* @__PURE__ */ u2("div", { class: "ach-k", children: [
          /* @__PURE__ */ u2("span", { class: "ach-title-short", children: r4.short }),
          /* @__PURE__ */ u2("span", { class: "ach-title-long", children: r4.long })
        ] }) }),
        STATS.map((sk) => {
          const rec = r4.recs ? r4.recs[sk] : null;
          return /* @__PURE__ */ u2("div", { class: "bbgl-ach-stat-cell", "data-ach-key": r4.key, "data-stat": sk, children: [
            /* @__PURE__ */ u2("span", { class: "ach-value", children: rec ? /* @__PURE__ */ u2(Raw, { html: "+" + Formatter.dual(rec.value) }) : /* @__PURE__ */ u2(NullVal, {}) }),
            rec ? /* @__PURE__ */ u2("div", { class: "ach-date", children: r4.getDate(rec) }) : null,
            rec && r4.getTime ? /* @__PURE__ */ u2("div", { class: "ach-time", children: r4.getTime(rec) }) : null
          ] }, sk);
        })
      ] }, r4.key))
    ] });
  }
  function Page1(d3) {
    const rows = [
      { key: "training-streak", short: "Best Streak", long: "Best Training Streak", tip: "Total stats gained during your longest consecutive training streak.", len: d3.longestStreak, start: d3.longestStreakStart, end: d3.longestStreakEnd, gains: d3.longestStreakGains },
      { key: "green-streak", short: "Best Green", long: "Best Green Streak", tip: "Total stats gained during your longest streak of achieving at least Green (1,000E+).", len: d3.longestGoalStreak, start: d3.longestGoalStreakStart, end: d3.longestGoalStreakEnd, gains: d3.longestGoalStreakGains },
      { key: "gold-streak", short: "Best Gold", long: "Best Gold Streak", tip: "Total stats gained during your longest streak of achieving at least Gold (1,500E+).", len: d3.longestGoldStreak, start: d3.longestGoldStreakStart, end: d3.longestGoldStreakEnd, gains: d3.longestGoldStreakGains },
      { key: "diamond-streak", short: "Best Diamond", long: "Best Diamond Streak", tip: "Total stats gained during your longest streak of achieving Diamond (2,000E+).", len: d3.longestDiamondStreak, start: d3.longestDiamondStreakStart, end: d3.longestDiamondStreakEnd, gains: d3.longestDiamondStreakGains }
    ];
    const consVal = d3.trainingRestRatio || "\u2014";
    const consDaysLong = "(" + (d3.trainingDays || 0) + "/" + (d3.calDays || 0) + " Days)";
    return /* @__PURE__ */ u2("div", { class: "bbgl-ach-section bbgl-ach-section-page0 bbgl-ach-section-page1", children: [
      /* @__PURE__ */ u2("div", { class: "bbgl-ach-grid-header", children: [
        /* @__PURE__ */ u2("div", { class: "ach-grid-label-area", children: /* @__PURE__ */ u2("span", { class: "bbgl-ach-section-title", "data-ach-section": "sexiest-streaks", "data-clip-title": "Sexiest Streaks", "data-tooltip": COPY_TIP, children: "SEXIEST STREAKS" }) }),
        STATS.map((sk) => /* @__PURE__ */ u2("div", { class: `ach-stat-header ach-stat-${sk}`, children: STAT_LABEL[sk] }, sk)),
        /* @__PURE__ */ u2("div", { class: "ach-stat-header ach-stat-tot", children: "Total" })
      ] }),
      rows.map((r4) => {
        const present = r4.gains ? STATS.filter((sk) => (r4.gains[sk] || 0) > 0) : [];
        const total = present.reduce((a3, sk) => a3 + (r4.gains[sk] || 0), 0);
        const dateText = r4.start && r4.end ? app.achFmtStreakRange(r4.start, r4.end) : "\u2014";
        return /* @__PURE__ */ u2("div", { class: "bbgl-ach-row bbgl-ach-row-multi", "data-ach-key": r4.key, "data-tooltip": r4.tip, children: [
          /* @__PURE__ */ u2("div", { class: "ach-grid-label-area", children: /* @__PURE__ */ u2("div", { class: "ach-k", children: [
            /* @__PURE__ */ u2("span", { class: "ach-title-short", children: r4.short }),
            /* @__PURE__ */ u2("span", { class: "ach-title-long", children: r4.long }),
            r4.len ? /* @__PURE__ */ u2("span", { class: "ach-streak-days ach-streak-days-inline", children: [
              " \xB7 ",
              r4.len,
              "d"
            ] }) : null,
            r4.start && r4.end ? /* @__PURE__ */ u2("span", { class: "bbgl-ach-streak-date-inline", children: [
              "\xA0\xA0",
              dateText
            ] }) : null
          ] }) }),
          STATS.map((sk) => {
            const v3 = r4.gains && r4.gains[sk] || 0;
            return /* @__PURE__ */ u2("div", { class: "bbgl-ach-stat-cell", "data-ach-key": r4.key, "data-stat": sk, children: /* @__PURE__ */ u2("span", { class: "ach-value", children: v3 > 0 ? "+" + app.achFmtGain(v3) : /* @__PURE__ */ u2(NullVal, {}) }) }, sk);
          }),
          /* @__PURE__ */ u2("div", { class: "bbgl-ach-stat-cell bbgl-ach-stat-cell-total", "data-ach-key": r4.key, "data-stat": "total", children: /* @__PURE__ */ u2("span", { class: "ach-value ach-stat-tot", children: total > 0 ? "+" + app.achFmtGain(total) : /* @__PURE__ */ u2(NullVal, {}) }) }),
          /* @__PURE__ */ u2("div", { class: "ach-date ach-streak-date", children: [
            /* @__PURE__ */ u2("span", { class: "ach-streak-days", children: r4.len ? r4.len + "d" : "\u2014" }),
            /* @__PURE__ */ u2("span", { class: "ach-streak-sep", children: "\u2022" }),
            /* @__PURE__ */ u2("span", { class: "ach-streak-daterange", children: dateText })
          ] })
        ] }, r4.key);
      }),
      /* @__PURE__ */ u2("div", { class: "bbgl-ach-row bbgl-ach-row-multi bbgl-ach-consistency-row", "data-ach-key": "consistency", "data-tooltip": "Your lifetime ratio of active training days versus total calendar days.", children: /* @__PURE__ */ u2("div", { class: "bbgl-ach-consistency-text", children: [
        "Training Consistency: ",
        /* @__PURE__ */ u2("span", { class: "ach-cons-val", children: consVal }),
        " ",
        /* @__PURE__ */ u2("span", { class: "ach-cons-days", children: consDaysLong })
      ] }) })
    ] });
  }
  function PageOverview(d3) {
    const enh = d3.statEnhByStat || {};
    const enrg = d3.energyItemTotals || {};
    const od = d3.odItemTotals || {};
    const STAT_ABBR = { str: "Str", def: "Def", spd: "Spd", dex: "Dex" };
    const isExpanded = typeof app.achIsExpandedMode === "function" ? app.achIsExpandedMode() : false;
    const STAT_ENH_MAP = { 2150: "str", 2130: "spd", 2140: "def", 2120: "dex" };
    const LEFT_COL = [2150, 2130, 2290, 2040, 4900];
    const RIGHT_COL = [2140, 2120, 2230, 2190, 8981];
    const OD_AFTER = { 2290: XANAX_OD_LOG, 2230: LSD_OD_LOG };
    const isPeriod = !!viewState.achEnhPeriodMode;
    function EnhRow({ id }) {
      const meta = ITEM_LOG_META[id];
      const label = meta.achLabel || meta.label;
      const tipLabel = meta.achTipLabel || label;
      const sk = STAT_ENH_MAP[id];
      let countNode, gainedNode, clipVal, tip;
      if (sk) {
        const rec = enh[sk] || { count: 0, gain: 0 };
        countNode = rec.count > 0 ? Formatter.number(rec.count) : /* @__PURE__ */ u2(NullVal, {});
        const gainNum = rec.gain > 0 ? "+" + Formatter.achAbbr(rec.gain, ACH_FMT.enhancers) : null;
        gainedNode = /* @__PURE__ */ u2(S, { children: [
          gainNum || /* @__PURE__ */ u2(NullVal, {}),
          " ",
          /* @__PURE__ */ u2("span", { class: `ach-stat-${sk}`, children: STAT_ABBR[sk] })
        ] });
        clipVal = `${label}: ${rec.count} (+${Formatter.achAbbr(rec.gain, ACH_FMT.enhancers)} ${STAT_ABBR[sk]})`;
        tip = isExpanded ? `Amount of ${tipLabel} \xB7 ${app.achStatFull(sk)} Gained` : `Amount of ${tipLabel}`;
      } else {
        const rec = enrg[id] || { count: 0, energy: 0 };
        countNode = rec.count > 0 ? Formatter.number(rec.count) : /* @__PURE__ */ u2(NullVal, {});
        const gainNum = rec.energy > 0 ? "+" + Formatter.achAbbr(rec.energy, ACH_FMT.enhancers) : null;
        gainedNode = /* @__PURE__ */ u2(S, { children: [
          gainNum || /* @__PURE__ */ u2(NullVal, {}),
          " ",
          /* @__PURE__ */ u2("span", { class: "ach-enh-e-label", children: "E" })
        ] });
        clipVal = `${label}: ${rec.count} (+${Formatter.achAbbr(rec.energy, ACH_FMT.enhancers)} Energy)`;
        tip = isExpanded ? `Amount of ${tipLabel} \xB7 Energy Gained` : `Amount of ${tipLabel}`;
      }
      const odId = OD_AFTER[id];
      const odRec = odId ? od[odId] : null;
      return /* @__PURE__ */ u2(S, { children: [
        /* @__PURE__ */ u2("div", { class: "bbgl-ach-row bbgl-ach-enh-row", "data-tooltip": tip, "data-ach-key": `enh-${id}`, "data-clip": clipVal, children: /* @__PURE__ */ u2("div", { class: "ach-row-main", children: [
          /* @__PURE__ */ u2("div", { class: "ach-k-stack", children: /* @__PURE__ */ u2("span", { class: "ach-k", children: [
            /* @__PURE__ */ u2("span", { class: "ach-title-long", children: [
              label,
              ":"
            ] }),
            /* @__PURE__ */ u2("span", { class: "ach-title-short", children: [
              label,
              ":"
            ] })
          ] }) }),
          /* @__PURE__ */ u2("div", { class: "ach-v-wrap", children: [
            /* @__PURE__ */ u2("span", { class: "ach-value", children: countNode }),
            /* @__PURE__ */ u2("span", { class: "ach-value ach-enh-gained", children: gainedNode })
          ] })
        ] }) }),
        odId && odRec && odRec.count > 0 ? /* @__PURE__ */ u2(OdSubRow, { odId, rec: odRec, isExpanded }) : null
      ] });
    }
    const clipAll = [...LEFT_COL, ...RIGHT_COL].map((id) => {
      const meta = ITEM_LOG_META[id];
      const label = meta.achLabel || meta.label;
      const sk = STAT_ENH_MAP[id];
      if (sk) {
        const rec2 = enh[sk] || { count: 0, gain: 0 };
        return `${label}: ${rec2.count} (+${Formatter.achAbbr(rec2.gain, ACH_FMT.enhancers)} ${STAT_ABBR[sk]})`;
      }
      const rec = enrg[id] || { count: 0, energy: 0 };
      return `${label}: ${rec.count} (+${Formatter.achAbbr(rec.energy, ACH_FMT.enhancers)} Energy)`;
    }).join("\n");
    return /* @__PURE__ */ u2("div", { class: "bbgl-ach-section bbgl-ach-section-energy", children: [
      /* @__PURE__ */ u2("div", { class: "bbgl-ach-title-row", children: [
        /* @__PURE__ */ u2("span", { class: "bbgl-ach-section-title", "data-ach-section": "endocrine-enhancers", "data-clip-section": clipAll, "data-clip-title": "Endocrine Enhancers", "data-tooltip": "Click any row to copy its data, or click this title to copy the entire section to your clipboard.", children: "ENDOCRINE ENHANCERS" }),
        /* @__PURE__ */ u2(
          "div",
          {
            class: "bbgl-enh-mode-switch",
            "data-tooltip-html": "<b>Changes the data scope displayed on this page.</b><br><i><b>All-Time</b> shows totals across your entire log history. <b>Selected</b> shows data for the selected period on the calendar.</i>",
            "data-tooltip-side": "left",
            children: [
              /* @__PURE__ */ u2("span", { class: "bbgl-enh-sw-opt" + (isPeriod ? "" : " active"), "data-mode": "alltime", children: "All-Time" }),
              /* @__PURE__ */ u2("span", { class: "bbgl-enh-sw-opt" + (isPeriod ? " active" : ""), "data-mode": "selected", children: "Selected" })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ u2("div", { class: "bbgl-ach-cols", style: { gridTemplateColumns: "repeat(2,minmax(0,1fr))" }, children: [
        /* @__PURE__ */ u2("div", { class: "bbgl-ach-col", children: LEFT_COL.map((id) => /* @__PURE__ */ u2(EnhRow, { id }, id)) }),
        /* @__PURE__ */ u2("div", { class: "bbgl-ach-col", children: RIGHT_COL.map((rid) => /* @__PURE__ */ u2(EnhRow, { id: rid }, rid)) })
      ] })
    ] });
  }
  function OdSubRow(props) {
    const meta = ITEM_LOG_META[props.odId];
    const rec = props.rec || { count: 0, energyLost: 0 };
    const countNode = rec.count > 0 ? Formatter.number(rec.count) : /* @__PURE__ */ u2(NullVal, {});
    const lostNum = rec.energyLost > 0 ? "-" + Formatter.number(rec.energyLost) : null;
    const odLabel = app.achOdLabel(meta.label);
    const tip = props.isExpanded ? `Amount of ${odLabel} \xB7 Energy Lost` : `Amount of ${odLabel}`;
    const clipVal = `${meta.label}: ${rec.count} (-${Formatter.number(rec.energyLost)} Energy Lost)`;
    return /* @__PURE__ */ u2("div", { class: "bbgl-ach-row bbgl-ach-enh-row bbgl-ach-od-row bbgl-subgroup-row bbgl-subgroup-row-last", "data-tooltip": tip, "data-ach-key": `enh-${props.odId}`, "data-clip": clipVal, children: /* @__PURE__ */ u2("div", { class: "ach-row-main", children: [
      /* @__PURE__ */ u2("div", { class: "ach-k-stack", children: /* @__PURE__ */ u2("span", { class: "ach-k", children: [
        /* @__PURE__ */ u2("span", { class: "ach-title-long", children: "ODs:" }),
        /* @__PURE__ */ u2("span", { class: "ach-title-short", children: "ODs:" })
      ] }) }),
      /* @__PURE__ */ u2("div", { class: "ach-v-wrap", children: [
        /* @__PURE__ */ u2("span", { class: "ach-value", children: countNode }),
        /* @__PURE__ */ u2("span", { class: "ach-value ach-enh-gained ach-enh-od", children: [
          lostNum || /* @__PURE__ */ u2(NullVal, {}),
          " ",
          /* @__PURE__ */ u2("span", { class: "ach-enh-e-label", children: "E" })
        ] })
      ] })
    ] }) });
  }
  function PageHappy(d3) {
    const STAT_ABBR = { str: "STR", def: "DEF", spd: "SPD", dex: "DEX" };
    const STAT_FULL = { str: "Strength", def: "Defense", spd: "Speed", dex: "Dexterity" };
    const isExpanded = typeof app.achIsExpandedMode === "function" ? app.achIsExpandedMode() : false;
    const rec = d3.bestHappyJump && d3.bestHappyJump.total;
    const hjCount = d3.happyJumps || 0;
    const trained = rec && rec.stats ? STATS.filter((sk) => (rec.stats[sk] || 0) > 0) : [];
    const clipParts = trained.map((sk) => STAT_ABBR[sk] + ": +" + app.achFmtGain(rec.stats[sk]));
    if (rec) clipParts.push("Total: +" + app.achFmtGain(rec.value));
    const dateStr = rec ? app.achFmtDate(rec.date) : "";
    const timeStr = rec ? app.achFmtTimeHM(rec.ts) + " \u2013 " + app.achFmtTimeHM(rec.tsEnd || rec.ts) + " " + app.achTimeZoneSuffix() : "";
    const timeStrClip = rec ? app.achFmtTimeHMClip(rec.ts) + " \u2013 " + app.achFmtTimeHMClip(rec.tsEnd || rec.ts) + " TCT" : "";
    const bestClip = rec && rec.stats ? `Best Happy Jump (${dateStr}, ${timeStrClip}): ${clipParts.join(" | ")}` : "";
    const hhOrder = { 2180: 1, 2210: 2, 2020: 3, 8983: 4 };
    const helpers = HAPPY_LOGS.map((id) => {
      const recH = d3.happyItemTotals && d3.happyItemTotals[id] || { count: 0, happy: 0 };
      const meta = ITEM_LOG_META[id];
      return { id, label: meta.achLabel || meta.label, short: meta.short || meta.label, count: recH.count, happy: recH.happy };
    }).filter((h3) => h3.count > 0).sort((a3, b2) => (hhOrder[a3.id] || 99) - (hhOrder[b2.id] || 99));
    const clipHelpers = helpers.map((h3) => `${h3.label}: ${h3.count} (${Formatter.number(h3.happy)} Happy)`).join("\n");
    let clipAll = `Happy Jumps Performed: ${hjCount}
Best Happy Jump: ${rec && rec.stats ? clipParts.join(" | ") : "\u2014"}`;
    if (helpers.length) clipAll += "\n\n\u2014 Happy Helpers \u2014\n" + clipHelpers;
    const helperCols = splitCols(helpers, 2);
    return /* @__PURE__ */ u2("div", { class: "bbgl-ach-section bbgl-ach-section-hh", children: [
      /* @__PURE__ */ u2("div", { class: "bbgl-ach-title-row", children: /* @__PURE__ */ u2("span", { class: "bbgl-ach-section-title", "data-ach-section": "happy-hopping", "data-clip-section": clipAll, "data-clip-title": "Happy Hopping", "data-tooltip": COPY_TIP, children: "HAPPY HOPPING" }) }),
      /* @__PURE__ */ u2("div", { class: "bbgl-ach-hh-group", "data-ach-key": "happy-jumps-group", children: [
        /* @__PURE__ */ u2(
          "div",
          {
            class: "bbgl-ach-row",
            "data-tooltip-html": "Total number of Happy Jumps performed.<br><i>HJ = 1000E+ spent within 15m of using Ecstasy</i>",
            "data-ach-key": "hj-count",
            "data-clip": `Happy Jumps Performed: ${hjCount}`,
            children: /* @__PURE__ */ u2("div", { class: "ach-row-main", children: [
              /* @__PURE__ */ u2("div", { class: "ach-k-stack", children: /* @__PURE__ */ u2("span", { class: "ach-k", children: [
                /* @__PURE__ */ u2("span", { class: "ach-title-long", children: "Happy Jumps Performed" }),
                /* @__PURE__ */ u2("span", { class: "ach-title-short", children: "Happy Jumps" }),
                ":"
              ] }) }),
              /* @__PURE__ */ u2("div", { class: "ach-v-wrap", children: /* @__PURE__ */ u2("span", { class: "ach-value", children: String(hjCount) }) })
            ] })
          }
        ),
        rec && rec.stats ? /* @__PURE__ */ u2("div", { class: "bbgl-ach-hh-best-row", "data-tooltip": "The single Happy Jump that yielded the highest combined stat gain.", "data-ach-key": "best-hj", "data-clip": bestClip, "data-clip-date": `${dateStr}  ${timeStrClip}`, children: [
          /* @__PURE__ */ u2("div", { class: "bbgl-ach-hh-label", children: [
            /* @__PURE__ */ u2("span", { class: "ach-k", children: [
              /* @__PURE__ */ u2("span", { class: "ach-title-long", children: "Best Happy Jump" }),
              /* @__PURE__ */ u2("span", { class: "ach-title-short", children: "Best Jump" })
            ] }),
            /* @__PURE__ */ u2("div", { class: "bbgl-ach-hh-date-line", children: [
              dateStr,
              /* @__PURE__ */ u2("span", { class: "bbgl-ach-hh-time", children: [
                " \xA0 ",
                timeStr
              ] })
            ] })
          ] }),
          /* @__PURE__ */ u2("div", { class: "bbgl-ach-hh-cells", children: [
            trained.map((sk) => /* @__PURE__ */ u2("div", { class: "bbgl-ach-hh-cell bbgl-ach-hh-cell-stat bbgl-ach-stat-cell", "data-ach-key": "best-hj", "data-stat": sk, "data-tooltip": `Total ${STAT_FULL[sk]} gained during this jump.`, children: [
              /* @__PURE__ */ u2("span", { class: "bbgl-ach-hh-val", children: [
                "+",
                app.achFmtGain(rec.stats[sk])
              ] }),
              /* @__PURE__ */ u2("span", { class: `bbgl-ach-hh-tag ach-stat-${sk}`, children: STAT_ABBR[sk] })
            ] }, sk)),
            /* @__PURE__ */ u2("div", { class: "bbgl-ach-hh-cell bbgl-ach-hh-cell-total bbgl-ach-stat-cell", "data-ach-key": "best-hj", "data-stat": "total", "data-tooltip": "Total overall stats gained during this jump.", children: [
              /* @__PURE__ */ u2("span", { class: "bbgl-ach-hh-tag ach-stat-tot", children: "Total" }),
              /* @__PURE__ */ u2("span", { class: "bbgl-ach-hh-val", children: [
                "+",
                app.achFmtGain(rec.value)
              ] })
            ] })
          ] })
        ] }) : /* @__PURE__ */ u2("div", { class: "bbgl-ach-hh-best-row", "data-tooltip": "The single Happy Jump that yielded the highest combined stat gain.", "data-ach-key": "best-hj", children: [
          /* @__PURE__ */ u2("div", { class: "bbgl-ach-hh-label", children: [
            /* @__PURE__ */ u2("span", { class: "ach-k", children: [
              /* @__PURE__ */ u2("span", { class: "ach-title-long", children: "Best Happy Jump" }),
              /* @__PURE__ */ u2("span", { class: "ach-title-short", children: "Best Jump" })
            ] }),
            /* @__PURE__ */ u2("div", { class: "bbgl-ach-hh-date-line", children: /* @__PURE__ */ u2("span", { class: "ach-null", children: "No jumps recorded yet" }) })
          ] }),
          /* @__PURE__ */ u2("div", { class: "bbgl-ach-hh-cells", children: /* @__PURE__ */ u2("div", { class: "bbgl-ach-hh-cell bbgl-ach-hh-cell-total", children: [
            /* @__PURE__ */ u2("span", { class: "bbgl-ach-hh-tag ach-stat-tot", children: "Total" }),
            /* @__PURE__ */ u2("span", { class: "bbgl-ach-hh-val", children: /* @__PURE__ */ u2(NullVal, {}) })
          ] }) })
        ] })
      ] }),
      helpers.length ? /* @__PURE__ */ u2("div", { class: "bbgl-ach-cols", style: { gridTemplateColumns: "repeat(2,minmax(0,1fr))", paddingTop: 1, paddingBottom: 0 }, children: helperCols.map((chunk, i3) => /* @__PURE__ */ u2("div", { class: "bbgl-ach-col", children: chunk.map((h3) => {
        const tip = isExpanded ? `Amount of ${h3.label} \xB7 Happy Gained` : `Amount of ${h3.label}`;
        const clipVal = `${h3.label}: ${h3.count} (${Formatter.number(h3.happy)} Happy)`;
        const exRec = h3.id === 2210 && d3.odItemTotals && d3.odItemTotals[EX_OD_LOG] && d3.odItemTotals[EX_OD_LOG].count > 0 ? d3.odItemTotals[EX_OD_LOG] : null;
        return /* @__PURE__ */ u2(S, { children: [
          /* @__PURE__ */ u2("div", { class: "bbgl-ach-row", "data-tooltip": tip, "data-ach-key": `happy-helper-${h3.id}`, "data-clip": clipVal, children: /* @__PURE__ */ u2("div", { class: "ach-row-main", children: [
            /* @__PURE__ */ u2("div", { class: "ach-k-stack", children: /* @__PURE__ */ u2("span", { class: "ach-k", children: [
              /* @__PURE__ */ u2("span", { class: "ach-title-long", children: h3.label }),
              /* @__PURE__ */ u2("span", { class: "ach-title-short", children: h3.short }),
              ":"
            ] }) }),
            /* @__PURE__ */ u2("div", { class: "ach-v-wrap", children: [
              /* @__PURE__ */ u2("span", { class: "ach-value", children: Formatter.number(h3.count) }),
              /* @__PURE__ */ u2("span", { class: "ach-value ach-happy-col", children: [
                "+",
                app.achFmtGain(h3.happy),
                " ",
                /* @__PURE__ */ u2("span", { class: "ach-happy-word", children: "H" })
              ] })
            ] })
          ] }) }),
          exRec ? /* @__PURE__ */ u2(
            "div",
            {
              class: "bbgl-ach-row bbgl-ach-od-row bbgl-subgroup-row bbgl-subgroup-row-last",
              "data-tooltip": isExpanded ? `Amount of ${app.achOdLabel(ITEM_LOG_META[EX_OD_LOG].label)} \xB7 Happy / Energy Lost` : `Amount of ${app.achOdLabel(ITEM_LOG_META[EX_OD_LOG].label)}`,
              "data-ach-key": `happy-od-${EX_OD_LOG}`,
              "data-clip": `${ITEM_LOG_META[EX_OD_LOG].label}: ${exRec.count} (-${Formatter.number(exRec.happyLost)} H, -${Formatter.number(exRec.energyLost)} E)`,
              children: /* @__PURE__ */ u2("div", { class: "ach-row-main", style: { alignItems: "flex-start" }, children: [
                /* @__PURE__ */ u2("div", { class: "ach-k-stack", children: /* @__PURE__ */ u2("span", { class: "ach-k", children: [
                  /* @__PURE__ */ u2("span", { class: "ach-title-long", children: "ODs:" }),
                  /* @__PURE__ */ u2("span", { class: "ach-title-short", children: "ODs:" })
                ] }) }),
                /* @__PURE__ */ u2("div", { class: "ach-v-wrap", style: { alignItems: "flex-start" }, children: [
                  /* @__PURE__ */ u2("span", { class: "ach-value", style: { paddingTop: 1 }, children: Formatter.number(exRec.count) }),
                  /* @__PURE__ */ u2("span", { class: "ach-value ach-happy-col ach-enh-od", children: /* @__PURE__ */ u2("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, lineHeight: 1.2 }, children: [
                    /* @__PURE__ */ u2("div", { children: [
                      exRec.happyLost > 0 ? "-" + Formatter.number(exRec.happyLost) : /* @__PURE__ */ u2(NullVal, {}),
                      " ",
                      /* @__PURE__ */ u2("span", { class: "ach-happy-word ach-od-happy-word", children: "H" })
                    ] }),
                    /* @__PURE__ */ u2("div", { children: [
                      exRec.energyLost > 0 ? "-" + Formatter.number(exRec.energyLost) : /* @__PURE__ */ u2(NullVal, {}),
                      " ",
                      /* @__PURE__ */ u2("span", { class: "ach-enh-e-label", style: { color: "#c06060" }, children: "E" })
                    ] })
                  ] }) })
                ] })
              ] })
            }
          ) : null
        ] });
      }) }, i3)) }) : null
    ] });
  }
  function PageRewards(d3) {
    const rows = [
      { label: "Green Days", key: "green-days", display: String(d3.greenDays || 0), rawVal: String(d3.greenDays || 0), statClass: "ach-fx-green", tip: "Total days where the minimum daily goal (Green: 1,000E+) was achieved." },
      { label: "Gold Days", key: "gold-days", display: String(d3.goldDays || 0), rawVal: String(d3.goldDays || 0), statClass: "ach-fx-gold", tip: "Total days where the elite daily goal (Gold: 1,500E+) was achieved." },
      { label: "Diamond Days", key: "diamond-days", display: String(d3.diamondDays || 0), rawVal: String(d3.diamondDays || 0), statClass: "ach-fx-diamond", tip: "Total days where the ultimate daily goal (Diamond: 2,000E+) was achieved." },
      { label: "Stickers Unlocked", key: "stickers", display: (d3.stickersUnlocked || 0) + "/" + CUSTOM_STICKERS.length, rawVal: (d3.stickersUnlocked || 0) + "/" + CUSTOM_STICKERS.length, statClass: "ach-fx-holo", tip: "Total unique milestone stickers earned through consistent training." },
      { label: "Green Weeks", key: "green-weeks", display: String(d3.greenWeeks || 0), rawVal: String(d3.greenWeeks || 0), statClass: "ach-fx-green", tip: "Total weeks where the minimum weekly training goal was met." },
      { label: "Gold Weeks", key: "gold-weeks", display: String(d3.goldWeeks || 0), rawVal: String(d3.goldWeeks || 0), statClass: "ach-fx-gold", tip: "Total weeks where the elite weekly training goal was met." },
      { label: "Diamond Weeks", key: "diamond-weeks", display: String(d3.diamondWeeks || 0), rawVal: String(d3.diamondWeeks || 0), statClass: "ach-fx-diamond", tip: "Total weeks where the ultimate weekly training goal was met." }
    ];
    return /* @__PURE__ */ u2(AchSection, { title: "Rewards Reaped", sectionKey: "rewards-reaped", rows, colCount: 2 });
  }
  function PageLocked() {
    return /* @__PURE__ */ u2("div", { class: "bbgl-ach-locked", children: [
      /* @__PURE__ */ u2("div", { class: "bbgl-ach-locked-icon", children: "\u{1F512}" }),
      /* @__PURE__ */ u2("div", { class: "bbgl-ach-locked-text", children: "Reach Level 100 to unlock this page!" })
    ] });
  }
  function AchPage(props) {
    if (props.page === 0) return Page0(props.d);
    if (props.page === 1) return Page1(props.d);
    if (props.page === 2) {
      const overviewD = viewState.achEnhPeriodMode ? app.computeEnhancersForPeriod(calendarState.selectedData || app.DataController.getSlice("DAY", Formatter.dateLogical())) : props.d;
      return PageOverview(overviewD);
    }
    if (props.page === 3) return PageHappy(props.d);
    if (props.page === 5) return /* @__PURE__ */ u2(PageLocked, {});
    return PageRewards(props.d);
  }
  function onAchClick(e3) {
    const t3 = e3.target;
    const swOpt = t3.closest(".bbgl-enh-sw-opt");
    if (swOpt) {
      const toSelected = swOpt.dataset.mode === "selected";
      if (toSelected !== !!viewState.achEnhPeriodMode) {
        viewState.achEnhPeriodMode = toSelected;
        saveViewState();
        if (typeof app.achRefreshPageDom === "function") app.achRefreshPageDom();
      }
      return;
    }
    const colHeader = t3.closest(".bbgl-ach-col-copy");
    if (colHeader) {
      app.handleAchCopy(colHeader);
      return;
    }
    const statCell = t3.closest(".bbgl-ach-stat-cell");
    if (statCell) {
      app.handleAchCopy(statCell);
      return;
    }
    const group = t3.closest(".bbgl-ach-hh-group");
    if (group) {
      app.handleAchCopy(group);
      return;
    }
    const row = t3.closest(".bbgl-ach-section-title, .bbgl-ach-subsection-title, .bbgl-ach-row");
    if (row) app.handleAchCopy(row);
  }
  function AchievementsView() {
    useUiTick();
    const d3 = ensureAchievements();
    const page = typeof runtime._achPage === "number" ? runtime._achPage : viewState.achPage || 0;
    const swipe = A2({ x: 0, y: 0 });
    const crt = runtime._achCrt || "";
    h2(() => {
      if (page === 5 && typeof app.resizeAchLockedPage === "function") app.resizeAchLockedPage();
    });
    if (!d3) {
      return /* @__PURE__ */ u2(S, { children: [
        /* @__PURE__ */ u2("div", { id: "bbgl-achievements-container", class: "ledger-content", children: /* @__PURE__ */ u2("div", { class: "bbgl-ach-scroll", children: /* @__PURE__ */ u2("div", { id: "bbgl-ach-pages" }) }) }),
        /* @__PURE__ */ u2("div", { id: "bbgl-ach-footer", class: "bbgl-ach-footer" })
      ] });
    }
    return /* @__PURE__ */ u2(S, { children: [
      /* @__PURE__ */ u2(
        "div",
        {
          id: "bbgl-achievements-container",
          class: "ledger-content",
          onClick: onAchClick,
          onTouchStart: (e3) => {
            swipe.current = { x: e3.touches[0].clientX, y: e3.touches[0].clientY };
          },
          onTouchEnd: (e3) => {
            if (window._bbglScrubbing) return;
            const dx = e3.changedTouches[0].clientX - swipe.current.x;
            const dy = e3.changedTouches[0].clientY - swipe.current.y;
            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) app.gotoAchievementsPage(dx < 0 ? 1 : -1);
          },
          children: /* @__PURE__ */ u2("div", { class: "bbgl-ach-scroll", children: /* @__PURE__ */ u2("div", { id: "bbgl-ach-pages", class: crt || void 0, children: /* @__PURE__ */ u2(AchPage, { page, d: d3 }) }) })
        }
      ),
      /* @__PURE__ */ u2("div", { id: "bbgl-ach-footer", class: "bbgl-ach-footer", children: [
        /* @__PURE__ */ u2("div", { class: "bbgl-ach-footer-side bbgl-ach-footer-left", children: /* @__PURE__ */ u2("button", { type: "button", class: "bbgl-ach-nav bbgl-ach-prev", "aria-label": "Previous achievements page", onClick: (e3) => {
          e3.stopPropagation();
          app.gotoAchievementsPage(-1);
        }, children: "\u276E" }) }),
        /* @__PURE__ */ u2("div", { id: "bbgl-ach-pageindicator", children: Array.from({ length: 6 }, (_3, i3) => /* @__PURE__ */ u2("div", { class: "pg-dot" + (i3 === page ? " active" : ""), onClick: () => {
          if (i3 !== page) app.gotoAchievementsPage(i3 - page);
        } }, i3)) }),
        /* @__PURE__ */ u2("div", { class: "bbgl-ach-footer-side bbgl-ach-footer-right", children: /* @__PURE__ */ u2("button", { type: "button", class: "bbgl-ach-nav bbgl-ach-next", "aria-label": "Next achievements page", onClick: (e3) => {
          e3.stopPropagation();
          app.gotoAchievementsPage(1);
        }, children: "\u276F" }) })
      ] })
    ] });
  }

  // src/ui/preact/views/Stickers.tsx
  function ensureStickers() {
    if (!runtime.stickerData.length && typeof app.loadStickerData === "function") app.loadStickerData();
  }
  function pageCount() {
    return Math.ceil((runtime.stickerData.length || 0) / 10);
  }
  function goPage(page) {
    runtime.currentStickerPage = page;
    viewState.currentStickerPage = page;
    saveViewState();
    if (typeof app.renderStickers === "function") app.renderStickers();
  }
  function onNav(dir) {
    if (dir < 0 && runtime.currentStickerPage <= -1) return;
    if (dir > 0 && runtime.currentStickerPage >= pageCount() - 1) return;
    if (typeof app.changeStickerPage === "function") app.changeStickerPage(dir);
  }
  function StickerTitle() {
    useUiTick();
    ensureStickers();
    const page = runtime.currentStickerPage;
    const title = page === -1 ? "Sponsorship" : PAGE_TITLES[page] || "";
    return /* @__PURE__ */ u2("div", { id: "bbgl-sticker-title", children: title });
  }
  function StickersView() {
    useUiTick();
    ensureStickers();
    const page = runtime.currentStickerPage;
    const pages = pageCount();
    const start = Math.max(0, page) * 10;
    const items = runtime.stickerData.slice(start, start + 10);
    const comingSoon = page >= 2;
    const sponsor = page === -1;
    const swipe = A2({ x: 0, y: 0 });
    const pts = typeof app.getSponsorBurstPoints === "function" ? app.getSponsorBurstPoints() : "";
    return /* @__PURE__ */ u2(S, { children: [
      /* @__PURE__ */ u2("div", { id: "bbgl-sticker-bg" }),
      /* @__PURE__ */ u2(
        "div",
        {
          id: "bbgl-sticker-container",
          onTouchStart: (e3) => {
            swipe.current = { x: e3.touches[0].clientX, y: e3.touches[0].clientY };
          },
          onTouchEnd: (e3) => {
            if (window._bbglScrubbing) return;
            const dx = e3.changedTouches[0].clientX - swipe.current.x;
            const dy = e3.changedTouches[0].clientY - swipe.current.y;
            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
              const dir = dx < 0 ? 1 : -1;
              if (dir < 0 && page > -1 || dir > 0 && page < pages - 1) onNav(dir);
            }
          },
          children: [
            /* @__PURE__ */ u2(
              "div",
              {
                id: "sticker-sponsor-btn",
                class: "sticker-nav-btn" + (page === 0 ? "" : " disabled"),
                onClick: (e3) => {
                  e3.stopPropagation();
                  if (page === 0) onNav(-1);
                },
                children: "\u276E"
              }
            ),
            /* @__PURE__ */ u2(
              "div",
              {
                id: "sticker-prev-btn",
                class: "sticker-nav-btn" + (page <= 0 ? " disabled" : ""),
                onClick: (e3) => {
                  e3.stopPropagation();
                  if (page > 0) onNav(-1);
                },
                children: "\u276E"
              }
            ),
            /* @__PURE__ */ u2(
              "div",
              {
                id: "sticker-next-btn",
                class: "sticker-nav-btn" + (page >= pages - 1 ? " disabled" : ""),
                onClick: (e3) => {
                  e3.stopPropagation();
                  if (page < pages - 1) onNav(1);
                },
                children: "\u276F"
              }
            ),
            /* @__PURE__ */ u2("div", { id: "bbgl-sponsor-grid", style: { display: sponsor ? "grid" : "none" }, children: [0, 1, 2].map((i3) => /* @__PURE__ */ u2("div", { class: "sticker-slot sticker-slot-sponsor active-slot locked", children: [
              /* @__PURE__ */ u2("svg", { class: "sponsor-sticker-svg", viewBox: "0 0 100 100", xmlns: "http://www.w3.org/2000/svg", children: /* @__PURE__ */ u2("polygon", { points: pts, fill: "#ffffff" }) }),
              /* @__PURE__ */ u2("span", { class: "sponsor-sticker-label", children: /* @__PURE__ */ u2(Raw, { html: i3 === 0 ? "Corleone Faction<br>Sticker Here ;)" : "Your Faction<br>Sticker Here" }) })
            ] }, i3)) }),
            /* @__PURE__ */ u2("div", { id: "bbgl-sticker-grid", style: { display: sponsor ? "none" : "" }, children: [
              comingSoon ? null : items.map((it, i3) => {
                if (!it) return /* @__PURE__ */ u2("div", { class: "sticker-slot" }, i3);
                const unlocked = !!it.unlocked;
                return /* @__PURE__ */ u2(
                  "div",
                  {
                    class: "sticker-slot active-slot has-item" + (unlocked ? "" : " locked"),
                    "data-tooltip": unlocked ? it.name : TOOLTIPS.LOCKED,
                    onClick: unlocked ? () => app.openItemViewer(it) : void 0,
                    children: /* @__PURE__ */ u2("img", { class: "sticker-img", src: it.url, alt: "" })
                  },
                  it.id
                );
              }),
              comingSoon ? /* @__PURE__ */ u2("div", { id: "bbgl-coming-soon", class: "bbgl-coming-soon", children: /* @__PURE__ */ u2(Raw, { html: "Cumming<br>Soon..." }) }) : null
            ] }),
            /* @__PURE__ */ u2("div", { id: "bbgl-sticker-pagination", children: [
              /* @__PURE__ */ u2(
                "div",
                {
                  class: "pg-dot pg-dot-sponsor" + (sponsor ? " active" : ""),
                  onClick: () => goPage(-1)
                }
              ),
              Array.from({ length: pages }, (_3, i3) => /* @__PURE__ */ u2(
                "div",
                {
                  class: "pg-dot" + (i3 === page ? " active" : ""),
                  onClick: () => goPage(i3)
                },
                i3
              ))
            ] })
          ]
        }
      )
    ] });
  }
  function ItemViewer() {
    useUiTick();
    const id = viewState.activeItemId || runtime.currentOpenedItemId;
    const item = runtime.stickerData.find((x3) => x3 && x3.id === id) || null;
    const open = !!(item && (viewState.subView === "stickers" || viewState.subView === "viewer" || runtime.currentOpenedItemId === item.id));
    h2(() => {
      const panel = document.getElementById("bbgl-panel");
      if (panel && typeof app.cacheDOM === "function") app.cacheDOM(panel);
    });
    return /* @__PURE__ */ u2("div", { id: "bbgl-item-viewer", class: open ? "active" : void 0, children: [
      /* @__PURE__ */ u2("div", { class: "viewer-window", children: /* @__PURE__ */ u2("div", { class: "viewer-stage", children: /* @__PURE__ */ u2(Island, { children: /* @__PURE__ */ u2("div", { class: "viewer-pedestal", id: "vi-pedestal-wrapper", children: /* @__PURE__ */ u2("div", { class: "viewer-obj", id: "vi-obj-target", children: [
        /* @__PURE__ */ u2("div", { class: "layer-front" }),
        /* @__PURE__ */ u2("div", { class: "layer-back" })
      ] }) }) }) }) }),
      /* @__PURE__ */ u2("div", { class: "viewer-info-overlay", children: /* @__PURE__ */ u2("div", { class: "vi-name", id: "vi-name-target", children: item ? item.name : "Item Name" }) })
    ] });
  }

  // src/ui/preact/ScanOverlay.tsx
  var SCAN_PAUSE_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`;
  var SCAN_PLAY_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
  function currentScanState() {
    if (runtime.demoMode) return { key: null, ds: null };
    const s3 = typeof app.getActiveHistory === "function" ? app.getActiveHistory() : null;
    const ds = s3 && s3.meta && s3.meta.backfill;
    if (!ds) return { key: null, ds: null };
    const lockFresh = ds.lock && Date.now() - ds.lock < BACKFILL.LOCK_STALE_MS;
    let key = null;
    if (runtime.backfilling) key = runtime._scanCancelConfirm ? "confirm" : "scanning";
    else if (lockFresh && ds.lockOwner !== TAB_ID) key = "passenger";
    else if (ds.acknowledged === false) {
      if (ds.lastResult === "complete") key = "complete";
      else if (ds.stopReason === "cap") key = "cap";
      else if (ds.stopReason === "paused") key = "paused";
      else if (ds.stopReason === "interrupted") key = "interrupted";
      else key = "error";
    }
    return { key, ds };
  }
  function ScanOverlay() {
    useUiTick();
    const [, setTick] = d2(0);
    const { key, ds } = currentScanState();
    const inSettings = viewState.subView === "settings" || !!(dom.settingsView && dom.settingsView.classList.contains("active-view"));
    const renderKey = !key ? null : inSettings ? "settings" : key;
    h2(() => {
      if (renderKey !== "passenger") return;
      const id = setInterval(() => setTick((n2) => n2 + 1), 3e3);
      return () => clearInterval(id);
    }, [renderKey]);
    if (!renderKey) return null;
    return /* @__PURE__ */ u2("div", { id: "bbgl-scan-overlay", children: [
      renderKey === "settings" && /* @__PURE__ */ u2(S, { children: [
        /* @__PURE__ */ u2("div", { class: "bbgl-scan-title", children: "Scan in Progress" }),
        /* @__PURE__ */ u2("div", { class: "bbgl-scan-sub", children: "Settings are locked while Big Black Backfill runs. Head back to the log to pause or check progress." })
      ] }),
      renderKey === "scanning" && /* @__PURE__ */ u2(S, { children: [
        /* @__PURE__ */ u2("div", { id: "bbgl-scan-cancel", onClick: () => {
          runtime._scanCancelConfirm = true;
          if (app.notifyUi) app.notifyUi();
        }, children: "Cancel" }),
        /* @__PURE__ */ u2("div", { class: "bbgl-scan-title-row", children: [
          /* @__PURE__ */ u2("div", { class: "bbgl-scan-title", children: "Scanning\u2026" }),
          /* @__PURE__ */ u2("div", { id: "bbgl-scan-pause", class: "bbgl-scan-iconbtn bbgl-scan-play bbgl-scan-title-icon", title: "Pause", onClick: (e3) => {
            runtime.backfillAbort = "pause";
            const t3 = e3.currentTarget.parentElement?.querySelector(".bbgl-scan-title");
            if (t3) t3.textContent = "Pausing\u2026";
          }, children: /* @__PURE__ */ u2(Raw, { html: SCAN_PAUSE_SVG }) })
        ] }),
        /* @__PURE__ */ u2("div", { class: "bbgl-scan-count-row", children: [
          /* @__PURE__ */ u2("span", { class: "bbgl-scan-pulse" }),
          "Rows recovered so far: ",
          /* @__PURE__ */ u2("span", { id: "bbgl-scan-count", class: "bbgl-scan-count", children: ds && ds.rowsUsed || 0 })
        ] }),
        /* @__PURE__ */ u2("div", { class: "bbgl-scan-sub", children: "This only takes up to a few minutes. Please stay on this page until the scan completes." }),
        /* @__PURE__ */ u2("div", { class: "bbgl-scan-note", children: "If you're on PC, you may continue playing in another tab, but do not close this one." })
      ] }),
      renderKey === "confirm" && /* @__PURE__ */ u2(S, { children: [
        /* @__PURE__ */ u2("div", { class: "bbgl-scan-title", children: "Cancel this scan?" }),
        /* @__PURE__ */ u2("div", { class: "bbgl-scan-sub", children: "Canceling discards everything recovered during this scan. Your log since installation remains untouched." }),
        /* @__PURE__ */ u2("div", { class: "bbgl-scan-actions", children: [
          /* @__PURE__ */ u2("div", { id: "bbgl-scan-confirm-yes", class: "bbgl-scan-iconbtn bbgl-scan-yes", title: "Yes, cancel", onClick: (e3) => {
            runtime.backfillAbort = "cancel";
            runtime._scanCancelConfirm = false;
            const t3 = e3.currentTarget.closest("#bbgl-scan-overlay")?.querySelector(".bbgl-scan-title");
            if (t3) t3.textContent = "Discarding\u2026";
          }, children: /* @__PURE__ */ u2(Raw, { html: ICONS.CHECK }) }),
          /* @__PURE__ */ u2("div", { id: "bbgl-scan-confirm-no", class: "bbgl-scan-iconbtn bbgl-scan-no", title: "No, keep scanning", onClick: () => {
            runtime._scanCancelConfirm = false;
            if (app.notifyUi) app.notifyUi();
          }, children: /* @__PURE__ */ u2(Raw, { html: ICONS.CLOSE }) })
        ] })
      ] }),
      renderKey === "passenger" && /* @__PURE__ */ u2(S, { children: [
        /* @__PURE__ */ u2("div", { class: "bbgl-scan-title", children: "Scan Running in Another Tab" }),
        /* @__PURE__ */ u2("div", { class: "bbgl-scan-sub", children: "Big Black Backfill is currently active in another tab. Use that tab to pause or cancel the scan." })
      ] }),
      (renderKey === "paused" || renderKey === "error" || renderKey === "interrupted") && /* @__PURE__ */ u2(S, { children: [
        /* @__PURE__ */ u2("div", { class: "bbgl-scan-title-row", children: [
          /* @__PURE__ */ u2("div", { class: "bbgl-scan-title", children: renderKey === "paused" ? "Paused" : renderKey === "error" ? "Scan Error" : "Interrupted" }),
          /* @__PURE__ */ u2("div", { id: "bbgl-scan-resume", class: "bbgl-scan-iconbtn bbgl-scan-play bbgl-scan-title-icon", title: "Resume", onClick: () => app.backfillLogs(document.getElementById("backfill-btn")), children: /* @__PURE__ */ u2(Raw, { html: SCAN_PLAY_SVG }) })
        ] }),
        /* @__PURE__ */ u2("div", { class: "bbgl-scan-sub", children: [
          renderKey === "paused" && "You can resume now, or continue with what's been recovered so far.",
          renderKey === "error" && "A network or API error occurred. No progress was lost. Resume to keep going, or continue with what's been recovered so far.",
          renderKey === "interrupted" && "The tab or browser was closed before the scan finished. Your progress up to that point was saved. Resume to keep going, or continue with what's been recovered so far."
        ] }),
        /* @__PURE__ */ u2("div", { class: "bbgl-scan-actions", children: /* @__PURE__ */ u2("div", { id: "bbgl-scan-proceed", class: "bbgl-scan-textbtn bbgl-scan-primary", onClick: () => app.proceedPartialBackfill(), children: "Continue with what's been recovered" }) })
      ] }),
      renderKey === "cap" && /* @__PURE__ */ u2(S, { children: [
        /* @__PURE__ */ u2("div", { class: "bbgl-scan-title", children: "Daily Limit Reached" }),
        /* @__PURE__ */ u2("div", { class: "bbgl-scan-sub", children: "Torn's daily row cap has been reached. Resume from the Settings menu in 24h. Everything recovered so far is fully constructed, none of it is partial." }),
        /* @__PURE__ */ u2("div", { class: "bbgl-scan-actions", children: /* @__PURE__ */ u2("div", { id: "bbgl-scan-proceed", class: "bbgl-scan-textbtn bbgl-scan-primary", onClick: () => app.proceedPartialBackfill(), children: "Continue to Logs" }) })
      ] }),
      renderKey === "complete" && /* @__PURE__ */ u2(S, { children: [
        /* @__PURE__ */ u2("div", { class: "bbgl-scan-title", children: "Fully Backfilled!" }),
        /* @__PURE__ */ u2("div", { class: "bbgl-scan-sub", children: "Your training history has been fully reconstructed." }),
        /* @__PURE__ */ u2("div", { class: "bbgl-scan-note", children: "Rewards and stickers only start counting from the day you began tracking, not from backfilled history." }),
        /* @__PURE__ */ u2("div", { class: "bbgl-scan-actions", children: /* @__PURE__ */ u2("div", { id: "bbgl-scan-ack", class: "bbgl-scan-textbtn bbgl-scan-primary", onClick: () => app.acknowledgeBackfill(), children: "Enter Logs" }) })
      ] })
    ] });
  }

  // src/ui/preact/Dashboard.tsx
  function Header() {
    return /* @__PURE__ */ u2("div", { class: "bbgl-header", id: "bbgl-header-bar", onClick: onHeaderClick, children: [
      /* @__PURE__ */ u2("div", { class: "bbgl-header-left", children: [
        /* @__PURE__ */ u2(Raw, { html: ICONS.LOGO }),
        /* @__PURE__ */ u2("span", { class: "bbgl-header-text", children: [
          /* @__PURE__ */ u2("span", { class: "bbgl-short-title", children: "Big Black Log" }),
          /* @__PURE__ */ u2("span", { class: "bbgl-long-title", children: "Big Black Gym Log" })
        ] })
      ] }),
      /* @__PURE__ */ u2("div", { class: "bbgl-header-right", children: [
        /* @__PURE__ */ u2(
          "span",
          {
            id: "bbgl-demo-exit-btn",
            class: "close-settings-btn bbgl-close-purple",
            style: { display: runtime.demoMode ? "flex" : "none" },
            "data-tooltip-html": TOOLTIPS.DEMO_EXIT_HTML,
            onClick: onDemoExit,
            children: [
              /* @__PURE__ */ u2("span", { class: "bbgl-demo-x-label", children: "Demo" }),
              /* @__PURE__ */ u2(Raw, { html: ICONS.CLOSE })
            ]
          }
        ),
        /* @__PURE__ */ u2("span", { id: "bbgl-settings-btn", class: "bbgl-custom-icon", onClick: (e3) => app.toggleSettingsView(e3), children: "\u2699" }),
        /* @__PURE__ */ u2("span", { id: "bbgl-close-btn", class: "bbgl-native-icon", onClick: () => app.closePanel(), children: /* @__PURE__ */ u2(Raw, { html: ICONS.MINIMIZE }) }),
        /* @__PURE__ */ u2("span", { id: "bbgl-pop-btn", class: "bbgl-native-icon", onClick: onPopoutClick, children: /* @__PURE__ */ u2(Raw, { html: viewState.expanded ? ICONS.COMPRESS : ICONS.POPOUT }) })
      ] })
    ] });
  }
  function TopPanel() {
    const sub = viewState.subView;
    const overlay = sub === "settings" || sub === "welcome";
    const cls = [
      sub === "graph" ? "viewing-graph" : "",
      sub === "stickers" ? "viewing-stickers" : "",
      sub === "achievements" ? "viewing-achievements" : ""
    ].filter(Boolean).join(" ");
    return /* @__PURE__ */ u2("div", { id: "bbgl-top-panel", class: cls, style: { display: overlay ? "none" : "flex" }, children: [
      /* @__PURE__ */ u2("div", { id: "bbgl-tall-toggle", onClick: () => app.toggleTall(), children: viewState.isTall ? "\u2013" : "+" }),
      /* @__PURE__ */ u2("div", { id: "bbgl-ledger-toggle", "data-tooltip": TOOLTIPS.LEDGER_VIEW, onClick: () => app.toggleLedgerView(), children: /* @__PURE__ */ u2(Raw, { html: ICONS.LEDGER }) }),
      /* @__PURE__ */ u2("div", { id: "bbgl-graph-toggle", "data-tooltip": TOOLTIPS.GRAPH_VIEW, onClick: () => app.toggleGraphView(), children: /* @__PURE__ */ u2(Raw, { html: ICONS.GRAPH }) }),
      /* @__PURE__ */ u2("div", { id: "bbgl-achievements-toggle", "data-tooltip": TOOLTIPS.ACHIEVEMENTS, onClick: () => app.toggleAchievementsView(), children: /* @__PURE__ */ u2(Raw, { html: ICONS.ACHIEVEMENTS }) }),
      /* @__PURE__ */ u2("div", { id: "bbgl-sticker-toggle", "data-tooltip": TOOLTIPS.STICKERBOOK, onClick: () => app.toggleStickerView(), children: /* @__PURE__ */ u2(Raw, { html: ICONS.STICKERBOOK }) }),
      /* @__PURE__ */ u2("div", { id: "bbgl-copy-btn", class: "copy-hist-btn", "data-tooltip": TOOLTIPS.COPY_SESSION, onClick: onCopySession, children: /* @__PURE__ */ u2(Raw, { html: ICONS.CLIPBOARD }) }),
      /* @__PURE__ */ u2(StickerTitle, {}),
      /* @__PURE__ */ u2(LedgerChrome, {}),
      /* @__PURE__ */ u2(GraphView, {}),
      /* @__PURE__ */ u2(AchievementsView, {}),
      /* @__PURE__ */ u2(StickersView, {}),
      /* @__PURE__ */ u2("div", { class: "glass-overlay" })
    ] });
  }
  function BottomPanel() {
    const overlay = viewState.subView === "settings" || viewState.subView === "welcome";
    const hideForViewer = viewState.subView === "stickers" && viewState.activeItemId;
    return /* @__PURE__ */ u2(
      "div",
      {
        id: "bbgl-bottom-panel",
        style: overlay || hideForViewer ? { display: "none" } : void 0,
        children: [
          /* @__PURE__ */ u2(
            "div",
            {
              id: "bbgl-demo-exit",
              style: { display: runtime.demoMode ? "flex" : "none" },
              "data-tooltip": TOOLTIPS.DEMO_EXIT,
              "data-tooltip-html": TOOLTIPS.DEMO_EXIT_HTML,
              onClick: onDemoExit,
              children: "DEMO MODE"
            }
          ),
          /* @__PURE__ */ u2(MonthHeader, {}),
          /* @__PURE__ */ u2("div", { id: "bbgl-level-bg", dangerouslySetInnerHTML: { __html: buildEmptyLevelTrackSVG() } }),
          /* @__PURE__ */ u2("div", { id: "bbgl-level-container", children: [
            /* @__PURE__ */ u2("div", { id: "bbgl-level-flag-clip", children: /* @__PURE__ */ u2("span", { id: "bbgl-level-num", children: "Lv 1" }) }),
            /* @__PURE__ */ u2("div", { id: "bbgl-level-track", children: /* @__PURE__ */ u2("div", { id: "bbgl-level-fill" }) })
          ] }),
          /* @__PURE__ */ u2("div", { class: "bbgl-grid-container", children: [
            /* @__PURE__ */ u2(WeekRow, {}),
            /* @__PURE__ */ u2(CalendarSwipe, { children: /* @__PURE__ */ u2(CalendarGrid, {}) })
          ] })
        ]
      }
    );
  }
  function Dashboard() {
    useUiTick();
    h2(() => {
      const panel = document.getElementById("bbgl-panel");
      if (panel && typeof app.cacheDOM === "function") app.cacheDOM(panel);
      if (typeof app.refreshInitLock === "function") app.refreshInitLock();
      if (typeof app.renderScanOverlay === "function") app.renderScanOverlay();
    });
    const sub = viewState.subView;
    return /* @__PURE__ */ u2(S, { children: [
      /* @__PURE__ */ u2(Header, {}),
      /* @__PURE__ */ u2("div", { id: "bbgl-content-wrapper", children: [
        /* @__PURE__ */ u2(TopPanel, {}),
        /* @__PURE__ */ u2(BottomPanel, {}),
        /* @__PURE__ */ u2(ItemViewer, {}),
        /* @__PURE__ */ u2("div", { id: "bbgl-settings-view", class: sub === "settings" ? "active-view" : "", children: /* @__PURE__ */ u2(Settings, {}) }),
        /* @__PURE__ */ u2("div", { id: "bbgl-welcome-view", class: sub === "welcome" ? "active-view" : "", children: /* @__PURE__ */ u2(Welcome, {}) }),
        /* @__PURE__ */ u2(ScanOverlay, {})
      ] })
    ] });
  }

  // src/ui/preact/mount.tsx
  function mountDashboard(panel) {
    R(/* @__PURE__ */ u2(Dashboard, {}), panel);
    if (typeof app.cacheDOM === "function") app.cacheDOM(panel);
  }
  function unmountDashboard(panel) {
    R(null, panel);
  }
  app.mountDashboard = mountDashboard;
  app.unmountDashboard = unmountDashboard;

  // src/boot/boot.ts
  function boot() {
    if (app.TooltipController) window.TooltipController = app.TooltipController;
    if (typeof app.installDomHooks === "function") app.installDomHooks();
    if (typeof app.init === "function") {
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", app.init);
      else app.init();
    }
  }

  // src/main.ts
  if (!window.__BBGL_LOADED__) {
    window.__BBGL_LOADED__ = true;
    boot();
  }
})();

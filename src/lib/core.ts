// ========== 核心常量与全局状态 ==========

import type { EngineState } from "./engines/types";

// ---- 状态机（以 DOM 属性为准，避免异步竞态） ----

type QtState = "" | "translating" | "translated";

/**
 * 全局翻译状态机，以 DOM 属性 `qt-state` 为准，避免异步竞态。
 * `""` → `"translating"` → `"translated"`
 */
export const S = {
  get(): QtState {
    return (document.documentElement.getAttribute("qt-state") || "") as QtState;
  },
  set(v: QtState) {
    document.documentElement.setAttribute("qt-state", v);
  },
  translated(): boolean {
    return this.get() === "translated";
  },
  translating(): boolean {
    return this.get() === "translating";
  },
};

// ---- 全局可变状态 ----

/** 扫描阶段取消标志、已翻译元素列表、翻译完成时间 */
export const state = {
  cancelled: false,
  translatedEls: [] as HTMLElement[],
  translatedAt: 0,
};

// ---- 内存缓存 ----

/**
 * LRU 缓存，基于 Map 插入顺序。
 * 达到上限时自动淘汰最久未访问的条目。
 */
class LRUCache<K, V> {
  private map = new Map<K, V>();
  constructor(private max: number) {}

  get(key: K): V | undefined {
    const v = this.map.get(key);
    if (v !== undefined) {
      // 删后重插 → 移到末尾（最新）
      this.map.delete(key);
      this.map.set(key, v);
    }
    return v;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.max) {
      // 淘汰最旧条目（Map 第一个）
      const first = this.map.keys().next().value!;
      this.map.delete(first);
    }
    this.map.set(key, value);
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  clear(): void {
    this.map.clear();
  }
}

/** 文本 → 译文的运行时内存缓存，上限 1000 条 */
export const memCache = new LRUCache<string, string>(1000);

// ---- CSS 类名常量 ----

/** 翻译相关 CSS 类名，集中管理避免硬编码散落各处 */
export const CSS = {
  SKIP: "qt-skip",
  LOADER: "qt-loader",
  TRANS: "qt-trans",
} as const;

// ---- 配置常量 ----

/** 单次翻译文本最大字符数，超出则按句子拆分 */
export const MAX_TEXT_LEN = 3000;
/** 视为"非英文"的最小字母数 */
export const MIN_TEXT_LEN = 1;
/** 视口外预加载的额外距离（像素） */
export const VIEWPORT_MARGIN = 300;

/** 元素是否在视口内（含一定边距） */
export function inView(el: Element): boolean {
  const r = el.getBoundingClientRect();
  const wh = window.innerHeight || document.documentElement.clientHeight;
  const ww = window.innerWidth || document.documentElement.clientWidth;
  return (
    r.top < wh + VIEWPORT_MARGIN &&
    r.bottom > -VIEWPORT_MARGIN &&
    r.left < ww &&
    r.right > 0
  );
}
/** 单次 API 请求超时（毫秒） */
export const API_TIMEOUT_MS = 8000;

// ---- 扫描跳过的标签 ----

/** 扫描时跳过不翻译的标签 */
export const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEMPLATE",
  "SVG",
  "CANVAS",
  "VIDEO",
  "AUDIO",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "CODE",
  "PRE",
  "KBD",
  "SAMP",
  "VAR",
  "TEXTAREA",
  "INPUT",
  "SELECT",
  "OPTION",
  "RUBY",
  "RT",
  "RP",
  "ABBR",
  "MATH",
  "ADDRESS",
]);

// ---- 不可分割的翻译单元 ----

/** 不可拆分的翻译单元标签（作为整体翻译） */
export const SCAN_UNIT_TAGS = new Set([
  "P",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "LI",
  "BLOCKQUOTE",
  "FIGCAPTION",
  "DT",
  "DD",
  "TD",
  "TH",
  "SUMMARY",
  "CAPTION",
  "LEGEND",
]);

// ---- 译文插入为兄弟节点的标签 ----

/** 译文需插入为兄弟节点（而非子节点）的标签 */
export const INSERT_AFTER_TAGS = new Set([
  "P",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "BLOCKQUOTE",
  "FIGCAPTION",
  "SUMMARY",
]);

// ---- 工具函数 ----

/**
 * 异步延迟工具。
 * @param ms 等待毫秒数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 给 Promise 加超时，超时后 reject。
 * @param p 原始 Promise
 * @param ms 超时毫秒数
 */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms),
    ),
  ]);
}

// ---- 引擎调度池 ----

/**
 * 五个翻译引擎的运行状态池，按轮询顺序排列。
 * 每个引擎有独立的 `delayMs` 请求间隔。
 */
export const engines: EngineState[] = [
  { name: "MM", lastCall: 0, delayMs: 100, busy: false, rateLimitUntil: 0, calls: 0, errors: 0, sumMs: 0 },
  { name: "GT", lastCall: 0, delayMs: 500, busy: false, rateLimitUntil: 0, calls: 0, errors: 0, sumMs: 0 },
  { name: "BD", lastCall: 0, delayMs: 1000, busy: false, rateLimitUntil: 0, calls: 0, errors: 0, sumMs: 0 },
  { name: "YD", lastCall: 0, delayMs: 200, busy: false, rateLimitUntil: 0, calls: 0, errors: 0, sumMs: 0 },
  { name: "TX", lastCall: 0, delayMs: 200, busy: false, rateLimitUntil: 0, calls: 0, errors: 0, sumMs: 0 },
];

let _pickIdx = -1;

/**
 * 轮询选取一个空闲可用的引擎（不 busy、未限流、已过间隔）。
 * @returns 可用引擎，全部不可用时返回 null
 */
export function pickEngine(): EngineState | null {
  const now = Date.now();
  const len = engines.length;
  for (let i = 0; i < len; i++) {
    _pickIdx = (_pickIdx + 1) % len;
    const e = engines[_pickIdx];
    if (e.busy) continue;
    if (e.rateLimitUntil > now) continue;
    if (now - e.lastCall < e.delayMs) continue;
    return e;
  }
  return null;
}

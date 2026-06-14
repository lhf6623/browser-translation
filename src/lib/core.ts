// ========== 核心常量与全局状态 ==========

import type { EngineState } from "./engines/types";

// ---- 状态机（以 DOM 属性为准，避免异步竞态） ----

type QtState = "" | "translating" | "translated";

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

/** 所有模块间共享的可变状态（ES module 的 import 绑定只读，用对象绕过） */
export const state = {
  cancelled: false,
  translatedEls: [] as HTMLElement[],
  translatedAt: 0,
};

// ---- 内存缓存 ----

export const memCache = new Map<string, string>();

// ---- 配置常量 ----

export const DELAY_MS = 200;
export const MAX_TEXT_LEN = 3000;
export const MIN_TEXT_LEN = 1;
export const VIEWPORT_MARGIN = 300;
export const API_TIMEOUT_MS = 8000;

// ---- 扫描跳过的标签 ----

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

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---- 引擎调度池 ----

export const engines: EngineState[] = [
  { name: "MM", lastCall: 0, busy: false, rateLimitUntil: 0, calls: 0, errors: 0, sumMs: 0 },
  { name: "GT", lastCall: 0, busy: false, rateLimitUntil: 0, calls: 0, errors: 0, sumMs: 0 },
  { name: "BD", lastCall: 0, busy: false, rateLimitUntil: 0, calls: 0, errors: 0, sumMs: 0 },
  { name: "YD", lastCall: 0, busy: false, rateLimitUntil: 0, calls: 0, errors: 0, sumMs: 0 },
  { name: "TX", lastCall: 0, busy: false, rateLimitUntil: 0, calls: 0, errors: 0, sumMs: 0 },
];

let _pickIdx = -1;

export function pickEngine(): EngineState | null {
  const now = Date.now();
  const len = engines.length;
  for (let i = 0; i < len; i++) {
    _pickIdx = (_pickIdx + 1) % len;
    const e = engines[_pickIdx];
    if (e.busy) continue;
    if (e.rateLimitUntil > now) continue;
    if (now - e.lastCall < DELAY_MS) continue;
    return e;
  }
  return null;
}

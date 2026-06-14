// ========== 快捷翻译 - 核心常量与状态 ==========

// 状态（以 DOM 属性为准，避免异步竞态）
const S = {
  get() {
    return document.documentElement.getAttribute("qt-state") || "";
  },
  set(v) {
    document.documentElement.setAttribute("qt-state", v);
  },
  translated() {
    return this.get() === "translated";
  },
  translating() {
    return this.get() === "translating";
  },
};
let cancelled = false;
let translatedEls = [];

// 内存缓存
const memCache = new Map();

// 配置
const DELAY_MS = 200;
const MAX_TEXT_LEN = 3000;
const MIN_TEXT_LEN = 1;
const VIEWPORT_MARGIN = 300;
const API_TIMEOUT_MS = 8000;

const SKIP_TAGS = new Set([
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
// 扫描用：作为不可分割的翻译单元，取整个元素的 textContent（不递归子节点）
const SCAN_UNIT_TAGS = new Set([
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

// 译文插入为兄弟节点的标签（其余一律 appendChild 插入元素内部）
// 仅限父元素允许任意子节点（如 div/body/section）的标签
const INSERT_AFTER_TAGS = new Set([
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

// 工具
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ===== 引擎调度池 =====

const engines = [
  {
    name: "MM",
    lastCall: 0,
    busy: false,
    rateLimitUntil: 0,
    calls: 0,
    errors: 0,
    sumMs: 0,
  },
  {
    name: "GT",
    lastCall: 0,
    busy: false,
    rateLimitUntil: 0,
    calls: 0,
    errors: 0,
    sumMs: 0,
  },
  {
    name: "BD",
    lastCall: 0,
    busy: false,
    rateLimitUntil: 0,
    calls: 0,
    errors: 0,
    sumMs: 0,
  },
  {
    name: "YD",
    lastCall: 0,
    busy: false,
    rateLimitUntil: 0,
    calls: 0,
    errors: 0,
    sumMs: 0,
  },
  {
    name: "TX",
    lastCall: 0,
    busy: false,
    rateLimitUntil: 0,
    calls: 0,
    errors: 0,
    sumMs: 0,
  },
];

let _pickIdx = -1;

function pickEngine() {
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

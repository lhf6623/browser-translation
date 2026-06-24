// ========== 常量 ==========

/** 翻译相关 CSS 类名 */
export const CSS = {
  SKIP: "qt-skip",
  LOADER: "qt-loader",
  TRANS: "qt-trans",
} as const;

// ---- 配置 ----

/** 视口外预加载的额外距离（像素） */
export const VIEWPORT_MARGIN = 300;
/** 单次 API 请求超时（毫秒） */
export const API_TIMEOUT_MS = 8000;

// ---- 扫描跳过的标签 ----

export const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG", "CANVAS",
  "VIDEO", "AUDIO", "IFRAME", "OBJECT", "EMBED",
  "CODE", "PRE", "KBD", "SAMP", "VAR",
  "TEXTAREA", "INPUT", "SELECT", "OPTION",
  "RUBY", "RT", "RP", "ABBR", "MATH", "ADDRESS",
]);

// ---- 不可分割的翻译单元 ----

/** 作为整体翻译的块级标签 */
export const SCAN_UNIT_TAGS = new Set([
  "P", "H1", "H2", "H3", "H4", "H5", "H6",
  "BLOCKQUOTE", "FIGCAPTION",
  "DT", "DD", "TD", "TH",
  "SUMMARY", "CAPTION", "LEGEND",
]);

// ---- 译文插入方式 ----

/** 译文需插入为兄弟节点（而非子节点）的标签 */
export const INSERT_AFTER_TAGS = new Set([
  "P", "H1", "H2", "H3", "H4", "H5", "H6",
  "BLOCKQUOTE", "FIGCAPTION",
]);

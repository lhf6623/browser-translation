/**
 * 翻译节点操作抽象 — 只暴露语义化方法，不暴露 getAttribute / setAttribute。
 *
 * 属性维度：
 * - 状态：   `data-qt`       — 已处理
 * - 黑名单： `data-qt-bl`    — 翻译失败过的引擎（引擎全部拉黑即放弃）
 *
 * DOM 维度：
 * - 文本提取、字母段分割
 * - 加载动画（qt-loader）管理
 * - 译文插入（qt-trans）
 * - 视口可见性
 */

import { INSERT_AFTER_TAGS, CSS } from "./constants";
import { inView } from "./utils";

export class QtElement {
  constructor(readonly el: HTMLElement) {}

  // ====== 状态 ======

  /** 是否已标记为翻译完毕（或全部引擎翻译失败） */
  get done(): boolean {
    return this.el.hasAttribute("data-qt") || this.el.hasAttribute("data-qt-failed");
  }

  /** 是否属于译文包装元素（data-qt-trans） */
  get isTransWrapper(): boolean {
    return this.el.hasAttribute("data-qt-trans");
  }

  /** 标记为已处理，清除黑名单 */
  finish(): void {
    this.el.setAttribute("data-qt", "1");
    this.el.removeAttribute("data-qt-bl");
  }

  /** 标记为全部引擎翻译失败（区别于翻译成功的 data-qt） */
  markFailed(): void {
    this.el.setAttribute("data-qt-failed", "1");
  }

  /** 清除所有翻译属性（用于恢复原始状态） */
  clear(): void {
    this.el.removeAttribute("data-qt");
    this.el.removeAttribute("data-qt-failed");
    this.el.removeAttribute("data-qt-bl");
  }

  /** 批量清除页面上所有翻译痕迹（DOM 属性 + loader） */
  static cleanupAll(): void {
    document.querySelectorAll("[data-qt], [data-qt-failed], [data-qt-bl]").forEach((e) => {
      e.removeAttribute("data-qt");
      e.removeAttribute("data-qt-failed");
      e.removeAttribute("data-qt-bl");
    });
    document.querySelectorAll(`.${CSS.LOADER}`).forEach((e) => e.remove());
  }

  // ====== 文本 ======

  /** 去首尾空白的文本内容，空时返回 null */
  get sourceText(): string | null {
    const t = (this.el.textContent || "").trim();
    return t || null;
  }

  /**
   * 提取文本中的"字母段"以及前后缀。
   * 字母少于 2 个或无字母时返回 null，表示无需翻译。
   */
  extractCore(): { prefix: string; core: string; suffix: string } | null {
    const text = this.sourceText;
    if (!text) return null;
    const first = text.search(/[a-zA-Z]/);
    const last = text.search(/[a-zA-Z](?=[^a-zA-Z]*$)/);
    if (first === -1 || last - first < 1) return null;
    return {
      prefix: text.slice(0, first),
      core: text.slice(first, last + 1),
      suffix: text.slice(last + 1),
    };
  }

  // ====== 加载动画 ======

  /** 插入翻译中动画 span，返回它。已存在则先移除旧的 */
  showLoader(): HTMLElement {
    this.hideLoader();
    const span = document.createElement("span");
    span.className = `${CSS.LOADER} ${CSS.SKIP}`;
    this.el.appendChild(span);
    return span;
  }

  /** 移除所有加载动画 */
  hideLoader(): void {
    this.el.querySelectorAll(`.${CSS.LOADER}`).forEach((e) => e.remove());
  }

  // ====== 黑名单 ======

  /** 指定引擎是否已对该元素翻译失败 */
  isBlocked(engine: string): boolean {
    const v = this.el.getAttribute("data-qt-bl");
    return v ? v.split(",").includes(engine) : false;
  }

  /** 记录引擎翻译该元素失败 */
  addBlock(engine: string): void {
    const prev = this.el.getAttribute("data-qt-bl") || "";
    this.el.setAttribute("data-qt-bl", prev ? prev + "," + engine : engine);
  }

  // ====== 可见性 ======

  /** 是否在视口范围内 */
  get inView(): boolean {
    return inView(this.el);
  }

  // ====== 译文插入 ======

  /**
   * 标签类型是否要求译文插入为兄弟节点（如 P / H1~H6 等）。
   * 否则译文作为子节点 append。
   */
  get insertAfter(): boolean {
    return INSERT_AFTER_TAGS.has(this.el.tagName);
  }

  /**
   * 创建译文 span 并插入 DOM，返回该 span。
   * 调用方负责将 span 加入 state.translatedEls 跟踪列表。
   */
  insertTranslation(text: string): HTMLElement | null {
    try {
      if (this.done) return null;
      this.finish();

      const span = document.createElement("span");
      span.className = `${CSS.TRANS} ${CSS.SKIP}`;
      span.setAttribute("data-qt-trans", "1");
      span.textContent = text;

      if (this.insertAfter) {
        const parent = this.el.parentNode;
        if (!parent) return null;
        parent.insertBefore(span, this.el.nextSibling);
      } else {
        this.el.appendChild(span);
      }

      return span;
    } catch {
      return null;
    }
  }
}

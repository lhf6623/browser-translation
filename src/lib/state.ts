// ========== 全局状态 ==========

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

/** 扫描阶段取消标志、已翻译元素列表、翻译完成时间、翻译代数 */
export const state = {
  cancelled: false,
  translatedEls: [] as HTMLElement[],
  translatedAt: 0,
  /** 每次 translatePage() 调用递增，让旧的 worker/doBlocks 能识别自己是过期的会话 */
  generation: 0,
};

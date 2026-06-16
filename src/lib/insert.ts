// ========== 译文 DOM 移除 ==========

import { S, state } from "./core";
import { QtElement } from "./qtelement";

/** 移除所有已插入的译文，清空状态 */
export function removeAll(): void {
  S.set("");
  sessionStorage.removeItem("qt_auto");
  for (const e of state.translatedEls) {
    if (e.parentNode) e.parentNode.removeChild(e);
  }
  state.translatedEls = [];
  QtElement.cleanupAll();
}

// ========== 翻译清理 ==========

import { S, state } from "./state";
import { QtElement } from "./qtelement";

/** 移除所有译文 DOM、清空状态、清除翻译属性 */
export function removeAll(): void {
  S.set("");
  sessionStorage.removeItem("qt_auto");
  for (const e of state.translatedEls) {
    if (e.parentNode) e.parentNode.removeChild(e);
  }
  state.translatedEls = [];
  QtElement.cleanupAll();
}

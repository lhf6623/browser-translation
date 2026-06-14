// ========== 译文 DOM 插入与移除 ==========

import { S, state, INSERT_AFTER_TAGS } from "./core";

/** 在原文元素旁插入译文 */
export function insert(orig: HTMLElement, text: string): void {
  try {
    const ld = orig.querySelector(".qt-loader");
    if (ld) ld.remove();
    if (orig.hasAttribute("data-qt")) return;
    orig.setAttribute("data-qt", "1");
    const el = document.createElement("span");
    el.className = "qt-trans qt-skip";
    el.setAttribute("data-qt-trans", "1");
    el.textContent = text;
    if (INSERT_AFTER_TAGS.has(orig.tagName)) {
      orig.parentNode!.insertBefore(el, orig.nextSibling);
    } else {
      orig.appendChild(el);
    }
    state.translatedEls.push(el);
  } catch {
    /* ignore */
  }
}

/** 移除所有已插入的译文，清空状态 */
export function removeAll(): void {
  S.set("");
  sessionStorage.removeItem("qt_auto");
  for (const e of state.translatedEls) {
    if (e.parentNode) e.parentNode.removeChild(e);
  }
  state.translatedEls = [];
  document.querySelectorAll("[data-qt], [data-qt-retry]").forEach((e) => {
    e.removeAttribute("data-qt");
    e.removeAttribute("data-qt-retry");
  });
  document.querySelectorAll(".qt-loader").forEach((e) => e.remove());
}

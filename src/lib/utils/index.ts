// ========== 工具函数 ==========

import { VIEWPORT_MARGIN } from "../constants";

/** 异步延迟 */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 给 Promise 加超时，超时后 reject */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms),
    ),
  ]);
}

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

/** 去除 HTML 标签 */
export function cleanHtml(s: string): string {
  return s.replace(/<\/?[a-zA-Z][^>]*>/g, "");
}

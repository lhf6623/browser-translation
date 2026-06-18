// ========== DOM 工具函数 ==========

/** 元素是否有直接文本子节点 */
export function hasDirect(el: Element): boolean {
  for (const c of el.childNodes) {
    if (c.nodeType === 3 && c.textContent?.trim()) return true;
  }
  return false;
}

/** 元素所有直接文本子节点的拼接文本 */
export function directText(el: Element): string {
  let t = "";
  for (const c of el.childNodes) {
    if (c.nodeType === 3) t += c.textContent || "";
  }
  return t;
}

/** 元素是否可见（非 display:none / visibility:hidden / opacity:0，且尺寸不太小） */
export function visible(el: Element): boolean {
  const s = getComputedStyle(el);
  if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0") return false;
  const r = el.getBoundingClientRect();
  const fontSize = parseFloat(s.fontSize) || 16;
  if (r.height < fontSize * 0.4 || r.width < fontSize * 0.5) return false;
  return true;
}

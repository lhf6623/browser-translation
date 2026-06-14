// ========== DOM 文本块扫描 ==========

import { SKIP_TAGS, SCAN_UNIT_TAGS, MIN_TEXT_LEN, VIEWPORT_MARGIN } from "./core";

/** 扫描页面中所有可翻译的文本块 DOM 元素 */
export function findBlocks(): HTMLElement[] {
  const blocks: HTMLElement[] = [];
  const seen = new WeakSet<Element>();
  const root = document.body;

  function walk(node: Element) {
    if (node.nodeType !== 1) return;
    if (SKIP_TAGS.has(node.tagName)) return;
    if (node.hasAttribute("data-qt") || node.hasAttribute("data-qt-trans")) return;
    if (node.classList?.contains("qt-skip")) return;

    if (SCAN_UNIT_TAGS.has(node.tagName)) {
      const t = node.textContent?.trim() || "";
      if ([...t].length >= MIN_TEXT_LEN && visible(node)) {
        blocks.push(node as HTMLElement);
        seen.add(node);
      }
      return;
    }
    if (hasDirect(node) && !hasBlockKids(node) && visible(node)) {
      const t = directText(node).trim();
      if ([...t].length >= MIN_TEXT_LEN) {
        blocks.push(node as HTMLElement);
        seen.add(node);
        return;
      }
    }
    for (const c of node.children) {
      if (!seen.has(c)) walk(c);
    }
  }

  walk(root);
  return blocks;
}

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

/** 元素是否包含块级翻译单元子节点 */
export function hasBlockKids(el: Element): boolean {
  for (const t of SCAN_UNIT_TAGS) {
    if (el.querySelector(t.toLowerCase())) return true;
  }
  return false;
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


// ========== DOM 文本块扫描 ==========

import { SKIP_TAGS, SCAN_UNIT_TAGS, MIN_TEXT_LEN, CSS } from "./core";
import { QtElement } from "./qtelement";

/** hasBlockKids 用到的选择器缓存 */
const SCAN_UNIT_SELECTOR = Array.from(SCAN_UNIT_TAGS)
  .map((t) => t.toLowerCase())
  .join(",");

/** 扫描页面中所有可翻译的文本块 DOM 元素（迭代栈，避免深层 DOM 栈溢出） */
export function findBlocks(): HTMLElement[] {
  const blocks: HTMLElement[] = [];
  const seen = new WeakSet<Element>();
  const stack: Element[] = [document.body];

  while (stack.length) {
    const node = stack.pop()!;

    if (node.nodeType !== 1) continue;
    if (SKIP_TAGS.has(node.tagName)) continue;
    if (node.classList?.contains(CSS.SKIP)) continue;

    const qel = new QtElement(node as HTMLElement);
    if (qel.done || qel.isTransWrapper) continue;

    if (SCAN_UNIT_TAGS.has(node.tagName)) {
      const t = node.textContent?.trim() || "";
      if ([...t].length >= MIN_TEXT_LEN && visible(node)) {
        blocks.push(node as HTMLElement);
        seen.add(node);
      }
      continue;
    }

    if (hasDirect(node) && !hasBlockKids(node) && visible(node)) {
      const t = directText(node).trim();
      if ([...t].length >= MIN_TEXT_LEN) {
        blocks.push(node as HTMLElement);
        seen.add(node);
        continue;
      }
    }

    // 子节点反向入栈以保持原遍历顺序
    for (let i = node.children.length - 1; i >= 0; i--) {
      const c = node.children[i];
      if (!seen.has(c)) stack.push(c);
    }
  }

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
  return el.querySelector(SCAN_UNIT_SELECTOR) !== null;
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


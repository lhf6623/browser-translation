// ========== 快捷翻译 - 文本块扫描 ==========

function findBlocks() {
  const blocks = [];
  const seen = new WeakSet();
  const root = document.body;

  function walk(node) {
    if (node.nodeType !== 1) return;
    if (SKIP_TAGS.has(node.tagName)) return;
    if (node.hasAttribute('data-qt') || node.hasAttribute('data-qt-trans')) return;
    if (node.classList?.contains('qt-skip')) return;

    if (BLOCK_TAGS.has(node.tagName)) {
      const t = node.textContent.trim();
      if ([...t].length >= MIN_TEXT_LEN && visible(node)) { blocks.push(node); seen.add(node); }
      return;
    }
    if (hasDirect(node) && !hasBlockKids(node) && visible(node)) {
      const t = directText(node).trim();
      if ([...t].length >= MIN_TEXT_LEN) { blocks.push(node); seen.add(node); return; }
    }
    for (const c of node.children) { if (!seen.has(c)) walk(c); }
  }

  walk(root);
  return blocks;
}

function hasDirect(el) {
  for (const c of el.childNodes) { if (c.nodeType === 3 && c.textContent.trim()) return true; }
  return false;
}

function directText(el) {
  let t = '';
  for (const c of el.childNodes) { if (c.nodeType === 3) t += c.textContent; }
  return t;
}

function hasBlockKids(el) {
  for (const t of BLOCK_TAGS) { if (el.querySelector(t.toLowerCase())) return true; }
  return false;
}

function visible(el) {
  const s = getComputedStyle(el);
  if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
  const r = el.getBoundingClientRect();
  const fontSize = parseFloat(s.fontSize) || 16;
  if (r.height < fontSize * 0.4 || r.width < fontSize * 0.5) return false;
  return true;
}

// ========== 视口 ==========

function inView(el) {
  const r = el.getBoundingClientRect();
  const wh = window.innerHeight || document.documentElement.clientHeight;
  const ww = window.innerWidth || document.documentElement.clientWidth;
  return r.top < wh + VIEWPORT_MARGIN && r.bottom > -VIEWPORT_MARGIN && r.left < ww && r.right > 0;
}

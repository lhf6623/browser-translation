// ========== 快捷翻译 Content Script ==========

// 状态
let isPageTranslated = false;
let isTranslating = false;
let cancelled = false;
let translatedEls = [];
let visibilityObs = null;

// 内存缓存
const cache = new Map();

// 配置
const MAX_CONCURRENT = 3;
const DELAY_MS = 200;
const MAX_TEXT_LEN = 800;
const MIN_TEXT_LEN = 2;
const VIEWPORT_MARGIN = 300;

const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'CODE', 'PRE',
  'TEXTAREA', 'INPUT', 'IFRAME', 'CANVAS', 'VIDEO', 'AUDIO',
]);
const BLOCK_TAGS = new Set([
  'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'LI', 'BLOCKQUOTE', 'FIGCAPTION', 'DT', 'DD', 'TD', 'TH',
]);
// 不再跳过任何区域

// ========== 消息 ==========

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'toggleTranslation') {
    toggle();
    sendResponse({ ok: true });
  }
});

async function toggle() {
  if (isPageTranslated) { removeAll(); isPageTranslated = false; return; }
  if (isTranslating) { cancelled = true; return; }
  await translatePage();
}

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
  if (isTranslating) { cancelled = true; }
  else if (isPageTranslated) { removeAll(); isPageTranslated = false; }
});

// ========== 翻译 ==========

async function translatePage() {
  isTranslating = true;
  cancelled = false;
  translatedEls = [];
  if (visibilityObs) { visibilityObs.disconnect(); visibilityObs = null; }

  const all = findBlocks();
  if (!all.length) { isTranslating = false; return; }

  const visible = [], hidden = [];
  for (const b of all) {
    if (inView(b)) visible.push(b); else hidden.push(b);
  }

  const bar = progressBar();
  document.body.appendChild(bar);

  await doBlocks(visible, (done, total) => {
    bar.querySelector('.qt-progress-fill').style.width = Math.round(done / total * 100) + '%';
    bar.querySelector('.qt-progress-text').textContent = `翻译中... ${done}/${total}`;
  });

  bar.remove();

  if (cancelled) { removeAll(); isPageTranslated = false; }
  else {
    isPageTranslated = true;
    if (hidden.length) setupObserver(hidden);
  }
  isTranslating = false;
}

async function doBlocks(blocks, onProgress) {
  const queue = [...blocks];
  let done = 0;
  const total = blocks.length;

  async function worker() {
    while (queue.length && !cancelled) {
      const el = queue.shift();
      await sleep(DELAY_MS);
      if (cancelled) break;
      try {
        const text = (el.textContent || '').trim().slice(0, MAX_TEXT_LEN);
        if (!text) { done++; onProgress(done, total); continue; }

        const result = await translateText(text);
        if (!cancelled) insert(el, result);
      } catch { /* 跳过 */ }
      done++;
      onProgress(done, total);
    }
  }

  const wc = Math.min(MAX_CONCURRENT, blocks.length);
  await Promise.all(Array.from({ length: wc }, () => worker()));
}

// ========== 翻译 API + 缓存 ==========

async function translateText(text) {
  if (cache.has(text)) return cache.get(text);
  const tr = await fetchTranslation(text);
  cache.set(text, tr);
  return tr;
}

async function fetchTranslation(text) {
  // 测试模式：所有翻译返回固定文本
  return '测试文本---';
}

// ========== 文本块识别 ==========

function findBlocks() {
  const blocks = [];
  const seen = new WeakSet();
  const root = findRoot();

  function walk(node) {
    if (node.nodeType !== 1) return;
    if (SKIP_TAGS.has(node.tagName)) return;

    if (BLOCK_TAGS.has(node.tagName)) {
      const t = node.textContent.trim();
      if ([...t].length >= MIN_TEXT_LEN && visible(node)) { blocks.push(node); seen.add(node); }
      return;
    }
    if (hasDirect(node) && !hasBlockKids(node) && visible(node)) {
      const t = directText(node).trim();
      if ([...t].length >= 3) { blocks.push(node); seen.add(node); return; }
    }
    for (const c of node.children) { if (!seen.has(c)) walk(c); }
  }

  walk(root);
  return blocks;
}

function findRoot() {
  for (const s of ['article', 'main', '[role="main"]', '.content', '.post-content', '#content', '#main']) {
    const el = document.querySelector(s);
    if (el && el.textContent.trim().length > 100) return el;
  }
  return document.body;
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

function setupObserver(hidden) {
  const pending = new Set(hidden);
  visibilityObs = new IntersectionObserver((entries) => {
    const nv = [];
    for (const e of entries) {
      if (e.isIntersecting && pending.has(e.target)) {
        nv.push(e.target);
        pending.delete(e.target);
        visibilityObs.unobserve(e.target);
      }
    }
    if (nv.length && isPageTranslated && !isTranslating) {
      doBlocks(nv, () => {});
    }
  }, { rootMargin: `${VIEWPORT_MARGIN}px` });

  for (const b of hidden) {
    if (!b.isConnected || b.hasAttribute('data-qt')) continue;
    try { visibilityObs.observe(b); } catch { /* */ }
  }
}

// ========== 插入译文 ==========

function insert(orig, text) {
  try {
    if (orig.hasAttribute('data-qt')) return;
    orig.setAttribute('data-qt', '1');
    const block = isBlock(orig);
    const el = document.createElement(block ? 'div' : 'span');
    el.className = block ? 'qt-page-trans-block' : 'qt-page-trans-inline';
    el.setAttribute('data-qt-trans', '1');
    el.textContent = text;
    orig.parentNode.insertBefore(el, orig.nextSibling);
    translatedEls.push(el);
  } catch { /* */ }
}

function isBlock(el) {
  const il = new Set(['SPAN','A','EM','STRONG','I','B','U','S','MARK','SMALL','SUB','SUP','CODE','ABBR','LABEL','TIME','CITE']);
  if (il.has(el.tagName)) return false;
  return !getComputedStyle(el).display.startsWith('inline');
}

function removeAll() {
  if (visibilityObs) { visibilityObs.disconnect(); visibilityObs = null; }
  for (const e of translatedEls) { if (e.parentNode) e.parentNode.removeChild(e); }
  translatedEls = [];
  document.querySelectorAll('[data-qt]').forEach(e => e.removeAttribute('data-qt'));
}

// ========== 工具 ==========

function progressBar() {
  const b = document.createElement('div');
  b.className = 'qt-progress-bar';
  b.innerHTML = '<div class="qt-progress-fill"></div><span class="qt-progress-text">翻译中...</span>';
  return b;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

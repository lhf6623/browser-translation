// ========== 快捷翻译 - 主逻辑 ==========

// ===== 滚动 / 缩放 补译 =====

let resizeTimer = null;
let scrollTimer = null;
let translatedAt = 0;

// 同域名下跨页面自动续翻（sessionStorage：关闭标签页自动清除）
(async () => {
  if (sessionStorage.getItem('qt_auto') === location.hostname) {
    await translatePage();
  }
})();

function scanAndTranslate() {
  if (!S.translated() || S.translating()) return;
  const all = findBlocks();
  const fresh = all.filter(b => !b.hasAttribute('data-qt') && inView(b));
  if (!fresh.length) return;
  S.set('translating');
  doBlocks(fresh).then(() => {
    S.set('translated');
    setTimeout(scanAndTranslate, 100);
  });
}

window.addEventListener('resize', () => {
  if (Date.now() - translatedAt < 1000) return;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(scanAndTranslate, 300);
});

window.addEventListener('scroll', () => {
  if (Date.now() - translatedAt < 1000) return;
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(scanAndTranslate, 300);
}, { passive: true });

// ===== 消息 =====

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'toggleTranslation') {
    toggle();
    sendResponse({ ok: true });
  }
  if (msg.action === 'clearCache') {
    memCache.clear();
    sendResponse({ ok: true });
  }
});

async function toggle() {
  if (S.translated()) { removeAll(); return; }
  if (S.translating()) { cancelled = true; return; }
  await translatePage();
}

// ===== 翻译流程 =====

async function translatePage() {
  S.set('translating');
  cancelled = false;
  translatedEls = [];
  sessionStorage.setItem('qt_auto', location.hostname);

  const all = findBlocks();
  if (!all.length) { S.set(''); return; }

  const visible = [];
  for (const b of all) {
    if (inView(b)) visible.push(b);
  }

  if (visible.length) await doBlocks(visible);

  if (cancelled) { removeAll(); }
  else {
    S.set('translated');
    translatedAt = Date.now();
    if (all.length > visible.length) setTimeout(scanAndTranslate, 100);
  }
}

async function doBlocks(blocks) {
  const queue = [...blocks];

  while (queue.length && !cancelled) {
    let eng;
    while (!(eng = pickEngine())) {
      if (cancelled) return;
      await sleep(100);
    }
    eng.busy = true;
    eng.lastCall = Date.now();

    const el = queue.shift();
    if (cancelled) { eng.busy = false; return; }
    if (el.hasAttribute('data-qt')) { eng.busy = false; continue; }

    if (!inView(el)) { eng.busy = false; continue; }

    try {
      let text = (el.textContent || '').trim().slice(0, MAX_TEXT_LEN);
      if (!text) { el.setAttribute('data-qt', '1'); eng.busy = false; continue; }

      const firstAlpha = text.search(/[a-zA-Z]/);
      const lastAlpha = text.search(/[a-zA-Z](?=[^a-zA-Z]*$)/);
      if (firstAlpha === -1 || lastAlpha - firstAlpha < 1) { el.setAttribute('data-qt', '1'); eng.busy = false; continue; }

      const prefix = text.slice(0, firstAlpha);
      const core = text.slice(firstAlpha, lastAlpha + 1);
      const suffix = text.slice(lastAlpha + 1);

      const loader = document.createElement('span');
      loader.className = 'qt-loader qt-skip';
      el.appendChild(loader);

      const result = await translateText(core, eng);
      loader.remove();
      eng.busy = false;
      eng.lastCall = Date.now();

      if (cancelled) return;

      if (result) {
        insert(el, prefix + result + suffix);
      } else {
        queue.push(el);
      }
    } catch {
      eng.busy = false;
      eng.lastCall = Date.now();
      queue.push(el);
    }
  }
}

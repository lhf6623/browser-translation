// ========== 快捷翻译 - 译文插入与移除 ==========

function insert(orig, text) {
  try {
    const ld = orig.querySelector('.qt-loader');
    if (ld) ld.remove();
    if (orig.hasAttribute('data-qt')) return;
    orig.setAttribute('data-qt', '1');
    const el = document.createElement('span');
    el.className = 'qt-trans qt-skip';
    el.setAttribute('data-qt-trans', '1');
    el.textContent = text;
    orig.parentNode.insertBefore(el, orig.nextSibling);
    translatedEls.push(el);
  } catch { /* */ }
}

function removeAll() {
  S.set('');
  sessionStorage.removeItem('qt_auto');
  for (const e of translatedEls) { if (e.parentNode) e.parentNode.removeChild(e); }
  translatedEls = [];
  document.querySelectorAll('[data-qt], [data-qt-retry]').forEach(e => { e.removeAttribute('data-qt'); e.removeAttribute('data-qt-retry'); });
  document.querySelectorAll('.qt-loader').forEach(e => e.remove());
}

// ========== 快捷翻译 - 调度核心 ==========

function cleanHtml(s) {
  return s.replace(/<\/?[a-zA-Z][^>]*>/g, '');
}

function hashKey(s) {
  let h1 = 0, h2 = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = ((h1 << 5) - h1 + c) | 0;
    h2 = ((h2 << 7) - h2 + c) | 0;
  }
  return 'qt_' + (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}

async function translateText(text, engineObj) {
  const key = hashKey(text);
  if (memCache.has(key)) { dbgLog('', text, false, true); return memCache.get(key); }
  const stored = await chrome.storage.local.get(key);
  if (stored[key]) { memCache.set(key, stored[key]); dbgLog('', text, false, true); return stored[key]; }

  const t0 = Date.now();
  const fn = engineObj.name === 'GT' ? tryGoogleTranslate
           : engineObj.name === 'BD' ? tryBaiduTranslate
           : engineObj.name === 'YD' ? tryYoudaoTranslate
           : engineObj.name === 'TX' ? tryTencentTranslate
           : tryMyMemory;
  const r = await fn(text);
  const ms = Date.now() - t0;
  engineObj.sumMs += ms;
  engineObj.calls++;

  if (r.result) {
    const cleaned = cleanHtml(r.result);
    memCache.set(key, cleaned);
    chrome.storage.local.set({ [key]: cleaned }).catch(() => {});
    dbgLog(engineObj.name, text, false, false);
    return cleaned;
  }
  if (r.rateLimited) {
    engineObj.rateLimitUntil = Date.now() + 60000;
    engineObj.errors++;
  } else {
    engineObj.errors++;
  }
  return null;
}

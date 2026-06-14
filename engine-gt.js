// ========== Google 翻译引擎 ==========

async function tryGoogleTranslate(text) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);

    if (res.status === 403 || res.status === 429) return { result: null, rateLimited: true };
    if (!res.ok) return { result: null, rateLimited: false };

    const data = await res.json();
    if (data?.[0]) {
      const segments = data[0]
        .filter(s => s?.[0])
        .map(s => s[0])
        .join('');
      if (segments) return { result: segments, rateLimited: false };
    }
    return { result: null, rateLimited: false };
  } catch {
    return { result: null, rateLimited: false };
  }
}

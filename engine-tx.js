// ========== 腾讯翻译引擎 ==========

async function tryTencentTranslate(text) {
  try {
    const res = await chrome.runtime.sendMessage({
      action: 'fetchTencent',
      q: text,
      secretId: TX_SECRET_ID,
      secretKey: TX_SECRET_KEY,
    });
    if (!res || !res.ok) return { result: null, rateLimited: false };

    const r = res.data.Response;
    if (r.Error) {
      if (r.Error.Code === 'LimitExceeded' || r.Error.Code === 'RequestLimitExceeded') {
        return { result: null, rateLimited: true };
      }
      return { result: null, rateLimited: false };
    }
    if (r.TargetText) return { result: r.TargetText, rateLimited: false };
    return { result: null, rateLimited: false };
  } catch {
    return { result: null, rateLimited: false };
  }
}

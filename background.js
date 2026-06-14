// ========== 快捷翻译 Background Service Worker ==========

let lastToggle = 0;

// 快捷键 → 通知 content script
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'translate') {
    const now = Date.now();
    if (now - lastToggle < 500) return;
    lastToggle = now;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) return;

    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'toggleTranslation' });
    } catch {
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content-core.js', 'config.js', 'content-debug.js', 'engine-mm.js', 'engine-gt.js', 'engine-bd.js', 'engine-yd.js', 'engine-tx.js', 'content-translate.js', 'content-scanner.js', 'content-insert.js', 'content.js'] });
        await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['styles.css'] });
        await chrome.tabs.sendMessage(tab.id, { action: 'toggleTranslation' });
      } catch { /* 受限页面 */ }
    }
  }
});

// ===== CORS 代理 =====

const PROXY_TIMEOUT = 8000;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'fetchBaidu') {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PROXY_TIMEOUT);
    fetch(msg.url, { signal: ctrl.signal })
      .then(async (res) => { clearTimeout(timer); sendResponse({ ok: res.ok, status: res.status, data: await res.json() }); })
      .catch(err => { clearTimeout(timer); sendResponse({ ok: false, error: err.message }); });
    return true;
  }

  if (msg.action === 'fetchYoudao') {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PROXY_TIMEOUT);
    fetch('https://openapi.youdao.com/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(msg.params).toString(),
      signal: ctrl.signal,
    })
      .then(async (res) => { clearTimeout(timer); sendResponse({ ok: res.ok, status: res.status, data: await res.json() }); })
      .catch(err => { clearTimeout(timer); sendResponse({ ok: false, error: err.message }); });
    return true;
  }

  if (msg.action === 'fetchTencent') {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PROXY_TIMEOUT);
    doTencent(msg.q, msg.secretId, msg.secretKey, ctrl.signal)
      .then(r => { clearTimeout(timer); sendResponse(r); })
      .catch(err => { clearTimeout(timer); sendResponse({ ok: false, error: err.message }); });
    return true;
  }
});

// ===== 腾讯云 TC3 签名 =====

async function hex256(s) {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmac256(key, msg) {
  const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? new TextEncoder().encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return new Uint8Array(sig);
}

async function hmac256hex(key, msg) {
  const sig = await hmac256(key, msg);
  return Array.from(sig).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function doTencent(text, secretId, secretKey, signal) {
  const host = 'tmt.tencentcloudapi.com';
  const service = 'tmt';
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

  const payload = JSON.stringify({ SourceText: text, Source: 'en', Target: 'zh', ProjectId: 0 });
  const hp = await hex256(payload);
  const ch = `content-type:application/json\nhost:${host}\n`;
  const cr = `POST\n/\n\n${ch}content-type;host\n${hp}`;
  const hr = await hex256(cr);
  const cs = `${date}/${service}/tc3_request`;
  const sts = `TC3-HMAC-SHA256\n${timestamp}\n${cs}\n${hr}`;

  const sd = await hmac256('TC3' + secretKey, date);
  const ss = await hmac256(sd, service);
  const ssk = await hmac256(ss, 'tc3_request');
  const sig = await hmac256hex(ssk, sts);
  const auth = `TC3-HMAC-SHA256 Credential=${secretId}/${cs}, SignedHeaders=content-type;host, Signature=${sig}`;

  const res = await fetch(`https://${host}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Host': host,
      'X-TC-Action': 'TextTranslate',
      'X-TC-Version': '2018-03-21',
      'X-TC-Region': 'ap-guangzhou',
      'X-TC-Timestamp': String(timestamp),
      'Authorization': auth,
    },
    body: payload,
    signal,
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

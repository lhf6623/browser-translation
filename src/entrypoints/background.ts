// ========== 快捷翻译 Background Service Worker ==========

import { browser } from "wxt/browser";

export default defineBackground(() => {
  let lastToggle = 0;

  // ---- 快捷键 → 通知 content script ----

  browser.commands.onCommand.addListener(async (command) => {
    if (command !== "translate") return;

    const now = Date.now();
    if (now - lastToggle < 500) return;
    lastToggle = now;

    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    if (
      !tab.url ||
      tab.url.startsWith("chrome://") ||
      tab.url.startsWith("chrome-extension://") ||
      tab.url.startsWith("about:")
    )
      return;

    try {
      await browser.tabs.sendMessage(tab.id, { action: "toggleTranslation" });
    } catch {
      // 页面未注入 content script，动态注入
      try {
        // 兼容 MV2 (Firefox) 和 MV3 (Chrome) 的动态注入
        if (browser.scripting) {
          await browser.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["/content-scripts/content.js"],
          });
          await browser.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ["/content-scripts/content.css"],
          });
        } else {
          // Firefox MV2 fallback
          await browser.tabs.executeScript(tab.id, {
            file: "/content-scripts/content.js",
          });
          await browser.tabs.insertCSS(tab.id, {
            file: "/content-scripts/content.css",
          });
        }
        await browser.tabs.sendMessage(tab.id, { action: "toggleTranslation" });
      } catch {
        /* 受限页面 */
      }
    }
  });

  // ===========================
  // 通用 CORS 代理
  // ===========================
  // 所有引擎的 HTTP 请求统一在此发起。
  // content script 不直接 fetch，只管拼请求参数（URL/方法/头/体），
  // 签名逻辑也在 content script 侧完成（crypto.subtle 在 isolated world 可用）。

  const PROXY_TIMEOUT = 8000;
  const activeControllers = new Set<AbortController>();

  /** 通用代理 fetch：发请求 + 解析 JSON，返回统一格式 */
  async function proxyFetch(
    url: string,
    init: RequestInit,
    signal: AbortSignal,
  ): Promise<{ ok: boolean; status: number; data: unknown }> {
    const res = await fetch(url, { ...init, signal });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  }

  /** 包装代理任务：AbortController + 超时，完成后自动注销 */
  function runProxy<T>(
    task: (signal: AbortSignal) => Promise<T>,
    sendResponse: (r: T | { ok: false; error: string }) => void,
  ) {
    const ctrl = new AbortController();
    activeControllers.add(ctrl);
    const timer = setTimeout(() => ctrl.abort(), PROXY_TIMEOUT);
    task(ctrl.signal)
      .then((r) => sendResponse(r))
      .catch((err) =>
        sendResponse({ ok: false, error: (err as Error).message }),
      )
      .finally(() => {
        clearTimeout(timer);
        activeControllers.delete(ctrl);
      });
  }

  // 消息路由：按 _type 区分代理请求和取消信号
  browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    const m = msg as { _type: string; url?: string; method?: string; headers?: Record<string, string>; body?: string };
    if (m._type === "abort") {
      for (const ctrl of activeControllers) ctrl.abort();
      activeControllers.clear();
      return;
    }
    if (m._type !== "proxy") return;
    const { url, method, headers, body } = m;
    if (!url) return;

    runProxy(
      (signal) => proxyFetch(url, { method, headers, body }, signal),
      sendResponse,
    );
    return true;
  });
});

// ========== 快捷翻译 Content Script ==========
// 入口：自动翻译 / 快捷键切换 / 滚动补译

import { browser } from "wxt/browser";
import { S, state } from "@/lib/state";
import { memCache } from "@/lib/utils/cache";
import { findBlocks } from "@/lib/scanner";
import { doBlocks } from "@/lib/translator";
import { QtElement } from "@/lib/qtelement";
import { removeAll } from "@/lib/cleanup";
import { initDebug } from "@/lib/debug";
initDebug();
import "./styles.css";

export default defineContentScript({
  matches: ["<all_urls>"],

  main() {
    // ==========================================
    // 同域名跨页面自动续翻
    // ==========================================

    if (sessionStorage.getItem("qt_auto") === location.hostname) {
      translatePage();
    }

    // ==========================================
    // 滚动 / 缩放补译
    // ==========================================

    async function scanAndTranslate() {
      if (!S.translated() || S.translating()) return;
      const all = findBlocks();
      const fresh = all.filter((b) => {
        const qel = new QtElement(b);
        return !qel.done && qel.inView;
      });
      if (!fresh.length) return;
      const gen = ++state.generation;
      S.set("translating");
      try {
        await doBlocks(fresh);
        if (state.generation !== gen) return;
        if (state.cancelled) {
          removeAll();
          return;
        }
      } catch {
        // doBlocks 内部若出现未预期异常，确保状态不锁死
      } finally {
        // 无论成功、取消、异常，都要恢复到 translated 状态
        if (state.generation === gen && !state.cancelled) {
          S.set("translated");
          // 翻译完立即再扫一次，漏掉的内容（翻译期间滚入视口的）会被补上
          scanAndTranslate();
        }
      }
    }

    // 滚动 / 缩放事件防抖，翻译中则重试等待
    function scheduleScan(timerRef: {
      current: ReturnType<typeof setTimeout> | null;
    }): void {
      if (Date.now() - state.translatedAt < 1000) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      const tryScan = () => {
        if (S.translating()) {
          timerRef.current = setTimeout(tryScan, 200);
          return;
        }
        scanAndTranslate();
      };
      timerRef.current = setTimeout(tryScan, 300);
    }

    const scrollTimer = { current: null as ReturnType<typeof setTimeout> | null };
    const resizeTimer = { current: null as ReturnType<typeof setTimeout> | null };

    window.addEventListener("resize", () => scheduleScan(resizeTimer));
    // capture: true 捕获页面内任意元素的滚动（scroll 事件不冒泡）
    document.addEventListener("scroll", () => scheduleScan(scrollTimer), { passive: true, capture: true });

    // ==========================================
    // 消息：快捷键切换 / 清缓存
    // ==========================================

    browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg.action === "toggleTranslation") {
        toggle();
        sendResponse({ ok: true });
      }
      if (msg.action === "clearCache") {
        memCache.clear();
        sendResponse({ ok: true });
      }
    });

    // ==========================================
    // 翻译流程
    // ==========================================

    let _toggleTs = 0;

    async function toggle() {
      // 防连按：距上次操作不足 300ms 直接忽略
      const now = Date.now();
      if (now - _toggleTs < 300) return;
      _toggleTs = now;

      if (S.translated()) {
        removeAll();
        return;
      }
      if (S.translating()) {
        state.cancelled = true;
        browser.runtime.sendMessage({ _type: "abort" as const }).catch(() => {});
        removeAll();
        return;
      }
      await translatePage();
    }

    async function translatePage() {
      const gen = ++state.generation;
      S.set("translating");
      state.cancelled = false;
      state.translatedEls = [];

      const all = findBlocks();
      if (!all.length) {
        S.set("");
        return;
      }

      if (state.generation !== gen) return;

      const visible: HTMLElement[] = [];
      for (const b of all) {
        const qel = new QtElement(b);
        if (qel.inView) visible.push(b);
      }

      try {
        if (visible.length) await doBlocks(visible);

        // 会话已被取代或取消 → 不写入状态
        if (state.generation !== gen) return;
        if (state.cancelled) {
          removeAll();
          return;
        }
      } catch {
        // 异常兜底，确保状态不锁死
        if (state.generation !== gen) return;
      }

      S.set("translated");
      state.translatedAt = Date.now();
      // 翻译真正完成后才记 sessionStorage，刷新 / 翻页后自动续翻
      sessionStorage.setItem("qt_auto", location.hostname);
      // 无论是否有不可见元素都补扫一次：可见元素也可能因引擎拉黑被丢弃，需重拾
      setTimeout(scanAndTranslate, 100);
    }
  },
});

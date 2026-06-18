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

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;

    function scanAndTranslate() {
      if (!S.translated() || S.translating()) return;
      const all = findBlocks();
      const fresh = all.filter((b) => {
        const qel = new QtElement(b);
        return !qel.done && qel.inView;
      });
      if (!fresh.length) return;
      const gen = ++state.generation;
      S.set("translating");
      doBlocks(fresh).then(() => {
        if (state.generation !== gen) return;
        if (state.cancelled) return;
        S.set("translated");
        setTimeout(scanAndTranslate, 100);
      });
    }

    window.addEventListener("resize", () => {
      if (Date.now() - state.translatedAt < 1000) return;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(scanAndTranslate, 300);
    });

    window.addEventListener(
      "scroll",
      () => {
        if (Date.now() - state.translatedAt < 1000) return;
        if (scrollTimer) clearTimeout(scrollTimer);
        scrollTimer = setTimeout(scanAndTranslate, 300);
      },
      { passive: true },
    );

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

      if (visible.length) await doBlocks(visible);

      // 会话已被取代或取消 → 不写入状态
      if (state.generation !== gen) return;
      if (state.cancelled) {
        removeAll();
      } else {
        S.set("translated");
        state.translatedAt = Date.now();
        // 翻译真正完成后才记 sessionStorage，刷新 / 翻页后自动续翻
        sessionStorage.setItem("qt_auto", location.hostname);
        if (all.length > visible.length) setTimeout(scanAndTranslate, 100);
      }
    }
  },
});

// ========== 快捷翻译 Content Script ==========
// 入口：自动翻译 / 快捷键切换 / 滚动补译

import { browser } from "wxt/browser";
import { S, state } from "@/lib/core";
import { memCache } from "@/lib/core";
import { findBlocks, inView } from "@/lib/scanner";
import { doBlocks } from "@/lib/translator";
import { removeAll } from "@/lib/insert";
import "@/lib/debug"; // 初始化调试面板
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
      const fresh = all.filter(
        (b) => !b.hasAttribute("data-qt") && inView(b),
      );
      if (!fresh.length) return;
      S.set("translating");
      doBlocks(fresh).then(() => {
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

    async function toggle() {
      if (S.translated()) {
        removeAll();
        return;
      }
      if (S.translating()) {
        state.cancelled = true;
        return;
      }
      await translatePage();
    }

    async function translatePage() {
      S.set("translating");
      state.cancelled = false;
      state.translatedEls = [];
      sessionStorage.setItem("qt_auto", location.hostname);

      const all = findBlocks();
      if (!all.length) {
        S.set("");
        return;
      }

      const visible: HTMLElement[] = [];
      for (const b of all) {
        if (inView(b)) visible.push(b);
      }

      if (visible.length) await doBlocks(visible);

      if (state.cancelled) {
        removeAll();
      } else {
        S.set("translated");
        state.translatedAt = Date.now();
        if (all.length > visible.length) setTimeout(scanAndTranslate, 100);
      }
    }
  },
});

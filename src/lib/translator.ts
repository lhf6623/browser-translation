// ========== 翻译调度核心 ==========

import { browser } from "wxt/browser";
import type { EngineState } from "./engines/types";
import { getTranslateFn } from "./engines/registry";
import {
  state,
  memCache,
  MAX_TEXT_LEN,
  sleep,
  engines,
  pickEngine,
  S,
} from "./core";
import { inView } from "./scanner";
import { insert } from "./insert";
import { dbgLog } from "./debug";

// ---- 工具 ----

function cleanHtml(s: string): string {
  return s.replace(/<\/?[a-zA-Z][^>]*>/g, "");
}

function hashKey(s: string): string {
  let h1 = 0,
    h2 = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = ((h1 << 5) - h1 + c) | 0;
    h2 = ((h2 << 7) - h2 + c) | 0;
  }
  return "qt_" + (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}

// ---- 单条文本翻译 ----

async function translateText(
  text: string,
  engineObj: EngineState,
): Promise<string | null> {
  const key = hashKey(text);

  // 查内存缓存
  if (memCache.has(key)) {
    dbgLog("", text, false, true);
    return memCache.get(key)!;
  }

  // 查持久缓存
  const stored = await browser.storage.local.get(key);
  const cached = stored[key] as string | undefined;
  if (cached) {
    memCache.set(key, cached);
    dbgLog("", text, false, true);
    return cached;
  }

  // 调用引擎
  const t0 = Date.now();
  const fn = getTranslateFn(engineObj.name);
  const r = await fn(text);
  const ms = Date.now() - t0;
  engineObj.sumMs += ms;
  engineObj.calls++;

  if (r.result) {
    const cleaned = cleanHtml(r.result);
    memCache.set(key, cleaned);
    browser.storage.local.set({ [key]: cleaned }).catch(() => {});
    dbgLog(engineObj.name, text, false, false);
    return cleaned;
  }

  if (r.rateLimited) {
    engineObj.rateLimitUntil = Date.now() + 60000;
  }
  engineObj.errors++;
  return null;
}

// ---- 批量翻译 ----

export async function doBlocks(blocks: HTMLElement[]): Promise<void> {
  const queue = [...blocks];

  while (queue.length && !state.cancelled) {
    let eng: EngineState | null;
    const waitStart = Date.now();
    while (!(eng = pickEngine())) {
      if (state.cancelled) return;
      if (Date.now() - waitStart > 30000) {
        console.warn("[快捷翻译] 所有引擎暂不可用");
        break;
      }
      await sleep(100);
    }
    if (!eng) break;
    eng.busy = true;
    eng.lastCall = Date.now();

    const el = queue.shift()!;
    if (state.cancelled) {
      eng.busy = false;
      return;
    }
    if (el.hasAttribute("data-qt")) {
      eng.busy = false;
      continue;
    }

    if (!inView(el)) {
      eng.busy = false;
      continue;
    }

    try {
      let text = (el.textContent || "").trim();
      if (!text) {
        el.setAttribute("data-qt", "1");
        eng.busy = false;
        continue;
      }

      const firstAlpha = text.search(/[a-zA-Z]/);
      const lastAlpha = text.search(/[a-zA-Z](?=[^a-zA-Z]*$)/);
      if (firstAlpha === -1 || lastAlpha - firstAlpha < 1) {
        el.setAttribute("data-qt", "1");
        eng.busy = false;
        continue;
      }

      const prefix = text.slice(0, firstAlpha);
      const core = text.slice(firstAlpha, lastAlpha + 1);
      const suffix = text.slice(lastAlpha + 1);

      // 移除旧 loader
      const oldLoader = el.querySelector(".qt-loader");
      if (oldLoader) oldLoader.remove();
      const loader = document.createElement("span");
      loader.className = "qt-loader qt-skip";
      el.appendChild(loader);

      let result: string | null;
      if (core.length > MAX_TEXT_LEN) {
        const sentences = core.match(/[^.!?\n]+[.!?\n]*/g) || [core];
        const parts: string[] = [];
        for (const s of sentences) {
          const tr = await translateText(s.trim(), eng);
          if (!tr) break;
          parts.push(tr);
        }
        if (parts.length === sentences.length) {
          result = parts.join(" ");
        } else {
          result = null;
        }
      } else {
        result = await translateText(core, eng);
      }
      loader.remove();
      eng.busy = false;
      eng.lastCall = Date.now();

      if (state.cancelled) return;

      if (result) {
        insert(el, prefix + result + suffix);
      } else {
        const tries = (parseInt(el.getAttribute("data-qt-retry") || "0") || 0) + 1;
        if (tries < 5) {
          el.setAttribute("data-qt-retry", String(tries));
          queue.push(el);
        } else {
          el.removeAttribute("data-qt-retry");
          el.setAttribute("data-qt", "1");
        }
      }
    } catch {
      eng.busy = false;
      eng.lastCall = Date.now();
      const tries = (parseInt(el.getAttribute("data-qt-retry") || "0") || 0) + 1;
      if (tries < 5) {
        el.setAttribute("data-qt-retry", String(tries));
        queue.push(el);
      } else {
        el.removeAttribute("data-qt-retry");
        el.setAttribute("data-qt", "1");
      }
    }
  }
}

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
} from "./core";
import { inView } from "./scanner";
import { insert } from "./insert";
import { dbgLog } from "./debug";

/**
 * 去除 API 返回结果中的 HTML 标签。
 * @param s 可能含标签的原文
 * @returns 纯文本
 */
function cleanHtml(s: string): string {
  return s.replace(/<\/?[a-zA-Z][^>]*>/g, "");
}

/**
 * 生成翻译缓存键（基于文本内容的双哈希）。
 * @param s 待哈希文本
 * @returns 以 `qt_` 为前缀的缓存键
 */
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

/**
 * 翻译单条文本：缓存命中则直接返回，否则调用对应引擎 API。
 * @param text 待翻译文本
 * @param engineObj 引擎状态对象（用于统计耗时/调用次数/限流）
 * @returns 翻译结果，失败返回 null
 */
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

/**
 * 单个引擎的翻译 worker：从共享队列抢任务，循环直到队列空或自身不可用。
 * 遵守引擎的 `delayMs` 请求间隔，被限流时主动退出。
 * @param eng 引擎状态
 * @param queue 共享翻译任务队列
 */
async function translateWorker(
  eng: EngineState,
  queue: HTMLElement[],
): Promise<void> {
  eng.busy = true;

  try {
    while (queue.length && !state.cancelled) {
      // 遵守引擎自身的请求间隔
      const wait = eng.delayMs - (Date.now() - eng.lastCall);
      if (wait > 0) await sleep(wait);
      if (state.cancelled) break;

      // 被限流则退出，让外层下次再调度
      if (eng.rateLimitUntil > Date.now()) break;

      const el = queue.shift();
      if (!el) break;

      // ★ 请求发出前记录时间，之后不覆盖
      eng.lastCall = Date.now();

      if (el.hasAttribute("data-qt")) continue;
      if (!inView(el)) continue;

      try {
        let text = (el.textContent || "").trim();
        if (!text) {
          el.setAttribute("data-qt", "1");
          continue;
        }

        const firstAlpha = text.search(/[a-zA-Z]/);
        const lastAlpha = text.search(/[a-zA-Z](?=[^a-zA-Z]*$)/);
        if (firstAlpha === -1 || lastAlpha - firstAlpha < 1) {
          el.setAttribute("data-qt", "1");
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

        if (state.cancelled) break;

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
  } finally {
    eng.busy = false;
  }
}

/**
 * 批量翻译入口：收集所有空闲可用引擎，并发执行翻译。
 * 每个引擎独立从共享队列抢任务，失败项自动重试（最多 5 次）。
 * @param blocks 待翻译的 DOM 元素列表
 */
export async function doBlocks(blocks: HTMLElement[]): Promise<void> {
  const queue = [...blocks];
  let waitStart = 0;

  while (queue.length && !state.cancelled) {
    const now = Date.now();

    // 收集所有空闲可用的引擎
    const ready = engines.filter((e) => {
      if (e.busy) return false;
      if (e.rateLimitUntil > now) return false;
      if (now - e.lastCall < e.delayMs) return false;
      return true;
    });

    if (!ready.length) {
      if (!waitStart) waitStart = now;
      if (now - waitStart > 30000) {
        console.warn("[快捷翻译] 所有引擎暂不可用");
        break;
      }
      await sleep(100);
      continue;
    }
    waitStart = 0;

    // 所有空闲引擎并发运行
    const workers = ready.map((eng) => translateWorker(eng, queue));
    await Promise.all(workers);
  }
}

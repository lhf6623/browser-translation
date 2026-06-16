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
import { dbgLog } from "./debug";
import { QtElement } from "./qtelement";

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

// ---- 单条文本 API 调用 ----

/**
 * 翻译单条文本：缓存命中则直接返回，否则调用对应引擎 API。
 * @returns 翻译结果，失败返回 null
 */
async function translateText(
  text: string,
  engineObj: EngineState,
): Promise<string | null> {
  const key = hashKey(text);

  if (memCache.has(key)) {
    dbgLog("", text, false, true);
    return memCache.get(key)!;
  }

  const stored = await browser.storage.local.get(key);
  const cached = stored[key] as string | undefined;
  if (cached) {
    memCache.set(key, cached);
    dbgLog("", text, false, true);
    return cached;
  }

  const t0 = Date.now();
  const fn = getTranslateFn(engineObj.name);
  const r = await fn(text);
  engineObj.sumMs += Date.now() - t0;
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

/** 翻译 core，超长则按句子拆分逐句翻译 */
async function translateCore(
  core: string,
  eng: EngineState,
): Promise<string | null> {
  if (core.length <= MAX_TEXT_LEN) {
    return translateText(core, eng);
  }
  const sentences = core.match(/[^.!?\n]+[.!?\n]*/g) || [core];
  const out: string[] = [];
  for (const s of sentences) {
    const tr = await translateText(s.trim(), eng);
    if (!tr) return null;
    out.push(tr);
  }
  return out.join(" ");
}

// ---- 单元素翻译 ----

/**
 * 对一个元素执行完整翻译流程：黑名单检查 → 翻译 → 成功插入 / 失败拉黑重试。
 * 无论成功失败都会在 finally 中移除 loader。
 */
async function tryTranslateElement(
  qel: QtElement,
  eng: EngineState,
  queue: QtElement[],
): Promise<void> {
  if (qel.isBlocked(eng.name)) {
    // 全部引擎已拉黑 → 标记失败，后续扫描跳过
    if (engines.every((e) => qel.isBlocked(e.name))) qel.markFailed();
    return;
  }

  const parts = qel.checkTranslatable();
  if (!parts) {
    qel.finish();
    return;
  }

  qel.showLoader();
  try {
    const result = await translateCore(parts.core, eng);
    if (state.cancelled) return;

    if (result) {
      const span = qel.insertTranslation(parts.prefix + result + parts.suffix);
      if (span) state.translatedEls.push(span);
    } else {
      qel.addBlock(eng.name);
      if (engines.every((e) => qel.isBlocked(e.name))) qel.markFailed();
      else queue.push(qel);
    }
  } catch {
    qel.addBlock(eng.name);
    if (engines.every((e) => qel.isBlocked(e.name))) qel.markFailed();
    else queue.push(qel);
  } finally {
    qel.hideLoader();
  }
}

// ---- 引擎调度 ----

/** 筛选当前空闲可用引擎 */
function pickReady(now: number): EngineState[] {
  return engines.filter((e) => {
    if (e.busy) return false;
    if (e.rateLimitUntil > now) return false;
    if (now - e.lastCall < e.delayMs) return false;
    return true;
  });
}

/**
 * 引擎翻译 worker：循环从队列取元素，调用 tryTranslateElement。
 * 遵守 delayMs 间隔，限流或队列空时退出。
 */
async function translateWorker(
  eng: EngineState,
  queue: QtElement[],
): Promise<void> {
  eng.busy = true;
  try {
    while (queue.length && !state.cancelled) {
      const wait = eng.delayMs - (Date.now() - eng.lastCall);
      if (wait > 0) await sleep(wait);
      if (state.cancelled) break;
      if (eng.rateLimitUntil > Date.now()) break;

      const qel = queue.shift();
      if (!qel) break;

      eng.lastCall = Date.now();
      await tryTranslateElement(qel, eng, queue);
    }
  } finally {
    eng.busy = false;
  }
}

// ---- 入口 ----

/**
 * 批量翻译入口：收集空闲引擎并发执行。
 * 失败项推回队列由其他引擎重试，全部引擎拉黑后自动放弃。
 */
export async function doBlocks(blocks: HTMLElement[]): Promise<void> {
  const queue: QtElement[] = blocks.map((el) => new QtElement(el));
  let waitStart = 0;

  while (queue.length && !state.cancelled) {
    const now = Date.now();
    const ready = pickReady(now);

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

    const workers = ready.map((eng) => translateWorker(eng, queue));
    await Promise.all(workers);
  }
}

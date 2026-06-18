// ========== 翻译调度核心 ==========

import { browser } from "wxt/browser";
import type { EngineState } from "./engines/types";
import { getEngineDef } from "./engines/registry";
import { executeEngine } from "./engines/executor";
import { engines, pickReady } from "./engines/pool";
import { state } from "./state";
import { MAX_TEXT_LEN } from "./constants";
import { sleep, cleanHtml } from "./utils";
import { memCache, hashKey } from "./utils/cache";
import { dbgLog } from "./debug";
import { QtElement } from "./qtelement";

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
  const def = getEngineDef(engineObj.name);
  const r = await executeEngine(text, def);
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
  gen: number,
): Promise<void> {
  if (qel.isBlocked(eng.name)) {
    if (engines.every((e) => qel.isBlocked(e.name))) qel.markFailed();
    return;
  }

  // 不在视口内 → 不标记，留给后续扫描
  if (!qel.inView) return;

  const parts = qel.extractCore();
  if (!parts) {
    // 没有英文文本 → 标记 done，后续扫描跳过
    qel.finish();
    return;
  }

  qel.showLoader();
  try {
    const result = await translateCore(parts.core, eng);
    // 当前会话已取消或已被新一轮翻译取代 → 丢弃结果
    if (state.cancelled || state.generation !== gen) return;

    if (result) {
      const span = qel.insertTranslation(parts.prefix + result + parts.suffix);
      if (span) state.translatedEls.push(span);
    } else {
      qel.addBlock(eng.name);
      if (engines.every((e) => qel.isBlocked(e.name))) qel.markFailed();
      else queue.push(qel);
    }
  } catch {
    if (state.generation !== gen) return;
    qel.addBlock(eng.name);
    if (engines.every((e) => qel.isBlocked(e.name))) qel.markFailed();
    else queue.push(qel);
  } finally {
    qel.hideLoader();
  }
}

// ---- 引擎调度 ----

/**
 * 引擎翻译 worker：循环从队列取元素，调用 tryTranslateElement。
 * 遵守 delayMs 间隔，限流或队列空时退出。
 */
async function translateWorker(
  eng: EngineState,
  queue: QtElement[],
  gen: number,
): Promise<void> {
  eng.busy = true;
  try {
    while (queue.length && !state.cancelled && state.generation === gen) {
      const wait = eng.delayMs - (Date.now() - eng.lastCall);
      if (wait > 0) await sleep(wait);
      if (state.cancelled || state.generation !== gen) break;
      if (eng.rateLimitUntil > Date.now()) break;

      const qel = queue.shift();
      if (!qel) break;

      eng.lastCall = Date.now();
      await tryTranslateElement(qel, eng, queue, gen);
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
  const gen = state.generation;
  const queue: QtElement[] = blocks.map((el) => new QtElement(el));
  let waitStart = 0;

  while (queue.length && !state.cancelled && state.generation === gen) {
    const now = Date.now();
    const ready = pickReady();

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

    const workers = ready.map((eng) => translateWorker(eng, queue, gen));
    await Promise.all(workers);
  }
}

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

// ---- 文本 API 调用 ----

/**
 * 批量翻译多条文本：缓存命中则跳过，未命中的一次性发给引擎 API。
 * @returns 翻译结果数组，按输入顺序一一对应，失败位置填 null
 */
async function translateTexts(
  texts: string[],
  engineObj: EngineState,
): Promise<(string | null)[]> {
  const results: (string | null)[] = new Array(texts.length).fill(null);
  const uncached: { text: string; index: number }[] = [];

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    const key = hashKey(text);

    if (memCache.has(key)) {
      results[i] = memCache.get(key)!;
      dbgLog("", text, 'cache');
      continue;
    }

    const stored = await browser.storage.local.get(key);
    const cached = stored[key] as string | undefined;
    if (cached) {
      memCache.set(key, cached);
      results[i] = cached;
      dbgLog("", text, 'cache');
      continue;
    }

    uncached.push({ text, index: i });
  }

  if (uncached.length === 0) return results;

  const t0 = Date.now();
  const def = getEngineDef(engineObj.name);
  const r = await executeEngine(
    uncached.map((u) => u.text),
    def,
  );
  engineObj.sumMs += Date.now() - t0;
  engineObj.calls++;

  if (!r.rateLimited && !r.errorType) {
    const n = Math.min(r.results.length, uncached.length);
    if (r.results.length !== uncached.length) {
      console.warn(
        "[快捷翻译] 结果数不匹配: API返回%d 期望%d",
        r.results.length,
        uncached.length,
      );
    }
    for (let j = 0; j < n; j++) {
      const raw = r.results[j];
      const idx = uncached[j].index;
      if (raw) {
        const cleaned = cleanHtml(raw);
        results[idx] = cleaned;
        const key = hashKey(uncached[j].text);
        memCache.set(key, cleaned);
        browser.storage.local.set({ [key]: cleaned }).catch(() => {});
        dbgLog(engineObj.name, uncached[j].text);
      } else {
        dbgLog(engineObj.name, uncached[j].text, 'fail');
      }
    }
  }

  if (r.rateLimited) {
    engineObj.rateLimitUntil = Date.now() + 60000;
  }
  if (r.errorType) {
    engineObj.errors++;
  }

  return results;
}

// ---- 批量翻译 ----

/** 批量翻译一组元素 */
async function tryTranslateBatch(
  batch: QtElement[],
  eng: EngineState,
  queue: QtElement[],
  gen: number,
): Promise<void> {
  type Task = { qel: QtElement; core: string; prefix: string; suffix: string };
  const tasks: Task[] = [];

  // 1. 预检查：拉黑、视口、提取核心文本
  for (const qel of batch) {
    if (qel.isBlocked(eng.name)) {
      if (engines.every((e) => qel.isBlocked(e.name))) qel.markFailed();
      continue;
    }
    if (!qel.inView) continue;

    const parts = qel.extractCore();
    if (!parts) {
      qel.finish();
      continue;
    }
    tasks.push({ qel, core: parts.core, prefix: parts.prefix, suffix: parts.suffix });
  }

  if (tasks.length === 0) return;

  // 1.5 按引擎 maxBatchSize 裁剪：超出的元素推回队列
  const def = getEngineDef(eng.name);
  const limit = def.maxBatchSize(tasks.map((t) => t.core));
  if (limit < tasks.length) {
    for (let i = tasks.length - 1; i >= limit; i--) {
      queue.push(tasks[i].qel);
      tasks.pop();
    }
  }

  // 2. 长文本拆句 → 收集所有句子段（跨元素扁平化）
  type Seg = { taskIdx: number; text: string };
  const segs: Seg[] = [];
  const taskSegInfo: { segStart: number; segCount: number }[] = [];

  for (let i = 0; i < tasks.length; i++) {
    const core = tasks[i].core;
    const start = segs.length;
    if (core.length <= MAX_TEXT_LEN) {
      segs.push({ taskIdx: i, text: core });
      taskSegInfo.push({ segStart: start, segCount: 1 });
    } else {
      const sentences = core.match(/[^.!?\n]+[.!?\n]*/g) || [core];
      for (const s of sentences) {
        segs.push({ taskIdx: i, text: s.trim() });
      }
      taskSegInfo.push({ segStart: start, segCount: sentences.length });
    }
  }

  // 3. 显示 loader
  for (const t of tasks) t.qel.showLoader();

  // 4. 批量 API 调用（失败则整批拉黑）
  let segResults: (string | null)[];
  try {
    const segTexts = segs.map((s) => s.text);
    segResults = await translateTexts(segTexts, eng);
  } catch (err) {
    console.warn("[快捷翻译] 批量 API 调用异常:", err);
    for (const t of tasks) {
      t.qel.addBlock(eng.name);
      if (engines.every((e) => t.qel.isBlocked(e.name))) t.qel.markFailed();
      else queue.push(t.qel);
      t.qel.hideLoader();
    }
    return;
  }

  // 用户取消 → 丢弃结果
  if (state.cancelled || state.generation !== gen) {
    for (const t of tasks) t.qel.hideLoader();
    return;
  }

  // 5-6. 逐元素处理（各自独立，一个失败不影响同批其他元素）
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    try {
      const { segStart, segCount } = taskSegInfo[i];
      const taskSegResults = segResults.slice(segStart, segStart + segCount);
      if (taskSegResults.every((r) => r !== null)) {
        const result = taskSegResults.join(" ");
        if (result) {
          const span = t.qel.insertTranslation(t.prefix + result + t.suffix);
          if (span) {
            state.translatedEls.push(span);
          } else {
            dbgLog(eng.name, t.core, 'fail');
          }
        } else {
          dbgLog(eng.name, t.core, 'fail');
          t.qel.addBlock(eng.name);
          if (engines.every((e) => t.qel.isBlocked(e.name))) t.qel.markFailed();
          else queue.push(t.qel);
        }
      } else {
        dbgLog(eng.name, t.core, 'fail');
        t.qel.addBlock(eng.name);
        if (engines.every((e) => t.qel.isBlocked(e.name))) t.qel.markFailed();
        else queue.push(t.qel);
      }
    } catch (err) {
      console.warn("[快捷翻译] 元素处理异常:", err);
      t.qel.addBlock(eng.name);
      if (engines.every((e) => t.qel.isBlocked(e.name))) t.qel.markFailed();
      else queue.push(t.qel);
    } finally {
      t.qel.hideLoader();
    }
  }
}

// ---- 引擎调度 ----

/**
 * 引擎翻译 worker：循环从队列取元素，每批按引擎 maxBatchSize 决定取量。
 * 遵守 delayMs 间隔，限流或队列空时退出。
 */
async function translateWorker(
  eng: EngineState,
  queue: QtElement[],
  gen: number,
): Promise<boolean> {
  eng.busy = true;
  let processedAny = false;
  const def = getEngineDef(eng.name);
  try {
    while (queue.length && !state.cancelled && state.generation === gen) {
      const wait = eng.delayMs - (Date.now() - eng.lastCall);
      if (wait > 0) await sleep(wait);
      if (state.cancelled || state.generation !== gen) break;
      if (eng.rateLimitUntil > Date.now()) break;

      // 从队列收集未被本引擎拉黑的元素，取量由引擎 maxBatchSize 决定
      const batchLimit = def.maxBatchSize([]);
      const batch: QtElement[] = [];
      for (let i = queue.length - 1; i >= 0 && batch.length < batchLimit; i--) {
        if (!queue[i].isBlocked(eng.name)) {
          batch.push(queue.splice(i, 1)[0]);
        }
      }
      if (batch.length === 0) break;

      eng.lastCall = Date.now();
      await tryTranslateBatch(batch, eng, queue, gen);
      processedAny = true;
    }
  } finally {
    eng.busy = false;
  }
  return processedAny;
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
    const results = await Promise.all(workers);
    if (!results.some(Boolean) && queue.length > 0) break;
  }
}

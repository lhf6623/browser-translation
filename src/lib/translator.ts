// ========== 翻译调度核心 ==========

import { browser } from "wxt/browser";
import type { EngineState } from "./engines/types";
import { getEngineDef } from "./engines/registry";
import { executeEngine } from "./engines/executor";
import { engines } from "./engines/pool";
import { state } from "./state";
import { sleep, cleanHtml } from "./utils";
import { memCache, hashKey } from "./utils/cache";
import { bus } from "./utils/events";
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
      bus.emit('translate', { engine: '', text, status: 'cache' });
      continue;
    }

    const stored = await browser.storage.local.get(key);
    const cached = stored[key] as string | undefined;
    if (cached) {
      memCache.set(key, cached);
      results[i] = cached;
      bus.emit('translate', { engine: '', text, status: 'cache' });
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
        bus.emit('translate', { engine: engineObj.name, text: uncached[j].text, status: 'ok' });
      } else {
        bus.emit('translate', { engine: engineObj.name, text: uncached[j].text, status: 'fail' });
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
  // 注意：不满足当前引擎条件的元素推回队列，避免被该引擎“吞掉”
  for (const qel of batch) {
    if (qel.isBlocked(eng.name)) {
      if (engines.every((e) => qel.isBlocked(e.name))) {
        qel.markFailed();
      } else {
        queue.push(qel);
      }
      continue;
    }
    // 不可见元素直接跳过：push 回队列会导致反复取出-检查-推回的死循环
    // 下次 scanAndTranslate → findBlocks 会自然重新发现它们
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

  // 2. 显示 loader
  for (const t of tasks) t.qel.showLoader();

  // 3. 批量 API 调用（失败则整批拉黑）
  let results: (string | null)[];
  try {
    const texts = tasks.map((t) => t.core);
    results = await translateTexts(texts, eng);
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

  // 4-5. 逐元素处理（各自独立，一个失败不影响同批其他元素）
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    try {
      const translation = results[i];
      if (translation) {
        const span = t.qel.insertTranslation(t.prefix + translation + t.suffix);
        if (span) {
          state.translatedEls.push(span);
        } else {
          bus.emit('translate', { engine: eng.name, text: t.core, status: 'fail' });
        }
      } else {
        bus.emit('translate', { engine: eng.name, text: t.core, status: 'fail' });
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
 * 引擎自治 worker：循环从队列取元素，完成一批立刻检查下一批。
 * 遵守 delayMs 间隔，限流自愈，无同步屏障。
 * 队列为空时不立即退出——等待其他 worker 可能推回元素。
 */
async function autoWorker(
  eng: EngineState,
  queue: QtElement[],
  gen: number,
): Promise<void> {
  eng.busy = true;
  try {
    while (true) {
      if (state.cancelled || state.generation !== gen) return;

      // 队列为空 → 等一等其他正在调 API 的 worker（失败后可能退回元素）
      if (!queue.length) {
        eng.busy = false;
        await sleep(200);
        eng.busy = true;
        const anyBusy = engines.some((e) => e !== eng && e.busy);
        if (!anyBusy) return;
        continue;
      }

      const wait = eng.delayMs - (Date.now() - eng.lastCall);
      if (wait > 0) await sleep(wait);
      if (state.cancelled || state.generation !== gen) return;

      if (eng.rateLimitUntil > Date.now()) {
        await sleep(1000);
        continue;
      }

      const def = getEngineDef(eng.name);
      const batchLimit = def.maxBatchSize([]);
      const batch: QtElement[] = [];
      for (let i = queue.length - 1; i >= 0 && batch.length < batchLimit; i--) {
        if (!queue[i].isBlocked(eng.name)) {
          batch.push(queue.splice(i, 1)[0]);
        }
      }

      if (batch.length === 0) {
        // 队列里所有元素都被当前引擎拉黑 → 清理全局拉黑元素，然后等待
        for (let i = queue.length - 1; i >= 0; i--) {
          if (engines.every((e) => queue[i].isBlocked(e.name))) {
            queue[i].markFailed();
            queue.splice(i, 1);
          }
        }
        const othersActive = engines.some(
          (e) => e.name !== eng.name && e.busy,
        );
        if (!othersActive) return;
        await sleep(200);
        continue;
      }

      eng.lastCall = Date.now();
      await tryTranslateBatch(batch, eng, queue, gen);
    }
  } finally {
    eng.busy = false;
  }
}

// ---- 入口 ----

/**
 * 批量翻译入口：启动全部引擎自治并发执行。
 * 无同步屏障 — 各引擎独立循环消费队列，完成一批立刻取下一批。
 * 失败项推回队列由其他引擎重试，全部引擎拉黑后自动放弃。
 */
export async function doBlocks(blocks: HTMLElement[]): Promise<void> {
  const gen = state.generation;
  const queue: QtElement[] = blocks.map((el) => new QtElement(el));

  const workers = engines.map((eng) => autoWorker(eng, queue, gen));
  await Promise.allSettled(workers);

  // 全部 worker 退出后残留元素 = 被所有引擎拉黑 → 标记失败
  if (queue.length && !state.cancelled && state.generation === gen) {
    for (const qel of queue) qel.markFailed();
  }
}

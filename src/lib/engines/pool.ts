// ========== 引擎调度池 ==========

import type { EngineState } from "./types";

/**
 * 五个翻译引擎的运行状态池，按轮询顺序排列。
 * 每个引擎有独立的 `delayMs` 请求间隔。
 */
export const engines: EngineState[] = [
  { name: "MM", lastCall: 0, delayMs: 100, busy: false, rateLimitUntil: 0, calls: 0, errors: 0, sumMs: 0 },
  { name: "GT", lastCall: 0, delayMs: 500, busy: false, rateLimitUntil: 0, calls: 0, errors: 0, sumMs: 0 },
  { name: "BD", lastCall: 0, delayMs: 110, busy: false, rateLimitUntil: 0, calls: 0, errors: 0, sumMs: 0 },
  { name: "YD", lastCall: 0, delayMs: 600, busy: false, rateLimitUntil: 0, calls: 0, errors: 0, sumMs: 0 },
  { name: "TX", lastCall: 0, delayMs: 200, busy: false, rateLimitUntil: 0, calls: 0, errors: 0, sumMs: 0 },
];

/** 筛选当前所有空闲可用的引擎 */
export function pickReady(): EngineState[] {
  const now = Date.now();
  return engines.filter((e) => {
    if (e.busy) return false;
    if (e.rateLimitUntil > now) return false;
    if (now - e.lastCall < e.delayMs) return false;
    return true;
  });
}

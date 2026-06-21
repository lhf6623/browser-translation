// ========== 引擎统一执行层 ==========
// 所有引擎统一走 background 代理，content script 不直接发起跨域请求。
// 超时、错误处理、限流判断全部在此收敛。

import { browser } from "wxt/browser";
import type { EngineDef, EngineResult } from "./types";
import { API_TIMEOUT_MS } from "../constants";
import { withTimeout, cleanHtml } from "../utils";
import { memCache, hashKey } from "../utils/cache";

/**
 * 执行引擎翻译 — 统一走 background proxy。
 * buildPayload 接收 string[]，引擎自行决定单条还是合并。
 * 返回单个 EngineResult（取 results[0]）。
 */
export async function executeEngine(
  texts: string[],
  def: EngineDef,
): Promise<EngineResult> {
  let payload: Record<string, unknown>;
  try {
    payload = await def.buildPayload(texts);
  } catch {
    return { result: null, rateLimited: false, errorType: "build" };
  }

  try {
    const res = await withTimeout(
      browser.runtime.sendMessage({ _type: "proxy", ...payload }),
      API_TIMEOUT_MS,
    );

    if (res && def.isRateLimited(res.data, res.status)) {
      return { result: null, rateLimited: true, errorType: "ratelimit" };
    }

    if (!res || !res.ok) {
      return { result: null, rateLimited: false, errorType: "network" };
    }

    const results = def.parseResponse(res.data);
    const first = results[0] ?? null;
    return { result: first, rateLimited: false };
  } catch (err) {
    const isTimeout = (err as Error).message === "timeout";
    return {
      result: null,
      rateLimited: false,
      errorType: isTimeout ? "timeout" : "network",
    };
  }
}

/**
 * 批量调用 executeEngine 逐条翻译，带缓存。
 * 引擎 buildPayload 已支持 string[]，此处逐条调用。
 */
export async function executeEngineBatch(
  texts: string[],
  def: EngineDef,
): Promise<EngineResult[]> {
  const results: EngineResult[] = [];

  for (const text of texts) {
    const key = hashKey(text);
    if (memCache.has(key)) {
      results.push({ result: memCache.get(key)!, rateLimited: false });
      continue;
    }

    const r = await executeEngine([text], def);
    if (r.result) {
      const cleaned = cleanHtml(r.result);
      memCache.set(key, cleaned);
      results.push({ result: cleaned, rateLimited: false });
    } else {
      results.push(r);
    }
  }

  return results;
}

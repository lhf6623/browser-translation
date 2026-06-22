// ========== 引擎统一执行层 ==========
// 所有引擎统一走 background 代理，content script 不直接发起跨域请求。
// 超时、错误处理、限流判断全部在此收敛。

import { browser } from "wxt/browser";
import type { EngineDef, EngineResult } from "./types";
import { API_TIMEOUT_MS } from "../constants";
import { withTimeout } from "../utils";

/**
 * 执行引擎翻译 — 统一走 background proxy。
 * buildPayload 接收 string[]，引擎自行决定单条还是合并。
 * parseResponse 返回 (string | null)[]，按输入顺序一一对应。
 */
export async function executeEngine(
  texts: string[],
  def: EngineDef,
): Promise<EngineResult> {
  let payload: Record<string, unknown>;
  try {
    payload = await def.buildPayload(texts);
  } catch {
    return { results: texts.map(() => null), rateLimited: false, errorType: "build" };
  }

  try {
    const res = await withTimeout(
      browser.runtime.sendMessage({ _type: "proxy", ...payload }),
      API_TIMEOUT_MS,
    );

    if (res && def.isRateLimited(res.data, res.status)) {
      return { results: texts.map(() => null), rateLimited: true, errorType: "ratelimit" };
    }

    if (!res || !res.ok) {
      return { results: texts.map(() => null), rateLimited: false, errorType: "network" };
    }

    const results = def.parseResponse(res.data);
    return { results, rateLimited: false };
  } catch (err) {
    const isTimeout = (err as Error).message === "timeout";
    return {
      results: texts.map(() => null),
      rateLimited: false,
      errorType: isTimeout ? "timeout" : "network",
    };
  }
}


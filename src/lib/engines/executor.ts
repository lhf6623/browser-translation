// ========== 引擎统一执行层 ==========
// 所有引擎统一走 background 代理，content script 不直接发起跨域请求。
// 超时、错误处理、限流判断全部在此收敛。

import { browser } from "wxt/browser";
import type { EngineDef, EngineResult } from "./types";
import { API_TIMEOUT_MS } from "../constants";
import { withTimeout } from "../utils";

/**
 * 执行引擎翻译：统一发消息给 background，由 background 代为 fetch。
 * 引擎只需声明 payload（URL/方法/头/体），executor 负责通信与超时。
 */
export async function executeEngine(
  text: string,
  def: EngineDef,
): Promise<EngineResult> {
  let payload: Record<string, unknown>;
  try {
    payload = await def.buildPayload(text);
  } catch {
    return { result: null, rateLimited: false, errorType: 'build' };
  }

  try {
    const res = await withTimeout(
      browser.runtime.sendMessage({ _type: "proxy", ...payload }),
      API_TIMEOUT_MS,
    );

    // 限流检测：统一交给引擎判断，各引擎自行决定依据
    // HTTP 状态码（MM/GT）或 body 错误码（BD/YD/TX）或两者结合
    if (res && def.isRateLimited(res.data, res.status)) {
      return { result: null, rateLimited: true, errorType: 'ratelimit' };
    }

    if (!res || !res.ok) {
      return { result: null, rateLimited: false, errorType: 'network' };
    }

    const result = def.parseResponse(res.data);
    return { result, rateLimited: false };
  } catch (err) {
    const isTimeout = (err as Error).message === 'timeout';
    return {
      result: null,
      rateLimited: false,
      errorType: isTimeout ? 'timeout' : 'network',
    };
  }
}

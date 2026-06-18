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
  try {
    const payload = await def.buildPayload(text);

    const res = await withTimeout(
      browser.runtime.sendMessage({ _type: "proxy", ...payload }),
      API_TIMEOUT_MS,
    );

    if (!res || !res.ok) {
      if (res?.data && def.isRateLimited(res.data)) {
        return { result: null, rateLimited: true };
      }
      return { result: null, rateLimited: false };
    }

    const result = def.parseResponse(res.data);
    return { result, rateLimited: false };
  } catch {
    return { result: null, rateLimited: false };
  }
}

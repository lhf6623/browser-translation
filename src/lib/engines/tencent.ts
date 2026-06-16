// ========== 腾讯翻译引擎 ==========

import { browser } from "wxt/browser";
import type { EngineResult } from "./types";
import { TX_SECRET_ID, TX_SECRET_KEY } from "../config";
import { API_TIMEOUT_MS, withTimeout } from "../core";

export async function tryTencentTranslate(text: string): Promise<EngineResult> {
  try {
    const res = await withTimeout(
      browser.runtime.sendMessage({
        action: "fetchTencent",
        q: text,
        secretId: TX_SECRET_ID,
        secretKey: TX_SECRET_KEY,
      }),
      API_TIMEOUT_MS,
    );
    if (!res || !res.ok) return { result: null, rateLimited: false };

    const r = res.data.Response;
    if (r.Error) {
      if (
        r.Error.Code === "LimitExceeded" ||
        r.Error.Code === "RequestLimitExceeded"
      ) {
        return { result: null, rateLimited: true };
      }
      return { result: null, rateLimited: false };
    }
    if (r.TargetText) return { result: r.TargetText, rateLimited: false };
    return { result: null, rateLimited: false };
  } catch {
    return { result: null, rateLimited: false };
  }
}

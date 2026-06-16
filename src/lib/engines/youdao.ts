// ========== 有道翻译引擎 ==========

import { browser } from "wxt/browser";
import type { EngineResult } from "./types";
import { YD_APPKEY, YD_SECRET } from "../config";
import { API_TIMEOUT_MS, withTimeout } from "../core";

function truncate(q: string): string {
  const len = q.length;
  return len <= 20 ? q : q.substring(0, 10) + len + q.substring(len - 10, len);
}

async function sha256(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash as ArrayBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function tryYoudaoTranslate(text: string): Promise<EngineResult> {
  const salt = crypto.randomUUID();
  const curtime = String(Math.floor(Date.now() / 1000));
  const signStr = YD_APPKEY + truncate(text) + salt + curtime + YD_SECRET;
  const sign = await sha256(signStr);

  const params = {
    q: text,
    from: "en",
    to: "zh-CHS",
    appKey: YD_APPKEY,
    salt,
    sign,
    signType: "v3",
    curtime,
  };

  try {
    const res = await withTimeout(
      browser.runtime.sendMessage({
        action: "fetchYoudao",
        params,
      }),
      API_TIMEOUT_MS,
    );
    if (!res || !res.ok) return { result: null, rateLimited: false };

    const data = res.data;
    if (data.errorCode === "411") return { result: null, rateLimited: true };
    if (data.translation?.[0]) {
      return { result: data.translation[0], rateLimited: false };
    }
    return { result: null, rateLimited: false };
  } catch {
    return { result: null, rateLimited: false };
  }
}

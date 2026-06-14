// ========== 百度翻译引擎 ==========

import { browser } from "wxt/browser";
import type { EngineResult } from "./types";
import { md5 } from "../hash";
import { BD_APPID, BD_KEY } from "../config";

export async function tryBaiduTranslate(text: string): Promise<EngineResult> {
  const salt = Date.now().toString();
  const sign = md5(BD_APPID + text + salt + BD_KEY);
  const url =
    `https://fanyi-api.baidu.com/api/trans/vip/translate` +
    `?q=${encodeURIComponent(text)}&from=en&to=zh` +
    `&appid=${BD_APPID}&salt=${salt}&sign=${sign}`;

  try {
    const res = await browser.runtime.sendMessage({ action: "fetchBaidu", url });
    if (!res || !res.ok) return { result: null, rateLimited: false };

    const data = res.data;
    if (data.error_code === "54003") return { result: null, rateLimited: true };
    if (data.trans_result?.[0]?.dst) {
      return {
        result: data.trans_result.map((r: { dst: string }) => r.dst).join(""),
        rateLimited: false,
      };
    }
    return { result: null, rateLimited: false };
  } catch {
    return { result: null, rateLimited: false };
  }
}

// ========== 有道翻译引擎（代理，需要 APP_KEY + SECRET 签名） ==========

import type { EngineDef } from "./types";
import { YD_APPKEY, YD_SECRET } from "../config";

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

export const youdaoDef: EngineDef = {
  name: "YD",

  buildPayload: async (texts) => {
    const salt = crypto.randomUUID();
    const curtime = String(Math.floor(Date.now() / 1000));
    // 签名用所有文本的拼接
    const combinedQ = texts.join("");
    const signStr = YD_APPKEY + truncate(combinedQ) + salt + curtime + YD_SECRET;
    const sign = await sha256(signStr);

    const params = new URLSearchParams();
    texts.forEach((t) => params.append("q", t));
    params.append("from", "en");
    params.append("to", "zh-CHS");
    params.append("appKey", YD_APPKEY);
    params.append("salt", salt);
    params.append("sign", sign);
    params.append("signType", "v3");
    params.append("curtime", curtime);

    return {
      url: "https://openapi.youdao.com/api",
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    };
  },

  parseResponse: (data) => {
    const d = data as { translation?: string[] };
    if (!d.translation?.[0]) return [null];
    // 有道只有单条，translation 数组是同一个 q 的多个候选译法
    return [d.translation[0]];
  },

  isRateLimited: (data) => {
    const d = data as { errorCode?: string };
    return d.errorCode === "411";
  },
};

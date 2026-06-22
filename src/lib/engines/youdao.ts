// ========== 有道翻译引擎（代理，需要 APP_KEY + SECRET 签名） ==========

import type { EngineDef } from "./types";
import { YD_APPKEY, YD_SECRET } from "../config";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

const encoder = new TextEncoder();

function truncate(q: string): string {
  const len = q.length;
  return len <= 20 ? q : q.substring(0, 10) + len + q.substring(len - 10, len);
}

export const youdaoDef: EngineDef = {
  name: "YD",

  buildPayload: async (texts) => {
  console.log(`texts:`, texts);
    const salt = crypto.randomUUID();
    const curtime = String(Math.floor(Date.now() / 1000));
    // 批量翻译：所有 q 拼接后 truncate 再签名
    const combinedQ = texts.join("");
    const signStr = YD_APPKEY + truncate(combinedQ) + salt + curtime + YD_SECRET;
    const sign = bytesToHex(sha256(encoder.encode(signStr)));

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
      url: "https://openapi.youdao.com/v2/api",
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    };
  },

  parseResponse: (data) => {
  console.log(`data:`, data);
    const d = data as {
      errorCode?: string;
      errorIndex?: number[];
      translateResults?: { query: string; translation: string }[];
    };
    if (!d.translateResults) return [];
    const errors = new Set(d.errorIndex ?? []);
    return d.translateResults.map((r, i) => (errors.has(i) ? null : r.translation));
  },

  isRateLimited: (data) => {
    const d = data as { errorCode?: string };
    return d.errorCode === "411";
  },

  // 有道批量 API 单次总字符上限 5000
  maxBatchSize: (texts) => {
    const totalLen = texts.reduce((s, t) => s + t.length, 0);
    if (totalLen > 4000) return texts.length;
    return 10;
  },
};

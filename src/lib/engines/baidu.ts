// ========== 百度翻译引擎（代理，需要 APP_ID + SECRET_KEY 签名） ==========

import type { EngineDef } from "./types";
import { BD_APPID, BD_KEY } from "../config";
import { md5 } from "@noble/hashes/legacy.js";
import { bytesToHex } from "@noble/hashes/utils.js";

// ---- 引擎定义 ------------------------------------------------------------

const encoder = new TextEncoder();

export const baiduDef: EngineDef = {
  name: "BD",

  buildPayload: (texts) => {
    // 文本内含 \n/\r 会与百度 API 的 \n 分隔符冲突 → 统一替换为空格
    const q = texts.map((t) => t.replace(/[\r\n]+/g, " ")).join("\n");
    const salt = Date.now().toString();
    const sign = bytesToHex(md5(encoder.encode(BD_APPID + q + salt + BD_KEY)));
    const url =
      `https://fanyi-api.baidu.com/api/trans/vip/translate` +
      `?q=${encodeURIComponent(q)}&from=en&to=zh` +
      `&appid=${BD_APPID}&salt=${salt}&sign=${sign}`;
    return { url };
  },

  parseResponse: (data) => {
    const d = data as { trans_result?: { dst: string }[] };
    if (!d.trans_result) return [];
    return d.trans_result.map((r) => r.dst);
  },

  isRateLimited: (data) => {
    const d = data as { error_code?: string };
    return d.error_code === "54003";
  },

  // 百度 API 单次 q 参数上限约 6000 字符，每个文本用 \n 分隔
  maxBatchSize: (texts) => {
    const totalLen = texts.reduce((s, t) => s + t.length + 1, 0); // +1 for \n
    if (totalLen > 5000) return texts.length; // 已收集的刚好够
    return 20;
  },
};

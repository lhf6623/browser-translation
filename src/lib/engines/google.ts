// ========== Google 翻译引擎（代理，免费端点无需密钥） ==========

import type { EngineDef } from "./types";

export const googleDef: EngineDef = {
  name: "GT",

  buildPayload: (texts) => ({
    url: `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(texts[0] ?? "")}`,
  }),

  parseResponse: (data) => {
    const arr = data as [unknown[]] | null;
    if (!arr?.[0]) return [null];
    const segments = arr[0]
      .filter((s): s is [string] => Array.isArray(s) && typeof s[0] === "string")
      .map((s) => s[0])
      .join("");
    return [segments || null];
  },

  isRateLimited: (_data, status) => status === 403 || status === 429,
};

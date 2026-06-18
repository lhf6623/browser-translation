// ========== MyMemory 翻译引擎（代理，免费无需密钥） ==========

import type { EngineDef } from "./types";

export const myMemoryDef: EngineDef = {
  name: "MM",

  buildPayload: (text) => ({
    url: `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en%7Czh`,
  }),

  parseResponse: (data) => {
    const d = data as { responseStatus: number; responseData?: { translatedText?: string } };
    if (d.responseStatus === 200 && d.responseData?.translatedText) {
      return d.responseData.translatedText;
    }
    return null;
  },

  isRateLimited: (data) => {
    const d = data as { status?: number };
    return d.status === 429;
  },
};

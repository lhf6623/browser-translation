// ========== MyMemory 翻译引擎 ==========

import type { EngineResult } from "./types";
import { API_TIMEOUT_MS } from "../core";

export async function tryMyMemory(text: string): Promise<EngineResult> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en%7Czh`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);

    if (res.status === 429) return { result: null, rateLimited: true };
    if (!res.ok) return { result: null, rateLimited: false };

    const data = await res.json();
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      return { result: data.responseData.translatedText, rateLimited: false };
    }
    return { result: null, rateLimited: false };
  } catch {
    return { result: null, rateLimited: false };
  }
}

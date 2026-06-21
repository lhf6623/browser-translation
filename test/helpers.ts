// ========== 引擎测试公用助手 ==========

/**
 * 引擎 buildPayload 产出的请求描述。
 * MyMemory/Google/Baidu 只设 url（走 GET），
 * 有道/腾讯会额外设 method + headers + body（走 POST）。
 */
export interface Payload {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

/**
 * fetch 返回的标准化结果，方便给 parseResponse / isRateLimited 用。
 */
export interface FetchResult {
  ok: boolean;
  status: number;
  data: unknown;
}

/**
 * 根据引擎 buildPayload 的结果发起 HTTP 请求，返回标准化结果。
 */
export async function fetchPayload(p: Payload): Promise<FetchResult> {
  const { url, method = "GET", headers = {}, body } = p;

  const init: RequestInit = {
    method,
    headers: { "User-Agent": "quick-translate-test/1.0", ...headers },
  };

  if (body && method !== "GET") {
    init.body = body;
  }

  const res = await fetch(url, init);
  const text = await res.text();

  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    // 非 JSON 响应保留字符串
  }

  return { ok: res.ok, status: res.status, data };
}

/**
 * 打印分隔线（和 demo 风格一致）
 */
export function banner(title: string) {
  console.log("\n" + "═".repeat(56));
  console.log(`  ${title}`);
  console.log("═".repeat(56));
}

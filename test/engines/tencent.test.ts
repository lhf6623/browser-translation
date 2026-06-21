// ========== 腾讯翻译引擎测试 ==========

import { describe, expect, it } from "vitest";
import { tencentDef } from "../../src/lib/engines/tencent";
import { fetchPayload, type Payload } from "../helpers";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- buildPayload ----

describe("腾讯 — buildPayload", () => {
  it("构建 POST 请求，含 TC3-HMAC-SHA256 签名头", async () => {
    const p = (await tencentDef.buildPayload(["hello"])) as unknown as Payload;

    expect(p.url).toBe("https://tmt.tencentcloudapi.com");
    expect(p.method).toBe("POST");
    expect(p.headers?.["Content-Type"]).toBe("application/json");
    expect(p.headers?.["X-TC-Action"]).toBe("TextTranslate");

    const auth = p.headers?.Authorization || "";
    expect(auth).toContain("TC3-HMAC-SHA256");
    expect(auth).toContain("Signature=");

    const body = JSON.parse(p.body!);
    expect(body.SourceText).toBe("hello");
    expect(body.Source).toBe("en");
    expect(body.Target).toBe("zh");
  });
});

// ---- parseResponse ----

describe("腾讯 — parseResponse", () => {
  it("正常提取译文", () => {
    const data = { Response: { TargetText: "你好世界", RequestId: "xxx" } };
    expect(tencentDef.parseResponse(data)).toEqual(["你好世界"]);
  });

  it("Response.Error 存在 → [null]", () => {
    const data = { Response: { Error: { Code: "InvalidParameter" } } };
    expect(tencentDef.parseResponse(data)).toEqual([null]);
  });

  it("无 Response → [null]", () => {
    expect(tencentDef.parseResponse({})).toEqual([null]);
  });
});

// ---- isRateLimited ----

describe("腾讯 — isRateLimited", () => {
  it("LimitExceeded → 限流", () => {
    expect(tencentDef.isRateLimited({ Response: { Error: { Code: "LimitExceeded" } } }, 200)).toBe(true);
  });

  it("无错误 → 不限流", () => {
    expect(tencentDef.isRateLimited({ Response: { TargetText: "hello" } }, 200)).toBe(false);
  });
});

// ---- 真实 API 集成（5 QPS） ----

describe("腾讯 — 真实 API 集成", () => {
  it("单条英文翻译为中文", async () => {
    const p = (await tencentDef.buildPayload(["Hello world"])) as unknown as Payload;
    const res = await fetchPayload(p);

    expect(res.ok).toBe(true);
    const text = tencentDef.parseResponse(res.data)[0];
    expect(text).toBeTruthy();
    console.log(`  腾讯: "Hello world" → "${text}"`);
  });
});

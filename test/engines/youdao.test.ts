// ========== 有道翻译引擎测试 ==========

import { describe, expect, it } from "vitest";
import { youdaoDef } from "../../src/lib/engines/youdao";
import { fetchPayload, type Payload } from "../helpers";

// ---- buildPayload ----

describe("有道 — buildPayload", () => {
  it("构建 POST 请求，含全部必填字段", async () => {
    const p = (await youdaoDef.buildPayload(["hello"])) as unknown as Payload;

    expect(p.url).toBe("https://openapi.youdao.com/v2/api");
    expect(p.method).toBe("POST");
    expect(p.headers?.["Content-Type"]).toBe("application/x-www-form-urlencoded");

    expect(p.body).toContain("q=hello");
    expect(p.body).toContain("from=en");
    expect(p.body).toContain("to=zh-CHS");
    expect(p.body).toContain("appKey=");
    expect(p.body).toContain("signType=v3");
  });

  it("sign 为 64 位 hex（SHA-256）", async () => {
    const p = (await youdaoDef.buildPayload(["test"])) as unknown as Payload;
    const sign = p.body?.match(/sign=([a-f0-9]+)/)?.[1];
    expect(sign).toHaveLength(64);
  });

  it("多次调用 sign 不同", async () => {
    const p1 = (await youdaoDef.buildPayload(["hello"])) as unknown as Payload;
    const p2 = (await youdaoDef.buildPayload(["hello"])) as unknown as Payload;
    const s1 = p1.body?.match(/sign=([a-f0-9]+)/)?.[1];
    const s2 = p2.body?.match(/sign=([a-f0-9]+)/)?.[1];
    expect(s1).not.toBe(s2);
  });
});

// ---- parseResponse ----

describe("有道 — parseResponse", () => {
  it("正常提取译文", () => {
    const data = {
      errorCode: "0",
      translateResults: [{ query: "hello", translation: "你好" }],
    };
    expect(youdaoDef.parseResponse(data)).toEqual(["你好"]);
  });

  it("无 translateResults 返回 []", () => {
    expect(youdaoDef.parseResponse({ errorCode: "0" })).toEqual([]);
    expect(youdaoDef.parseResponse({ errorCode: "0", translateResults: [] })).toEqual([]);
  });

  it("errorIndex 标记的项返回 null", () => {
    const data = {
      errorCode: "0",
      errorIndex: [1],
      translateResults: [
        { query: "a", translation: "A" },
        { query: "b", translation: "B" },
        { query: "c", translation: "C" },
      ],
    };
    expect(youdaoDef.parseResponse(data)).toEqual(["A", null, "C"]);
  });

  it("意外格式不抛异常", () => {
    expect(() => youdaoDef.parseResponse("bad")).not.toThrow();
    expect(() => youdaoDef.parseResponse([])).not.toThrow();
  });
});

// ---- isRateLimited ----

describe("有道 — isRateLimited", () => {
  it("errorCode=411 → 限流", () => {
    expect(youdaoDef.isRateLimited({ errorCode: "411" }, 200)).toBe(true);
  });

  it("其他错误码 → 不限流", () => {
    expect(youdaoDef.isRateLimited({ errorCode: "0" }, 200)).toBe(false);
  });
});

// ---- 真实 API 集成 ----

describe("有道 — 真实 API 集成", () => {
  it("单条英文翻译为中文", async () => {
    const p = (await youdaoDef.buildPayload(["Hello world"])) as unknown as Payload;
    const res = await fetchPayload(p);

    expect(res.ok).toBe(true);
    expect(String((res.data as Record<string, unknown>).errorCode)).toBe("0");

    const text = youdaoDef.parseResponse(res.data)[0];
    expect(text).toBeTruthy();
    console.log(`  有道: "Hello world" → "${text}"`);
  });
});

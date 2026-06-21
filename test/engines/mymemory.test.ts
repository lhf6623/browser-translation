// ========== MyMemory 引擎测试 ==========

import { describe, expect, it } from "vitest";
import { myMemoryDef } from "../../src/lib/engines/mymemory";
import { fetchPayload, type Payload } from "../helpers";

// ---- buildPayload ----

describe("MyMemory — buildPayload", () => {
  it("构建正确的 URL 结构与参数", () => {
    const p = myMemoryDef.buildPayload(["hello"]) as unknown as Payload;

    expect(p.url).toContain("https://api.mymemory.translated.net/get");
    expect(p.url).toContain("q=hello");
    expect(p.url).toContain("langpair=en%7Czh");
  });

  it("只取 texts[0]", () => {
    const p = myMemoryDef.buildPayload(["first", "second"]) as unknown as Payload;
    expect(p.url).toContain(encodeURIComponent("first"));
    expect(p.url).not.toContain("second");
  });
});

// ---- parseResponse ----

describe("MyMemory — parseResponse", () => {
  it("正常提取译文", () => {
    const data = { responseStatus: 200, responseData: { translatedText: "你好世界" } };
    expect(myMemoryDef.parseResponse(data)).toEqual(["你好世界"]);
  });

  it("responseStatus ≠ 200 返回 [null]", () => {
    expect(myMemoryDef.parseResponse({ responseStatus: 403 })).toEqual([null]);
  });

  it("意外格式不抛异常", () => {
    expect(() => myMemoryDef.parseResponse("raw string")).not.toThrow();
    expect(() => myMemoryDef.parseResponse([])).not.toThrow();
  });
});

// ---- isRateLimited ----

describe("MyMemory — isRateLimited", () => {
  it("HTTP 429 → 限流", () => {
    expect(myMemoryDef.isRateLimited({}, 429)).toBe(true);
  });
  it("HTTP 200 → 不限流", () => {
    expect(myMemoryDef.isRateLimited({}, 200)).toBe(false);
  });
});

// ---- 真实 API 集成 ----

describe("MyMemory — 真实 API 集成", () => {
  it("单条英文翻译为中文", async () => {
    const p = myMemoryDef.buildPayload(["Hello world"]) as unknown as Payload;
    const res = await fetchPayload(p);

    expect(res.ok).toBe(true);
    const text = myMemoryDef.parseResponse(res.data)[0];
    expect(text).toBeTruthy();
    console.log(`  MyMemory: "Hello world" → "${text}"`);
  });
});

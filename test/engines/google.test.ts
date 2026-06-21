// ========== Google 翻译引擎测试 ==========

import { describe, expect, it } from "vitest";
import { googleDef } from "../../src/lib/engines/google";
import { fetchPayload, type Payload } from "../helpers";

// ---- buildPayload ----

describe("Google — buildPayload", () => {
  it("构建正确的 URL 结构与参数", () => {
    const p = googleDef.buildPayload(["hello"]) as unknown as Payload;

    expect(p.url).toContain("https://translate.googleapis.com/translate_a/single");
    expect(p.url).toContain("client=gtx");
    expect(p.url).toContain("sl=en");
    expect(p.url).toContain("tl=zh-CN");
    expect(p.url).toContain("dt=t");
    expect(p.url).toContain(encodeURIComponent("hello"));
  });

  it("只取 texts[0]", () => {
    const p = googleDef.buildPayload(["first", "second"]) as unknown as Payload;
    expect(p.url).toContain(encodeURIComponent("first"));
    expect(p.url).not.toContain("second");
  });
});

// ---- parseResponse ----

describe("Google — parseResponse", () => {
  it("正常解析译文（单段）", () => {
    const data = [[["你好", "hello", null, null, 1]], null, "en"];
    expect(googleDef.parseResponse(data)).toEqual(["你好"]);
  });

  it("拼接多段译文", () => {
    const data = [
      [["你好", "hello", null, null, 1], ["世界", "world", null, null, 1]],
      null, "en",
    ];
    expect(googleDef.parseResponse(data)).toEqual(["你好世界"]);
  });

  it("空结果返回 [null]", () => {
    expect(googleDef.parseResponse(null)).toEqual([null]);
    expect(googleDef.parseResponse([])).toEqual([null]);
    expect(googleDef.parseResponse([[]])).toEqual([null]);
  });
});

// ---- isRateLimited ----

describe("Google — isRateLimited", () => {
  it("HTTP 403 / 429 → 限流", () => {
    expect(googleDef.isRateLimited({}, 403)).toBe(true);
    expect(googleDef.isRateLimited({}, 429)).toBe(true);
  });

  it("HTTP 200 → 不限流", () => {
    expect(googleDef.isRateLimited({}, 200)).toBe(false);
  });
});

// ---- 真实 API 集成 ----

let googleReachable = false;
try {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), 3000);
  await fetch("https://translate.googleapis.com", { signal: ctrl.signal });
  googleReachable = true;
} catch {
  console.warn("  ⚠️  translate.googleapis.com 不可达，跳过 Google 真实 API 测试");
}

describe.skipIf(!googleReachable)("Google — 真实 API 集成", () => {
  it("单条英文翻译为中文", async () => {
    const p = googleDef.buildPayload(["Hello world"]) as unknown as Payload;
    const res = await fetchPayload(p);

    expect(res.ok).toBe(true);
    const text = googleDef.parseResponse(res.data)[0];
    expect(text).toBeTruthy();
    console.log(`  Google: "Hello world" → "${text}"`);
  });
});

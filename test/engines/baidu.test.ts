// ========== 百度翻译引擎测试 ==========

import { describe, expect, it } from "vitest";
import { baiduDef } from "../../src/lib/engines/baidu";
import { fetchPayload, type Payload } from "../helpers";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- buildPayload ----

describe("百度 — buildPayload", () => {
  it("构建 GET URL，含 appid/salt/sign/q/from/to", () => {
    const p = baiduDef.buildPayload(["hello"]) as unknown as Payload;

    expect(p.url).toContain("https://fanyi-api.baidu.com/api/trans/vip/translate");
    expect(p.url).toContain("q=" + encodeURIComponent("hello"));
    expect(p.url).toContain("from=en");
    expect(p.url).toContain("to=zh");
    expect(p.url).toMatch(/appid=[^&]+/);
    expect(p.url).toMatch(/salt=\d+/);
    expect(p.url).toMatch(/sign=[a-f0-9]{32}/);
  });

  it("多条文本用 \\n 拼接", () => {
    const p = baiduDef.buildPayload(["hello", "world"]) as unknown as Payload;
    expect(p.url).toContain(encodeURIComponent("hello\nworld"));
  });

  it("不同文本生成不同 sign", () => {
    const p1 = baiduDef.buildPayload(["hello"]) as unknown as Payload;
    const p2 = baiduDef.buildPayload(["world"]) as unknown as Payload;
    const s1 = p1.url.match(/sign=([a-f0-9]+)/)?.[1];
    const s2 = p2.url.match(/sign=([a-f0-9]+)/)?.[1];
    expect(s1).not.toBe(s2);
  });
});

// ---- parseResponse ----

describe("百度 — parseResponse", () => {
  it("正常提取译文", () => {
    const data = { trans_result: [{ src: "hello", dst: "你好" }] };
    expect(baiduDef.parseResponse(data)).toEqual(["你好"]);
  });

  it("拼接多条结果", () => {
    const data = { trans_result: [{ src: "hello", dst: "你好" }, { src: "world", dst: "世界" }] };
    expect(baiduDef.parseResponse(data)).toEqual(["你好", "世界"]);
  });

  it("无 trans_result 返回空数组", () => {
    expect(baiduDef.parseResponse({})).toEqual([]);
    expect(baiduDef.parseResponse({ error_code: "54003" })).toEqual([]);
  });

  it("意外格式不抛异常", () => {
    expect(() => baiduDef.parseResponse("bad")).not.toThrow();
    expect(() => baiduDef.parseResponse([])).not.toThrow();
  });
});

// ---- isRateLimited ----

describe("百度 — isRateLimited", () => {
  it("error_code=54003 → 限流", () => {
    expect(baiduDef.isRateLimited({ error_code: "54003" }, 200)).toBe(true);
  });

  it("无该字段 → 不限流", () => {
    expect(baiduDef.isRateLimited({}, 200)).toBe(false);
  });
});

// ---- 真实 API 集成 ----

describe("百度 — 真实 API 集成", () => {
  it("单条英文翻译为中文", async () => {
    const p = baiduDef.buildPayload(["Hello"]) as unknown as Payload;
    const res = await fetchPayload(p);

    expect(res.ok).toBe(true);
    const d = res.data as Record<string, unknown>;
    expect(d.error_code).toBeUndefined();

    const text = baiduDef.parseResponse(res.data)[0];
    expect(text).toBeTruthy();
    console.log(`  百度: "Hello" → "${text}"`);
  });

  it("批量（\\n 分隔）翻译多条", async () => {
    await sleep(1100);

    const p = baiduDef.buildPayload(["hello", "world"]) as unknown as Payload;
    const res = await fetchPayload(p);

    expect(res.ok).toBe(true);
    const results = baiduDef.parseResponse(res.data);
    expect(results.length).toBe(2);
    expect(results[0]).toBeTruthy();
    expect(results[1]).toBeTruthy();
    console.log(`  百度批量: "hello"→"${results[0]}" "world"→"${results[1]}"`);
  });
});

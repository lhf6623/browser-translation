# Google 翻译（免费端点）API 参考文档

> 非官方免费接口，无需 API Key / OAuth
> 更新时间：2026-06-21

---

## 当前可用接口

| 接口 | URL | 认证 | 批量支持 | 状态 |
|---|---|---|---|---|
| 文本翻译（主端点） | `https://translate.googleapis.com/translate_a/single` | ❌ 无需 | ❌ 单条 `q` | ✅ 可用 |
| 文本翻译（备用端点） | `https://clients5.google.com/translate_a/single` | ❌ 无需 | ❌ 单条 `q` | ✅ 可用 |
| Google Cloud Translation v3（付费版） | `https://translation.googleapis.com/v3/...` | ✅ API Key / OAuth | ✅ `contents[]` 1024 条 | ✅ 可用 |
| Google Cloud Translation v2（付费版） | `https://translation.googleapis.com/language/translate/v2` | ✅ API Key | ❌ 单条 | ✅ 可用 |

> ⚠️ 本文档只覆盖**免费端点**。付费版（Google Cloud Translation API）需要 API Key 和 Project ID，见附录。

---

## 文本翻译 — 免费端点（主）

### 基本信息

| 项目 | 值 |
|---|---|
| 请求 URL | `https://translate.googleapis.com/translate_a/single` |
| 请求方式 | GET |
| 字符编码 | UTF-8（q 参数需 encodeURIComponent） |
| 响应格式 | JSON（非标准结构，嵌套数组） |
| 认证 | ❌ **无需任何认证** |
| 频率限制 | 无官方声明，实测建议 ≤ **5 次/秒** |
| 国内可用性 | ❌ 需代理 / Cloudflare Worker 反代 |

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `client` | String | ✅ | 固定值 `gtx` |
| `dt` | String | ✅ | 固定值 `t`（返回翻译结果） |
| `sl` | String | ✅ | 源语言代码，`auto` = 自动检测 |
| `tl` | String | ✅ | 目标语言代码，如 `zh-CN`、`en` |
| `q` | String | ✅ | 待翻译文本（URL 编码），**单条，不支持多条** |
| `ie` | String | ❌ | 输入编码，默认 `UTF-8` |
| `oe` | String | ❌ | 输出编码，默认 `UTF-8` |

### 请求示例

```
GET https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=zh-CN&tl=en&q=你好世界
```

### 返回结构（非标准 JSON 数组）

```json
[
  [
    [
      "Hello World",
      "你好世界",
      null,
      null,
      3,
      null,
      null,
      [[]],
      [["af64405095a399ceb1e05c7abb7cda66","zh_en_2023q1.md"]]
    ]
  ],
  null,
  "zh-CN",
  null,
  null,
  null,
  1,
  [],
  [["zh-CN"],null,[1],["zh-CN"]]
]
```

### 返回值解析规则

| 位置 | 含义 | 示例值 |
|---|---|---|
| `res[0]` | 翻译片段数组 | `[[ "Hello World", "你好世界", ... ]]` |
| `res[0][i][0]` | 第 i 段译文 | `"Hello World"` |
| `res[0][i][1]` | 第 i 段原文 | `"你好世界"` |
| `res[2]` | 检测到的源语言 | `"zh-CN"` |

> 长文本会被拆成多个片段，需拼接 `res[0]` 所有 `item[0]` 得到完整译文。

### 解析代码

```javascript
function parseGoogleFreeResponse(res) {
  const translatedText = res[0].map(item => item[0]).join('');
  const detectedLang = res[2];
  return { translatedText, detectedLang };
}
```

---

## 文本翻译 — 免费端点（备用：clients5）

### 基本信息

| 项目 | 值 |
|---|---|
| 请求 URL | `https://clients5.google.com/translate_a/single` |
| 请求方式 | GET |
| 参数 | 与主端点完全一致 |
| 认证 | ❌ 无需 |
| 国内可用性 | ❌ 需代理 |

### 返回结构（更清晰的 JSON）

```json
{
  "sentences": [
    {
      "trans": "你好世界",
      "orig": "Hello World",
      "backend": 3
    }
  ],
  "src": "en",
  "confidence": 1.0,
  "spell": {},
  "ld_result": {
    "srclangs": ["en"],
    "srclangs_confidences": [1.0]
  }
}
```

### 返回值解析规则

| 参数名 | 类型 | 说明 |
|---|---|---|
| `sentences[]` | Array | 翻译片段列表 |
| `sentences[].trans` | String | 译文 |
| `sentences[].orig` | String | 原文 |
| `src` | String | 检测到的源语言 |
| `confidence` | Number | 语言检测置信度（0~1） |

> `clients5` 端点返回结构比 `translate.googleapis.com` 更规范，但稳定性略差。

---

## 批量翻译

免费端点**不支持批量翻译**，只有单个 `q` 参数。

### 应用层批量替代方案

并发调用单条接口，控制频率 ≤ 5 次/秒：

```typescript
async function googleFreeBatchTranslate(
  texts: string[], from: string, to: string
): Promise<string[]> {
  const concurrency = 5;
  const results: string[] = new Array(texts.length);
  const queue = texts.map((t, i) => ({ text: t, idx: i }));

  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const item = queue.shift()!;
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=${from}&tl=${to}&q=${encodeURIComponent(item.text)}`;
      const res = await fetch(url);
      const data = await res.json();
      results[item.idx] = data[0].map(s => s[0]).join('');
      await sleep(200); // 控制频率
    }
  });

  await Promise.all(workers);
  return results;
}
```

---

## 常见语种代码

| 语言 | 代码 | 语言 | 代码 |
|---|---|---|---|
| 简体中文 | `zh-CN` | 英语 | `en` |
| 繁体中文 | `zh-TW` | 日语 | `ja` |
| 韩语 | `ko` | 法语 | `fr` |
| 西班牙语 | `es` | 德语 | `de` |
| 意大利语 | `it` | 俄语 | `ru` |
| 葡萄牙语 | `pt` | 阿拉伯语 | `ar` |
| 自动检测 | `auto` | — | — |

> 源语言可设 `auto` 自动检测，目标语言不支持 `auto`。

---

## 错误处理

免费端点无标准错误码，常见问题：

| 问题 | 表现 | 处理 |
|---|---|---|
| 网络不通 | 请求超时 / ECONNREFUSED | 配置代理或 Cloudflare Worker 反代 |
| 参数错误 | 返回空数组或异常 JSON | 检查 `sl`、`tl`、`q` 参数 |
| 频率限制 | 429 或无响应 | 降低请求频率 |
| q 过长 | 返回被截断的结果 | 控制 q ≤ 5000 字符 |

---

## 国内使用方案

免费端点域名 `translate.googleapis.com` 和 `clients5.google.com` 在中国大陆无法直接访问。

### 方案一：代理

```javascript
const res = await fetch(url, {
  // 或在环境变量中配置 HTTP_PROXY
});
```

### 方案二：Cloudflare Worker 反代

部署一个 Cloudflare Worker 反代 Google 翻译端点，绑定自定义域名：

```javascript
// Cloudflare Worker 代码
export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.hostname = 'translate.googleapis.com';
    const newRequest = new Request(url, request);
    const response = await fetch(newRequest);

    if (response.status !== 200) {
      return new Response(JSON.stringify({ code: 1, msg: 'error' }), {
        headers: { 'content-type': 'application/json' }
      });
    }

    const data = await response.json();
    const text = data[0].map(it => it[0]).join('');
    return new Response(JSON.stringify({ code: 0, msg: 'ok', text }), {
      headers: { 'content-type': 'application/json' }
    });
  }
};
```

> 绑定自定义域名后，国内可免代理直接访问。

---

## 附录：Google Cloud Translation API（付费版）

如需官方批量翻译（`contents[]` 最多 1024 条），需开通 Google Cloud Translation API：

| 项目 | 值 |
|---|---|
| v3 端点 | `https://translation.googleapis.com/v3/projects/{PROJECT_ID}/locations/global:translateText` |
| 认证 | API Key 或 OAuth 2.0 |
| 批量支持 | ✅ `contents[]` 最多 1024 条 |
| 单次字符上限 | 30,000 码点 |
| 免费/月 | 50 万 chars（$10 额度） |
| 超出计费 | $20/百万字符 |
| QPS | 6000 次/分钟 |
| 官方文档 | https://cloud.google.com/translate/docs |

---

## 五引擎批量翻译对比

| | 百度 | 有道 | 腾讯 | MyMemory | **Google（免费）** |
|---|---|---|---|---|---|
| 批量方式 | `\n` 分隔 q | 多 q 字段 | ❌ 已删除 | ❌ 无批量 | **❌ 无批量** |
| 批量接口 | 同单条 | `/v2/api` | — | — | — |
| 单次字符上限 | 6,000 | 5,000 | 6,000 | 500 bytes | **~5,000** |
| 签名方式 | MD5 | SHA-256 | TC3-HMAC-SHA256 | 无 | **无签名** |
| QPS 限制 | 1/10 | 100万/小时 | 5 | ~10/分钟 | **~5/秒** |
| 免费/月 | 5万 chars | 50元体验金 | 500万 chars | 5000 chars/天 | **无限（非官方）** |
| 国内可用 | ✅ | ✅ | ✅ | ✅ | **❌ 需代理** |

---

## 官方链接

| 文档 | 地址 |
|---|---|
| 免费端点参考（掘金） | https://juejin.cn/post/7384632027230519330 |
| 免费端点参考（51CTO） | https://blog.51cto.com/xfxuezhang/14634471 |
| Google Cloud Translation（付费版） | https://cloud.google.com/translate/docs |
| 付费版 API 参考 | https://cloud.google.com/translate/docs/reference/rest |
| 付费版定价 | https://cloud.google.com/translate/pricing |

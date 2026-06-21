# MyMemory 翻译 API 参考文档

> 官方文档：https://mymemory.translated.net/doc/spec.php
> 更新时间：2026-06-21
> API 版本：v2（传统）/ v3（mymemory.dev）

---

## 当前可用接口

| 接口 | URL | 状态 |
|---|---|---|
| 文本翻译（传统） | `https://api.mymemory.translated.net/get` | ✅ 可用 |
| 文本翻译（新版） | `https://api.mymemory.dev/v3/translate` | ✅ 可用 |
| 批量翻译 | ❌ **不支持** | — |
| TMX 导入 | `https://api.mymemory.translated.net/v2/tmx/import` | ✅ 可用 |

> ⚠️ MyMemory **没有批量翻译接口**，只能逐条调用。`q` 参数最大 500 bytes，不适合批量场景。

---

## 文本翻译 API（传统版）

### 基本信息

| 项目 | 值 |
|---|---|
| 请求 URL | `https://api.mymemory.translated.net/get` |
| 请求方式 | GET |
| 字符编码 | UTF-8 |
| 响应格式 | JSON |
| q 参数上限 | **500 bytes** |
| 无需注册 | ✅ 匿名可用 |

### 使用限制

| 限制项 | 匿名用户 | 提供 email | 提供 API key |
|---|---|---|---|
| 每日字符数 | **5,000 chars** | 更高额度 | 更高额度 |
| 每日请求次数 | ~1,000 次 | ~1,000 次 | 更高额度 |
| 建议频率 | ≤ 10 次/分钟 | ≤ 10 次/分钟 | 更高 |

> MyMemory 的频率限制较宽松，没有严格的 QPS 硬限，但建议控制在每分钟 ≤ 10 次以避免被临时限制。

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `q` | String | ✅ | 待翻译文本，UTF-8 编码，**最大 500 bytes** |
| `langpair` | String | ✅ | 语言对，格式 `源语种|目标语种`，如 `en|zh-CN` |
| `mt` | Integer | ❌ | 是否启用机器翻译，`1`=启用（默认），`0`=仅人工翻译 |
| `key` | String | ❌ | API 密钥，获取后可访问私有翻译记忆库 |
| `de` | String | ❌ | 开发者 email，提供后可获得更高额度 |
| `ip` | String | ❌ | 最终用户 IP（CAT 工具和高频使用建议提供） |
| `onlyprivate` | Integer | ❌ | 仅返回私有记忆库匹配，`0`=全部（默认），`1`=仅私有 |

### 返回参数

| 参数名 | 类型 | 说明 |
|---|---|---|
| `responseData` | Object | 主要翻译结果 |
| `responseData.translatedText` | String | 翻译结果文本 |
| `responseData.match` | Number | 匹配度（0~1） |
| `responseData.originalText` | String | 原文（推测） |
| `responseStatus` | Integer | 响应状态，`200`=成功 |
| `responseDetails` | String | 错误详情（失败时） |
| `matches` | Array | 所有匹配结果列表（含人工+机器翻译） |
| `matches[].translation` | String | 译文 |
| `matches[].quality` | Number | 匹配质量 |
| `matches[].match` | String | 匹配类型（`MT`=机器翻译，`HM`=人工翻译） |

### 请求示例

```
GET https://api.mymemory.translated.net/get?q=Hello World!&langpair=en|zh-CN
```

### 返回示例

```json
{
  "responseData": {
    "translatedText": "你好世界!",
    "match": 0.95
  },
  "responseStatus": 200,
  "matches": [
    {
      "id": "428",
      "segment": "Hello World!",
      "translation": "你好世界!",
      "quality": 74,
      "reference": "",
      "match": 0.95,
      "created-by": "MT",
      "last-updated-by": "MT",
      "create-date": "2021-01-01",
      "last-update-date": "2021-01-01"
    }
  ]
}
```

---

## 文本翻译 API（新版 mymemory.dev）

### 基本信息

| 项目 | 值 |
|---|---|
| 请求 URL | `https://api.mymemory.dev/v3/translate` |
| 请求方式 | POST / GET |
| 响应格式 | JSON |
| 认证方式 | API Key（Header 或参数） |

> 新版 API 定价和限制在 mymemory.dev/pricing 上维护，文档较少。传统版 `api.mymemory.translated.net` 是最稳定的接入方式。

---

## 批量翻译

MyMemory **不支持批量翻译**。`q` 参数限制 500 bytes，只能单条逐次调用。

### 应用层批量替代方案

并发调用单条接口，建议控制 ≤ 10 次/分钟：

```typescript
// 简易并发控制
async function myMemoryBatchTranslate(
  texts: string[], from: string, to: string
): Promise<string[]> {
  const results: string[] = [];
  for (const text of texts) {
    // 每个 q 不能超过 500 bytes
    if (Buffer.byteLength(text, 'utf8') > 500) {
      throw new Error(`MyMemory: 单条文本超 500 bytes 限制`);
    }
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.responseStatus !== 200) {
      throw new Error(`MyMemory 翻译错误: ${data.responseDetails}`);
    }
    results.push(data.responseData.translatedText);
    // 控制频率：每分钟不超过 10 次
    await sleep(100);
  }
  return results;
}
```

### 批量翻译限制

| 限制项 | 值 |
|---|---|
| 单条 q 最大长度 | **500 bytes** |
| 批量接口 | ❌ 无 |
| 建议频率 | ≤ 10 次/分钟 |
| 每日字符限额（匿名） | 5,000 chars |

---

## 常见语种代码

MyMemory 使用 ISO 语言代码或 RFC3066 格式：

| 语言 | 代码 | 语言 | 代码 |
|---|---|---|---|
| 简体中文 | `zh-CN` | 英语 | `en` |
| 繁体中文 | `zh-TW` | 日语 | `ja` |
| 韩语 | `ko` | 法语 | `fr` |
| 西班牙语 | `es` | 德语 | `de` |
| 意大利语 | `it` | 俄语 | `ru` |
| 葡萄牙语 | `pt` | 阿拉伯语 | `ar` |
| 印地语 | `hi` | 泰语 | `th` |
| 越南语 | `vi` | 印尼语 | `id` |

> langpair 格式：`源语种|目标语种`，如 `en|zh-CN`、`zh-CN|en`

---

## 错误处理

MyMemory 没有标准错误码列表，通过 `responseStatus` 和 `responseDetails` 判断：

| responseStatus | 含义 | 说明 |
|---|---|--- |
| **200** | 成功 | 翻译结果在 `responseData.translatedText` |
| **403** | 额度超限 | 匿名用户当日 5,000 chars 用完 |
| **429** | 频率受限 | 请求过于频繁 |
| 其他 | 服务异常 | 查看 `responseDetails` |

### 特殊返回

当额度耗尽时，`responseData.translatedText` 可能返回类似：

```
MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN 01 HOUR 23 MINUTES 34 SECONDSVISIT: HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE
```

> ⚠️ 此时应检查 `responseStatus` 是否为 200，或判断 `translatedText` 是否包含 `MYMEMORY WARNING`。

---

## 计费

### 传统版（api.mymemory.translated.net）

| 计划 | 每日字符数 | 价格 | 备注 |
|---|---|---|---|
| **匿名** | 5,000 chars/天 | 免费 | 无需注册，q ≤ 500 bytes |
| **注册 + email** | 更高额度 | 免费 | 提供 `de` 参数 |
| **API Key** | 更高额度 | 按量付费 | 获取密钥后可访问私有 TM |
| **RapidAPI** | — | 按量付费 | 通过 RapidAPI 平台接入 |

> 传统版具体付费额度未公开，需联系商务获取。

### 新版（mymemory.dev）

| 计划 | Memories | Spaces | API requests/day | 价格 |
|---|---|---|---|---|
| **Free** | 1,000 | 3 | 1,000 | 免费 |
| **Standard** | 更高 | 更多 | 更高 | 付费 |
| **Pro** | 最高 | Team spaces | 最高 | 付费 |

> 新版具体价格在 mymemory.dev/pricing 上动态维护。

---

## 在 quick-translate 中的封装建议

```typescript
// engines/mymemory.ts

/** MyMemory 翻译 — 仅支持单条，无批量接口 */
export async function myMemoryTranslate(
  text: string,
  from: string,
  to: string
): Promise<string> {
  // 检查 q 大小
  if (Buffer.byteLength(text, 'utf8') > 500) {
    throw new Error('MyMemory: 单条文本超 500 bytes 限制');
  }

  const langpair = `${from}|${to}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langpair}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.responseStatus !== 200) {
    throw new Error(`MyMemory 翻译错误: ${data.responseDetails}`);
  }

  // 检查额度耗尽警告
  const translated = data.responseData.translatedText;
  if (translated.includes('MYMEMORY WARNING')) {
    throw new Error('MyMemory: 今日免费额度已耗尽');
  }

  return translated;
}
```

---

## 五引擎批量翻译对比

| | 百度 | 有道 | 腾讯 | **MyMemory** | Google |
|---|---|---|---|---|---|
| 批量方式 | `\n` 分隔 q | 多 q 字段 | ❌ 已删除 | **❌ 无批量** | `contents[]` 数组 |
| 批量接口 | 同单条 | `/v2/api` | — | — | 同单条 |
| 单次字符上限 | 6,000 | 5,000 | 6,000 | **500 bytes** | 30K 码点 |
| 签名方式 | MD5 | SHA-256 | TC3-HMAC-SHA256 | **无签名** | API Key / OAuth |
| QPS 限制 | 1/10 | 100万/小时 | 5 | **~10/分钟** | 6000/分钟 |
| 免费/月 | 5万 chars | 50元体验金 | 500万 chars | **5000 chars/天** | 50万 chars |

---

## 官方链接

| 文档 | 地址 |
|---|---|
| API 技术规格 | https://mymemory.translated.net/doc/spec.php |
| 使用限制 | https://mymemory.translated.net/doc/usagelimits.php |
| 新版定价 | https://docs.mymemory.dev/essentials/pricing/ |
| 新版文档 | https://docs.mymemory.dev |
| API 密钥获取 | https://mymemory.translated.net/doc/keygen.php |
| RapidAPI | https://rapidapi.com/translated/api/MyMemory |

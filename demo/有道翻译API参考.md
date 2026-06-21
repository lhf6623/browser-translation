# 有道智云翻译 API 参考

> 最后更新：2026-06-21 | 官方文档：https://ai.youdao.com

---

## 目录

1. [接口总览](#1-接口总览)
2. [文本翻译 API（单条）](#2-文本翻译-api单条)
3. [批量翻译 API](#3-批量翻译-api)
4. [签名方法](#4-签名方法)
5. [语言支持](#5-语言支持)
6. [错误码](#6-错误码)
7. [计费规则](#7-计费规则)
8. [quick-translate engineWrapper 落地](#8-quick-translate-enginewrapper-落地)
9. [官方文档链接](#9-官方文档链接)

---

## 1. 接口总览

| 接口 | 地址 | 用途 | 批量支持 |
|------|------|------|----------|
| 文本翻译 | `https://openapi.youdao.com/api` | 单条文本翻译 | ❌（q 单条） |
| **批量翻译** | `https://openapi.youdao.com/v2/api` | 多条文本批量翻译 | ✅（多 q 字段） |

| 限制项 | 数值 |
|--------|------|
| 单次查询最大字符数 | **5,000** |
| 每小时最大查询次数 | **100 万次** |
| 每小时最大查询字符数 | **120 万字符** |
| 新用户体验金 | **50 元** |

---

## 2. 文本翻译 API（单条）

### 协议须知

| 项目 | 说明 |
|------|------|
| 传输方式 | HTTPS |
| 请求方式 | GET / POST |
| 字符编码 | UTF-8 |
| 请求格式 | 表单 |
| 响应格式 | JSON |

### 请求参数

| 字段名 | 类型 | 含义 | 必填 | 备注 |
|--------|------|------|------|------|
| `q` | text | 待翻译文本 | ✅ | UTF-8 编码 |
| `from` | text | 源语言 | ✅ | 可设 `auto` |
| `to` | text | 目标语言 | ✅ | — |
| `appKey` | text | 应用 ID | ✅ | 在应用管理查看 |
| `salt` | text | 随机字符串 | ✅ | 建议用 UUID |
| `sign` | text | 签名 | ✅ | sha256(appKey+input+salt+curtime+密钥) |
| `signType` | text | 签名类型 | ✅ | 固定值 `v3` |
| `curtime` | text | 当前 UTC 时间戳（秒） | ✅ | 防重放 |
| `ext` | text | 翻译结果音频格式 | ❌ | 支持 mp3 |
| `voice` | text | 发音选择 | ❌ | 0=女声，1=男声，默认女声 |
| `strict` | text | 是否严格按 from/to 翻译 | ❌ | true/false，默认 false |
| `vocabId` | text | 用户术语表 ID | ❌ | — |
| `domain` | text | 领域化翻译 | ❌ | general/computers/medicine/finance/game |
| `rejectFallback` | text | 拒绝领域翻译降级 | ❌ | true/false，默认 false |

### 领域模型

| domain 值 | 含义 | 支持语种 |
|-----------|------|----------|
| `general` | 通用（默认） | 全部 |
| `computers` | 计算机 | 中英互译 |
| `medicine` | 医学 | 中英互译 |
| `finance` | 金融经济 | 中英互译 |
| `game` | 游戏 | 中英互译 |

### 返回参数

| 字段名 | 类型 | 含义 | 备注 |
|--------|------|------|------|
| `errorCode` | text | 错误返回码 | 一定存在 |
| `query` | text | 源语言查询 | 正确时存在 |
| `translation` | Array | 翻译结果 | 正确时存在 |
| `l` | text | 源语言和目标语言 | 一定存在 |
| `dict` | text | 词典 deeplink | 支持语言时存在 |
| `webdict` | text | web deeplink | 支持语言时存在 |
| `tSpeakUrl` | text | 翻译结果发音地址 | 需绑定 TTS 服务 |
| `speakUrl` | text | 源语言发音地址 | 需绑定 TTS 服务 |

### 请求示例

```
POST https://openapi.youdao.com/api

q=你好&from=zh-CHS&to=en&appKey=你的应用ID&salt=随机字符串&sign=签名&signType=v3&curtime=时间戳
```

### 返回示例（中英）

```json
{
  "errorCode": "0",
  "query": "good",
  "translation": ["好"],
  "dict": {
    "url": "yddict://m.youdao.com/dict?le=eng&q=good"
  },
  "webdict": {
    "url": "http://m.youdao.com/dict?le=eng&q=good"
  },
  "l": "EN2zh-CHS",
  "tSpeakUrl": "XXX",
  "speakUrl": "XXX"
}
```

### 返回示例（小语种）

```json
{
  "errorCode": "0",
  "translation": ["大丈夫です"],
  "dict": {
    "url": "yddict://m.youdao.com/dict?le=jap&q=..."
  },
  "webdict": {
    "url": "http://m.youdao.com/dict?le=jap&q=..."
  },
  "l": "zh-CHS2ja",
  "tSpeakUrl": "XXX",
  "speakUrl": "XXX"
}
```

---

## 3. 批量翻译 API

### 与单条接口的区别

| | 单条翻译 | **批量翻译** |
|---|---|---|
| 接口地址 | `/api` | **`/v2/api`** |
| 文本输入 | `q`（单个字段） | **`q`（多字段，如 `q=苹果&q=橘子`）** |
| 返回格式 | `translation` (Array) | **`translateResults`** (JSONArray，含 query+translation) |
| 单次字符上限 | 5,000 | 5,000 |

### 请求参数

| 字段名 | 类型 | 含义 | 必填 | 备注 |
|--------|------|------|------|------|
| `q` | text | 要翻译的文本，可指定多个 | ✅ | **多个用重复字段：`q=苹果&q=橘子`** |
| `from` | text | 源语言 | ✅ | 可设 `auto` |
| `to` | text | 目标语言 | ✅ | — |
| `appKey` | text | 应用 ID | ✅ | — |
| `salt` | text | 随机字符串 | ✅ | 建议用 UUID |
| `sign` | text | 签名 | ✅ | sha256(appKey+input+salt+curtime+密钥) |
| `signType` | text | 签名类型 | ✅ | 固定值 `v3` |
| `curtime` | text | 当前 UTC 时间戳（秒） | ✅ | 防重放 |
| `ext` | text | 翻译结果音频格式 | ❌ | 支持 mp3 |
| `voice` | text | 发音选择 | ❌ | 0=女声，1=男声 |
| `detectLevel` | text | 语言检测粒度 | ❌ | 0=合并检测，1=分别检测，默认 1 |
| `detectFilter` | text | 是否进行语种检测过滤 | ❌ | true/false，默认 true |
| `verifyLang` | text | 是否对语言方向二次核实 | ❌ | true/false，默认 false |
| `vocabId` | text | 用户术语表 ID | ❌ | — |

### 返回参数

| 字段名 | 类型 | 含义 | 备注 |
|--------|------|------|------|
| `errorCode` | text | 错误返回码 | 一定存在 |
| `errorIndex` | JSONArray | 错误结果的序号 | 部分出错时存在，从 0 开始 |
| `translateResults` | JSONArray | 翻译结果 | 正确时存在 |

**translateResults 中每个 JSONObject：**

| 字段名 | 类型 | 含义 |
|--------|------|------|
| `query` | String | 翻译原句 |
| `translation` | String | 翻译结果 |
| `type` | String | 实际翻译语言方向 |
| `verifyResult` | String | 语言方向核实结果（开启 verifyLang 时） |

### 请求示例

```
POST https://openapi.youdao.com/v2/api

q=苹果&q=橘子&q=今天天气怎么样&from=zh-CHS&to=en&appKey=你的应用ID&salt=uuid&sign=签名&signType=v3&curtime=时间戳
```

### 返回示例

```json
{
  "errorCode": 0,
  "translateResults": [
    {
      "query": "苹果",
      "translation": "Apple",
      "type": "zh-CHS2en"
    },
    {
      "query": "橘子",
      "translation": "Orange",
      "type": "zh-CHS2en"
    },
    {
      "query": "今天天气怎么样",
      "translation": "What's the weather like today?",
      "type": "zh-CHS2en"
    }
  ]
}
```

### 批量翻译部分失败

```json
{
  "errorCode": 0,
  "errorIndex": [1],
  "translateResults": [
    {
      "query": "第一个q字段中的原文句子",
      "translation": "第一个q字段对应的译文句子",
      "type": "zh-CHS2en"
    },
    {
      "query": "第二个q字段中的原文句子",
      "translation": "第二个q字段对应的译文句子",
      "type": "zh-CHS2en"
    }
  ]
}
```

> `errorIndex: [1]` 表示第二段翻译失败，但 `translateResults` 中仍会包含该条目——需检查 `errorIndex` 判断哪些条目不可靠。

---

## 4. 签名方法

### 签名类型

`signType = v3`

### 计算公式

```
sign = sha256(应用ID + input + salt + curtime + 应用密钥)
```

### input 的计算

```
if (q.length > 20) {
  input = q前10个字符 + q.length + q后10个字符
} else {
  input = q
}
```

### 批量翻译签名注意

**多个 q 字段需要先拼接为一个字符串再计算 input。**

例如 `q=苹果&q=橘子`：
- 拼接后的 q = `苹果橘子`
- 如果拼接后长度 > 20，取前 10 + 长度 + 后 10

### TypeScript 实现

```typescript
import CryptoJS from 'crypto-js';

function truncate(q: string): string {
  const len = q.length;
  if (len <= 20) return q;
  return q.substring(0, 10) + len + q.substring(len - 10);
}

function generateSign(
  appKey: string,
  q: string,        // 单条=q内容；批量=所有q拼接
  salt: string,
  curtime: string,
  appSecret: string
): string {
  const input = truncate(q);
  const str = appKey + input + salt + curtime + appSecret;
  return CryptoJS.SHA256(str).toString(CryptoJS.enc.Hex);
}
```

### 签名注意事项

1. `q` 必须为 **UTF-8 编码**
2. `salt` + `curtime` 用于防重放，同一请求不可发送两次，`salt` 建议用 UUID
3. 发音功能需在控制台创建 TTS 实例并绑定应用，否则报 **110** 错误
4. 前端直接暴露 `appSecret` 有被盗用风险，应通过后端中转

---

## 5. 语言支持

### auto 自动识别

支持 **14 种**主流语言自动识别：中文、英文、日文、韩文、法文、西班牙文、葡萄牙文、俄文、越南文、德文、阿拉伯文、印尼文、意大利文、印地语

> ⚠️ 其他语种无法自动识别，建议指定语种以提高准确率。

### 常见语种

| 语言 | 代码 | 语言 | 代码 |
|------|------|------|------|
| 简体中文 | `zh-CHS` | 英文 | `en` |
| 繁体中文 | `zh-CHT` | 日文 | `ja` |
| 韩文 | `ko` | 法文 | `fr` |
| 西班牙文 | `es` | 葡萄牙文 | `pt` |
| 意大利文 | `it` | 俄文 | `ru` |
| 越南文 | `vi` | 德文 | `de` |
| 阿拉伯文 | `ar` | 印尼文 | `id` |
| 荷兰文 | `nl` | 泰文 | `th` |
| 印地语 | `hi` | 自动识别 | `auto` |

### 非常见语种（部分）

| 语言 | 代码 | 语言 | 代码 |
|------|------|------|------|
| 粤语 | `yue` | 波斯语 | `fa` |
| 泰语 | `th` | 土耳其语 | `tr` |
| 乌克兰语 | `uk` | 瑞典语 | `sv` |
| 波兰语 | `pl` | 丹麦语 | `da` |
| 芬兰语 | `fi` | 捷克语 | `cs` |
| 罗马尼亚语 | `ro` | 匈牙利语 | `hu` |
| 希腊语 | `el` | 希伯来语 | `he` |
| 缅甸语 | `my` | 高棉语 | `km` |
| 马来语 | `ms` | 蒙古语 | `mn` |

> 完整语种列表含 100+ 种，详见官方文档。

---

## 6. 错误码

### 翻译相关错误码

| 错误码 | 含义 |
|--------|------|
| **0** | 成功 |
| **101** | 缺少必填参数 |
| **102** | 不支持的语言类型 |
| **103** | 翻译文本过长 |
| **104** | 不支持的 API 类型 |
| **105** | 不支持的签名类型 |
| **106** | 不支持的响应类型 |
| **107** | 不支持的传输加密类型 |
| **108** | 应用 ID 无效 |
| **109** | batchLog 格式不正确 |
| **110** | 无相关服务的有效实例（应用未绑定服务） |
| **111** | 开发者账号无效 |
| **112** | 请求服务无效 |
| **113** | q 不能为空 |
| **114** | strict 字段取值无效 |
| **118** | detectLevel 取值错误 |

### 安全与权限错误码

| 错误码 | 含义 |
|--------|------|
| **201** | 解密失败 |
| **202** | 签名检验失败（通常是编码问题，确保 q 为 UTF-8） |
| **203** | 访问 IP 不在白名单 |
| **205** | 请求的接口与应用平台类型不一致 |
| **206** | 时间戳无效导致签名校验失败 |
| **207** | 重放请求（salt+curtime 防重放） |

### 服务端错误码

| 错误码 | 含义 |
|--------|------|
| **301** | 辞典查询失败 |
| **302** | 翻译查询失败 |
| **303** | 服务端其他异常 |
| **304** | 翻译失败，需联系技术支持 |
| **308** | rejectFallback 参数错误 |
| **309** | domain 参数错误 |
| **310** | 未开通领域翻译服务 |

### 计费与限流错误码

| 错误码 | 含义 |
|--------|------|
| **401** | 账户欠费 |
| **402** | offlinesdk 不可用 |
| **411** | 访问频率受限 |
| **412** | 长请求过于频繁 |

---

## 7. 计费规则

### 按量计费

| 语种组合 | 价格（元/百万字符） |
|----------|---------------------|
| 中文与常见语种互译 | **48** |
| 中文与非常见语种互译 | **100** |
| 其他语种间互译 | **100** |
| 专业领域（中英互译） | **60** |

### 资源包（通用翻译）

| 规格 | 有效时长 | 价格 |
|------|----------|------|
| 500 万字符 | 90 天 | 204 元 |
| 1000 万字符 | 180 天 | 398 元 |
| 1 亿字符 | 360 天 | 3,840 元 |

### 资源包（专业领域：中英互译）

| 规格 | 有效时长 | 价格 |
|------|----------|------|
| 500 万字符 | 90 天 | 255 元 |
| 1000 万字符 | 180 天 | 498 元 |
| 1 亿字符 | 360 天 | 4,800 元 |

### 计费说明

- 先消费 **50 元体验金**，体验金耗尽后才扣费
- 月初累计调用量清零，重新计费
- 购买资源包后优先消耗资源包配额
- 资源包到期或耗尽后，自动转为按量计费
- 资源包不支持退款，支付后 10 分钟生效

### 特殊计费场景

以下语种组合按**非常见语种**计费（100 元/百万字符）：

| 源语种 | 目标语种 |
|--------|----------|
| 德语 ↔ 印地语 | — |
| 英语 ↔ 葡萄牙语 | — |
| 印地语 ↔ 荷兰语 | — |
| 印地语 ↔ 葡萄牙语 | — |
| 荷兰语 ↔ 葡萄牙语 | — |

---

## 8. quick-translate engineWrapper 落地

### 有道引擎封装

```typescript
// engines/youdao.ts

interface YoudaoTranslateResult {
  query: string;
  translation: string;
  type: string;
}

/** 单条翻译 */
export async function youdaoTranslate(
  text: string,
  from: string,
  to: string
): Promise<string> {
  const res = await chrome.runtime.sendMessage({
    type: 'TRANSLATE_YOUDAO',
    payload: { q: text, from, to }
  });

  if (res.errorCode !== '0') throw new Error(`有道翻译错误: ${res.errorCode}`);
  return res.translation[0];
}

/** 批量翻译 */
export async function youdaoBatchTranslate(
  texts: string[],
  from: string,
  to: string
): Promise<string[]> {
  const totalLen = texts.reduce((s, t) => s + t.length, 0);
  if (totalLen > 5000) throw new Error('有道批量翻译：总字数超 5000 限制');

  const res = await chrome.runtime.sendMessage({
    type: 'TRANSLATE_YOUDAO_BATCH',
    payload: { qList: texts, from, to }
  });

  if (res.errorCode !== 0) throw new Error(`有道批量翻译错误: ${res.errorCode}`);

  // 检查 errorIndex
  const errorIdx = new Set(res.errorIndex || []);
  return res.translateResults.map(
    (r: YoudaoTranslateResult, i: number) => {
      if (errorIdx.has(i)) throw new Error(`第 ${i} 条翻译失败`);
      return r.translation;
    }
  );
}
```

### Background 签名 + 请求

```typescript
// background/youdao.ts

import CryptoJS from 'crypto-js';

function truncate(q: string): string {
  const len = q.length;
  if (len <= 20) return q;
  return q.substring(0, 10) + len + q.substring(len - 10);
}

function generateSign(
  appKey: string, q: string, salt: string, curtime: string, secret: string
): string {
  const input = truncate(q);
  const str = appKey + input + salt + curtime + secret;
  return CryptoJS.SHA256(str).toString(CryptoJS.enc.Hex);
}

/** 单条翻译请求 */
async function singleRequest(q: string, from: string, to: string) {
  const salt = crypto.randomUUID();
  const curtime = Math.floor(Date.now() / 1000).toString();
  const sign = generateSign(APP_KEY, q, salt, curtime, APP_SECRET);

  const params = new URLSearchParams({
    q, from, to,
    appKey: APP_KEY,
    salt, sign, signType: 'v3', curtime
  });

  const resp = await fetch('https://openapi.youdao.com/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  return resp.json();
}

/** 批量翻译请求 */
async function batchRequest(qList: string[], from: string, to: string) {
  const salt = crypto.randomUUID();
  const curtime = Math.floor(Date.now() / 1000).toString();

  // 多 q 拼接后签名
  const combinedQ = qList.join('');
  const sign = generateSign(APP_KEY, combinedQ, salt, curtime, APP_SECRET);

  const params = new URLSearchParams();
  qList.forEach(q => params.append('q', q));
  params.append('from', from);
  params.append('to', to);
  params.append('appKey', APP_KEY);
  params.append('salt', salt);
  params.append('sign', sign);
  params.append('signType', 'v3');
  params.append('curtime', curtime);

  const resp = await fetch('https://openapi.youdao.com/v2/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  return resp.json();
}
```

### 三引擎批量翻译对比

| | 百度 | 有道 | 腾讯 |
|---|---|---|---|
| 批量方式 | `\n` 分隔 q | 多 q 字段 | ❌ 已删除批量接口 |
| 批量接口 | 同单条 `/api/trans/vip/translate` | `/v2/api` | — |
| 单次字符上限 | 6,000 | 5,000 | 6,000 |
| 签名方式 | MD5（简单） | SHA-256（中等） | TC3-HMAC-SHA256（复杂） |
| QPS 限制 | 标准 1 / 高级 10 | 100万次/小时 | 5 |
| 返回结构 | `trans_result` 数组 | `translateResults` 数组 | — |

---

## 9. 官方文档链接

| 文档 | 地址 |
|------|------|
| 文本翻译 API | https://ai.youdao.com/DOCSIRMA/html/trans/api/wbfy/index.html |
| **批量翻译 API** | https://ai.youdao.com/DOCSIRMA/html/trans/api/plwbfy/index.html |
| 文本翻译报价 | https://ai.youdao.com/DOCSIRMA/html/trans/price/wbfy/index.html |
| 批量翻译报价 | https://ai.youdao.com/DOCSIRMA/html/trans/price/plwbfy/index.html |
| 控制台 | https://ai.youdao.com/appmgr.s |
| 新手指南 | https://ai.youdao.com/doc.s#guide |
| Demo 下载 | Java / Python3 / C# / PHP / Go / JS |

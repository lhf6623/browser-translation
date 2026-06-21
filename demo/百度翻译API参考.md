# 百度翻译 API 参考文档

> 官方文档：https://fanyi-api.baidu.com/doc/23
> 更新时间：2026-06-21
> 通用翻译 API 版本：v2

---

## 当前可用接口

| 接口 | URL | 状态 |
|---|---|---|
| 通用文本翻译 | `https://fanyi-api.baidu.com/api/trans/vip/translate` | ✅ 可用 |
| 大模型文本翻译 | `https://fanyi-api.baidu.com/ait/api/aiTextTranslate` | ✅ 可用 |
| 批量翻译 | 无独立接口，通过通用文本翻译 + `\n` 分隔实现 | ✅ 支持 |

---

## 通用文本翻译 API

### 基本信息

| 项目 | 值 |
|---|---|
| 请求 URL | `https://fanyi-api.baidu.com/api/trans/vip/translate` |
| 请求方式 | GET 或 POST |
| Content-Type（POST） | `application/x-www-form-urlencoded` |
| 字符编码 | UTF-8 |
| 单次字符上限 | **6000 字符**（认证后）；未认证建议 ≤ 2000 字符 |
| 频率限制 | 见下方 QPS 限制表 |

### QPS 限制

| 版本 | 认证要求 | QPS |
|---|---|---|
| 标准版 | 无需认证 | **1 次/秒** |
| 高级版 | 个人认证 | **10 次/秒** |
| 尊享版 | 企业认证 | **100 次/秒** |

> ⚠️ 标准版 QPS=1，对批量翻译非常不友好，建议至少认证为高级版。

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `q` | String | ✅ | 待翻译文本，UTF-8 编码，上限 6000 字符 |
| `from` | String | ✅ | 源语言代码，支持 `auto` 自动检测 |
| `to` | String | ✅ | 目标语言代码，**不可**设置为 `auto` |
| `appid` | String | ✅ | 开发者 APPID |
| `salt` | String | ✅ | 随机数，字母或数字字符串 |
| `sign` | String | ✅ | 签名 = MD5(appid + q + salt + 密钥)，32 位小写 |
| `needIntervene` | Integer | ❌ | 是否使用术语库干预，`1`=是，`0`=否 |
| `tts` | Integer | ❌ | 是否显示语音合成资源，`0`=显示，`1`=不显示 |
| `dict` | Integer | ❌ | 是否显示词典资源，`0`=显示，`1`=不显示 |

### 签名生成方法（MD5）

```
Step 1: 拼接字符串 = appid + q + salt + 密钥
Step 2: sign = MD5(拼接字符串) → 32 位小写
```

**关键注意事项：**
- q 必须是 UTF-8 编码
- **生成签名时 q 不做 URL encode**，签名生成后发送请求前才 URL encode
- 多数签名错误是因为签名前对 q 做了 URL encode

```typescript
// 签名示例
import { createHash } from 'crypto';

function generateSign(appid: string, q: string, salt: string, key: string): string {
  const str = appid + q + salt + key;
  return createHash('md5').update(str, 'utf8').digest('hex');
}
```

### 返回参数

| 参数名 | 类型 | 说明 |
|---|---|---|
| `from` | String | 源语言（auto 时返回检测到的语种） |
| `to` | String | 目标语言 |
| `trans_result` | Array | 翻译结果数组 |
| `trans_result[].src` | String | 原文 |
| `trans_result[].dst` | String | 译文 |
| `error_code` | Integer | 错误码（仅出错时返回） |
| `error_msg` | String | 错误信息（仅出错时返回） |

### 返回示例

```json
{
    "from": "en",
    "to": "zh",
    "trans_result": [
        {
            "src": "apple",
            "dst": "苹果"
        }
    ]
}
```

---

## 批量翻译

百度翻译**没有独立的批量翻译接口**，但通过在 `q` 参数中用 `\n`（换行符）分隔多段文本，一次请求即可翻译多段，每段返回独立的翻译结果。

### 批量翻译请求示例

```
q = "Hello\nGood morning\nHow are you"
from = "en"
to = "zh"
```

### 批量翻译返回示例

```json
{
    "from": "en",
    "to": "zh",
    "trans_result": [
        { "src": "Hello", "dst": "你好" },
        { "src": "Good morning", "dst": "早上好" },
        { "src": "How are you", "dst": "你好吗" }
    ]
}
```

`trans_result` 数组与输入的 `\n` 分隔段**一一对应**，按 index 取结果即可。

### 批量翻译限制

| 限制项 | 值 |
|---|---|
| 单次请求总字符数 | ≤ **6000 字符**（认证后） |
| 建议单次请求字符数 | ≤ **2000 字符**（保证质量） |
| `\n` 分隔段数 | 无硬性限制，但总字符不超限 |
| 长文本频率限制 | 超过 10000 字节的 query，3 秒内不得频繁发送 |

### 批量翻译签名注意

签名拼接时，`q` 包含换行符，**换行符也要参与签名计算**：

```typescript
// 批量翻译签名
const texts = ["你好", "今天天气怎么样"];
const q = texts.join('\n');  // "你好\n今天天气怎么样"
const sign = md5(appid + q + salt + secretKey);  // q 中包含 \n
```

---

## 大模型文本翻译 API（新）

### 基本信息

| 项目 | 值 |
|---|---|
| 请求 URL | `https://fanyi-api.baidu.com/ait/api/aiTextTranslate` |
| 请求方式 | POST |
| Content-Type | `application/json` |
| 单次字符上限 | **6000 字符** |
| 鉴权方式 | Bearer Token（推荐）或 sign 签名 |

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `appid` | String | ✅ | APPID |
| `q` | String | ✅ | 待翻译文本，UTF-8，上限 6000 字符 |
| `from` | String | ✅ | 源语言，支持 `auto` |
| `to` | String | ✅ | 目标语言 |
| `model_type` | String | ❌ | `llm`=大模型翻译（默认），`nmt`=机器翻译 |
| `reference` | String | ❌ | 翻译指令，如"使用学术风格来翻译"，上限 500 字符 |
| `tag_handling` | Integer | ❌ | 标签保持，`1`=开，`0`=关（默认，仅 nmt） |
| `ignore_tags` | Array | ❌ | 不翻译的标签，最多 20 个（仅 nmt + tag_handling=1） |
| `needIntervene` | Integer | ❌ | 术语库干预，`1`=是，`0`=否 |
| `salt` | String | ❌ | 随机数（sign 鉴权时必填） |
| `sign` | String | ❌ | 签名（sign 鉴权时必填） |

### 鉴权方式

**方式一：Bearer Token（推荐）**
```
Authorization: Bearer YOUR_API_KEY
```
API Key 在管理控制台 → API Key 管理页面创建。

**方式二：sign 签名**（与通用翻译 API 相同的 MD5 签名方式）

### 请求示例

```bash
curl -X POST "https://fanyi-api.baidu.com/ait/api/aiTextTranslate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "appid": "YOUR_APPID",
    "from": "zh",
    "to": "en",
    "q": "你好世界"
  }'
```

---

## 常见语种代码

| 语言 | 代码 | 语言 | 代码 | 语言 | 代码 |
|---|---|---|---|---|---|
| 自动检测 | `auto` | 中文简体 | `zh` | 中文繁体 | `cht` |
| 英语 | `en` | 日语 | `jp` | 韩语 | `kor` |
| 法语 | `fra` | 西班牙语 | `spa` | 俄语 | `ru` |
| 德语 | `de` | 意大利语 | `it` | 葡萄牙语 | `pt` |
| 泰语 | `th` | 越南语 | `vie` | 阿拉伯语 | `ara` |
| 印地语 | `hi` | 印尼语 | `id` | 马来语 | `may` |
| 荷兰语 | `nl` | 波兰语 | `pl` | 瑞典语 | `swe` |
| 丹麦语 | `dan` | 芬兰语 | `fin` | 捷克语 | `cs` |
| 希腊语 | `el` | 匈牙利语 | `hu` | 罗马尼亚语 | `rom` |
| 粤语 | `yue` | 文言文 | `wyw` | 土耳其语 | `tr` |
| 保加利亚语 | `bul` | 爱沙尼亚语 | `est` | 斯洛文尼亚语 | `slo` |

> 完整支持 201 种语言，非常用语种需企业尊享版。详见官方文档。

---

## 错误码

| 错误码 | 含义 | 解决方案 |
|---|---|---|
| 52000 | 成功 | — |
| 52001 | 请求超时 | 检查 q 是否正常文本，语言对是否支持 |
| 52002 | 系统错误 | 重试 |
| 52003 | 未授权用户 | 检查 appid 是否正确，服务是否开通 |
| 54000 | 必填参数为空 | 检查是否漏传参数 |
| 54001 | 签名错误 | 检查签名生成方法，q 签名前不要 URL encode |
| 54003 | 访问频率受限 | 降低调用频率，或认证升级版本 |
| 54004 | 账户余额不足 | 充值 |
| 54005 | 长 query 请求频繁 | 超 1 万字节的 query 3 秒后再试 |
| 58000 | 客户端 IP 非法 | 检查服务器 IP 配置 |
| 58001 | 译文语言方向不支持 | 检查语言代码，标准/高级版仅支持 28 种常见语种 |
| 58002 | 服务当前已关闭 | 前往控制台开启服务 |
| 58003 | 此 IP 已被封禁 | 同一 IP 当日使用多 APPID 会被封禁，次日解封 |
| 58004 | 模型参数错误 | model_type 须为 "llm" 或 "nmt" |
| 59002 | 翻译指令过长 | reference 参数超 500 字符 |
| 59003 | 请求文本过长 | q 超 6000 字符 |
| 59004 | QPS 超限 | 当前接口 QPS 已触及上限 |
| 90107 | 认证未通过 | 前往我的认证查看进度 |
| 20003 | 安全风险 | 检查文本内容 |

---

## 计费

| 版本 | 免费额度 | 超出单价 | QPS |
|---|---|---|---|
| 标准版 | 5 万字符/月（未认证） | ¥49/百万字符 | 1 |
| 高级版（个人认证） | 50 万字符/月 | ¥49/百万字符 | 10 |
| 尊享版（企业认证） | 100 万字符/月 | ¥49/百万字符 | 100 |

> 字符统计：源语言字符长度，一个汉字/字母/标点均计为一个字符。

---

## 通用翻译 vs 大模型翻译 对比

| 对比项 | 通用翻译 API | 大模型翻译 API |
|---|---|---|
| URL | `/api/trans/vip/translate` | `/ait/api/aiTextTranslate` |
| 鉴权 | MD5 sign | Bearer Token 或 sign |
| Content-Type | `application/x-www-form-urlencoded` | `application/json` |
| 批量翻译 | `\n` 分隔多段 | `\n` 分隔多段 |
| 模型选择 | 无 | `llm` 或 `nmt` |
| 翻译指令 | 不支持 | `reference` 参数 |
| 标签保持 | 不支持 | `tag_handling` 参数（仅 nmt） |
| 术语库 | `needIntervene` | `needIntervene` |

---

## 在 quick-translate 中的封装建议

```typescript
// engines/baidu.ts

/** 百度翻译 — 通用翻译 API（支持批量） */
export async function baiduTranslate(
  texts: string[],
  from: string,
  to: string
): Promise<string[]> {
  // 用 \n 拼接多段文本实现批量
  const q = texts.join('\n');

  // 总字符数检查
  if (q.length > 6000) throw new Error('百度翻译：总字符数超 6000 限制');

  const salt = String(Date.now());
  const sign = md5(appid + q + salt + secretKey);

  const res = await fetch('https://fanyi-api.baidu.com/api/trans/vip/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      q, from, to, appid, salt, sign
    })
  });

  const data = await res.json();
  if (data.error_code) throw new Error(`百度翻译错误 ${data.error_code}: ${data.error_msg}`);

  // trans_result 数组与输入一一对应
  return data.trans_result.map((r: any) => r.dst);
}
```

---

## 官方链接

| 文档 | 地址 |
|---|---|
| 通用翻译 API 文档 | https://fanyi-api.baidu.com/doc/23 |
| 大模型翻译 API 文档 | https://fanyi-api.baidu.com/doc/21 |
| 开放平台首页 | https://fanyi-api.baidu.com |
| 开通服务 | https://fanyi-api.baidu.com/choose |
| 管理控制台 | https://fanyi-api.baidu.com/manage |
| Apifox 镜像 | https://baidufanyi.apifox.cn/api-26880827 |

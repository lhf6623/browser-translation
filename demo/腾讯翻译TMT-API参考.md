# 腾讯云机器翻译（TMT）API 参考文档

> 官方文档：https://cloud.tencent.com/document/api/551/15619
> 更新时间：2026-06-21
> API 版本：2018-03-21

---

## 当前可用接口

| 接口 | Action | 状态 |
|---|---|---|
| 文本翻译 | `TextTranslate` | ✅ 可用 |
| 图片翻译（LLM） | `ImageTranslateLLM` | ✅ 可用 |
| 批量文本翻译 | `TextTranslateBatch` | ❌ 已删除（2026-03-12） |
| 文件翻译 | `FileTranslate` | ❌ 已删除 |
| 语种识别 | `LanguageDetect` | ❌ 已删除 |
| 语音翻译 | `SpeechTranslate` | ❌ 已删除 |
| 图片翻译 | `ImageTranslate` | ❌ 已删除 |

---

## TextTranslate — 文本翻译

### 基本信息

| 项目 | 值 |
|---|---|
| 请求域名 | `tmt.tencentcloudapi.com` |
| 请求方式 | POST |
| Content-Type | `application/json` |
| Action | `TextTranslate` |
| Version | `2018-03-21` |
| 频率限制 | **5 次/秒** |
| 单次文本上限 | **6000 字符**（UTF-8 编码） |

### 请求头（公共参数）

| Header | 必填 | 说明 |
|---|---|---|
| `X-TC-Action` | ✅ | 固定值 `TextTranslate` |
| `X-TC-Version` | ✅ | 固定值 `2018-03-21` |
| `X-TC-Timestamp` | ✅ | 当前 UNIX 时间戳，与服务器相差不超过 5 分钟 |
| `X-TC-Region` | ✅ | 地域，如 `ap-guangzhou` |
| `Authorization` | ✅ | TC3-HMAC-SHA256 签名 |
| `X-TC-Token` | ❌ | 临时安全凭证 Token，长期密钥不传 |
| `X-TC-Language` | ❌ | 返回语言，`zh-CN` 或 `en-US` |

### 请求体参数

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `SourceText` | String | ✅ | 待翻译文本，UTF-8 编码，上限 6000 字符 |
| `Source` | String | ✅ | 源语言代码，支持 `auto` 自动识别 |
| `Target` | String | ✅ | 目标语言代码 |
| `ProjectId` | Integer | ✅ | 项目 ID，无配置填 `0` |
| `UntranslatedText` | String | ❌ | 不翻译的内容（人名、地名等名词，每次仅支持一个） |
| `TermRepoIDList` | Array of String | ❌ | 术语库 ID 列表 |
| `SentRepoIDList` | Array of String | ❌ | 例句库 ID 列表 |

### 支持的语言

| 语言代码 | 语言 | 可翻译到 |
|---|---|---|
| `auto` | 自动识别 | — |
| `zh` | 简体中文 | zh-TW, en, ja, ko, fr, es, it, de, tr, ru, pt, vi, id, th, ms, ar |
| `zh-TW` | 繁体中文 | zh, en, ja, ko, fr, es, it, de, tr, ru, pt, vi, id, th, ms, ar |
| `en` | 英语 | zh, zh-TW, ja, ko, fr, es, it, de, tr, ru, pt, vi, id, th, ms, ar, hi |
| `ja` | 日语 | zh, zh-TW, en, ko |
| `ko` | 韩语 | zh, zh-TW, en, ja |
| `fr` | 法语 | zh, zh-TW, en, es, it, de, tr, ru, pt |
| `es` | 西班牙语 | zh, zh-TW, en, fr, it, de, tr, ru, pt |
| `it` | 意大利语 | zh, zh-TW, en, fr, es, de, tr, ru, pt |
| `de` | 德语 | zh, zh-TW, en, fr, es, it, tr, ru, pt |
| `tr` | 土耳其语 | zh, zh-TW, en, fr, es, it, de, ru, pt |
| `ru` | 俄语 | zh, zh-TW, en, fr, es, it, de, tr, pt |
| `pt` | 葡萄牙语 | zh, zh-TW, en, fr, es, it, de, tr, ru |
| `vi` | 越南语 | zh, zh-TW, en |
| `id` | 印尼语 | zh, zh-TW, en |
| `th` | 泰语 | zh, zh-TW, en |
| `ms` | 马来语 | zh, zh-TW, en |
| `ar` | 阿拉伯语 | zh, zh-TW, en |
| `hi` | 印地语 | en |

### 返回参数

| 参数名 | 类型 | 说明 |
|---|---|---|
| `TargetText` | String | 翻译结果文本 |
| `Source` | String | 源语言（实际识别结果） |
| `Target` | String | 目标语言 |
| `UsedAmount` | Integer | 本次消耗字符数 |
| `RequestId` | String | 唯一请求 ID |

### 请求示例

```http
POST / HTTP/1.1
Host: tmt.tencentcloudapi.com
Content-Type: application/json
X-TC-Action: TextTranslate
X-TC-Version: 2018-03-21
X-TC-Timestamp: 1719000000
X-TC-Region: ap-guangzhou
Authorization: TC3-HMAC-SHA256 Credential=AKIDxxxx/2024-06-21/tmt/tc3_request, SignedHeaders=content-type;host, Signature=xxxx

{
    "SourceText": "你好世界",
    "Source": "zh",
    "Target": "en",
    "ProjectId": 0
}
```

### 返回示例

```json
{
    "Response": {
        "TargetText": "Hello world",
        "Source": "zh",
        "Target": "en",
        "UsedAmount": 4,
        "RequestId": "beb15bd7-29aa-4f0f-9a80-574d6fc3733f"
    }
}
```

---

## 签名方法：TC3-HMAC-SHA256

### 签名步骤

```
1. 拼接规范请求串
   CanonicalRequest =
     HTTPRequestMethod + '\n' +
     CanonicalURI + '\n' +
     CanonicalQueryString + '\n' +
     CanonicalHeaders + '\n' +
     SignedHeaders + '\n' +
     HashedRequestPayload

2. 拼接待签名字符串
   StringToSign =
     "TC3-HMAC-SHA256" + '\n' +
     Timestamp + '\n' +
     Date + "/tmt/tc3_request" + '\n' +
     SHA256(CanonicalRequest)

3. 计算签名
   SecretDate    = HMAC-SHA256("TC3" + SecretKey, Date)
   SecretService = HMAC-SHA256(SecretDate, "tmt")
   SecretSigning = HMAC-SHA256(SecretService, "tc3_request")
   Signature     = HMAC-SHA256(SecretSigning, StringToSign)

4. 拼接 Authorization
   Authorization = "TC3-HMAC-SHA256 Credential=" + SecretId + "/" + Date + "/tmt/tc3_request, SignedHeaders=content-type;host, Signature=" + Signature
```

### 签名关键参数

| 参数 | 值 |
|---|---|
| Service | `tmt` |
| Host | `tmt.tencentcloudapi.com` |
| SignedHeaders | `content-type;host` |
| Region | `ap-guangzhou`（推荐） |

---

## 错误码

### 常见业务错误码

| 错误码 | 说明 |
|---|---|
| `FailedOperation.NoFreeAmount` | 本月免费额度已用完 |
| `FailedOperation.ServiceIsolate` | 账号欠费停服 |
| `FailedOperation.UserNotRegistered` | 服务未开通 |
| `FailedOperation.LanguageRecognitionErr` | 无法识别语种 |
| `InternalError.BackendTimeout` | 后台超时，稍后重试 |
| `LimitExceeded.LimitedAccessFrequency` | 超出频率限制（5次/秒） |
| `UnsupportedOperation.TextTooLong` | 文本超 6000 字符 |
| `UnsupportedOperation.UnsupportedLanguage` | 不支持的语言对 |
| `AuthFailure.SignatureFailure` | 签名错误 |
| `AuthFailure.SignatureExpire` | 签名过期（时间差 > 5 分钟） |

---

## 计费

| 项目 | 说明 |
|---|---|
| 免费额度 | 每月 500 万字符 |
| 超出计费 | ¥58 / 百万字符 |
| 计费单位 | 按源语言字符数计算 |

---

## 批量翻译替代方案

`TextTranslateBatch` 已于 2026-03-12 删除。需在应用层自行实现批量：

- 并发调用 `TextTranslate`，控制并发 ≤ 5（频率限制）
- 建议使用信号量/令牌桶控制速率
- 每条请求文本 ≤ 6000 字符

```typescript
// 并发控制示例
async function batchTranslate(
  texts: string[], from: string, to: string
): Promise<string[]> {
  const limit = 5;
  const results: string[] = new Array(texts.length);
  let index = 0;

  const worker = async () => {
    while (index < texts.length) {
      const i = index++;
      results[i] = await singleTranslate(texts[i], from, to);
    }
  };

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}
```

---

## 官方链接

| 文档 | 地址 |
|---|---|
| API 文档 | https://cloud.tencent.com/document/api/551/15619 |
| 签名方法 | https://cloud.tencent.com/document/api/551/15615 |
| 错误码 | https://cloud.tencent.com/document/api/551/30637 |
| API Explorer | https://console.cloud.tencent.com/api/explorer?Product=tmt&Version=2018-03-21&Action=TextTranslate |
| 更新历史 | https://cloud.tencent.com/document/product/551/17231 |
| Node.js SDK | https://github.com/TencentCloud/tencentcloud-sdk-nodejs |

# 快捷翻译 - Chrome 扩展

> 快捷键翻译整页为英→中双语对照，5 引擎智能调度。

## 安装

1. 打开 `chrome://extensions`，开启「开发者模式」
2. 点击「加载已解压的扩展程序」，选择本项目文件夹

## 使用

| 操作 | 效果 |
|------|------|
| `Ctrl+Shift+E`（Mac: `⌘+Shift+E`） | 翻译整页 |
| 再按一次 | 还原，移除所有译文 |
| 同域名下翻页 | 自动续翻（sessionStorage） |
| 关闭标签 / 浏览器 | 自动清除翻译状态 |

## 文件结构

```
├── manifest.json          MV3 配置
├── background.js          Service Worker：快捷键 + CORS 代理（BD/YD/TX）
├── config.js              API 密钥
│
├── content-core.js        常量 · 状态(S/cancelled/translatedEls) · 引擎池 · pickEngine
├── content-debug.js       调试面板（popup 开关，点击收缩/展开）
├── content-translate.js   调度核心：translateText · hashKey · cleanHtml
├── content-scanner.js     文本块扫描：findBlocks · visible · inView（扫描 document.body）
├── content-insert.js      译文插入与移除（含 removeAll 清 loader/属性）
├── content.js             主逻辑：事件 · toggle · doBlocks · scanAndTranslate
│
├── engine-mm.js           MyMemory（无 Key）
├── engine-gt.js           Google Translate（无 Key）
├── engine-bd.js           百度（含 MD5）
├── engine-yd.js           有道（含 SHA-256）
├── engine-tx.js           腾讯
│
├── styles.css             样式
├── popup.html / popup.js  弹窗
└── icons/                 图标
```

### 加载顺序

```
content-core → config → content-debug
  → engine-mm → engine-gt → engine-bd → engine-yd → engine-tx
  → content-translate → content-scanner → content-insert → content
```

## 架构

```
快捷键 / 域名续翻
  │
  ▼
translatePage() → findBlocks() → doBlocks()
                    │               │
                    │ 全量扫描       │ 单 worker
                    │ 跳过已翻译      │ pickEngine() 轮转找空闲
                    ▼               ▼
               inView 过滤      translateText()
               视口内入队          │
                                 ├── 内存缓存 (Map)
                                 ├── 持久缓存 (chrome.storage)
                                 └── 引擎池: MM GT BD YD TX

滚动/缩放 → scanAndTranslate() → 链式补译
                                      │
                              翻译完 → setTimeout 100ms 再扫
```

## 引擎调度

- **单 worker** 串行翻译，`pickEngine()` 轮转选择空闲引擎
- 引擎状态：`busy` / `lastCall` / `rateLimitUntil`（限速冷却 60s）
- 限速检测：MM 429、GT 403/429、BD 54003、YD 411、TX LimitExceeded
- 翻译失败 → 塞回队尾换引擎；视口外 → 跳过不标记，下次重扫
- 译文 == 原文 → 照样插入，给用户反馈

## 状态管理

`<html qt-state>` 属性：`""` | `"translating"` | `"translated"`

## 配置

| 参数 | 值 | 说明 |
|------|-----|------|
| `DELAY_MS` | 200 | 引擎请求间隔 |
| `MAX_TEXT_LEN` | 800 | 单次翻译文本上限 |
| `MIN_TEXT_LEN` | 1 | 文本块最小字符 |
| `VIEWPORT_MARGIN` | 300 | 视口扩展边距 |
| `API_TIMEOUT_MS` | 8000 | API 超时 |

## 权限

| 权限 | 用途 |
|------|------|
| `activeTab` | 当前标签注入 |
| `scripting` | 动态注入 |
| `storage` | 翻译缓存 + 调试开关状态 + 清除缓存 |
| `host_permissions` | 翻译 API + CORS 代理 |

## 已知坑

- **腾讯云 TC3 签名**：canonical headers 和 signed headers 之间需要**两个** `\n`（`canonicalHeaders` 末尾自带一个，模板里再拼一个），否则 `AuthFailure.SignatureFailure`。

## 功能

- **调试面板**：popup 开关控制，点击标题栏右侧 `—`/`+` 收缩展开
- **清空缓存**：popup 底部「清空缓存」一键清除内存和持久缓存
- **视口优先**：只翻译可见区域内容，滚走即跳过，下次滚回来再翻

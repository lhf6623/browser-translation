# 快捷翻译 - 浏览器扩展

> 快捷键翻译整页为英→中双语对照，5 引擎并发调度。
> 基于 **WXT + TypeScript + Vue 3** 工程化重构。

## 安装 & 开发

```bash
# 安装依赖
npm install

# 配置 API 密钥
cp .env.example .env
# 编辑 .env 填入百度/有道/腾讯的 API 密钥

# 开发（带 HMR）
npm run dev

# 构建
npm run build              # Chrome MV3
npm run build:firefox      # Firefox
```

## 加载扩展

**Chrome**：

1. `npm run build`
2. 打开 `chrome://extensions`，开启「开发者模式」
3. 点击「加载已解压的扩展程序」，选择 `.output/chrome-mv3` 文件夹

**Firefox**：

1. `npm run build:firefox`
2. 打开 `about:debugging` → 「此 Firefox」→「临时加载附加组件」
3. 选择 `.output/firefox-mv2/manifest.json`

## 使用

| 操作 | 效果 |
| ------ | ------ |
| `Ctrl+Shift+E` | 翻译整页 |
| 再按一次 | 还原，移除所有译文 |
| 同域名下翻页 | 自动续翻（sessionStorage） |
| 关闭标签 / 浏览器 | 自动清除翻译状态 |

## 工程结构

```text
src/
├── entrypoints/            # WXT 入口
│   ├── background.ts       # Service Worker: 快捷键 + 统一 CORS 代理
│   ├── content.ts          # Content Script 入口：翻译流程 + 滚动补译
│   ├── styles.css          # 译文样式
│   └── popup/
│       ├── index.html      # 弹窗页面
│       ├── main.ts         # 弹窗入口（挂载 Vue 3）
│       └── App.vue         # 弹窗 UI 组件
├── lib/                    # 共享模块
│   ├── index.ts            # 统一导出
│   ├── state.ts            # 状态机（S）+ 全局可变状态
│   ├── constants.ts        # 配置常量 · CSS 类名 · 标签集合
│   ├── utils/              # 工具函数
│   │   ├── index.ts         # sleep / withTimeout / inView / cleanHtml
│   │   ├── cache.ts         # LRUCache / memCache / hashKey
│   │   └── dom.ts           # hasDirect / directText / visible
│   ├── qtelement.ts        # DOM 元素抽象层（data-qt 属性 + 文本提取 + 译文插入）
│   ├── scanner.ts          # DOM 文本块扫描（迭代栈遍历）
│   ├── translator.ts       # 翻译调度：缓存查询 + API 调用 + 并发 worker + 黑名单重试
│   ├── cleanup.ts          # 翻译清理（移除译文 DOM + 清状态 + 删 sessionStorage）
│   ├── config.ts           # API 密钥（从构建时环境变量注入）
│   ├── debug/              # 调试面板
│   │   ├── index.ts        # 状态 + 日志（initDebug 显式初始化）
│   │   └── DebugPanel.vue  # UI 组件
│   └── engines/            # 翻译引擎
│       ├── types.ts        # 类型定义（EngineDef / EngineState / EngineResult）
│       ├── pool.ts         # 引擎调度池（engines[] + pickEngine + pickReady）
│       ├── executor.ts     # 统一执行层：sendMessage → background → parseResponse
│       ├── registry.ts     # 引擎注册表（名字 → 定义映射）
│       ├── google.ts       # Google Translate
│       ├── baidu.ts        # 百度翻译（含内联 MD5）
│       ├── youdao.ts       # 有道翻译
│       ├── tencent.ts      # 腾讯翻译
│       └── mymemory.ts     # MyMemory
└── public/
    └── icons/              # 扩展图标
```

## 架构

```text
快捷键 / 域名续翻
  │
  ▼
translatePage() → findBlocks() → doBlocks()
                    │               │
                    │ 全量 DOM 扫描   │ pickReady() → 多引擎并发
                    │ 跳过已翻译/失败   │
                    ▼               ▼
               inView 过滤      translateWorker × N
               视口内入队          │
                                 ├── 内存缓存 (LRU Map, 上限 1000)
                                 ├── 持久缓存 (chrome.storage)
                                 └── 引擎池: MM GT BD YD TX
                                      │
                                      └── 各自独立 delayMs 并发执行

滚动/缩放 → scanAndTranslate() → 链式补译
                                      │
                              翻译完 → setTimeout 100ms 再扫
```

## 统一代理架构

所有引擎的 HTTP 请求统一经过 background service worker 代理，content script 不直接发起跨域请求。

```text
content script                         background (service worker)
     │                                         │
     │  buildPayload(text)                     │
     │  → { url, method?, headers?, body? }    │
     │                                         │
     │  sendMessage({ _type:"proxy", ... })    │
     │────────────────────────────────────────>│
     │                                         │  proxyFetch(url, init, signal)
     │                                         │  → 统一 AbortController + 8s 超时
     │                                         │  → 返回 { ok, status, data }
     │     返回结果                             │
     │<────────────────────────────────────────│
     │                                         │
     │  parseResponse(data) → 译文              │
     │  isRateLimited(data) → 限流判断          │
```

**为什么全部走代理？**

1. **密钥安全**：百度/有道/腾讯需要 API 密钥签名，密钥只存在于 content script 的 isolated world（通过 `import.meta.env` 注入），但签名逻辑（MD5 / SHA-256 / HMAC）在 content script 侧完成。请求通过 background 发出，避免直接将带签名的 URL 暴露在页面上下文。

2. **实现统一**：超时控制（`AbortController`）、错误捕获、限流判断全部收敛在 `executor.ts`，各引擎只需声明三个纯函数：`buildPayload`（拼请求）、`parseResponse`（解析响应）、`isRateLimited`（判断限流）。

3. **CORS 绕行**：content script 所在页面的 origin 与翻译 API 不同源，通过 background 发起请求不受页面 CORS 策略限制（需 `host_permissions` 声明）。

## QtElement 元素抽象

避免直接操作 DOM 属性，通过 `QtElement` 封装元素生命周期：

| 属性 | 含义 | 设置者 |
| ------ | ------ | ------ |
| `data-qt="1"` | 翻译成功 | `insertTranslation()` → `finish()` |
| `data-qt-failed="1"` | 全部引擎翻译失败 | `tryTranslateElement` → `markFailed()` |
| `data-qt-bl="MM,GT,…"` | 翻译失败的引擎名单 | `addBlock()` |

两种"完成"状态自动被扫描器跳过：

```text
data-qt="1"        → 翻译成功，显示译文
data-qt-failed="1" → 全部引擎失败，静默放弃
```

切换翻译开关时 `QtElement.removeAll()` 移除所有译文 DOM 并清除全部属性，重新开始。

## 引擎定义

每个引擎只导出一个声明式配置对象，不导出函数：

```ts
export const googleDef: EngineDef = {
  name: "GT",

  buildPayload: (text) => ({           // 拼请求参数
    url: `https://translate.googleapis.com/translate_a/single?...`,
  }),

  parseResponse: (data) => {           // 从响应中提取译文
    const arr = data as [unknown[]] | null;
    return arr?.[0]?.map(...).join("") || null;
  },

  isRateLimited: (_data, status) => {  // 判断限流（HTTP status + response body）
    return status === 403 || status === 429;
  },
};
```

`executor.ts` 统一处理：`sendMessage` 通信 → `withTimeout` 超时 → 调用 `isRateLimited(data, status)` → `parseResponse(data)`。不包含任何引擎特定逻辑，所有错误判断（HTTP 状态码、body 错误码）由各引擎的 `isRateLimited` 自行决定。

**新增引擎**只需写一个配置文件 + 在 `registry.ts` 注册一行，无需改 executor / background / translator。

## 引擎调度

- **多引擎并发**：`pickReady()` 筛选所有空闲（不 busy、未限流、已过间隔）引擎，`Promise.all` 并发启动 worker
- **独立请求间隔**：每个引擎独立 `delayMs`，避免同时打爆 API

| 引擎 | delayMs | 说明 |
| ------ | ------ | ------ |
| MM (MyMemory) | 100 | 免费，不限流 |
| GT (Google) | 500 | |
| BD (百度) | 1000 | |
| YD (有道) | 200 | |
| TX (腾讯) | 200 | |

- **限流检测**：HTTP 状态码（429/403）+ 响应体错误码双重判断。部分 API（有道）即使是限流也返回 HTTP 200，仅通过 body errorCode 表达（YD 411、BD 54003、TX LimitExceeded）→ 冷却 60s，避免无效重试
- **API 超时保护**：background proxy 与 executor 双重 8s 超时保护，超时视为失败
- **超长文本**：>3000 字符按句子拆分，同引擎逐个翻译再拼接

## 翻译失败处理

每个元素维护引擎黑名单 `data-qt-bl`（以逗号分隔的引擎名）。失败流程：

```text
引擎 A 失败 → addBlock("A") → 推回队尾 → 引擎 B 尝试
引擎 B 失败 → addBlock("B") → 推回队尾 → 引擎 C 尝试
...
全部 5 引擎失败 → markFailed() → data-qt-failed="1" → 扫描器跳过
```

- 黑名单跨扫描周期持久化，避免重复浪费 API 调用
- 切换翻译开关 → `cleanupAll()` 清空黑名单 → 全新重试

## 状态管理

`<html qt-state>` 属性：`""` | `"translating"` | `"translated"`

全局状态 `state`：`cancelled` / `translatedEls[]` / `translatedAt`

## 配置

| 参数 | 值 | 说明 |
| ------ | --- | ------ |
| `MAX_TEXT_LEN` | 3000 | 单次翻译上限，超长按句子拆分 |
| `MIN_TEXT_LEN` | 1 | 文本块最小字符数 |
| `VIEWPORT_MARGIN` | 300 | 视口扩展边距（px），提前翻译即将可见内容 |
| `API_TIMEOUT_MS` | 8000 | 单次 API 请求超时（ms） |

## 权限

| 权限 | 用途 |
| ------ | ------ |
| `activeTab` | 当前标签注入 |
| `scripting` | 动态注入 |
| `storage` | 翻译缓存 + 调试开关状态 |
| `host_permissions` | 翻译 API + CORS 代理 |

## 调试面板

右下角固定面板，可折叠。展示各引擎请求数、失败数、缓存命中数，以及最近 8 条翻译日志。

通过 popup 中的开关控制显隐，状态持久化在 `chrome.storage` 中。所有调试面板 DOM 元素带有 `qt-skip` class，不会被翻译扫描器处理。

## CSS 隔离

调试面板和译文通过 content script 注入到任意网页，必须避免与宿主网站的 CSS 产生冲突：

| 策略 | 说明 |
| ------ | ------ |
| **`qt-` 前缀** | UnoCSS 生成的所有工具类均带 `qt-` 前缀（`qt-fixed`、`qt-bg-bg`、`qt-debug-shadow`），不会与宿主网站的 Tailwind/UnoCSS 类名冲突 |
| **`rem` → `px`** | `@unocss/preset-rem-to-px` 将所有 `rem` 转 `px`，尺寸不受宿主网站 `html { font-size }` 影响 |
| **译文自适应** | `.qt-trans` 使用 `mix-blend-mode: difference` 自动反色 + `box-decoration-break: clone` 保证换行时圆角不断裂 |

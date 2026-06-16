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
|------|------|
| `Ctrl+Shift+E` | 翻译整页 |
| 再按一次 | 还原，移除所有译文 |
| 同域名下翻页 | 自动续翻（sessionStorage） |
| 关闭标签 / 浏览器 | 自动清除翻译状态 |

## 工程结构

```
src/
├── entrypoints/            # WXT 入口
│   ├── background.ts       # Service Worker: 快捷键 + CORS 代理
│   ├── content.ts          # Content Script 入口
│   ├── styles.css          # 译文样式
│   └── popup/
│       ├── index.html      # 弹窗 UI
│       └── main.ts         # 弹窗逻辑（Vue 3）
├── lib/                    # 共享模块
│   ├── core.ts             # 常量 · 状态机 · 引擎池 · 缓存 · inView
│   ├── qtelement.ts        # DOM 元素抽象层（data-qt 属性管理 + 文本提取 + 译文插入）
│   ├── scanner.ts          # DOM 文本块扫描（迭代栈遍历）
│   ├── translator.ts       # 翻译调度：并发引擎 worker + 黑名单重试
│   ├── insert.ts           # 译文 DOM 移除
│   ├── debug.ts            # 调试面板初始化
│   ├── DebugPanel.vue      # 调试面板 UI（Vue 3）
│   ├── config.ts           # API 密钥（从构建时环境变量注入）
│   ├── hash.ts             # MD5 实现（百度签名用）
│   └── engines/
│       ├── types.ts        # 引擎接口定义
│       ├── registry.ts     # 引擎注册表
│       ├── google.ts       # Google Translate
│       ├── baidu.ts        # 百度翻译
│       ├── youdao.ts       # 有道翻译
│       ├── tencent.ts      # 腾讯翻译
│       └── mymemory.ts     # MyMemory
└── public/
    └── icons/              # 扩展图标
```

## 架构

```
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

## QtElement 元素抽象

避免直接操作 DOM 属性，通过 `QtElement` 封装元素生命周期：

| 属性 | 含义 | 设置者 |
| ------ | ------ | ------ |
| `data-qt="1"` | 翻译成功 | `insertTranslation()` → `finish()` |
| `data-qt-failed="1"` | 全部引擎翻译失败 | `tryTranslateElement` → `markFailed()` |
| `data-qt-bl="MM,GT,…"` | 翻译失败的引擎名单 | `addBlock()` |
| `data-qt-trans="1"` | 译文 span 包装元素 | `insertTranslation()` |

两种"完成"状态自动被扫描器跳过：

```
data-qt="1"        → 翻译成功，显示译文
data-qt-failed="1" → 全部引擎失败，静默放弃
```

切换翻译开关时 `cleanupAll()` 清除全部属性，重新开始。

## 引擎调度

- **多引擎并发**：`pickReady()` 筛选所有空闲（非 busy、未限流、已过间隔）引擎，`Promise.all` 并发启动 worker
- **独立请求间隔**：每个引擎独立 `delayMs`，避免同时打爆 API

| 引擎 | delayMs | 说明 |
| ------ | ------ | ------ |
| MM (MyMemory) | 100 | 免费，不限流 |
| GT (Google) | 500 | |
| BD (百度) | 1000 | |
| YD (有道) | 200 | |
| TX (腾讯) | 200 | |

- 限流检测：MM 429、GT 403/429、BD 54003、YD 411、TX LimitExceeded → 冷却 60s
- API 超时保护：统一 8s，超时视为失败
- 超长文本（>3000 字符）→ 按句子拆分，同引擎逐个翻译再拼接

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

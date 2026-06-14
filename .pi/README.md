# 快捷翻译 - Chrome 扩展

> 极简浏览器翻译插件：按快捷键，英 → 中整页双语对照翻译。

## 安装

1. 打开 Chrome，地址栏输入 `chrome://extensions`
2. 打开右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本项目文件夹

## 使用

| 操作 | 效果 |
|------|------|
| `Ctrl+Shift+E`（Mac: `⌘+Shift+E`） | 翻译整页，每个文本块后插入中文译文 |
| 再按一次 | 还原，移除所有译文 |
| `Esc` | 翻译中则取消，已完成则移除所有译文 |

自定义快捷键：`chrome://extensions/shortcuts`

## 文件结构

```
├── manifest.json          # MV3 配置：权限、快捷键、content_scripts 加载顺序
├── background.js          # Service Worker：接收快捷键 → 通知 content script（500ms 防抖）
├── content-core.js        # 全局常量、状态管理（S 对象）、工具函数
├── content-debug.js       # 调试面板：右下角实时统计请求来源 & 缓存命中
├── content-translate.js   # 翻译引擎：MyMemory（主）+ Google Translate（备用）+ 两级缓存
├── content-scanner.js     # 文本块扫描：DOM 遍历、可见性判断、视口检测
├── content.js             # 主逻辑：翻译流程、译文插入/移除、滚动/缩放补译、消息处理
├── styles.css             # 译文样式（左边框 + 透明度区分）+ 进度条样式
├── popup.html             # 扩展图标弹窗（快捷键说明 + 自定义链接）
├── popup.js               # 弹窗逻辑（读取实际快捷键、跳转设置页）
└── icons/                 # 应用图标（16/48/128 px）
```

### Content Script 加载顺序

manifest.json 中按以下顺序注入，保证依赖关系正确：

```
content-core.js  →  content-debug.js  →  content-translate.js  →  content-scanner.js  →  content.js
```

## 架构

```
快捷键 ⌨️
  │
  ▼
background.js  ◀── 500ms 防抖（Chrome 可能连发）
  │
  ▼
content.js（页面内，协调各模块）
  ├── findBlocks()                       扫描文本块（跳过 SCRIPT/STYLE/CODE…）
  ├── 文本预处理                          剥离前后非字母字符，纯字母 < 2 跳过
  ├── translateText()
  │   ├── 内存缓存（Map）                  当前页面毫秒级命中
  │   ├── 持久缓存（chrome.storage.local） 原文为 key，重启后仍命中
  │   ├── MyMemory（主引擎）               免费，无需 API Key
  │   └── Google Translate（备用引擎）      免费接口
  ├── insert()                           插入译文到原文后面
  ├── scroll / resize 监听                滚动和窗口缩放时补译新出现文本块
  └── Debug 面板                          右下角实时统计（请求数、引擎来源、缓存）
```

## 状态管理

翻译状态挂在 `<html>` 标签的 `qt-state` 属性上（DOM 属性），避免 JS 变量异步竞态：

```
<html>                              → 初始 / 已还原
<html qt-state="translating">       → 翻译进行中
<html qt-state="translated">        → 翻译完成
```

所有状态判断读 DOM（`S.get()` / `S.translating()` / `S.translated()`），写 DOM（`S.set()`）。即使快捷键连发两次，第二次读到 `qt-state="translating"` 直接忽略。

## 文本块扫描策略

### 扫描范围

优先从语义容器开始扫描（按优先级）：`<article>` → `<main>` → `[role="main"]` → `.content` → `#content` → `<body>`

### 跳过规则

| 规则 | 说明 |
|------|------|
| 跳过标签 | `SCRIPT`, `STYLE`, `CODE`, `PRE`, `SVG`, `CANVAS`, `INPUT` 等 |
| 短文本 | 文本块字符数 < 3 → 跳过 |
| 无字母 | 找不到 `[a-zA-Z]` → 跳过（纯数字、纯标点） |
| 单字母 | 纯字母 < 2 个 → 跳过（如 `"A."` 不翻译，`"OK!"` 翻译） |
| 不可见 | `display: none` / `visibility: hidden` / `opacity: 0` / 元素太窄太矮 |

### 文本预处理（前后剥离）

只翻译核心英文，翻译后拼回原位：

```
"OK!"    → 提取 "OK"     → 翻译 "好的"   → 拼回 "好的!"
"(Hi)"   → 提取 "Hi"     → 翻译 "你好"   → 拼回 "(你好)"
"A."     → 提取 "A"      → 纯字母 1 个   → 跳过
"2024"   → 没有字母       → 跳过
```

### 视口优先

- 视口内文本块（带 300px 上下边距）优先翻译
- 视口外文本块暂存，翻译完成后 100ms 触发 `scroll` 补译
- 滚动和窗口缩放时，自动扫描并翻译新进入视口的未翻译文本块

## 防重复翻译

| 场景 | 方案 |
|------|------|
| 相同原文在当前页面出现多次 | 内存 Map 缓存命中 |
| 刷新页面 / 重启浏览器后再打开 | chrome.storage.local 原文命中 |
| Chrome 快捷键连发两次 | background.js 500ms 防抖 |
| 连发 + 异步竞态 | `<html qt-state>` DOM 属性原子判断 |
| 窗口拖动时翻译 | resize 监听检查 `qt-state="translating"` 时跳过 |
| 翻译完成后进度条移除触发 resize | 完成后 1s 冷却期，忽略布局抖动 |

## 翻译引擎

### MyMemory（主引擎）

- URL: `https://api.mymemory.translated.net/get`
- 免费，无需 API Key
- 参数: `q=<text>&langpair=en|zh`
- 带重试（最多 1 次）+ 超时（8s）

### Google Translate（备用引擎）

- 仅在 MyMemory 失败时启用
- URL: `https://translate.googleapis.com/translate_a/single`
- 参数: `client=gtx&sl=en&tl=zh-CN&dt=t&q=<text>`
- 解析多个 segments 拼接

### 缓存层级

1. **内存缓存**（`Map`）：当前页面生命周期内，同文本毫秒级命中
2. **持久缓存**（`chrome.storage.local`）：以原文为 key，浏览器重启后仍然有效

## 调试面板

右下角固定面板，实时显示：

- 总请求数
- MyMemory 命中（MM）
- Google 命中（GT）
- 失败数（✗）
- 缓存命中（↻）
- 最近 8 条翻译日志（引擎 + 文本预览 + 状态）

## 配置参数（content-core.js）

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `MAX_CONCURRENT` | 3 | 并发翻译请求数 |
| `DELAY_MS` | 200 | 请求间隔（ms） |
| `MAX_TEXT_LEN` | 800 | 单次翻译文本最大长度 |
| `MIN_TEXT_LEN` | 3 | 文本块最小字符数 |
| `VIEWPORT_MARGIN` | 300 | 视口扩展边距（px） |
| `API_TIMEOUT_MS` | 8000 | API 超时（ms） |
| `MAX_RETRIES` | 1 | API 失败重试次数 |

## 权限说明

| 权限 | 用途 |
|------|------|
| `activeTab` | 在当前活动标签页注入脚本 |
| `scripting` | 动态注入 content script（受限页面兜底） |
| `storage` | 持久化翻译缓存 |
| `host_permissions` | 直接访问 MyMemory 和 Google 翻译 API（绕过 Service Worker 网络限制） |

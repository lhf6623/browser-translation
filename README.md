# 快捷翻译 - 浏览器扩展

> 快捷键翻译整页为英→中双语对照，5 引擎智能调度。
> 基于 **WXT + TypeScript** 工程化重构。

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
│       └── main.ts         # 弹窗逻辑
├── lib/                    # 共享模块
│   ├── core.ts             # 常量 · 状态机 · 引擎池 · pickEngine
│   ├── scanner.ts          # DOM 文本块扫描
│   ├── translator.ts       # 翻译调度：translateText + doBlocks
│   ├── insert.ts           # 译文 DOM 插入与移除
│   ├── debug.ts            # 调试面板
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
- 超长文本（>3000 字符）→ 按句子拆分，同引擎逐个翻译再拼接

## 状态管理

`<html qt-state>` 属性：`""` | `"translating"` | `"translated"`

## 配置

| 参数 | 值 | 说明 |
|------|-----|------|
| `DELAY_MS` | 200 | 引擎请求间隔 |
| `MAX_TEXT_LEN` | 3000 | 单次翻译上限，超长按句子拆分 |
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

# 快捷翻译 - Chrome 扩展

> 极简浏览器翻译插件：按快捷键，整页英→中双语对照翻译。

## 安装

1. 打开 Chrome，地址栏输入 `chrome://extensions`
2. 打开右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本项目文件夹

## 使用

| 操作 | 效果 |
|------|------|
| `Ctrl+Shift+E`（Mac: `Cmd+Shift+E`） | 翻译整页，每个段落后插入中文译文 |
| 再按一次 | 还原，移除所有译文 |
| `Esc` | 取消翻译 / 移除所有译文 |

自定义快捷键：`chrome://extensions/shortcuts`

## 文件结构

```
├── manifest.json        # MV3 配置，注册快捷键
├── background.js        # Service Worker（仅监听快捷键，通知 content）
├── content.js           # 核心：识别文本块 → 调翻译 API → 插入译文
├── styles.css           # 译文样式（继承网页字体，仅左边框 + 透明度区分）
├── popup.html           # 扩展图标弹窗（快捷键说明）
├── popup.js             # 弹窗逻辑
└── icons/               # 应用图标
```

## 架构

```
快捷键 → background.js → content.js（页面内）
                            ├── findBlocks()   识别文本块
                            ├── translateText() 调 MyMemory API
                            ├── insert()        插入译文到原作后面
                            └── IntersectionObserver 滚动懒翻译
```

- 翻译请求在 content script 中直接发（不走 Service Worker，避免网络限制）
- 翻译引擎：MyMemory（免费，无需 API Key），英→中固定
- 缓存：内存 Map，相同文本只翻译一次

## 关键设计决策

1. **翻译 API**：最终选用 MyMemory（`api.mymemory.translated.net`），因为 Google Translate 相关端点在当前网络环境全部超时
2. **请求位置**：翻译请求在 content script 中直接 fetch，不在 Service Worker 中发（Service Worker 网络栈受限）
3. **视口优化**：优先翻译可见区域，滚动时通过 IntersectionObserver 懒加载
4. **文本块识别**：遍历 `p/h1-h6/li/blockquote` 等标准标签，行内文本（`<a>` `<span>`）≥3 字也纳入
5. **跳过标签**：`SCRIPT/STYLE/CODE/PRE/INPUT/TEXTAREA` 等不翻译
6. **宿主权限**：`manifest.json` 的 `host_permissions` 需要包含 `api.mymemory.translated.net`

## 测试模式

`content.js` 的 `fetchTranslation()` 当前返回固定文本 `测试文本---`，用于验证文本块识别是否正确。恢复翻译功能时改为：

```js
async function fetchTranslation(text) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en%7Czh`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.responseStatus === 200 && data.responseData && data.responseData.translatedText) {
      return data.responseData.translatedText;
    }
    throw new Error('API 返回异常');
  } catch (e) {
    console.warn('[快捷翻译] 失败:', text.slice(0, 30), e.message);
    return text;
  }
}
```

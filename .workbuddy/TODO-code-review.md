# 快捷翻译插件代码审查 · 待修复清单

审查时间：2026-06-14 | 范围：自用，不发布 | 聚焦功能性 bug

---

## P0 — 必修（影响正常使用）

### 1. 翻译失败无重试上限 → 死循环

- **文件**: `content.js` → `doBlocks()`
- **现象**: 所有引擎都失败时，失败文本被 `queue.push(el)` 无限回塞，`while(queue.length)` 死循环，页面卡死
- **方案**: 
  - 每个待翻译块挂一个 `retryCount`（初始 0，每次回塞 +1）
  - 达到上限（如 3 次）打上 `data-qt` 标记直接跳过，不再翻译
  - limit：整轮翻译最大迭代次数（如 `queue 初始长度 × 3`）

### 2. `cancelled` 标志竞态

- **文件**: `content.js:55` + `content-core.js:10`
- **现象**: 快速双击快捷键时，旧 `doBlocks` 还在跑就被重置 `cancelled = false`，导致幽灵翻译插入页面
- **方案**:
  - 去掉模块级 `cancelled` 布尔值
  - 改为 generation token：每次 `toggle()` 生成一个自增 ID
  - `doBlocks()` 捕获当前 ID，每轮循环检查 ID 是否仍为最新，不是则退出

### 3. 百度翻译多段结果截断

- **文件**: `engine-bd.js:51`
- **现象**: `data.trans_result[0].dst` 只取第一条，百度对长文本分段返回多条，其余结果被丢弃
- **方案**: 改为 `data.trans_result.map(r => r.dst).join('')`，同时处理 `data.trans_result` 为空的情况

### 4. MyMemory match 阈值过严

- **文件**: `engine-mm.js:17`
- **现象**: `data.responseData.match >= 0.9` 过滤了大量正常翻译结果（match 分是 TM 匹配度，不是翻译质量），MM 引擎几乎等于废掉
- **方案**: 
  - 去掉 `match >= 0.9` 过滤
  - 仅检查 `responseStatus === 200` 且有 `translatedText`

### 5. storage.local 缓存无过期策略

- **文件**: `content-translate.js:37`
- **现象**: 缓存无限积累，长期使用后超 10 MB 上限，写入静默失败，后续缓存全部失效
- **方案**:
  - 不再以 `key: value` 单独存，改为一个对象 `{ qt_cache: { key: { value, ts } } }`
  - 写入时：检查条目数，超过上限（如 500）则清理最老的 100 条
  - 读取时：检查 `ts`，超过 TTL（如 7 天）则丢弃并删除
  - 或更简单：初始化时直接 `chrome.storage.local.clear()` 只清 qt_ 前缀的缓存（粗暴但有效）

### 6. pickEngine 等待无超时退出

- **文件**: `content.js:90`
- **现象**: `while (!(eng = pickEngine())) { await sleep(100); }` 在所有引擎被限速时无限等待，无退出
- **方案**:
  - 加最大等待时长（如 30 秒）
  - 超时后 `break` 出循环，给页面提示"所有引擎暂不可用"

---

## P1 — 顺手修（不影响功能但隐患明显）

### 7. debug 面板 XSS 风险

- **文件**: `content-debug.js:113`
- **现象**: 页面文本拼进 `innerHTML`
- **方案**: 用 `document.createElement` + `textContent` 构建日志条目

### 8. pickEngine 尾部引擎饥饿

- **文件**: `content-core.js:50`
- **现象**: 顺序轮询 + 跳过不回溯，高并发时后面的引擎永远轮不到
- **方案**: 改为按 `lastCall` 时间排序选最久未用的可用引擎

---

## P2 — 可选优化

- MD5 实现抽出独立文件 `lib-md5.js`
- 语言对统一常量 `TRANSLATE_FROM / TRANSLATE_TO`
- `hashKey` 改用原文截断，避免碰撞风险
- manifest 明确浏览器策略（纯 Chrome 删 gecko / 跨浏览器加 polyfill）

---

## 修复进度

| # | 问题 | 状态 | 判断 |
|---|------|------|------|
| 1 | 死循环 | ✅ 已修 | `data-qt-retry` 计数器，上限 5 次后标记完成 |
| 2 | cancelled 竞态 | ❌ 不修 | `toggle()` 先设 `cancelled=true`，`doBlocks` 内 while 每轮检查，旧 worker 正常退出。概率极低 |
| 3 | 百度多段结果 | ✅ 已修 | `map(r => r.dst).join('')` 拼接所有段 |
| 4 | MyMemory 阈值 | ✅ 已修 | 去掉 `match >= 0.9`，有 `translatedText` 就返回 |
| 5 | 缓存 TTL | ❌ 不修 | 自用短期不超 10MB，popup 有清空缓存按钮 |
| 6 | pickEngine 超时 | ✅ 已修 | 30 秒超时后 `break` 退出 |
| 7 | XSS | ✅ 已修 | `createElement` + `textContent` 替代 `innerHTML` |
| 8 | 引擎饥饿 | ❌ 不修 | `_pickIdx` 轮转每轮从上次位置继续，不会饥饿 |

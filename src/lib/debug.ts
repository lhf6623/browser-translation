// ========== 调试面板 ==========

import { browser } from "wxt/browser";

let dbgEnabled = false;
let dbgPanel: HTMLElement | null = null;
let dbgCount: HTMLElement | null = null;
let dbgList: HTMLElement | null = null;
let dbgCollapsed = false;

interface LogEntry {
  engine: string;
  text: string;
  fail: boolean;
  cache: boolean;
}

const DBG = {
  total: 0,
  mymemory: 0,
  google: 0,
  baidu: 0,
  youdao: 0,
  tencent: 0,
  fail: 0,
  cacheHit: 0,
  logs: [] as LogEntry[],
};

function dbgToggle(): void {
  if (!dbgPanel) return;
  dbgCollapsed = !dbgCollapsed;
  const body = dbgPanel.querySelector(".qt-dbg-body") as HTMLElement;
  if (body) body.style.display = dbgCollapsed ? "none" : "";
  const toggle = dbgPanel.querySelector(".qt-dbg-toggle") as HTMLElement;
  if (toggle) toggle.textContent = dbgCollapsed ? "+" : "\u2014";
}

function dbgRender(): void {
  if (!dbgCount || !dbgList) return;
  const d = DBG;
  dbgCount.innerHTML =
    `<span>请求 <b>${d.total}</b></span>` +
    `<span class="ok">MM ${d.mymemory}</span>` +
    `<span class="warn">GT ${d.google}</span>` +
    `<span class="bd">BD ${d.baidu}</span>` +
    `<span class="yd">YD ${d.youdao}</span>` +
    `<span class="tx">TX ${d.tencent}</span>` +
    `<span class="err">✗ ${d.fail}</span>` +
    `<span class="cache">缓存 ${d.cacheHit}</span>`;
  dbgList.innerHTML = "";
  d.logs.forEach((l) => {
    const div = document.createElement("div");
    let cls: string;
    if (l.fail) cls = "err";
    else if (l.cache) cls = "cache";
    else cls = (l.engine || "").toLowerCase();
    div.className = "line " + cls;
    div.title = l.text;
    const icon = l.fail ? "✗" : l.cache ? "↻" : "✓";
    div.textContent = `${icon} ${l.engine || ""} ${l.text}`;
    dbgList!.appendChild(div);
  });
}

function dbgInit(): void {
  if (dbgPanel || !dbgEnabled) return;
  dbgPanel = document.createElement("div");
  dbgPanel.id = "qt-debug-panel";
  dbgPanel.className = "qt-skip";
  dbgPanel.innerHTML = `
    <style>
      #qt-debug-panel {
        position: fixed; bottom: 16px; right: 16px; z-index: 2147483646;
        background: #1c1c1e;
        color: #d1d1d6; font: 11px/1.5 "SF Mono", "Fira Code", "JetBrains Mono", monospace;
        border-radius: 10px; padding: 12px 14px; width: 370px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06);
        pointer-events: auto; user-select: none;
      }
      #qt-debug-panel .qt-dbg-title {
        color: #f0935b; font-weight: 700; font-size: 12px;
        cursor: pointer; display: flex; justify-content: space-between; align-items: center;
        padding-bottom: 8px; margin-bottom: 6px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      #qt-debug-panel .qt-dbg-toggle {
        color: #f0935b; font-size: 14px; line-height: 1;
        opacity: 0.4; transition: opacity 0.2s;
      }
      #qt-debug-panel .qt-dbg-title:hover .qt-dbg-toggle { opacity: 1; }
      #qt-debug-panel .qt-dbg-stats {
        margin-bottom: 6px; color: #8e8e93;
        display: flex; flex-wrap: wrap; gap: 2px 10px;
      }
      #qt-debug-panel .qt-dbg-stats span { white-space: nowrap; }
      #qt-debug-panel .qt-dbg-stats .ok { color: #30d158; }
      #qt-debug-panel .qt-dbg-stats .warn { color: #ff9f0a; }
      #qt-debug-panel .qt-dbg-stats .err { color: #ff453a; }
      #qt-debug-panel .qt-dbg-stats .bd  { color: #5e9eff; }
      #qt-debug-panel .qt-dbg-stats .yd  { color: #ff6b7a; }
      #qt-debug-panel .qt-dbg-stats .tx  { color: #64d2ff; }
      #qt-debug-panel .qt-dbg-stats .cache { color: #f0935b; }
      #qt-debug-panel .qt-dbg-log { max-height: 200px; overflow-y: auto; overflow-x: hidden; font-size: 10px; color: #8e8e93; display: flex; flex-direction: column;
        scrollbar-width: thin; scrollbar-color: #3a3a3c #1c1c1e; }
      #qt-debug-panel .qt-dbg-log::-webkit-scrollbar { width: 4px; }
      #qt-debug-panel .qt-dbg-log::-webkit-scrollbar-track { background: #1c1c1e; }
      #qt-debug-panel .qt-dbg-log::-webkit-scrollbar-thumb { background: #3a3a3c; border-radius: 2px; }
      #qt-debug-panel .qt-dbg-log .line { padding: 2px 0; border-bottom: 1px solid rgba(255,255,255,0.08); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      #qt-debug-panel .qt-dbg-log .line.mm { color: #30d158; }
      #qt-debug-panel .qt-dbg-log .line.gt { color: #ff9f0a; }
      #qt-debug-panel .qt-dbg-log .line.bd { color: #5e9eff; }
      #qt-debug-panel .qt-dbg-log .line.yd { color: #ff6b7a; }
      #qt-debug-panel .qt-dbg-log .line.tx { color: #64d2ff; }
      #qt-debug-panel .qt-dbg-log .line.err { color: #ff453a; }
      #qt-debug-panel .qt-dbg-log .line.cache { color: #f0935b; }
    </style>
    <div class="qt-dbg-title"><span>快捷翻译 Debug</span><span class="qt-dbg-toggle">—</span></div>
    <div class="qt-dbg-body">
      <div class="qt-dbg-stats" id="qt-dbg-stats"></div>
      <div class="qt-dbg-log" id="qt-dbg-log"></div>
    </div>
  `;
  document.body.appendChild(dbgPanel);
  dbgPanel.querySelector(".qt-dbg-title")!.addEventListener("click", dbgToggle);
  dbgCount = dbgPanel.querySelector("#qt-dbg-stats");
  dbgList = dbgPanel.querySelector("#qt-dbg-log");
  dbgRender();
}

export function dbgLog(
  engine: string,
  text: string,
  fail: boolean,
  cache: boolean,
): void {
  dbgInit();
  if (cache) {
    DBG.cacheHit++;
  } else {
    DBG.total++;
    if (fail) {
      DBG.fail++;
    } else if (engine === "MM") {
      DBG.mymemory++;
    } else if (engine === "GT") {
      DBG.google++;
    } else if (engine === "BD") {
      DBG.baidu++;
    } else if (engine === "YD") {
      DBG.youdao++;
    } else if (engine === "TX") {
      DBG.tencent++;
    }
  }
  DBG.logs.unshift({ engine, text, fail, cache });
  if (DBG.logs.length > 8) DBG.logs.length = 8;
  dbgRender();
}

// ---- 初始化：监听开关变化 ----

browser.storage.onChanged.addListener((changes) => {
  if (changes.debugEnabled) {
    dbgEnabled = !!changes.debugEnabled.newValue;
    if (dbgEnabled) {
      dbgInit();
    } else if (dbgPanel) {
      dbgPanel.remove();
      dbgPanel = null;
      dbgCount = null;
      dbgList = null;
    }
  }
});

// 启动时读取初始状态
(async () => {
  const { debugEnabled } = await browser.storage.local.get("debugEnabled");
  dbgEnabled = !!debugEnabled;
  if (dbgEnabled) dbgInit();
})();

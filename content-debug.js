// ========== 快捷翻译 - 调试面板 ==========

let dbgEnabled = false;

// 监听开关变化
chrome.storage.onChanged.addListener((changes) => {
  if (changes.debugEnabled) {
    dbgEnabled = changes.debugEnabled.newValue;
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
  const { debugEnabled } = await chrome.storage.local.get('debugEnabled');
  dbgEnabled = !!debugEnabled;
  if (dbgEnabled) dbgInit();
})();

const DBG = {
  total: 0,
  mymemory: 0,
  google: 0,
  baidu: 0,
  youdao: 0,
  tencent: 0,
  fail: 0,
  cacheHit: 0,
  logs: [],
};

let dbgPanel = null;
let dbgCount = null;
let dbgList = null;
let dbgCollapsed = false;

function dbgToggle() {
  dbgCollapsed = !dbgCollapsed;
  const body = dbgPanel.querySelector('.qt-dbg-body');
  body.style.display = dbgCollapsed ? 'none' : '';
  dbgPanel.querySelector('.qt-dbg-toggle').textContent = dbgCollapsed ? '+' : '—';
}

function dbgInit() {
  if (dbgPanel || !dbgEnabled) return;
  dbgPanel = document.createElement('div');
  dbgPanel.id = 'qt-debug-panel';
  dbgPanel.className = 'qt-skip';
  dbgPanel.innerHTML = `
    <style>
      #qt-debug-panel {
        position: fixed; bottom: 12px; right: 12px; z-index: 2147483646;
        background: linear-gradient(135deg, #1a1a2e, #16213e);
        color: #e0e0e0; font: 11px/1.5 "SF Mono", "Fira Code", monospace;
        border-radius: 8px; padding: 10px 12px; min-width: 210px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5); opacity: 0.92;
        pointer-events: auto; user-select: none;
      }
      #qt-debug-panel .qt-dbg-title { color: #64ffda; font-weight: 700; font-size: 12px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
      #qt-debug-panel .qt-dbg-toggle { color: #64ffda; font-size: 14px; line-height: 1; opacity: 0.5; transition: opacity 0.2s; }
      #qt-debug-panel .qt-dbg-title:hover .qt-dbg-toggle { opacity: 1; }
      #qt-debug-panel .qt-dbg-stats { margin-top: 4px; margin-bottom: 4px; color: #b0b0b0; }
      #qt-debug-panel .qt-dbg-stats span { margin-right: 10px; white-space: nowrap; }
      #qt-debug-panel .qt-dbg-stats .ok { color: #69f0ae; }
      #qt-debug-panel .qt-dbg-stats .warn { color: #ffab40; }
      #qt-debug-panel .qt-dbg-stats .err { color: #ff5252; }
      #qt-debug-panel .qt-dbg-stats .bd  { color: #42a5f5; }
      #qt-debug-panel .qt-dbg-stats .yd  { color: #ef5350; }
      #qt-debug-panel .qt-dbg-stats .tx  { color: #26c6da; }
      #qt-debug-panel .qt-dbg-log { max-height: 130px; overflow-y: auto; font-size: 10px; color: #888; }
      #qt-debug-panel .qt-dbg-log .line { padding: 1px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
      #qt-debug-panel .qt-dbg-log .line.ok { color: #69f0ae; }
      #qt-debug-panel .qt-dbg-log .line.err { color: #ff5252; }
      #qt-debug-panel .qt-dbg-log .line.cache { color: #82b1ff; }
    </style>
    <div class="qt-dbg-title"><span>快捷翻译 Debug</span><span class="qt-dbg-toggle">—</span></div>
    <div class="qt-dbg-body">
      <div class="qt-dbg-stats" id="qt-dbg-stats"></div>
      <div class="qt-dbg-log" id="qt-dbg-log"></div>
    </div>
  `;
  document.body.appendChild(dbgPanel);
  dbgPanel.querySelector('.qt-dbg-title').addEventListener('click', dbgToggle);
  dbgCount = dbgPanel.querySelector('#qt-dbg-stats');
  dbgList = dbgPanel.querySelector('#qt-dbg-log');
  dbgRender();
}

function dbgRender() {
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
  dbgList.innerHTML = d.logs.map(l => {
    const cls = l.fail ? 'err' : (l.cache ? 'cache' : 'ok');
    const icon = l.fail ? '✗' : (l.cache ? '↻' : '✓');
    const engine = l.engine || '';
    const preview = l.text.length > 28 ? l.text.slice(0, 28) + '…' : l.text;
    return `<div class="line ${cls}">${icon} ${engine} ${preview}</div>`;
  }).join('');
}

function dbgLog(engine, text, fail, cache) {
  dbgInit();
  if (cache) {
    DBG.cacheHit++;
  } else {
    DBG.total++;
    if (fail) {
      DBG.fail++;
    } else if (engine === 'MM') {
      DBG.mymemory++;
    } else if (engine === 'GT') {
      DBG.google++;
    } else if (engine === 'BD') {
      DBG.baidu++;
    } else if (engine === 'YD') {
      DBG.youdao++;
    } else if (engine === 'TX') {
      DBG.tencent++;
    }
  }
  DBG.logs.unshift({ engine, text: text.slice(0, 40), fail, cache });
  if (DBG.logs.length > 8) DBG.logs.length = 8;
  dbgRender();
}

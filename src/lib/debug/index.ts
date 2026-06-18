// ========== 调试面板 ==========

import { reactive } from "vue";
import { createApp } from "vue";
import { browser } from "wxt/browser";
import { CSS } from "../constants";
import DebugPanel from "./DebugPanel.vue";

interface LogEntry {
  engine: string;
  text: string;
  fail: boolean;
  cache: boolean;
}

export const dbgState = reactive({
  enabled: false,
  total: 0,
  mymemory: 0,
  google: 0,
  baidu: 0,
  youdao: 0,
  tencent: 0,
  fail: 0,
  cacheHit: 0,
  logs: [] as LogEntry[],
});

let _mounted = false;

function mount() {
  if (_mounted || !dbgState.enabled) return;
  const container = document.createElement("div");
  container.className = CSS.SKIP;
  document.body.appendChild(container);
  createApp(DebugPanel).mount(container);
  _mounted = true;
}

function unmount() {
  if (!_mounted) return;
  const el = document.querySelector("#qt-debug-panel");
  if (el) el.remove();
  _mounted = false;
}

export function dbgLog(
  engine: string,
  text: string,
  fail: boolean,
  cache: boolean,
): void {
  mount();
  if (cache) {
    dbgState.cacheHit++;
  } else {
    dbgState.total++;
    if (fail) {
      dbgState.fail++;
    } else if (engine === "MM") {
      dbgState.mymemory++;
    } else if (engine === "GT") {
      dbgState.google++;
    } else if (engine === "BD") {
      dbgState.baidu++;
    } else if (engine === "YD") {
      dbgState.youdao++;
    } else if (engine === "TX") {
      dbgState.tencent++;
    }
  }
  dbgState.logs.unshift({ engine, text, fail, cache });
  if (dbgState.logs.length > 8) dbgState.logs.length = 8;
}

// ---- 初始化：监听开关变化 ----

let _inited = false;

export function initDebug(): void {
  if (_inited) return;
  _inited = true;

  browser.storage.onChanged.addListener((changes) => {
    if (changes.debugEnabled) {
      dbgState.enabled = !!changes.debugEnabled.newValue;
      if (dbgState.enabled) mount();
      else unmount();
    }
  });

  browser.storage.local.get("debugEnabled").then(({ debugEnabled }) => {
    dbgState.enabled = !!debugEnabled;
    if (dbgState.enabled) mount();
  });
}

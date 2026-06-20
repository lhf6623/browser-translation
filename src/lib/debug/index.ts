// ========== 调试面板 ==========

import { reactive } from "vue";
import { createApp } from "vue";
import { browser } from "wxt/browser";
import { CSS } from "../constants";
import DebugPanel from "./DebugPanel.vue";

type LogStatus = '' | 'ok' | 'fail' | 'cache';

interface LogEntry {
  engine: string;
  text: string;
  status: LogStatus;
}

interface EngineStats {
  ok: number;
  fail: number;
}

const makeStats = (): EngineStats => ({ ok: 0, fail: 0 });

export const dbgState = reactive({
  enabled: false,
  total: 0,
  cacheHit: 0,
  engines: {
    MM: makeStats(),
    GT: makeStats(),
    BD: makeStats(),
    YD: makeStats(),
    TX: makeStats(),
  } as Record<string, EngineStats>,
  logs: [] as LogEntry[],
});

let _mounted = false;
let _app: ReturnType<typeof createApp> | null = null;

const CONTAINER_ID = "qt-debug-container";

function mount() {
  if (_mounted || !dbgState.enabled) return;
  if (!document.body) return;

  // 清理可能残留的旧容器（页面可能移除了 #qt-debug-panel 但容器还在）
  document.getElementById(CONTAINER_ID)?.remove();

  const container = document.createElement("div");
  container.id = CONTAINER_ID;
  container.className = CSS.SKIP;
  document.body.appendChild(container);

  const app = createApp(DebugPanel);
  app.config.errorHandler = () => {}; // Vue 更新时若 DOM 被外部改动，静默忽略
  try {
    app.mount(container);
    _app = app;
    _mounted = true;
  } catch {
    container.remove();
  }
}

function unmount() {
  if (!_mounted) return;
  if (_app) {
    try { _app.unmount(); } catch { /* ignore */ }
  }
  document.getElementById(CONTAINER_ID)?.remove();
  _app = null;
  _mounted = false;
}

export function dbgLog(
  engine: string,
  text: string,
  status?: 'fail' | 'cache',
): void {
  mount();
  if (status === 'cache') {
    dbgState.cacheHit++;
  } else {
    dbgState.total++;
    const s = dbgState.engines[engine];
    if (s) {
      if (status === 'fail') s.fail++;
      else s.ok++;
    }
  }
  dbgState.logs.unshift({ engine, text, status: status || '' });
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

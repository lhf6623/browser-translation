// ========== 调试面板 — 挂载与生命周期 ==========

import { createApp } from "vue";
import { browser } from "wxt/browser";
import { CSS } from "../constants";
import { dbgState } from "./state";
import { startCollecting, stopCollecting } from "./collector";
import DebugPanel from "./DebugPanel.vue";

let _mounted = false;
let _app: ReturnType<typeof createApp> | null = null;

const CONTAINER_ID = "qt-debug-container";

function mount() {
  if (_mounted || !dbgState.enabled) return;
  if (!document.body) return;

  document.getElementById(CONTAINER_ID)?.remove();

  const container = document.createElement("div");
  container.id = CONTAINER_ID;
  container.className = CSS.SKIP;
  document.body.appendChild(container);

  const app = createApp(DebugPanel);
  app.config.errorHandler = () => {};
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

let _inited = false;

/** 初始化调试面板：监听 storage 开关，注册事件收集 */
export function initDebug(): void {
  if (_inited) return;
  _inited = true;

  browser.storage.onChanged.addListener((changes) => {
    if (changes.debugEnabled) {
      dbgState.enabled = !!changes.debugEnabled.newValue;
      if (dbgState.enabled) {
        startCollecting();
        mount();
      } else {
        stopCollecting();
        unmount();
      }
    }
  });

  browser.storage.local.get("debugEnabled").then(({ debugEnabled }) => {
    dbgState.enabled = !!debugEnabled;
    if (dbgState.enabled) {
      startCollecting();
      mount();
    }
  });
}

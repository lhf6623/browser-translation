// ========== 调试面板 — 事件收集器（Observer 订阅端）==========

import { bus } from "../utils/events";
import { recordEvent } from "./state";
import type { TranslateEvent } from "./types";

let _unsub: (() => void) | null = null;

/** 开始监听翻译事件，写入 dbgState */
export function startCollecting(): void {
  if (_unsub) return; // 避免重复订阅
  _unsub = bus.on<TranslateEvent>("translate", (ev) => {
    recordEvent(ev.engine, ev.text, ev.status);
  });
}

/** 停止监听 */
export function stopCollecting(): void {
  _unsub?.();
  _unsub = null;
}

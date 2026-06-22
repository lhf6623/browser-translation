// ========== 调试面板 — 类型定义 ==========

export type LogStatus = 'ok' | 'fail' | 'cache';

export interface LogEntry {
  engine: string;
  text: string;
  status: LogStatus;
}

export interface EngineStats {
  ok: number;
  fail: number;
}

/** translator → EventBus → collector 的翻译事件 */
export interface TranslateEvent {
  engine: string;
  text: string;
  status: LogStatus;
}

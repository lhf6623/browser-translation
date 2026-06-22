// ========== 调试面板 — 响应式状态 ==========

import { reactive } from "vue";
import { engines as enginePool } from "../engines/pool";
import type { EngineStats, LogEntry, LogStatus } from "./types";

const makeStats = (): EngineStats => ({ ok: 0, fail: 0 });

function buildEngineStats(): Record<string, EngineStats> {
  const stats: Record<string, EngineStats> = {};
  for (const e of enginePool) {
    stats[e.name] = makeStats();
  }
  return stats;
}

export const dbgState = reactive({
  enabled: false,
  total: 0,
  cacheHit: 0,
  engines: buildEngineStats(),
  logs: [] as LogEntry[],
});

/** 写入一条翻译事件到状态 */
export function recordEvent(
  engine: string,
  text: string,
  status: LogStatus,
): void {
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
  dbgState.logs.unshift({ engine, text, status });
  if (dbgState.logs.length > 8) dbgState.logs.length = 8;
}

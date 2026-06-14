// ========== 翻译引擎接口 ==========

/** 每个引擎的运行状态 */
export interface EngineState {
  name: string;
  lastCall: number;
  busy: boolean;
  rateLimitUntil: number;
  calls: number;
  errors: number;
  sumMs: number;
}

/** 引擎返回结果 */
export interface EngineResult {
  result: string | null;
  rateLimited: boolean;
}

/** 翻译引擎函数签名 */
export type TranslateFn = (text: string) => Promise<EngineResult>;

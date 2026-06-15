/**
 * 每个翻译引擎的运行状态
 */
export interface EngineState {
  /** 引擎调度名称（MM / GT / BD / YD / TX） */
  name: string;
  /** 上次请求发出的时间戳（毫秒） */
  lastCall: number;
  /** 两次请求之间的最小间隔（毫秒） */
  delayMs: number;
  /** 当前是否正在执行翻译 */
  busy: boolean;
  /** 限流恢复时间戳，0 表示未限流 */
  rateLimitUntil: number;
  /** 累计成功调用次数 */
  calls: number;
  /** 累计失败次数 */
  errors: number;
  /** 累计 API 耗时（毫秒） */
  sumMs: number;
}

/**
 * 翻译引擎单次调用的返回结果
 */
export interface EngineResult {
  /** 翻译结果文本，失败时为 null */
  result: string | null;
  /** 是否触发了频率限制 */
  rateLimited: boolean;
}

/** 翻译引擎函数签名 */
export type TranslateFn = (text: string) => Promise<EngineResult>;

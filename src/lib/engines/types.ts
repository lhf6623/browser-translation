// ========== 引擎类型定义 ==========

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
  /** 翻译结果数组，按输入顺序一一对应，失败位置填 null */
  results: (string | null)[];
  /** 是否触发了频率限制 */
  rateLimited: boolean;
  /** 失败分类 */
  errorType?: 'timeout' | 'ratelimit' | 'network' | 'build';
}

/**
 * 统一引擎定义 — 所有引擎统一走 background 代理。
 *
 * buildPayload 统一收 string[]，引擎自己决定是否合并为批量请求。
 * parseResponse 统一回 (string | null)[]，按输入顺序一一对应。
 *
 * 当前各引擎实际处理方式：
 * - MM / GT / TX：只取 texts[0]，返回单元素数组
 * - BD：\n 拼接为单一 q，一次请求，返回逐条 dst
 * - YD：多 q 字段，/v2/api 请求，返回逐条 translation
 */
export interface EngineDef {
  /** 引擎调度名称 */
  name: string;
  /** 构建发给 background 的 payload */
  buildPayload: (
    texts: string[],
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
  /** 解析响应，结果按 texts 顺序一一对应，失败位置填 null */
  parseResponse: (data: unknown) => (string | null)[];
  /** 从 response data + HTTP status 判断是否限流 */
  isRateLimited: (data: unknown, status: number) => boolean;
  /**
   * 计算该引擎单次 API 请求允许的最大文本条数。
   * 入参为当前已收集的待翻译文本，引擎可根据总字符数等限制动态调整。
   * 返回 1 表示不支持批量。
   */
  maxBatchSize: (texts: string[]) => number;
}

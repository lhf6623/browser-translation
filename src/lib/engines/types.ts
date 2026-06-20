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
  /** 翻译结果文本，失败时为 null */
  result: string | null;
  /** 是否触发了频率限制 */
  rateLimited: boolean;
  /** 失败分类 */
  errorType?: 'timeout' | 'ratelimit' | 'network' | 'build';
}

/**
 * 统一引擎定义：所有引擎统一走 background 代理。
 *
 * content script 调用 buildPayload 构建请求参数，
 * executor 通过 sendMessage 发给 background 代为 fetch，
 * 引擎只需关心三个问题：拼请求、解析响应、判断限流。
 */
export interface EngineDef {
  /** 引擎调度名称 */
  name: string;
  /** 构建发给 background 的 payload（URL / 方法 / 头 / 体） */
  buildPayload: (
    text: string,
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
  /** 从 background 返回的 data 中提取译文，失败返回 null */
  parseResponse: (data: unknown) => string | null;
  /** 从 background 返回的 data + HTTP status 判断是否限流 */
  isRateLimited: (data: unknown, status: number) => boolean;
}

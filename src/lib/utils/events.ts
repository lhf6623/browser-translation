// ========== 轻量事件总线（Observer 模式）==========

type Handler<T> = (payload: T) => void;

class EventBus {
  #handlers = new Map<string, Set<Handler<any>>>();

  /** 注册事件监听，返回 unsubscribe 函数 */
  on<T>(event: string, handler: Handler<T>): () => void {
    let set = this.#handlers.get(event);
    if (!set) {
      set = new Set();
      this.#handlers.set(event, set);
    }
    set.add(handler);
    return () => set!.delete(handler);
  }

  /** 同步触发事件，依次调用所有 handler */
  emit<T>(event: string, payload: T): void {
    const set = this.#handlers.get(event);
    if (!set) return;
    for (const fn of set) {
      try { fn(payload); } catch { /* 静默忽略单个 handler 异常 */ }
    }
  }
}

export const bus = new EventBus();

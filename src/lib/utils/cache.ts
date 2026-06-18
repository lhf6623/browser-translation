// ========== LRU 缓存 + 缓存键 ==========

/**
 * LRU 缓存，基于 Map 插入顺序。
 * 达到上限时自动淘汰最久未访问的条目。
 */
export class LRUCache<K, V> {
  private map = new Map<K, V>();
  constructor(private max: number) {}

  get(key: K): V | undefined {
    const v = this.map.get(key);
    if (v !== undefined) {
      this.map.delete(key);
      this.map.set(key, v);
    }
    return v;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.max) {
      const first = this.map.keys().next().value!;
      this.map.delete(first);
    }
    this.map.set(key, value);
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  clear(): void {
    this.map.clear();
  }
}

/** 文本 → 译文的运行时内存缓存，上限 1000 条 */
export const memCache = new LRUCache<string, string>(1000);

/** 从文本生成缓存键 */
export function hashKey(s: string): string {
  let h1 = 0,
    h2 = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = ((h1 << 5) - h1 + c) | 0;
    h2 = ((h2 << 7) - h2 + c) | 0;
  }
  return "qt_" + (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}

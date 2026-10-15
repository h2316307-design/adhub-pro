/**
 * تجميع الطلبات: كل المكونات التي تطلب نفس النوع من البيانات في نفس اللحظة
 * تُخدم باستعلام واحد بدل استعلام لكل مكوّن، مع ذاكرة مؤقتة قصيرة.
 */
export interface BatchLoader<K, V> {
  load(key: K): Promise<V | undefined>;
  clear(key?: K): void;
}

export function createBatchLoader<K, V>(
  fetchMany: (keys: K[]) => Promise<Map<K, V>>,
  opts: { ttlMs?: number; maxBatch?: number; waitMs?: number } = {},
): BatchLoader<K, V> {
  const ttl = opts.ttlMs ?? 60_000;
  const maxBatch = opts.maxBatch ?? 200;
  const wait = opts.waitMs ?? 8;
  const cache = new Map<K, { at: number; promise: Promise<V | undefined> }>();
  let queue: { key: K; resolve: (v: V | undefined) => void; reject: (e: unknown) => void }[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = async () => {
    timer = null;
    const batch = queue;
    queue = [];
    for (let i = 0; i < batch.length; i += maxBatch) {
      const part = batch.slice(i, i + maxBatch);
      const keys = [...new Set(part.map(p => p.key))];
      try {
        const result = await fetchMany(keys);
        part.forEach(p => p.resolve(result.get(p.key)));
      } catch (e) {
        part.forEach(p => { cache.delete(p.key); p.reject(e); });
      }
    }
  };

  return {
    load(key: K) {
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < ttl) return hit.promise;
      const promise = new Promise<V | undefined>((resolve, reject) => {
        queue.push({ key, resolve, reject });
        if (!timer) timer = setTimeout(flush, wait);
      });
      cache.set(key, { at: Date.now(), promise });
      return promise;
    },
    clear(key?: K) {
      if (key === undefined) cache.clear();
      else cache.delete(key);
    },
  };
}

/** قيمة واحدة مشتركة (مثل جدول صغير ثابت) تُجلب مرة واحدة لكل فترة */
export function createSharedValue<V>(fetchOnce: () => Promise<V>, ttlMs = 5 * 60_000) {
  let cached: { at: number; promise: Promise<V> } | null = null;
  return {
    get(): Promise<V> {
      if (cached && Date.now() - cached.at < ttlMs) return cached.promise;
      const promise = fetchOnce().catch(e => { cached = null; throw e; });
      cached = { at: Date.now(), promise };
      return promise;
    },
    clear() { cached = null; },
  };
}

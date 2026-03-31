// ============================================================================
// FlowX — Async Memoization with TTL
// ============================================================================

export interface MemoOptions<TArgs extends any[]> {
  /** Time-to-live for cached results in ms (0 = forever) */
  ttl?: number;
  /** Maximum cache size (0 = unlimited) */
  maxSize?: number;
  /** Custom cache key generator */
  keyFn?: (...args: TArgs) => string;
  /** Whether to cache rejections (default: false) */
  cacheErrors?: boolean;
}

export interface MemoizedFunction<TArgs extends any[], TReturn> {
  (...args: TArgs): Promise<TReturn>;
  /** Clear the entire cache */
  clear: () => void;
  /** Delete a specific cache entry */
  delete: (...args: TArgs) => boolean;
  /** Current cache size */
  readonly size: number;
}

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  isError: boolean;
}

/**
 * Create a memoized version of an async function with TTL and LRU eviction.
 *
 * @example
 * ```ts
 * const cachedFetch = memo(fetchUser, {
 *   ttl: 60_000,
 *   maxSize: 100,
 *   keyFn: (id) => String(id),
 * });
 * const user = await cachedFetch(42);
 * ```
 */
export function memo<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options?: MemoOptions<TArgs>,
): MemoizedFunction<TArgs, TReturn> {
  const {
    ttl = 0,
    maxSize = 0,
    keyFn = (...args: TArgs) => JSON.stringify(args),
    cacheErrors = false,
  } = options ?? {};

  const cache = new Map<string, CacheEntry<TReturn>>();
  const pending = new Map<string, Promise<TReturn>>();

  function isExpired(entry: CacheEntry<TReturn>): boolean {
    if (ttl <= 0) return false;
    return Date.now() - entry.timestamp > ttl;
  }

  function evict(): void {
    if (maxSize <= 0 || cache.size < maxSize) return;
    // Remove the oldest entry (first key in Map insertion order)
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) {
      cache.delete(firstKey);
    }
  }

  async function memoized(...args: TArgs): Promise<TReturn> {
    const key = keyFn(...args);

    // Check cache
    const cached = cache.get(key);
    if (cached && !isExpired(cached)) {
      // Move to end for LRU
      cache.delete(key);
      cache.set(key, cached);

      if (cached.isError) {
        throw cached.value;
      }
      return cached.value;
    }

    // Remove expired entry
    if (cached) {
      cache.delete(key);
    }

    // Check for in-flight request deduplication
    const inflight = pending.get(key);
    if (inflight) return inflight;

    const promise = fn(...args)
      .then((value) => {
        evict();
        cache.set(key, { value, timestamp: Date.now(), isError: false });
        pending.delete(key);
        return value;
      })
      .catch((error) => {
        pending.delete(key);
        if (cacheErrors) {
          evict();
          cache.set(key, { value: error, timestamp: Date.now(), isError: true });
        }
        throw error;
      });

    pending.set(key, promise);
    return promise;
  }

  memoized.clear = (): void => {
    cache.clear();
    pending.clear();
  };

  memoized.delete = (...args: TArgs): boolean => {
    const key = keyFn(...args);
    return cache.delete(key);
  };

  Object.defineProperty(memoized, 'size', {
    get() {
      return cache.size;
    },
  });

  return memoized as MemoizedFunction<TArgs, TReturn>;
}

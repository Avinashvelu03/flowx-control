// ============================================================================
// FlowX — Token Bucket Rate Limiter
// ============================================================================
import { RateLimitError } from './types';

export interface RateLimitOptions {
  /** Maximum number of executions per interval */
  limit: number;
  /** Time window in ms */
  interval: number;
  /** Whether to reject or queue when limit is exceeded (default: 'queue') */
  strategy?: 'queue' | 'reject';
}

export interface RateLimiter {
  /** Execute a function within the rate limit */
  execute: <T>(fn: () => T | Promise<T>) => Promise<T>;
  /** Reset the rate limiter state */
  reset: () => void;
  /** Number of remaining tokens in current window */
  readonly remaining: number;
}

/**
 * Create a rate limiter using the token bucket algorithm.
 *
 * @example
 * ```ts
 * const limiter = createRateLimiter({ limit: 10, interval: 1000 });
 * await limiter.execute(() => fetch('/api'));
 * ```
 */
export function createRateLimiter(options: RateLimitOptions): RateLimiter {
  const { limit, interval, strategy = 'queue' } = options;

  if (limit < 1) throw new RangeError('limit must be >= 1');
  if (interval < 1) throw new RangeError('interval must be >= 1');

  let tokens = limit;
  let lastRefill = Date.now();
  const queue: Array<{ resolve: () => void }> = [];
  let drainTimer: ReturnType<typeof setTimeout> | null = null;

  function refill(): void {
    const now = Date.now();
    const elapsed = now - lastRefill;
    const refillCount = Math.floor(elapsed / interval) * limit;

    if (refillCount > 0) {
      tokens = Math.min(limit, tokens + refillCount);
      lastRefill = now;
    }
  }

  function drainQueue(): void {
    refill();
    while (queue.length > 0 && tokens > 0) {
      tokens--;
      const item = queue.shift()!;
      item.resolve();
    }

    if (queue.length > 0) {
      scheduleDrain();
    } else {
      drainTimer = null;
    }
  }

  function scheduleDrain(): void {
    if (drainTimer) return;
    const timeToNextToken = interval / limit;
    drainTimer = setTimeout(() => {
      drainTimer = null;
      drainQueue();
    }, timeToNextToken);
  }

  async function execute<T>(fn: () => T | Promise<T>): Promise<T> {
    refill();

    if (tokens > 0) {
      tokens--;
      return await fn();
    }

    if (strategy === 'reject') {
      throw new RateLimitError();
    }

    // Queue strategy — wait for a token
    await new Promise<void>((resolve) => {
      queue.push({ resolve });
      scheduleDrain();
    });

    return await fn();
  }

  function reset(): void {
    tokens = limit;
    lastRefill = Date.now();
    if (drainTimer) {
      clearTimeout(drainTimer);
      drainTimer = null;
    }
    drainQueue();
  }

  return {
    execute,
    reset,
    get remaining() {
      refill();
      return tokens;
    },
  };
}

// ============================================================================
// FlowX — Retry with Advanced Backoff Strategies
// ============================================================================
import { AbortError, BackoffStrategy, calculateDelay, sleep } from './types';

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  retries?: number;
  /** Base delay in ms between retries (default: 1000) */
  delay?: number;
  /** Backoff strategy (default: 'exponential') */
  backoff?: BackoffStrategy;
  /** Add randomized jitter to delays (default: false) */
  jitter?: boolean | number;
  /** Maximum delay cap in ms (default: 30000) */
  maxDelay?: number;
  /** Custom predicate to decide if retry should happen */
  shouldRetry?: (error: Error, attempt: number) => boolean | Promise<boolean>;
  /** Callback fired before each retry */
  onRetry?: (error: Error, attempt: number) => void | Promise<void>;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

/**
 * Execute an async function with automatic retry and configurable backoff.
 *
 * @example
 * ```ts
 * const data = await retry(() => fetch('/api/data'), {
 *   retries: 5,
 *   backoff: 'exponential',
 *   jitter: true,
 * });
 * ```
 */
export async function retry<T>(fn: () => T | Promise<T>, options?: RetryOptions): Promise<T> {
  const {
    retries = 3,
    delay = 1000,
    backoff = 'exponential',
    jitter = false,
    maxDelay = 30000,
    shouldRetry,
    onRetry,
    signal,
  } = options ?? {};

  if (retries < 0) {
    throw new RangeError('retries must be >= 0');
  }

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) {
      throw new AbortError('Retry aborted');
    }

    try {
      const result = await fn();
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === retries) break;

      if (shouldRetry) {
        const shouldContinue = await shouldRetry(lastError, attempt + 1);
        if (!shouldContinue) break;
      }

      if (onRetry) {
        await onRetry(lastError, attempt + 1);
      }

      let waitTime = calculateDelay(attempt + 1, delay, backoff, jitter);
      waitTime = Math.min(waitTime, maxDelay);

      await sleep(waitTime, signal);
    }
  }

  throw lastError!;
}

/**
 * Wrap a function to automatically retry on failure.
 *
 * @example
 * ```ts
 * const safeFetch = retryable(fetch, { retries: 3 });
 * const data = await safeFetch('/api/data');
 * ```
 */
export function retryable<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options?: RetryOptions,
): (...args: TArgs) => Promise<TReturn> {
  return (...args: TArgs) => retry(() => fn(...args), options);
}

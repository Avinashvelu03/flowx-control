// ============================================================================
// FlowX — Polling with Backoff
// ============================================================================
import { AbortError, BackoffStrategy, calculateDelay, sleep } from './types';

export interface PollOptions<T> {
  /** Polling interval in ms (default: 1000) */
  interval?: number;
  /** Condition to stop polling — return true to resolve */
  until?: (result: T) => boolean;
  /** Maximum number of poll attempts (default: Infinity) */
  maxAttempts?: number;
  /** Backoff strategy for interval (default: 'fixed') */
  backoff?: BackoffStrategy;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

export interface PollController<T> {
  /** Promise that resolves with the final result */
  result: Promise<T>;
  /** Stop polling early */
  stop: () => void;
}

/**
 * Poll an async function until a condition is met.
 *
 * @example
 * ```ts
 * const { result } = poll(
 *   () => checkJobStatus(jobId),
 *   { until: (status) => status === 'done', interval: 2000 },
 * );
 * const finalStatus = await result;
 * ```
 */
export function poll<T>(fn: () => T | Promise<T>, options?: PollOptions<T>): PollController<T> {
  const {
    interval = 1000,
    until,
    maxAttempts = Infinity,
    backoff = 'fixed',
    signal,
  } = options ?? {};

  if (interval < 0) throw new RangeError('interval must be >= 0');

  let stopped = false;
  let rejectFn: ((error: Error) => void) | null = null;

  const result = (async (): Promise<T> => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (stopped || signal?.aborted) {
        throw new AbortError('Polling stopped');
      }

      const value = await fn();

      if (until ? until(value) : true) {
        return value;
      }

      if (attempt < maxAttempts) {
        const waitTime = calculateDelay(attempt, interval, backoff);
        await sleep(waitTime, signal).catch((err) => {
          if (stopped) throw new AbortError('Polling stopped');
          throw err;
        });
      }
    }

    throw new Error('Polling exceeded maximum attempts');
  })();

  // Capture the reject function for external stopping
  const wrappedResult = new Promise<T>((resolve, reject) => {
    rejectFn = reject;
    result.then(resolve, reject);
  });

  function stop(): void {
    stopped = true;
    rejectFn?.(new AbortError('Polling stopped'));
  }

  return {
    result: wrappedResult,
    stop,
  };
}

// ============================================================================
// FlowX — Promise Timeout with Cleanup
// ============================================================================
import { AbortError, TimeoutError } from './types';

export interface TimeoutOptions<T = unknown> {
  /** Fallback value or factory when timeout occurs */
  fallback?: T | (() => T | Promise<T>);
  /** AbortSignal for external cancellation */
  signal?: AbortSignal;
  /** Custom error message */
  message?: string;
}

/**
 * Wrap an async operation with a timeout.
 *
 * @example
 * ```ts
 * const result = await withTimeout(() => fetch('/slow-api'), 5000);
 * ```
 */
export async function withTimeout<T>(
  fn: () => T | Promise<T>,
  ms: number,
  options?: TimeoutOptions<T>,
): Promise<T> {
  if (ms <= 0) {
    throw new RangeError('Timeout must be > 0');
  }

  if (options?.signal?.aborted) {
    throw new AbortError();
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;

      if (options?.fallback !== undefined) {
        const fb = options.fallback;
        if (typeof fb === 'function') {
          try {
            const result = (fb as () => T | Promise<T>)();
            Promise.resolve(result).then(resolve, reject);
          } catch (err) {
            reject(err);
          }
        } else {
          resolve(fb);
        }
      } else {
        reject(new TimeoutError(options?.message));
      }
    }, ms);

    const onAbort = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new AbortError());
    };

    if (options?.signal) {
      options.signal.addEventListener('abort', onAbort, { once: true });
    }

    try {
      const result = fn();
      Promise.resolve(result).then(
        (value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (options?.signal) {
            options.signal.removeEventListener('abort', onAbort);
          }
          resolve(value);
        },
        (error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (options?.signal) {
            options.signal.removeEventListener('abort', onAbort);
          }
          reject(error);
        },
      );
    } catch (error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (options?.signal) {
        options.signal.removeEventListener('abort', onAbort);
      }
      reject(error);
    }
  });
}

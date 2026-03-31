// ============================================================================
// FlowX — Bulkhead Isolation Pattern
// ============================================================================
import { BulkheadError } from './types';

export interface BulkheadOptions {
  /** Maximum concurrent executions (default: 10) */
  concurrency?: number;
  /** Maximum queue size for waiting tasks (default: 10) */
  queueSize?: number;
  /** Timeout in ms for queued tasks (0 = no timeout) */
  queueTimeout?: number;
}

export interface Bulkhead {
  /** Execute a function within the bulkhead */
  execute: <T>(fn: () => Promise<T>) => Promise<T>;
  /** Current number of active executions */
  readonly active: number;
  /** Current number of queued tasks */
  readonly queued: number;
  /** Available capacity */
  readonly available: number;
}

interface QueueItem<T = any> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * Create a bulkhead to isolate concurrent operations and prevent resource exhaustion.
 *
 * @example
 * ```ts
 * const bulkhead = createBulkhead({ concurrency: 5, queueSize: 10 });
 * const data = await bulkhead.execute(() => fetch('/api'));
 * ```
 */
export function createBulkhead(options?: BulkheadOptions): Bulkhead {
  const { concurrency = 10, queueSize = 10, queueTimeout = 0 } = options ?? {};

  if (concurrency < 1) throw new RangeError('concurrency must be >= 1');
  if (queueSize < 0) throw new RangeError('queueSize must be >= 0');

  let active = 0;
  const queue: QueueItem[] = [];

  function tryDequeue(): void {
    while (queue.length > 0 && active < concurrency) {
      const item = queue.shift()!;
      if (item.timer) clearTimeout(item.timer);
      run(item);
    }
  }

  async function run<T>(item: QueueItem<T>): Promise<void> {
    active++;
    try {
      const value = await item.fn();
      active--;
      tryDequeue();
      item.resolve(value);
    } catch (error) {
      active--;
      tryDequeue();
      item.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  function execute<T>(fn: () => Promise<T>): Promise<T> {
    if (active < concurrency) {
      return new Promise<T>((resolve, reject) => {
        run({ fn, resolve, reject });
      });
    }

    if (queue.length >= queueSize) {
      return Promise.reject(new BulkheadError());
    }

    return new Promise<T>((resolve, reject) => {
      const item: QueueItem<T> = { fn, resolve, reject };

      if (queueTimeout > 0) {
        item.timer = setTimeout(() => {
          const idx = queue.indexOf(item as QueueItem);
          if (idx !== -1) {
            queue.splice(idx, 1);
            reject(new BulkheadError('Bulkhead queue timeout exceeded'));
          }
        }, queueTimeout);
      }

      queue.push(item as QueueItem);
    });
  }

  return {
    execute,
    get active() {
      return active;
    },
    get queued() {
      return queue.length;
    },
    get available() {
      return Math.max(0, concurrency - active);
    },
  };
}

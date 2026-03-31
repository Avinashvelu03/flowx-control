// ============================================================================
// FlowX — Counting Semaphore
// ============================================================================

export interface Semaphore {
  /** Acquire a permit. Returns a release function. */
  acquire: () => Promise<() => void>;
  /** Execute a function exclusively within the semaphore */
  runExclusive: <T>(fn: () => T | Promise<T>) => Promise<T>;
  /** Number of available permits */
  readonly available: number;
  /** Number of tasks waiting for a permit */
  readonly waiting: number;
}

interface Waiter {
  resolve: (release: () => void) => void;
}

/**
 * Create a counting semaphore for concurrency control.
 *
 * @example
 * ```ts
 * const sem = createSemaphore(3);
 * const release = await sem.acquire();
 * try {
 *   await doWork();
 * } finally {
 *   release();
 * }
 * ```
 */
export function createSemaphore(permits: number): Semaphore {
  if (permits < 1) throw new RangeError('permits must be >= 1');

  let available = permits;
  const waiters: Waiter[] = [];

  function release(): void {
    available++;
    if (waiters.length > 0) {
      available--;
      const next = waiters.shift()!;
      next.resolve(release);
    }
  }

  function acquire(): Promise<() => void> {
    if (available > 0) {
      available--;
      return Promise.resolve(release);
    }

    return new Promise<() => void>((resolve) => {
      waiters.push({ resolve });
    });
  }

  async function runExclusive<T>(fn: () => T | Promise<T>): Promise<T> {
    const releaseFn = await acquire();
    try {
      return await fn();
    } finally {
      releaseFn();
    }
  }

  return {
    acquire,
    runExclusive,
    get available() {
      return available;
    },
    get waiting() {
      return waiters.length;
    },
  };
}

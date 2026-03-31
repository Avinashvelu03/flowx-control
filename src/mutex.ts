// ============================================================================
// FlowX — Mutual Exclusion Lock
// ============================================================================

export interface Mutex {
  /** Acquire the lock. Returns a release function. */
  lock: () => Promise<() => void>;
  /** Execute a function exclusively under the mutex */
  runExclusive: <T>(fn: () => T | Promise<T>) => Promise<T>;
  /** Whether the mutex is currently locked */
  readonly isLocked: boolean;
  /** Number of tasks waiting for the lock */
  readonly waiting: number;
}

/**
 * Create a mutual exclusion lock for serializing async operations.
 *
 * @example
 * ```ts
 * const mutex = createMutex();
 * await mutex.runExclusive(async () => {
 *   await updateSharedResource();
 * });
 * ```
 */
export function createMutex(): Mutex {
  let locked = false;
  const waitQueue: Array<(release: () => void) => void> = [];

  function release(): void {
    if (waitQueue.length > 0) {
      const next = waitQueue.shift()!;
      // Stay locked, transfer to next waiter
      next(release);
    } else {
      locked = false;
    }
  }

  function lock(): Promise<() => void> {
    if (!locked) {
      locked = true;
      return Promise.resolve(release);
    }

    return new Promise<() => void>((resolve) => {
      waitQueue.push(resolve);
    });
  }

  async function runExclusive<T>(fn: () => T | Promise<T>): Promise<T> {
    const releaseFn = await lock();
    try {
      return await fn();
    } finally {
      releaseFn();
    }
  }

  return {
    lock,
    runExclusive,
    get isLocked() {
      return locked;
    },
    get waiting() {
      return waitQueue.length;
    },
  };
}

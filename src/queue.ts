// ============================================================================
// FlowX — Priority Async Queue
// ============================================================================

export interface QueueOptions {
  /** Maximum concurrent tasks (default: 1) */
  concurrency?: number;
  /** Start processing immediately (default: true) */
  autoStart?: boolean;
  /** Per-task timeout in ms (0 = no timeout) */
  timeout?: number;
}

export interface QueueAddOptions {
  /** Task priority — lower number = higher priority (default: 0) */
  priority?: number;
}

export interface AsyncQueue {
  /** Add a task to the queue */
  add: <T>(fn: () => Promise<T>, options?: QueueAddOptions) => Promise<T>;
  /** Add multiple tasks and return all results */
  addAll: <T>(fns: Array<() => Promise<T>>, options?: QueueAddOptions) => Promise<T[]>;
  /** Pause processing */
  pause: () => void;
  /** Resume processing */
  resume: () => void;
  /** Clear all pending tasks */
  clear: () => void;
  /** Wait until the queue is empty */
  onEmpty: () => Promise<void>;
  /** Wait until the queue is idle (empty + no active tasks) */
  onIdle: () => Promise<void>;
  /** Number of pending tasks */
  readonly size: number;
  /** Number of active tasks */
  readonly pending: number;
  /** Whether the queue is paused */
  readonly isPaused: boolean;
}

interface QueueEntry {
  fn: () => Promise<any>;
  priority: number;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
}

/**
 * Create a priority async queue with concurrency control.
 *
 * @example
 * ```ts
 * const queue = createQueue({ concurrency: 3 });
 * const result = await queue.add(() => fetch('/api'), { priority: 1 });
 * await queue.onIdle();
 * ```
 */
export function createQueue(options?: QueueOptions): AsyncQueue {
  const { concurrency = 1, autoStart = true, timeout = 0 } = options ?? {};

  if (concurrency < 1) throw new RangeError('concurrency must be >= 1');

  let paused = !autoStart;
  let active = 0;
  const entries: QueueEntry[] = [];
  const emptyCallbacks: Array<() => void> = [];
  const idleCallbacks: Array<() => void> = [];

  function notifyIdle(): void {
    if (active === 0 && entries.length === 0) {
      for (const cb of idleCallbacks.splice(0)) cb();
    }
  }

  function notifyEmpty(): void {
    if (entries.length === 0) {
      for (const cb of emptyCallbacks.splice(0)) cb();
    }
  }

  function tryRun(): void {
    if (paused) return;

    while (active < concurrency && entries.length > 0) {
      const entry = entries.shift()!;
      active++;

      let timer: ReturnType<typeof setTimeout> | undefined;

      const run = async () => {
        try {
          let result: any;
          if (timeout > 0) {
            result = await Promise.race([
              entry.fn(),
              new Promise<never>((_, rej) => {
                timer = setTimeout(() => rej(new Error('Queue task timeout')), timeout);
              }),
            ]);
          } else {
            result = await entry.fn();
          }
          if (timer) clearTimeout(timer);
          entry.resolve(result);
        } catch (error) {
          if (timer) clearTimeout(timer);
          entry.reject(error instanceof Error ? error : new Error(String(error)));
        } finally {
          active--;
          notifyEmpty();
          tryRun();
          notifyIdle();
        }
      };

      run();
    }

    notifyEmpty();
    notifyIdle();
  }

  function add<T>(fn: () => Promise<T>, addOptions?: QueueAddOptions): Promise<T> {
    const priority = addOptions?.priority ?? 0;

    return new Promise<T>((resolve, reject) => {
      const entry: QueueEntry = { fn, priority, resolve, reject };

      // Insert sorted by priority (lower = higher priority)
      let inserted = false;
      for (let i = 0; i < entries.length; i++) {
        if (priority < entries[i].priority) {
          entries.splice(i, 0, entry);
          inserted = true;
          break;
        }
      }
      if (!inserted) {
        entries.push(entry);
      }

      tryRun();
    });
  }

  function addAll<T>(fns: Array<() => Promise<T>>, addOptions?: QueueAddOptions): Promise<T[]> {
    return Promise.all(fns.map((fn) => add(fn, addOptions)));
  }

  function pause(): void {
    paused = true;
  }

  function resume(): void {
    paused = false;
    tryRun();
  }

  function clear(): void {
    for (const entry of entries.splice(0)) {
      entry.reject(new Error('Queue cleared'));
    }
  }

  function onEmpty(): Promise<void> {
    if (entries.length === 0) return Promise.resolve();
    return new Promise<void>((resolve) => emptyCallbacks.push(resolve));
  }

  function onIdle(): Promise<void> {
    if (active === 0 && entries.length === 0) return Promise.resolve();
    return new Promise<void>((resolve) => idleCallbacks.push(resolve));
  }

  return {
    add,
    addAll,
    pause,
    resume,
    clear,
    onEmpty,
    onIdle,
    get size() {
      return entries.length;
    },
    get pending() {
      return active;
    },
    get isPaused() {
      return paused;
    },
  };
}

// ============================================================================
// FlowX — Async-Aware Throttle
// ============================================================================

export interface ThrottleOptions {
  /** Invoke on the leading edge (default: true) */
  leading?: boolean;
  /** Invoke on the trailing edge (default: true) */
  trailing?: boolean;
}

export interface ThrottledFunction<TArgs extends any[], TReturn> {
  (...args: TArgs): Promise<TReturn>;
  /** Cancel any pending trailing invocation */
  cancel: () => void;
  /** Whether there is a pending trailing invocation */
  readonly pending: boolean;
}

/**
 * Create a throttled version of an async function.
 *
 * @example
 * ```ts
 * const throttledSave = throttle(saveData, 1000);
 * await throttledSave(data);
 * ```
 */
export function throttle<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => TReturn | Promise<TReturn>,
  wait: number,
  options?: ThrottleOptions,
): ThrottledFunction<TArgs, TReturn> {
  const { leading = true, trailing = true } = options ?? {};

  if (wait < 0) throw new RangeError('wait must be >= 0');

  let lastCallTime: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: TArgs | null = null;
  let isPending = false;
  const trailingResolvers: Array<{
    resolve: (value: TReturn) => void;
    reject: (error: Error) => void;
  }> = [];

  async function invokeTrailing(): Promise<void> {
    const args = lastArgs;
    const resolvers = trailingResolvers.splice(0);
    lastArgs = null;
    isPending = false;
    timer = null;

    if (!args) {
      for (const r of resolvers) r.resolve(undefined as TReturn);
      return;
    }

    try {
      const result = await fn(...args);
      for (const r of resolvers) r.resolve(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      for (const r of resolvers) r.reject(err);
    }
  }

  function throttled(...args: TArgs): Promise<TReturn> {
    const now = Date.now();
    lastArgs = args;

    const timeSinceLastCall = lastCallTime === null ? wait : now - lastCallTime;
    const shouldCallLeading = leading && timeSinceLastCall >= wait;

    if (shouldCallLeading) {
      lastCallTime = now;
      lastArgs = null;

      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

      // Resolve any pending trailing resolvers with this call's result
      const prevResolvers = trailingResolvers.splice(0);

      const resultPromise = (async () => {
        try {
          const result = await fn(...args);
          for (const r of prevResolvers) r.resolve(result);
          return result;
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          for (const r of prevResolvers) r.reject(err);
          throw err;
        }
      })();

      if (trailing) {
        timer = setTimeout(() => {
          lastCallTime = Date.now();
          invokeTrailing();
        }, wait);
      }

      return resultPromise;
    }

    // Schedule trailing call
    isPending = true;

    return new Promise<TReturn>((resolve, reject) => {
      trailingResolvers.push({ resolve, reject });

      if (!timer && trailing) {
        const remaining = wait - timeSinceLastCall;
        timer = setTimeout(() => {
          lastCallTime = Date.now();
          invokeTrailing();
        }, remaining);
      }
    });
  }

  throttled.cancel = (): void => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    lastArgs = null;
    lastCallTime = null;
    isPending = false;
    const resolvers = trailingResolvers.splice(0);
    for (const r of resolvers) {
      r.reject(new Error('Throttled call cancelled'));
    }
  };

  Object.defineProperty(throttled, 'pending', {
    get() {
      return isPending;
    },
  });

  return throttled as ThrottledFunction<TArgs, TReturn>;
}

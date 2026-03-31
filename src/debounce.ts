// ============================================================================
// FlowX — Async-Aware Debounce
// ============================================================================

export interface DebounceOptions {
  /** Invoke on the leading edge (default: false) */
  leading?: boolean;
  /** Invoke on the trailing edge (default: true) */
  trailing?: boolean;
  /** Maximum wait time before forced invocation in ms */
  maxWait?: number;
}

export interface DebouncedFunction<TArgs extends any[], TReturn> {
  /** Call the debounced function */
  (...args: TArgs): Promise<TReturn>;
  /** Cancel any pending invocation */
  cancel: () => void;
  /** Immediately invoke any pending call */
  flush: () => Promise<TReturn | undefined>;
  /** Whether there is a pending invocation */
  readonly pending: boolean;
}

/**
 * Create a debounced version of an async function.
 *
 * @example
 * ```ts
 * const debouncedSearch = debounce(searchApi, 300);
 * await debouncedSearch('query');
 * ```
 */
export function debounce<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => TReturn | Promise<TReturn>,
  wait: number,
  options?: DebounceOptions,
): DebouncedFunction<TArgs, TReturn> {
  const { leading = false, trailing = true, maxWait } = options ?? {};

  if (wait < 0) throw new RangeError('wait must be >= 0');

  let timer: ReturnType<typeof setTimeout> | null = null;
  let maxTimer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: TArgs | null = null;
  const pendingResolvers: Array<{
    resolve: (value: TReturn) => void;
    reject: (error: Error) => void;
  }> = [];
  let isPending = false;

  async function invoke(): Promise<void> {
    if (!lastArgs && pendingResolvers.length === 0) return;

    const args = lastArgs!;
    const resolvers = pendingResolvers.splice(0);
    lastArgs = null;
    isPending = false;

    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (maxTimer) {
      clearTimeout(maxTimer);
      maxTimer = null;
    }

    try {
      const result = await fn(...args);
      for (const r of resolvers) r.resolve(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      for (const r of resolvers) r.reject(err);
    }
  }

  function debounced(...args: TArgs): Promise<TReturn> {
    lastArgs = args;

    return new Promise<TReturn>((resolve, reject) => {
      pendingResolvers.push({ resolve, reject });

      // Leading edge
      if (leading && !isPending) {
        isPending = true;
        invoke();
        return;
      }

      isPending = true;

      // Reset trailing timer
      if (timer) clearTimeout(timer);

      if (trailing) {
        timer = setTimeout(() => {
          timer = null;
          invoke();
        }, wait);
      }

      // Set max wait timer
      if (maxWait !== undefined && !maxTimer) {
        maxTimer = setTimeout(() => {
          maxTimer = null;
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
          invoke();
        }, maxWait);
      }
    });
  }

  debounced.cancel = (): void => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (maxTimer) {
      clearTimeout(maxTimer);
      maxTimer = null;
    }
    lastArgs = null;
    isPending = false;
    // Reject all pending resolvers
    const resolvers = pendingResolvers.splice(0);
    for (const r of resolvers) {
      r.reject(new Error('Debounced call cancelled'));
    }
  };

  debounced.flush = async (): Promise<TReturn | undefined> => {
    if (!isPending) return undefined;
    const promise = new Promise<TReturn>((resolve, reject) => {
      pendingResolvers.push({ resolve, reject });
    });
    await invoke();
    return promise;
  };

  Object.defineProperty(debounced, 'pending', {
    get() {
      return isPending;
    },
  });

  return debounced as DebouncedFunction<TArgs, TReturn>;
}

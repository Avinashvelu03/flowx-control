// ============================================================================
// FlowX — Hedged Requests
// ============================================================================

export interface HedgeOptions {
  /** Delay in ms before launching the hedge request (default: 500) */
  delay?: number;
  /** Maximum number of parallel hedged calls (default: 1) */
  maxHedges?: number;
}

/**
 * Execute a function with hedged requests — if the primary doesn't respond
 * quickly enough, fire parallel redundant calls and return whichever resolves first.
 *
 * @example
 * ```ts
 * const data = await hedge(() => fetch('/api'), { delay: 200 });
 * ```
 */
export function hedge<T>(fn: () => Promise<T>, options?: HedgeOptions): Promise<T> {
  const { delay = 500, maxHedges = 1 } = options ?? {};

  if (delay < 0) throw new RangeError('delay must be >= 0');
  if (maxHedges < 1) throw new RangeError('maxHedges must be >= 1');

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let completedCount = 0;
    const totalAttempts = 1 + maxHedges;
    const errors: Error[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];

    function onResult(value: T): void {
      if (settled) return;
      settled = true;
      // Clear pending hedge timers
      for (const t of timers) clearTimeout(t);
      resolve(value);
    }

    function onError(error: Error): void {
      errors.push(error);
      completedCount++;
      if (completedCount >= totalAttempts && !settled) {
        settled = true;
        reject(errors[0]);
      }
    }

    // Launch primary request immediately
    fn().then(onResult, (err) => onError(err instanceof Error ? err : new Error(String(err))));

    // Launch hedged requests after delay
    for (let i = 0; i < maxHedges; i++) {
      const timer = setTimeout(
        () => {
          if (settled) return;
          fn().then(onResult, (err) =>
            onError(err instanceof Error ? err : new Error(String(err))),
          );
        },
        delay * (i + 1),
      );
      timers.push(timer);
    }
  });
}

// ============================================================================
// FlowX — Fallback Chain
// ============================================================================

export interface FallbackOptions {
  /** Predicate to determine if the error warrants a fallback */
  shouldFallback?: (error: Error) => boolean;
  /** Callback fired when the primary function fails and fallback is used */
  onFallback?: (error: Error, fallbackIndex: number) => void;
}

/**
 * Execute a function with a fallback value or function if it fails.
 *
 * @example
 * ```ts
 * const data = await withFallback(
 *   () => fetch('/primary-api'),
 *   'default-value',
 * );
 * ```
 */
export async function withFallback<T>(
  fn: () => T | Promise<T>,
  fallback: T | (() => T | Promise<T>),
  options?: FallbackOptions,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    if (options?.shouldFallback && !options.shouldFallback(err)) {
      throw err;
    }

    options?.onFallback?.(err, 0);

    if (typeof fallback === 'function') {
      return await (fallback as () => T | Promise<T>)();
    }
    return fallback;
  }
}

/**
 * Execute the first successful function from a chain of fallbacks.
 *
 * @example
 * ```ts
 * const data = await fallbackChain([
 *   () => fetch('/primary'),
 *   () => fetch('/secondary'),
 *   () => fetch('/tertiary'),
 * ]);
 * ```
 */
export async function fallbackChain<T>(
  fns: Array<() => T | Promise<T>>,
  options?: FallbackOptions,
): Promise<T> {
  if (fns.length === 0) {
    throw new Error('fallbackChain requires at least one function');
  }

  let lastError: Error | undefined;

  for (let i = 0; i < fns.length; i++) {
    try {
      return await fns[i]();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (options?.shouldFallback && !options.shouldFallback(lastError)) {
        throw lastError;
      }

      if (i < fns.length - 1) {
        options?.onFallback?.(lastError, i + 1);
      }
    }
  }

  throw lastError!;
}

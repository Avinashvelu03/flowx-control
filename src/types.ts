// ============================================================================
// FlowX — Types & Error Hierarchy
// ============================================================================

/** Generic async function signature */
export type AsyncFn<TArgs extends any[] = any[], TReturn = any> = (
  ...args: TArgs
) => Promise<TReturn>;

/** Backoff strategy for retry/poll operations */
export type BackoffStrategy =
  | 'fixed'
  | 'linear'
  | 'exponential'
  | ((attempt: number, delay: number) => number);

// ── Error Classes ───────────────────────────────────────────────────────────

/** Base error class for all FlowX errors */
export class FlowXError extends Error {
  public readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'FlowXError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown when a promise exceeds its timeout */
export class TimeoutError extends FlowXError {
  constructor(message = 'Operation timed out') {
    super(message, 'ERR_TIMEOUT');
    this.name = 'TimeoutError';
  }
}

/** Thrown when a circuit breaker is open */
export class CircuitBreakerError extends FlowXError {
  constructor(message = 'Circuit breaker is open') {
    super(message, 'ERR_CIRCUIT_OPEN');
    this.name = 'CircuitBreakerError';
  }
}

/** Thrown when a bulkhead rejects due to capacity */
export class BulkheadError extends FlowXError {
  constructor(message = 'Bulkhead capacity exceeded') {
    super(message, 'ERR_BULKHEAD_FULL');
    this.name = 'BulkheadError';
  }
}

/** Thrown when an operation is aborted */
export class AbortError extends FlowXError {
  constructor(message = 'Operation aborted') {
    super(message, 'ERR_ABORTED');
    this.name = 'AbortError';
  }
}

/** Thrown when rate limit is exceeded */
export class RateLimitError extends FlowXError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 'ERR_RATE_LIMIT');
    this.name = 'RateLimitError';
  }
}

// ── Utility Helpers ─────────────────────────────────────────────────────────

/** Sleep for the specified duration, respecting AbortSignal */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortError());
      return;
    }
    const timer = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        reject(new AbortError());
      };
      signal.addEventListener('abort', onAbort, { once: true });
      // Clean up listener once timer fires
      const originalResolve = resolve;
      resolve = () => {
        signal.removeEventListener('abort', onAbort);
        originalResolve();
      };
    }
  });
}

/** Calculate delay based on backoff strategy */
export function calculateDelay(
  attempt: number,
  baseDelay: number,
  strategy: BackoffStrategy,
  jitter: boolean | number = false,
): number {
  let delay: number;

  if (typeof strategy === 'function') {
    delay = strategy(attempt, baseDelay);
  } else {
    switch (strategy) {
      case 'fixed':
        delay = baseDelay;
        break;
      case 'linear':
        delay = baseDelay * attempt;
        break;
      case 'exponential':
        delay = baseDelay * Math.pow(2, attempt - 1);
        break;
    }
  }

  if (jitter) {
    const factor = typeof jitter === 'number' ? jitter : 1;
    delay = delay * (1 - factor * 0.5 + Math.random() * factor);
  }

  return Math.max(0, Math.floor(delay));
}

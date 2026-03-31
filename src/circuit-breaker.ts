// ============================================================================
// FlowX — Circuit Breaker Pattern
// ============================================================================
import { CircuitBreakerError } from './types';

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  /** Number of failures before opening the circuit (default: 5) */
  failureThreshold?: number;
  /** Time in ms before attempting half-open (default: 30000) */
  resetTimeout?: number;
  /** Max concurrent calls in half-open state (default: 1) */
  halfOpenLimit?: number;
  /** Custom predicate to decide if an error should count as a failure */
  shouldTrip?: (error: Error) => boolean;
  /** Callback fired on state changes */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
  /** Number of successes in half-open to close the circuit (default: 1) */
  successThreshold?: number;
}

export interface CircuitBreaker<TArgs extends any[], TReturn> {
  /** Execute the protected function */
  fire: (...args: TArgs) => Promise<TReturn>;
  /** Get the current circuit state */
  readonly state: CircuitState;
  /** Get the current failure count */
  readonly failureCount: number;
  /** Get the current success count (in half-open) */
  readonly successCount: number;
  /** Manually reset the circuit to closed */
  reset: () => void;
  /** Manually open the circuit */
  open: () => void;
}

/**
 * Create a circuit breaker to protect against cascading failures.
 *
 * @example
 * ```ts
 * const breaker = createCircuitBreaker(callExternalApi, {
 *   failureThreshold: 5,
 *   resetTimeout: 30000,
 * });
 * const data = await breaker.fire('arg1');
 * ```
 */
export function createCircuitBreaker<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options?: CircuitBreakerOptions,
): CircuitBreaker<TArgs, TReturn> {
  const {
    failureThreshold = 5,
    resetTimeout = 30000,
    halfOpenLimit = 1,
    shouldTrip,
    onStateChange,
    successThreshold = 1,
  } = options ?? {};

  let state: CircuitState = 'closed';
  let failureCount = 0;
  let successCount = 0;
  let halfOpenActive = 0;
  let resetTimer: ReturnType<typeof setTimeout> | null = null;

  function transition(to: CircuitState): void {
    if (state === to) return;
    const from = state;
    state = to;
    onStateChange?.(from, to);
  }

  function scheduleReset(): void {
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      resetTimer = null;
      transition('half-open');
      halfOpenActive = 0;
      successCount = 0;
    }, resetTimeout);
  }

  function reset(): void {
    if (resetTimer) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }
    failureCount = 0;
    successCount = 0;
    halfOpenActive = 0;
    transition('closed');
  }

  function manualOpen(): void {
    if (resetTimer) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }
    failureCount = 0;
    successCount = 0;
    halfOpenActive = 0;
    transition('open');
    scheduleReset();
  }

  async function fire(...args: TArgs): Promise<TReturn> {
    if (state === 'open') {
      throw new CircuitBreakerError();
    }

    if (state === 'half-open' && halfOpenActive >= halfOpenLimit) {
      throw new CircuitBreakerError('Circuit breaker is half-open — limit reached');
    }

    if (state === 'half-open') {
      halfOpenActive++;
    }

    try {
      const result = await fn(...args);

      if (state === 'half-open') {
        successCount++;
        halfOpenActive--;
        if (successCount >= successThreshold) {
          reset();
        }
      } else {
        // In closed state, reset failure count on success
        failureCount = 0;
      }

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (shouldTrip && !shouldTrip(err)) {
        if (state === 'half-open') {
          halfOpenActive--;
        }
        throw err;
      }

      if (state === 'half-open') {
        halfOpenActive--;
        transition('open');
        scheduleReset();
      } else {
        failureCount++;
        if (failureCount >= failureThreshold) {
          transition('open');
          scheduleReset();
        }
      }

      throw err;
    }
  }

  return {
    fire,
    get state() {
      return state;
    },
    get failureCount() {
      return failureCount;
    },
    get successCount() {
      return successCount;
    },
    reset,
    open: manualOpen,
  };
}

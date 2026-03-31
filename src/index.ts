// ============================================================================
// FlowX — The Ultimate Async Resilience & Flow Control Toolkit
// ============================================================================
//
// Zero-dependency | TypeScript-first | Tree-shakable
//
// 17 modules covering:
//   Resilience:   retry, circuitBreaker, bulkhead, fallback, hedge
//   Concurrency:  semaphore, mutex, queue, rateLimit
//   Flow Control: timeout, debounce, throttle, batch
//   Composition:  pipeline, pipe, poll, deferred, memo
//
// ============================================================================

// ── Types & Errors ──────────────────────────────────────────────────────────
export {
  FlowXError,
  TimeoutError,
  CircuitBreakerError,
  BulkheadError,
  AbortError,
  RateLimitError,
  sleep,
  calculateDelay,
} from './types';
export type { AsyncFn, BackoffStrategy } from './types';

// ── Resilience ──────────────────────────────────────────────────────────────
export { retry, retryable } from './retry';
export type { RetryOptions } from './retry';

export { createCircuitBreaker } from './circuit-breaker';
export type { CircuitBreakerOptions, CircuitBreaker, CircuitState } from './circuit-breaker';

export { createBulkhead } from './bulkhead';
export type { BulkheadOptions, Bulkhead } from './bulkhead';

export { withFallback, fallbackChain } from './fallback';
export type { FallbackOptions } from './fallback';

export { hedge } from './hedge';
export type { HedgeOptions } from './hedge';

// ── Concurrency ─────────────────────────────────────────────────────────────
export { createSemaphore } from './semaphore';
export type { Semaphore } from './semaphore';

export { createMutex } from './mutex';
export type { Mutex } from './mutex';

export { createQueue } from './queue';
export type { AsyncQueue, QueueOptions, QueueAddOptions } from './queue';

export { createRateLimiter } from './rate-limit';
export type { RateLimitOptions, RateLimiter } from './rate-limit';

// ── Flow Control ────────────────────────────────────────────────────────────
export { withTimeout } from './timeout';
export type { TimeoutOptions } from './timeout';

export { debounce } from './debounce';
export type { DebounceOptions, DebouncedFunction } from './debounce';

export { throttle } from './throttle';
export type { ThrottleOptions, ThrottledFunction } from './throttle';

export { batch } from './batch';
export type { BatchOptions, BatchResult } from './batch';

// ── Composition ─────────────────────────────────────────────────────────────
export { pipeline, pipe } from './pipeline';
export type { PipelineStep } from './pipeline';

export { poll } from './poll';
export type { PollOptions, PollController } from './poll';

export { createDeferred } from './deferred';
export type { Deferred } from './deferred';

export { memo } from './memo';
export type { MemoOptions, MemoizedFunction } from './memo';

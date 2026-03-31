// ============================================================================
// FlowX — Deferred Promise
// ============================================================================

export interface Deferred<T> {
  /** The underlying promise */
  promise: Promise<T>;
  /** Resolve the deferred */
  resolve: (value: T | PromiseLike<T>) => void;
  /** Reject the deferred */
  reject: (reason?: any) => void;
  /** Whether the deferred has been settled */
  readonly isSettled: boolean;
  /** Whether the deferred was resolved */
  readonly isResolved: boolean;
  /** Whether the deferred was rejected */
  readonly isRejected: boolean;
}

/**
 * Create a deferred promise — a promise whose resolve/reject are externally accessible.
 *
 * @example
 * ```ts
 * const deferred = createDeferred<string>();
 * setTimeout(() => deferred.resolve('done'), 1000);
 * const result = await deferred.promise; // 'done'
 * ```
 */
export function createDeferred<T = void>(): Deferred<T> {
  let isSettled = false;
  let isResolved = false;
  let isRejected = false;
  let resolveFn!: (value: T | PromiseLike<T>) => void;
  let rejectFn!: (reason?: any) => void;

  const promise = new Promise<T>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  return {
    promise,
    resolve: (value: T | PromiseLike<T>) => {
      if (isSettled) return;
      isSettled = true;
      isResolved = true;
      resolveFn(value);
    },
    reject: (reason?: any) => {
      if (isSettled) return;
      isSettled = true;
      isRejected = true;
      rejectFn(reason);
    },
    get isSettled() {
      return isSettled;
    },
    get isResolved() {
      return isResolved;
    },
    get isRejected() {
      return isRejected;
    },
  };
}

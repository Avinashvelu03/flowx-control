// ============================================================================
// FlowX — Batch Processing with Concurrency
// ============================================================================
import { AbortError } from './types';

export interface BatchOptions {
  /** Maximum concurrent batch operations (default: Infinity) */
  concurrency?: number;
  /** Number of items per batch (default: 1) */
  batchSize?: number;
  /** Progress callback */
  onProgress?: (completed: number, total: number) => void;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

export interface BatchResult<T> {
  /** All results in order */
  results: T[];
  /** Total items processed */
  total: number;
  /** Number of succeeded items */
  succeeded: number;
  /** Number of failed items */
  failed: number;
  /** Errors indexed by position */
  errors: Map<number, Error>;
}

/**
 * Process an array of items in batches with concurrency control.
 *
 * @example
 * ```ts
 * const results = await batch(
 *   urls,
 *   async (url) => fetch(url).then(r => r.json()),
 *   { concurrency: 5, batchSize: 10 },
 * );
 * ```
 */
export async function batch<TItem, TResult>(
  items: TItem[],
  fn: (item: TItem, index: number) => Promise<TResult>,
  options?: BatchOptions,
): Promise<BatchResult<TResult>> {
  const { concurrency = Infinity, batchSize = 1, onProgress, signal } = options ?? {};

  if (batchSize < 1) throw new RangeError('batchSize must be >= 1');
  if (concurrency < 1) throw new RangeError('concurrency must be >= 1');

  const results: TResult[] = new Array(items.length);
  const errors = new Map<number, Error>();
  let completed = 0;
  let succeeded = 0;
  let failed = 0;

  // Split items into batches
  const batches: Array<{ items: TItem[]; startIndex: number }> = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push({
      items: items.slice(i, i + batchSize),
      startIndex: i,
    });
  }

  // Process batches with concurrency control
  let batchIndex = 0;

  async function processBatch(): Promise<void> {
    while (batchIndex < batches.length) {
      if (signal?.aborted) throw new AbortError();

      const currentBatch = batches[batchIndex++];

      for (let i = 0; i < currentBatch.items.length; i++) {
        if (signal?.aborted) throw new AbortError();

        const globalIndex = currentBatch.startIndex + i;
        try {
          results[globalIndex] = await fn(currentBatch.items[i], globalIndex);
          succeeded++;
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          errors.set(globalIndex, err);
          results[globalIndex] = undefined as TResult;
          failed++;
        }
        completed++;
        onProgress?.(completed, items.length);
      }
    }
  }

  const workers: Promise<void>[] = [];
  const workerCount = Math.min(concurrency, batches.length);

  for (let i = 0; i < workerCount; i++) {
    workers.push(processBatch());
  }

  await Promise.all(workers);

  return {
    results,
    total: items.length,
    succeeded,
    failed,
    errors,
  };
}

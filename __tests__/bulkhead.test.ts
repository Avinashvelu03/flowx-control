import { createBulkhead } from '../src/bulkhead';
import { BulkheadError } from '../src/types';

describe('createBulkhead', () => {
  it('should execute within concurrency limit', async () => {
    const bh = createBulkhead({ concurrency: 2, queueSize: 0 });
    const result = await bh.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
  });

  it('should track active count', async () => {
    const bh = createBulkhead({ concurrency: 2, queueSize: 5 });

    let resolveFirst!: () => void;
    const p1 = bh.execute(
      () =>
        new Promise<string>((r) => {
          resolveFirst = () => r('a');
        }),
    );

    expect(bh.active).toBe(1);
    expect(bh.available).toBe(1);

    resolveFirst();
    await p1;

    expect(bh.active).toBe(0);
    expect(bh.available).toBe(2);
  });

  it('should queue when at concurrency limit', async () => {
    const bh = createBulkhead({ concurrency: 1, queueSize: 5 });
    const order: number[] = [];

    let resolveFirst!: () => void;
    const p1 = bh.execute(
      () =>
        new Promise<void>((r) => {
          resolveFirst = () => {
            order.push(1);
            r();
          };
        }),
    );
    const p2 = bh.execute(async () => {
      order.push(2);
    });

    expect(bh.active).toBe(1);
    expect(bh.queued).toBe(1);

    resolveFirst();
    await p1;
    await p2;

    expect(order).toEqual([1, 2]);
  });

  it('should reject when queue is full', async () => {
    const bh = createBulkhead({ concurrency: 1, queueSize: 0 });

    const p1 = bh.execute(() => new Promise<void>((r) => setTimeout(r, 100)));
    await expect(bh.execute(() => Promise.resolve())).rejects.toThrow(BulkheadError);

    await p1;
  });

  it('should handle queue timeout', async () => {
    const bh = createBulkhead({ concurrency: 1, queueSize: 5, queueTimeout: 50 });

    const p1 = bh.execute(() => new Promise<void>((r) => setTimeout(r, 200)));

    await expect(bh.execute(() => Promise.resolve('queued'))).rejects.toThrow(BulkheadError);

    await p1;
  });

  it('should propagate errors from executed functions', async () => {
    const bh = createBulkhead({ concurrency: 2 });
    await expect(bh.execute(() => Promise.reject(new Error('task error')))).rejects.toThrow(
      'task error',
    );
  });

  it('should handle non-Error rejections', async () => {
    const bh = createBulkhead({ concurrency: 2 });
    await expect(bh.execute(() => Promise.reject('string error'))).rejects.toThrow('string error');
  });

  it('should throw RangeError for invalid options', () => {
    expect(() => createBulkhead({ concurrency: 0 })).toThrow(RangeError);
    expect(() => createBulkhead({ queueSize: -1 })).toThrow(RangeError);
  });

  it('should use default options', () => {
    const bh = createBulkhead();
    expect(bh.available).toBe(10); // default concurrency
  });

  it('should dequeue items after capacity frees up', async () => {
    const bh = createBulkhead({ concurrency: 1, queueSize: 2 });
    const results: string[] = [];

    let resolveFirst!: () => void;
    const p1 = bh.execute(
      () =>
        new Promise<void>((r) => {
          resolveFirst = () => {
            results.push('a');
            r();
          };
        }),
    );
    const p2 = bh.execute(async () => {
      results.push('b');
    });
    const p3 = bh.execute(async () => {
      results.push('c');
    });

    expect(bh.queued).toBe(2);

    resolveFirst();
    await p1;
    await p2;
    await p3;

    expect(results).toEqual(['a', 'b', 'c']);
    expect(results).toEqual(['a', 'b', 'c']);
  });

  it('should clear queue timeout if dequeued in time', async () => {
    const bh = createBulkhead({ concurrency: 1, queueSize: 1, queueTimeout: 100 });
    const p1 = bh.execute(() => new Promise((r) => setTimeout(r, 10)));
    const p2 = bh.execute(() => Promise.resolve('queued'));
    await p1;
    expect(await p2).toBe('queued');
  });
});

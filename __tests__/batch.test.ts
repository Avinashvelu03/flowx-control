import { batch } from '../src/batch';
import { AbortError } from '../src/types';

describe('batch', () => {
  it('should process all items', async () => {
    const result = await batch([1, 2, 3], async (item) => item * 2);
    expect(result.results).toEqual([2, 4, 6]);
    expect(result.total).toBe(3);
    expect(result.succeeded).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.errors.size).toBe(0);
  });

  it('should handle empty items', async () => {
    const result = await batch([], async (item: number) => item * 2);
    expect(result.results).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('should respect concurrency', async () => {
    const running: number[] = [];
    let maxConcurrent = 0;

    await batch(
      [1, 2, 3, 4, 5, 6],
      async (item) => {
        running.push(item);
        maxConcurrent = Math.max(maxConcurrent, running.length);
        await new Promise((r) => setTimeout(r, 20));
        running.splice(running.indexOf(item), 1);
        return item;
      },
      { concurrency: 2 },
    );

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it('should respect batchSize', async () => {
    const result = await batch([1, 2, 3, 4, 5], async (item) => item, { batchSize: 2 });
    expect(result.results).toEqual([1, 2, 3, 4, 5]);
  });

  it('should collect errors without stopping', async () => {
    const result = await batch([1, 2, 3], async (item) => {
      if (item === 2) throw new Error('fail-2');
      return item * 10;
    });

    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.errors.get(1)!.message).toBe('fail-2');
    expect(result.results[0]).toBe(10);
    expect(result.results[2]).toBe(30);
  });

  it('should call onProgress', async () => {
    const onProgress = jest.fn();
    await batch([1, 2, 3], async (item) => item, { onProgress });

    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenCalledWith(1, 3);
    expect(onProgress).toHaveBeenCalledWith(2, 3);
    expect(onProgress).toHaveBeenCalledWith(3, 3);
  });

  it('should abort with signal', async () => {
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 30);

    await expect(
      batch(
        [1, 2, 3, 4, 5],
        async (item) => {
          await new Promise((r) => setTimeout(r, 50));
          return item;
        },
        { signal: ac.signal, concurrency: 1 },
      ),
    ).rejects.toThrow(AbortError);
  });

  it('should throw RangeError for invalid options', async () => {
    await expect(batch([1], async (x) => x, { batchSize: 0 })).rejects.toThrow(RangeError);

    await expect(batch([1], async (x) => x, { concurrency: 0 })).rejects.toThrow(RangeError);
  });

  it('should pass index to callback', async () => {
    const indices: number[] = [];
    await batch([10, 20, 30], async (_item, index) => {
      indices.push(index);
      return index;
    });
    expect(indices).toEqual([0, 1, 2]);
  });

  it('should use default options', async () => {
    const result = await batch([1, 2], async (item) => item);
    expect(result.results).toEqual([1, 2]);
  });

  it('should abort during batch execution (signal check in loop)', async () => {
    const ac = new AbortController();
    await expect(
      batch(
        [1, 2],
        async (item) => {
          if (item === 1) ac.abort();
          return item;
        },
        { signal: ac.signal, batchSize: 2 },
      ),
    ).rejects.toThrow(AbortError);
  });
});

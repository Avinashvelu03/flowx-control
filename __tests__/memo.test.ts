import { memo } from '../src/memo';

describe('memo', () => {
  it('should cache results', async () => {
    const fn = jest.fn().mockResolvedValue('result');
    const memoized = memo(fn);

    const r1 = await memoized('a');
    const r2 = await memoized('a');

    expect(fn).toHaveBeenCalledTimes(1);
    expect(r1).toBe('result');
    expect(r2).toBe('result');
  });

  it('should differentiate by arguments', async () => {
    const fn = jest.fn().mockImplementation(async (x: string) => `result-${x}`);
    const memoized = memo(fn);

    const r1 = await memoized('a');
    const r2 = await memoized('b');

    expect(fn).toHaveBeenCalledTimes(2);
    expect(r1).toBe('result-a');
    expect(r2).toBe('result-b');
  });

  it('should respect TTL', async () => {
    const fn = jest.fn().mockResolvedValue('result');
    const memoized = memo(fn, { ttl: 50 });

    await memoized('a');
    expect(fn).toHaveBeenCalledTimes(1);

    await new Promise((r) => setTimeout(r, 70));

    await memoized('a');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should respect maxSize with LRU eviction', async () => {
    const fn = jest.fn().mockImplementation(async (x: string) => `result-${x}`);
    const memoized = memo(fn, { maxSize: 2 });

    await memoized('a');
    await memoized('b');
    await memoized('c'); // should evict 'a'

    expect(memoized.size).toBe(2);

    await memoized('a'); // should call fn again (evicted)
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('should use custom key function', async () => {
    const fn = jest.fn().mockResolvedValue('result');
    const memoized = memo(fn, { keyFn: (x: number) => String(Math.floor(x / 10)) });

    await memoized(5);
    await memoized(9); // same key as 5 (floor(9/10) = 0)

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should cache errors when cacheErrors is true', async () => {
    let callCount = 0;
    const fn = jest.fn().mockImplementation(async () => {
      callCount++;
      throw new Error(`error-${callCount}`);
    });

    const memoized = memo(fn, { cacheErrors: true });

    await expect(memoized('a')).rejects.toThrow('error-1');
    await expect(memoized('a')).rejects.toThrow('error-1'); // cached error
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should not cache errors by default', async () => {
    let callCount = 0;
    const fn = jest.fn().mockImplementation(async () => {
      callCount++;
      throw new Error(`error-${callCount}`);
    });

    const memoized = memo(fn);

    await expect(memoized('a')).rejects.toThrow('error-1');
    await expect(memoized('a')).rejects.toThrow('error-2'); // not cached
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should deduplicate in-flight requests', async () => {
    const fn = jest
      .fn()
      .mockImplementation(() => new Promise((r) => setTimeout(() => r('result'), 50)));
    const memoized = memo(fn);

    const p1 = memoized('a');
    const p2 = memoized('a');

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(r1).toBe('result');
    expect(r2).toBe('result');
  });

  it('should clear cache', async () => {
    const fn = jest.fn().mockResolvedValue('result');
    const memoized = memo(fn);

    await memoized('a');
    expect(memoized.size).toBe(1);

    memoized.clear();
    expect(memoized.size).toBe(0);

    await memoized('a');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should delete specific entry', async () => {
    const fn = jest.fn().mockResolvedValue('result');
    const memoized = memo(fn);

    await memoized('a');
    await memoized('b');
    expect(memoized.size).toBe(2);

    const deleted = memoized.delete('a');
    expect(deleted).toBe(true);
    expect(memoized.size).toBe(1);

    const notDeleted = memoized.delete('non-existent');
    expect(notDeleted).toBe(false);
  });

  it('should track cache size', async () => {
    const fn = jest.fn().mockResolvedValue('result');
    const memoized = memo(fn);

    expect(memoized.size).toBe(0);
    await memoized('a');
    expect(memoized.size).toBe(1);
  });

  it('should move accessed entries to end for LRU', async () => {
    const fn = jest.fn().mockImplementation(async (x: string) => x);
    const memoized = memo(fn, { maxSize: 2 });

    await memoized('a');
    await memoized('b');
    await memoized('a'); // access 'a' again, moves to end

    await memoized('c'); // should evict 'b' (least recently used)
    expect(memoized.size).toBe(2);

    fn.mockClear();
    await memoized('a'); // should still be cached
    expect(fn).not.toHaveBeenCalled();

    await memoized('b'); // should NOT be cached (was evicted)
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should use default options', async () => {
    const fn = jest.fn().mockResolvedValue('result');
    const memoized = memo(fn);
    await memoized('a');
    expect(memoized.size).toBe(1);
  });
});

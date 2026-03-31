import { withTimeout } from '../src/timeout';
import { TimeoutError, AbortError } from '../src/types';

describe('withTimeout', () => {
  it('should resolve when function completes before timeout', async () => {
    const result = await withTimeout(() => Promise.resolve('ok'), 1000);
    expect(result).toBe('ok');
  });

  it('should throw TimeoutError when function exceeds timeout', async () => {
    await expect(
      withTimeout(() => new Promise((resolve) => setTimeout(resolve, 500)), 50),
    ).rejects.toThrow(TimeoutError);
  });

  it('should use custom error message', async () => {
    await expect(
      withTimeout(() => new Promise((resolve) => setTimeout(resolve, 500)), 50, {
        message: 'custom timeout',
      }),
    ).rejects.toThrow('custom timeout');
  });

  it('should return fallback value on timeout', async () => {
    const result = await withTimeout(() => new Promise((resolve) => setTimeout(resolve, 500)), 50, {
      fallback: 'default',
    });
    expect(result).toBe('default');
  });

  it('should call fallback function on timeout', async () => {
    const result = await withTimeout(() => new Promise((resolve) => setTimeout(resolve, 500)), 50, {
      fallback: () => 'computed-default',
    });
    expect(result).toBe('computed-default');
  });

  it('should call async fallback function on timeout', async () => {
    const result = await withTimeout(() => new Promise((resolve) => setTimeout(resolve, 500)), 50, {
      fallback: async () => 'async-default',
    });
    expect(result).toBe('async-default');
  });

  it('should propagate fallback function errors', async () => {
    await expect(
      withTimeout(() => new Promise((resolve) => setTimeout(resolve, 500)), 50, {
        fallback: () => {
          throw new Error('fallback err');
        },
      }),
    ).rejects.toThrow('fallback err');
  });

  it('should throw RangeError for non-positive timeout', async () => {
    await expect(withTimeout(() => Promise.resolve('ok'), 0)).rejects.toThrow(RangeError);
    await expect(withTimeout(() => Promise.resolve('ok'), -1)).rejects.toThrow(RangeError);
  });

  it('should throw AbortError when signal is already aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(
      withTimeout(() => Promise.resolve('ok'), 1000, { signal: ac.signal }),
    ).rejects.toThrow(AbortError);
  });

  it('should throw AbortError when signal is aborted during execution', async () => {
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 20);
    await expect(
      withTimeout(() => new Promise((resolve) => setTimeout(resolve, 5000)), 10000, {
        signal: ac.signal,
      }),
    ).rejects.toThrow(AbortError);
  });

  it('should handle synchronous throw from fn', async () => {
    await expect(
      withTimeout(() => {
        throw new Error('sync error');
      }, 1000),
    ).rejects.toThrow('sync error');
  });

  it('should handle rejection from fn', async () => {
    await expect(withTimeout(() => Promise.reject(new Error('rejected')), 1000)).rejects.toThrow(
      'rejected',
    );
  });

  it('should handle sync return values', async () => {
    const result = await withTimeout(() => 'sync-value' as any, 1000);
    expect(result).toBe('sync-value');
  });

  it('should remove abort listener on success', async () => {
    const ac = new AbortController();
    const result = await withTimeout(() => Promise.resolve('ok'), 1000, { signal: ac.signal });
    expect(result).toBe('ok');
  });

  it('should remove abort listener on rejection', async () => {
    const ac = new AbortController();
    await expect(
      withTimeout(() => Promise.reject(new Error('fail')), 1000, { signal: ac.signal }),
    ).rejects.toThrow('fail');
  });

  it('should remove abort listener on sync throw', async () => {
    const ac = new AbortController();
    await expect(
      withTimeout(
        () => {
          throw new Error('sync');
        },
        1000,
        { signal: ac.signal },
      ),
    ).rejects.toThrow('sync');
  });
});

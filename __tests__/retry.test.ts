import { retry, retryable } from '../src/retry';
import { AbortError } from '../src/types';

describe('retry', () => {
  it('should resolve on first try if no error', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await retry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValue('ok');

    const result = await retry(fn, { retries: 3, delay: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after all retries exhausted', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('always fail'));
    await expect(retry(fn, { retries: 2, delay: 10 })).rejects.toThrow('always fail');
    expect(fn).toHaveBeenCalledTimes(3); // 1 + 2 retries
  });

  it('should use fixed backoff', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('ok');

    const start = Date.now();
    await retry(fn, { retries: 1, delay: 50, backoff: 'fixed' });
    expect(Date.now() - start).toBeGreaterThanOrEqual(40);
  });

  it('should use linear backoff', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('ok');

    await retry(fn, { retries: 1, delay: 10, backoff: 'linear' });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should use custom backoff function', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('ok');

    const customBackoff = jest.fn().mockReturnValue(10);
    await retry(fn, { retries: 1, delay: 100, backoff: customBackoff });
    expect(customBackoff).toHaveBeenCalledWith(1, 100);
  });

  it('should respect maxDelay', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('ok');

    const start = Date.now();
    await retry(fn, {
      retries: 1,
      delay: 10000,
      backoff: 'exponential',
      maxDelay: 30,
    });
    expect(Date.now() - start).toBeLessThan(200);
  });

  it('should call onRetry callback', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error('fail1')).mockResolvedValue('ok');

    const onRetry = jest.fn();
    await retry(fn, { retries: 1, delay: 10, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1);
  });

  it('should stop retrying when shouldRetry returns false', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('stop'));

    await expect(
      retry(fn, {
        retries: 5,
        delay: 10,
        shouldRetry: (_err, attempt) => attempt < 2,
      }),
    ).rejects.toThrow('stop');
    expect(fn).toHaveBeenCalledTimes(2); // initial + 1 retry (shouldRetry stops at attempt 2)
  });

  it('should support async shouldRetry', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('stop'));

    await expect(
      retry(fn, {
        retries: 5,
        delay: 10,
        shouldRetry: async () => false,
      }),
    ).rejects.toThrow('stop');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should abort when signal is already aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(retry(() => Promise.resolve('ok'), { signal: ac.signal })).rejects.toThrow(
      AbortError,
    );
  });

  it('should abort during retry delay', async () => {
    const ac = new AbortController();
    const fn = jest.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('ok');

    setTimeout(() => ac.abort(), 20);
    await expect(retry(fn, { retries: 3, delay: 5000, signal: ac.signal })).rejects.toThrow(
      AbortError,
    );
  });

  it('should throw RangeError for negative retries', async () => {
    await expect(retry(() => Promise.resolve('ok'), { retries: -1 })).rejects.toThrow(RangeError);
  });

  it('should handle non-Error thrown values', async () => {
    const fn = jest.fn().mockRejectedValue('string error');
    await expect(retry(fn, { retries: 0 })).rejects.toThrow('string error');
  });

  it('should support jitter option', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('ok');

    await retry(fn, { retries: 1, delay: 10, jitter: true });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should use default options when none provided', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await retry(fn);
    expect(result).toBe('ok');
  });

  it('should handle sync functions that return values', async () => {
    const fn = jest.fn().mockReturnValue('sync-ok');
    const result = await retry(fn);
    expect(result).toBe('sync-ok');
  });
});

describe('retryable', () => {
  it('should wrap a function with retry logic', async () => {
    const fn = jest
      .fn<Promise<string>, [string]>()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    const wrapped = retryable(fn, { retries: 2, delay: 10 });
    const result = await wrapped('arg1');
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledWith('arg1');
  });

  it('should preserve function arguments', async () => {
    const fn = jest.fn<Promise<number>, [number, number]>().mockResolvedValue(42);

    const wrapped = retryable(fn, { retries: 1 });
    const result = await wrapped(1, 2);
    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledWith(1, 2);
  });
});

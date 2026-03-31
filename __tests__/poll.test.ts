import { poll } from '../src/poll';
import { AbortError } from '../src/types';

describe('poll', () => {
  it('should resolve immediately when until returns true', async () => {
    const fn = jest.fn().mockResolvedValue('done');
    const { result } = poll(fn, { until: () => true, interval: 100 });
    expect(await result).toBe('done');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should poll until condition is met', async () => {
    let count = 0;
    const fn = jest.fn().mockImplementation(() => {
      count++;
      return Promise.resolve(count);
    });

    const { result } = poll(fn, {
      until: (val) => val >= 3,
      interval: 20,
    });

    expect(await result).toBe(3);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should respect maxAttempts', async () => {
    const fn = jest.fn().mockResolvedValue('not-done');

    const { result } = poll(fn, {
      until: () => false,
      interval: 10,
      maxAttempts: 3,
    });

    await expect(result).rejects.toThrow('Polling exceeded maximum attempts');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should stop when stop() is called', async () => {
    const fn = jest
      .fn()
      .mockImplementation(() => new Promise((r) => setTimeout(() => r('val'), 50)));

    const controller = poll(fn, {
      until: () => false,
      interval: 20,
    });

    setTimeout(() => controller.stop(), 30);

    await expect(controller.result).rejects.toThrow(AbortError);
  });

  it('should abort with signal', async () => {
    const ac = new AbortController();
    const fn = jest.fn().mockResolvedValue('val');

    const { result } = poll(fn, {
      until: () => false,
      interval: 20,
      signal: ac.signal,
    });

    setTimeout(() => ac.abort(), 30);

    await expect(result).rejects.toThrow();
  });

  it('should support exponential backoff', async () => {
    let count = 0;
    const fn = jest.fn().mockImplementation(() => {
      count++;
      return Promise.resolve(count);
    });

    const { result } = poll(fn, {
      until: (val) => val >= 2,
      interval: 10,
      backoff: 'exponential',
    });

    await result;
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should resolve without until predicate (first call)', async () => {
    const fn = jest.fn().mockResolvedValue('immediate');
    const { result } = poll(fn, { interval: 100 });
    expect(await result).toBe('immediate');
  });

  it('should throw RangeError for negative interval', () => {
    expect(() => poll(jest.fn(), { interval: -1 })).toThrow(RangeError);
  });

  it('should handle sync return values', async () => {
    const fn = jest.fn().mockReturnValue('sync');
    const { result } = poll(fn, { until: () => true });
    expect(await result).toBe('sync');
  });

  it('should use default options', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const { result } = poll(fn);
    expect(await result).toBe('ok');
  });

  it('should stop polling if aborted during interval', async () => {
    const ac = new AbortController();
    const fn = jest.fn().mockImplementation(() => new Promise((r) => setTimeout(r, 10)));
    const controller = poll(fn, { until: () => false, interval: 50, signal: ac.signal });
    setTimeout(() => ac.abort(), 30);
    await expect(controller.result).rejects.toThrow(AbortError);
  });
});

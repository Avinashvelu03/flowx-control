import { createRateLimiter } from '../src/rate-limit';
import { RateLimitError } from '../src/types';

describe('createRateLimiter', () => {
  it('should allow calls within limit', async () => {
    const limiter = createRateLimiter({ limit: 5, interval: 1000 });
    const results: number[] = [];

    for (let i = 0; i < 5; i++) {
      results.push(await limiter.execute(() => Promise.resolve(i)));
    }

    expect(results).toEqual([0, 1, 2, 3, 4]);
  });

  it('should track remaining tokens', () => {
    const limiter = createRateLimiter({ limit: 3, interval: 1000 });
    expect(limiter.remaining).toBe(3);
  });

  it('should reject when limit exceeded with reject strategy', async () => {
    const limiter = createRateLimiter({
      limit: 1,
      interval: 1000,
      strategy: 'reject',
    });

    await limiter.execute(() => Promise.resolve('ok'));

    await expect(limiter.execute(() => Promise.resolve('fail'))).rejects.toThrow(RateLimitError);
  });

  it('should queue when limit exceeded with queue strategy', async () => {
    const limiter = createRateLimiter({
      limit: 1,
      interval: 50,
      strategy: 'queue',
    });

    const results: string[] = [];
    const p1 = limiter.execute(async () => {
      results.push('a');
      return 'a';
    });
    const p2 = limiter.execute(async () => {
      results.push('b');
      return 'b';
    });

    await p1;
    await p2;

    expect(results).toContain('a');
    expect(results).toContain('b');
  });

  it('should refill tokens after interval', async () => {
    const limiter = createRateLimiter({ limit: 1, interval: 50 });

    await limiter.execute(() => Promise.resolve('first'));
    expect(limiter.remaining).toBe(0);

    await new Promise((r) => setTimeout(r, 70));
    expect(limiter.remaining).toBeGreaterThanOrEqual(1);
  });

  it('should reset the limiter', async () => {
    const limiter = createRateLimiter({
      limit: 1,
      interval: 10000,
      strategy: 'reject',
    });

    await limiter.execute(() => Promise.resolve('ok'));
    expect(limiter.remaining).toBe(0);

    limiter.reset();
    expect(limiter.remaining).toBe(1);
  });

  it('should throw RangeError for invalid options', () => {
    expect(() => createRateLimiter({ limit: 0, interval: 1000 })).toThrow(RangeError);
    expect(() => createRateLimiter({ limit: 1, interval: 0 })).toThrow(RangeError);
  });

  it('should use default queue strategy', async () => {
    const limiter = createRateLimiter({ limit: 1, interval: 30 });

    const p1 = limiter.execute(() => Promise.resolve('a'));
    const p2 = limiter.execute(() => Promise.resolve('b'));

    expect(await p1).toBe('a');
    expect(await p2).toBe('b');
  });

  it('should handle sync functions', async () => {
    const limiter = createRateLimiter({ limit: 2, interval: 1000 });
    const result = await limiter.execute(() => 42);
    expect(result).toBe(42);
  });

  it('should clear drainTimer and resolve queued items on reset', async () => {
    const limiter = createRateLimiter({ limit: 1, interval: 100, strategy: 'queue' });
    
    await limiter.execute(() => 1);
    const p1 = limiter.execute(() => 2);
    const p2 = limiter.execute(() => 3);
    
    limiter.reset();
    
    await expect(p1).resolves.toBe(2);
    await expect(p2).resolves.toBe(3);
  });
});

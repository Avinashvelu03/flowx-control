import {
  FlowXError,
  TimeoutError,
  CircuitBreakerError,
  BulkheadError,
  AbortError,
  RateLimitError,
  sleep,
  calculateDelay,
} from '../src/types';

describe('FlowXError', () => {
  it('should create with message and code', () => {
    const err = new FlowXError('test', 'ERR_TEST');
    expect(err.message).toBe('test');
    expect(err.code).toBe('ERR_TEST');
    expect(err.name).toBe('FlowXError');
    expect(err instanceof Error).toBe(true);
    expect(err instanceof FlowXError).toBe(true);
  });
});

describe('TimeoutError', () => {
  it('should create with default message', () => {
    const err = new TimeoutError();
    expect(err.message).toBe('Operation timed out');
    expect(err.code).toBe('ERR_TIMEOUT');
    expect(err.name).toBe('TimeoutError');
    expect(err instanceof FlowXError).toBe(true);
  });

  it('should create with custom message', () => {
    const err = new TimeoutError('custom timeout');
    expect(err.message).toBe('custom timeout');
  });
});

describe('CircuitBreakerError', () => {
  it('should create with default message', () => {
    const err = new CircuitBreakerError();
    expect(err.message).toBe('Circuit breaker is open');
    expect(err.code).toBe('ERR_CIRCUIT_OPEN');
    expect(err.name).toBe('CircuitBreakerError');
  });

  it('should create with custom message', () => {
    const err = new CircuitBreakerError('custom');
    expect(err.message).toBe('custom');
  });
});

describe('BulkheadError', () => {
  it('should create with default message', () => {
    const err = new BulkheadError();
    expect(err.message).toBe('Bulkhead capacity exceeded');
    expect(err.code).toBe('ERR_BULKHEAD_FULL');
    expect(err.name).toBe('BulkheadError');
  });

  it('should create with custom message', () => {
    const err = new BulkheadError('custom');
    expect(err.message).toBe('custom');
  });
});

describe('AbortError', () => {
  it('should create with default message', () => {
    const err = new AbortError();
    expect(err.message).toBe('Operation aborted');
    expect(err.code).toBe('ERR_ABORTED');
    expect(err.name).toBe('AbortError');
  });

  it('should create with custom message', () => {
    const err = new AbortError('custom');
    expect(err.message).toBe('custom');
  });
});

describe('RateLimitError', () => {
  it('should create with default message', () => {
    const err = new RateLimitError();
    expect(err.message).toBe('Rate limit exceeded');
    expect(err.code).toBe('ERR_RATE_LIMIT');
    expect(err.name).toBe('RateLimitError');
  });

  it('should create with custom message', () => {
    const err = new RateLimitError('too many');
    expect(err.message).toBe('too many');
  });
});

describe('sleep', () => {
  it('should resolve after specified ms', async () => {
    const start = Date.now();
    await sleep(50);
    expect(Date.now() - start).toBeGreaterThanOrEqual(40);
  });

  it('should reject when signal is already aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(sleep(100, ac.signal)).rejects.toThrow(AbortError);
  });

  it('should reject when signal is aborted during sleep', async () => {
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 20);
    await expect(sleep(500, ac.signal)).rejects.toThrow(AbortError);
  });

  it('should clean up abort listener when timer fires', async () => {
    const ac = new AbortController();
    await sleep(10, ac.signal);
    // No error — listener was cleaned up
    ac.abort();
  });
});

describe('calculateDelay', () => {
  it('should return fixed delay', () => {
    expect(calculateDelay(1, 100, 'fixed')).toBe(100);
    expect(calculateDelay(5, 100, 'fixed')).toBe(100);
  });

  it('should return linear delay', () => {
    expect(calculateDelay(1, 100, 'linear')).toBe(100);
    expect(calculateDelay(3, 100, 'linear')).toBe(300);
  });

  it('should return exponential delay', () => {
    expect(calculateDelay(1, 100, 'exponential')).toBe(100);
    expect(calculateDelay(2, 100, 'exponential')).toBe(200);
    expect(calculateDelay(3, 100, 'exponential')).toBe(400);
  });

  it('should accept custom function', () => {
    const custom = (attempt: number, base: number) => base * attempt * 3;
    expect(calculateDelay(2, 100, custom)).toBe(600);
  });

  it('should apply jitter with boolean true', () => {
    // With jitter, result should be within range of 50% to 150% of base
    const results = new Set<number>();
    for (let i = 0; i < 20; i++) {
      results.add(calculateDelay(1, 1000, 'fixed', true));
    }
    // Should have some variation
    for (const r of results) {
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1500);
    }
  });

  it('should apply jitter with numeric factor', () => {
    const result = calculateDelay(1, 1000, 'fixed', 0.5);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1500);
  });

  it('should never return negative delay', () => {
    for (let i = 0; i < 50; i++) {
      const result = calculateDelay(1, 1, 'fixed', true);
      expect(result).toBeGreaterThanOrEqual(0);
    }
  });
});

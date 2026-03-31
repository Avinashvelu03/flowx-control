import { createCircuitBreaker, CircuitBreaker } from '../src/circuit-breaker';
import { CircuitBreakerError } from '../src/types';

describe('createCircuitBreaker', () => {
  // Track breakers to reset timers and avoid test leaks
  const breakers: CircuitBreaker<any, any>[] = [];

  function createTestBreaker<TArgs extends any[], TReturn>(
    fn: (...args: TArgs) => Promise<TReturn>,
    options?: any,
  ): CircuitBreaker<TArgs, TReturn> {
    const cb = createCircuitBreaker(fn, options);
    breakers.push(cb);
    return cb;
  }

  afterEach(() => {
    for (const b of breakers) b.reset();
    breakers.length = 0;
  });
  it('should pass through on success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const cb = createTestBreaker(fn);
    expect(await cb.fire()).toBe('ok');
    expect(cb.state).toBe('closed');
    expect(cb.failureCount).toBe(0);
  });

  it('should pass through errors while below threshold', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fail'));
    const cb = createTestBreaker(fn, { failureThreshold: 3 });

    await expect(cb.fire()).rejects.toThrow('fail');
    expect(cb.state).toBe('closed');
    expect(cb.failureCount).toBe(1);
  });

  it('should open after reaching failure threshold', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fail'));
    const cb = createTestBreaker(fn, { failureThreshold: 2, resetTimeout: 10000 });

    await expect(cb.fire()).rejects.toThrow('fail');
    await expect(cb.fire()).rejects.toThrow('fail');
    expect(cb.state).toBe('open');

    await expect(cb.fire()).rejects.toThrow(CircuitBreakerError);
  });

  it('should transition to half-open after resetTimeout', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fail'));
    const onStateChange = jest.fn();

    const cb = createTestBreaker(fn, {
      failureThreshold: 1,
      resetTimeout: 50,
      onStateChange,
    });

    await expect(cb.fire()).rejects.toThrow('fail');
    expect(cb.state).toBe('open');

    await new Promise((r) => setTimeout(r, 80));
    expect(cb.state).toBe('half-open');
    expect(onStateChange).toHaveBeenCalledWith('open', 'half-open');
  });

  it('should close from half-open after success', async () => {
    let callCount = 0;
    const fn = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount <= 1) return Promise.reject(new Error('fail'));
      return Promise.resolve('ok');
    });

    const cb = createTestBreaker(fn, {
      failureThreshold: 1,
      resetTimeout: 50,
      successThreshold: 1,
    });

    await expect(cb.fire()).rejects.toThrow('fail');
    expect(cb.state).toBe('open');

    await new Promise((r) => setTimeout(r, 80));
    expect(cb.state).toBe('half-open');

    const result = await cb.fire();
    expect(result).toBe('ok');
    expect(cb.state).toBe('closed');
  });

  it('should re-open from half-open on failure', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fail'));
    const onStateChange = jest.fn();

    const cb = createTestBreaker(fn, {
      failureThreshold: 1,
      resetTimeout: 50,
      onStateChange,
    });

    await expect(cb.fire()).rejects.toThrow('fail');
    await new Promise((r) => setTimeout(r, 80));

    await expect(cb.fire()).rejects.toThrow('fail');
    expect(cb.state).toBe('open');
  });

  it('should limit calls in half-open state', async () => {
    const fn = jest
      .fn()
      .mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve('ok'), 100)));

    const cb = createTestBreaker(fn, {
      failureThreshold: 1,
      resetTimeout: 50,
      halfOpenLimit: 1,
    });

    // Open the circuit
    fn.mockRejectedValueOnce(new Error('fail'));
    await expect(cb.fire()).rejects.toThrow('fail');

    await new Promise((r) => setTimeout(r, 80));
    expect(cb.state).toBe('half-open');

    // First half-open call should work
    fn.mockResolvedValue('ok');
    const p1 = cb.fire();

    // Second should be rejected
    await expect(cb.fire()).rejects.toThrow(CircuitBreakerError);

    await p1;
  });

  it('should respect shouldTrip predicate', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fail'));
    const cb = createTestBreaker(fn, {
      failureThreshold: 1,
      shouldTrip: () => false,
    });

    await expect(cb.fire()).rejects.toThrow('fail');
    expect(cb.state).toBe('closed'); // shouldTrip returned false
    expect(cb.failureCount).toBe(0);
  });

  it('should respect shouldTrip in half-open state', async () => {
    let callCount = 0;
    const fn = jest.fn().mockImplementation(() => {
      callCount++;
      return Promise.reject(new Error(callCount <= 1 ? 'trip' : 'no-trip'));
    });

    const cb = createTestBreaker(fn, {
      failureThreshold: 1,
      resetTimeout: 50,
      shouldTrip: (e: Error) => e.message === 'trip',
    });

    await expect(cb.fire()).rejects.toThrow('trip');
    expect(cb.state).toBe('open');

    await new Promise((r) => setTimeout(r, 80));
    expect(cb.state).toBe('half-open');

    // This error should NOT trip the breaker (shouldTrip returns false)
    await expect(cb.fire()).rejects.toThrow('no-trip');
    expect(cb.state).toBe('half-open'); // stayed half-open, decremented active
  });

  it('should reset failure count on success in closed state', async () => {
    let callCount = 0;
    const fn = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.reject(new Error('fail'));
      return Promise.resolve('ok');
    });

    const cb = createTestBreaker(fn, { failureThreshold: 3 });

    await expect(cb.fire()).rejects.toThrow('fail');
    expect(cb.failureCount).toBe(1);

    await cb.fire();
    expect(cb.failureCount).toBe(0);
  });

  it('should manually reset', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fail'));
    const cb = createTestBreaker(fn, { failureThreshold: 1, resetTimeout: 60000 });

    await expect(cb.fire()).rejects.toThrow('fail');
    expect(cb.state).toBe('open');

    cb.reset();
    expect(cb.state).toBe('closed');
    expect(cb.failureCount).toBe(0);
  });

  it('should manually open', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const cb = createTestBreaker(fn, { resetTimeout: 50 });

    cb.open();
    expect(cb.state).toBe('open');
    await expect(cb.fire()).rejects.toThrow(CircuitBreakerError);

    // Wait for auto-reset
    await new Promise((r) => setTimeout(r, 80));
    expect(cb.state).toBe('half-open');
  });

  it('should handle non-Error thrown values', async () => {
    const fn = jest.fn().mockRejectedValue('string error');
    const cb = createTestBreaker(fn, { failureThreshold: 1 });
    await expect(cb.fire()).rejects.toThrow('string error');
    expect(cb.state).toBe('open');
  });

  it('should use default options', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const cb = createTestBreaker(fn);
    expect(cb.state).toBe('closed');
    expect(cb.failureCount).toBe(0);
    expect(cb.successCount).toBe(0);
  });

  it('should track successCount in half-open', async () => {
    let callCount = 0;
    const fn = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount <= 1) return Promise.reject(new Error('fail'));
      return Promise.resolve('ok');
    });

    const cb = createTestBreaker(fn, {
      failureThreshold: 1,
      resetTimeout: 50,
      successThreshold: 2,
    });

    await expect(cb.fire()).rejects.toThrow('fail');
    await new Promise((r) => setTimeout(r, 80));

    await cb.fire();
    expect(cb.successCount).toBe(1);
    expect(cb.state).toBe('half-open');

    await cb.fire();
    expect(cb.state).toBe('closed');
    expect(cb.state).toBe('closed');
  });

  it('should manually open while already open', () => {
    const cb = createTestBreaker(jest.fn());
    cb.open();
    cb.open();
    expect(cb.state).toBe('open');
  });
});

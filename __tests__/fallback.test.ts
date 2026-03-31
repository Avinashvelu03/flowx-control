import { withFallback, fallbackChain } from '../src/fallback';

describe('withFallback', () => {
  it('should return primary result on success', async () => {
    const result = await withFallback(() => Promise.resolve('primary'), 'default');
    expect(result).toBe('primary');
  });

  it('should return fallback value on failure', async () => {
    const result = await withFallback(() => {
      throw new Error('fail');
    }, 'fallback-value');
    expect(result).toBe('fallback-value');
  });

  it('should call fallback function on failure', async () => {
    const result = await withFallback(
      () => Promise.reject(new Error('fail')),
      () => 'computed-fallback',
    );
    expect(result).toBe('computed-fallback');
  });

  it('should call async fallback function on failure', async () => {
    const result = await withFallback(
      () => Promise.reject(new Error('fail')),
      async () => 'async-fallback',
    );
    expect(result).toBe('async-fallback');
  });

  it('should respect shouldFallback predicate', async () => {
    await expect(
      withFallback(() => Promise.reject(new Error('no-fallback')), 'default', {
        shouldFallback: () => false,
      }),
    ).rejects.toThrow('no-fallback');
  });

  it('should call onFallback callback', async () => {
    const onFallback = jest.fn();
    await withFallback(() => Promise.reject(new Error('fail')), 'default', { onFallback });
    expect(onFallback).toHaveBeenCalledWith(expect.any(Error), 0);
  });

  it('should handle non-Error thrown values', async () => {
    const result = await withFallback(() => {
      throw 'string error';
    }, 'default');
    expect(result).toBe('default');
  });

  it('should handle sync return values', async () => {
    const result = await withFallback(() => 'sync-value', 'default');
    expect(result).toBe('sync-value');
  });
});

describe('fallbackChain', () => {
  it('should return first successful result', async () => {
    const result = await fallbackChain([
      () => Promise.resolve('first'),
      () => Promise.resolve('second'),
    ]);
    expect(result).toBe('first');
  });

  it('should try next on failure', async () => {
    const result = await fallbackChain([
      () => Promise.reject(new Error('fail1')),
      () => Promise.resolve('second'),
    ]);
    expect(result).toBe('second');
  });

  it('should throw last error if all fail', async () => {
    await expect(
      fallbackChain([
        () => Promise.reject(new Error('fail1')),
        () => Promise.reject(new Error('fail2')),
      ]),
    ).rejects.toThrow('fail2'); // throws last error
  });

  it('should throw Error for empty chain', async () => {
    await expect(fallbackChain([])).rejects.toThrow('fallbackChain requires at least one function');
  });

  it('should call onFallback for each fallback', async () => {
    const onFallback = jest.fn();
    await fallbackChain(
      [
        () => Promise.reject(new Error('fail1')),
        () => Promise.reject(new Error('fail2')),
        () => Promise.resolve('third'),
      ],
      { onFallback },
    );
    expect(onFallback).toHaveBeenCalledTimes(2);
    expect(onFallback).toHaveBeenCalledWith(expect.any(Error), 1);
    expect(onFallback).toHaveBeenCalledWith(expect.any(Error), 2);
  });

  it('should respect shouldFallback', async () => {
    await expect(
      fallbackChain(
        [() => Promise.reject(new Error('critical')), () => Promise.resolve('fallback')],
        { shouldFallback: () => false },
      ),
    ).rejects.toThrow('critical');
  });

  it('should handle non-Error thrown values', async () => {
    const result = await fallbackChain([
      () => {
        throw 'string error';
      },
      () => Promise.resolve('ok'),
    ]);
    expect(result).toBe('ok');
  });

  it('should handle sync return values', async () => {
    const result = await fallbackChain([() => 'sync-value']);
    expect(result).toBe('sync-value');
  });
});

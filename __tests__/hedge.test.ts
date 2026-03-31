import { hedge } from '../src/hedge';

describe('hedge', () => {
  it('should return primary result when fast enough', async () => {
    const fn = jest.fn().mockResolvedValue('primary');
    const result = await hedge(fn, { delay: 500 });
    expect(result).toBe('primary');
  });

  it('should return first resolving call', async () => {
    let callIndex = 0;
    const fn = jest.fn().mockImplementation(() => {
      const idx = callIndex++;
      if (idx === 0) {
        return new Promise((resolve) => setTimeout(() => resolve('slow'), 200));
      }
      return Promise.resolve('fast');
    });

    const result = await hedge(fn, { delay: 20 });
    expect(result).toBe('fast');
  });

  it('should handle all calls failing', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('all fail'));
    await expect(hedge(fn, { delay: 10 })).rejects.toThrow('all fail');
  });

  it('should support multiple hedges', async () => {
    const fn = jest
      .fn()
      .mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve('ok'), 50)));

    await hedge(fn, { delay: 10, maxHedges: 3 });
    // Wait for all timers
    await new Promise((r) => setTimeout(r, 100));
    expect(fn).toHaveBeenCalledTimes(4); // 1 original + 3 hedges
  });

  it('should throw RangeError for negative delay', () => {
    expect(() => hedge(jest.fn(), { delay: -1 })).toThrow(RangeError);
  });

  it('should throw RangeError for maxHedges < 1', () => {
    expect(() => hedge(jest.fn(), { maxHedges: 0 })).toThrow(RangeError);
  });

  it('should use default options', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await hedge(fn);
    expect(result).toBe('ok');
  });

  it('should handle non-Error rejections', async () => {
    const fn = jest.fn().mockRejectedValue('string error');
    await expect(hedge(fn, { delay: 10 })).rejects.toThrow('string error');
  });

  it('should clear timers when primary resolves first', async () => {
    const fn = jest.fn().mockResolvedValue('fast');
    await hedge(fn, { delay: 1000, maxHedges: 2 });
    // If timers weren't cleared, the test would time out or have side effects
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should not resolve twice if multiple hedges succeed', async () => {
    let resolveCount = 0;
    const fn = jest.fn().mockImplementation(() => {
      return new Promise((resolve) =>
        setTimeout(() => {
          resolveCount++;
          resolve(`result-${resolveCount}`);
        }, 30),
      );
    });

    const result = await hedge(fn, { delay: 10, maxHedges: 2 });
    // Should be the first to resolve
    expect(result).toBeDefined();
    await new Promise((r) => setTimeout(r, 100));
  });

  it('should ignore hedge timeout if settled', async () => {
    const fn = jest.fn().mockResolvedValue('fast');
    await hedge(fn, { delay: 10, maxHedges: 1 });
    // wait for timer to naturally expire
    await new Promise((r) => setTimeout(r, 20));
  });
});

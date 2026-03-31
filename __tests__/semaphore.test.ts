import { createSemaphore } from '../src/semaphore';

describe('createSemaphore', () => {
  it('should acquire and release permits', async () => {
    const sem = createSemaphore(2);
    expect(sem.available).toBe(2);

    const release1 = await sem.acquire();
    expect(sem.available).toBe(1);

    const release2 = await sem.acquire();
    expect(sem.available).toBe(0);

    release1();
    expect(sem.available).toBe(1);

    release2();
    expect(sem.available).toBe(2);
  });

  it('should queue when no permits available', async () => {
    const sem = createSemaphore(1);
    const order: number[] = [];

    const release1 = await sem.acquire();
    expect(sem.waiting).toBe(0);

    const p2 = sem.acquire().then((release) => {
      order.push(2);
      return release;
    });
    expect(sem.waiting).toBe(1);

    order.push(1);
    release1();

    const release2 = await p2;
    expect(order).toEqual([1, 2]);
    release2();
  });

  it('should run exclusive function', async () => {
    const sem = createSemaphore(1);
    const result = await sem.runExclusive(async () => {
      expect(sem.available).toBe(0);
      return 'exclusive-result';
    });
    expect(result).toBe('exclusive-result');
    expect(sem.available).toBe(1);
  });

  it('should release on error in runExclusive', async () => {
    const sem = createSemaphore(1);
    await expect(
      sem.runExclusive(() => {
        throw new Error('oops');
      }),
    ).rejects.toThrow('oops');
    expect(sem.available).toBe(1);
  });

  it('should throw RangeError for invalid permits', () => {
    expect(() => createSemaphore(0)).toThrow(RangeError);
    expect(() => createSemaphore(-1)).toThrow(RangeError);
  });

  it('should handle concurrent operations correctly', async () => {
    const sem = createSemaphore(2);
    const running: number[] = [];
    let maxConcurrent = 0;

    const tasks = Array.from({ length: 5 }, (_, i) =>
      sem.runExclusive(async () => {
        running.push(i);
        maxConcurrent = Math.max(maxConcurrent, running.length);
        await new Promise((r) => setTimeout(r, 20));
        running.splice(running.indexOf(i), 1);
        return i;
      }),
    );

    const results = await Promise.all(tasks);
    expect(results).toEqual([0, 1, 2, 3, 4]);
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it('should support sync functions in runExclusive', async () => {
    const sem = createSemaphore(1);
    const result = await sem.runExclusive(() => 42);
    expect(result).toBe(42);
  });
});

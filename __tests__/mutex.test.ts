import { createMutex } from '../src/mutex';

describe('createMutex', () => {
  it('should lock and unlock', async () => {
    const mutex = createMutex();
    expect(mutex.isLocked).toBe(false);

    const release = await mutex.lock();
    expect(mutex.isLocked).toBe(true);

    release();
    expect(mutex.isLocked).toBe(false);
  });

  it('should serialize access', async () => {
    const mutex = createMutex();
    const order: number[] = [];

    const release1 = await mutex.lock();
    expect(mutex.waiting).toBe(0);

    const p2 = mutex.lock().then((release) => {
      order.push(2);
      return release;
    });
    expect(mutex.waiting).toBe(1);

    order.push(1);
    release1();

    const release2 = await p2;
    expect(order).toEqual([1, 2]);
    expect(mutex.isLocked).toBe(true);
    release2();
    expect(mutex.isLocked).toBe(false);
  });

  it('should run exclusive function', async () => {
    const mutex = createMutex();
    const result = await mutex.runExclusive(async () => {
      expect(mutex.isLocked).toBe(true);
      return 'result';
    });
    expect(result).toBe('result');
    expect(mutex.isLocked).toBe(false);
  });

  it('should release on error in runExclusive', async () => {
    const mutex = createMutex();
    await expect(
      mutex.runExclusive(() => {
        throw new Error('fail');
      }),
    ).rejects.toThrow('fail');
    expect(mutex.isLocked).toBe(false);
  });

  it('should serialize multiple runExclusive calls', async () => {
    const mutex = createMutex();
    const order: number[] = [];

    const tasks = [1, 2, 3].map((i) =>
      mutex.runExclusive(async () => {
        order.push(i);
        await new Promise((r) => setTimeout(r, 20));
        return i;
      }),
    );

    const results = await Promise.all(tasks);
    expect(results).toEqual([1, 2, 3]);
    expect(order).toEqual([1, 2, 3]);
  });

  it('should transfer lock to next waiter correctly', async () => {
    const mutex = createMutex();

    const release1 = await mutex.lock();
    const p2 = mutex.lock();
    const p3 = mutex.lock();

    expect(mutex.waiting).toBe(2);

    release1(); // transfers to p2

    const release2 = await p2;
    expect(mutex.isLocked).toBe(true);
    expect(mutex.waiting).toBe(1);

    release2(); // transfers to p3

    const release3 = await p3;
    expect(mutex.isLocked).toBe(true);
    expect(mutex.waiting).toBe(0);

    release3();
    expect(mutex.isLocked).toBe(false);
  });

  it('should support sync functions in runExclusive', async () => {
    const mutex = createMutex();
    const result = await mutex.runExclusive(() => 42);
    expect(result).toBe(42);
  });
});

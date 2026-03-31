import { createQueue } from '../src/queue';

describe('createQueue', () => {
  it('should process tasks sequentially by default', async () => {
    const queue = createQueue();
    const order: number[] = [];

    const p1 = queue.add(async () => {
      order.push(1);
      return 1;
    });
    const p2 = queue.add(async () => {
      order.push(2);
      return 2;
    });
    const p3 = queue.add(async () => {
      order.push(3);
      return 3;
    });

    expect(await p1).toBe(1);
    expect(await p2).toBe(2);
    expect(await p3).toBe(3);
    expect(order).toEqual([1, 2, 3]);
  });

  it('should support concurrent processing', async () => {
    const queue = createQueue({ concurrency: 3 });
    const running: number[] = [];
    let maxConcurrent = 0;

    const tasks = Array.from({ length: 6 }, (_, i) =>
      queue.add(async () => {
        running.push(i);
        maxConcurrent = Math.max(maxConcurrent, running.length);
        await new Promise((r) => setTimeout(r, 30));
        running.splice(running.indexOf(i), 1);
        return i;
      }),
    );

    await Promise.all(tasks);
    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });

  it('should support priority', async () => {
    const queue = createQueue({ concurrency: 1, autoStart: false });
    const order: number[] = [];

    queue.add(
      async () => {
        order.push(3);
      },
      { priority: 3 },
    );
    queue.add(
      async () => {
        order.push(1);
      },
      { priority: 1 },
    );
    queue.add(
      async () => {
        order.push(2);
      },
      { priority: 2 },
    );

    queue.resume();
    await queue.onIdle();

    expect(order).toEqual([1, 2, 3]);
  });

  it('should pause and resume', async () => {
    const queue = createQueue({ concurrency: 1 });
    const order: number[] = [];

    const p1 = queue.add(async () => {
      order.push(1);
      return 1;
    });
    await p1;

    queue.pause();
    expect(queue.isPaused).toBe(true);

    const p2 = queue.add(async () => {
      order.push(2);
      return 2;
    });

    queue.resume();
    expect(queue.isPaused).toBe(false);
    await p2;
    expect(order).toEqual([1, 2]);
  });

  it('should clear pending tasks', async () => {
    const queue = createQueue({ concurrency: 1, autoStart: false });

    const p1 = queue.add(async () => 1);
    const p2 = queue.add(async () => 2);

    expect(queue.size).toBe(2);

    queue.clear();
    expect(queue.size).toBe(0);

    await expect(p1).rejects.toThrow('Queue cleared');
    await expect(p2).rejects.toThrow('Queue cleared');
  });

  it('should addAll tasks', async () => {
    const queue = createQueue({ concurrency: 2 });
    const results = await queue.addAll([async () => 1, async () => 2, async () => 3]);
    expect(results).toEqual([1, 2, 3]);
  });

  it('should resolve onEmpty when queue drains', async () => {
    const queue = createQueue({ concurrency: 1 });

    queue.add(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    queue.add(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    await queue.onEmpty();
    expect(queue.size).toBe(0);
  });

  it('should resolve onIdle when all work is done', async () => {
    const queue = createQueue({ concurrency: 1 });

    queue.add(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    await queue.onIdle();
    expect(queue.size).toBe(0);
    expect(queue.pending).toBe(0);
  });

  it('should resolve onEmpty immediately if already empty', async () => {
    const queue = createQueue();
    await queue.onEmpty(); // should not hang
  });

  it('should resolve onIdle immediately if already idle', async () => {
    const queue = createQueue();
    await queue.onIdle(); // should not hang
  });

  it('should track size and pending', async () => {
    const queue = createQueue({ concurrency: 1 });

    let resolveFirst!: () => void;
    const p1 = queue.add(
      () =>
        new Promise<void>((r) => {
          resolveFirst = r;
        }),
    );
    queue.add(async () => {});

    expect(queue.pending).toBe(1);
    expect(queue.size).toBe(1);

    resolveFirst();
    await p1;
    await queue.onIdle();
  });

  it('should handle task errors without stopping the queue', async () => {
    const queue = createQueue({ concurrency: 1 });

    const p1 = queue.add(() => Promise.reject(new Error('fail')));
    const p2 = queue.add(async () => 'ok');

    await expect(p1).rejects.toThrow('fail');
    expect(await p2).toBe('ok');
  });

  it('should throw RangeError for invalid concurrency', () => {
    expect(() => createQueue({ concurrency: 0 })).toThrow(RangeError);
  });

  it('should handle task timeout', async () => {
    const queue = createQueue({ concurrency: 1, timeout: 50 });

    await expect(
      queue.add(() => new Promise((resolve) => setTimeout(resolve, 200))),
    ).rejects.toThrow('Queue task timeout');
  });

  it('should autoStart by default', async () => {
    const queue = createQueue();
    const result = await queue.add(async () => 'immediate');
    expect(result).toBe('immediate');
  });

  it('should not autoStart when configured', async () => {
    const queue = createQueue({ autoStart: false });
    expect(queue.isPaused).toBe(true);

    const results: number[] = [];
    const p = queue.add(async () => {
      results.push(1);
      return 1;
    });

    expect(results).toEqual([]);

    queue.resume();
    await p;
    expect(results).toEqual([1]);
  });

  it('should use default priority', async () => {
    const queue = createQueue({ concurrency: 1, autoStart: false });
    const order: number[] = [];

    queue.add(async () => {
      order.push(1);
    });
    queue.add(async () => {
      order.push(2);
    });

    queue.resume();
    await queue.onIdle();
    expect(order).toEqual([1, 2]);
  });

  it('should clear timeout when task starts', async () => {
    const q = createQueue({ concurrency: 1, timeout: 50 });
    await q.add(() => Promise.resolve('ok'));
  });
});

import { createDeferred } from '../src/deferred';

describe('createDeferred', () => {
  it('should resolve the deferred', async () => {
    const d = createDeferred<string>();
    expect(d.isSettled).toBe(false);
    expect(d.isResolved).toBe(false);
    expect(d.isRejected).toBe(false);

    d.resolve('hello');

    expect(await d.promise).toBe('hello');
    expect(d.isSettled).toBe(true);
    expect(d.isResolved).toBe(true);
    expect(d.isRejected).toBe(false);
  });

  it('should reject the deferred', async () => {
    const d = createDeferred<string>();

    d.reject(new Error('fail'));

    await expect(d.promise).rejects.toThrow('fail');
    expect(d.isSettled).toBe(true);
    expect(d.isResolved).toBe(false);
    expect(d.isRejected).toBe(true);
  });

  it('should ignore multiple resolves', async () => {
    const d = createDeferred<string>();

    d.resolve('first');
    d.resolve('second');

    expect(await d.promise).toBe('first');
  });

  it('should ignore resolve after reject', async () => {
    const d = createDeferred<string>();

    d.reject(new Error('fail'));
    d.resolve('ignored');

    await expect(d.promise).rejects.toThrow('fail');
    expect(d.isRejected).toBe(true);
    expect(d.isResolved).toBe(false);
  });

  it('should ignore reject after resolve', async () => {
    const d = createDeferred<string>();

    d.resolve('ok');
    d.reject(new Error('ignored'));

    expect(await d.promise).toBe('ok');
    expect(d.isResolved).toBe(true);
    expect(d.isRejected).toBe(false);
  });

  it('should ignore multiple rejects', async () => {
    const d = createDeferred<string>();

    d.reject(new Error('first'));
    d.reject(new Error('second'));

    await expect(d.promise).rejects.toThrow('first');
  });

  it('should work with void type', async () => {
    const d = createDeferred();
    d.resolve();
    await d.promise;
    expect(d.isSettled).toBe(true);
  });

  it('should resolve with PromiseLike value', async () => {
    const d = createDeferred<string>();
    d.resolve(Promise.resolve('async-value'));
    expect(await d.promise).toBe('async-value');
  });
});

import { throttle } from '../src/throttle';

describe('throttle', () => {
  it('should call immediately on first invocation (leading)', async () => {
    const fn = jest.fn().mockReturnValue('ok');
    const throttled = throttle(fn, 100);

    const result = await throttled('a');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(result).toBe('ok');
  });

  it('should throttle subsequent calls', async () => {
    const fn = jest.fn().mockReturnValue('ok');
    const throttled = throttle(fn, 50);

    await throttled('a');
    const p2 = throttled('b');
    const p3 = throttled('c');

    await new Promise((r) => setTimeout(r, 80));
    await p2;
    await p3;

    expect(fn).toHaveBeenCalledTimes(2); // leading + trailing
  });

  it('should support leading: false', async () => {
    const fn = jest.fn().mockReturnValue('ok');
    const throttled = throttle(fn, 50, { leading: false });

    const p = throttled('a');
    await new Promise((r) => setTimeout(r, 80));
    await p;

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should support trailing: false', async () => {
    const fn = jest.fn().mockReturnValue('ok');
    const throttled = throttle(fn, 50, { trailing: false });

    await throttled('a');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should cancel pending trailing call', async () => {
    const fn = jest.fn().mockReturnValue('ok');
    const throttled = throttle(fn, 100);

    await throttled('a');
    const p2 = throttled('b');

    throttled.cancel();

    await expect(p2).rejects.toThrow('Throttled call cancelled');
  });

  it('should track pending state', async () => {
    const fn = jest.fn().mockReturnValue('ok');
    const throttled = throttle(fn, 100);

    expect(throttled.pending).toBe(false);

    throttled.cancel(); // clean state
  });

  it('should throw RangeError for negative wait', () => {
    expect(() => throttle(jest.fn(), -1)).toThrow(RangeError);
  });

  it('should handle errors from the function', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fn error'));
    const throttled = throttle(fn, 50);

    await expect(throttled('a')).rejects.toThrow('fn error');
  });

  it('should handle async function', async () => {
    const fn = jest.fn().mockImplementation(async (x: string) => `result-${x}`);
    const throttled = throttle(fn, 50);

    const result = await throttled('a');
    expect(result).toBe('result-a');
  });

  it('should allow call after wait period', async () => {
    const fn = jest.fn().mockReturnValue('ok');
    const throttled = throttle(fn, 50, { trailing: false });

    await throttled('a');
    expect(fn).toHaveBeenCalledTimes(1);

    await new Promise((r) => setTimeout(r, 70));

    await throttled('b');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should propagate errors from trailing edge', async () => {
    let calls = 0;
    const fn = jest.fn().mockImplementation(() => {
      calls++;
      if (calls === 2) throw new Error('trailing err 2');
      return 'ok';
    });
    const throttled = throttle(fn, 50, { leading: true, trailing: true });
    const p1 = throttled('a');
    await p1; // wait so leading finishes

    const p2 = throttled('b');
    await expect(p2).rejects.toThrow('trailing err 2');
  });

  it('should clear existing timer on leading call if trailing was delayed', async () => {
    jest.useFakeTimers();
    const fn = jest.fn().mockResolvedValue('ok');
    const throttled = throttle(fn, 50, { leading: true, trailing: true });
    
    throttled('a').catch(()=>{}); // leading
    throttled('b').catch(()=>{}); // queues trailing timer for wait=50
    
    jest.setSystemTime(jest.now() + 60);
    // Call again before timer expires in event loop
    throttled('c').catch(()=>{}); 
    
    jest.useRealTimers();
  });
});

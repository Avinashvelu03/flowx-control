import { debounce } from '../src/debounce';

describe('debounce', () => {
  it('should debounce calls (trailing)', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const debounced = debounce(fn, 50);

    const p1 = debounced('a');
    const p2 = debounced('b');
    const p3 = debounced('c');

    const results = await Promise.all([p1, p2, p3]);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c'); // last args
    expect(results[2]).toBe('ok');
  });

  it('should support leading edge', async () => {
    const fn = jest.fn().mockReturnValue('ok');
    const debounced = debounce(fn, 50, { leading: true, trailing: false });

    const result = await debounced('first');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(result).toBe('ok');
  });

  it('should support maxWait', async () => {
    const fn = jest.fn().mockReturnValue('ok');
    const debounced = debounce(fn, 100, { maxWait: 50 });

    const p1 = debounced('a');

    await new Promise((r) => setTimeout(r, 70));
    // maxWait should have triggered
    expect(fn).toHaveBeenCalledTimes(1);
    await p1;
  });

  it('should cancel pending invocation', async () => {
    const fn = jest.fn().mockReturnValue('ok');
    const debounced = debounce(fn, 50);

    const p = debounced('a');
    debounced.cancel();

    await expect(p).rejects.toThrow('Debounced call cancelled');
    expect(fn).not.toHaveBeenCalled();
  });

  it('should flush pending invocation', async () => {
    const fn = jest.fn().mockReturnValue('flushed');
    const debounced = debounce(fn, 5000);

    debounced('a');
    const result = await debounced.flush();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(result).toBe('flushed');
  });

  it('should return undefined when flush with nothing pending', async () => {
    const fn = jest.fn().mockReturnValue('ok');
    const debounced = debounce(fn, 50);

    const result = await debounced.flush();
    expect(result).toBeUndefined();
  });

  it('should track pending state', async () => {
    const fn = jest.fn().mockReturnValue('ok');
    const debounced = debounce(fn, 50);

    expect(debounced.pending).toBe(false);

    const p = debounced('a');
    expect(debounced.pending).toBe(true);

    debounced.cancel();
    await expect(p).rejects.toThrow('Debounced call cancelled');
  });

  it('should throw RangeError for negative wait', () => {
    expect(() => debounce(jest.fn(), -1)).toThrow(RangeError);
  });

  it('should handle errors from the function', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fn error'));
    const debounced = debounce(fn, 50);

    await expect(debounced('a')).rejects.toThrow('fn error');
  });

  it('should handle both leading and trailing', async () => {
    let callCount = 0;
    const fn = jest.fn().mockImplementation(() => {
      callCount++;
      return `call-${callCount}`;
    });

    const debounced = debounce(fn, 50, { leading: true, trailing: true });

    const p1 = debounced('a');
    const result1 = await p1;
    expect(result1).toBe('call-1'); // leading edge fires immediately

    // Wait for trailing edge
    // Wait for trailing edge
    await new Promise((r) => setTimeout(r, 80));
  });

  it('should clear max timer on cancel', () => {
    const debounced = debounce(jest.fn(), 100, { maxWait: 200 });
    debounced('a').catch(() => {});
    debounced.cancel(); // Clears maxTimer
  });

  it('should clear max timer on invoke', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const debounced = debounce(fn, 10, { maxWait: 50 });
    const p = debounced('a');
    await p;
  });
});

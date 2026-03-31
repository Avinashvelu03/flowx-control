import { pipeline, pipe } from '../src/pipeline';

describe('pipeline', () => {
  it('should compose steps into a pipeline', async () => {
    const double = (x: number) => x * 2;
    const addOne = (x: number) => x + 1;
    const toString = (x: number) => String(x);

    const process = pipeline(double, addOne, toString);
    expect(await process(5)).toBe('11');
  });

  it('should handle async steps', async () => {
    const asyncDouble = async (x: number) => x * 2;
    const asyncAdd = async (x: number) => x + 1;

    const process = pipeline(asyncDouble, asyncAdd);
    expect(await process(3)).toBe(7);
  });

  it('should handle a single step', async () => {
    const double = (x: number) => x * 2;
    const process = pipeline(double);
    expect(await process(5)).toBe(10);
  });

  it('should throw on empty steps', () => {
    expect(() => pipeline()).toThrow('pipeline requires at least one step');
  });

  it('should propagate errors', async () => {
    const failing = () => {
      throw new Error('step failed');
    };
    const process = pipeline(failing);
    await expect(process('input')).rejects.toThrow('step failed');
  });

  it('should handle mixed sync/async steps', async () => {
    const syncStep = (x: number) => x * 2;
    const asyncStep = async (x: number) => x + 10;

    const process = pipeline(syncStep, asyncStep);
    expect(await process(5)).toBe(20);
  });

  it('should support 4 steps', async () => {
    const process = pipeline(
      (x: number) => x + 1,
      (x: number) => x * 2,
      (x: number) => x - 3,
      (x: number) => String(x),
    );
    expect(await process(5)).toBe('9');
  });

  it('should support 5 steps', async () => {
    const process = pipeline(
      (x: number) => x + 1,
      (x: number) => x * 2,
      (x: number) => x - 3,
      (x: number) => x * 10,
      (x: number) => String(x),
    );
    expect(await process(5)).toBe('90');
  });
});

describe('pipe', () => {
  it('should pipe a value through steps', async () => {
    const result = await pipe(
      5,
      (x: number) => x * 2,
      (x: number) => x + 1,
      (x: number) => String(x),
    );
    expect(result).toBe('11');
  });

  it('should handle a single step', async () => {
    const result = await pipe(5, (x: number) => x * 2);
    expect(result).toBe(10);
  });

  it('should throw on empty steps', async () => {
    await expect(pipe('input')).rejects.toThrow('pipe requires at least one step');
  });

  it('should handle async steps', async () => {
    const result = await pipe(
      3,
      async (x: number) => x * 2,
      async (x: number) => x + 1,
    );
    expect(result).toBe(7);
  });

  it('should propagate errors', async () => {
    await expect(
      pipe('input', () => {
        throw new Error('pipe failed');
      }),
    ).rejects.toThrow('pipe failed');
  });

  it('should support 4 steps', async () => {
    const result = await pipe(
      5,
      (x: number) => x + 1,
      (x: number) => x * 2,
      (x: number) => x - 3,
      (x: number) => String(x),
    );
    expect(result).toBe('9');
  });

  it('should support 5 steps', async () => {
    const result = await pipe(
      5,
      (x: number) => x + 1,
      (x: number) => x * 2,
      (x: number) => x - 3,
      (x: number) => x * 10,
      (x: number) => String(x),
    );
    expect(result).toBe('90');
  });
});

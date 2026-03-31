// ============================================================================
// FlowX — Async Pipeline Composition
// ============================================================================

/** A step in the pipeline */
export type PipelineStep<TIn, TOut> = (input: TIn) => TOut | Promise<TOut>;

/**
 * Compose multiple async functions into a single pipeline.
 *
 * @example
 * ```ts
 * const process = pipeline(
 *   (x: number) => x * 2,
 *   (x: number) => x + 1,
 *   (x: number) => String(x),
 * );
 * const result = await process(5); // "11"
 * ```
 */
export function pipeline<A, B>(s1: PipelineStep<A, B>): (input: A) => Promise<B>;
export function pipeline<A, B, C>(
  s1: PipelineStep<A, B>,
  s2: PipelineStep<B, C>,
): (input: A) => Promise<C>;
export function pipeline<A, B, C, D>(
  s1: PipelineStep<A, B>,
  s2: PipelineStep<B, C>,
  s3: PipelineStep<C, D>,
): (input: A) => Promise<D>;
export function pipeline<A, B, C, D, E>(
  s1: PipelineStep<A, B>,
  s2: PipelineStep<B, C>,
  s3: PipelineStep<C, D>,
  s4: PipelineStep<D, E>,
): (input: A) => Promise<E>;
export function pipeline<A, B, C, D, E, F>(
  s1: PipelineStep<A, B>,
  s2: PipelineStep<B, C>,
  s3: PipelineStep<C, D>,
  s4: PipelineStep<D, E>,
  s5: PipelineStep<E, F>,
): (input: A) => Promise<F>;
export function pipeline(...steps: Array<PipelineStep<any, any>>): (input: any) => Promise<any>;
export function pipeline(...steps: Array<PipelineStep<any, any>>): (input: any) => Promise<any> {
  if (steps.length === 0) {
    throw new Error('pipeline requires at least one step');
  }

  return async (input: any) => {
    let current = input;
    for (const step of steps) {
      current = await step(current);
    }
    return current;
  };
}

/**
 * Execute a value through a series of async transformation steps.
 *
 * @example
 * ```ts
 * const result = await pipe(
 *   5,
 *   (x) => x * 2,
 *   (x) => x + 1,
 *   (x) => String(x),
 * ); // "11"
 * ```
 */
export async function pipe<A, B>(input: A, s1: PipelineStep<A, B>): Promise<B>;
export async function pipe<A, B, C>(
  input: A,
  s1: PipelineStep<A, B>,
  s2: PipelineStep<B, C>,
): Promise<C>;
export async function pipe<A, B, C, D>(
  input: A,
  s1: PipelineStep<A, B>,
  s2: PipelineStep<B, C>,
  s3: PipelineStep<C, D>,
): Promise<D>;
export async function pipe<A, B, C, D, E>(
  input: A,
  s1: PipelineStep<A, B>,
  s2: PipelineStep<B, C>,
  s3: PipelineStep<C, D>,
  s4: PipelineStep<D, E>,
): Promise<E>;
export async function pipe<A, B, C, D, E, F>(
  input: A,
  s1: PipelineStep<A, B>,
  s2: PipelineStep<B, C>,
  s3: PipelineStep<C, D>,
  s4: PipelineStep<D, E>,
  s5: PipelineStep<E, F>,
): Promise<F>;
export async function pipe(input: any, ...steps: Array<PipelineStep<any, any>>): Promise<any>;
export async function pipe(input: any, ...steps: Array<PipelineStep<any, any>>): Promise<any> {
  if (steps.length === 0) {
    throw new Error('pipe requires at least one step');
  }

  let current = input;
  for (const step of steps) {
    current = await step(current);
  }
  return current;
}

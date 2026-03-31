<p align="center">
  <img src="https://img.shields.io/npm/v/flowx-control?style=flat-square&color=blue" alt="npm version" />
  <img src="https://img.shields.io/badge/coverage-100%25-brightgreen?style=flat-square" alt="coverage" />
  <img src="https://img.shields.io/npm/l/flowx-control?style=flat-square" alt="license" />
  <img src="https://img.shields.io/badge/dependencies-0-brightgreen?style=flat-square" alt="zero deps" />
  <img src="https://img.shields.io/badge/TypeScript-first-blue?style=flat-square&logo=typescript&logoColor=white" alt="typescript" />
  <img src="https://img.shields.io/npm/dm/flowx-control?style=flat-square" alt="downloads" />
</p>

# FlowX

**Production-grade resilience & async flow control for TypeScript/JavaScript.**

> Stop shipping fragile async code. FlowX gives you battle-tested patterns — retry, circuit breaker, rate limiter, bulkhead, queue, and 12 more — in a single, zero-dependency, tree-shakable package with **100% test coverage**.

---

## Why FlowX?

| | FlowX | Others |
|--|-------|--------|
| **Dependencies** | 0 | 3–15+ |
| **Test Coverage** | 100% statements, branches, functions, lines | Partial |
| **TypeScript** | Native `.d.ts` + `.d.mts` | Bolted-on types |
| **Tree-shaking** | Per-module deep imports | Monolithic bundle |
| **Module Support** | ESM + CJS + Types | Usually one |
| **Patterns** | 17 resilience & flow primitives | 2–5 |

---

## Install

```bash
npm install flowx-control
```

```bash
yarn add flowx-control
```

```bash
pnpm add flowx-control
```

---

## Quick Start

```ts
import { retry, createCircuitBreaker, withTimeout, rateLimit } from 'flowx-control';

// Retry with exponential backoff
const data = await retry(() => fetch('/api/data'), {
  maxAttempts: 5,
  delay: 1000,
  backoff: 'exponential',
});

// Circuit breaker — stop cascading failures
const breaker = createCircuitBreaker(fetchUser, {
  failureThreshold: 5,
  resetTimeout: 30_000,
});
const user = await breaker.fire(userId);

// Timeout — never wait forever
const result = await withTimeout(() => fetch('/slow'), 5000, {
  fallback: () => cachedResponse,
});

// Rate limiter — respect API limits
const limiter = createRateLimiter({ limit: 10, interval: 1000 });
await limiter.execute(() => callExternalApi());
```

---

## All 17 Modules

### 🛡️ Resilience

<details>
<summary><strong>retry</strong> — Retry with backoff & jitter</summary>

```ts
import { retry } from 'flowx-control/retry';

const data = await retry(() => fetch('/api'), {
  maxAttempts: 5,
  delay: 1000,
  backoff: 'exponential',   // 'fixed' | 'linear' | 'exponential' | custom fn
  jitter: true,
  retryIf: (err) => err.status !== 404,
  onRetry: (err, attempt) => console.log(`Attempt ${attempt}`),
  signal: abortController.signal,
});
```
</details>

<details>
<summary><strong>circuitBreaker</strong> — Stop cascading failures</summary>

```ts
import { createCircuitBreaker } from 'flowx-control/circuit-breaker';

const breaker = createCircuitBreaker(callApi, {
  failureThreshold: 5,
  resetTimeout: 30000,
  halfOpenLimit: 1,
  successThreshold: 2,
  shouldTrip: (err) => err.status >= 500,
  onStateChange: (from, to) => log(`${from} → ${to}`),
});

const result = await breaker.fire(args);
console.log(breaker.state);       // 'closed' | 'open' | 'half-open'
console.log(breaker.failureCount);
breaker.reset();
```
</details>

<details>
<summary><strong>fallback</strong> — Graceful degradation</summary>

```ts
import { withFallback, fallbackChain } from 'flowx-control/fallback';

const data = await withFallback(
  () => fetchFromPrimary(),
  'default-value',
  { onFallback: (err, idx) => console.warn(err) }
);

const result = await fallbackChain([
  () => fetchFromPrimary(),
  () => fetchFromCache(),
  () => fetchFromFallback(),
]);
```
</details>

<details>
<summary><strong>timeout</strong> — Never wait forever</summary>

```ts
import { withTimeout } from 'flowx-control/timeout';

const result = await withTimeout(() => fetch('/slow-api'), 5000, {
  fallback: () => cachedData,
  message: 'API took too long',
  signal: controller.signal,
});
```
</details>

### 🚦 Concurrency

<details>
<summary><strong>bulkhead</strong> — Isolate concurrent operations</summary>

```ts
import { createBulkhead } from 'flowx-control/bulkhead';

const bulkhead = createBulkhead({
  maxConcurrent: 10,
  maxQueue: 100,
  queueTimeout: 5000,
});

const result = await bulkhead.execute(() => processRequest());
console.log(bulkhead.activeCount, bulkhead.queueSize);
```
</details>

<details>
<summary><strong>queue</strong> — Priority async task queue</summary>

```ts
import { createQueue } from 'flowx-control/queue';

const queue = createQueue({ concurrency: 5, timeout: 10000 });

const result = await queue.add(() => processJob(), { priority: 1 });
const results = await queue.addAll(tasks.map(t => () => process(t)));

await queue.onIdle(); // wait until all done
queue.pause();
queue.resume();
```
</details>

<details>
<summary><strong>semaphore</strong> — Counting resource lock</summary>

```ts
import { createSemaphore } from 'flowx-control/semaphore';

const sem = createSemaphore(3); // max 3 concurrent
const release = await sem.acquire();
try {
  await doWork();
} finally {
  release();
}
```
</details>

<details>
<summary><strong>mutex</strong> — Mutual exclusion lock</summary>

```ts
import { createMutex } from 'flowx-control/mutex';

const mutex = createMutex();
const release = await mutex.acquire();
try {
  await criticalSection();
} finally {
  release();
}
```
</details>

### 🎛️ Flow Control

<details>
<summary><strong>rateLimit</strong> — Token bucket rate limiting</summary>

```ts
import { createRateLimiter } from 'flowx-control/rate-limit';

const limiter = createRateLimiter({
  limit: 100,
  interval: 60_000,
  strategy: 'queue',   // 'queue' | 'reject'
});

await limiter.execute(() => callApi());
console.log(limiter.remaining);
limiter.reset();
```
</details>

<details>
<summary><strong>throttle</strong> — Rate-limit function calls</summary>

```ts
import { throttle } from 'flowx-control/throttle';

const save = throttle(saveToDb, 1000, {
  leading: true,
  trailing: true,
});

await save(data);
save.cancel();
```
</details>

<details>
<summary><strong>debounce</strong> — Delay until activity pauses</summary>

```ts
import { debounce } from 'flowx-control/debounce';

const search = debounce(searchApi, 300, {
  leading: false,
  trailing: true,
  maxWait: 1000,
});

await search(query);
await search.flush();
search.cancel();
```
</details>

<details>
<summary><strong>batch</strong> — Process collections in chunks</summary>

```ts
import { batch } from 'flowx-control/batch';

const result = await batch(urls, async (url, i) => {
  return fetch(url).then(r => r.json());
}, {
  batchSize: 10,
  concurrency: 3,
  onProgress: (done, total) => console.log(`${done}/${total}`),
  signal: controller.signal,
});

console.log(result.succeeded, result.failed, result.errors);
```
</details>

<details>
<summary><strong>pipeline</strong> — Compose async operations</summary>

```ts
import { pipeline, pipe } from 'flowx-control/pipeline';

const transform = pipe(
  (input: string) => input.trim(),
  (str) => str.toUpperCase(),
  async (str) => await translate(str),
);

const result = await transform('  hello world  ');
```
</details>

### 🛠️ Utilities

<details>
<summary><strong>poll</strong> — Repeated polling with backoff</summary>

```ts
import { poll } from 'flowx-control/poll';

const { result, stop } = poll(() => checkJobStatus(jobId), {
  interval: 2000,
  until: (status) => status === 'complete',
  maxAttempts: 30,
  backoff: 'exponential',
  signal: controller.signal,
});

const finalStatus = await result;
```
</details>

<details>
<summary><strong>hedge</strong> — Hedged/speculative requests</summary>

```ts
import { hedge } from 'flowx-control/hedge';

// If primary doesn't respond in 200ms, fire a parallel request
const data = await hedge(() => fetch('/api'), {
  delay: 200,
  maxHedges: 2,
});
```
</details>

<details>
<summary><strong>memo</strong> — Async memoization with TTL</summary>

```ts
import { memo } from 'flowx-control/memo';

const cachedFetch = memo(fetchUserById, {
  ttl: 60_000,
  maxSize: 1000,
  key: (id) => `user:${id}`,
});

const user = await cachedFetch(123);
cachedFetch.clear();
```
</details>

<details>
<summary><strong>deferred</strong> — Externally resolvable promise</summary>

```ts
import { deferred } from 'flowx-control/deferred';

const d = deferred<string>();
setTimeout(() => d.resolve('hello'), 1000);
const value = await d.promise; // 'hello'
```
</details>

---

## Deep Imports (Tree-shaking)

Import only what you need — zero unused code in your bundle:

```ts
// Only pulls in ~2KB instead of the full 28KB
import { retry } from 'flowx-control/retry';
import { createQueue } from 'flowx-control/queue';
```

---

## Error Hierarchy

All errors extend `FlowXError` with a machine-readable `code`:

| Error | Code | Thrown by |
|-------|------|----------|
| `TimeoutError` | `ERR_TIMEOUT` | `withTimeout` |
| `CircuitBreakerError` | `ERR_CIRCUIT_OPEN` | `circuitBreaker` |
| `BulkheadError` | `ERR_BULKHEAD_FULL` | `bulkhead` |
| `AbortError` | `ERR_ABORTED` | `poll`, `batch`, `timeout` |
| `RateLimitError` | `ERR_RATE_LIMIT` | `rateLimit` |

```ts
import { TimeoutError, FlowXError } from 'flowx-control';

try {
  await withTimeout(fn, 1000);
} catch (err) {
  if (err instanceof TimeoutError) {
    console.log(err.code); // 'ERR_TIMEOUT'
  }
}
```

---

## Compatibility

| Environment | Support |
|-------------|---------|
| Node.js | ≥ 16 |
| Bun | ✅ |
| Deno | ✅ |
| Browsers | ✅ (ESM) |
| TypeScript | ≥ 4.7 |

---

## Contributing

```bash
git clone https://github.com/Avinashvelu03/FlowX.git
cd FlowX
npm install
npm test          # Run tests with 100% coverage
npm run lint      # ESLint
npm run build     # Build ESM + CJS + DTS
```

---

## License

MIT © [Avinash](https://github.com/Avinashvelu03)

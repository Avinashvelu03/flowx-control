# FlowX

> High-performance, zero-dependency, TypeScript-first async resilience and flow control library.

FlowX is a modern, modular alternative to fragmented async utility libraries. It provides essential patterns for robust asynchronous operations: Resilience, Concurrency, Flow Control, and Utilities. Everything is built with strict TypeScript types, tree-shakable exports, and zero external dependencies.

## Installation

```bash
npm install flowx-control
```

*Note: The package name is `flowx-control` on NPM.*

## Features

- **🛡️ Resilience**: `circuitBreaker`, `fallback`, `retry`, `timeout`
- **🚦 Concurrency**: `bulkhead`, `mutex`, `queue`, `semaphore`
- **🎛️ Flow Control**: `batch`, `debounce`, `pipeline`, `rateLimit`, `throttle`
- **🛠️ Utilities**: `deferred`, `hedge`, `memo`, `poll`
- **⚡ Zero Dependencies**: Tiny bundle size, maximum performance
- **✨ TypeScript Native**: First-class type definitions out of the box
- **🌳 Tree-shakable**: Import only what you need
- ** ESM & CJS**: Supports both modern and legacy module systems

## Usage

### Resilience
Protect your API calls from cascading failures.
```ts
import { createCircuitBreaker, withFallback } from 'flowx-control';

const apiBreaker = createCircuitBreaker(fetchUser, { failureThreshold: 3 });

const user = await withFallback(
  () => apiBreaker.fire(userId),
  { id: 'anonymous', name: 'Guest' }
);
```

### Concurrency
Limit concurrent operations to prevent resource exhaustion.
```ts
import { createQueue } from 'flowx-control';

const q = createQueue({ concurrency: 5 });
const results = await Promise.all(
  tasks.map(task => q.add(() => processTask(task)))
);
```

### Flow Control
Control the rate of execution.
```ts
import { debounce, rateLimit } from 'flowx-control';

const saveInput = debounce(saveToDb, 300);
const apiLimiter = rateLimit(sendEmail, { requests: 10, window: 60000 });
```

## API Modules

- `batch`: Process collections in concurrent chunks.
- `bulkhead`: Isolate concurrent executions (Bulkhead pattern).
- `circuitBreaker`: Stop cascading failures when a system is struggling.
- `debounce`: Delay execution until a paused activity.
- `deferred`: Create a promise that can be resolved externally.
- `fallback`: Provide alternative values/functions when primary operations fail.
- `hedge`: Send concurrent speculative requests to reduce tail latency.
- `memo`: Async memoization with TTL expiring.
- `mutex`: Mutual exclusion lock for async workflows.
- `pipeline`: Compose functional async operations.
- `poll`: Repeatedly poll a check until a condition is met.
- `queue`: Ordered async task queue with concurrency limits.
- `rateLimit`: Token-bucket based execution throttling.
- `retry`: Retry failed operations with exponential backoff & jitter.
- `semaphore`: Counting semaphore for resource locking.
- `throttle`: Limit the rate at which a function can fire.
- `timeout`: Reject operations that take too long to complete.

## License

MIT © Avinash

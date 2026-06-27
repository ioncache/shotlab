# Meticulous Client REST Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable `@shotlab/meticulous-client` code: a tiny REST client for confirmed Meticulous
machine endpoints.

**Architecture:** Keep the first implementation in `packages/meticulous-client/src/index.ts` until there is enough
code to justify splitting files. Use Node 24's native `fetch`, dependency injection for tests, and loose protocol
types where payloads are not documented yet. Implement only confirmed endpoints: `GET /machine` and
`POST /action/tare`.

**Tech Stack:** TypeScript, Node 24 native `fetch`, Vitest.

---

## File Structure

- Modify: `packages/meticulous-client/src/index.ts`
  - Exports `MeticulousClient`, `createMeticulousClient`, and public result/error types.
- Create: `packages/meticulous-client/test/index.test.ts`
  - Covers URL normalization, confirmed endpoint methods, JSON parsing, empty responses, and HTTP errors.
- Modify: `packages/meticulous-client/README.md`
  - Adds the minimal usage example for the confirmed REST endpoints.

## Task 1: Add REST Client Tests

**Files:**

- Create: `packages/meticulous-client/test/index.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createMeticulousClient, MeticulousHttpError } from '../src/index';

describe('MeticulousClient', () => {
  it('fetches machine information from the normalized API base URL', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ firmware: '0.2.24-369-gd28e82a' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const client = createMeticulousClient({
      baseUrl: 'http://machine.local:8080/api/v1/',
      fetch: fetchImpl,
    });

    await expect(client.getMachine()).resolves.toEqual({
      firmware: '0.2.24-369-gd28e82a',
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://machine.local:8080/api/v1/machine',
      { method: 'GET' },
    );
  });

  it('accepts a machine origin and adds the API prefix', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ server: 'Tornado 6.5.5' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const client = createMeticulousClient({
      baseUrl: 'http://192.168.1.20:8080',
      fetch: fetchImpl,
    });

    await client.getMachine();

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://192.168.1.20:8080/api/v1/machine',
      { method: 'GET' },
    );
  });

  it('posts tare action and accepts an empty response', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    const client = createMeticulousClient({
      baseUrl: 'http://machine.local:8080',
      fetch: fetchImpl,
    });

    await expect(client.tare()).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://machine.local:8080/api/v1/action/tare',
      { method: 'POST' },
    );
  });

  it('throws a useful error for failed responses', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response('not found', { status: 404, statusText: 'Not Found' }),
      );
    const client = createMeticulousClient({
      baseUrl: 'http://machine.local:8080',
      fetch: fetchImpl,
    });

    await expect(client.getMachine()).rejects.toMatchObject({
      name: 'MeticulousHttpError',
      status: 404,
      statusText: 'Not Found',
      body: 'not found',
    });

    await client.getMachine().catch((error: unknown) => {
      expect(error).toBeInstanceOf(MeticulousHttpError);
    });
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
yarn workspace @shotlab/meticulous-client test test/index.test.ts
```

Expected: FAIL because `createMeticulousClient` and `MeticulousHttpError` are not exported yet.

## Task 2: Implement The Minimal Client

**Files:**

- Modify: `packages/meticulous-client/src/index.ts`

- [ ] **Step 1: Replace the placeholder export with the client**

```ts
export type JsonObject = Record<string, unknown>;

export interface MeticulousClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
}

export interface MachineInfo extends JsonObject {}

export class MeticulousHttpError extends Error {
  readonly body: string;
  readonly status: number;
  readonly statusText: string;

  constructor(response: Response, body: string) {
    super(
      `Meticulous API request failed: ${response.status} ${response.statusText}`,
    );
    this.name = 'MeticulousHttpError';
    this.body = body;
    this.status = response.status;
    this.statusText = response.statusText;
  }
}

export class MeticulousClient {
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;

  constructor(options: MeticulousClientOptions) {
    this.#baseUrl = normalizeApiBaseUrl(options.baseUrl);
    this.#fetch = options.fetch ?? fetch;
  }

  async getMachine(): Promise<MachineInfo> {
    return this.#request<MachineInfo>('machine');
  }

  async tare(): Promise<void> {
    await this.#request('action/tare', { method: 'POST' });
  }

  async #request<T = void>(
    path: string,
    init: RequestInit = { method: 'GET' },
  ): Promise<T> {
    const response = await this.#fetch(`${this.#baseUrl}/${path}`, init);
    const body = await response.text();

    if (!response.ok) {
      throw new MeticulousHttpError(response, body);
    }

    if (body.length === 0) {
      return undefined as T;
    }

    return JSON.parse(body) as T;
  }
}

export function createMeticulousClient(
  options: MeticulousClientOptions,
): MeticulousClient {
  return new MeticulousClient(options);
}

function normalizeApiBaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  const pathname = url.pathname.replace(/\/+$/, '');

  if (pathname.endsWith('/api/v1')) {
    url.pathname = pathname;
  } else {
    url.pathname = `${pathname}/api/v1`;
  }

  return url.toString().replace(/\/+$/, '');
}
```

- [ ] **Step 2: Run the focused test**

Run:

```bash
yarn workspace @shotlab/meticulous-client test test/index.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run package build**

Run:

```bash
yarn workspace @shotlab/meticulous-client build
```

Expected: PASS and `packages/meticulous-client/dist/index.js` exists.

## Task 3: Document The First Usable API

**Files:**

- Modify: `packages/meticulous-client/README.md`

- [ ] **Step 1: Add the minimal usage section**

````md
# @shotlab/meticulous-client

Reusable TypeScript client for the Meticulous Espresso Machine protocol.

## Usage

```ts
import { createMeticulousClient } from '@shotlab/meticulous-client';

const client = createMeticulousClient({
  baseUrl: 'http://<machine-ip>:8080',
});

const machine = await client.getMachine();
await client.tare();
```

Implemented endpoints:

- `GET /api/v1/machine`
- `POST /api/v1/action/tare`
````

- [ ] **Step 2: Run markdown lint**

Run:

```bash
yarn lint:md
```

Expected: PASS.

## Task 4: Verify The Slice

- [ ] **Step 1: Run client tests**

Run:

```bash
yarn workspace @shotlab/meticulous-client test
```

Expected: PASS.

- [ ] **Step 2: Run full repo checks**

Run:

```bash
yarn format:check:all
yarn lint:ci:all
yarn build:all
yarn test:all
```

Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/meticulous-client/src/index.ts packages/meticulous-client/test/index.test.ts packages/meticulous-client/README.md
git commit -m "feat: add meticulous REST client foundation"
```

## Task 5: Try It Against A Real Machine

Use this when the machine is reachable on the local network.

- [ ] **Step 1: Fetch machine information**

Run:

```bash
METICULOUS_BASE_URL="http://<machine-ip>:8080" node --input-type=module <<'EOF'
import { createMeticulousClient } from './packages/meticulous-client/src/index.ts';

const client = createMeticulousClient({
  baseUrl: process.env.METICULOUS_BASE_URL,
});

console.log(JSON.stringify(await client.getMachine(), null, 2));
EOF
```

Expected: JSON containing machine or firmware/build information from `GET /api/v1/machine`.

- [ ] **Step 2: Optionally call tare**

Only run this with the machine in a safe state for taring. This calls the real machine action.

Run:

```bash
METICULOUS_BASE_URL="http://<machine-ip>:8080" node --input-type=module <<'EOF'
import { createMeticulousClient } from './packages/meticulous-client/src/index.ts';

const client = createMeticulousClient({
  baseUrl: process.env.METICULOUS_BASE_URL,
});

await client.tare();
console.log('tare ok');
EOF
```

Expected: `tare ok`, and the machine accepts `POST /api/v1/action/tare`.

## Explicit Non-Goals

- Do not add Socket.IO yet.
- Do not add endpoint guesses beyond `GET /machine` and `POST /action/tare`.
- Do not add runtime schema validation until payload shapes are documented.
- Do not add a new HTTP dependency; native `fetch` is enough.
- Do not split files until this single file becomes annoying.

## Self-Review

- Spec coverage: Covers Phase 1's first code implementation by starting the `meticulous-client` package with
  confirmed REST endpoints and TypeScript exports.
- Placeholder scan: No TBD/TODO placeholders are used.
- Type consistency: `MeticulousClientOptions`, `MachineInfo`, `MeticulousHttpError`, `MeticulousClient`, and
  `createMeticulousClient` are defined before use.

# Meticulous Client REST Endpoint Expansion Implementation Plan

**Goal:** Expand `@shotlab/meticulous-client` beyond `machine` and `tare`, confirm the broader REST surface against a real Meticulous machine, and keep real-machine verification opt-in so unit tests remain cheap and safe.

**Architecture:** Keep the package lazy and small. Continue using one public entry file at `packages/meticulous-client/src/index.ts`, add new client methods only for endpoints backed by repo evidence plus local integration confirmation, and split test execution into default unit coverage and opt-in real-machine integration coverage. Real-machine tests live under a dedicated `integration/` directory and never run through the default `test` script.

**Tech Stack:** TypeScript, Node 24 native `fetch`, Vitest, Yarn 4.

---

## File Structure

- Modify: `packages/meticulous-client/src/index.ts`
  Adds read-only REST methods, controlled write methods, loose protocol types, and small shared request helpers.
- Modify: `packages/meticulous-client/src/index.test.ts`
  Keeps default unit coverage for URL normalization, request verbs, payload handling, and errors.
- Modify: `packages/meticulous-client/package.json`
  Adds explicit integration test scripts that do not run by default.
- Modify: `packages/meticulous-client/vitest.config.ts`
  Restricts the default test run to unit tests only.
- Create: `packages/meticulous-client/vitest.integration.config.ts`
  Runs only real-machine integration tests from `integration/**/*.test.ts`.
- Create: `packages/meticulous-client/integration/read.integration.test.ts`
  Opt-in verification for read-only endpoints against the user’s machine.
- Create: `packages/meticulous-client/integration/write.integration.test.ts`
  Opt-in verification for write endpoints behind explicit environment guards.
- Modify: `packages/meticulous-client/README.md`
  Documents the expanded API and how to run real-machine integration checks.
- Modify: `docs/protocol.md`
  Promotes endpoints from “suspected” to “confirmed” only after local integration results succeed.

---

### Task 1: Add The Integration Test Harness

**Files:**

- Modify: `packages/meticulous-client/package.json`
- Modify: `packages/meticulous-client/vitest.config.ts`
- Create: `packages/meticulous-client/vitest.integration.config.ts`
- Create: `packages/meticulous-client/integration/read.integration.test.ts`
- Create: `packages/meticulous-client/integration/write.integration.test.ts`

- [ ] **Step 1: Restrict the default Vitest config to unit tests**

```ts
import { mergeConfig } from 'vitest/config';
import { resolve } from 'node:path';
import baseConfig from '../../vitest.config.base';

export default mergeConfig(baseConfig, {
  resolve: {
    alias: {
      '~': resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 2: Add an integration-only Vitest config**

```ts
import { mergeConfig } from 'vitest/config';
import { resolve } from 'node:path';
import baseConfig from '../../vitest.config.base';

export default mergeConfig(baseConfig, {
  resolve: {
    alias: {
      '~': resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    include: ['integration/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
```

- [ ] **Step 3: Add package scripts for opt-in integration runs**

```json
{
  "scripts": {
    "build": "yarn clean && tsc -p tsconfig.build.json",
    "clean": "rm -rf dist coverage && find . -maxdepth 1 -name '*.tsbuildinfo' -delete",
    "format": "oxfmt",
    "format:check": "oxfmt --check",
    "lint": "oxlint -f default",
    "lint:ci": "oxlint -f github",
    "lint:fix": "oxlint --fix",
    "test": "vitest run --config vitest.config.ts --passWithNoTests",
    "test:coverage": "vitest run --config vitest.config.ts --coverage --passWithNoTests",
    "test:integration": "vitest run --config vitest.integration.config.ts integration/read.integration.test.ts",
    "test:integration:write": "vitest run --config vitest.integration.config.ts integration/write.integration.test.ts",
    "test:watch": "vitest --config vitest.config.ts"
  }
}
```

- [ ] **Step 4: Add read-only real-machine integration tests**

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import { createMeticulousClient } from '../src/index';
import { readIntegrationConfig } from '../src/integration-config';

const integrationConfig = readIntegrationConfig();
const describeIfConfigured =
  integrationConfig.enabled && integrationConfig.baseUrl ? describe : describe.skip;

describeIfConfigured('Meticulous REST read endpoints', () => {
  const client = createMeticulousClient({
    baseUrl: integrationConfig.baseUrl ?? 'http://127.0.0.1:8080',
  });
  let firstProfileId: string | undefined;

  beforeAll(async () => {
    const profiles = await client.listProfiles();
    const firstProfile = profiles[0];
    firstProfileId = typeof firstProfile?.id === 'string' ? firstProfile.id : undefined;
  });

  it('reads machine information', async () => {
    const machine = await client.getMachine();

    expect(machine).toEqual(expect.any(Object));
    expect(machine.firmware ?? machine.software_version ?? machine.image_version).toBeDefined();
  });

  it('reads settings', async () => {
    const settings = await client.getSettings();

    expect(settings).toEqual(expect.any(Object));
  });

  it('reads profile summaries', async () => {
    const profiles = await client.listProfiles();

    expect(Array.isArray(profiles)).toBe(true);
  });

  it('reads history', async () => {
    const history = await client.getHistory();

    expect(history).toEqual(expect.any(Object));
    expect(Array.isArray(history.history)).toBe(true);
  });

  it('reads a full profile when the machine returns a profile id', async () => {
    if (!firstProfileId) {
      return;
    }

    const profile = await client.getProfile(firstProfileId);

    expect(profile).toEqual(expect.any(Object));
    expect(profile.id).toBe(firstProfileId);
  });
});
```

- [ ] **Step 5: Add guarded write-endpoint integration tests**

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createMeticulousClient,
  METICULOUS_ACTIONS,
} from '../src/index';
import { readIntegrationConfig } from '../src/integration-config';

const integrationConfig = readIntegrationConfig();
const describeIfConfigured =
  integrationConfig.enabled &&
  integrationConfig.baseUrl &&
  integrationConfig.allowWriteTests
    ? describe
    : describe.skip;

describeIfConfigured('Meticulous REST write endpoints', () => {
  const client = createMeticulousClient({
    baseUrl: integrationConfig.baseUrl ?? 'http://127.0.0.1:8080',
  });
  let firstProfileId: string | undefined;
  let settingsPatch: Record<string, unknown> | undefined;

  beforeAll(async () => {
    const profiles = await client.listProfiles();
    const firstProfile = profiles[0];
    firstProfileId = typeof firstProfile?.id === 'string' ? firstProfile.id : undefined;
    settingsPatch = integrationConfig.settingsPatch;
  });

  afterAll(async () => {
    await client.triggerAction(METICULOUS_ACTIONS.STOP).catch(() => undefined);
  });

  it('posts tare', async () => {
    await expect(client.tare()).resolves.toBeUndefined();
  });

  it('loads a profile when the machine returns a profile id', async () => {
    if (!firstProfileId) {
      return;
    }

    const result = await client.loadProfile(firstProfileId);

    expect(result).toEqual(expect.any(Object));
  });

  it('updates settings when a safe patch is available', async () => {
    if (!settingsPatch) {
      return;
    }

    const result = await client.updateSettings(settingsPatch);

    expect(result).toEqual(expect.any(Object));
  });

  it('runs preheat through the generic action endpoint', async () => {
    const result = await client.triggerAction(METICULOUS_ACTIONS.PREHEAT);

    expect(result).toEqual(expect.any(Object));
  });
});
```

- [ ] **Step 6: Run unit tests and prove integration tests are opt-in**

Run:

```bash
yarn workspace @shotlab/meticulous-client test
```

Expected: PASS, with only unit tests under `src/` executed.

Run:

```bash
yarn workspace @shotlab/meticulous-client test:integration
```

Expected: All tests SKIP when `METICULOUS_BASE_URL` is unset.

- [ ] **Step 7: Commit the harness**

```bash
git add packages/meticulous-client/package.json packages/meticulous-client/vitest.config.ts packages/meticulous-client/vitest.integration.config.ts packages/meticulous-client/integration/read.integration.test.ts packages/meticulous-client/integration/write.integration.test.ts
git commit -m "test: add meticulous integration harness"
```

---

### Task 2: Confirm The Real Machine Surface And Update Protocol Notes

**Files:**

- Modify: `docs/protocol.md`

- [ ] **Step 1: Run the read-only integration pass against the real machine**

Run:

```bash
METICULOUS_RUN_INTEGRATION=1 \
METICULOUS_BASE_URL=http://<machine-ip>:8080 \
yarn workspace @shotlab/meticulous-client test:integration
```

Expected: PASS for `machine`, `settings`, `profile/list`, `history`, and optionally `profile/get/:id`.

- [ ] **Step 2: Run the guarded write pass only once, explicitly**

Run:

```bash
METICULOUS_RUN_INTEGRATION=1 \
METICULOUS_BASE_URL=http://<machine-ip>:8080 \
METICULOUS_ALLOW_WRITE_TESTS=1 \
METICULOUS_SETTINGS_PATCH_JSON='{"auto_preheat":false}' \
yarn workspace @shotlab/meticulous-client test:integration:write
```

Expected: PASS for `tare`, `loadProfile`, `settings` patch, and `preheat` if those routes and verbs are valid on the real machine.

- [ ] **Step 3: Move locally-verified endpoints into the confirmed list in `docs/protocol.md`**

````md
### Confirmed Endpoints

#### Machine

```http
GET /machine
```

#### History

```http
GET /history
```

#### Profiles

```http
GET /profile/list
GET /profile/list?full=true
GET /profile/get/:id
GET /profile/load/:id
GET /profile/last
```

#### Settings

```http
GET /settings
POST /settings
```

#### Actions

```http
POST /action/tare
POST /action/preheat
```
````

- [ ] **Step 4: Keep endpoints that fail local verification in a remaining “suspected” section**

````md
### Suspected Endpoints

```http
POST /action/start
POST /action/stop
POST /action/purge
```

Status:

- Seen in public repos
- Not yet locally confirmed on this machine
````

- [ ] **Step 5: Commit the protocol confirmation update**

```bash
git add docs/protocol.md
git commit -m "docs: confirm meticulous rest endpoints"
```

---

### Task 3: Expand The Client For Confirmed Read Endpoints

**Files:**

- Modify: `packages/meticulous-client/src/index.ts`
- Modify: `packages/meticulous-client/src/index.test.ts`

- [ ] **Step 1: Add loose public types for history, settings, and profiles**

```ts
export type JsonObject = Record<string, unknown>;
export type JsonArray = unknown[];

export interface HistoryEntry extends JsonObject {}

export interface HistoryResponse extends JsonObject {
  history: HistoryEntry[];
}

export type Profile = JsonObject;
export type Settings = JsonObject;

export interface ListProfilesOptions {
  full?: boolean;
}
```

- [ ] **Step 2: Expand the public client interface**

```ts
export interface MeticulousClient {
  getCurrentHistory(): Promise<HistoryResponse>;
  getHistory(): Promise<HistoryResponse>;
  getLastHistory(): Promise<HistoryResponse>;
  getLastProfile(): Promise<Profile>;
  getMachine(): Promise<MachineInfo>;
  getProfile(id: string): Promise<Profile>;
  getSettings(): Promise<Settings>;
  listProfiles(options?: ListProfilesOptions): Promise<JsonArray>;
  loadProfile(id: string): Promise<JsonObject>;
  preheat(): Promise<JsonObject>;
  tare(): Promise<void>;
  triggerAction(name: string): Promise<JsonObject>;
  updateSettings(patch: JsonObject): Promise<Settings>;
}
```

- [ ] **Step 3: Add the new client methods while keeping the request layer small**

```ts
  return {
    getCurrentHistory: () => request<HistoryResponse>('history/current'),
    getHistory: () => request<HistoryResponse>('history'),
    getLastHistory: () => request<HistoryResponse>('history/last'),
    getLastProfile: () => request<Profile>('profile/last'),
    getMachine: () => request<MachineInfo>('machine'),
    getProfile: (id: string) =>
      request<Profile>(`profile/get/${encodeURIComponent(id)}`),
    getSettings: () => request<Settings>('settings'),
    listProfiles: (listOptions?: ListProfilesOptions) =>
      request<JsonArray>(`profile/list${listOptions?.full ? '?full=true' : ''}`),
    loadProfile: (id: string) =>
      request<JsonObject>(`profile/load/${encodeURIComponent(id)}`),
    preheat: () => requestAction(METICULOUS_ACTIONS.PREHEAT),
    tare: async () => {
      await requestAction(METICULOUS_ACTIONS.TARE);
    },
    triggerAction: requestAction,
    updateSettings: (patch: JsonObject) => postJson<Settings>('settings', patch),
  };
```

- [ ] **Step 4: Add a small shared action helper instead of duplicating verbs**

```ts
  function requestAction(name: string): Promise<JsonObject> {
    return request<JsonObject>(`action/${encodeURIComponent(name)}`, {
      method: 'POST',
    });
  }
```

- [ ] **Step 5: Extend the unit tests for the added methods**

```ts
  it('fetches history', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ history: [] }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );
    const client = createMeticulousClient({
      baseUrl: 'http://machine.local:8080',
      fetch: fetchImpl,
    });

    await expect(client.getHistory()).resolves.toEqual({ history: [] });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://machine.local:8080/api/v1/history',
      { method: 'GET' },
    );
  });

  it('lists profiles', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: 'abc', name: 'Default' }]), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );
    const client = createMeticulousClient({
      baseUrl: 'http://machine.local:8080',
      fetch: fetchImpl,
    });

    await expect(client.listProfiles()).resolves.toEqual([
      { id: 'abc', name: 'Default' },
    ]);
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://machine.local:8080/api/v1/profile/list',
      { method: 'GET' },
    );
  });

  it('reads settings', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ auto_preheat: false }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );
    const client = createMeticulousClient({
      baseUrl: 'http://machine.local:8080',
      fetch: fetchImpl,
    });

    await expect(client.getSettings()).resolves.toEqual({
      auto_preheat: false,
    });
  });

  it('posts settings updates as json', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ auto_preheat: false }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );
    const client = createMeticulousClient({
      baseUrl: 'http://machine.local:8080',
      fetch: fetchImpl,
    });

    await client.updateSettings({ auto_preheat: false });

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://machine.local:8080/api/v1/settings',
      {
        body: JSON.stringify({ auto_preheat: false }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      },
    );
  });

  it('runs generic GET actions', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, action: 'preheat' }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );
    const client = createMeticulousClient({
      baseUrl: 'http://machine.local:8080',
      fetch: fetchImpl,
    });

    await expect(client.preheat()).resolves.toEqual({
      ok: true,
      action: 'preheat',
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://machine.local:8080/api/v1/action/preheat',
      { method: 'GET' },
    );
  });
```

- [ ] **Step 6: Run the scoped package verification**

Run:

```bash
yarn workspace @shotlab/meticulous-client test
yarn workspace @shotlab/meticulous-client build
```

Expected: PASS.

- [ ] **Step 7: Commit the read-endpoint expansion**

```bash
git add packages/meticulous-client/src/index.ts packages/meticulous-client/src/index.test.ts
git commit -m "feat: expand meticulous rest read endpoints"
```

---

### Task 4: Promote Locally Confirmed Write Endpoints Into The Public API

**Files:**

- Modify: `packages/meticulous-client/src/index.ts`
- Modify: `packages/meticulous-client/src/index.test.ts`

- [ ] **Step 1: Keep `tare()` on POST and only ship additional write helpers that passed the guarded integration run**

```ts
    loadProfile: (id: string) =>
      request<JsonObject>(`profile/load/${encodeURIComponent(id)}`),
    preheat: () => requestAction(METICULOUS_ACTIONS.PREHEAT),
    tare: async () => {
      await requestAction(METICULOUS_ACTIONS.TARE);
    },
    triggerAction: requestAction,
    updateSettings: (patch: JsonObject) =>
      postJson<Settings>('settings', patch),
```

- [ ] **Step 2: Add unit tests for `loadProfile`, `preheat`, and the encoded generic action path**

```ts
  it('loads a profile by id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, id: 'abc' }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );
    const client = createMeticulousClient({
      baseUrl: 'http://machine.local:8080',
      fetch: fetchImpl,
    });

    await expect(client.loadProfile('abc')).resolves.toEqual({
      ok: true,
      id: 'abc',
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://machine.local:8080/api/v1/profile/load/abc',
      { method: 'GET' },
    );
  });

  it('posts the known preheat action', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, id: 'abc' }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );
    const client = createMeticulousClient({
      baseUrl: 'http://machine.local:8080',
      fetch: fetchImpl,
    });

    await client.preheat();

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://machine.local:8080/api/v1/action/preheat',
      {
        method: 'POST',
      },
    );
  });

  it('encodes generic action names before posting them', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );
    const client = createMeticulousClient({
      baseUrl: 'http://machine.local:8080',
      fetch: fetchImpl,
    });

    await client.triggerAction('preheat?x=1');

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://machine.local:8080/api/v1/action/preheat%3Fx%3D1',
      { method: 'POST' },
    );
  });
```

- [ ] **Step 3: Re-run the guarded write integration suite after the client ships the methods**

Run:

```bash
METICULOUS_RUN_INTEGRATION=1 \
METICULOUS_BASE_URL=http://<machine-ip>:8080 \
METICULOUS_ALLOW_WRITE_TESTS=1 \
METICULOUS_SETTINGS_PATCH_JSON='{"auto_preheat":false}' \
yarn workspace @shotlab/meticulous-client test:integration:write
```

Expected: PASS.

- [ ] **Step 4: Commit the write-endpoint expansion**

```bash
git add packages/meticulous-client/src/index.ts packages/meticulous-client/src/index.test.ts
git commit -m "feat: add meticulous rest write endpoints"
```

---

### Task 5: Document The Expanded Surface

**Files:**

- Modify: `packages/meticulous-client/README.md`

- [ ] **Step 1: Update the usage example to show a read path and an opt-in write path**

````md
# @shotlab/meticulous-client

Reusable TypeScript client for the Meticulous Espresso Machine protocol.

## Usage

```ts
import {
  createMeticulousClient,
  METICULOUS_ACTIONS,
} from '@shotlab/meticulous-client';

const client = createMeticulousClient({
  baseUrl: 'http://<machine-ip>:8080',
});

const machine = await client.getMachine();
const settings = await client.getSettings();
const profiles = await client.listProfiles();
const history = await client.getHistory();

await client.tare();
await client.triggerAction(METICULOUS_ACTIONS.PREHEAT);
```

## Integration Tests

Read-only verification:

```bash
METICULOUS_RUN_INTEGRATION=1 \
METICULOUS_BASE_URL=http://<machine-ip>:8080 \
yarn workspace @shotlab/meticulous-client test:integration
```

Guarded write verification:

```bash
METICULOUS_RUN_INTEGRATION=1 \
METICULOUS_BASE_URL=http://<machine-ip>:8080 \
METICULOUS_ALLOW_WRITE_TESTS=1 \
METICULOUS_SETTINGS_PATCH_JSON='{"auto_preheat":false}' \
yarn workspace @shotlab/meticulous-client test:integration:write
```

Implemented endpoints:

- `GET /api/v1/machine`
- `GET /api/v1/history`
- `GET /api/v1/history/current`
- `GET /api/v1/history/last`
- `GET /api/v1/profile/list`
- `GET /api/v1/profile/list?full=true`
- `GET /api/v1/profile/get/:id`
- `GET /api/v1/profile/load/:id`
- `GET /api/v1/profile/last`
- `GET /api/v1/settings`
- `POST /api/v1/settings`
- `POST /api/v1/action/tare`
- `POST /api/v1/action/preheat`
```
````

- [ ] **Step 2: Run format and lint on the package docs and config changes**

Run:

```bash
yarn workspace @shotlab/meticulous-client format:check
yarn workspace @shotlab/meticulous-client lint:ci
```

Expected: PASS.

- [ ] **Step 3: Run the final package verification**

Run:

```bash
yarn workspace @shotlab/meticulous-client test
yarn workspace @shotlab/meticulous-client build
```

Expected: PASS.

- [ ] **Step 4: Commit the docs pass**

```bash
git add packages/meticulous-client/README.md
git commit -m "docs: expand meticulous client usage"
```

---

## Explicit Non-Goals

- Do not add Socket.IO client support in this step.
- Do not tighten payloads into exact schema models yet.
- Do not run real-machine integration tests by default.
- Do not add broad retry logic, caching, or background polling to the package.
- Do not add new dependencies for HTTP, env loading, or test orchestration.

---

## Self-Review

- Spec coverage: The plan covers integration harness creation, local endpoint confirmation, read endpoint expansion, guarded write endpoint expansion, and docs/protocol updates.
- Placeholder scan: No `TODO`, `TBD`, or “figure it out later” steps remain.
- Type consistency: The plan uses `HistoryResponse`, `Settings`, `Profile`, `ListProfilesOptions`, `METICULOUS_ACTIONS`, `triggerAction`, `loadProfile`, and `updateSettings` consistently across tests, implementation, and docs.

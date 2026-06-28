# @shotlab/meticulous-client

Reusable TypeScript client for the Meticulous Espresso Machine protocol.

## Usage

```ts
import { createMeticulousClient } from '@shotlab/meticulous-client';

const client = createMeticulousClient({
  baseUrl: 'http://<machine-ip>:8080',
});

const machine = await client.getMachine();
const currentHistory = await client.getCurrentHistory();
const lastHistory = await client.getLastHistory();
const lastProfile = await client.getLastProfile();
await client.tare();
await client.preheat();
```

Implemented endpoints:

- `GET /api/v1/history/current`
- `GET /api/v1/history/last`
- `GET /api/v1/machine`
- `GET /api/v1/settings`
- `GET /api/v1/profile/list`
- `GET /api/v1/profile/list?full=true`
- `GET /api/v1/profile/get/:id`
- `GET /api/v1/profile/load/:id`
- `GET /api/v1/profile/last`
- `GET /api/v1/history`
- `POST /api/v1/action/preheat`
- `POST /api/v1/action/tare`
- `POST /api/v1/settings`

## Integration Tests

Integration tests are opt-in and do not run through the default `test` script.

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
yarn workspace @shotlab/meticulous-client test:integration:write
```

The guarded write suite never calls `start`, and it issues a best-effort `stop`
cleanup after profile-load and preheat checks so the machine returns to a
neutral state.

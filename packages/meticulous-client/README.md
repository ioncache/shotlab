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

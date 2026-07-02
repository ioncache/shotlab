# @shotlab/meticulous-client

Reusable TypeScript client for the Meticulous Espresso Machine protocol.

## Usage

```ts
import {
  connectSocket,
  createMeticulousClient,
  METICULOUS_ACTIONS,
} from '@shotlab/meticulous-client';

const client = createMeticulousClient({
  baseUrl: 'http://<machine-ip>:8080',
});

const machine = await client.getMachine();
const currentHistory = await client.getCurrentHistory();
const lastHistory = await client.getLastHistory();
const lastProfile = await client.getLastProfile();
await client.tare();
await client.triggerAction(METICULOUS_ACTIONS.PREHEAT);

const connection = await connectSocket({
  baseUrl: 'http://<machine-ip>:8080',
  onAny: (event) => {
    console.log(event.event, event.payload);
  },
});

await connection.close();
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

## Socket CLI

Manual socket inspection and recording lives behind one CLI entrypoint:

```bash
yarn workspace @shotlab/meticulous-client utils:socket monitor http://<machine-ip>:8080
```

Press `q` to quit the live terminal session cleanly.

To save a capture locally for later analysis:

```bash
yarn workspace @shotlab/meticulous-client utils:socket record http://<machine-ip>:8080 --label morning-brew
```

Press `q` to stop recording and flush the saved artifacts.

By default this writes timestamped session folders under:

```text
packages/meticulous-client/recordings/
```

Each saved session currently includes:

- `raw-events.jsonl`
- `normalized-timeline.json`
- `chart-series.json`

To inspect a saved session later without reconnecting:

```bash
yarn workspace @shotlab/meticulous-client utils:socket summarize packages/meticulous-client/recordings/<session-dir>
```

The summarize command also accepts a bare session directory name and resolves
repo-root-relative recording paths even when you launch it from another cwd.

For the interactive operator console:

```bash
yarn workspace @shotlab/meticulous-client utils:socket console http://<machine-ip>:8080
```

Current console hotkeys:

- `q` quit
- `h` help
- `c` clear the stream panel
- `p` pause/resume the visible stream panel
- `r` start/stop recording
- `:` enter typed command mode

Current typed commands:

- `help`
- `clear`
- `pause`
- `resume`
- `reconnect`
- `disconnect`
- `record start [label]`
- `record stop`
- `quit`

Current stub machine commands:

- `tare`
- `preheat`
- `raise`
- `purge`
- `stop`

The stub machine commands are visible in help and currently reply with `not yet implemented`.

## Integration Tests

Integration tests are opt-in and do not run through the default `test` script.

Read-only verification:

```bash
METICULOUS_RUN_INTEGRATION=1 \
METICULOUS_BASE_URL=http://<machine-ip>:8080 \
yarn workspace @shotlab/meticulous-client test:integration
```

Socket discovery verification:

```bash
METICULOUS_RUN_INTEGRATION=1 \
METICULOUS_BASE_URL=http://<machine-ip>:8080 \
yarn workspace @shotlab/meticulous-client test:integration:socket
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

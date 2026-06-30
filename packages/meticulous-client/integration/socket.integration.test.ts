import { describe, expect, it } from 'vitest';
import { io } from 'socket.io-client';
import { connectSocket } from '../src/index';
import { readIntegrationConfig } from '../src/integration-config';

const integrationConfig = readIntegrationConfig();
const describeIfConfigured =
  integrationConfig.enabled && integrationConfig.baseUrl
    ? describe
    : describe.skip;

describeIfConfigured('Meticulous Socket.IO discovery', () => {
  const baseUrl = integrationConfig.baseUrl ?? 'http://127.0.0.1:8080';

  it('connects through the public socket API and closes cleanly', async () => {
    const events: Array<{ event: string; payload: unknown[] }> = [];
    const connection = await connectSocket({
      baseUrl,
      onAny: (event) => {
        if (events.length < 20) {
          events.push(event);
        }
      },
    });

    await wait(1_500);

    await expect(connection.close()).resolves.toBeUndefined();
    await expect(connection.close()).resolves.toBeUndefined();
    expect(events.length).toBeLessThanOrEqual(20);
  });

  it('observes the Engine.IO transport sequence with a bounded event sample', async () => {
    const sample = await observeSocketSample(baseUrl);

    expect(sample.socketId).toEqual(expect.any(String));
    expect(sample.transportSequence[0]).toBe('polling');
    expect(sample.finalTransport).toMatch(/^(polling|websocket)$/);
    expect(sample.events.length).toBeLessThanOrEqual(20);
  });
});

async function observeSocketSample(baseUrl: string): Promise<{
  events: Array<{ event: string; payload: unknown[] }>;
  finalTransport: string;
  socketId: string;
  transportSequence: string[];
}> {
  const machineBaseUrl = normalizeMachineBaseUrl(baseUrl);

  return await new Promise((resolve, reject) => {
    const socket = io(machineBaseUrl, {
      path: '/socket.io/',
      reconnection: false,
      transports: ['polling', 'websocket'],
    });
    const events: Array<{ event: string; payload: unknown[] }> = [];
    const transportSequence: string[] = [];
    let finished = false;
    let sampleTimer: ReturnType<typeof setTimeout> | undefined;

    const timeout = setTimeout(() => {
      finish(new Error('Socket connection timed out before connect'));
    }, 5_000);

    const finish = (error?: Error) => {
      if (finished) {
        return;
      }

      finished = true;
      clearTimeout(timeout);
      if (sampleTimer) {
        clearTimeout(sampleTimer);
      }
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
      socket.offAny(onAny);
      socket.io.engine.off('upgrade', onUpgrade);

      if (error) {
        socket.close();
        reject(error);
        return;
      }

      const finalTransport = socket.io.engine.transport.name;
      const socketId = socket.id;
      socket.close();
      resolve({
        events,
        finalTransport,
        socketId,
        transportSequence,
      });
    };

    const onAny = (event: string, ...payload: unknown[]) => {
      if (events.length < 20) {
        events.push({ event, payload });
      }
    };
    const onConnect = () => {
      transportSequence.push(socket.io.engine.transport.name);
      sampleTimer = setTimeout(() => {
        finish();
      }, 1_500);
    };
    const onConnectError = (error: Error) => {
      finish(new Error(`Socket connect_error: ${error.message}`));
    };
    const onUpgrade = (transport: { name: string }) => {
      transportSequence.push(transport.name);
    };

    socket.onAny(onAny);
    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);
    socket.io.engine.on('upgrade', onUpgrade);
  });
}

function normalizeMachineBaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  if (url.search || url.hash) {
    throw new Error('baseUrl must not include a query string or fragment');
  }

  const pathname = url.pathname.replace(/\/+$/, '');
  if (pathname.endsWith('/api/v1')) {
    url.pathname = pathname.slice(0, -'/api/v1'.length) || '/';
  } else {
    url.pathname = pathname || '/';
  }

  return url.toString().replace(/\/+$/, '');
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

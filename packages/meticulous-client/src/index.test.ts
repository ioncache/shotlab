import { afterEach, describe, expect, it, vi } from 'vitest';
import * as meticulous from './index';
import { createMeticulousClient, MeticulousHttpError } from './index';

describe('MeticulousClient', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps the public client API factory-based', () => {
    expect(meticulous).not.toHaveProperty('MeticulousClient');
  });

  it('exports known machine action names', () => {
    expect(meticulous.METICULOUS_ACTIONS).toEqual({
      PREHEAT: 'preheat',
      STOP: 'stop',
      TARE: 'tare',
    });
  });

  it('fetches machine information from the normalized API base URL', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ firmware: '0.2.24-369-gd28e82a' }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
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
        headers: { 'content-type': 'application/json' },
        status: 200,
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

  it('uses global fetch when no fetch implementation is provided', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ firmware: '0.2.24-369-gd28e82a' }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchImpl);

    const client = createMeticulousClient({
      baseUrl: 'http://machine.local:8080',
    });

    await expect(client.getMachine()).resolves.toEqual({
      firmware: '0.2.24-369-gd28e82a',
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://machine.local:8080/api/v1/machine',
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

  it('fetches settings from the machine API', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ auto_preheat: true }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );
    const client = createMeticulousClient({
      baseUrl: 'http://machine.local:8080',
      fetch: fetchImpl,
    });

    await expect(client.getSettings()).resolves.toEqual({
      auto_preheat: true,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://machine.local:8080/api/v1/settings',
      { method: 'GET' },
    );
  });

  it('fetches profile summaries', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: 'espresso' }]), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );
    const client = createMeticulousClient({
      baseUrl: 'http://machine.local:8080',
      fetch: fetchImpl,
    });

    await expect(client.listProfiles()).resolves.toEqual([{ id: 'espresso' }]);
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://machine.local:8080/api/v1/profile/list',
      { method: 'GET' },
    );
  });

  it('can request the full profile list variant', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: 'espresso', steps: [] }]), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );
    const client = createMeticulousClient({
      baseUrl: 'http://machine.local:8080',
      fetch: fetchImpl,
    });

    await expect(client.listProfiles({ full: true })).resolves.toEqual([
      { id: 'espresso', steps: [] },
    ]);
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://machine.local:8080/api/v1/profile/list?full=true',
      { method: 'GET' },
    );
  });

  it('fetches an individual profile by id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'profile/1' }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );
    const client = createMeticulousClient({
      baseUrl: 'http://machine.local:8080',
      fetch: fetchImpl,
    });

    await expect(client.getProfile('profile/1')).resolves.toEqual({
      id: 'profile/1',
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://machine.local:8080/api/v1/profile/get/profile%2F1',
      { method: 'GET' },
    );
  });

  it('fetches brew history', async () => {
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

  it('fetches current history', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(null), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );
    const client = createMeticulousClient({
      baseUrl: 'http://machine.local:8080',
      fetch: fetchImpl,
    });

    await expect(client.getCurrentHistory()).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://machine.local:8080/api/v1/history/current',
      { method: 'GET' },
    );
  });

  it('fetches the last history entry', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [], id: 'last-shot' }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );
    const client = createMeticulousClient({
      baseUrl: 'http://machine.local:8080',
      fetch: fetchImpl,
    });

    await expect(client.getLastHistory()).resolves.toEqual({
      data: [],
      id: 'last-shot',
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://machine.local:8080/api/v1/history/last',
      { method: 'GET' },
    );
  });

  it('fetches the last profile', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ profile: { id: 'last-profile' } }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );
    const client = createMeticulousClient({
      baseUrl: 'http://machine.local:8080',
      fetch: fetchImpl,
    });

    await expect(client.getLastProfile()).resolves.toEqual({
      profile: { id: 'last-profile' },
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://machine.local:8080/api/v1/profile/last',
      { method: 'GET' },
    );
  });

  it('loads a profile by id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'espresso', ok: true }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );
    const client = createMeticulousClient({
      baseUrl: 'http://machine.local:8080',
      fetch: fetchImpl,
    });

    await expect(client.loadProfile('espresso')).resolves.toEqual({
      id: 'espresso',
      ok: true,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://machine.local:8080/api/v1/profile/load/espresso',
      { method: 'GET' },
    );
  });

  it('posts settings patches as JSON', async () => {
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

    await expect(
      client.updateSettings({ auto_preheat: false }),
    ).resolves.toEqual({
      auto_preheat: false,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://machine.local:8080/api/v1/settings',
      {
        body: JSON.stringify({ auto_preheat: false }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      },
    );
  });

  it('posts generic action requests', async () => {
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

    await expect(client.triggerAction('preheat?x=1')).resolves.toEqual({
      ok: true,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://machine.local:8080/api/v1/action/preheat%3Fx%3D1',
      { method: 'POST' },
    );
  });

  it('provides a dedicated preheat helper', async () => {
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

    await expect(client.preheat()).resolves.toEqual({
      ok: true,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://machine.local:8080/api/v1/action/preheat',
      { method: 'POST' },
    );
  });

  it('throws a useful error for failed responses', async () => {
    const fetchImpl = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          new Response('not found', { status: 404, statusText: 'Not Found' }),
        ),
      );
    const client = createMeticulousClient({
      baseUrl: 'http://machine.local:8080',
      fetch: fetchImpl,
    });

    await expect(client.getMachine()).rejects.toMatchObject({
      body: 'not found',
      name: 'MeticulousHttpError',
      status: 404,
      statusText: 'Not Found',
    });

    await client.getMachine().catch((error: unknown) => {
      expect(error).toBeInstanceOf(MeticulousHttpError);
    });
  });

  it('connects sockets from the normalized machine origin', async () => {
    const close = vi.fn();
    const onAny = vi.fn();
    const connectSocketIo = vi.fn().mockResolvedValue({ close, onAny });

    vi.doMock('./socket-io-client', () => ({ connectSocketIo }));

    const { connectSocket } = await import('./index');

    await connectSocket({ baseUrl: 'http://machine.local:8080/api/v1/' });

    expect(connectSocketIo).toHaveBeenCalledWith({
      baseUrl: 'http://machine.local:8080',
      onStateChange: undefined,
    });
  });

  it('forwards raw socket events through onAny', async () => {
    const listeners: Array<(event: string, ...payload: unknown[]) => void> = [];
    const close = vi.fn();
    const connectSocketIo = vi.fn().mockResolvedValue({
      close,
      onAny: (listener: (event: string, ...payload: unknown[]) => void) => {
        listeners.push(listener);
      },
    });

    vi.doMock('./socket-io-client', () => ({ connectSocketIo }));

    const { connectSocket } = await import('./index');
    const received: Array<{ event: string; payload: unknown[] }> = [];

    await connectSocket({
      baseUrl: 'http://machine.local:8080',
      onAny: (event) => {
        received.push(event);
      },
    });

    listeners[0]?.('status', { ready: true }, 42);

    expect(received).toEqual([
      { event: 'status', payload: [{ ready: true }, 42] },
    ]);
  });

  it('closes the socket connection at most once', async () => {
    const close = vi.fn();
    const connectSocketIo = vi.fn().mockResolvedValue({
      close,
      onAny: vi.fn(),
    });

    vi.doMock('./socket-io-client', () => ({ connectSocketIo }));

    const { connectSocket } = await import('./index');
    const connection = await connectSocket({
      baseUrl: 'http://machine.local:8080',
    });

    await connection.close();
    await connection.close();

    expect(close).toHaveBeenCalledTimes(1);
  });
});

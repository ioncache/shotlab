import { afterEach, describe, expect, it, vi } from 'vitest';
import * as meticulous from './index';
import { createMeticulousClient, MeticulousHttpError } from './index';

describe('MeticulousClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the public client API factory-based', () => {
    expect(meticulous).not.toHaveProperty('MeticulousClient');
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
});

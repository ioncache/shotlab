// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  function createDeferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((nextResolve, nextReject) => {
      resolve = nextResolve;
      reject = nextReject;
    });

    return { promise, reject, resolve };
  }

  function createState() {
    const deferreds = {
      history: createDeferred<{ history: [] }>(),
      lastProfile: createDeferred<{ profile: { title: string } }>(),
      machine: createDeferred<{
        state: string;
        water_temperature: number;
        weight: number;
      }>(),
      preheat: createDeferred<{ ok: true }>(),
      settings: createDeferred<{ heating_timeout: number }>(),
      tare: createDeferred<void>(),
    };

    const client = {
      getHistory: vi.fn(() => deferreds.history.promise),
      getLastProfile: vi.fn(() => deferreds.lastProfile.promise),
      getMachine: vi.fn(() => deferreds.machine.promise),
      getSettings: vi.fn(() => deferreds.settings.promise),
      preheat: vi.fn(() => deferreds.preheat.promise),
      tare: vi.fn(() => deferreds.tare.promise),
    };

    return { client, deferreds };
  }

  const state = createState();

  return {
    client: state.client,
    deferreds: state.deferreds,
    reset() {
      const nextState = createState();
      this.client = nextState.client;
      this.deferreds = nextState.deferreds;
    },
  };
});

vi.mock('@shotlab/meticulous-client', async () => {
  const actual = await vi.importActual<typeof import('@shotlab/meticulous-client')>(
    '@shotlab/meticulous-client',
  );

  return {
    ...actual,
    connectSocket: vi.fn().mockResolvedValue({
      close: async () => undefined,
      getState: () => ({
        connected: false,
        transport: 'polling',
      }),
      onAny: () => undefined,
    }),
  };
});

vi.mock('./config', () => ({
  readAppConfig: () => ({
    meticulousBaseUrl: 'http://machine.local:8080',
  }),
}));

vi.mock('./lib/create-dashboard-client', () => ({
  createDashboardClient: () => mocks.client,
}));

import { App } from './app';

describe('App', () => {
  beforeEach(() => {
    mocks.reset();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('renders machine fields before the other requests finish', async () => {
    render(<App />);

    mocks.deferreds.machine.resolve({
      state: 'Idle',
      water_temperature: 93.4,
      weight: 0.2,
    });

    await screen.findByText('93.4 C');
    expect(screen.getAllByText('Idle')).toHaveLength(2);
    expect(screen.getByText('0.2 g')).toBeDefined();
    expect(screen.queryByText('Bloom')).toBeNull();

    mocks.deferreds.lastProfile.resolve({ profile: { title: 'Bloom' } });
    await screen.findByText('Bloom');

    mocks.deferreds.settings.resolve({ heating_timeout: 10 });

    mocks.deferreds.history.resolve({ history: [] });
    await screen.findByText('No history rows have been mapped yet.');
  });

  it('dispatches tare and preheat actions from the actions card', async () => {
    render(<App />);

    mocks.deferreds.machine.resolve({
      state: 'Idle',
      water_temperature: 93.4,
      weight: 0.2,
    });
    mocks.deferreds.lastProfile.resolve({ profile: { title: 'Bloom' } });
    mocks.deferreds.settings.resolve({ heating_timeout: 10 });
    mocks.deferreds.history.resolve({ history: [] });

    const tareButton = await screen.findByRole('button', { name: 'Tare' });
    const preheatButton = await screen.findByRole('button', { name: 'Preheat' });

    fireEvent.click(tareButton);
    expect(mocks.client.tare).toHaveBeenCalledOnce();
    mocks.deferreds.tare.resolve();

    fireEvent.click(preheatButton);
    expect(mocks.client.preheat).toHaveBeenCalledOnce();
    mocks.deferreds.preheat.resolve({ ok: true });
  });

  it('counts preheat down after a successful preheat action', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-29T18:00:00.000Z'));

    await act(async () => {
      render(<App />);

      mocks.deferreds.machine.resolve({
        state: 'Idle',
        water_temperature: 93.4,
        weight: 0.2,
      });
      mocks.deferreds.lastProfile.resolve({ profile: { title: 'Bloom' } });
      mocks.deferreds.settings.resolve({ heating_timeout: 10 });
      mocks.deferreds.history.resolve({ history: [] });

      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Preheat' }));
    expect(mocks.client.preheat).toHaveBeenCalledOnce();

    await act(async () => {
      mocks.deferreds.preheat.resolve({ ok: true });
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: '10:00' })).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByRole('button', { name: '09:59' })).toBeDefined();
  });
});

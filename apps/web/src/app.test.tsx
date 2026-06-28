// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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

  const deferreds = {
    history: createDeferred<{ history: [] }>(),
    lastProfile: createDeferred<{ title: string }>(),
    machine: createDeferred<{
      state: string;
      water_temperature: number;
      weight: number;
    }>(),
    settings: createDeferred<{ preheat: boolean }>(),
  };

  const client = {
    getHistory: vi.fn(() => deferreds.history.promise),
    getLastProfile: vi.fn(() => deferreds.lastProfile.promise),
    getMachine: vi.fn(() => deferreds.machine.promise),
    getSettings: vi.fn(() => deferreds.settings.promise),
  };

  return { client, deferreds };
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
    expect(screen.queryByText('Off')).toBeNull();

    mocks.deferreds.lastProfile.resolve({ title: 'Bloom' });
    await screen.findByText('Bloom');
    expect(screen.queryByText('Off')).toBeNull();

    mocks.deferreds.settings.resolve({ preheat: false });
    await screen.findByText('Off');

    mocks.deferreds.history.resolve({ history: [] });
  });
});

// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, reject, resolve };
}

const mocks = vi.hoisted(() => {
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
      listProfiles: vi.fn(),
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
  const actual = await vi.importActual<
    typeof import('@shotlab/meticulous-client')
  >('@shotlab/meticulous-client');

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

vi.mock('swiper/react', () => ({
  Swiper: (props: { children: unknown }) => <div>{props.children}</div>,
  SwiperSlide: (props: { children: unknown }) => <div>{props.children}</div>,
}));

vi.mock('swiper/modules', () => ({
  Mousewheel: {},
}));

import { App } from './app';

describe('App', () => {
  beforeEach(() => {
    mocks.reset();
    mocks.client.listProfiles.mockResolvedValue([]);
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

    await screen.findByText('93.40 C');
    expect(screen.getAllByText('Idle')).toHaveLength(2);
    expect(screen.getByText('0.20 g')).toBeDefined();
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
    const preheatButton = await screen.findByRole('button', {
      name: 'Preheat',
    });

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

  it('renders profile imagery in the history table and selected shot chart header', async () => {
    render(<App />);

    mocks.deferreds.machine.resolve({
      state: 'Idle',
      water_temperature: 93.4,
      weight: 0.2,
    });
    mocks.deferreds.lastProfile.resolve({ profile: { title: 'Bloom' } });
    mocks.deferreds.settings.resolve({ heating_timeout: 10 });
    mocks.deferreds.history.resolve({
      history: [
        {
          id: 'shot-1',
          profile: {
            display: {
              image: '/profiles/bright.png',
            },
            name: 'Bright Filter',
          },
          timestamp: '2026-06-28T11:12:13.000Z',
          weights: [0, 2.5, 7.9],
        },
      ],
    });

    await screen.findByRole('img', {
      name: 'Bright Filter history profile image',
    });

    expect(
      screen
        .getByRole('img', { name: 'Bright Filter history profile image' })
        .getAttribute('src'),
    ).toBe('http://machine.local:8080/profiles/bright.png');

    fireEvent.click(
      screen.getByRole('row', {
        name: /Bright Filter history profile image .* Bright Filter/,
      }),
    );

    expect(
      screen
        .getAllByRole('img', { name: 'Bright Filter selected profile image' })
        .every(
          (image) =>
            image.getAttribute('src') ===
            'http://machine.local:8080/profiles/bright.png',
        ),
    ).toBe(true);
  });

  it('does not auto-load the first history shot into the main chart', async () => {
    render(<App />);

    mocks.deferreds.machine.resolve({
      state: 'Idle',
      water_temperature: 93.4,
      weight: 0.2,
    });
    mocks.deferreds.lastProfile.resolve({ profile: { title: 'Bloom' } });
    mocks.deferreds.settings.resolve({ heating_timeout: 10 });
    mocks.deferreds.history.resolve({
      history: [
        {
          id: 'shot-1',
          profile: {
            name: 'Bright Filter',
          },
          timestamp: '2026-06-28T11:12:13.000Z',
          weights: [0, 2.5, 7.9],
        },
      ],
    });

    await screen.findAllByText('No brew in process...');

    expect(screen.getByLabelText('Shot chart')).toBeDefined();
    expect(screen.getAllByText('No brew in process...')).toHaveLength(2);
    expect(screen.getAllByText('Live brew')).toHaveLength(2);
    expect(
      screen.getAllByRole('img', { name: 'Live brew default icon' }),
    ).toHaveLength(2);
    expect(screen.getByText('0 s • 0 g')).toBeDefined();
    expect(screen.getByText('0 bar')).toBeDefined();
    expect(screen.getByText('0 ml/s')).toBeDefined();
    expect(screen.getByText('0 g/s')).toBeDefined();
  });

  it('switches between live and history chart sources', async () => {
    render(<App />);

    mocks.deferreds.machine.resolve({
      state: 'Idle',
      water_temperature: 93.4,
      weight: 0.2,
    });
    mocks.deferreds.lastProfile.resolve({ profile: { title: 'Bloom' } });
    mocks.deferreds.settings.resolve({ heating_timeout: 10 });
    mocks.deferreds.history.resolve({
      history: [
        {
          id: 'shot-1',
          profile: {
            name: 'Bright Filter',
          },
          timestamp: '2026-06-28T11:12:13.000Z',
          weights: [0, 2.5, 7.9],
        },
      ],
    });

    await screen.findAllByText('No brew in process...');

    fireEvent.click(screen.getByRole('button', { name: 'History' }));
    await screen.findAllByText('No shot loaded.');
    expect(screen.getByText('Selected shot chart')).toBeDefined();

    fireEvent.click(screen.getByRole('row', { name: /Bright Filter/ }));
    expect(
      screen.getByRole('heading', { level: 6, name: 'Bright Filter' }),
    ).toBeDefined();
    expect(screen.getByText('Selected shot')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Live' }));
    await screen.findAllByText('No brew in process...');
    expect(screen.getAllByText('Live brew')).toHaveLength(2);
  });

  it('shows the loaded profile in the profiles card and lets idle selection change it', async () => {
    mocks.client.listProfiles.mockResolvedValue([
      {
        final_weight: 20,
        id: 'filter',
        name: 'Filter Day',
        stages: [{ name: 'Bloom' }],
        temperature: 92,
        variables: [{ key: 'grind' }],
      },
      {
        final_weight: 36,
        id: 'espresso',
        name: 'Night Espresso',
        stages: [{ name: 'Ramp' }, { name: 'Hold' }],
        temperature: 94,
        variables: [{ key: 'dose' }, { key: 'yield' }],
      },
    ]);

    render(<App />);

    mocks.deferreds.machine.resolve({
      loaded_profile: 'filter',
      state: 'Idle',
      water_temperature: 93.4,
      weight: 0.2,
    });
    mocks.deferreds.lastProfile.resolve({
      profile: { id: 'filter', name: 'Filter Day' },
    });
    mocks.deferreds.settings.resolve({ heating_timeout: 10 });
    mocks.deferreds.history.resolve({ history: [] });

    await screen.findByRole('heading', { level: 6, name: 'Filter Day' });
    expect(screen.getByRole('button', { name: 'Load profile' })).toBeDefined();
    expect(screen.getByText('92.00 C')).toBeDefined();

    fireEvent.click(
      screen.getByRole('button', { name: 'Select Night Espresso profile' }),
    );

    await screen.findByRole('heading', { level: 6, name: 'Night Espresso' });
    expect(screen.getByText('36.00 g')).toBeDefined();
  });

  it('locks the profiles card to the brewing profile during a live brew', async () => {
    mocks.client.listProfiles.mockResolvedValue([
      {
        final_weight: 20,
        id: 'filter',
        name: 'Filter Day',
        stages: [{ name: 'Bloom' }],
        temperature: 92,
        variables: [{ key: 'grind' }],
      },
      {
        final_weight: 36,
        id: 'espresso',
        name: 'Night Espresso',
        stages: [{ name: 'Ramp' }, { name: 'Hold' }],
        temperature: 94,
        variables: [{ key: 'dose' }, { key: 'yield' }],
      },
    ]);

    render(<App />);

    mocks.deferreds.machine.resolve({
      loaded_profile: 'filter',
      profile: 'espresso',
      state: 'brewing',
      water_temperature: 93.4,
      weight: 0.2,
    });
    mocks.deferreds.lastProfile.resolve({
      profile: { id: 'filter', name: 'Filter Day' },
    });
    mocks.deferreds.settings.resolve({ heating_timeout: 10 });
    mocks.deferreds.history.resolve({ history: [] });

    await screen.findByRole('heading', { level: 6, name: 'Night Espresso' });

    const idleProfileButton = screen.getByRole('button', {
      name: 'Select Filter Day profile',
    });
    expect(idleProfileButton.hasAttribute('disabled')).toBe(true);

    fireEvent.click(idleProfileButton);

    expect(
      screen.getByRole('heading', { level: 6, name: 'Night Espresso' }),
    ).toBeDefined();
  });

  it('selects the history shot profile once and lets later carousel changes stick', async () => {
    mocks.client.listProfiles.mockResolvedValue([
      {
        final_weight: 20,
        id: 'filter',
        name: 'Filter Day',
        stages: [{ name: 'Bloom' }],
        temperature: 92,
        variables: [{ key: 'grind' }],
      },
      {
        final_weight: 36,
        id: 'espresso',
        name: 'Night Espresso',
        stages: [{ name: 'Ramp' }, { name: 'Hold' }],
        temperature: 94,
        variables: [{ key: 'dose' }, { key: 'yield' }],
      },
    ]);

    render(<App />);

    mocks.deferreds.machine.resolve({
      state: 'Idle',
      water_temperature: 93.4,
      weight: 0.2,
    });
    mocks.deferreds.lastProfile.resolve({
      profile: { id: 'filter', name: 'Filter Day' },
    });
    mocks.deferreds.settings.resolve({ heating_timeout: 10 });
    mocks.deferreds.history.resolve({
      history: [
        {
          id: 'shot-1',
          profile: {
            id: 'espresso',
            name: 'Night Espresso',
          },
          timestamp: '2026-06-28T11:12:13.000Z',
          weights: [0, 2.5, 7.9],
        },
      ],
    });

    await screen.findAllByText('No brew in process...');

    fireEvent.click(screen.getByRole('row', { name: /Night Espresso/ }));
    expect(
      await screen.findAllByRole('heading', {
        level: 6,
        name: 'Night Espresso',
      }),
    ).toHaveLength(2);

    fireEvent.click(
      screen.getByRole('button', { name: 'Select Filter Day profile' }),
    );
    expect(
      await screen.findAllByRole('heading', { level: 6, name: 'Filter Day' }),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole('heading', { level: 6, name: 'Night Espresso' }),
    ).toHaveLength(1);
  });

  it('syncs the selected history shot profile after profiles finish loading', async () => {
    const profilesDeferred = createDeferred([
      {
        final_weight: 20,
        id: 'filter',
        name: 'Filter Day',
        stages: [{ name: 'Bloom' }],
        temperature: 92,
        variables: [{ key: 'grind' }],
      },
      {
        final_weight: 36,
        id: 'espresso',
        name: 'Night Espresso',
        stages: [{ name: 'Ramp' }, { name: 'Hold' }],
        temperature: 94,
        variables: [{ key: 'dose' }, { key: 'yield' }],
      },
    ]);
    mocks.client.listProfiles.mockReturnValue(profilesDeferred.promise);

    render(<App />);

    mocks.deferreds.machine.resolve({
      state: 'Idle',
      water_temperature: 93.4,
      weight: 0.2,
    });
    mocks.deferreds.lastProfile.resolve({
      profile: { id: 'filter', name: 'Filter Day' },
    });
    mocks.deferreds.settings.resolve({ heating_timeout: 10 });
    mocks.deferreds.history.resolve({
      history: [
        {
          id: 'shot-1',
          profile: {
            id: 'espresso',
            name: 'Night Espresso',
          },
          timestamp: '2026-06-28T11:12:13.000Z',
          weights: [0, 2.5, 7.9],
        },
      ],
    });

    await screen.findAllByText('No brew in process...');

    fireEvent.click(screen.getByRole('row', { name: /Night Espresso/ }));
    expect(
      screen.getByRole('heading', { level: 6, name: 'Night Espresso' }),
    ).toBeDefined();

    await act(async () => {
      profilesDeferred.resolve([
        {
          final_weight: 20,
          id: 'filter',
          name: 'Filter Day',
          stages: [{ name: 'Bloom' }],
          temperature: 92,
          variables: [{ key: 'grind' }],
        },
        {
          final_weight: 36,
          id: 'espresso',
          name: 'Night Espresso',
          stages: [{ name: 'Ramp' }, { name: 'Hold' }],
          temperature: 94,
          variables: [{ key: 'dose' }, { key: 'yield' }],
        },
      ]);
      await Promise.resolve();
    });

    expect(
      await screen.findAllByRole('heading', {
        level: 6,
        name: 'Night Espresso',
      }),
    ).toHaveLength(2);
  });

  it('reselects the displayed shot profile when the selected shot header is clicked', async () => {
    mocks.client.listProfiles.mockResolvedValue([
      {
        final_weight: 20,
        id: 'filter',
        name: 'Filter Day',
        stages: [{ name: 'Bloom' }],
        temperature: 92,
        variables: [{ key: 'grind' }],
      },
      {
        final_weight: 36,
        id: 'espresso',
        name: 'Night Espresso',
        stages: [{ name: 'Ramp' }, { name: 'Hold' }],
        temperature: 94,
        variables: [{ key: 'dose' }, { key: 'yield' }],
      },
    ]);

    render(<App />);

    mocks.deferreds.machine.resolve({
      state: 'Idle',
      water_temperature: 93.4,
      weight: 0.2,
    });
    mocks.deferreds.lastProfile.resolve({
      profile: { id: 'filter', name: 'Filter Day' },
    });
    mocks.deferreds.settings.resolve({ heating_timeout: 10 });
    mocks.deferreds.history.resolve({
      history: [
        {
          id: 'shot-1',
          profile: {
            id: 'espresso',
            name: 'Night Espresso',
          },
          timestamp: '2026-06-28T11:12:13.000Z',
          weights: [0, 2.5, 7.9],
        },
      ],
    });

    await screen.findAllByText('No brew in process...');

    fireEvent.click(screen.getByRole('row', { name: /Night Espresso/ }));
    expect(
      await screen.findAllByRole('heading', {
        level: 6,
        name: 'Night Espresso',
      }),
    ).toHaveLength(2);

    fireEvent.click(
      screen.getByRole('button', { name: 'Select Filter Day profile' }),
    );
    expect(
      await screen.findAllByRole('heading', { level: 6, name: 'Filter Day' }),
    ).toHaveLength(2);

    fireEvent.click(
      screen.getAllByRole('button', { name: /Night Espresso/i })[0],
    );

    expect(
      await screen.findAllByRole('heading', {
        level: 6,
        name: 'Night Espresso',
      }),
    ).toHaveLength(2);
  });
});

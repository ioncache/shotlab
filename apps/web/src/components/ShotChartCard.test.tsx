// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShotChartCard } from './ShotChartCard';
import type { DashboardShot } from '../lib/dashboard-types';

const shot: DashboardShot = {
  brewedAt: '2026-06-28 11:12',
  doseGrams: 18,
  durationSeconds: 29,
  id: 'shot-1',
  points: [
    {
      flow: 1.2,
      gravimetricFlow: 1.1,
      pressure: 8.5,
      second: 0,
      temperatureCelsius: 93.4,
      weight: 0,
    },
  ],
  profile: 'Bright Filter',
  profileImage: '/profiles/bright.png',
  source: 'history',
  yieldGrams: 36,
};

const replayShot: DashboardShot = {
  ...shot,
  durationSeconds: 0.2,
  id: 'shot-2',
  points: [
    {
      flow: 1.2,
      gravimetricFlow: 1.1,
      pressure: 8.5,
      second: 0,
      temperatureCelsius: 93.4,
      weight: 0,
    },
    {
      flow: 2.3,
      gravimetricFlow: 2.2,
      pressure: 8.9,
      second: 0.1,
      temperatureCelsius: 93.6,
      weight: 10,
    },
    {
      flow: 3.4,
      gravimetricFlow: 3.3,
      pressure: 9.1,
      second: 0.2,
      temperatureCelsius: 93.8,
      weight: 20,
    },
  ],
  yieldGrams: 20,
};

describe('ShotChartCard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      window.setTimeout(() => {
        callback(performance.now());
      }, 16),
    );
    vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
      window.clearTimeout(handle);
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('renders the default live state and exposes source toggles', () => {
    const onSourceChange = vi.fn();

    render(
      <ShotChartCard
        activeSource="live"
        isMachineLoading={false}
        isShotLoading={false}
        machineStateLabel="Idle"
        onSourceChange={onSourceChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'History' }));

    expect(screen.getByText('Live brew chart')).toBeDefined();
    expect(screen.getAllByText('No brew in process...').length).toBeGreaterThan(
      0,
    );
    expect(onSourceChange).toHaveBeenCalledWith('history');
  });

  it('renders the selected shot image with the machine base url', () => {
    render(
      <ShotChartCard
        activeSource="history"
        isMachineLoading={false}
        isShotLoading={false}
        machineBaseUrl="http://machine.local:8080"
        machineStateLabel="Idle"
        onSourceChange={() => undefined}
        shot={shot}
      />,
    );

    expect(
      screen
        .getByRole('img', { name: 'Bright Filter selected profile image' })
        .getAttribute('src'),
    ).toBe('http://machine.local:8080/profiles/bright.png');
  });

  it('replays a history shot through the displayed point details', () => {
    render(
      <ShotChartCard
        activeSource="history"
        isMachineLoading={false}
        isShotLoading={false}
        machineStateLabel="Idle"
        onSourceChange={() => undefined}
        shot={replayShot}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    expect(screen.getByText('0.00 s')).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(160);
    });

    expect(screen.getByText('0.10 s')).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(120);
    });

    expect(screen.getByText('0.20 s')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Play' })).toBeDefined();
  });

  it('lets the slider scrub the active history point', () => {
    render(
      <ShotChartCard
        activeSource="history"
        isMachineLoading={false}
        isShotLoading={false}
        machineStateLabel="Idle"
        onSourceChange={() => undefined}
        shot={replayShot}
      />,
    );

    fireEvent.change(screen.getByRole('slider'), { target: { value: '1' } });

    expect(screen.getByText('10.00 g')).toBeDefined();
  });

  it('stops replay and resets to the end state when the selected shot changes', () => {
    const { rerender } = render(
      <ShotChartCard
        activeSource="history"
        isMachineLoading={false}
        isShotLoading={false}
        machineStateLabel="Idle"
        onSourceChange={() => undefined}
        shot={replayShot}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByText('0.00 s')).toBeDefined();

    rerender(
      <ShotChartCard
        activeSource="history"
        isMachineLoading={false}
        isShotLoading={false}
        machineStateLabel="Idle"
        onSourceChange={() => undefined}
        shot={{
          ...replayShot,
          id: 'shot-3',
          points: [
            replayShot.points[0],
            {
              ...replayShot.points[1],
              second: 0.4,
              weight: 40,
            },
          ],
          yieldGrams: 40,
        }}
      />,
    );

    expect(screen.getByText('0.40 s')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Play' })).toBeDefined();
  });

  it('keeps live shots pointed at the latest point as telemetry extends the same id', () => {
    const { rerender } = render(
      <ShotChartCard
        activeSource="live"
        isMachineLoading={false}
        isShotLoading={false}
        machineStateLabel="brewing"
        onSourceChange={() => undefined}
        shot={{
          ...shot,
          id: 'live-shot:1',
          points: [shot.points[0]],
          source: 'live',
          yieldGrams: 0,
        }}
      />,
    );

    expect(screen.getByText('0.00 g')).toBeDefined();

    rerender(
      <ShotChartCard
        activeSource="live"
        isMachineLoading={false}
        isShotLoading={false}
        machineStateLabel="brewing"
        onSourceChange={() => undefined}
        shot={{
          ...shot,
          id: 'live-shot:1',
          points: [
            shot.points[0],
            {
              ...shot.points[0],
              flow: 2.4,
              gravimetricFlow: 2.1,
              pressure: 9.1,
              second: 1,
              weight: 10,
            },
          ],
          source: 'live',
          yieldGrams: 10,
        }}
      />,
    );

    expect(screen.getByText('10.00 g')).toBeDefined();
    expect(screen.getByText('1.00 s')).toBeDefined();
  });
});

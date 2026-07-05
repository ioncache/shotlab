// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShotChartCard } from './ShotChartCard';

const shot = {
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
  yieldGrams: 36,
};

describe('ShotChartCard', () => {
  afterEach(() => {
    cleanup();
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
});

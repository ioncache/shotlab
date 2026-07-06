// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HistoryTableCard } from './HistoryTableCard';

const shot = {
  brewedAt: '2026-06-28 11:12',
  doseGrams: 18,
  durationSeconds: 29,
  id: 'shot-1',
  points: [],
  profile: 'Bright Filter',
  profileImage: '/profiles/bright.png',
  source: 'history' as const,
  yieldGrams: 36,
};

describe('HistoryTableCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders shot rows and selects a shot when clicked', () => {
    const onSelectShot = vi.fn();

    render(
      <HistoryTableCard
        historyLoading={false}
        machineBaseUrl="http://machine.local:8080"
        onSelectShot={onSelectShot}
        shots={[shot]}
      />,
    );

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

    expect(onSelectShot).toHaveBeenCalledWith('shot-1');
  });

  it('renders the empty state when there are no shots', () => {
    render(
      <HistoryTableCard
        historyLoading={false}
        onSelectShot={() => undefined}
        shots={[]}
      />,
    );

    expect(
      screen.getByText('No history rows have been mapped yet.'),
    ).toBeDefined();
  });

  it('selects a shot from the keyboard and exposes selected state', () => {
    const onSelectShot = vi.fn();

    render(
      <HistoryTableCard
        historyLoading={false}
        onSelectShot={onSelectShot}
        selectedShotId="shot-1"
        shots={[shot]}
      />,
    );

    const row = screen.getByRole('row', {
      name: /Bright Filter/,
      selected: true,
    });

    fireEvent.keyDown(row, { key: 'Enter' });

    expect(onSelectShot).toHaveBeenCalledWith('shot-1');
  });
});

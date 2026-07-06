// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShotDetailsCard } from './ShotDetailsCard';

const shot = {
  brewedAt: '2026-06-28 11:12',
  doseGrams: 18,
  durationSeconds: 29,
  id: 'shot-id-that-is-long-enough-to-overflow-the-card-width',
  points: [],
  profile: 'Bright Filter',
  profileImage: '/profiles/bright.png',
  source: 'history' as const,
  yieldGrams: 36,
};

describe('ShotDetailsCard', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders default live values when there is no selected shot', () => {
    render(
      <ShotDetailsCard
        activeSource="live"
        historyLoading={false}
        isProfileSelectionDisabled={false}
        onNext={() => undefined}
        onProfileSelect={() => undefined}
        onPrevious={() => undefined}
        selectedShotIndex={-1}
        shotCount={0}
      />,
    );

    expect(screen.getAllByText('Live brew')).toHaveLength(2);
    expect(
      screen.getAllByRole('img', { name: 'Live brew default icon' }),
    ).toHaveLength(1);
    expect(screen.getAllByText('0 g')).toHaveLength(2);
    expect(screen.getByText('0 s')).toBeDefined();
  });

  it('copies the full shot id when the shot id value is clicked', async () => {
    const writeText = vi.mocked(navigator.clipboard.writeText);

    render(
      <ShotDetailsCard
        activeSource="history"
        historyLoading={false}
        isProfileSelectionDisabled={false}
        onNext={() => undefined}
        onProfileSelect={() => undefined}
        onPrevious={() => undefined}
        selectedShot={shot}
        selectedShotIndex={0}
        shotCount={1}
      />,
    );

    const copyButton = screen.getByRole('button', { name: 'Copy shot ID' });

    fireEvent.click(copyButton);

    expect(writeText).toHaveBeenCalledWith(shot.id);
  });

  it('calls the profile selection handler from the header row when enabled', () => {
    const onProfileSelect = vi.fn();

    render(
      <ShotDetailsCard
        activeSource="history"
        historyLoading={false}
        isProfileSelectionDisabled={false}
        onNext={() => undefined}
        onProfileSelect={onProfileSelect}
        onPrevious={() => undefined}
        selectedShot={shot}
        selectedShotIndex={0}
        shotCount={1}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Bright Filter/i }));

    expect(onProfileSelect).toHaveBeenCalledOnce();
  });

  it('shows an empty-state shot id instead of a fake numeric id', () => {
    render(
      <ShotDetailsCard
        activeSource="history"
        historyLoading={false}
        isProfileSelectionDisabled={false}
        onNext={() => undefined}
        onProfileSelect={() => undefined}
        onPrevious={() => undefined}
        selectedShotIndex={-1}
        shotCount={0}
      />,
    );

    expect(screen.getByText('—')).toBeDefined();
    expect(
      screen
        .getByRole('button', { name: 'Copy shot ID' })
        .hasAttribute('disabled'),
    ).toBe(true);
  });
});

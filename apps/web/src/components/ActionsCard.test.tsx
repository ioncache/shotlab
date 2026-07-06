// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActionsCard } from './ActionsCard';

describe('ActionsCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('calls tare and preheat handlers when enabled', () => {
    const onPreheat = vi.fn();
    const onTare = vi.fn();

    render(
      <ActionsCard
        canPreheat
        canTare
        isPreheatPending={false}
        isTarePending={false}
        onPreheat={onPreheat}
        onTare={onTare}
        preheatLabel="Preheat"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tare' }));
    fireEvent.click(screen.getByRole('button', { name: 'Preheat' }));

    expect(onTare).toHaveBeenCalledOnce();
    expect(onPreheat).toHaveBeenCalledOnce();
  });

  it('shows pending labels and error messages', () => {
    render(
      <ActionsCard
        canPreheat
        canTare
        isPreheatPending
        isTarePending
        onPreheat={() => undefined}
        onTare={() => undefined}
        preheatError="Preheat failed"
        preheatLabel="Preheat"
        tareError="Tare failed"
      />,
    );

    expect(screen.getAllByText('Sending...')).toHaveLength(2);
    expect(screen.getByText('Tare failed')).toBeDefined();
    expect(screen.getByText('Preheat failed')).toBeDefined();
  });
});

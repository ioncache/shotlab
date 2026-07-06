// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LiveInfoCards } from './LiveInfoCards';

const liveCards = [
  { label: 'Temperature', value: '93.40 C' },
  { label: 'Machine status', value: 'Idle' },
  { label: 'Weight', value: '0.20 g' },
  { label: 'Last loaded profile', value: 'Bloom' },
];

describe('LiveInfoCards', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows machine values when not loading', () => {
    render(
      <LiveInfoCards
        liveCards={liveCards}
        loading={{
          history: false,
          lastProfile: false,
          machine: false,
          settings: false,
        }}
      />,
    );

    expect(screen.getByText('93.40 C')).toBeDefined();
    expect(screen.getByText('Idle')).toBeDefined();
    expect(screen.getByText('0.20 g')).toBeDefined();
    expect(screen.getByText('Bloom')).toBeDefined();
  });

  it('hides machine values while machine data is loading', () => {
    render(
      <LiveInfoCards
        liveCards={liveCards}
        loading={{
          history: false,
          lastProfile: false,
          machine: true,
          settings: false,
        }}
      />,
    );

    expect(screen.queryByText('93.40 C')).toBeNull();
    expect(screen.queryByText('Idle')).toBeNull();
    expect(screen.queryByText('0.20 g')).toBeNull();
    expect(screen.getByText('Bloom')).toBeDefined();
  });
});

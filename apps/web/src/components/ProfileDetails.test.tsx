// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ProfileDetails } from './ProfileDetails';

describe('ProfileDetails', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders default values when no profile is selected', () => {
    render(<ProfileDetails />);

    expect(
      screen.getByRole('heading', { level: 6, name: 'No profile selected' }),
    ).toBeDefined();
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('renders profile metrics from the selected profile', () => {
    render(
      <ProfileDetails
        profile={{
          display: { description: 'Long, syrupy profile.' },
          final_weight: 36,
          name: 'Night Espresso',
          stages: [{ name: 'Ramp' }, { name: 'Hold' }],
          temperature: 94,
          variables: [{ key: 'dose' }, { key: 'yield' }],
        }}
      />,
    );

    expect(
      screen.getByRole('heading', { level: 6, name: 'Night Espresso' }),
    ).toBeDefined();
    expect(screen.getByText('Long, syrupy profile.')).toBeDefined();
    expect(screen.getByText('94.00 C')).toBeDefined();
    expect(screen.getByText('36.00 g')).toBeDefined();
    expect(screen.getByText('Stages')).toBeDefined();
    expect(screen.getByText('Variables')).toBeDefined();
  });
});

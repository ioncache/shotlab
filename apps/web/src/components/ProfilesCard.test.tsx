// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProfilesCard } from './ProfilesCard';

vi.mock('swiper/react', () => ({
  Swiper: (props: { children: unknown }) => <div>{props.children}</div>,
  SwiperSlide: (props: { children: unknown }) => <div>{props.children}</div>,
}));

vi.mock('swiper/modules', () => ({
  Mousewheel: {},
}));

describe('ProfilesCard', () => {
  it('renders the active profile details and disabled load button', () => {
    render(
      <ProfilesCard
        activeProfile={{
          final_weight: 36,
          id: 'espresso',
          name: 'Night Espresso',
          stages: [{ name: 'Ramp' }, { name: 'Hold' }],
          temperature: 94,
          variables: [{ key: 'dose' }, { key: 'yield' }],
        }}
        activeProfileId="espresso"
        isLocked={false}
        onSelectProfile={vi.fn()}
        profiles={[
          { id: 'filter', name: 'Filter Day' },
          { id: 'espresso', name: 'Night Espresso' },
        ]}
      />,
    );

    expect(screen.getByText('Profiles')).toBeDefined();
    expect(
      screen.getByRole('heading', { level: 6, name: 'Night Espresso' }),
    ).toBeDefined();
    expect(
      screen
        .getByRole('button', { name: 'Load profile' })
        .hasAttribute('disabled'),
    ).toBe(true);
  });
});

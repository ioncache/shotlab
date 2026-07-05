// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProfileCarousel } from './ProfileCarousel';

vi.mock('swiper/react', () => ({
  Swiper: (props: { children: unknown }) => <div>{props.children}</div>,
  SwiperSlide: (props: { children: unknown }) => <div>{props.children}</div>,
}));

vi.mock('swiper/modules', () => ({
  Mousewheel: {},
}));

const profiles = [
  { id: 'filter', name: 'Filter Day' },
  { id: 'espresso', name: 'Night Espresso' },
];

describe('ProfileCarousel', () => {
  afterEach(() => {
    cleanup();
  });

  it('selects an idle profile when it is clicked', () => {
    const onSelectProfile = vi.fn();

    render(
      <ProfileCarousel
        activeProfileId="filter"
        isLocked={false}
        onSelectProfile={onSelectProfile}
        profiles={profiles}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Select Night Espresso profile' }),
    );

    expect(onSelectProfile).toHaveBeenCalledWith('espresso');
  });

  it('blocks profile changes during a live brew', () => {
    const onSelectProfile = vi.fn();

    render(
      <ProfileCarousel
        activeProfileId="espresso"
        isLocked
        onSelectProfile={onSelectProfile}
        profiles={profiles}
      />,
    );

    const filterButton = screen.getByRole('button', {
      name: 'Select Filter Day profile',
    });

    expect(
      filterButton.hasAttribute('disabled') ||
        filterButton.getAttribute('aria-disabled') === 'true',
    ).toBe(true);
    fireEvent.click(filterButton);
    expect(onSelectProfile).not.toHaveBeenCalled();
  });
});

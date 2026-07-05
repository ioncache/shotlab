import { describe, expect, it } from 'vitest';
import { orderProfiles, selectProfileBrowserState } from './profile-display';

const profiles = [
  { id: 'espresso', name: 'Night Espresso' },
  { id: 'filter', name: 'Filter Day' },
  { id: 'milk', name: 'Milk Course' },
];

describe('orderProfiles', () => {
  it('uses settings.profile_order and appends any remaining profiles', () => {
    expect(orderProfiles(profiles, ['filter', 'espresso'])).toEqual([
      { id: 'filter', name: 'Filter Day' },
      { id: 'espresso', name: 'Night Espresso' },
      { id: 'milk', name: 'Milk Course' },
    ]);
  });
});

describe('selectProfileBrowserState', () => {
  it('uses the manual selection while idle', () => {
    expect(
      selectProfileBrowserState({
        lastProfile: {},
        machine: { loaded_profile: 'filter', state: 'Idle' },
        profiles,
        selectedProfileId: 'milk',
        settings: { profile_order: ['filter', 'espresso', 'milk'] },
      }).activeProfile?.id,
    ).toBe('milk');
  });

  it('uses the live brew profile while brewing', () => {
    const state = selectProfileBrowserState({
      lastProfile: { profile: { id: 'filter', name: 'Filter Day' } },
      machine: {
        loaded_profile: 'filter',
        profile: 'espresso',
        state: 'brewing',
      },
      profiles,
      selectedProfileId: 'milk',
      settings: { profile_order: ['filter', 'espresso', 'milk'] },
    });

    expect(state.isBrewing).toBe(true);
    expect(state.activeProfile?.id).toBe('espresso');
  });
});

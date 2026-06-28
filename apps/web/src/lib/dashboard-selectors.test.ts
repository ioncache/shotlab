import { describe, expect, it } from 'vitest';
import {
  selectDashboardSnapshot,
  selectHistoryShots,
  selectLiveCards,
} from './dashboard-selectors';

describe('selectLiveCards', () => {
  it('returns fallback labels when machine fields are missing', () => {
    expect(selectLiveCards({}, {}, {})).toEqual([
      { label: 'Temperature', value: 'Unavailable' },
      { label: 'Machine status', value: 'Unknown' },
      { label: 'Weight', value: 'Unavailable' },
      { label: 'Last loaded profile', value: 'Unavailable' },
      { label: 'Pre-heat', value: 'Unknown' },
    ]);
  });

  it('reads the known live fields when present', () => {
    expect(
      selectLiveCards(
        {
          profile: 'Filter Bright 1',
          state: 'Idle',
          water_temperature: 93.4,
          weight: 0.2,
        },
        { preheat: true, tare: false },
        {},
      ),
    ).toEqual([
      { label: 'Temperature', value: '93.4 C' },
      { label: 'Machine status', value: 'Idle' },
      { label: 'Weight', value: '0.2 g' },
      { label: 'Last loaded profile', value: 'Filter Bright 1' },
      { label: 'Pre-heat', value: 'On' },
    ]);
  });
});

describe('selectHistoryShots', () => {
  it('normalizes history rows and extraction curve points', () => {
    expect(
      selectHistoryShots({
        history: [
          {
            dose: 18,
            id: 'shot-1',
            profile_title: 'Filter Bright 1',
            time: 31,
            timestamp: '2026-06-28T11:12:13.000Z',
            weight: 40.2,
            weights: [0, 2.5, 7.9, 15.4],
          },
        ],
      }),
    ).toEqual([
      {
        brewedAt: '2026-06-28 11:12',
        doseGrams: 18,
        durationSeconds: 31,
        id: 'shot-1',
        points: [
          {
            flow: null,
            gravimetricFlow: null,
            pressure: null,
            second: 0,
            temperatureCelsius: null,
            weight: 0,
          },
          {
            flow: null,
            gravimetricFlow: null,
            pressure: null,
            second: 1,
            temperatureCelsius: null,
            weight: 2.5,
          },
          {
            flow: null,
            gravimetricFlow: null,
            pressure: null,
            second: 2,
            temperatureCelsius: null,
            weight: 7.9,
          },
          {
            flow: null,
            gravimetricFlow: null,
            pressure: null,
            second: 3,
            temperatureCelsius: null,
            weight: 15.4,
          },
        ],
        profile: 'Filter Bright 1',
        yieldGrams: 40.2,
      },
    ]);
  });

  it('normalizes the real machine history shape with nested data points', () => {
    expect(
      selectHistoryShots({
        history: [
          {
            id: '356a135e-d842-4a64-b496-8c7f37d073b9',
            name: 'Low Contact',
            time: 1782647978.236253,
            data: [
              {
                shot: {
                  flow: 2.58,
                  gravimetric_flow: 0,
                  pressure: 0,
                  weight: 0,
                },
                sensors: { external_1: 100.65 },
                time: 2,
              },
              {
                shot: {
                  flow: 15.76,
                  gravimetric_flow: 0.34,
                  pressure: 2.46,
                  weight: 4.13,
                },
                sensors: { external_1: 99.91 },
                time: 1958,
              },
              {
                shot: {
                  flow: 13.66,
                  gravimetric_flow: 1.33,
                  pressure: 3.12,
                  weight: 5.87,
                },
                sensors: { external_1: 99.84 },
                time: 2193,
              },
            ],
          },
        ],
      }),
    ).toEqual([
      {
        brewedAt: '2026-06-28 11:59',
        doseGrams: null,
        durationSeconds: 2.193,
        id: '356a135e-d842-4a64-b496-8c7f37d073b9',
        points: [
          {
            flow: 2.58,
            gravimetricFlow: 0,
            pressure: 0,
            second: 0.002,
            temperatureCelsius: 100.65,
            weight: 0,
          },
          {
            flow: 15.76,
            gravimetricFlow: 0.34,
            pressure: 2.46,
            second: 1.958,
            temperatureCelsius: 99.91,
            weight: 4.13,
          },
          {
            flow: 13.66,
            gravimetricFlow: 1.33,
            pressure: 3.12,
            second: 2.193,
            temperatureCelsius: 99.84,
            weight: 5.87,
          },
        ],
        profile: 'Low Contact',
        yieldGrams: 5.87,
      },
    ]);
  });

  it('reads nested last-profile data and machine settings fields we have observed', () => {
    expect(
      selectLiveCards(
        {},
        { heat_on_boot: true },
        {
          profile: {
            final_weight: 40,
            name: 'Italian',
            temperature: 90.5,
          },
        },
      ),
    ).toEqual([
      { label: 'Temperature', value: 'Unavailable' },
      { label: 'Machine status', value: 'Unknown' },
      { label: 'Weight', value: 'Unavailable' },
      { label: 'Last loaded profile', value: 'Italian' },
      { label: 'Pre-heat', value: 'Unknown' },
    ]);
  });
});

describe('selectDashboardSnapshot', () => {
  it('chooses the first available shot as the selected shot', () => {
    expect(
      selectDashboardSnapshot(
        { current_state: 'Heating' },
        {},
        { history: [{ id: 'shot-1', weights: [0, 1] }] },
        { title: 'Daily Driver' },
      ),
    ).toEqual({
      liveCards: [
        { label: 'Temperature', value: 'Unavailable' },
        { label: 'Machine status', value: 'Heating' },
        { label: 'Weight', value: 'Unavailable' },
        { label: 'Last loaded profile', value: 'Daily Driver' },
        { label: 'Pre-heat', value: 'Unknown' },
      ],
      machineStateLabel: 'Heating',
      selectedShotId: 'shot-1',
      shots: [
        {
          brewedAt: 'Unknown time',
          doseGrams: null,
          durationSeconds: null,
          id: 'shot-1',
          points: [
            {
              flow: null,
              gravimetricFlow: null,
              pressure: null,
              second: 0,
              temperatureCelsius: null,
              weight: 0,
            },
            {
              flow: null,
              gravimetricFlow: null,
              pressure: null,
              second: 1,
              temperatureCelsius: null,
              weight: 1,
            },
          ],
          profile: 'Unknown profile',
          yieldGrams: null,
        },
      ],
    });
  });
});

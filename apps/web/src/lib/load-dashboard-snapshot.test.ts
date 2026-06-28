import { describe, expect, it, vi } from 'vitest';
import { loadDashboardSnapshot } from './load-dashboard-snapshot';

describe('loadDashboardSnapshot', () => {
  it('loads the confirmed REST read endpoints and normalizes them', async () => {
    const client = {
      getHistory: vi.fn().mockResolvedValue({
        history: [{ id: 'shot-1', profile: 'Bloom', weights: [0, 1, 3] }],
      }),
      getLastProfile: vi.fn().mockResolvedValue({ title: 'Bloom' }),
      getMachine: vi.fn().mockResolvedValue({ state: 'Idle' }),
      getSettings: vi.fn().mockResolvedValue({ preheat: false, tare: false }),
    };

    await expect(loadDashboardSnapshot(client)).resolves.toEqual({
      liveCards: [
        { label: 'Temperature', value: 'Unavailable' },
        { label: 'Machine status', value: 'Idle' },
        { label: 'Weight', value: 'Unavailable' },
        { label: 'Last loaded profile', value: 'Bloom' },
        { label: 'Pre-heat', value: 'Off' },
      ],
      machineStateLabel: 'Idle',
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
            {
              flow: null,
              gravimetricFlow: null,
              pressure: null,
              second: 2,
              temperatureCelsius: null,
              weight: 3,
            },
          ],
          profile: 'Bloom',
          yieldGrams: null,
        },
      ],
    });
    expect(client.getMachine).toHaveBeenCalledOnce();
    expect(client.getSettings).toHaveBeenCalledOnce();
    expect(client.getHistory).toHaveBeenCalledOnce();
    expect(client.getLastProfile).toHaveBeenCalledOnce();
  });
});
